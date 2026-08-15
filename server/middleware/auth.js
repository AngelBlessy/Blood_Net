const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

const COOKIE_NAME = 'bloodnet_token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Client (Vercel) and server (Fly.io) are on different domains in
// production, so the auth cookie must be sent cross-site. That requires
// SameSite=None, which browsers only honor when Secure is also set. In dev
// the client is same-site (Vite proxy), where SameSite=None would actually
// be rejected without HTTPS, so keep Lax there.
const CROSS_SITE_COOKIES = env.clientOrigins.length > 0;

function signToken(payload) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: CROSS_SITE_COOKIES ? 'none' : 'lax',
    secure: CROSS_SITE_COOKIES || env.nodeEnv === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: CROSS_SITE_COOKIES ? 'none' : 'lax',
    secure: CROSS_SITE_COOKIES || env.nodeEnv === 'production',
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, env.jwt.secret);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// Populates req.user if a valid session cookie is present, but never rejects
// the request — for endpoints that behave differently when logged in but are
// otherwise public (e.g. the live request feed).
function attachUserIfPresent(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    req.user = jwt.verify(token, env.jwt.secret);
  } catch {
    // ignore invalid/expired token on optional-auth routes
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  attachUserIfPresent,
  requireRole,
};
