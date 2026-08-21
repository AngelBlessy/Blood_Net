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
import { editAdminProfileSchema, type EditAdminProfileInput, type EditAdminProfileValues } from './edit-profile-schema';
import { ProfileOtpSection } from './profile-otp-section';
import { useSessionStore } from '@/store/session-store';
import { useProfileEditOtp } from '@/hooks/use-profile-edit-otp';
import { useRestrictedInput } from '@/hooks/use-restricted-input';
import { apiPatch, apiErrorMessage } from '@/lib/api';
import type { AdminUser, User } from '@/types/domain';

interface EditAdminProfileDialogProps {
  admin: AdminUser;
}

export function EditAdminProfileDialog({ admin }: EditAdminProfileDialogProps) {
  const { t } = useTranslation();
  const setUser = useSessionStore((state) => state.setUser);
  const [open, setOpen] = useState(false);
  const otp = useProfileEditOtp('/auth/me/profile/otp');
  const phoneGuard = useRestrictedInput('numeric');

  const defaults = { email: admin.email, phone: admin.phone, otp: '' };

  const form = useForm<EditAdminProfileInput, unknown, EditAdminProfileValues>({
    resolver: zodResolver(editAdminProfileSchema),
    defaultValues: defaults,
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      form.reset(defaults);
      otp.reset();
    }
  }

  async function onSubmit(values: EditAdminProfileValues) {
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
          <DialogDescription>{t('editProfileDescLogin')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <ProfileOtpSection
              control={form.control}
              otpFieldName="otp"
              phone={admin.phone}
              email={admin.email}
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
