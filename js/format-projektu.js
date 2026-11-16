// Zmiana formatu ze skalowaniem (#131D): nowy format sekcji (albo wszystkich sekcji projektu) i to, co dzieje
// się z elementami stron i wzorców tych sekcji:
//  • 'skaluj'   – wszystko proporcjonalnie (elementy, pismo, linie, marginesy, prowadnice), skala z dopasowania:
//                 'szerokosc' | 'wysokosc' | 'zmiesc' (mieści się cała strona), wyśrodkowane w nowym formacie;
//  • 'przesun'  – rozmiary zostają, elementy trzymają się najbliższej krawędzi albo środka (tło na całą stronę
//                 rozciąga się do nowego formatu);
//  • 'format'   – zmienia się tylko format.
// Okładki liczone same (#119) pomijamy – przeliczą się po zmianie środka. Czysta funkcja na danych projektu
// (bez płótna) – tę samą logikę widać w podglądzie okna i w testach.

import { FORMATY } from './projekt.js';

export const SPOSOBY = { skaluj: 'Skaluj wszystko', przesun: 'Zostaw rozmiary, przesuń względem krawędzi', format: 'Tylko zmień format' };
export const DOPASOWANIA = { zmiesc: 'Zmieść całą stronę', szerokosc: 'Dopasuj szerokość', wysokosc: 'Dopasuj wysokość' };

const zaokr = (v) => Math.round(v * 1000) / 1000;

export function nazwaFormatu(sz, wy) {
  for (const [n, [a, b]] of Object.entries(FORMATY)) {
    if ((Math.abs(sz - a) < 0.05 && Math.abs(wy - b) < 0.05) || (Math.abs(sz - b) < 0.05 && Math.abs(wy - a) < 0.05)) return n;
  }
  return 'wlasny';
}

// Skala i przesunięcie (mm) dla przejścia ze starego formatu na nowy.
export function przeliczenie(stary, nowy, sposob = 'skaluj', dopasowanie = 'zmiesc') {
  const kx = nowy.szerokosc_mm / stary.szerokosc_mm;
  const ky = nowy.wysokosc_mm / stary.wysokosc_mm;
  if (sposob !== 'skaluj') return { s: 1, dx: 0, dy: 0, kx, ky };
  const s = dopasowanie === 'szerokosc' ? kx : dopasowanie === 'wysokosc' ? ky : Math.min(kx, ky);
  return {
    s, kx, ky,
    dx: (nowy.szerokosc_mm - stary.szerokosc_mm * s) / 2,
    dy: (nowy.wysokosc_mm - stary.wysokosc_mm * s) / 2,
  };
}

// Rozmiar elementu (prostokąt opisany bez obrotu – wystarczy do kotwiczenia).
function rozmiar(o) {
  return { w: (o.width || 0) * Math.abs(o.scaleX ?? 1), h: (o.height || 0) * Math.abs(o.scaleY ?? 1) };
}

// Pismo: zamiast skali elementu zmienia się rozmiar liter (tekst dalej łamie się do ramki o nowej szerokości).
function skalujTekst(o, s) {
  o.width = zaokr((o.width || 0) * s);
  if (o.height) o.height = zaokr(o.height * s);
  if (o.fontSize) o.fontSize = zaokr(o.fontSize * s);
  if (o.strokeWidth) o.strokeWidth = zaokr(o.strokeWidth * s);
  if (Array.isArray(o.styles)) {
    for (const z of o.styles) if (z?.style?.fontSize) z.style.fontSize = zaokr(z.style.fontSize * s);
  } else {
    for (const wiersz of Object.values(o.styles || {})) {
      for (const z of Object.values(wiersz || {})) if (z && typeof z === 'object' && z.fontSize) z.fontSize = zaokr(z.fontSize * s);
    }
  }
}

const tekstowy = (o) => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text' || o.type === 'Textbox' || o.type === 'IText';

// Jeden element na nowej stronie.
export function przeksztalcElement(o, stary, nowy, p, sposob) {
  if (!o || typeof o !== 'object' || sposob === 'format') return;
  if (sposob === 'skaluj') {
    o.left = zaokr((o.left || 0) * p.s + p.dx);
    o.top = zaokr((o.top || 0) * p.s + p.dy);
    if (tekstowy(o)) skalujTekst(o, p.s);
    else {
      o.scaleX = zaokr((o.scaleX ?? 1) * p.s);
      o.scaleY = zaokr((o.scaleY ?? 1) * p.s);
    }
    return;
  }
  // 'przesun': kotwica do najbliższej krawędzi albo środka; element na (prawie) całą szerokość/wysokość (≥ 80%) rozciąga się.
  const { w, h } = rozmiar(o);
  const W = stary.szerokosc_mm;
  const H = stary.wysokosc_mm;
  const dW = nowy.szerokosc_mm - W;
  const dH = nowy.wysokosc_mm - H;
  const cx = (o.left || 0) + w / 2;
  const cy = (o.top || 0) + h / 2;
  if (w >= W * 0.8) {
    if (tekstowy(o)) o.width = zaokr((o.width || 0) + dW);
    else o.scaleX = zaokr((o.scaleX ?? 1) * (w + dW) / Math.max(w, 1e-6));
  } else if (cx > W * (2 / 3)) o.left = zaokr((o.left || 0) + dW);
  else if (cx >= W / 3) o.left = zaokr((o.left || 0) + dW / 2);
  if (h >= H * 0.8 && !tekstowy(o)) o.scaleY = zaokr((o.scaleY ?? 1) * (h + dH) / Math.max(h, 1e-6));
  else if (cy > H * (2 / 3)) o.top = zaokr((o.top || 0) + dH);
  else if (cy >= H / 3) o.top = zaokr((o.top || 0) + dH / 2);
}

