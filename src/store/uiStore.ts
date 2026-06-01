import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface UiStore {
  theme: Theme
  sidebarExpanded: boolean
  toggleTheme: () => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarExpanded: true,

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      toggleSidebar: () =>
        set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
    }),
    { name: 'kinoplan-ui' }
  )
)
