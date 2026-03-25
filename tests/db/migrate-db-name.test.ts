import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { migrateDbName } from '@/db/migrate-db-name';

describe('migrateDbName', () => {
  beforeEach(async () => {
    await Dexie.delete('CashFlowDB').catch(() => {});
    await Dexie.delete('HeroIncomeDB').catch(() => {});
  });

  afterEach(async () => {
    await Dexie.delete('CashFlowDB').catch(() => {});
    await Dexie.delete('HeroIncomeDB').catch(() => {});
  });

  it('does nothing if old DB does not exist', async () => {
    await migrateDbName();
    const dbs = await Dexie.getDatabaseNames();
    expect(dbs).not.toContain('CashFlowDB');
  });

  it('copies data from CashFlowDB to HeroIncomeDB', async () => {
    const oldDb = new Dexie('CashFlowDB');
    oldDb.version(1).stores({ assets: '++id, type' });
    await oldDb.table('assets').add({ type: 'stock', name: 'Test Asset' });
    const oldCount = await oldDb.table('assets').count();
    expect(oldCount).toBe(1);
    oldDb.close();

    await migrateDbName();

    const newDb = new Dexie('HeroIncomeDB');
    newDb.version(1).stores({ assets: '++id, type' });
    const newCount = await newDb.table('assets').count();
    expect(newCount).toBe(1);
    const asset = await newDb.table('assets').toCollection().first();
    expect(asset.name).toBe('Test Asset');
    newDb.close();

    const dbs = await Dexie.getDatabaseNames();
    expect(dbs).not.toContain('CashFlowDB');
  });

  it('preserves data when opened by app DB class with upgrade functions', async () => {
    const oldDb = new Dexie('CashFlowDB');
    oldDb.version(6).stores({
      accounts: '++id',
      assets: '++id, type, ticker, isin',
      holdings: '++id, accountId, assetId, &[accountId+assetId]',
      paymentHistory: '++id, [assetId+date]',
      importRecords: '++id, date',
      settings: 'key',
    });
    await oldDb.table('assets').add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencySource: 'moex',
      quantitySource: 'manual', quantity: 10,
    });
    await oldDb.table('paymentHistory').add({
      assetId: 1, date: '2026-01-15', amount: 100,
    });
    oldDb.close();

    await migrateDbName();

    // Open with the REAL app DB class (has versions 1-6 with upgrade functions)
    const { db } = await import('@/db/database');
    await db.open();

    // CRITICAL: verify data survived — v5 upgrade must NOT have run clear()
    const assetCount = await db.assets.count();
    expect(assetCount).toBe(1);
    const asset = await db.assets.toCollection().first();
    expect(asset!.ticker).toBe('SBER');

    const historyCount = await db.paymentHistory.count();
    expect(historyCount).toBe(1);

    db.close();
  });
});
