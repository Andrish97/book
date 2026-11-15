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

// Wielokąt foremny o n bokach.
function wielokat(n, obrot = -Math.PI / 2) {
  return punkty(Array.from({ length: n }, (_, i) => [50 + 45 * Math.cos(obrot + (i * 2 * Math.PI) / n), 50 + 45 * Math.sin(obrot + (i * 2 * Math.PI) / n)]));
}

// Prostokąt z zaokrąglonymi rogami; kier 0 – w przeciwną stronę (otwór w ramce).
function zaokr(x, y, w, h, r, kier = 1) {
  const a = (dx, dy) => `A ${r} ${r} 0 0 ${kier} ${r1(dx)} ${r1(dy)}`;
  if (kier) return `M ${x + r} ${y} L ${x + w - r} ${y} ${a(x + w, y + r)} L ${x + w} ${y + h - r} ${a(x + w - r, y + h)} L ${x + r} ${y + h} ${a(x, y + h - r)} L ${x} ${y + r} ${a(x + r, y)} Z`;
  return `M ${x + r} ${y} ${a(x, y + r)} L ${x} ${y + h - r} ${a(x + r, y + h)} L ${x + w - r} ${y + h} ${a(x + w, y + h - r)} L ${x + w} ${y + r} ${a(x + w - r, y)} Z`;
}

