/* global fabric */
// Wykres z danych (decyzja #131A): słupkowy, poziomy, liniowy, kołowy i pierścieniowy – z tabeli danych
// projektu. Jeden element strony: grupa Fabric z opisem w polu `wykres`; prostokąty, linie, ścieżki
// i napisy w środku układa ulozWykres() przy każdej zmianie (ustawień albo danych). Wszystko jest
// zwykłymi kształtami, więc wykres rysuje się tak samo na płótnie, w podglądzie, na miniaturach i w PDF
// (wektorowo).
//
// Opis `wykres`:
//   rodzaj: 'slupki' | 'poziome' | 'linia' | 'kolo' | 'pierscien',
//   tabela: id tabeli danych, etykiety: kolumna z podpisami, wartosci: [kolumny z liczbami] (serie),
//   zakres: 'wszystkie' | 'zakres' (wiersze od–do, liczone od 1) | 'wiersz' (wiersz strony serii: kategorie
//           to kolumny wartości, a liczby – z bieżącego wiersza),
//   od, do, szerokosc, wysokosc (mm), kolory: [kolory serii albo wycinków],
//   etykiety_wartosci, os, legenda, siatka (bool), czcionka, rozmiar (mm), kolor_tekstu, tytul.

import './fabric-ustawienia.js';

export const RODZAJE = [['slupki', 'Słupkowy'], ['poziome', 'Poziomy'], ['linia', 'Liniowy'], ['kolo', 'Kołowy'], ['pierscien', 'Pierścieniowy']];
export const PALETA = ['#2f6fb0', '#e07b39', '#3f9b5a', '#c94c4c', '#8a63b8', '#d4a72c', '#4aa3b5', '#8c6d4f'];

export const toWykres = (o) => Boolean(o && o.wykres && typeof o.getObjects === 'function');

const BEZ = { scaleX: 1, scaleY: 1, angle: 0, skewX: 0, skewY: 0, flipX: false, flipY: false, evented: false, selectable: false };

export function normalizujWykres(w = {}) {
  return {
    rodzaj: RODZAJE.some(([r]) => r === w.rodzaj) ? w.rodzaj : 'slupki',
    tabela: w.tabela || undefined,
    etykiety: w.etykiety || '',
    wartosci: Array.isArray(w.wartosci) ? w.wartosci.filter(Boolean) : [],
    zakres: ['wszystkie', 'zakres', 'wiersz'].includes(w.zakres) ? w.zakres : 'wszystkie',
    od: Math.max(1, Math.round(Number(w.od)) || 1),
    do: Math.max(1, Math.round(Number(w.do)) || 12),
    szerokosc: Math.max(20, Number(w.szerokosc) || 100),
    wysokosc: Math.max(15, Number(w.wysokosc) || 60),
    kolory: Array.isArray(w.kolory) && w.kolory.length ? w.kolory : [...PALETA],
    etykiety_wartosci: w.etykiety_wartosci !== false,
    os: w.os !== false,
    legenda: w.legenda !== false,
    siatka: w.siatka !== false,
    czcionka: w.czcionka || 'Inter',
    rozmiar: Math.max(1, Number(w.rozmiar) || 2.6),
    kolor_tekstu: w.kolor_tekstu || '#3a3a3a',
    tytul: typeof w.tytul === 'string' ? w.tytul : '',
  };
}

