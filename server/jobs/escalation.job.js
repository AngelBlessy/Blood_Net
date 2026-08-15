const cron = require('node-cron');
const BloodRequest = require('../models/blood-request.model');
const { notifyDonorsForRequest } = require('../services/request-alert.service');
const { emitToRequest } = require('../realtime/socket');
const { RADIUS_STEPS_KM, TIER_NOTIFY_INTERVAL_MS } = require('../constants');

const RECHECK_INTERVAL_MS = 10 * 60 * 1000;

// Requests with no location have no radius concept and are simply never
// matched by this query — not an error, just nothing to widen. Tier
// progression (runTierNotifyCheck, below) is what keeps those moving instead.
async function runEscalationCheck() {
  const stale = await BloodRequest.find({
    status: { $ne: 'Completed' },
    escalationDone: false,
    location: { $exists: true },
    nextEscalationAt: { $lte: new Date() },
  });

  let widened = 0;
  for (const request of stale) {
    const currentIndex = RADIUS_STEPS_KM.indexOf(request.searchRadiusKm);
    const nextIndex = currentIndex === -1 ? 0 : currentIndex + 1;

    if (nextIndex >= RADIUS_STEPS_KM.length) {
      request.escalationDone = true;
      await request.save();
      continue;
    }

    request.searchRadiusKm = RADIUS_STEPS_KM[nextIndex];
    request.radiusExpansions += 1;
    request.nextEscalationAt = new Date(Date.now() + RECHECK_INTERVAL_MS);
    if (nextIndex === RADIUS_STEPS_KM.length - 1) request.escalationDone = true;

    const alertResult = await notifyDonorsForRequest(request);
    request.matches = alertResult.matches;
    request.status =
      alertResult.newlyNotified > 0
        ? alertResult.message
        : `No compatible donors within ${request.searchRadiusKm}km — search widened`;
    // The wider radius may have brought in donors beyond whatever tier
    // progression had already exhausted at the old radius -- let the tier
    // job re-check this request instead of leaving it marked done.
    if (alertResult.newlyNotified > 0) {
      request.tierNotifyDone = false;
      request.nextTierNotifyAt = new Date(Date.now() + TIER_NOTIFY_INTERVAL_MS);
    }
    await request.save();

    emitToRequest(request, 'request:update', {
      id: request._id.toString(),
      matches: request.matches,
      status: request.status,
      searchRadiusKm: request.searchRadiusKm,
      radiusExpansions: request.radiusExpansions,
    });

    widened += 1;
  }

  if (widened) console.log(`Escalation job widened radius for ${widened} request(s).`);
  return widened;
}

// Progresses through the *already-matched* ranked donor pool one priority
// tier at a time (see NOTIFY_TIER_SIZE / notifyDonorsForRequest) -- so the
// top-ranked donors get first chance to respond before the next batch is
// reached. Independent of the km-radius escalation above: this is what keeps
// Critical requests (which never have a radius filter at all) and any
// request with more matched donors than fit in one tier moving forward.
async function runTierNotifyCheck() {
  const stale = await BloodRequest.find({
    status: { $ne: 'Completed' },
    tierNotifyDone: false,
    nextTierNotifyAt: { $lte: new Date() },
  });

  let notified = 0;
  for (const request of stale) {
    const alertResult = await notifyDonorsForRequest(request);
    request.matches = alertResult.matches;

    if (alertResult.newlyNotified > 0) {
      request.status = alertResult.message;
      request.nextTierNotifyAt = new Date(Date.now() + TIER_NOTIFY_INTERVAL_MS);
      notified += 1;
    } else {
      // Nobody new left in the currently-matched pool -- stop polling this
      // request via the tier mechanism. Radius escalation (if this request
      // has a location) is the only remaining way to reach more donors, and
      // that resets tierNotifyDone itself if it finds anyone new.
      request.tierNotifyDone = true;
    }
    await request.save();

    emitToRequest(request, 'request:update', {
      id: request._id.toString(),
      matches: request.matches,
      status: request.status,
    });
  }

  if (notified) console.log(`Tier-notify job reached the next priority tier for ${notified} request(s).`);
  return notified;
}

function startEscalationJob() {
  cron.schedule('*/2 * * * *', () => {
    runEscalationCheck().catch((error) => console.error('Escalation job failed:', error));
    runTierNotifyCheck().catch((error) => console.error('Tier-notify job failed:', error));
  });
}

module.exports = { startEscalationJob, runEscalationCheck, runTierNotifyCheck };
