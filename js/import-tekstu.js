// Import tekstu z innych programów (#216): Word (.docx), LibreOffice/OpenOffice (.odt), Markdown (.md) i zwykły
// tekst (.txt) → akapity z nagłówkami i formatowaniem fragmentów (pogrubienie, kursywa, podkreślenie). Same
// obliczenia (DOMParser i JSZip podaje wywołujący) – wynik wstawia aplikacja jako tekst płynący przez strony.
//
// Wynik: { akapity: [{ tekst, poziom: 0 | 1 | 2 | 3 (nagłówek), fragmenty: [{ od, do, b?, i?, u? }] }], pominiete: { obrazy, tabele, przypisy } }

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const NS_STYLE = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
const NS_FO = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';

const pusteWyniki = () => ({ akapity: [], pominiete: { obrazy: 0, tabele: 0, przypisy: 0 } });

// Dokleja fragment tekstu do akapitu z formatowaniem (sąsiednie fragmenty o tym samym wyglądzie się łączą).
function dopisz(akapit, tekst, f = {}) {
  if (!tekst) return;
  const od = akapit.tekst.length;
  akapit.tekst += tekst;
  if (!f.b && !f.i && !f.u) return;
  const ost = akapit.fragmenty.at(-1);
  if (ost && ost.do === od && Boolean(ost.b) === Boolean(f.b) && Boolean(ost.i) === Boolean(f.i) && Boolean(ost.u) === Boolean(f.u)) ost.do = akapit.tekst.length;
  else akapit.fragmenty.push({ od, do: akapit.tekst.length, ...(f.b ? { b: true } : {}), ...(f.i ? { i: true } : {}), ...(f.u ? { u: true } : {}) });
}

// ---------- DOCX ----------

const wlaczone = (el) => Boolean(el) && !['0', 'false', 'none'].includes(el.getAttributeNS(NS_W, 'val') || el.getAttribute('w:val') || '');
function poziomStyluDocx(id, nazwy) {
  const nazwa = (nazwy.get(id) || id || '').toLowerCase().replace(/\s+/g, '');
  if (/^(title|tytuł|tytul)$/.test(nazwa)) return 1;
  const m = nazwa.match(/^(heading|nagłówek|naglowek)(\d)$/);
  return m ? Math.min(3, Number(m[2])) : 0;
}

