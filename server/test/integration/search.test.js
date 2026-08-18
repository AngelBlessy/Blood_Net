const { agent, createDonor } = require('../helpers');

describe('GET /api/search/donors', () => {
  it('requires a valid blood group', async () => {
    const missing = await agent().get('/api/search/donors');
    expect(missing.status).toBe(400);

    const invalid = await agent().get('/api/search/donors').query({ bloodGroup: 'ZZ' });
    expect(invalid.status).toBe(400);
  });

  it('returns compatible donors and excludes incompatible ones', async () => {
    await createDonor({ bloodGroup: 'O-', name: 'Compatible Donor' });
    await createDonor({ bloodGroup: 'A+', name: 'Incompatible Donor' });

    const response = await agent().get('/api/search/donors').query({ bloodGroup: 'O+' });
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].bloodGroup).toBe('O-');
  });

  it('excludes traveling donors', async () => {
    await createDonor({ bloodGroup: 'O+', traveling: true });
    const response = await agent().get('/api/search/donors').query({ bloodGroup: 'O+' });
    expect(response.body.results).toHaveLength(0);
  });

  it('excludes donors marked unavailable', async () => {
    await createDonor({ bloodGroup: 'O+', availabilityStatus: 'unavailable' });
    const response = await agent().get('/api/search/donors').query({ bloodGroup: 'O+' });
    expect(response.body.results).toHaveLength(0);
  });

  it('excludes donors whose account is suspended', async () => {
    await createDonor({ bloodGroup: 'O+', status: 'suspended' });
    const response = await agent().get('/api/search/donors').query({ bloodGroup: 'O+' });
    expect(response.body.results).toHaveLength(0);
  });

  it('masks the donor name to first name + last initial', async () => {
    await createDonor({ bloodGroup: 'O+', name: 'Priya Sharma' });
    const response = await agent().get('/api/search/donors').query({ bloodGroup: 'O+' });
    expect(response.body.results[0].name).toBe('Priya S.');
  });

  it('filters by city substring when no coordinates are given', async () => {
    await createDonor({ bloodGroup: 'O+', city: 'Bengaluru' });
    await createDonor({ bloodGroup: 'O+', city: 'Mumbai' });

    const response = await agent().get('/api/search/donors').query({ bloodGroup: 'O+', city: 'bengal' });
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].city).toBe('Bengaluru');
  });

  it('filters by radius when coordinates are given, excluding donors with no location', async () => {
    const near = { type: 'Point', coordinates: [77.6, 12.97] }; // ~a few km from origin below
    const far = { type: 'Point', coordinates: [80.27, 13.08] }; // Chennai, ~290km away
    await createDonor({ bloodGroup: 'O+', location: near });
    await createDonor({ bloodGroup: 'O+', location: far });
    await createDonor({ bloodGroup: 'O+' }); // no location at all

    const response = await agent()
      .get('/api/search/donors')
      .query({ bloodGroup: 'O+', lat: 12.9716, lng: 77.5946, radiusKm: 25 });
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].distanceKm).toBeLessThanOrEqual(25);
  });

  it('includes a priority score and AI confidence for every result', async () => {
    await createDonor({ bloodGroup: 'O+' });
    const response = await agent().get('/api/search/donors').query({ bloodGroup: 'O+' });
    expect(response.body.results[0]).toHaveProperty('priorityScore');
    expect(['High', 'Medium', 'Low']).toContain(response.body.results[0].aiConfidence);
  });
});
