/* global fabric */
// Tabela jako jeden element strony.
//
// Tabela to grupa Fabric z opisem w polu `tabela`:
//   { kolumny: [szerokości mm], wiersze: [najmniejsze wysokości mm], naglowek, linia: { kolor, grubosc },
//     tlo: { naglowek: kolor | null, zebra: kolor | null },
//     scalenia: [{ w, k, ileW, ileK }] }
// Scalenie: komórka w wierszu `w` i kolumnie `k` zajmuje ileW wierszy i ileK kolumn. Komórki, które
// przykrywa, zostają w grupie (ukryte, ze swoim tekstem) – po rozdzieleniu wracają na miejsce.
// W grupie leżą: prostokąty tła wierszy (na spodzie), ramki tekstu komórek (wierszami, od lewej)
// i – za nimi – linie siatki.
// Komórka to zwykły tekst: pola {…}, formatowanie fragmentów i style działają jak wszędzie.
//
// Cały układ liczy ulozTabele(): szerokość komórki wynika z kolumny, wysokość wiersza to
// większa z dwóch – najmniejszej zadanej i najwyższej komórki w wierszu – a linie siatki
// powstają z tych wymiarów. Ta sama funkcja działa w edytorze i przy składaniu stron
// z danymi, więc wiersz rośnie razem z treścią także na powielonych stronach.

import './fabric-ustawienia.js';
import './tekst-ramka.js';

export const ODSTEP_X = 1.5; // mm między linią a tekstem komórki
export const ODSTEP_Y = 1;
const MIN_KOLUMNA = 5;
const MIN_WIERSZ = 3;
export const MAX_WIERSZY = 60;
export const MAX_KOLUMN = 12;

// Element dodany do grupy na płótnie dostaje odwrotność jej obrotu i skali – w tabeli każdy leży prosto.
const BEZ_PRZEKSZTALCEN = { scaleX: 1, scaleY: 1, angle: 0, skewX: 0, skewY: 0, flipX: false, flipY: false };
const suma = (t) => t.reduce((s, x) => s + x, 0);
const zaokr = (x) => Math.round(x * 100) / 100;

export const toTabela = (o) => Boolean(o && o.tabela && Array.isArray(o.tabela.kolumny) && typeof o.getObjects === 'function');

// Komórki tabeli wierszami, od lewej.
export const komorkiTabeli = (g) => g.getObjects().filter((o) => o.type === 'textbox');
// Ile elementów grupy leży przed pierwszą komórką (prostokąty tła wierszy).
const przedKomorkami = (g) => { const i = g.getObjects().findIndex((o) => o.type === 'textbox'); return i < 0 ? 0 : i; };

export function miejsceKomorki(g, komorka) {
  const i = komorkiTabeli(g).indexOf(komorka);
  const K = g.tabela.kolumny.length;
  return i < 0 ? null : { w: Math.floor(i / K), k: i % K };
}

// Rzeczywiste wysokości wierszy (po ostatnim ułożeniu).
export function wysokosciWierszy(g) {
  if (g._wysWierszy?.length === g.tabela.wiersze.length) return [...g._wysWierszy];
  const K = g.tabela.kolumny.length;
  const komorki = komorkiTabeli(g);
  return g.tabela.wiersze.map((min, w) => komorki[w * K]?.ramka_h || min);
}

// ---------- Scalanie komórek ----------

const obejmuje = (s, w, k) => w >= s.w && w < s.w + s.ileW && k >= s.k && k < s.k + s.ileK;
const nachodza = (a, b) => a.w < b.w + b.ileW && b.w < a.w + a.ileW && a.k < b.k + b.ileK && b.k < a.k + a.ileK;