// Kształt przesunięty i pomniejszony (środek cx, cy; skala s względem pola 100 × 100).
const przenies = (d, cx, cy, s) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${r1(cx + (Number(x) - 50) * s)} ${r1(cy + (Number(y) - 50) * s)}`);

// Kratka i kropki do notatek (#143): pole 100 × 100 co 10 jednostek – po wstawieniu (50 mm) co 5 mm.
function kratka() {
  let d = '';
  for (let i = 0; i <= 100; i += 10) d += `M ${i} 0 L ${i} 100 M 0 ${i} L 100 ${i} `;
  return d.trim();
}
function kropki() {
  let d = '';
  for (let y = 5; y < 100; y += 10) for (let x = 5; x < 100; x += 10) d += `${okrag(x, y, 0.6)} `;
  return d.trim();
}

// Znaczek pocztowy: ząbkowany brzeg z półkolistych wcięć.
function znaczek() {
  let d = 'M 10 10';
  for (let i = 0; i < 8; i += 1) d += ` L ${15 + i * 10} 10 A 5 5 0 0 0 ${20 + i * 10} 10`;
  d += ' L 90 10';
  for (let i = 0; i < 8; i += 1) d += ` L 90 ${15 + i * 10} A 5 5 0 0 0 90 ${20 + i * 10}`;
  d += ' L 90 90';
  for (let i = 0; i < 8; i += 1) d += ` L ${85 - i * 10} 90 A 5 5 0 0 0 ${80 - i * 10} 90`;
  d += ' L 10 90';
  for (let i = 0; i < 8; i += 1) d += ` L 10 ${85 - i * 10} A 5 5 0 0 0 10 ${80 - i * 10}`;
  return `${d} Z`;
}

function platek() {
  const ramiona = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i * Math.PI) / 3;
    const p = (r, da) => [50 + r * Math.cos(a + da), 50 + r * Math.sin(a + da)];
    return punkty([p(9, -0.45), p(45, -0.09), p(45, 0.09), p(9, 0.45)]);
  });
  return `${ramiona.join(' ')} ${okrag(50, 50, 9)}`;
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
  ['pieciokat', 'Pięciokąt', 'Figury', 'pieciokat', wielokat(5)],
  ['siedmiokat', 'Siedmiokąt', 'Figury', 'siedmiokat', wielokat(7)],
  ['prostokat-zaokr', 'Prostokąt zaokrąglony', 'Figury', 'prostokat zaokraglony karta', zaokr(5, 20, 90, 60, 12)],
  ['pigulka', 'Pigułka', 'Figury', 'pigulka kapsulka przycisk', zaokr(5, 30, 90, 40, 20)],
  ['klepsydra', 'Klepsydra', 'Figury', 'klepsydra czas', 'M 15 5 L 85 5 L 55 50 L 85 95 L 15 95 L 45 50 Z'],
  ['etap', 'Etap procesu', 'Figury', 'etap proces krok strzalka pieciokat', 'M 5 25 L 72 25 L 95 50 L 72 75 L 5 75 Z'],
  ['lezka', 'Łezka narożna', 'Figury', 'lezka naroznik lisc', 'M 50 5 L 95 5 L 95 50 A 45 45 0 1 1 50 5 Z'],
  ['luk-brama', 'Łuk', 'Figury', 'luk brama okno', 'M 10 95 L 10 50 A 40 40 0 0 1 90 50 L 90 95 Z'],
  // Gwiazdy i serca
  ['gwiazda4', 'Gwiazdka błysk', 'Gwiazdy i serca', 'gwiazdka blysk iskra', gwiazda(4, 0.28)],
  ['gwiazda7', 'Gwiazda siedmioramienna', 'Gwiazdy i serca', 'gwiazda', gwiazda(7, 0.55)],
  ['naklejka', 'Naklejka ząbkowana', 'Gwiazdy i serca', 'naklejka odznaka promocja cena', gwiazda(24, 0.9)],
  ['serce-ramka', 'Serce – ramka', 'Gwiazdy i serca', 'serce ramka milosc', 'M 50 90 C 20 70 5 52 5 33 C 5 18 17 8 30 8 C 40 8 47 14 50 22 C 53 14 60 8 70 8 C 83 8 95 18 95 33 C 95 52 80 70 50 90 Z M 50 76 C 72 60 83 48 83 34 C 83 25 77 19 70 19 C 61 19 55 26 50 37 C 45 26 39 19 30 19 C 23 19 17 25 17 34 C 17 48 28 60 50 76 Z', { otwor: true }],
  ['platek', 'Płatek śniegu', 'Gwiazdy i serca', 'platek snieg zima', platek()],
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
  ['strzalka-skos', 'Strzałka na skos', 'Strzałki', 'strzalka skos ukos', 'M 15 75 L 60 30 L 45 15 L 90 10 L 85 55 L 70 40 L 25 85 Z'],
  ['strzalka-zawrot', 'Strzałka – zawróć', 'Strzałki', 'strzalka zawroc powrot', 'M 90 92 L 90 45 C 90 25 75 12 55 12 L 40 12 L 40 2 L 10 22 L 40 42 L 40 32 L 55 32 C 63 32 70 38 70 46 L 70 92 Z'],
  ['strzalka-obieg', 'Strzałka w kółko', 'Strzałki', 'strzalka obieg cykl kolko', 'M 50 12 A 38 38 0 1 0 88 50 L 74 50 A 24 24 0 1 1 50 26 L 50 38 L 72 19 L 50 0 Z'],
  ['szewron-podwojny', 'Szewron podwójny', 'Strzałki', 'szewron podwojny dalej', 'M 5 15 L 30 15 L 60 50 L 30 85 L 5 85 L 35 50 Z M 40 15 L 65 15 L 95 50 L 65 85 L 40 85 L 70 50 Z'],
  ['wskaznik', 'Wskaźnik', 'Strzałki', 'wskaznik trojkat', 'M 15 5 L 90 50 L 15 95 Z'],
  ['strzalka-krzyz', 'Strzałki na cztery strony', 'Strzałki', 'strzalka krzyz kierunki', 'M 50 3 L 66 20 L 56 20 L 56 44 L 80 44 L 80 34 L 97 50 L 80 66 L 80 56 L 56 56 L 56 80 L 66 80 L 50 97 L 34 80 L 44 80 L 44 56 L 20 56 L 20 66 L 3 50 L 20 34 L 20 44 L 44 44 L 44 20 L 34 20 Z'],
  // Dymki
  ['dymek-lewo', 'Dymek z lewej', 'Dymki', 'dymek rozmowa komentarz', 'M 22 10 L 92 10 L 92 75 L 22 75 L 22 55 L 5 45 L 22 38 Z'],
  ['dymek-kolo', 'Dymek okrągły', 'Dymki', 'dymek kolo rozmowa', 'M 50 6 A 40 40 0 1 1 26 79 L 8 94 L 16 70 A 40 40 0 0 1 50 6 Z'],
  ['dymek-notatka', 'Dymek – podpis', 'Dymki', 'dymek notatka podpis prostokat', 'M 5 8 L 95 8 L 95 70 L 60 70 L 50 92 L 40 70 L 5 70 Z'],
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
  ['wstega-naroznik', 'Wstęga narożna', 'Wstęgi i banery', 'wstega naroznik rog nowosc', 'M 30 0 L 55 0 L 100 45 L 100 70 Z'],
  ['baner-zawiniety', 'Baner zawinięty', 'Wstęgi i banery', 'baner wstega tytul', 'M 15 25 L 85 25 L 85 65 L 15 65 Z M 15 35 L 3 35 L 9 50 L 3 65 L 15 65 Z M 85 35 L 97 35 L 91 50 L 97 65 L 85 65 Z'],
  ['odznaka-wstazki', 'Odznaka ze wstążkami', 'Wstęgi i banery', 'odznaka medal nagroda wstazka', `M 30 55 L 18 97 L 34 88 L 42 100 L 50 62 L 58 100 L 66 88 L 82 97 L 70 55 Z ${przenies(gwiazda(16, 0.85), 50, 36, 0.8)}`],
  // Ramki
  ['ramka-zaokr', 'Ramka zaokrąglona', 'Ramki', 'ramka zaokraglona', `${zaokr(5, 5, 90, 90, 14)} ${zaokr(14, 14, 72, 72, 8, 0)}`, { otwor: true }],
  ['ramka-owal', 'Ramka owalna', 'Ramki', 'ramka owal medalion portret', 'M 50 3 A 38 47 0 1 1 49.9 3 Z M 50 12 A 29 38 0 1 0 50.1 12 Z', { otwor: true }],
  ['ramka-narozniki', 'Narożniki', 'Ramki', 'ramka narozniki rogi zdjecie', 'M 5 5 L 30 5 L 30 12 L 12 12 L 12 30 L 5 30 Z M 95 5 L 95 30 L 88 30 L 88 12 L 70 12 L 70 5 Z M 95 95 L 70 95 L 70 88 L 88 88 L 88 70 L 95 70 Z M 5 95 L 5 70 L 12 70 L 12 88 L 30 88 L 30 95 Z'],
  ['ramka-zdjecie', 'Ramka jak odbitka', 'Ramki', 'ramka zdjecie odbitka fotografia', 'M 8 3 L 92 3 L 92 97 L 8 97 Z M 15 10 L 15 74 L 85 74 L 85 10 Z', { otwor: true }],
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
  ['linia-serce', 'Linia z sercem', 'Linie ozdobne', 'linia serce separator ozdobnik', 'M 2 50 L 38 50 M 62 50 L 98 50 M 50 60 C 44 55 40 51 40 47 C 40 44 42 42 45 42 C 47 42 49 43 50 45 C 51 43 53 42 55 42 C 58 42 60 44 60 47 C 60 51 56 55 50 60 Z', { otwarta: true }],
  ['linia-gwiazdki', 'Trzy gwiazdki', 'Linie ozdobne', 'gwiazdki separator ozdobnik', `${przenies(gwiazda(5, 0.42), 25, 50, 0.12)} ${przenies(gwiazda(5, 0.42), 50, 50, 0.16)} ${przenies(gwiazda(5, 0.42), 75, 50, 0.12)}`],
  ['linia-fala-podw', 'Fala podwójna', 'Linie ozdobne', 'fala podwojna linia', 'M 2 44 C 14 28 26 28 38 44 C 50 60 62 60 74 44 C 86 28 98 28 98 44 M 2 56 C 14 40 26 40 38 56 C 50 72 62 72 74 56 C 86 40 98 40 98 56', { otwarta: true }],
  ['linia-zawijas', 'Zawijas', 'Linie ozdobne', 'zawijas ornament vintage', 'M 5 50 C 25 50 30 35 42 38 C 52 41 48 54 40 52 M 95 50 C 75 50 70 65 58 62 C 48 59 52 46 60 48 M 42 38 C 46 46 54 54 58 62', { otwarta: true }],
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
  ['lupa', 'Lupa', 'Ikony', 'lupa szukaj', `${okrag(40, 40, 32)} ${okrag(40, 40, 22, 0)} M 60 66 L 66 60 L 95 89 L 89 95 Z`, { otwor: true }],
  ['prezent', 'Prezent', 'Ikony', 'prezent upominek urodziny swieta', 'M 8 32 L 92 32 L 92 50 L 8 50 Z M 14 54 L 86 54 L 86 95 L 14 95 Z M 50 30 C 38 8 18 12 26 28 Z M 50 30 C 62 8 82 12 74 28 Z'],
  ['samolot', 'Samolot', 'Ikony', 'samolot podroz wakacje lot', 'M 46 5 C 50 1 54 5 54 12 L 54 38 L 95 62 L 95 72 L 54 58 L 54 80 L 66 90 L 66 96 L 50 91 L 34 96 L 34 90 L 46 80 L 46 58 L 5 72 L 5 62 L 46 38 L 46 12 Z'],
  ['aparat', 'Aparat', 'Ikony', 'aparat zdjecie fotografia', `M 5 28 L 30 28 L 38 15 L 62 15 L 70 28 L 95 28 L 95 85 L 5 85 Z ${okrag(50, 55, 20, 0)} ${okrag(50, 55, 12)}`, { otwor: true }],
  ['kubek', 'Kubek', 'Ikony', 'kubek kawa herbata przerwa', 'M 12 25 L 72 25 L 68 88 L 16 88 Z M 72 35 A 15 15 0 1 1 70 68 L 71 58 A 6 6 0 1 0 72 44 Z'],
  ['drzewo', 'Drzewo', 'Ikony', 'drzewo choinka las natura', 'M 50 3 L 82 45 L 66 45 L 90 75 L 56 75 L 56 97 L 44 97 L 44 75 L 10 75 L 34 45 L 18 45 Z'],
  ['krzyz', 'Krzyż', 'Ikony', 'krzyz kosciol wiara religia', 'M 42 5 L 58 5 L 58 28 L 80 28 L 80 42 L 58 42 L 58 95 L 42 95 L 42 42 L 20 42 L 20 28 L 42 28 Z'],
  ['uwaga', 'Uwaga', 'Ikony', 'uwaga wykrzyknik ostrzezenie trojkat', 'M 50 5 L 97 92 L 3 92 Z M 45 35 L 55 35 L 53 65 L 47 65 Z M 45 72 L 55 72 L 55 82 L 45 82 Z', { otwor: true }],
  ['informacja', 'Informacja', 'Ikony', 'informacja info', `${okrag(50, 50, 45)} M 44 42 L 56 42 L 56 78 L 44 78 Z ${okrag(50, 28, 6, 0)}`, { otwor: true }],
  ['wifi', 'Wi-Fi', 'Ikony', 'wifi internet siec', 'M 5 38 A 64 64 0 0 1 95 38 L 86 47 A 52 52 0 0 0 14 47 Z M 22 55 A 40 40 0 0 1 78 55 L 69 64 A 28 28 0 0 0 31 64 Z M 50 70 A 9 9 0 1 1 49.9 70 Z'],
  // Etykiety i plakietki (#143)
  ['etykieta-zaokr', 'Etykieta zaokrąglona', 'Etykiety', 'etykieta naklejka napis', zaokr(3, 25, 94, 50, 25)],
  ['etykieta-scieta', 'Etykieta ze ściętymi rogami', 'Etykiety', 'etykieta scieta rogi tabliczka', 'M 15 20 L 85 20 L 97 32 L 97 68 L 85 80 L 15 80 L 3 68 L 3 32 Z'],
  ['etykieta-ozdobna', 'Etykieta ozdobna', 'Etykiety', 'etykieta sloik przetwory vintage', 'M 20 20 A 8 8 0 0 1 12 28 L 12 72 A 8 8 0 0 1 20 80 L 80 80 A 8 8 0 0 1 88 72 L 88 28 A 8 8 0 0 1 80 20 Z'],
  ['metka-dziurka', 'Metka z dziurką', 'Etykiety', 'metka zawieszka cena prezent', `M 30 20 L 95 20 L 95 80 L 30 80 L 5 50 Z ${okrag(24, 50, 5, 0)}`, { otwor: true }],
  ['plakietka', 'Plakietka okrągła', 'Etykiety', 'plakietka znaczek przypinka okragla', `${okrag(50, 50, 45)} ${okrag(50, 50, 38, 0)} ${okrag(50, 50, 34)}`, { otwor: true }],
  ['pieczatka', 'Pieczątka', 'Etykiety', 'pieczatka stempel', `${gwiazda(40, 0.93)} ${okrag(50, 50, 33, 0)}`, { otwor: true }],
  ['znaczek-pocztowy', 'Znaczek pocztowy', 'Etykiety', 'znaczek pocztowy poczta kartka', znaczek()],
  ['tabliczka', 'Tabliczka z zawieszką', 'Etykiety', 'tabliczka zawieszka drzwi napis', 'M 5 40 L 95 40 L 95 92 L 5 92 Z M 50 8 L 82 40 L 76 40 L 50 14 L 24 40 L 18 40 Z'],
  // Planer (#143): pola wyboru, kratka i kropki do notatek
  ['pole-wyboru', 'Pole wyboru', 'Planer', 'pole wyboru checkbox kwadrat zadanie lista', `${zaokr(10, 10, 80, 80, 10)} ${zaokr(20, 20, 60, 60, 4, 0)}`, { otwor: true }],
  ['pole-wyboru-okragle', 'Pole wyboru okrągłe', 'Planer', 'pole wyboru kolko checkbox nawyk', `${okrag(50, 50, 40)} ${okrag(50, 50, 30, 0)}`, { otwor: true }],
  ['pole-zaznaczone', 'Pole zaznaczone', 'Planer', 'pole wyboru zaznaczone zrobione checkbox', `${zaokr(10, 10, 80, 80, 10)} ${zaokr(20, 20, 60, 60, 4, 0)} M 26 50 L 34 42 L 45 53 L 70 28 L 78 36 L 45 69 Z`, { otwor: true }],
  ['kratka', 'Notatki w kratkę', 'Planer', 'kratka notatki siatka zeszyt', kratka(), { otwarta: true, siatka: true }],
  ['kropki', 'Notatki w kropki', 'Planer', 'kropki notatki bullet journal', kropki(), { siatka: true }],
];

export const KSZTALTY = DEF.map(([id, nazwa, kategoria, slowa, d, opcje = {}]) => ({ id, nazwa, kategoria, slowa, d, otwarta: Boolean(opcje.otwarta), otwor: Boolean(opcje.otwor), siatka: Boolean(opcje.siatka) }));
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

// ---------- Rodzaje linii (#143) ----------

// Wzór kresek linii (strokeDashArray, mm) dla rodzaju i grubości: kreski rosną razem z grubością.
export const RODZAJE_KRESEK = [['ciagla', 'ciągła'], ['przerywana', 'przerywana'], ['kropkowana', 'kropkowana'], ['kreska-kropka', 'kreska – kropka']];
export function wzorKresek(rodzaj, grubosc = 0.5) {
  const g = Math.max(0.1, grubosc);
  if (rodzaj === 'przerywana') return [r1(Math.max(1.5, g * 6)), r1(Math.max(1, g * 4))];
  if (rodzaj === 'kropkowana') return [0, r1(Math.max(0.8, g * 2.5))];
  if (rodzaj === 'kreska-kropka') return [r1(Math.max(2, g * 8)), r1(Math.max(0.8, g * 3)), 0, r1(Math.max(0.8, g * 3))];
  return null;
}
export function rodzajKresek(obj) {
  const k = obj?.strokeDashArray;
  if (!Array.isArray(k) || !k.length || k.every((x) => !x)) return 'ciagla';
  if (k.length >= 4) return 'kreska-kropka';
  return k[0] === 0 ? 'kropkowana' : 'przerywana';
}

export const svgKsztaltu = (k) => {
  const klasa = k.siatka ? (k.otwarta ? 'siatka' : 'kropki-siatki') : (k.otwarta ? 'otwarta' : '');
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${k.d}"${klasa ? ` class="${klasa}"` : ''}${k.otwor ? ' fill-rule="evenodd"' : ''}/></svg>`;
};
