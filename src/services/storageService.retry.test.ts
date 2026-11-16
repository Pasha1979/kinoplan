// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// put живёт на инстансе PouchDB, не на прототипе — мокаем весь класс
const fake = vi.hoisted(() => ({
  docs: new Map<string, { _id: string; _rev: string; value: string }>(),
  putCalls: 0,
  getCalls: 0,
  // 'ok' | 'fail' | кол-во первых попыток, которые упадут
  behavior: 'ok' as 'ok' | 'fail' | number,
  rev: 0,
}))

vi.mock('pouchdb-browser', () => {
  class FakePouchDB {
    static plugin() {}
    async get(id: string) {
      fake.getCalls++
      const d = fake.docs.get(id)
      if (!d) {
        const e = new Error('missing') as Error & { status: number }
        e.status = 404
        throw e
      }
      return d
    }
    async put(doc: { _id: string; _rev?: string; value: string }) {
      fake.putCalls++
      if (fake.behavior === 'fail') throw new Error('диск недоступен')
      if (typeof fake.behavior === 'number' && fake.putCalls <= fake.behavior) {
        throw new Error('временный сбой')
      }
      fake.rev++
      fake.docs.set(doc._id, { _id: doc._id, _rev: `r${fake.rev}`, value: doc.value })
      return { ok: true }
    }
    async remove(id: string) {
      fake.docs.delete(id)
      return { ok: true }
    }
  }
  return { default: FakePouchDB }
})

import { pouchStorage, flushWrites } from './storageService'
import { useToastStore } from '../store/toastStore'

beforeEach(() => {
  fake.docs.clear()
  fake.putCalls = 0
  fake.getCalls = 0
  fake.behavior = 'ok'
  fake.rev = 0
})

describe('putDoc ретраи (B7)', () => {
  it('2 сбоя подряд → ретрай → запись успешна', async () => {
    fake.behavior = 2 // первые 2 put падают
    await pouchStorage.setItem('rt-ok', 'value')
    await flushWrites('rt-ok')
    expect(fake.putCalls).toBe(3) // 1 + 2 ретрая
    expect(await pouchStorage.getItem('rt-ok')).toBe('value')
  })

  it('постоянный сбой → ошибка всплывает после 4 попыток (1+3 ретрая) + toast', async () => {
    fake.behavior = 'fail'
    const toastSpy = vi.spyOn(useToastStore.getState(), 'showToast')
    await pouchStorage.setItem('rt-fail', 'value')
    // flushWrites реджектится после исчерпания ретраев (~1.5 сек backoff)
    await expect(flushWrites('rt-fail')).rejects.toThrow('диск недоступен')
    expect(fake.putCalls).toBe(4) // MAX_RETRIES=3 → 1+3 попытки
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Ошибка записи'), 'error')
    toastSpy.mockRestore()
  })

  it('после успешной записи getItem читает с «диска»', async () => {
    await pouchStorage.setItem('rt-read', 'v9')
    await flushWrites('rt-read')
    // getItem: pendingWrites пуст → идёт в fake.get
    expect(await pouchStorage.getItem('rt-read')).toBe('v9')
    expect(fake.getCalls).toBeGreaterThan(0)
  })
})
