# UI Polish Batch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five UI tweaks — category income toggles with month/year, yield % replaces portfolio share, asset row badge alignment, per-asset yield display, and backup merged into settings.

**Architecture:** Pure prop/layout changes across 3 independent component groups. No new data layer work — `usePortfolioStats` already provides all needed fields (`totalIncomePerYear`, `yieldPercent`). No new tests — all touched logic is already covered; changes are UI-only.

**Tech Stack:** React 19, Tailwind v4, shadcn/ui `Button`, `calcYieldPercent` from `income-calculator.ts`

**Spec:** `docs/superpowers/specs/2026-03-25-ui-polish-batch-design.md`

---

### Task 1: CategoryCard — income toggles with period + yield % replaces portfolio share

**Files:**
- Modify: `src/components/main/category-card.tsx`
- Modify: `src/pages/main-page.tsx`

- [ ] **Step 1: Update CategoryCard props and rendering**

In `src/components/main/category-card.tsx`, replace `incomePerMonth` with `income` and `portfolioSharePercent` with `yieldPercent`:

```tsx
interface CategoryCardProps {
  type: string;
  assetCount: number;
  income: number | null;
  yieldPercent: number;
}

export function CategoryCard({ type, assetCount, income, yieldPercent }: CategoryCardProps) {
```

In the JSX, update both data bindings (lines 31-32):
- `{formatCurrency(incomePerMonth)}` → `{formatCurrency(income)}`
- `{formatPercent(portfolioSharePercent)}` → `{formatPercent(yieldPercent)}`

- [ ] **Step 2: Update MainPage to pass mode-aware income + yieldPercent**

In `src/pages/main-page.tsx`, update the `CategoryCard` usage (lines 54-58):

```tsx
<CategoryCard
  type={cat.type}
  assetCount={cat.assetCount}
  income={mode === 'month' ? cat.totalIncomePerMonth : cat.totalIncomePerYear}
  yieldPercent={cat.yieldPercent}
/>
```

- [ ] **Step 3: Verify — build passes**

Run: `npm run build`
Expected: No TypeScript errors. The old prop names `incomePerMonth` and `portfolioSharePercent` are gone from both files.

- [ ] **Step 4: Visual verification**

Run: `npm run dev`
Open the main page. Toggle МЕС/ГОД:
- The hero income number changes (existing behavior)
- Each category card income now also changes between monthly and annual values
- Below each income, a yield % is shown instead of portfolio share %

- [ ] **Step 5: Commit**

```bash
git add src/components/main/category-card.tsx src/pages/main-page.tsx
git commit -m "feat: category card — toggle income with period, show yield % instead of share"
```

---

### Task 2: AssetRow — fixed-width badge alignment + per-asset yield %

**Files:**
- Modify: `src/components/category/asset-row.tsx`

- [ ] **Step 1: Add calcYieldPercent import and compute yield**

In `src/components/category/asset-row.tsx`, add `calcYieldPercent` to the import from `income-calculator`:

```tsx
import { calcAssetIncomePerMonth, calcYieldPercent } from '@/services/income-calculator';
```

Add `formatPercent` to the import from `utils`:

```tsx
import { formatCurrency, formatPercent } from '@/lib/utils';
```

Inside the component, after the existing `value` computation (after line 16), add:

```tsx
const totalAnnualIncome = annualIncome * totalQuantity;
const yieldPercent = value != null && value > 0
  ? calcYieldPercent(totalAnnualIncome, value)
  : null;
```

- [ ] **Step 2: Add min-width to badge for alignment**

In the badge `<span>` (line 36), add `min-w-[52px] text-center` to the className:

```tsx
<span className={`font-mono text-[length:var(--way-text-caption)] px-1.5 py-0.5 rounded min-w-[52px] text-center ${
  isManual
    ? 'bg-[rgba(90,85,72,0.15)] text-[var(--way-ash)]'
    : 'bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)]'
}`}>
  {isManual ? 'ручной' : 'факт'}
</span>
```

- [ ] **Step 3: Add yield % line below income + badge row**

Wrap the income+badge flex row and yield line inside a `<div>` to stack them. Replace the current right-side content (lines 34-43):

```tsx
<div>
  <div className="flex items-center gap-1.5 justify-end">
    <span className="font-mono text-[length:var(--way-text-body)] font-medium text-[var(--way-gold)]">{formatCurrency(incomePerMonth)}</span>
    <span className={`font-mono text-[length:var(--way-text-caption)] px-1.5 py-0.5 rounded min-w-[52px] text-center ${
      isManual
        ? 'bg-[rgba(90,85,72,0.15)] text-[var(--way-ash)]'
        : 'bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)]'
    }`}>
      {isManual ? 'ручной' : 'факт'}
    </span>
  </div>
  {yieldPercent != null && (
    <div className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)] text-right mt-0.5">
      {formatPercent(yieldPercent)} годовых
    </div>
  )}
</div>
```

