import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSessionStore } from '@/store/session-store';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';

const POLL_INTERVAL_MS = 20000;

// Polls the logged-in raiser's own requests for newly accepted donor responses
// and pops a toast with the donor's name and phone. Mounted once at the app
// root so it fires no matter which page the raiser is on.
export function useDonorAcceptanceAlerts() {
  const role = useSessionStore((state) => state.session?.user.role);
  const fetchMyRequests = useHospitalRequestsStore((state) => state.fetchMyRequests);
  const seenRef = useRef<Set<string> | null>(null);

  const canRaise = role === 'hospital' || role === 'bloodbank' || role === 'donor';

  useEffect(() => {
    if (!canRaise) {
      seenRef.current = null;
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const requests = await fetchMyRequests();
        if (cancelled) return;

        const acceptedKeys = new Set<string>();
        for (const request of requests) {
          for (const entry of request.responses) {
            if (entry.response !== 'Accepted') continue;
            const key = `${request.id}:${entry.donorId}`;
            acceptedKeys.add(key);
            if (seenRef.current && !seenRef.current.has(key)) {
              toast.success(
                `${entry.donorName}${entry.donorPhone ? ` (${entry.donorPhone})` : ''} accepted to donate for "${request.patient}"`,
                { duration: 10000 }
              );
            }
          }
        }
        // First poll only seeds the seen set — don't toast for responses that
        // already existed before this session started watching.
        seenRef.current = acceptedKeys;
      } catch {
        // Transient poll failures are silently ignored; the next tick retries.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [canRaise, fetchMyRequests]);
}
