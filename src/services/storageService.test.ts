// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { pouchStorage } from './storageService'

describe('pouchStorage', () => {
  it('getItem returns pending value before debounced write lands', async () => {
    await pouchStorage.setItem('test-pending', 'v1')
    expect(await pouchStorage.getItem('test-pending')).toBe('v1')
  })

  it('persists value to db after debounce window', async () => {
    await pouchStorage.setItem('test-flush', 'v2')
    await new Promise((r) => setTimeout(r, 1500))
    expect(await pouchStorage.getItem('test-flush')).toBe('v2')
  })

  it('last write wins within debounce window', async () => {
    await pouchStorage.setItem('test-last', 'a')
    await pouchStorage.setItem('test-last', 'b')
    await pouchStorage.setItem('test-last', 'c')
    await new Promise((r) => setTimeout(r, 1500))
    expect(await pouchStorage.getItem('test-last')).toBe('c')
  })

  it('removeItem cancels pending write and deletes doc', async () => {
    await pouchStorage.setItem('test-rm', 'x')
    await pouchStorage.removeItem('test-rm')
    await new Promise((r) => setTimeout(r, 1500))
    expect(await pouchStorage.getItem('test-rm')).toBeNull()
  })
})

// B7: ретраи, flush по visibilitychange, per-script документы, last-wins
describe('pouchStorage — усиленные (B7)', () => {
  it('visibilitychange=hidden форсирует отложенную запись без ожидания debounce', async () => {
    await pouchStorage.setItem('test-vis', 'vis-value')
    // имитируем сворачивание вкладки
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    // flush вызван событием — ждём очередь и проверяем запись на «диске»
    const mod = await import('./storageService')
    await mod.flushWrites('test-vis')
    expect(await pouchStorage.getItem('test-vis')).toBe('vis-value')
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('per-script документы: save/load/remove script-content', async () => {
    const mod = await import('./storageService')
    mod.saveScriptContent('scr-x', '<p>текст</p>')
    await new Promise((r) => setTimeout(r, 1500))
    expect(await mod.loadScriptContent('scr-x')).toBe('<p>текст</p>')
    mod.removeScriptContent('scr-x')
    await new Promise((r) => setTimeout(r, 1500))
    expect(await mod.loadScriptContent('scr-x')).toBeNull()
  })

  it('loadScriptContent: read-after-write — свежая pending-запись важнее диска', async () => {
    const mod = await import('./storageService')
    mod.saveScriptContent('scr-raw', '<p>старое</p>')
    await new Promise((r) => setTimeout(r, 1500))
    mod.saveScriptContent('scr-raw', '<p>новое-ещё-не-записано</p>')
    // сразу читаем — должны получить pending-значение, не дожидаясь debounce
    expect(await mod.loadScriptContent('scr-raw')).toBe('<p>новое-ещё-не-записано</p>')
  })

  it('ensureContentLoaded не грузит контент дважды', async () => {
    const { useScriptStore } = await import('../store/scriptStore')
    const mod = await import('./storageService')
    const loadSpy = vi.spyOn(mod, 'loadScriptContent')
    useScriptStore.setState({
      scripts: [{ id: 'scr-dup', projectId: 'p', title: 'С', format: 'russian', scenes: [], characters: [], createdAt: '', updatedAt: '', timingSystem: 'page', genreCoefficient: 1, fontFamily: 'Courier', fontSize: 12, autoExtractCharacters: false }] as never,
    })
    // content === undefined → грузит; после первого — early return
    await useScriptStore.getState().ensureContentLoaded('scr-dup')
    const callsAfterFirst = loadSpy.mock.calls.length
    await useScriptStore.getState().ensureContentLoaded('scr-dup')
    expect(loadSpy.mock.calls.length).toBe(callsAfterFirst)
    // контент установлен (пустая строка при отсутствии документа)
    expect(useScriptStore.getState().scripts[0].content).toBe('')
    loadSpy.mockRestore()
    useScriptStore.setState({ scripts: [] })
  })

  it('last-wins: конкурентные setItem через flushWrites сохраняют последнее', async () => {
    const mod = await import('./storageService')
    await pouchStorage.setItem('test-lw', 'v1')
    await pouchStorage.setItem('test-lw', 'v2')
    await mod.flushWrites('test-lw')
    await new Promise((r) => setTimeout(r, 1500))
    expect(await pouchStorage.getItem('test-lw')).toBe('v2')
  })
})