export async function czytajDocx(zip, Parser = DOMParser) {
  const wynik = pusteWyniki();
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('To nie jest plik Worda (.docx) – brak treści dokumentu.');
  const nazwy = new Map();
  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  if (stylesXml) {
    const st = new Parser().parseFromString(stylesXml, 'application/xml');
    for (const s of st.getElementsByTagNameNS(NS_W, 'style')) {
      const n = s.getElementsByTagNameNS(NS_W, 'name')[0];
      nazwy.set(s.getAttributeNS(NS_W, 'styleId') || s.getAttribute('w:styleId'), n?.getAttributeNS(NS_W, 'val') || n?.getAttribute('w:val') || '');
    }
  }
  const dok = new Parser().parseFromString(xml, 'application/xml');
  const body = dok.getElementsByTagNameNS(NS_W, 'body')[0];
  if (!body) return wynik;
  wynik.pominiete.obrazy = dok.getElementsByTagNameNS(NS_W, 'drawing').length;
  wynik.pominiete.przypisy = dok.getElementsByTagNameNS(NS_W, 'footnoteReference').length;
  const akapitZ = (p) => {
    const a = { tekst: '', poziom: 0, fragmenty: [] };
    const pPr = p.getElementsByTagNameNS(NS_W, 'pPr')[0];
    const pStyle = pPr?.getElementsByTagNameNS(NS_W, 'pStyle')[0];
    if (pStyle) a.poziom = poziomStyluDocx(pStyle.getAttributeNS(NS_W, 'val') || pStyle.getAttribute('w:val'), nazwy);
    const outline = pPr?.getElementsByTagNameNS(NS_W, 'outlineLvl')[0];
    if (!a.poziom && outline) a.poziom = Math.min(3, Number(outline.getAttributeNS(NS_W, 'val') || outline.getAttribute('w:val')) + 1);
    // Pola scalania Worda/Publishera (#226): MERGEFIELD – proste (fldSimple) i złożone (fldChar + instrText) → {pole}.
    let pole = null; // { instr, wynik: bool } – trwające pole złożone
    let wPolu = false; // po „separate” – wynik pola (podgląd «pole») pomijamy
    const nazwaPola = (instr) => { const m = String(instr).match(/MERGEFIELD\s+(?:"([^"]+)"|(\S+))/i); return m ? (m[1] || m[2]) : null; };
    const fldSimpleZ = new Set();
    for (const r of p.getElementsByTagNameNS(NS_W, 'r')) {
      const fs = r.parentNode?.localName === 'fldSimple' ? r.parentNode : null;
      const instrS = fs && (fs.getAttributeNS(NS_W, 'instr') || fs.getAttribute('w:instr'));
      if (fs && nazwaPola(instrS)) {
        if (!fldSimpleZ.has(fs)) { fldSimpleZ.add(fs); dopisz(a, `{${nazwaPola(instrS)}}`, { b: false, i: false, u: false }); }
        continue;
      }
      const znak = r.getElementsByTagNameNS(NS_W, 'fldChar')[0];
      if (znak) {
        const typ = znak.getAttributeNS(NS_W, 'fldCharType') || znak.getAttribute('w:fldCharType');
        if (typ === 'begin') { pole = { instr: '' }; wPolu = false; }
        else if (typ === 'separate' && pole) { const n = nazwaPola(pole.instr); if (n) { dopisz(a, `{${n}}`, { b: false, i: false, u: false }); wPolu = true; } }
        else if (typ === 'end') { if (pole && !wPolu) { const n = nazwaPola(pole.instr); if (n) dopisz(a, `{${n}}`, { b: false, i: false, u: false }); } pole = null; wPolu = false; }
        continue;
      }
      const instrText = r.getElementsByTagNameNS(NS_W, 'instrText')[0];
      if (instrText && pole) { pole.instr += instrText.textContent; continue; }
      if (wPolu) continue;
      const rPr = r.getElementsByTagNameNS(NS_W, 'rPr')[0];
      const f = {
        b: wlaczone(rPr?.getElementsByTagNameNS(NS_W, 'b')[0]),
        i: wlaczone(rPr?.getElementsByTagNameNS(NS_W, 'i')[0]),
        u: wlaczone(rPr?.getElementsByTagNameNS(NS_W, 'u')[0]),
      };
      for (const c of r.childNodes) {
        if (c.namespaceURI !== NS_W) continue;
        if (c.localName === 't') dopisz(a, c.textContent, f);
        else if (c.localName === 'tab') dopisz(a, '\t', f);
        else if (c.localName === 'br' || c.localName === 'cr') dopisz(a, ' ', f);
        else if (c.localName === 'noBreakHyphen') dopisz(a, '‑', f);
      }
    }
    return a;
  };
  for (const el of body.children) {
    if (el.localName === 'p') wynik.akapity.push(akapitZ(el));
    else if (el.localName === 'tbl') {
      // Tabela: każdy wiersz jako akapit z komórkami rozdzielonymi tabulatorem.
      wynik.pominiete.tabele += 1;
      for (const tr of el.getElementsByTagNameNS(NS_W, 'tr')) {
        const a = { tekst: '', poziom: 0, fragmenty: [] };
        [...tr.getElementsByTagNameNS(NS_W, 'tc')].forEach((tc, i) => {
          if (i) dopisz(a, '\t');
          dopisz(a, [...tc.getElementsByTagNameNS(NS_W, 'p')].map((p) => akapitZ(p).tekst).join(' '));
        });
        wynik.akapity.push(a);
      }
    }
  }
  return wynik;
}

// ---------- ODT ----------

export async function czytajOdt(zip, Parser = DOMParser) {
  const wynik = pusteWyniki();
  const xml = await zip.file('content.xml')?.async('string');
  if (!xml) throw new Error('To nie jest plik ODT – brak treści dokumentu.');
  const dok = new Parser().parseFromString(xml, 'application/xml');
  // Style automatyczne: pogrubienie, kursywa, podkreślenie fragmentów.
  const wyglad = new Map();
  for (const s of dok.getElementsByTagNameNS(NS_STYLE, 'style')) {
    const t = s.getElementsByTagNameNS(NS_STYLE, 'text-properties')[0];
    if (!t) continue;
    wyglad.set(s.getAttributeNS(NS_STYLE, 'name'), {
      b: t.getAttributeNS(NS_FO, 'font-weight') === 'bold',
      i: t.getAttributeNS(NS_FO, 'font-style') === 'italic',
      u: Boolean(t.getAttributeNS(NS_STYLE, 'text-underline-style')) && t.getAttributeNS(NS_STYLE, 'text-underline-style') !== 'none',
    });
  }
  wynik.pominiete.obrazy = dok.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:drawing:1.0', 'image').length;
  wynik.pominiete.przypisy = dok.getElementsByTagNameNS(NS_TEXT, 'note').length;
  const zbierz = (wezel, a, f) => {
    for (const c of wezel.childNodes) {
      if (c.nodeType === 3) dopisz(a, c.textContent, f);
      else if (c.namespaceURI === NS_TEXT) {
        if (c.localName === 'span') zbierz(c, a, { ...f, ...(wyglad.get(c.getAttributeNS(NS_TEXT, 'style-name')) || {}) });
        else if (c.localName === 's') dopisz(a, ' '.repeat(Number(c.getAttributeNS(NS_TEXT, 'c')) || 1), f);
        else if (c.localName === 'tab') dopisz(a, '\t', f);
        else if (c.localName === 'line-break') dopisz(a, ' ', f);
        else if (c.localName === 'a') zbierz(c, a, f);
      }
    }
  };
  const tekst = dok.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'text')[0];
  const przejdz = (wezel) => {
    for (const el of wezel.children) {
      if (el.namespaceURI !== NS_TEXT) continue;
      if (el.localName === 'p' || el.localName === 'h') {
        const a = { tekst: '', poziom: el.localName === 'h' ? Math.min(3, Number(el.getAttributeNS(NS_TEXT, 'outline-level')) || 1) : 0, fragmenty: [] };
        zbierz(el, a, wyglad.get(el.getAttributeNS(NS_TEXT, 'style-name')) || {});
        wynik.akapity.push(a);
      } else if (['list', 'list-item', 'section'].includes(el.localName)) przejdz(el);
    }
  };
  if (tekst) przejdz(tekst);
  return wynik;
}

