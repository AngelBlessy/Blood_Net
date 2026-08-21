const { agent, createDonor, createHospital, createBloodBank, loginAndGetCookie } = require('../helpers');
const Donation = require('../../models/donation.model');
const DonorProfile = require('../../models/donor-profile.model');
const BloodInventory = require('../../models/blood-inventory.model');

function requestPayload(overrides = {}) {
  return {
    patient: 'Test Patient',
    bloodGroup: 'O+',
    units: 2,
    priority: 'Critical',
    contactName: 'Contact Person',
    contactPhone: '9876543210',
    ...overrides,
  };
}

async function hospitalCookie(overrides = {}) {
  const { user, password } = await createHospital(overrides);
  const cookie = await loginAndGetCookie({ email: user.email, password });
  return { cookie, user };
}

describe('POST /api/hospital-requests (create)', () => {
  it('an approved hospital can raise a request, matching a compatible donor', async () => {
    await createDonor({ bloodGroup: 'O+', city: 'Testville', availabilityStatus: 'available' });
    const { cookie } = await hospitalCookie();

    const response = await agent().post('/api/hospital-requests').set('Cookie', cookie).send(requestPayload());
    expect(response.status).toBe(201);
    expect(response.body.request.bloodGroup).toBe('O+');
    expect(response.body.request.status).not.toBe('');
  });

  it('rejects a request from a hospital whose approval was revoked after their session started', async () => {
    // Login itself already blocks a still-pending hospital (see auth.test.js);
    // this isolates create()'s own defense-in-depth approval check by logging
    // in while approved, then revoking approval under an existing session.
    const { user, profile, password } = await createHospital({ approvalStatus: 'approved' });
    const cookie = await loginAndGetCookie({ email: user.email, password });
    profile.approvalStatus = 'pending';
    await profile.save();

    const response = await agent().post('/api/hospital-requests').set('Cookie', cookie).send(requestPayload());
    expect(response.status).toBe(403);
  });

  it('a donor can raise a request on their own behalf', async () => {
    const { user, password } = await createDonor();
    const cookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent().post('/api/hospital-requests').set('Cookie', cookie).send(requestPayload());
    expect(response.status).toBe(201);
    expect(response.body.request.raisedBy).toBe('donor');
  });

  it('rejects an unauthenticated request', async () => {
    const response = await agent().post('/api/hospital-requests').send(requestPayload());
    expect(response.status).toBe(401);
  });

  it.each([
    ['missing patient', { patient: '' }],
    ['invalid blood group', { bloodGroup: 'ZZ' }],
    ['zero units', { units: 0 }],
    ['invalid priority', { priority: 'Whenever' }],
    ['missing contact name', { contactName: '' }],
    ['invalid contact phone', { contactPhone: '123' }],
  ])('rejects request creation with %s', async (_label, overrides) => {
    const { cookie } = await hospitalCookie();
    const response = await agent().post('/api/hospital-requests').set('Cookie', cookie).send(requestPayload(overrides));
    expect(response.status).toBe(400);
  });
});

