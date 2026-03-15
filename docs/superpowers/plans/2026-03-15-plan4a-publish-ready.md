# Plan 4a: Publish-Ready — PWA, Charts, Settings, Backup

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app installable as a PWA, replace chart placeholder with real category breakdown, add settings page and JSON backup/restore — everything needed to deploy and use the app daily.

**Architecture:** PWA via `vite-plugin-pwa` (Workbox under the hood). Settings stored as key-value pairs in existing `settings` table. Export/import dumps all Dexie tables to JSON. Chart uses pure CSS bars (no charting library) from existing portfolio stats data.

**Tech Stack:** vite-plugin-pwa, Workbox (auto-generated Service Worker), Dexie.js, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-passive-income-tracker-design.md` (sections 2.3, 3.2, 4.4)

**Design decisions:**
- SVG icon for manifest (broad browser support, no PNG generation tooling needed)
- `registerType: 'autoUpdate'` — Service Worker updates silently, no user prompt
- IncomeChart shows category income bars (horizontal, colored by asset type) — not a time-series (requires PaymentHistory which isn't populated yet)
- Settings minimal: default period (month/year), auto-MOEX sync on launch, clear all data
- Export = full JSON dump of all tables. Import = clear + restore. Version field for future migrations.
- No confirmation dialog for "clear data" — using the browser's native `confirm()` for MVP simplicity

---

## File Structure

```
public/
└── icon.svg                    # App icon (₽ on dark background)

src/services/
├── app-settings.ts             # Get/set app settings from DB
└── backup.ts                   # Export/import all data as JSON

src/pages/
├── settings-page.tsx           # Settings controls
└── backup-page.tsx             # Export + restore buttons

src/components/shared/
└── income-chart.tsx            # REPLACE: category income bars
```

Modified files:
- `vite.config.ts` — add vite-plugin-pwa
- `index.html` — add meta tags (theme-color, icon)
- `src/App.tsx` — add /settings and /backup routes
- `src/pages/main-page.tsx` — pass categories to IncomeChart, auto-sync on mount

---

## Chunk 1: PWA + Charts

### Task 1: PWA setup

**Files:**
- Modify: `vite.config.ts`
- Modify: `index.html`
- Create: `public/icon.svg`

- [ ] **Step 1: Install vite-plugin-pwa**

Run: `cd ~/passive-income-tracker && npm install -D vite-plugin-pwa`

- [ ] **Step 2: Create app icon**

Create `public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0d1117"/>
  <text x="256" y="350" text-anchor="middle" font-size="300" font-weight="bold" fill="#4ecca3" font-family="system-ui,sans-serif">₽</text>
</svg>
```

- [ ] **Step 3: Configure vite-plugin-pwa**

Update `vite.config.ts`:

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CashFlow Tracker',
        short_name: 'CashFlow',
        description: 'Трекер пассивного дохода',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
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

- [ ] **Step 4: Update index.html meta tags**

Update `index.html`:

```html
<!DOCTYPE html>
<html lang="ru" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0d1117" />
  <meta name="description" content="Трекер пассивного дохода" />
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/icon.svg" />
  <title>CashFlow Tracker</title>
</head>
<body class="bg-[#0d1117]">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Verify build generates manifest and SW**

Run: `cd ~/passive-income-tracker && npm run build && ls dist/manifest.webmanifest dist/sw.js`
Expected: both files exist

- [ ] **Step 6: Run all tests → PASS**

Run: `cd ~/passive-income-tracker && npx vitest run`

- [ ] **Step 7: Commit**

```bash
cd ~/passive-income-tracker
git add public/icon.svg vite.config.ts index.html package.json package-lock.json
git commit -m "feat: add PWA manifest, icon, and Service Worker via vite-plugin-pwa"
```

---

### Task 2: IncomeChart upgrade

**Files:**
- Modify: `src/components/shared/income-chart.tsx`
- Modify: `src/pages/main-page.tsx`

- [ ] **Step 1: Replace IncomeChart with category income bars**

Replace `src/components/shared/income-chart.tsx`:

```tsx
import { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS, type AssetType } from '@/models/types';
import { formatCurrency } from '@/lib/utils';

export interface CategoryIncome {
  type: AssetType;
  incomePerMonth: number;
}

interface IncomeChartProps {
  categories: CategoryIncome[];
  cagr?: number | null;
}

export function IncomeChart({ categories, cagr }: IncomeChartProps) {
  const maxIncome = Math.max(...categories.map((c) => c.incomePerMonth), 1);

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-3 mt-4">
      {cagr != null && (
        <div className="text-center text-[13px] font-bold text-[#4ecca3] mb-2">
          CAGR {cagr > 0 ? '+' : ''}{cagr.toFixed(1)}%
        </div>
      )}

      {categories.length === 0 ? (
        <div className="h-11 flex items-center justify-center text-gray-600 text-xs">
          График будет доступен при наличии активов
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.type}>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-gray-400">{ASSET_TYPE_LABELS[cat.type]}</span>
                <span className="text-gray-300">{formatCurrency(cat.incomePerMonth)}/мес</span>
              </div>
              <div className="bg-[#0d1117] rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${(cat.incomePerMonth / maxIncome) * 100}%`,
                    backgroundColor: ASSET_TYPE_COLORS[cat.type],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update main-page.tsx to pass categories**

In `src/pages/main-page.tsx`, change the `<IncomeChart>` call from:

```tsx
<IncomeChart cagr={null} />
```

to:

```tsx
<IncomeChart
  categories={categories.map((cat) => ({
    type: cat.type,
    incomePerMonth: cat.totalIncomePerMonth,
  }))}
  cagr={null}
/>
```

- [ ] **Step 3: Update category-page.tsx and asset-detail-page.tsx**

These pages also use `<IncomeChart>`. Update them to pass `categories={[]}` (the chart shows a placeholder when empty, which is fine for these sub-pages where only the parent stat blocks matter):

In `src/pages/category-page.tsx`, change `<IncomeChart cagr={null} />` to `<IncomeChart categories={[]} cagr={null} />`.

In `src/pages/asset-detail-page.tsx`, change `<IncomeChart cagr={null} />` to `<IncomeChart categories={[]} cagr={null} />`.

- [ ] **Step 4: Run all tests → PASS**

- [ ] **Step 5: Commit**

```bash
cd ~/passive-income-tracker
git add src/components/shared/income-chart.tsx src/pages/main-page.tsx \
  src/pages/category-page.tsx src/pages/asset-detail-page.tsx
git commit -m "feat: replace chart placeholder with category income bars"
```

---

## Chunk 2: Settings + Backup

### Task 3: Settings service + page

**Files:**
- Create: `src/services/app-settings.ts`
- Create: `tests/services/app-settings.test.ts`
- Create: `src/pages/settings-page.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/main-page.tsx`

- [ ] **Step 1: Write failing tests for settings service**

Create `tests/services/app-settings.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { getAppSettings, updateAppSetting, type AppSettings } from '@/services/app-settings';

describe('app-settings', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('returns defaults when no settings exist', async () => {
    const settings = await getAppSettings();
    expect(settings.defaultPeriod).toBe('month');
    expect(settings.autoMoexSync).toBe(true);
  });

  it('persists and reads a setting', async () => {
    await updateAppSetting('defaultPeriod', 'year');
    const settings = await getAppSettings();
    expect(settings.defaultPeriod).toBe('year');
  });

  it('persists autoMoexSync as boolean-like string', async () => {
    await updateAppSetting('autoMoexSync', 'false');
    const settings = await getAppSettings();
    expect(settings.autoMoexSync).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests → FAIL**

- [ ] **Step 3: Implement settings service**

Create `src/services/app-settings.ts`:

```typescript
import { db } from '@/db/database';

export interface AppSettings {
  defaultPeriod: 'month' | 'year';
  autoMoexSync: boolean;
}

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await db.table('settings').toArray();
  const map = new Map(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    defaultPeriod: (map.get('defaultPeriod') ?? 'month') as 'month' | 'year',
    autoMoexSync: map.get('autoMoexSync') !== 'false',
  };
}

export async function updateAppSetting(key: string, value: string): Promise<void> {
  await db.table('settings').put({ key, value });
}

