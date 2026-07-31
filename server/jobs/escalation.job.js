const cron = require('node-cron');
const BloodRequest = require('../models/blood-request.model');
const { notifyDonorsForRequest } = require('../services/request-alert.service');
const { emitToRequest } = require('../realtime/socket');
const { RADIUS_STEPS_KM } = require('../constants');

const RECHECK_INTERVAL_MS = 10 * 60 * 1000;

// Requests with no location have no radius concept and are simply never
// matched by this query — not an error, just nothing to widen.
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
      alertResult.matches > 0
        ? alertResult.message
        : `No compatible donors within ${request.searchRadiusKm}km — search widened`;
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

function startEscalationJob() {
  cron.schedule('*/2 * * * *', () => {
    runEscalationCheck().catch((error) => console.error('Escalation job failed:', error));
  });
}

module.exports = { startEscalationJob, runEscalationCheck };
