import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Building2, Warehouse, Siren, HeartHandshake, Timer, Boxes, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { InsightTile } from '@/components/admin/insight-tile';
import { BloodDemandChart } from '@/components/admin/blood-demand-chart';
import { DonorsByGroupChart } from '@/components/admin/donors-by-group-chart';
import { NetworkTrendChart } from '@/components/admin/network-trend-chart';
import { InventoryLevelsChart } from '@/components/admin/inventory-levels-chart';
import { RequestsByPriorityChart } from '@/components/admin/requests-by-priority-chart';
import { DonorAvailabilityChart } from '@/components/admin/donor-availability-chart';
import { TopHospitalsCard } from '@/components/admin/top-hospitals-card';
import { TopCitiesCard } from '@/components/admin/top-cities-card';
import { RetentionFunnelCard } from '@/components/admin/retention-funnel-card';
import { apiGet } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { formatDurationMinutes } from '@/lib/format-duration';
import type { AdminAnalytics } from '@/types/domain';

const POLL_INTERVAL_MS = 45_000;

export function AdminInsightsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminAnalytics | null>(null);

  const refresh = useCallback(() => {
    apiGet<AdminAnalytics>('/admin/analytics')
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    // Poll as a fallback; the socket listener below is what makes new
    // activity (a signup, a completed donation, a stock update) reflect here
    // within moments instead of up to a minute late.
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const socket = getSocket();
    socket.on('admin:refresh', refresh);
    return () => {
      socket.off('admin:refresh', refresh);
    };
  }, [refresh]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={t('insightsEyebrow')}
        title={t('insightsTitle')}
        description={t('insightsDesc')}
        action={
          <Badge variant="outline" className="gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            {t('liveTag')}
          </Badge>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InsightTile
          label={t('statDonorsRegistered')}
          value={data?.donorCount ?? 0}
          icon={Users}
          color="var(--chart-1)"
        />
        <InsightTile
          label={t('insightsPartnerHospitals')}
          value={data?.hospitalsCount ?? 0}
          icon={Building2}
          color="var(--chart-2)"
        />
        <InsightTile
          label={t('insightsPartnerBloodBanks')}
          value={data?.bloodBanksCount ?? 0}
          icon={Warehouse}
          color="var(--chart-3)"
        />
        <InsightTile
          label={t('statOpenEmergencies')}
          value={data?.openRequests ?? 0}
          icon={Siren}
          color="var(--chart-4)"
        />
        <InsightTile
          label={t('insightsTotalDonations')}
          value={data?.totalDonations ?? 0}
          icon={HeartHandshake}
          color="var(--chart-5)"
        />
        <InsightTile
          label={t('statAvgFulfillmentTime')}
          value={data && data.fulfillment.avgMinutes !== null ? formatDurationMinutes(data.fulfillment.avgMinutes) : '—'}
          icon={Timer}
          color="var(--chart-6)"
        />
        <InsightTile
          label={t('insightsBloodUnitsInStock')}
          value={data?.inventoryLevels.reduce((sum, point) => sum + point.units, 0) ?? 0}
          icon={Boxes}
          color="var(--chart-7)"
        />
        <InsightTile
          label={t('statLowStockGroups')}
          value={data?.lowStockGroups.length ?? 0}
          icon={TriangleAlert}
          color={data && data.lowStockGroups.length > 0 ? 'var(--destructive)' : 'var(--chart-8)'}
        />
      </div>

      <div className="mt-6">
        <NetworkTrendChart />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <DonorsByGroupChart data={data?.donorsByBloodGroup ?? []} />
        <BloodDemandChart data={data?.bloodGroupDemand ?? []} />
        <InventoryLevelsChart data={data?.inventoryLevels ?? []} lowStockGroups={data?.lowStockGroups ?? []} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <RequestsByPriorityChart data={data?.requestsByPriority ?? []} />
        <DonorAvailabilityChart data={data?.donorAvailability ?? { available: 0, traveling: 0, unavailable: 0 }} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <TopCitiesCard data={data?.topCities ?? []} />
        <TopHospitalsCard data={data?.topHospitals ?? []} />
        <RetentionFunnelCard
          retention={data?.retention ?? { registered: 0, donatedOnce: 0, donatedAgain: 0, loyalDonors: 0 }}
        />
      </div>
    </div>
  );
}
