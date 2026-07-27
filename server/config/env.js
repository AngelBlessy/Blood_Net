require('dotenv').config();

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
