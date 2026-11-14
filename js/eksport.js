// Eksport do druku: PNG jednej strony i PDF całego projektu.
//
// PDF składa się ze stron w kolejności wydruku, razem z powieleniami serii.
// Plik niesie informacje dla drukarni: format po obcięciu (TrimBox), obszar ze
// spadem (BleedBox) i znaki cięcia. Są dwa rodzaje pliku:
//  – wektorowy (domyślny): tekst pisany osadzonymi czcionkami, kształty jako
//    wektory, zdjęcia w oryginalnej rozdzielczości (js/pdf-wektorowy.js);
//  – obrazy stron: każda strona jest jednym obrazem w wybranej rozdzielczości.
// Kolory są w RGB; w pliku wektorowym tekst i kształty mogą iść w CMYK.
// Standard dla drukarni (PDF/X-4, js/pdf-x.js): plik niesie profil barwny warunków druku, a kolory
// i zdjęcia można przeliczyć na CMYK przez ten profil (js/profil-icc.js).

import { renderujCel, zlozCel, naPlotnieCelu } from './zlozenie.js';
import { obrazStronyCmyk } from './strona-cmyk.js';
import { rysujStroneWektorowo, CzcionkiPdf, ObrazyPdf, poprawOpisCzcionekOtf } from './pdf-wektorowy.js';
import { wczytajWarunki, dodajPdfX, naglowekPdfX } from './pdf-x.js';
import { rozwin } from './serie.js';
import { biblioteka } from './biblioteki.js';
import { bezpiecznaNazwa } from './ui.js';
import { uzyteCzcionki, CZCIONKI } from './czcionki.js';

const PDFLIB_URL = 'js/zewnetrzne/pdf-lib-1.17.1.min.js';
const JSZIP_URL = 'js/zewnetrzne/jszip-3.10.1.min.js';
const FONTKIT_URL = 'js/zewnetrzne/fontkit-1.1.1.umd.min.js';

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

