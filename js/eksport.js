// Eksport do druku: PNG jednej strony i PDF całego projektu.
//
// PDF składa się ze stron w kolejności wydruku, razem z powieleniami serii.
// Każda strona jest obrazem w wybranej rozdzielczości (z oryginalnych zdjęć,
// nie z kopii roboczych), a plik niesie informacje dla drukarni: format po
// obcięciu (TrimBox), obszar ze spadem (BleedBox) i znaki cięcia.
// Kolory są w RGB – zamianę na CMYK robi drukarnia.

import { renderujCel } from './zlozenie.js';
import { rozwin } from './serie.js';
import { biblioteka } from './biblioteki.js';
import { bezpiecznaNazwa } from './ui.js';
import { uzyteCzcionki, CZCIONKI } from './czcionki.js';

const PDFLIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

const PT = 72 / 25.4; // punktów PDF w milimetrze
const ZNAK_DLUGOSC = 5; // mm
const ZNAK_ODSTEP_MIN = 2; // mm od krawędzi strony po obcięciu

export const JAKOSCI_PDF = [
  { dpi: 150, opis: '150 dpi – wydruk próbny, mały plik' },
  { dpi: 300, opis: '300 dpi – do drukarni' },
  { dpi: 600, opis: '600 dpi – bardzo ostry tekst, duży plik' },
];

export class Przerwano extends Error {
  constructor() { super('Eksport przerwany.'); }
}

const pikseli = (mm, dpi) => Math.round((mm / 25.4) * dpi);

// PNG strony albo wzorca w zadanej rozdzielczości, ze spadem, z oryginalnych obrazów.
export function pngCelu(projekt, cel, dpi = 300) {
  const wydruk = projekt.wzorce.includes(cel) ? cel.wydruk : projekt.sekcje.find((s) => s.id === cel.sekcja).wydruk;
  return renderujCel(projekt, cel, { szerokoscPx: pikseli(wydruk.szerokosc_mm + 2 * wydruk.spad_mm, dpi), oryginaly: true });
}

// Egzemplarze stron do eksportu. zakres: 'wszystko' | 'sekcja' (opcje.sekcja = id)
// | 'strony' (opcje.od, opcje.do – kolejne numery stron w całym wydruku, od 1).
export function wybierzEgzemplarze(ciag, { zakres = 'wszystko', sekcja, od = 1, do: doStrony } = {}) {
  const wszystkie = ciag.egzemplarze;
  if (zakres === 'sekcja') return wszystkie.filter((e) => e.sekcja.id === sekcja);
  if (zakres === 'strony') {
    const a = Math.max(1, Math.round(od) || 1);
    const b = Math.min(wszystkie.length, Math.round(doStrony) || wszystkie.length);
    return wszystkie.slice(a - 1, Math.max(a, b));
  }
  return wszystkie;
}

// Dzieli egzemplarze na pliki. podzial: 'jeden' | 'sekcje' | 'czesci' (po ileStron).
// Zwraca [{ nazwa, egzemplarze }].
export function planPlikow(projekt, egzemplarze, { podzial = 'jeden', ileStron = 50 } = {}) {
  const podstawa = bezpiecznaNazwa(projekt.nazwa);
  if (!egzemplarze.length) return [];
  if (podzial === 'sekcje') {
    const grupy = new Map();
    for (const e of egzemplarze) grupy.set(e.sekcja, [...(grupy.get(e.sekcja) || []), e]);
    if (grupy.size > 1) {
      return [...grupy].map(([s, lista], i) => ({ nazwa: `${podstawa} - ${i + 1} ${bezpiecznaNazwa(s.nazwa)}.pdf`, egzemplarze: lista }));
    }
  }
  if (podzial === 'czesci') {
    const n = Math.max(1, Math.round(ileStron) || 1);
    if (egzemplarze.length > n) {
      const pliki = [];
      for (let i = 0; i < egzemplarze.length; i += n) {
        const lista = egzemplarze.slice(i, i + n);
        pliki.push({ nazwa: `${podstawa} - część ${pliki.length + 1} (s. ${lista[0].indeks + 1}-${lista.at(-1).indeks + 1}).pdf`, egzemplarze: lista });
      }
      return pliki;
    }
  }
  return [{ nazwa: `${podstawa}.pdf`, egzemplarze }];
}

// Wymiary strony PDF w milimetrach: obcięta strona, spad dookoła i – gdy są
// znaki cięcia – dodatkowy pas na nie.
export function wymiaryStronyPdf(wydruk, { spad = true, znaki = true } = {}) {
  const b = spad ? wydruk.spad_mm : 0;
  const odstep = Math.max(b, ZNAK_ODSTEP_MIN);
  const pas = znaki ? odstep + ZNAK_DLUGOSC + 1 : b;
  return { w: wydruk.szerokosc_mm, h: wydruk.wysokosc_mm, spad: b, pas, odstep, znaki };
}

function rysujZnaki(strona, PDFLib, { w, h, pas, odstep }) {
  const czarny = PDFLib.rgb(0, 0, 0);
  const linia = (x1, y1, x2, y2) => strona.drawLine({ start: { x: x1 * PT, y: y1 * PT }, end: { x: x2 * PT, y: y2 * PT }, thickness: 0.25, color: czarny });
  for (const x of [pas, pas + w]) {
    linia(x, pas - odstep, x, pas - odstep - ZNAK_DLUGOSC);
    linia(x, pas + h + odstep, x, pas + h + odstep + ZNAK_DLUGOSC);
  }
  for (const y of [pas, pas + h]) {
    linia(pas - odstep, y, pas - odstep - ZNAK_DLUGOSC, y);
    linia(pas + w + odstep, y, pas + w + odstep + ZNAK_DLUGOSC, y);
  }
}

