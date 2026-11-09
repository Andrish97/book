# Plan: narzędzie do projektowania publikacji z podkładaniem danych

Robocza nazwa: **Kalendarz / Publisher-lite** (do ustalenia)

## 1. Cel

Webowy edytor stron (wektorowy, oparty na Fabric.js), w którym:
- projektuje się każdą stronę osobno (tekst, kształty, obrazy, pola z danymi),
- wybiera się zakresy stron, które mają być powielane według danych,
- dla całego projektu można ustawić format wydruku (np. A5 + spad + znaki cięcia),
- na końcu generuje się jeden PDF ze wszystkimi stronami w kolejności, z rozwiniętymi powieleniami.

Działa w przeglądarce, więc na Macu i na Androidzie (Chrome, tablet).

## 2. Główne pojęcia

| Pojęcie | Znaczenie |
|---|---|
| **Projekt** | Cały dokument: ustawienia wydruku, strony, zakresy, źródła danych, motywy. Zapisywany jako JSON + folder z zasobami (obrazy, czcionki). |
| **Strona (szablon)** | Pojedyncza strona edytowana w silniku. Zawiera obiekty Fabric oraz pola z danymi. Każda strona jest edytowana osobno. |
| **Obiekt** | Element na stronie: tekst, prostokąt, linia, obraz, grupa. Każdy obiekt ma właściwości wydruku (pozycja, rozmiar, obrót, warstwa). |
| **Pole (binding)** | Obiekt, który pobiera treść z kolumny tabeli. Ma nazwę pola, przypisanie do kolumny i zasady dopasowania tekstu. |
| **Tabela** | Nazwany zestaw pól (np. "Dzień": data, tytuł, opis). Tabela jest powiązana z arkuszem danych i definiuje nazwy kolumn. |
| **Źródło danych** | Plik CSV lub arkusz XLSX. Każdy wiersz to jedno powielenie (albo jeden wiersz tabeli). |
| **Zakres** | Ciągły fragment stron w projekcie (np. strony 10–17), który będzie powielany. Ma przypisane źródło danych. |
| **Nakładka motywu** | Warstwa stylu (np. tło, ramka, logo, kolor nagłówka) przypisana do konkretnych stron lub zakresów. |
| **Rozwinięcie** | Ostatni etap: powielenie zakresów według danych i złożenie wszystkich stron w jeden ciąg. |

## 3. Model danych projektu (szkic)

```json
{
  "wydruk": { "format": "A5", "szerokosc_mm": 148, "wysokosc_mm": 210,
              "spad_mm": 3, "marginesy_mm": 10, "znaki_ciecia": true },
  "zrodla": [
    { "id": "dni", "plik": "dni.csv", "typ": "csv" }
  ],
  "tabele": [
    { "id": "Dzien", "zrodlo": "dni", "pola": ["data", "tytul", "opis"],
      "uklad": "szeroki" | "dlugi" }
  ],
  "strony": [
    { "id": "p1", "nazwa": "Okładka", "obiekty": [ /* obiekty Fabric */ ] },
    { "id": "p2", "nazwa": "Dzień – wzór 1", "obiekty": [
        { "typ": "tekst", "pole": { "tabela": "Dzien", "kolumna": "tytul" },
          "autodopasowanie": true, "min_rozmiar": 6 } ] }
  ],
  "zakresy": [
    { "od": 10, "do": 17, "tabela": "Dzien", "powtorzenia": "z_zrodla" }
  ],
  "motywy": [
    { "id": "ramka_miesiaca", "strony": [3, 12, 22], "warstwy": [ /* obiekty */ ] }
  ]
}
```

## 4. Edytor (silnik)

### 4.1 Podstawa
- **Fabric.js** na płótnie HTML5. Obiekty wektorowe, przeciąganie, skalowanie, obracanie, grupowanie, warstwy.
- Jedno płótno = jedna strona. Przełączanie stron w panelu bocznym (miniatury).
- Skala wyświetlania niezależna od rozmiaru w mm. Układ zawsze w milimetrach, przeliczany na piksele tylko do podglądu.

### 4.2 Obsługiwane elementy (MVP)
- Tekst (czcionka, rozmiar, wyrównanie, interlinia, kolor, pogrubienie, kursywa).
- Prostokąt, elipsa, linia.
- Obraz: wstawianie z dysku, skalowanie, przycinanie (crop), obrys.
- Grupy obiektów.

