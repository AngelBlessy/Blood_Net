const { env, requireEnv } = require('../config/env');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10_000;

// Resend's HTTP API is one plain POST -- no SDK needed, matching how
// ai-prediction.service.js and translation.service.js already talk to their
// external services directly via fetch rather than pulling in a client lib.
async function sendMail({ to, subject, text, html }) {
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
        ...(html ? { html } : {}),
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

// Inline-styled table layout, since email clients (Outlook/Gmail) strip
// <style> blocks and don't support modern CSS layout.
function otpEmailHtml(otp) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <tr>
              <td style="background-color:#b91c1c;padding:24px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.2px;">Blood Donation Portal</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 8px;color:#111827;font-size:16px;">Hello,</p>
                <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5;">
                  Use the verification code below to complete your request. This code is valid for the next 5 minutes.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:16px 0;background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#b91c1c;">${otp}</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">
                  Do not share this code with anyone. If you didn't request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:#9ca3af;font-size:12px;">This is an automated message from the Blood Donation Portal. Please do not reply to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
    html: body ? undefined : otpEmailHtml(otp),
  });
}

module.exports = { sendMail, sendOtpEmail };
