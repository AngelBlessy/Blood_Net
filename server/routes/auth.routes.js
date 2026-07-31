const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { attachUserIfPresent, requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

const router = Router();

router.post('/register', asyncHandler(ctrl.register));
router.post('/verify-otp', asyncHandler(ctrl.verifyOtpHandler));
router.post('/resend-otp', asyncHandler(ctrl.resendOtpHandler));
router.post('/login', asyncHandler(ctrl.login));
router.post('/logout', ctrl.logout);
router.get('/me', attachUserIfPresent, asyncHandler(ctrl.me));
router.post('/forgot-password/request-otp', asyncHandler(ctrl.requestPasswordResetOtp));
router.post('/forgot-password/reset', asyncHandler(ctrl.resetPassword));
// Hospital/bloodbank/admin self-service profile edit (donor has its own under /donors).
router.post('/me/profile/otp', requireAuth, asyncHandler(ctrl.requestProfileEditOtp));
router.patch('/me/profile', requireAuth, asyncHandler(ctrl.updateMyProfile));

module.exports = router;