### 4.3 Pola z danymi
- **Wszystko jest tekstem.** Pola nie mają typów danych (brak typu „data”). Data, którą trzeba pokazać, jest rozbita na osobne bloki, np. dzień, nazwa miesiąca, rok, każdy z własną kolumną w arkuszu.
- **Szablon tekstu:** jeden blok tekstowy może mieć zmienne wstawione w środku zwykłego tekstu, np. `{dzien}. {miesiac} {rok}`. Zmienne są zastępowane wartościami przy każdym powieleniu. Zmienne nie są osobnymi obiektami, tylko częścią treści.
- **Zmienne w edytorze** wyglądają jak zwykły tekst z wyróżnieniem (np. kolorem tła), żeby było widać, co zostanie podmienione.
- Każdy tekst lub obraz może być **polem**. Wtedy w panelu właściwości wybiera się tabelę i kolumnę.
- Pole obrazu wskazuje na kolumnę ze ścieżką pliku lub nazwą pliku w folderze zasobów.
- Podgląd: w trybie projektowania pole pokazuje nazwę (np. `{Dzien.tytul}`), a w trybie podglądu wstawia przykładowe dane z pierwszego wiersza.
- **Autodopasowanie tekstu:** jeśli treść nie mieści się w polu, czcionka się zmniejsza, aż się zmieści, ale nie poniżej minimalnego rozmiaru. Jeśli nadal nie mieści się, pole oznacza się ostrzeżeniem.

### 4.4 Tabele i pola
- **Uniwersalny import:** CSV i XLSX z dowolnego edytora arkuszy (Excel, Google Sheets, LibreOffice). Każde źródło jest czytane jako tekst. Kodowanie (UTF-8, Windows-1250) i separator (`,`, `;`, tabulator) wykrywane automatycznie, z możliwością ręcznej zmiany.
- **Formatowanie danych:** zachowywane są podziały linii w komórce i podstawowe znaczniki, żeby długie opisy wyglądały tak jak w arkuszu.
- Tabela definiuje nazwy pól. Pola można dodawać ręcznie albo wczytać nagłówki z pliku CSV/XLSX.
- W jednym projekcie może być kilka tabel. Każda jest powiązana z jednym źródłem danych (albo z częścią źródła).
- Tabela może być używana tylko na wybranych zakresach.

### 4.5 Układy stron i marginesy
- **Tryby układu:** pojedyncza strona, broszura/książka (strony lewa i prawa tworzą parę), i kolejne tryby w miarę potrzeb.
- **Marginesy symetryczne** (lustrzane) w trybie książkowym: wewnętrzny (grzbiet) i zewnętrzny mogą się różnić. Na etapie pierwszym wystarczy ustawienie symetryczne, asymetria jako rozszerzenie.
- **Widok edytora:** strony pokazywane są bez marginesów, tak jak wyglądają po wydruku. Marginesy, spad i znaki cięcia rysowane są jako prowadnice, które można włączyć lub wyłączyć.
- **Ostrzeżenia o układzie (bez blokowania):**
  - obiekt wystający poza obszar bezpieczny (w marginesie lub w spadzie) jest oznaczany ostrzeżeniem,
  - obiekt przecinający linię składania lub grzbiet w trybie książkowym również,
  - ostrzeżenie zostaje na liście, a użytkownik może je zignorować (np. celowe wyjście poza margines). Można je wyciszyć dla konkretnego obiektu.
- **Brakujące dane:** pole powiązane z kolumną, w której brakuje wartości, dostaje ostrzeżenie w liście problemów i wyraźny znacznik w edytorze. Nie blokuje eksportu, ale użytkownik musi o tym wiedzieć.
- **Duplikaty w puli „unikalne”:** ta sama wartość użyta drugi raz w projekcie (patrz 5.1).
- **Brak wartości w puli:** za mało wartości na liczbę powieleń w trybie „unikalne”.

### 4.6 Kopiowanie stron i odbicia lustrzane
- **Duplikowanie strony** (zwykła kopia) i **kopia lustrzana** (odbicie poziome, a w razie potrzeby pionowe).
- Kopia lustrzana przenosi położenie obiektów na drugą stronę osi odbicia. Tekst nie jest odbijany lustrzanie (glify zostają normalne), tylko przenoszony. Wyrównanie tekstu zmienia się na przeciwne: do lewej staje się do prawej, i odwrotnie. Wyśrodkowanie zostaje bez zmian.
- Obrazy i kształty są przenoszone na drugą stronę osi. Nie są odwracane lustrzanie, chyba że użytkownik zaznaczy to osobno dla konkretnego obrazu.
- Lustrzana kopia dziedziczy pola z danymi i nakładki motywu, ale użytkownik może je rozłączyć.

