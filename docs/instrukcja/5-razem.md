# Część V. Razem z innymi {ikona=uzytkownik}

Wspólna praca nad projektem i asystent AI.

# 25. Współpraca

Wspólna praca nad projektem: zaproszenia, role i komentarze.

## 25.1 Zapraszanie

Każda osoba pracuje na swoim koncie, a zmiany widać u wszystkich na żywo. Wybierz [⋯] → [Współpraca…]
w edytorze albo na karcie projektu.

![Współpraca w menu ⋯](k-menu-wspolpraca.png)

W części **Zaproś osobę**:

1. W polu **E-mail albo nazwa użytkownika** wpisz adres albo nazwę — po dwóch literach pojawią się
   pasujące nazwy użytkowników.
2. Wybierz **Rolę** (→ 25.2).
3. Kliknij [Zaproś].

Aplikacja wysyła e-mail z linkiem do zaproszenia. Link możesz też skopiować i wysłać sam. Przy
zaproszeniu po nazwie nie widzisz adresu e-mail tej osoby.

![Okno Współpraca](wspolpraca.png)

## 25.2 Role

| Rola | Co może |
|---|---|
| **może edytować** | Zmienia strony, dane, wzorce i style; eksportuje PDF. |
| **może oglądać** | Otwiera projekt tylko w podglądzie. |
| **Właściciel** | Wszystko powyższe, a do tego zaprasza, zmienia role, odbiera dostęp, udostępnia link do podglądu i usuwa projekt. |

## 25.3 Przyjmowanie zaproszenia

Kliknij link z wiadomości. Jeśli masz konto, zaproszenie zobaczysz też w aplikacji: na liście
projektów pojawi się przycisk [Zaproszenia] z liczbą. Przyjęty projekt jest na Twojej liście z
plakietką właściciela.

Zaproszenie przyjmuje osoba, która ma link — także z innego adresu niż ten, na który poszło.
W oknie Współpraca zawsze widać, kto naprawdę jest w projekcie.

Z włączonymi powiadomieniami (→ 2.6) dowiesz się o zaproszeniu od razu.

## 25.4 Praca na żywo

- Zmiany łączą się element po elemencie: gdy Ty poprawiasz tytuł, a ktoś przesuwa zdjęcie, zostają
  obie zmiany. O ten sam element aplikacja zapyta (→ 3.5).
- Kółka z inicjałami na pasku edytora i podglądu pokazują, kto jeszcze ma projekt otwarty; wskaż
  kółko, żeby zobaczyć, na której jest stronie.
- [Cofnij] cofa tylko Twoje zmiany.

## 25.5 Zarządzanie osobami

Właściciel w oknie Współpraca przy każdej osobie:

- zmienia **rolę** na liście rozwijanej,
- [Odbierz] — odbiera dostęp od razu; zmiany, które ta osoba już zapisała, zostają,
- przy zaproszeniu, które czeka: [Kopiuj link zaproszenia], [Wyślij e-mail z zaproszeniem ponownie]
  i [Cofnij zaproszenie].

## 25.6 Opuszczanie projektu i kopia

Współpracownik może [Opuść projekt] — w menu [⋯] na karcie albo w oknie Współpraca.
[Zrób własną kopię] tworzy Twój własny projekt z tą samą treścią.

## 25.7 Komentarze

Komentarz to uwaga przypięta do miejsca na stronie albo do elementu — jak karteczka na wydruku —
widoczna jako pomarańczowa pinezka z numerem. Komentować mogą wszyscy w projekcie, także z rolą
**może oglądać** (w podglądzie). Komentarzy nie ma w PDF.

![Narzędzie Komentarz i przycisk Komentarze z licznikiem](k-komentarz-narzedzie.png)

**Dodanie komentarza**

1. Kliknij [Komentarz] na pasku narzędzi (w podglądzie: [Komentarze] → [Nowy komentarz]).
2. Kliknij miejsce na stronie. Jeśli najpierw zaznaczysz element, komentarz od razu przypnie się do niego.
3. Wpisz treść i kliknij [Dodaj komentarz] (albo Ctrl+Enter). Esc rezygnuje.

Wpisz **@** i początek nazwy, żeby wspomnieć osobę z projektu — aplikacja podpowie nazwy.

