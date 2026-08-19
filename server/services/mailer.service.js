const { env, requireEnv } = require('../config/env');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10_000;

// Resend's HTTP API is one plain POST -- no SDK needed, matching how
// ai-prediction.service.js and translation.service.js already talk to their
// external services directly via fetch rather than pulling in a client lib.
async function sendMail({ to, subject, text }) {
  const apiKey = requireEnv('RESEND_API_KEY');
  const fromEmail = requireEnv('RESEND_FROM_EMAIL');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${env.resend.fromName} <${fromEmail}>`,
        to: [to],
        subject,
        text,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Resend's error body is {"statusCode", "name", "message"} -- surface the
    // message when present, since it's already written for a human (e.g.
    // "The gmail.com domain is not verified").
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Resend request failed with status ${response.status}`);
  }
}

async function sendOtpEmail(target, otp, body) {
  await sendMail({
    to: target,
    subject: 'Blood Donation Portal - Email Verification OTP',
    text:
      body ||
      [
        'Hello,',
        '',
        `Your Blood Donation Portal OTP is ${otp}.`,
        '',
        'This OTP expires in 5 minutes.',
        'Do not share the OTP with anyone.',
      ].join('\n'),
  });
}

module.exports = { sendMail, sendOtpEmail };
