const DonorProfile = require('../models/donor-profile.model');
const DonorResponse = require('../models/donor-response.model');
const { isDonorCompatible } = require('./blood-compatibility.service');
const { haversineKm } = require('./geo.service');

const ELIGIBILITY_WINDOW_DAYS = 90;

// Simple rule-based ranking (no ML): donors who haven't donated in a while
// score higher on eligibility, donors who reliably accept past alerts score
// higher on responsiveness. Ties are broken by whichever compares first.
//
// `originPoint`/`radiusKm` (both optional) apply a distance *filter* only —
// who's even in range to be considered — never a scoring weight. The scoring
// formula itself intentionally stays untouched here (that's Feature 8's
// territory, paused for now). Donors without location data always pass the
// filter, so this never excludes profiles created before location existed.
async function findRankedDonors(bloodGroupNeeded, { originPoint, radiusKm } = {}) {
  const candidates = await DonorProfile.find({ traveling: false, availabilityStatus: 'available' }).populate(
    'userId'
  );
  let compatible = candidates.filter(
    (donor) => donor.userId && donor.userId.status === 'active' && isDonorCompatible(bloodGroupNeeded, donor.bloodGroup)
  );

  if (originPoint && radiusKm) {
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
