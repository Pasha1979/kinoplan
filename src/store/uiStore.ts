import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface UiStore {
  theme: Theme
  sidebarExpanded: boolean
  a4Mode: boolean
  toggleTheme: () => void
  toggleSidebar: () => void
  toggleA4Mode: () => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarExpanded: true,
      a4Mode: true,

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      toggleSidebar: () =>
        set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

      toggleA4Mode: () =>
        set((state) => ({ a4Mode: !state.a4Mode })),
    }),
    { name: 'kinoplan-ui' }
  )
)
