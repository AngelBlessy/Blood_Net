const { Router } = require('express');
const authRoutes = require('./auth.routes');
const donorsRoutes = require('./donors.routes');
const hospitalRequestsRoutes = require('./hospital-requests.routes');
const guestRequestsRoutes = require('./guest-requests.routes');
const inventoryRoutes = require('./inventory.routes');
const adminRoutes = require('./admin.routes');
const notificationsRoutes = require('./notifications.routes');
const translateRoutes = require('./translate.routes');
const searchRoutes = require('./search.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/donors', donorsRoutes);
router.use('/hospital-requests', hospitalRequestsRoutes);
router.use('/guest-requests', guestRequestsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/translate', translateRoutes);
router.use('/search', searchRoutes);

router.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = router;
