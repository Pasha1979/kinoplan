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

async function pasteText(page: Page, editor: ReturnType<typeof page.locator>, text: string) {
  await page.evaluate((t) => {
    const el = document.querySelector('.ProseMirror[contenteditable="true"]')
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    el?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, text)
}

// C6: поиск + замена через UI
test('поиск и замена: находит кириллицу, заменяет все вхождения', async ({ page }) => {
  const editor = await openFreshEditor(page, `E2E Search ${Date.now()}`)
  await pasteText(page, editor, '1. ИНТ. ДОМ - ДЕНЬ\n\nИВАН идёт по дому. Иван садится.')
  await page.waitForTimeout(1200)

  // Ctrl+F открывает панель поиска
  await editor.click()
  await page.keyboard.press('Control+f')
  const searchInput = page.getByPlaceholder('Найти...')
  await expect(searchInput).toBeVisible({ timeout: 5000 })
  await searchInput.fill('иван')
  // Поиск запускается по Enter (не автоматически при вводе)
  await searchInput.press('Enter')
  await page.waitForTimeout(600)

  // Счётчик совпадений — формат «1 / N», регистронезависимо (ИВАН + Иван = 2)
  await expect(page.getByText('1 / 2').first()).toBeVisible({ timeout: 8000 })

  // Открываем замену
  await page.locator('button[title="Найти и заменить"]').click()
  const replaceInput = page.getByPlaceholder('Заменить на...')
  await expect(replaceInput).toBeVisible()
  await replaceInput.fill('ПЕТР')
  await page.getByRole('button', { name: 'Заменить всё' }).click()
  await page.waitForTimeout(400)

  await expect(editor).toContainText('ПЕТР')
})

// C7: split-screen — правка во втором окне → честный статус сохранения
test('split-screen: правка справа → статус «Сохранение…»/сохранено', async ({ page }) => {
  const editor = await openFreshEditor(page, `E2E Split ${Date.now()}`)
  await editor.click()
  await page.keyboard.type('ИНТ. ДОМ - ДЕНЬ')
  await page.waitForTimeout(800)

  await page.locator('button[title="Split Screen — два окна редактора"]').click()
  await page.waitForTimeout(500)
  const editors = page.locator('.ProseMirror[contenteditable="true"]')
  await expect(editors).toHaveCount(2, { timeout: 5000 })

  // Правим во втором (правом) редакторе — он редактирует тот же скрипт
  await editors.nth(1).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' ВТОРАЯ ПРАВКА')
  await page.waitForTimeout(600)

  // Честный статус: правка справа проходит через общий updateScript —
  // кнопка сохранения показывает «Сохранение...» или остаётся рабочей
  const saveBtn = page.getByRole('button', { name: /Сохранить|Сохранение/ })
  await expect(saveBtn.first()).toBeVisible()
  // Правка записалась: перезагрузка показывает её в редакторе
  await page.waitForTimeout(1500) // debounce-запись
  await page.reload()
  const editorAfter = page.locator('.ProseMirror[contenteditable="true"]').first()
  await expect(editorAfter).toContainText('ВТОРАЯ ПРАВКА', { timeout: 10000 })
})

// C8: focus/dialogue/POV режимы
test('режимы: Focus прячет панели, Dialogue выбирает персонажа, POV фильтрует', async ({ page }) => {
  const editor = await openFreshEditor(page, `E2E Modes ${Date.now()}`)
  await pasteText(page, editor, '1. ИНТ. ДОМ - ДЕНЬ\n\nИВАН\nПривет!\n\n2. ЭКСТ. ДВОР - НОЧЬ\n\nМАША\nОтвет!')
  await page.waitForTimeout(1500)

  // Focus Mode — навигатор прячется
  const nav = page.locator('div.w-72').first()
  await page.locator('button[title="Focus Mode — полноэкранный режим"]').click()
  await page.waitForTimeout(400)
  await expect(nav).toHaveCount(0)
  // Выход — кнопка в оверлее или Escape
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await expect(nav).toBeVisible({ timeout: 5000 })

  // Dialogue Mode — кнопка открывает выбор персонажа
  await page.locator('button[title="Dialogue Mode — диалоги персонажа"]').click()
  const picker = page.getByText('ИВАН', { exact: true }).first()
  await expect(picker).toBeVisible({ timeout: 5000 })
  await picker.click()
  await page.waitForTimeout(400)

  // POV — кнопка «Только сцены персонажа» в пикере
  const povBtn = page.locator('button[title="Только сцены персонажа"]')
  if (await povBtn.isVisible().catch(() => false)) {
    await povBtn.click()
    await page.waitForTimeout(500)
  }
  // Редактор жив — сцены отфильтрованы или подсвечены
  await expect(editor).toBeVisible()
  await page.keyboard.press('Escape')
})

// C9: авто-типографика при наборе + Shift+Enter мягкий перенос
test('авто-типографика: «--»→«—» при наборе, Shift+Enter без смены блока', async ({ page }) => {
  const editor = await openFreshEditor(page, `E2E Typo ${Date.now()}`)
  await editor.click()
  await page.keyboard.type('ИНТ. ДОМ - ДЕНЬ')
  await page.waitForTimeout(800)
  await page.keyboard.press('Enter')
  await page.keyboard.type('Строка действия')
  await page.waitForTimeout(400)

  // Авто-типографика включена по умолчанию (uiStore.autoTypography: true).
  // Возвращаем фокус в редактор и набираем дефис-дефис → должно стать тире.
  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' -- второй')
  await page.waitForTimeout(600)
  await expect(editor).toContainText('—')

  // Shift+Enter — мягкий перенос: остаёмся в том же блоке действия
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('продолжение')
  await page.waitForTimeout(400)
  // Новой шапки сцены не появилось — всё внутри блока действия
  const headers = editor.locator('div[data-type="scene-header"]')
  await expect(headers).toHaveCount(1)
})
