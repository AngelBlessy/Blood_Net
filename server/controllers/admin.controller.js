const HospitalProfile = require('../models/hospital-profile.model');
const BloodBankProfile = require('../models/blood-bank-profile.model');
const DonorProfile = require('../models/donor-profile.model');
const BloodRequest = require('../models/blood-request.model');
const BloodInventory = require('../models/blood-inventory.model');
const { BLOOD_GROUPS } = require('../constants');

const LOW_STOCK_THRESHOLD = 5;

async function stats(_req, res) {
  const [donorCount, openRequests, inventoryItems] = await Promise.all([
    DonorProfile.countDocuments(),
    BloodRequest.countDocuments({ status: { $ne: 'Completed' } }),
    BloodInventory.find({}),
  ]);

  const totals = new Map(BLOOD_GROUPS.map((group) => [group, 0]));
  for (const item of inventoryItems) {
    totals.set(item.bloodGroup, (totals.get(item.bloodGroup) || 0) + item.units);
  }
  const inventory = BLOOD_GROUPS.map((group) => ({ group, units: totals.get(group) || 0 }));
  const lowStockGroups = inventory.filter((item) => item.units < LOW_STOCK_THRESHOLD).map((item) => item.group);

  res.json({ donorCount, openRequests, lowStockGroups, inventory });
}

function serializeHospital(profile) {
  return {
    id: profile._id.toString(),
    hospitalName: profile.hospitalName,
    licenseNumber: profile.licenseNumber,
    address: profile.address,
    city: profile.city,
    approvalStatus: profile.approvalStatus,
    email: profile.userId?.email,
    phone: profile.userId?.phone,
  };
}

function serializeBloodBank(profile) {
  return {
    id: profile._id.toString(),
    bankName: profile.bankName,
    address: profile.address,
    city: profile.city,
    contactNumber: profile.contactNumber,
    approvalStatus: profile.approvalStatus,
    email: profile.userId?.email,
    phone: profile.userId?.phone,
  };
}

async function pendingHospitals(_req, res) {
  const hospitals = await HospitalProfile.find({ approvalStatus: 'pending' }).populate('userId');
  res.json({ hospitals: hospitals.map(serializeHospital) });
}

async function decideHospital(req, res) {
  const approvalStatus = req.params.decision === 'approve' ? 'approved' : 'rejected';
  const hospital = await HospitalProfile.findByIdAndUpdate(req.params.id, { approvalStatus }, { new: true }).populate(
    'userId'
  );
  if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });
  res.json({ ok: true, hospital: serializeHospital(hospital) });
}

async function pendingBloodBanks(_req, res) {
  const banks = await BloodBankProfile.find({ approvalStatus: 'pending' }).populate('userId');
  res.json({ bloodBanks: banks.map(serializeBloodBank) });
}

async function decideBloodBank(req, res) {
  const approvalStatus = req.params.decision === 'approve' ? 'approved' : 'rejected';
  const bank = await BloodBankProfile.findByIdAndUpdate(req.params.id, { approvalStatus }, { new: true }).populate(
    'userId'
  );
  if (!bank) return res.status(404).json({ error: 'Blood bank not found.' });
  res.json({ ok: true, bloodBank: serializeBloodBank(bank) });
}

module.exports = { stats, pendingHospitals, decideHospital, pendingBloodBanks, decideBloodBank };
