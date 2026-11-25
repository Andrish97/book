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
| `style` | lista stylów tekstu (pola jak w tekście: czcionka, rozmiar, waga, interlinia, odstęp liter, kolor, skład akapitu, także `wielkosc_liter`) | rozdział 6 |
| `tabele` | lista tabel z danymi | rozdział 7 |
| `serie` | lista serii | powielanie stron według tabel; rozdział 8 |
| `zasoby` | `{ id: { nazwa, dataUrl } }` | obrazy i pliki czcionek; `nazwa` z rozszerzeniem, np. `styczen.jpg`; nazwy obrazów są różne (bez względu na wielkość liter). Projekt na koncie ma zamiast `dataUrl` opis pliku: `typ`, `rozmiar`, `szer`/`wys` (piksele), `skrot` (SHA-256 treści) i `sciezka` (plik na koncie albo `ai:…` – obraz wgrany przez AI, który aplikacja przeniesie na konto) |
| `zasoby_usuniete` | `[id]` (opcjonalne) | identyfikatory obrazów usuniętych z projektu – żeby łączenie z innym urządzeniem ich nie przywróciło; nie używaj tych identyfikatorów |
| `czcionki` | `[{ id, rodzina, waga, kursywa }]` | tylko własne czcionki spoza zestawu; `id` wskazuje plik w `zasoby`; `waga` 100–900 (400 zwykła, 700 pogrubiona) |
| `widok` | `{ siatka_mm, siatka, do_siatki, do_elementow, linijki }` | nieobowiązkowe ustawienia edytora |
| `kolory_dodatkowe` | `[{ id, nazwa, cmyk: [c, m, y, k] }]` (opcjonalne) | kolory dodatkowe (spot, np. „PANTONE 186 C”) – osobne płyty w PDF; `cmyk` (0–100) to zapas do podglądu; rozdział 5, „Kolory do druku” |
| `tryb_kolorow` | `"pelny"` \| `"szarosc"` \| `"czb1"` (opcjonalne) | pełny kolor (domyślnie), skala szarości (sama czerń), czerń + 1 kolor dodatkowy (`kolor_trybu` – jego `id`) |
| `makieta` | `{ ujecia: [...] }` (opcjonalne) | zapisane ujęcia makiety 3D (kamera, światło, tło, położenie kartek); rozdział 9e. Bez ujęć pole nie występuje |
| `makieta_linku` | `{ pokaz?: false, model?: "…", ujecie?: "id ujęcia" }` (opcjonalne) | makieta 3D w linku do podglądu: `pokaz: false` – bez makiety, `model` – rodzaj (jak w rozdziale 9e), `ujecie` – id zapisanego ujęcia. Bez pola – rodzaj dobrany do projektu i pierwsze ujęcie |
| `znak_wodny` | `{ tekst, krycie }` (opcjonalne) | znak wodny na stronach podglądu udostępnionego linkiem (napis ukośnie, wtopiony w obrazy linku; `krycie` – 5–50 %, domyślnie 12); ustawia użytkownik w oknie Udostępnij. Nie zmienia wydruku ani PDF |

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

- Sekcja: `wydruk` (format, wymiary, spad, marginesy), `uklad`, `pierwsza`, `wzorce`, `numeracja` (`tryb`: `ciagla` | `od` | `brak`, `od`: pierwszy numer). Projekt ma też `wersja` (wersja modelu danych – nie zmieniaj).
- `wydruk.format` to tylko nazwa (`A4`, `A5`, `A6`, `B5`, `Kwadrat` albo własna) – rozmiar wyznaczają `szerokosc_mm` i `wysokosc_mm`. Domyślnie A5 148 × 210, spad 3, marginesy 10.
- `uklad`: `pojedyncze` albo `rozkladowki`. W rozkładówkach margines `wewnetrzny` jest przy grzbiecie, a `pierwsza` mówi, czy sekcja zaczyna się stroną prawą (zwykle) czy lewą.
- `wzorce`: identyfikatory wzorców obowiązujących na stronach sekcji (pierwszy leży najniżej).
- `numeracja.tryb`: `ciagla` (numery biegną dalej), `od` (sekcja zaczyna od `od`), `brak` (strony bez numeru, np. okładka).
- `wydruk.siatka_bazowa` (opcjonalnie): `{ "odstep": 5, "przesuniecie": 12 }` – siatka linii bazowych (mm): pierwsza linia `przesuniecie` od górnej krawędzi strony, kolejne co `odstep`. Teksty z `do_siatki: true` stawiają na niej wiersze.
- `tryb_kolorow` (opcjonalnie, sekcja): `"pelny"` | `"szarosc"` | `"czb1"` – tryb kolorów w druku tylko tej sekcji, np. okładka w pełnym kolorze, a środek w skali szarości; bez pola sekcja drukuje się w trybie projektu (`tryb_kolorow` projektu). Przy `"czb1"` sekcja ma `kolor_trybu` (id koloru z `kolory_dodatkowe`). W PDF każda strona idzie w trybie swojej sekcji.
- `podloze` (opcjonalnie): `{ "rodzaj": "kolor", "kolor": "#f3e4c2" }` (kolorowy papier) albo `{ "rodzaj": "folia" }` (przezroczysta folia) – podłoże widać w edytorze i podglądzie, w PDF się nie drukuje; bez pola – biały papier.
- `skladka` (opcjonalnie): `4`, `8`, `16` albo `32` – środek składany ze składek; aplikacja pilnuje, żeby liczba stron sekcji (po powieleniach serii) była wielokrotnością składki, i proponuje dopełnienie pustymi stronami.

**Okładka liczona sama.** Sekcja z polem `okladka` jest okładką z grzbietem: jej `wydruk.szerokosc_mm` i `wysokosc_mm` liczy aplikacja (nie wpisuj ich), a `uklad` jest zawsze `pojedyncze`.

```json
{ "id": "sek_okl", "nazwa": "Okładka", "numeracja": { "tryb": "brak", "od": 1 },
  "okladka": { "oprawa": "twarda", "srodek": null, "strony": { "tryb": "auto", "liczba": 0 },
                "papier": { "tryb": "gramatura", "gramatura": 90, "rodzaj": "offset", "grubosc_mm": 0.1 },
                "zawiniecie_mm": 15, "big_mm": 7, "naddatek_mm": 3, "tektura_mm": 2,
                "wymiary": { "tryb": "auto", "grzbiet_mm": 0, "szerokosc_mm": 0, "wysokosc_mm": 0 } } }
```

