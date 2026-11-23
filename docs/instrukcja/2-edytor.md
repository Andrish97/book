# Część II. Edytor {ikona=olowek}

Ekran edytora, elementy na stronie, tekst, obrazy, tabele, strony i wzorce.

# 3. Ekran edytora

Gdzie co jest w edytorze — paski, panele i menu.

## 3.1 Układ ekranu

Projekt otwiera się w edytorze. Ekran ma pięć części:

- **górny pasek** — nawigacja, cofanie, okna projektu i menu [⋯] (→ 3.2, 3.3),
- **panel stron** z lewej — miniatury stron pogrupowane w sekcje (→ 10.1),
- **strona** pośrodku, a nad nią pasek wstawiania (→ 3.4),
- **prawa kolumna** — zakładki Właściwości i Warstwy (→ 3.5, 9),
- **prawy dolny róg** — linie pomocnicze, ostrzeżenia, menu widoku i powiększenie (→ 3.6).

Najechanie myszą na przycisk pokazuje jego nazwę i skrót klawiszowy.

![Edytor](edytor.png)

## 3.2 Górny pasek

![Górny pasek](k-pasek-gorny.png)

Od lewej: [Projekty], **nazwa projektu** (kliknij, żeby ją zmienić) ze stanem zapisu (→ 2.4),
[Cofnij] i [Ponów] (→ 2.5), [Wzorce] (→ 11), [Dane] (→ 14), [Podgląd] (→ 19), **format** sekcji,
np. „A5” — otwiera ustawienia sekcji (→ 10.4), [Komentarze] (→ 24.7), lupa [Znajdź i zamień] (→ 5.15)
i [⋯] (→ 3.3).

Napisy obok ikon pojawiają się, gdy jest na nie miejsce — zmienisz to w menu widoku: **Napisy na górnym
pasku** (→ 3.6). Na wąskim telefonie [Wzorce], [Dane], [Komentarze] i lupa są w menu [⋯].

## 3.3 Menu ⋯

![Menu ⋯](k-menu-wiecej.png)

Pozycje są w grupach:

| Grupa | Pozycje |
|---|---|
| Szukanie i uwagi | [Znajdź i zamień…] (→ 5.15), [Komentarze] (→ 24.7). |
| Zasoby projektu | [Obrazy projektu…] (→ 7.5), [Czcionki projektu…] (→ 5.8), [Kolory projektu…] — kolory projektu i sekcji, kolory dodatkowe, wykończenia (→ 22.1, 22.5); na telefonie też [Wzorce stron…] i [Dane…]. |
| Format i marka | [Zmień format projektu…] (→ 10.9), [Zastosuj markę do projektu…] (→ 27.9). |
| Druk i eksport | [Sprawdź przed drukiem] (→ 20), [Eksportuj do PDF…] (→ 21), [Drukuj w domu…] (→ 21.8), [Inne formaty i import…] — jedno podmenu: PNG bieżącej strony (→ 21.5), Word, EPUB, InDesign, Scribus, SVG, plik dla plotera, seria dla innego programu, specyfikacja dla drukarni i wstawianie tekstu z pliku (→ 1). |
| Pozostałe | [Współpraca…] (→ 24) i przełącznik motywu (→ 27.4). |

## 3.4 Pasek wstawiania

Pasek nad stroną wstawia nowe elementy (→ 4.1).

![Pasek wstawiania](k-wstaw.png)

| Przycisk | Klawisz | Co wstawia |
|---|---|---|
| [Tekst] | <kbd>T</kbd> | Ramkę tekstu (→ 5). |
| [Kształty ▾] | <kbd>R</kbd> <kbd>E</kbd> <kbd>P</kbd> <kbd>L</kbd> <kbd>B</kbd> <kbd>N</kbd> | Menu: **Prostokąt**, **Elipsa** (albo koło), **Wielokąt albo gwiazda** (najpierw wybór kształtu), **Linia** (→ 6.1, 6.2), **Rysowanie odręczne** (→ 6.3) i **Pióro** – kształt z punktów i łuków (→ 6.4). Gdy rysowanie albo pióro działa, przycisk ma jego ikonę – kliknięcie kończy narzędzie. |
| [Obraz] | — | Zdjęcie albo grafikę (→ 7.1). |
| [AI ▾] | — | Menu AI: obraz z opisu, poprawa obrazu w ramce, poprawa i tłumaczenie tekstu, kolumna danych (→ 5.17, 7.11, 14.6); w komiksie też scenariusz i kadry (→ 10.13); cofnięcie zmian AI (→ 25.9). |
| [Tabela] | — | Tabelę z wierszami i kolumnami (→ 8). |
| [Biblioteka] | — | Gotowe elementy: kształty, ramki, ozdobniki, planery, kalendarze, wykresy i inne (→ 4.8). |
| [Komentarz] | — | Komentarz przypięty do miejsca na stronie albo do zaznaczonego elementu (→ 24.7). |

Podpisy pod ikonami włączysz w menu widoku: **Podpisy narzędzi** (→ 3.6).

Skróty klawiszowe kształtów działają bez otwierania menu. Rozmowę z AI otwiera osobny przycisk [Asystent AI] na
górnym pasku, obok [Podgląd] (→ 25.6).

**Na telefonie** [Komentarz] i [Kopiuj wygląd] (→ 4.13) są pod [⋯] na końcu paska, a [Asystent AI] – w menu [AI ▾].
Gdy jedno z narzędzi spod [⋯] działa, [⋯] pokazuje jego ikonę; stuknięcie kończy narzędzie.

![Menu ⋯ paska wstawiania na telefonie](k-wstaw-telefon.png@telefon)

## 3.5 Właściwości i warstwy

Prawa kolumna ma u góry dwie zakładki: [Właściwości] i [Warstwy] (→ 9), przełączane kliknięciem albo <kbd>F7</kbd>.
Nagłówek właściwości mówi, czego dotyczą ustawienia:

| Nagłówek | Kiedy | Co ustawiasz |
|---|---|---|
| **Zaznaczony element** · rodzaj (np. „Tekst”) | Jest zaznaczony element. | Wygląd i położenie tego elementu. |
| **Ustawienia narzędzia** · nazwa (np. „Rysowanie”) | Włączone jest narzędzie, np. rysowanie odręczne. Nagłówek ma wtedy tło w kolorze akcentu. | Jak będą wyglądać następne elementy — „Tak będą wyglądać następne linie.” |
| **Nic nie jest zaznaczone** · „Strona” | Nic nie jest zaznaczone. | Ustawienia otwartej strony (→ 10.3). |

Przy zaznaczonym elemencie w nagłówku są [Kopiuj do schowka], [Duplikuj], [Kopiuj wygląd] (→ 4.13),
[Zapisz w bibliotece] (→ 4.8) i [Usuń]. **Ostrzeżenia** otwiera przycisk z trójkątem obok powiększenia (→ 12.2).

![Ustawienia narzędzia: rysowanie](k-rysowanie.png)

Na telefonie te panele otwierają przyciski na dole ekranu (→ 28.2).

![Właściwości zaznaczonego tekstu](wlasciwosci.png)

## 3.6 Prawy dolny róg i menu widoku

![Prawy dolny róg](k-widok.png)

- **dwie kartki** — tylko w sekcji z rozkładówkami: cała rozkładówka albo jedna strona (→ 10.5),
- przycisk **linii pomocniczych** (<kbd>W</kbd>) — pokazuje albo chowa marginesy, spad, grzbiet i prowadnice (→ 12.1),
- przycisk **Ostrzeżenia** (trójkąt, <kbd>F8</kbd>) — liczba uwag na stronie; otwiera okienko ostrzeżeń (→ 12.2),
- [Widok] (ikona kratki) — menu widoku,
- [−], procent, [+] — powiększenie (→ 12.6).

Menu widoku:

| Pozycja | Co robi |
|---|---|
| **Siatka**, **Przyciągaj do siatki**, **Krok siatki** | Siatka co zadany krok w mm (→ 12.3). |
| **Siatka linii bazowych** | Linie bazowe z ustawień sekcji (→ 5.13). |
| **Przyciągaj do elementów i pokazuj odległości** | Różowe linie i odległości w mm przy przesuwaniu (→ 12.5). |
| **Linijki** | Linijki w mm nad stroną i z lewej (→ 12.4). |
| **Zablokuj prowadnice**, [Usuń prowadnice z tej strony] | Ochrona i sprzątanie prowadnic (→ 12.4). |
| **W rozkładówkach pokazuj jedną stronę** | To samo co przycisk z dwiema kartkami (→ 10.5). |
| **Sprawdzaj pisownię** | Falista czerwona linia pod słowami spoza słownika i część **Pisownia** w panelu tekstu (→ 5.16). |
| **Pokaż uszlachetnienia** | Efekt lakieru, folii, tłoczenia i bieli na stronie; wyłączony — zwykły widok (→ 22.3). |
| **Podpisy narzędzi** | Podpisy pod ikonami paska wstawiania. |
| **Napisy na górnym pasku** | [Auto] — gdy się mieszczą, [Zawsze], [Nigdy]. |

Ustawienia widoku dotyczą tylko tego urządzenia.

![Menu widoku](k-menu-widoku.png)

# 4. Elementy na stronie

Wszystko, co stoi na stronie, to element: tu jest to, co wspólne dla wszystkich — zaznaczanie, przesuwanie, grupy, gotowe elementy z Biblioteki.

## 4.1 Wstawianie

Kliknij narzędzie na pasku wstawiania (→ 3.4) — element pojawi się na środku widoku i będzie
zaznaczony. Obraz możesz też przeciągnąć z dysku na stronę albo wkleić ze schowka
(<kbd>Ctrl</kbd>+<kbd>V</kbd>).

Elementy wzorców (→ 11) widać na stronie, ale nie da się ich tu zaznaczyć — zmieniasz je we wzorcu.

![Wstawiony tekst](wstawianie.png)

## 4.2 Zaznaczanie

- **Kliknięcie** zaznacza element.
- <kbd>Shift</kbd> + kliknięcie dodaje element do zaznaczenia albo go z niego usuwa.
- **Przeciągnięcie ramki** od pustego miejsca strony zaznacza elementy, których dotknie.
- <kbd>Ctrl</kbd>+<kbd>A</kbd> zaznacza wszystkie elementy strony.
- Element leżący pod innym zaznaczysz na liście warstw (→ 9).
- **Kliknięcie dwa razy**: w tekście — pisanie, w grupie — wejście do grupy, w komórce tabeli —
  pisanie w komórce, w kształcie z pióra — edycja punktów, w obrazie — kadrowanie.
- <kbd>Esc</kbd> zdejmuje zaznaczenie.

## 4.3 Przesuwanie, rozmiar i obrót

- **Przeciągnij** element, żeby go przesunąć. Strzałki przesuwają o 1 mm, z <kbd>Shift</kbd> — o 10 mm.
- **Kółka w rogach i na bokach** zmieniają rozmiar, **kółko nad elementem** obraca.
- <kbd>Shift</kbd> przy przeciąganiu — tylko w poziomie albo w pionie; przy obracaniu — co 15°.
- <kbd>Alt</kbd> przy przeciąganiu — przeciągasz kopię.

Dokładne wartości wpiszesz we właściwościach, w części **Położenie i rozmiar (mm)**:

| Pole | Znaczenie |
|---|---|
| **X**, **Y** | Lewy górny róg elementu, w mm od lewego górnego rogu strony (bez spadu). |
| **Szerokość**, **Wysokość** | Rozmiar w mm. Kłódka między nimi zachowuje proporcje. |
| **Obrót** | Kąt w stopniach. |

Przy kilku zaznaczonych elementach liczby dotyczą ich wspólnej ramki.

## 4.4 Wyrównywanie i równe odstępy

Część **Wyrównaj** we właściwościach:

- **jeden element** — wyrównanie do marginesów strony: do lewej, do środka, do prawej, do góry,
  do środka w pionie, do dołu,
- **kilka elementów** — wyrównanie do siebie,
- **trzy i więcej** — dodatkowo [Rozłóż równo] w poziomie i w pionie: równe odstępy między elementami.

Przy przesuwaniu element „przykleja się” do krawędzi i środków innych elementów, a strzałki
podają odległości w mm (→ 12.5).

![Wyrównywanie kilku elementów](wyrownanie.png)

## 4.5 Grupy

Zaznacz kilka elementów i wybierz [Zgrupuj] (<kbd>Ctrl</kbd>+<kbd>G</kbd>). Grupa przesuwa się,
skaluje i obraca jak jeden element. [Rozgrupuj] (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>)
rozdziela ją z powrotem.

**Element grupy bez rozgrupowywania:** kliknij grupę dwa razy — grupa się otworzy (pomarańczowa
przerywana ramka), a element pod kursorem będzie zaznaczony. Możesz go przesunąć, zmienić we
właściwościach albo pisać w nim. Kliknięcie innego elementu grupy zaznacza tamten, <kbd>Shift</kbd>
dodaje kolejne. <kbd>Esc</kbd>, kliknięcie poza grupą albo [Wróć do całej grupy] ją zamyka.

- W otwartej grupie [Duplikuj] zostawia kopię w grupie, a [Usuń] usuwa tylko zaznaczony element.
- Grupa w grupie otwiera się kolejnym podwójnym kliknięciem; <kbd>Esc</kbd> wraca o poziom wyżej.

## 4.6 Kolejność, blokada i schowek

- Część **Kolejność**: [Na wierzch], [Wyżej], [Niżej], [Na spód]. To samo zrobisz przeciąganiem
  na liście warstw (→ 9).
- Część **Inne**:
  - **Krycie** — przezroczystość elementu w %,
  - **Zablokuj położenie i rozmiar** — elementu nie przesuniesz przypadkiem; kolor i tekst zmienisz dalej,
  - **Wycisz ostrzeżenia dla tego obiektu** — np. dla tła, które celowo wychodzi na spad,
  - **Nazwa** — nazwa elementu na liście warstw.
- [Kopiuj do schowka] i <kbd>Ctrl</kbd>+<kbd>V</kbd> na innej stronie wklejają element w to samo
  miejsce. We właściwościach strony jest też [Wklej skopiowane elementy].
- **Między projektami**: skopiowany element czeka w schowku tego urządzenia — otwórz inny projekt
  i wklej (<kbd>Ctrl</kbd>+<kbd>V</kbd> albo [Wklej skopiowane elementy]). Obrazy elementu trafiają do obrazów
  nowego projektu. Schowek przetrwa przejście do innego projektu, przeładowanie i drugą kartę.
- **Strony i sekcje** do innego projektu: menu strony (⋯ na miniaturze) → [Kopiuj do schowka (także do innego
  projektu)], menu sekcji → [Kopiuj sekcję do schowka]. W drugim projekcie: menu strony → [Wklej strony ze schowka]
  (za tą stroną, w jej sekcji) albo menu sekcji → [Wklej sekcję ze schowka] (za tą sekcją). Razem ze stronami
  przechodzą ich obrazy, wzorce, serie z tabelami danych i style tekstu. Pozycja w menu mówi, co jest w schowku
  i z którego projektu. Okładki nie wkleisz do projektu, który już ma okładkę — wklej wtedy same strony.

## 4.7 Cień

Część **Cień** działa dla każdego elementu:

**Cień pod elementem** włącza cień. Ustawisz jego kolor, **Siłę**, przesunięcie **W prawo** i **W dół**
w mm (ujemne — w lewo albo w górę) i **Rozmycie** krawędzi w mm.

## 4.8 Biblioteka

Biblioteka to gotowe elementy do wstawienia: kształty, ramki, ozdobniki, planery, kalendarze, wykresy
i Twoje własne elementy. Otwiera ją [Biblioteka] na pasku wstawiania.

![Biblioteka obok strony](k-biblioteka.png)

1. Wybierz kategorię u góry albo wpisz słowo w pole **Szukaj** – szukanie przegląda wszystkie kategorie naraz.
2. Kliknij element – stanie na środku bieżącej strony. Na komputerze możesz też przeciągnąć kafelek na stronę: element stanie tam, gdzie go upuścisz.
3. Resztę ustawisz w panelu właściwości, jak przy każdym elemencie.


| Kategoria | Co w niej jest |
|---|---|
| **Moje elementy** | Elementy zapisane przez Ciebie – na koncie, w każdym projekcie (niżej). |
| **Gotowe sekcje** | Całe dokumenty: kalendarze, planery, notesy, zaproszenia, dyplomy, wizytówki, ulotki, menu, rozdziały książki… Kafelek otwiera okno gotowych sekcji na tym szablonie (→ 10.10). |
| **Ikony** | 260 ikon liniowych w jednym stylu, w grupach: **Kontakt**, **Czas i kalendarz**, **Pogoda**, **Jedzenie**, **Podróże**, **Szkoła i nauka**, **Wiara** (krzyż, gołębica, ryba, świeca, dłonie złożone, Biblia, kielich, różaniec…), **Zdrowie**, **Finanse**, **Dom**, **Natura**, **Technologia**, **Strzałki**. Kolor i grubość linii zmienisz w części **Obrys**; przy powiększaniu linia rośnie razem z ikoną. |
| **Ilustracje** | Rysunki liniowe do przekolorowania: góry, las, żaglówka, latarnia, dom z drzewem, kościół na wzgórzu, kawa i książka, świeca z księgą, monstera, gałązka, kaktus, ptaki, motyl, kot, snop zboża, winorośl, gołębica z gałązką, dłonie z sercem, krzyż na wzgórzu, księżyc, miasto, rower, prezent. |
| **Kształty** | Ponad 200 kształtów w grupach: **Podstawowe** (koło, kwadrat, owale, trójkąty, łuki, pierścień, sześcian, walec…), **Wielokąty** (także zaokrąglone, plaster miodu), **Gwiazdy i odznaki** (gwiazdy, pieczęcie, medal, zębatka, odznaki promocyjne), **Serca i natura** (serca, kwiaty, liście, chmury, góry, fala, płomień, tęcza, zwierzęta…), **Symbole i ikony** (dom, telefon, korona, puchar, kłódka, osoba, laptop, klucz, puzzel, mapa…), **Okolicznościowe** (prezent, balon, choinka, bombka, tort, pisanka, bałwanek…), **Znaki** (plus, minus, procent, pytajnik, ptaszek, pola wyboru…). |
| **Strzałki i dymki** | Strzałki w każdą stronę, na skos, zakręcone, z kolanem, łukiem, faliste, wymiany, rozgałęzione; szewrony; dymki z każdej strony, okrągłe, owalne, myśli, chmurka, krzyku, dwa dymki. |
| **Ramki** | Ponad 60 ramek w grupach: **Proste**, **Zaokrąglone**, **Podwójne i przerywane** (przerywana, kropkowana, kreska – kropka – to sam obrys), **Ozdobne**, **Z miejscem na tytuł**, **W kształcie** (serce, owal, koło, chmurka, ośmiokąt, łuk, gwiazda…), **Na zdjęcie** (pola w kształcie koła, serca, łuku, chmurki… – wstaw do nich obraz, a także odbitka, slajd, klatka filmu), **Kartki i notatki**, **Obramowania stron** (wstawiają się od razu na całą stronę). |
| **Ozdobniki** | Wstęgi i banery, narożniki (pojedyncze i komplety czterech), rozety i ornamenty (mandala, róża wiatrów, lilia, medalion…). |
| **Linie i separatory** | Linia ciągła, cienka, gruba, przerywana, kropkowana, kreska – kropka, podwójna i pionowa; separatory ozdobne (fala, zygzak, z kropką, kółkiem, gwiazdką, kwiatkiem, rombami, zawijasy, pętelki, listki…). Rodzaj i grubość zmienisz potem w części **Linia** (→ 6.2). |
| **Etykiety i plakietki** | Etykiety zaokrąglone, ze ściętymi rogami, owalne, z obwódką, faliste, ząbkowane, na słoik, herbowe, cenówka, metka, plakietka, pieczątka, znaczek pocztowy, tabliczka — w środek wstaw tekst. |
| **Okolicznościowe** | Zestawy w jednym stylu na **Boże Narodzenie**, **Wielkanoc**, **urodziny**, **ślub**, **chrzest**, **Pierwszą Komunię** i **szkołę**: nagłówek z życzeniami, ramka, szlaczek i gotowa kartka. |
| **Tła i wzory** | **Wzory na całą stronę** (paski, kropki, groszki, kratka, krata, jodełka, fale, zygzak, romby, gwiazdki, kwiatki, plaster miodu, łuski, trójkąty, krzyżyki, koła, raster komiksowy, linie ruchu), **Tekstury papieru** (płótno lniane, karton, papier pakowy, czerpany, w linie z marginesem, milimetrowy), **Przejścia kolorów** i **Plamy i akwarela**. Wzory, tekstury i przejścia wstawiają się na całą stronę ze spadem, pod treść; wzór to jeden wektorowy element na tle – kolory zmienisz po otwarciu grupy (dwuklik). Przy zaznaczonym kształcie wzór może go wypełnić (→ 6.5). |
| **Kalendarze** | Kalendarz miesiąca: zwykły, z miejscem na notatki, z numerami tygodni (→ 4.9). |
| **Planer** | Gotowe tabele do planerów i notesów: lista zadań, tracker nawyków, plan tygodnia, plan dnia (godziny), notatki w linie, siatka dni tygodnia, lista zakupów, cele, budżet, kontakty, plan lekcji; **Plany**: kalendarz roczny (12 miesięcy na stronie), plan miesiąca, tydzień w kolumnach i z priorytetami, plan posiłków; **Trackery**: nastrój, woda, czytanie, dziennik modlitwy; **Listy i budżet**: lista życzeń, budżet miesięczny; do tego siatki do notatek: kratka, kropki, linie (co 5 mm), papier milimetrowy, siatka izometryczna. Pola wyboru są w **Kształtach → Znaki**. |
| **Formularze do druku** | Data i podpis, kratki na litery, pola na dane, odcinek do odcięcia z nożyczkami, pola wyboru, skala ocen 1–5, pole na uwagi, kupon, zgoda z podpisem; tabelka zamówienia i lista obecności (zwykłe tabele). |
| **Wykresy** | Słupkowy, poziomy, liniowy, kołowy i pierścieniowy z tabeli danych (→ 4.10). |
| **Infografiki** | Oś czasu pozioma i pionowa, kroki i strzałki procesu, liczby i statystyki, porównanie, drzewo, piramida, cykl, paski postępu, ocena gwiazdkami, lejek, mapa myśli, macierz 2 × 2. |
| **Kolaże zdjęć** | Gotowe układy 2–9 pól na zdjęcia (→ 4.11). |
| **Teksty** | Gotowe napisy po łuku, w okręgu (pieczęć), falisty baner, flaga, wypukły tytuł (→ 5.14). |
| **Nagłówki i tytuły** | Tytuł z podtytułem, tytuł między liniami, numer rozdziału, inicjał z akapitem, cytat z autorem, pieczątki, wstęga z napisem, tytuł na pasku, odręczny, z dwóch krojów, z etykietą, w narożnikach, nagłówek strony, tytuł z datą. |
| **Bloki treści** | Ramki **Uwaga**, **Wskazówka**, **Ciekawostka**, **Ważne**, cytat wyróżniony, werset, lista z ikonami i numerowana, kolumna boczna, stopka redakcyjna, notka o autorze (z polem na zdjęcie), kontakt, pytanie i odpowiedź, „Do zapamiętania”. |
| **Układy stron** | Całe strony na obszar treści: strona tytułowa, początek rozdziału, galeria 2 × 2, strona z cytatem, strona na notatki, dyplom, ogłoszenie, strona dnia. |
| **Style tekstu** | Style akapitu projektu: kliknięcie nadaje styl zaznaczonemu tekstowi, a bez zaznaczenia wstawia nowy tekst w tym stylu (→ 5.4). |
| **Marka** | Logo z zestawu marki, [Zastosuj markę do projektu…] i [Edytuj zestaw marki…] (→ 27.9). |
| **Kody** | Kod QR i kod kreskowy EAN / ISBN (→ 4.12). |

