// Szablony projektów (#208): cały projekt naraz – zestaw sekcji z ustawieniami, gotowy od razu do druku i do
// makiety 3D. To co innego niż szablony sekcji (js/gotowe-sekcje.js), które wstawia się do istniejącego projektu:
// np. „Książka w twardej oprawie” to okładka twarda + wyklejka przednia + blok z krotnością stron 16 + wyklejka tylna.
// Okładkę i treść bloku (planer, album) budują szablony sekcji – tu tylko ich zestaw i ustawienia.

import { nowyProjekt, nowaStrona, normalizujWydruk, normalizuj, uid, uporzadkujStrony } from './projekt.js';
import { przeliczOkladki } from './okladka.js';
import { domyslnaSpecjalna, dodajWyklejki } from './sekcje-specjalne.js';
import { domyslneStyle } from './style-tekstu.js';
import { wstawGotowaSekcje, usunPustyStart } from './gotowe-sekcje.js';
import { t } from './jezyk.js';

export const FORMATY_KSIAZKI = [
  ['148x210', 'A5 – 148 × 210 mm'],
  ['135x205', 'Książkowy – 135 × 205 mm'],
  ['125x195', 'Kieszonkowy – 125 × 195 mm'],
  ['170x240', 'B5 – 170 × 240 mm'],
  ['210x297', 'A4 – 210 × 297 mm'],
  ['210x210', 'Kwadrat – 210 × 210 mm'],
];
const STRONY = (od, krok, ile) => Array.from({ length: ile }, (_, i) => [String(od + i * krok), `${od + i * krok} stron`]);
const pytanieFormatu = (domyslny = '148x210', formaty = FORMATY_KSIAZKI) => ({ klucz: 'format', etykieta: t('szablonyProjektow.format'), typ: 'wybor', opcje: formaty, domyslna: domyslny });
const pytanieKrotnosci = (domyslna = '16', opcje = ['16', '8', '32', '4']) => ({
  klucz: 'skladka', etykieta: 'Krotność stron (składka)', typ: 'wybor', opcje: opcje.map((k) => [k, `po ${k} stron`]), domyslna,
});
const pytanieStron = (domyslna = '64', opcje = STRONY(16, 16, 30)) => ({ klucz: 'stron', etykieta: 'Stron bloku', typ: 'wybor', opcje, domyslna });

export const KATEGORIE_PROJEKTOW = [
  { id: 'ksiazki', nazwa: 'Książki' },
  { id: 'kalendarze', nazwa: 'Kalendarze' },
  { id: 'planery', nazwa: 'Planery i notesy' },
];

