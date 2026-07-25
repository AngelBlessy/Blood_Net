const Donation = require('../models/donation.model');

const ELIGIBILITY_DAYS = 90;

// Derived per BloodDonor-Schema.docx's "Derived Attributes" table — computed
// on read from lastDonationDate / donation count, not stored redundantly.
function computeEligibility(lastDonationDate) {
  if (!lastDonationDate) return { eligible: true, daysRemaining: 0 };
  const daysSince = (Date.now() - new Date(lastDonationDate).getTime()) / (24 * 60 * 60 * 1000);
  const daysRemaining = Math.max(0, Math.ceil(ELIGIBILITY_DAYS - daysSince));
  return { eligible: daysRemaining === 0, daysRemaining };
}

function badgeForCount(count) {
  if (count >= 25) return 'Platinum';
  if (count >= 10) return 'Gold';
  if (count >= 5) return 'Silver';
  if (count >= 1) return 'First Drop';
  return null;
}

async function donationSummary(donorId) {
  const donations = await Donation.find({ donorId }).sort({ donationDate: -1 });
  return { donations, badgeLevel: badgeForCount(donations.length), totalDonations: donations.length };
}

module.exports = { ELIGIBILITY_DAYS, computeEligibility, badgeForCount, donationSummary };
