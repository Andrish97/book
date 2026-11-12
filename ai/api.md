# Seriodruk – dostęp dla AI

Asystent AI (Claude, ChatGPT i inne) może czytać i poprawiać **jeden konkretny projekt** Seriodruku – równolegle z Tobą. Jego zmiany pojawiają się w otwartym edytorze po chwili, tak jak zmiany z drugiego urządzenia: zmiany różnych elementów łączą się bez pytania, a o ten sam element aplikacja zapyta.

Dokumenty obok: [instrukcja obsługi](https://andrish97.github.io/book/ai/instrukcja.md), [format projektu](https://andrish97.github.io/book/ai/format-seriodruk.md) (model danych, który AI zmienia).

> **Dla asystenta AI:** nie łącz się z bazą z własnej piaskownicy – używaj narzędzi łącznika Seriodruk. Projekt czytasz i zmieniasz wyłącznie narzędziami łącznika (`przeglad_projektu`, `czytaj`, `zmien_elementy`…); one działają po stronie Seriodruku. Jeśli tych narzędzi nie masz, poproś użytkownika o dodanie łącznika (punkt 2) – nie proś o odblokowanie domen ani o zmianę ustawień sieci. Jedyny wyjątek to wysyłka plików na adres z narzędzia `adres_do_wysylki`: tylko dla niej możesz poprosić o dopisanie hosta `pganajmivwtstapnwsgv.supabase.co` do dozwolonych domen (patrz „Jak przekazać AI zdjęcia”).

## 1. Klucz i adres łącznika

1. Otwórz projekt, menu **⋯** → **Dostęp dla AI…**.
2. Wpisz, dla kogo jest klucz (np. „Claude – kalendarz”), wybierz **Czyta i zmienia** albo **Tylko czyta** i ważność: 1 dzień, 7 albo 30 dni.
3. **Utwórz klucz**. Okno pokazuje **adres łącznika** z kluczem w środku:
   `https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp/sdk_…` – skopiuj go od razu, widać go **tylko raz**.
4. Lista w tym samym oknie pokazuje aktywne klucze i to, kiedy ostatnio ich użyto. **Odbierz** wyłącza klucz (i adres) od razu.

Łącznik to serwer MCP działający po stronie Seriodruku. Claude i ChatGPT łączą się z nim **ze swoich serwerów**, więc niczego nie instalujesz i niczego nie odblokowujesz – ani na komputerze, ani w ustawieniach AI. (Jedyne opcjonalne ustawienie: w Claude jedna domena, żeby AI mogło wysyłać zdjęcia z rozmowy wprost – patrz „Jak przekazać AI zdjęcia”.)

### Bezpieczeństwo

- Adres z kluczem trafia do firmy, która prowadzi AI (Anthropic, OpenAI…). Dlatego klucz jest **wąski**: otwiera jeden projekt, nie konto. Nie da się nim utworzyć ani usunąć projektu, wgrać czcionek, zmienić udostępniania ani zajrzeć do innych projektów. Obrazy klucz do zmian wgrywa, ale tylko do tego projektu i z limitami (obraz do 15 MB, pobierany plik do 50 MB, do 150 MB obrazów czekających na przeniesienie na konto).
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
| `obrazy_projektu` | lista obrazów projektu (id, nazwa z rozszerzeniem, wymiary, gdzie użyty: strony, wzorce, dane albo „nieużywany”) i powtórzenia (kopie tego samego pliku, powtórzone nazwy) – to samo co okno „Obrazy projektu” |
| `wgraj_obraz` | wgrywa obraz albo archiwum ZIP z obrazami: z adresu https (także link udostępniania z Dysku Google albo Dropboxa), z kodu SVG, z małego pliku w base64, z załączników rozmowy w ChatGPT (`pliki_z_czatu`), a w serwerze u siebie – z pliku albo folderu na dysku. Ten sam plik drugi raz nie wchodzi, zajęta nazwa dostaje „(2)”; `zastap` – podmiana; `wstaw` – od razu na stronę |
| `wstaw_obraz` | pojedynczy obraz z projektu na stronę albo do wzorca (mm; bez rozmiaru 60% strony; ramka „zmieść” albo „wypełnij” z przycięciem) – jak „Obraz → Wybierz z obrazów projektu” |
| `zmien_nazwe_obrazu` | nowa nazwa (wolna, z rozszerzeniem); elementy dalej pokazują obraz, komórki tabel z tą nazwą dostają nową |
| `podmien_obraz` | nowy plik w miejsce obrazu (także użytego) – wszystkie elementy i dane pokazują od razu nowy, stary plik znika |
| `usun_obrazy` | usuwa tylko nieużywane obrazy (albo wszystkie nieużywane); o użytych mówi, gdzie są – te wymienia się przez `podmien_obraz` |
| `uporzadkuj_obrazy` | jak „Uporządkuj” w oknie obrazów: kopie tego samego pliku w jeden obraz, powtórzone nazwy z dopiskiem „(2)” |
| `link_do_wgrywania` | link do aplikacji, który otwiera projekt od razu z oknem „Obrazy projektu” (`…/#/p/<projekt>/obrazy`) – dla zdjęć, które masz u siebie |
| `adres_do_wysylki` | adres `POST …/obraz` z kluczem – AI wysyła pod niego pliki ze swojego środowiska (Claude po dopisaniu domeny) |
| `kontrola` | szybka kontrola: nieznane pola `{…}`, brakujące albo niejednoznaczne pliki obrazów z danych (rozszerzenie się liczy: `a.jpg` ≠ `a.png`; nazwa bez rozszerzenia działa tylko przy jednym pasującym pliku), elementy poza stroną |
| `opis_formatu` | ten sam opis modelu co [format-seriodruk.md](https://andrish97.github.io/book/ai/format-seriodruk.md) |

Każda zmiana działa tak: pobierz projekt → zmień → zapisz z numerem wersji. Jeśli w międzyczasie zmieniłeś coś w edytorze, baza odmawia, a łącznik pobiera projekt na nowo i nanosi zmianę jeszcze raz.

### Jak przekazać AI zdjęcia

Łącznik przyjmuje od AI tylko tekst. Zdjęcie, które masz u siebie, musi więc dojść do Seriodruku inną drogą – którą, zależy od aplikacji AI:

| Gdzie pracujesz | Zdjęcia z rozmowy | Zdjęcia z folderu na komputerze | Co trzeba ustawić |
|---|---|---|---|
| **ChatGPT** | wchodzą wprost – ChatGPT sam podaje je łącznikowi | wrzuć je do rozmowy albo przez link do wgrania | nic poza łącznikiem |
| **Claude** (claude.ai, aplikacja, Claude Desktop z łącznikiem jako adresem) | wchodzą wprost po dopisaniu domeny | z miejsca roboczego – też wprost po dopisaniu domeny | raz: domena `pganajmivwtstapnwsgv.supabase.co` w ustawieniach Claude |
| **Claude Desktop z rozszerzeniem Seriodruk** albo **Claude Code** | – | AI czyta pliki i foldery z dysku samo | instalacja rozszerzenia |
| **Każda aplikacja, bez ustawień** | przez **link do wgrania** | przez **link do wgrania** | nic |

Wielkość nie gra roli: jeden obraz do 25 MB, plik albo ZIP do 50 MB, ZIP do 100 obrazów. Łącznik sam dzieli duże pliki na kawałki.

#### 1. Link do wgrania – działa zawsze

AI wywołuje `link_do_wgrywania` i daje Ci link. Otwiera on ten projekt od razu z oknem **Obrazy projektu** – wrzucasz tam zdjęcia albo ZIP, a AI widzi je w `obrazy_projektu` i działa dalej. AI ma to proponować samo, zamiast mówić, że do Twoich plików nie sięga.

#### 2. ChatGPT – zdjęcia z rozmowy wprost

Narzędzie `wgraj_obraz` ma pole `pliki_z_czatu`, zgłoszone ChatGPT przez `_meta["openai/fileParams"]`. ChatGPT wpisuje tam zdjęcia i ZIP-y wrzucone do rozmowy (`{ download_url, file_id, mime_type, file_name }`), a łącznik pobiera je sam z tymczasowego adresu.

#### 3. Claude – wysyłka ze środowiska AI (jedno ustawienie)

Claude nie przekazuje łącznikom plików, ale zdjęcia wrzucone do rozmowy i pliki z miejsca roboczego leżą w jego środowisku, z którego może wysłać je wprost. Jego środowisko łączy się jednak tylko z dozwolonymi domenami, więc raz:

1. Claude → **Ustawienia → Możliwości → Wykonywanie kodu i tworzenie plików → Dodatkowe dozwolone domeny**.
2. Dopisz `pganajmivwtstapnwsgv.supabase.co`.

Potem wystarczy „wgraj te zdjęcia do projektu”: Claude bierze adres z narzędzia `adres_do_wysylki` i wysyła pliki, każdy dowolnej wielkości. Domena służy tylko do tej wysyłki – projekt AI dalej czyta i zmienia wyłącznie narzędziami łącznika.

#### 4. Claude Desktop z rozszerzeniem – pliki i foldery z dysku

W Claude Desktop z rozszerzeniem Seriodruk (albo w Claude Code z serwerem u siebie) AI czyta pliki z dysku: „wgraj obrazy z folderu ~/Pulpit/Kalendarz”.

#### 5. Link z Dysku Google albo Dropboxa

Udostępnij plik (albo ZIP) „każdemu, kto ma link” i podaj link AI. Dropbox oddaje też cały folder jako ZIP. Folderu z Dysku Google łącznik nie pobierze – spakuj go do ZIP-a.

#### 6. Rysunki i małe pliki

Rysunki SVG (ozdobniki, ikony, ramki) AI pisze samo (`svg`). Małe obrazy, do ok. 200 kB, może przekazać jako `dane_base64`. Większych nie przepisuje na base64: zdjęcie 5 MB to miliony tokenów – rozmowa skończyłaby się przed jednym zdjęciem.

#### Wymiana zdjęć, które są już na stronach

Obraz, który jest użyty na stronie, we wzorcu albo w danych, nie daje się usunąć – zostałyby puste ramki. Wymienia się go jednym krokiem: `podmien_obraz` (albo `zastap` w `wgraj_obraz` i w wysyłce wprost) wgrywa nowy plik w jego miejsce – wszystkie strony, wzorce i dane pokazują od razu nowy, a stary plik znika. Nie trzeba przepinać stron ani osobno usuwać.

#### Wysyłka wprost – dla programistów

Plik idzie jako treść żądania `POST` na adres łącznika z dopiskiem `/obraz` (pełny adres z kluczem podaje AI narzędzie `adres_do_wysylki`):

```
curl -X POST --data-binary @zdjecia.zip \
  "https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp/sdk_…/obraz?nazwa=zdjecia.zip"
```

```python
import requests
with open("styczen.jpg", "rb") as f:
    r = requests.post("https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp/sdk_…/obraz",
                      params={"nazwa": "styczen.jpg"}, data=f.read())
print(r.json())  # {"wgrane": [{"nazwa": "styczen.jpg", "id": "z_ai…", "szer": 4000, "wys": 3000, "byl": false}], "opis": "…"}
```

Parametry: `nazwa` (z rozszerzeniem), opcjonalnie `zastap` (id albo nazwa obrazu do podmiany). Odpowiedź JSON: `wgrane` albo `blad`. Zasady i limity jak w `wgraj_obraz`. Obraz ponad 512 KB łącznik wysyła do bazy w kawałkach (`ai_wgraj_poczatek` niżej).

## 4. Funkcje bazy (dla programistów)

Adres: `https://pganajmivwtstapnwsgv.supabase.co/rest/v1/rpc/<funkcja>`, `POST`, nagłówek `apikey` z publicznym kluczem bazy, treść JSON. Błędy klucza i spójności wracają jako `{"blad": "…", "szczegoly": [...]}` z kodem 200.

### `ai_projekt` – odczyt

Treść: `{"p_klucz": "sdk_…"}`. Wynik: `{"dostep": {"rola", "opis", "wazny_do"}, "wersja": 12, "projekt": {…}}`. Projekt ma strony w środku (`strony` – lista obiektów stron w kolejności), a `zasoby` tylko z opisem (bez treści plików): `{"z_ab12": {"nazwa": "las.jpg", "typ": "image/jpeg", "szer": 4000, "wys": 3000, "rozmiar": 2345678, "skrot": "…"}}` (wymiary w pikselach, rozmiar w bajtach, `skrot` – SHA-256 treści; starsze obrazy mogą nie mieć wymiarów ani skrótu).

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

### `ai_wgraj_obraz` – mały obraz do projektu (do 1 MB)

Jedno zapytanie z całym plikiem: tylko do **1 MB**. Większy plik nie zdążyłby się zapisać w limicie czasu jednego zapytania do bazy (sprawdzone na żywo: 2–10 MB przerywane po kilku sekundach) – dla niego są kawałki (niżej) albo wysyłka wprost `POST …/obraz` (łącznik dzieli plik sam). Treść: `{"p_klucz": "sdk_…", "p_nazwa": "las.jpg", "p_typ": "image/jpeg", "p_dane": "<base64>", "p_szer": 4000, "p_wys": 3000, "p_zastap": null}`. Baza sprawdza rodzaj pliku po pierwszych bajtach, liczy skrót SHA-256 i rozmiar. Ten sam plik → `{"id", "nazwa", "byl": true}` (nic nie dodaje). Zajęta nazwa → nazwa z „(2)”. `p_zastap` (id obrazu) → nowy obraz pod tą samą nazwą, elementy przepięte, stary w `zasoby_usuniete`. Plik czeka w tabeli `obrazy_ai`, a w projekcie ma ścieżkę `ai:<id>` – aplikacja właściciela przenosi go przy najbliższym zapisie do folderu plików konta. Wynik: `{"id", "nazwa", "typ", "szer", "wys", "rozmiar", "byl", "nazwa_zmieniona", "zastapiony"?, "wersja"}`.

### `ai_wgraj_poczatek`, `ai_wgraj_czesc`, `ai_wgraj_koniec` – większy obraz w kawałkach (do 25 MB)

1. `ai_wgraj_poczatek`: `{"p_klucz", "p_nazwa", "p_typ", "p_rozmiar": <bajty>, "p_skrot": "<SHA-256 treści, 64 znaki hex>", "p_szer", "p_wys", "p_zastap"}` → `{"wiersz": "<uuid>", "kawalek": 524288, "czesci": n}`. Ten sam plik (po skrócie) → od razu `{"id", "nazwa", "byl": true}` – kawałków nie trzeba wysyłać.
2. `ai_wgraj_czesc`: `{"p_klucz", "p_wiersz", "p_nr": 0…n-1, "p_dane": "<base64 kawałka, najwyżej 512 KB>"}` → `{"ok": true}`. Kawałki w dowolnej kolejności, można je wysyłać równolegle (łącznik: po 3) i powtarzać (powtórzony zastępuje poprzedni).
3. `ai_wgraj_koniec`: `{"p_klucz", "p_wiersz"}` → wynik jak z `ai_wgraj_obraz`. Bez kompletu: `{"blad", "brakujace": [nr…]}` – doślij brakujące i wywołaj koniec jeszcze raz.

Kawałki i koniec nie liczą się do limitu 120 zapytań na minutę (liczy się początek). Baza nie skleja pliku – kawałki czekają osobno, a aplikacja właściciela pobiera je, skleja, sprawdza rozmiar i skrót, i przenosi plik do folderu konta. Niedokończone wgranie znika po dobie.

### `ai_zmien_obrazy` – nowe nazwy i usuwanie

Treść: `{"p_klucz": "sdk_…", "p_kopie": {"z_nowe": {"z": "z_ab12", "nazwa": "styczen.jpg"}}, "p_usun": ["z_ab12"]}`. `p_kopie` dodaje wpis pod nowym id z tym samym plikiem i nową (wolną) nazwą; `p_usun` usuwa wpisy, których nie pokazuje żaden element (najpierw przepnij elementy zwykłym `ai_zapisz`). Tak łącznik zmienia nazwę (kopia → przepięcie elementów i komórek → usunięcie starego) i porządkuje obrazy. Usunięte id trafiają do `zasoby_usuniete`; plik obrazu z folderu konta usuwa potem aplikacja właściciela (funkcja bazy nie może usunąć pliku z magazynu plików).

### Funkcje właściciela (zalogowany użytkownik aplikacji)

`utworz_dostep_ai(p_projekt, p_opis, p_rola, p_dni)` → `{id, klucz, wazny_do}`, `dostepy_ai(p_projekt)` → lista kluczy bez ich treści, `odwolaj_dostep_ai(p_id)`. Obrazy od AI: `pobierz_obraz_ai(p_id)` → `{typ, nazwa, dane}` (base64) albo – dla pliku w kawałkach – `{typ, nazwa, rozmiar, skrot, czesci}` i wtedy `pobierz_czesc_obrazu_ai(p_id, p_nr)` → base64 kawałka; `usun_obraz_ai(p_id)`; pliki do usunięcia z folderu konta: `pliki_do_usuniecia(p_projekt)` → lista ścieżek, `pliki_usuniete(p_projekt, p_sciezki)`. Tabela `dostepy_projektu` ma pole `rodzaj` (`klucz` albo `uzytkownik`) – przygotowane pod późniejsze wspólne edytowanie projektu przez innych użytkowników.
