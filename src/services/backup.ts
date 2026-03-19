import { db } from '@/db/database';

export async function exportAllData(): Promise<string> {
  const data = {
    version: 3,
    exportedAt: new Date().toISOString(),
    accounts: await db.accounts.toArray(),
    assets: await db.assets.toArray(),
    holdings: await db.holdings.toArray(),
    paymentHistory: await db.paymentHistory.toArray(),
    importRecords: await db.importRecords.toArray(),
    settings: await db.table('settings').toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Невалидный формат: некорректный JSON');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Невалидный формат данных');
  }
  if (!Array.isArray(data.accounts) || !Array.isArray(data.assets) || !Array.isArray(data.holdings)) {
    throw new Error('Невалидный формат: требуется версия 3 с accounts, assets и holdings');
  }

  const settingsTable = db.table('settings');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = (data.accounts as any[]).map((a: any) => ({
    ...a,
    createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
    updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date(),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assets = (data.assets as any[]).map((a: any) => ({
    ...a,
    createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
    updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date(),
    nextExpectedDate: a.nextExpectedDate ? new Date(a.nextExpectedDate) : undefined,
    nextExpectedCutoffDate: a.nextExpectedCutoffDate ? new Date(a.nextExpectedCutoffDate) : undefined,
    nextExpectedCreditDate: a.nextExpectedCreditDate ? new Date(a.nextExpectedCreditDate) : undefined,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holdings = (data.holdings as any[]).map((h: any) => ({
    ...h,
    createdAt: h.createdAt ? new Date(h.createdAt) : new Date(),
    updatedAt: h.updatedAt ? new Date(h.updatedAt) : new Date(),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentHistory = ((data.paymentHistory as any[] | undefined) ?? []).map((h: any) => ({
    ...h,
    date: h.date ? new Date(h.date) : new Date(),
  }));

  await db.transaction('rw', [db.accounts, db.assets, db.holdings, db.paymentHistory, db.importRecords, settingsTable], async () => {
    await db.accounts.clear();
    await db.assets.clear();
    await db.holdings.clear();
    await db.paymentHistory.clear();
    await db.importRecords.clear();
    await settingsTable.clear();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (accounts.length) await db.accounts.bulkAdd(accounts as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (assets.length) await db.assets.bulkAdd(assets as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (holdings.length) await db.holdings.bulkAdd(holdings as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (paymentHistory.length) await db.paymentHistory.bulkAdd(paymentHistory as any);
    if ((data.importRecords as unknown[] | undefined)?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.importRecords.bulkAdd(data.importRecords as any);
    }
    if ((data.settings as unknown[] | undefined)?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of data.settings as any[]) await settingsTable.put(s);
    }
  });
}
