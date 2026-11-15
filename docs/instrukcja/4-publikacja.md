# Część IV. Gotowa publikacja {ikona=pdf}

Podgląd, sprawdzenie przed drukiem, plik PDF i link do podglądu.

# 20. Podgląd

## 20.1 Otwieranie podglądu

Podgląd pokazuje całą publikację tak, jak będzie wyglądać po przycięciu: z danymi, z powielonymi
stronami, bez linii pomocniczych i bez możliwości przypadkowej zmiany.

Otworzysz go przyciskiem [Podgląd] na górnym pasku edytora (<kbd>Shift</kbd>+<kbd>W</kbd>) albo
z menu [⋯] na karcie projektu — wtedy podgląd otwiera się od razu, bez edytora.

![Podgląd na górnym pasku](k-podglad.png)

Strony idą po kolei, rozkładówki stoją obok siebie. Strony serii mają podpis, np. „3 z 31”.
Kliknięcie strony otwiera ją w edytorze; [Edytor] albo <kbd>Esc</kbd> wraca do edycji.

![Podgląd](podglad.png)

## 20.2 Powiększanie

- [−] i [+] na pasku; kliknięcie procentu wraca do 100%, czyli całej rozkładówki w oknie.
- <kbd>Ctrl</kbd> + kółko myszy powiększa w miejscu kursora.
- Na telefonie i tablecie: szczypanie dwoma palcami, podwójne stuknięcie powiększa albo wraca.

Powiększenie zmienia tylko strony — podpisy i pasek zostają w swoim rozmiarze.

## 20.3 Prezentacja

[Prezentacja] pokazuje jedną stronę albo rozkładówkę naraz, na całym ekranie. Strzałki i spacja
przewracają strony, <kbd>Esc</kbd> albo [×] zamyka. Na telefonie przesunięcie palcem w bok przewraca
stronę, w dół — zamyka prezentację.

## 20.4 Podgląd na żywo

Otwarty podgląd odświeża się sam, gdy projekt zmieni się gdzie indziej — na innym urządzeniu, u
współpracownika albo przez AI. Zostaje w tym samym miejscu i powiększeniu; przerysowują się tylko
zmienione strony.

# 21. Sprawdź przed drukiem

## 21.1 Lista uwag

Zanim wyślesz plik do drukarni, wybierz [⋯] → [Sprawdź przed drukiem]. Aplikacja przegląda cały
projekt — także każdą powieloną stronę — i wypisuje miejsca, na które warto spojrzeć.

![Sprawdź przed drukiem w menu ⋯](k-menu-kontrola.png)

| Uwaga | Co znaczy |
|---|---|
| **Tekst nie mieści się w ramce** | Na podanych stronach tekst wystaje z ramki o stałej wysokości — np. przy dłuższej wartości z tabeli. |
| **Pole bez wartości** | Pole z literówką albo z usuniętej kolumny. |
| **Brak pliku obrazu** | W tabeli jest nazwa obrazu, którego nie wgrano. |
| **Powtórzenia** | Ta sama wartość w kolumnie z **≠**, z numerami stron. |
| **Wartości spoza listy** | Wartości spoza listy kolumny z **☰**, z numerami wierszy. |
| **Brak danych** | Tabeli dodatkowej zabrakło wierszy przed końcem serii. |
| **Strony serii w rozkładówkach** | Gdzie stoją puste strony albo od której strony blok wychodzi po przeciwnej stronie. |
| **Tabela wychodzi poza stronę** | Wiersze urosły razem z treścią i tabela wyszła poza kartkę. |
| **Niepełna składka** | Sekcji brakuje stron do pełnej składki (→ 11.7); przy oprawie zeszytowej — liczba stron niepodzielna przez 4. |
| **Element w marginesie albo poza spadem** | Jak na liście ostrzeżeń w edytorze (→ 13.2). |

