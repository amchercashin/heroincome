import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { withViewTransition } from '@/lib/view-transition';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ds/button';
import { TabBar } from './tab-bar';

interface AppShellProps {
  /** Page title: rendered large (serif) in content, compact in the header once scrolled. */
  title?: ReactNode;
  /** Plain-text version of the title for the compact header when `title` is not a string. */
  compactTitle?: string;
  /** Line under the large title. */
  subtitle?: ReactNode;
  /** Show a back button; the string is the fallback route when there is no history. */
  back?: string;
  /** Replaces the left side of the header (e.g. wordmark on the home screen). */
  headerLeft?: ReactNode;
  /** Right side of the header. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

function canGoBack(): boolean {
  const state = window.history.state as { idx?: number } | null;
  return (state?.idx ?? 0) > 0;
}

export function AppShell({ title, compactTitle, subtitle, back, headerLeft, actions, children, className }: AppShellProps) {
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [titleHidden, setTitleHidden] = useState(false);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const onScroll = () => {
      setScrolled(main.scrollTop > 4);
      const t = titleRef.current;
      setTitleHidden(t ? main.scrollTop > t.offsetTop + t.offsetHeight - 8 : main.scrollTop > 24);
    };
    onScroll();
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  const goBack = () => {
    withViewTransition(() => {
      if (canGoBack()) navigate(-1);
      else navigate(back ?? '/');
    }, 'back');
  };

  const headerTitle = compactTitle ?? (typeof title === 'string' ? title : undefined);

  return (
    <div className="flex h-[100vh] h-[100dvh] flex-col overflow-hidden bg-[var(--hi-void)] text-[var(--hi-text)]">
      <header
        className={cn(
          'relative z-30 flex-shrink-0 transition-[background-color,border-color] duration-300',
          scrolled ? 'hi-glass border-b border-[var(--hi-line)]' : 'border-b border-transparent',
        )}
        style={{ paddingTop: 'max(12px, var(--hi-safe-top))' }}
      >
        <div className="mx-auto grid h-[52px] max-w-[560px] grid-cols-[1fr_auto_1fr] items-center px-3">
          <div className="flex min-w-0 items-center justify-start">
            {back !== undefined ? (
              <IconButton label="Назад" onClick={goBack} className="-ml-1 text-[var(--hi-text)]">
                <ChevronLeft strokeWidth={1.8} className="!size-[26px]" />
              </IconButton>
            ) : (
              headerLeft && <div className="pl-2">{headerLeft}</div>
            )}
          </div>
          <div
            className={cn(
              'max-w-[60vw] truncate text-center text-[length:var(--hi-text-title)] font-semibold text-[var(--hi-text)] transition-all duration-300',
              headerTitle && (titleHidden || !title) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
            )}
            aria-hidden={!titleHidden}
          >
            {headerTitle}
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1">{actions}</div>
        </div>
      </header>

      <main
        ref={mainRef}
        className={cn('flex-1 overflow-y-auto overflow-x-hidden overscroll-contain', className)}
        style={{ paddingBottom: 'calc(var(--hi-tabbar-h) + var(--hi-safe-bottom) + 32px)' }}
      >
        <div className="mx-auto max-w-[560px] px-[var(--hi-gutter)]">
          {title && (
            <div className="pb-5 pt-1 animate-[hi-fade-slide-up_0.5s_var(--hi-ease-out)_both]">
              <h1 ref={titleRef} className="font-serif text-[length:var(--hi-text-large)] font-medium leading-[1.05] text-[var(--hi-text)] break-words">
                {title}
              </h1>
              {subtitle && <div className="mt-2 text-[length:var(--hi-text-caption)] text-[var(--hi-text-3)]">{subtitle}</div>}
            </div>
          )}
          {children}
        </div>
      </main>

      <TabBar />
    </div>
  );
}
