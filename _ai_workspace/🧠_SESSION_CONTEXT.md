# 🧠 Session Context — 2026-01-19

## Что сделано в этой сессии
- Умная нумерация с литерами (1-9-А → 1-6-А, каскад Б→А): sceneNumbering.ts + tests
- Навигатор-подтверждение undo + deep-copy снимка + onBeforeSceneReorder мост (pushUndo)
- Валидация: скобки в имени персонажа (ОРТЕГА (ЗА КАДРОМ)) не ошибка
- ПКМ по проблеме валидации → попап «было→станет» + Исправить (onApplyFix реально правит)
- Синонимы локаций: НАТ — КАНОНИЧЕСКОЕ обозначение; ЭКСТ → авто-фикс в НАТ; обновлены все паттерны (sceneExtractor, smartFormat, parseScreenplayText, pasteSanitizer, FormatAssistant, ScriptRightPanel)
- «Исправить все (N)» кнопка в валидации
- «Пропустить» проблему: X на строке + кнопка в попапе, persisted в script.dismissedIssues
- Статистика: режим «Настроить» — свободное перемещение/resize блоков (LayoutBox handles), persist localStorage 'statsLayout_dev', кнопка «Экспорт» JSON → APPLIED_LAYOUT дефолт. Две итерации применены.
- Карточки: модал деталя — встроенный просмотр сцены → потом встроенный РЕДАКТОР (Tiptap, тулбар B/I/U/S, Аа/АА/аа, авто-формат wand, save) + onSaveSceneHtml splice в контент скрипта

## Активная задача
Вкладка «Разработка» — обсуждаем макет:
- 4 под-вкладки: Персонажи (Библия), Локации, Синопсис, Посерийник (заглушка — отдельный заход)
- Данные на уровне ПРОЕКТА (персонаж общий на сериал); персонажи «на серию» — возможно тег episode
- Ручной ввод + авто-импорт из текста (cast/dialogCharacters, локации из шапок)
- Фирменный стиль: тёмные карточки + оранжевые акценты, мини-вкладки как в правой панели
- Сейчас вкладка — заглушка «В разработке» в ScriptPage (~line 612)

## Файлы
- src/store/scriptStore.ts — Character{id,projectId,name,description?,sceneCount} + characters на Script; Script.dismissedIssues добавлено
- src/pages/Script/components/SceneDetailModal.tsx — встроенный SceneTextEditor (тулбар + autoFix + save)
- src/pages/Script/components/ScriptRightPanel.tsx — попап fix, dismiss, fix-all, LOCATION_SYNONYMS (ЭКСТ→НАТ)
- src/pages/Script/components/StatisticsView.tsx — editMode LayoutBox + exportLayout + APPLIED_LAYOUT v2
- src/pages/Script/components/CardsView.tsx — contentsByEpisode, onSaveSceneHtml props
- src/pages/Script/ScriptPage.tsx — handleSaveSceneHtml, handleDismissIssue, contentByEp

## Сервера
- dev: http://localhost:5173 · prod: https://kinoplan.vercel.app
- git push → GitHub auto-deploy

## Уроки
- useMemo/hooks НЕЛЬЗЯ в JSX-ternary — выносить наверх
- structuredClone для снимков undo (не ссылки)
- Навигатор-reorder раньше обходил undo-стек — теперь onBeforeSceneReorder мост
