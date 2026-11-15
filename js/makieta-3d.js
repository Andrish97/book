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

export const MODELE = {
  ksiazka_miekka: 'Książka – miękka oprawa',
  ksiazka_twarda: 'Książka – twarda oprawa',
  notes: 'Notes na spirali',
  kalendarz_scienny: 'Kalendarz ścienny',
  kalendarz_biurkowy: 'Kalendarz biurkowy',
  kartka: 'Pojedyncza kartka',
};

const PAPIER = '#fbfaf7';
const KRAWEDZ_OKLADKI = '#e8e4dc';
const DRUT = '#2f3237';
const TEKTURA = '#a29a8d';
const OTWOR = '#6b675f';
export const KRAWEDZ_KARTEK = 'tex:krawedz';

// ---------- Kartki modelu ----------

// strony: liczba stron środka (w kolejności druku), format: { w, h } (mm), rozmiary: [{ w, h }] – rozmiar
// każdej strony (gdy sekcje mają różne formaty), okladka: { w, h, tektura } | null, kartka_mm: grubość kartki.
export function kartkiModelu(model, { strony, format, okladka = null, kartka_mm = 0.1, rozmiary = null }) {
  const d = Math.max(0.06, kartka_mm || 0.1);
  const wym = (i) => rozmiary?.[i] || format;
  const kartki = [];
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
  const { w, h } = wymiar(wym(0));
  const dOkl = twarda ? Math.max(1.5, okladka?.tektura || 2.5) : notes ? 0.6 : 0.3;
  // Twarda: tektura wystaje 3 mm poza środek z trzech stron. Miękka: okładka w rozmiarze środka.
  const wOkl = twarda ? Math.max(w + 3, okladka?.w || 0) : (okladka?.w && Math.abs(okladka.w - w) < 8 ? okladka.w : w);
  const hOkl = twarda ? Math.max(h + 6, okladka?.h || 0) : (okladka?.h && Math.abs(okladka.h - h) < 8 ? okladka.h : h);
  const zOkladka = Boolean(okladka) || twarda || notes;
  if (zOkladka) kartki.push({ przod: okladka ? 'okl:przod' : (strony ? 'p:0' : null), tyl: null, w: wOkl, h: hOkl, d: dOkl, kolor: KRAWEDZ_OKLADKI, okladka: true });
  // Bez sekcji okładki pierwsza strona jest okładką (miękka): środek zaczyna się od niej.
  const od = zOkladka && !okladka && strony ? 1 : 0;
  for (let i = od; i < strony; i += 2) kartki.push({ przod: `p:${i}`, tyl: i + 1 < strony ? `p:${i + 1}` : null, w, h, d, kolor: PAPIER });
  if (zOkladka) kartki.push({ przod: null, tyl: okladka ? 'okl:tyl' : null, w: wOkl, h: hOkl, d: dOkl, kolor: KRAWEDZ_OKLADKI, okladka: true });
  return kartki;
}
const wymiar = (r) => ({ w: Math.max(10, r.w), h: Math.max(10, r.h) });

// Ile położeń kartkowania ma model (u od 0 do tej liczby).
export const polozenia = (model, kartki) => (model === 'kartka' ? Math.max(1, kartki.length * 2 - 1) : kartki.length);

