const dns = require('node:dns');
const http = require('node:http');
const { createApp } = require('./app');
const { env } = require('./config/env');
const { connectDb } = require('./db/connect');
const { startEligibilityReminderJob } = require('./jobs/eligibility-reminder.job');
const { startEscalationJob } = require('./jobs/escalation.job');
const { initSocket } = require('./realtime/socket');

// Some local dev setups (VPN clients, security software) install a DNS proxy
// stub at 127.0.0.1 and register it as Node's nameserver without actually
// running it, breaking the SRV/TXT lookups mongodb+srv:// needs even though
// the OS resolver works fine. Deployed environments (Fly.io) aren't affected,
// so this only kicks in outside production.
if (env.nodeEnv !== 'production' && dns.getServers().every((server) => server === '127.0.0.1')) {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
}

async function main() {
  await connectDb();
  console.log(`MongoDB connected: ${env.mongodbUri}`);

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(env.port, '0.0.0.0', () => {
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
