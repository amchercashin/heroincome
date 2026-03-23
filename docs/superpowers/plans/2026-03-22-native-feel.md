# Native Feel PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PWA feel native on mobile — fix iOS auto-zoom, prevent overflow, disable browser behaviors (overscroll, text selection, context menu), add page transitions.

**Architecture:** Global CSS fixes in `index.css` + structural layout change in AppShell (fixed header + scrollable main) + font-size fixes on all custom inputs + custom View Transitions utility for page transitions (BrowserRouter doesn't support React Router's built-in viewTransition).

**Tech Stack:** CSS (Tailwind v4), React 19, View Transitions API, React Router v7

**Spec:** `docs/superpowers/specs/2026-03-22-native-feel-design.md`

---

### Task 1: Global CSS patch — native behavior rules

**Files:**
- Modify: `src/index.css:138-148`

- [ ] **Step 1: Add native-feel CSS rules to `@layer base`**

In `src/index.css`, replace the existing `@layer base` block with:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
    touch-action: manipulation;
  }
  /* iOS auto-zoom prevention — safety net for inputs without explicit Tailwind font-size */
  input, textarea, select {
    font-size: 16px;
  }
  /* Disable text selection and context menu on interactive elements */
  button, a, nav, header, label, [role="button"] {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
}
```

Changes from current:
- Removed `overflow-x-hidden` from body — the new AppShell layout handles overflow structurally.
- Added `touch-action: manipulation` on html — disables 300ms tap delay and double-tap-to-zoom.
- Added `input, textarea, select { font-size: 16px }` — safety net for iOS auto-zoom.
- Added `user-select: none` + `-webkit-touch-callout: none` on interactive elements only.

- [ ] **Step 2: Run build to verify no CSS errors**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add native-feel CSS — prevent iOS auto-zoom, text selection, context menu, tap delay"
```

---

### Task 2: Restructure AppShell — fixed header + scrollable main

**Files:**
- Modify: `src/components/layout/app-shell.tsx:25-34`

- [ ] **Step 1: Change AppShell layout structure**

In `src/components/layout/app-shell.tsx`, replace:

```tsx
<div className="min-h-screen bg-[var(--way-void)] text-[var(--way-text)]">
  <header className="flex items-center justify-between px-5 pb-2" style={{ paddingTop: 'max(38px, env(safe-area-inset-top))' }}>
    <div>{leftAction ?? <SheetTrigger asChild>{defaultLeft}</SheetTrigger>}</div>
    {title && <h1 className="text-sm font-medium text-[var(--way-text)]">{title}</h1>}
    <div>{rightAction ?? <div className="w-5" />}</div>
  </header>
  <main className="px-5 pb-8">{children}</main>
</div>
```

with:

```tsx
<div className="h-[100vh] h-[100dvh] flex flex-col overflow-hidden bg-[var(--way-void)] text-[var(--way-text)]">
  <header className="flex-shrink-0 flex items-center justify-between px-5 pb-2" style={{ paddingTop: 'max(38px, env(safe-area-inset-top))' }}>
    <div>{leftAction ?? <SheetTrigger asChild>{defaultLeft}</SheetTrigger>}</div>
    {title && <h1 className="text-sm font-medium text-[var(--way-text)]">{title}</h1>}
    <div>{rightAction ?? <div className="w-5" />}</div>
  </header>
  <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none px-5 pb-8">{children}</main>
</div>
```

Key changes:
- `min-h-screen` → `h-[100vh] h-[100dvh] flex flex-col overflow-hidden` — fixed frame. `h-[100vh]` is fallback for older browsers (< iOS 15.4, < Chrome 108); `h-[100dvh]` overrides in modern browsers and accounts for Safari address bar and Android gesture bar
- `flex-shrink-0` on header — stays fixed
- `flex-1 overflow-y-auto overflow-x-hidden overscroll-none` on main — single scroll zone, no bounce

Note: `scrollIntoView` is used in `account-section.tsx` and `asset-payments.tsx`. It should continue to work because `scrollIntoView` traverses the ancestor chain to find the nearest scrollable container (`<main>`), but this must be verified in Task 7.

- [ ] **Step 2: Run dev server and verify on mobile emulation**

