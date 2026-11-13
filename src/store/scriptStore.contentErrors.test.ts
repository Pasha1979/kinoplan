// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/storageService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/storageService')>()
  return {
    ...mod,
    loadScriptContent: vi.fn(),
  }
})

import { useScriptStore } from './scriptStore'
import { loadScriptContent } from '../services/storageService'

const mkScript = (id: string) => ({
  id, projectId: 'p1', title: 'Тест',
  scenes: [], format: 'russian',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}) as never

describe('ensureContentLoaded — error-state (T-97)', () => {
  beforeEach(() => {
    useScriptStore.setState({ scripts: [mkScript('s-err'), mkScript('s-ok')], contentErrors: {} })
    vi.mocked(loadScriptContent).mockReset()
  })

  it('сбой чтения БД → contentErrors, контент НЕ подменяется пустым', async () => {
    vi.mocked(loadScriptContent).mockRejectedValue(new Error('DB corrupted'))
    await useScriptStore.getState().ensureContentLoaded('s-err')

    const st = useScriptStore.getState()
    expect(st.contentErrors['s-err']).toBe('DB corrupted')
    expect(st.scripts.find((s) => s.id === 's-err')!.content).toBeUndefined()
  })

  it('успех → контент загружен, ошибка сброшена', async () => {
    useScriptStore.setState({ contentErrors: { 's-ok': 'старая' } })
    vi.mocked(loadScriptContent).mockResolvedValue('<div data-type="scene-header">1. ИНТ. X — ДЕНЬ.</div>')
    await useScriptStore.getState().ensureContentLoaded('s-ok')

    const st = useScriptStore.getState()
    expect(st.scripts.find((s) => s.id === 's-ok')!.content).toContain('ИНТ. X')
    expect(st.contentErrors['s-ok']).toBeUndefined()
  })

  it('документа нет (null) → пустой контент, без ошибки (новый сценарий)', async () => {
    vi.mocked(loadScriptContent).mockResolvedValue(null)
    await useScriptStore.getState().ensureContentLoaded('s-ok')

    const st = useScriptStore.getState()
    expect(st.scripts.find((s) => s.id === 's-ok')!.content).toBe('')
    expect(st.contentErrors['s-ok']).toBeUndefined()
  })
})
