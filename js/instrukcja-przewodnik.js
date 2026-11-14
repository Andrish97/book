// Rozdziały instrukcji pisane „krok po kroku” (decyzja #104): pierwsze kroki, przewodnik po panelu
// właściwości, dane na przykładach, AI dla początkujących (z gotowymi poleceniami do skopiowania),
// komiks do druku z AI i słowniczek. Wchodzą do listy ROZDZIALY w js/instrukcja.js.
//
// Pola rozdziału (oprócz tytul, wstep, obraz, podpis, punkty, rada – jak w js/instrukcja.js):
//   grupa     – nagłówek w spisie treści,
//   kroki     – lista numerowana „krok po kroku”,
//   sekcje    – [{ tytul, punkty?, kroki?, tekst? }] – podrozdziały z nagłówkiem,
//   ramki     – [{ rodzaj: 'wskazowka' | 'uwaga', tekst }],
//   prompty   – [{ tytul, opis, tekst }] – polecenia do skopiowania (przycisk „Kopiuj”),
//   zobacz    – tytuły powiązanych rozdziałów (linki na końcu).
// W treści link do rozdziału: <a data-rozdzial="Tytuł rozdziału">…</a>.

const L = (tytul, tekst = tytul) => `<a href="#" data-rozdzial="${tytul}">${tekst}</a>`;

export const PROMPT_PODLACZENIE = `Pomóż mi podłączyć Makietkę do Ciebie jako łącznik (serwer MCP), krok po kroku.

Co to jest Makietka: aplikacja w przeglądarce (https://makietka.app) do składania publikacji do druku – kalendarzy, planerów, notesów, zeszytów, komiksów. Ma strony, wzorce, style tekstu, tabele danych, serie powielanych stron, obrazy i eksport PDF.

Co wiem o łączniku Makietki:
- To zdalny serwer MCP (transport Streamable HTTP), bez logowania OAuth. Adres: https://api.makietka.app/mcp/<klucz>. Klucz można też podać nagłówkiem „Authorization: Bearer sdk_…” (wtedy adres bez klucza: https://api.makietka.app/mcp).
- Klucz tworzę sam w Makietce: Ustawienia konta → Dostęp dla AI → Zarządzaj… Wybieram: które projekty (albo pełny dostęp – wtedy AI może też tworzyć i usuwać projekty), czy AI tylko czyta, czy też zmienia, i ważność. Adres z kluczem widać tylko raz.
- Narzędzia łącznika: lista projektów, nowy projekt i usunięcie projektu (przy pełnym dostępie), przegląd projektu, czytanie i zmiana stron, elementów, wzorców, stylów, tabel danych i serii, wgrywanie obrazów (adres https, link z Dysku Google albo Dropboxa, kod SVG, małe pliki kawałkami), wstawianie obrazów na strony, link do wgrania zdjęć przez przeglądarkę, kontrola przed drukiem.
- Opis dla AI: https://makietka.app/ai/api.md, model danych projektu: https://makietka.app/ai/format-makietka.md.
- Dla Claude Desktop jest też rozszerzenie https://makietka.app/ai/mcp/makietka.mcpb – działa na komputerze i czyta pliki oraz foldery z dysku.
- Claude Code: claude mcp add --transport http makietka https://api.makietka.app/mcp/<klucz>

Twoje zadanie:
1. Ustal, w jakiej aplikacji teraz rozmawiamy (claude.ai w przeglądarce, aplikacja Claude na telefonie, Claude Desktop, Claude Code, ChatGPT, Cursor albo inna) i czy na moim planie da się w niej dodać własny łącznik MCP. Jeśli nie wiesz – zapytaj mnie.
2. Poprowadź mnie po kolei, co kliknąć, żeby dodać łącznik o nazwie „Makietka” z moim adresem. Nie proś mnie o wklejenie klucza do tej rozmowy – wkleję go sam w ustawieniach.
3. Jeśli ta aplikacja albo mój plan nie obsługuje łączników, powiedz to wprost i zaproponuj najprostszą drogę (inna aplikacja, Claude Desktop z rozszerzeniem, Claude Code).
4. Po podłączeniu sprawdź, czy widzisz narzędzie „projekty”, i pokaż mi listę moich projektów.
Pisz prosto, po polsku, jeden krok na raz i czekaj, aż powiem, że zrobione.`;

export const PROMPT_KOMIKS = `Korzystając z łącznika Makietka, przygotuj ze mną komiks do druku.

1. Najpierw zaproponuj plan: tytuł, liczbę stron (domyślnie 8 stron środka + okładka), na każdej stronie liczbę kadrów i co się w nich dzieje. Poczekaj, aż zatwierdzę.
2. Potem utwórz nowy projekt „Komiks – <tytuł>”: format A5 (148×210 mm), spad 3 mm, marginesy 8 mm. Środek w rozkładówkach, okładka jako osobna sekcja.
3. Na stronach ułóż kadry: prostokąty z czarnym obrysem 0,6 mm i odstępem 4 mm między kadrami, w obrębie marginesów. W kadrach dymki (elipsy albo prostokąty z zaokrągleniem, białe wypełnienie, czarny obrys) z tekstem 9 pt, wyśrodkowanym. Narrację umieść w prostokątnych ramkach u góry kadru.
4. Zrób styl tekstu „Dymek” i „Narracja”, żebym mógł je potem zmienić naraz.
5. Rysunków nie wymyślaj na siłę: jeśli nie możesz ich narysować, w każdym kadrze zostaw szary prostokąt z krótkim opisem sceny. Ja wgram rysunki – daj mi link do wgrania obrazów, a potem wstaw je w kadry z dopasowaniem „wypełnij”.
6. Dodaj numery stron we wzorcu (pole {nr}) na dole, po zewnętrznej stronie.
7. Na koniec uruchom kontrolę przed drukiem i powiedz, co poprawić.

Mój pomysł na komiks: <opisz tutaj bohaterów, historię i nastrój>`;

export const PROMPT_DANE = `Korzystając z łącznika Makietka, w projekcie „<nazwa projektu>”:
1. Przeczytaj opis formatu (narzędzie opis_formatu) i przegląd projektu.
2. Zrób tabelę danych „Dni 2027” z kolumnami: data, dzien, miesiac, dzien_tygodnia, swieto, kolor (kolor liczby: czarny w dni zwykłe, czerwony #c0392b w niedziele i święta).
3. Wypełnij ją dla całego roku 2027 (polskie święta państwowe i kościelne w kolumnie swieto).
4. Zrób stronę-wzór dnia: duża liczba {dzien} z kolorem z pola „kolor”, pod nią {dzien_tygodnia} i {miesiac}, a niżej {swieto}. Ustaw serię „Dni” z tą tabelą.
5. Pokaż mi, ile stron powstanie, i uruchom kontrolę przed drukiem.`;

