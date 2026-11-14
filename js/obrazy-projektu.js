// Obrazy projektu jako pliki: rozpoznawanie duplikatów, użycia, usuwanie, podmiana i zmiana nazwy.
//
// Obraz to wpis w projekt.zasoby ({ nazwa, dataUrl | typ, rozmiar, sciezka, skrot }) wskazywany przez
// elementy stron i wzorców (`o.zasob`) albo – nazwą bez rozszerzenia – przez komórki tabel danych
// (pole obrazu z kolumny, js/zlozenie.js). Czcionki własne też leżą w zasobach, ale tu ich nie ma.
//
// Plik pod danym identyfikatorem nigdy się nie zmienia: inne urządzenia trzymają go w magazynie przeglądarki
// pod tym identyfikatorem i drugi raz go nie pobierają. Dlatego podmiana pliku i zmiana nazwy dają nowy
// identyfikator, elementy są do niego przepinane (także w każdym kroku historii cofania), a stary znika.
// Usunięty identyfikator trafia do `projekt.zasoby_usuniete` – łączenie z kontem nie przywraca go z powrotem.

import { uid } from './projekt.js';
import { blobZasobu, naDataUrl, dataUrlZasobu, usunPlikZasobu } from './zasoby.js';
import { pelnaNazwa, obrazZNazwy } from './nazwy-obrazow.js';
import { wymiaryObrazu, wolnaNazwaWsrod, grupujPowtorzenia } from './obrazy-wspolne.js';

const czcionki = (p) => new Set((p?.czcionki || []).map((c) => c.id));

// [[id, opis]] obrazów projektu (bez czcionek), posortowane po nazwie.
export function obrazyProjektu(p) {
  const pomin = czcionki(p);
  return Object.entries(p?.zasoby || {})
    .filter(([id, z]) => z && !pomin.has(id))
    .sort(([, a], [, b]) => String(a.nazwa).localeCompare(String(b.nazwa), 'pl', { numeric: true }));
}

// Skrót SHA-256 treści pliku (szesnastkowo) – ten sam obraz wgrany drugi raz ma ten sam skrót.
export async function skrotPliku(blob) {
  const bajty = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(bajty)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const rozmiarZDataUrl = (d) => {
  const i = d.indexOf(',');
  const b64 = d.slice(i + 1);
  return /;base64,/.test(d.slice(0, i + 1)) ? Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0) : decodeURIComponent(b64).length;
};
export const rozmiarZasobu = (z) => (Number.isFinite(z?.rozmiar) ? z.rozmiar : (z?.dataUrl ? rozmiarZDataUrl(z.dataUrl) : null));

// Obraz projektu o dokładnie tej samej treści albo null. Starsze obrazy nie mają zapisanego skrótu –
// liczymy go tylko dla tych o tym samym rozmiarze pliku i zapamiętujemy w opisie.
export async function takiSam(p, blob, skrot) {
  for (const [id, z] of obrazyProjektu(p)) {
    if (z.skrot) { if (z.skrot === skrot) return id; continue; }
    const r = rozmiarZasobu(z);
    if (r !== null && r !== blob.size) continue;
    const plik = await blobZasobu(p, id).catch(() => null);
    if (!plik) continue;
    z.skrot = await skrotPliku(plik);
    if (z.skrot === skrot) return id;
  }
  return null;
}

// Obraz o tej samej nazwie (pełnej, z rozszerzeniem; bez względu na wielkość liter – tak dane szukają obrazów).
export function poNazwie(p, nazwa, bezId = null) {
  const n = pelnaNazwa(nazwa);
  return obrazyProjektu(p).find(([id, z]) => id !== bezId && pelnaNazwa(z.nazwa) === n)?.[0] || null;
}

// „zdjęcie.jpg” → „zdjęcie (2).jpg”, „zdjęcie (3).jpg”… – pierwsza nazwa, której w projekcie jeszcze nie ma.
export const wolnaNazwa = (p, nazwa) => wolnaNazwaWsrod(nazwa, (n) => Boolean(poNazwie(p, n)));

