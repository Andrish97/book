// Makieta 3D (#131D, #153): jak projekt będzie wyglądał po wydrukowaniu – książka (miękka i twarda oprawa),
// notes na spirali, kalendarz ścienny i biurkowy, pojedyncza kartka. Bez bibliotek z CDN: geometria liczona
// tutaj (czyste funkcje – testy), rysowanie przez własny lekki WebGL (utworzRenderer) z prawdziwym buforem
// głębokości, cieniowaniem zależnym od normalnych, cieniem rzucanym (mapa cieni) i miękkim cieniem
// kontaktowym na stole albo ścianie. Okno: js/app/makieta-okno.js.
//
// Model to lista kartek: { przod, tyl, w, h, d, kolor, okladka } – przod/tyl to klucze tekstur (np. „p:3” –
// strona numer 3 w kolejności druku, „okl:przod” – przód okładki) albo null (biały papier). Wymiary w mm,
// zawsze rzeczywiste (format strony, okładka ze swoich stref) – tekstura leży na kartce bez rozciągania.
// Położenie w kartkowaniu to liczba u: całkowita – tyle kartek przewróconych; ułamkowa – kartka floor(u)
// jest w trakcie przewracania (s = u − floor(u)).
//
// Świat: oś Y w górę. Książka, notes i kartka leżą na stole (płaszczyzna y = 0), kalendarz ścienny wisi
// na ścianie (płaszczyzna z = const), biurkowy stoi na biurku (y = 0). scena() zwraca listę czworokątów
// { p: [4 punkty], uv: [4], tex, n, nv?: [4 normalne], ao?: [4], mat } i opis podłoża (quady.podloze).

import { normalizujOpcje, DOMYSLNE_OPCJE, DRUT, TEKTURA } from './makieta-ustawienia.js';
import { normalizujCzesc, scianyCzesci, naStronieZapisanej, poleWielokata, wWielokacie, naObwodzie, rogiPola, liniaProsta } from './skladanka.js';

export { normalizujOpcje, DOMYSLNE_OPCJE };

export const MODELE = {
  ksiazka_miekka: 'Książka – miękka oprawa',
  ksiazka_twarda: 'Książka – twarda oprawa',
  notes: 'Notes na spirali',
  kalendarz_scienny: 'Kalendarz ścienny',
  kalendarz_biurkowy: 'Kalendarz biurkowy',
  kartka: 'Pojedyncza kartka',
  // Makiety sekcji specjalnych (#181) – tylko gdy projekt ma taką sekcję (okno pokazuje pasujące modele).
  ulotka: 'Ulotka składana',
  koperta: 'Koperta',
  pudelko: 'Pudełko z wykrojnika',
  trojdzielny: 'Kalendarz trójdzielny',
  skladanka: 'Składanka (model z części)',
};
// Modele z jednej sekcji specjalnej (rodzaj → model): ich kartki to strony tej sekcji, geometria z jej wyniku.
export const MODELE_SPECJALNE = ['ulotka', 'koperta', 'pudelko', 'trojdzielny', 'skladanka'];
export const jestSpecjalnyModel = (model) => MODELE_SPECJALNE.includes(model);

const PAPIER = '#fbfaf7';
const KRAWEDZ_OKLADKI = '#e8e4dc';
const KRAFT = '#cdbd9f'; // papier podklejki grzbietu twardej oprawy (wnętrze skorupy grzbietu, #179)
const OKLEINA = '#2b2f3a'; // okleina twardej oprawy, gdy projekt nie ma sekcji okładki
const OTWOR = '#6b675f';
const KARTON = '#eeeae1'; // wnętrze koperty i pudełka (strona bez druku)
const RAMKA_OKIENKA = '#c4161c';
export const KRAWEDZ_KARTEK = 'tex:krawedz';
export const SKLADKI = 'tex:skladki';
export const KAPITALKI = 'tex:kapitalka';

// ---------- Kartki modelu ----------

// Strony do makiety (#161): format bloku to najczęstszy format stron (nie pierwszej – bywa nią wyklejka A4
// poziomo i cały blok robił się szeroki, a okładka rozciągnięta). Strona dwa razy szersza od bloku (wyklejka,
// rozkładówka na jednym arkuszu) dzieli się na lewą i prawą połowę. rozmiary: [{ w, h, pusta? }] w kolejności
// druku. Zwraca { format, wpisy: [{ zrodlo, polowa: null | 'L' | 'R', w, h }] }.
export function ukladStron(rozmiary) {
  const ile = new Map();
  for (const r of rozmiary) {
    if (r.pusta) continue;
    const k = `${Math.round(r.w * 2) / 2}x${Math.round(r.h * 2) / 2}`;
    ile.set(k, (ile.get(k) || 0) + 1);
  }
  let format = rozmiary[0] ? { w: rozmiary[0].w, h: rozmiary[0].h } : { w: 148, h: 210 };
  let max = 0;
  for (const [k, n] of ile) if (n > max) { max = n; const [w, h] = k.split('x').map(Number); format = { w, h }; }
  const podwojna = (r) => Math.abs(r.w - 2 * format.w) <= 0.12 * format.w && Math.abs(r.h - format.h) <= 0.12 * format.h;
  const wpisy = [];
  rozmiary.forEach((r, zrodlo) => {
    if (podwojna(r)) {
      wpisy.push({ zrodlo, polowa: 'L', w: r.w / 2, h: r.h, pusta: r.pusta });
      wpisy.push({ zrodlo, polowa: 'R', w: r.w / 2, h: r.h, pusta: r.pusta });
    } else wpisy.push({ zrodlo, polowa: null, w: r.w, h: r.h, pusta: r.pusta });
  });
  return { format, wpisy };
}

// strony: liczba stron środka (w kolejności druku), format: { w, h } (mm), rozmiary: [{ w, h }] – rozmiar
// każdej strony (gdy sekcje mają różne formaty), okladka: { w, h, tektura } | null, kartka_mm: grubość kartki.
// wnetrze: { przod: bool, tyl: bool } – pierwsza / ostatnia strona (połowa wyklejki) jest przyklejona do wnętrza
// przedniej / tylnej okładki, a nie osobną kartką (#161).
// specjalna (#181): parametry sekcji specjalnej z jej wynikiem ({ ...parametry, wynik }) – ulotka, koperta, pudełko,
// kalendarz trójdzielny: jedna „kartka” wielkości arkusza (przód – strona 0, tył – strona 1, jeśli jest).
// obwoluta (#181): { skrzydelko_mm } – twarda okładka dostaje skrzydełka obwoluty po wewnętrznej stronie.
export function kartkiModelu(model, { strony, format, okladka = null, kartka_mm = 0.1, rozmiary = null, wnetrze = null, specjalna = null, obwoluta = null }) {
  const d = Math.max(0.06, kartka_mm || 0.1);
  const wym = (i) => rozmiary?.[i] || format;
  const kartki = [];
  if (jestSpecjalnyModel(model)) {
    const wynik = specjalna?.wynik;
    if (!wynik) return kartki;
    // Składanka (#238): każda strona sekcji to arkusz z częściami (specjalna.czesci – z położeniem na arkuszu).
    if (model === 'skladanka') {
      for (let i = 0; i < strony; i += 1) kartki.push({ przod: `p:${i}`, tyl: null, w: wynik.szerokosc, h: wynik.wysokosc, d: Math.max(0.1, specjalna.grubosc_mm || 0.3), kolor: PAPIER, specjalna });
      return kartki;
    }
    const gr = model === 'pudelko' ? 0.45 : model === 'trojdzielny' ? 1.2 : model === 'koperta' ? 0.12 : 0.15;
    kartki.push({ przod: strony > 0 ? 'p:0' : null, tyl: strony > 1 ? 'p:1' : null, w: wynik.szerokosc, h: wynik.wysokosc, d: gr, kolor: PAPIER, specjalna });
    return kartki;
  }
  if (model === 'kalendarz_scienny' || model === 'kalendarz_biurkowy') {
    for (let i = 0; i < strony; i += 1) kartki.push({ przod: `p:${i}`, tyl: null, ...wymiar(wym(i)), d: Math.max(d, 0.18), kolor: PAPIER });
    return kartki;
  }
  if (model === 'kartka') {
    for (let i = 0; i < strony; i += 2) kartki.push({ przod: `p:${i}`, tyl: i + 1 < strony ? `p:${i + 1}` : null, ...wymiar(wym(i)), d: Math.max(d, 0.25), kolor: PAPIER });
    return kartki;
  }
  const twarda = model === 'ksiazka_twarda';
  const notes = model === 'notes';
  // Blok w formacie projektu (najczęstszy format stron), nie pierwszej strony.
  const { w, h } = wymiar(format || wym(0));
  const dOkl = twarda ? Math.max(1.5, okladka?.tektura || 2.5) : notes ? 0.6 : 0.3;
  // Twarda: tektura wystaje 3 mm poza środek z trzech stron. Miękka: okładka w rozmiarze środka.
  // Wymiary z geometrii okładki tylko, gdy pasują do bloku (#161: okładka liczona dla innego formatu – np.
  // wyklejki A4 – nie rozciąga książki; tekstura przodu leży wtedy na okładce w rozmiarze bloku).
  const pasuje = (v, wzor) => v && Math.abs(v - wzor) < 10;
  // Miękka i notes (#179): okładka przycięta razem z blokiem – dokładnie w jego rozmiarze (także gdy sekcja
  // okładki projektu jest twarda i ma większe panele).
  const wOkl = twarda ? (pasuje(okladka?.w, w + 3) ? Math.max(w + 3, okladka.w) : w + 3) : w;
  const hOkl = twarda ? (pasuje(okladka?.h, h + 6) ? Math.max(h + 6, okladka.h) : h + 6) : h;
  const zOkladka = Boolean(okladka) || twarda || notes;
  const wPrzod = zOkladka && wnetrze?.przod && strony > 0;
  const wTyl = zOkladka && wnetrze?.tyl && strony > (wPrzod ? 1 : 0);
  // Twarda (#179): wnętrze tektury – okleina zawinięta z zewnątrz, na niej połowa wyklejki (pastedown) wielkości
  // strony bloku, 3 mm od krawędzi tektury; wyklejka: 'A' – na stronie przodu, 'B' – tyłu kartki okładki.
  const okleina = okladka ? 'okl:okleina' : `kolor:${OKLEINA}`;
  const wklejka = (strona) => (twarda ? { wyklejka: strona, okleina, wBloku: w, hBloku: h } : {});
  // Obwoluta (#181): skrzydełka zawinięte na wewnętrzną stronę tektury (przód – strona B, tył – A).
  const skrz = (czesc, strona) => (twarda && obwoluta?.skrzydelko_mm > 0 ? { skrzydelko: { tex: `obw:${czesc}`, w: Math.min(obwoluta.skrzydelko_mm, wOkl - 4), strona } } : {});
  const naOkl = twarda && obwoluta ? 'obw' : 'okl'; // obwoluta zakrywa przód, grzbiet i tył okładki
  const zObw = Boolean(okladka) || naOkl === 'obw';
  if (zOkladka) kartki.push({ przod: zObw ? `${naOkl}:przod` : (strony && !wPrzod ? 'p:0' : null), tyl: wPrzod ? 'p:0' : null, w: wOkl, h: hOkl, d: dOkl, kolor: KRAWEDZ_OKLADKI, okladka: true, ...(wPrzod ? wklejka('B') : {}), ...skrz('skrzydelko_p', -1) });
  // Bez sekcji okładki pierwsza strona jest okładką (miękka): środek zaczyna się od niej.
  const od = (zOkladka && !zObw && strony) || wPrzod ? 1 : 0;
  const ile = wTyl ? strony - 1 : strony;
  for (let i = od; i < ile; i += 2) kartki.push({ przod: `p:${i}`, tyl: i + 1 < ile ? `p:${i + 1}` : null, w, h, d, kolor: PAPIER });
  if (zOkladka) kartki.push({ przod: wTyl ? `p:${strony - 1}` : null, tyl: zObw ? `${naOkl}:tyl` : null, w: wOkl, h: hOkl, d: dOkl, kolor: KRAWEDZ_OKLADKI, okladka: true, ...(wTyl ? wklejka('A') : {}), ...skrz('skrzydelko_l', 1) });
  return kartki;
}
const wymiar = (r) => ({ w: Math.max(10, r.w), h: Math.max(10, r.h) });

// Ile położeń kartkowania ma model (u od 0 do tej liczby).
// Ulotka: złożona → rozłożona (środek) → odwrócona (zewnątrz); koperta: przód → tył → otwarta klapa;
// pudełko: wykrojnik płasko → złożone; trójdzielny – jedno położenie.
const POLOZENIA_SPECJALNE = { ulotka: 2, koperta: 2, pudelko: 1, trojdzielny: 0, skladanka: 2 };
export const polozenia = (model, kartki) => {
  if (jestSpecjalnyModel(model)) return kartki.length ? POLOZENIA_SPECJALNE[model] : 0;
  return model === 'kartka' ? Math.max(1, kartki.length * 2 - 1) : kartki.length;
};

// Opis położenia dla człowieka – „Okładka”, „Strony 2–3”, „Strona 5 z 13”…
// numer(i) – numer strony p:i w projekcie (null: strona bez numeru, np. połowa wyklejki); domyślnie i + 1.
export function opisPolozenia(model, kartki, u, numer = (i) => i + 1) {
  const t = Math.round(u);
  const nr = (klucz) => (klucz?.startsWith('p:') ? numer(Number(klucz.slice(2))) : null);
  if (model === 'ulotka') return t === 0 ? 'Złożona' : t === 1 ? 'Rozłożona – środek' : 'Rozłożona – zewnątrz';
  if (model === 'koperta') return ['Przód koperty', 'Tył – klapa zamknięta', 'Tył – klapa otwarta'][Math.min(2, t)];
  if (model === 'pudelko') return t === 0 ? 'Wykrojnik (płasko)' : 'Pudełko złożone';
  if (model === 'trojdzielny') return 'Kalendarz trójdzielny';
  if (model === 'skladanka') return t === 0 ? 'Arkusze (płasko)' : t === 1 ? 'Złożone części' : 'Sklejony model';
  if (model === 'kartka') {
    const k = kartki[Math.floor(t / 2)];
    const klucz = t % 2 ? k?.tyl : k?.przod;
    if (!klucz) return 'Tył kartki (pusty)';
    return nr(klucz) ? `Strona ${nr(klucz)}` : 'Wyklejka';
  }
  if (model.startsWith('kalendarz')) return `Karta ${Math.min(t + 1, kartki.length)} z ${kartki.length}`;
  if (t === 0) return 'Okładka';
  if (t >= kartki.length) return 'Tył okładki';
  const lewa = nr(kartki[t - 1].tyl);
  const prawa = nr(kartki[t].przod);
  if (lewa && prawa) return `Strony ${lewa}–${prawa}`;
  return lewa || prawa ? `Strona ${lewa || prawa}` : 'Wyklejka';
}

// ---------- Narzędzia geometrii ----------

const lerp = (a, b, s) => a + (b - a) * s;
const gladko = (s) => s * s * (3 - 2 * s);
const ogr = (v, a, b) => Math.min(b, Math.max(a, v));
const dod = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const odj = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const razy = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const wekt = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Czworokąt z normalnymi w wierzchołkach (albo jedną dla całości).
function quad(quady, p, uv, tex, mat, { nv = null, ao = null, n = null, ...reszta } = {}) {
  const nn = n || (nv ? norm(dod(dod(nv[0], nv[1]), dod(nv[2], nv[3]))) : norm(wekt(odj(p[1], p[0]), odj(p[3], p[0]))));
  quady.push({ p, uv, tex, n: nn, nv: nv || [nn, nn, nn, nn], ao: ao || [1, 1, 1, 1], mat, ...reszta });
}

// Siatka powierzchni: f(i, j) → { p, n, uv, ao } dla i = 0..nu, j = 0..nv.
function siatka(quady, nu, nv, f, tex, mat, opcje = {}) {
  const pkt = [];
  for (let i = 0; i <= nu; i += 1) { pkt.push([]); for (let j = 0; j <= nv; j += 1) pkt[i].push(f(i, j)); }
  for (let i = 0; i < nu; i += 1) for (let j = 0; j < nv; j += 1) {
    const v = [pkt[i][j], pkt[i + 1][j], pkt[i + 1][j + 1], pkt[i][j + 1]];
    quad(quady, v.map((x) => x.p), v.map((x) => x.uv), tex, mat, { nv: v.map((x) => x.n), ao: v.map((x) => x.ao ?? 1), ...opcje });
  }
}

