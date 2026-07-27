const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/donors.controller');

const router = Router();

router.get('/count', asyncHandler(ctrl.count));
router.patch('/me', requireAuth, requireRole('donor'), asyncHandler(ctrl.updateMe));
router.post('/me/profile/otp', requireAuth, requireRole('donor'), asyncHandler(ctrl.requestProfileEditOtp));
router.patch('/me/profile', requireAuth, requireRole('donor'), asyncHandler(ctrl.updateMyProfile));
router.get('/me/summary', requireAuth, requireRole('donor'), asyncHandler(ctrl.mySummary));
router.get('/me/alerts', requireAuth, requireRole('donor'), asyncHandler(ctrl.myAlerts));
router.get(
  '/me/donations/:id/certificate',
  requireAuth,
  requireRole('donor'),
  asyncHandler(ctrl.downloadCertificate)
);

module.exports = router;
