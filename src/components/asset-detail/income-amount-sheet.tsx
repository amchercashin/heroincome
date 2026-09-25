import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ds/bottom-sheet';
import { Button } from '@/components/ds/button';
import { Field, TextInput, parseDecimal } from '@/components/ds/field';
import { Segmented } from '@/components/ds/segmented';
import { formatPrice } from '@/lib/utils';

type Unit = 'month' | 'year';

interface IncomeAmountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current annual income per unit (pre-fill). */
  annualIncome: number | null;
  /** Annual income calculated from recorded payments, shown as a reference. */
  calculatedAnnual: number;
  currency: string;
  /** Monthly entry is the natural unit for rent and deposits. */
  defaultUnit: Unit;
  onSave: (annualIncome: number) => void | Promise<void>;
}

/** "Своя сумма": a fixed income per unit, entered per month or per year. */
export function IncomeAmountSheet({ open, onOpenChange, annualIncome, calculatedAnnual, currency, defaultUnit, onSave }: IncomeAmountSheetProps) {
  const [unit, setUnit] = useState<Unit>(defaultUnit);
  const [draft, setDraft] = useState('');
  const suffix = currency === 'RUB' ? '₽' : currency;

  const toDraft = (annual: number | null, u: Unit) =>
    annual != null && annual > 0 ? String(Math.round((u === 'month' ? annual / 12 : annual) * 100) / 100).replace('.', ',') : '';

  useEffect(() => {
    if (!open) return;
    setUnit(defaultUnit);
    setDraft(toDraft(annualIncome, defaultUnit));
  }, [open, annualIncome, defaultUnit]);

  const value = parseDecimal(draft);
  const valid = Number.isFinite(value) && value >= 0;
  const annual = valid ? (unit === 'month' ? value * 12 : value) : null;

  const switchUnit = (next: Unit) => {
    if (next === unit) return;
    setDraft(toDraft(annual, next));
    setUnit(next);
  };

  const save = async () => {
    if (annual == null) return;
    await onSave(annual);
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Своя сумма дохода"
      description="Сколько приносит одна бумага или объект, до НДФЛ. Сумма учитывается каждый месяц, пока вы её не измените, — записывать выплаты не нужно."
      footer={
        <Button variant="primary" size="lg" block disabled={!valid} onClick={save}>
          Сохранить
        </Button>
      }
    >
      <div className="mb-4 flex justify-center">
        <Segmented
          value={unit}
          onChange={switchUnit}
          ariaLabel="Период суммы"
          options={[
            { value: 'month', label: 'В месяц' },
            { value: 'year', label: 'В год' },
          ]}
        />
      </div>
      <Field
        label={unit === 'month' ? 'Сколько приходит в месяц' : 'Сколько приходит за год'}
        hint={
          <>
            {annual != null && annual > 0 && (unit === 'month' ? `= ${formatPrice(annual, currency)} в год` : `≈ ${formatPrice(annual / 12, currency)} в месяц`)}
            {calculatedAnnual > 0 && ` · по выплатам: ${formatPrice(calculatedAnnual, currency)} в год`}
          </>
        }
      >
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
