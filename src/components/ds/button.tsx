import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[linear-gradient(180deg,var(--hi-gold-bright),var(--hi-gold))] text-[#1a1509] font-semibold shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_8px_24px_-8px_var(--hi-gold-glow)] active:brightness-95',
  secondary:
    'bg-[var(--hi-raised)] text-[var(--hi-text)] border border-[var(--hi-line)] active:bg-[#23201a]',
  outline:
    'bg-transparent text-[var(--hi-gold)] border border-[var(--hi-line-strong)] active:bg-[var(--hi-gold-tint)]',
  ghost:
    'bg-transparent text-[var(--hi-text-2)] active:bg-[var(--hi-raised)]',
  danger:
    'bg-[var(--hi-negative-tint)] text-[var(--hi-negative)] border border-[rgba(224,122,107,0.2)] active:bg-[rgba(224,122,107,0.2)]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 rounded-xl text-[length:var(--hi-text-caption)] gap-1.5',
  md: 'h-11 px-4 rounded-2xl text-[length:var(--hi-text-body)] gap-2',
  lg: 'h-[52px] px-5 rounded-2xl text-[length:var(--hi-text-heading)] gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, loading, icon, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'hi-pressable inline-flex items-center justify-center font-medium whitespace-nowrap select-none outline-none',
        'disabled:opacity-40 disabled:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-[1.15em]',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'gold' | 'danger';
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'default', size = 'md', className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'hi-pressable inline-flex items-center justify-center rounded-full outline-none shrink-0',
        'disabled:opacity-40 disabled:pointer-events-none',
        size === 'md' ? 'size-11 [&_svg]:size-[22px]' : 'size-9 [&_svg]:size-[18px]',
        tone === 'default' && 'text-[var(--hi-text-2)] active:bg-[var(--hi-raised)]',
        tone === 'gold' && 'text-[var(--hi-gold)] active:bg-[var(--hi-gold-tint)]',
        tone === 'danger' && 'text-[var(--hi-negative)] active:bg-[var(--hi-negative-tint)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
