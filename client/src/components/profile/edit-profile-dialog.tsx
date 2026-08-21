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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { editDonorProfileSchema, type EditDonorProfileInput, type EditDonorProfileValues } from './edit-profile-schema';
import { ProfileOtpSection } from './profile-otp-section';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import { useSessionStore } from '@/store/session-store';
import { useProfileEditOtp } from '@/hooks/use-profile-edit-otp';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useRestrictedInput } from '@/hooks/use-restricted-input';
import { apiPatch, apiErrorMessage } from '@/lib/api';
import type { DonorUser, User } from '@/types/domain';
import { MapPin } from 'lucide-react';

interface EditProfileDialogProps {
  donor: DonorUser;
}

export function EditProfileDialog({ donor }: EditProfileDialogProps) {
  const { t } = useTranslation();
  const setUser = useSessionStore((state) => state.setUser);
  const [open, setOpen] = useState(false);
  const otp = useProfileEditOtp('/donors/me/profile/otp');
  const { requestLocation, loading: locating, error: locationError } = useGeolocation();

  const form = useForm<EditDonorProfileInput, unknown, EditDonorProfileValues>({
    resolver: zodResolver(editDonorProfileSchema),
    defaultValues: {
      name: donor.name,
      age: donor.age,
      bloodGroup: donor.bloodGroup,
      city: donor.city ?? '',
      state: donor.state ?? '',
      lat: donor.coordinates?.lat,
      lng: donor.coordinates?.lng,
      email: donor.email,
      phone: donor.phone,
      otp: '',
    },
  });

  const hasCoordinates = form.watch('lat') !== undefined && form.watch('lng') !== undefined;

  const nameGuard = useRestrictedInput('alpha');
  const cityGuard = useRestrictedInput('alpha');
  const stateGuard = useRestrictedInput('alpha');
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
      form.reset({
        name: donor.name,
        age: donor.age,
        bloodGroup: donor.bloodGroup,
        city: donor.city ?? '',
        state: donor.state ?? '',
        lat: donor.coordinates?.lat,
        lng: donor.coordinates?.lng,
        email: donor.email,
        phone: donor.phone,
        otp: '',
      });
      otp.reset();
    }
  }

  async function onSubmit(values: EditDonorProfileValues) {
    try {
      const data = await apiPatch<{ ok: boolean; user: User }>('/donors/me/profile', values);
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t('fieldNameLabel')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} onKeyDown={nameGuard.onKeyDown} onPaste={nameGuard.onPaste} />
                  </FormControl>
                  {nameGuard.warning && <p className="text-xs text-destructive">{nameGuard.warning}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t('fieldAgeLabel')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} value={(field.value as number | string | undefined) ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bloodGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t('fieldBloodGroup')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('selectPlaceholderShort')} />
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t('fieldCity')}</FormLabel>
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
                    <FormLabel required>{t('fieldState')}</FormLabel>
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
                    <FormLabel required>{t('fieldPhoneLabel')}</FormLabel>
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
              phone={donor.phone}
              email={donor.email}
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
