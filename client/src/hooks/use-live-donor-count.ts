import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

const BASELINE_DONORS = 12480;
const REFRESH_INTERVAL_MS = 15_000;

export function useLiveDonorCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function refresh() {
      apiGet<{ count: number }>('/donors/count')
        .then((data) => {
          if (!cancelled) setCount(data.count);
        })
        .catch(() => {});
    }

    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return BASELINE_DONORS + count;
}
