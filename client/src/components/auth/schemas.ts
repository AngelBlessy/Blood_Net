import { z } from 'zod';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .regex(/(?=.*[A-Za-z])(?=.*\d)/, 'Password must include a letter and a number.');

export const ROLE_OPTIONS = [
  { value: 'donor', label: 'Donor' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'bloodbank', label: 'Blood Bank' },
] as const;

export type RegisterRole = (typeof ROLE_OPTIONS)[number]['value'];

export const registerSchema = z
  .object({
    role: z.enum(['donor', 'hospital', 'bloodbank']),
    email: z.string().trim().email('Enter a valid email address.'),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number.'),
    password: passwordSchema,
    confirmPassword: z.string(),

    // donor-only
    name: z.string().trim().optional(),
    age: z.coerce.number().optional(),
    donatedEver: z.enum(['yes', 'no']).optional(),
    lastDonationDate: z.string().optional(),
    bloodGroup: z.enum(BLOOD_GROUPS).optional(),

    // hospital-only
    hospitalName: z.string().trim().optional(),
    licenseNumber: z.string().trim().optional(),

    // bloodbank-only
    bankName: z.string().trim().optional(),
    contactNumber: z.string().trim().optional(),

    // shared by hospital/bloodbank
    address: z.string().trim().optional(),
    city: z.string().trim().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({ code: 'custom', message: 'Passwords do not match.', path: ['confirmPassword'] });
    }

    if (values.role === 'donor') {
      if (!values.name || values.name.length < 3) {
        ctx.addIssue({ code: 'custom', message: 'Name must be at least 3 characters.', path: ['name'] });
      }
      if (!Number.isInteger(values.age) || (values.age as number) < 1 || (values.age as number) > 120) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid age.', path: ['age'] });
      }
      if (!values.donatedEver) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select whether you have donated before.',
          path: ['donatedEver'],
        });
      }
      if (values.donatedEver === 'yes' && !values.lastDonationDate) {
        ctx.addIssue({ code: 'custom', message: 'Select your last donation date.', path: ['lastDonationDate'] });
      }
      if (
        values.donatedEver === 'yes' &&
        values.lastDonationDate &&
        new Date(`${values.lastDonationDate}T00:00:00`) > new Date()
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Last donation date cannot be in the future.',
          path: ['lastDonationDate'],
        });
      }
      if (!values.bloodGroup) {
        ctx.addIssue({ code: 'custom', message: 'Select a blood group.', path: ['bloodGroup'] });
      }
    }

    if (values.role === 'hospital') {
      if (!values.hospitalName) {
        ctx.addIssue({ code: 'custom', message: 'Enter the hospital name.', path: ['hospitalName'] });
      }
      if (!values.licenseNumber) {
        ctx.addIssue({ code: 'custom', message: 'Enter the hospital license number.', path: ['licenseNumber'] });
      }
    }

    if (values.role === 'bloodbank' && !values.bankName) {
      ctx.addIssue({ code: 'custom', message: 'Enter the blood bank name.', path: ['bankName'] });
    }
  });

export type RegisterValues = z.infer<typeof registerSchema>;
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Enter your registered email or mobile number.'),
    otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const otpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP.'),
});

export type OtpValues = z.infer<typeof otpSchema>;