Ikony, ilustracje, nagłówki, bloki, infografiki, formularze, układy i zestawy okolicznościowe to zwykłe teksty, kształty i linie złożone w jedną grupę – przesuwasz je razem, a po dwukliku (otwarta grupa, → 4.5) zmieniasz każdy tekst, kolor czy kształt osobno. Kolory i czcionki biorą z zestawu marki (→ 27.9), jeśli go masz; cała wstawka to jeden krok cofania.
Na komputerze kategorie zajmują najwyżej trzy rzędy – pozostałe zobaczysz po przewinięciu tego miejsca.

![Nagłówek, blok „Wskazówka”, oś czasu i werset z Biblioteki](k-biblioteka-dzialy.png)

Kształt z biblioteki to zwykły kształt: zmienisz mu kolor, obrys i punkty (→ 6.4), a zamknięty kształt może być ramką zdjęcia (→ 7.7).
Długie kategorie mają nagłówki grup (np. Podstawowe, Wielokąty); przy szukaniu nagłówków nie ma, a wyniki są ze wszystkich kategorii. Szablon z kategorii **Planer** to zwykła tabela (→ 8): wpisujesz w komórki, dodajesz wiersze i kolumny, zmieniasz linie i kolory.
Żeby planer powtarzał się na wielu stronach, wstaw go we wzorcu (→ 11) albo na stronie serii (→ 16).

![Kategoria Planer w Bibliotece](k-biblioteka-planer.png)

**Moje elementy.** Logo, stopkę firmy czy ulubioną ramkę zapiszesz raz i wstawisz w każdym projekcie:

1. Zaznacz element albo kilka elementów (np. logo z podpisem).
2. Kliknij [Zapisz w bibliotece] w nagłówku panelu (przy kilku zaznaczonych — w części **Zaznaczenie**)
   albo w [⋯] przy elemencie na liście warstw.
3. Wpisz nazwę. Element trafi do kategorii **Moje elementy**.

![Moje elementy w Bibliotece](k-moje-elementy.png)

- Elementy są na Twoim koncie, więc widać je w każdym projekcie i na każdym urządzeniu.
- Wstawiony element jest kopią — usunięcie go z Biblioteki nie zmienia stron, na których już stoi.
- Ołówek w rogu kafelka zmienia nazwę, kosz usuwa element z Biblioteki.
- Elementów wzorca i tekstu w trakcie pisania nie zapiszesz — najpierw wyjdź z pisania.

## 4.9 Kalendarz miesiąca

Siatka dni jednego miesiąca z nazwą miesiąca i dniami tygodnia. Niedziele i polskie święta – także ruchome: Wielkanoc, Poniedziałek Wielkanocny, Zielone Świątki, Boże Ciało – są wyróżnione kolorem.

![Kalendarz miesiąca i jego ustawienia](k-kalendarz.png)

| Ustawienie | Co zmienia |
|---|---|
| **Miesiąc**, **Rok** | Pokazany miesiąc. |
| **Miesiąc z kolumny danych** | Na każdej stronie serii inny miesiąc – z kolumny z wartościami typu „2027-03”, „marzec 2027” albo „3” (rok wtedy z **Rok z kolumny**). Tak powstaje kalendarz na 12 miesięcy z jednej strony-wzoru (→ 16). |
| **Tydzień zaczyna się od** | Poniedziałku albo niedzieli. |
| **Nazwy dni** | Pełne, skrócone albo same litery. |
| **Język nazw** | Polski, angielski albo ukraiński – nazwy miesięcy i dni. Nowy kalendarz bierze język interfejsu; zmiana języka interfejsu nie zmienia gotowego kalendarza. |
| **Dni innych miesięcy** | Wyszarzone, jak zwykłe dni albo ukryte. |
| **Nazwa miesiąca nad dniami**, **Numery tygodni** | Dodatkowy wiersz i kolumna. |
| **Miejsce na notatki** | Data w rogu, wyższe kratki do pisania. |
| **Polskie święta**, **Nazwa święta pod datą** | Wyróżnienie świąt i ich nazwy w kratkach. |
| **Święta z tabeli danych** | Własne dni (urodziny, imieniny, terminy) z tabeli: kolumna z datą („2027-05-26”, „26.05.2027” albo „26.05” – co roku) i kolumna z nazwą. |
| **Kolory kalendarza** | Dni, nazwy, niedziele, soboty, święta, dni innych miesięcy. |

Linie, tła wierszy, czcionkę i wyrównanie zmieniasz jak w tabeli (→ 8.5). Daty układa aplikacja – w kratkach kalendarza się nie pisze.

## 4.10 Wykres

Wykres rysuje liczby z tabeli danych projektu (→ 14) i zmienia się sam, gdy zmienisz dane.

![Wykres słupkowy i jego ustawienia](k-wykres.png)

| Ustawienie | Co zmienia |
|---|---|
| **Rodzaj** | Słupkowy, poziomy, liniowy, kołowy, pierścieniowy. |
| **Tabela danych**, **Podpisy z kolumny**, **Liczby z kolumn** | Skąd wykres bierze dane; każda zaznaczona kolumna liczb to osobna seria (osobny kolor). |
| **Wiersze** | Wszystkie, wybrane (od–do) albo **wiersz strony serii** – na każdej powielonej stronie wykres z jej wiersza. |
| **Tytuł**, **Liczby przy słupkach**, **Oś**, **Linie siatki**, **Legenda** | Co widać na wykresie. |
| **Szerokość**, **Wysokość**, **Czcionka**, **Rozmiar pisma**, **Kolory** | Wygląd. Uchwyty zmieniają rozmiar wykresu, nie wielkość pisma. |

Liczby w komórkach mogą mieć przecinek, spacje i znak %.

## 4.11 Kolaż zdjęć

Kolaż to gotowy układ pól na zdjęcia. Upuść zdjęcie z komputera na pole – trafi do tego pola. Możesz też kliknąć kolaż dwa razy, wybrać pole i w części **Obraz w kształcie** wstawić obraz z projektu (→ 7.7).

W panelu kolażu zmienisz **Układ** (pola przybywają albo ubywają, zdjęcia w pierwszych polach zostają), **Odstęp między zdjęciami**, **Zaokrąglenie rogów**, **Szerokość** i **Wysokość**.

## 4.12 Kod QR i kod kreskowy

Kod wstawisz z [Biblioteka], kategoria **Kody**. W części **Kod** panelu ustawisz resztę:

| Ustawienie | Co znaczy |
|---|---|
| **Rodzaj** | **Kod QR** albo **Kod kreskowy EAN-13 / ISBN** (np. ISBN na okładce książki). |
| **Co zawiera** (QR) | **Adres strony**, **Tekst**, **E-mail**, **Telefon** albo **Sieć Wi-Fi**. |
| **Korekcja błędów** (QR) | Ile kodu może być zasłonięte: od **Niska (7%)** — najmniejszy kod — do **Najwyższa (30%)**, np. pod logo. |
| **Numer EAN albo ISBN** | Cyfra kontrolna dopisze się sama; ISBN możesz wpisać z myślnikami. |
| **Rozmiar** | [Rozmiar nominalny (100%)] ustawia kod EAN na 37,29 × 25,93 mm. |
| **Kolor kodu**, **Tło**, **Margines ciszy** | Kod musi być ciemny na jasnym tle, z pustym pasem wokół. |

Pole z danych w treści — np. `{adres}` albo `{isbn}` — daje inny kod na każdej stronie serii (→ 15).

Gdy kod będzie za mały, za jasny albo z błędną treścią, przypomni o tym panel i **Sprawdź przed drukiem**.

![Kod QR i jego ustawienia](k-kod.png)

## 4.13 Kopiuj wygląd (malarz formatów)

Wygląd jednego elementu przeniesiesz na inny jednym kliknięciem — bez przepisywania kolorów i grubości.

[Kopiuj wygląd] (pędzel) jest w nagłówku panelu właściwości, w [⋯] przy elemencie na liście warstw,
a na telefonie też pod [⋯] paska wstawiania (→ 3.4).

![Kopiuj wygląd w nagłówku panelu](k-malarz.png)

1. Zaznacz element, który ma już dobry wygląd.
2. Kliknij [Kopiuj wygląd] (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd>).
3. Kliknij element, który ma dostać ten wygląd.

- **Dwa kliknięcia** w [Kopiuj wygląd] — tryb ciągły: klikasz kolejne elementy, aż naciśniesz <kbd>Esc</kbd>.
- **Fragment tekstu:** w pisanym tekście zaznacz słowa i kliknij [Kopiuj wygląd] — wygląd dostanie tylko
  zaznaczony fragment. Tak samo skopiujesz wygląd z fragmentu.

Przechodzi wszystko, co dotyczy wyglądu — kolory, przejścia, obrys, czcionka, odstępy, filtry zdjęcia,
krycie, cień, uszlachetnienia — a treść zostaje. Tabele, kody, wykresy i kalendarze mają własne ustawienia
i wyglądu nie przejmują.

## 4.14 Dymek

Dymek to jeden element: ramka tekstu z dymkiem dookoła. Wstawisz go z [Biblioteka], kategoria **Dymki**. Piszesz w nim jak w zwykłej ramce tekstu – dymek rośnie razem z tekstem.

| Rodzaj | Wygląd |
|---|---|
| **mowa** | Owal z ogonkiem. |
| **myśl** | Chmurka z kółkami zamiast ogonka. |
| **krzyk** | Wybuch z kolcami. |
| **szept** | Owal z przerywanym obrysem. |
| **narracja** | Prostokątna ramka bez ogonka. |

- Koniec ogonka przesuwasz pomarańczowym uchwytem na stronie – ustaw go przy ustach postaci. Ogonek jedzie razem z dymkiem.
- W części **Dymek** panelu zmienisz **Rodzaj**, włączysz albo wyłączysz **Ogonek**, ustawisz **Wypełnienie**, **Obrys** i **Grubość obrysu**. Krój, rozmiar i kolor tekstu – jak w zwykłym tekście (→ 5).
- Dymek wychodzi w PDF jako wektor, tak jak na stronie.

# 5. Tekst

Ramki tekstu, ich wygląd, style i skład — od jednego napisu po tekst książki płynący przez wiele stron.

## 5.1 Pisanie

Wstaw tekst przyciskiem [Tekst] (<kbd>T</kbd>) i od razu pisz. Istniejący tekst kliknij dwa razy,
żeby pisać w nim; <kbd>Esc</kbd> kończy pisanie. <kbd>Enter</kbd> zaczyna nowy akapit.

Szerokość ramki zmieniasz bocznymi uchwytami — tekst układa się od nowa, litery się nie rozciągają.
Wysokość ramki rośnie razem z tekstem, chyba że ustawisz stałą wysokość (→ 5.6).

![Tekst na stronie](wstawianie.png)

## 5.2 Wygląd tekstu

Właściwości zaznaczonego tekstu:

| Ustawienie | Znaczenie |
|---|---|
| **Styl** | Zapisany wygląd tekstu (→ 5.4). |
| **Czcionka** | Krój pisma. Na liście zacznij pisać nazwę, żeby ją znaleźć (→ 5.8). |
| **Rozmiar** | W punktach (pt). Kółko z prawej to **kolor tekstu**. |
| [B] [I] [U] [S] | Pogrubienie, kursywa, podkreślenie, przekreślenie. Wyszarzone, gdy czcionka nie ma takiej odmiany. |
| **Wyrównanie** | Do lewej, do środka, do prawej, wyjustowanie. |
| **Interlinia** | Odstęp między wierszami; 1 to pojedynczy. |
| **Odstęp liter** | Rozstrzelenie liter; wartość ujemna ściska tekst. |
| **Wielkość liter** | [AA] — wszystkie wielkie, [aa] — wszystkie małe, [Aᴀ] — kapitaliki: to tylko wygląd, treść zostaje taka, jak ją wpisano. [Aa] — „jak w zdaniu”: zmienia samą treść. |
| **Lista** | Punkty, kreski albo numery przed każdym akapitem (→ 5.5). |
| **Obrys liter** | Kolor i **Grubość obrysu liter** — kontur wokół każdej litery. |

![Właściwości tekstu](wlasciwosci.png)

## 5.3 Fragment tekstu

Kliknij tekst dwa razy, zaznacz fragment i zmień go tymi samymi ustawieniami — panel pokaże
„Zmieniasz tylko zaznaczony fragment”. Tak pogrubisz jedno słowo albo zmienisz kolor jednej linijki.
Wygląd fragmentu z polem (→ 15) przechodzi na wstawioną wartość.

## 5.4 Style

**Styl** to zapisany wygląd tekstu, np. „Tytuł”, „Podpis”, „Dymek”. Nadaj go wszystkim tekstom,
które mają wyglądać tak samo.

- Lista **Styl** we właściwościach nadaje styl zaznaczonemu tekstowi.
- [Nowy styl] zapisuje wygląd zaznaczonego tekstu pod nową nazwą.
- Gdy zmienisz tekst ze stylem, pojawią się [Aktualizuj styl] — zmienia wszystkie teksty z tym stylem
  w całym projekcie — i [Przywróć] — wraca do wyglądu ze stylu.
- Styl zapisuje też ustawienia **Składu akapitu** (→ 5.9) — np. dzielenie wyrazów dla całego tekstu książki.

**Styl znakowy** to zapisany wygląd fragmentu tekstu, np. „Wyróżnienie” albo „Nazwa własna”.

1. Zaznacz fragment tekstu (kliknij tekst dwa razy i zaznacz słowa).
2. Ustaw jego wygląd (→ 5.3), potem w części **Styl tekstu** wybierz [Nowy styl znakowy].
3. Inne fragmenty zaznacz i wybierz styl z listy **Styl znakowy**. Bez zaznaczenia styl dostaje cały tekst.

[Aktualizuj styl] przenosi wygląd zaznaczenia do stylu — zmienią się wszystkie fragmenty z tym stylem
w projekcie. Usunięty styl znakowy nie zmienia wyglądu fragmentów.

## 5.5 Listy

Lista **Lista** we właściwościach tekstu: **Punkty**, **Kreski** albo **Numery**. Znak listy stoi przed
każdym akapitem, a dalsze wiersze akapitu równo pod pierwszym. W tekście płynącym przez kilka ramek
numery liczą się dalej. Skróty: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>8</kbd> (punkty) i
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>7</kbd> (numery).

## 5.6 Ramka tekstu

Część **Ramka tekstu** przydaje się, gdy tekst ma zająć stałe miejsce — np. teksty z danych o różnej
długości (→ 17.6):

| Ustawienie | Znaczenie |
|---|---|
| **Stała wysokość ramki** | Ramka nie rośnie z tekstem. Wysokość wpisujesz w mm albo zmieniasz górnym lub dolnym uchwytem. |
| **Tekst w pionie** | Do góry, na środku albo do dołu ramki. |
| **Zmniejszaj tekst, gdy się nie mieści** | Czcionka maleje, aż tekst się zmieści — nie poniżej **najmniejszego rozmiaru**. |

Tekst, który mimo to się nie mieści, jest ucinany na dole ramki i trafia na listę ostrzeżeń.

![Ramka o stałej wysokości](ramka-tekstu.png)

## 5.7 Kolumny i tekst przez kilka ramek

Dłuższy tekst może płynąć przez kilka ramek: to, co nie mieści się w pierwszej, przechodzi do
następnej. Część **Przelewanie tekstu**:

| Przycisk | Co robi |
|---|---|
| [Podziel na kolumny] | Zamienia ramkę na 2, 3 albo 4 kolumny obok siebie. |
| [Dodaj ramkę z ciągiem dalszym] | Nowa ramka obok (albo pod spodem), do której płynie reszta tekstu. |
| [Ciąg dalszy na następnej stronie] | Ramka na następnej stronie — w razie potrzeby razem z nową stroną. |
| [Połącz ramki tekstu] | Łączy dwie zaznaczone ramki. |
| [Rozłącz ramki] | Każda ramka zostaje ze swoją częścią tekstu. |
| [Poprzednia ramka], [Następna ramka] | Przechodzą do sąsiedniej ramki, także na innej stronie. |

Piszesz w dowolnej ramce, a tekst przelewa się na bieżąco. Wygląd tekstu (czcionka, rozmiar, lista)
jest wspólny dla połączonych ramek. Fioletowa linia pokazuje, dokąd płynie tekst z zaznaczonej ramki.

**Długi tekst przez wiele stron (książka).** Włącz **Dokładaj strony, aż cały tekst się zmieści** — gdy tekst nie
mieści się w ostatniej ramce, za jej stroną dochodzą nowe strony (w tej samej sekcji, z jej wzorcami) z ramką
w tym samym miejscu i rozmiarze. Gdy tekstu ubędzie, puste dołożone strony na końcu znikają. Strony dochodzą po
zakończeniu pisania (Esc albo kliknięcie obok), po wklejeniu i po zmianie wyglądu tekstu.

