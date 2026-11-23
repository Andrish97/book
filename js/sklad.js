/* global fabric */
// Skład tekstu jak w programach DTP (#131): dzielenie wyrazów, spójniki na końcu wiersza, tabulatory,
// inicjał, oblewanie tekstem i siatka linii bazowych. Łatka na fabric.Textbox – działa tak samo
// w edytorze, w podglądzie, w miniaturach i w PDF (ten sam układ wierszy i to samo rysowanie).
//
// Tekst bez tych ustawień łamie się dokładnie jak dotąd (zwykły algorytm Fabric). Z nimi wiersze
// układa sklad(): wiersz to kawałek akapitu; znak spacji albo tabulatora na granicy wierszy znika
// (jak w Fabric), a przy podziale w środku słowa nic nie znika i wiersz dostaje łącznik `-`
// rysowany na końcu (nie jest w treści – pola z danymi i kopiowanie działają bez zmian).
//
// Właściwości tekstu:
//   dziel_wyrazy (bool), dziel_min (najkrótszy dzielony wyraz, 5), dziel_przed / dziel_po (2/2),
//   spojniki: true – jednoliterowe (a, i, o, u, w, z) nie zostają na końcu wiersza; 'dwuliterowe' – także
//     do, na, od, po, we, za, ze, że, iż, ku, bo, by, ni,
//   wdowy: najmniej wierszy akapitu na końcu i na początku ramki (watki.js, przelewanie),
//   inicjal: liczba wierszy (2–5) inicjału pierwszego akapitu; inicjal_czcionka, inicjal_kolor,
//   tabulatory: [{ poz (mm od lewej krawędzi ramki), rodzaj: lewy|srodek|prawy|dziesietny, wypelniacz: ''|'.'|'-'|'_' }],
//   do_siatki: wiersze na siatce linii bazowych sekcji (wydruk.siatka_bazowa: { odstep, przesuniecie } w mm),
//   bez_oblewania: tekst nie opływa innych elementów.
// Właściwości każdego elementu: oblewanie: 'prostokat' | 'ksztalt' | 'skok', oblewanie_odstep (mm).

import { miejscaPodzialu } from './dzielenie.js';
import { powodWiazania, DWULITEROWE } from './zasady-skladu.js';

const PT = 25.4 / 72;

export const POLA_SKLADU = ['zasady_pl', 'lamanie_akapitu', 'dziel_wyrazy', 'dziel_min', 'dziel_przed', 'dziel_po', 'spojniki', 'wdowy', 'inicjal', 'inicjal_czcionka', 'inicjal_kolor', 'tabulatory', 'do_siatki', 'bez_oblewania'];

function wplywaNaUklad(k) {
  const T = fabric.Textbox;
  if (!T.textLayoutProperties.includes(k)) T.textLayoutProperties = [...T.textLayoutProperties, k];
  if (!T.cacheProperties.includes(k)) T.cacheProperties = [...T.cacheProperties, k];
}

// Wcięcie listy (wypunktowanie i numery z tekst-ramka.js) – zajmuje lewą część szerokości.
export const wciecieListy = (o) => (o.lista ? o.fontSize * (o.lista === 'numery' ? 1.9 : 1.2) : 0);

const SPOJNIKI_1 = new Set(['a', 'i', 'o', 'u', 'w', 'z']);
function spojnik(o, slowo) {
  if (!o.spojniki) return false;
  const s = slowo.toLocaleLowerCase('pl');
  return SPOJNIKI_1.has(s) || (o.spojniki === 'dwuliterowe' && DWULITEROWE.has(s));
}
// Czy między wyrazami a i b nie wolno złamać wiersza: spójniki według ustawienia, a z polskimi zasadami składu
// (#323) także skróty, inicjały, liczba z jednostką, datą albo dalszymi cyframi i myślnik na początku wiersza.
function wiazane(o, a, b) {
  return spojnik(o, a) || Boolean(o.zasady_pl && powodWiazania(a, b));
}

const inicjalAktywny = (o) => o.inicjal >= 2 && !(o.watek && o.watek_nr > 0 && (o.lacznik ?? '\n') !== '\n');
const maTab = (o) => typeof o.text === 'string' && o.text.includes('\t');

// Czy tekst potrzebuje składu (inaczej – zwykłe łamanie Fabric, bez żadnej zmiany).
export function skladAktywny(o) {
  return Boolean(o.zasady_pl || o.lamanie_akapitu || o.dziel_wyrazy || o.spojniki || inicjalAktywny(o) || o._przeszkody?.length || o.tabulatory?.length || maTab(o));
}

// ---------- Tabulatory ----------

const DOMYSLNY_TAB = 12.5; // mm – co tyle stoją domyślne tabulatory za ostatnim ustawionym
function nastepnyTab(o, x) {
  const lista = (o.tabulatory || []).filter((t) => t.poz > x + 0.01).sort((a, b) => a.poz - b.poz);
  if (lista.length) return lista[0];
  const ostatni = Math.max(0, ...(o.tabulatory || []).map((t) => t.poz));
  const poz = ostatni + Math.max(1, Math.ceil((x + 0.01 - ostatni) / DOMYSLNY_TAB)) * DOMYSLNY_TAB;
  return { poz, rodzaj: 'lewy', domyslny: true };
}
// Szerokość tabulatora stojącego w punkcie x, gdy tekst za nim (do następnego tabulatora) ma
// szerokość `za`, a do przecinka/kropki dziesiętnej – `doPrzecinka`.
function szerTabulatora(o, x, za, doPrzecinka) {
  const t = nastepnyTab(o, x);
  let koniec = t.poz;
  if (t.rodzaj === 'prawy') koniec = t.poz - za;
  else if (t.rodzaj === 'srodek') koniec = t.poz - za / 2;
  else if (t.rodzaj === 'dziesietny') koniec = t.poz - doPrzecinka;
  return { szer: Math.max(o.fontSize * 0.15, koniec - x), tab: t };
}

