// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import HelpModal from './HelpModal'

beforeAll(() => {
  // jsdom: offsetParent всегда null — фокус-трап фильтрует по видимости, подменяем
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() { return this.parentElement ?? document.body },
    configurable: true,
  })
})

afterEach(cleanup)

describe('HelpModal — механика', () => {
  it('Escape закрывает модалку', () => {
    const onClose = vi.fn()
    render(<HelpModal isDark onClose={onClose} pageId="text" />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('начальный фокус — поле поиска; aria-атрибуты диалога', () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="text" />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Помощь · Текст')
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Поиск…'))
  })

  it('фокус-трап: Tab с последнего элемента возвращает на первый', () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="text" />)
    const dialog = screen.getByRole('dialog')
    const els = [...dialog.querySelectorAll<HTMLElement>(
      'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
    )].filter((el) => el.offsetParent !== null)
    expect(els.length).toBeGreaterThan(1)
    const last = els[els.length - 1]
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(els[0])
  })
})

describe('HelpModal — контекст страницы', () => {
  it('на «Карточках» нет вкладки «Клавиши и действия» и клавиш редактора', () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="cards" />)
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Помощь · Карточки')
    expect(screen.queryByText('Клавиши и действия')).toBeNull()
    // а контент карточек — есть (на вкладке «Возможности»)
    fireEvent.click(screen.getByText('Возможности'))
    expect(screen.getByText(/Папки-группы/)).toBeTruthy()
    expect(screen.queryByText(/Multi-cursor/)).toBeNull()
  })

  it('на «Тексте» вкладка «Клавиши и действия» есть', () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="text" />)
    expect(screen.getByText('Клавиши и действия')).toBeTruthy()
  })

  it('поиск по всему контенту страницы находит и переключает вкладку', async () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="text" />)
    fireEvent.change(screen.getByPlaceholderText('Поиск…'), { target: { value: 'закладк' } })
    // активная вкладка без совпадений автопереключается на вкладку с результатами
    const hits = await screen.findAllByText(/закладк/i, {}, { timeout: 2000 })
    expect(hits.length).toBeGreaterThan(0)
  })
})
