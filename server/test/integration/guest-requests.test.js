const { agent, captureDevOtp, createDonor } = require('../helpers');
const BloodRequest = require('../../models/blood-request.model');

function guestPayload(overrides = {}) {
  return {
    name: 'Guest Requester',
    phone: '9812345670',
    patient: 'Guest Patient',
    bloodGroup: 'O+',
    units: 1,
    priority: 'Critical',
    ...overrides,
  };
}

describe('POST /api/guest-requests/otp and POST /api/guest-requests', () => {
  it('sends an OTP, then creates the request once verified', async () => {
    await createDonor({ bloodGroup: 'O+' });
    const payload = guestPayload();

    const otp = await captureDevOtp(async () => {
      // 200, not 201: Twilio is unconfigured in this test environment (see
      // global-setup.js), so SMS delivery "fails" and the controller falls
      // through to its non-201 branch -- the OTP is still issued either way.
      const otpResponse = await agent().post('/api/guest-requests/otp').send(payload);
      expect(otpResponse.status).toBe(200);
    });

    const createResponse = await agent().post('/api/guest-requests').send({ ...payload, otp });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.request.raisedBy).toBe('guest');
    expect(createResponse.body.request.guestName).toBe('Guest Requester');

    const stored = await BloodRequest.findOne({ guestPhone: payload.phone });
    expect(stored).not.toBeNull();
  });

  it('rejects request creation with an incorrect OTP', async () => {
    const payload = guestPayload();
    await agent().post('/api/guest-requests/otp').send(payload);

    const response = await agent().post('/api/guest-requests').send({ ...payload, otp: '000000' });
    expect(response.status).toBe(400);
  });

  it.each([
    ['name too short', { name: 'A' }],
    ['invalid phone', { phone: '123' }],
    ['missing patient', { patient: '' }],
    ['invalid blood group', { bloodGroup: 'ZZ' }],
    ['zero units', { units: 0 }],
  ])('rejects the OTP request with %s', async (_label, overrides) => {
    const response = await agent().post('/api/guest-requests/otp').send(guestPayload(overrides));
    expect(response.status).toBe(400);
  });
});
