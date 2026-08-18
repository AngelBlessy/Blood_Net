const {
  isDonorCompatible,
  compatibleDonorGroups,
  COMPATIBLE_DONOR_GROUPS,
} = require('./blood-compatibility.service');

describe('blood-compatibility.service', () => {
  describe('isDonorCompatible', () => {
    it('O- can donate to every blood group (universal donor)', () => {
      for (const patientGroup of Object.keys(COMPATIBLE_DONOR_GROUPS)) {
        expect(isDonorCompatible(patientGroup, 'O-')).toBe(true);
      }
    });

    it('AB+ patients can receive from every donor group (universal recipient)', () => {
      for (const donorGroup of Object.keys(COMPATIBLE_DONOR_GROUPS)) {
        expect(isDonorCompatible('AB+', donorGroup)).toBe(true);
      }
    });

    it('AB+ donors can only give to AB+ patients (not the reverse of being a universal recipient)', () => {
      for (const patientGroup of Object.keys(COMPATIBLE_DONOR_GROUPS)) {
        expect(isDonorCompatible(patientGroup, 'AB+')).toBe(patientGroup === 'AB+');
      }
    });

    it('rejects an incompatible pairing (A+ patient cannot receive B+ blood)', () => {
      expect(isDonorCompatible('A+', 'B+')).toBe(false);
    });

    it('accepts a same-group pairing for every blood group', () => {
      for (const group of Object.keys(COMPATIBLE_DONOR_GROUPS)) {
        expect(isDonorCompatible(group, group)).toBe(true);
      }
    });

    it('returns false for an unknown patient group instead of throwing', () => {
      expect(isDonorCompatible('XX', 'O-')).toBe(false);
    });
  });

  describe('compatibleDonorGroups', () => {
    it('returns the full compatible-donor list for a known group', () => {
      expect(compatibleDonorGroups('O+')).toEqual(['O+', 'O-']);
    });

    it('returns an empty array for an unknown group', () => {
      expect(compatibleDonorGroups('unknown')).toEqual([]);
    });
  });
});
