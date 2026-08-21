const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const DonorProfile = require('../models/donor-profile.model');
const HospitalProfile = require('../models/hospital-profile.model');
const BloodBankProfile = require('../models/blood-bank-profile.model');
const { issueOtp, resendEligibility, verifyOtp, describeDelivery } = require('../services/otp.service');
const { buildUserView } = require('../services/user-view.service');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { BLOOD_GROUPS } = require('../constants');
const { parseLocationFromBody } = require('../services/geo.service');
const { emitToAdmins } = require('../realtime/socket');
const { notifyAdmins } = require('../services/notification.service');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;
const NAME_PATTERN = /^[A-Za-z\s]+$/;
const EDIT_PROFILE_OTP_PURPOSE = 'edit-profile';
const RESUBMIT_OTP_PURPOSE = 'resubmit-registration';

function registrationTarget(email, phone) {
  return `${email}:${phone}`;
}

async function finishRegistration(res, user, email, phone) {
  const target = registrationTarget(email, phone);
  const deliveries = await issueOtp({ target, purpose: 'register', userId: user._id, email, phone });
  const status = describeDelivery(deliveries, { email, phone });

  return res.status(201).json({ ok: true, accountCreated: true, message: status.message });
}

// Hospital/bloodbank profiles carry a required licenseNumber field plus this
// document, embedded straight into the profile document (file.buffer, held
// in memory by multer -- see middleware/upload.js -- never touches disk).
function buildLicenseDocument(file) {
  return {
    data: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: new Date(),
  };
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
  if ((role === 'hospital' || role === 'bloodbank') && !req.file) {
    return res.status(400).json({ error: 'Upload your registration/license document (PDF, JPG, or PNG, max 5MB).' });
  }

  // Only email has to be unique -- phone numbers may be shared across accounts.
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'This email already exists.' });

  const passwordHash = await bcrypt.hash(password, 10);

  if (role === 'donor') {
    const name = String(body.name || '').trim();
    const age = Number(body.age);
    const bloodGroup = String(body.bloodGroup || '');
    const donatedEver = body.donatedEver === 'yes' ? 'yes' : 'no';

    if (name.length < 3) return res.status(400).json({ error: 'Name must be at least 3 characters.' });
    if (!NAME_PATTERN.test(name)) return res.status(400).json({ error: 'Name can only contain letters and spaces.' });
    if (!Number.isInteger(age) || age < 1 || age > 120) return res.status(400).json({ error: 'Enter a valid age.' });
    if (!BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ error: 'Select a blood group.' });

    const { city, state, location } = parseLocationFromBody(body);
    if (city && !NAME_PATTERN.test(city)) return res.status(400).json({ error: 'City can only contain letters and spaces.' });
    if (state && !NAME_PATTERN.test(state)) return res.status(400).json({ error: 'State can only contain letters and spaces.' });

    const user = await User.create({ email, phone, passwordHash, role: 'donor' });
    await DonorProfile.create({
      userId: user._id,
      name,
      age,
      bloodGroup,
      donatedEver,
      lastDonationDate: donatedEver === 'yes' && body.lastDonationDate ? new Date(body.lastDonationDate) : null,
      city,
      state,
      ...(location ? { location } : {}),
    });
    emitToAdmins('admin:refresh');
    return finishRegistration(res, user, email, phone);
  }

  if (role === 'hospital') {
    const hospitalName = String(body.hospitalName || '').trim();
    const licenseNumber = String(body.licenseNumber || '').trim();
    if (!hospitalName) return res.status(400).json({ error: 'Enter the hospital name.' });
    if (!licenseNumber) return res.status(400).json({ error: 'Enter the hospital license number.' });

    const hospitalCity = String(body.city || '').trim();
    const { state, location } = parseLocationFromBody(body);
    if (hospitalCity && !NAME_PATTERN.test(hospitalCity)) {
      return res.status(400).json({ error: 'City can only contain letters and spaces.' });
    }
    if (state && !NAME_PATTERN.test(state)) return res.status(400).json({ error: 'State can only contain letters and spaces.' });

    const user = await User.create({ email, phone, passwordHash, role: 'hospital' });
    await HospitalProfile.create({
      userId: user._id,
      hospitalName,
      licenseNumber,
      licenseDocument: buildLicenseDocument(req.file),
      address: String(body.address || '').trim(),
      city: hospitalCity,
      state,
      contactNumber: String(body.contactNumber || phone).trim(),
      ...(location ? { location } : {}),
    });
    emitToAdmins('admin:refresh');
    return finishRegistration(res, user, email, phone);
  }

  // bloodbank
  const bankName = String(body.bankName || '').trim();
  const licenseNumber = String(body.licenseNumber || '').trim();
  if (!bankName) return res.status(400).json({ error: 'Enter the blood bank name.' });
  if (!licenseNumber) return res.status(400).json({ error: 'Enter the blood bank license/registration number.' });

  const bankCity = String(body.city || '').trim();
  const { state, location } = parseLocationFromBody(body);
  if (bankCity && !NAME_PATTERN.test(bankCity)) {
    return res.status(400).json({ error: 'City can only contain letters and spaces.' });
  }
  if (state && !NAME_PATTERN.test(state)) return res.status(400).json({ error: 'State can only contain letters and spaces.' });

  const user = await User.create({ email, phone, passwordHash, role: 'bloodbank' });
  await BloodBankProfile.create({
    userId: user._id,
    bankName,
    licenseNumber,
    licenseDocument: buildLicenseDocument(req.file),
    address: String(body.address || '').trim(),
    city: bankCity,
    state,
    contactNumber: String(body.contactNumber || phone).trim(),
    ...(location ? { location } : {}),
  });
  emitToAdmins('admin:refresh');
  return finishRegistration(res, user, email, phone);
}

