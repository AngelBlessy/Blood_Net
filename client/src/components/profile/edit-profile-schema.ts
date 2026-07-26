import { z } from 'zod';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';

export const editDonorProfileSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters.'),
  age: z.coerce.number().int().min(1, 'Enter a valid age.').max(120, 'Enter a valid age.'),
  bloodGroup: z.enum(BLOOD_GROUPS, { error: 'Select a blood group.' }),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number.'),
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

export type EditDonorProfileValues = z.infer<typeof editDonorProfileSchema>;
export type EditDonorProfileInput = z.input<typeof editDonorProfileSchema>;
