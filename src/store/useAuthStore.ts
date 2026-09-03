import { create } from 'zustand';
import { authStorage } from '@/lib/authStorage';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: authStorage.getItem('token'),
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) authStorage.setItem('token', token);
    else authStorage.removeItem('token');
    set({ token });
  },
  logout: () => {
    authStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