### 4.7 Obsługa dotykiem i małymi ekranami
- **Urządzenia:** tablet (główne urządzenie do edycji, najlepiej w poziomie), telefon (podgląd, ostrzeżenia, drobne poprawki tekstu, wgrywanie danych), komputer (opcjonalnie, do dużych zmian).
- **Gesty (do ustalenia i przetestowania):**
  - jeden palec: zaznaczanie i przesuwanie obiektu,
  - dwa palce: przesuwanie widoku płótna,
  - szczypanie: zoom widoku, a skalowanie i obracanie obiektu przez uchwyty.
- **Uchwyty:** powiększony obszar dotyku dla uchwytów skalowania i obrotu (Fabric pozwala ustawić osobny rozmiar dla dotyku).
- **Precyzja:** pola liczbowe w mm (pozycja, rozmiar, marginesy) w panelu właściwości; prowadnice przyciągające obiekty.
- **Panele:** na telefonie panele (strony, właściwości, ostrzeżenia) są wysuwane z dołu i zwijane.
- **Edycja tekstu:** test wpisywania w Chrome na Androidzie i Safari na iPadzie, z klawiaturą ekranową zasłaniającą część strony. Jeśli będzie niewygodnie, edycja treści otwiera się w osobnym polu tekstowym nad klawiaturą.
- **Rysik:** wsparcie dla rysika (nacisk, odrzucanie dłoni) jako opcja na później, jeśli będzie potrzebne do rysowania.
- **Wydajność:** na płótnie jest tylko bieżąca strona; miniatury generowane leniwie. Duże zdjęcia są skalowane do edycji, a do eksportu używane są oryginały.
- **Test referencyjny:** pierwszy prototyp testowany na tablecie z Androidem (Lenovo), zanim powstanie reszta funkcji.

## 5. Zakresy i powielanie

- Użytkownik zaznacza ciąg stron (np. 8 stron) i tworzy z nich **zakres**.
- Zakres ma przypisane źródło danych i tryb powtórzeń:
  - `z_zrodla` – liczba powtórzeń = liczba wierszy w pliku danych,
  - `stała` – np. 12 razy (miesiące w roku),
  - `ręczna` – lista wartości.
- W jednym projekcie może być kilka zakresów. Każdy działa niezależnie.
- Wynikowa numeracja jest wyliczana automatycznie. Przykład: zakres 8 stron (strony 10–17) powtórzony 30 razy daje 240 stron w wyniku, czyli strony 10–249. Strony po zakresie przesuwają się o `8 × 30 − 8 = 232`. Numeracja w wyniku widoczna jest w podglądzie.
- **Dwa układy danych** (obsługiwane oba):
  - **szeroki** – jeden wiersz to cały blok; kolumny mają przedrostki stron (np. `s1_tytul`, `s2_tytul`, …). Blok z 8 stronami ma wtedy 8 grup kolumn.
  - **długi** – jeden wiersz to jedna strona; kolumna `slot` (1–8) wskazuje stronę w bloku.

### 5.1 Pule wartości (tagi, listy, kolejność)
- **Pula** to lista wartości tekstowych pochodząca z kolumny pliku danych (np. lista tagów). Pole na stronie może wskazywać na pulę zamiast na pojedynczą wartość.
- **Pula zawiera wyłącznie tekst.** Wygląd (kolor, czcionka, rozmiar, wyrównanie) nie jest częścią wartości, tylko należy do pola tekstowego na stronie. Ta sama wartość wyświetli się więc zawsze tak, jak ustawiono pole.
- **Tryby wypełniania pola z puli:**
  - **sekwencja cykliczna** – wartości idą po kolei i po ostatniej wraca się do pierwszej. Przykład: pula z 8 wartościami na zakresie 8-stronicowym; każde powielenie dostaje kolejną wartość, a po ósmej znów pierwszą. Najczęstszy przypadek.
  - **unikalne** – każda wartość z puli może być użyta tylko raz w całym projekcie. Po wykorzystaniu wartość jest oznaczana jako zajęta.
  - **ręczne** – wartość wpisywana przez użytkownika na konkretnej stronie. Zawsze nadpisuje pulę dla tej strony, czyli to rozwiązanie na niestandardowe przypadki.
- **Pilnowanie duplikatów:** dla puli w trybie „unikalne” duplikat w całym projekcie generuje ostrzeżenie. Ostrzeżenie pokazuje obie strony, na których wartość występuje, a nie blokuje eksportu.
- **Liczba wartości a liczba powieleń:** jeśli pula ma mniej wartości niż powieleń, a tryb to „unikalne”, aplikacja ostrzega o brakach. W trybie cyklicznym brak nie jest problemem, bo lista się powtarza.

