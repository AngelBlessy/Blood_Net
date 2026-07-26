import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createOtpRecord, createPasswordRecord, hashOtp, type OtpRecord } from '@/lib/crypto';
import { sendOtp, otpFailureMessage } from '@/lib/api';
import { resolveIdentifier } from '@/lib/identifier';
import { useUsersStore } from '@/store/users-store';
import type { FlowResult } from './types';

export function useForgotPassword() {
  const { t } = useTranslation();
  const [pending, setPending] = useState<OtpRecord | null>(null);
  const users = useUsersStore((state) => state.users);
  const updateUser = useUsersStore((state) => state.updateUser);

  async function requestOtp(identifierInput: string): Promise<FlowResult> {
    const identifier = resolveIdentifier(identifierInput);
    if (!identifier) {
      return { ok: false, message: t('errIdentifierInvalid') };
    }

    const hasAccount = users.some((user) =>
      identifier.channel === 'email' ? user.email === identifier.target : user.phone === identifier.target
    );
    if (!hasAccount) {
      return { ok: false, message: t('toastNoAccountFor', { label: t(identifier.label) }) };
    }

    const { otp, record } = await createOtpRecord(identifier.target, 'forgot-password');
    setPending(record);
    const delivery = await sendOtp({ channel: identifier.channel, target: identifier.target, otp });
    if (!delivery.delivered) {
      setPending(null);
      return { ok: false, message: otpFailureMessage(identifier.channel === 'email' ? 'email' : 'SMS') };
    }

    return {
      ok: true,
      message: t('otpSentTo', { label: t(identifier.label) }),
    };
  }

  async function resetPassword(identifierInput: string, otp: string, newPassword: string): Promise<FlowResult> {
    const identifier = resolveIdentifier(identifierInput);
    if (!identifier) {
      return { ok: false, message: t('errIdentifierInvalid') };
    }
    if (!pending) return { ok: false, message: t('errRequestResetOtpFirst') };
    if (Date.now() > pending.expiresAt) return { ok: false, message: t('otpExpired') };

    const hash = await hashOtp(otp, pending.salt, identifier.target, 'forgot-password');
    if (hash !== pending.hash) return { ok: false, message: t('errInvalidResetOtp') };

    const user = users.find((entry) =>
      identifier.channel === 'email' ? entry.email === identifier.target : entry.phone === identifier.target
    );
    if (!user) return { ok: false, message: t('toastNoAccount') };

    updateUser(user.key, await createPasswordRecord(newPassword));
    setPending(null);
    return { ok: true, message: t('passwordResetSuccess') };
  }

  function reset() {
    setPending(null);
  }

  return { pending, requestOtp, resetPassword, reset };
}
