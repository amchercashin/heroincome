import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';

describe('holdings aggregation', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates holding with unique compound key', async () => {
    const accountId = await db.accounts.add({ name: 'Test', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId = await db.assets.add({
      type: 'Акции', name: 'SBER', dataSource: 'import',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId, assetId, quantity: 100, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const holdings = await db.holdings.where('accountId').equals(accountId).toArray();
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(100);
  });

  it('enforces unique [accountId+assetId]', async () => {
    const accountId = await db.accounts.add({ name: 'Test', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId = await db.assets.add({
      type: 'Акции', name: 'SBER', dataSource: 'import',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId, assetId, quantity: 100, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });
    await expect(db.holdings.add({
      accountId, assetId, quantity: 50, quantitySource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    })).rejects.toThrow();
  });
});
