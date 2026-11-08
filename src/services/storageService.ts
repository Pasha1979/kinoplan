import PouchDB from 'pouchdb-browser'
import MemoryAdapter from 'pouchdb-adapter-memory'
import type { StateStorage } from 'zustand/middleware'

let db: PouchDB.Database | null = null

function getDb(): PouchDB.Database {
  if (!db) {
    if (typeof indexedDB === 'undefined') {
      PouchDB.plugin(MemoryAdapter)
      db = new PouchDB('kinoplan', { adapter: 'memory' })
    } else {
      db = new PouchDB('kinoplan')
    }
  }
  return db
}

interface StoreDoc {
  _id: string
  _rev?: string
  value: string
}

const writeQueue = new Map<string, Promise<void>>()

// Debounce записи: persist вызывается на каждый keystroke редактора,
// а сериализация всего состояния стоит сотни КБ — пишем в PouchDB
// не чаще чем раз в WRITE_DEBOUNCE_MS (trailing), окно потери при краше минимально
const WRITE_DEBOUNCE_MS = 400
const pendingWrites = new Map<string, string>()
const writeTimers = new Map<string, ReturnType<typeof setTimeout>>()

async function putDoc(name: string, value: string): Promise<void> {
  const prev = writeQueue.get(name) ?? Promise.resolve()
  const next = prev.catch(() => {}).then(async () => {
    const d = getDb()
    const doc = (await d.get(name).catch(() => null)) as StoreDoc | null
    await d.put({ _id: name, _rev: doc?._rev, value }).catch((e) => console.warn('storage write failed', name, e))
  })
  writeQueue.set(name, next)
  return next
}

function scheduleWrite(name: string): void {
  const prevTimer = writeTimers.get(name)
  if (prevTimer) clearTimeout(prevTimer)
  writeTimers.set(name, setTimeout(() => {
    writeTimers.delete(name)
    const value = pendingWrites.get(name)
    if (value !== undefined) {
      pendingWrites.delete(name)
      void putDoc(name, value)
    }
  }, WRITE_DEBOUNCE_MS))
}

// Flush при закрытии вкладки — не теряем последние символы
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const [name, timer] of writeTimers) {
      clearTimeout(timer)
      const value = pendingWrites.get(name)
      if (value !== undefined) {
        pendingWrites.delete(name)
        void putDoc(name, value)
      }
    }
    writeTimers.clear()
  })
}

export const pouchStorage: StateStorage = {
  getItem: async (name) => {
    // Незаписанные изменения важнее диска — read-after-write consistency
    const pending = pendingWrites.get(name)
    if (pending !== undefined) return pending
    try {
      const doc = (await getDb().get(name)) as StoreDoc
      return doc.value
    } catch {
      const legacy = localStorage.getItem(name)
      if (legacy) {
        putDoc(name, legacy).catch(() => {})
        return legacy
      }
      return null
    }
  },
  setItem: (name, value) => {
    pendingWrites.set(name, value)
    scheduleWrite(name)
    return Promise.resolve()
  },
  removeItem: async (name) => {
    pendingWrites.delete(name)
    const timer = writeTimers.get(name)
    if (timer) {
      clearTimeout(timer)
      writeTimers.delete(name)
    }
    try {
      const doc = (await getDb().get(name)) as StoreDoc
      if (doc._rev) await getDb().remove(name, doc._rev)
    } catch {
      // документа нет — удалять нечего
    }
  },
}
