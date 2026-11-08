import { test, expect } from '@playwright/test'

// SmartType-цепочка: 'ИН' → 'ИНТ.' → 'ДОМ' → 'ДОМ ДЕДА.' → попап подлокаций → 'ДОМ ДЕДА.СЕНИ'
test('двухуровневые подсказки локаций', async ({ page }) => {
  const projectName = `E2E SmartType ${Date.now()}`

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

  // Сцена 1: локация с подлокацией «ДОМ ДЕДА.СЕНИ»
  await page.keyboard.type('ИНТ. ДОМ ДЕДА.СЕНИ - ДЕНЬ')
  await page.keyboard.press('Enter')
  await page.keyboard.type('В комнате тихо.')
  await page.keyboard.press('Enter')

  // Сцена 2: та же локация, другая подлокация «ДОМ ДЕДА.КОМНАТА»
  await page.keyboard.type('ИНТ. ДОМ ДЕДА.КОМНАТА - НОЧЬ')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Свет горит.')
  await page.keyboard.press('Enter')

  // Ждём пока сцены попадут в стор (debounce) — локации уйдут в словарь SmartType
  await page.waitForTimeout(3000)

  // Сцена 3: печатаем префикс напрямую — авто-детекция сделает блок scene_header
  await page.keyboard.type('ИНТ. ')
  await page.waitForTimeout(500)

  // Печатаем 'ДОМ' → подсказка 'ДОМ ДЕДА'
  await page.keyboard.type('ДОМ')
  await page.waitForTimeout(500)
  await expect(page.getByText('ДОМ ДЕДА', { exact: true }).first()).toBeVisible()
  await page.keyboard.press('Enter') // → 'ДОМ ДЕДА.' + попап подлокаций
  await page.waitForTimeout(400)

  // Попап подлокаций: СЕНИ / КОМНАТА
  await expect(page.getByText('ДОМ ДЕДА.СЕНИ').first()).toBeVisible()
  await page.keyboard.press('Enter') // выбираем первую подлокацию
  await page.waitForTimeout(300)

  // В документе полная локация с подобъектом
  await expect(editor).toContainText('ДОМ ДЕДА.')
})
