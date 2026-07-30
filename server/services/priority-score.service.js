const DonorResponse = require('../models/donor-response.model');
const BloodRequest = require('../models/blood-request.model');
const Donation = require('../models/donation.model');
const { haversineKm } = require('./geo.service');

const ELIGIBILITY_WINDOW_DAYS = 90;
const RESPONSE_SPEED_BENCHMARK_HOURS = 24;
const GOLD_BADGE_DONATION_COUNT = 10;
const NEUTRAL = 0.5;

// Feature 7 (AI availability prediction) + Feature 8 (priority score), computed
// directly from real signals already in the database — response history, response
// speed, distance, donation recency, donation count. This is a hand-tuned weighted
// formula, not a trained classifier: with no historical donor-response volume yet to
// train an XGBoost/ML model on, fabricating synthetic training data would be less
// honest than a transparent formula over real signals. Weights below mirror the
// factors and percentages given in the original spec doc exactly, so results stay
// traceable to the spec if anyone asks how the "AI" arrives at a number.
//
// `donor-matching.service.js`'s `findRankedDonors` (used for emergency-alert
// matching) is intentionally untouched by this — that scoring stays as its own
// simple 2-factor formula. This service is a separate ranking used only for the
// donor-search results shown to hospitals.

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// donors: array of populated DonorProfile docs (already filtered for
// compatibility/availability by the caller). originPoint/radiusKm optional —
// when absent, distance falls back to a neutral mid-score rather than being
// excluded from ranking (e.g. a city-only search has no radius to score against).
async function computeDonorScores(donors, { originPoint, radiusKm } = {}) {
  if (!donors.length) return [];

  const donorIds = donors.map((donor) => donor._id);

  const responses = await DonorResponse.find({ donorId: { $in: donorIds } });
  const requestIds = [...new Set(responses.map((response) => response.requestId.toString()))];
  const requests = await BloodRequest.find({ _id: { $in: requestIds } }, { createdAt: 1 });
  const requestCreatedAt = new Map(requests.map((request) => [request._id.toString(), request.createdAt.getTime()]));

  const responseStats = new Map();
  for (const response of responses) {
    const key = response.donorId.toString();
    const stat = responseStats.get(key) || { accepted: 0, total: 0, latencyHoursSum: 0, latencyCount: 0 };
    stat.total += 1;
    if (response.response === 'Accepted') stat.accepted += 1;
    const requestCreatedMs = requestCreatedAt.get(response.requestId.toString());
    if (requestCreatedMs) {
      const latencyHours = (response.respondedAt.getTime() - requestCreatedMs) / (60 * 60 * 1000);
      if (latencyHours >= 0) {
        stat.latencyHoursSum += latencyHours;
        stat.latencyCount += 1;
      }
    }
    responseStats.set(key, stat);
  }

  const donationCounts = await Donation.aggregate([
    { $match: { donorId: { $in: donorIds } } },
    { $group: { _id: '$donorId', count: { $sum: 1 } } },
  ]);
  const donationCountMap = new Map(donationCounts.map((entry) => [entry._id.toString(), entry.count]));

  const now = Date.now();
  const scored = donors.map((donor) => {
    const key = donor._id.toString();
    const stat = responseStats.get(key);

    const responseRate = stat && stat.total > 0 ? stat.accepted / stat.total : NEUTRAL;
    const responseSpeed =
      stat && stat.latencyCount > 0
        ? clamp01(1 - stat.latencyHoursSum / stat.latencyCount / RESPONSE_SPEED_BENCHMARK_HOURS)
        : NEUTRAL;

    let distanceFactor = NEUTRAL;
    if (originPoint && radiusKm && donor.location) {
      const distanceKm = haversineKm(originPoint, donor.location);
      if (distanceKm !== null) distanceFactor = clamp01(1 - distanceKm / radiusKm);
    }

    const daysSinceLastDonation = donor.lastDonationDate
      ? (now - donor.lastDonationDate.getTime()) / (24 * 60 * 60 * 1000)
      : Infinity;
    const recency = Math.min(daysSinceLastDonation / ELIGIBILITY_WINDOW_DAYS, 1);

    const totalDonations = donationCountMap.get(key) || 0;
    const donationCountFactor = Math.min(totalDonations / GOLD_BADGE_DONATION_COUNT, 1);

    // Feature 7 — the 4 factors the spec lists for the ML model, weighted.
    const aiProbability = clamp01(
      0.35 * responseRate + 0.25 * responseSpeed + 0.2 * distanceFactor + 0.2 * recency
    );
    const aiConfidence = aiProbability >= 0.75 ? 'High' : aiProbability >= 0.4 ? 'Medium' : 'Low';

    // Feature 8 — the exact 5 weights from the spec (35/25/20/12/8), out of 100.
    const priorityScore = Math.round(
      35 * aiProbability + 25 * distanceFactor + 20 * recency + 12 * responseRate + 8 * donationCountFactor
    );

    return { donor, priorityScore, aiConfidence, aiProbability };
  });

  scored.sort((a, b) => b.priorityScore - a.priorityScore);
  return scored;
}

module.exports = { computeDonorScores };
