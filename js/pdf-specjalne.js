// Sekcje specjalne w PDF (#177, js/sekcje-specjalne.js): linia wykrojnika (CutContour), zgięć (Crease) i perforacji
// (Perforation) jako osobne kolory dodatkowe z nadrukiem – drukarnia ich nie drukuje, tylko wycina, biguje
// i perforuje. Przy obwolucie, ulotce i kalendarzu trójdzielnym (cięcie prostokątne) zgięcia i perforacje są
// znaczone kreskami poza formatem, w pasie znaków cięcia – jak w zwykłej praktyce drukarni.
//
// Wymiary w mm od lewego górnego rogu formatu netto; m – wymiary strony PDF (eksport.js wymiaryStronyPdf).

export const PT = 72 / 25.4;
export const KOLORY_TECHNICZNE = {
  ciecie: { nazwa: 'CutContour', alt: [0, 1, 0, 0] },
  big: { nazwa: 'Crease', alt: [1, 0, 0, 0] },
  perforacja: { nazwa: 'Perforation', alt: [0, 0, 1, 0] },
};

const SEPARACJE = new WeakMap(); // plik PDF → nazwa → obiekt przestrzeni kolorów
const NADRUK = new WeakMap(); // plik PDF → ExtGState z nadrukiem

function zasoby(PDFLib, pdf, strona) {
  const { PDFName, PDFDict } = PDFLib;
  const { Resources } = strona.node.normalizedEntries();
  const slownik = (rodzaj) => {
    let s = Resources.lookupMaybe(PDFName.of(rodzaj), PDFDict);
    if (!s) { s = pdf.context.obj({}); Resources.set(PDFName.of(rodzaj), s); }
    return s;
  };
  return {
    separacja(klucz) {
      const { nazwa, alt } = KOLORY_TECHNICZNE[klucz];
      let wspolne = SEPARACJE.get(pdf);
      if (!wspolne) { wspolne = new Map(); SEPARACJE.set(pdf, wspolne); }
      if (!wspolne.has(nazwa)) {
        const funkcja = pdf.context.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: alt, N: 1 });
        wspolne.set(nazwa, pdf.context.register(pdf.context.obj([PDFName.of('Separation'), PDFName.of(nazwa), PDFName.of('DeviceCMYK'), funkcja])));
      }
      const n = `Tech${nazwa}`;
      slownik('ColorSpace').set(PDFName.of(n), wspolne.get(nazwa));
      return n;
    },
    nadruk() {
      if (!NADRUK.has(pdf)) NADRUK.set(pdf, pdf.context.register(pdf.context.obj({ Type: 'ExtGState', OP: true, op: true, OPM: 1 })));
      slownik('ExtGState').set(PDFName.of('TechNadruk'), NADRUK.get(pdf));
      return 'TechNadruk';
    },
  };
}

// Ścieżki (listy punktów) jedną farbą techniczną: zamknięte kontury i odcinki.
function rysujFarba(PDFLib, strona, z, klucz, { kontury = [], odcinki = [] }, xy, { przerywana = null } = {}) {
  if (!kontury.length && !odcinki.length) return;
  const { PDFOperator, PDFName, PDFNumber } = PDFLib;
  const op = [
    PDFLib.pushGraphicsState(),
    PDFLib.setGraphicsState(z.nadruk()),
    PDFOperator.of('CS', [PDFName.of(z.separacja(klucz))]),
    PDFOperator.of('SCN', [PDFNumber.of(1)]),
    PDFLib.setLineWidth(0.5),
    PDFLib.setDashPattern(przerywana || [], 0),
  ];
  for (const k of kontury) {
    k.forEach((p, i) => { const [x, y] = xy(p.x, p.y); op.push(i ? PDFLib.lineTo(x, y) : PDFLib.moveTo(x, y)); });
    op.push(PDFLib.closePath());
  }
  for (const l of odcinki) {
    const [x1, y1] = xy(l.x1, l.y1);
    const [x2, y2] = xy(l.x2, l.y2);
    op.push(PDFLib.moveTo(x1, y1), PDFLib.lineTo(x2, y2));
  }
  op.push(PDFLib.stroke(), PDFLib.popGraphicsState());
  strona.pushOperators(...op);
}

