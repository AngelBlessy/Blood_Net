const mongoose = require('mongoose');

const bloodBankResponseSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
    bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodBankProfile', required: true },
    response: { type: String, enum: ['Accepted', 'Declined'], required: true },
    // Units deducted from the bank's own inventory when they accepted — kept
    // here (rather than only on BloodInventory) so the accept can't silently
    // double-deduct if this endpoint is ever called again for the same pair.
    unitsCommitted: { type: Number, default: 0 },
    respondedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bloodBankResponseSchema.index({ requestId: 1, bankId: 1 }, { unique: true });

module.exports = mongoose.model('BloodBankResponse', bloodBankResponseSchema);
