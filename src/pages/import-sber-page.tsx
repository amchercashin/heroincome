import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { parseSberHTML } from '@/services/sber-html-parser';
import type { ImportMode } from '@/services/import-diff';

export function ImportSberPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = ((location.state as Record<string, unknown>)?.mode ?? 'update') as ImportMode;
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);

    const html = await file.text();
    const rows = parseSberHTML(html);

    if (rows.length === 0) {
      setError('Не удалось распознать данные. Убедитесь, что это HTML-отчёт брокера Сбера.');
      return;
    }

    navigate('/import/preview', { state: { mode, rows, source: 'sber_html' } });
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Отчёт Сбера">
      <div className="space-y-4">
        <p className="text-gray-400 text-xs">
          Загрузите HTML-отчёт брокера из Сбербанк Онлайн или email.
          Будут импортированы позиции портфеля с текущими ценами.
        </p>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm"
            onChange={handleFile}
            className="hidden"
          />
          <Button
            onClick={() => fileRef.current?.click()}
            variant="outline"
            className="w-full py-8 border-2 border-dashed border-gray-700 rounded-xl
              text-gray-500 text-sm hover:border-[#4ecca3] hover:text-[#4ecca3] transition-colors"
          >
            {fileName ? fileName : '📂 Выбрать HTML-файл отчёта'}
          </Button>
        </div>

        {error && <div className="text-red-400 text-xs">{error}</div>}
      </div>
    </AppShell>
  );
}