**Lista komentarzy**

[Komentarze] na górnym pasku edytora i w podglądzie pokazuje liczbę nierozwiązanych wątków. Kliknięcie
pinezki otwiera jej wątek.

![Panel Komentarze z wątkiem i odpowiedzią](komentarze.png)

- Filtry: **Nierozwiązane**, **Wszystkie**, **Moje** (moje wątki, moje odpowiedzi i wzmianki o mnie).
- W wątku są odpowiedzi, [Odpowiedz] i [Pokaż na stronie].
- [Rozwiąż] zamyka załatwiony wątek i chowa pinezkę; [Otwórz ponownie] (filtr **Wszystkie**) go przywraca.
- Własny komentarz poprawisz ołówkiem [Popraw] (dopisek „(poprawiony)”); <kbd>Ctrl</kbd>+<kbd>Enter</kbd> zapisuje i wysyła.
- Usunąć komentarz może autor albo właściciel projektu — znika u wszystkich od razu, z odpowiedziami.
- Komentarz przy elemencie idzie za elementem; gdy element usuniesz, pinezka zostaje w tym miejscu.
  Wątek z usuniętej strony zostaje na liście z opisem „strona usunięta”.
- Komentarze dodaje się na stronach, nie na wzorcach.

Komentarze pojawiają się u wszystkich od razu; odpowiedź, którą piszesz, nie znika, gdy ktoś coś doda.
O nowych dowiesz się też z powiadomień (→ 2.6).


AI połączone kluczem też czyta komentarze, odpowiada na nie i może je rozwiązać po poprawce (→ 26.1).

# 26. Praca z AI

Asystent AI może budować i zmieniać Twoje projekty razem z Tobą.

## 26.1 Co potrafi AI

Asystent AI (Claude, ChatGPT i inne) łączy się z Makietką przez **łącznik**: adres z Twoim kluczem,
który dodajesz w aplikacji AI.

| AI może | AI nie może |
|---|---|
| tworzyć i usuwać projekty (z pełnym dostępem) | zobaczyć projektów spoza klucza |
| dodawać i zmieniać strony, elementy, style i wzorce | zmienić Twojego konta ani hasła |
| wypełniać tabele danych i ustawiać serie | wyeksportować PDF — plik robisz sam |
| wgrywać, wstawiać i wymieniać zdjęcia | |
| czytać komentarze, odpowiadać na nie i dodawać własne (→ 25.7) | |

Pisz do AI zwyczajnie, jak do grafika: co chcesz zrobić, w jakim formacie, ile stron, jaki nastrój.
Jeśli masz projekt otwarty, zmiany pojawiają się w edytorze po chwili. Zmiany AI łączą się z Twoimi
jak zmiany współpracownika (→ 25.4).

## 26.2 Klucz dla AI

Klucz należy do konta: [Ustawienia konta] → **Dostęp dla AI** → [Zarządzaj…].

![Dostęp dla AI w ustawieniach konta](k-konto-ai.png)

Część **Nowy klucz**:

| Ustawienie | Znaczenie |
|---|---|
| **Opis (dla Ciebie)** | Np. „Claude – kalendarz”. |
| **AI może** | **czytać i zmieniać** albo **tylko czytać**. |
| **Ważny przez** | 1 dzień, 7 dni, 30 dni, 90 dni, rok albo bez terminu. |
| **Wybrane projekty** | Projekty, do których klucz daje dostęp — Twoje i udostępnione Ci. |
| **Pełny dostęp – wszystkie projekty, także tworzenie i usuwanie** | Także projekty, które dojdą później. Usunięcie projektu AI zawsze potwierdza nazwą. |

[Utwórz klucz] pokazuje **Adres łącznika** — widać go tylko raz, skopiuj go od razu.

Lista **Klucze konta** pokazuje zakres, ważność i ostatnie użycie każdego klucza. [Zmień zakres]
dodaje albo usuwa projekty albo przełącza na pełny dostęp — adres łącznika się nie zmienia. [Odbierz] wyłącza klucz od razu.

![Okno Dostęp dla AI](dostep-ai.png)

## 26.3 Podłączenie w aplikacji AI

