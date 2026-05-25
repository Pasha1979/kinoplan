import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface UiStore {
  theme: Theme
  sidebarExpanded: boolean
  toggleTheme: () => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  theme: 'dark',
  sidebarExpanded: true,

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

  toggleSidebar: () =>
    set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
}))
