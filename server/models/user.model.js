const mongoose = require('mongoose');
const { ROLES } = require('../constants');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Not unique -- multiple accounts (e.g. a donor and a hospital contact)
    // are allowed to share a phone number. Still indexed since it's looked
    // up often, just not enforced as one-account-per-number.
    phone: { type: String, required: true, index: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    // Set when a suspended user asks an admin to review their suspension
    // (see requestReactivation); cleared once an admin acts on it.
    reactivationRequestedAt: { type: Date, default: null },
    // Only meaningful while status is 'suspended' -- cleared back to null the
    // moment an admin reactivates the account.
    suspensionReason: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
