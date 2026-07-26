import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { useSessionStore } from '@/store/session-store';
import { TravelModeCard } from '@/components/profile/travel-mode-card';
import { DonorAlertsCard } from '@/components/profile/donor-alerts-card';

export function ProfilePage() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const logout = useSessionStore((state) => state.logout);

  if (!session) return <Navigate to="/" replace />;
  const { user } = session;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={t('profileEyebrow')}
        title={t('profileHeading')}
        description={t('profileSubtitle')}
        action={
          <Button variant="outline" onClick={() => logout()}>
            {t('logoutText')}
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold">{t('profileAccount')}</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              [t('profileRoleLabel'), user.role],
              [t('profileNameLabel'), user.name],
              [t('profileEmailLabel'), user.email],
              [t('profilePhoneLabel'), user.phone],
              [t('profileBloodLabel'), user.bloodGroup],
              [t('profileAgeLabel'), String(user.age)],
              [t('profileDonationLabel'), user.lastDonationDate],
              [t('profileTravelLabel'), user.traveling ? t('statusOn') : t('statusOff')],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <TravelModeCard />
        <DonorAlertsCard />
      </div>
    </div>
  );
}
