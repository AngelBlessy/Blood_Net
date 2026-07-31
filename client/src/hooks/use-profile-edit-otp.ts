import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useCountdown } from '@/hooks/use-countdown';
import { apiPost, apiErrorMessage } from '@/lib/api';

export function useProfileEditOtp(otpEndpoint: string) {
  const { t } = useTranslation();
  const [otpSent, setOtpSent] = useState(false);
  const [resendAt, setResendAt] = useState<number>();
  const resendCountdown = useCountdown(resendAt);

  async function sendCode() {
    try {
      const result = await apiPost<{ ok: boolean; message: string }>(otpEndpoint);
      toast.success(result.message);
      setOtpSent(true);
      setResendAt(Date.now() + 30_000);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastVerificationCodeError')));
    }
  }

  function reset() {
    setOtpSent(false);
    setResendAt(undefined);
  }

  return { otpSent, sendCode, reset, resendCountdown };
}
