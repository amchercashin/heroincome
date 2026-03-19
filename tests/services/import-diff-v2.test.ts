import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { computeImportDiff } from '@/services/import-diff';
import type { ImportAssetRow } from '@/services/import-parser';

describe('computeImportDiff (account-scoped)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('marks all rows as added when importing into new account (accountId=null)', async () => {
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800, averagePrice: 298.60 },
      { ticker: 'LKOH', name: 'Лукойл', type: 'Акции', quantity: 10 },
    ];
    const diff = await computeImportDiff(rows, null);
    expect(diff.accountId).toBeNull();
    expect(diff.summary.added).toBe(2);
    expect(diff.items.every(i => i.status === 'added')).toBe(true);
  });

  it('marks rows as added when existing account has no holdings', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, accId);
    expect(diff.accountId).toBe(accId);
    expect(diff.summary.added).toBe(1);
  });

  it('detects changed holdings (quantity differs)', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId = await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId: accId, assetId, quantity: 500, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, accId);
    expect(diff.summary.changed).toBe(1);
    expect(diff.items[0].changes.some(c => c.field === 'quantity')).toBe(true);
    expect(diff.items[0].changes.find(c => c.field === 'quantity')?.oldValue).toBe(500);
    expect(diff.items[0].changes.find(c => c.field === 'quantity')?.newValue).toBe(800);
  });

  it('marks unchanged when all fields match', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId = await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId: accId, assetId, quantity: 800, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, accId);
    expect(diff.summary.unchanged).toBe(1);
    expect(diff.items[0].status).toBe('unchanged');
  });

  it('marks holdings in account but NOT in import as removed', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId1 = await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    const assetId2 = await db.assets.add({
      type: 'Акции', ticker: 'LKOH', name: 'Лукойл',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId: accId, assetId: assetId1, quantity: 800, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });
    await db.holdings.add({
      accountId: accId, assetId: assetId2, quantity: 10, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });

    // Import only has SBER, so LKOH should be removed
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, accId);
    expect(diff.summary.unchanged).toBe(1);
    expect(diff.summary.removed).toBe(1);
    const removed = diff.items.find(i => i.status === 'removed');
    expect(removed?.existingAsset?.ticker).toBe('LKOH');
  });

  it('asset exists globally but not in account → added with existingAsset', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    // Asset exists globally but no holding in this account
    await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, accId);
    expect(diff.summary.added).toBe(1);
    expect(diff.items[0].status).toBe('added');
    expect(diff.items[0].existingAsset).toBeDefined();
    expect(diff.items[0].existingAsset?.ticker).toBe('SBER');
  });

  it('matches by ISIN when ticker is absent', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId = await db.assets.add({
      type: 'Облигации', isin: 'RU000A1038V6', name: 'ОФЗ 26238',
      paymentPerUnitSource: 'fact', frequencyPerYear: 2, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId: accId, assetId, quantity: 100, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { isin: 'RU000A1038V6', name: 'ОФЗ 26238 Обновлённый', type: 'Облигации', quantity: 100 },
    ];
    const diff = await computeImportDiff(rows, accId);
    expect(diff.items[0].status).toBe('changed');
    expect(diff.items[0].existingAsset?.isin).toBe('RU000A1038V6');
    expect(diff.items[0].changes.some(c => c.field === 'name')).toBe(true);
  });

  it('prefers ISIN match over ticker match', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId1 = await db.assets.add({
      type: 'Акции', ticker: 'OLD', isin: 'RU0009029540', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Другой ассет',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });
    await db.holdings.add({
      accountId: accId, assetId: assetId1, quantity: 800, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', isin: 'RU0009029540', name: 'Сбербанк', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, accId);
    // Should match by ISIN (first asset), not by ticker (second asset)
    expect(diff.items[0].existingAsset?.isin).toBe('RU0009029540');
    expect(diff.items[0].existingAsset?.ticker).toBe('OLD');
  });

  it('rows without ticker or isin are always added', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    const rows: ImportAssetRow[] = [
      { name: 'Квартира', type: 'Недвижимость', quantity: 1 },
    ];
    const diff = await computeImportDiff(rows, accId);
    expect(diff.items[0].status).toBe('added');
    expect(diff.items[0].existingAsset).toBeUndefined();
  });
});