**Akapit od nowej strony** (np. rozdział): ustaw kursor w akapicie i włącz **Ten akapit od nowej strony** — akapit
i wszystko po nim przechodzi do następnej ramki. Wybór jest przy każdym akapicie osobno: rozdział może zaczynać się
od nowej strony albo płynąć dalej. Z włączonym dokładaniem stron następna ramka powstaje sama.

![Kolumny, listy i tabela](uklad.png)

## 5.8 Czcionki

Do wyboru są 55 rodzin czcionek z polskimi znakami, które wolno używać w druku komercyjnym:
bezszeryfowe do tekstu (np. Inter, Lato, Roboto), wąskie do nagłówków (Oswald, Bebas Neue),
szeryfowe (Lora, Merriweather, Playfair Display, EB Garamond), odręczne i ozdobne (Caveat,
Pacifico, Dancing Script), komiksowe (Bangers do okrzyków, Comic Neue i Pangolin do dialogów) oraz maszynowe.
Większość ma też litery ukraińskie (cyrylicę) – m.in. Inter, Roboto, Lora i Pangolin; gdy krój ich nie ma,
eksport PDF o tym powie (taki tekst idzie jako obraz).

[⋯] → [Czcionki projektu…] pokazuje próbki, daje pliki czcionek do pobrania (np. dla drukarni) i pozwala
wgrać **własną czcionkę** (TTF, OTF, WOFF, WOFF2; każda odmiana osobno) — także z listy czcionek:
[+ Wgraj własną czcionkę…]. Wgrana czcionka zostaje na koncie, w „Moich czcionkach”.

> Wskazówka: Do druku własną czcionkę najlepiej wgrać jako TTF albo OTF, osobny plik dla pogrubienia
> i kursywy. Inne pliki trafią do PDF jako krzywe — tekst będzie ostry, ale nie da się go zaznaczyć.

![Okno czcionek](czcionki.png)

Na górze listy **Czcionka** są **Użyte w projekcie** — czcionki z tekstów wszystkich stron, wzorców
i stylów, najczęstsze najpierw, z liczbą użyć (np. „Inter · 5×”). Niżej jest pełna lista.

![Użyte w projekcie na liście czcionek](k-czcionki-uzyte.png)

Gdy masz zestaw marki (→ 27.9), nad nimi jest grupa **Marka** — czcionka nagłówków i czcionka tekstu marki.

## 5.9 Skład akapitu

Zwijana część **Skład akapitu** we właściwościach tekstu decyduje o tym, jak tekst łamie się na wiersze.
Te same ustawienia zapiszesz w stylu (→ 5.4).

| Ustawienie | Co robi |
|---|---|
| **Polskie zasady składu** | Włączone w nowych tekstach. Wiersz nie łamie się po skrócie (np., tj., ul., dr…), po inicjale (J. Kowalski), między liczbą a jednostką, datą albo dalszymi cyframi (5 kg, 12 maja, 10 000), a myślnik nie zaczyna wiersza — jak w normach PN-83/P-55366 i PN-70/P-55036. Z **Dziel wyrazy**: najwyżej 3 dzielone wiersze pod rząd, co najmniej 2 litery przed łącznikiem i 3 po nim, bez dzielenia ostatniego wyrazu akapitu i wyrazów od wielkiej litery (wyraz dłuższy niż wiersz dzieli się zawsze). Przy justowaniu odstępy mogą się też lekko ścisnąć (do 20 %), więc wierszy z dziurami jest mniej. W tekście płynącym przez ramki tytuł (krótki akapit większym albo pogrubionym pismem) nie zostaje sam na końcu ramki — przechodzi z następnym akapitem, a ramki na lewej i prawej stronie rozkładówki kończą się na tej samej wysokości (wyrównanie łamów: gdy wdowy albo tytuł skróciły jedną, druga też jest krótsza). Pod przełącznikiem są uwagi o miejscach niezgodnych z zasadami i przycisk **Popraw znaki**: cudzysłowy „…” zamiast prostych, półpauza (–) zamiast dywizu między spacjami, wielokropek (…) zamiast trzech kropek, bez podwójnych spacji i spacji przed przecinkiem — formatowanie fragmentów zostaje. |
| **Łam cały akapit naraz** | Włączone w nowych tekstach. Wiersze akapitu są dobierane razem, a nie po kolei — jak „kompozytor akapitu” w programach DTP. Program waży wszystkie możliwe miejsca złamania i wybiera układ z najrówniejszymi odstępami między wyrazami i jak najmniejszą liczbą dzielonych wyrazów; zasady polskiego składu dalej obowiązują. Najlepiej widać to przy justowaniu: zamiast jednego wiersza z wielkimi dziurami odstępy rozkładają się po kilku wierszach. Akapit, który opływa inny element, ma inicjał albo tabulatory, łamie się wiersz po wierszu. |
| **Dziel wyrazy** | Długie wyrazy dzielą się na końcu wiersza według polskich zasad — wyjustowany tekst nie ma wtedy dziur. Obok ustawisz najkrótszy dzielony wyraz i ile liter zostaje przed łącznikiem i po nim. |
| **Spójniki na końcu wiersza** | Pojedyncze **a, i, o, u, w, z** (albo też dwuliterowe: do, na, że…) przechodzą do następnego wiersza razem ze słowem, jak w polskim składzie. |
| **Wdowy i sieroty** | Tekst płynący przez kilka ramek (→ 5.7) nie zostawia samotnego wiersza akapitu na dole ani na górze ramki. |
| **Wyrównaj do siatki linii bazowych** | Wiersze stają na liniach siatki sekcji (→ 5.13). |
| **Nie opływaj innych elementów** | Tekst leży na elementach z oblewaniem, zamiast je opływać (→ 5.12) — np. podpis na zdjęciu. |

![Skład akapitu we właściwościach tekstu](k-sklad-akapitu.png)

**Ostrzeżenia o składzie.** Tekst niezgodny z polskimi zasadami (spójnik albo skrót na końcu wiersza, liczba oddzielona od jednostki, myślnik na początku wiersza, więcej niż 3 dzielone wiersze pod rząd, podzielony ostatni wyraz akapitu, bardzo krótki ostatni wiersz akapitu, rozstrzelony wiersz, cudzysłów prosty, trzy kropki, podwójne spacje…) pojawia się w ostrzeżeniach edytora i w kontroli przed drukiem (→ 20.1) z przykładem miejsca. Ostrzeżenie dla celowego tekstu wyciszysz przyciskiem **Wycisz**.

## 5.10 Inicjał

Inicjał to powiększona pierwsza litera akapitu, na kilka wierszy. W części **Skład akapitu** wybierz
**Inicjał**: **na 2 wiersze** … **na 5 wierszy**. Litera rośnie od górnej krawędzi pierwszego wiersza
do linii bazowej ostatniego, a tekst ją opływa. **Czcionka inicjału** i **Kolor inicjału** mogą być inne
niż w tekście.

Inicjał dostaje pierwszy akapit tekstu. W tekście płynącym przez kilka ramek — tylko w pierwszej ramce.

![Inicjał, dzielenie wyrazów, tabulatory z kropkami i tekst opływający koło](sklad.png)

## 5.11 Tabulatory

Klawisz <kbd>Tab</kbd> w pisanym tekście wstawia tabulator: tekst za nim przeskakuje do najbliższej pozycji.
Bez ustawionych pozycji tabulatory stoją co 12,5 mm.

W części **Skład akapitu** [Dodaj tabulator] dodaje pozycję. Każda ma:

| Pole | Znaczenie |
|---|---|
| **Tabulator N** | Pozycja w mm od lewej krawędzi ramki. |
| **Wyrównanie** | **do lewej**, **do środka**, **do prawej** albo **do przecinka** (liczby z przecinkiem jedna pod drugą). |
| **Wypełnienie** | Pusto, kropki, kreski albo linia przed tekstem — np. spis treści „Rozdział 1 . . . . . 12”. |

![Tabulator do prawej z kropkami](k-tabulatory.png)

## 5.12 Oblewanie tekstem

Zdjęcie, kształt albo grupa może odpychać tekst. Zaznacz element i w części **Inne** wybierz **Oblewanie tekstem**:

| Wartość | Znaczenie |
|---|---|
| **tekst opływa ramkę elementu** | Wiersze kończą się przed prostokątem elementu (albo zaczynają za nim). |
| **tekst opływa kształt** | Dla elipsy, wielokąta i kształtu z pióra — wiersze idą wzdłuż jego brzegu. |
| **tekst przeskakuje pod element** | Obok elementu nie ma tekstu, ciąg dalszy jest pod nim. |

**Odstęp tekstu od elementu** to wolne miejsce wokół elementu (domyślnie 2 mm). Oblewanie działa na
wszystkie teksty na stronie — także w trakcie przesuwania elementu. Tekst wybiera tę stronę elementu,
po której ma więcej miejsca.

![Oblewanie tekstem w części Inne](k-oblewanie.png)

## 5.13 Siatka linii bazowych

Siatka linii bazowych ustawia wiersze wszystkich kolumn i stron na tej samej wysokości — jak w książkach,
w których wiersze z obu stron kartki pokrywają się pod światło.

1. W ustawieniach sekcji (→ 10.4) włącz **Siatka linii bazowych w tej sekcji**: **Odstęp** (zwykle interlinia
   tekstu podstawowego) i **Pierwsza linia** (mm od górnej krawędzi strony, zwykle górny margines).
2. W menu widoku (→ 3.6) **Siatka linii bazowych** pokazuje te linie na stronie.
3. Tekstom, które mają stać na siatce, włącz **Wyrównaj do siatki linii bazowych** (→ 5.9) — najlepiej w stylu
   tekstu podstawowego.

## 5.14 Tekst po łuku, okręgu i ścieżce; wyginanie

Zaznacz tekst i w części **Kształt tekstu** panelu wybierz **Kształt**. Gotowe przykłady znajdziesz też w [Biblioteka], w kategorii **Teksty**.

![Tekst po łuku, w okręgu i wygięty](k-ksztalt-tekstu.png)

| Kształt | Co robi i co ustawisz |
|---|---|
| **Łuk** | Napis po łuku. **Zgięcie** w %: dodatnie – łuk w górę, ujemne – w dół. |
| **Okrąg**, **Elipsa** | Napis dookoła, np. pieczęć: promień, początek, litery na zewnątrz albo do środka. |
| **Po ścieżce** | Napis po linii dowolnego kształtu ze strony (narysowanego piórem albo z Biblioteki) — wybierz go w **Linia z kształtu na stronie**. |
| **Wygięcie** | Litery wygięte jak łuk, wypukłość, fala, flaga albo zwężenie; **Siła wygięcia** w %. |

- Przy łuku i wygięciach uchwyt ◆ pod tekstem zgina tekst mocniej albo słabiej.
- Kliknij tekst dwa razy, żeby go poprawić — w trakcie pisania stoi prosto.
- Tekst po kształcie jest jednym wierszem; czcionka, kolor, style i pola `{…}` działają jak zwykle.
- **Prosto** przywraca zwykły tekst.

## 5.15 Znajdź i zamień

Lupa na górnym pasku albo [⋯] → [Znajdź i zamień…] (<kbd>Ctrl</kbd>+<kbd>F</kbd>; <kbd>Ctrl</kbd>+<kbd>H</kbd> —
od razu z polem zamiany).

![Znajdź i zamień obok strony](k-znajdz.png)

1. Wpisz szukany tekst. Lista pokazuje każde trafienie: stronę albo wzorzec i kawałek tekstu wokół.
2. Kliknij trafienie (albo <kbd>Enter</kbd> w polu, <kbd>Shift</kbd>+<kbd>Enter</kbd> — wstecz) — edytor
   otworzy tę stronę i zaznaczy znaleziony fragment.
3. Żeby zamienić, wpisz nowy tekst w drugim polu i kliknij [Zamień] (wybrane trafienie)
   albo [Zamień wszystkie].

| Opcja | Znaczenie |
|---|---|
| **Wielkość liter** | „Kalendarz” nie znajdzie „kalendarz”. |
| **Całe słowa** | „kot” nie znajdzie „kotka”. |
| **Także w danych** | Szuka też w komórkach tabel danych (→ 14). |
| **W nazwach stylów** | Szuka też w nazwach stylów akapitu i znakowych (→ 5.4). |

- Szukanie obejmuje wszystkie strony i wzorce, także teksty w grupach.
- Pola w klamrach, np. `{miesiac}`, zostają nietknięte — chyba że wpiszesz klamrę w szukanym tekście.
- Wygląd fragmentów (np. pogrubione słowo) zostaje na swoim miejscu po zamianie.
- [Zamień wszystkie] cofniesz jednym [Cofnij].

## 5.16 Sprawdzanie pisowni

Słowa spoza słownika polskiego są podkreślone falistą czerwoną linią — tylko w edytorze, nigdy w PDF.

![Podpowiedzi przy podkreślonym słowie](k-pisownia-dymek.png)


1. Kliknij tekst dwa razy i kliknij (na telefonie stuknij) podkreślone słowo — albo kliknij je prawym przyciskiem
   myszy. Obok słowa pojawi się dymek z podpowiedziami i [Dodaj do słownika].
2. Kliknij podpowiedź (np. „wcześniej”) — słowo zmieni się w tym miejscu.
3. Nazwę własną, której słownik nie zna (np. nazwę firmy), dodaj przyciskiem [Dodaj do słownika].
   Twój słownik jest na koncie, więc działa w każdym projekcie.

Wszystkie podejrzane słowa zaznaczonego tekstu widać też w panelu, w części **Pisownia** — tam podpowiedź
zmienia słowo we wszystkich miejscach tego tekstu.

![Część „Pisownia” w panelu tekstu](k-pisownia.png)

- Pomijane są pola `{…}`, liczby, słowa z cyframi, adresy stron i e-maile.
- Wyłączysz sprawdzanie w menu widoku: **Sprawdzaj pisownię**.

## 5.17 Tekst AI: poprawianie i tłumaczenie

AI poprawi, skróci albo przetłumaczy tekst – w każdym projekcie. Pisze Google Gemini Twoim kluczem (jak klucz zdobyć –
→ 7.11); jedna zmiana kosztuje ułamek grosza.

1. Zaznacz ramkę tekstu – zmienisz cały tekst. Albo kliknij w tekst dwa razy i zaznacz fragment – zmienisz tylko jego.
2. Kliknij [AI ▾] na pasku wstawiania → **Popraw albo przetłumacz tekst…**.
3. Kliknij, co zrobić: [Skróć], [Wydłuż], [Prościej], [Uroczyściej], [Popraw błędy], [Na polski], [Na angielski] albo
   [Na ukraiński].
4. Po chwili wynik jest w polu **Wynik (możesz go poprawić)**. Popraw go, jeśli chcesz, albo kliknij inny przycisk,
   żeby spróbować inaczej.
5. [Zastąp] wstawia wynik w miejsce tekstu. <kbd>Ctrl</kbd>+<kbd>Z</kbd> cofa.

Pola w klamrach, np. `{imie}`, zostają bez zmian.

**Tłumaczenie całego projektu.** Dla wielu tekstów naraz (np. kalendarz w trzech językach) trzymaj teksty w tabeli
danych i przetłumacz kolumnę: przycisk **✦** przy nazwie kolumny w oknie **Dane** (→ 14.6), np. „przetłumacz kolumnę
opis na angielski”. Inne zmiany w wielu miejscach naraz zrobi asystent AI (→ 25.6).

# 6. Kształty, linie i kolory

Kształty, linie, rysowanie i kolory: wypełnienia, przejścia i obrysy.

## 6.1 Prostokąt, elipsa i wielokąt

[Kształty ▾] → **Prostokąt**, **Elipsa** i **Wielokąt albo gwiazda** wstawiają kształty z wypełnieniem i obrysem (→ 6.5, 6.6).
**Wielokąt albo gwiazda** najpierw pokazuje wybór: trójkąt, romb, pięcio-, sześcio- i ośmiokąt albo gwiazda o 4, 5, 6, 8
lub 12 ramionach. Klawisz <kbd>P</kbd> wstawia od razu trójkąt.
Część **Kształt**:

- prostokąt — **Zaokrąglenie** narożników w mm,
- wielokąt — te same gotowe kształty co przy wstawianiu (trójkąt … gwiazda 12), **Liczba boków** (3–24)
  i przełącznik **Gwiazda**; zmiana zachowuje miejsce i wielkość.

## 6.2 Linia

[Kształty ▾] → **Linia** wstawia odcinek. Część **Linia**: **Kolor**, **Grubość** w mm i **Rodzaj** — ciągła, przerywana,
kropkowana albo kreska – kropka (kreski rosną razem z grubością). Z <kbd>Shift</kbd> linia jest
pozioma, pionowa albo pod kątem 45°. Linia rysowana odręcznie i kształt z pióra mają tę samą część,
a zamknięty kształt z pióra — także **Wypełnienie**. Gotowe linie (cienka, gruba, przerywana, podwójna,
pionowa, ozdobne) są w Bibliotece, w kategorii **Linie i separatory** (→ 4.8).

## 6.3 Rysowanie odręczne

[Kształty ▾] → **Rysowanie odręczne** (<kbd>B</kbd>): przeciągaj po stronie jak ołówkiem — drżenie ręki jest wygładzane. Każde
pociągnięcie to osobny element. Tryb zostaje włączony, więc narysujesz kilka kresek.

Kolor i grubość następnych linii ustawisz we właściwościach, w części **Pędzel** (→ 3.5).
[Zakończ rysowanie] albo <kbd>Esc</kbd> kończy rysowanie.

![Rysowanie: kolor i grubość pędzla](k-rysowanie.png)

## 6.4 Pióro i edycja punktów

[Kształty ▾] → **Pióro** (<kbd>N</kbd>) tworzy kształt z punktów:

- kliknięcie stawia punkt narożny, kliknięcie z przeciągnięciem — punkt z łukiem,
- kliknięcie w pierwszy punkt zamyka kształt,
- <kbd>Enter</kbd> albo podwójne kliknięcie kończy kształt otwarty,
- <kbd>Backspace</kbd> cofa ostatni punkt, <kbd>Esc</kbd> porzuca zaczęty kształt.

**Edycja punktów:** kliknij kształt dwa razy albo wybierz [Edytuj punkty]. Przeciągaj punkty,
a uchwytami zaznaczonego punktu zmieniaj łuki. Podwójne kliknięcie w linię dodaje punkt,
<kbd>Delete</kbd> usuwa zaznaczony. <kbd>Enter</kbd> zatwierdza, <kbd>Esc</kbd> przywraca kształt
sprzed edycji. Tak samo zmienisz linię rysowaną odręcznie.

![Edycja punktów](pioro.png)

## 6.5 Wypełnienie

Część **Wypełnienie i obrys**, lista **Wypełnienie**:

**Brak**, **Jeden kolor**, **Przejście liniowe** (w jednym kierunku, pod zadanym **Kątem**),
**Przejście kołowe** (od środka na zewnątrz, zasięg — **Promień**) albo **Wzór**.

Pasek przejścia pokazuje kolory. [Dodaj kolor] dokłada kolejny; kliknięcie koloru na pasku pozwala
zmienić go i jego położenie w %, [Usuń ten kolor z przejścia] go usuwa.

Każdy kolor przejścia ma pole **Krycie** — np. kolor przechodzący w przezroczystość nad zdjęciem.

![Krycie koloru w przejściu](k-krycie-przejscia.png)

**Wzór** wypełnia kształt powtarzalnym wzorem z Biblioteki — paski, kropki, kratka, jodełka, fale i inne.
Wybierasz go z kafelków, a pod nimi ustawiasz **Kolor wzoru**, **Kolor tła**, **Skalę wzoru** i **Obrót wzoru**.
Wzór nie rozciąga się, gdy zmieniasz rozmiar kształtu, a w pliku PDF zostaje ostry (wektorowy). Zamknięty
kształt z pióra i kształty z Biblioteki mają w części **Linia** przełącznik **Wypełnij wzorem**. Kafelek wzoru
w Bibliotece przy zaznaczonym kształcie pyta, czy [Wypełnij zaznaczony kształt], czy [Wstaw na stronę].

![Kształty wypełnione wzorem](k-wzor-ksztaltu.png)

## 6.6 Obrys

