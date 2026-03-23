const CACHE_NAME = 'symptom-diary-v2';
const API_CACHE_NAME = 'symptom-diary-api-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// API paths that should be cached for offline access (GET queries only)
const CACHEABLE_API_PATTERNS = [
  '/api/trpc/entries.',
  '/api/trpc/medReminders.',
  '/api/trpc/notification.',
  '/api/trpc/triggers.',
  '/api/trpc/medications.',
  '/api/trpc/customMetrics.',
  '/api/trpc/medGroups.',
  '/api/trpc/alerts.',
  '/api/trpc/auth.me',
];

// ─── IndexedDB for Offline Mutation Queue ───────────────────────────
const DB_NAME = 'symptom-diary-offline';
const STORE_NAME = 'mutation-queue';

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueOfflineMutation(url, options) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({
      url,
      method: options.method || 'POST',
      headers: Object.fromEntries(new Headers(options.headers || {}).entries()),
      body: options.body || null,
      timestamp: Date.now(),
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[SW] Failed to enqueue offline mutation:', e);
  }
}

async function replayOfflineMutations() {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const allItems = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (allItems.length === 0) return;
    console.log(`[SW] Replaying ${allItems.length} offline mutations`);

    for (const item of allItems) {
      try {
        const resp = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
          credentials: 'include',
        });
        if (resp.ok) {
          const delTx = db.transaction(STORE_NAME, 'readwrite');
          delTx.objectStore(STORE_NAME).delete(item.id);
          await new Promise((resolve) => { delTx.oncomplete = resolve; });
        }
      } catch (e) {
        console.warn('[SW] Replay failed for item', item.id, e);
        break;
      }
    }
  } catch (e) {
    console.error('[SW] replayOfflineMutations error:', e);
  }
}

// ─── API Response Caching ───────────────────────────────────────────

function isCacheableApiPath(pathname) {
  return CACHEABLE_API_PATTERNS.some((p) => pathname.startsWith(p));
}

async function cacheApiResponse(request, response) {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (e) {
    // Quota exceeded or other cache error
  }
}

async function getCachedApiResponse(request) {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    return await cache.match(request);
  } catch (e) {
    return undefined;
  }
}

// ─── Install & Activate ─────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ─── Push Notifications ─────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {
    title: '📝 症状日记提醒',
    body: '今天还没有记录症状哦！',
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    tag: 'daily-reminder',
    data: { url: '/' },
    actions: [],
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      // Use defaults
    }
  }

  const sound = data.sound || 'default';
  let vibrate = [200, 100, 200];
  let requireInteraction = true;
  let silent = false;

  if (sound === 'gentle') {
    vibrate = [100];
    requireInteraction = false;
  } else if (sound === 'urgent') {
    vibrate = [300, 100, 300, 100, 300];
    requireInteraction = true;
  } else if (sound === 'silent') {
    vibrate = [];
    requireInteraction = false;
    silent = true;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      actions: data.actions,
      vibrate: vibrate,
      requireInteraction: requireInteraction,
      silent: silent,
    })
  );
});

// ─── Notification Click ─────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const notificationData = event.notification.data || {};

  event.notification.close();

  // Handle "已服药" action
  if (action === 'confirm-taken' && notificationData.reminderId) {
    event.waitUntil(
      handleConfirmTaken(notificationData.reminderId)
        .then(() => {
          return self.registration.showNotification('✅ 已记录服药', {
            body: '服药记录已保存，库存已更新。',
            icon: '/pwa-icon-192.png',
            badge: '/pwa-icon-192.png',
            tag: 'confirm-' + notificationData.reminderId,
            requireInteraction: false,
          });
        })
        .catch((err) => {
          console.error('[SW] Failed to confirm medication:', err);
          return self.registration.showNotification('❌ 记录失败', {
            body: '服药记录保存失败，请打开应用手动记录。',
            icon: '/pwa-icon-192.png',
            badge: '/pwa-icon-192.png',
            tag: 'confirm-error',
            data: { url: '/' },
            requireInteraction: false,
          });
        })
    );
    return;
  }

  // Handle "稍后提醒" action
  if (action === 'snooze' && notificationData.reminderId) {
    event.waitUntil(
      handleSnooze(notificationData.reminderId)
        .then(() => {
          return self.registration.showNotification('⏰ 已设置稍后提醒', {
            body: '15分钟后将再次提醒您服药。',
            icon: '/pwa-icon-192.png',
            badge: '/pwa-icon-192.png',
            tag: 'snooze-' + notificationData.reminderId,
            requireInteraction: false,
          });
        })
        .catch((err) => {
          console.error('[SW] Failed to snooze:', err);
        })
    );
    return;
  }

  // Handle "查看详情" action from painkiller alerts and weekly reports
  if (action === 'view-trend') {
    const trendUrl = notificationData.url || '/?tab=medication';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(trendUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(trendUrl);
      })
    );
    return;
  }

  // Default: open or focus the app
  const urlToOpen = notificationData.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (urlToOpen && urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// ─── API Helpers ────────────────────────────────────────────────────

async function handleConfirmTaken(reminderId) {
  const response = await fetch('/api/trpc/medReminders.confirmTaken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      json: { reminderId: reminderId },
    }),
  });

  if (!response.ok) {
    throw new Error('API call failed: ' + response.status);
  }

  return response.json();
}

async function handleSnooze(reminderId) {
  const response = await fetch('/api/trpc/medReminders.snooze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      json: { id: reminderId },
    }),
  });

  if (!response.ok) {
    throw new Error('API call failed: ' + response.status);
  }

  return response.json();
}

// ─── Fetch: Network-first with cache fallback ───────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests — but queue POST mutations when offline
  if (request.method !== 'GET') {
    if (request.method === 'POST' && url.pathname.startsWith('/api/trpc/')) {
      event.respondWith(
        fetch(request.clone()).catch(async () => {
          // Offline: queue the mutation for later replay
          const body = await request.clone().text();
          await enqueueOfflineMutation(request.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
          });
          return new Response(JSON.stringify({ result: { data: { json: { queued: true } } } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );
    }
    return;
  }

  // API GET requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/trpc/') && isCacheableApiPath(url.pathname)) {
    event.respondWith(
      fetch(request.clone())
        .then((response) => {
          if (response.ok) {
            cacheApiResponse(request, response);
          }
          return response;
        })
        .catch(() => {
          return getCachedApiResponse(request).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: 'offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          });
        })
    );
    return;
  }

  // Other API requests: network only
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// ─── Message Handler: Online status ─────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data === 'ONLINE') {
    replayOfflineMutations();
  }
});
