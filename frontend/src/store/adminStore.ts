import { create } from 'zustand';
import { adminApi } from '../api/adminApi';

interface AdminState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  boot: () => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  token: null,
  username: null,
  isAuthenticated: false,

  login: async (username, password) => {
    const res = await adminApi.login(username, password);
    localStorage.setItem('stp_admin_token', res.token);
    set({ token: res.token, username: res.username, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('stp_admin_token');
    set({ token: null, username: null, isAuthenticated: false });
  },

  boot: () => {
    const token = localStorage.getItem('stp_admin_token');
    if (token) {
      set({ token, isAuthenticated: true });
    }
  },
}));