Kolor obrysu i **Grubość obrysu** w mm. Grubość nie zmienia się, gdy powiększasz kształt. Przy włączonym
obrysie są też **Krycie obrysu** (półprzezroczysta ramka) i **Rodzaj linii** — ciągła, przerywana, kropkowana
albo kreska – kropka; kreski rosną razem z grubością.

Kształt (także z obrazem w środku) może mieć **Miękkie krawędzie** — tak jak zdjęcie (→ 7.10).

## 6.7 Wybór koloru

Kliknięcie kółka koloru otwiera okno koloru: próbnik, **Kod koloru** (np. `#2f5bd3`), gotowe i ostatnio
używane kolory oraz **Użyte w projekcie** — kolory ze wszystkich stron, wzorców i stylów, najczęstsze
najpierw (przy kolorze dodatkowym widać jego nazwę, np. „PANTONE 186 C”, → 22.1).

![Użyte w projekcie w oknie koloru](k-kolory-uzyte.png)

Gdy masz zestaw marki (→ 27.9), nad „Użytymi w projekcie” jest część **Marka** — kolory marki z nazwami
(nazwę i kod widać po najechaniu).

![Kolory marki w oknie koloru](k-marka-kolor.png)

# 7. Obrazy

Zdjęcia i grafiki: wstawianie, kadrowanie, ramki, filtry i usuwanie tła.

## 7.1 Wstawianie obrazu

[Obraz] pyta, skąd wziąć obraz:

- [Wgraj z urządzenia] — wybór pliku PNG, JPEG, WebP, GIF albo SVG,
- [Wybierz z obrazów projektu] — obraz, który już jest w projekcie, bez drugiej kopii.

W projekcie bez obrazów od razu otwiera się wybór pliku. Obraz wstawisz też, przeciągając plik
na stronę albo wklejając ze schowka (<kbd>Ctrl</kbd>+<kbd>V</kbd>) — np. zrzut ekranu albo
obraz skopiowany ze strony internetowej.

## 7.2 Kadrowanie

Kliknij obraz dwa razy albo wybierz [Kadruj przeciąganiem]: przesuwasz zdjęcie w ramce i zmieniasz
jej brzegi. <kbd>Enter</kbd> zatwierdza, <kbd>Esc</kbd> anuluje. To samo liczbami: **Przycięcie
(% oryginału)** — **Z góry**, **Z dołu**, **Z lewej**, **Z prawej**.

## 7.3 Właściwości obrazu

| Ustawienie | Znaczenie |
|---|---|
| [Podmień zdjęcie] | Inne zdjęcie w tej samej ramce (→ 7.4). |
| [Obrazy projektu…] | Okno wszystkich obrazów (→ 7.5). |
| Opis pod nagłówkiem | Wymiary oryginału w pikselach i rozdzielczość w tym rozmiarze (dpi). Do druku — co najmniej 300 dpi; przy mniejszej opis zmienia kolor. |
| **Obramowanie** | Ramka wokół zdjęcia: kolor, **Grubość**, **Krycie obrysu**, **Rodzaj linii** (ciągła, przerywana, kropkowana, kreska – kropka) i **Zaokrąglenie narożników** w mm — zaokrąglenie przycina też samo zdjęcie (→ 7.10). |
| **Odbij lustrzanie w poziomie** | Odwraca obraz. |
| **Obraz z danych** | Inny obraz na każdej powielonej stronie (→ 17.5). |

## 7.4 Podmiana zdjęcia

[Podmień zdjęcie] wstawia inny plik w tę samą ramkę: rozmiar, miejsce, obrót, obrys i cień zostają,
a zdjęcie o innych proporcjach jest przycięte do ramki.

## 7.5 Okno Obrazy projektu

[⋯] → [Obrazy projektu…] pokazuje wszystkie obrazy projektu: miniaturę, pełną nazwę pliku, wymiary,
rozmiar i miejsca użycia (numery stron, wzorce, tabele danych).

| Przycisk | Co robi |
|---|---|
| [Wgraj obrazy…] | Dodaje pliki z urządzenia, kilka naraz — także archiwum ZIP z obrazami. |
| [Kopiuj nazwę] | Na karcie obrazu: kopiuje nazwę pliku, np. do tabeli danych. |
| [⋯] na karcie | Rzadsze działania dla tego obrazu: [Zmień nazwę], [Podmień plik…], [Kopiuj nazwę], [Usuń obraz…]. |
| [Zmień nazwę] | Nowa nazwa (także kliknięciem nazwy); komórki tabel z tą nazwą zmieniają się razem z nią. |
| [Podmień plik…] | Nowy plik w miejsce starego — wszędzie, gdzie obraz był użyty. |
| [Usuń] | Usuwa zaznaczone obrazy. Użytych obrazów aplikacja nie usunie — powie, gdzie są. |
| [Usuń nieużywane] | Usuwa obrazy, których nic nie używa. |

![Menu ⋯ na karcie obrazu](k-menu-obrazu.png)

Kliknięcie obrazu go zaznacza; <kbd>Ctrl</kbd> dodaje kolejne, <kbd>Shift</kbd> — cały zakres.
Ten sam plik wgrany drugi raz nie tworzy kopii. Inny plik o tej samej nazwie — aplikacja pokaże
oba obrazy i zapyta: [Zastąp], [Zachowaj oba] albo [Pomiń]. Gdy projekt ma powtórzone obrazy sprzed tego
okna, u góry pojawia się pasek z [Uporządkuj] — scala kopie w jeden plik. Przy kilku zaznaczonych obrazach
[Kopiuj nazwy] kopiuje wszystkie nazwy naraz, np. do kolumny tabeli danych.

> Uwaga: Usuniętego obrazu nie przywróci [Cofnij].

![Obrazy projektu](obrazy-projektu.png)

## 7.6 Rysunki SVG

Plik SVG wstawia się jako obraz: wygląda wiernie i zostaje ostry w każdym powiększeniu, ale nie
zmienisz w nim kolorów ani napisów.

[Rozłóż rysunek na elementy] (we właściwościach obrazu) zamienia go na stronie w **grupę zwykłych
kształtów i napisów** w tym samym miejscu. Kształtom zmienisz kolor i punkty, napisy poprawisz
jak każdy tekst. Plik SVG nie zmienia się i zostaje w oknie obrazów projektu.

Nic przy tym nie znika:

- **przycięcie** i **przejścia kolorów** zostają kształtami,
- **prosta maska** (biały kształt) staje się przycięciem, a **wzór** (np. kropki, kratka) — powtórzonymi
  kształtami przyciętymi do swojej figury,
- fragmenty z **efektami, których edytor nie ma** (rozmycie, cień z filtra, maska z przejściem, mieszanie
  kolorów, groty linii, tekst po ścieżce) zostają **obrazem** w tym samym miejscu, w rozdzielczości do druku.
  Po rozłożeniu aplikacja powie, ile ich jest; reszta rysunku jest edytowalna.

<kbd>Ctrl</kbd>+<kbd>Z</kbd> przywraca cały rysunek.

![Rysunek SVG przed i po rozłożeniu](rysunek-svg.png)

## 7.7 Obraz w kształcie

Każdy kształt może być ramką obrazu: prostokąt, elipsa, wielokąt, gwiazda i zamknięty kształt z pióra.

1. Zaznacz kształt i w części **Obraz w kształcie** wybierz [Wstaw obraz do kształtu] — albo upuść plik obrazu prosto na kształt.
2. Obraz wypełnia kształt i jest przycięty do jego brzegów.
3. Kliknij kształt dwa razy, żeby przesunąć obraz i powiększyć go narożnikami; <kbd>Enter</kbd> zatwierdza, <kbd>Esc</kbd> anuluje. Na telefonie użyj pól **Powiększenie** i **Przesunięcie**.

![Kształt z obrazem i część „Obraz w kształcie”](k-obraz-w-ksztalcie.png)

![Kadrowanie obrazu w kształcie: cały obraz półprzezroczyście, kształt jako obrys](obraz-w-ksztalcie-kadr.png)

Kształt zmieniasz jak zwykle — rozmiar, punkty, obrys, cień — a obraz idzie za nim. [Wyjmij obraz] zostawia zwykły obraz w miejscu kształtu. Na stronach z danymi wybierz **Obraz z kolumny**: na każdej stronie pojawi się inny obraz.

Zdjęcie zamienisz w kształt jednym kliknięciem: w części **Kadrowanie** [Zaokrąglone rogi] albo [Koło]. Zaokrąglenie zmienisz potem w części **Wypełnienie i obrys**.

## 7.8 Usuwanie tła

Zaznacz zdjęcie (albo kształt z obrazem) i wybierz [Usuń tło…].

| Narzędzie | Co robi |
|---|---|
| **Różdżka** | Kliknij tło — znika kolor podobny do klikniętego. **Tolerancja** mówi, jak podobny. |
| **Tylko połączone z klikniętym miejscem** | Nie rusza takich samych kolorów w środku zdjęcia. |
| **Usuń** / **Przywróć** | Pędzle do poprawek brzegów, myszą albo palcem. |
| **Wygładzenie krawędzi** | Zmiękcza brzeg. |

[Zapisz jako nowy obraz] dodaje nowy plik do obrazów projektu i wstawia go w miejsce starego; oryginał zostaje.

![Okno „Usuń tło”](usun-tlo.png)

## 7.9 Filtry

W części **Filtry** zdjęcia albo obrazu w kształcie ustawisz **jasność**, **kontrast**, **nasycenie** i **rozmycie** oraz włączysz **odcień szarości** albo **sepię**. Plik się nie zmienia; [Bez filtrów] wraca do oryginału.

![Filtry obrazu](k-filtry.png)

## 7.10 Obramowanie i miękkie krawędzie

Część **Obramowanie** zdjęcia: kolor (pole **brak** wyłącza ramkę), **Grubość** w mm, **Krycie obrysu**,
**Rodzaj linii** i **Zaokrąglenie narożników** w mm. Zaokrąglenie przycina samo zdjęcie, a obramowanie
idzie po zaokrągleniu. Grubość i zaokrąglenie zostają takie same, gdy zmieniasz rozmiar zdjęcia.

Część **Miękkie krawędzie** (zdjęcie i kształty): **Szerokość przejścia** w mm — tyle od brzegu zdjęcie
płynnie znika w przezroczystość; 0 to ostry brzeg. **Rodzaj**:

| Rodzaj | Wygląd |
|---|---|
| **równo wzdłuż brzegu** | Przejście biegnie wzdłuż brzegu — prostokąta, kształtu albo przezroczystych miejsc obrazu PNG. |
| **owalna winieta** | Widać owal w środku, który miękko znika ku brzegom i narożnikom. |

![Obramowanie z zaokrągleniem i owalna winieta](k-obramowanie.png)

Obramowanie, zaokrąglenie i miękkie krawędzie przenosi też [Kopiuj wygląd] (→ 4.13).

## 7.11 Obraz AI

AI narysuje obraz z opisu – w każdym projekcie, nie tylko w komiksie. Rysuje go Google Gemini Twoim kluczem; koszt
rozliczasz u Google, a Makietka pokazuje go przed każdym generowaniem.

![Okno Obraz AI](k-obraz-ai.png)

1. Zaznacz ramkę, kształt albo kadr komiksu, który ma wypełnić obraz. Bez zaznaczenia obraz trafi na środek strony.
2. Kliknij [AI ▾] na pasku wstawiania → **Obraz z opisu…**.
3. W polu **Co ma być na obrazie** opisz po swojemu: kto, co robi, gdzie, jaki nastrój i styl, np. „Rudowłosa
   dziewczynka z żółtym plecakiem macha na brukowanej uliczce, ranek, kolorowa ilustracja dla dzieci”.
4. Wybierz **Jakość**: **Szkic – szybko i najtaniej** (do prób), **Dokładny – do druku** albo **Najlepszy – postacie
   i szczegóły**.
5. **Kształt obrazu** (kwadrat, pionowy, poziomy, panorama, wysoki) jest dobrany do ramki – zmień go tylko przy
   obrazie na stronę.
6. Sprawdź **Koszt** (i ile wydałeś w tym miesiącu) i kliknij [Generuj]. Po 10–30 sekundach obraz jest w ramce
   i w oknie **Obrazy projektu**.

| Jakość | Do czego | Ok. koszt jednego obrazu |
|---|---|---|
| Szkic | próby, podgląd, obrazy na ekran | 0,14 zł |
| Dokładny | druk | 0,41 zł |
| Najlepszy | druk, postacie i drobne szczegóły | 0,55 zł |

- **Napisów w obrazie nie ma** – Makietka prosi AI, żeby ich nie rysowało, i żeby obraz wypełniał całą ramkę, bez
  białych brzegów. Tekst dodajesz w Makietce (ramki tekstu, dymki), więc łatwo go poprawić i przetłumaczyć.
- **Jeszcze raz:** zaznacz ramkę z obrazem z AI i znów [AI ▾] → **Obraz z opisu…**. Okno ma opis, z którego powstał
  obecny obraz – popraw w nim, co chcesz, albo generuj bez zmian. Poprzednie wersje zostają w **Obrazach projektu**
  – wrócisz do nich jednym wyborem (→ 7.5).
- **Popraw obecny obraz:** zaznacz ramkę z obrazem (z AI albo Twoim) i wybierz [AI ▾] → **Popraw obraz w ramce…** – albo
  w oknie **Obraz z opisu…** odpowiedz na pytanie **Co zrobić z obrazem w ramce**.
  Wybierz **Popraw obecny obraz – opisz tylko zmianę** i napisz samą zmianę, np. „dodaj dziewczynce czerwony
  kapelusz” albo „zmień porę na wieczór”. AI dostaje obecny obraz i zmienia tylko to, o co prosisz – reszta zostaje.
  **Narysuj od nowa** rysuje cały obraz z opisu.
- **Bez klucza Google Gemini** pozycje rysowania i pisania w [AI ▾] są wyszarzone, a na górze menu jest **Nie masz
  klucza do generowania obrazów i tekstów – dodaj klucz…** – otwiera ustawienia AI, gdzie dodasz klucz (niżej).
- **Ile wydałeś:** [Ustawienia konta] → **Sztuczna inteligencja** pokazuje wydatki z tego miesiąca na tym urządzeniu.
  Tam ustawisz też **Miesięczny limit wydatków na obrazy i teksty AI** – po jego przekroczeniu Makietka nie wygeneruje
  obrazu ani tekstu, dopóki limitu nie zmienisz.
- Obraz narysuje też asystent AI na Twoje polecenie, np. „wstaw na stronę 3 zdjęcie zachodu słońca nad morzem”
  (→ 25.6) – w rozmowie napisze, co rysuje i ile to mniej więcej kosztuje.

**Jak zdobyć klucz Gemini**

1. Wejdź na stronę Google AI Studio (aistudio.google.com) i zaloguj się kontem Google.
2. Kliknij **Get API key** → **Create API key**. Skopiuj klucz.
3. Żeby generować obrazy, w Google AI Studio włącz płatności (**Billing**) – bez nich działają tylko darmowe teksty.
4. W Makietce: [Ustawienia konta] → **Sztuczna inteligencja** → **Czat w Makietce** → [Dodaj klucz] → **Google Gemini**,
   wklej klucz. Za pierwszym razem ustalisz **hasło do kluczy AI** – klucz jest zaszyfrowany (→ 25.6).

# 8. Tabela

Tabela na stronie — do cenników, planów, list. To co innego niż tabela danych do powielania stron (→ 14).

## 8.1 Wstawianie tabeli

[Tabela] otwiera okno **Wstaw tabelę**:

| Pole | Znaczenie |
|---|---|
| **Wiersze** | Liczba wierszy (1–60). |
| **Kolumny** | Liczba kolumn (1–12). |
| **Najmniejsza wysokość wiersza (mm)** | Wiersz nie będzie niższy; rośnie, gdy tekst się nie mieści. |
| **Pierwszy wiersz to nagłówek** | Pierwszy wiersz pogrubiony, z grubszą linią pod spodem. |

Tabelę przesuwasz, powiększasz i obracasz w całości, jak każdy element. **Pojedyncze kliknięcie
komórki** zaznaczonej tabeli wybiera tę komórkę (→ 8.3), **dwukrotne** — zaczyna w niej pisanie (→ 8.2).

![Tabela](tabela.png)

## 8.2 Pisanie w komórkach

Kliknij komórkę dwa razy, żeby w niej pisać. <kbd>Tab</kbd> przechodzi do następnej komórki,
<kbd>Shift</kbd>+<kbd>Tab</kbd> do poprzedniej; <kbd>Tab</kbd> w ostatniej komórce dodaje wiersz.
Komórka to zwykły tekst: pogrubisz w niej fragment, zmienisz czcionkę, wstawisz pole z danych
(→ 15). Wiersz rośnie razem z tekstem — także na stronach powielonych z danych.

## 8.3 Wiersze, kolumny i ich rozmiar

**Cała tabela**: **Wiersze** i **Kolumny** [−] [+] (ostatni wiersz i kolumna), **Pierwszy wiersz to nagłówek**,
**Szerokość tabeli** w mm (kolumny zmieniają się proporcjonalnie), **Wysokość wierszy** (najmniejsza — wiersz
rośnie sam z tekstem) i [Wyrównaj szerokości kolumn].

![Cała tabela](k-tabela-cala.png)

**Kolumna i wiersz** — kliknij raz komórkę zaznaczonej tabeli (albo pisz w niej): szerokość tej kolumny
i wysokość tego wiersza w mm, [Kolumna przed], [Kolumna po], [Wiersz nad], [Wiersz pod] i usuwanie.

![Kolumna i wiersz wybranej komórki](k-tabela-komorka.png)

**Szerokości wszystkich kolumn** (część zwinięta) — szerokość każdej kolumny w mm, jedna pod drugą.

Granicę kolumn przesuniesz też myszą: przy zaznaczonej tabeli nad granicami kolumn są niebieskie
znaczniki. Kolumna obok zwęża się o tyle samo, a ostatni znacznik zmienia szerokość całej tabeli.

## 8.4 Scalanie komórek

W trakcie pisania w komórce: [Scal z komórką po prawej] i [Scal z komórką poniżej]. Klikając kilka
razy, zrobisz komórkę na kilka kolumn albo wierszy. [Rozdziel komórki] wraca do pojedynczych komórek.

## 8.5 Linie i tła

| Część | Co ustawisz |
|---|---|
| **Linie tabeli** | Kolor i grubość linii (0 — bez linii). |
| **Linie wiersza, kolumny, tabeli** | Które linie — zewnętrzne, poziome, pionowe — dla tego wiersza, tej kolumny albo całej tabeli. |
| **Linie tej komórki** | Każda krawędź komórki osobno: jak w tabeli, inna albo bez linii. |
| **Tło wierszy** | Kolor wiersza nagłówka i co drugiego wiersza (tabela w paski). |
| **Tekst w komórkach** | Czcionka, rozmiar, kolor, wyrównanie i odstęp od brzegu komórki. |

# 9. Warstwy

Lista wszystkich elementów strony — do zaznaczania, ukrywania i zmiany kolejności.

## 9.1 Panel Warstwy

Panel **Warstwy** pokazuje wszystkie elementy otwartej strony, od leżącego na wierzchu do leżącego
na spodzie. Na komputerze to zakładka [Warstwy] u góry prawej kolumny (<kbd>F7</kbd>), z liczbą elementów strony;
na telefonie otwiera go przycisk [Warstwy] na dole ekranu.

![Warstwy](warstwy.png)

## 9.2 Wiersz warstwy

| W wierszu | Co robi |
|---|---|
| **Nazwa** | Kliknięcie zaznacza element, podwójne kliknięcie zmienia nazwę. |
| **Uchwyt ⋮⋮** | Przeciągnij wiersz, żeby zmienić kolejność — myszą albo palcem. |
| **Oko** | Ukrywa element. Ukryty element nie jest drukowany. |
| **Kłódka** | Blokuje położenie i rozmiar. |
| [⋯] | [Na wierzch], [Wyżej], [Niżej], [Na spód], [Zmień nazwę], [Kopiuj wygląd] (→ 4.13), [Zapisz w bibliotece] (→ 4.8). |

Zaznaczenie na liście przydaje się, gdy element leży pod innym i trudno w niego trafić na stronie.

## 9.3 Grupy, tabele i wzorce na liście

- Trójkąt przy grupie albo tabeli rozwija jej zawartość. Kliknięcie elementu grupy otwiera grupę z tym
  elementem zaznaczonym (→ 4.5); kliknięcie komórki tabeli zaczyna w niej pisanie.
