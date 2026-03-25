import { useState, useEffect, type ReactNode } from 'react';

interface AssetFieldProps {
  label: string;
  value: string;
  sourceLabel?: string;
  isManualSource?: boolean;
  subtitle?: ReactNode;
  editable?: boolean;
  onSave?: (newValue: string) => void;
  resetLabel?: string;
  onReset?: () => void;
}

export function AssetField({
  label,
  value,
  sourceLabel,
  isManualSource,
  subtitle,
  editable = true,
  onSave,
  resetLabel,
  onReset,
}: AssetFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const startEditing = () => {
    setDraft(value.replace(/[^\d.,]/g, ''));
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    if (draft !== value) {
      onSave?.(draft);
    }
  };

  return (
    <div className="bg-[var(--hi-stone)] rounded-lg p-3 mb-2">
      <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-ash)] mb-1">{label}</div>
      {editing ? (
        <div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-[var(--hi-void)] border border-[var(--hi-gold)] rounded-lg px-2 py-1 text-base text-[var(--hi-text)] outline-none font-mono"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <button
              className="bg-[rgba(200,180,140,0.1)] text-[var(--hi-gold)] px-2 py-1 rounded-lg text-xs font-mono"
              onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
            >
              ✓
            </button>
          </div>
          {resetLabel && onReset && (
            <button
              className="w-full mt-2 border border-[rgba(200,180,140,0.08)] text-[var(--hi-ash)] hover:text-[var(--hi-gold)] py-1 rounded-lg text-[length:var(--hi-text-caption)] font-mono transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                setEditing(false);
                onReset();
              }}
            >
              ↩ {resetLabel}
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center">
            <span
              className={`font-mono text-[length:var(--hi-text-heading)] text-[var(--hi-text)] ${editable ? 'cursor-pointer border-b border-dashed border-[var(--hi-shadow)] hover:border-[var(--hi-gold)] transition-colors' : ''}`}
              onClick={() => editable && startEditing()}
            >
              {value}
            </span>
            {sourceLabel && (
              <span className={`font-mono text-[length:var(--hi-text-caption)] px-1.5 py-0.5 rounded ${
                isManualSource
                  ? 'bg-[rgba(90,85,72,0.15)] text-[var(--hi-ash)]'
                  : 'bg-[rgba(200,180,140,0.1)] text-[var(--hi-gold)]'
              }`}>
                {sourceLabel}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)] mt-1">{subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
}
