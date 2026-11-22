# Plan – tryb „Komiks” i generowanie AI (zgłoszenie z 21.11.2026)

Komiks to **tryb projektu** jak składanka czy makieta 3D: przy zakładaniu projektu wybiera się „Komiks”
i edytor dostaje własne narzędzia (pasek komiksu, panele). **Generowanie obrazów i tekstów działa w każdym
projekcie**, gdy w ustawieniach jest klucz API (BYOK) – nie tylko w komiksie.

Kolejność: od tego, co daje najwięcej przy najmniejszej pracy. Każdy punkt: test, instrukcja (pl/en/uk),
DECYZJE, ZGŁOSZENIA, commit i push.

## Etap A – podstawy (najpierw)

| # | Co | Stan |
|---|---|---|
| A1 | **Dymek** jako jeden element: mowa, myśl (chmurka), krzyk (zęby), szept (przerywany), narracja (prostokąt); ogonek do punktu (uchwyt), dymek rośnie z tekstem; skrót w łączniku `{type:"dymek", tekst, left, top, ogonek:{x,y}, rodzaj}` | ✅ #360 |
| A2 | **Mostek** – dwa dymki jednej postaci połączone łącznikiem | do zrobienia |
| A3 | **Obrys tekstu** (efekty dźwiękowe „BUM!”): gruby biały/czarny obrys liter pod wypełnieniem, w edytorze, obrazach i PDF; razem z tekstem po łuku | do zrobienia |
| A4 | **Czcionki komiksowe** (OFL): Bangers, Comic Neue, Permanent Marker; „lettering wersalikami” (wielkość liter: wielkie – już jest) jako domyślne w dymkach komiksu | do zrobienia |
| A5 | **Dialogi z tabeli**: kolumny strona, kadr, postać, tekst, rodzaj dymka; scenariusz jako CSV → dymki na stronach w kadrach (potem tylko przesunąć) | do zrobienia |

## Etap B – tryb „Komiks”

| # | Co | Stan |
|---|---|---|
| B1 | Typ projektu / sekcji „Komiks” z własnym paskiem narzędzi (dymki, kadry, efekty) – jak składanka | do zrobienia |
| B2 | **Siatka kadrów z rynną**: podział strony przeciągnięciem, stały odstęp; kadry na spad, ukośne cięcia, postać wychodząca poza kadr (obraz nad krawędzią) | do zrobienia |
| B3 | **Webtoon**: jedna długa pionowa strona, eksport cięty na PNG 800 px (bez druku) | do zrobienia |
| B4 | **Rastry i efekty** w bibliotece wzorów: raster kropkowy (screentone), linie ruchu, linie skupienia | do zrobienia |
| B5 | **Wersje językowe**: kolumny tekst_pl / tekst_uk / tekst_en – przełączasz język wydania i eksportujesz | do zrobienia |
| B6 | **Biblioteka postaci i teł** w projekcie (wycięte postacie, lokacje) + strona „karta postaci” | do zrobienia |
| B7 | **Kontrola przed drukiem komiksu**: tekst w dymku poniżej ~7 pt, dymek przecina rynnę albo wchodzi w spad, ogonek nie wskazuje kadru, pusta ramka kadru | do zrobienia |

## Etap C – generowanie AI (w każdym projekcie, z kluczem API)

| # | Co | Stan |
|---|---|---|
| C1 | **Klucz użytkownika (BYOK)**: klucze AI są już w aplikacji (sejf kluczy, #241 – zaszyfrowane, Gemini, Claude i inni); generowanie korzysta z tego samego klucza, zapytania idą z przeglądarki do dostawcy jak w czacie AI (klucz nie trafia na serwer Makietki); Leonardo dojdzie jako kolejny dostawca; wynik od razu w obrazach projektu | częściowo jest (#241) |
| C2 | **Generuj do ramki**: zaznaczona ramka/kadr → prompt, proporcje z ramki; prompt, model, seed, siła zapisane przy obrazie; „wygeneruj ponownie” jednym kliknięciem | do zrobienia |
| C3 | **Postacie jako referencje**: karty postaci idą do zapytania jako obrazy referencyjne (spójność bez trenowania) | do zrobienia |
| C4 | **Styl projektu**: opis stylu w ustawieniach projektu dopisywany do każdego promptu | do zrobienia |
| C5 | **Teksty jak w Canvie** na zaznaczonym tekście: skróć, wydłuż, zmień ton, przetłumacz (pl/uk/en) | do zrobienia |
| C6 | **Wypełnij kolumnę tabeli** (np. „dopisz do każdego dnia krótką myśl”, „dialogi do kadrów według scenariusza”) – seria od razu rozkłada wynik na strony | do zrobienia |
| C7 | **Obrazy z czatu**: czat AI w Makietce z modelem obrazkowym (Gemini) dostaje narzędzie „generuj obraz” – obraz trafia do obrazów projektu i od razu na stronę albo do zaznaczonej ramki (proporcje z ramki), z zapisanym promptem/modelem/ziarnem; to samo narzędzie w łączniku MCP (dla Claude) wykonuje otwarta aplikacja kluczem z sejfu (bez przechowywania klucza na serwerze) | do zrobienia (razem z C2) |

Uwagi: do tekstów wystarczy tani model (Gemini Flash, Claude Haiku). Treści, które muszą być dokładne
(np. wersety), brać ze źródła, nie z generatora – AI do quizów i opisów, zawsze ze sprawdzeniem.
API (Gemini, Leonardo) jest rozliczane osobno od subskrypcji – stąd BYOK.
