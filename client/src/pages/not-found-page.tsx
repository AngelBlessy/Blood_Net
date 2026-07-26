import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">{t('notFoundTitle')}</h1>
      <p className="text-muted-foreground">{t('notFoundDesc')}</p>
      <Button asChild>
        <Link to="/">{t('notFoundBack')}</Link>
      </Button>
    </div>
  );
}
