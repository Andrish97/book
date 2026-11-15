// Układ arkuszy (impozycja, #131C): broszura zeszytowa, broszura ze składek, 2 albo 4 strony na arkuszu.
//
// Najpierw powstaje zwykły plik (strona po stronie), potem jego strony – przycięte do formatu po obcięciu
// (TrimBox) – trafiają na arkusze jako obiekty formularza PDF (XObject Form): wektorowo, bez przeliczania.
// Tak samo dla pliku wektorowego i z obrazów stron.
//
// Broszura zeszytowa: arkusze składane na pół i zszywane w grzbiecie. Strony idą parami tak, żeby po złożeniu
// wyszła właściwa kolejność: przy 16 stronach pierwszy arkusz to 16 | 1 (przód) i 2 | 15 (tył). Liczba stron
// dopełnia się pustymi do wielokrotności 4. Pełzanie (creep): w grubej broszurze środkowe arkusze wystają po
// złożeniu – ich strony przesuwają się o ułamek podanej wartości w stronę grzbietu.
// Składki: broszura dzielona na zeszyty po N stron (4, 8, 16, 32 – jak ustawienie składek sekcji, #120),
// każda składka układana jak osobna broszura.

const PT = 72 / 25.4;
export const ARKUSZE = { A4: [210, 297], A3: [297, 420] };
export const UKLADY = {
  zwykly: 'Zwykłe strony',
  broszura: 'Broszura do składania (zeszyt)',
  skladki: 'Broszura ze składek',
  dwie: '2 strony na arkuszu',
  cztery: '4 strony na arkuszu',
};
const MARGINES_ARKUSZA = 5; // mm – odstęp od brzegu arkusza A4/A3
const ZNAK = 5; // mm – długość znaku cięcia
const ODSTEP_ZNAKU = 2; // mm – od krawędzi obcięcia

// Strony jednej broszury (indeksy od 0, null – pusta strona do dopełnienia): [{ lewa, prawa, arkusz, strona: 'przod' | 'tyl' }].
export function kolejnoscBroszury(n, przesuniecie = 0) {
  const razem = Math.max(4, Math.ceil(n / 4) * 4);
  const nr = (i) => (i < n ? przesuniecie + i : null);
  const strony = [];
  for (let s = 0; s < razem / 4; s += 1) {
    strony.push({ lewa: nr(razem - 1 - 2 * s), prawa: nr(2 * s), arkusz: s, arkuszy: razem / 4, strona: 'przod' });
    strony.push({ lewa: nr(2 * s + 1), prawa: nr(razem - 2 - 2 * s), arkusz: s, arkuszy: razem / 4, strona: 'tyl' });
  }
  return { strony, puste: razem - n };
}

// Plan arkuszy: { strony: [{ pola: [indeks|null], kolumny, wiersze, falc, arkusz, arkuszy }], puste, skladek }.
export function planImpozycji(n, { uklad = 'zwykly', skladka = 16 } = {}) {
  if (uklad === 'broszura') {
    const { strony, puste } = kolejnoscBroszury(n);
    return { strony: strony.map((s) => ({ pola: [s.lewa, s.prawa], kolumny: 2, wiersze: 1, falc: true, arkusz: s.arkusz, arkuszy: s.arkuszy })), puste, skladek: 1 };
  }
  if (uklad === 'skladki') {
    const k = [4, 8, 16, 32].includes(Number(skladka)) ? Number(skladka) : 16;
    const wynik = []; let puste = 0; let skladek = 0;
    for (let od = 0; od < Math.max(n, 1); od += k) {
      const ile = Math.min(k, n - od);
      // Każda składka ma pełne k stron – brakujące na końcu ostatniej są puste.
      const { strony } = kolejnoscBroszury(k, od);
      for (const s of strony) {
        const pole = (i) => (i !== null && i < n ? i : null);
        wynik.push({ pola: [pole(s.lewa), pole(s.prawa)], kolumny: 2, wiersze: 1, falc: true, arkusz: s.arkusz, arkuszy: s.arkuszy });
      }
      puste += k - ile; skladek += 1;
    }
    return { strony: wynik, puste, skladek };
  }
  if (uklad === 'dwie' || uklad === 'cztery') {
    const na = uklad === 'dwie' ? 2 : 4;
    const strony = [];
    for (let i = 0; i < n; i += na) strony.push({ pola: Array.from({ length: na }, (_, j) => (i + j < n ? i + j : null)), kolumny: 2, wiersze: na === 2 ? 1 : 2, falc: false });
    return { strony, puste: 0, skladek: 0 };
  }
  return { strony: Array.from({ length: n }, (_, i) => ({ pola: [i], kolumny: 1, wiersze: 1, falc: false })), puste: 0, skladek: 0 };
}

