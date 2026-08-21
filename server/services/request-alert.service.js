const { findRankedDonors } = require('./donor-matching.service');
const { sendMail } = require('./mailer.service');
const { sendSms } = require('./sms.service');
const { haversineKm } = require('./geo.service');
const { notifyUser } = require('./notification.service');
const BloodBankProfile = require('../models/blood-bank-profile.model');
const { NOTIFY_TIER_SIZE } = require('../constants');

// `options.includeTraveling` — the hospital's manual "notify all" override:
// reaches every remaining ranked donor in one go instead of just the next
// tier, since it's meant to cast the widest net immediately.
//
// `options.notifyEveryone` — the same "notify all" override also drops
// blood-group compatibility, availability, and city/state/radius narrowing:
// it's a last-resort broadcast to every registered donor account, not a
// matching search (see donor-matching.service.js's findRankedDonors).
//
// A donor is always excluded from being alerted about their own raised
// request (derived from the request itself, not passed by callers) —
// applies uniformly whether this runs at creation, a manual re-notify, or
// the escalation/tier jobs.
//
// Mutates `request.notifiedDonorIds` in place (the caller is responsible for
// `request.save()`, matching the existing pattern for `matches`/`status`).
async function notifyDonorsForRequest(request, options = {}) {
  const { includeTraveling = false, notifyEveryone = false } = options;
  const excludeUserId = request.raisedBy === 'donor' ? request.raisedByUserId : null;

  // Critical requests broadcast to every compatible donor regardless of
  // location; Urgent/Routine narrow to the requester's own city+state. If
  // city/state weren't captured (older account, skipped it), fall back to
  // the km-radius the request may have from GPS coordinates, and if that's
  // absent too, fall back further to "everyone compatible" rather than
  // silently alerting nobody.
  const matchOptions = notifyEveryone
    ? { excludeUserId, includeTraveling: true, includeUnavailable: true, ignoreBloodGroup: true }
    : request.priority === 'Critical'
      ? { excludeUserId, includeTraveling }
      : {
          excludeUserId,
          includeTraveling,
          city: request.city || null,
          state: request.state || null,
          originPoint: request.location || null,
          radiusKm: request.searchRadiusKm || null,
        };

  // Ranked highest-Priority-Score first (see donor-matching.service.js /
  // priority-score.service.js) -- so "the next tier" below always means the
  // next-most-likely-to-respond donors, not an arbitrary slice.
  const rankedDonors = await findRankedDonors(request.bloodGroup, matchOptions);

  const alreadyNotifiedIds = (request.notifiedDonorIds || []).map((id) => id.toString());
  const alreadyNotified = new Set(alreadyNotifiedIds);
  const notYetNotified = rankedDonors.filter((donor) => !alreadyNotified.has(donor._id.toString()));

  if (!notYetNotified.length) {
    return {
      matches: alreadyNotified.size,
      newlyNotified: 0,
      emailSent: 0,
      smsSent: 0,
      message:
        alreadyNotified.size > 0
          ? `Already alerted the ${alreadyNotified.size} best-matching donor${
              alreadyNotified.size === 1 ? '' : 's'
            } available.`
          : 'No compatible registered donors are currently available.',
    };
  }

  // Notify-all reaches everyone remaining; the normal flow (creation, manual
  // re-notify, tier job) reaches only the next priority tier, holding the
  // rest in reserve so the highest-ranked donors get first chance to respond.
  const tier = includeTraveling ? notYetNotified : notYetNotified.slice(0, NOTIFY_TIER_SIZE);

  const contactName = request.contactName || request.guestName;
  const contactPhone = request.contactPhone || request.guestPhone;

  const subjectBase = `Urgent blood request: ${request.bloodGroup} needed`;

  const results = await Promise.all(
    tier.map(async (donor) => {
      const distanceKm = request.location ? haversineKm(request.location, donor.location) : null;
      const message = [
        'BloodNet emergency alert',
        '',
        `Patient / case: ${request.patient}`,
        `Blood group needed: ${request.bloodGroup}`,
        `Units needed: ${request.unitsRequired}`,
        `Priority: ${request.priority}`,
        ...(distanceKm !== null ? [`Approximate distance: ${distanceKm.toFixed(1)} km`] : []),
        ...(contactName && contactPhone ? ['', `Requested by: ${contactName} (${contactPhone})`] : []),
        '',
        'Please respond to the hospital if you are available to donate.',
      ].join('\n');

      const user = donor.userId;
      const [emailResult, smsResult] = await Promise.allSettled([
        sendMail({ to: user.email, subject: subjectBase, text: message }),
        sendSms(user.phone, message),
      ]);
      // In-app notification (bell + live socket push) — independent of
      // whether email/SMS delivery actually succeeded, since this is the
      // channel that works even without Resend/Twilio configured.
      notifyUser(
        user._id,
        `${request.bloodGroup} blood needed nearby`,
        `${request.patient} — ${request.unitsRequired} unit${request.unitsRequired === 1 ? '' : 's'} — ${request.priority} priority.${
          distanceKm !== null ? ` ~${distanceKm.toFixed(1)} km away.` : ''
        }`
      );
      return { email: emailResult.status === 'fulfilled', sms: smsResult.status === 'fulfilled' };
    })
  );

  const emailSent = results.filter((result) => result.email).length;
  const smsSent = results.filter((result) => result.sms).length;

  request.notifiedDonorIds = [...alreadyNotifiedIds, ...tier.map((donor) => donor._id)];
  const remaining = notYetNotified.length - tier.length;

  return {
    matches: request.notifiedDonorIds.length,
    newlyNotified: tier.length,
    emailSent,
    smsSent,
    message: `Alert sent to ${tier.length} donor${tier.length === 1 ? '' : 's'} (${emailSent} email, ${smsSent} SMS)${
      remaining > 0 ? ` — ${remaining} more in reserve if needed` : ''
    }.`,
  };
}

// In-app-only (no email/SMS, unlike the donor alert above) — blood banks are
// institutional accounts expected to check their dashboard, not individuals
// who need to be reached wherever they are. Called for both hospital-raised
// and blood-bank-raised requests; `excludeUserId` skips the raising bank
// itself when it's the latter (a bank shouldn't get notified about, or be
// able to accept, its own request).
async function notifyBloodBanksForRequest(request, excludeUserId = null) {
  const banks = await BloodBankProfile.find({ approvalStatus: 'approved' }).populate('userId');
  const title = `${request.bloodGroup} blood request`;
  const message = `${request.patient} — ${request.unitsRequired} unit${request.unitsRequired === 1 ? '' : 's'} — ${request.priority} priority. Check your dashboard to accept.`;
  let notified = 0;
  for (const bank of banks) {
    if (!bank.userId) continue;
    if (excludeUserId && bank.userId._id.toString() === excludeUserId.toString()) continue;
    notifyUser(bank.userId._id, title, message);
    notified += 1;
  }
  return { notified };
}

module.exports = { notifyDonorsForRequest, notifyBloodBanksForRequest };
