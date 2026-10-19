// نسخه را با هر انتشار تغییر بده تا کش قدیمی پاک شود
const VERSION = 'journalme-v6';
const CORE = [
  './', 'index.html', 'style.css', 'script.js', 'fees.js', 'manifest.json',
  'calculator/', 'calculator/index.html',
  'apple-touch-icon.png', 'icons/favicon-96x96.png'
];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // کتابخانه‌های CDN (Chart.js, JSZip, Font Awesome): کش‌اول؛ بعد از یک بار باز شدن آنلاین، آفلاین هم کار می‌کنند
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // فایل‌های خود برنامه: اول شبکه (تا آپدیت‌ها سریع برسند)، اگر آفلاین بود از کش
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