describe('GET /api/hospital-requests (list)', () => {
  it('mine=true for a hospital only returns that hospital\'s own requests', async () => {
    const { cookie: cookieA } = await hospitalCookie();
    const { cookie: cookieB } = await hospitalCookie();
    await agent().post('/api/hospital-requests').set('Cookie', cookieA).send(requestPayload({ patient: 'Patient A' }));
    await agent().post('/api/hospital-requests').set('Cookie', cookieB).send(requestPayload({ patient: 'Patient B' }));

    const response = await agent().get('/api/hospital-requests?mine=true').set('Cookie', cookieA);
    expect(response.body.requests).toHaveLength(1);
    expect(response.body.requests[0].patient).toBe('Patient A');
  });

  it('filters by bloodGroup and priority', async () => {
    const { cookie } = await hospitalCookie();
    await agent()
      .post('/api/hospital-requests')
      .set('Cookie', cookie)
      .send(requestPayload({ bloodGroup: 'O+', priority: 'Critical' }));
    await agent()
      .post('/api/hospital-requests')
      .set('Cookie', cookie)
      .send(requestPayload({ bloodGroup: 'A+', priority: 'Routine' }));

    const response = await agent().get('/api/hospital-requests?bloodGroup=A%2B&priority=Routine');
    expect(response.body.requests).toHaveLength(1);
    expect(response.body.requests[0].bloodGroup).toBe('A+');
  });

  it('is publicly readable without authentication (unfiltered)', async () => {
    const { cookie } = await hospitalCookie();
    await agent().post('/api/hospital-requests').set('Cookie', cookie).send(requestPayload());
    const response = await agent().get('/api/hospital-requests');
    expect(response.status).toBe(200);
    expect(response.body.requests.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PATCH /api/hospital-requests/:id (update / complete)', () => {
  it("the raising hospital can update their own request's patient/units", async () => {
    const { cookie } = await hospitalCookie();
    const created = await agent().post('/api/hospital-requests').set('Cookie', cookie).send(requestPayload());
    const id = created.body.request.id;

    const response = await agent().patch(`/api/hospital-requests/${id}`).set('Cookie', cookie).send({ units: 5 });
    expect(response.status).toBe(200);
    expect(response.body.request.units).toBe(5);
  });

  it('a different hospital cannot update someone else\'s request', async () => {
    const { cookie: owner } = await hospitalCookie();
    const { cookie: intruder } = await hospitalCookie();
    const created = await agent().post('/api/hospital-requests').set('Cookie', owner).send(requestPayload());

    const response = await agent()
      .patch(`/api/hospital-requests/${created.body.request.id}`)
      .set('Cookie', intruder)
      .send({ units: 99 });
    expect(response.status).toBe(403);
  });

  it('marking a request Completed creates a Donation for every donor who accepted, and updates their eligibility', async () => {
    const { profile: donorProfile, user: donorUser, password: donorPassword } = await createDonor({
      bloodGroup: 'O+',
      donatedEver: 'no',
    });
    const { cookie: hospitalCookieValue } = await hospitalCookie();

    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+' }));
    const requestId = created.body.request.id;

    const donorCookie = await loginAndGetCookie({ email: donorUser.email, password: donorPassword });
    const acceptResponse = await agent()
      .post(`/api/hospital-requests/${requestId}/respond`)
      .set('Cookie', donorCookie)
      .send({ response: 'Accepted' });
    expect(acceptResponse.status).toBe(200);

    const completeResponse = await agent()
      .patch(`/api/hospital-requests/${requestId}`)
      .set('Cookie', hospitalCookieValue)
      .send({ status: 'Completed' });
    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.request.status).toBe('Completed');

    const donations = await Donation.find({ donorId: donorProfile._id, requestId });
    expect(donations).toHaveLength(1);
    expect(donations[0].unitsDonated).toBe(1);

    const updatedDonor = await DonorProfile.findById(donorProfile._id);
    expect(updatedDonor.donatedEver).toBe('yes');
    expect(updatedDonor.lastDonationDate).not.toBeNull();
  });

  it('a blood bank that accepted the request can mark it Completed even though it did not raise it', async () => {
    const { user: bankUser, profile: bankProfile, password: bankPassword } = await createBloodBank();
    await BloodInventory.create({ bankId: bankProfile._id, bloodGroup: 'O+', units: 10 });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+', units: 1 }));

    const bankCookie = await loginAndGetCookie({ email: bankUser.email, password: bankPassword });
    await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Accepted' });

    const response = await agent()
      .patch(`/api/hospital-requests/${created.body.request.id}`)
      .set('Cookie', bankCookie)
      .send({ status: 'Completed' });
    expect(response.status).toBe(200);
    expect(response.body.request.status).toBe('Completed');
  });

  it('a blood bank that only declined (never accepted) cannot mark the request Completed', async () => {
    const { user: bankUser, profile: bankProfile, password: bankPassword } = await createBloodBank();
    await BloodInventory.create({ bankId: bankProfile._id, bloodGroup: 'O+', units: 10 });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+', units: 1 }));

    const bankCookie = await loginAndGetCookie({ email: bankUser.email, password: bankPassword });
    await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Declined' });

    const response = await agent()
      .patch(`/api/hospital-requests/${created.body.request.id}`)
      .set('Cookie', bankCookie)
      .send({ status: 'Completed' });
    expect(response.status).toBe(403);
  });

  it("a responding blood bank cannot edit the request's patient/units, even while also marking it Completed", async () => {
    const { user: bankUser, profile: bankProfile, password: bankPassword } = await createBloodBank();
    await BloodInventory.create({ bankId: bankProfile._id, bloodGroup: 'O+', units: 10 });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+', units: 1 }));

    const bankCookie = await loginAndGetCookie({ email: bankUser.email, password: bankPassword });
    await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Accepted' });

    const response = await agent()
      .patch(`/api/hospital-requests/${created.body.request.id}`)
      .set('Cookie', bankCookie)
      .send({ status: 'Completed', units: 99 });
    expect(response.status).toBe(403);
  });

  it('completing the same request twice does not create a duplicate donation', async () => {
    const { profile: donorProfile, user: donorUser, password: donorPassword } = await createDonor({ bloodGroup: 'O+' });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+' }));
    const requestId = created.body.request.id;

    const donorCookie = await loginAndGetCookie({ email: donorUser.email, password: donorPassword });
    await agent().post(`/api/hospital-requests/${requestId}/respond`).set('Cookie', donorCookie).send({ response: 'Accepted' });

    await agent().patch(`/api/hospital-requests/${requestId}`).set('Cookie', hospitalCookieValue).send({ status: 'Completed' });
    await agent().patch(`/api/hospital-requests/${requestId}`).set('Cookie', hospitalCookieValue).send({ status: 'Completed' });

    const donations = await Donation.find({ donorId: donorProfile._id, requestId });
    expect(donations).toHaveLength(1);
  });
});

describe('POST /api/hospital-requests/:id/respond (donor accept/decline)', () => {
  it('a donor within the 90-day eligibility window cannot accept', async () => {
    const recentDonation = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const { user, password } = await createDonor({ bloodGroup: 'O+', lastDonationDate: recentDonation });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+' }));

    const donorCookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond`)
      .set('Cookie', donorCookie)
      .send({ response: 'Accepted' });
    expect(response.status).toBe(403);
    expect(response.body.eligibility.eligible).toBe(false);
  });

  it('an ineligible donor can still decline', async () => {
    const recentDonation = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const { user, password } = await createDonor({ bloodGroup: 'O+', lastDonationDate: recentDonation });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+' }));

    const donorCookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond`)
      .set('Cookie', donorCookie)
      .send({ response: 'Declined' });
    expect(response.status).toBe(200);
  });

  it('rejects an invalid response value', async () => {
    const { user, password } = await createDonor({ bloodGroup: 'O+' });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+' }));

    const donorCookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond`)
      .set('Cookie', donorCookie)
      .send({ response: 'Maybe' });
    expect(response.status).toBe(400);
  });

  it('only a donor role can call this endpoint', async () => {
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload());

    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond`)
      .set('Cookie', hospitalCookieValue)
      .send({ response: 'Accepted' });
    expect(response.status).toBe(403);
  });
});

