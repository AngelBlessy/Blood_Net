import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { HospitalRequest } from '@/types/domain';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { useSessionStore } from '@/store/session-store';
import { PRIORITY_LABEL_KEYS, RESPONSE_LABEL_KEYS } from '@/lib/request-labels';
import { apiErrorMessage } from '@/lib/api';

interface HospitalRequestCardProps {
  request: HospitalRequest;
  showActions?: boolean;
  // Lets a blood bank that accepted (but didn't raise) this request close it
  // out once fulfilled, without exposing the raiser-only notify/edit
  // controls that showActions gates. The server enforces this too (see
  // canCloseAsRespondingBank in hospital-requests.controller.js) — this is
  // just what keeps the button off the card when it would 403 anyway.
  canComplete?: boolean;
}

export function HospitalRequestCard({ request, showActions = false, canComplete = false }: HospitalRequestCardProps) {
  const { t } = useTranslation();
  const updateRequest = useHospitalRequestsStore((state) => state.updateRequest);
  const notifyDonors = useHospitalRequestsStore((state) => state.notifyDonors);
  const notifyAllDonors = useHospitalRequestsStore((state) => state.notifyAllDonors);
  const isHospital = useSessionStore((state) => state.session?.user.role === 'hospital');
  const [editOpen, setEditOpen] = useState(false);
  const [patientDraft, setPatientDraft] = useState(request.patient);
  const [unitsDraft, setUnitsDraft] = useState(String(request.units));
  const [notifying, setNotifying] = useState(false);
  const [notifyingAll, setNotifyingAll] = useState(false);

  async function handleNotify() {
    setNotifying(true);
    try {
      const result = await notifyDonors(request.id);
      toast[result.ok ? 'success' : 'error'](result.message);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('errAlertSendFailed')));
    } finally {
      setNotifying(false);
    }
  }

  async function handleNotifyAll() {
    setNotifyingAll(true);
    try {
      const result = await notifyAllDonors(request.id);
      toast[result.ok ? 'success' : 'error'](result.message);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('errAlertSendFailed')));
    } finally {
      setNotifyingAll(false);
    }
  }

  async function handleSaveEdit() {
    const units = Number(unitsDraft);
    const updates: { patient?: string; units?: number } = {};
    if (patientDraft.trim()) updates.patient = patientDraft.trim();
    if (Number.isInteger(units) && units > 0) updates.units = units;
    try {
      await updateRequest(request.id, updates);
      setEditOpen(false);
      toast.success(t('toastRequestUpdated'));
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastRequestUpdateError')));
    }
  }

  async function handleComplete() {
    try {
      await updateRequest(request.id, { status: 'Completed' });
      toast.success(t('toastRequestCompleted'));
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastRequestCompleteError')));
    }
  }

  return (
    <Card className="gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">{request.patient}</h4>
          <p className="text-sm text-muted-foreground">
            {t('requestSummaryLine', {
              bloodGroup: request.bloodGroup,
              units: request.units,
              matches: request.matches,
            })}
          </p>
          {request.contactName && request.contactPhone && (
            <p className="text-xs text-muted-foreground">
              {t('contactRequesterLabel', { name: request.contactName, phone: request.contactPhone })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {request.status === 'Completed' ? t('statusCompleted') : request.status} —{' '}
            {new Date(request.createdAt).toLocaleString()}
          </p>
          {request.raisedBy === 'guest' && (
            <p className="text-xs text-muted-foreground">
              {t('raisedByGuestLine', {
                name: [request.guestName, request.guestPhone ? `(${request.guestPhone})` : null]
                  .filter(Boolean)
                  .join(' '),
              })}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={request.status === 'Completed' ? 'secondary' : 'outline'}>
            {t(PRIORITY_LABEL_KEYS[request.priority])}
          </Badge>
          {request.raisedBy === 'guest' && (
            <Badge variant="destructive" className="text-[10px]">
              {t('guestRequestBadge')}
            </Badge>
          )}
        </div>
      </div>

      {request.responses.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('responsesLabel')}{' '}
          {request.responses
            .map((entry) => {
              const contact = entry.response === 'Accepted' && entry.donorPhone ? ` (${entry.donorPhone})` : '';
              return `${entry.donorName}${contact}: ${t(RESPONSE_LABEL_KEYS[entry.response])}`;
            })
            .join(' — ')}
        </p>
      )}

      {request.bankResponses.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('bankResponsesLabel')}{' '}
          {request.bankResponses
            .map((entry) => {
              const contact = entry.response === 'Accepted' && entry.bankPhone ? ` (${entry.bankPhone})` : '';
              return `${entry.bankName}${contact}: ${t(RESPONSE_LABEL_KEYS[entry.response])}`;
            })
            .join(' — ')}
        </p>
      )}

      {(showActions || canComplete) && (
        <div className="mt-1 flex flex-wrap gap-2">
          {showActions && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={handleNotify} disabled={notifying}>
              {notifying ? t('notifyingEllipsis') : t('requestDonorsLink')}
            </Button>
          )}
          {showActions && isHospital && request.status !== 'Completed' && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-destructive"
              onClick={handleNotifyAll}
              disabled={notifyingAll}
              title={t('notifyAllDonorsHint')}
            >
              {notifyingAll ? t('notifyingEllipsis') : t('notifyAllDonorsLink')}
            </Button>
          )}
          {showActions && (
            <Button variant="link" size="sm" className="h-auto gap-1 p-0" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3" /> {t('editLink')}
            </Button>
          )}
          {request.status !== 'Completed' && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={handleComplete}>
              {t('markCompleted')}
            </Button>
          )}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('editRequestTitle')}</DialogTitle>
            <DialogDescription>{t('editRequestDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-patient">{t('fieldPatientCase')}</Label>
              <Input id="edit-patient" value={patientDraft} onChange={(e) => setPatientDraft(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-units">{t('fieldUnits')}</Label>
              <Input
                id="edit-units"
                type="number"
                min={1}
                value={unitsDraft}
                onChange={(e) => setUnitsDraft(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit}>{t('saveChanges')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
