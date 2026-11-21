// Rozbudowa Biblioteki kształtów (#155): więcej figur, gwiazd i odznak, symboli, natury, okolicznościowych,
// znaków, strzałek, dymków, wstęg, narożników i ornamentów, separatorów oraz ramek (proste, zaokrąglone,
// podwójne i przerywane, ozdobne, z miejscem na tytuł, kartki, na zdjęcie, w kształcie, obramowania stron).
// Własne ścieżki w polu 100 × 100 (bez cudzych licencji). Format wpisu jak w js/ksztalty-biblioteka.js:
// [id, nazwa, grupa, słowa do wyszukiwania, ścieżka, opcje]
// opcje: otwarta (linia), otwor (evenodd), kontur (sam obrys; kreski: rodzaj linii), naZdjecie (pole na obraz),
//        strona (obramowanie strony – wstawiane na całą stronę w marginesach).

import {
  punkty, okrag, elipsa, prost, zaokr, naOkregu, wielokat, gwiazda, zaokraglony, falistyKrag, falistyProst,
  zabkowanyProst, serce, przenies, lustroX, lustroY, obroc, ramkaProst, ramkaProstNZ, ramkaZaokr,
} from './ksztalty-geometria.js';
import { t as tt } from './jezyk.js';

// ---------- Pomocnicze kształty ----------

// Płatki z elips (kwiaty, rozety): n płatków o długości dl i szerokości sz od środka.
function platki(n, dl = 26, sz = 11, { cx = 50, cy = 50, od = 8 } = {}) {
  let d = '';
  for (let i = 0; i < n; i += 1) {
    const kat = (i * 360) / n;
    const p = elipsa(50, 50 - od - dl / 2, sz, dl / 2);
    d += `${przenies(obroc(p, kat), cx, cy, 1)} `;
  }
  return d.trim();
}

// Zębatka: n zębów.
function zebatka(n = 10, rz = 45, rw = 36, otwor = 13) {
  const p = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i * 2 * Math.PI) / n - Math.PI / 2;
    const k = Math.PI / n;
    for (const [r, da] of [[rw, -k * 0.95], [rz, -k * 0.45], [rz, k * 0.45], [rw, k * 0.95]]) p.push([50 + r * Math.cos(a + da), 50 + r * Math.sin(a + da)]);
  }
  return `${punkty(p)} ${okrag(50, 50, otwor)}`;
}

// Chorągiewki: trójkąty pod linią.
function choragiewki(n = 5) {
  const w = 90 / n;
  let d = 'M 5 20 L 95 20 L 95 23 L 5 23 Z';
  for (let i = 0; i < n; i += 1) d += ` ${punkty([[5 + i * w + 1, 23], [5 + (i + 1) * w - 1, 23], [5 + (i + 0.5) * w, 60]])}`;
  return d;
}

// Obramowanie strony z powtarzanego motywu na obwodzie (pole 70 × 100, proporcje strony A).
function obwodzik(motyw, krok = 7, { x = 15, y = 2, w = 70, h = 96 } = {}) {
  let d = '';
  const nx = Math.round(w / krok);
  const ny = Math.round(h / krok);
  const sx = w / nx;
  const sy = h / ny;
  for (let i = 0; i <= nx; i += 1) d += `${motyw(x + i * sx, y)} ${motyw(x + i * sx, y + h)} `;
  for (let j = 1; j < ny; j += 1) d += `${motyw(x, y + j * sy)} ${motyw(x + w, y + j * sy)} `;
  return d.trim();
}

const romb = (cx, cy, r) => punkty([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]]);

// Ramka na zdjęcie w kształcie – pierścień między dwoma kształtami.
const pierscien = (zew, wew) => `${zew} ${wew}`;

// Narożnik ozdobny w lewym górnym rogu (pozostałe – lustrem).
const narozniki = (d) => `${d} ${lustroX(d)} ${lustroY(d)} ${lustroX(lustroY(d))}`;

// Strzałka blokowa w prawo w prostokącie (x0..x1, grubość t, grot g).
const strzalkaBlok = (t = 30, g = 35) => `M 5 ${50 - t / 2} L ${95 - g} ${50 - t / 2} L ${95 - g} ${50 - t / 2 - 18} L 95 50 L ${95 - g} ${50 + t / 2 + 18} L ${95 - g} ${50 + t / 2} L 5 ${50 + t / 2} Z`;

const GALAZKA = `M 48 97 L 52 97 L 52 8 L 48 8 Z ${[20, 42, 64].map((y) => `${przenies(obroc(elipsa(50, 50, 8, 18), 50), 34, y, 0.75)} ${przenies(obroc(elipsa(50, 50, 8, 18), -50), 66, y + 6, 0.75)}`).join(' ')}`;

// ---------- Wpisy ----------

