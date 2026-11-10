import { create } from 'zustand';

/** Läge för pågående ritning – visas i ritfältet ovanför 3D-vyn. */
interface DraftState {
  points: number;
  setPoints: (n: number) => void;
  /** Tecken som skrevs i vyn medan en linje ritas – flyttas till längdfältet. */
  typed: string;
  type: (char: string) => void;
  /** Hämtar och tömmer de skrivna tecknen. */
  takeTyped: () => string;
  /** Radie för verktyget Radie (mm). */
  filletRadius: number;
  setFilletRadius: (r: number) => void;
}

export const useDraft = create<DraftState>()((set, get) => ({
  points: 0,
  setPoints: (points) => set({ points }),
  typed: '',
  type: (char) => set((s) => ({ typed: s.typed + char })),
  takeTyped: (): string => {
    const v = get().typed;
    if (v) set({ typed: '' });
    return v;
  },
  filletRadius: 5,
  setFilletRadius: (filletRadius) => set({ filletRadius }),
}));
