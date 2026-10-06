import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type MobileTab = 'report' | 'mine' | 'inbox' | 'alerts';

interface MobileNav {
  tab: MobileTab;
  /** Dirección de la última navegación entre pestañas, para animar la entrada. */
  direction: number;
  /** Incidencia abierta en la hoja de detalle. */
  openIncidentId: string | null;
  /** Token de QR recibido por enlace (?qr=), consumido por el asistente. */
  pendingQr: string | null;
  setTab: (tab: MobileTab) => void;
  openIncident: (id: string | null) => void;
  setPendingQr: (token: string | null) => void;
}

const ORDER: MobileTab[] = ['inbox', 'report', 'mine', 'alerts'];

export const NAV_STORAGE_KEY = 'campus-mobile-nav';

export const useMobileNav = create<MobileNav>()(
  persist(
    (set, get) => ({
      tab: 'report',
      direction: 0,
      openIncidentId: null,
      pendingQr: null,
      setTab: (tab) => set({ tab, direction: Math.sign(ORDER.indexOf(tab) - ORDER.indexOf(get().tab)) }),
      openIncident: (openIncidentId) => set({ openIncidentId }),
      setPendingQr: (pendingQr) => set({ pendingQr }),
    }),
    { name: NAV_STORAGE_KEY, storage: createJSONStorage(() => sessionStorage), partialize: ({ tab }) => ({ tab }) },
  ),
);
