const mongoose = require('mongoose');
const { env } = require('../config/env');

async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongodbUri);
  return mongoose.connection;
}

module.exports = { connectDb };
