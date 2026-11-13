import PouchDB from 'pouchdb-browser'
import type { StateStorage } from 'zustand/middleware'
import { useToastStore } from '../store/toastStore'

let dbPromise: Promise<PouchDB.Database> | null = null

function getDb(): Promise<PouchDB.Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      if (typeof indexedDB === 'undefined') {
        // Memory-адаптер нужен только в тестах/node — грузим динамически,
        // чтобы его CJS-цепочка (memdown/levelup) не попадала в браузерный бандл
        const { default: MemoryAdapter } = await import('pouchdb-adapter-memory')
        PouchDB.plugin(MemoryAdapter)
        return new PouchDB('kinoplan', { adapter: 'memory' })
      }
      return new PouchDB('kinoplan')
    })()
  }
  return dbPromise
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
    const d = await getDb()
    const MAX_RETRIES = 3
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const doc = (await d.get(name).catch(() => null)) as StoreDoc | null
        await d.put({ _id: name, _rev: doc?._rev, value })
        return
      } catch (e) {
        if (attempt === MAX_RETRIES) {
          console.warn('storage write failed after retries', name, e)
          useToastStore.getState().showToast('Ошибка записи на диск — изменения могут не сохраниться', 'error')
          throw e
        }
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
      }
    }
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

// Форсировать все отложенные записи — при сворачивании/закрытии вкладки
function flushPendingWrites(): void {
  for (const [name, timer] of writeTimers) {
    clearTimeout(timer)
    const value = pendingWrites.get(name)
    if (value !== undefined) {
      pendingWrites.delete(name)
      void putDoc(name, value)
    }
  }
  writeTimers.clear()
}

if (typeof window !== 'undefined') {
  // Закрытие вкладки — не теряем последние символы
  window.addEventListener('beforeunload', flushPendingWrites)
  // Сворачивание/переключение вкладки — beforeunload может не случиться (мобильные браузеры, фон)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingWrites()
  })
}

/**
 * Дождаться реальной записи документа на диск — для честного статуса «Сохранено».
 * Форсирует отложенную debounce-запись и ждёт очередь.
 */
export async function flushWrites(name: string): Promise<void> {
  const timer = writeTimers.get(name)
  if (timer) {
    clearTimeout(timer)
    writeTimers.delete(name)
    const value = pendingWrites.get(name)
    if (value !== undefined) {
      pendingWrites.delete(name)
      await putDoc(name, value)
      return
    }
  }
  await (writeQueue.get(name) ?? Promise.resolve())
}

/**
 * T-35: контент сценария (тяжёлый HTML) живёт отдельными документами
 * script-content:{id}, чтобы persist не сериализовал мегабайты на каждый
 * keystroke. Пишется через тот же debounce/очередь, что и сторы.
 */
const scriptContentKey = (id: string) => `script-content:${id}`

export function saveScriptContent(id: string, html: string): void {
  void pouchStorage.setItem(scriptContentKey(id), JSON.stringify({ html }))
}

export async function loadScriptContent(id: string): Promise<string | null> {
  const raw = await pouchStorage.getItem(scriptContentKey(id))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { html?: unknown }
    return typeof parsed.html === 'string' ? parsed.html : null
  } catch {
    return raw
  }
}

export function removeScriptContent(id: string): void {
  void pouchStorage.removeItem(scriptContentKey(id))
}

export const pouchStorage: StateStorage = {
  getItem: async (name) => {
    // Незаписанные изменения важнее диска — read-after-write consistency
    const pending = pendingWrites.get(name)
    if (pending !== undefined) return pending
    try {
      const doc = (await (await getDb()).get(name)) as StoreDoc
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
    // Удаление ставим в ту же очередь, что и записи: in-flight putDoc
    // должен завершиться ДО удаления, иначе документ «воскреснет»
    const prev = writeQueue.get(name) ?? Promise.resolve()
    const next = prev.catch(() => {}).then(async () => {
      try {
        const doc = (await (await getDb()).get(name)) as StoreDoc
        if (doc._rev) await (await getDb()).remove(name, doc._rev)
      } catch {
        // документа нет — удалять нечего
      }
    })
    writeQueue.set(name, next)
    return next
  },
}
