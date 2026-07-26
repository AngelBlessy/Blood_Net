const { sendMail } = require('../services/mailer.service');
const { sendSms } = require('../services/sms.service');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;

async function sendEmergencyAlerts(req, res) {
  try {
    const { request, recipients } = req.body || {};
    const patient = String(request?.patient || '').trim();
    const bloodGroup = String(request?.bloodGroup || '').trim();
    const units = Number(request?.units);
    const priority = String(request?.priority || '').trim();
    const contactName = String(request?.contactName || '').trim();
    const contactPhone = String(request?.contactPhone || '').replace(/\D/g, '');

    if (
      !patient ||
      !bloodGroup ||
      !Number.isInteger(units) ||
      units < 1 ||
      !priority ||
      !contactName ||
      !PHONE_PATTERN.test(contactPhone) ||
      !Array.isArray(recipients) ||
      recipients.length > 100
    ) {
      return res.status(400).json({ error: 'Invalid emergency alert request' });
    }

    const subject = `Urgent blood request: ${bloodGroup} needed`;
    const message = `BloodNet emergency alert\n\nPatient / case: ${patient}\nBlood group needed: ${bloodGroup}\nUnits needed: ${units}\nPriority: ${priority}\n\nRequested by: ${contactName} (${contactPhone})\n\nPlease respond if you are available for donation.`;

    const results = await Promise.all(
      recipients.map(async (recipient) => {
        const email = String(recipient?.email || '').trim().toLowerCase();
        const phone = String(recipient?.phone || '').replace(/\D/g, '');
        const [emailResult, smsResult] = await Promise.allSettled([
          EMAIL_PATTERN.test(email) ? sendMail({ to: email, subject, text: message }) : Promise.reject(new Error('Invalid email')),
          PHONE_PATTERN.test(phone) ? sendSms(phone, message) : Promise.reject(new Error('Invalid phone')),
        ]);
        return { email: emailResult.status === 'fulfilled', sms: smsResult.status === 'fulfilled' };
      })
    );

    res.json({
      ok: true,
      emailSent: results.filter((result) => result.email).length,
      smsSent: results.filter((result) => result.sms).length,
    });
  } catch (error) {
    console.error('Emergency alert delivery failed:', error.message);
    res.status(500).json({ error: error.message });
  }
}

module.exports = { sendEmergencyAlerts };
