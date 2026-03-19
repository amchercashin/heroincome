import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { computeImportDiff } from '@/services/import-diff';
import { applyImportDiff } from '@/services/import-applier';
import type { ImportAssetRow } from '@/services/import-parser';

describe('applyImportDiff', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates assets with payment fields for added items', async () => {
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800,
        averagePrice: 298.60, lastPaymentAmount: 34.84, frequencyPerYear: 1 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    const record = await applyImportDiff(diff, 'ai_import', new Map());

    expect(record.itemsAdded).toBe(1);

    const assets = await db.assets.toArray();
    expect(assets).toHaveLength(1);
    expect(assets[0].ticker).toBe('SBER');
    expect(assets[0].dataSource).toBe('import');
    expect(assets[0].paymentPerUnit).toBe(34.84);
    expect(assets[0].paymentPerUnitSource).toBe('manual');
    expect(assets[0].frequencyPerYear).toBe(1);
    expect(assets[0].frequencySource).toBe('manual');
  });

  it('updates existing assets for changed items', async () => {
    await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк Обновлённый', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    const record = await applyImportDiff(diff, 'markdown', new Map());

    expect(record.itemsChanged).toBe(1);

    const assets = await db.assets.toArray();
    expect(assets[0].name).toBe('Сбербанк Обновлённый');
    expect(assets[0].dataSource).toBe('import');
  });

  it('respects conflict resolution: import wins', async () => {
    await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк Новый', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    const resolutions = new Map([[0, 'import' as const]]);
    const record = await applyImportDiff(diff, 'csv', resolutions);

    expect(record.itemsChanged).toBe(1);
    const assets = await db.assets.toArray();
    expect(assets[0].name).toBe('Сбербанк Новый');
  });

  it('respects conflict resolution: keep existing', async () => {
    await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк Новый', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    const resolutions = new Map([[0, 'keep' as const]]);
    const record = await applyImportDiff(diff, 'csv', resolutions);

    expect(record.itemsUnchanged).toBe(1);
    const assets = await db.assets.toArray();
    expect(assets[0].name).toBe('Сбербанк');
  });

  it('creates ImportRecord', async () => {
    const diff = await computeImportDiff([], 'update');
    await applyImportDiff(diff, 'ai_import', new Map());

    const records = await db.importRecords.toArray();
    expect(records).toHaveLength(1);
    expect(records[0].source).toBe('ai_import');
  });
});
