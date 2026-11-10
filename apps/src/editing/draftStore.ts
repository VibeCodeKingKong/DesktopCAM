import { create } from 'zustand';

/** Läge för pågående ritning – visas i ritfältet ovanför 3D-vyn. */
interface DraftState {
  points: number;
  setPoints: (n: number) => void;
}

export const useDraft = create<DraftState>()((set) => ({
  points: 0,
  setPoints: (points) => set({ points }),
}));