// Dodaje plik jako nowy obraz projektu. Zwraca id.
export async function dodajPlik(p, blob, nazwa, skrot = null) {
  const id = uid('z');
  p.zasoby[id] = { nazwa, dataUrl: await naDataUrl(blob), skrot: skrot || await skrotPliku(blob), ...await wymiaryPliku(blob) };
  // Kończy się miejsce na pliki aplikacji (#90) – ostrzeżenie najwyżej raz na 10 minut, bez czekania na nie.
  if (typeof window !== 'undefined') {
    Promise.all([import('./miejsce.js'), import('./ui.js')]).then(([m, ui]) => m.ostrzezPrzyWgrywaniu(ui.powiadom)).catch(() => {});
  }
  return id;
}

// Wymiary obrazu w pikselach z nagłówka pliku ({ szer, wys } albo {}) – łącznik AI wstawia obrazy według nich.
// Nagłówek JPEG bywa daleko (miniatura w EXIF), więc czytamy do 1 MB.
export async function wymiaryPliku(blob) {
  try {
    const w = wymiaryObrazu(new Uint8Array(await blob.slice(0, 1024 * 1024).arrayBuffer()));
    return w?.szer && w?.wys ? { szer: w.szer, wys: w.wys } : {};
  } catch { return {}; }
}

// Starsze obrazy bez zapisanych wymiarów: uzupełnia je z plików na tym urządzeniu. Zwraca liczbę uzupełnionych.
export async function uzupelnijWymiary(p) {
  let ile = 0;
  for (const [id, z] of obrazyProjektu(p)) {
    if (z.szer && z.wys) continue;
    const plik = await blobZasobu(p, id).catch(() => null);
    if (!plik) continue;
    const w = await wymiaryPliku(plik);
    if (w.szer && p.zasoby[id] === z) { Object.assign(z, w); ile += 1; }
  }
  return ile;
}

// Wspólne wejście każdego obrazu wstawianego na stronę (narzędzie, przeciągnięcie, Ctrl+V, „Podmień zdjęcie”):
// ten sam plik → obraz, który już jest; inny plik o zajętej nazwie → nazwa z dopiskiem „(2)”.
// Zwraca { id, nazwa, byl }: byl – plik już był w projekcie.
export async function przyjmijPlik(p, blob, nazwa) {
  const skrot = await skrotPliku(blob);
  const ten = await takiSam(p, blob, skrot);
  if (ten) return { id: ten, nazwa: p.zasoby[ten].nazwa, byl: true };
  const wolna = wolnaNazwa(p, nazwa || 'obraz.png');
  return { id: await dodajPlik(p, blob, wolna, skrot), nazwa: wolna, byl: false };
}

function* elementy(obiekty) {
  for (const o of obiekty || []) {
    yield o;
    if (Array.isArray(o.objects)) yield* elementy(o.objects);
  }
}

// Gdzie są użyte wszystkie obrazy – jedno przejście po stronach, wzorcach i tabelach (dla okna z wieloma
// obrazami i dużymi tabelami liczenie obraz po obrazie trwało zbyt długo). Map(id → { strony: [numer],
// wzorce: [nazwa], dane: [nazwa tabeli], pierwsze: { strona | wzorzec }, uzyty }).
export function uzyciaWszystkich(p) {
  const mapa = new Map();
  const daj = (id) => {
    if (!mapa.has(id)) mapa.set(id, { strony: [], wzorce: [], dane: [], pierwsze: null, uzyty: true });
    return mapa.get(id);
  };
  const zasobyW = (obiekty) => new Set([...elementy(obiekty)].map((o) => o.zasob).filter(Boolean));
  p.strony.forEach((s, i) => {
    for (const id of zasobyW(s.obiekty)) { const w = daj(id); w.strony.push(i + 1); w.pierwsze ||= { strona: s.id }; }
  });
  for (const wz of p.wzorce || []) {
    for (const id of zasobyW(wz.obiekty)) { const w = daj(id); w.wzorce.push(wz.nazwa); w.pierwsze ||= { wzorzec: wz.id }; }
  }
  // W danych: komórka, która według reguły z js/nazwy-obrazow.js wskazuje obraz; ta sama treść komórki – raz.
  const pomin = czcionki(p);
  const wskazuje = new Map();
  for (const t of p.tabele || []) {
    const ids = new Set();
    for (const wiersz of t.wiersze || []) {
      for (const k of wiersz || []) {
        const tekst = String(k ?? '');
        if (!tekst.trim()) continue;
        if (!wskazuje.has(tekst)) wskazuje.set(tekst, obrazZNazwy(p.zasoby, k, pomin)?.id ?? null);
        const id = wskazuje.get(tekst);
        if (id) ids.add(id);
      }
    }
    for (const id of ids) daj(id).dane.push(t.nazwa);
  }
  return mapa;
}

