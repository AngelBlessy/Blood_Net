import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socket: Socket | null = null;

// Lazy singleton — same-origin by default (Vite proxies /socket.io to the API
// server in dev; API_BASE_URL points at the Fly.io app when the client is
// deployed separately, e.g. on Vercel), authenticated via the existing
// httpOnly session cookie. Doesn't connect until explicitly told to (see
// session-store.ts), since connecting before login would just fail.
export function getSocket(): Socket {
  if (!socket) {
    // socket.io-client treats '' as a real (broken) URI rather than "same
    // origin" — only omitting the arg gets that default — so fall back to
    // undefined explicitly when API_BASE_URL is unset.
    socket = io(API_BASE_URL || undefined, { withCredentials: true, autoConnect: false });
  }
  return socket;
}
