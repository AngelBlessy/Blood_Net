import { z } from 'zod';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';

export const guestRequestSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.'),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number.'),
  patient: z.string().trim().min(1, 'Enter a patient / hospital reference.'),
  bloodGroup: z.enum(BLOOD_GROUPS, { error: 'Select a blood group.' }),
  units: z.coerce.number().int().min(1, 'Units must be at least 1.'),
  priority: z.enum(['Critical', 'Urgent', 'Routine'], { error: 'Select a priority.' }),
});

export type GuestRequestValues = z.infer<typeof guestRequestSchema>;
export type GuestRequestInput = z.input<typeof guestRequestSchema>;
