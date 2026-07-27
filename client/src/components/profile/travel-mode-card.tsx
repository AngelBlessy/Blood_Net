import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useSessionStore } from '@/store/session-store';
import { apiPatch, apiErrorMessage } from '@/lib/api';

export function TravelModeCard() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const setUser = useSessionStore((state) => state.setUser);

  if (!session || session.user.role !== 'donor') return null;
  const donor = session.user;

  async function handleToggle(checked: boolean) {
    try {
      await apiPatch('/donors/me', { traveling: checked });
      setUser({ ...donor, traveling: checked });
      toast.success(checked ? t('toastTravelOn') : t('toastTravelOff'));
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastTravelModeError')));
    }
  }

  return (
    <Card className="gap-2 p-6">
      <h3 className="font-semibold">{t('travelCardTitle')}</h3>
      <p className="text-sm text-muted-foreground">{t('travelCardText')}</p>
      <div className="mt-2 flex items-center justify-between rounded-md border px-3 py-2.5">
        <span className="text-sm">
          {t('travelCurrentStatus', { status: donor.traveling ? t('statusOn') : t('statusOff') })}
        </span>
        <Switch checked={donor.traveling} onCheckedChange={handleToggle} aria-label={t('toggleTravelAria')} />
      </div>
    </Card>
  );
}
