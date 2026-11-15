// Biblioteka kształtów i kolaże (decyzja #131A).
//
// Kształty: własne ścieżki SVG w polu 100 × 100 (bez cudzych licencji). Wstawiane jako zwykła ścieżka –
// kolor, obrys, edycja punktów i obraz w kształcie (#123, gdy ścieżka jest zamknięta) działają jak w każdym
// kształcie z pióra. Ramki mają otwór (reguła wypełnienia evenodd).
//
// Kolaże: gotowe układy pól na zdjęcia (prostokąty – ramki obrazu z #123) zebrane w grupę z opisem
// `kolaz` { uklad, odstep, zaokraglenie, szerokosc, wysokosc }; ulozKolaz() rozstawia pola od nowa po zmianie
// odstępu, zaokrąglenia albo rozmiaru.

const r1 = (x) => Math.round(x * 100) / 100;
const punkty = (lista) => `M ${lista.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L ')} Z`;

// Gwiazda albo wybuch: n ramion, promień wewnętrzny jako ułamek zewnętrznego.
function gwiazda(n, wewn, obrot = -Math.PI / 2) {
  const p = [];
  for (let i = 0; i < n * 2; i += 1) {
    const r = i % 2 ? 45 * wewn : 45;
    const a = obrot + (i * Math.PI) / n;
    p.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
  }
  return punkty(p);
}

// Okrąg z dwóch łuków (kierunek: 1 – zgodnie, 0 – przeciwnie do ruchu wskazówek).
const okrag = (cx, cy, r, kier = 1) => `M ${r1(cx - r)} ${r1(cy)} A ${r} ${r} 0 1 ${kier} ${r1(cx + r)} ${r1(cy)} A ${r} ${r} 0 1 ${kier} ${r1(cx - r)} ${r1(cy)} Z`;

// Ramka z falistym brzegiem: półkola na obwodzie prostokąta, w środku prostokątny otwór.
function ramkaFalista() {
  const n = 7;
  const s = 90 / n;
  let d = 'M 5 5';
  for (let i = 0; i < n; i += 1) d += ` A ${r1(s / 2)} ${r1(s / 2)} 0 0 1 ${r1(5 + (i + 1) * s)} 5`;
  for (let i = 0; i < n; i += 1) d += ` A ${r1(s / 2)} ${r1(s / 2)} 0 0 1 95 ${r1(5 + (i + 1) * s)}`;
  for (let i = 0; i < n; i += 1) d += ` A ${r1(s / 2)} ${r1(s / 2)} 0 0 1 ${r1(95 - (i + 1) * s)} 95`;
  for (let i = 0; i < n; i += 1) d += ` A ${r1(s / 2)} ${r1(s / 2)} 0 0 1 5 ${r1(95 - (i + 1) * s)}`;
  return `${d} Z M 18 18 L 82 18 L 82 82 L 18 82 Z`;
}

function slonce() {
  let d = okrag(50, 50, 20);
  for (let i = 0; i < 12; i += 1) {
    const a = (i * Math.PI) / 6;
    const p = (r, da) => [50 + r * Math.cos(a + da), 50 + r * Math.sin(a + da)];
    d += ` ${punkty([p(27, -0.12), p(45, 0), p(27, 0.12)])}`;
  }
  return d;
}

function kwiat(n = 6) {
  let d = '';
  for (let i = 0; i < n; i += 1) {
    const a = (i * 2 * Math.PI) / n - Math.PI / 2;
    const cx = 50 + 24 * Math.cos(a);
    const cy = 50 + 24 * Math.sin(a);
    d += `${okrag(cx, cy, 20)} `;
  }
  return `${d}${okrag(50, 50, 14)}`;
}

