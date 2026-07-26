const BloodRequest = require('../models/blood-request.model');
const { issueOtp, resendEligibility, verifyOtp } = require('../services/otp.service');
const { notifyDonorsForRequest } = require('../services/request-alert.service');
const { BLOOD_GROUPS, REQUEST_PRIORITIES } = require('../constants');

const PHONE_PATTERN = /^\d{10}$/;
const OTP_PURPOSE = 'guest-request';

function validateGuestRequest(body) {
  const name = String(body?.name || '').trim();
  const phone = String(body?.phone || '').trim();
  const patient = String(body?.patient || '').trim();
  const bloodGroup = String(body?.bloodGroup || '');
  const units = Number(body?.units);
  const priority = String(body?.priority || 'Critical');

  if (name.length < 2) return { error: 'Enter your name.' };
  if (!PHONE_PATTERN.test(phone)) return { error: 'Enter a valid 10-digit phone number.' };
  if (!patient) return { error: 'Enter a patient / hospital reference.' };
  if (!BLOOD_GROUPS.includes(bloodGroup)) return { error: 'Select a blood group.' };
  if (!Number.isInteger(units) || units < 1) return { error: 'Enter a valid number of units.' };
  if (!REQUEST_PRIORITIES.includes(priority)) return { error: 'Select a priority.' };

  return { value: { name, phone, patient, bloodGroup, units, priority } };
}

async function requestOtp(req, res) {
  const { error, value } = validateGuestRequest(req.body);
  if (error) return res.status(400).json({ error });

  const eligibility = await resendEligibility(value.phone, OTP_PURPOSE);
  if (!eligibility.eligible) {
    return res.status(429).json({ error: 'Please wait before requesting another code.' });
  }

  const deliveries = await issueOtp({ target: value.phone, purpose: OTP_PURPOSE, phone: value.phone });
  if (deliveries.sms === false) {
    return res.json({
      ok: true,
      message: "We couldn't send the verification code by SMS right now. Use Resend to try again.",
    });
  }
  return res.status(201).json({ ok: true, message: 'A verification code has been sent to your phone.' });
}

async function create(req, res) {
  const { error, value } = validateGuestRequest(req.body);
  if (error) return res.status(400).json({ error });

  const otp = String(req.body?.otp || '');
  const result = await verifyOtp({ target: value.phone, purpose: OTP_PURPOSE, otp });
  if (!result.ok) return res.status(400).json({ error: result.message });

  const request = await BloodRequest.create({
    raisedBy: 'guest',
    guestName: value.name,
    guestPhone: value.phone,
    patient: value.patient,
    bloodGroup: value.bloodGroup,
    unitsRequired: value.units,
    priority: value.priority,
    status: 'Sending emergency alerts',
  });

  const alertResult = await notifyDonorsForRequest(request);
  request.matches = alertResult.matches;
  request.status = alertResult.matches > 0 ? alertResult.message : 'No compatible donors available';
  await request.save();

  res.status(201).json({
    ok: alertResult.matches > 0,
    message: alertResult.message,
    request: {
      id: request._id.toString(),
      patient: request.patient,
      bloodGroup: request.bloodGroup,
      units: request.unitsRequired,
      priority: request.priority,
      matches: request.matches,
      status: request.status,
      createdAt: request.createdAt,
      hospitalId: null,
      raisedBy: 'guest',
      responses: [],
    },
  });
}

module.exports = { requestOtp, create };
