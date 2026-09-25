import { useState } from 'react';
import type { ImportDiff, DiffItem } from '@/services/import-diff';

interface ImportPreviewProps {
  diff: ImportDiff;
}

export function ImportPreview({ diff }: ImportPreviewProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const { summary } = diff;

  const added = diff.items.filter(i => i.status === 'added');
  const changed = diff.items.filter(i => i.status === 'changed');
  const removed = diff.items.filter(i => i.status === 'removed');
  const unchanged = diff.items.filter(i => i.status === 'unchanged');

  return (
    <div>
      {/* Summary chips */}
      <div className="mb-3 flex flex-wrap gap-2 text-[length:var(--hi-text-caption)] font-semibold">
        {summary.added > 0 && (
          <span className="rounded-full bg-[var(--hi-positive-tint)] px-3 py-1 text-[var(--hi-positive)]">
            +{summary.added} новых
          </span>
        )}
        {summary.changed > 0 && (
          <span className="rounded-full bg-[var(--hi-gold-tint)] px-3 py-1 text-[var(--hi-gold)]">
            {summary.changed} изменено
          </span>
        )}
        {summary.removed > 0 && (
          <span className="rounded-full bg-[var(--hi-negative-tint)] px-3 py-1 text-[var(--hi-negative)]">
            &minus;{summary.removed} удалён
          </span>
        )}
        {summary.unchanged > 0 && (
          <span className="rounded-full bg-[rgba(236,220,190,0.06)] px-3 py-1 text-[var(--hi-text-3)]">
            {summary.unchanged} ок
          </span>
        )}
      </div>

      {/* Diff table */}
      <div className="overflow-hidden rounded-[22px] border border-[var(--hi-line)] bg-[var(--hi-surface)]">
        {/* Added */}
        {added.map((item, i) => (
          <DiffRow key={`a-${i}`} item={item} />
        ))}
        {/* Changed */}
        {changed.map((item, i) => (
          <DiffRow key={`c-${i}`} item={item} />
        ))}
        {/* Removed */}
        {removed.map((item, i) => (
          <DiffRow key={`r-${i}`} item={item} />
        ))}
        {/* Unchanged (collapsed) */}
        {unchanged.length > 0 && !showUnchanged && (
          <button
            onClick={() => setShowUnchanged(true)}
            className="w-full py-3 text-center text-[length:var(--hi-text-caption)] font-semibold text-[var(--hi-text-3)]"
          >
            &#x25B8; {unchanged.length} без изменений
          </button>
        )}
        {showUnchanged && unchanged.map((item, i) => (
          <DiffRow key={`u-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function DiffRow({ item }: { item: DiffItem }) {
  const borderColor = {
    added: 'border-l-[var(--hi-positive)]',
    changed: 'border-l-[var(--hi-gold)]',
    removed: 'border-l-[var(--hi-negative)]',
    unchanged: 'border-l-transparent',
  }[item.status];

  const bgColor = {
    added: 'bg-[var(--hi-positive-tint)]',
    changed: 'bg-[var(--hi-gold-tint)]',
    removed: 'bg-[var(--hi-negative-tint)]',
    unchanged: '',
  }[item.status];

  const ticker = item.imported?.ticker ?? item.existingAsset?.ticker ?? '\u2014';
  const name = item.imported?.name ?? item.existingAsset?.name ?? '';
  const isRemoved = item.status === 'removed';

  // Quantity display
  const oldQty = item.existingHolding?.quantity;
  const newQty = item.imported?.quantity;


  return (
    <div className={`${bgColor} ${borderColor} flex items-center justify-between border-b border-l-[3px] border-b-[var(--hi-line)] px-3 py-2.5 text-[length:var(--hi-text-body)] last:border-b-0`}>
      <div className="min-w-0">
        <span className={`font-medium ${isRemoved ? 'text-[var(--hi-text-3)] line-through' : 'text-[var(--hi-text)]'}`}>
          {ticker}
        </span>
        {name && ticker !== name && (
          <span className={`ml-1 text-[length:var(--hi-text-body)] ${isRemoved ? 'text-[var(--hi-text-3)]' : 'text-[var(--hi-text-2)]'}`}>
            {name}
          </span>
        )}
      </div>
      <div className="flex gap-3 text-right flex-shrink-0 ml-2">
        {/* Quantity */}
        <DiffValue oldVal={oldQty} newVal={newQty} status={item.status} suffix=" шт" />
      </div>
    </div>
  );
}

function DiffValue({ oldVal, newVal, status, suffix = '' }: {
  oldVal?: number;
  newVal?: number;
  status: DiffItem['status'];
  suffix?: string;
}) {
  if (status === 'added') {
    return <span className="font-semibold text-[var(--hi-positive)]">{newVal}{suffix}</span>;
  }
  if (status === 'removed') {
    return <span className="text-[var(--hi-text-3)] line-through text-[length:var(--hi-text-body)]">{oldVal}{suffix}</span>;
  }
  if (oldVal === newVal || newVal == null) {
    return <span className="text-[var(--hi-text-2)]">{oldVal ?? '\u2014'}{oldVal != null ? suffix : ''}</span>;
  }
  return (
    <span>
      <span className="text-[var(--hi-text-3)] line-through text-[length:var(--hi-text-body)]">{oldVal}{suffix}</span>
      {' '}
      <span className="font-semibold text-[var(--hi-gold)]">{newVal}{suffix}</span>
    </span>
  );
}
