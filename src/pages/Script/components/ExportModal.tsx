import { useMemo, useState } from 'react'
import { X, Download, FileText } from 'lucide-react'
import type { Script } from '../../../store/scriptStore'
import { buildPrintableHtml, buildScenesExportHtml, printHtmlAsPdf, wrapAsWordDoc } from '../../../utils/exportScenes'
import { browserFS } from '../../../adapters/BrowserFS'
import { useToastStore } from '../../../store/toastStore'

interface ExportModalProps {
  script: Script
  isDark: boolean
  onClose: () => void
}

/** T-61/T-63: выборочный экспорт сценария в .doc (Word-совместимый HTML) */
export default function ExportModal({ script, isDark, onClose }: ExportModalProps) {
  const scenes = useMemo(() => script.scenes ?? [], [script.scenes])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(scenes.map((s) => s.id)))
  const [exporting, setExporting] = useState(false)

  const cardBg = isDark ? '#1a1a2e' : '#ffffff'
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'
  const accent = '#6366f1'

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = scenes.length > 0 && selected.size === scenes.length
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(scenes.map((s) => s.id)))
  }

  const handlePrintPdf = () => {
    if (selected.size === 0) return
    const html = buildPrintableHtml(script, scenes, selected)
    printHtmlAsPdf(html)
  }

  const handleExport = async () => {
    if (exporting || selected.size === 0) return
    setExporting(true)
    try {
      const body = buildScenesExportHtml(script, scenes, selected)
      const doc = wrapAsWordDoc(body, script.title || 'Сценарий')
      const filename = `${(script.title || 'Сценарий').replace(/[\\/:*?"<>|]/g, '').trim() || 'scenariy'}.doc`
      await browserFS.downloadFile(filename, doc, 'application/msword')
      useToastStore.getState().showToast(`Экспортировано сцен: ${selected.size}`, 'success')
      onClose()
    } catch {
      useToastStore.getState().showToast('Не удалось экспортировать сценарий', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl flex flex-col"
        style={{ background: cardBg, border: `1px solid ${border}`, width: 420, maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: textPrimary }}>Экспорт в Word</div>
            <div className="text-[11px] mt-0.5" style={{ color: textSecondary }}>
              {script.title} · выбрано {selected.size} из {scenes.length} сцен
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: textSecondary }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-2" style={{ borderBottom: `1px solid ${border}` }}>
          <label className="flex items-center gap-2 py-1.5 cursor-pointer text-xs" style={{ color: textPrimary }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: accent }} />
            Все сцены
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {scenes.length === 0 && (
            <div className="py-6 text-center text-xs" style={{ color: textSecondary }}>Сцен нет — сначала напишите сценарий</div>
          )}
          {scenes.map((s) => (
            <label key={s.id} className="flex items-center gap-2 py-1.5 cursor-pointer text-xs" style={{ color: textPrimary }}>
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggle(s.id)}
                style={{ accentColor: accent }}
              />
              <span className="truncate">
                {s.number}. {s.type} {s.location}{s.time ? ` — ${s.time}` : ''}
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${border}` }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ color: textSecondary, border: `1px solid ${border}` }}
          >
            Отмена
          </button>
          <button
            onClick={handlePrintPdf}
            disabled={selected.size === 0}
            className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
            style={{
              color: selected.size === 0 ? textSecondary : textPrimary,
              border: `1px solid ${border}`,
            }}
          >
            <FileText size={13} />
            PDF
          </button>
          <button
            onClick={handleExport}
            disabled={selected.size === 0 || exporting}
            className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
            style={{
              background: selected.size === 0 ? (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb') : accent,
              color: selected.size === 0 ? textSecondary : '#fff',
              opacity: exporting ? 0.7 : 1,
            }}
          >
            <Download size={13} />
            {exporting ? 'Экспорт…' : `Экспорт .doc (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
