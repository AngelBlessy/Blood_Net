const mongoose = require('mongoose');
const { BLOOD_GROUPS, REQUEST_PRIORITIES } = require('../constants');

const bloodRequestSchema = new mongoose.Schema(
  {
    // Null for guest-raised requests (phone-OTP verified, no hospital account).
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalProfile', default: null },
    raisedBy: { type: String, enum: ['hospital', 'guest'], required: true },
    guestName: { type: String, trim: true, default: null },
    guestPhone: { type: String, trim: true, default: null },
    contactName: { type: String, trim: true, default: null },
    contactPhone: { type: String, trim: true, default: null },
    patient: { type: String, required: true, trim: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    unitsRequired: { type: Number, required: true, min: 1 },
    priority: { type: String, enum: REQUEST_PRIORITIES, default: 'Critical' },
    status: { type: String, default: 'New emergency request' },
    matches: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);
