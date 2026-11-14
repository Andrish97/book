# Część IV. Gotowa publikacja {ikona=pdf}

Podgląd, sprawdzenie przed drukiem, plik PDF i link do podglądu.

# 19. Podgląd

## 19.1 Otwieranie podglądu

Podgląd pokazuje całą publikację tak, jak będzie wyglądać po przycięciu: z danymi, z powielonymi
stronami, bez linii pomocniczych i bez możliwości przypadkowej zmiany.

Otworzysz go przyciskiem [Podgląd] na górnym pasku edytora (<kbd>Shift</kbd>+<kbd>W</kbd>) albo
z menu [⋯] na karcie projektu — wtedy podgląd otwiera się od razu, bez edytora.

![Podgląd na górnym pasku](k-podglad.png)

Strony idą po kolei, rozkładówki stoją obok siebie. Strony serii mają podpis, np. „3 z 31”.
Kliknięcie strony otwiera ją w edytorze; [Edytor] albo <kbd>Esc</kbd> wraca do edycji.

![Podgląd](podglad.png)

## 19.2 Powiększanie

- [−] i [+] na pasku; kliknięcie procentu wraca do 100%, czyli całej rozkładówki w oknie.
- <kbd>Ctrl</kbd> + kółko myszy powiększa w miejscu kursora.
- Na telefonie i tablecie: szczypanie dwoma palcami, podwójne stuknięcie powiększa albo wraca.

Powiększenie zmienia tylko strony — podpisy i pasek zostają w swoim rozmiarze.

## 19.3 Prezentacja

[Prezentacja] pokazuje jedną stronę albo rozkładówkę naraz, na całym ekranie. Strzałki i spacja
przewracają strony, <kbd>Esc</kbd> albo [×] zamyka. Na telefonie przesunięcie palcem w bok przewraca
stronę, w dół — zamyka prezentację.

## 19.4 Podgląd na żywo

Otwarty podgląd odświeża się sam, gdy projekt zmieni się gdzie indziej — na innym urządzeniu, u
współpracownika albo przez AI. Zostaje w tym samym miejscu i powiększeniu; przerysowują się tylko
zmienione strony.

# 20. Sprawdź przed drukiem

## 20.1 Lista uwag

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
| **Element w marginesie albo poza spadem** | Jak na liście ostrzeżeń w edytorze (→ 13.2). |

[Pokaż] przy uwadze otwiera podgląd na pierwszej stronie, której uwaga dotyczy, z wyróżnioną
kartką. [Otwórz wzór] otwiera w edytorze stronę-wzór. Uwagi nie blokują eksportu — ta sama lista
jest na dole okna eksportu PDF.

![Lista uwag](kontrola.png)

# 21. Eksport do PDF i PNG

## 21.1 Okno eksportu

Wybierz [⋯] → [Eksportuj do PDF…].

![Eksportuj do PDF w menu ⋯](k-menu-pdf.png)

| Ustawienie | Znaczenie |
|---|---|
| **Rodzaj pliku** | **Wektorowy – ostry tekst i kształty**: tekst z osadzonymi czcionkami, ostry w każdym powiększeniu, da się go zaznaczyć. **Obrazy stron – strona jako zdjęcie**: każda strona to jeden obraz; wygląda wszędzie tak samo, ale plik jest większy. |
| **Zakres** | **Cały projekt**, **Tylko bieżąca sekcja** albo **Strony od–do** (numery w całym wydruku). |
| **Przeznaczenie** | **Do drukarni – ze spadem i znakami cięcia** albo **Do oglądania – równo do formatu**. Znaki cięcia dostają sekcje, które mają je włączone (→ 11.4). |
| **Jakość** | Rozdzielczość zdjęć: 300 dpi — standard do druku, 150 dpi — mały plik na próbę, 600 dpi — bardzo ostro. |

Na dole okna jest lista **Do sprawdzenia przed drukiem** (→ 20). [Eksportuj] zapisuje plik; długi
eksport przerwiesz przyciskiem [Anuluj] na karcie postępu.

![Okno eksportu](pdf.png)

## 21.2 Zaawansowane

Część **Zaawansowane**:

