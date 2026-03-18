# Wabi-Sabi Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный визуальный редизайн PWA в стилистике Wabi-Sabi — палитра, типографика, анимации, все экраны.

**Architecture:** Фундамент (CSS-переменные, шрифты, keyframes) → утилиты (useCountUp) → layout (AppShell, DrawerMenu) → компоненты снизу вверх (shared → main → category → asset-detail → pages). Каждый таск — самодостаточный коммит.

**Tech Stack:** React 19, Tailwind v4, shadcn/ui, Lucide React, CSS @keyframes, requestAnimationFrame

**Spec:** `docs/superpowers/specs/2026-03-18-wabi-sabi-redesign.md`

---

## Chunk 1: Foundation

### Task 1: Install fonts and remove Geist

**Files:**
- Modify: `package.json`
- Modify: `src/index.css:4`

- [ ] **Step 1: Install new font packages**

Run:
```bash
npm install @fontsource/cormorant-garamond @fontsource/ibm-plex-mono @fontsource/dm-sans
```

- [ ] **Step 2: Uninstall Geist**

Run:
```bash
npm uninstall @fontsource-variable/geist
```

- [ ] **Step 3: Update font imports in index.css**

Replace line 4:
```css
@import "@fontsource-variable/geist";
```
with:
```css
@import "@fontsource/cormorant-garamond/300.css";
@import "@fontsource/cormorant-garamond/400.css";
@import "@fontsource/ibm-plex-mono/300.css";
@import "@fontsource/ibm-plex-mono/400.css";
@import "@fontsource/ibm-plex-mono/500.css";
@import "@fontsource/dm-sans/300.css";
@import "@fontsource/dm-sans/400.css";
@import "@fontsource/dm-sans/500.css";
```

- [ ] **Step 4: Update @theme inline font-sans**

In `src/index.css`, inside `@theme inline`, replace:
```css
--font-sans: 'Geist Variable', sans-serif;
```
with:
```css
--font-sans: 'DM Sans', sans-serif;
--font-serif: 'Cormorant Garamond', serif;
--font-mono: 'IBM Plex Mono', monospace;
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No errors. Fonts changed globally.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/index.css
git commit -m "feat: replace Geist with Cormorant Garamond, IBM Plex Mono, DM Sans"
```

---

### Task 2: Replace CSS palette and shadcn tokens

**Files:**
- Modify: `src/index.css` (`:root`, `.dark`, `@theme inline`)

- [ ] **Step 1: Add --way-* custom properties inside existing :root**

In `src/index.css`, add `--way-*` properties inside the existing `:root { ... }` block (before the first `--background` line). Do NOT create a second `:root` block:

```css
    /* Wabi-Sabi design tokens */
    --way-void: #0c0b09;
    --way-stone: #1a1815;
    --way-gold: #c8b48c;
    --way-earth: #8b7355;
    --way-ash: #5a5548;
    --way-shadow: #3a3530;
    --way-text: #b0a898;
    --way-muted: #4a4540;
```

- [ ] **Step 2: Update .dark block with shadcn mapping**

Replace the entire `.dark { ... }` block with:

```css
.dark {
    --background: #0c0b09;
    --foreground: #b0a898;
    --card: #1a1815;
    --card-foreground: #b0a898;
    --popover: #1a1815;
    --popover-foreground: #b0a898;
    --primary: #c8b48c;
    --primary-foreground: #0c0b09;
    --secondary: #1a1815;
    --secondary-foreground: #b0a898;
    --muted: #1a1815;
    --muted-foreground: #4a4540;
    --accent: #1a1815;
    --accent-foreground: #b0a898;
    --destructive: #b8413a;
    --border: rgba(200,180,140,0.08);
    --input: #1a1815;
    --ring: #c8b48c;
    --chart-1: #c8b48c;
    --chart-2: #8b7355;
    --chart-3: #5a5548;
    --chart-4: #3a3530;
    --chart-5: #4a4540;
    --sidebar: #0c0b09;
    --sidebar-foreground: #b0a898;
    --sidebar-primary: #c8b48c;
    --sidebar-primary-foreground: #0c0b09;
    --sidebar-accent: #1a1815;
    --sidebar-accent-foreground: #b0a898;
    --sidebar-border: rgba(200,180,140,0.08);
    --sidebar-ring: #c8b48c;
}
```

