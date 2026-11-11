# Seriodruk – dostęp dla AI

Asystent AI (Claude, ChatGPT i inne) może czytać i poprawiać **jeden konkretny projekt** Seriodruku – równolegle z Tobą. Jego zmiany pojawiają się w otwartym edytorze po chwili, tak jak zmiany z drugiego urządzenia: zmiany różnych elementów łączą się bez pytania, a o ten sam element aplikacja zapyta.

Dokumenty obok: [instrukcja obsługi](https://andrish97.github.io/book/ai/instrukcja.md), [format projektu](https://andrish97.github.io/book/ai/format-seriodruk.md) (model danych, który AI zmienia).

## 1. Klucz dostępu

1. Otwórz projekt, menu **⋯** → **Dostęp dla AI…**.
2. Wpisz, dla kogo jest klucz (np. „Claude – laptop”), wybierz **Czyta i zmienia** albo **Tylko czyta** i ważność: 1 dzień, 7 albo 30 dni.
3. **Utwórz klucz**. Klucz (`sdk_…`) widać **tylko raz** – skopiuj go od razu. Okno pokazuje gotowe ustawienia dla Claude.
4. Lista w tym samym oknie pokazuje aktywne klucze i to, kiedy ostatnio ich użyto. **Odbierz** wyłącza klucz od razu.

### Bezpieczeństwo

- Klucz trafia do firmy, która prowadzi AI (Anthropic, OpenAI…). Dlatego jest **wąski**: otwiera jeden projekt, nie konto. Nie da się nim utworzyć ani usunąć projektu, wgrać obrazów ani czcionek, zmienić udostępniania ani zajrzeć do innych projektów.
- Daj **najkrótszą ważność**, jaka wystarczy, i **odbierz** klucz, gdy praca się skończy. Do samego przeglądania wybierz **Tylko czyta**.
- W bazie leży tylko skrót klucza (z solą) – klucza nie da się z niej odczytać ani pokazać ponownie. Zgubiony klucz odbierz i utwórz nowy.
- Po 10 złych próbach klucz blokuje się na kwadrans; jeden klucz może wykonać do 120 zapytań na minutę; projekt może mieć do 20 aktywnych kluczy.
- Każdy zapis przechodzi kontrolę spójności (sekcje, wzorce, serie, tabele, obrazy). Niespójna zmiana jest odrzucana z opisem, co poprawić – nie psuje projektu.
- Zmiany AI to zwykłe zmiany projektu: **Cofnij** w edytorze ich nie zdejmuje (jak zmian z innego urządzenia), ale możesz je poprawić ręcznie; przed dużymi zmianami zrób **Eksport** (kopia zapasowa).

## 2. Claude Desktop

Potrzebny jest [Node.js](https://nodejs.org) w wersji 18 lub nowszej.

1. Pobierz serwer: [seriodruk-mcp.mjs](https://andrish97.github.io/book/ai/mcp/seriodruk-mcp.mjs) (jeden plik, bez instalowania czegokolwiek) i zapisz go np. w folderze Dokumenty.
2. W Claude Desktop: **Ustawienia → Programista → Edytuj konfigurację** (plik `claude_desktop_config.json`). Wklej (albo dopisz do istniejącego `mcpServers`) – gotowy tekst z Twoim kluczem jest w oknie „Dostęp dla AI”:

```json
{
  "mcpServers": {
    "seriodruk": {
      "command": "node",
      "args": ["C:\\Users\\Ty\\Documents\\seriodruk-mcp.mjs"],
      "env": { "SERIODRUK_KLUCZ": "sdk_…" }
    }
  }
}
```

   Na Macu ścieżka wygląda jak `/Users/ty/Documents/seriodruk-mcp.mjs`.
3. Uruchom Claude Desktop ponownie. W oknie rozmowy, w narzędziach, pojawi się **seriodruk**. Napisz np. „Przejrzyj mój projekt w Seriodruku i popraw literówki w tytułach”.

## 3. Claude Code

```sh
curl -o seriodruk-mcp.mjs https://andrish97.github.io/book/ai/mcp/seriodruk-mcp.mjs
claude mcp add seriodruk -e SERIODRUK_KLUCZ=sdk_… -- node "$PWD/seriodruk-mcp.mjs"
```

Sprawdzenie: `claude mcp list`. Usunięcie: `claude mcp remove seriodruk` (i odebranie klucza w aplikacji).

Każdy inny klient MCP uruchamia serwer tak samo: polecenie `node seriodruk-mcp.mjs`, zmienna `SERIODRUK_KLUCZ`. Serwer mówi protokołem MCP przez stdio (wersja 2026-07-28 oraz starsze z `initialize`).

## 4. ChatGPT (własny GPT z akcjami)

ChatGPT nie uruchamia programów na Twoim komputerze, więc łączy się z bazą bezpośrednio, przez opis [openapi.json](https://andrish97.github.io/book/ai/openapi.json):

1. ChatGPT → **Odkrywaj GPT → Utwórz** → **Konfiguruj** → **Utwórz nową akcję**.
2. **Importuj z adresu URL**: `https://andrish97.github.io/book/ai/openapi.json`.
3. **Uwierzytelnianie**: *Klucz API*, typ *Niestandardowy*, nagłówek `apikey`, wartość: `sb_publishable_gt_GEmBz6SfJZ0o9rAhLQA_HKH0V_cq` (publiczny klucz bazy Seriodruku – nie jest tajny, sam niczego nie otwiera).
4. W **Instrukcjach** GPT wpisz: „Pracujesz nad projektem Seriodruku. Klucz dostępu: `sdk_…` – podawaj go jako `p_klucz` w każdej akcji. Zanim coś zmienisz, pobierz projekt (ai_projekt); zapisując, podaj `p_znana_wersja` z odczytu i tylko zmieniane części. Przy odpowiedzi `konflikt` pobierz projekt na nowo i nanieś zmianę jeszcze raz. Model projektu: https://andrish97.github.io/book/ai/format-seriodruk.md”.
5. Zapisz GPT jako **Tylko ja** – kto ma dostęp do GPT, ten ma dostęp do klucza z instrukcji.

## 5. Narzędzia serwera MCP

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
| `kontrola` | szybka kontrola: nieznane pola `{…}`, brakujące pliki obrazów z danych, elementy poza stroną |
| `opis_formatu` | ten sam opis modelu co [format-seriodruk.md](https://andrish97.github.io/book/ai/format-seriodruk.md) |

Każda zmiana działa tak: pobierz projekt → zmień → zapisz z numerem wersji. Jeśli w międzyczasie zmieniłeś coś w edytorze, baza odmawia, a serwer pobiera projekt na nowo i nanosi zmianę jeszcze raz.

## 6. Funkcje bazy (dla programistów)

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

Wynik: `{"wersja": 13, "strony_zapisane": 1}`; przy nieaktualnej wersji `{"konflikt": true, "wersja": 13, "blad": "…"}` – pobierz projekt na nowo. Zmiana stylu w `style` nie przepisuje się sama do tekstów (robi to serwer MCP); przy zapisie bezpośrednio zmień też pola tekstów, które mają ten `styl`.

### Funkcje właściciela (zalogowany użytkownik aplikacji)

`utworz_dostep_ai(p_projekt, p_opis, p_rola, p_dni)` → `{id, klucz, wazny_do}`, `dostepy_ai(p_projekt)` → lista kluczy bez ich treści, `odwolaj_dostep_ai(p_id)`. Tabela `dostepy_projektu` ma pole `rodzaj` (`klucz` albo `uzytkownik`) – przygotowane pod późniejsze wspólne edytowanie projektu przez innych użytkowników.
