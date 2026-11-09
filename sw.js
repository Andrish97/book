// Service worker Publisher-lite: aplikacja otwiera się przy słabym internecie.
//
// - pliki aplikacji (ta sama domena): najpierw sieć, przy braku sieci kopia
//   z pamięci – dzięki temu po każdym wdrożeniu od razu działa nowa wersja;
// - biblioteki z CDN i czcionki Google: najpierw pamięć (mają wersję w adresie);
// - Supabase (logowanie, dane): zawsze sieć, nic nie jest zapamiętywane.

const PAMIEC = 'publisher-lite-v1';
const PODSTAWA = ['./', './index.html', './manifest.webmanifest', './img/ikony/ikona-192.png'];
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAMIEC).then((c) => c.addAll(PODSTAWA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((klucze) => Promise.all(klucze.filter((k) => k !== PAMIEC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((odp) => {
          if (odp.ok) caches.open(PAMIEC).then((c) => c.put(req, odp.clone()));
          return odp;
        })
        .catch(async () => (await caches.match(req, { ignoreSearch: true }))
          || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())),
    );
    return;
  }

  if (CDN.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((zapamietana) => zapamietana || fetch(req).then((odp) => {
        if (odp.ok || odp.type === 'opaque') caches.open(PAMIEC).then((c) => c.put(req, odp.clone()));
        return odp;
      })),
    );
  }
  // Pozostałe (Supabase) – bez ingerencji.
});
