const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { attachUserIfPresent, requireAuth } = require('../middleware/auth');
const { uploadLicenseDocument } = require('../middleware/upload');
const ctrl = require('../controllers/auth.controller');

const router = Router();

// uploadLicenseDocument no-ops (passes straight through) for non-multipart
// requests, so donor registration's plain JSON body is unaffected -- only
// hospital/bloodbank submit multipart/form-data with the license file.
router.post('/register', uploadLicenseDocument, asyncHandler(ctrl.register));
router.post('/verify-otp', asyncHandler(ctrl.verifyOtpHandler));
router.post('/resend-otp', asyncHandler(ctrl.resendOtpHandler));
router.post('/login', asyncHandler(ctrl.login));
router.post('/request-reactivation', asyncHandler(ctrl.requestReactivation));
router.post('/resubmit/request-otp', asyncHandler(ctrl.requestResubmitOtp));
router.post('/resubmit', uploadLicenseDocument, asyncHandler(ctrl.resubmitRegistration));
router.post('/logout', ctrl.logout);
router.get('/me', attachUserIfPresent, asyncHandler(ctrl.me));
router.post('/forgot-password/request-otp', asyncHandler(ctrl.requestPasswordResetOtp));
router.post('/forgot-password/reset', asyncHandler(ctrl.resetPassword));
// Hospital/bloodbank/admin self-service profile edit (donor has its own under /donors).
router.post('/me/profile/otp', requireAuth, asyncHandler(ctrl.requestProfileEditOtp));
router.patch('/me/profile', requireAuth, uploadLicenseDocument, asyncHandler(ctrl.updateMyProfile));

module.exports = router;