export const ROZDZIALY_START = [
  {
    grupa: 'Na początek',
    tytul: 'Pierwsze kroki – pierwszy kalendarz',
    wstep: 'Najkrótsza droga od pustego konta do pliku PDF: kalendarz miesięczny z dniami wstawionymi z tabeli. Zajmie około 10 minut. Każdy krok ma swój rozdział, w którym znajdziesz szczegóły.',
    obraz: 'nowy-projekt.png',
    podpis: 'Okno nowego projektu: format, układ i marginesy.',
    kroki: [
      `Na liście projektów kliknij <b>Nowy projekt</b>, wpisz nazwę, wybierz format (np. A5) i układ <b>Rozkładówki</b>. ${L('Nowy projekt', 'Więcej o nowym projekcie')}.`,
      `W edytorze kliknij <b>Dane</b> na górnym pasku → <b>Nowa tabela</b>. Nazwij kolumny <code>dzien</code>, <code>dzien_tygodnia</code> i <code>swieto</code> i wpisz kilka wierszy – albo zaimportuj plik z Excela. ${L('Dane: tabele')}.`,
      `Zamknij okno. Wstaw <b>Tekst</b> (klawisz <kbd>T</kbd>) i wpisz w nim <code>{dzien}</code>. Drugi tekst: <code>{dzien_tygodnia}</code>. To <b>pola</b> – w ich miejsce wejdą dane. ${L('Pola w tekście')}.`,
      `Kliknij puste miejsce (nic nie zaznaczone) – panel po prawej pokazuje ustawienia strony. W <b>Seria</b> wybierz <b>+ Nowa seria…</b> i wskaż swoją tabelę. Strona powieli się dla każdego wiersza. ${L('Serie: powielanie stron')}.`,
      `Zaznacz tekst z <code>{dzien}</code>, rozwiń <b>Z danych</b> i w <b>Kolor z pola</b> wybierz kolumnę z kolorem – np. czerwone niedziele. ${L('Kolor i położenie z danych')}.`,
      'Kliknij <b>Podgląd</b> (oko na pasku), żeby zobaczyć wszystkie strony z prawdziwymi danymi.',
      `Na koniec <b>⋯ → Sprawdź przed drukiem</b>, a potem <b>⋯ → Eksport do PDF</b>. ${L('Eksport do PDF')}.`,
    ],
    ramki: [
      { rodzaj: 'wskazowka', tekst: 'Wszystko zapisuje się samo. Możesz zamknąć kartę w dowolnej chwili i wrócić później – na tym samym albo innym urządzeniu.' },
      { rodzaj: 'wskazowka', tekst: `Wolisz, żeby kalendarz zrobiło za Ciebie AI? Zobacz ${L('Praca z AI – krok po kroku')}.` },
    ],
  },
];

