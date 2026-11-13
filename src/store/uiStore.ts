import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { pouchStorage } from '../services/storageService'

type Theme = 'dark' | 'light'

export type EnterPreset = 'kinoplan' | 'kit' | 'fd'

interface UiStore {
  theme: Theme
  sidebarExpanded: boolean
  a4Mode: boolean
  /** Пресет клавиатуры: kinoplan — двойной Enter → действие, сцена по Ctrl+Shift+S;
   *  kit — двойной Enter → новая сцена (как в KIT); fd — как Final Draft (Enter → действие) */
  enterPreset: EnterPreset
  /** T-72: авто-типографика при наборе (--→—, "→«», (з/к)→(З/К)) */
  autoTypography: boolean
  toggleTheme: () => void
  toggleSidebar: () => void
  toggleA4Mode: () => void
  setEnterPreset: (p: EnterPreset) => void
  toggleAutoTypography: () => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarExpanded: true,
      a4Mode: true,
      enterPreset: 'kinoplan',
      autoTypography: true,

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      toggleSidebar: () =>
        set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

      toggleA4Mode: () =>
        set((state) => ({ a4Mode: !state.a4Mode })),

      setEnterPreset: (p) =>
        set({ enterPreset: p }),

      toggleAutoTypography: () =>
        set((state) => ({ autoTypography: !state.autoTypography })),
    }),
    { name: 'kinoplan-ui', storage: createJSONStorage(() => pouchStorage) }
  )
)
