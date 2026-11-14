import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { mammothHtmlToText, docxToScreenplayHtml, DocxImportError } from './docxImportService'

// Минимальный валидный .docx: [Content_Types].xml + _rels/.rels + word/document.xml
async function makeDocx(paragraphs: string[]): Promise<ArrayBuffer> {
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
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`)
    .join('')
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`)
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('mammothHtmlToText', () => {
  it('абзацы → строки, теги и сущности снимаются', () => {
    const html = '<p>ИНТ. ДОМ - ДЕНЬ.</p><p>&nbsp;</p><p>ИВАН</p><p>Привет, &laquo;мир&raquo;!</p>'
    const text = mammothHtmlToText(html)
    expect(text).toBe('ИНТ. ДОМ - ДЕНЬ.\n \nИВАН\nПривет, «мир»!\n')
  })

  it('br и заголовки тоже дают перенос строки', () => {
    expect(mammothHtmlToText('<p>а<br/>б</p>')).toBe('а\nб\n')
    expect(mammothHtmlToText('<h1>Заг</h1><p>текст</p>')).toBe('Заг\nтекст\n')
  })
})

describe('docxToScreenplayHtml (T-31)', () => {
  it('docx → блоки сценария: шапки, персонажи, реплики, ремарки', async () => {
    const buf = await makeDocx([
      '1. ИНТ. КВАРТИРА - ДЕНЬ.',
      'Иван сидит за столом.',
      'ИВАН',
      'Привет, Маша!',
      '',
      '2. ЭКСТ. УЛИЦА - НОЧЬ.',
      'Дождь.',
    ])
    const r = await docxToScreenplayHtml(buf)
    expect(r.blockCount).toBeGreaterThan(0)
    expect(r.html).toContain('data-type="scene-header"')
    expect(r.html).toContain('КВАРТИРА')
    expect(r.html).toContain('ИВАН')
    expect(r.html).toContain('Привет, Маша!')
    // две шапки сцен
    expect(r.html.match(/data-type="scene-header"/g)).toHaveLength(2)
  })

  it('пустой docx → ноль блоков', async () => {
    const buf = await makeDocx([])
    const r = await docxToScreenplayHtml(buf)
    expect(r.blockCount).toBe(0)
  })
})

describe('обработка ошибок (T-111)', () => {
  it('не-docx (текстовый файл, переименованный в .docx) → DocxImportError not-docx', async () => {
    const buf = new TextEncoder().encode('Это просто текст, а не zip-архив').buffer as ArrayBuffer
    await expect(docxToScreenplayHtml(buf)).rejects.toBeInstanceOf(DocxImportError)
    await expect(docxToScreenplayHtml(buf)).rejects.toMatchObject({ kind: 'not-docx' })
  })

  it('картинка/бинарь без ZIP-сигнатуры → not-docx, а не сырая ошибка mammoth', async () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer as ArrayBuffer // PNG-сигнатура
    await expect(docxToScreenplayHtml(buf)).rejects.toMatchObject({ kind: 'not-docx' })
  })

  it('пустой буфер → not-docx', async () => {
    await expect(docxToScreenplayHtml(new ArrayBuffer(0))).rejects.toMatchObject({ kind: 'not-docx' })
  })

  it('битый ZIP (сигнатура PK есть, структура мёртвая) → DocxImportError corrupt', async () => {
    const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff, 0xff, 0x00]).buffer as ArrayBuffer
    await expect(docxToScreenplayHtml(buf)).rejects.toBeInstanceOf(DocxImportError)
    await expect(docxToScreenplayHtml(buf)).rejects.toMatchObject({ kind: 'corrupt' })
  })

  it('усечённый настоящий docx → corrupt (не необработанное исключение)', async () => {
    const full = await makeDocx(['1. ИНТ. ДОМ - ДЕНЬ.'])
    const truncated = full.slice(0, Math.floor(full.byteLength / 2))
    await expect(docxToScreenplayHtml(truncated)).rejects.toMatchObject({ kind: 'corrupt' })
  })

  it('валидный docx после фиксов по-прежнему импортируется', async () => {
    const buf = await makeDocx(['1. ИНТ. ДОМ - ДЕНЬ.', 'Текст сцены.'])
    const r = await docxToScreenplayHtml(buf)
    expect(r.blockCount).toBeGreaterThan(0)
    expect(r.html).toContain('scene-header')
  })
})
