import { db } from '@/db/database';
import type { Asset, PaymentSchedule } from '@/models/types';
import {
  resolveSecurityInfo,
  fetchStockPrice,
  fetchBondData,
  fetchDividends,
} from './moex-api';

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export async function syncAllAssets(): Promise<SyncResult> {
  const assets = await db.assets.toArray();
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [] };

  for (const asset of assets) {
    if ((!asset.ticker && !asset.isin && !asset.moexSecid) || !['stock', 'bond', 'fund'].includes(asset.type)) {
      result.skipped++;
      continue;
    }

    try {
      await syncSingleAsset(asset);
      result.synced++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${asset.ticker}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await db
    .table('settings')
    .put({ key: 'lastSyncAt', value: new Date().toISOString() });

  return result;
}

export async function getLastSyncAt(): Promise<Date | null> {
  const setting = await db.table('settings').get('lastSyncAt');
  return setting ? new Date(setting.value) : null;
}

async function syncSingleAsset(asset: Asset): Promise<void> {
  let secid = asset.moexSecid;
  let boardId: string;
  let market: 'shares' | 'bonds';

  if (secid) {
    // Cached secid — still need board/market, resolve by secid
    const info = await resolveSecurityInfo(secid);
    if (!info) throw new Error('Не найден на MOEX');
    boardId = info.primaryBoardId;
    market = info.market;
  } else {
    // Resolution chain: ticker → ISIN
    let info = asset.ticker
      ? await resolveSecurityInfo(asset.ticker)
      : null;
    if (!info && asset.isin) {
      info = await resolveSecurityInfo(asset.isin);
    }
    if (!info) throw new Error('Не найден на MOEX');

    secid = info.secid;
    boardId = info.primaryBoardId;
    market = info.market;

    // Cache for next time
    await db.assets.update(asset.id!, { moexSecid: secid });
  }

  if (market === 'bonds') {
    await syncBond(secid, asset, boardId);
  } else {
    await syncStock(secid, asset, boardId);
  }
}

async function syncStock(secid: string, asset: Asset, boardId: string): Promise<void> {
  const price = await fetchStockPrice(secid, boardId);
  if (price) {
    const currentPrice = price.currentPrice ?? price.prevPrice;
    if (currentPrice != null) {
      await db.assets.update(asset.id!, {
        currentPrice,
        updatedAt: new Date(),
      });
    }
  }

  const divInfo = await fetchDividends(secid);
  if (divInfo) {
    await upsertMoexSchedule(asset.id!, {
      frequencyPerYear: divInfo.frequencyPerYear,
      lastPaymentAmount: divInfo.lastPaymentAmount,
      lastPaymentDate: divInfo.lastPaymentDate,
      nextExpectedCutoffDate: divInfo.nextExpectedCutoffDate ?? undefined,
    });
  }
}

async function syncBond(secid: string, asset: Asset, boardId: string): Promise<void> {
  const bondData = await fetchBondData(secid, boardId);
  if (!bondData) throw new Error('Нет данных на MOEX');

  const pricePercent = bondData.currentPrice ?? bondData.prevPrice;
  if (pricePercent != null) {
    await db.assets.update(asset.id!, {
      currentPrice: bondData.faceValue * (pricePercent / 100),
      faceValue: bondData.faceValue,
      updatedAt: new Date(),
    });
  }

  const frequencyPerYear =
    bondData.couponPeriod > 0
      ? Math.round(365 / bondData.couponPeriod)
      : 2;

  await upsertMoexSchedule(asset.id!, {
    frequencyPerYear,
    lastPaymentAmount: bondData.couponValue,
    nextExpectedDate: bondData.nextCouponDate
      ? new Date(bondData.nextCouponDate)
      : undefined,
  });
}

async function upsertMoexSchedule(
  assetId: number,
  data: {
    frequencyPerYear: number;
    lastPaymentAmount: number;
    lastPaymentDate?: Date;
    nextExpectedDate?: Date;
    nextExpectedCutoffDate?: Date;
  },
): Promise<void> {
  const existing = await db.paymentSchedules
    .where('assetId')
    .equals(assetId)
    .first();

  if (existing?.dataSource === 'manual') return;

  const scheduleData: Partial<PaymentSchedule> = {
    frequencyPerYear: data.frequencyPerYear,
    lastPaymentAmount: data.lastPaymentAmount,
    lastPaymentDate: data.lastPaymentDate,
    nextExpectedDate: data.nextExpectedDate,
    nextExpectedCutoffDate: data.nextExpectedCutoffDate,
    dataSource: 'moex',
  };

  if (existing) {
    await db.paymentSchedules.update(existing.id!, scheduleData);
  } else {
    await db.paymentSchedules.add({
      assetId,
      ...scheduleData,
    } as PaymentSchedule);
  }
}
