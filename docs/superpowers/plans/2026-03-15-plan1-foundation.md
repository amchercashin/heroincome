# Plan 1: Foundation — Data Model, Core Logic, Basic UI

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working PWA with manual asset input, normalized income calculation, and drill-down UI (Main → Category → Asset Detail) — enough to demo the core concept.

**Architecture:** Client-side only PWA. React SPA with React Router for navigation. Dexie.js wraps IndexedDB for persistence. All calculations happen in a pure `income-calculator` module. UI uses shadcn/ui components styled with Tailwind in dark theme.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Dexie.js, Vitest, React Router v7

**Spec:** `docs/superpowers/specs/2026-03-15-passive-income-tracker-design.md`

**Design decisions:**
- Spec defines `id` as `string`, but plan uses `number` (Dexie `++id` auto-increment). This is intentional — Dexie works best with numeric auto-increment keys. All foreign keys (`assetId`) are also `number`.
- `tailwind.config.ts` and `postcss.config.js` are created by `npx shadcn@latest init` in Task 1, Step 9. They are not created manually.
- `fake-indexeddb` is needed for Vitest tests since happy-dom does not provide IndexedDB.

---

## File Structure

```
passive-income-tracker/
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx                          # React entry point
│   ├── App.tsx                           # Router setup
│   ├── db/
│   │   └── database.ts                   # Dexie DB schema, tables, types
│   ├── models/
│   │   └── types.ts                      # TypeScript interfaces (Asset, PaymentSchedule, etc.)
│   ├── services/
│   │   └── income-calculator.ts          # Pure functions: normalizedIncome, yield, CAGR
│   ├── hooks/
│   │   ├── use-assets.ts                 # CRUD hooks for assets
│   │   ├── use-payment-schedules.ts      # CRUD hooks for payment schedules
│   │   └── use-portfolio-stats.ts        # Aggregated portfolio stats
│   ├── components/
│   │   ├── ui/                           # shadcn/ui components (auto-generated)
│   │   ├── layout/
│   │   │   ├── app-shell.tsx             # Top bar + drawer wrapper
│   │   │   └── drawer-menu.tsx           # Side navigation
│   │   ├── shared/
│   │   │   ├── stat-blocks.tsx           # Reusable 4-stat grid
│   │   │   ├── income-chart.tsx          # Bar chart with CAGR (placeholder for Plan 4)
│   │   │   └── data-source-tag.tsx       # [MOEX] [import] [manual] badge
│   │   ├── main/
│   │   │   ├── hero-income.tsx           # Big green number + subtitle
│   │   │   └── category-card.tsx         # Single category row
│   │   ├── category/
│   │   │   └── asset-row.tsx             # Single asset in category list
│   │   └── asset-detail/
│   │       ├── asset-field.tsx           # Editable field with source tag
│   │       └── expected-payment.tsx      # Next dividend/coupon block
│   ├── pages/
│   │   ├── main-page.tsx                 # Main screen
│   │   ├── category-page.tsx             # Category drill-down
│   │   ├── asset-detail-page.tsx         # Asset detail + edit
│   │   └── add-asset-page.tsx            # Manual add form
│   └── lib/
│       └── utils.ts                      # formatCurrency, formatPercent, etc.
├── tests/
│   ├── services/
│   │   └── income-calculator.test.ts     # Unit tests for calculations
│   ├── db/
│   │   └── database.test.ts             # DB CRUD tests
│   └── hooks/
│       └── use-portfolio-stats.test.ts   # Hook logic tests
```

---

## Chunk 1: Project Setup + Data Model + Core Logic

### Task 1: Scaffold project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Create Vite + React + TypeScript project**

```bash
cd /Users/amchercashin
npm create vite@latest passive-income-tracker-app -- --template react-ts
```

Note: we already have the `passive-income-tracker` directory with docs. Create `passive-income-tracker-app` then merge, OR init Vite inside the existing directory:

```bash
cd /Users/amchercashin/passive-income-tracker
npm init -y
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

- [ ] **Step 2: Install core dependencies**

```bash
cd /Users/amchercashin/passive-income-tracker
npm install dexie dexie-react-hooks react-router-dom
npm install -D tailwindcss @tailwindcss/vite postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom happy-dom fake-indexeddb
```

- [ ] **Step 3: Configure Vite**

Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 4: Configure TypeScript**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 5: Configure Tailwind with dark theme**

Create `src/index.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 6: Create test setup**

Create `tests/setup.ts`:
```typescript
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Create minimal App entry**

Create `src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create `src/App.tsx`:
```tsx
export default function App() {
  return <div className="min-h-screen bg-[#0d1117] text-white p-4">CashFlow Tracker</div>;
}
```

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="ru" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CashFlow Tracker</title>
</head>
<body class="bg-[#0d1117]">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 8: Create .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
.superpowers/
*.local
```

- [ ] **Step 9: Verify project builds and runs**

```bash
npx vite build
npx vite --port 3000
```

Expected: App builds without errors. Browser shows "CashFlow Tracker" on dark background.

- [ ] **Step 10: Install and configure shadcn/ui**

```bash
npx shadcn@latest init
```

Select: New York style, Zinc base color, CSS variables.

Then install components we'll need:
```bash
npx shadcn@latest add button card input label sheet select
```

- [ ] **Step 11: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vite.config.ts index.html src/ tests/setup.ts components.json
git commit -m "feat: scaffold project with Vite, React, Tailwind, shadcn/ui, Dexie, Vitest"
```

Note: `tailwind.config.ts` and `postcss.config.js` may have been created by shadcn init — add them if they exist:
```bash
git add tailwind.config.ts postcss.config.js 2>/dev/null; true
git commit --amend --no-edit
```

---

### Task 2: Define TypeScript types

**Files:**
- Create: `src/models/types.ts`

- [ ] **Step 1: Create type definitions**