// Porządkuje listę scaleń: w granicach tabeli, bez scaleń jednej komórki i bez nachodzących na siebie.
function uporzadkujScalenia(t) {
  const W = t.wiersze.length;
  const K = t.kolumny.length;
  const dobre = [];
  for (const s of Array.isArray(t.scalenia) ? t.scalenia : []) {
    const w = Math.max(0, Math.round(s.w) || 0);
    const k = Math.max(0, Math.round(s.k) || 0);
    const n = { w, k, ileW: Math.min(W - w, Math.round(s.ileW) || 1), ileK: Math.min(K - k, Math.round(s.ileK) || 1) };
    if (n.ileW < 1 || n.ileK < 1 || (n.ileW === 1 && n.ileK === 1) || dobre.some((d) => nachodza(d, n))) continue;
    dobre.push(n);
  }
  if (dobre.length) t.scalenia = dobre; else delete t.scalenia;
  return dobre;
}

// Dla każdej komórki (wierszami): scalenie, które ją obejmuje, albo null.
function mapaScalen(t) {
  const K = t.kolumny.length;
  const mapa = Array.from({ length: t.wiersze.length * K }, () => null);
  for (const s of t.scalenia || []) for (let w = s.w; w < s.w + s.ileW; w += 1) for (let k = s.k; k < s.k + s.ileK; k += 1) mapa[w * K + k] = s;
  return mapa;
}

// Scalenie obejmujące komórkę (w, k) albo null.
export function scalenieKomorki(g, w, k) {
  return (g.tabela.scalenia || []).find((s) => obejmuje(s, w, k)) || null;
}

// Czy komórka jest schowana pod scaleniem (nie jest jego lewą górną komórką).
export function komorkaSchowana(g, komorka) {
  const m = miejsceKomorki(g, komorka);
  const s = m && scalenieKomorki(g, m.w, m.k);
  return Boolean(s && (s.w !== m.w || s.k !== m.k));
}

// Scala komórkę (w, k) – albo scalenie, do którego należy – z sąsiednią po prawej ('prawo') albo
// poniżej ('dol'). Gdy sąsiad sam jest scaleniem, powstaje prostokąt obejmujący oba.
// Zwraca lewą górną komórkę nowego scalenia albo null, gdy nie ma z czym scalić.
export function scalKomorki(g, w, k, kierunek) {
  const t = g.tabela;
  const W = t.wiersze.length;
  const K = t.kolumny.length;
  const s = scalenieKomorki(g, w, k) || { w, k, ileW: 1, ileK: 1 };
  let r = { ...s };
  if (kierunek === 'prawo') { if (r.k + r.ileK >= K) return null; r.ileK += 1; } else { if (r.w + r.ileW >= W) return null; r.ileW += 1; }
  // Prostokąt rośnie, aż obejmie w całości każde scalenie, o które zahacza.
  for (let zmiana = true; zmiana;) {
    zmiana = false;
    for (const m of t.scalenia || []) {
      if (!nachodza(r, m)) continue;
      const n = { w: Math.min(r.w, m.w), k: Math.min(r.k, m.k) };
      n.ileW = Math.max(r.w + r.ileW, m.w + m.ileW) - n.w;
      n.ileK = Math.max(r.k + r.ileK, m.k + m.ileK) - n.k;
      if (n.w !== r.w || n.k !== r.k || n.ileW !== r.ileW || n.ileK !== r.ileK) { r = n; zmiana = true; }
    }
  }
  t.scalenia = [...(t.scalenia || []).filter((m) => !nachodza(r, m)), r];
  ulozTabele(g);
  return komorkiTabeli(g)[r.w * K + r.k] || null;
}

// Rozdziela scalenie, do którego należy komórka (w, k). Zwraca true, gdy było co rozdzielać.
export function rozdzielKomorki(g, w, k) {
  const s = scalenieKomorki(g, w, k);
  if (!s) return false;
  g.tabela.scalenia = g.tabela.scalenia.filter((m) => m !== s);
  ulozTabele(g);
  return true;
}

// Lewa górna komórka scalenia przejmuje treść i wygląd od komórki, która ją zastępuje (przy usuwaniu
// wiersza albo kolumny z początkiem scalenia).
function przeniesTresc(z, cel) {
  if (!z || !cel) return;
  cel.set({ text: z.text, styles: JSON.parse(JSON.stringify(z.styles || {})) });
  for (const p of TEKST_KOMORKI) cel.set(p, z[p]);
}

