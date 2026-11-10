/* global fabric */
// Tabela jako jeden element strony.
//
// Tabela to grupa Fabric z opisem w polu `tabela`:
//   { kolumny: [szerokości mm], wiersze: [najmniejsze wysokości mm], naglowek, linia: { kolor, grubosc } }
// W grupie leżą ramki tekstu komórek (wierszami, od lewej) i – za nimi – linie siatki.
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

export function miejsceKomorki(g, komorka) {
  const i = komorkiTabeli(g).indexOf(komorka);
  const K = g.tabela.kolumny.length;
  return i < 0 ? null : { w: Math.floor(i / K), k: i % K };
}

// Rzeczywiste wysokości wierszy (po ostatnim ułożeniu).
export function wysokosciWierszy(g) {
  const K = g.tabela.kolumny.length;
  const komorki = komorkiTabeli(g);
  return g.tabela.wiersze.map((min, w) => komorki[w * K]?.ramka_h || min);
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
  const wys = t.wiersze.map((min) => Math.max(MIN_WIERSZ, min));
  // Pomiar: szerokość komórki z kolumny, wysokość treści wyznacza wysokość wiersza.
  komorki.forEach((c, i) => {
    const k = i % K;
    const w = Math.floor(i / K);
    c.autodopasowanie = undefined;
    c.set({ width: Math.max(1, t.kolumny[k] - 2 * ODSTEP_X), ...BEZ_PRZEKSZTALCEN });
    c.initDimensions();
    if (w < W) wys[w] = Math.max(wys[w], (c._wysokoscTresci ?? c.height) + 2 * ODSTEP_Y);
  });
  const SZER = suma(t.kolumny);
  const WYS = suma(wys);
  let y = -WYS / 2;
  for (let w = 0; w < W; w += 1) {
    let x = -SZER / 2;
    for (let k = 0; k < K; k += 1) {
      const c = komorki[w * K + k];
      if (c) {
        // Ramka komórki zajmuje cały wiersz – kliknięcie gdziekolwiek w komórce trafia w jej tekst.
        c.ramka_h = wys[w];
        c.height = wys[w];
        c.set({ left: x + ODSTEP_X, top: y });
        c.setCoords();
        c.dirty = true;
      }
      x += t.kolumny[k];
    }
    y += wys[w];
  }

  // Linie siatki: pionowe na granicach kolumn, poziome na granicach wierszy.
  const potrzeba = K + 1 + W + 1;
  let linie = g.getObjects().filter((o) => o.type === 'line');
  if (linie.length > potrzeba) g.remove(...linie.slice(potrzeba));
  if (linie.length < potrzeba) g.add(...Array.from({ length: potrzeba - linie.length }, () => new fabric.Line([0, 0, 1, 0], { evented: false, selectable: false, strokeUniform: true })));
  linie = g.getObjects().filter((o) => o.type === 'line');
  const kolor = t.linia?.kolor || '#1a1a1a';
  const grubosc = Math.max(0, t.linia?.grubosc ?? 0.25);
  const ustaw = (l, x1, y1, x2, y2, mnoznik = 1) => {
    l.set({ stroke: kolor, strokeWidth: grubosc * mnoznik, visible: grubosc > 0, evented: false, selectable: false, ...BEZ_PRZEKSZTALCEN });
    l.set({ x1, y1, x2, y2 }); // linia sama ustawia się środkiem między końcami
    l.setCoords();
  };
  let x = -SZER / 2;
  for (let k = 0; k <= K; k += 1) {
    ustaw(linie[k], x, -WYS / 2, x, WYS / 2);
    x += t.kolumny[k] || 0;
  }
  y = -WYS / 2;
  for (let w = 0; w <= W; w += 1) {
    ustaw(linie[K + 1 + w], -SZER / 2, y, SZER / 2, y, t.naglowek && w === 1 && W > 1 ? 2 : 1);
    y += wys[w] || 0;
  }

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
  return k < 0 || w < 0 ? null : komorkiTabeli(g)[w * t.kolumny.length + k] || null;
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
  g.insertAt((po + 1) * K, ...nowe);
  t.wiersze.splice(po + 1, 0, t.wiersze[Math.max(wzor, 0)] ?? t.wiersze.at(-1));
  ulozTabele(g);
  return po + 1;
}

export function usunWiersz(g, w = g.tabela.wiersze.length - 1) {
  const t = g.tabela;
  if (t.wiersze.length <= 1 || !(w >= 0 && w < t.wiersze.length)) return false;
  const K = t.kolumny.length;
  g.remove(...komorkiTabeli(g).slice(w * K, (w + 1) * K));
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
    g.insertAt(w * K + po + 1, nowaKomorka(uid, pierwszy ? `Kolumna ${K + 1}` : '', wygladKomorki(komorki[w * K + po])));
  }
  const szer = suma(t.kolumny);
  t.kolumny = t.kolumny.map((s) => zaokr((s * K) / (K + 1)));
  t.kolumny.splice(po + 1, 0, zaokr(szer / (K + 1)));
  ulozTabele(g);
  return po + 1;
}

export function usunKolumne(g, k = g.tabela.kolumny.length - 1) {
  const t = g.tabela;
  const K = t.kolumny.length;
  if (K <= 1 || !(k >= 0 && k < K)) return false;
  const komorki = komorkiTabeli(g);
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
  for (const l of g.getObjects()) if (l.type === 'line') l.set({ evented: false, selectable: false });
}
