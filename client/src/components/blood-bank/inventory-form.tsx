import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { inventorySchema, type InventoryInput, type InventoryValues } from './schemas';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import { useInventoryStore } from '@/store/inventory-store';

export function InventoryForm() {
  const { t } = useTranslation();
  const updateItem = useInventoryStore((state) => state.updateItem);

  const form = useForm<InventoryInput, unknown, InventoryValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues: { group: undefined, units: 0, expiry: '', location: '' },
  });

  function onSubmit(values: InventoryValues) {
    updateItem(values.group, { units: values.units, expiry: values.expiry, location: values.location });
    toast.success(t('toastInventoryUpdated'));
    form.reset({ group: undefined, units: 0, expiry: '', location: '' });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="group"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fieldBloodGroup')}</FormLabel>
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

        <FormField
          control={form.control}
          name="units"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fieldAvailableUnits')}</FormLabel>
              <FormControl>
                <Input type="number" min={0} {...field} value={(field.value as number | string | undefined) ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expiry"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fieldExpiryDate')}</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fieldStorageLocation')}</FormLabel>
              <FormControl>
                <Input placeholder={t('storageLocationPlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {t('updateInventoryButton')}
        </Button>
      </form>
    </Form>
  );
}
