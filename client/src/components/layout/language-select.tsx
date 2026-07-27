import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { languages } from '@/i18n/languages';

export function LanguageSelect() {
  const { t, i18n } = useTranslation();

  return (
    <Select value={i18n.resolvedLanguage} onValueChange={(value) => void i18n.changeLanguage(value)}>
      <SelectTrigger
        size="sm"
        className="w-auto gap-1.5 border-none shadow-none"
        aria-label={t('languageSelectionAria')}
      >
        <Globe className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {languages.map((language) => (
          <SelectItem key={language.code} value={language.code}>
            {language.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
