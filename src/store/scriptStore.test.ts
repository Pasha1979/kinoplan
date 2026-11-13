// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { useScriptStore, type Script, type Scene, type Character } from './scriptStore'

function makeScript(overrides: Partial<Script> = {}): Script {
  return {
    id: 'script-1',
    projectId: 'proj-1',
    title: 'Тестовый сценарий',
    version: 'Черновик v1',
    format: 'russian',
    scenes: [],
    characters: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    timingSystem: 'page',
    genreCoefficient: 1.0,
    fontFamily: 'Courier New',
    fontSize: 12,
    autoExtractCharacters: true,
    ...overrides,
  }
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    number: '1',
    type: 'ИНТ',
    location: 'КВАРТИРА',
    sublocation: '',
    time: 'ДЕНЬ',
    cast: ['ИВАН'],
    pages: 1,
    charCount: 0,
    ...overrides,
  }
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    projectId: 'proj-1',
    name: 'ИВАН',
    sceneCount: 1,
    ...overrides,
  }
}

beforeEach(() => {
  useScriptStore.setState({
    scripts: [],
    currentScriptId: null,
    drafts: [],
    notes: [],
    formatLocked: false,
    showPlaceholders: true,
  })
})

describe('ScriptStore — Script CRUD', () => {
  it('addScript: добавляет скрипт в массив', () => {
    const script = makeScript()
    useScriptStore.getState().addScript(script)
    expect(useScriptStore.getState().scripts).toHaveLength(1)
    expect(useScriptStore.getState().scripts[0].id).toBe('script-1')
  })

  it('addScript: добавляет несколько скриптов', () => {
    useScriptStore.getState().addScript(makeScript({ id: 's1' }))
    useScriptStore.getState().addScript(makeScript({ id: 's2' }))
    useScriptStore.getState().addScript(makeScript({ id: 's3' }))
    expect(useScriptStore.getState().scripts).toHaveLength(3)
  })

  it('updateScript: обновляет поля скрипта', () => {
    useScriptStore.getState().addScript(makeScript())
    useScriptStore.getState().updateScript('script-1', { title: 'Новое название' })
    expect(useScriptStore.getState().scripts[0].title).toBe('Новое название')
  })

  it('updateScript: обновляет updatedAt', () => {
    useScriptStore.getState().addScript(makeScript({ updatedAt: '2025-01-01T00:00:00.000Z' }))
    useScriptStore.getState().updateScript('script-1', { title: 'Новое' })
    expect(useScriptStore.getState().scripts[0].updatedAt).not.toBe('2025-01-01T00:00:00.000Z')
  })

  it('updateScript: не трогает другие скрипты', () => {
    useScriptStore.getState().addScript(makeScript({ id: 's1', title: 'Оригинал 1' }))
    useScriptStore.getState().addScript(makeScript({ id: 's2', title: 'Оригинал 2' }))
    useScriptStore.getState().updateScript('s1', { title: 'Изменён' })
    expect(useScriptStore.getState().scripts[1].title).toBe('Оригинал 2')
  })

  it('deleteScript: удаляет скрипт', () => {
    useScriptStore.getState().addScript(makeScript({ id: 's1' }))
    useScriptStore.getState().addScript(makeScript({ id: 's2' }))
    useScriptStore.getState().deleteScript('s1')
    expect(useScriptStore.getState().scripts).toHaveLength(1)
    expect(useScriptStore.getState().scripts[0].id).toBe('s2')
  })

  it('deleteScript: сбрасывает currentScriptId если удаляемый был активным', () => {
    useScriptStore.getState().addScript(makeScript({ id: 's1' }))
    useScriptStore.getState().setCurrentScript('s1')
    useScriptStore.getState().deleteScript('s1')
    expect(useScriptStore.getState().currentScriptId).toBeNull()
  })

  it('deleteScript: не сбрасывает currentScriptId если удаляемый не был активным', () => {
    useScriptStore.getState().addScript(makeScript({ id: 's1' }))
    useScriptStore.getState().addScript(makeScript({ id: 's2' }))
    useScriptStore.getState().setCurrentScript('s1')
    useScriptStore.getState().deleteScript('s2')
    expect(useScriptStore.getState().currentScriptId).toBe('s1')
  })

  it('setCurrentScript / getCurrentScript', () => {
    useScriptStore.getState().addScript(makeScript({ id: 's1' }))
    useScriptStore.getState().setCurrentScript('s1')
    const current = useScriptStore.getState().getCurrentScript()
    expect(current?.id).toBe('s1')
  })

  it('getCurrentScript: возвращает null если нет активного', () => {
    expect(useScriptStore.getState().getCurrentScript()).toBeNull()
  })
})

