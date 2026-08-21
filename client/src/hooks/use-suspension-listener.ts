import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useSessionStore } from '@/store/session-store';

// An admin suspending an account must take effect immediately for anyone
// already logged in, not just block their next login attempt. The server
// (admin.controller.js) pushes 'account:suspended' over the same socket
// used for notifications, then force-disconnects the socket -- this listener
// is what turns that push into an actual client-side logout.
export function useSuspensionListener() {
  const session = useSessionStore((state) => state.session);
  const setUser = useSessionStore((state) => state.setUser);
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) return;
    const socket = getSocket();
    function handleSuspended(payload: { message?: string }) {
      apiPost('/auth/logout').catch(() => {});
      setUser(null);
      toast.error(payload?.message || 'Your account has been suspended by the admin.');
      navigate('/');
    }
    socket.on('account:suspended', handleSuspended);
    return () => {
      socket.off('account:suspended', handleSuspended);
    };
  }, [session, setUser, navigate]);
}
