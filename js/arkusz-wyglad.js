// Wygląd komórek z pliku Excela (.xlsx, .xlsm): pogrubienie, kursywa i kolor liter.
//
// Biblioteka arkuszy czyta same wartości, więc wygląd odczytujemy osobno, prosto z pliku: to archiwum ZIP
// z plikami XML (style w xl/styles.xml, arkusze w xl/worksheets/, teksty wspólne w xl/sharedStrings.xml).
// Wynik: nazwa arkusza → Map „wiersz,kolumna” (od 0) → { pogrubienie?, kursywa?, kolor? }.
//
// Gdy tekst komórki jest sformatowany kawałkami i wszystkie kawałki wyglądają tak samo, to jest to wygląd komórki.
// Kawałki o różnym wyglądzie (np. jedno słowo pogrubione) dają części: { czesci: [{ od, do, …wygląd }] } – zakresy
// znaków tekstu komórki. Kawałek bez własnego opisu czcionki ma wygląd komórki.

import { biblioteka } from './biblioteki.js';
import { naHsl, zHsl } from './pola.js';

const JSZIP_URL = 'js/zewnetrzne/jszip-3.10.1.min.js';

const dzieci = (el, nazwa) => (el ? [...el.children].filter((d) => d.localName === nazwa) : []);
const pierwsze = (el, nazwa) => dzieci(el, nazwa)[0] || null;
const wszystkie = (dok, nazwa) => [...dok.getElementsByTagNameNS('*', nazwa)];
const hex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// Kolor motywu rozjaśniony albo przyciemniony tak, jak robi to Excel (tint od −1 do 1).
function zOdcieniem(kolor, tint) {
  if (!tint) return kolor;
  const [h, s, l] = naHsl([1, 3, 5].map((i) => parseInt(kolor.slice(i, i + 2), 16)));
  return hex(zHsl([h, s, tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint]));
}

// <color rgb="FFRRGGBB"> albo <color theme="4" tint="-0.25"> → '#rrggbb' albo null (kolor automatyczny, nieznany).
function kolor(el, motyw) {
  if (!el) return null;
  const rgb = el.getAttribute('rgb');
  if (rgb && /^[0-9a-f]{6,8}$/i.test(rgb)) return `#${rgb.slice(-6).toLowerCase()}`;
  const nr = el.getAttribute('theme');
  if (nr !== null && motyw[Number(nr)]) return zOdcieniem(motyw[Number(nr)], Number(el.getAttribute('tint')) || 0);
  return null;
}

// <font> ze stylów albo <rPr> kawałka tekstu → wygląd albo null (zwykły, czarny tekst).
function wygladCzcionki(el, motyw) {
  if (!el) return null;
  const wlaczone = (nazwa) => { const d = pierwsze(el, nazwa); return Boolean(d) && !['0', 'false'].includes(d.getAttribute('val')); };
  const k = kolor(pierwsze(el, 'color'), motyw);
  const w = {};
  if (wlaczone('b')) w.pogrubienie = true;
  if (wlaczone('i')) w.kursywa = true;
  if (k && k !== '#000000') w.kolor = k;
  return Object.keys(w).length ? w : null;
}

// Tekst z kawałkami (<si> albo <is>) → lista kawałków { dl, wyglad, wlasny } albo undefined, gdy tekstu nie
// podzielono na kawałki. `wlasny` – kawałek ma własny opis czcionki (bez niego ma wygląd komórki).
function kawalkiTekstu(el, motyw) {
  const kawalki = dzieci(el, 'r');
  if (!kawalki.length) return undefined;
  return kawalki.map((r) => {
    const rPr = pierwsze(r, 'rPr');
    return { dl: (pierwsze(r, 't')?.textContent || '').length, pusty: !(pierwsze(r, 't')?.textContent || '').trim(), wyglad: wygladCzcionki(rPr, motyw), wlasny: Boolean(rPr) };
  });
}

// Wygląd komórki z kawałkami tekstu: wspólny wygląd (gdy wszystkie kawałki z treścią wyglądają tak samo) albo części.
function wygladZKawalkow(kawalki, stylKomorki) {
  const pelne = kawalki.map((k) => ({ ...k, wyglad: k.wlasny ? k.wyglad : stylKomorki }));
  const zTrescia = pelne.filter((k) => !k.pusty);
  if (!zTrescia.length) return stylKomorki;
  const klucze = zTrescia.map((k) => JSON.stringify(k.wyglad));
  if (klucze.every((s) => s === klucze[0])) return zTrescia[0].wyglad;
  const czesci = [];
  let od = 0;
  for (const k of pelne) {
    if (k.wyglad && k.dl) {
      const ostatnia = czesci.at(-1);
      if (ostatnia && ostatnia.do === od && JSON.stringify({ ...ostatnia, od: 0, do: 0 }) === JSON.stringify({ od: 0, do: 0, ...k.wyglad })) ostatnia.do += k.dl;
      else czesci.push({ od, do: od + k.dl, ...k.wyglad });
    }
    od += k.dl;
  }
  return czesci.length ? { czesci } : null;
}

