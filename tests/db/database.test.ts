import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { db } from '@/db/database';
import type { Asset } from '@/models/types';

describe('Database', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('adds and retrieves an asset', async () => {
    const asset: Asset = {
      type: 'Акции',
      ticker: 'SBER',
      name: 'Сбербанк',
      paymentPerUnitSource: 'fact',
      frequencyPerYear: 1,
      frequencySource: 'manual',
      currentPrice: 308.2,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const id = await db.assets.add(asset);
    const retrieved = await db.assets.get(id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.ticker).toBe('SBER');
  });

  it('adds and retrieves asset with payment fields', async () => {
    const assetId = await db.assets.add({
      type: 'Акции',
      name: 'Сбербанк',
      ticker: 'SBER',
      paymentPerUnit: 186,
      paymentPerUnitSource: 'manual',
      frequencyPerYear: 1,
      frequencySource: 'manual',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const asset = await db.assets.get(assetId);
    expect(asset).toBeDefined();
    expect(asset!.paymentPerUnit).toBe(186);
    expect(asset!.frequencyPerYear).toBe(1);
    expect(asset!.paymentPerUnitSource).toBe('manual');
  });

  it('queries assets by type', async () => {
    const now = new Date();
    await db.assets.bulkAdd([
      { type: 'Акции', name: 'Сбер', ticker: 'SBER', paymentPerUnitSource: 'fact' as const, frequencyPerYear: 1, frequencySource: 'manual' as const, dataSource: 'manual' as const, createdAt: now, updatedAt: now },
      { type: 'Акции', name: 'Лукойл', ticker: 'LKOH', paymentPerUnitSource: 'fact' as const, frequencyPerYear: 1, frequencySource: 'manual' as const, dataSource: 'manual' as const, createdAt: now, updatedAt: now },
      { type: 'Облигации', name: 'ОФЗ 26238', ticker: 'SU26238', paymentPerUnitSource: 'fact' as const, frequencyPerYear: 2, frequencySource: 'manual' as const, dataSource: 'manual' as const, createdAt: now, updatedAt: now },
    ]);

    const stocks = await db.assets.where('type').equals('Акции').toArray();
    expect(stocks).toHaveLength(2);

    const bonds = await db.assets.where('type').equals('Облигации').toArray();
    expect(bonds).toHaveLength(1);
  });
});

describe('schema v4', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('stores and retrieves payment per unit fields on Asset', async () => {
    const id = await db.assets.add({
      type: 'Акции', name: 'Сбербанк', ticker: 'SBER',
      paymentPerUnit: 100, paymentPerUnitSource: 'manual',
      frequencyPerYear: 1, frequencySource: 'moex', moexFrequency: 1,
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });
    const asset = await db.assets.get(id);
    expect(asset!.paymentPerUnit).toBe(100);
    expect(asset!.paymentPerUnitSource).toBe('manual');
    expect(asset!.frequencyPerYear).toBe(1);
    expect(asset!.frequencySource).toBe('moex');
    expect(asset!.moexFrequency).toBe(1);
  });

  it('queries paymentHistory by compound index [assetId+date]', async () => {
    const cutoff = new Date('2025-03-01');
    await db.paymentHistory.bulkAdd([
      { assetId: 1, amount: 10, date: new Date('2025-01-15'), type: 'dividend', dataSource: 'moex' },
      { assetId: 1, amount: 20, date: new Date('2025-06-15'), type: 'dividend', dataSource: 'moex' },
      { assetId: 2, amount: 30, date: new Date('2025-02-01'), type: 'coupon', dataSource: 'moex' },
    ]);
    const results = await db.paymentHistory
      .where('[assetId+date]')
      .between([1, cutoff], [1, Dexie.maxKey])
      .toArray();
    expect(results).toHaveLength(1);
    expect(results[0].amount).toBe(20);
  });
});
