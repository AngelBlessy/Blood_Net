import { z } from 'zod';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import i18n from '@/i18n';

const passwordSchema = z
  .string()
  .min(8, { error: () => i18n.t('errPasswordMinLength') })
  .regex(/(?=.*[A-Za-z])(?=.*\d)/, { error: () => i18n.t('errPasswordComplexity') });

// Letters and spaces only -- no digits or symbols. Applies to name/city/state,
// which (unlike email/password) never legitimately need special characters.
const NAME_PATTERN = /^[A-Za-z\s]+$/;

// Matches the server's multer config (server/middleware/upload.js).
const ALLOWED_LICENSE_DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_LICENSE_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

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

    // bloodbank-only
    bankName: z.string().trim().optional(),
    contactNumber: z.string().trim().optional(),

    // shared hospital/bloodbank registration proof
    licenseNumber: z.string().trim().optional(),
    licenseDocument: z.instanceof(File).optional(),

    // shared location fields
    address: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errPasswordsMismatch'), path: ['confirmPassword'] });
    }

    if (values.name && !NAME_PATTERN.test(values.name)) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errNameInvalidChars'), path: ['name'] });
    }
    if (values.city && !NAME_PATTERN.test(values.city)) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errCityInvalidChars'), path: ['city'] });
    }
    if (values.state && !NAME_PATTERN.test(values.state)) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errStateInvalidChars'), path: ['state'] });
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
      if (!values.state) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errStateRequired'), path: ['state'] });
      }
    }

    if (values.role === 'hospital' && !values.hospitalName) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errHospitalNameRequired'), path: ['hospitalName'] });
    }

    if (values.role === 'bloodbank' && !values.bankName) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errBankNameRequired'), path: ['bankName'] });
    }

    if (values.role === 'hospital' || values.role === 'bloodbank') {
      if (!values.state) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errStateRequired'), path: ['state'] });
      }
      if (!values.licenseNumber) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errLicenseNumberRequired'), path: ['licenseNumber'] });
      }
      if (!values.licenseDocument) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errLicenseDocumentRequired'), path: ['licenseDocument'] });
      } else if (!ALLOWED_LICENSE_DOCUMENT_TYPES.has(values.licenseDocument.type)) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errLicenseDocumentType'), path: ['licenseDocument'] });
      } else if (values.licenseDocument.size > MAX_LICENSE_DOCUMENT_SIZE_BYTES) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errLicenseDocumentSize'), path: ['licenseDocument'] });
      }
    }
  });

export type RegisterValues = z.infer<typeof registerSchema>;
export type RegisterInput = z.input<typeof registerSchema>;

// For a rejected hospital/bloodbank fixing its details pre-login. The
// license document is optional here (unlike registration) -- the server
// keeps the previously uploaded one if a new file isn't attached.
export const resubmitRegistrationSchema = z
  .object({
    role: z.enum(['hospital', 'bloodbank']),
    hospitalName: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
    licenseNumber: z.string().trim().min(1, { error: () => i18n.t('errLicenseNumberRequired') }),
    licenseDocument: z.instanceof(File).optional(),
    address: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    contactNumber: z.string().trim().optional(),
    otp: z.string().regex(/^\d{6}$/, { error: () => i18n.t('errOtpFormat') }),
  })
  .superRefine((values, ctx) => {
    if (values.city && !NAME_PATTERN.test(values.city)) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errCityInvalidChars'), path: ['city'] });
    }
    if (values.state && !NAME_PATTERN.test(values.state)) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errStateInvalidChars'), path: ['state'] });
    }
    if (values.role === 'hospital' && !values.hospitalName) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errHospitalNameRequired'), path: ['hospitalName'] });
    }
    if (values.role === 'bloodbank' && !values.bankName) {
      ctx.addIssue({ code: 'custom', message: i18n.t('errBankNameRequired'), path: ['bankName'] });
    }
    if (values.licenseDocument) {
      if (!ALLOWED_LICENSE_DOCUMENT_TYPES.has(values.licenseDocument.type)) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errLicenseDocumentType'), path: ['licenseDocument'] });
      } else if (values.licenseDocument.size > MAX_LICENSE_DOCUMENT_SIZE_BYTES) {
        ctx.addIssue({ code: 'custom', message: i18n.t('errLicenseDocumentSize'), path: ['licenseDocument'] });
      }
    }
  });

export type ResubmitRegistrationValues = z.infer<typeof resubmitRegistrationSchema>;
export type ResubmitRegistrationInput = z.input<typeof resubmitRegistrationSchema>;

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
