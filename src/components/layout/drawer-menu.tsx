import { TransitionLink } from '@/components/ui/transition-link';
import { SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BarChart3, Database, CalendarDays, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DrawerMenuProps {
  onClose: () => void;
}

const MENU_SECTIONS: {
  title: string;
  items: { label: string; path: string; icon: LucideIcon }[];
}[] = [
  {
    title: 'Просмотр',
    items: [
      { label: 'Мой доход', path: '/', icon: BarChart3 },
    ],
  },
  {
    title: 'Управление',
    items: [
      { label: 'Данные', path: '/data', icon: Database },
      { label: 'Выплаты', path: '/payments', icon: CalendarDays },
    ],
  },
  {
    title: 'Прочее',
    items: [
      { label: 'Настройки', path: '/settings', icon: Settings },
    ],
  },
];

export function DrawerMenu({ onClose }: DrawerMenuProps) {
  return (
    <SheetContent side="left" className="bg-[var(--hi-void)] border-r-[var(--hi-stone)] w-64">
      <SheetHeader>
        <SheetTitle className="font-serif text-[length:var(--hi-text-title)] font-light text-[var(--hi-gold)]">HeroIncome</SheetTitle>
      </SheetHeader>
      <nav className="mt-6">
        {MENU_SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="text-[length:var(--hi-text-caption)] uppercase tracking-[0.3em] text-[var(--hi-shadow)] font-mono mb-2 px-2">
              {section.title}
            </div>
            {section.items.map((item) => (
              <TransitionLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                data-onboarding={item.path === '/data' ? 'menu-data' : undefined}
                className="flex items-center gap-3 px-2 py-2 text-[length:var(--hi-text-heading)] text-[var(--hi-text)] hover:bg-[var(--hi-stone)] transition-colors rounded-lg min-h-[44px]"
              >
                <item.icon size={16} strokeWidth={1.2} className="text-[var(--hi-ash)]" />
                {item.label}
              </TransitionLink>
            ))}
          </div>
        ))}
      </nav>
    </SheetContent>
  );
}
