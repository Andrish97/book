/* global fabric */
// Gotowe sekcje (#166): szablony całych dokumentów – okładka, strona tytułowa, kalendarze, planery, notesy,
// zaproszenia, dyplomy, wizytówki, ulotki, katalogi, menu, gazetki, przepisy, albumy, etykiety…
//
// Każdy szablon to GENERATOR, nie zamrożony plik: dostaje format sekcji (wymiary, spad, marginesy), kolory
// (zestaw marki albo wybraną paletę), czcionki i odpowiedzi na pytania (rok, liczba stron) i dopiero wtedy
// buduje strony, wzorce, style, tabele danych i serie. Po wstawieniu to zwykła sekcja z elementami –
// wszystko zmienia się jak w każdym projekcie.
//
// Szablon: { id, nazwa, kategoria, opis, slowa, pytania?, format? ([szer, wys] mm – własny format szablonu,
//   np. wizytówka), uklad? ('rozkladowki'), okladka? (oprawa – sekcja okładki), schemat (podgląd w Bibliotece),
//   buduj(c) → { strony: [{ nazwa, obiekty, tlo?, seria?, wzorce? }], wzorce?: [{ klucz, nazwa, obiekty, lustro? }],
//   tabele?: [{ klucz, nazwa, kolumny, wiersze }], serie?: [{ klucz, nazwa, tabela, ... }], numeracja? } }
// Strona wskazuje serię kluczem (`seria: 'dni'`), seria tabelę kluczem – wstawianie zamienia klucze na id.
//
// Lista szablonów (nazwy, opisy, schematy) ładuje się bez Fabric – Biblioteka i testy w Node jej używają;
// tabele, kalendarze i ścieżki (grupy Fabric zapisane jako JSON) wczytują się dopiero przy wstawianiu.

import { uid, ptNaMm, nowaSekcja, nowaStrona, nowyWzorzec, nowaTabela, nowaSeria, normalizujWydruk, uporzadkujStrony, WZORCE_Z_SEKCJI } from './projekt.js';
import { szablonPlanera, zastosujSzablon } from './szablony-planera.js';
import { normalizujOkladke, geometriaOkladki } from './okladka.js';
import { domyslnaSpecjalna, geometriaSpecjalna, dodajWyklejki } from './sekcje-specjalne.js';
import { domyslneStyle } from './style-tekstu.js';

// Zależności rysujące – wczytywane raz, przy pierwszym wstawieniu.
let Z = null;
async function zaleznosci() {
  if (!Z) {
    const [, kal, tab] = await Promise.all([import('./fabric-ustawienia.js'), import('./kalendarz-miesiaca.js'), import('./tabela-obiekt.js')]);
    Z = { nowyKalendarz: kal.nowyKalendarz, nowaTabelaElement: tab.nowaTabela, komorkiTabeli: tab.komorkiTabeli, ulozTabele: tab.ulozTabele, ustawLinieZakresu: tab.ustawLinieZakresu, ustawKrawedzKomorki: tab.ustawKrawedzKomorki };
  }
  return Z;
}

// ---------- Kolory i czcionki ----------

export const PALETY = {
  granat: { nazwa: 'Granat i złoto', akcent: '#1f3a5f', akcent2: '#c9a24a', ciemny: '#16202c', tekst: '#2b2d31', jasny: '#eef2f7', linia: '#c5ccd6' },
  zielen: { nazwa: 'Zieleń i miód', akcent: '#2f6b4f', akcent2: '#d9a441', ciemny: '#1c2b24', tekst: '#2a2e2b', jasny: '#edf4ef', linia: '#c4d3c9' },
  terakota: { nazwa: 'Terakota', akcent: '#b5523b', akcent2: '#2d4a53', ciemny: '#2a1f1b', tekst: '#33302d', jasny: '#f7ece6', linia: '#e0c7bc' },
  pastel: { nazwa: 'Pastele', akcent: '#6f8fb5', akcent2: '#e29b8f', ciemny: '#2e3440', tekst: '#353a44', jasny: '#f1f4f9', linia: '#cdd6e3' },
  roz: { nazwa: 'Róż i śliwka', akcent: '#8e3b5f', akcent2: '#e7b3c3', ciemny: '#2c1c24', tekst: '#352a30', jasny: '#f8eef2', linia: '#e3c8d3' },
  mono: { nazwa: 'Czerń i biel', akcent: '#1a1a1a', akcent2: '#8a877f', ciemny: '#111111', tekst: '#2a2a2a', jasny: '#f1f0ec', linia: '#cfccc4' },
};

