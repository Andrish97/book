// Gotowe wzorce (#25, galeria #164): wspólne elementy stron – numer, nagłówek, stopka, tło, ramka. Każdy
// buduje się z formatu i marginesów sekcji (pasuje do A5 tak samo jak do kwadratu) oraz z kolorów i czcionek
// zestawu marki, jeśli jest. Po dodaniu do projektu to zwykły wzorzec – można go zmieniać jak własny.
//
// Definicja: { klucz, nazwa, opis, grupa, slowa?, lustro?, tlo?(wydruk, marka), obiekty(wydruk, marka) }.
// Wzorce z „lustro” są zaprojektowane dla strony prawej (zewnętrzny margines po prawej); na lewych stronach
// rozkładówki odbijają się same. marka: { akcent, akcent2, jasny, tekst, linia, siatka, fontTekst, fontNaglowek }.

import { uid, ptNaMm } from './projekt.js';

export const MARKA_DOMYSLNA = {
  akcent: '#2f5bd3', akcent2: '#c9a227', jasny: '#eef1fb', tekst: '#4a4843', linia: '#b9b5aa', siatka: '#d5d1c6',
  fontTekst: 'Inter', fontNaglowek: 'Inter',
};
const M = (m) => ({ ...MARKA_DOMYSLNA, ...(m || {}) });

const tekst = (text, o, m) => ({
  type: 'textbox', version: '5.3.0', id: uid('o'), text, styles: [], fontFamily: M(m).fontTekst, fontSize: ptNaMm(9), fill: M(m).tekst,
  lineHeight: 1.2, textAlign: 'left', strokeWidth: 0, ...o,
});
const pasek = (left, top, width, height, o = {}) => ({ type: 'rect', version: '5.3.0', id: uid('o'), left, top, width, height, fill: '#b9b5aa', strokeWidth: 0, ...o });
const kolo = (cx, cy, r, o = {}) => ({ type: 'ellipse', version: '5.3.0', id: uid('o'), left: cx - r, top: cy - r, rx: r, ry: r, width: 2 * r, height: 2 * r, fill: '#b9b5aa', strokeWidth: 0, ...o });
const obrys = (left, top, width, height, o = {}) => ({ type: 'rect', version: '5.3.0', id: uid('o'), left, top, width, height, fill: '', stroke: '#4a4843', strokeWidth: 0.3, strokeUniform: true, ...o });

// Wiele odcinków jako jedna ścieżka (lekko i wektorowo – linie, kratka, kropki przy kresce zerowej długości).
function sciezka(nazwa, odcinki, o = {}) {
  const path = [];
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x1, y1, x2, y2] of odcinki) {
    path.push(['M', x1, y1], ['L', x2, y2]);
    minX = Math.min(minX, x1, x2); minY = Math.min(minY, y1, y2); maxX = Math.max(maxX, x1, x2); maxY = Math.max(maxY, y1, y2);
  }
  return { type: 'path', version: '5.3.0', id: uid('o'), nazwa, path, left: minX, top: minY, width: maxX - minX, height: maxY - minY, fill: '', stroke: '#d5d1c6', strokeWidth: 0.2, ...o };
}

// Pole między marginesami: { x, y, w, h } – dla strony prawej (zewnętrzny margines po prawej).
function pole(wydruk) {
  const m = wydruk.marginesy;
  return { x: m.wewnetrzny, y: m.gora, w: wydruk.szerokosc_mm - m.wewnetrzny - m.zewnetrzny, h: wydruk.wysokosc_mm - m.gora - m.dol };
}
// Środek dolnego / górnego marginesu w pionie (dla tekstów ok. 3,5 mm wysokości).
const yDol = (w, wys = 3.2) => w.wysokosc_mm - w.marginesy.dol / 2 - wys / 2;
const yGora = (w, wys = 3.2) => Math.max(2, w.marginesy.gora / 2 - wys / 2);

const linie = (p, krok, o) => {
  const odc = [];
  for (let y = p.y + krok; y <= p.y + p.h + 0.01; y += krok) odc.push([p.x, y, p.x + p.w, y]);
  return odc;
};

export const GRUPY_WZORCOW = ['Numeracja', 'Nagłówki i stopki', 'Tła i papier', 'Ramki', 'Kalendarz i planer', 'Książka', 'Katalog i oferta', 'Gazetka', 'Zaproszenie'];

