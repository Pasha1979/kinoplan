import PouchDB from 'pouchdb'
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

export const pouchStorage: StateStorage = {
  getItem: async (name) => {
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
  setItem: (name, value) => putDoc(name, value),
  removeItem: async (name) => {
    try {
      const doc = (await getDb().get(name)) as StoreDoc
      if (doc._rev) await getDb().remove(name, doc._rev)
    } catch {
      // документа нет — удалять нечего
    }
  },
}
