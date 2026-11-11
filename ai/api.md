# Seriodruk – dostęp dla AI

Asystent AI (Claude, ChatGPT i inne) może czytać i poprawiać **jeden konkretny projekt** Seriodruku – równolegle z Tobą. Jego zmiany pojawiają się w otwartym edytorze po chwili, tak jak zmiany z drugiego urządzenia: zmiany różnych elementów łączą się bez pytania, a o ten sam element aplikacja zapyta.

Dokumenty obok: [instrukcja obsługi](https://andrish97.github.io/book/ai/instrukcja.md), [format projektu](https://andrish97.github.io/book/ai/format-seriodruk.md) (model danych, który AI zmienia).

> **Dla asystenta AI:** nie łącz się z bazą z własnej piaskownicy – używaj narzędzi łącznika Seriodruk. Projekt czytasz i zmieniasz wyłącznie narzędziami łącznika (`przeglad_projektu`, `czytaj`, `zmien_elementy`…); one działają po stronie Seriodruku. Jeśli tych narzędzi nie masz, poproś użytkownika o dodanie łącznika (punkt 2) – nie proś o odblokowanie domen ani o zmianę ustawień sieci.

## 1. Klucz i adres łącznika

1. Otwórz projekt, menu **⋯** → **Dostęp dla AI…**.
2. Wpisz, dla kogo jest klucz (np. „Claude – kalendarz”), wybierz **Czyta i zmienia** albo **Tylko czyta** i ważność: 1 dzień, 7 albo 30 dni.
3. **Utwórz klucz**. Okno pokazuje **adres łącznika** z kluczem w środku:
   `https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp/sdk_…` – skopiuj go od razu, widać go **tylko raz**.
4. Lista w tym samym oknie pokazuje aktywne klucze i to, kiedy ostatnio ich użyto. **Odbierz** wyłącza klucz (i adres) od razu.

Łącznik to serwer MCP działający po stronie Seriodruku. Claude i ChatGPT łączą się z nim **ze swoich serwerów**, więc niczego nie instalujesz i niczego nie odblokowujesz – ani na komputerze, ani w ustawieniach AI.

### Bezpieczeństwo

- Adres z kluczem trafia do firmy, która prowadzi AI (Anthropic, OpenAI…). Dlatego klucz jest **wąski**: otwiera jeden projekt, nie konto. Nie da się nim utworzyć ani usunąć projektu, wgrać obrazów ani czcionek, zmienić udostępniania ani zajrzeć do innych projektów.
- Daj **najkrótszą ważność**, jaka wystarczy, i **odbierz** klucz, gdy praca się skończy. Do samego przeglądania wybierz **Tylko czyta**. Nie wklejaj adresu łącznika w miejsca, które widzą inni.
- W bazie leży tylko skrót klucza (z solą) – klucza nie da się z niej odczytać ani pokazać ponownie. Zgubiony klucz odbierz i utwórz nowy.
- Po 10 złych próbach klucz blokuje się na kwadrans; jeden klucz może wykonać do 120 zapytań na minutę; projekt może mieć do 20 aktywnych kluczy.
- Każdy zapis przechodzi kontrolę spójności (sekcje, wzorce, serie, tabele, obrazy). Niespójna zmiana jest odrzucana z opisem, co poprawić – nie psuje projektu.
- Zmiany AI to zwykłe zmiany projektu: **Cofnij** w edytorze ich nie zdejmuje (jak zmian z innego urządzenia), ale możesz je poprawić ręcznie; przed dużymi zmianami zrób **Eksport** (kopia zapasowa).

## 2. Dodanie łącznika

### Claude (claude.ai, aplikacja na komputer i telefon)

1. **Dostosuj → Łączniki** (Customize → Connectors) → **+** → **Dodaj własny łącznik** (Add custom connector).
2. Nazwa: `Seriodruk`, adres: wklej adres łącznika. Logowanie: **bez logowania** (No sign-in). **Dodaj**.
3. W rozmowie włącz łącznik Seriodruk (menu **+** → Łączniki) i napisz np. „Przejrzyj mój projekt w Seriodruku i popraw literówki w tytułach”.

Własne łączniki są dostępne w planie darmowym (jeden) i płatnych. W planach Team i Enterprise łącznik może najpierw dodać właściciel organizacji. Usunięcie: Dostosuj → Łączniki → Seriodruk → Usuń (i odebranie klucza w aplikacji).

### ChatGPT

1. Wejdź na **chatgpt.com/plugins** → **+** → **Add custom MCP server**.
2. Wklej adres łącznika, uwierzytelnianie: **No Authentication**, potwierdź („I understand and want to continue”) i utwórz.
3. W rozmowie wybierz Seriodruk i napisz, co zmienić.

Jeśli tej opcji nie widać, włącz tryb dewelopera: **Ustawienia → Aplikacje → Zaawansowane** (Settings → Apps → Advanced settings → Developer mode). Dostępność zależy od planu ChatGPT.

### Claude Code

```sh
claude mcp add --transport http seriodruk https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp/sdk_…
```

Sprawdzenie: `claude mcp list`. Usunięcie: `claude mcp remove seriodruk`.

### Inne programy z MCP

Każdy klient MCP obsługujący transport **Streamable HTTP** podłącza się tym samym adresem. Klucz można też podać nagłówkiem `Authorization: Bearer sdk_…` (wtedy adres bez klucza: `…/functions/v1/mcp`). Łącznik jest bezstanowy, odpowiada JSON-em; obsługuje protokół 2026-07-28 oraz starsze wersje z `initialize` (2025-03-26 … 2025-11-25).

### Dla zaawansowanych: serwer u siebie (stdio)

Gdy wolisz uruchamiać serwer na własnym komputerze (np. Claude Desktop przez plik konfiguracji): pobierz [seriodruk-mcp.mjs](https://andrish97.github.io/book/ai/mcp/seriodruk-mcp.mjs) (jeden plik, Node.js 18+, nic do instalowania) i dopisz w **Ustawienia → Programista → Edytuj konfigurację**:

```json
{
  "mcpServers": {
    "seriodruk": {
      "command": "node",
      "args": ["/Users/ty/Documents/seriodruk-mcp.mjs"],
      "env": { "SERIODRUK_KLUCZ": "sdk_…" }
    }
  }
}
```

Ma te same narzędzia co łącznik (wspólny kod). Działa tylko tam, gdzie program ma dostęp do internetu.

### Własny GPT z akcjami (starszy sposób)

Bez łącznika ChatGPT może wołać funkcje bazy przez opis [openapi.json](https://andrish97.github.io/book/ai/openapi.json): **Utwórz GPT → Konfiguruj → Utwórz nową akcję → Importuj z adresu URL**, uwierzytelnianie *Klucz API* / *Niestandardowy* / nagłówek `apikey` z publicznym kluczem bazy `sb_publishable_gt_GEmBz6SfJZ0o9rAhLQA_HKH0V_cq`, a w instrukcjach GPT klucz `sdk_…` jako `p_klucz` (punkt 4). Zapisz GPT jako **Tylko ja**.

## 3. Narzędzia łącznika

| Narzędzie | Co robi |
|---|---|
| `przeglad_projektu` | krótki opis: sekcje, strony z elementami (id, rodzaj, początek tekstu), wzorce, style, tabele, serie, obrazy |
| `czytaj` | pełny JSON strony, wzorca, sekcji, stylu, tabeli, serii, widoku albo całego projektu |
| `zmien_elementy` | zmienia pola elementów (po id) na stronie albo we wzorcu; `null` usuwa pole |
| `dodaj_elementy`, `usun_elementy`, `kolejnosc_elementow` | elementy dowolnego rodzaju: tekst (z formatowaniem fragmentów), kształty, linie, ścieżki, obrazy z wgranych plików i z danych, tabela, `z_danych`, łańcuchy ramek |
| `dodaj_strone`, `zmien_strone`, `usun_strony`, `kolejnosc_stron` | strony: sekcja, wzorce, seria, tło, kolejność |
| `zmien_tabele` | tabela danych: komórki, kolumny, wiersze (także `[pomiń]`), listy dozwolonych wartości; nowa tabela |
| `zmien_czesc` | ogólna zmiana jednej sekcji, wzorca, stylu, tabeli albo serii (nowa, zmiana, usunięcie). Zmiana stylu przepisuje go do tekstów, które go używają – jak w aplikacji; usunięty styl odpina się od tekstów |
| `zmien_projekt` | ogólny zapis kilku części naraz (dla zmian, których inne narzędzia nie obejmują) |
| `nazwa_projektu` | nowa nazwa |
| `kontrola` | szybka kontrola: nieznane pola `{…}`, brakujące albo niejednoznaczne pliki obrazów z danych (rozszerzenie się liczy: `a.jpg` ≠ `a.png`; nazwa bez rozszerzenia działa tylko przy jednym pasującym pliku), elementy poza stroną |
| `opis_formatu` | ten sam opis modelu co [format-seriodruk.md](https://andrish97.github.io/book/ai/format-seriodruk.md) |

Każda zmiana działa tak: pobierz projekt → zmień → zapisz z numerem wersji. Jeśli w międzyczasie zmieniłeś coś w edytorze, baza odmawia, a łącznik pobiera projekt na nowo i nanosi zmianę jeszcze raz.

## 4. Funkcje bazy (dla programistów)

Adres: `https://pganajmivwtstapnwsgv.supabase.co/rest/v1/rpc/<funkcja>`, `POST`, nagłówek `apikey` z publicznym kluczem bazy, treść JSON. Błędy klucza i spójności wracają jako `{"blad": "…", "szczegoly": [...]}` z kodem 200.

### `ai_projekt` – odczyt

Treść: `{"p_klucz": "sdk_…"}`. Wynik: `{"dostep": {"rola", "opis", "wazny_do"}, "wersja": 12, "projekt": {…}}`. Projekt ma strony w środku (`strony` – lista obiektów stron w kolejności), a `zasoby` tylko z nazwą i typem (bez treści plików): `{"z_ab12": {"nazwa": "las.jpg", "typ": "image/jpeg"}}`.

### `ai_zapisz` – zapis

Treść: `{"p_klucz": "sdk_…", "p_znana_wersja": 12, "p_zmiany": {…}}`. Części w `p_zmiany` (każda opcjonalna):

| Część | Znaczenie |
|---|---|
| `nazwa` | nazwa projektu |
| `sekcje`, `wzorce`, `style`, `tabele`, `serie` | **pełne** listy – zastępują dotychczasowe |
| `widok` | ustawienia widoku |
| `strony` | pełne obiekty stron **nowych albo zmienionych** (pozostałe zostają); nowe trafiają na koniec |
| `usun_strony` | lista id stron do usunięcia |
| `kolejnosc_stron` | nowa kolejność: każda strona dokładnie raz |

Wynik: `{"wersja": 13, "strony_zapisane": 1}`; przy nieaktualnej wersji `{"konflikt": true, "wersja": 13, "blad": "…"}` – pobierz projekt na nowo. Zmiana stylu w `style` nie przepisuje się sama do tekstów (robi to łącznik); przy zapisie bezpośrednio zmień też pola tekstów, które mają ten `styl`.

### Funkcje właściciela (zalogowany użytkownik aplikacji)

`utworz_dostep_ai(p_projekt, p_opis, p_rola, p_dni)` → `{id, klucz, wazny_do}`, `dostepy_ai(p_projekt)` → lista kluczy bez ich treści, `odwolaj_dostep_ai(p_id)`. Tabela `dostepy_projektu` ma pole `rodzaj` (`klucz` albo `uzytkownik`) – przygotowane pod późniejsze wspólne edytowanie projektu przez innych użytkowników.
