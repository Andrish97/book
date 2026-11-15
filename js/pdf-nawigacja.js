// PDF do czytania na ekranie (#131C): zakładki (spis w bocznym panelu czytnika) i klikalne linki.
//
//  – zakładki: sekcje projektu, a pod nimi nagłówki (style nagłówków książki, js/ksiazka.js, poziomy 1–3);
//  – linki wewnętrzne: numer strony w wierszu spisu treści i odsyłacz „s. 12” prowadzą do tej strony pliku;
//  – linki zewnętrzne: element z polem `link` (adres – panel, część „Inne”) i kod QR z adresem strony.
// Prostokąty liczone są z obiektów już złożonej strony (zlozenie.js: zlozCel) – w milimetrach strony.

const PT = 72 / 25.4;

// Adres do linku: http(s), mailto:, tel:. Bez schematu – „www.…” albo „domena.pl/…” dostaje https://.
export function adresLinku(t) {
  const s = String(t || '').trim();
  if (!s) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) return s;
  if (/^[\w.-]+@[\w-]+\.[\w.-]+$/.test(s)) return `mailto:${s}`;
  if (/^(www\.)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s)) return `https://${s}`;
  return null;
}

// Adres kodu QR, gdy kod zawiera adres strony (albo e-mail / telefon).
function adresKodu(o) {
  const k = o.kod;
  if (!k || k.rodzaj !== 'qr') return null;
  const t = String(k.tresc || '').trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(t) ? t : null;
}

const potomkowie = (o) => (typeof o?.getObjects === 'function' ? o.getObjects() : (o?._objects || []));

// Prostokąt obiektu w układzie strony (mm): [x, y, w, h].
function prostokat(o) {
  const r = o.getBoundingRect ? o.getBoundingRect() : { left: o.left || 0, top: o.top || 0, width: o.width || 0, height: o.height || 0 };
  return [r.left, r.top, r.width, r.height];
}