// Wygląd tekstu przenoszony na nowe komórki i ustawiany dla całej tabeli naraz.
export const TEKST_KOMORKI = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fill', 'lineHeight', 'charSpacing', 'textAlign', 'underline', 'linethrough', 'wyrownanie_pion', 'wielkosc_liter'];

function nowaKomorka(uid, tekst, wyglad) {
  return new fabric.Textbox(tekst, {
    id: uid('o'), strokeWidth: 0, ...wyglad,
    // Komórka nie wychodzi z tabeli i nie ma własnych uchwytów.
    lockMovementX: true, lockMovementY: true, hasControls: false, hoverCursor: 'text',
  });
}

// Nowa tabela (jeszcze poza płótnem). lewo/gora: róg tabeli w mm.
export function nowaTabela({ wiersze = 3, kolumny = 3, szerokosc = 120, wysokoscWiersza = 9, naglowek = true, lewo = 0, gora = 0, wyglad = {} }, uid) {
  const W = Math.min(MAX_WIERSZY, Math.max(1, Math.round(wiersze)));
  const K = Math.min(MAX_KOLUMN, Math.max(1, Math.round(kolumny)));
  const tekst = { fontFamily: 'Inter', fontSize: 9 * 25.4 / 72, fontWeight: 'normal', lineHeight: 1.15, fill: '#1a1a1a', textAlign: 'left', wyrownanie_pion: 'srodek', ...wyglad };
  const komorki = [];
  for (let w = 0; w < W; w += 1) {
    for (let k = 0; k < K; k += 1) {
      const pierwszy = naglowek && w === 0;
      komorki.push(nowaKomorka(uid, pierwszy ? `Kolumna ${k + 1}` : '', { ...tekst, fontWeight: pierwszy ? 'bold' : tekst.fontWeight }));
    }
  }
  const g = new fabric.Group([], {
    id: uid('o'), left: lewo, top: gora,
    // Układ liczy ulozTabele – grupa sama niczego nie przestawia.
    layoutManager: new fabric.LayoutManager(new fabric.FixedLayout()),
    subTargetCheck: false, interactive: false,
    tabela: {
      // W dół do setnych milimetra – tabela nie wychodzi za zadaną szerokość.
      kolumny: Array.from({ length: K }, () => Math.max(MIN_KOLUMNA, Math.floor((szerokosc / K) * 100) / 100)),
      wiersze: Array.from({ length: W }, () => Math.max(MIN_WIERSZ, wysokoscWiersza)),
      naglowek: Boolean(naglowek),
      linia: { kolor: '#1a1a1a', grubosc: 0.25 },
    },
  });
  g.add(...komorki);
  ulozTabele(g);
  return g;
}

