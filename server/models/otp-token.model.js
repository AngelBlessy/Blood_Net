const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema(
  {
    target: { type: String, required: true, trim: true, lowercase: true },
    purpose: { type: String, enum: ['register', 'forgot-password', 'guest-request', 'edit-profile'], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    resendAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

otpTokenSchema.index({ target: 1, purpose: 1 });

module.exports = mongoose.model('OtpToken', otpTokenSchema);
