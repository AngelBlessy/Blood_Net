import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  resubmitRegistrationSchema,
  type ResubmitRegistrationInput,
  type ResubmitRegistrationValues,
} from './schemas';
import { ProfileOtpSection } from '@/components/profile/profile-otp-section';
import { useProfileEditOtp } from '@/hooks/use-profile-edit-otp';
import { useRestrictedInput } from '@/hooks/use-restricted-input';
import { apiPostForm, apiErrorMessage } from '@/lib/api';
import { toFormData } from '@/lib/to-form-data';

interface ResubmitRegistrationFormProps {
  email: string;
  phone: string;
  role: 'hospital' | 'bloodbank';
  rejectionReason: string | null;
  onSubmitted: (message: string) => void;
  onCancel: () => void;
}

export function ResubmitRegistrationForm({
  email,
  phone,
  role,
  rejectionReason,
  onSubmitted,
  onCancel,
}: ResubmitRegistrationFormProps) {
  const { t } = useTranslation();
  const otp = useProfileEditOtp('/auth/resubmit/request-otp', { email });

  const form = useForm<ResubmitRegistrationInput, unknown, ResubmitRegistrationValues>({
    resolver: zodResolver(resubmitRegistrationSchema),
    defaultValues: {
      role,
      hospitalName: '',
      bankName: '',
      licenseNumber: '',
      licenseDocument: undefined,
      address: '',
      city: '',
      state: '',
      contactNumber: '',
      otp: '',
    },
  });

  const cityGuard = useRestrictedInput('alpha');
  const stateGuard = useRestrictedInput('alpha');
  const contactNumberGuard = useRestrictedInput('numeric');

  async function onSubmit(values: ResubmitRegistrationValues) {
    try {
      const result = await apiPostForm<{ ok: boolean; message: string }>(
        '/auth/resubmit',
        toFormData({ ...values, email })
      );
      onSubmitted(result.message);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('errSomethingWentWrong')));
    }
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      {rejectionReason && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {t('rejectionReasonLabel', { reason: rejectionReason })}
        </p>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {role === 'hospital' ? (
            <FormField
              control={form.control}
              name="hospitalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t('fieldHospitalName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('hospitalNamePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t('fieldBankName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('bankNamePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="licenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('fieldLicenseNumber')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('licenseNumberPlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="licenseDocument"
            render={({ field: { value, onChange, ref, name, onBlur } }) => (
              <FormItem>
                <FormLabel>{t('fieldLicenseDocument')}</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    name={name}
                    ref={ref}
                    onBlur={onBlur}
                    onChange={(e) => onChange(e.target.files?.[0])}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  {value ? t('licenseDocumentSelectedLabel', { name: value.name }) : t('licenseDocumentReplaceHint')}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fieldCity')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('cityPlaceholder')}
                      {...field}
                      onKeyDown={cityGuard.onKeyDown}
                      onPaste={cityGuard.onPaste}
                    />
                  </FormControl>
                  {cityGuard.warning && <p className="text-xs text-destructive">{cityGuard.warning}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fieldState')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('statePlaceholder')}
                      {...field}
                      onKeyDown={stateGuard.onKeyDown}
                      onPaste={stateGuard.onPaste}
                    />
                  </FormControl>
                  {stateGuard.warning && <p className="text-xs text-destructive">{stateGuard.warning}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fieldAddress')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('addressPlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {role === 'bloodbank' && (
            <FormField
              control={form.control}
              name="contactNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fieldBankContactNumber')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('bankContactNumberPlaceholder')}
                      {...field}
                      onKeyDown={contactNumberGuard.onKeyDown}
                      onPaste={contactNumberGuard.onPaste}
                    />
                  </FormControl>
                  {contactNumberGuard.warning && <p className="text-xs text-destructive">{contactNumberGuard.warning}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <ProfileOtpSection
            control={form.control}
            otpFieldName="otp"
            phone={phone}
            email={email}
            otpSent={otp.otpSent}
            onSendCode={otp.sendCode}
            resendCountdown={otp.resendCountdown}
          />

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={!otp.otpSent || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('savingEllipsis') : t('resubmitForReviewButton')}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('cancelButton')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
