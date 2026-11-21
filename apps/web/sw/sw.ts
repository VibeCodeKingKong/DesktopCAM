/**
 * Service worker: gör att desktopCAM fungerar utan nät och kan installeras
 * som app. Byggs av vite-plugin-pwa (injectManifest) med Workbox (MIT).
 *
 * - Appens filer (JS, CSS, HTML, ikoner, licenser) förladdas vid installation.
 * - Typsnitt, exempelprojekt och exempelbilder sparas första gången de hämtas.
 * - En ny version väntar tills användaren väljer "Uppdatera" i appen, så att en
 *   öppen flik aldrig blandar filer från två versioner.
 */
/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Alla sidnavigeringar får appens index.html (ensidesapp), även offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// Typsnitt för text: oföränderliga filer (namn med hash).
registerRoute(
  ({ url }) => url.origin === self.location.origin && /\.(woff2?|ttf|otf)$/.test(url.pathname),
  new CacheFirst({ cacheName: 'dc-fonts', plugins: [new ExpirationPlugin({ maxEntries: 60 })] }),
);

// Exempelprojekt och exempelbilder: visa sparad kopia direkt, hämta ny i bakgrunden.
registerRoute(
  ({ url }) => url.origin === self.location.origin && /^\/(examples|samples)\//.test(url.pathname),
  new StaleWhileRevalidate({ cacheName: 'dc-examples', plugins: [new ExpirationPlugin({ maxEntries: 60 })] }),
);

// Appen skickar SKIP_WAITING när användaren väljer att uppdatera.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
