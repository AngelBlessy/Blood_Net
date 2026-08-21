import { useEffect } from 'react';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { useSessionStore } from '@/store/session-store';
import type { User } from '@/types/domain';

// /auth/me always reflects the account's live status (it re-reads the user
// from the database on every call), but unlike a rejected API call it never
// errors for a suspended account -- it just returns them with
// status: 'suspended'. The socket-pushed forced logout (see
// use-suspension-listener.ts) is the fast path; this is the fallback for
// whenever that push was missed (e.g. this tab's socket was disconnected at
// the moment the admin suspended them).
function applySession(data: { user: User | null }, setUser: (user: User | null) => void) {
  if (data.user?.status === 'suspended') {
    setUser(null);
    toast.error('Your account has been suspended by the admin. Please ask the admin for approval again.');
    return;
  }
  setUser(data.user);
}

async function refreshSession(setUser: (user: User | null) => void) {
  try {
    const data = await apiGet<{ user: User | null }>('/auth/me');
    applySession(data, setUser);
  } catch {
    // transient network error — keep the last known session rather than logging out
  }
}

// Runs on app load to hydrate the session cache from the httpOnly auth
// cookie (unreadable from JS), and re-syncs whenever the tab regains focus.
// The cookie is shared across every tab in the browser, so logging into a
// different account in another tab silently changes who this tab's requests
// act as — without the focus re-sync, a page opened before that switch would
// keep showing stale role-gated UI until it made a request and got rejected.
export function useBootstrapSession() {
  const setUser = useSessionStore((state) => state.setUser);
  const setHydrated = useSessionStore((state) => state.setHydrated);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ user: User | null }>('/auth/me')
      .then((data) => {
        if (!cancelled) applySession(data, setUser);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated();
      });

    function handleFocus() {
      refreshSession(setUser);
    }
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [setUser, setHydrated]);
}
