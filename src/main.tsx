import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './shared/styles/globals.css';
import App from './app';
import { AppProviders } from './app/AppProviders';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);

const launchSplash = document.getElementById('app-launch-splash');
if (launchSplash) {
  requestAnimationFrame(() => {
    launchSplash.classList.add('is-hidden');
    window.setTimeout(() => {
      launchSplash.remove();
    }, 260);
  });
}
