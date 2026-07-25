import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { raiseRequestSchema, type RaiseRequestInput, type RaiseRequestValues } from './schemas';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { apiErrorMessage } from '@/lib/api';
import type { RequestPriority } from '@/types/domain';

const PRIORITIES: RequestPriority[] = ['Critical', 'Urgent', 'Routine'];

interface RaiseRequestFormProps {
  defaultPriority?: RequestPriority;
  submitLabel?: string;
  onSubmitted?: () => void;
}

export function RaiseRequestForm({
  defaultPriority = 'Critical',
  submitLabel = 'Find and notify donors',
  onSubmitted,
}: RaiseRequestFormProps) {
  const createRequest = useHospitalRequestsStore((state) => state.createRequest);

  const form = useForm<RaiseRequestInput, unknown, RaiseRequestValues>({
    resolver: zodResolver(raiseRequestSchema),
    defaultValues: { patient: '', bloodGroup: undefined, units: 1, priority: defaultPriority },
  });

  async function onSubmit(values: RaiseRequestValues) {
    try {
      const result = await createRequest(values);
      form.reset({ patient: '', bloodGroup: undefined, units: 1, priority: defaultPriority });
      onSubmitted?.();
      toast[result.ok ? 'success' : 'error'](result.message);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Something went wrong raising the request.'));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="patient"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Patient / case reference</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Trauma patient, Ward 4" {...field} />
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
                  <Input type="number" min={1} {...field} value={(field.value as number | string | undefined) ?? ''} />
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
          {form.formState.isSubmitting ? 'Sending…' : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
