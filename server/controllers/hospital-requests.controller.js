const BloodRequest = require('../models/blood-request.model');
const DonorResponse = require('../models/donor-response.model');
const BloodBankResponse = require('../models/blood-bank-response.model');
const BloodInventory = require('../models/blood-inventory.model');
const BloodBankProfile = require('../models/blood-bank-profile.model');
const Donation = require('../models/donation.model');
const HospitalProfile = require('../models/hospital-profile.model');
const DonorProfile = require('../models/donor-profile.model');
const { notifyDonorsForRequest, notifyBloodBanksForRequest } = require('../services/request-alert.service');
const { computeEligibility } = require('../services/donor-stats.service');
const { BLOOD_GROUPS, REQUEST_PRIORITIES, RADIUS_STEPS_KM } = require('../constants');
const { parseLocationFromBody } = require('../services/geo.service');
const { emitToRequest, emitToAdmins } = require('../realtime/socket');
const { notifyUser } = require('../services/notification.service');

const PHONE_PATTERN = /^\d{10}$/;

async function attachResponses(requests) {
  const requestIds = requests.map((request) => request._id);
  const responses = await DonorResponse.find({ requestId: { $in: requestIds } }).populate({
    path: 'donorId',
    populate: { path: 'userId' },
  });
  const map = new Map();
  for (const response of responses) {
    if (!response.donorId) continue;
    const key = response.requestId.toString();
    const list = map.get(key) || [];
    list.push({
      donorId: response.donorId._id.toString(),
      donorName: response.donorId.name,
      donorPhone: response.donorId.userId ? response.donorId.userId.phone : null,
      response: response.response,
      respondedAt: response.respondedAt,
    });
    map.set(key, list);
  }
  return map;
}

async function attachBankResponses(requests) {
  const requestIds = requests.map((request) => request._id);
  const responses = await BloodBankResponse.find({ requestId: { $in: requestIds } }).populate('bankId');
  const map = new Map();
  for (const response of responses) {
    if (!response.bankId) continue;
    const key = response.requestId.toString();
    const list = map.get(key) || [];
    list.push({
      bankId: response.bankId._id.toString(),
      bankName: response.bankId.bankName,
      bankPhone: response.bankId.contactNumber || null,
      response: response.response,
      unitsCommitted: response.unitsCommitted,
      respondedAt: response.respondedAt,
    });
    map.set(key, list);
  }
  return map;
}

function serializeRequest(request, responses = [], bankResponses = []) {
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
    raisedByUserId: request.raisedByUserId ? request.raisedByUserId.toString() : null,
    guestName: request.guestName,
    guestPhone: request.guestPhone,
    contactName: request.contactName,
    contactPhone: request.contactPhone,
    searchRadiusKm: request.location ? request.searchRadiusKm : null,
    radiusExpansions: request.radiusExpansions,
    responses,
    bankResponses,
  };
}