describe('ScriptStore — Scene CRUD', () => {
  beforeEach(() => {
    useScriptStore.getState().addScript(makeScript())
  })

  it('addScene: добавляет сцену в скрипт', () => {
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-1' }))
    expect(useScriptStore.getState().scripts[0].scenes).toHaveLength(1)
  })

  it('addScene: добавляет в правильный скрипт', () => {
    useScriptStore.getState().addScript(makeScript({ id: 's2' }))
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-1' }))
    expect(useScriptStore.getState().scripts[0].scenes).toHaveLength(1)
    expect(useScriptStore.getState().scripts[1].scenes).toHaveLength(0)
  })

  it('updateScene: обновляет поля сцены', () => {
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-1', location: 'КВАРТИРА' }))
    useScriptStore.getState().updateScene('script-1', 'sc-1', { location: 'УЛИЦА' })
    expect(useScriptStore.getState().scripts[0].scenes[0].location).toBe('УЛИЦА')
  })

  it('updateScene: не трогает другие сцены', () => {
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-1', location: 'A' }))
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-2', location: 'B' }))
    useScriptStore.getState().updateScene('script-1', 'sc-1', { location: 'C' })
    expect(useScriptStore.getState().scripts[0].scenes[1].location).toBe('B')
  })

  it('deleteScene: удаляет сцену', () => {
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-1' }))
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-2' }))
    useScriptStore.getState().deleteScene('script-1', 'sc-1')
    expect(useScriptStore.getState().scripts[0].scenes).toHaveLength(1)
    expect(useScriptStore.getState().scripts[0].scenes[0].id).toBe('sc-2')
  })

  it('reorderScenes: меняет порядок сцен', () => {
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-1', number: '1' }))
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-2', number: '2' }))
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-3', number: '3' }))

    useScriptStore.getState().reorderScenes('script-1', ['sc-3', 'sc-1', 'sc-2'])

    const scenes = useScriptStore.getState().scripts[0].scenes
    expect(scenes[0].id).toBe('sc-3')
    expect(scenes[1].id).toBe('sc-1')
    expect(scenes[2].id).toBe('sc-2')
  })

  it('reorderScenes: обновляет order у всех сцен', () => {
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-1' }))
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-2' }))

    useScriptStore.getState().reorderScenes('script-1', ['sc-2', 'sc-1'])

    const scenes = useScriptStore.getState().scripts[0].scenes
    expect(scenes[0].order).toBe(0)
    expect(scenes[1].order).toBe(1)
  })

  it('reorderScenes: игнорирует несуществующие ID', () => {
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-1' }))
    useScriptStore.getState().addScene('script-1', makeScene({ id: 'sc-2' }))

    useScriptStore.getState().reorderScenes('script-1', ['sc-2', 'nonexistent', 'sc-1'])

    const scenes = useScriptStore.getState().scripts[0].scenes
    expect(scenes).toHaveLength(2)
    expect(scenes[0].id).toBe('sc-2')
    expect(scenes[1].id).toBe('sc-1')
  })
})

describe('ScriptStore — Character CRUD', () => {
  beforeEach(() => {
    useScriptStore.getState().addScript(makeScript())
  })

  it('addCharacter: добавляет персонажа', () => {
    useScriptStore.getState().addCharacter('script-1', makeCharacter())
    expect(useScriptStore.getState().scripts[0].characters).toHaveLength(1)
  })

  it('updateCharacter: обновляет персонажа', () => {
    useScriptStore.getState().addCharacter('script-1', makeCharacter({ id: 'c1', name: 'ИВАН' }))
    useScriptStore.getState().updateCharacter('script-1', 'c1', { name: 'ПЁТР' })
    expect(useScriptStore.getState().scripts[0].characters[0].name).toBe('ПЁТР')
  })

  it('deleteCharacter: удаляет персонажа', () => {
    useScriptStore.getState().addCharacter('script-1', makeCharacter({ id: 'c1' }))
    useScriptStore.getState().addCharacter('script-1', makeCharacter({ id: 'c2' }))
    useScriptStore.getState().deleteCharacter('script-1', 'c1')
    expect(useScriptStore.getState().scripts[0].characters).toHaveLength(1)
    expect(useScriptStore.getState().scripts[0].characters[0].id).toBe('c2')
  })
})

describe('ScriptStore — formatLocked & showPlaceholders', () => {
  it('toggleFormatLock: переключает замок', () => {
    expect(useScriptStore.getState().formatLocked).toBe(false)
    useScriptStore.getState().toggleFormatLock()
    expect(useScriptStore.getState().formatLocked).toBe(true)
    useScriptStore.getState().toggleFormatLock()
    expect(useScriptStore.getState().formatLocked).toBe(false)
  })

  it('setFormatLocked: устанавливает замок напрямую', () => {
    useScriptStore.getState().setFormatLocked(true)
    expect(useScriptStore.getState().formatLocked).toBe(true)
  })

  it('toggleShowPlaceholders: переключает плейсхолдеры', () => {
    expect(useScriptStore.getState().showPlaceholders).toBe(true)
    useScriptStore.getState().toggleShowPlaceholders()
    expect(useScriptStore.getState().showPlaceholders).toBe(false)
  })
})

