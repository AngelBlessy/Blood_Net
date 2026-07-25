const BloodRequest = require('../models/blood-request.model');
const DonorResponse = require('../models/donor-response.model');
const Donation = require('../models/donation.model');
const HospitalProfile = require('../models/hospital-profile.model');
const DonorProfile = require('../models/donor-profile.model');
const { notifyDonorsForRequest } = require('../services/request-alert.service');
const { BLOOD_GROUPS, REQUEST_PRIORITIES } = require('../constants');

async function attachResponses(requests) {
  const requestIds = requests.map((request) => request._id);
  const responses = await DonorResponse.find({ requestId: { $in: requestIds } }).populate('donorId');
  const map = new Map();
  for (const response of responses) {
    if (!response.donorId) continue;
    const key = response.requestId.toString();
    const list = map.get(key) || [];
    list.push({
      donorId: response.donorId._id.toString(),
      donorName: response.donorId.name,
      response: response.response,
    });
    map.set(key, list);
  }
  return map;
}

function serializeRequest(request, responses = []) {
  return {
    id: request._id.toString(),
    patient: request.patient,
    bloodGroup: request.bloodGroup,
    units: request.unitsRequired,
    priority: request.priority,
    matches: request.matches,
    status: request.status,
    createdAt: request.createdAt,
    hospitalId: request.hospitalId ? request.hospitalId.toString() : null,
    raisedBy: request.raisedBy,
    guestName: request.guestName,
    guestPhone: request.guestPhone,
    responses,
  };
}

async function list(req, res) {
  const filter = {};
  if (req.query.mine === 'true') {
    if (!req.user || req.user.role !== 'hospital') return res.status(403).json({ error: 'Not authorized' });
    const hospital = await HospitalProfile.findOne({ userId: req.user.id });
    if (!hospital) return res.status(404).json({ error: 'Hospital profile not found.' });
    filter.hospitalId = hospital._id;
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const requests = await BloodRequest.find(filter).sort({ createdAt: -1 }).limit(limit);
  const responseMap = await attachResponses(requests);

  res.json({ requests: requests.map((request) => serializeRequest(request, responseMap.get(request._id.toString()) || [])) });
}

async function create(req, res) {
  const hospital = await HospitalProfile.findOne({ userId: req.user.id });
  if (!hospital) return res.status(404).json({ error: 'Hospital profile not found.' });
  if (hospital.approvalStatus !== 'approved') {
    return res.status(403).json({ error: 'Your hospital account is awaiting admin approval.' });
  }

  const patient = String(req.body?.patient || '').trim();
  const bloodGroup = String(req.body?.bloodGroup || '');
  const units = Number(req.body?.units);
  const priority = String(req.body?.priority || 'Critical');

  if (!patient) return res.status(400).json({ error: 'Enter a patient / case reference.' });
  if (!BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ error: 'Select a blood group.' });
  if (!Number.isInteger(units) || units < 1) return res.status(400).json({ error: 'Enter a valid number of units.' });
  if (!REQUEST_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Select a priority.' });

  const request = await BloodRequest.create({
    hospitalId: hospital._id,
    raisedBy: 'hospital',
    patient,
    bloodGroup,
    unitsRequired: units,
    priority,
    status: 'Sending emergency alerts',
  });

  const alertResult = await notifyDonorsForRequest(request);
  request.matches = alertResult.matches;
  request.status = alertResult.matches > 0 ? alertResult.message : 'No compatible donors available';
  await request.save();

  res.status(201).json({
    ok: alertResult.matches > 0,
    message: alertResult.message,
    request: serializeRequest(request, []),
  });
}

// Admins can manage any request (needed for guest-raised requests, which have
// no owning hospital account); hospitals can only manage their own.
async function requireOwnedRequest(req, res) {
  const request = await BloodRequest.findById(req.params.id);
  if (!request) {
    res.status(404).json({ error: 'Request not found.' });
    return null;
  }
  if (req.user.role === 'admin') return request;

  const hospital = await HospitalProfile.findOne({ userId: req.user.id });
  if (!hospital || !request.hospitalId || request.hospitalId.toString() !== hospital._id.toString()) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  return request;
}

async function update(req, res) {
  const request = await requireOwnedRequest(req, res);
  if (!request) return;

  if (typeof req.body?.patient === 'string' && req.body.patient.trim()) {
    request.patient = req.body.patient.trim();
  }
  if (Number.isInteger(req.body?.units) && req.body.units > 0) {
    request.unitsRequired = req.body.units;
  }

  const complete = req.body?.status === 'Completed';
  if (complete) request.status = 'Completed';
  await request.save();

  if (complete) {
    const accepted = await DonorResponse.find({ requestId: request._id, response: 'Accepted' });
    for (const response of accepted) {
      const existingDonation = await Donation.findOne({ donorId: response.donorId, requestId: request._id });
      if (existingDonation) continue;
      await Donation.create({
        donorId: response.donorId,
        hospitalId: request.hospitalId,
        requestId: request._id,
        unitsDonated: 1,
      });
      await DonorProfile.findByIdAndUpdate(response.donorId, { lastDonationDate: new Date(), donatedEver: 'yes' });
    }
  }

  const responseMap = await attachResponses([request]);
  res.json({ ok: true, request: serializeRequest(request, responseMap.get(request._id.toString()) || []) });
}

async function notify(req, res) {
  const request = await requireOwnedRequest(req, res);
  if (!request) return;

  const alertResult = await notifyDonorsForRequest(request);
  request.matches = alertResult.matches;
  request.status = alertResult.matches > 0 ? alertResult.message : 'No compatible donors available';
  await request.save();

  res.json({ ok: alertResult.matches > 0, message: alertResult.message, request: serializeRequest(request, []) });
}

async function respond(req, res) {
  const donor = await DonorProfile.findOne({ userId: req.user.id });
  if (!donor) return res.status(404).json({ error: 'Donor profile not found.' });

  const responseValue = req.body?.response;
  if (responseValue !== 'Accepted' && responseValue !== 'Declined') {
    return res.status(400).json({ error: 'Response must be Accepted or Declined.' });
  }

  const request = await BloodRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });

  await DonorResponse.findOneAndUpdate(
    { requestId: request._id, donorId: donor._id },
    { response: responseValue, respondedAt: new Date() },
    { upsert: true, new: true }
  );

  res.json({ ok: true });
}

module.exports = { list, create, update, notify, respond };
