const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { requireAuth, requireRole, attachUserIfPresent } = require('../middleware/auth');
const ctrl = require('../controllers/hospital-requests.controller');

const router = Router();

router.get('/', attachUserIfPresent, asyncHandler(ctrl.list));
router.post('/', requireAuth, requireRole('hospital', 'donor', 'bloodbank'), asyncHandler(ctrl.create));
// Admin can also manage guest-raised requests, which have no owning hospital.
// donor/bloodbank are here because requireOwnedRequest() already scopes them
// to requests they personally raised — this just lets that check run.
router.patch('/:id', requireAuth, requireRole('hospital', 'donor', 'bloodbank', 'admin'), asyncHandler(ctrl.update));
router.post('/:id/notify', requireAuth, requireRole('donor', 'hospital', 'bloodbank'), asyncHandler(ctrl.notify));
router.post('/:id/respond', requireAuth, requireRole('donor'), asyncHandler(ctrl.respond));
router.post('/:id/respond-bank', requireAuth, requireRole('bloodbank'), asyncHandler(ctrl.respondBloodBank));

module.exports = router;
