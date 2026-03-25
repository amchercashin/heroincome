import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { addAccount } from '@/hooks/use-accounts';

interface AddAccountSheetProps {
  open: boolean;
  onClose: () => void;
  onImport?: () => void; // Will be wired in Task 15
}

export function AddAccountSheet({ open, onClose, onImport }: AddAccountSheetProps) {
  const [name, setName] = useState('');

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await addAccount(trimmed);
    setName('');
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="bg-[var(--hi-void)] border-t-[var(--hi-shadow)]">
        <SheetHeader>
          <SheetTitle className="text-[var(--hi-text)]">Добавить счёт</SheetTitle>
          <SheetDescription className="sr-only">Создание нового брокерского счёта</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4 px-4">
          {/* Empty account */}
          <div>
            <label className="text-[length:var(--hi-text-body)] text-[var(--hi-ash)] block mb-1">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Сбер / Недвижимость / Вклады / Прочее"
              className="w-full bg-[var(--hi-stone)] border border-[var(--hi-shadow)] rounded-lg px-3 py-2 text-base text-[var(--hi-text)] placeholder:text-[var(--hi-muted)] outline-none focus:border-[var(--hi-gold)]"
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={!name.trim()}
              className="mt-2 w-full bg-[var(--hi-stone)] text-[var(--hi-text)] py-2 rounded-lg text-[length:var(--hi-text-body)] hover:bg-[var(--hi-shadow)] transition-colors disabled:opacity-40"
            >
              Создать пустой
            </button>
          </div>

          <div className="flex items-center gap-2 text-[var(--hi-muted)] text-[length:var(--hi-text-body)]">
            <div className="flex-1 border-t border-[var(--hi-shadow)]" />
            <span>или</span>
            <div className="flex-1 border-t border-[var(--hi-shadow)]" />
          </div>

          {/* Import */}
          <button
            onClick={() => { onClose(); onImport?.(); }}
            className="w-full border border-[var(--hi-shadow)] text-[var(--hi-text)] py-2 rounded-lg text-[length:var(--hi-text-body)] hover:bg-[var(--hi-stone)] transition-colors"
          >
            Из импорта
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
