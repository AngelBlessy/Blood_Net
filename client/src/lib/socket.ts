import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Lazy singleton — same-origin by default (Vite proxies /socket.io to the API
// server in dev, same server serves both in prod), authenticated via the
// existing httpOnly session cookie. Doesn't connect until explicitly told to
// (see session-store.ts), since connecting before login would just fail.
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ withCredentials: true, autoConnect: false });
  }
  return socket;
}