// Każdy przycisk i menu ekranu edytora – nazwy jak w index.html (title, etykiety menu).
export const ROZDZIAL_NARZEDZIA = {
  grupa: 'Edytor',
  tytul: 'Edytor – każde narzędzie i menu',
  wstep: 'Spis wszystkich przycisków ekranu edytora, od lewej do prawej i od góry do dołu. Najechanie myszą na przycisk pokazuje jego nazwę i skrót klawiszowy – te same nazwy są tutaj.',
  sekcje: [
    {
      tytul: 'Górny pasek',
      punkty: [
        '<b>← Projekty</b> – wraca do listy projektów. Niczego nie trzeba zapisywać: każda zmiana zapisuje się sama.',
        '<b>Nazwa projektu</b> – kliknij, żeby ją zmienić. Obok <b>stan zapisu</b>: „Zapisano”, „Zapisywanie…”, „Offline – zapisano na urządzeniu” (zmiany wyślą się same po powrocie internetu) albo błąd zapisu z przyczyną.',
        '<b>Cofnij</b> (<kbd>Ctrl+Z</kbd>) i <b>Ponów</b> (<kbd>Ctrl+Shift+Z</kbd>) – jedna historia dla całego projektu: cofa też zmiany stron, sekcji, wzorców i danych, nie tylko elementów na bieżącej stronie.',
        `<b>Wzorce</b> – okno wspólnych elementów stron (tła, stopki, numery). Otwarty do edycji wzorzec pokazuje u dołu pasek z przyciskiem <b>Gotowe</b>, który wraca do stron. Więcej: ${L('Wzorce')}.`,
        `<b>Dane</b> – tabele z danymi do pól i serii. Więcej: ${L('Dane: tabele')}.`,
        `<b>Podgląd</b> (<kbd>Shift+W</kbd>) – cały projekt z podstawionymi danymi i powielonymi stronami, bez edycji. Więcej: ${L('Podgląd')}.`,
        `<b>Format</b> (przycisk z rozmiarem strony, np. „A5”) – ustawienia bieżącej sekcji: format, orientacja, spad, marginesy, rozkładówki. Więcej: ${L('Sekcje')}.`,
        '<b>Pełny ekran</b> (cztery narożniki) – chowa paski przeglądarki; <kbd>Esc</kbd> wraca.',
        '<b>Instrukcja</b> (znak zapytania) – to okno.',
        '<b>⋯ Więcej</b> – menu opisane niżej.',
      ],
    },
    {
      tytul: 'Menu ⋯ (Więcej)',
      punkty: [
        `<b>Eksportuj do PDF…</b> – okno eksportu: zakres stron, spad, znaczniki cięcia, kolory do druku (CMYK). Więcej: ${L('Eksport do PDF')}.`,
        '<b>Pobierz bieżącą stronę jako PNG</b> – obrazek jednej strony, np. do pokazania komuś w wiadomości.',
        `<b>Sprawdź przed drukiem</b> – lista problemów w całym projekcie (tekst się nie mieści, obraz za słaby, brak danych). Więcej: ${L('Sprawdź przed drukiem')}.`,
        `<b>Obrazy projektu…</b> – wszystkie wgrane pliki obrazów: wgrywanie, nazwy, podmiana, usuwanie nieużywanych. Więcej: ${L('Obrazy projektu')}.`,
        `<b>Czcionki projektu…</b> – zestaw czcionek i własne pliki czcionek. Więcej: ${L('Czcionki')}.`,
        `<b>Współpraca…</b> – zaproszenia do wspólnej edycji. Więcej: ${L('Współpraca')}.`,
        '<b>Jasny / ciemny motyw</b> – wygląd aplikacji (strona projektu zawsze jest biała jak papier).',
        'Na wąskim telefonie w tym menu są też <b>Wzorce…</b>, <b>Dane…</b>, <b>Instrukcja</b> i <b>Pełny ekran</b> – na górnym pasku brakuje dla nich miejsca.',
      ],
    },
    {
      tytul: 'Pasek „Wstaw” nad stroną',
      punkty: [
        '<b>Tekst</b> (<kbd>T</kbd>) – ramka tekstu na środku widoku; od razu można pisać.',
        '<b>Prostokąt</b> (<kbd>R</kbd>), <b>Elipsa</b> (<kbd>E</kbd>) – kształty z wypełnieniem i obrysem. Zaokrąglone rogi ustawiasz w części <b>Kształt</b> panelu.',
        '<b>Wielokąt albo gwiazda</b> (<kbd>P</kbd>) – liczbę boków i gwiazdę ustawiasz w części <b>Kształt</b>. Na telefonie ten przycisk jest schowany.',
        '<b>Linia</b> (<kbd>L</kbd>) – odcinek; grubość, kreskowanie i zakończenia w części <b>Linia</b>.',
        '<b>Obraz</b> – pyta, skąd: <b>z urządzenia</b> (wybór pliku) albo <b>z obrazów projektu</b> (to, co już wgrane). Gdy projekt nie ma jeszcze obrazów, od razu otwiera wybór pliku. Obraz można też przeciągnąć z dysku albo wkleić <kbd>Ctrl+V</kbd>.',
        '<b>Rysowanie odręczne</b> (<kbd>B</kbd>) – przeciągaj po stronie jak ołówkiem (ciemna linia 0,6 mm, drżenie ręki jest wygładzane). Każde pociągnięcie to osobny element; kolor i grubość zmienisz potem w panelu. <kbd>Esc</kbd> albo ponowne kliknięcie przycisku kończy rysowanie.',
        '<b>Pióro</b> (<kbd>N</kbd>) – kształt z punktów: kliknięcie stawia punkt narożny, kliknięcie z przeciągnięciem – punkt gładki (łuk). Kliknięcie w pierwszy punkt zamyka kształt, <kbd>Enter</kbd> albo podwójne kliknięcie kończy kształt otwarty, <kbd>Backspace</kbd> cofa ostatni punkt, <kbd>Esc</kbd> porzuca zaczęty kształt.',
        '<b>Tabela</b> – okno z liczbą <b>wierszy</b> i <b>kolumn</b>, <b>najmniejszą wysokością wiersza</b> i przełącznikiem <b>Pierwszy wiersz to nagłówek</b>. Tabela jest jednym elementem; podwójne kliknięcie komórki zaczyna pisanie.',
      ],
    },
    {
      tytul: 'Prawy dolny róg: linie, siatka, powiększenie',
      punkty: [
        '<b>Linie pomocnicze</b> (<kbd>W</kbd>) – pokazuje albo chowa marginesy, spad, grzbiet i prowadnice. Nie wpływa na wydruk – tych linii nigdy nie ma w PDF.',
        '<b>Siatka, przyciąganie, linijki</b> – menu z przełącznikami: <b>Siatka</b> (<kbd>Ctrl+\'</kbd>), <b>Przyciągaj do siatki</b> (<kbd>Ctrl+Shift+\'</kbd>), <b>Krok siatki</b> w mm, <b>Przyciągaj do elementów i pokazuj odległości</b>, <b>Linijki</b> (<kbd>Shift+R</kbd>), <b>Zablokuj prowadnice</b>, <b>Usuń prowadnice z tej strony</b> oraz <b>W rozkładówkach pokazuj jedną stronę</b>.',
        `Prowadnicę wyciągasz z linijki; przeciągnięta poza stronę znika. Przytrzymany <kbd>Ctrl</kbd> na chwilę wyłącza przyciąganie, przytrzymany <kbd>Alt</kbd> pokazuje odległości zaznaczonego elementu. Więcej: ${L('Siatka, linijki i prowadnice')}, ${L('Odległości i równe odstępy')}.`,
        '<b>− / + i procent</b> – pomniejsz, powiększ; kliknięcie w procent dopasowuje stronę do okna (<kbd>Ctrl+0</kbd>). <kbd>Ctrl</kbd> + kółko myszy powiększa w miejscu kursora, spacja + przeciąganie przesuwa widok.',
      ],
    },
    {
      tytul: 'Lewy panel: strony, sekcje, wzorce',
      punkty: [
        '<b>+ Strona</b> dodaje stronę zaraz za bieżącą (w tej samej sekcji), <b>+ Sekcja</b> – nową sekcję z własnym formatem i marginesami.',
        'Kliknięcie miniatury przechodzi na stronę. Miniatury przeciąga się, żeby zmienić kolejność.',
        '<b>⋯ na miniaturze strony</b>: <b>Zmień nazwę</b>, <b>Duplikuj</b>, <b>Przesuń wyżej</b>, <b>Przesuń niżej</b>, <b>Usuń stronę</b>.',
        '<b>⋯ przy nagłówku sekcji</b>: <b>Ustawienia sekcji</b>, <b>Dodaj stronę do sekcji</b>, <b>Przesuń sekcję wyżej / niżej</b>, <b>Usuń sekcję</b>.',
        '<b>⋯ przy wzorcu</b> (w oknie Wzorce): <b>Zmień nazwę</b>, <b>Duplikuj</b>, <b>Przesuń wyżej</b> (wzorzec wyżej na liście leży niżej na stronie), <b>Przesuń niżej</b>, <b>Usuń wzorzec</b>.',
        'Strona powielana serią ma na miniaturze znaczek <b>×N</b> – tyle razy wyjdzie w wydruku (najechanie pokazuje nazwę serii). <b>×0</b> znaczy, że wszystkie jej wiersze są pomijane.',
      ],
    },
    {
      tytul: 'Prawy panel: Właściwości, Warstwy, Ostrzeżenia',
      punkty: [
        `Przełącznik <b>Właściwości / Warstwy</b> u góry panelu. <b>Właściwości</b> – ustawienia zaznaczenia (bez zaznaczenia – ustawienia strony); każda część opisana jest w rozdziale ${L('Panel właściwości – przewodnik')}. <b>Warstwy</b> – lista elementów strony od wierzchu do spodu: ${L('Warstwy')}.`,
        'Przy nazwie zaznaczonego elementu trzy przyciski: <b>Kopiuj do schowka</b> (<kbd>Ctrl+C</kbd> – wkleisz na tej lub innej stronie), <b>Duplikuj</b> (<kbd>Ctrl+D</kbd>) i <b>Usuń</b> (<kbd>Delete</kbd>).',
        '<b>Ostrzeżenia</b> na dole panelu: licznik i lista elementów, które wychodzą w margines albo poza spad, nie mieszczą tekstu itp. Kliknięcie pozycji zaznacza element. <b>Wycisz</b> – „to celowe”, ostrzeżenie dla tego elementu znika (cofniesz to w części <b>Inne</b> elementu). Nagłówek zwija listę.',
      ],
    },
    {
      tytul: 'Na stronie – myszą i palcem',
      punkty: [
        'Kliknięcie zaznacza element, <kbd>Shift</kbd>+kliknięcie dokłada kolejny, przeciągnięcie po pustym miejscu zaznacza ramką.',
        'Podwójne kliknięcie: w tekście – pisanie, w grupie – wejście do grupy, w komórce tabeli – pisanie w komórce, w kształcie z pióra – edycja punktów, w obrazie – kadrowanie.',
        '<kbd>Shift</kbd> przy przeciąganiu – tylko w poziomie albo pionie (przy obracaniu co 15°). <kbd>Alt</kbd> przy przeciąganiu – przeciągasz kopię.',
        `Element ze wzorca nie da się zaznaczyć na zwykłej stronie – edytujesz go we wzorcu. Telefon i tablet: ${L('Tablet, telefon i instalacja')}.`,
      ],
    },
  ],
  ramki: [
    { rodzaj: 'wskazowka', tekst: `Nie pamiętasz skrótu? <kbd>?</kbd> albo <kbd>F1</kbd> pokazuje listę wszystkich – ta sama lista jest w rozdziale ${L('Skróty klawiszowe')}.` },
  ],
  zobacz: ['Edytor – przegląd', 'Panel właściwości – przewodnik', 'Skróty klawiszowe'],
};

