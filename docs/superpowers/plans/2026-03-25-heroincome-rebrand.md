# HeroIncome Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app from CashFlow Tracker / Путь / passive-income-tracker to HeroIncome (HI!), including CSS token rename, DB migration, and a first-launch splash screen.

**Architecture:** Mechanical find-replace for all `--way-*` → `--hi-*` and `way-*` → `hi-*` across 29 source files. Cross-DB migration copies IndexedDB data from `CashFlowDB` to `HeroIncomeDB`. Splash screen is a static div in `index.html` animated by vanilla JS in `main.tsx`.

**Tech Stack:** React 19, Dexie (IndexedDB), Tailwind v4, vite-plugin-pwa, Vitest

**Spec:** `docs/superpowers/specs/2026-03-25-heroincome-rebrand-design.md`

---

## File Structure

### Files to create
- `src/db/migrate-db-name.ts` — one-time cross-DB migration script

### Files to modify (Commit 1: Rename)
- `package.json` — name field
- `index.html` — title, splash div
- `vite.config.ts` — PWA manifest name/short_name
- `.github/workflows/deploy.yml` — BASE_URL
- `src/db/database.ts` — class name, constructor arg, export
- `src/main.tsx` — SW scope, DB migration call, splash logic
- `src/index.css` — all `--way-*` vars, `way-*` keyframes, comment
- `src/components/layout/drawer-menu.tsx` — sidebar brand text
- `src/pages/settings-page.tsx` — backup filename
- `CLAUDE.md` — all documentation references
- 28 `.tsx` files referencing `--way-*` vars or `way-*` animations (bulk find-replace)

### Files to modify (Commit 2: Splash Screen)
- `index.html` — add splash div
- `src/main.tsx` — splash animation + localStorage gate

---

## Task 1: CSS Token Rename (--way-* → --hi-*)

**Files:**
- Modify: `src/index.css` (lines 16–33 variables, lines 171–237 keyframes)
- Modify: 28 `.tsx` files containing `var(--way-` or `way-` animation names

- [ ] **Step 1: Rename CSS variable definitions in src/index.css**

In `src/index.css`, replace:
- Line 16: `/* Wabi-Sabi design tokens */` → `/* HeroIncome design tokens */`
- Lines 17–24: `--way-void` → `--hi-void`, `--way-stone` → `--hi-stone`, `--way-gold` → `--hi-gold`, `--way-earth` → `--hi-earth`, `--way-ash` → `--hi-ash`, `--way-shadow` → `--hi-shadow`, `--way-text:` → `--hi-text:`, `--way-muted` → `--hi-muted`
- Lines 27–33: `--way-text-display` → `--hi-text-display`, `--way-text-nav` → `--hi-text-nav`, `--way-text-title` → `--hi-text-title`, `--way-text-heading` → `--hi-text-heading`, `--way-text-body` → `--hi-text-body`, `--way-text-caption` → `--hi-text-caption`, `--way-text-micro` → `--hi-text-micro`

Use global find-replace `--way-` → `--hi-` in `src/index.css`.

- [ ] **Step 2: Rename keyframe definitions in src/index.css**

In `src/index.css`, use global find-replace `way-` → `hi-` for animation names (lines 171–237):
- `way-vt-fade-in` → `hi-vt-fade-in`
- `way-vt-fade-out` → `hi-vt-fade-out`
- `way-fade-in` → `hi-fade-in`
- `way-fade-slide-up` → `hi-fade-slide-up`
- `way-fade-slide-down` → `hi-fade-slide-down`
- `way-fade-slide-right` → `hi-fade-slide-right`
- `way-fade-scale-in` → `hi-fade-scale-in`
- `way-panel-in` → `hi-panel-in`
- `way-bar-grow` → `hi-bar-grow`
- `way-highlight-pulse` → `hi-highlight-pulse`

Also update the `.animate-highlight-pulse` class at line 236: `way-highlight-pulse` → `hi-highlight-pulse`.

- [ ] **Step 3: Bulk rename --way- references in all .tsx files**

Run global find-replace `--way-` → `--hi-` across all files in `src/`:

