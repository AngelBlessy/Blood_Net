import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { HospitalRequestCard } from '@/components/hospital/hospital-request-card';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';

export function MyRaisedRequestsCard() {
  const { t } = useTranslation();
  const myRequests = useHospitalRequestsStore((state) => state.myRequests);
  const fetchMyRequests = useHospitalRequestsStore((state) => state.fetchMyRequests);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  return (
    <Card className="gap-3 p-6 sm:col-span-2">
      <span className="text-sm font-medium text-primary">{t('liveTrackingEyebrow')}</span>
      <h3 className="font-semibold">{t('requestStatusTitle')}</h3>
      <div className="space-y-3">
        {myRequests.length === 0 ? (
          <EmptyState>{t('noRequestsYet')}</EmptyState>
        ) : (
          myRequests.slice(0, 8).map((request) => <HospitalRequestCard key={request.id} request={request} showActions />)
        )}
      </div>
    </Card>
  );
}
