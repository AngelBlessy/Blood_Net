const Notification = require('../models/notification.model');

function serialize(notification) {
  return {
    id: notification._id.toString(),
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

async function mine(req, res) {
  const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
  res.json({ notifications: notifications.map(serialize) });
}

async function markRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { isRead: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ error: 'Notification not found.' });
  res.json({ ok: true, notification: serialize(notification) });
}

module.exports = { mine, markRead };
