const mongoose = require('mongoose');
const { APPROVAL_STATUSES } = require('../constants');
const { geoPointSchema } = require('./geo-point.schema');
const { licenseDocumentSchema } = require('./license-document.schema');

const bloodBankProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bankName: { type: String, required: true, trim: true },
    licenseNumber: { type: String, required: true, trim: true },
    licenseDocument: { type: licenseDocumentSchema, default: undefined },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true, default: null },
    contactNumber: { type: String, trim: true },
    approvalStatus: { type: String, enum: APPROVAL_STATUSES, default: 'pending' },
    // Only meaningful while approvalStatus is 'rejected' -- cleared back to
    // null the moment the account is approved or resubmits for review.
    rejectionReason: { type: String, trim: true, default: null },
    location: { type: geoPointSchema, default: undefined },
  },
  { timestamps: true }
);

bloodBankProfileSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('BloodBankProfile', bloodBankProfileSchema);
