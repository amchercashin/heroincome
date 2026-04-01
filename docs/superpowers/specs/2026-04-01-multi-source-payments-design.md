# Design: Multi-source payments — множественные источники выплат

## Контекст

MOEX ISS бесплатный эндпоинт `/securities/{secid}/dividends.json` системно неполный для акций: пропускает дивиденды (LKOH 397 руб. от 12.01.2026 отсутствует) и содержит "лишние" (GAZP — одобренные, но не выплаченные). Репо `heroincome-data` (парсинг dohod.ru) покрывает ~123 акции с историей до 26 лет и прогнозами.

Нужна архитектура, позволяющая приложению принимать данные о выплатах из нескольких источников с логикой приоритетов.

## Решения

- **Все источники пишут в `paymentHistory`** — каждая запись помечена `dataSource`. Ручные, dohod, MOEX — всё хранится в БД.
- **Reconciliation по приоритетам** — авторитетный источник определяется per-asset. Записи из менее приоритетных источников без пары по дате в авторитетном → `excluded: true`.
- **Прогнозы хранятся** — `isForecast: true`, не участвуют в расчётах дохода, показываются на графиках.
- **Приоритеты захардкожены** — настройка в UI отложена до появления третьего источника.

## Модель данных

### Расширение DataSource

```typescript
export type DataSource = 'moex' | 'dohod' | 'import' | 'manual';
```

Порядок приоритетов (захардкожен): `manual > dohod > moex > import`

### Расширение PaymentHistory

```typescript
export interface PaymentHistory {
  id?: number;
  assetId: number;
  amount: number;
  date: Date;
  type: 'dividend' | 'coupon' | 'rent' | 'interest' | 'distribution' | 'other';
  dataSource: DataSource;
  excluded?: boolean;
  isForecast?: boolean;  // true для прогнозных записей из dohod.ru
}
```

`isForecast` не индексируется. Версию Dexie-схемы не поднимаем.

### Приоритеты по типу актива

```typescript
const PAYMENT_SOURCE_PRIORITY: Record<string, DataSource[]> = {
  'Акции':     ['dohod', 'moex'],
  'Облигации': ['moex'],
  'Фонды':     ['moex'],
};
// manual всегда выше любого автоматического — обрабатывается отдельно
```

## Сервис heroincome-data

### Новый файл `src/services/heroincome-data.ts`

```typescript
const BASE_URL = 'https://raw.githubusercontent.com/amchercashin/heroincome-data/main/data';

interface DohodPayment {
  recordDate: string;    // "YYYY-MM-DD"
  declaredDate: string | null;
  amount: number | null;
  year: number | null;
  isForecast: boolean;
}

interface DohodTickerData {
  ticker: string;
  scrapedAt: string;
  source: string;
  payments: DohodPayment[];
}

interface DohodIndex {
  updatedAt: string;
  tickerCount: number;
  tickers: string[];
}
```

### API

```typescript
// Загружает index.json, кэширует на время sync-сессии (в памяти)
async function fetchDohodIndex(): Promise<DohodIndex | null>

// Проверяет есть ли тикер в индексе
async function isDohodAvailable(ticker: string): Promise<boolean>

// Загружает выплаты по тикеру
interface DohodDividendRow {
  date: Date;
  amount: number;
  isForecast: boolean;
}
async function fetchDohodDividends(ticker: string): Promise<DohodDividendRow[] | null>
```

### Кэширование

index.json кэшируется в module-level переменной на время одной sync-сессии. При каждом `syncAllAssets` кэш сбрасывается. Один GET-запрос на все тикеры.

### Маппинг тикеров

`heroincome-data` использует uppercase тикеры. В приложении `asset.ticker` / `asset.moexSecid` — тоже uppercase (из MOEX). Прямое совпадение, `ticker.toUpperCase()` для подстраховки.

### Обработка ошибок

- Сеть / 404 → `null`, sync продолжается с MOEX
- Один тикер не загрузился → warning в `SyncResult.warnings`
- Timeout 5 сек на запрос

## Reconciliation-логика

### Алгоритм `reconcilePayments(assetId, assetType)`

```
1. Загрузить все записи paymentHistory для assetId
2. Определить авторитетный источник по PAYMENT_SOURCE_PRIORITY[assetType]
   — первый источник из списка, у которого есть хотя бы одна non-forecast запись
3. Собрать authorityDates = Set<timestamp> дат из авторитетного источника
   (только isForecast !== true)
4. Для каждой записи из менее приоритетных автоматических источников:
   — если дата НЕ в authorityDates → excluded = true
   — если дата В authorityDates → excluded не трогаем
5. Ручные записи (dataSource: 'manual') → НИКОГДА не трогаем excluded
6. Записи авторитетного источника → excluded не трогаем
7. bulkUpdate изменённых записей
```

### Нюансы

- **Пользовательские excluded не трогаем.** Reconciliation управляет только записями из менее приоритетных источников.
- **Авто-excluded восстанавливаются.** Если запись из менее приоритетного источника ранее была авто-excluded, но теперь её дата появилась в авторитетном — `excluded` снимается (= false).
- **Прогнозы не участвуют в reconciliation.** `isForecast: true` не добавляются в `authorityDates`.

### Пример — Газпром

- dohod.ru: 2 факт-выплаты (2024-07-18, 2023-07-18)
- MOEX: 3 выплаты (2024-07-18, 2023-07-18, 2022-10-20 — одобрена, не выплачена)
- Авторитетный: dohod → authorityDates = {2024-07-18, 2023-07-18}
- MOEX 2022-10-20 → excluded = true
- MOEX 2024-07-18, 2023-07-18 → не трогаем

