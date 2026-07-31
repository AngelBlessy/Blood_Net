// Mirrors server/services/donor-stats.service.js computeEligibility() — kept
// in sync manually since client/server don't share code. Used here purely
// for instant UI feedback before the network round trip; the server call in
// hospital-requests.controller.js `respond()` is the actual source of truth
// and re-checks this itself.
const ELIGIBILITY_DAYS = 90;

export function computeEligibility(lastDonationDate: string | null): { eligible: boolean; daysRemaining: number } {
  if (!lastDonationDate) return { eligible: true, daysRemaining: 0 };
  const daysSince = (Date.now() - new Date(lastDonationDate).getTime()) / (24 * 60 * 60 * 1000);
  const daysRemaining = Math.max(0, Math.ceil(ELIGIBILITY_DAYS - daysSince));
  return { eligible: daysRemaining === 0, daysRemaining };
}
