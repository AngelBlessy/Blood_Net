import { useTranslation } from 'react-i18next';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import type { useCountdown } from '@/hooks/use-countdown';

interface ProfileOtpSectionProps<T extends FieldValues> {
  control: Control<T>;
  otpFieldName: Path<T>;
  phone: string;
  email: string;
  otpSent: boolean;
  onSendCode: () => void;
  resendCountdown: ReturnType<typeof useCountdown>;
}

export function ProfileOtpSection<T extends FieldValues>({
  control,
  otpFieldName,
  phone,
  email,
  otpSent,
  onSendCode,
  resendCountdown,
}: ProfileOtpSectionProps<T>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {otpSent
            ? t('otpEnterCodeSentTo', { email, phone: phone.slice(-4) })
            : t('otpWillSendTo', { email, phone: phone.slice(-4) })}
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto shrink-0 p-0"
          onClick={onSendCode}
          disabled={otpSent && !resendCountdown.expired}
        >
          {!otpSent
            ? t('sendCodeButton')
            : resendCountdown.expired
              ? t('resendCodeButton')
              : t('resendInLabel', { time: resendCountdown.label })}
        </Button>
      </div>

      {otpSent && (
        <FormField
          control={control}
          name={otpFieldName}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t('sixDigitCodePlaceholder')}
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
  );
}
