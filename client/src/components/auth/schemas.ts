import { z } from 'zod';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import i18n from '@/i18n';

const passwordSchema = z
  .string()
  .min(8, { error: () => i18n.t('errPasswordMinLength') })
  .regex(/(?=.*[A-Za-z])(?=.*\d)/, { error: () => i18n.t('errPasswordComplexity') });

export const registerSchema = z
  .object({
    name: z.string().trim().min(3, { error: () => i18n.t('errNameMinLength') }),
    age: z.coerce
      .number()
      .int()
      .min(1, { error: () => i18n.t('errAgeInvalid') })
      .max(120, { error: () => i18n.t('errAgeInvalid') }),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, { error: () => i18n.t('errPhoneInvalid') }),
    email: z.string().trim().email({ error: () => i18n.t('errEmailInvalid') }),
    password: passwordSchema,
    confirmPassword: z.string(),
    donatedEver: z.enum(['yes', 'no'], { error: () => i18n.t('errDonatedEverRequired') }),
    lastDonationDate: z.string().optional(),
    bloodGroup: z.enum(BLOOD_GROUPS, { error: () => i18n.t('errBloodGroupRequired') }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: () => i18n.t('errPasswordsMismatch'),
    path: ['confirmPassword'],
  })
  .refine((values) => values.donatedEver !== 'yes' || Boolean(values.lastDonationDate), {
    error: () => i18n.t('errLastDonationDateRequired'),
    path: ['lastDonationDate'],
  })
  .refine(
    (values) => {
      if (values.donatedEver !== 'yes' || !values.lastDonationDate) return true;
      return new Date(`${values.lastDonationDate}T00:00:00`) <= new Date();
    },
    { error: () => i18n.t('errLastDonationDateFuture'), path: ['lastDonationDate'] }
  );

export type RegisterValues = z.infer<typeof registerSchema>;
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email({ error: () => i18n.t('errEmailInvalid') }),
  password: z.string().min(1, { error: () => i18n.t('errPasswordRequired') }),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z
  .object({
    identifier: z.string().trim().min(1, { error: () => i18n.t('errIdentifierRequired') }),
    otp: z.string().regex(/^\d{6}$/, { error: () => i18n.t('errOtpFormat') }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: () => i18n.t('errPasswordsMismatch'),
    path: ['confirmPassword'],
  });

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const otpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, { error: () => i18n.t('errOtpFormat') }),
});

export type OtpValues = z.infer<typeof otpSchema>;