// ---------- Markdown i zwykły tekst ----------

export function czytajMarkdown(tekst) {
  const wynik = pusteWyniki();
  for (const linia of String(tekst).replace(/\r\n?/g, '\n').split(/\n{2,}|\n(?=#)/)) {
    const wiersz = linia.replace(/\n/g, ' ').trim();
    if (!wiersz) continue;
    const h = wiersz.match(/^(#{1,6})\s+(.*)$/);
    const a = { tekst: '', poziom: h ? Math.min(3, h[1].length) : 0, fragmenty: [] };
    let reszta = (h ? h[2] : wiersz).replace(/^[-*+]\s+/, '• ');
    if (/!\[[^\]]*\]\([^)]*\)/.test(reszta)) { wynik.pominiete.obrazy += 1; reszta = reszta.replace(/!\[[^\]]*\]\([^)]*\)/g, ''); }
    reszta = reszta.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    const wzor = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g;
    let poz = 0;
    for (const m of reszta.matchAll(wzor)) {
      dopisz(a, reszta.slice(poz, m.index));
      if (m[2] !== undefined) dopisz(a, m[2], { b: true }); else dopisz(a, m[4], { i: true });
      poz = m.index + m[0].length;
    }
    dopisz(a, reszta.slice(poz));
    wynik.akapity.push(a);
  }
  return wynik;
}

