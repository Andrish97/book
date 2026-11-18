// Zapis do InDesigna (#221): pakiet IDML (InDesign Markup Language – ZIP z XML), który otwiera InDesign CS4
// i nowsze, a także Affinity Publisher, QuarkXPress i Scribus (import IDML). Te same zasady co zapis dla
// Scribusa (#220, js/scribus.js): strony w kolejności druku, teksty jako ramki tekstowe z historią (Story)
// i formatowaniem fragmentów, proste kształty jako wektory z kolorami, reszta jako obrazy osadzone w pakiecie
// (Image/Properties/Contents w base64). Każda strona to osobna rozkładówka z jedną stroną (bez stron
// sąsiednich) – początek układu rozkładówki w środku strony, tak jak zapisuje InDesign.

import { zlozCel } from './zlozenie.js';
import { rozwin } from './serie.js';
import { plytaUszlachetnienia } from './kolory-druku.js';
import { PT, hex, ramka, sciezkaKsztaltu, TYPY_KSZTALTOW, zwyklyKolor, bezEfektow, obrazElementu, czcionkaElementu, zapasRamki } from './scribus.js';

const NS = 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging';
const DOM = '8.0';
const naglowek = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const liczba = (x) => String(Math.round(x * 1000) / 1000);
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const atrybuty = (a) => Object.entries(a).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}="${xml(typeof v === 'number' ? liczba(v) : v)}"`).join(' ');

// Nazwa PostScript czcionki – po niej InDesign i Scribus szukają czcionki w systemie. Dla popularnych czcionek
// systemowych nazwy są nietypowe; reszta (m.in. czcionki Google, w tym czcionki Makietki) – „Rodzina-Odmiana”.
const PS_WYJATKI = {
  'DejaVu Sans': { Book: 'DejaVuSans', Bold: 'DejaVuSans-Bold', Oblique: 'DejaVuSans-Oblique', 'Bold Oblique': 'DejaVuSans-BoldOblique' },
  'DejaVu Serif': { Book: 'DejaVuSerif', Bold: 'DejaVuSerif-Bold', Italic: 'DejaVuSerif-Italic', 'Bold Italic': 'DejaVuSerif-BoldItalic' },
  Arial: { Regular: 'ArialMT', Bold: 'Arial-BoldMT', Italic: 'Arial-ItalicMT', 'Bold Italic': 'Arial-BoldItalicMT' },
  'Times New Roman': { Regular: 'TimesNewRomanPSMT', Bold: 'TimesNewRomanPS-BoldMT', Italic: 'TimesNewRomanPS-ItalicMT', 'Bold Italic': 'TimesNewRomanPS-BoldItalicMT' },
  'Liberation Sans': { Regular: 'LiberationSans', Bold: 'LiberationSans-Bold', Italic: 'LiberationSans-Italic', 'Bold Italic': 'LiberationSans-BoldItalic' },
  'Liberation Serif': { Regular: 'LiberationSerif', Bold: 'LiberationSerif-Bold', Italic: 'LiberationSerif-Italic', 'Bold Italic': 'LiberationSerif-BoldItalic' },
  Helvetica: { Regular: 'Helvetica', Bold: 'Helvetica-Bold', Oblique: 'Helvetica-Oblique', 'Bold Oblique': 'Helvetica-BoldOblique' },
  'Courier New': { Regular: 'CourierNewPSMT', Bold: 'CourierNewPS-BoldMT', Italic: 'CourierNewPS-ItalicMT', 'Bold Italic': 'CourierNewPS-BoldItalicMT' },
};
export const nazwaPostScript = (r, o) => PS_WYJATKI[r]?.[o] || `${r.replace(/\s+/g, '')}-${o.replace(/\s+/g, '')}`;

const JUSTOWANIE = { left: 'LeftAlign', center: 'CenterAlign', right: 'RightAlign', justify: 'LeftJustified', 'justify-left': 'LeftJustified', 'justify-center': 'CenterJustified', 'justify-right': 'RightJustified' };

class Kolory {
  constructor() { this.mapa = new Map(); }
  nazwa(kolor) {
    const h = hex(kolor);
    if (!h) return 'Swatch/None';
    this.mapa.set(h.hex, h);
    return `Color/Makietka ${h.hex}`;
  }
  xml() {
    return [...this.mapa.values()].map((h) => `\t<Color ${atrybuty({ Self: `Color/Makietka ${h.hex}`, Model: 'Process', Space: 'RGB', ColorValue: `${h.r} ${h.g} ${h.b}`, ColorOverride: 'Normal', AlternateSpace: 'NoAlternateColor', AlternateColorValue: '', Name: `Makietka ${h.hex}`, ColorEditable: 'true', ColorRemovable: 'true', Visible: 'true', SwatchCreatorID: '7937' })}/>`).join('\n');
  }
}

// Ścieżka (M/L/C/Q/Z w liczbach bezwzględnych, z sciezkaKsztaltu) → kontury IDML: punkty z kierunkami.
function konturyIdml(sciezka) {
  const t = sciezka.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  const kontury = [];
  let biezacy = null;
  let i = 0;
  const num = () => Number(t[i++]);
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') { biezacy = { otwarty: true, punkty: [] }; kontury.push(biezacy); const a = [num(), num()]; biezacy.punkty.push({ a, l: a, r: a }); }
    else if (c === 'L') { const a = [num(), num()]; biezacy.punkty.push({ a, l: a, r: a }); }
    else if (c === 'C' || c === 'Q') {
      const ost = biezacy.punkty[biezacy.punkty.length - 1];
      let c1;
      let c2;
      let a;
      if (c === 'C') { c1 = [num(), num()]; c2 = [num(), num()]; a = [num(), num()]; }
      else {
        const q = [num(), num()]; a = [num(), num()];
        c1 = [ost.a[0] + (2 / 3) * (q[0] - ost.a[0]), ost.a[1] + (2 / 3) * (q[1] - ost.a[1])];
        c2 = [a[0] + (2 / 3) * (q[0] - a[0]), a[1] + (2 / 3) * (q[1] - a[1])];
      }
      ost.r = c1;
      biezacy.punkty.push({ a, l: c2, r: a });
    } else if (c === 'Z' || c === 'z') {
      if (!biezacy) continue;
      biezacy.otwarty = false;
      const p = biezacy.punkty;
      const [pierwszy, ost] = [p[0], p[p.length - 1]];
      if (p.length > 1 && Math.abs(pierwszy.a[0] - ost.a[0]) < 0.001 && Math.abs(pierwszy.a[1] - ost.a[1]) < 0.001) { pierwszy.l = ost.l; p.pop(); }
    }
  }
  return kontury.filter((k) => k.punkty.length);
}

const geometria = (kontury) => `<PathGeometry>${kontury.map((k) => `<GeometryPathType PathOpen="${k.otwarty}"><PathPointArray>${k.punkty.map((p) => `<PathPointType Anchor="${liczba(p.a[0])} ${liczba(p.a[1])}" LeftDirection="${liczba(p.l[0])} ${liczba(p.l[1])}" RightDirection="${liczba(p.r[0])} ${liczba(p.r[1])}"/>`).join('')}</PathPointArray></GeometryPathType>`).join('')}</PathGeometry>`;
const prostokat = (w, h) => konturyIdml(`M0 0 L0 ${h} L${w} ${h} L${w} 0 Z`);

// Macierz: obrót wokół lewego górnego rogu i przesunięcie do (x, y) w układzie rozkładówki (pt).
function macierz(kat, x, y) {
  const r = (kat * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, x, y].map((v) => liczba(Math.abs(v) < 1e-9 ? 0 : v)).join(' ');
}

function historia(id, o, r, kolory, czcionki) {
  const tekst = String(o.text ?? '');
  const skala = r.sy;
  const akapity = [];
  let poczatek = 0;
  for (const kawalek of tekst.split('\n')) { akapity.push([poczatek, kawalek]); poczatek += kawalek.length + 1; }
  const just = JUSTOWANIE[o.textAlign] || 'LeftAlign';
  const interlinia = (o.fontSize || 4) * skala * PT * (o.lineHeight || 1.16) * (o._fontSizeMult || 1.13);
  const czesci = akapity.map(([start, kawalek], n) => {
    const zakresy = [];
    let bufor = '';
    let poprzedni = null;
    const wypisz = () => { if (bufor) zakresy.push(`<CharacterStyleRange ${poprzedni.atr}><Properties><AppliedFont type="string">${xml(poprzedni.rodzina)}</AppliedFont><Leading type="unit">${liczba(interlinia)}</Leading></Properties><Content>${xml(bufor)}</Content></CharacterStyleRange>`); bufor = ''; };
    for (let i = 0; i < kawalek.length; i++) {
      const s = o.getStyleAtPosition ? o.getStyleAtPosition(start + i, true) : o;
      const { rodzina, odmiana } = czcionkaElementu(s.fontFamily ?? o.fontFamily, s.fontWeight ?? o.fontWeight, s.fontStyle ?? o.fontStyle);
      czcionki.add(`${rodzina}\u0000${odmiana}`);
      const atr = atrybuty({
        AppliedCharacterStyle: 'CharacterStyle/$ID/[No character style]',
        FontStyle: odmiana,
        PointSize: (s.fontSize ?? o.fontSize) * skala * PT,
        FillColor: kolory.nazwa(typeof (s.fill ?? o.fill) === 'string' ? (s.fill ?? o.fill) : '#000000'),
        Tracking: s.charSpacing ?? o.charSpacing ?? 0,
        Underline: (s.underline ?? o.underline) ? 'true' : undefined,
        StrikeThru: (s.linethrough ?? o.linethrough) ? 'true' : undefined,
      });
      const klucz = `${atr}|${rodzina}`;
      if (klucz !== poprzedni?.klucz) { wypisz(); poprzedni = { klucz, atr, rodzina }; }
      bufor += kawalek[i];
    }
    wypisz();
    if (!zakresy.length) zakresy.push('<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"/>');
    const br = n < akapity.length - 1 ? '<Br/>' : '';
    return `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle" Justification="${just}">${zakresy.join('')}${br}</ParagraphStyleRange>`;
  });
  return `${naglowek}<idPkg:Story xmlns:idPkg="${NS}" DOMVersion="${DOM}"><Story Self="${id}" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n"><StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/>${czesci.join('')}</Story></idPkg:Story>`;
}

