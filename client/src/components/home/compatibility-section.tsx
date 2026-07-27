import { useTranslation } from 'react-i18next';
import { CompatibilityTable } from './compatibility-table';

export function CompatibilitySection() {
  const { t } = useTranslation();

  return (
    <section id="compatibility" className="scroll-mt-[4.5rem] bg-secondary/30 py-14">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <span className="text-sm font-medium text-primary">{t('compatibilityEyebrow')}</span>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{t('compatibilityTitle')}</h2>
        <p className="mt-2 text-muted-foreground">{t('compatibilityDesc')}</p>

        <div className="mt-6">
          <CompatibilityTable />
        </div>
      </div>
    </section>
  );
}
