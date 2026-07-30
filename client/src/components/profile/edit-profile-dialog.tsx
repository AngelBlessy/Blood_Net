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
                  <FormLabel>{t('fieldNameLabel')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
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
                    <FormLabel>{t('fieldAgeLabel')}</FormLabel>
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
                    <FormLabel>{t('fieldBloodGroup')}</FormLabel>
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
                    <FormLabel>{t('fieldCity')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('cityPlaceholder')} {...field} />
                    </FormControl>
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
                      <Input placeholder={t('statePlaceholder')} {...field} />
                    </FormControl>
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
                    <FormLabel>{t('fieldEmailLabel')}</FormLabel>
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
                    <FormLabel>{t('fieldPhoneLabel')}</FormLabel>
                    <FormControl>
                      <Input type="tel" inputMode="numeric" maxLength={10} autoComplete="tel" {...field} />
                    </FormControl>
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
