import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:px-8">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <img src="/bloodnet-logo.png" alt="BloodNet logo" className="size-8 rounded-md" />
            <span className="font-display text-lg font-semibold">BloodNet</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">{t('footerBrandDesc')}</p>
          <p className="mt-1 text-sm text-muted-foreground">@2026bloodnet</p>
        </div>

        <div>
          <h4 className="text-sm font-semibold">{t('footerTeam')}</h4>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>{t('team1')}</li>
            <li>{t('team2')}</li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold">{t('footerLinks')}</h4>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link to="/#features" className="text-muted-foreground hover:text-foreground">
                {t('footerLink1')}
              </Link>
            </li>
            <li>
              <Link to="/#compatibility" className="text-muted-foreground hover:text-foreground">
                {t('navCompatibility')}
              </Link>
            </li>
            <li>
              <Link to="/#faq" className="text-muted-foreground hover:text-foreground">
                {t('navFaq')}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
