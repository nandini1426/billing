import { create } from 'zustand';
import api from '@/lib/api';

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  init: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const user  = localStorage.getItem('user');
      if (token && user) {
        try {
          set({ token, user: JSON.parse(user) });
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
    }
  },

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/auth/login', { username, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ token, user, loading: false });
      return { success: true, role: user.role };
    } catch (err) {
      set({ loading: false, error: err.error || 'Login failed' });
      return { success: false };
    }
  },

  register: async (username, email, password, phone) => {
    set({ loading: true, error: null });
    try {
      await api.post('/auth/register', { username, email, password, phone });
      set({ loading: false });
      return { success: true };
    } catch (err) {
      set({ loading: false, error: err.error || 'Registration failed' });
      return { success: false };
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    set({ user: null, token: null, error: null });
    window.location.href = '/login';
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;