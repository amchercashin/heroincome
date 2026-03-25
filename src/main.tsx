import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { migrateDbName } from './db/migrate-db-name';
import App from './App';
import './index.css';

// Cleanup: unregister any SW that was previously registered at wrong scope for this app
// (other apps' SWs at their own scopes are fine — don't touch them)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      const scope = new URL(reg.scope).pathname;
      if (scope === '/' || scope === '/way' || scope === '/heroincome') {
        // Root-scope SW or missing trailing slash — leftover from old deploy
        reg.unregister();
      }
    }
  });
}

// Splash screen: show only on first launch
function runSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash) return;

  if (localStorage.getItem('hi-splash-seen')) {
    splash.remove();
    return;
  }

  localStorage.setItem('hi-splash-seen', '1');

  const fills = splash.querySelectorAll<HTMLElement>('.s-fill');
  const bang = document.getElementById('s-bang');

  // Measure natural widths
  const widths: number[] = [];
  fills.forEach((f) => {
    f.style.cssText = 'width:auto;opacity:1;position:absolute;visibility:hidden;';
    widths.push(f.getBoundingClientRect().width);
    f.style.cssText = 'width:0;overflow:hidden;opacity:0;';
  });

  // Hero fills: indices 0,1,2 (e,r,o). Income fills: indices 3,4,5,6,7 (n,c,o,m,e)
  const heroFills = [0, 1, 2];
  const incomeFills = [3, 4, 5, 6, 7];
  const revealDuration = 600; // ms for both groups
  const startAt = 800; // hold HI! for 800ms

  // Reveal hero group (3 letters over revealDuration)
  heroFills.forEach((idx, i) => {
    setTimeout(() => {
      fills[idx].style.transition = 'width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease';
      fills[idx].style.width = widths[idx] + 'px';
      fills[idx].style.opacity = '1';
    }, startAt + (i / 3) * revealDuration);
  });

  // Reveal income group (5 letters over same revealDuration)
  incomeFills.forEach((idx, i) => {
    setTimeout(() => {
      fills[idx].style.transition = 'width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease';
      fills[idx].style.width = widths[idx] + 'px';
      fills[idx].style.opacity = '1';
    }, startAt + (i / 5) * revealDuration);
  });

  // Fade out !
  setTimeout(() => {
    if (bang) bang.style.opacity = '0';
  }, startAt + revealDuration);

  // Hold result, then fade out entire splash
  setTimeout(() => {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }, 2000);
}

// Migrate old DB name before React mounts
migrateDbName().then(() => {
  // Mount React immediately — splash overlay covers it during animation
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  // Run splash animation (or remove if already seen)
  runSplash();
});