// Układa komórki i linie siatki. Lewy górny róg tabeli zostaje na miejscu.
export function ulozTabele(g) {
  // Tabela wczytana z zapisu albo skopiowana ma własny opis (nie dzieli go z projektem ani z oryginałem).
  if (!g._wlasnyOpis) { g.tabela = JSON.parse(JSON.stringify(g.tabela)); g._wlasnyOpis = true; }
  const t = g.tabela;
  const K = t.kolumny.length;
  const W = t.wiersze.length;
  const komorki = komorkiTabeli(g);
  t.kolumny = t.kolumny.map((s) => Math.max(MIN_KOLUMNA, s));
  uporzadkujScalenia(t);
  const mapa = mapaScalen(t);
  const poczatek = (i) => { const s = mapa[i]; return !s || (s.w === Math.floor(i / K) && s.k === i % K); };
  const wys = t.wiersze.map((min) => Math.max(MIN_WIERSZ, min));
  // Pomiar: szerokość komórki z kolumny (scalonej – z kilku), wysokość treści wyznacza wysokość wiersza.
  const wysokie = []; // komórki scalone w pionie: [pierwszy wiersz, liczba wierszy, potrzebna wysokość]
  komorki.forEach((c, i) => {
    const k = i % K;
    const w = Math.floor(i / K);
    const s = mapa[i];
    c.autodopasowanie = undefined;
    // Komórka schowana pod scaleniem zostaje w grupie ze swoim tekstem, ale nie jest rysowana ani mierzona.
    c.visible = poczatek(i);
    c.evented = c.visible;
    const szer = c.visible && s ? suma(t.kolumny.slice(k, k + s.ileK)) : t.kolumny[k];
    c.set({ width: Math.max(1, szer - 2 * ODSTEP_X), ...BEZ_PRZEKSZTALCEN });
    c.initDimensions();
    if (!c.visible || w >= W) return;
    const potrzeba = (c._wysokoscTresci ?? c.height) + 2 * ODSTEP_Y;
    if (s && s.ileW > 1) wysokie.push([w, s.ileW, potrzeba]);
    else wys[w] = Math.max(wys[w], potrzeba);
  });
  // Tekst komórki scalonej w pionie, który nie mieści się w jej wierszach, wydłuża ostatni z nich.
  for (const [w, ile, potrzeba] of wysokie) {
    const brak = potrzeba - suma(wys.slice(w, w + ile));
    if (brak > 0) wys[w + ile - 1] += brak;
  }
  g._wysWierszy = [...wys];
  const SZER = suma(t.kolumny);
  const WYS = suma(wys);
  const lewa = (k) => -SZER / 2 + suma(t.kolumny.slice(0, k));
  const gorna = (w) => -WYS / 2 + suma(wys.slice(0, w));
  for (let w = 0; w < W; w += 1) {
    for (let k = 0; k < K; k += 1) {
      const c = komorki[w * K + k];
      if (!c) continue;
      const s = c.visible ? mapa[w * K + k] : null;
      // Ramka komórki zajmuje całą jej wysokość – kliknięcie gdziekolwiek w komórce trafia w jej tekst.
      const h = s ? suma(wys.slice(w, w + s.ileW)) : wys[w];
      c.ramka_h = h;
      c.height = h;
      c.set({ left: lewa(k) + ODSTEP_X, top: gorna(w) });
      c.setCoords();
      c.dirty = true;
    }
  }

  // Tło wierszy: nagłówek i co drugi wiersz treści („zebra”). Zwykłe prostokąty na spodzie grupy –
  // rysują się tak samo na ekranie, w podglądzie i w PDF. Komórka scalona w pionie ma w całości tło
  // swojego pierwszego wiersza.
  const kolorWiersza = (w) => { const tresci = w - (t.naglowek ? 1 : 0); return (t.naglowek && w === 0 ? t.tlo?.naglowek : (tresci % 2 === 1 ? t.tlo?.zebra : null)) || null; };
  const pionowe = (i) => Boolean(mapa[i] && mapa[i].ileW > 1);
  const tla = []; // [lewo, góra, szerokość, wysokość, kolor]
  for (let w = 0; w < W; w += 1) {
    const kolorTla = kolorWiersza(w);
    for (let k = 0; k < K;) {
      const s = mapa[w * K + k];
      if (pionowe(w * K + k)) {
        const tu = s.w === w && s.k === k;
        if (tu && kolorTla) tla.push([lewa(k), gorna(w), suma(t.kolumny.slice(k, k + s.ileK)), suma(wys.slice(w, w + s.ileW)), kolorTla]);
        k += tu ? s.ileK : 1;
        continue;
      }
      // Ciąg komórek tego wiersza, które nie należą do scalenia pionowego.
      let koniec = k;
      while (koniec < K && !pionowe(w * K + koniec)) koniec += 1;
      if (kolorTla) tla.push([lewa(k), gorna(w), suma(t.kolumny.slice(k, koniec)), wys[w], kolorTla]);
      k = koniec;
    }
  }
  let prostokaty = g.getObjects().filter((o) => o.type === 'rect');
  if (prostokaty.length > tla.length) g.remove(...prostokaty.slice(tla.length));
  if (prostokaty.length < tla.length) g.insertAt(0, ...Array.from({ length: tla.length - prostokaty.length }, () => new fabric.Rect({ strokeWidth: 0, evented: false, selectable: false })));
  prostokaty = g.getObjects().filter((o) => o.type === 'rect');
  tla.forEach(([lewo, gora, szerokosc, wysokosc, kolorTla], i) => {
    prostokaty[i].set({ left: lewo, top: gora, width: szerokosc, height: wysokosc, fill: kolorTla, strokeWidth: 0, evented: false, selectable: false, ...BEZ_PRZEKSZTALCEN });
    prostokaty[i].setCoords();
  });

  // Linie siatki: odcinki na granicach kolumn i wierszy; przez środek scalonej komórki linia nie przechodzi.
  const wSrodku = (a, b) => Boolean(mapa[a] && mapa[a] === mapa[b]);
  const odcinki = []; // [x1, y1, x2, y2, mnożnik grubości]
  for (let k = 0; k <= K; k += 1) {
    const zaslonieta = (w) => k > 0 && k < K && wSrodku(w * K + k - 1, w * K + k);
    for (let w = 0; w < W;) {
      if (zaslonieta(w)) { w += 1; continue; }
      let koniec = w;
      while (koniec < W && !zaslonieta(koniec)) koniec += 1;
      odcinki.push([lewa(k), gorna(w), lewa(k), gorna(koniec), 1]);
      w = koniec;
    }
  }
  for (let w = 0; w <= W; w += 1) {
    const zaslonieta = (k) => w > 0 && w < W && wSrodku((w - 1) * K + k, w * K + k);
    for (let k = 0; k < K;) {
      if (zaslonieta(k)) { k += 1; continue; }
      let koniec = k;
      while (koniec < K && !zaslonieta(koniec)) koniec += 1;
      odcinki.push([lewa(k), gorna(w), lewa(koniec), gorna(w), t.naglowek && w === 1 && W > 1 ? 2 : 1]);
      k = koniec;
    }
  }
  let linie = g.getObjects().filter((o) => o.type === 'line');
  if (linie.length > odcinki.length) g.remove(...linie.slice(odcinki.length));
  if (linie.length < odcinki.length) g.add(...Array.from({ length: odcinki.length - linie.length }, () => new fabric.Line([0, 0, 1, 0], { evented: false, selectable: false, strokeUniform: true })));
  linie = g.getObjects().filter((o) => o.type === 'line');
  const kolor = t.linia?.kolor || '#1a1a1a';
  const grubosc = Math.max(0, t.linia?.grubosc ?? 0.25);
  odcinki.forEach(([x1, y1, x2, y2, mnoznik], i) => {
    const l = linie[i];
    l.set({ stroke: kolor, strokeWidth: grubosc * mnoznik, visible: grubosc > 0, evented: false, selectable: false, ...BEZ_PRZEKSZTALCEN });
    l.set({ x1, y1, x2, y2 }); // linia sama ustawia się środkiem między końcami
    l.setCoords();
  });

  g.set({ width: SZER, height: WYS });
  g.setCoords();
  g.dirty = true;
  return g;
}