- Na górze i na dole listy są elementy wzorców strony (nad treścią i pod treścią). Nie zmienisz ich
  tutaj — kliknięcie otwiera wzorzec do edycji (→ 11.5).

# 10. Strony, sekcje i rozkładówki

Kolejność stron, sekcje o różnych formatach, rozkładówki, okładka z grzbietem i numeracja.

## 10.1 Panel stron

Panel z lewej pokazuje miniatury wszystkich stron w kolejności druku, pogrupowane w sekcje
(szare nagłówki). Kliknięcie miniatury otwiera stronę. Strona powielana z danych ma znaczek
**×N** — tyle razy wyjdzie w wydruku (→ 16).
Miniatury zapamiętują się na urządzeniu: przy kolejnym otwarciu projektu pokazują się od razu, a od nowa
rysują się tylko strony zmienione od tamtej pory.

Na telefonie strony stoją w poziomym pasku, który przewijasz palcem.

![Pasek stron na telefonie](k-strony-telefon.png@telefon)

![Panel stron z menu strony](strony.png)

## 10.2 Dodawanie i porządkowanie stron

- Kafelek **+** na końcu stron sekcji dodaje pustą stronę za bieżącą.
- [Sekcja] na dole panelu tworzy nową sekcję.
- **Przeciągnij miniaturę**, żeby zmienić kolejność; upuszczona w innej sekcji przechodzi do niej.
- [⋯] na miniaturze: [Zmień nazwę], [Duplikuj], [Przesuń wyżej], [Przesuń niżej], [Usuń stronę].
- [⋯] przy nagłówku sekcji: [Ustawienia sekcji], [Dodaj stronę do sekcji], [Przesuń sekcję wyżej],
  [Przesuń sekcję niżej], [Usuń sekcję].


## 10.3 Właściwości strony

Gdy nic nie jest zaznaczone, panel właściwości pokazuje ustawienia otwartej strony:

| Ustawienie | Znaczenie |
|---|---|
| **Nazwa strony** | Nazwa na liście stron. |
| **Sekcja** | Przeniesienie strony do innej sekcji. |
| **Tło** | Kolor tła tej strony. |
| **Wzorce** | Wzorce z sekcji albo własny wybór dla tej strony (→ 11.4). |
| **Seria** | Powielanie strony z tabeli danych (→ 16). |
| **Prowadnice** | Prowadnice wpisane liczbą (→ 12.4). |
| [Wklej skopiowane elementy] | Wkleja elementy ze schowka w to samo miejsce. |

![Ustawienia strony: seria](k-seria.png)

## 10.4 Ustawienia sekcji

Sekcja to część publikacji z własnymi ustawieniami, np. „Okładka” i „Środek”. Okno otworzysz
przyciskiem formatu na górnym pasku albo [⋯] przy nagłówku sekcji → [Ustawienia sekcji].

| Ustawienie | Znaczenie |
|---|---|
| **Nazwa sekcji** | Nazwa na liście stron. |
| **Układ stron** | **Pojedyncze** albo **Rozkładówki** (→ 10.5). |
| **Typ sekcji** | Czym sekcja jest w publikacji – karta z ikoną i opisem: **Zwykła**, **Blok (środek książki)**, **Okładka** (→ 10.6), **Wyklejka przednia** i **tylna**, **Obwoluta**, **Wkładka**, **Podkładka / plecy**, **Ulotka składana**, **Kalendarz roczny**, **Kalendarz trójdzielny**, **Wykrojnik**, **Arkusz użytków** (→ 10.11), **Składanka / wycinanka** (→ 10.12), **Komiks** (→ 10.13). Typ sam ustala format, strefy, numerację i grzbiet okładki — nazwa sekcji nie ma na to wpływu. Typ wybierasz przy [Sekcja] i zmieniasz tutaj. |
| **Format** | Rozmiar strony w mm. Zmiana tutaj nie rusza elementów — żeby przeskalować je razem z formatem, kliknij [Zmień format i dopasuj elementy…] (→ 10.9). |
| **Marginesy i spad** | Wpisujesz je na schemacie strony, w mm. |
| **Pierwsza strona sekcji** | W rozkładówkach: **Prawa (jak w książce)** albo **Lewa (od razu pełna rozkładówka)**. Szybciej: w panelu **Właściwości** strony (nic nie zaznaczone) przełącznik **Zacznij sekcję od lewej strony** – zamienia strony lewe i prawe jednym kliknięciem, np. po dodaniu pojedynczej strony. |
| **Numeracja stron** | **Dalszy ciąg poprzedniej sekcji**, **Zacznij od numeru…** albo **Bez numerów (np. okładka)** (→ 10.8). |
| **Składki (pilnuj liczby stron)** | **Bez pilnowania** albo co 4, 8, 16, 32 strony (→ 10.7). |
| **Wzorce na stronach tej sekcji** | Wzorce domyślne stron sekcji (→ 11.4). |
| **Podłoże (na czym drukujesz)** | **Biały papier**, **Kolorowy papier** (z kolorem) albo **Przezroczysta folia**. Kolor papieru widać na stronach, w podglądzie i w makiecie 3D, a folię – jako szachownicę; w PDF podłoże się nie drukuje (to papier, nie farba). Biel nie jest farbą: na kolorowym papierze i folii białe elementy wyjdą w kolorze podłoża – ustaw im **Biały poddruk** (Kolory do druku → Uszlachetnienie). „Sprawdź przed drukiem” o tym przypomina. |
| **Znaki cięcia w pliku PDF** | Znaki cięcia na stronach tej sekcji w pliku dla drukarni. |
| **Siatka linii bazowych** | **Odstęp** i **Pierwsza linia** (mm od góry) — wiersze tekstów z „Wyrównaj do siatki” stoją na tych liniach (→ 5.13). |

![Ustawienia sekcji](sekcje.png)

## 10.5 Rozkładówki

W sekcji z rozkładówkami strony tworzą pary: lewa i prawa, jak w otwartej książce.

- Lewą i prawą stronę edytujesz **razem**. Nowe elementy trafiają na stronę bieżącą — wybierasz ją
  kliknięciem w jej obszar.
- Marginesy są **lustrzane**: wewnętrzny przy grzbiecie, zewnętrzny przy krawędzi.
- Element może leżeć **przez grzbiet**, np. zdjęcie na całą rozkładówkę — każda strona wydrukuje
  swoją część. Element należy do strony, na której leży jego środek.
- Gruba ciemna linia to grzbiet. Tekstu nie kładź tuż przy nim — po zszyciu może go nie być widać;
  aplikacja ostrzega o elementach, które wystają w pas przy grzbiecie.
- Przycisk z dwiema kartkami obok powiększenia przełącza całą rozkładówkę i jedną stronę (na telefonie
  domyślnie jedna strona).
- **Strona sama przechodzi z prawej na lewą** (i odwrotnie): gdy dodasz, usuniesz albo przesuniesz stronę
  przed nią (albo przełączysz **Zacznij sekcję od lewej strony**), jej elementy idą na lustrzane miejsca — numer
  przy zewnętrznej krawędzi zostaje przy zewnętrznej (z wyrównaniem do niej), zdjęcie przy grzbiecie zostaje przy
  grzbiecie, a ramka tekstu wpasowana w marginesy trafia w nowe marginesy. Tekst i obrazy się nie odwracają.
  Element, który ma zostać tam, gdzie jest, oznacz w panelu (**Inne** → **Stała pozycja, gdy strona zmieni bok**);
  element przez grzbiet należy do pary stron i się nie przenosi. Strony powielane z danych też: egzemplarz, który
  wypada na drugim boku, ma układ odbity.

![Rozkładówka](rozkladowki.png)

## 10.6 Okładka z grzbietem

Okładka to osobna sekcja z jedną szeroką stroną: tył, grzbiet i przód. Zrobisz ją w oknie sekcji
(**Typ sekcji** → **Okładka**), w menu sekcji ([Zamień na okładkę z grzbietem]) albo od razu
w oknie nowego projektu (pole **Okładka**).

| Ustawienie | Co znaczy |
|---|---|
| **Oprawa** | **Miękka klejona (z grzbietem)**, **Zeszytowa – szyta zszywkami (bez grzbietu)** albo **Twarda (tektura z zawinięciem)** — przy twardej ustawisz **Zawinięcie**, **Big**, **Naddatek tektury**, **Grubość tektury** (mm) i **Grzbiet**: **Zaokrąglony** (blok szyty z wypukłym grzbietem – makieta 3D pokazuje łuk) albo **Prosty** (płaski). |
| **Papier środka** | **Gramatura** — **Gramatura (g/m²)** i **Rodzaj papieru** (offset, kredowy mat, kredowy błysk, objętościowy) — albo **Grubość kartki** w mm od drukarni. |
| **Strony środka** | **Policz same** — ze wszystkich stron środka, razem z powieleniami serii — albo **Wpisz** liczbę. **Środek to sekcje** wybiera, które sekcje się liczą, gdy jest ich kilka. |

Schemat w oknie pokazuje tył, grzbiet i przód, a pod nim wynik, np. „Grzbiet 6,6 mm · Okładka 352,6 × 246 mm”. Szerokość i wysokość okładki liczą się same.

**Wymiary** — gdy drukarnia poda grzbiet albo cały rozmiar okładki:

| Wybór | Co się dzieje |
|---|---|
| **Policz same** | Grzbiet z papieru i liczby stron, rozmiar z formatu środka. |
| **Wpisz grzbiet** | **Grzbiet (mm)** od drukarni zamiast liczonego. Reszta liczy się jak zwykle. |
| **Wpisz rozmiar** | **Szerokość okładki** i **Wysokość okładki** (mm, bez spadu) — tył i przód dzielą resztę szerokości po równo wokół grzbietu. Grzbiet możesz też wpisać; puste pole — grzbiet liczony. |


![Wymiary okładki wpisane ręcznie](k-okladka-wymiary.png)

![Okno sekcji: okładka z grzbietem, schemat i wynik](k-okladka-okno.png)

Na płótnie przerywane linie pokazują zgięcia (grzbiet, bigi, zawinięcia), a niebieskie ramki — bezpieczne pola tyłu, grzbietu i przodu.

![Okładka na płótnie: tył, grzbiet, przód](okladka.png)

Gdy w środku przybędzie stron albo zmienisz papier, okładka przelicza się sama: tył zostaje, przód przesuwa się razem z grzbietem, napisy na grzbiecie zostają na jego środku, a tło na całą okładkę się rozciąga. W panelu elementu, w części **Inne**, lista **Na okładce trzyma się** (automatycznie, tyłu, grzbietu albo przodu) mówi, czego element się trzyma; przełącznik **Dopasuj szerokość do grzbietu** rozciąga pasek na grzbiecie na całą jego szerokość. Ostrzeżenie „Szerszy niż grzbiet” mówi, że element zachodzi na tył albo przód.

![Element przypięty do części okładki](k-okladka-przypiecie.png)

> Uwaga: wzorce przypisane do sekcji okładki nie przesuwają się same.

**Materiał okładki i rogi.** W tym samym oknie:

| Pole | Co wybierasz |
|---|---|
| **Materiał okładki** | **Okładka drukowana** (karton z nadrukiem) albo okleina bez nadruku: **Płótno introligatorskie**, **Skóra ekologiczna**, **Papier strukturalny**, **Aksamit (welur)**. |
| **Folia** | Przy okładce drukowanej: **matowa**, **błyszcząca**, **soft-touch** albo **bez folii**. |
| **Kolor okleiny** | Typowe kolory danej okleiny (np. płótno granatowe, bordowe, butelkowa zieleń) albo **Inny kolor…**. |
| **Rogi** | **proste** albo **zaokrąglone** 3, 5, 6 lub 10 mm — na płótnie czerwone łuki w narożnikach pokazują, co zostanie odcięte. |

Na okleinie grafika okładki się nie drukuje — zostają elementy ze złoceniem albo tłoczeniem (Kolory do druku →
Uszlachetnienie). Makieta 3D pokazuje okleinę w wybranym kolorze, z fakturą tkaniny, skóry albo papieru,
a na niej złocenia i tłoczenia. **Sprawdź przed drukiem** przypomina o okleinie i rogach.

**Specyfikacja dla drukarni** (menu **⋯** → [Inne formaty i import…]) pobiera dwa pliki: tekst do zamówienia albo maila i JSON. Są w nich
formaty i liczby stron sekcji, oprawa i grzbiet, papier środka, materiał, folia i rogi okładki, tasiemka, składki,
podłoże, tryb kolorów, kolory dodatkowe i uszlachetnienia.

## 10.7 Składki

Środek szyty albo klejony ze składek musi mieć liczbę stron podzielną przez wielkość składki. W ustawieniach sekcji wybierz **Składki**: co 4, 8, 16 albo 32 strony.

Na liście stron pod nazwą sekcji zobaczysz np. „46 z 48 – brakuje 2 do pełnej składki (×16)”. [Dopełnij pustymi] dodaje brakujące puste strony na końcu sekcji — cofniesz to jak każdą zmianę. **Sprawdź przed drukiem** też przypomni o niepełnej składce, a przy oprawie zeszytowej — o liczbie stron niepodzielnej przez 4.

![Licznik składki i „Dopełnij pustymi”](k-skladki.png)

## 10.8 Numeracja stron

Numer strony wstawisz polem `{nr}` — najlepiej we wzorcu, żeby był na każdej stronie (→ 11.7).
Numeracja zależy od ustawień sekcji (→ 10.4) i liczy strony po powieleniu serii. Numerowane są tylko
sekcje bloku (typ **Zwykła**, **Blok**, **Kalendarz roczny**): okładka, wyklejki, obwoluta, wkładka, podkładka
i druki osobne nie mają numerów i nie przesuwają numeracji — pierwsza strona bloku ma numer 1 także wtedy,
gdy przed nią stoją okładka i wyklejka. Inne zapisy
numeru (rzymskie, z zerami) są w tabeli pól (→ 15.2).

## 10.9 Zmiana formatu ze skalowaniem

Kalendarz z A4 na A3, książka z B5 na A5 — format zmienisz razem z elementami:

- jedna sekcja: okno sekcji (→ 10.4) → [Zmień format i dopasuj elementy…],
- cały projekt: [⋯] → [Zmień format projektu…].

1. Wybierz **Nowy format** z listy albo wpisz **Szerokość (mm)** i **Wysokość (mm)**; [Zamień orientację] obraca kartkę.
2. Wybierz, **Co z elementami**:

| Sposób | Co się dzieje |
|---|---|
| **Skaluj wszystko** | Elementy, pismo, linie, marginesy, prowadnice i wzorce zmieniają się proporcjonalnie. **Skala**: **Zmieść całą stronę (wyśrodkuj)**, **Dopasuj do szerokości** albo **Dopasuj do wysokości**. |
| **Zostaw rozmiary, przesuń względem krawędzi** | Rozmiary zostają; element trzyma się najbliższej krawędzi albo środka. Tło i paski na całą szerokość lub wysokość rozciągają się na nową stronę. |
| **Tylko zmień format** | Elementy zostają tam, gdzie są. |

3. Podgląd **Teraz → Po zmianie** pokazuje pierwszą stronę przed i po. Pod nim są uwagi, np. ile elementów wyjdzie poza stronę.
4. [Zmień format]. Całą zmianę cofniesz jednym [Cofnij] (<kbd>Ctrl</kbd>+<kbd>Z</kbd>).

![Zmiana formatu z podglądem przed i po](k-format.png)

Okładka z grzbietem (→ 10.6) przelicza się sama po zmianie formatu środka. Elementy, które po zmianie
wystają poza stronę, pokaże **Sprawdź przed drukiem** (→ 20).

## 10.10 Gotowe sekcje (szablony dokumentów)

Cały gotowy dokument wstawisz jednym kliknięciem jako nową sekcję: kalendarz ścienny, planer na 365 dni,
notes, zaproszenie, dyplomy dla listy osób, wizytówki, ulotkę, menu, rozdział książki i ponad 30 innych.
Gdzie: na dole panelu stron przycisk [Gotowa] (obok [Sekcja]) i w Bibliotece kategoria **Gotowe sekcje** (→ 4.8).
Szablony całych projektów (książka z okładką i wyklejkami, broszura…) są osobno — przy nowym projekcie (→ 2.2).

![Gotowe sekcje – galeria szablonów](k-gotowe-sekcje.png)

1. Wybierz rodzaj u góry (**Książka**, **Kalendarze**, **Planery i notesy**, **Zaproszenia i dyplomy**, **Firma i reklama**, **Inne**) albo wpisz słowo w **Szukaj**. Miniatura pokazuje pierwszą stronę w formacie Twojego projektu, a pod nią widać, ile stron powstanie. Plakietka **z danymi** – strony biorą treść z tabeli (np. 365 dni, osoby do dyplomów).
2. Kliknij szablon. Zobaczysz podgląd pierwszych stron i ustawienia:
   - pytania szablonu, np. **Rok** kalendarza albo **Liczba stron** notesu,
   - **Kolory**: kolory marki (gdy masz zestaw marki, → 27.9), kolory szablonu albo jedna z gotowych palet,
   - szablony z własnym formatem (wizytówka 85 × 55 mm, dyplom A4 poziomo, etykieta 70 × 40 mm) mają przełącznik formatu – odznacz go, żeby szablon dopasował się do formatu sekcji.
3. [Wstaw jako nową sekcję]. Sekcja staje za bieżącą, a edytor przechodzi na jej pierwszą stronę.

![Szczegóły szablonu – podgląd, rok i kolory](k-gotowe-szczegoly.png)

Szablon nie jest zamrożonym plikiem: buduje się dla Twojego formatu, marginesów i spadu, w kolorach i
czcionkach marki. Po wstawieniu to zwykłe strony, wzorce (np. numer strony), style i tabela danych z serią
(→ 14, 16) – zmienisz w nich wszystko jak we własnych. Szare pola to miejsca na zdjęcia: wstaw do nich obraz
(→ 7.7). Całą wstawioną sekcję usuwa jedno [Cofnij] (<kbd>Ctrl</kbd>+<kbd>Z</kbd>).

## 10.11 Sekcje specjalne: obwoluta, ulotka, kalendarze, wykrojniki, użytki

Sekcja specjalna działa jak okładka z grzbietem (→ 10.6): wie, czym jest wydrukowana rzecz. Sama liczy swój
format, podpisuje na stronie strefy (panele, skrzydełka, klapy), rysuje linie zgięć (bigi, przerywane), perforacji
(kropkowane) i cięcia (ciągła różowa linia), ostrzega o tekście na zgięciu i o elementach poza linią cięcia,
a w pliku PDF daje arkusz w pełnym wymiarze. Wybierasz ją jako **Typ sekcji** przy [Sekcja] albo w ustawieniach
sekcji (→ 10.4).
Schemat w oknie pokazuje strefy i zgięcia na bieżąco, pod nim wymiary arkusza.

![Ulotka składana w ustawieniach sekcji](k-sekcja-ulotka.png)

