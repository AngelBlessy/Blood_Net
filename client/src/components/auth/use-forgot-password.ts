import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost, apiErrorMessage } from '@/lib/api';
import { resolveIdentifier } from '@/lib/identifier';
import type { FlowResult } from './types';

export function useForgotPassword() {
  const { t } = useTranslation();
  const [pending, setPending] = useState<{ identifier: string } | null>(null);

  async function requestOtp(identifierInput: string): Promise<FlowResult> {
    const identifier = resolveIdentifier(identifierInput);
    if (!identifier) {
      return { ok: false, message: t('errIdentifierInvalid') };
    }

    try {
      const result = await apiPost<{ ok: boolean; message: string }>('/auth/forgot-password/request-otp', {
        identifier: identifier.target,
      });
      setPending({ identifier: identifier.target });
      return { ok: result.ok, message: result.message };
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error, 'Something went wrong sending the OTP.') };
    }
  }

  async function resetPassword(identifierInput: string, otp: string, newPassword: string): Promise<FlowResult> {
    const identifier = resolveIdentifier(identifierInput);
    if (!identifier) {
      return { ok: false, message: t('errIdentifierInvalid') };
    }

    try {
      const result = await apiPost<{ ok: boolean; message: string }>('/auth/forgot-password/reset', {
        identifier: identifier.target,
        otp,
        password: newPassword,
      });
      setPending(null);
      return { ok: result.ok, message: result.message };
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error, 'Something went wrong. Please try again.') };
    }
  }

  function reset() {
    setPending(null);
  }

  return { pending, requestOtp, resetPassword, reset };
}
