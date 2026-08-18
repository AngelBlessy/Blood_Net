const { haversineKm, toGeoPoint, extractLatLng, parseLocationFromBody, jitterPoint } = require('./geo.service');

describe('geo.service', () => {
  describe('extractLatLng', () => {
    it('reads a GeoJSON Point ({coordinates: [lng, lat]})', () => {
      expect(extractLatLng({ type: 'Point', coordinates: [77.5946, 12.9716] })).toEqual({ lat: 12.9716, lng: 77.5946 });
    });

    it('reads a plain {lat, lng} object', () => {
      expect(extractLatLng({ lat: 12.9716, lng: 77.5946 })).toEqual({ lat: 12.9716, lng: 77.5946 });
    });

    it('returns null for null/undefined/malformed input', () => {
      expect(extractLatLng(null)).toBeNull();
      expect(extractLatLng(undefined)).toBeNull();
      expect(extractLatLng({})).toBeNull();
      expect(extractLatLng({ coordinates: [1] })).toBeNull();
    });
  });

  describe('haversineKm', () => {
    it('returns 0 for identical points', () => {
      const point = { lat: 12.9716, lng: 77.5946 };
      expect(haversineKm(point, point)).toBeCloseTo(0, 5);
    });

    it('computes a known real-world distance within a small tolerance (Bengaluru to Chennai, ~290km)', () => {
      const bengaluru = { lat: 12.9716, lng: 77.5946 };
      const chennai = { lat: 13.0827, lng: 80.2707 };
      const distance = haversineKm(bengaluru, chennai);
      expect(distance).toBeGreaterThan(280);
      expect(distance).toBeLessThan(300);
    });

    it('is symmetric (A to B equals B to A)', () => {
      const a = { lat: 19.076, lng: 72.8777 };
      const b = { lat: 28.7041, lng: 77.1025 };
      expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
    });

    it('returns null when either point is missing/invalid', () => {
      expect(haversineKm(null, { lat: 1, lng: 1 })).toBeNull();
      expect(haversineKm({ lat: 1, lng: 1 }, null)).toBeNull();
    });
  });

  describe('toGeoPoint', () => {
    it('builds a valid GeoJSON Point from valid lat/lng', () => {
      expect(toGeoPoint({ lat: 12.9716, lng: 77.5946 })).toEqual({ type: 'Point', coordinates: [77.5946, 12.9716] });
    });

    it.each([
      ['non-numeric lat', { lat: 'x', lng: 77 }],
      ['out-of-range latitude', { lat: 91, lng: 77 }],
      ['out-of-range longitude', { lat: 10, lng: 181 }],
      ['NaN', { lat: NaN, lng: 77 }],
    ])('returns null for %s', (_label, input) => {
      expect(toGeoPoint(input)).toBeNull();
    });
  });

  describe('parseLocationFromBody', () => {
    it('parses city, state, and a valid lat/lng into a GeoJSON point', () => {
      const result = parseLocationFromBody({ city: ' Bengaluru ', state: ' Karnataka ', lat: '12.9716', lng: '77.5946' });
      expect(result.city).toBe('Bengaluru');
      expect(result.state).toBe('Karnataka');
      expect(result.location).toEqual({ type: 'Point', coordinates: [77.5946, 12.9716] });
    });

    it('never throws on a missing/malformed body, and returns nulls', () => {
      expect(parseLocationFromBody(undefined)).toEqual({ city: null, state: null, location: null });
      expect(parseLocationFromBody({})).toEqual({ city: null, state: null, location: null });
      expect(parseLocationFromBody({ city: '', lat: 'not-a-number', lng: 'also-not' })).toEqual({
        city: null,
        state: null,
        location: null,
      });
    });
  });

  describe('jitterPoint', () => {
    it('offsets a point by no more than maxOffsetKm', () => {
      const origin = { lat: 12.9716, lng: 77.5946 };
      for (let i = 0; i < 25; i += 1) {
        const jittered = jitterPoint(origin, 0.3);
        expect(haversineKm(origin, jittered)).toBeLessThanOrEqual(0.3 + 1e-6);
      }
    });

    it('returns null for an invalid point', () => {
      expect(jitterPoint(null)).toBeNull();
    });
  });
});