// sekcje: oprawa (okładka twarda/miękka/zeszytowa), wyklejki, obwoluta, podkladka; blok: puste strony z krotnością
// albo szablon sekcji (planer, album…) jako blok.
export const SZABLONY_PROJEKTOW = [
  {
    id: 'ksiazka-twarda', nazwa: 'Książka w twardej oprawie', kategoria: 'ksiazki', paleta: 'granat',
    opis: 'Okładka twarda, wyklejka przednia, blok z krotnością stron i wyklejka tylna – gotowa do makiety 3D.',
    slowa: 'ksiazka twarda oprawa wyklejki blok', oprawa: 'twarda', wyklejki: true,
    pytania: [pytanieFormatu(), pytanieStron(), pytanieKrotnosci()],
  },
  {
    id: 'ksiazka-twarda-obwoluta', nazwa: 'Książka w twardej oprawie z obwolutą', kategoria: 'ksiazki', paleta: 'zielen',
    opis: 'Jak twarda oprawa, a do tego obwoluta ze skrzydełkami – wymiary liczą się z okładki.',
    slowa: 'ksiazka twarda obwoluta skrzydelka wyklejki', oprawa: 'twarda', wyklejki: true, obwoluta: true,
    pytania: [pytanieFormatu(), pytanieStron(), pytanieKrotnosci()],
  },
  {
    id: 'ksiazka-miekka', nazwa: 'Książka w miękkiej oprawie', kategoria: 'ksiazki', paleta: 'terakota',
    opis: 'Okładka miękka klejona z grzbietem liczonym z liczby stron i blok z krotnością stron.',
    slowa: 'ksiazka miekka klejona oprawa blok', oprawa: 'miekka',
    pytania: [pytanieFormatu('135x205'), pytanieStron('128'), pytanieKrotnosci()],
  },
  {
    id: 'broszura', nazwa: 'Broszura zeszytowa', kategoria: 'ksiazki', paleta: 'pastel',
    opis: 'Okładka zeszytowa (szyta zszywkami) i środek – liczba stron podzielna przez 4.',
    slowa: 'broszura zeszyt zszywki katalog program', oprawa: 'zeszytowa',
    pytania: [pytanieFormatu('148x210', [['148x210', 'A5 – 148 × 210 mm'], ['210x297', 'A4 – 210 × 297 mm'], ['210x210', 'Kwadrat – 210 × 210 mm']]),
      pytanieStron('16', STRONY(8, 4, 15)), pytanieKrotnosci('4', ['4', '8', '16'])],
  },
  {
    id: 'planer-twardy', nazwa: 'Planer tygodniowy w twardej oprawie', kategoria: 'planery', paleta: 'zielen',
    opis: 'Okładka twarda i wyklejki, w środku 52 tygodnie z datami – blok liczy się z kalendarza.',
    slowa: 'planer tygodniowy kalendarz ksiazkowy twarda', oprawa: 'twarda', wyklejki: true, blok: 'planer-tygodniowy',
    pytania: [pytanieFormatu('148x210', FORMATY_KSIAZKI.slice(0, 5))],
  },
  {
    id: 'notes-miekki', nazwa: 'Planer dzienny w miękkiej oprawie', kategoria: 'planery', paleta: 'terakota',
    opis: 'Okładka miękka, w środku strona na każdy dzień roku.',
    slowa: 'planer dzienny kalendarz ksiazkowy miekka notes', oprawa: 'miekka', blok: 'planer-dzienny',
    pytania: [pytanieFormatu('148x210', FORMATY_KSIAZKI.slice(0, 5))],
  },
  {
    id: 'album-twardy', nazwa: 'Album ze zdjęciami w twardej oprawie', kategoria: 'ksiazki', paleta: 'mono',
    opis: 'Okładka twarda, wyklejki i rozkładówki na zdjęcia.',
    slowa: 'album zdjecia fotoksiazka twarda', oprawa: 'twarda', wyklejki: true, blok: 'album',
    pytania: [pytanieFormatu('210x210', [['210x210', 'Kwadrat – 210 × 210 mm'], ['297x210', 'A4 poziomo – 297 × 210 mm'], ['210x297', 'A4 – 210 × 297 mm']])],
  },
  {
    id: 'kalendarz-scienny-plecy', nazwa: 'Kalendarz ścienny z plecami', kategoria: 'kalendarze', paleta: 'zielen',
    opis: 'Okładka i 12 miesięcy na spiralę, a pod spodem karton (plecy).',
    slowa: 'kalendarz scienny spirala plecy podkladka', blok: 'kalendarz-scienny', podkladka: true,
    pytania: [pytanieFormatu('210x297', [['210x297', 'A4 – 210 × 297 mm'], ['297x420', 'A3 – 297 × 420 mm'], ['240x330', 'Wąski – 240 × 330 mm']])],
  },
];

export const szablonProjektu = (id) => SZABLONY_PROJEKTOW.find((s) => s.id === id) || null;

export function domyslneOpcjeProjektu(szablon) {
  const o = {};
  for (const p of szablon.pytania || []) o[p.klucz] = typeof p.domyslna === 'function' ? p.domyslna() : p.domyslna;
  return o;
}

const OPRAWY = { twarda: 'Okładka twarda', miekka: 'Okładka miękka', zeszytowa: 'Okładka zeszytowa' };

