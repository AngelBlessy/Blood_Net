import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { registerSchema, ROLE_OPTIONS, type RegisterInput, type RegisterValues } from './schemas';
import type { useRegistration } from './use-registration';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';

interface RegisterFormProps {
  submitRegistration: ReturnType<typeof useRegistration>['submitRegistration'];
  onOtpSent: (message?: string) => void;
}

const today = new Date().toISOString().slice(0, 10);

export function RegisterForm({ submitRegistration, onOtpSent }: RegisterFormProps) {
  const form = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'donor',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      name: '',
      age: '' as unknown as number,
      donatedEver: undefined,
      lastDonationDate: '',
      bloodGroup: undefined,
      hospitalName: '',
      licenseNumber: '',
      bankName: '',
      contactNumber: '',
      address: '',
      city: '',
    },
  });

  const role = form.watch('role');
  const donatedEver = form.watch('donatedEver');

  async function onSubmit(values: RegisterValues) {
    const result = await submitRegistration(values);
    if (!result.accountCreated) {
      form.setError('email', { message: result.message });
      return;
    }
    onOtpSent(result.message);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>I am registering as</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {role === 'donor' && (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Full name" autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {role === 'hospital' && (
          <>
            <FormField
              control={form.control}
              name="hospitalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hospital name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. City General Hospital" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="licenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License number</FormLabel>
                  <FormControl>
                    <Input placeholder="Hospital registration / license number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {role === 'bloodbank' && (
          <FormField
            control={form.control}
            name="bankName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Blood bank name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Red Cross Blood Bank" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {(role === 'hospital' || role === 'bloodbank') && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Street address" {...field} />
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
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="City" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {role === 'donor' && (
            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      placeholder="Age"
                      {...field}
                      value={(field.value as number | string | undefined) ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact no</FormLabel>
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
                <PasswordInput placeholder="Create password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <PasswordInput placeholder="Re-enter password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {role === 'donor' && (
          <>
            <FormField
              control={form.control}
              name="donatedEver"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Donated anytime in life</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="yes" /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="no" /> No
                      </label>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {donatedEver === 'yes' && (
              <FormField
                control={form.control}
                name="lastDonationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last donation date</FormLabel>
                    <FormControl>
                      <Input type="date" max={today} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="bloodGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Blood group</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select blood group" />
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
          </>
        )}

        {role === 'bloodbank' && (
          <FormField
            control={form.control}
            name="contactNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bank contact number</FormLabel>
                <FormControl>
                  <Input placeholder="Defaults to contact no above if left blank" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {(role === 'hospital' || role === 'bloodbank') && (
          <p className="text-xs text-muted-foreground">
            Hospital and blood bank accounts need admin approval after OTP verification before you can log in.
          </p>
        )}

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Sending OTP…' : 'Send OTP'}
        </Button>
      </form>
    </Form>
  );
}