[Pokaż] przy uwadze otwiera podgląd na pierwszej stronie, której uwaga dotyczy, z wyróżnioną
kartką. [Otwórz wzór] otwiera w edytorze stronę-wzór. Uwagi nie blokują eksportu — ta sama lista
jest na dole okna eksportu PDF.

![Lista uwag](kontrola.png)

# 22. Eksport do PDF i PNG

## 22.1 Okno eksportu

Wybierz [⋯] → [Eksportuj do PDF…].

![Eksportuj do PDF w menu ⋯](k-menu-pdf.png)

| Ustawienie | Znaczenie |
|---|---|
| **Rodzaj pliku** | **Wektorowy – ostry tekst i kształty**: tekst z osadzonymi czcionkami, ostry w każdym powiększeniu, da się go zaznaczyć. **Obrazy stron – strona jako zdjęcie**: każda strona to jeden obraz; wygląda wszędzie tak samo, ale plik jest większy. |
| **Zakres** | **Cały projekt**, **Tylko bieżąca sekcja** albo **Strony od–do** (numery w całym wydruku). |
| **Przeznaczenie** | **Do drukarni – ze spadem i znakami cięcia** albo **Do oglądania – równo do formatu**. Znaki cięcia dostają sekcje, które mają je włączone (→ 11.4). |
| **Jakość** | Rozdzielczość zdjęć: 300 dpi — standard do druku, 150 dpi — mały plik na próbę, 600 dpi — bardzo ostro. |

Na dole okna jest lista **Do sprawdzenia przed drukiem** (→ 21). [Eksportuj] zapisuje plik; długi
eksport przerwiesz przyciskiem [Anuluj] na karcie postępu.

![Okno eksportu](pdf.png)

## 22.2 Zaawansowane

Część **Zaawansowane**:

| Ustawienie | Znaczenie |
|---|---|
| **Zamień tekst na krzywe (bez czcionek w pliku)** | Litery stają się kształtami. Tego wymagają niektóre drukarnie; tekstu nie da się potem zaznaczyć. |
| **Kolory tekstu i kształtów w CMYK (czarny jako sama czerń)** | Kolory zapisane czterema farbami drukarskimi; czarny tekst idzie samą czarną farbą, więc jest ostry. |
| **Standard dla drukarni** | **Bez standardu – zwykły PDF**, **PDF/X-4 – papier powlekany (FOGRA39)**, **PDF/X-4 – papier niepowlekany (FOGRA47)** albo **PDF/X-4 – profil od drukarni (plik .icc)** — [Wybierz plik profilu…]. |
| **Zdjęcia też w CMYK (większy plik)** | Przy PDF/X-4: zdjęcia przeliczone na farby drukarskie przez ten sam profil. |
| **Podział na pliki** | **Jeden plik**, **Osobny plik dla każdej sekcji** albo **Części po tyle stron** (**Stron w części**). Kilka plików dostajesz w archiwum ZIP. |
| **Dołącz pliki czcionek użytych w projekcie** | Do pobrania trafia ZIP z plikiem PDF i folderem `czcionki`. |
| **Uszlachetnienia** | Gdy projekt je ma: **Osobne płyty w tym samym pliku PDF**, **Osobny plik PDF na każde uszlachetnienie** albo **Pomiń uszlachetnienia** (→ 23.4). |

## 22.3 Jak wybrać ustawienia dla drukarni

Zapytaj drukarnię, czego wymaga:

- mówi „PDF/X-4” — wybierz ten standard i papier, na którym będzie drukować,
- mówi „wszystko w CMYK” — zaznacz też oba pola CMYK,
- mówi „bez czcionek” albo „krzywe” — zaznacz **Zamień tekst na krzywe**,
- nic nie wymaga — **Wektorowy**, **Do drukarni**, 300 dpi.

> Wskazówka: Plik z projektu w kolorach ekranu wygląda w druku nieco inaczej. Najpewniej zamówić
> wydruk próbny.

## 22.4 Czego nie da się zapisać wektorowo

