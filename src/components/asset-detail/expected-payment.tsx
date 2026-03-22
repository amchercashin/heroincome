interface ExpectedPaymentProps {
  paymentPerUnit: number;
  nextExpectedDate?: Date;
}

export function ExpectedPayment({
  paymentPerUnit,
  nextExpectedDate,
}: ExpectedPaymentProps) {
  if (!nextExpectedDate) return null;

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="border border-[rgba(200,180,140,0.08)] rounded-lg p-3.5 mt-3">
      <div className="font-mono text-[length:var(--way-text-caption)] uppercase tracking-wider text-[var(--way-gold)] mb-2">Ожидаемая выплата</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)]">Выплата на единицу</span>
          <span className="font-mono text-[length:var(--way-text-body)] text-[var(--way-text)]">
            {paymentPerUnit.toLocaleString('ru-RU')} ₽
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)]">Дата (ожид.)</span>
          <span className="font-mono text-[length:var(--way-text-body)] text-[var(--way-text)]">{formatDate(nextExpectedDate)}</span>
        </div>
      </div>
    </div>
  );
}
