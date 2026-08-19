const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const OtpToken = require('../models/otp-token.model');
const { env } = require('../config/env');
const { sendOtpEmail } = require('./mailer.service');
const { sendOtpSms } = require('./sms.service');

const OTP_VALIDITY_MS = 10 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

// target binds an OTP to a specific verification flow (e.g. "email:phone" for
// registration so one OTP covers both channels, or a single identifier for
// forgot-password). purpose scopes it so a register OTP can't be replayed for
// password reset.
async function issueOtp({ target, purpose, userId = null, email, phone }) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const now = Date.now();

  await OtpToken.deleteMany({ target, purpose, consumed: false });
  await OtpToken.create({
    target,
    purpose,
    userId,
    otpHash,
    expiresAt: new Date(now + OTP_VALIDITY_MS),
    resendAt: new Date(now + OTP_RESEND_DELAY_MS),
  });

  const deliveries = { email: null, sms: null };

  if (email) {
    try {
      await sendOtpEmail(email, otp);
      deliveries.email = true;
    } catch (error) {
      console.error('OTP email delivery failed:', error.message);
      deliveries.email = false;
    }
  }

  if (phone) {
    try {
      await sendOtpSms(phone, otp);
      deliveries.sms = true;
    } catch (error) {
      console.error('OTP SMS delivery failed:', error.message);
      deliveries.sms = false;
    }
  }

  // Dev fallback so the flow is usable without live Resend/Twilio credentials.
  if (env.nodeEnv !== 'production' && (deliveries.email === false || deliveries.sms === false || (!email && !phone))) {
    console.log(`[dev-otp] ${purpose} OTP for ${target}: ${otp}`);
  }

  return deliveries;
}

async function resendEligibility(target, purpose) {
  const record = await OtpToken.findOne({ target, purpose, consumed: false }).sort({ createdAt: -1 });
  if (!record) return { eligible: true };
  if (Date.now() < record.resendAt.getTime()) {
    return { eligible: false, retryAt: record.resendAt };
  }
  return { eligible: true };
}

async function verifyOtp({ target, purpose, otp }) {
  const record = await OtpToken.findOne({ target, purpose, consumed: false }).sort({ createdAt: -1 });
  if (!record) return { ok: false, message: 'Please request a new OTP.' };
  if (Date.now() > record.expiresAt.getTime()) {
    return { ok: false, message: 'OTP expired. Please request a new OTP.' };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, message: 'Too many incorrect attempts. Please request a new OTP.' };
  }

  const matches = await bcrypt.compare(String(otp), record.otpHash);
  if (!matches) {
    record.attempts += 1;
    await record.save();
    return { ok: false, message: 'Invalid OTP.' };
  }

  record.consumed = true;
  await record.save();
  return { ok: true, userId: record.userId };
}

module.exports = { issueOtp, resendEligibility, verifyOtp };
