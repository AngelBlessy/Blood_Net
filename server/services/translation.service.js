const { env } = require('../config/env');

const TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const MAX_BATCH_PER_REQUEST = 100;
const MAX_TEXT_LENGTH = 1000;
const MAX_TEXTS_PER_CALL = 500;

// Process-lifetime cache so the same string+language pair is only ever billed
// and fetched once per server run, no matter how many users request it.
const cache = new Map();

function cacheKey(target, text) {
  return `${target}::${text}`;
}

// Reusable service: translates a batch of source-language strings into the
// target language via Google Cloud Translation API (v2, API-key auth).
// Falls back to returning the original text (untranslated) whenever the API
// key isn't configured yet or a request fails, so callers never have to
// special-case a broken translation pipeline — the UI just shows English.
async function translateBatch(texts, target, source = 'en') {
  const safeTexts = texts.slice(0, MAX_TEXTS_PER_CALL).map((text) => String(text).slice(0, MAX_TEXT_LENGTH));
  if (!safeTexts.length || target === source) return safeTexts;

  if (!env.isTranslateConfigured()) {
    return safeTexts;
  }

  const results = new Array(safeTexts.length);
  const toFetch = [];
  const toFetchIndexes = [];

  safeTexts.forEach((text, index) => {
    const key = cacheKey(target, text);
    if (cache.has(key)) {
      results[index] = cache.get(key);
    } else {
      toFetch.push(text);
      toFetchIndexes.push(index);
    }
  });

  try {
    for (let i = 0; i < toFetch.length; i += MAX_BATCH_PER_REQUEST) {
      const chunk = toFetch.slice(i, i + MAX_BATCH_PER_REQUEST);
      const chunkIndexes = toFetchIndexes.slice(i, i + MAX_BATCH_PER_REQUEST);

      const url = `${TRANSLATE_ENDPOINT}?key=${encodeURIComponent(env.googleTranslate.apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: chunk, target, source, format: 'text' }),
      });

      if (!response.ok) {
        throw new Error(`Google Translate request failed with status ${response.status}`);
      }

      const data = await response.json();
      const translations = data?.data?.translations || [];

      translations.forEach((entry, chunkPos) => {
        const originalIndex = chunkIndexes[chunkPos];
        const translatedText = entry.translatedText ?? chunk[chunkPos];
        results[originalIndex] = translatedText;
        cache.set(cacheKey(target, chunk[chunkPos]), translatedText);
      });
    }
  } catch (error) {
    console.error('Translation API error, falling back to source text:', error.message);
    toFetchIndexes.forEach((originalIndex, i) => {
      if (results[originalIndex] === undefined) results[originalIndex] = toFetch[i];
    });
  }

  return results;
}

module.exports = { translateBatch };
