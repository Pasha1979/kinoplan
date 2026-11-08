# 🎬 KinoPlan

**Local-first платформа для сценаристов, режиссёров и продакшн-команд** — от идеи и сценария до календарно-постановочного плана и разбивки на кастинг, локации и реквизит.

Работает оффлайн. Данные хранятся локально, синхронизация — через PouchDB (планируется). Целевая сборка: **Electron-десктоп**, текущий runtime — веб-приложение на Vite + деплой на Vercel.

## Стек

| Технология | Зачем |
|---|---|
| React 19 + TypeScript | UI, строгая типизация |
| Vite | сборка и dev-server |
| Tailwind CSS v4 | стилизация, светлая/тёмная тема |
| Tiptap (ProseMirror) | сценарный редактор: блоки, SmartType, автодетекция |
| Zustand + persist | состояние; сейчас persist → localStorage, цель — SQLite/PouchDB |
| @dnd-kit | drag-and-drop (сцены, карточки проектов, макеты) |
| React Router | навигация между модулями |
| Vitest + Testing Library | юнит-тесты (16 файлов: сторы, парсеры, экстракторы) |
| lucide-react | иконки |

## Запуск

```bash
npm install
npm run dev        # dev-сервер
npm run build      # tsc -b && vite build
npm run test       # vitest run
npm run lint       # eslint
```

## Структура

```
src/
├── pages/          # модули: Home (проекты), Script (сценарий), и др.
│   ├── Home/       # дашборд проектов: карточки, теги, dnd, архив
│   └── Script/     # редактор сценария, статистика, навигатор сцен
├── store/          # Zustand-сторы: project, script, task, ui
├── hooks/          # useScriptStats, useScriptEditorLogic и др.
├── services/       # pageCounter, projectService, wordExport
└── utils/          # sceneExtractor, scriptParser, sceneTiming

_ai_workspace/      # «мозг» проекта для AI-ассистента:
                    # SESSION_CONTEXT, ПЛАН_РАБОТ, LESSONS_LEARNED и др.
```

## Архитектура

- **Local-first**: приложение работает оффлайн; React не обращается к БД напрямую — только через сервисный слой (в Electron — через IPC).
- **Сценарий** хранится как документ Tiptap; сцены извлекаются через `sceneExtractor` и агрегируются статистикой `useScriptStats`.
- **AI-workflow**: директория `_ai_workspace/` — память проекта (контекст сессии, план работ, уроки, архитектурный опекун), обновляется автоматически после задач.

## Модули (статус)

- ✅ **HomePage** — карточки проектов, теги, dnd-сортировка, архив, кастомный макет
- 🚧 **Сценарий** — редактор (блоки, SmartType, валидация, титульная страница), статистика (метрики, фильтр по серии, тепловая карта), в работе: структурные маркеры актов
- 📋 **Запланировано**: планирование, разбивка, кастинг, отчёты, экспорт PDF/FDX