// Krótki opis zestawu sekcji – na karcie i w szczegółach.
export function sekcjeSzablonu(szablon, odpowiedzi = domyslneOpcjeProjektu(szablon)) {
  const o = { ...domyslneOpcjeProjektu(szablon), ...odpowiedzi };
  const blok = szablon.blok ? 'blok z szablonu' : `blok ${o.stron} stron (krotność ${o.skladka})`;
  return [
    szablon.oprawa && OPRAWY[szablon.oprawa],
    szablon.obwoluta && 'obwoluta',
    szablon.wyklejki && 'wyklejka przednia',
    blok,
    szablon.wyklejki && 'wyklejka tylna',
    szablon.podkladka && 'plecy (karton)',
  ].filter(Boolean);
}

// Sekcja specjalna bez treści (obwoluta, plecy) – format i wynik policzy przeliczenie okładek.
function pustaSekcja(projekt, typ, nazwa, wzor) {
  const sekcja = {
    id: uid('sek'), nazwa, typ, wydruk: JSON.parse(JSON.stringify(wzor)), uklad: 'pojedyncze', pierwsza: 'prawa', wzorce: [],
    numeracja: { tryb: 'brak', od: 1 },
    ...(typ === 'obwoluta' ? { specjalna: domyslnaSpecjalna('obwoluta') } : {}),
  };
  projekt.strony.push(nowaStrona(nazwa, sekcja.id));
  return sekcja;
}

// Buduje cały projekt z szablonu. opcje: { nazwa, odpowiedzi, paleta (obiekt albo klucz), czcionki }.
export async function zbudujProjekt(id, opcje = {}) {
  const sz = szablonProjektu(id);
  if (!sz) throw new Error(`Nie ma szablonu projektu „${id}”.`);
  const o = { ...domyslneOpcjeProjektu(sz), ...(opcje.odpowiedzi || {}) };
  const [w, h] = String(o.format || '148x210').split('x').map(Number);
  const wydruk = normalizujWydruk({ format: 'wlasny', szerokosc_mm: w, wysokosc_mm: h, spad_mm: 3, marginesy_mm: Math.round(Math.min(w, h) * 0.1), znaki_ciecia: true });
  const p = nowyProjekt(opcje.nazwa || sz.nazwa, wydruk, 'rozkladowki');
  p.style = domyslneStyle();
  const wspolne = { wydruk, wlasnyFormat: false, paleta: opcje.paleta || sz.paleta, czcionki: opcje.czcionki };
  let blok = p.sekcje[0];
  if (sz.blok) {
    const { sekcja } = await wstawGotowaSekcje(p, sz.blok, wspolne);
    usunPustyStart(p, sekcja);
    blok = sekcja;
  } else {
    blok.skladka = Number(o.skladka) || 16;
    const ile = Math.max(blok.skladka, Math.ceil((Number(o.stron) || 16) / blok.skladka) * blok.skladka);
    for (let i = 1; i < ile; i += 1) p.strony.push(nowaStrona(`Strona ${i + 1}`, blok.id));
  }
  blok.typ = 'blok';
  blok.nazwa = sz.blok ? blok.nazwa : 'Blok (środek)';
  if (sz.oprawa) {
    const { sekcja } = await wstawGotowaSekcje(p, 'okladka-ksiazki', { ...wspolne, wlasnyFormat: true, odpowiedzi: { oprawa: sz.oprawa } });
    sekcja.nazwa = OPRAWY[sz.oprawa];
    sekcja.typ = 'okladka';
  }
  if (sz.wyklejki) dodajWyklejki(p);
  if (sz.obwoluta) {
    const okl = p.sekcje.findIndex((s) => s.typ === 'okladka');
    p.sekcje.splice(okl + 1, 0, pustaSekcja(p, 'obwoluta', 'Obwoluta', blok.wydruk));
  }
  if (sz.podkladka) p.sekcje.push(pustaSekcja(p, 'podkladka', 'Plecy (karton)', blok.wydruk));
  uporzadkujStrony(p);
  const wynik = normalizuj(p);
  przeliczOkladki(wynik);
  return wynik;
}
