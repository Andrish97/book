// Strona lewa ↔ prawa w rozkładówkach (zgłoszenie 19.11: „żeby układ miał prawo/lewo i sam przeskakiwał po dodaniu
// strony, a elementy same wiedziały, co i jak”).
//
// Strona pamięta, dla której strony rozkładówki ułożono jej elementy: `strona.bok_ukladu` ('lewa' | 'prawa').
// Gdy po dodaniu, usunięciu albo przesunięciu stron (albo zmianie „pierwszej strony sekcji”) trafia na drugą stronę,
// jej układ odbija się lustrzanie względem środka strony – element przy zewnętrznej krawędzi zostaje przy
// zewnętrznej, przy grzbiecie – przy grzbiecie. Marginesy wewnętrzny i zewnętrzny zamieniają się same (sekcja),
// więc ramka wpasowana w marginesy trafia dokładnie w nowe marginesy. Treść się nie odbija (tekst, obrazy
// i obrót zostają); wyrównanie tekstu do krawędzi, przy której stoi wąski element (numer, podpis), przechodzi
// na drugą stronę razem z nim.
//
// Bez wyjątków: element z `stala_pozycja` zostaje na miejscu (np. coś, co ma być zawsze z lewej), a element, który
// wychodzi przez grzbiet na sąsiednią stronę rozkładówki, należy do pary stron – nie przenosi się.

const rad = (st) => ((st || 0) * Math.PI) / 180;

// Prostokąt elementu (zapis JSON) na stronie: środek i zasięg w osi x (z obrotem).
function geometria(o) {
  const w = (o.width || 0) * Math.abs(o.scaleX ?? 1);
  const h = (o.height || 0) * Math.abs(o.scaleY ?? 1);
  const ox = o.originX === 'center' ? 0 : o.originX === 'right' ? -w / 2 : w / 2;
  const oy = o.originY === 'center' ? 0 : o.originY === 'bottom' ? -h / 2 : h / 2;
  const a = rad(o.angle);
  const cx = (o.left || 0) + ox * Math.cos(a) - oy * Math.sin(a);
  const pol = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
  return { cx, x1: cx - pol, x2: cx + pol, szer: 2 * pol };
}

// Element (zapis JSON) przeniesiony na lustrzane miejsce strony o szerokości W. Zwraca nowy obiekt.
export function odbityElement(o, W) {
  if (!o || o.stala_pozycja) return o;
  const g = geometria(o);
  if (g.x1 < -1 || g.x2 > W + 1) return o; // przez grzbiet albo poza stronę – należy do rozkładówki
  const n = { ...o, left: (o.left || 0) + (W - 2 * g.cx) };
  // Wąski tekst przy krawędzi wyrównany do niej (numer strony, podpis) – wyrównanie idzie za krawędzią.
  if (typeof o.textAlign === 'string' && g.szer < 0.6 * W) {
    const przy = g.cx < W / 2 ? 'left' : 'right';
    if (o.textAlign === przy) n.textAlign = przy === 'left' ? 'right' : 'left';
  }
  return n;
}

export const odbiteElementy = (obiekty, W) => (obiekty || []).map((o) => odbityElement(o, W));

// Elementy strony w układzie dla danego boku (do rysowania egzemplarza: podgląd, druk, miniatury, sąsiednia strona).
export function elementyNaBok(strona, bok, W) {
  if (!bok || !strona.bok_ukladu || strona.bok_ukladu === bok) return strona.obiekty;
  return odbiteElementy(strona.obiekty, W);
}

// Edytor: przed wczytaniem strony jej zapis przechodzi na bieżący bok (raz – potem strona już na nim „jest”).
// Strona bez zapamiętanego boku (starszy projekt, nowa strona) – tylko zapamiętuje bieżący. Zwraca true, gdy
// elementy się przesunęły.
export function uzgodnijBokStrony(strona, bok, W) {
  if (!bok) return false;
  if (!strona.bok_ukladu) { strona.bok_ukladu = bok; return false; }
  if (strona.bok_ukladu === bok) return false;
  strona.obiekty = odbiteElementy(strona.obiekty, W);
  strona.bok_ukladu = bok;
  return true;
}
