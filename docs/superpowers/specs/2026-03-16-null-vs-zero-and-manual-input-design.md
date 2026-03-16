# Null vs Zero семантика и ручной ввод выплат

## Проблема

1. **Скрытые поля ввода**: На странице актива (`asset-detail-page.tsx:57`) поля дивиденда/частоты показываются только если PaymentSchedule существует. Для фондов (и любого актива без schedule) пользователь не может ввести данные вручную.

2. **Неразличимость null и 0**: Повсюду используется `?? 0` fallback — нет способа отличить «данных нет» от «доход реально равен нулю». Это критично: фонд без данных по выплатам показывает «₽ 0», хотя корректно было бы показать прочерк.

## Затронутые места

| Файл | Строки | Проблема |
|---|---|---|
| `asset-detail-page.tsx` | 25-27 | `schedule ? calc : 0` — нет schedule = доход 0 |
| `asset-detail-page.tsx` | 28 | `currentPrice ?? averagePrice ?? 0` — нет цены = 0 |
| `asset-detail-page.tsx` | 29 | `calcYieldPercent(incomePerMonth * 12, value)` — сломается при null income |
| `asset-detail-page.tsx` | 57 | `{schedule && (...)}` — нет schedule = нет полей ввода |
| `asset-detail-page.tsx` | 65 | `if (num > 0)` — отвергает валидный 0 |
| `asset-row.tsx` | 12-14 | `schedule ? calc : 0` — нет schedule = доход 0 |
| `asset-row.tsx` | 16 | `currentPrice ?? averagePrice ?? 0` |
| `use-portfolio-stats.ts` | 37-38 | `schedule?.lastPaymentAmount ?? 0` (портфель) |
| `use-portfolio-stats.ts` | 54-59 | `schedule?.lastPaymentAmount ?? 0` (категории — идентичный паттерн) |
| `use-portfolio-stats.ts` | 21 | `currentPrice ?? averagePrice ?? 0` |
| `hero-income.tsx` | 4, 16, 19 | `income: number`, вызывает `formatCurrencyFull` — не поддерживает null |
| `category-card.tsx` | 9, 33 | `incomePerMonth: number`, вызывает `formatCurrency` — не поддерживает null |
| `stat-blocks.tsx` | 8, 12-13 | Props `number`, нет варианта для «нет данных» |
| `main-page.tsx` | 34-37, 52-53, 77-83 | Передаёт stats в HeroIncome и CategoryCard |
| `lib/utils.ts` | 8-16, 18-20, 22-24 | `formatCurrency`, `formatCurrencyFull`, `formatPercent` — не принимают null |
| `asset-field.tsx` | 8 | `source: DataSource` — обязательный, но при отсутствии schedule source нет |
| `data-source-tag.tsx` | 9 | `source: DataSource` — обязательный, крашится при undefined (TAG_STYLES[undefined]) |

## Дизайн

### Принцип: `null` = нет данных, `0` = известный ноль

- `null` / `undefined` — данных нет. Отображается как «—» (или «— Укажите» где позволяет ширина).
- `0` — явно известное значение ноль. Отображается как «₽ 0».

Касается полей: `lastPaymentAmount` (PaymentSchedule), `currentPrice` (Asset), `averagePrice` (Asset).

### Граница null-коллапса

**Null-to-number коллапс происходит внутри `use-portfolio-stats.ts` перед возвратом значений.** Типы `PortfolioStats` и `CategoryStats` остаются `number`. Причина: на уровне портфеля всегда будут активы без данных, но суммарный доход осмыслен — это «доход от того, по чему данные есть». Аналогично стоимости.

Null-пропагация работает только на уровне **отдельного актива** — в `asset-detail-page.tsx`, `asset-row.tsx`, `stat-blocks.tsx` (при просмотре одного актива).

### Изменение 1: Поля ввода дохода видны всегда

На `asset-detail-page.tsx` убрать `{schedule && (...)}`. Вместо этого:
- Если schedule есть — показывать текущие значения (как сейчас).
- Если schedule нет — показывать поля с прочерком «—» / «— Укажите» как значение. По клику — открывается инлайн-редактор. При сохранении — создаётся PaymentSchedule с `dataSource: 'manual'`.

**AssetField.source становится опциональным**: `source?: DataSource`. Если `undefined` — DataSourceTag не рендерится. Это естественное состояние для полей, которые ещё не были заполнены.

