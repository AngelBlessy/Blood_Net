import type en from '@/i18n/locales/en.json';

export type IdentifierChannel = 'email' | 'sms';

export interface ResolvedIdentifier {
  target: string;
  channel: IdentifierChannel;
  label: keyof typeof en;
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function resolveIdentifier(value: string): ResolvedIdentifier | null {
  const raw = value.trim();
  const email = raw.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { target: email, channel: 'email', label: 'emailAddressLabel' };
  }
  const phone = normalizePhone(raw);
  if (/^\d{10}$/.test(phone)) {
    return { target: phone, channel: 'sms', label: 'mobileNumberLabel' };
  }
  return null;
}
