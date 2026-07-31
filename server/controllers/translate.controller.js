const { translateBatch } = require('../services/translation.service');

async function translate(req, res) {
  const texts = Array.isArray(req.body?.texts) ? req.body.texts.map((text) => String(text)) : null;
  const target = String(req.body?.target || '').trim();
  const source = String(req.body?.source || 'en').trim();

  if (!texts || !texts.length) return res.status(400).json({ error: 'texts must be a non-empty array.' });
  if (!target) return res.status(400).json({ error: 'target language is required.' });

  const { translations, translated } = await translateBatch(texts, target, source);
  res.json({ translations, translated });
}

module.exports = { translate };