| Ustawienie | Znaczenie |
|---|---|
| **Zamień tekst na krzywe (bez czcionek w pliku)** | Litery stają się kształtami. Tego wymagają niektóre drukarnie; tekstu nie da się potem zaznaczyć. |
| **Kolory tekstu i kształtów w CMYK (czarny jako sama czerń)** | Kolory zapisane czterema farbami drukarskimi; czarny tekst idzie samą czarną farbą, więc jest ostry. |
| **Standard dla drukarni** | **Bez standardu – zwykły PDF**, **PDF/X-4 – papier powlekany (FOGRA39)**, **PDF/X-4 – papier niepowlekany (FOGRA47)** albo **PDF/X-4 – profil od drukarni (plik .icc)** — [Wybierz plik profilu…]. |
| **Zdjęcia też w CMYK (większy plik)** | Przy PDF/X-4: zdjęcia przeliczone na farby drukarskie przez ten sam profil. |
| **Podział na pliki** | **Jeden plik**, **Osobny plik dla każdej sekcji** albo **Części po tyle stron** (**Stron w części**). Kilka plików dostajesz w archiwum ZIP. |
| **Dołącz pliki czcionek użytych w projekcie** | Do pobrania trafia ZIP z plikiem PDF i folderem `czcionki`. |

## 21.3 Jak wybrać ustawienia dla drukarni

Zapytaj drukarnię, czego wymaga:

- mówi „PDF/X-4” — wybierz ten standard i papier, na którym będzie drukować,
- mówi „wszystko w CMYK” — zaznacz też oba pola CMYK,
- mówi „bez czcionek” albo „krzywe” — zaznacz **Zamień tekst na krzywe**,
- nic nie wymaga — **Wektorowy**, **Do drukarni**, 300 dpi.

> Wskazówka: Plik z projektu w kolorach ekranu wygląda w druku nieco inaczej. Najpewniej zamówić
> wydruk próbny.

## 21.4 Czego nie da się zapisać wektorowo

Element z cieniem, element przycięty maską i rysunek SVG z filtrem trafiają do pliku jako obraz
tego jednego elementu — reszta strony zostaje wektorowa. Tekst w czcionce, której nie da się osadzić,
trafia do pliku jako krzywe. Po eksporcie aplikacja mówi, jeśli coś takiego się zdarzyło.

## 21.5 Strona jako PNG

[⋯] → [Pobierz bieżącą stronę jako PNG] zapisuje obraz otwartej strony w 300 dpi, ze spadem —
np. do pokazania komuś w wiadomości.

# 22. Udostępnianie linkiem

## 22.1 Tworzenie linku

Link do podglądu pokażesz komuś, kto nie ma konta: klientowi, rodzinie, drukarni. Osoba z linkiem
widzi strony tak jak w podglądzie; nie może niczego zmienić i nie widzi innych Twoich projektów.

1. W podglądzie kliknij [Udostępnij].
2. [Utwórz link] — aplikacja przygotuje obrazy wszystkich stron; przy dużym projekcie chwilę to potrwa.
3. Skopiuj link i wyślij go.

![Udostępnij w podglądzie](k-udostepnij.png)
![Okno Udostępnij podgląd](udostepnianie.png)

Projekt z linkiem ma na liście projektów plakietkę **Udostępniony** — kliknięcie otwiera to samo okno.

## 22.2 Aktualizacja

Link aktualizuje się sam: kilka sekund po Twoich zmianach aplikacja wysyła obrazy stron, które się
zmieniły. Adres zostaje ten sam. [Aktualizuj teraz] robi to od razu. Osoba, która ma link otwarty,
nie musi odświeżać strony — nowe strony pojawią się same.

Obrazy stron przygotowuje aplikacja, więc link nadąża za zmianami, gdy projekt jest otwarty —
w edytorze albo w podglądzie, na dowolnym urządzeniu.

## 22.3 Ochrona linku

Część **Ochrona linku**:

| Ustawienie | Znaczenie |
|---|---|
| **Hasło – bez niego podglądu nie zobaczy nikt** | Osoba z linkiem najpierw wpisuje **Hasło do linku**. Po 10 błędnych próbach link na kwadrans przestaje przyjmować hasła. |
| **Ważny do wybranego dnia** | Po **Ostatnim dniu ważności** link przestaje działać. |

[Zapisz ochronę] zapisuje ustawienia. Puste pole hasła przy zaznaczonym haśle zostawia dotychczasowe;
odznaczenie obu pól zdejmuje ochronę.

## 22.4 Unieważnienie linku

[Unieważnij link] usuwa udostępnione strony — stary adres od razu przestaje działać. Ponowne
udostępnienie daje nowy adres.

> Uwaga: Link jest długi i losowy, więc nie da się go zgadnąć, ale każdy, kto go dostanie, może go
> przekazać dalej. Do poufnych projektów ustaw hasło.
