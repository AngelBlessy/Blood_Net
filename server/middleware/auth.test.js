const jwt = require('jsonwebtoken');
const { COOKIE_NAME, signToken, requireAuth, attachUserIfPresent, requireRole } = require('./auth');
const { env } = require('../config/env');

function mockReq(cookieValue) {
  return { cookies: cookieValue ? { [COOKIE_NAME]: cookieValue } : {} };
}

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('middleware/auth', () => {
  describe('signToken', () => {
    it('produces a JWT that verifies with the configured secret and carries the payload', () => {
      const token = signToken({ id: 'abc123', role: 'donor' });
      const decoded = jwt.verify(token, env.jwt.secret);
      expect(decoded.id).toBe('abc123');
      expect(decoded.role).toBe('donor');
    });
  });

  describe('requireAuth', () => {
    it('rejects with 401 when there is no session cookie', () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects with 401 for a malformed/invalid token', () => {
      const req = mockReq('not-a-real-jwt');
      const res = mockRes();
      const next = vi.fn();
      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('sets req.user and calls next() for a valid token', () => {
      const token = signToken({ id: 'user-1', role: 'hospital' });
      const req = mockReq(token);
      const res = mockRes();
      const next = vi.fn();
      requireAuth(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toMatchObject({ id: 'user-1', role: 'hospital' });
    });
  });

  describe('attachUserIfPresent', () => {
    it('calls next() without setting req.user when there is no cookie', () => {
      const req = mockReq();
      const next = vi.fn();
      attachUserIfPresent(req, {}, next);
      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeUndefined();
    });

    it('calls next() without throwing for an invalid token', () => {
      const req = mockReq('garbage');
      const next = vi.fn();
      expect(() => attachUserIfPresent(req, {}, next)).not.toThrow();
      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeUndefined();
    });

    it('sets req.user and calls next() for a valid token', () => {
      const token = signToken({ id: 'user-2', role: 'admin' });
      const req = mockReq(token);
      const next = vi.fn();
      attachUserIfPresent(req, {}, next);
      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toMatchObject({ id: 'user-2', role: 'admin' });
    });
  });

  describe('requireRole', () => {
    it('calls next() when req.user has an allowed role', () => {
      const req = { user: { id: '1', role: 'admin' } };
      const res = mockRes();
      const next = vi.fn();
      requireRole('admin', 'hospital')(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects with 403 when req.user has a disallowed role', () => {
      const req = { user: { id: '1', role: 'donor' } };
      const res = mockRes();
      const next = vi.fn();
      requireRole('admin')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects with 403 when there is no req.user at all', () => {
      const req = {};
      const res = mockRes();
      const next = vi.fn();
      requireRole('admin')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
