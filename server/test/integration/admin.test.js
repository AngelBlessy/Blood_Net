const {
  agent,
  createDonor,
  createHospital,
  createBloodBank,
  createAdmin,
  loginAndGetCookie,
} = require('../helpers');
const HospitalProfile = require('../../models/hospital-profile.model');
const BloodBankProfile = require('../../models/blood-bank-profile.model');

async function adminCookie(overrides = {}) {
  const { user, password } = await createAdmin(overrides);
  return loginAndGetCookie({ email: user.email, password });
}

describe('admin routes: access control', () => {
  it('rejects every /admin route when not authenticated', async () => {
    const response = await agent().get('/api/admin/stats');
    expect(response.status).toBe(401);
  });

  it('rejects a non-admin (e.g. donor) with 403', async () => {
    const { user, password } = await createDonor();
    const cookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent().get('/api/admin/stats').set('Cookie', cookie);
    expect(response.status).toBe(403);
  });
});

describe('GET /api/admin/stats', () => {
  it('reports donor count and inventory shape', async () => {
    await createDonor();
    await createDonor();
    const cookie = await adminCookie();

    const response = await agent().get('/api/admin/stats').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.donorCount).toBe(2);
    expect(response.body.inventory).toHaveLength(8); // one entry per BLOOD_GROUPS
    expect(Array.isArray(response.body.lowStockGroups)).toBe(true);
  });
});

describe('GET /api/admin/analytics', () => {
  it('returns every documented section of the payload', async () => {
    await createDonor();
    const cookie = await adminCookie();

    const response = await agent().get('/api/admin/analytics').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      donorCount: expect.any(Number),
      hospitalsCount: expect.any(Number),
      bloodBanksCount: expect.any(Number),
      openRequests: expect.any(Number),
      totalDonations: expect.any(Number),
    });
    expect(response.body.bloodGroupDemand).toHaveLength(8);
    expect(response.body.donorsByBloodGroup).toHaveLength(8);
    expect(response.body.requestsByPriority).toHaveLength(3);
    expect(response.body.donorAvailability).toMatchObject({
      available: expect.any(Number),
      traveling: expect.any(Number),
    });
    expect(response.body.retention).toMatchObject({ registered: expect.any(Number) });
  });
});

describe('GET /api/admin/trends', () => {
  it('defaults to a 6-month, month-granularity window', async () => {
    const cookie = await adminCookie();
    const response = await agent().get('/api/admin/trends').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.granularity).toBe('month');
    expect(response.body.points).toHaveLength(6);
  });

  it('returns 30 daily points for range=1m', async () => {
    const cookie = await adminCookie();
    const response = await agent().get('/api/admin/trends?range=1m').set('Cookie', cookie);
    expect(response.body.granularity).toBe('day');
    expect(response.body.points).toHaveLength(30);
  });

  it('returns 12 monthly points for range=1y', async () => {
    const cookie = await adminCookie();
    const response = await agent().get('/api/admin/trends?range=1y').set('Cookie', cookie);
    expect(response.body.granularity).toBe('month');
    expect(response.body.points).toHaveLength(12);
  });

  it('falls back to the 6-month default for an unrecognized range value', async () => {
    const cookie = await adminCookie();
    const response = await agent().get('/api/admin/trends?range=nonsense').set('Cookie', cookie);
    expect(response.body.points).toHaveLength(6);
  });
});