// „B12” → [11, 1].
function miejsce(adres) {
  const m = /^([A-Z]+)(\d+)$/.exec(adres || '');
  if (!m) return null;
  let k = 0;
  for (const z of m[1]) k = k * 26 + z.charCodeAt(0) - 64;
  return [Number(m[2]) - 1, k - 1];
}

export async function wygladArkuszy(bufor) {
  const wynik = new Map();
  const JSZip = await biblioteka(JSZIP_URL, 'JSZip', 'modułu ZIP');
  const zip = await JSZip.loadAsync(bufor);
  const xml = async (sciezka) => { const p = zip.file(sciezka); return p ? new DOMParser().parseFromString(await p.async('string'), 'application/xml') : null; };
  const [skoroszyt, powiazania, style, teksty, plikMotywu] = await Promise.all(['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/theme/theme1.xml'].map(xml));
  if (!skoroszyt || !powiazania || !style) return wynik;

  // Kolory motywu w kolejności numerów używanych w stylach: jasny 1, ciemny 1, jasny 2, ciemny 2, akcenty…
  const schemat = plikMotywu ? wszystkie(plikMotywu, 'clrScheme')[0] : null;
  const zMotywu = Object.fromEntries((schemat ? [...schemat.children] : []).map((el) => {
    const k = el.firstElementChild;
    const v = k?.getAttribute('val') && k.localName === 'srgbClr' ? k.getAttribute('val') : k?.getAttribute('lastClr');
    return [el.localName, v && /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : null];
  }));
  const motyw = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map((n) => zMotywu[n] || null);

  const czcionki = dzieci(wszystkie(style, 'fonts')[0], 'font').map((f) => wygladCzcionki(f, motyw));
  const wygladStylu = dzieci(wszystkie(style, 'cellXfs')[0], 'xf').map((xf) => czcionki[Number(xf.getAttribute('fontId')) || 0] || null);
  const kawalkiWspolne = teksty ? wszystkie(teksty, 'si').map((si) => kawalkiTekstu(si, motyw)) : [];
  // Gdy żaden styl ani kawałek tekstu nie ma wyglądu, nie ma czego szukać w arkuszach.
  if (!wygladStylu.some(Boolean) && !kawalkiWspolne.some((k) => k?.some((x) => x.wyglad))) return wynik;

  const cele = new Map(wszystkie(powiazania, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));
  for (const arkusz of wszystkie(skoroszyt, 'sheet')) {
    const id = [...arkusz.attributes].find((a) => a.localName === 'id' && a.name !== 'id')?.value;
    const cel = cele.get(id);
    if (!cel) continue;
    const dok = await xml(cel.startsWith('/') ? cel.slice(1) : `xl/${cel}`);
    if (!dok) continue;
    const komorki = new Map();
    let w = -1;
    for (const wiersz of wszystkie(dok, 'row')) {
      w = wiersz.getAttribute('r') ? Number(wiersz.getAttribute('r')) - 1 : w + 1;
      let k = -1;
      for (const c of dzieci(wiersz, 'c')) {
        const m = miejsce(c.getAttribute('r'));
        k = m ? m[1] : k + 1;
        const typ = c.getAttribute('t');
        // Kawałki tekstu (gdy są) mają pierwszeństwo przed wyglądem komórki; kawałek bez opisu czcionki ma wygląd komórki.
        const stylKomorki = wygladStylu[Number(c.getAttribute('s')) || 0];
        const kawalki = typ === 's' ? kawalkiWspolne[Number(pierwsze(c, 'v')?.textContent)] : (typ === 'inlineStr' ? kawalkiTekstu(pierwsze(c, 'is'), motyw) : undefined);
        const wyglad = kawalki ? wygladZKawalkow(kawalki, stylKomorki) : stylKomorki;
        if (wyglad) komorki.set(`${m ? m[0] : w},${k}`, wyglad);
      }
    }
    if (komorki.size) wynik.set(arkusz.getAttribute('name'), komorki);
  }
  return wynik;
}