Create `src/models/types.ts`:
```typescript
export type DataSource = 'moex' | 'import' | 'manual';

export type AssetType = 'stock' | 'bond' | 'fund' | 'realestate' | 'deposit' | 'other';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: 'Акции',
  bond: 'Облигации',
  fund: 'Фонды',
  realestate: 'Недвижимость',
  deposit: 'Вклады',
  other: 'Прочее',
};

export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  stock: '#e9c46a',
  bond: '#7b68ee',
  fund: '#e76f51',
  realestate: '#e94560',
  deposit: '#2a9d8f',
  other: '#888888',
};

export interface Asset {
  id?: number;
  type: AssetType;
  ticker?: string;
  name: string;
  quantity: number;
  averagePrice?: number;
  currentPrice?: number;
  faceValue?: number;
  dataSource: DataSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentSchedule {
  id?: number;
  assetId: number;
  frequencyPerYear: number;
  lastPaymentAmount: number;
  lastPaymentDate?: Date;
  nextExpectedDate?: Date;
  nextExpectedCutoffDate?: Date;
  nextExpectedCreditDate?: Date;
  dataSource: DataSource;
}

export interface PaymentHistory {
  id?: number;
  assetId: number;
  amount: number;
  date: Date;
  type: 'dividend' | 'coupon' | 'rent' | 'interest' | 'distribution' | 'other';
  dataSource: DataSource;
}

export interface ImportRecord {
  id?: number;
  date: Date;
  source: 'sber_xls' | 'sber_html' | 'csv' | 'markdown' | 'ai_import' | 'manual';
  mode: 'update' | 'add';
  itemsChanged: number;
  itemsAdded: number;
  itemsUnchanged: number;
}

export interface PortfolioStats {
  totalIncomePerMonth: number;
  totalIncomePerYear: number;
  totalValue: number;
  yieldPercent: number;
}

export interface CategoryStats extends PortfolioStats {
  type: AssetType;
  assetCount: number;
  portfolioSharePercent: number;
}

export interface AssetStats {
  incomePerMonth: number;
  incomePerYear: number;
  value: number;
  yieldPercent: number;
  portfolioSharePercent: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/models/types.ts
git commit -m "feat: define TypeScript types for data model"
```

---

### Task 3: Create Dexie database

**Files:**
- Create: `src/db/database.ts`
- Create: `tests/db/database.test.ts`

- [ ] **Step 1: Write failing test for database CRUD**

Create `tests/db/database.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import type { Asset } from '@/models/types';

describe('Database', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('adds and retrieves an asset', async () => {
    const asset: Asset = {
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      averagePrice: 298.6,
      currentPrice: 308.2,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const id = await db.assets.add(asset);
    const retrieved = await db.assets.get(id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.ticker).toBe('SBER');
    expect(retrieved!.quantity).toBe(800);
  });

  it('adds and retrieves payment schedule', async () => {
    const assetId = await db.assets.add({
      type: 'stock',
      name: 'Сбербанк',
      ticker: 'SBER',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.paymentSchedules.add({
      assetId: assetId as number,
      frequencyPerYear: 1,
      lastPaymentAmount: 186,
      dataSource: 'manual',
    });

    const schedules = await db.paymentSchedules
      .where('assetId')
      .equals(assetId as number)
      .toArray();

    expect(schedules).toHaveLength(1);
    expect(schedules[0].lastPaymentAmount).toBe(186);
  });

  it('queries assets by type', async () => {
    const now = new Date();
    await db.assets.bulkAdd([
      { type: 'stock', name: 'Сбер', ticker: 'SBER', quantity: 100, dataSource: 'manual', createdAt: now, updatedAt: now },
      { type: 'stock', name: 'Лукойл', ticker: 'LKOH', quantity: 10, dataSource: 'manual', createdAt: now, updatedAt: now },
      { type: 'bond', name: 'ОФЗ 26238', ticker: 'SU26238', quantity: 50, dataSource: 'manual', createdAt: now, updatedAt: now },
    ]);

    const stocks = await db.assets.where('type').equals('stock').toArray();
    expect(stocks).toHaveLength(2);

    const bonds = await db.assets.where('type').equals('bond').toArray();
    expect(bonds).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/db/database.test.ts
```

Expected: FAIL — `@/db/database` module not found.

- [ ] **Step 3: Implement database**

Create `src/db/database.ts`:
```typescript
import Dexie, { type EntityTable } from 'dexie';
import type { Asset, PaymentSchedule, PaymentHistory, ImportRecord } from '@/models/types';

class CashFlowDB extends Dexie {
  assets!: EntityTable<Asset, 'id'>;
  paymentSchedules!: EntityTable<PaymentSchedule, 'id'>;
  paymentHistory!: EntityTable<PaymentHistory, 'id'>;
  importRecords!: EntityTable<ImportRecord, 'id'>;

  constructor() {
    super('CashFlowDB');
    this.version(1).stores({
      assets: '++id, type, ticker',
      paymentSchedules: '++id, assetId',
      paymentHistory: '++id, assetId, date',
      importRecords: '++id, date',
      settings: 'key',
    });
  }
}

export const db = new CashFlowDB();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/db/database.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/database.ts tests/db/database.test.ts
git commit -m "feat: add Dexie database with Asset, PaymentSchedule, PaymentHistory tables"
```

---

### Task 4: Income calculator (pure functions)

