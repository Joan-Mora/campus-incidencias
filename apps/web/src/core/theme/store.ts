import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'dark' | 'light' | 'system';
export type SceneMode = 'auto' | '3d' | 'iso';

interface UiState {
  theme: ThemePreference;
  sceneMode: SceneMode;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  setSceneMode: (mode: SceneMode) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      sceneMode: 'auto',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: resolveTheme(get().theme) === 'dark' ? 'light' : 'dark' }),
      setSceneMode: (sceneMode) => set({ sceneMode }),
    }),
    { name: 'campus-ui' },
  ),
);

export function resolveTheme(theme: ThemePreference): 'dark' | 'light' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useResolvedTheme() {
  return resolveTheme(useUi((state) => state.theme));
}

/** Sincroniza el atributo data-theme del documento con la preferencia guardada. */
export function useThemeSync() {
  const theme = useUi((state) => state.theme);
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme);
    };
    apply();
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
