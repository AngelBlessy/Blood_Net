import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RegisterValues } from './schemas';
import type { FlowResult } from './types';
import { apiPost, apiPostForm, apiErrorMessage } from '@/lib/api';
import { toFormData } from '@/lib/to-form-data';

const OTP_VALIDITY_MS = 10 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 30 * 1000;

interface PendingRegistration {
  email: string;
  phone: string;
  role: RegisterValues['role'];
  expiresAt: number;
  resendAt: number;
}

interface RegistrationResult extends FlowResult {
  accountCreated: boolean;
}

export function useRegistration() {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingRegistration | null>(null);

  async function submitRegistration(values: RegisterValues): Promise<RegistrationResult> {
    const email = values.email.trim().toLowerCase();
    const phone = values.phone.trim();

    try {
      // Hospital/bloodbank carry a license document, so those roles submit as
      // multipart/form-data; donor registration has no file and stays JSON.
      const result =
        values.role === 'hospital' || values.role === 'bloodbank'
          ? await apiPostForm<{ ok: boolean; message: string }>('/auth/register', toFormData(values))
          : await apiPost<{ ok: boolean; message: string }>('/auth/register', values);
      setPending({
        email,
        phone,
        role: values.role,
        expiresAt: Date.now() + OTP_VALIDITY_MS,
        resendAt: Date.now() + OTP_RESEND_DELAY_MS,
      });
      return { ok: result.ok, accountCreated: true, message: result.message };
    } catch (error) {
      return { ok: false, accountCreated: false, message: apiErrorMessage(error, t('errSomethingWentWrong')) };
    }
  }

  async function verifyOtp(code: string): Promise<FlowResult> {
    if (!pending) return { ok: false, message: t('errRequestNewOtp') };
    try {
      await apiPost('/auth/verify-otp', { email: pending.email, phone: pending.phone, otp: code });
      setPending(null);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error, t('otpInvalidShort')) };
    }
  }

  async function resendOtp(): Promise<FlowResult> {
    if (!pending) return { ok: false, message: t('errRestartRegistration') };
    try {
      const result = await apiPost<{ ok: boolean; message: string }>('/auth/resend-otp', {
        email: pending.email,
        phone: pending.phone,
      });
      setPending((prev) => (prev ? { ...prev, resendAt: Date.now() + OTP_RESEND_DELAY_MS } : prev));
      return { ok: result.ok, message: result.message };
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error, t('errOtpSendFailed')) };
    }
  }

  function reset() {
    setPending(null);
  }

  return { pending, submitRegistration, verifyOtp, resendOtp, reset };
}
