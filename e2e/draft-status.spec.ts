import { test, expect } from '@playwright/test'

// T-121: редакционный статус сцены — полная механика
// карточка (бейдж+выпадашка) → правый клик → модалка → навигатор → фильтры → % → персист
test('T-121: редакционный статус — вся механика', async ({ page }) => {
  const projectName = `E2E Статус ${Date.now()}`

  const readiness = page.getByTitle('Средняя готовность сцен по весам статусов')

  // ─── Сетап: проект → сценарий → сцена ───
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
  await editor.click()
  await page.keyboard.type('ИНТ. ДОМ - ДЕНЬ')
  await page.waitForTimeout(1200) // сцена ушла в стор через handleScenesChange

  // ─── 1. Карточки: призрачный бейдж → выпадашка → «Финал» ───
  await page.getByRole('button', { name: 'КАРТОЧКИ' }).click()
  const card = page.locator('[data-scene-id]').first()
  await expect(card).toBeVisible({ timeout: 10000 })
  await expect(card.getByText('СТАТУС', { exact: true })).toBeVisible()

  await card.getByText('СТАТУС', { exact: true }).click()
  await expect(page.getByText('Редакционный статус')).toBeVisible()
  await page.getByRole('button', { name: 'Финал 100%' }).click()
  await expect(card.getByText('ФИНАЛ', { exact: true })).toBeVisible()
  // % готовности: финал = 100%
  await expect(readiness.getByText('100%')).toBeVisible()

  // ─── 2. Правый клик → «В работе» ───
  await card.click({ button: 'right' })
  const ctxMenu = page.locator('div.fixed', { hasText: 'Цвет карточки' })
  await ctxMenu.getByRole('button', { name: 'В работе', exact: true }).click()
  await expect(card.getByText('В РАБОТЕ', { exact: true })).toBeVisible()
  await expect(readiness.getByText('50%')).toBeVisible()

  // ─── 3. Фильтры: выпадашка «Статус» — «Готова» скрывает, «Недописанные» показывает ───
  const filterBtn = page.getByRole('button', { name: /^Статус/ })
  const filterMenu = page.locator('div.fixed', { hasText: 'Фильтр по статусу' })
  await filterBtn.click()
  await expect(filterMenu).toBeVisible()
  await filterMenu.getByRole('button', { name: 'Готова' }).click()
  await expect(card).toHaveCount(0)
  await filterMenu.getByRole('button', { name: /Готова/ }).click() // снять (имя стало «Готова ✓»)
  await expect(card).toBeVisible()
  await filterMenu.getByRole('button', { name: /Недописанные/ }).click()
  await expect(card).toBeVisible() // В работе = 50% → недописанная
  await filterMenu.getByRole('button', { name: /Сбросить фильтр/ }).click()
  await expect(filterMenu).toHaveCount(0)
  await expect(card).toBeVisible()

  // ─── 4. Модалка сцены → «На проверке» ───
  await card.click()
  await expect(page.getByText('РЕДАКЦИОННЫЙ СТАТУС')).toBeVisible({ timeout: 5000 })
  await page.getByText('РЕДАКЦИОННЫЙ СТАТУС').locator('..').locator('select').selectOption('review')
  await page.keyboard.press('Escape')
  await page.locator('.fixed.inset-0.z-50').first().click({ position: { x: 5, y: 5 } })
  await expect(card.getByText('НА ПРОВЕРКЕ', { exact: true })).toBeVisible()
  await expect(readiness.getByText('80%')).toBeVisible()

  // ─── 5. Свой статус через выпадашку ───
  await card.getByText('НА ПРОВЕРКЕ', { exact: true }).click()
  await page.getByRole('button', { name: '＋ Свой статус…' }).click()
  await page.getByPlaceholder('Название статуса…').fill('Полировка')
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(card.getByText('ПОЛИРОВКА', { exact: true })).toBeVisible()
  // свой статус появился и в выпадающем фильтре
  await filterBtn.click()
  await expect(filterMenu.getByRole('button', { name: /Полировка/ })).toBeVisible()
  await filterBtn.click() // закрыть выпадашку

  // ─── 6. Текст → навигатор: точка + выпадашка ───
  await page.getByRole('button', { name: 'ТЕКСТ' }).click()
  const navStatus = page.getByTitle(/Статус: Полировка/)
  await expect(navStatus).toBeVisible({ timeout: 10000 })
  await expect(navStatus.getByText('ПОЛИРОВКА')).toBeVisible()
  // клик может проглотиться ре-рендером списка — повторяем, пока меню не откроется
  for (let i = 0; i < 4; i++) {
    await navStatus.click()
    await page.waitForTimeout(250)
    if (await page.getByText('Редакционный статус').isVisible()) break
  }
  await expect(page.getByText('Редакционный статус')).toBeVisible()
  await page.getByRole('button', { name: 'Готова 100%', exact: true }).click()
  await expect(page.getByText('ГОТОВА')).toBeVisible()

  // ─── 7. Персист: перезагрузка → статус на месте ───
  await page.waitForTimeout(1200) // автосохранение
  await page.reload()
  await page.getByRole('button', { name: 'КАРТОЧКИ' }).click()
  await expect(page.locator('[data-scene-id]').first().getByText('ГОТОВА', { exact: true }))
    .toBeVisible({ timeout: 10000 })
})