describe('Hospital and blood bank approvals', () => {
  it('lists only pending hospitals, and approving one flips its approvalStatus', async () => {
    const { profile: pendingHospital } = await createHospital({ approvalStatus: 'pending' });
    await createHospital({ approvalStatus: 'approved' });
    const cookie = await adminCookie();

    const pendingResponse = await agent().get('/api/admin/hospitals/pending').set('Cookie', cookie);
    expect(pendingResponse.body.hospitals).toHaveLength(1);
    expect(pendingResponse.body.hospitals[0].id).toBe(pendingHospital._id.toString());

    const decideResponse = await agent()
      .post(`/api/admin/hospitals/${pendingHospital._id}/approve`)
      .set('Cookie', cookie);
    expect(decideResponse.status).toBe(200);
    expect(decideResponse.body.hospital.approvalStatus).toBe('approved');

    const updated = await HospitalProfile.findById(pendingHospital._id);
    expect(updated.approvalStatus).toBe('approved');
  });

  it('rejecting a hospital requires a reason', async () => {
    const { profile } = await createHospital({ approvalStatus: 'pending' });
    const cookie = await adminCookie();

    const response = await agent().post(`/api/admin/hospitals/${profile._id}/reject`).set('Cookie', cookie);
    expect(response.status).toBe(400);
  });

  it('rejecting a hospital with a reason sets approvalStatus, stores the reason, and logs an approval decision', async () => {
    const { profile } = await createHospital({ approvalStatus: 'pending' });
    const cookie = await adminCookie();

    const response = await agent()
      .post(`/api/admin/hospitals/${profile._id}/reject`)
      .set('Cookie', cookie)
      .send({ reason: 'License number does not match the uploaded document.' });
    expect(response.status).toBe(200);
    expect(response.body.hospital.approvalStatus).toBe('rejected');

    const updated = await HospitalProfile.findById(profile._id);
    expect(updated.approvalStatus).toBe('rejected');
    expect(updated.rejectionReason).toBe('License number does not match the uploaded document.');

    const historyResponse = await agent().get('/api/admin/approval-history').set('Cookie', cookie);
    expect(historyResponse.status).toBe(200);
    const entry = historyResponse.body.decisions.find((d) => d.entityName === profile.hospitalName);
    expect(entry).toBeTruthy();
    expect(entry.decision).toBe('rejected');
    expect(entry.reason).toBe('License number does not match the uploaded document.');
    expect(entry.createdAt).toBeTruthy();
  });

  it('returns 404 for a hospital id that does not exist', async () => {
    const cookie = await adminCookie();
    const response = await agent()
      .post('/api/admin/hospitals/000000000000000000000000/approve')
      .set('Cookie', cookie);
    expect(response.status).toBe(404);
  });

  it('lists and approves pending blood banks the same way', async () => {
    const { profile } = await createBloodBank({ approvalStatus: 'pending' });
    const cookie = await adminCookie();

    const pendingResponse = await agent().get('/api/admin/bloodbanks/pending').set('Cookie', cookie);
    expect(pendingResponse.body.bloodBanks).toHaveLength(1);

    const decideResponse = await agent().post(`/api/admin/bloodbanks/${profile._id}/approve`).set('Cookie', cookie);
    expect(decideResponse.body.bloodBank.approvalStatus).toBe('approved');

    const updated = await BloodBankProfile.findById(profile._id);
    expect(updated.approvalStatus).toBe('approved');
  });
});