// Wymiary arkusza (mm) dla bloku stron w×h na kolumny×wiersze. format: 'auto' (blok + miejsce na znaki) | 'A4' | 'A3'.
export function wymiaryArkusza(w, h, kolumny, wiersze, { format = 'auto', znaki = true } = {}) {
  const blokW = w * kolumny; const blokH = h * wiersze;
  if (format === 'auto' || !ARKUSZE[format]) {
    const pas = znaki ? ODSTEP_ZNAKU + ZNAK + 1 : 0;
    return { szer: blokW + 2 * pas, wys: blokH + 2 * pas, skala: 1, x: pas, y: pas, blokW, blokH };
  }
  const [a, b] = ARKUSZE[format];
  // Orientacja, w której blok mieści się większy.
  const opcje = [[a, b], [b, a]].map(([sw, sh]) => {
    const skala = Math.min(1, (sw - 2 * MARGINES_ARKUSZA) / blokW, (sh - 2 * MARGINES_ARKUSZA) / blokH);
    return { szer: sw, wys: sh, skala, blokW: blokW * skala, blokH: blokH * skala };
  });
  const naj = opcje[0].skala >= opcje[1].skala ? opcje[0] : opcje[1];
  return { ...naj, x: (naj.szer - naj.blokW) / 2, y: (naj.wys - naj.blokH) / 2 };
}

