import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RegisterValues } from './schemas';
import type { FlowResult } from './types';
import { createOtpRecord, createPasswordRecord, hashOtp, type OtpRecord } from '@/lib/crypto';
import { sendOtp, otpFailureMessage } from '@/lib/api';
import { useUsersStore } from '@/store/users-store';
import type { User } from '@/types/domain';

interface PendingRegistrationOtp extends OtpRecord {
  userKey: string;
}

interface RegistrationResult extends FlowResult {
  accountCreated: boolean;
}

export function useRegistration() {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingRegistrationOtp | null>(null);
  const upsertUser = useUsersStore((state) => state.upsertUser);
  const updateUser = useUsersStore((state) => state.updateUser);
  const findByKey = useUsersStore((state) => state.findByKey);
  const isEmailOrPhoneTaken = useUsersStore((state) => state.isEmailOrPhoneTaken);

  async function sendRegistrationOtp(user: User): Promise<FlowResult> {
    const target = `${user.email}:${user.phone}`;
    const { otp, record } = await createOtpRecord(target, 'register');
    setPending({ ...record, userKey: user.key });

    const [emailDelivery, smsDelivery] = await Promise.all([
      sendOtp({ channel: 'email', target: user.email, otp }),
      sendOtp({ channel: 'sms', target: user.phone, otp }),
    ]);

    if (!emailDelivery.delivered || !smsDelivery.delivered) {
      return {
        ok: false,
        message: otpFailureMessage(!emailDelivery.delivered && 'email', !smsDelivery.delivered && 'SMS'),
      };
    }
    return { ok: true, message: t('registerToast') };
  }

  async function submitRegistration(values: RegisterValues): Promise<RegistrationResult> {
    const email = values.email.trim().toLowerCase();
    const phone = values.phone.trim();
    if (isEmailOrPhoneTaken(email, phone)) {
      return { ok: false, accountCreated: false, message: t('duplicateUser') };
    }

    const passwordRecord = await createPasswordRecord(values.password);
    const user: User = {
      key: `donor:${email}`,
      role: 'Donor',
      name: values.name.trim(),
      age: values.age,
      phone,
      email,
      ...passwordRecord,
      bloodGroup: values.bloodGroup,
      donatedEver: values.donatedEver,
      lastDonationDate: values.donatedEver === 'yes' && values.lastDonationDate ? values.lastDonationDate : 'N/A',
      emailVerified: false,
      phoneVerified: false,
      traveling: false,
    };
    upsertUser(user);

    const otpResult = await sendRegistrationOtp(user);
    return { ...otpResult, accountCreated: true };
  }

  async function verifyOtp(code: string): Promise<FlowResult> {
    if (!pending) return { ok: false, message: t('errRequestNewOtp') };
    if (Date.now() > pending.expiresAt) return { ok: false, message: t('otpExpired') };
    const hash = await hashOtp(code, pending.salt, pending.target, 'register');
    if (hash !== pending.hash) return { ok: false, message: t('otpInvalidShort') };

    updateUser(pending.userKey, { emailVerified: true, phoneVerified: true });
    setPending(null);
    return { ok: true };
  }

  async function resendOtp(): Promise<FlowResult> {
    if (!pending) return { ok: false, message: t('errRestartRegistration') };
    const user = findByKey(pending.userKey);
    if (!user) return { ok: false, message: t('errRestartRegistration') };
    return sendRegistrationOtp(user);
  }

  function reset() {
    setPending(null);
  }

  return { pending, submitRegistration, verifyOtp, resendOtp, reset };
}
