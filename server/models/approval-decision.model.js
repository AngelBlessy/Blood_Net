const mongoose = require('mongoose');

// Append-only audit log of every hospital/blood-bank approve or reject
// decision an admin makes -- separate from HospitalProfile/BloodBankProfile
// (which only ever hold the *current* status) so re-submission and repeat
// review cycles don't erase the history of what happened before.
const approvalDecisionSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['hospital', 'bloodbank'], required: true },
    profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Snapshot of the name at decision time, so the log still reads
    // sensibly even if the account is later renamed or deleted.
    entityName: { type: String, required: true, trim: true },
    decision: { type: String, enum: ['approved', 'rejected'], required: true },
    reason: { type: String, trim: true, default: null },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decidedByEmail: { type: String, required: true },
  },
  { timestamps: true }
);

approvalDecisionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ApprovalDecision', approvalDecisionSchema);