// ---------- Inicjał ----------

let kontekstMiary = null;
function miara() {
  if (!kontekstMiary) {
    const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    kontekstMiary = c ? c.getContext('2d') : null;
  }
  return kontekstMiary;
}

// Geometria inicjału: litera, stopień pisma (tak, by sięgała od wysokości wielkich liter pierwszego
// wiersza do linii bazowej wiersza N), szerokość z odstępem.
function geometriaInicjalu(o, akapit) {
  const litera = o.graphemeSplit(akapit || '')[0];
  if (!litera || /\s/.test(litera)) return null;
  const styl = { ...o.getCompleteStyleDeclaration?.(0, 0) };
  const rodzina = o.inicjal_czcionka || styl.fontFamily || o.fontFamily;
  const ctx = miara();
  const n = Math.max(2, Math.min(5, Math.round(o.inicjal)));
  const wiersz = o.fontSize * o._fontSizeMult * o.lineHeight;
  let wysWielkich = o.fontSize * 0.7;
  let wysLitery = 0.7;
  let szerNa1 = 0.65;
  const deklaracja = (rozmiar, r = rodzina) => o._getFontDeclaration({ fontFamily: r, fontSize: rozmiar, fontWeight: styl.fontWeight, fontStyle: styl.fontStyle });
  if (ctx) {
    ctx.font = deklaracja(100, styl.fontFamily || o.fontFamily);
    const h = ctx.measureText('H').actualBoundingBoxAscent;
    if (h > 0) wysWielkich = (h / 100) * o.fontSize;
    ctx.font = deklaracja(100);
    const m = ctx.measureText(litera);
    if (m.actualBoundingBoxAscent > 0) wysLitery = m.actualBoundingBoxAscent / 100;
    if (m.width > 0) szerNa1 = m.width / 100;
  }
  const wysokosc = (n - 1) * wiersz + wysWielkich;
  const rozmiar = wysokosc / wysLitery;
  const szer = szerNa1 * rozmiar + o.fontSize * 0.25;
  return { litera, rozmiar, szer, n, rodzina, styl };
}

// ---------- Oblewanie: przeszkody w układzie tekstu ----------

