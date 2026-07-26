import { useTranslation } from 'react-i18next';
import { useUsersStore } from '@/store/users-store';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { eligibleDonorsFor } from '@/lib/donor-matching';
import { sendEmergencyAlerts } from '@/lib/api';
import type { HospitalRequest, User } from '@/types/domain';

interface NotifyResult {
  ok: boolean;
  message: string;
  donors: User[];
}

export function useNotifyDonors() {
  const { t } = useTranslation();
  const users = useUsersStore((state) => state.users);
  const updateRequest = useHospitalRequestsStore((state) => state.updateRequest);

  async function notifyDonorsForRequest(request: HospitalRequest): Promise<NotifyResult> {
    const donors = eligibleDonorsFor(users, request.bloodGroup);

    if (!donors.length) {
      updateRequest(request.id, { matches: 0, status: t('statusNoCompatibleDonors') });
      return { ok: false, message: t('errNoCompatibleDonors'), donors };
    }

    updateRequest(request.id, { status: t('statusSendingAlerts'), matches: donors.length });

    try {
      const result = await sendEmergencyAlerts(
        {
          patient: request.patient,
          bloodGroup: request.bloodGroup,
          units: request.units,
          priority: request.priority,
          contactName: request.contactName,
          contactPhone: request.contactPhone,
        },
        donors.map(({ name, email, phone }) => ({ name, email, phone }))
      );
      updateRequest(request.id, {
        status: t('statusAlertsSent', { emailSent: result.emailSent, smsSent: result.smsSent }),
      });
      return {
        ok: true,
        message: t('toastAlertSentSummary', {
          count: donors.length,
          emailSent: result.emailSent,
          smsSent: result.smsSent,
        }),
        donors,
      };
    } catch (error) {
      console.error('Emergency alert delivery failed:', error instanceof Error ? error.message : error);
      updateRequest(request.id, { status: t('statusAlertFailed') });
      return { ok: false, message: t('errAlertSendFailed'), donors };
    }
  }

  return { notifyDonorsForRequest };
}
