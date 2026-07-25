import { useState } from 'react';
import { toast } from 'sonner';
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
import { apiErrorMessage } from '@/lib/api';

interface HospitalRequestCardProps {
  request: HospitalRequest;
  showActions?: boolean;
}

export function HospitalRequestCard({ request, showActions = false }: HospitalRequestCardProps) {
  const updateRequest = useHospitalRequestsStore((state) => state.updateRequest);
  const notifyDonors = useHospitalRequestsStore((state) => state.notifyDonors);
  const [editOpen, setEditOpen] = useState(false);
  const [patientDraft, setPatientDraft] = useState(request.patient);
  const [unitsDraft, setUnitsDraft] = useState(String(request.units));
  const [notifying, setNotifying] = useState(false);

  async function handleNotify() {
    setNotifying(true);
    try {
      const result = await notifyDonors(request.id);
      toast[result.ok ? 'success' : 'error'](result.message);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Something went wrong sending alerts.'));
    } finally {
      setNotifying(false);
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
      toast.success('Request updated.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not update the request.'));
    }
  }

  async function handleComplete() {
    try {
      await updateRequest(request.id, { status: 'Completed' });
      toast.success('Request marked as completed. Donations logged for donors who accepted.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not complete the request.'));
    }
  }

  return (
    <Card className="gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">{request.patient}</h4>
          <p className="text-sm text-muted-foreground">
            {request.bloodGroup} — {request.units} units — {request.matches} donors notified
          </p>
          <p className="text-xs text-muted-foreground">
            {request.status} — {new Date(request.createdAt).toLocaleString()}
          </p>
          {request.raisedBy === 'guest' && (
            <p className="text-xs text-muted-foreground">
              Raised by guest {request.guestName ? `${request.guestName} ` : ''}
              {request.guestPhone ? `(${request.guestPhone})` : ''} — phone-verified, no hospital account
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={request.status === 'Completed' ? 'secondary' : 'outline'}>{request.priority}</Badge>
          {request.raisedBy === 'guest' && (
            <Badge variant="destructive" className="text-[10px]">
              Guest request
            </Badge>
          )}
        </div>
      </div>

      {request.responses.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Responses: {request.responses.map((entry) => `${entry.donorName}: ${entry.response}`).join(' — ')}
        </p>
      )}

      {showActions && (
        <div className="mt-1 flex flex-wrap gap-2">
          <Button variant="link" size="sm" className="h-auto p-0" onClick={handleNotify} disabled={notifying}>
            {notifying ? 'Notifying…' : 'Request donors'}
          </Button>
          <Button variant="link" size="sm" className="h-auto gap-1 p-0" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3" /> Edit
          </Button>
          {request.status !== 'Completed' && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={handleComplete}>
              Mark completed
            </Button>
          )}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit request</DialogTitle>
            <DialogDescription>Update the patient reference or units needed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-patient">Patient / case reference</Label>
              <Input id="edit-patient" value={patientDraft} onChange={(e) => setPatientDraft(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-units">Units needed</Label>
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
            <Button onClick={handleSaveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
