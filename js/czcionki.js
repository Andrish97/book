/* global fabric */
// Lista dozwolonych czcionek (sekcja 11 planu): tylko licencje pozwalające
// na użycie komercyjne i osadzanie w PDF. Wszystkie poniższe są na licencji
// SIL Open Font License 1.1 i mają polskie znaki (latin-ext).
// Pliki czcionek leżą w css/czcionki/ (pobiera je scripts/pobierz-czcionki.cjs),
// więc aplikacja nie zależy od serwerów Google. Przed dodaniem nowej czcionki
// sprawdź jej licencję i dopisz ją także w tym skrypcie.

export const CZCIONKI = [
  { nazwa: 'Inter', licencja: 'OFL 1.1', rodzaj: 'bezszeryfowa' },
  { nazwa: 'Open Sans', licencja: 'OFL 1.1', rodzaj: 'bezszeryfowa' },
  { nazwa: 'Montserrat', licencja: 'OFL 1.1', rodzaj: 'bezszeryfowa' },
  { nazwa: 'Lora', licencja: 'OFL 1.1', rodzaj: 'szeryfowa' },
  { nazwa: 'Merriweather', licencja: 'OFL 1.1', rodzaj: 'szeryfowa' },
  { nazwa: 'Playfair Display', licencja: 'OFL 1.1', rodzaj: 'szeryfowa' },
  { nazwa: 'Source Serif 4', licencja: 'OFL 1.1', rodzaj: 'szeryfowa' },
  { nazwa: 'Caveat', licencja: 'OFL 1.1', rodzaj: 'odręczna' },
];

export const DOMYSLNA = 'Inter';

// Czeka, aż przeglądarka pobierze wszystkie warianty używane na płótnie.
// Bez tego Fabric zmierzyłby tekst czcionką zastępczą.
export async function zaladujCzcionki() {
  if (!document.fonts) return;
  const warianty = [];
  for (const c of CZCIONKI) {
    for (const styl of ['', 'italic ']) {
      for (const waga of ['400', '700']) {
        warianty.push(document.fonts.load(`${styl}${waga} 16px "${c.nazwa}"`, 'AaĄąŻż'));
      }
    }
  }
  await Promise.allSettled(warianty);
}

// ---------- Własne czcionki projektu (pliki TTF, OTF, WOFF, WOFF2) ----------
//
// Plik czcionki jest zasobem projektu (tak jak obraz), a projekt.czcionki opisuje,
// czym jest: [{ id (zasobu), rodzina, waga (100–900), kursywa }]. Dzięki temu
// czcionka jedzie z projektem na konto i do pliku .seriodruk.

const TYPY_PLIKOW = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
export const ROZSZERZENIA_CZCIONEK = Object.keys(TYPY_PLIKOW);
export const typPlikuCzcionki = (nazwa) => TYPY_PLIKOW[String(nazwa).split('.').pop().toLowerCase()] || null;

const WAGI = [
  [/thin|hairline/i, 100], [/extra[\s_-]*light|ultra[\s_-]*light/i, 200], [/semi[\s_-]*bold|demi[\s_-]*bold/i, 600],
  [/extra[\s_-]*bold|ultra[\s_-]*bold/i, 800], [/black|heavy/i, 900], [/light/i, 300], [/medium/i, 500], [/bold/i, 700], [/regular|normal|book/i, 400],
];
const KURSYWA = /italic|oblique|kursywa/i;

