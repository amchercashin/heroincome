import { flushSync } from 'react-dom';

/**
 * Wrap a callback in a View Transition if the API is available.
 * Uses flushSync so React commits DOM changes synchronously
 * inside startViewTransition, allowing the API to capture
 * old and new snapshots correctly.
 */
export function withViewTransition(cb: () => void): void {
  if (!('startViewTransition' in document)) {
    cb();
    return;
  }
  (document as any).startViewTransition(() => {
    flushSync(cb);
  });
}