// Po skalowaniu uchwytem: zmieniają się szerokości kolumn i wysokości wierszy, nie rozmiar pisma.
export function utrwalSkaleTabeli(g) {
  if (!toTabela(g) || (Math.abs(g.scaleX - 1) < 1e-6 && Math.abs(g.scaleY - 1) < 1e-6)) return false;
  const t = g.tabela;
  const sx = Math.abs(g.scaleX);
  const sy = Math.abs(g.scaleY);
  t.kolumny = t.kolumny.map((s) => zaokr(Math.max(MIN_KOLUMNA, s * sx)));
  t.wiersze = wysokosciWierszy(g).map((h) => zaokr(Math.max(MIN_WIERSZ, h * sy)));
  g.set({ scaleX: 1, scaleY: 1, flipX: false, flipY: false });
  ulozTabele(g);
  return true;
}

// Komórka pod punktem arkusza (mm) albo null.
export function komorkaWPunkcie(g, punkt) {
  const p = new fabric.Point(punkt.x, punkt.y).transform(fabric.util.invertTransform(g.calcTransformMatrix()));
  const t = g.tabela;
  let x = -suma(t.kolumny) / 2;
  const k = t.kolumny.findIndex((s) => { const w = p.x >= x && p.x <= x + s; x += s; return w; });
  const wys = wysokosciWierszy(g);
  let y = -suma(wys) / 2;
  const w = wys.findIndex((h) => { const jest = p.y >= y && p.y <= y + h; y += h; return jest; });
  if (k < 0 || w < 0) return null;
  // Punkt w scalonej komórce wskazuje jej lewą górną komórkę – tę, w której jest tekst.
  const s = scalenieKomorki(g, w, k);
  return komorkiTabeli(g)[(s ? s.w : w) * t.kolumny.length + (s ? s.k : k)] || null;
}

