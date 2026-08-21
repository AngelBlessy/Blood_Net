import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { loginSchema, type LoginValues } from './schemas';
import { apiPost, apiErrorMessage, ApiError } from '@/lib/api';
import { useSessionStore } from '@/store/session-store';
import { ResubmitRegistrationForm } from './resubmit-registration-form';
import type { User } from '@/types/domain';

interface LoginFormProps {
  onLoggedIn: () => void;
  onForgotPassword: () => void;
}

interface RejectedAccountInfo {
  email: string;
  phone: string;
  role: 'hospital' | 'bloodbank';
  reason: string | null;
}

export function LoginForm({ onLoggedIn, onForgotPassword }: LoginFormProps) {
  const { t } = useTranslation();
  const setUser = useSessionStore((state) => state.setUser);
  const [suspendedEmail, setSuspendedEmail] = useState<string | null>(null);
  const [reactivationStatus, setReactivationStatus] = useState<{ sending: boolean; message?: string }>({
    sending: false,
  });
  const [rejectedAccount, setRejectedAccount] = useState<RejectedAccountInfo | null>(null);
  const [showResubmitForm, setShowResubmitForm] = useState(false);
  const [resubmitDone, setResubmitDone] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    const email = values.email.trim().toLowerCase();
    setSuspendedEmail(null);
    setReactivationStatus({ sending: false });
    setRejectedAccount(null);
    setShowResubmitForm(false);
    setResubmitDone(null);
    try {
      const result = await apiPost<{ ok: boolean; user: User }>('/auth/login', {
        email,
        password: values.password,
      });
      setUser(result.user);
      onLoggedIn();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'account_suspended') {
        setSuspendedEmail(email);
      }
      if (error instanceof ApiError && error.code === 'account_rejected') {
        const data = error.data ?? {};
        setRejectedAccount({
          email,
          phone: typeof data.phone === 'string' ? data.phone : '',
          role: data.role === 'bloodbank' ? 'bloodbank' : 'hospital',
          reason: typeof data.rejectionReason === 'string' ? data.rejectionReason : null,
        });
      }
      form.setError('password', { message: apiErrorMessage(error, t('errIncorrectLogin')) });
    }
  }

  async function handleRequestReactivation() {
    if (!suspendedEmail) return;
    setReactivationStatus({ sending: true });
    try {
      const result = await apiPost<{ ok: boolean; message: string }>('/auth/request-reactivation', {
        email: suspendedEmail,
      });
      setReactivationStatus({ sending: false, message: result.message });
    } catch (error) {
      setReactivationStatus({ sending: false, message: apiErrorMessage(error, t('errSomethingWentWrong')) });
    }
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('fieldEmail')}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder={t('emailAddressPlaceholder')}
                    autoComplete="off"
                    {...field}
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('fieldPassword')}</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder={t('passwordPlaceholder')}
                    autoComplete="off"
                    {...field}
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t('loginSigningIn') : t('loginSubmit')}
          </Button>
          <Button type="button" variant="link" size="sm" className="w-full" onClick={onForgotPassword}>
            {t('forgotPasswordLink')}
          </Button>
        </form>
      </Form>

      {suspendedEmail && (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-center">
          {reactivationStatus.message ? (
            <p className="text-sm text-muted-foreground">{reactivationStatus.message}</p>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={reactivationStatus.sending}
              onClick={handleRequestReactivation}
            >
              {reactivationStatus.sending ? t('sendingEllipsis') : t('requestApprovalAgainLabel')}
            </Button>
          )}
        </div>
      )}

      {rejectedAccount && !resubmitDone && !showResubmitForm && (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-center">
          <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => setShowResubmitForm(true)}>
            {t('resubmitAccountLink')}
          </Button>
        </div>
      )}

      {rejectedAccount && showResubmitForm && !resubmitDone && (
        <ResubmitRegistrationForm
          email={rejectedAccount.email}
          phone={rejectedAccount.phone}
          role={rejectedAccount.role}
          rejectionReason={rejectedAccount.reason}
          onSubmitted={(message) => {
            setResubmitDone(message);
            setShowResubmitForm(false);
          }}
          onCancel={() => setShowResubmitForm(false)}
        />
      )}

      {resubmitDone && <p className="text-sm text-muted-foreground">{resubmitDone}</p>}
    </div>
  );
}
