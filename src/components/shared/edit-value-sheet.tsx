import { useEffect, useState, type ReactNode } from 'react';
import { BottomSheet } from '@/components/ds/bottom-sheet';
import { Button } from '@/components/ds/button';
import { Field, TextInput, parseDecimal } from '@/components/ds/field';

interface EditValueSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  label: string;
  initialValue: number | null | undefined;
  suffix?: ReactNode;
  hint?: ReactNode;
  /** Allow saving an empty field (calls onSave with null). */
  allowEmpty?: boolean;
  onSave: (value: number | null) => void | Promise<void>;
  /** Optional secondary action, e.g. "reset to calculated". */
  resetLabel?: string;
  onReset?: () => void | Promise<void>;
}

/** Bottom sheet with a single numeric field — the standard way to edit a number. */
export function EditValueSheet({
  open, onOpenChange, title, description, label, initialValue, suffix, hint, allowEmpty, onSave, resetLabel, onReset,
}: EditValueSheetProps) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (open) setDraft(initialValue != null ? String(Math.round(initialValue * 100) / 100).replace('.', ',') : '');
  }, [open, initialValue]);

  const parsed = parseDecimal(draft);
  const valid = (allowEmpty && draft.trim() === '') || (Number.isFinite(parsed) && parsed >= 0);

  const save = async () => {
    if (!valid) return;
    await onSave(draft.trim() === '' ? null : parsed);
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" block disabled={!valid} onClick={save}>
            Сохранить
          </Button>
          {resetLabel && onReset && (
            <Button
              variant="ghost"
              size="md"
              block
              onClick={async () => {
                await onReset();
                onOpenChange(false);
              }}
            >
              {resetLabel}
            </Button>
          )}
        </div>
      }
    >
      <Field label={label} hint={hint}>
        <TextInput
          autoFocus
          inputMode="decimal"
          value={draft}
          suffix={suffix}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </Field>
    </BottomSheet>
  );
}
