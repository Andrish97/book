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
| D2 | **Bez technicznych danych dla użytkownika**: w oknach nie ma nazw modeli, tokenów, „1K/2K”, angielskich promptów; jakość opisana słowami; opis obrazu pokazywany po polsku (prompt techniczny tylko wewnątrz) | ✅ #377–#381 (okna i instrukcja bez nazw modeli; jakość słowami) |
| D3 | **Komiks jako dodatek do rodzaju publikacji**: przy nowym projekcie wybór formy – książka, broszura (z sugestią okładki), zwykłe kartki, prezentacja / PDF na ekran (komiks elektroniczny) – i przełącznik „To komiks” (sekcja komiksu, pasek, scenariusz) | ✅ #379 |
| D4 | **Sprawdzić czat Makietki z Gemini na żywo**: czy wykonuje polecenia (zmiany elementów przez narzędzia) i generuje obrazy | ✅ #380 (3 błędy znalezione i poprawione) |
| D5 | **Lokalizacje jako tła/ujęcia**: obraz lokalizacji wgrany albo wygenerowany; postacie pojawiają się na tym tle w kadrach (obraz miejsca jako odniesienie) | ✅ #374, #378 (obraz miejsca z karty – wgrany albo narysowany – jest tłem kadru; miejsce wybierane w scenariuszu) |
| D6 | **Ujęcia w scenariuszu**: kolumna „ujęcie” – widok ogólny, plan średni, zbliżenie na postać, z góry, zza pleców…; lista do wyboru; używane w opisie kadru | ✅ #378 |
| D7 | Przy kluczach AI: oznaczenie modelu „tylko tekst” / „tekst i obrazy”; każdy model tekstowy zmienia projekt przez narzędzia Makietki | ✅ #380 |
| D8 | Trzy jednakowe ikony czatu – różne ikony i jasne nazwy | ✅ #377 |
| D9 | **Mniej narzędzi w pasku komiksu**: kilka głównych przycisków, reszta w menu („Więcej”), kroki w logicznej kolejności | ✅ #377 (Kadry, Dymek ▾, Komiks; AI ▾) |
| D10 | **Spójna całość**: scenariusz, postacie, miejsca i ujęcia połączone – w scenariuszu wybór postaci/miejsca/ujęcia z list (z kart), jedno okno „Komiks” z zakładkami albo kroki | ✅ #377–#378 (okno Komiks + okno Scenariusz z listami z kart) |
| D11 | **Ponowne generowanie z zapisanego opisu**: przy obrazie kadru widać, z czego powstał (po polsku), „Narysuj jeszcze raz” bez składania od nowa; edycja opisu | ✅ #378 (opis przy obrazie kadru, „Opis ze scenariusza”, miniatura) |
| D12 | **Instrukcja na koniec**: wszystkie kroki komiksu dokładnie; osobno teksty AI, tłumaczenie i obrazy AI w zwykłych projektach | ✅ #381 (10.13, 5.17, 7.11, 25.6 w pl/en/uk, nowe zrzuty) |

## Część E – uwagi właściciela z 22.11 (rano), po części D

Słowa właściciela (skrót): „chodzi mi o to, że informacje o kosztach teoretycznych umieścić w ustawieniach AI w ustawieniach konta, a narzędzia trzeba rozwinąć – żeby nie było menu (ewentualnie na telefonie), tylko były rozwinięte na pasku” · „[AI ▾] – rozwiń, żeby AI miało tam też przyciski” · „jak mieć dostęp do innych rzeczy
(komiksu)? Może biblioteka niech będzie?” · „czy warto dla sceny dodać osobno emocje i działania postaci?” · „nie powinien
pytać o zgodę [na koszt] – raczej informujemy użytkownika w sekcji dodawania kluczy, ile mniej więcej to kosztuje” ·
„możesz zrobić rzeczy dodatkowe, które pominąłeś”.