// Prostokąty znaków od..do w wierszu tekstu (mm strony). Tekst obrócony – null (wtedy cały element).
function prostokatZnakow(o, wiersz, od, doZnaku) {
  const granice = o.__charBounds?.[wiersz];
  if (!granice || !granice[od] || typeof fabric === 'undefined') return null;
  let y = -(o.height || 0) / 2;
  for (let i = 0; i < wiersz; i += 1) y += o.getHeightOfLine(i);
  const h = o.getHeightOfLine(wiersz);
  const lewo = (o._getLineLeftOffset?.(wiersz) || 0) - (o.width || 0) / 2;
  const x0 = lewo + granice[od].left;
  const ostatni = granice[Math.max(od, doZnaku - 1)] || granice[od];
  const x1 = lewo + ostatni.left + (ostatni.kernedWidth ?? ostatni.width ?? 0);
  const mac = o.calcTransformMatrix();
  const pkt = [[x0, y], [x1, y], [x0, y + h], [x1, y + h]].map(([x, yy]) => fabric.util.transformPoint(new fabric.Point(x, yy), mac));
  const xs = pkt.map((p) => p.x); const ys = pkt.map((p) => p.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

// Linki strony: [{ prostokat: [x, y, w, h] (mm), url } | { prostokat, nr } (numer strony w wydruku)].
// odsylacze – czy tekst zawiera pola {s:…} (sprawdzane w zapisie projektu, bo złożony tekst ma już numery).
export function linkiStrony(obiekty, { maOdsylacze = () => false } = {}) {
  const wynik = [];
  const przejdz = (lista) => {
    for (const o of lista || []) {
      if (!o || o.visible === false) continue;
      const url = adresLinku(o.link) || adresKodu(o);
      if (url) { wynik.push({ prostokat: prostokat(o), url }); continue; }
      const linie = o._textLines;
      if (linie && (o.ksiazka?.rodzaj === 'spis' || maOdsylacze(o))) {
        const spis = o.ksiazka?.rodzaj === 'spis';
        linie.forEach((znaki, i) => {
          const tekst = znaki.join('');
          const wzor = spis ? /(\d+)\s*$/g : /\bs\.\s?(\d+)/g;
          for (const traf of tekst.matchAll(wzor)) {
            const start = traf.index + traf[0].indexOf(traf[1]);
            // Spis: cały wiersz jest klikalny; odsyłacz – samo „s. 12”.
            const r = spis ? prostokatZnakow(o, i, 0, znaki.length) : prostokatZnakow(o, i, traf.index, start + traf[1].length);
            wynik.push({ prostokat: r || prostokat(o), nr: Number(traf[1]) });
          }
        });
      }
      const dzieci = potomkowie(o);
      if (dzieci.length && !o.tabela && !o.kod) przejdz(dzieci);
    }
  };
  przejdz(obiekty);
  return wynik;
}

// Dopisuje adnotacje linków do strony PDF. m – wymiary strony (wymiaryStronyPdf); docelowa(nr) → PDFPage albo null.
export function dodajLinki(PDFLib, pdf, strona, m, linki, docelowa) {
  const { PDFName, PDFString, PDFNumber } = PDFLib;
  for (const l of linki) {
    const [x, y, w, h] = l.prostokat;
    if (!(w > 0 && h > 0)) continue;
    const rect = [(m.pas + x) * PT, (m.pas + m.h - y - h) * PT, (m.pas + x + w) * PT, (m.pas + m.h - y) * PT];
    const opis = {
      Type: 'Annot', Subtype: 'Link', Rect: rect.map((v) => PDFNumber.of(Math.round(v * 100) / 100)), Border: [0, 0, 0], F: 4,
    };
    if (l.url) opis.A = { Type: 'Action', S: 'URI', URI: PDFString.of(l.url) };
    else {
      const cel = docelowa(l.nr);
      if (!cel) continue;
      opis.Dest = [cel.ref, PDFName.of('Fit')];
    }
    strona.node.addAnnot(pdf.context.register(pdf.context.obj(opis)));
  }
}

// Zakładki: pozycje [{ tytul, strona: PDFPage, poziom: 1… }] w kolejności dokumentu.
export function dodajZakladki(PDFLib, pdf, pozycje) {
  if (!pozycje.length) return;
  const { PDFName, PDFHexString, PDFNumber } = PDFLib;
  const ctx = pdf.context;
  const korzen = { ref: ctx.nextRef(), dzieci: [], poziom: 0 };
  const stos = [korzen];
  for (const p of pozycje) {
    while (stos.length > 1 && stos.at(-1).poziom >= p.poziom) stos.pop();
    const wezel = { ...p, ref: ctx.nextRef(), dzieci: [], rodzic: stos.at(-1) };
    stos.at(-1).dzieci.push(wezel);
    stos.push(wezel);
  }
  const ileWszystkich = (w) => w.dzieci.reduce((s, d) => s + 1 + ileWszystkich(d), 0);
  const zapisz = (w) => {
    w.dzieci.forEach((d, i) => {
      const opis = {
        Title: PDFHexString.fromText(String(d.tytul || '').slice(0, 200)),
        Parent: w.ref,
        Dest: [d.strona.ref, PDFName.of('XYZ'), null, null, null],
      };
      if (i > 0) opis.Prev = w.dzieci[i - 1].ref;
      if (i < w.dzieci.length - 1) opis.Next = w.dzieci[i + 1].ref;
      if (d.dzieci.length) {
        opis.First = d.dzieci[0].ref;
        opis.Last = d.dzieci.at(-1).ref;
        opis.Count = PDFNumber.of(d.poziom < 2 ? ileWszystkich(d) : -ileWszystkich(d)); // rozwinięte tylko pierwsze poziomy
      }
      ctx.assign(d.ref, ctx.obj(opis));
      zapisz(d);
    });
  };
  zapisz(korzen);
  ctx.assign(korzen.ref, ctx.obj({ Type: 'Outlines', First: korzen.dzieci[0].ref, Last: korzen.dzieci.at(-1).ref, Count: PDFNumber.of(ileWszystkich(korzen)) }));
  pdf.catalog.set(PDFName.of('Outlines'), korzen.ref);
  pdf.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}
