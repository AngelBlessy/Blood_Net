const mongoose = require('mongoose');

const donorResponseSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'DonorProfile', required: true },
    response: { type: String, enum: ['Accepted', 'Declined'], required: true },
    respondedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

donorResponseSchema.index({ requestId: 1, donorId: 1 }, { unique: true });

module.exports = mongoose.model('DonorResponse', donorResponseSchema);
