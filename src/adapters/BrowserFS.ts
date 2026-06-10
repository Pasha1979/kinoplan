import type { FileSystemAdapter } from './FileSystemAdapter'

class BrowserFS implements FileSystemAdapter {
  async readData(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  async writeData(key: string, data: string): Promise<void> {
    try {
      localStorage.setItem(key, data)
    } catch (error) {
      console.error('Failed to write to localStorage:', error)
      throw new Error('Не удалось сохранить данные в localStorage', { cause: error })
    }
  }

  async downloadFile(filename: string, content: string, mimeType: string): Promise<void> {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    try {
      a.click()
    } finally {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  async uploadFile(acceptMime: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = acceptMime
      input.style.display = 'none'

      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) {
          reject(new Error('Файл не выбран'))
          return
        }

        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
        reader.readAsText(file)
      }

      document.body.appendChild(input)
      input.click()
      document.body.removeChild(input)
    })
  }
}

export const browserFS = new BrowserFS()
