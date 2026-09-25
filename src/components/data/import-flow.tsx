import { useState, useCallback, useRef } from 'react';
import { BottomSheet } from '@/components/ds/bottom-sheet';
import { Button } from '@/components/ds/button';
import { Field, TextArea, TextInput } from '@/components/ds/field';
import { ChevronRight, Loader2 } from 'lucide-react';
import { parseSberHTML, extractAgreementNumber } from '@/services/sber-html-parser';
import { parseMDTable } from '@/services/import-parser';
import { computeImportDiff } from '@/services/import-diff';
import { applyImportDiff } from '@/services/import-applier';
import type { ImportDiff } from '@/services/import-diff';
import type { ImportRecord } from '@/models/types';
import { ImportPreview } from './import-preview';
import { Landmark, Bot, ArrowLeft, Copy, Check } from 'lucide-react';
import { useSyncContext } from '@/contexts/sync-context';
import { syncSingleAsset, isSyncable } from '@/services/moex-sync';
import { db } from '@/db/database';
import { enrichFromMoex } from '@/services/moex-enrich';

interface ImportFlowProps {
  open: boolean;
  onClose: () => void;
  accountId: number | null;  // null = new account
  accountName?: string;       // current name for existing account
}

type Step = 'method' | 'ai' | 'preview';

const AI_PROMPT = `Преобразуй данные из отчёта брокера в Markdown-таблицу:

| Тикер | ISIN | Название | Тип | Кол-во | Ср.цена | Валюта |
|-------|------|----------|-----|--------|---------|--------|

Правила:
- Тип: акция, облигация, фонд
- Ср.цена: средняя цена покупки (₽). Для облигаций — в % от номинала, как в отчёте
- Валюта: RUB, USD, EUR, CNY или другая валюта из отчёта. Если не указана, оставь пустой
- ISIN: международный идентификатор бумаги
- Если данных нет, оставь ячейку пустой

Ответ — ТОЛЬКО блок кода с таблицей, без пояснений`;

function MethodButton({ icon: Icon, label, desc, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hi-pressable flex w-full items-center gap-3.5 rounded-[22px] border border-[var(--hi-line)] bg-[var(--hi-surface)] p-4 text-left active:bg-[var(--hi-raised)]"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--hi-line-strong)] bg-[var(--hi-raised)] text-[var(--hi-gold)]">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[length:var(--hi-text-body)] font-semibold text-[var(--hi-text)]">{label}</div>
        <div className="mt-0.5 text-[length:var(--hi-text-caption)] leading-snug text-[var(--hi-text-3)]">{desc}</div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-[var(--hi-text-3)]" />
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 inline-flex items-center gap-1 text-[length:var(--hi-text-caption)] font-semibold text-[var(--hi-text-2)]"
    >
      <ArrowLeft className="size-3.5" />
      Назад
    </button>
  );
}

function Working({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-[length:var(--hi-text-caption)] text-[var(--hi-text-2)]">
      <Loader2 className="size-4 animate-spin text-[var(--hi-gold)]" />
      {text}
    </div>
  );
}

