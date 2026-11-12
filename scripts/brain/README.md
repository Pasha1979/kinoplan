# scripts/brain — механизмы Brain v4

| Команда | Что делает |
|---|---|
| `npm run brain:links` | Все md-ссылки резолвятся; падает при битых (архив не проверяется) |
| `npm run brain:status` | Генерирует `v4/02_СТАТУС.md` из git log + скана кода (заглушки, TODO) |
| `npm run brain:regs` | Каждая запись реестров `_extracted/` имеет резолвящийся источник |
| `npm run brain:check` | links + regs вместе |
| `scripts/check-architecture.ps1` | Запреты window/document/console/localStorage в store/services/hooks |

## Гейт изменений (вшит в 04_ПРАВИЛА):
`npm run build` + unit-тесты зелёные → `npm run brain:check` → commit → push → Vercel.
CI (GitHub Actions: lint+test+check-links) — предложено отдельно, не внедряется без команды.
