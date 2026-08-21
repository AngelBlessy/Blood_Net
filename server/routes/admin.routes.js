const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/stats', asyncHandler(ctrl.stats));
router.get('/analytics', asyncHandler(ctrl.analytics));
router.get('/trends', asyncHandler(ctrl.trends));
router.get('/hospitals/pending', asyncHandler(ctrl.pendingHospitals));
router.post('/hospitals/:id/:decision(approve|reject)', asyncHandler(ctrl.decideHospital));
router.get('/hospitals/:id/license-document', asyncHandler(ctrl.getHospitalLicenseDocument));
router.get('/bloodbanks/pending', asyncHandler(ctrl.pendingBloodBanks));
router.post('/bloodbanks/:id/:decision(approve|reject)', asyncHandler(ctrl.decideBloodBank));
router.get('/bloodbanks/:id/license-document', asyncHandler(ctrl.getBloodBankLicenseDocument));
router.get('/approval-history', asyncHandler(ctrl.getApprovalHistory));
router.get('/users', asyncHandler(ctrl.listUsers));
router.post('/users/:id/:action(suspend|activate)', asyncHandler(ctrl.setUserStatus));

module.exports = router;