describe('ScriptStore — Notes & Drafts', () => {
  it('addNote / updateNote / deleteNote', () => {
    const note = {
      id: 'n1',
      sceneId: 'sc-1',
      lineNumber: 5,
      text: 'Проверить диалог',
      author: 'Режиссёр',
      createdAt: '2025-01-01T00:00:00.000Z',
    }
    useScriptStore.getState().addNote(note)
    expect(useScriptStore.getState().notes).toHaveLength(1)

    useScriptStore.getState().updateNote('n1', { text: 'Исправить диалог' })
    expect(useScriptStore.getState().notes[0].text).toBe('Исправить диалог')

    useScriptStore.getState().deleteNote('n1')
    expect(useScriptStore.getState().notes).toHaveLength(0)
  })

  it('addDraft / setActiveDraft / deleteDraft', () => {
    useScriptStore.getState().addDraft({ id: 'd1', scriptId: 's1', version: 'v1', changeLog: [], createdAt: '2025-01-01', isActive: false })
    useScriptStore.getState().addDraft({ id: 'd2', scriptId: 's1', version: 'v2', changeLog: [], createdAt: '2025-01-02', isActive: false })

    useScriptStore.getState().setActiveDraft('d2')
    expect(useScriptStore.getState().drafts.find(d => d.id === 'd2')?.isActive).toBe(true)
    expect(useScriptStore.getState().drafts.find(d => d.id === 'd1')?.isActive).toBe(false)

    useScriptStore.getState().deleteDraft('d1')
    expect(useScriptStore.getState().drafts).toHaveLength(1)
  })
})

// T-35: контент сценария — отдельный документ script-content:{id},
// общий persist-документ остаётся лёгким
describe('T-35 per-script content docs', () => {
  it('updateScript content → уходит в script-content:{id}, а не в kinoplan-scripts', async () => {
    const { flushWrites } = await import('../services/storageService')
    const html = '<div data-type="scene">BIG CONTENT '.repeat(50) + '</div>'
    useScriptStore.getState().addScript(makeScript({ id: 's-t35', content: '<p></p>' }))
    useScriptStore.getState().updateScript('s-t35', { content: html })
    await flushWrites('script-content:s-t35')
    await flushWrites('kinoplan-scripts')

    const { pouchStorage } = await import('../services/storageService')
    const contentDoc = await pouchStorage.getItem('script-content:s-t35')
    expect(contentDoc).not.toBeNull()
    expect(JSON.parse(contentDoc!).html).toBe(html)

    const storeDoc = await pouchStorage.getItem('kinoplan-scripts')
    expect(storeDoc).not.toBeNull()
    const persisted = JSON.parse(storeDoc!) as { state: { scripts: Array<{ id: string; content?: string }> } }
    const persistedScript = persisted.state.scripts.find((s) => s.id === 's-t35')
    expect(persistedScript).toBeTruthy()
    expect(persistedScript!.content).toBeUndefined()
    // общий документ не раздувается контентом
    expect(storeDoc!.length).toBeLessThan(html.length)
  })

  it('ensureContentLoaded подгружает контент из отдельного документа', async () => {
    const { flushWrites, saveScriptContent, pouchStorage } = await import('../services/storageService')
    useScriptStore.getState().addScript(makeScript({ id: 's-lazy' }))
    // имитируем гидрацию без контента
    useScriptStore.setState((state) => ({
      scripts: state.scripts.map((s) => {
        const { content: _c, ...rest } = s as Script & { content?: string }
        return rest as Script
      }),
    }))
    expect(useScriptStore.getState().scripts.find((s) => s.id === 's-lazy')?.content).toBeUndefined()

    saveScriptContent('s-lazy', '<p>lazy html</p>')
    await flushWrites('script-content:s-lazy')
    expect(await pouchStorage.getItem('script-content:s-lazy')).not.toBeNull()

    await useScriptStore.getState().ensureContentLoaded('s-lazy')
    expect(useScriptStore.getState().scripts.find((s) => s.id === 's-lazy')?.content).toBe('<p>lazy html</p>')
  })

  it('deleteScript удаляет контентный документ', async () => {
    const { flushWrites, pouchStorage } = await import('../services/storageService')
    useScriptStore.getState().addScript(makeScript({ id: 's-del', content: '<p>x</p>' }))
    await flushWrites('script-content:s-del')
    expect(await pouchStorage.getItem('script-content:s-del')).not.toBeNull()

    useScriptStore.getState().deleteScript('s-del')
    await flushWrites('script-content:s-del')
    expect(await pouchStorage.getItem('script-content:s-del')).toBeNull()
  })
})