- [ ] **Step 4: Verify — build passes**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 5: Visual verification**

Run: `npm run dev`
Open any category page (e.g., Акции). Check:
- Income amounts are vertically aligned regardless of badge text ("факт" vs "ручной")
- Below income+badge row, yield % is shown (e.g., "12.4% годовых")
- Yield line is absent for assets with no price data

- [ ] **Step 6: Commit**

```bash
git add src/components/category/asset-row.tsx
git commit -m "feat: asset row — align badges, show per-asset yield %"
```

---

### Task 3: Merge backup into settings + cleanup

**Files:**
- Modify: `src/pages/settings-page.tsx`
- Modify: `src/components/layout/drawer-menu.tsx`
- Modify: `src/App.tsx`
- Delete: `src/pages/backup-page.tsx`

- [ ] **Step 1: Add backup functionality to settings page**

In `src/pages/settings-page.tsx`:

Add imports:
```tsx
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { exportAllData, importAllData } from '@/services/backup';
```

Add state and handlers inside `SettingsPage` (after `handleClear`):
```tsx
const fileRef = useRef<HTMLInputElement>(null);
const [status, setStatus] = useState<string | null>(null);
const [backupError, setBackupError] = useState<string | null>(null);

const handleExport = async () => {
  const json = await exportAllData();
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cashflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Бэкап сохранён');
};

const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const json = await file.text();
    JSON.parse(json);
    if (!confirm('Это заменит все текущие данные. Продолжить?')) return;
    await importAllData(json);
    setStatus('Данные восстановлены');
    setBackupError(null);
  } catch {
    setBackupError('Ошибка: невалидный JSON файл');
  }
};
```

Add backup sections in JSX between `SettingRow` and the danger zone `<div>`. The order: default period → export → import → status/error → danger zone:

```tsx
<SettingRow
  label="Период по умолчанию"
  value={settings.defaultPeriod === 'month' ? 'Месяц' : 'Год'}
  onToggle={() => toggle('defaultPeriod', settings.defaultPeriod === 'month' ? 'year' : 'month')}
/>

<div>
  <div className="text-[var(--way-ash)] text-[length:var(--way-text-body)] mb-2">Экспорт</div>
  <Button onClick={handleExport} className="w-full border border-[rgba(200,180,140,0.2)] text-[var(--way-gold)] bg-transparent hover:bg-[rgba(200,180,140,0.06)] font-semibold">
    Скачать бэкап (JSON)
  </Button>
</div>

<div>
  <div className="text-[var(--way-ash)] text-[length:var(--way-text-body)] mb-2">Восстановление</div>
  <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
  <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full border-[rgba(200,180,140,0.08)] text-[var(--way-text)]">
    Загрузить бэкап
  </Button>
</div>

{status && <div className="text-[var(--way-gold)] text-[length:var(--way-text-body)] text-center">{status}</div>}
{backupError && <div className="text-[var(--destructive)] text-[length:var(--way-text-body)] text-center">{backupError}</div>}

<div className="border-t border-[rgba(200,180,140,0.08)] pt-6 mt-8">
  ...danger zone...
</div>
```

Note: the existing `import { useState, useEffect }` must be updated to include `useRef`. The existing `useState` import is already present — just add `useRef` to it.

- [ ] **Step 2: Remove backup menu item from drawer**

In `src/components/layout/drawer-menu.tsx`:

Remove the backup entry from the `'Прочее'` section items array — delete the line:
```tsx
{ label: 'Экспорт / Бэкап', path: '/backup', icon: Save },
```

Remove unused `Save` import from lucide-react:
```tsx
import { BarChart3, Database, CalendarDays, Settings } from 'lucide-react';
```

- [ ] **Step 3: Remove backup route and page**

In `src/App.tsx`:

Delete the import:
```tsx
import { BackupPage } from '@/pages/backup-page';
```

Delete the route:
```tsx
<Route path="/backup" element={<BackupPage />} />
```

Delete the file `src/pages/backup-page.tsx`.

- [ ] **Step 4: Verify — build passes**

Run: `npm run build`
Expected: No TypeScript errors. No references to `BackupPage` or `/backup` route remain.

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: All tests pass. No tests reference `backup-page.tsx` (it had no tests).

- [ ] **Step 6: Visual verification**

Run: `npm run dev`
Check:
- Open hamburger menu → "Прочее" section has only "Настройки", no "Экспорт / Бэкап"
- Open Settings page → sections in order: default period toggle, export button, import button, danger zone
- Export button downloads a JSON file
- Navigating to `/backup` directly shows blank (no route)

- [ ] **Step 7: Commit**

```bash
git add src/pages/settings-page.tsx src/components/layout/drawer-menu.tsx src/App.tsx
git rm src/pages/backup-page.tsx
git commit -m "refactor: merge backup into settings page, remove backup route"
```