// [id, nazwa, kategoria, słowa do wyszukiwania, ścieżka, { otwarta, otwor }]
const DEF = [
  // Figury
  ['trojkat', 'Trójkąt', 'Figury', 'trojkat', 'M 50 5 L 95 92 L 5 92 Z'],
  ['trojkat-prosty', 'Trójkąt prostokątny', 'Figury', 'trojkat', 'M 5 5 L 5 95 L 95 95 Z'],
  ['romb', 'Romb', 'Figury', 'romb diament', 'M 50 3 L 97 50 L 50 97 L 3 50 Z'],
  ['trapez', 'Trapez', 'Figury', 'trapez', 'M 22 15 L 78 15 L 97 85 L 3 85 Z'],
  ['rownoleglobok', 'Równoległobok', 'Figury', 'rownoleglobok', 'M 25 15 L 97 15 L 75 85 L 3 85 Z'],
  ['szesciokat', 'Sześciokąt', 'Figury', 'szesciokat plaster', 'M 27 6 L 73 6 L 96 50 L 73 94 L 27 94 L 4 50 Z'],
  ['osmiokat', 'Ośmiokąt', 'Figury', 'osmiokat stop', 'M 30 3 L 70 3 L 97 30 L 97 70 L 70 97 L 30 97 L 3 70 L 3 30 Z'],
  ['plus', 'Krzyżyk', 'Figury', 'plus krzyz', 'M 38 5 L 62 5 L 62 38 L 95 38 L 95 62 L 62 62 L 62 95 L 38 95 L 38 62 L 5 62 L 5 38 L 38 38 Z'],
  ['polkole', 'Półkole', 'Figury', 'polkole luk', 'M 5 72 A 45 45 0 0 1 95 72 Z'],
  ['kropla', 'Kropla', 'Figury', 'kropla lza woda', 'M 50 5 C 50 5 85 45 85 63 A 35 35 0 0 1 15 63 C 15 45 50 5 50 5 Z'],
  ['ksiezyc', 'Księżyc', 'Figury', 'ksiezyc noc', 'M 62 6 A 45 45 0 1 0 94 72 A 36 36 0 1 1 62 6 Z'],
  ['chmura', 'Chmura', 'Figury', 'chmura pogoda', 'M 26 82 A 18 18 0 0 1 22 46 A 22 22 0 0 1 60 30 A 20 20 0 0 1 90 56 A 14 14 0 0 1 82 82 Z'],
  ['tarcza', 'Tarcza', 'Figury', 'tarcza herb', 'M 50 4 L 92 18 C 92 60 75 82 50 96 C 25 82 8 60 8 18 Z'],
  ['lisc', 'Liść', 'Figury', 'lisc natura', 'M 10 90 C 10 40 40 10 90 10 C 90 60 60 90 10 90 Z'],
  // Gwiazdy i serca
  ['gwiazda5', 'Gwiazda', 'Gwiazdy i serca', 'gwiazda', gwiazda(5, 0.42)],
  ['gwiazda6', 'Gwiazda sześcioramienna', 'Gwiazdy i serca', 'gwiazda', gwiazda(6, 0.55)],
  ['gwiazda8', 'Gwiazda ośmioramienna', 'Gwiazdy i serca', 'gwiazda', gwiazda(8, 0.5)],
  ['rozeta', 'Rozeta', 'Gwiazdy i serca', 'rozeta odznaka pieczec', gwiazda(16, 0.82)],
  ['wybuch', 'Wybuch', 'Gwiazdy i serca', 'wybuch promocja krzyk', gwiazda(12, 0.62, 0.2)],
  ['serce', 'Serce', 'Gwiazdy i serca', 'serce milosc walentynki', 'M 50 90 C 20 70 5 52 5 33 C 5 18 17 8 30 8 C 40 8 47 14 50 22 C 53 14 60 8 70 8 C 83 8 95 18 95 33 C 95 52 80 70 50 90 Z'],
  ['piorun', 'Błyskawica', 'Gwiazdy i serca', 'piorun blyskawica', 'M 58 3 L 18 55 L 45 55 L 38 97 L 82 40 L 55 40 Z'],
  ['kwiat', 'Kwiatek', 'Gwiazdy i serca', 'kwiat kwiatek', kwiat(6)],
  ['slonce', 'Słońce', 'Gwiazdy i serca', 'slonce lato', slonce()],
  // Strzałki
  ['strzalka-prawo', 'Strzałka w prawo', 'Strzałki', 'strzalka prawo', 'M 5 35 L 60 35 L 60 15 L 95 50 L 60 85 L 60 65 L 5 65 Z'],
  ['strzalka-lewo', 'Strzałka w lewo', 'Strzałki', 'strzalka lewo', 'M 95 35 L 40 35 L 40 15 L 5 50 L 40 85 L 40 65 L 95 65 Z'],
  ['strzalka-gora', 'Strzałka w górę', 'Strzałki', 'strzalka gora', 'M 35 95 L 35 40 L 15 40 L 50 5 L 85 40 L 65 40 L 65 95 Z'],
  ['strzalka-dol', 'Strzałka w dół', 'Strzałki', 'strzalka dol', 'M 35 5 L 35 60 L 15 60 L 50 95 L 85 60 L 65 60 L 65 5 Z'],
  ['strzalka-obie', 'Strzałka w obie strony', 'Strzałki', 'strzalka obustronna', 'M 5 50 L 28 20 L 28 38 L 72 38 L 72 20 L 95 50 L 72 80 L 72 62 L 28 62 L 28 80 Z'],
  ['strzalka-luk', 'Strzałka zakręcona', 'Strzałki', 'strzalka luk zakret', 'M 10 88 C 10 45 35 25 65 25 L 65 8 L 95 35 L 65 62 L 65 45 C 45 45 30 58 30 88 Z'],
  ['szewron', 'Szewron', 'Strzałki', 'szewron chevron', 'M 5 15 L 60 15 L 95 50 L 60 85 L 5 85 L 40 50 Z'],
  ['strzalka-metka', 'Metka', 'Strzałki', 'metka etykieta strzalka', 'M 5 20 L 70 20 L 95 50 L 70 80 L 5 80 Z'],
  ['strzalka-cienka', 'Strzałka cienka', 'Strzałki', 'strzalka linia', 'M 5 50 L 92 50 M 70 30 L 92 50 L 70 70', { otwarta: true }],
  // Dymki
  ['dymek', 'Dymek', 'Dymki', 'dymek rozmowa komiks', 'M 8 8 L 92 8 L 92 68 L 40 68 L 22 92 L 26 68 L 8 68 Z'],
  ['dymek-zaokr', 'Dymek zaokrąglony', 'Dymki', 'dymek rozmowa komiks', 'M 18 8 L 82 8 Q 92 8 92 18 L 92 58 Q 92 68 82 68 L 42 68 L 24 92 L 28 68 L 18 68 Q 8 68 8 58 L 8 18 Q 8 8 18 8 Z'],
  ['dymek-owal', 'Dymek owalny', 'Dymki', 'dymek rozmowa komiks', 'M 50 8 C 77 8 95 22 95 40 C 95 58 77 72 50 72 C 45 72 40 71 36 70 L 18 92 L 24 66 C 12 60 5 51 5 40 C 5 22 23 8 50 8 Z'],
  ['dymek-mysl', 'Dymek myśli', 'Dymki', 'dymek mysl chmurka komiks', `M 30 62 A 16 16 0 0 1 24 32 A 20 20 0 0 1 60 18 A 18 18 0 0 1 88 38 A 14 14 0 0 1 78 62 Z ${okrag(22, 76, 6)} ${okrag(10, 91, 4)}`],
  ['dymek-krzyk', 'Dymek krzyku', 'Dymki', 'dymek krzyk komiks wybuch', gwiazda(14, 0.72, 0.1)],
  // Wstęgi i banery
  ['wstega', 'Wstęga', 'Wstęgi i banery', 'wstega baner', 'M 3 30 L 18 30 L 18 20 L 82 20 L 82 30 L 97 30 L 88 47 L 97 64 L 82 64 L 82 54 L 18 54 L 18 64 L 3 64 L 12 47 Z'],
  ['proporczyk', 'Proporczyk', 'Wstęgi i banery', 'flaga proporczyk baner', 'M 5 20 L 95 20 L 80 50 L 95 80 L 5 80 Z'],
  ['bilet', 'Bilet', 'Wstęgi i banery', 'bilet kupon etykieta', 'M 15 20 L 85 20 A 10 10 0 0 0 95 30 L 95 70 A 10 10 0 0 0 85 80 L 15 80 A 10 10 0 0 0 5 70 L 5 30 A 10 10 0 0 0 15 20 Z'],
  ['zakladka', 'Zakładka', 'Wstęgi i banery', 'zakladka ksiazka', 'M 20 5 L 80 5 L 80 95 L 50 72 L 20 95 Z'],
  ['fala', 'Wstęga falista', 'Wstęgi i banery', 'fala wstega baner', 'M 5 30 C 25 20 40 40 50 30 C 60 20 75 40 95 30 L 95 70 C 75 80 60 60 50 70 C 40 80 25 60 5 70 Z'],
  // Ramki
  ['ramka', 'Ramka', 'Ramki', 'ramka obramowanie', 'M 5 5 L 95 5 L 95 95 L 5 95 Z M 14 14 L 86 14 L 86 86 L 14 86 Z', { otwor: true }],
  ['ramka-wciecia', 'Ramka z wcięciami', 'Ramki', 'ramka ozdobna', 'M 15 5 L 85 5 A 10 10 0 0 0 95 15 L 95 85 A 10 10 0 0 0 85 95 L 15 95 A 10 10 0 0 0 5 85 L 5 15 A 10 10 0 0 0 15 5 Z M 16 16 L 84 16 L 84 84 L 16 84 Z', { otwor: true }],
  ['ramka-falista', 'Ramka falista', 'Ramki', 'ramka ozdobna falista', ramkaFalista(), { otwor: true }],
  ['ramka-okragla', 'Ramka okrągła', 'Ramki', 'ramka kolo okrag pierscien', `${okrag(50, 50, 45)} ${okrag(50, 50, 36)}`, { otwor: true }],
  ['ramka-podwojna', 'Ramka podwójna', 'Ramki', 'ramka podwojna', 'M 5 5 L 95 5 L 95 95 L 5 95 Z M 9 9 L 91 9 L 91 91 L 9 91 Z M 12 12 L 88 12 L 88 88 L 12 88 Z M 15 15 L 85 15 L 85 85 L 15 85 Z', { otwor: true }],
  // Linie ozdobne
  ['linia-fala', 'Fala', 'Linie ozdobne', 'linia fala ozdobnik', 'M 2 50 C 14 30 26 30 38 50 C 50 70 62 70 74 50 C 86 30 98 30 98 50', { otwarta: true }],
  ['linia-zygzak', 'Zygzak', 'Linie ozdobne', 'linia zygzak', 'M 2 60 L 14 40 L 26 60 L 38 40 L 50 60 L 62 40 L 74 60 L 86 40 L 98 60', { otwarta: true }],
  ['linia-romb', 'Linia z rombem', 'Linie ozdobne', 'linia separator ozdobnik', 'M 2 50 L 40 50 M 60 50 L 98 50 M 50 42 L 58 50 L 50 58 L 42 50 Z', { otwarta: true }],
  ['linia-petla', 'Ozdobnik z pętlą', 'Linie ozdobne', 'ozdobnik petla linia', 'M 5 50 C 20 50 25 30 40 35 C 55 40 45 60 30 55 C 20 50 35 30 50 50 C 65 70 75 50 95 50', { otwarta: true }],
  ['linia-kropki', 'Trzy kropki', 'Linie ozdobne', 'kropki separator', `${okrag(30, 50, 4)} ${okrag(50, 50, 4)} ${okrag(70, 50, 4)}`],
  // Ikony
  ['dom', 'Dom', 'Ikony', 'dom domek', 'M 50 8 L 95 48 L 82 48 L 82 92 L 60 92 L 60 65 L 40 65 L 40 92 L 18 92 L 18 48 L 5 48 Z'],
  ['lokalizacja', 'Pinezka', 'Ikony', 'pinezka lokalizacja mapa miejsce', `M 50 95 C 30 65 15 50 15 35 A 35 35 0 0 1 85 35 C 85 50 70 65 50 95 Z ${okrag(50, 35, 13, 0)}`, { otwor: true }],
  ['zegar', 'Zegar', 'Ikony', 'zegar czas godzina', `${okrag(50, 50, 45)} M 47 20 L 53 20 L 53 48 L 70 60 L 67 65 L 47 52 Z`, { otwor: true }],
  ['ptaszek', 'Ptaszek', 'Ikony', 'ptaszek check ok gotowe', 'M 10 55 L 22 43 L 40 61 L 80 21 L 92 33 L 40 85 Z'],
  ['krzyzyk', 'Krzyżyk', 'Ikony', 'krzyzyk x zamknij', 'M 20 10 L 50 40 L 80 10 L 90 20 L 60 50 L 90 80 L 80 90 L 50 60 L 20 90 L 10 80 L 40 50 L 10 20 Z'],
  ['koperta', 'Koperta', 'Ikony', 'koperta list mail poczta', 'M 5 20 L 95 20 L 95 80 L 5 80 Z M 9 24 L 50 54 L 91 24 Z', { otwor: true }],
  ['ksiazka', 'Książka', 'Ikony', 'ksiazka czytanie', 'M 50 25 C 40 17 25 15 8 16 L 8 84 C 25 83 40 85 50 92 C 60 85 75 83 92 84 L 92 16 C 75 15 60 17 50 25 Z'],
  ['nuta', 'Nuta', 'Ikony', 'nuta muzyka', 'M 40 18 L 85 8 L 85 66 A 12 10 0 1 1 73 57 L 73 26 L 52 31 L 52 76 A 12 10 0 1 1 40 67 Z'],
  ['kalendarz-ikona', 'Kalendarz', 'Ikony', 'kalendarz data', 'M 10 18 L 90 18 L 90 92 L 10 92 Z M 16 36 L 84 36 L 84 86 L 16 86 Z M 26 8 L 34 8 L 34 26 L 26 26 Z M 66 8 L 74 8 L 74 26 L 66 26 Z', { otwor: true }],
  ['telefon', 'Telefon', 'Ikony', 'telefon kontakt', 'M 28 6 C 22 6 18 10 18 18 C 18 55 45 82 82 82 C 90 82 94 78 94 72 L 94 62 L 74 56 L 66 66 C 52 60 40 48 34 34 L 44 26 L 38 6 Z'],
  ['koszyk', 'Koszyk', 'Ikony', 'koszyk zakupy sklep', `M 5 15 L 20 15 L 30 62 L 82 62 L 92 28 L 25 28 L 23 22 L 22 18 Z ${okrag(36, 78, 7)} ${okrag(76, 78, 7)}`],
  ['zarowka', 'Żarówka', 'Ikony', 'zarowka pomysl', 'M 50 5 A 30 30 0 0 1 68 59 L 66 72 L 34 72 L 32 59 A 30 30 0 0 1 50 5 Z M 36 78 L 64 78 L 64 85 L 36 85 Z M 40 89 L 60 89 L 58 95 L 42 95 Z'],
];

