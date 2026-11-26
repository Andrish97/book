/* global fabric */
// Ustawienia Fabric.js 7 wspólne dla edytora i składania stron. Każdy moduł, który tworzy
// albo wczytuje obiekty Fabric, importuje ten plik – ustawienia są gotowe przed pierwszym użyciem.

// Uszlachetnienia (#127): efekt w edytorze i płyty w PDF – nakładka na rysowanie obiektów Fabric.
import { zainstalujUszlachetnienia } from './kolory-druku.js';
import { zainstalujMiekkieKrawedzie } from './miekkie-krawedzie.js';
import { zainstalujWzory } from './wzor-wypelnienia.js';
import { zainstalujDymki } from './dymek.js';

// Własne właściwości obiektów, które zapisujemy razem z JSON-em Fabric.
export const WLASNE_POLA = [
  'link', // adres klikalny w PDF do czytania na ekranie (#131C, pdf-nawigacja.js)
  'id', 'nazwa', 'zasob', 'bez_ostrzezen',
  'warstwa', // element wzorca: 'nad' = nad treścią strony (domyślnie pod)
  'zablokowany', 'styl',
  'stala_pozycja', // rozkładówki: nie przechodzi na lustrzane miejsce, gdy strona zmieni bok (js/boki-stron.js)
  'z', // kolejność na rozkładówce (żeby po zapisie stron osobno dało się ją odtworzyć)
  // Na etap 2 (pola z danymi): już teraz przenoszone przez zapis.
  'pole', 'autodopasowanie', 'min_rozmiar',
  'ramka_h', 'wyrownanie_pion', 'rozmiar_bazowy', // ramka tekstu o stałej wysokości (tekst-ramka.js)
  'ramka_pola',
  'boki', 'gwiazda', // wielokąt foremny albo gwiazda (punkty liczone z tych dwóch liczb)
  'lista', 'lista_start', // wypunktowanie / numerowanie akapitów (tekst-ramka.js)
  'watek', 'watek_nr', 'lacznik', 'lacznik_style', // przelewanie tekstu między ramkami (watki.js)
  'auto_strony', // wątek dokłada strony, aż cały tekst się zmieści (#212)
  'z_tabeli', // treść z tabeli: wzór wpisu powtórzony dla wierszy tabeli (tekst-z-tabeli.js, #432)
  'z_importu', // opis uproszczenia przy odczycie z innego programu (#232) – uwaga w „Sprawdź przed drukiem”
  'z_danych', // kolor i przesunięcie zależne od pola z danych (pola.js)
  'bez_pol', // klamry w tym tekście to zwykły tekst, nie pola
  'wielkosc_liter', // 'wielkie' | 'male' – tylko wygląd, treść zostaje jak wpisana
  'ksiazka', // spis treści albo skorowidz – tekst składany sam: { rodzaj, poziomy, kropki } (ksiazka.js, #131B)
  'przypisy', // przypisy dolne tekstu: { id: treść }; odnośnik w tekście to pole {przypis:id} (#131B)
  'hasla', // hasła skorowidza z tego tekstu: ['słowo', …] (#131B)
  'kod', // kod QR albo EAN-13 / ISBN jako jeden element: { rodzaj, typ, dane, tresc, korekcja, kolor, tlo, … } (kod-obiekt.js, #128)
  'tabela', // tabela jako jeden element: { kolumny, wiersze, naglowek, linia } (tabela-obiekt.js)
  'okladka', 'okladka_dopasuj', // okładka (#119): przypięcie do tyłu, grzbietu albo przodu; dopasowanie do grzbietu
  'obraz_kadr', // kształt jako ramka obrazu: { x, y, skala } (obraz-w-ksztalcie.js, #123)
  // Skład (#131, sklad.js): dzielenie wyrazów, spójniki, wdowy, inicjał, tabulatory, siatka bazowa, oblewanie.
  'dziel_wyrazy', 'dziel_min', 'dziel_przed', 'dziel_po', 'spojniki', 'zasady_pl', 'znaki_bez_zmian', 'lamanie_akapitu', 'wdowy', 'inicjal', 'inicjal_czcionka', 'inicjal_kolor',
  'tabulatory', 'do_siatki', 'bez_oblewania', 'oblewanie', 'oblewanie_odstep',
  'filtry', // filtry obrazu bez zmiany pliku: { jasnosc, kontrast, nasycenie, szarosc, sepia, rozmycie } (#123)
  'uszlachetnienie', 'folia', // uszlachetnienie (#127): 'uv' | 'folia' | 'tloczenie' | 'wytloczenie' | 'bialy'; folia: 'zloto' | 'srebro' | 'miedz'
  'kalendarz', // kalendarz miesiąca: tabela z opisem miesiąca i wyglądu dni (kalendarz-miesiaca.js, #131A)
  'wykres', // wykres z danych (wykres.js, #131A)
  'ksztalt_tekstu', // tekst po łuku, okręgu, ścieżce albo wygięty (tekst-ksztalt.js, #131B)
  'zaokraglenie', // zaokrąglone narożniki zwykłego obrazu w mm – obraz przycięty, obrys po zaokrągleniu (miekkie-krawedzie.js, #156)
  'miekkie_krawedzie', 'miekkie_rodzaj', // miękkie krawędzie (wtapianie) w mm; rodzaj: brak = równo wzdłuż brzegu, owal = winieta (#156)
  'wzor', // wzór jako wypełnienie kształtu: { id, kolor, skala, obrot } – tłem jest fill (wzor-wypelnienia.js, #182)
  'na_czesci', // element na ścianie części składanki (#284) – w grupie części, jedzie z nią
  'czesc', 'skladanka', // składanka (#224): definicja części modelu z papieru i rola elementu w części (js/skladanka.js)
  'dymek', // dymek wokół ramki tekstu: { rodzaj: mowa|mysl|krzyk|narracja, ogonek: { x, y }, wypelnienie, obrys, grubosc } (dymek.js, #360)
  'z_dialogu', // dymek ze scenariusza: { tabela, klucz, wiersz } – ponowne „Ustaw dymki” zmienia tylko tekst (dialogi.js, #361)
  'kadr_nr', // kadr komiksu: numer w kolejności czytania na stronie (kadry.js, komiks-narzedzia.js, #362/#364)
  'kolaz', // kolaż: { uklad, odstep, zaokraglenie, szerokosc, wysokosc } – grupa pól na zdjęcia (#131A)
];

