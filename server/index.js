const http = require('node:http');
const { createApp } = require('./app');
const { env } = require('./config/env');
const { connectDb } = require('./db/connect');
const { startEligibilityReminderJob } = require('./jobs/eligibility-reminder.job');
const { startEscalationJob } = require('./jobs/escalation.job');
const { initSocket } = require('./realtime/socket');

async function main() {
  await connectDb();
  console.log(`MongoDB connected: ${env.mongodbUri}`);

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`BloodNet server running at http://localhost:${env.port}`);
    console.log('SMTP (email OTP/alerts):', env.isSmtpConfigured() ? 'configured' : 'not configured');
    console.log('Twilio (SMS OTP/alerts):', env.isTwilioConfigured() ? 'configured' : 'not configured');
  });

  startEligibilityReminderJob();
  startEscalationJob();
}

main().catch((error) => {
  console.error('Failed to start BloodNet server:', error);
  process.exit(1);
});
