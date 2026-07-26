import { useState } from 'react';
import { apiPost, apiErrorMessage } from '@/lib/api';
import type { GuestRequestValues } from './guest-request-schema';
import type { FlowResult } from '@/components/auth/types';
import type { HospitalRequest } from '@/types/domain';

const OTP_VALIDITY_MS = 10 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 30 * 1000;

interface PendingGuestRequest extends GuestRequestValues {
  expiresAt: number;
  resendAt: number;
}

export function useGuestRequest() {
  const [pending, setPending] = useState<PendingGuestRequest | null>(null);

  async function requestOtp(values: GuestRequestValues): Promise<FlowResult> {
    try {
      const result = await apiPost<{ ok: boolean; message: string }>('/guest-requests/otp', values);
      setPending({ ...values, expiresAt: Date.now() + OTP_VALIDITY_MS, resendAt: Date.now() + OTP_RESEND_DELAY_MS });
      return { ok: result.ok, message: result.message };
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error, 'Something went wrong sending the code.') };
    }
  }

  async function resendOtp(): Promise<FlowResult> {
    if (!pending) return { ok: false, message: 'Please start again.' };
    try {
      const result = await apiPost<{ ok: boolean; message: string }>('/guest-requests/otp', pending);
      setPending((prev) => (prev ? { ...prev, resendAt: Date.now() + OTP_RESEND_DELAY_MS } : prev));
      return { ok: result.ok, message: result.message };
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error, 'Something went wrong sending the code.') };
    }
  }

  async function verifyAndSubmit(otp: string): Promise<FlowResult> {
    if (!pending) return { ok: false, message: 'Please start again.' };
    try {
      const result = await apiPost<{ ok: boolean; message: string; request: HospitalRequest }>('/guest-requests', {
        ...pending,
        otp,
      });
      setPending(null);
      return { ok: result.ok, message: result.message };
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error, 'Invalid code.') };
    }
  }

  function reset() {
    setPending(null);
  }

  return { pending, requestOtp, resendOtp, verifyAndSubmit, reset };
}
