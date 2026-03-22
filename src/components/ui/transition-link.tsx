import { useCallback, type MouseEvent } from 'react';
import { Link, useNavigate, type LinkProps } from 'react-router-dom';
import { withViewTransition } from '@/lib/view-transition';

/**
 * Drop-in replacement for react-router <Link> that wraps
 * navigation in document.startViewTransition().
 * Gracefully degrades: no transition API → behaves like plain <Link>.
 */
export function TransitionLink({ onClick, to, ...props }: LinkProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      // Let modified clicks (cmd/ctrl+click) go through normally
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      e.preventDefault();
      withViewTransition(() => {
        navigate(to);
      });
      onClick?.(e);
    },
    [navigate, to, onClick],
  );

  return <Link to={to} onClick={handleClick} {...props} />;
}
