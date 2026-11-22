import { test, expect, type Page } from '@playwright/test'

// Аудит раскладки: на любом размере окна блоки не перекрываются, не уезжают за край
// и страница не получает горизонтального переполнения. Страницы-заглушки («скоро») входят —
// они дешёвые и ловят поломку общего каркаса (сайдбар/шапка).

const VIEWPORTS = [
  [500, 700], [800, 700], [1024, 768], [1920, 1080],
] as const

const PROJECT_ROUTES = [
  '', 'script', 'schedule', 'settings', 'locations', 'costumes', 'transport', 'props', 'sfx',
  'stunts', 'vfx', 'meetings', 'callsheets', 'casting', 'production', 'reports', 'attendance',
  'dood', 'crew', 'changelog', 'analytics', 'scheduleversions', 'tags', 'files',
]

const SCRIPT_TABS = ['ТЕКСТ', 'ТИТУЛ', 'РАЗБИВКА', 'КАРТОЧКИ', 'РАЗРАБОТКА', 'ПЛАН', 'СТАТИСТИКА']

/** Выполняется в браузере: возвращает список найденных дефектов раскладки */
function auditDom(): string[] {
  const issues: string[] = []
  const vw = document.documentElement.clientWidth
  const label = (e: Element) => {
    const t = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)
    const c = (e.getAttribute('class') || '').split(/\s+/).slice(0, 3).join('.')
    return `<${e.tagName.toLowerCase()}${c ? '.' + c : ''}>"${t}"`
  }
  const visible = (e: Element) => {
    const r = e.getBoundingClientRect()
    const cs = getComputedStyle(e)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
  }
  const clipsX = (e: Element) => /(auto|scroll|hidden|clip)/.test(getComputedStyle(e).overflowX)

  // 1. горизонтальное переполнение страницы
  if (document.documentElement.scrollWidth > vw + 1) {
    issues.push(`страница шире окна: ${document.documentElement.scrollWidth} > ${vw}`)
  }

  // 2. перекрытие соседних блоков в потоке (одного родителя)
  document.querySelectorAll('body *').forEach((parent) => {
    if (!visible(parent)) return
    if (parent instanceof SVGElement) return
    const kids = [...parent.children].filter((k) => {
      if (!visible(k)) return false
      const cs = getComputedStyle(k)
      if (['absolute', 'fixed', 'sticky'].includes(cs.position)) return false
      const r = k.getBoundingClientRect()
      return r.width >= 60 && r.height >= 24
    })
    if (kids.length < 2 || kids.length > 60) return
    const pcs = getComputedStyle(parent)
    // dnd/абсолютные доски, гриды с перекрытием по замыслу — пропускаем
    if (pcs.position === 'absolute' && pcs.display === 'block') return
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect()
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (ox > 6 && oy > 6) issues.push(`перекрытие ${label(kids[i])} × ${label(kids[j])} (${Math.round(ox)}×${Math.round(oy)})`)
    }
  })

  // 3. контент за правым краем окна, не обрезанный скролл-контейнером
  document.querySelectorAll('body *').forEach((e) => {
    if (!visible(e)) return
    const cs = getComputedStyle(e)
    if (cs.position === 'fixed') return
    const r = e.getBoundingClientRect()
    if (r.right <= vw + 2 || r.width < 20) return
    for (let p = e.parentElement; p; p = p.parentElement) {
      if (clipsX(p) && p.getBoundingClientRect().right <= vw + 2) return
    }
    issues.push(`за краем окна: ${label(e)} right=${Math.round(r.right)} > ${vw}`)
  })

  return [...new Set(issues)].slice(0, 10)
}

async function createProject(page: Page, name: string) {
  await page.goto('/')
  const newBtn = page.getByText('Новый проект').or(page.getByText('Создать первый проект'))
  await newBtn.first().click()
  await page.getByPlaceholder(/Например/).fill(name)
  await page.getByRole('button', { name: 'Создать проект' }).click()
  await page.waitForURL(/\/project\//)
  await page.waitForTimeout(1500) // debounce-запись PouchDB до следующей полной перезагрузки (T-228)
  return page.url().match(/\/project\/([^/]+)/)![1]
}

async function audit(page: Page, where: string, failures: string[], minWidth = 0) {
  for (const [w, h] of VIEWPORTS) {
    if (w < minWidth) continue
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(250)
    const issues = await page.evaluate(auditDom)
    if (issues.length) failures.push(`[${where} @${w}] ${issues.join(' ; ')}`)
  }
}

test('аудит раскладки: Главная (несколько карточек) на 500/800/1024/1920', async ({ page }) => {
  test.setTimeout(120000)
  page.setDefaultTimeout(15000)
  const failures: string[] = []
  for (const n of ['A', 'B', 'C', 'D', 'E']) await createProject(page, `Audit ${n} ${Date.now()}`)
  await page.goto('/')
  await page.waitForTimeout(800)
  await audit(page, 'Главная', failures)
  expect(failures, failures.join('\n')).toEqual([])
})

test('аудит раскладки: все страницы проекта и вкладки сценария', async ({ page }) => {
  test.setTimeout(300000)
  page.setDefaultTimeout(15000)
  const failures: string[] = []

  // Сценарий с данными, чтобы сабвкладки были не пустыми
  const idD = await createProject(page, `Audit D ${Date.now()}`)
  await page.waitForTimeout(800)
  await page.getByText('Сценарий', { exact: false }).first().click()
  await page.waitForURL(/\/script/)
  await page.getByText('Написать с нуля').click()
  await page.getByRole('button', { name: 'Создать сценарий' }).click()
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first()
  await expect(editor).toBeVisible({ timeout: 10000 })
  await editor.click()
  await page.evaluate(() => {
    const el = document.querySelector('.ProseMirror[contenteditable="true"]')
    const parts: string[] = []
    for (let i = 0; i < 12; i++) {
      parts.push(`${i + 1}. ${i % 2 ? 'НАТ' : 'ИНТ'}. ЛОКАЦИЯ ${i % 4}. ДЕНЬ ${Math.floor(i / 3) + 1}`, '', 'Действие сцены с героями.', '', 'ИВАН', 'Реплика.', '', 'МАША', 'Ответ.', '')
    }
    const dt = new DataTransfer()
    dt.setData('text/plain', parts.join('\n'))
    el?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await page.waitForTimeout(3500)
  for (const tab of SCRIPT_TABS) {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.getByText(tab, { exact: false }).first().click()
    await page.waitForTimeout(500)
    // лист сценария — A4 фиксированной ширины (WYSIWYG): на окне уже 800px он по замыслу скроллится
    await audit(page, `Сценарий/${tab}`, failures, tab === 'ТЕКСТ' ? 800 : 0)
  }

  for (const route of PROJECT_ROUTES) {
    if (route === 'script') continue
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`/project/${idD}/${route}`)
    await page.waitForTimeout(500)
    await audit(page, route || 'Обзор', failures)
  }

  console.log('LAYOUT-AUDIT дефектов:', failures.length)
  failures.forEach((f) => console.log(' • ' + f))
  expect(failures, failures.join('\n')).toEqual([])
})
