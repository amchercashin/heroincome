interface ExpectedPaymentProps {
  paymentPerUnit: number;
  quantity: number;
  nextExpectedDate?: Date;
  nextExpectedCutoffDate?: Date;
  nextExpectedCreditDate?: Date;
}

export function ExpectedPayment({
  paymentPerUnit,
  quantity,
  nextExpectedDate,
  nextExpectedCutoffDate,
  nextExpectedCreditDate,
}: ExpectedPaymentProps) {
  const totalAmount = paymentPerUnit * quantity;

  if (!nextExpectedDate && !nextExpectedCutoffDate) return null;

  const formatDate = (date?: Date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="bg-gradient-to-br from-[#1a2e1a] to-[#1a1a2e] border border-[#4ecca333] rounded-xl p-3.5 mt-3">
      <div className="text-[#4ecca3] text-xs font-semibold mb-2">Ожидаемая выплата</div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Размер</span>
          <span className="text-white">
            ₽{paymentPerUnit} × {quantity} = ₽{Math.round(totalAmount).toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Отсечка (ожид.)</span>
          <span className="text-white">{formatDate(nextExpectedCutoffDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Выплата (ожид.)</span>
          <span className="text-white">{formatDate(nextExpectedDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Зачисление (ожид.)</span>
          <span className="text-white">{formatDate(nextExpectedCreditDate)}</span>
        </div>
      </div>
    </div>
  );
}