async function list(req, res) {
  const filter = {};
  let myBankId = null;

  if (req.query.forBloodBank === 'true') {
    if (!req.user || req.user.role !== 'bloodbank') return res.status(403).json({ error: 'Not authorized' });
    const bank = await BloodBankProfile.findOne({ userId: req.user.id });
    if (!bank || bank.approvalStatus !== 'approved') return res.status(403).json({ error: 'Not authorized' });
    myBankId = bank._id.toString();
    // Requests raised by a hospital OR by another blood bank, still open —
    // matches the scope of the incoming-requests feed shown on the blood
    // bank dashboard. A bank's own raised requests are excluded (that's
    // what myRequests/"mine=true" is for) — no accepting your own request.
    filter.raisedBy = { $in: ['hospital', 'bloodbank'] };
    filter.raisedByUserId = { $ne: req.user.id };
    filter.status = { $ne: 'Completed' };
  } else if (req.query.mine === 'true') {
    if (!req.user) return res.status(403).json({ error: 'Not authorized' });
    if (req.user.role === 'hospital') {
      const hospital = await HospitalProfile.findOne({ userId: req.user.id });
      if (!hospital) return res.status(404).json({ error: 'Hospital profile not found.' });
      filter.hospitalId = hospital._id;
    } else if (req.user.role === 'donor' || req.user.role === 'bloodbank') {
      filter.raisedByUserId = req.user.id;
    } else {
      return res.status(403).json({ error: 'Not authorized' });
    }
  }

  // Optional filters — compose with whichever scope branch ran above (admin
  // activity feed, a hospital's own list, etc. can all be narrowed the same way).
  if (BLOOD_GROUPS.includes(req.query.bloodGroup)) {
    filter.bloodGroup = req.query.bloodGroup;
  }
  if (REQUEST_PRIORITIES.includes(req.query.priority)) {
    filter.priority = req.query.priority;
  }
  if (req.query.status === 'completed') {
    filter.status = 'Completed';
  } else if (req.query.status === 'pending') {
    // 'pending' has no single stored value — status is a free-text progress
    // message until a request is explicitly marked Completed (see the model
    // comment on `status`), so "not Completed" is what "pending" means here.
    filter.status = { $ne: 'Completed' };
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const requests = await BloodRequest.find(filter).sort({ createdAt: -1 }).limit(limit);
  const responseMap = await attachResponses(requests);
  const bankResponseMap = await attachBankResponses(requests);

  res.json({
    requests: requests.map((request) => {
      const bankResponses = bankResponseMap.get(request._id.toString()) || [];
      const serialized = serializeRequest(request, responseMap.get(request._id.toString()) || [], bankResponses);
      // Only meaningful (and only sent) on the blood-bank incoming feed —
      // lets that bank's own card show "you already responded" instead of
      // Accept/Decline buttons, without leaking other banks' identity here.
      if (myBankId) serialized.myBankResponse = bankResponses.find((entry) => entry.bankId === myBankId)?.response || null;
      return serialized;
    }),
  });
}

async function create(req, res) {
  let hospital = null;
  let raiserCity = null;
  let raiserState = null;
  if (req.user.role === 'hospital') {
    hospital = await HospitalProfile.findOne({ userId: req.user.id });
    if (!hospital) return res.status(404).json({ error: 'Hospital profile not found.' });
    if (hospital.approvalStatus !== 'approved') {
      return res.status(403).json({ error: 'Your hospital account is awaiting admin approval.' });
    }
    raiserCity = hospital.city;
    raiserState = hospital.state;
  } else if (req.user.role === 'donor') {
    const donor = await DonorProfile.findOne({ userId: req.user.id });
    raiserCity = donor ? donor.city : null;
    raiserState = donor ? donor.state : null;
  } else if (req.user.role === 'bloodbank') {
    const bank = await BloodBankProfile.findOne({ userId: req.user.id });
    raiserCity = bank ? bank.city : null;
    raiserState = bank ? bank.state : null;
  }

  const patient = String(req.body?.patient || '').trim();
  const bloodGroup = String(req.body?.bloodGroup || '');
  const units = Number(req.body?.units);
  const priority = String(req.body?.priority || 'Critical');
  const contactName = String(req.body?.contactName || '').trim();
  const contactPhone = String(req.body?.contactPhone || '').trim();

  if (!patient) return res.status(400).json({ error: 'Enter a patient / case reference.' });
  if (!BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ error: 'Select a blood group.' });
  if (!Number.isInteger(units) || units < 1) return res.status(400).json({ error: 'Enter a valid number of units.' });
  if (!REQUEST_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Select a priority.' });
  if (!contactName) return res.status(400).json({ error: 'Enter a contact name.' });
  if (!PHONE_PATTERN.test(contactPhone)) return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });

  // Prefer an explicit location from the request form (e.g. incident location);
  // fall back to the raising hospital's registered location if none was given.
  const { location: explicitLocation } = parseLocationFromBody(req.body);
  const location = explicitLocation || (hospital ? hospital.location : null) || null;

  const request = await BloodRequest.create({
    hospitalId: hospital ? hospital._id : null,
    raisedBy: req.user.role,
    raisedByUserId: req.user.id,
    patient,
    bloodGroup,
    unitsRequired: units,
    priority,
    contactName,
    contactPhone,
    status: 'Sending emergency alerts',
    city: raiserCity,
    state: raiserState,
    ...(location ? { location, searchRadiusKm: RADIUS_STEPS_KM[0] } : {}),
  });

  const alertResult = await notifyDonorsForRequest(request);
  request.matches = alertResult.matches;
  request.status = alertResult.matches > 0 ? alertResult.message : 'No compatible donors available';
  await request.save();

  // Hospital- and blood-bank-raised requests broadcast to every other approved
  // blood bank — donor/guest requests keep going through the donor-alert path
  // only, as before. Not awaited: this is a side notification, it shouldn't
  // delay the response. The raising bank itself is excluded from its own broadcast.
  if (req.user.role === 'hospital') notifyBloodBanksForRequest(request);
  else if (req.user.role === 'bloodbank') notifyBloodBanksForRequest(request, req.user.id);

  const serialized = serializeRequest(request, [], []);
  emitToRequest(request, 'request:update', serialized);
  emitToAdmins('admin:refresh');
  res.status(201).json({
    ok: alertResult.matches > 0,
    message: alertResult.message,
    request: serialized,
  });
}

