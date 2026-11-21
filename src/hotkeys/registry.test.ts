import { describe, it, expect, vi } from 'vitest'
import { HOTKEYS, helpActionGroups, runHotkeyDispatch } from './registry'
import { HELP_PAGES } from '../help'

const kev = (init: { key?: string; code?: string; ctrlKey?: boolean; metaKey?: boolean }) =>
  ({ preventDefault: () => {}, ...init }) as KeyboardEvent

describe('hotkeys registry — целостность', () => {
  it('id диспетчеризуемых клавиш уникальны и есть у всех match-записей', () => {
    const ids = HOTKEYS.filter((h) => h.match).map((h) => h.id)
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('все pageId валидны', () => {
    for (const h of HOTKEYS) {
      expect(HELP_PAGES[h.page], `неизвестная страница ${h.page}`).toBeDefined()
    }
  })

  it('каждая строка имеет label и group', () => {
    for (const h of HOTKEYS) {
      expect(h.label.trim().length).toBeGreaterThan(0)
      expect(h.group.trim().length).toBeGreaterThan(0)
    }
  })

  it('порядок групп «Клавиши и действия» Текста — как в реестре', () => {
    const names = helpActionGroups('text').map((g) => g.group)
    expect(names[0]).toBe('Документ')
    expect(names).toContain('Поиск и замена')
    expect(names).toContain('SmartType — автодополнение')
    // новые группы не создаются повторно — каждая уникальна
    expect(new Set(names).size).toBe(names.length)
  })

  it('home-страница получает реестровые клавиши (F1)', () => {
    const flat = helpActionGroups('home').flatMap((g) => g.items)
    expect(flat.some((i) => i.keys?.includes('F1'))).toBe(true)
  })
})

describe('runHotkeyDispatch', () => {
  it('match → preventDefault + run', () => {
    const run = vi.fn()
    const e = kev({ code: 'KeyS', ctrlKey: true })
    const pd = vi.spyOn(e, 'preventDefault')
    runHotkeyDispatch(e, { 'script.save': { run } })
    expect(run).toHaveBeenCalledTimes(1)
    expect(pd).toHaveBeenCalled()
  })

  it('when-гард блокирует обработчик (и preventDefault не зовётся)', () => {
    const run = vi.fn()
    const e = kev({ key: 'Escape' })
    const pd = vi.spyOn(e, 'preventDefault')
    runHotkeyDispatch(e, { 'script.exit-focus': { when: () => false, run } })
    expect(run).not.toHaveBeenCalled()
    expect(pd).not.toHaveBeenCalled()
  })

  it('оба Escape-обработчика оцениваются: focus съедает первым при своём when', () => {
    const focus = vi.fn()
    const dialogue = vi.fn()
    runHotkeyDispatch(kev({ key: 'Escape' }), {
      'script.exit-focus': { when: () => true, run: focus },
      'script.exit-dialogue': { when: () => false, run: dialogue },
    })
    expect(focus).toHaveBeenCalled()
    expect(dialogue).not.toHaveBeenCalled()
  })

  it('первый совпавший обработчик — остальные не вызываются', () => {
    const focus = vi.fn()
    const dialogue = vi.fn()
    runHotkeyDispatch(kev({ key: 'Escape' }), {
      'script.exit-focus': { when: () => true, run: focus },
      'script.exit-dialogue': { when: () => true, run: dialogue },
    })
    expect(focus).toHaveBeenCalledTimes(1)
    expect(dialogue).not.toHaveBeenCalled()
  })

  it('без обработчика id — тихо пропускает', () => {
    expect(() => runHotkeyDispatch(kev({ code: 'KeyF', ctrlKey: true }), {})).not.toThrow()
  })
})
