const { predictBatch } = require('./ai-prediction.service');

// ML_SERVICE_URL is deliberately left pointing at an unreachable address in
// the test environment (see server/test/global-setup.js), so every call here
// exercises the real fallback formula in ai-prediction.service.js -- not a
// mock of it.
describe('ai-prediction.service (fallback formula, ML service unreachable)', () => {
  it('returns an empty array for no features without making a request', async () => {
    expect(await predictBatch([])).toEqual([]);
  });

  it('returns one probability per input, each within [0, 1]', async () => {
    const features = [
      { daysSinceLastDonation: 10, pastResponseRate: 0.5, avgResponseTimeHours: 12, distanceKm: 5 },
      { daysSinceLastDonation: 90, pastResponseRate: 1, avgResponseTimeHours: 1, distanceKm: 1 },
      { daysSinceLastDonation: 0, pastResponseRate: 0, avgResponseTimeHours: 48, distanceKm: 100 },
    ];
    const results = await predictBatch(features);
    expect(results).toHaveLength(3);
    for (const probability of results) {
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
    }
  });

  it('scores a donor with a better response rate higher, all else equal', async () => {
    const base = { daysSinceLastDonation: 30, avgResponseTimeHours: 12, distanceKm: 10 };
    const [worse, better] = await predictBatch([
      { ...base, pastResponseRate: 0.1 },
      { ...base, pastResponseRate: 0.9 },
    ]);
    expect(better).toBeGreaterThan(worse);
  });

  it('scores a closer donor higher, all else equal', async () => {
    const base = { daysSinceLastDonation: 30, pastResponseRate: 0.5, avgResponseTimeHours: 12 };
    const [far, near] = await predictBatch([
      { ...base, distanceKm: 45 },
      { ...base, distanceKm: 2 },
    ]);
    expect(near).toBeGreaterThan(far);
  });

  it('scores a donor further past their last donation higher (more likely eligible/willing)', async () => {
    const base = { pastResponseRate: 0.5, avgResponseTimeHours: 12, distanceKm: 10 };
    const [recent, longAgo] = await predictBatch([
      { ...base, daysSinceLastDonation: 5 },
      { ...base, daysSinceLastDonation: 89 },
    ]);
    expect(longAgo).toBeGreaterThan(recent);
  });
});
