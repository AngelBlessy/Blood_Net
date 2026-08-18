const {
  agent,
  createDonor,
  createHospital,
  createBloodBank,
  loginAndGetCookie,
  captureDevOtp,
  uniqueEmail,
  uniquePhone,
} = require('../helpers');
const User = require('../../models/user.model');
const DonorProfile = require('../../models/donor-profile.model');
const HospitalProfile = require('../../models/hospital-profile.model');
const BloodBankProfile = require('../../models/blood-bank-profile.model');

function donorPayload(overrides = {}) {
  return {
    role: 'donor',
    name: 'Jane Donor',
    email: uniqueEmail('donor'),
    phone: uniquePhone(),
    password: 'Password123!',
    age: 28,
    bloodGroup: 'O+',
    donatedEver: 'no',
    ...overrides,
  };
}

describe('POST /api/auth/register', () => {
  it('registers a donor and creates a matching DonorProfile', async () => {
    const payload = donorPayload();
    const response = await agent().post('/api/auth/register').send(payload);

    expect(response.status).toBe(201);
    expect(response.body.accountCreated).toBe(true);

    const user = await User.findOne({ email: payload.email });
    expect(user).not.toBeNull();
    expect(user.role).toBe('donor');
    expect(user.status).toBe('pending');
    expect(user.emailVerified).toBe(false);

    const profile = await DonorProfile.findOne({ userId: user._id });
    expect(profile).not.toBeNull();
    expect(profile.bloodGroup).toBe('O+');
  });

  it('registers a hospital as pending approval, separate from OTP verification', async () => {
    const payload = {
      role: 'hospital',
      email: uniqueEmail('hospital'),
      phone: uniquePhone(),
      password: 'Password123!',
      hospitalName: 'City Hospital',
      licenseNumber: 'LIC-9999',
      city: 'Testville',
    };
    const response = await agent().post('/api/auth/register').send(payload);
    expect(response.status).toBe(201);

    const profile = await HospitalProfile.findOne({ licenseNumber: 'LIC-9999' });
    expect(profile).not.toBeNull();
    expect(profile.approvalStatus).toBe('pending');
  });

  it('registers a blood bank as pending approval', async () => {
    const payload = {
      role: 'bloodbank',
      email: uniqueEmail('bank'),
      phone: uniquePhone(),
      password: 'Password123!',
      bankName: 'Central Blood Bank',
    };
    const response = await agent().post('/api/auth/register').send(payload);
    expect(response.status).toBe(201);

    const profile = await BloodBankProfile.findOne({ bankName: 'Central Blood Bank' });
    expect(profile).not.toBeNull();
    expect(profile.approvalStatus).toBe('pending');
  });

  it('rejects an unknown role', async () => {
    const response = await agent().post('/api/auth/register').send(donorPayload({ role: 'superuser' }));
    expect(response.status).toBe(400);
  });

  it.each([
    ['invalid email', { email: 'not-an-email' }],
    ['invalid phone', { phone: '123' }],
    ['short password', { password: 'short' }],
    ['name too short', { name: 'Jo' }],
    ['invalid age', { age: 0 }],
    ['invalid blood group', { bloodGroup: 'ZZ' }],
  ])('rejects donor registration with %s', async (_label, overrides) => {
    const response = await agent().post('/api/auth/register').send(donorPayload(overrides));
    expect(response.status).toBe(400);
    expect(response.body.error).toBeTruthy();
  });

  it('rejects a duplicate email or phone', async () => {
    const payload = donorPayload();
    await agent().post('/api/auth/register').send(payload).expect(201);

    const dupeEmail = await agent()
      .post('/api/auth/register')
      .send(donorPayload({ email: payload.email }));
    expect(dupeEmail.status).toBe(409);

    const dupePhone = await agent()
      .post('/api/auth/register')
      .send(donorPayload({ phone: payload.phone }));
    expect(dupePhone.status).toBe(409);
  });
});

