import { test, expect, type Page } from '@playwright/test'

// Контекстная справка: открытие, Escape, фильтрация по странице, поиск, Разбивка

const dialog = (page: Page) => page.getByRole('dialog')

async function createProjectAndOpenScript(page: Page) {
  await page.goto('/')
  const newBtn = page.getByText('Новый проект').or(page.getByText('Создать первый проект'))
  await expect(newBtn.first()).toBeVisible()
  await newBtn.first().click()
  await page.getByPlaceholder(/Например/).fill(`E2E Help ${Date.now()}`)
  await page.getByRole('button', { name: 'Создать проект' }).click()
  await page.waitForURL(/\/project\//)
  await page.waitForTimeout(600)
  await page.getByText('Сценарий', { exact: false }).first().click()
  await page.waitForURL(/\/script/)
  await page.getByText('Написать с нуля').click()
  await page.getByRole('button', { name: 'Создать сценарий' }).click()
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 10000 })
}

test.describe('контекстная справка', () => {
  test('Главная: кнопка и F1 открывают, Escape закрывает', async ({ page }) => {
    await page.goto('/')
    await page.locator('[title="Помощь (F1)"]').click()
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toHaveAttribute('aria-label', 'Помощь · Главная')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)

    await page.keyboard.press('F1')
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toHaveAttribute('aria-label', 'Помощь · Главная')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
  })

  test('Сценарий: F1 открывает справку текущей вкладки, Escape закрывает', async ({ page }) => {
    await createProjectAndOpenScript(page)
    await page.keyboard.press('F1')
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toHaveAttribute('aria-label', 'Помощь · Текст')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
  })

  test('Карточки: справка без клавиш редактора', async ({ page }) => {
    await createProjectAndOpenScript(page)
    await page.getByRole('button', { name: 'КАРТОЧКИ' }).click()
    await page.keyboard.press('F1')
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toHaveAttribute('aria-label', 'Помощь · Карточки')
    // вкладки «Клавиши и действия» нет (пустая секция скрыта), клавиш редактора нет
    await expect(dialog(page).getByText('Клавиши и действия')).toHaveCount(0)
    await expect(dialog(page).getByText('Ctrl+F')).toHaveCount(0)
    // контент карточек присутствует
    await dialog(page).getByText('Возможности').click()
    await expect(dialog(page).getByText('Папки-группы — сюжетные линии')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('поиск «закладк» находит результаты и переключает вкладку', async ({ page }) => {
    await createProjectAndOpenScript(page)
    await page.keyboard.press('F1')
    await expect(dialog(page)).toBeVisible()
    await dialog(page).getByPlaceholder('Поиск…').fill('закладк')
    // автопереключение на «Возможности» с результатами по закладкам
    await expect(dialog(page).getByText(/В закладку|закладк/i).first()).toBeVisible({ timeout: 3000 })
    // у вкладок видны счётчики совпадений
    await expect(dialog(page).getByText('Возможности')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Разбивка: справка непустая', async ({ page }) => {
    await createProjectAndOpenScript(page)
    await page.getByRole('button', { name: 'РАЗБИВКА' }).click()
    await page.keyboard.press('F1')
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toHaveAttribute('aria-label', 'Помощь · Разбивка')
    await dialog(page).getByText('Возможности').click()
    await expect(dialog(page).getByText('10 категорий элементов')).toBeVisible()
    await expect(dialog(page).getByText('Мостик в Разработку')).toBeVisible()
    await page.keyboard.press('Escape')
  })
})
