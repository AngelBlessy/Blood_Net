import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { apiGet, apiErrorMessage } from '@/lib/api';
import type { DonorSummary } from '@/types/domain';

export function DonationHistoryCard() {
  const [summary, setSummary] = useState<DonorSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DonorSummary>('/donors/me/summary')
      .then(setSummary)
      .catch((error) => toast.error(apiErrorMessage(error, 'Could not load donation history.')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="gap-2 p-6">
        <h3 className="font-semibold">Donation history & badges</h3>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }
  if (!summary) return null;

  return (
    <Card className="gap-3 p-6 sm:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Donation history & badges</h3>
        {summary.badgeLevel && <Badge>{summary.badgeLevel} donor</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Total donations</p>
          <p className="text-lg font-semibold">{summary.totalDonations}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Eligibility</p>
          <p className="text-lg font-semibold">
            {summary.eligibility.eligible ? 'Eligible now' : `In ${summary.eligibility.daysRemaining}d`}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Next badge</p>
          <p className="text-lg font-semibold">{nextBadgeLabel(summary.totalDonations)}</p>
        </div>
      </div>

      {summary.donations.length === 0 ? (
        <EmptyState>No donations recorded yet. Your first donation earns the "First Drop" badge.</EmptyState>
      ) : (
        <div className="space-y-2">
          {summary.donations.map((donation) => (
            <div key={donation.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{new Date(donation.donationDate).toLocaleDateString()}</span>
              <span className="text-muted-foreground">
                {donation.unitsDonated} unit{donation.unitsDonated === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function nextBadgeLabel(totalDonations: number): string {
  if (totalDonations < 1) return 'First Drop at 1';
  if (totalDonations < 5) return `Silver at 5 (${5 - totalDonations} to go)`;
  if (totalDonations < 10) return `Gold at 10 (${10 - totalDonations} to go)`;
  if (totalDonations < 25) return `Platinum at 25 (${25 - totalDonations} to go)`;
  return 'Platinum reached';
}
