const DonorProfile = require('../models/donor-profile.model');
const { isDonorCompatible } = require('./blood-compatibility.service');
const { haversineKm } = require('./geo.service');
const { computeDonorScores } = require('./priority-score.service');
const { sameCity } = require('./city-alias.service');

function sameText(a, b) {
  return Boolean(a) && Boolean(b) && a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Filters + ranks donors for the emergency-alert flow. Ranking is delegated to
// `computeDonorScores` (priority-score.service.js) -- the same real Priority
// Score pipeline (trained-model AI probability + distance + recency +
// response rate + donation count) the /search page uses -- so "most likely to
// respond" means the same thing whether a hospital is searching or an alert
// is going out. This function's own job is purely the filtering that's
// specific to *how a request should reach donors*: compatibility,
// availability, exclusions, and city/state-or-radius scoping.
//
// Filter options (all optional, and all filters only):
//   - `excludeUserId` — skip one specific donor (e.g. a donor alerting
//     themselves about their own raised request).
//   - `includeTraveling` — when true, skips the normal `traveling: false`
//     exclusion (the hospital "notify all" override).
//   - `includeUnavailable` — when true, skips the normal
//     `availabilityStatus: 'available'` exclusion (also part of "notify all").
//   - `ignoreBloodGroup` — when true, skips blood-group compatibility
//     entirely (also part of "notify all" — that button is a last-resort
//     broadcast to literally every donor, not a matching search).
//   - `city`/`state` — exact (case-insensitive) text match, used for
//     Urgent/Routine priority instead of radius. City also folds in known
//     alternate names (see city-alias.service.js), so a hospital in
//     "Bangalore" still reaches a donor registered under "Bengaluru". Donors
//     missing either field always pass (never excludes profiles from before
//     this existed).
//   - `originPoint`/`radiusKm` — distance filter, only applied when
//     city/state weren't given (radius is the fallback path, e.g. /search).
async function findRankedDonors(
  bloodGroupNeeded,
  { originPoint, radiusKm, excludeUserId, includeTraveling = false, includeUnavailable = false, city, state, ignoreBloodGroup = false } = {}
) {
  const query = {};
  if (!includeUnavailable) query.availabilityStatus = 'available';
  if (!includeTraveling) query.traveling = false;

  const candidates = await DonorProfile.find(query).populate('userId');
  let compatible = candidates.filter(
    (donor) =>
      donor.userId &&
      donor.userId.status === 'active' &&
      (ignoreBloodGroup || isDonorCompatible(bloodGroupNeeded, donor.bloodGroup)) &&
      (!excludeUserId || donor.userId._id.toString() !== excludeUserId.toString())
  );

  if (city && state) {
    compatible = compatible.filter((donor) => {
      if (!donor.city || !donor.state) return true;
      return sameCity(donor.city, city) && sameText(donor.state, state);
    });
  } else if (originPoint && radiusKm) {
    compatible = compatible.filter((donor) => {
      if (!donor.location) return true;
      const distance = haversineKm(originPoint, donor.location);
      return distance === null || distance <= radiusKm;
    });
  }

  if (!compatible.length) return [];

  const scored = await computeDonorScores(compatible, { originPoint, radiusKm });
  return scored.map((entry) => entry.donor);
}

module.exports = { findRankedDonors };
