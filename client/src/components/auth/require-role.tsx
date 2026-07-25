import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import type { Role } from '@/types/domain';
import { PageLoader } from '@/components/layout/page-loader';

interface RequireRoleProps {
  role: Role;
  children: ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const session = useSessionStore((state) => state.session);
  const hydrated = useSessionStore((state) => state.hydrated);
  const openAuthDialog = useUiStore((state) => state.openAuthDialog);
  const allowed = Boolean(session && session.user.role === role);

  useEffect(() => {
    if (hydrated && !allowed) openAuthDialog('login');
  }, [hydrated, allowed, openAuthDialog]);

  if (!hydrated) return <PageLoader />;
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
