const { createApp } = require('./app');
const { env } = require('./config/env');
const { connectDb } = require('./db/connect');
const { startEligibilityReminderJob } = require('./jobs/eligibility-reminder.job');

async function main() {
  await connectDb();
  console.log(`MongoDB connected: ${env.mongodbUri}`);

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`BloodNet server running at http://localhost:${env.port}`);
    console.log('SMTP (email OTP/alerts):', env.isSmtpConfigured() ? 'configured' : 'not configured');
    console.log('Twilio (SMS OTP/alerts):', env.isTwilioConfigured() ? 'configured' : 'not configured');
  });

  startEligibilityReminderJob();
}

main().catch((error) => {
  console.error('Failed to start BloodNet server:', error);
  process.exit(1);
});
