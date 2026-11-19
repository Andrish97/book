# Tryb składanek i wycinanek – ustalenia (na koniec rundy 3)

Uwaga użytkownika: „tryb składanki i cięć ma być ogólny, z trochę innym układem narzędzi; ma wspierać bardzo
skomplikowane sklejanki i wycinanki z kilku części, na różnych arkuszach”. Omówione 2026-11-18, odłożone na koniec
planu („to jest dość skomplikowane”). Zaczęty rdzeń: `js/skladanka.js` (część: obrys, zakładki, zgięcia, podział
na ściany) – na gałęzi, jeszcze nie w aplikacji.

## Odpowiedzi użytkownika

1. Druk: **i domowy, i drukarnia z ploterem** – oba tryby muszą być pełne.
2. Kolejność prac: dowolna, „najważniejsze, żeby to było dobre i systematyczne”.
3. Projektowanie: **i z gotowych szablonów parametrycznych, i rysowanie własnych części od zera**.
4. Numeracja par: **numerki** (1, 2, 3…).
5. (pytanie o przycinanie grafiki do kształtu części – do wyjaśnienia przy pracy: domyślnie grafika ściany
   przycina się do ściany, zakładki zostają gładkie).
6. Druga strona: **może być, nie musi**; drugą stronę można używać **jako miejsca klejenia bez drukowania**.

Dodatkowo:
- **Ścianki przyjmują do środka inne elementy** – przegródki, wkładki, części wsuwane w szczeliny.
- **Wybór grubości papieru / kartonu** i **wcięcia uwzględniające grubość** (kompensacja: szczelina = grubość + luz,
  wieczko większe o grubości ścianek, klapki wewnętrzne krótsze, zgięcia przesunięte).
- Projekty i sekcje tego trybu mają **własne szablony** (pudełka itd.).
- Pokazywać, **co się z czym łączy**: krawędź z krawędzią czy krawędź z polem; cyferki na zakładkach i na
  miejscach klejenia; **dodawane miejsca, gdzie się przykleja**.
- **Książki, które po otwarciu mają w środku ponacinane i rozkładane elementy** (pop-up).

## Zakres (do zrobienia po kolei, każdy krok z testem, instrukcją, DECYZJE, ZGŁOSZENIA)