// Rodzina, waga i kursywa z samej nazwy pliku, np. „Lato-BoldItalic.woff2”.
export function czcionkaZNazwyPliku(nazwaPliku) {
  const baza = String(nazwaPliku).replace(/\.[a-z0-9]+$/i, '');
  const waga = WAGI.find(([wzor]) => wzor.test(baza))?.[1] || 400;
  const kursywa = KURSYWA.test(baza);
  let rodzina = baza.replace(new RegExp(KURSYWA.source, 'ig'), '');
  for (const [wzor] of WAGI) rodzina = rodzina.replace(new RegExp(wzor.source, 'ig'), '');
  rodzina = rodzina.replace(/variable|font|\bvf\b|\[.*?\]/ig, '').replace(/[_-]+/g, ' ').replace(/([a-ząćęłńóśźż])([A-ZĄĆĘŁŃÓŚŹŻ])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  return { rodzina: rodzina || baza, waga, kursywa };
}

// Tabele pliku czcionki: Map(znacznik → DataView). Obsługuje TTF/OTF (także pierwszą
// czcionkę z kolekcji TTC) i WOFF; WOFF2 jest spakowany inaczej – zwraca null.
async function tabeleCzcionki(bufor) {
  const d = new DataView(bufor);
  const znak = (o) => String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3));
  if (bufor.byteLength < 12) return null;
  let podpis = znak(0);
  const tabele = new Map();
  if (podpis === 'wOFF') {
    const ile = d.getUint16(12);
    for (let i = 0; i < ile; i += 1) {
      const o = 44 + i * 20;
      const [nazwa, start, spakowane, pelne] = [znak(o), d.getUint32(o + 4), d.getUint32(o + 8), d.getUint32(o + 12)];
      if (nazwa !== 'name' && nazwa !== 'OS/2') continue;
      let bajty = new Uint8Array(bufor, start, spakowane);
      if (spakowane < pelne) {
        const strumien = new Blob([bajty]).stream().pipeThrough(new DecompressionStream('deflate'));
        bajty = new Uint8Array(await new Response(strumien).arrayBuffer());
      }
      tabele.set(nazwa, new DataView(bajty.buffer, bajty.byteOffset, bajty.byteLength));
    }
    return tabele;
  }
  let poczatek = 0;
  if (podpis === 'ttcf') { poczatek = d.getUint32(12); podpis = znak(poczatek); }
  if (!['\u0000\u0001\u0000\u0000', 'OTTO', 'true'].includes(podpis)) return null;
  const ile = d.getUint16(poczatek + 4);
  for (let i = 0; i < ile; i += 1) {
    const o = poczatek + 12 + i * 16;
    const [nazwa, start, dlugosc] = [znak(o), d.getUint32(o + 8), d.getUint32(o + 12)];
    if ((nazwa === 'name' || nazwa === 'OS/2') && start + dlugosc <= bufor.byteLength) tabele.set(nazwa, new DataView(bufor, start, dlugosc));
  }
  return tabele;
}

// Odczytuje z pliku czcionki nazwę rodziny, wagę i kursywę. Gdy pliku nie da się
// przeczytać (np. WOFF2), zgaduje z nazwy pliku.
export async function opisCzcionki(bufor, nazwaPliku) {
  const zNazwy = czcionkaZNazwyPliku(nazwaPliku);
  let tabele = null;
  try { tabele = await tabeleCzcionki(bufor); } catch { tabele = null; }
  if (!tabele?.size) return zNazwy;
  const wynik = { ...zNazwy };
  const n = tabele.get('name');
  if (n && n.byteLength >= 6) {
    const ile = n.getUint16(2);
    const teksty = n.getUint16(4);
    const nazwy = new Map(); // nameID → [ocena, tekst]
    for (let i = 0; i < ile; i += 1) {
      const o = 6 + i * 12;
      if (o + 12 > n.byteLength) break;
      const [platforma, jezyk, id, dlugosc, start] = [n.getUint16(o), n.getUint16(o + 4), n.getUint16(o + 6), n.getUint16(o + 8), n.getUint16(o + 10)];
      if (![1, 2, 16, 17].includes(id) || teksty + start + dlugosc > n.byteLength) continue;
      let tekst = '';
      if (platforma === 1) for (let k = 0; k < dlugosc; k += 1) tekst += String.fromCharCode(n.getUint8(teksty + start + k));
      else for (let k = 0; k + 1 < dlugosc; k += 2) tekst += String.fromCharCode(n.getUint16(teksty + start + k));
      // Najchętniej nazwa „windowsowa” po angielsku, potem dowolna unikodowa, na końcu stara macowa.
      const ocena = platforma === 3 ? (jezyk === 0x409 ? 3 : 2) : (platforma === 0 ? 2 : 1);
      if (tekst.trim() && ocena > (nazwy.get(id)?.[0] || 0)) nazwy.set(id, [ocena, tekst.trim()]);
    }
    const rodzina = nazwy.get(16)?.[1] || nazwy.get(1)?.[1];
    if (rodzina) wynik.rodzina = rodzina;
    const odmiana = nazwy.get(17)?.[1] || nazwy.get(2)?.[1] || '';
    if (KURSYWA.test(odmiana)) wynik.kursywa = true;
  }
  const os2 = tabele.get('OS/2');
  if (os2 && os2.byteLength >= 64) {
    const waga = os2.getUint16(4);
    if (waga >= 1 && waga <= 1000) wynik.waga = Math.min(900, Math.max(100, Math.round(waga / 100) * 100));
    wynik.kursywa = Boolean(os2.getUint16(62) & 1) || wynik.kursywa;
  }
  return wynik;
}