// Składa jeden plik PDF z podanych egzemplarzy. opcje: dpi, spad (czy dodać
// spad), znaki ('sekcje' – według ustawień sekcji, true, false), jakosc JPEG,
// ciag, postep(nrStrony), przerwij() → true, gdy użytkownik anulował.
export async function zlozPdf(projekt, egzemplarze, { dpi = 300, spad = true, znaki = 'sekcje', jakosc = 0.92, ciag = rozwin(projekt), postep, przerwij } = {}) {
  const PDFLib = await biblioteka(PDFLIB_URL, 'PDFLib', 'modułu PDF');
  const pdf = await PDFLib.PDFDocument.create();
  pdf.setTitle(projekt.nazwa);
  pdf.setCreator('Seriodruk');
  pdf.setProducer('Seriodruk (pdf-lib)');
  let nr = 0;
  for (const egz of egzemplarze) {
    if (przerwij?.()) throw new Przerwano();
    const { wydruk } = egz.sekcja;
    const zeZnakami = znaki === 'sekcje' ? Boolean(wydruk.znaki_ciecia) : Boolean(znaki);
    const m = wymiaryStronyPdf(wydruk, { spad, znaki: zeZnakami });
    const url = await renderujCel(projekt, egz, {
      szerokoscPx: pikseli(m.w + 2 * m.spad, dpi), spad, ciag, format: 'jpeg', jakosc, oryginaly: true,
    });
    if (!url.startsWith('data:image/jpeg')) throw new Error('Strona jest za duża na tę rozdzielczość. Wybierz niższą jakość.');
    const obraz = await pdf.embedJpg(url);
    const szer = (m.w + 2 * m.pas) * PT;
    const wys = (m.h + 2 * m.pas) * PT;
    const strona = pdf.addPage([szer, wys]);
    strona.drawImage(obraz, { x: (m.pas - m.spad) * PT, y: (m.pas - m.spad) * PT, width: (m.w + 2 * m.spad) * PT, height: (m.h + 2 * m.spad) * PT });
    strona.setTrimBox(m.pas * PT, m.pas * PT, m.w * PT, m.h * PT);
    strona.setBleedBox((m.pas - m.spad) * PT, (m.pas - m.spad) * PT, (m.w + 2 * m.spad) * PT, (m.h + 2 * m.spad) * PT);
    if (zeZnakami) rysujZnaki(strona, PDFLib, m);
    nr += 1;
    postep?.(nr);
    await new Promise((ok) => setTimeout(ok)); // oddaj głos przeglądarce – postęp się odmaluje
  }
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}

// Pliki czcionek użytych w tekstach projektu: [{ nazwa, blob }]. Własne czcionki idą jako
// wgrane pliki; wbudowane – jako pliki WOFF2 z aplikacji, razem z ich licencją.
export async function plikiCzcionek(projekt) {
  const uzyte = uzyteCzcionki(projekt);
  const pliki = [];
  for (const c of projekt.czcionki || []) {
    const zasob = projekt.zasoby[c.id];
    if (!uzyte.has(c.rodzina) || !zasob?.dataUrl) continue;
    pliki.push({ nazwa: zasob.nazwa, blob: await (await fetch(zasob.dataUrl)).blob() });
  }
  const wlasne = new Set((projekt.czcionki || []).map((c) => c.rodzina));
  const wbudowane = CZCIONKI.map((c) => c.nazwa).filter((n) => uzyte.has(n) && !wlasne.has(n));
  if (wbudowane.length) {
    const css = await (await fetch('css/czcionki.css')).text();
    for (const [, rodzina, plik] of css.matchAll(/font-family: "([^"]+)";[^}]*?url\("czcionki\/([^"]+)"\)/g)) {
      if (!wbudowane.includes(rodzina)) continue;
      const odp = await fetch(`css/czcionki/${plik}`);
      if (odp.ok) pliki.push({ nazwa: plik, blob: await odp.blob() });
    }
    const licencja = await fetch('css/czcionki/LICENCJA.txt');
    if (licencja.ok) pliki.push({ nazwa: 'LICENCJA czcionek wbudowanych.txt', blob: await licencja.blob() });
  }
  return pliki;
}

// Cały eksport: zwraca { nazwa, blob } – jeden PDF albo ZIP (kilka plików PDF, pliki czcionek).
export async function eksportujPdf(projekt, opcje = {}) {
  const ciag = rozwin(projekt);
  const pliki = planPlikow(projekt, wybierzEgzemplarze(ciag, opcje), opcje);
  if (!pliki.length) throw new Error('W wybranym zakresie nie ma stron.');
  const razem = pliki.reduce((s, p) => s + p.egzemplarze.length, 0);
  let gotowe = 0;
  const wyniki = [];
  for (const p of pliki) {
    const start = gotowe;
    const blob = await zlozPdf(projekt, p.egzemplarze, { ...opcje, ciag, postep: (n) => { gotowe = start + n; opcje.postep?.(gotowe, razem); } });
    wyniki.push({ nazwa: p.nazwa, blob });
  }
  const czcionki = opcje.dolaczCzcionki ? await plikiCzcionek(projekt) : [];
  if (wyniki.length === 1 && !czcionki.length) return wyniki[0];
  const JSZip = await biblioteka(JSZIP_URL, 'JSZip', 'modułu ZIP');
  const zip = new JSZip();
  for (const w of wyniki) zip.file(w.nazwa, w.blob, { compression: 'STORE' });
  for (const c of czcionki) zip.file(`czcionki/${c.nazwa}`, c.blob, { compression: 'STORE' });
  return { nazwa: `${bezpiecznaNazwa(projekt.nazwa)} - PDF.zip`, blob: await zip.generateAsync({ type: 'blob' }) };
}
