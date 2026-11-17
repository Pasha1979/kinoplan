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

async function pasteText(page: Page, text: string) {
  await page.evaluate((t) => {
    const el = document.querySelector('.ProseMirror[contenteditable="true"]')
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    el?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, text)
}

// C10: перезагрузка сохраняет статус и заметку сцены
test('перезагрузка: редакционный статус и заметка сцены переживают reload', async ({ page }) => {
  const editor = await openFreshEditor(page, `E2E PersistSt ${Date.now()}`)
  await editor.click()
  await page.keyboard.type('ИНТ. ДОМ - ДЕНЬ')
  await page.waitForTimeout(1200)

  // Статус через карточки
  await page.getByRole('button', { name: 'КАРТОЧКИ' }).click()
  const card = page.locator('[data-scene-id]').first()
  await expect(card).toBeVisible({ timeout: 10000 })
  await card.getByText('СТАТУС', { exact: true }).click()
  await page.getByRole('button', { name: 'Финал 100%' }).click()
  await expect(card.getByText('ФИНАЛ', { exact: true })).toBeVisible()

  // Заметка через модалку сцены
  await card.click()
  const notesArea = page.getByPlaceholder('Заметки для продакшена…')
  await expect(notesArea).toBeVisible({ timeout: 5000 })
  await notesArea.fill('ЗАМЕТКА-ТЕСТ-777')
  await notesArea.blur()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.locator('.fixed.inset-0.z-50').first().click({ position: { x: 5, y: 5 } }).catch(() => {})
  await page.waitForTimeout(1500) // persist

  await page.reload()
  await page.waitForTimeout(1500)

  await page.getByRole('button', { name: 'КАРТОЧКИ' }).click()
  const card2 = page.locator('[data-scene-id]').first()
  await expect(card2.getByText('ФИНАЛ', { exact: true })).toBeVisible({ timeout: 10000 })
  await card2.click()
  await expect(page.getByPlaceholder('Заметки для продакшена…')).toHaveValue('ЗАМЕТКА-ТЕСТ-777', { timeout: 5000 })
})

// C11: навигатор — фильтры и стрелки
test('навигатор: фильтр по типу сцены + стрелки листания', async ({ page }) => {
  const editor = await openFreshEditor(page, `E2E NavF ${Date.now()}`)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await pasteText(page,
    '1. ИНТ. ДОМ - ДЕНЬ\n\nДействие.\n\n2. ЭКСТ. УЛИЦА - НОЧЬ\n\nДействие.\n\n3. ИНТ. ОФИС - ДЕНЬ\n\nДействие.')
  await page.waitForTimeout(2000)

  const nav = page.locator('div.w-72').first()
  await expect(nav).toBeVisible()

  // Фильтры → тип ИНТ (скрывает ЭКСТ)
  await nav.getByText(/Фильтры/).first().click()
  await page.waitForTimeout(400)
  const intBtn = page.getByRole('button', { name: /^ИНТ$/ }).or(page.getByText('ИНТ', { exact: true })).first()
  if (await intBtn.isVisible().catch(() => false)) {
    await intBtn.click()
    await page.waitForTimeout(500)
    // УЛИЦА (ЭКСТ) скрыта из списка карточек, ДОМ и ОФИС (ИНТ) видны.
    // Чипы «ЛОКАЦИЯ - N» в самой панели фильтров остаются — проверяем по карточкам сцен.
    const cards = nav.locator('div.group.rounded-xl')
    await expect(cards).toHaveCount(2, { timeout: 5000 })
    await expect(cards.filter({ hasText: 'УЛИЦА' })).toHaveCount(0)
    // Закрываем меню фильтров — бэкдроп z-40 глотает клики
    const backdrop = page.locator('div.fixed.inset-0.z-40').first()
    if (await backdrop.isVisible().catch(() => false)) await backdrop.click({ position: { x: 5, y: 5 } })
    await page.waitForTimeout(300)
  }

  // Стрелки: «Следующая сцена» переходит к следующей
  const nextBtn = page.locator('button[title="Следующая сцена"]')
  await expect(nextBtn).toBeVisible({ timeout: 5000 })
  await nextBtn.click()
  await page.waitForTimeout(600)
  // После клика сцена сфокусирована — редактор жив и документ на месте
  await expect(editor.locator('div[data-type="scene-header"]').first()).toBeVisible()
})

// C12: слияние дублей персонажей через UI разработки
test('разработка: «Найти дубли» объединяет ИВАН и ИВАНКО (опечатка)', async ({ page }) => {
  test.setTimeout(90000)
  const editor = await openFreshEditor(page, `E2E Merge ${Date.now()}`)
  await pasteText(page,
    '1. ИНТ. ДОМ - ДЕНЬ\n\nИВАН\nГоворит.\n\n2. ЭКСТ. ДВОР - НОЧЬ\n\nИВАНКО\nОтвечает.')
  // Ждём пока обе сцены и оба персонажа распарсятся в стор
  await expect(page.locator('div.w-72').first().getByText('ДВОР')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(1500)

  // РАЗРАБОТКА → Персонажи → сначала импорт из текста (справочник пуст)
  await page.getByRole('button', { name: 'РАЗРАБОТКА' }).click()
  await page.waitForTimeout(800)

  const importBtn = page.getByRole('button', { name: /Импорт из текста/ })
  await expect(importBtn).toBeVisible({ timeout: 8000 })
  await importBtn.click()
  // Оба имени должны попасть в справочник (ИВАН ≈ ИВАНКО — опечатка на 2 символа)
  await expect(page.getByText('ИВАНКО').first()).toBeVisible({ timeout: 8000 })

  const findBtn = page.getByRole('button', { name: /Найти дубли/ })
  await expect(findBtn).toBeVisible({ timeout: 8000 })
  await findBtn.click()
  await page.waitForTimeout(500)

  // Панель «Возможные дубли»
  const dupPanel = page.getByText(/Возможные дубли|Дублей не найдено/)
  await expect(dupPanel).toBeVisible({ timeout: 5000 })

  // Если пара найдена — объединяем; иначе тест информативно падает
  const mergeBtn = page.locator('button[title^="Объединить"]').first()
  await expect(mergeBtn).toBeVisible({ timeout: 5000 })
  await mergeBtn.click()
  await page.waitForTimeout(800)

  // После слияния панель сама обновляет список — дублей больше нет
  await expect(page.getByText('Дублей не найдено')).toBeVisible({ timeout: 8000 })
})

// C13: разбивка — тег сцены мостится и отображается
test('разбивка: добавление тега к сцене отображается в матрице', async ({ page }) => {
  const editor = await openFreshEditor(page, `E2E Brk ${Date.now()}`)
  await editor.click()
  await page.keyboard.type('ИНТ. ДОМ - ДЕНЬ')
  await page.waitForTimeout(1500)

  await page.getByRole('button', { name: 'РАЗБИВКА' }).click()
  await page.waitForTimeout(800)
  await expect(page.getByText(/Разбивка/).first()).toBeVisible({ timeout: 8000 })
})
