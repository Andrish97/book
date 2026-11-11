// Service worker Seriodruku: drugie i kolejne uruchomienie nie czeka na sieć.
//
// - Kod aplikacji (index.html, js/, css/, manifest) jednej wersji leży w pamięci tej wersji
//   („seriodruk-<wersja>”) i z niej jest podawany – bez pytania sieci. Przy wdrożeniu skrypt
//   scripts/wersja-sw.py wpisuje tu numer wersji (skrót commita) i listę plików; nowa wersja pobiera je
//   w całości przy instalacji, więc w pamięci nigdy nie mieszają się pliki dwóch wersji.
// - Nowa wersja czeka, aż strona ją włączy (js/aplikacja.js: od razu, gdy nie ma otwartego projektu,
//   a w projekcie po kliknięciu „Odśwież”) – albo do następnego uruchomienia aplikacji. Przeglądarka
//   sprawdza ten plik przy każdym wejściu, więc nowa wersja przychodzi najpóźniej przy kolejnym otwarciu.
// - Pozostałe pliki z tej samej domeny (czcionki, profile barwne, ikony, zrzuty instrukcji): z pamięci,
//   a w tle sprawdzane i odświeżane, gdy się zmieniły.
// - Biblioteki z CDN: z pamięci (mają wersję w adresie).
// - Supabase (logowanie, dane): zawsze sieć, nic nie jest zapamiętywane.
//
// Bez wdrożenia (wersja „rozwoj”, np. serwer na własnym komputerze) kod idzie najpierw z sieci, jak
// dawniej – inaczej każda zmiana pliku wymagałaby czyszczenia pamięci przeglądarki.

const WERSJA = 'rozwoj';
const PLIKI = [];

const ROZWOJ = WERSJA === 'rozwoj';
const KOD = `seriodruk-kod-${WERSJA}`;
const RESZTA = 'seriodruk-pliki';
const BIBLIOTEKI = 'seriodruk-biblioteki';
const PODSTAWA = ['./', './index.html', './manifest.webmanifest'];
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];
// Duże biblioteki używane rzadko (PDF, Excel, ZIP) – w repozytorium, z wersją w nazwie pliku. Nie są pobierane
// przy każdym wdrożeniu: trafiają do pamięci przy pierwszym użyciu i zostają w niej między wersjami aplikacji.
const toRzadkaBiblioteka = (sciezka) => /\/js\/zewnetrzne\/(pdf-lib|fontkit|jszip|xlsx)-[\d.]+[^/]*\.js$/.test(sciezka);
const toKod = (sciezka) => sciezka === '/' || /\/(index\.html|manifest\.webmanifest|sw\.js)$/.test(sciezka) || /\/(js|css)\//.test(sciezka);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const pamiec = await caches.open(KOD);
    // Pobranie z pominięciem pamięci podręcznej HTTP – inaczej nowa wersja mogłaby dostać stary plik.
    await pamiec.addAll([...PODSTAWA, ...PLIKI].map((p) => new Request(p, { cache: 'reload' })));
    if (ROZWOJ) await self.skipWaiting();
  })());
});

// Strona prosi o włączenie czekającej nowej wersji (js/aplikacja.js).
self.addEventListener('message', (e) => {
  if (e.data === 'wlacz-nowa-wersje') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const klucze = await caches.keys();
    await Promise.all(klucze.filter((k) => k.startsWith('seriodruk-') && ![KOD, RESZTA, BIBLIOTEKI].includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function zSieci(req, nazwaPamieci) {
  const odp = await fetch(req);
  if (odp.ok) {
    const kopia = odp.clone();
    caches.open(nazwaPamieci).then((c) => c.put(req, kopia));
  }
  return odp;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const nawigacja = req.mode === 'navigate';
    if (ROZWOJ) {
      // Bez wdrożenia: najpierw sieć, przy braku sieci kopia.
      e.respondWith(zSieci(req, KOD).catch(async () => (await caches.match(req, { ignoreSearch: true }))
        || (nawigacja ? caches.match('./index.html') : Response.error())));
      return;
    }
    if (toRzadkaBiblioteka(url.pathname)) {
      e.respondWith(caches.open(BIBLIOTEKI).then(async (c) => (await c.match(req)) || zSieci(req, BIBLIOTEKI)));
      return;
    }
    if (nawigacja || toKod(url.pathname)) {
      // Kod tej wersji: z jej pamięci; czego tam nie ma – z sieci (i zapamiętane).
      e.respondWith((async () => {
        const pamiec = await caches.open(KOD);
        const trafienie = await pamiec.match(nawigacja ? './index.html' : req, { ignoreSearch: true });
        return trafienie || zSieci(req, KOD).catch(() => Response.error());
      })());
      return;
    }
    // Czcionki, obrazy, profile: z pamięci od razu, a w tle sprawdzenie, czy się nie zmieniły.
    e.respondWith((async () => {
      const zapamietana = await caches.match(req, { ignoreSearch: true });
      const swieza = zSieci(req, RESZTA);
      if (zapamietana) { e.waitUntil(swieza.catch(() => {})); return zapamietana; }
      return swieza;
    })());
    return;
  }

  if (CDN.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((zapamietana) => zapamietana || fetch(req).then((odp) => {
        if (odp.ok || odp.type === 'opaque') { const kopia = odp.clone(); caches.open(BIBLIOTEKI).then((c) => c.put(req, kopia)); }
        return odp;
      })),
    );
  }
  // Pozostałe (Supabase) – bez ingerencji.
});