const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const doHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mieszaj = (a, b, t) => doHex(hex2(a).map((v, i) => v + (hex2(b)[i] - v) * t));
const jasnosc = (h) => { const [r, g, b] = hex2(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// Kolory z zestawu marki (#131D): pierwszy kolor to akcent, drugi – drugi akcent; reszta wyliczona.
export function paletaZMarki(marka) {
  const kolory = (marka?.kolory || []).map((k) => k.kolor).filter((k) => /^#[0-9a-f]{6}$/i.test(k || ''));
  if (!kolory.length) return null;
  const akcent = [...kolory].sort((a, b) => jasnosc(a) - jasnosc(b)).find((k) => jasnosc(k) < 170) || kolory[0];
  const akcent2 = kolory.find((k) => k !== akcent) || mieszaj(akcent, '#ffffff', 0.45);
  return {
    nazwa: 'Kolory marki', akcent, akcent2, ciemny: mieszaj(akcent, '#000000', 0.55), tekst: '#2a2a2a',
    jasny: mieszaj(akcent, '#ffffff', 0.9), linia: mieszaj(akcent, '#ffffff', 0.7),
  };
}

// ---------- Daty po polsku ----------

const MIES = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MIES_D = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const DNI = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const DNI_K = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
const wielka = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const dzienUtc = (rok, m, d) => new Date(Date.UTC(rok, m, d));
export const domyslnyRok = (teraz = new Date()) => teraz.getFullYear() + (teraz.getMonth() >= 8 ? 1 : 0);

// ---------- Elementy (JSON Fabric, milimetry) ----------

function narzedzia(c) {
  const { k, f } = c;
  const { nowyKalendarz, nowaTabelaElement, komorkiTabeli, ulozTabele, ustawLinieZakresu, ustawKrawedzKomorki } = Z;
  const tekst = (text, x, y, w, o = {}) => {
    const {
      pt = 10, font = f.tekst, bold = false, italic = false, kolor = k.tekst, align = 'left', lh = 1.25, cs = 0, nazwa, ...reszta
    } = o;
    // Najdłuższe słowo musi zmieścić się w ramce (słów się nie łamie) – inaczej pismo maleje.
    const slowo = String(text).replace(/\{[^}]*\}/g, 'xxxxxx').split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');
    const wielkie = slowo && slowo === slowo.toUpperCase() && /\p{L}/u.test(slowo);
    const naZnak = (bold ? 0.62 : 0.56) * (wielkie ? 1.22 : 1) + (cs / 1000);
    let rozmiar = c.pt(pt);
    if (slowo.length * rozmiar * naZnak > w) rozmiar = Math.max(c.pt(5), w / (slowo.length * naZnak));
    return {
      type: 'textbox', version: '5.3.0', id: c.uid('o'), text, styles: [], left: x, top: y, width: Math.max(4, w),
      fontFamily: font, fontSize: rozmiar, fontWeight: bold ? 'bold' : 'normal', fontStyle: italic ? 'italic' : 'normal',
      fill: kolor, textAlign: align, lineHeight: lh, charSpacing: cs, strokeWidth: 0, spojniki: true, zasady_pl: true, ...(nazwa ? { nazwa } : {}), ...reszta,
    };
  };
  const prost = (x, y, w, h, o = {}) => {
    const { fill = k.jasny, stroke = null, sw = 0, rx = 0, nazwa, ...reszta } = o;
    return {
      type: 'rect', version: '5.3.0', id: c.uid('o'), left: x, top: y, width: Math.max(0.1, w - sw), height: Math.max(0.1, h - sw), fill,
      stroke, strokeWidth: sw, strokeUniform: Boolean(sw), rx, ry: rx, ...(nazwa ? { nazwa } : {}), ...reszta,
    };
  };
  const elipsa = (x, y, w, h, o = {}) => {
    const { fill = k.jasny, stroke = null, sw = 0, nazwa, ...reszta } = o;
    return {
      type: 'ellipse', version: '5.3.0', id: c.uid('o'), left: x, top: y, rx: Math.max(0.1, (w - sw) / 2), ry: Math.max(0.1, (h - sw) / 2), fill,
      stroke, strokeWidth: sw, strokeUniform: Boolean(sw), ...(nazwa ? { nazwa } : {}), ...reszta,
    };
  };
  // Linia pozioma albo pionowa jako cienki prostokąt (bez kłopotu z końcówkami w PDF).
  const kreska = (x, y, w, h = 0.25, kolor = k.linia, nazwa) => prost(x, y, w, h, { fill: kolor, nazwa });
  const pion = (x, y, h, w = 0.25, kolor = k.linia) => prost(x, y, w, h, { fill: kolor });
  // Miejsce na zdjęcie: kształt, do którego wstawia się obraz (Obraz w kształcie, #123).
  const zdjecie = (x, y, w, h, o = {}) => prost(x, y, w, h, { fill: mieszaj(k.jasny, k.linia, 0.35), nazwa: 'Miejsce na zdjęcie', ...o });
  // Tło całej strony na spad.
  const tlo = (kolor, o = {}) => prost(-c.spad, -c.spad, c.W + 2 * c.spad, c.H + 2 * c.spad, { fill: kolor, nazwa: 'Tło', bez_ostrzezen: true, ...o });
  // Ścieżka z poleceń SVG w milimetrach strony (Fabric liczy położenie sam).
  const sciezka = (d, o = {}) => {
    const { nazwa, ...styl } = o;
    const p = new fabric.Path(d, { fill: '', stroke: k.linia, strokeWidth: 0.2, strokeUniform: true, ...styl });
    const j = p.toObject();
    j.id = c.uid('o');
    if (nazwa) j.nazwa = nazwa;
    return j;
  };
  // Linie do pisania, kratka i kropki w prostokącie.
  const linie = (x, y, w, h, krok = 8, kolor = k.linia) => {
    let d = '';
    for (let yy = y + krok; yy <= y + h + 0.01; yy += krok) d += `M ${x.toFixed(2)} ${yy.toFixed(2)} L ${(x + w).toFixed(2)} ${yy.toFixed(2)} `;
    return d ? sciezka(d.trim(), { stroke: kolor, strokeWidth: 0.2, nazwa: 'Linie do pisania' }) : null;
  };
  const kratka = (x, y, w, h, krok = 5, kolor = k.linia) => {
    const kol = Math.floor(w / krok); const wier = Math.floor(h / krok);
    const x0 = x + (w - kol * krok) / 2; const y0 = y + (h - wier * krok) / 2;
    let d = '';
    for (let i = 0; i <= kol; i += 1) d += `M ${(x0 + i * krok).toFixed(2)} ${y0.toFixed(2)} L ${(x0 + i * krok).toFixed(2)} ${(y0 + wier * krok).toFixed(2)} `;
    for (let i = 0; i <= wier; i += 1) d += `M ${x0.toFixed(2)} ${(y0 + i * krok).toFixed(2)} L ${(x0 + kol * krok).toFixed(2)} ${(y0 + i * krok).toFixed(2)} `;
    return sciezka(d.trim(), { stroke: kolor, strokeWidth: 0.15, nazwa: 'Kratka' });
  };
  const kropki = (x, y, w, h, krok = 5, kolor = k.linia) => {
    const kol = Math.floor(w / krok); const wier = Math.floor(h / krok);
    const x0 = x + (w - kol * krok) / 2; const y0 = y + (h - wier * krok) / 2; const r = 0.3;
    let d = '';
    for (let j = 0; j <= wier; j += 1) {
      for (let i = 0; i <= kol; i += 1) {
        const cx = x0 + i * krok; const cy = y0 + j * krok;
        d += `M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} A ${r} ${r} 0 1 0 ${(cx + r).toFixed(2)} ${cy.toFixed(2)} A ${r} ${r} 0 1 0 ${(cx - r).toFixed(2)} ${cy.toFixed(2)} Z `;
      }
    }
    return sciezka(d.trim(), { fill: kolor, stroke: null, strokeWidth: 0, nazwa: 'Kropki' });
  };
  // Pole do odhaczenia + opis.
  const punkt = (x, y, w, t, o = {}) => [prost(x, y + c.pt(o.pt || 9) * 0.15, c.pt(o.pt || 9) * 0.9, c.pt(o.pt || 9) * 0.9, { fill: '', stroke: k.akcent, sw: 0.25, rx: 0.4 }),
    tekst(t, x + c.pt(o.pt || 9) * 1.6, y, w - c.pt(o.pt || 9) * 1.6, { pt: o.pt || 9 })];
  // Ozdobnik: romb między liniami.
  const ozdobnik = (cx, y, w, kolor = k.akcent2) => {
    const r = Math.min(2.2, w / 20);
    return [kreska(cx - w / 2, y - 0.12, w / 2 - r * 1.8, 0.25, kolor), kreska(cx + r * 1.8, y - 0.12, w / 2 - r * 1.8, 0.25, kolor),
      { type: 'polygon', version: '5.3.0', id: c.uid('o'), left: cx - r, top: y - r, points: [{ x: r, y: 0 }, { x: 2 * r, y: r }, { x: r, y: 2 * r }, { x: 0, y: r }], fill: kolor, strokeWidth: 0, nazwa: 'Ozdobnik' }];
  };
  // Tabela z szablonu planera (tabela jako jeden element, js/tabela-obiekt.js).
  const tabelaPlanera = (id, x, y, w, o = {}) => {
    const s = { ...szablonPlanera(id), ...o };
    const g = nowaTabelaElement({ wiersze: s.wiersze, kolumny: s.kolumny.length, szerokosc: w, wysokoscWiersza: s.wysokosc, naglowek: Boolean(s.naglowek), lewo: x, gora: y, wyglad: { fontFamily: f.tekst, fill: k.tekst } }, c.uid);
    zastosujSzablon(g, s, w, { komorkiTabeli, ulozTabele, ustawLinieZakresu, ustawKrawedzKomorki });
    g.tabela.linia = { kolor: k.linia, grubosc: 0.2 };
    if (s.naglowek) g.tabela.tlo = { naglowek: k.jasny, zebra: null };
    ulozTabele(g);
    const j = g.toObject();
    j.nazwa = s.nazwa;
    return j;
  };
  // Zwykła tabela z treścią: wiersze [[tekst]] (pierwszy – nagłówek, gdy naglowek).
  const tabela = (x, y, szer, kolumny, wiersze, { wysokosc = 7, naglowek = true, pt = 8.5, nazwa = 'Tabela' } = {}) => {
    const g = nowaTabelaElement({ wiersze: wiersze.length, kolumny: kolumny.length, szerokosc: szer, wysokoscWiersza: wysokosc, naglowek, lewo: x, gora: y, wyglad: { fontFamily: f.tekst, fill: k.tekst, fontSize: c.pt(pt) } }, c.uid);
    const suma = kolumny.reduce((a, b) => a + b, 0);
    g.tabela.kolumny = kolumny.map((v) => Math.floor((v / suma) * szer * 100) / 100);
    komorkiTabeli(g).forEach((kom, i) => {
      const w = Math.floor(i / kolumny.length); const kk = i % kolumny.length;
      kom.set({ text: wiersze[w]?.[kk] ?? '', fontWeight: naglowek && w === 0 ? 'bold' : 'normal', fontSize: c.pt(pt) });
    });
    g.tabela.linia = { kolor: k.linia, grubosc: 0.2 };
    if (naglowek) g.tabela.tlo = { naglowek: k.jasny, zebra: null };
    ulozTabele(g);
    const j = g.toObject();
    j.nazwa = nazwa;
    return j;
  };
  // Kalendarz miesiąca (#131A): stały miesiąc albo z kolumny danych serii.
  const kalendarz = (x, y, w, o = {}) => {
    const { rok = c.rok, miesiac = 1, pole_daty, h, tytul = false, notatki = false, pt = 9, nazwy = 'skrot' } = o;
    // Siatka: wiersz nazw dni + 6 tygodni (+ tytuł o wysokości co najmniej 2,4 × pismo).
    const tyt = tytul ? c.pt(pt) * 2.4 : 0;
    const wiersz = h ? Math.max(3, Math.min(tytul ? h / 8 : Infinity, (h - tyt) / 7) - 0.15) : 9;
    const g = nowyKalendarz({
      rok, miesiac, szerokosc: w, lewo: x, gora: y, wyglad: { fontFamily: f.tekst, fill: k.tekst, fontSize: c.pt(pt) },
      opis: { ...(pole_daty ? { pole_daty } : {}), tytul, notatki, wiersz_dnia: Math.round(wiersz * 10) / 10, nazwy, kolory: { dni: k.tekst, naglowek: k.akcent, niedziele: '#c0392b', soboty: null, swieta: '#c0392b', inne: k.linia } },
    }, c.uid);
    g.tabela.linia = { kolor: k.linia, grubosc: 0.2 };
    ulozTabele(g);
    const j = g.toObject();
    j.nazwa = 'Kalendarz miesiąca';
    return j;
  };
  return { tekst, prost, elipsa, kreska, pion, zdjecie, tlo, sciezka, linie, kratka, kropki, punkt, ozdobnik, tabelaPlanera, tabela, kalendarz };
}

// Wzorzec ze stopką z numerem strony (żywa pagina w książce).
const stopkaNumer = (c, n, { pagina = false } = {}) => {
  const y = c.H - c.m.dol + Math.min(4, c.m.dol / 3);
  const o = [n.tekst('{nr}', c.pole.x, y, c.pole.w, { pt: 8, align: 'center', kolor: c.k.akcent, nazwa: 'Numer strony' })];
  if (pagina) o.push(n.tekst('{rozdzial}', c.pole.x, Math.max(2, c.m.gora - c.pt(8) * 2.4), c.pole.w, { pt: 7.5, align: 'center', kolor: c.k.akcent2, cs: 60, wielkosc_liter: 'wielkie', nazwa: 'Żywa pagina' }));
  return { klucz: 'stopka', nazwa: pagina ? 'Stopka i żywa pagina' : 'Numer strony', obiekty: o };
};

const ZDANIA = [
  'Każda dobra historia zaczyna się od jednego zdania, które zaprasza czytelnika dalej.',
  'Ten tekst zajmuje miejsce prawdziwej treści – wpisz tu własne słowa albo wklej gotowy rozdział.',
  'Akapity układają się same, a tekst, który nie mieści się w ramce, przechodzi na następną stronę.',
  'Wygląd całego tekstu zmienisz jednym ruchem, zmieniając styl „Tekst” w panelu właściwości.',
  'Dobre marginesy i spokojny krój pisma sprawiają, że czyta się lekko nawet długie strony.',
  'Zdjęcia i ilustracje wstawisz w miejsca oznaczone szarym polem – obraz sam się w nie dopasuje.',
];
const akapit = (n = 4, od = 0) => Array.from({ length: n }, (_, i) => ZDANIA[(i + od) % ZDANIA.length]).join(' ');

// ---------- Szablony ----------

export const KATEGORIE_SEKCJI = [
  { id: 'ksiazka', nazwa: 'Książka' },
  { id: 'kalendarze', nazwa: 'Kalendarze' },
  { id: 'planery', nazwa: 'Planery i notesy' },
  { id: 'okazje', nazwa: 'Zaproszenia i dyplomy' },
  { id: 'firma', nazwa: 'Firma i reklama' },
  { id: 'inne', nazwa: 'Inne' },
];

const pytanieRok = { klucz: 'rok', etykieta: 'Rok', typ: 'liczba', min: 2000, max: 2100, domyslna: () => domyslnyRok() };
const pytanieStron = (d, max = 400) => ({ klucz: 'stron', etykieta: 'Liczba stron', typ: 'liczba', min: 1, max, domyslna: () => d });

export const SZABLONY_SEKCJI = [
  // ---------- Książka ----------
  {
    id: 'okladka-ksiazki', nazwa: 'Okładka książki', kategoria: 'ksiazka', okladka: 'miekka', paleta: 'granat',
    opis: 'Przód, grzbiet i tył – grzbiet liczy się sam z liczby stron środka.', slowa: 'okladka ksiazki grzbiet tyl przod oprawa',
    pytania: [{ klucz: 'oprawa', etykieta: 'Oprawa', typ: 'wybor', opcje: [['miekka', 'Miękka klejona'], ['twarda', 'Twarda'], ['zeszytowa', 'Zeszytowa (zszywki)']], domyslna: () => 'miekka' }],
    schemat: [['tlo', 0, 0, 30, 42], ['akcent', 4, 8, 22, 1], ['tytul', 4, 12, 22, 5], ['tekst', 4, 33, 22, 2]],
    buduj(c, n) {
      const g = c.okladka;
      const strefa = (r) => g.strefy.find((z) => z.rodzaj === r) || { x1: 0, x2: 0 };
      const przod = strefa('przod'); const tyl = strefa('tyl'); const grzbiet = strefa('grzbiet');
      const y0 = g.gora; const wys = g.dol - g.gora;
      const mx = Math.max(10, c.m.zewnetrzny); const my = Math.max(12, c.m.gora);
      const pw = przod.x2 - przod.x1;
      const o = [
        { ...n.tlo(c.k.akcent), okladka: 'cala' },
        { ...n.kreska(przod.x1 + mx, y0 + my + wys * 0.12, Math.min(30, pw * 0.3), 0.6, c.k.akcent2), okladka: 'przod' },
        { ...n.tekst('Tytuł książki', przod.x1 + mx, y0 + my + wys * 0.16, pw - 2 * mx, { pt: 30, font: c.f.tytul, bold: true, kolor: '#ffffff', lh: 1.05, nazwa: 'Tytuł' }), okladka: 'przod' },
        { ...n.tekst('Podtytuł albo krótkie zdanie o książce', przod.x1 + mx, y0 + my + wys * 0.36, pw - 2 * mx, { pt: 12, kolor: mieszaj(c.k.akcent, '#ffffff', 0.8), italic: true, nazwa: 'Podtytuł' }), okladka: 'przod' },
        { ...n.tekst('IMIĘ NAZWISKO', przod.x1 + mx, y0 + wys - my - c.pt(11) * 1.4, pw - 2 * mx, { pt: 11, kolor: c.k.akcent2, cs: 120, nazwa: 'Autor' }), okladka: 'przod' },
        { ...n.tekst(akapit(3), tyl.x1 + mx, y0 + my + wys * 0.12, (tyl.x2 - tyl.x1) - 2 * mx, { pt: 9.5, kolor: '#ffffff', lh: 1.4, nazwa: 'Opis na tyle' }), okladka: 'tyl' },
        { ...n.prost(tyl.x2 - mx - 38, y0 + wys - my - 22, 38, 22, { fill: '#ffffff', nazwa: 'Miejsce na kod ISBN' }), okladka: 'tyl' },
      ];
      if (grzbiet.x2 - grzbiet.x1 >= 5) {
        const sz = grzbiet.x2 - grzbiet.x1; const pt = Math.min(11, (sz * 0.5) / ptNaMm(1) / c.s);
        o.push({ ...n.tekst('Tytuł książki · Imię Nazwisko', grzbiet.x1 + sz / 2 + c.pt(pt) * 0.6, y0 + my, wys - 2 * my, { pt, kolor: '#ffffff', align: 'center', angle: 90, lh: 1, nazwa: 'Grzbiet' }), okladka: 'grzbiet' });
      }
      return { strony: [{ nazwa: 'Okładka', obiekty: o }], numeracja: { tryb: 'brak', od: 1 } };
    },
  },
  {
    id: 'strona-tytulowa', nazwa: 'Strona tytułowa i redakcyjna', kategoria: 'ksiazka', paleta: 'granat',
    opis: 'Tytuł, autor i wydawca, a na odwrocie stopka redakcyjna.', slowa: 'strona tytulowa redakcyjna stopka isbn copyright',
    schemat: [['tytul', 6, 12, 18, 4], ['tekst', 8, 18, 14, 2], ['tekst', 9, 34, 12, 1.5]],
    buduj(c, n) {
      const { pole: p } = c;
      const s1 = [
        n.tekst('IMIĘ NAZWISKO', p.x, p.y + p.h * 0.18, p.w, { pt: 10, align: 'center', cs: 160, kolor: c.k.akcent2 }),
        n.tekst('Tytuł książki', p.x, p.y + p.h * 0.26, p.w, { pt: 26, font: c.f.tytul, bold: true, align: 'center', kolor: c.k.akcent, lh: 1.05, nazwa: 'Tytuł' }),
        n.tekst('Podtytuł książki', p.x, p.y + p.h * 0.42, p.w, { pt: 12, italic: true, align: 'center' }),
        ...n.ozdobnik(p.x + p.w / 2, p.y + p.h * 0.52, Math.min(50, p.w * 0.5)),
        n.tekst('Wydawnictwo · Miasto · Rok', p.x, p.y + p.h - c.pt(9) * 2, p.w, { pt: 9, align: 'center', kolor: c.k.akcent2 }),
      ];
      const s2 = [n.tekst('Copyright © Imię Nazwisko\nWszelkie prawa zastrzeżone.\n\nRedakcja: Imię Nazwisko\nKorekta: Imię Nazwisko\nProjekt okładki: Imię Nazwisko\nSkład: Makietka\n\nISBN 978-83-000-0000-0\n\nWydanie pierwsze\nWydawnictwo, ul. Przykładowa 1, 00-000 Miasto', p.x, p.y + p.h * 0.55, p.w, { pt: 8, lh: 1.45, kolor: c.k.tekst, nazwa: 'Stopka redakcyjna' })];
      return { strony: [{ nazwa: 'Strona tytułowa', obiekty: s1, wzorce: [] }, { nazwa: 'Strona redakcyjna', obiekty: s2, wzorce: [] }], numeracja: { tryb: 'brak', od: 1 } };
    },
  },
  {
    id: 'spis-tresci', nazwa: 'Spis treści', kategoria: 'ksiazka', paleta: 'granat',
    opis: 'Spis układa się sam z nagłówków projektu, z numerami stron.', slowa: 'spis tresci rozdzialy numery stron',
    schemat: [['tytul', 4, 6, 14, 3], ['linie', 4, 13, 22, 20]],
    buduj(c, n) {
      const { pole: p } = c;
      return {
        strony: [{
          nazwa: 'Spis treści',
          obiekty: [
            n.tekst('Spis treści', p.x, p.y, p.w, { pt: 22, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Tytuł spisu' }),
            n.kreska(p.x, p.y + c.pt(22) * 1.5, Math.min(30, p.w * 0.3), 0.5, c.k.akcent2),
            { ...n.tekst('', p.x, p.y + c.pt(22) * 2.2, p.w, { pt: 10.5, lh: 1.6 }), ksiazka: { rodzaj: 'spis', poziomy: 2, kropki: true }, nazwa: 'Spis treści' },
          ],
        }],
      };
    },
  },
  {
    id: 'rozdzial', nazwa: 'Rozdział', kategoria: 'ksiazka', uklad: 'rozkladowki', paleta: 'granat',
    opis: 'Otwarcie rozdziału i strony tekstu połączone w jeden ciąg – tekst przelewa się sam.', slowa: 'rozdzial tekst ksiazka powiesc akapity przelewanie',
    pytania: [pytanieStron(4, 40)],
    schemat: [['akcent', 4, 8, 6, 1], ['tytul', 4, 11, 18, 4], ['linie', 4, 19, 22, 18]],
    buduj(c, n) {
      const { pole: p } = c;
      const stron = Math.max(1, Math.min(40, c.opcje.stron || 4));
      const watek = c.uid('w');
      const styl = c.styl('Tekst');
      const tytul = c.styl('Tytuł');
      const pt = 10.5; const lh = 1.4;
      const naRamke = (h) => Math.max(200, Math.floor((p.w * h) / (c.pt(pt) * c.pt(pt) * lh * 0.52)));
      const tekstCaly = Array.from({ length: stron * 3 }, (_, i) => akapit(5, i)).join('\n');
      let reszta = tekstCaly;
      const ramka = (y, h, nr) => {
        const ile = naRamke(h);
        let kawalek = reszta.slice(0, ile);
        const ciecie = kawalek.lastIndexOf(' ');
        if (reszta.length > ile && ciecie > 0) kawalek = kawalek.slice(0, ciecie);
        reszta = reszta.slice(kawalek.length).replace(/^ /, '');
        return { ...n.tekst(kawalek, p.x, y, p.w, { pt, lh, align: 'justify', styl: styl?.id, ramka_h: h, nazwa: `Tekst rozdziału ${nr}` }), watek, watek_nr: nr, ...(nr > 1 ? { lacznik: ' ' } : {}), dziel_wyrazy: true, wdowy: 2 };
      };
      const otwarcieY = p.y + p.h * 0.38;
      const strony = [{
        nazwa: 'Rozdział – otwarcie',
        obiekty: [
          n.tekst('ROZDZIAŁ 1', p.x, p.y + p.h * 0.08, p.w, { pt: 9, cs: 200, kolor: c.k.akcent2, nazwa: 'Numer rozdziału' }),
          n.tekst('Tytuł rozdziału', p.x, p.y + p.h * 0.13, p.w, { pt: 24, font: c.f.tytul, bold: true, kolor: c.k.akcent, lh: 1.05, styl: tytul?.id, nazwa: 'Tytuł rozdziału' }),
          n.kreska(p.x, p.y + p.h * 0.3, Math.min(24, p.w * 0.25), 0.5, c.k.akcent2),
          ramka(otwarcieY, p.y + p.h - otwarcieY, 1),
        ],
      }];
      for (let i = 1; i < stron; i += 1) strony.push({ nazwa: `Rozdział – strona ${i + 1}`, obiekty: [ramka(p.y, p.h, i + 1)] });
      return { strony, wzorce: [stopkaNumer(c, n, { pagina: true })] };
    },
  },
  // ---------- Kalendarze ----------
  {
    id: 'kalendarz-scienny', nazwa: 'Kalendarz ścienny', kategoria: 'kalendarze', paleta: 'zielen',
    opis: 'Okładka i 12 miesięcy: zdjęcie u góry, siatka dni ze świętami pod spodem. Miesiące z danych.', slowa: 'kalendarz scienny miesiace zdjecia 12 rok swieta',
    pytania: [pytanieRok], dane: true,
    schemat: [['zdjecie', 3, 3, 24, 20], ['tytul', 3, 25, 12, 2], ['siatka', 3, 28, 24, 11]],
    buduj(c, n) {
      const { pole: p } = c;
      const rok = c.rok;
      const wiersze = MIES.map((m, i) => [`${rok}-${String(i + 1).padStart(2, '0')}`, `${wielka(m)}`]);
      const hZdj = p.h * 0.52;
      const yTyt = p.y + hZdj + 3;
      const yKal = yTyt + c.pt(18) * 1.5;
      const okladka = [
        n.zdjecie(-c.spad, -c.spad, c.W + 2 * c.spad, c.H * 0.68 + c.spad, { bez_ostrzezen: true }),
        n.tekst(String(rok), p.x, c.H * 0.72, p.w, { pt: 54, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Rok' }),
        n.tekst('Kalendarz', p.x, c.H * 0.72 + c.pt(54) * 1.05, p.w, { pt: 14, cs: 200, kolor: c.k.akcent2, wielkosc_liter: 'wielkie' }),
      ];
      const miesiac = [
        n.zdjecie(p.x, p.y, p.w, hZdj),
        n.tekst('{nazwa}', p.x, yTyt, p.w * 0.7, { pt: 18, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Nazwa miesiąca' }),
        n.tekst(String(rok), p.x + p.w * 0.7, yTyt + c.pt(18) * 0.25, p.w * 0.3, { pt: 12, align: 'right', kolor: c.k.akcent2 }),
        n.kalendarz(p.x, yKal, p.w, { pole_daty: 'miesiac', h: p.y + p.h - yKal, pt: 9 }),
      ];
      return {
        strony: [{ nazwa: 'Okładka kalendarza', obiekty: okladka, wzorce: [] }, { nazwa: 'Miesiąc', obiekty: miesiac, seria: 'miesiace' }],
        tabele: [{ klucz: 'miesiace', nazwa: `Miesiące ${rok}`, kolumny: ['miesiac', 'nazwa'], wiersze }],
        serie: [{ klucz: 'miesiace', nazwa: 'Miesiące', tabela: 'miesiace', uklad: 'dlugi' }],
        numeracja: { tryb: 'brak', od: 1 },
      };
    },
  },
  {
    id: 'kalendarz-biurkowy', nazwa: 'Kalendarz biurkowy', kategoria: 'kalendarze', format: [210, 148], paleta: 'pastel',
    opis: 'Poziome karty na stojak: miesiąc z miejscem na notatki i małym zdjęciem.', slowa: 'kalendarz biurkowy stojak poziomy notatki miesiac',
    pytania: [pytanieRok], dane: true,
    schemat: [['zdjecie', 2, 3, 10, 14], ['siatka', 14, 3, 14, 14], ['tytul', 2, 19, 10, 2]],
    buduj(c, n) {
      const { pole: p } = c;
      const rok = c.rok;
      const wiersze = MIES.map((m, i) => [`${rok}-${String(i + 1).padStart(2, '0')}`, wielka(m)]);
      const poziom = c.W >= c.H;
      const lewa = poziom ? p.w * 0.36 : p.w;
      const obiekty = poziom
        ? [
          n.zdjecie(p.x, p.y, lewa - 4, p.h * 0.62),
          n.tekst('{nazwa}', p.x, p.y + p.h * 0.66, lewa - 4, { pt: 20, font: c.f.tytul, bold: true, kolor: c.k.akcent }),
          n.tekst(String(rok), p.x, p.y + p.h * 0.66 + c.pt(20) * 1.3, lewa - 4, { pt: 11, kolor: c.k.akcent2, cs: 120 }),
          n.kalendarz(p.x + lewa + 2, p.y, p.w - lewa - 2, { pole_daty: 'miesiac', h: p.h, notatki: true, pt: 8.5 }),
        ]
        : [
          n.zdjecie(p.x, p.y, p.w, p.h * 0.3),
          n.tekst('{nazwa} ' + rok, p.x, p.y + p.h * 0.32, p.w, { pt: 18, font: c.f.tytul, bold: true, kolor: c.k.akcent }),
          n.kalendarz(p.x, p.y + p.h * 0.32 + c.pt(18) * 1.6, p.w, { pole_daty: 'miesiac', h: p.h * 0.68 - c.pt(18) * 1.6, notatki: true, pt: 8.5 }),
        ];
      return {
        strony: [{ nazwa: 'Miesiąc', obiekty, seria: 'miesiace' }],
        tabele: [{ klucz: 'miesiace', nazwa: `Miesiące ${rok}`, kolumny: ['miesiac', 'nazwa'], wiersze }],
        serie: [{ klucz: 'miesiace', nazwa: 'Miesiące', tabela: 'miesiace', uklad: 'dlugi' }],
        numeracja: { tryb: 'brak', od: 1 },
      };
    },
  },
  {
    id: 'kalendarz-roczny', nazwa: 'Kalendarz roczny na stronie', kategoria: 'kalendarze', paleta: 'granat',
    opis: 'Cały rok na jednej stronie: 12 małych miesięcy ze świętami.', slowa: 'kalendarz roczny caly rok jedna strona 12 miesiecy',
    pytania: [pytanieRok],
    schemat: [['tytul', 4, 3, 14, 3], ['siatka', 3, 8, 7, 7], ['siatka', 11.5, 8, 7, 7], ['siatka', 20, 8, 7, 7], ['siatka', 3, 17, 7, 7], ['siatka', 11.5, 17, 7, 7], ['siatka', 20, 17, 7, 7], ['siatka', 3, 26, 7, 7], ['siatka', 11.5, 26, 7, 7], ['siatka', 20, 26, 7, 7]],
    buduj(c, n) {
      const { pole: p } = c;
      const naglowek = c.pt(26) * 1.5;
      const kol = c.W >= c.H ? 4 : 3; const wier = 12 / kol;
      const odst = Math.max(3, p.w * 0.04);
      const w = (p.w - odst * (kol - 1)) / kol;
      const h = (p.h - naglowek - odst * (wier - 1)) / wier;
      const o = [n.tekst(String(c.rok), p.x, p.y, p.w, { pt: 26, font: c.f.tytul, bold: true, kolor: c.k.akcent, align: 'center', nazwa: 'Rok' })];
      for (let i = 0; i < 12; i += 1) {
        const x = p.x + (i % kol) * (w + odst);
        const y = p.y + naglowek + Math.floor(i / kol) * (h + odst);
        o.push(n.kalendarz(x, y, w, { rok: c.rok, miesiac: i + 1, tytul: true, h, pt: Math.max(5, Math.min(8, w / 6.5)), nazwy: 'litery' }));
      }
      return { strony: [{ nazwa: `Rok ${c.rok}`, obiekty: o, wzorce: [] }] };
    },
  },
  // ---------- Planery i notesy ----------
  {
    id: 'planer-dzienny', nazwa: 'Planer dzienny (365 dni)', kategoria: 'planery', paleta: 'terakota',
    opis: 'Strona na każdy dzień roku: data, priorytety, plan i notatki. Daty z danych – 1 strona-wzór.', slowa: 'planer dzienny dziennik 365 dni data rok dzien',
    pytania: [pytanieRok], dane: true,
    schemat: [['tytul', 3, 3, 14, 3], ['akcent', 3, 7, 24, 0.6], ['punkty', 3, 9, 11, 8], ['linie', 3, 19, 24, 20]],
    buduj(c, n) {
      const { pole: p } = c;
      const rok = c.rok;
      const wiersze = [];
      for (let d = dzienUtc(rok, 0, 1), i = 1; d.getUTCFullYear() === rok; d = dzienUtc(rok, d.getUTCMonth(), d.getUTCDate() + 1), i += 1) {
        wiersze.push([`${d.getUTCDate()} ${MIES_D[d.getUTCMonth()]}`, wielka(DNI[d.getUTCDay()]), String(i), wielka(MIES[d.getUTCMonth()])]);
      }
      const y1 = p.y + c.pt(20) * 1.6;
      const kol = (p.w - 4) / 2;
      const o = [
        n.tekst('{data}', p.x, p.y, p.w * 0.65, { pt: 20, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Data' }),
        n.tekst('{dzien_tygodnia}', p.x + p.w * 0.65, p.y + c.pt(20) * 0.3, p.w * 0.35, { pt: 10, align: 'right', kolor: c.k.akcent2, cs: 60, nazwa: 'Dzień tygodnia' }),
        n.kreska(p.x, y1, p.w, 0.5, c.k.akcent),
        n.tekst('NAJWAŻNIEJSZE', p.x, y1 + 3, kol, { pt: 7.5, cs: 140, kolor: c.k.akcent2 }),
        n.tekst('DO ZROBIENIA', p.x + kol + 4, y1 + 3, kol, { pt: 7.5, cs: 140, kolor: c.k.akcent2 }),
      ];
      const yP = y1 + 3 + c.pt(7.5) * 2;
      for (let i = 0; i < 3; i += 1) o.push(...n.punkt(p.x, yP + i * c.pt(9) * 1.9, kol, '', { pt: 9 }), n.kreska(p.x + c.pt(9) * 1.6, yP + i * c.pt(9) * 1.9 + c.pt(9) * 1.2, kol - c.pt(9) * 1.6));
      for (let i = 0; i < 5; i += 1) o.push(...n.punkt(p.x + kol + 4, yP + i * c.pt(9) * 1.9, kol, '', { pt: 9 }), n.kreska(p.x + kol + 4 + c.pt(9) * 1.6, yP + i * c.pt(9) * 1.9 + c.pt(9) * 1.2, kol - c.pt(9) * 1.6));
      const yN = yP + 5 * c.pt(9) * 1.9 + 3;
      o.push(n.tekst('NOTATKI', p.x, yN, p.w, { pt: 7.5, cs: 140, kolor: c.k.akcent2 }));
      const l = n.linie(p.x, yN + c.pt(7.5), p.w, p.y + p.h - yN - c.pt(7.5) - 6, 7);
      if (l) o.push(l);
      o.push(n.tekst('Dzień {dzien_roku} · {miesiac}', p.x, p.y + p.h - c.pt(7) * 1.4, p.w, { pt: 7, align: 'right', kolor: c.k.linia }));
      return {
        strony: [{ nazwa: 'Dzień', obiekty: o, seria: 'dni' }],
        tabele: [{ klucz: 'dni', nazwa: `Dni ${rok}`, kolumny: ['data', 'dzien_tygodnia', 'dzien_roku', 'miesiac'], wiersze }],
        serie: [{ klucz: 'dni', nazwa: 'Dni roku', tabela: 'dni', uklad: 'dlugi' }],
      };
    },
  },
  {
    id: 'planer-tygodniowy', nazwa: 'Planer tygodniowy (52 tygodnie)', kategoria: 'planery', paleta: 'zielen',
    opis: 'Tydzień na stronie: siedem pól z datami, cele tygodnia. Daty z danych.', slowa: 'planer tygodniowy tydzien 52 tygodnie daty',
    pytania: [pytanieRok], dane: true,
    schemat: [['tytul', 3, 3, 14, 2], ['siatka', 3, 7, 24, 32]],
    buduj(c, n) {
      const { pole: p } = c;
      const rok = c.rok;
      // Tygodnie od poniedziałku: pierwszy tydzień zawiera 1 stycznia.
      const start = dzienUtc(rok, 0, 1);
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      const wiersze = [];
      for (let t = 0; t < 53; t += 1) {
        const pon = dzienUtc(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + t * 7);
        if (t > 0 && pon.getUTCFullYear() > rok) break;
        const dni = Array.from({ length: 7 }, (_, i) => dzienUtc(pon.getUTCFullYear(), pon.getUTCMonth(), pon.getUTCDate() + i));
        const nd = dni[6];
        const zakres = `${dni[0].getUTCDate()} ${MIES_D[dni[0].getUTCMonth()]} – ${nd.getUTCDate()} ${MIES_D[nd.getUTCMonth()]}`;
        wiersze.push([String(t + 1), zakres, ...dni.map((d) => `${DNI_K[d.getUTCDay()]} ${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`)]);
      }
      const yG = p.y + c.pt(16) * 1.7;
      const o = [
        n.tekst('Tydzień {tydzien}', p.x, p.y, p.w * 0.5, { pt: 16, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Tydzień' }),
        n.tekst('{zakres}', p.x + p.w * 0.5, p.y + c.pt(16) * 0.25, p.w * 0.5, { pt: 9, align: 'right', kolor: c.k.akcent2 }),
      ];
      const kol = c.W >= c.H ? 4 : 2; const pol = 8; const wier = Math.ceil(pol / kol);
      const odst = 2.5;
      const w = (p.w - odst * (kol - 1)) / kol; const h = (p.y + p.h - yG - odst * (wier - 1)) / wier;
      for (let i = 0; i < pol; i += 1) {
        const x = p.x + (i % kol) * (w + odst); const y = yG + Math.floor(i / kol) * (h + odst);
        o.push(n.prost(x, y, w, h, { fill: i === pol - 1 ? c.k.jasny : '', stroke: c.k.linia, sw: 0.25, rx: 1.2 }));
        o.push(n.tekst(i < 7 ? `{d${i + 1}}` : 'Cele tygodnia', x + 2, y + 1.6, w - 4, { pt: 8.5, bold: true, kolor: i === 5 || i === 6 ? '#c0392b' : c.k.akcent }));
        const l = n.linie(x + 2, y + 1.6 + c.pt(8.5) * 0.6, w - 4, h - 3 - c.pt(8.5) * 0.6, 6);
        if (l) o.push(l);
      }
      return {
        strony: [{ nazwa: 'Tydzień', obiekty: o, seria: 'tygodnie' }],
        tabele: [{ klucz: 'tygodnie', nazwa: `Tygodnie ${rok}`, kolumny: ['tydzien', 'zakres', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'], wiersze }],
        serie: [{ klucz: 'tygodnie', nazwa: 'Tygodnie', tabela: 'tygodnie', uklad: 'dlugi' }],
      };
    },
  },
  {
    id: 'planer-miesieczny', nazwa: 'Planer miesięczny', kategoria: 'planery', paleta: 'pastel',
    opis: 'Miesiąc z miejscem na wpisy w każdym dniu, cele i notatki. 12 stron z danych.', slowa: 'planer miesieczny miesiac notatki cele',
    pytania: [pytanieRok], dane: true,
    schemat: [['tytul', 3, 3, 12, 2], ['siatka', 3, 7, 24, 22], ['linie', 3, 31, 24, 8]],
    buduj(c, n) {
      const { pole: p } = c;
      const rok = c.rok;
      const wiersze = MIES.map((m, i) => [`${rok}-${String(i + 1).padStart(2, '0')}`, `${wielka(m)} ${rok}`]);
      const yK = p.y + c.pt(18) * 1.6;
      const hK = p.h * 0.68;
      const o = [
        n.tekst('{nazwa}', p.x, p.y, p.w, { pt: 18, font: c.f.tytul, bold: true, kolor: c.k.akcent }),
        n.kalendarz(p.x, yK, p.w, { pole_daty: 'miesiac', h: hK, notatki: true, pt: 8 }),
        n.tekst('CELE I NOTATKI', p.x, yK + hK + 4, p.w, { pt: 7.5, cs: 140, kolor: c.k.akcent2 }),
      ];
      const l = n.linie(p.x, yK + hK + 4 + c.pt(7.5), p.w, p.y + p.h - (yK + hK + 4 + c.pt(7.5)), 7);
      if (l) o.push(l);
      return {
        strony: [{ nazwa: 'Miesiąc', obiekty: o, seria: 'miesiace' }],
        tabele: [{ klucz: 'miesiace', nazwa: `Miesiące ${rok}`, kolumny: ['miesiac', 'nazwa'], wiersze }],
        serie: [{ klucz: 'miesiace', nazwa: 'Miesiące', tabela: 'miesiace', uklad: 'dlugi' }],
      };
    },
  },
  ...[['notes-linie', 'Notes w linie', 'linie', 'linie zeszyt pisanie'], ['notes-kratka', 'Notes w kratkę', 'kratka', 'kratka zeszyt matematyka'], ['notes-kropki', 'Notes w kropki', 'kropki', 'kropki bullet journal dot grid']].map(([id, nazwa, rodzaj, slowa]) => ({
    id, nazwa, kategoria: 'planery', paleta: 'mono',
    opis: `Wybrana liczba stron ${rodzaj === 'linie' ? 'w linie co 8 mm' : rodzaj === 'kratka' ? 'w kratkę 5 mm' : 'w kropki co 5 mm'}, z miejscem na datę i numerem strony.`, slowa: `notes ${slowa}`,
    pytania: [pytanieStron(40, 400)],
    schemat: [['tekst', 18, 3, 9, 1], [rodzaj === 'linie' ? 'linie' : 'siatka', 3, 6, 24, 33]],
    buduj(c, n) {
      const { pole: p } = c;
      const y0 = p.y + c.pt(8) * 2.2;
      const wypelnienie = rodzaj === 'linie' ? n.linie(p.x, y0, p.w, p.y + p.h - y0, 8) : n[rodzaj](p.x, y0, p.w, p.y + p.h - y0, 5);
      const o = [
        n.tekst('Data: ……………………', p.x + p.w * 0.55, p.y, p.w * 0.45, { pt: 8, align: 'right', kolor: c.k.akcent2, nazwa: 'Data' }),
        wypelnienie,
      ].filter(Boolean);
      return {
        strony: [{ nazwa: nazwa, obiekty: o, seria: 'kartki' }],
        serie: [{ klucz: 'kartki', nazwa: 'Kartki notesu', tryb: 'stala', ile: Math.max(1, Math.min(400, c.opcje.stron || 40)) }],
        wzorce: [stopkaNumer(c, n)],
      };
    },
  })),
  {
    id: 'tracker-roczny', nazwa: 'Tracker roczny', kategoria: 'planery', paleta: 'roz',
    opis: 'Rok w pigułce: 12 kolumn miesięcy × 31 dni do kolorowania (nastrój, nawyk, czytanie).', slowa: 'tracker roczny rok w pigulce nastroj nawyk kolorowanie',
    pytania: [pytanieRok],
    schemat: [['tytul', 3, 3, 14, 2], ['siatka', 3, 7, 24, 32]],
    buduj(c, n) {
      const { pole: p } = c;
      const yT = p.y + c.pt(16) * 1.6;
      const lew = c.pt(7) * 2.4; const gor = c.pt(7) * 1.8;
      const kw = (p.w - lew) / 12; const kh = (p.y + p.h - yT - gor - c.pt(7) * 3) / 31;
      const o = [n.tekst(`Mój rok ${c.rok}`, p.x, p.y, p.w * 0.6, { pt: 16, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Tytuł' }),
        n.tekst('Co śledzę: …………………', p.x + p.w * 0.6, p.y + c.pt(16) * 0.3, p.w * 0.4, { pt: 8, align: 'right', kolor: c.k.akcent2 })];
      MIES.forEach((m, i) => o.push(n.tekst(wielka(m).slice(0, 3), p.x + lew + i * kw, yT, kw, { pt: 7, align: 'center', bold: true, kolor: c.k.akcent })));
      for (let d = 1; d <= 31; d += 1) o.push(n.tekst(String(d), p.x, yT + gor + (d - 1) * kh + Math.max(0, (kh - c.pt(7)) / 2), lew - 1, { pt: 7, align: 'right', kolor: c.k.akcent2 }));
      let dd = '';
      for (let i = 0; i <= 12; i += 1) dd += `M ${(p.x + lew + i * kw).toFixed(2)} ${(yT + gor).toFixed(2)} L ${(p.x + lew + i * kw).toFixed(2)} ${(yT + gor + 31 * kh).toFixed(2)} `;
      for (let j = 0; j <= 31; j += 1) dd += `M ${(p.x + lew).toFixed(2)} ${(yT + gor + j * kh).toFixed(2)} L ${(p.x + p.w).toFixed(2)} ${(yT + gor + j * kh).toFixed(2)} `;
      o.push(n.sciezka(dd.trim(), { stroke: c.k.linia, strokeWidth: 0.2, nazwa: 'Siatka dni' }));
      // Dni, których nie ma (np. 30 lutego) – zamalowane.
      for (let mi = 0; mi < 12; mi += 1) {
        const ile = new Date(Date.UTC(c.rok, mi + 1, 0)).getUTCDate();
        if (ile < 31) o.push(n.prost(p.x + lew + mi * kw + 0.15, yT + gor + ile * kh + 0.15, kw - 0.3, (31 - ile) * kh - 0.3, { fill: c.k.jasny }));
      }
      const yL = yT + gor + 31 * kh + 2;
      const legenda = [c.k.akcent, c.k.akcent2, mieszaj(c.k.akcent, '#ffffff', 0.5), c.k.linia];
      legenda.forEach((kol, i) => {
        const x = p.x + i * (p.w / 4);
        o.push(n.prost(x, yL, 3, 3, { fill: kol }), n.tekst('………', x + 4, yL - 0.3, p.w / 4 - 5, { pt: 7, kolor: c.k.akcent2 }));
      });
      return { strony: [{ nazwa: 'Tracker roczny', obiekty: o, wzorce: [] }] };
    },
  },
  {
    id: 'tracker-nawykow', nazwa: 'Miesięczny tracker nawyków', kategoria: 'planery', paleta: 'zielen',
    opis: 'Nawyki w wierszach, dni miesiąca w kolumnach – co miesiąc nowa strona z danych.', slowa: 'tracker nawykow miesiac nawyki habit',
    pytania: [pytanieRok], dane: true,
    schemat: [['tytul', 3, 3, 12, 2], ['siatka', 3, 7, 24, 20]],
    buduj(c, n) {
      const { pole: p } = c;
      const rok = c.rok;
      const wiersze = MIES.map((m, i) => [`${wielka(m)} ${rok}`]);
      const yT = p.y + c.pt(16) * 1.7;
      const nazw = p.w * 0.28; const kw = (p.w - nazw) / 31;
      const wolne = p.y + p.h - yT - c.pt(6.5) * 2;
      const wier = Math.max(8, Math.min(20, Math.floor(wolne / 8))); const kh = wolne / wier;
      const o = [n.tekst('Nawyki · {miesiac}', p.x, p.y, p.w, { pt: 16, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Tytuł' })];
      for (let d = 1; d <= 31; d += 1) o.push(n.tekst(String(d), p.x + nazw + (d - 1) * kw, yT, kw, { pt: Math.min(6.5, kw / 1.25 / ptNaMm(1) / c.s), align: 'center', kolor: c.k.akcent2 }));
      let dd = '';
      const y0 = yT + c.pt(6.5) * 1.5;
      for (let i = 0; i <= 31; i += 1) dd += `M ${(p.x + nazw + i * kw).toFixed(2)} ${y0.toFixed(2)} L ${(p.x + nazw + i * kw).toFixed(2)} ${(y0 + wier * kh).toFixed(2)} `;
      for (let j = 0; j <= wier; j += 1) dd += `M ${p.x.toFixed(2)} ${(y0 + j * kh).toFixed(2)} L ${(p.x + p.w).toFixed(2)} ${(y0 + j * kh).toFixed(2)} `;
      o.push(n.sciezka(dd.trim(), { stroke: c.k.linia, strokeWidth: 0.2, nazwa: 'Siatka nawyków' }));
      ['Woda', 'Ruch', 'Czytanie', 'Sen 8 h', 'Modlitwa', 'Bez cukru'].forEach((t, i) => o.push(n.tekst(t, p.x + 1, y0 + i * kh + Math.max(0, (kh - c.pt(8)) / 2), nazw - 2, { pt: 8 })));
      return {
        strony: [{ nazwa: 'Nawyki', obiekty: o, seria: 'miesiace' }],
        tabele: [{ klucz: 'miesiace', nazwa: `Miesiące ${rok}`, kolumny: ['miesiac'], wiersze }],
        serie: [{ klucz: 'miesiace', nazwa: 'Miesiące', tabela: 'miesiace', uklad: 'dlugi' }],
      };
    },
  },
  // ---------- Zaproszenia i dyplomy ----------
  {
    id: 'zaproszenie', nazwa: 'Zaproszenie', kategoria: 'okazje', format: [148, 210], paleta: 'roz',
    opis: 'Przód z ozdobną ramką i druga strona ze szczegółami: kiedy, gdzie, potwierdzenie.', slowa: 'zaproszenie slub urodziny chrzest komunia impreza wesele',
    schemat: [['ramka', 3, 3, 24, 36], ['tytul', 7, 14, 16, 4], ['tekst', 9, 22, 12, 1.5]],
    buduj(c, n) {
      const { pole: p } = c;
      const ramka = (o = {}) => [n.prost(p.x - 3, p.y - 3, p.w + 6, p.h + 6, { fill: '', stroke: c.k.akcent2, sw: 0.5, nazwa: 'Ramka', ...o }), n.prost(p.x - 1.5, p.y - 1.5, p.w + 3, p.h + 3, { fill: '', stroke: c.k.akcent2, sw: 0.2 })];
      const s1 = [
        n.tlo(c.k.jasny), ...ramka(),
        n.tekst('Z radością zapraszamy', p.x, p.y + p.h * 0.18, p.w, { pt: 11, align: 'center', italic: true, kolor: c.k.akcent2 }),
        n.tekst('Anna\n&\nPiotr', p.x, p.y + p.h * 0.28, p.w, { pt: 30, font: 'Great Vibes', align: 'center', kolor: c.k.akcent, lh: 1.0, nazwa: 'Imiona' }),
        ...n.ozdobnik(p.x + p.w / 2, p.y + p.h * 0.66, Math.min(50, p.w * 0.5)),
        n.tekst('12 czerwca 2027', p.x, p.y + p.h * 0.72, p.w, { pt: 12, align: 'center', cs: 120, kolor: c.k.tekst, wielkosc_liter: 'wielkie' }),
      ];
      const s2 = [
        n.tlo(c.k.jasny), ...ramka(),
        n.tekst('Uroczystość', p.x, p.y + p.h * 0.1, p.w, { pt: 16, font: c.f.tytul, align: 'center', bold: true, kolor: c.k.akcent }),
        n.tekst('Sobota, 12 czerwca 2027 r., godz. 15:00\nKościół pw. św. Anny\nul. Przykładowa 1, Miasto', p.x, p.y + p.h * 0.2, p.w, { pt: 10, align: 'center', lh: 1.5 }),
        n.tekst('Przyjęcie', p.x, p.y + p.h * 0.45, p.w, { pt: 16, font: c.f.tytul, align: 'center', bold: true, kolor: c.k.akcent }),
        n.tekst('Dom Weselny „Pod Lipami”\nul. Ogrodowa 5, Miasto', p.x, p.y + p.h * 0.55, p.w, { pt: 10, align: 'center', lh: 1.5 }),
        n.tekst('Prosimy o potwierdzenie przybycia do 1 maja\ntel. 600 000 000', p.x, p.y + p.h * 0.8, p.w, { pt: 8.5, align: 'center', italic: true, kolor: c.k.akcent2, lh: 1.4 }),
      ];
      return { strony: [{ nazwa: 'Zaproszenie – przód', obiekty: s1, wzorce: [] }, { nazwa: 'Zaproszenie – szczegóły', obiekty: s2, wzorce: [] }], numeracja: { tryb: 'brak', od: 1 } };
    },
  },
  {
    id: 'dyplom', nazwa: 'Dyplom', kategoria: 'okazje', format: [297, 210], paleta: 'granat',
    opis: 'Poziomy dyplom z ozdobną ramką, imieniem z danych i miejscem na podpisy – jedna strona na osobę.', slowa: 'dyplom uznanie nagroda szkola konkurs osoby',
    dane: true,
    schemat: [['ramka', 2, 6, 26, 28], ['tytul', 8, 11, 14, 4], ['tekst', 8, 18, 14, 2], ['tekst', 5, 29, 7, 1], ['tekst', 18, 29, 7, 1]],
    buduj(c, n) {
      const { pole: p } = c;
      const o = [
        n.prost(p.x - 4, p.y - 4, p.w + 8, p.h + 8, { fill: '', stroke: c.k.akcent, sw: 1.2, nazwa: 'Ramka' }),
        n.prost(p.x - 1.5, p.y - 1.5, p.w + 3, p.h + 3, { fill: '', stroke: c.k.akcent2, sw: 0.3 }),
        n.tekst('DYPLOM', p.x, p.y + p.h * 0.1, p.w, { pt: 40, font: c.f.tytul, bold: true, align: 'center', kolor: c.k.akcent, cs: 200, nazwa: 'Tytuł' }),
        n.tekst('dla', p.x, p.y + p.h * 0.3, p.w, { pt: 12, align: 'center', italic: true, kolor: c.k.akcent2 }),
        n.tekst('{imie}', p.x, p.y + p.h * 0.37, p.w, { pt: 28, font: 'Great Vibes', align: 'center', kolor: c.k.tekst, nazwa: 'Imię i nazwisko' }),
        ...n.ozdobnik(p.x + p.w / 2, p.y + p.h * 0.55, Math.min(70, p.w * 0.4)),
        n.tekst('{za_co}', p.x + p.w * 0.15, p.y + p.h * 0.6, p.w * 0.7, { pt: 12, align: 'center', lh: 1.35, nazwa: 'Za co' }),
        n.kreska(p.x + p.w * 0.08, p.y + p.h * 0.86, p.w * 0.28, 0.25, c.k.tekst), n.kreska(p.x + p.w * 0.64, p.y + p.h * 0.86, p.w * 0.28, 0.25, c.k.tekst),
        n.tekst('data', p.x + p.w * 0.08, p.y + p.h * 0.87, p.w * 0.28, { pt: 8, align: 'center', kolor: c.k.akcent2 }),
        n.tekst('podpis', p.x + p.w * 0.64, p.y + p.h * 0.87, p.w * 0.28, { pt: 8, align: 'center', kolor: c.k.akcent2 }),
      ];
      return {
        strony: [{ nazwa: 'Dyplom', obiekty: o, seria: 'osoby', wzorce: [] }],
        tabele: [{ klucz: 'osoby', nazwa: 'Osoby (dyplomy)', kolumny: ['imie', 'za_co'], wiersze: [['Anna Kowalska', 'za zajęcie pierwszego miejsca w konkursie recytatorskim'], ['Jan Nowak', 'za wzorową postawę i zaangażowanie'], ['Maria Wiśniewska', 'za wybitne osiągnięcia w nauce']] }],
        serie: [{ klucz: 'osoby', nazwa: 'Dyplomy', tabela: 'osoby', uklad: 'dlugi' }],
        numeracja: { tryb: 'brak', od: 1 },
      };
    },
  },
  {
    id: 'certyfikat', nazwa: 'Certyfikat ukończenia', kategoria: 'okazje', format: [297, 210], paleta: 'mono',
    opis: 'Nowoczesny certyfikat: pasek akcentu, imię z danych, kurs, data i numer.', slowa: 'certyfikat zaswiadczenie kurs szkolenie ukonczenie',
    dane: true,
    schemat: [['akcent', 0, 0, 6, 42], ['tytul', 9, 10, 18, 3], ['tekst', 9, 17, 14, 3], ['tekst', 9, 32, 8, 1]],
    buduj(c, n) {
      const { pole: p } = c;
      const pas = Math.min(c.W * 0.18, 50);
      const x = Math.max(p.x, pas + 12); const w = p.x + p.w - x;
      const o = [
        n.prost(-c.spad, -c.spad, pas + c.spad, c.H + 2 * c.spad, { fill: c.k.akcent, bez_ostrzezen: true, nazwa: 'Pasek' }),
        n.prost(pas, -c.spad, 2, c.H + 2 * c.spad, { fill: c.k.akcent2, bez_ostrzezen: true }),
        n.tekst('CERTYFIKAT', x, p.y + p.h * 0.1, w, { pt: 30, font: c.f.tytul, bold: true, kolor: c.k.akcent, cs: 150, nazwa: 'Tytuł' }),
        n.tekst('Niniejszym potwierdzamy, że', x, p.y + p.h * 0.28, w, { pt: 11, kolor: c.k.akcent2 }),
        n.tekst('{imie}', x, p.y + p.h * 0.35, w, { pt: 26, font: c.f.tytul, bold: true, nazwa: 'Imię i nazwisko' }),
        n.tekst('ukończył(a) kurs „{kurs}” w wymiarze {godzin} godzin.', x, p.y + p.h * 0.52, w, { pt: 12, lh: 1.4, nazwa: 'Opis' }),
        n.tekst('Data: {data}\nNr certyfikatu: {numer}', x, p.y + p.h * 0.78, w * 0.5, { pt: 9, lh: 1.5, kolor: c.k.akcent2 }),
        n.kreska(x + w * 0.55, p.y + p.h * 0.84, w * 0.45, 0.25, c.k.tekst),
        n.tekst('podpis prowadzącego', x + w * 0.55, p.y + p.h * 0.85, w * 0.45, { pt: 8, align: 'center', kolor: c.k.akcent2 }),
      ];
      return {
        strony: [{ nazwa: 'Certyfikat', obiekty: o, seria: 'osoby', wzorce: [] }],
        tabele: [{ klucz: 'osoby', nazwa: 'Uczestnicy', kolumny: ['imie', 'kurs', 'godzin', 'data', 'numer'], wiersze: [['Anna Kowalska', 'Projektowanie publikacji', '24', '15.06.2027', 'C/2027/001'], ['Jan Nowak', 'Projektowanie publikacji', '24', '15.06.2027', 'C/2027/002']] }],
        serie: [{ klucz: 'osoby', nazwa: 'Certyfikaty', tabela: 'osoby', uklad: 'dlugi' }],
        numeracja: { tryb: 'brak', od: 1 },
      };
    },
  },
  {
    id: 'kartka-okolicznosciowa', nazwa: 'Kartka okolicznościowa', kategoria: 'okazje', format: [148, 105], paleta: 'terakota',
    opis: 'Kartka z życzeniami: przód z hasłem i ozdobnikami, środek z miejscem na życzenia.', slowa: 'kartka zyczenia swieta urodziny boze narodzenie wielkanoc okolicznosciowa',
    schemat: [['tlo', 0, 0, 30, 42], ['tytul', 5, 16, 20, 5], ['akcent', 10, 24, 10, 0.6]],
    buduj(c, n) {
      const { pole: p } = c;
      const gw = (cx, cy, r, kol) => ({ type: 'polygon', version: '5.3.0', id: c.uid('o'), left: cx - r, top: cy - r, points: Array.from({ length: 10 }, (_, i) => { const a = (i * Math.PI) / 5 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; return { x: r + rr * Math.cos(a), y: r + rr * Math.sin(a) }; }), fill: kol, strokeWidth: 0, boki: 5, gwiazda: true, nazwa: 'Gwiazdka' });
      const r = Math.min(p.w, p.h) * 0.05;
      const s1 = [
        n.tlo(c.k.akcent),
        gw(p.x + r, p.y + r, r, c.k.akcent2), gw(p.x + p.w - r, p.y + p.h - r, r * 0.8, c.k.akcent2), gw(p.x + p.w - r * 2.5, p.y + r * 1.5, r * 0.5, mieszaj(c.k.akcent2, '#ffffff', 0.4)),
        n.tekst('Wszystkiego\nnajlepszego!', p.x, p.y + p.h * 0.3, p.w, { pt: 26, font: 'Dancing Script', bold: true, align: 'center', kolor: '#ffffff', lh: 1.05, nazwa: 'Hasło' }),
      ];
      const s2 = [
        ...n.ozdobnik(p.x + p.w / 2, p.y + 4, Math.min(40, p.w * 0.4)),
        n.tekst('Kochana Mamo,\nżyczymy Ci zdrowia, radości i wielu pięknych chwil!', p.x, p.y + p.h * 0.25, p.w, { pt: 12, font: 'Dancing Script', align: 'center', lh: 1.4, nazwa: 'Życzenia' }),
        n.tekst('— Twoja rodzina', p.x, p.y + p.h * 0.75, p.w, { pt: 10, align: 'center', italic: true, kolor: c.k.akcent2 }),
      ];
      return { strony: [{ nazwa: 'Kartka – przód', obiekty: s1, wzorce: [] }, { nazwa: 'Kartka – środek', obiekty: s2, wzorce: [] }], numeracja: { tryb: 'brak', od: 1 } };
    },
  },
  {
    id: 'program-wydarzenia', nazwa: 'Program wydarzenia', kategoria: 'okazje', paleta: 'granat',
    opis: 'Agenda z godzinami, prelegentami i miejscem – czytelna jedna strona.', slowa: 'program wydarzenia agenda konferencja harmonogram uroczystosc',
    schemat: [['tytul', 3, 3, 18, 3], ['punkty', 3, 9, 24, 28]],
    buduj(c, n) {
      const { pole: p } = c;
      const punkty = [['9:00', 'Powitanie gości', 'Sala główna'], ['9:30', 'Wykład otwierający', 'Imię Nazwisko'], ['11:00', 'Przerwa kawowa', 'Foyer'], ['11:30', 'Warsztaty w grupach', 'Sale 1–3'], ['13:00', 'Obiad', 'Restauracja'], ['14:30', 'Panel dyskusyjny', 'Prowadzenie: Imię Nazwisko'], ['16:00', 'Podsumowanie i zakończenie', 'Sala główna']];
      const o = [
        n.tekst('Program', p.x, p.y, p.w, { pt: 26, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Tytuł' }),
        n.tekst('Nazwa wydarzenia · 12 czerwca 2027 · Miasto', p.x, p.y + c.pt(26) * 1.25, p.w, { pt: 10, kolor: c.k.akcent2 }),
      ];
      const y0 = p.y + c.pt(26) * 1.25 + c.pt(10) * 2.5;
      const krok = Math.min(c.pt(11) * 3.6, (p.y + p.h - y0) / punkty.length);
      punkty.forEach(([g, t, d], i) => {
        const y = y0 + i * krok;
        o.push(n.tekst(g, p.x, y, p.w * 0.18, { pt: 12, bold: true, kolor: c.k.akcent }),
          n.tekst(t, p.x + p.w * 0.2, y, p.w * 0.8, { pt: 11, bold: true }),
          n.tekst(d, p.x + p.w * 0.2, y + c.pt(11) * 1.35, p.w * 0.8, { pt: 9, kolor: c.k.akcent2 }));
        if (i < punkty.length - 1) o.push(n.kreska(p.x + p.w * 0.2, y + krok - c.pt(11) * 0.6, p.w * 0.8, 0.2));
      });
      return { strony: [{ nazwa: 'Program', obiekty: o, wzorce: [] }], numeracja: { tryb: 'brak', od: 1 } };
    },
  },
  // ---------- Firma i reklama ----------
  {
    id: 'wizytowki', nazwa: 'Wizytówki', kategoria: 'firma', format: [85, 55], marginesy: 4, paleta: 'granat',
    // Sekcja specjalna (#177): arkusz użytków – w PDF wizytówki stoją na arkuszu SRA3 ze znakami cięcia.
    specjalna: { rodzaj: 'arkusz', uzytek_szer_mm: 85, uzytek_wys_mm: 55, arkusz: 'SRA3' },
    opis: 'Wizytówka 85 × 55 mm dla każdej osoby z tabeli: imię, stanowisko, telefon, e-mail.', slowa: 'wizytowki wizytowka firma kontakt osoby telefon email',
    dane: true,
    schemat: [['akcent', 0, 0, 30, 4], ['tytul', 3, 10, 18, 3], ['tekst', 3, 15, 14, 1.5], ['tekst', 3, 30, 18, 3]],
    buduj(c, n) {
      const { pole: p } = c;
      const o = [
        n.prost(-c.spad, -c.spad, c.W * 0.06 + c.spad, c.H + 2 * c.spad, { fill: c.k.akcent, bez_ostrzezen: true, nazwa: 'Pasek' }),
        n.tekst('{imie}', p.x + c.W * 0.04, p.y, p.w - c.W * 0.04, { pt: 13, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Imię i nazwisko' }),
        n.tekst('{stanowisko}', p.x + c.W * 0.04, p.y + c.pt(13) * 1.35, p.w - c.W * 0.04, { pt: 9, kolor: c.k.akcent2, cs: 60, nazwa: 'Stanowisko' }),
        n.tekst('tel. {telefon}\n{email}\nwww.firma.pl', p.x + c.W * 0.04, p.y + p.h - c.pt(9) * 1.35 * 3, p.w - c.W * 0.04, { pt: 9, lh: 1.35, nazwa: 'Kontakt' }),
      ];
      return {
        strony: [{ nazwa: 'Wizytówka', obiekty: o, seria: 'osoby', wzorce: [] }],
        tabele: [{ klucz: 'osoby', nazwa: 'Osoby (wizytówki)', kolumny: ['imie', 'stanowisko', 'telefon', 'email'], wiersze: [['Anna Kowalska', 'Dyrektor ds. sprzedaży', '600 100 200', 'anna@firma.pl'], ['Jan Nowak', 'Grafik', '600 300 400', 'jan@firma.pl']] }],
        serie: [{ klucz: 'osoby', nazwa: 'Wizytówki', tabela: 'osoby', uklad: 'dlugi' }],
        numeracja: { tryb: 'brak', od: 1 },
      };
    },
  },
  {
    id: 'ulotka', nazwa: 'Ulotka', kategoria: 'firma', format: [148, 210], paleta: 'terakota',
    opis: 'Dwie strony: duże zdjęcie z hasłem i lista korzyści, na odwrocie oferta i kontakt.', slowa: 'ulotka a5 reklama oferta promocja',
    schemat: [['zdjecie', 0, 0, 30, 20], ['tytul', 3, 22, 20, 4], ['punkty', 3, 28, 24, 10]],
    buduj(c, n) {
      const { pole: p } = c;
      const hZ = c.H * 0.45;
      const s1 = [
        n.zdjecie(-c.spad, -c.spad, c.W + 2 * c.spad, hZ + c.spad, { bez_ostrzezen: true }),
        n.prost(p.x, hZ - c.pt(9) * 1.2, Math.min(60, p.w * 0.5), c.pt(9) * 2.4, { fill: c.k.akcent2, nazwa: 'Plakietka' }),
        n.tekst('NOWOŚĆ', p.x + 2, hZ - c.pt(9) * 0.6, Math.min(60, p.w * 0.5) - 4, { pt: 9, bold: true, cs: 200, kolor: '#ffffff' }),
        n.tekst('Hasło, które przyciąga uwagę', p.x, hZ + c.pt(9) * 2, p.w, { pt: 24, font: c.f.tytul, bold: true, kolor: c.k.akcent, lh: 1.05, nazwa: 'Hasło' }),
        n.tekst('Jedno zdanie, które mówi, co zyska klient.', p.x, hZ + c.pt(9) * 2 + c.pt(24) * 2.4, p.w, { pt: 11, kolor: c.k.akcent2, italic: true }),
      ];
      const yL = hZ + c.pt(9) * 2 + c.pt(24) * 2.4 + c.pt(11) * 2.4;
      ['Pierwsza korzyść – krótko i konkretnie', 'Druga korzyść – czym różnisz się od innych', 'Trzecia korzyść – dlaczego warto teraz'].forEach((t, i) => s1.push(...n.punkt(p.x, yL + i * c.pt(10) * 2, p.w, t, { pt: 10 })));
      const s2 = [
        n.tekst('Oferta', p.x, p.y, p.w, { pt: 22, font: c.f.tytul, bold: true, kolor: c.k.akcent }),
        n.tabela(p.x, p.y + c.pt(22) * 1.6, p.w, [3, 1], [['Usługa', 'Cena'], ['Pakiet podstawowy', '99 zł'], ['Pakiet rozszerzony', '199 zł'], ['Pakiet premium', '299 zł']], { wysokosc: 8, pt: 9.5, nazwa: 'Cennik' }),
        n.prost(p.x, p.y + p.h * 0.62, p.w, p.h * 0.38, { fill: c.k.jasny, rx: 2, nazwa: 'Pole kontaktu' }),
        n.tekst('Zadzwoń albo napisz', p.x + 4, p.y + p.h * 0.62 + 4, p.w - 8, { pt: 13, bold: true, kolor: c.k.akcent }),
        n.tekst('tel. 600 000 000\nkontakt@firma.pl\nul. Przykładowa 1, Miasto\nwww.firma.pl', p.x + 4, p.y + p.h * 0.62 + 4 + c.pt(13) * 1.7, p.w - 8, { pt: 10, lh: 1.5 }),
      ];
      return { strony: [{ nazwa: 'Ulotka – przód', obiekty: s1, wzorce: [] }, { nazwa: 'Ulotka – tył', obiekty: s2, wzorce: [] }], numeracja: { tryb: 'brak', od: 1 } };
    },
  },
  {
    id: 'plakat', nazwa: 'Plakat', kategoria: 'firma', format: [297, 420], paleta: 'terakota',
    opis: 'Wielkie hasło, zdjęcie, data i miejsce – plakat wydarzenia.', slowa: 'plakat afisz wydarzenie koncert festyn a3',
    schemat: [['tlo', 0, 0, 30, 42], ['tytul', 3, 4, 24, 8], ['zdjecie', 3, 14, 24, 16], ['tekst', 3, 33, 20, 3]],
    buduj(c, n) {
      const { pole: p } = c;
      const o = [
        n.tlo(c.k.akcent),
        n.tekst('NAZWA\nWYDARZENIA', p.x, p.y, p.w, { pt: 64, font: c.f.tytul, bold: true, kolor: '#ffffff', lh: 0.95, nazwa: 'Hasło' }),
        n.zdjecie(p.x, p.y + p.h * 0.3, p.w, p.h * 0.42),
        n.tekst('12.06.2027 · godz. 18:00', p.x, p.y + p.h * 0.76, p.w, { pt: 24, bold: true, kolor: c.k.akcent2, nazwa: 'Data' }),
        n.tekst('Miejsce wydarzenia, ul. Przykładowa 1, Miasto\nWstęp wolny · www.wydarzenie.pl', p.x, p.y + p.h * 0.76 + c.pt(24) * 1.5, p.w, { pt: 13, kolor: '#ffffff', lh: 1.4 }),
      ];
      return { strony: [{ nazwa: 'Plakat', obiekty: o, wzorce: [] }], numeracja: { tryb: 'brak', od: 1 } };
    },
  },
  {
    id: 'broszura-skladana', nazwa: 'Broszura składana (3 części)', kategoria: 'firma', format: [297, 210], paleta: 'zielen',
    // Ulotka składana (#177): panele i zgięcia zna sekcja – panel składany do środka jest o 2 mm węższy.
    specjalna: { rodzaj: 'ulotka', panele: 3, zlozenie: 'c', szerokosc_mm: 99, wysokosc_mm: 210, skrot_mm: 2 },
    opis: 'Arkusz A4 poziomo składany na trzy: strona zewnętrzna i wewnętrzna, z prowadnicami złamów.', slowa: 'broszura skladana trifold ulotka skladana trzy czesci',
    schemat: [['tekst', 1, 4, 8, 20], ['zdjecie', 11, 4, 8, 12], ['tytul', 21, 6, 8, 5]],
    buduj(c, n) {
      const tr = c.W / 3; const m = Math.max(6, c.m.gora);
      const kolumna = (i) => ({ x: i * tr + m, w: tr - 2 * m });
      const prow = { x: [tr, 2 * tr], y: [] };
      const zew = [];
      const k0 = kolumna(0); const k1 = kolumna(1); const k2 = kolumna(2);
      zew.push(
        n.tekst('O nas', k0.x, m, k0.w, { pt: 16, font: c.f.tytul, bold: true, kolor: c.k.akcent }),
        n.tekst(akapit(4), k0.x, m + c.pt(16) * 1.6, k0.w, { pt: 9, lh: 1.4 }),
        n.prost(k1.x, c.H * 0.35, k1.w, c.H * 0.45, { fill: c.k.jasny, rx: 2, nazwa: 'Kontakt' }),
        n.tekst('Kontakt', k1.x + 3, c.H * 0.35 + 3, k1.w - 6, { pt: 13, bold: true, kolor: c.k.akcent }),
        n.tekst('tel. 600 000 000\nkontakt@firma.pl\nwww.firma.pl', k1.x + 3, c.H * 0.35 + 3 + c.pt(13) * 1.7, k1.w - 6, { pt: 9.5, lh: 1.5 }),
        n.zdjecie(2 * tr, -c.spad, tr + c.spad, c.H * 0.55 + c.spad, { bez_ostrzezen: true }),
        n.tekst('Nazwa firmy', k2.x, c.H * 0.6, k2.w, { pt: 22, font: c.f.tytul, bold: true, kolor: c.k.akcent, lh: 1.05, nazwa: 'Tytuł' }),
        n.tekst('Krótkie hasło o tym, co robimy', k2.x, c.H * 0.6 + c.pt(22) * 2.4, k2.w, { pt: 10, italic: true, kolor: c.k.akcent2 }),
      );
      const wew = [];
      ['Co robimy', 'Jak pracujemy', 'Dlaczego my'].forEach((t, i) => {
        const k = kolumna(i);
        wew.push(n.zdjecie(k.x, m, k.w, c.H * 0.3), n.tekst(t, k.x, m + c.H * 0.3 + 4, k.w, { pt: 14, font: c.f.tytul, bold: true, kolor: c.k.akcent }), n.tekst(akapit(3, i + 1), k.x, m + c.H * 0.3 + 4 + c.pt(14) * 1.6, k.w, { pt: 9, lh: 1.4 }));
      });
      return { strony: [{ nazwa: 'Strona zewnętrzna', obiekty: zew, prowadnice: prow, wzorce: [] }, { nazwa: 'Strona wewnętrzna', obiekty: wew, prowadnice: prow, wzorce: [] }], numeracja: { tryb: 'brak', od: 1 } };
    },
  },
  {
    id: 'katalog-produktow', nazwa: 'Katalog produktów', kategoria: 'firma', paleta: 'mono',
    opis: 'Strona na każdy produkt z tabeli: zdjęcie z pliku, nazwa, opis, cena, kod.', slowa: 'katalog produktow oferta sklep ceny zdjecia produkty',
    dane: true,
    schemat: [['zdjecie', 3, 3, 24, 20], ['tytul', 3, 25, 18, 3], ['tekst', 3, 30, 24, 5], ['akcent', 19, 37, 8, 2]],
    buduj(c, n) {
      const { pole: p } = c;
      const hZ = p.h * 0.55;
      const zdj = { ...n.zdjecie(p.x, p.y, p.w, hZ), pole: { kolumna: 'zdjecie', tryb: 'wypelnij' }, nazwa: 'Zdjęcie produktu (z danych)' };
      const o = [
        zdj,
        n.tekst('{nazwa}', p.x, p.y + hZ + 5, p.w * 0.7, { pt: 18, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Nazwa' }),
        n.tekst('{cena}', p.x + p.w * 0.7, p.y + hZ + 5, p.w * 0.3, { pt: 18, bold: true, align: 'right', kolor: c.k.akcent2, nazwa: 'Cena' }),
        n.kreska(p.x, p.y + hZ + 5 + c.pt(18) * 1.5, p.w, 0.3),
        n.tekst('{opis}', p.x, p.y + hZ + 8 + c.pt(18) * 1.5, p.w, { pt: 10, lh: 1.4, nazwa: 'Opis' }),
        n.tekst('Kod: {kod}', p.x, p.y + p.h - c.pt(8) * 1.4, p.w, { pt: 8, kolor: c.k.akcent2 }),
      ];
      return {
        strony: [{ nazwa: 'Produkt', obiekty: o, seria: 'produkty' }],
        tabele: [{ klucz: 'produkty', nazwa: 'Produkty', kolumny: ['nazwa', 'opis', 'cena', 'kod', 'zdjecie'], wiersze: [['Kubek ceramiczny', 'Ręcznie malowany kubek o pojemności 350 ml. Można myć w zmywarce.', '39 zł', 'KB-001', 'kubek.jpg'], ['Notes w kropki', 'Notes A5 z twardą okładką, 120 kartek papieru 100 g.', '29 zł', 'NT-014', 'notes.jpg'], ['Torba lniana', 'Mocna torba z naturalnego lnu z długimi uszami.', '49 zł', 'TR-007', 'torba.jpg']] }],
        serie: [{ klucz: 'produkty', nazwa: 'Produkty', tabela: 'produkty', uklad: 'dlugi' }],
        wzorce: [stopkaNumer(c, n)],
      };
    },
  },
  {
    id: 'menu', nazwa: 'Menu restauracji', kategoria: 'firma', paleta: 'terakota',
    opis: 'Okładka i karta dań z cenami wyrównanymi kropkami do prawej.', slowa: 'menu karta dan restauracja kawiarnia ceny',
    schemat: [['tytul', 8, 4, 14, 3], ['linie', 3, 10, 24, 28]],
    buduj(c, n) {
      const { pole: p } = c;
      // Cena na prawym tabulatorze z kropkami – tabulator odrobinę przed krawędzią ramki, żeby cena nie przeskakiwała.
      const tab = [{ poz: Math.floor((p.w - 1.5) * 100) / 100, rodzaj: 'prawy', wypelniacz: '.' }];
      const okladka = [
        n.tlo(c.k.ciemny),
        n.tekst('Nazwa\nrestauracji', p.x, p.y + p.h * 0.32, p.w, { pt: 32, font: c.f.tytul, bold: true, align: 'center', kolor: '#ffffff', lh: 1.05, nazwa: 'Nazwa' }),
        ...n.ozdobnik(p.x + p.w / 2, p.y + p.h * 0.58, Math.min(50, p.w * 0.5)),
        n.tekst('MENU', p.x, p.y + p.h * 0.62, p.w, { pt: 12, align: 'center', cs: 400, kolor: c.k.akcent2 }),
      ];
      const karta = [n.tekst('Menu', p.x, p.y, p.w, { pt: 24, font: c.f.tytul, bold: true, align: 'center', kolor: c.k.akcent })];
      let y = p.y + c.pt(24) * 1.8;
      const dzialy = [['Przystawki', [['Tatar z łososia', '32 zł'], ['Zupa dnia', '18 zł'], ['Sałatka z kozim serem', '29 zł']]], ['Dania główne', [['Pierogi ruskie', '34 zł'], ['Polędwiczki w sosie grzybowym', '58 zł'], ['Risotto z warzywami', '42 zł']]], ['Desery', [['Sernik domowy', '19 zł'], ['Szarlotka z lodami', '21 zł']]]];
      for (const [nazwa, dania] of dzialy) {
        karta.push(n.tekst(nazwa, p.x, y, p.w, { pt: 13, font: c.f.tytul, bold: true, kolor: c.k.akcent2 }));
        y += c.pt(13) * 1.6;
        karta.push({ ...n.tekst(dania.map(([d, cena]) => `${d}\t${cena.replace(' ', '\u00a0')}`).join('\n'), p.x, y, p.w, { pt: 10, lh: 1.7, nazwa: `Dania – ${nazwa}` }), tabulatory: tab });
        y += dania.length * c.pt(10) * 1.7 * 1.05 + c.pt(10) * 1.4;
      }
      return { strony: [{ nazwa: 'Menu – okładka', obiekty: okladka, wzorce: [] }, { nazwa: 'Menu – karta', obiekty: karta, wzorce: [] }], numeracja: { tryb: 'brak', od: 1 } };
    },
  },
  {
    id: 'gazetka', nazwa: 'Gazetka / newsletter', kategoria: 'firma', paleta: 'granat',
    opis: 'Winieta z numerem wydania, artykuł główny ze zdjęciem i ramka z krótkimi wiadomościami.', slowa: 'gazetka newsletter biuletyn parafialna szkolna artykul',
    schemat: [['akcent', 0, 0, 30, 6], ['zdjecie', 3, 8, 15, 12], ['tekst', 3, 22, 15, 16], ['tekst', 20, 8, 7, 30]],
    buduj(c, n) {
      const { pole: p } = c;
      const hW = c.pt(28) * 1.6 + 6;
      const bok = p.w * 0.32; const glowna = p.w - bok - 4;
      const o = [
        n.prost(-c.spad, -c.spad, c.W + 2 * c.spad, p.y + hW + c.spad, { fill: c.k.akcent, bez_ostrzezen: true, nazwa: 'Winieta' }),
        n.tekst('Nazwa gazetki', p.x, p.y + 1, p.w * 0.7, { pt: 28, font: c.f.tytul, bold: true, kolor: '#ffffff', nazwa: 'Tytuł' }),
        n.tekst('Nr 1 · czerwiec 2027', p.x + p.w * 0.6, p.y + hW - c.pt(8) * 2.4, p.w * 0.4, { pt: 8, align: 'right', kolor: c.k.akcent2 }),
      ];
      const y = p.y + hW + 6;
      o.push(n.zdjecie(p.x, y, glowna, (p.h - hW) * 0.38),
        n.tekst('Tytuł artykułu głównego', p.x, y + (p.h - hW) * 0.38 + 3, glowna, { pt: 16, font: c.f.tytul, bold: true, kolor: c.k.akcent, lh: 1.1 }),
        { ...n.tekst(akapit(6), p.x, y + (p.h - hW) * 0.38 + 5 + c.pt(16) * 2.4, glowna, { pt: 9, lh: 1.4, align: 'justify' }), dziel_wyrazy: true },
        n.prost(p.x + glowna + 4, y, bok, p.y + p.h - y, { fill: c.k.jasny, rx: 1.5, nazwa: 'Ramka boczna' }),
        n.tekst('W skrócie', p.x + glowna + 7, y + 3, bok - 6, { pt: 12, bold: true, kolor: c.k.akcent }));
      let yb = y + 3 + c.pt(12) * 1.8;
      ['Krótka wiadomość numer jeden – dwa zdania o tym, co się wydarzyło.', 'Zapowiedź najbliższego spotkania z datą i miejscem.', 'Podziękowanie albo ogłoszenie dla czytelników.'].forEach((t) => {
        o.push(n.tekst(t, p.x + glowna + 7, yb, bok - 6, { pt: 8.5, lh: 1.35 }));
        yb += c.pt(8.5) * 1.35 * Math.ceil((t.length * c.pt(8.5) * 0.6) / (bok - 6)) + 5;
      });
      return { strony: [{ nazwa: 'Gazetka – strona 1', obiekty: o, wzorce: [] }], wzorce: [stopkaNumer(c, n)] };
    },
  },
  // ---------- Inne ----------
  {
    id: 'przepisy', nazwa: 'Książka z przepisami', kategoria: 'inne', paleta: 'zielen',
    opis: 'Przepis na stronie z tabeli: zdjęcie z pliku, czas, porcje, składniki i sposób przygotowania.', slowa: 'przepisy kucharska ksiazka kulinarna skladniki gotowanie',
    dane: true,
    schemat: [['zdjecie', 0, 0, 30, 14], ['tytul', 3, 16, 18, 3], ['tekst', 3, 21, 9, 17], ['tekst', 14, 21, 13, 17]],
    buduj(c, n) {
      const { pole: p } = c;
      const hZ = c.H * 0.36;
      const yT = hZ + 5; const kol = p.w * 0.36;
      const o = [
        { ...n.zdjecie(-c.spad, -c.spad, c.W + 2 * c.spad, hZ + c.spad, { bez_ostrzezen: true }), pole: { kolumna: 'zdjecie', tryb: 'wypelnij' }, nazwa: 'Zdjęcie potrawy (z danych)' },
        n.tekst('{tytul}', p.x, yT, p.w, { pt: 20, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Nazwa potrawy' }),
        n.tekst('Czas: {czas} · Porcje: {porcje}', p.x, yT + c.pt(20) * 1.4, p.w, { pt: 9, kolor: c.k.akcent2 }),
        n.prost(p.x, yT + c.pt(20) * 1.4 + c.pt(9) * 2.2, kol, p.y + p.h - (yT + c.pt(20) * 1.4 + c.pt(9) * 2.2), { fill: c.k.jasny, rx: 1.5 }),
        n.tekst('SKŁADNIKI', p.x + 3, yT + c.pt(20) * 1.4 + c.pt(9) * 2.2 + 3, kol - 6, { pt: 8, bold: true, cs: 120, kolor: c.k.akcent }),
        { ...n.tekst('{skladniki}', p.x + 3, yT + c.pt(20) * 1.4 + c.pt(9) * 2.2 + 3 + c.pt(8) * 1.8, kol - 6, { pt: 9, lh: 1.45, nazwa: 'Składniki' }), lista: 'kreski' },
        n.tekst('PRZYGOTOWANIE', p.x + kol + 5, yT + c.pt(20) * 1.4 + c.pt(9) * 2.2 + 3, p.w - kol - 5, { pt: 8, bold: true, cs: 120, kolor: c.k.akcent }),
        { ...n.tekst('{przygotowanie}', p.x + kol + 5, yT + c.pt(20) * 1.4 + c.pt(9) * 2.2 + 3 + c.pt(8) * 1.8, p.w - kol - 5, { pt: 9.5, lh: 1.45, nazwa: 'Przygotowanie' }), lista: 'numery' },
      ];
      return {
        strony: [{ nazwa: 'Przepis', obiekty: o, seria: 'przepisy' }],
        tabele: [{ klucz: 'przepisy', nazwa: 'Przepisy', kolumny: ['tytul', 'czas', 'porcje', 'skladniki', 'przygotowanie', 'zdjecie'], wiersze: [['Pierogi ruskie', '90 min', '4', '500 g mąki\n1 jajko\n500 g ziemniaków\n250 g twarogu\n1 cebula', 'Zagnieć ciasto z mąki, jajka i wody.\nUgotuj ziemniaki i wymieszaj z twarogiem i podsmażoną cebulą.\nWycinaj krążki, nakładaj farsz i sklejaj.\nGotuj w osolonej wodzie 3 minuty od wypłynięcia.', 'pierogi.jpg'], ['Szarlotka', '75 min', '8', '300 g mąki\n200 g masła\n100 g cukru\n1 kg jabłek\ncynamon', 'Zagnieć kruche ciasto i schłodź.\nJabłka zetrzyj i podduś z cynamonem.\nWyłóż ciasto, jabłka i kruszonkę.\nPiecz 50 minut w 180°C.', 'szarlotka.jpg']] }],
        serie: [{ klucz: 'przepisy', nazwa: 'Przepisy', tabela: 'przepisy', uklad: 'dlugi' }],
        wzorce: [stopkaNumer(c, n)],
      };
    },
  },
  {
    id: 'album', nazwa: 'Album ze zdjęciami', kategoria: 'inne', uklad: 'rozkladowki', paleta: 'mono',
    opis: 'Strony z różnymi układami zdjęć i podpisów – do fotoksiążki albo pamiątki.', slowa: 'album zdjecia fotoksiazka pamiatka galeria',
    pytania: [pytanieStron(8, 60)],
    schemat: [['zdjecie', 3, 3, 24, 20], ['zdjecie', 3, 25, 11, 12], ['zdjecie', 16, 25, 11, 12]],
    buduj(c, n) {
      const { pole: p } = c;
      const ile = Math.max(1, Math.min(60, c.opcje.stron || 8));
      const podpis = (x, y, w) => n.tekst('Podpis zdjęcia', x, y, w, { pt: 8, italic: true, kolor: c.k.akcent2, nazwa: 'Podpis' });
      const odst = 4;
      const uklady = [
        () => [n.zdjecie(p.x, p.y, p.w, p.h - c.pt(8) * 2.4), podpis(p.x, p.y + p.h - c.pt(8) * 1.6, p.w)],
        () => { const h = (p.h - odst) / 2 - c.pt(8) * 2; return [n.zdjecie(p.x, p.y, p.w, h), podpis(p.x, p.y + h + 1.5, p.w), n.zdjecie(p.x, p.y + h + c.pt(8) * 2 + odst, p.w, h), podpis(p.x, p.y + 2 * h + c.pt(8) * 2 + odst + 1.5, p.w)]; },
        () => { const h1 = p.h * 0.55; const w2 = (p.w - odst) / 2; const h2 = p.h - h1 - odst - c.pt(8) * 2; return [n.zdjecie(p.x, p.y, p.w, h1), n.zdjecie(p.x, p.y + h1 + odst, w2, h2), n.zdjecie(p.x + w2 + odst, p.y + h1 + odst, w2, h2), podpis(p.x, p.y + p.h - c.pt(8) * 1.4, p.w)]; },
        () => { const w2 = (p.w - odst) / 2; const h2 = (p.h - odst) / 2; return [0, 1, 2, 3].map((i) => n.zdjecie(p.x + (i % 2) * (w2 + odst), p.y + Math.floor(i / 2) * (h2 + odst), w2, h2)); },
        () => [n.zdjecie(p.x, p.y, p.w, p.h * 0.6), n.tekst('Wspomnienie', p.x, p.y + p.h * 0.64, p.w, { pt: 18, font: c.f.tytul, bold: true, kolor: c.k.akcent }), n.tekst(akapit(2, 3), p.x, p.y + p.h * 0.64 + c.pt(18) * 1.6, p.w, { pt: 10, lh: 1.45 })],
      ];
      const strony = Array.from({ length: ile }, (_, i) => ({ nazwa: `Album ${i + 1}`, obiekty: uklady[i % uklady.length]().flat() }));
      return { strony, wzorce: [stopkaNumer(c, n)] };
    },
  },
  {
    id: 'etykiety', nazwa: 'Etykiety i naklejki', kategoria: 'inne', format: [70, 40], marginesy: 3, paleta: 'zielen',
    specjalna: { rodzaj: 'arkusz', uzytek_szer_mm: 70, uzytek_wys_mm: 40, arkusz: 'A4', ksztalt: 'naklejka', zaokraglenie_mm: 3 },
    opis: 'Etykieta 70 × 40 mm dla każdego wiersza tabeli – np. na słoiki, przetwory, prezenty.', slowa: 'etykiety naklejki sloiki przetwory prezenty opis',
    dane: true,
    schemat: [['ramka', 2, 10, 26, 22], ['tytul', 5, 16, 20, 4], ['tekst', 7, 23, 16, 1.5]],
    buduj(c, n) {
      const { pole: p } = c;
      const o = [
        n.prost(p.x, p.y, p.w, p.h, { fill: c.k.jasny, stroke: c.k.akcent, sw: 0.4, rx: Math.min(p.w, p.h) * 0.15, nazwa: 'Tło etykiety' }),
        n.tekst('{nazwa}', p.x + 2, p.y + p.h * 0.2, p.w - 4, { pt: 13, font: c.f.tytul, bold: true, align: 'center', kolor: c.k.akcent, nazwa: 'Nazwa' }),
        n.tekst('{opis}', p.x + 2, p.y + p.h * 0.2 + c.pt(13) * 1.4, p.w - 4, { pt: 7.5, align: 'center', kolor: c.k.akcent2, nazwa: 'Opis' }),
        n.tekst('{data}', p.x + 2, p.y + p.h - c.pt(6.5) * 1.9, p.w - 4, { pt: 6.5, align: 'center', kolor: c.k.akcent2, nazwa: 'Data' }),
      ];
      return {
        strony: [{ nazwa: 'Etykieta', obiekty: o, seria: 'etykiety', wzorce: [] }],
        tabele: [{ klucz: 'etykiety', nazwa: 'Etykiety', kolumny: ['nazwa', 'opis', 'data'], wiersze: [['Konfitura truskawkowa', 'z ogrodu babci', 'lipiec 2027'], ['Ogórki kiszone', 'z koperkiem i czosnkiem', 'sierpień 2027'], ['Miód lipowy', 'pasieka „Pod Lipą”', 'czerwiec 2027']] }],
        serie: [{ klucz: 'etykiety', nazwa: 'Etykiety', tabela: 'etykiety', uklad: 'dlugi' }],
        numeracja: { tryb: 'brak', od: 1 },
      };
    },
  },
  {
    id: 'zawieszki', nazwa: 'Zawieszki na prezenty', kategoria: 'inne', format: [50, 90], marginesy: 4, paleta: 'zielen',
    specjalna: { rodzaj: 'arkusz', uzytek_szer_mm: 50, uzytek_wys_mm: 90, arkusz: 'A4', ksztalt: 'zawieszka', zaokraglenie_mm: 12 },
    opis: 'Zawieszka 50 × 90 mm ze ściętymi rogami i otworem na sznurek – dla każdego wiersza tabeli (dla kogo, życzenia, od kogo).', slowa: 'zawieszki metki prezenty swieta bilecik etykieta sznurek',
    dane: true,
    schemat: [['ramka', 10, 3, 10, 34], ['tytul', 11, 14, 8, 3], ['tekst', 11, 20, 8, 6]],
    buduj(c, n) {
      const { pole: p } = c;
      const gora = 20; // pod otworem
      const o = [
        n.prost(-3, -3, 56, 96, { fill: c.k.jasny, nazwa: 'Tło zawieszki', bez_ostrzezen: true }), // ze spadem
        n.tekst('Dla {dla}', p.x, gora, p.w, { pt: 15, font: c.f.tytul, bold: true, align: 'center', kolor: c.k.akcent, nazwa: 'Dla kogo' }),
        n.tekst('{zyczenia}', p.x, gora + c.pt(15) * 1.8, p.w, { pt: 9, lh: 1.4, align: 'center', kolor: c.k.akcent2, nazwa: 'Życzenia' }),
        n.tekst('od {od}', p.x, 90 - p.x - c.pt(8) * 1.6, p.w, { pt: 8, align: 'center', kolor: c.k.akcent2, nazwa: 'Od kogo' }),
      ];
      return {
        strony: [{ nazwa: 'Zawieszka', obiekty: o, seria: 'zawieszki', wzorce: [] }],
        tabele: [{ klucz: 'zawieszki', nazwa: 'Zawieszki', kolumny: ['dla', 'zyczenia', 'od'], wiersze: [['Ani', 'Wesołych Świąt i dużo radości!', 'Tomka'], ['Babci', 'Zdrowia i ciepła przez cały rok', 'wnuków'], ['Kuby', 'Niech się spełni każde marzenie', 'cioci Ewy']] }],
        serie: [{ klucz: 'zawieszki', nazwa: 'Zawieszki', tabela: 'zawieszki', uklad: 'dlugi' }],
        numeracja: { tryb: 'brak', od: 1 },
      };
    },
  },
  {
    id: 'spiewnik', nazwa: 'Śpiewnik / modlitewnik', kategoria: 'inne', paleta: 'granat',
    opis: 'Pieśń na stronie z tabeli: tytuł, numer, tekst zwrotek i miejsce na nuty z pliku.', slowa: 'spiewnik piesni modlitewnik nuty teksty koscielny',
    dane: true,
    schemat: [['tytul', 3, 3, 18, 3], ['zdjecie', 3, 8, 24, 8], ['linie', 3, 18, 24, 20]],
    buduj(c, n) {
      const { pole: p } = c;
      const hN = p.h * 0.22;
      const o = [
        n.tekst('{numer}', p.x, p.y, 16, { pt: 16, bold: true, kolor: c.k.akcent2, nazwa: 'Numer' }),
        n.tekst('{tytul}', p.x + 17, p.y, p.w - 17, { pt: 18, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Tytuł pieśni' }),
        { ...n.zdjecie(p.x, p.y + c.pt(18) * 1.7, p.w, hN, { fill: '#ffffff', stroke: c.k.linia, sw: 0.2 }), pole: { kolumna: 'nuty' }, nazwa: 'Nuty (obraz z danych)' },
        n.tekst('{tekst}', p.x, p.y + c.pt(18) * 1.7 + hN + 5, p.w, { pt: 10.5, lh: 1.45, nazwa: 'Tekst pieśni' }),
      ];
      return {
        strony: [{ nazwa: 'Pieśń', obiekty: o, seria: 'piesni' }],
        tabele: [{ klucz: 'piesni', nazwa: 'Pieśni', kolumny: ['numer', 'tytul', 'tekst', 'nuty'], wiersze: [['1', 'Tytuł pierwszej pieśni', '1. Pierwsza zwrotka pieśni,\ndrugi wiersz zwrotki,\ntrzeci wiersz zwrotki.\n\n2. Druga zwrotka pieśni,\ndrugi wiersz zwrotki.', 'piesn-1.png'], ['2', 'Tytuł drugiej pieśni', '1. Tekst pierwszej zwrotki\ni jej drugi wiersz.\n\nRef. Słowa refrenu,\nktóre się powtarzają.', 'piesn-2.png']] }],
        serie: [{ klucz: 'piesni', nazwa: 'Pieśni', tabela: 'piesni', uklad: 'dlugi' }],
        wzorce: [stopkaNumer(c, n)],
      };
    },
  },
  {
    id: 'formularz-zamowienia', nazwa: 'Formularz zamówienia', kategoria: 'inne', paleta: 'mono',
    opis: 'Dane zamawiającego, tabela pozycji z sumą i miejsce na podpis – do wydruku i wypełnienia.', slowa: 'formularz zamowienia zamowienie druk wypelnienia pozycje',
    schemat: [['tytul', 3, 3, 16, 3], ['linie', 3, 8, 24, 8], ['siatka', 3, 18, 24, 14], ['tekst', 17, 35, 10, 1]],
    buduj(c, n) {
      const { pole: p } = c;
      const o = [n.tekst('Formularz zamówienia', p.x, p.y, p.w, { pt: 20, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Tytuł' })];
      let y = p.y + c.pt(20) * 1.8;
      for (const pole of ['Imię i nazwisko', 'Adres', 'Telefon', 'E-mail']) {
        o.push(n.tekst(pole, p.x, y, p.w * 0.28, { pt: 9, kolor: c.k.akcent2 }), n.kreska(p.x + p.w * 0.28, y + c.pt(9) * 1.1, p.w * 0.72, 0.2, c.k.tekst));
        y += c.pt(9) * 2.4;
      }
      y += 3;
      o.push(n.tabela(p.x, y, p.w, [1, 6, 2, 2, 2], [['Lp.', 'Nazwa', 'Ilość', 'Cena', 'Wartość'], ...Array.from({ length: 8 }, (_, i) => [String(i + 1), '', '', '', '']), ['', 'Razem', '', '', '']], { wysokosc: 7, pt: 8.5, nazwa: 'Pozycje zamówienia' }));
      o.push(n.kreska(p.x + p.w * 0.6, p.y + p.h - c.pt(8) * 2.2, p.w * 0.4, 0.2, c.k.tekst), n.tekst('data i podpis', p.x + p.w * 0.6, p.y + p.h - c.pt(8) * 1.5, p.w * 0.4, { pt: 8, align: 'center', kolor: c.k.akcent2 }));
      return { strony: [{ nazwa: 'Formularz', obiekty: o, wzorce: [] }], numeracja: { tryb: 'brak', od: 1 } };
    },
  },
  {
    id: 'lista-kontrolna', nazwa: 'Lista kontrolna / checklista', kategoria: 'planery', paleta: 'pastel',
    opis: 'Lista do odhaczania w dwóch kolumnach: przed wyjazdem, przeprowadzką, wydarzeniem.', slowa: 'lista kontrolna checklista do odhaczenia wyjazd pakowanie zadania',
    schemat: [['tytul', 3, 3, 16, 3], ['punkty', 3, 9, 11, 28], ['punkty', 16, 9, 11, 28]],
    buduj(c, n) {
      const { pole: p } = c;
      const o = [n.tekst('Lista kontrolna', p.x, p.y, p.w, { pt: 20, font: c.f.tytul, bold: true, kolor: c.k.akcent, nazwa: 'Tytuł' })];
      const y0 = p.y + c.pt(20) * 1.9; const kw = (p.w - 6) / 2;
      const krok = c.pt(10) * 2.1;
      const ile = Math.max(4, Math.floor((p.y + p.h - y0) / krok));
      for (let i = 0; i < ile * 2; i += 1) {
        const x = p.x + Math.floor(i / ile) * (kw + 6); const y = y0 + (i % ile) * krok;
        o.push(...n.punkt(x, y, kw, '', { pt: 10 }), n.kreska(x + c.pt(10) * 1.6, y + c.pt(10) * 1.25, kw - c.pt(10) * 1.6));
      }
      return { strony: [{ nazwa: 'Lista', obiekty: o }] };
    },
  },
];

export const szablonSekcji = (id) => SZABLONY_SEKCJI.find((s) => s.id === id) || null;

// Wartości domyślne pytań szablonu.
export function domyslneOpcje(szablon) {
  const o = {};
  for (const p of szablon.pytania || []) o[p.klucz] = typeof p.domyslna === 'function' ? p.domyslna() : p.domyslna;
  return o;
}

// Wydruk sekcji szablonu: format szablonu (np. wizytówka) albo format docelowy; marginesy dostosowane.
export function wydrukSzablonu(szablon, wydrukCelu, { wlasnyFormat = true } = {}) {
  const w = normalizujWydruk(JSON.parse(JSON.stringify(wydrukCelu || {})));
  if (wlasnyFormat && szablon.format) {
    const [sz, wy] = szablon.format;
    Object.assign(w, { szerokosc_mm: sz, wysokosc_mm: wy, format: 'wlasny' });
    const m = szablon.marginesy ?? Math.max(6, Math.round(Math.min(sz, wy) * 0.07));
    w.marginesy = { gora: m, dol: m, wewnetrzny: m, zewnetrzny: m };
  }
  if (szablon.marginesy && !szablon.format) w.marginesy = { gora: szablon.marginesy, dol: szablon.marginesy, wewnetrzny: szablon.marginesy, zewnetrzny: szablon.marginesy };
  return w;
}

// ---------- Wstawianie ----------

// Wstawia gotową sekcję do projektu (zmienia `projekt`). opcje: { wydruk (docelowy), wlasnyFormat, paleta (obiekt
// albo klucz z PALETY), czcionki: { tytul, tekst }, odpowiedzi, poIndeksie (indeks sekcji, po której wstawić) }.
// Zwraca (asynchronicznie) { sekcja, strony } – nowe obiekty w projekcie.
export async function wstawGotowaSekcje(projekt, id, opcje = {}) {
  const szablon = szablonSekcji(id);
  if (!szablon) throw new Error(`Nie ma gotowej sekcji „${id}”.`);
  await zaleznosci();
  const k = typeof opcje.paleta === 'object' && opcje.paleta ? opcje.paleta : (PALETY[opcje.paleta] || PALETY[szablon.paleta] || PALETY.granat);
  const f = { tytul: opcje.czcionki?.tytul || 'Playfair Display', tekst: opcje.czcionki?.tekst || 'Inter' };
  const odpowiedzi = { ...domyslneOpcje(szablon), ...(opcje.odpowiedzi || {}) };
  const wydruk = wydrukSzablonu(szablon, opcje.wydruk || projekt.sekcje[0]?.wydruk, { wlasnyFormat: opcje.wlasnyFormat !== false });
  const sekcja = nowaSekcja(szablon.nazwa, wydruk);
  if (szablon.uklad === 'rozkladowki' && !szablon.okladka) sekcja.uklad = 'rozkladowki';
  if (opcje.uklad) sekcja.uklad = opcje.uklad;
  // Style projektu: szablon korzysta z „Tytuł” i „Tekst” (spis treści, żywa pagina), dokłada je, gdy ich nie ma.
  if (!Array.isArray(projekt.style)) projekt.style = [];
  const styl = (nazwa) => {
    let s = projekt.style.find((x) => x.nazwa === nazwa);
    if (!s) {
      const wzor = domyslneStyle().find((x) => x.nazwa === nazwa);
      if (!wzor) return null;
      s = { ...wzor, ...(nazwa === 'Tytuł' ? { fontFamily: f.tytul, fill: k.akcent } : { fontFamily: f.tekst }) };
      projekt.style.push(s);
    }
    return s;
  };
  const indeks = Number.isInteger(opcje.poIndeksie) ? opcje.poIndeksie : projekt.sekcje.length - 1;
  // Sekcja specjalna szablonu (#177): parametry rodzaju; wynik i format policzy przeliczenie po wstawieniu.
  if (szablon.specjalna) {
    sekcja.specjalna = { ...domyslnaSpecjalna(szablon.specjalna.rodzaj), ...szablon.specjalna, wynik: null };
    if (szablon.specjalna.rodzaj === 'arkusz' && opcje.wlasnyFormat === false) Object.assign(sekcja.specjalna, { uzytek_szer_mm: wydruk.szerokosc_mm, uzytek_wys_mm: wydruk.wysokosc_mm });
    if (szablon.specjalna.rodzaj === 'ulotka' && opcje.wlasnyFormat === false) Object.assign(sekcja.specjalna, { szerokosc_mm: Math.round((wydruk.szerokosc_mm / 3) * 10) / 10, wysokosc_mm: wydruk.wysokosc_mm });
  }
  if (szablon.okladka) {
    sekcja.okladka = normalizujOkladke({ oprawa: odpowiedzi.oprawa || szablon.okladka });
    sekcja.uklad = 'pojedyncze';
    projekt.sekcje.unshift(sekcja);
  } else {
    projekt.sekcje.splice(indeks + 1, 0, sekcja);
  }
  // Okładka: geometria z liczby stron środka – elementy ustawione w strefach przodu, grzbietu i tyłu.
  let okladka = null;
  if (sekcja.okladka) {
    okladka = geometriaOkladki(projekt, sekcja);
    Object.assign(sekcja.wydruk, { szerokosc_mm: okladka.szerokosc, wysokosc_mm: okladka.wysokosc, format: 'wlasny' });
    sekcja.okladka.wynik = okladka;
  }
  // Sekcja specjalna: format z geometrii (np. ulotka zwijana 99 + 99 + 97 mm) – szablon układa się w nim od razu.
  if (sekcja.specjalna) {
    const g = geometriaSpecjalna(projekt, sekcja);
    if (g) {
      Object.assign(sekcja.wydruk, { szerokosc_mm: g.szerokosc, wysokosc_mm: g.wysokosc, format: 'wlasny' });
      sekcja.specjalna.wynik = g;
      sekcja.uklad = 'pojedyncze';
    }
  }
  const W = sekcja.wydruk.szerokosc_mm;
  const H = sekcja.wydruk.wysokosc_mm;
  const m = sekcja.wydruk.marginesy;
  const mx = Math.max(m.wewnetrzny, m.zewnetrzny);
  // Skala pisma: pierwiastek z rozmiaru (A5 = 1, A4 ≈ 1,19, A3 ≈ 1,42), na małych formatach nie mniej niż 0,75 –
  // tekst wizytówki i etykiety zostaje czytelny.
  const s = Math.min(2.2, Math.max(0.75, Math.sqrt(Math.min(W, H) / 148)));
  const c = {
    W, H, spad: sekcja.wydruk.spad_mm || 0, m, k, f, s, uid, styl, okladka, rok: Number(odpowiedzi.rok) || domyslnyRok(), opcje: odpowiedzi,
    pole: { x: mx, y: m.gora, w: Math.max(10, W - 2 * mx), h: Math.max(10, H - m.gora - m.dol) },
    pt: (n) => ptNaMm(n * s),
  };
  const wynik = szablon.buduj(c, narzedzia(c));
  if (wynik.numeracja) sekcja.numeracja = wynik.numeracja;
  // Wzorce szablonu: nazwa z nazwą sekcji, przypięte do sekcji.
  const idWzorcow = [];
  for (const w of wynik.wzorce || []) {
    const wz = nowyWzorzec(`${w.nazwa} – ${szablon.nazwa}`, sekcja.wydruk);
    wz.obiekty = w.obiekty.filter(Boolean);
    wz.lustro = Boolean(w.lustro);
    projekt.wzorce = [...(projekt.wzorce || []), wz];
    idWzorcow.push(wz.id);
  }
  sekcja.wzorce = idWzorcow;
  // Dane: tabele i serie z kluczami szablonu → identyfikatory projektu.
  const tabele = new Map();
  for (const t of wynik.tabele || []) {
    let nazwa = t.nazwa;
    for (let i = 2; (projekt.tabele || []).some((x) => x.nazwa === nazwa); i += 1) nazwa = `${t.nazwa} (${i})`;
    const tab = nowaTabela(nazwa, t.kolumny, t.wiersze);
    projekt.tabele = [...(projekt.tabele || []), tab];
    tabele.set(t.klucz, tab.id);
  }
  const serie = new Map();
  for (const sr of wynik.serie || []) {
    const se = { ...nowaSeria(sr.nazwa), tryb: sr.tryb || 'tabela', uklad: sr.uklad || 'dlugi', ile: sr.ile || 1, tabela: sr.tabela ? tabele.get(sr.tabela) || null : null };
    projekt.serie = [...(projekt.serie || []), se];
    serie.set(sr.klucz, se.id);
  }
  const strony = wynik.strony.map((st, i) => {
    const strona = nowaStrona(st.nazwa || `${szablon.nazwa} ${i + 1}`, sekcja.id);
    strona.obiekty = st.obiekty.filter(Boolean);
    if (st.tlo) strona.tlo = st.tlo;
    if (st.seria && serie.has(st.seria)) strona.seria = serie.get(st.seria);
    if (Array.isArray(st.wzorce)) strona.wzorce = st.wzorce;
    else strona.wzorce = WZORCE_Z_SEKCJI;
    if (st.prowadnice && !sekcja.specjalna) strona.prowadnice = st.prowadnice; // sekcja specjalna sama rysuje zgięcia
    return strona;
  });
  projekt.strony.push(...strony);
  uporzadkujStrony(projekt);
  // Okładka twarda (#177): od razu z wyklejkami (czystymi) – twarda oprawa bez nich nie zostanie zszyta z blokiem.
  if (sekcja.okladka?.oprawa === 'twarda') dodajWyklejki(projekt, { zadruk: 'czysta' });
  return { sekcja, strony };
}

// Projekt jest „pusty”: jedna sekcja, jedna strona bez elementów, bez danych – szablon może go zastąpić.
export function projektPusty(projekt) {
  return projekt.sekcje.length === 1 && projekt.strony.length === 1 && !projekt.strony[0].obiekty.length && !(projekt.tabele || []).length && !(projekt.wzorce || []).length;
}

// Usuwa pustą sekcję startową (po wstawieniu szablonu do nowego projektu).
export function usunPustyStart(projekt, zostaw) {
  if (projekt.sekcje.length < 2) return;
  const pierwsza = projekt.sekcje.find((s) => s.id !== zostaw.id && !s.okladka);
  if (!pierwsza) return;
  const jejStrony = projekt.strony.filter((s) => s.sekcja === pierwsza.id);
  if (jejStrony.length === 1 && !jejStrony[0].obiekty.length) {
    projekt.sekcje = projekt.sekcje.filter((s) => s !== pierwsza);
    projekt.strony = projekt.strony.filter((s) => s !== jejStrony[0]);
  }
}

// Schematyczny podgląd szablonu (Biblioteka, okno przed miniaturami): strona 30 × 42 z blokami.
export function svgSchematu(szablon) {
  const pion = !szablon.format || szablon.format[1] >= szablon.format[0];
  const [W, H] = pion ? [30, 42] : [42, 30];
  const sx = W / 30; const sy = H / 42;
  const r = (x, y, w, h, kl) => `<rect x="${(x * (pion ? 1 : sx * 1.0)).toFixed(1)}" y="${(y * (pion ? 1 : sy)).toFixed(1)}" width="${(w * (pion ? 1 : sx)).toFixed(1)}" height="${Math.max(0.6, h * (pion ? 1 : sy)).toFixed(1)}" class="${kl}"/>`;
  const czesci = (szablon.schemat || []).map(([rodzaj, x, y, w, h]) => {
    if (rodzaj === 'linie' || rodzaj === 'punkty') {
      let o = '';
      for (let yy = y; yy < y + h; yy += 2.6) o += r(x, yy, w, 0.5, 'sch-linia');
      return o;
    }
    if (rodzaj === 'siatka') {
      let o = r(x, y, w, h, 'sch-pole');
      for (let i = 1; i < 7; i += 1) o += r(x + (w / 7) * i, y, 0.3, h, 'sch-linia');
      for (let j = 1; j < 5; j += 1) o += r(x, y + (h / 5) * j, w, 0.3, 'sch-linia');
      return o;
    }
    return r(x, y, w, h, `sch-${rodzaj}`);
  }).join('');
  const off = pion ? 'translate(20 5)' : 'translate(14 11)';
  return `<svg viewBox="0 0 70 52" aria-hidden="true"><g transform="${off}"><rect x="0" y="0" width="${W}" height="${H}" class="sch-strona"/>${czesci}</g></svg>`;
}
