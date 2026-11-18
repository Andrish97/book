// Zapis z układem stron dla programów biurowych i graficznych (#228):
//   DOCX z układem – Word (i dawny Publisher): każda strona projektu to strona dokumentu, elementy na swoich miejscach
//     jako obiekty zakotwiczone do strony: ramki tekstowe (DrawingML wps, tekst z czcionką, wielkością, kolorem,
//     pogrubieniem, kursywą, podkreśleniem, wyrównaniem i interlinią), obrazy i kształty z kolorami; reszta (tabele,
//     kalendarze, grupy, gradienty, cienie) – jako obraz. Z polami scalania (seria dla Worda, #226) znaczniki «pole»
//     stają się polami MERGEFIELD – korespondencja seryjna w Wordzie zachowuje układ strony.
//   SVG stron – Inkscape, Illustrator, Corel, Affinity: każda strona jako plik SVG w milimetrach, w ZIP-ie.
// Geometria, podział na tekst / kształt / obraz – wspólny z zapisem dla Scribusa i InDesigna (js/scribus.js).

/* global fabric */
import { zlozCel } from './zlozenie.js';
import { rozwin } from './serie.js';
import { plytaUszlachetnienia } from './kolory-druku.js';
import { hex, ramka, zwyklyKolor, bezEfektow, obrazElementu, czcionkaElementu } from './scribus.js';

const EMU = 36000; // na mm
const TWIP = 1440 / 25.4; // na mm
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const emu = (mm) => Math.round(mm * EMU);
const kolorHex = (k) => (hex(k)?.hex || '#000000').slice(1).toUpperCase();
const JC = { left: 'left', center: 'center', right: 'right', justify: 'both', 'justify-left': 'both', 'justify-center': 'both', 'justify-right': 'both' };

// ---------- DOCX z układem ----------

// Run Worda z wyglądem znaku.
function run(tekst, s, skala) {
  const { rodzina, odmiana } = czcionkaElementu(s.fontFamily, s.fontWeight, s.fontStyle);
  const pt = (s.fontSize || 4) * skala * (72 / 25.4);
  const rPr = `<w:rPr><w:rFonts w:ascii="${xml(rodzina)}" w:hAnsi="${xml(rodzina)}" w:cs="${xml(rodzina)}"/>${/Bold/.test(odmiana) ? '<w:b/>' : ''}${/Italic/.test(odmiana) ? '<w:i/>' : ''}${s.underline ? '<w:u w:val="single"/>' : ''}${s.linethrough ? '<w:strike/>' : ''}<w:color w:val="${kolorHex(typeof s.fill === 'string' ? s.fill : '#000000')}"/><w:sz w:val="${Math.round(pt * 2)}"/><w:szCs w:val="${Math.round(pt * 2)}"/></w:rPr>`;
  return { rPr, xml: tekst.split('\t').map((cz, i) => `${i ? `<w:r>${rPr}<w:tab/></w:r>` : ''}${cz ? `<w:r>${rPr}<w:t xml:space="preserve">${xml(cz)}</w:t></w:r>` : ''}`).join('') };
}

// Akapity ramki tekstowej (live Fabric Textbox) z polami scalania («pole» → MERGEFIELD).
function akapityRamki(o, skala, pola) {
  const tekst = String(o.text ?? '');
  const jc = JC[o.textAlign] || 'left';
  const linia = Math.round(240 * (o.lineHeight || 1.16) * (o._fontSizeMult || 1.13) / 1.15); // „wielokrotne” względem Worda
  const pPr = `<w:pPr><w:spacing w:before="0" w:after="0" w:line="${linia}" w:lineRule="auto"/><w:jc w:val="${jc}"/></w:pPr>`;
  const wynik = [];
  let i = 0;
  for (const akapit of tekst.split('\n')) {
    let runy = '';
    let bufor = '';
    let poprzedni = null;
    let rPrOst = '';
    const wypisz = () => { if (bufor) { const r = run(bufor, poprzedni, skala); runy += r.xml; rPrOst = r.rPr; } bufor = ''; };
    for (let k = 0; k < akapit.length; k += 1, i += 1) {
      const s = o.getStyleAtPosition ? { ...o, ...o.getStyleAtPosition(i, true) } : o;
      const st = { fontFamily: s.fontFamily, fontWeight: s.fontWeight, fontStyle: s.fontStyle, fontSize: s.fontSize, fill: s.fill, underline: s.underline, linethrough: s.linethrough };
      if (poprzedni && JSON.stringify(st) !== JSON.stringify(poprzedni)) wypisz();
      poprzedni = st;
      bufor += akapit[k];
    }
    wypisz();
    i += 1; // znak nowej linii
    if (pola?.size) {
      runy = runy.replace(/<w:r>(<w:rPr>(?:(?!<\/w:rPr>).)*<\/w:rPr>)<w:t xml:space="preserve">([^<]*)<\/w:t><\/w:r>/g, (cale, rPr, t) => {
        if (!t.includes('«')) return cale;
        return t.split(/(«[^«»]+»)/).map((cz) => {
          const n = cz.startsWith('«') ? cz.slice(1, -1) : null;
          if (n && pola.has(n)) return `<w:fldSimple w:instr=" MERGEFIELD &quot;${xml(n)}&quot; "><w:r>${rPr}<w:t>${xml(cz)}</w:t></w:r></w:fldSimple>`;
          return cz ? `<w:r>${rPr}<w:t xml:space="preserve">${cz}</w:t></w:r>` : '';
        }).join('');
      });
    }
    wynik.push(`<w:p>${pPr}${runy || (rPrOst ? `<w:r>${rPrOst}</w:r>` : '')}</w:p>`);
  }
  return wynik.join('');
}

