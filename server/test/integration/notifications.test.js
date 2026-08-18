const { agent, createDonor, loginAndGetCookie } = require('../helpers');
const Notification = require('../../models/notification.model');

describe('GET /api/notifications/me', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await agent().get('/api/notifications/me');
    expect(response.status).toBe(401);
  });

  it("only returns the caller's own notifications, newest first", async () => {
    const { user, password } = await createDonor();
    const { user: otherUser } = await createDonor();
    await Notification.create({ userId: otherUser._id, title: 'Not mine', message: 'x' });
    const older = await Notification.create({ userId: user._id, title: 'Older', message: 'x' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = await Notification.create({ userId: user._id, title: 'Newer', message: 'x' });

    const cookie = await loginAndGetCookie({ email: user.email, password });
    const response = await agent().get('/api/notifications/me').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.notifications).toHaveLength(2);
    expect(response.body.notifications[0].id).toBe(newer._id.toString());
    expect(response.body.notifications[1].id).toBe(older._id.toString());
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks the caller\'s own notification as read', async () => {
    const { user, password } = await createDonor();
    const notification = await Notification.create({ userId: user._id, title: 'Hi', message: 'x' });
    const cookie = await loginAndGetCookie({ email: user.email, password });

    const response = await agent().patch(`/api/notifications/${notification._id}/read`).set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.notification.isRead).toBe(true);
  });

  it("cannot mark another user's notification as read", async () => {
    const { user: owner } = await createDonor();
    const notification = await Notification.create({ userId: owner._id, title: 'Hi', message: 'x' });

    const { user: intruder, password: intruderPassword } = await createDonor();
    const cookie = await loginAndGetCookie({ email: intruder.email, password: intruderPassword });

    const response = await agent().patch(`/api/notifications/${notification._id}/read`).set('Cookie', cookie);
    expect(response.status).toBe(404);

    const stillUnread = await Notification.findById(notification._id);
    expect(stillUnread.isRead).toBe(false);
  });
});