export const ROZDZIAL_PANEL = {
  grupa: 'Edytor',
  tytul: 'Panel właściwości – przewodnik',
  wstep: 'Panel po prawej (na telefonie: przycisk <b>Właściwości</b> u dołu) pokazuje ustawienia tego, co jest zaznaczone. Części panelu zależą od rodzaju elementu. Tytuł części zwija ją i rozwija – zwinięte zostają zwinięte przy kolejnych elementach. Niżej każda część po kolei: co robi i kiedy jej użyć.',
  obraz: 'wlasciwosci.png',
  podpis: 'Panel właściwości zaznaczonego tekstu.',
  sekcje: [
    {
      tytul: 'Nic nie zaznaczone – ustawienia strony',
      punkty: [
        '<b>Strona</b>: nazwa strony, sekcja, do której należy, i wzorce (z sekcji albo wybrane ręcznie).',
        `<b>Seria</b>: czy strona powiela się z tabeli. ${L('Serie: powielanie stron')}.`,
        '<b>Tło</b>: kolor tła tej strony (gdy różni się od tła z wzorców).',
        '<b>Linie na stronie</b>: siatka, przyciąganie, linijki, podział rozkładówki w podglądzie.',
        `<b>Prowadnice</b>: dodawanie prowadnicy liczbą (mm) i usuwanie prowadnic z tej strony. ${L('Siatka, linijki i prowadnice')}.`,
      ],
    },
    {
      tytul: 'Każdy element – części wspólne',
      punkty: [
        '<b>Położenie i rozmiar (mm)</b>: X, Y, szerokość, wysokość i obrót – wpisujesz liczby w mm (obrót w stopniach). Kłódka łączy szerokość z wysokością (zachowuje proporcje). Gdy zaznaczonych jest kilka elementów, liczby dotyczą ich ramki razem.',
        '<b>Zaznaczenie</b> (kilka elementów): wyrównaj do lewej, środka, prawej, góry, dołu; <b>Rozłóż równo</b> w poziomie i pionie; <b>Zgrupuj</b>. Wyrównanie do strony albo do marginesów – gdy zaznaczony jest jeden element.',
        '<b>Kolejność</b>: na wierzch, wyżej, niżej, na spód. To samo robi panel <b>Warstwy</b> przeciąganiem.',
        '<b>Cień</b>: <b>Cień pod elementem</b>, kolor, rozmycie, przesunięcie. Uwaga: w PDF element z cieniem zapisuje się jako obraz.',
        '<b>Inne</b>: <b>Krycie</b> (przezroczystość w %), <b>Zablokuj położenie i rozmiar</b> (element nie da się przypadkiem przesunąć – zaznaczasz go dalej, żeby zmienić kolor), <b>Wycisz ostrzeżenia dla tego obiektu</b> (np. tło celowo wychodzące poza spad), nazwa elementu (widoczna w panelu Warstwy).',
        `<b>Z danych</b>: kolor, przesunięcie, rozmiar, obrót i widoczność z kolumny tabeli. ${L('Kolor i położenie z danych')}.`,
      ],
    },
    {
      tytul: 'Tekst',
      punkty: [
        '<b>Treść</b>: <b>Wstaw pole</b> – lista kolumn tabeli tej strony i pól dokumentu. Przełącznik <b>Klamry { } to zwykły tekst, nie pola</b> pojawia się, gdy w tekście są klamry.',
        '<b>Styl</b>: styl tekstu projektu (np. „Tytuł strony”). Zmiana stylu zmienia wszystkie teksty, które go używają. <b>Nowy styl</b> zapisuje wygląd tego tekstu jako nowy styl projektu.',
        '<b>Czcionka</b>, <b>Rozmiar</b> (w pt), <b>Kolor</b>, pogrubienie, kursywa, podkreślenie, przekreślenie.',
        '<b>Wyrównanie</b>: do lewej, do środka, do prawej, <b>Wyjustuj</b>.',
        '<b>Interlinia</b> (odstęp między wierszami, 1 = pojedyncza) i <b>Odstęp liter</b> (rozstrzelenie, ujemny ściska).',
        '<b>Wielkość liter</b>: <b>WSZYSTKIE WIELKIE – tylko wygląd, treść zostaje</b> (dane z tabeli wejdą wielkimi literami, w tabeli zostają zwykłe).',
        '<b>Lista</b>: wypunktowanie albo numerowanie; kolejne ramki łańcucha liczą numery dalej.',
        'Zaznaczony fragment w trakcie pisania: zmiany dotyczą tylko jego (panel mówi „Zmieniasz tylko zaznaczony fragment tekstu”).',
        '<b>Ramka tekstu</b>: <b>Stała wysokość ramki</b>, tekst w pionie (góra, środek, dół), <b>Zmniejszaj tekst, gdy się nie mieści</b> z najmniejszym rozmiarem. Użyj przy danych o różnej długości – układ strony się nie rozjedzie.',
        `<b>Przelewanie tekstu</b>: kolumny w jednej ramce i łańcuch ramek (tekst przechodzi do następnej ramki, także na innej stronie). ${L('Kolumny i przelewanie tekstu')}.`,
      ],
    },
    {
      tytul: 'Kształty: prostokąt, elipsa, wielokąt, gwiazda, pióro',
      punkty: [
        '<b>Kształt</b>: <b>Zaokrąglenie</b> narożników prostokąta (mm); dla wielokąta <b>Liczba boków</b>, przełącznik <b>Gwiazda</b> i głębokość ramion.',
        '<b>Wypełnienie i obrys</b> – <b>Wypełnienie</b>: brak, <b>Jeden kolor</b>, <b>Przejście liniowe</b> (kierunek: poziomo, pionowo, po skosie albo <b>Kąt</b>) albo <b>Przejście kołowe</b> (od środka). <b>Dodaj kolor</b> dokłada kolejny punkt przejścia (przejście wielokolorowe); kliknięcie punktu na pasku pozwala zmienić jego kolor i położenie, <b>Usuń ten kolor z przejścia</b> go usuwa.',
        '<b>Obrys</b>: kolor i <b>Grubość obrysu</b> (mm). Grubość nie zmienia się przy skalowaniu kształtu.',
        '<b>Kształt z punktów</b> / <b>Edycja punktów</b>: kształty z pióra i rysunki – <b>Edytuj punkty</b> (albo dwuklik) pokazuje punkty; przeciągasz je, a uchwyty łuków zmieniają krzywizny. Enter albo Esc kończy.',
      ],
    },
    {
      tytul: 'Linia',
      punkty: ['<b>Linia</b>: kolor, <b>Grubość</b>, rodzaj (ciągła, przerywana, kropkowana) i zakończenia. Z <kbd>Shift</kbd> rysujesz linię poziomą, pionową albo pod kątem 45°.'],
    },
    {
      tytul: 'Obraz',
      punkty: [
        '<b>Podmień zdjęcie</b>: nowy plik z urządzenia albo z obrazów projektu – w tym samym miejscu i ramce. <b>Obrazy projektu…</b> otwiera okno wszystkich obrazów.',
        '<b>Kadrowanie</b>: <b>Kadruj przeciąganiem</b> (albo dwuklik) – przesuwasz zdjęcie w ramce i zmieniasz jej brzegi. <b>Przycięcie (% oryginału)</b> – to samo liczbami <b>Z góry / Z dołu / Z lewej / Z prawej</b> (także dla zablokowanego obrazu).',
        '<b>Obrys i odbicie</b>: ramka wokół zdjęcia i <b>Odbij lustrzanie w poziomie</b>.',
        `<b>Obraz z danych</b>: <b>Kolumna z nazwą pliku</b> – na każdej powielonej stronie inny obraz; <b>Podmieniony obraz</b> – zmieść albo wypełnij ramkę; <b>Zostaje część zdjęcia</b> i <b>Kadr z kolumny</b>. ${L('Ramka tekstu i obrazy z danych')}.`,
        '<b>Rysunek SVG</b> → <b>Rozłóż rysunek na elementy</b>: rysunek SVG zamienia się w grupę zwykłych kształtów i napisów (opis niżej, w części „Rysunki SVG”).',
      ],
    },
    {
      tytul: 'Rysunki SVG – co robi „Rozłóż rysunek na elementy”',
      punkty: [
        'Wstawiony plik SVG to <b>obraz</b>: wygląda wiernie, ale nie zmienisz w nim kolorów ani napisów.',
        '<b>Rozłóż rysunek na elementy</b> <b>nie zmienia i nie usuwa pliku</b>. Na stronie, w miejscu obrazu, powstaje <b>nowa grupa</b> kształtów i napisów – kopia rysunku, którą edytujesz jak zwykłe elementy (rozgrupuj, zmień kolor, popraw tekst, przesuń punkty).',
        'Sam plik SVG zostaje w <b>⋯ → Obrazy projektu</b> (jako nieużywany, jeśli nie stoi już nigdzie indziej) – możesz go wstawić drugi raz albo usunąć przyciskiem <b>Usuń nieużywane</b>. <kbd>Ctrl</kbd>+<kbd>Z</kbd> od razu przywraca obraz w miejscu grupy.',
        'Rzeczy, których edytor nie ma (filtry, maski, wzory), przy rozkładaniu znikają – wtedy zostaw rysunek jako obraz.',
      ],
    },
    {
      tytul: 'Tabela (element na stronie)',
      punkty: [
        '<b>Tabela</b>: liczba wierszy i kolumn, <b>Pierwszy wiersz to nagłówek</b> (inny wygląd i powtarzanie przy przelewaniu).',
        '<b>Wysokości wierszy (mm)</b> i <b>Szerokości kolumn (mm)</b> – liczby albo przeciąganie linii między komórkami.',
        '<b>Linie tabeli</b>: <b>Które linie</b> (wszystkie, tylko poziome, ramka…), kolor i grubość. <b>Tło wierszy</b>: kolor i co drugi wiersz (pasy).',
        '<b>Tekst w komórkach</b>: czcionka, rozmiar, wyrównanie, odstęp od brzegu komórki. Zaznaczona komórka ma własne <b>Linie tej komórki</b> i może się łączyć z sąsiednimi.',
        `Dwuklik komórki zaczyna pisanie; <kbd>Tab</kbd> przechodzi dalej. W komórce działają pola z danych. ${L('Tabela')}.`,
      ],
    },
    {
      tytul: 'Grupa',
      punkty: [
        '<b>Element grupy</b>: dwuklik wchodzi do grupy – zaznaczasz i zmieniasz jeden element, a grupa zostaje. Esc wychodzi.',
        'Grupa ma wspólne położenie, obrót, cień i kolejność; <b>Rozgrupuj</b> rozdziela ją na elementy.',
      ],
    },
  ],
  ramki: [
        { rodzaj: 'uwaga', tekst: 'Element zablokowany nie przesuwa się myszą ani strzałkami, ale nadal da się zmienić jego kolor, tekst i inne właściwości.' },
  ],
  zobacz: ['Wstawianie elementów', 'Tekst i style', 'Położenie, wyrównanie, schowek', 'Warstwy'],
};

