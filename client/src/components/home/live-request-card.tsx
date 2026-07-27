import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { apiErrorMessage } from '@/lib/api';
import { EmergencyRequestDialog } from './emergency-request-dialog';
import type { HospitalRequest } from '@/types/domain';

const DEMO_DONORS = [
  { initial: 'A', name: 'Arjun M.', noteKey: 'aiProbHigh', score: 94 },
  { initial: 'R', name: 'Rahul S.', noteKey: 'aiProbHigh', score: 88 },
  { initial: 'K', name: 'Kavya N.', noteKey: 'aiProbMedium', score: 74 },
] as const;

const RAISED_BY_LABEL_KEY: Record<HospitalRequest['raisedBy'], 'raisedByHospitalLabel' | 'raisedByBloodBankLabel' | 'raisedByDonorLabel' | 'raisedByGuestLabel'> = {
  hospital: 'raisedByHospitalLabel',
  bloodbank: 'raisedByBloodBankLabel',
  donor: 'raisedByDonorLabel',
  guest: 'raisedByGuestLabel',
};

function LiveRequestEntry({ request }: { request: HospitalRequest }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>();
  const notifyDonors = useHospitalRequestsStore((state) => state.notifyDonors);

  async function handleNotify() {
    setStatus(t('notifyingDonorsStatus'));
    try {
      const result = await notifyDonors(request.id);
      setStatus(result.message);
      toast[result.ok ? 'success' : 'error'](result.message);
    } catch (error) {
      const message = apiErrorMessage(error, t('errAlertSendFailed'));
      setStatus(message);
      toast.error(message);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="font-display text-lg font-semibold">
          {t('liveRequestHeading', { patient: request.patient, bloodGroup: request.bloodGroup })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('liveRequestSummary', { count: request.units, priority: request.priority })}
        </p>
        <p className="mt-1 text-sm font-semibold">
          {t('raisedByPrefix')} {t(RAISED_BY_LABEL_KEY[request.raisedBy])}
        </p>
      </div>

      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        {request.matches === 0
          ? t('noCompatibleDonorsNow')
          : t('compatibleDonorsAlerted', { count: request.matches, status: request.status })}
      </p>

      <Button className="w-full" onClick={handleNotify}>
        {t('notifyTop')}
      </Button>
      {status && <p className="text-center text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}

export function LiveRequestCard() {
  const { t } = useTranslation();
  const requests = useHospitalRequestsStore((state) => state.requests);
  const fetchRequests = useHospitalRequestsStore((state) => state.fetchRequests);

  useEffect(() => {
    fetchRequests({ limit: 50 });
  }, [fetchRequests]);

  return (
    <Card className="gap-2 p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {requests.length > 0 ? t('liveRequestsLabel') : t('exampleMatchingLabel')}
        </span>
        <Badge variant="outline" className="gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          {t('liveTag')}
        </Badge>
      </div>

      {requests.length > 0 ? (
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {requests.map((request) => (
            <LiveRequestEntry key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <>
          <div>
            <h2 className="font-display text-xl font-semibold">{t('liveTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('liveDesc')}</p>
          </div>

          <div className="space-y-2">
            {DEMO_DONORS.map((donor) => (
              <div key={donor.name} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {donor.initial}
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-medium">{donor.name}</p>
                    <p className="text-xs text-muted-foreground">{t(donor.noteKey)}</p>
                  </div>
                </div>
                <div className="text-right leading-tight">
                  <p className="text-sm font-semibold">{donor.score}</p>
                  <p className="text-xs text-muted-foreground">{t('priorityScoreLabel')}</p>
                </div>
              </div>
            ))}
          </div>

          <EmergencyRequestDialog className="w-full" />
        </>
      )}
    </Card>
  );
}
