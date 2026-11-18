// Zapis tekstu projektu dla innych programów (#216): Word (.docx) i e-book (EPUB 3). Tekst wszystkich stron
// w kolejności druku (strony środka, bez okładki), ramki na stronie w kolejności czytania, tekst płynący przez
// ramki – raz, w całości. Nagłówki: teksty ze stylami nagłówków książki (spis treści) i akapity z większym,
// pogrubionym pismem (np. z importu); pogrubienia, kursywy i podkreślenia fragmentów zostają. Obrazy i układ
// strony zostają w Makietce – to przenosi treść, nie skład.

import { rozwin } from './serie.js';
import { naglowkiProjektu } from './ksiazka.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);

// Style fragmentów zapisane w projekcie: tablica { start, end, style } albo obiekt Fabric { linia: { znak: styl } }.
function stylePoZnakach(o) {
  const text = o.text || '';
  const wynik = new Array(text.replace(/\n/g, '').length).fill(null);
  if (Array.isArray(o.styles)) {
    for (const s of o.styles) for (let i = s.start; i < s.end && i < wynik.length; i += 1) wynik[i] = { ...(wynik[i] || {}), ...s.style };
  } else if (o.styles && typeof o.styles === 'object') {
    const linie = text.split('\n');
    let baza = 0;
    linie.forEach((l, nr) => {
      for (const [z, st] of Object.entries(o.styles[nr] || {})) if (baza + Number(z) < wynik.length) wynik[baza + Number(z)] = st;
      baza += l.length;
    });
  }
  return wynik;
}

// Akapity projektu: [{ poziom: 0–3, fragmenty: [{ t, b, i, u }] }].
export function akapityProjektu(projekt, ciag = rozwin(projekt)) {
  const poziomStylu = new Map(naglowkiProjektu(projekt).map((n) => [n.styl, n.poziom]));
  const akapity = [];
  const widziane = new Set();
  const strony = [];
  for (const e of ciag.egzemplarze) if (!e.pusta && !e.sekcja.okladka && !strony.includes(e.strona)) strony.push(e.strona);
  // Wątek: tekst całości z jego ramek (po kolei), raz – przy pierwszej ramce.
  const watek = new Map();
  for (const s of projekt.strony) for (const o of s.obiekty || []) if (o.type === 'textbox' && o.watek) {
    if (!watek.has(o.watek)) watek.set(o.watek, []);
    watek.get(o.watek).push(o);
  }
  for (const ramki of watek.values()) ramki.sort((a, b) => (a.watek_nr || 0) - (b.watek_nr || 0));
  for (const strona of strony) {
    const teksty = (strona.obiekty || []).filter((o) => o.type === 'textbox' && (o.text || '').trim() && !o.ksiazka && !o.pole)
      .sort((a, b) => (Math.abs(a.top - b.top) > 5 ? a.top - b.top : a.left - b.left));
    for (const o of teksty) {
      if (o.watek && widziane.has(o.watek)) continue;
      const ramki = o.watek ? watek.get(o.watek) : [o];
      if (o.watek) widziane.add(o.watek);
      const poziomRamki = poziomStylu.get(o.styl) || 0;
      const bazowy = o.fontSize || 4;
      for (const r of ramki) {
        const style = stylePoZnakach(r);
        const text = r.text || '';
        let idx = 0;
        text.split('\n').forEach((linia, nrLinii) => {
          // Ciąg dalszy akapitu z poprzedniej ramki (łącznik inny niż nowa linia) – dopisany do ostatniego.
          const ciagDalszy = nrLinii === 0 && r !== ramki[0] && r.lacznik !== undefined && r.lacznik !== '\n';
          const fr = [];
          for (let i = 0; i < linia.length; i += 1) {
            const st = style[idx + i] || {};
            const f = { b: st.fontWeight === 'bold' || (!st.fontWeight && r.fontWeight === 'bold'), i: (st.fontStyle || r.fontStyle) === 'italic', u: Boolean(st.underline ?? r.underline) };
            const ost = fr.at(-1);
            if (ost && ost.b === f.b && ost.i === f.i && ost.u === f.u) ost.t += linia[i]; else fr.push({ t: linia[i], ...f });
          }
          idx += linia.length;
          if (ciagDalszy && akapity.length) { akapity.at(-1).fragmenty.push(...(r.lacznik ? [{ t: r.lacznik, b: false, i: false, u: false }] : []), ...fr); return; }
          if (!linia.trim()) return;
          // Nagłówek z wyglądu (import): cały akapit pogrubiony i większy niż tekst ramki.
          const pierwszy = style[idx - linia.length] || {};
          const wiekszy = (pierwszy.fontSize || bazowy) / bazowy;
          const caly = fr.every((x) => x.b);
          const poziom = poziomRamki || (caly && wiekszy >= 1.6 ? 1 : caly && wiekszy >= 1.3 ? 2 : caly && wiekszy >= 1.15 ? 3 : 0);
          akapity.push({ poziom, fragmenty: poziom ? fr.map((x) => ({ ...x, b: false })) : fr });
        });
      }
    }
  }
  return akapity;
}