async function verifyOtpHandler(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim();
  const otp = String(req.body?.otp || '');
  const target = registrationTarget(email, phone);

  const result = await verifyOtp({ target, purpose: 'register', otp });
  if (!result.ok) return res.status(400).json({ error: result.message });

  // Not unconditional: an admin may have suspended this account while it was
  // still pending (e.g. flagged as spam) — completing OTP verification
  // shouldn't silently undo that.
  const user = await User.findById(result.userId);
  if (user) {
    user.emailVerified = true;
    user.phoneVerified = true;
    if (user.status !== 'suspended') user.status = 'active';
    await user.save();
  }
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
  if (user.status === 'suspended') {
    notifyAdmins(
      'Suspended account tried to log in',
      `${user.email} (${user.role}) attempted to log in but their account is suspended.`
    );
    const reasonText = user.suspensionReason ? `: ${user.suspensionReason}` : '.';
    return res.status(403).json({
      error: `Your account has been suspended by the admin${reasonText} Please ask the admin for approval again.`,
      code: 'account_suspended',
      suspensionReason: user.suspensionReason,
    });
  }
  if (!user.emailVerified || !user.phoneVerified) {
    return res.status(403).json({ error: 'Complete registration OTP verification before logging in.' });
  }

  if (user.role === 'hospital' || user.role === 'bloodbank') {
    const Profile = user.role === 'hospital' ? HospitalProfile : BloodBankProfile;
    const noun = user.role === 'hospital' ? 'hospital' : 'blood bank';
    const profile = await Profile.findOne({ userId: user._id });
    if (!profile || profile.approvalStatus === 'pending') {
      return res.status(403).json({ error: `Your ${noun} account is awaiting admin approval.` });
    }
    if (profile.approvalStatus === 'rejected') {
      return res.status(403).json({
        error: `Your ${noun} account was rejected: ${profile.rejectionReason || 'No reason provided.'} Update your details and resubmit for review.`,
        code: 'account_rejected',
        role: user.role,
        rejectionReason: profile.rejectionReason,
        phone: user.phone,
      });
    }
  }

  const token = signToken({ id: user._id.toString(), role: user.role });
  setAuthCookie(res, token);
  return res.json({ ok: true, user: await buildUserView(user) });
}

