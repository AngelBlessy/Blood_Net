const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const ctrl = require('../controllers/translate.controller');

// Public and unauthenticated on purpose — the UI needs translated strings
// (nav, login/register forms, etc.) before a session exists.
const router = Router();

router.post('/', asyncHandler(ctrl.translate));

module.exports = router;
