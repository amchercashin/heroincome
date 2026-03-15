import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { getAppSettings, updateAppSetting, clearAllData, type AppSettings } from '@/services/app-settings';

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getAppSettings().then(setSettings);
  }, []);

  const toggle = async (key: string, value: string) => {
    await updateAppSetting(key, value);
    setSettings(await getAppSettings());
  };

  const handleClear = async () => {
    if (!confirm('Удалить все данные? Это действие необратимо.')) return;
    await clearAllData();
    navigate('/');
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  if (!settings) return <AppShell leftAction={backButton} title="Настройки"><div /></AppShell>;

  return (
    <AppShell leftAction={backButton} title="Настройки">
      <div className="space-y-6">
        <SettingRow
          label="Период по умолчанию"
          value={settings.defaultPeriod === 'month' ? 'Месяц' : 'Год'}
          onToggle={() => toggle('defaultPeriod', settings.defaultPeriod === 'month' ? 'year' : 'month')}
        />
        <SettingRow
          label="Автообновление MOEX"
          value={settings.autoMoexSync ? 'Вкл' : 'Выкл'}
          onToggle={() => toggle('autoMoexSync', settings.autoMoexSync ? 'false' : 'true')}
        />
        <div className="border-t border-gray-800 pt-6 mt-8">
          <div className="text-red-400 text-xs uppercase tracking-widest mb-3">Опасная зона</div>
          <button
            onClick={handleClear}
            className="w-full py-3 rounded-lg border border-red-900 text-red-400 text-sm hover:bg-red-900/20 transition-colors"
          >
            Удалить все данные
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function SettingRow({ label, value, onToggle }: {
  label: string; value: string; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-300 text-sm">{label}</span>
      <button onClick={onToggle} className="bg-[#1a1a2e] text-[#4ecca3] text-sm px-3 py-1.5 rounded-lg">
        {value}
      </button>
    </div>
  );
}