// Szerokość kolumny k. Granica między kolumnami przesuwa się kosztem sąsiedniej (tabela nie zmienia
// szerokości); ostatnia kolumna zmienia szerokość całej tabeli. Zwraca true, gdy coś się zmieniło.
export function ustawSzerokoscKolumny(g, k, szerokosc, { kosztemSasiedniej = true } = {}) {
  const t = g.tabela;
  if (!(k >= 0 && k < t.kolumny.length) || !Number.isFinite(szerokosc)) return false;
  let nowa = Math.max(MIN_KOLUMNA, szerokosc);
  if (kosztemSasiedniej && k < t.kolumny.length - 1) {
    const para = t.kolumny[k] + t.kolumny[k + 1];
    nowa = Math.min(nowa, para - MIN_KOLUMNA);
    if (Math.abs(nowa - t.kolumny[k]) < 0.005) return false;
    t.kolumny[k + 1] = zaokr(para - nowa);
  } else if (Math.abs(nowa - t.kolumny[k]) < 0.005) return false;
  t.kolumny[k] = zaokr(nowa);
  ulozTabele(g);
  return true;
}

const wygladKomorki = (c) => Object.fromEntries(TEKST_KOMORKI.map((k) => [k, c[k]]));

// Nowy wiersz pod wierszem `po` (domyślnie na końcu). Zwraca numer nowego wiersza albo -1.
export function dodajWiersz(g, uid, po = g.tabela.wiersze.length - 1) {
  const t = g.tabela;
  if (t.wiersze.length >= MAX_WIERSZY) return -1;
  const K = t.kolumny.length;
  const komorki = komorkiTabeli(g);
  // Wygląd z wiersza powyżej; wiersz pod nagłówkiem bierze go z wiersza treści (albo bez pogrubienia).
  const wzor = t.naglowek && po === 0 ? (t.wiersze.length > 1 ? 1 : 0) : po;
  const nowe = Array.from({ length: K }, (_, k) => {
    const w = wygladKomorki(komorki[wzor * K + k] || komorki[k]);
    if (t.naglowek && wzor === 0) w.fontWeight = 'normal';
    return nowaKomorka(uid, '', w);
  });
  g.insertAt(przedKomorkami(g) + (po + 1) * K, ...nowe);
  t.wiersze.splice(po + 1, 0, t.wiersze[Math.max(wzor, 0)] ?? t.wiersze.at(-1));
  // Scalenia poniżej przesuwają się o wiersz; scalenie, w którego środek wszedł nowy wiersz, wydłuża się.
  for (const s of t.scalenia || []) { if (s.w > po) s.w += 1; else if (s.w + s.ileW - 1 > po) s.ileW += 1; }
  ulozTabele(g);
  return po + 1;
}

