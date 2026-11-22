# Plan – AI w Makietce i tryb „Komiks”

Źródła: uwagi z 21–22.11.2026 i dokument „Makietka: komiksy z AI — projekt funkcji” (22.11.2026).

## Podział (najważniejsze)

**AI w każdym projekcie – niezależnie od komiksu.** Gdy jest klucz API, w każdym projekcie (książka, kalendarz,
planer…) działają: czat AI, generowanie obrazu (także „do ramki”), poprawki tekstu (skróć, wydłuż, zmień ton,
przetłumacz), wypełnianie kolumny tabeli. To osobna część aplikacji – komiks z niej korzysta, ale jej nie wymaga.

**Tryb „Komiks” – rzeczy typowe dla komiksu.** Typ projektu/sekcji „Komiks” z własnym paskiem narzędzi (jak składanka):
postacie i miejsca (karty z obrazem wzorcowym), gotowe prompty do obrazów składane same ze sceny, stylu i postaci,
scenariusz (tabela scen i dialogów) z wklejaniem tekstów w dymki i wyborem rodzaju dymka, kadry.

**Tryb komiksu jest ręczny i pod AI jednocześnie**: postacie, miejsca, scenariusz i dymki tworzy się ręcznie, ale ich
pola są od początku takie, z jakich AI składa prompty i jakie czyta albo wypełnia (karta postaci = opis do promptu
+ obraz wzorcowy, scenariusz = sceny z opisem kadrów i dialogami). Te same karty i ta sama tabela – ręcznie albo z AI.

**Wszystko ma być oczywiste i proste**: mało pól, rozsądne domyślne, każdy krok opisany w instrukcji (pl, en, uk)
z przykładem. Każdy punkt: test, instrukcja, DECYZJE, ZGŁOSZENIA, commit i push.

Zasady z dokumentu: użytkownik nie pisze promptów; postacie i miejsca zapisane raz działają w każdej scenie; każdy
wydatek widoczny i potwierdzany; tekst dymków zawsze w Makietce, nigdy w obrazie; cały komiks da się zrobić bez AI.

## Część A – komiks bez AI (najpierw)

