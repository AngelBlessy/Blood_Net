const mongoose = require('mongoose');
const { BLOOD_GROUPS } = require('../constants');
const { geoPointSchema } = require('./geo-point.schema');

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
    city: { type: String, trim: true, default: null },
    state: { type: String, trim: true, default: null },
    // Optional — donors who never grant location access simply don't show up
    // in distance-ranked search/alerts, but everything else still works.
    location: { type: geoPointSchema, default: undefined },
  },
  { timestamps: true }
);

donorProfileSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('DonorProfile', donorProfileSchema);
