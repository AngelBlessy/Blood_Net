import { z } from 'zod';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import i18n from '@/i18n';

const passwordSchema = z
  .string()
  .min(8, { error: () => i18n.t('errPasswordMinLength') })
  .regex(/(?=.*[A-Za-z])(?=.*\d)/, { error: () => i18n.t('errPasswordComplexity') });

export const ROLE_OPTIONS = [
  { value: 'donor', label: 'Donor' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'bloodbank', label: 'Blood Bank' },
] as const;

export type RegisterRole = (typeof ROLE_OPTIONS)[number]['value'];

export const registerSchema = z
  .object({
    role: z.enum(['donor', 'hospital', 'bloodbank'], { error: () => i18n.t('errRoleRequired') }),
    email: z.string().trim().email({ error: () => i18n.t('errEmailInvalid') }),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, { error: () => i18n.t('errPhoneInvalid') }),
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

    // shared location fields
    address: z.string().trim().optional(),
    city: z.string().trim().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errPasswordsMismatch'), path: ['confirmPassword'] });
    }

    if (values.role === 'donor') {
      if (!values.name || values.name.length < 3) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errNameMinLength'), path: ['name'] });
      }
      if (!Number.isInteger(values.age) || (values.age as number) < 1 || (values.age as number) > 120) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errAgeInvalid'), path: ['age'] });
      }
      if (!values.donatedEver) {
        ctx.addIssue({
          code: 'custom',
          message: i18n.t('errDonatedEverRequired'),
          path: ['donatedEver'],
        });
      }
      if (values.donatedEver === 'yes' && !values.lastDonationDate) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errLastDonationDateRequired'), path: ['lastDonationDate'] });
      }
      if (
        values.donatedEver === 'yes' &&
        values.lastDonationDate &&
        new Date(`${values.lastDonationDate}T00:00:00`) > new Date()
      ) {
        ctx.addIssue({
          code: 'custom',
          message: i18n.t('errLastDonationDateFuture'),
          path: ['lastDonationDate'],
        });
      }
      if (!values.bloodGroup) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errBloodGroupRequired'), path: ['bloodGroup'] });
      }
      if (!values.city) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errCityRequired'), path: ['city'] });
      }
    }

    if (values.role === 'hospital') {
      if (!values.hospitalName) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errHospitalNameRequired'), path: ['hospitalName'] });
      }
      if (!values.licenseNumber) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errLicenseNumberRequired'), path: ['licenseNumber'] });
      }
    }

    if (values.role === 'bloodbank' && !values.bankName) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errBankNameRequired'), path: ['bankName'] });
    }
  });

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
