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
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      averagePrice: 298.6,
      currentPrice: 308.2,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const id = await db.assets.add(asset);
    const retrieved = await db.assets.get(id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.ticker).toBe('SBER');
    expect(retrieved!.quantity).toBe(800);
  });

  it('adds and retrieves payment schedule', async () => {
    const assetId = await db.assets.add({
      type: 'stock',
      name: 'Сбербанк',
      ticker: 'SBER',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.paymentSchedules.add({
      assetId: assetId as number,
      frequencyPerYear: 1,
      lastPaymentAmount: 186,
      dataSource: 'manual',
    });

    const schedules = await db.paymentSchedules
      .where('assetId')
      .equals(assetId as number)
      .toArray();

    expect(schedules).toHaveLength(1);
    expect(schedules[0].lastPaymentAmount).toBe(186);
  });

  it('queries assets by type', async () => {
    const now = new Date();
    await db.assets.bulkAdd([
      { type: 'stock', name: 'Сбер', ticker: 'SBER', quantity: 100, dataSource: 'manual', createdAt: now, updatedAt: now },
      { type: 'stock', name: 'Лукойл', ticker: 'LKOH', quantity: 10, dataSource: 'manual', createdAt: now, updatedAt: now },
      { type: 'bond', name: 'ОФЗ 26238', ticker: 'SU26238', quantity: 50, dataSource: 'manual', createdAt: now, updatedAt: now },
    ]);

    const stocks = await db.assets.where('type').equals('stock').toArray();
    expect(stocks).toHaveLength(2);

    const bonds = await db.assets.where('type').equals('bond').toArray();
    expect(bonds).toHaveLength(1);
  });
});

describe('schema v3', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('stores and retrieves forecast fields on PaymentSchedule', async () => {
    const id = await db.paymentSchedules.add({
      assetId: 1,
      frequencyPerYear: 1,
      lastPaymentAmount: 50,
      forecastMethod: 'manual',
      forecastAmount: 100,
      activeMetric: 'forecast',
      dataSource: 'manual',
    });
    const record = await db.paymentSchedules.get(id);
    expect(record!.forecastMethod).toBe('manual');
    expect(record!.forecastAmount).toBe(100);
    expect(record!.activeMetric).toBe('forecast');
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
