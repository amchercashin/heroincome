import { useCallback, type MouseEvent } from 'react';
import { Link, useNavigate, type LinkProps } from 'react-router-dom';
import { withViewTransition, type NavDirection } from '@/lib/view-transition';

interface TransitionLinkProps extends LinkProps {
  /** Animation direction for the page transition. Default: forward. */
  direction?: NavDirection;
}

/**
 * Drop-in replacement for react-router <Link> that wraps
 * navigation in document.startViewTransition().
 * Gracefully degrades: no transition API → behaves like plain <Link>.
 */
export function TransitionLink({ onClick, to, direction = 'forward', state, replace, ...props }: TransitionLinkProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      // Let modified clicks (cmd/ctrl+click) go through normally
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      e.preventDefault();
      onClick?.(e);
      withViewTransition(() => {
        navigate(to, { state, replace });
      }, direction);
    },
    [navigate, to, onClick, direction, state, replace],
  );

  return <Link to={to} state={state} replace={replace} onClick={handleClick} {...props} />;
}
