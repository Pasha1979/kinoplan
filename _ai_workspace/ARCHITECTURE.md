# 🏗️ Архитектура KinoPlan

## Стек технологий
- **Фронтенд:** React + TypeScript + Vite
- **Бэкенд:** Electron (main process)
- **База данных:** SQLite (через better-sqlite3)
- **Синхронизация:** PouchDB ↔ CouchDB
- **Стилизация:** TailwindCSS или аналог

## Принципы архитектуры
1. **Local-First:** приложение работает оффлайн, синхронизируется при появлении сети
2. **Разделение слоёв:** React не обращается к SQLite напрямую
3. **IPC как мост:** всё общение между renderer и main через Electron IPC
4. **Типизация:** полная типизация через TypeScript
5. **Безопасность:** все обращения к window/document/localStorage через src/utils/env.ts
6. **Единый источник правды:** Zustand scriptStore хранит всё (текст + метаданные)
7. **Сериал = отдельные Script'ы:** каждая серия — свой Script с episodeNumber

## Модель данных (Script)
```
Script {
  id: string
  projectId: string
  content?: string        // ← полный HTML текста (Tiptap)
  scenes: Scene[]         // ← метаданные сцен
  episodeNumber?: number  // ← для сериалов: 1, 2, 3...
  timingSystem, genreCoefficient, format, ...
}
```
- Фильм: один Script (episodeNumber undefined)
- Сериал: N Script'ов (по одному на каждую серию)
- Переключение серии = смена currentScriptId → редактор размонтируется/пересоздаётся

## Структура IPC
- Все IPC-вызовы регистрируются в src/main/ipc/
- Прелоадер: src/preload/index.ts
- React использует только window.api.* (через env.ts)

## Запрещено
- ❌ Прямые запросы к SQLite из React
- ❌ Использование eval()
- ❌ Хранение секретов в коде (только через env)
- ❌ Облачные сервисы без оффлайн-режима
- ❌ localStorage для пользовательских данных (только Zustand persist)