describe('GET /api/admin/users', () => {
  it('lists donor/hospital/bloodbank accounts merged with their display name', async () => {
    const { user: donorUser, profile: donorProfile } = await createDonor({ name: 'Alex Donor' });
    await createHospital();
    const cookie = await adminCookie();

    const response = await agent().get('/api/admin/users').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    const donorEntry = response.body.users.find((entry) => entry.id === donorUser._id.toString());
    expect(donorEntry).toMatchObject({ name: 'Alex Donor', role: 'donor', email: donorUser.email });
    expect(donorEntry.name).toBe(donorProfile.name);
  });

  it('filters by role', async () => {
    await createDonor();
    await createHospital();
    const cookie = await adminCookie();

    const response = await agent().get('/api/admin/users?role=hospital').set('Cookie', cookie);
    expect(response.body.total).toBe(1);
    expect(response.body.users[0].role).toBe('hospital');
  });

  it('filters by status', async () => {
    await createDonor({ status: 'active' });
    await createDonor({ status: 'suspended' });
    const cookie = await adminCookie();

    const response = await agent().get('/api/admin/users?status=suspended').set('Cookie', cookie);
    expect(response.body.total).toBe(1);
    expect(response.body.users[0].status).toBe('suspended');
  });

  it('searches by email or phone substring', async () => {
    const { user } = await createDonor({ email: 'findme-unique@bloodnet.test' });
    await createDonor();
    const cookie = await adminCookie();

    const response = await agent().get('/api/admin/users?search=findme-unique').set('Cookie', cookie);
    expect(response.body.total).toBe(1);
    expect(response.body.users[0].id).toBe(user._id.toString());
  });

  it('never includes admin accounts in the list', async () => {
    await createAdmin();
    await createDonor();
    const cookie = await adminCookie();

    const response = await agent().get('/api/admin/users').set('Cookie', cookie);
    expect(response.body.users.every((entry) => entry.role !== 'admin')).toBe(true);
  });

  it('surfaces a suspended user\'s reactivation request, and clears it once an admin acts on it', async () => {
    const { user, password } = await createDonor({ status: 'suspended' });
    const cookie = await adminCookie();

    await agent().post('/api/auth/request-reactivation').send({ email: user.email });

    const before = await agent().get('/api/admin/users').set('Cookie', cookie);
    const beforeEntry = before.body.users.find((entry) => entry.id === user._id.toString());
    expect(beforeEntry.reactivationRequestedAt).toBeTruthy();

    await agent().post(`/api/admin/users/${user._id}/activate`).set('Cookie', cookie);

    const after = await agent().get('/api/admin/users').set('Cookie', cookie);
    const afterEntry = after.body.users.find((entry) => entry.id === user._id.toString());
    expect(afterEntry.reactivationRequestedAt).toBeNull();

    const loginResponse = await agent().post('/api/auth/login').send({ email: user.email, password });
    expect(loginResponse.status).toBe(200);
  });

  it('surfaces a hospital\'s approval status and rejection reason', async () => {
    const { user } = await createHospital({ approvalStatus: 'rejected', rejectionReason: 'Bad license number.' });
    const cookie = await adminCookie();

    const response = await agent().get('/api/admin/users').set('Cookie', cookie);
    const entry = response.body.users.find((item) => item.id === user._id.toString());
    expect(entry.approvalStatus).toBe('rejected');
    expect(entry.rejectionReason).toBe('Bad license number.');
  });

  it('lists a separate approvalId (the profile id) distinct from the user id, and it actually works against the approve endpoint', async () => {
    const { user, profile } = await createHospital({ approvalStatus: 'pending' });
    const cookie = await adminCookie();

    const response = await agent().get('/api/admin/users').set('Cookie', cookie);
    const entry = response.body.users.find((item) => item.id === user._id.toString());
    expect(entry.approvalId).toBe(profile._id.toString());
    expect(entry.approvalId).not.toBe(entry.id);

    // Regression check: approving via entry.id (the User id) must NOT work --
    // this is the exact mistake that caused "Hospital not found" in the UI.
    const wrongIdAttempt = await agent().post(`/api/admin/hospitals/${entry.id}/approve`).set('Cookie', cookie);
    expect(wrongIdAttempt.status).toBe(404);

    const correctAttempt = await agent().post(`/api/admin/hospitals/${entry.approvalId}/approve`).set('Cookie', cookie);
    expect(correctAttempt.status).toBe(200);
    expect(correctAttempt.body.hospital.approvalStatus).toBe('approved');
  });
});

describe('POST /api/admin/users/:id/suspend and /activate', () => {
  it('suspending a user blocks their login, and reactivating restores it', async () => {
    const { user, password } = await createDonor();
    const cookie = await adminCookie();

    const suspendResponse = await agent()
      .post(`/api/admin/users/${user._id}/suspend`)
      .set('Cookie', cookie)
      .send({ reason: 'Multiple reports of no-show donations.' });
    expect(suspendResponse.status).toBe(200);
    expect(suspendResponse.body.status).toBe('suspended');

    const blockedLogin = await agent().post('/api/auth/login').send({ email: user.email, password });
    expect(blockedLogin.status).toBe(403);
    expect(blockedLogin.body.error).toMatch(/Multiple reports of no-show donations\./);

    const activateResponse = await agent().post(`/api/admin/users/${user._id}/activate`).set('Cookie', cookie);
    expect(activateResponse.body.status).toBe('active');

    const restoredLogin = await agent().post('/api/auth/login').send({ email: user.email, password });
    expect(restoredLogin.status).toBe(200);
  });

  it('requires a reason to suspend', async () => {
    const { user } = await createDonor();
    const cookie = await adminCookie();

    const response = await agent().post(`/api/admin/users/${user._id}/suspend`).set('Cookie', cookie);
    expect(response.status).toBe(400);
  });

  it('refuses to manage an admin account', async () => {
    const { user: targetAdmin } = await createAdmin();
    const cookie = await adminCookie();

    const response = await agent().post(`/api/admin/users/${targetAdmin._id}/suspend`).set('Cookie', cookie);
    expect(response.status).toBe(403);
  });

  it('returns 404 for a nonexistent user id', async () => {
    const cookie = await adminCookie();
    const response = await agent()
      .post('/api/admin/users/000000000000000000000000/suspend')
      .set('Cookie', cookie);
    expect(response.status).toBe(404);
  });
});