export function ImportFlow({ open, onClose, accountId, accountName }: ImportFlowProps) {
  const [step, setStep] = useState<Step>('method');
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [suggestedName, setSuggestedName] = useState('');
  const [editableName, setEditableName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [importSource, setImportSource] = useState<ImportRecord['source']>('sber_html');
  const [aiText, setAiText] = useState('');
  const [copied, setCopied] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const sberFileRef = useRef<HTMLInputElement>(null);
  const { triggerSync } = useSyncContext();

  const reset = useCallback(() => {
    setStep('method');
    setDiff(null);
    setSuggestedName('');
    setEditableName('');
    setError(null);
    setApplying(false);
    setImportSource('sber_html');
    setAiText('');
    setCopied(false);
    setEnriching(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const setDefaultName = (name: string) => {
    if (accountId === null) {
      setSuggestedName(name);
      setEditableName(name);
    }
  };

  const goToPreview = async (rows: import('@/services/import-parser').ImportAssetRow[]) => {
    const importDiff = await computeImportDiff(rows, accountId);
    setDiff(importDiff);
    setStep('preview');
  };

  // --- Sber HTML upload ---
  const handleSberUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const html = await file.text();
      const rows = parseSberHTML(html);
      if (rows.length === 0) {
        setError('Не удалось разобрать отчёт. Убедитесь что это HTML-отчёт Сбера.');
        return;
      }

      if (accountId === null) {
        const agreement = extractAgreementNumber(html);
        const name = agreement ? `Сбер / ${agreement}` : 'Новый счёт';
        setDefaultName(name);
      }

      setImportSource('sber_html');
      setEnriching(true);
      try {
        const enriched = await enrichFromMoex(rows);
        await goToPreview(enriched);
      } catch {
        await goToPreview(rows);
      } finally {
        setEnriching(false);
      }
    } catch {
      setError('Ошибка при разборе файла');
    }

    e.target.value = '';
  };

  // --- AI paste ---
  const handleAiParse = async () => {
    setError(null);
    try {
      const rows = parseMDTable(aiText);
      if (rows.length === 0) {
        setError('Не удалось распознать таблицу. Убедитесь что вставлен Markdown-ответ AI.');
        return;
      }
      setDefaultName('Новый счёт');
      setImportSource('ai_import');
      setEnriching(true);
      try {
        const enriched = await enrichFromMoex(rows);
        await goToPreview(enriched);
      } catch {
        await goToPreview(rows);
      } finally {
        setEnriching(false);
      }
    } catch {
      setError('Ошибка при разборе текста');
    }
  };

  // --- Apply ---
  const handleApply = async () => {
    if (!diff) return;
    setApplying(true);
    try {
      const name = accountId === null ? editableName.trim() || suggestedName : undefined;
      const { newAssetIds } = await applyImportDiff(diff, importSource, name);
      handleClose();
      triggerSync();

      // Sync payments for newly created syncable assets (fire-and-forget)
      (async () => {
        for (const id of newAssetIds) {
          const asset = await db.assets.get(id);
          if (asset && isSyncable(asset)) {
            try { await syncSingleAsset(id); } catch { /* ignore */ }
          }
        }
      })();
    } catch {
      setError('Ошибка при применении импорта');
      setApplying(false);
    }
  };

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const title = step === 'preview' ? 'Проверьте изменения' : accountId !== null ? `Импорт: ${accountName}` : 'Импорт отчёта';
  const description = step === 'method'
    ? 'Бумаги, количество и цены покупки — из отчёта брокера. Выплаты подтянутся с биржи.'
    : step === 'ai'
      ? 'Любой брокер: ИИ-ассистент превратит отчёт в таблицу.'
      : 'Ничего не изменится, пока вы не нажмёте «Применить».';

  return (
    <BottomSheet
      open={open}
      onOpenChange={(v) => !v && handleClose()}
      title={title}
      description={description}
      footer={
        step === 'preview' && diff ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={handleClose} className="flex-1">Отмена</Button>
            <Button variant="primary" size="lg" onClick={handleApply} loading={applying} className="flex-[2]">
              {applying ? 'Применяю…' : 'Применить'}
            </Button>
          </div>
        ) : step === 'ai' ? (
          <Button variant="primary" size="lg" block onClick={handleAiParse} disabled={!aiText.trim() || enriching} loading={enriching}>
            Распознать таблицу
          </Button>
        ) : undefined
      }
    >
      {step === 'method' && (
        <div className="space-y-2.5">
          <MethodButton icon={Landmark} label="Отчёт Сбербанка" desc="HTML-файл брокерского отчёта" onClick={() => sberFileRef.current?.click()} />
          <MethodButton icon={Bot} label="Любой брокер через ИИ" desc="Промт для ChatGPT или Claude → вставьте ответ" onClick={() => setStep('ai')} />
          {enriching && <Working text="Определяю бумаги на Мосбирже…" />}
          {error && <p className="px-1 text-[length:var(--hi-text-caption)] text-[var(--hi-negative)]">{error}</p>}
        </div>
      )}

      {step === 'ai' && (
        <div className="space-y-4">
          <BackButton onClick={() => { setStep('method'); setError(null); }} />
          <ol className="space-y-1.5 px-1 text-[length:var(--hi-text-caption)] text-[var(--hi-text-2)]">
            <li><span className="font-semibold text-[var(--hi-gold)]">1.</span> Скопируйте промт</li>
            <li><span className="font-semibold text-[var(--hi-gold)]">2.</span> Отправьте его ИИ вместе с отчётом брокера</li>
            <li><span className="font-semibold text-[var(--hi-gold)]">3.</span> Вставьте ответ ниже</li>
          </ol>
          <div className="relative">
            <pre className="max-h-40 max-w-full overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--hi-line)] bg-[var(--hi-surface)] p-3.5 pr-12 text-[12px] leading-relaxed text-[var(--hi-text-3)]">
              {AI_PROMPT}
            </pre>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-[var(--hi-line-strong)] bg-[var(--hi-raised)] px-2.5 py-1.5 text-[length:var(--hi-text-micro)] font-semibold text-[var(--hi-gold)]"
              title="Скопировать промт"
            >
              {copied ? <Check className="size-3.5 text-[var(--hi-positive)]" /> : <Copy className="size-3.5" />}
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
          <Field label="Ответ ИИ">
            <TextArea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Вставьте Markdown-таблицу из ответа AI..."
              className="font-mono text-[14px]"
            />
          </Field>
          {enriching && <Working text="Определяю бумаги на Мосбирже…" />}
          {error && <p className="px-1 text-[length:var(--hi-text-caption)] text-[var(--hi-negative)]">{error}</p>}
        </div>
      )}

      {step === 'preview' && diff && (
        <div className="space-y-4">
          {accountId === null && (
            <Field label="Название счёта">
              <TextInput value={editableName} onChange={(e) => setEditableName(e.target.value)} />
            </Field>
          )}
          <ImportPreview diff={diff} />
          {error && <p className="px-1 text-[length:var(--hi-text-caption)] text-[var(--hi-negative)]">{error}</p>}
        </div>
      )}

      <input ref={sberFileRef} type="file" accept=".html,.htm" onChange={handleSberUpload} className="hidden" />
    </BottomSheet>
  );
}