export const DEF_WIECEJ = [
  // ===== Kształty: Podstawowe =====
  ['kwadrat', tt('ksztaltyWiecej.kwadrat'), 'Podstawowe', 'kwadrat', prost(8, 8, 84, 84)],
  ['kolo', tt('ksztaltyWiecej.kolo'), 'Podstawowe', 'kolo okrag', okrag(50, 50, 45)],
  ['owal-poziomy', tt('ksztaltyWiecej.owalPoziomy'), 'Podstawowe', 'owal elipsa', elipsa(50, 50, 46, 30)],
  ['owal-pionowy', tt('ksztaltyWiecej.owalPionowy'), 'Podstawowe', 'owal elipsa jajko', elipsa(50, 50, 30, 46)],
  ['cwiartka', tt('ksztaltyWiecej.cwiartkaKola'), 'Podstawowe', 'cwiartka kola wycinek', 'M 8 92 L 8 8 A 84 84 0 0 1 92 92 Z'],
  ['wycinek', tt('ksztaltyWiecej.wycinekKola'), 'Podstawowe', 'wycinek kola pacman wykres', 'M 50 50 L 90 27 A 46 46 0 1 0 90 73 Z'],
  ['pierscien', tt('ksztaltyWiecej.pierscien'), 'Podstawowe', 'pierscien obwarzanek kolo otwor', `${okrag(50, 50, 45)} ${okrag(50, 50, 27)}`, { otwor: true }],
  ['luk-gruby', tt('ksztaltyWiecej.lukGruby'), 'Podstawowe', 'luk tecza polpierscien', 'M 5 80 A 45 45 0 0 1 95 80 L 75 80 A 25 25 0 0 0 25 80 Z'],
  ['trojkat-dol', tt('ksztaltyWiecej.trojkatOdwrocony'), 'Podstawowe', 'trojkat odwrocony w dol', 'M 5 8 L 95 8 L 50 95 Z'],
  ['trojkat-bok', tt('ksztaltyWiecej.trojkatBokiem'), 'Podstawowe', 'trojkat bok', 'M 8 5 L 95 50 L 8 95 Z'],
  ['latawiec', tt('ksztaltyWiecej.latawiec'), 'Podstawowe', 'latawiec deltoid', 'M 50 3 L 82 38 L 50 97 L 18 38 Z'],
  ['soczewka', tt('ksztaltyWiecej.soczewka'), 'Podstawowe', 'soczewka oko liść', 'M 5 50 A 60 60 0 0 1 95 50 A 60 60 0 0 1 5 50 Z'],
  ['scieta-naroze', tt('ksztaltyWiecej.prostokatZeScietymRogiem'), 'Podstawowe', 'prostokat sciety rog', 'M 8 8 L 70 8 L 92 30 L 92 92 L 8 92 Z'],
  ['sciete-dwa', tt('ksztaltyWiecej.prostokatZeScietymiRogami'), 'Podstawowe', 'prostokat sciete rogi', 'M 25 10 L 92 10 L 92 73 L 75 90 L 8 90 L 8 27 Z'],
  ['zaokr-jeden', tt('ksztaltyWiecej.prostokatZJednymZaokraglonym'), 'Podstawowe', 'prostokat zaokraglony rog', 'M 8 8 L 62 8 A 30 30 0 0 1 92 38 L 92 92 L 8 92 Z'],
  ['zaokr-przekatna', tt('ksztaltyWiecej.liscProstokatny'), 'Podstawowe', 'prostokat zaokraglone przeciwne rogi lisc', 'M 38 8 L 92 8 L 92 62 A 30 30 0 0 1 62 92 L 8 92 L 8 38 A 30 30 0 0 1 38 8 Z'],
  ['squircle', tt('ksztaltyWiecej.kwadratMiekki'), 'Podstawowe', 'kwadrat zaokraglony ikona aplikacji', 'M 50 5 C 88 5 95 12 95 50 C 95 88 88 95 50 95 C 12 95 5 88 5 50 C 5 12 12 5 50 5 Z'],
  ['kostka', tt('ksztaltyWiecej.szescian'), 'Podstawowe', 'szescian kostka 3d pudelko', 'M 50 5 L 90 27 L 90 73 L 50 95 L 10 73 L 10 27 Z M 50 49 L 90 27 M 50 49 L 10 27 M 50 49 L 50 95'],
  ['walec', tt('ksztaltyWiecej.walec'), 'Podstawowe', 'walec beczka baza danych', `M 12 20 A 38 12 0 0 1 88 20 L 88 80 A 38 12 0 0 1 12 80 Z ${elipsa(50, 20, 38, 12)}`, { otwor: true }],
  ['polowa-kola-pion', tt('ksztaltyWiecej.polkoleBokiem'), 'Podstawowe', 'polkole bok', 'M 28 5 A 45 45 0 0 1 28 95 Z'],
  ['blok-falisty', tt('ksztaltyWiecej.prostokatFalisty'), 'Podstawowe', 'prostokat falisty dokument flaga', 'M 8 10 L 92 10 L 92 80 C 72 70 56 96 36 88 C 24 83 16 80 8 84 Z'],
  ['kapsula-pion', tt('ksztaltyWiecej.kapsulaPionowa'), 'Podstawowe', 'kapsula pigulka pion', zaokr(30, 5, 40, 90, 20)],

  ['reuleaux', tt('ksztaltyWiecej.trojkatLukowy'), 'Podstawowe', 'trojkat lukowy reuleaux', 'M 50 8 A 84 84 0 0 1 92.4 81 A 84 84 0 0 1 7.6 81 A 84 84 0 0 1 50 8 Z'],
  ['kwadrat-otwor', tt('ksztaltyWiecej.kwadratZOkraglymOtworem'), 'Podstawowe', 'kwadrat otwor kolo', `${prost(6, 6, 88, 88)} ${okrag(50, 50, 28)}`, { otwor: true }],
  ['kolo-otwor-kw', tt('ksztaltyWiecej.koloZKwadratowymOtworem'), 'Podstawowe', 'kolo otwor kwadrat moneta', `${okrag(50, 50, 45)} ${prost(32, 32, 36, 36)}`, { otwor: true }],
  ['polelipsa', tt('ksztaltyWiecej.polelipsa'), 'Podstawowe', 'polelipsa kopula', 'M 5 72 A 45 42 0 0 1 95 72 Z'],
  ['domek-ksztalt', tt('ksztaltyWiecej.pieciokatDomek'), 'Podstawowe', 'domek pieciokat dach', 'M 50 5 L 95 40 L 95 95 L 5 95 L 5 40 Z'],
  ['trapez-odwr', tt('ksztaltyWiecej.trapezOdwrocony'), 'Podstawowe', 'trapez odwrocony kubek', 'M 3 15 L 97 15 L 78 85 L 22 85 Z'],

  // ===== Kształty: Wielokąty =====
  ['trojkat-foremny', tt('ksztaltyWiecej.trojkatRownoboczny'), 'Wielokąty', 'trojkat rownoboczny foremny', wielokat(3)],
  ['szesnastokat', tt('ksztaltyWiecej.szesnastokat'), 'Wielokąty', 'szesnastokat prawie kolo', wielokat(16)],
  ['dziewieciokat', tt('ksztaltyWiecej.dziewieciokat'), 'Wielokąty', 'dziewieciokat', wielokat(9)],
  ['dziesieciokat', tt('ksztaltyWiecej.dziesieciokat'), 'Wielokąty', 'dziesieciokat', wielokat(10)],
  ['dwunastokat', tt('ksztaltyWiecej.dwunastokat'), 'Wielokąty', 'dwunastokat', wielokat(12)],
  ['szesciokat-pion', tt('ksztaltyWiecej.szesciokatPionowy'), 'Wielokąty', 'szesciokat plaster pion', wielokat(6)],
  ['trojkat-zaokr', tt('ksztaltyWiecej.trojkatZaokraglony'), 'Wielokąty', 'trojkat zaokraglony', zaokraglony(naOkregu(3, 47), 0.2)],
  ['kwadrat-zaokr-romb', tt('ksztaltyWiecej.rombZaokraglony'), 'Wielokąty', 'romb zaokraglony', zaokraglony(naOkregu(4, 46), 0.2)],
  ['pieciokat-zaokr', tt('ksztaltyWiecej.pieciokatZaokraglony'), 'Wielokąty', 'pieciokat zaokraglony', zaokraglony(naOkregu(5, 46), 0.2)],
  ['szesciokat-zaokr', tt('ksztaltyWiecej.szesciokatZaokraglony'), 'Wielokąty', 'szesciokat zaokraglony plaster', zaokraglony(naOkregu(6, 46, { obrot: 0 }), 0.2)],
  ['osmiokat-zaokr', tt('ksztaltyWiecej.osmiokatZaokraglony'), 'Wielokąty', 'osmiokat zaokraglony', zaokraglony(naOkregu(8, 46, { obrot: Math.PI / 8 }), 0.2)],
  ['plaster-miodu', tt('ksztaltyWiecej.plasterMiodu'), 'Wielokąty', 'plaster miodu szesciokaty siatka', [[50, 50], ...naOkregu(6, 30.5, { obrot: -Math.PI / 2 })].map(([x, y]) => przenies(wielokat(6, 0), x, y, 0.36)).join(' ')],

  // ===== Kształty: Gwiazdy i odznaki =====
  ['gwiazda5-gruba', tt('ksztaltyWiecej.gwiazdaPulchna'), 'Gwiazdy i odznaki', 'gwiazda gruba pulchna', gwiazda(5, 0.6)],
  ['gwiazda5-smukla', tt('ksztaltyWiecej.gwiazdaSmukla'), 'Gwiazdy i odznaki', 'gwiazda smukla ostra', gwiazda(5, 0.3)],
  ['gwiazda5-zaokr', tt('ksztaltyWiecej.gwiazdaZaokraglona'), 'Gwiazdy i odznaki', 'gwiazda zaokraglona miekka', zaokraglony(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 21 : 46; const a = -Math.PI / 2 + (i * Math.PI) / 5; return [50 + r * Math.cos(a), 52 + r * Math.sin(a)]; }), 0.18)],
  ['gwiazda10', tt('ksztaltyWiecej.gwiazdaDziesiecioramienna'), 'Gwiazdy i odznaki', 'gwiazda', gwiazda(10, 0.6)],
  ['gwiazda12', tt('ksztaltyWiecej.gwiazdaDwunastoramienna'), 'Gwiazdy i odznaki', 'gwiazda', gwiazda(12, 0.7)],
  ['gwiazda-polarna', tt('ksztaltyWiecej.gwiazdaPolarna'), 'Gwiazdy i odznaki', 'gwiazda polarna kompas betlejemska', `${gwiazda(4, 0.18)} ${przenies(gwiazda(4, 0.18, -Math.PI / 4), 50, 50, 0.6)}`],
  ['gwiazda-w-kole', tt('ksztaltyWiecej.gwiazdaWKole'), 'Gwiazdy i odznaki', 'gwiazda kolo odznaka', `${okrag(50, 50, 46)} ${przenies(gwiazda(5, 0.42), 50, 52, 0.75)}`, { otwor: true }],
  ['iskry', tt('ksztaltyWiecej.iskierki'), 'Gwiazdy i odznaki', 'iskry blysk gwiazdki magia nowosc', `${przenies(gwiazda(4, 0.25), 40, 55, 0.85)} ${przenies(gwiazda(4, 0.25), 80, 20, 0.35)} ${przenies(gwiazda(4, 0.25), 82, 78, 0.25)}`],
  ['pieczec-falista', tt('ksztaltyWiecej.pieczecFalista'), 'Gwiazdy i odznaki', 'pieczec rozeta odznaka falista', falistyKrag(16, 40)],
  ['pieczec-falista-ring', tt('ksztaltyWiecej.pieczecFalistaZObwodka'), 'Gwiazdy i odznaki', 'pieczec rozeta odznaka certyfikat', `${falistyKrag(18, 40)} ${okrag(50, 50, 33)} ${okrag(50, 50, 30)}`, { otwor: true }],
  ['odznaka-szesciokat', tt('ksztaltyWiecej.odznakaSzesciokatna'), 'Gwiazdy i odznaki', 'odznaka szesciokat plakietka', `${zaokraglony(naOkregu(6, 46, { obrot: 0 }), 0.15)} ${zaokraglony(naOkregu(6, 38, { obrot: 0 }), 0.15)} ${zaokraglony(naOkregu(6, 34, { obrot: 0 }), 0.15)}`, { otwor: true }],
  ['odznaka-tarcza', tt('ksztaltyWiecej.odznakaTarczaZGwiazda'), 'Gwiazdy i odznaki', 'odznaka tarcza gwiazda szeryf', `M 50 4 L 92 18 C 92 60 75 82 50 96 C 25 82 8 60 8 18 Z ${przenies(gwiazda(5, 0.42), 50, 44, 0.5)}`, { otwor: true }],
  ['medal', tt('ksztaltyWiecej.medal'), 'Gwiazdy i odznaki', 'medal nagroda zwyciezca', `M 30 2 L 44 2 L 54 34 L 40 34 Z M 70 2 L 56 2 L 46 34 L 60 34 Z ${okrag(50, 62, 32)} ${okrag(50, 62, 24)} ${przenies(gwiazda(5, 0.45), 50, 63, 0.38)}`, { otwor: true }],
  ['zebatka', tt('ksztaltyWiecej.zebatka'), 'Gwiazdy i odznaki', 'zebatka kolo zebate ustawienia mechanizm', zebatka(10), { otwor: true }],
  ['wybuch-maly', tt('ksztaltyWiecej.wybuchMaly'), 'Gwiazdy i odznaki', 'wybuch promocja cena okazja', gwiazda(18, 0.78, 0.1)],
  ['odznaka-promocja', tt('ksztaltyWiecej.odznakaPromocyjna'), 'Gwiazdy i odznaki', 'promocja rabat okazja naklejka', `${gwiazda(20, 0.86)} ${okrag(50, 50, 32)}`, { otwor: true }],

  // ===== Kształty: Serca i natura =====
  ['serce-smukle', tt('ksztaltyWiecej.serceSmukle'), 'Serca i natura', 'serce smukle milosc', 'M 50 95 C 30 72 14 55 14 34 C 14 18 24 8 36 8 C 44 8 48 14 50 20 C 52 14 56 8 64 8 C 76 8 86 18 86 34 C 86 55 70 72 50 95 Z'],
  ['serce-pulchne', tt('ksztaltyWiecej.sercePulchne'), 'Serca i natura', 'serce pulchne milosc', 'M 50 88 C 10 66 3 48 3 32 C 3 16 15 6 29 6 C 40 6 47 13 50 20 C 53 13 60 6 71 6 C 85 6 97 16 97 32 C 97 48 90 66 50 88 Z'],
  ['dwa-serca', tt('ksztaltyWiecej.dwaSerca'), 'Serca i natura', 'dwa serca serce para slub walentynki milosc', `${serce(36, 46, 62)} ${serce(66, 60, 50)}`],
  ['serce-strzala', tt('ksztaltyWiecej.serceZeStrzala'), 'Serca i natura', 'serce strzala amor walentynki', `${serce(52, 52, 74)} M 6 80 L 10 76 L 90 18 L 94 14 L 96 22 L 92 22 L 12 82 L 8 86 Z`],
  ['kwiat5', tt('ksztaltyWiecej.kwiatPiecioplatkowy'), 'Serca i natura', 'kwiat platki', `${platki(5, 30, 13, { od: 6 })} ${okrag(50, 50, 10)}`],
  ['kwiat8', tt('ksztaltyWiecej.kwiatOsmioplatkowy'), 'Serca i natura', 'kwiat stokrotka platki', `${platki(8, 30, 8, { od: 8 })} ${okrag(50, 50, 11)}`],
  ['tulipan', tt('ksztaltyWiecej.tulipan'), 'Serca i natura', 'tulipan kwiat wiosna', 'M 30 12 L 40 26 L 50 10 L 60 26 L 70 12 C 76 30 74 52 52 58 L 52 92 L 48 92 L 48 58 C 26 52 24 30 30 12 Z M 50 80 C 40 70 28 70 22 74 C 30 84 42 84 50 80 Z'],
  ['lisc-owalny', tt('ksztaltyWiecej.liscZZylka'), 'Serca i natura', 'lisc natura ekologia', 'M 50 3 C 80 25 80 70 50 97 C 20 70 20 25 50 3 Z M 49 20 L 51 20 L 51 90 L 49 90 Z', { otwor: true }],
  ['galazka', tt('ksztaltyWiecej.galazka'), 'Serca i natura', 'galazka liscie natura ozdobnik', GALAZKA],
  ['drzewo-lisciaste', tt('ksztaltyWiecej.drzewoLisciaste'), 'Serca i natura', 'drzewo las park natura', `${okrag(50, 38, 32)} M 45 62 L 55 62 L 57 96 L 43 96 Z`],
  ['gory', tt('ksztaltyWiecej.gory'), 'Serca i natura', 'gory szczyt wycieczka natura', 'M 3 90 L 35 30 L 50 55 L 65 15 L 97 90 Z'],
  ['fala-morska', tt('ksztaltyWiecej.fala'), 'Serca i natura', 'fala morze woda wakacje', 'M 3 70 C 15 40 40 25 62 35 C 72 40 70 55 60 55 C 52 55 52 45 58 45 C 50 38 40 48 45 60 C 52 76 80 72 97 60 L 97 90 L 3 90 Z'],
  ['plomien', tt('ksztaltyWiecej.plomien'), 'Serca i natura', 'plomien ogien ognisko', 'M 50 4 C 58 22 82 36 82 62 C 82 82 67 96 50 96 C 33 96 18 82 18 62 C 18 46 30 38 34 26 C 40 38 42 44 48 46 C 52 32 50 18 50 4 Z'],
  ['chmura-deszcz', tt('ksztaltyWiecej.chmuraZDeszczem'), 'Serca i natura', 'chmura deszcz pogoda jesien', `M 26 62 A 16 16 0 0 1 22 30 A 20 20 0 0 1 58 16 A 18 18 0 0 1 86 38 A 12 12 0 0 1 80 62 Z ${[30, 50, 70].map((x) => `M ${x} 70 L ${x + 4} 70 L ${x - 2} 92 L ${x - 6} 92 Z`).join(' ')}`],
  ['tecza', tt('ksztaltyWiecej.tecza'), 'Serca i natura', 'tecza kolory pogoda dzieci', 'M 3 85 A 47 47 0 0 1 97 85 L 87 85 A 37 37 0 0 0 13 85 Z M 19 85 A 31 31 0 0 1 81 85 L 71 85 A 21 21 0 0 0 29 85 Z'],
  ['kropla-deszczu', tt('ksztaltyWiecej.kroplaSmukla'), 'Serca i natura', 'kropla deszcz woda', 'M 50 3 C 56 25 78 45 78 66 A 28 28 0 0 1 22 66 C 22 45 44 25 50 3 Z'],
  ['grzyb', tt('ksztaltyWiecej.grzyb'), 'Serca i natura', 'grzyb las jesien', 'M 6 50 C 6 24 26 8 50 8 C 74 8 94 24 94 50 Z M 38 50 L 62 50 L 64 92 L 36 92 Z'],
  ['jablko', tt('ksztaltyWiecej.jablko'), 'Serca i natura', 'jablko owoc szkola', 'M 50 26 C 38 18 10 20 10 52 C 10 76 28 96 40 94 C 46 93 47 90 50 90 C 53 90 54 93 60 94 C 72 96 90 76 90 52 C 90 20 62 18 50 26 Z M 50 24 C 50 14 54 8 62 4 L 64 7 C 57 11 54 16 54 24 Z'],
  ['ksiezyc-gwiazda', tt('ksztaltyWiecej.ksiezycZGwiazda'), 'Serca i natura', 'ksiezyc gwiazda noc sen', `M 52 6 A 45 45 0 1 0 94 64 A 34 34 0 1 1 52 6 Z ${przenies(gwiazda(5, 0.42), 72, 30, 0.3)}`],
  ['sloneczko', tt('ksztaltyWiecej.sloneczko'), 'Serca i natura', 'slonce lato pogoda dzieci', `${okrag(50, 50, 22)} ${platki(10, 14, 4, { od: 28 })}`],
  ['motyl', tt('ksztaltyWiecej.motyl'), 'Serca i natura', 'motyl wiosna natura', `${przenies(obroc(elipsa(50, 50, 20, 26), -25), 30, 34, 1)} ${przenies(obroc(elipsa(50, 50, 20, 26), 25), 70, 34, 1)} ${przenies(obroc(elipsa(50, 50, 14, 17), 30), 33, 70, 1)} ${przenies(obroc(elipsa(50, 50, 14, 17), -30), 67, 70, 1)} ${elipsa(50, 52, 4, 30)}`],

  // ===== Kształty: Symbole i ikony =====
  ['korona', tt('ksztaltyWiecej.korona'), 'Symbole i ikony', 'korona krol zwyciezca', 'M 8 30 L 30 52 L 50 18 L 70 52 L 92 30 L 84 80 L 16 80 Z M 16 85 L 84 85 L 84 93 L 16 93 Z'],
  ['diament', tt('ksztaltyWiecej.diament'), 'Symbole i ikony', 'diament klejnot premium', 'M 25 12 L 75 12 L 95 38 L 50 92 L 5 38 Z M 7 38 L 93 38'],
  ['puchar', tt('ksztaltyWiecej.puchar'), 'Symbole i ikony', 'puchar nagroda zwyciestwo trofeum', 'M 26 8 L 74 8 L 74 20 L 92 20 C 92 40 80 48 70 50 C 66 58 60 62 56 64 L 56 78 L 70 78 L 70 92 L 30 92 L 30 78 L 44 78 L 44 64 C 40 62 34 58 30 50 C 20 48 8 40 8 20 L 26 20 Z M 16 28 C 17 36 22 40 27 42 L 26 28 Z M 84 28 L 74 28 L 73 42 C 78 40 83 36 84 28 Z', { otwor: true }],
  ['klodka', tt('ksztaltyWiecej.klodka'), 'Symbole i ikony', 'klodka zamek bezpieczenstwo', `M 15 44 L 85 44 L 85 94 L 15 94 Z M 28 44 L 28 30 A 22 22 0 0 1 72 30 L 72 44 L 62 44 L 62 30 A 12 12 0 0 0 38 30 L 38 44 Z ${okrag(50, 64, 7)} M 47 66 L 53 66 L 54 82 L 46 82 Z`, { otwor: true }],
  ['dzwonek', tt('ksztaltyWiecej.dzwonek'), 'Symbole i ikony', 'dzwonek powiadomienie alarm', `M 50 8 C 70 8 78 24 78 44 L 78 62 L 90 76 L 10 76 L 22 62 L 22 44 C 22 24 30 8 50 8 Z ${okrag(50, 86, 8)}`],
  ['flaga', tt('ksztaltyWiecej.flaga'), 'Symbole i ikony', 'flaga cel meta', 'M 12 4 L 18 4 L 18 96 L 12 96 Z M 18 8 C 40 0 54 20 88 10 L 88 54 C 54 64 40 44 18 52 Z'],
  ['usmiech', tt('ksztaltyWiecej.usmiech'), 'Symbole i ikony', 'usmiech buzka emotka radosc', `${okrag(50, 50, 45)} ${okrag(35, 40, 6)} ${okrag(65, 40, 6)} M 28 58 L 72 58 C 70 72 60 80 50 80 C 40 80 30 72 28 58 Z`, { otwor: true }],
  ['osoba', tt('ksztaltyWiecej.osoba'), 'Symbole i ikony', 'osoba czlowiek uzytkownik', `${okrag(50, 28, 18)} M 14 94 C 14 66 30 52 50 52 C 70 52 86 66 86 94 Z`],
  ['grupa-osob', tt('ksztaltyWiecej.grupaOsob'), 'Symbole i ikony', 'grupa osoby zespol rodzina', `${okrag(50, 30, 14)} M 24 90 C 24 66 36 54 50 54 C 64 54 76 66 76 90 Z ${okrag(20, 40, 10)} M 0 86 C 0 68 8 60 20 60 C 24 60 27 61 30 63 C 24 70 22 78 22 86 Z ${okrag(80, 40, 10)} M 100 86 C 100 68 92 60 80 60 C 76 60 73 61 70 63 C 76 70 78 78 78 86 Z`],
  ['smartfon', tt('ksztaltyWiecej.smartfon'), 'Symbole i ikony', 'smartfon komorka telefon aplikacja', `${zaokr(26, 4, 48, 92, 8)} ${prost(31, 14, 38, 66)} ${okrag(50, 88, 3.5)}`, { otwor: true }],
  ['laptop', tt('ksztaltyWiecej.laptop'), 'Symbole i ikony', 'laptop komputer praca', `${zaokr(16, 16, 68, 48, 4)} ${prost(21, 21, 58, 38)} M 4 70 L 96 70 L 90 82 L 10 82 Z`, { otwor: true }],
  ['ekran', tt('ksztaltyWiecej.monitor'), 'Symbole i ikony', 'monitor ekran komputer prezentacja', `${zaokr(6, 10, 88, 60, 4)} ${prost(11, 15, 78, 50)} M 44 70 L 56 70 L 58 84 L 42 84 Z M 30 84 L 70 84 L 70 90 L 30 90 Z`, { otwor: true }],
  ['bateria', tt('ksztaltyWiecej.bateria'), 'Symbole i ikony', 'bateria energia ladowanie', `${zaokr(6, 28, 80, 44, 6)} ${prost(12, 34, 68, 32)} M 88 40 L 94 40 L 94 60 L 88 60 Z M 16 38 L 50 38 L 50 62 L 16 62 Z`, { otwor: true }],
  ['parasol', tt('ksztaltyWiecej.parasol'), 'Symbole i ikony', 'parasol deszcz ochrona', 'M 5 50 C 5 25 25 8 50 8 C 75 8 95 25 95 50 C 88 44 80 44 73 50 C 66 44 57 44 50 50 C 43 44 34 44 27 50 C 20 44 12 44 5 50 Z M 48 48 L 52 48 L 52 82 A 8 8 0 0 1 36 82 L 40 82 A 4 4 0 0 0 48 82 Z'],
  ['kotwica', tt('ksztaltyWiecej.kotwica'), 'Symbole i ikony', 'kotwica morze statek', `${okrag(50, 14, 9)} ${okrag(50, 14, 4)} M 46 23 L 54 23 L 54 34 L 68 34 L 68 41 L 54 41 L 54 86 C 68 84 78 74 82 62 L 74 62 L 87 46 L 94 66 L 88 63 C 84 80 68 94 50 94 C 32 94 16 80 12 63 L 6 66 L 13 46 L 26 62 L 18 62 C 22 74 32 84 46 86 L 46 41 L 32 41 L 32 34 L 46 34 Z`, { otwor: true }],
  ['samochod', tt('ksztaltyWiecej.samochod'), 'Symbole i ikony', 'samochod auto podroz', `M 6 58 L 14 40 C 18 32 24 28 34 28 L 62 28 C 70 28 76 32 80 40 L 88 52 L 94 54 L 94 74 L 6 74 Z ${okrag(28, 74, 11)} ${okrag(74, 74, 11)} M 26 42 L 46 42 L 46 34 L 36 34 C 31 34 28 37 26 42 Z M 52 34 L 52 42 L 72 42 C 70 37 67 34 62 34 Z`, { otwor: true }],
  ['rower', tt('ksztaltyWiecej.rower'), 'Symbole i ikony', 'rower sport wycieczka', `${okrag(22, 66, 18)} ${okrag(22, 66, 14)} ${okrag(78, 66, 18)} ${okrag(78, 66, 14)} M 20 64 L 40 32 L 70 32 L 80 64 L 76 66 L 68 40 L 50 64 Z M 34 26 L 50 26 L 50 31 L 34 31 Z`, { otwor: true }],
  ['dom-serce', tt('ksztaltyWiecej.domZSercem'), 'Symbole i ikony', 'dom serce rodzina', `M 50 8 L 95 48 L 82 48 L 82 92 L 18 92 L 18 48 L 5 48 Z ${serce(50, 66, 30)}`, { otwor: true }],
  ['glosnik', tt('ksztaltyWiecej.glosnik'), 'Symbole i ikony', 'glosnik dzwiek ogloszenie', 'M 8 36 L 28 36 L 54 14 L 54 86 L 28 64 L 8 64 Z M 64 32 C 72 40 72 60 64 68 L 60 64 C 66 58 66 42 60 36 Z M 74 22 C 88 36 88 64 74 78 L 70 74 C 82 62 82 38 70 26 Z'],
  ['olowek', tt('ksztaltyWiecej.olowek'), 'Symbole i ikony', 'olowek pisanie szkola edycja', 'M 70 6 L 94 30 L 34 90 L 6 94 L 10 66 Z M 62 14 L 86 38 M 14 70 L 30 86'],
  ['ksiazka-otwarta', tt('ksztaltyWiecej.ksiazkaOtwarta'), 'Symbole i ikony', 'ksiazka otwarta czytanie nauka', 'M 4 22 C 20 18 38 20 48 28 L 48 88 C 38 80 20 78 4 82 Z M 96 22 C 80 18 62 20 52 28 L 52 88 C 62 80 80 78 96 82 Z'],
  ['kawa', tt('ksztaltyWiecej.filizanka'), 'Symbole i ikony', 'filizanka kawa herbata kawiarnia', 'M 10 40 L 72 40 C 72 66 60 82 41 82 C 22 82 10 66 10 40 Z M 72 46 C 88 46 92 54 92 60 C 92 70 82 74 70 72 L 72 66 C 80 67 86 64 86 60 C 86 55 80 52 71 53 Z M 4 88 L 80 88 L 76 94 L 8 94 Z M 30 8 C 26 16 36 20 32 30 L 36 30 C 40 20 30 16 34 8 Z M 46 8 C 42 16 52 20 48 30 L 52 30 C 56 20 46 16 50 8 Z'],

  ['krzyz-maltanski', tt('ksztaltyWiecej.krzyzMaltanski'), 'Symbole i ikony', 'krzyz maltanski order odznaczenie', [0, 90, 180, 270].map((k) => obroc('M 50 46 L 34 6 L 50 16 L 66 6 Z', k)).join(' ')],
  ['serce-kolo', tt('ksztaltyWiecej.serceWKole'), 'Symbole i ikony', 'serce kolo polubienie', `${okrag(50, 50, 45)} ${serce(50, 51, 52)}`, { otwor: true }],
  ['klucz', tt('ksztaltyWiecej.klucz'), 'Symbole i ikony', 'klucz zamek dostep', `${okrag(28, 50, 22)} ${okrag(28, 50, 10)} M 48 45 L 96 45 L 96 62 L 88 62 L 88 55 L 80 55 L 80 64 L 72 64 L 72 55 L 48 55 Z`, { otwor: true }],
  ['pinezka-tablica', tt('ksztaltyWiecej.pinezkaDoTablicy'), 'Symbole i ikony', 'pinezka tablica korkowa przypiete', `${okrag(50, 24, 20)} M 38 40 L 62 40 L 58 52 L 42 52 Z M 48 52 L 52 52 L 50 96 Z`],
  ['ekierka', tt('ksztaltyWiecej.ekierka'), 'Symbole i ikony', 'ekierka szkola geometria', `M 6 6 L 94 94 L 6 94 Z ${punkty([[20, 46], [54, 80], [20, 80]])}`, { otwor: true }],
  ['kostka-gry', tt('ksztaltyWiecej.kostkaDoGry'), 'Symbole i ikony', 'kostka gra losowanie planszowka', `${zaokr(6, 6, 88, 88, 14)} ${[[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]].map(([x, y]) => okrag(x, y, 8)).join(' ')}`, { otwor: true }],
  ['puzzel', tt('ksztaltyWiecej.puzzel'), 'Symbole i ikony', 'puzzel ukladanka element', 'M 10 25 L 38 25 C 34 18 36 8 46 8 C 56 8 58 18 54 25 L 82 25 L 82 50 C 88 46 98 48 98 58 C 98 68 88 70 82 66 L 82 92 L 10 92 L 10 66 C 16 70 26 68 26 58 C 26 48 16 46 10 50 Z'],
  ['mapa', tt('ksztaltyWiecej.mapa'), 'Symbole i ikony', 'mapa podroz trasa', 'M 4 18 L 34 8 L 66 18 L 96 8 L 96 82 L 66 92 L 34 82 L 4 92 Z M 34 8 L 34 82 M 66 18 L 66 92'],
  ['mikrofon', tt('ksztaltyWiecej.mikrofon'), 'Symbole i ikony', 'mikrofon podcast nagranie', `${zaokr(36, 4, 28, 56, 14)} M 22 44 L 28 44 C 28 58 38 66 50 66 C 62 66 72 58 72 44 L 78 44 C 78 60 66 72 53 73 L 53 86 L 66 86 L 66 92 L 34 92 L 34 86 L 47 86 L 47 73 C 34 72 22 60 22 44 Z`],
  ['nozyczki', tt('ksztaltyWiecej.nozyczki'), 'Symbole i ikony', 'nozyczki ciecie wytnij', `${okrag(24, 76, 14)} ${okrag(24, 76, 8)} ${okrag(76, 76, 14)} ${okrag(76, 76, 8)} M 33 66 L 82 6 L 86 10 L 44 70 Z M 67 66 L 18 6 L 14 10 L 56 70 Z`, { otwor: true }],
  ['kaktus', tt('ksztaltyWiecej.kaktus'), 'Serca i natura', 'kaktus roslina doniczka', 'M 42 20 A 8 8 0 0 1 58 20 L 58 50 L 70 50 L 70 30 A 6 6 0 0 1 82 30 L 82 56 A 6 6 0 0 1 76 62 L 58 62 L 58 76 L 42 76 L 42 58 L 24 58 A 6 6 0 0 1 18 52 L 18 36 A 6 6 0 0 1 30 36 L 30 46 L 42 46 Z M 30 76 L 70 76 L 64 96 L 36 96 Z'],
  ['ryba', tt('ksztaltyWiecej.ryba'), 'Serca i natura', 'ryba morze woda', `M 8 50 C 24 26 56 22 76 40 L 94 24 L 90 50 L 94 76 L 76 60 C 56 78 24 74 8 50 Z ${okrag(26, 46, 4)}`, { otwor: true }],
  ['lapka', tt('ksztaltyWiecej.sladLapki'), 'Serca i natura', 'lapka slad pies kot zwierze', `${elipsa(50, 66, 22, 18)} ${przenies(obroc(elipsa(50, 50, 8, 11), -20), 24, 38, 1)} ${przenies(obroc(elipsa(50, 50, 8, 11), -6), 40, 24, 1)} ${przenies(obroc(elipsa(50, 50, 8, 11), 6), 60, 24, 1)} ${przenies(obroc(elipsa(50, 50, 8, 11), 20), 76, 38, 1)}`],
  ['ptak', tt('ksztaltyWiecej.ptak'), 'Serca i natura', 'ptak lot jaskolka', 'M 4 40 C 20 30 38 34 50 52 C 62 34 80 30 96 40 C 80 38 64 46 50 66 C 36 46 20 38 4 40 Z'],
  ['rozgwiazda', tt('ksztaltyWiecej.rozgwiazda'), 'Serca i natura', 'rozgwiazda morze plaza', zaokraglony(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 16 : 46; const a = -Math.PI / 2 + (i * Math.PI) / 5; return [50 + r * Math.cos(a), 54 + r * Math.sin(a)]; }), 0.3)],
  ['wisnie', tt('ksztaltyWiecej.wisnie'), 'Serca i natura', 'wisnie owoce lato', `${okrag(30, 72, 18)} ${okrag(70, 72, 18)} M 30 56 L 34 56 C 40 34 52 20 62 10 L 66 12 C 56 22 44 36 34 56 Z M 70 56 L 66 56 C 64 38 64 24 62 10 L 66 12 C 68 26 70 40 70 56 Z M 62 10 C 72 4 86 6 92 14 C 82 18 70 16 62 10 Z`],
  ['muszelka', tt('ksztaltyWiecej.muszelka'), 'Serca i natura', 'muszla muszelka morze', 'M 50 92 L 8 50 C 8 26 26 8 50 8 C 74 8 92 26 92 50 Z M 50 92 L 22 22 M 50 92 L 36 12 M 50 92 L 50 8 M 50 92 L 64 12 M 50 92 L 78 22'],

  // ===== Kształty: Okolicznościowe =====
  ['balwan', tt('ksztaltyWiecej.balwanek'), 'Okolicznościowe', 'balwan zima snieg', `${okrag(50, 72, 24)} ${okrag(50, 36, 17)} M 36 22 L 64 22 L 64 18 L 58 18 L 58 4 L 42 4 L 42 18 L 36 18 Z`],
  ['laska-cukrowa', tt('ksztaltyWiecej.laskaCukrowa'), 'Okolicznościowe', 'laska cukrowa swieta cukierek', 'M 40 96 L 40 32 A 20 20 0 0 1 80 32 L 80 40 L 66 40 L 66 32 A 6 6 0 0 0 54 32 L 54 96 Z'],
  ['dzwonki', tt('ksztaltyWiecej.dzwonkiSwiateczne'), 'Okolicznościowe', 'dzwonki swieta boze narodzenie', `${przenies(obroc(`M 50 14 C 66 14 72 28 72 44 L 72 60 L 82 72 L 18 72 L 28 60 L 28 44 C 28 28 34 14 50 14 Z ${okrag(50, 80, 7)}`, -18), 34, 54, 0.62)} ${przenies(obroc(`M 50 14 C 66 14 72 28 72 44 L 72 60 L 82 72 L 18 72 L 28 60 L 28 44 C 28 28 34 14 50 14 Z ${okrag(50, 80, 7)}`, 18), 66, 54, 0.62)}`],
  ['gwiazdka-choinka', tt('ksztaltyWiecej.gwiazdaNaChoinke'), 'Okolicznościowe', 'gwiazda czubek choinka swieta', `${przenies(gwiazda(5, 0.45), 50, 40, 0.8)} M 44 74 L 56 74 L 54 96 L 46 96 Z`],
  ['kartka-okolicznosciowa', tt('ksztaltyWiecej.serceZWstazka'), 'Okolicznościowe', 'serce wstazka prezent walentynki', `${serce(50, 58, 80)} M 6 30 L 94 30 L 94 38 L 6 38 Z M 46 14 L 54 14 L 54 92 L 46 92 Z`],

  // ===== Kształty: Okolicznościowe (cd.) =====
  ['balon', tt('ksztaltyWiecej.balon'), 'Okolicznościowe', 'balon urodziny impreza', `${elipsa(50, 38, 30, 34)} M 46 72 L 54 72 L 52 77 L 48 77 Z M 49 77 C 46 85 54 88 51 97 L 49 97 C 52 88 44 85 47 77 Z`],
  ['choinka-pietra', tt('ksztaltyWiecej.choinka'), 'Okolicznościowe', 'choinka swieta boze narodzenie', 'M 50 4 L 70 30 L 62 30 L 80 54 L 70 54 L 92 80 L 56 80 L 56 96 L 44 96 L 44 80 L 8 80 L 30 54 L 20 54 L 38 30 L 30 30 Z'],
  ['bombka', tt('ksztaltyWiecej.bombka'), 'Okolicznościowe', 'bombka choinka swieta', `${okrag(50, 58, 38)} M 42 10 L 58 10 L 58 22 L 42 22 Z`],
  ['gwiazda-betlejemska', tt('ksztaltyWiecej.gwiazdaBetlejemska'), 'Okolicznościowe', 'gwiazda betlejemska swieta boze narodzenie', gwiazda(8, 0.32)],
  ['swieca', tt('ksztaltyWiecej.swieca'), 'Okolicznościowe', 'swieca swieto adwent wspomnienie', 'M 36 40 L 64 40 L 64 96 L 36 96 Z M 50 4 C 56 14 60 20 60 26 A 10 10 0 0 1 40 26 C 40 20 44 14 50 4 Z'],
  ['jajko', tt('ksztaltyWiecej.pisanka'), 'Okolicznościowe', 'jajko pisanka wielkanoc', 'M 50 4 C 74 4 88 40 88 60 C 88 82 72 96 50 96 C 28 96 12 82 12 60 C 12 40 26 4 50 4 Z M 14 50 L 86 50 L 87 56 L 13 56 Z M 16 70 L 84 70 L 82 76 L 18 76 Z', { otwor: true }],
  ['tort', tt('ksztaltyWiecej.tort'), 'Okolicznościowe', 'tort urodziny rocznica swieczki', 'M 10 52 L 90 52 L 90 92 L 10 92 Z M 10 66 C 20 72 30 60 40 66 C 50 72 60 60 70 66 C 80 72 90 60 90 66 L 90 70 C 80 76 70 64 60 70 C 50 76 40 64 30 70 C 20 76 10 64 10 70 Z M 27 30 L 33 30 L 33 52 L 27 52 Z M 47 30 L 53 30 L 53 52 L 47 52 Z M 67 30 L 73 30 L 73 52 L 67 52 Z M 30 14 C 33 19 34 22 34 24 A 4 4 0 0 1 26 24 C 26 22 27 19 30 14 Z M 50 14 C 53 19 54 22 54 24 A 4 4 0 0 1 46 24 C 46 22 47 19 50 14 Z M 70 14 C 73 19 74 22 74 24 A 4 4 0 0 1 66 24 C 66 22 67 19 70 14 Z', { otwor: true }],
  ['pierscionek', tt('ksztaltyWiecej.pierscionek'), 'Okolicznościowe', 'pierscionek slub zareczyny', `${okrag(50, 62, 34)} ${okrag(50, 62, 27)} M 38 8 L 62 8 L 70 18 L 50 34 L 30 18 Z`, { otwor: true }],
  ['kokarda', tt('ksztaltyWiecej.kokarda'), 'Okolicznościowe', 'kokarda prezent wstazka', 'M 50 50 C 34 30 10 22 8 34 C 6 46 10 62 50 50 Z M 50 50 C 66 30 90 22 92 34 C 94 46 90 62 50 50 Z M 46 50 C 38 66 30 82 24 92 L 36 88 L 42 96 C 46 80 50 64 50 52 Z M 54 50 C 62 66 70 82 76 92 L 64 88 L 58 96 C 54 80 50 64 50 52 Z M 43 43 L 57 43 L 57 57 L 43 57 Z'],
  ['choragiewki', tt('ksztaltyWiecej.girlandaZChoragiewek'), 'Okolicznościowe', 'choragiewki girlanda impreza urodziny', choragiewki(5)],
  ['dynia', tt('ksztaltyWiecej.dynia'), 'Okolicznościowe', 'dynia halloween jesien', `${elipsa(50, 58, 16, 34)} ${elipsa(32, 58, 22, 32)} ${elipsa(68, 58, 22, 32)} M 46 26 C 46 16 50 8 58 6 L 60 10 C 54 13 52 18 52 26 Z`],
  ['czapeczka', tt('ksztaltyWiecej.czapeczkaUrodzinowa'), 'Okolicznościowe', 'czapeczka urodziny impreza', `M 50 14 L 82 92 L 18 92 Z ${okrag(50, 10, 8)}`],
  ['konfetti', tt('ksztaltyWiecej.konfetti'), 'Okolicznościowe', 'konfetti impreza swietowanie', `${okrag(15, 20, 5)} ${przenies(prost(40, 40, 20, 20), 45, 15, 0.4)} ${przenies(gwiazda(5, 0.45), 80, 18, 0.2)} ${okrag(70, 50, 4)} ${przenies(obroc(prost(40, 45, 20, 10), 30), 25, 55, 0.6)} ${przenies(gwiazda(4, 0.4), 50, 50, 0.18)} ${okrag(85, 82, 5)} ${przenies(obroc(prost(40, 45, 20, 10), -30), 55, 85, 0.6)} ${przenies(gwiazda(5, 0.45), 18, 85, 0.18)}`],
  ['zajac', tt('ksztaltyWiecej.zajac'), 'Okolicznościowe', 'zajac krolik wielkanoc', `${okrag(50, 66, 28)} ${okrag(50, 34, 16)} ${przenies(obroc(elipsa(50, 50, 6, 18), -12), 42, 12, 1)} ${przenies(obroc(elipsa(50, 50, 6, 18), 12), 58, 12, 1)}`],
  ['serduszka', tt('ksztaltyWiecej.serduszka'), 'Okolicznościowe', 'serduszka serce walentynki milosc', `${serce(30, 30, 40)} ${serce(70, 44, 30)} ${serce(40, 74, 26)}`],

  // ===== Kształty: Znaki =====
  ['minus', tt('ksztaltyWiecej.minus'), 'Znaki', 'minus odejmowanie', prost(8, 40, 84, 20)],
  ['rowna-sie', tt('ksztaltyWiecej.rownaSie'), 'Znaki', 'rowna sie wynik', `${prost(8, 26, 84, 18)} ${prost(8, 56, 84, 18)}`],
  ['dzielenie', tt('ksztaltyWiecej.dzielenie'), 'Znaki', 'dzielenie matematyka', `${prost(8, 42, 84, 16)} ${okrag(50, 20, 10)} ${okrag(50, 80, 10)}`],
  ['procent', tt('ksztaltyWiecej.procent'), 'Znaki', 'procent rabat', `${okrag(26, 26, 16)} ${okrag(26, 26, 8)} ${okrag(74, 74, 16)} ${okrag(74, 74, 8)} M 76 8 L 88 14 L 24 92 L 12 86 Z`, { otwor: true }],
  ['nieskonczonosc', tt('ksztaltyWiecej.nieskonczonosc'), 'Znaki', 'nieskonczonosc zawsze', 'M 50 50 C 38 30 6 30 6 50 C 6 70 38 70 50 50 C 62 30 94 30 94 50 C 94 70 62 70 50 50 Z M 50 50 C 40 38 16 38 16 50 C 16 62 40 62 50 50 C 60 38 84 38 84 50 C 84 62 60 62 50 50 Z', { otwor: true }],
  ['wykrzyknik', tt('ksztaltyWiecej.wykrzyknik'), 'Znaki', 'wykrzyknik uwaga', `M 40 6 L 60 6 L 56 66 L 44 66 Z ${okrag(50, 84, 10)}`],
  ['pytajnik', tt('ksztaltyWiecej.znakZapytania'), 'Znaki', 'znak zapytania pytanie pomoc', `M 22 32 C 22 14 36 4 52 4 C 70 4 80 16 80 30 C 80 46 62 50 58 60 L 58 68 L 42 68 L 42 58 C 46 42 64 40 64 30 C 64 22 58 18 51 18 C 43 18 38 24 38 32 Z ${okrag(50, 86, 9)}`],
  ['hasztag', tt('ksztaltyWiecej.kratka'), 'Znaki', 'hasztag kratka numer', 'M 30 6 L 42 6 L 38 30 L 58 30 L 62 6 L 74 6 L 70 30 L 92 30 L 90 42 L 68 42 L 64 58 L 86 58 L 84 70 L 62 70 L 58 94 L 46 94 L 50 70 L 30 70 L 26 94 L 14 94 L 18 70 L 6 70 L 8 58 L 20 58 L 24 42 L 10 42 L 12 30 L 26 30 Z M 36 42 L 32 58 L 52 58 L 56 42 Z', { otwor: true }],
  ['wieksze', tt('ksztaltyWiecej.wiekszeNiz'), 'Znaki', 'wieksze niz porownanie', 'M 12 14 L 90 44 L 90 56 L 12 86 L 12 72 L 72 50 L 12 28 Z'],
  ['mniejsze', tt('ksztaltyWiecej.mniejszeNiz'), 'Znaki', 'mniejsze niz porownanie', 'M 88 14 L 10 44 L 10 56 L 88 86 L 88 72 L 28 50 L 88 28 Z'],
  ['zakaz', tt('ksztaltyWiecej.zakaz'), 'Znaki', 'zakaz nie wolno stop', `${okrag(50, 50, 45)} ${okrag(50, 50, 34)} M 24 30 L 30 24 L 76 70 L 70 76 Z`, { otwor: true }],
  ['cudzyslow', tt('ksztaltyWiecej.cudzyslow'), 'Znaki', 'cudzyslow cytat', 'M 8 56 C 8 30 18 16 40 10 L 42 18 C 30 24 26 32 26 42 L 44 42 L 44 82 L 8 82 Z M 56 56 C 56 30 66 16 88 10 L 90 18 C 78 24 74 32 74 42 L 92 42 L 92 82 L 56 82 Z'],
  ['kolo-ptaszek', tt('ksztaltyWiecej.ptaszekWKole'), 'Znaki', 'ptaszek kolo ok zatwierdzone gotowe', `${okrag(50, 50, 45)} M 24 52 L 32 44 L 44 56 L 68 32 L 76 40 L 44 72 Z`, { otwor: true }],
  ['kolo-krzyzyk', tt('ksztaltyWiecej.krzyzykWKole'), 'Znaki', 'krzyzyk kolo blad nie anuluj', `${okrag(50, 50, 45)} M 30 36 L 36 30 L 50 44 L 64 30 L 70 36 L 56 50 L 70 64 L 64 70 L 50 56 L 36 70 L 30 64 L 44 50 Z`, { otwor: true }],
  ['plus-kolo', tt('ksztaltyWiecej.plusWKole'), 'Znaki', 'plus kolo dodaj', `${okrag(50, 50, 45)} M 45 24 L 55 24 L 55 45 L 76 45 L 76 55 L 55 55 L 55 76 L 45 76 L 45 55 L 24 55 L 24 45 L 45 45 Z`, { otwor: true }],
  ['numer', tt('ksztaltyWiecej.kolkoNaNumer'), 'Znaki', 'numer kolo punkt wypunktowanie lista', `${okrag(50, 50, 45)} ${okrag(50, 50, 38)}`, { otwor: true }],

  // ===== Strzałki =====
  ['strzalka-skos-lg', tt('ksztaltyWiecej.strzalkaNaSkosW3'), 'Strzałki', 'strzalka skos ukos', lustroX('M 15 75 L 60 30 L 45 15 L 90 10 L 85 55 L 70 40 L 25 85 Z')],
  ['strzalka-skos-pd', tt('ksztaltyWiecej.strzalkaNaSkosW2'), 'Strzałki', 'strzalka skos ukos', lustroY('M 15 75 L 60 30 L 45 15 L 90 10 L 85 55 L 70 40 L 25 85 Z')],
  ['strzalka-skos-ld', tt('ksztaltyWiecej.strzalkaNaSkosW'), 'Strzałki', 'strzalka skos ukos', lustroX(lustroY('M 15 75 L 60 30 L 45 15 L 90 10 L 85 55 L 70 40 L 25 85 Z'))],
  ['szewron-lewo', tt('ksztaltyWiecej.szewronWLewo'), 'Strzałki', 'szewron chevron wstecz', lustroX('M 5 15 L 60 15 L 95 50 L 60 85 L 5 85 L 40 50 Z')],
  ['szewron-gora', tt('ksztaltyWiecej.szewronWGore'), 'Strzałki', 'szewron chevron gora', obroc('M 5 15 L 60 15 L 95 50 L 60 85 L 5 85 L 40 50 Z', -90)],
  ['szewron-dol', tt('ksztaltyWiecej.szewronWDol'), 'Strzałki', 'szewron chevron dol', obroc('M 5 15 L 60 15 L 95 50 L 60 85 L 5 85 L 40 50 Z', 90)],
  ['strzalka-wcieta', tt('ksztaltyWiecej.strzalkaZWcieciem'), 'Strzałki', 'strzalka wcieta dalej', 'M 5 30 L 60 30 L 60 12 L 95 50 L 60 88 L 60 70 L 5 70 L 20 50 Z'],
  ['strzalka-wąska', 'Strzałka smukła', 'Strzałki', 'strzalka smukla waska', strzalkaBlok(12, 28)],
  ['strzalka-gruba', tt('ksztaltyWiecej.strzalkaGruba'), 'Strzałki', 'strzalka gruba duza', strzalkaBlok(46, 40)],
  ['strzalka-cienka-lewo', tt('ksztaltyWiecej.strzalkaCienkaWLewo'), 'Strzałki', 'strzalka linia lewo', 'M 95 50 L 8 50 M 30 30 L 8 50 L 30 70', { otwarta: true }],
  ['strzalka-cienka-obie', tt('ksztaltyWiecej.strzalkaCienkaWObie'), 'Strzałki', 'strzalka linia obustronna wymiar', 'M 8 50 L 92 50 M 26 34 L 8 50 L 26 66 M 74 34 L 92 50 L 74 66', { otwarta: true }],
  ['strzalka-luk-cienka', tt('ksztaltyWiecej.strzalkaLukiem'), 'Strzałki', 'strzalka luk linia odnosnik', 'M 10 80 C 20 30 60 20 88 36 M 72 22 L 88 36 L 70 46', { otwarta: true }],
  ['strzalka-falista', tt('ksztaltyWiecej.strzalkaFalista'), 'Strzałki', 'strzalka falista linia odreczna', 'M 6 60 C 18 40 28 40 38 56 C 48 72 58 72 68 56 L 88 40 M 74 38 L 88 40 L 86 54', { otwarta: true }],
  ['strzalka-zakret-lewo', tt('ksztaltyWiecej.strzalkaZakreconaWLewo'), 'Strzałki', 'strzalka luk zakret lewo', lustroX('M 10 88 C 10 45 35 25 65 25 L 65 8 L 95 35 L 65 62 L 65 45 C 45 45 30 58 30 88 Z')],
  ['strzalka-kolano', tt('ksztaltyWiecej.strzalkaZKolanem'), 'Strzałki', 'strzalka zakret kolano schemat', 'M 10 90 L 10 40 L 62 40 L 62 20 L 92 50 L 62 80 L 62 60 L 30 60 L 30 90 Z'],
  ['strzalka-dwie-luk', tt('ksztaltyWiecej.strzalkiWymiany'), 'Strzałki', 'strzalki wymiana odswiez cykl', 'M 14 44 C 16 22 34 8 54 8 C 66 8 76 14 82 22 L 92 14 L 92 42 L 64 42 L 74 32 C 70 26 62 22 54 22 C 40 22 30 32 28 44 Z M 86 56 C 84 78 66 92 46 92 C 34 92 24 86 18 78 L 8 86 L 8 58 L 36 58 L 26 68 C 30 74 38 78 46 78 C 60 78 70 68 72 56 Z'],
  ['strzalka-trzy', tt('ksztaltyWiecej.trzySzewrony'), 'Strzałki', 'szewrony dalej przewin', 'M 4 20 L 20 20 L 40 50 L 20 80 L 4 80 L 24 50 Z M 32 20 L 48 20 L 68 50 L 48 80 L 32 80 L 52 50 Z M 60 20 L 76 20 L 96 50 L 76 80 L 60 80 L 80 50 Z'],
  ['strzalka-rozgalezienie', tt('ksztaltyWiecej.strzalkaRozgaleziona'), 'Strzałki', 'strzalka rozgalezienie wybor decyzja', 'M 8 44 L 44 44 L 64 20 L 56 14 L 86 6 L 82 36 L 74 28 L 56 50 L 74 72 L 82 64 L 86 94 L 56 86 L 64 80 L 44 56 L 8 56 Z'],

  // ===== Dymki =====
  ['dymek-prawo', tt('ksztaltyWiecej.dymekZPrawej'), 'Dymki', 'dymek rozmowa komentarz', lustroX('M 22 10 L 92 10 L 92 75 L 22 75 L 22 55 L 5 45 L 22 38 Z')],
  ['dymek-zaokr-prawo', tt('ksztaltyWiecej.dymekZaokraglonyZPrawej'), 'Dymki', 'dymek rozmowa komiks', lustroX('M 18 8 L 82 8 Q 92 8 92 18 L 92 58 Q 92 68 82 68 L 42 68 L 24 92 L 28 68 L 18 68 Q 8 68 8 58 L 8 18 Q 8 8 18 8 Z')],
  ['dymek-owal-prawo', tt('ksztaltyWiecej.dymekOwalnyZPrawej'), 'Dymki', 'dymek rozmowa komiks', lustroX('M 50 8 C 77 8 95 22 95 40 C 95 58 77 72 50 72 C 45 72 40 71 36 70 L 18 92 L 24 66 C 12 60 5 51 5 40 C 5 22 23 8 50 8 Z')],
  ['dymek-mysl-prawo', tt('ksztaltyWiecej.dymekMysliZPrawej'), 'Dymki', 'dymek mysl chmurka komiks', lustroX(`M 30 62 A 16 16 0 0 1 24 32 A 20 20 0 0 1 60 18 A 18 18 0 0 1 88 38 A 14 14 0 0 1 78 62 Z ${okrag(22, 76, 6)} ${okrag(10, 91, 4)}`)],
  ['dymek-gora', tt('ksztaltyWiecej.dymekZOgonkiemU'), 'Dymki', 'dymek rozmowa podpis gora', lustroY('M 5 8 L 95 8 L 95 70 L 60 70 L 50 92 L 40 70 L 5 70 Z')],
  ['dymek-chmurka', tt('ksztaltyWiecej.dymekChmurka'), 'Dymki', 'dymek chmurka mysl marzenie', `${przenies(falistyKrag(14, 40), 50, 44, 0.95, 0.75)} ${okrag(26, 84, 6)} ${okrag(16, 94, 4)}`],
  ['dymek-podwojny', tt('ksztaltyWiecej.dwaDymki'), 'Dymki', 'dymki rozmowa dialog czat', `M 6 8 L 62 8 L 62 48 L 24 48 L 12 62 L 14 48 L 6 48 Z M 38 40 L 94 40 L 94 80 L 86 80 L 88 94 L 76 80 L 38 80 Z`],
  ['dymek-kwadrat', tt('ksztaltyWiecej.dymekKwadratowy'), 'Dymki', 'dymek kwadrat rozmowa', 'M 8 8 L 92 8 L 92 80 L 30 80 L 12 96 L 14 80 L 8 80 Z'],
  ['dymek-kolo-prawo', tt('ksztaltyWiecej.dymekOkraglyZPrawej'), 'Dymki', 'dymek kolo rozmowa', lustroX('M 50 6 A 40 40 0 1 1 26 79 L 8 94 L 16 70 A 40 40 0 0 1 50 6 Z')],
  ['dymek-prostokat-dlugi', tt('ksztaltyWiecej.dymekPodluzny'), 'Dymki', 'dymek podluzny podpis rozmowa', 'M 12 26 L 88 26 Q 96 26 96 34 L 96 60 Q 96 68 88 68 L 36 68 L 20 84 L 24 68 L 12 68 Q 4 68 4 60 L 4 34 Q 4 26 12 26 Z'],

  // ===== Ozdobniki: Wstęgi i banery =====
  ['wstega-luk', tt('ksztaltyWiecej.wstegaLukowa'), 'Wstęgi i banery', 'wstega luk baner tytul', 'M 16 46 C 36 30 64 30 84 46 L 84 70 C 64 54 36 54 16 70 Z M 16 50 L 2 54 L 10 64 L 4 76 L 16 72 Z M 84 50 L 98 54 L 90 64 L 96 76 L 84 72 Z'],
  ['flaga-powiewajaca', tt('ksztaltyWiecej.flagaPowiewajaca'), 'Wstęgi i banery', 'flaga powiewajaca baner', 'M 5 20 C 30 8 50 32 95 20 L 95 70 C 50 82 30 58 5 70 Z'],
  ['proporzec', tt('ksztaltyWiecej.proporzecTrojkatny'), 'Wstęgi i banery', 'proporzec flaga trojkat', 'M 5 15 L 95 50 L 5 85 Z'],
  ['proporczyk-pion', tt('ksztaltyWiecej.proporczykPionowy'), 'Wstęgi i banery', 'proporczyk flaga pionowy zakladka', 'M 20 4 L 80 4 L 80 96 L 50 80 L 20 96 Z'],
  ['wstega-ukosna', tt('ksztaltyWiecej.wstegaUkosna'), 'Wstęgi i banery', 'wstega ukosna szarfa', 'M 0 70 L 70 0 L 100 0 L 100 8 L 8 100 L 0 100 Z'],
  ['baner-prosty', tt('ksztaltyWiecej.banerZZakladkami'), 'Wstęgi i banery', 'baner tytul wstega', 'M 12 30 L 88 30 L 88 70 L 12 70 Z M 12 30 L 4 22 L 4 62 L 12 70 Z M 88 30 L 96 22 L 96 62 L 88 70 Z'],
  ['wstega-medal', tt('ksztaltyWiecej.wstazkaDoMedalu'), 'Wstęgi i banery', 'wstazka medal nagroda', 'M 22 4 L 48 4 L 48 96 L 35 84 L 22 96 Z M 52 4 L 78 4 L 78 96 L 65 84 L 52 96 Z'],
  ['tabliczka-tytul', tt('ksztaltyWiecej.tabliczkaTytulowa'), 'Wstęgi i banery', 'tabliczka tytul baner zaokraglona', 'M 20 28 L 80 28 A 8 8 0 0 0 88 36 L 88 64 A 8 8 0 0 0 80 72 L 20 72 A 8 8 0 0 0 12 64 L 12 36 A 8 8 0 0 0 20 28 Z'],

  // ===== Ozdobniki: Narożniki =====
  ['naroznik-l-kropka', tt('ksztaltyWiecej.naroznikZKropka'), 'Narożniki', 'naroznik rog kropka', `M 5 5 L 60 5 L 60 10 L 10 10 L 10 60 L 5 60 Z ${okrag(22, 22, 6)}`],
  ['naroznik-luk', tt('ksztaltyWiecej.naroznikLukowy'), 'Narożniki', 'naroznik rog luk', 'M 5 5 L 70 5 L 70 10 C 40 10 10 40 10 70 L 5 70 Z'],
  ['naroznik-zawijas', tt('ksztaltyWiecej.naroznikZZawijasem'), 'Narożniki', 'naroznik zawijas ornament vintage', 'M 5 5 L 80 5 L 80 9 L 9 9 L 9 80 L 5 80 Z M 18 60 C 18 34 34 18 60 18 C 52 24 46 30 44 38 C 52 34 58 36 58 44 C 58 52 48 56 42 50 C 36 44 38 34 44 28 C 34 30 26 40 24 52 C 24 56 22 60 18 60 Z'],
  ['naroznik-trojkat', tt('ksztaltyWiecej.naroznikTrojkatny'), 'Narożniki', 'naroznik rog trojkat zdjecie', 'M 5 5 L 55 5 L 5 55 Z'],
  ['naroznik-kwiat', tt('ksztaltyWiecej.naroznikZKwiatkiem'), 'Narożniki', 'naroznik kwiat ornament', `M 5 5 L 70 5 L 70 9 L 9 9 L 9 70 L 5 70 Z ${przenies(platki(5, 26, 11, { od: 6 }), 26, 26, 0.38)}`],
  ['naroznik-podwojny', tt('ksztaltyWiecej.naroznikPodwojny'), 'Narożniki', 'naroznik rog podwojny linia', 'M 5 5 L 70 5 L 70 9 L 9 9 L 9 70 L 5 70 Z M 16 16 L 56 16 L 56 20 L 20 20 L 20 56 L 16 56 Z'],
  ['naroznik-schodki', tt('ksztaltyWiecej.naroznikSchodkowy'), 'Narożniki', 'naroznik art deco schodki', 'M 5 5 L 70 5 L 70 9 L 25 9 L 25 25 L 9 25 L 9 70 L 5 70 Z M 14 14 L 20 14 L 20 20 L 14 20 Z'],
  ['naroznik-lisc', tt('ksztaltyWiecej.naroznikZLiscmi'), 'Narożniki', 'naroznik lisc galazka natura', `M 5 5 L 70 5 L 70 9 L 9 9 L 9 70 L 5 70 Z ${przenies(obroc(GALAZKA, -45), 36, 36, 0.5)}`],
  ['narozniki-ozdobne', tt('ksztaltyWiecej.czteryNaroznikiOzdobne'), 'Narożniki', 'narozniki ozdobne ramka rogi', narozniki('M 5 5 L 34 5 L 34 9 L 9 9 L 9 34 L 5 34 Z M 15 15 L 22 15 L 22 22 L 15 22 Z')],
  ['narozniki-luk', tt('ksztaltyWiecej.czteryNaroznikiLukowe'), 'Narożniki', 'narozniki luk ramka rogi', narozniki('M 5 5 L 34 5 L 34 9 C 20 9 9 20 9 34 L 5 34 Z')],

  // ===== Ozdobniki: Rozety i ornamenty =====
  ['rozeta-platki', tt('ksztaltyWiecej.rozetaZPlatkow'), 'Rozety i ornamenty', 'rozeta kwiat ornament mandala', `${platki(8, 30, 9, { od: 10 })} ${okrag(50, 50, 9)}`],
  ['rozeta-podwojna', tt('ksztaltyWiecej.rozetaPodwojna'), 'Rozety i ornamenty', 'rozeta ornament mandala', `${platki(12, 34, 6, { od: 6 })} ${okrag(50, 50, 16)} ${okrag(50, 50, 11)}`, { otwor: true }],
  ['mandala', tt('ksztaltyWiecej.mandala'), 'Rozety i ornamenty', 'mandala ornament kolo', `${falistyKrag(16, 40)} ${okrag(50, 50, 34)} ${platki(8, 22, 7, { od: 6 })} ${okrag(50, 50, 6)}`, { otwor: true }],
  ['roza-wiatrow', tt('ksztaltyWiecej.rozaWiatrow'), 'Rozety i ornamenty', 'roza wiatrow kompas podroz mapa', `${gwiazda(4, 0.2)} ${przenies(gwiazda(4, 0.25, -Math.PI / 4), 50, 50, 0.65)} ${okrag(50, 50, 6)}`],
  ['ornament-romb', tt('ksztaltyWiecej.ornamentRombowy'), 'Rozety i ornamenty', 'ornament romb ozdobnik', `${romb(50, 50, 44)} ${romb(50, 50, 34)} ${romb(50, 50, 18)}`, { otwor: true }],
  ['medalion', tt('ksztaltyWiecej.medalion'), 'Rozety i ornamenty', 'medalion ornament owal', `${przenies(falistyKrag(20, 40), 50, 50, 1, 1.15)} ${elipsa(50, 50, 32, 40)}`, { otwor: true }],
  ['koniczyna', tt('ksztaltyWiecej.czterolistnaKoniczyna'), 'Rozety i ornamenty', 'koniczyna szczescie ornament', `${elipsa(50, 30, 16, 26)} ${elipsa(50, 70, 16, 26)} ${elipsa(30, 50, 26, 16)} ${elipsa(70, 50, 26, 16)}`],
  ['ornament-kolo-kropki', tt('ksztaltyWiecej.koloZKropkami'), 'Rozety i ornamenty', 'ornament kolo kropki', `${okrag(50, 50, 24)} ${naOkregu(12, 38).map(([x, y]) => okrag(x, y, 4)).join(' ')}`],
  ['lilia', tt('ksztaltyWiecej.lilia'), 'Rozety i ornamenty', 'lilia ornament herb fleur', 'M 50 4 C 62 20 62 40 54 56 L 46 56 C 38 40 38 20 50 4 Z M 44 56 C 34 40 14 34 6 46 C 16 44 26 50 30 62 L 44 62 Z M 56 56 C 66 40 86 34 94 46 C 84 44 74 50 70 62 L 56 62 Z M 22 62 L 78 62 L 78 70 L 22 70 Z M 44 70 L 56 70 C 56 82 62 90 70 96 L 30 96 C 38 90 44 82 44 70 Z'],
  ['gwiazda-ornament', tt('ksztaltyWiecej.gwiazdaOrnamentowa'), 'Rozety i ornamenty', 'gwiazda ornament islamska', `${gwiazda(8, 0.7)} ${przenies(gwiazda(8, 0.7, -Math.PI / 2 + Math.PI / 8), 50, 50, 0.55)}`, { otwor: true }],

  // ===== Linie: Separatory ozdobne =====
  ['sep-kropka', tt('ksztaltyWiecej.liniaZKropka'), 'Separatory ozdobne', 'linia kropka separator', `M 2 49 L 40 49 L 40 51 L 2 51 Z M 60 49 L 98 49 L 98 51 L 60 51 Z ${okrag(50, 50, 5)}`],
  ['sep-kolo', tt('ksztaltyWiecej.liniaZKolkiem'), 'Separatory ozdobne', 'linia kolo separator', `M 2 49 L 38 49 L 38 51 L 2 51 Z M 62 49 L 98 49 L 98 51 L 62 51 Z ${okrag(50, 50, 9)} ${okrag(50, 50, 6)}`, { otwor: true }],
  ['sep-gwiazdka', tt('ksztaltyWiecej.liniaZGwiazdka'), 'Separatory ozdobne', 'linia gwiazda separator', `M 2 49 L 38 49 L 38 51 L 2 51 Z M 62 49 L 98 49 L 98 51 L 62 51 Z ${przenies(gwiazda(5, 0.42), 50, 50, 0.2)}`],
  ['sep-kwiat', tt('ksztaltyWiecej.liniaZKwiatkiem'), 'Separatory ozdobne', 'linia kwiat separator', `M 2 49 L 36 49 L 36 51 L 2 51 Z M 64 49 L 98 49 L 98 51 L 64 51 Z ${przenies(platki(6, 26, 10, { od: 6 }), 50, 50, 0.24)}`],
  ['sep-trzy-romby', tt('ksztaltyWiecej.liniaZTrzemaRombami'), 'Separatory ozdobne', 'linia romby separator', `M 2 49 L 30 49 L 30 51 L 2 51 Z M 70 49 L 98 49 L 98 51 L 70 51 Z ${romb(38, 50, 4)} ${romb(50, 50, 6)} ${romb(62, 50, 4)}`],
  ['sep-zawijasy', tt('ksztaltyWiecej.zawijasy'), 'Separatory ozdobne', 'zawijasy ornament vintage separator', 'M 50 50 C 40 40 28 40 24 46 C 20 52 26 58 32 54 C 36 51 34 46 30 47 M 50 50 C 60 40 72 40 76 46 C 80 52 74 58 68 54 C 64 51 66 46 70 47 M 50 50 C 40 60 20 62 4 50 M 50 50 C 60 60 80 62 96 50', { otwarta: true }],
  ['sep-szewrony', tt('ksztaltyWiecej.szewrony'), 'Separatory ozdobne', 'szewrony zygzak separator', 'M 4 44 L 12 52 L 20 44 L 28 52 L 36 44 L 44 52 L 52 44 L 60 52 L 68 44 L 76 52 L 84 44 L 92 52', { otwarta: true }],
  ['sep-petelki', tt('ksztaltyWiecej.petelki'), 'Separatory ozdobne', 'petelki linia ozdobnik', 'M 2 56 C 10 56 14 40 20 42 C 26 44 20 58 14 52 C 10 48 20 40 30 56 C 38 56 42 40 48 42 C 54 44 48 58 42 52 C 38 48 48 40 58 56 C 66 56 70 40 76 42 C 82 44 76 58 70 52 C 66 48 76 40 86 56 L 98 56', { otwarta: true }],
  ['sep-liscie', tt('ksztaltyWiecej.liniaZListkami'), 'Separatory ozdobne', 'linia listki galazka separator', `M 4 49 L 96 49 L 96 51 L 4 51 Z ${[20, 40, 60, 80].map((x, i) => przenies(obroc(elipsa(50, 50, 4, 9), i % 2 ? 45 : -45), x, i % 2 ? 57 : 43, 1)).join(' ')}`],
  ['sep-kropki-rosnace', tt('ksztaltyWiecej.kropkiRosnace'), 'Separatory ozdobne', 'kropki separator rosnace', [[10, 1.5], [22, 2.5], [36, 3.5], [50, 5], [64, 3.5], [78, 2.5], [90, 1.5]].map(([x, r]) => okrag(x, 50, r)).join(' ')],
  ['sep-fala-gesta', tt('ksztaltyWiecej.falaGesta'), 'Separatory ozdobne', 'fala linia separator', `M 2 50 ${Array.from({ length: 8 }, (_, i) => `C ${2 + i * 12 + 4} 42 ${2 + i * 12 + 8} 42 ${2 + i * 12 + 12} 50`).join(' ').replace(/^C/, 'C')}`, { otwarta: true }],
  ['sep-art-deco', tt('ksztaltyWiecej.separatorArtDeco'), 'Separatory ozdobne', 'art deco separator linia', `M 2 49 L 34 49 L 34 51 L 2 51 Z M 66 49 L 98 49 L 98 51 L 66 51 Z M 10 45 L 30 45 L 30 46 L 10 46 Z M 70 45 L 90 45 L 90 46 L 70 46 Z ${romb(50, 50, 10)} ${romb(50, 50, 6)}`, { otwor: true }],

  // ===== Etykiety (więcej) =====
  ['etykieta-owalna', tt('ksztaltyWiecej.etykietaOwalna'), 'Etykiety', 'etykieta owal naklejka', `${elipsa(50, 50, 46, 30)} ${elipsa(50, 50, 40, 24)}`, { otwor: true }],
  ['etykieta-obwodka', tt('ksztaltyWiecej.etykietaZObwodka'), 'Etykiety', 'etykieta obwodka ramka napis', `${zaokr(4, 24, 92, 52, 8)} ${zaokr(8, 28, 84, 44, 5)} ${zaokr(10, 30, 80, 40, 4)}`, { otwor: true }],
  ['etykieta-wstega', tt('ksztaltyWiecej.etykietaWstegowa'), 'Etykiety', 'etykieta wstega cena', 'M 4 30 L 96 30 L 86 50 L 96 70 L 4 70 L 14 50 Z'],
  ['etykieta-falista', tt('ksztaltyWiecej.etykietaFalista'), 'Etykiety', 'etykieta falista naklejka', falistyProst(6, 26, 88, 48, 8)],
  ['etykieta-ząbkowana', 'Etykieta ząbkowana', 'Etykiety', 'etykieta zabkowana kupon bilet', zabkowanyProst(6, 26, 88, 48, 10)],
  ['etykieta-sloik', tt('ksztaltyWiecej.etykietaNaSloik'), 'Etykiety', 'etykieta sloik przetwory dzem', 'M 20 22 C 36 16 64 16 80 22 L 84 50 L 80 78 C 64 84 36 84 20 78 L 16 50 Z'],
  ['etykieta-cenowka', tt('ksztaltyWiecej.cenowka'), 'Etykiety', 'cenowka cena metka sklep', `M 40 6 L 94 6 L 94 60 L 52 96 L 4 48 Z ${okrag(78, 22, 6)}`, { otwor: true }],
  ['etykieta-kolo-zabki', tt('ksztaltyWiecej.etykietaOkraglaZabkowana'), 'Etykiety', 'etykieta okragla naklejka', `${gwiazda(30, 0.93)} ${okrag(50, 50, 36)}`, { otwor: true }],
  ['etykieta-tarcza', tt('ksztaltyWiecej.etykietaHerbowa'), 'Etykiety', 'etykieta tarcza herb vintage', 'M 10 10 L 90 10 L 90 60 C 90 80 70 92 50 96 C 30 92 10 80 10 60 Z'],
  ['etykieta-szesciokat', tt('ksztaltyWiecej.etykietaSzesciokatna'), 'Etykiety', 'etykieta szesciokat napis', 'M 20 25 L 80 25 L 96 50 L 80 75 L 20 75 L 4 50 Z'],
  ['naklejka-kolo', tt('ksztaltyWiecej.naklejkaOkragla'), 'Etykiety', 'naklejka kolo kropka', okrag(50, 50, 45)],
  ['etykieta-chmurka', tt('ksztaltyWiecej.etykietaChmurka'), 'Etykiety', 'etykieta chmurka dzieci', przenies(falistyKrag(16, 40), 50, 50, 1.12, 0.72)],

  // ===== Ramki: Proste =====
  ['ramka-cienka', tt('ksztaltyWiecej.ramkaCienka'), 'Ramki proste', 'ramka cienka obramowanie', ramkaProst(5, 5, 90, 90, 3), { otwor: true }],
  ['ramka-gruba', tt('ksztaltyWiecej.ramkaGruba'), 'Ramki proste', 'ramka gruba obramowanie', ramkaProst(5, 5, 90, 90, 16), { otwor: true }],
  ['ramka-pozioma', tt('ksztaltyWiecej.ramkaPozioma'), 'Ramki proste', 'ramka pozioma panorama', ramkaProst(3, 20, 94, 60, 6), { otwor: true }],
  ['ramka-pionowa', tt('ksztaltyWiecej.ramkaPionowa'), 'Ramki proste', 'ramka pionowa portret', ramkaProst(18, 3, 64, 94, 6), { otwor: true }],
  ['ramka-panorama', tt('ksztaltyWiecej.ramkaPanoramiczna'), 'Ramki proste', 'ramka panorama szeroka', ramkaProst(2, 32, 96, 36, 4), { otwor: true }],
  ['ramka-kontur', tt('ksztaltyWiecej.ramkaSamKontur'), 'Ramki proste', 'ramka kontur obrys linia', prost(5, 5, 90, 90), { kontur: true }],

  // ===== Ramki: Zaokrąglone =====
  ['ramka-zaokr-mala', tt('ksztaltyWiecej.ramkaLekkoZaokraglona'), 'Ramki zaokrąglone', 'ramka zaokraglona', ramkaZaokr(5, 5, 90, 90, 8, 6), { otwor: true }],
  ['ramka-zaokr-duza', tt('ksztaltyWiecej.ramkaMocnoZaokraglona'), 'Ramki zaokrąglone', 'ramka zaokraglona', ramkaZaokr(5, 5, 90, 90, 8, 26), { otwor: true }],
  ['ramka-pigulka', tt('ksztaltyWiecej.ramkaPigulka'), 'Ramki zaokrąglone', 'ramka pigulka kapsula', ramkaZaokr(3, 26, 94, 48, 6, 24), { otwor: true }],
  ['ramka-zaokr-pozioma', tt('ksztaltyWiecej.ramkaZaokraglonaPozioma'), 'Ramki zaokrąglone', 'ramka zaokraglona pozioma', ramkaZaokr(3, 18, 94, 64, 6, 12), { otwor: true }],
  ['ramka-zaokr-cienka', tt('ksztaltyWiecej.ramkaZaokraglonaCienka'), 'Ramki zaokrąglone', 'ramka zaokraglona cienka', ramkaZaokr(5, 5, 90, 90, 3, 12), { otwor: true }],
  ['ramka-zaokr-kontur', tt('ksztaltyWiecej.ramkaZaokraglonaKontur'), 'Ramki zaokrąglone', 'ramka zaokraglona kontur obrys', zaokr(5, 5, 90, 90, 12), { kontur: true }],

  // ===== Ramki: Podwójne i przerywane =====
  ['ramka-potrojna', tt('ksztaltyWiecej.ramkaPotrojna'), 'Ramki podwójne i przerywane', 'ramka potrojna linie', `${ramkaProst(4, 4, 92, 92, 3)} ${ramkaProst(10, 10, 80, 80, 2)} ${ramkaProst(15, 15, 70, 70, 1.5)}`, { otwor: true }],
  ['ramka-podwojna-zaokr', tt('ksztaltyWiecej.ramkaPodwojnaZaokraglona'), 'Ramki podwójne i przerywane', 'ramka podwojna zaokraglona', `${ramkaZaokr(4, 4, 92, 92, 4, 14)} ${ramkaZaokr(12, 12, 76, 76, 2, 8)}`, { otwor: true }],
  ['ramka-gruba-cienka', tt('ksztaltyWiecej.ramkaGrubaZCienka'), 'Ramki podwójne i przerywane', 'ramka podwojna gruba cienka', `${ramkaProst(4, 4, 92, 92, 7)} ${ramkaProst(15, 15, 70, 70, 1.5)}`, { otwor: true }],
  ['ramka-przerywana', tt('ksztaltyWiecej.ramkaPrzerywana'), 'Ramki podwójne i przerywane', 'ramka przerywana kupon ciecie', prost(5, 5, 90, 90), { kontur: true, kreski: 'przerywana' }],
  ['ramka-kropkowana', tt('ksztaltyWiecej.ramkaKropkowana'), 'Ramki podwójne i przerywane', 'ramka kropkowana kropki', prost(5, 5, 90, 90), { kontur: true, kreski: 'kropkowana' }],
  ['ramka-kreska-kropka', tt('ksztaltyWiecej.ramkaKreskaKropka'), 'Ramki podwójne i przerywane', 'ramka kreska kropka', prost(5, 5, 90, 90), { kontur: true, kreski: 'kreska-kropka' }],
  ['ramka-przerywana-zaokr', tt('ksztaltyWiecej.ramkaPrzerywanaZaokraglona'), 'Ramki podwójne i przerywane', 'ramka przerywana zaokraglona', zaokr(5, 5, 90, 90, 14), { kontur: true, kreski: 'przerywana' }],
  ['ramka-kropkowana-kolo', tt('ksztaltyWiecej.ramkaKropkowanaOkragla'), 'Ramki podwójne i przerywane', 'ramka kropkowana kolo', okrag(50, 50, 45), { kontur: true, kreski: 'kropkowana' }],

  // ===== Ramki: Ozdobne =====
  ['ramka-zabkowana', tt('ksztaltyWiecej.ramkaZabkowana'), 'Ramki ozdobne', 'ramka zabkowana stara fotografia', `${zabkowanyProst(4, 4, 92, 92, 10)} ${prost(14, 14, 72, 72)}`, { otwor: true }],
  ['ramka-kola-rogi', tt('ksztaltyWiecej.ramkaZKolkamiW'), 'Ramki ozdobne', 'ramka kola rogi ozdobna', `${ramkaProstNZ(10, 10, 80, 80, 4)} ${okrag(10, 10, 8)} ${okrag(90, 10, 8)} ${okrag(10, 90, 8)} ${okrag(90, 90, 8)}`],
  ['ramka-kwadraty-rogi', tt('ksztaltyWiecej.ramkaZKwadratamiW'), 'Ramki ozdobne', 'ramka kwadraty rogi ozdobna', `${ramkaProstNZ(10, 10, 80, 80, 4)} ${prost(3, 3, 14, 14)} ${prost(83, 3, 14, 14)} ${prost(3, 83, 14, 14)} ${prost(83, 83, 14, 14)}`],
  ['ramka-sciete', tt('ksztaltyWiecej.ramkaZeScietymiRogami'), 'Ramki ozdobne', 'ramka sciete rogi', `${punkty([[20, 4], [80, 4], [96, 20], [96, 80], [80, 96], [20, 96], [4, 80], [4, 20]])} ${punkty([[24, 12], [76, 12], [88, 24], [88, 76], [76, 88], [24, 88], [12, 76], [12, 24]])}`, { otwor: true }],
  ['ramka-art-deco', tt('ksztaltyWiecej.ramkaArtDeco'), 'Ramki ozdobne', 'ramka art deco schodki', `${punkty([[16, 4], [84, 4], [84, 10], [90, 10], [90, 16], [96, 16], [96, 84], [90, 84], [90, 90], [84, 90], [84, 96], [16, 96], [16, 90], [10, 90], [10, 84], [4, 84], [4, 16], [10, 16], [10, 10], [16, 10]])} ${prost(16, 16, 68, 68)}`, { otwor: true }],
  ['ramka-romby', tt('ksztaltyWiecej.ramkaZRombami'), 'Ramki ozdobne', 'ramka romby ozdobna', `${ramkaProstNZ(8, 8, 84, 84, 3)} ${romb(50, 9.5, 6)} ${romb(50, 90.5, 6)} ${romb(9.5, 50, 6)} ${romb(90.5, 50, 6)}`],
  ['ramka-luki-rogi', tt('ksztaltyWiecej.ramkaZWkleslymiRogami'), 'Ramki ozdobne', 'ramka wklesle rogi ozdobna vintage', `M 18 4 L 82 4 A 14 14 0 0 0 96 18 L 96 82 A 14 14 0 0 0 82 96 L 18 96 A 14 14 0 0 0 4 82 L 4 18 A 14 14 0 0 0 18 4 Z M 22 12 L 78 12 A 10 10 0 0 0 88 22 L 88 78 A 10 10 0 0 0 78 88 L 22 88 A 10 10 0 0 0 12 78 L 12 22 A 10 10 0 0 0 22 12 Z`, { otwor: true }],
  ['ramka-narozniki-ozdobne', tt('ksztaltyWiecej.ramkaZOzdobnymiNaroznikami'), 'Ramki ozdobne', 'ramka narozniki ozdobna vintage', `${ramkaProst(8, 8, 84, 84, 2)} ${narozniki('M 3 3 L 28 3 L 28 6 L 6 6 L 6 28 L 3 28 Z M 12 12 L 18 12 L 18 18 L 12 18 Z')}`, { otwor: true }],
  ['ramka-sznurek', tt('ksztaltyWiecej.ramkaZKropek'), 'Ramki ozdobne', 'ramka kropki koraliki sznurek', obwodzik((x, y) => okrag(x, y, 2.6), 9, { x: 6, y: 6, w: 88, h: 88 })],
  ['ramka-listki', tt('ksztaltyWiecej.ramkaZListkami'), 'Ramki ozdobne', 'ramka listki wianek natura', `${okrag(50, 50, 42)} ${okrag(50, 50, 40)} ${naOkregu(16, 41).map(([x, y], i) => przenies(obroc(elipsa(50, 50, 3, 7), (i * 360) / 16 + 40), x, y, 1)).join(' ')}`, { otwor: true }],

  // ===== Ramki: Z miejscem na tytuł =====
  ['ramka-przerwa-gora', tt('ksztaltyWiecej.ramkaZPrzerwaNa'), 'Ramki z tytułem', 'ramka tytul przerwa naglowek', 'M 30 8 L 5 8 L 5 95 L 95 95 L 95 8 L 70 8 L 70 11 L 92 11 L 92 92 L 8 92 L 8 11 L 30 11 Z'],
  ['ramka-tabliczka', tt('ksztaltyWiecej.ramkaZTabliczkaU'), 'Ramki z tytułem', 'ramka tytul tabliczka naglowek', `${ramkaProstNZ(5, 14, 90, 82, 3)} ${zaokr(25, 4, 50, 20, 4)}`],
  ['ramka-pasek-tytulu', tt('ksztaltyWiecej.ramkaZPaskiemTytulu'), 'Ramki z tytułem', 'ramka tytul pasek naglowek', `M 5 5 L 95 5 L 95 95 L 5 95 Z M 8 24 L 8 92 L 92 92 L 92 24 Z`, { otwor: true }],
  ['ramka-zaokr-przerwa', tt('ksztaltyWiecej.ramkaZaokraglonaZPrzerwa'), 'Ramki z tytułem', 'ramka zaokraglona tytul przerwa', 'M 30 8 L 20 8 A 15 15 0 0 0 5 23 L 5 80 A 15 15 0 0 0 20 95 L 80 95 A 15 15 0 0 0 95 80 L 95 23 A 15 15 0 0 0 80 8 L 70 8 L 70 11 L 80 11 A 12 12 0 0 1 92 23 L 92 80 A 12 12 0 0 1 80 92 L 20 92 A 12 12 0 0 1 8 80 L 8 23 A 12 12 0 0 1 20 11 L 30 11 Z'],
  ['ramka-wstega-tytul', tt('ksztaltyWiecej.ramkaZeWstega'), 'Ramki z tytułem', 'ramka wstega tytul', `${ramkaProstNZ(8, 14, 84, 82, 3)} M 18 6 L 82 6 L 82 24 L 18 24 Z M 18 10 L 10 10 L 14 15 L 10 20 L 18 20 Z M 82 10 L 90 10 L 86 15 L 90 20 L 82 20 Z`],
  ['ramka-zakladka', tt('ksztaltyWiecej.ramkaZZakladka'), 'Ramki z tytułem', 'ramka zakladka teczka folder', `M 5 20 L 5 95 L 95 95 L 95 20 L 52 20 L 44 8 L 5 8 Z M 8 23 L 8 92 L 92 92 L 92 23 Z`, { otwor: true }],

  // ===== Ramki: Kartki i notatki =====
  ['kartka-rog', tt('ksztaltyWiecej.kartkaZZagietymRogiem'), 'Kartki i notatki', 'kartka notatka zagiety rog dokument', 'M 8 4 L 70 4 L 92 26 L 92 96 L 8 96 Z M 70 4 L 70 26 L 92 26'],
  ['karteczka', tt('ksztaltyWiecej.karteczkaSamoprzylepna'), 'Kartki i notatki', 'karteczka notatka przypomnienie', 'M 8 8 L 92 8 L 92 74 C 80 80 76 86 74 92 L 8 92 Z M 74 92 C 76 82 82 76 92 74 Z'],
  ['kartka-tasma', tt('ksztaltyWiecej.kartkaZTasma'), 'Kartki i notatki', 'kartka tasma notatka scrapbook', `${prost(10, 12, 80, 84)} ${przenies(obroc(prost(30, 42, 40, 16), -6), 50, 12, 1)}`],
  ['kartka-dziurki', tt('ksztaltyWiecej.kartkaZDziurkami'), 'Kartki i notatki', 'kartka segregator dziurki zeszyt', `${prost(10, 4, 82, 92)} ${[18, 50, 82].map((y) => okrag(20, y, 4)).join(' ')}`, { otwor: true }],
  ['kartka-podarta', tt('ksztaltyWiecej.kartkaPodarta'), 'Kartki i notatki', 'kartka podarta wyrwana notes', `M 8 4 L 92 4 L ${Array.from({ length: 13 }, (_, i) => `${92 - i * 7} ${i % 2 ? 96 : 89}`).join(' L ')} Z`],
  ['kartka-spirala', tt('ksztaltyWiecej.kartkaZKolonotatnika'), 'Kartki i notatki', 'kartka spirala notes kolonotatnik', `${prost(8, 14, 84, 82)} ${[18, 32, 46, 60, 74].map((x) => `${okrag(x + 4, 20, 2.5)} ${prost(x + 2.5, 4, 3, 14)}`).join(' ')}`, { otwor: true }],

  // ===== Ramki: Na zdjęcie (pola na obraz) =====
  ['zdj-kolo', tt('ksztaltyWiecej.zdjecieWKole'), 'Na zdjęcie', 'zdjecie kolo portret pole obraz', okrag(50, 50, 45), { naZdjecie: true }],
  ['zdj-owal', tt('ksztaltyWiecej.zdjecieWOwalu'), 'Na zdjęcie', 'zdjecie owal portret medalion pole obraz', elipsa(50, 50, 36, 46), { naZdjecie: true }],
  ['zdj-serce', tt('ksztaltyWiecej.zdjecieWSercu'), 'Na zdjęcie', 'zdjecie serce milosc pole obraz', serce(50, 50, 90), { naZdjecie: true }],
  ['zdj-luk', tt('ksztaltyWiecej.zdjecieWLuku'), 'Na zdjęcie', 'zdjecie luk okno pole obraz', 'M 12 96 L 12 44 A 38 38 0 0 1 88 44 L 88 96 Z', { naZdjecie: true }],
  ['zdj-szesciokat', tt('ksztaltyWiecej.zdjecieWSzesciokacie'), 'Na zdjęcie', 'zdjecie szesciokat pole obraz', wielokat(6, 0), { naZdjecie: true }],
  ['zdj-osmiokat', tt('ksztaltyWiecej.zdjecieWOsmiokacie'), 'Na zdjęcie', 'zdjecie osmiokat pole obraz', wielokat(8, Math.PI / 8), { naZdjecie: true }],
  ['zdj-chmurka', tt('ksztaltyWiecej.zdjecieWChmurce'), 'Na zdjęcie', 'zdjecie chmurka falista pole obraz', falistyKrag(14, 40), { naZdjecie: true }],
  ['zdj-romb', tt('ksztaltyWiecej.zdjecieWRombie'), 'Na zdjęcie', 'zdjecie romb pole obraz', wielokat(4), { naZdjecie: true }],
  ['zdj-zaokr', tt('ksztaltyWiecej.zdjecieZaokraglone'), 'Na zdjęcie', 'zdjecie zaokraglone pole obraz', zaokr(5, 5, 90, 90, 16), { naZdjecie: true }],
  ['zdj-kropla', tt('ksztaltyWiecej.zdjecieWKropli'), 'Na zdjęcie', 'zdjecie kropla lisc pole obraz', 'M 50 5 L 95 5 L 95 50 A 45 45 0 1 1 50 5 Z', { naZdjecie: true }],
  ['zdj-gwiazda', tt('ksztaltyWiecej.zdjecieWGwiezdzie'), 'Na zdjęcie', 'zdjecie gwiazda pole obraz', gwiazda(5, 0.5), { naZdjecie: true }],
  ['ramka-polaroid-kw', tt('ksztaltyWiecej.odbitkaKwadratowa'), 'Na zdjęcie', 'odbitka polaroid kwadrat ramka zdjecie', `${prost(10, 4, 80, 92)} ${prost(16, 10, 68, 68)}`, { otwor: true }],
  ['ramka-slajd', tt('ksztaltyWiecej.ramkaSlajdu'), 'Na zdjęcie', 'slajd diapozytyw ramka zdjecie retro', `${zaokr(4, 4, 92, 92, 6)} ${zaokr(20, 26, 60, 48, 3)}`, { otwor: true }],
  ['ramka-film', tt('ksztaltyWiecej.klatkaFilmu'), 'Na zdjęcie', 'film klisza klatka kino zdjecie', `${prost(2, 14, 96, 72)} ${prost(14, 26, 72, 48)} ${[8, 20, 32, 44, 56, 68, 80, 92].map((x) => `${prost(x - 3, 17, 6, 5)} ${prost(x - 3, 78, 6, 5)}`).join(' ')}`, { otwor: true }],

  // ===== Ramki: W kształcie =====
  ['ramka-chmurka', tt('ksztaltyWiecej.ramkaChmurka'), 'Ramki w kształcie', 'ramka chmurka falista dzieci', `${falistyKrag(14, 40)} ${okrag(50, 50, 32)}`, { otwor: true }],
  ['ramka-osmiokat', tt('ksztaltyWiecej.ramkaOsmiokatna'), 'Ramki w kształcie', 'ramka osmiokat', `${wielokat(8, Math.PI / 8)} ${wielokat(8, Math.PI / 8, 36)}`, { otwor: true }],
  ['ramka-szesciokat', tt('ksztaltyWiecej.ramkaSzesciokatna'), 'Ramki w kształcie', 'ramka szesciokat plaster', `${wielokat(6, 0)} ${wielokat(6, 0, 36)}`, { otwor: true }],
  ['ramka-luk', tt('ksztaltyWiecej.ramkaLukowa'), 'Ramki w kształcie', 'ramka luk okno brama', pierscien('M 10 96 L 10 46 A 40 40 0 0 1 90 46 L 90 96 Z', 'M 19 88 L 19 46 A 31 31 0 0 1 81 46 L 81 88 Z'), { otwor: true }],
  ['ramka-romb', tt('ksztaltyWiecej.ramkaRombowa'), 'Ramki w kształcie', 'ramka romb diament', `${romb(50, 50, 47)} ${romb(50, 50, 35)}`, { otwor: true }],
  ['ramka-gwiazda', tt('ksztaltyWiecej.ramkaGwiazda'), 'Ramki w kształcie', 'ramka gwiazda', `${gwiazda(5, 0.5)} ${przenies(gwiazda(5, 0.5), 50, 52, 0.7)}`, { otwor: true }],
  ['ramka-tarcza', tt('ksztaltyWiecej.ramkaTarcza'), 'Ramki w kształcie', 'ramka tarcza herb', `M 50 4 L 92 18 C 92 60 75 82 50 96 C 25 82 8 60 8 18 Z ${przenies('M 50 4 L 92 18 C 92 60 75 82 50 96 C 25 82 8 60 8 18 Z', 50, 50, 0.8)}`, { otwor: true }],
  ['ramka-kropla', tt('ksztaltyWiecej.ramkaKropla'), 'Ramki w kształcie', 'ramka kropla lisc', `M 50 5 L 95 5 L 95 50 A 45 45 0 1 1 50 5 Z ${przenies('M 50 5 L 95 5 L 95 50 A 45 45 0 1 1 50 5 Z', 52, 48, 0.78)}`, { otwor: true }],

  // ===== Ramki: Obramowania stron (na całą stronę) =====
  ['bordiura-linia', tt('ksztaltyWiecej.obramowanieStronyLinia'), 'Obramowania stron', 'obramowanie strony bordiura linia', `${prost(15, 2, 70, 96)} ${prost(16.2, 3.2, 67.6, 93.6)}`, { otwor: true, strona: true }],
  ['bordiura-podwojna', tt('ksztaltyWiecej.obramowanieStronyPodwojne'), 'Obramowania stron', 'obramowanie strony bordiura podwojne', `${ramkaProst(15, 2, 70, 96, 1.4)} ${ramkaProst(17.4, 4.4, 65.2, 91.2, 0.5)}`, { otwor: true, strona: true }],
  ['bordiura-narozniki', tt('ksztaltyWiecej.obramowanieStronyZNaroznikami'), 'Obramowania stron', 'obramowanie strony bordiura narozniki vintage', `${ramkaProst(21, 9, 58, 82, 0.6)} ${przenies(narozniki('M 3 3 L 28 3 L 28 6 L 6 6 L 6 28 L 3 28 Z M 12 12 L 18 12 L 18 18 L 12 18 Z'), 50, 50, 0.7, 0.96)}`, { otwor: true, strona: true }],
  ['bordiura-kropki', tt('ksztaltyWiecej.obramowanieStronyZKropek'), 'Obramowania stron', 'obramowanie strony bordiura kropki', obwodzik((x, y) => okrag(x, y, 1.1), 4), { strona: true }],
  ['bordiura-romby', tt('ksztaltyWiecej.obramowanieStronyZRombow'), 'Obramowania stron', 'obramowanie strony bordiura romby', obwodzik((x, y) => romb(x, y, 1.6), 5), { strona: true }],
  ['bordiura-zabki', tt('ksztaltyWiecej.obramowanieStronyZabkowane'), 'Obramowania stron', 'obramowanie strony bordiura zabki znaczek', `${zabkowanyProst(15, 2, 70, 96, 14)} ${prost(18, 5, 64, 90)}`, { otwor: true, strona: true }],
  ['bordiura-falista', tt('ksztaltyWiecej.obramowanieStronyFaliste'), 'Obramowania stron', 'obramowanie strony bordiura falista', `${falistyProst(15, 2, 70, 96, 12)} ${prost(18.5, 5.5, 63, 89)}`, { otwor: true, strona: true }],
  ['bordiura-gwiazdki', tt('ksztaltyWiecej.obramowanieStronyZGwiazdek'), 'Obramowania stron', 'obramowanie strony bordiura gwiazdki', obwodzik((x, y) => przenies(gwiazda(5, 0.45), x, y, 0.045), 6), { strona: true }],

  // ===== Planer: notatki =====
  ['linie-notatki', tt('ksztaltyWiecej.linieDoNotatek'), 'Notatki', 'linie notatki zeszyt linijki', Array.from({ length: 10 }, (_, i) => `M 0 ${5 + i * 10} L 100 ${5 + i * 10}`).join(' '), { otwarta: true, siatka: true }],
  ['kratka-gesta', tt('ksztaltyWiecej.papierMilimetrowy'), 'Notatki', 'papier milimetrowy kratka gesta siatka', Array.from({ length: 21 }, (_, i) => `M ${i * 5} 0 L ${i * 5} 100 M 0 ${i * 5} L 100 ${i * 5}`).join(' '), { otwarta: true, siatka: true }],
  ['izometryczna', tt('ksztaltyWiecej.siatkaIzometryczna'), 'Notatki', 'siatka izometryczna trojkatna kropki', Array.from({ length: 10 }, (_, j) => Array.from({ length: 11 }, (_, i) => okrag(i * 10 + (j % 2 ? 5 : 0), 5 + j * 10 * 0.866, 0.6)).join(' ')).join(' '), { siatka: true }],
];

