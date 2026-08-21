import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { registerSchema, ROLE_OPTIONS, type RegisterInput, type RegisterValues } from './schemas';
import type { useRegistration } from './use-registration';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useRestrictedInput } from '@/hooks/use-restricted-input';
import { MapPin } from 'lucide-react';

interface RegisterFormProps {
  submitRegistration: ReturnType<typeof useRegistration>['submitRegistration'];
  onOtpSent: (message?: string) => void;
}

const today = new Date().toISOString().slice(0, 10);

export function RegisterForm({ submitRegistration, onOtpSent }: RegisterFormProps) {
  const { t } = useTranslation();
  const { requestLocation, loading: locating, error: locationError } = useGeolocation();
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
      licenseDocument: undefined,
      bankName: '',
      contactNumber: '',
      address: '',
      city: '',
      state: '',
    },
  });

  const role = form.watch('role');
  const donatedEver = form.watch('donatedEver');
  const hasCoordinates = form.watch('lat') !== undefined && form.watch('lng') !== undefined;

  const nameGuard = useRestrictedInput('alpha');
  const cityGuard = useRestrictedInput('alpha');
  const stateGuard = useRestrictedInput('alpha');
  const phoneGuard = useRestrictedInput('numeric');
  const contactNumberGuard = useRestrictedInput('numeric');

  async function handleUseLocation() {
    const coords = await requestLocation();
    if (coords) {
      form.setValue('lat', coords.lat);
      form.setValue('lng', coords.lng);
    }
  }

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
              <FormLabel required>{t('registeringAsLabel')}</FormLabel>
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
          <>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t('fieldName')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('namePlaceholder')}
                      autoComplete="name"
                      {...field}
                      onKeyDown={nameGuard.onKeyDown}
                      onPaste={nameGuard.onPaste}
                    />
                  </FormControl>
                  {nameGuard.warning && <p className="text-xs text-destructive">{nameGuard.warning}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t('fieldCity')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('cityPlaceholder')}
                        {...field}
                        onKeyDown={cityGuard.onKeyDown}
                        onPaste={cityGuard.onPaste}
                      />
                    </FormControl>
                    {cityGuard.warning && <p className="text-xs text-destructive">{cityGuard.warning}</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t('fieldState')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('statePlaceholder')}
                        {...field}
                        onKeyDown={stateGuard.onKeyDown}
                        onPaste={stateGuard.onPaste}
                      />
                    </FormControl>
                    {stateGuard.warning && <p className="text-xs text-destructive">{stateGuard.warning}</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        )}

        {role === 'hospital' && (
          <FormField
            control={form.control}
            name="hospitalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('fieldHospitalName')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('hospitalNamePlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {role === 'bloodbank' && (
          <FormField
            control={form.control}
            name="bankName"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('fieldBankName')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('bankNamePlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {(role === 'hospital' || role === 'bloodbank') && (
          <>
            <FormField
              control={form.control}
              name="licenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t('fieldLicenseNumber')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('licenseNumberPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="licenseDocument"
              render={({ field: { value, onChange, ref, name, onBlur } }) => (
                <FormItem>
                  <FormLabel required>{t('fieldLicenseDocument')}</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      name={name}
                      ref={ref}
                      onBlur={onBlur}
                      onChange={(e) => onChange(e.target.files?.[0])}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {value ? t('licenseDocumentSelectedLabel', { name: value.name }) : t('licenseDocumentHint')}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {(role === 'hospital' || role === 'bloodbank') && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fieldAddress')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('addressPlaceholder')} {...field} />
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
                  <FormLabel>{t('fieldCity')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('cityPlaceholder')}
                      {...field}
                      onKeyDown={cityGuard.onKeyDown}
                      onPaste={cityGuard.onPaste}
                    />
                  </FormControl>
                  {cityGuard.warning && <p className="text-xs text-destructive">{cityGuard.warning}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t('fieldState')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('statePlaceholder')}
                      {...field}
                      onKeyDown={stateGuard.onKeyDown}
                      onPaste={stateGuard.onPaste}
                    />
                  </FormControl>
                  {stateGuard.warning && <p className="text-xs text-destructive">{stateGuard.warning}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleUseLocation} disabled={locating}>
            <MapPin className="size-3.5" />
            {locating ? t('locatingEllipsis') : t('useMyLocationButton')}
          </Button>
          {hasCoordinates && <span className="text-xs text-muted-foreground">{t('locationCapturedText')}</span>}
          {locationError && <span className="text-xs text-destructive">{locationError}</span>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {role === 'donor' && (
            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t('fieldAge')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      placeholder={t('fieldAge')}
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
                <FormLabel required>{t('fieldContactNo')}</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder={t('phonePlaceholder')}
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
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>{t('fieldEmail')}</FormLabel>
              <FormControl>
                <Input type="email" placeholder={t('emailAddressPlaceholder')} autoComplete="email" {...field} />
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
                <PasswordInput placeholder={t('createPasswordPlaceholder')} autoComplete="new-password" {...field} />
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
              <FormLabel required>{t('fieldConfirmPassword')}</FormLabel>
              <FormControl>
                <PasswordInput placeholder={t('confirmPasswordPlaceholder')} autoComplete="new-password" {...field} />
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
                  <FormLabel required>{t('fieldDonatedEver')}</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="yes" /> {t('yesLabel')}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="no" /> {t('noLabel')}
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
                    <FormLabel required>{t('fieldLastDonationDate')}</FormLabel>
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
                  <FormLabel required>{t('fieldBloodGroup')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('selectBloodGroupPlaceholder')} />
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
                <FormLabel>{t('fieldBankContactNumber')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('bankContactNumberPlaceholder')}
                    {...field}
                    onKeyDown={contactNumberGuard.onKeyDown}
                    onPaste={contactNumberGuard.onPaste}
                  />
                </FormControl>
                {contactNumberGuard.warning && <p className="text-xs text-destructive">{contactNumberGuard.warning}</p>}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {(role === 'hospital' || role === 'bloodbank') && (
          <p className="text-xs text-muted-foreground">{t('approvalNoticeText')}</p>
        )}

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('sendingOtpEllipsis') : t('registerSubmit')}
        </Button>
      </form>
    </Form>
  );
}
