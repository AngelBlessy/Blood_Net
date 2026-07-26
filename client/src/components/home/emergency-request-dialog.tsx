import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button, type buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { OtpForm } from '@/components/auth/otp-form';
import { RaiseRequestForm } from '@/components/hospital/raise-request-form';
import { guestRequestSchema, type GuestRequestInput, type GuestRequestValues } from './guest-request-schema';
import { useGuestRequest } from './use-guest-request';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import { useSessionStore } from '@/store/session-store';
import type { RequestPriority } from '@/types/domain';
import type { VariantProps } from 'class-variance-authority';

const PRIORITIES: RequestPriority[] = ['Critical', 'Urgent', 'Routine'];

interface EmergencyRequestDialogProps {
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  className?: string;
}

export function EmergencyRequestDialog({ variant = 'default', size = 'lg', className }: EmergencyRequestDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const session = useSessionStore((state) => state.session);
  const guestRequest = useGuestRequest();
  const canRaiseDirectly =
    session?.user.role === 'hospital' || session?.user.role === 'bloodbank' || session?.user.role === 'donor';

  const form = useForm<GuestRequestInput, unknown, GuestRequestValues>({
    resolver: zodResolver(guestRequestSchema),
    defaultValues: { name: '', phone: '', patient: '', bloodGroup: undefined, units: 1, priority: 'Critical' },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStep('form');
      guestRequest.reset();
      form.reset();
    }
  }

  async function onSubmit(values: GuestRequestValues) {
    const result = await guestRequest.requestOtp(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setStep('otp');
  }

  function handleVerified() {
    toast.success('Request submitted — compatible donors are being alerted.');
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {t('ctaPrimary')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('modalTitle')}</DialogTitle>
          <DialogDescription>
            {canRaiseDirectly
              ? t('modalDesc')
              : step === 'form'
                ? "No account needed — verify your phone with a one-time code and compatible donors are alerted right away."
                : 'Enter the code sent to your phone to confirm and send the request.'}
          </DialogDescription>
        </DialogHeader>

        {canRaiseDirectly ? (
          <RaiseRequestForm submitLabel={t('modalSubmit')} onSubmitted={() => handleOpenChange(false)} />
        ) : step === 'otp' ? (
          <OtpForm
            expiresAt={guestRequest.pending?.expiresAt}
            resendAt={guestRequest.pending?.resendAt}
            verifyOtp={guestRequest.verifyAndSubmit}
            resendOtp={guestRequest.resendOtp}
            onVerified={handleVerified}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your name</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" autoComplete="name" {...field} />
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
                      <FormLabel>Your phone</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="10-digit phone number"
                          autoComplete="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="patient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient / hospital reference</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Trauma patient at City Hospital, Ward 4" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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
                <FormField
                  control={form.control}
                  name="units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Units needed</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          value={(field.value as number | string | undefined) ?? ''}
                        />
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
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Sending code…' : 'Send verification code'}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