// T-122: управление своими статусами — правка имени и удаление с очисткой ссылок
test('T-122: правка и удаление своего статуса — осиротевших ссылок нет', async ({ page }) => {
  const projectName = `E2E Управл. ${Date.now()}`
  const readiness = page.getByTitle('Средняя готовность сцен по весам статусов')

  // ─── Сетап ───
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
  await editor.click()
  await page.keyboard.type('ИНТ. ОФИС - ДЕНЬ')
  await page.waitForTimeout(1200)

  // ─── Карточки → свой статус «Полировка» на сцене ───
  await page.getByRole('button', { name: 'КАРТОЧКИ' }).click()
  const card = page.locator('[data-scene-id]').first()
  await expect(card).toBeVisible({ timeout: 10000 })
  await card.getByText('СТАТУС', { exact: true }).click()
  await page.getByRole('button', { name: '＋ Свой статус…' }).click()
  await page.getByPlaceholder('Название статуса…').fill('Полировка')
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(card.getByText('ПОЛИРОВКА', { exact: true })).toBeVisible()
  await expect(readiness.getByText('70%')).toBeVisible() // дефолтный вес 70

  // ─── Управление: открываем модалку, встроенный без кнопок ───
  await card.getByText('ПОЛИРОВКА', { exact: true }).click()
  await page.getByRole('button', { name: '⚙ Управление статусами' }).click()
  const mgr = page.locator('div.rounded-2xl', { hasText: 'Управление статусами' })
  await expect(mgr).toBeVisible()
  // встроенный статус — пометка «встроенный», кнопок ✏️/🗑 нет
  const builtinRow = mgr.getByText('Набросок', { exact: true }).locator('..')
  await expect(builtinRow.getByText('встроенный')).toBeVisible()
  await expect(builtinRow.getByTitle('Удалить статус')).toHaveCount(0)

  // ─── Правка: «Полировка» → «Шлифовка» (id сохраняется — бейдж обновится сам) ───
  await mgr.getByTitle('Править статус').click()
  await mgr.getByPlaceholder('Название статуса…').fill('Шлифовка')
  await mgr.getByRole('button', { name: 'Сохранить' }).click()
  await expect(card.getByText('ШЛИФОВКА', { exact: true })).toBeVisible()
  await expect(readiness.getByText('70%')).toBeVisible() // вес тот же

  // ─── Удаление с переводом сцен в «Готова» ───
  await mgr.getByTitle('Удалить статус').click()
  await expect(mgr.getByText(/используют 1 сцен/)).toBeVisible()
  await mgr.locator('select').selectOption('done')
  await mgr.getByRole('button', { name: 'Удалить' }).click()
  await expect(card.getByText('ГОТОВА', { exact: true })).toBeVisible()
  await expect(readiness.getByText('100%')).toBeVisible()

  // ─── Удаление «оставить без статуса»: новый статус → присвоить → удалить ───
  await card.getByText('ГОТОВА', { exact: true }).click()
  await page.getByRole('button', { name: '＋ Свой статус…' }).click()
  await page.getByPlaceholder('Название статуса…').fill('Черновик2')
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(card.getByText('ЧЕРНОВИК2', { exact: true })).toBeVisible()
  await card.getByText('ЧЕРНОВИК2', { exact: true }).click()
  await page.getByRole('button', { name: '⚙ Управление статусами' }).click()
  await page.locator('div.rounded-2xl', { hasText: 'Управление статусами' })
    .getByTitle('Удалить статус').click()
  // «останутся без статуса» выбран по умолчанию
  await page.locator('div.rounded-2xl', { hasText: 'Управление статусами' })
    .getByRole('button', { name: 'Удалить' }).click()
  // сцена без статуса — призрачный бейдж, готовность 0
  await expect(card.getByText('СТАТУС', { exact: true })).toBeVisible()
  await expect(readiness.getByText('0%')).toBeVisible()
})
