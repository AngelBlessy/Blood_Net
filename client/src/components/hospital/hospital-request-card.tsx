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
import { useUsersStore } from '@/store/users-store';
import { useNotifyDonors } from '@/hooks/use-notify-donors';
import { PRIORITY_LABEL_KEYS, RESPONSE_LABEL_KEYS } from '@/lib/request-labels';

interface HospitalRequestCardProps {
  request: HospitalRequest;
  showActions?: boolean;
}

export function HospitalRequestCard({ request, showActions = false }: HospitalRequestCardProps) {
  const { t } = useTranslation();
  const updateRequest = useHospitalRequestsStore((state) => state.updateRequest);
  const users = useUsersStore((state) => state.users);
  const { notifyDonorsForRequest } = useNotifyDonors();
  const [editOpen, setEditOpen] = useState(false);
  const [patientDraft, setPatientDraft] = useState(request.patient);
  const [unitsDraft, setUnitsDraft] = useState(String(request.units));
  const [notifying, setNotifying] = useState(false);

  const responseEntries = Object.entries(request.responses || {});

  async function handleNotify() {
    setNotifying(true);
    const result = await notifyDonorsForRequest(request);
    setNotifying(false);
    toast[result.ok ? 'success' : 'error'](result.message);
  }

  function handleSaveEdit() {
    const units = Number(unitsDraft);
    const updates: Partial<HospitalRequest> = {};
    if (patientDraft.trim()) updates.patient = patientDraft.trim();
    if (Number.isInteger(units) && units > 0) updates.units = units;
    updateRequest(request.id, updates);
    setEditOpen(false);
    toast.success(t('toastRequestUpdated'));
  }

  function handleComplete() {
    updateRequest(request.id, { status: 'Completed' });
    toast.success(t('toastRequestCompleted'));
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
            {request.status === 'Completed' ? t('statusCompleted') : request.status} — {request.createdAt}
          </p>
        </div>
        <Badge variant={request.status === 'Completed' ? 'secondary' : 'outline'}>
          {t(PRIORITY_LABEL_KEYS[request.priority])}
        </Badge>
      </div>

      {responseEntries.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('responsesLabel')}{' '}
          {responseEntries
            .map(([key, response]) => {
              const user = users.find((entry) => entry.key === key);
              return `${user?.name || user?.email || key}: ${t(RESPONSE_LABEL_KEYS[response])}`;
            })
            .join(' — ')}
        </p>
      )}

      {showActions && (
        <div className="mt-1 flex flex-wrap gap-2">
          <Button variant="link" size="sm" className="h-auto p-0" onClick={handleNotify} disabled={notifying}>
            {notifying ? t('notifyingEllipsis') : t('requestDonorsLink')}
          </Button>
          <Button variant="link" size="sm" className="h-auto gap-1 p-0" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3" /> {t('editLink')}
          </Button>
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