const NAZWY_WAG = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
export const nazwaOdmiany = (c) => `${NAZWY_WAG[c.waga] || c.waga}${c.kursywa ? ' Italic' : ''}`;

// Rodziny do listy czcionek: wbudowane i własne z projektu (bez powtórzeń).
export function rodzinyCzcionek(projekt) {
  const wlasne = [...new Set((projekt?.czcionki || []).map((c) => c.rodzina))].sort((a, b) => a.localeCompare(b, 'pl'));
  return { wlasne, wbudowane: CZCIONKI.map((c) => c.nazwa).filter((n) => !wlasne.includes(n)) };
}

const zarejestrowane = new Map(); // id zasobu → { face, klucz }

// Udostępnia przeglądarce własne czcionki projektu (i wycofuje te, których już w nim nie ma).
// Zwraca listę plików, których nie udało się wczytać.
export async function zarejestrujCzcionkiProjektu(projekt) {
  const bledy = [];
  const obecne = new Map((projekt?.czcionki || []).map((c) => [c.id, c]));
  for (const [id, wpis] of zarejestrowane) {
    const c = obecne.get(id);
    if (!c || wpis.klucz !== `${c.rodzina}|${c.waga}|${c.kursywa}`) { document.fonts.delete(wpis.face); zarejestrowane.delete(id); }
  }
  for (const c of obecne.values()) {
    if (zarejestrowane.has(c.id)) continue;
    const zasob = projekt.zasoby?.[c.id];
    if (!zasob?.dataUrl) continue;
    try {
      const bufor = await (await fetch(zasob.dataUrl)).arrayBuffer();
      const face = new FontFace(c.rodzina, bufor, { weight: String(c.waga), style: c.kursywa ? 'italic' : 'normal' });
      await face.load();
      document.fonts.add(face);
      zarejestrowane.set(c.id, { face, klucz: `${c.rodzina}|${c.waga}|${c.kursywa}` });
      if (typeof fabric !== 'undefined') fabric.util.clearFabricFontCache(c.rodzina);
    } catch {
      bledy.push(zasob.nazwa || c.rodzina);
    }
  }
  return bledy;
}

// Dodaje pliki czcionek do projektu. Zwraca { dodane: [wpisy], odrzucone: [nazwy plików] }.
export async function dodajCzcionkiDoProjektu(projekt, pliki, uid) {
  const dodane = [];
  const odrzucone = [];
  projekt.czcionki = projekt.czcionki || [];
  for (const plik of pliki) {
    const typ = typPlikuCzcionki(plik.name);
    if (!typ) { odrzucone.push(plik.name); continue; }
    const bufor = await plik.arrayBuffer();
    const opis = await opisCzcionki(bufor, plik.name);
    // Sprawdzenie, czy przeglądarka w ogóle umie wczytać ten plik.
    try { await new FontFace('seriodruk-proba', bufor.slice(0)).load(); } catch { odrzucone.push(plik.name); continue; }
    const dataUrl = await new Promise((ok, blad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => blad(r.error); r.readAsDataURL(new Blob([bufor], { type: typ })); });
    // Ta sama odmiana tej samej rodziny wgrana drugi raz zastępuje poprzednią.
    const stara = projekt.czcionki.find((c) => c.rodzina === opis.rodzina && c.waga === opis.waga && c.kursywa === opis.kursywa);
    if (stara) { delete projekt.zasoby[stara.id]; projekt.czcionki = projekt.czcionki.filter((c) => c !== stara); }
    const id = uid('cz');
    projekt.zasoby[id] = { nazwa: plik.name, dataUrl };
    const wpis = { id, ...opis };
    projekt.czcionki.push(wpis);
    dodane.push(wpis);
  }
  await zarejestrujCzcionkiProjektu(projekt);
  return { dodane, odrzucone };
}

// Rodziny czcionek użyte w tekstach projektu (także w formatowaniu fragmentów i stylach tekstu).
export function uzyteCzcionki(projekt) {
  const rodziny = new Set();
  const zbierz = (obiekty) => {
    for (const o of obiekty || []) {
      if (typeof o.text === 'string') {
        if (o.fontFamily) rodziny.add(o.fontFamily);
        for (const s of Array.isArray(o.styles) ? o.styles : []) if (s.style?.fontFamily) rodziny.add(s.style.fontFamily);
      }
      if (Array.isArray(o.objects)) zbierz(o.objects);
    }
  };
  for (const s of projekt.strony) zbierz(s.obiekty);
  for (const w of projekt.wzorce) zbierz(w.obiekty);
  return rodziny;
}
