const cron = require('node-cron');
const DonorProfile = require('../models/donor-profile.model');
const Notification = require('../models/notification.model');
const { sendMail } = require('../services/mailer.service');
const { computeEligibility } = require('../services/donor-stats.service');

const REMINDER_WINDOW_DAYS = 7;
const NOTIFICATION_TITLE = 'You will be eligible to donate soon';
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function runEligibilityReminders() {
  const donors = await DonorProfile.find({ lastDonationDate: { $ne: null } }).populate('userId');
  let sent = 0;

  for (const donor of donors) {
    if (!donor.userId) continue;
    const { daysRemaining } = computeEligibility(donor.lastDonationDate);
    if (daysRemaining !== REMINDER_WINDOW_DAYS) continue;

    const alreadySent = await Notification.findOne({
      userId: donor.userId._id,
      title: NOTIFICATION_TITLE,
      createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    });
    if (alreadySent) continue;

    const message = `You'll be eligible to donate again in ${REMINDER_WINDOW_DAYS} days. Thank you for being a BloodNet donor, ${donor.name}.`;
    await Notification.create({ userId: donor.userId._id, title: NOTIFICATION_TITLE, message });

    try {
      await sendMail({ to: donor.userId.email, subject: NOTIFICATION_TITLE, text: message });
    } catch (error) {
      console.error('Eligibility reminder email failed:', error.message);
    }
    sent += 1;
  }

  if (sent) console.log(`Eligibility reminders sent to ${sent} donor(s).`);
  return sent;
}

function startEligibilityReminderJob() {
  // Run once on boot for demo visibility, then daily at 08:00 server time.
  runEligibilityReminders().catch((error) => console.error('Eligibility reminder job failed:', error));
  cron.schedule('0 8 * * *', () => {
    runEligibilityReminders().catch((error) => console.error('Eligibility reminder job failed:', error));
  });
}

module.exports = { startEligibilityReminderJob, runEligibilityReminders };
