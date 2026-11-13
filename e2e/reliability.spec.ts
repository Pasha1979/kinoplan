import { test, expect, type Page } from '@playwright/test'

// Хелпер: создать проект → сценарий → вернуть редактор
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

// T-89: перезагрузка страницы → контент на месте (persistence)
test('persistence: текст сценария переживает перезагрузку', async ({ page }) => {
  const editor = await openFreshEditor(page, `E2E Persist ${Date.now()}`)
  await editor.click()
  await page.keyboard.type('ИНТ. ДОМ - ДЕНЬ')
  await expect(editor).toContainText('ИНТ')

  // Ждём debounce-запись в PouchDB (WRITE_DEBOUNCE_MS=400 + очередь)
  await page.waitForTimeout(1500)
  await page.reload()

  const editor2 = page.locator('.ProseMirror[contenteditable="true"]').first()
  await expect(editor2).toContainText('ИНТ. ДОМ - ДЕНЬ', { timeout: 10000 })
})

// T-90: два проекта → изоляция скриптов
test('изоляция: сценарий проекта A не просачивается в проект B', async ({ page }) => {
  const marker = `МАРКЕР_${Date.now()}`
  const editorA = await openFreshEditor(page, `E2E Iso A ${Date.now()}`)
  await editorA.click()
  await page.keyboard.type(`ИНТ. ${marker} - ДЕНЬ`)
  await page.waitForTimeout(1500)

  // Создаём второй проект
  const editorB = await openFreshEditor(page, `E2E Iso B ${Date.now()}`)
  // В редакторе B не должно быть маркера проекта A
  await expect(editorB).not.toContainText(marker)
  // И после перезагрузки маркер не должен появиться нигде на странице
  await page.reload()
  await page.waitForTimeout(1500)
  await expect(page.locator('body')).not.toContainText(marker)
})

// T-91: drag сцены в навигаторе → Ctrl+Z → порядок И номера восстановлены
test('undo: перетаскивание сцены отменяется атомарно', async ({ page }) => {
  const editor = await openFreshEditor(page, `E2E Undo ${Date.now()}`)
  await editor.click()
  // Две сцены одной вставкой — paste проходит через parseScreenplayText (flat-блоки)
  await page.evaluate(() => {
    const el = document.querySelector('.ProseMirror[contenteditable="true"]')
    const dt = new DataTransfer()
    dt.setData('text/plain', '1. ИНТ. ДОМ - ДЕНЬ\n\nДействие первой сцены.\n\n2. ЭКСТ. УЛИЦА - НОЧЬ\n\nДействие второй сцены.')
    el?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await page.waitForTimeout(1200)

  // Стабильный селектор сцены — scene-header (модель редактора — flat-блоки, не scene-ноды).
  // Скоуп по editor: на странице может быть split-view с дублирующим DOM.
  const headers = editor.locator('div[data-type="scene-header"]')
  await expect(headers).toHaveCount(2, { timeout: 5000 })

  // Карточки сцен в навигаторе — по тексту локации
  const cardDom = page.locator('.group.rounded-xl', { hasText: 'ДОМ' }).first()
  const cardStreet = page.locator('.group.rounded-xl', { hasText: 'УЛИЦА' }).first()
  await expect(cardDom).toBeVisible()
  await expect(cardStreet).toBeVisible()

  // dnd-kit PointerSensor (distance: 8) — перетаскиваем сцену 2 над сценой 1 мышью
  const src = await cardStreet.boundingBox()
  const dst = await cardDom.boundingBox()
  expect(src && dst).toBeTruthy()
  await page.mouse.move(src!.x + src!.width / 2, src!.y + src!.height / 2)
  await page.mouse.down()
  await page.mouse.move(src!.x + src!.width / 2, src!.y + src!.height / 2 - 15, { steps: 3 })
  await page.mouse.move(dst!.x + dst!.width / 2, dst!.y + 4, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(800)

  // После переноса первая шапка — ЭКСТ. УЛИЦА (перенумерована в 1)
  await expect(headers.first()).toContainText('ЭКСТ. УЛИЦА')

  // Ctrl+Z — порядок и номера должны вернуться атомарно
  await editor.click()
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(500)

  await expect(headers.first()).toContainText('1. ИНТ. ДОМ - ДЕНЬ')
  await expect(headers.nth(1)).toContainText('ЭКСТ. УЛИЦА')
})