// Opis położenia dla człowieka – „Okładka”, „Strony 2–3”, „Strona 5 z 13”…
export function opisPolozenia(model, kartki, u) {
  const t = Math.round(u);
  if (model === 'kartka') {
    const k = kartki[Math.floor(t / 2)];
    const klucz = t % 2 ? k?.tyl : k?.przod;
    return klucz ? `Strona ${Number(klucz.slice(2)) + 1}` : 'Tył kartki (pusty)';
  }
  if (model.startsWith('kalendarz')) return `Karta ${Math.min(t + 1, kartki.length)} z ${kartki.length}`;
  if (t === 0) return 'Okładka';
  if (t >= kartki.length) return 'Tył okładki';
  const nr = (klucz) => (klucz?.startsWith('p:') ? Number(klucz.slice(2)) + 1 : null);
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
  let pom = [0, 0, 1];
  const ramki = punkty.map((_, i) => {
    const t = styczna(i);
    if (Math.abs(t[0] * pom[0] + t[1] * pom[1] + t[2] * pom[2]) > 0.9) pom = [1, 0, 0];
    const b1 = norm(wekt(t, pom));
    const b2 = wekt(t, b1);
    pom = b2;
    return [b1, b2];
  });
  const K = 6;
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
function arkusz(quady, krzywa, h, d, { texA, texB, uA, uB, mat, krawedz, matKrawedzi, aoA, aoB, T = naStol, krawedzieUv = null, bezKrawedzi = false, odY = -h / 2, doY = h / 2 }) {
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
  const v = (y) => (h / 2 - y) / h;
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
function blok(quady, { strona, w, h, z0, wierzch, texWierzch, texSpod, aoX, grzbietowa = false }) {
  const N = 34;
  const xs = (i) => w * (i / N) ** 1.35; // gęściej przy grzbiecie, gdzie kartki się wyginają
  const X = (x) => x * strona;
  const uWierzch = (x) => (strona > 0 ? x / w : 1 - x / w);
  const nachyl = (x) => { const e = Math.max(0.05, w / 400); return (wierzch(Math.min(w, x + e)) - wierzch(Math.max(0, x - e))) / (Math.min(w, x + e) - Math.max(0, x - e)); };
  const v = (y) => (h / 2 - y) / h;
  // Wierzch – wierzchnia strona.
  siatka(quady, N, 3, (i, j) => {
    const x = xs(i);
    const y = lerp(h / 2, -h / 2, j / 3);
    const k = nachyl(x) * strona;
    return { p: naStol([X(x), y, wierzch(x)]), n: naStol(norm([-k, 0, 1])), uv: [uWierzch(x), v(y)], ao: aoX ? aoX(x) : 1 };
  }, texWierzch || `kolor:${PAPIER}`, 'papier');
  // Spód (płaski) – widoczny tylko od dołu.
  const uS = (x) => (strona > 0 ? 1 - x / w : x / w);
  quad(quady, [naStol([X(0), -h / 2, z0]), naStol([X(w), -h / 2, z0]), naStol([X(w), h / 2, z0]), naStol([X(0), h / 2, z0])],
    [[uS(0), 1], [uS(w), 1], [uS(w), 0], [uS(0), 0]], texSpod || `kolor:${PAPIER}`, 'papier', { n: [0, -1, 0] });
  // Krawędzie kartek: przednia (x = w) i głowa/stopa (y = ±h/2) – tekstura z liniami (jedna linia na kartkę).
  const vk = (z) => (z - z0) / 0.1 / 128;
  const zt = wierzch(w);
  quad(quady, [naStol([X(w), h / 2, zt]), naStol([X(w), h / 2, z0]), naStol([X(w), -h / 2, z0]), naStol([X(w), -h / 2, zt])],
    [[0, vk(zt)], [0, vk(z0)], [h / 40, vk(z0)], [h / 40, vk(zt)]], KRAWEDZ_KARTEK, 'krawedz', { n: naStol([strona, 0, 0]) });
  for (const [y, sg] of [[h / 2, 1], [-h / 2, -1]]) {
    for (let i = 0; i < N; i += 1) {
      const xa = xs(i);
      const xb = xs(i + 1);
      quad(quady, [naStol([X(xa), y, wierzch(xa)]), naStol([X(xb), y, wierzch(xb)]), naStol([X(xb), y, z0]), naStol([X(xa), y, z0])],
        [[xa / 40, vk(wierzch(xa))], [xb / 40, vk(wierzch(xb))], [xb / 40, vk(z0)], [xa / 40, vk(z0)]], KRAWEDZ_KARTEK, 'krawedz', { n: naStol([0, sg, 0]) });
    }
  }
  // Klejony grzbiet bloku – widać go, gdy obok leży tylko okładka.
  if (grzbietowa) {
    const z1 = wierzch(0);
    if (z1 - z0 > 0.05) quad(quady, [naStol([0, -h / 2, z1]), naStol([0, -h / 2, z0]), naStol([0, h / 2, z0]), naStol([0, h / 2, z1])],
      [[0, vk(z1)], [0, vk(z0)], [h / 40, vk(z0)], [h / 40, vk(z1)]], KRAWEDZ_KARTEK, 'krawedz', { n: naStol([-strona, 0, 0]) });
  }
}

// Arkusz kartki albo okładki na krzywej, z teksturami przodu i tyłu jak w książce: przód z u = σ/L, tył
// z u = 1 − σ/L (σ – odległość od grzbietu). Okładka ma brzegi w kolorze swojej krawędzi.
function lisc(quady, kar, krzywa, mat) {
  const L = kar.w;
  const brzeg = kar.przod || kar.tyl;
  const okl = kar.okladka && brzeg;
  // Twarda oprawa: rowek przy grzbiecie (zawias) – lekki cień 7–8 mm od krawędzi.
  const rowek = mat === 'twarda' ? (sg) => 1 - 0.3 * Math.exp(-(((sg - 7.5) / 1.4) ** 2)) : null;
  arkusz(quady, krzywa, kar.h, kar.d, {
    aoA: rowek, aoB: rowek,
    texA: kar.przod || `kolor:${PAPIER}`, texB: kar.tyl || `kolor:${PAPIER}`,
    uA: (sg) => sg / L, uB: (sg) => 1 - sg / L, mat,
    krawedz: okl ? brzeg : `kolor:${kar.okladka ? KRAWEDZ_OKLADKI : PAPIER}`,
    krawedzieUv: okl ? (sg, g) => [ogr(kar.przod ? sg / L : 1 - sg / L, 0.004, 0.996), g ? 0.996 : 0.004] : null,
  });
}

function ksiazka(quady, model, kartki, u) {
  const n = kartki.length;
  const twarda = model === 'ksiazka_twarda';
  const k = Math.floor(u + 1e-9);
  const ulamek = u - k;
  const s = ulamek > 1e-6 ? gladko(Math.min(1, ulamek)) : 0;
  const obr = ulamek > 1e-6 && k < n ? k : null;
  const lewe = [];
  const prawe = [];
  for (let j = 0; j < n; j += 1) if (j !== obr) (j < k ? lewe : prawe).push(j);
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
    const szczyt = b.z0 + b.H + B;
    const zv = Math.min(dolina, b.z0 + b.H);
    return (x) => zv + (szczyt - zv) * (1 - Math.exp(-x / rg)) - B * (x / w) ** 1.6;
  };
  const pL = profil(SL);
  const pP = profil(SP);
  const otwarta = lewe.length > 0 && prawe.length > 0;

  for (const S of [SL, SP]) {
    const strona = S.strona;
    S.czesci.forEach((c, ic) => {
      if (c.okladka) {
        const kar = kartki[c.kartki[0]];
        const krzywa = krzywaZKata([0, c.z0 + kar.d / 2], kar.w, () => (strona > 0 ? 0 : Math.PI), 2);
        lisc(quady, kar, krzywa, matOkl);
        return;
      }
      const p = strona > 0 ? pP : pL;
      const przykryty = ic < S.czesci.length - 1; // okładka na wierzchu – książka zamknięta
      blok(quady, {
        strona, w, h, z0: c.z0, wierzch: p,
        // Wierzch: po prawej przód najwyższej kartki (najmniejszy numer), po lewej tył ostatnio przewróconej.
        texWierzch: przykryty ? null : (strona > 0 ? kartki[Math.min(...c.kartki)].przod : kartki[Math.max(...c.kartki)].tyl),
        texSpod: strona > 0 ? kartki[Math.max(...c.kartki)].tyl : kartki[Math.min(...c.kartki)].przod,
        aoX: rozlozona ? (x) => 1 - 0.45 * Math.exp(-x / (rg * 0.5)) : null,
        grzbietowa: !rozlozona && otwarta,
      });
    });
  }

  // Przewracana kartka: od osi przy grzbiecie, wygięta – zewnętrzna część zostaje w tyle; na początku
  // i końcu dopasowana do kształtu stosu, na który się kładzie.
  const przyGrzbiecie = (S, p) => (S.czesci.length && !S.czesci.at(-1).okladka && p ? p(0) : S.wysokosc);
  let zawiasPrzod = null;
  let zawiasTyl = null;
  if (obr !== null) {
    const kar = kartki[obr];
    const sztywna = kar.okladka && twarda;
    const wygiecie = kar.okladka ? (twarda ? 0 : 0.2) : 0.8;
    const z0 = lerp(przyGrzbiecie(SP, pP), przyGrzbiecie(SL, pL), s) + kar.d / 2;
    const kat = (p) => (p && rozlozona ? (t) => Math.atan((p(Math.min(w, t * w + 0.5)) - p(Math.max(0, t * w - 0.5))) / (Math.min(w, t * w + 0.5) - Math.max(0, t * w - 0.5))) : () => 0);
    const kP = kat(pP);
    const kL = kat(pL);
    const fi = (t) => Math.PI * s - (sztywna ? 0 : wygiecie * Math.sin(Math.PI * s) * t ** 1.3) + (1 - s) * kP(t) - s * kL(t);
    const krzywa = krzywaZKata([0, z0], kar.w, fi, sztywna ? 2 : 30);
    lisc(quady, kar, krzywa, kar.okladka ? matOkl : 'papier');
    const nn = [-Math.sin(krzywa.fi[0]), Math.cos(krzywa.fi[0])];
    const zew = (sg) => [krzywa.c[0][0] + (sg * nn[0] * kar.d) / 2, krzywa.c[0][1] + (sg * nn[1] * kar.d) / 2];
    if (obr === 0) zawiasPrzod = zew(1);
    if (obr === n - 1) zawiasTyl = zew(-1);
  }

  // Grzbiet okładki: od zawiasu przedniej okładki do zawiasu tylnej, wypukły na zewnątrz (twarda –
  // zaokrąglony, miękka – płaski z zaokrąglonymi brzegami). Blok pod nim nie ma osobnej ściany (bez migotania).
  if (kartki[0].okladka && kartki[n - 1].okladka) {
    const A = zawiasPrzod || (lewe.includes(0) ? [0, 0] : [0, SP.wysokosc]);
    const Bp = zawiasTyl || (lewe.includes(n - 1) ? [0, SL.wysokosc] : [0, 0]);
    let zamkniecie = 0;
    if (obr === 0) zamkniecie = 1 - s;
    else if (obr === n - 1) zamkniecie = s;
    else if (!otwarta && obr === null) zamkniecie = 1;
    const dl = Math.hypot(A[0] - Bp[0], A[1] - Bp[1]);
    if (dl > 0.3 && zamkniecie > 0.02) {
      const kar = kartki[0];
      const rx = (twarda ? Math.min(0.26 * T + 0.8, T / 2) : Math.min(0.9, 0.12 * T + 0.2)) * zamkniecie;
      const strona = prawe.length || obr !== null ? -1 : 1;
      const N = 18;
      const kszt = (t) => (twarda ? Math.sin(Math.PI * t) ** 0.8 : Math.min(1, 2.2 * Math.sin(Math.PI * t)));
      const pkt = (t) => [lerp(A[0], Bp[0], t) + strona * rx * kszt(t), lerp(A[1], Bp[1], t)];
      const hk = kar.h;
      const texG = kar.przod?.startsWith('okl') ? 'okl:grzbiet' : (kar.przod || `kolor:${KRAWEDZ_OKLADKI}`);
      const uvG = (t, y) => (texG === 'okl:grzbiet' ? [1 - t, (hk / 2 - y) / hk] : [0.004, (hk / 2 - y) / hk]);
      const nrm = (t) => {
        const e = 0.01;
        const a = pkt(Math.max(0, t - e));
        const b = pkt(Math.min(1, t + e));
        let nn = norm([b[1] - a[1], 0, -(b[0] - a[0])]);
        if (nn[0] * strona < 0) nn = razy(nn, -1);
        return naStol([nn[0], 0, nn[2]]);
      };
      siatka(quady, N, 2, (i, j) => {
        const t = i / N;
        const y = lerp(hk / 2, -hk / 2, j / 2);
        const [x, z] = pkt(t);
        return { p: naStol([x, y, z]), n: nrm(t), uv: uvG(t, y) };
      }, texG, matOkl, { grzbiet: true });
      // Zaślepki grzbietu na głowie i stopie (kapitałka).
      for (const [y, sg] of [[hk / 2, 1], [-hk / 2, -1]]) {
        for (let i = 0; i < N; i += 1) {
          const [x0, z0] = pkt(i / N);
          const [x1, z1] = pkt((i + 1) / N);
          const a0 = [lerp(A[0], Bp[0], i / N), lerp(A[1], Bp[1], i / N)];
          const a1 = [lerp(A[0], Bp[0], (i + 1) / N), lerp(A[1], Bp[1], (i + 1) / N)];
          quad(quady, [naStol([a0[0], y, a0[1]]), naStol([x0, y, z0]), naStol([x1, y, z1]), naStol([a1[0], y, a1[1]])],
            [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]], `kolor:${twarda ? KAPITALKA : PAPIER}`, 'papier', { n: naStol([0, sg, 0]) });
        }
      }
    }
  }
}
const KAPITALKA = '#d8cdb8';

