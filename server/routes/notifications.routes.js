const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/notifications.controller');

const router = Router();
router.use(requireAuth);

router.get('/me', asyncHandler(ctrl.mine));
router.patch('/:id/read', asyncHandler(ctrl.markRead));

module.exports = router;
