/* global fabric */
// Przelewanie tekstu między połączonymi ramkami („wątek”).
//
// Ramki wątku mają wspólny identyfikator `watek` i kolejność `watek_nr`.
// Każda ramka przechowuje swoją część tekstu – projekt wygląda dobrze także
// bez ponownego przelewania. `lacznik` mówi, co stało między częścią
// poprzedniej ramki a tą: '\n' (nowy akapit), spacja albo nic (środek słowa).
//
// rozlej() skleja części w całość i rozdaje od nowa: każda ramka dostaje tyle
// wierszy, ile mieści jej stała wysokość, ostatnia – całą resztę.
// Formatowanie fragmentów (pogrubienia, kolory) wędruje razem z tekstem.

// Liczba znaków bez znaków nowej linii – tak Fabric liczy położenia stylów.
const bezLinii = (t) => t.length - (t.match(/\n/g) || []).length;

// [{ text, styles, lacznik }] → { text, styles }. Puste części są pomijane.
export function polaczCzesci(czesci) {
  let text = '';
  const styles = [];
  let pierwsza = true;
  for (const cz of czesci) {
    if (!cz.text) continue;
    if (!pierwsza) text += cz.lacznik ?? '\n';
    pierwsza = false;
    const przesuniecie = bezLinii(text);
    for (const s of cz.styles || []) styles.push({ start: s.start + przesuniecie, end: s.end + przesuniecie, style: s.style });
    text += cz.text;
  }
  return { text, styles };
}

// Dzieli tekst przed znakiem o numerze idx. Znak nowej linii albo spacja tuż
// przed podziałem znika z tekstu i zostaje zapamiętany jako łącznik drugiej części.
export function podzielTekst(text, styles, idx) {
  if (idx >= text.length) return [{ text, styles: styles || [] }, { text: '', styles: [], lacznik: '\n' }];
  const przed = text[idx - 1];
  const lacznik = przed === '\n' || przed === ' ' || przed === '\t' ? przed : '';
  const a = text.slice(0, idx - lacznik.length);
  const b = text.slice(idx);
  const koniecA = bezLinii(a);
  const poczatekB = koniecA + (lacznik && lacznik !== '\n' ? 1 : 0);
  const stA = [];
  const stB = [];
  for (const s of styles || []) {
    if (s.start < koniecA) stA.push({ start: s.start, end: Math.min(s.end, koniecA), style: s.style });
    if (s.end > poczatekB) stB.push({ start: Math.max(s.start, poczatekB) - poczatekB, end: s.end - poczatekB, style: s.style });
  }
  return [{ text: a, styles: stA }, { text: b, styles: stB, lacznik }];
}

// Wątki wśród obiektów: Map(id wątku → ramki w kolejności). Tylko ramki tekstu
// leżące bezpośrednio na stronie (nie w grupach).
export function watki(obiekty) {
  const wynik = new Map();
  for (const o of obiekty) {
    if (o.type !== 'textbox' || !o.watek) continue;
    wynik.set(o.watek, [...(wynik.get(o.watek) || []), o]);
  }
  for (const [id, ramki] of wynik) wynik.set(id, ramki.sort((a, b) => (a.watek_nr || 0) - (b.watek_nr || 0)));
  return wynik;
}

function ustawTekst(ramka, text, styles) {
  ramka.styles = styles.length ? fabric.util.stylesFromArray(styles.map((s) => ({ ...s })), text) : {};
  ramka.text = text;
  ramka.initDimensions();
}

// Ile wierszy mieści stała wysokość ramki (co najmniej jeden – żeby tekst szedł dalej).
function ileWierszy(ramka) {
  let h = 0;
  let k = 0;
  for (let i = 0; i < ramka._textLines.length; i += 1) {
    const wiersz = ramka.getHeightOfLine(i);
    if (h + wiersz / ramka.lineHeight > ramka.ramka_h + 0.01) break;
    h += wiersz;
    k = i + 1;
  }
  return Math.max(1, k);
}

