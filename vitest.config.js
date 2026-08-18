const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/**/*.test.js'],
    exclude: ['**/node_modules/**', 'client/**'],
    globalSetup: ['./server/test/global-setup.js'],
    setupFiles: ['./server/test/setup.js'],
    // DB-backed integration tests spin up a real (in-memory) mongod and do
    // several round trips per test; the default 5s can be tight on a cold
    // CI runner the first time mongodb-memory-server downloads/caches a binary.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // mongodb-memory-server + the shared mongoose connection in setup.js are
    // process-global, so running test files in parallel would race on the
    // same in-memory DB instead of getting isolated ones.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['server/**/*.js'],
      exclude: [
        'server/test/**',
        'server/**/*.test.js',
        'server/index.js', // process entrypoint — exercised by running the app, not unit tests
        'server/seed.js',
        'server/seed-demo-donors.js',
      ],
    },
  },
});
