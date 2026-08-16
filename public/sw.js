// Minimal service worker. It exists so the browser offers "Install app", and it
// takes control right away so a new deploy reaches an installed app on the next
// open. Every request goes to the network — the pages are server-rendered and
// the data must be fresh, so there is nothing worth caching here.
//
// ponytail: no offline cache. Add a cache-first rule for /assets/ if the app
// ever needs to open without a connection.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Pass through. A fetch listener is what makes the app installable.
})
