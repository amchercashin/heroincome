# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # TypeScript check + production build
npm run test       # Vitest (all tests)
npx vitest run tests/services/income-calculator.test.ts  # Single test file
```

## Architecture

Local-first PWA for tracking passive income from stocks, bonds, deposits, real estate, and funds. No backend — all data stored in IndexedDB via Dexie. External reads only: MOEX ISS API for prices/dividends.

**Stack:** React 19 + React Router v7 (SPA) + Dexie (IndexedDB) + Tailwind v4 + shadcn/ui + vite-plugin-pwa + Vitest

### Data flow

```
MOEX API / Import files → services/ (pure parsing) → Dexie DB → useLiveQuery hooks → React components
                                                        ↑
                                                   User edits (inline)
```

- **`src/models/types.ts`** — all domain types. `Asset` is the central entity with source-tracking fields (`paymentPerUnitSource`, `frequencySource`, `quantitySource`) distinguishing calculated/imported values from manual overrides.
- **`src/db/database.ts`** — Dexie schema with versioned migrations. V4 merged PaymentSchedule into Asset; understand the upgrade function before adding fields.
- **`src/services/`** — pure functions: `income-calculator.ts` (income math), `moex-api.ts` (API parsing), `moex-sync.ts` (orchestration), `import-*.ts` (CSV/HTML/markdown parsing + diffing), `backup.ts` (JSON export/import).
- **`src/hooks/`** — reactive data layer via `useLiveQuery`. `usePortfolioStats()` is the heaviest computation (income, yield, portfolio share per asset/category).
- **`src/contexts/sync-context.tsx`** — MOEX sync orchestration. Provides `syncing`, `lastSyncAt`, `triggerSync()`, `syncAsset()`. Auto-syncs on mount; prevents duplicate requests.
- **`src/pages/`** — one file per route. Asset detail page uses inline editing with source badges (ф = fact/moex, р = manual) and reset buttons.
- **`src/components/ui/`** — shadcn-generated components. Do not edit by hand; use `npx shadcn@latest add <component>`.

### Source-aware income model

Every income-related field on `Asset` tracks its origin:
- `paymentPerUnitSource`: `'fact'` (calculated from payment history) or `'manual'` (user override)
- `frequencySource`: `'moex'` or `'manual'`
- `quantitySource`: `'import'` or `'manual'`

Manual values override calculated ones. Reset buttons revert to the calculated/imported value.

### View Transitions

Page navigation uses the View Transitions API for smooth crossfades. `src/lib/view-transition.ts` exports `withViewTransition(cb)` which wraps callbacks with `document.startViewTransition` and `flushSync`. `src/components/ui/transition-link.tsx` is a drop-in replacement for React Router's `Link` — use `TransitionLink` instead of `Link` for all in-app navigation.

### Tooling details

- **Tailwind v4** — no `tailwind.config` file. All theme config is in `src/index.css` via `@theme inline` + `@tailwindcss/vite` plugin.
- **Vitest** — config embedded in `vite.config.ts`. Environment: `happy-dom`, globals enabled. Setup file `tests/setup.ts` imports `fake-indexeddb/auto` and `@testing-library/jest-dom/vitest`.
- **TypeScript** — strict mode with `noUnusedLocals` and `noUnusedParameters`.
- **PWA** — `vite-plugin-pwa` with `generateSW` strategy. Auto-reload on new deploy.
- **Deploy** — GitHub Pages at subpath `/heroincome/`. CI sets `BASE_URL=/heroincome/` env var; `vite.config.ts` reads it for `base`. Workflow in `.github/workflows/deploy.yml`.

### Design system (HeroIncome)

**Colors** defined as CSS variables `--hi-*` in `src/index.css`. Key tokens: `--hi-void` (darkest bg), `--hi-stone` (cards), `--hi-gold` (accents), `--hi-text` (foreground).

**Fonts:** DM Sans (sans), Cormorant Garamond (serif), IBM Plex Mono (mono). Custom keyframes prefixed `hi-`.

**Fluid typography** — 7 responsive tokens using `clamp()` in `src/index.css`, scaling between 320px and 430px viewports:

| Token | Range | Usage |
|-------|-------|-------|
| `--hi-text-display` | 40–56px | Hero income sum |
| `--hi-text-nav` | 20–24px | Nav icons ☰ ‹ ⟳ |
| `--hi-text-title` | 16–20px | Page titles |
| `--hi-text-heading` | 14–16px | Values, tickers, category names |
| `--hi-text-body` | 12–14px | Income amounts, buttons, secondary data |
| `--hi-text-caption` | 11–13px | Labels, badges, meta-info |
| `--hi-text-micro` | 10–11px | Chart annotations, sync time |

Apply via `text-[length:var(--hi-text-heading)]`. Do not use hardcoded `text-[Xpx]` for font sizes — always use a token. Exception: `text-base` (16px) on inputs must stay for iOS zoom prevention.

## Conventions

- **Russian UI text** — all user-facing strings are in Russian; preserve this when modifying UI.
- **Dark mode only** — hardcoded in `<html class="dark">`, no toggle.
- **Path alias** — `@/*` maps to `src/*`.
- **Tests** — in `tests/` mirroring `src/` structure. Use `fake-indexeddb` for DB tests. Pure function tests dominate; no component tests.
- **Dexie transactions** — asset mutations (`addAsset`, `updateAsset`, `deleteAsset`) are wrapped in Dexie transactions in `use-assets.ts`.
- **iOS hardening** — `viewport-fit=cover` in index.html, `touch-action: manipulation` on html, `font-size: 16px` on all inputs (prevents Safari auto-zoom), safe-area insets for bottom sheets. Do not remove these.
- **Navigation** — use `TransitionLink` (not `Link`) for in-app navigation; use `withViewTransition()` for programmatic `navigate()` calls.
