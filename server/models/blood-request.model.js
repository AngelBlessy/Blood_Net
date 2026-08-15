const mongoose = require('mongoose');
const { BLOOD_GROUPS, REQUEST_PRIORITIES, RADIUS_STEPS_KM, TIER_NOTIFY_INTERVAL_MS } = require('../constants');
const { geoPointSchema } = require('./geo-point.schema');

const ESCALATION_INTERVAL_MS = 10 * 60 * 1000;

const bloodRequestSchema = new mongoose.Schema(
  {
    // Null for guest-raised requests (phone-OTP verified, no hospital account).
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalProfile', default: null },
    raisedBy: { type: String, enum: ['hospital', 'guest', 'donor', 'bloodbank'], required: true },
    // Set for authenticated raisers (hospital/donor/bloodbank) so they can look up requests they raised; null for guests.
    raisedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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
    // Optional — copied from the hospital's registered location for
    // hospital-raised requests, or captured via browser geolocation for
    // guest/donor/bloodbank-raised requests. Absent means "no radius concept
    // applies to this request," matching legacy no-location behavior.
    location: { type: geoPointSchema, default: undefined },
    // Copied from the raiser's profile at creation (or the guest form, when
    // captured). Drives priority-based auto-alert matching for Urgent/Routine
    // requests (exact city+state match) — separate concept from `location`,
    // which drives the km-radius escalation job and stays untouched by this.
    city: { type: String, trim: true, default: null },
    state: { type: String, trim: true, default: null },
    searchRadiusKm: { type: Number, default: RADIUS_STEPS_KM[0] },
    radiusExpansions: { type: Number, default: 0 },
    nextEscalationAt: { type: Date, default: () => new Date(Date.now() + ESCALATION_INTERVAL_MS) },
    escalationDone: { type: Boolean, default: false },
    // Priority-tiered notification: every donor ever alerted for this request,
    // so re-notify calls (manual, or the tier-progression job) only reach
    // *new* donors instead of re-spamming the same top-ranked ones. Separate
    // from the km-radius escalation above -- this progresses through the
    // *already-matched* ranked pool; radius escalation grows the pool itself.
    notifiedDonorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DonorProfile' }],
    nextTierNotifyAt: { type: Date, default: () => new Date(Date.now() + TIER_NOTIFY_INTERVAL_MS) },
    tierNotifyDone: { type: Boolean, default: false },
  },
  { timestamps: true }
);

bloodRequestSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);
