import { useCallback, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

const PATTERNS: Record<'alpha' | 'numeric', RegExp> = {
  alpha: /[A-Za-z\s]/,
  numeric: /[0-9]/,
};

const WARNING_DURATION_MS = 2000;

// Blocks disallowed keystrokes/pastes at the input level (not just on submit)
// and surfaces a brief inline note, e.g. name/city/state fields reject digits
// and symbols, phone fields reject letters.
export function useRestrictedInput(kind: 'alpha' | 'numeric') {
  const { t } = useTranslation();
  const [warning, setWarning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pattern = PATTERNS[kind];

  const flash = useCallback(() => {
    setWarning(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setWarning(false), WARNING_DURATION_MS);
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!pattern.test(event.key)) {
        event.preventDefault();
        flash();
      }
    },
    [pattern, flash]
  );

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      const text = event.clipboardData.getData('text');
      if ([...text].some((char) => !pattern.test(char))) {
        event.preventDefault();
        flash();
      }
    },
    [pattern, flash]
  );

  return {
    warning: warning ? t(kind === 'alpha' ? 'noteAlphaOnly' : 'noteNumericOnly') : null,
    onKeyDown,
    onPaste,
  };
}
