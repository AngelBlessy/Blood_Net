import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InventoryForm } from '@/components/blood-bank/inventory-form';
import { InventoryGrid } from '@/components/blood-bank/inventory-grid';
import { IncomingRequestCard } from '@/components/blood-bank/incoming-request-card';
import { HospitalRequestCard } from '@/components/hospital/hospital-request-card';
import { RaiseRequestForm } from '@/components/hospital/raise-request-form';
import { useInventoryStore } from '@/store/inventory-store';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import type { HospitalRequest } from '@/types/domain';

// myRequests (raised by this bank) and respondedRequests (raised by someone
// else, accepted by this bank) are fetched independently and can't overlap in
// practice (a bank can't accept its own request), but de-duping by id here
// keeps that an invariant this list doesn't quietly rely on.
function dedupeById(requests: HospitalRequest[]) {
  const seen = new Set<string>();
  return requests.filter((request) => (seen.has(request.id) ? false : (seen.add(request.id), true)));
}

export function BloodBankPage() {
  const { t } = useTranslation();
  const [raiseOpen, setRaiseOpen] = useState(false);
  const fetchItems = useInventoryStore((state) => state.fetchItems);
  const myRequests = useHospitalRequestsStore((state) => state.myRequests);
  const fetchMyRequests = useHospitalRequestsStore((state) => state.fetchMyRequests);
  const incomingRequests = useHospitalRequestsStore((state) => state.incomingRequests);
  const fetchIncomingRequests = useHospitalRequestsStore((state) => state.fetchIncomingRequests);
  const respondedRequests = useHospitalRequestsStore((state) => state.respondedRequests);
  const fetchRespondedRequests = useHospitalRequestsStore((state) => state.fetchRespondedRequests);

  useEffect(() => {
    fetchItems({ mine: true });
    fetchMyRequests();
    fetchIncomingRequests();
    fetchRespondedRequests();
    // Hospital requests raised by others don't push a live update to this
    // account (the server only notifies the raising hospital's room), so
    // poll instead — same fallback pattern as hospital-page.tsx.
    const interval = setInterval(() => {
      fetchIncomingRequests();
      fetchRespondedRequests();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchItems, fetchMyRequests, fetchIncomingRequests, fetchRespondedRequests]);

  // An accepted request (raised by someone else) belongs in the same live
  // tracking / completed split as this bank's own raised requests — it just
  // doesn't get the notify/edit controls, since only the raiser owns those
  // (see showActions below). It also drops out of Incoming requests once
  // accepted: Live tracking is now the one place it's shown as "in
  // progress", so it isn't sitting in both feeds at once.
  const myOwnRequestIds = new Set(myRequests.map((request) => request.id));
  const pendingIncomingRequests = incomingRequests.filter((request) => request.myBankResponse !== 'Accepted');
  const openRequests = dedupeById([
    ...myRequests.filter((request) => request.status !== 'Completed'),
    ...respondedRequests.filter((request) => request.status !== 'Completed'),
  ]);
  const completedRequests = dedupeById([
    ...myRequests.filter((request) => request.status === 'Completed'),
    ...respondedRequests.filter((request) => request.status === 'Completed'),
  ]);

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
        <span className="text-sm font-medium text-primary">{t('incomingRequestsEyebrow')}</span>
        <h2 className="text-lg font-semibold">{t('incomingRequestsTitle')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pendingIncomingRequests.length === 0 ? (
            <EmptyState>{t('noIncomingRequestsYet')}</EmptyState>
          ) : (
            pendingIncomingRequests
              .slice(0, 8)
              .map((request) => <IncomingRequestCard key={request.id} request={request} />)
          )}
        </div>
      </Card>

      <Card className="mt-6 gap-2 p-6">
        <span className="text-sm font-medium text-primary">{t('liveTrackingEyebrow')}</span>
        <h2 className="text-lg font-semibold">{t('requestStatusTitle')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {openRequests.length === 0 ? (
            <EmptyState>{t('noRequestsYet')}</EmptyState>
          ) : (
            openRequests.slice(0, 8).map((request) => {
              const isOwn = myOwnRequestIds.has(request.id);
              return (
                <HospitalRequestCard key={request.id} request={request} showActions={isOwn} canComplete={!isOwn} />
              );
            })
          )}
        </div>
      </Card>

      <Card className="mt-6 gap-2 p-6">
        <span className="text-sm font-medium text-primary">{t('completedRequestsEyebrow')}</span>
        <h2 className="text-lg font-semibold">{t('completedRequestsTitle')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {completedRequests.length === 0 ? (
            <EmptyState>{t('noCompletedRequestsYet')}</EmptyState>
          ) : (
            completedRequests.slice(0, 8).map((request) => <HospitalRequestCard key={request.id} request={request} />)
          )}
        </div>
      </Card>
    </div>
  );
}
