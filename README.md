# Publisher-lite

Webowy edytor stron do projektowania publikacji z podkładaniem danych (kalendarze, planery).
Pełny plan: [docs/PLAN.md](docs/PLAN.md). To repozytorium zawiera **Etap 1 – szkielet (MVP)**.

## Co działa (Etap 1)

- **Projekt i strony:** dodawanie, duplikowanie, usuwanie, zmiana kolejności i nazw (dwuklik na miniaturze). Miniatury są generowane leniwie.
- **Edytor (Fabric.js 5.3.1):** tekst, prostokąt, elipsa, linia, obraz z dysku (także przeciągnij i upuść), grupowanie, warstwy, duplikowanie, cofanie i ponawianie.
- **Wszystko w milimetrach:** obiekty mają współrzędne w mm, (0, 0) to lewy górny róg strony po przycięciu. Zoom zmienia tylko widok. Rozmiar tekstu w punktach (pt).
- **Panel właściwości:** X, Y, szerokość, wysokość, obrót (mm/°), czcionka, rozmiar, interlinia, wyrównanie, pogrubienie, kursywa, kolory, obrys, krycie, przycięcie obrazu (%), odbicie obrazu, informacja o dpi.
- **Format wydruku:** A4, A5, A6, B5, kwadrat lub własny; spad, marginesy, znaki cięcia (zapisywane na etap eksportu PDF).
- **Prowadnice:** linia cięcia (czerwona), spad (przyciemniony pas), marginesy (niebieska przerywana); przyciąganie do krawędzi, marginesów i środka strony.
- **Ostrzeżenia o układzie (bez blokowania):** obiekt w marginesie, poza spadem albo poza stroną. Można je wyciszyć dla konkretnego obiektu.
- **Dotyk:** jeden palec zaznacza i przesuwa, dwa palce przesuwają widok i przybliżają (szczypanie). Uchwyty mają powiększony obszar dotyku. Na telefonie panele wysuwają się z dołu, a treść tekstu można edytować w zwykłym polu nad klawiaturą.
- **Zapis:** automatycznie w przeglądarce (IndexedDB), pobieranie i wczytywanie pliku JSON (z obrazami w środku), PNG bieżącej strony (150 dpi, ze spadem).
- **Chmura (opcjonalnie):** Supabase – logowanie linkiem e-mail, tabela `projekty` (jsonb) z RLS, obrazy w prywatnym buckecie `zasoby`. Zmiany są wysyłane automatycznie kilka sekund po edycji. Jeśli nie ma sieci, wysyłka następuje po jej powrocie.

Skróty: `T` `R` `E` `L` (wstaw), `Delete`, `Ctrl+Z` / `Ctrl+Shift+Z`, `Ctrl+D`, `Ctrl+G` / `Ctrl+Shift+G`, strzałki (1 mm, `Shift` 10 mm, `Alt` 0,1 mm), `PageUp`/`PageDown`, `Ctrl+S`, `Ctrl` + kółko (zoom).

## Uruchomienie

Aplikacja jest statyczna (bez kroku budowania). Moduły ES wymagają serwera HTTP:

```sh
python3 -m http.server 8000
# http://localhost:8000
```

Na tablecie w tej samej sieci: `http://<adres-komputera>:8000`. Uwaga: `crypto.randomUUID` i IndexedDB wymagają bezpiecznego kontekstu, czyli HTTPS albo `localhost`. Do testów na tablecie najprościej użyć GitHub Pages.

### Deploy (push na `main`)

Tak samo jak w `brick_ai`: push na `main` uruchamia GitHub Actions.

- [`deploy.yml`](.github/workflows/deploy.yml): migracje bazy (`supabase db push`) z [`supabase/migrations/`](supabase/migrations/) oraz Edge Functions z `supabase/functions/<nazwa>/index.ts` (na razie brak).
- [`pages.yml`](.github/workflows/pages.yml): publikuje aplikację na GitHub Pages. Przy tym generuje `js/konfiguracja.js` z adresem projektu i kluczem anon pobranym z API Supabase oraz dopisuje adres strony do *Redirect URLs* (logowanie linkiem z e-maila).

Potrzebne sekrety repozytorium (Settings → Secrets and variables → Actions): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_URL`. GitHub Pages: Settings → Pages → Source: **GitHub Actions**.

Lokalnie bez Supabase aplikacja działa na IndexedDB i plikach JSON. Żeby lokalnie łączyć się z bazą, wpisz adres i klucz anon w [`js/konfiguracja.js`](js/konfiguracja.js) (nie commituj klucza `service_role`).

Zasoby: jeden prywatny bucket `zasoby` z folderem na użytkownika (`<owner_id>/<projekt>/<zasób>`) zamiast osobnego bucketu na użytkownika – reguły RLS dają ten sam efekt.

## Struktura

| Plik | Rola |
|---|---|
| `index.html`, `css/aplikacja.css` | Interfejs (pasek, strony, narzędzia, właściwości, dialogi, układ mobilny) |
| `js/aplikacja.js` | Stan aplikacji, strony, zapis, dialogi, skróty |
| `js/edytor.js` | Silnik strony na Fabric.js: mm ↔ px, prowadnice, przyciąganie, ostrzeżenia, gesty, historia |
| `js/wlasciwosci.js` | Panel właściwości |
| `js/projekt.js` | Model projektu (sekcja 3 planu), formaty, migracja |
| `js/czcionki.js` | Lista dozwolonych czcionek (OFL) |
| `js/lokalny.js` | IndexedDB |
| `js/chmura.js`, `js/konfiguracja.js` | Supabase |
| `supabase/migrations/`, `supabase/config.toml` | Schemat bazy i reguły dostępu (migracje dla integracji Supabase z GitHubem) |

### Model danych

Zgodny z sekcją 3 planu. Dodatkowo:
- `zasoby`: `{ id: { nazwa, dataUrl, sciezka? } }`. Obrazy na stronach mają `src: "zasob:<id>"`, więc JSON stron jest lekki, a pliki mogą trafić do Storage.
- `strony[].tlo` (kolor tła) i `strony[].obiekty` (obiekty Fabric z własnymi polami `id`, `nazwa`, `zasob`, `bez_ostrzezen` oraz przygotowanymi na etap 2 `pole`, `autodopasowanie`, `min_rozmiar`).
- Pola `zrodla`, `tabele`, `zakresy`, `motywy` istnieją w modelu i są puste do kolejnych etapów.

## Następne kroki

- Test referencyjny na tablecie Lenovo (gesty, edycja tekstu z klawiaturą ekranową). Patrz sekcja 4.7 planu.
- Etap 2: import CSV/XLSX, tabele, zmienne `{kolumna}` w tekście, autodopasowanie.