Files affected (28 files):
```
src/components/layout/drawer-menu.tsx
src/components/layout/app-shell.tsx
src/pages/settings-page.tsx
src/pages/main-page.tsx
src/pages/category-page.tsx
src/pages/asset-detail-page.tsx
src/pages/data-page.tsx
src/pages/payments-page.tsx
src/components/category/asset-row.tsx
src/components/main/category-card.tsx
src/components/main/hero-income.tsx
src/components/asset-detail/expected-payment.tsx
src/components/asset-detail/asset-field.tsx
src/components/shared/payment-history-chart.tsx
src/components/shared/stat-blocks.tsx
src/components/data/import-flow.tsx
src/components/data/account-section.tsx
src/components/data/inline-cell.tsx
src/components/data/type-combobox.tsx
src/components/data/add-asset-sheet.tsx
src/components/data/add-account-sheet.tsx
src/components/data/import-preview.tsx
src/components/payments/asset-payments.tsx
src/components/payments/payment-row.tsx
src/components/payments/type-section.tsx
src/components/payments/add-payment-form.tsx
src/components/pwa-update-prompt.tsx
src/components/error-boundary.tsx
```

- [ ] **Step 4: Rename way-* animation references in .tsx files**

Run global find-replace for animation name references:
- `way-fade-slide-up` → `hi-fade-slide-up` (in `src/components/main/hero-income.tsx`)
- `way-fade-in` → `hi-fade-in` (in `src/components/main/hero-income.tsx`)
- `way-fade-scale-in` → `hi-fade-scale-in` (in `src/components/main/hero-income.tsx`)
- `way-panel-in` → `hi-panel-in` (in `src/components/shared/payment-history-chart.tsx`)
- `way-bar-grow` → `hi-bar-grow` (in `src/components/shared/payment-history-chart.tsx`)
- `way-fade-slide-right` → `hi-fade-slide-right` (in `src/pages/main-page.tsx`)

Note: the view-transition references (`way-vt-fade-in`, `way-vt-fade-out`) in `::view-transition-old/new` at lines 180/183 of `src/index.css` are already handled by the global rename in Step 2.

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Clean build, no errors. All CSS var references should resolve.

- [ ] **Step 6: Verify dev server renders correctly**

Run: `npm run dev` and visually check the main page renders with correct colors and animations.

---

## Task 2: App Identity Rename

**Files:**
- Modify: `package.json:2`
- Modify: `index.html:12`
- Modify: `vite.config.ts:18-19`
- Modify: `src/components/layout/drawer-menu.tsx:39`
- Modify: `src/pages/settings-page.tsx:38`
- Modify: `.github/workflows/deploy.yml:28`
- Modify: `src/main.tsx:12`

- [ ] **Step 1: Rename package.json and update lockfile**

In `package.json` line 2:
```json
"name": "passive-income-tracker",
```
→
```json
"name": "heroincome",
```

Then run `npm install` to update `package-lock.json` with the new name.

- [ ] **Step 2: Rename HTML title**

In `index.html` line 12:
```html
<title>CashFlow Tracker</title>
```
→
```html
<title>HeroIncome</title>
```

- [ ] **Step 3: Rename PWA manifest**

In `vite.config.ts` lines 18–19:
```ts
name: 'CashFlow Tracker',
short_name: 'CashFlow',
```
→
```ts
name: 'HeroIncome',
short_name: 'HI!',
```

- [ ] **Step 4: Rename sidebar brand**

In `src/components/layout/drawer-menu.tsx` line 39, replace `Путь` with `HeroIncome`:
```tsx
<SheetTitle className="font-serif text-[length:var(--hi-text-title)] font-light text-[var(--hi-gold)]">HeroIncome</SheetTitle>
```

Note: the `--way-*` in this line should already be `--hi-*` from Task 1.

- [ ] **Step 5: Rename backup filename**