// Rura (drut) wzdłuż łamanej punktów – spirala, wieszak.
function rura(quady, punkty, r, mat = 'drut', tex = `kolor:${DRUT}`, zamknieta = false) {
  const n = punkty.length;
  const styczna = (i) => {
    const a = punkty[zamknieta ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = punkty[zamknieta ? (i + 1) % n : Math.min(n - 1, i + 1)];
    return norm(odj(b, a));
  };
  // Ramki przesuwane równolegle wzdłuż rury (#161) – bez skręcania drutu w zygzak.
  let pom = [0, 0, 1];
  { const t0 = styczna(0); if (Math.abs(t0[0] * pom[0] + t0[1] * pom[1] + t0[2] * pom[2]) > 0.9) pom = [1, 0, 0]; }
  const ramki = punkty.map((_, i) => {
    const t = styczna(i);
    const dt = t[0] * pom[0] + t[1] * pom[1] + t[2] * pom[2];
    const b1 = norm(odj(pom, razy(t, dt)));
    const b2 = wekt(t, b1);
    pom = b1;
    return [b1, b2];
  });
  const K = 8;
  const ile = zamknieta ? n : n - 1;
  for (let i = 0; i < ile; i += 1) {
    const i2 = (i + 1) % n;
    for (let k = 0; k < K; k += 1) {
      const a0 = (k / K) * 2 * Math.PI;
      const a1 = ((k + 1) / K) * 2 * Math.PI;
      const kier = (ii, a) => norm(dod(razy(ramki[ii][0], Math.cos(a)), razy(ramki[ii][1], Math.sin(a))));
      const nv = [kier(i, a0), kier(i2, a0), kier(i2, a1), kier(i, a1)];
      const p = [dod(punkty[i], razy(nv[0], r)), dod(punkty[i2], razy(nv[1], r)), dod(punkty[i2], razy(nv[2], r)), dod(punkty[i], razy(nv[3], r))];
      quad(quady, p, [[0, 0], [1, 0], [1, 1], [0, 1]], tex, mat, { nv });
    }
  }
}

// Stałe części sceny (spirala) – liczone raz dla danych wymiarów (kartkowanie ich nie zmienia).
const pamiec = new Map();
function zPamieci(klucz, f) {
  if (!pamiec.has(klucz)) { if (pamiec.size > 24) pamiec.clear(); pamiec.set(klucz, f()); }
  return pamiec.get(klucz);
}

// Odwzorowanie z układu kartki do świata: punkt i normalna.
const naStol = ([x, y, z]) => [x, z, -y]; // książka, notes, kartka: leżą na stole, góra strony od widza

// ---------- Arkusz (kartka albo okładka) wzdłuż krzywej ----------
// Linia środkowa w płaszczyźnie (x, z) układu kartki: punkty c[i] = [x, z] i kąty kierunku fi[i]
// (0 – w prawo, π/2 – w górę), długość łuku sigma[i]. Kartka ma grubość d i rozciąga się w y od −h/2 do h/2.
// Strona „+n” (normalna (−sin fi, cos fi)) ma teksturę texA z u = uA(sigma), druga – texB z u = uB(sigma).
function arkusz(quady, krzywa, h, d, { texA, texB, uA, uB, mat, krawedz, matKrawedzi, aoA, aoB, T = naStol, krawedzieUv = null, bezKrawedzi = false, odY = -h / 2, doY = h / 2, vOdwrotnie = false }) {
  const { c, fi, sigma } = krzywa;
  const n = c.length - 1;
  const nv = 2;
  const pkt = (i, y, strona) => {
    const nn = [-Math.sin(fi[i]), Math.cos(fi[i])];
    const o = (strona * d) / 2;
    return T([c[i][0] + nn[0] * o, y, c[i][1] + nn[1] * o]);
  };
  const nrm = (i, strona) => T([-Math.sin(fi[i]) * strona, 0, Math.cos(fi[i]) * strona]);
  const ys = (j) => lerp(doY, odY, j / nv);
  const v = (y) => (vOdwrotnie ? (y + h / 2) / h : (h / 2 - y) / h);
  siatka(quady, n, nv, (i, j) => ({ p: pkt(i, ys(j), 1), n: nrm(i, 1), uv: [uA(sigma[i]), v(ys(j))], ao: aoA ? aoA(sigma[i]) : 1 }), texA, mat);
  siatka(quady, n, nv, (i, j) => ({ p: pkt(i, ys(nv - j), -1), n: nrm(i, -1), uv: [uB(sigma[i]), v(ys(nv - j))], ao: aoB ? aoB(sigma[i]) : 1 }), texB, mat);
  if (bezKrawedzi || d < 0.05) return;
  // Krawędzie: przednia (koniec krzywej), głowa i stopa (y = ±h/2). Na okładce kolor brzegu okładki
  // (tekstura przy krawędzi), na kartce – papier.
  const kt = krawedz || `kolor:${PAPIER}`;
  const mk = matKrawedzi || mat;
  const uvK = (i, gora) => (krawedzieUv ? krawedzieUv(sigma[i], gora) : [0.5, 0.5]);
  {
    const i = n;
    const t = T([Math.cos(fi[i]), 0, Math.sin(fi[i])]);
    quad(quady, [pkt(i, doY, 1), pkt(i, doY, -1), pkt(i, odY, -1), pkt(i, odY, 1)], [uvK(i, 0), uvK(i, 0), uvK(i, 1), uvK(i, 1)], kt, mk, { n: t });
  }
  for (const [y, sg] of [[doY, 1], [odY, -1]]) {
    for (let i = 0; i < n; i += 1) {
      const nn = T([0, sg, 0]);
      const u0 = uvK(i, sg > 0 ? 0 : 1);
      const u1 = uvK(i + 1, sg > 0 ? 0 : 1);
      quad(quady, [pkt(i, y, 1), pkt(i + 1, y, 1), pkt(i + 1, y, -1), pkt(i, y, -1)], [u0, u1, u1, u0], kt, mk, { n: nn });
    }
  }
}

// Krzywa z funkcji kąta: start [x, z], długość L, kąt fi(t) dla t = 0..1 (t – część długości).
function krzywaZKata(start, L, kat, kroki = 28) {
  const c = [start];
  const fi = [kat(0)];
  const sigma = [0];
  for (let i = 1; i <= kroki; i += 1) {
    const t0 = (i - 1) / kroki;
    const t1 = i / kroki;
    const a = kat((t0 + t1) / 2);
    const ds = L / kroki;
    const p = c[i - 1];
    c.push([p[0] + Math.cos(a) * ds, p[1] + Math.sin(a) * ds]);
    fi.push(kat(t1));
    sigma.push(t1 * L);
  }
  return { c, fi, sigma };
}

// ---------- Książka i notes ----------

// Blok kartek leżący na stole po jednej stronie grzbietu (strona = 1 prawa, −1 lewa): dno z = z0, wierzch z(x)
// z funkcji profilu, x od 0 do w (odbite dla lewej). Wierzch ma teksturę wierzchniej strony, boki – krawędzie
// kartek, spód – spodnią stronę (widoczną tylko od dołu).
// o – przesunięcie od osi grzbietu (#161); zaokraglenie – wypukły grzbiet bloku szytego (twarda oprawa):
// widać składki od głowy i stopy, kapitałkę i nici w szczelinie pod grzbietem okładki.
// oGora (#199.3): wierzch bloku przesunięty względem spodu (spód przy zawiasie tektury, wierzch w zgięciu) – blok
// otwartej książki pochyla się ku zgięciu; każda kartka ma swoją szerokość, przednia krawędź lekko skośna.
function blok(quady, { strona, w, h, z0, wierzch, texWierzch, texSpod, aoX, grzbietowa = false, o = 0, zaokraglenie = 0, oGora = o }) {
  const N = 34;
  const xs = (i) => w * (i / N) ** 1.35; // gęściej przy grzbiecie, gdzie kartki się wyginają
  const X = (x) => (x + o) * strona;
  // Punkt na wysokości z: przesunięcie od o (spód) do oGora (wierzch w tym miejscu, zw).
  const XZ = (x, z, zw = wierzch(x)) => (x + lerp(o, oGora, zw - z0 > 0.01 ? ogr((z - z0) / (zw - z0), 0, 1) : 1)) * strona;
  const uWierzch = (x) => (strona > 0 ? x / w : 1 - x / w);
  const nachyl = (x) => { const e = Math.max(0.05, w / 400); return (wierzch(Math.min(w, x + e)) - wierzch(Math.max(0, x - e))) / (Math.min(w, x + e) - Math.max(0, x - e)); };
  const v = (y) => (h / 2 - y) / h;
  // Wierzch – wierzchnia strona.
  siatka(quady, N, 3, (i, j) => {
    const x = xs(i);
    const y = lerp(h / 2, -h / 2, j / 3);
    const k = nachyl(x) * strona;
    return { p: naStol([XZ(x, wierzch(x)), y, wierzch(x)]), n: naStol(norm([-k, 0, 1])), uv: [uWierzch(x), v(y)], ao: aoX ? aoX(x) : 1 };
  }, texWierzch || `kolor:${PAPIER}`, 'papier');
  // Spód (płaski) – widoczny tylko od dołu.
  const uS = (x) => (strona > 0 ? 1 - x / w : x / w);
  quad(quady, [naStol([X(0), -h / 2, z0]), naStol([X(w), -h / 2, z0]), naStol([X(w), h / 2, z0]), naStol([X(0), h / 2, z0])],
    [[uS(0), 1], [uS(w), 1], [uS(w), 0], [uS(0), 0]], texSpod || `kolor:${PAPIER}`, 'papier', { n: [0, -1, 0] });
  // Krawędzie kartek: przednia (x = w) i głowa/stopa (y = ±h/2) – tekstura z liniami (jedna linia na kartkę).
  const vk = (z) => (z - z0) / 128; // jeden wiersz tekstury ≈ 0,5 mm (#161: bez mory)
  const zt = wierzch(w);
  quad(quady, [naStol([XZ(w, zt), h / 2, zt]), naStol([X(w), h / 2, z0]), naStol([X(w), -h / 2, z0]), naStol([XZ(w, zt), -h / 2, zt])],
    [[0, vk(zt)], [0, vk(z0)], [h / 40, vk(z0)], [h / 40, vk(zt)]], KRAWEDZ_KARTEK, 'krawedz', { n: naStol([strona, 0, 0]) });
  for (const [y, sg] of [[h / 2, 1], [-h / 2, -1]]) {
    for (let i = 0; i < N; i += 1) {
      const xa = xs(i);
      const xb = xs(i + 1);
      quad(quady, [naStol([XZ(xa, wierzch(xa)), y, wierzch(xa)]), naStol([XZ(xb, wierzch(xb)), y, wierzch(xb)]), naStol([X(xb), y, z0]), naStol([X(xa), y, z0])],
        [[xa / 40, vk(wierzch(xa))], [xb / 40, vk(wierzch(xb))], [xb / 40, vk(z0)], [xa / 40, vk(z0)]], KRAWEDZ_KARTEK, 'krawedz', { n: naStol([0, sg, 0]) });
    }
  }
  const z1 = wierzch(0);
  if (z1 - z0 <= 0.05) return;
  if (zaokraglenie > 0.05) {
    // Wypukły grzbiet bloku: łuk x(z) = −b·sin(π t). Powierzchnia – składki (pasy wzdłuż grzbietu z nićmi),
    // od głowy i stopy – wycinki z krawędziami kartek (łuki składek), przy brzegach – kapitałka.
    const M = 12;
    const b = zaokraglenie;
    const luk = (i) => { const t = i / M; return { x: -b * Math.sin(Math.PI * t), z: lerp(z0, z1, t), nx: -Math.sin(Math.PI * t) * 0.9 - 0.1, nz: -Math.cos(Math.PI * t) * 0.9 }; };
    siatka(quady, M, 4, (i, j) => {
      const l = luk(i);
      const y = lerp(h / 2, -h / 2, j / 4);
      return { p: naStol([X(l.x), y, l.z]), n: naStol(norm([l.nx * strona, 0, l.nz])), uv: [(l.z - z0) / 6.4, (h / 2 - y) / 24], ao: 0.82 };
    }, SKLADKI, 'krawedz');
    for (const [y, sg] of [[h / 2, 1], [-h / 2, -1]]) {
      for (let i = 0; i < M; i += 1) {
        const a = luk(i);
        const c = luk(i + 1);
        quad(quady, [naStol([X(0), y, a.z]), naStol([X(a.x), y, a.z]), naStol([X(c.x), y, c.z]), naStol([X(0), y, c.z])],
          [[0, vk(a.z)], [a.x / 40, vk(a.z)], [c.x / 40, vk(c.z)], [0, vk(c.z)]], KRAWEDZ_KARTEK, 'krawedz', { n: naStol([0, sg, 0]) });
      }
      // Kapitałka: wałek w paski wzdłuż łuku grzbietu, lekko wystający nad krawędź kartek.
      const pk = [];
      for (let i = 0; i <= 2 * M; i += 1) {
        const t = i / (2 * M);
        pk.push(naStol([X(-b * Math.sin(Math.PI * t) + 0.35 * Math.sin(Math.PI * t)), y + sg * 0.25, lerp(z0 + 0.4, z1 - 0.4, t)]));
      }
      rura(quady, pk, 0.55, 'papier', KAPITALKI);
    }
    return;
  }
  // Klejony grzbiet bloku (płaski) – widać go, gdy obok leży tylko okładka.
  if (grzbietowa) {
    quad(quady, [naStol([XZ(0, z1), -h / 2, z1]), naStol([X(0), -h / 2, z0]), naStol([X(0), h / 2, z0]), naStol([XZ(0, z1), h / 2, z1])],
      [[0, vk(z1)], [0, vk(z0)], [h / 40, vk(z0)], [h / 40, vk(z1)]], KRAWEDZ_KARTEK, 'krawedz', { n: naStol([-strona, 0, 0]) });
  }
}

// Arkusz kartki albo okładki na krzywej, z teksturami przodu i tyłu jak w książce: przód z u = σ/L, tył
// z u = 1 − σ/L (σ – odległość od grzbietu). Okładka ma brzegi w kolorze swojej krawędzi.
function lisc(quady, kar, krzywa, mat) {
  const L = kar.w;
  // Brzeg okładki w kolorze jej zewnętrznej strony (wnętrze bywa wyklejką – #161).
  const zewn = [kar.przod, kar.tyl].find((k) => k?.startsWith('okl:') || k?.startsWith('obw:'));
  const brzeg = zewn || kar.przod || kar.tyl;
  const okl = kar.okladka && brzeg;
  const brzegPrzod = brzeg === kar.przod;
  // Twarda oprawa: rowek przy grzbiecie (zawias) – lekki cień 7–8 mm od krawędzi.
  const rowek = mat === 'twarda' ? (sg) => 1 - 0.3 * Math.exp(-(((sg - 7.5) / 1.4) ** 2)) : null;
  // Twarda z wyklejką (#179): strona tektury od środka książki ma kolor okleiny (zawinięcie), a wyklejka leży
  // na niej osobnym, cienkim arkuszem papieru.
  const wA = kar.wyklejka === 'A';
  const wB = kar.wyklejka === 'B';
  arkusz(quady, krzywa, kar.h, kar.d, {
    aoA: rowek, aoB: rowek,
    texA: wA ? kar.okleina : (kar.przod || `kolor:${PAPIER}`), texB: wB ? kar.okleina : (kar.tyl || `kolor:${PAPIER}`),
    uA: (sg) => sg / L, uB: (sg) => 1 - sg / L, mat,
    krawedz: okl ? brzeg : `kolor:${kar.okladka ? KRAWEDZ_OKLADKI : PAPIER}`,
    krawedzieUv: okl ? (sg, g) => [ogr(brzegPrzod ? sg / L : 1 - sg / L, 0.004, 0.996), g ? 0.996 : 0.004] : null,
  });
  if (wA || wB) wyklejkaNaTekturze(quady, kar, krzywa, wA ? 1 : -1);
  if (kar.skrzydelko) skrzydelkoObwoluty(quady, kar, krzywa);
}

// Punkt na prostej krzywej tektury (długość sg), przesunięty o o po normalnej: [x, z, kąt].
function naTekturze(krzywa, sg, o) {
  const { c, fi } = krzywa;
  const n = c.length - 1;
  const L = krzywa.sigma[n];
  const t = Math.min(1, Math.max(0, sg / L));
  const i = Math.min(n - 1, Math.floor(t * n));
  const f = fi[i];
  const x = lerp(c[i][0], c[i + 1][0], t * n - i);
  const z = lerp(c[i][1], c[i + 1][1], t * n - i);
  return [x - Math.sin(f) * o, z + Math.cos(f) * o, f];
}

// Skrzydełko obwoluty (#181): pas papieru od przedniej krawędzi tektury do środka, po wewnętrznej stronie (na
// wyklejce), z zawinięciem wokół krawędzi. Czytane jak wydrukowane: przód – od przedniej krawędzi w stronę
// grzbietu, tył – od grzbietu w stronę krawędzi.
function skrzydelkoObwoluty(quady, kar, krzywa) {
  const { tex, w: s, strona } = kar.skrzydelko;
  const L = krzywa.sigma.at(-1);
  const o = strona * (kar.d / 2 + 0.1);
  const h = kar.h - 0.6;
  const N = 6;
  siatka(quady, N, 2, (i, j) => {
    const sg = L - s + (s * i) / N;
    const [x, z, f] = naTekturze(krzywa, sg, o);
    const y = lerp(h / 2, -h / 2, j / 2);
    const u = strona < 0 ? (L - sg) / s : (sg - (L - s)) / s;
    return { p: naStol([x, y, z]), n: naStol([-Math.sin(f) * strona, 0, Math.cos(f) * strona]), uv: [u, (h / 2 - y) / h], ao: 1 - 0.18 * Math.exp(-(sg - (L - s)) / 2) };
  }, tex, 'papier');
  // Zawinięcie wokół przedniej krawędzi tektury (półwalec z papieru obwoluty).
  const [x1, z1, f] = naTekturze(krzywa, L, 0);
  const t = [Math.cos(f), Math.sin(f)];
  const nn = [-Math.sin(f), Math.cos(f)];
  const r = kar.d / 2 + 0.1;
  const K = 6;
  const ue = strona < 0 ? 0.002 : 0.998;
  const pkt = (a, y) => naStol([x1 + t[0] * r * Math.sin(a) + nn[0] * r * Math.cos(a), y, z1 + t[1] * r * Math.sin(a) + nn[1] * r * Math.cos(a)]);
  for (let i = 0; i < K; i += 1) {
    const a0 = (Math.PI * i) / K;
    const a1 = (Math.PI * (i + 1)) / K;
    const am = (a0 + a1) / 2;
    const nrm = naStol([t[0] * Math.sin(am) + nn[0] * Math.cos(am), 0, t[1] * Math.sin(am) + nn[1] * Math.cos(am)]);
    quad(quady, [pkt(a0, h / 2), pkt(a1, h / 2), pkt(a1, -h / 2), pkt(a0, -h / 2)], [[ue, 0], [ue, 0], [ue, 1], [ue, 1]], tex, 'papier', { n: nrm });
  }
}

// Połowa wyklejki przyklejona do tektury (#179): arkusz wielkości strony bloku (bez grubości), od zawiasu
// (krawędź tektury przy grzbiecie) do 3 mm przed przednią krawędzią tektury, 3 mm od głowy i stopy; tuż nad
// powierzchnią tektury po stronie strona (1 – strona A kartki, −1 – B). Przy zawiasie lekki cień rowka.
function wyklejkaNaTekturze(quady, kar, krzywa, strona) {
  const Lp = Math.min(kar.wBloku || kar.w - 3, kar.w - 1);
  const hp = Math.min(kar.hBloku || kar.h - 6, kar.h - 2);
  const o = strona * (kar.d / 2 + 0.03);
  const { c, fi } = krzywa;
  const n = c.length - 1;
  const L = krzywa.sigma[n];
  const pkt = (sg) => {
    // Krzywa okładki jest prosta (sztywna tektura): punkt na długości sg, przesunięty po normalnej.
    const t = Math.min(1, sg / L);
    const i = Math.min(n - 1, Math.floor(t * n));
    const f = fi[i];
    const x = lerp(c[i][0], c[i + 1][0], t * n - i);
    const z = lerp(c[i][1], c[i + 1][1], t * n - i);
    return [x - Math.sin(f) * o, z + Math.cos(f) * o, f];
  };
  const N = 8;
  const tex = strona > 0 ? kar.przod : kar.tyl;
  siatka(quady, N, 2, (i, j) => {
    const sg = (Lp * i) / N;
    const [x, z, f] = pkt(sg);
    const y = lerp(hp / 2, -hp / 2, j / 2);
    // u: strona A czytana od zawiasu (jak przód kartki), B – od przedniej krawędzi.
    const u = strona > 0 ? sg / Lp : 1 - sg / Lp;
    return { p: naStol([x, y, z]), n: naStol([-Math.sin(f) * strona, 0, Math.cos(f) * strona]), uv: [u, (hp / 2 - y) / hp], ao: 1 - 0.22 * Math.exp(-sg / 3.5) };
  }, tex || `kolor:${PAPIER}`, 'papier');
}

// wachlarz (#181): tyle kartek z wierzchu prawej strony rozłożonej książki stoi uniesionych pod różnymi kątami.
function ksiazka(quady, model, kartki, u, { wachlarz = 0 } = {}) {
  const n = kartki.length;
  const twarda = model === 'ksiazka_twarda';
  const k = Math.floor(u + 1e-9);
  const ulamek = u - k;
  const s = ulamek > 1e-6 ? gladko(Math.min(1, ulamek)) : 0;
  const obr = ulamek > 1e-6 && k < n ? k : null;
  const wach = [];
  if (wachlarz > 0 && obr === null && k > 0) for (let j = k; j < n && wach.length < wachlarz; j += 1) if (!kartki[j].okladka) wach.push(j);
  const lewe = [];
  const prawe = [];
  for (let j = 0; j < n; j += 1) if (j !== obr && !wach.includes(j)) (j < k ? lewe : prawe).push(j);
  const grubosc = (lista) => lista.reduce((a, j) => a + kartki[j].d, 0);
  const T = grubosc(kartki.map((_, j) => j));
  const srodek = kartki.find((x) => !x.okladka) || kartki[0];
  const { w, h } = srodek;
  const matOkl = twarda ? 'twarda' : 'okladka';

  if (model === 'notes') { notesSpirala(quady, kartki, { s, obr, lewe, prawe, T, h }); return; }

  // Stos po jednej stronie, od dołu: części – okładka albo blok kartek środka.
  const uloz = (lista, strona) => {
    const odDolu = strona > 0 ? [...lista].reverse() : [...lista];
    const czesci = [];
    for (const j of odDolu) {
      const ost = czesci.at(-1);
      if (!kartki[j].okladka && ost && !ost.okladka) ost.kartki.push(j);
      else czesci.push({ okladka: Boolean(kartki[j].okladka), kartki: [j] });
    }
    let z = 0;
    for (const c of czesci) { c.z0 = z; c.H = grubosc(c.kartki); z += c.H; }
    return { czesci, wysokosc: z, strona, blok: czesci.find((c) => !c.okladka) || null };
  };
  const SL = uloz(lewe, -1);
  const SP = uloz(prawe, 1);
  // Otwarta twarda – blok i okładka osobno (#199.3, opis użytkownika): tektury z grzbietem tworzą sztywną skorupę
  // (grzbiet zawsze szerokości bloku), blok trzyma się jej tylko wyklejkami przy zawiasach. Połowa = tektura + jej
  // część bloku, obrócona wokół zawiasu; wierzch obu części bloku schodzi się w jednym zgięciu. Rozwiązanie:
  // grzbiet PR→PL długości Ts, wierzch połowy z pochyleniem λ = k·H (blok jak „Λ”); gdy pochylenie byłoby
  // za duże (gruba książka w środku), obie połowy unoszą się (książka lekko się przymyka). Na początku i na końcu
  // grzbiet stoi pionowo, a odwinięta okładka leży pod kątem 90° do niego; ku środkowi grzbiet się schyla.
  const V = (() => {
    if (!twarda || !kartki[0].okladka || !kartki[n - 1].okladka || !SL.czesci[0]?.okladka || !SP.czesci[0]?.okladka) return null;
    const d = kartki[0].d;
    const hL = SL.wysokosc - d;
    const hR = SP.wysokosc - d;
    const Tb = hL + hR;
    if (Tb < 0.05) return null;
    const Ts = Tb;
    const KMAX = 0.6;
    const licz = (tL, tR) => {
      const [cL, sL, cR, sR] = [Math.cos(tL), Math.sin(tL), Math.cos(tR), Math.sin(tR)];
      const A1 = hL * cL + hR * cR; const B1 = (d + hL) * sL + (d + hR) * sR;
      const A2 = hL * sL - hR * sR; const B2 = (d + hR) * cR - (d + hL) * cL;
      const a = A1 * A1 + A2 * A2; const b = 2 * (A1 * B1 + A2 * B2); const c = B1 * B1 + B2 * B2 - Ts * Ts;
      const delta = b * b - 4 * a * c;
      let k = a > 1e-9 && delta >= 0 ? (-b + Math.sqrt(delta)) / (2 * a) : 0;
      if (!(k > 0)) k = 0;
      return { k, phi: Math.atan2(A2 * k + B2, A1 * k + B1) };
    };
    // Przymknięcie: cieńsza połowa unosi się bardziej (grubsza leży płasko na stole).
    const katy = (g) => [g * (d + hR) / (2 * d + Tb), g * (d + hL) / (2 * d + Tb)];
    let g = 0;
    let wynik = licz(0, 0);
    if (wynik.k > KMAX) {
      let lo = 0; let hi = 1.2;
      for (let i = 0; i < 40; i += 1) { const m = (lo + hi) / 2; if (licz(...katy(m)).k > KMAX) lo = m; else hi = m; }
      g = hi; wynik = licz(...katy(g));
    }
    const [tL, tR] = katy(g);
    const PR = [0, 0];
    const PL = [-Ts * Math.cos(wynik.phi), Ts * Math.sin(wynik.phi)];
    const obrot = (t, [x, y]) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
    const zgiecie = (() => { const q = obrot(tR, [-wynik.k * hR, d + hR]); return [PR[0] + q[0], PR[1] + q[1]]; })();
    return { d, hL, hR, Ts, k: wynik.k, tL, tR, PR, PL, zgiecie, obrot };
  })();
  const rozlozona = Boolean(SL.blok && SP.blok);
  const HL = SL.blok?.H || 0;
  const HP = SP.blok?.H || 0;
  // Rozłożona książka: kartki przy grzbiecie schodzą w dolinę, wyginają się w górę i łagodnie opadają
  // do brzegu. Wysokość doliny wspólna dla obu stron.
  const B = rozlozona ? Math.min(0.07 * w, 2.2 + 0.35 * (HL + HP)) : 0;
  const rg = ogr(5 + 1.1 * (HL + HP), 5, 0.22 * w);
  const dolina = rozlozona ? Math.max(SL.blok.z0, SP.blok.z0) + 0.1 * (HL + HP) : 0;
  const profil = (S) => {
    const b = S.blok;
    if (!b) return null;
    if (!rozlozona) return (() => b.z0 + b.H);
    if (V) return (x) => b.z0 + b.H + B * 0.6 * (1 - Math.exp(-x / rg)) - B * 0.6 * (x / w) ** 1.6;
    const szczyt = b.z0 + b.H + B;
    const zv = Math.min(dolina, b.z0 + b.H);
    return (x) => zv + (szczyt - zv) * (1 - Math.exp(-x / rg)) - B * (x / w) ** 1.6;
  };
  const pL = profil(SL);
  const pP = profil(SP);
  const otwarta = lewe.length > 0 && prawe.length > 0;
  const zOkl = Boolean(kartki[0].okladka && kartki[n - 1].okladka);
  const Tb = kartki.filter((x) => !x.okladka).reduce((a, x) => a + x.d, 0);
  // Okładki po otwarciu (#161): grzbiet okładki ma swoją szerokość, więc okładka leżąca płasko odsuwa się
  // od bloku o tyle, ile grzbiet „zostaje” po tej stronie (przy pierwszej stronie – o całą grubość bloku;
  // w środku książki – wcale). Twarda: grzbiet leży płasko między okładką a blokiem; miękka: klejony do bloku.
  const f = twarda ? 1 : 0.6;
  // Szerokość grzbietu: blok i (w twardej) obie tektury.
  const Ts = Tb + (twarda && zOkl ? 2 * kartki[0].d : 0);
  let oL = 0;
  let oP = 0;
  if (zOkl && SL.czesci[0]?.okladka && SP.czesci[0]?.okladka && HL + HP > 0) {
    oL = f * Ts * Math.max(0, (HP - HL) / (HL + HP));
    oP = f * Ts * Math.max(0, (HL - HP) / (HL + HP));
  } else if (zOkl && SL.czesci.length === 1 && SL.czesci[0].okladka && SP.czesci[0]?.okladka) oL = f * Ts;
  else if (zOkl && SP.czesci.length === 1 && SP.czesci[0].okladka && SL.czesci[0]?.okladka) oP = f * Ts;
  if (V) { oL = 0; oP = 0; }
  // Twarda oprawa: blok szyty z wypukłym grzbietem (składki, kapitałka), schowany pod skorupą grzbietu.
  const bGrzbiet = twarda && zOkl ? Math.min(3.5, 0.1 * Tb) : 0;

  // Obrót i przesunięcie quadów połowy: z układu „od zawiasu, na płasko” do położenia w otwartej książce.
  const przeniesQuady = (od, kat, [jx, jy]) => {
    const c = Math.cos(kat); const sn = Math.sin(kat);
    const r = ([x, y, z]) => [jx + x * c - y * sn, jy + x * sn + y * c, z];
    for (let i = od; i < quady.length; i += 1) {
      const q = quady[i];
      q.p = q.p.map(r);
      if (q.n) q.n = [q.n[0] * c - q.n[1] * sn, q.n[0] * sn + q.n[1] * c, q.n[2]];
    }
  };
  const odKsiazki = quady.length;
  for (const S of [SL, SP]) {
    const strona = S.strona;
    const o = strona > 0 ? oP : oL;
    const odPolowy = quady.length;
    S.czesci.forEach((c, ic) => {
      if (c.okladka) {
        const kar = kartki[c.kartki[0]];
        const krzywa = krzywaZKata([strona * o, c.z0 + kar.d / 2], kar.w, () => (strona > 0 ? 0 : Math.PI), 2);
        lisc(quady, kar, krzywa, matOkl);
        return;
      }
      const p = strona > 0 ? pP : pL;
      const przykryty = ic < S.czesci.length - 1; // okładka na wierzchu – książka zamknięta
      blok(quady, {
        strona, w, h, z0: c.z0, wierzch: p, o,
        // Wierzch: po prawej przód najwyższej kartki (najmniejszy numer), po lewej tył ostatnio przewróconej.
        texWierzch: przykryty ? null : (strona > 0 ? kartki[Math.min(...c.kartki)].przod : kartki[Math.max(...c.kartki)].tyl),
        texSpod: strona > 0 ? kartki[Math.max(...c.kartki)].tyl : kartki[Math.min(...c.kartki)].przod,
        aoX: rozlozona ? (x) => 1 - 0.45 * Math.exp(-x / (rg * 0.5)) : null,
        // Otwarta sama okładka: grzbiet bloku pionowy (także w twardej, #199); zamknięta twarda – wypukły pod skorupą.
        grzbietowa: !rozlozona && (otwarta || !zOkl),
        zaokraglenie: rozlozona || otwarta ? 0 : bGrzbiet,
        oGora: V ? -V.k * (strona > 0 ? V.hR : V.hL) : o,
      });
    });
    if (V) przeniesQuady(odPolowy, strona > 0 ? V.tR : -V.tL, strona > 0 ? V.PR : V.PL);
  }

  // Przewracana kartka: od osi przy grzbiecie, wygięta – zewnętrzna część zostaje w tyle; na początku
  // i końcu dopasowana do kształtu stosu, na który się kładzie. Okładka obraca się na zawiasie, który
  // przesuwa się razem z grzbietem (zamknięta – na górze bloku, otwarta – obok bloku).
  const przyGrzbiecie = (S, p) => (S.czesci.length && !S.czesci.at(-1).okladka && p ? p(0) : S.wysokosc);
  let zawias = null; // { p: [x, z] zewnętrzna strona przy grzbiecie, d: kierunek okładki }
  const obracaj = (obr, s) => {
    const kar = kartki[obr];
    // Okładka – tektura albo karton 250–350 g (#179): sztywna, zgina się tylko na zawiasie/bigach przy grzbiecie.
    const sztywna = Boolean(kar.okladka);
    const wygiecie = kar.okladka ? 0 : 0.8;
    const z0 = lerp(przyGrzbiecie(SP, pP), przyGrzbiecie(SL, pL), s) + kar.d / 2;
    let x0 = lerp(oP, -oL, s);
    if (kar.okladka && zOkl && obr === 0) x0 = -s * f * Ts;
    if (kar.okladka && zOkl && obr === n - 1) x0 = (1 - s) * f * Ts;
    // Twarda (#199.3): tektura obraca się na zawiasie u góry stojącego grzbietu – po otwarciu leży poziomo na
    // wysokości wierzchu bloku (tak zaczyna się otwarta książka), bez skoku na stół.
    let zZawiasu = null;
    if (twarda && kar.okladka && zOkl && (obr === 0 || obr === n - 1)) {
      x0 = 0;
      zZawiasu = (obr === 0 ? przyGrzbiecie(SP, pP) : przyGrzbiecie(SL, pL)) + kar.d / 2;
    }
    const kat = (p) => (p && rozlozona ? (t) => Math.atan((p(Math.min(w, t * w + 0.5)) - p(Math.max(0, t * w - 0.5))) / (Math.min(w, t * w + 0.5) - Math.max(0, t * w - 0.5))) : () => 0);
    const kP = kat(pP);
    const kL = kat(pL);
    const pochyl = V ? lerp(V.tR, -V.tL, s) : 0; // połowy uniesione (#199.3) – kartka leży na nich pod ich kątem
    if (V) { x0 = V.zgiecie[0]; }
    const fi = (t) => Math.PI * s - (sztywna ? 0 : wygiecie * Math.sin(Math.PI * s) * t ** 1.3) + (1 - s) * kP(t) - s * kL(t) + pochyl;
    const krzywa = krzywaZKata([x0, zZawiasu ?? (V ? V.zgiecie[1] + kar.d / 2 : z0)], kar.w, fi, sztywna ? 2 : 30);
    lisc(quady, kar, krzywa, kar.okladka ? matOkl : 'papier');
    if (kar.okladka && (obr === 0 || obr === n - 1)) {
      const nn = [-Math.sin(krzywa.fi[0]), Math.cos(krzywa.fi[0])];
      const sg = obr === 0 ? 1 : -1;
      zawias = { p: [krzywa.c[0][0] + (sg * nn[0] * kar.d) / 2, krzywa.c[0][1] + (sg * nn[1] * kar.d) / 2], d: [Math.cos(krzywa.fi[0]), Math.sin(krzywa.fi[0])], wew: [krzywa.c[0][0] - (sg * nn[0] * kar.d) / 2, krzywa.c[0][1] - (sg * nn[1] * kar.d) / 2] };
    }
  };
  if (obr !== null) obracaj(obr, s);
  // Wachlarz: wierzchnia kartka najwyżej (ok. 100°), kolejne coraz niżej.
  wach.forEach((j, i) => obracaj(j, lerp(0.56, 0.07, wach.length > 1 ? i / (wach.length - 1) : 0)));

  // Grzbiet okładki (#161): cienka skorupa od zawiasu okładki pod blokiem do zawiasu drugiej okładki – nie
  // bryła. Twarda: zaokrąglona płyta odsunięta od wypukłego grzbietu bloku (szczelina – widać składki
  // i kapitałkę od głowy i stopy); miękka: przylega do płaskiego grzbietu bloku. Po otwarciu okładki grzbiet
  // leży płasko między nią a blokiem, a wyklejka przechodzi łukiem z bloku na okładkę.
  if (zOkl) {
    const strB = SP.blok || (!SL.blok && SP.czesci.length >= SL.czesci.length) ? 1 : -1;
    const Sb = strB > 0 ? SP : SL;
    const So = strB > 0 ? SL : SP;
    const oB = strB > 0 ? oP : oL;
    const oO = strB > 0 ? oL : oP;
    const dolnaB = Sb.czesci[0]?.okladka ? Sb.czesci[0].kartki[0] : null;
    const Bp = V ? V.PR : [strB * oB, 0];
    const dB = [strB, 0];
    let A = null;
    let dA = null;
    if (V) { A = V.PL; dA = [-1, 0]; } else if (zawias) { A = zawias.p; dA = zawias.d; } else if (Sb.czesci.length > 1 && Sb.czesci.at(-1).okladka) {
      A = [strB * oB, Sb.wysokosc]; dA = [strB, 0]; // zamknięta
    } else if (So.czesci[0]?.okladka) {
      A = [-strB * oO, 0]; dA = [-strB, 0];
    }
    if (A && dolnaB !== null) {
      const kar = kartki[0];
      const dl = Math.hypot(A[0] - Bp[0], A[1] - Bp[1]);
      if (dl > (V ? 0.05 : 0.4)) {
        const dS = twarda ? 1.2 : kar.d;
        const kk = (twarda ? 0.26 : 0.07) * dl;
        let pts;
        if (V) {
          // Grzbiet skorupy (#199.3): prosty, stałej szerokości, od zawiasu do zawiasu, lekko wypukły na zewnątrz
          // (od strony przeciwnej do zgięcia).
          const [ax, ay] = Bp; const [bx, by] = A;
          let nx = -(by - ay); let ny = bx - ax;
          const dl2 = Math.hypot(nx, ny) || 1; nx /= dl2; ny /= dl2;
          const [cx, cy] = [(ax + bx) / 2, (ay + by) / 2];
          if ((V.zgiecie[0] - cx) * nx + (V.zgiecie[1] - cy) * ny > 0) { nx = -nx; ny = -ny; }
          const wyp = Math.min(1.5, 0.06 * dl);
          pts = [];
          for (let i = 0; i <= 20; i += 1) { const t = i / 20; const b = wyp * Math.sin(Math.PI * t); pts.push([lerp(ax, bx, t) + nx * b, lerp(ay, by, t) + ny * b]); }
        } else if (twarda || !otwarta || zawias) {
          // Wypukłość co najmniej grubości skorupy – wnętrze nie wchodzi w grzbiet bloku.
          const kw = kk + dS * 1.4 + bGrzbiet;
          pts = bezier(Bp, odj2(Bp, razy2(dB, kw)), odj2(A, razy2(dA, kw)), A, 26);
        } else {
          // Miękka po otwarciu: klejony grzbiet stoi przy bloku, okładka odchodzi łukiem od jego górnej krawędzi.
          const top = [Bp[0] - strB * 0.05, Sb.wysokosc];
          const k2 = 0.45 * Math.hypot(A[0] - top[0], A[1] - top[1]);
          pts = [...bezier(Bp, [Bp[0] - strB * 0.6, 0], [top[0] - strB * 0.6, top[1] - 0.6], top, 6), ...bezier(top, [top[0] - strB * k2, top[1]], odj2(A, razy2(dA, k2)), A, 18).slice(1)];
        }
        // Zewnętrzna powierzchnia skorupy na zawiasach (nie środek grubości) – nic nie wchodzi pod stół.
        const zewA = strB > 0;
        const k0 = krzywaZPunktow(pts);
        const sg0 = zewA ? 1 : -1;
        const krzywa = krzywaZPunktow(k0.c.map((p, i) => [p[0] + sg0 * Math.sin(k0.fi[i]) * dS / 2, p[1] - sg0 * Math.cos(k0.fi[i]) * dS / 2]));
        const L = krzywa.sigma.at(-1);
        const tylNaDole = dolnaB === n - 1;
        const pre = kar.przod?.match(/^(okl|obw):/)?.[1]; // obwoluta (#181) – grzbiet z obwoluty
        const texZew = pre ? `${pre}:grzbiet` : `kolor:${KRAWEDZ_OKLADKI}`;
        const uZew = pre ? (sg) => ogr(tylNaDole ? 1 - sg / L : sg / L, 0.003, 0.997) : () => 0.5;
        const texWew = `kolor:${twarda ? KRAFT : PAPIER}`;
        const od = quady.length;
        arkusz(quady, krzywa, kar.h, dS, {
          texA: zewA ? texZew : texWew, texB: zewA ? texWew : texZew,
          uA: zewA ? uZew : () => 0.5, uB: zewA ? () => 0.5 : uZew,
          mat: matOkl, krawedz: texZew, matKrawedzi: matOkl,
          krawedzieUv: pre ? (sg, g) => [uZew(sg), g ? 0.004 : 0.996] : null, vOdwrotnie: true,
        });
        for (let i = od; i < quady.length; i += 1) quady[i].grzbiet = true;
      }
      // Bez paska zgięcia wyklejki (#199): luźna połowa wyklejki leży przyklejona do pierwszej strony bloku,
      // a grzbiet bloku przy otwartej okładce stoi pionowo – nic nie wisi w zgięciu ani nie sterczy między stronami.
    }
  }
  // Otwarta twarda (#199.3): po obrocie połówek książka opiera się na stole najniższym punktem.
  if (V) {
    let min = Infinity;
    for (let i = odKsiazki; i < quady.length; i += 1) for (const p of quady[i].p) if (p[1] < min) min = p[1];
    if (Number.isFinite(min) && Math.abs(min) > 1e-6) for (let i = odKsiazki; i < quady.length; i += 1) quady[i].p = quady[i].p.map(([x, y, z]) => [x, y - min, z]);
  }
}

// Krzywa Béziera (2D) w N odcinkach.
function bezier(P0, P1, P2, P3, N) {
  const pts = [];
  for (let i = 0; i <= N; i += 1) {
    const t = i / N;
    const a = (1 - t) ** 3;
    const b = 3 * (1 - t) ** 2 * t;
    const c = 3 * (1 - t) * t * t;
    const d = t ** 3;
    pts.push([a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1]]);
  }
  return pts;
}
const odj2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const razy2 = (a, k) => [a[0] * k, a[1] * k];
// Krzywa dla arkusz() z listy punktów [x, z]: kąty z kierunku odcinków, długość łuku.
function krzywaZPunktow(pts) {
  const c = pts;
  const fi = [];
  const sigma = [0];
  for (let i = 0; i < c.length; i += 1) {
    const a = c[Math.max(0, i - 1)];
    const b = c[Math.min(c.length - 1, i + 1)];
    fi.push(Math.atan2(b[1] - a[1], b[0] - a[0]));
    if (i) sigma.push(sigma[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
  }
  return { c, fi, sigma };
}

// Oprawa Wire-O (#179) – średnica pierścienia z grubości bloku (z okładkami) wg tabel producentów: skok 3:1
// (8,47 mm) do 1/2″, 2:1 (12,7 mm) od 9/16″. Grubszy blok – pierścień największy i zaGruby (drukarnia go nie zepnie).
const WIRE_O = [[6.4, 4], [7.9, 5], [9.5, 7], [11.1, 8], [12.7, 10], [14.3, 11], [15.9, 12], [19.1, 15], [22.2, 18], [25.4, 21], [31.8, 28]];
export function parametryWireO(T) {
  const [srednica, max] = WIRE_O.find(([, m]) => T <= m) || WIRE_O.at(-1);
  const trzy = srednica <= 12.7;
  return {
    srednica, typ: trzy ? '3:1' : '2:1', skok: trzy ? 8.47 : 12.7,
    drut: srednica <= 9.5 ? 0.8 : srednica <= 15.9 ? 1.0 : 1.2,
    otwor: ogr(0.45 * srednica, 3, 6), // środek otworu od krawędzi kartek
    zaGruby: T > max, maks: WIRE_O.at(-1)[1],
  };
}

// Drut Wire-O jako jedna łamana: przy każdym otworze „spinka” – dwa równoległe druty (palce) pełnym kołem
// przez otwór, zawrócone na końcu; między otworami drut biegnie wzdłuż grzbietu. Kąt ka – miejsce grzbietu
// (tam łączniki i zamknięcie pierścienia). P(a, kat) – punkt na okręgu w położeniu a wzdłuż osi.
function wireO(q, pozycje, { skok, drut }, P, ka) {
  const d = 0.12 * skok + drut / 2; // palce spinki blisko siebie, spinki wyraźnie oddzielone
  const g = 0.32; // szczelina zamknięcia przy grzbiecie
  const K = 30;
  const pts = [];
  pozycje.forEach((a, i) => {
    for (let k = 0; k <= K; k += 1) pts.push(P(a - d, ka + g / 2 + (k / K) * (2 * Math.PI - g)));
    // Zawrócenie spinki – półkole wzdłuż osi tuż przed grzbietem.
    for (let k = 1; k < 6; k += 1) { const t = k / 6; pts.push(P(a - d + 2 * d * t, ka - g / 2 - 0.12 * Math.sin(Math.PI * t))); }
    for (let k = K; k >= 0; k -= 1) pts.push(P(a + d, ka + g / 2 + (k / K) * (2 * Math.PI - g)));
    if (i < pozycje.length - 1) { const b = pozycje[i + 1]; for (let k = 1; k < 4; k += 1) pts.push(P(lerp(a + d, b - d, k / 4), ka + g / 2)); }
  });
  rura(q, pts, drut / 2, 'drut', `kolor:${DRUT}`, false);
}

// Notes na spirali: kartki obracają się sztywno wokół osi spirali (x = 0, z = T/2); przewrócone leżą po
// lewej. Spirala (#161) jak prawdziwa podwójna (Wire-O): okrągłe pętle o średnicy grubości bloku + ok. 3,6 mm,
// skok 3:1 (8,47 mm) do średnicy 14,3 mm, grubsze – 2:1 (12,7 mm); drut 1,1–1,4 mm; otwory 1–4 mm od brzegu.
// Pętle obejmują cały blok z okładkami i przechodzą przez otwory; notes leży na drucie (uniesiony).
function notesSpirala(quady, kartki, { s, obr, lewe, prawe, T, h }) {
  const zc = T / 2;
  const wo = parametryWireO(T);
  const rr = wo.srednica / 2; // promień pierścienia Wire-O (#179)
  const rw = wo.drut / 2; // promień drutu
  const pitch = wo.skok;
  const x0 = rr - wo.otwor; // brzeg kartek od osi spirali – okrąg przechodzi przez środek otworu
  const n = kartki.length;
  const zKartki = [];
  let z = 0;
  for (let j = n - 1; j >= 0; j -= 1) { zKartki[j] = z + kartki[j].d / 2; z += kartki[j].d; }
  const rysuj = (j, kat, wygiecie = 0, kar = kartki[j], zSrodek = zKartki[j]) => {
    const zz = zSrodek - zc;
    const start = [Math.cos(kat) * x0 - Math.sin(kat) * zz, zc + Math.sin(kat) * x0 + Math.cos(kat) * zz];
    const krzywa = krzywaZKata(start, kar.w, (t) => kat - wygiecie * t ** 1.4, wygiecie ? 24 : 2);
    lisc(quady, kar, krzywa, kar.okladka ? 'okladka' : 'papier');
  };
  // Kolejne kartki środka po jednej stronie – jeden blok (wierzch i spód z właściwych stron), nie setki kartek.
  const stos = (lista, kat) => {
    const grupy = [];
    for (const j of [...lista].sort((a, b) => a - b)) {
      const g = grupy.at(-1);
      if (g && !kartki[j].okladka && !g.okladka && j === g.do + 1) g.do = j;
      else grupy.push({ od: j, do: j, okladka: Boolean(kartki[j].okladka) });
    }
    for (const g of grupy) {
      if (g.od === g.do) { rysuj(g.od, kat); continue; }
      const a = kartki[g.od];
      const b = kartki[g.do];
      let d = 0;
      for (let j = g.od; j <= g.do; j += 1) d += kartki[j].d;
      const zs = (zKartki[g.od] + kartki[g.od].d / 2 + zKartki[g.do] - kartki[g.do].d / 2) / 2;
      rysuj(g.od, kat, 0, { ...a, d, przod: a.przod, tyl: b.tyl }, zs);
    }
  };
  stos(lewe, Math.PI);
  stos(prawe, 0);
  if (obr !== null) rysuj(obr, Math.PI * s, (kartki[obr].okladka ? 0 : 0.55) * Math.sin(Math.PI * s));
  const ile = Math.max(3, Math.floor((h - 10) / pitch));
  const ys = Array.from({ length: ile }, (_, i) => -((ile - 1) * pitch) / 2 + i * pitch);
  const rozstaw = pitch * 0.12 + wo.drut / 2; // dwa palce spinki Wire-O
  // Otwory na wierzchnich kartkach obu stosów (lekko nad powierzchnią): jeden prostokątny na pętlę.
  const otwory = (lista, strona) => {
    if (!lista.length) return;
    const top = strona > 0 ? Math.min(...lista) : Math.max(...lista);
    const zt = (strona > 0 ? zKartki[top] : 2 * zc - zKartki[top]) + kartki[top].d / 2 + 0.08;
    const pol = rozstaw + rw + 0.35;
    for (const y of ys) {
      const xa = strona * (x0 + wo.otwor - 1.6);
      const xb = strona * (x0 + wo.otwor + 1.6);
      const p = [naStol([xa, y - pol, zt]), naStol([xb, y - pol, zt]), naStol([xb, y + pol, zt]), naStol([xa, y + pol, zt])];
      quad(quady, strona > 0 ? p : [p[1], p[0], p[3], p[2]], [[0, 0], [1, 0], [1, 1], [0, 1]], `kolor:${OTWOR}`, 'papier', { n: [0, 1, 0] });
    }
  };
  otwory(lewe, -1);
  otwory(prawe, 1);
  // Spirala: okrągłe pętle wokół osi, po dwie przy każdym otworze.
  const unies = Math.max(0, rr + rw - zc); // notes leży na drucie
  quady.push(...zPamieci(`notes|${rr}|${zc}|${h}|${pitch}`, () => {
    const q = [];
    // Grzbiet spirali po stronie przeciwnej do kartek (kąt π).
    wireO(q, ys, wo, (y, a) => naStol([rr * Math.cos(a), y, zc + rr * Math.sin(a)]), Math.PI);
    return q;
  }));
  if (unies) quady.forEach((q, i) => { quady[i] = { ...q, p: q.p.map(([x, y, z]) => [x, y + unies, z]) }; });
}

// ---------- Kalendarze ----------

// Karty wiszą na osi spirali (wzdłuż x, w y = 0, z = 0), w dół. Przewracana karta idzie do widza, w górę
// i przez górę na tył. Ścienny wisi na ścianie (z = const) na wieszaku, biurkowy stoi na stojaku z tektury.
function kalendarz(quady, model, kartki, u) {
  const biurkowy = model === 'kalendarz_biurkowy';
  const n = kartki.length;
  const k = Math.floor(u + 1e-9);
  const ulamek = u - k;
  const s = ulamek > 1e-6 ? gladko(Math.min(1, ulamek)) : 0;
  const obr = ulamek > 1e-6 && k < n ? k : null;
  const w = Math.max(...kartki.map((x) => x.w));
  const h = Math.max(...kartki.map((x) => x.h));
  const T = kartki.reduce((a, x) => a + x.d, 0);
  const pt = 1.8; // tektura stojaka
  const wo = parametryWireO(T + (biurkowy ? 2 * pt : 0)); // Wire-O wg grubości (#179)
  const r = wo.srednica / 2;
  const nach = biurkowy ? 0.34 : 0;
  const przod = [];
  const tyl = [];
  let a = biurkowy ? pt : 0;
  for (let j = n - 1; j >= 0; j -= 1) { przod[j] = a + kartki[j].d / 2; a += kartki[j].d; }
  a = biurkowy ? pt : 0;
  for (let j = 0; j < n; j += 1) { tyl[j] = -(a + kartki[j].d / 2); a += kartki[j].d; }
  const gornyBrzeg = r - wo.otwor; // górna krawędź karty; środek otworu na okręgu spirali
  const obroc = (psi) => ([x, y, z]) => [x, y * Math.cos(psi) - z * Math.sin(psi), y * Math.sin(psi) + z * Math.cos(psi)];
  const scianaZ = biurkowy ? null : -(r + 0.8);
  const karta = (j, psi, dz, wygiecie = 0, kar = kartki[j]) => {
    const R = obroc(psi);
    const N = wygiecie ? 22 : 1;
    // Krzywa karty w płaszczyźnie (z, y): od górnej krawędzi w dół (kąt −π/2), opcjonalnie wygięta.
    const krzywa = krzywaZKata([0, 0], kar.h, (t) => -Math.PI / 2 + wygiecie * t ** 1.3, N);
    const P = (i, x, strona) => {
      const [cz, cy] = krzywa.c[i];
      const f = krzywa.fi[i];
      const o = (strona * kar.d) / 2;
      const p = R([x, -gornyBrzeg + cy + Math.cos(f) * o, cz - Math.sin(f) * o + dz]);
      if (scianaZ !== null && p[2] < scianaZ + 0.4) p[2] = scianaZ + 0.4;
      return p;
    };
    const Nn = (i, strona) => { const f = krzywa.fi[i]; return R([0, Math.cos(f) * strona, -Math.sin(f) * strona]); };
    const xs = [-kar.w / 2, 0, kar.w / 2];
    siatka(quady, N, 2, (i, jj) => ({ p: P(i, xs[jj], 1), n: Nn(i, 1), uv: [(xs[jj] + kar.w / 2) / kar.w, krzywa.sigma[i] / kar.h] }), kar.przod || `kolor:${PAPIER}`, 'papier');
    siatka(quady, N, 2, (i, jj) => ({ p: P(i, xs[2 - jj], -1), n: Nn(i, -1), uv: [(kar.w / 2 - xs[2 - jj]) / kar.w, krzywa.sigma[i] / kar.h] }), kar.tyl || `kolor:${PAPIER}`, 'papier');
    const kt = `kolor:${PAPIER}`;
    const uv0 = [[0, 0], [1, 0], [1, 1], [0, 1]];
    quad(quady, [P(N, -kar.w / 2, 1), P(N, kar.w / 2, 1), P(N, kar.w / 2, -1), P(N, -kar.w / 2, -1)], uv0, kt, 'papier', { n: R([0, -1, 0]) });
    quad(quady, [P(0, -kar.w / 2, -1), P(0, kar.w / 2, -1), P(0, kar.w / 2, 1), P(0, -kar.w / 2, 1)], uv0, kt, 'papier', { n: R([0, 1, 0]) });
    for (const sg of [-1, 1]) for (let i = 0; i < N; i += 1) {
      quad(quady, [P(i, (sg * kar.w) / 2, 1), P(i + 1, (sg * kar.w) / 2, 1), P(i + 1, (sg * kar.w) / 2, -1), P(i, (sg * kar.w) / 2, -1)], uv0, kt, 'papier', { n: R([sg, 0, 0]) });
    }
  };
  const psiPrzod = -nach;
  const psiTyl = nach - 2 * Math.PI;
  // Karty pod wierzchnią (z przodu i z tyłu) – jeden blok o ich łącznej grubości.
  const stosKart = (lista, psi, pos, wierzchnia) => {
    if (!lista.length) return;
    karta(wierzchnia, psi, pos[wierzchnia]);
    const reszta = lista.filter((j) => j !== wierzchnia);
    if (!reszta.length) return;
    const d = reszta.reduce((a2, j) => a2 + kartki[j].d, 0);
    const zs = reszta.reduce((a2, j) => a2 + pos[j], 0) / reszta.length;
    const wz = reszta.reduce((m, j) => (kartki[j].w * kartki[j].h > m.w * m.h ? kartki[j] : m), kartki[reszta[0]]);
    karta(reszta[0], psi, zs, 0, { ...wz, d, przod: kartki[reszta.reduce((m, j) => (pos[j] > pos[m] ? j : m), reszta[0])].przod, tyl: null });
  };
  const zPrzodu = [];
  const zTylu = [];
  for (let j = 0; j < n; j += 1) if (j !== obr) (j < k ? zTylu : zPrzodu).push(j);
  stosKart(zPrzodu, psiPrzod, przod, zPrzodu.length ? Math.min(...zPrzodu) : null);
  stosKart(zTylu, psiTyl, tyl, zTylu.length ? Math.max(...zTylu) : null);
  if (obr !== null) karta(obr, lerp(psiPrzod, psiTyl, s), lerp(przod[obr], tyl[obr], s), -0.6 * Math.sin(Math.PI * s));

  // Stojak biurkowy: dwie ścianki z grubej tektury od grzbietu do blatu.
  const dl = h + gornyBrzeg + 5;
  if (biurkowy) {
    for (const [psi, z0, z1] of [[psiPrzod, 0, pt], [psiTyl, -pt, 0]]) {
      const R = obroc(psi);
      const [x0, x1, y0, y1] = [-w / 2 - 4, w / 2 + 4, -(r - 3), -dl];
      const sciany = [
        [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
        [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
        [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, -1, 0]],
        [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 1, 0]],
        [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
        [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
      ];
      for (const [a1, b1, c1, d1, nn] of sciany) quad(quady, [R(a1), R(b1), R(c1), R(d1)], [[0, 0], [1, 0], [1, 1], [0, 1]], `kolor:${TEKTURA}`, 'tektura', { n: R(nn) });
    }
  }

  // Wire-O (#179): spinki co skok wzdłuż górnej krawędzi; w ściennym pośrodku przerwa na wieszak
  // (półokrągłe wycięcie w kartach), drut biegnie tam wzdłuż grzbietu.
  const pitch = wo.skok;
  const ile = Math.max(3, Math.floor((w - 12) / pitch));
  const wyciecie = biurkowy ? 0 : Math.min(30, w * 0.18);
  const pozycje = Array.from({ length: ile }, (_, i) => -((ile - 1) * pitch) / 2 + i * pitch).filter((x) => Math.abs(x) > wyciecie / 2 + pitch * 0.3);
  quady.push(...zPamieci(`kal|${pozycje.length}|${r}|${pitch}|${wyciecie}`, () => {
    const q0 = [];
    // Grzbiet spirali na górze (kąt π/2 – nad kartami).
    wireO(q0, pozycje, wo, (x, al) => [x, r * Math.sin(al), r * Math.cos(al)], Math.PI / 2);
    return q0;
  }));
  if (!biurkowy) {
    // Półokrągłe wycięcie w kartach pod wieszak (ciemne – widać przez nie ścianę) – na wierzchniej karcie.
    const rn = wyciecie / 2 - 2;
    const zW = (przod[Math.min(...zPrzodu, n - 1)] ?? 0) + 0.05;
    for (let i = 0; i < 12; i += 1) {
      const t0 = (i / 12) * Math.PI;
      const t1 = ((i + 1) / 12) * Math.PI;
      const pt0 = (t) => [rn * Math.cos(t), -gornyBrzeg - rn * Math.sin(t) * 0.75, zW + 0.08];
      quad(quady, [[0, -gornyBrzeg, zW + 0.08], pt0(t0), pt0(t1), [0, -gornyBrzeg, zW + 0.08]], [[0, 0], [1, 0], [1, 1], [0, 1]], `kolor:${OTWOR}`, 'papier', { n: [0, 0, 1] });
    }
    // Wieszak: haczyk z drutu w przerwie spirali, do gwoździa w ścianie.
    const pts = [];
    for (let q = 0; q <= 18; q += 1) {
      const t = q / 18;
      const x = lerp(-rn, rn, t);
      pts.push([x, r + 0.2 + 15 * (1 - Math.abs(2 * t - 1)) ** 0.9, lerp(0, scianaZ + 1.2, 1 - Math.abs(2 * t - 1))]);
    }
    rura(quady, pts, 0.55);
    quady.podloze = { typ: 'sciana', poziom: scianaZ };
    return;
  }
  // Biurkowy: blat na y = 0.
  const wys = dl * Math.cos(nach);
  quady.forEach((q, i) => { quady[i] = { ...q, p: q.p.map(([x, y, z]) => [x, y + wys, z]) }; });
  quady.podloze = { typ: 'stol', poziom: 0 };
}

// ---------- Pojedyncza kartka ----------

function kartkaNaStole(quady, kartki, u) {
  const k = Math.floor(u + 1e-9);
  const ulamek = u - k;
  const s = ulamek > 1e-6 ? gladko(Math.min(1, ulamek)) : 0;
  const kk = Math.min(kartki.length * 2 - 1, k);
  const j = Math.min(kartki.length - 1, Math.floor((kk + (s > 0.5 ? 1 : 0)) / 2));
  const kar = kartki[j];
  const th = Math.PI * ((kk % 2) + s);
  const { w, h, d } = kar;
  // Obrót wokół osi pionowej strony (y), uniesienie nad stół w trakcie.
  const lift = (w / 2) * Math.abs(Math.sin(th)) + d / 2 + 0.02;
  const kat = (t) => th + 0.12 * Math.sin(th) * (t - 0.5);
  const krzywa = krzywaZKata([0, 0], w, kat, 16);
  // Środek kartki w (0, lift).
  const mid = krzywa.c[8];
  krzywa.c = krzywa.c.map(([x, z]) => [x - mid[0], z - mid[1] + lift]);
  // Kartka leży lekko wygięta (papier nie jest idealnie płaski): drobne uniesienie rogów.
  arkusz(quady, krzywa, h, d, {
    texA: kar.przod || `kolor:${PAPIER}`, texB: kar.tyl || `kolor:${PAPIER}`,
    uA: (sg) => sg / w, uB: (sg) => 1 - sg / w, mat: 'papier',
  });
}

// ---------- Scena ----------

// Scena modelu w położeniu u: lista czworokątów (współrzędne świata) i quady.podloze.
// ulozenie (#179): 'lezy' (domyślnie) albo 'stoi' – książka i notes stoją na dolnej krawędzi; otwarte
// – rozłożone w „V” jak na półce wystawowej (grzbiet z tyłu).
export const ULOZENIA = { lezy: 'Leży', stoi: 'Stoi' };
export const mozeStac = (model) => model.startsWith('ksiazka') || model === 'notes';
// ---------- Sekcje specjalne (#181) ----------

// Ścieżka w płaszczyźnie (x, z): od punktu start w kierunku kierunek; kroki – odcinki { L } albo łuki { r, kat }
// (kat > 0 – w lewo, czyli w górę przy kierunku w prawo).
function sciezka(start, kierunek, kroki) {
  const pts = [start.slice()];
  let p = start.slice();
  let h = kierunek;
  for (const k of kroki) {
    if (k.kat === undefined || Math.abs(k.kat) < 1e-5) {
      const L = k.kat === undefined ? k.L : k.r * Math.abs(k.kat);
      if (L < 1e-6) continue;
      p = [p[0] + Math.cos(h) * L, p[1] + Math.sin(h) * L];
      pts.push(p);
      continue;
    }
    const sg = Math.sign(k.kat);
    const c = [p[0] - Math.sin(h) * k.r * sg, p[1] + Math.cos(h) * k.r * sg];
    const N = 8;
    for (let i = 1; i <= N; i += 1) {
      const a = h + (k.kat * i) / N;
      p = [c[0] + k.r * sg * Math.sin(a), c[1] - k.r * sg * Math.cos(a)];
      pts.push(p);
    }
    h += k.kat;
  }
  return pts;
}

// Ulotka składana: arkusz łamany na panelach (zgięcia – łuki o promieniu z grubości papieru). u 0 – złożona
// (okładka na wierzchu), 1 – rozłożona środkiem do góry, 2 – odwrócona (zewnątrz). Zwijana (C): panel 2 leży na
// stole, kolejne zwijają się do środka, panel 1 (okładka) przykrywa całość; harmonijka (Z): zygzak, panel 1 na
// wierzchu. Rozkładanie po kolei: najpierw okładka, potem panele wewnętrzne.
function ulotka(quady, kar, u) {
  const sp = kar.specjalna;
  const panele = sp.wynik.panele?.length ? sp.wynik.panele : [kar.w];
  const n = panele.length;
  const zz = sp.zlozenie === 'z' && n > 2;
  const d = kar.d;
  const S = panele.reduce((a, x) => a + x, 0);
  const e = ogr(u, 0, 1);
  const m = n - 1;
  const span = m > 1 ? 0.6 : 1;
  const otw = (i) => gladko(ogr((e - (m > 1 ? (i * (1 - span)) / (m - 1) : 0)) / span, 0, 1));
  // Kąt zgięcia i (między panelem i a i + 1): dokładnie π po złożeniu, lekka pamięć zgięcia po rozłożeniu.
  const kat = (i, znak) => znak * (Math.PI * (1 - otw(i)) + 0.05 * otw(i));
  const dl = (k) => k.r * Math.abs(k.kat);
  let pts;
  if (!zz) {
    // Zwijana: baza – drugi panel, w prawo kolejne (łuki w górę, wewnętrzne ciaśniejsze), w lewo – okładka.
    const R = Array.from({ length: n }, () => d);
    for (let i = n - 2; i >= 1; i -= 1) R[i] = (n - 1 - i) * d;
    const R0 = n > 2 ? R[1] + d : d;
    const luk = [];
    for (let i = 0; i < m; i += 1) luk.push({ r: i === 0 ? R0 : R[i], kat: i === 0 ? -kat(0, 1) : kat(i, 1) });
    const prosta = (i) => panele[i] - (i > 0 ? dl(luk[i - 1]) / 2 : 0) - (i < m ? dl(luk[i]) / 2 : 0);
    const prawo = [{ L: prosta(1) }];
    for (let i = 2; i < n; i += 1) prawo.push(luk[i - 1], { L: prosta(i) });
    const lewo = sciezka([0, 0], Math.PI, [luk[0], { L: prosta(0) }]);
    pts = [...lewo.slice(1).reverse(), ...sciezka([0, 0], 0, prawo)];
  } else {
    // Harmonijka: od pierwszego panelu w prawo, zgięcia na przemian (kolejność punktów zostaje – środek po +n).
    const luk = Array.from({ length: m }, (_, i) => ({ r: d, kat: kat(i, i % 2 ? -1 : 1) }));
    const kroki = [];
    for (let i = 0; i < n; i += 1) {
      kroki.push({ L: panele[i] - (i > 0 ? dl(luk[i - 1]) / 2 : 0) - (i < m ? dl(luk[i]) / 2 : 0) });
      if (i < m) kroki.push(luk[i]);
    }
    // Pierwszy panel leży, reszta się od niego odgina; całość obrócona o π (złożona) → 0 (rozłożona środkiem do góry)
    // – harmonijkę przy rozkładaniu odwraca się w dłoniach.
    const a = Math.PI * (1 - gladko(e));
    pts = sciezka([0, 0], 0, kroki).map(([x, z]) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)]);
  }
  const krzywa = krzywaZPunktow(pts);
  // Odwracanie rozłożonej ulotki (u 1 → 2): obrót wokół pionowej osi strony, z uniesieniem nad stół.
  const th = Math.PI * gladko(ogr(u - 1, 0, 1));
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const [x] of krzywa.c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const cx = (x0 + x1) / 2;
  krzywa.c = krzywa.c.map(([x, z]) => [(x - cx) * Math.cos(th) - z * Math.sin(th), (x - cx) * Math.sin(th) + z * Math.cos(th)]);
  krzywa.fi = krzywa.fi.map((f) => f + th);
  let min = Infinity;
  for (const [, z] of krzywa.c) min = Math.min(min, z);
  krzywa.c = krzywa.c.map(([x, z]) => [x, z - min + d / 2 + 0.02]);
  arkusz(quady, krzywa, kar.h, d, {
    texA: kar.tyl || `kolor:${PAPIER}`, texB: kar.przod || `kolor:${PAPIER}`,
    uA: (sg) => ogr(sg / S, 0, 1), uB: (sg) => ogr(1 - sg / S, 0, 1), mat: 'papier',
  });
}

// Przekształcenia sztywne { R: macierz 3×3 wierszami, t } – zawiasy wykrojników.
const T_JEDN = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
const naR = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
const naT = (T, p) => dod(naR(T.R, p), T.t);
function zlozT(A, B) {
  const R = [];
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) R.push(A.R[i * 3] * B.R[j] + A.R[i * 3 + 1] * B.R[3 + j] + A.R[i * 3 + 2] * B.R[6 + j]);
  return { R, t: dod(naR(A.R, B.t), A.t) };
}
// Obrót o kąt wokół prostej przez punkt A o kierunku k (wzór Rodriguesa).
function obrotOs(A, k, kat) {
  const [x, y, z] = k;
  const c = Math.cos(kat);
  const s = Math.sin(kat);
  const C = 1 - c;
  const R = [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
  return { R, t: odj(A, naR(R, A)) };
}

// Wykrojnik złożony z paneli na zawiasach: { poly: [[x, y]…] w mm arkusza, rodzic, zawias: [[x, y], [x, y]], kat,
// warstwa }. Arkusz leży nadrukiem w dół (to zewnątrz bryły), płasko: X = −(x − cx), Z = y − cy; panele zginają
// się do środka (w górę). Nadruk z uv arkusza, środek – karton.
function wykrojnik(quady, kar, panele, { e = 0.3 } = {}) {
  const S = kar.w;
  const Hs = kar.h;
  const F = ([x, y]) => [-(x - S / 2), 0, y - Hs / 2];
  const T = [];
  panele.forEach((pn, i) => {
    let Ti = T_JEDN;
    if (pn.rodzic !== undefined) {
      const A = F(pn.zawias[0]);
      const k = norm(odj(F(pn.zawias[1]), A));
      const sr = F(pn.poly.reduce((a, p) => [a[0] + p[0] / pn.poly.length, a[1] + p[1] / pn.poly.length], [0, 0]));
      const znak = naT(obrotOs(A, k, 0.1), sr)[1] >= 0 ? 1 : -1;
      const rot = obrotOs(A, k, znak * pn.kat);
      // Warstwy (klapki jedna na drugiej): złożone panele odsunięte o ułamek milimetra.
      rot.t = dod(rot.t, [0, (pn.warstwa || 0) * 0.3 * ogr(pn.kat / Math.PI, 0, 1) * 2, 0]);
      Ti = zlozT(T[pn.rodzic], rot);
    }
    T[i] = Ti;
    const nN = naR(Ti.R, [0, -1, 0]); // nadruk – na zewnątrz
    const P = pn.poly.map((p) => naT(Ti, F(p)));
    const uv = pn.poly.map(([x, y]) => [ogr(x / S, 0, 1), ogr(y / Hs, 0, 1)]);
    quad(quady, P.map((v) => dod(v, razy(nN, e / 2))), uv, kar.przod || `kolor:${PAPIER}`, 'okladka', { n: nN });
    quad(quady, P.map((v) => dod(v, razy(nN, -e / 2))), uv, `kolor:${KARTON}`, 'tektura', { n: razy(nN, -1) });
  });
  return T;
}

// ---------- Składanka (#238) ----------

// Trójkąty wielokąta (ucinanie uszu) – ściany części bywają wklęsłe. Zwraca trójki indeksów.
export function trojkatyWielokata(p) {
  const n = p.length;
  if (n < 3) return [];
  const ccw = poleWielokata(p.map(([x, y]) => ({ x, y }))) > 0;
  let idx = [...Array(n).keys()];
  if (!ccw) idx.reverse();
  const kr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  // Wierzchołki na prostej (np. końce zgięć i nacięć na brzegu ściany, #273) blokowałyby obcinanie uszu – pomijamy je.
  for (let zmiana = true; zmiana && idx.length > 3;) {
    zmiana = false;
    for (let i = 0; i < idx.length; i += 1) {
      const [a, b, c] = [p[idx[(i - 1 + idx.length) % idx.length]], p[idx[i]], p[idx[(i + 1) % idx.length]]];
      const dl = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      if (Math.abs(kr(a, b, c)) / dl < 1e-6 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0) { idx = idx.filter((_, j) => j !== i); zmiana = true; break; }
    }
  }
  const wTrojkacie = (q, a, b, c) => kr(a, b, q) >= -1e-9 && kr(b, c, q) >= -1e-9 && kr(c, a, q) >= -1e-9;
  const wynik = [];
  let straz = 0;
  while (idx.length > 3 && straz < 4 * n) {
    straz += 1;
    let ucieto = false;
    for (let i = 0; i < idx.length; i += 1) {
      const [ia, ib, ic] = [idx[(i - 1 + idx.length) % idx.length], idx[i], idx[(i + 1) % idx.length]];
      const [a, b, c] = [p[ia], p[ib], p[ic]];
      if (kr(a, b, c) <= 1e-9) continue; // wierzchołek wklęsły albo współliniowy
      // Punkty w miejscu wierzchołków ucha (zdwojone przy mostku do otworu, #298) nie blokują ucha.
      const tenSam = (q, r) => Math.abs(q[0] - r[0]) < 1e-9 && Math.abs(q[1] - r[1]) < 1e-9;
      if (idx.some((j) => j !== ia && j !== ib && j !== ic && !tenSam(p[j], a) && !tenSam(p[j], b) && !tenSam(p[j], c) && wTrojkacie(p[j], a, b, c))) continue;
      wynik.push([ia, ib, ic]);
      idx.splice(i, 1);
      ucieto = true;
      break;
    }
    if (!ucieto) break;
  }
  if (idx.length === 3) wynik.push([idx[0], idx[1], idx[2]]);
  return wynik;
}

// Części na arkuszach: każda składa się po swoich zgięciach – drzewo ścian od największej (leży), kolejne
// obracają się wokół zawiasów o (180° − kąt po złożeniu); „góra” – od nadruku (nadruk na zewnątrz), „dolina” –
// w drugą stronę. Arkusze leżą obok siebie; u: 0 – płasko nadrukiem do góry, 1 – złożone (najpierw odwrócenie,
// potem zginanie), 2 – sklejony model (#286): części ustawiają się po parach (sklejModel). Tekstura ścian – z arkusza
// (uv z położenia części na arkuszu), spód – karton.
export function geometriaCzesci(cz, kartki, s) {
  const kar = kartki[cz.arkusz] || kartki[0];
  const S = kar.w;
  const Hs = kar.h;
  const dx = cz.arkusz * (S + 40);
  const F = ([x, y]) => [-(x - S / 2) - dx, 0, y - Hs / 2];
  const c = normalizujCzesc(cz.czesc);
  const { sciany, zawiasy, otwory = [], odpady = [] } = scianyCzesci(c);
  if (!sciany.length) return null;
  const naArk = (q) => { const r = naStronieZapisanej(cz.obiekt, q); return [r.x, r.y]; };
  const pola = sciany.map((w) => Math.abs(poleWielokata(w)));
  const korzen = pola.indexOf(Math.max(...pola));
  const T = new Array(sciany.length).fill(null);
  T[korzen] = T_JEDN;
  const kolejka = [korzen];
  while (kolejka.length) {
    const r = kolejka.shift();
    for (const z of zawiasy) {
      const dziecko = z.s1 === r ? z.s2 : z.s2 === r ? z.s1 : null;
      if (dziecko === null || T[dziecko]) continue;
      const zg = c.zgiecia[z.zgiecie];
      const A = F(naArk(z.a));
      const k = norm(odj(F(naArk(z.b)), A));
      const srodek = sciany[dziecko].reduce((a, q) => ({ x: a.x + q.x / sciany[dziecko].length, y: a.y + q.y / sciany[dziecko].length }), { x: 0, y: 0 });
      const sr = naT(T[r], F(naArk(srodek)));
      const W = obrotOs(naT(T[r], A), naR(T[r].R, k), 0.1);
      // Kierunek względem ściany-rodzica: „góra” – na stronę bez nadruku (lokalne +Y rodzica).
      const nGora = naR(T[r].R, [0, 1, 0]);
      const ruch = odj(naT(W, sr), sr);
      const znak = ruch[0] * nGora[0] + ruch[1] * nGora[1] + ruch[2] * nGora[2] >= 0 ? 1 : -1;
      const kat = (Math.PI - ((zg?.kat ?? 90) * Math.PI) / 180) * s;
      const kier = zg?.rodzaj === 'dolina' ? -1 : 1;
      T[dziecko] = zlozT(obrotOs(naT(T[r], A), naR(T[r].R, k), znak * kier * kat), T[r]);
      kolejka.push(dziecko);
    }
  }
  // Ściana punktu części: zawierająca go albo najbliższa po obwodzie (punkty na krawędziach i zgięciach).
  const sciana = (q) => {
    let best = 0; let d = Infinity;
    sciany.forEach((w, i) => { const o = wWielokacie(w, q) ? 0 : naObwodzie(w, q).odl; if (o < d) { d = o; best = i; } });
    return best;
  };
  const punkt = (q, i = sciana(q)) => naT(T[i] || T_JEDN, F(naArk(q)));
  const normalna = (q, i = sciana(q)) => naR((T[i] || T_JEDN).R, [0, -1, 0]); // strona z nadrukiem
  return { kar, S, Hs, c, sciany, zawiasy, T, naArk, punkt, normalna, sciana, otwory, odpady, pole: pola.reduce((a, b) => a + b, 0) };
}

// Miejsca par części (w układzie części): krawędzie z numerem, linie klejenia, pola (oś wzdłuż dłuższego boku),
// szczeliny. { para, rodzaj: 'krawedz' | 'linia', punkty, prosta }.
function miejscaPar(c) {
  const w = [];
  c.krawedzie.forEach((k, i) => { if (k.para && k.typ !== 'ciecie') w.push({ para: k.para, rodzaj: 'krawedz', punkty: [c.punkty[i], c.punkty[(i + 1) % c.punkty.length]], prosta: true, kat: k.kat }); });
  for (const l of c.linie || []) if (l.para) w.push({ para: l.para, rodzaj: 'linia', punkty: l.zamknieta ? [...l.punkty, l.punkty[0]] : l.punkty, prosta: liniaProsta(l) });
  for (const p of c.pola) {
    if (!p.para) continue;
    const r = rogiPola(p);
    const [a, b] = p.w >= p.h ? [[r[0], r[3]], [r[1], r[2]]] : [[r[0], r[1]], [r[3], r[2]]];
    const sr = (u, v) => ({ x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 });
    const dluzsze = p.w >= p.h ? [[r[0], r[1]], [r[3], r[2]]] : [[r[0], r[3]], [r[1], r[2]]];
    w.push({ para: p.para, rodzaj: 'linia', punkty: [sr(...a), sr(...b)], prosta: true, pole: true, krawedzie: dluzsze });
  }
  for (const z of c.szczeliny) if (z.para) w.push({ para: z.para, rodzaj: 'linia', punkty: [z.a, z.b], prosta: true });
  return w;
}

// Wielokąt z otworami → jeden wielokąt prosty (#298): każdy otwór dołączony „mostkiem” – od jego skrajnego
// wierzchołka do najbliższego widocznego wierzchołka obrysu i z powrotem. Dzielenie na trójkąty metodą uszu radzi
// sobie z takim zdwojonym mostkiem.
function zOtworami(zew, otwory) {
  const pole = (w) => poleWielokata(w);
  const tnie = (p1, p2, p3, p4) => {
    const o = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const d1 = o(p3, p4, p1); const d2 = o(p3, p4, p2); const d3 = o(p1, p2, p3); const d4 = o(p1, p2, p4);
    return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
  };
  let w = [...zew];
  const wszystkie = otwory.map((h) => (Math.sign(pole(h)) === Math.sign(pole(zew)) ? [...h].reverse() : [...h]));
  for (const h of [...wszystkie].sort((a, b) => Math.max(...b.map((q) => q.x)) - Math.max(...a.map((q) => q.x)))) {
    let hi = 0;
    h.forEach((q, i) => { if (q.x > h[hi].x) hi = i; });
    const H = h[hi];
    const krawedzie = (lista) => lista.map((q, i) => [q, lista[(i + 1) % lista.length]]);
    const przeszkody = [...krawedzie(w), ...wszystkie.flatMap(krawedzie)];
    const kandydaci = w.map((q, i) => ({ i, d: Math.hypot(q.x - H.x, q.y - H.y) })).sort((a, b) => a.d - b.d);
    const wid = kandydaci.find(({ i }) => !przeszkody.some(([a, b]) => tnie(H, w[i], a, b))) || kandydaci[0];
    const oi = wid.i;
    w = [...w.slice(0, oi + 1), ...h.slice(hi), ...h.slice(0, hi + 1), ...w.slice(oi)];
  }
  return w;
}

const skal3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sr3 = (a, b) => razy(dod(a, b), 0.5);
// Obrót wektora jednostkowego a na b (macierz).
function obrotNaWektor(a, b) {
  const v = wekt(a, b);
  const sn = Math.hypot(v[0], v[1], v[2]);
  const cs = skal3(a, b);
  if (sn < 1e-9) {
    if (cs > 0) return T_JEDN.R;
    const p = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return obrotOs([0, 0, 0], norm(wekt(a, p)), Math.PI).R;
  }
  return obrotOs([0, 0, 0], razy(v, 1 / sn), Math.atan2(sn, cs)).R;
}
// Część drogi od położenia na arkuszu do przekształcenia G (oś–kąt obrotu, środek części po prostej).
function czescDrogi(G, srodek, k) {
  if (k >= 1) return G;
  const R = G.R;
  const kat = Math.acos(ogr((R[0] + R[4] + R[8] - 1) / 2, -1, 1));
  let Rk = T_JEDN.R;
  if (kat > 1e-6) {
    let os = [R[7] - R[5], R[2] - R[6], R[3] - R[1]];
    if (Math.hypot(...os) < 1e-6) { // 180°: oś z kolumny R + I
      const kol = [0, 1, 2].map((i) => [R[i] + (i === 0 ? 1 : 0), R[3 + i] + (i === 1 ? 1 : 0), R[6 + i] + (i === 2 ? 1 : 0)]);
      os = kol.sort((a, b) => Math.hypot(...b) - Math.hypot(...a))[0];
    }
    Rk = obrotOs([0, 0, 0], norm(os), kat * k).R;
  }
  const cel = naT(G, srodek);
  const sk = dod(srodek, razy(odj(cel, srodek), k));
  return { R: Rk, t: odj(sk, naR(Rk, srodek)) };
}

// Sklejanie (#286, plan składanek krok 12): od największej części kolejne dochodzą po parach. Krawędź do prostej
// linii klejenia, pola albo szczeliny – część staje prostopadle po stronie nadruku; krawędź do krzywej linii – część
// wygina się wzdłuż niej (zawija); krawędź do krawędzi – obrót wokół wspólnej krawędzi dobrany tak, by pozostałe
// pary tej części trafiły na swoje miejsca, a bez nich – na płasko (jak przedłużenie). Zwraca per część
// { G } (sztywno) albo { mapa(q), normalna(q) } (wygięta); części bez połączeń zostają na arkuszu.
function sklejModel(geo) {
  const miejsca = geo.map((g) => (g ? miejscaPar(g.c) : []));
  const wynik = geo.map(() => null);
  const srodki = geo.map((g) => (g ? g.sciany.flatMap((w) => w.map((q) => g.punkt(q))).reduce((a, p, _, t) => dod(a, razy(p, 1 / t.length)), [0, 0, 0]) : null));
  // Położenie i normalna punktu części po sklejeniu.
  const pkt = (i, q) => (wynik[i].mapa ? wynik[i].mapa(q) : naT(wynik[i].G, geo[i].punkt(q)));
  const nrm = (i, q) => (wynik[i].normalna ? wynik[i].normalna(q) : naR(wynik[i].G.R, geo[i].normalna(q)));
  const srodekMiejsca = (m) => m.punkty[Math.floor((m.punkty.length - 1) / 2)];
  const kolejnosc = geo.map((g, i) => i).filter((i) => geo[i]).sort((a, b) => geo[b].pole - geo[a].pole);
  for (const start of kolejnosc) {
    if (wynik[start]) continue;
    wynik[start] = { G: T_JEDN };
    for (;;) {
      // Para: miejsce na części ułożonej (cel) i miejsce na nieułożonej (dokładana). Najpierw krawędzie dokładanej.
      let wybor = null;
      for (let a = 0; a < geo.length && !wybor; a += 1) {
        if (!wynik[a]) continue;
        for (const ma of miejsca[a]) {
          for (let b = 0; b < geo.length; b += 1) {
            if (wynik[b] || !geo[b]) continue;
            const mb = miejsca[b].find((x) => x.para === ma.para);
            if (mb && (!wybor || (mb.rodzaj === 'krawedz' && wybor.mb.rodzaj !== 'krawedz'))) wybor = { a, ma, b, mb };
          }
        }
      }
      if (!wybor) break;
      const { a, ma, b, mb } = wybor;
      const gb = geo[b];
      // Krawędź do krzywej linii – wygięcie wzdłuż krzywej.
      if (mb.rodzaj === 'krawedz' && ma.rodzaj === 'linia' && !ma.prosta) {
        const C = ma.punkty.map((q) => pkt(a, q));
        const N = ma.punkty.map((q) => nrm(a, q));
        const dl = [0];
        for (let j = 1; j < C.length; j += 1) dl.push(dl[j - 1] + Math.hypot(...odj(C[j], C[j - 1])));
        const Lc = dl.at(-1) || 1;
        const [E0, E1] = mb.punkty;
        const Lb = Math.hypot(E1.x - E0.x, E1.y - E0.y) || 1;
        // Układ krawędzi w części złożonej na arkuszu (#288): wzdłuż krawędzi (e3), w głąb ściany (n3) i normalna
        // nadruku ściany przy krawędzi (b3). Każdy punkt części (także za jej zgięciami) ma współrzędne (s, h, d) –
        // po wygięciu: punkt krzywej na długości s, h wzdłuż normalnej podstawy, d w poprzek krzywej. Zgięcia
        // doklejanej części zostają (np. daszek paska).
        const E0p = gb.punkt(E0);
        const e3 = norm(odj(gb.punkt(E1), E0p));
        const b3 = gb.normalna({ x: (E0.x + E1.x) / 2, y: (E0.y + E1.y) / 2 });
        let n3 = norm(wekt(b3, e3));
        const w2 = { x: -(E1.y - E0.y) / Lb, y: (E1.x - E0.x) / Lb };
        const srC = gb.c.punkty.reduce((acc, q) => ({ x: acc.x + q.x / gb.c.punkty.length, y: acc.y + q.y / gb.c.punkty.length }), { x: 0, y: 0 });
        const doSrodka = (srC.x - E0.x) * w2.x + (srC.y - E0.y) * w2.y >= 0 ? 1 : -1;
        const wglab = gb.punkt({ x: (E0.x + E1.x) / 2 + w2.x * doSrodka, y: (E0.y + E1.y) / 2 + w2.y * doSrodka });
        if (skal3(odj(wglab, E0p), n3) < 0) n3 = razy(n3, -1);
        const reka = Math.sign(skal3(wekt(e3, n3), b3)) || 1;
        const wzdluz = (sq0) => {
          const sq = ogr(sq0 * (Lc / Lb), 0, Lc);
          let j = 1;
          while (j < dl.length - 1 && dl[j] < sq) j += 1;
          const t = (sq - dl[j - 1]) / ((dl[j] - dl[j - 1]) || 1);
          const tau = norm(odj(C[j], C[j - 1]));
          const Nn = norm(dod(razy(N[j - 1], 1 - t), razy(N[j], t)));
          return { P: dod(C[j - 1], razy(odj(C[j], C[j - 1]), t)), Nn, tau, Bn: razy(norm(wekt(tau, Nn)), reka) };
        };
        const wsp = (v) => [skal3(v, e3), skal3(v, n3), skal3(v, b3)];
        wynik[b] = {
          mapa: (q) => { const [sq, h, d] = wsp(odj(gb.punkt(q), E0p)); const w = wzdluz(sq); return dod(dod(w.P, razy(w.Nn, h)), razy(w.Bn, d)); },
          normalna: (q) => {
            const [sq] = wsp(odj(gb.punkt(q), E0p));
            const w = wzdluz(sq);
            const [x, y, z] = wsp(gb.normalna(q));
            return norm(dod(dod(razy(w.tau, x), razy(w.Nn, y)), razy(w.Bn, z)));
          },
          wygieta: true,
        };
        continue;
      }
      // Sztywno: środek miejsca dokładanej na środek celu, kierunek wzdłuż celu, obrót wokół niego wybrany z ocen.
      const t0 = pkt(a, ma.punkty[0]);
      const t1 = pkt(a, ma.punkty.at(-1));
      const mt = pkt(a, srodekMiejsca(ma));
      const midT = sr3(t0, t1);
      const m0 = gb.punkt(mb.punkty[0]);
      const m1 = gb.punkt(mb.punkty.at(-1));
      const midM = sr3(m0, m1);
      const nA = nrm(a, srodekMiejsca(ma));
      const nB0 = gb.normalna(srodekMiejsca(mb));
      const inne = [];
      for (const x of miejsca[b]) {
        if (x === mb) continue;
        for (let o = 0; o < geo.length; o += 1) {
          if (!wynik[o]) continue;
          const y = miejsca[o].find((z) => z.para === x.para && !(o === a && z === ma));
          if (y) inne.push({ z: gb.punkt(srodekMiejsca(x)), cel: pkt(o, srodekMiejsca(y)) });
        }
      }
      const srA = wynik[a].G ? naT(wynik[a].G, srodki[a]) : mt;
      let best = null;
      for (const odwr of [true, false]) {
        const dirT = norm(odwr ? odj(t0, t1) : odj(t1, t0));
        const Ra = obrotNaWektor(norm(odj(m1, m0)), dirT);
        const T1 = { R: Ra, t: odj(midT, naR(Ra, midM)) };
        for (let st = 0; st < 72; st += 1) {
          const G = zlozT(obrotOs(midT, dirT, (st * Math.PI) / 36), T1);
          const nB = naR(G.R, nB0);
          const cB = naT(G, srodki[b]);
          let ocena = 0;
          for (const x of inne) ocena += Math.hypot(...odj(naT(G, x.z), x.cel)) * 4;
          if (ma.rodzaj === 'linia') ocena += 20 * Math.abs(skal3(nB, nA)) + (skal3(odj(cB, midT), nA) < 0 ? 30 : 0);
          else if (mb.rodzaj === 'linia') ocena += 20 * Math.abs(skal3(nB, nA)) + (skal3(odj(srA, midT), nB) < 0 ? 30 : 0);
          else if (!inne.length || Number.isFinite(mb.kat ?? ma.kat)) {
            // Kąt po sklejeniu (#288): ustawiony przy krawędzi albo 180° (na płasko); poniżej 180° – jak zgięcie „góra”:
            // doklejana część idzie na stronę bez nadruku części-celu.
            const kat = ((mb.kat ?? ma.kat ?? 180) * Math.PI) / 180;
            ocena += 20 * Math.abs(skal3(nB, nA) + Math.cos(kat)) + (Math.hypot(...odj(cB, srA)) < Math.hypot(...odj(midT, srA)) * 0.5 ? 30 : 0);
            if (kat < Math.PI - 0.01 && skal3(odj(cB, midT), nA) > 0.5) ocena += 30;
          }
          if (ma.rodzaj === 'krawedz' && mb.rodzaj === 'krawedz' && !odwr) ocena += 1;
          if (!best || ocena < best.ocena - 1e-9) best = { ocena, G };
        }
      }
      wynik[b] = { G: best.G };
    }
  }
  return wynik;
}

// ---------- Pop-up w ruchu (#299, plan składanek krok 19) ----------
// Kartka z grzbietem (zgięcie z `grzbiet: true`) i wszystko, co do niej doklejono (pary), to mechanizm: ściany każdej
// części są sztywne i obracają się na swoich zawiasach (drzewo ścian części; kąt każdego zawiasu – niewiadoma),
// doklejone części mają swobodne położenie (6 stopni swobody). Więzy: zamknięte pętle zawiasów w części (wycinanka –
// zawias spoza drzewa musi się zejść z obu stron) i pary klejenia (krawędź doklejanej części na swoim miejscu).
// Kąt grzbietu zadaje suwak; resztę liczy Levenberg–Marquardt, krok po kroku od kartki rozłożonej płasko
// (wszystko płasko – stan znany) do zadanego otwarcia. Wszystko w układzie arkusza „płasko” (geometriaCzesci z s = 0).
function obrotWektorem(v) {
  const kat = Math.hypot(v[0], v[1], v[2]);
  return kat < 1e-12 ? T_JEDN.R : obrotOs([0, 0, 0], razy(v, 1 / kat), kat).R;
}
function rozwiazLM(f, x0, { iter = 30, tol = 1e-9 } = {}) {
  let x = [...x0];
  let r = f(x);
  let koszt = r.reduce((a, v) => a + v * v, 0);
  let lam = 1e-3;
  for (let it = 0; it < iter && koszt > tol; it += 1) {
    const n = x.length;
    const J = [];
    for (let j = 0; j < n; j += 1) {
      const h = 1e-6;
      const xp = [...x]; xp[j] += h;
      const rp = f(xp);
      J.push(rp.map((v, i) => (v - r[i]) / h));
    }
    // (JᵀJ + λ diag) Δ = −Jᵀr
    const A = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (__, b) => J[a].reduce((acc, v, i) => acc + v * J[b][i], 0)));
    const g = Array.from({ length: n }, (_, a) => J[a].reduce((acc, v, i) => acc + v * r[i], 0));
    let poprawa = false;
    for (let proba = 0; proba < 8 && !poprawa; proba += 1) {
      const M = A.map((w, a) => w.map((v, b) => (a === b ? v + lam * (v + 1) : v)));
      const d = rozwiazUklad(M, g.map((v) => -v));
      if (!d) { lam *= 10; continue; }
      const xn = x.map((v, i) => v + d[i]);
      const rn = f(xn);
      const kn = rn.reduce((a, v) => a + v * v, 0);
      if (kn < koszt) { x = xn; r = rn; koszt = kn; lam = Math.max(1e-9, lam / 3); poprawa = true; } else lam *= 10;
    }
    if (!poprawa) break;
  }
  return { x, koszt };
}
function rozwiazUklad(M, b) {
  const n = b.length;
  const A = M.map((w, i) => [...w, b[i]]);
  for (let k = 0; k < n; k += 1) {
    let p = k;
    for (let i = k + 1; i < n; i += 1) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    if (Math.abs(A[p][k]) < 1e-14) return null;
    [A[k], A[p]] = [A[p], A[k]];
    for (let i = k + 1; i < n; i += 1) {
      const m = A[i][k] / A[k][k];
      for (let j = k; j <= n; j += 1) A[i][j] -= m * A[k][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let s = A[i][n];
    for (let j = i + 1; j < n; j += 1) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

// Mechanizm z części (geo – płaskie, s = 0). Zwraca null (brak grzbietu) albo { ustaw(katOtwarcia) → [per część:
// [T ściany]] | null }.
export function mechanizmPopup(geo) {
  const czesciGrzbietu = geo.map((g, i) => (g && g.c.zgiecia.some((z) => z.grzbiet) ? i : -1)).filter((i) => i >= 0);
  if (!czesciGrzbietu.length) return null;
  const korzen = czesciGrzbietu[0];
  // Składowa: części połączone parami z korzeniem.
  const miejsca = geo.map((g) => (g ? miejscaPar(g.c) : []));
  const wSkladowej = new Set([korzen]);
  for (let zmiana = true; zmiana;) {
    zmiana = false;
    geo.forEach((g, i) => {
      if (!g || wSkladowej.has(i)) return;
      if ([...wSkladowej].some((j) => miejsca[i].some((m) => miejsca[j].some((n) => n.para === m.para)))) { wSkladowej.add(i); zmiana = true; }
    });
  }
  const czesci = [...wSkladowej];
  // Drzewo ścian każdej części: od ściany przy grzbiecie (korzeń) albo największej.
  const drzewa = new Map();
  let grzbiet = null;
  for (const ic of czesci) {
    const g = geo[ic];
    const pola = g.sciany.map((w) => Math.abs(poleWielokata(w)));
    let start = pola.indexOf(Math.max(...pola));
    if (ic === korzen) {
      const zg = g.zawiasy.find((z) => g.c.zgiecia[z.zgiecie]?.grzbiet);
      if (zg) start = zg.s1;
    }
    const rodzic = new Map([[start, null]]);
    const kolejka = [start];
    const drzewo = [];
    while (kolejka.length) {
      const r = kolejka.shift();
      for (const z of g.zawiasy) {
        if (g.odpady.includes(z.s1) || g.odpady.includes(z.s2)) continue;
        const d = z.s1 === r ? z.s2 : z.s2 === r ? z.s1 : null;
        if (d === null || rodzic.has(d)) continue;
        rodzic.set(d, drzewo.length);
        drzewo.push({ z, od: r, do: d });
        kolejka.push(d);
      }
    }
    const pozaDrzewem = g.zawiasy.filter((z) => !drzewo.some((d) => d.z === z) && rodzic.has(z.s1) && rodzic.has(z.s2));
    drzewa.set(ic, { start, drzewo, pozaDrzewem });
    if (ic === korzen) {
      const k = drzewo.findIndex((d) => g.c.zgiecia[d.z.zgiecie]?.grzbiet);
      if (k >= 0) grzbiet = { ic, k };
    }
  }
  if (!grzbiet) return null;
  const zawGrzbietu = drzewa.get(grzbiet.ic).drzewo[grzbiet.k].z;
  const polowkaA = zawGrzbietu.s1;
  const polowkaB = zawGrzbietu.s2;
  // Zmienne: kąty zawiasów drzewa (bez grzbietu) i położenie (obrót + przesunięcie) części doklejonych.
  const indeks = [];
  for (const ic of czesci) drzewa.get(ic).drzewo.forEach((_, k) => { if (!(ic === grzbiet.ic && k === grzbiet.k)) indeks.push({ ic, k }); });
  const nZaw = indeks.length;
  const inne = czesci.filter((ic) => ic !== korzen);
  // Kierunek zawiasu „dodatni”: dziecko idzie na stronę nadruku (−y) przy dolinie, w drugą przy górze – jak przy
  // składaniu w miejscu (geometriaCzesci).
  const kierunek = (g, d) => {
    const A = g.punkt(d.z.a, d.od); const B = g.punkt(d.z.b, d.od);
    const os = norm(odj(B, A));
    const sr = g.sciany[d.do].reduce((a, q) => dod(a, razy(g.punkt(q, d.do), 1 / g.sciany[d.do].length)), [0, 0, 0]);
    const ruch = odj(naT(obrotOs(A, os, 0.1), sr), sr);
    const wDol = ruch[1] < 0 ? 1 : -1; // +kąt → ku −y
    const dolina = g.c.zgiecia[d.z.zgiecie]?.rodzaj === 'dolina';
    return dolina ? wDol : -wDol;
  };
  const transformy = (x, katGrzbietu, poczatek) => {
    const wynik = new Map();
    let iz = 0;
    const katy = new Map();
    for (const { ic, k } of indeks) katy.set(`${ic}|${k}`, x[iz++]);
    let ip = nZaw;
    for (const ic of czesci) {
      const g = geo[ic];
      const { start, drzewo } = drzewa.get(ic);
      let Tc = T_JEDN;
      if (ic !== korzen) {
        const p0 = poczatek.get(ic);
        const R = obrotWektorem([x[ip], x[ip + 1], x[ip + 2]]);
        const t = [x[ip + 3], x[ip + 4], x[ip + 5]];
        ip += 6;
        // Obrót wokół środka części w położeniu początkowym, potem przesunięcie.
        const Rc = { R, t: odj(p0.srodek, naR(R, p0.srodek)) };
        Tc = zlozT({ R: T_JEDN.R, t }, zlozT(Rc, p0.T));
      }
      const Tf = new Array(g.sciany.length).fill(null);
      Tf[start] = Tc;
      drzewo.forEach((d, k) => {
        const kat = ic === grzbiet.ic && k === grzbiet.k ? katGrzbietu : katy.get(`${ic}|${k}`);
        const A = g.punkt(d.z.a, d.od); const B = g.punkt(d.z.b, d.od);
        Tf[d.do] = zlozT(Tf[d.od], obrotOs(A, norm(odj(B, A)), kat * d.znak));
      });
      wynik.set(ic, Tf);
    }
    return wynik;
  };
  for (const ic of czesci) for (const d of drzewa.get(ic).drzewo) d.znak = kierunek(geo[ic], d);
  // Więzy par klejenia między częściami składowej (doklejana – ta z krawędzią).
  const wiezy = [];
  for (const ia of czesci) for (const ib of czesci) {
    if (ia === ib) continue;
    for (const mb of miejsca[ib]) {
      if (mb.rodzaj !== 'krawedz') continue;
      const ma = miejsca[ia].find((m) => m.para === mb.para && !(ia > ib && m.rodzaj === 'krawedz'));
      if (!ma) continue;
      wiezy.push({ ia, ib, ma, mb });
    }
  }
  for (const w of wiezy) if (!w.ma.pole) w.cel = w.ma.punkty.length > 2 ? [w.ma.punkty[0], w.ma.punkty.at(-1)] : w.ma.punkty;
  // Pole: krawędź zawiasu to dłuższy bok pola od strony ciała doklejanej części – ta leży między swoimi miejscami
  // klejenia, więc bok bliższy jej drugiego miejsca (zakładka leży na polu, po drugiej stronie). Gdy część ma tylko
  // jedno miejsce – bok bliższy zgięcia części docelowej. Wybór w położeniu płaskim, po ustawieniu części docelowych.
  const wybierzBokiPol = (ic, polozenie) => {
    const pary = wiezy.filter((w) => w.ib === ic && polozenie.has(w.ia));
    const srodekCelu = (w, k) => { const ga = geo[w.ia]; const T = polozenie.get(w.ia).T; const pts = k.map((q) => naT(T, ga.punkt(q))); return razy(dod(pts[0], pts[1]), 0.5); };
    for (const w of pary) {
      if (!w.ma.pole) continue;
      const [k1, k2] = w.ma.krawedzie;
      const inne2 = pary.filter((x) => x !== w).map((x) => srodekCelu(x, x.ma.pole ? x.ma.punkty : x.cel || x.ma.punkty));
      if (inne2.length) {
        const cel = inne2.reduce((a2, p) => dod(a2, razy(p, 1 / inne2.length)), [0, 0, 0]);
        w.cel = Math.hypot(...odj(srodekCelu(w, k1), cel)) <= Math.hypot(...odj(srodekCelu(w, k2), cel)) ? k1 : k2;
      } else {
        const g = geo[w.ia];
        const odl = (p) => Math.min(...g.c.zgiecia.map((z) => naObwodzie([z.a, z.b], p).odl), Infinity);
        const sr = (k) => ({ x: (k[0].x + k[1].x) / 2, y: (k[0].y + k[1].y) / 2 });
        w.cel = odl(sr(k1)) <= odl(sr(k2)) ? k1 : k2;
      }
    }
  };
  // Położenie początkowe części doklejonych: płasko na kartce (strona nadruku, −y), dopasowanie 2D krawędzi do celów.
  const poczatek = new Map([[korzen, { T: T_JEDN, srodek: [0, 0, 0] }]]);
  // Kolejno od kartki: część dostaje położenie, gdy któraś z jej części docelowych już je ma (druga warstwa na pasku).
  const kolejnosc = [];
  for (let zmiana = true; zmiana;) {
    zmiana = false;
    for (const ic of inne) {
      if (kolejnosc.includes(ic)) continue;
      if (wiezy.some((w) => w.ib === ic && (w.ia === korzen || kolejnosc.includes(w.ia)))) { kolejnosc.push(ic); zmiana = true; }
    }
  }
  for (const ic of inne) if (!kolejnosc.includes(ic)) kolejnosc.push(ic);
  for (const ic of kolejnosc) {
    const g = geo[ic];
    wybierzBokiPol(ic, poczatek);
    const pary = wiezy.filter((w) => w.ib === ic && poczatek.has(w.ia));
    const cele = [];
    for (const w of pary) {
      const ga = geo[w.ia];
      const c0 = w.cel.map((q) => naT(poczatek.get(w.ia).T, ga.punkt(q)));
      const b0 = w.mb.punkty.map((q) => g.punkt(q));
      cele.push({ b0, c0 });
    }
    if (!cele.length) { poczatek.set(ic, { T: T_JEDN, srodek: [0, 0, 0] }); continue; }
    // Najlepszy obrót w płaszczyźnie (x, z) i przesunięcie, z wyborem kierunku każdej krawędzi.
    let najlepszy = null;
    for (let maska = 0; maska < 1 << cele.length; maska += 1) {
      const pB = []; const pC = [];
      cele.forEach((c, i) => { const cc = maska & (1 << i) ? [c.c0[1], c.c0[0]] : c.c0; pB.push(...c.b0); pC.push(...cc); });
      const sb = pB.reduce((a, p) => dod(a, razy(p, 1 / pB.length)), [0, 0, 0]);
      const sc = pC.reduce((a, p) => dod(a, razy(p, 1 / pC.length)), [0, 0, 0]);
      let sxx = 0; let sxy = 0;
      pB.forEach((p, i) => { const a = odj(p, sb); const b = odj(pC[i], sc); sxx += a[0] * b[0] + a[2] * b[2]; sxy += a[0] * b[2] - a[2] * b[0]; });
      const kat = Math.atan2(sxy, sxx);
      const R = obrotOs([0, 0, 0], [0, -1, 0], kat).R;
      const t = odj(sc, naR(R, sb));
      const T = { R, t: dod(t, [0, -0.3 * (1 + kolejnosc.indexOf(ic)), 0]) };
      const blad = pB.reduce((a, p, i) => a + Math.hypot(...odj(naT(T, p), pC[i])), 0);
      if (!najlepszy || blad < najlepszy.blad) najlepszy = { T, blad, maska };
    }
    const srodek = naT(najlepszy.T, g.sciany.flatMap((w) => w.map((q) => g.punkt(q))).reduce((a, p, _, t2) => dod(a, razy(p, 1 / t2.length)), [0, 0, 0]));
    poczatek.set(ic, { T: najlepszy.T, srodek });
    cele.forEach((_, i) => { if (najlepszy.maska & (1 << i)) pary[i].odwrocone = true; });
  }
  const reszty = (x, katGrzbietu, prior) => {
    const Tm = transformy(x, katGrzbietu, poczatek);
    const r = [];
    for (const ic of czesci) {
      const g = geo[ic];
      for (const z of drzewa.get(ic).pozaDrzewem) {
        for (const q of [z.a, z.b]) {
          const p1 = naT(Tm.get(ic)[z.s1], g.punkt(q, z.s1));
          const p2 = naT(Tm.get(ic)[z.s2], g.punkt(q, z.s2));
          r.push(...odj(p1, p2));
        }
      }
    }
    for (const w of wiezy) {
      const ga = geo[w.ia]; const gb = geo[w.ib];
      const cel = w.odwrocone ? [w.cel[1], w.cel[0]] : w.cel;
      w.mb.punkty.forEach((q, i) => {
        const pb = naT(Tm.get(w.ib)[gb.sciana(q)], gb.punkt(q, gb.sciana(q)));
        const pa = naT(Tm.get(w.ia)[ga.sciana(cel[i])], ga.punkt(cel[i], ga.sciana(cel[i])));
        r.push(...razy(odj(pb, pa), 3));
      });
    }
    // Papier nie przenika papieru: wszystko poza połówkami kartki leży po stronie nadruku obu połówek (w środku
    // kąta otwarcia) – inaczej mechanizm może „wyskoczyć” na drugą stronę (druga gałąź rozwiązania).
    const gk = geo[korzen];
    const polowki = [polowkaA, polowkaB].map((i) => {
      const T = Tm.get(korzen)[i];
      return { p: naT(T, gk.punkt(gk.sciany[i][0], i)), n: naR(T.R, [0, -1, 0]) };
    });
    for (const ic of czesci) {
      const g = geo[ic];
      g.sciany.forEach((w, i) => {
        if (ic === korzen && (i === polowkaA || i === polowkaB)) return;
        if (g.odpady.includes(i)) return;
        for (const q of w) {
          const pp = naT(Tm.get(ic)[i], g.punkt(q, i));
          for (const pl of polowki) { const d = skal3(odj(pp, pl.p), pl.n); if (d < -0.05) r.push((d + 0.05) * 2); else r.push(0); }
        }
      });
    }
    // Słabe przyciąganie do poprzedniego kroku (ciągłość, wybór gałęzi rozwiązania).
    x.forEach((v, i) => r.push((v - prior[i]) * 0.02));
    return r;
  };
  const pamiec = new Map();
  return {
    czesci,
    koszt: 0,
    wiezy: wiezy.length,
    ustaw(katOtwarcia) {
      const kat = Math.round(ogr(katOtwarcia, 0, 180));
      if (pamiec.has(kat)) return pamiec.get(kat);
      let x = new Array(nZaw + 6 * inne.length).fill(0);
      let wynik = null;
      // Od rozłożonej płasko (180°) w krokach po 5°.
      for (let a = 180; a >= kat; a -= Math.min(5, Math.max(1, a - kat) || 5)) {
        const kg = ((180 - a) * Math.PI) / 180;
        // Przewidywanie: zawiasy drzewa ruszają się razem z grzbietem (mały krok w ich kierunku).
        const start = x.map((v, i) => (i < nZaw && Math.abs(v) < 1e-9 ? 0.02 : v));
        const { x: xn, koszt } = rozwiazLM((xx) => reszty(xx, kg, x), start, { iter: 25 });
        x = xn;
        this.koszt = koszt;
        this.x = x;
        wynik = transformy(x, kg, poczatek);
        if (a === kat) break;
      }
      pamiec.set(kat, wynik);
      return wynik;
    },
  };
}

function skladanka(quady, kartki, u, popup = 90) {
  const czesci = kartki[0]?.specjalna?.czesci || [];
  const s = gladko(ogr((u - 0.3) / 0.7, 0, 1));
  const k = gladko(ogr(u - 1, 0, 1)); // sklejanie (#286)
  const od = quady.length;
  const e = Math.max(0.15, kartki[0]?.d || 0.3);
  const geo = czesci.map((cz) => geometriaCzesci(cz, kartki, s));
  const sklejone = k > 0 ? sklejModel(geo) : null;
  // Pop-up w ruchu (#299): części mechanizmu (kartka z grzbietem i doklejone) – położenia ścian z rozwiązania.
  const geo0 = k > 0 ? czesci.map((cz) => geometriaCzesci(cz, kartki, 0)) : null;
  const mech = geo0 ? mechanizmPopup(geo0) : null;
  const Tm = mech ? mech.ustaw(popup) : null;
  if (Tm) for (const ic of mech.czesci) sklejone[ic] = { twarze: Tm.get(ic) };
  geo.forEach((g, ic) => {
    if (!g) return;
    const { S, Hs, kar } = g;
    const ul = sklejone?.[ic];
    const srodek = g.sciany.flatMap((w) => w.map((q) => g.punkt(q))).reduce((a, p, _, t) => dod(a, razy(p, 1 / t.length)), [0, 0, 0]);
    const Gk = ul?.G ? czescDrogi(ul.G, srodek, k) : null;
    // Punkt i normalna ściany (i) w chwili k.
    const P = (q, i) => {
      const p0 = g.punkt(q, i);
      if (ul?.twarze) return dod(razy(p0, 1 - k), razy(naT(ul.twarze[i] || T_JEDN, geo0[ic].punkt(q, i)), k));
      if (Gk) return naT(Gk, p0);
      if (ul?.mapa) return dod(razy(p0, 1 - k), razy(ul.mapa(q), k));
      return p0;
    };
    const Nrm = (q, i) => {
      const n0 = g.normalna(q, i);
      if (ul?.twarze) return norm(dod(razy(n0, 1 - k), razy(naR((ul.twarze[i] || T_JEDN).R, [0, -1, 0]), k)));
      if (Gk) return naR(Gk.R, n0);
      if (ul?.normalna) return norm(dod(razy(n0, 1 - k), razy(ul.normalna(q), k)));
      return n0;
    };
    const uvQ = (q) => { const [x, y] = g.naArk(q); return [ogr(x / S, 0, 1), ogr(y / Hs, 0, 1)]; };
    const trojkat = (q3, i) => {
      const pp = q3.map((q) => P(q, i));
      const nN = Nrm({ x: (q3[0].x + q3[1].x + q3[2].x) / 3, y: (q3[0].y + q3[1].y + q3[2].y) / 3 }, i);
      const uv = q3.map(uvQ);
      const [a, b, d] = [0, 1, 2];
      quad(quady, [a, b, d, d].map((j) => dod(pp[j], razy(nN, e / 2))), [a, b, d, d].map((j) => uv[j]), kar.przod || `kolor:${PAPIER}`, 'okladka', { n: nN, czesc: g.c.nr });
      quad(quady, [a, d, b, b].map((j) => dod(pp[j], razy(nN, -e / 2))), [a, d, b, b].map((j) => uv[j]), `kolor:${KARTON}`, 'tektura', { n: razy(nN, -1), czesc: g.c.nr });
    };
    // Wygięta część – trójkąty dzielone do ok. 3 mm, żeby szły za krzywą.
    const podziel = (q3, i, glebokosc = 0) => {
      const dl = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const boki = [dl(q3[0], q3[1]), dl(q3[1], q3[2]), dl(q3[2], q3[0])];
      const m = Math.max(...boki);
      if (!ul?.mapa || k === 0 || m <= 3 || glebokosc > 7) { trojkat(q3, i); return; }
      const j = boki.indexOf(m);
      const A = q3[j]; const B = q3[(j + 1) % 3]; const C = q3[(j + 2) % 3];
      const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      podziel([A, M, C], i, glebokosc + 1);
      podziel([M, B, C], i, glebokosc + 1);
    };
    g.sciany.forEach((w, i) => {
      if (g.odpady.includes(i)) return; // wycięty kawałek wypada (#298)
      const otw = g.otwory.filter((o) => o.sciana === i).map((o) => o.punkty);
      const ww = otw.length ? zOtworami(w, otw) : w;
      const pts = ww.map(g.naArk);
      for (const [a, b, d] of trojkatyWielokata(pts)) podziel([ww[a], ww[b], ww[d]], i);
    });
  });
  if (quady.length > od) obrocNaStol(quady, od, Math.PI * (1 - gladko(ogr(u / 0.3, 0, 1))));
}

// Bryła (czworokąty od indeksu od) obrócona o kąt wokół osi Z przez środek świata i postawiona na stole.
function obrocNaStol(quady, od, kat) {
  if (Math.abs(kat) > 1e-6) {
    const R = obrotOs([0, 0, 0], [0, 0, 1], kat);
    for (let i = od; i < quady.length; i += 1) {
      const q = quady[i];
      quady[i] = { ...q, p: q.p.map((v) => naT(R, v)), n: naR(R.R, q.n), nv: q.nv ? q.nv.map((v) => naR(R.R, v)) : q.nv };
    }
  }
  let min = Infinity;
  for (let i = od; i < quady.length; i += 1) for (const v of quady[i].p) min = Math.min(min, v[1]);
  for (let i = od; i < quady.length; i += 1) quady[i] = { ...quady[i], p: quady[i].p.map(([x, y, z]) => [x, y - min, z]) };
}

const strefa = (wynik, rodzaj) => wynik.strefy?.find((z) => z.rodzaj === rodzaj);
const rog = (z) => [[z.x1, z.y1], [z.x2, z.y1], [z.x2, z.y2], [z.x1, z.y2]];

// Koperta: przód (adres) – podstawa, klapki boczne, spód i klapa zamykająca na zawiasach. u 0 – przód do góry,
// 1 – tył (odwrócona), 2 – klapa otwarta.
function koperta(quady, kar, u) {
  const w = kar.specjalna.wynik;
  const fr = strefa(w, 'front');
  if (!fr) return;
  const { x1: x0, y1: y0, x2: xk, y2: yk } = fr;
  const W = xk - x0;
  const H = yk - y0;
  const b = w.wysokosc - yk;
  const sb = x0;
  const klapa = Math.PI * (1 - 0.8 * gladko(ogr(u - 1, 0, 1)));
  const panele = [
    { poly: rog(fr) },
    { poly: [[x0, y0], [x0, yk], [0, y0 + H * 0.86], [0, y0 + H * 0.14]], rodzic: 0, zawias: [[x0, y0], [x0, yk]], kat: Math.PI, warstwa: 1 },
    { poly: [[xk, yk], [xk, y0], [xk + sb, y0 + H * 0.14], [xk + sb, y0 + H * 0.86]], rodzic: 0, zawias: [[xk, y0], [xk, yk]], kat: Math.PI, warstwa: 1 },
    { poly: [[x0, yk], [xk, yk], [x0 + W * 0.93, yk + b], [x0 + W * 0.07, yk + b]], rodzic: 0, zawias: [[x0, yk], [xk, yk]], kat: Math.PI, warstwa: 2 },
    { poly: [[x0, y0], [x0 + W * 0.12, 0], [x0 + W * 0.88, 0], [xk, y0]], rodzic: 0, zawias: [[x0, y0], [xk, y0]], kat: klapa, warstwa: 3 },
  ];
  const od = quady.length;
  wykrojnik(quady, kar, panele, { e: 0.25 });
  // Przód do góry (u = 0): cała koperta obrócona wokół osi wzdłuż wysokości.
  obrocNaStol(quady, od, Math.PI * (1 - gladko(ogr(u, 0, 1))));
}

// Pudełko klapowe: dno na stole, ścianki, zakładka klejowa, klapki przeciwkurzowe, wieczko z językiem.
// u 0 – wykrojnik płasko (nadrukiem do góry), 1 – złożone pudełko: najpierw obrót arkusza, potem ścianki, wieczko.
function pudelko(quady, kar, u) {
  const w = kar.specjalna.wynik;
  const [pr, bl, ty, bp, wg, wd, kl] = ['przod', 'bok_l', 'tyl', 'bok_p', 'wieczko_g', 'wieczko_d', 'klej'].map((r) => strefa(w, r));
  if (!pr || !bl || !ty || !bp || !wg || !wd) return;
  const top = pr.y1;
  const d = pr.y2;
  const L = pr.x2 - pr.x1;
  const Wd = wd.y2 - wd.y1;
  const jez = Math.min(15, Wd * 0.6);
  const df = Math.min(Wd * 0.8, L * 0.45);
  const sc = gladko(ogr((u - 0.25) / 0.5, 0, 1)) * (Math.PI / 2);
  const kp = gladko(ogr((u - 0.6) / 0.25, 0, 1)) * (Math.PI / 2);
  const wk = gladko(ogr((u - 0.7) / 0.3, 0, 1)) * (Math.PI / 2);
  const panele = [
    { poly: rog(wd) }, // 0 dno
    { poly: rog(pr), rodzic: 0, zawias: [[pr.x1, d], [pr.x2, d]], kat: sc }, // 1 przód
    { poly: [[wd.x1, wd.y2], [wd.x2, wd.y2], [wd.x2 - 4, wd.y2 + jez], [wd.x1 + 4, wd.y2 + jez]], rodzic: 0, zawias: [[wd.x1, wd.y2], [wd.x2, wd.y2]], kat: sc }, // 2 język dna
    { poly: rog(bl), rodzic: 1, zawias: [[bl.x1, top], [bl.x1, d]], kat: sc }, // 3 bok
    { poly: rog(ty), rodzic: 3, zawias: [[ty.x1, top], [ty.x1, d]], kat: sc }, // 4 tył
    { poly: rog(bp), rodzic: 4, zawias: [[bp.x1, top], [bp.x1, d]], kat: sc }, // 5 bok
    { poly: rog(wg), rodzic: 4, zawias: [[wg.x1, top], [wg.x2, top]], kat: wk }, // 6 wieczko
    { poly: [[wg.x1, wg.y1], [wg.x2, wg.y1], [wg.x2 - 4, wg.y1 - jez], [wg.x1 + 4, wg.y1 - jez]], rodzic: 6, zawias: [[wg.x1, wg.y1], [wg.x2, wg.y1]], kat: wk }, // 7 język wieczka
    { poly: [[bl.x1, top], [bl.x2, top], [bl.x2 - 6, top - df], [bl.x1 + 2, top - df]], rodzic: 3, zawias: [[bl.x1, top], [bl.x2, top]], kat: kp }, // klapki przeciwkurzowe
    { poly: [[bp.x1, top], [bp.x2, top], [bp.x2 - 2, top - df], [bp.x1 + 6, top - df]], rodzic: 5, zawias: [[bp.x1, top], [bp.x2, top]], kat: kp },
    { poly: [[bl.x1, d], [bl.x2, d], [bl.x2 - 6, d + df], [bl.x1 + 2, d + df]], rodzic: 3, zawias: [[bl.x1, d], [bl.x2, d]], kat: sc, warstwa: 0.5 },
    { poly: [[bp.x1, d], [bp.x2, d], [bp.x2 - 2, d + df], [bp.x1 + 6, d + df]], rodzic: 5, zawias: [[bp.x1, d], [bp.x2, d]], kat: sc, warstwa: 0.5 },
  ];
  if (kl) panele.push({ poly: rog(kl), rodzic: 1, zawias: [[pr.x1, top], [pr.x1, d]], kat: sc, warstwa: 0.5 });
  const od = quady.length;
  wykrojnik(quady, kar, panele, { e: 0.45 });
  obrocNaStol(quady, od, Math.PI * (1 - gladko(ogr(u / 0.3, 0, 1))));
}

// Kalendarz trójdzielny na ścianie: plecy z tektury (cały arkusz – główka, tło kalendariów, pasek reklamowy),
// na nich trzy bloczki kalendariów (wydruk ze stref arkusza), czerwone okienko na środkowym, otwór na gwóźdź.
function trojdzielny(quady, kar) {
  const w = kar.specjalna.wynik;
  const W = kar.w;
  const Hc = kar.h;
  const d = kar.d;
  const tex = kar.przod || `kolor:${PAPIER}`;
  const P = (x, y, z) => [x - W / 2, Hc - y, z];
  const uv = (x, y) => [ogr(x / W, 0, 1), ogr(y / Hc, 0, 1)];
  const u0 = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const bryla = (x1, y1, x2, y2, z0, z1, texPrzod, matP, texBok, uvPrzod = true) => {
    quad(quady, [P(x1, y1, z1), P(x2, y1, z1), P(x2, y2, z1), P(x1, y2, z1)], uvPrzod ? [uv(x1, y1), uv(x2, y1), uv(x2, y2), uv(x1, y2)] : u0, texPrzod, matP, { n: [0, 0, 1] });
    quad(quady, [P(x1, y1, z1), P(x2, y1, z1), P(x2, y1, z0), P(x1, y1, z0)], u0, texBok, 'krawedz', { n: [0, 1, 0] });
    quad(quady, [P(x1, y2, z0), P(x2, y2, z0), P(x2, y2, z1), P(x1, y2, z1)], u0, texBok, 'krawedz', { n: [0, -1, 0] });
    quad(quady, [P(x1, y1, z0), P(x1, y2, z0), P(x1, y2, z1), P(x1, y1, z1)], u0, texBok, 'krawedz', { n: [-1, 0, 0] });
    quad(quady, [P(x2, y1, z1), P(x2, y2, z1), P(x2, y2, z0), P(x2, y1, z0)], u0, texBok, 'krawedz', { n: [1, 0, 0] });
  };
  bryla(0, 0, W, Hc, -d / 2, d / 2, tex, 'okladka', `kolor:${TEKTURA}`);
  quad(quady, [P(W, 0, -d / 2), P(0, 0, -d / 2), P(0, Hc, -d / 2), P(W, Hc, -d / 2)], u0, `kolor:${TEKTURA}`, 'tektura', { n: [0, 0, -1] });
  const gr = 3.2; // bloczek kalendarium (12 kartek)
  for (const z of (w.strefy || []).filter((s) => s.rodzaj.startsWith('kalendarium_'))) bryla(z.x1, z.y1, z.x2, z.y2, d / 2, d / 2 + gr, tex, 'papier', KRAWEDZ_KARTEK);
  const ok = strefa(w, 'okienko');
  if (ok) {
    const zf = d / 2 + gr + 0.3;
    const b = 2.4;
    const ramka = (x1, y1, x2, y2) => bryla(x1, y1, x2, y2, d / 2 + gr, zf, `kolor:${RAMKA_OKIENKA}`, 'okladka', `kolor:${RAMKA_OKIENKA}`, false);
    ramka(ok.x1 - b, ok.y1 - b, ok.x2 + b, ok.y1);
    ramka(ok.x1 - b, ok.y2, ok.x2 + b, ok.y2 + b);
    ramka(ok.x1 - b, ok.y1, ok.x1, ok.y2);
    ramka(ok.x2, ok.y1, ok.x2 + b, ok.y2);
  }
  // Otwór na gwóźdź (pośrodku główki, 8 mm od góry).
  const ro = 2.6;
  const zo = d / 2 + 0.03;
  for (let i = 0; i < 12; i += 1) {
    const a0 = (i / 12) * 2 * Math.PI;
    const a1 = ((i + 1) / 12) * 2 * Math.PI;
    const c = [W / 2, 8];
    quad(quady, [P(c[0], c[1], zo), P(c[0] + ro * Math.cos(a0), c[1] + ro * Math.sin(a0), zo), P(c[0] + ro * Math.cos(a1), c[1] + ro * Math.sin(a1), zo), P(c[0], c[1], zo)], u0, `kolor:${OTWOR}`, 'papier', { n: [0, 0, 1] });
  }
  quady.podloze = { typ: 'sciana', poziom: -d / 2 - 0.4 };
}

// ---------- Ustawienia sceny (#181) ----------

// Rozłożona książka zgięta wokół grzbietu: każda połowa podniesiona o th – kąt otwarcia π − 2·th.
function zegnij(quady, th) {
  if (!th) return;
  const obr = (a) => ([x, y, z]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
  for (let i = 0; i < quady.length; i += 1) {
    const q = quady[i];
    const p = q.p.map((v) => obr(th * ogr(v[0] / 4, -1, 1))(v));
    const R = obr(th * ogr(q.p.reduce((acc, v) => acc + v[0], 0) / 16, -1, 1));
    quady[i] = { ...q, p, n: R(q.n), nv: q.nv ? q.nv.map(R) : q.nv };
  }
}

// Kilka egzemplarzy (#181): obok siebie, w stosie albo przód i tył (drugi odwrócony wokół osi wzdłuż wysokości).
function powiel(quady, { n = 1, uklad = 'obok' } = {}) {
  const ile = uklad === 'przodTyl' ? 2 : ogr(Math.round(n), 1, 6);
  if (ile < 2 || !quady.length) return;
  const ob = obwiednia(quady);
  const dx = ob.max[0] - ob.min[0];
  const dy = ob.max[1] - ob.min[1];
  const [cx, cy, cz] = ob.srodek;
  const zrodlo = quady.slice();
  quady.length = 0;
  const obrY = (a) => ({
    p: ([x, y, z]) => [cx + (x - cx) * Math.cos(a) + (z - cz) * Math.sin(a), y, cz - (x - cx) * Math.sin(a) + (z - cz) * Math.cos(a)],
    n: ([x, y, z]) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)],
  });
  for (let k = 0; k < ile; k += 1) {
    let f;
    let fn;
    if (uklad === 'stos') {
      const r = obrY((((k * 37) % 11) - 5) * 0.018);
      const o = [(((k * 53) % 7) - 3) * 1.2, k * (dy + 0.04), (((k * 29) % 5) - 2) * 1.2];
      f = (v) => dod(r.p(v), o);
      fn = r.n;
    } else if (uklad === 'przodTyl' && k === 1) {
      f = ([x, y, z]) => [cx - (x - cx) + dx * 0.56, cy - (y - cy), z];
      fn = ([x, y, z]) => [-x, -y, z];
    } else {
      const sp = uklad === 'przodTyl' ? -dx * 0.56 : (k - (ile - 1) / 2) * dx * 1.1;
      const r = obrY(((k % 2) * 2 - 1) * 0.03);
      f = (v) => dod(r.p(v), [sp, 0, 0]);
      fn = r.n;
    }
    for (const q of zrodlo) quady.push({ ...q, p: q.p.map(f), n: fn(q.n), nv: q.nv ? q.nv.map(fn) : q.nv });
  }
  if (uklad === 'przodTyl') {
    // Odwrócony egzemplarz leży na stole tak samo jak pierwszy.
    let min = Infinity;
    const pol = quady.length / 2;
    for (let i = pol; i < quady.length; i += 1) for (const v of quady[i].p) min = Math.min(min, v[1]);
    for (let i = pol; i < quady.length; i += 1) quady[i] = { ...quady[i], p: quady[i].p.map(([x, y, z]) => [x, y - min + ob.min[1], z]) };
  }
}

// Scena modelu w położeniu u: lista czworokątów (współrzędne świata) i quady.podloze. Opcje (#181):
// otwarcie – kąt rozłożenia książki w stopniach (180 – płasko; domyślnie płasko na leżąco, ok. 110° na stojąco),
// wachlarz – ile kartek uniesionych wachlarzem, ilosc – { n, uklad: 'obok' | 'stos' | 'przodTyl' }.
export function scena(model, kartki, u = 0, { ulozenie = 'lezy', otwarcie = null, wachlarz = 0, ilosc = null, popup = null } = {}) {
  const quady = [];
  quady.podloze = { typ: 'stol', poziom: 0 };
  if (!kartki.length) return quady;
  if (model === 'kartka') kartkaNaStole(quady, kartki, u);
  else if (model.startsWith('kalendarz')) kalendarz(quady, model, kartki, u);
  else if (model === 'ulotka') ulotka(quady, kartki[0], u);
  else if (model === 'koperta') koperta(quady, kartki[0], u);
  else if (model === 'pudelko') pudelko(quady, kartki[0], u);
  else if (model === 'skladanka') skladanka(quady, kartki, u, popup ?? 90);
  else if (model === 'trojdzielny') trojdzielny(quady, kartki[0]);
  else ksiazka(quady, model, kartki, u, { wachlarz });
  const otwarta = mozeStac(model) && u > 0.02 && u < kartki.length - 0.02;
  const stoi = ulozenie === 'stoi' && mozeStac(model);
  const th = otwarta && Number.isFinite(otwarcie) ? (Math.PI - ogr(otwarcie, 60, 180) * (Math.PI / 180)) / 2 : (otwarta && stoi ? 0.62 : 0);
  if (stoi) postaw(quady, th);
  else if (th) { zegnij(quady, th); polozNaStole(quady); }
  if (ilosc && (ilosc.n > 1 || ilosc.uklad === 'przodTyl')) {
    const pod = quady.podloze;
    powiel(quady, ilosc);
    quady.podloze = pod;
  }
  return quady;
}

// Najniższy punkt sceny na stole (y = 0).
function polozNaStole(quady) {
  let min = Infinity;
  for (const q of quady) for (const v of q.p) min = Math.min(min, v[1]);
  for (let i = 0; i < quady.length; i += 1) quady[i] = { ...quady[i], p: quady[i].p.map(([x, y, z]) => [x, y - min, z]) };
}

// Książka leżąca (oś Y – grubość, Z – wysokość strony) → stojąca na stopce: wysokość strony w górę, grubość
// w głąb. Otwarta: obie połowy podniesione wokół grzbietu o th (V, domyślnie ok. 110°), potem postawiona.
function postaw(quady, th) {
  zegnij(quady, th);
  const stoj = ([x, y, z]) => [x, -z, y];
  for (let i = 0; i < quady.length; i += 1) {
    const q = quady[i];
    quady[i] = { ...q, p: q.p.map(stoj), n: stoj(q.n), nv: q.nv ? q.nv.map(stoj) : q.nv };
  }
  polozNaStole(quady);
  quady.podloze = { typ: 'stol', poziom: 0 };
}

// Prostopadłościan obejmujący scenę – środek i rozmiar dla kamery.
export function obwiednia(quady) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const q of quady) for (const p of q.p) for (let i = 0; i < 3; i += 1) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
  const srodek = min.map((v, i) => (v + max[i]) / 2);
  return { min, max, srodek, rozmiar: Math.max(...max.map((v, i) => v - min[i])), promien: Math.hypot(...max.map((v, i) => (v - min[i]) / 2)) };
}

// Ustawienia widoku dla modelu: kąty startowe i granice obracania (żeby nie zajrzeć pod stół ani za ścianę).
export function widokModelu(model, ulozenie = 'lezy') {
  if (ulozenie === 'stoi' && mozeStac(model)) return { obrotY: -0.42, obrotX: 0.2, minX: 0.02, maxX: 1.1, minY: -Infinity, maxY: Infinity };
  if (model === 'kalendarz_scienny' || model === 'trojdzielny') return { obrotY: -0.38, obrotX: 0.12, minX: -0.7, maxX: 0.95, minY: -1.25, maxY: 1.25 };
  if (model === 'kalendarz_biurkowy') return { obrotY: -0.5, obrotX: 0.3, minX: 0.04, maxX: 1.35, minY: -Infinity, maxY: Infinity };
  return { obrotY: -0.32, obrotX: 0.68, minX: 0.1, maxX: 1.5, minY: -Infinity, maxY: Infinity };
}

// ---------- Gotowe ujęcia (#181) ----------

// Ujęcie jednym przyciskiem: { nazwa, ikona, dla(model, kartki) – czy pasuje, ustaw(model, kartki) – stan }.
// Stan: { u, ulozenie, kamera: { obrotY, obrotX, zoom, fov }, scena: { otwarcie, wachlarz, ilosc }, opcje? }.
const ksiazkowy = (model) => model.startsWith('ksiazka') || model === 'notes';
const srodekKsiazki = (kartki) => Math.max(1, Math.round(kartki.length / 2));
const domyslnaScena = () => ({ otwarcie: null, wachlarz: 0, ilosc: null });
const katy = (w) => ({ obrotY: w.obrotY, obrotX: w.obrotX });
export const UJECIA = {
  przod: {
    nazwa: 'Przód', ikona: 'makieta', dla: () => true,
    ustaw: (model) => (mozeStac(model)
      ? { u: 0, ulozenie: 'stoi', kamera: { obrotY: 0, obrotX: 0.06, zoom: 1, fov: 22 }, scena: domyslnaScena() }
      : { u: 0, ulozenie: 'lezy', kamera: { obrotY: 0, obrotX: model.startsWith('kalendarz') || model === 'trojdzielny' ? 0.04 : 1.48, zoom: 1, fov: 22 }, scena: domyslnaScena() }),
  },
  trzyCzwarte: {
    nazwa: '¾ (klasyczne)', ikona: 'obroc', dla: () => true,
    ustaw: (model) => ({ u: 0, ulozenie: 'lezy', kamera: { ...katy(widokModelu(model)), obrotY: model === 'kalendarz_scienny' || model === 'trojdzielny' ? -0.55 : -0.62, zoom: 1, fov: 28 }, scena: domyslnaScena() }),
  },
  zGory: {
    nazwa: 'Z góry (płasko)', ikona: 'siatka', dla: (model) => !(model === 'kalendarz_scienny' || model === 'trojdzielny'),
    ustaw: () => ({ u: 0, ulozenie: 'lezy', kamera: { obrotY: 0, obrotX: 1.5, zoom: 1, fov: 24 }, scena: domyslnaScena() }),
  },
  grzbiet: {
    nazwa: 'Grzbiet', ikona: 'separator', dla: (model) => model.startsWith('ksiazka'),
    ustaw: () => ({ u: 0, ulozenie: 'stoi', kamera: { obrotY: 1.22, obrotX: 0.14, zoom: 1, fov: 26 }, scena: domyslnaScena() }),
  },
  stojaca: {
    nazwa: 'Stojąca', ikona: 'ksiazka', dla: (model) => mozeStac(model),
    ustaw: (model) => ({ u: 0, ulozenie: 'stoi', kamera: { ...katy(widokModelu(model, 'stoi')), zoom: 1, fov: 28 }, scena: domyslnaScena() }),
  },
  rozkladowka: {
    nazwa: 'Rozkładówka z góry', ikona: 'rozkladowka', dla: (model) => ksiazkowy(model),
    ustaw: (model, kartki) => ({ u: srodekKsiazki(kartki), ulozenie: 'lezy', kamera: { obrotY: 0, obrotX: 1.45, zoom: 1, fov: 24 }, scena: { ...domyslnaScena(), otwarcie: 172 } }),
  },
  wachlarz: {
    nazwa: 'Wachlarz kartek', ikona: 'warstwy', dla: (model) => model.startsWith('ksiazka'),
    ustaw: (model, kartki) => ({ u: srodekKsiazki(kartki), ulozenie: 'lezy', kamera: { obrotY: -0.5, obrotX: 0.5, zoom: 1, fov: 28 }, scena: { ...domyslnaScena(), wachlarz: 6 } }),
  },
  stos: {
    nazwa: 'Stos egzemplarzy', ikona: 'kopiuj', dla: (model) => !(model === 'kalendarz_scienny' || model === 'trojdzielny'),
    ustaw: () => ({ u: 0, ulozenie: 'lezy', kamera: { obrotY: -0.55, obrotX: 0.42, zoom: 1, fov: 28 }, scena: { ...domyslnaScena(), ilosc: { n: 3, uklad: 'stos' } } }),
  },
  przodTyl: {
    nazwa: 'Przód i tył', ikona: 'strony', dla: (model) => ksiazkowy(model) || model === 'kartka' || model === 'koperta' || model === 'ulotka',
    ustaw: () => ({ u: 0, ulozenie: 'lezy', kamera: { obrotY: 0, obrotX: 1.42, zoom: 1, fov: 24 }, scena: { ...domyslnaScena(), ilosc: { n: 2, uklad: 'przodTyl' } } }),
  },
  sciana: {
    nazwa: 'Na ścianie', ikona: 'kalendarz', dla: (model) => model === 'kalendarz_scienny' || model === 'trojdzielny',
    ustaw: () => ({ u: 0, ulozenie: 'lezy', kamera: { obrotY: -0.18, obrotX: 0.02, zoom: 0.82, fov: 30 }, scena: domyslnaScena(), opcje: { tlo: 'tynk', swiatlo: 'okno', silaCienia: 1.2 } }),
  },
};
export const ujeciaModelu = (model) => Object.keys(UJECIA).filter((id) => UJECIA[id].dla(model));

// ---------- WebGL ----------

const mnoz = (a, b) => {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) for (let w = 0; w < 4; w += 1) {
    let s = 0;
    for (let k = 0; k < 4; k += 1) s += a[k * 4 + w] * b[c * 4 + k];
    r[c * 4 + w] = s;
  }
  return r;
};
const perspektywa = (fov, asp, n, f) => {
  const t = 1 / Math.tan(fov / 2);
  return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
};
const orto = (r, n, f) => new Float32Array([1 / r, 0, 0, 0, 0, 1 / r, 0, 0, 0, 0, -2 / (f - n), 0, 0, 0, -(f + n) / (f - n), 1]);
const przesun = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const obrX = (a) => new Float32Array([1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1]);
const obrY = (a) => new Float32Array([Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]);
// Widok z punktu oko na cel (kamera patrzy wzdłuż −z).
const patrz = (oko, cel, gora) => {
  const z = norm(odj(oko, cel));
  let x = wekt(gora, z);
  if (Math.hypot(...x) < 1e-6) x = wekt([1, 0, 0], z);
  x = norm(x);
  const y = wekt(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -(x[0] * oko[0] + x[1] * oko[1] + x[2] * oko[2]), -(y[0] * oko[0] + y[1] * oko[1] + y[2] * oko[2]), -(z[0] * oko[0] + z[1] * oko[1] + z[2] * oko[2]), 1]);
};

