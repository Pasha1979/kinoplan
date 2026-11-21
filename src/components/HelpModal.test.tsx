// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import HelpModal from './HelpModal'
import { FOCUSABLE } from './HelpModalBase'

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
  it('на «Карточках» есть свои действия, но нет клавиш редактора', () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="cards" />)
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Помощь · Карточки')
    // «Клавиши и действия» есть — действия доски
    fireEvent.click(screen.getByText('Клавиши и действия'))
    expect(screen.getByText(/Мультивыбор карточек/)).toBeTruthy()
    expect(screen.getByText(/Зум доски/)).toBeTruthy()
    // а контент карточек — есть (на вкладке «Возможности»)
    fireEvent.click(screen.getByText('Возможности'))
    expect(screen.getByText(/Папки-группы/)).toBeTruthy()
    expect(screen.queryByText(/Multi-cursor/)).toBeNull()
    expect(screen.queryByText('Ctrl+F')).toBeNull()
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

  it('запоминает последнюю вкладку и прокрутку при переоткрытии', () => {
    const { unmount } = render(<HelpModal isDark onClose={vi.fn()} pageId="text" />)
    const dialog = screen.getByRole('dialog')
    const scrollEl = dialog.querySelector<HTMLElement>('[style*="overflow-y"]')!
    fireEvent.click(screen.getByText('Возможности'))
    scrollEl.scrollTop = 120
    fireEvent.scroll(scrollEl)
    unmount()

    render(<HelpModal isDark onClose={vi.fn()} pageId="text" />)
    // вкладка восстановлена — «Типы блоков» рендерится только на «Возможностях»
    expect(screen.getByText('Типы блоков')).toBeTruthy()
    expect(screen.getByRole('dialog').querySelector<HTMLElement>('[style*="overflow-y"]')!.scrollTop).toBe(120)
  })

  it('ручной клик по вкладке без совпадений не выдёргивается автопереключением', async () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="text" />)
    fireEvent.change(screen.getByPlaceholderText('Поиск…'), { target: { value: 'закладк' } })
    await screen.findAllByText(/закладк/i)
    // уходим на вкладку с нулём совпадений — нас не должно вернуть
    fireEvent.click(screen.getByText('Обзор'))
    expect(screen.queryByText(/закладк/i)).toBeNull()
  })

  it('deep-link: якорь открывает вкладку с элементом и ставит data-help-anchor', () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="text" anchor="smarttype-accept" />)
    const el = document.querySelector('[data-help-anchor="smarttype-accept"]')
    expect(el).toBeTruthy()
    expect(el!.textContent).toMatch(/Enter или Tab/)
  })

  it('«Подробности» (summary) доступны с клавиатуры — входят в FOCUSABLE', () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="cards" />)
    fireEvent.click(screen.getByText('Возможности'))
    const dialog = screen.getByRole('dialog')
    const summary = dialog.querySelector('summary')
    expect(summary).toBeTruthy()
    const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
    expect(focusables).toContain(summary)
  })

  it('поиск находит текст «Подробностей»', async () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="cards" />)
    // «Пустая папка удаляется сама» — есть только в details подсказки «Папки-группы»
    fireEvent.change(screen.getByPlaceholderText('Поиск…'), { target: { value: 'пустая папка' } })
    const hits = await screen.findAllByText(/Папки-группы/, {}, { timeout: 2000 })
    expect(hits.length).toBeGreaterThan(0)
  })

  it('ноль совпадений — «Ничего не найдено» вместо пустой области', () => {
    render(<HelpModal isDark onClose={vi.fn()} pageId="text" />)
    fireEvent.change(screen.getByPlaceholderText('Поиск…'), { target: { value: 'кщьфывцу' } })
    expect(screen.getByText(/Ничего не найдено по «кщьфывцу»/)).toBeTruthy()
  })
})