Run: `npm run dev`
Check in Chrome DevTools mobile emulation (iPhone 14):
- Header stays fixed when scrolling
- Content scrolls inside main only
- No horizontal scroll possible
- No overscroll bounce

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "feat: restructure AppShell — fixed header + scrollable main with overflow protection"
```

---

### Task 3: Fix input font sizes — prevent iOS auto-zoom

**Files:**
- Modify: `src/components/data/add-account-sheet.tsx:39`
- Modify: `src/components/data/import-flow.tsx:241,269`
- Modify: `src/components/data/add-asset-sheet.tsx:78-79`
- Modify: `src/components/asset-detail/asset-field.tsx:52`
- Modify: `src/components/payments/add-payment-form.tsx:36,44`
- Modify: `src/components/data/inline-cell.tsx:46`
- Modify: `src/components/data/type-combobox.tsx:88`

- [ ] **Step 1: Fix add-account-sheet.tsx**

In `src/components/data/add-account-sheet.tsx`, line 39, change:
```
text-sm text-[var(--way-text)]
```
to:
```
text-base text-[var(--way-text)]
```

- [ ] **Step 2: Fix import-flow.tsx**

In `src/components/data/import-flow.tsx`:

Line 241 (textarea), change:
```
text-sm text-[var(--way-text)]
```
to:
```
text-base text-[var(--way-text)]
```

Line 269 (account name input), change:
```
text-sm text-[var(--way-text)]
```
to:
```
text-base text-[var(--way-text)]
```

- [ ] **Step 3: Fix add-asset-sheet.tsx**

In `src/components/data/add-asset-sheet.tsx`, line 78-79, change the `inputCls` variable:
```tsx
const inputCls =
  'w-full bg-[var(--way-stone)] border border-[var(--way-shadow)] rounded-lg px-3 py-2 text-sm text-[var(--way-text)] placeholder:text-[var(--way-muted)] outline-none focus:border-[var(--way-gold)]';
```
to:
```tsx
const inputCls =
  'w-full bg-[var(--way-stone)] border border-[var(--way-shadow)] rounded-lg px-3 py-2 text-base text-[var(--way-text)] placeholder:text-[var(--way-muted)] outline-none focus:border-[var(--way-gold)]';
```

- [ ] **Step 4: Fix asset-field.tsx**

In `src/components/asset-detail/asset-field.tsx`, line 52, change:
```
text-sm text-[var(--way-text)]
```
to:
```
text-base text-[var(--way-text)]
```

- [ ] **Step 5: Fix add-payment-form.tsx**

In `src/components/payments/add-payment-form.tsx`:

Line 36 (date input), change:
```
text-[12px] text-[var(--way-text)]
```
to:
```
text-base text-[var(--way-text)]
```

Line 44 (amount input), change:
```
text-[12px] text-[var(--way-text)]
```
to:
```
text-base text-[var(--way-text)]
```

- [ ] **Step 6: Fix inline-cell.tsx**

In `src/components/data/inline-cell.tsx`, line 46, change:
```tsx
className={`bg-[var(--way-void)] border border-[var(--way-gold)] rounded px-1.5 py-0.5 text-[var(--way-text)] outline-none ${className}`}
```
to:
```tsx
className={`bg-[var(--way-void)] border border-[var(--way-gold)] rounded px-1.5 py-0.5 !text-base text-[var(--way-text)] outline-none ${className}`}
```

The `!text-base` uses Tailwind's important modifier to override the inherited font-size from the parent `className` prop (which passes `text-[13px]`, `text-[11px]`, etc.).

Note: this creates a visible size jump between display mode (13px) and edit mode (16px). This is the expected trade-off — preventing iOS auto-zoom is more important than font-size consistency during editing.

- [ ] **Step 7: Fix type-combobox.tsx**

In `src/components/data/type-combobox.tsx`, line 88, change:
```tsx
className={`bg-[var(--way-void)] border border-[var(--way-gold)] rounded px-1.5 py-0.5 text-[var(--way-text)] outline-none w-full ${className}`}
```
to:
```tsx
className={`bg-[var(--way-void)] border border-[var(--way-gold)] rounded px-1.5 py-0.5 !text-base text-[var(--way-text)] outline-none w-full ${className}`}
```

Same `!text-base` override and same size-jump trade-off as inline-cell.

- [ ] **Step 8: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/components/data/add-account-sheet.tsx src/components/data/import-flow.tsx src/components/data/add-asset-sheet.tsx src/components/asset-detail/asset-field.tsx src/components/payments/add-payment-form.tsx src/components/data/inline-cell.tsx src/components/data/type-combobox.tsx
git commit -m "fix: set text-base on all custom inputs — prevent iOS Safari auto-zoom"
```

