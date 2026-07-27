import { useTranslation } from 'react-i18next';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAQ_KEYS = [1, 2, 3, 4, 5] as const;

export function FaqSection() {
  const { t } = useTranslation();

  return (
    <section id="faq" className="scroll-mt-[4.5rem] bg-secondary/30 py-14">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight">{t('faqTitle')}</h2>

        <Accordion type="single" collapsible className="mt-6">
          {FAQ_KEYS.map((n) => (
            <AccordionItem key={n} value={`faq-${n}`}>
              <AccordionTrigger>{t(`faq${n}Question` as 'faq1Question')}</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <p>{t(`faq${n}Answer` as 'faq1Answer')}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
