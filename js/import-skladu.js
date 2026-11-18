// Odczyt projektów z programów do składu (#225): InDesign (IDML – także w ZIP-ie z folderem Links, czyli
// „pakiet” InDesigna) i Scribus (.sla – także w ZIP-ie z obrazami obok). Wynik to nowy projekt Makietki:
// strony w kolejności dokumentu (sekcja na każdy kolejny format strony, spad i marginesy z dokumentu),
// ramki tekstowe z formatowaniem fragmentów (czcionka, odmiana, wielkość, kolor, podkreślenie, wyrównanie,
// interlinia) i z wątkami (ramki połączone w InDesignie/Scribusie przelewają tekst także tutaj), prostokąty,
// elipsy, wielokąty, linie i krzywe z kolorami (CMYK przeliczone na RGB), obrazy osadzone w pliku albo leżące
// obok w ZIP-ie – przycięte do ramki. Pola korespondencji seryjnej InDesigna (Data Merge: <<imie>>) stają się
// polami Makietki ({imie}); kolumna z obrazami „@zdjecie” – polem obrazu.
//
// Bez DOM poza DOMParser i bez Fabric: elementy powstają jako zwykły JSON projektu (jak gotowe sekcje).

import { nowyProjekt, nowaSekcja, nowaStrona, nowyWzorzec, uid, normalizuj } from './projekt.js';
import { czytajPub } from './pub-czytnik.js';

const MM = 25.4 / 72; // pt → mm
const r2 = (v) => Math.round(v * 100) / 100;

// ---------- Macierze 2D: [a, b, c, d, e, f] (x' = a x + c y + e, y' = b x + d y + f) ----------

const JEDNOSTKOWA = [1, 0, 0, 1, 0, 0];
const mnoz = (m, n) => [ // najpierw n, potem m
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const odwroc = (m) => {
  const det = m[0] * m[3] - m[1] * m[2] || 1;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
};
const przeksztalc = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const macierzZ = (tekst) => { const v = String(tekst || '').trim().split(/\s+/).map(Number); return v.length === 6 && v.every(Number.isFinite) ? v : JEDNOSTKOWA; };
const katMacierzy = (m) => (Math.atan2(m[1], m[0]) * 180) / Math.PI;
const skalaMacierzy = (m) => [Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3])];

// ---------- Kolory ----------

const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
const rgbHex = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
const cmykHex = (c, m, y, k) => rgbHex(255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - y) * (1 - k));
function labHex(L, a, b) {
  let y = (L + 16) / 116; let x = a / 500 + y; let z = y - b / 200;
  [x, y, z] = [x, y, z].map((t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787));
  x *= 0.95047; z *= 1.08883;
  const lin = [x * 3.2406 + y * -1.5372 + z * -0.4986, x * -0.9689 + y * 1.8758 + z * 0.0415, x * 0.0557 + y * -0.204 + z * 1.057];
  const [r, g, bb] = lin.map((v) => 255 * (v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v));
  return rgbHex(r, g, bb);
}

// ---------- Ścieżki ----------