export const KSZTALTY = DEF.map(([id, nazwa, kategoria, slowa, d, opcje = {}]) => ({ id, nazwa, kategoria, slowa, d, otwarta: Boolean(opcje.otwarta), otwor: Boolean(opcje.otwor) }));
export const KATEGORIE = [...new Set(KSZTALTY.map((k) => k.kategoria))];

const bezOgonkow = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
export function szukajKsztaltow(zapytanie) {
  const slowa = bezOgonkow(zapytanie).split(/\s+/).filter(Boolean);
  if (!slowa.length) return KSZTALTY;
  return KSZTALTY.filter((k) => { const t = bezOgonkow(`${k.nazwa} ${k.kategoria} ${k.slowa}`); return slowa.every((s) => t.includes(s)); });
}

// ---------- Kolaże ----------

// Pola w jednostkach całości (0–1): [x, y, szerokość, wysokość].
export const KOLAZE = [
  { id: '2-pion', nazwa: '2 obok siebie', pola: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { id: '2-poziom', nazwa: '2 jeden pod drugim', pola: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { id: '3-kolumny', nazwa: '3 kolumny', pola: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
  { id: '3-duzy-lewo', nazwa: '3 – duże z lewej', pola: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]] },
  { id: '3-duzy-gora', nazwa: '3 – duże u góry', pola: [[0, 0, 1, 0.6], [0, 0.6, 0.5, 0.4], [0.5, 0.6, 0.5, 0.4]] },
  { id: '4-siatka', nazwa: '4 – siatka', pola: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: '4-duzy-lewo', nazwa: '4 – duże z lewej', pola: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 1 / 3], [0.6, 1 / 3, 0.4, 1 / 3], [0.6, 2 / 3, 0.4, 1 / 3]] },
  { id: '5-mozaika', nazwa: '5 – mozaika', pola: [[0, 0, 0.5, 0.6], [0.5, 0, 0.5, 0.4], [0.5, 0.4, 0.5, 0.6], [0, 0.6, 0.25, 0.4], [0.25, 0.6, 0.25, 0.4]] },
  { id: '5-duzy-gora', nazwa: '5 – duże u góry', pola: [[0, 0, 1, 0.55], [0, 0.55, 0.25, 0.45], [0.25, 0.55, 0.25, 0.45], [0.5, 0.55, 0.25, 0.45], [0.75, 0.55, 0.25, 0.45]] },
  { id: '6-siatka', nazwa: '6 – siatka 3 × 2', pola: [0, 1, 2, 3, 4, 5].map((i) => [(i % 3) / 3, Math.floor(i / 3) / 2, 1 / 3, 0.5]) },
  { id: '6-pion', nazwa: '6 – siatka 2 × 3', pola: [0, 1, 2, 3, 4, 5].map((i) => [(i % 2) / 2, Math.floor(i / 2) / 3, 0.5, 1 / 3]) },
  { id: '9-siatka', nazwa: '9 – siatka 3 × 3', pola: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => [(i % 3) / 3, Math.floor(i / 3) / 3, 1 / 3, 1 / 3]) },
];