export function czytajTxt(tekst) {
  const wynik = pusteWyniki();
  for (const a of String(tekst).replace(/\r\n?/g, '\n').split(/\n\s*\n|\n/)) {
    const t = a.trim();
    if (t) wynik.akapity.push({ tekst: t, poziom: 0, fragmenty: [] });
  }
  return wynik;
}

// Plik (File/Blob z nazwą) → wynik; JSZip – konstruktor JSZip (doczytany przez aplikację).
export async function czytajPlikTekstu(plik, JSZip) {
  const nazwa = (plik.name || '').toLowerCase();
  if (nazwa.endsWith('.docx')) return czytajDocx(await JSZip.loadAsync(await plik.arrayBuffer()));
  if (nazwa.endsWith('.odt')) return czytajOdt(await JSZip.loadAsync(await plik.arrayBuffer()));
  if (nazwa.endsWith('.md') || nazwa.endsWith('.markdown')) return czytajMarkdown(await plik.text());
  if (nazwa.endsWith('.txt')) return czytajTxt(await plik.text());
  throw new Error('Obsługiwane pliki tekstu: Word (.docx), LibreOffice (.odt), Markdown (.md) i zwykły tekst (.txt).');
}

// Akapity → tekst ramki i style fragmentów (indeksy bez znaków nowej linii, jak w Fabric). Nagłówki: większe
// i pogrubione; nagłówek 1 (rozdział) – od nowej strony, gdy rozdzialyOdNowej.
export function tekstDoRamki(wynik, { rozmiar = 4, rozdzialyOdNowej = true } = {}) {
  const akapity = wynik.akapity.filter((a) => a.tekst.trim() || a.poziom);
  const SKALA = { 1: 1.8, 2: 1.4, 3: 1.2 };
  let text = '';
  const styles = [];
  let indeks = 0; // bez nowych linii
  akapity.forEach((a, n) => {
    if (n) text += '\n';
    const start = indeks;
    text += a.tekst;
    if (a.poziom) {
      const st = { fontWeight: 'bold', fontSize: Math.round(rozmiar * SKALA[a.poziom] * 100) / 100 };
      if (a.tekst.length) styles.push({ start, end: start + a.tekst.length, style: st });
      if (a.poziom === 1 && rozdzialyOdNowej && n > 0 && a.tekst.length) styles.push({ start, end: start + 1, style: { ...st, nowa_strona: true, deltaY: 0 } });
    }
    for (const f of a.fragmenty) {
      const st = { ...(f.b ? { fontWeight: 'bold' } : {}), ...(f.i ? { fontStyle: 'italic' } : {}), ...(f.u ? { underline: true } : {}) };
      styles.push({ start: start + f.od, end: start + f.do, style: st });
    }
    indeks += a.tekst.length;
  });
  // Nakładające się style (nagłówek + znacznik) – rozdzielone na pojedyncze znaki tam, gdzie się pokrywają.
  const naZnak = new Map();
  for (const s of styles) for (let i = s.start; i < s.end; i += 1) naZnak.set(i, { ...(naZnak.get(i) || {}), ...s.style });
  const scalone = [];
  for (const [i, st] of [...naZnak].sort((x, y) => x[0] - y[0])) {
    const ost = scalone.at(-1);
    if (ost && ost.end === i && JSON.stringify(ost.style) === JSON.stringify(st)) ost.end += 1;
    else scalone.push({ start: i, end: i + 1, style: st });
  }
  return { text, styles: scalone, akapitow: akapity.length, rozdzialow: akapity.filter((a) => a.poziom === 1).length };
}
