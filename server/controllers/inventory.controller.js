const BloodInventory = require('../models/blood-inventory.model');
const BloodBankProfile = require('../models/blood-bank-profile.model');
const { BLOOD_GROUPS } = require('../constants');

function serialize(item) {
  return {
    group: item.bloodGroup,
    units: item.units,
    expiry: item.expiry,
    location: item.location,
    bankId: item.bankId.toString(),
  };
}

async function list(req, res) {
  if (req.query.mine === 'true') {
    if (!req.user || req.user.role !== 'bloodbank') return res.status(403).json({ error: 'Not authorized' });
    const bank = await BloodBankProfile.findOne({ userId: req.user.id });
    if (!bank) return res.status(404).json({ error: 'Blood bank profile not found.' });
    const items = await BloodInventory.find({ bankId: bank._id });
    return res.json({ items: items.map(serialize) });
  }

  // Aggregated totals across every bank, for the public/admin/home views.
  const items = await BloodInventory.find({});
  const totals = new Map(BLOOD_GROUPS.map((group) => [group, 0]));
  for (const item of items) {
    totals.set(item.bloodGroup, (totals.get(item.bloodGroup) || 0) + item.units);
  }
  res.json({ items: BLOOD_GROUPS.map((group) => ({ group, units: totals.get(group) || 0 })) });
}

async function upsert(req, res) {
  const bank = await BloodBankProfile.findOne({ userId: req.user.id });
  if (!bank) return res.status(404).json({ error: 'Blood bank profile not found.' });
  if (bank.approvalStatus !== 'approved') {
    return res.status(403).json({ error: 'Your blood bank account is awaiting admin approval.' });
  }

  const bloodGroup = req.params.bloodGroup;
  if (!BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ error: 'Invalid blood group.' });

  const units = Number(req.body?.units);
  if (!Number.isInteger(units) || units < 0) return res.status(400).json({ error: 'Enter a valid unit count.' });

  const item = await BloodInventory.findOneAndUpdate(
    { bankId: bank._id, bloodGroup },
    {
      units,
      expiry: req.body?.expiry ? new Date(req.body.expiry) : null,
      location: String(req.body?.location || '').trim(),
      lastUpdated: new Date(),
    },
    { upsert: true, new: true }
  );

  res.json({ ok: true, item: serialize(item) });
}

module.exports = { list, upsert };
