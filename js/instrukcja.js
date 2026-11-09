// Instrukcja obsługi: rozdziały ze zrzutami ekranu (img/instrukcja/*.png).
// Zrzuty generuje skrypt scripts/zrzuty-instrukcji.mjs – po zmianach w wyglądzie
// wystarczy go uruchomić ponownie.

import { wstawIkony } from './ikony.js';

const KLUCZ_PRZECZYTANA = 'seriodruk:instrukcja-przeczytana';

export const ROZDZIALY = [
  {
    tytul: 'Na początek',
    wstep: 'Seriodruk służy do składania publikacji z powtarzalnymi stronami: kalendarzy, planerów, notesów. Projektujesz wzory stron, a w kolejnych wersjach aplikacja wstawi do nich dane z arkusza i złoży gotowy PDF do druku.',
    obraz: 'projekty.png',
    podpis: 'Lista projektów po zalogowaniu.',
    punkty: [
      'Projekt to jedna publikacja – np. „Kalendarz 2027”. Karta pokazuje okładkę (pierwszą stronę) i datę ostatniej zmiany.',
      'Każda zmiana zapisuje się sama – nie ma przycisku „Zapisz”.',
      '<b>Importuj</b> wczytuje projekt z pliku <code>.seriodruk</code>, a menu <b>⋯</b> na karcie: zmiana nazwy, eksport do pliku, usunięcie.',
      'Instrukcję otworzysz w każdej chwili przyciskiem <b>Instrukcja</b> albo <b>?</b> w edytorze.',
    ],
    dlaczego: [
      '<b>Projekty zamiast plików na dysku</b> – projekt żyje na koncie, więc otwierasz go na tablecie, telefonie i komputerze bez przenoszenia plików.',
      '<b>Zapis automatyczny</b> – na tablecie łatwo zamknąć kartę lub stracić zasięg; nic nie powinno zginąć przez zapomniany „Zapisz”.',
      '<b>Operacje na całym projekcie tylko na liście projektów</b> – eksport, import i usuwanie dotyczą całości, więc są tam, gdzie widać wszystkie projekty, a nie w edytorze, gdzie łatwo je pomylić z akcjami na stronie.',
    ],
  },
  {
    tytul: 'Konto i logowanie',
    wstep: 'Do aplikacji wchodzi się po zalogowaniu adresem e-mail i hasłem. Nie ma rejestracji ani resetu hasła w aplikacji – konto administratora jest zarządzane w panelu Supabase.',
    obraz: 'logowanie.png',
    podpis: 'Ekran logowania.',
    punkty: [
      'Hasło zmienia się lub resetuje w panelu Supabase → Authentication → Users.',
      'Wylogowanie: kliknij kółko z inicjałem w prawym górnym rogu listy projektów.',
    ],
    dlaczego: [
      '<b>Logowanie przed wszystkim</b> – projekty są prywatne; bez konta nie da się ich bezpiecznie trzymać w bazie i synchronizować między urządzeniami.',
      '<b>Brak rejestracji</b> – aplikacja ma jednego użytkownika. Każdy formularz zakładania konta to furtka dla obcych, więc jej nie ma.',
      '<b>Brak resetu hasła w aplikacji</b> – reset przez e-mail wymaga konfiguracji poczty i przekierowań, a przy jednym koncie szybciej zrobić to w panelu Supabase.',
    ],
  },
  {
    tytul: 'Nowy projekt',
    wstep: 'Projekt to cała publikacja: sekcje, wzorce i wszystkie strony.',
    obraz: 'nowy-projekt.png',
    podpis: 'Okno „Nowy projekt”.',
    punkty: [
      'Wpisz nazwę i wybierz format – kafelki pokazują proporcje strony. <b>Własny</b> pozwala wpisać dowolny wymiar w milimetrach.',
      '<b>Spad</b> to pas za krawędzią strony, który drukarnia odcina. Zwykle 3 mm.',
      '<b>Marginesy</b> wyznaczają bezpieczny obszar na teksty.',
      'Projekt zaczyna od jednej sekcji „Główna” w tym formacie. Kolejne sekcje (np. okładkę o innym rozmiarze) dodasz w edytorze.',
    ],
    dlaczego: [
      '<b>Format na starcie</b> – wszystkie wymiary w projekcie są w milimetrach względem strony, więc rozmiar trzeba znać, zanim postawi się pierwszy element.',
      '<b>Kafelki z proporcjami</b> – na tablecie łatwiej wskazać kształt strony palcem niż wpisywać liczby; liczby zostają dla formatu własnego.',
      '<b>Spad domyślnie 3 mm</b> – tyle wymaga większość drukarni. Bez spadu tło „do krawędzi” po przycięciu zostawia białą kreskę.',
    ],
  },
  {
    tytul: 'Edytor – przegląd',
    wstep: 'Po otwarciu projektu widzisz edytor. Ma trzy części:',
    obraz: 'edytor.png',
    podpis: 'Edytor na tablecie w poziomie.',
    punkty: [
      '<b>1. Strony i wzorce</b> (z lewej) – lista stron pogrupowana w sekcje oraz zakładka wzorców.',
      '<b>2. Strona</b> (pośrodku) – tu układasz elementy. Na górze pasek <b>Wstaw</b>, w prawym dolnym rogu powiększenie i linie pomocnicze.',
      '<b>3. Właściwości</b> (z prawej) – ustawienia zaznaczonego elementu albo strony, gdy nic nie jest zaznaczone.',
      'Górny pasek: powrót do projektów, nazwa projektu, stan zapisu, cofanie, sekcja i jej format, instrukcja, menu <b>⋯</b> (PNG bieżącej strony).',
    ],
    dlaczego: [
      '<b>Układ jak w programach do składu</b> (np. InDesign): strony z lewej, płótno w środku, właściwości z prawej – ręka sama wie, gdzie szukać.',
      '<b>Pływający pasek „Wstaw” nad stroną</b> – na tablecie przyciski są blisko miejsca pracy, a strona dostaje całą wysokość ekranu.',
      '<b>Panel właściwości zamiast okienek</b> – zmiana rozmiaru czcionki czy położenia nie zasłania strony i widać efekt od razu.',
    ],
  },
  {
    tytul: 'Wstawianie elementów',
    wstep: 'Pasek nad stroną wstawia nowe elementy na środek strony.',
    obraz: 'wstawianie.png',
    podpis: 'Zaznaczony tekst z uchwytami.',
    punkty: [
      '<b>Tekst</b> – kliknij dwa razy, aby pisać bezpośrednio na stronie, albo wpisz treść w polu <b>Treść</b> po prawej.',
      '<b>Prostokąt, Elipsa, Linia</b> – kształty do ramek, tła i podziałów.',
      '<b>Obraz</b> – zdjęcie lub grafika z dysku. Możesz też przeciągnąć plik na stronę.',
      'Przeciągnij element, aby go przesunąć. Kółka w rogach zmieniają rozmiar, kółko nad elementem go obraca.',
      'Przy krawędziach, marginesach i środku strony element „przykleja się” – pokazuje to różowa linia.',
    ],
    dlaczego: [
      '<b>Nowy element na środku strony</b> – zawsze widać, gdzie się pojawił, także po powiększeniu.',
      '<b>Duże uchwyty</b> – na ekranie dotykowym palec jest mniej dokładny niż mysz, więc obszar chwytania jest powiększony.',
      '<b>Przyciąganie do marginesów i środka</b> – równe ustawienie elementów bez wpisywania liczb, bo w druku nawet milimetr różnicy między stronami jest widoczny.',
      '<b>Pole „Treść” obok edycji na stronie</b> – na telefonie klawiatura zasłania pół ekranu; w polu tekstowym pisze się wygodniej.',
    ],
  },
  {
    tytul: 'Właściwości elementu',
    wstep: 'Panel z prawej pokazuje ustawienia zaznaczonego elementu. Wszystkie wymiary są w milimetrach, rozmiar czcionki w punktach.',
    obraz: 'wlasciwosci.png',
    podpis: 'Właściwości tekstu.',
    punkty: [
      '<b>Tekst</b>: treść, czcionka, rozmiar, interlinia, kolor, pogrubienie, kursywa, wyrównanie.',
      '<b>Położenie i rozmiar</b>: dokładne X, Y, szerokość, wysokość i obrót.',
      '<b>Kolejność</b>: przenosi element nad lub pod inne.',
      '<b>Obraz</b>: przycięcie z każdej strony, obrys, odbicie i informacja o rozdzielczości.',
      'Ikony nad panelem: <b>duplikuj</b> i <b>usuń</b> element.',
    ],
    rada: 'Kilka elementów zaznaczysz, przeciągając prostokąt po pustym miejscu strony albo klikając z wciśniętym Shift. Potem możesz je zgrupować.',
    dlaczego: [
      '<b>Milimetry i punkty</b> – w tych jednostkach mówi drukarnia i w nich podaje się wymiary papieru; piksele zależą od ekranu.',
      '<b>Pola liczbowe obok przeciągania</b> – palcem trudno ustawić element z dokładnością do milimetra; liczbę wpisuje się raz i jest dokładnie.',
      '<b>Tylko czcionki z licencją OFL</b> – publikacja może być sprzedawana, a te czcionki wolno używać komercyjnie i osadzać w PDF.',
      '<b>Informacja o dpi obrazu</b> – zdjęcie, które wygląda dobrze na ekranie, w druku może być rozmyte; poniżej 300 dpi aplikacja ostrzega.',
    ],
  },
  {
    tytul: 'Strony',
    wstep: 'Każdą stronę projektujesz osobno. Kolejność miniatur to kolejność stron w publikacji.',
    obraz: 'strony.png',
    podpis: 'Menu strony.',
    punkty: [
      '<b>+ Strona</b> na dole panelu wstawia pustą stronę za bieżącą, w tej samej sekcji.',
      'Przycisk <b>⋯</b> na miniaturze: zmiana nazwy, duplikowanie, przesuwanie w górę i w dół (w obrębie sekcji), usuwanie.',
      'Nazwy stron (np. „Styczeń”, „Notatki”) pomogą później przy podpinaniu danych.',
    ],
    dlaczego: [
      '<b>Miniatury zamiast numerów</b> – stronę rozpoznaje się po wyglądzie szybciej niż po numerze.',
      '<b>Duplikowanie</b> – w kalendarzu większość stron jest podobna; łatwiej poprawić kopię niż rysować od zera.',
      '<b>Przesuwanie tylko w obrębie sekcji</b> – strona okładki nie powinna przypadkiem trafić między strony środka o innym formacie.',
    ],
  },
  {
    tytul: 'Sekcje',
    wstep: 'Projekt dzieli się na sekcje – części o różnych ustawieniach, np. „Okładka” i „Środek”. Każda sekcja ma własny format, spad i marginesy.',
    obraz: 'sekcje.png',
    podpis: 'Ustawienia sekcji „Okładka” – szeroki format z grzbietem.',
    punkty: [
      'Na liście stron sekcje są szarymi nagłówkami, a pod nimi ich strony. Obok nazwy widać format, liczbę stron i wzorzec.',
      '<b>+ Sekcja</b> na dole listy tworzy nową sekcję z pierwszą stroną.',
      'Przycisk <b>⋯</b> przy nagłówku: ustawienia sekcji, dodanie strony, zmiana kolejności, usunięcie.',
      'Okładkę z grzbietem ustaw jako jedną szeroką stronę: tył + grzbiet + przód (np. 148 + 6 + 148 mm).',
      'Stronę przeniesiesz do innej sekcji w jej właściwościach (pole <b>Sekcja</b>).',
    ],
    dlaczego: [
      '<b>Różne części publikacji mają różne wymagania</b> – okładka jest szersza (grzbiet), ma inny spad, wkładka może mieć inny papier i marginesy.',
      '<b>Ustawienia na sekcję, nie na stronę</b> – zmiana marginesu w środku kalendarza ma objąć wszystkie 365 stron naraz.',
      '<b>Sekcja to później osobny plik PDF</b> – drukarnie zwykle przyjmują okładkę i środek jako oddzielne pliki.',
    ],
  },
  {
    tytul: 'Wzorce',
    wstep: 'Wzorzec to strona ze wspólnymi elementami – tłem, ramką, logo, stopką, numerem strony. Rysujesz go raz, a pojawia się pod treścią wszystkich stron, które go używają.',
    obraz: 'wzorce.png',
    podpis: 'Edycja wzorca – fioletowe tło przypomina, że to nie zwykła strona.',
    punkty: [
      'Wzorce są w zakładce <b>Wzorce</b> nad listą stron. <b>Nowy wzorzec</b> tworzy pusty wzorzec i otwiera go do edycji.',
      'Wzorzec podpinasz do sekcji (będzie na wszystkich jej stronach) – w panelu wzorca albo w ustawieniach sekcji. Jeden wzorzec może służyć kilku sekcjom.',
      'Pojedyncza strona może mieć inny wzorzec albo żaden – pole <b>Wzorzec</b> we właściwościach strony.',
      'Numer strony: wpisz w tekście wzorca <code>{nr}</code>. Działają też <code>{nr_w_sekcji}</code>, <code>{liczba_stron}</code>, <code>{sekcja}</code> i <code>{strona}</code>.',
      '<b>Gotowe</b> na fioletowym pasku wraca do stron.',
    ],
    dlaczego: [
      '<b>Raz zamiast 365 razy</b> – wspólne elementy rysowane na każdej stronie osobno trzeba by też poprawiać na każdej osobno.',
      '<b>Wzorce niezależne od sekcji</b> – ta sama stopka może być w środku i we wkładce, a okładka nie ma żadnej.',
      '<b>Elementów wzorca nie da się zaznaczyć na stronie</b> – przy układaniu treści nie przesuniesz przypadkiem ramki, która musi być wszędzie w tym samym miejscu.',
      '<b>Fioletowe tło przy edycji</b> – od razu widać, że zmieniasz coś, co pojawi się na wielu stronach.',
      '<b>Zmienne {nr} itd.</b> – numeracja liczy się sama, także po dodaniu lub przesunięciu stron.',
    ],
  },
  {
    tytul: 'Linie i ostrzeżenia',
    wstep: 'Na stronie widać linie pomocnicze. Nie są drukowane.',
    obraz: 'ostrzezenia.png',
    podpis: 'Element wychodzący w margines i lista ostrzeżeń.',
    punkty: [
      '<b>Czerwona linia</b> – krawędź strony po przycięciu.',
      '<b>Różowy pas</b> – spad. Tła i zdjęcia, które mają sięgać krawędzi, rozciągnij aż do jego końca.',
      '<b>Niebieska przerywana</b> – margines. Teksty trzymaj wewnątrz.',
      'Element w marginesie lub poza spadem dostaje pomarańczową ramkę i trafia na listę <b>Ostrzeżenia</b>. Jeśli to celowe, kliknij <b>Wycisz</b>.',
      'Linie ukryjesz przyciskiem w prawym dolnym rogu, obok powiększenia.',
    ],
    dlaczego: [
      '<b>Gilotyna w drukarni ma tolerancję ok. 1–2 mm</b> – tekst przy samej krawędzi może zostać przycięty, dlatego teksty trzymamy w marginesie.',
      '<b>Ostrzeżenia nie blokują</b> – tło na spad czy numer strony w marginesie to często celowe decyzje; aplikacja tylko pilnuje, żebyś o nich wiedział.',
      '<b>Wyciszanie per element</b> – raz sprawdzony element nie zaśmieca listy przy każdej kolejnej zmianie.',
    ],
  },
  {
    tytul: 'Tablet, telefon i instalacja',
    wstep: 'Aplikacja działa w przeglądarce na tablecie, telefonie i komputerze. Można ją też zainstalować jak zwykły program.',
    obraz: 'telefon.png',
    podpis: 'Telefon: panele wysuwają się z dołu.',
    obrazWaski: true,
    punkty: [
      '<b>Jeden palec</b> – zaznaczanie i przesuwanie elementów. <b>Dwa palce</b> – przesuwanie widoku i powiększanie.',
      'Na telefonie panele <b>Strony</b>, <b>Właściwości</b> i <b>Ostrzeżenia</b> otwierasz przyciskami na dole ekranu.',
      '<b>Instalacja na Androidzie</b> (Chrome): menu ⋮ → <b>Zainstaluj aplikację</b> / <b>Dodaj do ekranu głównego</b>.',
      '<b>Instalacja na Macu</b> (Chrome lub Edge): ikona instalacji w pasku adresu. W Safari: Plik → <b>Dodaj do Docka</b>.',
      'Zainstalowana aplikacja na komputerze otwiera pliki <code>.seriodruk</code> dwuklikiem.',
    ],
    dlaczego: [
      '<b>Przeglądarka zamiast osobnych aplikacji</b> – jedna wersja działa na Androidzie, Macu i iPadzie, bez sklepów i aktualizacji.',
      '<b>Dwa palce dla widoku, jeden dla elementów</b> – tak działa większość aplikacji graficznych na tablecie, więc nie trzeba się uczyć nowych gestów.',
      '<b>Instalacja (PWA)</b> – własna ikona, pełny ekran bez paska przeglądarki i szybsze uruchamianie, bo pliki aplikacji są zapamiętane na urządzeniu.',
    ],
  },
  {
    tytul: 'Zapis, pliki i adresy',
    wstep: 'Zmiany zapisują się same: najpierw na urządzeniu, kilka sekund później na koncie.',
    obraz: 'menu.png',
    podpis: 'Menu projektu na liście projektów.',
    punkty: [
      'Stan zapisu widać obok nazwy projektu: <b>Zapisano</b>, <b>Zapisywanie…</b> albo <b>Offline</b> – wtedy zmiany czekają na urządzeniu.',
      '<b>Cofnij</b> i <b>Ponów</b> (<kbd>Ctrl</kbd>+<kbd>Z</kbd>) działają w obrębie bieżącej strony.',
      '<b>Eksport</b> (menu ⋯ na karcie projektu) zapisuje cały projekt do pliku <code>.seriodruk</code>, a <b>Importuj</b> wczytuje go z powrotem.',
      'W edytorze menu <b>⋯</b> pobiera bieżącą stronę jako obraz PNG.',
      'Każdy ekran ma własny adres: lista projektów, konkretna strona projektu, edytowany wzorzec. Odświeżenie zostawia Cię w tym samym miejscu, a przycisk „Wstecz” wraca do listy.',
    ],
    dlaczego: [
      '<b>Najpierw urządzenie, potem konto</b> – przy słabym zasięgu praca się nie zatrzymuje, a zmiany wysyłają się po powrocie sieci.',
      '<b>Własny format .seriodruk</b> – to archiwum ZIP z manifestem (co jest w środku, która wersja formatu), danymi projektu i obrazami jako zwykłymi plikami. Jest mniejsze niż tekstowy JSON z obrazami, da się je otworzyć dowolnym programem do ZIP, a manifest pozwala bezpiecznie wczytać plik z innej wersji aplikacji.',
      '<b>Adresy z identyfikatorem projektu</b> – każdy projekt, strona i wzorzec ma stały identyfikator, więc adres zawsze prowadzi w to samo miejsce, nawet po zmianie nazw.',
    ],
  },
  {
    tytul: 'Skróty klawiszowe',
    wstep: 'Przy pracy na komputerze lub z klawiaturą:',
    punkty: [
      '<kbd>T</kbd> tekst, <kbd>R</kbd> prostokąt, <kbd>E</kbd> elipsa, <kbd>L</kbd> linia',
      '<kbd>Delete</kbd> usuń, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplikuj',
      '<kbd>Ctrl</kbd>+<kbd>Z</kbd> cofnij, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> ponów',
      '<kbd>Ctrl</kbd>+<kbd>G</kbd> grupuj, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> rozgrupuj',
      'Strzałki przesuwają o 1 mm, z <kbd>Shift</kbd> o 10 mm, z <kbd>Alt</kbd> o 0,1 mm',
      '<kbd>Page Up</kbd> / <kbd>Page Down</kbd> poprzednia / następna strona',
      '<kbd>Ctrl</kbd> + kółko myszy – powiększenie',
    ],
    dlaczego: [
      '<b>Te same skróty co w innych programach</b> – Ctrl+Z, Ctrl+D, Ctrl+G działają tak samo jak w innych programach graficznych.',
      '<b>Strzałki w milimetrach</b> – dokładne dosuwanie bez myszy; krok 0,1 mm dla drobnych poprawek.',
    ],
  },
  {
    tytul: 'Co będzie dalej',
    wstep: 'To pierwsza wersja edytora. Kolejne etapy:',
    punkty: [
      '<b>Dane</b>: import CSV i Excel, pola typu <code>{dzien}. {miesiac}</code> w tekście, automatyczne zmniejszanie tekstu, który się nie mieści.',
      '<b>Powielanie</b>: zakresy stron powtarzane według wierszy arkusza, z numeracją.',
      '<b>PDF do druku</b>: spad, znaki cięcia, obrazy 300 dpi, osobne pliki dla sekcji, podział na części.',
    ],
    dlaczego: [
      '<b>Najpierw edytor, potem dane</b> – dane trzeba gdzieś wstawić; bez wygodnego projektowania stron nie ma do czego ich podpinać.',
    ],
  },
];

