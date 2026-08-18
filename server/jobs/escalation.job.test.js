const { runEscalationCheck, runTierNotifyCheck } = require('./escalation.job');
const BloodRequest = require('../models/blood-request.model');
const { RADIUS_STEPS_KM } = require('../constants');
const { createDonor } = require('../test/helpers');

const PAST = new Date(Date.now() - 60 * 1000);
const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const BENGALURU = { type: 'Point', coordinates: [77.5946, 12.9716] };

function baseRequest(overrides = {}) {
  return {
    patient: 'Escalation Patient',
    bloodGroup: 'O+',
    unitsRequired: 1,
    raisedBy: 'hospital',
    priority: 'Critical',
    status: 'Sending emergency alerts',
    location: BENGALURU,
    searchRadiusKm: RADIUS_STEPS_KM[0],
    radiusExpansions: 0,
    nextEscalationAt: PAST,
    escalationDone: false,
    notifiedDonorIds: [],
    nextTierNotifyAt: PAST,
    tierNotifyDone: true,
    ...overrides,
  };
}

describe('runEscalationCheck', () => {
  it('widens a stale, due request to the next radius step', async () => {
    const request = await BloodRequest.create(baseRequest({ searchRadiusKm: RADIUS_STEPS_KM[0] }));

    const widened = await runEscalationCheck();
    expect(widened).toBe(1);

    const updated = await BloodRequest.findById(request._id);
    expect(updated.searchRadiusKm).toBe(RADIUS_STEPS_KM[1]);
    expect(updated.radiusExpansions).toBe(1);
    expect(updated.escalationDone).toBe(false);
    expect(updated.nextEscalationAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('marks escalationDone instead of widening past the last radius step', async () => {
    const request = await BloodRequest.create(
      baseRequest({ searchRadiusKm: RADIUS_STEPS_KM[RADIUS_STEPS_KM.length - 1] })
    );

    await runEscalationCheck();

    const updated = await BloodRequest.findById(request._id);
    expect(updated.searchRadiusKm).toBe(RADIUS_STEPS_KM[RADIUS_STEPS_KM.length - 1]);
    expect(updated.escalationDone).toBe(true);
  });

  it('sets escalationDone on reaching the second-to-last step in one hop, not just the last', async () => {
    const secondToLastIndex = RADIUS_STEPS_KM.length - 2;
    const request = await BloodRequest.create(baseRequest({ searchRadiusKm: RADIUS_STEPS_KM[secondToLastIndex] }));

    await runEscalationCheck();

    const updated = await BloodRequest.findById(request._id);
    expect(updated.searchRadiusKm).toBe(RADIUS_STEPS_KM[secondToLastIndex + 1]);
    expect(updated.escalationDone).toBe(true);
  });

  it('ignores a request with no location (radius has no meaning without one)', async () => {
    const request = await BloodRequest.create({
      ...baseRequest(),
      location: undefined,
    });

    await runEscalationCheck();

    const updated = await BloodRequest.findById(request._id);
    expect(updated.searchRadiusKm).toBe(RADIUS_STEPS_KM[0]);
    expect(updated.radiusExpansions).toBe(0);
  });

  it('ignores a request that is not due yet', async () => {
    const request = await BloodRequest.create(baseRequest({ nextEscalationAt: FUTURE }));
    await runEscalationCheck();
    const updated = await BloodRequest.findById(request._id);
    expect(updated.searchRadiusKm).toBe(RADIUS_STEPS_KM[0]);
  });

  it('ignores a Completed request even if otherwise due', async () => {
    const request = await BloodRequest.create(baseRequest({ status: 'Completed' }));
    await runEscalationCheck();
    const updated = await BloodRequest.findById(request._id);
    expect(updated.searchRadiusKm).toBe(RADIUS_STEPS_KM[0]);
  });

  it('resets tier-notify progress when widening turns up a new compatible donor', async () => {
    await createDonor({ bloodGroup: 'O+', location: BENGALURU, city: null });
    const request = await BloodRequest.create(baseRequest({ tierNotifyDone: true }));

    await runEscalationCheck();

    const updated = await BloodRequest.findById(request._id);
    expect(updated.matches).toBeGreaterThan(0);
    expect(updated.tierNotifyDone).toBe(false);
  });
});

describe('runTierNotifyCheck', () => {
  it('marks tierNotifyDone when there is nobody left to notify', async () => {
    const request = await BloodRequest.create(baseRequest({ tierNotifyDone: false, nextTierNotifyAt: PAST }));

    const notified = await runTierNotifyCheck();
    expect(notified).toBe(0);

    const updated = await BloodRequest.findById(request._id);
    expect(updated.tierNotifyDone).toBe(true);
  });

  it('notifies the next tier of a compatible donor and keeps tierNotifyDone false', async () => {
    await createDonor({ bloodGroup: 'O+', location: BENGALURU, city: null });
    const request = await BloodRequest.create(baseRequest({ tierNotifyDone: false, nextTierNotifyAt: PAST }));

    const notified = await runTierNotifyCheck();
    expect(notified).toBe(1);

    const updated = await BloodRequest.findById(request._id);
    expect(updated.tierNotifyDone).toBe(false);
    expect(updated.notifiedDonorIds.length).toBeGreaterThan(0);
    expect(updated.nextTierNotifyAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('ignores a request that is not due yet', async () => {
    const request = await BloodRequest.create(baseRequest({ tierNotifyDone: false, nextTierNotifyAt: FUTURE }));
    const notified = await runTierNotifyCheck();
    expect(notified).toBe(0);
    const updated = await BloodRequest.findById(request._id);
    expect(updated.tierNotifyDone).toBe(false); // untouched, not flipped
  });
});