// Linie techniczne sekcji specjalnej na stronie PDF. wynik – wynik sekcji dla tej strony (wynikDlaStrony).
export function rysujLinieSpecjalne(PDFLib, pdf, strona, m, wynik, { czarnaFarba = false } = {}) {
  if (!wynik || wynik.odwrotna) return; // druga strona arkusza wykrojnika – linie tnie się z pierwszej
  const xy = (x, y) => [(m.pas + x) * PT, (m.pas + m.h - y) * PT];
  const z = zasoby(PDFLib, pdf, strona);
  const wykrojnik = wynik.rodzaj === 'wykrojnik' || (wynik.ciecie || []).length > 0;
  rysujFarba(PDFLib, strona, z, 'ciecie', { kontury: wynik.ciecie || [], odcinki: wynik.naciecia || [] }, xy);
  if (wykrojnik) {
    rysujFarba(PDFLib, strona, z, 'big', { odcinki: wynik.bigi || [] }, xy, { przerywana: [6, 3] });
    rysujFarba(PDFLib, strona, z, 'perforacja', { odcinki: wynik.perforacje || [] }, xy, { przerywana: [2, 2] });
    return;
  }
  // Cięcie prostokątne: znaczniki zgięć i perforacji poza formatem (tylko gdy jest pas na znaki).
  if (!m.znaki) return;
  const kolor = czarnaFarba ? PDFLib.cmyk(0, 0, 0, 1) : PDFLib.rgb(0, 0, 0);
  const dl = Math.max(2, m.pas - m.odstep - 1);
  const kreska = (x1, y1, x2, y2, przerywana) => strona.drawLine({ start: { x: x1 * PT, y: y1 * PT }, end: { x: x2 * PT, y: y2 * PT }, thickness: 0.25, color: kolor, dashArray: przerywana ? [2, 1.5] : undefined });
  const znaczniki = (lista, przerywana) => {
    for (const l of lista) {
      if (Math.abs(l.x1 - l.x2) < 0.01) { // pionowa: kreski nad i pod formatem
        const x = m.pas + l.x1;
        kreska(x, m.pas + m.h + m.odstep, x, m.pas + m.h + m.odstep + dl, przerywana);
        kreska(x, m.pas - m.odstep, x, m.pas - m.odstep - dl, przerywana);
      } else if (Math.abs(l.y1 - l.y2) < 0.01) { // pozioma: z lewej i z prawej
        const y = m.pas + m.h - l.y1;
        kreska(m.pas - m.odstep, y, m.pas - m.odstep - dl, y, przerywana);
        kreska(m.pas + m.w + m.odstep, y, m.pas + m.w + m.odstep + dl, y, przerywana);
      }
    }
  };
  znaczniki(wynik.bigi || [], true);
  znaczniki(wynik.perforacje || [], true);
}

