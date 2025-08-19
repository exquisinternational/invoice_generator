const CACHE_NAME = 'invoice-generator-offline-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  // External CDN resources for offline use
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js'
  // Note: Icons will be cached when they exist, but won't cause errors if missing
];

// Install event - cache everything for offline use
self.addEventListener('install', function(event) {
  console.log('[SW]: Installing offline invoice generator');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW]: Caching app for offline use');
        // Cache core files first
        return cache.addAll(urlsToCache.slice(0, 3)) // Cache HTML, manifest first
          .then(function() {
            // Then try to cache external resources
            return Promise.allSettled(
              urlsToCache.slice(3).map(url => 
                cache.add(url).catch(err => 
                  console.log('[SW]: Could not cache:', url, err.message)
                )
              )
            );
          });
      })
      .then(function() {
        console.log('[SW]: Core app cached - ready for offline use');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.log('[SW]: Caching failed:', error);
      })
  );
});

// Fetch event - serve from cache first (offline-first strategy)
self.addEventListener('fetch', function(event) {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version if available
        if (response) {
          console.log('[SW]: Serving from cache:', event.request.url);
          return response;
        }
        
        // If not in cache, try to fetch
        console.log('[SW]: Fetching from network:', event.request.url);
        return fetch(event.request)
          .then(function(fetchResponse) {
            // Don't cache non-successful responses
            if (!fetchResponse.ok) {
              return fetchResponse;
            }
            
            // Cache successful responses for future offline use
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });
            
            return fetchResponse;
          })
          .catch(function(error) {
            console.log('[SW]: Network fetch failed:', error);
            // For navigation requests, return the main app
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            // For other requests, just fail gracefully
            throw error;
          });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  console.log('[SW]: Activating invoice generator service worker');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW]: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      console.log('[SW]: Service worker activated - invoice generator fully offline');
      return self.clients.claim();
    })
  );
});