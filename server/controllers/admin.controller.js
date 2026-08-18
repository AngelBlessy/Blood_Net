const User = require('../models/user.model');
const HospitalProfile = require('../models/hospital-profile.model');
const BloodBankProfile = require('../models/blood-bank-profile.model');
const DonorProfile = require('../models/donor-profile.model');
const BloodRequest = require('../models/blood-request.model');
const BloodInventory = require('../models/blood-inventory.model');
const Donation = require('../models/donation.model');
const { BLOOD_GROUPS, REQUEST_PRIORITIES } = require('../constants');
const { emitToAdmins } = require('../realtime/socket');

const LOW_STOCK_THRESHOLD = 5;
const MANAGEABLE_ROLES = ['donor', 'hospital', 'bloodbank'];
const USER_LIST_LIMIT = 50;
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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Donor/hospital/bloodbank accounts, merged with their profile's display
// name — the pending-approval endpoints above only ever surface *new*
// hospital/bank signups; this is the general-purpose list for finding an
// existing account (any role, any status) to inspect or suspend.
async function listUsers(req, res) {
  const role = MANAGEABLE_ROLES.includes(req.query.role) ? req.query.role : undefined;
  const status = ['pending', 'active', 'suspended'].includes(req.query.status) ? req.query.status : undefined;
  const search = String(req.query.search || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit) || USER_LIST_LIMIT, 1), 200);

  const filter = { role: role || { $in: MANAGEABLE_ROLES } };
  if (status) filter.status = status;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ email: pattern }, { phone: pattern }];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).limit(limit),
  ]);

  const donorIds = users.filter((user) => user.role === 'donor').map((user) => user._id);
  const hospitalIds = users.filter((user) => user.role === 'hospital').map((user) => user._id);
  const bankIds = users.filter((user) => user.role === 'bloodbank').map((user) => user._id);

  const [donors, hospitals, banks] = await Promise.all([
    DonorProfile.find({ userId: { $in: donorIds } }),
    HospitalProfile.find({ userId: { $in: hospitalIds } }),
    BloodBankProfile.find({ userId: { $in: bankIds } }),
  ]);
  const donorMap = new Map(donors.map((profile) => [profile.userId.toString(), profile]));
  const hospitalMap = new Map(hospitals.map((profile) => [profile.userId.toString(), profile]));
  const bankMap = new Map(banks.map((profile) => [profile.userId.toString(), profile]));

  const items = users.map((user) => {
    const id = user._id.toString();
    let name = null;
    let city = null;
    if (user.role === 'donor') {
      const profile = donorMap.get(id);
      name = profile?.name ?? null;
      city = profile?.city ?? null;
    } else if (user.role === 'hospital') {
      const profile = hospitalMap.get(id);
      name = profile?.hospitalName ?? null;
      city = profile?.city ?? null;
    } else if (user.role === 'bloodbank') {
      const profile = bankMap.get(id);
      name = profile?.bankName ?? null;
      city = profile?.city ?? null;
    }
    return {
      id,
      name,
      city,
      role: user.role,
      email: user.email,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
    };
  });

  res.json({ users: items, total });
}

async function setUserStatus(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  // Admin accounts aren't in MANAGEABLE_ROLES and never reach this list in
  // the UI, but guard server-side too — this also rules out an admin
  // suspending their own account, since that's always role 'admin'.
  if (!MANAGEABLE_ROLES.includes(user.role)) {
    return res.status(403).json({ error: 'This account cannot be managed here.' });
  }

  user.status = req.params.action === 'suspend' ? 'suspended' : 'active';
  await user.save();
  emitToAdmins('admin:refresh');
  res.json({ ok: true, id: user._id.toString(), status: user.status });
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

module.exports = {
  stats,
  analytics,
  trends,
  pendingHospitals,
  decideHospital,
  pendingBloodBanks,
  decideBloodBank,
  listUsers,
  setUserStatus,
};
