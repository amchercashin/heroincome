import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Asset } from '@/models/types';

export function useAssets() {
  const assets = useLiveQuery(() => db.assets.toArray()) ?? [];
  return assets;
}

export function useAssetsByType(type: string) {
  const assets = useLiveQuery(() => db.assets.where('type').equals(type).toArray(), [type]) ?? [];
  return assets;
}

export function useAsset(id: number) {
  const asset = useLiveQuery(() => db.assets.get(id), [id]);
  return asset;
}

export async function addAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date();
  return (await db.assets.add({
    ...asset,
    createdAt: now,
    updatedAt: now,
  })) as number;
}

export async function updateAsset(id: number, changes: Partial<Asset>): Promise<void> {
  await db.assets.update(id, { ...changes, updatedAt: new Date() });
}

export async function deleteAsset(id: number): Promise<void> {
  await db.transaction('rw', db.assets, db.paymentHistory, async () => {
    await db.paymentHistory.where('assetId').equals(id).delete();
    await db.assets.delete(id);
  });
}
