import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SUGGESTED_RISK, type Category, type Point3, type RiskLevel, type SpaceRefDTO } from '@campus/shared';

export const REPORT_STEPS = ['where', 'spot', 'what', 'detail', 'confirm'] as const;
export type ReportStep = (typeof REPORT_STEPS)[number];

export const STEP_TITLES: Record<ReportStep, string> = {
  where: 'Dónde',
  spot: 'Punto exacto',
  what: 'Qué pasa',
  detail: 'Detalle',
  confirm: 'Confirmar',
};

interface Draft {
  step: number;
  direction: number;
  space: SpaceRefDTO | null;
  hotspot: Point3 | null;
  category: Category | null;
  riskLevel: RiskLevel;
  /** Si la persona eligió el riesgo a mano, ya no se reemplaza con el sugerido. */
  riskTouched: boolean;
  description: string;
  photo: File | null;
  join: { id: string; code: string } | null;
  goTo: (step: number) => void;
  next: () => void;
  back: () => void;
  setSpace: (space: SpaceRefDTO) => void;
  setHotspot: (point: Point3 | null) => void;
  setCategory: (category: Category) => void;
  setRisk: (risk: RiskLevel) => void;
  setDescription: (text: string) => void;
  setPhoto: (photo: File | null) => void;
  setJoin: (join: { id: string; code: string } | null) => void;
  reset: () => void;
}

const initial = {
  step: 0,
  direction: 0,
  space: null,
  hotspot: null,
  category: null,
  riskLevel: 'LOW' as RiskLevel,
  riskTouched: false,
  description: '',
  photo: null,
  join: null,
};

// El borrador sobrevive a una recarga accidental; la foto no, porque un File no se serializa.
export const useDraft = create<Draft>()(
  persist(
    (set, get) => ({
  ...initial,
  goTo: (step) => set({ step, direction: Math.sign(step - get().step) }),
  next: () => set({ step: Math.min(REPORT_STEPS.length - 1, get().step + 1), direction: 1 }),
  back: () => set({ step: Math.max(0, get().step - 1), direction: -1 }),
  setSpace: (space) => set((state) => ({ space, hotspot: state.space?.id === space.id ? state.hotspot : null, join: null })),
  setHotspot: (hotspot) => set({ hotspot }),
  setCategory: (category) => set((state) => ({ category, riskLevel: state.riskTouched ? state.riskLevel : SUGGESTED_RISK[category] })),
  setRisk: (riskLevel) => set({ riskLevel, riskTouched: true }),
  setDescription: (description) => set({ description }),
  setPhoto: (photo) => set({ photo }),
  setJoin: (join) => set({ join }),
  reset: () => set({ ...initial }),
    }),
    {
      name: 'campus-report-draft',
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ step, space, hotspot, category, riskLevel, riskTouched, description, join }) => ({
        step,
        space,
        hotspot,
        category,
        riskLevel,
        riskTouched,
        description,
        join,
      }),
    },
  ),
);
