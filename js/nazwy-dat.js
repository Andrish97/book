// Nazwy miesięcy i dni w języku treści (#409): pl, en, uk. Kalendarze i planery zapamiętują język z chwili
// utworzenia (pole jezyk), żeby zmiana języka interfejsu nie zmieniała wydruku; domyślnie – język interfejsu.
import { biezacyJezyk } from './jezyk.js';

const LOKALE = { pl: 'pl-PL', en: 'en-GB', uk: 'uk-UA' };
const jaki = (j) => (LOKALE[j] ? j : (LOKALE[biezacyJezyk()] ? biezacyJezyk() : 'pl'));
const fmt = (j, opcje, d) => new Intl.DateTimeFormat(LOKALE[jaki(j)], { timeZone: 'UTC', ...opcje }).format(d);
const pamiec = new Map();
const zPamieci = (klucz, fn) => { if (!pamiec.has(klucz)) pamiec.set(klucz, fn()); return pamiec.get(klucz); };
const wielka = (s) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);

// Miesiące małą literą: „styczeń”, „January”, „січень”.
export const miesiace = (j) => zPamieci(`m|${jaki(j)}`, () => Array.from({ length: 12 }, (_, i) => {
  if (jaki(j) === 'pl') return ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'][i];
  const n = fmt(j, { month: 'long' }, new Date(Date.UTC(2021, i, 1)));
  return jaki(j) === 'en' ? n : n.toLocaleLowerCase();
}));
export const miesiaceWielka = (j) => miesiace(j).map((m) => (jaki(j) === 'en' ? m : wielka(m)));
// Miesiąc w dacie: „5 września”, „5 September”, „5 вересня” – sama nazwa.
export const miesiaceDopelniacz = (j) => zPamieci(`d|${jaki(j)}`, () => Array.from({ length: 12 }, (_, i) => fmt(j, { day: 'numeric', month: 'long' }, new Date(Date.UTC(2021, i, 5))).replace(/[\d.\s]+/g, ' ').trim()));
export const dataSlownie = (d, j) => `${d.getUTCDate()} ${miesiaceDopelniacz(j)[d.getUTCMonth()]}`;
// Dni od niedzieli (jak getUTCDay), pełne małą literą.
export const dni = (j) => zPamieci(`n|${jaki(j)}`, () => Array.from({ length: 7 }, (_, i) => {
  const n = fmt(j, { weekday: 'long' }, new Date(Date.UTC(2021, 0, 3 + i)));
  return jaki(j) === 'en' ? n : n.toLocaleLowerCase();
}));
const KROTKIE = { pl: ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'], en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], uk: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] };
const LITERY = { pl: ['N', 'P', 'W', 'Ś', 'C', 'P', 'S'], en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], uk: ['Н', 'П', 'В', 'С', 'Ч', 'П', 'С'] };
export const dniKrotkie = (j) => KROTKIE[jaki(j)];
export const dniLitery = (j) => LITERY[jaki(j)];
// Od poniedziałku.
const odPon = (l) => [...l.slice(1), l[0]];
export const dniKrotkieOdPon = (j) => odPon(dniKrotkie(j));
export const dniLiteryOdPon = (j) => odPon(dniLitery(j));
export const dniOdPon = (j) => odPon(dni(j));
export const jezykTresci = (j) => jaki(j);