// Ścieżka SVG (bezwzględne M L C Q Z H V) → polecenia Fabric.
function sciezkaSvg(d) {
  const t = String(d || '').match(/[MLCQZHV]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  const wynik = [];
  let i = 0;
  let x = 0;
  let y = 0;
  const n = () => Number(t[i++]);
  while (i < t.length) {
    const c = t[i++].toUpperCase();
    if (c === 'M' || c === 'L') { x = n(); y = n(); wynik.push([c, x, y]); }
    else if (c === 'H') { x = n(); wynik.push(['L', x, y]); }
    else if (c === 'V') { y = n(); wynik.push(['L', x, y]); }
    else if (c === 'C') { const v = [n(), n(), n(), n(), n(), n()]; [x, y] = v.slice(4); wynik.push(['C', ...v]); }
    else if (c === 'Q') { const v = [n(), n(), n(), n()]; [x, y] = v.slice(2); wynik.push(['Q', ...v]); }
    else if (c === 'Z') wynik.push(['Z']);
    else break;
  }
  return wynik;
}

// Polecenia (w pt, układ elementu) przez macierz do mm strony; ramka wynikowa.
function sciezkaNaStronie(polecenia, m) {
  const xs = [];
  const ys = [];
  const wynik = polecenia.map(([c, ...v]) => {
    const p = [];
    for (let i = 0; i + 1 < v.length; i += 2) {
      const [x, y] = przeksztalc(m, [v[i], v[i + 1]]).map((q) => q * MM);
      xs.push(x); ys.push(y); p.push(r2(x), r2(y));
    }
    return [c, ...p];
  });
  return { path: wynik, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// Czy ścieżka to prostokąt równoległy do brzegów (4 rogi) – wtedy zwykły prostokąt.
function prostokatZeSciezki(path) {
  const pkt = path.filter((p) => p[0] === 'M' || p[0] === 'L').map((p) => [p[1], p[2]]);
  if (path.some((p) => p[0] === 'C' || p[0] === 'Q')) return null;
  const rozne = pkt.filter((p, i) => !pkt.slice(0, i).some((q) => Math.abs(q[0] - p[0]) < 0.01 && Math.abs(q[1] - p[1]) < 0.01));
  if (rozne.length !== 4) return null;
  const xs = [...new Set(rozne.map((p) => p[0].toFixed(2)))];
  const ys = [...new Set(rozne.map((p) => p[1].toFixed(2)))];
  if (xs.length !== 2 || ys.length !== 2) return null;
  return { x: Math.min(...xs.map(Number)), y: Math.min(...ys.map(Number)), w: Math.abs(xs[0] - xs[1]), h: Math.abs(ys[0] - ys[1]) };
}

function ksztaltZeSciezki(path, { fill, stroke, strokeWidth, nazwa, elipsa = false, linia = false }) {
  const wsp = { id: uid('o'), fill: linia ? null : fill, stroke: stroke || null, strokeWidth: stroke ? r2(strokeWidth || 0.25) : 0, strokeUniform: true, nazwa };
  const xs = path.flatMap((p) => p.slice(1).filter((_, i) => i % 2 === 0));
  const ys = path.flatMap((p) => p.slice(1).filter((_, i) => i % 2 === 1));
  const ramka = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  if (elipsa && ramka.w > 0 && ramka.h > 0) return { type: 'ellipse', left: r2(ramka.x), top: r2(ramka.y), rx: r2(ramka.w / 2), ry: r2(ramka.h / 2), width: r2(ramka.w), height: r2(ramka.h), ...wsp };
  const p = !linia && prostokatZeSciezki(path);
  if (p) return { type: 'rect', left: r2(p.x), top: r2(p.y), width: r2(p.w), height: r2(p.h), ...wsp };
  return { type: 'path', path, left: r2(ramka.x), top: r2(ramka.y), ...wsp };
}

// ---------- Tekst ----------

// Fragmenty [{ tekst, styl }] → { text, styles } (style tylko tam, gdzie różnią się od podstawowego).
function zlozTekst(fragmenty, akapity) {
  let text = '';
  const styles = [];
  const licz = {};
  for (const f of fragmenty) { const k = JSON.stringify(f.styl); licz[k] = (licz[k] || 0) + f.tekst.length; }
  const podstawowy = JSON.parse(Object.entries(licz).sort((a, b) => b[1] - a[1])[0]?.[0] || '{}');
  let i = 0;
  for (const f of fragmenty) {
    const roznica = Object.fromEntries(Object.entries(f.styl).filter(([k, v]) => podstawowy[k] !== v));
    const bezNowychLinii = f.tekst.replace(/\n/g, '');
    if (Object.keys(roznica).length && bezNowychLinii.length) styles.push({ start: i, end: i + bezNowychLinii.length, style: roznica });
    text += f.tekst;
    i += bezNowychLinii.length;
  }
  const wyr = Object.entries(akapity.reduce((a, x) => ({ ...a, [x]: (a[x] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'left';
  return { text, styles, podstawowy, wyrownanie: wyr };
}

// Pola korespondencji seryjnej: <<imie>> (InDesign / Affinity Data Merge), «imie» (Word / Publisher) → {imie}.
export function polaScalania(text) {
  const pola = new Set();
  const wynik = String(text).replace(/<<\s*([^<>\n]{1,60}?)\s*>>|«\s*([^«»\n]{1,60}?)\s*»/g, (_, a, b) => { const n = (a || b).replace(/^@/, ''); pola.add(n); return `{${n}}`; });
  return { text: wynik, pola: [...pola] };
}

function ramkaTekstu({ x, y, w, h, kat, zlozony, nazwa }) {
  const p = zlozony.podstawowy;
  const { text, pola } = polaScalania(zlozony.text);
  return {
    obj: {
      type: 'textbox', id: uid('o'), strokeWidth: 0, left: r2(x), top: r2(y), width: r2(Math.max(2, w)), angle: r2(kat || 0), text,
      styles: pola.length ? [] : zlozony.styles, // po zamianie pól indeksy się przesuwają – bez formatowania fragmentów
      fontFamily: p.fontFamily || 'Inter', fontSize: r2(p.fontSize || 4), fontWeight: p.fontWeight || 'normal', fontStyle: p.fontStyle || 'normal',
      fill: p.fill || '#000000', underline: Boolean(p.underline), linethrough: Boolean(p.linethrough),
      textAlign: zlozony.wyrownanie, lineHeight: r2(p._interlinia && p.fontSize ? Math.max(0.6, p._interlinia / (p.fontSize * 1.13)) : 1.16),
      ramka_h: r2(h), nazwa,
    },
    pola,
  };
}
const bezPomocniczych = (styl) => Object.fromEntries(Object.entries(styl).filter(([k]) => !k.startsWith('_')));

// ---------- Obrazy ----------

async function wymiaryObrazu(blob) {
  try { const b = await globalThis.createImageBitmap(blob); const w = { w: b.width, h: b.height }; b.close?.(); return w; } catch { return null; }
}
const typObrazu = (bajty) => (bajty[0] === 0x89 && bajty[1] === 0x50 ? 'image/png' : bajty[0] === 0xff && bajty[1] === 0xd8 ? 'image/jpeg' : bajty[0] === 0x47 && bajty[1] === 0x49 ? 'image/gif' : bajty[0] === 0x52 && bajty[1] === 0x49 ? 'image/webp' : '');
const zBase64 = (s) => {
  try { return Uint8Array.from(atob(String(s).replace(/[^A-Za-z0-9+/=]/g, '')), (c) => c.charCodeAt(0)); } catch { return new Uint8Array(0); }
};

// Obraz przycięty do ramki (oba prostokąty w mm strony, bez obrotu): element obrazu z cropX/cropY.
function obrazWRamce(zasob, px, ramkaObrazu, ramka) {
  const sx = ramkaObrazu.w / px.w;
  const sy = ramkaObrazu.h / px.h;
  const x1 = Math.max(ramka.x, ramkaObrazu.x);
  const y1 = Math.max(ramka.y, ramkaObrazu.y);
  const x2 = Math.min(ramka.x + ramka.w, ramkaObrazu.x + ramkaObrazu.w);
  const y2 = Math.min(ramka.y + ramka.h, ramkaObrazu.y + ramkaObrazu.h);
  if (x2 - x1 < 0.1 || y2 - y1 < 0.1) return null;
  return {
    type: 'image', id: uid('o'), src: `zasob:${zasob}`, zasob, left: r2(x1), top: r2(y1), scaleX: sx, scaleY: sy,
    cropX: (x1 - ramkaObrazu.x) / sx, cropY: (y1 - ramkaObrazu.y) / sy, width: (x2 - x1) / sx, height: (y2 - y1) / sy,
  };
}
function brakObrazu(ramka, nazwa) {
  return { type: 'rect', id: uid('o'), left: r2(ramka.x), top: r2(ramka.y), width: r2(ramka.w), height: r2(ramka.h), fill: '#e8e6e1', stroke: '#c9c6bf', strokeWidth: 0.2, strokeUniform: true, nazwa: `Brak obrazu: ${nazwa}` };
}

// ---------- Projekt ----------

// strony: [{ w, h, spad, marginesy, obiekty }] (mm) → projekt z sekcjami po formacie.
function zbudujProjekt(nazwa, strony) {
  const p = nowyProjekt(nazwa);
  p.sekcje = [];
  p.strony = [];
  let sekcja = null;
  strony.forEach((s, i) => {
    const klucz = `${r2(s.w)}x${r2(s.h)}`;
    if (!sekcja || sekcja._klucz !== klucz) {
      sekcja = nowaSekcja(p.sekcje.length ? `Sekcja ${p.sekcje.length + 1} (${r2(s.w)} × ${r2(s.h)} mm)` : 'Główna', {
        format: 'wlasny', szerokosc_mm: r2(s.w), wysokosc_mm: r2(s.h), spad_mm: r2(s.spad || 0), marginesy: s.marginesy, znaki_ciecia: true,
      });
      sekcja._klucz = klucz;
      p.sekcje.push(sekcja);
    }
    const st = nowaStrona(`Strona ${i + 1}`, sekcja.id);
    st.obiekty = s.obiekty;
    // Strona wzorcowa z pliku → wzorzec Makietki (jeden na stronę wzorcową, wspólny dla stron, które go używają).
    if (s.wzorzec) {
      if (!s.wzorzec.idMakietki) {
        const wz = nowyWzorzec(s.wzorzec.nazwaWzorca || 'Wzorzec', sekcja.wydruk);
        wz.obiekty = s.wzorzec.obiekty;
        p.wzorce.push(wz);
        s.wzorzec.idMakietki = wz.id;
      }
      st.wzorce = [s.wzorzec.idMakietki];
    }
    p.strony.push(st);
  });
  for (const s of p.sekcje) delete s._klucz;
  if (!p.strony.length) return normalizuj(nowyProjekt(nazwa));
  return p;
}

// Wątki: ramki [{ id, nastepna }] w kolejności – wspólny `watek`, tekst w pierwszej ramce.
function polaczWatki(ramki) {
  const poId = new Map(ramki.map((r) => [r.klucz, r]));
  const maPoprzednika = new Set(ramki.filter((r) => r.nastepna && poId.has(r.nastepna)).map((r) => r.nastepna));
  for (const start of ramki.filter((r) => !maPoprzednika.has(r.klucz) && r.nastepna && poId.has(r.nastepna))) {
    const watek = uid('w');
    let r = start;
    let nr = 0;
    const odwiedzone = new Set();
    while (r && !odwiedzone.has(r.klucz)) {
      odwiedzone.add(r.klucz);
      Object.assign(r.obj, { watek, watek_nr: nr });
      if (nr > 0) { r.obj.text = ''; r.obj.styles = []; }
      nr += 1;
      r = r.nastepna ? poId.get(r.nastepna) : null;
    }
  }
}

// ---------- IDML ----------

async function czytajIdml(zip, { obrazyObok, przyjmij, raport }) {
  const tekst = async (n) => { const f = zip.file(n); return f ? f.async('string') : ''; };
  const xml = (s) => new DOMParser().parseFromString(czystyXml(s), 'application/xml');
  const dm = xml(await tekst('designmap.xml'));
  if (!dm.documentElement || dm.querySelector('parsererror')) throw new Error('To nie jest poprawny plik IDML (brak designmap.xml).');
  // Kolory.
  const kolory = new Map([['Swatch/None', null], ['Color/Paper', '#ffffff'], ['Color/Black', '#000000'], ['Color/Registration', '#000000']]);
  const graphic = xml(await tekst('Resources/Graphic.xml'));
  for (const c of graphic.getElementsByTagName('Color')) {
    const v = String(c.getAttribute('ColorValue') || '').trim().split(/\s+/).map(Number);
    const sp = c.getAttribute('Space');
    const self = c.getAttribute('Self');
    if (kolory.has(self)) continue;
    if (sp === 'RGB' && v.length >= 3) kolory.set(self, rgbHex(...v));
    else if (sp === 'CMYK' && v.length >= 4) kolory.set(self, cmykHex(...v.map((x) => x / 100)));
    else if (sp === 'LAB' && v.length >= 3) kolory.set(self, labHex(...v));
  }
  for (const t of graphic.getElementsByTagName('Tint')) {
    const baza = kolory.get(t.getAttribute('BaseColor'));
    const proc = Number(t.getAttribute('TintValue'));
    if (baza && Number.isFinite(proc) && proc >= 0) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(baza.slice(i, i + 2), 16));
      const k = proc / 100;
      kolory.set(t.getAttribute('Self'), rgbHex(255 - (255 - r) * k, 255 - (255 - g) * k, 255 - (255 - b) * k));
    } else kolory.set(t.getAttribute('Self'), baza ?? null);
  }
  for (const g of graphic.getElementsByTagName('Gradient')) {
    const stop = g.getElementsByTagName('GradientStop')[0];
    kolory.set(g.getAttribute('Self'), stop ? (kolory.get(stop.getAttribute('StopColor')) ?? '#cccccc') : '#cccccc');
  }
  const kolor = (id) => (id && kolory.has(id) ? kolory.get(id) : (id ? '#000000' : null));
  // Style akapitu i znaku (dziedziczenie przez BasedOn).
  const style = new Map();
  const styles = xml(await tekst('Resources/Styles.xml'));
  for (const s of [...styles.getElementsByTagName('ParagraphStyle'), ...styles.getElementsByTagName('CharacterStyle')]) style.set(s.getAttribute('Self'), s);
  const wlasnosc = (el, nazwa) => {
    if (!el) return undefined;
    if (el.hasAttribute(nazwa)) return el.getAttribute(nazwa);
    const pr = [...el.children].find((c) => c.tagName === 'Properties');
    const w = pr && [...pr.children].find((c) => c.tagName === nazwa);
    return w ? w.textContent : undefined;
  };
  const zeStylu = (id, nazwa, glebokosc = 0) => {
    const s = style.get(id);
    if (!s || glebokosc > 10) return undefined;
    const v = wlasnosc(s, nazwa);
    if (v !== undefined) return v;
    const baza = wlasnosc(s, 'BasedOn');
    if (!baza) return undefined;
    const pelna = baza.includes('/') ? baza : `${id.split('/')[0]}/${baza}`;
    return zeStylu(pelna, nazwa, glebokosc + 1);
  };
  const atr = (nazwa, ...el) => {
    for (const e of el) {
      if (!e) continue;
      const v = wlasnosc(e, nazwa);
      if (v !== undefined) return v;
      const st = e.getAttribute('AppliedCharacterStyle') || e.getAttribute('AppliedParagraphStyle');
      const z = st && zeStylu(st, nazwa);
      if (z !== undefined) return z;
    }
    return undefined;
  };
  // Historie.
  const historie = new Map();
  for (const s of dm.getElementsByTagName('idPkg:Story')) {
    const d = xml(await tekst(s.getAttribute('src')));
    const st = d.getElementsByTagName('Story')[0];
    if (st) historie.set(st.getAttribute('Self'), st);
  }
  const zlozHistorie = (st) => {
    const fragmenty = [];
    const akapity = [];
    for (const psr of st.getElementsByTagName('ParagraphStyleRange')) {
      const just = atr('Justification', psr) || 'LeftAlign';
      akapity.push(/Center/.test(just) ? 'center' : /Right/.test(just) ? 'right' : /Justified/.test(just) ? 'justify' : 'left');
      for (const csr of [...psr.children].filter((x) => x.tagName === 'CharacterStyleRange' || x.tagName === 'Br')) {
        if (csr.tagName === 'Br') { fragmenty.push({ tekst: '\n', styl: fragmenty.at(-1)?.styl || {} }); continue; }
        const odmiana = String(atr('FontStyle', csr, psr) || 'Regular');
        const rozmiar = Number(atr('PointSize', csr, psr) || 12);
        const inter = Number(atr('Leading', csr, psr));
        const styl = {
          fontFamily: String(atr('AppliedFont', csr, psr) || 'Inter').replace(/\t.*$/, ''),
          fontSize: r2(rozmiar * MM),
          fontWeight: /bold|black|heavy|semibold/i.test(odmiana) ? 'bold' : 'normal',
          fontStyle: /italic|oblique/i.test(odmiana) ? 'italic' : 'normal',
          fill: kolor(atr('FillColor', csr, psr) || 'Color/Black') || '#000000',
          ...(atr('Underline', csr, psr) === 'true' ? { underline: true } : {}),
          ...(atr('StrikeThru', csr, psr) === 'true' ? { linethrough: true } : {}),
          ...(Number.isFinite(inter) ? { _interlinia: inter * MM } : {}),
        };
        for (const ch of csr.childNodes) {
          if (ch.nodeType !== 1) continue;
          if (ch.tagName === 'Content') fragmenty.push({ tekst: ch.textContent.replace(/[\u2028\u2029]/g, '\n'), styl });
          else if (ch.tagName === 'Br') fragmenty.push({ tekst: '\n', styl });
          else if (ch.tagName === 'TextVariableInstance') fragmenty.push({ tekst: ch.getAttribute('ResultText') || '', styl });
        }
      }
    }
    if (fragmenty.at(-1)?.tekst === '\n') fragmenty.pop();
    const z = zlozTekst(fragmenty, akapity);
    z.podstawowy._interlinia = z.podstawowy._interlinia ?? undefined;
    const interlinia = z.podstawowy._interlinia;
    z.podstawowy = bezPomocniczych(z.podstawowy);
    z.podstawowy._interlinia = interlinia;
    z.styles = z.styles.map((s) => ({ ...s, style: bezPomocniczych(s.style) })).filter((s) => Object.keys(s.style).length);
    return z;
  };
  // Preferencje: spad.
  const pref = xml(await tekst('Resources/Preferences.xml'));
  const dp = pref.getElementsByTagName('DocumentPreference')[0];
  const spad = Number(dp?.getAttribute('DocumentBleedTopOffset') || 0) * MM;
  // Rozkładówki → strony (i rozkładówki wzorcowe → wzorce).
  const strony = [];
  const ramkiTekstu = [];
  const rozkladowka = async (spread, cel) => {
    const naRozkl = [...spread.children].filter((c) => c.tagName === 'Page').map((pg) => {
      const gb = String(pg.getAttribute('GeometricBounds') || '0 0 792 612').split(/\s+/).map(Number); // góra lewo dół prawo
      const mt = macierzZ(pg.getAttribute('ItemTransform'));
      const mp = pg.getElementsByTagName('MarginPreference')[0];
      const m = (k) => Number(mp?.getAttribute(k) || 0) * MM;
      const strona = {
        w: (gb[3] - gb[1]) * MM, h: (gb[2] - gb[0]) * MM, spad, obiekty: [],
        marginesy: { gora: m('Top'), dol: m('Bottom'), wewnetrzny: m('Left'), zewnetrzny: m('Right') },
        // rozkładówka → strona (pt): odwrotność położenia strony, minus początek ramki strony
        doStrony: mnoz([1, 0, 0, 1, -gb[1], -gb[0]], odwroc(mt)),
        rog: przeksztalc(mt, [gb[1], gb[0]]), rog2: przeksztalc(mt, [gb[3], gb[2]]),
        master: pg.getAttribute('AppliedMaster') || null,
      };
      cel.push(strona);
      return strona;
    });
    if (!naRozkl.length) return;
    const ktora = (pt) => naRozkl.find((s) => pt[0] >= Math.min(s.rog[0], s.rog2[0]) && pt[0] <= Math.max(s.rog[0], s.rog2[0]) && pt[1] >= Math.min(s.rog[1], s.rog2[1]) && pt[1] <= Math.max(s.rog[1], s.rog2[1]))
      || naRozkl.reduce((a, s) => (Math.hypot(pt[0] - (s.rog[0] + s.rog2[0]) / 2, pt[1] - (s.rog[1] + s.rog2[1]) / 2) < Math.hypot(pt[0] - (a.rog[0] + a.rog2[0]) / 2, pt[1] - (a.rog[1] + a.rog2[1]) / 2) ? s : a));
    const element = async (el, rodzic) => {
      const tag = el.tagName;
      if (!['Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'TextFrame', 'Group'].includes(tag)) return;
      if (el.getAttribute('Visible') === 'false') return;
      const m = mnoz(rodzic, macierzZ(el.getAttribute('ItemTransform')));
      if (tag === 'Group') { for (const c of el.children) await element(c, m); return; }
      // Geometria (w układzie elementu, pt).
      const polecenia = [];
      for (const g of el.getElementsByTagName('GeometryPathType')) {
        const pkt = [...g.getElementsByTagName('PathPointType')].map((p) => ['Anchor', 'LeftDirection', 'RightDirection'].map((k) => String(p.getAttribute(k)).split(/\s+/).map(Number)));
        if (!pkt.length) continue;
        polecenia.push(['M', ...pkt[0][0]]);
        const krzywa = (a, b) => (a[2][0] === a[0][0] && a[2][1] === a[0][1] && b[1][0] === b[0][0] && b[1][1] === b[0][1] ? ['L', ...b[0]] : ['C', ...a[2], ...b[1], ...b[0]]);
        for (let i = 1; i < pkt.length; i += 1) polecenia.push(krzywa(pkt[i - 1], pkt[i]));
        if (g.getAttribute('PathOpen') !== 'true') { polecenia.push(krzywa(pkt[pkt.length - 1], pkt[0])); polecenia.push(['Z']); }
      }
      if (!polecenia.length) return;
      // Środek elementu → strona.
      const xs = polecenia.flatMap((p) => p.slice(1).filter((_, i) => i % 2 === 0));
      const ys = polecenia.flatMap((p) => p.slice(1).filter((_, i) => i % 2 === 1));
      const srodek = przeksztalc(m, [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
      const strona = ktora(srodek);
      const mStr = mnoz(strona.doStrony, m);
      const naStr = sciezkaNaStronie(polecenia, mStr);
      const nazwa = el.getAttribute('Name') && el.getAttribute('Name') !== '$ID/' ? el.getAttribute('Name') : undefined;
      if (tag === 'TextFrame') {
        const st = historie.get(el.getAttribute('ParentStory'));
        const z = st ? zlozHistorie(st) : zlozTekst([], []);
        // Ramka bez obrotu w swoim układzie: lewy górny róg i rozmiar z geometrii, kąt z macierzy.
        const x0 = Math.min(...xs); const y0 = Math.min(...ys);
        const [lx, ly] = przeksztalc(mStr, [x0, y0]).map((v) => v * MM);
        const [skX, skY] = skalaMacierzy(mStr);
        const { obj, pola } = ramkaTekstu({ x: lx, y: ly, w: (Math.max(...xs) - x0) * skX * MM, h: (Math.max(...ys) - y0) * skY * MM, kat: katMacierzy(mStr), zlozony: z, nazwa });
        const tlo = kolor(el.getAttribute('FillColor'));
        if (tlo) obj.backgroundColor = tlo;
        pola.forEach((p) => raport.pola.add(p));
        strona.obiekty.push(obj);
        const nast = el.getAttribute('NextTextFrame');
        ramkiTekstu.push({ klucz: el.getAttribute('Self'), nastepna: nast && nast !== 'n' ? nast : null, obj });
        raport.teksty += 1;
        return;
      }
      // Obraz w ramce?
      const obraz = [...el.children].find((c) => ['Image', 'PDF', 'EPS', 'PICT', 'WMF', 'ImportedPage'].includes(c.tagName));
      if (obraz) {
        const ramkaStr = { x: naStr.x, y: naStr.y, w: naStr.w, h: naStr.h };
        const link = obraz.getElementsByTagName('Link')[0];
        const plik = decodeURIComponent(String(link?.getAttribute('LinkResourceURI') || '').replace(/^file:/, '').split(/[\\/]/).pop() || 'obraz');
        let blob = null;
        const tresc = obraz.getElementsByTagName('Contents')[0]?.textContent;
        if (tresc && obraz.tagName === 'Image') { const b = zBase64(tresc); const typ = typObrazu(b); if (typ) blob = new Blob([b], { type: typ }); }
        if (!blob) blob = obrazyObok(plik);
        const px = blob && await wymiaryObrazu(blob);
        if (!blob || !px) { strona.obiekty.push(brakObrazu(ramkaStr, plik)); raport.brakujace.add(plik); return; }
        const id = await przyjmij(blob, plik);
        const gb = obraz.getElementsByTagName('GraphicBounds')[0];
        const g = ['Left', 'Top', 'Right', 'Bottom'].map((k) => Number(gb?.getAttribute(k) || 0));
        const mi = mnoz(mStr, macierzZ(obraz.getAttribute('ItemTransform')));
        const a = przeksztalc(mi, [g[0], g[1]]).map((v) => v * MM);
        const b = przeksztalc(mi, [g[2], g[3]]).map((v) => v * MM);
        const ramkaObrazu = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]) || ramkaStr.w, h: Math.abs(b[1] - a[1]) || ramkaStr.h };
        const o = obrazWRamce(id, px, ramkaObrazu, ramkaStr);
        if (o) { o.nazwa = nazwa || plik; strona.obiekty.push(o); raport.obrazy += 1; }
        return;
      }
      const sw = Number(el.getAttribute('StrokeWeight'));
      const [skX] = skalaMacierzy(mStr);
      strona.obiekty.push(ksztaltZeSciezki(naStr.path, {
        fill: kolor(el.getAttribute('FillColor')), stroke: kolor(el.getAttribute('StrokeColor')), strokeWidth: Number.isFinite(sw) ? sw * skX * MM : 0.35,
        nazwa, elipsa: tag === 'Oval', linia: tag === 'GraphicLine',
      }));
      raport.ksztalty += 1;
    };
    for (const c of spread.children) await element(c, JEDNOSTKOWA);
  };
  // Wzorce (MasterSpread): strony wzorcowe → wzorce Makietki; strona dostaje wzorzec swojej strony (lewa/prawa).
  const wzorce = new Map(); // Self rozkładówki wzorcowej → [strony]
  for (const mEl of dm.getElementsByTagName('idPkg:MasterSpread')) {
    const d = xml(await tekst(mEl.getAttribute('src')));
    const ms = d.getElementsByTagName('MasterSpread')[0];
    if (!ms) continue;
    const lista = [];
    await rozkladowka(ms, lista);
    lista.forEach((st, i) => { st.nazwaWzorca = `${ms.getAttribute('NamePrefix') || ''}-${ms.getAttribute('BaseName') || 'Wzorzec'}${lista.length > 1 ? (i ? ' (prawa)' : ' (lewa)') : ''}`.replace(/^-/, ''); });
    wzorce.set(ms.getAttribute('Self'), lista);
  }
  for (const spEl of dm.getElementsByTagName('idPkg:Spread')) {
    const d = xml(await tekst(spEl.getAttribute('src')));
    const spread = d.getElementsByTagName('Spread')[0];
    if (spread) await rozkladowka(spread, strony);
  }
  for (const st of strony) {
    const lista = st.master && st.master !== 'n' ? wzorce.get(st.master) : null;
    if (!lista?.length) continue;
    // Strona lewa (na lewo od grzbietu rozkładówki) – pierwsza strona wzorca, prawa – druga.
    const w = lista.length > 1 && Math.max(st.rog[0], st.rog2[0]) > 0.5 ? lista[1] : lista[0];
    if (w.obiekty.length) st.wzorzec = w;
  }
  polaczWatki(ramkiTekstu);
  return strony;
}

// ---------- Scribus (.sla) ----------

// Starsze programy zapisują w XML znaki niedozwolone w XML 1.0 (np. &#x1; w tekście) – usuwamy je przed odczytem.
const czystyXml = (t) => String(t).replace(/&#(?:x0*(?:[0-8bcef]|1[0-9a-f])|0*(?:[0-8]|1[1-2]|1[4-9]|2[0-9]|3[01]));/gi, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

async function czytajSla(tekstSla, { obrazyObok, przyjmij, raport }) {
  const d = new DOMParser().parseFromString(czystyXml(tekstSla), 'application/xml');
  const doc = d.getElementsByTagName('DOCUMENT')[0];
  if (!doc || d.querySelector('parsererror')) throw new Error('To nie jest poprawny plik Scribusa (.sla).');
  const kolory = new Map([['None', null], ['White', '#ffffff'], ['Black', '#000000']]);
  for (const c of doc.getElementsByTagName('COLOR')) {
    const n = c.getAttribute('NAME');
    const sp = c.getAttribute('SPACE');
    const v = (k) => Number(c.getAttribute(k) || 0);
    if (sp === 'RGB') kolory.set(n, rgbHex(v('R'), v('G'), v('B')));
    else if (sp === 'CMYK') kolory.set(n, cmykHex(v('C') / 100, v('M') / 100, v('Y') / 100, v('K') / 100));
    else if (sp === 'Lab') kolory.set(n, labHex(v('L'), v('A'), v('B')));
    else if (c.getAttribute('RGB')) kolory.set(n, c.getAttribute('RGB'));
    else if (c.getAttribute('CMYK')) { const h = c.getAttribute('CMYK').replace('#', ''); kolory.set(n, cmykHex(...[0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16) / 255))); }
  }
  const kolor = (n) => (n && kolory.has(n) ? kolory.get(n) : (n && n !== 'None' ? '#000000' : null));
  const da = (k, def = 0) => Number(doc.getAttribute(k) ?? def);
  const spad = da('BleedTop') * MM;
  const strony = [...doc.children].filter((c) => c.tagName === 'PAGE').map((pg) => {
    const a = (k) => Number(pg.getAttribute(k) || 0);
    return {
      nr: a('NUM'), x: a('PAGEXPOS'), y: a('PAGEYPOS'), w: (a('PAGEWIDTH') || a('PAGEWITH')) * MM, h: a('PAGEHEIGHT') * MM, spad, obiekty: [],
      marginesy: { gora: a('BORDERTOP') * MM, dol: a('BORDERBOTTOM') * MM, wewnetrzny: a('BORDERLEFT') * MM, zewnetrzny: a('BORDERRIGHT') * MM },
    };
  }).sort((a, b) => a.nr - b.nr);
  const poNr = new Map(strony.map((s) => [s.nr, s]));
  // Strony wzorcowe (MASTERPAGE, obiekty MASTEROBJECT) → wzorce; strona wskazuje swój wzorzec nazwą (MNAM).
  const wzorce = [...doc.children].filter((c) => c.tagName === 'MASTERPAGE').map((pg) => {
    const a = (k) => Number(pg.getAttribute(k) || 0);
    return { nr: a('NUM'), nazwaWzorca: pg.getAttribute('NAM') || 'Wzorzec', x: a('PAGEXPOS'), y: a('PAGEYPOS'), w: (a('PAGEWIDTH') || a('PAGEWITH')) * MM, h: a('PAGEHEIGHT') * MM, obiekty: [] };
  });
  const wzorzecNr = new Map(wzorce.map((w) => [w.nr, w]));
  const wzorzecNazwa = new Map(wzorce.map((w) => [w.nazwaWzorca, w]));
  for (const pg of [...doc.children].filter((c) => c.tagName === 'PAGE')) {
    const st = poNr.get(Number(pg.getAttribute('NUM') || 0));
    if (st) st.mnam = pg.getAttribute('MNAM') || 'Normal';
  }
  const ramkiTekstu = [];
  const element = async (el) => {
    if (el.getAttribute('isGroupControl') === '1') { for (const c of el.children) if (c.tagName === 'PAGEOBJECT' || c.tagName === 'MASTEROBJECT') await element(c); return; }
    const a = (k, def = 0) => Number(el.getAttribute(k) ?? def);
    const strona = el.tagName === 'MASTEROBJECT' ? wzorzecNr.get(a('OwnPage')) : (poNr.get(a('OwnPage')) || strony[0]);
    if (!strona) return;
    const typ = a('PTYPE');
    const W = a('WIDTH');
    const H = a('HEIGHT');
    const m = mnoz([1, 0, 0, 1, a('XPOS') - strona.x, a('YPOS') - strona.y], (() => { const k = (a('ROT') * Math.PI) / 180; return [Math.cos(k), Math.sin(k), -Math.sin(k), Math.cos(k), 0, 0]; })());
    const [lx, ly] = przeksztalc(m, [0, 0]).map((v) => v * MM);
    const nazwa = el.getAttribute('ANNAME') || undefined;
    if (typ === 4) {
      const zrodlo = el.getElementsByTagName('StoryText')[0] || el;
      const fragmenty = [];
      const akapity = [];
      const wyr = (x) => ({ 1: 'center', 2: 'right', 3: 'justify', 4: 'justify' }[x] || 'left');
      let domyslne = {};
      for (const ch of zrodlo.children) {
        const at = (k) => ch.getAttribute(k);
        if (ch.tagName === 'DefaultStyle') domyslne = { FONT: at('FONT'), FONTSIZE: at('FONTSIZE'), FCOLOR: at('FCOLOR'), ALIGN: at('ALIGN'), LINESP: at('LINESP') };
        else if (ch.tagName === 'ITEXT' || ch.tagName === 'tab' || ch.tagName === 'breakline' || ch.tagName === 'nbspace') {
          const font = at('FONT') || domyslne.FONT || 'Arial Regular';
          const [, rodzina, odmiana] = font.match(/^(.*?)\s+(Regular|Bold Italic|Bold|Italic|Medium|Light|Black|Semibold|SemiBold|Oblique|Book|Roman)$/i) || [null, font, 'Regular'];
          const feat = String(at('FEATURES') || '');
          const linesp = Number(domyslne.LINESP);
          const styl = {
            fontFamily: rodzina, fontSize: r2(Number(at('FONTSIZE') || domyslne.FONTSIZE || 12) * MM),
            fontWeight: /bold|black|semibold/i.test(odmiana) ? 'bold' : 'normal', fontStyle: /italic|oblique/i.test(odmiana) ? 'italic' : 'normal',
            fill: kolor(at('FCOLOR') || domyslne.FCOLOR || 'Black') || '#000000',
            ...(/underline/.test(feat) ? { underline: true } : {}), ...(/strike/.test(feat) ? { linethrough: true } : {}),
            ...(Number.isFinite(linesp) && linesp > 0 ? { _interlinia: linesp * MM } : {}),
          };
          const t = ch.tagName === 'ITEXT' ? String(at('CH') || '') : ch.tagName === 'tab' ? '\t' : ch.tagName === 'breakline' ? '\n' : ' ';
          fragmenty.push({ tekst: t, styl });
        } else if (ch.tagName === 'para') { akapity.push(wyr(at('ALIGN') ?? domyslne.ALIGN)); fragmenty.push({ tekst: '\n', styl: fragmenty.at(-1)?.styl || {} }); }
        else if (ch.tagName === 'trail') akapity.push(wyr(at('ALIGN') ?? domyslne.ALIGN));
      }
      const z = zlozTekst(fragmenty, akapity.length ? akapity : [wyr(domyslne.ALIGN)]);
      const interlinia = z.podstawowy._interlinia;
      z.podstawowy = { ...bezPomocniczych(z.podstawowy), _interlinia: interlinia };
      z.styles = z.styles.map((s) => ({ ...s, style: bezPomocniczych(s.style) })).filter((s) => Object.keys(s.style).length);
      const { obj, pola } = ramkaTekstu({ x: lx, y: ly, w: W * MM, h: H * MM, kat: a('ROT'), zlozony: z, nazwa });
      const tlo = kolor(el.getAttribute('PCOLOR'));
      if (tlo) obj.backgroundColor = tlo;
      pola.forEach((p) => raport.pola.add(p));
      strona.obiekty.push(obj);
      const nast = el.getAttribute('NEXTITEM');
      ramkiTekstu.push({ klucz: el.getAttribute('ItemID'), nastepna: nast && nast !== '-1' ? nast : null, obj });
      raport.teksty += 1;
      return;
    }
    const sciezka = sciezkaSvg(el.getAttribute('path')) ;
    const polecenia = sciezka.length ? sciezka : [['M', 0, 0], ['L', W, 0], ['L', W, H], ['L', 0, H], ['Z']];
    const naStr = sciezkaNaStronie(polecenia, m);
    if (typ === 2) {
      const ramka = { x: naStr.x, y: naStr.y, w: naStr.w, h: naStr.h };
      let blob = null;
      const plik = String(el.getAttribute('PFILE') || 'obraz').split(/[\\/]/).pop();
      if (el.getAttribute('isInlineImage') === '1' && el.getAttribute('ImageData')) {
        try {
          const b = zBase64(el.getAttribute('ImageData'));
          const roz = new Uint8Array(await new Response(new Blob([b.subarray(4)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
          const t = typObrazu(roz);
          if (t) blob = new Blob([roz], { type: t });
        } catch { blob = null; }
      }
      if (!blob && el.getAttribute('PFILE')) blob = obrazyObok(plik);
      const px = blob && await wymiaryObrazu(blob);
      if (!blob || !px) { strona.obiekty.push(brakObrazu(ramka, plik)); raport.brakujace.add(plik); return; }
      const id = await przyjmij(blob, el.getAttribute('isInlineImage') === '1' ? `${nazwa || 'obraz'}.${(blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}` : plik);
      let ramkaObrazu;
      if (a('SCALETYPE', 1) === 0) {
        // Dopasowany do ramki: z zachowaniem proporcji (RATIO 1) albo rozciągnięty.
        if (a('RATIO') === 1) { const s = Math.min(ramka.w / px.w, ramka.h / px.h); ramkaObrazu = { x: ramka.x, y: ramka.y, w: px.w * s, h: px.h * s }; }
        else ramkaObrazu = { ...ramka };
      } else {
        const sx = a('LOCALSCX', 1) || 1;
        const sy = a('LOCALSCY', 1) || 1;
        ramkaObrazu = { x: ramka.x + a('LOCALX') * sx * MM, y: ramka.y + a('LOCALY') * sy * MM, w: px.w * sx * MM, h: px.h * sy * MM };
      }
      const o = obrazWRamce(id, px, ramkaObrazu, ramka);
      if (o) { o.nazwa = nazwa || plik; strona.obiekty.push(o); raport.obrazy += 1; }
      return;
    }
    if (![5, 6, 7].includes(typ)) return;
    strona.obiekty.push(ksztaltZeSciezki(naStr.path, {
      fill: kolor(el.getAttribute('PCOLOR')), stroke: kolor(el.getAttribute('PCOLOR2')), strokeWidth: a('PWIDTH', 1) * MM, nazwa,
      elipsa: a('FRTYPE') === 1, linia: typ === 5 || typ === 7,
    }));
    raport.ksztalty += 1;
  };
  for (const c of doc.children) if (c.tagName === 'PAGEOBJECT' || c.tagName === 'MASTEROBJECT') await element(c);
  for (const st of strony) { const w = wzorzecNazwa.get(st.mnam); if (w?.obiekty.length) st.wzorzec = w; }
  polaczWatki(ramkiTekstu);
  return strony;
}

// ---------- Microsoft Publisher (.pub) ----------

const CAL = 25.4; // cal → mm

async function czytajPubDoStron(bufor, { przyjmij, raport }) {
  const pub = czytajPub(bufor);
  const ramkiTekstu = [];
  const pierwszaRamka = new Map(); // id tekstu → ostatnia ramka tego tekstu (do łączenia w wątek)
  const strony = [];
  for (const [nrStrony, st] of pub.strony.entries()) {
    const strona = { w: pub.szer * CAL, h: pub.wys * CAL, spad: 3, marginesy: { gora: 10, dol: 10, wewnetrzny: 10, zewnetrzny: 10 }, obiekty: [] };
    for (const k of st.ksztalty) {
      const w = k.w * CAL;
      const h = k.h * CAL;
      // Publisher obraca wokół środka, Makietka – wokół lewego górnego rogu.
      const r = ((k.kat || 0) * Math.PI) / 180;
      const cx = (k.x + k.w / 2) * CAL;
      const cy = (k.y + k.h / 2) * CAL;
      const x = cx + (-w / 2) * Math.cos(r) - (-h / 2) * Math.sin(r);
      const y = cy + (-w / 2) * Math.sin(r) + (-h / 2) * Math.cos(r);
      if (k.obraz) {
        const ramka = { x: k.x * CAL, y: k.y * CAL, w, h };
        const blob = k.obraz.bajty ? new Blob([k.obraz.bajty], { type: k.obraz.typ }) : null;
        const px = blob && await wymiaryObrazu(blob);
        if (!px) { strona.obiekty.push(brakObrazu(ramka, `obraz ${k.obraz.typ.replace('image/', '').toUpperCase()}`)); const f = k.obraz.typ.replace('image/', '').toUpperCase(); raport.nieobslugiwane.set(f, (raport.nieobslugiwane.get(f) || 0) + 1); continue; }
        const id = await przyjmij(blob, `publisher-${nrStrony + 1}-${strona.obiekty.length + 1}.${{ 'image/jpeg': 'jpg', 'image/bmp': 'bmp', 'image/gif': 'gif' }[k.obraz.typ] || 'png'}`);
        const o = obrazWRamce(id, px, ramka, ramka);
        if (o) { if (k.kat) Object.assign(o, { left: r2(x), top: r2(y), angle: r2(k.kat) }); strona.obiekty.push(o); raport.obrazy += 1; }
        continue;
      }
      if (k.tekst !== null && k.tekst !== undefined && k.tekst.replace(/[\r\n\u000b\s]/g, '')) {
        // Fragmenty z wyglądem znaków; \r – akapit, \v – nowa linia; inne znaki sterujące pominięte.
        const fragmenty = [];
        const tresc = k.tekst.replace(/\r$/, '');
        for (let i = 0; i < tresc.length; i += 1) {
          let z = tresc[i];
          if (z === '\r' || z === '\u000b') z = '\n';
          else if (/[\u0000-\u0008\u000c\u000e-\u001f]/.test(z)) continue;
          const st0 = k.style?.[i] || {};
          const styl = {
            fontFamily: st0.rodzina || 'Times New Roman', fontSize: r2((st0.pt || 10) * MM),
            fontWeight: st0.b ? 'bold' : 'normal', fontStyle: st0.i ? 'italic' : 'normal', fill: st0.kolor || '#000000',
            ...(st0.u ? { underline: true } : {}),
          };
          const ost = fragmenty.at(-1);
          if (ost && JSON.stringify(ost.styl) === JSON.stringify(styl)) ost.tekst += z; else fragmenty.push({ tekst: z, styl });
        }
        const z = zlozTekst(fragmenty, k.wyrownanie || ['left']);
        // Wewnętrzne marginesy ramki tekstu Publishera: 0,04 cala z każdej strony (wartość domyślna).
        const m = 0.04 * CAL;
        const { obj, pola } = ramkaTekstu({ x: x + m * Math.cos(r) - m * Math.sin(r), y: y + m * Math.sin(r) + m * Math.cos(r), w: Math.max(2, w - 2 * m), h: Math.max(2, h - 2 * m), kat: k.kat, zlozony: z });
        if (k.wypelnienie) obj.backgroundColor = k.wypelnienie;
        pola.forEach((p) => raport.pola.add(p));
        strona.obiekty.push(obj);
        raport.teksty += 1;
        // Ten sam tekst w kilku ramkach – ramki połączone (wątek).
        const klucz = `t${ramkiTekstu.length}`;
        const wpis = { klucz, nastepna: null, obj };
        if (k.idTekstu !== null && !k.zWzorca) {
          const poprzednia = pierwszaRamka.get(k.idTekstu);
          if (poprzednia) poprzednia.nastepna = klucz;
          pierwszaRamka.set(k.idTekstu, wpis);
        }
        ramkiTekstu.push(wpis);
        continue;
      }
      if (k.wypelnienie || k.obrys) {
        const wsp = { id: uid('o'), left: r2(x), top: r2(y), angle: r2(k.kat || 0), fill: k.wypelnienie || null, stroke: k.obrys || null, strokeWidth: k.obrys ? r2((k.grubosc || 0.75 / 72) * CAL) : 0, strokeUniform: true };
        strona.obiekty.push(k.typKsztaltu === 3 ? { type: 'ellipse', rx: r2(w / 2), ry: r2(h / 2), width: r2(w), height: r2(h), ...wsp } : { type: 'rect', width: r2(w), height: r2(h), ...wsp });
        raport.ksztalty += 1;
      }
    }
    strony.push(strona);
  }
  polaczWatki(ramkiTekstu);
  return strony;
}

// ---------- Wejście ----------

export const ROZSZERZENIA_SKLADU = ['.idml', '.sla'];
export const toPlikSkladu = (plik) => /\.(idml|sla|pub)$/i.test(plik?.name || '');

// Czy ZIP to pakiet z IDML/SLA (a nie plik .makietka).
export async function zipZeSkladem(zip) {
  return Boolean(zip.file('designmap.xml') || Object.keys(zip.files).some((n) => /\.(idml|sla)$/i.test(n) && !n.startsWith('__MACOSX')));
}

// plik: .idml, .sla albo .zip (pakiet z obrazami). przyjmijObraz(projekt, blob, nazwa) → { id } – dodaje obraz do
// projektu (js/obrazy-projektu.js przyjmijPlik). Zwraca { projekt, raport }.
export async function importujSklad(plik, JSZip, przyjmijObraz) {
  const nazwaPliku = plik.name || 'projekt';
  const raport = { format: '', teksty: 0, ksztalty: 0, obrazy: 0, brakujace: new Set(), nieobslugiwane: new Map(), pola: new Set(), stron: 0 };
  let zip = null;
  let glowny = null; // { rodzaj, zip?, tekst? }
  const obok = new Map(); // nazwa pliku (małe litery) → Blob – obrazy z pakietu
  const bajty = new Uint8Array(await plik.slice(0, 4).arrayBuffer());
  const toZip = bajty[0] === 0x50 && bajty[1] === 0x4b;
  if (/\.pub$/i.test(nazwaPliku)) glowny = { rodzaj: 'pub', bufor: await plik.arrayBuffer() };
  else if (/\.sla$/i.test(nazwaPliku) && !toZip) glowny = { rodzaj: 'sla', tekst: await plik.text() };
  else {
    zip = await JSZip.loadAsync(plik);
    if (zip.file('designmap.xml')) glowny = { rodzaj: 'idml', zip };
    else {
      const wewn = Object.keys(zip.files).find((n) => /\.(idml|sla)$/i.test(n) && !n.startsWith('__MACOSX'));
      if (!wewn) throw new Error('W pliku nie ma projektu InDesigna (IDML) ani Scribusa (SLA).');
      if (/\.idml$/i.test(wewn)) glowny = { rodzaj: 'idml', zip: await JSZip.loadAsync(await zip.file(wewn).async('blob')) };
      else glowny = { rodzaj: 'sla', tekst: await zip.file(wewn).async('string') };
      for (const [n, f] of Object.entries(zip.files)) {
        if (f.dir || n.startsWith('__MACOSX') || !/\.(png|jpe?g|gif|webp)$/i.test(n)) continue;
        const b = await f.async('uint8array');
        obok.set(n.split('/').pop().toLowerCase(), new Blob([b], { type: typObrazu(b) || 'image/png' }));
      }
    }
  }
  raport.format = { idml: 'InDesign (IDML)', sla: 'Scribus (SLA)', pub: 'Microsoft Publisher' }[glowny.rodzaj];
  const nazwa = nazwaPliku.replace(/\.(idml|sla|pub|zip)$/i, '');
  const projekt = nowyProjekt(nazwa);
  const obrazyObok = (n) => obok.get(String(n).toLowerCase()) || null;
  const przyjmij = async (blob, n) => (await przyjmijObraz(projekt, blob, n)).id;
  const kontekst = { obrazyObok, przyjmij, raport };
  const strony = glowny.rodzaj === 'idml' ? await czytajIdml(glowny.zip, kontekst) : glowny.rodzaj === 'pub' ? await czytajPubDoStron(glowny.bufor, kontekst) : await czytajSla(glowny.tekst, kontekst);
  const gotowy = zbudujProjekt(nazwa, strony);
  gotowy.id = projekt.id;
  gotowy.zasoby = projekt.zasoby;
  raport.stron = gotowy.strony.length;
  return { projekt: normalizuj(gotowy), raport: { ...raport, brakujace: [...raport.brakujace], nieobslugiwane: [...raport.nieobslugiwane].map(([f, n]) => `${f} ×${n}`), pola: [...raport.pola] } };
}