export const ROZDZIAL_DANE_PRZYKLADY = {
  grupa: 'Dane i serie',
  tytul: 'Dane w praktyce – przykłady krok po kroku',
  wstep: 'Pięć gotowych przepisów – od prostego kalendarza po dziennik na cały rok. Każdy pokazuje, jakie kolumny założyć w tabeli i co ustawić na stronie. Nazwy kolumn możesz zmienić; ważne, żeby pole na stronie miało tę samą nazwę co kolumna.',
  obraz: 'dane.png',
  podpis: 'Okno Dane: tabela, której wiersze staną się stronami.',
  sekcje: [
    {
      tytul: '1. Kalendarz: dzień tygodnia i święta w innym kolorze',
      tekst: 'Tabela <b>Dni</b> – kolumny: <code>dzien</code> (1–31), <code>miesiac</code> (STYCZNIA…), <code>dzien_tygodnia</code>, <code>swieto</code> (pusta albo nazwa święta), <code>kolor</code> (<code>#000000</code> w dni zwykłe, <code>#c0392b</code> w niedziele i święta).',
      kroki: [
        'Na stronie wstaw trzy teksty: <code>{dzien}</code> (duży), <code>{dzien_tygodnia}</code> i <code>{miesiac}</code>.',
        'Zaznacz <code>{dzien}</code> → <b>Z danych</b> → <b>Kolor z pola</b>: <code>kolor</code>. W edytorze tekst ma kolor wzoru, w podglądzie – kolor z tabeli.',
        'Wstaw mały tekst <code>{swieto}</code> i ustaw <b>Pokaż element</b> → <b>gdy pole nie jest puste</b> → <code>swieto</code>. Możesz też dodać gwiazdkę (wielokąt z przełącznikiem Gwiazda) z tym samym ustawieniem.',
        'Strona → <b>Seria</b> → <b>+ Nowa seria…</b> → tabela <b>Dni</b>. Gotowe: 365 stron z jednej.',
      ],
    },
    {
      tytul: '2. Dziennik na cały rok (tak jest zrobiony „Dziennik biblijny 2027”)',
      tekst: 'Prawdziwy przykład: dziennik w rozkładówkach A5, jedna strona na dzień, osobny wzór dla lewej i prawej strony. Tabela <b>Dni</b> ma kolumny: <code>data</code>, <code>typ</code> (<code>pd</code> – dzień powszedni, <code>so</code>, <code>nd</code>, <code>quiz</code> – strona quizu po niedzieli), <code>tydz</code> (numer tygodnia), <code>tydzien</code> (PIĄTEK…), <code>dzien</code>, <code>miesiac</code>, <code>tlo_daty</code>, <code>kolor_daty</code>, <code>kolor_miesiaca</code>, <code>weekend</code>, <code>przes_planu</code>, <code>przes_3cz</code>.',
      kroki: [
        '<b>Początek roku w środku bloku</b>: rok 2027 zaczyna się w piątek, więc tabela zaczyna się od czterech wierszy <code>[pomiń]</code> – zajmują miejsca w bloku, ale ich strony nie powstają (przycisk <b>Wiersz pomijany</b> w oknie Dane).',
        '<b>Kolory z danych</b>: prostokąt pod datą ma <b>Kolor z pola</b> <code>tlo_daty</code> (szary w sobotę, ciemny w niedzielę, pusty w dni powszednie – wtedy zostaje kolor wzoru), liczba dnia – <code>kolor_daty</code> (biała na ciemnym tle niedzieli), nazwa miesiąca – <code>kolor_miesiaca</code>.',
        '<b>Położenie z danych</b>: w weekend na stronie jest mniej miejsca na plan czytania, więc blok planu ma <b>Przesunięcie w pionie z pola</b> <code>przes_planu</code> → <b>Wartość pola to</b> → <b>przesunięcie w mm</b> (np. <code>8,6</code>; w dni powszednie <code>0</code>).',
        '<b>Różne strony z jednej tabeli</b>: elementy strony quizu mają <b>Pokaż element</b> → <b>równa się</b> → <code>typ</code> = <code>quiz</code>, a elementy zwykłego dnia – <b>gdy pole nie jest puste</b> → <code>tydzien</code>.',
        '<b>Dodatkowe tabele w serii</b>: wersety dnia, plan chronologiczny i plan „trzy czytania” są w osobnych tabelach (365 wierszy) i przechodzą do następnego wiersza <b>gdy zmieni się kolumna</b> <code>data</code>; quiz (53 wiersze) – gdy zmieni się <code>tydz</code>. Pole wpisujesz z nazwą tabeli, np. <code>{Wersety dnia.werset}</code>.',
        '<b>Nagłówki stałych stron</b> (dodatki, plany, wstęp) też idą z małych tabel – po jednym wierszu na stronę – dzięki czemu wszystkie odnośniki poprawia się w jednym oknie.',
      ],
    },
    {
      tytul: '3. Planer z obrazkiem miesiąca',
      tekst: 'Tabela <b>Miesiące</b> – 12 wierszy, kolumny: <code>miesiac</code>, <code>obraz</code> (np. <code>styczen.jpg</code>), <code>kadr</code> (np. <code>góra</code>), <code>cytat</code>.',
      kroki: [
        'Wgraj zdjęcia w <b>⋯ → Obrazy projektu → Wgraj obrazy…</b> (można ZIP-em). Zaznacz je i <b>Kopiuj nazwy</b> – wklej do kolumny <code>obraz</code>.',
        'Na stronie wstaw dowolny obraz jako wzór – wyznacza miejsce i rozmiar.',
        'Zaznacz go → <b>Obraz z danych</b> → <b>Kolumna z nazwą pliku</b>: <code>obraz</code>, <b>Podmieniony obraz</b>: <b>wypełnia ramkę</b>, <b>Kadr z kolumny</b>: <code>kadr</code>.',
        'Seria z tabelą <b>Miesiące</b> – 12 stron. Strona z siatką dni może być w tym samym bloku (blok 2 stron, „jeden wiersz na cały blok”).',
      ],
    },
    {
      tytul: '4. Zakładki na brzegu, wskazówka i słupki – położenie, rozmiar i obrót z danych',
      kroki: [
        '<b>Zakładki miesięcy</b>: prostokąt przy brzegu → <b>Przesunięcie w pionie z pola</b> <code>{egzemplarz}</code> → <b>numer pozycji</b>, krok 15 mm, <b>od nowa co</b> 12. Kolor z kolumny tabeli.',
        '<b>Wskazówka zegara / strzałka</b>: kolumna <code>kat</code> (stopnie) → <b>Obrót z pola (stopnie)</b> – element obraca się wokół środka o kąt z tabeli (dodawany do obrotu wzoru).',
        '<b>Słupek wykresu</b>: prostokąt → <b>Wysokość z pola</b> (procent wzoru albo mm), <b>Przy zmianie rozmiaru na miejscu zostaje</b>: dół – słupek rośnie w górę.',
      ],
    },
    {
      tytul: '5. Etykiety, wizytówki, zaproszenia',
      tekst: 'Każdy wiersz tabeli (imię, nazwisko, firma) to jedna strona – seria z tabelą gości. Kilka etykiet <b>na jednej kartce</b>: ustaw serię <b>jeden wiersz na cały blok</b> i nazwij kolumny dla kolejnych etykiet <code>e1_imie</code>, <code>e2_imie</code>… albo zrób małe strony (format etykiety) i złóż je na arkusz w drukarni.',
    },
    {
      tytul: 'Pola dokumentu, numeracja i braki danych',
      punkty: [
        `<code>{nr}</code>, <code>{liczba_stron}</code>, <code>{sekcja}</code>, <code>{data}</code>, <code>{egzemplarz}</code> i inne działają bez tabeli – pełna lista w ${L('Pola w tekście')}.`,
        `Numeracja ustawiana jest w sekcji (od której liczby, cyframi rzymskimi, bez numeru). ${L('Sekcje')}.`,
        `Brakujące dane (pusta komórka, za krótka tabela dodatkowa, nieznane pole) pokazuje lista <b>Ostrzeżenia</b> i ${L('Sprawdź przed drukiem')}.`,
      ],
    },
  ],
  ramki: [
    { rodzaj: 'wskazowka', tekst: 'W edytorze widzisz wzór (pola w klamrach, kolory wzoru, położenie pozycji 1). Prawdziwe strony – w <b>Podglądzie</b> i na miniaturach.' },
    { rodzaj: 'uwaga', tekst: 'Liczby z przecinkiem wpisuj tak, jak w arkuszu (<code>8,6</code> albo <code>8.6</code> – oba działają). Kolory jako <code>#rrggbb</code>, <code>rrggbb</code> albo nazwa po angielsku.' },
    { rodzaj: 'wskazowka', tekst: `Długą tabelę (np. 365 dni ze świętami) może przygotować AI – gotowe polecenie jest w ${L('Praca z AI – krok po kroku')}.` },
  ],
  prompty: [{ tytul: 'Polecenie dla AI: kalendarz dni z tabelą', opis: 'Skopiuj, podmień nazwę projektu i wklej do rozmowy z AI, które ma podłączony łącznik Makietki.', tekst: PROMPT_DANE }],
  zobacz: ['Dane: tabele', 'Pola w tekście', 'Serie: powielanie stron', 'Kolor i położenie z danych', 'Ramka tekstu i obrazy z danych'],
};

