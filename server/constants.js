const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const ROLES = ['donor', 'hospital', 'bloodbank', 'admin'];

const REQUEST_PRIORITIES = ['Critical', 'Urgent', 'Routine'];

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

// Emergency-alert search radius escalation steps (km). The last step means
// "stop widening, alert everyone compatible regardless of distance."
const RADIUS_STEPS_KM = [15, 30, 60, 120];

// How many donors get alerted per priority tier -- the highest-Priority-Score
// donors are contacted first; if nobody in that batch responds, the next
// NOTIFY_TIER_SIZE donors down the ranked list are alerted TIER_NOTIFY_INTERVAL_MS
// later (see server/jobs/escalation.job.js). Independent of the km-radius
// escalation (RADIUS_STEPS_KM above), which widens the candidate pool itself
// rather than how many of it get contacted at once.
const NOTIFY_TIER_SIZE = 5;
const TIER_NOTIFY_INTERVAL_MS = 2 * 60 * 1000;

module.exports = {
  BLOOD_GROUPS,
  ROLES,
  REQUEST_PRIORITIES,
  APPROVAL_STATUSES,
  RADIUS_STEPS_KM,
  NOTIFY_TIER_SIZE,
  TIER_NOTIFY_INTERVAL_MS,
};
