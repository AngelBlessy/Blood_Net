import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { apiGet, apiErrorMessage } from '@/lib/api';
import i18n from '@/i18n';
import type { DonorSummary } from '@/types/domain';

export function DonationHistoryCard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DonorSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DonorSummary>('/donors/me/summary')
      .then(setSummary)
      .catch((error) => toast.error(apiErrorMessage(error, t('toastDonationHistoryLoadError'))))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) {
    return (
      <Card className="gap-2 p-6">
        <h3 className="font-semibold">{t('donationHistoryTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('loadingEllipsisShort')}</p>
      </Card>
    );
  }
  if (!summary) return null;

  return (
    <Card className="gap-3 p-6 sm:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('donationHistoryTitle')}</h3>
        {summary.badgeLevel && <Badge>{t('donorLevelBadge', { level: summary.badgeLevel })}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">{t('totalDonationsLabel')}</p>
          <p className="text-lg font-semibold">{summary.totalDonations}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('eligibilityLabel')}</p>
          <p className="text-lg font-semibold">
            {summary.eligibility.eligible
              ? t('eligibleNowLabel')
              : t('eligibleInDaysLabel', { days: summary.eligibility.daysRemaining })}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('nextBadgeLabel')}</p>
          <p className="text-lg font-semibold">{nextBadgeLabel(summary.totalDonations)}</p>
        </div>
      </div>

      {summary.donations.length === 0 ? (
        <EmptyState>{t('noDonationsYet')}</EmptyState>
      ) : (
        <div className="space-y-2">
          {summary.donations.map((donation) => (
            <div key={donation.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{new Date(donation.donationDate).toLocaleDateString()}</span>
              <span className="text-muted-foreground">{t('unitsCount', { count: donation.unitsDonated })}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function nextBadgeLabel(totalDonations: number): string {
  if (totalDonations < 1) return i18n.t('badgeFirstDropAt1');
  if (totalDonations < 5) return i18n.t('badgeSilverProgress', { remaining: 5 - totalDonations });
  if (totalDonations < 10) return i18n.t('badgeGoldProgress', { remaining: 10 - totalDonations });
  if (totalDonations < 25) return i18n.t('badgePlatinumProgress', { remaining: 25 - totalDonations });
  return i18n.t('badgePlatinumReached');
}