// Numer znaku w tekście, od którego zaczyna się wiersz k (po zawinięciu).
function poczatekWiersza(ramka, k) {
  const m = ramka._styleMap[k];
  const akapity = ramka._unwrappedTextLines;
  let idx = 0;
  for (let j = 0; j < m.line; j += 1) idx += akapity[j].join('').length + 1;
  return idx + akapity[m.line].slice(0, m.offset).join('').length;
}

const akapity = (t) => (t ? t.split('\n').filter((a) => a.trim() !== '').length : 0);

// Przelewa tekst przez ramki jednego wątku (w kolejności). Zwraca true, gdy
// treść którejkolwiek ramki się zmieniła.
export function rozlej(ramki) {
  const przed = ramki.map((r) => `${r.lacznik ?? ''}\u0000${r.text}`);
  const czesci = ramki.map((r, i) => ({
    text: r.text,
    styles: fabric.util.stylesToArray(r.styles || {}, r.text),
    lacznik: i ? (r.lacznik ?? '\n') : '',
  }));
  let { text, styles } = polaczCzesci(czesci);
  let lacznik = '';
  let numer = 1;
  ramki.forEach((r, i) => {
    const ostatnia = i === ramki.length - 1;
    ustawTekst(r, text, styles);
    let idx = text.length;
    if (!ostatnia && r.ramka_h > 0) {
      const k = ileWierszy(r);
      if (k < r._textLines.length) idx = poczatekWiersza(r, k);
    }
    const [a, b] = podzielTekst(text, styles, idx);
    if (a.text !== text) ustawTekst(r, a.text, a.styles);
    if (i) r.lacznik = lacznik; else delete r.lacznik;
    // Numerowana lista liczy dalej w kolejnej ramce; akapit przeniesiony w połowie nie dostaje nowego numeru.
    const ciagDalszy = i > 0 && lacznik !== '\n' && a.text !== '';
    r.lista_start = numer > 1 || ciagDalszy ? numer : undefined;
    numer += akapity(a.text) - (ciagDalszy ? 1 : 0);
    r.setCoords();
    r.dirty = true;
    text = b.text; styles = b.styles; lacznik = b.lacznik;
  });
  return ramki.some((r, i) => przed[i] !== `${r.lacznik ?? ''}\u0000${r.text}`);
}

// Przelewa wszystkie kompletne wątki wśród obiektów (przy składaniu strony).
export function rozlejWatki(obiekty) {
  for (const ramki of watki(obiekty).values()) if (ramki.length > 1) rozlej(ramki);
}

// Dopisuje tekst usuwanej ramki do sąsiedniej ramki wątku, żeby nie zginął.
export function przeniesTekst(z, cel, naKoniec) {
  if (!z.text) return;
  const czesc = (r, lacznik) => ({ text: r.text, styles: fabric.util.stylesToArray(r.styles || {}, r.text), lacznik });
  const wynik = naKoniec
    ? polaczCzesci([czesc(cel, ''), czesc(z, z.lacznik ?? '\n')])
    : polaczCzesci([czesc(z, ''), czesc(cel, cel.lacznik ?? '\n')]);
  if (!naKoniec) cel.lacznik = z.lacznik;
  ustawTekst(cel, wynik.text, wynik.styles);
}

export function odlaczRamke(r) {
  delete r.watek; delete r.watek_nr; delete r.lacznik; delete r.lista_start;
  r.dirty = true;
}

// Właściwości tekstu wspólne dla całego wątku – tekst wygląda tak samo w każdej ramce.
export const WSPOLNE_W_WATKU = ['fontFamily', 'fontSize', 'fill', 'lineHeight', 'charSpacing', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'textAlign', 'lista', 'styl'];

// Kolejność czytania ramek: z góry na dół, a ramki leżące obok siebie – od lewej.
export function kolejnoscCzytania(ramki) {
  return [...ramki].sort((a, b) => {
    const obok = Math.min(a.top + a.getScaledHeight(), b.top + b.getScaledHeight()) - Math.max(a.top, b.top) > Math.min(a.getScaledHeight(), b.getScaledHeight()) / 2;
    return obok ? a.left - b.left : a.top - b.top;
  });
}
