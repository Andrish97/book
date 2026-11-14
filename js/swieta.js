// Polskie święta i dni wolne (decyzja #131A, element „Kalendarz miesiąca”).
// Święta stałe z ustawy o dniach wolnych od pracy, ruchome liczone od Wielkanocy (algorytm Meeusa/Jonesa/Butchera
// dla kalendarza gregoriańskiego). Wigilia jest dniem wolnym od 2025 roku.

const iso = (r, m, d) => `${r}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Niedziela Wielkanocna: { miesiac (1–12), dzien }.
export function wielkanoc(rok) {
  const a = rok % 19;
  const b = Math.floor(rok / 100);
  const c = rok % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const miesiac = Math.floor((h + l - 7 * m + 114) / 31);
  const dzien = ((h + l - 7 * m + 114) % 31) + 1;
  return { miesiac, dzien };
}

const STALE = [
  [1, 1, 'Nowy Rok'], [1, 6, 'Trzech Króli'], [5, 1, 'Święto Pracy'], [5, 3, 'Święto Konstytucji 3 Maja'],
  [8, 15, 'Wniebowzięcie NMP'], [11, 1, 'Wszystkich Świętych'], [11, 11, 'Święto Niepodległości'],
  [12, 25, 'Boże Narodzenie'], [12, 26, 'Drugi dzień Bożego Narodzenia'],
];

// Mapa 'RRRR-MM-DD' → nazwa święta (dni wolne od pracy w Polsce).
export function swietaPolskie(rok) {
  const mapa = new Map();
  for (const [m, d, nazwa] of STALE) mapa.set(iso(rok, m, d), nazwa);
  if (rok >= 2025) mapa.set(iso(rok, 12, 24), 'Wigilia');
  const w = wielkanoc(rok);
  const odWielkanocy = (dni, nazwa) => {
    const t = new Date(Date.UTC(rok, w.miesiac - 1, w.dzien + dni));
    mapa.set(iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()), nazwa);
  };
  odWielkanocy(0, 'Wielkanoc');
  odWielkanocy(1, 'Poniedziałek Wielkanocny');
  odWielkanocy(49, 'Zielone Świątki');
  odWielkanocy(60, 'Boże Ciało');
  return mapa;
}

// Data z tekstu komórki: 'RRRR-MM-DD', 'DD.MM.RRRR', 'DD/MM/RRRR' albo 'DD.MM' (co roku).
// Zwraca { rok | null, miesiac, dzien } albo null.
export function dataZTekstu(tekst) {
  const t = String(tekst ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { rok: Number(m[1]), miesiac: Number(m[2]), dzien: Number(m[3]) };
  m = t.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}))?$/);
  if (m) return { rok: m[3] ? Number(m[3]) : null, miesiac: Number(m[2]), dzien: Number(m[1]) };
  return null;
}

export { iso as dataIso };