---

### Task 4: Fix ErrorBoundary layout

**Files:**
- Modify: `src/components/error-boundary.tsx:25`

- [ ] **Step 1: Replace min-h-screen with h-[100dvh]**

In `src/components/error-boundary.tsx`, line 25, change:
```tsx
<div className="min-h-screen bg-[var(--way-void)] flex items-center justify-center p-6">
```
to:
```tsx
<div className="h-[100vh] h-[100dvh] bg-[var(--way-void)] flex items-center justify-center p-6">
```

Note: ErrorBoundary renders outside AppShell (wraps the entire app). Using `h-[100vh] h-[100dvh]` here provides structural overflow protection with `100vh` fallback for older browsers.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/error-boundary.tsx
git commit -m "fix: ErrorBoundary layout — use h-[100dvh] for consistency with AppShell"
```

---

### Task 5: Add View Transitions for page navigation

**Files:**
- Create: `src/lib/view-transition.ts`
- Modify: `src/index.css`
- Modify: `src/components/layout/drawer-menu.tsx`
- Modify: `src/components/main/category-card.tsx`
- Modify: `src/components/category/asset-row.tsx`
- Modify: `src/pages/backup-page.tsx`
- Modify: `src/pages/asset-detail-page.tsx`
- Modify: `src/pages/category-page.tsx`
- Modify: `src/pages/settings-page.tsx`

**Important:** The project uses `BrowserRouter` (not Data Router / `createBrowserRouter`). React Router v7's built-in `viewTransition` prop only works in Data Router mode — it silently does nothing with `BrowserRouter`. We must implement View Transitions manually using a custom `TransitionLink` component and `useTransitionNavigate` hook that wrap `document.startViewTransition()` + `flushSync`.

- [ ] **Step 1: Create view-transition utility**

Create `src/lib/view-transition.ts`:

```ts
import { flushSync } from 'react-dom';

/**
 * Wrap a callback in a View Transition if the API is available.
 * Uses flushSync so React commits DOM changes synchronously
 * inside startViewTransition, allowing the API to capture
 * old and new snapshots correctly.
 */
export function withViewTransition(cb: () => void): void {
  if (!('startViewTransition' in document)) {
    cb();
    return;
  }
  (document as any).startViewTransition(() => {
    flushSync(cb);
  });
}
```

- [ ] **Step 2: Add View Transition CSS to index.css**

Add after the `@layer base` block in `src/index.css`:

```css
/* Page transition animations (View Transitions API) */
@keyframes way-vt-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes way-vt-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
::view-transition-old(root) {
  animation: way-vt-fade-out 100ms ease-in;
}
::view-transition-new(root) {
  animation: way-vt-fade-in 150ms ease-out;
}
```

- [ ] **Step 3: Create TransitionLink component**

Create `src/components/ui/transition-link.tsx`:

```tsx
import { useCallback, type MouseEvent } from 'react';
import { Link, useNavigate, type LinkProps } from 'react-router-dom';
import { withViewTransition } from '@/lib/view-transition';

/**
 * Drop-in replacement for react-router <Link> that wraps
 * navigation in document.startViewTransition().
 * Gracefully degrades: no transition API → behaves like plain <Link>.
 */