// Nakłada strony pliku PDF (bajty) na arkusze; zwraca nowy PDFDocument (bez zapisu – można dołożyć PDF/X).
// opcje: uklad, skladka, format, pelzanie (mm), znaki (cięcia i złamu).
export async function impozycjaPdf(PDFLib, bajty, { uklad = 'broszura', skladka = 16, format = 'auto', pelzanie = 0, znaki = true, tytul = '' } = {}) {
  const zrodlo = await PDFLib.PDFDocument.load(bajty);
  const strony = zrodlo.getPages();
  const plan = planImpozycji(strony.length, { uklad, skladka });
  const pdf = await PDFLib.PDFDocument.create();
  if (tytul) pdf.setTitle(tytul);
  pdf.setCreator('Makietka');
  pdf.setProducer('Makietka (pdf-lib)');
  // Format po obcięciu (TrimBox) pierwszej strony – arkusz liczony z niego; inne formaty dopasowują się w polu.
  const trim = (s) => { const t = s.getTrimBox(); return { x: t.x, y: t.y, w: t.width, h: t.height }; };
  const t0 = trim(strones(strony));
  const w = t0.w / PT; const h = t0.h / PT;
  const osadzone = new Map();
  const osadz = async (i) => {
    if (!osadzone.has(i)) {
      const t = trim(strony[i]);
      osadzone.set(i, await pdf.embedPage(strony[i], { left: t.x, bottom: t.y, right: t.x + t.w, top: t.y + t.h }));
    }
    return osadzone.get(i);
  };
  const czarny = PDFLib.cmyk(0, 0, 0, 1);
  for (const arkusz of plan.strony) {
    const a = wymiaryArkusza(w, h, arkusz.kolumny, arkusz.wiersze, { format, znaki });
    const strona = pdf.addPage([a.szer * PT, a.wys * PT]);
    const pw = w * a.skala; const ph = h * a.skala;
    // Pełzanie: środkowe arkusze broszury – strony bliżej grzbietu.
    const przes = arkusz.falc && pelzanie > 0 && arkusz.arkuszy > 1 ? (pelzanie * arkusz.arkusz) / (arkusz.arkuszy - 1) * a.skala : 0;
    for (let j = 0; j < arkusz.pola.length; j += 1) {
      const i = arkusz.pola[j];
      if (i === null || i === undefined) continue;
      const kol = j % arkusz.kolumny; const wiersz = Math.floor(j / arkusz.kolumny);
      const e = await osadz(i);
      const t = trim(strony[i]);
      const sk = Math.min(pw / (t.w / PT), ph / (t.h / PT));
      const x = a.x + kol * pw + (pw - (t.w / PT) * sk) / 2 + (arkusz.falc ? (kol === 0 ? przes : -przes) : 0);
      const y = a.wys - a.y - (wiersz + 1) * ph + (ph - (t.h / PT) * sk) / 2; // PDF liczy od dołu
      strona.drawPage(e, { x: x * PT, y: y * PT, xScale: sk, yScale: sk });
    }
    if (znaki) {
      const linia = (x1, y1, x2, y2, przerywana = false) => strona.drawLine({ start: { x: x1 * PT, y: y1 * PT }, end: { x: x2 * PT, y: y2 * PT }, thickness: 0.25, color: czarny, dashArray: przerywana ? [2, 2] : undefined });
      const x0 = a.x; const x1 = a.x + a.blokW; const yG = a.wys - a.y; const yD = a.wys - a.y - a.blokH;
      const dl = Math.min(ZNAK, Math.max(1, a.x - ODSTEP_ZNAKU - 0.5), Math.max(1, a.y - ODSTEP_ZNAKU - 0.5));
      for (const x of [x0, x1]) { linia(x, yG + ODSTEP_ZNAKU, x, yG + ODSTEP_ZNAKU + dl); linia(x, yD - ODSTEP_ZNAKU, x, yD - ODSTEP_ZNAKU - dl); }
      for (const y of [yG, yD]) { linia(x0 - ODSTEP_ZNAKU, y, x0 - ODSTEP_ZNAKU - dl, y); linia(x1 + ODSTEP_ZNAKU, y, x1 + ODSTEP_ZNAKU + dl, y); }
      // Złam (falc): przerywana kreska w osi grzbietu nad i pod blokiem; podział pól przy 2/4 na arkuszu – zwykłe kreski cięcia.
      for (let k = 1; k < arkusz.kolumny; k += 1) {
        const x = a.x + k * pw;
        linia(x, yG + ODSTEP_ZNAKU, x, yG + ODSTEP_ZNAKU + dl, arkusz.falc);
        linia(x, yD - ODSTEP_ZNAKU, x, yD - ODSTEP_ZNAKU - dl, arkusz.falc);
      }
      for (let k = 1; k < arkusz.wiersze; k += 1) {
        const y = yG - k * ph;
        linia(x0 - ODSTEP_ZNAKU, y, x0 - ODSTEP_ZNAKU - dl, y);
        linia(x1 + ODSTEP_ZNAKU, y, x1 + ODSTEP_ZNAKU + dl, y);
      }
    }
    strona.setTrimBox(a.x * PT, (a.wys - a.y - a.blokH) * PT, a.blokW * PT, a.blokH * PT);
  }
  return { pdf, plan };
}

const strones = (strony) => {
  if (!strony.length) throw new Error('W pliku nie ma stron.');
  return strony[0];
};

// Krótki opis planu do okna eksportu: liczby arkuszy i dopełnienie.
export function opisPlanu(n, opcje) {
  if (!n || !opcje.uklad || opcje.uklad === 'zwykly') return '';
  const plan = planImpozycji(n, opcje);
  const arkuszy = opcje.uklad === 'dwie' || opcje.uklad === 'cztery' ? plan.strony.length : plan.strony.length / 2;
  const czesci = [`${arkuszy} ${arkuszy === 1 ? 'arkusz' : (arkuszy % 10 >= 2 && arkuszy % 10 <= 4 && (arkuszy % 100 < 10 || arkuszy % 100 >= 20) ? 'arkusze' : 'arkuszy')}`];
  if (opcje.uklad === 'broszura' || opcje.uklad === 'skladki') czesci[0] += ' do druku dwustronnego (przód i tył, obracanie po dłuższej krawędzi)';
  if (plan.skladek > 1) czesci.push(`${plan.skladek} składek po ${opcje.skladka} stron`);
  if (plan.puste) czesci.push(`dopełnione ${plan.puste} ${plan.puste === 1 ? 'pustą stroną' : 'pustymi stronami'} na końcu`);
  return `${czesci.join(', ')}.`;
}
