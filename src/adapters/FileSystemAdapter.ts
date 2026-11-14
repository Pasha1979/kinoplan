export interface FileSystemAdapter {
  readData(key: string): Promise<string | null>
  writeData(key: string, data: string): Promise<void>
  downloadFile(filename: string, content: string, mimeType: string): Promise<void>
  uploadFile(acceptMime: string): Promise<string>
  /** T-31: бинарная загрузка (DOCX и др.) — имя файла + содержимое */
  uploadFileBinary(acceptMime: string): Promise<{ name: string; buffer: ArrayBuffer }>
}
