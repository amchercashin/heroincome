import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// One-time cleanup: old service workers and caches from previous apps (velotrek etc.)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      if (!reg.scope.includes('/way/')) {
        reg.unregister().then(() => location.reload());
      }
    }
  });
}
// Remove leftover caches from other apps that shared this path
caches.keys().then((names) => {
  for (const name of names) {
    if (name.startsWith('velotrek')) {
      caches.delete(name);
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
