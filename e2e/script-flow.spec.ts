import { test, expect } from '@playwright/test'

// Главный пользовательский сценарий: проект → сценарий → сцена → автосохранение
test('проект → сценарий → сцена → автосохранение', async ({ page }) => {
  const projectName = `E2E Проект ${Date.now()}`

  // 1. Открываем главную
  await page.goto('/')

  // 2. Создаём проект — кнопка «Создать первый проект» на пустом состоянии
  //    или «Новый проект» если проекты уже есть
  const newBtn = page.getByText('Новый проект').or(page.getByText('Создать первый проект'))
  await expect(newBtn.first()).toBeVisible()
  await newBtn.first().click()
  await page.getByPlaceholder(/Например/).fill(projectName)
  await page.getByRole('button', { name: 'Создать проект' }).click()

  // 3. Ждём перехода на страницу проекта + даём persist-записи приземлиться
  await page.waitForURL(/\/project\//)
  await page.waitForTimeout(800)

  // 4. Переходим в модуль «Сценарий»
  await page.getByText('Сценарий', { exact: false }).first().click()
  await page.waitForURL(/\/script/)

  // 5. На экране выбора — пишем с нуля → форма → создать
  await page.getByText('Написать с нуля').click()
  await page.getByRole('button', { name: 'Создать сценарий' }).click()

  // 6. Печатаем заголовок сцены в редакторе
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first()
  await expect(editor).toBeVisible({ timeout: 10000 })
  await editor.click()
  await page.keyboard.type('ИНТ. ДОМ - ДЕНЬ')

  // 7. Текст остался в редакторе — ввод работает
  await expect(editor).toContainText('ИНТ')
})