| Typ | Co liczy |
|---|---|
| **Wyklejka przednia / tylna** | Twarda oprawa: arkusz o szerokości dwóch stron bloku, ze zgięciem pośrodku. Połowa **Na okładce (przyklejona)** przykleja się do wnętrza okładki, druga to pierwsza (przednia) albo ostatnia (tylna) luźna kartka książki. **Zadruk**: czysta, zadrukowana strona widoczna albo obie strony; **Papier** (g/m²) — luźna kartka dochodzi do grubości grzbietu. Wyklejka nie ma numerów stron. |
| **Obwoluta ze skrzydełkami** | Tył, grzbiet i przód z twardej okładki projektu (płyty i grzbiet), dwa skrzydełka (**Skrzydełko**, 0 – około połowy przodu) i zapas na zgięcie przy płycie. Przybędzie stron – obwoluta przeliczy się sama, a elementy przodu przesuną się razem z nim. |
| **Ulotka składana** | Arkusz na 2, 3 albo 4 panele, **Złożenie**: **Zwijane** (łamana C – panel składany do środka jest węższy o **Skrót**, żeby się nie zaginał) albo **Harmonijka** (Z – panele równe). Sekcja ma dwie strony: zewnętrzną (z panelem **Okładka**) i wewnętrzną. |
| **Kalendarz z datami (rok)** | **Rok**, **Strona na** miesiąc, tydzień albo dzień, początek tygodnia i **Święta** (Polska: stałe i ruchome – Wielkanoc, Zielone Świątki, Boże Ciało) oraz **Język nazw miesięcy i dni** w danych (polski, angielski, ukraiński). Tworzy tabelę danych i serię: pierwsza strona sekcji powiela się dla każdego miesiąca, tygodnia albo dnia. Zmiana roku przelicza wszystko. |
| **Kalendarz trójdzielny** | Główka, trzy kalendaria jedno pod drugim, okienko na środkowym i pasek reklamowy – z bigiem pod główką i perforacjami. |
| **Wykrojnik** | **Koperta** (C6, DL, C5, kwadrat), **Teczka ofertowa** z kieszenią i nacięciami na wizytówkę albo **Pudełko** (długość, szerokość, wysokość → siatka z wieczkiem, dnem, klapkami i zakładką klejową). **Zadruk z obu stron** dodaje drugą stronę – wnętrze arkusza: strefy, zgięcia i linia cięcia są na niej odbite w poziomie, tak jak wypadną po odwróceniu arkusza, więc wnętrze pudełka czy koperty projektujesz w dobrym miejscu. Linie wykrojnika idą do PDF tylko z pierwszej strony; makieta 3D pokazuje wnętrze. |
| **Arkusz użytków** | Naklejki, wizytówki, etykiety: projektujesz jeden użytek (albo kolejne z danych – seria), a w PDF stoją obok siebie na arkuszu (SRA3, A3, A4, B2) ze znakami cięcia. **Cięcie**: prostokąt (gilotyna), **naklejka** z zaokrąglonymi rogami, **naklejka okrągła / owalna** (koło albo owal w wymiarach użytku) albo **zawieszka z otworem** – ścięte górne rogi (ścięcie w polu zaokrąglenia) i otwór Ø 5 mm na sznurek; kontrola przed drukiem ostrzega o elementach w otworze i poza wykrojem. Gotowy szablon: **Zawieszki na prezenty** (dla kogo, życzenia, od kogo – z tabeli). |

![Wykrojnik pudełka na stronie: strefy, zgięcia i linia cięcia](k-sekcja-wykrojnik.png)

**Pola kalendarza z datami** do wstawienia w tekst (→ 15): `{data}`, `{dzien}`, `{miesiac}`, `{dzien_tygodnia}`,
`{tydzien}`, `{swieto}`; kolumna `wolne` ma wartość „tak” w niedziele i święta – użyj jej w kolorze zależnym
od danych (→ 17), żeby święta były czerwone. Własne kolumny dopisane do tej tabeli zostają po zmianie roku.

**W pliku PDF** (→ 21): linia cięcia wykrojnika jest osobnym kolorem dodatkowym **CutContour**, zgięcia –
**Crease**, perforacje – **Perforation**: drukarnia ich nie drukuje, tylko wycina, biguje i perforuje. Przy
obwolucie, ulotce i kalendarzu trójdzielnym (cięte prosto) zgięcia i perforacje są zaznaczone kreskami poza
formatem, obok znaków cięcia. Arkusz użytków składa się sam, gdy w eksporcie jest **Układ arkuszy: Zwykły**.
Uwagi o tekście na zgięciu i elementach poza linią cięcia pokazuje też **Sprawdź przed drukiem** (→ 20).

Gotowe sekcje (→ 10.10) **Broszura składana**, **Wizytówki** i **Etykiety i naklejki** wstawiają się od razu
jako ulotka składana i arkusz użytków, a **Okładka** w twardej oprawie — razem z dwiema czystymi wyklejkami.

**Książka w twardej oprawie** składa się z sekcji typów: **Okładka** (oprawa twarda), **Wyklejka przednia**,
**Blok**, ewentualnie **Wkładka** (np. zdjęcia na kredzie — z własnym papierem, bez numerów stron) i **Wyklejka
tylna**. Grzbiet okładki liczy się z bloku i dodaje luźne kartki wyklejek i kartki wkładek, każde swoim papierem.
**Sprawdź przed drukiem** (→ 20) ostrzega, gdy twarda okładka nie ma wyklejek (przycisk [Dodaj wyklejki] dopisuje
obie, czyste), i gdy wyklejka stoi przy miękkiej oprawie. Twarda okładka może mieć też **Zakładkę – tasiemkę
w grzbiecie** w wybranym kolorze. W eksporcie PDF (→ 21) **Pliki dla drukarni: okładka, wyklejki, blok…** daje
osobny plik dla każdej części: okładki, obwoluty, wyklejek, bloku, wkładek i każdego druku osobnego.

Sekcja ze starszego projektu, która w nazwie ma „wyklejka”, a typ zwykły, dostaje raz podpowiedź
„Sekcja … wygląda na wyklejkę – ustawić typ…?” z przyciskiem [Ustaw typ]. To tylko propozycja — bez kliknięcia
sekcja zostaje zwykła.

## 10.12 Składanki i wycinanki

Model z papieru albo kartonu z wielu części – domek, pudełko z przegródkami, bryła, zabawka – robisz w sekcji
typu **Składanka / wycinanka**. Każda strona tej sekcji to jeden **arkusz** z częściami. W ustawieniach sekcji:

- **Arkusz** – A4, A3, A5, Letter (drukarka domowa) albo **Własny** (arkusz drukarni, ploter), pionowo albo poziomo;
- **Materiał** – papier albo karton z **gramaturą** (grubość liczy się sama: karton 300 g/m² ≈ 0,39 mm), tektura
  albo własna grubość w milimetrach; od grubości zależy szerokość szczelin;
- **Druk i cięcie** – **drukarka domowa** (linie cięcia i zgięć są wydrukowane – tniesz nożyczkami i nożykiem)
  albo **drukarnia z ploterem** (linie idą do PDF jako osobne kolory: cięcie, zgięcia i klej – drukarnia ich
  nie drukuje); **margines drukarki** – pas przy brzegu, którego drukarka nie zadrukuje;
- **Druga strona arkusza** – nieużywana, też drukowana albo **tylko miejsca klejenia** (bez druku).

Marginesy sekcji równają się marginesowi drukarki, a spadu nie ma – model wycina się po obrysie części.

W tej sekcji pasek wstawiania ma dodatkowe narzędzia:

| Narzędzie | Co robi |
|---|---|
| [Szablon] | Gotowy model z wymiarów: **Pudełko z wieczkiem nakładanym** (dwie części – wieczko jest większe o dwie grubości materiału i 0,5 mm luzu, więc nakłada się ciasno, ale bez wciskania), **Pudełko z klapą wsuwaną** (wieko na zawiasie z językiem wsuwanym za przednią ścianę – otwiera się i zamyka bez kleju), **Pudełko z zatrzaskiem** (język wieka wchodzi w szczelinę w przedniej ścianie, szerokiej na grubość materiału + 0,2 mm), **Koło obrotowe** do książek (dwa krążki na ćwieku – górny z okienkiem na jedno z 3–12 pól dolnego; okienko i krzyżyk na ćwiek to linie cięcia), **Suwak** do książek (kartka z nacięciem przy brzegu i pasek w kształcie litery T – wąska część przechodzi przez nacięcie, szeroki koniec zostaje pod kartką i nie pozwala wyciągnąć paska; parametry: szerokość paska i ruch), **Pudełko-poduszka** (dwie ściany z łukami na końcach: łuk cięcia wypukły i **zgięcie po łuku** wklęsłe – po wciśnięciu końców do środka pudełko zamyka się samo; zgięcie po łuku drukuje się jako big po krzywej, a makieta 3D pokazuje je płasko, bo karton gnie się po krzywej sprężyście), **Klapki** do książek (lift-the-flap: 1–6 okienek wyciętych z trzech stron i zgiętych na czwartej – zgięcie działa jak zawias; druga kartka pod spodem na ukryte obrazki, klej tylko poza okienkami), **Tacka**, **Prostopadłościan**, **Graniastosłup** (3–12 boków), **Ostrosłup**, **Przegródki wsuwane na krzyż** (krótsze o dwie grubości, niższe o jedną, ze szczelinami grubość + 0,2 mm), bryły o krzywych ścianach – **Walec**, **Stożek**, **Stożek ścięty** (kubek, abażur) i **Kula z klinów** (globus, 4–24 klinów – każdy przykleja się zakładkami do następnego), **Wazon** (bryła obrotowa z profilu, 6–32 segmentów – pasy ścian i płaskie dno), gotowe modele **Domek z dachem dwuspadowym**, **Samochód** i **Żółw** (skorupa z segmentów, głowa, łapy i ogon – doklejane pod skorupę) (bryły z sylwetki rozłożone automatycznie, jak w [Model 3D]): płaszcz rozwinięty dokładnie (kąt wycinka liczony z wysokości i średnic), dno i wieko z wielu krótkich boków, zakładki wzdłuż łuku z jednym numerem (szew – kontrola sprawdza, czy obie strony mają tę samą długość) – **Kartka pop-up ze zgięciem V** (trójkąt przyklejony do dwóch skośnych pól pod tym samym kątem do grzbietu co jego brzegi – na rozłożonej kartce leży płasko, przy zamykaniu wstaje i chowa się w środku; kąt 15–75°), **Kartka pop-up z platformą** (kartka i pasek przyklejony zakładkami do pól po obu stronach grzbietu: po otwarciu stoi jak pudełko, po zamknięciu leży płasko w środku; **Warstwy: 2** dokleja na nim drugą, mniejszą platformę) oraz **Kartka pop-up (wycinanka)**: jeden arkusz z nacięciami i zgięciami, z którego po otwarciu kartki pod kątem prostym wyskakują pudełka (1–4, głębokość i wysokość do wyboru; nacięcia kończą się przed brzegiem, więc po zamknięciu nic nie wystaje); **Makieta 3D** pokazuje ją otwartą pod kątem prostym z wyskoczonymi pudełkami). Części mają zgięcia, zakładki i numery par; okno podaje grubość materiału sekcji. |
| [Część] | Nowa część – prostokąt 60 × 40 mm z literą (A, B, C…). |
| [Z kształtu] | Zaznaczony prostokąt, wielokąt, elipsę albo kształt z pióra (→ 6) zamienia w część – dowolny obrys. Łuki z pióra zostają łukami (gęsto, co ok. 2 mm), więc okrągłe kształty tną się gładko. |
| [Bryła z kształtu] | Zaznaczony kształt to podstawa bryły: **graniastosłup** (ściany prostopadłe o wybranej wysokości, wieko przy pierwszej ścianie) albo **ostrosłup** (ściany do wierzchołka nad środkiem podstawy), albo **ściany z dachem** – dwie bryły łączone: ściany z dnem i osobny dach (ostrosłup bez podstawy, rozłożony wachlarzem wokół szczytu, z **Wysokością dachu**); zakładki u góry ścian mają te same numery par co dolne brzegi dachu, więc dach nakleja się na ściany jak na domku. Powstaje jedna część z siatką – ściana na każdym boku, zakładki z numerami par i zgięcia. Działa z dowolnym wielokątem, także wklęsłym (gwiazda, litera L) – przy wklęsłym sprawdź, czy ściany na siatce nie nachodzą na siebie. |
| [Model 3D] | Bryła z programu 3D albo z sieci (**OBJ** albo **STL**) rozłożona na płasko – jak w programach do papierowych modeli: Makietka dzieli ściany na trójkąty, rozkłada je wzdłuż najbardziej płaskich krawędzi (płaskie ściany zostają w całości, bez linii), wstawia zgięcia góra i dolina z kątem oraz zakładki z numerami par. Gdy część nachodziłaby sama na siebie, kolejne ściany idą do następnej części. Podajesz największy wymiar modelu w mm; potem [Rozłóż] układa części na arkuszach. Najlepiej modele do kilkuset ścian (w Blenderze: Decimate). Do OBJ możesz dołączyć plik **MTL** (wybierz oba naraz) – każda część dostaje kolor materiału, który zajmuje w niej najwięcej miejsca; bez MTL materiały dostają kolory z palety. Gdy model ma **teksturę** (współrzędne UV w OBJ i obrazek `map_Kd` w MTL), wybierz razem z nimi plik obrazka (PNG, JPG albo WebP) – każda część dostaje nadruk: obrazek przeniesiony na jej ściany dokładnie tak, jak leży na modelu. Nadruk trafia do **Obrazów projektu** („… – nadruk.png”) i przesuwa się razem z częścią przy [Rozłóż]; po [Rozetnij] i [Scal] znika (obejmował całą część). Gdy obrazka brakuje, Makietka mówi, którego pliku szuka. |
| [Zgięcie] | Dwa kliknięcia na krawędziach części: linia zgięcia dzieli ją na ściany. Linia po samej krawędzi albo poza częścią się nie doda. |
| [Połącz] | Kliknij przy krawędzi, która dostanie **zakładkę klejową**, potem przy krawędzi innej części (albo tej samej), do której się przykleja – obie dostają **ten sam numer**. Drugie kliknięcie w środku ściany zamiast przy krawędzi dodaje tam **miejsce klejenia** o długości krawędzi. Gdy krawędzie mają różne długości, aplikacja o tym powie. |
| [Klej] | Kliknięcie w części dodaje miejsce klejenia (z <kbd>Shift</kbd> – na spodzie, bez druku, gdy druga strona arkusza jest na klej). |
| [Linia klejenia] | Klejenie nie zawsze jest przy krawędzi: linia pomocnicza w **dowolnym miejscu ściany** – nie musi dochodzić do krawędzi ani być zamknięta. Bez zaznaczenia: dwa kliknięcia w części (początek i koniec). Krzywą, falę albo łamaną narysuj na części linią, łukiem albo piórem, zaznacz i użyj [Linia klejenia] – zamieni się w linię klejenia (zamknięty kształt, np. okrąg, też). Potem [Połącz]: krawędź albo zakładka innej części, a potem linia – dostają ten sam numer. **Prosta** linia: doklejona część stanie pod kątem (zagnie się na linii); **krzywa**: wygnie się i zawinie wzdłuż niej. Linia drukuje się zieloną kreską z numerem, a w pliku dla drukarni idzie na płytę kleju; w panelu części (**Linie klejenia**) zobaczysz długość, zmienisz numer albo przeniesiesz ją na spód. **Sprawdź przed drukiem** porówna długość krawędzi i linii, a instrukcja montażu powie, czy przyklejana część stanie pod kątem, czy zawinie się po krzywej. |
| [Nacięcie] | Linia cięcia w środku części albo od jej krawędzi, **pod dowolnym kątem** – dwa kliknięcia (końce przyciągają się do wierzchołków, końców zgięć i innych nacięć, do 1,5 mm). Krzywe i łamane: narysuj linię, łuk albo kształt piórem na części, zaznacz i użyj [Nacięcie] – powstaje jedno nacięcie z wielu odcinków. Nacięcia razem ze zgięciami dzielą ścianę: np. dwa skośne nacięcia od końców zgięcia dają trójkątną klapkę, która w makiecie 3D odchyla się na swoim zgięciu (wycinanka pop-up). Nacięcie drukuje się na płycie cięcia razem z obrysem; w panelu części (**Nacięcia**) widać długość i można je usunąć. **Sprawdź przed drukiem** ostrzega, gdy nacięcie wychodzi poza część. Szczelina ([Szczelina]) to co innego – wąski otwór z szerokością na wypustkę. |
| [Wycięcie] | Otwór w części: narysuj na niej zamknięty kształt (prostokąt, elipsę, wielokąt, kształt z pióra), zaznacz go i użyj [Wycięcie]. Kawałek w środku wypada – w edytorze ma szare kreskowanie (to odpad), w makiecie 3D w ścianie jest dziura. **Okienko z drzwiczkami**: zamiast wycięcia zrób [Nacięcie] na trzech bokach, a czwarty bok zegnij ([Zgięcie] albo nacięcia od końców zgięcia) – drzwiczki odchylają się na zawiasie i odsłaniają otwór. |
| [Na część] | Ściana to nie tylko kolor: zaznacz tekst, obraz, kształt albo ozdobnik leżący na części i użyj [Na część] – element wchodzi na ścianę i od tej pory jest częścią części: przesuwa się i obraca razem z nią, zostaje na swoim miejscu, gdy zmieniasz zgięcia i zakładki, jedzie z nią przy [Rozłóż] (elementy leżące w całości na części [Rozłóż] umieszcza na niej sam), przy [Rozetnij] trafia do kawałka, na którym leży, a w makiecie 3D jest na swojej ścianie i zgina się z nią. Grafika ściany jest **przycięta do obrysu części** – to, co wystaje, nie drukuje się poza linią cięcia ani na zakładkach. Panel części → **Na ścianach** pokazuje, ile elementów jest na ścianach; **Wyjmij z części (do edycji)** zwraca je na stronę w tym samym miejscu – np. żeby poprawić tekst – potem znowu [Na część]. |
| [Rozłóż] | Wszystkie części sekcji układają się od nowa na arkuszach – rzędami w polu druku (bez marginesu drukarki), najwyższe najpierw; część, która nie mieści się poziomo, obraca się o 90°; brakujące arkusze dochodzą na końcu sekcji (przy druku dwustronnym części idą na pierwszą stronę arkusza). Inne elementy stron zostają. Część za duża nawet po obróceniu zostaje na miejscu – aplikacja o tym powie. |
| [Instrukcja] | Instrukcja montażu z modelu: co wydrukować (materiał, gramatura), które części wyciąć (z numerami arkuszy), ile zgięć „od siebie” i „do siebie” ma każda część, potem klejenie par po kolei – „Posmaruj klejem zakładkę 3 (część A) i przyklej pod krawędź 4 części B z numerem 3”, „Wsuń wypustkę 7 w szczelinę 7”. [Pobierz (.txt)] albo [Wstaw jako stronę] – nowa sekcja A4 za arkuszami z ponumerowanymi krokami (do poprawienia jak zwykły tekst). |
| [Szczelina] | Dwa kliknięcia w części: nacięcie na wypustkę albo przegródkę – szerokość to grubość materiału + 0,2 mm luzu. |
| Rozetnij (w panelu części) | Dwa kliknięcia na krawędziach dzielą część na dwie – np. gdy po [Model 3D] część nie mieści się na arkuszu. Krawędzie zachowują zakładki i numery, zgięcia trafiają do swojej części (przecinające linię są do niej przycinane), a na linii cięcia powstaje nowa para: zakładka w jednej części, krawędź do sklejenia w drugiej. |
| Scal (w panelu części) | Kliknięcie przy krawędzi z numerem pary łączy obie części w jedną: druga obraca się i przesuwa tak, by krawędzie pary się pokryły, a krawędź klejenia staje się zgięciem (góra, 90°). Gdy części nachodziłyby na siebie, Makietka odmawia – zostają osobno. |

<kbd>Esc</kbd> kończy narzędzie. Część przesuwasz i obracasz jak każdy element; nie da się jej rozciągnąć
(wymiary są wymiarami modelu). Zaznaczona część ma w panelu **Właściwości**:

- **Część** – nazwę (literę), kolor ścian, przełącznik **Numery par i nazwa części** i przyciski narzędzi;
- **Krawędzie** – każda krawędź z długością i rodzajem: **Cięcie**, **Zakładka klejowa** (z szerokością),
  **Do sklejenia (bez zakładki)** albo **Wypustka do szczeliny** (z długością) – i **numerem pary**;
- **Zgięcia** – **góra** (od siebie, kreska–kropka – nadruk zostaje na zewnątrz; tak są zgięcia szablonów i nowe
  zgięcia) albo **dolina** (do siebie, kreski) i **kąt po złożeniu** – kąt między ścianami w gotowym modelu
  (pudełko 90°, ściany sześciokątnego graniastosłupa 120°), a w kartce pop-up przełącznik **Grzbiet kartki (pop-up)**;
- **Miejsca klejenia** i **Szczeliny** – numer pary, wymiary, na spodzie, usuwanie.

Na arkuszu zakładki są jasnoszare z numerem pary, a ten sam numer stoi przy krawędzi albo w miejscu, do którego
się przyklejają – po wycięciu wiesz, co z czym skleić. Plik dla plotera (menu **⋯** → [Inne formaty i import…]) i PDF dla drukarni dostają
obrys cięcia części z zakładkami i szczelinami, zgięcia (także u nasady każdej zakładki) i miejsca klejenia.