Element z cieniem, element przycięty maską i rysunek SVG z filtrem trafiają do pliku jako obraz
tego jednego elementu — reszta strony zostaje wektorowa. Tekst w czcionce, której nie da się osadzić,
trafia do pliku jako krzywe. Po eksporcie aplikacja mówi, jeśli coś takiego się zdarzyło.

## 22.5 Strona jako PNG

[⋯] → [Pobierz bieżącą stronę jako PNG] zapisuje obraz otwartej strony w 300 dpi, ze spadem —
np. do pokazania komuś w wiadomości.

# 23. Kolory dodatkowe i uszlachetnienia

## 23.1 Kolory dodatkowe

Druk to nie tylko cztery farby CMYK. Makietka zna kolory dodatkowe (np. Pantone), uszlachetnienia — lakier, złocenie, tłoczenie, biały poddruk — i druk tylko czarną farbą albo czarną z jednym kolorem. Wszystko trafia do pliku PDF tak, jak oczekuje drukarnia: każda farba na osobnej płycie.

Kolor dodatkowy drukuje się osobną, gotową farbą — dokładnie w tym odcieniu, którego potrzebujesz (np. kolor logo).

1. [⋯] → [Kolory do druku…] → [Dodaj kolor dodatkowy].
2. Wpisz **Nazwę** dokładnie jak w drukarni albo we wzorniku, np. „PANTONE 186 C”.
3. Wpisz **C**, **M**, **Y**, **K** — to tylko podgląd na ekranie; drukarnia użyje swojej farby.

![Okno „Kolory do druku”](k-kolory-druku.png)

Kolor dodatkowy wybierasz w każdym polu koloru — wypełnienie, obrys, tekst, fragment tekstu — w części **Kolory dodatkowe**, razem z **Odcieniem** (np. 40%).

![Kolor dodatkowy w wyborze koloru](k-kolor-dodatkowy.png)

Zmiana CMYK koloru dodatkowego zmienia wszystkie elementy w tym kolorze. Usunięcie koloru zostawia elementy w zwykłym kolorze CMYK.

## 23.2 Uszlachetnienia

Uszlachetnienie ustawiasz przy elemencie, w części **Uszlachetnienie**:

| Uszlachetnienie | Co to jest | Płyta w PDF |
|---|---|---|
| **Lakier UV wybiórczy** | Błyszczący lakier tylko w tym miejscu, np. na tytule. | Spot_UV |
| **Złocenie (folia)** | Metaliczna folia; **Kolor folii**: złoto, srebro albo miedź. | Foil_Gold, Foil_Silver, Foil_Copper |
| **Tłoczenie (wypukłe)** | Wzór wypchnięty w papierze. | Emboss |
| **Wytłoczenie (wklęsłe)** | Wzór wciśnięty w papier. | Debossing |
| **Biały poddruk** | Biała farba — na kolorowym albo przezroczystym podłożu. | White |

![Uszlachetnienie w panelu elementu](k-uszlachetnienie.png)

Element z uszlachetnieniem drukuje się **tylko** na płycie uszlachetnienia — jego kolory nie idą do druku. Żeby mieć napis w kolorze i ze złoceniem, zaznacz napis i w **Dodaj kopię z uszlachetnieniem** wybierz złocenie: kopia stanie dokładnie nad napisem.

> Wskazówka: Uszlachetnienie na bardzo drobnym tekście (poniżej 6 pt) i cienkich liniach (poniżej 0,3 mm) może się nie odwzorować. **Sprawdź przed drukiem** o tym przypomni (→ 21).

## 23.3 Widok uszlachetnień

W edytorze i podglądzie uszlachetnienie widać jako efekt: połysk lakieru, metaliczną folię, cień tłoczenia, biel na szachownicy. Menu widoku → **Pokaż uszlachetnienia** wyłącza efekt (→ 4.6).

## 23.4 Uszlachetnienia w pliku PDF