export const ROZDZIAL_AI_START = {
  grupa: 'AI i współpraca',
  tytul: 'Praca z AI – krok po kroku',
  wstep: 'Asystent AI (Claude, ChatGPT i inne) może pracować w Makietce razem z Tobą: tworzyć strony, wypełniać tabele, poprawiać teksty, wstawiać obrazy. Łączy się z Makietką przez <b>łącznik</b> – adres z Twoim kluczem, który dodajesz w ustawieniach AI. Nie trzeba niczego instalować ani programować.',
  obraz: 'dostep-ai.png',
  podpis: 'Ustawienia konta → Dostęp dla AI: klucz z wybranymi projektami albo z pełnym dostępem.',
  sekcje: [
    {
      tytul: 'Najprościej: niech AI samo Cię poprowadzi',
      tekst: 'Skopiuj polecenie <b>„Podłącz Makietkę”</b> (niżej, przycisk <b>Kopiuj</b>) i wklej je do rozmowy ze swoim AI. Polecenie opisuje, czym jest Makietka i jak działa łącznik, a AI rozpozna, w jakiej aplikacji jesteś, i powie, co kliknąć. Klucza nie wklejaj do rozmowy – wpiszesz go sam w ustawieniach.',
    },
    {
      tytul: 'Krok 1. Klucz w Makietce',
      kroki: [
        'Menu konta (kółko z inicjałem) → <b>Ustawienia konta</b> → <b>Dostęp dla AI</b> → <b>Zarządzaj…</b>',
        'Wpisz, dla kogo jest klucz (np. „Claude – komiks”).',
        'Wybierz zakres: <b>wybrane projekty</b> (zaznacz je na liście) albo <b>pełny dostęp</b> – wtedy AI może też tworzyć nowe projekty i usuwać Twoje (zawsze z potwierdzeniem nazwą).',
        'Wybierz, czy AI <b>tylko czyta</b>, czy <b>czyta i zmienia</b>, i ważność klucza.',
        '<b>Utwórz klucz</b> i skopiuj <b>adres łącznika</b> (<code>https://api.makietka.app/mcp/sdk_…</code>). Widać go tylko raz – zgubiony klucz odbierasz i tworzysz nowy.',
      ],
    },
    {
      tytul: 'Krok 2. Łącznik w aplikacji AI',
      punkty: [
        '<b>Claude</b> (claude.ai, aplikacja na komputer i telefon): <b>Ustawienia → Łączniki → Dodaj własny łącznik</b>, nazwa „Makietka”, wklej adres, bez OAuth. W rozmowie włącz go w menu narzędzi pod polem wiadomości. Łączniki są w płatnych planach Claude.',
        '<b>Claude Desktop – rozszerzenie</b>: pobierz <code>https://makietka.app/ai/mcp/makietka.mcpb</code>, otwórz plik dwuklikiem i wklej klucz. Rozszerzenie dodatkowo czyta pliki i foldery z Twojego dysku (zdjęcia dowolnej wielkości).',
        '<b>ChatGPT</b>: <b>Ustawienia → Aplikacje / Łączniki → Dodaj własny serwer MCP</b> (w części planów trzeba włączyć tryb dewelopera), uwierzytelnianie: brak. ChatGPT umie przekazać łącznikowi zdjęcia wrzucone do rozmowy.',
        '<b>Claude Code</b>: <code>claude mcp add --transport http makietka https://api.makietka.app/mcp/sdk_…</code>. <b>Cursor</b> i inne programy z MCP: dodaj serwer HTTP z tym adresem.',
        'Sprawdzenie: napisz do AI „Pokaż moje projekty w Makietce”. Powinno użyć narzędzia <b>projekty</b>.',
      ],
    },
    {
      tytul: 'Krok 3. Pierwsze zadanie',
      tekst: 'Pisz do AI zwyczajnie, jak do grafika: co chcesz zrobić, w jakim formacie, ile stron, jaki nastrój. AI widzi Twoje projekty i zmienia je na żywo – jeśli masz projekt otwarty, zmiany pojawiają się w edytorze po chwili, a <kbd>Ctrl</kbd>+<kbd>Z</kbd> cofa tylko Twoje własne zmiany. Gotowe polecenia: „Komiks do druku” i „Kalendarz z tabelą” (niżej i w rozdziale o danych).',
    },
    {
      tytul: 'Co AI może, a czego nie',
      punkty: [
        '<b>Może</b>: czytać i zmieniać strony, elementy, style, wzorce, tabele danych i serie; tworzyć i usuwać projekty (pełny dostęp); wgrywać obrazy z adresu w internecie, z linku Dysku Google albo Dropboxa i z rysunku SVG, który samo narysuje; wstawiać obrazy na strony; uruchomić kontrolę przed drukiem.',
        '<b>Zdjęcia z Twojego komputera albo z rozmowy</b>: w ChatGPT wchodzą wprost; w Claude Desktop z rozszerzeniem – z dysku; małe grafiki (do kilkuset KB) Claude przesyła kawałkami; duże zdjęcia najprościej wrzucić samemu przez <b>link do wgrania</b>, który AI poda.',
        '<b>Nie może</b>: zobaczyć Twoich innych projektów (tylko te z klucza), zmienić konta, hasła ani czcionek konta, wyeksportować PDF za Ciebie (PDF robisz w aplikacji).',
      ],
    },
    {
      tytul: 'Ograniczenia, o których warto wiedzieć',
      punkty: [
        'Nie każde AI obsługuje łączniki (MCP). Darmowe plany często ich nie mają; aplikacje na telefon pozwalają zwykle tylko używać łączników dodanych wcześniej na komputerze.',
        'Część aplikacji AI nie przekazuje łącznikom plików z rozmowy, a ich „piaskownica” nie łączy się z internetem – stąd różne drogi dla zdjęć (wyżej).',
        'AI czasem myli się w szczegółach układu. Proś o plan przed zmianami, sprawdzaj podgląd i rób <b>Eksport do pliku</b> przed dużymi zmianami.',
        'Limity: jeden obraz od AI do 25 MB, zapytania łącznika są ograniczane na minutę.',
      ],
    },
  ],
  ramki: [
    { rodzaj: 'uwaga', tekst: 'Adres łącznika zawiera Twój klucz – kto go ma, ma dostęp do wybranych projektów. Nie publikuj go, dawaj najkrótszą ważność, jaka wystarczy, i odbieraj klucz po skończonej pracy (Ustawienia konta → Dostęp dla AI → <b>Odbierz</b>).' },
  ],
  prompty: [
    { tytul: 'Polecenie „Podłącz Makietkę”', opis: 'Wklej do rozmowy z AI – poprowadzi Cię przez podłączenie w Twojej aplikacji.', tekst: PROMPT_PODLACZENIE },
  ],
  zobacz: ['Praca z AI', 'Przykład: komiks do druku z AI', 'Dane w praktyce – przykłady krok po kroku'],
};

