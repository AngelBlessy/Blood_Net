const { findRankedDonors } = require('./donor-matching.service');
const { createDonor } = require('../test/helpers');

describe('donor-matching.service findRankedDonors', () => {
  it('returns an empty array when nobody is compatible/available', async () => {
    expect(await findRankedDonors('O+')).toEqual([]);
  });

  it('excludes an incompatible blood group', async () => {
    await createDonor({ bloodGroup: 'A+' });
    expect(await findRankedDonors('O+')).toHaveLength(0);
  });

  it('excludes a traveling donor unless includeTraveling is set', async () => {
    await createDonor({ bloodGroup: 'O+', traveling: true });
    expect(await findRankedDonors('O+')).toHaveLength(0);
    expect(await findRankedDonors('O+', { includeTraveling: true })).toHaveLength(1);
  });

  it('excludes a donor marked unavailable', async () => {
    await createDonor({ bloodGroup: 'O+', availabilityStatus: 'unavailable' });
    expect(await findRankedDonors('O+')).toHaveLength(0);
  });

  it('excludes a suspended donor account', async () => {
    await createDonor({ bloodGroup: 'O+', status: 'suspended' });
    expect(await findRankedDonors('O+')).toHaveLength(0);
  });

  it('excludeUserId skips one specific donor by their user id', async () => {
    const { user } = await createDonor({ bloodGroup: 'O+' });
    const others = await findRankedDonors('O+', { excludeUserId: user._id.toString() });
    expect(others).toHaveLength(0);
  });

  // Urgent/Routine priority requests scope matching to city+state instead of
  // radius (see request-alert.service.js) -- this is the branch that path
  // exercises.
  describe('city/state scoping (Urgent/Routine priority)', () => {
    it('matches a donor in the same city and state', async () => {
      await createDonor({ bloodGroup: 'O+', city: 'Bengaluru', state: 'Karnataka' });
      const results = await findRankedDonors('O+', { city: 'Bengaluru', state: 'Karnataka' });
      expect(results).toHaveLength(1);
    });

    it('is case-insensitive', async () => {
      await createDonor({ bloodGroup: 'O+', city: 'bengaluru', state: 'karnataka' });
      const results = await findRankedDonors('O+', { city: 'BENGALURU', state: 'KARNATAKA' });
      expect(results).toHaveLength(1);
    });

    it('excludes a donor in a different city', async () => {
      await createDonor({ bloodGroup: 'O+', city: 'Mumbai', state: 'Maharashtra' });
      const results = await findRankedDonors('O+', { city: 'Bengaluru', state: 'Karnataka' });
      expect(results).toHaveLength(0);
    });

    it('never excludes a donor whose profile is missing city/state (grandfathered profiles still match)', async () => {
      await createDonor({ bloodGroup: 'O+', city: null, state: null });
      const results = await findRankedDonors('O+', { city: 'Bengaluru', state: 'Karnataka' });
      expect(results).toHaveLength(1);
    });
  });

  describe('radius scoping (used when city/state are not both given)', () => {
    const origin = { lat: 12.9716, lng: 77.5946 };
    const near = { type: 'Point', coordinates: [77.6, 12.98] };
    const far = { type: 'Point', coordinates: [80.2707, 13.0827] }; // Chennai, ~290km away

    it('includes a donor within the radius and excludes one outside it', async () => {
      await createDonor({ bloodGroup: 'O+', location: near });
      await createDonor({ bloodGroup: 'O+', location: far });

      const results = await findRankedDonors('O+', { originPoint: origin, radiusKm: 25 });
      expect(results).toHaveLength(1);
    });

    it('never excludes a donor with no location at all', async () => {
      await createDonor({ bloodGroup: 'O+' });
      const results = await findRankedDonors('O+', { originPoint: origin, radiusKm: 25 });
      expect(results).toHaveLength(1);
    });
  });
});
