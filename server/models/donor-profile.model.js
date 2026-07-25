const mongoose = require('mongoose');
const { BLOOD_GROUPS } = require('../constants');

const donorProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 1, max: 120 },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    donatedEver: { type: String, enum: ['yes', 'no'], default: 'no' },
    lastDonationDate: { type: Date, default: null },
    traveling: { type: Boolean, default: false },
    availabilityStatus: { type: String, enum: ['available', 'unavailable'], default: 'available' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DonorProfile', donorProfileSchema);