// Admins can manage any request (needed for guest-raised requests, which have
// no owning hospital account); hospitals can only manage their own; donor/bloodbank
// raisers can manage requests they personally raised.
async function requireOwnedRequest(req, res) {
  const request = await BloodRequest.findById(req.params.id);
  if (!request) {
    res.status(404).json({ error: 'Request not found.' });
    return null;
  }
  if (req.user.role === 'admin') return request;
  if (request.raisedByUserId && request.raisedByUserId.toString() === req.user.id) return request;

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
  const bankResponseMap = await attachBankResponses([request]);
  const serialized = serializeRequest(
    request,
    responseMap.get(request._id.toString()) || [],
    bankResponseMap.get(request._id.toString()) || []
  );
  emitToRequest(request, 'request:update', serialized);
  if (complete) emitToAdmins('admin:refresh');
  res.json({ ok: true, request: serialized });
}

async function notify(req, res) {
  const request = await BloodRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });

  const alertResult = await notifyDonorsForRequest(request);
  request.matches = alertResult.matches;
  request.status = alertResult.matches > 0 ? alertResult.message : 'No compatible donors available';
  await request.save();

  const responseMap = await attachResponses([request]);
  const bankResponseMap = await attachBankResponses([request]);
  const serialized = serializeRequest(
    request,
    responseMap.get(request._id.toString()) || [],
    bankResponseMap.get(request._id.toString()) || []
  );
  emitToRequest(request, 'request:update', serialized);
  res.json({ ok: alertResult.matches > 0, message: alertResult.message, request: serialized });
}

// Hospital-only override for a critical request that isn't getting a
// response: relaxes just the travelling-donor exclusion, keeps blood-group
// compatibility. Available any time on the hospital's own request, not
// gated to a timeout.
async function notifyAll(req, res) {
  const request = await requireOwnedRequest(req, res);
  if (!request) return;
  if (req.user.role !== 'hospital') return res.status(403).json({ error: 'Not authorized' });

  const alertResult = await notifyDonorsForRequest(request, { includeTraveling: true });
  request.matches = alertResult.matches;
  request.status = alertResult.matches > 0 ? alertResult.message : 'No compatible donors available';
  await request.save();

  const responseMap = await attachResponses([request]);
  const bankResponseMap = await attachBankResponses([request]);
  const serialized = serializeRequest(
    request,
    responseMap.get(request._id.toString()) || [],
    bankResponseMap.get(request._id.toString()) || []
  );
  emitToRequest(request, 'request:update', serialized);
  res.json({ ok: alertResult.matches > 0, message: alertResult.message, request: serialized });
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

  // The 90-day rule is a medical safety requirement, not just a matching-rank
  // signal — findRankedDonors only deprioritizes a recent donor, it doesn't
  // exclude them, so this is the actual enforcement point. Declining is
  // always allowed regardless of eligibility.
  if (responseValue === 'Accepted') {
    const eligibility = computeEligibility(donor.lastDonationDate);
    if (!eligibility.eligible) {
      return res.status(403).json({
        error: `Not eligible to donate for ${eligibility.daysRemaining} more day${
          eligibility.daysRemaining === 1 ? '' : 's'
        } (90-day rule since your last donation).`,
        eligibility,
      });
    }
  }

  await DonorResponse.findOneAndUpdate(
    { requestId: request._id, donorId: donor._id },
    { response: responseValue, respondedAt: new Date() },
    { upsert: true, new: true }
  );

  // Guest-raised requests have nobody logged in to notify — that's fine.
  if (request.raisedByUserId) {
    const verb = responseValue === 'Accepted' ? 'accepted' : 'declined';
    notifyUser(
      request.raisedByUserId,
      `Donor ${verb} your request`,
      `${donor.name} ${verb} the request for ${request.patient} (${request.bloodGroup}).`
    );
  }

  const responseMap = await attachResponses([request]);
  const bankResponseMap = await attachBankResponses([request]);
  emitToRequest(
    request,
    'request:update',
    serializeRequest(
      request,
      responseMap.get(request._id.toString()) || [],
      bankResponseMap.get(request._id.toString()) || []
    )
  );
  res.json({ ok: true });
}