export const ROZDZIAL_KOMIKS = {
  grupa: 'AI i współpraca',
  tytul: 'Przykład: komiks do druku z AI',
  wstep: 'Od pomysłu do pliku dla drukarni – zeszyt A5 z okładką. AI układa kadry i dymki, Ty dostarczasz rysunki i decydujesz.',
  kroki: [
    `Podłącz łącznik (${L('Praca z AI – krok po kroku')}) z kluczem <b>pełny dostęp</b>, <b>czyta i zmienia</b> – AI musi utworzyć nowy projekt.`,
    'Skopiuj polecenie <b>„Komiks do druku”</b> (niżej), dopisz swój pomysł i wyślij. AI najpierw pokaże plan stron – popraw go, zanim zacznie.',
    'Otwórz nowy projekt w Makietce – zobaczysz, jak AI dodaje strony, kadry i dymki.',
    'Rysunki: poproś AI o <b>link do wgrania</b>, wrzuć skany albo pliki z programu graficznego (PNG, JPEG, ZIP). AI wstawi je w kadry. W Claude Desktop z rozszerzeniem wystarczy wskazać folder.',
    'Popraw ręcznie, co chcesz: tekst w dymkach (styl „Dymek” zmienia wszystkie naraz), kadrowanie zdjęć (dwuklik obrazu), kolejność stron.',
    `Okładka: osobna sekcja z grzbietem – ${L('Sekcje')} (szerokość grzbietu policzy kalkulator).`,
    `<b>⋯ → Sprawdź przed drukiem</b>, potem <b>Eksport do PDF</b> → <b>Do drukarni – ze spadem i znakami cięcia</b>. ${L('Eksport do PDF')}.`,
  ],
  ramki: [
    { rodzaj: 'wskazowka', tekst: 'Zeszyt zszywany ma liczbę stron podzielną przez 4 (8, 12, 16…). Poproś AI, żeby to pilnowało.' },
    { rodzaj: 'uwaga', tekst: 'Rysunki do druku przygotuj w rozdzielczości co najmniej 300 dpi w rozmiarze kadru (np. kadr 10 cm szerokości to około 1200 pikseli).' },
  ],
  prompty: [{ tytul: 'Polecenie „Komiks do druku”', opis: 'Skopiuj, dopisz pomysł na końcu i wyślij AI z podłączoną Makietką.', tekst: PROMPT_KOMIKS }],
};

