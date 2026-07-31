import { useTranslation } from 'react-i18next';
import { Sparkles, Users, Building2, HeartPulse, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { EmergencyRequestDialog } from './emergency-request-dialog';
import { LiveRequestCard } from './live-request-card';
import { useUiStore } from '@/store/ui-store';
import { useSessionStore } from '@/store/session-store';
import { useLiveDonorCount } from '@/hooks/use-live-donor-count';

export function HeroSection() {
  const { t } = useTranslation();
  const openAuthDialog = useUiStore((state) => state.openAuthDialog);
  const session = useSessionStore((state) => state.session);
  const liveDonorCount = useLiveDonorCount();

  const stats = [
    { icon: Users, value: liveDonorCount.toLocaleString('en-IN'), labelKey: 'statDonors' as const, live: true },
    { icon: Building2, value: '184', labelKey: 'statHospitals' as const },
    { icon: HeartPulse, value: '3,621', labelKey: 'statLives' as const },
    { icon: Timer, value: '47s', labelKey: 'statResponse' as const },
  ];

  return (
    <section
      id="home"
      className="mx-auto grid max-w-7xl gap-10 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:items-start lg:py-8 lg:px-8"
    >
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Sparkles className="size-3.5" />
          {t('heroPill')}
        </span>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{t('heroTitle')}</h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">{t('heroDesc')}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {!session && (
            <>
              <Button size="lg" onClick={() => openAuthDialog('register')}>
                {t('ctaRegister')}
              </Button>
              <Button variant="outline" size="lg" onClick={() => openAuthDialog('login')}>
                {t('ctaLogin')}
              </Button>
            </>
          )}
          <EmergencyRequestDialog variant="link" size="lg" className="text-base" />
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-4">
          {stats.map(({ icon, value, labelKey, live }) => (
            <StatCard
              key={labelKey}
              icon={icon}
              value={
                live ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                    {value}
                  </span>
                ) : (
                  value
                )
              }
              label={t(labelKey)}
            />
          ))}
        </dl>
      </div>

      <LiveRequestCard />
    </section>
  );
}
