import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { RaiseRequestForm } from '@/components/hospital/raise-request-form';
import { HospitalRequestCard } from '@/components/hospital/hospital-request-card';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';

export function HospitalPage() {
  const { t } = useTranslation();
  const requests = useHospitalRequestsStore((state) => state.myRequests);
  const fetchMyRequests = useHospitalRequestsStore((state) => state.fetchMyRequests);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  const openRequests = requests.filter((request) => request.status !== 'Completed');
  const unitsNeeded = openRequests.reduce((total, request) => total + request.units, 0);
  const donorsMatched = openRequests.reduce((total, request) => total + request.matches, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader eyebrow={t('workspaceEyebrow')} title={t('hospitalTitle')} description={t('hospitalDesc')} />

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label={t('statOpenRequests')} value={openRequests.length} />
        <StatCard label={t('statUnitsNeeded')} value={unitsNeeded} />
        <StatCard label={t('statDonorsMatched')} value={donorsMatched} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <span className="text-sm font-medium text-primary">{t('emergencyDeskEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('raiseRequestTitle')}</h2>
          <RaiseRequestForm />
        </Card>

        <Card className="p-6">
          <span className="text-sm font-medium text-primary">{t('liveTrackingEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('requestStatusTitle')}</h2>
          <div className="space-y-3">
            {requests.length === 0 ? (
              <EmptyState>{t('noRequestsYet')}</EmptyState>
            ) : (
              requests.slice(0, 8).map((request) => (
                <HospitalRequestCard key={request.id} request={request} showActions />
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