// Notes na spirali: kartki obracają się sztywno wokół osi spirali (x = 0, z = T/2); przewrócone leżą po
// lewej. Spirala – podwójne pętle drutu przez otwory przy brzegu.
function notesSpirala(quady, kartki, { s, obr, lewe, prawe, T, h }) {
  const zc = T / 2;
  const rr = Math.max(4.2, T / 2 + 2.4); // promień pętli (w poziomie)
  const x0 = rr - 3.3; // brzeg kartek; otwory 3,3 mm od brzegu, na okręgu pętli
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
  if (obr !== null) rysuj(obr, Math.PI * s, (kartki[obr].okladka ? 0.1 : 0.55) * Math.sin(Math.PI * s));
  const pitch = 8.47;
  const ile = Math.max(3, Math.floor((h - 10) / pitch));
  const ys = Array.from({ length: ile }, (_, i) => -((ile - 1) * pitch) / 2 + i * pitch);
  // Otwory na wierzchnich kartkach obu stosów (lekko nad powierzchnią).
  const otwory = (lista, strona) => {
    if (!lista.length) return;
    const top = strona > 0 ? Math.min(...lista) : Math.max(...lista);
    const zt = (strona > 0 ? zKartki[top] : 2 * zc - zKartki[top]) + kartki[top].d / 2 + 0.03;
    for (const y of ys) for (const dy of [-1.15, 1.15]) {
      const xa = strona * (x0 + 2.4);
      const xb = strona * (x0 + 4.2);
      const p = [naStol([xa, y + dy - 0.7, zt]), naStol([xb, y + dy - 0.7, zt]), naStol([xb, y + dy + 0.7, zt]), naStol([xa, y + dy + 0.7, zt])];
      quad(quady, strona > 0 ? p : [p[1], p[0], p[3], p[2]], [[0, 0], [1, 0], [1, 1], [0, 1]], `kolor:${OTWOR}`, 'papier', { n: [0, 1, 0] });
    }
  };
  otwory(lewe, -1);
  otwory(prawe, 1);
  // Spirala: pełne pętle wokół osi, po dwie przy każdym otworze; spłaszczone w pionie, żeby leżący notes
  // opierał się drutem o stół, a nie przebijał go.
  const b = Math.max(0.3, zc - 0.43);
  const unies = Math.max(0, 0.43 + b - zc); // bardzo cienki notes: drut pod spodem unosi go odrobinę
  quady.push(...zPamieci(`notes|${x0}|${zc}|${b}|${h}`, () => {
    const q = [];
    for (const y of ys) for (const dy of [-1.15, 1.15]) {
      const pts = [];
      const K = 18;
      for (let i = 0; i < K; i += 1) {
        const a = (i / K) * 2 * Math.PI;
        pts.push(naStol([(x0 + 3.3) * Math.cos(a), y + dy + 0.35 * Math.sin(a), zc + b * Math.sin(a)]));
      }
      rura(q, pts, 0.42, 'drut', `kolor:${DRUT}`, true);
    }
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
  const r = biurkowy ? Math.max(5.5, T / 2 + pt + 3) : Math.max(4.5, T / 2 + 3);
  const nach = biurkowy ? 0.34 : 0;
  const przod = [];
  const tyl = [];
  let a = biurkowy ? pt : 0;
  for (let j = n - 1; j >= 0; j -= 1) { przod[j] = a + kartki[j].d / 2; a += kartki[j].d; }
  a = biurkowy ? pt : 0;
  for (let j = 0; j < n; j += 1) { tyl[j] = -(a + kartki[j].d / 2); a += kartki[j].d; }
  const gornyBrzeg = r - 4; // górna krawędź karty; otwory 4 mm niżej, na okręgu spirali
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

  // Spirala: pełne pętle wokół osi przez otwory, po dwie przy każdym otworze.
  const pitch = 8.47;
  const ile = Math.max(3, Math.floor((w - 12) / pitch));
  quady.push(...zPamieci(`kal|${ile}|${r}`, () => {
    const q0 = [];
    for (let i = 0; i < ile; i += 1) {
      const x = -((ile - 1) * pitch) / 2 + i * pitch;
      for (const dx of [-1.15, 1.15]) {
        const pts = [];
        const K = 18;
        for (let q = 0; q < K; q += 1) {
          const al = (q / K) * 2 * Math.PI;
          pts.push([x + dx + 0.35 * Math.sin(al), r * Math.sin(al), r * Math.cos(al)]);
        }
        rura(q0, pts, 0.45, 'drut', `kolor:${DRUT}`, true);
      }
    }
    return q0;
  }));
  if (!biurkowy) {
    // Wieszak: trójkątny drut nad spiralą, do gwoździa w ścianie.
    const pts = [];
    for (let q = 0; q <= 18; q += 1) {
      const t = q / 18;
      const x = lerp(-16, 16, t);
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
export function scena(model, kartki, u = 0) {
  const quady = [];
  quady.podloze = { typ: 'stol', poziom: 0 };
  if (!kartki.length) return quady;
  if (model === 'kartka') kartkaNaStole(quady, kartki, u);
  else if (model.startsWith('kalendarz')) kalendarz(quady, model, kartki, u);
  else ksiazka(quady, model, kartki, u);
  return quady;
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
export function widokModelu(model) {
  if (model === 'kalendarz_scienny') return { obrotY: -0.38, obrotX: 0.12, minX: -0.7, maxX: 0.95, minY: -1.25, maxY: 1.25 };
  if (model === 'kalendarz_biurkowy') return { obrotY: -0.5, obrotX: 0.3, minX: 0.04, maxX: 1.35, minY: -Infinity, maxY: Infinity };
  return { obrotY: -0.32, obrotX: 0.68, minX: 0.1, maxX: 1.5, minY: -Infinity, maxY: Infinity };
}

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
varying vec2 v_uv; varying vec3 v_n; varying vec3 v_p; varying float v_ao;
void main() {
  vec3 N = normalize(v_n); vec3 V = normalize(u_oko - v_p);
  if (dot(N, V) < 0.0) N = -N;
  vec4 t = texture2D(u_t, v_uv);
  vec3 a = pow(t.rgb, vec3(2.2));
  float ndl = max(dot(N, u_L), 0.0);
  float sh = ndl > 0.0 ? cien(v_p + N * u_przes, u_promien) : 0.0;
  float ndf = max(dot(N, u_F), 0.0);
  float hemi = mix(0.30, 0.50, N.y * 0.5 + 0.5);
  vec3 H = normalize(u_L + V);
  float spec = u_mat.x * pow(max(dot(N, H), 0.0), u_mat.y) * sh * ndl;
  float fres = u_mat.z * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  // Światło studyjne słabnie z odległością od miejsca, w które świeci (żywszy, nie płaski obraz).
  vec3 dp = v_p - u_spot; float spot = clamp(1.10 - 0.30 * dot(dp, dp) / (u_spotR * u_spotR), 0.72, 1.10);
  vec3 swiatlo = vec3(1.0, 0.982, 0.955) * (0.70 * ndl * sh * spot) + vec3(0.92, 0.95, 1.0) * (0.16 * ndf) + vec3(hemi) * v_ao * mix(0.92, 1.04, spot - 0.72);
  vec3 c = a * swiatlo * u_mat.w + vec3(spec + fres * (0.35 + 0.65 * sh));
  c = c / (1.0 + 0.08 * c);
  gl_FragColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;

// Podłoże: przezroczyste poza cieniem – przyciemnia tło (cień rzucany + miękki cień kontaktowy).
const VS_POD = `attribute vec3 a_p; uniform mat4 u_rzut; uniform mat4 u_widok; varying vec3 v_p;
void main() { gl_Position = u_rzut * u_widok * vec4(a_p, 1.0); v_p = a_p; }`;
const FS_POD = `${PREC}${PAKUJ}${CIEN}
uniform sampler2D u_kontakt; uniform mat4 u_mKontakt; uniform float u_kKrok; uniform float u_kZasieg; uniform vec3 u_srodek; uniform float u_R; uniform float u_Rob; uniform float u_sila;
varying vec3 v_p;
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
  gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(ciemn * u_sila * zanik, 0.0, 0.85));
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

const POT = (v) => 2 ** Math.ceil(Math.log2(Math.max(1, v)));

// Tekstura krawędzi kartek: jasny papier z cienkimi liniami (po jednej na kartkę), powtarzalna.
function teksturaKrawedzi() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f3f0e9';
  g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 2) {
    const a = 0.10 + 0.08 * Math.sin(y * 1.7) * Math.sin(y * 0.31);
    g.fillStyle = `rgba(120, 112, 98, ${a.toFixed(3)})`;
    g.fillRect(0, y, 64, 1);
  }
  return c;
}

// Renderer na płótnie: ustawTeksture(klucz, obraz|płótno), maTeksture(klucz), rysuj(quady, kamera, opcje), zwolnij().
// kamera: { srodek, odleglosc, obrotY, obrotX }; opcje: { ciemny }. Zwraca null, gdy przeglądarka nie ma WebGL.
export function utworzRenderer(plotno) {
  const atr = { preserveDrawingBuffer: true, antialias: true, alpha: false, premultipliedAlpha: false };
  const gl = plotno.getContext('webgl', atr) || plotno.getContext('experimental-webgl', atr);
  if (!gl) return null;
  const shader = (typ, zrodlo) => {
    const s = gl.createShader(typ);
    gl.shaderSource(s, zrodlo);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
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
    maTeksture: (klucz) => klucz.startsWith('kolor:') || klucz === KRAWEDZ_KARTEK || tekstury.has(klucz),
    // Tekstury stron do wymiany (inna lista stron po zmianie rodzaju makiety).
    zapomnijStrony() {
      for (const [klucz, t] of tekstury) if (klucz.startsWith('p:')) { gl.deleteTexture(t); tekstury.delete(klucz); }
    },
    ustawTeksture(klucz, obraz) {
      const stara = tekstury.get(klucz);
      if (stara) gl.deleteTexture(stara);
      tekstury.set(klucz, nowaTekstura(obraz));
    },
    rysuj(quady, kamera, { ciemny = false } = {}) {
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
      const L = norm(obrocY(sciana ? [-0.62, 0.62, 0.8] : [-0.74, 0.8, 0.6]));
      const F = norm(obrocY(sciana ? [0.7, 0.2, 0.9] : [0.75, 0.45, 0.6]));
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

      // 3. Tło.
      gl.viewport(0, 0, W, H);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(P.tlo.p);
      const kol = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
      const [g1, d1, s1] = ciemny ? ['#34363b', '#1c1d20', '#3d4045'] : ['#f2f0ec', '#d5d1c9', '#faf9f6'];
      gl.uniform3fv(P.tlo.u.u_g, kol(g1));
      gl.uniform3fv(P.tlo.u.u_d, kol(d1));
      gl.uniform3fv(P.tlo.u.u_s, kol(s1));
      gl.uniform1f(P.tlo.u.u_asp, asp);
      gl.bindBuffer(gl.ARRAY_BUFFER, buforTla);
      gl.enableVertexAttribArray(P.tlo.a.a_p);
      gl.vertexAttribPointer(P.tlo.a.a_p, 2, gl.FLOAT, false, 8, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      wylaczAtrybuty();

      // Kamera.
      const fov = (28 * Math.PI) / 180;
      const rzut = perspektywa(fov, asp, Math.max(1, kamera.odleglosc / 40), kamera.odleglosc + R * 12);
      const widok = mnoz(przesun(0, 0, -kamera.odleglosc), mnoz(obrX(kamera.obrotX), mnoz(obrY(kamera.obrotY), przesun(-c[0], -c[1], -c[2]))));
      // Oko (do połysku): widok = Tz(−d) · Rx(a) · Ry(b) · T(−c), więc oko = c + Ry(−b) · Rx(−a) · (0, 0, d).
      const z0 = kamera.odleglosc * Math.cos(kamera.obrotX);
      const okoSw = [c[0] - z0 * Math.sin(kamera.obrotY), c[1] + kamera.odleglosc * Math.sin(kamera.obrotX), c[2] + z0 * Math.cos(kamera.obrotY)];

      // 4. Podłoże (cień) – przyciemnia tło.
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
      gl.uniform1f(up.u_R, 5.5 / texelSw);
      gl.uniform1f(up.u_Rob, R);
      gl.uniform1f(up.u_sila, ciemny ? 1.25 : 1.0);
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
      gl.uniform1f(uo.u_promien, Math.max(1.5, 0.9 / texelSw));
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
      for (const g of vb.grupy) {
        gl.uniform4fv(uo.u_mat, MATERIALY[g.mat] || MATERIALY.papier);
        gl.bindTexture(gl.TEXTURE_2D, tekstura(g.tex));
        gl.drawArrays(gl.TRIANGLES, g.od, g.ile);
      }
      wylaczAtrybuty();
    },
    zwolnij() {
      for (const t of tekstury.values()) gl.deleteTexture(t);
      tekstury.clear();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