export function usunWiersz(g, w = g.tabela.wiersze.length - 1) {
  const t = g.tabela;
  if (t.wiersze.length <= 1 || !(w >= 0 && w < t.wiersze.length)) return false;
  const K = t.kolumny.length;
  const komorki = komorkiTabeli(g);
  for (const s of t.scalenia || []) {
    if (w < s.w) s.w -= 1;
    else if (w < s.w + s.ileW) {
      // Znika pierwszy wiersz scalenia: treść przechodzi do komórki poniżej, która zostaje jego początkiem.
      if (w === s.w && s.ileW > 1) przeniesTresc(komorki[w * K + s.k], komorki[(w + 1) * K + s.k]);
      s.ileW -= 1;
    }
  }
  g.remove(...komorki.slice(w * K, (w + 1) * K));
  t.wiersze.splice(w, 1);
  ulozTabele(g);
  return true;
}

// Nowa kolumna z prawej strony kolumny `po`. Tabela zachowuje szerokość – kolumny zwężają się po równo.
export function dodajKolumne(g, uid, po = g.tabela.kolumny.length - 1) {
  const t = g.tabela;
  const K = t.kolumny.length;
  if (K >= MAX_KOLUMN) return -1;
  const W = t.wiersze.length;
  const komorki = komorkiTabeli(g);
  for (let w = W - 1; w >= 0; w -= 1) {
    const pierwszy = t.naglowek && w === 0;
    g.insertAt(przedKomorkami(g) + w * K + po + 1, nowaKomorka(uid, pierwszy ? `Kolumna ${K + 1}` : '', wygladKomorki(komorki[w * K + po])));
  }
  const szer = suma(t.kolumny);
  t.kolumny = t.kolumny.map((s) => zaokr((s * K) / (K + 1)));
  t.kolumny.splice(po + 1, 0, zaokr(szer / (K + 1)));
  for (const s of t.scalenia || []) { if (s.k > po) s.k += 1; else if (s.k + s.ileK - 1 > po) s.ileK += 1; }
  ulozTabele(g);
  return po + 1;
}

export function usunKolumne(g, k = g.tabela.kolumny.length - 1) {
  const t = g.tabela;
  const K = t.kolumny.length;
  if (K <= 1 || !(k >= 0 && k < K)) return false;
  const komorki = komorkiTabeli(g);
  for (const s of t.scalenia || []) {
    if (k < s.k) s.k -= 1;
    else if (k < s.k + s.ileK) {
      if (k === s.k && s.ileK > 1) przeniesTresc(komorki[s.w * K + k], komorki[s.w * K + k + 1]);
      s.ileK -= 1;
    }
  }
  g.remove(...t.wiersze.map((_, w) => komorki[w * K + k]).filter(Boolean));
  const szer = suma(t.kolumny);
  t.kolumny.splice(k, 1);
  const reszta = suma(t.kolumny);
  t.kolumny = t.kolumny.map((s) => zaokr((s * szer) / reszta));
  ulozTabele(g);
  return true;
}

// Wiersz nagłówka: pogrubiony tekst pierwszego wiersza i grubsza linia pod nim.
export function ustawNaglowek(g, jest) {
  const t = g.tabela;
  t.naglowek = Boolean(jest);
  for (const c of komorkiTabeli(g).slice(0, t.kolumny.length)) c.set('fontWeight', jest ? 'bold' : 'normal');
  ulozTabele(g);
}

// Tło wierszy: { naglowek: kolor | null, zebra: kolor | null } – podane pola zastępują dotychczasowe.
export function ustawTloTabeli(g, tlo) {
  const t = g.tabela;
  t.tlo = { naglowek: t.tlo?.naglowek || null, zebra: t.tlo?.zebra || null, ...tlo };
  if (!t.tlo.naglowek && !t.tlo.zebra) delete t.tlo;
  ulozTabele(g);
}

// Najmniejsza wysokość jednego wiersza (mm).
export function ustawWysokoscWiersza(g, w, wysokosc) {
  const t = g.tabela;
  if (!(w >= 0 && w < t.wiersze.length) || !Number.isFinite(wysokosc)) return false;
  t.wiersze[w] = zaokr(Math.max(MIN_WIERSZ, wysokosc));
  ulozTabele(g);
  return true;
}