**Files:**
- Create: `src/services/income-calculator.ts`
- Create: `tests/services/income-calculator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/income-calculator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  calcAssetIncomePerYear,
  calcAssetIncomePerMonth,
  calcPortfolioIncome,
  calcYieldPercent,
  calcCAGR,
} from '@/services/income-calculator';
import type { Asset, PaymentSchedule, PaymentHistory } from '@/models/types';

describe('income-calculator', () => {
  describe('calcAssetIncomePerYear', () => {
    it('calculates annual income for stock with 1x/year dividend', () => {
      const result = calcAssetIncomePerYear(800, 186, 1);
      expect(result).toBe(148800); // 800 * 186 * 1
    });

    it('calculates annual income for bond with 2x/year coupon', () => {
      const result = calcAssetIncomePerYear(500, 36.9, 2);
      expect(result).toBe(36900); // 500 * 36.9 * 2
    });

    it('calculates annual income for monthly rent (quantity=1)', () => {
      const result = calcAssetIncomePerYear(1, 45000, 12);
      expect(result).toBe(540000); // 1 * 45000 * 12
    });
  });

  describe('calcAssetIncomePerMonth', () => {
    it('normalizes yearly dividend to monthly', () => {
      const result = calcAssetIncomePerMonth(800, 186, 1);
      expect(result).toBeCloseTo(12400, 0); // 148800 / 12
    });
  });

  describe('calcPortfolioIncome', () => {
    it('sums normalized income across multiple assets', () => {
      const items = [
        { quantity: 800, paymentAmount: 186, frequencyPerYear: 1 },
        { quantity: 500, paymentAmount: 36.9, frequencyPerYear: 2 },
        { quantity: 1, paymentAmount: 45000, frequencyPerYear: 12 },
      ];
      const result = calcPortfolioIncome(items);
      expect(result.perYear).toBeCloseTo(725700, 0);
      expect(result.perMonth).toBeCloseTo(60475, 0);
    });

    it('returns zero for empty portfolio', () => {
      const result = calcPortfolioIncome([]);
      expect(result.perYear).toBe(0);
      expect(result.perMonth).toBe(0);
    });
  });

  describe('calcYieldPercent', () => {
    it('calculates yield from income and portfolio value', () => {
      const result = calcYieldPercent(725700, 8200000);
      expect(result).toBeCloseTo(8.85, 1);
    });

    it('returns 0 when portfolio value is 0', () => {
      const result = calcYieldPercent(100000, 0);
      expect(result).toBe(0);
    });
  });

  describe('calcCAGR', () => {
    it('calculates CAGR over multiple years', () => {
      const annualIncomes = [100000, 120000, 150000, 180000];
      const result = calcCAGR(annualIncomes);
      // (180000/100000)^(1/3) - 1 = 0.2154 = 21.54%
      expect(result).toBeCloseTo(21.54, 0);
    });

    it('returns null for less than 2 periods', () => {
      expect(calcCAGR([100000])).toBeNull();
      expect(calcCAGR([])).toBeNull();
    });

    it('returns null when first year is 0', () => {
      expect(calcCAGR([0, 100000])).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/services/income-calculator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement income calculator**

Create `src/services/income-calculator.ts`:
```typescript
export function calcAssetIncomePerYear(
  quantity: number,
  paymentAmount: number,
  frequencyPerYear: number,
): number {
  return quantity * paymentAmount * frequencyPerYear;
}

export function calcAssetIncomePerMonth(
  quantity: number,
  paymentAmount: number,
  frequencyPerYear: number,
): number {
  return calcAssetIncomePerYear(quantity, paymentAmount, frequencyPerYear) / 12;
}

interface IncomeItem {
  quantity: number;
  paymentAmount: number;
  frequencyPerYear: number;
}

export function calcPortfolioIncome(items: IncomeItem[]): {
  perYear: number;
  perMonth: number;
} {
  const perYear = items.reduce(
    (sum, item) =>
      sum + calcAssetIncomePerYear(item.quantity, item.paymentAmount, item.frequencyPerYear),
    0,
  );
  return { perYear, perMonth: perYear / 12 };
}

export function calcYieldPercent(annualIncome: number, portfolioValue: number): number {
  if (portfolioValue === 0) return 0;
  return (annualIncome / portfolioValue) * 100;
}

export function calcCAGR(annualIncomes: number[]): number | null {
  if (annualIncomes.length < 2) return null;
  const first = annualIncomes[0];
  const last = annualIncomes[annualIncomes.length - 1];
  if (first <= 0) return null;
  const years = annualIncomes.length - 1;
  const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;
  return cagr;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/services/income-calculator.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/income-calculator.ts tests/services/income-calculator.test.ts
git commit -m "feat: add income calculator with normalization, yield, and CAGR"
```

---

### Task 5: Utility functions

**Files:**
- Create: `src/lib/utils.ts`

- [ ] **Step 1: Create utility functions**

Create `src/lib/utils.ts`:
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `₽ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `₽ ${(value / 1_000).toFixed(0)}K`;
  }
  return `₽ ${Math.round(value).toLocaleString('ru-RU')}`;
}

