import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { raiseRequestSchema, type RaiseRequestInput, type RaiseRequestValues } from './schemas';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { useSessionStore } from '@/store/session-store';
import { PRIORITY_LABEL_KEYS } from '@/lib/request-labels';
import { apiErrorMessage } from '@/lib/api';
import { useRestrictedInput } from '@/hooks/use-restricted-input';
import type { RequestPriority, User } from '@/types/domain';

const PRIORITIES: RequestPriority[] = ['Critical', 'Urgent', 'Routine'];

interface RaiseRequestFormProps {
  defaultPriority?: RequestPriority;
  submitLabel?: string;
  onSubmitted?: () => void;
}

function deriveContactDefaults(user: User | undefined): { contactName: string; contactPhone: string } {
  if (!user) return { contactName: '', contactPhone: '' };
  if (user.role === 'hospital') return { contactName: user.hospitalName, contactPhone: user.contactNumber || user.phone };
  if (user.role === 'bloodbank') return { contactName: user.bankName, contactPhone: user.contactNumber || user.phone };
  if (user.role === 'donor') return { contactName: user.name, contactPhone: user.phone };
  return { contactName: '', contactPhone: '' };
}

export function RaiseRequestForm({ defaultPriority = 'Critical', submitLabel, onSubmitted }: RaiseRequestFormProps) {
  const { t } = useTranslation();
  const createRequest = useHospitalRequestsStore((state) => state.createRequest);
  const session = useSessionStore((state) => state.session);
  const contactDefaults = deriveContactDefaults(session?.user);
  // Radix's Select silently keeps showing the last-picked item after
  // form.reset() sets the field back to undefined (controlled -> uncontrolled
  // switch it doesn't visually recover from) — forcing a full remount via a
  // changing key is the reliable fix.
  const [resetKey, setResetKey] = useState(0);

  const contactNameGuard = useRestrictedInput('alpha');
  const contactPhoneGuard = useRestrictedInput('numeric');

  const form = useForm<RaiseRequestInput, unknown, RaiseRequestValues>({
    resolver: zodResolver(raiseRequestSchema),
    defaultValues: {
      patient: '',
      bloodGroup: undefined,
      units: 1,
      priority: defaultPriority,
      contactName: contactDefaults.contactName,
      contactPhone: contactDefaults.contactPhone,
    },
  });

  async function onSubmit(values: RaiseRequestValues) {
    try {
      const result = await createRequest(values);
      form.reset({
        patient: '',
        bloodGroup: undefined,
        units: 1,
        priority: defaultPriority,
        contactName: contactDefaults.contactName,
        contactPhone: contactDefaults.contactPhone,
      });
      setResetKey((key) => key + 1);
      onSubmitted?.();
      toast[result.ok ? 'success' : 'error'](result.message);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('errRaiseRequestFailed')));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="patient"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>{t('fieldPatientCase')}</FormLabel>
              <FormControl>
                <Input placeholder={t('patientPlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('fieldContactName')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('contactNamePlaceholder')}
                    autoComplete="name"
                    {...field}
                    onKeyDown={contactNameGuard.onKeyDown}
                    onPaste={contactNameGuard.onPaste}
                  />
                </FormControl>
                {contactNameGuard.warning && <p className="text-xs text-destructive">{contactNameGuard.warning}</p>}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('fieldContactPhone')}</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder={t('phonePlaceholder')}
                    autoComplete="tel"
                    {...field}
                    onKeyDown={contactPhoneGuard.onKeyDown}
                    onPaste={contactPhoneGuard.onPaste}
                  />
                </FormControl>
                {contactPhoneGuard.warning && <p className="text-xs text-destructive">{contactPhoneGuard.warning}</p>}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="bloodGroup"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('fieldBloodGroup')}</FormLabel>
                <Select key={`bloodGroup-${resetKey}`} onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('selectBloodGroupPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BLOOD_GROUPS.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="units"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('fieldUnits')}</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} value={(field.value as number | string | undefined) ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>{t('fieldPriority')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {t(PRIORITY_LABEL_KEYS[priority])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('sendingEllipsis') : submitLabel ?? t('findAndNotifyDonors')}
        </Button>
      </form>
    </Form>
  );
}
