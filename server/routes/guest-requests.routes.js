const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const ctrl = require('../controllers/guest-requests.controller');

// Public, unauthenticated routes — the phone OTP itself is the only gate.
const router = Router();

router.post('/otp', asyncHandler(ctrl.requestOtp));
router.post('/', asyncHandler(ctrl.create));

module.exports = router;
