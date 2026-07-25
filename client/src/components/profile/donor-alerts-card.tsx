import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useSessionStore } from '@/store/session-store';
import { apiGet, apiPost, apiErrorMessage } from '@/lib/api';
import type { DonorAlertRequest, DonorResponse } from '@/types/domain';

export function DonorAlertsCard() {
  const session = useSessionStore((state) => state.session);
  const [requests, setRequests] = useState<DonorAlertRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await apiGet<{ requests: DonorAlertRequest[] }>('/donors/me/alerts');
      setRequests(data.requests);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not load your emergency alerts.'));
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
      toast.success(`Emergency request ${response.toLowerCase()}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not record your response.'));
    }
  }

  return (
    <Card className="gap-3 p-6 sm:col-span-2">
      <span className="text-sm font-medium text-primary">Emergency alerts</span>
      <h3 className="font-semibold">Requests you can respond to</h3>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState>No compatible emergency requests yet.</EmptyState>
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
                      {request.bloodGroup} — {request.units} unit{request.units === 1 ? '' : 's'} — {request.priority}
                    </p>
                  </div>
                  {completed && <Badge variant="secondary">Completed</Badge>}
                </div>

                {completed ? (
                  <p className="text-sm font-medium">
                    {request.myResponse === 'Accepted'
                      ? 'You donated for this request. Thank you!'
                      : 'This request has been fulfilled.'}
                  </p>
                ) : request.myResponse ? (
                  <p className="text-sm font-medium">Your response: {request.myResponse}</p>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRespond(request.id, 'Accepted')} disabled={donor.traveling}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRespond(request.id, 'Declined')}>
                      Reject
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