// Arkusz użytków (#177): strony PDF sekcji z użytkami (osobno, każda ze spadem) układa na arkuszach N × M,
// ze znakami cięcia każdego użytku i – dla naklejek – linią wykrojnika (CutContour). Zwraca nowy plik PDF.
// grupy: [{ od, ile, uklad, uzytek: { w, h }, spad, ciecie }] – zakresy stron w pliku `bajty`; reszta stron przechodzi bez zmian.
export async function arkuszeUzytkow(PDFLib, bajty, grupy, { znaki = true } = {}) {
  const zrodlo = await PDFLib.PDFDocument.load(bajty);
  const nowy = await PDFLib.PDFDocument.create();
  nowy.setTitle(zrodlo.getTitle() || '');
  nowy.setCreator('Makietka');
  const n = zrodlo.getPageCount();
  const wGrupie = new Map();
  for (const g of grupy) for (let i = g.od; i < g.od + g.ile; i += 1) wGrupie.set(i, g);
  let i = 0;
  while (i < n) {
    const g = wGrupie.get(i);
    if (!g) {
      const [kopia] = await nowy.copyPages(zrodlo, [i]);
      nowy.addPage(kopia);
      i += 1;
      continue;
    }
    const { uklad: u, uzytek, spad } = g;
    const strony = [];
    for (let k = g.od; k < g.od + g.ile; k += 1) strony.push(k);
    i = g.od + g.ile;
    // Jeden użytek na całym arkuszu: powiel go we wszystkich polach; kilka (seria) – kolejno, arkusz po arkuszu.
    const kolejka = strony.length === 1 ? Array(u.na_arkuszu).fill(strony[0]) : strony;
    for (let start = 0; start < kolejka.length; start += Math.max(1, u.na_arkuszu)) {
      const arkusz = nowy.addPage([u.arkusz.w * PT, u.arkusz.h * PT]);
      const czesc = kolejka.slice(start, start + u.na_arkuszu);
      for (const [j, nr] of czesc.entries()) {
        const strona = zrodlo.getPage(nr);
        const bleed = strona.getBleedBox();
        const [osadzona] = await nowy.embedPages([strona], [{ left: bleed.x, bottom: bleed.y, right: bleed.x + bleed.width, top: bleed.y + bleed.height }]);
        const kol = j % u.kolumny;
        const wier = Math.floor(j / u.kolumny);
        // Lewy górny róg formatu netto użytku na arkuszu (mm od lewego górnego rogu arkusza).
        const x = u.x0 + kol * (uzytek.w + 2 * spad + u.odstep) + spad;
        const y = u.y0 + wier * (uzytek.h + 2 * spad + u.odstep) + spad;
        arkusz.drawPage(osadzona, { x: (x - spad) * PT, y: (u.arkusz.h - y - uzytek.h - spad) * PT, width: (uzytek.w + 2 * spad) * PT, height: (uzytek.h + 2 * spad) * PT });
        if (g.ciecie?.length) {
          const z = zasoby(PDFLib, nowy, arkusz);
          rysujFarba(PDFLib, arkusz, z, 'ciecie', { kontury: g.ciecie }, (px, py) => [(x + px) * PT, (u.arkusz.h - y - py) * PT]);
        }
      }
      if (znaki) {
        // Znaki cięcia na brzegach arkusza, na przedłużeniu krawędzi kolumn i wierszy użytków.
        const kolor = PDFLib.rgb(0, 0, 0);
        const kreska = (x1, y1, x2, y2) => arkusz.drawLine({ start: { x: x1 * PT, y: y1 * PT }, end: { x: x2 * PT, y: y2 * PT }, thickness: 0.25, color: kolor });
        const dl = Math.max(2, Math.min(6, u.x0 - 2, u.y0 - 2));
        for (let k = 0; k < u.kolumny; k += 1) {
          for (const xx of [u.x0 + k * (uzytek.w + 2 * spad + u.odstep) + spad, u.x0 + k * (uzytek.w + 2 * spad + u.odstep) + spad + uzytek.w]) {
            kreska(xx, u.arkusz.h - (u.y0 - 1), xx, u.arkusz.h - (u.y0 - 1 - dl));
            kreska(xx, u.arkusz.h - (u.arkusz.h - u.y0 + 1), xx, u.arkusz.h - (u.arkusz.h - u.y0 + 1 + dl));
          }
        }
        for (let k = 0; k < u.wiersze; k += 1) {
          for (const yy of [u.y0 + k * (uzytek.h + 2 * spad + u.odstep) + spad, u.y0 + k * (uzytek.h + 2 * spad + u.odstep) + spad + uzytek.h]) {
            kreska(u.x0 - 1, u.arkusz.h - yy, u.x0 - 1 - dl, u.arkusz.h - yy);
            kreska(u.arkusz.w - u.x0 + 1, u.arkusz.h - yy, u.arkusz.w - u.x0 + 1 + dl, u.arkusz.h - yy);
          }
        }
      }
    }
  }
  return nowy;
}