export class Instrukcja {
  constructor() {
    this.dlg = document.getElementById('dlg-instrukcja');
    this.spis = document.getElementById('instrukcja-rozdzialy');
    this.tresc = document.getElementById('instrukcja-tresc');
    this.numer = document.getElementById('instrukcja-numer');
    this.wstecz = document.getElementById('instrukcja-wstecz');
    this.dalej = document.getElementById('instrukcja-dalej');
    this.indeks = 0;

    ROZDZIALY.forEach((r, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<small>${i + 1}</small><span></span>`;
      b.querySelector('span').textContent = r.tytul;
      b.addEventListener('click', () => this.pokaz(i));
      li.append(b);
      this.spis.append(li);
    });
    this.wstecz.addEventListener('click', () => this.pokaz(this.indeks - 1));
    this.dalej.addEventListener('click', () => {
      if (this.indeks < ROZDZIALY.length - 1) this.pokaz(this.indeks + 1);
      else this.zamknij();
    });
    this.dlg.addEventListener('close', () => this.oznaczPrzeczytana());
    this.dlg.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') this.pokaz(this.indeks + 1);
      if (e.key === 'ArrowLeft') this.pokaz(this.indeks - 1);
    });
  }

  otworz(indeks = 0) {
    this.pokaz(indeks);
    if (!this.dlg.open) this.dlg.showModal();
    this.tresc.focus();
  }

  zamknij() {
    this.oznaczPrzeczytana(); // od razu – zdarzenie „close” przychodzi z opóźnieniem
    this.dlg.close();
  }

  pokaz(i) {
    if (i < 0 || i >= ROZDZIALY.length) return;
    this.indeks = i;
    const r = ROZDZIALY[i];
    this.spis.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    this.spis.children[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const html = [`<h3>${r.tytul}</h3>`, `<p class="wstep">${r.wstep}</p>`];
    if (r.obraz) {
      html.push(`<figure><img src="img/instrukcja/${r.obraz}" alt="${r.podpis || ''}" loading="lazy"${r.obrazWaski ? ' style="max-width:320px"' : ''}>`
        + `${r.podpis ? `<figcaption>${r.podpis}</figcaption>` : ''}</figure>`);
    }
    if (r.punkty?.length) html.push(`<ul class="punkty">${r.punkty.map((p) => `<li>${p}</li>`).join('')}</ul>`);
    if (r.rada) html.push(`<p class="rada">${r.rada}</p>`);
    if (r.dlaczego?.length) {
      html.push(`<section class="dlaczego"><h4>Dlaczego tak?</h4><ul>${r.dlaczego.map((d) => `<li>${d}</li>`).join('')}</ul></section>`);
    }
    this.tresc.innerHTML = html.join('');
    this.tresc.scrollTop = 0;

    this.numer.textContent = `${i + 1} / ${ROZDZIALY.length}`;
    this.wstecz.disabled = i === 0;
    this.dalej.textContent = i === ROZDZIALY.length - 1 ? 'Zaczynamy' : 'Następny';
    wstawIkony(this.dlg);
  }

  // Pokazywana automatycznie tylko raz na konto (w tej przeglądarce).
  czyPrzeczytana(kto) {
    try { return localStorage.getItem(`${KLUCZ_PRZECZYTANA}:${kto}`) === '1'; } catch { return true; }
  }

  oznaczPrzeczytana() {
    try { localStorage.setItem(`${KLUCZ_PRZECZYTANA}:${this.kto}`, '1'); } catch { /* tryb prywatny */ }
  }

  otworzJesliNowa(kto) {
    this.kto = kto;
    if (!this.czyPrzeczytana(kto)) this.otworz(0);
  }
}
