const CACHE_NAME = 'symptom-diary-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Push: handle incoming push notifications
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

  // Determine vibration and interaction based on sound preference
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

// Notification click: handle actions and default click
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const notificationData = event.notification.data || {};

  event.notification.close();

  // Handle "已服药" action
  if (action === 'confirm-taken' && notificationData.reminderId) {
    event.waitUntil(
      handleConfirmTaken(notificationData.reminderId)
        .then(() => {
          // Show a confirmation notification
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
          // Show error notification
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
          // Navigate existing window to the target URL (supports hash-based tab switching)
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

/**
 * Call the backend API to confirm medication taken.
 * Uses tRPC batch endpoint format.
 */
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

/**
 * Call the backend API to snooze a medication reminder.
 */
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

// Fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API requests: network only
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
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
