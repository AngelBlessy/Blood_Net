import { Navigate } from 'react-router-dom';
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

function accountFields(user: User): Array<[string, string]> {
  const shared: Array<[string, string]> = [
    ['Role', user.role],
    ['Email', user.email],
    ['Phone', user.phone],
  ];

  if (user.role === 'donor') {
    return [
      ...shared,
      ['Name', user.name],
      ['Blood group', user.bloodGroup],
      ['Age', String(user.age)],
      ['Last donation date', user.lastDonationDate ? new Date(user.lastDonationDate).toLocaleDateString() : 'N/A'],
      ['Travel mode', user.traveling ? 'On' : 'Off'],
    ];
  }
  if (user.role === 'hospital') {
    return [...shared, ['Hospital', user.hospitalName], ['License #', user.licenseNumber], ['Status', user.approvalStatus]];
  }
  if (user.role === 'bloodbank') {
    return [...shared, ['Blood bank', user.bankName], ['Status', user.approvalStatus]];
  }
  return shared;
}

export function ProfilePage() {
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
        eyebrow="Your profile"
        title="Welcome back"
        description="Your verified account details are shown below."
        action={
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold">Account details</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {accountFields(user).map(([label, value]) => (
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