const NIEUZYWANY = () => ({ strony: [], wzorce: [], dane: [], pierwsze: null, uzyty: false });

// Gdzie obraz jest użyty: { strony: [numer], wzorce: [nazwa], dane: [nazwa tabeli], pierwsze: { strona | wzorzec } }.
// `wszystkie` – gotowy wynik uzyciaWszystkich(p), gdy pytamy o wiele obrazów naraz.
export function uzycia(p, id, wszystkie = null) {
  return (wszystkie || uzyciaWszystkich(p)).get(id) || NIEUZYWANY();
}

// Opis użycia dla człowieka: „strony 1, 3 · wzorzec „Tło” · w danych („Kalendarz”)” albo „nieużywany”.
export function opisUzycia(u) {
  const czesci = [];
  const lista = (t) => (t.length > 6 ? `${t.slice(0, 6).join(', ')}…` : t.join(', '));
  if (u.strony.length) czesci.push(`${u.strony.length === 1 ? 'strona' : 'strony'} ${lista(u.strony)}`);
  if (u.wzorce.length) czesci.push(`${u.wzorce.length === 1 ? 'wzorzec' : 'wzorce'} ${u.wzorce.map((n) => `„${n}”`).join(', ')}`);
  if (u.dane.length) czesci.push(`w danych (${u.dane.map((n) => `„${n}”`).join(', ')})`);
  return czesci.join(' · ') || 'nieużywany';
}

// Czy któryś krok historii cofania ma element z tym obrazem (cofnięcie przywróciłoby go bez pliku).
export function wHistorii(historia, id) {
  const znak = `"zasob":${JSON.stringify(id)}`;
  return (historia?.kroki || []).some((k) => ['strony', 'wzorce'].some((l) => [...(k[l]?.values() || [])].some((t) => t.includes(znak))));
}

// Przepina elementy stron i wzorców ze starego obrazu na nowy (w miejscu).
export function przepnij(p, stare, nowe) {
  const nazwa = p.zasoby?.[nowe]?.nazwa;
  let ile = 0;
  for (const c of [...(p.strony || []), ...(p.wzorce || [])]) {
    for (const o of elementy(c.obiekty)) {
      if (o.zasob !== stare) continue;
      o.zasob = nowe;
      if (typeof o.src === 'string' && o.src.startsWith('zasob:')) o.src = `zasob:${nowe}`; // zapis bez treści pliku (js/zlozenie.js)
      if (nazwa && o.type === 'image') o.nazwa = nazwa;
      ile += 1;
    }
  }
  return ile;
}

// Komórki tabel wskazujące obraz `id` (według reguły z js/nazwy-obrazow.js) dostają jego nową nazwę.
// Wołane przed zmianą nazwy w zasobach – wtedy jeszcze widać, które komórki wskazują ten obraz.
export function komorkiObrazu(p, id) {
  const pomin = czcionki(p);
  const wynik = [];
  for (const t of p.tabele || []) {
    (t.wiersze || []).forEach((w, r) => (w || []).forEach((k, c) => {
      if (String(k ?? '').trim() && obrazZNazwy(p.zasoby, k, pomin)?.id === id) wynik.push([t.id, r, c]);
    }));
  }
  return wynik;
}
export function przepiszDane(p, komorki, nowaNazwa) {
  for (const [idTabeli, r, c] of komorki) {
    const w = (p.tabele || []).find((t) => t.id === idTabeli)?.wiersze?.[r];
    if (w) w[c] = nowaNazwa;
  }
}

