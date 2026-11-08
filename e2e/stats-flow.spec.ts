import { test, expect } from '@playwright/test'

// Сквозной сценарий: сериал → сцена → статистика → фильтр по сериям
test('сценарий → статистика → фильтр серий', async ({ page }) => {
  const projectName = `E2E Сериал ${Date.now()}`

  await page.goto('/')

  // Создаём СЕРИАЛ с 2 сериями
  const newBtn = page.getByText('Новый проект').or(page.getByText('Создать первый проект'))
  await newBtn.first().click()
  await page.getByPlaceholder(/Например/).fill(projectName)
  await page.getByText('Сериал', { exact: true }).first().click()
  await page.getByPlaceholder('8').fill('2')   // количество серий
  await page.getByPlaceholder('45').fill('25') // минут в серии
  await page.getByRole('button', { name: 'Создать проект' }).click()
  await page.waitForURL(/\/project\//)
  await page.waitForTimeout(800)

  // Модуль «Сценарий» → новый скрипт
  await page.getByText('Сценарий', { exact: false }).first().click()
  await page.waitForURL(/\/script/)
  await page.getByText('Написать с нуля').click()
  await page.getByRole('button', { name: 'Создать сценарий' }).click()

  // Печатаем сцену: заголовок + действие + персонаж + реплика
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first()
  await expect(editor).toBeVisible({ timeout: 10000 })
  await editor.click()
  await page.keyboard.type('ИНТ. ДОМ - ДЕНЬ')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Иван входит в комнату.')
  await page.keyboard.press('Enter')
  await page.keyboard.type('ИВАН')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Привет.')

  // Ждём экстракцию сцен в стор (debounce)
  await page.waitForTimeout(3000)

  // Переходим на вкладку СТАТИСТИКА
  await page.getByText('СТАТИСТИКА', { exact: false }).first().click()
  await page.waitForTimeout(500)

  // Метрика «Сцен» = 1
  await expect(page.getByText('Сцен', { exact: true })).toBeVisible()
  // Ключевые блоки присутствуют
  await expect(page.getByText('Темп по сценам')).toBeVisible()
  await expect(page.getByText('Диалог / Действие')).toBeVisible()
  await expect(page.getByText('Готовность серий')).toBeVisible()

  // Фильтр «Все» — сцена видна
  await page.getByRole('button', { name: 'Все', exact: true }).first().click()
  await page.waitForTimeout(300)
  await expect(page.getByText('СЕРИЯ 1')).toBeVisible()

  // Фильтр «С2» — серия не написана → блоки пустые с заглушками
  await page.getByRole('button', { name: 'С2', exact: true }).click()
  await page.waitForTimeout(300)
  await expect(page.getByText('Здесь будет темп сцен')).toBeVisible()
  await expect(page.getByText('Здесь будет хронометраж')).toBeVisible()

  // Обратно на «Все» — темп вернулся
  await page.getByRole('button', { name: 'Все', exact: true }).first().click()
  await page.waitForTimeout(300)
  await expect(page.getByText('СЕРИЯ 1')).toBeVisible()
})
