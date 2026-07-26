import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InventoryForm } from '@/components/blood-bank/inventory-form';
import { InventoryGrid } from '@/components/blood-bank/inventory-grid';
import { HospitalRequestCard } from '@/components/hospital/hospital-request-card';
import { useInventoryStore } from '@/store/inventory-store';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';

export function BloodBankPage() {
  const { t } = useTranslation();
  const fetchItems = useInventoryStore((state) => state.fetchItems);
  const myRequests = useHospitalRequestsStore((state) => state.myRequests);
  const fetchMyRequests = useHospitalRequestsStore((state) => state.fetchMyRequests);

  useEffect(() => {
    fetchItems({ mine: true });
    fetchMyRequests();
  }, [fetchItems, fetchMyRequests]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader eyebrow={t('workspaceEyebrow')} title={t('bloodBankTitle')} description={t('bloodBankDesc')} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <span className="text-sm font-medium text-primary">{t('inventoryUpdateEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('inventoryUpdateTitle')}</h2>
          <InventoryForm />
        </Card>

        <Card className="p-6">
          <span className="text-sm font-medium text-primary">{t('liveStockEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('liveStockTitle')}</h2>
          <InventoryGrid />
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <span className="text-sm font-medium text-primary">{t('liveTrackingEyebrow')}</span>
        <h2 className="mb-4 text-lg font-semibold">{t('requestStatusTitle')}</h2>
        <div className="space-y-3">
          {myRequests.length === 0 ? (
            <EmptyState>{t('noRequestsYet')}</EmptyState>
          ) : (
            myRequests.slice(0, 8).map((request) => (
              <HospitalRequestCard key={request.id} request={request} showActions />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