// Usuwa obraz z projektu: wpis znika, identyfikator trafia do nagrobków, plik znika z magazynu przeglądarki,
// a z konta – przez usunZKonta(sciezka) (bez czekania; brak sieci nie zatrzymuje usuwania).
export async function usunObraz(p, id, usunZKonta = null) {
  const z = p.zasoby?.[id];
  if (!z) return;
  delete p.zasoby[id];
  p.zasoby_usuniete = [...new Set([...(p.zasoby_usuniete || []), id])];
  try { await usunPlikZasobu(p, id); } catch { /* plik w magazynie zostaje tylko zajętym miejscem */ }
  if (z.sciezka && usunZKonta) Promise.resolve().then(() => usunZKonta(z.sciezka)).catch(() => {});
}

// Nowy identyfikator dla obrazu: plik `blob` (podmiana) albo ten sam plik pod nową nazwą. Zwraca nowe id.
// Przepięcie elementów i usunięcie starego obrazu robi wywołujący (przez zastosujWszedzie), bo zmienia
// strony – także w historii cofania.
export async function nowaWersja(p, id, { blob = null, nazwa = null } = {}) {
  const z = p.zasoby[id];
  const noweId = uid('z');
  if (blob) {
    p.zasoby[noweId] = { nazwa: nazwa || z.nazwa, dataUrl: await naDataUrl(blob), skrot: await skrotPliku(blob), ...await wymiaryPliku(blob) };
  } else {
    const dataUrl = await dataUrlZasobu(p, id);
    if (!dataUrl) throw new Error('Nie ma pliku tego obrazu na tym urządzeniu.');
    p.zasoby[noweId] = { nazwa: nazwa || z.nazwa, dataUrl, ...(z.skrot ? { skrot: z.skrot } : {}), ...(z.szer && z.wys ? { szer: z.szer, wys: z.wys } : {}) };
  }
  return noweId;
}

// ---------- Porządkowanie starszych projektów ----------
//
// Zanim było okno „Obrazy projektu”, każde wstawienie obrazu dodawało nowy plik – nawet ten sam – a wgranie
// pliku o zajętej nazwie dawało dwa obrazy o tej samej nazwie. Tu je znajdujemy i porządkujemy.

// { kopie: [[zostaje, [kopia…]]], nazwy: [[zostaje, [inny…]]] }.
// Kopie: ta sama treść (skrót liczony tylko dla plików o tym samym rozmiarze). Nazwy: ta sama pełna nazwa,
// inna treść. Zostaje obraz, który dane wskazują tą nazwą dziś (żeby strony z danych się nie zmieniły).
export async function powtorzenia(p) {
  const pomin = czcionki(p);
  const obrazy = obrazyProjektu(p);
  const poRozmiarze = new Map();
  for (const [id, z] of obrazy) {
    const r = z.skrot ? `s:${z.skrot}` : `r:${rozmiarZasobu(z)}`;
    poRozmiarze.set(r, [...(poRozmiarze.get(r) || []), id]);
  }
  // Skrót liczymy tylko tam, gdzie mogą być kopie: ten sam rozmiar, a skrótu jeszcze nie ma.
  for (const [klucz, ids] of poRozmiarze) {
    if (ids.length < 2 || klucz.startsWith('s:') || klucz === 'r:null') continue;
    for (const id of ids) {
      if (p.zasoby[id].skrot) continue;
      const plik = await blobZasobu(p, id).catch(() => null);
      if (plik) p.zasoby[id].skrot = await skrotPliku(plik);
    }
  }
  // Grupowanie – wspólne z łącznikiem AI (js/obrazy-wspolne.js). Zostaje obraz, który dane dziś wskazują
  // swoją nazwą; inaczej pierwszy w kolejności zasobów (tak szukały dane).
  return grupujPowtorzenia(obrazyProjektu(p), Object.keys(p.zasoby), (id) => obrazZNazwy(p.zasoby, p.zasoby[id].nazwa, pomin)?.id === id);
}
