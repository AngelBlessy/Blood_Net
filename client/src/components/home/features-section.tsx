import { useTranslation } from 'react-i18next';
import { Bell, Brain, ListOrdered, Award, MapPin, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';

const FEATURES = [
  { icon: Bell, titleKey: 'feature1Title', descKey: 'feature1Desc' },
  { icon: Brain, titleKey: 'feature2Title', descKey: 'feature2Desc' },
  { icon: ListOrdered, titleKey: 'feature3Title', descKey: 'feature3Desc' },
  { icon: Award, titleKey: 'feature4Title', descKey: 'feature4Desc' },
  { icon: MapPin, titleKey: 'feature5Title', descKey: 'feature5Desc' },
  { icon: BarChart3, titleKey: 'feature6Title', descKey: 'feature6Desc' },
] as const;

export function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-[4.5rem] px-4 py-14 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <span className="text-sm font-medium text-primary">{t('featuresEyebrow')}</span>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{t('featuresTitle')}</h2>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, titleKey, descKey }) => (
          <Card key={titleKey} className="gap-3 p-5">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <h3 className="font-semibold">{t(titleKey)}</h3>
            <p className="text-sm text-muted-foreground">{t(descKey)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
