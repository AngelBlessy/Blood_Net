const mongoose = require('mongoose');
const { ROLES } = require('../constants');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