export const WZORCE_STANDARDOWE = [
  // ---------- Numeracja ----------
  {
    klucz: 'numer-dol', grupa: 'Numeracja', nazwa: 'Numer strony na dole', opis: 'Numer na środku dolnego marginesu.', slowa: 'numeracja numer strony stopka',
    obiekty: (w, m) => { const p = pole(w); return [tekst('{nr}', { left: p.x, top: yDol(w), width: p.w, textAlign: 'center', nazwa: 'Numer strony' }, m)]; },
  },
  {
    klucz: 'numer-zewnatrz', grupa: 'Numeracja', nazwa: 'Numer strony przy zewnętrznej krawędzi', opis: 'W rozkładówkach numer zawsze stoi po zewnętrznej stronie.', lustro: true, slowa: 'numeracja numer strony ksiazka rozkladowka',
    obiekty: (w, m) => { const p = pole(w); return [tekst('{nr}', { left: p.x, top: yDol(w), width: p.w, textAlign: 'right', nazwa: 'Numer strony' }, m)]; },
  },
  {
    klucz: 'numer-z-liczba', grupa: 'Numeracja', nazwa: 'Strona 5 z 120', opis: '„Strona 5 z 120” na środku dolnego marginesu.', slowa: 'numeracja liczba stron',
    obiekty: (w, m) => { const p = pole(w); return [tekst('Strona {nr} z {liczba_stron}', { left: p.x, top: yDol(w), width: p.w, textAlign: 'center', fontSize: ptNaMm(8), nazwa: 'Numer strony' }, m)]; },
  },
  {
    klucz: 'numer-kreski', grupa: 'Numeracja', nazwa: 'Numer z kreskami', opis: 'Klasyczne „— 5 —” na dole strony.', slowa: 'numeracja ozdobny klasyczny',
    obiekty: (w, m) => { const p = pole(w); return [tekst('—  {nr}  —', { left: p.x, top: yDol(w), width: p.w, textAlign: 'center', fontFamily: M(m).fontNaglowek, nazwa: 'Numer strony' }, m)]; },
  },
  {
    klucz: 'numer-kolo', grupa: 'Numeracja', nazwa: 'Numer w kółku', opis: 'Numer na kolorowym kółku przy zewnętrznym rogu.', lustro: true, slowa: 'numeracja kolo kolorowy nowoczesny',
    obiekty: (w, m) => {
      const r = Math.min(4, w.marginesy.dol / 3); const cx = w.szerokosc_mm - w.marginesy.zewnetrzny - r; const cy = w.wysokosc_mm - w.marginesy.dol / 2;
      return [kolo(cx, cy, r, { fill: M(m).akcent, nazwa: 'Kółko numeru' }), tekst('{nr}', { left: cx - r, top: cy - 1.6, width: 2 * r, textAlign: 'center', fontSize: ptNaMm(8), fill: '#ffffff', fontWeight: 'bold', nazwa: 'Numer strony' }, m)];
    },
  },
  {
    klucz: 'numer-boczny', grupa: 'Numeracja', nazwa: 'Numer na pasku bocznym', opis: 'Pionowy pasek w kolorze marki przy zewnętrznej krawędzi, numer u dołu paska.', lustro: true, slowa: 'numeracja pasek bok kolor',
    obiekty: (w, m) => {
      const s = 7; const x = w.szerokosc_mm - s;
      return [pasek(x, -w.spad_mm, s + w.spad_mm, w.wysokosc_mm + 2 * w.spad_mm, { fill: M(m).akcent, nazwa: 'Pasek boczny', bez_ostrzezen: true }),
        tekst('{nr}', { left: x, top: w.wysokosc_mm - w.marginesy.dol / 2 - 1.6, width: s, textAlign: 'center', fontSize: ptNaMm(8), fill: '#ffffff', fontWeight: 'bold', nazwa: 'Numer strony' }, m)];
    },
  },
  {
    klucz: 'numer-rzymski', grupa: 'Numeracja', nazwa: 'Numer rzymski (wstęp)', opis: 'Numery I, II, III… – np. na stronach wstępu przed właściwą numeracją.', slowa: 'numeracja rzymskie wstep przedmowa',
    obiekty: (w, m) => { const p = pole(w); return [tekst('{nr:I}', { left: p.x, top: yDol(w), width: p.w, textAlign: 'center', nazwa: 'Numer strony' }, m)]; },
  },
  // ---------- Nagłówki i stopki ----------
  {
    klucz: 'stopka', grupa: 'Nagłówki i stopki', nazwa: 'Stopka: nazwa projektu i numer', opis: 'Cienka linia, nazwa projektu z lewej, „str. 5 z 120” z prawej.', slowa: 'stopka linia numer nazwa',
    obiekty: (w, m) => {
      const p = pole(w); const y = w.wysokosc_mm - w.marginesy.dol + 1.5;
      return [
        pasek(p.x, y, p.w, 0.25, { nazwa: 'Linia stopki', fill: M(m).linia }),
        tekst('{projekt}', { left: p.x, top: y + 1.5, width: p.w / 2, fontSize: ptNaMm(8), nazwa: 'Nazwa projektu' }, m),
        tekst('str. {nr} z {liczba_stron}', { left: p.x + p.w / 2, top: y + 1.5, width: p.w / 2, fontSize: ptNaMm(8), textAlign: 'right', nazwa: 'Numer strony' }, m),
      ];
    },
  },
  {
    klucz: 'naglowek', grupa: 'Nagłówki i stopki', nazwa: 'Nagłówek: nazwa sekcji', opis: 'Nazwa sekcji nad górnym marginesem, z linią pod spodem.', slowa: 'naglowek sekcja linia',
    obiekty: (w, m) => {
      const p = pole(w); const y = Math.max(2, w.marginesy.gora - 6);
      return [
        tekst('{sekcja}', { left: p.x, top: y, width: p.w, fontSize: ptNaMm(8), charSpacing: 80, wielkosc_liter: 'wielkie', nazwa: 'Nazwa sekcji' }, m),
        pasek(p.x, y + 4.2, p.w, 0.25, { nazwa: 'Linia nagłówka', fill: M(m).linia }),
      ];
    },
  },
  {
    klucz: 'naglowek-projekt-sekcja', grupa: 'Nagłówki i stopki', nazwa: 'Nagłówek: projekt i sekcja', opis: 'Nazwa projektu z lewej, nazwa sekcji z prawej, linia pod spodem.', slowa: 'naglowek projekt sekcja',
    obiekty: (w, m) => {
      const p = pole(w); const y = Math.max(2, w.marginesy.gora - 6);
      return [
        tekst('{projekt}', { left: p.x, top: y, width: p.w / 2, fontSize: ptNaMm(7.5), nazwa: 'Nazwa projektu' }, m),
        tekst('{sekcja}', { left: p.x + p.w / 2, top: y, width: p.w / 2, fontSize: ptNaMm(7.5), textAlign: 'right', fill: M(m).akcent, nazwa: 'Nazwa sekcji' }, m),
        pasek(p.x, y + 4.2, p.w, 0.25, { nazwa: 'Linia nagłówka', fill: M(m).linia }),
      ];
    },
  },
  {
    klucz: 'naglowek-pasek', grupa: 'Nagłówki i stopki', nazwa: 'Kolorowy pas nagłówka', opis: 'Pas w kolorze marki przez całą szerokość (ze spadem), w nim nazwa sekcji.', slowa: 'naglowek pas kolor banner',
    obiekty: (w, m) => {
      const h = Math.max(8, w.marginesy.gora - 4); const p = pole(w);
      return [pasek(-w.spad_mm, -w.spad_mm, w.szerokosc_mm + 2 * w.spad_mm, h + w.spad_mm, { fill: M(m).akcent, nazwa: 'Pas nagłówka', bez_ostrzezen: true }),
        tekst('{sekcja}', { left: p.x, top: h / 2 - 2, width: p.w, fontSize: ptNaMm(10), fill: '#ffffff', fontWeight: 'bold', fontFamily: M(m).fontNaglowek, nazwa: 'Nazwa sekcji' }, m)];
    },
  },
  {
    klucz: 'stopka-pasek', grupa: 'Nagłówki i stopki', nazwa: 'Kolorowy pas stopki z numerem', opis: 'Pas w kolorze marki na dole strony, numer w środku.', slowa: 'stopka pas kolor numer',
    obiekty: (w, m) => {
      const h = Math.max(7, w.marginesy.dol - 4); const y = w.wysokosc_mm - h;
      return [pasek(-w.spad_mm, y, w.szerokosc_mm + 2 * w.spad_mm, h + w.spad_mm, { fill: M(m).akcent, nazwa: 'Pas stopki', bez_ostrzezen: true }),
        tekst('{nr}', { left: 0, top: y + h / 2 - 1.8, width: w.szerokosc_mm, textAlign: 'center', fill: '#ffffff', fontWeight: 'bold', nazwa: 'Numer strony' }, m)];
    },
  },
  {
    klucz: 'stopka-kontakt', grupa: 'Nagłówki i stopki', nazwa: 'Stopka z kontaktem', opis: 'Adres strony, e-mail i telefon na dole – podmień na swoje.', slowa: 'stopka kontakt adres telefon email www',
    obiekty: (w, m) => {
      const p = pole(w); const y = w.wysokosc_mm - w.marginesy.dol + 1.5;
      return [pasek(p.x, y, p.w, 0.25, { nazwa: 'Linia stopki', fill: M(m).linia }),
        tekst('www.twojastrona.pl  ·  kontakt@twojastrona.pl  ·  tel. 000 000 000', { left: p.x, top: y + 1.5, width: p.w, textAlign: 'center', fontSize: ptNaMm(7), nazwa: 'Kontakt' }, m)];
    },
  },
  // ---------- Tła i papier ----------
  {
    klucz: 'linie', grupa: 'Tła i papier', nazwa: 'Linie do pisania', opis: 'Poziome linie co 8 mm w polu między marginesami.', slowa: 'linie zeszyt notatki pisanie',
    obiekty: (w) => {
      const p = pole(w); const l = [];
      for (let y = p.y + 8; y <= p.y + p.h + 0.01; y += 8) l.push(pasek(p.x, y, p.w, 0.2, { fill: '#d5d1c6' }));
      return [{ type: 'group', version: '5.3.0', id: uid('o'), nazwa: 'Linie do pisania', left: p.x, top: p.y + 8, width: p.w, height: l.at(-1).top - (p.y + 8) + 0.2, objects: l.map((x) => ({ ...x, left: x.left - p.x - p.w / 2, top: x.top - (p.y + 8) - (l.at(-1).top - (p.y + 8) + 0.2) / 2 })) }];
    },
  },
  {
    klucz: 'kratka', grupa: 'Tła i papier', nazwa: 'Kratka 5 mm', opis: 'Siatka pionowych i poziomych linii w polu między marginesami.', slowa: 'kratka siatka zeszyt matematyka',
    obiekty: (w) => {
      const p = pole(w); const kol = Math.floor(p.w / 5); const wier = Math.floor(p.h / 5);
      const szer = kol * 5; const wys = wier * 5; const l = [];
      for (let i = 0; i <= kol; i += 1) l.push(pasek(i * 5 - szer / 2, -wys / 2, 0.15, wys + 0.15, { fill: '#d5d1c6' }));
      for (let i = 0; i <= wier; i += 1) l.push(pasek(-szer / 2, i * 5 - wys / 2, szer + 0.15, 0.15, { fill: '#d5d1c6' }));
      return [{ type: 'group', version: '5.3.0', id: uid('o'), nazwa: 'Kratka', left: p.x + (p.w - szer) / 2, top: p.y + (p.h - wys) / 2, width: szer + 0.15, height: wys + 0.15, objects: l.map((x) => ({ ...x, left: x.left - 0.075, top: x.top - 0.075 })) }];
    },
  },
  {
    klucz: 'kropki', grupa: 'Tła i papier', nazwa: 'Kropki 5 mm', opis: 'Siatka kropek jak w notesie typu bullet journal.', slowa: 'kropki dot grid bullet journal notes',
    obiekty: (w) => {
      const p = pole(w); const kol = Math.floor(p.w / 5); const wier = Math.floor(p.h / 5);
      const x0 = p.x + (p.w - kol * 5) / 2; const y0 = p.y + (p.h - wier * 5) / 2; const odc = [];
      for (let j = 0; j <= wier; j += 1) odc.push([x0, y0 + j * 5, x0 + kol * 5, y0 + j * 5]);
      return [sciezka('Kropki', odc, { stroke: '#b9b5aa', strokeWidth: 0.55, strokeDashArray: [0, 5], strokeLineCap: 'round' })];
    },
  },
  {
    klucz: 'milimetrowy', grupa: 'Tła i papier', nazwa: 'Papier milimetrowy', opis: 'Linie co 1 mm, mocniejsze co 1 cm.', slowa: 'milimetrowy siatka wykres techniczny',
    obiekty: (w, m) => {
      const p = pole(w); const kol = Math.floor(p.w / 10) * 10; const wier = Math.floor(p.h / 10) * 10;
      const x0 = p.x + (p.w - kol) / 2; const y0 = p.y + (p.h - wier) / 2; const drobne = []; const grube = [];
      for (let i = 0; i <= kol; i += 1) (i % 10 ? drobne : grube).push([x0 + i, y0, x0 + i, y0 + wier]);
      for (let j = 0; j <= wier; j += 1) (j % 10 ? drobne : grube).push([x0, y0 + j, x0 + kol, y0 + j]);
      return [sciezka('Siatka 1 mm', drobne, { stroke: M(m).akcent, opacity: 0.25, strokeWidth: 0.08 }), sciezka('Siatka 1 cm', grube, { stroke: M(m).akcent, opacity: 0.55, strokeWidth: 0.2 })];
    },
  },
  {
    klucz: 'linie-margines', grupa: 'Tła i papier', nazwa: 'Zeszyt z marginesem', opis: 'Linie co 8 mm i czerwona linia marginesu po lewej.', slowa: 'zeszyt linie margines szkola',
    obiekty: (w) => {
      const p = pole(w);
      return [sciezka('Linie', linie(p, 8), { stroke: '#c7d3e8', strokeWidth: 0.25 }), sciezka('Margines', [[p.x + 12, p.y, p.x + 12, p.y + p.h]], { stroke: '#e06666', strokeWidth: 0.3 })];
    },
  },
  {
    klucz: 'tlo-kolor', grupa: 'Tła i papier', nazwa: 'Kolorowe tło', opis: 'Jasny kolor marki na całej stronie (zmienisz w ustawieniach wzorca).', slowa: 'tlo kolor strona',
    tlo: (w, m) => M(m).jasny,
    obiekty: () => [],
  },
  {
    klucz: 'tlo-rog', grupa: 'Tła i papier', nazwa: 'Ozdobny róg', opis: 'Duże koło w kolorze marki wychodzące zza górnego zewnętrznego rogu.', lustro: true, slowa: 'tlo ozdoba rog kolo',
    obiekty: (w, m) => { const r = Math.min(w.szerokosc_mm, w.wysokosc_mm) * 0.28; return [kolo(w.szerokosc_mm, 0, r, { fill: M(m).jasny, nazwa: 'Róg', bez_ostrzezen: true })]; },
  },
  {
    klucz: 'znak-wodny', grupa: 'Tła i papier', nazwa: 'Znak wodny „WZÓR”', opis: 'Duży, blady napis po skosie nad treścią – np. na próbnym wydruku.', slowa: 'znak wodny wzor probny szkic',
    obiekty: (w, m) => {
      const d = Math.hypot(w.szerokosc_mm, w.wysokosc_mm) * 0.7;
      return [tekst('WZÓR', {
        left: w.szerokosc_mm / 2, top: w.wysokosc_mm / 2, originX: 'center', originY: 'center', width: d, textAlign: 'center', angle: -Math.atan2(w.wysokosc_mm, w.szerokosc_mm) * 180 / Math.PI,
        fontSize: Math.min(w.szerokosc_mm, w.wysokosc_mm) * 0.22, fontWeight: 'bold', fill: M(m).tekst, opacity: 0.08, warstwa: 'nad', nazwa: 'Znak wodny',
      }, m)];
    },
  },
  // ---------- Ramki ----------
  {
    klucz: 'ramka', grupa: 'Ramki', nazwa: 'Ramka w marginesach', opis: 'Cienka ramka wokół pola tekstu, nad treścią strony.', slowa: 'ramka obramowanie',
    obiekty: (w) => { const p = pole(w); return [obrys(p.x, p.y, p.w - 0.3, p.h - 0.3, { nazwa: 'Ramka', warstwa: 'nad' })]; },
  },
  {
    klucz: 'ramka-podwojna', grupa: 'Ramki', nazwa: 'Ramka podwójna', opis: 'Gruba i cienka linia wokół pola tekstu.', slowa: 'ramka podwojna elegancka dyplom',
    obiekty: (w, m) => {
      const p = pole(w); const o = 1.6;
      return [obrys(p.x - o, p.y - o, p.w + 2 * o - 0.8, p.h + 2 * o - 0.8, { strokeWidth: 0.8, stroke: M(m).akcent, nazwa: 'Ramka zewnętrzna', warstwa: 'nad' }),
        obrys(p.x, p.y, p.w - 0.25, p.h - 0.25, { strokeWidth: 0.25, stroke: M(m).akcent, nazwa: 'Ramka wewnętrzna', warstwa: 'nad' })];
    },
  },
  {
    klucz: 'ramka-zaokraglona', grupa: 'Ramki', nazwa: 'Ramka zaokrąglona', opis: 'Ramka z zaokrąglonymi narożnikami w kolorze marki.', slowa: 'ramka zaokraglona miekka',
    obiekty: (w, m) => { const p = pole(w); return [obrys(p.x, p.y, p.w - 0.5, p.h - 0.5, { rx: 5, ry: 5, strokeWidth: 0.5, stroke: M(m).akcent, nazwa: 'Ramka', warstwa: 'nad' })]; },
  },
  {
    klucz: 'ramka-krawedz', grupa: 'Ramki', nazwa: 'Kolorowa obwódka strony', opis: 'Szeroki pas koloru marki wzdłuż krawędzi strony (ze spadem).', slowa: 'ramka obwodka krawedz spad kolor',
    obiekty: (w, m) => {
      const s = 5; const b = w.spad_mm; const W = w.szerokosc_mm; const H = w.wysokosc_mm; const k = { fill: M(m).akcent, bez_ostrzezen: true };
      return [pasek(-b, -b, W + 2 * b, s + b, { ...k, nazwa: 'Pas górny' }), pasek(-b, H - s, W + 2 * b, s + b, { ...k, nazwa: 'Pas dolny' }),
        pasek(-b, s, s + b, H - 2 * s, { ...k, nazwa: 'Pas lewy' }), pasek(W - s, s, s + b, H - 2 * s, { ...k, nazwa: 'Pas prawy' })];
    },
  },
  {
    klucz: 'ramka-narozniki', grupa: 'Ramki', nazwa: 'Narożniki', opis: 'Same narożniki pola tekstu – lekka, nowoczesna ramka.', slowa: 'ramka narozniki rogi',
    obiekty: (w, m) => {
      const p = pole(w); const d = Math.min(12, p.w / 6); const x2 = p.x + p.w; const y2 = p.y + p.h;
      return [sciezka('Narożniki', [[p.x, p.y + d, p.x, p.y], [p.x, p.y, p.x + d, p.y], [x2 - d, p.y, x2, p.y], [x2, p.y, x2, p.y + d],
        [p.x, y2 - d, p.x, y2], [p.x, y2, p.x + d, y2], [x2 - d, y2, x2, y2], [x2, y2 - d, x2, y2]], { stroke: M(m).akcent, strokeWidth: 0.6, strokeLineCap: 'square', warstwa: 'nad' })];
    },
  },
  // ---------- Kalendarz i planer ----------
  {
    klucz: 'zakladka', grupa: 'Kalendarz i planer', nazwa: 'Zakładka na brzegu', opis: 'Kolorowa zakładka przy zewnętrznej krawędzi; na powielonych stronach serii przesuwa się w dół (6 pozycji).', lustro: true, slowa: 'zakladka indeks brzeg seria planer',
    obiekty: (w, m) => {
      const wys = Math.min(30, (w.wysokosc_mm - 2 * w.marginesy.gora) / 6);
      return [{
        type: 'rect', version: '5.3.0', id: uid('o'), nazwa: 'Zakładka', left: w.szerokosc_mm - 8, top: w.marginesy.gora, width: 8 + w.spad_mm, height: wys, fill: M(m).akcent, strokeWidth: 0, bez_ostrzezen: true,
        z_danych: { y: { pole: 'egzemplarz', tryb: 'pozycja', krok: Math.round(wys * 10) / 10, co: 6 } },
      }];
    },
  },
  {
    klucz: 'naglowek-dnia', grupa: 'Kalendarz i planer', nazwa: 'Nagłówek dnia', opis: 'Duża nazwa strony z linią – w serii dni podmień ją na pole z datą z tabeli.', slowa: 'kalendarz dzien data planer naglowek',
    obiekty: (w, m) => {
      const p = pole(w); const y = Math.max(2, w.marginesy.gora - 12);
      return [tekst('{strona}', { left: p.x, top: y, width: p.w, fontSize: ptNaMm(18), fontWeight: 'bold', fontFamily: M(m).fontNaglowek, fill: M(m).akcent, nazwa: 'Data / nazwa dnia' }, m),
        pasek(p.x, y + 9, p.w, 0.4, { fill: M(m).akcent, nazwa: 'Linia' })];
    },
  },
  {
    klucz: 'planer-notatki-bok', grupa: 'Kalendarz i planer', nazwa: 'Kolumna „Notatki” z boku', opis: 'Wąska kolumna z liniami przy zewnętrznym marginesie.', lustro: true, slowa: 'planer notatki kolumna linie',
    obiekty: (w, m) => {
      const p = pole(w); const s = Math.min(38, p.w * 0.3); const x = p.x + p.w - s;
      return [pasek(x - 3, p.y, 0.25, p.h, { fill: M(m).linia, nazwa: 'Linia kolumny' }),
        tekst('NOTATKI', { left: x, top: p.y, width: s, fontSize: ptNaMm(7), charSpacing: 120, fill: M(m).akcent, fontWeight: 'bold', nazwa: 'Tytuł kolumny' }, m),
        sciezka('Linie notatek', linie({ x, y: p.y + 5, w: s, h: p.h - 5 }, 7), { stroke: M(m).siatka, strokeWidth: 0.2 })];
    },
  },
  {
    klucz: 'planer-tydzien', grupa: 'Kalendarz i planer', nazwa: 'Tydzień: 7 dni', opis: 'Pole strony podzielone na 7 pasów z nazwami dni.', slowa: 'planer tydzien dni kalendarz tygodniowy',
    obiekty: (w, m) => {
      const p = pole(w); const dni = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']; const h = p.h / 7; const o = [];
      dni.forEach((d, i) => {
        o.push(tekst(d, { left: p.x, top: p.y + i * h + 1, width: p.w, fontSize: ptNaMm(7.5), fontWeight: 'bold', fill: i > 4 ? M(m).akcent : M(m).tekst, nazwa: d }, m));
        if (i) o.push(pasek(p.x, p.y + i * h, p.w, 0.25, { fill: M(m).linia, nazwa: `Linia ${i}` }));
      });
      return o;
    },
  },
  // ---------- Książka ----------
  {
    klucz: 'ksiazka-klasyczna', grupa: 'Książka', nazwa: 'Książka klasyczna', opis: 'Żywa pagina (tytuł rozdziału) na górze, numer przy zewnętrznym rogu na dole.', lustro: true, slowa: 'ksiazka zywa pagina rozdzial numer',
    obiekty: (w, m) => {
      const p = pole(w);
      return [tekst('{rozdzial}', { left: p.x, top: yGora(w), width: p.w, textAlign: 'center', fontSize: ptNaMm(8), fontStyle: 'italic', fontFamily: M(m).fontNaglowek, nazwa: 'Żywa pagina' }, m),
        tekst('{nr}', { left: p.x, top: yDol(w), width: p.w, textAlign: 'right', fontFamily: M(m).fontNaglowek, nazwa: 'Numer strony' }, m)];
    },
  },
  {
    klucz: 'ksiazka-numer-gora', grupa: 'Książka', nazwa: 'Numer i rozdział u góry', opis: 'Numer strony i tytuł rozdziału przy zewnętrznym rogu, nad tekstem.', lustro: true, slowa: 'ksiazka zywa pagina numer gora',
    obiekty: (w, m) => {
      const p = pole(w); const y = yGora(w);
      return [tekst('{rozdzial}   |   {nr}', { left: p.x, top: y, width: p.w, textAlign: 'right', fontSize: ptNaMm(8), charSpacing: 40, nazwa: 'Żywa pagina z numerem' }, m)];
    },
  },
  {
    klucz: 'ksiazka-tytul-sekcji', grupa: 'Książka', nazwa: 'Tytuł książki i rozdziału', opis: 'Nazwa projektu i rozdziału w nagłówku, cienka linia, numer na dole na środku.', slowa: 'ksiazka naglowek tytul rozdzial',
    obiekty: (w, m) => {
      const p = pole(w); const y = Math.max(2, w.marginesy.gora - 6);
      return [tekst('{projekt}', { left: p.x, top: y, width: p.w / 2, fontSize: ptNaMm(7.5), fontStyle: 'italic', fontFamily: M(m).fontNaglowek, nazwa: 'Tytuł książki' }, m),
        tekst('{rozdzial}', { left: p.x + p.w / 2, top: y, width: p.w / 2, textAlign: 'right', fontSize: ptNaMm(7.5), fontFamily: M(m).fontNaglowek, nazwa: 'Rozdział' }, m),
        pasek(p.x, y + 4.2, p.w, 0.2, { fill: M(m).linia, nazwa: 'Linia' }),
        tekst('{nr}', { left: p.x, top: yDol(w), width: p.w, textAlign: 'center', fontFamily: M(m).fontNaglowek, nazwa: 'Numer strony' }, m)];
    },
  },
  // ---------- Katalog i oferta ----------
  {
    klucz: 'katalog', grupa: 'Katalog i oferta', nazwa: 'Katalog: logo i kontakt', opis: 'Miejsce na logo i nazwę sekcji u góry, kontakt i numer na dole.', slowa: 'katalog oferta firma logo kontakt',
    obiekty: (w, m) => {
      const p = pole(w); const y = Math.max(2, w.marginesy.gora - 9); const yd = w.wysokosc_mm - w.marginesy.dol + 2;
      return [obrys(p.x, y, 18, 6, { stroke: M(m).linia, strokeDashArray: [1, 1], nazwa: 'Miejsce na logo' }),
        tekst('LOGO', { left: p.x, top: y + 1.6, width: 18, textAlign: 'center', fontSize: ptNaMm(7), fill: M(m).linia, nazwa: 'Napis LOGO' }, m),
        tekst('{sekcja}', { left: p.x + 22, top: y + 1.2, width: p.w - 22, textAlign: 'right', fontSize: ptNaMm(10), fontWeight: 'bold', fill: M(m).akcent, fontFamily: M(m).fontNaglowek, nazwa: 'Nazwa sekcji' }, m),
        pasek(p.x, yd - 1.5, p.w, 0.25, { fill: M(m).akcent, nazwa: 'Linia stopki' }),
        tekst('www.twojafirma.pl  ·  tel. 000 000 000', { left: p.x, top: yd, width: p.w * 0.75, fontSize: ptNaMm(7), nazwa: 'Kontakt' }, m),
        tekst('{nr}', { left: p.x + p.w * 0.75, top: yd, width: p.w * 0.25, textAlign: 'right', fontSize: ptNaMm(8), fontWeight: 'bold', nazwa: 'Numer strony' }, m)];
    },
  },
  {
    klucz: 'oferta-pas-boczny', grupa: 'Katalog i oferta', nazwa: 'Oferta z pasem bocznym', opis: 'Kolorowy pas wzdłuż wewnętrznej krawędzi z pionową nazwą sekcji.', lustro: true, slowa: 'oferta katalog pas bok pionowy',
    obiekty: (w, m) => {
      const s = Math.max(6, w.marginesy.wewnetrzny - 6);
      return [pasek(-w.spad_mm, -w.spad_mm, s + w.spad_mm, w.wysokosc_mm + 2 * w.spad_mm, { fill: M(m).akcent, nazwa: 'Pas boczny', bez_ostrzezen: true }),
        tekst('{sekcja}', { left: s / 2, top: w.wysokosc_mm / 2, originX: 'center', originY: 'center', width: w.wysokosc_mm * 0.6, angle: -90, textAlign: 'center', fontSize: ptNaMm(9), charSpacing: 200, fill: '#ffffff', fontWeight: 'bold', wielkosc_liter: 'wielkie', nazwa: 'Nazwa sekcji' }, m)];
    },
  },
  // ---------- Gazetka ----------
  {
    klucz: 'gazetka', grupa: 'Gazetka', nazwa: 'Gazetka: winieta', opis: 'Gruba i cienka linia na górze z nazwą i datą, numer strony na dole.', slowa: 'gazetka gazeta parafialna szkolna winieta',
    obiekty: (w, m) => {
      const p = pole(w); const y = Math.max(2, w.marginesy.gora - 8);
      return [tekst('{projekt}', { left: p.x, top: y, width: p.w * 0.6, fontSize: ptNaMm(9), fontWeight: 'bold', fontFamily: M(m).fontNaglowek, nazwa: 'Nazwa gazetki' }, m),
        tekst('{data}', { left: p.x + p.w * 0.6, top: y + 0.6, width: p.w * 0.4, textAlign: 'right', fontSize: ptNaMm(7.5), nazwa: 'Data' }, m),
        pasek(p.x, y + 5, p.w, 0.8, { fill: M(m).tekst, nazwa: 'Gruba linia' }), pasek(p.x, y + 6.4, p.w, 0.2, { fill: M(m).tekst, nazwa: 'Cienka linia' }),
        tekst('– {nr} –', { left: p.x, top: yDol(w), width: p.w, textAlign: 'center', fontSize: ptNaMm(8), nazwa: 'Numer strony' }, m)];
    },
  },
  {
    klucz: 'gazetka-kolumny', grupa: 'Gazetka', nazwa: 'Gazetka: linie między kolumnami', opis: 'Cienkie pionowe linie dzielące pole na 3 szpalty.', slowa: 'gazetka kolumny szpalty linie',
    obiekty: (w, m) => { const p = pole(w); const k = p.w / 3; return [sciezka('Linie szpalt', [[p.x + k, p.y, p.x + k, p.y + p.h], [p.x + 2 * k, p.y, p.x + 2 * k, p.y + p.h]], { stroke: M(m).linia, strokeWidth: 0.2 })]; },
  },
  // ---------- Zaproszenie ----------
  {
    klucz: 'zaproszenie', grupa: 'Zaproszenie', nazwa: 'Zaproszenie: ozdobna ramka', opis: 'Podwójna cienka ramka z rombami w narożnikach.', slowa: 'zaproszenie slub komunia chrzest ramka elegancka',
    obiekty: (w, m) => {
      const b = Math.min(w.marginesy.gora, w.marginesy.zewnetrzny) / 2; const W = w.szerokosc_mm; const H = w.wysokosc_mm; const k = M(m).akcent2; const r = 1.6;
      const romb = (x, y) => ({ type: 'rect', version: '5.3.0', id: uid('o'), left: x, top: y, originX: 'center', originY: 'center', width: r * 2, height: r * 2, angle: 45, fill: k, strokeWidth: 0, nazwa: 'Romb' });
      return [obrys(b, b, W - 2 * b - 0.4, H - 2 * b - 0.4, { stroke: k, strokeWidth: 0.4, nazwa: 'Ramka zewnętrzna' }),
        obrys(b + 2, b + 2, W - 2 * b - 4.2, H - 2 * b - 4.2, { stroke: k, strokeWidth: 0.2, nazwa: 'Ramka wewnętrzna' }),
        romb(b, b), romb(W - b, b), romb(b, H - b), romb(W - b, H - b)];
    },
  },
  {
    klucz: 'zaproszenie-pasy', grupa: 'Zaproszenie', nazwa: 'Zaproszenie: pasy u góry i u dołu', opis: 'Dwa pasy w kolorach marki przy górnej i dolnej krawędzi (ze spadem).', slowa: 'zaproszenie pasy kolor elegancko',
    obiekty: (w, m) => {
      const b = w.spad_mm; const W = w.szerokosc_mm; const H = w.wysokosc_mm; const h = Math.max(6, w.marginesy.gora * 0.5);
      return [pasek(-b, -b, W + 2 * b, h + b, { fill: M(m).akcent, nazwa: 'Pas górny', bez_ostrzezen: true }), pasek(-b, h, W + 2 * b, 1, { fill: M(m).akcent2, nazwa: 'Linia górna', bez_ostrzezen: true }),
        pasek(-b, H - h - 1, W + 2 * b, 1, { fill: M(m).akcent2, nazwa: 'Linia dolna', bez_ostrzezen: true }), pasek(-b, H - h, W + 2 * b, h + b, { fill: M(m).akcent, nazwa: 'Pas dolny', bez_ostrzezen: true })];
    },
  },
];

