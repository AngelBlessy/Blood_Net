import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { HospitalRequestCard } from '@/components/hospital/hospital-request-card';
import { useUsersStore } from '@/store/users-store';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { useInventoryStore, LOW_STOCK_THRESHOLD } from '@/store/inventory-store';

export function AdminPage() {
  const { t } = useTranslation();
  const donorCount = useUsersStore((state) => state.users.length);
  const requests = useHospitalRequestsStore((state) => state.requests);
  const inventory = useInventoryStore((state) => state.items);

  const openRequests = requests.filter((request) => request.status !== 'Completed');
  const lowStock = inventory.filter((item) => item.units < LOW_STOCK_THRESHOLD);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader eyebrow={t('adminEyebrow')} title={t('adminTitle')} description={t('adminDesc')} />

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label={t('statDonorsRegistered')} value={donorCount} />
        <StatCard label={t('statOpenEmergencies')} value={openRequests.length} />
        <StatCard label={t('statLowStockGroups')} value={lowStock.length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <span className="text-sm font-medium text-primary">{t('adminAlertsEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('adminAlertsTitle')}</h2>
          <div className="space-y-3">
            {lowStock.length === 0 ? (
              <EmptyState>{t('adminAllStocked')}</EmptyState>
            ) : (
              lowStock.map((item) => (
                <Card key={item.group} className="flex-row items-center justify-between gap-3 p-4">
                  <div>
                    <h4 className="font-semibold">{t('adminGroupLow', { group: item.group })}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('adminUnitsInLocation', { units: item.units, location: item.location })}
                    </p>
                  </div>
                  <Badge variant="destructive">{t('adminActionBadge')}</Badge>
                </Card>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <span className="text-sm font-medium text-primary">{t('adminActivityEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('adminActivityTitle')}</h2>
          <div className="space-y-3">
            {requests.length === 0 ? (
              <EmptyState>{t('adminNoRequests')}</EmptyState>
            ) : (
              requests.slice(0, 6).map((request) => <HospitalRequestCard key={request.id} request={request} />)
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