- `oprawa`: `miekka` (klejona, grzbiet = kartki × grubość kartki), `zeszytowa` (zszywki, bez grzbietu), `twarda` (tektura: grzbiet = blok + 2 × `tektura_mm`; dookoła `zawiniecie_mm`, przy grzbiecie bigi `big_mm`, tektura wystaje o `naddatek_mm`; `grzbiet`: `okragly` (domyślnie) albo `prosty` – kształt grzbietu w makiecie 3D).
- `srodek`: `null` – środek to wszystkie sekcje poza okładkami; albo lista id sekcji. Format strony środka bierze się z pierwszej z nich.
- `strony.tryb`: `auto` – liczba stron środka liczona z sekcji środka (z powieleniami serii); `reczne` – `strony.liczba`.
- `papier.tryb`: `grubosc` – `grubosc_mm` jednej kartki; `gramatura` – grubość = `gramatura` × wolumen papieru / 1000 (`rodzaj`: `offset` 1,25, `ksiazkowy` 1,5, `objetosciowy` 1,8, `kredowy_mat` 0,95, `kredowy_blysk` 0,8 cm³/g).
- `wymiary.tryb`: `auto` – grzbiet i rozmiar liczone; `grzbiet` – `grzbiet_mm` wpisany (np. podany przez drukarnię) zamiast liczonego z papieru; `rozmiar` – `szerokosc_mm` × `wysokosc_mm` całej okładki bez spadu (tył i przód dzielą resztę po równo wokół grzbietu; grzbiet = `grzbiet_mm`, a gdy 0 – liczony). Liczone wartości aplikacja zapisuje w `wynik.liczone`.
- `okladka.wynik` **liczy i zapisuje wyłącznie aplikacja – nie ustawiaj go** (łącznik i tak zachowuje wartość z projektu). Wymiary okładki ustawiasz przez `wymiary` (np. `tryb: "rozmiar"` z `szerokosc_mm`, `wysokosc_mm`, `grzbiet_mm`). Dla orientacji: `wynik` to (strefy `zawiniecie_l`, `tyl`, `big_l`, `grzbiet`, `big_p`, `przod`, `zawiniecie_p` z `x1`/`x2` w mm od lewej krawędzi cięcia, `gora`/`dol` – granice pola okładki bez zawinięcia). Przy zmianie grzbietu aplikacja przesuwa elementy: element grzbietu zostaje na jego środku, przód przesuwa się o różnicę, tło na całą okładkę się rozciąga. Element może mieć `okladka`: `tyl` | `grzbiet` | `przod` (przypięcie zamiast liczonego z położenia) i `okladka_dopasuj`: `true` (szerokość = szerokość grzbietu).

