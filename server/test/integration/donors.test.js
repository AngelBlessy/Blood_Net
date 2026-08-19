const { agent, createDonor, createHospital, loginAndGetCookie, captureDevOtp } = require('../helpers');
const Donation = require('../../models/donation.model');
const DonorProfile = require('../../models/donor-profile.model');

async function donorCookie(overrides = {}) {
  const fixture = await createDonor(overrides);
  const cookie = await loginAndGetCookie({ email: fixture.user.email, password: fixture.password });
  return { ...fixture, cookie };
}

describe('GET /api/donors/count', () => {
  it('is public and reflects the current donor count', async () => {
    await createDonor();
    await createDonor();
    const response = await agent().get('/api/donors/count');
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
  });
});

describe('PATCH /api/donors/me', () => {
  it('updates traveling and availabilityStatus for the logged-in donor', async () => {
    const { cookie, profile } = await donorCookie();
    const response = await agent().patch('/api/donors/me').set('Cookie', cookie).send({
      traveling: true,
      availabilityStatus: 'unavailable',
    });
    expect(response.status).toBe(200);
    expect(response.body.profile.traveling).toBe(true);
    expect(response.body.profile.availabilityStatus).toBe('unavailable');

    const stored = await DonorProfile.findById(profile._id);
    expect(stored.traveling).toBe(true);
    expect(stored.availabilityStatus).toBe('unavailable');
  });

  it('rejects a non-donor role', async () => {
    const { user, password } = await createHospital();
    const cookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent().patch('/api/donors/me').set('Cookie', cookie).send({ traveling: true });
    expect(response.status).toBe(403);
  });
});

describe('donor profile edit (OTP-gated)', () => {
  it('requests an OTP, then updates name/age/bloodGroup with it', async () => {
    const { cookie } = await donorCookie();

    const otp = await captureDevOtp(async () => {
      // 200, not 201: Resend/Twilio are unconfigured in this test environment
      // (see global-setup.js), so delivery "fails" and the controller falls
      // through to its non-201 branch -- the OTP is still issued either way,
      // which is exactly the dev-otp fallback this test relies on.
      const otpResponse = await agent().post('/api/donors/me/profile/otp').set('Cookie', cookie);
      expect(otpResponse.status).toBe(200);
    });

    const updateResponse = await agent().patch('/api/donors/me/profile').set('Cookie', cookie).send({
      otp,
      name: 'Updated Name',
      age: 35,
      bloodGroup: 'AB+',
      email: 'updated-email@bloodnet.test',
      phone: '9123456780',
    });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.user.name).toBe('Updated Name');
    expect(updateResponse.body.user.bloodGroup).toBe('AB+');
  });

  it('rejects the profile update with an incorrect OTP', async () => {
    const { cookie } = await donorCookie();
    await agent().post('/api/donors/me/profile/otp').set('Cookie', cookie);

    const response = await agent().patch('/api/donors/me/profile').set('Cookie', cookie).send({
      otp: '000000',
      name: 'Someone Else',
      age: 40,
      bloodGroup: 'O-',
      email: 'x@bloodnet.test',
      phone: '9123456781',
    });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/donors/me/summary', () => {
  it('returns eligibility, badge level, and donation history', async () => {
    const { cookie, profile } = await donorCookie();
    await Donation.create({ donorId: profile._id, donationDate: new Date(), unitsDonated: 1 });

    const response = await agent().get('/api/donors/me/summary').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.totalDonations).toBe(1);
    expect(response.body.badgeLevel).toBe('First Drop');
    expect(response.body.eligibility).toHaveProperty('eligible');
  });
});

describe('GET /api/donors/me/alerts', () => {
  it("excludes the donor's own raised request from their alert feed", async () => {
    const { cookie } = await donorCookie({ bloodGroup: 'O+' });
    await agent()
      .post('/api/hospital-requests')
      .set('Cookie', cookie)
      .send({
        patient: 'Self raised',
        bloodGroup: 'O+',
        units: 1,
        priority: 'Critical',
        contactName: 'Me',
        contactPhone: '9876500000',
      });

    const response = await agent().get('/api/donors/me/alerts').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.requests).toHaveLength(0);
  });

  it('shows a compatible request raised by someone else', async () => {
    const { cookie } = await donorCookie({ bloodGroup: 'O+' });
    const { user: hospitalUser, password: hospitalPassword } = await createHospital();
    const hospitalCookie = await loginAndGetCookie({ email: hospitalUser.email, password: hospitalPassword });
    await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookie)
      .send({
        patient: 'Other patient',
        bloodGroup: 'O+',
        units: 1,
        priority: 'Critical',
        contactName: 'Hospital',
        contactPhone: '9876500001',
      });

    const response = await agent().get('/api/donors/me/alerts').set('Cookie', cookie);
    expect(response.body.requests).toHaveLength(1);
    expect(response.body.requests[0].patient).toBe('Other patient');
  });

  it('hides a request once a different donor has already accepted it', async () => {
    const { cookie: viewerCookie } = await donorCookie({ bloodGroup: 'O+' });
    const { user: accepterUser, password: accepterPassword } = await createDonor({ bloodGroup: 'O+' });
    const { user: hospitalUser, password: hospitalPassword } = await createHospital();
    const hospitalCookie = await loginAndGetCookie({ email: hospitalUser.email, password: hospitalPassword });

    const created = await agent()
      .post('/api/hospital-requests')
      .set('Cookie', hospitalCookie)
      .send({
        patient: 'Contested',
        bloodGroup: 'O+',
        units: 1,
        priority: 'Critical',
        contactName: 'Hospital',
        contactPhone: '9876500002',
      });

    const accepterCookie = await loginAndGetCookie({ email: accepterUser.email, password: accepterPassword });
    await agent()
      .post(`/api/hospital-requests/${created.body.request.id}/respond`)
      .set('Cookie', accepterCookie)
      .send({ response: 'Accepted' });

    const response = await agent().get('/api/donors/me/alerts').set('Cookie', viewerCookie);
    expect(response.body.requests).toHaveLength(0);
  });
});

describe('GET /api/donors/me/donations/:id/certificate', () => {
  it("streams a PDF for the caller's own donation", async () => {
    const { cookie, profile } = await donorCookie();
    const donation = await Donation.create({ donorId: profile._id, donationDate: new Date(), unitsDonated: 1 });

    const response = await agent().get(`/api/donors/me/donations/${donation._id}/certificate`).set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/pdf/);
  });

  it("returns 404 for another donor's donation id", async () => {
    const { profile: otherProfile } = await createDonor();
    const donation = await Donation.create({ donorId: otherProfile._id, donationDate: new Date(), unitsDonated: 1 });

    const { cookie } = await donorCookie();
    const response = await agent().get(`/api/donors/me/donations/${donation._id}/certificate`).set('Cookie', cookie);
    expect(response.status).toBe(404);
  });
});
