# HeroIncome Rebrand Design

**Date:** 2026-03-25
**Status:** Approved

## Summary

Rebrand the app from "CashFlow Tracker" / "Путь" / "passive-income-tracker" to **HeroIncome** (short: **HI!**). Includes renaming all identifiers, updating deploy path, renaming the GitHub repo, and adding a first-launch splash screen.

## Rename Map

| Location | File(s) | Before | After |
|----------|---------|--------|-------|
| Package name | `package.json` | `passive-income-tracker` | `heroincome` |
| HTML title | `index.html` | `CashFlow Tracker` | `HeroIncome` |
| PWA name | `vite.config.ts` | `CashFlow Tracker` | `HeroIncome` |
| PWA short_name | `vite.config.ts` | `CashFlow` | `HI!` |
| DB class name | `src/db/database.ts` | `CashFlowDB` | `HeroIncomeDB` |
| DB instance name | `src/db/database.ts` | `CashFlowDB` (constructor arg) | `HeroIncomeDB` |
| Sidebar brand | `src/components/layout/drawer-menu.tsx` | `Путь` | `HeroIncome` |
| Deploy path | `.github/workflows/deploy.yml` | `/way/` | `/heroincome/` |
| 404 redirect | `public/404.html` | — | **no change** (uses `pathSegmentsToKeep=1`, no hardcoded path) |
| SW scope check | `src/main.tsx` | `/way` | `/heroincome` (keep `/way` in cleanup list for old SWs) |
| Backup filename | `src/pages/settings-page.tsx` | `cashflow-backup-*` | `heroincome-backup-*` |
| CSS color tokens | `src/index.css` | `--way-void`, `--way-stone`, etc. | `--hi-void`, `--hi-stone`, etc. |
| CSS typography tokens | `src/index.css` | `--way-text-display`, etc. | `--hi-text-display`, etc. |
| CSS comment | `src/index.css` | `/* Wabi-Sabi design tokens */` | `/* HeroIncome design tokens */` |
| Keyframe animations | `src/index.css` | `way-fade-in`, `way-fade-scale-in`, etc. | `hi-fade-in`, `hi-fade-scale-in`, etc. |
| All CSS var references | `src/**/*.tsx`, `src/**/*.css` | `var(--way-*)` | `var(--hi-*)` |
| All animation references | `src/**/*.tsx`, `src/**/*.css` | `way-*` animation names | `hi-*` animation names |
| Design docs | `docs/design-concepts.html`, `docs/mockups/design-ux-v2.html` | WAY / CashFlow Tracker references | HeroIncome references |
| CLAUDE.md | `CLAUDE.md` | `--way-*`, `way-*`, `/way/` references | `--hi-*`, `hi-*`, `/heroincome/` |
| Russian description | everywhere | `Трекер пассивного дохода` | **no change** |
| App icon (₽ on gold) | `public/` | — | **no change** |
| App.tsx / vite.config.ts base | — | — | **no change** (reads `BASE_URL` env var dynamically) |

**Note:** Historical planning docs under `docs/superpowers/specs/` are out of scope — they describe the state at time of writing and don't need updating.

### Database migration (cross-DB copy)

The IndexedDB database **name** changes from `'CashFlowDB'` to `'HeroIncomeDB'`. This is NOT a Dexie version migration — it creates an entirely new database. A one-time data migration script must:

1. On app startup (before opening the new DB), check if `CashFlowDB` exists via `indexedDB.databases()` or try-open
2. If it exists: open `CashFlowDB` with Dexie, read all tables (assets, etc.)
3. Open `HeroIncomeDB`, write the data in
4. Delete `CashFlowDB` via `Dexie.delete('CashFlowDB')`
5. Continue with normal app startup

**Location:** `src/db/migrate-db-name.ts` — called from `main.tsx` before `createRoot()`
**Blocking:** Yes — must complete before React mounts (async/await)
**Error handling:** If copy succeeds but delete fails — proceed (old DB becomes orphaned but no data loss). If copy fails — keep old DB, alert user.
**Version schema:** `HeroIncomeDB` class must declare the same version history (all 6 versions) as the old `CashFlowDB` so Dexie can open the new DB correctly.

### GitHub repo rename

Rename `passive-income-tracker` → `heroincome` via GitHub settings. GitHub auto-redirects the old URL. Update:
- `deploy.yml` — any repo references
- `vite.config.ts` — `base` path reads `BASE_URL` env var (already dynamic, just update CI)
- Local git remote URL

## Splash Screen

### Behavior

- Shown **only on first launch** — controlled by `localStorage.getItem('hi-splash-seen')`
- If flag is absent: show splash, then set `localStorage.setItem('hi-splash-seen', '1')`
- If flag is present: skip splash entirely, render app immediately

### Visual design

- **Full-screen overlay** on top of the app root
- **Background:** `#c8b48c` (--hi-gold)
- **Text color:** `#0c0b09` (--hi-void)
- **Font:** system font stack, bold, ~64px (fluid, scales with viewport)
- **Initial state:** `HI!` centered on screen — H, I, and ! visible

### Animation sequence

1. **Hold** (0–800ms): `HI!` displayed static, centered
2. **Reveal** (800–1400ms): Two groups animate simultaneously:
   - **Hero group:** `e`, `r`, `o` expand between H and I with smooth easing (`cubic-bezier(0.4, 0, 0.2, 1)`), width transitions ~350ms each
   - **Income group:** `n`, `c`, `o`, `m`, `e` expand after I with same easing
   - Both groups start at 800ms. Hero (3 letters) has wider intervals, Income (5 letters) has tighter intervals — both finish at ~1400ms
   - `!` fades out (opacity 0, 300ms ease) starting at ~1350ms
3. **Result hold** (1400–2000ms): `HeroIncome` displayed centered
4. **Fade out** (2000–2500ms): entire splash overlay fades to transparent, revealing the app underneath

### Implementation

- Rendered as a static `<div id="splash">` in `index.html` — visible immediately, no dependency on React/JS bundle loading
- Vanilla JS in `src/main.tsx` (before `createRoot()`) checks localStorage, runs animation or removes the div
- Pure CSS animations + JS timeouts for sequencing
- Uses system font stack intentionally — must display before custom fonts load
- No external dependencies
- After fade-out completes: remove splash DOM node entirely

### Commit strategy

The splash screen is implemented in a **separate commit** from the rename changes, so it can be reverted independently.

## Commit Plan

1. **Commit 1:** Rename all identifiers (CSS vars, animations, package name, PWA manifest, DB class, sidebar, deploy path, docs)
2. **Commit 2:** Add splash screen component + localStorage gate
3. **Commit 3 (manual):** Rename GitHub repo via settings, update git remote

## Out of Scope

- New app icon design (keeping ₽ on gold)
- Changing the Russian description text
- Any functional changes to the app