- [ ] **Step 3: Update :root color tokens to match .dark**

Since app is dark-only, replace only the **color token values** in the existing `:root` block to match `.dark` values above. This prevents a flash of white on load.

**IMPORTANT:** Do NOT delete or modify `--radius`, `--radius-*`, or the `@theme inline` block — only replace the color-related `--background`, `--foreground`, `--card`, etc. tokens. The structural tokens (`--radius: 0.625rem` etc.) and `@theme inline` mappings must remain unchanged.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors. shadcn components now use wabi-sabi palette.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat: wabi-sabi palette and shadcn token mapping"
```

---

### Task 3: Add CSS keyframes for animations

**Files:**
- Modify: `src/index.css` (add at end)

- [ ] **Step 1: Add keyframes after @layer base**

Append to `src/index.css`:

```css
@keyframes way-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes way-fade-slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes way-fade-slide-down {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes way-fade-slide-right {
  from { opacity: 0; transform: translateX(-16px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes way-fade-scale-in {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes way-bar-grow {
  from { opacity: 0; transform: scaleY(0); }
  to { opacity: 1; transform: scaleY(1); }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add wabi-sabi animation keyframes"
```

---

### Task 4: Update ASSET_TYPE_COLORS to earth tones

**Files:**
- Modify: `src/models/types.ts:14-21`

- [ ] **Step 1: Replace ASSET_TYPE_COLORS**

Replace lines 14-21:
```typescript
export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  stock: '#c8b48c',
  bond: '#8b7355',
  fund: '#a09080',
  realestate: '#7a6a5a',
  deposit: '#6b8070',
  other: '#5a5548',
};
```

- [ ] **Step 2: Verify build and tests**

Run: `npm run build && npm run test`
Expected: All pass. Colors are only used in UI rendering.

- [ ] **Step 3: Commit**

```bash
git add src/models/types.ts
git commit -m "feat: earth-tone asset type colors"
```

---

### Task 5: Create useCountUp hook

**Files:**
- Create: `src/hooks/use-count-up.ts`

- [ ] **Step 1: Write the hook**

Create `src/hooks/use-count-up.ts`:

```typescript
import { useState, useEffect, useRef } from 'react';

export function useCountUp(target: number | null, duration = 1200): number | null {
  const [current, setCurrent] = useState<number | null>(null);
  const prevTarget = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) {
      setCurrent(null);
      prevTarget.current = null;
      return;
    }

    if (target === prevTarget.current) return;
    prevTarget.current = target;

    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCurrent(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return current;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-count-up.ts
git commit -m "feat: useCountUp hook for animated number transitions"
```

---

## Chunk 2: Layout Components

### Task 6: Restyle AppShell

**Files:**
- Modify: `src/components/layout/app-shell.tsx`

- [ ] **Step 1: Update styles**

Replace the component body. Key changes:
- `bg-[#0d1117]` → `bg-[var(--way-void)]`
- Header padding: `px-5 pt-4 pb-2` → `px-5 pb-2` with inline style `paddingTop: 'max(38px, env(safe-area-inset-top))'`
- Menu button `text-gray-400` → `text-[var(--way-ash)]`
- Title `text-base font-semibold` stays but add `font-sans` (DM Sans)
- Title color: add `text-[var(--way-text)]`

Full return JSX:
```tsx
return (
  <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
    <div className="min-h-screen bg-[var(--way-void)] text-[var(--way-text)]">
      <header
        className="flex items-center justify-between px-5 pb-2"
        style={{ paddingTop: 'max(38px, env(safe-area-inset-top))' }}
      >
        <div>{leftAction ?? <SheetTrigger asChild>{defaultLeft}</SheetTrigger>}</div>
        {title && <h1 className="text-sm font-medium text-[var(--way-text)]">{title}</h1>}
        <div>{rightAction ?? <div className="w-5" />}</div>
      </header>
      <main className="px-5 pb-8">{children}</main>
    </div>
    <DrawerMenu onClose={() => setDrawerOpen(false)} />
  </Sheet>
);
```

Update `defaultLeft` button: `text-gray-400` → `text-[var(--way-ash)]`

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "feat: restyle AppShell with wabi-sabi palette"
```

---

### Task 7: Restyle DrawerMenu

**Files:**
- Modify: `src/components/layout/drawer-menu.tsx`

- [ ] **Step 1: Add Lucide imports**

Add at top:
```typescript
import { BarChart3, Download, Settings, Save } from 'lucide-react';
```

- [ ] **Step 2: Update MENU_SECTIONS**

Replace `MENU_SECTIONS`:
```typescript
const MENU_SECTIONS = [
  {
    title: 'Просмотр',
    items: [
      { label: 'Мой доход', path: '/', icon: BarChart3 },
    ],
  },
  {
    title: 'Управление',
    items: [
      { label: 'Импорт данных', path: '/import', icon: Download },
    ],
  },
  {
    title: 'Прочее',
    items: [
      { label: 'Настройки', path: '/settings', icon: Settings },
      { label: 'Экспорт / Бэкап', path: '/backup', icon: Save },
    ],
  },
];
```

Note: Calendar item removed (dead route).

- [ ] **Step 3: Update SheetContent and rendering**

```tsx
<SheetContent side="left" className="bg-[var(--way-void)] border-r-[var(--way-stone)] w-64">
  <SheetHeader>
    <SheetTitle className="font-serif text-lg font-light text-[var(--way-gold)]">Путь</SheetTitle>
  </SheetHeader>
  <nav className="mt-6">
    {MENU_SECTIONS.map((section) => (
      <div key={section.title} className="mb-6">
        <div className="text-[8px] uppercase tracking-[0.3em] text-[var(--way-shadow)] mb-2 px-2 font-mono">
          {section.title}
        </div>
        {section.items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            className="flex items-center gap-3 px-2 py-2 text-sm text-[var(--way-text)] hover:bg-[var(--way-stone)] rounded-lg transition-colors"
          >
            <item.icon size={16} strokeWidth={1.2} className="text-[var(--way-ash)]" />
            {item.label}
          </Link>
        ))}
      </div>
    ))}
  </nav>
</SheetContent>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/drawer-menu.tsx
git commit -m "feat: restyle DrawerMenu — Lucide icons, remove Calendar, rename to Путь"
```

---

## Chunk 3: Main Page Components

### Task 8: Restyle HeroIncome with count-up

**Files:**
- Modify: `src/components/main/hero-income.tsx`

- [ ] **Step 1: Add imports and hook**

Add:
```typescript
import { useCountUp } from '@/hooks/use-count-up';
```

- [ ] **Step 2: Replace component body**

```tsx
export function HeroIncome({ income, yieldPercent, totalValue, mode, onToggle }: HeroIncomeProps) {
  const animatedIncome = useCountUp(income);

  return (
    <div className="text-center mb-4" style={{ animation: 'way-fade-slide-up 0.7s ease-out 0.2s both' }}>
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--way-ash)]"
           style={{ animation: 'way-fade-in 0.5s ease-out 0.3s both' }}>
        расчётный пассивный доход
      </div>
      <div className="font-serif text-[44px] font-light text-[var(--way-gold)] tracking-tight mt-1"
           style={{ animation: 'way-fade-scale-in 0.8s ease-out 0.4s both' }}>
        {formatCurrencyFull(animatedIncome)}
      </div>
      <div className="font-mono text-[10px] text-[var(--way-muted)] mt-0.5"
           style={{ animation: 'way-fade-in 0.5s ease-out 0.6s both' }}>
        доходность {formatPercent(yieldPercent)} · портфель {formatCurrency(totalValue)}
      </div>
      <div style={{ animation: 'way-fade-in 0.5s ease-out 0.7s both' }}>
        <button
          onClick={onToggle}
          className="mt-3 inline-flex border border-[rgba(200,180,140,0.12)] rounded overflow-hidden"
        >
          <span className={`px-4 py-1.5 font-mono text-[10px] tracking-[0.15em] transition-colors ${
            mode === 'month'
              ? 'bg-[rgba(200,180,140,0.08)] text-[var(--way-gold)]'
              : 'text-[var(--way-ash)]'
          }`}>
            МЕС
          </span>
          <span className={`px-4 py-1.5 font-mono text-[10px] tracking-[0.15em] transition-colors ${
            mode === 'year'
              ? 'bg-[rgba(200,180,140,0.08)] text-[var(--way-gold)]'
              : 'text-[var(--way-ash)]'
          }`}>
            ГОД
          </span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/main/hero-income.tsx
git commit -m "feat: restyle HeroIncome with wabi-sabi palette and count-up"
```

---

### Task 9: Restyle CategoryCard and MainPage

**Files:**
- Modify: `src/components/main/category-card.tsx`
- Modify: `src/pages/main-page.tsx`

- [ ] **Step 1: Replace component JSX**

```tsx
export function CategoryCard({ type, assetCount, incomePerMonth, portfolioSharePercent }: CategoryCardProps) {
  const color = ASSET_TYPE_COLORS[type];
  const label = ASSET_TYPE_LABELS[type];

  return (
    <Link
      to={`/category/${type}`}
      className="flex items-center justify-between py-3 border-b border-[rgba(200,180,140,0.04)] transition-colors active:bg-[var(--way-stone)]"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-[3px] h-[22px] rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
        <div>
          <div className="text-[13px] text-[var(--way-text)]">{label}</div>
          <div className="font-mono text-[9px] text-[var(--way-muted)]">
            {assetCount} {assetCount === 1 ? 'позиция' : assetCount < 5 ? 'позиции' : 'позиций'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="font-mono text-[12px] font-medium text-[var(--way-gold)]">{formatCurrency(incomePerMonth)}</div>
          <div className="font-mono text-[9px] text-[var(--way-muted)]">{formatPercent(portfolioSharePercent)}</div>
        </div>
        <span className="text-[var(--way-shadow)]">›</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Update stagger animation in MainPage**

In `src/pages/main-page.tsx`, wrap `categories.map` items with animation delay. Replace the categories map:

```tsx
{categories.map((cat, i) => (
  <div key={cat.type} style={{ animation: `way-fade-slide-right 0.5s ease-out ${0.7 + i * 0.15}s both` }}>
    <CategoryCard
      type={cat.type}
      assetCount={cat.assetCount}
      incomePerMonth={cat.totalIncomePerMonth}
      portfolioSharePercent={cat.portfolioSharePercent}
    />
  </div>
))}
```

Also update the empty state and MOEX sync line colors:
- `text-gray-600` → `text-[var(--way-muted)]`
- `text-red-400` → `text-[var(--destructive)]`
- Refresh button `text-gray-400` → `text-[var(--way-ash)]`

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/main/category-card.tsx src/pages/main-page.tsx
git commit -m "feat: restyle CategoryCard and MainPage with stagger animations"
```

---

## Chunk 4: Shared Components

### Task 10: Restyle StatBlocks

**Files:**
- Modify: `src/components/shared/stat-blocks.tsx`

- [ ] **Step 1: Replace component**

```tsx
function statColor(raw: number | null, accent: boolean): string {
  if (raw == null) return 'text-[var(--way-muted)]';
  return accent ? 'text-[var(--way-gold)]' : 'text-[var(--way-text)]';
}

export function StatBlocks({ incomePerMonth, totalValue, yieldPercent, portfolioSharePercent, isManualIncome }: StatBlocksProps) {
  const stats = [
    { label: 'Доход/мес', value: formatCurrency(incomePerMonth), color: statColor(incomePerMonth, true) },
    { label: 'Стоимость', value: formatCurrency(totalValue), color: statColor(totalValue, false) },
    { label: 'Доходность', value: formatPercent(yieldPercent), color: statColor(yieldPercent, true) },
    { label: 'Доля портф.', value: formatPercent(portfolioSharePercent), color: statColor(portfolioSharePercent, false) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="bg-[rgba(200,180,140,0.03)] border border-[rgba(200,180,140,0.04)] rounded-lg p-3 text-center"
        >
          <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--way-shadow)]">{stat.label}</div>
          <div className={`font-mono text-[14px] font-medium mt-1 ${stat.color}`}>
            {stat.value}
          </div>
          {index === 0 && isManualIncome != null && (
            <div className="flex justify-center mt-1">
              <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded ${
                isManualIncome
                  ? 'bg-[rgba(90,85,72,0.15)] text-[var(--way-ash)]'
                  : 'bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)]'
              }`}>
                {isManualIncome ? 'ручной' : 'факт'}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/stat-blocks.tsx
git commit -m "feat: restyle StatBlocks with wabi-sabi palette and source badges"
```

---

### Task 11: Restyle PaymentHistoryChart with bar animation

**Files:**
- Modify: `src/components/shared/payment-history-chart.tsx`

- [ ] **Step 1: Replace full component body**

Replace the entire component function body with:

```tsx
export function PaymentHistoryChart({ history, quantity }: PaymentHistoryChartProps) {
  if (history.length === 0) {
    return (
      <div className="bg-[rgba(200,180,140,0.02)] border border-[rgba(200,180,140,0.04)] rounded-lg p-4 mt-4 text-center font-mono text-[var(--way-muted)] text-xs">
        Нет данных о выплатах
      </div>
    );
  }

  const now = new Date();
  const cagr = calcCAGR(history, now);

  const byYear = new Map<number, number>();
  for (const p of history) {
    const year = p.date.getFullYear();
    byYear.set(year, (byYear.get(year) ?? 0) + p.amount * quantity);
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const values = years.map((y) => byYear.get(y)!);
  const maxValue = Math.max(...values, 1);

  const barOpacity = (i: number) => {
    const min = 0.15;
    const max = 1;
    const t = years.length > 1 ? i / (years.length - 1) : 1;
    return min + t * (max - min);
  };

  return (
    <div className="bg-[rgba(200,180,140,0.02)] rounded-lg p-4 mt-4">
      {cagr != null && (
        <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--way-shadow)] mb-3">
          CAGR {cagr > 0 ? '+' : ''}{cagr.toFixed(1)}%
        </div>
      )}
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {years.map((year, i) => {
          const heightPx = Math.max(Math.round((values[i] / maxValue) * 100), 3);
          return (
            <div key={year} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
              <div
                className="w-full rounded-t min-w-[4px]"
                style={{
                  height: heightPx,
                  background: `rgba(200,180,140,${barOpacity(i)})`,
                  transformOrigin: 'bottom',
                  animation: `way-bar-grow 0.8s ease-out ${1.2 + i * 0.1}s both`,
                }}
                title={formatCurrency(values[i])}
              />
              <span className="font-mono text-[8px] text-[var(--way-shadow)] mt-1 shrink-0">
                &apos;{String(year).slice(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/payment-history-chart.tsx
git commit -m "feat: restyle PaymentHistoryChart with gradient bars and grow animation"
```

---

## Chunk 5: Asset Detail Components

### Task 12: Restyle AssetField badges

**Files:**
- Modify: `src/components/asset-detail/asset-field.tsx`
- Modify: `src/pages/asset-detail-page.tsx` (update sourceLabel props)

- [ ] **Step 1: Replace full AssetField component JSX**

Replace the return JSX (lines 41-99) of `asset-field.tsx`:

```tsx
  return (
    <div className="bg-[var(--way-stone)] rounded-lg p-3 mb-2">
      <div className="font-mono text-[10px] text-[var(--way-ash)] mb-1">{label}</div>
      {editing ? (
        <div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-[var(--way-void)] border border-[var(--way-gold)] rounded-lg px-2 py-1 text-sm text-[var(--way-text)] outline-none font-mono"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <button
              className="bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)] px-2 py-1 rounded-lg text-xs font-mono"
              onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
            >
              ✓
            </button>
          </div>
          {resetLabel && onReset && (
            <button
              className="w-full mt-2 border border-[rgba(200,180,140,0.08)] text-[var(--way-ash)] hover:text-[var(--way-gold)] py-1 rounded-lg text-[11px] font-mono transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                setEditing(false);
                onReset();
              }}
            >
              ↩ {resetLabel}
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center">
            <span
              className={`font-mono text-[14px] text-[var(--way-text)] ${editable ? 'cursor-pointer' : ''}`}
              onClick={() => editable && startEditing()}
            >
              {value}
            </span>
            {sourceLabel && (
              <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded ${
                isManualSource
                  ? 'bg-[rgba(90,85,72,0.15)] text-[var(--way-ash)]'
                  : 'bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)]'
              }`}>
                {sourceLabel}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="font-mono text-[9px] text-[var(--way-muted)] mt-1">{subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
```

- [ ] **Step 2: Update sourceLabel values in asset-detail-page.tsx**

In `src/pages/asset-detail-page.tsx`, update all `sourceLabel` props:
- `sourceLabel={asset.paymentPerUnitSource === 'fact' ? 'ф' : 'р'}` → `sourceLabel={asset.paymentPerUnitSource === 'fact' ? 'факт' : 'ручной'}`
- `sourceLabel={asset.quantitySource === 'import' ? 'import' : 'ручной'}` → stays `'импорт'` / `'ручной'`
- `sourceLabel={asset.frequencySource === 'moex' ? 'moex' : 'ручной'}` → stays `'moex'` / `'ручной'`

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/asset-detail/asset-field.tsx src/pages/asset-detail-page.tsx
git commit -m "feat: restyle AssetField with full wabi-sabi palette and факт/ручной badges"
```

---

### Task 13: Restyle ExpectedPayment

**Files:**
- Modify: `src/components/asset-detail/expected-payment.tsx`

- [ ] **Step 1: Replace styled container**

Change line 26:
```tsx
<div className="bg-gradient-to-br from-[#1a2e1a] to-[#1a1a2e] border border-[#4ecca333] rounded-xl p-3.5 mt-3">
```
to:
```tsx
<div className="border border-[rgba(200,180,140,0.08)] rounded-lg p-3.5 mt-3">
```

- [ ] **Step 2: Update inner text colors**

- Line 27: `text-[#4ecca3]` → `font-mono text-[10px] uppercase tracking-wider text-[var(--way-gold)]`
- Lines 30, 36, 40, 44: `text-gray-400` → `font-mono text-[9px] text-[var(--way-muted)]`
- Lines 31-32, 37, 41, 45: `text-white` → `font-mono text-[13px] text-[var(--way-text)]`

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/asset-detail/expected-payment.tsx
git commit -m "feat: restyle ExpectedPayment with wabi-sabi palette"
```

---

### Task 14: Restyle AssetRow

**Files:**
- Modify: `src/components/category/asset-row.tsx`

- [ ] **Step 1: Replace component JSX**

```tsx
return (
  <Link
    to={`/asset/${asset.id}`}
    className="block py-3 border-b border-[rgba(200,180,140,0.04)] transition-colors active:bg-[var(--way-stone)]"
  >
    <div className="flex justify-between items-center">
      <div>
        <span className="text-[13px] font-medium text-[var(--way-text)]">{asset.ticker ?? asset.name}</span>
        {asset.ticker && (
          <span className="text-[11px] text-[var(--way-muted)] ml-2">{asset.name}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[12px] font-medium text-[var(--way-gold)]">{formatCurrency(incomePerMonth)}</span>
        <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded ${
          isManual
            ? 'bg-[rgba(90,85,72,0.15)] text-[var(--way-ash)]'
            : 'bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)]'
        }`}>
          {isManual ? 'ручной' : 'факт'}
        </span>
      </div>
    </div>
    <div className="flex justify-between font-mono text-[9px] text-[var(--way-muted)] mt-1">
      <span>{asset.quantity} шт · {formatCurrency(value)}</span>
      <span>
        <span className="bg-[rgba(139,115,85,0.12)] text-[var(--way-earth)] px-1.5 py-0.5 rounded text-[9px]">
          {formatFrequency(asset.frequencyPerYear)}
        </span>
        {' '}
        {formatCurrency(incomePerYear)}/год
      </span>
    </div>
  </Link>
);
```

- [ ] **Step 2: Update CategoryPage styles**

In `src/pages/category-page.tsx`:
- Back button: `text-gray-400` → `text-[var(--way-ash)]`
- "+" button: `border-gray-700` → `border-[var(--way-shadow)]`, `text-gray-600` → `text-[var(--way-ash)]`, `active:border-[#4ecca3] active:text-[#4ecca3]` → `active:border-[var(--way-gold)] active:text-[var(--way-gold)]`

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/category/asset-row.tsx src/pages/category-page.tsx
git commit -m "feat: restyle AssetRow and CategoryPage"
```

---

## Chunk 6: Remaining Pages

### Task 15: Restyle AssetDetailPage

**Files:**
- Modify: `src/pages/asset-detail-page.tsx`

- [ ] **Step 1: Update hardcoded colors**

- Back button: `text-gray-400` → `text-[var(--way-ash)]`
- No other hardcoded colors in this file (styling is in child components; sourceLabel updates already done in Task 12).

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/pages/asset-detail-page.tsx
git commit -m "feat: restyle AssetDetailPage"
```

---

### Task 16: Restyle AddAssetPage

**Files:**
- Modify: `src/pages/add-asset-page.tsx`

- [ ] **Step 1: Update all hardcoded colors**

Search and replace patterns:
- `bg-[#1a1a2e]` → `bg-[var(--way-stone)]`
- `bg-[#0d1117]` → `bg-[var(--way-void)]`
- `text-white` → `text-[var(--way-text)]`
- `text-gray-400` / `text-gray-500` / `text-gray-600` → `text-[var(--way-muted)]` or `text-[var(--way-ash)]` as appropriate
- `border-gray-700` / `border-gray-800` → `border-[rgba(200,180,140,0.08)]`
- `bg-[#4ecca3]` / `text-[#4ecca3]` → `text-[var(--way-gold)]` / `border-[var(--way-gold)]`
- Active/selected type buttons: `border-[#4ecca3]` → `border-[var(--way-gold)]`
- Submit button: `bg-[#4ecca3] text-black` → `border border-[rgba(200,180,140,0.2)] text-[var(--way-gold)] bg-transparent hover:bg-[rgba(200,180,140,0.06)]`
- Input backgrounds: keep `bg-[var(--way-stone)]`
- Focus rings: `focus:ring-[#4ecca3]` → `focus:ring-[var(--way-gold)]`

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/pages/add-asset-page.tsx
git commit -m "feat: restyle AddAssetPage"
```

---

### Task 17: Restyle Import pages

**Files:**
- Modify: `src/pages/import-page.tsx`
- Modify: `src/pages/import-sber-page.tsx`
- Modify: `src/pages/import-ai-page.tsx`
- Modify: `src/pages/import-file-page.tsx`
- Modify: `src/pages/import-preview-page.tsx`

- [ ] **Step 1: Apply same color replacement pattern to all 5 files**

Same substitutions as Task 16:
- All `bg-[#1a1a2e]` → `bg-[var(--way-stone)]`
- All `bg-[#0d1117]` → `bg-[var(--way-void)]`
- All `text-white` → `text-[var(--way-text)]`
- All `text-gray-*` → appropriate `--way-*` token
- All `#4ecca3` references → `var(--way-gold)`
- All `border-gray-*` → `border-[rgba(200,180,140,0.08)]`
- Back buttons: `text-gray-400` → `text-[var(--way-ash)]`

For `import-preview-page.tsx` status badges:
- "added" green → `bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)]`
- "changed" yellow → `bg-[rgba(139,115,85,0.12)] text-[var(--way-earth)]`
- "unchanged" gray → `bg-[rgba(90,85,72,0.1)] text-[var(--way-ash)]`
- "conflict" red → keep destructive: `bg-[rgba(184,65,58,0.15)] text-[var(--destructive)]`

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/pages/import-page.tsx src/pages/import-sber-page.tsx src/pages/import-ai-page.tsx src/pages/import-file-page.tsx src/pages/import-preview-page.tsx
git commit -m "feat: restyle all Import pages"
```

---

### Task 18: Restyle Settings and Backup pages

**Files:**
- Modify: `src/pages/settings-page.tsx`
- Modify: `src/pages/backup-page.tsx`

- [ ] **Step 1: Apply color replacements to both files**

Same pattern as Task 16-17. Key elements:
- Toggle switches: accent `#4ecca3` → `var(--way-gold)`
- Danger buttons (clear data): keep `var(--destructive)` red
- Info text: `text-gray-*` → `text-[var(--way-muted)]`
- Backgrounds: `bg-[#1a1a2e]` → `bg-[var(--way-stone)]`

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/pages/settings-page.tsx src/pages/backup-page.tsx
git commit -m "feat: restyle Settings and Backup pages"
```

---

## Chunk 7: Final Verification

### Task 19: Full build and visual check

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Zero errors.

- [ ] **Step 2: Run tests**

Run: `npm run test`
Expected: All tests pass (no visual tests, only logic).

- [ ] **Step 3: Dev server visual check**

Run: `npm run dev`
Check each screen:
1. Main page — gold income, earth-tone categories, bar chart with grow animation
2. Category page — stat blocks, asset rows with frequency badges
3. Asset detail — fact/manual badges, expected payment, chart
4. Add asset — form inputs in stone/gold
5. Import pages — all 5 sub-pages
6. Settings — toggles in gold
7. Backup — buttons in gold/destructive
8. Drawer menu — «Путь», Lucide icons, no Calendar

- [ ] **Step 4: Clean up brainstorm HTML files**

```bash
rm docs/brainstorm-*.html
```

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: visual polish after full review"
```