describe('POST /api/hospital-requests/:id/respond-bank', () => {
  it('an approved blood bank with enough stock can accept, deducting inventory', async () => {
    const { user: bankUser, profile: bankProfile, password: bankPassword } = await createBloodBank();
    await BloodInventory.create({ bankId: bankProfile._id, bloodGroup: 'O+', units: 10 });

    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+', units: 3 }));

    const bankCookie = await loginAndGetCookie({ email: bankUser.email, password: bankPassword });
    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Accepted' });
    expect(response.status).toBe(200);

    const inventory = await BloodInventory.findOne({ bankId: bankProfile._id, bloodGroup: 'O+' });
    expect(inventory.units).toBe(7);
  });

  it('rejects acceptance when the bank does not have enough stock', async () => {
    const { user: bankUser, profile: bankProfile, password: bankPassword } = await createBloodBank();
    await BloodInventory.create({ bankId: bankProfile._id, bloodGroup: 'O+', units: 1 });

    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+', units: 5 }));

    const bankCookie = await loginAndGetCookie({ email: bankUser.email, password: bankPassword });
    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Accepted' });
    expect(response.status).toBe(400);

    const inventory = await BloodInventory.findOne({ bankId: bankProfile._id, bloodGroup: 'O+' });
    expect(inventory.units).toBe(1); // unchanged
  });

  it('a blood bank cannot respond to a request twice', async () => {
    const { user: bankUser, profile: bankProfile, password: bankPassword } = await createBloodBank();
    await BloodInventory.create({ bankId: bankProfile._id, bloodGroup: 'O+', units: 10 });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+', units: 1 }));

    const bankCookie = await loginAndGetCookie({ email: bankUser.email, password: bankPassword });
    await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Accepted' });
    const second = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Declined' });
    expect(second.status).toBe(409);
  });

  it('a blood bank cannot respond to its own raised request', async () => {
    const { user: bankUser, password: bankPassword } = await createBloodBank();
    const bankCookie = await loginAndGetCookie({ email: bankUser.email, password: bankPassword });
    const created = await agent().post('/api/hospital-requests').set('Cookie', bankCookie).send(requestPayload());

    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Accepted' });
    expect(response.status).toBe(403);
  });
});

