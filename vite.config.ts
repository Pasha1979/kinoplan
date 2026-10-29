import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// DESKTOP READY: Конфигурация подготовлена для сборки под Electron/Tauri (base: './')
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    // Code-splitting: разделение на логические чанки
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunk: React и основные библиотеки
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor'
          }
          // Script editor chunk: Tiptap, ProseMirror
          if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) {
            return 'script-editor'
          }
          // Zustand store
          if (id.includes('node_modules/zustand') || id.includes('node_modules/immer')) {
            return 'store'
          }
          // UI библиотеки
          if (id.includes('node_modules/lucide-react')) {
            return 'ui'
          }
          // Preproduction pages
          if (id.includes('/src/pages/Preproduction/')) {
            return 'preproduction'
          }
          // Production и related
          if (id.includes('/src/pages/Production/') || id.includes('/src/pages/Callsheets/') || id.includes('/src/pages/Attendance/')) {
            return 'production'
          }
          // Отчёты и аналитика
          if (id.includes('/src/pages/Reports/') || id.includes('/src/pages/Analytics/')) {
            return 'reports'
          }
          // Кастинг и съёмочная группа
          if (id.includes('/src/pages/Casting/') || id.includes('/src/pages/Crew/')) {
            return 'casting'
          }
          // Schedule и planning
          if (id.includes('/src/pages/Schedule/')) {
            return 'schedule'
          }
          // Utility pages
          if (id.includes('/src/pages/Settings/') || id.includes('/src/pages/Files/') || id.includes('/src/pages/Tags/') || id.includes('/src/pages/Changelog/') || id.includes('/src/pages/Dood/')) {
            return 'utility'
          }
        },
      },
    },
    // Увеличим лимит warning для chunk size (временно, пока не оптимизируем)
    chunkSizeWarningLimit: 600,
  },
})
