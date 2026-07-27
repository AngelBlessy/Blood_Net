const bcrypt = require('bcryptjs');
const { connectDb } = require('./db/connect');
const { env } = require('./config/env');
const User = require('./models/user.model');

async function seed() {
  if (!env.admin.email || !env.admin.password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running the seed script.');
    process.exit(1);
  }

  await connectDb();

  const passwordHash = await bcrypt.hash(env.admin.password, 10);
  const existing = await User.findOne({ role: 'admin' });

  if (existing) {
    existing.email = env.admin.email;
    existing.passwordHash = passwordHash;
    existing.status = 'active';
    existing.emailVerified = true;
    existing.phoneVerified = true;
    await existing.save();
    console.log(`Admin account updated: ${env.admin.email}`);
    process.exit(0);
  }

  await User.create({
    email: env.admin.email,
    phone: '0000000000',
    passwordHash,
    role: 'admin',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
  });

  console.log(`Admin account created: ${env.admin.email}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
