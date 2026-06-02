export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function safeGetLocalStorage(key: string): string | null {
  if (!isBrowser()) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSetLocalStorage(key: string, value: string): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(key, value)
  } catch {
    // Игнорируем ошибки записи в localStorage
  }
}

export function safeRemoveLocalStorage(key: string): void {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(key)
  } catch {
    // Игнорируем ошибки удаления из localStorage
  }
}

export function safeGetWindow(): Window | null {
  return isBrowser() ? window : null
}

export function safeGetDocument(): Document | null {
  return isBrowser() ? document : null
}
