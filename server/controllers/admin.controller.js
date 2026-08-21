const User = require('../models/user.model');
const HospitalProfile = require('../models/hospital-profile.model');
const BloodBankProfile = require('../models/blood-bank-profile.model');
const DonorProfile = require('../models/donor-profile.model');
const BloodRequest = require('../models/blood-request.model');
const BloodInventory = require('../models/blood-inventory.model');
const Donation = require('../models/donation.model');
const ApprovalDecision = require('../models/approval-decision.model');
const { BLOOD_GROUPS, REQUEST_PRIORITIES } = require('../constants');
const { emitToAdmins, forceLogoutUser } = require('../realtime/socket');
const { notifyUser } = require('../services/notification.service');
const { suspensionMessage } = require('../utils/suspension-message');
const { normalizeCity, CANONICAL_NAMES } = require('../services/city-alias.service');

const APPROVAL_HISTORY_LIMIT = 100;

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

// Merges exact-string city counts (e.g. from a $group on the raw `city`
// field) onto one entry per real-world city -- collapsing case/whitespace
// variants and known alternate names (city-alias.service.js) that a plain
// Mongo $group can't tell apart. A known city (Bengaluru, Mumbai, ...)
// displays under its canonical name; an unlisted city displays under
// whichever exact casing donors used most.
function mergeCityCounts(rawCounts, limit) {
  const merged = new Map(); // normalized key -> { count, variants: Map<rawCity, count> }
  for (const { _id: rawCity, count } of rawCounts) {
    const key = normalizeCity(rawCity);
    if (!key) continue;
    if (!merged.has(key)) merged.set(key, { count: 0, variants: new Map() });
    const entry = merged.get(key);
    entry.count += count;
    entry.variants.set(rawCity, (entry.variants.get(rawCity) || 0) + count);
  }

  return [...merged.entries()]
    .map(([key, { count, variants }]) => {
      const displayName = CANONICAL_NAMES.has(key)
        ? key
        : [...variants.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { city: displayName, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

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

// Never include licenseDocument.data here -- that's the raw file bytes,
// only needed server-side by the download route, which re-derives it from
// the DB record by profile id rather than trusting anything from the client.
function serializeLicenseDocument(doc) {
  if (!doc) return null;
  return { originalName: doc.originalName, mimeType: doc.mimeType, size: doc.size, uploadedAt: doc.uploadedAt };
}

function serializeHospital(profile) {
  return {
    id: profile._id.toString(),
    hospitalName: profile.hospitalName,
    licenseNumber: profile.licenseNumber,
    licenseDocument: serializeLicenseDocument(profile.licenseDocument),
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
    licenseNumber: profile.licenseNumber,
    licenseDocument: serializeLicenseDocument(profile.licenseDocument),
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

// Records the decision in the audit log and pushes a notification to the
// affected account -- shared by decideHospital/decideBloodBank since the
// logic is identical apart from which model/role it's operating on.
async function recordApprovalDecision({ req, role, profile, approvalStatus, reason, entityName, notifyTitle, notifyMessage }) {
  const admin = await User.findById(req.user.id);
  await ApprovalDecision.create({
    role,
    profileId: profile._id,
    entityName,
    decision: approvalStatus === 'approved' ? 'approved' : 'rejected',
    reason: reason || null,
    decidedBy: req.user.id,
    decidedByEmail: admin?.email || 'unknown',
  });
  if (profile.userId?._id) {
    notifyUser(profile.userId._id, notifyTitle, notifyMessage);
  }
}

async function decideHospital(req, res) {
  const approvalStatus = req.params.decision === 'approve' ? 'approved' : 'rejected';
  const reason = String(req.body?.reason || '').trim();
  if (approvalStatus === 'rejected' && !reason) {
    return res.status(400).json({ error: 'Enter a reason for rejecting this account.' });
  }

  const hospital = await HospitalProfile.findByIdAndUpdate(
    req.params.id,
    { approvalStatus, rejectionReason: approvalStatus === 'rejected' ? reason : null },
    { new: true }
  ).populate('userId');
  if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });

  await recordApprovalDecision({
    req,
    role: 'hospital',
    profile: hospital,
    approvalStatus,
    reason,
    entityName: hospital.hospitalName,
    notifyTitle: approvalStatus === 'approved' ? 'Account approved' : 'Account rejected',
    notifyMessage:
      approvalStatus === 'approved'
        ? 'Your hospital account has been approved. You can now log in.'
        : `Your hospital account was rejected: ${reason}. You can update your details and resubmit for review.`,
  });

  emitToAdmins('admin:refresh');
  res.json({ ok: true, hospital: serializeHospital(hospital) });
}

async function pendingBloodBanks(_req, res) {
  const banks = await BloodBankProfile.find({ approvalStatus: 'pending' }).populate('userId');
  res.json({ bloodBanks: banks.map(serializeBloodBank) });
}

async function decideBloodBank(req, res) {
  const approvalStatus = req.params.decision === 'approve' ? 'approved' : 'rejected';
  const reason = String(req.body?.reason || '').trim();
  if (approvalStatus === 'rejected' && !reason) {
    return res.status(400).json({ error: 'Enter a reason for rejecting this account.' });
  }

  const bank = await BloodBankProfile.findByIdAndUpdate(
    req.params.id,
    { approvalStatus, rejectionReason: approvalStatus === 'rejected' ? reason : null },
    { new: true }
  ).populate('userId');
  if (!bank) return res.status(404).json({ error: 'Blood bank not found.' });

  await recordApprovalDecision({
    req,
    role: 'bloodbank',
    profile: bank,
    approvalStatus,
    reason,
    entityName: bank.bankName,
    notifyTitle: approvalStatus === 'approved' ? 'Account approved' : 'Account rejected',
    notifyMessage:
      approvalStatus === 'approved'
        ? 'Your blood bank account has been approved. You can now log in.'
        : `Your blood bank account was rejected: ${reason}. You can update your details and resubmit for review.`,
  });

  emitToAdmins('admin:refresh');
  res.json({ ok: true, bloodBank: serializeBloodBank(bank) });
}

async function getApprovalHistory(req, res) {
  const limit = Math.min(Number(req.query?.limit) || APPROVAL_HISTORY_LIMIT, APPROVAL_HISTORY_LIMIT);
  const decisions = await ApprovalDecision.find({}).sort({ createdAt: -1 }).limit(limit);
  res.json({
    decisions: decisions.map((decision) => ({
      id: decision._id.toString(),
      role: decision.role,
      entityName: decision.entityName,
      decision: decision.decision,
      reason: decision.reason,
      decidedByEmail: decision.decidedByEmail,
      createdAt: decision.createdAt,
    })),
  });
}

// Streams an uploaded license/registration document to an admin. The bytes
// live directly on the profile document in MongoDB (see
// license-document.schema.js) -- nothing here touches the filesystem.
function streamLicenseDocument(res, doc) {
  if (!doc || !doc.data) return res.status(404).json({ error: 'No document was uploaded for this account.' });
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
  res.send(doc.data);
}

async function getHospitalLicenseDocument(req, res) {
  const hospital = await HospitalProfile.findById(req.params.id);
  if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });
  return streamLicenseDocument(res, hospital.licenseDocument);
}

async function getBloodBankLicenseDocument(req, res) {
  const bank = await BloodBankProfile.findById(req.params.id);
  if (!bank) return res.status(404).json({ error: 'Blood bank not found.' });
  return streamLicenseDocument(res, bank.licenseDocument);
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
    // Only hospital/bloodbank carry a separate approval workflow -- donor
    // accounts have nothing to approve beyond OTP verification, which
    // `status` already reflects. approvalId is the HospitalProfile/
    // BloodBankProfile _id -- the approve/reject/license-document routes key
    // off that, NOT the User _id, so it has to travel separately from `id`.
    let approvalStatus = null;
    let rejectionReason = null;
    let approvalId = null;
    let licenseDocument = null;
    if (user.role === 'donor') {
      const profile = donorMap.get(id);
      name = profile?.name ?? null;
      city = profile?.city ?? null;
    } else if (user.role === 'hospital') {
      const profile = hospitalMap.get(id);
      name = profile?.hospitalName ?? null;
      city = profile?.city ?? null;
      approvalStatus = profile?.approvalStatus ?? null;
      rejectionReason = profile?.rejectionReason ?? null;
      approvalId = profile?._id.toString() ?? null;
      licenseDocument = serializeLicenseDocument(profile?.licenseDocument);
    } else if (user.role === 'bloodbank') {
      const profile = bankMap.get(id);
      name = profile?.bankName ?? null;
      city = profile?.city ?? null;
      approvalStatus = profile?.approvalStatus ?? null;
      rejectionReason = profile?.rejectionReason ?? null;
      approvalId = profile?._id.toString() ?? null;
      licenseDocument = serializeLicenseDocument(profile?.licenseDocument);
    }
    return {
      id,
      name,
      city,
      role: user.role,
      email: user.email,
      phone: user.phone,
      status: user.status,
      approvalStatus,
      rejectionReason,
      approvalId,
      licenseDocument,
      reactivationRequestedAt: user.reactivationRequestedAt,
      suspensionReason: user.suspensionReason,
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

  const suspending = req.params.action === 'suspend';
  const reason = String(req.body?.reason || '').trim();
  if (suspending && !reason) {
    return res.status(400).json({ error: 'Enter a reason for suspending this account.' });
  }

  user.status = suspending ? 'suspended' : 'active';
  user.suspensionReason = suspending ? reason : null;
  // Whatever the admin decided, the pending reactivation request (if any) has
  // now been reviewed -- clear it so it stops showing as outstanding.
  user.reactivationRequestedAt = null;
  await user.save();

  notifyUser(
    user._id,
    suspending ? 'Account suspended' : 'Account reactivated',
    suspending ? suspensionMessage(reason) : 'Your account has been reactivated. You can now log in.'
  );
  if (suspending) forceLogoutUser(user._id, { message: suspensionMessage(reason) });

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
    // Donors free-type their city, so the same place shows up under several
    // spellings ("Chennai"/"chennai", "Bangalore"/"Bengaluru", ...). Grouping
    // on the raw string here would count those as different cities, so this
    // only collapses exact/whitespace duplicates in Mongo -- the case- and
    // alias-aware merge (mergeCityCounts, using city-alias.service.js) happens
    // in JS below, where the curated alias list actually lives.
    DonorProfile.aggregate([
      { $match: { city: { $nin: [null, ''] } } },
      { $group: { _id: { $trim: { input: '$city' } }, count: { $sum: 1 } } },
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

  const topCities = mergeCityCounts(cityCounts, TOP_CITIES_LIMIT);

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
  getHospitalLicenseDocument,
  pendingBloodBanks,
  decideBloodBank,
  getBloodBankLicenseDocument,
  getApprovalHistory,
  listUsers,
  setUserStatus,
};
