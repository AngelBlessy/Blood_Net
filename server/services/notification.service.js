const Notification = require('../models/notification.model');
const { emitToUser } = require('../realtime/socket');

// Creates a persisted Notification and pushes it live over Socket.IO in one
// step, so the bell updates instantly for anyone connected instead of
// waiting for its next poll. Never throws — a notification failure should
// never block the alert/response flow that triggered it; callers fire this
// without awaiting if they don't need to know the result.
async function notifyUser(userId, title, message) {
  if (!userId) return null;
  try {
    const notification = await Notification.create({ userId, title, message });
    emitToUser(userId, 'notification:new', {
      id: notification._id.toString(),
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    });
    return notification;
  } catch (error) {
    console.error('notifyUser failed:', error.message);
    return null;
  }
}

module.exports = { notifyUser };
