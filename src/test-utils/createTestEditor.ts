// createTestEditor — headless Tiptap-редактор для unit-тестов (jsdom).
// Все script-ноды и расширения как в useScriptEditorLogic, без React/UI-слоёв.
// Переиспользуется в A3 (useScriptEditorLogic), A4 (sceneActions), C (e2e-помощники).
// Использование: `// @vitest-environment jsdom` в начале тест-файла.
import { Editor, type EditorOptions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type Transaction, type EditorState } from 'prosemirror-state'
import {
  SceneHeader, SceneCast, SceneAction, SceneCharacter,
  SceneDialog, SceneTransition, SceneParenthetical,
} from '../components/tiptap'
import { DialogueHighlightExtension } from '../components/tiptap/DialogueHighlightExtension'
import { PovFilterExtension } from '../components/tiptap/PovFilterExtension'
import { PageBreaksExtension } from '../components/tiptap/PageBreaksExtension'
import { createSearchPlugin } from '../hooks/useScriptSearch'

// Тот же sceneIdAssign-плагин, что в useScriptEditorLogic:
// стабильный sceneId каждой шапке — при загрузке, вставке и создании сцен
const SceneIdAssign = Extension.create({
  name: 'sceneIdAssign',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('sceneIdAssign'),
      appendTransaction: (transactions: readonly Transaction[], _oldState: EditorState, newState: EditorState) => {
        if (!transactions.some((t) => t.docChanged)) return null
        const tr = newState.tr
        let touched = false
        newState.doc.descendants((node, pos) => {
          if (node.type.name === 'sceneHeader' && !node.attrs.sceneId) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, sceneId: crypto.randomUUID() })
            touched = true
          }
        })
        if (!touched) return null
        tr.setMeta('addToHistory', false)
        return tr
      },
    })]
  },
})

const ScriptSearch = Extension.create({
  name: 'scriptSearchPlugin',
  addProseMirrorPlugins() {
    return [createSearchPlugin()]
  },
})

export interface TestEditorOptions {
  content?: EditorOptions['content']
  /** Дополнительные расширения поверх базового набора */
  extraExtensions?: EditorOptions['extensions']
  editorProps?: EditorOptions['editorProps']
}

/** Полный набор расширений редактора сценария (как в проде, без UI-плагинов) */
export const scriptExtensions = [
  ScriptSearch,
  SceneIdAssign,
  PageBreaksExtension,
  StarterKit.configure({
    orderedList: false,
    bulletList: false,
    listItem: false,
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
    hardBreak: {},
  }),
  SceneHeader,
  SceneCast,
  SceneAction,
  SceneCharacter,
  SceneDialog,
  SceneParenthetical,
  SceneTransition,
  DialogueHighlightExtension,
  PovFilterExtension,
]

export function createTestEditor(opts: TestEditorOptions = {}): Editor {
  return new Editor({
    element: document.createElement('div'),
    enableInputRules: false,
    enablePasteRules: false,
    extensions: [...scriptExtensions, ...(opts.extraExtensions ?? [])],
    content: opts.content ?? '<p></p>',
    editorProps: opts.editorProps ?? {},
  })
}
