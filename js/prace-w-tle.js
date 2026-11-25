// Prace w tle konta (#438, etap B): kto je wykonuje. Bez zależności od aplikacji – ocena urządzenia i wybór
// wykonawcy z listy kart widocznych przez obecność (Realtime presence), sprawdzane też w testach.
//
// Kolejność (zgoda właściciela, „jeżeli mamy otwartą na kompie, to żeby nie wybierać telefonu”):
//   1. karta z otwartym projektem pracy – z kilku najmocniejsze urządzenie;
//   2. inna karta konta – najmocniejsze urządzenie (komputer > tablet > telefon; widoczna karta; rdzenie i pamięć;
//      bateria: ładowanie / poziom; telefon tylko na Wi-Fi, a przy dużej pracy tylko podczas ładowania);
//   3. nikt się nie nadaje – serwer (po wygaśnięciu czasu na przejęcie, migracja 20261126100000_prace_w_tle.sql).

export const DUZA_PRACA_STRON = 40; // od tylu stron do narysowania telefon bierze pracę tylko podczas ładowania
export const CZEKANIE_INNYCH_MS = 3000; // tyle czeka karta, która nie jest najlepsza, zanim weźmie niczyją pracę

// Rodzaj urządzenia z tego, co widać w przeglądarce (bez rozpoznawania modeli).
export function klasaUrzadzenia({ ua = '', dotyk = 0, szerokosc = 1920, wysokosc = 1080 } = {}) {
  const krotszy = Math.min(szerokosc, wysokosc);
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && dotyk > 1)) return 'tablet';
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(ua) || (dotyk > 0 && krotszy < 600)) return 'telefon';
  return 'komputer';
}

// Ocena: liczba (większa = mocniejsze) i co urządzenie może wziąć. dane – to, co karta wie o sobie:
// { klasa, rdzenie, pamiec (GB), widoczna, bateria: { laduje, poziom } | null, siec: 'wifi'|'komorkowa'|'nieznana', oszczedzanie }
export function ocena(dane) {
  const { klasa = 'komputer', rdzenie = 4, pamiec = 4, widoczna = true, bateria = null, siec = 'nieznana', oszczedzanie = false } = dane || {};
  let punkty = { komputer: 300, tablet: 200, telefon: 100 }[klasa] ?? 100;
  punkty += Math.min(16, Number(rdzenie) || 0) * 3 + Math.min(16, Number(pamiec) || 0) * 2;
  if (widoczna) punkty += 20;
  if (bateria && !bateria.laduje) punkty -= bateria.poziom < 0.3 ? 80 : 20;
  const telefon = klasa === 'telefon';
  const naKomorkowej = siec === 'komorkowa' || oszczedzanie;
  const male = !(telefon && naKomorkowej) && !(bateria && !bateria.laduje && bateria.poziom < 0.15);
  const duze = male && !(telefon && !(bateria?.laduje));
  return { punkty, male, duze };
}

// Wybór karty spośród obecnych: [{ karta, projekty: [id], punkty, male, duze }]. Zwraca id karty albo null (serwer).
export function wybierzWykonawce(karty, { projekt, stron = 0 } = {}) {
  const duza = stron >= DUZA_PRACA_STRON;
  const mogace = (karty || []).filter((k) => k && (duza ? k.duze : k.male));
  if (!mogace.length) return null;
  const najlepsza = (lista) => [...lista].sort((a, b) => (b.punkty - a.punkty) || String(a.karta).localeCompare(String(b.karta)))[0];
  const zProjektem = mogace.filter((k) => (k.projekty || []).includes(projekt));
  return (najlepsza(zProjektem.length ? zProjektem : mogace)).karta;
}

// Kolejność rysowania stron (#438): najpierw oglądane, potem zmienione (strona była, wygląda inaczej), potem brakujące,
// na końcu reszta. strony: [{ id }], poprzednie: { id: odcisk } z opisu linku, odciski: { id: odcisk }.
export function kolejnoscStron(strony, { ogladane = [], poprzednie = {}, odciski = {} } = {}) {
  const wazne = new Set(ogladane);
  const ranga = (s) => {
    if (wazne.has(s.id)) return 0;
    if (poprzednie[s.id] && poprzednie[s.id] !== odciski[s.id]) return 1;
    if (!poprzednie[s.id]) return 2;
    return 3;
  };
  return strony.map((s, i) => [ranga(s), i, s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
}
