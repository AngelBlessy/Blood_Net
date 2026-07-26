import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
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
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import { useSessionStore } from '@/store/session-store';
import { useCountdown } from '@/hooks/use-countdown';
import { apiPost, apiPatch, apiErrorMessage } from '@/lib/api';
import type { DonorUser, User } from '@/types/domain';

interface EditProfileDialogProps {
  donor: DonorUser;
}

export function EditProfileDialog({ donor }: EditProfileDialogProps) {
  const setUser = useSessionStore((state) => state.setUser);
  const [open, setOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendAt, setResendAt] = useState<number>();
  const resendCountdown = useCountdown(resendAt);

  const form = useForm<EditDonorProfileInput, unknown, EditDonorProfileValues>({
    resolver: zodResolver(editDonorProfileSchema),
    defaultValues: {
      name: donor.name,
      age: donor.age,
      bloodGroup: donor.bloodGroup,
      email: donor.email,
      phone: donor.phone,
      otp: '',
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      form.reset({
        name: donor.name,
        age: donor.age,
        bloodGroup: donor.bloodGroup,
        email: donor.email,
        phone: donor.phone,
        otp: '',
      });
      setOtpSent(false);
      setResendAt(undefined);
    }
  }

  async function handleSendCode() {
    try {
      const result = await apiPost<{ ok: boolean; message: string }>('/donors/me/profile/otp');
      toast.success(result.message);
      setOtpSent(true);
      setResendAt(Date.now() + 30_000);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not send verification code.'));
    }
  }

  async function onSubmit(values: EditDonorProfileValues) {
    try {
      const data = await apiPatch<{ ok: boolean; user: User }>('/donors/me/profile', values);
      setUser(data.user);
      toast.success('Profile updated.');
      handleOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not update your profile.'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="size-3.5" /> Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update your details, then verify with the code sent to your registered phone to save changes.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
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
                    <FormLabel>Age</FormLabel>
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
                    <FormLabel>Blood group</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select" />
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
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
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" inputMode="numeric" maxLength={10} autoComplete="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {otpSent
                    ? `Enter the code sent to your registered phone ending in ${donor.phone.slice(-4)}.`
                    : `We'll text a verification code to your registered phone ending in ${donor.phone.slice(-4)} to confirm these changes.`}
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto shrink-0 p-0"
                  onClick={handleSendCode}
                  disabled={otpSent && !resendCountdown.expired}
                >
                  {!otpSent ? 'Send code' : resendCountdown.expired ? 'Resend code' : `Resend in ${resendCountdown.label}`}
                </Button>
              </div>

              {otpSent && (
                <FormField
                  control={form.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6-digit code"
                          autoComplete="one-time-code"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <Button type="submit" className="w-full" disabled={!otpSent || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