describe('POST /api/auth/verify-otp and /api/auth/login', () => {
  it('verifies OTP, activates the account, and allows login afterward', async () => {
    const payload = donorPayload();
    const otp = await captureDevOtp(async () => {
      const registerResponse = await agent().post('/api/auth/register').send(payload);
      expect(registerResponse.status).toBe(201);
    });

    const verifyResponse = await agent()
      .post('/api/auth/verify-otp')
      .send({ email: payload.email, phone: payload.phone, otp });
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.ok).toBe(true);

    const user = await User.findOne({ email: payload.email });
    expect(user.status).toBe('active');
    expect(user.emailVerified).toBe(true);
    expect(user.phoneVerified).toBe(true);

    const loginResponse = await agent().post('/api/auth/login').send({ email: payload.email, password: payload.password });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.role).toBe('donor');
    expect(loginResponse.headers['set-cookie']).toBeDefined();
  });

  it('rejects an incorrect OTP', async () => {
    const payload = donorPayload();
    await agent().post('/api/auth/register').send(payload);

    const response = await agent()
      .post('/api/auth/verify-otp')
      .send({ email: payload.email, phone: payload.phone, otp: '000000' });
    expect(response.status).toBe(400);
  });

  it('blocks login before OTP verification', async () => {
    const payload = donorPayload();
    await agent().post('/api/auth/register').send(payload);

    const response = await agent().post('/api/auth/login').send({ email: payload.email, password: payload.password });
    expect(response.status).toBe(403);
  });

  it('rejects login with the wrong password', async () => {
    const { user } = await createDonor();
    const response = await agent().post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(response.status).toBe(401);
  });

  it('rejects login for a nonexistent account', async () => {
    const response = await agent().post('/api/auth/login').send({ email: 'nobody@bloodnet.test', password: 'whatever1' });
    expect(response.status).toBe(401);
  });

  it('blocks login for a hospital still awaiting approval', async () => {
    const { user, password } = await createHospital({ approvalStatus: 'pending' });
    const response = await agent().post('/api/auth/login').send({ email: user.email, password });
    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/awaiting admin approval/i);
  });

  it('allows login for an approved hospital', async () => {
    const { user, password } = await createHospital({ approvalStatus: 'approved' });
    const response = await agent().post('/api/auth/login').send({ email: user.email, password });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('hospital');
  });

  it('blocks login for a suspended account', async () => {
    const { user, password } = await createDonor({ status: 'suspended' });
    const response = await agent().post('/api/auth/login').send({ email: user.email, password });
    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/suspended/i);
  });

  it('does not silently reactivate a suspended-while-pending account on OTP verification', async () => {
    // Regression test for the bug fixed alongside /admin/users: verifyOtpHandler
    // used to unconditionally set status: 'active', which would undo an
    // admin's suspension of a still-pending signup the moment they verified.
    const payload = donorPayload();
    const otp = await captureDevOtp(async () => {
      await agent().post('/api/auth/register').send(payload);
    });

    const registeredUser = await User.findOne({ email: payload.email });
    registeredUser.status = 'suspended';
    await registeredUser.save();

    const verifyResponse = await agent()
      .post('/api/auth/verify-otp')
      .send({ email: payload.email, phone: payload.phone, otp });
    expect(verifyResponse.status).toBe(200);

    const afterVerify = await User.findOne({ email: payload.email });
    expect(afterVerify.status).toBe('suspended');
    expect(afterVerify.emailVerified).toBe(true); // verification itself still records

    const loginResponse = await agent().post('/api/auth/login').send({ email: payload.email, password: payload.password });
    expect(loginResponse.status).toBe(403);
  });
});

describe('POST /api/auth/logout and GET /api/auth/me', () => {
  it('me returns null when not authenticated', async () => {
    const response = await agent().get('/api/auth/me');
    expect(response.status).toBe(200);
    expect(response.body.user).toBeNull();
  });

  it('me returns the current user when authenticated', async () => {
    const { user, password } = await createDonor();
    const cookie = await loginAndGetCookie({ email: user.email, password });

    const response = await agent().get('/api/auth/me').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(user.email);
    expect(response.body.user.role).toBe('donor');
  });

  it('logout clears the session cookie', async () => {
    const response = await agent().post('/api/auth/logout');
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toMatch(/bloodnet_token=;/);
  });
});