// Base64 pliku (Blob) – w kawałkach, żeby duże obrazy nie przepełniły stosu.
async function base64(blob) {
  const b = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function zapiszIdml(projekt, JSZip, { ciag = rozwin(projekt), egzemplarze = null, postep } = {}) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.adobe.indesign-idml-package', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `${naglowek}<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="designmap.xml" media-type="text/xml"/></rootfiles></container>`);
  const kolory = new Kolory();
  const czcionki = new Set();
  const egz = egzemplarze || ciag.egzemplarze;
  const rozkladowki = [];
  const historie = [];
  const ile = { teksty: 0, ksztalty: 0, obrazy: 0 };
  let nr = 0;
  const nowyId = (p) => `${p}${(nr++).toString(36)}`;
  let pierwszy = null;

  for (let n = 0; n < egz.length; n++) {
    postep?.(n, egz.length);
    const e = egz[n];
    const { wydruk, tlo, obiekty } = await zlozCel(projekt, e, { ciag, oryginaly: true, bezPodloza: true });
    pierwszy ||= wydruk;
    const W = wydruk.szerokosc_mm * PT;
    const H = wydruk.wysokosc_mm * PT;
    const m = wydruk.marginesy || {};
    const lewa = e.bok === 'lewa';
    // Strona → rozkładówka: początek układu w środku strony.
    const naRozkl = (xmm, ymm) => [xmm * PT - W / 2, ymm * PT - H / 2];
    const elementy = [];
    const t = hex(typeof tlo === 'string' ? tlo : null);
    if (t && t.hex !== '#ffffff') {
      const sp = (wydruk.spad_mm || 0);
      const [x, y] = naRozkl(-sp, -sp);
      const w = W + 2 * sp * PT;
      const h = H + 2 * sp * PT;
      elementy.push(`<Rectangle ${atrybuty({ Self: nowyId('t'), Name: 'Tło strony', ContentType: 'Unassigned', ItemLayer: 'ly', FillColor: kolory.nazwa(t.hex), StrokeColor: 'Swatch/None', StrokeWeight: 0, ItemTransform: macierz(0, x, y) })}><Properties>${geometria(prostokat(w, h))}</Properties></Rectangle>`);
    }
    for (const o of obiekty) {
      if (o.visible === false || plytaUszlachetnienia(o)?.techniczna) continue;
      const typ = String(o.type).toLowerCase();
      const r = ramka(o);
      if (r && typ === 'textbox' && !o.tabela && bezEfektow(o) && zwyklyKolor(o.fill)) {
        const idH = nowyId('st');
        historie.push(idH);
        zip.file(`Stories/Story_${idH}.xml`, historia(idH, o, r, kolory, czcionki));
        const [x, y] = naRozkl(r.x, r.y);
        elementy.push(`<TextFrame ${atrybuty({ Self: nowyId('tf'), ParentStory: idH, PreviousTextFrame: 'n', NextTextFrame: 'n', ContentType: 'TextType', ItemLayer: 'ly', FillColor: kolory.nazwa(o.backgroundColor), StrokeColor: 'Swatch/None', StrokeWeight: 0, ItemTransform: macierz(r.kat, x, y) })}><Properties>${geometria(prostokat(r.w * PT, (r.h + zapasRamki(o, r.sy)) * PT))}</Properties><TextFramePreference TextColumnCount="1" TextColumnGutter="12" FirstBaselineOffset="AscentOffset" VerticalJustification="TopAlign"><Properties><InsetSpacing type="list"><ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem></InsetSpacing></Properties></TextFramePreference></TextFrame>`);
        ile.teksty += 1;
        continue;
      }
      const sciezka = r && TYPY_KSZTALTOW.has(typ) && bezEfektow(o) && zwyklyKolor(o.fill) && zwyklyKolor(o.stroke) && !o.strokeDashArray?.length ? sciezkaKsztaltu(o, r) : null;
      const kontury = sciezka ? konturyIdml(sciezka) : [];
      if (kontury.length) {
        const [x, y] = naRozkl(r.x, r.y);
        const kreska = o.stroke && (o.strokeWidth || 0) > 0 ? kolory.nazwa(o.stroke) : 'Swatch/None';
        const linia = typ === 'line' || typ === 'polyline';
        const znacznik = linia ? 'GraphicLine' : typ === 'ellipse' || typ === 'circle' ? 'Oval' : typ === 'rect' ? 'Rectangle' : 'Polygon';
        elementy.push(`<${znacznik} ${atrybuty({
          Self: nowyId('k'), Name: typ, ContentType: 'Unassigned', ItemLayer: 'ly',
          FillColor: linia ? 'Swatch/None' : kolory.nazwa(o.fill), StrokeColor: kreska,
          StrokeWeight: kreska === 'Swatch/None' ? 0 : o.strokeWidth * (o.strokeUniform ? 1 : Math.max(r.sx, r.sy)) * PT,
          StrokeAlignment: 'CenterAlignment', ItemTransform: macierz(r.kat, x, y),
        })}><Properties>${geometria(kontury)}</Properties></${znacznik}>`);
        ile.ksztalty += 1;
        continue;
      }
      const obraz = await obrazElementu(o);
      if (!obraz) continue;
      const [x, y] = naRozkl(obraz.x, obraz.y);
      const w = obraz.w * PT;
      const h = obraz.h * PT;
      // Obraz ma zapisane 300 dpi (pHYs): jego naturalny rozmiar w pt to px × 72 / dpi – skala dopasowuje go do ramki.
      const { px, py, dpi } = obraz;
      const ppi = Math.round(dpi);
      elementy.push(`<Rectangle ${atrybuty({ Self: nowyId('r'), Name: o.nazwa || typ, ContentType: 'GraphicType', ItemLayer: 'ly', FillColor: 'Swatch/None', StrokeColor: 'Swatch/None', StrokeWeight: 0, ItemTransform: macierz(0, x, y) })}><Properties>${geometria(prostokat(w, h))}</Properties><FrameFittingOption FittingOnEmptyFrame="None"/><Image ${atrybuty({ Self: nowyId('i'), ImageTypeName: '$ID/Portable Network Graphics (PNG)', ActualPpi: `${ppi} ${ppi}`, EffectivePpi: `${ppi} ${ppi}`, ItemTransform: `${liczba(w / ((px * 72) / dpi))} 0 0 ${liczba(h / ((py * 72) / dpi))} 0 0` })}><Properties><Profile type="string">$ID/Embedded</Profile><GraphicBounds Left="0" Top="0" Right="${liczba((px * 72) / dpi)}" Bottom="${liczba((py * 72) / dpi)}"/><Contents><![CDATA[${await base64(obraz.blob)}]]></Contents></Properties><Link ${atrybuty({ Self: nowyId('l'), LinkResourceURI: `file:${o.id || 'obraz'}.png`, StoredState: 'Embedded', LinkResourceFormat: '$ID/Portable Network Graphics (PNG)' })}/></Image></Rectangle>`);
      ile.obrazy += 1;
    }
    const idR = nowyId('sp');
    const idS = nowyId('pg');
    rozkladowki.push({ id: idR, strona: idS });
    zip.file(`Spreads/Spread_${idR}.xml`, `${naglowek}<idPkg:Spread xmlns:idPkg="${NS}" DOMVersion="${DOM}"><Spread ${atrybuty({ Self: idR, PageCount: 1, BindingLocation: 0, AllowPageShuffle: 'true', ShowMasterItems: 'true', ItemTransform: '1 0 0 1 0 0' })}><Page ${atrybuty({ Self: idS, Name: String(n + 1), AppliedMaster: 'n', GeometricBounds: `0 0 ${liczba(H)} ${liczba(W)}`, ItemTransform: `1 0 0 1 ${liczba(-W / 2)} ${liczba(-H / 2)}`, OverrideList: '', TabOrder: '' })}><MarginPreference ${atrybuty({ ColumnCount: 1, ColumnGutter: 12, Top: (m.gora ?? 0) * PT, Bottom: (m.dol ?? 0) * PT, Left: (lewa ? m.zewnetrzny : m.wewnetrzny ?? 0) * PT, Right: (lewa ? m.wewnetrzny : m.zewnetrzny ?? 0) * PT, ColumnDirection: 'Horizontal', ColumnsPositions: `0 ${liczba(W)}` })}/></Page>${elementy.join('')}</Spread></idPkg:Spread>`);
  }
  postep?.(egz.length, egz.length);

  const w = pierwszy || { szerokosc_mm: 210, wysokosc_mm: 297, spad_mm: 3, marginesy: {} };
  const m = w.marginesy || {};
  const spad = (w.spad_mm || 0) * PT;

  zip.file('Resources/Graphic.xml', `${naglowek}<idPkg:Graphic xmlns:idPkg="${NS}" DOMVersion="${DOM}">
\t<Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" ColorOverride="Specialblack" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Black" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>
\t<Color Self="Color/Paper" Model="Process" Space="CMYK" ColorValue="0 0 0 0" ColorOverride="Specialpaper" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Paper" ColorEditable="true" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>
\t<Color Self="Color/Registration" Model="Registration" Space="CMYK" ColorValue="100 100 100 100" ColorOverride="Specialregistration" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Registration" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>
${kolory.xml()}
\t<Swatch Self="Swatch/None" Name="None" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>
\t<StrokeStyle Self="StrokeStyle/$ID/Solid" Name="$ID/Solid"/>
</idPkg:Graphic>`);
  const rodziny = new Map();
  for (const k of czcionki) { const [r, o] = k.split('\u0000'); if (!rodziny.has(r)) rodziny.set(r, new Set()); rodziny.get(r).add(o); }
  zip.file('Resources/Fonts.xml', `${naglowek}<idPkg:Fonts xmlns:idPkg="${NS}" DOMVersion="${DOM}">${[...rodziny].map(([r, odm], i) => `<FontFamily Self="di${i}" Name="${xml(r)}">${[...odm].map((o) => `<Font ${atrybuty({ Self: `di${i}Font${r} ${o}`, FontFamily: r, Name: `${r} ${o}`, PostScriptName: nazwaPostScript(r, o), Status: 'NotAvailable', FontStyleName: o, FontType: 'OpenTypeTT', WritingScript: 0 })}/>`).join('')}</FontFamily>`).join('')}</idPkg:Fonts>`);
  zip.file('Resources/Styles.xml', `${naglowek}<idPkg:Styles xmlns:idPkg="${NS}" DOMVersion="${DOM}"><RootCharacterStyleGroup Self="rcs"><CharacterStyle Self="CharacterStyle/$ID/[No character style]" Imported="false" Name="$ID/[No character style]"/></RootCharacterStyleGroup><RootParagraphStyleGroup Self="rps"><ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" Imported="false"/><ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="$ID/NormalParagraphStyle" Imported="false" NextStyle="ParagraphStyle/$ID/NormalParagraphStyle"><Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn></Properties></ParagraphStyle></RootParagraphStyleGroup><RootCellStyleGroup Self="rcls"><CellStyle Self="CellStyle/$ID/[None]" Name="$ID/[None]"/></RootCellStyleGroup><RootTableStyleGroup Self="rts"><TableStyle Self="TableStyle/$ID/[No table style]" Name="$ID/[No table style]"/></RootTableStyleGroup><RootObjectStyleGroup Self="ros"><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/></RootObjectStyleGroup></idPkg:Styles>`);
  zip.file('Resources/Preferences.xml', `${naglowek}<idPkg:Preferences xmlns:idPkg="${NS}" DOMVersion="${DOM}"><DocumentPreference ${atrybuty({ PageHeight: w.wysokosc_mm * PT, PageWidth: w.szerokosc_mm * PT, PagesPerDocument: egz.length, FacingPages: 'false', DocumentBleedTopOffset: spad, DocumentBleedBottomOffset: spad, DocumentBleedInsideOrLeftOffset: spad, DocumentBleedOutsideOrRightOffset: spad, DocumentBleedUniformSize: 'true', PageBinding: 'LeftToRight', AllowPageShuffle: 'true', Intent: 'PrintIntent', StartPageNumber: 1 })}/><MarginPreference ${atrybuty({ ColumnCount: 1, ColumnGutter: 12, Top: (m.gora ?? 0) * PT, Bottom: (m.dol ?? 0) * PT, Left: (m.wewnetrzny ?? 0) * PT, Right: (m.zewnetrzny ?? 0) * PT, ColumnDirection: 'Horizontal' })}/><ViewPreference HorizontalMeasurementUnits="Millimeters" VerticalMeasurementUnits="Millimeters"/></idPkg:Preferences>`);
  zip.file('XML/BackingStory.xml', `${naglowek}<idPkg:BackingStory xmlns:idPkg="${NS}" DOMVersion="${DOM}"><XmlStory Self="bs" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n"><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle"><CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"/></ParagraphStyleRange></XmlStory></idPkg:BackingStory>`);
  zip.file('designmap.xml', `${naglowek}<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="8.0(370)" ?>
<Document xmlns:idPkg="${NS}" ${atrybuty({ DOMVersion: DOM, Self: 'd', StoryList: [...historie, 'bs'].join(' '), Name: `${projekt.nazwa || 'Makietka'}.indd`, ZeroPoint: '0 0', ActiveLayer: 'ly', CMYKProfile: 'Coated FOGRA39 (ISO 12647-2:2004)', RGBProfile: 'sRGB IEC61966-2.1', SolidColorIntent: 'UseColorSettings', AfterBlendingIntent: 'UseColorSettings', DefaultImageIntent: 'UseColorSettings', RGBPolicy: 'PreserveEmbeddedProfiles', CMYKPolicy: 'CombinationOfPreserveAndSafeCmyk', AccurateLABSpots: 'false' })}>
<idPkg:Graphic src="Resources/Graphic.xml"/>
<idPkg:Fonts src="Resources/Fonts.xml"/>
<idPkg:Styles src="Resources/Styles.xml"/>
<idPkg:Preferences src="Resources/Preferences.xml"/>
<Layer Self="ly" Name="Makietka" Visible="true" Locked="false" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="true"/>
${rozkladowki.map((r) => `<idPkg:Spread src="Spreads/Spread_${r.id}.xml"/>`).join('\n')}
<Section ${atrybuty({ Self: 'sec', Length: egz.length, Name: '', ContinueNumbering: 'false', IncludeSectionPrefix: 'false', PageNumberStyle: 'Arabic', PageStart: rozkladowki[0]?.strona, PageNumberStart: 1, SectionPrefix: '', Marker: '' })}/>
<idPkg:BackingStory src="XML/BackingStory.xml"/>
${historie.map((h) => `<idPkg:Story src="Stories/Story_${h}.xml"/>`).join('\n')}
</Document>`);
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.adobe.indesign-idml-package', compression: 'DEFLATE' });
  return { blob, ile, stron: egz.length, czcionki: [...czcionki].map((k) => k.replace('\u0000', ' ')) };
}