function rysujZnaki(strona, PDFLib, { w, h, pas, odstep }, czarnaFarba = false) {
  const czarny = czarnaFarba ? PDFLib.cmyk(0, 0, 0, 1) : PDFLib.rgb(0, 0, 0);
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

// Składa jeden plik PDF z podanych egzemplarzy. opcje: tryb ('wektor' | 'obraz'), dpi (strony
// w trybie obrazów; w wektorowym – elementy, których nie da się zapisać wektorowo), spad (czy dodać
// spad), znaki ('sekcje' – według ustawień sekcji, true, false), jakosc JPEG (obrazy stron; 1 w CMYK = bez strat), cmyk i krzywe (tylko
// wektorowy), uwagi (Map: powód → ile elementów trafiło do pliku jako obraz), jakoKrzywe (Map: czcionka →
// w ilu elementach tekst zapisano jako krzywe, bo czcionki nie da się osadzić), ciag, postep(nrStrony),
// przerwij() → true, gdy użytkownik anulował.
//
// Standard dla drukarni: pdfx ('fogra39' | 'fogra47' | 'wlasny' + profilWlasny { nazwa, bajty }) daje plik
// PDF/X-4 z profilem warunków druku; wtedy cmyk przelicza tekst i kształty przez ten profil, a zdjeciaCmyk –
// także zdjęcia. W trybie obrazów zdjeciaCmyk przelicza przez profil cały obraz strony (js/strona-cmyk.js).
// `druk` to wczytane już warunki (wczytajWarunki), żeby przy kilku plikach nie czytać profilu za każdym razem.
export async function zlozPdf(projekt, egzemplarze, { tryb = 'wektor', dpi = 300, spad = true, znaki = 'sekcje', jakosc = 0.92, cmyk = false, krzywe = false, pdfx = '', profilWlasny = null, zdjeciaCmyk = false, druk = null, uwagi = new Map(), jakoKrzywe = new Map(), ligatury = { ile: 0 }, ciag = rozwin(projekt), postep, przerwij } = {}) {
  const PDFLib = await biblioteka(PDFLIB_URL, 'PDFLib', 'modułu PDF');
  const warunki = druk || (pdfx ? await wczytajWarunki(pdfx, profilWlasny) : null);
  const wektor = tryb === 'wektor';
  const silnik = warunki && wektor && (cmyk || zdjeciaCmyk) ? warunki.silnik() : null;
  const silnikStron = warunki && !wektor && zdjeciaCmyk ? warunki.silnik() : null;
  const pdf = await PDFLib.PDFDocument.create();
  pdf.setTitle(projekt.nazwa);
  pdf.setCreator('Makietka');
  pdf.setProducer('Makietka (pdf-lib)');
  let srodowisko = null;
  if (tryb === 'wektor') {
    const fontkit = await biblioteka(FONTKIT_URL, 'fontkit', 'modułu czcionek PDF');
    pdf.registerFontkit(fontkit);
    srodowisko = { PDFLib, pdf, czcionki: new CzcionkiPdf(pdf, projekt, fontkit, { krzywe }), obrazy: new ObrazyPdf(pdf, { silnik: zdjeciaCmyk ? silnik : null }), cmyk, silnik: cmyk ? silnik : null, krzywe, dpi, uwagi, jakoKrzywe, ligatury, uzyteCzcionki: new Set() };
  }
  let nr = 0;
  for (const egz of egzemplarze) {
    if (przerwij?.()) throw new Przerwano();
    const { wydruk } = egz.sekcja;
    const zeZnakami = znaki === 'sekcje' ? Boolean(wydruk.znaki_ciecia) : Boolean(znaki);
    const m = wymiaryStronyPdf(wydruk, { spad, znaki: zeZnakami });
    const szer = (m.w + 2 * m.pas) * PT;
    const wys = (m.h + 2 * m.pas) * PT;
    let strona;
    if (srodowisko) {
      const { tlo, obiekty } = await zlozCel(projekt, egz, { ciag, oryginaly: true });
      strona = pdf.addPage([szer, wys]);
      await rysujStroneWektorowo(srodowisko, strona, { obiekty, tlo, m });
    } else if (silnikStron) {
      // Obraz strony w CMYK przez profil; czerń i szarości poza zdjęciami samą czarną farbą.
      // Zdjęcia idą pod spodem jako JPEG w czterech farbach, reszta strony na wierzchu bez strat (js/strona-cmyk.js).
      const obraz = await naPlotnieCelu(projekt, egz, { szerokoscPx: pikseli(m.w + 2 * m.spad, dpi), spad, ciag, oryginaly: true },
        (plotno, obiekty) => obrazStronyCmyk(pdf, silnikStron, plotno, obiekty, { jakosc }));
      strona = pdf.addPage([szer, wys]);
      const poleSzer = (m.w + 2 * m.spad) * PT; const poleWys = (m.h + 2 * m.spad) * PT; const odBrzegu = (m.pas - m.spad) * PT;
      const rysuj = (nazwa, x, y, w, h) => {
        strona.pushOperators(PDFLib.pushGraphicsState(), PDFLib.concatTransformationMatrix(w, 0, 0, h, x, y), PDFLib.drawObject(nazwa), PDFLib.popGraphicsState());
      };
      obraz.zdjecia.forEach((z, i) => {
        strona.node.setXObject(PDFLib.PDFName.of(`Zdjecia${i + 1}`), z.obraz);
        // Piksele strony liczą się od góry, punkty PDF od dołu.
        rysuj(`Zdjecia${i + 1}`, odBrzegu + (z.x / obraz.w) * poleSzer, odBrzegu + ((obraz.h - z.y - z.h) / obraz.h) * poleWys, (z.w / obraz.w) * poleSzer, (z.h / obraz.h) * poleWys);
      });
      strona.node.setXObject(PDFLib.PDFName.of('Strona'), obraz.strona);
      rysuj('Strona', odBrzegu, odBrzegu, poleSzer, poleWys);
    } else {
      const url = await renderujCel(projekt, egz, {
        szerokoscPx: pikseli(m.w + 2 * m.spad, dpi), spad, ciag, format: 'jpeg', jakosc, oryginaly: true,
      });
      if (!url.startsWith('data:image/jpeg')) throw new Error('Strona jest za duża na tę rozdzielczość. Wybierz niższą jakość.');
      const obraz = await pdf.embedJpg(url);
      strona = pdf.addPage([szer, wys]);
      strona.drawImage(obraz, { x: (m.pas - m.spad) * PT, y: (m.pas - m.spad) * PT, width: (m.w + 2 * m.spad) * PT, height: (m.h + 2 * m.spad) * PT });
    }
    strona.setTrimBox(m.pas * PT, m.pas * PT, m.w * PT, m.h * PT);
    strona.setBleedBox((m.pas - m.spad) * PT, (m.pas - m.spad) * PT, (m.w + 2 * m.spad) * PT, (m.h + 2 * m.spad) * PT);
    if (zeZnakami) rysujZnaki(strona, PDFLib, m, Boolean(warunki) || (wektor && cmyk));
    nr += 1;
    postep?.(nr);
    await new Promise((ok) => setTimeout(ok)); // oddaj głos przeglądarce – postęp się odmaluje
  }
  // Czcionki wczytane, ale ostatecznie nieużyte (np. tekst poszedł jako obraz), nie trafiają do pliku.
  if (srodowisko) pdf.fonts = pdf.fonts.filter((f) => srodowisko.uzyteCzcionki.has(f));
  if (srodowisko) await poprawOpisCzcionekOtf(PDFLib, pdf);
  if (warunki) await dodajPdfX(PDFLib, pdf, warunki, { tytul: projekt.nazwa });
  const bajty = await pdf.save();
  return new Blob([warunki ? naglowekPdfX(bajty) : bajty], { type: 'application/pdf' });
}

// Pliki jednej rodziny z oficjalnego zestawu czcionek aplikacji: zwykłe pliki TTF, po jednym
// na odmianę – takie, jakie drukarnia albo grafik może zainstalować u siebie.
const ODMIANY_ZESTAWU = [[400, false, 'Regular'], [700, false, 'Bold'], [400, true, 'Italic'], [700, true, 'BoldItalic']];
async function plikiRodzinyZestawu(rodzina) {
  const pliki = [];
  for (const [waga, kursywa, nazwa] of ODMIANY_ZESTAWU) {
    const odp = await fetch(`css/czcionki/pdf/${rodzina.toLowerCase().replace(/\s+/g, '-')}-${waga}-${kursywa ? 'kursywa' : 'prosta'}.ttf`);
    if (odp.ok) pliki.push({ nazwa: `${rodzina.replace(/\s+/g, '')}-${nazwa}.ttf`, blob: await odp.blob() });
  }
  return pliki;
}

async function licencjaZestawu() {
  const licencja = await fetch('css/czcionki/LICENCJA.txt');
  return licencja.ok ? [{ nazwa: 'LICENCJA czcionek Makietki.txt', blob: await licencja.blob() }] : [];
}

// Oficjalny zestaw czcionek aplikacji (albo wybrane rodziny) jako archiwum ZIP: { nazwa, blob }.
export async function zestawCzcionek(rodziny = CZCIONKI.map((c) => c.nazwa)) {
  const JSZip = await biblioteka(JSZIP_URL, 'JSZip', 'modułu ZIP');
  const zip = new JSZip();
  for (const r of rodziny) for (const p of await plikiRodzinyZestawu(r)) zip.file(`${r}/${p.nazwa}`, p.blob, { compression: 'STORE' });
  for (const p of await licencjaZestawu()) zip.file(p.nazwa, p.blob);
  return { nazwa: rodziny.length === 1 ? `Czcionka ${rodziny[0]}.zip` : 'Czcionki Makietki.zip', blob: await zip.generateAsync({ type: 'blob' }) };
}

// Pliki czcionek użytych w tekstach projektu: [{ nazwa, blob }]. Czcionki z oficjalnego zestawu
// idą jako pliki TTF z licencją; własne czcionki projektu – jako wgrane pliki.
export async function plikiCzcionek(projekt) {
  const uzyte = uzyteCzcionki(projekt);
  const pliki = [];
  for (const c of projekt.czcionki || []) {
    const zasob = projekt.zasoby[c.id];
    if (!uzyte.has(c.rodzina) || !zasob?.dataUrl) continue;
    pliki.push({ nazwa: zasob.nazwa, blob: await (await fetch(zasob.dataUrl)).blob() });
  }
  const wlasne = new Set((projekt.czcionki || []).map((c) => c.rodzina));
  const zZestawu = CZCIONKI.map((c) => c.nazwa).filter((n) => uzyte.has(n) && !wlasne.has(n));
  for (const r of zZestawu) pliki.push(...await plikiRodzinyZestawu(r));
  if (zZestawu.length) pliki.push(...await licencjaZestawu());
  return pliki;
}

// Cały eksport: zwraca { nazwa, blob, uwagi, krzywe } – jeden PDF albo ZIP (kilka plików PDF, pliki czcionek).
// uwagi: [[powód, liczba]] – elementy, które w pliku wektorowym zostały zapisane jako obraz.
// krzywe: [[czcionka, liczba]] – elementy, w których tekst zapisano jako krzywe (czcionki nie da się osadzić).
export async function eksportujPdf(projekt, opcje = {}) {
  const uwagi = new Map();
  const jakoKrzywe = new Map();
  const ligatury = { ile: 0 };
  const ciag = rozwin(projekt);
  const pliki = planPlikow(projekt, wybierzEgzemplarze(ciag, opcje), opcje);
  if (!pliki.length) throw new Error('W wybranym zakresie nie ma stron.');
  const razem = pliki.reduce((s, p) => s + p.egzemplarze.length, 0);
  // Profil warunków druku wczytuje się raz na cały eksport.
  const druk = opcje.pdfx ? await wczytajWarunki(opcje.pdfx, opcje.profilWlasny) : null;
  let gotowe = 0;
  const wyniki = [];
  for (const p of pliki) {
    const start = gotowe;
    const blob = await zlozPdf(projekt, p.egzemplarze, { ...opcje, druk, uwagi, jakoKrzywe, ligatury, ciag, postep: (n) => { gotowe = start + n; opcje.postep?.(gotowe, razem); } });
    wyniki.push({ nazwa: p.nazwa, blob });
  }
  const czcionki = opcje.dolaczCzcionki ? await plikiCzcionek(projekt) : [];
  if (wyniki.length === 1 && !czcionki.length) return { ...wyniki[0], uwagi: [...uwagi], krzywe: [...jakoKrzywe], ligatury: ligatury.ile };
  const JSZip = await biblioteka(JSZIP_URL, 'JSZip', 'modułu ZIP');
  const zip = new JSZip();
  for (const w of wyniki) zip.file(w.nazwa, w.blob, { compression: 'STORE' });
  for (const c of czcionki) zip.file(`czcionki/${c.nazwa}`, c.blob, { compression: 'STORE' });
  return { nazwa: `${bezpiecznaNazwa(projekt.nazwa)} - PDF.zip`, blob: await zip.generateAsync({ type: 'blob' }), uwagi: [...uwagi], krzywe: [...jakoKrzywe], ligatury: ligatury.ile };
}
