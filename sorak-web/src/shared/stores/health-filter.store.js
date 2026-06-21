import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Remembers last-picked filters across navigation + reload
export const useHealthFilterStore = create(
  persist(
    (set) => ({
      healthClassId: '',
      nutritionClassId: '',
      nutritionPeriod: 'dau_nam',
      growthClassId: '',
      growthStudentId: '',
      set: (patch) => set(patch),
    }),
    {
      name: 'sorak-health-filter',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
