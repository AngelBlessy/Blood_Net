import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LanguageSelect } from '@/components/layout/language-select';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { apiPost } from '@/lib/api';
import type { User } from '@/types/domain';

const NAV_LINKS = [
  { to: '/', label: 'navHome' },
  { to: '/#roles', label: 'navRoles' },
  { to: '/#features', label: 'navFeatures' },
  { to: '/#faq', label: 'navFaq' },
] as const;

const WORKSPACE_LINKS = [
  { to: '/hospital', label: 'workspaceHospital' },
  { to: '/blood-bank', label: 'workspaceBloodBank' },
  { to: '/admin', label: 'workspaceAdmin' },
] as const;

function displayName(user: User): string {
  if (user.role === 'donor') return user.name;
  if (user.role === 'hospital') return user.hospitalName;
  if (user.role === 'bloodbank') return user.bankName;
  return 'Admin';
}

export function SiteHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const session = useSessionStore((state) => state.session);
  const setUser = useSessionStore((state) => state.setUser);
  const openAuthDialog = useUiStore((state) => state.openAuthDialog);

  function handleNavClick() {
    setMobileOpen(false);
  }

  async function handleLogout() {
    await apiPost('/auth/logout').catch(() => {});
    setUser(null);
    navigate('/');
  }

  const workspaceLinks = session
    ? WORKSPACE_LINKS.filter(
        (link) =>
          (link.to === '/hospital' && session.user.role === 'hospital') ||
          (link.to === '/blood-bank' && session.user.role === 'bloodbank') ||
          (link.to === '/admin' && session.user.role === 'admin')
      )
    : WORKSPACE_LINKS;

  const initial = session ? displayName(session.user).trim().charAt(0).toUpperCase() || 'U' : 'U';

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2" onClick={handleNavClick}>
          <img src="/bloodnet-logo.png" alt="" className="size-8 rounded-md" aria-hidden />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-semibold">BloodNet</span>
            <span className="text-[11px] text-muted-foreground">{t('brandTag')}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Button key={link.to} variant="ghost" size="sm" asChild>
              <Link to={link.to} onClick={handleNavClick}>
                {t(link.label)}
              </Link>
            </Button>
          ))}

          {workspaceLinks.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  {t('workspacesLabel')}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {workspaceLinks.map((link) => (
                  <DropdownMenuItem key={link.to} asChild>
                    <Link to={link.to}>{t(link.label)}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          <div className="hidden sm:block">
            <LanguageSelect />
          </div>
          <ThemeToggle />

          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label={t('accountMenuAria')}>
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/profile">{t('navProfile')}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>{t('logoutText')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Button variant="ghost" size="sm" onClick={() => openAuthDialog('login')}>
                {t('ctaLogin')}
              </Button>
              <Button size="sm" onClick={() => openAuthDialog('register')}>
                {t('ctaRegister')}
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={t('toggleNavAria')}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Button key={link.to} variant="ghost" size="sm" className="justify-start" asChild>
                <Link to={link.to} onClick={handleNavClick}>
                  {t(link.label)}
                </Link>
              </Button>
            ))}

            {workspaceLinks.length > 0 && (
              <p className="mt-2 px-2 text-xs font-medium text-muted-foreground">{t('workspacesLabel')}</p>
            )}
            {workspaceLinks.map((link) => (
              <Button key={link.to} variant="ghost" size="sm" className="justify-start" asChild>
                <Link to={link.to} onClick={handleNavClick}>
                  {t(link.label)}
                </Link>
              </Button>
            ))}

            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-3">
              <LanguageSelect />
              {!session && (
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => openAuthDialog('login')}>
                    {t('ctaLogin')}
                  </Button>
                  <Button size="sm" onClick={() => openAuthDialog('register')}>
                    {t('ctaRegister')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
