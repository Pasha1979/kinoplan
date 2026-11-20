# HANDOFF (автоген) · 2026-11-20 · `main` · ca771c9 chore(brain): sync — контекстная справка, 

Сделано:
- ca771c9 chore(brain): sync — контекстная справка, фаза 1 из 
- 9c67c6b feat(help): фаза 1 — единая механика справки
- 446a5bb Структурные операции и библия: нумерация согласована
- 292c4fe brain:sync — конец сессии (handoff под HEAD)

Дальше:
1. Закрыто: ре-сверка архива + мозг A–F, I-82→I-31
2. ✅ T-135 Орфография RU: spellcheck lang=ru, служебные блоки без проверк
3. T-136 Outline-режим «каркас сцен» в ТЕКСТ

Ждут решения: нет · Последнее решение: D-69 — Решения пользователя 17.11 в обсуждении Блока A

## ТОЧКА ПРОДОЛЖЕНИЯ
Задача: рефакторинг «Помощи» в контекстную справку (спека от пользователя, 4 фазы).
Сделано: ФАЗА 0 (аудит+T-222..225) и ФАЗА 1 (9c67c6b — механика HelpModalBase: Esc/фокус/скролл,
поиск в базе, HelpModal+HomeHelpModal на базе, F1, версия в футере, overflow вкладок; 614 unit/32 e2e зелёные).
ДАЛЕЕ — ФАЗА 2: единый «паспорт страницы». Создать src/help/types.ts + контент-файлы
home/text/title/breakdown/cards/development/plan/statistics.ts + index.ts (реестр pageId→контент).
4 вкладки у каждой страницы: «Обзор»/«Клавиши и действия»/«Возможности»/«Нюансы»; пустая секция
скрывается, «Обзор» всегда. У каждой подсказки pageId+группа; TAG_PAGES с fallback 'text' УДАЛИТЬ.
HelpModal принимает pageId (ScriptPage→activeTab, HomePage→'home'). Разложить ВСЕ подсказки без потерь:
HomeHelpModal (OVERVIEW/TABS_INFO/SEARCH_INFO/SORT_INFO/FILTERS_INFO/CARD_PARTS/MENU_INFO/ACTIONS/NOTES)
и HelpModal (SHORTCUTS/TIPS/BLOCK_TYPES). Заголовки «Помощь · Главная/Текст/…». Гейт→коммит.
Затем ФАЗА 3 (контент по коду: Разбивка, План, Dialogue/POV, docx, Ctrl+H, Shift+Enter, split-выбор серии,
Главная-дописки+исправления) и ФАЗА 4 (unit/RTL/e2e help.spec + правило R-91 + идеи).
