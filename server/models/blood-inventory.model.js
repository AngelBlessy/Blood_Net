const mongoose = require('mongoose');
const { BLOOD_GROUPS } = require('../constants');

const bloodInventorySchema = new mongoose.Schema(
  {
    bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodBankProfile', required: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    units: { type: Number, required: true, min: 0, default: 0 },
    expiry: { type: Date, default: null },
    location: { type: String, trim: true, default: '' },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bloodInventorySchema.index({ bankId: 1, bloodGroup: 1 }, { unique: true });

module.exports = mongoose.model('BloodInventory', bloodInventorySchema);
