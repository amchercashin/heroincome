import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

/** Pill segmented control with a sliding thumb. */
export function Segmented<T extends string>({ value, options, onChange, className, size = 'md', ariaLabel }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-grid rounded-full border border-[var(--hi-line)] bg-[var(--hi-surface)] p-1',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-full bg-[var(--hi-raised)] border border-[var(--hi-line-strong)] shadow-[0_4px_14px_-6px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-[var(--hi-ease-out)]"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 rounded-full font-semibold transition-colors duration-200 whitespace-nowrap',
              size === 'md' ? 'px-5 py-2 text-[length:var(--hi-text-caption)]' : 'px-3 py-1.5 text-[length:var(--hi-text-micro)]',
              active ? 'text-[var(--hi-gold)]' : 'text-[var(--hi-text-3)]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
