const DonorProfile = require('../models/donor-profile.model');
const { isDonorCompatible } = require('../services/blood-compatibility.service');
const { haversineKm, jitterPoint } = require('../services/geo.service');
const { computeDonorScores } = require('../services/priority-score.service');
const { BLOOD_GROUPS } = require('../constants');

const DEFAULT_RADIUS_KM = 25;
const MAX_RADIUS_KM = 300;
const MAX_RESULTS = 100;

function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Donor';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

async function searchDonors(req, res) {
  const bloodGroup = String(req.query.bloodGroup || '');
  if (!BLOOD_GROUPS.includes(bloodGroup)) {
    return res.status(400).json({ error: 'Select a valid blood group.' });
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng);
  const radiusKm = hasOrigin
    ? Math.min(Math.max(Number(req.query.radiusKm) || DEFAULT_RADIUS_KM, 1), MAX_RADIUS_KM)
    : null;
  const city = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase() : '';

  const candidates = await DonorProfile.find({ traveling: false, availabilityStatus: 'available' }).populate(
    'userId'
  );

  const origin = hasOrigin ? { lat, lng } : null;

  let entries = candidates
    .filter((donor) => donor.userId && donor.userId.status === 'active' && isDonorCompatible(bloodGroup, donor.bloodGroup))
    .map((donor) => ({ donor, distanceKm: origin ? haversineKm(origin, donor.location) : null }));

  if (origin) {
    // Donors without a location are excluded from a distance-based search
    // (there's nothing to rank them by), but never excluded from an
    // unfiltered/city-only search — see the else branch below.
    entries = entries.filter((entry) => entry.distanceKm !== null && entry.distanceKm <= radiusKm);
  } else if (city) {
    entries = entries.filter((entry) => (entry.donor.city || '').toLowerCase().includes(city));
  }

  const distanceByDonorId = new Map(entries.map((entry) => [entry.donor._id.toString(), entry.distanceKm]));

  // Ranked by priority score (AI probability + distance + eligibility recency +
  // response rate + donation count — see priority-score.service.js) rather than
  // distance alone, matching the spec's "ranked by a score that factors in
  // distance, availability, and AI prediction" for this feature.
  const scored = (
    await computeDonorScores(
      entries.map((entry) => entry.donor),
      { originPoint: origin, radiusKm }
    )
  ).slice(0, MAX_RESULTS);

  res.json({
    results: scored.map(({ donor, priorityScore, aiConfidence }) => {
      const distanceKm = distanceByDonorId.get(donor._id.toString());
      return {
        name: maskName(donor.name),
        bloodGroup: donor.bloodGroup,
        city: donor.city,
        availabilityStatus: donor.availabilityStatus,
        distanceKm: distanceKm == null ? null : Math.round(distanceKm * 10) / 10,
        // Jittered — never the donor's real coordinates. Full contact info is
        // only ever revealed once a donor accepts a specific request.
        approxLocation: donor.location ? jitterPoint(donor.location) : null,
        priorityScore,
        aiConfidence,
      };
    }),
  });
}

module.exports = { searchDonors };
