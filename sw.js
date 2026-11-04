// Everything the game needs is cached on install, so it plays with no connection.
// Bump VERSION whenever any listed file changes: that is what delivers the update.

const VERSION = 'watch-puzzle-0.1.4';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'vendor/three.module.min.js',
  'vendor/RoomEnvironment.js',
  'src/main.js',
  'src/version.js',
  'src/i18n/en.js',
  'src/i18n/index.js',
  'src/i18n/uk.js',
  'src/game/layout.js',
  'src/game/parts.js',
  'src/game/state.js',
  'src/game/train.js',
  'src/render/materials.js',
  'src/render/parts3d.js',
  'src/render/scene.js',
  'src/render/shapes.js',
  'src/render/trayScale.js',
  'src/ui/audio.js',
  'src/ui/gestures.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // Past the browser's HTTP cache, or an update could store the old files.
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // Only this game's old caches: other projects can share this github.io origin.
      .then((keys) => keys.filter((k) => k !== VERSION && /^(watch-puzzle|godynnykar)-/.test(k)))
      .then((old) => Promise.all(old.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit ?? fetch(event.request)),
  );
});
