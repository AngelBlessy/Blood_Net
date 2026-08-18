const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

// Runs once for the whole test run, before any test file (or its
// setupFiles) is loaded. This is deliberately the ONLY place that's
// guaranteed to run before server/config/env.js's `dotenv.config()` call --
// dotenv doesn't override variables that are already set in process.env, so
// blanking these here (rather than in setup.js) is what actually stops a
// developer's real local .env (real SMTP/Twilio/Translate credentials) from
// being used during a test run and sending real email/SMS or billing a real
// API key. This matters just as much for CI, where no .env file exists at
// all -- these values would already be unset there, but the blanking keeps
// local and CI runs behaviorally identical rather than relying on that
// difference.
module.exports = async function setup() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-outside-tests';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';
  process.env.TWILIO_ACCOUNT_SID = '';
  process.env.TWILIO_AUTH_TOKEN = '';
  process.env.TWILIO_FROM_NUMBER = '';
  process.env.TWILIO_MESSAGING_SERVICE_SID = '';
  process.env.GOOGLE_TRANSLATE_API_KEY = '';
  // Deliberately left pointing at the default, unreachable-in-CI address --
  // ai-prediction.service.js falls back to its formula on connection
  // failure, which is exactly what we want real, unmocked tests to exercise.
  process.env.ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

  mongod = await MongoMemoryServer.create();
  process.env.MONGO_TEST_URI = mongod.getUri();

  return async function teardown() {
    if (mongod) await mongod.stop();
  };
};
