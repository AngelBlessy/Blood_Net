const DonorProfile = require('../models/donor-profile.model');
const DonorResponse = require('../models/donor-response.model');
const { isDonorCompatible } = require('./blood-compatibility.service');
const { haversineKm } = require('./geo.service');

const ELIGIBILITY_WINDOW_DAYS = 90;

function sameText(a, b) {
  return Boolean(a) && Boolean(b) && a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Simple rule-based ranking (no ML): donors who haven't donated in a while
// score higher on eligibility, donors who reliably accept past alerts score
// higher on responsiveness. Ties are broken by whichever compares first.
//
// Filter options (all optional, and all filters only — never a scoring
// weight; the scoring formula itself intentionally stays untouched here,
// that's Feature 8's territory, paused for now):
//   - `excludeUserId` — skip one specific donor (e.g. a donor alerting
//     themselves about their own raised request).
//   - `includeTraveling` — when true, skips the normal `traveling: false`
//     exclusion (the hospital "notify all" override).
//   - `city`/`state` — exact (case-insensitive) text match, used for
//     Urgent/Routine priority instead of radius. Donors missing either field
//     always pass (never excludes profiles from before this existed).
//   - `originPoint`/`radiusKm` — distance filter, only applied when
//     city/state weren't given (radius is the fallback path, e.g. /search).
async function findRankedDonors(
  bloodGroupNeeded,
  { originPoint, radiusKm, excludeUserId, includeTraveling = false, city, state } = {}
) {
  const query = { availabilityStatus: 'available' };
  if (!includeTraveling) query.traveling = false;

  const candidates = await DonorProfile.find(query).populate('userId');
  let compatible = candidates.filter(
    (donor) =>
      donor.userId &&
      donor.userId.status === 'active' &&
      isDonorCompatible(bloodGroupNeeded, donor.bloodGroup) &&
      (!excludeUserId || donor.userId._id.toString() !== excludeUserId.toString())
  );

  if (city && state) {
    compatible = compatible.filter((donor) => {
      if (!donor.city || !donor.state) return true;
      return sameText(donor.city, city) && sameText(donor.state, state);
    });
  } else if (originPoint && radiusKm) {
    compatible = compatible.filter((donor) => {
      if (!donor.location) return true;
      const distance = haversineKm(originPoint, donor.location);
      return distance === null || distance <= radiusKm;
    });
  }

  if (!compatible.length) return [];

  const donorIds = compatible.map((donor) => donor._id);
  const responses = await DonorResponse.find({ donorId: { $in: donorIds } });
  const stats = new Map();
  for (const response of responses) {
    const key = response.donorId.toString();
    const stat = stats.get(key) || { accepted: 0, total: 0 };
    stat.total += 1;
    if (response.response === 'Accepted') stat.accepted += 1;
    stats.set(key, stat);
  }

  const now = Date.now();
  const scored = compatible.map((donor) => {
    const daysSince = donor.lastDonationDate
      ? (now - donor.lastDonationDate.getTime()) / (24 * 60 * 60 * 1000)
      : Infinity;
    const eligibilityScore = Math.min(daysSince / ELIGIBILITY_WINDOW_DAYS, 1) * 60;
    const stat = stats.get(donor._id.toString());
    const responseScore = stat && stat.total > 0 ? (stat.accepted / stat.total) * 40 : 20;
    return { donor, score: eligibilityScore + responseScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.donor);
}

module.exports = { findRankedDonors };
