import { create } from 'zustand';
import type { Session, User } from '@/types/domain';

interface SessionState {
  session: Session | null;
  hydrated: boolean;
  setUser: (user: User | null) => void;
  setHydrated: () => void;
}

// Session truth now lives server-side (httpOnly JWT cookie); this store is
// just a client-side cache hydrated from GET /api/auth/me on app load, not a
// persisted source of truth like it was with localStorage.
export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  hydrated: false,
  setUser: (user) => set({ session: user ? { user } : null }),
  setHydrated: () => set({ hydrated: true }),
}));
