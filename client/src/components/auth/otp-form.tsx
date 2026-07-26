import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { otpSchema, type OtpValues } from './schemas';
import { useCountdown } from '@/hooks/use-countdown';
import type { FlowResult } from './types';

interface OtpFormProps {
  expiresAt?: number;
  resendAt?: number;
  message?: string;
  verifyOtp: (code: string) => Promise<FlowResult>;
  resendOtp: () => Promise<FlowResult>;
  onVerified: () => void;
}

export function OtpForm({ expiresAt, resendAt, message, verifyOtp, resendOtp, onVerified }: OtpFormProps) {
  const { t } = useTranslation();
  const [statusMessage, setStatusMessage] = useState(message);
  const [resendAtState, setResendAtState] = useState(resendAt);
  const countdown = useCountdown(expiresAt);
  const resendCountdown = useCountdown(resendAtState);

  const form = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  async function onSubmit(values: OtpValues) {
    const result = await verifyOtp(values.otp);
    if (!result.ok) {
      form.setError('otp', { message: result.message ?? t('otpInvalidShort') });
      return;
    }
    onVerified();
  }

  async function handleResend() {
    const result = await resendOtp();
    setStatusMessage(result.message);
    setResendAtState(Date.now() + 30_000);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {statusMessage && <p className="text-sm text-muted-foreground">{statusMessage}</p>}

        <FormField
          control={form.control}
          name="otp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fieldOtp')}</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t('otpPlaceholder')}
                  autoComplete="one-time-code"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground tabular-nums">{countdown.label}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={handleResend}
            disabled={!resendCountdown.expired}
          >
            {resendCountdown.expired ? t('resendOtpLabel') : t('resendInLabel', { time: resendCountdown.label })}
          </Button>
        </div>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || countdown.expired}>
          {form.formState.isSubmitting ? t('verifyingEllipsis') : t('otpSubmit')}
        </Button>
      </form>
    </Form>
  );
}
