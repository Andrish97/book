// Instrukcja obsługi: rozdziały ze zrzutami ekranu (img/instrukcja/*.png).
// Zrzuty generuje skrypt scripts/zrzuty-instrukcji.mjs – po zmianach w wyglądzie
// wystarczy go uruchomić ponownie.

import { wstawIkony } from './ikony.js';

const KLUCZ_PRZECZYTANA = 'publisher-lite:instrukcja-przeczytana';

export const ROZDZIALY = [
  {
    tytul: 'Na początek',
    wstep: 'Publisher-lite służy do składania publikacji z powtarzalnymi stronami: kalendarzy, planerów, notesów. Projektujesz wzór strony, a w kolejnych wersjach aplikacja wstawi do niego dane z arkusza i złoży gotowy PDF do druku.',
    obraz: 'projekty.png',
    podpis: 'Lista projektów po zalogowaniu.',
    punkty: [
      'Projekty są przypisane do Twojego konta i dostępne na tablecie, telefonie i komputerze.',
      'Każda zmiana zapisuje się sama – nie ma przycisku „Zapisz”.',
      'Instrukcję otworzysz w każdej chwili przyciskiem <b>Instrukcja</b> na liście projektów albo <b>?</b> w edytorze.',
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
  },
  {
    tytul: 'Nowy projekt',
    wstep: 'Projekt to cała publikacja: format wydruku i wszystkie strony.',
    obraz: 'nowy-projekt.png',
    podpis: 'Okno „Nowy projekt”.',
    punkty: [
      'Wpisz nazwę i wybierz format – kafelki pokazują proporcje strony. <b>Własny</b> pozwala wpisać dowolny wymiar w milimetrach.',
      '<b>Spad</b> to pas za krawędzią strony, który drukarnia odcina. Zwykle 3 mm.',
      '<b>Marginesy</b> wyznaczają bezpieczny obszar na teksty. Aplikacja ostrzeże, jeśli coś z niego wyjdzie.',
      'Projekt zaczyna od jednej sekcji „Główna” w tym formacie. Kolejne sekcje (np. okładkę o innym rozmiarze) dodasz w edytorze.',
    ],
  },
  {
    tytul: 'Edytor – przegląd',
    wstep: 'Po otwarciu projektu widzisz edytor. Ma trzy części:',
    obraz: 'edytor.png',
    podpis: 'Edytor na tablecie w poziomie.',
    punkty: [
      '<b>1. Strony</b> (z lewej) – miniatury wszystkich stron projektu. Kliknij miniaturę, aby ją edytować.',
      '<b>2. Strona</b> (pośrodku) – tu układasz elementy. Na górze pasek <b>Wstaw</b>, w prawym dolnym rogu powiększenie.',
      '<b>3. Właściwości</b> (z prawej) – ustawienia zaznaczonego elementu albo całej strony, gdy nic nie jest zaznaczone.',
      'Na górnym pasku: powrót do projektów, nazwa projektu, stan zapisu, cofanie, format i menu <b>⋯</b>.',
    ],
  },
  {
    tytul: 'Wstawianie elementów',
    wstep: 'Pasek nad stroną wstawia nowe elementy na środek strony.',
    obraz: 'wstawianie.png',
    podpis: 'Zaznaczony tekst z uchwytami.',
    punkty: [
      '<b>Tekst</b> – kliknij dwa razy, aby pisać bezpośrednio na stronie, albo wpisz treść w polu <b>Treść</b> po prawej (wygodniejsze na telefonie).',
      '<b>Prostokąt, Elipsa, Linia</b> – kształty do ramek, tła i podziałów.',
      '<b>Obraz</b> – zdjęcie lub grafika z dysku. Możesz też przeciągnąć plik na stronę.',
      'Przeciągnij element, aby go przesunąć. Kółka w rogach zmieniają rozmiar, kółko nad elementem go obraca.',
      'Przy krawędziach, marginesach i środku strony element „przykleja się” – pokazuje to różowa linia.',
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
      '<b>Obraz</b>: przycięcie z każdej strony, obrys, odbicie i informacja o rozdzielczości (do druku 300 dpi).',
      'Ikony nad panelem: <b>duplikuj</b> i <b>usuń</b> element.',
    ],
    rada: 'Kilka elementów zaznaczysz, przeciągając prostokąt po pustym miejscu strony albo klikając z wciśniętym Shift. Potem możesz je zgrupować.',
  },
  {
    tytul: 'Strony',
    wstep: 'Każdą stronę projektujesz osobno. Kolejność miniatur to kolejność stron w publikacji.',
    obraz: 'strony.png',
    podpis: 'Menu strony.',
    punkty: [
      '<b>+ Strona</b> na dole panelu wstawia pustą stronę za bieżącą, w tej samej sekcji.',
      'Przycisk <b>⋯</b> na miniaturze: zmiana nazwy, duplikowanie, przesuwanie w górę i w dół (w obrębie sekcji), usuwanie.',
      'Nazwy stron (np. „Okładka”, „Tydzień – lewa”) pomogą później przy podpinaniu danych.',
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
      'Stronę przeniesiesz do innej sekcji w jej właściwościach (pole <b>Sekcja</b>). Nazwa i format bieżącej sekcji są też na górnym pasku.',
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
      'Na zwykłych stronach elementy wzorca widać, ale nie da się ich zaznaczyć ani przesunąć. Zmieniasz je tylko we wzorcu – i zmieniają się wszędzie.',
      '<b>Gotowe</b> na fioletowym pasku wraca do stron.',
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
      'Element w marginesie lub poza spadem dostaje pomarańczową ramkę i trafia na listę <b>Ostrzeżenia</b>. Jeśli to celowe (np. tło na spad), kliknij <b>Wycisz</b>.',
      'Linie ukryjesz przyciskiem w prawym dolnym rogu, obok powiększenia.',
    ],
  },
  {
    tytul: 'Tablet i telefon',
    wstep: 'Aplikacja działa w przeglądarce, także na tablecie i telefonie.',
    obraz: 'telefon.png',
    podpis: 'Telefon: panele wysuwają się z dołu.',
    obrazWaski: true,
    punkty: [
      '<b>Jeden palec</b> – zaznaczanie i przesuwanie elementów.',
      '<b>Dwa palce</b> – przesuwanie widoku i powiększanie (szczypanie).',
      'Na telefonie panele <b>Strony</b>, <b>Właściwości</b> i <b>Ostrzeżenia</b> otwierasz przyciskami na dole ekranu.',
      'Tekst najwygodniej poprawiać w polu <b>Treść</b> we Właściwościach – klawiatura nie zasłania wtedy strony.',
    ],
  },
  {
    tytul: 'Zapis i kopie',
    wstep: 'Zmiany zapisują się same: najpierw na urządzeniu, kilka sekund później na koncie.',
    obraz: 'menu.png',
    podpis: 'Menu ⋯ w edytorze.',
    punkty: [
      'Stan zapisu widać obok nazwy projektu: <b>Zapisano</b>, <b>Zapisywanie…</b> albo <b>Offline</b> – wtedy zmiany czekają na urządzeniu i wyślą się po powrocie internetu.',
      '<b>Cofnij</b> i <b>Ponów</b> na górnym pasku (<kbd>Ctrl</kbd>+<kbd>Z</kbd>) działają w obrębie bieżącej strony.',
      'Menu <b>⋯</b>: pobranie strony jako PNG, kopia całego projektu do pliku i wczytanie projektu z pliku.',
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
  },
  {
    tytul: 'Co będzie dalej',
    wstep: 'To pierwsza wersja edytora. Kolejne etapy:',
    punkty: [
      '<b>Dane</b>: import CSV i Excel, pola typu <code>{dzien}. {miesiac}</code> w tekście, automatyczne zmniejszanie tekstu, który się nie mieści.',
      '<b>Powielanie</b>: zakresy stron powtarzane według wierszy arkusza, z numeracją.',
      '<b>Motywy</b>: wspólne tła i ramki nakładane na wybrane strony.',
      '<b>PDF do druku</b>: spad, znaki cięcia, obrazy 300 dpi, podział na części.',
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
