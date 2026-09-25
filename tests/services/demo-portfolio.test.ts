import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { clearAllData } from '@/services/app-settings';
import { getDemoAccountId, loadDemoPortfolio, removeDemoPortfolio } from '@/services/demo-portfolio';
import { calculatePortfolioSnapshot } from '@/services/portfolio-calculator';

describe('demo portfolio', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('creates a self-contained account with income', async () => {
    const now = new Date('2026-09-25T12:00:00');
    const accountId = await loadDemoPortfolio(now);
    expect(await getDemoAccountId()).toBe(accountId);

    const [assets, holdings, paymentHistory] = await Promise.all([
      db.assets.toArray(), db.holdings.toArray(), db.paymentHistory.toArray(),
    ]);
    expect(assets.length).toBeGreaterThan(5);
    expect(holdings.every((h) => h.accountId === accountId)).toBe(true);
    expect(paymentHistory.every((p) => p.date <= now || p.isForecast)).toBe(true);

    const snapshot = calculatePortfolioSnapshot({
      assets, holdings, paymentHistory, ndflRates: new Map(), exchangeRates: new Map(), now,
    });
    expect(snapshot.portfolio.totalIncomePerMonth).toBeGreaterThan(10_000);
    expect(new Set(snapshot.categories.map((c) => c.type)).size).toBe(5);
  });

  it('is idempotent', async () => {
    const a = await loadDemoPortfolio();
    const b = await loadDemoPortfolio();
    expect(a).toBe(b);
    expect(await db.accounts.count()).toBe(1);
  });

  it('removes only demo records', async () => {
    const now = new Date();
    const ownAccount = (await db.accounts.add({ name: 'Мой', createdAt: now, updatedAt: now })) as number;
    await loadDemoPortfolio();
    await removeDemoPortfolio();

    expect(await getDemoAccountId()).toBeNull();
    const accounts = await db.accounts.toArray();
    expect(accounts.map((a) => a.id)).toEqual([ownAccount]);
    expect(await db.assets.count()).toBe(0);
    expect(await db.paymentHistory.count()).toBe(0);
  });
});

describe('demo portfolio income', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it.each(['2026-09-03T12:00:00', '2026-09-25T12:00:00'])('keeps every income pocket filled on %s', async (iso) => {
    const now = new Date(iso);
    await loadDemoPortfolio(now);
    const [assets, holdings, paymentHistory] = await Promise.all([db.assets.toArray(), db.holdings.toArray(), db.paymentHistory.toArray()]);
    const snapshot = calculatePortfolioSnapshot({ assets, holdings, paymentHistory, ndflRates: new Map(), exchangeRates: new Map(), now });
    for (const asset of assets) {
      expect(snapshot.assetsById.get(asset.id!)!.incomePerMonth, asset.name).toBeGreaterThan(0);
    }
    const rent = assets.find((a) => a.type === 'Недвижимость')!;
    expect(snapshot.assetsById.get(rent.id!)!.incomePerMonth).toBe(42_000);
  });
});
