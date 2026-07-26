import { z } from 'zod';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import i18n from '@/i18n';

export const inventorySchema = z.object({
  group: z.enum(BLOOD_GROUPS, { error: () => i18n.t('errBloodGroupRequired') }),
  units: z.coerce.number().int().min(0, { error: () => i18n.t('errUnitsNonNegative') }),
  expiry: z.string().min(1, { error: () => i18n.t('errExpiryRequired') }),
  location: z.string().trim().min(1, { error: () => i18n.t('errLocationRequired') }),
});

export type InventoryValues = z.infer<typeof inventorySchema>;
export type InventoryInput = z.input<typeof inventorySchema>;