// A blood bank accepting/declining a hospital-raised request. Distinct from
// respond() (donors) because accepting here also commits real inventory —
// a bank can only respond once per request (no changing their mind), which
// keeps the inventory deduction below simple and unambiguous to reverse-reason
// about; DonorResponse allows changing your mind because it has no such
// side effect.
async function respondBloodBank(req, res) {
  const bank = await BloodBankProfile.findOne({ userId: req.user.id });
  if (!bank) return res.status(404).json({ error: 'Blood bank profile not found.' });
  if (bank.approvalStatus !== 'approved') {
    return res.status(403).json({ error: 'Your blood bank account is awaiting admin approval.' });
  }

  const responseValue = req.body?.response;
  if (responseValue !== 'Accepted' && responseValue !== 'Declined') {
    return res.status(400).json({ error: 'Response must be Accepted or Declined.' });
  }

  const request = await BloodRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });
  if (request.raisedBy !== 'hospital' && request.raisedBy !== 'bloodbank') {
    return res.status(403).json({ error: 'Not available for this request.' });
  }
  if (request.raisedByUserId && request.raisedByUserId.toString() === req.user.id) {
    return res.status(403).json({ error: 'You cannot respond to your own request.' });
  }

  const existing = await BloodBankResponse.findOne({ requestId: request._id, bankId: bank._id });
  if (existing) return res.status(409).json({ error: 'You already responded to this request.' });

  let unitsCommitted = 0;
  if (responseValue === 'Accepted') {
    const inventory = await BloodInventory.findOne({ bankId: bank._id, bloodGroup: request.bloodGroup });
    const available = inventory ? inventory.units : 0;
    if (available < request.unitsRequired) {
      return res.status(400).json({ error: `Not enough ${request.bloodGroup} units in stock to accept this request.` });
    }
    unitsCommitted = request.unitsRequired;
    inventory.units -= unitsCommitted;
    inventory.lastUpdated = new Date();
    await inventory.save();
  }

  await BloodBankResponse.create({
    requestId: request._id,
    bankId: bank._id,
    response: responseValue,
    unitsCommitted,
  });

  if (request.raisedByUserId && responseValue === 'Accepted') {
    notifyUser(
      request.raisedByUserId,
      'Blood bank accepted your request',
      `${bank.bankName} accepted your request for ${request.patient} (${request.bloodGroup}, ${unitsCommitted} unit${
        unitsCommitted === 1 ? '' : 's'
      }). Contact: ${bank.contactNumber || 'via BloodNet'}.`
    );
  }

  const responseMap = await attachResponses([request]);
  const bankResponseMap = await attachBankResponses([request]);
  const serialized = serializeRequest(
    request,
    responseMap.get(request._id.toString()) || [],
    bankResponseMap.get(request._id.toString()) || []
  );
  emitToRequest(request, 'request:update', serialized);
  res.json({ ok: true, request: serialized });
}

module.exports = { list, create, update, notify, notifyAll, respond, respondBloodBank };
