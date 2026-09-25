import { useState, useEffect } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import type { Asset, PaymentHistory } from '@/models/types';
import { getTypeColor } from '@/models/account';
import { Card, CategoryDot } from '@/components/ds/surface';
import { useFeedback } from '@/components/ds/feedback';
import { AssetPayments } from './asset-payments';
import { isSyncable, syncAssetPayments, deleteManualPayments } from '@/services/moex-sync';
import { cn, plural } from '@/lib/utils';

interface TypeSectionProps {
  type: string;
  assets: Asset[];
  paymentsByAsset: Map<number, PaymentHistory[]>;
  highlightAssetId?: number;
}

export function TypeSection({ type, assets, paymentsByAsset, highlightAssetId }: TypeSectionProps) {
  const hasHighlight = highlightAssetId != null && assets.some((a) => a.id === highlightAssetId);
  const [expanded, setExpanded] = useState(hasHighlight);
  const [syncing, setSyncing] = useState(false);
  const { confirm, toast } = useFeedback();

  useEffect(() => {
    if (hasHighlight) setExpanded(true);
  }, [hasHighlight]);

  const totalPayments = assets.reduce((sum, a) => sum + (paymentsByAsset.get(a.id!)?.length ?? 0), 0);
  const syncableAssets = assets.filter(isSyncable);
  const manualCount = syncableAssets.flatMap((a) => paymentsByAsset.get(a.id!) ?? []).filter((p) => p.dataSource === 'manual').length;

  const handleSync = async () => {
    if (syncing) return;
    if (manualCount > 0) {
      const ok = await confirm({
        title: `Обновить выплаты: ${type}?`,
        description: `Ручные выплаты (${manualCount}) будут заменены данными Мосбиржи и dohod.ru.`,
        confirmLabel: 'Обновить',
      });
      if (!ok) return;
    }
    setSyncing(true);
    let failed = 0;
    try {
      for (const asset of syncableAssets) {
        if (manualCount > 0) await deleteManualPayments(asset.id!);
        const result = await syncAssetPayments(asset.id!);
        if (!result.success) failed++;
      }
    } catch {
      failed++;
    } finally {
      setSyncing(false);
    }
    toast(failed > 0 ? `Не удалось обновить: ${failed}` : `${type}: выплаты обновлены`, failed > 0 ? 'error' : 'success');
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="hi-pressable flex min-w-0 flex-1 items-center gap-3 py-4 pl-4 pr-2 text-left active:bg-[var(--hi-raised)]"
        >
          <CategoryDot color={getTypeColor(type)} className="ml-0.5" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[length:var(--hi-text-heading)] font-semibold text-[var(--hi-text)]">{type}</div>
            <div className="mt-0.5 text-[length:var(--hi-text-caption)] text-[var(--hi-text-3)]">
              {assets.length} {plural(assets.length, ['актив', 'актива', 'активов'])} · {totalPayments} {plural(totalPayments, ['выплата', 'выплаты', 'выплат'])}
            </div>
          </div>
          <ChevronDown className={cn('size-4 shrink-0 text-[var(--hi-text-3)] transition-transform duration-300', expanded && 'rotate-180')} />
        </button>
        {syncableAssets.length > 0 && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            aria-label={`Обновить выплаты категории ${type} с биржи`}
            className="mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--hi-text-2)] active:bg-[var(--hi-raised)]"
          >
            <RefreshCw className={cn('size-4', syncing && 'animate-spin text-[var(--hi-gold)]')} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-[var(--hi-line)] animate-[hi-fade-in_0.25s_ease-out_both]">
          {assets.map((asset) => (
            <AssetPayments
              key={asset.id}
              asset={asset}
              payments={paymentsByAsset.get(asset.id!) ?? []}
              isHighlighted={highlightAssetId === asset.id}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
