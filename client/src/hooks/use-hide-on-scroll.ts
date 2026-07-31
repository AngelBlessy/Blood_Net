import { useEffect, useRef, useState } from 'react';

// Downward movement must accumulate past this before hiding, so tiny
// jitter/rubber-banding doesn't flicker the header. Upward movement reveals
// immediately (no threshold) so a small scroll-up always brings it back.
const HIDE_THRESHOLD = 10;

export function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const downwardAccum = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY.current;
      lastScrollY.current = currentScrollY;

      if (currentScrollY <= 64 || delta < 0) {
        downwardAccum.current = 0;
        setHidden(false);
        return;
      }

      downwardAccum.current += delta;
      if (downwardAccum.current > HIDE_THRESHOLD) {
        setHidden(true);
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return hidden;
}