// Lets a suspended user (who can't log in to do anything else) ping the
// admins directly from the login screen instead of needing another channel.
async function requestReactivation(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'No account was found for this email.' });
  if (user.status !== 'suspended') {
    return res.status(400).json({ error: 'This account is not suspended.' });
  }

  user.reactivationRequestedAt = new Date();
  await user.save();

  await notifyAdmins(
    'Account reactivation requested',
    `${user.email} (${user.role}) is asking for their suspended account to be reviewed for reactivation.`
  );

  return res.json({
    ok: true,
    message: "Your request has been sent to the admin. You'll be notified once it's reviewed.",
  });
}

// Rejected hospital/bloodbank accounts can't log in, so they can't reach the
// normal OTP-gated profile edit (that requires an authenticated session).
// This pair mirrors the forgot-password flow instead: prove ownership of the
// account via an OTP, then fix the details and get back in the review queue.
async function requestResubmitOtp(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  const user = await User.findOne({ email });
  if (!user || !['hospital', 'bloodbank'].includes(user.role)) {
    return res.status(404).json({ error: 'No account was found for this email.' });
  }
  const Profile = user.role === 'hospital' ? HospitalProfile : BloodBankProfile;
  const profile = await Profile.findOne({ userId: user._id });
  if (!profile || profile.approvalStatus !== 'rejected') {
    return res.status(400).json({ error: 'This account is not currently rejected.' });
  }

  const eligibility = await resendEligibility(user.email, RESUBMIT_OTP_PURPOSE);
  if (!eligibility.eligible) {
    return res.status(429).json({ error: 'Please wait before requesting another code.' });
  }

  const deliveries = await issueOtp({
    target: user.email,
    purpose: RESUBMIT_OTP_PURPOSE,
    email: user.email,
    phone: user.phone,
  });
  const status = describeDelivery(deliveries, { email: user.email, phone: user.phone }, 'verification code');

  return res.status(status.degraded ? 200 : 201).json({
    ok: true,
    message: status.message,
    rejectionReason: profile.rejectionReason,
  });
}

async function resubmitRegistration(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '');
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  const user = await User.findOne({ email });
  if (!user || !['hospital', 'bloodbank'].includes(user.role)) {
    return res.status(404).json({ error: 'No account was found for this email.' });
  }

  const result = await verifyOtp({ target: user.email, purpose: RESUBMIT_OTP_PURPOSE, otp });
  if (!result.ok) return res.status(400).json({ error: result.message });

  if (user.role === 'hospital') {
    const profile = await HospitalProfile.findOne({ userId: user._id });
    if (!profile || profile.approvalStatus !== 'rejected') {
      return res.status(400).json({ error: 'This account is not currently rejected.' });
    }

    const hospitalName = String(req.body?.hospitalName || '').trim();
    const licenseNumber = String(req.body?.licenseNumber || '').trim();
    if (!hospitalName) return res.status(400).json({ error: 'Enter the hospital name.' });
    if (!licenseNumber) return res.status(400).json({ error: 'Enter the hospital license number.' });
    if (!req.file && !profile.licenseDocument) {
      return res.status(400).json({ error: 'Upload your registration/license document (PDF, JPG, or PNG, max 5MB).' });
    }

    const hospitalCity = String(req.body?.city || '').trim();
    const { state: hospitalState, location } = parseLocationFromBody(req.body);
    if (hospitalCity && !NAME_PATTERN.test(hospitalCity)) {
      return res.status(400).json({ error: 'City can only contain letters and spaces.' });
    }
    if (hospitalState && !NAME_PATTERN.test(hospitalState)) {
      return res.status(400).json({ error: 'State can only contain letters and spaces.' });
    }

    profile.hospitalName = hospitalName;
    profile.licenseNumber = licenseNumber;
    if (req.file) profile.licenseDocument = buildLicenseDocument(req.file);
    profile.address = String(req.body?.address || '').trim();
    profile.city = hospitalCity;
    profile.state = hospitalState;
    if (location) profile.location = location;
    profile.approvalStatus = 'pending';
    profile.rejectionReason = null;
    await profile.save();

    notifyAdmins(
      'Hospital resubmitted for review',
      `${profile.hospitalName} (${user.email}) updated their details after being rejected and is awaiting review again.`
    );
  } else {
    const profile = await BloodBankProfile.findOne({ userId: user._id });
    if (!profile || profile.approvalStatus !== 'rejected') {
      return res.status(400).json({ error: 'This account is not currently rejected.' });
    }

    const bankName = String(req.body?.bankName || '').trim();
    const licenseNumber = String(req.body?.licenseNumber || '').trim();
    if (!bankName) return res.status(400).json({ error: 'Enter the blood bank name.' });
    if (!licenseNumber) return res.status(400).json({ error: 'Enter the blood bank license/registration number.' });
    if (!req.file && !profile.licenseDocument) {
      return res.status(400).json({ error: 'Upload your registration/license document (PDF, JPG, or PNG, max 5MB).' });
    }

    const bankCity = String(req.body?.city || '').trim();
    const { state: bankState, location } = parseLocationFromBody(req.body);
    if (bankCity && !NAME_PATTERN.test(bankCity)) {
      return res.status(400).json({ error: 'City can only contain letters and spaces.' });
    }
    if (bankState && !NAME_PATTERN.test(bankState)) {
      return res.status(400).json({ error: 'State can only contain letters and spaces.' });
    }

    profile.bankName = bankName;
    profile.licenseNumber = licenseNumber;
    if (req.file) profile.licenseDocument = buildLicenseDocument(req.file);
    profile.address = String(req.body?.address || '').trim();
    profile.city = bankCity;
    profile.contactNumber = String(req.body?.contactNumber || user.phone).trim();
    profile.state = bankState;
    if (location) profile.location = location;
    profile.approvalStatus = 'pending';
    profile.rejectionReason = null;
    await profile.save();

    notifyAdmins(
      'Blood bank resubmitted for review',
      `${profile.bankName} (${user.email}) updated their details after being rejected and is awaiting review again.`
    );
  }

  emitToAdmins('admin:refresh');
  return res.json({
    ok: true,
    message: 'Your details have been resubmitted for review. You can log in once an admin approves your account.',
  });
}

