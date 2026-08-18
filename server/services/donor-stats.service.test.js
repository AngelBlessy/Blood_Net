const { computeEligibility, badgeForCount, donationSummary } = require('./donor-stats.service');
const Donation = require('../models/donation.model');
const { createDonor } = require('../test/helpers');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('donor-stats.service', () => {
  describe('computeEligibility', () => {
    it('is eligible with no prior donation', () => {
      expect(computeEligibility(null)).toEqual({ eligible: true, daysRemaining: 0 });
    });

    it('is not eligible the day after donating (90-day rule)', () => {
      const yesterday = new Date(Date.now() - 1 * DAY_MS);
      const result = computeEligibility(yesterday);
      expect(result.eligible).toBe(false);
      expect(result.daysRemaining).toBeGreaterThanOrEqual(88);
      expect(result.daysRemaining).toBeLessThanOrEqual(89);
    });

    it('is eligible again exactly 90+ days after the last donation', () => {
      const ninetyOneDaysAgo = new Date(Date.now() - 91 * DAY_MS);
      expect(computeEligibility(ninetyOneDaysAgo)).toEqual({ eligible: true, daysRemaining: 0 });
    });
  });

  describe('badgeForCount', () => {
    it.each([
      [0, null],
      [1, 'First Drop'],
      [4, 'First Drop'],
      [5, 'Silver'],
      [9, 'Silver'],
      [10, 'Gold'],
      [24, 'Gold'],
      [25, 'Platinum'],
      [100, 'Platinum'],
    ])('count=%i -> %s', (count, expected) => {
      expect(badgeForCount(count)).toBe(expected);
    });
  });

  describe('donationSummary', () => {
    it('returns zero donations and no badge for a donor with none', async () => {
      const { profile } = await createDonor();
      const summary = await donationSummary(profile._id);
      expect(summary).toEqual({ donations: [], badgeLevel: null, totalDonations: 0 });
    });

    it('counts donations, computes the badge, and sorts newest first', async () => {
      const { profile } = await createDonor();
      const older = new Date('2024-01-01');
      const newer = new Date('2024-06-01');
      await Donation.create({ donorId: profile._id, donationDate: older, unitsDonated: 1 });
      await Donation.create({ donorId: profile._id, donationDate: newer, unitsDonated: 1 });

      const summary = await donationSummary(profile._id);
      expect(summary.totalDonations).toBe(2);
      expect(summary.badgeLevel).toBe('First Drop');
      expect(summary.donations[0].donationDate).toEqual(newer);
      expect(summary.donations[1].donationDate).toEqual(older);
    });

    it("only counts the given donor's own donations", async () => {
      const { profile: donorA } = await createDonor();
      const { profile: donorB } = await createDonor();
      await Donation.create({ donorId: donorA._id, donationDate: new Date(), unitsDonated: 1 });
      await Donation.create({ donorId: donorB._id, donationDate: new Date(), unitsDonated: 1 });
      await Donation.create({ donorId: donorB._id, donationDate: new Date(), unitsDonated: 1 });

      expect((await donationSummary(donorA._id)).totalDonations).toBe(1);
      expect((await donationSummary(donorB._id)).totalDonations).toBe(2);
    });
  });
});
