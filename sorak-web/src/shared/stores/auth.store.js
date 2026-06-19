import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      setAuth: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'sorak-auth',
      storage: createJSONStorage(() => localStorage), // persist across tabs + browser restart
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
