import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useSessionStore } from '@/store/session-store';
import { useUsersStore } from '@/store/users-store';

export function TravelModeCard() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const updateSessionUser = useSessionStore((state) => state.updateSessionUser);
  const updateUser = useUsersStore((state) => state.updateUser);

  if (!session) return null;
  const traveling = session.user.traveling;

  function handleToggle(checked: boolean) {
    if (!session) return;
    updateUser(session.userKey, { traveling: checked });
    updateSessionUser({ traveling: checked });
    toast.success(checked ? t('toastTravelOn') : t('toastTravelOff'));
  }

  return (
    <Card className="gap-2 p-6">
      <h3 className="font-semibold">{t('travelCardTitle')}</h3>
      <p className="text-sm text-muted-foreground">{t('travelCardText')}</p>
      <div className="mt-2 flex items-center justify-between rounded-md border px-3 py-2.5">
        <span className="text-sm">
          {t('travelCurrentStatus', { status: traveling ? t('statusOn') : t('statusOff') })}
        </span>
        <Switch checked={traveling} onCheckedChange={handleToggle} aria-label={t('toggleTravelAria')} />
      </div>
    </Card>
  );
}