export function formatCurrencyFull(value: number): string {
  return `₽ ${Math.round(value).toLocaleString('ru-RU')}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatFrequency(perYear: number): string {
  const labels: Record<number, string> = {
    1: '1×/год',
    2: '2×/год',
    4: '4×/год (кварт.)',
    12: 'ежемес.',
  };
  return labels[perYear] ?? `${perYear}×/год`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add formatting utilities for currency, percent, frequency"
```

---

## Chunk 2: React Hooks + UI Components

### Task 6: Data hooks

**Files:**
- Create: `src/hooks/use-assets.ts`
- Create: `src/hooks/use-payment-schedules.ts`
- Create: `src/hooks/use-portfolio-stats.ts`

- [ ] **Step 1: Create use-assets hook**

Create `src/hooks/use-assets.ts`:
```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Asset, AssetType } from '@/models/types';

export function useAssets() {
  const assets = useLiveQuery(() => db.assets.toArray()) ?? [];
  return assets;
}

export function useAssetsByType(type: AssetType) {
  const assets = useLiveQuery(() => db.assets.where('type').equals(type).toArray(), [type]) ?? [];
  return assets;
}

export function useAsset(id: number) {
  const asset = useLiveQuery(() => db.assets.get(id), [id]);
  return asset;
}

export async function addAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date();
  return (await db.assets.add({
    ...asset,
    createdAt: now,
    updatedAt: now,
  })) as number;
}

export async function updateAsset(id: number, changes: Partial<Asset>): Promise<void> {
  await db.assets.update(id, { ...changes, updatedAt: new Date() });
}

export async function deleteAsset(id: number): Promise<void> {
  await db.transaction('rw', db.assets, db.paymentSchedules, db.paymentHistory, async () => {
    await db.paymentSchedules.where('assetId').equals(id).delete();
    await db.paymentHistory.where('assetId').equals(id).delete();
    await db.assets.delete(id);
  });
}
```

- [ ] **Step 2: Create use-payment-schedules hook**

Create `src/hooks/use-payment-schedules.ts`:
```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { PaymentSchedule } from '@/models/types';

export function usePaymentSchedule(assetId: number) {
  const schedule = useLiveQuery(
    () => db.paymentSchedules.where('assetId').equals(assetId).first(),
    [assetId],
  );
  return schedule;
}

export function useAllPaymentSchedules() {
  const schedules = useLiveQuery(() => db.paymentSchedules.toArray()) ?? [];
  return schedules;
}

export async function upsertPaymentSchedule(
  assetId: number,
  data: Omit<PaymentSchedule, 'id' | 'assetId'>,
): Promise<void> {
  const existing = await db.paymentSchedules.where('assetId').equals(assetId).first();
  if (existing) {
    await db.paymentSchedules.update(existing.id!, { ...data });
  } else {
    await db.paymentSchedules.add({ ...data, assetId });
  }
}
```

- [ ] **Step 3: Create use-portfolio-stats hook**

Create `src/hooks/use-portfolio-stats.ts`:
```typescript
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { AssetType, CategoryStats, PortfolioStats } from '@/models/types';
import { calcPortfolioIncome, calcYieldPercent } from '@/services/income-calculator';

export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
} {
  const assets = useLiveQuery(() => db.assets.toArray()) ?? [];
  const schedules = useLiveQuery(() => db.paymentSchedules.toArray()) ?? [];

  return useMemo(() => {
    const scheduleByAssetId = new Map(schedules.map((s) => [s.assetId, s]));

    let totalValue = 0;
    const categoryMap = new Map<AssetType, { assets: typeof assets; value: number }>();

    for (const asset of assets) {
      const value = (asset.currentPrice ?? asset.averagePrice ?? 0) * asset.quantity;
      totalValue += value;

      const existing = categoryMap.get(asset.type);
      if (existing) {
        existing.assets.push(asset);
        existing.value += value;
      } else {
        categoryMap.set(asset.type, { assets: [asset], value });
      }
    }

    const incomeItems = assets.map((asset) => {
      const schedule = scheduleByAssetId.get(asset.id!);
      return {
        quantity: asset.quantity,
        paymentAmount: schedule?.lastPaymentAmount ?? 0,
        frequencyPerYear: schedule?.frequencyPerYear ?? 0,
      };
    });

    const totalIncome = calcPortfolioIncome(incomeItems);
    const yieldPercent = calcYieldPercent(totalIncome.perYear, totalValue);

    const portfolio: PortfolioStats = {
      totalIncomePerMonth: totalIncome.perMonth,
      totalIncomePerYear: totalIncome.perYear,
      totalValue,
      yieldPercent,
    };

    const categories: CategoryStats[] = [];
    for (const [type, data] of categoryMap) {
      const catIncomeItems = data.assets.map((asset) => {
        const schedule = scheduleByAssetId.get(asset.id!);
        return {
          quantity: asset.quantity,
          paymentAmount: schedule?.lastPaymentAmount ?? 0,
          frequencyPerYear: schedule?.frequencyPerYear ?? 0,
        };
      });
      const catIncome = calcPortfolioIncome(catIncomeItems);
      const catYield = calcYieldPercent(catIncome.perYear, data.value);

      categories.push({
        type,
        assetCount: data.assets.length,
        totalIncomePerMonth: catIncome.perMonth,
        totalIncomePerYear: catIncome.perYear,
        totalValue: data.value,
        yieldPercent: catYield,
        portfolioSharePercent: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      });
    }

    categories.sort((a, b) => b.totalIncomePerMonth - a.totalIncomePerMonth);

    return { portfolio, categories };
  }, [assets, schedules]);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat: add data hooks for assets, payment schedules, portfolio stats"
```

---

### Task 7: Shared UI components

**Files:**
- Create: `src/components/shared/stat-blocks.tsx`
- Create: `src/components/shared/data-source-tag.tsx`
- Create: `src/components/shared/income-chart.tsx`

- [ ] **Step 1: Create StatBlocks component**

Create `src/components/shared/stat-blocks.tsx`:
```tsx
import { formatCurrency, formatPercent } from '@/lib/utils';

interface StatBlocksProps {
  incomePerMonth: number;
  totalValue: number;
  yieldPercent: number;
  portfolioSharePercent: number;
}

export function StatBlocks({ incomePerMonth, totalValue, yieldPercent, portfolioSharePercent }: StatBlocksProps) {
  const stats = [
    { label: 'Доход/мес', value: formatCurrency(incomePerMonth), green: true },
    { label: 'Стоимость', value: formatCurrency(totalValue), green: false },
    { label: 'Доходность', value: formatPercent(yieldPercent), green: true },
    { label: 'Доля портф.', value: formatPercent(portfolioSharePercent), green: false },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-[#1a1a2e] rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">{stat.label}</div>
          <div className={`text-[15px] font-semibold mt-1 ${stat.green ? 'text-[#4ecca3]' : 'text-white'}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create DataSourceTag component**

Create `src/components/shared/data-source-tag.tsx`:
```tsx
import type { DataSource } from '@/models/types';

const TAG_STYLES: Record<DataSource, { bg: string; text: string; label: string }> = {
  moex: { bg: 'bg-[#4ecca322]', text: 'text-[#4ecca3]', label: 'MOEX' },
  import: { bg: 'bg-[#e9c46a22]', text: 'text-[#e9c46a]', label: 'импорт' },
  manual: { bg: 'bg-[#88888822]', text: 'text-gray-400', label: 'ручной' },
};

export function DataSourceTag({ source }: { source: DataSource }) {
  const style = TAG_STYLES[source];
  return (
    <span className={`text-[9px] ${style.bg} ${style.text} px-1.5 py-0.5 rounded`}>
      {style.label}
    </span>
  );
}
```

- [ ] **Step 3: Create IncomeChart placeholder**

Create `src/components/shared/income-chart.tsx`:
```tsx
interface IncomeChartProps {
  cagr?: number | null;
}

export function IncomeChart({ cagr }: IncomeChartProps) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-3 mt-4">
      {cagr != null && (
        <div className="text-center text-[13px] font-bold text-[#4ecca3] mb-2">
          CAGR {cagr > 0 ? '+' : ''}{cagr.toFixed(1)}%
        </div>
      )}
      <div className="h-11 flex items-center justify-center text-gray-600 text-xs">
        График будет доступен при наличии истории выплат
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/
git commit -m "feat: add shared UI components (StatBlocks, DataSourceTag, IncomeChart)"
```

---

### Task 8: Layout (App Shell + Drawer)

**Files:**
- Create: `src/components/layout/app-shell.tsx`
- Create: `src/components/layout/drawer-menu.tsx`

- [ ] **Step 1: Create DrawerMenu**

Create `src/components/layout/drawer-menu.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface DrawerMenuProps {
  onClose: () => void;
}

const MENU_SECTIONS = [
  {
    title: 'Просмотр',
    items: [
      { label: '📊 Мой доход', path: '/' },
      { label: '📅 Календарь выплат', path: '/calendar' },
    ],
  },
  {
    title: 'Управление',
    items: [
      { label: '📥 Импорт данных', path: '/import' },
    ],
  },
  {
    title: 'Прочее',
    items: [
      { label: '⚙️ Настройки', path: '/settings' },
      { label: '💾 Экспорт/Бэкап', path: '/backup' },
    ],
  },
];

export function DrawerMenu({ onClose }: DrawerMenuProps) {
  return (
    <SheetContent side="left" className="bg-[#0d1117] border-r-[#1a1a2e] w-64">
      <SheetHeader>
        <SheetTitle className="text-[#4ecca3] text-lg font-bold">CashFlow</SheetTitle>
      </SheetHeader>
      <nav className="mt-6">
        {MENU_SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 px-2">
              {section.title}
            </div>
            {section.items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className="block px-2 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#1a1a2e] rounded-lg"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </SheetContent>
  );
}
```

- [ ] **Step 2: Create AppShell**

Create `src/components/layout/app-shell.tsx`:
```tsx
import { useState, type ReactNode } from 'react';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { DrawerMenu } from './drawer-menu';

interface AppShellProps {
  title?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, leftAction, rightAction, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const defaultLeft = (
    <button
      onClick={() => setDrawerOpen(true)}
      className="text-gray-400 text-lg"
      aria-label="Открыть меню"
    >
      ☰
    </button>
  );

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div className="min-h-screen bg-[#0d1117] text-white">
        <header className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>{leftAction ?? <SheetTrigger asChild>{defaultLeft}</SheetTrigger>}</div>
          {title && <h1 className="text-base font-semibold">{title}</h1>}
          <div>{rightAction ?? <div className="w-5" />}</div>
        </header>
        <main className="px-5 pb-8">{children}</main>
      </div>
      <DrawerMenu onClose={() => setDrawerOpen(false)} />
    </Sheet>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add AppShell layout with drawer navigation"
```

---

### Task 9: Main page components

**Files:**
- Create: `src/components/main/hero-income.tsx`
- Create: `src/components/main/category-card.tsx`
- Create: `src/pages/main-page.tsx`

- [ ] **Step 1: Create HeroIncome**

Create `src/components/main/hero-income.tsx`:
```tsx
import { formatCurrencyFull, formatPercent, formatCurrency } from '@/lib/utils';

interface HeroIncomeProps {
  income: number;
  yieldPercent: number;
  totalValue: number;
  mode: 'month' | 'year';
  onToggle: () => void;
}

export function HeroIncome({ income, yieldPercent, totalValue, mode, onToggle }: HeroIncomeProps) {
  return (
    <div className="text-center mb-4">
      <div className="text-gray-500 text-xs">расчётный пассивный доход</div>
      <div className="text-[#4ecca3] text-[32px] font-bold tracking-tight mt-1">
        {formatCurrencyFull(income)}
      </div>
      <div className="text-gray-600 text-xs mt-0.5">
        доходность {formatPercent(yieldPercent)} · портфель {formatCurrency(totalValue)}
      </div>
      <button
        onClick={onToggle}
        className="mt-3 inline-flex bg-[#1a1a2e] rounded-full p-0.5"
      >
        <span className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
          mode === 'month' ? 'bg-[#4ecca3] text-black' : 'text-gray-500'
        }`}>
          мес
        </span>
        <span className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
          mode === 'year' ? 'bg-[#4ecca3] text-black' : 'text-gray-500'
        }`}>
          год
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create CategoryCard**

Create `src/components/main/category-card.tsx`:
```tsx
import { Link } from 'react-router-dom';
import type { AssetType } from '@/models/types';
import { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS } from '@/models/types';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface CategoryCardProps {
  type: AssetType;
  assetCount: number;
  incomePerMonth: number;
  portfolioSharePercent: number;
}

