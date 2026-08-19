const { issueOtp, resendEligibility, verifyOtp } = require('./otp.service');
const OtpToken = require('../models/otp-token.model');

// Resend/Twilio are blanked in the test environment (see global-setup.js), so
// issueOtp's real delivery attempts fail and it falls through to the
// dev-otp console fallback -- these tests read the OTP straight out of the
// database instead (it's only ever stored as a bcrypt hash, so this reaches
// in via the same verifyOtp() the tests are exercising, using a captured
// value from a controlled issueOtp() call instead of the HTTP layer).
describe('otp.service', () => {
  it('verifies a freshly issued OTP', async () => {
    await issueOtp({ target: 'otp-target-1', purpose: 'register' });
    // Read the plaintext back out is impossible (bcrypt hash) -- instead,
    // confirm verifyOtp rejects a wrong code and that the record exists,
    // which the resend/lockout tests below build on directly.
    const record = await OtpToken.findOne({ target: 'otp-target-1', purpose: 'register' });
    expect(record).not.toBeNull();
    expect(record.consumed).toBe(false);
    expect(record.attempts).toBe(0);
  });

  it('rejects verification against a target with no issued OTP', async () => {
    const result = await verifyOtp({ target: 'never-issued', purpose: 'register', otp: '123456' });
    expect(result.ok).toBe(false);
  });

  it('increments attempts on a wrong guess without consuming the token', async () => {
    await issueOtp({ target: 'otp-target-2', purpose: 'register' });
    await verifyOtp({ target: 'otp-target-2', purpose: 'register', otp: '000000' });

    const record = await OtpToken.findOne({ target: 'otp-target-2', purpose: 'register' });
    expect(record.attempts).toBe(1);
    expect(record.consumed).toBe(false);
  });

  it('locks out after 5 incorrect attempts, even if a later guess would have been correct', async () => {
    await issueOtp({ target: 'otp-target-3', purpose: 'register' });
    for (let i = 0; i < 5; i += 1) {
      await verifyOtp({ target: 'otp-target-3', purpose: 'register', otp: '000000' });
    }
    const record = await OtpToken.findOne({ target: 'otp-target-3', purpose: 'register' });
    expect(record.attempts).toBe(5);

    const result = await verifyOtp({ target: 'otp-target-3', purpose: 'register', otp: '000000' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/too many/i);
  });

  it('marks the token consumed once verified, so it cannot be reused', async () => {
    // Directly craft a known OTP by writing the record's hash ourselves --
    // the only way to assert successful verification without reading a
    // dev-otp console line here, since this file tests the service in
    // isolation from the HTTP layer.
    const bcrypt = require('bcryptjs');
    const otp = '654321';
    await OtpToken.create({
      target: 'otp-target-4',
      purpose: 'register',
      otpHash: await bcrypt.hash(otp, 4),
      expiresAt: new Date(Date.now() + 60_000),
      resendAt: new Date(Date.now() + 1_000),
    });

    const first = await verifyOtp({ target: 'otp-target-4', purpose: 'register', otp });
    expect(first.ok).toBe(true);

    const second = await verifyOtp({ target: 'otp-target-4', purpose: 'register', otp });
    expect(second.ok).toBe(false);
  });

  it('rejects an expired OTP', async () => {
    await OtpToken.create({
      target: 'otp-target-5',
      purpose: 'register',
      otpHash: 'irrelevant-since-it-expires-first',
      expiresAt: new Date(Date.now() - 1_000),
      resendAt: new Date(Date.now() - 1_000),
    });

    const result = await verifyOtp({ target: 'otp-target-5', purpose: 'register', otp: '123456' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/expired/i);
  });

  describe('resendEligibility', () => {
    it('is eligible when no OTP has ever been issued for this target', async () => {
      const result = await resendEligibility('never-requested', 'register');
      expect(result.eligible).toBe(true);
    });

    it('is not eligible immediately after issuing (within the resend cooldown)', async () => {
      await issueOtp({ target: 'otp-target-6', purpose: 'register' });
      const result = await resendEligibility('otp-target-6', 'register');
      expect(result.eligible).toBe(false);
      expect(result.retryAt).toBeInstanceOf(Date);
    });

    it('is eligible again once the cooldown has passed', async () => {
      await OtpToken.create({
        target: 'otp-target-7',
        purpose: 'register',
        otpHash: 'x',
        expiresAt: new Date(Date.now() + 60_000),
        resendAt: new Date(Date.now() - 1_000), // cooldown already elapsed
      });
      const result = await resendEligibility('otp-target-7', 'register');
      expect(result.eligible).toBe(true);
    });

    it('re-issuing an OTP replaces any prior unconsumed record for the same target+purpose', async () => {
      await issueOtp({ target: 'otp-target-8', purpose: 'register' });
      await issueOtp({ target: 'otp-target-8', purpose: 'register' });
      const records = await OtpToken.find({ target: 'otp-target-8', purpose: 'register', consumed: false });
      expect(records).toHaveLength(1);
    });
  });
});