// Liczba z tekstu komórki: „1 234,5”, „12%”, „-3.5 zł”.
export function liczbaZTekstu(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v ?? '').replace(/[\s ]/g, '').replace(/[^\d,.-]/g, '');
  if (!t || !/\d/.test(t)) return null;
  const n = Number(t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Dane do wykresu: { etykiety: [], serie: [{ nazwa, wartosci: [] }] }.
// wartosc – funkcja pól strony (wiersz serii) albo null.
export function daneWykresu(projekt, opis, wartosc = null) {
  const w = normalizujWykres(opis);
  const t = projekt?.tabele?.find((x) => x.id === w.tabela);
  if (!t || !w.wartosci.length) return { etykiety: [], serie: [] };
  const kolumny = w.wartosci.map((n) => t.kolumny.indexOf(n)).filter((i) => i >= 0);
  if (w.zakres === 'wiersz') {
    // Jeden wiersz: kategorie to nazwy kolumn, liczby – z wiersza strony serii (poza serią – z pierwszego).
    const z = (k) => { const n = t.kolumny[k]; const v = wartosc ? wartosc(n) : undefined; return v === undefined || v === null || v === '' ? t.wiersze[0]?.[k] : v; };
    const nazwa = w.etykiety && t.kolumny.includes(w.etykiety) ? String((wartosc ? wartosc(w.etykiety) : '') || t.wiersze[0]?.[t.kolumny.indexOf(w.etykiety)] || '') : '';
    return { etykiety: kolumny.map((k) => t.kolumny[k]), serie: [{ nazwa, wartosci: kolumny.map((k) => liczbaZTekstu(z(k)) ?? 0) }] };
  }
  const wiersze = w.zakres === 'zakres' ? t.wiersze.slice(w.od - 1, Math.max(w.od, w.do)) : t.wiersze;
  const ke = t.kolumny.indexOf(w.etykiety);
  return {
    etykiety: wiersze.map((r, i) => (ke >= 0 ? String(r[ke] ?? '') : String(i + 1))),
    serie: kolumny.map((k) => ({ nazwa: t.kolumny[k], wartosci: wiersze.map((r) => liczbaZTekstu(r[k]) ?? 0) })),
  };
}

// „Ładna” skala osi: 0 … max w 4–6 krokach (1, 2, 2,5, 5 × 10^n).
export function skalaOsi(min, max) {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (hi === lo) return { min: 0, max: 1, krok: 0.25 };
  const surowy = (hi - lo) / 5;
  const potega = 10 ** Math.floor(Math.log10(surowy));
  const krok = [1, 2, 2.5, 5, 10].map((x) => x * potega).find((x) => x >= surowy);
  return { min: Math.floor(lo / krok) * krok, max: Math.ceil(hi / krok) * krok, krok };
}

const zapis = (n) => {
  const z = Math.round(n * 100) / 100;
  return String(z).replace('.', ',');
};

function napis(tekst, opis, { lewo, gora, rozmiar, wyrownanie = 'left', kolor, pogrub = false, kat = 0 }) {
  const t = new fabric.FabricText(String(tekst), {
    fontFamily: opis.czcionka, fontSize: rozmiar ?? opis.rozmiar, fill: kolor || opis.kolor_tekstu,
    fontWeight: pogrub ? 'bold' : 'normal', ...BEZ,
  });
  // Położenie: punkt zaczepienia zależny od wyrównania (lewo/środek/prawo) i górna krawędź napisu.
  const x = wyrownanie === 'center' ? lewo - t.width / 2 : (wyrownanie === 'right' ? lewo - t.width : lewo);
  t.set({ left: x, top: gora, angle: kat });
  return t;
}

const kolorSerii = (opis, i) => opis.kolory[i % opis.kolory.length] || PALETA[i % PALETA.length];

// Wycinek koła jako ścieżka SVG (kąty w radianach, 0 = godzina 12, zgodnie z ruchem wskazówek).
function wycinek(cx, cy, r, r0, a0, a1) {
  const p = (rr, a) => [cx + rr * Math.sin(a), cy - rr * Math.cos(a)];
  const duzy = a1 - a0 > Math.PI ? 1 : 0;
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    // Pełne koło: dwa półokręgi.
    const [x1, y1] = p(r, 0);
    const [x2, y2] = p(r, Math.PI);
    let d = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2} A ${r} ${r} 0 1 1 ${x1} ${y1} Z`;
    if (r0 > 0) { const [a, b] = p(r0, 0); const [c, e] = p(r0, Math.PI); d += ` M ${a} ${b} A ${r0} ${r0} 0 1 0 ${c} ${e} A ${r0} ${r0} 0 1 0 ${a} ${b} Z`; }
    return d;
  }
  const [x1, y1] = p(r, a0);
  const [x2, y2] = p(r, a1);
  if (r0 <= 0) return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${duzy} 1 ${x2} ${y2} Z`;
  const [x3, y3] = p(r0, a1);
  const [x4, y4] = p(r0, a0);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${duzy} 1 ${x2} ${y2} L ${x3} ${y3} A ${r0} ${r0} 0 ${duzy} 0 ${x4} ${y4} Z`;
}

// Układa wykres w grupie g na podstawie danych { etykiety, serie }.
export function ulozWykres(g, dane = { etykiety: [], serie: [] }) {
  const o = normalizujWykres(g.wykres);
  g.wykres = o;
  const W = o.szerokosc;
  const H = o.wysokosc;
  const x0 = -W / 2;
  const y0 = -H / 2;
  const czesci = [];
  const r = o.rozmiar;
  const wiersz = r * 1.25;
  let gora = y0;
  if (o.tytul) {
    czesci.push(napis(o.tytul, o, { lewo: 0, gora, rozmiar: r * 1.3, wyrownanie: 'center', pogrub: true }));
    gora += r * 1.3 * 1.4;
  }
  const kolowy = o.rodzaj === 'kolo' || o.rodzaj === 'pierscien';
  // Legenda: serie (albo wycinki koła) w jednym albo kilku rzędach na dole.
  const pozycje = kolowy ? dane.etykiety : dane.serie.map((s) => s.nazwa);
  let dol = y0 + H;
  if (o.legenda && pozycje.length && (kolowy || dane.serie.length > 1 || dane.serie[0]?.nazwa)) {
    const elementy = pozycje.map((nazwa, i) => ({ nazwa: String(nazwa), i, szer: r * 1.3 + (String(nazwa).length * r * 0.62) + r * 2 }));
    const rzedy = [];
    let rzad = [];
    let szer = 0;
    for (const e of elementy) {
      if (rzad.length && szer + e.szer > W) { rzedy.push([rzad, szer]); rzad = []; szer = 0; }
      rzad.push(e); szer += e.szer;
    }
    if (rzad.length) rzedy.push([rzad, szer]);
    dol -= rzedy.length * wiersz + r * 0.6;
    rzedy.forEach(([lista, s], nr) => {
      let x = -s / 2;
      const y = dol + r * 0.6 + nr * wiersz;
      for (const e of lista) {
        czesci.push(new fabric.Rect({ left: x, top: y + r * 0.15, width: r * 0.9, height: r * 0.9, fill: kolorSerii(o, e.i), strokeWidth: 0, ...BEZ }));
        czesci.push(napis(e.nazwa, o, { lewo: x + r * 1.3, gora: y }));
        x += e.szer;
      }
    });
  }
  const pole = { lewo: x0, gora, prawo: x0 + W, dol };
  if (!dane.serie.length || !dane.etykiety.length) {
    czesci.push(new fabric.Rect({ left: x0, top: gora, width: W, height: Math.max(1, dol - gora), fill: 'transparent', stroke: '#b5b2aa', strokeWidth: 0.2, strokeDashArray: [1, 1], ...BEZ }));
    czesci.push(napis('Wybierz tabelę danych i kolumny z liczbami', o, { lewo: 0, gora: (gora + dol) / 2 - r / 2, wyrownanie: 'center', kolor: '#8a877f' }));
  } else if (kolowy) {
    const wart = (dane.serie[0]?.wartosci || []).map((v) => Math.max(0, v));
    const suma = wart.reduce((a, b) => a + b, 0) || 1;
    const R = Math.max(2, Math.min(W, dol - gora) / 2);
    const cx = 0;
    const cy = (gora + dol) / 2;
    const R0 = o.rodzaj === 'pierscien' ? R * 0.55 : 0;
    let a = 0;
    wart.forEach((v, i) => {
      if (v <= 0) return;
      const b = a + (v / suma) * Math.PI * 2;
      czesci.push(new fabric.Path(wycinek(cx, cy, R, R0, a, b), { fill: kolorSerii(o, i), stroke: '#ffffff', strokeWidth: 0.3, strokeLineJoin: 'round', ...BEZ }));
      if (o.etykiety_wartosci) {
        const srodek = (a + b) / 2;
        const rr = R0 ? (R + R0) / 2 : R * 0.65;
        const procent = `${Math.round((v / suma) * 100)}%`;
        czesci.push(napis(procent, o, { lewo: cx + rr * Math.sin(srodek), gora: cy - rr * Math.cos(srodek) - r / 2, wyrownanie: 'center', kolor: '#ffffff', pogrub: true }));
      }
      a = b;
    });
  } else {
    const wszystkie = dane.serie.flatMap((s) => s.wartosci);
    const skala = skalaOsi(Math.min(...wszystkie), Math.max(...wszystkie));
    const poziome = o.rodzaj === 'poziome';
    // Miejsce na podpisy osi: wartości z boku (albo pod spodem) i kategorie.
    const szerEtykiety = Math.min(W * 0.35, Math.max(...dane.etykiety.map((e) => String(e).length)) * r * 0.55 + r);
    const szerLiczb = Math.max(...[skala.min, skala.max].map((v) => zapis(v).length)) * r * 0.55 + r * 0.8;
    if (poziome) { pole.lewo += szerEtykiety; pole.dol -= o.os ? wiersz + r * 0.3 : 0; }
    else { pole.lewo += o.os ? szerLiczb : 0; pole.dol -= wiersz + r * 0.3; }
    pole.gora += o.etykiety_wartosci ? wiersz : r * 0.5;
    const szer = Math.max(1, pole.prawo - pole.lewo);
    const wys = Math.max(1, pole.dol - pole.gora);
    const naOs = (v) => (v - skala.min) / (skala.max - skala.min);
    // Siatka i podpisy wartości.
    for (let v = skala.min; v <= skala.max + 1e-9; v += skala.krok) {
      const f = naOs(v);
      if (poziome) {
        const x = pole.lewo + f * szer;
        if (o.siatka) czesci.push(new fabric.Line([x, pole.gora, x, pole.dol], { stroke: '#dedbd4', strokeWidth: 0.15, ...BEZ }));
        if (o.os) czesci.push(napis(zapis(v), o, { lewo: x, gora: pole.dol + r * 0.3, wyrownanie: 'center' }));
      } else {
        const y = pole.dol - f * wys;
        if (o.siatka) czesci.push(new fabric.Line([pole.lewo, y, pole.prawo, y], { stroke: '#dedbd4', strokeWidth: 0.15, ...BEZ }));
        if (o.os) czesci.push(napis(zapis(v), o, { lewo: pole.lewo - r * 0.4, gora: y - r / 2, wyrownanie: 'right' }));
      }
    }
    const n = dane.etykiety.length;
    const ileSerii = dane.serie.length;
    const zero = naOs(0);
    if (o.rodzaj === 'linia') {
      const krok = n > 1 ? szer / (n - 1) : 0;
      const x = (i) => (n > 1 ? pole.lewo + i * krok : pole.lewo + szer / 2);
      dane.serie.forEach((s, si) => {
        const punkty = s.wartosci.map((v, i) => ({ x: x(i), y: pole.dol - naOs(v) * wys }));
        const kolor = kolorSerii(o, si);
        if (punkty.length > 1) {
          const d = punkty.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
          czesci.push(new fabric.Path(d, { fill: '', stroke: kolor, strokeWidth: 0.5, strokeLineJoin: 'round', strokeLineCap: 'round', ...BEZ }));
        }
        punkty.forEach((p, i) => {
          czesci.push(new fabric.Circle({ left: p.x - 0.7, top: p.y - 0.7, radius: 0.7, fill: kolor, strokeWidth: 0, ...BEZ }));
          if (o.etykiety_wartosci) czesci.push(napis(zapis(s.wartosci[i]), o, { lewo: p.x, gora: p.y - r * 1.4, wyrownanie: 'center' }));
        });
      });
      dane.etykiety.forEach((e, i) => czesci.push(napis(e, o, { lewo: x(i), gora: pole.dol + r * 0.3, wyrownanie: 'center' })));
    } else {
      const pas = (poziome ? wys : szer) / n;
      const grubosc = (pas * 0.72) / ileSerii;
      dane.etykiety.forEach((e, i) => {
        dane.serie.forEach((s, si) => {
          const v = s.wartosci[i] ?? 0;
          const a = Math.min(naOs(v), zero);
          const b = Math.max(naOs(v), zero);
          const pocz = i * pas + pas * 0.14 + si * grubosc;
          const kolor = kolorSerii(o, si);
          if (poziome) {
            const y = pole.gora + pocz;
            czesci.push(new fabric.Rect({ left: pole.lewo + a * szer, top: y, width: Math.max(0.01, (b - a) * szer), height: grubosc, fill: kolor, strokeWidth: 0, ...BEZ }));
            if (o.etykiety_wartosci) czesci.push(napis(zapis(v), o, { lewo: pole.lewo + b * szer + r * 0.3, gora: y + grubosc / 2 - r / 2 }));
          } else {
            const x = pole.lewo + pocz;
            czesci.push(new fabric.Rect({ left: x, top: pole.dol - b * wys, width: grubosc, height: Math.max(0.01, (b - a) * wys), fill: kolor, strokeWidth: 0, ...BEZ }));
            if (o.etykiety_wartosci) czesci.push(napis(zapis(v), o, { lewo: x + grubosc / 2, gora: pole.dol - b * wys - r * 1.3, wyrownanie: 'center' }));
          }
        });
        if (poziome) czesci.push(napis(e, o, { lewo: pole.lewo - r * 0.4, gora: pole.gora + i * pas + pas / 2 - r / 2, wyrownanie: 'right' }));
        else czesci.push(napis(e, o, { lewo: pole.lewo + i * pas + pas / 2, gora: pole.dol + r * 0.3, wyrownanie: 'center' }));
      });
    }
    // Oś zera.
    if (poziome) { const x = pole.lewo + zero * szer; czesci.push(new fabric.Line([x, pole.gora, x, pole.dol], { stroke: '#6b6862', strokeWidth: 0.25, ...BEZ })); }
    else { const y = pole.dol - zero * wys; czesci.push(new fabric.Line([pole.lewo, y, pole.prawo, y], { stroke: '#6b6862', strokeWidth: 0.25, ...BEZ })); }
  }
  // Prostokąt rozmiaru na spodzie (przezroczysty) – grupa ma zawsze zadaną wielkość, także dla klikania.
  czesci.unshift(new fabric.Rect({ left: x0, top: y0, width: W, height: H, fill: 'rgba(0,0,0,0)', strokeWidth: 0, ...BEZ }));
  g.remove(...g.getObjects());
  g.add(...czesci);
  g.set({ width: W, height: H });
  g.setCoords();
  g.dirty = true;
  return g;
}

// Nowy wykres (jeszcze poza płótnem).
export function nowyWykres({ lewo = 0, gora = 0, opis = {} } = {}, uid) {
  const g = new fabric.Group([], {
    id: uid('o'), left: lewo, top: gora,
    layoutManager: new fabric.LayoutManager(new fabric.FixedLayout()),
    subTargetCheck: false, interactive: false,
    wykres: normalizujWykres(opis),
  });
  return g;
}

// Po skalowaniu uchwytem: zmienia się szerokość i wysokość wykresu, nie rozmiar pisma.
export function utrwalSkaleWykresu(g, dane) {
  if (!toWykres(g) || (Math.abs(g.scaleX - 1) < 1e-6 && Math.abs(g.scaleY - 1) < 1e-6)) return false;
  g.wykres = { ...normalizujWykres(g.wykres), szerokosc: Math.round(g.wykres.szerokosc * Math.abs(g.scaleX) * 10) / 10, wysokosc: Math.round(g.wykres.wysokosc * Math.abs(g.scaleY) * 10) / 10 };
  g.set({ scaleX: 1, scaleY: 1, flipX: false, flipY: false });
  ulozWykres(g, dane);
  return true;
}
