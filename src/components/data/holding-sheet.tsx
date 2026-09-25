import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import type { Asset } from '@/models/types';
import type { Holding } from '@/models/account';
import { getTypeSuggestions } from '@/models/account';
import { isExchangeTraded } from '@/models/asset-kind';
import { BottomSheet } from '@/components/ds/bottom-sheet';
import { Button } from '@/components/ds/button';
import { Field, TextInput, parseDecimal } from '@/components/ds/field';
import { useFeedback } from '@/components/ds/feedback';
import { updateHolding, deleteHolding } from '@/hooks/use-holdings';
import { updateAsset } from '@/hooks/use-assets';
import { withViewTransition } from '@/lib/view-transition';
import { formatPrice } from '@/lib/utils';

interface HoldingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  holding: Holding;
  existingTypes: string[];
}

const toDraft = (v: number | undefined | null) => (v != null && isFinite(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : '');

/** Edit one position: quantity, purchase cost, price, category; or remove it. */
export function HoldingSheet({ open, onOpenChange, asset, holding, existingTypes }: HoldingSheetProps) {
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('');
  const exchange = isExchangeTraded(asset);
  const currency = asset.currency ?? 'RUB';
  const unit = currency === 'RUB' ? '₽' : currency;
  const listId = `types-${holding.id}`;

  useEffect(() => {
    if (!open) return;
    setQuantity(toDraft(holding.quantity));
    setCost(toDraft(holding.averagePrice != null ? holding.averagePrice * holding.quantity : null));
    setPrice(toDraft(asset.currentPrice));
    setType(asset.type);
  }, [open, holding, asset]);

  const qty = parseDecimal(quantity);
  const valid = Number.isFinite(qty) && qty >= 0 && type.trim() !== '';

  const save = async () => {
    if (!valid || holding.id == null || asset.id == null) return;
    const totalCost = parseDecimal(cost);
    const newAverage = Number.isFinite(totalCost) ? (qty > 0 ? totalCost / qty : totalCost) : undefined;
    const holdingChanges: Partial<Holding> = { averagePrice: newAverage };
    if (qty !== holding.quantity) {
      holdingChanges.quantity = qty;
      holdingChanges.quantitySource = 'manual';
    }
    await updateHolding(holding.id, holdingChanges);

    const assetChanges: Partial<Asset> = {};
    const newPrice = parseDecimal(price);
    if (Number.isFinite(newPrice) && newPrice !== asset.currentPrice) assetChanges.currentPrice = newPrice;
    if (price.trim() === '' && asset.currentPrice != null) assetChanges.currentPrice = undefined;
    if (type.trim() !== asset.type) assetChanges.type = type.trim();
    if (Object.keys(assetChanges).length > 0) await updateAsset(asset.id, assetChanges);

    onOpenChange(false);
    toast('Сохранено');
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Удалить ${asset.ticker ?? asset.name}?`,
      description: 'Позиция будет удалена из счёта. Если бумаги нет в других счетах, удалится и история её выплат.',
      confirmLabel: 'Удалить',
      destructive: true,
    });
    if (!ok || holding.id == null) return;
    await deleteHolding(holding.id);
    onOpenChange(false);
    toast('Позиция удалена');
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={asset.name}
      description={[asset.ticker, asset.isin && asset.isin !== asset.ticker ? asset.isin : null].filter(Boolean).join(' · ') || asset.type}
      footer={
        <div className="flex gap-2">
          <Button variant="danger" size="lg" onClick={remove} aria-label="Удалить позицию" className="px-4">
            <Trash2 />
          </Button>
          <Button variant="primary" size="lg" block disabled={!valid} onClick={save}>
            Сохранить
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Количество">
            <TextInput inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} suffix="шт" />
          </Field>
          <Field label="Куплено за" hint={Number.isFinite(qty) && qty > 1 && Number.isFinite(parseDecimal(cost)) ? `${formatPrice(parseDecimal(cost) / qty, currency)} за шт` : undefined}>
            <TextInput inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="всего" suffix={unit} />
          </Field>
        </div>
        <Field
          label="Текущая цена за 1 шт"
          hint={exchange ? 'Обновляется с Мосбиржи — ручное значение перезапишется при синхронизации' : 'Для оценки стоимости и доходности'}
        >
          <TextInput inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} suffix={unit} />
        </Field>
        <Field label="Категория">
          <TextInput list={listId} value={type} onChange={(e) => setType(e.target.value)} />
          <datalist id={listId}>
            {getTypeSuggestions(existingTypes).map((t) => <option key={t} value={t} />)}
          </datalist>
        </Field>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            withViewTransition(() => navigate(`/asset/${asset.id}`));
          }}
          className="inline-flex items-center gap-1.5 px-1 text-[length:var(--hi-text-caption)] font-semibold text-[var(--hi-gold)]"
        >
          Доход и выплаты актива <ArrowUpRight className="size-3.5" />
        </button>
      </div>
    </BottomSheet>
  );
}