W pliku wektorowym każde uszlachetnienie to osobna płyta z **nadrukiem** — nie wybija farby pod spodem. W oknie eksportu, w części **Zaawansowane**, wybierz **Uszlachetnienia**:

- **Osobne płyty w tym samym pliku PDF** — najczęstsze,
- **Osobny plik PDF na każde uszlachetnienie** — główny plik bez uszlachetnień i osobny plik każdej płyty, w jednym ZIP,
- **Pomiń uszlachetnienia**.

Plik z obrazów stron nie ma osobnych płyt — wybierz plik wektorowy.

## 23.5 Tryb kolorów projektu

[⋯] → [Kolory do druku…] → **Tryb kolorów projektu**:

| Tryb | Kiedy |
|---|---|
| **Pełny kolor** | Zwykły druk CMYK (domyślnie). |
| **Skala szarości** | Druk jedną czarną farbą — kolory i zdjęcia idą odcieniami czerni. |
| **Cz/b + 1 kolor** | Czerń i jeden kolor dodatkowy, np. kalendarz z czerwonymi niedzielami. **Kolor dodatkowy trybu** wybierasz pod spodem. |

W wyborze koloru zostają wtedy odcienie czerni i kolor trybu. Kolory spoza trybu okno pokaże — [Zamień na najbliższe dozwolone] zamieni je na czerń albo kolor trybu. To samo zrobi przycisk w **Sprawdź przed drukiem**.

> Wskazówka: Rozszerzony CMYK (CMYK z dodatkowymi farbami, np. pomarańczową, zieloną i fioletową) robi drukarnia sama z Twojego pliku — nie trzeba osobnej palety.

# 24. Udostępnianie linkiem

## 24.1 Tworzenie linku

Link do podglądu pokażesz komuś, kto nie ma konta: klientowi, rodzinie, drukarni. Osoba z linkiem
widzi strony tak jak w podglądzie; nie może niczego zmienić i nie widzi innych Twoich projektów.

1. W podglądzie kliknij [Udostępnij].
2. [Utwórz link] — aplikacja przygotuje obrazy wszystkich stron; przy dużym projekcie chwilę to potrwa.
3. Skopiuj link i wyślij go.

![Udostępnij w podglądzie](k-udostepnij.png)
![Okno Udostępnij podgląd](udostepnianie.png)

Projekt z linkiem ma na liście projektów plakietkę **Udostępniony** — kliknięcie otwiera to samo okno.

## 24.2 Aktualizacja

Link aktualizuje się sam: kilka sekund po Twoich zmianach aplikacja wysyła obrazy stron, które się
zmieniły. Adres zostaje ten sam. [Aktualizuj teraz] robi to od razu. Osoba, która ma link otwarty,
nie musi odświeżać strony — nowe strony pojawią się same.

Obrazy stron przygotowuje aplikacja, więc link nadąża za zmianami, gdy projekt jest otwarty —
w edytorze albo w podglądzie, na dowolnym urządzeniu.

## 24.3 Ochrona linku

Część **Ochrona linku**:

| Ustawienie | Znaczenie |
|---|---|
| **Hasło – bez niego podglądu nie zobaczy nikt** | Osoba z linkiem najpierw wpisuje **Hasło do linku**. Po 10 błędnych próbach link na kwadrans przestaje przyjmować hasła. |
| **Ważny do wybranego dnia** | Po **Ostatnim dniu ważności** link przestaje działać. |

[Zapisz ochronę] zapisuje ustawienia. Puste pole hasła przy zaznaczonym haśle zostawia dotychczasowe;
odznaczenie obu pól zdejmuje ochronę.

## 24.4 Unieważnienie linku

[Unieważnij link] usuwa udostępnione strony — stary adres od razu przestaje działać. Ponowne
udostępnienie daje nowy adres.

> Uwaga: Link jest długi i losowy, więc nie da się go zgadnąć, ale każdy, kto go dostanie, może go
> przekazać dalej. Do poufnych projektów ustaw hasło.
