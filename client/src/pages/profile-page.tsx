import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoader } from '@/components/layout/page-loader';
import { useSessionStore } from '@/store/session-store';
import { apiPost } from '@/lib/api';
import { TravelModeCard } from '@/components/profile/travel-mode-card';
import { DonorAlertsCard } from '@/components/profile/donor-alerts-card';
import { DonationHistoryCard } from '@/components/profile/donation-history-card';
import type { User } from '@/types/domain';
import type { TFunction } from 'i18next';

function accountFields(user: User, t: TFunction): Array<[string, string]> {
  const shared: Array<[string, string]> = [
    [t('profileRoleLabel'), user.role],
    [t('profileEmailLabel'), user.email],
    [t('profilePhoneLabel'), user.phone],
  ];

  if (user.role === 'donor') {
    return [
      ...shared,
      [t('profileNameLabel'), user.name],
      [t('profileBloodLabel'), user.bloodGroup],
      [t('profileAgeLabel'), String(user.age)],
      [
        t('profileDonationLabel'),
        user.lastDonationDate ? new Date(user.lastDonationDate).toLocaleDateString() : t('notAvailableAbbr'),
      ],
      [t('profileTravelLabel'), user.traveling ? t('statusOn') : t('statusOff')],
    ];
  }
  if (user.role === 'hospital') {
    return [
      ...shared,
      [t('profileHospitalLabel'), user.hospitalName],
      [t('profileLicenseLabel'), user.licenseNumber],
      [t('profileStatusLabel'), user.approvalStatus],
    ];
  }
  if (user.role === 'bloodbank') {
    return [...shared, [t('profileBankLabel'), user.bankName], [t('profileStatusLabel'), user.approvalStatus]];
  }
  return shared;
}

export function ProfilePage() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const hydrated = useSessionStore((state) => state.hydrated);
  const setUser = useSessionStore((state) => state.setUser);

  if (!hydrated) return <PageLoader />;
  if (!session) return <Navigate to="/" replace />;
  const { user } = session;

  async function handleLogout() {
    await apiPost('/auth/logout').catch(() => {});
    setUser(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={t('profileEyebrow')}
        title={t('profileHeading')}
        description={t('profileSubtitle')}
        action={
          <Button variant="outline" onClick={handleLogout}>
            {t('logoutText')}
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold">{t('profileAccount')}</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {accountFields(user, t).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {user.role === 'donor' && (
          <>
            <TravelModeCard />
            <DonationHistoryCard />
            <DonorAlertsCard />
          </>
        )}
      </div>
    </div>
  );
}