Stan: krok 1 ✅, 2 ✅ (#233), 3 ✅ (#235, kolejność klejenia – w kroku 7), 4 ✅ (#234), 5 ✅ (#236), 6 ✅ (#237 – bez walca, stożka, koperty i domku), 7 ✅ (#238 – bez sklejania osobnych części w jedną bryłę i animacji krok po kroku) – bez osobnego panelu „Połączenia”, podświetlania pary i narzędzi Otwór, Rozłóż, 3D, Instrukcja (kroki 3, 5, 7).

1. **Tryb i ustawienia** – typ projektu/sekcji „Składanka”: arkusze (A4, A3, własny), materiał (papier, karton,
   tektura) z grubością (mm albo z gramatury), druk domowy / drukarnia, druga strona: brak / druk / tylko klej.
   Własny pasek narzędzi: Część (prostokąt, wielokąt, pióro, z kształtu), Zgięcie (dolina/góra, kąt), Zakładka,
   Miejsce klejenia (przód albo spód – spód bez druku), Połącz krawędzie, Szczelina i wypustka, Otwór,
   Rozłóż na arkusze, 3D, Instrukcja.
2. **Część** – obrys, ściany, zgięcia, krawędzie (cięcie / zakładka / klej / wypustka), pola klejenia z numerem,
   szczeliny o szerokości z grubości materiału, numer części; panel części z listą krawędzi i zgięć.
3. **Połączenia** – pary z numerami (zakładka „5” ↔ krawędź albo pole „5”), podświetlanie pary po najechaniu
   (także na innym arkuszu: „część C, arkusz 2”), panel „Połączenia” z kolejnością klejenia; połączenia krawędź–
   krawędź, krawędź–pole, wypustka–szczelina, zakładka pod spód.
4. **Sprawdzanie** – krawędź bez pary, para o różnych długościach, zakładka nachodząca na inną część, część poza
   arkuszem / w marginesie drukarki, zgięcie nieprzecinające części, pole klejenia mniejsze od zakładki, szczelina
   węższa niż materiał.
5. **Arkusze** – rozkładanie części na arkusze (obracanie, części jednego modelu blisko), dokładanie arkuszy;
   druk domowy (linie drukowane) i dla drukarni (CutContour, Crease, Glue, SVG dla plotera/Cricut).
6. **Szablony parametryczne z kompensacją grubości** – pudełka (klapowe, z wieczkiem nakładanym, z zatrzaskiem,
   z okienkiem, z przegródkami wsuwanymi), bryły (graniastosłup, ostrosłup, walec, stożek, kostka), tacka, koperta,
   domek; szablony projektów z kilku części.
7. **Makieta 3D** – składanie z części po zgięciach i parach krawędzi, animacja krok po kroku; **instrukcja
   montażu** generowana sama (kroki, miniatury) – jako strona albo do pobrania.
8. ⏳ (#261: kartka pop-up „wycinanka” – pudełka z nacięć i zgięć w jednym arkuszu, nic nie wystaje po zamknięciu; zostają zgięcie V z wklejanych elementów, warstwy, podgląd otwierania w 3D) **Pop-up** – typ sekcji „Rozkładówka pop-up”: zgięcie V, równoległe pudełko, nacięcia w zgięciu (cut & fold),
   warstwy na zakładkach, podpórki; podgląd otwierania 0–180° w 3D; sprawdzanie, czy nic nie wystaje po zamknięciu
   i nie zderza się.

## Uniwersalność – trudne modele (uwaga użytkownika 18.11: „wałek, stożek to proste rzeczy; a jeśli ktoś zechce zrobić trudne?”)

Stan dziś: część może mieć dowolny obrys (z kształtu, z pióra), zgięcia gdziekolwiek, pary między dowolnymi
częściami na wielu arkuszach – ale całą siatkę trzeba wymyślić i narysować samemu, a krzywe z pióra wchodzą
tylko punktami końcowymi (łuki się spłaszczają). Szablony to proste bryły. Żeby dało się robić rzeczy naprawdę
trudne (zwierzę, budynek, pojazd, postać), kolejność:

9. **Rozkładanie bryły 3D na siatkę** (jak Pepakura): wczytanie modelu OBJ / STL / glTF (z Blendera, z sieci),
   automatyczne cięcie na części (wybór krawędzi cięcia, ręczne łączenie i dzielenie części), zakładki i numery par
   same, rozkład na arkusze, nadruk – kolor/tekstura modelu na ścianach. To jest odpowiedź na „trudne rzeczy”.
10. ⏳ (#261: walec, stożek, stożek ścięty z dokładnym rozwinięciem i szwem po łuku; #262: kula z klinów; zostają łuki z pióra próbkowane gęsto, zgięcia po łuku, bryła obrotowa z profilu) **Krzywe naprawdę**: łuki z pióra próbkowane gęsto (koło, owal, fala), zgięcia po łuku, powierzchnie
    rozwijalne – walec, stożek, stożek ścięty, bryła obrotowa z profilu (pasy / kliny jak globus).
11. **Bryła z rzutu**: dowolny wielokąt z pióra wyciągnięty w graniastosłup (domek, litera, gwiazda 3D) albo w
    ostrosłup; łączenie brył (dach na domku) – siatki generowane z parami.
12. **Sklejanie części w jedną bryłę w 3D** – części ustawiają się po parach krawędzi; makieta sprawdza, czy model
    się zamyka (krawędzie bez pary, za duże szpary), i pokazuje montaż krok po kroku.
13. **Mechanizmy**: zatrzaski, zamki na klapkę, zawiasy, elementy ruchome, wkładki; pop-up (krok 8).
14. **Gotowe trudniejsze modele** do nauki: domek z dachem, samochód, zwierzę z siatki 3D.
