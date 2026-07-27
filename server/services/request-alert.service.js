const { findRankedDonors } = require('./donor-matching.service');
const { sendMail } = require('./mailer.service');
const { sendSms } = require('./sms.service');
const { haversineKm } = require('./geo.service');
const { notifyUser } = require('./notification.service');

async function notifyDonorsForRequest(request) {
  const donors = await findRankedDonors(request.bloodGroup, {
    originPoint: request.location || null,
    radiusKm: request.searchRadiusKm || null,
  });

  if (!donors.length) {
    return {
      matches: 0,
      emailSent: 0,
      smsSent: 0,
      message: 'No compatible registered donors are currently available.',
    };
  }

  const contactName = request.contactName || request.guestName;
  const contactPhone = request.contactPhone || request.guestPhone;

  const subjectBase = `Urgent blood request: ${request.bloodGroup} needed`;

  const results = await Promise.all(
    donors.map(async (donor) => {
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
      // channel that works even without SMTP/Twilio configured.
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

  return {
    matches: donors.length,
    emailSent,
    smsSent,
    message: `Alert sent to ${donors.length} donor${donors.length === 1 ? '' : 's'} (${emailSent} email, ${smsSent} SMS).`,
  };
}

module.exports = { notifyDonorsForRequest };
