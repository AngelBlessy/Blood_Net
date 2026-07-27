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
  editBloodBankProfileSchema,
  type EditBloodBankProfileInput,
  type EditBloodBankProfileValues,
} from './edit-profile-schema';
import { ProfileOtpSection } from './profile-otp-section';
import { useSessionStore } from '@/store/session-store';
import { useProfileEditOtp } from '@/hooks/use-profile-edit-otp';
import { useGeolocation } from '@/hooks/use-geolocation';
import { apiPatch, apiErrorMessage } from '@/lib/api';
import type { BloodBankUser, User } from '@/types/domain';
import { MapPin } from 'lucide-react';

interface EditBloodBankProfileDialogProps {
  bloodBank: BloodBankUser;
}

export function EditBloodBankProfileDialog({ bloodBank }: EditBloodBankProfileDialogProps) {
  const { t } = useTranslation();
  const setUser = useSessionStore((state) => state.setUser);
  const [open, setOpen] = useState(false);
  const otp = useProfileEditOtp('/auth/me/profile/otp');
  const { requestLocation, loading: locating, error: locationError } = useGeolocation();

  const defaults = {
    bankName: bloodBank.bankName,
    address: bloodBank.address ?? '',
    city: bloodBank.city ?? '',
    lat: bloodBank.coordinates?.lat,
    lng: bloodBank.coordinates?.lng,
    contactNumber: bloodBank.contactNumber ?? '',
    email: bloodBank.email,
    phone: bloodBank.phone,
    otp: '',
  };

  const form = useForm<EditBloodBankProfileInput, unknown, EditBloodBankProfileValues>({
    resolver: zodResolver(editBloodBankProfileSchema),
    defaultValues: defaults,
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
      form.reset(defaults);
      otp.reset();
    }
  }

  async function onSubmit(values: EditBloodBankProfileValues) {
    try {
      const data = await apiPatch<{ ok: boolean; user: User }>('/auth/me/profile', values);
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
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fieldBankNameLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                      <Input {...field} />
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

            <FormField
              control={form.control}
              name="contactNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fieldContactNumberLabel')}</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="numeric" maxLength={10} {...field} />
                  </FormControl>
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
                    <FormLabel>{t('fieldLoginPhoneLabel')}</FormLabel>
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
              phone={bloodBank.phone}
              email={bloodBank.email}
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
