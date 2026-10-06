import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserDTO } from '@campus/shared';

interface AuthState {
  token: string | null;
  user: UserDTO | null;
  setSession: (token: string, user: UserDTO) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'campus-auth' },
  ),
);

export const getToken = () => useAuth.getState().token;
