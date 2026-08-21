import { Outlet } from 'react-router-dom';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { useScrollToHash } from '@/hooks/use-scroll-to-hash';
import { useBootstrapSession } from '@/hooks/use-bootstrap-session';
import { useDonorAcceptanceAlerts } from '@/hooks/use-donor-acceptance-alerts';
import { useSuspensionListener } from '@/hooks/use-suspension-listener';

export function RootLayout() {
  useScrollToHash();
  useBootstrapSession();
  useDonorAcceptanceAlerts();
  useSuspensionListener();

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
      <SiteFooter />
      <AuthDialog />
    </div>
  );
}