| Aplikacja | Jak podłączyć |
|---|---|
| **Claude** (claude.ai, aplikacja na komputer i telefon) | **Ustawienia → Łączniki → Dodaj własny łącznik**, nazwa „Makietka”, wklej adres. W rozmowie włącz łącznik w menu narzędzi. |
| **Claude Desktop** | W oknie Dostęp dla AI: [Pobierz rozszerzenie dla Claude Desktop], kliknij pobrany plik dwa razy i wklej klucz. Rozszerzenie czyta też pliki z Twojego dysku. |
| **ChatGPT** | **Ustawienia → Aplikacje → Dodaj własny serwer MCP**, wklej adres, uwierzytelnianie: brak. |
| **Claude Code** i inne programy z MCP | Polecenie z części **Dla zaawansowanych** w oknie Dostęp dla AI. |

Sprawdzenie: napisz do AI „Pokaż moje projekty w Makietce”.

Najprościej skopiować polecenie „Podłącz Makietkę” i wkleić je do rozmowy — AI rozpozna, w jakiej
aplikacji jesteś, i powie, co kliknąć:

{{polecenie: PROMPT_PODLACZENIE | Polecenie „Podłącz Makietkę” | Wklej do rozmowy z AI – poprowadzi Cię przez podłączenie w Twojej aplikacji.}}

> Wskazówka: Łączniki są zwykle w płatnych planach aplikacji AI. Na telefonie można zwykle tylko
> używać łączników dodanych wcześniej na komputerze.

## 26.4 Zdjęcia przez AI

- **ChatGPT** bierze zdjęcia wrzucone do rozmowy wprost.
- **Claude** wgrywa sam małe grafiki z rozmowy; **Claude Desktop z rozszerzeniem** — pliki i foldery
  z dysku.
- **Zawsze działa link do wgrania:** poproś AI o link — otworzy ten projekt z oknem Obrazy projektu,
  wrzucasz tam zdjęcia albo ZIP, a AI widzi je i działa dalej.
- AI pobierze też obraz z adresu w internecie albo z linku do Dysku Google czy Dropboxa udostępnionego
  „każdemu, kto ma link”, i narysuje własną grafikę SVG.

Zdjęcia, które stoi na stronie, AI nie usuwa — wymienia je na nowy plik w tym samym miejscu.

## 26.5 Bezpieczeństwo

AI dostaje co najwyżej Twoje uprawnienia: w projekcie, który możesz tylko oglądać, klucz tylko czyta,
a gdy właściciel odbierze Ci dostęp, klucz traci go od razu.

> Uwaga: Adres łącznika zawiera klucz — kto go ma, ma dostęp do wybranych projektów. Nie publikuj
> go, dawaj najkrótszą ważność, jaka wystarczy, i odbieraj klucz po skończonej pracy.

# 27. Przykład: komiks z AI

## 27.1 Od pomysłu do pliku

Zeszyt A5 z okładką: AI układa kadry i dymki, Ty dajesz rysunki i decydujesz.

1. Utwórz klucz z **pełnym dostępem** i **czytać i zmieniać** — AI utworzy nowy projekt (→ 26.2).
2. Skopiuj polecenie „Komiks do druku” (niżej), dopisz pomysł i wyślij. AI najpierw pokaże plan stron —
   popraw go, zanim zacznie.
3. Otwórz nowy projekt — zobaczysz, jak przybywa stron, kadrów i dymków.
4. Poproś AI o link do wgrania i wrzuć rysunki (→ 26.4). AI wstawi je w kadry.
5. Popraw, co chcesz: tekst w dymkach (styl „Dymek” zmienia wszystkie naraz), kadrowanie, kolejność stron.
6. Okładkę zrób jako osobną sekcję z grzbietem (→ 11.6).
7. [Sprawdź przed drukiem], potem PDF **Do drukarni** (→ 21, 22).

{{polecenie: PROMPT_KOMIKS | Polecenie „Komiks do druku” | Skopiuj, dopisz pomysł na końcu i wyślij AI z podłączoną Makietką.}}

> Wskazówka: Zeszyt zszywany ma liczbę stron podzielną przez 4 (8, 12, 16…). Rysunki do druku
> przygotuj w co najmniej 300 dpi w rozmiarze kadru.
