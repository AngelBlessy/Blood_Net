const request = require('supertest');
const bcrypt = require('bcryptjs');
const { createApp } = require('../app');
const User = require('../models/user.model');
const DonorProfile = require('../models/donor-profile.model');
const HospitalProfile = require('../models/hospital-profile.model');
const BloodBankProfile = require('../models/blood-bank-profile.model');

const app = createApp();

function agent() {
  return request(app);
}

const DEFAULT_PASSWORD = 'Password123!';

let phoneCounter = 9_000_000_000;
function uniquePhone() {
  phoneCounter += 1;
  return String(phoneCounter);
}

let emailCounter = 0;
function uniqueEmail(prefix = 'user') {
  emailCounter += 1;
  return `${prefix}${emailCounter}@bloodnet.test`;
}

// Cost factor 4 (vs. the app's real 10) -- these are test fixtures, not real
// credentials, and bcrypt.compare() works identically regardless of the cost
// factor the hash was created with, so this only buys test speed.
async function createUser({ role, status = 'active', email, phone, password = DEFAULT_PASSWORD }) {
  const passwordHash = await bcrypt.hash(password, 4);
  return User.create({
    email: email || uniqueEmail(role),
    phone: phone || uniquePhone(),
    passwordHash,
    role,
    status,
    emailVerified: true,
    phoneVerified: true,
  });
}

async function createDonor(overrides = {}) {
  const { password, ...userOverrides } = overrides;
  const user = await createUser({ role: 'donor', password, ...userOverrides });
  const profile = await DonorProfile.create({
    userId: user._id,
    name: overrides.name || 'Test Donor',
    age: overrides.age ?? 30,
    bloodGroup: overrides.bloodGroup || 'O+',
    donatedEver: overrides.donatedEver || 'no',
    lastDonationDate: overrides.lastDonationDate ?? null,
    traveling: overrides.traveling ?? false,
    availabilityStatus: overrides.availabilityStatus || 'available',
    city: overrides.city ?? null,
    state: overrides.state ?? null,
    ...(overrides.location ? { location: overrides.location } : {}),
  });
  return { user, profile, password: password || DEFAULT_PASSWORD };
}

async function createHospital(overrides = {}) {
  const { password, ...userOverrides } = overrides;
  const user = await createUser({ role: 'hospital', password, ...userOverrides });
  const profile = await HospitalProfile.create({
    userId: user._id,
    hospitalName: overrides.hospitalName || 'Test Hospital',
    licenseNumber: overrides.licenseNumber || 'LIC-1234',
    address: overrides.address || '1 Main St',
    city: overrides.city || 'Testville',
    state: overrides.state ?? null,
    contactNumber: overrides.contactNumber || user.phone,
    approvalStatus: overrides.approvalStatus || 'approved',
    rejectionReason: overrides.rejectionReason ?? null,
    ...(overrides.location ? { location: overrides.location } : {}),
  });
  return { user, profile, password: password || DEFAULT_PASSWORD };
}

async function createBloodBank(overrides = {}) {
  const { password, ...userOverrides } = overrides;
  const user = await createUser({ role: 'bloodbank', password, ...userOverrides });
  const profile = await BloodBankProfile.create({
    userId: user._id,
    bankName: overrides.bankName || 'Test Blood Bank',
    licenseNumber: overrides.licenseNumber || 'BANK-LIC-1234',
    address: overrides.address || '2 Main St',
    city: overrides.city || 'Testville',
    state: overrides.state ?? null,
    contactNumber: overrides.contactNumber || user.phone,
    approvalStatus: overrides.approvalStatus || 'approved',
    rejectionReason: overrides.rejectionReason ?? null,
    ...(overrides.location ? { location: overrides.location } : {}),
  });
  return { user, profile, password: password || DEFAULT_PASSWORD };
}

async function createAdmin(overrides = {}) {
  const { password, ...userOverrides } = overrides;
  const user = await createUser({ role: 'admin', password, ...userOverrides });
  return { user, password: password || DEFAULT_PASSWORD };
}

// Logs in via the real HTTP endpoint (not a shortcut) and returns the
// "name=value" pair from Set-Cookie for reuse on later requests via
// `.set('Cookie', cookie)` -- exercises the actual login path every
// authenticated test relies on, instead of forging a token by hand.
async function loginAndGetCookie({ email, password = DEFAULT_PASSWORD }) {
  const response = await agent().post('/api/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed in test helper: ${response.status} ${JSON.stringify(response.body)}`);
  }
  const setCookie = response.headers['set-cookie'];
  if (!setCookie || !setCookie.length) throw new Error('Login succeeded but no session cookie was set.');
  return setCookie[0].split(';')[0];
}

// Captures console.log output while `fn()` runs and extracts the plaintext
// OTP from the "[dev-otp] <purpose> OTP for <target>: <otp>" fallback line
// otp.service.js prints when email/SMS delivery isn't configured -- always
// true in this test environment (see global-setup.js), so this is how tests
// complete an OTP flow without a real inbox/phone to read from.
async function captureDevOtp(fn) {
  const lines = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    lines.push(args.join(' '));
  });
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  // The target itself (email:phone, for registration) can contain a colon,
  // so this must find the *last* ": <6 digits>" on the line -- a non-greedy
  // match would stop at the first colon inside the target and misread part
  // of a phone number as the OTP.
  const match = lines.join('\n').match(/\[dev-otp][^\n]*:\s*(\d{6})\s*(?:\n|$)/);
  if (!match) throw new Error(`No [dev-otp] line found in captured console output:\n${lines.join('\n')}`);
  return match[1];
}

module.exports = {
  app,
  agent,
  DEFAULT_PASSWORD,
  uniqueEmail,
  uniquePhone,
  createUser,
  createDonor,
  createHospital,
  createBloodBank,
  createAdmin,
  loginAndGetCookie,
  captureDevOtp,
};
