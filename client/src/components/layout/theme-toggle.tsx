import { Moon, Sun, Lamp } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const THEME_ORDER = ['light', 'dark', 'comfort'] as const;
type ThemeName = (typeof THEME_ORDER)[number];

const THEME_ICON: Record<ThemeName, typeof Sun> = {
  light: Sun,
  dark: Moon,
  comfort: Lamp,
};

const THEME_LABEL_KEY: Record<ThemeName, 'switchToDark' | 'switchToComfort' | 'switchToLight'> = {
  light: 'switchToDark',
  dark: 'switchToComfort',
  comfort: 'switchToLight',
};

export function ThemeToggle() {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const current = (THEME_ORDER as readonly string[]).includes(resolvedTheme ?? '')
    ? (resolvedTheme as ThemeName)
    : 'light';

  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
  const label = t(THEME_LABEL_KEY[current]);
  const Icon = THEME_ICON[current];

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(nextTheme)} aria-label={label} title={label}>
      <Icon className="size-4.5" />
    </Button>
  );
}