describe('GET /api/hospital-requests?respondedByBank=true', () => {
  it("lists a request the bank accepted, and keeps listing it once it's completed", async () => {
    const { user: bankUser, profile: bankProfile, password: bankPassword } = await createBloodBank();
    await BloodInventory.create({ bankId: bankProfile._id, bloodGroup: 'O+', units: 10 });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+', units: 1 }));

    const bankCookie = await loginAndGetCookie({ email: bankUser.email, password: bankPassword });
    await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Accepted' });

    const beforeComplete = await agent().get('/api/hospital-requests?respondedByBank=true').set('Cookie', bankCookie);
    expect(beforeComplete.status).toBe(200);
    expect(beforeComplete.body.requests.map((r) => r.id)).toContain(created.body.request.id);
    expect(beforeComplete.body.requests.find((r) => r.id === created.body.request.id).myBankResponse).toBe('Accepted');

    // Unlike forBloodBank=true (the "still deciding" feed), this one must NOT
    // drop the request once the raising hospital marks it Completed -- that's
    // the whole point of this endpoint (see list() in the controller).
    await agent()
      .patch(`/api/hospital-requests/${created.body.request.id}`)
      .set('Cookie', hospitalCookieValue)
      .send({ status: 'Completed' });

    const afterComplete = await agent().get('/api/hospital-requests?respondedByBank=true').set('Cookie', bankCookie);
    expect(afterComplete.body.requests.map((r) => r.id)).toContain(created.body.request.id);
    expect(afterComplete.body.requests.find((r) => r.id === created.body.request.id).status).toBe('Completed');
  });

  it('excludes a request the bank declined', async () => {
    const { user: bankUser, profile: bankProfile, password: bankPassword } = await createBloodBank();
    await BloodInventory.create({ bankId: bankProfile._id, bloodGroup: 'O+', units: 10 });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+', units: 1 }));

    const bankCookie = await loginAndGetCookie({ email: bankUser.email, password: bankPassword });
    await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Declined' });

    const response = await agent().get('/api/hospital-requests?respondedByBank=true').set('Cookie', bankCookie);
    expect(response.body.requests.map((r) => r.id)).not.toContain(created.body.request.id);
  });

  it("excludes a request accepted by a different blood bank", async () => {
    const { user: bankUser, profile: bankProfile, password: bankPassword } = await createBloodBank();
    await BloodInventory.create({ bankId: bankProfile._id, bloodGroup: 'O+', units: 10 });
    const { user: otherBankUser, password: otherBankPassword } = await createBloodBank({
      email: 'other-bank@example.com',
    });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload({ bloodGroup: 'O+', units: 1 }));

    const bankCookie = await loginAndGetCookie({ email: bankUser.email, password: bankPassword });
    await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond-bank`)
      .set('Cookie', bankCookie)
      .send({ response: 'Accepted' });

    const otherBankCookie = await loginAndGetCookie({ email: otherBankUser.email, password: otherBankPassword });
    const response = await agent()
      .get('/api/hospital-requests?respondedByBank=true')
      .set('Cookie', otherBankCookie);
    expect(response.body.requests.map((r) => r.id)).not.toContain(created.body.request.id);
  });

  it('rejects a non-bloodbank caller', async () => {
    const { cookie } = await hospitalCookie();
    const response = await agent().get('/api/hospital-requests?respondedByBank=true').set('Cookie', cookie);
    expect(response.status).toBe(403);
  });
});

describe('POST /api/hospital-requests/:id/notify and /notify-all', () => {
  it('notify re-runs matching and reports how many donors are now reached', async () => {
    await createDonor({ bloodGroup: 'O+' });
    const { cookie } = await hospitalCookie();
    const created = await agent().post('/api/hospital-requests').set('Cookie', cookie).send(requestPayload({ bloodGroup: 'O+' }));

    const response = await agent().post(`/api/hospital-requests/${created.body.request.id}/notify`).set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.request.matches).toBeGreaterThanOrEqual(1);
  });

  it('notify-all is hospital-only and rejects a donor caller', async () => {
    const { user, password } = await createDonor();
    const donorCookie = await loginAndGetCookie({ email: user.email, password });
    const { cookie: hospitalCookieValue } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookieValue)
      .send(requestPayload());

    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/notify-all`)
      .set('Cookie', donorCookie);
    expect(response.status).toBe(403);
  });

  it('notify-all reaches a traveling donor that the normal flow excludes', async () => {
    await createDonor({ bloodGroup: 'O+', traveling: true });
    const { cookie } = await hospitalCookie();
    const created = await agent().post('/api/hospital-requests').set('Cookie', cookie).send(requestPayload({ bloodGroup: 'O+' }));
    // The initial create() alert already ran and found nobody (traveling donor excluded).
    expect(created.body.request.matches).toBe(0);

    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/notify-all`)
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.request.matches).toBe(1);
  });

  it("notify-all only works on a request the hospital itself owns", async () => {
    const { cookie: owner } = await hospitalCookie();
    const { cookie: intruder } = await hospitalCookie();
    const created = await agent().post('/api/hospital-requests').set('Cookie', owner).send(requestPayload());

    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/notify-all`)
      .set('Cookie', intruder);
    expect(response.status).toBe(403);
  });

  it('notify-all reaches every donor account regardless of blood group or availability, unlike the normal flow', async () => {
    // Neither donor is O+ compatible, and the second is also marked
    // unavailable -- the normal matching flow (create()'s initial alert)
    // excludes both.
    await createDonor({ bloodGroup: 'AB-' });
    await createDonor({ bloodGroup: 'A-', availabilityStatus: 'unavailable' });
    const { cookie } = await hospitalCookie();
    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', cookie)
      .send(requestPayload({ bloodGroup: 'O+' }));
    expect(created.body.request.matches).toBe(0);

    const response = await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/notify-all`)
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.request.matches).toBe(2);
  });
});
