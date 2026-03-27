import { useState, useCallback } from 'react';

interface IosInstallGuideProps {
  onClose: () => void;
}

const TOTAL_STEPS = 4;

const BASE = import.meta.env.BASE_URL;

const fingerStyle: React.CSSProperties = {
  position: 'absolute',
  fontSize: 28,
  pointerEvents: 'none',
  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
};

/* ── Step screenshots + finger positions ── */

const STEPS: {
  src: string;
  alt: string;
  caption: string;
  /** CSS object-position to crop the screenshot to the relevant area */
  objectPosition: string;
  /** Finger position as CSS properties (top/bottom/left/right in %) */
  finger: React.CSSProperties;
}[] = [
  {
    src: `${BASE}a2hs/step1-toolbar.jpg`,
    alt: 'Панель Safari с кнопкой ⋯',
    caption: 'Нажмите «⋯» в панели Safari',
    objectPosition: 'center bottom',
    finger: { bottom: '8%', right: '8%' },
  },
  {
    src: `${BASE}a2hs/step2-menu.jpg`,
    alt: 'Меню Safari с пунктом Поделиться',
    caption: 'Нажмите «Поделиться»',
    objectPosition: 'center 15%',
    finger: { top: '10%', right: '30%' },
  },
  {
    src: `${BASE}a2hs/step3-share.jpg`,
    alt: 'Share sheet с пунктом На экран Домой',
    caption: 'Выберите «Добавить на экран Домой»',
    objectPosition: 'center 68%',
    finger: { bottom: '10%', left: '65%' },
  },
  {
    src: `${BASE}a2hs/step4-confirm.jpg`,
    alt: 'Экран подтверждения с кнопкой Добавить',
    caption: 'Нажмите «Добавить»',
    objectPosition: 'center top',
    finger: { top: '8%', right: '8%' },
  },
];

export function IosInstallGuide({ onClose }: IosInstallGuideProps) {
  const [step, setStep] = useState(0);

  const advance = useCallback(() => {
    if (step >= TOTAL_STEPS - 1) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, onClose]);

  const current = STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9000] bg-black/60 animate-[hi-fade-in_0.2s_ease-out_both]"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[9001] bg-[var(--hi-stone)] rounded-t-2xl animate-[hi-fade-slide-up_0.3s_ease-out_both]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        onClick={advance}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-9 h-1 rounded-full bg-[var(--hi-shadow)]" />
        </div>

        {/* Step indicator */}
        <div className="text-center mb-4">
          <span className="font-mono text-[length:var(--hi-text-micro)] text-[var(--hi-ash)]">
            {step + 1} / {TOTAL_STEPS}
          </span>
        </div>

        {/* Screenshot with finger overlay */}
        <div className="px-4 mb-4">
          <div className="relative rounded-xl overflow-hidden border border-[rgba(200,180,140,0.08)] h-[240px]">
            <img
              src={current.src}
              alt={current.alt}
              className="w-full h-full block"
              style={{ objectFit: 'cover', objectPosition: current.objectPosition }}
            />
            {/* Animated finger */}
            <span
              className="animate-[a2hs-tap_2s_ease-in-out_infinite]"
              style={{ ...fingerStyle, ...current.finger }}
            >
              👆
            </span>
          </div>
        </div>

        {/* Caption */}
        <div className="text-center px-4">
          <div className="text-[length:var(--hi-text-body)] text-[var(--hi-gold)] font-medium">
            {current.caption}
          </div>
          <div className="text-[length:var(--hi-text-micro)] text-[var(--hi-ash)] mt-2">
            Нажмите, чтобы продолжить
          </div>
        </div>
      </div>
    </>
  );
}