describe('Forgot password flow', () => {
  it('resets the password with a valid OTP and allows login with the new password', async () => {
    const { user } = await createDonor({ password: 'OldPassword1' });

    const otp = await captureDevOtp(async () => {
      const response = await agent().post('/api/auth/forgot-password/request-otp').send({ identifier: user.email });
      expect(response.status).toBe(200);
    });

    const resetResponse = await agent()
      .post('/api/auth/forgot-password/reset')
      .send({ identifier: user.email, otp, password: 'NewPassword1' });
    expect(resetResponse.status).toBe(200);

    const oldLogin = await agent().post('/api/auth/login').send({ email: user.email, password: 'OldPassword1' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await agent().post('/api/auth/login').send({ email: user.email, password: 'NewPassword1' });
    expect(newLogin.status).toBe(200);
  });

  it('returns 404 for an identifier with no matching account', async () => {
    const response = await agent().post('/api/auth/forgot-password/request-otp').send({ identifier: 'ghost@bloodnet.test' });
    expect(response.status).toBe(404);
  });
});

describe('Hospital/blood bank self-service profile edit (POST /api/auth/me/profile/otp + PATCH /api/auth/me/profile)', () => {
  it("a hospital can update its own profile details with a valid OTP, and approval survives the edit", async () => {
    const { user, password } = await createHospital({ approvalStatus: 'approved' });
    const cookie = await loginAndGetCookie({ email: user.email, password });

    const otp = await captureDevOtp(async () => {
      const otpResponse = await agent().post('/api/auth/me/profile/otp').set('Cookie', cookie);
      expect(otpResponse.status).toBe(200);
    });

    const response = await agent().patch('/api/auth/me/profile').set('Cookie', cookie).send({
      otp,
      email: user.email,
      phone: user.phone,
      hospitalName: 'Renamed Hospital',
      licenseNumber: 'LIC-NEW',
      city: 'New City',
    });
    expect(response.status).toBe(200);
    expect(response.body.user.hospitalName).toBe('Renamed Hospital');
    expect(response.body.user.approvalStatus).toBe('approved');
  });

  it('a blood bank can update its own profile the same way', async () => {
    const { user, password } = await createBloodBank();
    const cookie = await loginAndGetCookie({ email: user.email, password });

    const otp = await captureDevOtp(async () => {
      await agent().post('/api/auth/me/profile/otp').set('Cookie', cookie);
    });

    const response = await agent().patch('/api/auth/me/profile').set('Cookie', cookie).send({
      otp,
      email: user.email,
      phone: user.phone,
      bankName: 'Renamed Bank',
    });
    expect(response.status).toBe(200);
    expect(response.body.user.bankName).toBe('Renamed Bank');
  });

  it('rejects the profile edit with an incorrect OTP', async () => {
    const { user, password } = await createHospital();
    const cookie = await loginAndGetCookie({ email: user.email, password });
    await agent().post('/api/auth/me/profile/otp').set('Cookie', cookie);

    const response = await agent().patch('/api/auth/me/profile').set('Cookie', cookie).send({
      otp: '000000',
      email: user.email,
      phone: user.phone,
      hospitalName: 'Should Not Save',
      licenseNumber: 'LIC-X',
    });
    expect(response.status).toBe(400);
  });

  it('donors are redirected to use the donor-specific profile edit endpoint instead', async () => {
    const { user, password } = await createDonor();
    const cookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent().patch('/api/auth/me/profile').set('Cookie', cookie).send({ otp: '123456' });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/donor profile edit screen/i);
  });

  it('rejects reusing an email already taken by another account', async () => {
    const { user: other } = await createHospital();
    const { user, password } = await createHospital();
    const cookie = await loginAndGetCookie({ email: user.email, password });
    const otp = await captureDevOtp(async () => {
      await agent().post('/api/auth/me/profile/otp').set('Cookie', cookie);
    });

    const response = await agent().patch('/api/auth/me/profile').set('Cookie', cookie).send({
      otp,
      email: other.email,
      phone: user.phone,
      hospitalName: 'X',
      licenseNumber: 'LIC-Y',
    });
    expect(response.status).toBe(409);
  });
});
