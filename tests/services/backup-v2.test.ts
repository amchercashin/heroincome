import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { exportAllData, importAllData } from '@/services/backup';

describe('backup v3', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('exports version 3 with accounts and holdings', async () => {
    await db.accounts.add({ name: 'Test', createdAt: new Date(), updatedAt: new Date() });
    const json = await exportAllData();
    const data = JSON.parse(json);
    expect(data.version).toBe(3);
    expect(data.accounts).toHaveLength(1);
    expect(data.holdings).toBeDefined();
  });

  it('imports v3 format with accounts and holdings', async () => {
    const now = new Date().toISOString();
    const json = JSON.stringify({
      version: 3,
      accounts: [{ id: 1, name: 'Сбер', createdAt: now, updatedAt: now }],
      assets: [{ id: 1, type: 'Акции', name: 'SBER', dataSource: 'import', paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual', createdAt: now, updatedAt: now }],
      holdings: [{ id: 1, accountId: 1, assetId: 1, quantity: 100, quantitySource: 'import', createdAt: now, updatedAt: now }],
      paymentHistory: [],
      importRecords: [],
      settings: [],
    });
    await importAllData(json);
    const accounts = await db.accounts.toArray();
    const holdings = await db.holdings.toArray();
    expect(accounts).toHaveLength(1);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(100);
  });

  it('rejects old v2 format without accounts', async () => {
    const json = JSON.stringify({
      version: 2,
      assets: [{ id: 1, type: 'stock', name: 'SBER' }],
      paymentHistory: [],
    });
    await expect(importAllData(json)).rejects.toThrow('версия 3');
  });

  it('rejects invalid JSON', async () => {
    await expect(importAllData('not json')).rejects.toThrow('JSON');
  });

  it('exports empty database', async () => {
    const json = await exportAllData();
    const data = JSON.parse(json);
    expect(data.version).toBe(3);
    expect(data.accounts).toHaveLength(0);
    expect(data.assets).toHaveLength(0);
    expect(data.holdings).toHaveLength(0);
  });

  it('rehydrates Date fields from ISO strings on import', async () => {
    const now = new Date();
    await db.accounts.add({ name: 'Сбер', createdAt: now, updatedAt: now });
    await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: now, updatedAt: now,
    });
    await db.holdings.add({
      accountId: 1, assetId: 1, quantity: 100,
      quantitySource: 'import', createdAt: now, updatedAt: now,
    });
    await db.paymentHistory.add({
      assetId: 1, amount: 34.84, date: new Date('2025-07-18'),
      type: 'dividend', dataSource: 'moex',
    });

    const json = await exportAllData();
    await importAllData(json);

    const accounts = await db.accounts.toArray();
    expect(accounts[0].createdAt).toBeInstanceOf(Date);

    const holdings = await db.holdings.toArray();
    expect(holdings[0].createdAt).toBeInstanceOf(Date);

    const history = await db.paymentHistory.toArray();
    expect(history[0].date).toBeInstanceOf(Date);
    expect(history[0].date.getTime()).toBe(new Date('2025-07-18').getTime());

    const assets = await db.assets.toArray();
    expect(assets[0].createdAt).toBeInstanceOf(Date);
  });

  it('import clears existing data before restoring', async () => {
    const now = new Date();
    await db.accounts.add({ name: 'Old', createdAt: now, updatedAt: now });
    await db.assets.add({
      type: 'Акции', name: 'Old',
      paymentPerUnitSource: 'fact',
      frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: now, updatedAt: now,
    });

    const json = JSON.stringify({
      version: 3,
      accounts: [],
      assets: [],
      holdings: [],
      paymentHistory: [],
      importRecords: [],
      settings: [],
    });
    await importAllData(json);
    expect(await db.accounts.count()).toBe(0);
    expect(await db.assets.count()).toBe(0);
    expect(await db.holdings.count()).toBe(0);
  });

  it('preserves existing data when import validation fails', async () => {
    const now = new Date();
    await db.accounts.add({ name: 'Keep Me', createdAt: now, updatedAt: now });

    await expect(importAllData('not json')).rejects.toThrow();
    expect(await db.accounts.count()).toBe(1);
    const kept = (await db.accounts.toArray())[0];
    expect(kept.name).toBe('Keep Me');
  });

  it('rejects JSON without required arrays', async () => {
    await expect(importAllData(JSON.stringify({ foo: 'bar' }))).rejects.toThrow('версия 3');
  });
});