// Donor edits go through /donors/me/profile; this covers hospital/bloodbank/admin.
// Targets the OTP by email, not phone -- phone numbers aren't unique per
// account, so keying off it here would let two accounts sharing a number
// invalidate each other's in-flight edit request (issueOtp deletes any prior
// unconsumed token for the same target+purpose).
async function requestProfileEditOtp(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  const eligibility = await resendEligibility(user.email, EDIT_PROFILE_OTP_PURPOSE);
  if (!eligibility.eligible) {
    return res.status(429).json({ error: 'Please wait before requesting another code.' });
  }

  const deliveries = await issueOtp({
    target: user.email,
    purpose: EDIT_PROFILE_OTP_PURPOSE,
    email: user.email,
    phone: user.phone,
  });
  const status = describeDelivery(deliveries, { email: user.email, phone: user.phone }, 'verification code');

  return res.status(status.degraded ? 200 : 201).json({ ok: true, message: status.message });
}

async function updateMyProfile(req, res) {
  if (req.user.role === 'donor') {
    return res.status(400).json({ error: 'Use the donor profile edit screen for donor accounts.' });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  const otp = String(req.body?.otp || '');
  const result = await verifyOtp({ target: user.email, purpose: EDIT_PROFILE_OTP_PURPOSE, otp });
  if (!result.ok) return res.status(400).json({ error: result.message });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim();
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!PHONE_PATTERN.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });

  if (email !== user.email) {
    const existingEmail = await User.findOne({ email, _id: { $ne: user._id } });
    if (existingEmail) return res.status(409).json({ error: 'This email is already in use.' });
  }

  if (user.role === 'hospital') {
    const hospitalName = String(req.body?.hospitalName || '').trim();
    const licenseNumber = String(req.body?.licenseNumber || '').trim();
    if (!hospitalName) return res.status(400).json({ error: 'Enter the hospital name.' });
    if (!licenseNumber) return res.status(400).json({ error: 'Enter the hospital license number.' });

    const profile = await HospitalProfile.findOne({ userId: user._id });
    if (!profile) return res.status(404).json({ error: 'Hospital profile not found.' });
    const hospitalCity = String(req.body?.city || '').trim();
    const { state: hospitalState, location } = parseLocationFromBody(req.body);
    if (hospitalCity && !NAME_PATTERN.test(hospitalCity)) {
      return res.status(400).json({ error: 'City can only contain letters and spaces.' });
    }
    if (hospitalState && !NAME_PATTERN.test(hospitalState)) {
      return res.status(400).json({ error: 'State can only contain letters and spaces.' });
    }

    profile.hospitalName = hospitalName;
    profile.licenseNumber = licenseNumber;
    if (req.file) profile.licenseDocument = buildLicenseDocument(req.file);
    profile.address = String(req.body?.address || '').trim();
    profile.city = hospitalCity;
    profile.state = hospitalState;
    if (location) profile.location = location;
    // Editing details doesn't revoke an existing approval. A rejected
    // account can't reach this endpoint at all (login is blocked until
    // approved) -- see requestResubmitOtp/resubmitRegistration for that path.
    await profile.save();
  } else if (user.role === 'bloodbank') {
    const bankName = String(req.body?.bankName || '').trim();
    const licenseNumber = String(req.body?.licenseNumber || '').trim();
    if (!bankName) return res.status(400).json({ error: 'Enter the blood bank name.' });
    if (!licenseNumber) return res.status(400).json({ error: 'Enter the blood bank license/registration number.' });

    const profile = await BloodBankProfile.findOne({ userId: user._id });
    if (!profile) return res.status(404).json({ error: 'Blood bank profile not found.' });
    const bankCity = String(req.body?.city || '').trim();
    const { state: bankState, location } = parseLocationFromBody(req.body);
    if (bankCity && !NAME_PATTERN.test(bankCity)) {
      return res.status(400).json({ error: 'City can only contain letters and spaces.' });
    }
    if (bankState && !NAME_PATTERN.test(bankState)) {
      return res.status(400).json({ error: 'State can only contain letters and spaces.' });
    }

    profile.bankName = bankName;
    profile.licenseNumber = licenseNumber;
    if (req.file) profile.licenseDocument = buildLicenseDocument(req.file);
    profile.address = String(req.body?.address || '').trim();
    profile.city = bankCity;
    profile.contactNumber = String(req.body?.contactNumber || phone).trim();
    profile.state = bankState;
    if (location) profile.location = location;
    await profile.save();
  }
  // admin has no extra profile fields beyond email/phone.

  user.email = email;
  user.phone = phone;
  await user.save();

  res.json({ ok: true, user: await buildUserView(user) });
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

