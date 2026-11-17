import { test, expect, type Page } from '@playwright/test'
import JSZip from 'jszip'
import { writeFileSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

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
  return page
}

async function createScript(page: Page) {
  await page.getByText('Написать с нуля').click()
  await page.getByRole('button', { name: 'Создать сценарий' }).click()
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first()
  await expect(editor).toBeVisible({ timeout: 10000 })
  return editor
}

// Минимальный валидный .docx (как в docxImportService.test.ts)
async function makeDocx(text: string): Promise<string> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)
  const paras = text.split('\n').map(l => `<w:p><w:r><w:t xml:space="preserve">${l}</w:t></w:r></w:p>`).join('')
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}</w:body></w:document>`)
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  const dir = mkdtempSync(join(tmpdir(), 'kinoplan-e2e-'))
  const path = join(dir, 'screenplay.docx')
  writeFileSync(path, buf)
  return path
}

// C1: round-trip — экспорт JSON → импорт → сцены и статусы идентичны
test('round-trip: экспорт → импорт проекта сохраняет контент и статусы', async ({ page }) => {
  const projectName = `E2E Round ${Date.now()}`
  const marker = `RT_${Date.now()}`

  await openFreshEditor(page, projectName)
  const editor = await createScript(page)
  await editor.click()
  await page.keyboard.type(`ИНТ. ${marker} - ДЕНЬ`)
  await page.waitForTimeout(1200)

  // Проставляем статус «Финал» через карточки
  await page.getByRole('button', { name: 'КАРТОЧКИ' }).click()
  const card = page.locator('[data-scene-id]').first()
  await expect(card).toBeVisible({ timeout: 10000 })
  await card.getByText('СТАТУС', { exact: true }).click()
  await page.getByRole('button', { name: 'Финал 100%' }).click()
  await expect(card.getByText('ФИНАЛ', { exact: true })).toBeVisible()
  await page.waitForTimeout(1200) // persist

  // Домой → контекстное меню проекта → Экспорт
  await page.goto('/')
  await page.waitForTimeout(800)
  const projectCard = page.getByText(projectName, { exact: false }).first()
  await expect(projectCard).toBeVisible()
  await projectCard.click({ button: 'right' })
  const downloadPromise = page.waitForEvent('download')
  await page.getByText('Экспорт', { exact: true }).click()
  const download = await downloadPromise
  const exported = await download.path()
  expect(exported).toBeTruthy()

  // Импортируем тот же файл — через кнопку Импорт в шапке
  const chooserPromise = page.waitForEvent('filechooser')
  await page.locator('button[title="Импорт проекта"]').click()
  const chooser = await chooserPromise
  await chooser.setFiles(exported!)
  await page.waitForURL(/\/project\//, { timeout: 10000 })
  await page.waitForTimeout(1200)

  // Открываем сценарий импортированного проекта
  await page.getByText('Сценарий', { exact: false }).first().click()
  await page.waitForURL(/\/script/)
  const editor2 = page.locator('.ProseMirror[contenteditable="true"]').first()
  await expect(editor2).toContainText(marker, { timeout: 10000 })

  // Статус «ФИНАЛ» пережил round-trip
  await page.getByRole('button', { name: 'КАРТОЧКИ' }).click()
  const card2 = page.locator('[data-scene-id]').first()
  await expect(card2.getByText('ФИНАЛ', { exact: true })).toBeVisible({ timeout: 10000 })
})

// C2: DOCX-импорт — валидный файл
test('DOCX-импорт: валидный файл → сцены в редакторе', async ({ page }) => {
  const docxPath = await makeDocx('1. ИНТ. ОФИС - ДЕНЬ\n\nИВАН\nПривет!\n\n2. ЭКСТ. УЛИЦА - НОЧЬ')
  await openFreshEditor(page, `E2E Docx ${Date.now()}`)

  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByText('Загрузить файл').click()
  const chooser = await chooserPromise
  await chooser.setFiles(docxPath)

  await expect(page.getByText(/Сценарий импортирован/)).toBeVisible({ timeout: 10000 })
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first()
  await expect(editor).toContainText('ОФИС', { timeout: 10000 })
  await expect(editor).toContainText('УЛИЦА')
})

// C3: DOCX-импорт — битый файл → тост, не краш
test('DOCX-импорт: битый файл → тост ошибки, приложение живо', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'kinoplan-e2e-'))
  const badPath = join(dir, 'broken.docx')
  writeFileSync(badPath, 'это не zip, а обычный текст')

  await openFreshEditor(page, `E2E DocxBad ${Date.now()}`)
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByText('Загрузить файл').click()
  const chooser = await chooserPromise
  await chooser.setFiles(badPath)

  await expect(page.getByText(/не .docx|не читается|Не удалось/)).toBeVisible({ timeout: 10000 })
  // Страница не упала — кнопка «Написать с нуля» на месте
  await expect(page.getByText('Написать с нуля')).toBeVisible()
})

// C4: титул — правка → печатный HTML (PDF-экспорт) содержит титульный лист.
// .doc-экспорт содержит только сцены — титул идёт через кнопку «PDF» (printHtmlAsPdf).
test('титул: правка титульной страницы → в печатном HTML есть название', async ({ page }) => {
  await openFreshEditor(page, `E2E Title ${Date.now()}`)
  const editor = await createScript(page)
  await editor.click()
  await page.keyboard.type('ИНТ. ДОМ - ДЕНЬ')
  await page.waitForTimeout(1200)

  // ТИТУЛ → название + включаем печать
  await page.getByRole('button', { name: 'ТИТУЛ' }).click()
  const titleInput = page.getByPlaceholder('Введите название')
  await expect(titleInput).toBeVisible({ timeout: 10000 })
  await titleInput.fill('МОЙ ФИЛЬМ-ТЕСТ')

  // Переключатель «Печатать» — включить если выключен
  const printToggle = page.getByText('Не печатать').or(page.getByText('Печатать'))
  if (await page.getByText('Не печатать').first().isVisible().catch(() => false)) {
    await page.getByText('Не печатать').first().click()
  }
  await page.waitForTimeout(1200)

  // Экспорт: кнопка в шапке → модалка → «PDF» → печатный iframe с титулом.
  // Подменяем contentWindow.print на созданных iframe, чтобы не висло окно печати.
  await page.evaluate(() => {
    const origDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')
    if (origDesc?.get) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get() {
          const w = origDesc.get!.call(this) as (Window & { __printPatched?: boolean }) | null
          if (w && !w.__printPatched) {
            w.__printPatched = true
            w.print = () => {}
          }
          return w
        },
        configurable: true,
      })
    }
  })

  await page.locator('button[title="Экспорт сценария в Word (.doc)"]').click()
  await expect(page.getByText('Экспорт в Word')).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'PDF' }).click()

  // iframe с печатным документом появляется в DOM
  const frame = page.locator('iframe').last()
  await expect(frame).toBeAttached({ timeout: 5000 })
  await page.waitForTimeout(500)
  const html = await page.evaluate(() => {
    const f = document.querySelectorAll('iframe')
    const last = f[f.length - 1]
    return last?.contentDocument?.documentElement?.innerHTML ?? ''
  })
  expect(html).toContain('МОЙ ФИЛЬМ-ТЕСТ')
})

// C5: бэкап — настройки → «Скачать» → файл скачивается
test('бэкап: настройки проекта → резервная копия скачивается', async ({ page }) => {
  const projectName = `E2E Backup ${Date.now()}`
  await openFreshEditor(page, projectName)
  await createScript(page)

  // Настройки — кнопка в боковом меню проекта
  await page.getByText('Настройки', { exact: false }).first().click()
  await page.waitForURL(/\/settings/, { timeout: 10000 }).catch(() => {})

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Скачать/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('backup')
  await expect(page.getByText('Резервная копия сохранена')).toBeVisible({ timeout: 5000 })
})
