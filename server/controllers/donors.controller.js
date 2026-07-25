const DonorProfile = require('../models/donor-profile.model');
const BloodRequest = require('../models/blood-request.model');
const DonorResponse = require('../models/donor-response.model');
const { computeEligibility, donationSummary } = require('../services/donor-stats.service');
const { isDonorCompatible } = require('../services/blood-compatibility.service');

function serializeProfile(profile) {
  return {
    id: profile._id.toString(),
    name: profile.name,
    age: profile.age,
    bloodGroup: profile.bloodGroup,
    donatedEver: profile.donatedEver,
    lastDonationDate: profile.lastDonationDate,
    traveling: profile.traveling,
    availabilityStatus: profile.availabilityStatus,
  };
}

async function count(_req, res) {
  const total = await DonorProfile.countDocuments();
  res.json({ count: total });
}

async function updateMe(req, res) {
  const updates = {};
  if (typeof req.body?.traveling === 'boolean') updates.traveling = req.body.traveling;
  if (req.body?.availabilityStatus === 'available' || req.body?.availabilityStatus === 'unavailable') {
    updates.availabilityStatus = req.body.availabilityStatus;
  }

  const profile = await DonorProfile.findOneAndUpdate({ userId: req.user.id }, updates, { new: true });
  if (!profile) return res.status(404).json({ error: 'Donor profile not found.' });
  res.json({ ok: true, profile: serializeProfile(profile) });
}

async function mySummary(req, res) {
  const profile = await DonorProfile.findOne({ userId: req.user.id });
  if (!profile) return res.status(404).json({ error: 'Donor profile not found.' });

  const eligibility = computeEligibility(profile.lastDonationDate);
  const { donations, badgeLevel, totalDonations } = await donationSummary(profile._id);

  res.json({
    profile: serializeProfile(profile),
    eligibility,
    badgeLevel,
    totalDonations,
    donations: donations.map((donation) => ({
      id: donation._id.toString(),
      donationDate: donation.donationDate,
      unitsDonated: donation.unitsDonated,
    })),
  });
}

async function myAlerts(req, res) {
  const profile = await DonorProfile.findOne({ userId: req.user.id });
  if (!profile) return res.status(404).json({ error: 'Donor profile not found.' });

  const requests = await BloodRequest.find({ status: { $ne: 'Completed' } }).sort({ createdAt: -1 }).limit(50);
  const compatible = requests.filter((request) => isDonorCompatible(request.bloodGroup, profile.bloodGroup));
  const requestIds = compatible.map((request) => request._id);
  const myResponses = await DonorResponse.find({ donorId: profile._id, requestId: { $in: requestIds } });
  const responseMap = new Map(myResponses.map((response) => [response.requestId.toString(), response.response]));

  res.json({
    requests: compatible.map((request) => ({
      id: request._id.toString(),
      patient: request.patient,
      bloodGroup: request.bloodGroup,
      units: request.unitsRequired,
      priority: request.priority,
      status: request.status,
      createdAt: request.createdAt,
      myResponse: responseMap.get(request._id.toString()) || null,
    })),
  });
}

module.exports = { count, updateMe, mySummary, myAlerts };
