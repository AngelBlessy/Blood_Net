const { runEligibilityReminders } = require('./eligibility-reminder.job');
const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const { createDonor } = require('../test/helpers');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('runEligibilityReminders', () => {
  it('sends a reminder to a donor becoming eligible within the next 7 days', async () => {
    const { user, profile } = await createDonor({ lastDonationDate: new Date(Date.now() - 85 * DAY_MS) });

    const sent = await runEligibilityReminders();
    expect(sent).toBe(1);

    const notification = await Notification.findOne({ userId: user._id });
    expect(notification).not.toBeNull();
    expect(notification.title).toMatch(/eligible to donate soon/i);
    expect(notification.message).toContain(profile.name);
  });

  it('skips a donor who is already eligible', async () => {
    await createDonor({ lastDonationDate: new Date(Date.now() - 200 * DAY_MS) });
    expect(await runEligibilityReminders()).toBe(0);
  });

  it('skips a donor whose eligibility is more than 7 days away', async () => {
    await createDonor({ lastDonationDate: new Date(Date.now() - 1 * DAY_MS) });
    expect(await runEligibilityReminders()).toBe(0);
  });

  it('skips a donor with no prior donation at all', async () => {
    await createDonor({ lastDonationDate: null });
    expect(await runEligibilityReminders()).toBe(0);
  });

  it('does not send a duplicate reminder within the same day', async () => {
    const { user } = await createDonor({ lastDonationDate: new Date(Date.now() - 85 * DAY_MS) });
    expect(await runEligibilityReminders()).toBe(1);
    expect(await runEligibilityReminders()).toBe(0);
    expect(await Notification.countDocuments({ userId: user._id })).toBe(1);
  });

  it('skips a donor profile whose user account no longer exists, without throwing', async () => {
    const { user, profile } = await createDonor({ lastDonationDate: new Date(Date.now() - 85 * DAY_MS) });
    await User.deleteOne({ _id: user._id });
    profile.userId = user._id; // still points at the now-deleted user

    await expect(runEligibilityReminders()).resolves.toBe(0);
  });
});