export const ukladKolazu = (id) => KOLAZE.find((k) => k.id === id) || KOLAZE[0];

// Prostokąty pól w mm, względem lewego górnego rogu: [{ lewo, gora, szerokosc, wysokosc }].
export function polaKolazu(uklad, szerokosc, wysokosc, odstep = 2) {
  const e = 1e-6;
  return ukladKolazu(uklad).pola.map(([x, y, w, h]) => {
    const l = x * szerokosc + (x > e ? odstep / 2 : 0);
    const p = (x + w) * szerokosc - (x + w < 1 - e ? odstep / 2 : 0);
    const g = y * wysokosc + (y > e ? odstep / 2 : 0);
    const d = (y + h) * wysokosc - (y + h < 1 - e ? odstep / 2 : 0);
    return { lewo: r1(l), gora: r1(g), szerokosc: r1(Math.max(1, p - l)), wysokosc: r1(Math.max(1, d - g)) };
  });
}

// Podgląd układu jako SVG (kafelek w oknie wyboru).
export function svgKolazu(uklad) {
  const pola = polaKolazu(uklad, 60, 44, 2.4);
  return `<svg viewBox="0 0 60 44" aria-hidden="true">${pola.map((p) => `<rect x="${p.lewo}" y="${p.gora}" width="${p.szerokosc}" height="${p.wysokosc}" rx="1"/>`).join('')}</svg>`;
}

export const svgKsztaltu = (k) => `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${k.d}"${k.otwarta ? ' class="otwarta"' : ''}${k.otwor ? ' fill-rule="evenodd"' : ''}/></svg>`;
