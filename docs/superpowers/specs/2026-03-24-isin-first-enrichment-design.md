# ISIN-First Enrichment: обогащение импорта данными MOEX

## Проблема

При импорте брокерского отчёта некоторые бумаги не распознаются парсером (пустая категория в отчёте Сбера) и попадают в тип "Прочее". Такие бумаги не синхронизируются с MOEX (`isSyncable()` требует тип Акции/Облигации/Фонды), хотя по ISIN их можно однозначно идентифицировать.

**Пример:** `RU000A10CFM8` — в отчёте Сбера нет ни тикера, ни категории. MOEX API по ISIN мог бы определить тип, тикер и название.

## Решение

Обогащение данных с MOEX **при импорте, до preview** — пользователь видит корректные типы и тикеры уже в предпросмотре.

**Принцип:** MOEX дополняет **только пустые** поля. Если брокерский отчёт уже дал тикер/тип/название — не перезаписывать.

## Архитектура

```
parse(html) → enrichFromMoex(rows) → goToPreview(enrichedRows) → apply → syncPayments
```

### 1. Новая функция `resolveSecurityFull()` в `src/services/moex-api.ts`

Расширенная версия `resolveSecurityInfo()` с дополнительными колонками:

```
GET /iss/securities.json?q={query}
  &securities.columns=secid,shortname,name,isin,primary_boardid,group,type,emitent_title,is_traded
  &iss.meta=off
```

**Интерфейс:**
```typescript
interface MoexSecurityFull {
  secid: string;           // GAZP, SU29010RMFS4
  primaryBoardId: string;  // TQBR, TQCB
  market: 'shares' | 'bonds';
  shortName?: string;      // Газпром
  fullName?: string;       // ПАО "Газпром"
  isin?: string;           // RU0007661625
  secType?: string;        // common_share, preferred_share, corporate_bond, exchange_bond, ...
  emitter?: string;        // ПАО "Газпром"
}
```

**Логика resolve:** та же что в `resolveSecurityInfo()` — exact secid match, fallback на first traded. `group` запрашивается и передаётся в `resolveMarket(boardId, group)` внутри функции (как в `resolveSecurityInfo`), но не выставляется в возвращаемый интерфейс.

**Маппинг `market` + `primaryBoardId` → тип актива:**
- `bonds` → "Облигации"
- `shares` + boardId in (TQTF, TQIF, TQPI) → "Фонды"
- `shares` (остальные) → "Акции"

**Если `resolveMarket()` вернул `null`** (неизвестный boardId/group) — `resolveSecurityFull()` возвращает `null`, и бумага остаётся необогащённой. Это отдельный сценарий от "MOEX API недоступен" — бумага найдена, но не поддерживается нашим маппингом. Поведение `enrichFromMoex()` одинаковое: оставить как есть.

Существующий `resolveSecurityInfo()` НЕ трогаем — он используется в sync pipeline.

### 2. Новый сервис `enrichFromMoex()` в `src/services/moex-enrich.ts`

```typescript
export async function enrichFromMoex(rows: ImportAssetRow[]): Promise<ImportAssetRow[]>
```

**Логика:**
1. Отфильтровать строки, нуждающиеся в обогащении:
   - Есть ISIN
   - И хотя бы одно из: тип "Прочее", нет тикера, имя совпадает с ISIN (парсер не дал имени)
2. Для каждой — `resolveSecurityFull(row.isin)`
3. Заполнить пустые поля:
   - `type` ← mapMoexToType(market, boardId) если тип "Прочее"
   - `ticker` ← secid если нет тикера или тикер === ISIN
   - `name` ← shortName если имя === ISIN (т.е. парсер не нашёл нормального имени)
   - `emitter` ← emitter если пусто
   - `faceValue` — не заполняем здесь (будет при sync через enrichBond)
   - `currency` — не заполняем (нет в search endpoint)
4. Запросы последовательно (без concurrency) — обычно 0-3 бумаги требуют обогащения
5. Если MOEX API недоступен, не нашёл бумагу, или вернул неизвестный board — оставить как есть (graceful degradation)

**Цена для облигаций:** Sber-парсер конвертирует цену облигации из % номинала в рубли только если знает что это облигация (`isBond`). Если парсер не определил тип (как `RU000A10CFM8`) — `currentPrice` содержит "сырой" процент (напр. 61.5 вместо 615₽). При обогащении `enrichFromMoex()` НЕ пересчитывает цену — это будет сделано при полном синке (`enrichBond()` в `moex-sync.ts`), который подтянет актуальную цену с MOEX. Таким образом, до первого синка `currentPrice` может быть некорректной для таких облигаций — это допустимо.

### 3. Интеграция в `src/components/data/import-flow.tsx`

**В `handleSberUpload()`:**
```typescript
const rows = parseSberHTML(html);
// ... name detection ...
setImportSource('sber_html');
const enriched = await enrichFromMoex(rows);  // ← NEW
await goToPreview(enriched);
```

**В `handleAiParse()`:**
```typescript
const rows = parseMDTable(aiText);
// ...
const enriched = await enrichFromMoex(rows);  // ← NEW
await goToPreview(enriched);
```

**UX:** Добавить индикатор "Определяю бумаги..." между парсингом и показом preview. При ошибке обогащения — fallback на необогащённые данные (graceful degradation).

## Что НЕ меняется

| Компонент | Почему не трогаем |
|-----------|-------------------|
| `resolveSecurityInfo()` | Используется в sync pipeline, менять рискованно |
| `resolveAndCache()` | Уже ISIN-first (moexSecid → isin → ticker) |
| `isSyncable()` | Обогащённые активы будут с правильным типом |
| `import-applier.ts` | Получает уже обогащённые rows |
| `import-diff.ts` | Уже ISIN-first matching |
| Схема БД | Новых полей нет |

## Тестирование

1. **Unit: `resolveSecurityFull()`** — мок MOEX API, проверить расширенные поля (по аналогии с `moex-api.test.ts`)
2. **Unit: `enrichFromMoex()`** — мок `resolveSecurityFull`:
   - Заполняет пустые поля
   - НЕ перезаписывает заполненные
   - Обрабатывает MOEX-not-found gracefully
   - Пропускает строки без ISIN
3. **Visual: импорт S0R9B** → `RU000A10CFM8` должен получить тип и тикер с MOEX, видно в preview
4. **Build:** `npm run build` + `npm run test`

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/services/moex-api.ts` | + `resolveSecurityFull()`, + `MoexSecurityFull` interface |
| `src/services/moex-enrich.ts` | NEW: `enrichFromMoex()`, маппинг market→type |
| `src/components/data/import-flow.tsx` | Вызов `enrichFromMoex()` перед preview, loading state |
| `tests/services/moex-api.test.ts` | + тесты `resolveSecurityFull()` |
| `tests/services/moex-enrich.test.ts` | NEW: тесты обогащения |
