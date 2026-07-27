const mongoose = require('mongoose');
const { APPROVAL_STATUSES } = require('../constants');
const { geoPointSchema } = require('./geo-point.schema');

const bloodBankProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bankName: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    approvalStatus: { type: String, enum: APPROVAL_STATUSES, default: 'pending' },
    location: { type: geoPointSchema, default: undefined },
  },
  { timestamps: true }
);

bloodBankProfileSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('BloodBankProfile', bloodBankProfileSchema);
