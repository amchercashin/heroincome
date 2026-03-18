import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { computeImportDiff } from '@/services/import-diff';
import type { ImportAssetRow } from '@/services/import-parser';

describe('computeImportDiff', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('marks all rows as added when DB is empty', async () => {
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800, averagePrice: 298.60 },
      { ticker: 'LKOH', name: 'Лукойл', type: 'stock', quantity: 10 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.summary.added).toBe(2);
    expect(diff.items.every((i) => i.status === 'added')).toBe(true);
  });

  it('detects quantity change in update mode', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 500, quantitySource: 'import', importedQuantity: 500,
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('changed');
    expect(diff.items[0].changes.some((c) => c.field === 'quantity')).toBe(true);
  });

  it('marks unchanged assets', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 800, quantitySource: 'import', importedQuantity: 800,
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('unchanged');
  });

  it('flags conflict when existing has manual dataSource', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 500, quantitySource: 'manual',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('conflict');
    expect(diff.summary.conflicts).toBe(1);
  });

  it('in add mode, marks existing tickers as unchanged', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 500, quantitySource: 'import', importedQuantity: 500,
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
      { ticker: 'LKOH', name: 'Лукойл', type: 'stock', quantity: 10 },
    ];
    const diff = await computeImportDiff(rows, 'add');
    expect(diff.items[0].status).toBe('unchanged');
    expect(diff.items[1].status).toBe('added');
  });

  it('detects payment field changes on Asset', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 800, dataSource: 'import',
      quantitySource: 'import', importedQuantity: 800,
      paymentPerUnit: 25.0, paymentPerUnitSource: 'manual',
      frequencyPerYear: 1, frequencySource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800, lastPaymentAmount: 34.84 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('changed');
    expect(diff.items[0].changes.some((c) => c.field === 'paymentPerUnit')).toBe(true);
  });

  it('matches by ISIN when ticker is absent', async () => {
    await db.assets.add({
      type: 'bond', isin: 'RU000A1038V6', name: 'ОФЗ 26238',
      quantity: 50, quantitySource: 'import', importedQuantity: 50,
      paymentPerUnitSource: 'fact', frequencyPerYear: 2, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { isin: 'RU000A1038V6', name: 'ОФЗ 26238', type: 'bond', quantity: 100 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('changed');
    expect(diff.items[0].existingAsset?.isin).toBe('RU000A1038V6');
  });

  it('prefers ISIN match over ticker match', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'OLD', isin: 'RU0009029540', name: 'Сбербанк',
      quantity: 800, quantitySource: 'import', importedQuantity: 800,
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    });
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Другой ассет',
      quantity: 100, quantitySource: 'manual',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', isin: 'RU0009029540', name: 'Сбербанк', type: 'stock', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    // Should match by ISIN (first asset), not by ticker (second asset)
    expect(diff.items[0].existingAsset?.isin).toBe('RU0009029540');
    expect(diff.items[0].existingAsset?.ticker).toBe('OLD');
  });

  it('treats rows without ticker or isin as always added', async () => {
    await db.assets.add({
      type: 'realestate', name: 'Квартира', quantity: 1,
      quantitySource: 'manual', paymentPerUnitSource: 'fact',
      frequencyPerYear: 12, frequencySource: 'manual',
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { name: 'Квартира', type: 'realestate', quantity: 1 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('added');
  });
});
