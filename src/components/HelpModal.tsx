import { LayoutGrid, Keyboard, Lightbulb, Info } from 'lucide-react'
import HelpModalBase, { KeyBadge } from './HelpModalBase'
import type { HelpColors } from './HelpModalBase'
import { getPageHelp } from '../help'
import { PAGE_LABELS } from '../help/types'
import type { HelpItem, HelpActionGroup, HelpTipGroup, HelpBlockType, PageHelp } from '../help/types'
import { filterByQuery } from '../help/search'

interface HelpModalProps {
  isDark: boolean
  onClose: () => void
  /** страница, по которой показываем справку */
  pageId: string
  /** якорь deep-link (openHelp) — открыть на вкладке элемента и подсветить */
  anchor?: string
}

const TAB_DEFS = [
  { id: 'overview',  label: 'Обзор',               icon: <LayoutGrid size={14} /> },
  { id: 'actions',   label: 'Клавиши и действия',  icon: <Keyboard size={14} /> },
  { id: 'features',  label: 'Возможности',         icon: <Lightbulb size={14} /> },
  { id: 'notes',     label: 'Нюансы',              icon: <Info size={14} /> },
]

function ItemCard({ item, c }: { item: HelpItem; c: HelpColors }) {
  return (
    <div
      data-help-anchor={item.anchor}
      style={{ background: c.bgSecondary, borderRadius: 10, border: `1px solid ${c.border}`, padding: '13px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>{item.title}</div>
      <div style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.65 }}>{item.body}</div>
      {item.details && item.details.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12, color: '#818cf8', cursor: 'pointer' }}>Подробности</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {item.details.map((d, i) => (
              <li key={i} style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.7 }}>{d}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function BlockTypesTable({ types, c, isDark }: { types: HelpBlockType[]; c: HelpColors; isDark: boolean }) {
  return (
    <div style={{ background: c.bgSecondary, borderRadius: 10, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '130px 60px 1fr', gap: 0, padding: '7px 14px', borderBottom: `1px solid ${c.border}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: c.textMuted }}>Тип блока</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: c.textMuted }}>Tab</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: c.textMuted }}>Пример</span>
      </div>
      {types.map((bt, i) => (
        <div
          key={i}
          style={{
            display: 'grid', gridTemplateColumns: '130px 60px 1fr', gap: 0, padding: '10px 14px',
            borderBottom: i < types.length - 1 ? `1px solid ${c.border}` : 'none', alignItems: 'start',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: bt.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary }}>{bt.name}</span>
          </div>
          <span style={{ fontSize: 11, color: c.textMuted, fontFamily: 'ui-monospace, monospace' }}>{bt.shortcut}</span>
          <div>
            <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: bt.color, marginBottom: 3 }}>{bt.example}</div>
            <div style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.5 }}>{bt.auto}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ActionGroupView({ g, c, q }: { g: HelpActionGroup; c: HelpColors; q: string }) {
  const items = filterByQuery(g.items, q, (i) => [i.label, i.result, (i.keys || []).join(' '), i.note, g.group])
  if (!items.length) return null
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: c.textMuted, marginBottom: 10 }}>
        {g.group}
      </div>
      <div style={{ background: c.bgSecondary, borderRadius: 10, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <div
            key={i}
            data-help-anchor={item.anchor}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px',
              borderBottom: i < items.length - 1 ? `1px solid ${c.border}` : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <span style={{ fontSize: 13, color: c.textPrimary }}>{item.label}</span>
              {item.note && (
                <span style={{ fontSize: 10, color: g.color || c.textMuted, background: g.color ? `${g.color}22` : 'transparent', border: g.color ? `1px solid ${g.color}55` : 'none', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>{item.note}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, marginLeft: 16 }}>
              {item.keys
                ? item.keys.map((k, ki) => (
                    <span key={ki} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <KeyBadge k={k} />
                      {ki < item.keys!.length - 1 && <span style={{ fontSize: 10, color: c.textMuted }}>+</span>}
                    </span>
                  ))
                : <span style={{ fontSize: 12, color: c.textMuted, textAlign: 'right' }}>{item.result}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeatureGroupView({ g, c, q }: { g: HelpTipGroup; c: HelpColors; q: string }) {
  const items = filterByQuery(g.items, q, (i) => [i.title, i.body, g.group, ...(i.details ?? [])])
  if (!items.length) return null
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: g.color || c.textMuted, marginTop: 6, marginBottom: 10 }}>
        {g.group}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => <ItemCard key={i} item={item} c={c} />)}
      </div>
    </div>
  )
}

function countIn(page: PageHelp, tabId: string, q: string): number {
  const fq = <T,>(arr: T[], texts: (i: T) => (string | undefined)[]) => filterByQuery(arr, q, texts).length
  if (tabId === 'overview') return fq(page.overview, (i) => [i.title, i.body, ...(i.details ?? [])])
  if (tabId === 'actions') return page.actions.reduce((n, g) => n + fq(g.items, (i) => [i.label, i.result, (i.keys || []).join(' '), i.note, g.group]), 0)
  if (tabId === 'features') {
    return page.features.reduce((n, g) => n + fq(g.items, (i) => [i.title, i.body, g.group, ...(i.details ?? [])]), 0)
      + fq(page.blockTypes || [], (b) => [b.name, b.example, b.auto])
  }
  if (tabId === 'notes') return fq(page.notes, (i) => [i.title, i.body, ...(i.details ?? [])])
  return 0
}

/** Вкладка, в которой лежит якорь — для deep-link */
function tabOfAnchor(page: PageHelp, anchor: string): string | undefined {
  if (page.overview.some((i) => i.anchor === anchor)) return 'overview'
  if (page.actions.some((g) => g.items.some((i) => i.anchor === anchor))) return 'actions'
  if (page.features.some((g) => g.items.some((i) => i.anchor === anchor))) return 'features'
  if (page.notes.some((i) => i.anchor === anchor)) return 'notes'
  return undefined
}

export default function HelpModal({ isDark, onClose, pageId, anchor }: HelpModalProps) {
  const page = getPageHelp(pageId)
  // Вкладка с пустой секцией скрывается; «Обзор» есть всегда
  const tabs = TAB_DEFS.filter((t) =>
    t.id === 'overview' ? page.overview.length > 0 : countIn(page, t.id, '') > 0)
  const anchorTab = anchor ? tabOfAnchor(page, anchor) : undefined

  const renderTab = (tabId: string, c: HelpColors, q: string) => {
    if (tabId === 'actions') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {page.actions.map((g) => <ActionGroupView key={g.group} g={g} c={c} q={q} />)}
        </div>
      )
    }
    if (tabId === 'features') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {page.blockTypes && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: c.textMuted, marginTop: 6, marginBottom: 10 }}>
                Типы блоков
              </div>
              <BlockTypesTable types={page.blockTypes} c={c} isDark={isDark} />
            </div>
          )}
          {page.features.map((g) => <FeatureGroupView key={g.group} g={g} c={c} q={q} />)}
        </div>
      )
    }
    const items = tabId === 'notes' ? page.notes : page.overview
    const visible = filterByQuery(items, q, (i) => [i.title, i.body, ...(i.details ?? [])])
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((item, i) => <ItemCard key={i} item={item} c={c} />)}
      </div>
    )
  }

  return (
    <HelpModalBase
      isDark={isDark}
      title={`Помощь · ${PAGE_LABELS[page.pageId]}`}
      tabs={tabs}
      renderTab={renderTab}
      countMatches={(tabId, q) => countIn(page, tabId, q)}
      memoryKey={page.pageId}
      defaultTab={anchorTab}
      anchor={anchorTab ? anchor : undefined}
      onClose={onClose}
    />
  )
}
           