const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
const PAKUJ = `vec4 pakuj(float d) { vec4 e = fract(d * vec4(1.0, 255.0, 65025.0, 16581375.0)); e -= e.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0); return e; }
float rozpakuj(vec4 c) { return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }
`;

// Przebieg głębokości (mapa cieni): głębokość z kamery światła spakowana w RGBA.
const VS_GL = `attribute vec3 a_p; uniform mat4 u_m; varying float v_d;
void main() { gl_Position = u_m * vec4(a_p, 1.0); v_d = gl_Position.z * 0.5 + 0.5; }`;
const FS_GL = `${PREC}${PAKUJ} varying float v_d; void main() { gl_FragColor = pakuj(clamp(v_d, 0.0, 0.99999)); }`;

// Obiekt: albedo z tekstury, światło kluczowe z cieniem (PCF), wypełniające, półkula otoczenia, AO,
// połysk zależny od materiału, przejście do sRGB.
const VS = `attribute vec3 a_p; attribute vec2 a_uv; attribute vec3 a_n; attribute float a_ao;
uniform mat4 u_rzut; uniform mat4 u_widok; varying vec2 v_uv; varying vec3 v_n; varying vec3 v_p; varying float v_ao;
void main() { gl_Position = u_rzut * u_widok * vec4(a_p, 1.0); v_uv = a_uv; v_n = a_n; v_p = a_p; v_ao = a_ao; }`;
const CIEN = `uniform sampler2D u_cien; uniform mat4 u_mCien; uniform float u_texel; uniform float u_bias;
float probka(vec2 uv, float d) { return d - u_bias > rozpakuj(texture2D(u_cien, uv)) ? 0.0 : 1.0; }
float cien(vec3 p, float promien) {
  vec4 q = u_mCien * vec4(p, 1.0); vec3 c = q.xyz / q.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  // Dysk Poissona obrócony losowo w każdym pikselu – drobne ziarno zamiast pasków przy cienkich drutach.
  float a = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  mat2 rot = mat2(cos(a), sin(a), -sin(a), cos(a)) * (promien * u_texel);
  float s = 0.0;
  s += probka(c.xy + rot * vec2(-0.94201624, -0.39906216), c.z);
  s += probka(c.xy + rot * vec2(0.94558609, -0.76890725), c.z);
  s += probka(c.xy + rot * vec2(-0.09418410, -0.92938870), c.z);
  s += probka(c.xy + rot * vec2(0.34495938, 0.29387760), c.z);
  s += probka(c.xy + rot * vec2(-0.91588581, 0.45771432), c.z);
  s += probka(c.xy + rot * vec2(-0.81544232, -0.87912464), c.z);
  s += probka(c.xy + rot * vec2(-0.38277543, 0.27676845), c.z);
  s += probka(c.xy + rot * vec2(0.97484398, 0.75648379), c.z);
  s += probka(c.xy + rot * vec2(0.44323325, -0.97511554), c.z);
  s += probka(c.xy + rot * vec2(0.53742981, -0.47373420), c.z);
  s += probka(c.xy + rot * vec2(-0.26496911, -0.41893023), c.z);
  s += probka(c.xy + rot * vec2(0.79197514, 0.19090188), c.z);
  s += probka(c.xy + rot * vec2(-0.24188840, 0.99706507), c.z);
  s += probka(c.xy + rot * vec2(-0.81409955, 0.91437590), c.z);
  s += probka(c.xy + rot * vec2(0.19984126, 0.78641367), c.z);
  s += probka(c.xy + rot * vec2(0.14383161, -0.14100790), c.z);
  return s / 16.0;
}
`;
const FS = `${PREC}${PAKUJ}${CIEN}
uniform sampler2D u_t; uniform vec3 u_L; uniform vec3 u_F; uniform vec3 u_oko; uniform vec4 u_mat; uniform float u_promien; uniform float u_przes; uniform vec3 u_spot; uniform float u_spotR;
uniform vec3 u_barwa; uniform float u_silaC; uniform vec3 u_tint; uniform sampler2D u_pol; uniform float u_maPol;
varying vec2 v_uv; varying vec3 v_n; varying vec3 v_p; varying float v_ao;
void main() {
  vec3 N = normalize(v_n); vec3 V = normalize(u_oko - v_p);
  if (dot(N, V) < 0.0) N = -N;
  vec4 t = texture2D(u_t, v_uv);
  vec3 a = pow(t.rgb, vec3(2.2)) * u_tint;
  float ndl = max(dot(N, u_L), 0.0);
  float sh = ndl > 0.0 ? mix(1.0, cien(v_p + N * u_przes, u_promien), u_silaC) : 0.0;
  float ndf = max(dot(N, u_F), 0.0);
  float hemi = mix(0.30, 0.50, N.y * 0.5 + 0.5);
  vec3 H = normalize(u_L + V);
  float ndh = max(dot(N, H), 0.0);
  float spec = u_mat.x * pow(ndh, u_mat.y) * sh * ndl;
  float fres = u_mat.z * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  // Uszlachetnienia (#181): maska z płyt projektu – folia (kolor metalu, alfa – pokrycie) błyszczy jak metal,
  // lakier UV (czarny w masce) – ostry, jasny odblask na matowym druku.
  vec3 dodatek = vec3(0.0);
  if (u_maPol > 0.5) {
    vec4 m = texture2D(u_pol, v_uv);
    if (m.a > 0.01) {
      float jasn = max(m.r, max(m.g, m.b));
      if (jasn > 0.06) {
        vec3 f = pow(m.rgb, vec3(2.2));
        a = mix(a, f * 0.28, m.a);
        float blysk = pow(ndh, 22.0) * 2.6 * sh * ndl + 0.22 * hemi + 0.5 * pow(1.0 - max(dot(N, V), 0.0), 2.0);
        dodatek += f * blysk * m.a * u_barwa;
      } else {
        dodatek += vec3(0.85 * pow(ndh, 180.0) * sh * ndl + 0.18 * pow(ndh, 12.0) * sh * ndl + 0.10 * pow(1.0 - max(dot(N, V), 0.0), 3.0) + 0.025) * m.a;
      }
    }
  }
  // Światło studyjne słabnie z odległością od miejsca, w które świeci (żywszy, nie płaski obraz).
  vec3 dp = v_p - u_spot; float spot = clamp(1.10 - 0.30 * dot(dp, dp) / (u_spotR * u_spotR), 0.72, 1.10);
  vec3 swiatlo = u_barwa * (0.70 * ndl * sh * spot) + vec3(0.92, 0.95, 1.0) * (0.16 * ndf) + vec3(hemi) * v_ao * mix(0.92, 1.04, spot - 0.72);
  vec3 c = a * swiatlo * u_mat.w + vec3(spec + fres * (0.35 + 0.65 * sh)) * u_barwa + dodatek;
  c = c / (1.0 + 0.08 * c);
  gl_FragColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;

// Podłoże: przezroczyste poza cieniem – przyciemnia tło (cień rzucany + miękki cień kontaktowy).
const VS_POD = `attribute vec3 a_p; uniform mat4 u_rzut; uniform mat4 u_widok; varying vec3 v_p;
void main() { gl_Position = u_rzut * u_widok * vec4(a_p, 1.0); v_p = a_p; }`;
const FS_POD = `${PREC}${PAKUJ}${CIEN}
uniform sampler2D u_kontakt; uniform mat4 u_mKontakt; uniform float u_kKrok; uniform float u_kZasieg; uniform vec3 u_srodek; uniform float u_R; uniform float u_Rob; uniform float u_sila;
uniform float u_wzor; uniform vec3 u_kol; uniform float u_sciana; uniform vec3 u_barwaP;
varying vec3 v_p;
// Podłoże z faktury (#181) – proceduralne, bez plików: drewno, papier, beton, marmur, tkanina, tynk.
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float szum(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { s += a * szum(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return s; }
vec3 faktura(vec2 q) {
  vec3 k = u_kol;
  if (u_wzor < 1.5) { // drewno: deski wzdłuż x, słoje, łączenia
    float deska = floor(q.y / 95.0);
    float g = fbm(vec2(q.x * 0.004, q.y * 0.06 + deska * 7.0));
    float sloje = 0.5 + 0.5 * sin(q.y * 0.09 + g * 9.0 + deska * 3.1);
    float laczenie = smoothstep(0.0, 1.2, abs(mod(q.y, 95.0))) * smoothstep(0.0, 1.2, 95.0 - mod(q.y, 95.0));
    return k * (0.80 + 0.16 * sloje + 0.10 * (hash(vec2(deska, 3.0)) - 0.5) + 0.08 * (fbm(q * 0.05) - 0.5)) * mix(0.62, 1.0, laczenie);
  }
  if (u_wzor < 2.5) return k * (0.965 + 0.05 * fbm(q * 0.35) + 0.02 * (szum(q * 2.2) - 0.5)); // papier: włókna
  if (u_wzor < 3.5) { // beton: plamy i pory
    float por = step(0.992, hash(floor(q * 1.6)));
    return k * (0.84 + 0.22 * fbm(q * 0.018) + 0.06 * (szum(q * 0.6) - 0.5)) * (1.0 - 0.25 * por);
  }
  if (u_wzor < 4.5) { // marmur: żyłki
    float z = abs(sin(q.x * 0.012 + q.y * 0.007 + fbm(q * 0.01) * 7.0));
    float zylka = pow(1.0 - z, 14.0) + 0.35 * pow(1.0 - abs(sin(q.x * 0.03 - q.y * 0.02 + fbm(q * 0.03) * 5.0)), 30.0);
    return mix(k * (0.96 + 0.05 * fbm(q * 0.02)), k * vec3(0.55, 0.56, 0.58), clamp(zylka, 0.0, 1.0) * 0.75);
  }
  if (u_wzor < 5.5) { // tkanina: splot płócienny i zgrubienia
    float s1 = 0.5 + 0.5 * sin(q.x * 3.4); float s2 = 0.5 + 0.5 * sin(q.y * 3.4);
    float splot = mix(s1, s2, step(0.5, fract(floor(q.x * 0.54) * 0.5 + floor(q.y * 0.54) * 0.5)));
    return k * (0.86 + 0.10 * splot + 0.08 * (fbm(q * vec2(0.08, 0.5)) - 0.5));
  }
  return k * (0.93 + 0.08 * fbm(q * 0.08) + 0.04 * (szum(q * 1.4) - 0.5)); // tynk
}
float kontakt(vec3 p) {
  vec4 q = u_mKontakt * vec4(p, 1.0); vec3 c = q.xyz / q.w * 0.5 + 0.5;
  float s = 0.0;
  float wsum = 0.0;
  for (int i = 0; i < 5; i++) for (int j = 0; j < 5; j++) {
    vec2 o = vec2(float(i) - 2.0, float(j) - 2.0);
    float wg = exp(-dot(o, o) / 4.5);
    float d = rozpakuj(texture2D(u_kontakt, c.xy + o * u_kKrok));
    float wys = max(c.z - d, 0.0) * u_kZasieg;
    s += (d < 0.9999 ? exp(-wys / 9.0) : 0.0) * wg;
    wsum += wg;
  }
  return s / wsum;
}
void main() {
  float sh = cien(v_p, u_R);
  float k = kontakt(v_p);
  float odl = length(v_p - u_srodek);
  float zanik = 1.0 - smoothstep(u_Rob * 1.3, u_Rob * 3.2, odl);
  float ciemn = (1.0 - sh) * 0.30 + k * 0.62;
  if (u_wzor < 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(ciemn * u_sila * zanik, 0.0, 0.85)); return; }
  // Faktura: nieprzezroczysta przy obiekcie, w oddali przechodzi w tło (jej średni kolor).
  vec2 q = u_sciana > 0.5 ? v_p.xy : v_p.xz;
  vec3 c = faktura(q) * u_barwaP * (1.0 - clamp(ciemn * u_sila, 0.0, 0.88));
  float daleko = 1.0 - smoothstep(u_Rob * 2.4, u_Rob * 6.0, odl);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), daleko);
}`;

// Tło studia: gradient (jaśniej u góry i w środku) – zapisuje się też w PNG.
const VS_TLO = `attribute vec2 a_p; varying vec2 v; void main() { v = a_p; gl_Position = vec4(a_p, 0.999, 1.0); }`;
const FS_TLO = `${PREC} uniform vec3 u_g; uniform vec3 u_d; uniform vec3 u_s; uniform float u_asp; varying vec2 v;
void main() {
  vec3 c = mix(u_d, u_g, smoothstep(-1.0, 1.0, v.y));
  float r = length(vec2(v.x * u_asp, v.y + 0.25) * vec2(0.55, 0.8));
  c = mix(u_s, c, smoothstep(0.0, 1.2, r));
  gl_FragColor = vec4(c, 1.0);
}`;

const MATERIALY = {
  // [połysk, wykładnik, fresnel, jasność]
  papier: [0.025, 12, 0.02, 1.0],
  krawedz: [0.01, 8, 0.0, 1.0],
  okladka: [0.10, 40, 0.05, 1.0],
  twarda: [0.22, 70, 0.10, 1.0],
  drut: [0.85, 45, 0.25, 1.0],
  tektura: [0.03, 10, 0.02, 1.0],
};
// Wykończenie okładki (#181) – zastępuje materiał okładki i twardej oprawy.
const WYKONCZENIA = {
  mat: [0.025, 8, 0.01, 0.97],
  blysk: [0.42, 110, 0.14, 1.0],
  soft: [0.012, 5, 0.0, 0.95],
};

const KOLORY_FAKTUR = { drewno: '#a77a52', papier: '#efe9dc', beton: '#a3a09a', marmur: '#eceae6', tkanina: '#5f6d7c', tynk: '#e9e4da' };
const WZORY = { drewno: 1, papier: 2, beton: 3, marmur: 4, tkanina: 5, tynk: 6 };

const POT = (v) => 2 ** Math.ceil(Math.log2(Math.max(1, v)));

// Tekstura krawędzi kartek: jasny papier z cienkimi liniami (po jednej na kartkę), powtarzalna.
function teksturaKrawedzi() {
  // Krawędzie kartek (#161): bez gęstych linii co kartkę (na telefonie dawały mory) – delikatny, losowy
  // szum w paskach co ok. 0,5 mm, niskiego kontrastu; mipmapy uśredniają go do jednolitego papieru z daleka.
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f1eee7';
  g.fillRect(0, 0, 64, 256);
  let ziarno = 7;
  const los = () => { ziarno = (ziarno * 16807) % 2147483647; return ziarno / 2147483647; };
  for (let y = 0; y < 256; y += 1) {
    const a = 0.025 + 0.05 * los();
    g.fillStyle = los() > 0.5 ? `rgba(110, 102, 88, ${a.toFixed(3)})` : `rgba(255, 255, 255, ${(a * 0.8).toFixed(3)})`;
    g.fillRect(0, y, 64, 1);
  }
  return c;
}

// Grzbiet bloku szytego (#161): 8 składek w powtórzeniu (u), każda zaokrąglona (jaśniej w środku), ciemna
// przerwa między nimi; nici – krótkie ciemne kreski w środku składki co ok. 24 mm (v).
function teksturaSkladek() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i += 1) {
    const gr = g.createLinearGradient(i * 16, 0, i * 16 + 16, 0);
    gr.addColorStop(0, '#cfc8bb');
    gr.addColorStop(0.5, '#f2efe8');
    gr.addColorStop(1, '#cfc8bb');
    g.fillStyle = gr;
    g.fillRect(i * 16, 0, 16, 64);
    g.fillStyle = 'rgba(70, 64, 55, 0.55)';
    g.fillRect(i * 16, 0, 1, 64);
    g.fillStyle = 'rgba(60, 55, 48, 0.8)';
    g.fillRect(i * 16 + 6, 26, 4, 12);
  }
  return c;
}

// Kapitałka: paski dwóch kolorów (jak tasiemka), z cieniem na brzegach.
function teksturaKapitalki() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = '#7d1f24';
  g.fillRect(0, 0, 32, 8);
  g.fillStyle = '#efe6d4';
  g.fillRect(16, 0, 16, 8);
  g.fillStyle = 'rgba(0, 0, 0, 0.25)';
  g.fillRect(0, 0, 32, 1);
  g.fillRect(0, 7, 32, 1);
  return c;
}

// Renderer na płótnie: ustawTeksture(klucz, obraz|płótno), maTeksture(klucz), rysuj(quady, kamera, opcje), zwolnij().
// kamera: { srodek, odleglosc, obrotY, obrotX }; opcje: { ciemny }. Zwraca null, gdy przeglądarka nie ma WebGL.
// Powód ostatniej porażki (#157) – okno pokazuje go w komunikacie zamiast samego „nie działa”.
export let powodBrakuWebGL = '';
export function utworzRenderer(plotno) {
  powodBrakuWebGL = '';
  const atr = { preserveDrawingBuffer: true, antialias: true, alpha: true, premultipliedAlpha: false }; // alfa – PNG z przezroczystym tłem (#181)
  // Powód podany przez przeglądarkę (np. karta graficzna na liście zablokowanych – częste na starszych Macach).
  let komunikatPrzegladarki = '';
  const naBlad = (e) => { komunikatPrzegladarki = e.statusMessage || ''; };
  plotno.addEventListener('webglcontextcreationerror', naBlad, { once: true });
  const gl = plotno.getContext('webgl', atr) || plotno.getContext('experimental-webgl', atr);
  plotno.removeEventListener('webglcontextcreationerror', naBlad);
  if (!gl) {
    powodBrakuWebGL = `przeglądarka nie udostępnia WebGL${komunikatPrzegladarki ? ` (${komunikatPrzegladarki.trim().slice(0, 160)})` : ''}`;
    return null;
  }
  if (gl.isContextLost()) { powodBrakuWebGL = 'kontekst grafiki został utracony'; return null; }
  const shader = (typ, zrodlo) => {
    const s = gl.createShader(typ);
    gl.shaderSource(s, zrodlo);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); console.error(log); powodBrakuWebGL ||= `karta graficzna nie skompilowała programu (${String(log).trim().slice(0, 160)})`; }
    return s;
  };
  const program = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { powodBrakuWebGL ||= `karta graficzna nie połączyła programu (${String(gl.getProgramInfoLog(p)).trim().slice(0, 160)})`; return null; }
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i += 1) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    const a = {};
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i += 1) { const nm = gl.getActiveAttrib(p, i).name; a[nm] = gl.getAttribLocation(p, nm); }
    return { p, u, a };
  };
  const P = { obiekt: program(VS, FS), glebia: program(VS_GL, FS_GL), podloze: program(VS_POD, FS_POD), tlo: program(VS_TLO, FS_TLO) };
  if (Object.values(P).some((x) => !x)) return null;
  const aniz = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  const maxAniz = aniz ? Math.min(8, gl.getParameter(aniz.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) : 0;
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const bufor = gl.createBuffer();
  const buforTla = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buforTla);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  const tekstury = new Map();
  const uzycie = new Map(); // klucz tekstury → numer ostatniego użycia (limit pamięci, #203)
  let licznikUzycia = 0;
  const nowaTekstura = (zrodlo, powtarzaj = false) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (typeof zrodlo === 'string') {
      const h = zrodlo.replace('#', '');
      const px = new Uint8Array([parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return t;
    }
    // Obraz strony: do rozmiaru potęgi dwójki (mipmapy – ostro i bez migotania z daleka). Proporcje strony
    // trzyma geometria (uv 0..1 na całą kartkę), więc przeskalowanie tekstury niczego nie rozciąga.
    let src = zrodlo;
    const W = Math.min(maxTex, 2048, POT(zrodlo.width));
    const H = Math.min(maxTex, 2048, POT(zrodlo.height));
    if (W !== zrodlo.width || H !== zrodlo.height) {
      src = document.createElement('canvas');
      src.width = W;
      src.height = H;
      const g = src.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(zrodlo, 0, 0, W, H);
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, powtarzaj ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, powtarzaj ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (aniz) gl.texParameterf(gl.TEXTURE_2D, aniz.TEXTURE_MAX_ANISOTROPY_EXT, maxAniz);
    return t;
  };
  const tekstura = (klucz) => {
    if (tekstury.has(klucz)) return tekstury.get(klucz);
    if (klucz.startsWith('kolor:')) { const t = nowaTekstura(klucz.slice(6)); tekstury.set(klucz, t); return t; }
    if (klucz === KRAWEDZ_KARTEK) { const t = nowaTekstura(teksturaKrawedzi(), true); tekstury.set(klucz, t); return t; }
    if (klucz === SKLADKI) { const t = nowaTekstura(teksturaSkladek(), true); tekstury.set(klucz, t); return t; }
    if (klucz === KAPITALKI) { const t = nowaTekstura(teksturaKapitalki(), true); tekstury.set(klucz, t); return t; }
    return tekstura(`kolor:${PAPIER}`);
  };
  // Mapy cieni (klucz – od światła, kontakt – prostopadle do podłoża).
  const mapa = (rozmiar) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, rozmiar, rozmiar, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, rozmiar, rozmiar);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { t, fb, rb, rozmiar };
  };
  const telefon = Math.min(window.screen?.width || 1200, window.screen?.height || 1200) < 600;
  const mapaKlucz = mapa(Math.min(maxTex, telefon ? 1024 : 2048));
  const mapaKontakt = mapa(Math.min(maxTex, 512));

  // Dane wierzchołków – liczone raz dla danej sceny (obracanie kamerą nie przelicza geometrii).
  let ostatnie = null;
  const wierzcholki = (quady) => {
    if (ostatnie?.quady === quady) return ostatnie.vb;
    const grupy = new Map();
    for (const q of quady) {
      const klucz = `${q.mat || 'papier'}|${q.tex}`;
      if (!grupy.has(klucz)) grupy.set(klucz, { tex: q.tex, mat: q.mat || 'papier', lista: [] });
      grupy.get(klucz).lista.push(q);
    }
    const wyniki = [];
    let razem = 0;
    for (const g of grupy.values()) razem += g.lista.length * 6;
    const dane = new Float32Array(razem * 9);
    let i = 0;
    for (const g of grupy.values()) {
      const od = i / 9;
      for (const q of g.lista) {
        for (const v of [0, 1, 2, 0, 2, 3]) {
          dane.set(q.p[v], i); dane.set(q.uv[v], i + 3); dane.set(q.nv ? q.nv[v] : q.n, i + 5); dane[i + 8] = q.ao ? q.ao[v] : 1;
          i += 9;
        }
      }
      wyniki.push({ tex: g.tex, mat: g.mat, od, ile: i / 9 - od });
    }
    const vb = { dane, grupy: wyniki };
    ostatnie = { quady, vb };
    return vb;
  };
  const atrybuty = (prog, tylkoPozycja = false) => {
    const a = prog.a;
    gl.enableVertexAttribArray(a.a_p); gl.vertexAttribPointer(a.a_p, 3, gl.FLOAT, false, 36, 0);
    if (tylkoPozycja) return;
    gl.enableVertexAttribArray(a.a_uv); gl.vertexAttribPointer(a.a_uv, 2, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(a.a_n); gl.vertexAttribPointer(a.a_n, 3, gl.FLOAT, false, 36, 20);
    gl.enableVertexAttribArray(a.a_ao); gl.vertexAttribPointer(a.a_ao, 1, gl.FLOAT, false, 36, 32);
  };
  const wylaczAtrybuty = () => { for (let i = 0; i < 4; i += 1) gl.disableVertexAttribArray(i); };

  return {
    gl,
    maTeksture: (klucz) => klucz.startsWith('kolor:') || klucz.startsWith('tex:') || tekstury.has(klucz),
    // Maska uszlachetnień tekstury (#181) – klucz „pol|<tekstura>”; null usuwa.
    ustawMaske(klucz, obraz) {
      const k = `pol|${klucz}`;
      const stara = tekstury.get(k);
      if (stara) gl.deleteTexture(stara);
      if (obraz) tekstury.set(k, nowaTekstura(obraz)); else tekstury.delete(k);
    },
    // Tekstury stron do wymiany (inna lista stron po zmianie rodzaju makiety).
    // wszystkie – także okładka i obwoluta (inny sposób rysowania uszlachetnień, #181).
    // Limit pamięci grafiki (#203): stron w pamięci najwyżej `max` – zostają potrzebne (widoczne, sąsiednie)
    // i ostatnio używane, reszta jest zwalniana (wróci, gdy znów będzie widać tę stronę). Bez tego kartkowanie
    // grubej książki trzymało każdą obejrzaną stronę i telefon zamykał kartę („Kurza twarz”).
    ileStron: () => [...tekstury.keys()].filter((k) => /^(pol\|)?p:/.test(k)).length,
    przytnijStrony(potrzebne, max) {
      const strony = [...tekstury.keys()].filter((k) => /^(pol\|)?p:/.test(k));
      if (strony.length <= max) return [];
      const usuniete = [];
      const doUsuniecia = strony.filter((k) => !potrzebne.has(k)).sort((a, b) => (uzycie.get(a) || 0) - (uzycie.get(b) || 0));
      for (const k of doUsuniecia) {
        if (strony.length - usuniete.length <= max) break;
        gl.deleteTexture(tekstury.get(k)); tekstury.delete(k); uzycie.delete(k); usuniete.push(k);
      }
      return usuniete;
    },
    zapomnijStrony(wszystkie = false) {
      const re = wszystkie ? /^(pol\|)?(p|okl|obw):/ : /^(pol\|)?p:/;
      for (const [klucz, t] of tekstury) if (re.test(klucz)) { gl.deleteTexture(t); tekstury.delete(klucz); }
    },
    ustawTeksture(klucz, obraz) {
      const stara = tekstury.get(klucz);
      if (stara) gl.deleteTexture(stara);
      tekstury.set(klucz, nowaTekstura(obraz));
    },
    rysuj(quady, kamera, opcjeRys = {}) {
      const ciemny = Boolean(opcjeRys.ciemny);
      const op = normalizujOpcje(opcjeRys);
      const W = plotno.width;
      const H = plotno.height;
      const asp = W / Math.max(1, H);
      const ob = obwiednia(quady);
      const R = Math.max(10, ob.promien);
      const podloze = quady.podloze || { typ: 'stol', poziom: 0 };
      const sciana = podloze.typ === 'sciana';
      // Światło: z lewej z góry, przed obiektem; obraca się razem z kamerą wokół osi pionowej
      // (zawsze dobrze oświetlony widok), wysokość stała.
      const az = -kamera.obrotY;
      const obrocY = ([x, y, z]) => [x * Math.cos(az) + z * Math.sin(az), y, -x * Math.sin(az) + z * Math.cos(az)];
      // Kierunek światła (#181): z lewej (domyślnie), z prawej, z góry albo nisko z boku jak z okna.
      const KIER = {
        lewo: sciana ? [-0.62, 0.62, 0.8] : [-0.74, 0.8, 0.6],
        prawo: sciana ? [0.62, 0.62, 0.8] : [0.74, 0.8, 0.6],
        gora: sciana ? [-0.08, 0.95, 0.55] : [-0.12, 1, 0.22],
        okno: sciana ? [-0.95, 0.3, 0.45] : [-0.95, 0.42, -0.15],
      };
      const L0 = KIER[op.swiatlo];
      const L = norm(obrocY(L0));
      const F = norm(obrocY(sciana ? [-L0[0] * 0.9, 0.2, 0.9] : [-L0[0] || 0.75, 0.45, 0.6]));
      const barwa = { neutralna: [1.0, 0.982, 0.955], ciepla: [1.0, 0.9, 0.76], zimna: [0.88, 0.94, 1.0] }[op.barwa];
      const miekko = 0.3 + 1.4 * op.miekkosc;
      const przezroczyste = op.tlo === 'przezroczyste';
      const wzor = WZORY[op.tlo] || 0;
      const c = kamera.srodek || ob.srodek;
      const vb = wierzcholki(quady);
      // Podłoże: duży prostokąt pod / za obiektem.
      const E = R * 6;
      const sr = ob.srodek;
      const pod = sciana
        ? [[sr[0] - E, sr[1] - E, podloze.poziom], [sr[0] + E, sr[1] - E, podloze.poziom], [sr[0] + E, sr[1] + E, podloze.poziom], [sr[0] - E, sr[1] + E, podloze.poziom]]
        : [[sr[0] - E, podloze.poziom - 0.02, sr[2] - E], [sr[0] + E, podloze.poziom - 0.02, sr[2] - E], [sr[0] + E, podloze.poziom - 0.02, sr[2] + E], [sr[0] - E, podloze.poziom - 0.02, sr[2] + E]];
      const daneP = new Float32Array([...pod[0], ...pod[1], ...pod[2], ...pod[0], ...pod[2], ...pod[3]]);

      // 1. Mapa cieni od światła (ortogonalna, objęta kula sceny).
      const Rc = R * 1.15;
      const mSw = mnoz(orto(Rc, 0.1, R * 4.2), patrz(dod(sr, razy(L, R * 2.1)), sr, sciana ? [0, 1, 0] : [0, 0, -1]));
      // 2. Mapa kontaktu: prostopadle do podłoża, z wysokości nad nim.
      const zasieg = R * 2.2;
      const okoK = sciana ? [sr[0], sr[1], podloze.poziom + zasieg] : [sr[0], podloze.poziom + zasieg, sr[2]];
      const celK = sciana ? [sr[0], sr[1], podloze.poziom] : [sr[0], podloze.poziom, sr[2]];
      const RK = R * 1.6;
      const mK = mnoz(orto(RK, 0.01, zasieg + 1), patrz(okoK, celK, sciana ? [0, 1, 0] : [0, 0, -1]));
      gl.useProgram(P.glebia.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufor);
      gl.bufferData(gl.ARRAY_BUFFER, vb.dane, gl.DYNAMIC_DRAW);
      atrybuty(P.glebia, true);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      for (const [m, mp] of [[mSw, mapaKlucz], [mK, mapaKontakt]]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, mp.fb);
        gl.viewport(0, 0, mp.rozmiar, mp.rozmiar);
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix4fv(P.glebia.u.u_m, false, m);
        gl.drawArrays(gl.TRIANGLES, 0, vb.dane.length / 9);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      wylaczAtrybuty();

      // 3. Tło: gradient studia, jednolity kolor, faktura (w oddali – jej przyciemniony kolor) albo przezroczyste.
      gl.viewport(0, 0, W, H);
      gl.disable(gl.DEPTH_TEST);
      const kol = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
      const kolFaktury = wzor ? kol(op.kolorTla !== DOMYSLNE_OPCJE.kolorTla ? op.kolorTla : KOLORY_FAKTUR[op.tlo]) : null;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!przezroczyste) {
        gl.useProgram(P.tlo.p);
        let g1; let d1; let s1;
        if (op.tlo === 'kolor') { const k = kol(op.kolorTla); g1 = k; d1 = k.map((v) => v * 0.9); s1 = k.map((v) => Math.min(1, v * 1.03)); }
        else if (wzor) { g1 = kolFaktury.map((v) => v * 0.8); d1 = kolFaktury.map((v) => v * 0.62); s1 = kolFaktury.map((v) => v * 0.86); }
        else [g1, d1, s1] = (ciemny ? ['#34363b', '#1c1d20', '#3d4045'] : ['#f2f0ec', '#d5d1c9', '#faf9f6']).map(kol);
        gl.uniform3fv(P.tlo.u.u_g, g1);
        gl.uniform3fv(P.tlo.u.u_d, d1);
        gl.uniform3fv(P.tlo.u.u_s, s1);
        gl.uniform1f(P.tlo.u.u_asp, asp);
        gl.bindBuffer(gl.ARRAY_BUFFER, buforTla);
        gl.enableVertexAttribArray(P.tlo.a.a_p);
        gl.vertexAttribPointer(P.tlo.a.a_p, 2, gl.FLOAT, false, 8, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        wylaczAtrybuty();
      }

      // Kamera.
      const fov = ((Number.isFinite(kamera.fov) ? kamera.fov : 28) * Math.PI) / 180;
      // Bliska płaszczyzna jak najdalej (#161): na telefonach bufor głębokości bywa 16-bitowy – przy bliskiej
      // płaszczyźnie za blisko kamery kartki, otwory i grzbiet migotały (z-fighting).
      const rzut = perspektywa(fov, asp, Math.max(1, kamera.odleglosc / 40, kamera.odleglosc - R * 2.2), kamera.odleglosc + R * 12);
      const widok = mnoz(przesun(0, 0, -kamera.odleglosc), mnoz(obrX(kamera.obrotX), mnoz(obrY(kamera.obrotY), przesun(-c[0], -c[1], -c[2]))));
      // Oko (do połysku): widok = Tz(−d) · Rx(a) · Ry(b) · T(−c), więc oko = c + Ry(−b) · Rx(−a) · (0, 0, d).
      const z0 = kamera.odleglosc * Math.cos(kamera.obrotX);
      const okoSw = [c[0] - z0 * Math.sin(kamera.obrotY), c[1] + kamera.odleglosc * Math.sin(kamera.obrotX), c[2] + z0 * Math.cos(kamera.obrotY)];

      // 4. Podłoże (cień) – przyciemnia tło.
      gl.enable(gl.BLEND);
      // Alfa sumuje się osobno – na przezroczystym tle cień zostaje półprzezroczysty w PNG.
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(P.podloze.p);
      const up = P.podloze.u;
      gl.uniformMatrix4fv(up.u_rzut, false, rzut);
      gl.uniformMatrix4fv(up.u_widok, false, widok);
      gl.uniformMatrix4fv(up.u_mCien, false, mSw);
      gl.uniformMatrix4fv(up.u_mKontakt, false, mK);
      const texelSw = (2 * Rc) / mapaKlucz.rozmiar; // mm na teksel mapy cieni
      gl.uniform1f(up.u_texel, 1 / mapaKlucz.rozmiar);
      gl.uniform1f(up.u_kKrok, 3.6 / (2 * RK));
      gl.uniform1f(up.u_kZasieg, zasieg + 1);
      gl.uniform1f(up.u_bias, 0.002);
      gl.uniform3fv(up.u_srodek, sr);
      gl.uniform1f(up.u_R, (5.5 * miekko) / texelSw);
      gl.uniform1f(up.u_Rob, R);
      gl.uniform1f(up.u_sila, (ciemny && !wzor && op.tlo !== 'kolor' ? 1.25 : 1.0) * op.silaCienia);
      gl.uniform1f(up.u_wzor, przezroczyste ? 0 : wzor);
      gl.uniform3fv(up.u_kol, kolFaktury || [1, 1, 1]);
      gl.uniform3fv(up.u_barwaP, barwa.map((v) => 0.9 + 0.1 * v / barwa[0]));
      gl.uniform1f(up.u_sciana, sciana ? 1 : 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mapaKlucz.t); gl.uniform1i(up.u_cien, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, mapaKontakt.t); gl.uniform1i(up.u_kontakt, 2);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufor);
      gl.bufferData(gl.ARRAY_BUFFER, daneP, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(P.podloze.a.a_p);
      gl.vertexAttribPointer(P.podloze.a.a_p, 3, gl.FLOAT, false, 12, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      wylaczAtrybuty();
      gl.disable(gl.BLEND);

      // 5. Obiekt.
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(P.obiekt.p);
      const uo = P.obiekt.u;
      gl.uniformMatrix4fv(uo.u_rzut, false, rzut);
      gl.uniformMatrix4fv(uo.u_widok, false, widok);
      gl.uniformMatrix4fv(uo.u_mCien, false, mSw);
      gl.uniform1f(uo.u_texel, 1 / mapaKlucz.rozmiar);
      gl.uniform1f(uo.u_bias, 0.0012);
      gl.uniform1f(uo.u_promien, Math.max(1.5, (0.9 * miekko) / texelSw));
      gl.uniform3fv(uo.u_barwa, barwa);
      gl.uniform1f(uo.u_silaC, Math.min(1, op.silaCienia));
      gl.uniform1i(uo.u_pol, 3);
      gl.uniform3fv(uo.u_spot, dod(sr, razy([L[0], 0, L[2]], R * 0.45)));
      gl.uniform1f(uo.u_spotR, R * 1.4);
      gl.uniform1f(uo.u_przes, Math.max(0.15, (2 * Rc) / mapaKlucz.rozmiar) * 1.2);
      gl.uniform3fv(uo.u_L, L);
      gl.uniform3fv(uo.u_F, F);
      gl.uniform3fv(uo.u_oko, okoSw);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mapaKlucz.t); gl.uniform1i(uo.u_cien, 1);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(uo.u_t, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufor);
      gl.bufferData(gl.ARRAY_BUFFER, vb.dane, gl.DYNAMIC_DRAW);
      atrybuty(P.obiekt);
      const kremowy = op.papier === 'kremowy';
      for (const g of vb.grupy) {
        const okl = g.mat === 'okladka' || g.mat === 'twarda';
        gl.uniform4fv(uo.u_mat, (okl && WYKONCZENIA[op.wykonczenie]) || MATERIALY[g.mat] || MATERIALY.papier);
        // Papier kremowy (#181): druk na kremowym – kartki i ich krawędzie lekko zabarwione.
        const kartka = (g.mat === 'papier' || g.mat === 'krawedz') && (g.tex.startsWith('p:') || g.tex.startsWith('tex:') || g.tex === `kolor:${PAPIER}`);
        gl.uniform3fv(uo.u_tint, kremowy && kartka ? [1.0, 0.955, 0.86] : [1, 1, 1]);
        let tex = g.tex;
        if (tex === `kolor:${DRUT}` && op.kolorSpirali !== DRUT) tex = `kolor:${op.kolorSpirali}`;
        if (tex === `kolor:${TEKTURA}` && op.kolorStojaka !== TEKTURA) tex = `kolor:${op.kolorStojaka}`;
        const maska = op.uszlachetnienia ? tekstury.get(`pol|${g.tex}`) : null;
        gl.uniform1f(uo.u_maPol, maska ? 1 : 0);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, maska || tekstura(`kolor:${PAPIER}`));
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tekstura(tex));
        uzycie.set(tex, ++licznikUzycia);
        gl.drawArrays(gl.TRIANGLES, g.od, g.ile);
      }
      wylaczAtrybuty();
    },
    // Zwalnia zasoby, ale nie sam kontekst (#157): płótno jest to samo przy każdym otwarciu okna, a utracony
    // kontekst wraca z getContext() jako martwy – drugie otwarcie makiety kończyło się „brak WebGL”.
    zwolnij() {
      for (const t of tekstury.values()) gl.deleteTexture(t);
      tekstury.clear();
      for (const m of [mapaKlucz, mapaKontakt]) { gl.deleteTexture(m.t); gl.deleteFramebuffer(m.fb); gl.deleteRenderbuffer(m.rb); }
      for (const x of Object.values(P)) gl.deleteProgram(x.p);
      gl.deleteBuffer(bufor);
      gl.deleteBuffer(buforTla);
    },
  };
}
