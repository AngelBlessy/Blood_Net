import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  editHospitalProfileSchema,
  type EditHospitalProfileInput,
  type EditHospitalProfileValues,
} from './edit-profile-schema';
import { ProfileOtpSection } from './profile-otp-section';
import { useSessionStore } from '@/store/session-store';
import { useProfileEditOtp } from '@/hooks/use-profile-edit-otp';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useRestrictedInput } from '@/hooks/use-restricted-input';
import { apiPatch, apiPatchForm, apiErrorMessage } from '@/lib/api';
import { toFormData } from '@/lib/to-form-data';
import type { HospitalUser, User } from '@/types/domain';
import { MapPin } from 'lucide-react';

interface EditHospitalProfileDialogProps {
  hospital: HospitalUser;
}

export function EditHospitalProfileDialog({ hospital }: EditHospitalProfileDialogProps) {
  const { t } = useTranslation();
  const setUser = useSessionStore((state) => state.setUser);
  const [open, setOpen] = useState(false);
  const otp = useProfileEditOtp('/auth/me/profile/otp');
  const { requestLocation, loading: locating, error: locationError } = useGeolocation();

  const defaults = {
    hospitalName: hospital.hospitalName,
    licenseNumber: hospital.licenseNumber,
    licenseDocument: undefined,
    address: hospital.address ?? '',
    city: hospital.city ?? '',
    state: hospital.state ?? '',
    lat: hospital.coordinates?.lat,
    lng: hospital.coordinates?.lng,
    contactNumber: hospital.contactNumber ?? '',
    email: hospital.email,
    phone: hospital.phone,
    otp: '',
  };

  const form = useForm<EditHospitalProfileInput, unknown, EditHospitalProfileValues>({
    resolver: zodResolver(editHospitalProfileSchema),
    defaultValues: defaults,
  });

  const hasCoordinates = form.watch('lat') !== undefined && form.watch('lng') !== undefined;

  const cityGuard = useRestrictedInput('alpha');
  const stateGuard = useRestrictedInput('alpha');
  const contactNumberGuard = useRestrictedInput('numeric');
  const phoneGuard = useRestrictedInput('numeric');

  async function handleUseLocation() {
    const coords = await requestLocation();
    if (coords) {
      form.setValue('lat', coords.lat);
      form.setValue('lng', coords.lng);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      form.reset(defaults);
      otp.reset();
    }
  }

  async function onSubmit(values: EditHospitalProfileValues) {
    try {
      const data = values.licenseDocument
        ? await apiPatchForm<{ ok: boolean; user: User }>('/auth/me/profile', toFormData(values))
        : await apiPatch<{ ok: boolean; user: User }>('/auth/me/profile', values);
      setUser(data.user);
      toast.success(t('toastProfileUpdated'));
      handleOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastProfileUpdateError')));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="size-3.5" /> {t('editProfileButton')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editProfileTitle')}</DialogTitle>
          <DialogDescription>{t('editProfileDesc')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="hospitalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t('fieldHospitalNameLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="licenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t('fieldLicenseNumberLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fieldAddressLabel')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fieldCityLabel')}</FormLabel>
                    <FormControl>
                      <Input {...field} onKeyDown={cityGuard.onKeyDown} onPaste={cityGuard.onPaste} />
                    </FormControl>
                    {cityGuard.warning && <p className="text-xs text-destructive">{cityGuard.warning}</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleUseLocation}
                disabled={locating}
              >
                <MapPin className="size-3.5" />
                {locating ? t('locatingEllipsis') : t('useMyLocationButton')}
              </Button>
              {hasCoordinates && <span className="text-xs text-muted-foreground">{t('locationCapturedText')}</span>}
              {locationError && <span className="text-xs text-destructive">{locationError}</span>}
            </div>

            <FormField
              control={form.control}
              name="contactNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fieldContactNumberLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t('fieldEmailLabel')}</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t('fieldLoginPhoneLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        autoComplete="tel"
                        {...field}
                        onKeyDown={phoneGuard.onKeyDown}
                        onPaste={phoneGuard.onPaste}
                      />
                    </FormControl>
                    {phoneGuard.warning && <p className="text-xs text-destructive">{phoneGuard.warning}</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <ProfileOtpSection
              control={form.control}
              otpFieldName="otp"
              phone={hospital.phone}
              email={hospital.email}
              otpSent={otp.otpSent}
              onSendCode={otp.sendCode}
              resendCountdown={otp.resendCountdown}
            />

            <Button type="submit" className="w-full" disabled={!otp.otpSent || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('savingEllipsis') : t('saveButton')}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
