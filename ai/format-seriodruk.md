# Format projektu Seriodruku – opis dla AI

Ten dokument opisuje, jak samodzielnie zbudować projekt [Seriodruku](https://andrish97.github.io/book/) (edytor publikacji z powtarzanymi stronami: kalendarze, planery, notesy), który użytkownik wczyta przyciskiem **Importuj** na liście projektów. Opis jest sprawdzany testem (`tests/format-ai.test.cjs`): oba przykłady z `ai/przyklady/` wczytują się w aplikacji i przechodzą „Sprawdź przed drukiem” bez uwag.

Instrukcja obsługi aplikacji (co robi każdy przycisk): [ai/instrukcja.md](https://andrish97.github.io/book/ai/instrukcja.md).

Ten sam model zmienia AI podłączone do istniejącego projektu kluczem dostępu (serwer MCP albo akcje GPT): [ai/api.md](https://andrish97.github.io/book/ai/api.md).

## 1. Dwie postacie pliku

### Najprostsza: plik `.json`

Zwykły plik JSON z obiektem projektu (rozdział 2). Obrazy i własne czcionki wpisujesz w `zasoby` jako `dataUrl` (base64). Aplikacja przyjmuje go tak samo jak `.seriodruk`. **Tę postać polecam AI** – jeden plik tekstowy, bez archiwum.

```json
{
  "nazwa": "Mój projekt",
  "sekcje": [{ "id": "sek_1", "nazwa": "Główna", "wydruk": { "szerokosc_mm": 148, "wysokosc_mm": 210 } }],
  "strony": [{ "id": "s_1", "nazwa": "Strona 1", "sekcja": "sek_1", "obiekty": [] }],
  "zasoby": { "z_logo": { "nazwa": "logo.png", "dataUrl": "data:image/png;base64,iVBORw0..." } }
}
```

### Archiwum `.seriodruk`

Archiwum ZIP (jak `.docx`) z rozszerzeniem `.seriodruk`. Zawartość, w tej kolejności:

| Plik | Zawartość |
|---|---|
| `mimetype` | dokładnie `application/vnd.seriodruk+zip`; **pierwszy plik w archiwum i bez kompresji** (STORE) |
| `manifest.json` | `{ "format": "seriodruk", "wersja_formatu": 1, "aplikacja": "Seriodruk", "pliki": { "projekt": "projekt.json", "miniatura": null }, "zasoby": [{ "id", "plik", "typ", "nazwa" }] }` |
| `projekt.json` | obiekt projektu (rozdział 2); w `zasoby` zamiast `dataUrl` jest `"plik": "zasoby/<id>.<rozszerzenie>"` |
| `zasoby/<id>.<rozszerzenie>` | pliki obrazów i czcionek bez kodowania (`png`, `jpg`, `webp`, `svg`, `gif`, `ttf`, `otf`, `woff`, `woff2`) |
| `miniatura.png` | nieobowiązkowa; wtedy `"miniatura": "miniatura.png"` w manifeście |

Aplikacja sprawdza `format` (musi być `"seriodruk"`) i `wersja_formatu` (nie większa niż 1). Typ pliku zasobu rozpoznaje po rozszerzeniu. Pola manifestu `utworzono`, `projekt` (opis) i `bajty` są tylko informacją.

## 2. Projekt

Wszystkie wymiary są w **milimetrach**. Rozmiar pisma też w mm: `mm = pt × 25,4 / 72` (np. 10 pt = 3,528 mm, 12 pt = 4,233 mm, 24 pt = 8,467 mm).

| Pole | Typ | Uwagi |
|---|---|---|
| `nazwa` | tekst | nazwa projektu |
| `sekcje` | lista sekcji | co najmniej jedna; rozdział 3 |
| `strony` | lista stron | **obowiązkowa**, w kolejności wydruku; rozdział 4 |
| `wzorce` | lista wzorców | wspólne elementy wielu stron (tło, stopka); rozdział 4 |
| `style` | lista stylów tekstu | rozdział 6 |
| `tabele` | lista tabel z danymi | rozdział 7 |
| `serie` | lista serii | powielanie stron według tabel; rozdział 8 |
| `zasoby` | `{ id: { nazwa, dataUrl } }` | obrazy i pliki czcionek; `nazwa` z rozszerzeniem, np. `styczen.jpg` |
| `czcionki` | `[{ id, rodzina, waga, kursywa }]` | tylko własne czcionki spoza zestawu; `id` wskazuje plik w `zasoby`; `waga` 100–900 (400 zwykła, 700 pogrubiona) |
| `widok` | `{ siatka_mm, siatka, do_siatki, do_elementow, linijki }` | nieobowiązkowe ustawienia edytora |

Identyfikatory (`id`) wymyślasz sam: dowolne niepowtarzalne napisy, np. `s_1`, `o_tytul`, `z_styczen`. Pole `id` projektu pomiń – aplikacja nada nowe.

**Co aplikacja poprawia sama przy wczytaniu** (`normalizuj` w `js/projekt.js`): uzupełnia brakujące pola wartościami domyślnymi; stronę bez istniejącej sekcji przypisuje do pierwszej; usuwa odwołania do nieistniejących wzorców, serii i tabel; układa strony według kolejności sekcji; tabelę wyrównuje do prostokąta (każdy wiersz ma tyle komórek, ile kolumn; wartości to tekst); nazwy kolumn bez `{`, `}`, `:` i powtórzeń. Czego nie poprawi: złych typów obiektów, położeń poza stroną, nieznanych czcionek (tekst wyjdzie czcionką zastępczą).

## 3. Sekcje

Sekcja to część publikacji z własnym formatem (np. okładka i środek).

```json
{ "id": "sek_1", "nazwa": "Środek",
  "wydruk": { "format": "A5", "szerokosc_mm": 148, "wysokosc_mm": 210, "spad_mm": 3,
              "marginesy": { "gora": 10, "dol": 10, "wewnetrzny": 10, "zewnetrzny": 10 }, "znaki_ciecia": true },
  "uklad": "pojedyncze", "pierwsza": "prawa", "wzorce": ["wz_stopka"],
  "numeracja": { "tryb": "ciagla", "od": 1 } }
```

- `wydruk.format` to tylko nazwa (`A4`, `A5`, `A6`, `B5`, `Kwadrat` albo własna) – rozmiar wyznaczają `szerokosc_mm` i `wysokosc_mm`. Domyślnie A5 148 × 210, spad 3, marginesy 10.
- `uklad`: `pojedyncze` albo `rozkladowki`. W rozkładówkach margines `wewnetrzny` jest przy grzbiecie, a `pierwsza` mówi, czy sekcja zaczyna się stroną prawą (zwykle) czy lewą.
- `wzorce`: identyfikatory wzorców obowiązujących na stronach sekcji (pierwszy leży najniżej).
- `numeracja.tryb`: `ciagla` (numery biegną dalej), `od` (sekcja zaczyna od `od`), `brak` (strony bez numeru, np. okładka).

## 4. Strony i wzorce

```json
{ "id": "s_1", "nazwa": "Styczeń", "sekcja": "sek_1", "wzorce": "z_sekcji", "tlo": null, "seria": "se_dni", "obiekty": [ ... ] }
```

- `wzorce`: `"z_sekcji"` (domyślnie – wzorce sekcji), lista identyfikatorów albo `[]` (bez wzorców).
- `tlo`: kolor tła strony (`"#fff8e1"`) albo `null` (białe).
- `seria`: identyfikator serii, gdy strona ma się powielać (rozdział 8). Sąsiednie strony z tą samą serią tworzą **blok** powielany razem.
- `obiekty`: elementy strony (rozdział 5), w kolejności od spodu do wierzchu.
- `prowadnice`: nieobowiązkowe `{ "x": [mm], "y": [mm] }`.

Współrzędne elementów liczą się od **lewego górnego rogu strony po przycięciu** (bez spadu). Element na spad zaczyna się od `-spad_mm`. W rozkładówce każda strona ma własne współrzędne.

Wzorzec: `{ "id", "nazwa", "wydruk", "tlo", "lustro", "obiekty" }`. Element wzorca z `"warstwa": "nad"` leży nad treścią strony (domyślnie pod). `lustro: true` – na lewych stronach rozkładówki elementy wzorca stoją lustrzanie. W tekstach wzorca działają pola, np. `{nr}` w stopce.

## 5. Elementy na stronie

Elementy to obiekty JSON biblioteki Fabric.js 7 w postaci, w jakiej zapisuje je aplikacja. Używaj tylko tych typów (małymi literami):

| `type` | Najważniejsze pola |
|---|---|
| `textbox` | `text`, `left`, `top`, `width`, `fontSize` (mm), `fontFamily`, `fontWeight` (`normal`/`bold`), `fontStyle` (`normal`/`italic`), `fill`, `textAlign` (`left`/`center`/`right`/`justify`), `lineHeight` (mnożnik, np. 1,2), `charSpacing` (tysięczne części wysokości pisma), `underline`, `linethrough`, **`strokeWidth: 0`** |
| `rect` | `left`, `top`, `width`, `height`, `fill`, `stroke`, `strokeWidth` (mm), `rx`, `ry` (zaokrąglenie) |
| `ellipse` | `left`, `top`, `rx`, `ry` (promienie), `fill`, `stroke`, `strokeWidth` |
| `line` | `left`, `top`, `x1`, `y1`, `x2`, `y2` (względem siebie), `width`, `height`, `stroke`, `strokeWidth`, `strokeUniform: true` |
| `polygon` | `left`, `top`, `points: [{ x, y }]`, `fill`, `stroke`; wielokąt foremny ma też `boki` i `gwiazda` |
| `path` | `left`, `top`, `path` (lista poleceń SVG, np. `[["M",0,0],["L",10,0]]`), `fill`, `stroke` |
| `image` | `left`, `top`, `width`, `height` (**piksele obrazu**), `scaleX`, `scaleY`, `zasob`, `src`, `cropX`, `cropY` (piksele) |
| `group` | tylko dla tabeli (rozdział 9); zwykłych grup nie twórz – położenia ich elementów liczą się od środka grupy |

Zasady, które łatwo przeoczyć:
- `left` i `top` to **lewy górny róg** elementu w mm (aplikacja ustawia `originX`/`originY` na `left`/`top`).
- Tekst musi mieć `"strokeWidth": 0` – domyślny obrys biblioteki (1) poszerza ramkę tekstu i daje ostrzeżenie o marginesie.
- Wysokość ramki tekstu wynika z treści; `width` to szerokość ramki (tekst łamie się do niej).
- Obraz: `width`/`height` to rozmiar obrazu w pikselach, a rozmiar na stronie daje skala: `scaleX = szerokość_mm / width`. Do tego `"zasob": "<id z zasoby>"` i `"src": "zasob:<id>"`.
- Kolory: `#rrggbb`. Przejście kolorów: `fill: { "type": "linear", "gradientUnits": "percentage", "coords": { "x1": 0, "y1": 0, "x2": 1, "y2": 0 }, "colorStops": [{ "offset": 0, "color": "#06d6a0" }, { "offset": 1, "color": "#ef476f" }] }` (albo `"type": "radial"`).
- Obrót: `angle` (stopnie). Przezroczystość: `opacity` (0–1).
- Fragment tekstu z innym wyglądem: `styles: [{ "start": 5, "end": 12, "style": { "fontWeight": "bold", "fill": "#c8102e" } }]` (indeksy znaków całego tekstu).
- Element, który świadomie wychodzi na spad albo poza margines (np. tło okładki), dostaje `"bez_ostrzezen": true` – inaczej „Sprawdź przed drukiem” go zgłosi.

**Czcionki.** `fontFamily` musi być nazwą z oficjalnego zestawu albo rodziną z `czcionki` projektu. Zestaw (52 rodziny; ¹ – bez pogrubienia, ² – bez kursywy):
- bezszeryfowe: Inter (domyślna), Open Sans, Montserrat, Lato, Roboto, Source Sans 3, Nunito, Poppins, Raleway, Work Sans, IBM Plex Sans, Fira Sans, Rubik, DM Sans, Barlow, Josefin Sans, Quicksand²;
- wąskie: Oswald², Barlow Condensed, Roboto Condensed, Bebas Neue¹², Anton¹²;
- szeryfowe: Lora, Merriweather, Playfair Display, Source Serif 4, EB Garamond, Cormorant Garamond, Libre Baskerville, Crimson Pro, PT Serif, Spectral, Literata, Alegreya, Bitter, Roboto Slab², Zilla Slab, DM Serif Display¹, Abril Fatface¹²;
- odręczne: Caveat², Dancing Script², Pacifico¹², Kalam², Patrick Hand¹², Amatic SC², Great Vibes¹², Sacramento¹², Courgette¹², Lobster¹²;
- maszynowe: JetBrains Mono, Courier Prime, IBM Plex Mono.

Wszystkie mają polskie znaki. Przy czcionce bez pogrubienia albo kursywy nie ustawiaj `bold`/`italic`.

### Pola własne aplikacji (na elementach)

| Pole | Znaczenie |
|---|---|
| `id` | identyfikator elementu (obowiązkowy, niepowtarzalny) |
| `nazwa` | nazwa na liście warstw |
| `styl` | identyfikator stylu tekstu (rozdział 6) |
| `zablokowany` | `true` – nie da się przesunąć w edytorze |
| `warstwa` | we wzorcu: `"nad"` – nad treścią strony |
| `bez_ostrzezen` | `true` – bez uwag o marginesie i spadzie |
| `ramka_h` | stała wysokość ramki tekstu (mm) |
| `wyrownanie_pion` | w ramce o stałej wysokości: `gora`, `srodek`, `dol` |
| `autodopasowanie`, `rozmiar_bazowy`, `min_rozmiar` | zmniejszanie tekstu, gdy nie mieści się w `ramka_h`: `rozmiar_bazowy` (mm) to rozmiar zadany, `min_rozmiar` – najmniejszy, **w punktach** |
| `lista`, `lista_start` | `punkty`, `kreski` albo `numery` przed akapitami; `lista_start` – pierwszy numer |
| `wielkosc_liter` | `wielkie`, `male`, `kapitaliki` – tylko wygląd, treść zostaje |
| `watek`, `watek_nr`, `lacznik` | tekst płynący przez kilka ramek – lepiej połączyć ramki w edytorze („Dodaj ramkę z ciągiem dalszym”); tego opis nie sprawdza |
| `pole` | obraz z danych (rozdział 8) |
| `z_danych` | kolor, położenie, obrót, rozmiar i widoczność z danych (rozdział 8) |
| `tabela` | tabela jako jeden element (rozdział 9) |
| `bez_pol` | `true` – klamry w tym tekście to zwykły tekst |

## 6. Style tekstu

```json
{ "id": "st_tytul", "nazwa": "Tytuł", "fontFamily": "Playfair Display", "fontSize": 9.878, "fontWeight": "bold",
  "fontStyle": "normal", "underline": false, "linethrough": false, "lineHeight": 1.1, "charSpacing": 0, "fill": "#1a1a1a", "textAlign": "left" }
```

Tekst wskazuje styl polem `styl` i powinien mieć te same wartości (styl nie jest nakładany przy wczytaniu – służy do zmiany wielu tekstów naraz w edytorze).

## 7. Tabele z danymi

```json
{ "id": "t_dni", "nazwa": "Dni", "kolumny": ["dzien", "miesiac", "zdjecie"],
  "wiersze": [["[pomiń]", "", ""], ["1", "styczeń", "styczen.jpg"]],
  "listy": { "miesiac": ["styczeń", "luty"] }, "unikalne": ["dzien"] }
```

- Wartości to tekst. Nazwy kolumn: proste, bez `{ } :` (np. `dzien`, `imieniny`).
- **Wiersz pomijany:** `[pomiń]` (albo `[pomin]`) w pierwszej komórce. W serii zajmuje miejsce w bloku, ale jego strona nie powstaje – służy do wyrównania danych z blokiem (np. rok zaczynający się w piątek w bloku tygodnia od poniedziałku: cztery wiersze `[pomiń]` na początku).
- `listy`: dozwolone wartości kolumny (inne są zgłaszane przed drukiem). `unikalne`: kolumny bez powtórzeń.
- `wyglad`: wygląd komórek, wiersz po wierszu jak `wiersze`: `null` albo lista komórek `null | { pogrubienie, kursywa, kolor: "#rrggbb", czesci: [{ od, do, pogrubienie, kursywa, kolor }] }`. Przenosi się na pole w tekście, chyba że tabela ma `wyglad_wyl: true`.

### Pola w tekście

W tekście `{nazwa_kolumny}` zastępuje wartość z wiersza danej strony serii. Kolumna tabeli dodatkowej: `{NazwaTabeli.kolumna}` (sama nazwa kolumny też działa, gdy nie ma jej w tabeli głównej). Podwójne `{{` i `}}` to zwykłe klamry.

Pola dokumentu (działają na każdej stronie):

| Pole | Wartość |
|---|---|
| `{nr}` | numer strony według numeracji sekcji |
| `{nr_ogolny}` | numer w całym projekcie, od 1 |
| `{nr_w_sekcji}` | numer w sekcji, od 1 |
| `{liczba_stron}`, `{liczba_stron_sekcji}` | liczba stron projektu / sekcji |
| `{sekcja}`, `{nr_sekcji}`, `{strona}`, `{projekt}`, `{seria}` | nazwy i numer sekcji |
| `{egzemplarz}`, `{liczba_egzemplarzy}` | numer powielenia w serii i ich liczba |
| `{data}`, `{rok}` | dzisiejsza data i bieżący rok (dzień eksportu, nie rok kalendarza) |
| `{poczatek:Nazwa}`, `{koniec:Nazwa}` | numer pierwszej / ostatniej strony sekcji o tej nazwie |
| `{nr_strony:Nazwa}` | numer strony o tej nazwie |

Zapis liczby po dwukropku: `{nr:00}` (01, 02), `{nr:I}` / `{nr:i}` (rzymskie), `{nr:A}` / `{nr:a}` (litery).

## 8. Serie: powielanie stron z danych

```json
{ "id": "se_dni", "nazwa": "Dni roku", "tabela": "t_dni", "tryb": "tabela", "uklad": "dlugi", "ile": 1,
  "dodatkowe": [{ "tabela": "t_mies", "co": 1, "zmiana": "miesiac" }], "dopelnij": false, "pilnuj_stron": false }
```

- Strona (albo kilka sąsiednich stron = blok) wskazuje serię polem `seria`. **Nie zapisuj powielonych stron** – powstają same przy składaniu. 365 stron dni to jedna strona-wzór (albo blok 7 stron-wzorów) i tabela.
- `tryb`: `tabela` – blok powiela się według wierszy tabeli; `stala` – `ile` razy (dane idą w kółko).
- `uklad`: `szeroki` – jeden wiersz na cały blok (kolumny w rodzaju `s1_tytul`, `s2_tytul` dla stron bloku); `dlugi` – jeden wiersz na każdą stronę bloku (blok 7 stron i 365 wierszy = 365 stron, kolejne wiersze idą na kolejne strony bloku).
- Seria kończy się na ostatnim wierszu; `dopelnij: true` dokańcza ostatni blok stronami bez danych.
- `dodatkowe`: tabele, których wiersz zmienia się rzadziej – co `co` stron (pierwszy wiersz przez `pierwszy` stron) albo gdy zmieni się kolumna tabeli głównej (`zmiana`: nazwa kolumny albo lista nazw).
- `pilnuj_stron` (tylko sekcje z rozkładówkami): strona bloku zawsze wychodzi po swojej stronie rozkładówki; gdy trzeba, aplikacja wstawia pustą stronę.
- Wiersze `[pomiń]` liczą się jako miejsca w bloku i w tabelach dodatkowych, ale nie dają stron ani numerów.

**Obraz z danych** – obraz-wzór wyznacza ramkę, kolumna podaje nazwę pliku z `zasoby` (z rozszerzeniem albo bez):
`"pole": { "kolumna": "zdjecie", "tryb": "wypelnij", "kadr": "gora", "kadr_z": "kadr" }` – bez `tryb` obraz mieści się w ramce w całości; `wypelnij` – wypełnia ją z przycięciem; `kadr` (`gora`, `dol`, `lewa`, `prawa`; brak = środek) – która część zostaje; `kadr_z` – kolumna z kadrem osobnym dla każdego wiersza (słowo albo `"30% 20%"`).

**Wygląd z danych** – `z_danych` na dowolnym elemencie (pole = kolumna albo pole dokumentu, np. `egzemplarz`):

```json
"z_danych": {
  "kolor": "kolor", "kolor_w": "pierwszy",
  "y": { "pole": "egzemplarz", "tryb": "pozycja", "krok": 22, "co": 6 },
  "x": { "pole": "przesuniecie", "tryb": "mm" },
  "obrot": "kat",
  "widok": { "pole": "swieto", "gdy": "rowne", "wartosc": "tak" },
  "szer": { "pole": "procent", "tryb": "procent" }, "wys": { "pole": "wysokosc", "tryb": "mm" }, "kotwica": "dol"
}
```

- `kolor` – kolumna z kolorem (`#d1495b`, `d1495b`, `rgb(…)`, nazwa CSS). `kolor_w` przy przejściu kolorów: `pierwszy`, `ostatni`, `odcienie`; bez niego kolor zastępuje całe wypełnienie.
- `x`, `y` – przesunięcie: `tryb: "mm"` (wartość to milimetry) albo `"pozycja"` (wartość 1, 2, 3… przesuwa o `krok` × (wartość − 1); `co` zawija liczenie, np. co 6).
- `obrot` – kąt w stopniach. `widok.gdy`: `niepuste`, `puste`, `rowne` (z `wartosc`).
- `szer`, `wys` – rozmiar: `tryb: "procent"` (100 = jak wzór) albo `"mm"`; `kotwica`: brak (lewy górny róg), `srodek`, `dol`. Wartość 0 chowa element.

## 9. Tabela jako element strony

Grupa z opisem `tabela` i komórkami-tekstami (wierszami, od lewej; liczba komórek = wiersze × kolumny). Linie siatki, tło i położenie komórek aplikacja liczy sama.

```json
{ "type": "group", "id": "o_tab", "left": 12, "top": 40, "width": 124, "height": 36,
  "layoutManager": { "type": "layoutManager", "strategy": "fixed" }, "subTargetCheck": false, "interactive": false,
  "tabela": { "kolumny": [62, 31, 31], "wiersze": [9, 9, 9, 9], "naglowek": true, "linia": { "kolor": "#1a1a1a", "grubosc": 0.25 },
              "tlo": { "naglowek": "#dbe4fb", "zebra": null } },
  "objects": [ { "type": "textbox", "id": "o_k1", "text": "Cel", "width": 30, "fontSize": 3.175, "fontFamily": "Inter", "fontWeight": "bold", "strokeWidth": 0, "wyrownanie_pion": "srodek" }, "… 11 kolejnych komórek" ] }
```

- `width` = suma `kolumny`, `height` = suma `wiersze` (mm); **`layoutManager` ze strategią `fixed` jest konieczny** – bez niego tabela ląduje w innym miejscu.
- `wiersze` to najmniejsze wysokości – wiersz rośnie, gdy tekst się nie mieści. Komórki mogą zawierać pola `{kolumna}`.
- Nieobowiązkowo: `scalenia: [{ w, k, ileW, ileK }]` (scalone komórki), `linie_komorek` (własne linie odcinków siatki – zobacz README).

## 10. Czego nie robić

- Nie zapisuj powielonych stron serii jako osobnych stron – zrób jedną stronę-wzór z polami i tabelę.
- Nie podawaj pól `wersja_chmury`, `podstawa_chmury`, `zmieniono`, `miniatura` – to dane urządzenia.
- Nie używaj czcionek spoza zestawu bez pliku w `zasoby` i wpisu w `czcionki`.
- Nie twórz zwykłych grup ani obrazów z adresem internetowym – obraz musi być w `zasoby`.
- Nie zostawiaj tekstu bez `"strokeWidth": 0` i nie zapominaj o `id` każdego elementu.
- Nie licz położeń od spadu: `left: 0` to krawędź strony po przycięciu.
- `{rok}` i `{data}` to dzień eksportu – rok kalendarza wpisz zwykłym tekstem albo w tabeli.

## 11. Przykłady

Oba wczytują się w aplikacji bez uwag (sprawdza to test). Buduje je skrypt `scripts/przyklady-ai.cjs`.

- [`ai/przyklady/minimalny.json`](https://andrish97.github.io/book/ai/przyklady/minimalny.json) – jedna strona A5: niebieski prostokąt, tytuł i tekst.
- [`ai/przyklady/kalendarz.json`](https://andrish97.github.io/book/ai/przyklady/kalendarz.json) – kalendarz na 2027 r., 367 stron w wydruku z 9 stron w projekcie:
  - sekcja „Okładka” (bez numeracji) z obrazem na spad (`bez_ostrzezen`) i tytułem;
  - sekcja „Kalendarz” z wzorcem „Stopka z numerem” (`{nr}`) i numeracją od 1;
  - blok 7 stron (poniedziałek–niedziela) z serią `uklad: "dlugi"` według tabeli „Dni”: cztery wiersze `[pomiń]` (rok zaczyna się w piątek), potem 365 dni;
  - na stronie dnia: `{dzien} {miesiac} 2027`, `{dzien_tygodnia} · {Miesiace.haslo}` z tabeli dodatkowej zmieniającej wiersz razem z miesiącem, zdjęcie z danych (`pole.kolumna: "zdjecie"`, `tryb: "wypelnij"`), kropka widoczna tylko w niedziele (`z_danych.widok`) i linie na notatki;
  - strona „Cele” z tabelą-elementem 3 × 4.

## 12. Gotowe polecenie dla innego AI

> Zbuduj mi projekt Seriodruku jako jeden plik `.json` zgodnie z opisem https://andrish97.github.io/book/ai/format-seriodruk.md (wzoruj się na https://andrish97.github.io/book/ai/przyklady/kalendarz.json).
> Publikacja: [opisz: format, liczba i rodzaj stron, sekcje, co ma być na stronach].
> Dane: [wklej albo opisz tabelę, np. dni roku z imieninami].
> Wymagania: wszystkie wymiary w mm (rozmiar pisma też: pt × 25,4 / 72); czcionki tylko z zestawu z opisu; każdy element ma `id`, tekst ma `strokeWidth: 0`; strony powtarzane zrób jako serię z tabeli, nie jako osobne strony; obrazy wpisz do `zasoby` jako `dataUrl` (jeśli ich nie masz, użyj obrazów-wzorów i podaj nazwy plików w tabeli – wgram je w aplikacji przyciskiem „Wgraj obrazy do projektu”).
> Na koniec wypisz, ile stron powstanie w wydruku i co mam sprawdzić po wczytaniu.

Po wczytaniu pliku w aplikacji (Importuj na liście projektów) warto otworzyć **Sprawdź przed drukiem** w menu ⋯ edytora – pokaże brakujące zdjęcia, nieznane pola i tekst, który nie mieści się w ramce.
