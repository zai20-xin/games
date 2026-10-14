'use strict';
/* 亲子象棋 Service Worker：离线缓存 */
const CACHE = 'chess-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/chess.js',
  './js/audio.js',
  './js/effects.js',
  './js/ai.js',
  './js/levels.js',
  './js/features.js',
  './js/ui.js',
  './js/main.js',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// 网络优先：发版后立即拿到新资产，离线时回退缓存（导航请求回退 index.html）
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((resp) => {
      if (resp && resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
      }
      return resp;
    }).catch(() =>
      caches.match(req).then((hit) => hit || caches.match('./index.html'))
    )
  );
});
