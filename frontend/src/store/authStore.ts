import { create } from 'zustand';
import { authApi, type AuthUser } from '../api/authApi';
import { setAuthExpiredHandler } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  booting: boolean;
  booted: boolean;

  boot: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  continueAsGuest: () => void;
  clearGuest: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // When the API client can't refresh an expired session, drop auth state.
  // The App component wires this to a redirect to /login.
  setAuthExpiredHandler(() => set({ user: null, isAuthenticated: false, isGuest: false }));

  return {
    user: null,
    isAuthenticated: false,
    isGuest: false,
    booting: false,
    booted: false,

    boot: async () => {
      if (get().booted || get().booting) return;
      set({ booting: true });
      try {
        const user = await authApi.me();
        set({ user, isAuthenticated: true, isGuest: false });
      } catch {
        set({ user: null, isAuthenticated: false });
      } finally {
        set({ booting: false, booted: true });
      }
    },

    login: async (email, password) => {
      const user = await authApi.login(email, password);
      set({ user, isAuthenticated: true, isGuest: false });
    },

    register: async (username, email, password) => {
      const user = await authApi.register(username, email, password);
      set({ user, isAuthenticated: true, isGuest: false });
    },

    googleLogin: async (credential) => {
      const user = await authApi.google(credential);
      set({ user, isAuthenticated: true, isGuest: false });
    },

    logout: async () => {
      try {
        await authApi.logout();
      } catch {
        /* ignore — clear locally regardless */
      }
      // Clear the persistent player id so the next account gets a fresh one.
      try { localStorage.removeItem('stp_player_id'); } catch { /* ignore */ }
      set({ user: null, isAuthenticated: false, isGuest: false });
    },

    continueAsGuest: () => set({ user: null, isAuthenticated: false, isGuest: true }),
    clearGuest: () => set({ isGuest: false }),
  };
});