| # | Co | Stan |
|---|---|---|
| E1 | Narzędzia rozwinięte na pasku (osobne przyciski AI i dymków), menu ▾ tylko na telefonie; koszty orientacyjne w ustawieniach AI (doprecyzowanie właściciela: „chodzi o ustawienia AI, nie o menu”) | ✅ #384–#385 |
| E2 | Komiks w Bibliotece: kategoria „Komiks” – dymki, efekty, układy kadrów, raster i linie ruchu, skróty do okien komiksu | ✅ #386 |
| E3 | Emocje i działania postaci w kadrze: przy każdej postaci w kadrze – emocja (lista) i co robi; idą do opisu obrazu i do scenariusza z AI | ✅ #385 |
| E4 | Bez pytania o zgodę na koszt (czat i narzędzia): koszt orientacyjny w ustawieniach AI przy kluczach; limit miesięczny zostaje jako bezpiecznik | ✅ #384 |
| E5 | Dodatkowe: „popraw obraz” w czacie, miniatury stylów rysunków, cała strona komiksu jednym obrazem, obrazy w łączniku MCP (B6) | ✅ #387 (bez B6 – obrazy w łączniku MCP zostają na później) |

## Część F – uwagi właściciela z 22.11 (przedpołudnie), po części E

Słowa właściciela: „Pozostałe narzędzia, takie jak kształty i inne, właśnie trzeba zwinąć. A narzędzia generowania schować
gdzieś też albo zwinąć – chodzi o pojedyncze narzędzia, które generują obrazy albo tekst. Nie wiem, czy z AI nie umieścić
w innym miejscu samego przycisku, który rozmawia bezpośrednio z AI i prosi np. o układ. Jeśli dla danego klucza
niedostępne np. obrazy, to przyciski mają być wyszarzone; użytkownika trzeba poinformować, że nie ma klucza do
generowania obrazów. Typy dymków mogą być w jednym przycisku. Zorganizuj lepiej przestrzeń. Dodaj więcej stylów, jeżeli
da się. Możesz dodać rekwizyty postaci, żeby one były też dodawane.”

| # | Co | Stan |
|---|---|---|
| F1 | Kształty (prostokąt, elipsa, wielokąt, linia) w jednym przycisku [Kształt ▾]; rysowanie (ołówek, pióro) w [Rysuj ▾] | ✅ #388 |
| F2 | Generowanie (obraz, poprawka, tekst, kolumna; w komiksie scenariusz i kadry) z powrotem w [AI ▾]; „Asystent AI” (rozmowa) jako osobny, widoczny przycisk na górnym pasku | ✅ #388 |
| F3 | Bez klucza Google Gemini pozycje generowania wyszarzone, z informacją „nie masz klucza do generowania obrazów/tekstów” i drogą do ustawień | ✅ #388 |
| F4 | Typy dymków w jednym przycisku [Dymek ▾] (rodzaje, efekt, mostek) – także na komputerze | ✅ #388 |
| F5 | Więcej stylów rysunków (z miniaturami) | ✅ #389 |
| F6 | Rekwizyty: karty rekwizytów (nazwa, opis, obraz wzorcowy, czyj), wybierane w kadrze w scenariuszu, w opisie i wzorcach dla AI | ✅ #389 |

## Część G – uwagi właściciela z 22.11 (popołudnie)

Słowa właściciela: „Muszę zgadywać model, a laik nie zna raczej nazw modeli. Najlepiej mieć w Makietce obie drogi:
1. »Generuj« w Makietce jako główna, wygodna droga; 2. szybki import z zewnątrz (przeciągnięcie plików albo ZIP do
kadrów) dla kogoś, kto chce korzystać z darmowych kredytów Flow albo Gemini, albo ma własne rysunki. Czy mamy obie
opcje? Również scenariusz bez AI itd.?” Wcześniej: „Czy łącznik ma dostęp do generowania obrazów?” (nie – B6).

