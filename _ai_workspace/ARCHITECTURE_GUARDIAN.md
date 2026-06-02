# 🏗️ СТРАЖ АРХИТЕКТУРЫ КиноПлан

## ⚠️ ПРИНЦИПЫ (нельзя нарушать!)

### 1. Local-First / Offline-First
- ✅ Всё работает без интернета
- ❌ Никакой облачной синхронизации по умолчанию
- ❌ Никаких API-вызовов без явного разрешения

### 2. Cross-Platform
- ✅ Один код для Desktop (Electron) и Mobile (Capacitor)
- ✅ Проверять на двух платформах перед коммитом
- ❌ Платформенно-специфичный код без fallback

### 3. Чистая архитектура
- ✅ Zustand для состояния
- ✅ Репозитории для работы с данными
- ❌ Прямой доступ к SQLite из React

## 🔍 ЧЕКЛИСТ ПРОВЕРКИ (каждый коммит)

### При добавлении фичи:
- [ ] Работает ли оффлайн?
- [ ] Проверено на мобильном viewport?
- [ ] Есть ли обработка ошибок?
- [ ] Создаёт ли это технический долг?

### При изменении UI:
- [ ] Соответствует ли дизайн-системе?
- [ ] Работает ли на мобильных?
- [ ] Нет ли дублирования кода?

### При добавлении модуля:
- [ ] Есть ли чёткая зона ответственности?
- [ ] Не пересекается ли с другими модулями?
- [ ] Документирована ли архитектура?

## 🚨 ТРЕВОЖНЫЕ СИГНАЛЫ

Если вижу это — СТОП и обсудить:
1. `fetch()` без проверки online
2. `localStorage` для больших данных
3. Синхронные операции >100мс
4. Дублирование state между компонентами
5. Прямые запросы к SQLite из UI

## ✅ ЭТАП 1: ИТОГИ (02.06.2026)

**Новая архитектура данных:**

| Слой | Что делает | Файл |
|------|-----------|-------|
| **Normalized Store** | Zustand + Immer, `Record<string, Project>`, `Record<string, Scene>`, persist | `src/store/useProjectStore.ts` |
| **Project Service** | Async CRUD методы, mock-задержка 100мс, try/catch/finally, setError/setLoading | `src/services/projectService.ts` |
| **Legacy Adapter** | Читает старый `kinoplan-projects`, нормализует, пишет в новый стор, удаляет старый ключ | `src/utils/migrateLegacyData.ts` |
| **Tiptap Flow** | Источник истины для сцен во время редактирования, `onScenesChange` → локальный state | `ScriptPage.tsx` |
| **Batch Save** | Кнопка "Сохранить" → `saveScenesBatch(projectId, scenes[])` → нормализованный стор | `projectService.saveScenesBatch()` |

**Мигрированные компоненты:**
- `HomePage.tsx` — использует `useNormalizedProjectStore` + `projectService`
- `CreateProjectModal.tsx` — `onCreate: Partial<Project> => Promise<void>`
- `ScriptPage.tsx` — кнопка "Сохранить" без `alert`, показывает "Сохранение..."
- `ProjectLayout.tsx` — синхронизирует `currentProjectId` в новый стор

**Deprecated:**
- `src/store/projectStore.ts` — ещё нужен для `currentProjectId` на других страницах, полное удаление после Этапа 2

**Следующий шаг:** Этап 2 (Безопасность и стабильность) — Задача 2.1 (Экспорт/Импорт JSON)

---

## 📝 ЛОГ АРХИТЕКТУРНЫХ РЕШЕНИЙ

| Дата | Решение | Причина | Статус |
|------|---------|---------|--------|
| 01.06.2026 | Tiptap для редактора | Проверенная архитектура, drag&drop | ✅ |
| 01.06.2026 | Russian/Hollywood форматы | Стандарты КИТ и WGA | ✅ |
| 02.06.2026 | Нормализованный стор useProjectStore.ts | Подготовка к синхронизации, эффективные обновления по ID | ✅ |

---

## 📐 Нормализованный стор (Task 1.1, 02.06.2026)

**Файл:** `src/store/useProjectStore.ts`  
**Экспорт:** `useNormalizedProjectStore`  
**Старый стор:** `src/store/projectStore.ts` → `useProjectStore` — не трогать до задач 1.3-1.4

### Структура состояния
```typescript
{
  projects: Record<string, Project>  // словарь по ID, не массив
  scenes: Record<string, Scene>      // словарь по ID, не массив
  isLoading: boolean
  error: string | null
}
```

### Actions
| Action | Описание |
|--------|----------|
| `setProjects(projects[])` | Нормализует массив → `Record<string, Project>` |
| `updateScene(id, updates)` | Обновляет сцену по ID через Immer (без мутации) |
| `revertScene(id)` | Откат сцены при ошибке сохранения (TODO: Этап 2) |
| `setError(msg\|null)` | Устанавливает/сбрасывает ошибку |
| `setLoading(bool)` | Устанавливает флаг загрузки |

### Правила использования
- Компоненты читают данные ТОЛЬКО из стора
- Мутации данных ТОЛЬКО через сервис (`projectService.ts`, Task 1.2)
- Не использовать `projects` как массив — всегда `Object.values(projects)`

---

## 🎬 Tiptap / ScriptPage — архитектура сохранения (Task 1.4, 02.06.2026)

**Принцип:** Tiptap остаётся **источником истины** для массива сцен во время редактирования. Нормализованный стор — только для персистентного снапшота.

| Слой | Что делает |
|------|-----------|
| Tiptap editor | Хранит сцены в реальном времени, отдаёт через `onScenesChange` |
| `ScriptPage.useState` | Локальный state сцен для навигатора и шапки |
| `projectService.saveScenesBatch()` | Вызывается по кнопке "Сохранить" — пакетно пишет в стор |
| `useNormalizedProjectStore.scenes` | Персистентный снапшот — последнее сохранённое состояние |

**❌ Антипаттерн:** вызывать `updateScene` / `saveScenesBatch` при каждом тике `onScenesChange` — это 100+ вызовов/мин.  
**✅ Правило:** сохранять только по явному действию пользователя или через debounce ≥1000мс (реализуется в Task 2.4).

---

## ⚠️ Deprecated: старый projectStore.ts (Task 1.3, 02.06.2026)

`src/store/projectStore.ts` → `useProjectStore` — **устарел**, но ещё не удалён.

**Причина сохранения:** другие страницы (`DashboardPage`, `ScriptPage` и др.) читают из него `currentProjectId`, `getCurrentProject()`. Полное удаление — после завершения задачи 1.4.

**Что можно:** читать `currentProjectId`, `setCurrentProject`  
**Что нельзя:** писать новые проекты через `addProject` — только через `projectService.createProject()`

## 🔄 migrateLegacyData (Task 1.3, 02.06.2026)

**Файл:** `src/utils/migrateLegacyData.ts`  
**Вызывается:** в `App.tsx` через `useEffect([], [])` — один раз при старте  
**Логика:**
1. Проверяет флаг `kinoplan-legacy-migrated` — если уже выполнено, пропускает
2. Читает старый ключ `kinoplan-projects` из localStorage
3. Нормализует массив `Project[]` → `Record<string, Project>` через `setProjects()`
4. Удаляет старый ключ, устанавливает флаг миграции