if (!fabric.BaseFabricObject.prototype._ustawieniaSeriodruku) {
  fabric.BaseFabricObject.prototype._ustawieniaSeriodruku = true;
  zainstalujUszlachetnienia();
  zainstalujMiekkieKrawedzie();
  zainstalujWzory();
  zainstalujDymki();

  // Pamięć podręczna obiektów tylko tam, gdzie się opłaca (#158). Fabric domyślnie trzyma każdy obiekt
  // w osobnym płótnie (min. 256×256 px) i przy każdym odrysowaniu nakłada je na stronę – przy 200–300
  // tekstach, liniach i kółkach na stronie dziennika to setki płócien (dziesiątki MB pamięci karty) i
  // 200–450 ms na jedno odrysowanie na telefonie, a w miniaturach i podglądzie (strona rysowana raz)
  // czysta strata. Teksty, linie i proste kształty rysują się wprost szybciej (i ostrzej przy przybliżeniu);
  // bufor zostaje dla grup (tabele, kalendarze, kody, kolaże), obrazów, cieni, przycięć, miękkich krawędzi,
  // wypełnień obrazem, tekstu po kształcie i bardzo złożonych ścieżek.
  const oplacaSieCache = (o) => Boolean(o._objects || o.type === 'image' || o.shadow || o.clipPath
    || Number(o.miekkie_krawedzie) > 0 || o.ksztalt_tekstu || o.filtry || o.wzor
    || (o.fill && typeof o.fill === 'object' && o.fill.source)
    || (o.path && o.path.length > 200) || (o.points && o.points.length > 200));
  const zCache = fabric.FabricObject.prototype.shouldCache;
  fabric.FabricObject.prototype.shouldCache = function shouldCache() {
    if (!oplacaSieCache(this)) { this.ownCaching = this.needsItsOwnCache(); return this.ownCaching; }
    return zCache.call(this);
  };

  // Położenie obiektu (left, top) to jego lewy górny róg – tak są zapisane wszystkie projekty.
  // (Fabric 7 domyślnie liczy od środka.)
  Object.assign(fabric.BaseFabricObject.ownDefaults, { originX: 'left', originY: 'top' });

  // Wygląd uchwytów: powiększony obszar dotyku na tablecie (4.7).
  Object.assign(fabric.InteractiveFabricObject.ownDefaults, {
    transparentCorners: false,
    cornerColor: '#ffffff',
    cornerStrokeColor: '#2563eb',
    borderColor: '#2563eb',
    cornerStyle: 'circle',
    cornerSize: 11,
    touchCornerSize: 40,
    borderScaleFactor: 1.5,
  });

  // Własne pola trafiają do każdego zapisu obiektu (toObject, clone, zapis płótna).
  fabric.FabricObject.customProperties = WLASNE_POLA;
  // Zmiana tych pól zmienia wygląd – element musi się przerysować (pamięć podręczna Fabric).
  // Każda klasa Fabric ma własną listę – dopisujemy do każdej, która może mieć obraz.
  for (const klasa of ['FabricObject', 'Rect', 'Ellipse', 'Circle', 'Polygon', 'Polyline', 'Triangle', 'Path', 'FabricImage']) {
    const lista = fabric[klasa]?.cacheProperties;
    if (Array.isArray(lista)) for (const k of ['filtry', 'obraz_kadr', 'zasob', 'uszlachetnienie', 'folia', 'zaokraglenie', 'miekkie_krawedzie', 'miekkie_rodzaj', 'wzor']) if (!lista.includes(k)) lista.push(k);
  }

  // W zapisie typ obiektu zostaje taki jak dotąd (małe litery: 'textbox', 'image', 'rect'…).
  // Fabric 7 wczytuje obie pisownie, a reszta aplikacji i zapisane projekty znają tę jedną.
  const zapis = fabric.BaseFabricObject.prototype.toObject;
  fabric.BaseFabricObject.prototype.toObject = function toObject(pola) {
    const o = zapis.call(this, pola);
    o.type = this.type;
    // Opis tabeli jest zmieniany w miejscu – zapis dostaje własną kopię, nie odwołanie do żywego obiektu.
    if (o.tabela) o.tabela = JSON.parse(JSON.stringify(o.tabela));
    for (const k of ['kalendarz', 'wykres', 'kolaz']) if (o[k]) o[k] = JSON.parse(JSON.stringify(o[k]));
    // Grupa otwarta w edytorze (zmiana pojedynczego elementu, pisanie w komórce tabeli) w zapisie jest zwykłą grupą.
    if (o.interactive) o.interactive = false;
    if (o.subTargetCheck) o.subTargetCheck = false;
    return o;
  };
}

// Czy obiekt jest zaznaczeniem kilku elementów naraz.
export const toZaznaczenie = (o) => o instanceof fabric.ActiveSelection;
