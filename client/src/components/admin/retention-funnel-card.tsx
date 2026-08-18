import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import type { AdminAnalytics } from '@/types/domain';

type RetentionLabelKey =
  | 'adminRetentionRegistered'
  | 'adminRetentionOnce'
  | 'adminRetentionAgain'
  | 'adminRetentionLoyal';

interface Stage {
  labelKey: RetentionLabelKey;
  count: number;
  color: string;
}

export function RetentionFunnelCard({ retention }: { retention: AdminAnalytics['retention'] }) {
  const { t } = useTranslation();
  const base = retention.registered;

  const stages: Stage[] = [
    { labelKey: 'adminRetentionRegistered', count: retention.registered, color: 'var(--chart-1)' },
    { labelKey: 'adminRetentionOnce', count: retention.donatedOnce, color: 'var(--chart-3)' },
    { labelKey: 'adminRetentionAgain', count: retention.donatedAgain, color: 'var(--chart-5)' },
    { labelKey: 'adminRetentionLoyal', count: retention.loyalDonors, color: 'var(--chart-7)' },
  ];

  return (
    <Card className="gap-3 p-6">
      <h2 className="text-lg font-semibold">{t('adminRetentionTitle')}</h2>
      <p className="-mt-2 text-sm text-muted-foreground">{t('adminRetentionDesc')}</p>

      {base === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t('adminRetentionEmpty')}
        </p>
      ) : (
        <div className="space-y-3 pt-1">
          {stages.map((stage) => {
            const pct = base > 0 ? Math.round((stage.count / base) * 100) : 0;
            return (
              <div key={stage.labelKey}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-medium">{t(stage.labelKey)}</span>
                  <span className="text-muted-foreground">
                    {t('adminRetentionCountPct', { count: stage.count, pct })}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: stage.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
