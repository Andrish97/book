// Obrazy ze schowka systemu: zrzut ekranu, obraz skopiowany ze strony albo
// z programu graficznego, plik skopiowany w menedżerze plików, kod SVG.

const TYPY = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
const ROZSZERZENIA = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

// Porządkuje kod SVG tak, żeby przeglądarka wczytała go jako obraz o znanym
// rozmiarze: przestrzeń nazw, szerokość i wysokość (z viewBox, gdy ich brak),
// bez skryptów. Małe rysunki (ikony) dostają większy rozmiar bazowy – to wektor,
// więc nic nie tracą, a na stronie nie wychodzą rozmyte. Zwraca tekst albo null.
export function uporzadkujSvg(tekst) {
  const poczatek = tekst.indexOf('<svg');
  const koniec = tekst.lastIndexOf('</svg>');
  if (poczatek < 0 || koniec < 0) return null;
  const dok = new DOMParser().parseFromString(tekst.slice(poczatek, koniec + 6), 'image/svg+xml');
  const svg = dok.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || dok.querySelector('parsererror')) return null;
  for (const s of [...dok.querySelectorAll('script, foreignObject')]) s.remove();
  if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const liczba = (v) => (/^\s*[\d.]+(px)?\s*$/.test(v || '') ? parseFloat(v) : null);
  let w = liczba(svg.getAttribute('width'));
  let h = liczba(svg.getAttribute('height'));
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const maVb = vb.length === 4 && vb[2] > 0 && vb[3] > 0;
  if (maVb) {
    if (w && !h) h = (w * vb[3]) / vb[2];
    else if (h && !w) w = (h * vb[2]) / vb[3];
    else if (!w && !h) { [, , w, h] = vb; }
  }
  if (!w || !h) { w = 300; h = 150; }
  if (!maVb) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const k = Math.max(1, 1200 / Math.max(w, h));
  svg.setAttribute('width', String(Math.round(w * k)));
  svg.setAttribute('height', String(Math.round(h * k)));
  return new XMLSerializer().serializeToString(svg);
}

// Plik SVG z dysku albo ze schowka → uporządkowany plik SVG (albo ten sam, gdy się nie da).
export async function uporzadkujPlikSvg(plik) {
  const tekst = uporzadkujSvg(await plik.text());
  return tekst ? new File([tekst], plik.name, { type: 'image/svg+xml' }) : plik;
}

// Obrazy w schowku (z zdarzenia „paste”): pliki obrazów, a gdy ich nie ma – kod SVG wklejony jako tekst.
export function obrazyZeSchowka(schowek) {
  if (!schowek) return [];
  const pliki = [...(schowek.files || [])].filter((p) => TYPY.includes(p.type));
  if (pliki.length) {
    const czas = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
    // Zrzut ekranu ze schowka nazywa się zwykle „image.png” – dajemy nazwę, po której da się go znaleźć w warstwach.
    return pliki.map((p, i) => (/^image\.\w+$/i.test(p.name) || !p.name
      ? new File([p], `wklejony ${czas}${pliki.length > 1 ? ` (${i + 1})` : ''}.${ROZSZERZENIA[p.type]}`, { type: p.type })
      : p));
  }
  const tekst = schowek.getData('text/plain') || '';
  if (/<svg[\s>]/i.test(tekst) && tekst.length < 5_000_000) {
    const svg = uporzadkujSvg(tekst);
    if (svg) return [new File([svg], 'wklejony.svg', { type: 'image/svg+xml' })];
  }
  return [];
}
