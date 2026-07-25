const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { requireAuth, requireRole, attachUserIfPresent } = require('../middleware/auth');
const ctrl = require('../controllers/inventory.controller');

const router = Router();

router.get('/', attachUserIfPresent, asyncHandler(ctrl.list));
router.put('/:bloodGroup', requireAuth, requireRole('bloodbank'), asyncHandler(ctrl.upsert));

module.exports = router;
