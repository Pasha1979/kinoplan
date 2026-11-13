import { test, expect, type Page } from '@playwright/test'

// Хелпер: создать проект → сценарий → вернуть редактор (как в reliability.spec.ts)
async function openFreshEditor(page: Page, projectName: string) {
  await page.goto('/')
  const newBtn = page.getByText('Новый проект').or(page.getByText('Создать первый проект'))
  await newBtn.first().click()
  await page.getByPlaceholder(/Например/).fill(projectName)
  await page.getByRole('button', { name: 'Создать проект' }).click()
  await page.waitForURL(/\/project\//)
  await page.waitForTimeout(800)
  await page.getByText('Сценарий', { exact: false }).first().click()
  await page.waitForURL(/\/script/)
  await page.getByText('Написать с нуля').click()
  await page.getByRole('button', { name: 'Создать сценарий' }).click()
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first()
  await expect(editor).toBeVisible({ timeout: 10000 })
  return editor
}

async function pasteScript(page: Page, text: string) {
  await page.evaluate((t) => {
    const el = document.querySelector('.ProseMirror[contenteditable="true"]')
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    el?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, text)
  // PageCounter пересчитывает по debounce + измерение DOM — ждём стабилизации
  await page.waitForTimeout(2000)
}

/** Текст «N.0 стр.» из статусбара редактора */
async function readPages(page: Page): Promise<number> {
  const el = page.locator('span', { hasText: 'стр.' }).last()
  const txt = await el.innerText()
  const m = txt.match(/([\d.,]+)\s*стр/)
  return m ? parseFloat(m[1].replace(',', '.')) : NaN
}

const ACTION_LINE = 'Герой идёт по комнате, останавливается у окна и смотрит на двор.'
const DIALOGUE = 'ИВАН\n(тихо)\nЯ не пойду туда. Здесь останусь.\n\nМАРЬЯ\nПочему? Это же единственный шанс.'

// Эталонная сцена: шапка + N ремарок
const scene = (n: number, lines: number) =>
  `${n}. ИНТ. ДОМ - ДЕНЬ\n\n${Array.from({ length: lines }, (_, i) => `${ACTION_LINE} (${i + 1})`).join('\n\n')}`

// T-92: эталоны пагинации — канонические фикстуры, зафиксированные значения
// из реального layout (Courier Prime в бандле → метрики детерминированы).
// Метод фиксации: прогон на эталонном тексте → значения записаны сюда.
// Отклонение > толеранса = регрессия пагинации (шрифт/поля/высота строки).

test('эталон: одна короткая сцена → 0.4 стр.', async ({ page }) => {
  await openFreshEditor(page, `E2E Pages S ${Date.now()}`)
  await pasteScript(page, scene(1, 3))
  const pages = await readPages(page)
  expect(pages).toBeGreaterThan(0.2)
  expect(pages).toBeLessThan(0.6)
})

// Геометрия сведена к модели «space before» (FD/КИТ): пустая строка = 24px
// (line-height 1.5), перед шапкой 2 строки (48px), внутри персонаж→диалог — 0.
// ~40 строк полуторного интервала на страницу A4 = канон КИТ.
// Значения зафиксированы из реального layout 13.11.2026 (Courier Prime в бандле).
test('эталон: 40 ремарок (перенос в ~2 строки) → 3.1 стр.', async ({ page }) => {
  await openFreshEditor(page, `E2E Pages M ${Date.now()}`)
  await pasteScript(page, scene(1, 40))
  const pages = await readPages(page)
  expect(pages).toBeGreaterThan(2.9)
  expect(pages).toBeLessThan(3.3)
})

test('эталон: 120 ремарок в двух сценах → 9.0 стр.', async ({ page }) => {
  await openFreshEditor(page, `E2E Pages L ${Date.now()}`)
  await pasteScript(page, `${scene(1, 60)}\n\n${scene(2, 60)}`)
  const pages = await readPages(page)
  expect(pages).toBeGreaterThan(8.7)
  expect(pages).toBeLessThan(9.3)
})

test('эталон: 12 диалоговых пар → 2.3 стр.', async ({ page }) => {
  await openFreshEditor(page, `E2E Pages D ${Date.now()}`)
  await pasteScript(page, `1. ИНТ. КАБИНЕТ - ДЕНЬ\n\n${Array.from({ length: 12 }, () => DIALOGUE).join('\n\n')}`)
  const pages = await readPages(page)
  expect(pages).toBeGreaterThan(2.0)
  expect(pages).toBeLessThan(2.6)
})
