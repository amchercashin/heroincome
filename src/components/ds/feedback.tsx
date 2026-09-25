import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: ReactNode;
  tone: ToastTone;
}

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface FeedbackContextValue {
  toast: (message: ReactNode, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const TOAST_ICON: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="text-[var(--hi-positive)]" />,
  error: <AlertTriangle className="text-[var(--hi-negative)]" />,
  info: <Info className="text-[var(--hi-gold)]" />,
};

/** Toasts + promise-based confirm sheet (replaces window.confirm). */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const toast = useCallback((message: ReactNode, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false);
    setConfirmState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setConfirmState((prev) => (prev ? { ...prev, open: false } : prev));
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4"
          style={{ bottom: 'calc(var(--hi-tabbar-h) + var(--hi-safe-bottom) + 20px)' }}
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex max-w-[420px] items-center gap-2.5 rounded-2xl border border-[var(--hi-line-strong)]',
                'bg-[var(--hi-raised)]/95 px-4 py-3 text-[length:var(--hi-text-body)] text-[var(--hi-text)] backdrop-blur-xl',
                'shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] animate-[hi-toast-in_0.35s_var(--hi-ease-spring)_both] [&_svg]:size-[18px] [&_svg]:shrink-0',
              )}
            >
              {TOAST_ICON[t.tone]}
              <span>{t.message}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
      <BottomSheet
        open={!!confirmState?.open}
        onOpenChange={(open) => { if (!open) settle(false); }}
        title={confirmState?.title ?? ''}
        description={confirmState?.description}
      >
        <div className="flex flex-col gap-2.5 pt-2">
          <Button
            variant={confirmState?.destructive ? 'danger' : 'primary'}
            size="lg"
            block
            onClick={() => settle(true)}
          >
            {confirmState?.confirmLabel ?? 'Подтвердить'}
          </Button>
          <Button variant="ghost" size="lg" block onClick={() => settle(false)}>
            {confirmState?.cancelLabel ?? 'Отмена'}
          </Button>
        </div>
      </BottomSheet>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}
