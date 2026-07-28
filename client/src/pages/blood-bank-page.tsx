import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InventoryForm } from '@/components/blood-bank/inventory-form';
import { InventoryGrid } from '@/components/blood-bank/inventory-grid';
import { HospitalRequestCard } from '@/components/hospital/hospital-request-card';
import { RaiseRequestForm } from '@/components/hospital/raise-request-form';
import { useInventoryStore } from '@/store/inventory-store';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';

export function BloodBankPage() {
  const { t } = useTranslation();
  const [raiseOpen, setRaiseOpen] = useState(false);
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

      <Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
        <DialogTrigger asChild>
          <Button className="mt-8">{t('raiseRequestButton')}</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('raiseRequestTitle')}</DialogTitle>
          </DialogHeader>
          <RaiseRequestForm onSubmitted={() => setRaiseOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card className="gap-2 p-6">
          <span className="text-sm font-medium text-primary">{t('inventoryUpdateEyebrow')}</span>
          <h2 className="text-lg font-semibold">{t('inventoryUpdateTitle')}</h2>
          <InventoryForm />
        </Card>

        <Card className="gap-2 p-6">
          <span className="text-sm font-medium text-primary">{t('liveStockEyebrow')}</span>
          <h2 className="text-lg font-semibold">{t('liveStockTitle')}</h2>
          <InventoryGrid />
        </Card>
      </div>

      <Card className="mt-6 gap-2 p-6">
        <span className="text-sm font-medium text-primary">{t('liveTrackingEyebrow')}</span>
        <h2 className="text-lg font-semibold">{t('requestStatusTitle')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
