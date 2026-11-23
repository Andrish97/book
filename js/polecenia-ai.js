// Gotowe polecenia dla AI (decyzje #104, #107) – jedno źródło dla instrukcji (docs/instrukcja, wstawka {{polecenie: …}}) i okna
// „Sztuczna inteligencja” w ustawieniach konta (js/app/dostep-ai.js). W poleceniu „Podłącz Makietkę” okno podstawia prawdziwy
// adres łącznika z kluczem, gdy jest widoczny (zaraz po utworzeniu klucza).

export const ADRES_ZASTEPCZY = 'https://api.makietka.app/mcp/<klucz>';

export const PROMPT_PODLACZENIE = `Pomóż mi podłączyć Makietkę do Ciebie jako łącznik (serwer MCP), krok po kroku.

Co to jest Makietka: aplikacja w przeglądarce (https://makietka.app) do składania publikacji do druku – kalendarzy, planerów, notesów, zeszytów, komiksów. Ma strony, wzorce, style tekstu, tabele danych, serie powielanych stron, obrazy i eksport PDF.

Co wiem o łączniku Makietki:
- To zdalny serwer MCP (transport Streamable HTTP) z logowaniem OAuth: adres https://api.makietka.app/mcp (bez klucza) – aplikacja AI otworzy stronę Makietki, gdzie się loguję i wybieram projekty. Druga droga: adres z kluczem https://api.makietka.app/mcp/<klucz> (łącznik „bez logowania”).
- Klucz tworzę sam w Makietce: Ustawienia konta → Sztuczna inteligencja. Wybieram: które projekty (albo pełny dostęp – wtedy AI może też tworzyć i usuwać projekty), czy AI tylko czyta, czy też zmienia, i ważność. Adres z kluczem widać tylko raz.
- Narzędzia łącznika: lista projektów, nowy projekt i usunięcie projektu (przy pełnym dostępie), przegląd projektu, czytanie i zmiana stron, elementów, wzorców, stylów, tabel danych i serii, wgrywanie obrazów (adres https, link z Dysku Google albo Dropboxa, kod SVG, małe pliki kawałkami), wstawianie obrazów na strony, link do wgrania zdjęć przez przeglądarkę, kontrola przed drukiem.
- Opis dla AI: https://makietka.app/ai/api.md, model danych projektu: https://makietka.app/ai/format-makietka.md.
- Dla Claude Desktop jest też rozszerzenie https://makietka.app/ai/mcp/makietka.mcpb – działa na komputerze i czyta pliki oraz foldery z dysku.
- Claude Code: claude mcp add --transport http makietka https://api.makietka.app/mcp/<klucz>

Twoje zadanie:
1. Ustal, w jakiej aplikacji teraz rozmawiamy (claude.ai w przeglądarce, aplikacja Claude na telefonie, Claude Desktop, Claude Code, ChatGPT, Cursor albo inna) i czy na moim planie da się w niej dodać własny łącznik MCP. Jeśli nie wiesz – zapytaj mnie.
2. Poprowadź mnie po kolei, co kliknąć, żeby dodać łącznik o nazwie „Makietka” z moim adresem. Nie proś mnie o wklejenie klucza do tej rozmowy – wkleję go sam w ustawieniach.
3. Jeśli ta aplikacja albo mój plan nie obsługuje łączników, powiedz to wprost i zaproponuj najprostszą drogę (inna aplikacja, Claude Desktop z rozszerzeniem, Claude Code).
4. Po podłączeniu sprawdź, czy widzisz narzędzie „list_projects”, i pokaż mi listę moich projektów.
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
1. Przeczytaj opis formatu (narzędzie get_format_spec) i przegląd projektu (get_project_overview).
2. Zrób tabelę danych „Dni 2027” z kolumnami: data, dzien, miesiac, dzien_tygodnia, swieto, kolor (kolor liczby: czarny w dni zwykłe, czerwony #c0392b w niedziele i święta).
3. Wypełnij ją dla całego roku 2027 (polskie święta państwowe i kościelne w kolumnie swieto).
4. Zrób stronę-wzór dnia: duża liczba {dzien} z kolorem z pola „kolor”, pod nią {dzien_tygodnia} i {miesiac}, a niżej {swieto}. Ustaw serię „Dni” z tą tabelą.
5. Pokaż mi, ile stron powstanie, i uruchom kontrolę przed drukiem.`;