### 5.2 Eksport szablonu danych (w drugą stronę)
- Aplikacja generuje **plik szablonu** (CSV lub XLSX) z kolumnami dokładnie takimi, jakich wymaga projekt. Pierwszy wiersz to nagłówki, a każdy kolejny wiersz to jedno powielenie (w układzie długim: jedna strona).
- Szablon zawiera przykładowe wartości i komentarz w pierwszym wierszu lub w osobnym arkuszu „Instrukcja”, co wpisać w każdej kolumnie.
- **Podpowiedzi dla użytkownika, jak uzupełnić:**
  - w Google Sheets i Excelu: lista rozwijana (walidacja danych) z pulą tagów, żeby nie wpisywać ręcznie i nie pomylić się,
  - formatowanie warunkowe, które podświetla powtórzone tagi w kolumnie,
  - kolumna z numerem powielenia, żeby łatwiej wiedzieć, na której stronie będzie dana wartość.
- Po uzupełnieniu użytkownik wgrywa plik z powrotem. Aplikacja sprawdza nagłówki, typy wartości (w tekście) i brakujące kolumny, zanim pokaże podgląd.
- **Wartości ręczne:** jeśli wypełniający chce coś nadpisać, wpisuje to w kolumnie „ręcznie” w danym wierszu. Puste pole oznacza użycie puli.

### 5.3 Zakres funkcji uzupełniania w aplikacji
- Nie piszemy pełnego silnika arkuszy kalkulacyjnych. Zamiast tego aplikacja obsługuje: import pliku, generowanie szablonu, podgląd i listę ostrzeżeń.
- Prosty edytor list (dodawanie, usuwanie i kolejność elementów puli) jest dopuszczalny w aplikacji, bo to mała funkcja i zwykle wystarcza. Pełna edycja tabeli w aplikacji to osobny, większy projekt, który nie jest w zakresie MVP.

## 6. Nakładki motywu

- Nakładka to zestaw obiektów, który jest nakładany na wybrane strony (lub zakresy) na czas rozwinięcia.
- Kolejność warstw: tło motywu → strona szablonu → nakładka motywu (konfigurowalna).
- Nakładka może być przypisana do: pojedynczych stron, zakresu, albo wszystkich stron w danym zakresie.
- Motyw jest stosowany dopiero w etapie rozwinięcia. W edytorze widać go w trybie podglądu.

## 7. Wydruk i eksport

- **Format:** dowolny rozmiar w mm. Domyślnie A5. Zmiana w ustawieniach wydruku przelicza wszystkie strony.
- **Spad i znaki cięcia:** ustawiane globalnie, bez ręcznej edycji stron.
- **Profil kolorów (wybór przy eksporcie):**
  - RGB – do podglądu i ewentualnych wydruków cyfrowych,
  - CMYK – do drukarni offsetowej lub cyfrowej, jeśli tego wymagają.
  Kolory na ekranie mogą wyglądać inaczej niż po wydruku w CMYK, więc przy wyborze CMYK aplikacja pokazuje ostrzeżenie o możliwej zmianie odcienia.
- **Podział na części:** przy eksporcie można pociąć projekt na pliki po N stron. Gotowe wartości domyślne (np. 10, 12, 50, 100 stron) i pole na własną liczbę. Podział jest wykonywany po pełnych stronach, a zakresy są nazwane (np. „część 1 – strony 1–12”).
- **Eksport PDF:** wektorowy, czcionki osadzone, obrazy w zadanej rozdzielczości (np. 300 dpi).
- **Podgląd:** PNG pojedynczych stron i wyświetlanie całości w przeglądarce (przewijanie).
- **Silnik eksportu** (do wyboru):
  - klient w przeglądarce (np. jsPDF lub generowanie w pdf-lib),
  - albo skrypt Python (WeasyPrint lub Playwright) uruchamiany na komputerze.
  Na początku wystarczy eksport w przeglądarce. Wydruk 250+ stron może wymagać eksportu po stronie komputera.

## 8. Przepływ pracy

1. Utwórz projekt i ustaw format wydruku.
2. Wczytaj źródło danych (CSV/XLSX), które będzie potrzebne do powieleń.
3. Zaprojektuj strony w edytorze. Pola z danymi wiążesz z kolumnami.
4. Zaznacz zakresy stron i przypisz im źródło danych oraz tryb powtórzeń.
5. Opcjonalnie dodaj nakładki motywu do stron albo zakresów.
6. Podgląd całości (lista stron z numeracją po rozwinięciu).
7. Eksport PDF.

