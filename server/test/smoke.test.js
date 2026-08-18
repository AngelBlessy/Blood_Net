const mongoose = require('mongoose');
const { agent, createDonor, loginAndGetCookie } = require('./helpers');

describe('test infrastructure smoke test', () => {
  it('connects to the in-memory MongoDB', () => {
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('serves the health endpoint over HTTP', async () => {
    const response = await agent().get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('can create a donor fixture and log in as them', async () => {
    const { user, password } = await createDonor({ email: 'smoke-donor@bloodnet.test' });
    const cookie = await loginAndGetCookie({ email: user.email, password });
    expect(cookie).toMatch(/^bloodnet_token=/);
  });
});
