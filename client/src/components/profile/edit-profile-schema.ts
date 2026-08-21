import { z } from 'zod';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';

// Letters and spaces only -- no digits or symbols.
const NAME_PATTERN = /^[A-Za-z\s]+$/;

export const editDonorProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Name must be at least 3 characters.')
    .regex(NAME_PATTERN, 'Name can only contain letters and spaces.'),
  age: z.coerce.number().int().min(1, 'Enter a valid age.').max(120, 'Enter a valid age.'),
  bloodGroup: z.enum(BLOOD_GROUPS, { error: 'Select a blood group.' }),
  city: z
    .string()
    .trim()
    .min(1, 'Enter your city.')
    .regex(NAME_PATTERN, 'City can only contain letters and spaces.'),
  state: z
    .string()
    .trim()
    .min(1, 'Enter your state.')
    .regex(NAME_PATTERN, 'State can only contain letters and spaces.'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number.'),
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

export type EditDonorProfileValues = z.infer<typeof editDonorProfileSchema>;
export type EditDonorProfileInput = z.input<typeof editDonorProfileSchema>;

const otpField = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.');
const emailField = z.string().trim().email('Enter a valid email address.');
const phoneField = z
  .string()
  .trim()
  .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number.');
const contactNumberField = z
  .string()
  .trim()
  .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number.')
  .optional()
  .or(z.literal(''));
const optionalNameField = z
  .string()
  .trim()
  .regex(NAME_PATTERN, 'Can only contain letters and spaces.')
  .optional()
  .or(z.literal(''));

const licenseDocumentField = z.instanceof(File).optional();

export const editHospitalProfileSchema = z.object({
  hospitalName: z.string().trim().min(1, 'Enter the hospital name.'),
  licenseNumber: z.string().trim().min(1, 'Enter the hospital license number.'),
  licenseDocument: licenseDocumentField,
  address: z.string().trim().optional().or(z.literal('')),
  city: optionalNameField,
  state: optionalNameField,
  lat: z.number().optional(),
  lng: z.number().optional(),
  contactNumber: contactNumberField,
  email: emailField,
  phone: phoneField,
  otp: otpField,
});

export type EditHospitalProfileValues = z.infer<typeof editHospitalProfileSchema>;
export type EditHospitalProfileInput = z.input<typeof editHospitalProfileSchema>;

export const editBloodBankProfileSchema = z.object({
  bankName: z.string().trim().min(1, 'Enter the blood bank name.'),
  licenseNumber: z.string().trim().min(1, 'Enter the blood bank license/registration number.'),
  licenseDocument: licenseDocumentField,
  address: z.string().trim().optional().or(z.literal('')),
  city: optionalNameField,
  state: optionalNameField,
  lat: z.number().optional(),
  lng: z.number().optional(),
  contactNumber: contactNumberField,
  email: emailField,
  phone: phoneField,
  otp: otpField,
});

export type EditBloodBankProfileValues = z.infer<typeof editBloodBankProfileSchema>;
export type EditBloodBankProfileInput = z.input<typeof editBloodBankProfileSchema>;

export const editAdminProfileSchema = z.object({
  email: emailField,
  phone: phoneField,
  otp: otpField,
});

export type EditAdminProfileValues = z.infer<typeof editAdminProfileSchema>;
export type EditAdminProfileInput = z.input<typeof editAdminProfileSchema>;
