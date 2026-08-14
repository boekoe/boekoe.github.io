const CACHE = 'boekoe-v38'
const BASE = '/'
const SHELL = [BASE, `${BASE}manifest.webmanifest`, `${BASE}icon.svg`, `${BASE}icon-192.png`, `${BASE}icon-512.png`, `${BASE}icon-maskable-192.png`, `${BASE}icon-maskable-512.png`, `${BASE}apple-touch-icon.png`]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone()
    caches.open(CACHE).then((cache) => cache.put(event.request, copy))
    return response
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match(BASE))))
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data?.json() || {} } catch { data = { body: event.data?.text() || 'Je hebt een nieuwe melding.' } }
  const title = data.title || 'Boekoe'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Je hebt een nieuwe melding.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || `boekoe-${Date.now()}`,
    renotify: true,
    data: {
      url: data.url || '#/notifications',
      notificationId: data.notificationId || null,
    },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const route = typeof event.notification.data?.url === 'string' ? event.notification.data.url : '#/notifications'
  const target = new URL('/', self.location.origin)
  target.hash = route.replace(/^#/, '')
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const current = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (current) {
      if ('navigate' in current) await current.navigate(target.href)
      return current.focus()
    }
    return self.clients.openWindow(target.href)
  })())
})
