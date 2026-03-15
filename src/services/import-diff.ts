import { db } from '@/db/database';
import type { Asset, PaymentSchedule } from '@/models/types';
import type { ImportAssetRow } from './import-parser';

export type ImportMode = 'update' | 'add';

export interface DiffChange {
  field: string;
  oldValue: string | number | undefined;
  newValue: string | number | undefined;
}

export interface DiffItem {
  status: 'added' | 'changed' | 'unchanged' | 'conflict';
  imported: ImportAssetRow;
  existingAsset?: Asset;
  changes: DiffChange[];
}

export interface ImportDiff {
  mode: ImportMode;
  items: DiffItem[];
  summary: {
    added: number;
    changed: number;
    unchanged: number;
    conflicts: number;
  };
}

export async function computeImportDiff(
  rows: ImportAssetRow[],
  mode: ImportMode,
): Promise<ImportDiff> {
  const existingAssets = await db.assets.toArray();
  const existingSchedules = await db.paymentSchedules.toArray();
  const byTicker = new Map<string, Asset>();
  const scheduleByAssetId = new Map<number, PaymentSchedule>();
  for (const asset of existingAssets) {
    if (asset.ticker) byTicker.set(asset.ticker, asset);
  }
  for (const s of existingSchedules) {
    scheduleByAssetId.set(s.assetId, s);
  }

  const items: DiffItem[] = [];

  for (const row of rows) {
    const existing = row.ticker ? byTicker.get(row.ticker) : undefined;

    if (!existing) {
      items.push({ status: 'added', imported: row, changes: [] });
    } else if (mode === 'add') {
      items.push({ status: 'unchanged', imported: row, existingAsset: existing, changes: [] });
    } else {
      const schedule = existing.id ? scheduleByAssetId.get(existing.id) : undefined;
      const changes = compareFields(row, existing, schedule);
      if (changes.length === 0) {
        items.push({ status: 'unchanged', imported: row, existingAsset: existing, changes: [] });
      } else if (existing.dataSource === 'manual') {
        items.push({ status: 'conflict', imported: row, existingAsset: existing, changes });
      } else {
        items.push({ status: 'changed', imported: row, existingAsset: existing, changes });
      }
    }
  }

  return {
    mode,
    items,
    summary: {
      added: items.filter((i) => i.status === 'added').length,
      changed: items.filter((i) => i.status === 'changed').length,
      unchanged: items.filter((i) => i.status === 'unchanged').length,
      conflicts: items.filter((i) => i.status === 'conflict').length,
    },
  };
}

function compareFields(
  row: ImportAssetRow,
  existing: Asset,
  schedule?: PaymentSchedule,
): DiffChange[] {
  const changes: DiffChange[] = [];

  if (row.quantity !== existing.quantity) {
    changes.push({ field: 'quantity', oldValue: existing.quantity, newValue: row.quantity });
  }
  if (row.averagePrice != null && row.averagePrice !== existing.averagePrice) {
    changes.push({ field: 'averagePrice', oldValue: existing.averagePrice, newValue: row.averagePrice });
  }
  if (row.name !== existing.name) {
    changes.push({ field: 'name', oldValue: existing.name, newValue: row.name });
  }
  if (row.lastPaymentAmount != null && schedule && row.lastPaymentAmount !== schedule.lastPaymentAmount) {
    changes.push({ field: 'lastPaymentAmount', oldValue: schedule.lastPaymentAmount, newValue: row.lastPaymentAmount });
  }
  if (row.frequencyPerYear != null && schedule && row.frequencyPerYear !== schedule.frequencyPerYear) {
    changes.push({ field: 'frequencyPerYear', oldValue: schedule.frequencyPerYear, newValue: row.frequencyPerYear });
  }

  return changes;
}
