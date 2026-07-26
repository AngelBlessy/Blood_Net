const mongoose = require('mongoose');
const { APPROVAL_STATUSES } = require('../constants');

const hospitalProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    hospitalName: { type: String, required: true, trim: true },
    licenseNumber: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    contactNumber: { type: String, trim: true, default: null },
    approvalStatus: { type: String, enum: APPROVAL_STATUSES, default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HospitalProfile', hospitalProfileSchema);
