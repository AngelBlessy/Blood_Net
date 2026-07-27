const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { env } = require('../config/env');
const { COOKIE_NAME } = require('../middleware/auth');
const HospitalProfile = require('../models/hospital-profile.model');

let io = null;

function roomForHospital(hospitalId) {
  return `hospital:${hospitalId}`;
}

function roomForUser(userId) {
  return `user:${userId}`;
}

// The room a given request's live updates broadcast to: the raising
// hospital's room if it has one, else the raising user's room (covers
// donor/bloodbank-raised requests). Guest-raised requests have neither, so
// nobody is subscribed — that's fine, guests aren't logged in to listen.
function roomForRequest(request) {
  if (request.hospitalId) return roomForHospital(request.hospitalId.toString());
  if (request.raisedByUserId) return roomForUser(request.raisedByUserId.toString());
  return null;
}

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie;
      const token = raw ? cookie.parse(raw)[COOKIE_NAME] : null;
      if (!token) return next(new Error('unauthenticated'));

      const payload = jwt.verify(token, env.jwt.secret);
      socket.user = payload;
      next();
    } catch {
      next(new Error('unauthenticated'));
    }
  });

  io.on('connection', async (socket) => {
    socket.join(roomForUser(socket.user.id));

    if (socket.user.role === 'hospital') {
      const hospital = await HospitalProfile.findOne({ userId: socket.user.id });
      if (hospital) socket.join(roomForHospital(hospital._id.toString()));
    }
  });

  return io;
}

// Safe to call even if a request has no listener (guest-raised) — it just
// emits to an empty room, a no-op. Also safe to call before initSocket runs.
function emitToRequest(request, event, payload) {
  if (!io) return;
  const room = roomForRequest(request);
  if (!room) return;
  io.to(room).emit(event, payload);
}

// Push directly to one user's own connection(s), regardless of role —
// used for personal notifications (new alert, someone responded, etc).
function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(roomForUser(userId.toString())).emit(event, payload);
}

module.exports = { initSocket, emitToRequest, emitToUser };