// Kolory i czcionki do wzorców z zestawu marki (#131D): pierwszy kolor – akcent, drugi – drugi akcent,
// czcionki nagłówków i tekstu. Bez marki – wartości domyślne.
export function markaDoWzorcow(marka) {
  const k = (marka?.kolory || []).map((x) => x.kolor).filter(Boolean);
  const akcent = k[0] || MARKA_DOMYSLNA.akcent;
  const rozjasnij = (hex, t) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
    return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };
  return {
    ...MARKA_DOMYSLNA,
    akcent,
    akcent2: k[1] || MARKA_DOMYSLNA.akcent2,
    jasny: rozjasnij(akcent, 0.9),
    fontTekst: marka?.czcionki?.tekst || MARKA_DOMYSLNA.fontTekst,
    fontNaglowek: marka?.czcionki?.naglowek || marka?.czcionki?.tekst || MARKA_DOMYSLNA.fontNaglowek,
  };
}

// Zbudowany wzorzec do dodania do projektu: { obiekty, tlo, lustro }.
export function zbudujWzorzecStandardowy(def, wydruk, marka) {
  const m = M(marka);
  return { obiekty: def.obiekty(wydruk, m), tlo: def.tlo ? def.tlo(wydruk, m) : null, lustro: Boolean(def.lustro) };
}

