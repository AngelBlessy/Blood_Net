const { agent } = require('../helpers');

describe('POST /api/translate', () => {
  it('validates that texts is a non-empty array and target is present', async () => {
    const noTexts = await agent().post('/api/translate').send({ target: 'hi' });
    expect(noTexts.status).toBe(400);

    const emptyTexts = await agent().post('/api/translate').send({ texts: [], target: 'hi' });
    expect(emptyTexts.status).toBe(400);

    const noTarget = await agent().post('/api/translate').send({ texts: ['Hello'] });
    expect(noTarget.status).toBe(400);
  });

  it('is public (no auth) and falls back to source text when the API key is unconfigured', async () => {
    const response = await agent().post('/api/translate').send({ texts: ['Hello', 'Blood donor'], target: 'hi' });
    expect(response.status).toBe(200);
    expect(response.body.translated).toBe(false);
    expect(response.body.translations).toEqual(['Hello', 'Blood donor']);
  });
});
