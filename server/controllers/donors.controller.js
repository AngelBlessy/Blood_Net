const DonorProfile = require('../models/donor-profile.model');
const BloodRequest = require('../models/blood-request.model');
const DonorResponse = require('../models/donor-response.model');
const Donation = require('../models/donation.model');
const HospitalProfile = require('../models/hospital-profile.model');
const User = require('../models/user.model');
const { computeEligibility, donationSummary } = require('../services/donor-stats.service');
const { isDonorCompatible } = require('../services/blood-compatibility.service');
const { issueOtp, resendEligibility, verifyOtp } = require('../services/otp.service');
const { buildUserView } = require('../services/user-view.service');
const { streamDonationCertificate } = require('../services/certificate.service');
const { BLOOD_GROUPS } = require('../constants');
const { parseLocationFromBody, extractLatLng, haversineKm } = require('../services/geo.service');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;
const EDIT_PROFILE_OTP_PURPOSE = 'edit-profile';

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
    city: profile.city,
    coordinates: extractLatLng(profile.location),
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

async function requestProfileEditOtp(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  const eligibility = await resendEligibility(user.phone, EDIT_PROFILE_OTP_PURPOSE);
  if (!eligibility.eligible) {
    return res.status(429).json({ error: 'Please wait before requesting another code.' });
  }

  const deliveries = await issueOtp({
    target: user.phone,
    purpose: EDIT_PROFILE_OTP_PURPOSE,
    email: user.email,
    phone: user.phone,
  });
  const failed = [];
  if (deliveries.email === false) failed.push('email');
  if (deliveries.sms === false) failed.push('SMS');
  if (failed.length) {
    return res.json({
      ok: true,
      message: `We couldn't send the verification code by ${failed.join(' and ')} right now. Use Resend to try again.`,
    });
  }
  return res.status(201).json({
    ok: true,
    message: 'Same verification code has been sent to your registered email and phone.',
  });
}

async function updateMyProfile(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  const otp = String(req.body?.otp || '');
  const result = await verifyOtp({ target: user.phone, purpose: EDIT_PROFILE_OTP_PURPOSE, otp });
  if (!result.ok) return res.status(400).json({ error: result.message });

  const name = String(req.body?.name || '').trim();
  const age = Number(req.body?.age);
  const bloodGroup = String(req.body?.bloodGroup || '');
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim();

  if (name.length < 3) return res.status(400).json({ error: 'Name must be at least 3 characters.' });
  if (!Number.isInteger(age) || age < 1 || age > 120) return res.status(400).json({ error: 'Enter a valid age.' });
  if (!BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ error: 'Select a blood group.' });
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!PHONE_PATTERN.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });

  if (email !== user.email) {
    const existingEmail = await User.findOne({ email, _id: { $ne: user._id } });
    if (existingEmail) return res.status(409).json({ error: 'This email is already in use.' });
  }
  if (phone !== user.phone) {
    const existingPhone = await User.findOne({ phone, _id: { $ne: user._id } });
    if (existingPhone) return res.status(409).json({ error: 'This phone number is already in use.' });
  }

  user.email = email;
  user.phone = phone;
  await user.save();

  const { city, location } = parseLocationFromBody(req.body);
  const profileUpdates = { name, age, bloodGroup, ...(city ? { city } : {}), ...(location ? { location } : {}) };
  const profile = await DonorProfile.findOneAndUpdate({ userId: user._id }, profileUpdates, { new: true });
  if (!profile) return res.status(404).json({ error: 'Donor profile not found.' });

  res.json({ ok: true, user: await buildUserView(user) });
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

  const requests = await BloodRequest.find({}).sort({ createdAt: -1 }).limit(100);
  const compatible = requests.filter((request) => isDonorCompatible(request.bloodGroup, profile.bloodGroup));
  const requestIds = compatible.map((request) => request._id);
  const myResponses = await DonorResponse.find({ donorId: profile._id, requestId: { $in: requestIds } });
  const responseMap = new Map(myResponses.map((response) => [response.requestId.toString(), response.response]));

  // Still-open requests always show; completed ones only show if this donor
  // actually responded to them (otherwise the list would fill up with
  // long-resolved requests the donor was never involved in).
  const relevant = compatible.filter(
    (request) => request.status !== 'Completed' || responseMap.has(request._id.toString())
  );

  res.json({
    requests: relevant.map((request) => ({
      id: request._id.toString(),
      patient: request.patient,
      bloodGroup: request.bloodGroup,
      units: request.unitsRequired,
      priority: request.priority,
      status: request.status,
      createdAt: request.createdAt,
      myResponse: responseMap.get(request._id.toString()) || null,
      distanceKm: request.location ? haversineKm(request.location, profile.location) : null,
    })),
  });
}

async function downloadCertificate(req, res) {
  const profile = await DonorProfile.findOne({ userId: req.user.id });
  if (!profile) return res.status(404).json({ error: 'Donor profile not found.' });

  const donation = await Donation.findOne({ _id: req.params.id, donorId: profile._id });
  if (!donation) return res.status(404).json({ error: 'Donation not found.' });

  let hospitalName = null;
  if (donation.hospitalId) {
    const hospital = await HospitalProfile.findById(donation.hospitalId);
    hospitalName = hospital ? hospital.hospitalName : null;
  }

  streamDonationCertificate(res, {
    donorName: profile.name,
    bloodGroup: profile.bloodGroup,
    donationDate: donation.donationDate,
    unitsDonated: donation.unitsDonated,
    hospitalName,
    certificateId: donation._id.toString(),
  });
}

module.exports = {
  count,
  updateMe,
  requestProfileEditOtp,
  updateMyProfile,
  mySummary,
  myAlerts,
  downloadCertificate,
};
