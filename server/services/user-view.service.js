const DonorProfile = require('../models/donor-profile.model');
const HospitalProfile = require('../models/hospital-profile.model');
const BloodBankProfile = require('../models/blood-bank-profile.model');

// Flattens a User + its role-specific profile into one object shaped close to
// the client's existing `User` type, to minimize frontend churn.
async function buildUserView(user) {
  const base = {
    id: user._id.toString(),
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
  };

  if (user.role === 'donor') {
    const profile = await DonorProfile.findOne({ userId: user._id });
    if (!profile) return base;
    return {
      ...base,
      name: profile.name,
      age: profile.age,
      bloodGroup: profile.bloodGroup,
      donatedEver: profile.donatedEver,
      lastDonationDate: profile.lastDonationDate,
      traveling: profile.traveling,
      availabilityStatus: profile.availabilityStatus,
      donorId: profile._id.toString(),
    };
  }

  if (user.role === 'hospital') {
    const profile = await HospitalProfile.findOne({ userId: user._id });
    if (!profile) return base;
    return {
      ...base,
      hospitalName: profile.hospitalName,
      licenseNumber: profile.licenseNumber,
      address: profile.address,
      city: profile.city,
      approvalStatus: profile.approvalStatus,
      hospitalId: profile._id.toString(),
    };
  }

  if (user.role === 'bloodbank') {
    const profile = await BloodBankProfile.findOne({ userId: user._id });
    if (!profile) return base;
    return {
      ...base,
      bankName: profile.bankName,
      address: profile.address,
      city: profile.city,
      contactNumber: profile.contactNumber,
      approvalStatus: profile.approvalStatus,
      bankId: profile._id.toString(),
    };
  }

  return base;
}

module.exports = { buildUserView };
