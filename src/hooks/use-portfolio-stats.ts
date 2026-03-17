import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { AssetType, PortfolioStats, CategoryStats } from '@/models/types';
import { calcFactPaymentPerUnit, calcAssetIncomePerMonth, calcYieldPercent, type PaymentRecord } from '@/services/income-calculator';
import { useAllPaymentHistory } from './use-payment-history';

export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
} {
  const assets = useLiveQuery(() => db.assets.toArray(), [], []);
  const allHistory = useAllPaymentHistory();

  const { portfolio, categories } = useMemo(() => {
    const now = new Date();

    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }

    let totalValue = 0;
    let totalIncomePerMonth = 0;
    const categoryMap = new Map<AssetType, typeof assets>();

    for (const asset of assets) {
      const price = asset.currentPrice ?? asset.averagePrice ?? 0;
      const assetValue = price * asset.quantity;
      totalValue += assetValue;

      const catAssets = categoryMap.get(asset.type) ?? [];
      catAssets.push(asset);
      categoryMap.set(asset.type, catAssets);

      let paymentPerUnit: number;
      if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
        paymentPerUnit = asset.paymentPerUnit;
      } else {
        const history = historyByAsset.get(asset.id!) ?? [];
        paymentPerUnit = calcFactPaymentPerUnit(history, asset.frequencyPerYear, now);
      }

      totalIncomePerMonth += calcAssetIncomePerMonth(
        asset.quantity,
        paymentPerUnit,
        asset.frequencyPerYear,
      );
    }

    const totalIncomePerYear = totalIncomePerMonth * 12;
    const yieldPercent = totalValue > 0 ? calcYieldPercent(totalIncomePerYear, totalValue) : 0;

    const portfolio: PortfolioStats = {
      totalIncomePerMonth,
      totalIncomePerYear,
      totalValue,
      yieldPercent,
    };

    const categories: CategoryStats[] = [];
    for (const [type, categoryAssets] of categoryMap) {
      let catValue = 0;
      let catIncomePerMonth = 0;
      for (const asset of categoryAssets) {
        const price = asset.currentPrice ?? asset.averagePrice ?? 0;
        catValue += price * asset.quantity;

        let paymentPerUnit: number;
        if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
          paymentPerUnit = asset.paymentPerUnit;
        } else {
          const history = historyByAsset.get(asset.id!) ?? [];
          paymentPerUnit = calcFactPaymentPerUnit(history, asset.frequencyPerYear, now);
        }

        catIncomePerMonth += calcAssetIncomePerMonth(
          asset.quantity,
          paymentPerUnit,
          asset.frequencyPerYear,
        );
      }
      const catIncomePerYear = catIncomePerMonth * 12;
      categories.push({
        type,
        assetCount: categoryAssets.length,
        totalIncomePerMonth: catIncomePerMonth,
        totalIncomePerYear: catIncomePerYear,
        totalValue: catValue,
        yieldPercent: catValue > 0 ? calcYieldPercent(catIncomePerYear, catValue) : 0,
        portfolioSharePercent: totalValue > 0 ? (catValue / totalValue) * 100 : 0,
      });
    }
    categories.sort((a, b) => b.totalIncomePerMonth - a.totalIncomePerMonth);

    return { portfolio, categories };
  }, [assets, allHistory]);

  return { portfolio, categories };
}