function przeksztalcProwadnice(pr, stary, nowy, p, sposob) {
  if (!pr || sposob === 'format') return;
  const os = (lista, kotwiczSz) => (lista || []).map((poz) => {
    if (sposob === 'skaluj') return zaokr(poz * p.s + (kotwiczSz ? p.dx : p.dy));
    const D = kotwiczSz ? stary.szerokosc_mm : stary.wysokosc_mm;
    const d = kotwiczSz ? nowy.szerokosc_mm - D : nowy.wysokosc_mm - D;
    return poz > D * (2 / 3) ? zaokr(poz + d) : poz >= D / 3 ? zaokr(poz + d / 2) : poz;
  });
  if (pr.x) pr.x = os(pr.x, true);
  if (pr.y) pr.y = os(pr.y, false);
}

function noweMarginesy(m, p, sposob) {
  if (sposob !== 'skaluj') return { ...m };
  const r = {};
  for (const [k, v] of Object.entries(m || {})) r[k] = zaokr(v * p.s);
  return r;
}

// Zmienia format sekcji `idSekcji` (lista) w projekcie (w miejscu). nowyWymiar: { szerokosc_mm, wysokosc_mm }.
// Zwraca { sekcje, strony, wzorce, pominieteOkladki } – co się zmieniło.
export function zmienFormat(projekt, idSekcji, nowyWymiar, { sposob = 'skaluj', dopasowanie = 'zmiesc' } = {}) {
  const wynik = { sekcje: [], strony: 0, wzorce: 0, pominieteOkladki: [] };
  const sekcje = projekt.sekcje.filter((s) => idSekcji.includes(s.id));
  const wzorceZmienione = new Set();
  for (const sekcja of sekcje) {
    // Okładka i sekcje specjalne z własnym arkuszem (#177) liczą format same.
    if (sekcja.okladka || (sekcja.specjalna && sekcja.specjalna.rodzaj !== 'kalendarz')) { wynik.pominieteOkladki.push(sekcja.nazwa); continue; }
    const stary = { ...sekcja.wydruk };
    const nowy = { ...stary, szerokosc_mm: nowyWymiar.szerokosc_mm, wysokosc_mm: nowyWymiar.wysokosc_mm };
    if (Math.abs(stary.szerokosc_mm - nowy.szerokosc_mm) < 1e-6 && Math.abs(stary.wysokosc_mm - nowy.wysokosc_mm) < 1e-6) continue;
    const p = przeliczenie(stary, nowy, sposob, dopasowanie);
    for (const strona of projekt.strony.filter((x) => x.sekcja === sekcja.id)) {
      for (const o of strona.obiekty || []) przeksztalcElement(o, stary, nowy, p, sposob);
      przeksztalcProwadnice(strona.prowadnice, stary, nowy, p, sposob);
      wynik.strony += 1;
    }
    // Wzorce tej sekcji o jej dotychczasowym formacie zmieniają się razem z nią.
    for (const id of sekcja.wzorce || []) {
      const wz = (projekt.wzorce || []).find((x) => x.id === id);
      if (!wz || wzorceZmienione.has(id)) continue;
      const ww = wz.wydruk || stary;
      if (Math.abs((ww.szerokosc_mm ?? stary.szerokosc_mm) - stary.szerokosc_mm) > 0.05 || Math.abs((ww.wysokosc_mm ?? stary.wysokosc_mm) - stary.wysokosc_mm) > 0.05) continue;
      for (const o of wz.obiekty || []) przeksztalcElement(o, stary, nowy, p, sposob);
      przeksztalcProwadnice(wz.prowadnice, stary, nowy, p, sposob);
      if (wz.wydruk) {
        wz.wydruk = { ...wz.wydruk, szerokosc_mm: nowy.szerokosc_mm, wysokosc_mm: nowy.wysokosc_mm, format: nazwaFormatu(nowy.szerokosc_mm, nowy.wysokosc_mm) };
        if (wz.wydruk.marginesy) wz.wydruk.marginesy = noweMarginesy(wz.wydruk.marginesy, p, sposob);
      }
      wzorceZmienione.add(id);
      wynik.wzorce += 1;
    }
    sekcja.wydruk = {
      ...stary,
      szerokosc_mm: nowy.szerokosc_mm,
      wysokosc_mm: nowy.wysokosc_mm,
      format: nazwaFormatu(nowy.szerokosc_mm, nowy.wysokosc_mm),
      marginesy: noweMarginesy(stary.marginesy, p, sposob),
    };
    wynik.sekcje.push(sekcja.id);
  }
  return wynik;
}

// Elementy, które po zmianie wychodzą poza stronę (z tolerancją spadu) – do ostrzeżenia po zmianie.
export function elementyPozaStrona(projekt, idSekcji) {
  const lista = [];
  for (const sekcja of projekt.sekcje.filter((s) => idSekcji.includes(s.id))) {
    const { szerokosc_mm: W, wysokosc_mm: H, spad_mm: sp = 0 } = sekcja.wydruk;
    for (const strona of projekt.strony.filter((x) => x.sekcja === sekcja.id)) {
      for (const o of strona.obiekty || []) {
        const { w, h } = rozmiar(o);
        if (!w && !h) continue;
        if ((o.left || 0) + w < -sp - 0.5 || (o.top || 0) + h < -sp - 0.5 || (o.left || 0) > W + sp + 0.5 || (o.top || 0) > H + sp + 0.5
          || (o.left || 0) + w > W + sp + 0.5 || (o.top || 0) + h > H + sp + 0.5 || (o.left || 0) < -sp - 0.5 || (o.top || 0) < -sp - 0.5) {
          lista.push({ strona: strona.nazwa, id: o.id });
        }
      }
    }
  }
  return lista;
}
