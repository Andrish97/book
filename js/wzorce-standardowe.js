// Wzorce standardowe: gotowe szablony wspólnych elementów stron. Każdy buduje się
// z formatu i marginesów sekcji, więc pasuje do A5 tak samo jak do kwadratu.
// Po dodaniu do projektu to zwykły wzorzec – można go zmieniać jak własny.

import { uid, ptNaMm } from './projekt.js';

const tekst = (text, o) => ({
  type: 'textbox', version: '5.3.0', id: uid('o'), text, styles: [], fontFamily: 'Inter', fontSize: ptNaMm(9), fill: '#4a4843',
  lineHeight: 1.2, textAlign: 'left', strokeWidth: 0, ...o,
});
const pasek = (left, top, width, height, o = {}) => ({ type: 'rect', version: '5.3.0', id: uid('o'), left, top, width, height, fill: '#b9b5aa', strokeWidth: 0, ...o });

// Pole między marginesami: { x, y, w, h } – dla strony prawej (zewnętrzny margines po prawej).
function pole(wydruk) {
  const m = wydruk.marginesy;
  return { x: m.wewnetrzny, y: m.gora, w: wydruk.szerokosc_mm - m.wewnetrzny - m.zewnetrzny, h: wydruk.wysokosc_mm - m.gora - m.dol };
}

export const WZORCE_STANDARDOWE = [
  {
    klucz: 'numer-dol', nazwa: 'Numer strony na dole', opis: 'Numer na środku dolnego marginesu.',
    obiekty: (w) => { const p = pole(w); return [tekst('{nr}', { left: p.x, top: w.wysokosc_mm - w.marginesy.dol + 2, width: p.w, textAlign: 'center', nazwa: 'Numer strony' })]; },
  },
  {
    klucz: 'numer-zewnatrz', nazwa: 'Numer strony przy zewnętrznej krawędzi', opis: 'W rozkładówkach numer zawsze stoi po zewnętrznej stronie.', lustro: true,
    obiekty: (w) => { const p = pole(w); return [tekst('{nr}', { left: p.x, top: w.wysokosc_mm - w.marginesy.dol + 2, width: p.w, textAlign: 'right', nazwa: 'Numer strony' })]; },
  },
  {
    klucz: 'stopka', nazwa: 'Stopka: nazwa projektu i numer', opis: 'Cienka linia, nazwa projektu z lewej, „str. 5 z 120” z prawej.',
    obiekty: (w) => {
      const p = pole(w); const y = w.wysokosc_mm - w.marginesy.dol + 1.5;
      return [
        pasek(p.x, y, p.w, 0.25, { nazwa: 'Linia stopki' }),
        tekst('{projekt}', { left: p.x, top: y + 1.5, width: p.w / 2, fontSize: ptNaMm(8), nazwa: 'Nazwa projektu' }),
        tekst('str. {nr} z {liczba_stron}', { left: p.x + p.w / 2, top: y + 1.5, width: p.w / 2, fontSize: ptNaMm(8), textAlign: 'right', nazwa: 'Numer strony' }),
      ];
    },
  },
  {
    klucz: 'naglowek', nazwa: 'Nagłówek: nazwa sekcji', opis: 'Nazwa sekcji nad górnym marginesem, z linią pod spodem.',
    obiekty: (w) => {
      const p = pole(w); const y = Math.max(2, w.marginesy.gora - 6);
      return [
        tekst('{sekcja}', { left: p.x, top: y, width: p.w, fontSize: ptNaMm(8), charSpacing: 80, wielkosc_liter: 'wielkie', nazwa: 'Nazwa sekcji' }),
        pasek(p.x, y + 4.2, p.w, 0.25, { nazwa: 'Linia nagłówka' }),
      ];
    },
  },
  {
    klucz: 'linie', nazwa: 'Linie do pisania', opis: 'Poziome linie co 8 mm w polu między marginesami.',
    obiekty: (w) => {
      const p = pole(w); const linie = [];
      for (let y = p.y + 8; y <= p.y + p.h + 0.01; y += 8) linie.push(pasek(p.x, y, p.w, 0.2, { fill: '#d5d1c6' }));
      return [{ type: 'group', version: '5.3.0', id: uid('o'), nazwa: 'Linie do pisania', left: p.x, top: p.y + 8, width: p.w, height: linie.at(-1).top - (p.y + 8) + 0.2, objects: linie.map((l) => ({ ...l, left: l.left - p.x - p.w / 2, top: l.top - (p.y + 8) - (linie.at(-1).top - (p.y + 8) + 0.2) / 2 })) }];
    },
  },
  {
    klucz: 'kratka', nazwa: 'Kratka 5 mm', opis: 'Siatka pionowych i poziomych linii w polu między marginesami.',
    obiekty: (w) => {
      const p = pole(w); const kol = Math.floor(p.w / 5); const wier = Math.floor(p.h / 5);
      const szer = kol * 5; const wys = wier * 5; const linie = [];
      for (let i = 0; i <= kol; i += 1) linie.push(pasek(i * 5 - szer / 2, -wys / 2, 0.15, wys + 0.15, { fill: '#d5d1c6' }));
      for (let i = 0; i <= wier; i += 1) linie.push(pasek(-szer / 2, i * 5 - wys / 2, szer + 0.15, 0.15, { fill: '#d5d1c6' }));
      return [{ type: 'group', version: '5.3.0', id: uid('o'), nazwa: 'Kratka', left: p.x + (p.w - szer) / 2, top: p.y + (p.h - wys) / 2, width: szer + 0.15, height: wys + 0.15, objects: linie.map((l) => ({ ...l, left: l.left - 0.075, top: l.top - 0.075 })) }];
    },
  },
  {
    klucz: 'ramka', nazwa: 'Ramka w marginesach', opis: 'Cienka ramka wokół pola tekstu, nad treścią strony.',
    obiekty: (w) => { const p = pole(w); return [{ type: 'rect', version: '5.3.0', id: uid('o'), nazwa: 'Ramka', left: p.x, top: p.y, width: p.w - 0.3, height: p.h - 0.3, fill: '', stroke: '#4a4843', strokeWidth: 0.3, strokeUniform: true, warstwa: 'nad' }]; },
  },
  {
    klucz: 'zakladka', nazwa: 'Zakładka na brzegu', opis: 'Kolorowa zakładka przy zewnętrznej krawędzi; na powielonych stronach serii przesuwa się w dół (6 pozycji).', lustro: true,
    obiekty: (w) => {
      const wys = Math.min(30, (w.wysokosc_mm - 2 * w.marginesy.gora) / 6);
      return [{
        type: 'rect', version: '5.3.0', id: uid('o'), nazwa: 'Zakładka', left: w.szerokosc_mm - 8, top: w.marginesy.gora, width: 8 + w.spad_mm, height: wys, fill: '#2f5bd3', strokeWidth: 0, bez_ostrzezen: true,
        z_danych: { y: { pole: 'egzemplarz', tryb: 'pozycja', krok: Math.round(wys * 10) / 10, co: 6 } },
      }];
    },
  },
];
