import { isNative } from '.';

/**
 * Registers the service worker on the web only. Native apps bundle their files,
 * so they don't need one (and a stale one could serve old assets inside the app).
 */
export function registerServiceWorker(): void {
  if (isNative || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch((err: unknown) => {
    console.warn('Service worker registration failed', err);
  });
}
