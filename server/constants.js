const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const ROLES = ['donor', 'hospital', 'bloodbank', 'admin'];

const REQUEST_PRIORITIES = ['Critical', 'Urgent', 'Routine'];

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

// Emergency-alert search radius escalation steps (km). The last step means
// "stop widening, alert everyone compatible regardless of distance."
const RADIUS_STEPS_KM = [15, 30, 60, 120];

module.exports = { BLOOD_GROUPS, ROLES, REQUEST_PRIORITIES, APPROVAL_STATUSES, RADIUS_STEPS_KM };
