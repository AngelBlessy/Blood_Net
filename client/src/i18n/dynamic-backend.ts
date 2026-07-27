import type { BackendModule, ReadCallback } from 'i18next';
import en from './locales/en.json';

type Dict = Record<string, string>;

const englishDict = en as Dict;

const CACHE_PREFIX = 'bloodnet.i18n.cache.v1.';

function cacheKeyFor(language: string) {
  return `${CACHE_PREFIX}${language}`;
}

function readCache(language: string): Dict | null {
  try {
    const raw = localStorage.getItem(cacheKeyFor(language));
    return raw ? (JSON.parse(raw) as Dict) : null;
  } catch {
    return null;
  }
}

function writeCache(language: string, dict: Dict) {
  try {
    localStorage.setItem(cacheKeyFor(language), JSON.stringify(dict));
  } catch {
    // localStorage full/unavailable — translations still work, just re-fetched next visit.
  }
}

// i18next interpolation placeholders (e.g. "{{units}}") would otherwise get
// mangled by machine translation (reordered, translated, respaced). Swap
// each one for a plain numeric token that MT engines reliably leave alone,
// then restore the original placeholder syntax after translation.
const INTERPOLATION_PATTERN = /\{\{\s*[\w.]+\s*\}\}/g;

function protectPlaceholders(text: string): { protectedText: string; placeholders: string[] } {
  const placeholders: string[] = [];
  const protectedText = text.replace(INTERPOLATION_PATTERN, (match) => {
    placeholders.push(match);
    return `%%${placeholders.length - 1}%%`;
  });
  return { protectedText, placeholders };
}

function restorePlaceholders(text: string, placeholders: string[]): string {
  if (!placeholders.length) return text;
  return text.replace(/%%\s*(\d+)\s*%%/g, (match, index: string) => placeholders[Number(index)] ?? match);
}

const CHUNK_SIZE = 100;

async function translateChunk(texts: string[], language: string): Promise<string[]> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, target: language, source: 'en' }),
  });

  if (!response.ok) throw new Error(`Translate request failed with status ${response.status}`);

  const data = (await response.json()) as { translations: string[] };
  return data.translations;
}

// Translates the entire English dictionary to `language`, chunked into
// modestly-sized requests (keeps each request body small and independently
// retryable), then caches the result client-side so repeated visits/reloads
// never re-call the API for text that's already been translated.
async function translateDictionary(language: string): Promise<Dict> {
  const keys = Object.keys(englishDict);
  const protectedEntries = keys.map((key) => protectPlaceholders(englishDict[key]));
  const texts = protectedEntries.map((entry) => entry.protectedText);

  const translations: string[] = [];
  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const chunk = texts.slice(i, i + CHUNK_SIZE);
    const translatedChunk = await translateChunk(chunk, language);
    translations.push(...translatedChunk);
  }

  const dict: Dict = {};
  keys.forEach((key, index) => {
    const translated = translations[index] ?? texts[index];
    dict[key] = restorePlaceholders(translated, protectedEntries[index].placeholders);
  });
  return dict;
}

// Custom i18next backend: instead of bundling a static JSON dictionary per
// language, it dynamically translates the English source strings via the
// Google Cloud Translation API-backed endpoint on first use per language,
// then caches the full dictionary in localStorage. Falls back to English on
// any failure so the UI never breaks.
export const dynamicBackend: BackendModule = {
  type: 'backend',
  init() {},
  async read(language: string, _namespace: string, callback: ReadCallback) {
    if (language === 'en') {
      callback(null, englishDict);
      return;
    }

    const cached = readCache(language);
    if (cached) {
      callback(null, cached);
      return;
    }

    try {
      const dict = await translateDictionary(language);
      writeCache(language, dict);
      callback(null, dict);
    } catch (error) {
      callback(error as Error, englishDict);
    }
  },
};