// Przedział [x0, x1] zajęty przez wielokąt w pasie [y0, y1] (albo null).
function przedzialWPasie(punkty, y0, y1) {
  let min = Infinity;
  let max = -Infinity;
  const dodaj = (x) => { if (x < min) min = x; if (x > max) max = x; };
  for (let i = 0; i < punkty.length; i += 1) {
    const a = punkty[i];
    const b = punkty[(i + 1) % punkty.length];
    if (a.y >= y0 && a.y <= y1) dodaj(a.x);
    for (const yy of [y0, y1]) {
      if ((a.y - yy) * (b.y - yy) < 0) dodaj(a.x + ((yy - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  return min <= max ? [min, max] : null;
}

// Wolny kawałek wiersza [x, x + w] w pasie [y0, y1] przy szerokości `szer`, albo { skok: y }, gdy
// przeszkody zasłaniają cały wiersz (y – pod najniższą z nich).
function wolneMiejsce(o, y0, y1, szer, przesuniecieX) {
  const zajete = [];
  let nizej = -Infinity;
  for (const p of o._przeszkody || []) {
    const od = p.odstep || 0;
    if (p.y1 + od < y0 || p.y0 - od > y1) continue;
    const pr = przedzialWPasie(p.punkty, y0 - od, y1 + od);
    if (!pr) continue;
    nizej = Math.max(nizej, p.y1 + od);
    if (p.skok) zajete.push([-Infinity, Infinity]);
    else zajete.push([pr[0] - od - przesuniecieX, pr[1] + od - przesuniecieX]);
  }
  if (!zajete.length) return null;
  zajete.sort((a, b) => a[0] - b[0]);
  const wolne = [];
  let x = 0;
  for (const [a, b] of zajete) {
    if (a > x) wolne.push([x, Math.min(a, szer)]);
    x = Math.max(x, b);
    if (x >= szer) break;
  }
  if (x < szer) wolne.push([x, szer]);
  const uzyteczne = wolne.filter(([a, b]) => b - a >= Math.max(o.fontSize * 3, szer * 0.15));
  if (!uzyteczne.length) return { skok: nizej };
  const pierwszy = uzyteczne.find(([a, b]) => b - a >= szer * 0.4) || uzyteczne.reduce((m, w) => (w[1] - w[0] > m[1] - m[0] ? w : m));
  return { x: pierwszy[0], w: pierwszy[1] - pierwszy[0] };
}

// ---------- Łamanie wierszy ----------

const maxRozmiar = (o, akapit, od, doZnaku) => {
  let r = 0;
  const st = o.styles?.[akapit];
  for (let i = od; i < Math.max(doZnaku, od + 1); i += 1) r = Math.max(r, st?.[i]?.fontSize ?? o.fontSize);
  return r || o.fontSize;
};

// ---------- Łamanie całego akapitu naraz (#326) ----------
// Jak „kompozytor akapitu” w programach DTP (Knuth–Plass): spośród wszystkich dopuszczalnych miejsc złamania
// wybiera zestaw o najmniejszej sumie kar – nierówne odstępy (justowanie) albo poszarpana prawa krawędź, łączniki
// (także kilka pod rząd), krótki ostatni wiersz. Zasady (spójniki, skróty, myślnik, limity dzielenia) – twarde.
// Zwraca listę wierszy jak sklad() albo null (akapit bez rozwiązania – wtedy łamanie wiersz po wierszu).
function lamAkapitu(o, zn, slowa, W, { dziel, pl, szer, lacznikSzer, tekstSlowa }) {
  const justuj = o.textAlign === 'justify';
  // Kawałki: wyrazy podzielone w miejscach dzielenia.
  const fr = [];
  for (let k = 0; k < slowa.length; k += 1) {
    const s = slowa[k];
    const t = tekstSlowa(k);
    const ostatni = k === slowa.length - 1;
    let miejsca = [];
    if (dziel && t.length === s.do - s.od && !(pl && (ostatni || /^[„"(]?\p{Lu}/u.test(t)))) miejsca = miejscaPodzialu(t, dziel);
    const granice = [s.od, ...miejsca.map((m) => s.od + m), s.do];
    for (let i = 0; i < granice.length - 1; i += 1) {
      fr.push({ od: granice[i], do: granice[i + 1], k, poczatek: i === 0, koniec: i === granice.length - 2, w: szer(granice[i], granice[i + 1]), spacja: i === 0 && k > 0 ? szer(s.od - 1, s.od) : 0 });
    }
  }
  const n = fr.length;
  if (!n) return null;
  const cum = [0];
  const sp = [0];
  for (let i = 0; i < n; i += 1) { cum.push(cum[i] + fr[i].spacja + fr[i].w); sp.push(sp[i] + fr[i].spacja); }
  const hyph = lacznikSzer();
  const MAX_L = 3;
  const INF = Infinity;
  // best[i * 4 + h]: najmniejsza kara do wiersza zaczynającego się kawałkiem i po h dzielonych wierszach pod rząd.
  const best = new Float64Array((n + 1) * 4).fill(INF);
  const skad = new Int32Array((n + 1) * 4).fill(-1);
  best[0] = 0;
  for (let a = 0; a < n; a += 1) {
    for (let h = 0; h < 4; h += 1) {
      const baza = best[a * 4 + h];
      if (baza === INF) continue;
      for (let b = a; b < n; b += 1) {
        const ostatniWiersz = b === n - 1;
        const lacznik = !fr[b].koniec;
        const nat = cum[b + 1] - cum[a] - fr[a].spacja + (lacznik ? hyph : 0);
        const spacje = sp[b + 1] - sp[a + 1];
        const scisk = pl && justuj && !ostatniWiersz ? 0.2 * spacje : 0;
        if (nat > W + scisk + 0.001) {
          if (b === a) return null; // kawałek szerszy niż wiersz
          break;
        }
        // Czy wolno tu złamać.
        if (!ostatniWiersz) {
          if (lacznik) { if (pl && h >= MAX_L) continue; }
          else if (wiazane(o, tekstSlowa(fr[b].k), tekstSlowa(fr[b].k + 1))) continue;
        }
        let kara;
        if (ostatniWiersz) {
          kara = 0;
          // krótki ostatni wiersz (jeden wyraz krótszy niż 4 litery) w akapicie z kilku wierszy
          if (pl && a > 0 && fr[a].poczatek && fr[a].k === fr[b].k && tekstSlowa(fr[b].k).replace(/[^\p{L}\d]/gu, '').length < 4) kara += 3000;
        } else {
          const luz = W - nat;
          let r;
          if (!justuj) r = luz / (W * 0.33); // poszarpana krawędź: kara za dużą dziurę na końcu wiersza
          else if (luz < 0) r = luz / scisk; // ściśnięte odstępy (polskie zasady, do 20%)
          else if (spacje > 0) r = luz / spacje; // rozciągnięte odstępy: 1 = dwa razy szersze
          else r = luz > 0.5 ? 10 : 0; // jeden wyraz w justowanym wierszu
          // Kara rośnie z kwadratem rozciągnięcia (1 = odstępy dwa razy szersze); łącznik kosztuje mniej więcej tyle,
          // co wiersz z odstępami o połowę szerszymi, dwa łączniki pod rząd – drugie tyle.
          kara = (1 + 10 * r * r) ** 2;
          if (lacznik) kara += 2500 + (h > 0 ? 2500 : 0);
        }
        const nh = lacznik && !ostatniWiersz ? Math.min(3, h + 1) : 0;
        const cel = (b + 1) * 4 + (ostatniWiersz ? 0 : nh);
        if (baza + kara < best[cel]) { best[cel] = baza + kara; skad[cel] = a * 4 + h; }
      }
    }
  }
  if (best[n * 4] === INF) return null;
  // Odtworzenie wierszy od końca.
  const lamania = [];
  for (let st = n * 4; st > 0; st = skad[st]) {
    if (skad[st] < 0) return null;
    lamania.push([Math.floor(skad[st] / 4), Math.floor(st / 4) - 1]);
  }
  lamania.reverse();
  return lamania.map(([a, b]) => {
    const lacznik = b < n - 1 && !fr[b].koniec;
    const od = fr[a].od;
    const linia = zn.slice(od, b === n - 1 ? zn.length : fr[b].do);
    linia.lacznik = lacznik;
    linia.odstepPo = 0;
    linia._od = od;
    linia._do = b === n - 1 ? zn.length : fr[b].do;
    return linia;
  });
}

function sklad(o, linieTekstu, szerokoscRamki) {
  const wciecie = wciecieListy(o);
  const baza = szerokoscRamki - wciecie;
  const wynik = [];
  // Polskie zasady (#323): nie mniej niż 2 litery przed łącznikiem i 3 po nim, najwyżej 3 dzielone wiersze pod rząd,
  // bez dzielenia ostatniego wyrazu akapitu i wyrazów od wielkiej litery (nazwy własne, skróty).
  const pl = Boolean(o.zasady_pl);
  const dziel = o.dziel_wyrazy ? { min: o.dziel_min || 5, przed: Math.max(pl ? 2 : 1, o.dziel_przed || 2), po: Math.max(pl ? 3 : 1, o.dziel_po || 2) } : null;
  const MAX_LACZNIKOW = 3;
  let laczniki = 0; // dzielone wiersze pod rząd
  const inicjal = inicjalAktywny(o) ? geometriaInicjalu(o, linieTekstu[0]) : null;
  o._inicjal = inicjal;
  o._odstepGory = 0;
  let y = 0;
  let niepodzielne = 0;
  const wysokoscWiersza = (akapit, od, doZnaku) => maxRozmiar(o, akapit, od, doZnaku) * o._fontSizeMult * o.lineHeight;

  for (let p = 0; p < linieTekstu.length; p += 1) {
    const zn = o.graphemeSplit(linieTekstu[p]);
    laczniki = 0;
    const szer = (od, doZnaku) => (doZnaku > od ? o._measureWord(zn.slice(od, doZnaku), p, od) : 0);
    // Słowa: [od, do) i znak po nich (spacja, tabulator albo koniec akapitu).
    const slowa = [];
    for (let i = 0, od = 0; i <= zn.length; i += 1) {
      if (i === zn.length || zn[i] === ' ' || zn[i] === '\t') { slowa.push({ od, do: i, sep: zn[i] ?? null }); od = i + 1; }
    }
    // Łamanie całego akapitu naraz (#326) – akapit bez przeszkód, inicjału i tabulatorów.
    if (o.lamanie_akapitu && !o._przeszkody?.length && !(inicjal && p === 0) && !zn.includes('\t') && slowa.length > 1) {
      const tekstSlowa = (i) => zn.slice(slowa[i].od, slowa[i].do).join('');
      const linie = lamAkapitu(o, zn, slowa, baza, { dziel, pl, szer, lacznikSzer: () => o._measureWord(['-'], p, 0), tekstSlowa });
      if (linie) {
        for (const linia of linie) {
          wynik.push(linia);
          y += wysokoscWiersza(p, linia._od, linia._do);
          delete linia._od; delete linia._do;
        }
        continue;
      }
    }
    let nrWAkapicie = 0;
    let start = 0; // początek bieżącego wiersza (znak akapitu)
    let x = 0; // szerokość bieżącego wiersza
    let slowWWierszu = 0;
    let spacjeWWierszu = 0; // suma szerokości spacji w bieżącym wierszu (ściskanie przy justowaniu)
    let miejsce = null;
    const geometria = () => {
      let pr = { x: 0, w: baza };
      for (let proba = 0; proba < 50; proba += 1) {
        const h = wysokoscWiersza(p, start, Math.min(zn.length, start + 1));
        const wolne = o._przeszkody?.length ? wolneMiejsce(o, y, y + h, baza, wciecie) : null;
        if (wolne && wolne.skok !== undefined) {
          const dalej = Math.max(wolne.skok, y + 0.1);
          if (wynik.length) wynik[wynik.length - 1].odstepPo += dalej - y; else o._odstepGory += dalej - y;
          y = dalej;
          continue;
        }
        if (wolne) pr = wolne;
        break;
      }
      if (inicjal && p === 0 && nrWAkapicie < inicjal.n) {
        const lewo = Math.max(pr.x, inicjal.szer);
        pr = { x: lewo, w: Math.max(o.fontSize * 2, pr.x + pr.w - lewo) };
      }
      return pr;
    };
    const zamknij = (doZnaku, lacznik, nastepny) => {
      const linia = zn.slice(start, doZnaku);
      linia.lacznik = lacznik;
      laczniki = lacznik ? laczniki + 1 : 0;
      linia.odstepPo = 0;
      if (miejsce.x !== 0 || miejsce.w !== baza) { linia.x0 = miejsce.x; linia.w = miejsce.w; }
      wynik.push(linia);
      y += wysokoscWiersza(p, start, doZnaku);
      nrWAkapicie += 1;
      start = nastepny;
      x = 0;
      slowWWierszu = 0;
      spacjeWWierszu = 0;
      miejsce = geometria();
    };
    miejsce = geometria();
    const lacznikSzer = () => o._measureWord(['-'], p, Math.max(0, start));

    for (let k = 0; k < slowa.length; k += 1) {
      const s = slowa[k];
      let od = s.od;
      const sepPrzed = k > 0 ? slowa[k - 1].sep : null;
      // Odstęp przed słowem: spacja albo tabulator do najbliższej pozycji.
      const odstep = (szerSlowa) => {
        if (!slowWWierszu || !sepPrzed) return 0;
        if (sepPrzed === '\t') {
          const tekstZa = slowa.slice(k).map((w) => zn.slice(w.od, w.do).join('')).join(' ');
          const dz = /[.,]/.exec(tekstZa);
          return szerTabulatora(o, (miejsce.x || 0) + x, szerSlowa, dz ? szer(s.od, s.od + dz.index) : szerSlowa).szer;
        }
        return szer(s.od - 1, s.od);
      };
      for (let proba = 0; proba < 500; proba += 1) {
        const wSlowa = szer(od, s.do);
        const przerwa = odstep(wSlowa);
        // Justowanie z polskimi zasadami (#323): odstępy mogą się ścisnąć o 20% – w wierszu, który nie jest ostatnim
        // wierszem akapitu (ostatni nie jest justowany, więc nie może wystawać).
        const scisk = pl && o.textAlign === 'justify' && k < slowa.length - 1 && sepPrzed === ' ' ? 0.2 * (spacjeWWierszu + przerwa) : 0;
        if (!slowWWierszu || x + przerwa + wSlowa <= miejsce.w + scisk + 0.001) {
          // Mieści się (albo wiersz jest pusty – wtedy próbujemy dzielić słowo za długie na cały wiersz).
          if (slowWWierszu || wSlowa <= miejsce.w + 0.001 || !dziel) {
            if (!slowWWierszu && wSlowa > miejsce.w) niepodzielne = Math.max(niepodzielne, wSlowa);
            x += przerwa + wSlowa;
            if (slowWWierszu && sepPrzed === ' ') spacjeWWierszu += przerwa;
            slowWWierszu += 1;
            break;
          }
        }
        // Nie mieści się: dzielenie słowa.
        let podzial = -1;
        const tekstDz = zn.slice(od, s.do).join('');
        // (wyraz dłuższy niż cały wiersz dzieli się zawsze – inaczej wystawałby poza ramkę)
        const wolnoDzielic = dziel && (!pl || szer(od, s.do) > miejsce.w || (laczniki < MAX_LACZNIKOW && k < slowa.length - 1 && !/^[„"(]?\p{Lu}/u.test(tekstDz)));
        if (wolnoDzielic) {
          const tekst = tekstDz;
          if (tekst.length === s.do - od) {
            const miejsca = miejscaPodzialu(tekst, dziel);
            if (miejsca.length) {
              const wolne = miejsce.w - x - (slowWWierszu ? przerwa : 0) - lacznikSzer();
              // Szerokości przedrostków słowa jednym przejściem po znakach (bez mierzenia od nowa dla każdego miejsca).
              let suma = 0;
              let prev;
              let m = 0;
              for (let i = od; i < s.do && m < miejsca.length; i += 1) {
                suma += o._getGraphemeBox(zn[i], p, i, prev, true).kernedWidth;
                prev = zn[i];
                if (i + 1 - od === miejsca[m]) {
                  if (suma > wolne + 0.001) break;
                  podzial = od + miejsca[m];
                  m += 1;
                }
              }
            }
          }
        }
        if (podzial > od) {
          x += (slowWWierszu ? przerwa : 0) + szer(od, podzial);
          slowWWierszu += 1;
          zamknij(podzial, true, podzial);
          od = podzial;
          continue;
        }
        if (!slowWWierszu) {
          // Słowo za długie i nie do podzielenia – zostaje w wierszu, który się wydłuża.
          niepodzielne = Math.max(niepodzielne, wSlowa);
          x += wSlowa;
          slowWWierszu += 1;
          break;
        }
        // Przeniesienie do następnego wiersza; spójniki z końca wiersza (także kilka pod rząd: „i w”)
        // idą razem ze słowem, o ile w wierszu zostaje coś przed nimi.
        // (z polskimi zasadami – także skrót, inicjał, liczba z jednostką; myślnik nie zaczyna wiersza).
        const tekstSlowa = (i) => zn.slice(slowa[i].od, slowa[i].do).join('');
        let j = k - 1;
        while (j > 0 && slowa[j].od >= start && slowa[j - 1].do > start && wiazane(o, tekstSlowa(j), tekstSlowa(j + 1))) j -= 1;
        if (j < k - 1) {
          const pierwszy = slowa[j + 1];
          zamknij(pierwszy.od - 1, false, pierwszy.od);
          x = szer(pierwszy.od, slowa[k - 1].do);
          slowWWierszu = k - 1 - j;
        } else {
          zamknij(s.od - 1, false, s.od);
        }
      }
    }
    // Ostatni wiersz akapitu (także pusty akapit).
    const linia = zn.slice(start);
    linia.lacznik = false;
    linia.odstepPo = 0;
    if (miejsce.x !== 0 || miejsce.w !== baza) { linia.x0 = miejsce.x; linia.w = miejsce.w; }
    wynik.push(linia);
    y += wysokoscWiersza(p, start, zn.length);
  }
  const bezOgraniczen = !o._przeszkody?.length && !inicjal;
  if (bezOgraniczen && niepodzielne + wciecie > o.dynamicMinWidth) o.dynamicMinWidth = niepodzielne + wciecie;
  return wynik;
}

// Łatki na fabric.Textbox – raz, wywoływane z tekst-ramka.js (gdy Fabric jest już wczytany).
export function zalatajSklad() {
  const P = fabric.Textbox.prototype;
  if (P._skladZalatany) return;
  P._skladZalatany = true;
  for (const k of POLA_SKLADU) wplywaNaUklad(k);
  const zawijaj = P._wrapText;
  P._wrapText = function _wrapText(linie, szerokosc) {
    if (!skladAktywny(this)) { this._inicjal = null; this._odstepGory = 0; return zawijaj.call(this, linie, szerokosc); }
    this.isWrapping = true;
    try { return sklad(this, linie, szerokosc); } finally { this.isWrapping = false; }
  };

  // Przy podziale w środku słowa żaden znak nie znika między wierszami.
  const brakNowejLinii = P.missingNewlineOffset;
  P.missingNewlineOffset = function missingNewlineOffset(nr, bezZawijania) {
    if (!bezZawijania && this._textLines?.[nr]?.lacznik && !this.isEndOfWrapping(nr)) return 0;
    return brakNowejLinii.call(this, nr, bezZawijania);
  };

  // Pierwszy znak akapitu z inicjałem nie zajmuje miejsca w wierszu (rysuje go _renderText).
  const pudelkoZnaku = P._getGraphemeBox;
  P._getGraphemeBox = function _getGraphemeBox(znak, wiersz, nr, poprzedni, bezLewej) {
    const d = pudelkoZnaku.call(this, znak, wiersz, nr, poprzedni, bezLewej);
    if (nr === 0 && wiersz === 0 && this._inicjal) { d.width = 0; d.kernedWidth = 0; }
    return d;
  };

  const szerLacznika = (o, i) => {
    const linia = o._textLines[i];
    if (!linia.length) return 0;
    if (linia._szerL === undefined) {
      const styl = o.getCompleteStyleDeclaration(i, linia.length - 1);
      linia._szerL = o._measureChar('-', styl, linia[linia.length - 1], styl).kernedWidth + o._getWidthOfCharSpacing();
    }
    return linia._szerL;
  };

  const szerokoscLinii = P.getLineWidth;
  P.getLineWidth = function getLineWidth(i) {
    const w = szerokoscLinii.call(this, i);
    return this._textLines?.[i]?.lacznik ? w + szerLacznika(this, i) : w;
  };

  // Tabulatory: szerokość znaku tabulacji zależy od jego miejsca w wierszu.
  const mierzLinie = P._measureLine;
  P._measureLine = function _measureLine(i) {
    const wynik = mierzLinie.call(this, i);
    const linia = this._textLines[i];
    if (!linia || !linia.includes('\t') || this.path) return wynik;
    const granice = this.__charBounds[i];
    const lewo0 = (linia.x0 || 0) + wciecieListy(this);
    let przesun = 0;
    for (let k = 0; k < linia.length; k += 1) {
      const g = granice[k];
      g.left += przesun;
      if (linia[k] !== '\t') continue;
      // Tekst za tabulatorem (do następnego tabulatora albo końca wiersza).
      let za = 0;
      let doPrzecinka = -1;
      for (let j = k + 1; j < linia.length && linia[j] !== '\t'; j += 1) {
        if (doPrzecinka < 0 && (linia[j] === ',' || linia[j] === '.')) doPrzecinka = za;
        za += granice[j].kernedWidth;
      }
      const { szer, tab } = szerTabulatora(this, lewo0 + g.left, za, doPrzecinka < 0 ? za : doPrzecinka);
      przesun += szer - g.kernedWidth;
      g.width = szer;
      g.kernedWidth = szer;
      g.tab = tab;
    }
    granice[linia.length].left += przesun;
    wynik.width += przesun;
    return wynik;
  };

  // Położenie wiersza: wolny kawałek przy oblewaniu albo obok inicjału.
  const odLewej = P._getLineLeftOffset;
  P._getLineLeftOffset = function _getLineLeftOffset(i) {
    const linia = this._textLines?.[i];
    if (!linia || linia.w === undefined) return odLewej.call(this, i);
    const roznica = linia.w - this.getLineWidth(i);
    const a = this.textAlign;
    const koniec = this.isEndOfWrapping(i);
    let o = 0;
    if (a === 'center' || (a === 'justify-center' && koniec)) o = roznica / 2;
    else if (a === 'right' || (a === 'justify-right' && koniec)) o = roznica;
    return linia.x0 + o;
  };

  // Justowanie do szerokości wolnego kawałka wiersza; tabulatory się nie rozciągają.
  const rozciagnij = P.enlargeSpaces;
  P.enlargeSpaces = function enlargeSpaces() {
    if (!skladAktywny(this)) { rozciagnij.call(this); return; }
    const n = this._textLines.length;
    for (let i = 0; i < n; i += 1) {
      if (!(this.textAlign === 'justify' || (i !== n - 1 && !this.isEndOfWrapping(i)))) continue;
      // Ostatni wiersz akapitu zostaje wyrównany do lewej (jak w składzie książkowym).
      if (this.textAlign === 'justify' && this.isEndOfWrapping(i)) continue;
      const linia = this._textLines[i];
      const szer = linia.w ?? this.width;
      const teraz = this.getLineWidth(i);
      const spacje = linia.reduce((s, z) => s + (z === ' ' ? 1 : 0), 0);
      // Także ściśnięcie (wiersz dłuższy o ścisk odstępów – polskie zasady, #323).
      if (Math.abs(szer - teraz) < 0.001 || !spacje) continue;
      const dodatek = (szer - teraz) / spacje;
      // Luźny wiersz: odstępy ponad dwa razy szersze niż zwykle – do uwag o składzie.
      const zwykla = this.__charBounds[i]?.[linia.indexOf(' ')]?.width || 0;
      linia.luzny = zwykla > 0 && dodatek > zwykla * 1.0;
      let narastajaco = 0;
      for (let j = 0; j <= linia.length; j += 1) {
        const g = this.__charBounds[i][j];
        if (linia[j] === ' ') { g.width += dodatek; g.kernedWidth += dodatek; g.left += narastajaco; narastajaco += dodatek; } else g.left += narastajaco;
      }
    }
  };

  // Odstępy pionowe: skok pod przeszkodę i siatka linii bazowych.
  const wysokoscLinii = P.getHeightOfLine;
  P.getHeightOfLine = function getHeightOfLine(i) {
    return wysokoscLinii.call(this, i) + (this._textLines?.[i]?.odstepPo || 0);
  };
  const wysokoscTekstu = P.calcTextHeight;
  P.calcTextHeight = function calcTextHeight() {
    return wysokoscTekstu.call(this) + (this._odstepGory || 0);
  };

  // Siatka linii bazowych: linia bazowa każdego wiersza ląduje na najbliższej linii siatki poniżej.
  // o._siatka = { odstep, poczatek } – poczatek: położenie górnej krawędzi tekstu względem siatki (mm).
  function naSiatce(o) {
    const s = o._siatka;
    if (!o.do_siatki || !s || !(s.odstep > 0) || !o._textLines?.length) return false;
    let y = o._odstepGory || 0;
    let zmiana = false;
    for (let i = 0; i < o._textLines.length; i += 1) {
      const impl = o.getHeightOfLineImpl(i);
      const bazowa = y + impl * (1 - o._fontSizeFraction);
      const r = ((s.poczatek + bazowa) % s.odstep + s.odstep) % s.odstep;
      const dosun = r > 0.001 && s.odstep - r > 0.001 ? s.odstep - r : 0;
      if (dosun) {
        if (i === 0) o._odstepGory = (o._odstepGory || 0) + dosun; else o._textLines[i - 1].odstepPo += dosun;
        zmiana = true;
      }
      y += dosun + o.getHeightOfLine(i);
    }
    return zmiana;
  }

  const wymiary = P.initDimensions;
  P.initDimensions = function initDimensions() {
    wymiary.call(this);
    if (!this.initialized || !this._textLines) return;
    // Łącznik na końcu ramki, gdy słowo przechodzi do następnej ramki wątku (watki.js).
    if (this._lacznikNaKoncu) {
      const ost = this._textLines[this._textLines.length - 1];
      if (ost && ost.length && !ost.lacznik) { ost.lacznik = true; this.__lineWidths = []; this.__charBounds = []; this.textAlign.includes('justify') && this.enlargeSpaces(); }
    }
    for (const l of this._textLines) if (l.odstepPo === undefined) l.odstepPo = 0;
    if (naSiatce(this)) this.height = this.calcTextHeight();
  };

  // ---------- Rysowanie: łącznik, wypełniacze tabulatorów, inicjał ----------

  const rysujLinie = P._renderTextLine;
  P._renderTextLine = function _renderTextLine(metoda, ctx, linia, lewo, gora, i) {
    const bezInicjalu = i === 0 && this._inicjal && linia.length ? ['', ...linia.slice(1)] : linia;
    const granice = this.__charBounds?.[i];
    const y = gora - this.getHeightOfLineImpl(i) * this._fontSizeFraction;
    // Wiersz z tabulatorem: Fabric rysowałby go jednym napisem (przeglądarka nie zna naszych pozycji
    // tabulatorów) – znaki idą po kolei, każdy w swoim miejscu.
    if (granice && !this.path && linia.includes('\t')) {
      for (let k = 0; k < bezInicjalu.length; k += 1) {
        if (bezInicjalu[k] && bezInicjalu[k] !== '\t') this._renderChar(metoda, ctx, i, k, bezInicjalu[k], lewo + granice[k].left, y);
      }
    } else rysujLinie.call(this, metoda, ctx, bezInicjalu, lewo, gora, i);
    if (!granice || this.path) return;
    if (linia.lacznik && linia.length) {
      const ost = granice[linia.length - 1];
      this._renderChar(metoda, ctx, i, linia.length - 1, '-', lewo + ost.left + ost.kernedWidth, y);
    }
    for (let k = 0; k < linia.length; k += 1) {
      const g = granice[k];
      const wyp = g.tab?.wypelniacz;
      if (linia[k] !== '\t' || !wyp) continue;
      const styl = this.getCompleteStyleDeclaration(i, k);
      const krok = this._measureChar(`${wyp} `, styl, null, styl).kernedWidth;
      if (!(krok > 0)) continue;
      const ile = Math.floor((g.kernedWidth - krok * 0.5) / krok);
      if (ile > 0) this._renderChar(metoda, ctx, i, k, Array(ile).fill(wyp).join(' '), lewo + g.left + g.kernedWidth - ile * krok + krok * 0.25, y);
    }
  };

  const rysujTekst = P._renderText;
  P._renderText = function _renderText(ctx) {
    rysujTekst.call(this, ctx);
    const g = this._inicjal;
    if (!g || !this._textLines?.length) return;
    // Linia bazowa inicjału = linia bazowa wiersza N pierwszego akapitu (albo ostatniego wiersza).
    const n = Math.min(g.n, this._textLines.length) - 1;
    let y = this._getTopOffset();
    for (let i = 0; i < n; i += 1) y += this.getHeightOfLine(i);
    y += this.getHeightOfLineImpl(n) * (1 - this._fontSizeFraction);
    ctx.save();
    ctx.font = this._getFontDeclaration({ fontFamily: g.rodzina, fontSize: g.rozmiar, fontWeight: g.styl.fontWeight, fontStyle: g.styl.fontStyle });
    ctx.fillStyle = this.inicjal_kolor || (typeof g.styl.fill === 'string' ? g.styl.fill : '#000000');
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(g.litera, this._getLeftOffset() + wciecieListy(this), y);
    ctx.restore();
  };
}

// ---------- Wdowy i sieroty (przelewanie przez ramki) ----------

// k – ile wierszy ramka r zatrzymuje (reszta płynie dalej). Poprawia k tak, by z akapitu
// przeciętego granicą ramek zostało w tej ramce i przeszło dalej co najmniej `wdowy` wierszy.
export function poprawWdowy(r, k) {
  const min = Math.round(r.wdowy || 0);
  const n = r._textLines?.length || 0;
  if (min < 2 || k <= 0 || k >= n) return k;
  const akapit = (i) => r._styleMap?.[i]?.line;
  const p = akapit(k - 1);
  if (akapit(k) !== p) return k;
  let przed = 0;
  for (let i = k - 1; i >= 0 && akapit(i) === p; i -= 1) przed += 1;
  let po = 0;
  for (let i = k; i < n && akapit(i) === p; i += 1) po += 1;
  if (przed < min) return k - przed > 0 ? k - przed : k; // sierota: cały początek akapitu do następnej ramki
  if (po < min) {
    const przesun = min - po;
    if (przed - przesun >= min) return k - przesun; // wdowa: dodatkowe wiersze idą razem z nią
    return k - przed > 0 ? k - przed : k;
  }
  return k;
}

// ---------- Strona: przeszkody oblewania i siatka bazowa dla tekstów ----------

const KROK_ELIPSY = 32;
function punktyObiektu(ob) {
  const m = ob.calcTransformMatrix();
  const p = (x, y) => fabric.util.transformPoint(new fabric.Point(x, y), m);
  if (ob.oblewanie === 'ksztalt') {
    if (ob.type === 'ellipse' || ob.type === 'circle') {
      const rx = ob.rx ?? ob.radius;
      const ry = ob.ry ?? ob.radius;
      return Array.from({ length: KROK_ELIPSY }, (_, i) => p(Math.cos((i / KROK_ELIPSY) * Math.PI * 2) * rx, Math.sin((i / KROK_ELIPSY) * Math.PI * 2) * ry));
    }
    if ((ob.type === 'polygon' || ob.type === 'polyline') && ob.points?.length > 2) {
      return ob.points.map((q) => p(q.x - ob.pathOffset.x, q.y - ob.pathOffset.y));
    }
    if (ob.type === 'path' && Array.isArray(ob.path)) {
      const pkt = [];
      for (const s of ob.path) if (s.length >= 3) pkt.push(p(s[s.length - 2] - ob.pathOffset.x, s[s.length - 1] - ob.pathOffset.y));
      if (pkt.length > 2) return pkt;
    }
  }
  const w = ob.width / 2;
  const h = ob.height / 2;
  return [p(-w, -h), p(w, -h), p(w, h), p(-w, h)];
}

// Ustawia tekstom na stronie przeszkody (elementy z oblewaniem) i siatkę bazową; układa od nowa
// tylko teksty, którym coś się zmieniło. siatka: { odstep, przesuniecie } w mm albo null.
// Zwraca listę tekstów ułożonych od nowa.
export function ulozStrone(obiekty, { siatka = null } = {}) {
  const przeszkody = obiekty.filter((o) => o.oblewanie && o.visible !== false && o.type !== 'textbox');
  const zmienione = [];
  for (const t of obiekty) {
    if (t.type !== 'textbox') continue;
    let nowe = [];
    if (!t.bez_oblewania && przeszkody.length) {
      const odwrotna = fabric.util.invertTransform(t.calcTransformMatrix());
      for (const ob of przeszkody) {
        if (ob === t) continue;
        const odstep = Math.max(0, ob.oblewanie_odstep ?? 2);
        const pkt = punktyObiektu(ob).map((q) => {
          const l = fabric.util.transformPoint(q, odwrotna);
          return { x: Math.round((l.x + t.width / 2) * 100) / 100, y: Math.round((l.y + t.height / 2) * 100) / 100 };
        });
        const ys = pkt.map((q) => q.y);
        const xs = pkt.map((q) => q.x);
        // Przeszkoda zupełnie obok tekstu – pomijamy.
        if (Math.max(...xs) + odstep < 0 || Math.min(...xs) - odstep > t.width) continue;
        nowe.push({ punkty: pkt, y0: Math.min(...ys), y1: Math.max(...ys), odstep, skok: ob.oblewanie === 'skok' });
      }
    }
    if (!nowe.length) nowe = undefined;
    const s = siatka && siatka.odstep > 0 ? { odstep: siatka.odstep, poczatek: ((t.top || 0) - (siatka.przesuniecie || 0)) } : null;
    const podpis = JSON.stringify([nowe || null, s && t.do_siatki ? [Math.round(s.poczatek * 1000), s.odstep] : null]);
    if (podpis === t._podpisStrony) continue;
    const bylo = t._podpisStrony;
    t._podpisStrony = podpis;
    // Pierwsze spotkanie tekstu bez przeszkód i siatki – nic do zmiany, bez ponownego układania.
    if (bylo === undefined && !nowe && !(s && t.do_siatki)) continue;
    t._przeszkody = nowe;
    t._siatka = s;
    t.initDimensions();
    t.setCoords?.();
    t.dirty = true;
    zmienione.push(t);
  }
  return zmienione;
}

export const mmNaPt = (mm) => mm / PT;
