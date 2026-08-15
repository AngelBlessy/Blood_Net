// One-time demo-data seeder: adds a handful of realistic donor accounts so
// the priority-ranking / tiered-alert demo has enough donors to actually show
// variation and tiering (the base dev DB only has 3). Coordinates are real,
// plausible points around Bengaluru/Mysuru/Mumbai -- not tied to any real
// person's actual address, just valid geo data for distance math to work on.
//
// Also backfills `state` on the two existing Bengaluru hospitals so the
// Urgent/Routine city+state matching path has something real to match
// against (older accounts predate the `state` field).
//
// Run once: node server/seed-demo-donors.js
// Safe to re-run -- skips any donor whose email already exists.

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDb } = require('./db/connect');
const User = require('./models/user.model');
const DonorProfile = require('./models/donor-profile.model');
const DonorResponse = require('./models/donor-response.model');
const Donation = require('./models/donation.model');
const HospitalProfile = require('./models/hospital-profile.model');
const BloodRequest = require('./models/blood-request.model');

const DEMO_PASSWORD = 'Demo@1234';

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// [lng, lat] -- real, varied points so distance ranking has something to work
// with. Bengaluru donors are scattered across different neighborhoods (not
// all stacked on one point); the last two are deliberately outside
// Bengaluru/Karnataka to demonstrate that Urgent/Routine (city+state scoped)
// correctly excludes them while Critical (platform-wide) still reaches them.
const DONORS = [
  {
    name: 'Ravi Kumar',
    email: 'ravi.kumar@bloodnet.test',
    phone: '9000000001',
    bloodGroup: 'O+',
    city: 'Bengaluru',
    state: 'Karnataka',
    coords: [77.6045, 12.9758], // MG Road
    lastDonationDaysAgo: 120,
    donatedEver: 'yes',
    responseHistory: [
      { requestIndex: 0, response: 'Accepted', latencyHours: 1.5 },
      { requestIndex: 1, response: 'Accepted', latencyHours: 2 },
      { requestIndex: 2, response: 'Accepted', latencyHours: 0.8 },
    ],
    donationCount: 2,
  },
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@bloodnet.test',
    phone: '9000000002',
    bloodGroup: 'A+',
    city: 'Bengaluru',
    state: 'Karnataka',
    coords: [77.6245, 12.9352], // Koramangala
    lastDonationDaysAgo: null,
    donatedEver: 'no',
    responseHistory: [], // brand-new donor, no history -- neutral defaults
    donationCount: 0,
  },
  {
    name: 'Karthik Reddy',
    email: 'karthik.reddy@bloodnet.test',
    phone: '9000000003',
    bloodGroup: 'B+',
    city: 'Bengaluru',
    state: 'Karnataka',
    coords: [77.75, 12.9698], // Whitefield -- farther from central Bengaluru
    lastDonationDaysAgo: 45,
    donatedEver: 'yes',
    responseHistory: [
      { requestIndex: 0, response: 'Declined', latencyHours: 30 },
      { requestIndex: 3, response: 'Accepted', latencyHours: 48 },
    ],
    donationCount: 1,
  },
  {
    name: 'Meera Nair',
    email: 'meera.nair@bloodnet.test',
    phone: '9000000004',
    bloodGroup: 'AB+',
    city: 'Bengaluru',
    state: 'Karnataka',
    coords: [77.6408, 12.9784], // Indiranagar
    lastDonationDaysAgo: 200,
    donatedEver: 'yes',
    responseHistory: [
      { requestIndex: 0, response: 'Accepted', latencyHours: 0.5 },
      { requestIndex: 1, response: 'Accepted', latencyHours: 1 },
      { requestIndex: 2, response: 'Accepted', latencyHours: 0.6 },
      { requestIndex: 3, response: 'Accepted', latencyHours: 1.2 },
    ],
    donationCount: 5,
  },
  {
    name: 'Suresh Babu',
    email: 'suresh.babu@bloodnet.test',
    phone: '9000000005',
    bloodGroup: 'O-',
    city: 'Mysuru',
    state: 'Karnataka', // same state as the demo hospitals, different city
    coords: [76.6394, 12.2958],
    lastDonationDaysAgo: null,
    donatedEver: 'no',
    responseHistory: [],
    donationCount: 0,
  },
  {
    name: 'Anjali Mehta',
    email: 'anjali.mehta@bloodnet.test',
    phone: '9000000006',
    bloodGroup: 'B-',
    city: 'Mumbai',
    state: 'Maharashtra', // different state entirely
    coords: [72.8777, 19.076],
    lastDonationDaysAgo: 60,
    donatedEver: 'yes',
    responseHistory: [{ requestIndex: 0, response: 'Declined', latencyHours: 60 }],
    donationCount: 0,
  },
];

async function main() {
  await connectDb();

  // Backfill state on the existing Bengaluru hospitals so raising a request
  // as one of them actually has a state to match Urgent/Routine donors against.
  const hospitalUpdate = await HospitalProfile.updateMany(
    { city: 'Bengaluru', state: null },
    { $set: { state: 'Karnataka' } }
  );
  console.log(`Backfilled state on ${hospitalUpdate.modifiedCount} existing Bengaluru hospital(s).`);

  // Anchor requests for synthetic response-history timestamps -- reused
  // as-is, not modified.
  const anchorRequests = await BloodRequest.find({}, { createdAt: 1 }).sort({ createdAt: 1 }).limit(4);
  if (anchorRequests.length < 4) {
    console.warn('Fewer than 4 existing requests found -- response-history seeding will be partial.');
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const created = [];

  for (const donor of DONORS) {
    const existingUser = await User.findOne({ email: donor.email });
    if (existingUser) {
      console.log(`Skipping ${donor.name} -- ${donor.email} already exists.`);
      continue;
    }

    const user = await User.create({
      email: donor.email,
      phone: donor.phone,
      passwordHash,
      role: 'donor',
      status: 'active',
      emailVerified: true,
      phoneVerified: true,
    });

    const profile = await DonorProfile.create({
      userId: user._id,
      name: donor.name,
      age: 25 + Math.floor(Math.random() * 20),
      bloodGroup: donor.bloodGroup,
      donatedEver: donor.donatedEver,
      lastDonationDate: donor.lastDonationDaysAgo !== null ? daysAgo(donor.lastDonationDaysAgo) : null,
      traveling: false,
      availabilityStatus: 'available',
      city: donor.city,
      state: donor.state,
      location: { type: 'Point', coordinates: donor.coords },
    });

    for (const entry of donor.responseHistory) {
      const request = anchorRequests[entry.requestIndex];
      if (!request) continue;
      await DonorResponse.create({
        requestId: request._id,
        donorId: profile._id,
        response: entry.response,
        respondedAt: new Date(request.createdAt.getTime() + entry.latencyHours * 60 * 60 * 1000),
      });
    }

    for (let i = 0; i < donor.donationCount; i++) {
      await Donation.create({
        donorId: profile._id,
        donationDate: daysAgo(30 + i * 60),
        unitsDonated: 1,
      });
    }

    created.push({ name: donor.name, email: donor.email, bloodGroup: donor.bloodGroup, city: donor.city });
  }

  console.log(`\nCreated ${created.length} demo donor(s):`);
  created.forEach((d) => console.log(`  ${d.name} (${d.bloodGroup}, ${d.city}) -- login: ${d.email} / ${DEMO_PASSWORD}`));

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Demo donor seeding failed:', error);
  process.exit(1);
});
