# Format projektu Makietki – opis dla AI

Ten dokument opisuje, jak samodzielnie zbudować projekt [Makietki](https://makietka.app/) (edytor publikacji do druku: książki, kalendarze, planery, zaproszenia i inne dokumenty), który użytkownik wczyta przyciskiem **Importuj** na liście projektów. Opis jest sprawdzany testem (`tests/format-ai.test.cjs`): oba przykłady z `ai/przyklady/` wczytują się w aplikacji i przechodzą „Sprawdź przed drukiem” bez uwag.

Instrukcja obsługi aplikacji (co robi każdy przycisk): [ai/instrukcja.md](https://makietka.app/ai/instrukcja.md).

Ten sam model zmienia AI podłączone do istniejącego projektu łącznikiem Makietka (adres z okna „Dostęp dla AI”, dodany w Claude albo ChatGPT jako własny łącznik MCP): [ai/api.md](https://makietka.app/ai/api.md). Nie łącz się z bazą z własnej piaskownicy – używaj narzędzi łącznika Makietka.

## 1. Dwie postacie pliku

### Najprostsza: plik `.json`

Zwykły plik JSON z obiektem projektu (rozdział 2). Obrazy i własne czcionki wpisujesz w `zasoby` jako `dataUrl` (base64). Aplikacja przyjmuje go tak samo jak `.makietka`. **Tę postać polecam AI** – jeden plik tekstowy, bez archiwum.

```json
{
  "nazwa": "Mój projekt",
  "sekcje": [{ "id": "sek_1", "nazwa": "Główna", "wydruk": { "szerokosc_mm": 148, "wysokosc_mm": 210 } }],
  "strony": [{ "id": "s_1", "nazwa": "Strona 1", "sekcja": "sek_1", "obiekty": [] }],
  "zasoby": { "z_logo": { "nazwa": "logo.png", "dataUrl": "data:image/png;base64,iVBORw0..." } }
}
```

### Archiwum `.makietka`

Archiwum ZIP (jak `.docx`) z rozszerzeniem `.makietka`. Zawartość, w tej kolejności:

| Plik | Zawartość |
|---|---|
| `mimetype` | dokładnie `application/vnd.seriodruk+zip`; **pierwszy plik w archiwum i bez kompresji** (STORE) |
| `manifest.json` | `{ "format": "seriodruk", "wersja_formatu": 1, "aplikacja": "Makietka", "pliki": { "projekt": "projekt.json", "miniatura": null }, "zasoby": [{ "id", "plik", "typ", "nazwa" }] }` |
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
| `zasoby` | `{ id: { nazwa, dataUrl } }` | obrazy i pliki czcionek; `nazwa` z rozszerzeniem, np. `styczen.jpg`; nazwy obrazów są różne (bez względu na wielkość liter). Projekt na koncie ma zamiast `dataUrl` opis pliku: `typ`, `rozmiar`, `szer`/`wys` (piksele), `skrot` (SHA-256 treści) i `sciezka` (plik na koncie albo `ai:…` – obraz wgrany przez AI, który aplikacja przeniesie na konto) |
| `zasoby_usuniete` | `[id]` (opcjonalne) | identyfikatory obrazów usuniętych z projektu – żeby łączenie z innym urządzeniem ich nie przywróciło; nie używaj tych identyfikatorów |
| `czcionki` | `[{ id, rodzina, waga, kursywa }]` | tylko własne czcionki spoza zestawu; `id` wskazuje plik w `zasoby`; `waga` 100–900 (400 zwykła, 700 pogrubiona) |
| `widok` | `{ siatka_mm, siatka, do_siatki, do_elementow, linijki }` | nieobowiązkowe ustawienia edytora |
| `kolory_dodatkowe` | `[{ id, nazwa, cmyk: [c, m, y, k] }]` (opcjonalne) | kolory dodatkowe (spot, np. „PANTONE 186 C”) – osobne płyty w PDF; `cmyk` (0–100) to zapas do podglądu; rozdział 5, „Kolory do druku” |
| `tryb_kolorow` | `"pelny"` \| `"szarosc"` \| `"czb1"` (opcjonalne) | pełny kolor (domyślnie), skala szarości (sama czerń), czerń + 1 kolor dodatkowy (`kolor_trybu` – jego `id`) |

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
- `wydruk.siatka_bazowa` (opcjonalnie): `{ "odstep": 5, "przesuniecie": 12 }` – siatka linii bazowych (mm): pierwsza linia `przesuniecie` od górnej krawędzi strony, kolejne co `odstep`. Teksty z `do_siatki: true` stawiają na niej wiersze.
- `skladka` (opcjonalnie): `4`, `8`, `16` albo `32` – środek składany ze składek; aplikacja pilnuje, żeby liczba stron sekcji (po powieleniach serii) była wielokrotnością składki, i proponuje dopełnienie pustymi stronami.

**Okładka liczona sama.** Sekcja z polem `okladka` jest okładką z grzbietem: jej `wydruk.szerokosc_mm` i `wysokosc_mm` liczy aplikacja (nie wpisuj ich), a `uklad` jest zawsze `pojedyncze`.

```json
{ "id": "sek_okl", "nazwa": "Okładka", "numeracja": { "tryb": "brak", "od": 1 },
  "okladka": { "oprawa": "twarda", "srodek": null, "strony": { "tryb": "auto", "liczba": 0 },
                "papier": { "tryb": "gramatura", "gramatura": 90, "rodzaj": "offset", "grubosc_mm": 0.1 },
                "zawiniecie_mm": 15, "big_mm": 7, "naddatek_mm": 3, "tektura_mm": 2,
                "wymiary": { "tryb": "auto", "grzbiet_mm": 0, "szerokosc_mm": 0, "wysokosc_mm": 0 } } }
```

- `oprawa`: `miekka` (klejona, grzbiet = kartki × grubość kartki), `zeszytowa` (zszywki, bez grzbietu), `twarda` (tektura: grzbiet = blok + 2 × `tektura_mm`; dookoła `zawiniecie_mm`, przy grzbiecie bigi `big_mm`, tektura wystaje o `naddatek_mm`).
- `srodek`: `null` – środek to wszystkie sekcje poza okładkami; albo lista id sekcji. Format strony środka bierze się z pierwszej z nich.
- `strony.tryb`: `auto` – liczba stron środka liczona z sekcji środka (z powieleniami serii); `reczne` – `strony.liczba`.
- `papier.tryb`: `grubosc` – `grubosc_mm` jednej kartki; `gramatura` – grubość = `gramatura` × wolumen papieru / 1000 (`rodzaj`: `offset` 1,25, `ksiazkowy` 1,5, `objetosciowy` 1,8, `kredowy_mat` 0,95, `kredowy_blysk` 0,8 cm³/g).
- `wymiary.tryb`: `auto` – grzbiet i rozmiar liczone; `grzbiet` – `grzbiet_mm` wpisany (np. podany przez drukarnię) zamiast liczonego z papieru; `rozmiar` – `szerokosc_mm` × `wysokosc_mm` całej okładki bez spadu (tył i przód dzielą resztę po równo wokół grzbietu; grzbiet = `grzbiet_mm`, a gdy 0 – liczony). Liczone wartości aplikacja zapisuje w `wynik.liczone`.
- `okladka.wynik` zapisuje aplikacja (strefy `zawiniecie_l`, `tyl`, `big_l`, `grzbiet`, `big_p`, `przod`, `zawiniecie_p` z `x1`/`x2` w mm od lewej krawędzi cięcia, `gora`/`dol` – granice pola okładki bez zawinięcia). Przy zmianie grzbietu aplikacja przesuwa elementy: element grzbietu zostaje na jego środku, przód przesuwa się o różnicę, tło na całą okładkę się rozciąga. Element może mieć `okladka`: `tyl` | `grzbiet` | `przod` (przypięcie zamiast liczonego z położenia) i `okladka_dopasuj`: `true` (szerokość = szerokość grzbietu).

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
- Obraz: `width`/`height` to rozmiar obrazu w pikselach, a rozmiar na stronie daje skala: `scaleX = szerokość_mm / width`. Do tego `"zasob": "<id z zasoby>"` i `"src": "zasob:<id>"`. Przez łącznik prościej: `wgraj_obraz` dodaje plik do projektu (adres https, link z Dysku Google albo Dropboxa, ZIP, kod SVG, małe dane base64, a w serwerze u siebie – plik albo folder z dysku), a `wstaw_obraz` stawia go na stronie i sam liczy skalę i przycięcie. Nazwy, usuwanie i porządkowanie: `zmien_nazwe_obrazu`, `usun_obrazy`, `podmien_obraz`, `uporzadkuj_obrazy`.
- Kształt jako ramka obrazu: `rect`, `ellipse`, `polygon` albo zamknięty `path` z polem `"zasob": "<id obrazu>"` pokazuje obraz przycięty do kształtu, zawsze wypełniający go (bez `src`). Kadr: `"obraz_kadr": { "x": 0, "y": 0, "skala": 1 }` – `x`, `y` to przesunięcie środka obrazu względem środka kształtu w ułamkach szerokości i wysokości kształtu (przycinane tak, by obraz zakrywał kształt), `skala` ≥ 1 to powiększenie ponad wypełnienie. `fill` kształtu widać pod przezroczystymi częściami obrazu, obrys i cień zostają. Obraz z danych: `"pole": { "kolumna": "plik" }` (nazwa pliku z kolumny), opcjonalnie `"kadr": "gora"`.
- Filtry obrazu (bez zmiany pliku): `"filtry": { "jasnosc": 0, "kontrast": 0, "nasycenie": 0, "szarosc": false, "sepia": false, "rozmycie": 0 }` – wartości −100…100 (rozmycie 0–100); pomijaj te, których nie zmieniasz.
- Kolory: `#rrggbb`. Przejście kolorów: `fill: { "type": "linear", "gradientUnits": "percentage", "coords": { "x1": 0, "y1": 0, "x2": 1, "y2": 0 }, "colorStops": [{ "offset": 0, "color": "#06d6a0" }, { "offset": 1, "color": "#ef476f" }] }` (albo `"type": "radial"`). Kolor przejścia może być półprzezroczysty: `"color": "rgba(6,214,160,0.4)"`.
- Obrót: `angle` (stopnie). Przezroczystość: `opacity` (0–1).
- **Kolory do druku.** Kolor dodatkowy (spot) z `kolory_dodatkowe` wpisujesz w `fill`/`stroke` (także w `styles` fragmentu) jako jego kolor ekranu w danym odcieniu: dla `cmyk = [c, m, y, k]` i odcienia `t` (0–1) to `#rrggbb` z `r = 255·(1 − c·t/100)·(1 − k·t/100)`, `g = 255·(1 − m·t/100)·(1 − k·t/100)`, `b = 255·(1 − y·t/100)·(1 − k·t/100)` (zaokrąglone). Ten dokładny kod PDF zamienia na płytę o nazwie koloru. Uszlachetnienie elementu: `"uszlachetnienie": "uv" | "folia" | "tloczenie" | "wytloczenie" | "bialy"`, przy folii `"folia": "zloto" | "srebro" | "miedz"` – element drukuje się tylko na płycie uszlachetnienia (Spot_UV, Foil_Gold…, Emboss, Debossing, White), z nadrukiem; żeby mieć kolor i uszlachetnienie, zrób kopię elementu nad nim z polem `uszlachetnienie`.
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
| `kod` | kod QR albo kod kreskowy EAN-13 / ISBN (niżej, „Kody”) |
| `bez_pol` | `true` – klamry w tym tekście to zwykły tekst |
| `dziel_wyrazy` | `true` – dzielenie wyrazów po polsku (łącznik na końcu wiersza tylko w wyglądzie, treść bez zmian); `dziel_min` (najkrótszy dzielony wyraz, 5), `dziel_przed` / `dziel_po` (najmniej liter przed i po łączniku, 2) |
| `spojniki` | `true` – jednoliterowe spójniki i przyimki (a, i, o, u, w, z) nie zostają na końcu wiersza; `"dwuliterowe"` – także do, na, od, po, we, za, ze, że… Nowe teksty mają `true` |
| `wdowy` | najmniej wierszy akapitu na końcu i początku ramki przy tekście płynącym przez ramki (2 albo 3; brak – bez pilnowania). Nowe teksty mają 2 |
| `inicjal` | 2–5 – pierwsza litera pierwszego akapitu jako inicjał na tyle wierszy; `inicjal_czcionka`, `inicjal_kolor` (domyślnie jak tekst) |
| `tabulatory` | `[{ "poz": 70, "rodzaj": "prawy", "wypelniacz": "." }]` – pozycje (mm od lewej krawędzi ramki), `rodzaj`: `lewy`, `srodek`, `prawy`, `dziesietny`; `wypelniacz`: `""`, `"."`, `"-"`, `"_"`. W treści znak `\t`; bez pozycji tabulator skacze co 12,5 mm |
| `do_siatki` | `true` – wiersze na siatce linii bazowych sekcji (`wydruk.siatka_bazowa`, rozdział 3) |
| `oblewanie`, `oblewanie_odstep` | dowolny element poza tekstem: `prostokat` (tekst opływa ramkę), `ksztalt` (elipsa, wielokąt, ścieżka – opływa kształt), `skok` (tekst przeskakuje pod element); odstęp w mm (domyślnie 2) |
| `bez_oblewania` | tekst: `true` – nie opływa innych elementów |
| `link` | adres klikalny w PDF do czytania na ekranie (#131C): `"https://…"`, `"mailto:…"`, `"tel:…"` (bez schematu – `www.…` dostaje `https://`). Działa dla każdego elementu (cały jego obszar); kod QR z adresem jest klikalny sam |
| `ksztalt_tekstu` | tekst po kształcie albo wygięty (#131B): `{ "rodzaj": "luk", "zgiecie": 50 }`. `rodzaj`: `luk` (`zgiecie` −100…100, ujemne – łuk w dół; `promien` mm, 0 – sam), `okrag` (`promien`, `przesuniecie` – obrót początku w stopniach, `strona`: `zewn` – litery na zewnątrz u góry, `wewn` – do środka u dołu), `elipsa` (`promien`, `zgiecie` 0…100 – spłaszczenie, `przesuniecie` w %), `sciezka` (`d` – ścieżka SVG w mm względem środka tekstu, `przesuniecie` w %, `wyrownanie`: `lewo` / `srodek` / `prawo`, `strona`: `zewn` – nad linią, `wewn` – pod, `odwroc`: `true`), wygięcia `luk_gora`, `luk_dol`, `wypuklosc`, `wkleslosc`, `fala`, `flaga`, `zwezenie` (siła w `zgiecie`). Tekst jest jednym wierszem; `width` i `height` elementu aplikacja liczy sama z liter po kształcie. Usunięcie pola (null) – tekst prosto |

## 6. Style tekstu

```json
{ "id": "st_tytul", "nazwa": "Tytuł", "fontFamily": "Playfair Display", "fontSize": 9.878, "fontWeight": "bold",
  "fontStyle": "normal", "underline": false, "linethrough": false, "lineHeight": 1.1, "charSpacing": 0, "fill": "#1a1a1a", "textAlign": "left" }
```

Styl może zawierać też ustawienia składu (`dziel_wyrazy`, `spojniki`, `wdowy`, `do_siatki`, `inicjal`, `tabulatory`…) – `null` znaczy „wyłączone”.

**Style znakowe** (`style_znakowe` w projekcie): `{ "id": "sz_wyr", "nazwa": "Wyróżnienie", "fontWeight": "bold", "fill": "#c8102e" }` – pola jak we fragmencie tekstu (`fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `underline`, `linethrough`, `fill`). Fragment wskazuje styl polem `styl_znakowy` w swoim `style` i ma te same wartości.

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

**Obraz z danych** – obraz-wzór wyznacza ramkę, kolumna podaje nazwę pliku z `zasoby`. Rozszerzenie się liczy: `las.jpg` i `las.png` to dwa różne obrazy (wielkość liter bez znaczenia). Nazwa bez rozszerzenia (`las`) działa tylko wtedy, gdy pasuje dokładnie jeden plik – przy kilku strona pokazuje brak obrazu, więc najlepiej wpisywać pełne nazwy:
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

## 9a. Kalendarz miesiąca, wykres i kolaż (Biblioteka)

Trzy elementy z Biblioteki aplikacji. W `dodaj_elementy` wystarczy **skrót** – łącznik zrobi z niego grupę, a treść (daty, słupki, pola na zdjęcia) aplikacja ułoży sama przy wczytaniu strony i przy składaniu każdej strony serii.

```json
{ "type": "kalendarz", "left": 14, "top": 40, "width": 120,
  "kalendarz": { "rok": 2027, "miesiac": 3, "pole_daty": "miesiac", "pierwszy": 1, "nazwy": "skrot", "tytul": true,
                 "tygodnie": false, "inne": "wyszarz", "notatki": false, "swieta": true, "nazwy_swiat": false, "wiersz_dnia": 9,
                 "swieta_z": { "tabela": "t_swieta", "data": "data", "nazwa": "nazwa" },
                 "kolory": { "dni": "#1a1a1a", "naglowek": "#1a1a1a", "niedziele": "#c62828", "soboty": null, "swieta": "#c62828", "inne": "#b5b2aa" } } }
```

- Kalendarz to tabela (`tabela` + komórki) z opisem `kalendarz`. `pole_daty` – kolumna danych z miesiącem („2027-03”, „marzec 2027”, „3” + `pole_roku`); na każdej stronie serii inny miesiąc. Bez niej – stały `rok` i `miesiac`.
- Polskie święta (stałe i ruchome: Wielkanoc, Poniedziałek Wielkanocny, Zielone Świątki, Boże Ciało, od 2025 Wigilia) liczą się same; `swieta_z` dokłada dni z tabeli danych (data „2027-05-26”, „26.05.2027” albo „26.05” – co roku).
- Komórek kalendarza nie wpisuje się ręcznie – układa je aplikacja.

```json
{ "type": "wykres", "left": 20, "top": 120, "wykres": { "rodzaj": "slupki", "tabela": "t_sprzedaz", "etykiety": "miesiac",
  "wartosci": ["sklep", "internet"], "zakres": "wszystkie", "szerokosc": 120, "wysokosc": 70, "tytul": "Sprzedaż",
  "etykiety_wartosci": true, "os": true, "siatka": true, "legenda": true, "rozmiar": 2.6, "kolory": ["#2f6fb0", "#e07b39"] } }
```

- `rodzaj`: `slupki` | `poziome` | `linia` | `kolo` | `pierscien`. `zakres`: `wszystkie` | `zakres` (`od`, `do` – numery wierszy od 1) | `wiersz` (wiersz strony serii: kategorie to kolumny `wartosci`, liczby z bieżącego wiersza). Liczby w komórkach mogą mieć przecinek, spacje i „%”.

```json
{ "type": "kolaz", "left": 10, "top": 20, "kolaz": { "uklad": "3-duzy-lewo", "odstep": 2, "zaokraglenie": 0, "szerokosc": 128, "wysokosc": 90 } }
```

- `uklad`: `2-pion`, `2-poziom`, `3-kolumny`, `3-duzy-lewo`, `3-duzy-gora`, `4-siatka`, `4-duzy-lewo`, `5-mozaika`, `5-duzy-gora`, `6-siatka`, `6-pion`, `9-siatka`. Pola to prostokąty – ramki obrazu: zdjęcie wstawisz, ustawiając polu `zasob` (jak kształtowi z obrazem).

## 9b. Książka: spis treści, żywa pagina, przypisy, odsyłacze, skorowidz

- **Nagłówki** to teksty w stylach akapitu, które projekt uznaje za nagłówki: `ksiazka.naglowki` w projekcie (`[{ "styl": "<id stylu>", "poziom": 1 }]`, poziomy 1–3). Bez tego ustawienia nagłówkiem poziomu 1 jest styl „Tytuł” (albo „Rozdział…”), poziomu 2 – „Nagłówek”.
- **Spis treści** i **skorowidz** to teksty z polem `ksiazka`, których treść aplikacja składa sama (nie wpisuj jej):

```json
{ "type": "textbox", "id": "spis", "left": 15, "top": 25, "width": 118, "text": "", "fontFamily": "Inter", "fontSize": 3.7,
  "ksiazka": { "rodzaj": "spis", "poziomy": 2, "kropki": true } }
```

  Przez łącznik wystarczy skrót `{ "type": "spis", "left": 15, "top": 25, "width": 118, "poziomy": 2 }` albo `{ "type": "skorowidz", … }`. Numery stron biorą się z numeracji sekcji, razem ze stronami powielonymi serią.
- **Żywa pagina**: pole `{rozdzial}` (ostatni nagłówek poziomu 1 do tej strony) albo `{rozdzial:2}` – zwykle w stopce albo nagłówku wzorca.
- **Odsyłacz**: `{s:<id elementu>}` – numer strony, na której stoi element (np. nagłówek): „zob. s. {s:r2}”.
- **Przypis dolny**: w tekście pole `{przypis:<id>}` (zwykle w indeksie górnym: formatowanie fragmentu `fontSize` ≈ 0,62 × rozmiaru, `deltaY` ≈ −0,36 × rozmiaru), a treść w polu tekstu `przypisy: { "<id>": "Treść przypisu." }`. Numer i treść na dole strony układa aplikacja; numeracja według `ksiazka.przypisy` projektu: `sekcja` (domyślnie), `strona`, `ciagle`.
- **Skorowidz**: hasła w polu tekstu `hasla: ["kot", "pies"]`; skorowidz pokazuje wszystkie strony, na których słowo występuje w jakimkolwiek tekście.

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

- [`ai/przyklady/minimalny.json`](https://makietka.app/ai/przyklady/minimalny.json) – jedna strona A5: niebieski prostokąt, tytuł i tekst.
- [`ai/przyklady/kalendarz.json`](https://makietka.app/ai/przyklady/kalendarz.json) – kalendarz na 2027 r., 367 stron w wydruku z 9 stron w projekcie:
  - sekcja „Okładka” (bez numeracji) z obrazem na spad (`bez_ostrzezen`) i tytułem;
  - sekcja „Kalendarz” z wzorcem „Stopka z numerem” (`{nr}`) i numeracją od 1;
  - blok 7 stron (poniedziałek–niedziela) z serią `uklad: "dlugi"` według tabeli „Dni”: cztery wiersze `[pomiń]` (rok zaczyna się w piątek), potem 365 dni;
  - na stronie dnia: `{dzien} {miesiac} 2027`, `{dzien_tygodnia} · {Miesiace.haslo}` z tabeli dodatkowej zmieniającej wiersz razem z miesiącem, zdjęcie z danych (`pole.kolumna: "zdjecie"`, `tryb: "wypelnij"`), kropka widoczna tylko w niedziele (`z_danych.widok`) i linie na notatki;
  - strona „Cele” z tabelą-elementem 3 × 4.

## 12. Gotowe polecenie dla innego AI

> Zbuduj mi projekt Makietki jako jeden plik `.json` zgodnie z opisem https://makietka.app/ai/format-makietka.md (wzoruj się na https://makietka.app/ai/przyklady/kalendarz.json).
> Publikacja: [opisz: format, liczba i rodzaj stron, sekcje, co ma być na stronach].
> Dane: [wklej albo opisz tabelę, np. dni roku z imieninami].
> Wymagania: wszystkie wymiary w mm (rozmiar pisma też: pt × 25,4 / 72); czcionki tylko z zestawu z opisu; każdy element ma `id`, tekst ma `strokeWidth: 0`; strony powtarzane zrób jako serię z tabeli, nie jako osobne strony; obrazy wpisz do `zasoby` jako `dataUrl` (jeśli ich nie masz, użyj obrazów-wzorów i podaj nazwy plików w tabeli – wgram je w aplikacji w oknie „Obrazy projektu”, także jako ZIP).
> Na koniec wypisz, ile stron powstanie w wydruku i co mam sprawdzić po wczytaniu.

Po wczytaniu pliku w aplikacji (Importuj na liście projektów) warto otworzyć **Sprawdź przed drukiem** w menu ⋯ edytora – pokaże brakujące zdjęcia, nieznane pola i tekst, który nie mieści się w ramce.


## Kody QR i kreskowe (EAN-13, ISBN)

Kod to element (w zapisie grupa z polem `kod`), którego rysunek liczy aplikacja. Dodaj go narzędziem `dodaj_elementy` w skróconej postaci:

```json
{ "type": "kod", "rodzaj": "qr", "tresc": "https://makietka.app", "szerokosc": 25, "left": 110, "top": 170 }
{ "type": "kod", "rodzaj": "ean", "tresc": "978-83-01-00000", "left": 20, "top": 200 }
```

- `rodzaj`: `qr` albo `ean` (EAN-13; ISBN-13 to EAN-13 zaczynający się od 978/979; ISBN-10 zamienia się sam).
- `tresc`: treść kodu – adres, tekst, `mailto:…`, `tel:…`, `WIFI:T:WPA;S:sieć;P:hasło;;` albo cyfry EAN (12 cyfr – kontrolna dopisze się sama; myślniki można zostawić). Może zawierać pola z danych, np. `{adres}` – na każdej stronie serii powstaje inny kod.
- `szerokosc` (mm; QR jest kwadratem), dla EAN też `wysokosc` (nominalnie 37,29 × 25,93 mm, najmniej 80%).
- Opcjonalnie: `korekcja` (`L`/`M`/`Q`/`H`), `kolor` (domyślnie `#000000`), `tlo` (`#ffffff` albo `null` – przezroczyste), `cisza` (margines ciszy, domyślnie `true`), `napis` (EAN: cyfry pod kodem).
- Moduł QR powinien mieć najmniej 0,33 mm – przy długiej treści kod musi być większy. Kontrola przed drukiem ostrzega o za małym, za jasnym albo złym kodzie.
