# Native Feel PWA — Design Spec

## Problem

Приложение ведёт себя как веб-страница, а не как нативное приложение:

1. **iOS auto-zoom** — при тапе на input с font-size < 16px Safari зумит страницу, после чего контент "вылезает" за ширину экрана и не возвращается без ручного pinch-zoom. Затрагивает все кастомные input'ы: add-account-sheet, import-flow, add-asset-sheet, asset-field, add-payment-form, inline-cell, type-combobox.
2. **Overscroll bounce** — резиновый эффект при скролле за пределы контента.
3. **Text selection на UI-элементах** — кнопки, навигация, labels выделяются при long-press.
4. **Browser context menu** — стандартное контекстное меню при long-press вместо нативного поведения.
5. **Нет анимаций переходов** — страницы меняются мгновенно без визуального перехода.
6. **Структурная незащищённость от overflow** — текущий layout (min-h-screen) не предотвращает горизонтальный overflow; каждый новый компонент потенциально может раздвинуть страницу.

## Scope

- Кроссплатформенно: iOS, Android, desktop, планшеты.
- Размер шрифтов/элементов — вне скоупа (отдельная задача).
- Haptic feedback — вне скоупа (требует Capacitor).
- Pull-to-refresh — вне скоупа.

## Solution

### 1. Структурный layout: фиксированный фрейм

**Текущая структура AppShell (`src/components/layout/app-shell.tsx`):**
```
<div class="min-h-screen ...">
  <header>...</header>
  <main class="px-5 pb-8">{children}</main>
</div>
```

**Новая структура:**
```
<div class="h-[100dvh] flex flex-col overflow-hidden ...">
  <header class="flex-shrink-0">...</header>
  <main class="flex-1 overflow-y-auto overflow-x-hidden overscroll-none px-5 pb-8">{children}</main>
</div>
```

Ключевые изменения:
- `h-[100dvh]` — контейнер ровно по высоте viewport. `dvh` (dynamic viewport height) учитывает адресную строку Safari и gesture bar Android.
- `overflow-hidden` на корне — структурно невозможно вылезти за пределы.
- `flex-shrink-0` на header — не сжимается, остаётся фиксированным.
- `flex-1 overflow-y-auto overflow-x-hidden` на main — единственная зона скролла.
- `overscroll-none` на main — запрет bounce именно на скролл-контейнере.

Примечание: `-webkit-overflow-scrolling: touch` не нужен — это поведение по умолчанию с iOS 13+.

### 2. Глобальный CSS-патч (`index.css`)

```css
/* iOS auto-zoom prevention: font-size ≥ 16px — safety net для input'ов без явного Tailwind-класса */
input, textarea, select {
  font-size: 16px;
}

/* Запрет выделения текста и контекстного меню на UI-элементах */
button, a, nav, header, label, [role="button"] {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
```

Важно про специфичность: глобальное правило `input { font-size: 16px }` попадает в `@layer base`. В Tailwind v4 utility-классы генерируются в более приоритетном слое, поэтому `text-sm` и `text-[12px]` на элементах **переопределят** глобальное правило. Глобальное правило работает только как safety net для input'ов без явного Tailwind font-size класса. Все явные `text-sm` / `text-[12px]` на input'ах необходимо заменить на `text-base`.

Примечание: `user-select: none` и `-webkit-touch-callout: none` применяются только к интерактивным элементам. Текстовый контент на страницах остаётся выделяемым.

Примечание: shadcn `<Input>` компонент (`src/components/ui/input.tsx`) уже использует `text-base md:text-sm` — он безопасен и не требует изменений.

### 3. Анимации переходов между страницами

Подход: **View Transitions API** как primary, с CSS fallback.

View Transitions API поддерживается в Chrome 111+ и Safari 18+, что покрывает подавляющее большинство пользователей мобильных PWA. Для браузеров без поддержки — transition отсутствует (graceful degradation).

