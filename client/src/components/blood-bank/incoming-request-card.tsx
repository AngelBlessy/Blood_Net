import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { useInventoryStore } from '@/store/inventory-store';
import { PRIORITY_LABEL_KEYS } from '@/lib/request-labels';
import { apiErrorMessage } from '@/lib/api';
import type { HospitalRequest } from '@/types/domain';

interface IncomingRequestCardProps {
  request: HospitalRequest;
}

export function IncomingRequestCard({ request }: IncomingRequestCardProps) {
  const { t } = useTranslation();
  const respondAsBloodBank = useHospitalRequestsStore((state) => state.respondAsBloodBank);
  const fetchInventory = useInventoryStore((state) => state.fetchItems);
  const [submitting, setSubmitting] = useState(false);

  async function handleRespond(response: 'Accepted' | 'Declined') {
    setSubmitting(true);
    try {
      await respondAsBloodBank(request.id, response);
      toast.success(response === 'Accepted' ? t('toastBankRequestAccepted') : t('toastBankRequestDeclined'));
      // Accepting deducts from this bank's own stock server-side — refresh so
      // the inventory grid reflects the new count without a manual reload.
      if (response === 'Accepted') fetchInventory({ mine: true });
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastBankResponseError')));
    } finally {
      setSubmitting(false);
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
        </div>
        <Badge variant="outline">{t(PRIORITY_LABEL_KEYS[request.priority])}</Badge>
      </div>

      {request.myBankResponse === 'Accepted' ? (
        <p className="text-sm font-medium">{t('youAcceptedLabel')}</p>
      ) : request.myBankResponse === 'Declined' ? (
        <p className="text-sm font-medium">{t('youDeclinedLabel')}</p>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleRespond('Accepted')} disabled={submitting}>
            {t('acceptButton')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleRespond('Declined')} disabled={submitting}>
            {t('rejectButton')}
          </Button>
        </div>
      )}
    </Card>
  );
}