In `src/pages/settings-page.tsx` line 38:
```ts
a.download = `cashflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
```
→
```ts
a.download = `heroincome-backup-${new Date().toISOString().slice(0, 10)}.json`;
```

- [ ] **Step 6: Update deploy path**

In `.github/workflows/deploy.yml` line 28:
```yaml
BASE_URL: /way/
```
→
```yaml
BASE_URL: /heroincome/
```

- [ ] **Step 7: Update SW scope cleanup in main.tsx**

In `src/main.tsx` line 12:
```ts
if (scope === '/' || scope === '/way') {
```
→
```ts
if (scope === '/' || scope === '/way' || scope === '/heroincome') {
```

Keep `/way` in the list to clean up SWs from the old deploy path.

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: Clean build.

---

## Task 3: Database Name Migration

**Files:**
- Modify: `src/db/database.ts` (lines 13, 21, 125)
- Create: `src/db/migrate-db-name.ts`
- Modify: `src/main.tsx` (add migration call)

- [ ] **Step 1: Write migration test**

Create `tests/db/migrate-db-name.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';

// We'll test the migration logic directly
import { migrateDbName } from '@/db/migrate-db-name';

describe('migrateDbName', () => {
  beforeEach(async () => {
    // Clean up any leftover DBs
    await Dexie.delete('CashFlowDB').catch(() => {});
    await Dexie.delete('HeroIncomeDB').catch(() => {});
  });

  afterEach(async () => {
    await Dexie.delete('CashFlowDB').catch(() => {});
    await Dexie.delete('HeroIncomeDB').catch(() => {});
  });

  it('does nothing if old DB does not exist', async () => {
    await migrateDbName();
    // Should complete without error
    const dbs = await Dexie.getDatabaseNames();
    expect(dbs).not.toContain('CashFlowDB');
  });

  it('copies data from CashFlowDB to HeroIncomeDB', async () => {
    // Seed old DB with test data
    const oldDb = new Dexie('CashFlowDB');
    oldDb.version(1).stores({ assets: '++id, type' });
    await oldDb.table('assets').add({ type: 'stock', name: 'Test Asset' });
    const oldCount = await oldDb.table('assets').count();
    expect(oldCount).toBe(1);
    oldDb.close();

    // Run migration
    await migrateDbName();

    // Verify new DB has the data
    const newDb = new Dexie('HeroIncomeDB');
    newDb.version(1).stores({ assets: '++id, type' });
    const newCount = await newDb.table('assets').count();
    expect(newCount).toBe(1);
    const asset = await newDb.table('assets').toCollection().first();
    expect(asset.name).toBe('Test Asset');
    newDb.close();

    // Verify old DB is deleted
    const dbs = await Dexie.getDatabaseNames();
    expect(dbs).not.toContain('CashFlowDB');
  });

  it('preserves data when opened by app DB class with upgrade functions', async () => {
    // Seed old DB at version 6 (current production schema)
    const oldDb = new Dexie('CashFlowDB');
    oldDb.version(6).stores({
      accounts: '++id',
      assets: '++id, type, ticker, isin',
      holdings: '++id, accountId, assetId, &[accountId+assetId]',
      paymentHistory: '++id, [assetId+date]',
      importRecords: '++id, date',
      settings: 'key',
    });
    await oldDb.table('assets').add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencySource: 'moex',
      quantitySource: 'manual', quantity: 10,
    });
    await oldDb.table('paymentHistory').add({
      assetId: 1, date: '2026-01-15', amount: 100,
    });
    oldDb.close();

    // Run migration
    await migrateDbName();

    // Open with the REAL app DB class (has versions 1-6 with upgrade functions)
    // Import dynamically to avoid side effects
    const { db } = await import('@/db/database');
    await db.open();

    // CRITICAL: verify data survived — v5 upgrade must NOT have run clear()
    const assetCount = await db.assets.count();
    expect(assetCount).toBe(1);
    const asset = await db.assets.toCollection().first();
    expect(asset!.ticker).toBe('SBER');

    const historyCount = await db.paymentHistory.count();
    expect(historyCount).toBe(1);

    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/migrate-db-name.test.ts`
Expected: FAIL — module `@/db/migrate-db-name` does not exist.

- [ ] **Step 3: Implement migrate-db-name.ts**

Create `src/db/migrate-db-name.ts`:

```ts
import Dexie from 'dexie';

const OLD_DB_NAME = 'CashFlowDB';
const NEW_DB_NAME = 'HeroIncomeDB';

export async function migrateDbName(): Promise<void> {
  // Check if old DB exists
  const dbNames = await Dexie.getDatabaseNames();
  if (!dbNames.includes(OLD_DB_NAME)) return;

  // Check if new DB already has data (migration already done partially)
  if (dbNames.includes(NEW_DB_NAME)) return;

  try {
    // Open old DB dynamically (no schema needed for reading)
    const oldDb = new Dexie(OLD_DB_NAME);
    await oldDb.open();
    const tableNames = oldDb.tables.map((t) => t.name);

    // Read all data from all tables
    const allData: Record<string, unknown[]> = {};
    for (const name of tableNames) {
      allData[name] = await oldDb.table(name).toArray();
    }
    oldDb.close();

    // Build schema and read version from old DB
    const newDb = new Dexie(NEW_DB_NAME);
    const schema: Record<string, string> = {};
    const oldDb2 = new Dexie(OLD_DB_NAME);
    await oldDb2.open();
    const oldVersion = oldDb2.verno; // CRITICAL: preserve version number
    for (const table of oldDb2.tables) {
      schema[table.name] = table.schema.primKey.src +
        (table.schema.indexes.length ? ',' + table.schema.indexes.map((i) => i.src).join(',') : '');
    }
    oldDb2.close();

    // Create new DB at SAME version as old DB — prevents Dexie from
    // running upgrade functions (v5 does clear()!) on the migrated data
    newDb.version(oldVersion).stores(schema);
    await newDb.open();

    // Write all data to new DB
    await newDb.transaction('rw', newDb.tables, async () => {
      for (const name of tableNames) {
        if (allData[name].length > 0) {
          await newDb.table(name).bulkAdd(allData[name]);
        }
      }
    });
    newDb.close();

    // Delete old DB
    await Dexie.delete(OLD_DB_NAME);
  } catch (err) {
    console.error('DB migration failed, keeping old DB:', err);
    // Don't throw — old DB is still intact, app should try to open it as fallback
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/db/migrate-db-name.test.ts`
Expected: PASS

- [ ] **Step 5: Rename database class**

In `src/db/database.ts`:
- Line 13: `class CashFlowDB extends Dexie {` → `class HeroIncomeDB extends Dexie {`
- Line 21: `super('CashFlowDB');` → `super('HeroIncomeDB');`
- Line 125: `export const db = new CashFlowDB();` → `export const db = new HeroIncomeDB();`

- [ ] **Step 6: Add migration call to main.tsx**

In `src/main.tsx`, add migration call before `createRoot`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { migrateDbName } from './db/migrate-db-name';
import App from './App';
import './index.css';

// Cleanup: unregister any SW that was previously registered at wrong scope
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      const scope = new URL(reg.scope).pathname;
      if (scope === '/' || scope === '/way' || scope === '/heroincome') {
        reg.unregister();
      }
    }
  });
}

// Migrate old DB name before React mounts
migrateDbName().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
```

- [ ] **Step 7: Run full test suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 8: Run build**

Run: `npm run build`
Expected: Clean build.

---

## Task 4: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update deploy path references**

Line 55: `GitHub Pages at subpath `/way/`. CI sets `BASE_URL=/way/`` → `GitHub Pages at subpath `/heroincome/`. CI sets `BASE_URL=/heroincome/``

- [ ] **Step 2: Update design system section**

Line 57: `### Design system (Wabi-Sabi)` → `### Design system (HeroIncome)`
Line 59: `--way-*` → `--hi-*`, `--way-void` → `--hi-void`, etc.
Line 61: `Custom keyframes prefixed `way-`.` → `Custom keyframes prefixed `hi-`.`
Lines 67–73: All `--way-text-*` → `--hi-text-*` in the typography table
Line 75: `var(--way-text-heading)` → `var(--hi-text-heading)`

- [ ] **Step 3: Verify no remaining --way- references**

Run: `grep -r "\-\-way-" CLAUDE.md`
Expected: No matches.

---

## Task 5: Commit 1 — All Renames

- [ ] **Step 1: Run full test suite before commit**

Run: `npm run test`
Expected: All pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean.

- [ ] **Step 3: Stage and commit**

```bash
git add package.json package-lock.json index.html vite.config.ts CLAUDE.md \
  .github/workflows/deploy.yml \
  src/index.css src/main.tsx src/db/database.ts src/db/migrate-db-name.ts \
  src/components/ src/pages/ \
  tests/db/migrate-db-name.test.ts
git commit -m "refactor: rebrand to HeroIncome — rename all identifiers, CSS tokens, DB name

Rename --way-* → --hi-*, way-* → hi-* animations, CashFlow → HeroIncome,
deploy path /way/ → /heroincome/, add cross-DB migration CashFlowDB → HeroIncomeDB."
```

---

## Task 6: Splash Screen (separate commit)

**Files:**
- Modify: `index.html` — add splash div
- Modify: `src/main.tsx` — splash animation logic + localStorage gate

- [ ] **Step 1: Add splash div to index.html**

In `index.html`, add the splash div inside `<body>` before `<div id="root">`:

```html
<body class="bg-[#0c0b09]">
  <!-- First-launch splash screen (removed by JS after animation) -->
  <div id="splash" style="
    position:fixed; inset:0; z-index:9999;
    display:flex; align-items:center; justify-content:center;
    background:#c8b48c;
    font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
    font-weight:700; font-size:min(15vw,64px); color:#0c0b09;
    transition: opacity 0.5s ease;
  ">
    <span id="s-H">H</span><span id="s-e" class="s-fill">e</span><span id="s-r" class="s-fill">r</span><span id="s-o1" class="s-fill">o</span><span id="s-I">I</span><span id="s-n" class="s-fill">n</span><span id="s-c" class="s-fill">c</span><span id="s-o2" class="s-fill">o</span><span id="s-m" class="s-fill">m</span><span id="s-e2" class="s-fill">e</span><span id="s-bang">!</span>
  </div>
  <style>
    .s-fill { display:inline-block; width:0; overflow:hidden; opacity:0; }
    #s-bang { transition: opacity 0.3s ease; }
  </style>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

- [ ] **Step 2: Add splash animation logic to main.tsx**

Add splash handling in `src/main.tsx` after the migration call, before `createRoot`:

```tsx
// Splash screen: show only on first launch
function runSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash) return;

  if (localStorage.getItem('hi-splash-seen')) {
    splash.remove();
    return;
  }

  localStorage.setItem('hi-splash-seen', '1');

  const fills = splash.querySelectorAll<HTMLElement>('.s-fill');
  const bang = document.getElementById('s-bang');

  // Measure natural widths
  const widths: number[] = [];
  fills.forEach((f) => {
    f.style.cssText = 'width:auto;opacity:1;position:absolute;visibility:hidden;';
    widths.push(f.getBoundingClientRect().width);
    f.style.cssText = 'width:0;overflow:hidden;opacity:0;';
  });

  // Hero fills: indices 0,1,2 (e,r,o). Income fills: indices 3,4,5,6,7 (n,c,o,m,e)
  const heroFills = [0, 1, 2];
  const incomeFills = [3, 4, 5, 6, 7];
  const revealDuration = 600; // ms for both groups
  const startAt = 800; // hold HI! for 800ms

  // Reveal hero group (3 letters over revealDuration)
  heroFills.forEach((idx, i) => {
    setTimeout(() => {
      fills[idx].style.transition = 'width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease';
      fills[idx].style.width = widths[idx] + 'px';
      fills[idx].style.opacity = '1';
    }, startAt + (i / 3) * revealDuration);
  });

  // Reveal income group (5 letters over same revealDuration)
  incomeFills.forEach((idx, i) => {
    setTimeout(() => {
      fills[idx].style.transition = 'width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease';
      fills[idx].style.width = widths[idx] + 'px';
      fills[idx].style.opacity = '1';
    }, startAt + (i / 5) * revealDuration);
  });

  // Fade out !
  setTimeout(() => {
    if (bang) bang.style.opacity = '0';
  }, startAt + revealDuration);

  // Hold result, then fade out entire splash
  setTimeout(() => {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }, 2000);
}
```

Update the render block — mount React in parallel with splash (splash is z-index overlay, app loads underneath):

```tsx
migrateDbName().then(() => {
  // Mount React immediately — splash overlay covers it during animation
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  // Run splash animation (or remove if already seen)
  runSplash();
});
```

- [ ] **Step 3: Test locally**

Run: `npm run dev`, open in browser.
- First visit: should see gold splash with HI! → HeroIncome animation, then app
- Refresh: should skip splash, load app immediately
- Clear `localStorage.removeItem('hi-splash-seen')` in console, refresh: splash should appear again

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 5: Stage and commit**

```bash
git add index.html src/main.tsx
git commit -m "feat: add first-launch splash screen (HI! → HeroIncome animation)"
```

---

## Task 7: Update Design Docs

**Files:**
- Modify: `docs/design-concepts.html`
- Modify: `docs/mockups/design-ux-v2.html`

- [ ] **Step 1: Update docs/design-concepts.html**

Replace "WAY" with "HeroIncome" and `.c3-way` CSS class references. Update title.

- [ ] **Step 2: Update docs/mockups/design-ux-v2.html**

Replace "CashFlow Tracker" with "HeroIncome".

- [ ] **Step 3: Commit**

```bash
git add docs/design-concepts.html docs/mockups/design-ux-v2.html
git commit -m "docs: update design docs with HeroIncome branding"
```

---

## Task 8: GitHub Repo Rename (manual)

This is done manually via GitHub Settings, not by code changes.

- [ ] **Step 1: Rename repo on GitHub**

GitHub → Settings → Repository name → change `passive-income-tracker` to `heroincome`.

- [ ] **Step 2: Update local git remote**

```bash
git remote set-url origin git@github.com:<username>/heroincome.git
```

- [ ] **Step 3: Verify deploy works**

Push to main, verify GitHub Pages deploys to `<username>.github.io/heroincome/`.
