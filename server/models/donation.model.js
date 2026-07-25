const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'DonorProfile', required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalProfile', required: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    donationDate: { type: Date, default: Date.now },
    unitsDonated: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Donation', donationSchema);
