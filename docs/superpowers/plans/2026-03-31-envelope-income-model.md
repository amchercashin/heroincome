# Envelope Income Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "last N payments by frequency" income model with a "rolling 12-month window" envelope model.

**Architecture:** Change `calcAnnualIncomePerUnit` to filter payments by date window instead of count. Remove `frequencyPerYear` parameter. Update 3 call sites.

**Tech Stack:** TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-31-envelope-income-model-design.md`

---

### Task 1: Rewrite `calcAnnualIncomePerUnit` tests for envelope model

**Files:**
- Modify: `tests/services/income-calculator.test.ts` (lines 12–108, the `calcAnnualIncomePerUnit` describe block)

- [ ] **Step 1: Replace the entire `calcAnnualIncomePerUnit` test suite**

Replace the `describe('calcAnnualIncomePerUnit', ...)` block (lines 12–108) with:

```typescript
  describe('calcAnnualIncomePerUnit', () => {
    it('sums all payments within 12-month window', () => {
      const history = [
        { amount: 514, date: new Date('2025-07-08') },
        { amount: 793, date: new Date('2025-12-20') },
        { amount: 400, date: new Date('2025-04-10') },
      ];
      const result = calcAnnualIncomePerUnit(history, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(514 + 793 + 400);
      expect(result.usedPayments).toHaveLength(3);
    });

    it('excludes payments older than 12 months', () => {
      const history = [
        { amount: 100, date: new Date('2025-01-01') }, // > 12 months ago
        { amount: 200, date: new Date('2025-06-01') }, // within window
        { amount: 300, date: new Date('2026-01-01') }, // within window
      ];
      const result = calcAnnualIncomePerUnit(history, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(500);
      expect(result.usedPayments).toHaveLength(2);
    });

    it('returns 0 for empty history', () => {
      const result = calcAnnualIncomePerUnit([], new Date('2026-03-16'));
      expect(result.annualIncome).toBe(0);
      expect(result.usedPayments).toHaveLength(0);
    });

    it('returns 0 when all payments are older than 12 months', () => {
      const history = [
        { amount: 100, date: new Date('2024-01-01') },
        { amount: 200, date: new Date('2024-06-01') },
      ];
      const result = calcAnnualIncomePerUnit(history, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(0);
      expect(result.usedPayments).toHaveLength(0);
    });

    it('boundary: payment exactly 12 months ago is included', () => {
      const now = new Date('2026-03-16');
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      // twelveMonthsAgo = 2025-03-16
      const history = [{ amount: 50, date: twelveMonthsAgo }];
      const result = calcAnnualIncomePerUnit(history, now);
      expect(result.annualIncome).toBe(50);
    });

    it('boundary: payment one day before 12-month window is excluded', () => {
      const now = new Date('2026-03-16');
      const justOutside = new Date('2025-03-15');
      const history = [{ amount: 50, date: justOutside }];
      const result = calcAnnualIncomePerUnit(history, now);
      expect(result.annualIncome).toBe(0);
    });

    it('usedPayments sorted descending by date', () => {
      const history = [
        { amount: 10, date: new Date('2025-06-01') },
        { amount: 20, date: new Date('2026-01-01') },
        { amount: 15, date: new Date('2025-09-01') },
      ];
      const result = calcAnnualIncomePerUnit(history, new Date('2026-03-16'));
      expect(result.usedPayments[0].date.getTime()).toBeGreaterThan(
        result.usedPayments[1].date.getTime(),
      );
      expect(result.usedPayments[1].date.getTime()).toBeGreaterThan(
        result.usedPayments[2].date.getTime(),
      );
    });

    it('handles single payment within window', () => {
      const history = [{ amount: 186, date: new Date('2025-07-15') }];
      const result = calcAnnualIncomePerUnit(history, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(186);
      expect(result.usedPayments).toHaveLength(1);
    });

    it('includes many payments within window regardless of count', () => {
      const payments = Array.from({ length: 14 }, (_, i) => ({
        amount: 100,
        date: new Date(2025, 6 + i, 1), // Jul 2025 .. Aug 2026
      }));
      const result = calcAnnualIncomePerUnit(payments, new Date('2026-06-15'));
      // Only payments from Jun 2025..Jun 2026 window count
      // Jul 2025 (i=0) through Jun 2026 (i=11) = 12 payments in window
      const inWindow = payments.filter(p => p.date >= new Date(2025, 6, 15));
      expect(result.annualIncome).toBe(inWindow.length * 100);
      expect(result.usedPayments).toHaveLength(inWindow.length);
    });
  });
```

- [ ] **Step 2: Run the tests — verify they fail**

Run: `npx vitest run tests/services/income-calculator.test.ts`

Expected: FAIL — `calcAnnualIncomePerUnit` still expects `frequencyPerYear` as second argument, so TypeScript compilation errors on all new calls missing it.

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/services/income-calculator.test.ts
git commit -m "test: rewrite calcAnnualIncomePerUnit tests for envelope model (red)"
```

---

### Task 2: Implement envelope logic in `calcAnnualIncomePerUnit`

**Files:**
- Modify: `src/services/income-calculator.ts` (lines 48–67, the `calcAnnualIncomePerUnit` function)

- [ ] **Step 1: Replace `calcAnnualIncomePerUnit` implementation**

Replace the function (lines 48–67) with:

```typescript
export function calcAnnualIncomePerUnit(
  history: PaymentRecord[],
  now: Date = new Date(),
): AnnualIncomeResult {
  const empty = { annualIncome: 0, usedPayments: [] as PaymentRecord[] };
  if (history.length === 0) return empty;

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const usedPayments = history
    .filter(p => p.date >= twelveMonthsAgo)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  if (usedPayments.length === 0) return empty;

  const annualIncome = usedPayments.reduce((sum, p) => sum + p.amount, 0);
  return { annualIncome, usedPayments };
}
```

- [ ] **Step 2: Run the tests — verify they pass**

Run: `npx vitest run tests/services/income-calculator.test.ts`

Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/income-calculator.ts
git commit -m "feat: switch calcAnnualIncomePerUnit to 12-month envelope window"
```

---

### Task 3: Update call sites to remove `frequencyPerYear` argument

**Files:**
- Modify: `src/hooks/use-portfolio-stats.ts:39`
- Modify: `src/pages/asset-detail-page.tsx:42`
- Modify: `src/pages/category-page.tsx:76`

- [ ] **Step 1: Update `use-portfolio-stats.ts`**

Line 39 — change:
```typescript
      return calcAnnualIncomePerUnit(history, asset.frequencyPerYear, now).annualIncome;
```
to:
```typescript
      return calcAnnualIncomePerUnit(history, now).annualIncome;
```

- [ ] **Step 2: Update `asset-detail-page.tsx`**

Line 42 — change:
```typescript
      const result = calcAnnualIncomePerUnit(historyRecords, asset.frequencyPerYear, now);
```
to:
```typescript
      const result = calcAnnualIncomePerUnit(historyRecords, now);
```

- [ ] **Step 3: Update `category-page.tsx`**

Line 76 — change:
```typescript
          annualIncome = calcAnnualIncomePerUnit(history, asset.frequencyPerYear, now).annualIncome;
```
to:
```typescript
          annualIncome = calcAnnualIncomePerUnit(history, now).annualIncome;
```

- [ ] **Step 4: Run full test suite**

Run: `npm run test`

Expected: ALL PASS

- [ ] **Step 5: Run TypeScript check + build**

Run: `npm run build`

Expected: Build succeeds with no TS errors (confirms no remaining references to the old 3-arg signature).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-portfolio-stats.ts src/pages/asset-detail-page.tsx src/pages/category-page.tsx
git commit -m "refactor: remove frequencyPerYear from calcAnnualIncomePerUnit call sites"
```
