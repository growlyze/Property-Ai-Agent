// Retired service worker.
//
// The previous worker served every request cache-first, including index.html,
// the JS bundles and GET /api responses, so browsers that had visited once kept
// showing old screens and old data after every deploy. This version deletes all
// caches it created, unregisters itself and reloads open tabs so they fetch the
// current app from the network. The app no longer registers a service worker.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.registration.unregister();
      const tabs = await self.clients.matchAll({ type: 'window' });
      tabs.forEach((tab) => tab.navigate(tab.url));
    })()
  );
});

// Never answer from cache: let every request go straight to the network.
self.addEventListener('fetch', () => {});
