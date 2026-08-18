const { agent, createBloodBank, loginAndGetCookie, createDonor } = require('../helpers');
const BloodInventory = require('../../models/blood-inventory.model');

describe('GET /api/inventory', () => {
  it('is public and returns totals aggregated across every blood bank', async () => {
    const { profile: bankA } = await createBloodBank();
    const { profile: bankB } = await createBloodBank();
    await BloodInventory.create({ bankId: bankA._id, bloodGroup: 'O+', units: 3 });
    await BloodInventory.create({ bankId: bankB._id, bloodGroup: 'O+', units: 4 });
    await BloodInventory.create({ bankId: bankA._id, bloodGroup: 'A-', units: 2 });

    const response = await agent().get('/api/inventory');
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(8);
    expect(response.body.items.find((item) => item.group === 'O+').units).toBe(7);
    expect(response.body.items.find((item) => item.group === 'A-').units).toBe(2);
    expect(response.body.items.find((item) => item.group === 'B+').units).toBe(0);
  });

  it('mine=true requires an authenticated blood bank and returns only that bank\'s stock', async () => {
    const { user, profile, password } = await createBloodBank();
    await BloodInventory.create({ bankId: profile._id, bloodGroup: 'O+', units: 5 });
    const { profile: otherBank } = await createBloodBank();
    await BloodInventory.create({ bankId: otherBank._id, bloodGroup: 'O+', units: 9 });

    const cookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent().get('/api/inventory?mine=true').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].units).toBe(5);
    expect(response.body.items[0].bankId).toBe(profile._id.toString());
  });

  it('mine=true rejects a non-bloodbank caller', async () => {
    const { user, password } = await createDonor();
    const cookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent().get('/api/inventory?mine=true').set('Cookie', cookie);
    expect(response.status).toBe(403);
  });
});

describe('PUT /api/inventory/:bloodGroup', () => {
  it('an approved blood bank can set its own stock level for a group', async () => {
    const { user, profile, password } = await createBloodBank({ approvalStatus: 'approved' });
    const cookie = await loginAndGetCookie({ email: user.email, password });

    const response = await agent().put('/api/inventory/O+').set('Cookie', cookie).send({ units: 12 });
    expect(response.status).toBe(200);
    expect(response.body.item.units).toBe(12);

    const stored = await BloodInventory.findOne({ bankId: profile._id, bloodGroup: 'O+' });
    expect(stored.units).toBe(12);
  });

  it('a blood bank whose approval was revoked after login cannot set stock', async () => {
    // Login itself already blocks a still-pending blood bank; this isolates
    // upsert()'s own defense-in-depth approval check the same way the
    // equivalent hospital-requests test does.
    const { user, profile, password } = await createBloodBank({ approvalStatus: 'approved' });
    const cookie = await loginAndGetCookie({ email: user.email, password });
    profile.approvalStatus = 'pending';
    await profile.save();

    const response = await agent().put('/api/inventory/O+').set('Cookie', cookie).send({ units: 5 });
    expect(response.status).toBe(403);
  });

  it('rejects an invalid blood group in the URL', async () => {
    const { user, password } = await createBloodBank();
    const cookie = await loginAndGetCookie({ email: user.email, password });

    const response = await agent().put('/api/inventory/ZZ').set('Cookie', cookie).send({ units: 5 });
    expect(response.status).toBe(400);
  });

  it('rejects a negative or non-integer unit count', async () => {
    const { user, password } = await createBloodBank();
    const cookie = await loginAndGetCookie({ email: user.email, password });

    const negative = await agent().put('/api/inventory/O+').set('Cookie', cookie).send({ units: -1 });
    expect(negative.status).toBe(400);

    const nonInteger = await agent().put('/api/inventory/O+').set('Cookie', cookie).send({ units: 1.5 });
    expect(nonInteger.status).toBe(400);
  });

  it('rejects a non-bloodbank role entirely', async () => {
    const { user, password } = await createDonor();
    const cookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent().put('/api/inventory/O+').set('Cookie', cookie).send({ units: 5 });
    expect(response.status).toBe(403);
  });
});
