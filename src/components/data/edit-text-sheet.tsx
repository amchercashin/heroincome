import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ds/bottom-sheet';
import { Button } from '@/components/ds/button';
import { Field, TextInput } from '@/components/ds/field';

interface EditTextSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  initialValue: string;
  placeholder?: string;
  onSave: (value: string) => void | Promise<void>;
}

export function EditTextSheet({ open, onOpenChange, title, label, initialValue, placeholder, onSave }: EditTextSheetProps) {
  const [draft, setDraft] = useState(initialValue);
  useEffect(() => {
    if (open) setDraft(initialValue);
  }, [open, initialValue]);

  const save = async () => {
    const value = draft.trim();
    if (!value) return;
    await onSave(value);
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={<Button variant="primary" size="lg" block disabled={!draft.trim()} onClick={save}>Сохранить</Button>}
    >
      <Field label={label}>
        <TextInput autoFocus value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
    </BottomSheet>
  );
}
