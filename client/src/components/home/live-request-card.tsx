import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { apiErrorMessage } from '@/lib/api';
import { EmergencyRequestDialog } from './emergency-request-dialog';

const DEMO_DONORS = [
  { initial: 'A', name: 'Arjun M.', note: 'AI prob: High', score: 94 },
  { initial: 'R', name: 'Rahul S.', note: 'AI prob: High', score: 88 },
  { initial: 'K', name: 'Kavya N.', note: 'AI prob: Medium', score: 74 },
];

export function LiveRequestCard() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>();
  const request = useHospitalRequestsStore((state) => state.requests[0]);
  const fetchRequests = useHospitalRequestsStore((state) => state.fetchRequests);
  const notifyDonors = useHospitalRequestsStore((state) => state.notifyDonors);

  useEffect(() => {
    fetchRequests({ limit: 1 });
  }, [fetchRequests]);

  async function handleNotify() {
    if (!request) return;
    setStatus('Sending details to matched donors…');
    try {
      const result = await notifyDonors(request.id);
      setStatus(result.message);
      toast[result.ok ? 'success' : 'error'](result.message);
    } catch (error) {
      const message = apiErrorMessage(error, 'Something went wrong sending alerts.');
      setStatus(message);
      toast.error(message);
    }
  }

  return (
    <Card className="gap-4 p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {request ? 'Live request' : 'Example — how matching works'}
        </span>
        <Badge variant="outline" className="gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          {t('liveTag')}
        </Badge>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold">
          {request ? `${request.patient} — ${request.bloodGroup} blood` : t('liveTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {request
            ? `${request.units} unit${request.units === 1 ? '' : 's'} needed — ${request.priority} priority`
            : t('liveDesc')}
        </p>
      </div>

      <div className="space-y-2">
        {request ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {request.matches === 0
              ? 'No compatible registered donors are available right now.'
              : `${request.matches} compatible donor${request.matches === 1 ? '' : 's'} matched and alerted — ${request.status}`}
          </p>
        ) : (
          DEMO_DONORS.map((donor) => (
            <div key={donor.name} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {donor.initial}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-medium">{donor.name}</p>
                  <p className="text-xs text-muted-foreground">{donor.note}</p>
                </div>
              </div>
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold">{donor.score}</p>
                <p className="text-xs text-muted-foreground">Priority</p>
              </div>
            </div>
          ))
        )}
      </div>

      {request ? (
        <>
          <Button className="w-full" onClick={handleNotify}>
            {t('notifyTop')}
          </Button>
          {status && <p className="text-center text-xs text-muted-foreground">{status}</p>}
        </>
      ) : (
        <EmergencyRequestDialog className="w-full" />
      )}
    </Card>
  );
}