**Co się z czym łączy.** Gdy nic nie jest zaznaczone, panel strony w sekcji składanki ma listę **Połączenia**:
każdy numer z tym, co go nosi, np. „1 – A: zakładka 2 ↔ B: krawędź 4”, a przy kilku arkuszach także numer arkusza.
Najechanie na pozycję podświetla na pomarańczowo obie strony pary na arkuszu, kliknięcie zaznacza część. Numer
bez pary albo użyty więcej niż dwa razy ma pasek ostrzeżenia. Najechanie myszą na część podświetla wszystkie jej pary.

**Sprawdź przed drukiem** (→ 20) pilnuje modelu: część wystająca poza arkusz albo wchodząca w margines
drukarki, części nachodzące na siebie razem z zakładkami (nie da się ich wyciąć), numer bez pary (nie wiadomo, do czego to przykleić), numer użyty więcej niż dwa razy, para krawędzi
o różnych długościach, miejsce klejenia mniejsze niż zakładka, szczelina węższa niż materiał albo krótsza niż
wypustka, a w kartce pop-up – część, która po zamknięciu kartki wystaje poza nią (o ile milimetrów), i kartka, która
nie zamyka się na płasko, bo pasek platformy albo ramię V nie pasuje do odległości miejsc klejenia. Przy każdej uwadze [Otwórz wzór] zaznacza część.

**Makieta 3D** (→ 19.4) ma dla sekcji składanki model **Składanka (model z części)**: najpierw arkusze leżą
płasko nadrukiem do góry, potem każda część składa się po swoich zgięciach – z nadrukiem z arkusza na ścianach
i kartonem w środku (**Złożone części** – stoją obok siebie tak, jak leżą na arkuszach). Ostatnie położenie,
**Sklejony model**, skleja części po parach w jedną bryłę – od największej części kolejne dochodzą tam, gdzie mają
się przykleić: krawędź do krawędzi (obrót taki, żeby zgadzały się wszystkie pary tej części; bez innych par – pod
**Kątem po sklejeniu** z panelu krawędzi: 180° na płasko, jak przedłużenie, 90° prostopadle), krawędź do prostej linii klejenia, miejsca klejenia albo szczeliny – część staje
prostopadle po stronie nadruku, krawędź do krzywej linii klejenia – część wygina się i zawija wzdłuż krzywej,
z zachowaniem swoich zgięć (np. daszek paska zostaje zagięty).
Ozdobniki, teksty i obrazy na ścianach jadą razem z nimi. Części bez par z resztą zostają na arkuszu.

**Pop-up w ruchu.** Gdy zgięcie kartki ma w panelu włączony **Grzbiet kartki (pop-up)** (szablony pop-up mają go
od razu), w oknie makiety pojawia się suwak **Otwarcie kartki pop-up** (0–180°). Kartka otwiera się wokół grzbietu,
a doklejone platformy, zgięcia V, drugie warstwy i wycinanki ruszają się tak, jak w prawdziwej książce: ściany są
sztywne, zgięcia działają jak zawiasy, a miejsca klejenia trzymają doklejone części. Przy 180° wszystko leży płasko,
przy 90° elementy stoją, a przy prawie zamkniętej kartce składają się do środka. Ustawienie zapisuje się w ujęciu.

**Elementy pod kątem z dowolnej części.** Nie trzeba szablonu V: narysuj na kartce z grzbietem dwie proste
**linie klejenia** po obu stronach grzbietu (skośnie do niego) i połącz z nimi krawędzie dowolnej części – w makiecie
część stanie pod kątem wynikającym z geometrii. Panel kartki przy każdej prostej linii podaje **kąt do grzbietu**
i odległość od niego, a panel doklejonej części ma sekcję **Pop-up**: pod jakim kątem stoi przy kartce otwartej
na 90°, jak daleko sięga od kartki i czy po zamknięciu chowa się w kartce, czy wystaje (o ile milimetrów).

## 10.13 Komiks

Komiks zrobisz jako zeszyt, książkę, luźne kartki albo plik do oglądania na ekranie. Wszystko
działa bez AI; AI (z gwiazdką ✦) może pomóc napisać scenariusz i narysować kadry.

**Jak zacząć**

- **Z szablonu:** **Nowy projekt** → **Zacznij od: Gotowego szablonu** → **Komiks**. Dostajesz strony z gotowymi
  kadrami, przykładowy scenariusz, karty dwóch postaci (Ala i Ola) i miejsca (Miasteczko).
- **Od pustej strony:** **Nowy projekt** → **Zacznij od: Pustej strony** → zaznacz **To komiks – kadry, dymki, scenariusz i postacie**.
- **Do istniejącego projektu:** [Sekcja] → typ **Komiks** (→ 10.4).

W szablonie wybierasz **Formę** komiksu:

| Forma | Co dostajesz |
|---|---|
| **Zeszyt (broszura) z okładką – do druku** | Okładka zeszytowa (z miejscem na tytuł i rysunek) i strony komiksu, zszywane. |
| **Książka w miękkiej oprawie – do druku** | Okładka z grzbietem i strony komiksu. |
| **Luźne kartki – bez okładki** | Same strony komiksu, np. do wydruku w domu. |
| **Na ekran – PDF albo prezentacja (poziomo)** | Strony poziome jak slajdy, bez spadu – do oglądania w podglądzie albo jako PDF na ekran. |

![Strona komiksu z kadrami i dymkami; na pasku Kadry, Dymek i Komiks](k-komiks.png)

**Pasek komiksu.** Na stronie komiksu pasek wstawiania ma dodatkowe przyciski:

| Przycisk | Co robi |
|---|---|
| [Kadry] | Gotowy układ kadrów na tej stronie, odstęp między kadrami, spad; w tym samym oknie [Podziel kadr]. |
| [Dymek ▾] | Menu: dymek **Mowa**, **Myśl**, **Krzyk**, **Szept**, **Narracja** (→ 4.14), **Efekt dźwiękowy** („BUM!” dużymi literami z obrysem) i **Mostek** (łączy dwa zaznaczone dymki jednej postaci). |
| [Komiks] | Okno **Komiks krok po kroku** – cały komiks w pięciu krokach (opis niżej). |

Narzędzia AI komiksu – **Scenariusz z AI**, **Obrazy wzorcowe postaci i miejsc**, **Rysuj kadry** – są w menu [AI ▾]
(→ 7.11), a rozmowa z AI – pod [Asystent AI] na górnym pasku (→ 25.6). Gdy nie masz klucza Google Gemini, pozycje
rysowania i pisania są wyszarzone, a na górze menu jest **Nie masz klucza do generowania obrazów i tekstów – dodaj
klucz…** (→ 7.11).

**Komiks w Bibliotece.** [Biblioteka] (→ 4.8) ma kategorię **Komiks**: dymki każdego rodzaju i efekt dźwiękowy, gotowe
układy kadrów (kliknięcie zastępuje kadry na tej stronie; obrazy i dymki zostają), raster i linie ruchu, a na stronie
komiksu także **Okna komiksu**: **Komiks krok po kroku**, **Scenariusz**, **Postacie, miejsca i rekwizyty**, **Wgraj gotowe
strony** i **Webtoon**. To dobra droga na telefonie, gdzie pasek jest krótszy.

### Komiks krok po kroku

[Komiks] otwiera okno z pięcioma krokami. Przy każdym kroku widać, co już jest (np. „Jest: 5 kwestii na 2 stronach”).
Rób je po kolei albo wróć do dowolnego – każdy przycisk otwiera swoje okno.

![Okno Komiks krok po kroku](k-komiks-okno.png)

1. **Historia** – [Otwórz scenariusz] (okno **Scenariusz**, niżej) albo [Napisz z AI…] (Scenariusz z AI, niżej).
2. **Postacie, miejsca i rekwizyty** – [Postacie, miejsca i rekwizyty…]: karty postaci, miejsc i rekwizytów oraz **Styl rysunków**. Miniatury pokazują
   obrazy wzorcowe.
3. **Kadry i obrazy** – [Układ kadrów…], [Rysuj kadry tej strony…] (AI) albo [Wgraj gotowe strony…].
4. **Dymki** – [Ustaw dymki]: teksty ze scenariusza trafiają do dymków w kadrach.
5. **Gotowy komiks** – [Podgląd], [PDF…] (do druku albo na ekran) i [Webtoon] (pasek do czytania na telefonie).

### Krok 1. Scenariusz

Okno **Scenariusz** pokazuje komiks strona po stronie: w każdej stronie kadry, w każdym kadrze kwestie. Nie trzeba
wpisywać numerów ani pamiętać nazw kolumn.

![Okno Scenariusz: strona, kadry, ujęcie, miejsce, kto jest w kadrze i kwestie](k-komiks-scenariusz.png)

W każdym kadrze:

| Pole | Co wybrać albo wpisać |
|---|---|
| **Ujęcie** | Jak widać scenę: **widok ogólny** (całe miejsce), **plan pełny** (postacie od stóp do głów), **plan średni** (od pasa w górę), **zbliżenie** (twarz), **detal** (ważny przedmiot), **z góry**, **z dołu**, **zza pleców**. **Ujęcie: dowolne** – bez wymagań. |
| **Miejsce** | Miejsce z kart (krok 2) – jego opis i obraz będą tłem kadru. |
| **Postacie w kadrze** | Zaznacz postacie widoczne w kadrze, także te, które nic nie mówią (ci, którzy mówią, są zaznaczeni sami). Przy każdej postaci w kadrze wybierz **emocję** (radość, smutek, złość, strach, zaskoczenie, ciekawość, spokój, zmęczenie) i wpisz, **co robi**, np. „biegnie, macha ręką”. AI rysuje wtedy postać z tą miną i w tym ruchu. |
| **Rekwizyty w kadrze** | Przedmioty z kart rekwizytów widoczne w kadrze (np. **Paczka**). Ich opis i obraz wzorcowy idą do AI. |
| **Co widać w kadrze** | Krótko, np. „Ala biegnie uliczką, w tle kamienice”. Nie trafia na stronę – to opis dla rysownika albo AI. |
| **Kwestie** | [+ Kwestia]: **Kto mówi** (postać z kart albo **Narracja**), **Rodzaj dymka** (mowa, myśl, krzyk, szept) i **Tekst dymka**. Ikona kosza usuwa kwestię. |

[+ Kadr] dodaje kadr na stronie, [+ Strona] – nową stronę scenariusza; ikona kosza przy kadrze usuwa kadr.
[Zapisz] zapisuje scenariusz. Postacie i miejsca dodasz w kroku 2 – potem wybierzesz je tu z listy.

**Dla zaawansowanych.** Scenariusz to zwykła tabela danych **Scenariusz** (jeden wiersz na kwestię, kolumny **strona**,
**kadr**, **ujęcie**, **miejsce**, **w kadrze**, **opis sceny**, **postać**, **tekst**, **rodzaj**). [Tabela] w oknie
Scenariusz otwiera ją w oknie **Dane** (→ 14) – tam wkleisz scenariusz z arkusza (→ 14.3) albo dodasz kolumny
z innymi językami. Strona 1 to pierwsza strona komiksu (okładka się nie liczy).

**Scenariusz z AI.** [Napisz z AI…] w kroku 1 (albo [AI ▾] → **Scenariusz z AI**) rozpisuje komiks za Ciebie – razem z emocjami i działaniami postaci:

1. Wybierz **Z pomysłu** i opisz historię w 3–5 zdaniach, np. „Dwie przyjaciółki, Ala i Ola, znajdują pod drzwiami
   paczkę. W środku jest kotek…”, i ustaw **Ile stron**.
   Albo wybierz **Z dokumentu** i plik ze scenariuszem lub opowiadaniem: Word (.docx), LibreOffice (.odt), Markdown (.md)
   albo tekst (.txt). Z Google Docs: **Plik → Pobierz → Microsoft Word**. Dialogi z dokumentu zostają dosłownie.
2. Kliknij [Rozpisz]. Po kilku sekundach widzisz podgląd: strony, kadry, kto mówi, tekst, co widać w kadrze.
3. [Zapisz scenariusz] – scenariusz trafia do okna **Scenariusz** (z ujęciami, miejscami i postaciami w kadrach),
   powstają karty postaci i miejsc (istniejące karty są tylko uzupełniane), a strony bez kadrów dostają kadry.
   [Wstecz] wraca do opisu bez zapisu.

Koszt – ok. jeden grosz; widać go przed rozpisaniem.

### Krok 2. Postacie, miejsca i rekwizyty

[Postacie, miejsca i rekwizyty…] otwiera karty. Opisz postać raz – opis i obraz wzorcowy pilnują, żeby wyglądała tak samo
w każdym kadrze (dla Ciebie, rysownika albo AI).

![Karty postaci i miejsc](k-komiks-postacie.png)

- **Postać:** **Imię**, **Wygląd** (np. „8 lat, rude warkocze, zielona sukienka”), **Znak rozpoznawczy** (np. „żółty
  plecak”), **Charakter**, **Obraz wzorcowy** i **Kolor dymka** (dymki tej postaci dostaną ten kolor tła; biały – zwykły
  dymek).
- **Miejsce:** **Miejsce** (nazwa), **Opis**, **Pora dnia**, **Światło** i **Obraz wzorcowy** – widok samego miejsca,
  bez postaci. W kadrach z tym miejscem (wybranym w scenariuszu) obraz miejsca jest tłem, a postacie stają na nim.
- **Obraz wzorcowy:** [Wybierz obraz…] – rysunek albo zdjęcie z urządzenia; albo [Narysuj z opisu (AI)] – AI rysuje go
  z pól karty w stylu komiksu (koszt widać przed rysowaniem, ok. 0,14 zł). Postać – cała sylwetka na białym tle;
  miejsce – szeroki widok bez ludzi.
- **Rekwizyt:** przedmiot, który wraca w wielu kadrach (plecak, latawiec, mapa) – **Rekwizyt** (nazwa), **Opis**,
  **Czyj (postać)** i **Obraz wzorcowy** (sam przedmiot na białym tle). W scenariuszu zaznaczasz go w kadrze (**Rekwizyty
  w kadrze**); rekwizyt wymieniony w opisie sceny AI weźmie i bez zaznaczania. Szablon **Komiks** ma przykładową **Paczkę**.
- **Styl rysunków** (u góry okna; każdy kafelek pokazuje tę samą przykładową scenę w danym stylu): **Kolorowa bajka**,
  **Akwarela**, **Prosty cartoon**, **Manga (czarno-biała)**, **Komiks retro**, **Szkic ołówkiem**, **Komiks europejski
  (czysta kreska)**, **Komiks o superbohaterach**, **Anime (kolorowe)** albo **Wycinanka z papieru** – obowiązuje we
  wszystkich obrazach z AI w tym komiksie.

![Karta postaci](k-komiks-postac.png)

Kliknięcie karty otwiera ją do poprawki, [Zapisz] zapisuje, [Usuń] usuwa kartę (dymki i obrazy na stronach zostają).
Karty to zwykłe tabele **Postacie** i **Miejsca** – zobaczysz je też w oknie **Dane**.

### Krok 3. Kadry i obrazy

**Układ kadrów.** [Kadry] na pasku (albo [Układ kadrów…] w kroku 3) pokazuje 9 gotowych układów (1–9 kadrów). Kliknij
podgląd, ustaw **Odstęp między kadrami** (mm) i ewentualnie **Na spad** – kadry przy krawędzi wychodzą wtedy poza
stronę, aż do linii cięcia. [Ułóż kadry] zastępuje kadry na tej stronie; obrazy i dymki zostają.
[Podziel kadr] w tym oknie: kliknij na stronie dwa punkty – linia między nimi dzieli kadr na dwa (może być ukośna).
<kbd>Esc</kbd> kończy.

![Okno Kadry – 9 gotowych układów](k-komiks-kadry.png)

Kadr to kształt z białym tłem i czarnym obrysem, z numerem w kolejności czytania (rzędami od góry, w rzędzie od lewej –
w warstwach „Kadr 1”, „Kadr 2”…). Przesuwasz go i zmieniasz jak każdy kształt; obraz wstawisz do kadru jak do każdego
kształtu (→ 7.7), np. przeciągając plik na kadr. Postać może wychodzić poza kadr – połóż wtedy obraz nad kadrem.

**Rysuj kadry (AI).** Otwórz stronę komiksu i kliknij [Rysuj kadry tej strony…] w kroku 3 (albo [AI ▾] →
**Rysuj kadry**). Nie piszesz poleceń dla AI – Makietka składa je ze scenariusza i kart:

1. Okno pokazuje każdy kadr strony: miniaturę, pole z opisem i znacznik. Opis jest po polsku, np. „Kadr 2. Ujęcie:
   plan pełny. Scena: Ala biegnie ulicą. W kadrze: Ala – 8 lat, rude warkocze…, zawsze: żółty plecak, emocja: radość, robi: biegnie. Miejsce (tło):
   Miasteczko…”.
2. Popraw opis, jeśli chcesz. Kadry z obrazem są odznaczone – zaznacz je, żeby narysować jeszcze raz.
3. Wybierz **Jakość** i sprawdź koszt pod listą.
4. [Rysuj] – kadry wypełniają się po kolei („Rysuję 2 z 3…”). Obrazy wzorcowe postaci i miejsca idą do AI razem
   z opisem, więc postacie i tło wyglądają tak samo w każdym kadrze. Napisów w obrazach nie ma – tekst jest w dymkach.

**Cała strona jednym obrazem.** W oknie rysowania zaznacz **Cała strona jednym obrazem – taniej i spójniej; AI rysuje
też ramki kadrów (kadry strony zastąpi obraz, dymki zostają)**. AI dostaje opisy wszystkich kadrów naraz, układ kadrów
strony i obrazy wzorcowe postaci, i rysuje całą stronę – z ramkami kadrów, jednym światłem i jedną kreską. Kosztuje
tyle co jeden obraz (np. ok. 0,14 zł w szkicu zamiast ok. 0,42 zł za trzy kadry). Obraz kładzie się na całą stronę ze
spadem, a kadry strony znikają (są już na obrazie). Gdy chcesz poprawiać kadry osobno, rysuj kadr po kadrze.

![Cała strona komiksu narysowana jednym obrazem (Szkic) – przed dodaniem dymków](k-komiks-cala-strona.jpg)

**Rysuj jeszcze raz.** Obraz się nie podoba? Otwórz znów [Rysuj kadry tej strony…] i zaznacz ten kadr. Pole opisu
pokazuje opis, **z którego powstał obecny obraz** – popraw jedno słowo albo narysuj jeszcze raz bez zmian. [Opis ze
scenariusza] wraca do opisu złożonego od nowa (np. po zmianie scenariusza albo karty). Poprzednie obrazy zostają
w **Obrazach projektu** (→ 7.5). Drobną zmianę w jednym kadrze (np. „Ala ma mieć zamknięte oczy”) zrobisz bez rysowania od nowa: zaznacz kadr →
[AI ▾] → **Popraw obraz w ramce…** (→ 7.11).

**Obrazy zrobione gdzie indziej.** Nie musisz rysować w Makietce. Obrazy z darmowego Gemini, z Flow, z innego
generatora albo Twoje rysunki i skany wstawisz tak:

1. Otwórz stronę komiksu, od której mają zacząć się obrazy.
2. **Przeciągnij kilka plików naraz na stronę** (albo plik ZIP) – albo kliknij [Wgraj gotowe obrazy…] w kroku 3 i wybierz
   pliki.
3. Obrazy trafiają po kolei do pustych kadrów: od tej strony dalej, w kolejności czytania, pliki w kolejności nazw.
   Kadry z obrazem są pomijane. Jeśli kadrów zabraknie, Makietka powie, których plików nie wstawiła.

Jeden obraz upuszczony na kadr trafia do tego kadru (→ 7.7). Numer w nazwie pliku stawia obraz na konkretnym miejscu:

| Nazwa pliku | Gdzie trafia |
|---|---|
| `01.png`, `strona 7.jpg`, `page_3.png` | Cała strona 1 (7, 3) na spad. Kadry tej strony znikają (są już na rysunku), dymki zostają nad obrazem. |
| `s03-k2.png`, `str3_kadr2.jpg` | Kadr 2 na stronie 3 – obraz wypełnia kadr (przesuniesz go podwójnym kliknięciem, → 7). |
| każda inna, np. `Gemini_Generated_Image_….png` | Następny pusty kadr. |

Strony liczą się od pierwszej strony komiksu; brakujące strony dochodzą na końcu sekcji.

