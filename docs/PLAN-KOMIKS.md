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
| A11 | **Mostek** między dymkami jednej postaci; **webtoon** (długi pasek, PNG 800 px); **rastry i linie ruchu** w bibliotece wzorów | do zrobienia |
| A12 | **Kontrola komiksu**: tekst w dymku < 7 pt, dymek przecina rynnę albo wchodzi w spad, ogonek poza kadrami, pusty kadr | do zrobienia |

Po A7 da się robić pełne komiksy z obrazami z dowolnego generatora.

## Część B – AI w każdym projekcie

| # | Co | Stan |
|---|---|---|
| B1 | **Klucz Gemini po stronie serwera** (Supabase Edge Function, zaszyfrowany; własny klucz albo klucz właściciela rozliczany poza aplikacją) + instrukcja „jak zdobyć klucz” z obrazkami | do zrobienia |
| B2 | **Koszty**: ceny w konfiguracji, potwierdzenie przed każdym generowaniem („3 obrazy, ok. 1,50 zł – generować?”), licznik (obraz, projekt, miesiąc), miesięczny limit wydatków | do zrobienia |
| B3 | **Generuj obraz** / **Generuj do ramki**: opis po polsku, proporcje z ramki, wynik w obrazach projektu; przy obrazie prompt, model i wersje (powrót jednym kliknięciem); **popraw obraz** (edycja fragmentu zamiast losowania od nowa) | do zrobienia |
| B4 | **Tekst**: skróć, wydłuż, zmień ton, przetłumacz (pl/uk/en) na zaznaczonym tekście; **wypełnij kolumnę tabeli** | do zrobienia |
| B5 | **Czat AI** (jest, #241) z Gemini: te same narzędzia co łącznik MCP + generowanie obrazów; generowanie zawsze po potwierdzeniu kosztu | częściowo jest |
| B6 | Te same narzędzia w **łączniku MCP** (Claude, ChatGPT) – generowanie wykonuje serwer kluczem z B1 | do zrobienia |

## Część C – AI w trybie komiksu (na częściach A i B)

| # | Co | Stan |
|---|---|---|
| C1 | **Gotowe style** z miniaturami (kolorowa bajka, akwarela, prosty cartoon) – zapisany w projekcie | do zrobienia |
| C2 | **Wzorce postaci i miejsc** z karty (Nano Banana Pro) | do zrobienia |
| C3 | **Strona ze sceny**: prompt składa Makietka (styl, układ kadrów, kto/co/emocja/plan w każdym kadrze, miejsce i światło, obrazy wzorcowe postaci i miejsca, „no text, leave space for speech bubbles”); najpierw szkic 1K, zaakceptowana w 2K albo Pro | do zrobienia |
| C4 | **Pomysł → scenariusz** w czacie: 3–5 zdań, pomocnik dzieli na sceny i dialogi, poprawki zwykłymi słowami | do zrobienia |
| C5 | Funkcje czatu i łącznika: `ustaw_scenariusz`, `zapisz_postac`, `zapisz_miejsce`, `generuj_wzorzec`, `generuj_strone`, `popraw_kadr`, `ustaw_dymki`, `szacuj_koszt`; kontekst czatu: lista scen, postacie (imię + znak), styl, bieżąca strona | do zrobienia |
| C6 | **Import scenariusza z dokumentu** (TXT, DOCX, Markdown, Google Docs jako DOCX – odczyt już jest, #216): AI rozpoznaje układ dokumentu i rozpisuje go na sceny/strony, kadry, dialogi (kto, tekst, rodzaj dymka) oraz listę postaci i miejsc; podgląd do poprawienia przed zapisem; wynik w tabeli scenariusza i w kartach postaci. Osobna droga obok „od pomysłu do komiksu” | do zrobienia |
| C7 | **Pomiar zużycia** na prostym komiksie (np. 3 strony, 2 postacie): koszt tekstu i obrazów w zł – do instrukcji i do szacunków w aplikacji | do zrobienia |

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
