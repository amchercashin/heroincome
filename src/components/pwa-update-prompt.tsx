import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-3 rounded-lg border border-[var(--hi-gold)]/20 bg-[var(--hi-stone)] px-4 py-3 shadow-lg sm:left-auto sm:right-4 sm:max-w-sm">
      <p className="text-[length:var(--hi-text-body)] text-[var(--hi-text)]">
        Доступно обновление
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => setNeedRefresh(false)}
          className="rounded px-3 py-1.5 text-[length:var(--hi-text-body)] text-[var(--hi-ash)] hover:text-[var(--hi-text)] transition-colors"
        >
          Позже
        </button>
        <button
          onClick={() => updateServiceWorker(true)}
          className="rounded bg-[var(--hi-gold)] px-3 py-1.5 text-[length:var(--hi-text-body)] font-medium text-[var(--hi-void)] hover:bg-[var(--hi-earth)] transition-colors"
        >
          Обновить
        </button>
      </div>
    </div>
  );
}
