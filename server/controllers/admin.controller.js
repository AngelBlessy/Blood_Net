const HospitalProfile = require('../models/hospital-profile.model');
const BloodBankProfile = require('../models/blood-bank-profile.model');
const DonorProfile = require('../models/donor-profile.model');
const BloodRequest = require('../models/blood-request.model');
const BloodInventory = require('../models/blood-inventory.model');
const Donation = require('../models/donation.model');
const { BLOOD_GROUPS, REQUEST_PRIORITIES } = require('../constants');
const { emitToAdmins } = require('../realtime/socket');

const LOW_STOCK_THRESHOLD = 5;
// Retention funnel stages, in donation-count order. "loyal" reuses the Silver
// badge threshold (see donor-stats.service.js) so this reads consistently
// with the badge a donor would actually be showing on their profile.
const RETENTION_AGAIN_THRESHOLD = 2;
const RETENTION_LOYAL_THRESHOLD = 5;
const TOP_CITIES_LIMIT = 5;
// range param -> how many buckets of that granularity to return (see `trends`).
const TREND_RANGES = {
  '1m': { granularity: 'day', count: 30 },
  '3m': { granularity: 'month', count: 3 },
  '6m': { granularity: 'month', count: 6 },
  '1y': { granularity: 'month', count: 12 },
};

async function inventoryBreakdown() {
  const inventoryItems = await BloodInventory.find({});
  const totals = new Map(BLOOD_GROUPS.map((group) => [group, 0]));
  for (const item of inventoryItems) {
    totals.set(item.bloodGroup, (totals.get(item.bloodGroup) || 0) + item.units);
  }
  const inventory = BLOOD_GROUPS.map((group) => ({ group, units: totals.get(group) || 0 }));
  const lowStockGroups = inventory.filter((item) => item.units < LOW_STOCK_THRESHOLD).map((item) => item.group);
  return { inventory, lowStockGroups };
}

async function stats(_req, res) {
  const [donorCount, openRequests, { inventory, lowStockGroups }] = await Promise.all([
    DonorProfile.countDocuments(),
    BloodRequest.countDocuments({ status: { $ne: 'Completed' } }),
    inventoryBreakdown(),
  ]);

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
  emitToAdmins('admin:refresh');
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
  emitToAdmins('admin:refresh');
  res.json({ ok: true, bloodBank: serializeBloodBank(bank) });
}

// Oldest-first list of the last `count` months as 'YYYY-MM' keys, so the
// trend chart always shows a fixed-width window (with 0-count gaps for
// months with no activity) instead of only whichever months have data.
function recentMonthKeys(count) {
  const keys = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(cursor);
    d.setUTCMonth(d.getUTCMonth() - i);
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

// Same idea as recentMonthKeys but day-granularity, for the 1-month range
// (a month of monthly buckets would be a single data point — not a trend).
function recentDayKeys(count) {
  const keys = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(cursor);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    );
  }
  return keys;
}

