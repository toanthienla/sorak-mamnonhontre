import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useYearStore = create(
  persist(
    (set) => ({
      selectedYearId: null,
      setSelectedYearId: (id) => set({ selectedYearId: id }),
    }),
    {
      name: 'sorak-year',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
