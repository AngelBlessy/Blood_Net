import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { loginSchema, type LoginValues } from './schemas';
import { apiPost, apiErrorMessage } from '@/lib/api';
import { useSessionStore } from '@/store/session-store';
import type { User } from '@/types/domain';

interface LoginFormProps {
  onLoggedIn: () => void;
  onForgotPassword: () => void;
}

export function LoginForm({ onLoggedIn, onForgotPassword }: LoginFormProps) {
  const setUser = useSessionStore((state) => state.setUser);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    try {
      const result = await apiPost<{ ok: boolean; user: User }>('/auth/login', {
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      setUser(result.user);
      onLoggedIn();
    } catch (error) {
      form.setError('password', { message: apiErrorMessage(error, 'Incorrect email or password.') });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="name@example.com" autoComplete="email" {...field} />
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
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder="Enter password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Signing in…' : 'Login'}
        </Button>
        <Button type="button" variant="link" size="sm" className="w-full" onClick={onForgotPassword}>
          Forgot password? Reset with OTP
        </Button>
      </form>
    </Form>
  );
}
