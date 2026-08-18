const mongoose = require('mongoose');

// Connects to the single mongodb-memory-server instance started once in
// global-setup.js (shared across all test files in this run -- starting a
// fresh in-memory mongod per file would be correct but far slower).
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_TEST_URI);
  }
});

// Wipes every collection between tests so one test's fixtures can never leak
// into the next -- cheaper than dropping/recreating the database, and safe
// because indexes aren't touched.
afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