**onSave для нового schedule**: Когда schedule не существует, `onSave` создаёт новый PaymentSchedule. Нельзя делать `...schedule` (undefined). Реализация:

```ts
const handleSavePayment = (v: string) => {
  const num = parseFloat(v.replace(/[^\d.]/g, ''));
  if (isNaN(num) || num < 0) return;
  upsertPaymentSchedule(assetId, {
    assetId,
    frequencyPerYear: schedule?.frequencyPerYear ?? 1,  // дефолт: 1 раз в год
    lastPaymentAmount: num,
    dataSource: 'manual',
  });
};
```

Аналогично для частоты — при сохранении частоты без существующего schedule, `lastPaymentAmount` дефолтится в 0 (известный ноль — пользователь затем заполнит сумму).

**DataSourceTag.source становится опциональным**: `source?: DataSource`. Если `undefined` — компонент возвращает `null`. Это предотвращает краш при `TAG_STYLES[undefined]`.

### Изменение 2: Валидация позволяет 0

`asset-detail-page.tsx:65`: `if (num > 0)` → `if (!isNaN(num) && num >= 0)`. Аналогично для quantity guard (строка 53) — оставить `> 0`, т.к. количество 0 не имеет смысла.

### Изменение 3: Форматтеры принимают null

```ts
// lib/utils.ts
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  // ... существующая логика
}

export function formatCurrencyFull(value: number | null | undefined): string {
  if (value == null) return '—';
  return `₽ ${Math.round(value).toLocaleString('ru-RU')}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}
```

### Изменение 4: Asset-level null-пропагация

```ts
// asset-detail-page.tsx
const incomePerMonth = schedule
  ? calcAssetIncomePerMonth(asset.quantity, schedule.lastPaymentAmount, schedule.frequencyPerYear)
  : null;  // было: 0

const value = (asset.currentPrice ?? asset.averagePrice) != null
  ? (asset.currentPrice ?? asset.averagePrice)! * asset.quantity
  : null;

const yieldPct = (incomePerMonth != null && value != null)
  ? calcYieldPercent(incomePerMonth * 12, value)
  : null;

const sharePercent = (value != null && portfolio.totalValue > 0)
  ? (value / portfolio.totalValue) * 100
  : null;
```

Аналогичная логика в `asset-row.tsx`, включая производные:
```ts
const incomePerYear = incomePerMonth != null ? incomePerMonth * 12 : null;
```
Важно: `null * 12` в JS даёт `0`, а не `null`, поэтому явная проверка обязательна.

### Изменение 5: StatBlocks, HeroIncome, CategoryCard поддерживают null

**StatBlocks**: props становятся `number | null`. Если значение null — отображает «—» в стиле `text-gray-600` (приглушённый).

**HeroIncome**: `income: number | null`, `yieldPercent: number | null`, `totalValue: number | null`. Форматтеры уже обрабатывают null после Изменения 3.

**CategoryCard**: `incomePerMonth: number | null`. Форматтер обработает null.

### Изменение 6: use-portfolio-stats — оба цикла

Исправить **оба** места, где строятся incomeItems:
- Строки 33-39 (портфельный уровень)
- Строки 54-59 (категорийный уровень)

Активы без schedule **исключаются из суммы дохода** (не добавляют 0). Результат коллапсируется в `number` перед возвратом — типы PortfolioStats/CategoryStats не меняются.

```ts
// Вместо:
paymentAmount: schedule?.lastPaymentAmount ?? 0,
frequencyPerYear: schedule?.frequencyPerYear ?? 0,

// Фильтруем:
const incomeItems = assets
  .filter((asset) => scheduleByAssetId.has(asset.id!))
  .map((asset) => {
    const schedule = scheduleByAssetId.get(asset.id!)!;
    return {
      quantity: asset.quantity,
      paymentAmount: schedule.lastPaymentAmount,
      frequencyPerYear: schedule.frequencyPerYear,
    };
  });
```

Идентично для `catIncomeItems`.

### Вне скоупа

- Изменения в `income-calculator.ts` — функции продолжают принимать `number`, null-проверка на уровне вызывающего кода.
- Изменения в `add-asset-page.tsx` — там ручной ввод уже работает.
- Изменения в MOEX sync — sync создаёт schedule только при наличии данных, это корректно.
- Изменения в типах `PortfolioStats` / `CategoryStats` — null коллапсируется внутри `use-portfolio-stats.ts`.
