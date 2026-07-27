const { Router } = require('express');
const { asyncHandler } = require('../utils/async-handler');
const ctrl = require('../controllers/search.controller');

// Public — "hospitals or anyone in need" per the spec. No PII beyond a masked
// name and an approximate (jittered) location is ever returned here.
const router = Router();

router.get('/donors', asyncHandler(ctrl.searchDonors));

module.exports = router;
