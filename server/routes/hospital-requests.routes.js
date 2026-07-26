const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { requireAuth, requireRole, attachUserIfPresent } = require('../middleware/auth');
const ctrl = require('../controllers/hospital-requests.controller');

const router = Router();

router.get('/', attachUserIfPresent, asyncHandler(ctrl.list));
router.post('/', requireAuth, requireRole('hospital'), asyncHandler(ctrl.create));
// Admin can also manage guest-raised requests, which have no owning hospital.
router.patch('/:id', requireAuth, requireRole('hospital', 'admin'), asyncHandler(ctrl.update));
router.post('/:id/notify', requireAuth, requireRole('hospital', 'admin'), asyncHandler(ctrl.notify));
router.post('/:id/respond', requireAuth, requireRole('donor'), asyncHandler(ctrl.respond));

module.exports = router;