**Typ sekcji (#177).** Każda sekcja ma pole `typ` – czym jest w publikacji. Typ sam ustala geometrię i zachowanie sekcji; aplikacja (grzbiet okładki, numeracja stron, pliki PDF dla drukarni, kontrola przed drukiem, makieta 3D) czyta wyłącznie `typ`, nigdy nazwy sekcji. Wartości:

| `typ` | Czym jest | Parametry | Numery stron, grzbiet |
|---|---|---|---|
| `zwykla` | strony w wybranym formacie (plakat, ulotka jednokartkowa, broszura) | – | numerowana, liczy się do bloku |
| `blok` | środek książki | – | numerowana, z jej stron i papieru liczy się grzbiet |
| `okladka` | okładka z grzbietem | `okladka` | bez numerów |
| `wyklejka_przednia`, `wyklejka_tylna` | twarda oprawa: arkusz 2× format bloku, połowa przyklejona do okładki, połowa to luźna kartka | `specjalna` (`rodzaj: "wyklejka"`) | bez numerów; jedna kartka papieru wyklejki dochodzi do grzbietu |
| `obwoluta` | papierowa okładka ze skrzydełkami | `specjalna` | bez numerów |
| `wkladka` | kartki na innym papierze w środku książki | `papier`: `{ "gramatura": 130, "rodzaj": "kredowy_mat" }` (`offset` \| `ksiazkowy` \| `objetosciowy` \| `kredowy_mat` \| `kredowy_blysk`) | bez numerów; jej kartki (tym papierem) dochodzą do grzbietu |
| `podkladka` | karton pod kalendarzem albo notesem | – | bez numerów, poza grzbietem |
| `ulotka`, `trojdzielny`, `wykrojnik`, `arkusz` | druki osobne | `specjalna` | bez numerów, poza blokiem |
| `kalendarz` | kalendarz z datami | `specjalna` | numerowana jak blok |

Nadając typ, ustaw też jego parametry (np. `typ: "okladka"` z polem `okladka`, `typ: "obwoluta"` z `specjalna: { "rodzaj": "obwoluta" }`); pole niezgodne z typem aplikacja usuwa. Gdy dopiszesz `okladka` albo `specjalna` innego rodzaju i nie zmienisz `typ`, łącznik ustawi typ z tych parametrów. Twarda okładka (`oprawa: "twarda"`) bez obu wyklejek to ostrzeżenie kontroli przed drukiem. Okładka twarda może mieć `okladka.tasiemka`: `{ "kolor": "#8b1e2d" }` (zakładka – tasiemka w grzbiecie; `null` – bez). Materiał i wykończenie okładki: `okladka.wykonczenie`: `{ "material": "druk", "folia": "mat" | "blysk" | "soft" | "brak", "rogi_mm": 0 }` albo okleina bez nadruku `{ "material": "plotno" | "skora" | "papier_strukturalny" | "aksamit", "kolor": "#6d1a24", "rogi_mm": 5 }` (rogi: 0, 3, 5, 6, 10 mm; na okleinie drukują się tylko elementy z uszlachetnieniem – złocenie, tłoczenie).

- **Wyklejka** (`specjalna.rodzaj: "wyklejka"`): `strona` (`przednia` \| `tylna` – zgodnie z typem), `zadruk` (`czysta` \| `jednostronny` \| `dwustronny` – wtedy sekcja ma dwie strony), `gramatura` (domyślnie 140). Format liczy się sam: szerokość 2× format bloku, wysokość bloku (ze spadem sekcji). Strefy w `wynik.strefy`: strona 0 – `na_okladke` („Na okładce (przyklejona)”) i `luzna` („Pierwsza/Ostatnia luźna kartka”; w przedniej `na_okladke` po lewej, w tylnej po prawej), strona 1 (zadruk dwustronny) – `luzna_tyl` i `klej`; zgięcie (`bigi`) pośrodku.

**Sekcje specjalne (#177).** Sekcja może mieć pole `specjalna` – wtedy, jak okładka, „wie”, czym jest: zna swoje strefy (panele, skrzydełka, klapy), sama liczy format (`wydruk.szerokosc_mm`, `wysokosc_mm` – nie wpisuj ich; `uklad` zawsze `pojedyncze`, poza kalendarzem z datami), rysuje zgięcia (bigi), perforacje i linię wykrojnika, ostrzega o tekście na zgięciu i elementach poza wykrojnikiem, a eksport PDF zna jej arkusz. Sekcja ma `okladka` albo `specjalna`, nigdy oba. `rodzaj` i parametry (mm):

- `obwoluta` – `skrzydelko_mm` (0 = ok. 55% szerokości płyty), `zapas_mm` (na grubość płyty przy zgięciu, domyślnie 3), `naddatek_wys_mm`. Wymiary płyt i grzbietu bierze z sekcji `okladka` z `oprawa: "twarda"` (albo liczy jak dla twardej oprawy środka projektu). Strefy: `skrzydelko_l`, `zapas_l`, `tyl`, `grzbiet`, `przod`, `zapas_p`, `skrzydelko_p` – elementy idą za swoją strefą przy zmianie grzbietu (jak na okładce).
- `ulotka` – `panele` (2–4), `zlozenie` (`c` – zwijana/łamana C: panel składany do środka węższy o `skrot_mm`, kolejny o następny; `z` – harmonijka, równe), `szerokosc_mm` i `wysokosc_mm` panelu. Sekcja ma dwie strony: pierwsza – zewnętrzna (strefy `zew_1`…, ostatni panel to „Okładka”), druga – wewnętrzna (`wew_1`…); brakującą stronę aplikacja dopisuje. Panele zewnętrzne to odbicie wewnętrznych.
- `kalendarz` – `rok`, `jednostka` (`dzien` | `tydzien` | `miesiac`), `pierwszy` (`pn` | `nd`), `swieta` (`pl` – polskie święta stałe i ruchome: Wielkanoc, Poniedziałek Wielkanocny, Zielone Świątki, Boże Ciało; `brak`). Format sekcji się nie zmienia; aplikacja tworzy i przepisuje tabelę danych (`tabela` – id) i serię (`seria` – id, powiela pierwszą stronę sekcji). Kolumny: dzień – `data` (RRRR-MM-DD), `dzien`, `miesiac`, `miesiac_dopelniacz`, `miesiac_nr`, `rok`, `dzien_tygodnia`, `dzien_roku`, `tydzien` (ISO), `swieto`, `wolne` („tak” w niedziele i święta), `niedziela`; tydzień – `data`, `tydzien`, `od`, `do`, `miesiac`, `rok`, `swieta`; miesiąc – `data`, `miesiac`, `miesiac_nr`, `rok`, `dni`, `swieta`. Zmiana `rok` przepisuje dane (kolumny dopisane ręcznie zostają przy tych samych datach).
- `trojdzielny` – `szerokosc_mm` (310), `glowka_mm` (200), `kalendarium_mm` (145, trzy jedno pod drugim), `reklama_mm` (60, 0 – bez paska), `margines_kal_mm`, `okienko` (true/false). Strefy: `glowka`, `kalendarium_1`–`3`, `okienko`, `reklama`; big pod główką, perforacje między kalendariami i nad paskiem.
- `wykrojnik` – `ksztalt`: `koperta` (`koperta`: `C6` | `DL` | `C5` | `kwadrat`), `teczka` (`panel_szer_mm`, `panel_wys_mm`, `grzbiet_mm`, `kieszen_mm`, `wizytowka` – nacięcia na wizytówkę), `pudelko` (`dlugosc_mm`, `szerokosc_mm`, `wysokosc_mm` → siatka z wieczkiem, dnem, klapkami i zakładką klejową). Linia cięcia idzie do PDF kolorem dodatkowym `CutContour`, zgięcia – `Crease` (nie drukują się). To, co leży poza linią cięcia, odpadnie.
- `arkusz` – arkusz użytków: `uzytek_szer_mm`, `uzytek_wys_mm` (format jednego użytku – strony sekcji), `arkusz` (`SRA3` | `A3` | `A4` | `B2` | `wlasny` z `arkusz_szer_mm`, `arkusz_wys_mm`), `odstep_mm`, `margines_mm`, `kolumny`/`wiersze` (0 – ile się zmieści), `ksztalt` (`prostokat` | `naklejka` – wykrojnik po obrysie z `zaokraglenie_mm`). W PDF (układ „Zwykły”) strony sekcji stoją na arkuszach obok siebie ze znakami cięcia: jedna strona – powielona na cały arkusz, kilka (np. seria osób) – kolejno.

`specjalna.wynik` **liczy i zapisuje wyłącznie aplikacja** (łącznik zachowuje wartość z projektu): `szerokosc`, `wysokosc`, `stron`, `strefy` (`rodzaj`, `nazwa`, `x1`, `y1`, `x2`, `y2` w mm od lewego górnego rogu formatu, `strona` 0/1 – tylko ta strona sekcji), `bigi`, `perforacje`, `naciecia` (odcinki `x1`, `y1`, `x2`, `y2`), `ciecie` (kontury `[{ x, y }]`), a zależnie od rodzaju `ksiazka`, `panele`, `zlozona`, `uzytki` (`arkusz`, `kolumny`, `wiersze`, `na_arkuszu`, `x0`, `y0`, `odstep`). Elementy stawiaj w strefach z `wynik.strefy` (z marginesami sekcji wewnątrz strefy), teksty nie na `bigi`.

```json
{ "id": "sek_ulotka", "nazwa": "Ulotka", "wydruk": { "spad_mm": 3, "marginesy": { "gora": 8, "dol": 8, "wewnetrzny": 8, "zewnetrzny": 8 } },
  "specjalna": { "rodzaj": "ulotka", "panele": 3, "zlozenie": "c", "szerokosc_mm": 99, "wysokosc_mm": 210, "skrot_mm": 2 } }
```

## 4. Strony i wzorce

```json
{ "id": "s_1", "nazwa": "Styczeń", "sekcja": "sek_1", "wzorce": "z_sekcji", "tlo": null, "seria": "se_dni", "obiekty": [ ... ] }
```

- `wzorce`: `"z_sekcji"` (domyślnie – wzorce sekcji), lista identyfikatorów albo `[]` (bez wzorców).
- `tlo`: kolor tła strony (`"#fff8e1"`) albo `null` (białe).
- `seria`: identyfikator serii, gdy strona ma się powielać (rozdział 8). Sąsiednie strony z tą samą serią tworzą **blok** powielany razem.
- `obiekty`: elementy strony (rozdział 5), w kolejności od spodu do wierzchu.
- `prowadnice`: nieobowiązkowe `{ "x": [mm], "y": [mm] }`.
- `bok_ukladu`: w rozkładówkach – `"lewa"` albo `"prawa"`, dla którego boku ułożono elementy strony (aplikacja ustawia sama). Gdy strona trafi na drugi bok (dodanie, usunięcie, przesunięcie stron), elementy rysują się na lustrzanych miejscach względem środka strony, a przy edycji zapis przechodzi na nowy bok. Element z `"stala_pozycja": true` zostaje na miejscu.

Współrzędne elementów liczą się od **lewego górnego rogu strony po przycięciu** (bez spadu). Element na spad zaczyna się od `-spad_mm`. W rozkładówce każda strona ma własne współrzędne.

Wzorzec: `{ "id", "nazwa", "wydruk", "tlo", "lustro", "obiekty" }`. Element wzorca z `"warstwa": "nad"` leży nad treścią strony (domyślnie pod). `lustro: true` – na lewych stronach rozkładówki elementy wzorca stoją lustrzanie. W tekstach wzorca działają pola, np. `{nr}` w stopce.

## 5. Elementy na stronie

Elementy to obiekty JSON biblioteki Fabric.js 7 w postaci, w jakiej zapisuje je aplikacja. Używaj tylko tych typów (małymi literami):

| `type` | Najważniejsze pola |
|---|---|
| `textbox` | `text`, `left`, `top`, `width`, `fontSize` (mm), `fontFamily`, `fontWeight` (`normal`/`bold`), `fontStyle` (`normal`/`italic`), `fill`, `textAlign` (`left`/`center`/`right`/`justify`), `lineHeight` (mnożnik, np. 1,2), `charSpacing` (tysięczne części wysokości pisma), `underline`, `linethrough`, **`strokeWidth: 0`** |
| `rect` | `left`, `top`, `width`, `height`, `fill`, `stroke`, `strokeWidth` (mm), `rx`, `ry` (zaokrąglenie) |
| `ellipse` | `left`, `top`, `rx`, `ry` (promienie), `fill`, `stroke`, `strokeWidth` |
| `line` | `left`, `top`, `x1`, `y1`, `x2`, `y2` (względem siebie), `width`, `height`, `stroke`, `strokeWidth`, `strokeUniform: true`; linia przerywana: `strokeDashArray` (mm, np. `[3, 2]`; kropkowana `[0, 1.2]` z `"strokeLineCap": "round"`) |
| `polygon` | `left`, `top`, `points: [{ x, y }]`, `fill`, `stroke`; wielokąt foremny ma też `boki` i `gwiazda` |
| `path` | `left`, `top`, `path` (lista poleceń SVG, np. `[["M",0,0],["L",10,0]]`), `fill`, `stroke`, `strokeDashArray` jak przy `line` |
| `image` | `left`, `top`, `width`, `height` (**piksele obrazu**), `scaleX`, `scaleY`, `zasob`, `src`, `cropX`, `cropY` (piksele) |
| `group` | tylko dla tabeli (rozdział 9); zwykłych grup nie twórz – położenia ich elementów liczą się od środka grupy |

Zasady, które łatwo przeoczyć:
- `left` i `top` to **lewy górny róg** elementu w mm (aplikacja ustawia `originX`/`originY` na `left`/`top`).
- Tekst musi mieć `"strokeWidth": 0` – domyślny obrys biblioteki (1) poszerza ramkę tekstu i daje ostrzeżenie o marginesie.
- Wysokość ramki tekstu wynika z treści; `width` to szerokość ramki (tekst łamie się do niej).
- Obraz: `width`/`height` to rozmiar obrazu w pikselach, a rozmiar na stronie daje skala: `scaleX = szerokość_mm / width`. Do tego `"zasob": "<id z zasoby>"` i `"src": "zasob:<id>"`. Przez łącznik prościej: `wgraj_obraz` dodaje plik do projektu (adres https, link z Dysku Google albo Dropboxa, ZIP, kod SVG, małe dane base64, a w serwerze u siebie – plik albo folder z dysku), a `wstaw_obraz` stawia go na stronie i sam liczy skalę i przycięcie. Nazwy, usuwanie i porządkowanie: `zmien_nazwe_obrazu`, `usun_obrazy`, `podmien_obraz`, `uporzadkuj_obrazy`.
- Kształt jako ramka obrazu: `rect`, `ellipse`, `polygon` albo zamknięty `path` z polem `"zasob": "<id obrazu>"` pokazuje obraz przycięty do kształtu, zawsze wypełniający go (bez `src`). Kadr: `"obraz_kadr": { "x": 0, "y": 0, "skala": 1 }` – `x`, `y` to przesunięcie środka obrazu względem środka kształtu w ułamkach szerokości i wysokości kształtu (przycinane tak, by obraz zakrywał kształt), `skala` ≥ 1 to powiększenie ponad wypełnienie. `fill` kształtu widać pod przezroczystymi częściami obrazu, obrys i cień zostają. Obraz z danych: `"pole": { "kolumna": "plik" }` (nazwa pliku z kolumny), opcjonalnie `"kadr": "gora"`.
- Obramowanie obrazu: `stroke` (kolor, może być `rgba(…)` z kryciem), `strokeWidth` w mm z `"strokeUniform": true`, rodzaj linii `strokeDashArray` w mm (np. `[6, 4]` przerywana, `[0, 2.5]` z `"strokeLineCap": "round"` kropkowana; brak – ciągła). Zaokrąglone narożniki zwykłego obrazu: `"zaokraglenie": 6` (mm) – obraz jest przycięty, obramowanie idzie po zaokrągleniu (u kształtu z obrazem zaokrąglenie to `rx`/`ry` prostokąta).
- Miękkie krawędzie (wtapianie) obrazu i kształtu (`image`, `rect`, `ellipse`, `polygon`, `path`): `"miekkie_krawedzie": 8` – szerokość przejścia w przezroczystość w mm (brak albo 0 – ostry brzeg); `"miekkie_rodzaj": "owal"` – owalna winieta wpisana w element, bez pola – równo wzdłuż brzegu (także kształtu i przezroczystości PNG). W PDF taki element zapisuje się jako obraz z maską przezroczystości.
- Wzór jako wypełnienie kształtu (`rect`, `ellipse`, `polygon`, zamknięty `path`; nie w kształcie z obrazem): `"wzor": { "id": "kropki", "kolor": "#2f5d8a", "skala": 1, "obrot": 0 }` – powtarzalny wzór z Biblioteki (Tła i wzory) przycięty kształtem, na tle z `fill` (kolor albo przejście). `id`: `paski-poziome`, `paski-pionowe`, `paski-skosne`, `kropki`, `groszki`, `kratka`, `krata`, `jodelka`, `fale`, `zygzak`, `romby`, `gwiazdki`, `kwiatki`, `plaster-miodu`, `luski`, `trojkaty`, `krzyzyki`, `kola`; `kolor` – kolor wzoru; `skala` 0,25–4 (1 = jak w Bibliotece); `obrot` w stopniach. Wzór w PDF zostaje wektorowy.
- Filtry obrazu (bez zmiany pliku): `"filtry": { "jasnosc": 0, "kontrast": 0, "nasycenie": 0, "szarosc": false, "sepia": false, "rozmycie": 0 }` – wartości −100…100 (rozmycie 0–100); pomijaj te, których nie zmieniasz.
- Kolory: `#rrggbb`. Przejście kolorów: `fill: { "type": "linear", "gradientUnits": "percentage", "coords": { "x1": 0, "y1": 0, "x2": 1, "y2": 0 }, "colorStops": [{ "offset": 0, "color": "#06d6a0" }, { "offset": 1, "color": "#ef476f" }] }` (albo `"type": "radial"`). Kolor przejścia może być półprzezroczysty: `"color": "rgba(6,214,160,0.4)"`.
- Obrót: `angle` (stopnie). Przezroczystość: `opacity` (0–1).
- **Kolory projektu i druku.** Kolor dodatkowy (spot) z `kolory_dodatkowe` wpisujesz w `fill`/`stroke` (także w `styles` fragmentu) jako jego kolor ekranu w danym odcieniu: dla `cmyk = [c, m, y, k]` i odcienia `t` (0–1) to `#rrggbb` z `r = 255·(1 − c·t/100)·(1 − k·t/100)`, `g = 255·(1 − m·t/100)·(1 − k·t/100)`, `b = 255·(1 − y·t/100)·(1 − k·t/100)` (zaokrąglone). Ten dokładny kod PDF zamienia na płytę o nazwie koloru. Uszlachetnienie elementu: `"uszlachetnienie": "uv" | "folia" | "tloczenie" | "wytloczenie" | "bialy"`, przy folii `"folia": "zloto" | "srebro" | "miedz"` – element drukuje się tylko na płycie uszlachetnienia (Spot_UV, Foil_Gold…, Emboss, Debossing, White), z nadrukiem; żeby mieć kolor i uszlachetnienie, zrób kopię elementu nad nim z polem `uszlachetnienie`.
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
| `stala_pozycja` | `true` – w rozkładówkach nie przechodzi na lustrzane miejsce, gdy strona zmieni bok (lewa ↔ prawa) |
| `warstwa` | we wzorcu: `"nad"` – nad treścią strony |
| `bez_ostrzezen` | `true` – bez uwag o marginesie i spadzie |
| `ramka_h` | stała wysokość ramki tekstu (mm) |
| `wyrownanie_pion` | w ramce o stałej wysokości: `gora`, `srodek`, `dol` |
| `autodopasowanie`, `rozmiar_bazowy`, `min_rozmiar` | zmniejszanie tekstu, gdy nie mieści się w `ramka_h`: `rozmiar_bazowy` (mm) to rozmiar zadany, `min_rozmiar` – najmniejszy, **w punktach** |
| `lista`, `lista_start` | `punkty`, `kreski` albo `numery` przed akapitami; `lista_start` – pierwszy numer |
| `wielkosc_liter` | `wielkie`, `male`, `kapitaliki` – tylko wygląd, treść zostaje |
| `watek`, `watek_nr`, `lacznik` | tekst płynący przez kilka ramek – lepiej połączyć ramki w edytorze („Dodaj ramkę z ciągiem dalszym”); tego opis nie sprawdza |
| `auto_strony` | `true` – wątek dokłada strony (z kopią ramki w tym samym miejscu), aż cały tekst się zmieści; ustawia się w edytorze. Akapit od nowej strony: w stylu znaku pierwszego znaku akapitu `nowa_strona: true` (z `deltaY: 0`) |
| `z_tabeli` | Treść z tabeli (słowniczek, indeks): `{ tabela: id, wzor: { text, styles }, poczatki, odcisk, edycja? }` w pierwszej ramce wątku – wzór wpisu z polami kolumn w klamrach powtórzony dla każdego wiersza tabeli; tekst ramek układa aplikacja (po zmianie danych sama), z `auto_strony`. Zmieniaj dane tabeli albo `wzor`, nie tekst ramek. Na stronie pola `{pierwszy:kolumna}`, `{ostatni:kolumna}`, `{pierwsza_litera:kolumna}`, `{ostatnia_litera:kolumna}` – wpisy, które na niej stoją |
| `pole` | obraz z danych (rozdział 8) |
| `z_danych` | kolor, położenie, obrót, rozmiar i widoczność z danych (rozdział 8) |
| `tabela` | tabela jako jeden element (rozdział 9) |
| `kod` | kod QR albo kod kreskowy EAN-13 / ISBN (niżej, „Kody”) |
| `bez_pol` | `true` – klamry w tym tekście to zwykły tekst |
| `dziel_wyrazy` | `true` – dzielenie wyrazów po polsku (łącznik na końcu wiersza tylko w wyglądzie, treść bez zmian); `dziel_min` (najkrótszy dzielony wyraz, 5), `dziel_przed` / `dziel_po` (najmniej liter przed i po łączniku, 2) |
| `zasady_pl` | Polskie zasady składu (PN-83/P-55366) – **włączone, gdy pola nie ma**; `false` wyłącza. Krótkie słówka (w, i, z, do, na, że…) nie zostają na końcu wiersza – bez twardych spacji; ostatni wiersz akapitu nie jest jednym krótkim wyrazem; wiersz nie łamie się po skrótach (np., tj., ul., dr…), inicjałach, między liczbą a jednostką/datą/dalszymi cyframi ani przed myślnikiem; z `dziel_wyrazy` – najwyżej 3 dzielone wiersze pod rząd, bez dzielenia ostatniego wyrazu akapitu i wyrazów od wielkiej litery; przy `textAlign: "justify"` odstępy mogą się ścisnąć o 20 %; tytuł nie zostaje sam na końcu ramki wątku (tytuł: krótki akapit, do 2 wierszy i 140 znaków, bez `.` `:` `;` `,` na końcu, cały pogrubiony albo większy niż pismo ramki – albo nagłówek hasła: jeden wiersz, do 80 znaków, bez znaku końca zdania, pierwszy wyraz pogrubiony albo większy i bez dwukropka, reszta też wyróżniona – pogrubiona, większa albo mniejsza, np. „Ewangelia Mk 1:1” z drobnym odnośnikiem); ramki wątku na lewej i prawej stronie tej samej rozkładówki (o tej samej wysokości) kończą się na równej wysokości tekstu (wyrównanie łamów). Wartości z tabel wstawiane w pola dostają w druku poprawne znaki („”, –, …, pojedyncze spacje), chyba że tekst ma `znaki_bez_zmian: true` |
| `znaki_bez_zmian` | `true` – przy polskich zasadach znaki zostają jak są: bez poprawiania cudzysłowów, półpauz, wielokropków i spacji po pisaniu i w wartościach z tabel |
| `lamanie_akapitu` | `true` – wiersze akapitu dobierane razem (kompozytor akapitu, Knuth–Plass): równiejsze odstępy, mniej dzielonych wyrazów; akapit z oblewaniem, inicjałem albo tabulatorami łamie się wiersz po wierszu. Nowe teksty mają `true` |
| `spojniki` | `true` – jednoliterowe spójniki i przyimki (a, i, o, u, w, z) nie zostają na końcu wiersza; `"dwuliterowe"` – także do, na, od, po, we, za, ze, że… Nowe teksty mają `true` |
| `wdowy` | najmniej wierszy akapitu na końcu i początku ramki przy tekście płynącym przez ramki (2 albo 3; brak – bez pilnowania). Nowe teksty mają 2 |
| `inicjal` | 2–5 – pierwsza litera pierwszego akapitu jako inicjał na tyle wierszy; `inicjal_czcionka`, `inicjal_kolor` (domyślnie jak tekst) |
| `tabulatory` | `[{ "poz": 70, "rodzaj": "prawy", "wypelniacz": "." }]` – pozycje (mm od lewej krawędzi ramki), `rodzaj`: `lewy`, `srodek`, `prawy`, `dziesietny`; `wypelniacz`: `""`, `"."`, `"-"`, `"_"`. W treści znak `\t`; bez pozycji tabulator skacze co 12,5 mm |
| `do_siatki` | `true` – wiersze na siatce linii bazowych sekcji (`wydruk.siatka_bazowa`, rozdział 3) |
| `oblewanie`, `oblewanie_odstep` | dowolny element poza tekstem: `prostokat` (tekst opływa ramkę), `ksztalt` (elipsa, wielokąt, ścieżka – opływa kształt), `skok` (tekst przeskakuje pod element); odstęp w mm (domyślnie 2) |
| `bez_oblewania` | tekst: `true` – nie opływa innych elementów |
| `link` | adres klikalny w PDF do czytania na ekranie (#131C): `"https://…"`, `"mailto:…"`, `"tel:…"` (bez schematu – `www.…` dostaje `https://`). Działa dla każdego elementu (cały jego obszar); kod QR z adresem jest klikalny sam |
| `z_importu` | opis uproszczenia przy odczycie pliku z innego programu (IDML, SLA, DOCX…) – tylko do odczytu, pokazywany w „Sprawdź przed drukiem” |
| `czesc`, `skladanka` | składanka (sekcja typu `skladanka`): `czesc` – definicja części modelu z papieru na grupie (obrys, krawędzie z zakładkami i numerami par, zgięcia, miejsca i linie klejenia, szczeliny); `skladanka` – rola elementu w grupie części (ściana, zgięcie, zakładka…). Rysunek części buduje aplikacja z `czesc` – części najlepiej robić w edytorze (Szablon, Część, Model 3D) |
| `na_czesci` | `true` – element (tekst, obraz, kształt) jest treścią ściany części składanki: leży w grupie części, przesuwa się, obraca i składa razem z nią, przycięty do jej obrysu |
| `ksztalt_tekstu` | tekst po kształcie albo wygięty (#131B): `{ "rodzaj": "luk", "zgiecie": 50 }`. `rodzaj`: `luk` (`zgiecie` −100…100, ujemne – łuk w dół; `promien` mm, 0 – sam), `okrag` (`promien`, `przesuniecie` – obrót początku w stopniach, `strona`: `zewn` – litery na zewnątrz u góry, `wewn` – do środka u dołu), `elipsa` (`promien`, `zgiecie` 0…100 – spłaszczenie, `przesuniecie` w %), `sciezka` (`d` – ścieżka SVG w mm względem środka tekstu, `przesuniecie` w %, `wyrownanie`: `lewo` / `srodek` / `prawo`, `strona`: `zewn` – nad linią, `wewn` – pod, `odwroc`: `true`), wygięcia `luk_gora`, `luk_dol`, `wypuklosc`, `wkleslosc`, `fala`, `flaga`, `zwezenie` (siła w `zgiecie`). Tekst jest jednym wierszem; `width` i `height` elementu aplikacja liczy sama z liter po kształcie. Usunięcie pola (null) – tekst prosto |

## 6. Style tekstu

```json
{ "id": "st_tytul", "nazwa": "Tytuł", "fontFamily": "Playfair Display", "fontSize": 9.878, "fontWeight": "bold",
  "fontStyle": "normal", "underline": false, "linethrough": false, "lineHeight": 1.1, "charSpacing": 0, "fill": "#1a1a1a", "textAlign": "left" }
```

Styl może zawierać też ustawienia składu (`dziel_wyrazy`, `spojniki`, `zasady_pl`, `wdowy`, `do_siatki`, `inicjal`, `tabulatory`…) – `null` znaczy „wyłączone”.

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

### Dymek (#360)

```json
{ "type": "dymek", "tekst": "Gdzie jest skarb?", "left": 30, "top": 40, "ogonek": { "x": 42, "y": 75 }, "rodzaj": "mowa" }
```

- Jeden element: ramka tekstu (`textbox`) z opisem `dymek` – dymek wokół rysuje aplikacja i rośnie razem z tekstem (dłuższy tekst = wyższy dymek; szerokość to `width`, bez niej – z długości tekstu, najwyżej 60 mm).
- `rodzaj`: `mowa` (owal z ogonkiem), `mysl` (chmurka z kółkami), `krzyk` (wybuch z kolcami), `szept` (owal z przerywanym obrysem), `narracja` (prostokątna ramka bez ogonka).
- `ogonek`: punkt **na stronie** (mm), w który celuje ogonek – np. usta postaci; bez niego dymek nie ma ogonka. W zapisie strony ogonek jest względem lewego górnego rogu ramki tekstu (`dymek.ogonek`), więc jedzie razem z dymkiem.
- Opcjonalnie: `width`, `fontSize`, `fontFamily`, `fill` (kolor tekstu), `wypelnienie`, `obrys`, `grubosc` (mm). Zmiana tekstu: `zmien_elementy` z `text`; zmiana rodzaju albo ogonka: `zmien_elementy` z `dymek`.
- Dymek postawiony ze scenariusza („Ustaw dymki”) ma `z_dialogu`: `{ "tabela": id tabeli, "klucz": "strona|kadr|postać|która kwestia", "wiersz": nr }` – po zmianie tekstu w tabeli ponowne „Ustaw dymki” zmienia tylko tekst tego dymka, jego miejsce zostaje. Nie zmieniaj tego pola.

### Komiks (#364)

- Sekcja typu `komiks` (pole `typ` sekcji) ma pasek narzędzi komiksu. **Kadr** to `polygon` z polem `kadr_nr` (numer w kolejności czytania na stronie: rzędami od góry, w rzędzie od lewej) – białe tło, czarny obrys 0,6 mm, leży pod obrazami i dymkami. Może być ramką obrazu jak każdy kształt (`zasob`).
- **Scenariusz** to tabela z kolumnami `strona`, `kadr`, `postać`, `tekst`, `rodzaj` (`mowa`, `mysl`, `krzyk`, `szept`, `narracja`), `opis sceny`; wersje językowe – kolumny `tekst_pl`, `tekst_en`, `tekst_uk`. `strona` 1 to pierwsza strona sekcji komiksu (okładka się nie liczy).

Pozostałe elementy Biblioteki nie mają skrótu – to zwykłe elementy, które zapiszesz sam:
- **Kalendarz roczny** z Planera to `group` tekstów: rok, nazwa każdego miesiąca i po jednym `textbox` na kolumnę dnia tygodnia (skrót dnia i liczby w kolejnych wierszach, `"textAlign": "center"`).
- **Planer** (lista zadań, tracker nawyków, plan tygodnia i dnia, notatki w linie, siatka dni, budżet, kontakty, plan lekcji, plan miesiąca, plan posiłków, trackery nastroju, wody, czytania, dziennik modlitwy, lista życzeń, budżet miesięczny; w Formularzach – tabelka zamówienia i lista obecności) to zwykła tabela (rozdział 9): wąska pierwsza kolumna z pustymi komórkami to kratki do odhaczania, notatki w linie to tabela z jedną kolumną bez linii pionowych (`linie_komorek`).
- **Kształty, ramki, ozdobniki, etykiety, pola wyboru, kratka, kropki i linie do notatek** to `path` (ramki z otworem: `"fillRule": "evenodd"`); **linie i separatory** to `line` (przerywana i kropkowana przez `strokeDashArray`) albo `path` z dwiema liniami (podwójna).
- **Ikony, ilustracje, nagłówki i tytuły, bloki treści, infografiki, formularze, zestawy okolicznościowe i układy stron** (#162) to `group` zwykłych elementów: `textbox`, `rect`, `ellipse` i `path` (ikona i ilustracja – pojedyncza `path` z samym obrysem, `"fill": ""`, `"strokeUniform": false`). Zbudujesz je sam z tych samych elementów, np. ramka „Uwaga” = `rect` z jasnym tłem + wąski `rect` z boku + `textbox` z tytułem i treścią.
- **Tła i wzory** (#162) to `group` na całą stronę ze spadem (`left` = −spad, `top` = −spad, szerokość i wysokość strony + 2 × spad), leżąca pierwsza na stronie: `rect` w kolorze tła i jedna `path` ze wzorem (kropki, paski, kratka… – wiele kształtów w jednej ścieżce, przyciętych do strony). Przejście kolorów to `rect` z wypełnieniem-przejściem (rozdział o kolorach). Wszystko zostaje w PDF wektorowe.
- **Ramka przerywana albo kropkowana** to `path` bez wypełnienia (`"fill": ""`) z `strokeDashArray`. **Pole na zdjęcie** (koło, owal, serce, łuk…) to zamknięta `path` z jasnoszarym wypełnieniem – zdjęcie wstawisz, ustawiając jej `zasob` (jak kształtowi z obrazem). **Obramowanie strony** to `path` rozciągnięta na całą stronę (w połowie marginesów).

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
- **Przypis dolny**: w tekście pole `{przypis:<id>}` (zwykle w indeksie górnym: formatowanie fragmentu `fontSize` ≈ 0,62 × rozmiaru, `deltaY` ≈ −0,36 × rozmiaru), a treść w polu tekstu `przypisy` (`{ "<id>": "Treść przypisu." }`). Numer i treść na dole strony układa aplikacja; numeracja według `ksiazka.przypisy` projektu: `sekcja` (domyślnie), `strona`, `ciagle`.
- **Skorowidz**: hasła w polu tekstu `hasla` (`["kot", "pies"]`); skorowidz pokazuje wszystkie strony, na których słowo występuje w jakimkolwiek tekście.

## 9c. Komentarze (nie są częścią projektu)

Komentarze osób do stron leżą osobno, w bazie – nie ma ich w JSON-ie projektu ani w pliku `.makietka`, nie zmieniają `wersja` i nie trafiają do PDF. Czyta się je narzędziem `komentarze`, a dodaje przez `skomentuj` / `odpowiedz` / `rozwiaz_komentarz`. Pola komentarza:

| Pole | Znaczenie |
|---|---|
| `id`, `watek` | identyfikator; `watek` – id wątku, na który to odpowiedź (`null` – początek wątku) |
| `strona_id`, `element_id` | strona projektu i (opcjonalnie) element, którego dotyczy wątek |
| `x`, `y` | miejsce pinezki w mm od lewego górnego rogu strony (bez spadu) |
| `tresc`, `wzmianki` | treść (`@nazwa` wspomina osobę z projektu) i id wspomnianych kont |
| `autor_nazwa`, `zrodlo` | kto napisał; `zrodlo`: `konto` albo `ai` (wtedy podpisem jest opis klucza) |
| `rozwiazany`, `rozwiazal_nazwa`, `rozwiazano` | stan wątku („Rozwiąż” / „Otwórz ponownie” w aplikacji) |

Numer pinezki to kolejność wątku w projekcie (od najstarszego). Po poprawce w projekcie odpowiedz w wątku z `rozwiaz: true`.

## 9d. Plik PDF i PNG (eksport przez aplikację)

Gotowego pliku nie zapisuje się w projekcie i AI go nie składa samo – PDF (czcionki, spad, CMYK, PDF/X) rysuje aplikacja Makietki w przeglądarce użytkownika. Narzędzie `eksport_pdf` (cały projekt, sekcja albo strony; do drukarni albo na ekran; broszura i arkusze) i `eksport_png` (jedna strona) składają zlecenie: otwarta aplikacja konta klucza robi plik i wgrywa go na konto, a narzędzie zwraca link do pobrania (ważny 7 dni) z uwagami z kontroli przed drukiem. Gdy aplikacja nie jest otwarta, narzędzie zwraca link do aplikacji – daj go użytkownikowi, a potem sprawdź `stan_eksportu`. Zlecenie nie zmienia projektu ani `wersja` (działa też z kluczem tylko do czytania).

## 9e. Makieta 3D – zapisane ujęcia (`makieta`)

Okno „Makieta 3D” pokazuje projekt jako wydrukowaną rzecz. Ujęcia zapisane przyciskiem „Zapisz ujęcie” trafiają do pola projektu `makieta`: lista `ujecia` (najwyżej 40). Ujęcie nie zmienia wydruku – to tylko widok. Ujęcia zapisuje użytkownik w oknie makiety; łącznik AI pokazuje je przy czytaniu projektu, ale ich nie zmienia (`zmien_projekt` nie przyjmuje części `makieta`) – pole zostaje takie, jakie jest w projekcie. W pliku `.json` / `.makietka` składanym przez AI można je dodać. Pola ujęcia:

| Pole | Typ | Uwagi |
|---|---|---|
| `id` | tekst | niepowtarzalny w projekcie |
| `nazwa` | tekst (do 80 znaków) | pokazywana na liście „Zapisane ujęcia” |
| `model` | `"ksiazka_miekka"` \| `"ksiazka_zeszytowa"` (broszura zeszytowa – zszywki w zgięciu) \| `"ksiazka_twarda"` \| `"notes"` \| `"kalendarz_scienny"` \| `"kalendarz_biurkowy"` \| `"kartka"` \| `"ulotka"` \| `"koperta"` \| `"pudelko"` \| `"trojdzielny"` \| `"skladanka"` | rodzaj makiety; ostatnie pięć tylko z sekcją takiego typu (`skladanka` – sekcja składanki: części na arkuszach, złożone i sklejony model) (ulotka, wykrojnik koperta / pudełko, trójdzielny) |
| `u` | liczba ≥ 0 | położenie kartkowania: 0 – okładka (zamknięta), 1, 2… – kolejne przewrócone kartki; ulotka: 0 złożona, 1 rozłożona (środek), 2 odwrócona; koperta: 0 przód, 1 tył, 2 otwarta klapa; pudełko: 0 wykrojnik, 1 złożone |
| `ulozenie` | `"lezy"` \| `"stoi"` | książka i notes mogą stać |
| `kamera` | `{ obrotY, obrotX, zoom, fov }` | `obrotY`, `obrotX` – obrót wokół pionu i pochylenie w radianach (`obrotX` 1,5 – z góry, 0 – z boku), `zoom` 1 – cała rzecz w kadrze, `fov` – kąt widzenia w stopniach (12–60; mały – teleobiektyw, duży – szeroki kąt) |
| `scena` | `{ otwarcie, wachlarz, ilosc, uchylenie, popup }` | `otwarcie` – kąt rozłożenia książki w stopniach (60–180, `null` – domyślny), `wachlarz` – ile kartek uniesionych wachlarzem (0–12), `ilosc` – `null` albo `{ n, uklad }` z `uklad` `"obok"` \| `"stos"` \| `"przodTyl"`, `uchylenie` – uchylona okładka zamkniętej książki (0–0,95 z 180°), `popup` – składanka pop-up: kąt otwarcia kartki z grzbietem (0–180, `null` – 90°) |
| `opcje` | obiekt | światło, tło i materiały: `tlo` (`"studio"`, `"kolor"`, `"drewno"`, `"papier"`, `"beton"`, `"marmur"`, `"tkanina"`, `"tynk"`, `"przezroczyste"`), `kolorTla` (`#rrggbb`), `swiatlo` (`"lewo"`, `"prawo"`, `"gora"`, `"okno"`), `barwa` (`"neutralna"`, `"ciepla"`, `"zimna"`), `silaCienia` (0–1,6), `miekkosc` (0–1), `wykonczenie` okładki (`"projekt"`, `"mat"`, `"blysk"`, `"soft"`), `papier` (`"bialy"`, `"kremowy"`), `kolorSpirali`, `kolorStojaka` (`#rrggbb`), `uszlachetnienia` (złocenie i lakier z projektu w świetle, domyślnie `true`) |
| `obwoluta` | wartość logiczna | twarda oprawa pokazana w obwolucie (sekcja typu `obwoluta`) |

Nieznane wartości aplikacja zamienia na domyślne (`normalizuj`).

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

### Gotowe sekcje w aplikacji

Użytkownik ma w aplikacji okno **Gotowe sekcje** (ponad 30 szablonów dokumentów: okładka książki, rozdział, kalendarz ścienny, biurkowy i roczny, planer dzienny/tygodniowy/miesięczny, notesy, trackery, zaproszenie, dyplom, certyfikat, wizytówki, ulotka, plakat, broszura składana, katalog, menu, gazetka, przepisy, album, etykiety, śpiewnik, formularz, lista kontrolna). Szablon wstawia się jako **zwykła sekcja** – strony z elementami (`textbox`, `rect`, `ellipse`, `path`, tabele i kalendarze z rozdziałów 9–9a), wzorzec z numerem strony, tabela danych i seria. Nie ma osobnego pola „szablon” w projekcie, więc AI nie musi (i nie może przez łącznik) wywołać szablonu: albo poproś użytkownika, żeby wstawił gotową sekcję z okna (przycisk [Gotowa] przy liście stron albo Biblioteka → Gotowe sekcje) i potem ją zmieniasz narzędziami łącznika, albo zbuduj taką sekcję sam według tego opisu (np. planer dzienny = jedna strona-wzór z polami `{data}`, `{dzien_tygodnia}` i seria `uklad: "dlugi"` po tabeli 365 dni).

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

## Pola tylko do odczytu

Tych pól nie ustawiaj – liczy je i zapisuje aplikacja (łącznik zachowuje wartości z projektu): `okladka.wynik` (układ okładki), `specjalna.wynik` (strefy, zgięcia i wykrojnik sekcji specjalnej), `ramka_pola` (ramka obrazu podmienionego z danych, liczona przy składaniu strony), `wersja` projektu, `z` (kolejność elementu na rozkładówce – aplikacja zapisuje ją przy dzieleniu stron), `kod.narysowano` (dla jakiej treści narysowano kod QR/EAN – po zmianie `kod.tresc` aplikacja sama przerysuje kod). Łącznik zawsze zostawia te pola takie, jakie są w projekcie, więc ich zmiana nic nie da.