// Te same polecenia po angielsku i ukraińsku (#409) – instrukcja w danym języku i okno „Sztuczna inteligencja”
// w języku interfejsu. Nazwy narzędzi i kolumn danych zostają te same we wszystkich językach.
export const POLECENIA_JEZYKI = {
  en: {
    PROMPT_PODLACZENIE: `Help me connect Makietka to you as a connector (MCP server), step by step.

What Makietka is: a browser app (https://makietka.app) for laying out print publications – calendars, planners, notebooks, exercise books, comics. It has pages, masters, text styles, data tables, series of repeated pages, images and PDF export.

What I know about the Makietka connector:
- It is a remote MCP server (Streamable HTTP transport) with OAuth sign-in: address https://api.makietka.app/mcp (no key) – the AI app opens a Makietka page where I sign in and choose projects. The other way: an address with a key https://api.makietka.app/mcp/<klucz> (a connector "without sign-in").
- I create the key myself in Makietka: Account settings → Artificial intelligence. I choose: which projects (or full access – then the AI can also create and delete projects), whether the AI only reads or also changes things, and how long it is valid. The address with the key is shown only once.
- Connector tools: list of projects, new project and project deletion (with full access), project overview, reading and changing pages, elements, masters, styles, data tables and series, uploading images (https address, Google Drive or Dropbox link, SVG code, small files in chunks), placing images on pages, a link for uploading photos through the browser, pre-print check.
- Description for AI: https://makietka.app/ai/api.md, project data model: https://makietka.app/ai/format-makietka.md.
- For Claude Desktop there is also an extension https://makietka.app/ai/mcp/makietka.mcpb – it runs on the computer and reads files and folders from the disk.
- Claude Code: claude mcp add --transport http makietka https://api.makietka.app/mcp/<klucz>

Your task:
1. Work out which app we are talking in right now (claude.ai in the browser, the Claude phone app, Claude Desktop, Claude Code, ChatGPT, Cursor or another) and whether my plan lets me add a custom MCP connector there. If you don't know – ask me.
2. Guide me step by step through what to click to add a connector named "Makietka" with my address. Don't ask me to paste the key into this conversation – I will paste it myself in the settings.
3. If this app or my plan doesn't support connectors, say so plainly and suggest the simplest way (another app, Claude Desktop with the extension, Claude Code).
4. After connecting, check that you can see the "list_projects" tool and show me the list of my projects.
Write simply, in English, one step at a time, and wait until I say it's done.`,
    PROMPT_KOMIKS: `Using the Makietka connector, prepare a print-ready comic with me.

1. First propose a plan: title, number of pages (by default 8 inside pages + cover), and on each page the number of panels and what happens in them. Wait until I approve.
2. Then create a new project "Comic – <title>": A5 format (148×210 mm), 3 mm bleed, 8 mm margins. Inside pages as spreads, the cover as a separate section.
3. Lay out panels on the pages: rectangles with a 0.6 mm black stroke and a 4 mm gap between panels, within the margins. In the panels put speech bubbles (ellipses or rounded rectangles, white fill, black stroke) with 9 pt centred text. Put narration in rectangular boxes at the top of the panel.
4. Make the text styles "Bubble" and "Narration" so I can change them all at once later.
5. Don't force drawings: if you can't draw them, leave a grey rectangle with a short description of the scene in each panel. I will upload the drawings – give me a link for uploading images, then place them in the panels with "fill" fitting.
6. Add page numbers on the master (field {nr}) at the bottom, on the outer side.
7. Finally run the pre-print check and tell me what to fix.

My idea for the comic: <describe the characters, story and mood here>`,
    PROMPT_DANE: `Using the Makietka connector, in the project "<project name>":
1. Read the format description (get_format_spec tool) and the project overview (get_project_overview).
2. Make a data table "Days 2027" with the columns: data, dzien, miesiac, dzien_tygodnia, swieto, kolor (number colour: black on ordinary days, red #c0392b on Sundays and holidays).
3. Fill it in for the whole year 2027 (public holidays of my country in the swieto column, day and month names in English).
4. Make a day template page: a big number {dzien} in the colour from the "kolor" field, below it {dzien_tygodnia} and {miesiac}, and lower down {swieto}. Set up a series "Days" with this table.
5. Show me how many pages will be created and run the pre-print check.`,
  },
  uk: {
    PROMPT_PODLACZENIE: `Допоможи мені підключити Makietka до тебе як конектор (сервер MCP), крок за кроком.

Що таке Makietka: застосунок у браузері (https://makietka.app) для верстання видань до друку – календарів, планерів, блокнотів, зошитів, коміксів. Має сторінки, шаблони, стилі тексту, таблиці даних, серії повторюваних сторінок, зображення й експорт PDF.

Що я знаю про конектор Makietka:
- Це віддалений сервер MCP (транспорт Streamable HTTP) із входом OAuth: адреса https://api.makietka.app/mcp (без ключа) – застосунок ШІ відкриє сторінку Makietka, де я входжу й вибираю проєкти. Другий шлях: адреса з ключем https://api.makietka.app/mcp/<klucz> (конектор «без входу»).
- Ключ я створюю сам у Makietka: Налаштування акаунта → Штучний інтелект. Вибираю: які проєкти (або повний доступ – тоді ШІ може також створювати й видаляти проєкти), чи ШІ лише читає, чи також змінює, і строк дії. Адресу з ключем видно лише один раз.
- Інструменти конектора: список проєктів, новий проєкт і видалення проєкту (за повного доступу), огляд проєкту, читання й зміна сторінок, елементів, шаблонів, стилів, таблиць даних і серій, завантаження зображень (адреса https, посилання з Google Диска або Dropbox, код SVG, малі файли частинами), розміщення зображень на сторінках, посилання для завантаження фото через браузер, перевірка перед друком.
- Опис для ШІ: https://makietka.app/ai/api.md, модель даних проєкту: https://makietka.app/ai/format-makietka.md.
- Для Claude Desktop є також розширення https://makietka.app/ai/mcp/makietka.mcpb – працює на комп’ютері й читає файли та папки з диска.
- Claude Code: claude mcp add --transport http makietka https://api.makietka.app/mcp/<klucz>

Твоє завдання:
1. З’ясуй, у якому застосунку ми зараз розмовляємо (claude.ai у браузері, застосунок Claude на телефоні, Claude Desktop, Claude Code, ChatGPT, Cursor чи інший) і чи можна на моєму плані додати в ньому власний конектор MCP. Якщо не знаєш – запитай мене.
2. Проведи мене по черзі: що натиснути, щоб додати конектор із назвою «Makietka» з моєю адресою. Не проси мене вставляти ключ у цю розмову – я вставлю його сам у налаштуваннях.
3. Якщо цей застосунок або мій план не підтримує конекторів, скажи це прямо й запропонуй найпростіший шлях (інший застосунок, Claude Desktop із розширенням, Claude Code).
4. Після підключення перевір, чи бачиш інструмент «list_projects», і покажи мені список моїх проєктів.
Пиши просто, українською, по одному кроку, і чекай, поки я скажу, що зроблено.`,
    PROMPT_KOMIKS: `Використовуючи конектор Makietka, підготуй зі мною комікс до друку.

1. Спершу запропонуй план: назву, кількість сторінок (типово 8 сторінок блоку + обкладинка), на кожній сторінці кількість кадрів і що в них відбувається. Зачекай, поки я затверджу.
2. Потім створи новий проєкт «Комікс – <назва>»: формат A5 (148×210 мм), виліт 3 мм, поля 8 мм. Блок розворотами, обкладинка окремою секцією.
3. На сторінках розстав кадри: прямокутники з чорним контуром 0,6 мм і відступом 4 мм між кадрами, у межах полів. У кадрах – бульбашки (еліпси або прямокутники із заокругленням, біла заливка, чорний контур) з текстом 9 pt по центру. Оповідь розмісти в прямокутних рамках угорі кадру.
4. Зроби стилі тексту «Бульбашка» й «Оповідь», щоб я міг потім змінити їх разом.
5. Не вигадуй малюнків силоміць: якщо не можеш їх намалювати, залиш у кожному кадрі сірий прямокутник із коротким описом сцени. Я завантажу малюнки – дай мені посилання для завантаження зображень, а потім встав їх у кадри з припасуванням «заповнити».
6. Додай номери сторінок у шаблоні (поле {nr}) унизу, із зовнішнього боку.
7. Наприкінці запусти перевірку перед друком і скажи, що виправити.

Моя ідея коміксу: <опишіть тут героїв, історію й настрій>`,
    PROMPT_DANE: `Використовуючи конектор Makietka, у проєкті «<назва проєкту>»:
1. Прочитай опис формату (інструмент get_format_spec) і огляд проєкту (get_project_overview).
2. Зроби таблицю даних «Дні 2027» зі стовпцями: data, dzien, miesiac, dzien_tygodnia, swieto, kolor (колір числа: чорний у звичайні дні, червоний #c0392b у неділі й свята).
3. Заповни її на весь 2027 рік (державні свята моєї країни в стовпці swieto, назви днів і місяців українською).
4. Зроби сторінку-зразок дня: велике число {dzien} кольором з поля «kolor», під ним {dzien_tygodnia} і {miesiac}, а нижче {swieto}. Налаштуй серію «Дні» з цією таблицею.
5. Покажи мені, скільки сторінок вийде, і запусти перевірку перед друком.`,
  },
};

// Polecenie w danym języku (pl – stałe powyżej).
export const polecenie = (nazwa, j = 'pl') => POLECENIA_JEZYKI[j]?.[nazwa] ?? { PROMPT_PODLACZENIE, PROMPT_KOMIKS, PROMPT_DANE }[nazwa];

// Polecenie „Podłącz Makietkę” z podstawionym adresem łącznika (gdy adres jest znany – zaraz po utworzeniu klucza).
// W oknie „Sztuczna inteligencja” jest tylko to polecenie; „Komiks” i „Kalendarz” są w instrukcji.
export const polecenieZAdresem = (adres = '', j = 'pl') => (adres ? polecenie('PROMPT_PODLACZENIE', j).split(ADRES_ZASTEPCZY).join(adres) : polecenie('PROMPT_PODLACZENIE', j));
