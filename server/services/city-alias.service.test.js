const { normalizeCity, sameCity, CANONICAL_NAMES } = require('./city-alias.service');

describe('services/city-alias', () => {
  describe('normalizeCity', () => {
    it('lowercases and trims an unlisted city, leaving it otherwise unchanged', () => {
      expect(normalizeCity('  Hyderabad  ')).toBe('hyderabad');
    });

    it('returns empty string for falsy input', () => {
      expect(normalizeCity('')).toBe('');
      expect(normalizeCity(null)).toBe('');
      expect(normalizeCity(undefined)).toBe('');
    });

    it('resolves a known alias to its canonical spelling', () => {
      expect(normalizeCity('Bangalore')).toBe('Bengaluru');
      expect(normalizeCity('bangalore')).toBe('Bengaluru');
      expect(normalizeCity('  BANGALORE  ')).toBe('Bengaluru');
    });

    it('resolves the canonical spelling itself to the same value regardless of case', () => {
      expect(normalizeCity('bengaluru')).toBe('Bengaluru');
      expect(normalizeCity('Bengaluru')).toBe('Bengaluru');
    });
  });

  describe('sameCity', () => {
    it('treats known aliases as the same city', () => {
      expect(sameCity('Bangalore', 'Bengaluru')).toBe(true);
      expect(sameCity('Bombay', 'mumbai')).toBe(true);
    });

    it('treats case/whitespace variants of an unlisted city as the same city', () => {
      expect(sameCity('Chennai', ' chennai ')).toBe(true);
    });

    it('treats different cities as different', () => {
      expect(sameCity('Chennai', 'Bengaluru')).toBe(false);
    });

    it('is false when either side is empty', () => {
      expect(sameCity('', 'Chennai')).toBe(false);
      expect(sameCity('Chennai', null)).toBe(false);
    });
  });

  it('CANONICAL_NAMES contains the canonical spelling used by normalizeCity', () => {
    expect(CANONICAL_NAMES.has('Bengaluru')).toBe(true);
    expect(CANONICAL_NAMES.has('Bangalore')).toBe(false);
  });
});
