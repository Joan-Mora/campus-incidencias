import { create } from 'zustand';

export type TwinMode = 'beacons' | 'heat';

interface TwinState {
  campusId: string | null;
  mode: TwinMode;
  selectedId: string | null;
  focusBlockId: string | null;
  /** Instante reproducido (ms) o null para ver el campus en vivo. */
  replayAt: number | null;
  playing: boolean;
  /** Horas simuladas por segundo real durante la reproducción. */
  speed: number;
  setCampus: (id: string) => void;
  setMode: (mode: TwinMode) => void;
  select: (id: string | null) => void;
  focusBlock: (id: string | null) => void;
  setReplayAt: (at: number | null) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
}

export const useTwin = create<TwinState>()((set) => ({
  campusId: null,
  mode: 'beacons',
  selectedId: null,
  focusBlockId: null,
  replayAt: null,
  playing: false,
  speed: 6,
  setCampus: (campusId) => set({ campusId, focusBlockId: null, selectedId: null }),
  setMode: (mode) => set({ mode }),
  select: (selectedId) => set({ selectedId }),
  focusBlock: (focusBlockId) => set({ focusBlockId }),
  setReplayAt: (replayAt) => set(replayAt === null ? { replayAt, playing: false } : { replayAt }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
}));
