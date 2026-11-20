import { describe, it, expect } from 'vitest'
import { HELP_PAGES, getPageHelp } from './index'
import type { PageId } from './types'
import { TABS } from '../pages/Script/components/ScriptTabs'

const PAGE_IDS = Object.keys(HELP_PAGES) as PageId[]

describe('help registry — целостность контента', () => {
  it('каждая вкладка ScriptTabs есть в реестре страниц', () => {
    for (const tab of TABS) {
      expect(
        HELP_PAGES[tab.id as PageId],
        `нет паспорта справки для вкладки «${tab.id}»`,
      ).toBeDefined()
    }
  })

  it('pageId паспорта совпадает с ключом реестра', () => {
    for (const id of PAGE_IDS) {
      expect(HELP_PAGES[id].pageId).toBe(id)
    }
  })

  it('«Обзор» непуст у всех страниц', () => {
    for (const id of PAGE_IDS) {
      const p = HELP_PAGES[id]
      expect(p.overview.length, `«${id}» — пустой Обзор`).toBeGreaterThan(0)
      for (const item of p.overview) {
        expect(item.title.trim().length).toBeGreaterThan(0)
        expect(item.body.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('у каждой подсказки есть группа и непустой текст', () => {
    for (const id of PAGE_IDS) {
      const p = HELP_PAGES[id]
      for (const g of p.features) {
        expect(g.group.trim().length, `«${id}» — группа без имени`).toBeGreaterThan(0)
        for (const tip of g.items) {
          expect(tip.title.trim().length).toBeGreaterThan(0)
          expect(tip.body.trim().length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('у каждой группы действий есть имя и непустые подписи', () => {
    for (const id of PAGE_IDS) {
      for (const g of HELP_PAGES[id].actions) {
        expect(g.group.trim().length).toBeGreaterThan(0)
        expect(g.items.length).toBeGreaterThan(0)
        for (const a of g.items) {
          expect(a.label.trim().length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('Разбивка — минимум 3 подсказки и таблица действий', () => {
    const tips = HELP_PAGES.breakdown.features.reduce((n, g) => n + g.items.length, 0)
    expect(tips).toBeGreaterThanOrEqual(3)
    expect(HELP_PAGES.breakdown.actions.length).toBeGreaterThan(0)
  })

  it('getPageHelp отдаёт текст для неизвестного pageId', () => {
    expect(getPageHelp('unknown-page').pageId).toBe('text')
    expect(getPageHelp('breakdown').pageId).toBe('breakdown')
  })
})
