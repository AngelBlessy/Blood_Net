// Ported from client/src/lib/blood-compatibility.ts so donor matching can run
// server-side instead of trusting a client-supplied recipient list.

// For a patient who needs `group`, which donor blood groups can they receive from.
const COMPATIBLE_DONOR_GROUPS = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

function isDonorCompatible(patientNeeds, donorGroup) {
  return COMPATIBLE_DONOR_GROUPS[patientNeeds]?.includes(donorGroup) ?? false;
}

function compatibleDonorGroups(patientNeeds) {
  return COMPATIBLE_DONOR_GROUPS[patientNeeds] || [];
}

module.exports = { COMPATIBLE_DONOR_GROUPS, isDonorCompatible, compatibleDonorGroups };
