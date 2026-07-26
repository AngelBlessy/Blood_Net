import type { DonorResponse, RequestPriority } from '@/types/domain';
import type en from '@/i18n/locales/en.json';

type TranslationKey = keyof typeof en;

export const PRIORITY_LABEL_KEYS: Record<RequestPriority, TranslationKey> = {
  Critical: 'priorityCritical',
  Urgent: 'priorityUrgent',
  Routine: 'priorityRoutine',
};

export const RESPONSE_LABEL_KEYS: Record<DonorResponse, TranslationKey> = {
  Accepted: 'responseAccepted',
  Declined: 'responseDeclined',
};