// ---------- DOCX ----------

const runDocx = (f) => `<w:r>${f.b || f.i || f.u ? `<w:rPr>${f.b ? '<w:b/>' : ''}${f.i ? '<w:i/>' : ''}${f.u ? '<w:u w:val="single"/>' : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(f.t.replace(/\t/g, ' '))}</w:t></w:r>`;

export async function zapiszDocx(projekt, JSZip, akapity = akapityProjektu(projekt)) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  const naglowek = (n, rozmiar) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${rozmiar}"/></w:rPr></w:style>`;
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:style>${naglowek(1, 36)}${naglowek(2, 28)}${naglowek(3, 24)}</w:styles>`);
  const body = akapity.map((a) => `<w:p>${a.poziom ? `<w:pPr><w:pStyle w:val="Heading${a.poziom}"/>${a.poziom === 1 ? '<w:pageBreakBefore/>' : ''}</w:pPr>` : ''}${a.fragmenty.map(runDocx).join('')}</w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ---------- EPUB 3 ----------

const inline = (f) => { let t = esc(f.t); if (f.u) t = `<u>${t}</u>`; if (f.i) t = `<em>${t}</em>`; if (f.b) t = `<strong>${t}</strong>`; return t; };

export async function zapiszEpub(projekt, JSZip, akapity = akapityProjektu(projekt), { jezyk = 'pl' } = {}) {
  // Rozdziały: nowy plik przy każdym nagłówku poziomu 1 (albo jeden, gdy ich nie ma).
  const rozdzialy = [];
  for (const a of akapity) {
    if (a.poziom === 1 || !rozdzialy.length) rozdzialy.push({ tytul: a.poziom === 1 ? a.fragmenty.map((f) => f.t).join('') : projekt.nazwa, akapity: [] });
    rozdzialy.at(-1).akapity.push(a);
  }
  const id = `urn:uuid:${projekt.id || crypto.randomUUID()}`;
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const xhtml = (tytul, tresc) => `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${jezyk}" lang="${jezyk}"><head><meta charset="UTF-8"/><title>${esc(tytul)}</title><link rel="stylesheet" href="styl.css"/></head><body>${tresc}</body></html>`;
  rozdzialy.forEach((r, i) => {
    const tresc = r.akapity.map((a) => (a.poziom ? `<h${a.poziom}>${a.fragmenty.map(inline).join('')}</h${a.poziom}>` : `<p>${a.fragmenty.map(inline).join('')}</p>`)).join('\n');
    zip.file(`OEBPS/r${i + 1}.xhtml`, xhtml(r.tytul, tresc));
  });
  zip.file('OEBPS/styl.css', 'body{font-family:serif;line-height:1.45}h1,h2,h3{font-family:sans-serif;line-height:1.2}p{margin:0;text-indent:1.2em;text-align:justify}h1+p,h2+p,h3+p{text-indent:0}');
  zip.file('OEBPS/spis.xhtml', xhtml('Spis treści', `<nav epub:type="toc" id="toc"><h1>Spis treści</h1><ol>${rozdzialy.map((r, i) => `<li><a href="r${i + 1}.xhtml">${esc(r.tytul)}</a></li>`).join('')}</ol></nav>`));
  const teraz = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">${id}</dc:identifier><dc:title>${esc(projekt.nazwa)}</dc:title><dc:language>${jezyk}</dc:language><meta property="dcterms:modified">${teraz}</meta></metadata><manifest><item id="spis" href="spis.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="styl" href="styl.css" media-type="text/css"/>${rozdzialy.map((_, i) => `<item id="r${i + 1}" href="r${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${rozdzialy.map((_, i) => `<itemref idref="r${i + 1}"/>`).join('')}</spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}