// Schematyczny podgląd SVG (#164 – okno „Wzorce stron” i Biblioteka): miniatura całej strony jest za mała,
// żeby rozpoznać numer albo stopkę, więc elementy wzorca są tu pogrubione (teksty jako wyraźne paski w kolorze
// marki), a treść strony to blade bloki w polu tekstu – widać, co jest wzorcem, a co treścią. Wymiary w mm.
export function podgladSvgWzorca(def, wydruk = { szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, marginesy: { gora: 15, dol: 15, wewnetrzny: 15, zewnetrzny: 15 } }, marka) {
  const m = M(marka);
  const { obiekty, tlo } = zbudujWzorzecStandardowy(def, wydruk, m);
  const W = wydruk.szerokosc_mm; const H = wydruk.wysokosc_mm;
  const f = (v) => Math.round(v * 10) / 10;
  const k = Math.min(W, H) / 148; // grubości liczone dla A5 – większy format, proporcjonalnie grubsze
  const rysuj = (o, dx = 0, dy = 0) => {
    const op = o.opacity != null ? ` opacity="${Math.max(o.opacity, 0.18)}"` : '';
    if (o.type === 'group') return o.objects.map((d) => rysuj(d, dx + o.left + o.width / 2, dy + o.top + o.height / 2)).join('');
    if (o.type === 'rect') {
      const st = o.stroke ? `fill:none;stroke:${o.stroke};stroke-width:${f(Math.max(1.2 * k, (o.strokeWidth || 0.3) * 2.5))}` : `fill:${o.fill || 'none'};stroke:none`;
      const x = o.originX === 'center' ? o.left - o.width / 2 : o.left; const y = o.originY === 'center' ? o.top - o.height / 2 : o.top;
      const rot = o.angle ? ` transform="rotate(${o.angle} ${f(dx + o.left)} ${f(dy + o.top)})"` : '';
      const wys = o.stroke ? o.height : Math.max(o.height, o.width > o.height * 8 ? 1.1 * k : o.height); // cienkie linie – grubiej
      const szer = o.stroke ? o.width : Math.max(o.width, o.height > o.width * 8 ? 1.1 * k : o.width);
      return `<rect x="${f(dx + x)}" y="${f(dy + y)}" width="${f(szer)}" height="${f(wys)}" rx="${o.rx || 0}" style="${st}"${op}${rot}/>`;
    }
    if (o.type === 'ellipse') return `<circle cx="${f(dx + o.left + o.rx)}" cy="${f(dy + o.top + o.ry)}" r="${f(Math.max(o.rx, 4 * k))}" style="fill:${o.fill};stroke:none"${op}/>`;
    if (o.type === 'path') {
      const d = o.path.map((x) => `${x[0]}${f(x[1])} ${f(x[2])}`).join('');
      const kropki = o.strokeDashArray?.[0] === 0;
      return `<path d="${d}" style="fill:none;stroke:${o.stroke};stroke-width:${f(kropki ? 1.8 * k : Math.max(0.9 * k, o.strokeWidth * 4))};${kropki ? 'stroke-dasharray:0 5;stroke-linecap:round' : 'stroke-linecap:square'}"${op}/>`;
    }
    if (o.type === 'textbox') {
      const wys = Math.max(5 * k, (o.fontSize || 3) * 1.1);
      const znaki = String(o.text).replace(/\{[^}]*\}/g, 'xxx').length;
      const dl = Math.min(o.width, Math.max(12 * k, znaki * wys * 0.42));
      const x0 = o.originX === 'center' ? o.left - dl / 2 : o.textAlign === 'center' ? o.left + (o.width - dl) / 2 : o.textAlign === 'right' ? o.left + o.width - dl : o.left;
      const y0 = o.originY === 'center' ? o.top - wys / 2 : o.top + (o.fontSize || 3) / 2 - wys / 2 + 0.4;
      const kolor = /^#?f{3,6}$/i.test(String(o.fill).replace('#', '')) ? '#ffffff' : (o.fill === MARKA_DOMYSLNA.tekst ? m.akcent : o.fill);
      const rot = o.angle ? ` transform="rotate(${o.angle} ${f(o.left)} ${f(o.top)})"` : '';
      return `<rect x="${f(dx + x0)}" y="${f(dy + y0)}" width="${f(dl)}" height="${f(wys)}" rx="${f(wys / 2)}" style="fill:${kolor};stroke:none"${op}${rot}/>`;
    }
    return '';
  };
  // Treść strony: tytuł i kilka akapitów w polu tekstu – blado, żeby wzorzec było widać.
  const p = pole(wydruk);
  const tresc = [`<rect x="${f(p.x + 4)}" y="${f(p.y + 6)}" width="${f(p.w * 0.55)}" height="${f(7 * k)}" rx="${f(2 * k)}"/>`];
  for (let y = p.y + 22 * k, n = 0; y < p.y + p.h - 10 * k && n < 7; y += 16 * k, n += 1) tresc.push(`<rect x="${f(p.x + 4)}" y="${f(y)}" width="${f(p.w - 8)}" height="${f(9 * k)}" rx="${f(2 * k)}"/>`);
  const pod = obiekty.filter((o) => o.warstwa !== 'nad').map((o) => rysuj(o)).join('');
  const nad = obiekty.filter((o) => o.warstwa === 'nad').map((o) => rysuj(o)).join('');
  return `<svg viewBox="-2 -2 ${W + 4} ${H + 4}" aria-hidden="true" class="podglad-wzorca"><defs><clipPath id="sw-${def.klucz}"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>`
    + `<rect x="0" y="0" width="${W}" height="${H}" style="fill:${tlo || '#ffffff'};stroke:#c9c5ba;stroke-width:${f(0.8 * k)}"/>`
    + `<g clip-path="url(#sw-${def.klucz})">${pod}<g style="fill:#8a867c;stroke:none" opacity="0.16">${tresc.join('')}</g>${nad}</g></svg>`;
}
