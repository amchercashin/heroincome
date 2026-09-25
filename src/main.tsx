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

const SPLASH_STORAGE_KEY = 'rt-splash-seen';
const SPLASH_DURATION_MS = 1900;

// Splash: the animation itself is pure CSS in index.html. Show it once per brand
// version, then keep subsequent starts instant.
function runSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash) return;

  let seen = false;
  try {
    seen = !!localStorage.getItem(SPLASH_STORAGE_KEY);
    localStorage.setItem(SPLASH_STORAGE_KEY, '1');
  } catch {
    seen = true;
  }
  if (seen) {
    splash.remove();
    return;
  }

  setTimeout(() => {
    splash.classList.add('s-out');
    setTimeout(() => splash.remove(), 600);
  }, SPLASH_DURATION_MS);
}

// Migrate old DB name before React mounts
migrateDbName().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  runSplash();
});