export const ROZDZIAL_SLOWNICZEK = {
  grupa: 'Na koniec',
  tytul: 'Słowniczek',
  wstep: 'Krótko o słowach, które pojawiają się w aplikacji i w tej instrukcji.',
  punkty: [
    '<b>Blok</b> – strona albo kilka sąsiednich stron serii, powielane razem.',
    '<b>Element</b> – wszystko, co stoi na stronie: tekst, kształt, linia, obraz, tabela, grupa.',
    '<b>Grzbiet</b> – część okładki między przodem a tyłem; jego szerokość zależy od liczby stron i papieru.',
    '<b>Łańcuch ramek</b> – ramki tekstu połączone tak, że tekst przelewa się z jednej do następnej.',
    '<b>Łącznik (MCP)</b> – adres, przez który asystent AI pracuje w Twoich projektach.',
    '<b>Margines</b> – pas przy brzegu strony, w którym nie powinno być ważnych treści.',
    '<b>Pole</b> – nazwa w klamrach w tekście, np. <code>{dzien}</code>; w podglądzie i PDF zamienia się w wartość.',
    '<b>Pole dokumentu</b> – pole wynikające z projektu, nie z tabeli: numer strony, sekcja, data.',
    '<b>Rozkładówka</b> – dwie strony obok siebie, lewa i prawa, jak w otwartej książce.',
    '<b>Sekcja</b> – część projektu z własnym formatem, marginesami, wzorcami i numeracją (np. okładka i środek).',
    '<b>Seria</b> – powielanie strony (bloku) dla kolejnych wierszy tabeli.',
    '<b>Spad</b> – kilka milimetrów za brzegiem strony, na które wychodzą tła i zdjęcia; drukarnia je odcina.',
    '<b>Styl</b> – zapisany wygląd tekstu, zmieniany naraz we wszystkich tekstach.',
    '<b>Tabela danych</b> – arkusz w projekcie, z którego biorą się pola i serie (nie mylić z elementem „Tabela” na stronie).',
    '<b>Wiersz pomijany</b> – wiersz <code>[pomiń]</code>: zajmuje miejsce w bloku, ale jego strona nie powstaje.',
    '<b>Wzorzec</b> – wspólne elementy wielu stron: tło, stopka, numer strony.',
    '<b>Znaki cięcia</b> – kreski poza stroną w PDF, wskazujące drukarni, gdzie ciąć.',
  ],
};