Rozwinięcie jest ostatnim krokiem. Przed nim wszystko edytujesz na stronach szablonu.

## 9. Architektura techniczna (propozycja)

- **Frontend:** Vanilla JS lub lekki framework; Fabric.js do edycji.
- **Backend:** Supabase, darmowy plan, jedno konto (Twoje). Zakładam, że schemat od początku ma pole `owner_id` i reguły dostępu (RLS), żeby późniejsze udostępnianie innym osobom nie wymagało przebudowy.
  - **Auth:** logowanie e-mailem (jedno konto na start).
  - **Baza (Postgres):** tabela `projekty` z kolumną `dane` typu `jsonb` (cały projekt z sekcji 3), `owner_id`, daty zmian.
  - **Storage:** obrazy i czcionki projektu, w osobnym bucketcie per użytkownik.
- **Lokalna pamięć podręczna:** IndexedDB, żeby edycja działała przy słabym połączeniu, a zmiany synchronizowały się po powrocie sieci.
- **Dane:** parsowanie CSV w przeglądarce (np. PapaParse), XLSX (SheetJS).
- **Hosting frontendu:** statyczny, np. GitHub Pages.
- **Limity darmowego planu** (do sprawdzenia na bieżącej stronie cennika przed startem): ograniczony rozmiar bazy i storage, a projekty na darmowym planie mogą być usypiane przy długiej nieaktywności. Przy jednym użytkowniku to powinno wystarczyć, a skalowanie to zmiana planu, bez przepisywania aplikacji.
- **Eksport PDF** odbywa się w przeglądarce, więc Supabase obsługuje tylko zapis danych i pliki.

## 10. Etapy realizacji

**Etap 1 – szkielet (MVP)**
- Projekt, strony, płótno Fabric, tekst i obrazy.
- Ustawienia wydruku (format, spad).
- Zapis i odczyt projektu (JSON).

**Etap 2 – dane i pola**
- Import CSV i XLSX, definicja tabel.
- Pola tekstowe i obrazowe z mapowaniem kolumn.
- Autodopasowanie tekstu i ostrzeżenia.

**Etap 3 – zakresy i rozwinięcie**
- Tworzenie zakresów, tryb `z_zrodla`, `stała`, `ręczna`.
- Układ szeroki i długi.
- Podgląd rozwiniętego ciągu stron z numeracją.

**Etap 4 – motywy i eksport**
- Nakładki motywu dla stron i zakresów.
- Eksport PDF (spad, znaki cięcia, obrazy 300 dpi).

**Etap 5 – dopracowanie**
- Biblioteka szablonów, skróty klawiszowe, cofanie zmian, testy na dużych projektach (250+ stron).

## 11. Ryzyka i otwarte pytania

- **Wydajność:** 250+ stron z obrazami może być ciężkie w przeglądarce. Eksport może wymagać osobnego procesu.
- **Czcionki:** używamy wyłącznie czcionek z licencją pozwalającą na użycie komercyjne i osadzanie w PDF, np. z rodziny SIL Open Font License (OFL) lub Apache 2.0, które są dostępne m.in. w Google Fonts. Wydruk sprzedawany znajomym to użycie komercyjne, więc licencję każdej czcionki trzeba sprawdzić osobno przed dodaniem do projektu. Lista dozwolonych czcionek będzie w aplikacji, a inne nie będą dodawane do projektu.
- **Licencja:** kod `familiada` jest tylko do wglądu, więc nowe narzędzie powstaje od zera. Ewentualne inspiracje z edytora logo nie są kopiowane.
- **Do potwierdzenia:**
  1. Czy jeden projekt ma mieć wiele tabel, czy jedną główną?
  2. Czy potrzebujesz eksportu z wielu źródeł danych naraz?

**Rozstrzygnięte w rozmowie:** profil kolorów RGB/CMYK jako wybór przy eksporcie; podział PDF na części z domyślnymi wartościami i własną liczbą stron; import uniwersalny (CSV/XLSX z różnych edytorów); czcionki wyłącznie z licencją komercyjną; wszystkie pola są tekstem, daty rozbijane na bloki, zmienne wstawiane w środku tekstu.

## 12. Następny krok

Zacząć od Etapu 1: szkielet edytora w Fabric.js z ustawieniami wydruku, zapisem projektu w JSON i podstawowym połączeniem z Supabase (logowanie i tabela `projekty`).