function kotwica({ id, x, y, w, h, kat = 0, graphic, nazwa = '' }) {
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${id}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${emu(x)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${emu(y)}</wp:posOffset></wp:positionV><wp:extent cx="${emu(w)}" cy="${emu(h)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="${xml(nazwa || `Element ${id}`)}"/><wp:cNvGraphicFramePr/><a:graphic>${graphic(kat ? ` rot="${Math.round(kat * 60000)}"` : '')}</a:graphic></wp:anchor></w:drawing></w:r>`;
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14"';

export async function zapiszDocxUklad(projekt, JSZip, { ciag = rozwin(projekt), egzemplarze = null, polaScalania = null, postep } = {}) {
  const zip = new JSZip();
  const egz = egzemplarze || ciag.egzemplarze;
  const obrazy = []; // { rid, plik, blob }
  let id = 1;
  const strony = [];
  const ile = { teksty: 0, ksztalty: 0, obrazy: 0 };
  let pierwszy = null;
  for (let n = 0; n < egz.length; n += 1) {
    postep?.(n, egz.length);
    const { wydruk, tlo, obiekty } = await zlozCel(projekt, egz[n], { ciag, oryginaly: true, bezPodloza: true });
    pierwszy ||= wydruk;
    const elementy = [];
    const t = hex(typeof tlo === 'string' ? tlo : null);
    if (t && t.hex !== '#ffffff') {
      const nid = id++;
      elementy.push(kotwica({ id: nid, x: 0, y: 0, w: wydruk.szerokosc_mm, h: wydruk.wysokosc_mm, nazwa: 'Tło strony', graphic: (rot) => `<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm${rot}><a:off x="0" y="0"/><a:ext cx="${emu(wydruk.szerokosc_mm)}" cy="${emu(wydruk.wysokosc_mm)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${t.hex.slice(1).toUpperCase()}"/></a:solidFill><a:ln><a:noFill/></a:ln></wps:spPr><wps:bodyPr/></wps:wsp></a:graphicData>` }));
    }
    for (const o of obiekty) {
      if (o.visible === false || plytaUszlachetnienia(o)?.techniczna) continue;
      const typ = String(o.type).toLowerCase();
      const r = ramka(o);
      const nid = id++;
      if (r && typ === 'textbox' && !o.tabela && bezEfektow(o) && zwyklyKolor(o.fill)) {
        // Lewy górny róg obróconej ramki → położenie nieobróconej (Word obraca wokół środka).
        const k = (r.kat * Math.PI) / 180;
        const cx = r.x + (r.w / 2) * Math.cos(k) - (r.h / 2) * Math.sin(k);
        const cy = r.y + (r.w / 2) * Math.sin(k) + (r.h / 2) * Math.cos(k);
        const tloRamki = hex(o.backgroundColor);
        elementy.push(kotwica({ id: nid, x: cx - r.w / 2, y: cy - r.h / 2, w: r.w, h: r.h, kat: r.kat, nazwa: (o.text || 'Tekst').slice(0, 40), graphic: (rot) => `<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm${rot}><a:off x="0" y="0"/><a:ext cx="${emu(r.w)}" cy="${emu(r.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${tloRamki ? `<a:solidFill><a:srgbClr val="${tloRamki.hex.slice(1).toUpperCase()}"/></a:solidFill>` : '<a:noFill/>'}<a:ln><a:noFill/></a:ln></wps:spPr><wps:txbx><w:txbxContent>${akapityRamki(o, r.sy, polaScalania)}</w:txbxContent></wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" anchorCtr="0"><a:noAutofit/></wps:bodyPr></wps:wsp></a:graphicData>` }));
        ile.teksty += 1;
        continue;
      }
      const prosty = r && ['rect', 'ellipse', 'circle'].includes(typ) && bezEfektow(o) && zwyklyKolor(o.fill) && zwyklyKolor(o.stroke) && !(typ === 'rect' && o.rx);
      if (prosty) {
        const k = (r.kat * Math.PI) / 180;
        const cx = r.x + (r.w / 2) * Math.cos(k) - (r.h / 2) * Math.sin(k);
        const cy = r.y + (r.w / 2) * Math.sin(k) + (r.h / 2) * Math.cos(k);
        const wyp = hex(o.fill);
        const obr = o.stroke && o.strokeWidth > 0 ? hex(o.stroke) : null;
        const grub = obr ? emu(o.strokeWidth * (o.strokeUniform ? 1 : Math.max(r.sx, r.sy))) : 0;
        elementy.push(kotwica({ id: nid, x: cx - r.w / 2, y: cy - r.h / 2, w: r.w, h: r.h, kat: r.kat, nazwa: o.nazwa || typ, graphic: (rot) => `<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm${rot}><a:off x="0" y="0"/><a:ext cx="${emu(r.w)}" cy="${emu(r.h)}"/></a:xfrm><a:prstGeom prst="${typ === 'rect' ? 'rect' : 'ellipse'}"><a:avLst/></a:prstGeom>${wyp ? `<a:solidFill><a:srgbClr val="${wyp.hex.slice(1).toUpperCase()}"/></a:solidFill>` : '<a:noFill/>'}${obr ? `<a:ln w="${grub}"><a:solidFill><a:srgbClr val="${obr.hex.slice(1).toUpperCase()}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>'}</wps:spPr><wps:bodyPr/></wps:wsp></a:graphicData>` }));
        ile.ksztalty += 1;
        continue;
      }
      const obraz = await obrazElementu(o);
      if (!obraz) continue;
      const rid = `rIdObr${obrazy.length + 1}`;
      obrazy.push({ rid, plik: `media/obraz${obrazy.length + 1}.png`, blob: obraz.blob });
      elementy.push(kotwica({ id: nid, x: obraz.x, y: obraz.y, w: obraz.w, h: obraz.h, nazwa: o.nazwa || typ, graphic: () => `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${nid}" name="obraz${nid}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(obraz.w)}" cy="${emu(obraz.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData>` }));
      ile.obrazy += 1;
    }
    strony.push({ wydruk, elementy });
  }
  postep?.(egz.length, egz.length);
  // Strona = akapit z kotwicami; między stronami – sekcja z jej formatem (różne formaty sekcji projektu).
  const sekcja = (w) => `<w:sectPr><w:pgSz w:w="${Math.round(w.szerokosc_mm * TWIP)}" w:h="${Math.round(w.wysokosc_mm * TWIP)}"${w.szerokosc_mm > w.wysokosc_mm ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
  const body = strony.map((s, i) => {
    const ost = i === strony.length - 1;
    const akapit = `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${ost ? '' : sekcja(s.wydruk).replace('<w:sectPr>', '<w:sectPr><w:type w:val="nextPage"/>')}</w:pPr>${s.elementy.join('')}</w:p>`;
    return akapit;
  }).join('');
  const ostatni = strony.at(-1)?.wydruk || pierwszy || { szerokosc_mm: 210, wysokosc_mm: 297 };
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyle" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${obrazy.map((o) => `<Relationship Id="${o.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${o.plik}"/>`).join('')}</Relationships>`);
  zip.file('word/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:lang w:val="pl-PL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>');
  for (const o of obrazy) zip.file(`word/${o.plik}`, o.blob);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sekcja(ostatni)}</w:body></w:document>`);
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return { blob, ile, stron: egz.length };
}

// ---------- SVG stron ----------

export async function zapiszSvgStron(projekt, JSZip, { ciag = rozwin(projekt), postep } = {}) {
  const zip = new JSZip();
  const egz = ciag.egzemplarze;
  const cyfry = String(egz.length).length;
  for (let n = 0; n < egz.length; n += 1) {
    postep?.(n, egz.length);
    const { wydruk, tlo, obiekty } = await zlozCel(projekt, egz[n], { ciag, oryginaly: true, bezPodloza: true });
    const w = wydruk.szerokosc_mm;
    const h = wydruk.wysokosc_mm;
    const plotno = new fabric.StaticCanvas(undefined, { width: w, height: h, renderOnAddRemove: false, enableRetinaScaling: false, backgroundColor: typeof tlo === 'string' ? tlo : '#ffffff' });
    try {
      for (const o of obiekty) if (o.visible !== false && !plytaUszlachetnienia(o)?.techniczna) plotno.add(o);
      zip.file(`strona-${String(n + 1).padStart(cyfry, '0')}.svg`, plotno.toSVG({ width: `${w}mm`, height: `${h}mm`, viewBox: { x: 0, y: 0, width: w, height: h } }));
    } finally {
      plotno.dispose();
    }
  }
  postep?.(egz.length, egz.length);
  return { blob: await zip.generateAsync({ type: 'blob' }), stron: egz.length };
}