### Пример — бумага не на dohod.ru

- dohod: записей нет
- MOEX: 5 выплат
- Авторитетный: moex (fallback) → ничего не excluded

## Изменения в sync-потоке

### enrichStock — новый порядок

```
1. Записать цену (без изменений)
2. if pricesOnly → return

// Фаза загрузки — все источники пишут свои записи
3. isDohodAvailable(ticker) — проверка по кэшу
4. Если да → fetchDohodDividends(ticker)
   → writePaymentHistory(assetId, factRows, 'dividend', 'dohod')
   → writePaymentHistory(assetId, forecastRows, 'dividend', 'dohod', isForecast=true)
5. fetchDividends(secid) из MOEX ISS (как сейчас)
   → writePaymentHistory(assetId, history, 'dividend', 'moex')

// Фаза reconciliation
6. reconcilePayments(assetId, asset.type)

// Пересчёт частоты (из reconciled данных)
7. Загрузить dbRecords, отфильтровать excluded и isForecast
8. calcDividendFrequency → updateMoexAssetFields

// nextExpectedCutoffDate — из прогноза dohod или из MOEX
9. Ближайший forecast из dohod (если есть), иначе MOEX summary
```

### writePaymentHistory — параметризация

```typescript
async function writePaymentHistory(
  assetId: number,
  rows: DividendHistoryRow[],
  type: PaymentHistory['type'],
  dataSource: DataSource,        // вместо хардкода 'moex'
  isForecast?: boolean,          // для прогнозов dohod
): Promise<void>
```

Дедупликация: по `date + dataSource` в коде (загружаем все записи, фильтруем). Индекс `[assetId+date]` не меняем.

### syncAssetPayments

Аналогичные изменения — та же логика что enrichStock, для одиночной синхронизации из UI.

### enrichBond

Без изменений. Облигации: единственный источник MOEX, reconciliation не нужна.

### Параллельность

dohod и MOEX для одного актива загружаются параллельно (`Promise.all`). Записываются последовательно: dohod → MOEX → reconciliation.

### Порядок загрузки при sync-сессии

```
1. fetchDohodIndex()           — один раз, кэшируется
2. isDohodAvailable(ticker)    — по кэшу, мгновенно
3. fetchDohodDividends(ticker) — GET raw.githubusercontent.com
4. fetchDividends(secid)       — GET MOEX ISS
5. reconcilePayments(assetId)  — локально, Dexie
```

### Обработка ошибок heroincome-data

| Ситуация | Поведение |
|---|---|
| index.json не загрузился | Warning, sync только с MOEX |
| Тикер не загрузился | Warning, reconciliation только с MOEX |
| Тикера нет в индексе | Нормальный fallback на MOEX как авторитетный |
| Timeout | 5 сек, потом fallback |

## UI-изменения

### Бейджи источников (payment-row.tsx)

| dataSource | Бейдж | Цвет |
|---|---|---|
| `moex` | `moex` | зелёный: `bg-[#2d5a2d] text-[#6bba6b]` |
| `dohod` | `dohod` | синий: `bg-[#2d3d5a] text-[#6b9eba]` |
| `manual` | `ручной` | жёлтый: `bg-[#5a5a2d] text-[#baba6b]` |
| `import` | `импорт` | серый: `bg-[#3a3a3a] text-[#9a9a9a]` |

### Прогнозные записи (payment-row.tsx)

- Сниженная opacity (0.6) на дате и сумме
- Метка `прогноз` рядом с бейджем источника — `text-[length:var(--hi-text-micro)]`
- Кнопка исключения (⊘) не показывается — прогнозы не участвуют в расчётах

### График выплат (payment-history-chart.tsx)

- Прогнозы отображаются отдельным цветом/штриховкой
- В тултипе помечены как "прогноз"
- Не входят в total по году

### Excluded-записи

Без изменений — существующий UI (зачёркивание, opacity-50, кнопка восстановления) работает для авто-excluded записей из reconciliation.

## Миграция

- Все текущие записи `paymentHistory` имеют `dataSource: 'moex'`. После первой синхронизации reconciliation пометит "лишние" как excluded. Дополнительная миграция не нужна.
- `isForecast` — новое поле, существующие записи без него → `undefined` ≡ `false`.
- Версия Dexie-схемы не меняется.

## Тестирование

### Юнит-тесты

**`tests/services/heroincome-data.test.ts`:**
- Парсинг ответа: корректный JSON → `DohodDividendRow[]`
- Фильтрация: `amount: null` → пропускаются
- Разделение fact/forecast по `isForecast`
- Ошибки сети → `null`
- Кэширование index.json: второй вызов не делает fetch

**`tests/services/payment-reconciler.test.ts`:**
- dohod авторитетный, MOEX "лишняя" → excluded
- Fallback: dohod нет записей → MOEX авторитетный
- Ручные записи не трогаются
- Прогнозы не участвуют в authorityDates
- Бумага без dohod-покрытия → MOEX авторитетный

**`tests/services/moex-sync.test.ts` — расширить:**
- writePaymentHistory принимает dataSource параметр
- Дедупликация по date+dataSource

### Ручная верификация

1. Синхронизация LKOH → записи из обоих источников, MOEX-лишние excluded
2. Синхронизация актива без dohod-покрытия → MOEX без excluded
3. Облигация → без изменений
4. Прогнозы видны на графике, не входят в расчёт дохода

## За пределами этого проекта

- UI настройки приоритетов по типам активов (когда появится третий источник)
- Фонды (ПАРУС и др.) — нет бесплатного источника
- Прогнозный расчёт дохода на основе isForecast-записей
