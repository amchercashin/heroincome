import { useState, useEffect } from 'react';
import type { Platform } from '@/hooks/use-install-prompt';
import { IosInstallGuide } from '@/components/ios-install-guide';
import { X } from 'lucide-react';
import { BrandMark } from '@/components/ds/brand-mark';
import { Button } from '@/components/ds/button';

interface InstallButtonProps {
  platform: Platform;
  autoLaunchGuide: boolean;
  onInstall: () => void;
  onDismiss: () => void;
  onIosSeen: () => void;
}

export function InstallButton({
  platform,
  autoLaunchGuide,
  onInstall,
  onDismiss,
  onIosSeen,
}: InstallButtonProps) {
  const [guideOpen, setGuideOpen] = useState(autoLaunchGuide);

  useEffect(() => {
    if (autoLaunchGuide) setGuideOpen(true);
  }, [autoLaunchGuide]);

  function handleClick() {
    if (platform === 'android') {
      onInstall();
    } else {
      setGuideOpen(true);
    }
  }

  function handleCloseGuide() {
    setGuideOpen(false);
    onIosSeen();
  }

  return (
    <>
      <div
        className="fixed inset-x-4 z-40 mx-auto flex max-w-[520px] items-center gap-3 rounded-[22px] border border-[rgba(217,192,142,0.25)] bg-[var(--hi-raised)]/95 py-2.5 pl-3 pr-2 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl"
        style={{
          bottom: 'calc(var(--hi-tabbar-h) + var(--hi-safe-bottom) + 12px)',
          animation: 'hi-fade-slide-up 0.5s var(--hi-ease-out) 1.2s both',
        }}
      >
        <button type="button" onClick={handleClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <BrandMark framed className="size-10" />
          <span className="min-w-0">
            <span className="block text-[length:var(--hi-text-body)] font-semibold text-[var(--hi-text)]">Установите Рантье</span>
            <span className="block truncate text-[length:var(--hi-text-caption)] text-[var(--hi-text-3)]">Иконка на экране и работа офлайн</span>
          </span>
        </button>
        <Button variant="primary" size="sm" onClick={handleClick}>Установить</Button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--hi-text-3)] active:bg-[var(--hi-surface)]"
          aria-label="Скрыть"
        >
          <X className="size-4" />
        </button>
      </div>

      {guideOpen && <IosInstallGuide onClose={handleCloseGuide} />}
    </>
  );
}
