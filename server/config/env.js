// Anchor to the repo root regardless of the process's cwd (dotenv defaults
// to resolving ".env" against process.cwd(), so starting the server from
// inside server/ instead of the repo root would silently load no .env at
// all — e.g. GOOGLE_TRANSLATE_API_KEY would look unset even after it's
// filled in).
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.includes('your_')) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bloodnet2',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  admin: {
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    fromName: process.env.SMTP_FROM_NAME || 'Blood Donation Portal',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || '',
  },

  googleTranslate: {
    apiKey: process.env.GOOGLE_TRANSLATE_API_KEY || '',
  },

  // Local Flask/XGBoost service (see ml/app.py) -- not a secret, just a local
  // same-machine URL, so no "configured or not" gate like the other
  // integrations. ai-prediction.service.js falls back to a heuristic if this
  // is unreachable, so it's safe to leave running or not.
  ml: {
    serviceUrl: process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001',
  },

  isSmtpConfigured() {
    return Boolean(process.env.SMTP_USER) && !String(process.env.SMTP_USER).includes('your_');
  },

  isTwilioConfigured() {
    return Boolean(
      this.twilio.accountSid &&
        this.twilio.authToken &&
        (this.twilio.fromNumber || this.twilio.messagingServiceSid)
    );
  },

  isTranslateConfigured() {
    return Boolean(this.googleTranslate.apiKey) && !this.googleTranslate.apiKey.includes('your_');
  },
};

module.exports = { env, requireEnv };
