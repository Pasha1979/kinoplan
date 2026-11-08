# 🎬 KinoPlan

**Local-first инструмент для сценаристов и кинопроизводства** — от сценария до съёмочного плана. Работает оффлайн, данные принадлежат пользователю.

> Демо: [kinoplan.vercel.app](https://kinoplan.vercel.app) (веб-версия, десктоп на Electron — в разработке)

## Модули

| Модуль | Статус | Что внутри |
|---|---|---|
| **HomePage** | ✅ | Проекты: вкладки, избранное, теги, dnd-порядок, режим макета |
| **Сценарий** | 🔨 | Редактор на Tiptap/ProseMirror: SmartType, авто-цепочка заголовок→состав→персонаж→реплика, навигатор сцен, валидация, титульный лист, статистика (метрики, тепловая карта, фильтр по серии) |
| Остальные (Кастинг, Расписание, Отчёты и др.) | 📋 | Каркас — по плану `_ai_workspace/ПЛАН_РАБОТ.md` |

## Стек

- **React 19 + TypeScript + Vite** — UI
- **Tiptap / ProseMirror** — сценарный редактор с кастомными типами блоков
- **Zustand + persist** — состояние и хранение (миграция на PouchDB в процессе)
- **PouchDB** — local-first персистентность + синхронизация
- **@dnd-kit** — drag-and-drop
- **Tailwind CSS v4** — стили
- **Vitest + Testing Library + Playwright** — тесты

## Запуск

```bash
npm install
npm run dev        # dev-сервер
npm run build      # продакшн-сборка
npm test           # юнит-тесты (Vitest)
npx playwright test  # E2E
```

## Архитектура

```
src/
├── pages/          # HomePage, Script (Сценарий), остальные модули
│   └── Script/     # ScriptPage + components/ + useScriptPageLogic
├── components/     # ScriptEditorView (Tiptap), TitlePageEditor, HelpModal…
├── store/          # Zustand-сторы: scriptStore, projectStore, uiStore, taskStore
├── hooks/          # useScriptEditorLogic, useScriptStats, useSceneEditorActions…
├── services/       # pageCounter, projectService (бизнес-логика вне React)
└── utils/          # sceneExtractor, scriptParser, sceneTiming, wordExport…
```

**Принципы:**
- **Local-first** — приложение работает без интернета; React не трогает БД напрямую (Electron — через IPC, сейчас — через сервисный слой).
- **Модуль до ума** — доводим подмодуль целиком, потом переходим к следующему.
- **Скоуп-правило** — меняем только то, над чем работаем, без глобальных правок.

## Документация для ИИ-ассистентов

Вся проектная память живёт в `_ai_workspace/`:

- `🧠_SESSION_CONTEXT.md` — контекст текущей сессии (автосохранение)
- `🧠_МОЗГ_ПРОЕКТА.md` — видение, история решений
- `📊_ТЕКУЩИЙ_СТАТУС.md` — что сделано / что дальше
- `ПЛАН_РАБОТ.md` — дорожная карта по фазам
- `LESSONS_LEARNED.md` — уроки и типичные ошибки
- `ARCHITECTURE_GUARDIAN.md` — архитектурные правила