export function CategoryCard({ type, assetCount, incomePerMonth, portfolioSharePercent }: CategoryCardProps) {
  const color = ASSET_TYPE_COLORS[type];
  const label = ASSET_TYPE_LABELS[type];

  return (
    <Link
      to={`/category/${type}`}
      className="flex items-center justify-between bg-[#1a1a2e] rounded-xl p-3.5 mb-2 active:bg-[#222244] transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <div>
          <div className="text-sm font-medium text-white">{label}</div>
          <div className="text-[11px] text-gray-600">
            {assetCount} {assetCount === 1 ? 'позиция' : assetCount < 5 ? 'позиции' : 'позиций'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-sm font-semibold text-[#4ecca3]">{formatCurrency(incomePerMonth)}</div>
          <div className="text-[11px] text-gray-600">{formatPercent(portfolioSharePercent)}</div>
        </div>
        <span className="text-gray-700">›</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Create MainPage**

Create `src/pages/main-page.tsx`:
```tsx
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { HeroIncome } from '@/components/main/hero-income';
import { CategoryCard } from '@/components/main/category-card';
import { IncomeChart } from '@/components/shared/income-chart';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';

export function MainPage() {
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const { portfolio, categories } = usePortfolioStats();

  const income = mode === 'month' ? portfolio.totalIncomePerMonth : portfolio.totalIncomePerYear;

  return (
    <AppShell rightAction={<span className="text-gray-400 text-base">⟳</span>}>
      <HeroIncome
        income={income}
        yieldPercent={portfolio.yieldPercent}
        totalValue={portfolio.totalValue}
        mode={mode}
        onToggle={() => setMode((m) => (m === 'month' ? 'year' : 'month'))}
      />

      <div className="mt-4">
        {categories.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-12">
            Пока нет активов. Добавьте первый актив через меню ☰
          </div>
        )}
        {categories.map((cat) => (
          <CategoryCard
            key={cat.type}
            type={cat.type}
            assetCount={cat.assetCount}
            incomePerMonth={cat.totalIncomePerMonth}
            portfolioSharePercent={cat.portfolioSharePercent}
          />
        ))}
      </div>

      <IncomeChart cagr={null} />
    </AppShell>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/main/ src/pages/main-page.tsx
git commit -m "feat: add main page with hero income and category cards"
```

---

### Task 10: Category page

**Files:**
- Create: `src/components/category/asset-row.tsx`
- Create: `src/pages/category-page.tsx`

- [ ] **Step 1: Create AssetRow**

Create `src/components/category/asset-row.tsx`:
```tsx
import { Link } from 'react-router-dom';
import type { Asset, PaymentSchedule } from '@/models/types';
import { formatCurrency, formatFrequency } from '@/lib/utils';
import { calcAssetIncomePerMonth } from '@/services/income-calculator';

interface AssetRowProps {
  asset: Asset;
  schedule?: PaymentSchedule;
}

export function AssetRow({ asset, schedule }: AssetRowProps) {
  const incomePerMonth = schedule
    ? calcAssetIncomePerMonth(asset.quantity, schedule.lastPaymentAmount, schedule.frequencyPerYear)
    : 0;
  const incomePerYear = incomePerMonth * 12;
  const value = (asset.currentPrice ?? asset.averagePrice ?? 0) * asset.quantity;

  return (
    <Link
      to={`/asset/${asset.id}`}
      className="block bg-[#1a1a2e] rounded-xl p-3 mb-1.5 active:bg-[#222244] transition-colors"
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm font-semibold text-white">{asset.ticker ?? asset.name}</span>
          {asset.ticker && (
            <span className="text-xs text-gray-600 ml-2">{asset.name}</span>
          )}
        </div>
        <span className="text-sm font-semibold text-[#4ecca3]">{formatCurrency(incomePerMonth)}</span>
      </div>
      <div className="flex justify-between text-[11px] text-gray-600 mt-1">
        <span>
          {asset.quantity} шт · {formatCurrency(value)}
        </span>
        {schedule && (
          <span>
            <span className="bg-[#e9c46a22] text-[#e9c46a] px-1.5 py-0.5 rounded text-[10px]">
              {formatFrequency(schedule.frequencyPerYear)}
            </span>
            {' '}
            {formatCurrency(incomePerYear)}/год
          </span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create CategoryPage**

Create `src/pages/category-page.tsx`:
```tsx
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { IncomeChart } from '@/components/shared/income-chart';
import { AssetRow } from '@/components/category/asset-row';
import { useAssetsByType } from '@/hooks/use-assets';
import { useAllPaymentSchedules } from '@/hooks/use-payment-schedules';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS, type AssetType } from '@/models/types';

export function CategoryPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const assetType = type as AssetType;
  const assets = useAssetsByType(assetType);
  const schedules = useAllPaymentSchedules();
  const { categories } = usePortfolioStats();

  const catStats = categories.find((c) => c.type === assetType);
  const scheduleMap = new Map(schedules.map((s) => [s.assetId, s]));

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">
      ‹
    </button>
  );

  return (
    <AppShell
      leftAction={backButton}
      title={ASSET_TYPE_LABELS[assetType] ?? type}
    >
      {catStats && (
        <StatBlocks
          incomePerMonth={catStats.totalIncomePerMonth}
          totalValue={catStats.totalValue}
          yieldPercent={catStats.yieldPercent}
          portfolioSharePercent={catStats.portfolioSharePercent}
        />
      )}

      {assets.map((asset) => (
        <AssetRow key={asset.id} asset={asset} schedule={scheduleMap.get(asset.id!)} />
      ))}

      <Link
        to={`/add-asset?type=${assetType}`}
        className="block text-center py-3 border border-dashed border-gray-700 rounded-xl text-gray-600 text-sm mt-3 active:border-[#4ecca3] active:text-[#4ecca3]"
      >
        + Добавить
      </Link>

      <IncomeChart cagr={null} />
    </AppShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/category/ src/pages/category-page.tsx
git commit -m "feat: add category page with asset list and stats"
```

---

### Task 11: Asset detail page

**Files:**
- Create: `src/components/asset-detail/asset-field.tsx`
- Create: `src/components/asset-detail/expected-payment.tsx`
- Create: `src/pages/asset-detail-page.tsx`

- [ ] **Step 1: Create AssetField**

Create `src/components/asset-detail/asset-field.tsx`:
```tsx
import { useState } from 'react';
import type { DataSource } from '@/models/types';
import { DataSourceTag } from '@/components/shared/data-source-tag';

interface AssetFieldProps {
  label: string;
  value: string;
  source: DataSource;
  editable?: boolean;
  onSave?: (newValue: string) => void;
}

export function AssetField({ label, value, source, editable = true, onSave }: AssetFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    setDraft(value); // sync draft with current value before editing
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    if (draft !== value) {
      onSave?.(draft);
    }
  };

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-3 mb-2">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      {editing ? (
        <input
          className="w-full bg-[#0d1117] border border-[#4ecca3] rounded-lg px-2 py-1 text-sm text-white outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
      ) : (
        <div className="flex justify-between items-center">
          <span
            className={`text-sm font-medium text-white ${editable ? 'cursor-pointer' : ''}`}
            onClick={() => editable && startEditing()}
          >
            {value}
          </span>
          <DataSourceTag source={source} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ExpectedPayment**

Create `src/components/asset-detail/expected-payment.tsx`:
```tsx
import type { PaymentSchedule } from '@/models/types';

interface ExpectedPaymentProps {
  schedule: PaymentSchedule;
  quantity: number;
}

export function ExpectedPayment({ schedule, quantity }: ExpectedPaymentProps) {
  const totalAmount = schedule.lastPaymentAmount * quantity;

  const formatDate = (date?: Date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="bg-gradient-to-br from-[#1a2e1a] to-[#1a1a2e] border border-[#4ecca333] rounded-xl p-3.5 mt-3">
      <div className="text-[#4ecca3] text-xs font-semibold mb-2">Ожидаемый дивиденд</div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Размер (прогноз)</span>
          <span className="text-white">
            ₽{schedule.lastPaymentAmount} × {quantity} = ₽{Math.round(totalAmount).toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Отсечка (ожид.)</span>
          <span className="text-white">{formatDate(schedule.nextExpectedCutoffDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Выплата (ожид.)</span>
          <span className="text-white">{formatDate(schedule.nextExpectedDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Зачисление (ожид.)</span>
          <span className="text-white">{formatDate(schedule.nextExpectedCreditDate)}</span>
        </div>
      </div>
      <div className="text-gray-600 text-[10px] mt-2">На основе последней выплаты</div>
    </div>
  );
}
```

- [ ] **Step 3: Create AssetDetailPage**

Create `src/pages/asset-detail-page.tsx`:
```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { IncomeChart } from '@/components/shared/income-chart';
import { AssetField } from '@/components/asset-detail/asset-field';
import { ExpectedPayment } from '@/components/asset-detail/expected-payment';
import { useAsset, updateAsset } from '@/hooks/use-assets';
import { usePaymentSchedule, upsertPaymentSchedule } from '@/hooks/use-payment-schedules';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { calcAssetIncomePerMonth, calcYieldPercent } from '@/services/income-calculator';
import { formatCurrencyFull, formatFrequency } from '@/lib/utils';

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assetId = Number(id);
  const asset = useAsset(assetId);
  const schedule = usePaymentSchedule(assetId);
  const { portfolio } = usePortfolioStats();

  if (!asset) {
    return <AppShell title="Загрузка..."><div /></AppShell>;
  }

  const incomePerMonth = schedule
    ? calcAssetIncomePerMonth(asset.quantity, schedule.lastPaymentAmount, schedule.frequencyPerYear)
    : 0;
  const value = (asset.currentPrice ?? asset.averagePrice ?? 0) * asset.quantity;
  const yieldPct = calcYieldPercent(incomePerMonth * 12, value);
  const sharePercent = portfolio.totalValue > 0 ? (value / portfolio.totalValue) * 100 : 0;

  const title = asset.ticker ? `${asset.ticker} · ${asset.name}` : asset.name;

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title={title}>
      <StatBlocks
        incomePerMonth={incomePerMonth}
        totalValue={value}
        yieldPercent={yieldPct}
        portfolioSharePercent={sharePercent}
      />

      <AssetField
        label="Количество"
        value={`${asset.quantity} шт`}
        source={asset.dataSource}
        onSave={(v) => {
          const num = parseInt(v);
          if (num > 0) updateAsset(assetId, { quantity: num, dataSource: 'manual' });
        }}
      />

      {schedule && (
        <>
          <AssetField
            label="Последний дивиденд"
            value={`₽ ${schedule.lastPaymentAmount} / ${asset.ticker ? 'акция' : 'период'}`}
            source={schedule.dataSource}
            onSave={(v) => {
              const num = parseFloat(v.replace(/[₽\s/а-яА-Я]/g, ''));
              if (num > 0) upsertPaymentSchedule(assetId, { ...schedule, lastPaymentAmount: num, dataSource: 'manual' });
            }}
          />
          <AssetField
            label="Частота"
            value={formatFrequency(schedule.frequencyPerYear)}
            source={schedule.dataSource}
            editable={false}
          />
          <ExpectedPayment schedule={schedule} quantity={asset.quantity} />
        </>
      )}

      <IncomeChart cagr={null} />
    </AppShell>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/asset-detail/ src/pages/asset-detail-page.tsx
git commit -m "feat: add asset detail page with editable fields and expected payment"
```

---

### Task 12: Add asset page (manual input)

**Files:**
- Create: `src/pages/add-asset-page.tsx`

- [ ] **Step 1: Create AddAssetPage**

Create `src/pages/add-asset-page.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addAsset } from '@/hooks/use-assets';
import { upsertPaymentSchedule } from '@/hooks/use-payment-schedules';
import { ASSET_TYPE_LABELS, type AssetType } from '@/models/types';

const FREQUENCIES = [
  { value: '1', label: '1 раз в год' },
  { value: '2', label: '2 раза в год' },
  { value: '4', label: '4 раза в год (кварт.)' },
  { value: '12', label: 'Ежемесячно' },
];

export function AddAssetPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const defaultType = (params.get('type') as AssetType) ?? 'stock';

  const [type, setType] = useState<AssetType>(defaultType);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [frequency, setFrequency] = useState('1');

  const [assetValue, setAssetValue] = useState(''); // total value for non-birzha assets
  const isBirzha = type === 'stock' || type === 'bond' || type === 'fund';

  const handleSubmit = async () => {
    if (!name || !paymentAmount) return;
    if (isBirzha && !quantity) return;

    const assetId = await addAsset({
      type,
      name,
      ticker: isBirzha && ticker ? ticker : undefined,
      quantity: isBirzha ? parseInt(quantity) : 1,
      averagePrice: isBirzha && price ? parseFloat(price) : undefined,
      currentPrice: isBirzha
        ? (price ? parseFloat(price) : undefined)
        : (assetValue ? parseFloat(assetValue) : undefined), // store total value as price×1
      faceValue: type === 'bond' ? 1000 : undefined,
      dataSource: 'manual',
    });

    await upsertPaymentSchedule(assetId, {
      frequencyPerYear: parseInt(frequency),
      lastPaymentAmount: parseFloat(paymentAmount),
      dataSource: 'manual',
    });

    navigate(-1);
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Добавить актив">
      <div className="space-y-4">
        <div>
          <Label className="text-gray-400 text-xs">Тип актива</Label>
          <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
            <SelectTrigger className="bg-[#1a1a2e] border-none text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-gray-700">
              {Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key} className="text-white">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-gray-400 text-xs">Название</Label>
          <Input
            className="bg-[#1a1a2e] border-none text-white mt-1"
            placeholder={isBirzha ? 'Сбербанк' : 'Квартира на Ленина'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {isBirzha && (
          <div>
            <Label className="text-gray-400 text-xs">Тикер</Label>
            <Input
              className="bg-[#1a1a2e] border-none text-white mt-1"
              placeholder="SBER"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
            />
          </div>
        )}

        {isBirzha && (
          <div>
            <Label className="text-gray-400 text-xs">Количество</Label>
            <Input
              type="number"
              className="bg-[#1a1a2e] border-none text-white mt-1"
              placeholder="800"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        )}

        {isBirzha && (
          <div>
            <Label className="text-gray-400 text-xs">Цена покупки (средняя)</Label>
            <Input
              type="number"
              className="bg-[#1a1a2e] border-none text-white mt-1"
              placeholder="298.60"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        )}

        {!isBirzha && (
          <div>
            <Label className="text-gray-400 text-xs">Оценочная стоимость актива (₽)</Label>
            <Input
              type="number"
              className="bg-[#1a1a2e] border-none text-white mt-1"
              placeholder="5000000"
              value={assetValue}
              onChange={(e) => setAssetValue(e.target.value)}
            />
          </div>
        )}

        <div>
          <Label className="text-gray-400 text-xs">
            {isBirzha ? 'Размер выплаты на 1 шт (₽)' : 'Размер дохода за период (₽)'}
          </Label>
          <Input
            type="number"
            className="bg-[#1a1a2e] border-none text-white mt-1"
            placeholder={isBirzha ? '186' : '45000'}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-gray-400 text-xs">Частота выплат</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger className="bg-[#1a1a2e] border-none text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-gray-700">
              {FREQUENCIES.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-white">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!name || !paymentAmount || (isBirzha && !quantity)}
          className="w-full bg-[#4ecca3] text-black font-semibold hover:bg-[#3dbb92] mt-4"
        >
          Добавить
        </Button>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/add-asset-page.tsx
git commit -m "feat: add manual asset creation form"
```

---

### Task 13: Wire up routing

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Set up React Router**

Replace `src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainPage } from '@/pages/main-page';
import { CategoryPage } from '@/pages/category-page';
import { AssetDetailPage } from '@/pages/asset-detail-page';
import { AddAssetPage } from '@/pages/add-asset-page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/category/:type" element={<CategoryPage />} />
        <Route path="/asset/:id" element={<AssetDetailPage />} />
        <Route path="/add-asset" element={<AddAssetPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Verify app builds**

```bash
npx vite build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Run dev server and manual smoke test**

```bash
npx vite --port 3000
```

Open http://localhost:3000. Verify:
1. Main page shows "Пока нет активов"
2. Drawer opens via ☰
3. Navigate to add asset form
4. Add a stock (e.g., SBER, 800 шт, ₽186 дивиденд, 1×/год)
5. Main page shows category card with calculated income
6. Tap category → asset list
7. Tap asset → detail page with editable fields

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up routing for all pages"
```

---

### Task 14: Run all tests

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (database CRUD + income calculator).

- [ ] **Step 2: Done**

All foundation tasks complete. App is ready for Plan 2 (MOEX API integration).

---

## Summary

After completing this plan, the app will:

1. Build and run as a Vite dev server
2. Show the main screen with normalized passive income (₽/month or ₽/year)
3. Drill down: Main → Category → Asset Detail
4. Allow manual input of any asset type with payment schedule
5. Calculate and display: income per month, total value, yield %, portfolio share %
6. Support inline editing of asset fields with data source tags
7. Show expected dividend block on asset detail
8. Have a drawer menu for navigation
9. Store all data in IndexedDB (persists across sessions)
10. Have unit tests for income calculations and database CRUD

**Not included (other plans):** MOEX API, Sber import, CSV/MD import, AI import, charts with real data, calendar, PWA manifest/service worker, onboarding.
