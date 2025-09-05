const CACHE_NAME = 'school-app-v1';
const STATIC_CACHE = 'static-v1';
const DATA_CACHE = 'data-v1';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/vertretungsplan',
  '/stundenplan'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DATA_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests (substitution and schedule data)
  if (url.pathname.includes('/rest/v1/')) {
    event.respondWith(
      networkFirstWithCache(request, DATA_CACHE)
    );
    return;
  }

  // Handle static assets and pages
  event.respondWith(
    cacheFirstWithNetworkFallback(request, STATIC_CACHE)
  );
});

// Network first strategy for API data
async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(cacheName);
    
    // Only cache successful responses
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback
    return new Response(JSON.stringify({ 
      error: 'Offline', 
      message: 'Daten werden geladen sobald eine Internetverbindung besteht.' 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503
    });
  }
}

// Cache first strategy for static assets
async function cacheFirstWithNetworkFallback(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/');
      return offlineResponse || new Response('Offline');
    }
    throw error;
  }
}

// Background sync for data updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  try {
    // Refresh critical data when back online
    const cache = await caches.open(DATA_CACHE);
    const keys = await cache.keys();
    
    for (const request of keys) {
      try {
        const response = await fetch(request);
        if (response.status === 200) {
          await cache.put(request, response);
        }
      } catch (error) {
        console.log('Failed to sync:', request.url);
      }
    }
  } catch (error) {
    console.log('Background sync failed:', error);
  }
}