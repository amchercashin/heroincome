import { Link } from 'react-router-dom';
import type { Asset, PaymentSchedule } from '@/models/types';
import { formatCurrency, formatFrequency } from '@/lib/utils';
import { calcAssetIncomePerMonth } from '@/services/income-calculator';

interface AssetRowProps {
  asset: Asset;
  schedule?: PaymentSchedule;
}

export function AssetRow({ asset, schedule }: AssetRowProps) {
  const incomePerMonth = schedule
    ? calcAssetIncomePerMonth(asset.quantity, schedule.lastPaymentAmount, schedule.frequencyPerYear)
    : null;
  const incomePerYear = incomePerMonth != null ? incomePerMonth * 12 : null;
  const value = (asset.currentPrice ?? asset.averagePrice) != null
    ? (asset.currentPrice ?? asset.averagePrice)! * asset.quantity
    : null;

  return (
    <Link
      to={`/asset/${asset.id}`}
      className="block bg-[#1a1a2e] rounded-xl p-3 mb-1.5 active:bg-[#222244] transition-colors"
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm font-semibold text-white">{asset.ticker ?? asset.name}</span>
          {asset.ticker && (
            <span className="text-xs text-gray-600 ml-2">{asset.name}</span>
          )}
        </div>
        <span className="text-sm font-semibold text-[#4ecca3]">{formatCurrency(incomePerMonth)}</span>
      </div>
      <div className="flex justify-between text-[11px] text-gray-600 mt-1">
        <span>
          {asset.quantity} шт · {formatCurrency(value)}
        </span>
        {schedule && (
          <span>
            <span className="bg-[#e9c46a22] text-[#e9c46a] px-1.5 py-0.5 rounded text-[10px]">
              {formatFrequency(schedule.frequencyPerYear)}
            </span>
            {' '}
            {formatCurrency(incomePerYear)}/год
          </span>
        )}
      </div>
    </Link>
  );
}