| # | Co | Stan |
|---|---|---|
| G1 | Model bez zgadywania: puste pole = zalecany model dostawcy (najnowszy szybki), na liście „Zalecany / Najtańszy / Najlepszy” | ✅ #390 |
| G2 | Import z zewnątrz: pliki bez numeru (np. z Gemini/Flow) po kolei do pustych kadrów; przeciągnięcie kilku plików albo ZIP na stronę komiksu | ✅ #390 |
| G3 | „Kopiuj opisy kadrów” do darmowego AI; okno rysowania dostępne bez klucza (Rysuj wyszarzony) | ✅ #390 |
| G4 | Scenariusz bez AI – jest (okno Scenariusz, tabela, wklejanie z arkusza); wszystko poza rysowaniem i pisaniem przez AI działa bez klucza | ✅ (bez zmian) |

## Część H – łącznik AI: czego jeszcze nie potrafi i jak to dodać

Słowa właściciela: „Tak, dodaj [kopiowanie projektu] i opisz, czego [łącznik] nie potrafi, żeby ewentualnie dodać.”
Kopiowanie projektu – zrobione (#391). Eksport PDF i PNG działa także przy zamkniętej Makietce (serwer, #337).

| # | Czego łącznik nie potrafi | Jak to dodać | Nakład | Ryzyko / uwagi | Polecam |
|---|---|---|---|---|---|
| H1 | **Rysować obrazów** (Gemini) | Zlecenie do otwartej Makietki, jak eksport PDF: łącznik składa zlecenie „obraz” (opis, ramka, jakość), karta konta z otwartym sejfem kluczy rysuje kluczem Gemini, wgrywa obraz i wstawia go; bez otwartej karty – link „otwórz Makietkę, żeby narysować”. Serwer sam nie narysuje, bo klucz zna tylko przeglądarka. | średni | koszt bez pytania – miesięczny limit i informacja w wyniku | tak, jako pierwsze |
| H2 | **Kadry komiksu i dymki jednym poleceniem** | Ta sama kolejka co H1 (rodzaje „kadry” i „dymki”); dymki da się też ułożyć w samym łączniku, bo to obliczenia na tabeli scenariusza | średni (po H1 mały) | jak H1 | tak, po H1 |
| H3 | **Cofać zmian** | Baza zapamiętuje stan projektu przed każdą zmianą AI (np. ostatnie 20), narzędzie „cofnij_zmiane_ai” i przycisk „Cofnij zmiany AI” w aplikacji | średni | miejsce w bazie – trzymać tylko ostatnie zmiany | **zrobione (#392)** – ostatnia seria zmian AI z kopii awaryjnych; narzędzie cofnij_zmiany_ai i ⋯ → Cofnij zmiany AI… |
| H4 | **Udostępniać projektu (link do podglądu)** | Narzędzie „utworz_link” (z hasłem albo datą ważności); strony linku rysuje już serwer | mały–średni | publikacja treści – AI zawsze pyta użytkownika, a wynik pokazuje link do odebrania | tak, z potwierdzeniem |
| H5 | **Zapraszać osób do projektu** | Wersja funkcji zaproszenia dla klucza AI (adres e-mail, rola) | mały | AI wysyła e-mail do człowieka – tylko na wyraźne polecenie, z potwierdzeniem adresu | raczej nie – zostawić człowiekowi |
| H6 | **Wgrywać czcionek** | Lista czcionek dostępnych w Makietce w opis_formatu (AI wybiera z niej); własną czcionkę użytkownik wrzuca przez link_do_wgrywania | mały | – | **zrobione** – narzędzie czcionki |
| H7 | **Wstawiać elementów z Biblioteki** | Katalog Biblioteki (kalendarze, ramki, wykresy…) przeniesiony do wspólnego kodu i narzędzie „wstaw_z_biblioteki” | duży | – | później |

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