// Network activity over time (donations completed + new donor signups),
// independent of the main `analytics` payload so switching the range toggle
// on the trend chart doesn't require refetching the whole insights page.
async function trends(req, res) {
  const range = TREND_RANGES[req.query.range] ? req.query.range : '6m';
  const { granularity, count } = TREND_RANGES[range];

  const keys = granularity === 'day' ? recentDayKeys(count) : recentMonthKeys(count);
  const dateFormat = granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';
  const windowStart = new Date(`${keys[0]}${granularity === 'day' ? '' : '-01'}T00:00:00.000Z`);

  const [donationCounts, newDonorCounts] = await Promise.all([
    Donation.aggregate([
      { $match: { donationDate: { $gte: windowStart } } },
      { $group: { _id: { $dateToString: { format: dateFormat, date: '$donationDate' } }, count: { $sum: 1 } } },
    ]),
    DonorProfile.aggregate([
      { $match: { createdAt: { $gte: windowStart } } },
      { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
  ]);

  const points = keys.map((key) => ({
    key,
    donations: donationCounts.find((entry) => entry._id === key)?.count || 0,
    newDonors: newDonorCounts.find((entry) => entry._id === key)?.count || 0,
  }));

  res.json({ granularity, points });
}

async function analytics(_req, res) {
  const [
    bloodGroupCounts,
    donorGroupCounts,
    topHospitalCounts,
    fulfillment,
    donorCount,
    donationsPerDonor,
    hospitalsCount,
    bloodBanksCount,
    openRequests,
    totalDonations,
    { inventory, lowStockGroups },
    priorityCounts,
    travelingCount,
    unavailableCount,
    cityCounts,
  ] = await Promise.all([
    BloodRequest.aggregate([{ $group: { _id: '$bloodGroup', count: { $sum: 1 } } }]),
    DonorProfile.aggregate([{ $group: { _id: '$bloodGroup', count: { $sum: 1 } } }]),
    BloodRequest.aggregate([
      { $match: { hospitalId: { $ne: null } } },
      { $group: { _id: '$hospitalId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    // updatedAt at the moment status flips to 'Completed' (see
    // hospital-requests.controller.js `update`) is the closest thing this
    // schema has to a dedicated completedAt timestamp.
    BloodRequest.aggregate([
      { $match: { status: 'Completed' } },
      { $project: { minutes: { $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 60000] } } },
      { $group: { _id: null, avgMinutes: { $avg: '$minutes' }, count: { $sum: 1 } } },
    ]),
    DonorProfile.countDocuments(),
    Donation.aggregate([{ $group: { _id: '$donorId', count: { $sum: 1 } } }]),
    HospitalProfile.countDocuments({ approvalStatus: 'approved' }),
    BloodBankProfile.countDocuments({ approvalStatus: 'approved' }),
    BloodRequest.countDocuments({ status: { $ne: 'Completed' } }),
    Donation.countDocuments(),
    inventoryBreakdown(),
    BloodRequest.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
    // Traveling takes precedence over availabilityStatus (see donor-profile.model.js
    // — a traveling donor set to "available" still shouldn't read as reachable).
    DonorProfile.countDocuments({ traveling: true }),
    DonorProfile.countDocuments({ traveling: false, availabilityStatus: 'unavailable' }),
    DonorProfile.aggregate([
      { $match: { city: { $nin: [null, ''] } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: TOP_CITIES_LIMIT },
    ]),
  ]);

  const bloodGroupDemand = BLOOD_GROUPS.map((group) => ({
    group,
    count: bloodGroupCounts.find((entry) => entry._id === group)?.count || 0,
  }));

  const donorsByBloodGroup = BLOOD_GROUPS.map((group) => ({
    group,
    count: donorGroupCounts.find((entry) => entry._id === group)?.count || 0,
  }));

  const requestsByPriority = REQUEST_PRIORITIES.map((priority) => ({
    priority,
    count: priorityCounts.find((entry) => entry._id === priority)?.count || 0,
  }));

  const donorAvailability = {
    available: Math.max(donorCount - travelingCount - unavailableCount, 0),
    traveling: travelingCount,
    unavailable: unavailableCount,
  };

  const topCities = cityCounts.map((entry) => ({ city: entry._id, count: entry.count }));

  const hospitals = await HospitalProfile.find(
    { _id: { $in: topHospitalCounts.map((entry) => entry._id) } },
    { hospitalName: 1 }
  );
  const hospitalNames = new Map(hospitals.map((hospital) => [hospital._id.toString(), hospital.hospitalName]));
  const topHospitals = topHospitalCounts.map((entry) => ({
    hospitalName: hospitalNames.get(entry._id.toString()) || 'Unknown hospital',
    count: entry.count,
  }));

  const donatedOnce = donationsPerDonor.length;
  const donatedAgain = donationsPerDonor.filter((entry) => entry.count >= RETENTION_AGAIN_THRESHOLD).length;
  const loyalDonors = donationsPerDonor.filter((entry) => entry.count >= RETENTION_LOYAL_THRESHOLD).length;

  res.json({
    donorCount,
    hospitalsCount,
    bloodBanksCount,
    openRequests,
    totalDonations,
    lowStockGroups,
    inventoryLevels: inventory,
    bloodGroupDemand,
    donorsByBloodGroup,
    requestsByPriority,
    donorAvailability,
    topCities,
    topHospitals,
    fulfillment: {
      avgMinutes: fulfillment[0]?.avgMinutes ?? null,
      completedCount: fulfillment[0]?.count ?? 0,
    },
    retention: {
      registered: donorCount,
      donatedOnce,
      donatedAgain,
      loyalDonors,
    },
  });
}

module.exports = { stats, analytics, trends, pendingHospitals, decideHospital, pendingBloodBanks, decideBloodBank };
