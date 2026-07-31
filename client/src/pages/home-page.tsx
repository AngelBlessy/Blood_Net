import { HeroSection } from '@/components/home/hero-section';
import { CompatibilitySection } from '@/components/home/compatibility-section';
import { FeaturesSection } from '@/components/home/features-section';
import { FaqSection } from '@/components/home/faq-section';

export function HomePage() {
  return (
    <>
      <HeroSection />
      <CompatibilitySection />
      <FeaturesSection />
      <FaqSection />
    </>
  );
}
