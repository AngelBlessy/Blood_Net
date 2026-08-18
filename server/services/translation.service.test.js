const { translateBatch } = require('./translation.service');

// GOOGLE_TRANSLATE_API_KEY is deliberately blanked in the test environment
// (see server/test/global-setup.js), so every call here exercises the real
// "not configured" fallback path -- never a mocked network call.
describe('translation.service (Google Translate API key unconfigured)', () => {
  it('echoes back the source text untranslated and reports translated: false', async () => {
    const result = await translateBatch(['Hello', 'World'], 'hi', 'en');
    expect(result.translated).toBe(false);
    expect(result.translations).toEqual(['Hello', 'World']);
  });

  it('returns the input as-is (still translated: true) when source and target languages match', async () => {
    const result = await translateBatch(['Hello'], 'en', 'en');
    expect(result.translated).toBe(true);
    expect(result.translations).toEqual(['Hello']);
  });

  it('returns an empty array for an empty input list', async () => {
    const result = await translateBatch([], 'hi', 'en');
    expect(result.translations).toEqual([]);
  });

  it('truncates an overlong string rather than sending it whole', async () => {
    const longText = 'a'.repeat(2000);
    const result = await translateBatch([longText], 'hi', 'en');
    expect(result.translations[0].length).toBeLessThan(2000);
  });
});
