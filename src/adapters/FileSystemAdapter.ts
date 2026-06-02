export interface FileSystemAdapter {
  readData(key: string): Promise<string | null>
  writeData(key: string, data: string): Promise<void>
  downloadFile(filename: string, content: string, mimeType: string): Promise<void>
  uploadFile(acceptMime: string): Promise<string>
}