Реализация в `src/components/layout/app-shell.tsx`:
- Использовать `useNavigate` wrapper или `useEffect` на `location.key` для вызова `document.startViewTransition()`.
- CSS:
```css
::view-transition-old(root) {
  animation: fade-out 100ms ease-in;
}
::view-transition-new(root) {
  animation: fade-in 150ms ease-out;
}
```

Это не требует дополнительных зависимостей, работает нативно, и gracefully degrades (без поддержки API — просто нет анимации).

### 4. Bottom sheet hardening

- Глобальный CSS на все sheet'ы: `overflow-x: hidden` (частично уже есть в index.css для `[data-side="bottom"]`, расширить на все стороны).
- Контент внутри: `max-w-full`, `overflow-wrap: anywhere` для длинных строк.
- Все input/textarea внутри sheet'ов: `text-sm` → `text-base`.

Файлы, где нужно заменить font-size на input/textarea/select:
- `src/components/data/add-account-sheet.tsx` — input с `text-sm`
- `src/components/data/import-flow.tsx` — textarea и input с `text-sm`
- `src/components/data/add-asset-sheet.tsx` — shared inputClass с `text-sm`
- `src/components/asset-detail/asset-field.tsx` — input с `text-sm`
- `src/components/payments/add-payment-form.tsx` — inputs с `text-[12px]`
- `src/components/data/inline-cell.tsx` — input наследует мелкий font-size из className prop (parent контекст text-[13px] / text-[11px])
- `src/components/data/type-combobox.tsx` — input наследует мелкий font-size из className prop

Для inline-cell.tsx и type-combobox.tsx: input получает className от родителя с мелким шрифтом. Нужно добавить `!text-base` (important) на input элемент, чтобы гарантировать 16px независимо от переданного className.

## Files to modify

| File | Change |
|------|--------|
| `src/index.css` | Добавить CSS-патч (user-select, touch-callout, font-size safety net) |
| `src/components/layout/app-shell.tsx` | Перестроить на h-[100dvh] + flex + overflow-hidden + overscroll-none; добавить View Transitions |
| `src/components/data/add-account-sheet.tsx` | `text-sm` → `text-base` на input |
| `src/components/data/import-flow.tsx` | `text-sm` → `text-base` на textarea и input |
| `src/components/data/add-asset-sheet.tsx` | `text-sm` → `text-base` в inputClass |
| `src/components/asset-detail/asset-field.tsx` | `text-sm` → `text-base` на input |
| `src/components/payments/add-payment-form.tsx` | `text-[12px]` → `text-base` на inputs |
| `src/components/data/inline-cell.tsx` | Добавить `!text-base` на input (override inherited className) |
| `src/components/data/type-combobox.tsx` | Добавить `!text-base` на input (override inherited className) |
| `src/components/error-boundary.tsx` | `min-h-screen` → `h-[100dvh]` для консистентности |

## Acceptance criteria

1. На iPhone Safari: тап на любой input НЕ вызывает zoom страницы.
2. На любом устройстве: горизонтальный скролл невозможен ни на одной странице и ни в одном bottom-sheet.
3. Скролл за пределы контента (overscroll) не вызывает bounce-эффект.
4. Long-press на кнопках/навигации не выделяет текст и не показывает контекстное меню.
5. Переход между страницами сопровождается fade-анимацией (~150ms) в поддерживаемых браузерах.
6. Header остаётся фиксированным при скролле контента.
7. Всё работает одинаково на iOS, Android, desktop.

## Risks

- `100dvh` может вести себя некорректно на старых браузерах (< iOS 15.4, < Chrome 108). Fallback: `100vh` через CSS fallback `h-[100vh]` перед `h-[100dvh]`.
- `overscroll-behavior: none` может конфликтовать с pull-to-refresh если будет добавлен позже. Решается точечным переопределением.
- `scrollIntoView` используется в `account-section.tsx` и `asset-payments.tsx` с `{ behavior: 'smooth', block: 'center' }`. После смены скролл-контейнера с body на `<main>`, scrollIntoView должен корректно определять ближайший скролл-ancestor, но требует явного тестирования.
- View Transitions API не поддерживается в Firefox (на март 2026). Graceful degradation: переходы просто не анимируются.