export async function clearAllData(): Promise<void> {
  await db.delete();
  await db.open();
}
```

- [ ] **Step 4: Run tests → PASS**

- [ ] **Step 5: Create settings page**

Create `src/pages/settings-page.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { getAppSettings, updateAppSetting, clearAllData, type AppSettings } from '@/services/app-settings';

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getAppSettings().then(setSettings);
  }, []);

  const toggle = async (key: string, value: string) => {
    await updateAppSetting(key, value);
    setSettings(await getAppSettings());
  };

  const handleClear = async () => {
    if (!confirm('Удалить все данные? Это действие необратимо.')) return;
    await clearAllData();
    navigate('/');
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  if (!settings) return <AppShell leftAction={backButton} title="Настройки"><div /></AppShell>;

  return (
    <AppShell leftAction={backButton} title="Настройки">
      <div className="space-y-6">
        <SettingRow
          label="Период по умолчанию"
          value={settings.defaultPeriod === 'month' ? 'Месяц' : 'Год'}
          onToggle={() => toggle('defaultPeriod', settings.defaultPeriod === 'month' ? 'year' : 'month')}
        />

        <SettingRow
          label="Автообновление MOEX"
          value={settings.autoMoexSync ? 'Вкл' : 'Выкл'}
          onToggle={() => toggle('autoMoexSync', settings.autoMoexSync ? 'false' : 'true')}
        />

        <div className="border-t border-gray-800 pt-6 mt-8">
          <div className="text-red-400 text-xs uppercase tracking-widest mb-3">Опасная зона</div>
          <button
            onClick={handleClear}
            className="w-full py-3 rounded-lg border border-red-900 text-red-400 text-sm
              hover:bg-red-900/20 transition-colors"
          >
            Удалить все данные
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function SettingRow({ label, value, onToggle }: {
  label: string; value: string; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-300 text-sm">{label}</span>
      <button
        onClick={onToggle}
        className="bg-[#1a1a2e] text-[#4ecca3] text-sm px-3 py-1.5 rounded-lg"
      >
        {value}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Add /settings route to App.tsx**

Add import: `import { SettingsPage } from '@/pages/settings-page';`
Add route: `<Route path="/settings" element={<SettingsPage />} />`

- [ ] **Step 7: Wire auto-MOEX sync on main page mount**

In `src/pages/main-page.tsx`, add auto-sync logic. Add `useEffect` and `useRef` imports, then add this after the existing hooks:

```tsx
import { useEffect, useRef } from 'react';
import { getAppSettings } from '@/services/app-settings';

// Inside MainPage component, after useMoexSync():
const autoSyncDone = useRef(false);
useEffect(() => {
  if (autoSyncDone.current) return;
  autoSyncDone.current = true;
  getAppSettings().then((s) => {
    if (s.autoMoexSync) sync();
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Also wire `defaultPeriod` from settings as the initial mode:

```tsx
// Replace: const [mode, setMode] = useState<'month' | 'year'>('month');
// With:
const [mode, setMode] = useState<'month' | 'year'>('month');
useEffect(() => {
  getAppSettings().then((s) => setMode(s.defaultPeriod));
}, []);
```

- [ ] **Step 8: Run all tests → PASS**

- [ ] **Step 9: Commit**

```bash
cd ~/passive-income-tracker
git add src/services/app-settings.ts tests/services/app-settings.test.ts \
  src/pages/settings-page.tsx src/App.tsx src/pages/main-page.tsx
git commit -m "feat: add settings page with default period, auto-sync, and data clear"
```

---

### Task 4: Export/backup service + page

**Files:**
- Create: `src/services/backup.ts`
- Create: `tests/services/backup.test.ts`
- Create: `src/pages/backup-page.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing tests for backup service**

Create `tests/services/backup.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { exportAllData, importAllData } from '@/services/backup';

describe('backup', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('exports and imports data round-trip', async () => {
    const now = new Date();
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 800, dataSource: 'manual',
      createdAt: now, updatedAt: now,
    });
    await db.paymentSchedules.add({
      assetId: 1, frequencyPerYear: 1,
      lastPaymentAmount: 34.84, dataSource: 'moex',
    });

    const json = await exportAllData();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.paymentSchedules).toHaveLength(1);

    // Clear and restore
    await db.assets.clear();
    await db.paymentSchedules.clear();
    expect(await db.assets.count()).toBe(0);

    await importAllData(json);
    expect(await db.assets.count()).toBe(1);
    expect(await db.paymentSchedules.count()).toBe(1);

    const asset = (await db.assets.toArray())[0];
    expect(asset.ticker).toBe('SBER');
    expect(asset.quantity).toBe(800);
  });

  it('exports empty database', async () => {
    const json = await exportAllData();
    const parsed = JSON.parse(json);
    expect(parsed.assets).toHaveLength(0);
  });

  it('import clears existing data before restoring', async () => {
    await db.assets.add({
      type: 'stock', name: 'Old', quantity: 1,
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });

    const json = JSON.stringify({
      version: 1, exportedAt: new Date().toISOString(),
      assets: [], paymentSchedules: [], paymentHistory: [],
      importRecords: [], settings: [],
    });

    await importAllData(json);
    expect(await db.assets.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests → FAIL**

- [ ] **Step 3: Implement backup service**

Create `src/services/backup.ts`:

```typescript
import { db } from '@/db/database';

export async function exportAllData(): Promise<string> {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    assets: await db.assets.toArray(),
    paymentSchedules: await db.paymentSchedules.toArray(),
    paymentHistory: await db.paymentHistory.toArray(),
    importRecords: await db.importRecords.toArray(),
    settings: await db.table('settings').toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json);

  await db.transaction(
    'rw',
    db.assets,
    db.paymentSchedules,
    db.paymentHistory,
    db.importRecords,
    async () => {
      await db.assets.clear();
      await db.paymentSchedules.clear();
      await db.paymentHistory.clear();
      await db.importRecords.clear();
      await db.table('settings').clear();

      if (data.assets?.length) await db.assets.bulkAdd(data.assets);
      if (data.paymentSchedules?.length) await db.paymentSchedules.bulkAdd(data.paymentSchedules);
      if (data.paymentHistory?.length) await db.paymentHistory.bulkAdd(data.paymentHistory);
      if (data.importRecords?.length) await db.importRecords.bulkAdd(data.importRecords);
      if (data.settings?.length) {
        for (const s of data.settings) await db.table('settings').put(s);
      }
    },
  );
}
```

- [ ] **Step 4: Run tests → PASS**

- [ ] **Step 5: Create backup page**

Create `src/pages/backup-page.tsx`:

```tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { exportAllData, importAllData } from '@/services/backup';

export function BackupPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
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
      JSON.parse(json); // validate JSON
      if (!confirm('Это заменит все текущие данные. Продолжить?')) return;
      await importAllData(json);
      setStatus('Данные восстановлены');
      setError(null);
    } catch {
      setError('Ошибка: невалидный JSON файл');
    }
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Экспорт / Бэкап">
      <div className="space-y-6">
        <div>
          <div className="text-gray-400 text-xs mb-2">Экспорт</div>
          <Button
            onClick={handleExport}
            className="w-full bg-[#4ecca3] text-black font-semibold hover:bg-[#3dbb92]"
          >
            💾 Скачать бэкап (JSON)
          </Button>
        </div>

        <div>
          <div className="text-gray-400 text-xs mb-2">Восстановление</div>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="w-full border-gray-700 text-gray-300"
          >
            📂 Загрузить бэкап
          </Button>
        </div>

        {status && <div className="text-[#4ecca3] text-xs text-center">{status}</div>}
        {error && <div className="text-red-400 text-xs text-center">{error}</div>}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 6: Add /backup route to App.tsx**

Add import: `import { BackupPage } from '@/pages/backup-page';`
Add route: `<Route path="/backup" element={<BackupPage />} />`

- [ ] **Step 7: Run all tests → PASS**

- [ ] **Step 8: Commit**

```bash
cd ~/passive-income-tracker
git add src/services/backup.ts tests/services/backup.test.ts \
  src/pages/backup-page.tsx src/App.tsx
git commit -m "feat: add JSON export/import backup with round-trip restore"
```
