const { findRankedDonors } = require('./donor-matching.service');
const { sendMail } = require('./mailer.service');
const { sendSms } = require('./sms.service');

async function notifyDonorsForRequest(request) {
  const donors = await findRankedDonors(request.bloodGroup);

  if (!donors.length) {
    return {
      matches: 0,
      emailSent: 0,
      smsSent: 0,
      message: 'No compatible registered donors are currently available.',
    };
  }

  const subject = `Urgent blood request: ${request.bloodGroup} needed`;
  const message = [
    'BloodNet emergency alert',
    '',
    `Patient / case: ${request.patient}`,
    `Blood group needed: ${request.bloodGroup}`,
    `Units needed: ${request.unitsRequired}`,
    `Priority: ${request.priority}`,
    ...(request.contactName && request.contactPhone
      ? ['', `Requested by: ${request.contactName} (${request.contactPhone})`]
      : []),
    '',
    'Please respond to the hospital if you are available to donate.',
  ].join('\n');

  const results = await Promise.all(
    donors.map(async (donor) => {
      const user = donor.userId;
      const [emailResult, smsResult] = await Promise.allSettled([
        sendMail({ to: user.email, subject, text: message }),
        sendSms(user.phone, message),
      ]);
      return { email: emailResult.status === 'fulfilled', sms: smsResult.status === 'fulfilled' };
    })
  );

  const emailSent = results.filter((result) => result.email).length;
  const smsSent = results.filter((result) => result.sms).length;

  return {
    matches: donors.length,
    emailSent,
    smsSent,
    message: `Alert sent to ${donors.length} donor${donors.length === 1 ? '' : 's'} (${emailSent} email, ${smsSent} SMS).`,
  };
}

module.exports = { notifyDonorsForRequest };