export function TransitionLink({ onClick, to, ...props }: LinkProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      // Let modified clicks (cmd/ctrl+click) go through normally
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      e.preventDefault();
      withViewTransition(() => {
        navigate(typeof to === 'string' ? to : to);
      });
      onClick?.(e);
    },
    [navigate, to, onClick],
  );

  return <Link to={to} onClick={handleClick} {...props} />;
}
```

- [ ] **Step 4: Replace `<Link>` with `<TransitionLink>` in navigation components**

In `src/components/layout/drawer-menu.tsx`:
- Change import: `import { Link } from 'react-router-dom'` → `import { TransitionLink } from '@/components/ui/transition-link'`
- Change usage (line 49): `<Link` → `<TransitionLink`  and  `</Link>` → `</TransitionLink>`

In `src/components/main/category-card.tsx`:
- Change import: `import { Link } from 'react-router-dom'` → `import { TransitionLink } from '@/components/ui/transition-link'`
- Change usage (line 16): `<Link` → `<TransitionLink`  and  `</Link>` → `</TransitionLink>`

In `src/components/category/asset-row.tsx`:
- Change import: `import { Link } from 'react-router-dom'` → `import { TransitionLink } from '@/components/ui/transition-link'`
- Change usage (line 28): `<Link` → `<TransitionLink`  and  `</Link>` → `</TransitionLink>`

- [ ] **Step 5: Wrap `navigate()` calls with `withViewTransition`**

In `src/pages/backup-page.tsx`:
- Add import: `import { withViewTransition } from '@/lib/view-transition'`
- Line 41: `<button onClick={() => withViewTransition(() => navigate(-1))} ...>`

In `src/pages/asset-detail-page.tsx`:
- Add import: `import { withViewTransition } from '@/lib/view-transition'`
- Line 84: `<button onClick={() => withViewTransition(() => navigate(-1))} ...>`
- Line 99: `onClick={() => withViewTransition(() => navigate('/data', { state: { ... } }))}`
- Line 131: `onClick={() => withViewTransition(() => navigate('/payments', { state: { highlightAssetId: assetId } }))}`

In `src/pages/category-page.tsx`:
- Add import: `import { withViewTransition } from '@/lib/view-transition'`
- Line 45: `<button onClick={() => withViewTransition(() => navigate(-1))} ...>`

In `src/pages/settings-page.tsx`:
- Add import: `import { withViewTransition } from '@/lib/view-transition'`
- Line 22: `withViewTransition(() => navigate('/'))` (inside `handleClear`, after data is cleared)
- Line 26: `<button onClick={() => withViewTransition(() => navigate(-1))} ...>`

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: Build succeeds. `(document as any).startViewTransition` avoids TS type issues.

- [ ] **Step 7: Test transitions in browser**

Run: `npm run dev`
Navigate between pages in Chrome. You should see a subtle fade effect (~150ms). In Firefox (no View Transitions API support), pages switch instantly without error — graceful degradation.

- [ ] **Step 8: Commit**

```bash
git add src/lib/view-transition.ts src/components/ui/transition-link.tsx src/index.css src/components/layout/drawer-menu.tsx src/components/main/category-card.tsx src/components/category/asset-row.tsx src/pages/backup-page.tsx src/pages/asset-detail-page.tsx src/pages/category-page.tsx src/pages/settings-page.tsx
git commit -m "feat: add page transition animations via View Transitions API + custom TransitionLink"
```

---

### Task 6: Bottom sheet overflow hardening

**Files:**
- Modify: `src/index.css:150-153`

- [ ] **Step 1: Extend sheet overflow protection**

In `src/index.css`, replace:
```css
[data-slot="sheet-content"][data-side="bottom"] {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
  overflow-x: hidden;
}
```
with:
```css
[data-slot="sheet-content"] {
  overflow-x: hidden;
  overflow-wrap: anywhere;
  max-width: 100%;
}
[data-slot="sheet-content"][data-side="bottom"] {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

This applies `overflow-x: hidden`, `overflow-wrap: anywhere`, and `max-width: 100%` to all sheet sides (not just bottom), providing structural defense against any content causing horizontal overflow.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: harden all sheets against horizontal overflow"
```

---

### Task 7: Run tests and verify end-to-end

- [ ] **Step 1: Run all tests**

Run: `npm run test`
Expected: All tests pass. No test should break from CSS/layout changes (tests use happy-dom, not real rendering).

- [ ] **Step 2: Run build for final verification**

Run: `npm run build`
Expected: Clean build, no errors, no warnings.

- [ ] **Step 3: Manual verification checklist**

Run `npm run dev` and verify in Chrome DevTools mobile emulation (iPhone 14 Pro):

1. ☐ Tap any input → NO page zoom
2. ☐ Scroll to bottom of long page → NO bounce effect
3. ☐ Long-press on a button → NO text selection, NO context menu
4. ☐ Long-press on text content → text selection WORKS (should not be disabled)
5. ☐ Header stays fixed during scroll
6. ☐ Navigate between pages → fade transition visible
7. ☐ Open any bottom sheet → content stays within screen width
8. ☐ No horizontal scroll on any page
9. ☐ On Data page: expand an account section, click on an asset → `scrollIntoView` works smoothly (content scrolls to the highlighted row within `<main>`)
10. ☐ Inline editing on Data page: tap an editable cell → input appears at 16px (size jump is expected, no zoom)