// Wygląd tekstu wszystkich komórek naraz (np. { fontFamily: 'Lora' }). Pogrubienie nagłówka zostaje.
export function ustawTekstTabeli(g, wlasciwosci) {
  const K = g.tabela.kolumny.length;
  komorkiTabeli(g).forEach((c, i) => {
    for (const [k, v] of Object.entries(wlasciwosci)) {
      if (k === 'fontWeight' && g.tabela.naglowek && i < K) continue;
      c.removeStyle?.(k);
      c.set(k, v);
    }
  });
  ulozTabele(g);
}

// ---------- Uchwyty granic kolumn (edytor) ----------

function rysujUchwyt(ctx, lewo, gora, _styl, obiekt) {
  ctx.save();
  ctx.translate(lewo, gora);
  ctx.rotate(fabric.util.degreesToRadians(obiekt.getTotalAngle ? obiekt.getTotalAngle() : obiekt.angle || 0));
  ctx.fillStyle = '#2563eb';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Znacznik jak na linijce edytora tekstu: prostokąt ze szpicem w dół, nad granicą kolumny.
  ctx.moveTo(-5, -9); ctx.lineTo(5, -9); ctx.lineTo(5, -1); ctx.lineTo(0, 5); ctx.lineTo(-5, -1); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function uchwytKolumny(i) {
  return new fabric.Control({
    actionName: 'kolumna',
    cursorStyle: 'col-resize',
    sizeX: 16, sizeY: 20, touchSizeX: 32, touchSizeY: 36,
    render: rysujUchwyt,
    // Nad górną krawędzią, na prawej granicy kolumny i.
    positionHandler: (wymiar, macierz, obiekt) => {
      const t = obiekt.tabela;
      const czesc = suma(t.kolumny.slice(0, i + 1)) / (suma(t.kolumny) || 1);
      return new fabric.Point((czesc - 0.5) * wymiar.x, -0.5 * wymiar.y - 12).transform(macierz);
    },
    actionHandler: (zdarzenie, przeksztalcenie, x, y) => {
      const g = przeksztalcenie.target;
      const t = g.tabela;
      const p = new fabric.Point(x, y).transform(fabric.util.invertTransform(g.calcTransformMatrix()));
      const lewa = suma(t.kolumny.slice(0, i)) - suma(t.kolumny) / 2;
      // Pełne milimetry łatwiej trafić; Alt wyłącza zaokrąglanie.
      const szer = zdarzenie.altKey ? p.x - lewa : Math.round((p.x - lewa) * 2) / 2;
      return ustawSzerokoscKolumny(g, i, szer);
    },
  });
}

// Przygotowuje tabelę do pracy w edytorze: uchwyty kolumn, komórki bez własnych uchwytów,
// klawisz Tab w komórce (naTab(komorka, wstecz)).
export function przygotujTabele(g, { naTab } = {}) {
  if (!g._wlasnyOpis) ulozTabele(g);
  const K = g.tabela.kolumny.length;
  g.set({ subTargetCheck: false, interactive: false });
  if (g._uchwytyKolumn !== K) {
    const uchwyty = Object.fromEntries(Object.entries(g.controls).filter(([nazwa]) => !nazwa.startsWith('kol')));
    for (let i = 0; i < K; i += 1) uchwyty[`kol${i}`] = uchwytKolumny(i);
    g.controls = uchwyty;
    g._uchwytyKolumn = K;
    // Boczne uchwyty zastępują uchwyty kolumn; narożne skalują całą tabelę.
    g.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false });
  }
  for (const c of komorkiTabeli(g)) {
    c.set({ lockMovementX: true, lockMovementY: true, hasControls: false, hoverCursor: 'text' });
    if (naTab && !c._tabWTabeli) {
      c._tabWTabeli = (e) => naTab(c, Boolean(e?.shiftKey));
      c.keysMap = { ...c.keysMap, 9: '_tabWTabeli' };
    }
  }
  for (const l of g.getObjects()) if (l.type === 'line' || l.type === 'rect') l.set({ evented: false, selectable: false });
}
