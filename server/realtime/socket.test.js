const { emitToRequest, emitToUser, emitToAdmins } = require('./socket');

// None of these tests call initSocket() -- every controller that fires one
// of these during a normal (non-socket) integration test relies on the
// module's internal `io` staying null and every emit becoming a safe no-op
// instead of throwing. That's exactly what's being verified here.
describe('realtime/socket emit helpers (before initSocket has run)', () => {
  it('emitToRequest does not throw for a hospital-raised request', () => {
    expect(() =>
      emitToRequest({ hospitalId: '507f1f77bcf86cd799439011', raisedByUserId: null }, 'request:update', {})
    ).not.toThrow();
  });

  it('emitToRequest does not throw for a guest-raised request with neither hospitalId nor raisedByUserId', () => {
    expect(() => emitToRequest({ hospitalId: null, raisedByUserId: null }, 'request:update', {})).not.toThrow();
  });

  it('emitToUser does not throw, including with a null/undefined userId', () => {
    expect(() => emitToUser('507f1f77bcf86cd799439011', 'notification:new', {})).not.toThrow();
    expect(() => emitToUser(null, 'notification:new', {})).not.toThrow();
    expect(() => emitToUser(undefined, 'notification:new', {})).not.toThrow();
  });

  it('emitToAdmins does not throw', () => {
    expect(() => emitToAdmins('admin:refresh')).not.toThrow();
  });
});