// Phone numbers aren't unique per account (see user.model.js), so a
// phone-based lookup can match more than one user. Email always resolves to
// exactly one. Refusing the ambiguous case rather than picking one is the
// safe call -- silently grabbing "a" match could reset the wrong account's
// password.
async function findUserByIdentifier(identifier, isEmail) {
  if (isEmail) return { user: await User.findOne({ email: identifier.toLowerCase() }), ambiguous: false };
  const matches = await User.find({ phone: identifier });
  return { user: matches.length === 1 ? matches[0] : null, ambiguous: matches.length > 1 };
}

async function requestPasswordResetOtp(req, res) {
  const identifier = String(req.body?.identifier || '').trim();
  const isEmail = EMAIL_PATTERN.test(identifier);
  const isPhone = PHONE_PATTERN.test(identifier);
  if (!isEmail && !isPhone) {
    return res.status(400).json({ error: 'Enter a valid email address or 10-digit mobile number.' });
  }

  const { user, ambiguous } = await findUserByIdentifier(identifier, isEmail);
  if (ambiguous) {
    return res.status(400).json({ error: 'Multiple accounts share this phone number. Please use your email instead.' });
  }
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

  const { user, ambiguous } = await findUserByIdentifier(identifier, isEmail);
  if (ambiguous) {
    return res.status(400).json({ error: 'Multiple accounts share this phone number. Please use your email instead.' });
  }
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
  requestReactivation,
  requestResubmitOtp,
  resubmitRegistration,
  logout,
  me,
  requestPasswordResetOtp,
  resetPassword,
  requestProfileEditOtp,
  updateMyProfile,
};
