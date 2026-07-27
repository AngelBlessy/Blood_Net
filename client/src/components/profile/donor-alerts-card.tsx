import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useSessionStore } from '@/store/session-store';
import { PRIORITY_LABEL_KEYS, RESPONSE_LABEL_KEYS } from '@/lib/request-labels';
import { apiGet, apiPost, apiErrorMessage } from '@/lib/api';
import type { DonorAlertRequest, DonorResponse } from '@/types/domain';

export function DonorAlertsCard() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const [requests, setRequests] = useState<DonorAlertRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await apiGet<{ requests: DonorAlertRequest[] }>('/donors/me/alerts');
      setRequests(data.requests);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastDonorAlertsLoadError')));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user.role === 'donor') refresh();
  }, [session?.user.role]);

  if (!session || session.user.role !== 'donor') return null;
  const donor = session.user;

  async function handleRespond(requestId: string, response: DonorResponse) {
    try {
      await apiPost(`/hospital-requests/${requestId}/respond`, { response });
      setRequests((prev) => prev.map((request) => (request.id === requestId ? { ...request, myResponse: response } : request)));
      toast.success(t(response === 'Accepted' ? 'toastRequestAccepted' : 'toastRequestDeclined'));
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastDonorResponseError')));
    }
  }

  return (
    <Card className="gap-3 p-6 sm:col-span-2">
      <span className="text-sm font-medium text-primary">{t('donorAlertsEyebrow')}</span>
      <h3 className="font-semibold">{t('donorAlertsTitle')}</h3>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loadingEllipsis')}</p>
      ) : requests.length === 0 ? (
        <EmptyState>{t('noOpenMatches')}</EmptyState>
      ) : (
        <div className="space-y-3">
          {requests.slice(0, 6).map((request) => {
            const completed = request.status === 'Completed';
            return (
              <Card key={request.id} className="gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">{request.patient}</h4>
                    <p className="text-sm text-muted-foreground">
                      {request.bloodGroup} — {t('unitsCount', { count: request.units })} —{' '}
                      {t(PRIORITY_LABEL_KEYS[request.priority])}
                      {request.distanceKm !== null && ` — ${t('distanceAwayLabel', { km: request.distanceKm })}`}
                    </p>
                  </div>
                  {completed && <Badge variant="secondary">{t('statusCompleted')}</Badge>}
                </div>

                {completed ? (
                  <p className="text-sm font-medium">
                    {request.myResponse === 'Accepted' ? t('donationThanksMessage') : t('requestFulfilledMessage')}
                  </p>
                ) : request.myResponse ? (
                  <p className="text-sm font-medium">
                    {t('yourResponseLabel', { response: t(RESPONSE_LABEL_KEYS[request.myResponse]) })}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRespond(request.id, 'Accepted')} disabled={donor.traveling}>
                      {t('acceptButton')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRespond(request.id, 'Declined')}>
                      {t('rejectButton')}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}
