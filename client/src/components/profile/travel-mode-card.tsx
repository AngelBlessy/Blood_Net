import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useSessionStore } from '@/store/session-store';
import { apiPatch, apiErrorMessage } from '@/lib/api';

export function TravelModeCard() {
  const session = useSessionStore((state) => state.session);
  const setUser = useSessionStore((state) => state.setUser);

  if (!session || session.user.role !== 'donor') return null;
  const donor = session.user;

  async function handleToggle(checked: boolean) {
    try {
      await apiPatch('/donors/me', { traveling: checked });
      setUser({ ...donor, traveling: checked });
      toast.success(
        checked
          ? 'Travel mode enabled. Emergency notifications are paused.'
          : 'Travel mode disabled. Emergency notifications will resume.'
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not update travel mode.'));
    }
  }

  return (
    <Card className="gap-2 p-6">
      <h3 className="font-semibold">Travel mode</h3>
      <p className="text-sm text-muted-foreground">
        If you are travelling, you will not receive emergency notification for donation.
      </p>
      <div className="mt-2 flex items-center justify-between rounded-md border px-3 py-2.5">
        <span className="text-sm">Currently travel mode is {donor.traveling ? 'on' : 'off'}.</span>
        <Switch checked={donor.traveling} onCheckedChange={handleToggle} aria-label="Toggle travel mode" />
      </div>
    </Card>
  );
}
