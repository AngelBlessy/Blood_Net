import { z } from 'zod';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import i18n from '@/i18n';

export const raiseRequestSchema = z.object({
  patient: z.string().trim().min(1, { error: () => i18n.t('errPatientRequired') }),
  bloodGroup: z.enum(BLOOD_GROUPS, { error: () => i18n.t('errBloodGroupRequired') }),
  units: z.coerce.number().int().min(1, { error: () => i18n.t('errUnitsMin') }),
  priority: z.enum(['Critical', 'Urgent', 'Routine'], { error: () => i18n.t('errPriorityRequired') }),
  contactName: z.string().trim().min(1, { error: () => i18n.t('errContactNameRequired') }),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, { error: () => i18n.t('errPhoneInvalid') }),
});

export type RaiseRequestValues = z.infer<typeof raiseRequestSchema>;
export type RaiseRequestInput = z.input<typeof raiseRequestSchema>;
