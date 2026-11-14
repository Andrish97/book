// Gotowe polecenia dla AI (decyzje #104, #107) – jedno źródło dla instrukcji (js/instrukcja-przewodnik.js) i okna
// „Dostęp dla AI” w ustawieniach konta (js/app/dostep-ai.js). W poleceniu „Podłącz Makietkę” okno podstawia prawdziwy
// adres łącznika z kluczem, gdy jest widoczny (zaraz po utworzeniu klucza).

export const ADRES_ZASTEPCZY = 'https://api.makietka.app/mcp/<klucz>';

export const PROMPT_PODLACZENIE = `Pomóż mi podłączyć Makietkę do Ciebie jako łącznik (serwer MCP), krok po kroku.

Co to jest Makietka: aplikacja w przeglądarce (https://makietka.app) do składania publikacji do druku – kalendarzy, planerów, notesów, zeszytów, komiksów. Ma strony, wzorce, style tekstu, tabele danych, serie powielanych stron, obrazy i eksport PDF.

Co wiem o łączniku Makietki:
- To zdalny serwer MCP (transport Streamable HTTP), bez logowania OAuth. Adres: https://api.makietka.app/mcp/<klucz>. Klucz można też podać nagłówkiem „Authorization: Bearer sdk_…” (wtedy adres bez klucza: https://api.makietka.app/mcp).
- Klucz tworzę sam w Makietce: Ustawienia konta → Dostęp dla AI → Zarządzaj… Wybieram: które projekty (albo pełny dostęp – wtedy AI może też tworzyć i usuwać projekty), czy AI tylko czyta, czy też zmienia, i ważność. Adres z kluczem widać tylko raz.
- Narzędzia łącznika: lista projektów, nowy projekt i usunięcie projektu (przy pełnym dostępie), przegląd projektu, czytanie i zmiana stron, elementów, wzorców, stylów, tabel danych i serii, wgrywanie obrazów (adres https, link z Dysku Google albo Dropboxa, kod SVG, małe pliki kawałkami), wstawianie obrazów na strony, link do wgrania zdjęć przez przeglądarkę, kontrola przed drukiem.
- Opis dla AI: https://makietka.app/ai/api.md, model danych projektu: https://makietka.app/ai/format-makietka.md.
- Dla Claude Desktop jest też rozszerzenie https://makietka.app/ai/mcp/makietka.mcpb – działa na komputerze i czyta pliki oraz foldery z dysku.
- Claude Code: claude mcp add --transport http makietka https://api.makietka.app/mcp/<klucz>

Twoje zadanie:
1. Ustal, w jakiej aplikacji teraz rozmawiamy (claude.ai w przeglądarce, aplikacja Claude na telefonie, Claude Desktop, Claude Code, ChatGPT, Cursor albo inna) i czy na moim planie da się w niej dodać własny łącznik MCP. Jeśli nie wiesz – zapytaj mnie.
2. Poprowadź mnie po kolei, co kliknąć, żeby dodać łącznik o nazwie „Makietka” z moim adresem. Nie proś mnie o wklejenie klucza do tej rozmowy – wkleję go sam w ustawieniach.
3. Jeśli ta aplikacja albo mój plan nie obsługuje łączników, powiedz to wprost i zaproponuj najprostszą drogę (inna aplikacja, Claude Desktop z rozszerzeniem, Claude Code).
4. Po podłączeniu sprawdź, czy widzisz narzędzie „projekty”, i pokaż mi listę moich projektów.
Pisz prosto, po polsku, jeden krok na raz i czekaj, aż powiem, że zrobione.`;

export const PROMPT_KOMIKS = `Korzystając z łącznika Makietka, przygotuj ze mną komiks do druku.

1. Najpierw zaproponuj plan: tytuł, liczbę stron (domyślnie 8 stron środka + okładka), na każdej stronie liczbę kadrów i co się w nich dzieje. Poczekaj, aż zatwierdzę.
2. Potem utwórz nowy projekt „Komiks – <tytuł>”: format A5 (148×210 mm), spad 3 mm, marginesy 8 mm. Środek w rozkładówkach, okładka jako osobna sekcja.
3. Na stronach ułóż kadry: prostokąty z czarnym obrysem 0,6 mm i odstępem 4 mm między kadrami, w obrębie marginesów. W kadrach dymki (elipsy albo prostokąty z zaokrągleniem, białe wypełnienie, czarny obrys) z tekstem 9 pt, wyśrodkowanym. Narrację umieść w prostokątnych ramkach u góry kadru.
4. Zrób styl tekstu „Dymek” i „Narracja”, żebym mógł je potem zmienić naraz.
5. Rysunków nie wymyślaj na siłę: jeśli nie możesz ich narysować, w każdym kadrze zostaw szary prostokąt z krótkim opisem sceny. Ja wgram rysunki – daj mi link do wgrania obrazów, a potem wstaw je w kadry z dopasowaniem „wypełnij”.
6. Dodaj numery stron we wzorcu (pole {nr}) na dole, po zewnętrznej stronie.
7. Na koniec uruchom kontrolę przed drukiem i powiedz, co poprawić.

Mój pomysł na komiks: <opisz tutaj bohaterów, historię i nastrój>`;

export const PROMPT_DANE = `Korzystając z łącznika Makietka, w projekcie „<nazwa projektu>”:
1. Przeczytaj opis formatu (narzędzie opis_formatu) i przegląd projektu.
2. Zrób tabelę danych „Dni 2027” z kolumnami: data, dzien, miesiac, dzien_tygodnia, swieto, kolor (kolor liczby: czarny w dni zwykłe, czerwony #c0392b w niedziele i święta).
3. Wypełnij ją dla całego roku 2027 (polskie święta państwowe i kościelne w kolumnie swieto).
4. Zrób stronę-wzór dnia: duża liczba {dzien} z kolorem z pola „kolor”, pod nią {dzien_tygodnia} i {miesiac}, a niżej {swieto}. Ustaw serię „Dni” z tą tabelą.
5. Pokaż mi, ile stron powstanie, i uruchom kontrolę przed drukiem.`;

// Polecenie „Podłącz Makietkę” z podstawionym adresem łącznika (gdy adres jest znany – zaraz po utworzeniu klucza).
// W oknie „Dostęp dla AI” jest tylko to polecenie; „Komiks” i „Kalendarz” są w instrukcji.
export const polecenieZAdresem = (adres = '') => (adres ? PROMPT_PODLACZENIE.split(ADRES_ZASTEPCZY).join(adres) : PROMPT_PODLACZENIE);