| # | Co | Stan |
|---|---|---|
| A1 | **Dymek**: mowa, myśl, krzyk, szept, narracja; ogonek przeciągany uchwytem; rośnie z tekstem; skrót w łączniku | ✅ #360 |
| A2 | **Obrys tekstu** do efektów dźwiękowych („BUM!”) | ✅ był (#123) |
| A3 | **Czcionki komiksowe** (OFL): Bangers (okrzyki), Comic Neue (dialogi), Pangolin (dialogi z polskimi i ukraińskimi literami); cyrylica we wszystkich czcionkach, które ją mają. Permanent Marker odpada – nie ma polskich liter | #363 |
| A4 | Style tekstu **„Dialog”** (wersaliki – lettering) i **„Efekt dźwiękowy”** (Bangers z obrysem); dymki domyślnie w stylu „Dialog” | ✅ #367 (też przycisk [Efekt]; po ukraińsku Pangolin) |
| A5 | **Tryb „Komiks”**: szablon projektu i typ sekcji z paskiem narzędzi (Dymek, Kadry, Podziel kadr, Scenariusz, Postacie) | ✅ #364 (bez „Postacie” – A9) |
| A6 | **Kadry**: gotowe układy 1–9 kadrów z rynną, podział kadru przeciągnięciem (także ukośny), kadr na spad, obraz w kadrze (przeciągnięcie pliku na ramkę), postać wychodząca poza kadr | ✅ #362, #364 (układy, podział dwoma kliknięciami, spad; obraz w kadrze jak w każdym kształcie) |
| A7 | **Scenariusz**: tabela (strona, kadr, postać, tekst, rodzaj dymka; opcjonalnie opis sceny, miejsce) – wklejasz z CSV albo wpisujesz; przycisk **„Ustaw dymki”** stawia dymki; poprawka scenariusza zmienia tylko tekst, przesunięte dymki zostają; rodzaj dymka wybierasz w tabeli albo na dymku | ✅ #361, #364 |
| A8 | **Wersje językowe**: kolumny tekst_pl / tekst_uk / tekst_en – wybór kolumny, ten sam układ | ✅ #361, #364 |
| A9 | **Postacie i miejsca**: karty (imię, wygląd, znak rozpoznawczy, charakter, obraz wzorcowy, kolor dymka; miejsce: opis, pora dnia, światło, obraz) – na razie z obrazami wgranymi ręcznie | ✅ #368 (karty = tabele Postacie i Miejsca) |
| A10 | **Import stron**: ZIP albo wiele plików (`01.png` → strona 1 na spad, `s03-k2.png` → kadr 2 na stronie 3) | ✅ #369 |
| A11 | **Mostek** między dymkami jednej postaci; **webtoon** (długi pasek, PNG 800 px); **rastry i linie ruchu** w bibliotece wzorów | ✅ #371 |
| A12 | **Kontrola komiksu**: tekst w dymku < 7 pt, dymek przecina rynnę albo wchodzi w spad, ogonek poza kadrami, pusty kadr | ✅ #370 |

Po A7 da się robić pełne komiksy z obrazami z dowolnego generatora.

## Część B – AI w każdym projekcie

| # | Co | Stan |
|---|---|---|
| B1 | **Klucz Gemini po stronie serwera** (Supabase Edge Function, zaszyfrowany; własny klucz albo klucz właściciela rozliczany poza aplikacją) + instrukcja „jak zdobyć klucz” z obrazkami | klucz z sejfu (#241) w przeglądarce ✅ #372; klucz właściciela na serwerze – później; instrukcja „jak zdobyć klucz” ✅ 7.11 |
| B2 | **Koszty**: ceny w konfiguracji, potwierdzenie przed każdym generowaniem („3 obrazy, ok. 1,50 zł – generować?”), licznik (obraz, projekt, miesiąc), miesięczny limit wydatków | ✅ #372 (obrazy; teksty – przy B4) |
| B3 | **Generuj obraz** / **Generuj do ramki**: opis po polsku, proporcje z ramki, wynik w obrazach projektu; przy obrazie prompt, model i wersje (powrót jednym kliknięciem); **popraw obraz** (edycja fragmentu zamiast losowania od nowa) | ✅ #372 (bez „popraw fragment” – później) |
| B4 | **Tekst**: skróć, wydłuż, zmień ton, przetłumacz (pl/uk/en) na zaznaczonym tekście; **wypełnij kolumnę tabeli** | ✅ #373 |
| B5 | **Czat AI** (jest, #241) z Gemini: te same narzędzia co łącznik MCP + generowanie obrazów; generowanie zawsze po potwierdzeniu kosztu | ✅ #376 (generuj_obraz, rysuj_kadry, ustaw_dymki, szacuj_koszt; zgoda z kwotą) |
| B6 | Te same narzędzia w **łączniku MCP** (Claude, ChatGPT) – generowanie wykonuje serwer kluczem z B1 | do zrobienia – generowanie w łączniku przez kolejkę otwartej aplikacji (jak eksport) albo klucz na serwerze |

## Część C – AI w trybie komiksu (na częściach A i B)

| # | Co | Stan |
|---|---|---|
| C1 | **Gotowe style** z miniaturami (kolorowa bajka, akwarela, prosty cartoon) – zapisany w projekcie | ✅ #374 (bez miniatur stylów) |
| C2 | **Wzorce postaci i miejsc** z karty (Nano Banana Pro) | ✅ #374 (szkic 1K; Pro do wyboru w oknie Obraz AI) |
| C3 | **Strona ze sceny**: prompt składa Makietka (styl, układ kadrów, kto/co/emocja/plan w każdym kadrze, miejsce i światło, obrazy wzorcowe postaci i miejsca, „no text, leave space for speech bubbles”); najpierw szkic 1K, zaakceptowana w 2K albo Pro | ✅ #374 – kadry strony osobno (nie cała strona jednym obrazem); szkic, potem Dokładny |
| C4 | **Pomysł → scenariusz** w czacie: 3–5 zdań, pomocnik dzieli na sceny i dialogi, poprawki zwykłymi słowami | ✅ #375 (osobne okno „Scenariusz z AI”, nie w czacie) |
| C5 | Funkcje czatu i łącznika: `ustaw_scenariusz`, `zapisz_postac`, `zapisz_miejsce`, `generuj_wzorzec`, `generuj_strone`, `popraw_kadr`, `ustaw_dymki`, `szacuj_koszt`; kontekst czatu: lista scen, postacie (imię + znak), styl, bieżąca strona | ✅ #376 w czacie (karty i scenariusz – narzędzia tabel); w łączniku MCP – z B6 |
| C6 | **Import scenariusza z dokumentu** (TXT, DOCX, Markdown, Google Docs jako DOCX – odczyt już jest, #216): AI rozpoznaje układ dokumentu i rozpisuje go na sceny/strony, kadry, dialogi (kto, tekst, rodzaj dymka) oraz listę postaci i miejsc; podgląd do poprawienia przed zapisem; wynik w tabeli scenariusza i w kartach postaci. Osobna droga obok „od pomysłu do komiksu” | ✅ #375 |
| C7 | **Pomiar zużycia** na prostym komiksie (np. 3 strony, 2 postacie): koszt tekstu i obrazów w zł – do instrukcji i do szacunków w aplikacji | ✅ #375: 3 strony × 3 kadry + 2 wzorce = 1,51 zł, 49 s (szkic) |

## Część D – uwagi właściciela z 22.11 (noc), po pierwszej wersji

Cytaty (skrót): „Limit… możesz nawet 20 zł zużyć, jeżeli to pomoże dobrze przetestować” · „użytkownik nie powinien widzieć
tych wszystkich technicznych danych” · „przystępne dla prostego użytkownika i ładne” · „Komiks to nie zawsze książka…
wybrać tryb: książka, broszura albo zwykłe kartki, a dodatkowo, że to będzie komiks… przy broszurze sugestia okładki,
w podglądzie ładniej… albo prezentacja / PDF – komiks elektroniczny” · „sprawdzić czat Makietki – czy rozwiązuje polecenia
i generuje obrazy w Gemini” · „ujęcia / lokalizacje – wgrywać albo generować obrazki z lokalizacją, postacie pojawiają się
na tych obrazkach” · „różne zbliżenia: widok ogólny, zbliżenie na postać… opisać w scenariuszu i potem używać” · „przy
kluczach API zaznaczyć: tylko tekstowe albo tekst i obrazy; wszystkie tekstowe zmieniają elementy przez API Makietki” ·
„3 takie same ikonki na czat – zmienić” · „w trybie komiksu za dużo narzędzi – połączyć albo schować” · „okno scenariusza,
postaci, lokalizacji łączą się w spójną całość – scenariusz wie, jaka lokalizacja, zbliżenie, postacie” · „nie podoba się
obrazek – wygeneruj ponownie i wiadomo, z jakiego promptu” · „na koniec instrukcja: wszystkie kroki dokładnie; także
teksty, tłumaczenie i obrazy w zwykłych trybach”.

| # | Co | Stan |
|---|---|---|
| D1 | Budżet płatnych testów: do ok. 20 zł, gdy to naprawdę pomaga przetestować (rejestr w docs/KOSZTY-TESTOW.md) | ✅ przyjęte – wydane ok. 2,55 zł |
| D2 | **Bez technicznych danych dla użytkownika**: w oknach nie ma nazw modeli, tokenów, „1K/2K”, angielskich promptów; jakość opisana słowami; opis obrazu pokazywany po polsku (prompt techniczny tylko wewnątrz) | do zrobienia |
| D3 | **Komiks jako dodatek do rodzaju publikacji**: przy nowym projekcie wybór formy – książka, broszura (z sugestią okładki), zwykłe kartki, prezentacja / PDF na ekran (komiks elektroniczny) – i przełącznik „To komiks” (sekcja komiksu, pasek, scenariusz) | ✅ #379 |
| D4 | **Sprawdzić czat Makietki z Gemini na żywo**: czy wykonuje polecenia (zmiany elementów przez narzędzia) i generuje obrazy | ✅ #380 (3 błędy znalezione i poprawione) |
| D5 | **Lokalizacje jako tła/ujęcia**: obraz lokalizacji wgrany albo wygenerowany; postacie pojawiają się na tym tle w kadrach (obraz miejsca jako odniesienie) | częściowo (#374 – obraz miejsca jako odniesienie) |
| D6 | **Ujęcia w scenariuszu**: kolumna „ujęcie” – widok ogólny, plan średni, zbliżenie na postać, z góry, zza pleców…; lista do wyboru; używane w opisie kadru | ✅ #378 |
| D7 | Przy kluczach AI: oznaczenie modelu „tylko tekst” / „tekst i obrazy”; każdy model tekstowy zmienia projekt przez narzędzia Makietki | ✅ #380 |
| D8 | Trzy jednakowe ikony czatu – różne ikony i jasne nazwy | ✅ #377 |
| D9 | **Mniej narzędzi w pasku komiksu**: kilka głównych przycisków, reszta w menu („Więcej”), kroki w logicznej kolejności | ✅ #377 (Kadry, Dymek ▾, Komiks; AI ▾) |
| D10 | **Spójna całość**: scenariusz, postacie, miejsca i ujęcia połączone – w scenariuszu wybór postaci/miejsca/ujęcia z list (z kart), jedno okno „Komiks” z zakładkami albo kroki | ✅ #377–#378 (okno Komiks + okno Scenariusz z listami z kart) |
| D11 | **Ponowne generowanie z zapisanego opisu**: przy obrazie kadru widać, z czego powstał (po polsku), „Narysuj jeszcze raz” bez składania od nowa; edycja opisu | ✅ #378 (opis przy obrazie kadru, „Opis ze scenariusza”, miniatura) |
| D12 | **Instrukcja na koniec**: wszystkie kroki komiksu dokładnie; osobno teksty AI, tłumaczenie i obrazy AI w zwykłych projektach | do zrobienia |

## Koszty (szacunek z dokumentu; ceny w konfiguracji)

| Pozycja | Szacunek |
|---|---|
| Wzorce 4 postaci i 5 miejsc (Pro, z poprawkami) | ok. 20 obrazów, ok. 2,60 $ |
| 50 stron: szkic 1K + wersja 2K, średnio 3 obrazy na stronę | ok. 150 obrazów, ok. 6–8 $ |
| Kilka stron kluczowych w Pro | ok. 10 obrazów, ok. 1,30 $ |
| Czat i scenariusz | grosze |
| **Razem** | **ok. 10–12 $ (ok. 40–50 zł)** |

**Testy z prawdziwym kluczem**: najwyżej ok. 5 zł z budżetu właściciela (ok. 40 zł) – głównie teksty, obrazy oszczędnie (tańszy model, 1K), każde wywołanie zapisane z kosztem, po przekroczeniu limitu testy stają. **Odbiorca to laik**: jedno okno na raz, rozsądne domyślne, każdy krok w instrukcji z przykładem; na końcu przejście całego komiksu jak użytkownik.

Treści, które muszą być dokładne (np. wersety), zawsze ze źródła, nie z generatora.
