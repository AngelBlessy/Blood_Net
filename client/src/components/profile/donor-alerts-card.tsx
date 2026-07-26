import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useSessionStore } from '@/store/session-store';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { eligibleDonorsFor } from '@/lib/donor-matching';
import { PRIORITY_LABEL_KEYS, RESPONSE_LABEL_KEYS } from '@/lib/request-labels';
import type { DonorResponse } from '@/types/domain';

export function DonorAlertsCard() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const requests = useHospitalRequestsStore((state) => state.requests);
  const recordResponse = useHospitalRequestsStore((state) => state.recordResponse);

  if (!session) return null;
  const donor = session.user;

  const openMatches = requests.filter(
    (request) =>
      request.status !== 'Completed' && eligibleDonorsFor([donor], request.bloodGroup).length > 0
  );

  function handleRespond(requestId: string, response: DonorResponse) {
    recordResponse(requestId, donor!.key, response);
    toast.success(t(response === 'Accepted' ? 'toastRequestAccepted' : 'toastRequestDeclined'));
  }

  return (
    <Card className="gap-3 p-6 sm:col-span-2">
      <span className="text-sm font-medium text-primary">{t('donorAlertsEyebrow')}</span>
      <h3 className="font-semibold">{t('donorAlertsTitle')}</h3>

      {openMatches.length === 0 ? (
        <EmptyState>{t('noOpenMatches')}</EmptyState>
      ) : (
        <div className="space-y-3">
          {openMatches.slice(0, 6).map((request) => {
            const response = request.responses?.[donor.key];
            return (
              <Card key={request.id} className="gap-2 p-4">
                <h4 className="font-semibold">{request.patient}</h4>
                <p className="text-sm text-muted-foreground">
                  {request.bloodGroup} — {t('unitsCount', { count: request.units })} —{' '}
                  {t(PRIORITY_LABEL_KEYS[request.priority])}
                </p>
                {response ? (
                  <p className="text-sm font-medium">
                    {t('yourResponseLabel', { response: t(RESPONSE_LABEL_KEYS[response]) })}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRespond(request.id, 'Accepted')}>
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
