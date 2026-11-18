import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { pouchStorage } from '../services/storageService'

type Theme = 'dark' | 'light'

export type EnterPreset = 'kinoplan' | 'kit' | 'fd'
/** T-138: клавиша принятия подсказки SmartType */
export type SmartTypeAcceptKey = 'enter' | 'tab'

interface UiStore {
  theme: Theme
  sidebarExpanded: boolean
  a4Mode: boolean
  /** Пресет клавиатуры: kinoplan — двойной Enter → действие, сцена по Ctrl+Shift+S;
   *  kit — двойной Enter → новая сцена (как в KIT); fd — как Final Draft (Enter → действие) */
  enterPreset: EnterPreset
  /** T-72: авто-типографика при наборе (--→—, "→«», (з/к)→(З/К)) */
  autoTypography: boolean
  /** T-105: typewriter-режим — курсор держится на вертикальной середине экрана */
  typewriterMode: boolean
  /** T-138: чем принимать подсказку SmartType — Enter (дефолт) или Tab */
  smartTypeAcceptKey: SmartTypeAcceptKey
  /** T-171: автозакрытие скобок/кавычек при наборе */
  autoCloseBrackets: boolean
  /** T-143: пользовательские шаблоны сцен (встроенные — в sceneTemplates.ts) */
  customSceneTemplates: { name: string; html: string }[]
  /** D4: группировка сцен навигатора по актам (сворачиваемые) */
  navigatorActGrouping: boolean
  /** T-136: режим «Каркас сцен» — документ свёрнут до шапок */
  outlineMode: boolean
  /** показывать синопсис в каркасе */
  outlineSynopsis: boolean
  toggleTheme: () => void
  toggleSidebar: () => void
  toggleA4Mode: () => void
  setEnterPreset: (p: EnterPreset) => void
  toggleAutoTypography: () => void
  toggleTypewriterMode: () => void
  setSmartTypeAcceptKey: (k: SmartTypeAcceptKey) => void
  toggleAutoCloseBrackets: () => void
  addCustomSceneTemplate: (t: { name: string; html: string }) => void
  removeCustomSceneTemplate: (name: string) => void
  toggleNavigatorActGrouping: () => void
  toggleOutlineMode: () => void
  setOutlineMode: (v: boolean) => void
  toggleOutlineSynopsis: () => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarExpanded: true,
      a4Mode: true,
      enterPreset: 'kinoplan',
      autoTypography: true,
      typewriterMode: false,
      smartTypeAcceptKey: 'enter',
      autoCloseBrackets: true,
      customSceneTemplates: [],
      navigatorActGrouping: true,
      outlineMode: false,
      outlineSynopsis: true,

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

      toggleTypewriterMode: () =>
        set((state) => ({ typewriterMode: !state.typewriterMode })),

      setSmartTypeAcceptKey: (k) =>
        set({ smartTypeAcceptKey: k }),

      toggleAutoCloseBrackets: () =>
        set((state) => ({ autoCloseBrackets: !state.autoCloseBrackets })),

      addCustomSceneTemplate: (t) =>
        set((state) => ({ customSceneTemplates: [...state.customSceneTemplates.filter((x) => x.name !== t.name), t] })),

      removeCustomSceneTemplate: (name) =>
        set((state) => ({ customSceneTemplates: state.customSceneTemplates.filter((x) => x.name !== name) })),

      toggleNavigatorActGrouping: () =>
        set((state) => ({ navigatorActGrouping: !state.navigatorActGrouping })),

      toggleOutlineMode: () =>
        set((state) => ({ outlineMode: !state.outlineMode })),

      setOutlineMode: (v) => set({ outlineMode: v }),

      toggleOutlineSynopsis: () =>
        set((state) => ({ outlineSynopsis: !state.outlineSynopsis })),
    }),
    { name: 'kinoplan-ui', storage: createJSONStorage(() => pouchStorage) }
  )
)