**Opisy kadrów do darmowego AI.** W oknie **Rysuj kadry** kliknij [Kopiuj opisy kadrów]. Makietka kopiuje do schowka
opisy wszystkich kadrów tej strony – ze stylem rysunków i prośbą „bez napisów i dymków”. Wklej je w darmowym Gemini
albo Flow, pobierz obrazy i przeciągnij je na stronę (wyżej). Bez klucza Google Gemini okno jest dostępne właśnie po
to: [Rysuj] jest wyszarzony, a kopiowanie opisów działa.

### Krok 4. Dymki

[Ustaw dymki] stawia dymki z tekstami ze scenariusza w odpowiednich kadrach, z ogonkiem w dół. Potem:

1. Przesuń dymki i końce ogonków tam, gdzie pasują do rysunku.
2. Poprawiasz scenariusz? Kliknij znów [Ustaw dymki] – zmieni się tylko tekst; przesunięte dymki zostają na miejscu.
   Kwestia usunięta ze scenariusza usuwa swój dymek.

- Gdy postać mówi dwa razy z rzędu w tym samym kadrze, drugi dymek staje pod pierwszym i łączy się z nim **mostkiem**.
  Ręcznie: zaznacz dwa dymki (z <kbd>Shift</kbd>) → [Dymek ▾] → **Mostek**; zaznacz połączony dymek i wybierz **Mostek** jeszcze
  raz – rozłączysz.
- Dymek wstawisz też ręcznie: [Dymek ▾] → rodzaj dymka (→ 4.14). **Efekt dźwiękowy** to napis „BUM!” dużymi literami
  z obrysem – zmień tekst, powiększ, obróć.
- **Style komiksu.** Dymki mają styl **Dialog** (Comic Neue, wersaliki), efekty – styl **Efekt dźwiękowy** (Bangers,
  żółty z czarnym obrysem). Zmiana stylu (→ 5.4) zmienia naraz wszystkie dymki albo efekty. W projekcie po ukraińsku
  oba style mają czcionkę Pangolin (z cyrylicą).
- **Wersje językowe.** Dodaj w tabeli scenariusza (okno **Dane**) kolumny `tekst_en`, `tekst_uk`… [Ustaw dymki]
  zapyta wtedy, z której kolumny wziąć teksty – ten sam komiks dostaje teksty w innym języku. Kolumnę przetłumaczy
  też AI: przycisk **✦** przy nazwie kolumny (→ 14.6), np. „przetłumacz kolumnę tekst na angielski”.

### Krok 5. Gotowy komiks

- [Podgląd] – cały komiks strona po stronie albo w rozkładówkach (→ 19).
- [PDF…] – plik do drukarni albo na ekran (→ 21). Komiks w formie **Na ekran** zapisz jako PDF na ekran – otworzysz
  go na komputerze i telefonie jak prezentację.
- [Webtoon] – strony komiksu jedna pod drugą jako obrazy w pliku ZIP, gotowe do wgrania na platformę z komiksami
  do czytania na telefonie.

**Sprawdź przed drukiem** (→ 20) pilnuje komiksu: tekst w dymku mniejszy niż 7 pt, dymek wychodzący poza stronę albo
leżący na dwóch kadrach, ogonek celujący poza kadry i puste kadry (bez obrazu). Przy uwadze o dymku [Otwórz wzór]
zaznacza go na stronie.

**Raster i linie ruchu.** W [Biblioteka] (→ 4.8), w **Tłach i wzorach**, są wzory komiksowe: **Raster komiksowy**,
**Linie ruchu (promieniste)** – do wybuchu, zaskoczenia – i **Linie ruchu (poziome)** – do pędu. Ten sam wzór
nałożysz na zaznaczony kształt, np. kadr (→ 6.5).

### Przykład: komiks z AI od pomysłu do PDF

1. **Nowy projekt** → **Zacznij od: Gotowego szablonu** → **Komiks**, forma **Zeszyt (broszura) z okładką – do druku**, 8 stron.
2. [Komiks] → krok 1 [Napisz z AI…] → **Z pomysłu**: „Ala i Ola znajdują pod drzwiami paczkę z kotkiem i szukają
   jego właściciela”, **Ile stron**: 3 → [Rozpisz] → [Zapisz scenariusz].
3. Krok 1 [Otwórz scenariusz] – przejrzyj kadry; np. w kadrze 1 strony 1 ustaw ujęcie **widok ogólny** i miejsce
   **Miasteczko**. [Zapisz].
4. Krok 2 [Postacie, miejsca i rekwizyty…] – wybierz **Styl rysunków**, w każdej karcie [Narysuj z opisu (AI)] → [Zapisz].
5. Przejdź na pierwszą stronę komiksu. Krok 3 [Rysuj kadry tej strony…] → [Rysuj]. Powtórz na kolejnych stronach.
6. Krok 4 [Ustaw dymki] i przesuń dymki tam, gdzie pasują.
7. Krok 5 [PDF…].

**Ile to kosztuje.** 3 strony po 3 kadry i dwie postacie w jakości **Szkic**: 2 obrazy wzorcowe + 9 kadrów =
11 obrazów, **ok. 1,50 zł** i kilka minut. Scenariusz – ok. jeden grosz. Na 24 strony (ok. 85 obrazów) wyjdzie
ok. 12 zł w szkicu; w jakości **Dokładny** – mniej więcej trzy razy tyle. Makietka pokazuje koszt przed każdym
rysowaniem.

![Strona 1 przykładowego komiksu narysowana przez AI (Szkic), z dymkami ze scenariusza](k-komiks-ai-przyklad.png)

> Wskazówka: Obrazy do kadrów możesz zrobić w dowolnym programie – tekst zawsze jest w dymkach Makietki, nie
> w obrazie, więc łatwo go poprawić i przetłumaczyć.

# 11. Wzorce stron

## 11.1 Czym jest wzorzec i kiedy go użyć

Niektóre rzeczy powtarzają się na wielu stronach: **numer strony, nagłówek, stopka, tło, ramka,
linie do pisania**. Zamiast wstawiać je na każdą stronę osobno, wstawiasz je raz — jako **wzorzec**.

- Wzorzec leży **pod** treścią każdej strony, która go ma. Na samej stronie go nie zaznaczysz
  ani nie przesuniesz — dzięki temu nie rozjedzie się przypadkiem.
- Zmieniasz go raz, a zmieniają się **wszystkie** te strony.
- Pole `{nr}` we wzorcu pokazuje na każdej stronie jej własny numer: jeden wzorzec, a na stronach 1, 2, 3…
- Strona może mieć kilka wzorców naraz, np. „Kratka” pod treścią i „Numer strony” na dole.

Kiedy wzorzec, a kiedy zwykły element? Jeśli coś ma być **na wielu stronach w tym samym miejscu** —
wzorzec. Jeśli tylko na jednej stronie — zwykły element.

![Okno Wzorce stron: co to jest i gotowe wzorce](k-wzorce-galeria.png)

## 11.2 Gdzie są wzorce

- [Wzorce] pod listą stron (obok [Sekcja]) i na górnym pasku edytora — otwiera okno **Wzorce stron**.
- Menu ⋯ strony → [Wzorce tej strony…] — przechodzi na tę stronę i otwiera okno.
- Menu ⋯ sekcji → [Wzorce sekcji…].
- Właściwości strony (nic nie jest zaznaczone) → część **Wzorce**: które wzorce są na tej stronie;
  dopóki projekt nie ma wzorców, jest tam przycisk [Wybierz gotowy wzorzec…].
- Biblioteka → kategoria **Wzorce stron** — te same gotowe wzorce co w oknie.

Strona, na której leży wzorzec, ma na miniaturze mały fioletowy znak; podpowiedź na nim mówi, jakie to wzorce.

## 11.3 Gotowe wzorce

W oknie **Wzorce stron** niżej jest galeria gotowych wzorców z podglądami — na schemacie elementy wzorca
są wyraźne, a blade bloki to treść strony. Grupy:

| Grupa | Przykłady |
|---|---|
| Numeracja | numer na dole, przy zewnętrznej krawędzi, „Strona 5 z 120”, w kółku, na pasku bocznym, rzymski |
| Nagłówki i stopki | nazwa sekcji, projekt i sekcja, kolorowy pas, stopka z kontaktem |
| Tła i papier | linie, kratka, kropki, papier milimetrowy, zeszyt z marginesem, kolorowe tło, znak wodny |
| Ramki | w marginesach, podwójna, zaokrąglona, obwódka strony, narożniki |
| Kalendarz i planer | zakładka na brzegu, nagłówek dnia, kolumna „Notatki”, tydzień |
| Książka | żywa pagina z tytułem rozdziału, numer i rozdział u góry |
| Katalog i oferta, Gazetka, Zaproszenie | logo i kontakt, winieta, szpalty, ozdobna ramka, pasy |

Kliknięcie karty dodaje wzorzec do projektu i **od razu na wszystkie strony sekcji** otwartej strony —
okno się zamyka, a wzorzec widać na stronie. [Cofnij] w komunikacie albo <kbd>Ctrl</kbd>+<kbd>Z</kbd>
odwraca to jednym krokiem. Gotowe wzorce dopasowują się do formatu i marginesów sekcji, a kolory
i czcionki biorą z zestawu marki (→ 27.9), jeśli go masz. Po dodaniu to zwykły wzorzec — możesz go zmienić.

## 11.4 Na których stronach jest wzorzec

W oknie, w części **W tym projekcie**, przy każdym wzorcu:

| Przycisk | Co robi |
|---|---|
| [+ Dodaj do tej strony] | Włącza wzorzec tylko na otwartej stronie. Ponowne kliknięcie (✓) go zdejmuje. |
| [+ Do całej sekcji] | Włącza wzorzec na stronach sekcji, które nie mają własnego wyboru. |
| [Edytuj] | Otwiera wzorzec do edycji (→ 11.5). |
| [⋯] | [Zmień nazwę], [Duplikuj], [Przesuń wyżej], [Przesuń niżej], [Usuń wzorzec]. |

Pojedynczej stronie wybierzesz wzorce też we właściwościach strony: **Wzorce na tej stronie** →
**Jak w sekcji** albo **Własny wybór** i przełączniki przy nazwach.

![Okno Wzorce](okno-wzorcow.png)

## 11.5 Własny wzorzec i edycja

[Narysuj własny wzorzec] tworzy pusty wzorzec i od razu go otwiera. [Edytuj] otwiera istniejący.
Fioletowy pasek nad stroną przypomina, że zmieniasz wzorzec — wszystko, co tu narysujesz, pojawi się
na stronach z tym wzorcem; [Gotowe] wraca do stron. Na zwykłych stronach elementy wzorca widać
na liście warstw, a kliknięcie tam otwiera wzorzec.

![Edycja wzorca](wzorce.png)

## 11.6 Nad treścią i odbicie lustrzane

Elementy wzorca leżą **pod** treścią strony. Zaznacz element we wzorcu i włącz:

- **Nad treścią strony** — element przykryje treść, np. ramka albo znak wodny,
- **Odbijaj lustrzanie na lewych stronach** — element przy prawej krawędzi (np. numer strony)
  na lewych stronach rozkładówek przejdzie na lewą krawędź. Gotowe wzorce „przy zewnętrznej krawędzi”
  mają to włączone.

## 11.7 Pola we wzorcu

Wpisz we wzorcu tekst z polem, np. `Strona {nr} z {liczba_stron}`, `{sekcja}` albo `{rozdzial}`
(tytuł bieżącego rozdziału). Na każdej stronie pojawi się jej wartość. Najprościej zacząć od gotowego
wzorca z numerem strony (→ 11.3).

# 12. Linie pomocnicze, siatka i powiększenie

Rzeczy, które pomagają ustawiać elementy, a nie drukują się: marginesy, spad, siatka, prowadnice, powiększenie.

## 12.1 Linie na stronie

Linie pomocnicze nie są drukowane:

| Linia | Znaczenie |
|---|---|
| **Czerwona** | Krawędź strony po przycięciu. |
| **Różowy pas** | Spad. Tła i zdjęcia, które mają sięgać krawędzi, rozciągnij aż do jego końca. |
| **Niebieska przerywana** | Margines. Teksty trzymaj w środku. |
| **Gruba ciemna** | Grzbiet rozkładówki. |
| **Przerywane z podpisami** | Na okładce: zgięcia — grzbiet, bigi, zawinięcia (→ 10.6). |
| **Turkusowa** | Prowadnica (→ 12.4). |

Przycisk linii pomocniczych (<kbd>W</kbd>) przy powiększeniu chowa je wszystkie.

## 12.2 Ostrzeżenia

Element w marginesie albo poza spadem, tekst, który się nie mieści, czy pole z literówką dostają
pomarańczową ramkę i trafiają na listę **Ostrzeżenia**. Na komputerze otwiera ją przycisk z trójkątem
obok powiększenia (<kbd>F8</kbd>) — liczba na nim mówi, ile jest uwag; okienko nie blokuje pracy, zamyka je
krzyżyk albo <kbd>Esc</kbd>. Na telefonie — przycisk [Ostrzeżenia] na dole ekranu. Kliknięcie pozycji
zaznacza element. Gdy to celowe (np. tło na spad), kliknij [Wycisz].

![Ostrzeżenia](ostrzezenia.png)

## 12.3 Siatka

W menu widoku (→ 3.6): **Siatka** pokazuje linie co **Krok siatki** (w mm, od rogu strony),
a **Przyciągaj do siatki** ustawia lewy górny róg przesuwanego elementu na linii siatki.

![Siatka i prowadnice](siatka.png)

## 12.4 Linijki i prowadnice

- **Linijki** pokazują milimetry; zero leży w rogu otwartej strony.
- **Prowadnicę** wyciągniesz z linijki: z górnej w dół — poziomą, z lewej w prawo — pionową.
  Prowadnicę można przesunąć; wyciągnięta poza stronę znika.
- We właściwościach strony część **Prowadnice** pozwala wpisać położenie liczbą i dodać
  prowadnicę pionową albo poziomą.
- **Zablokuj prowadnice** w menu widoku chroni je przed przypadkowym przesunięciem.

## 12.5 Przyciąganie i odległości

Przy przesuwaniu i zmianie rozmiaru element przyciąga się do krawędzi, marginesów i środka strony,
do prowadnic i do innych elementów:

- **różowa linia** — krawędź albo środek zrównały się z innym elementem,
- **strzałki z liczbą** — odległość w mm do najbliższych elementów,
- **fioletowe liczby** — odstęp jest równy innemu odstępowi w rzędzie.

Przytrzymany <kbd>Ctrl</kbd> na chwilę wyłącza przyciąganie. Przytrzymany <kbd>Alt</kbd> przy
zaznaczonym elemencie pokazuje też odległości do krawędzi strony.

![Równe odstępy](odleglosci.png)

## 12.6 Powiększenie

- [−] i [+] w prawym dolnym rogu; kliknięcie procentu dopasowuje stronę do okna (<kbd>Ctrl</kbd>+<kbd>0</kbd>).
- <kbd>Ctrl</kbd> + kółko myszy powiększa w miejscu kursora.
- Spacja + przeciąganie przesuwa widok.
- Na ekranie dotykowym — dwa palce (→ 28.1).

# 13. Książka: spis treści, pagina, przypisy, odsyłacze, skorowidz

Spis treści, tytuł rozdziału w stopce, przypisy, odsyłacze i skorowidz — liczą się same.

## 13.1 W skrócie

Numery stron biorą się z numeracji sekcji (→ 10.8), także ze stronami powielonymi serią (→ 16).

![Spis treści, przypis i żywa pagina na stronach książki](ksiazka.png)

## 13.2 Nagłówki

Nagłówki to teksty w stylach akapitu (→ 5.4), które projekt uznaje za tytuły rozdziałów. Z nich powstają spis treści, żywa pagina i lista odsyłaczy.

- Bez ustawień styl **Tytuł** to nagłówek 1 (rozdział), a **Nagłówek** – nagłówek 2.
- Inne style ustawisz w panelu spisu treści: przy każdym stylu wybierz **nagłówek 1**, **nagłówek 2**, **nagłówek 3** albo **nie jest nagłówkiem**.

> Wskazówka: nadaj ten sam styl wszystkim tytułom rozdziałów – wtedy spis treści i pagina ułożą się same.

## 13.3 Spis treści

1. Otwórz [Biblioteka] → **Książka** → **Spis treści** (albo <kbd>Ctrl</kbd>+<kbd>K</kbd> i „spis treści”).
2. Spis staje na stronie jako tekst i od razu wypełnia się nagłówkami z numerami stron.
3. Wygląd (czcionkę, rozmiar, interlinię) zmieniasz jak w każdym tekście.

![Spis treści i jego panel](k-spis-tresci.png)

| Ustawienie | Co robi |
|---|---|
| **Poziomy** | **tylko rozdziały**, **rozdziały i podrozdziały** albo **trzy poziomy**; niższe poziomy są wcięte. |
| **Kropki do numeru strony** | Wypełnia odstęp między tytułem a numerem kropkami. |
| **Styl „…”** | Który styl jest nagłówkiem i jakiego poziomu (→ 13.2). |
| [Odśwież teraz] | Układa spis od razu. Zwykle nie trzeba – spis odświeża się sam po każdej zmianie. |

Długi spis przelej do kolejnej ramki, także na następnej stronie (→ 5.7). Treści spisu nie wpisuje się ręcznie – przy następnym odświeżeniu ułożyłaby się od nowa.

## 13.4 Żywa pagina

Żywa pagina to tytuł bieżącego rozdziału w stopce albo nagłówku strony.

1. Otwórz wzorzec stopki (→ 11).
2. W tekście stopki wybierz **Wstaw pole** → **{rozdzial}**. Obok możesz dać numer strony: `{rozdzial} – {nr}`.

Na każdej stronie pole pokazuje ostatni nagłówek 1 do tej strony. `{rozdzial:2}` pokazuje nagłówek 2 – nowy rozdział go zeruje.

## 13.5 Przypisy dolne

1. Zaznacz tekst (albo pisz w nim – przypis stanie w miejscu kursora).
2. W panelu, w części **Przypisy, odsyłacze, skorowidz**, wybierz [Wstaw przypis] (albo <kbd>Ctrl</kbd>+<kbd>K</kbd> i „przypis”).
3. W polu **Przypis 1** wpisz treść.

![Przypis w panelu i na dole strony](k-przypisy.png)

- W tekście staje numer w indeksie górnym, a treść – na dole tej samej strony, nad dolnym marginesem, pod krótką kreską. W edytorze widać ją od razu, ale nie da się jej zaznaczyć: zmieniasz ją w panelu.
- Numery liczą się same. **Numeracja przypisów**: **Od nowa w każdej sekcji**, **Od nowa na każdej stronie** albo **W całym projekcie**.
- Tekst płynący przez kilka ramek zabiera przypis ze sobą: przypis jest na tej stronie, na której stoi jego numer.
- Wygląd przypisów: styl akapitu o nazwie **Przypis** (jeśli go nie ma – pismo 8 pt).
- [Usuń przypis] zdejmuje i numer z tekstu, i treść.

## 13.6 Odsyłacze

Odsyłacz to numer strony innego miejsca w książce, np. „zob. s. 12”.

1. Zaznacz tekst, w którym ma stać odsyłacz.
2. W części **Przypisy, odsyłacze, skorowidz** wybierz z listy **Wstaw odsyłacz do** nagłówek.
3. W tekście pojawi się „s. 12” – numer zmienia się sam, gdy strony się przesuną.

W edytorze odsyłacz widać jako pole `{s:…}`; liczbę zobaczysz w podglądzie i w PDF. Gdy nagłówek usuniesz, zamiast numeru stanie „?”, a **Sprawdź przed drukiem** o tym przypomni (→ 20).

## 13.7 Skorowidz

1. Zaznacz słowo w pisanym tekście.
2. Wybierz [Dodaj do skorowidza] (albo <kbd>Ctrl</kbd>+<kbd>K</kbd> i „skorowidz”). Bez zaznaczenia aplikacja zapyta o hasło.
3. Wstaw skorowidz: [Biblioteka] → **Książka** → **Skorowidz**.

Skorowidz ma hasła alfabetycznie (po polsku: ą po a, ł po l) z numerami wszystkich stron, na których słowo występuje w jakimkolwiek tekście – wielkość liter nie ma znaczenia, a kolejne strony łączą się w zakres (3–5). Hasła tekstu widać w panelu jako żetony; kliknięcie żetonu usuwa hasło.
