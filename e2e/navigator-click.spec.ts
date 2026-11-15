import { test, expect, type Page } from '@playwright/test'

// Хелпер как в reliability.spec.ts
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

test('навигатор: клик по карточке сцены скроллит сценарий к ней', async ({ page }) => {
  const editor = await openFreshEditor(page, `E2E NavClick ${Date.now()}`)

  // 25 сцен через вставку — реальный путь создания sceneHeader-нод
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const bulk = Array.from({ length: 25 }, (_, i) =>
    `${i + 1}. ИНТ. ЛОКАЦИЯ ${i + 1} - ДЕНЬ\nТекст сцены ${i + 1}, пара строк для высоты.\nЕщё немного текста.\n`
  ).join('\n') + '1-8-А. ИНТ. ЛИТЕРНАЯ - ДЕНЬ\nТекст литерной сцены.\n'
  await page.evaluate((t) => navigator.clipboard.writeText(t), bulk)
  await editor.click()
  await page.keyboard.press('Control+V')
  await page.waitForTimeout(2500)

  // Кликаем карточку ЛИТЕРНОЙ сцены (1-8-А) — она в конце документа
  const nav = page.locator('div.w-72').first()
  const card = nav.locator('div.group', { hasText: 'ЛИТЕРНАЯ' }).last()
  await expect(card).toBeVisible({ timeout: 10000 })
  await card.click()
  await page.waitForTimeout(1500) // smooth scroll + таймаут 500мс в хуке

  // Реальный скролл-контейнер — предок шапок с overflow-y:auto (flex-1 overflow-y-auto),
  // а не родитель .ProseMirror (он overflow:visible и scrollTop всегда 0)
  const scrollTop = await page.evaluate(() => {
    const headers = [...document.querySelectorAll('.ProseMirror [data-type="scene-header"]')]
    const target = headers[headers.length - 1]
    let el: Element | null = target?.parentElement ?? null
    while (el && el !== document.body) {
      const s = getComputedStyle(el)
      if (s.overflowY === 'auto' || s.overflowY === 'scroll') return el.scrollTop
      el = el.parentElement
    }
    return -1
  })
  expect(scrollTop).toBeGreaterThan(0)
})
