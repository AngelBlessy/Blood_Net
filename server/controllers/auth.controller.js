const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const DonorProfile = require('../models/donor-profile.model');
const HospitalProfile = require('../models/hospital-profile.model');
const BloodBankProfile = require('../models/blood-bank-profile.model');
const { issueOtp, resendEligibility, verifyOtp } = require('../services/otp.service');
const { buildUserView } = require('../services/user-view.service');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { BLOOD_GROUPS } = require('../constants');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;

function registrationTarget(email, phone) {
  return `${email}:${phone}`;
}

async function finishRegistration(res, user, email, phone) {
  const target = registrationTarget(email, phone);
  const deliveries = await issueOtp({ target, purpose: 'register', userId: user._id, email, phone });

  const failed = [];
  if (deliveries.email === false) failed.push('email');
  if (deliveries.sms === false) failed.push('SMS');

  if (failed.length) {
    return res.status(201).json({
      ok: true,
      accountCreated: true,
      message: `We couldn't send the OTP by ${failed.join(' and ')} right now. Use Resend OTP to try again.`,
    });
  }
  return res.status(201).json({
    ok: true,
    accountCreated: true,
    message: 'Same OTP has been sent to your email and mobile number.',
  });
}

async function register(req, res) {
  const body = req.body || {};
  const role = String(body.role || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '');

  if (!['donor', 'hospital', 'bloodbank'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!PHONE_PATTERN.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const existing = await User.findOne({ $or: [{ email }, { phone }] });
  if (existing) return res.status(409).json({ error: 'This email or phone already exists.' });

  const passwordHash = await bcrypt.hash(password, 10);

  if (role === 'donor') {
    const name = String(body.name || '').trim();
    const age = Number(body.age);
    const bloodGroup = String(body.bloodGroup || '');
    const donatedEver = body.donatedEver === 'yes' ? 'yes' : 'no';

    if (name.length < 3) return res.status(400).json({ error: 'Name must be at least 3 characters.' });
    if (!Number.isInteger(age) || age < 1 || age > 120) return res.status(400).json({ error: 'Enter a valid age.' });
    if (!BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ error: 'Select a blood group.' });

    const user = await User.create({ email, phone, passwordHash, role: 'donor' });
    await DonorProfile.create({
      userId: user._id,
      name,
      age,
      bloodGroup,
      donatedEver,
      lastDonationDate: donatedEver === 'yes' && body.lastDonationDate ? new Date(body.lastDonationDate) : null,
    });
    return finishRegistration(res, user, email, phone);
  }

  if (role === 'hospital') {
    const hospitalName = String(body.hospitalName || '').trim();
    const licenseNumber = String(body.licenseNumber || '').trim();
    if (!hospitalName) return res.status(400).json({ error: 'Enter the hospital name.' });
    if (!licenseNumber) return res.status(400).json({ error: 'Enter the hospital license number.' });

    const user = await User.create({ email, phone, passwordHash, role: 'hospital' });
    await HospitalProfile.create({
      userId: user._id,
      hospitalName,
      licenseNumber,
      address: String(body.address || '').trim(),
      city: String(body.city || '').trim(),
      contactNumber: String(body.contactNumber || phone).trim(),
    });
    return finishRegistration(res, user, email, phone);
  }

  // bloodbank
  const bankName = String(body.bankName || '').trim();
  if (!bankName) return res.status(400).json({ error: 'Enter the blood bank name.' });

  const user = await User.create({ email, phone, passwordHash, role: 'bloodbank' });
  await BloodBankProfile.create({
    userId: user._id,
    bankName,
    address: String(body.address || '').trim(),
    city: String(body.city || '').trim(),
    contactNumber: String(body.contactNumber || phone).trim(),
  });
  return finishRegistration(res, user, email, phone);
}

async function verifyOtpHandler(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim();
  const otp = String(req.body?.otp || '');
  const target = registrationTarget(email, phone);

  const result = await verifyOtp({ target, purpose: 'register', otp });
  if (!result.ok) return res.status(400).json({ error: result.message });

  await User.findByIdAndUpdate(result.userId, { emailVerified: true, phoneVerified: true, status: 'active' });
  return res.json({ ok: true });
}

async function resendOtpHandler(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim();
  const target = registrationTarget(email, phone);

  const eligibility = await resendEligibility(target, 'register');
  if (!eligibility.eligible) {
    return res.status(429).json({ error: 'Please wait before requesting another OTP.' });
  }

  const user = await User.findOne({ email, phone });
  if (!user) return res.status(404).json({ error: 'Please start registration again.' });

  return finishRegistration(res, user, email, phone);
}

async function login(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (!user.emailVerified || !user.phoneVerified) {
    return res.status(403).json({ error: 'Complete registration OTP verification before logging in.' });
  }

  if (user.role === 'hospital') {
    const profile = await HospitalProfile.findOne({ userId: user._id });
    if (!profile || profile.approvalStatus !== 'approved') {
      return res.status(403).json({ error: 'Your hospital account is awaiting admin approval.' });
    }
  }
  if (user.role === 'bloodbank') {
    const profile = await BloodBankProfile.findOne({ userId: user._id });
    if (!profile || profile.approvalStatus !== 'approved') {
      return res.status(403).json({ error: 'Your blood bank account is awaiting admin approval.' });
    }
  }

  const token = signToken({ id: user._id.toString(), role: user.role });
  setAuthCookie(res, token);
  return res.json({ ok: true, user: await buildUserView(user) });
}

function logout(_req, res) {
  clearAuthCookie(res);
  return res.json({ ok: true });
}

async function me(req, res) {
  if (!req.user) return res.json({ user: null });
  const user = await User.findById(req.user.id);
  if (!user) return res.json({ user: null });
  return res.json({ user: await buildUserView(user) });
}

async function requestPasswordResetOtp(req, res) {
  const identifier = String(req.body?.identifier || '').trim();
  const isEmail = EMAIL_PATTERN.test(identifier);
  const isPhone = PHONE_PATTERN.test(identifier);
  if (!isEmail && !isPhone) {
    return res.status(400).json({ error: 'Enter a valid email address or 10-digit mobile number.' });
  }

  const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };
  const user = await User.findOne(query);
  if (!user) {
    return res.status(404).json({ error: `No account was found for this ${isEmail ? 'email' : 'mobile number'}.` });
  }

  const target = isEmail ? user.email : user.phone;
  const eligibility = await resendEligibility(target, 'forgot-password');
  if (!eligibility.eligible) {
    return res.status(429).json({ error: 'Please wait before requesting another OTP.' });
  }

  const deliveries = await issueOtp({
    target,
    purpose: 'forgot-password',
    userId: user._id,
    email: isEmail ? user.email : undefined,
    phone: isEmail ? undefined : user.phone,
  });
  const channelFailed = isEmail ? deliveries.email === false : deliveries.sms === false;
  if (channelFailed) {
    return res.json({
      ok: true,
      message: `We couldn't send the OTP by ${isEmail ? 'email' : 'SMS'} right now. Use Resend OTP to try again.`,
    });
  }
  return res.json({
    ok: true,
    message: `OTP has been sent to your ${isEmail ? 'email address' : 'mobile number'}.`,
  });
}

async function resetPassword(req, res) {
  const identifier = String(req.body?.identifier || '').trim();
  const otp = String(req.body?.otp || '');
  const password = String(req.body?.password || '');
  const isEmail = EMAIL_PATTERN.test(identifier);
  const isPhone = PHONE_PATTERN.test(identifier);
  if (!isEmail && !isPhone) {
    return res.status(400).json({ error: 'Enter a valid email address or 10-digit mobile number.' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };
  const user = await User.findOne(query);
  if (!user) return res.status(404).json({ error: 'No account was found for this identifier.' });

  const target = isEmail ? user.email : user.phone;
  const result = await verifyOtp({ target, purpose: 'forgot-password', otp });
  if (!result.ok) return res.status(400).json({ error: result.message });

  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  return res.json({ ok: true, message: 'Password reset successful. Please login.' });
}

module.exports = {
  register,
  verifyOtpHandler,
  resendOtpHandler,
  login,
  logout,
  me,
  requestPasswordResetOtp,
  resetPassword,
};
