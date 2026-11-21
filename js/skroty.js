// Skróty klawiszowe edytora. Jedna tabela: z niej działa obsługa klawiatury
// i z niej powstaje lista w instrukcji – nie mogą się rozjechać.
//
// Klawisze zapisane są kodami fizycznymi (KeyZ, BracketRight…), więc skrót
// działa tak samo z Shiftem i bez względu na to, jaki znak daje klawisz.
// „Ctrl” znaczy też ⌘ na Macu.
import { t } from './jezyk.js';

const mm = (pt) => (pt * 25.4) / 72;

// k – kontekst przekazany z aplikacji: { edytor, widok, strony, podglad, … }.
export const SKROTY = [
  // ---------- Edycja ----------
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyZ'], opis: t('skroty.cofnijZmianyNaStronach'), akcja: (k) => k.cofnij() },
  { grupa: 'Edycja', klawisze: ['Ctrl+Shift+KeyZ', 'Ctrl+KeyY'], opis: t('skroty.ponow'), akcja: (k) => k.ponow() },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyC'], opis: t('skroty.kopiuj'), zaznaczenie: true, akcja: (k) => k.edytor.kopiuj() },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyX'], opis: t('skroty.wytnij'), zaznaczenie: true, akcja: (k) => k.edytor.wytnij() },
  // Wklejanie obsługuje zdarzenie „paste” przeglądarki (aplikacja.js) – tylko ono widzi schowek systemu.
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyV'], opis: 'Wklej: element skopiowany w aplikacji (na innej stronie – w to samo miejsce) albo obraz ze schowka systemu – zrzut ekranu, skopiowany plik, kod SVG', systemowe: true },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyD'], opis: t('skroty.duplikuj'), zaznaczenie: true, akcja: (k) => k.edytor.duplikuj() },
  { grupa: 'Edycja', klawisze: ['Delete', 'Backspace'], opis: t('skroty.usun'), zaznaczenie: true, akcja: (k) => k.edytor.usun() },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyF'], opis: t('skroty.znajdzWTekstachProjektu'), zawsze: true, akcja: (k) => k.znajdz(false) },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyH'], opis: t('skroty.znajdzIZamien'), zawsze: true, akcja: (k) => k.znajdz(true) },
  { grupa: 'Edycja', klawisze: ['Ctrl+Alt+KeyC'], pokaz: 'Ctrl+Alt+C', opis: t('skroty.kopiujWygladZaznaczonegoElementu'), zaznaczenie: true, akcja: (k) => k.malarzKopiuj() },
  { grupa: 'Edycja', klawisze: ['Ctrl+Alt+KeyV'], pokaz: 'Ctrl+Alt+V', opis: t('skroty.nalozSkopiowanyWygladNa'), zaznaczenie: true, akcja: (k) => k.malarzNaloz() },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyS'], opis: t('skroty.zapiszOdRazuZapis'), zawsze: true, akcja: (k) => k.zapisz() },

  // ---------- Zaznaczanie ----------
  { grupa: 'Zaznaczanie', klawisze: ['Ctrl+KeyA'], opis: t('skroty.zaznaczWszystkoNaStronie'), akcja: (k) => k.edytor.zaznaczWszystko() },
  { grupa: 'Zaznaczanie', klawisze: ['Escape'], opis: t('skroty.odznaczWOtwartejGrupie'), akcja: (k) => k.edytor.odznacz() },
  { grupa: 'Zaznaczanie', klawisze: ['Tab'], opis: t('skroty.nastepnyElement'), akcja: (k) => k.edytor.zaznaczSasiedni(1) },
  { grupa: 'Zaznaczanie', klawisze: ['Shift+Tab'], opis: t('skroty.poprzedniElement'), akcja: (k) => k.edytor.zaznaczSasiedni(-1) },
  { grupa: 'Zaznaczanie', klawisze: ['Enter'], opis: t('skroty.edytujZaznaczonyTekst'), kiedy: (k) => k.edytor.aktywny?.type === 'textbox', akcja: (k) => k.edytor.edytujTekst() },

  // ---------- Przesuwanie ----------
  { grupa: 'Przesuwanie', klawisze: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], pokaz: 'Strzałki', opis: t('skroty.przesunO1Mm'), zaznaczenie: true, akcja: (k, e) => k.edytor.przesun(...kierunek(e, 1)) },
  { grupa: 'Przesuwanie', klawisze: ['Shift+ArrowLeft', 'Shift+ArrowRight', 'Shift+ArrowUp', 'Shift+ArrowDown'], pokaz: 'Shift+Strzałki', opis: t('skroty.przesunO10Mm'), zaznaczenie: true, akcja: (k, e) => k.edytor.przesun(...kierunek(e, 10)) },
  { grupa: 'Przesuwanie', klawisze: ['Alt+ArrowLeft', 'Alt+ArrowRight', 'Alt+ArrowUp', 'Alt+ArrowDown'], pokaz: 'Alt+Strzałki', opis: t('skroty.przesunO01'), zaznaczenie: true, akcja: (k, e) => k.edytor.przesun(...kierunek(e, 0.1)) },
  { grupa: 'Przesuwanie', pokaz: 'Shift przy przeciąganiu', opis: 'Tylko w poziomie albo w pionie; przy obracaniu – co 15°' },
  { grupa: 'Przesuwanie', pokaz: 'Alt przy przeciąganiu', opis: t('skroty.przeciagnijKopieOryginalZostaje') },
  { grupa: 'Przesuwanie', pokaz: 'Ctrl przy przeciąganiu', opis: t('skroty.bezPrzyciaganiaDoLinii') },
  { grupa: 'Przesuwanie', pokaz: 'Alt (przytrzymany)', opis: t('skroty.pokazOdleglosciZaznaczonegoElementu') },

  // ---------- Układ ----------
  { grupa: 'Układ', klawisze: ['Ctrl+KeyG'], opis: t('skroty.grupuj'), zaznaczenie: true, akcja: (k) => k.edytor.grupuj() },
  { grupa: 'Układ', klawisze: ['Ctrl+Shift+KeyG'], opis: t('skroty.rozgrupuj'), zaznaczenie: true, akcja: (k) => k.edytor.rozgrupuj() },
  { grupa: 'Układ', klawisze: ['Ctrl+BracketRight'], pokaz: 'Ctrl+]', opis: t('skroty.warstwaWyzej'), zaznaczenie: true, akcja: (k) => k.edytor.warstwa('wyzej') },
  { grupa: 'Układ', klawisze: ['Ctrl+BracketLeft'], pokaz: 'Ctrl+[', opis: t('skroty.warstwaNizej'), zaznaczenie: true, akcja: (k) => k.edytor.warstwa('nizej') },
  { grupa: 'Układ', klawisze: ['Ctrl+Shift+BracketRight'], pokaz: 'Ctrl+Shift+]', opis: t('skroty.naWierzch'), zaznaczenie: true, akcja: (k) => k.edytor.warstwa('wierzch') },
  { grupa: 'Układ', klawisze: ['Ctrl+Shift+BracketLeft'], pokaz: 'Ctrl+Shift+[', opis: t('skroty.naSpod'), zaznaczenie: true, akcja: (k) => k.edytor.warstwa('spod') },
  { grupa: 'Układ', klawisze: ['Ctrl+KeyL'], opis: t('skroty.zablokujAlboOdblokuj'), zaznaczenie: true, akcja: (k) => k.edytor.przelaczBlokade() },

  // ---------- Tekst (działa też w trakcie pisania, na zaznaczonym fragmencie) ----------
  { grupa: 'Tekst', klawisze: ['Ctrl+KeyB'], opis: t('skroty.pogrubienie'), tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ fontWeight: c('fontWeight') === 'bold' ? 'normal' : 'bold' })) },
  { grupa: 'Tekst', klawisze: ['Ctrl+KeyI'], opis: t('skroty.kursywa'), tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ fontStyle: c('fontStyle') === 'italic' ? 'normal' : 'italic' })) },
  { grupa: 'Tekst', klawisze: ['Ctrl+KeyU'], opis: t('skroty.podkreslenie'), tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ underline: !c('underline') })) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+KeyL'], opis: t('skroty.wyrownajDoLewej'), tekst: true, akcja: (k) => k.edytor.formatujTekst(() => ({ textAlign: 'left' }), true) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+KeyE'], opis: t('skroty.wysrodkuj'), tekst: true, akcja: (k) => k.edytor.formatujTekst(() => ({ textAlign: 'center' }), true) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+KeyR'], opis: t('skroty.wyrownajDoPrawej'), tekst: true, akcja: (k) => k.edytor.formatujTekst(() => ({ textAlign: 'right' }), true) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+KeyJ'], opis: t('skroty.wyjustuj'), tekst: true, akcja: (k) => k.edytor.formatujTekst(() => ({ textAlign: 'justify' }), true) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+Period'], pokaz: 'Ctrl+Shift+.', opis: t('skroty.wiekszaCzcionkaO1'), tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ fontSize: c('fontSize') + mm(1) })) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+Comma'], pokaz: 'Ctrl+Shift+,', opis: t('skroty.mniejszaCzcionkaO1'), tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ fontSize: Math.max(mm(2), c('fontSize') - mm(1)) })) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+Digit8'], pokaz: 'Ctrl+Shift+8', opis: t('skroty.listaZPunktamiWlacz'), tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ lista: c('lista') === 'punkty' ? undefined : 'punkty' }), true) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+Digit7'], pokaz: 'Ctrl+Shift+7', opis: t('skroty.listaNumerowanaWlaczWylacz'), tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ lista: c('lista') === 'numery' ? undefined : 'numery' }), true) },

  // ---------- Wstawianie ----------
  { grupa: 'Wstawianie', klawisze: ['KeyT'], opis: t('skroty.tekst'), akcja: (k) => k.edytor.dodajTekst() },
  { grupa: 'Wstawianie', klawisze: ['KeyR'], opis: t('skroty.prostokat'), akcja: (k) => k.edytor.dodajProstokat() },
  { grupa: 'Wstawianie', klawisze: ['KeyE'], opis: t('skroty.elipsa'), akcja: (k) => k.edytor.dodajElipse() },
  { grupa: 'Wstawianie', klawisze: ['KeyL'], opis: t('skroty.linia'), akcja: (k) => k.edytor.dodajLinie() },
  { grupa: 'Wstawianie', klawisze: ['KeyB'], opis: 'Rysowanie odręczne (włącz / wyłącz; Esc kończy)', akcja: (k) => k.edytor.ustawRysowanie(!k.edytor.rysuje) },
  { grupa: 'Wstawianie', klawisze: ['KeyN'], opis: 'Pióro: kształt z punktów i krzywych (włącz / wyłącz; Enter kończy kształt, Esc porzuca)', akcja: (k) => k.edytor.ustawPioro(!k.edytor.pioro) },
  { grupa: 'Wstawianie', klawisze: ['KeyP'], opis: t('skroty.wielokat'), akcja: (k) => k.edytor.dodajWielokat() },
  { grupa: 'Wstawianie', klawisze: ['KeyI'], opis: t('skroty.obrazZDysku'), akcja: (k) => k.wstawObraz() },

  // ---------- Widok ----------
  { grupa: 'Widok', klawisze: ['Ctrl+Equal', 'Ctrl+NumpadAdd'], pokaz: 'Ctrl++', opis: t('skroty.powieksz'), akcja: (k) => k.edytor.ustawZoom(k.edytor.zoom * 1.25) },
  { grupa: 'Widok', klawisze: ['Ctrl+Minus', 'Ctrl+NumpadSubtract'], pokaz: 'Ctrl+−', opis: t('skroty.pomniejsz'), akcja: (k) => k.edytor.ustawZoom(k.edytor.zoom / 1.25) },
  { grupa: 'Widok', klawisze: ['Ctrl+Digit0', 'Ctrl+Numpad0'], pokaz: 'Ctrl+0', opis: t('skroty.dopasujDoOkna'), akcja: (k) => k.edytor.dopasujDoOkna() },
  { grupa: 'Widok', klawisze: ['Ctrl+Digit1', 'Ctrl+Numpad1'], pokaz: 'Ctrl+1', opis: t('skroty.powiekszenie100'), akcja: (k) => k.edytor.ustawZoom(1) },
  { grupa: 'Widok', pokaz: 'Ctrl+kółko myszy', opis: t('skroty.powiekszanieWMiejscuKursora') },
  { grupa: 'Widok', pokaz: 'Spacja+przeciąganie', opis: t('skroty.przesuwanieWidokuRaczka') },
  { grupa: 'Widok', klawisze: ['KeyW', 'Ctrl+Semicolon'], pokaz: 'W', opis: 'Pokaż albo ukryj linie pomocnicze', akcja: (k) => k.przelaczProwadnice() },
  { grupa: 'Widok', klawisze: ['Ctrl+Quote'], pokaz: 'Ctrl+\'', opis: t('skroty.pokazAlboUkryjSiatke'), akcja: (k) => k.widok.przelacz('siatka') },
  { grupa: 'Widok', klawisze: ['Ctrl+Shift+Quote'], pokaz: 'Ctrl+Shift+\'', opis: t('skroty.przyciaganieDoSiatki'), akcja: (k) => k.widok.przelacz('do_siatki') },
  { grupa: 'Widok', klawisze: ['Shift+KeyR'], opis: t('skroty.pokazAlboUkryjLinijki'), akcja: (k) => k.widok.przelacz('linijki') },
  { grupa: 'Widok', klawisze: ['Shift+KeyW'], opis: t('skroty.podgladBezEdycji'), akcja: (k) => k.podglad() },
  { grupa: 'Widok', klawisze: ['F7'], opis: t('skroty.wlasciwosciAlboWarstwyW'), zawsze: true, akcja: (k) => k.przelaczPanelPrawy() },
  { grupa: 'Widok', klawisze: ['F8'], opis: t('skroty.okienkoOstrzezen'), zawsze: true, akcja: (k) => k.ostrzezenia() },

  // ---------- Strony ----------
  { grupa: 'Strony', klawisze: ['PageUp'], opis: t('skroty.poprzedniaStrona'), akcja: (k) => k.strona(-1) },
  { grupa: 'Strony', klawisze: ['PageDown'], opis: t('skroty.nastepnaStrona'), akcja: (k) => k.strona(1) },
  { grupa: 'Strony', klawisze: ['Ctrl+Shift+KeyP'], opis: t('skroty.nowaStronaZaBiezaca'), akcja: (k) => k.nowaStrona() },
  { grupa: 'Strony', klawisze: ['Shift+Slash', 'F1'], pokaz: '?', opis: 'Ta lista skrótów', zawsze: true, akcja: (k) => k.pomoc() },
];

function kierunek(e, krok) {
  return { ArrowLeft: [-krok, 0], ArrowRight: [krok, 0], ArrowUp: [0, -krok], ArrowDown: [0, krok] }[e.code];
}

// „Ctrl+Shift+KeyZ” dla zdarzenia klawiatury.
export function kombinacja(e) {
  return `${e.ctrlKey || e.metaKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}${e.code}`;
}

// Jak pokazać skrót człowiekowi: „Ctrl+Shift+Z”.
export function opisKlawiszy(skrot) {
  if (skrot.pokaz) return skrot.pokaz;
  return skrot.klawisze[0]
    .replace(/Key([A-Z])$/, '$1').replace(/Digit(\d)$/, '$1')
    .replace('Delete', 'Delete').replace('Escape', 'Esc');
}

const MAPA = new Map();
for (const s of SKROTY) for (const kl of s.klawisze || []) MAPA.set(kl, s);

// Obsługuje naciśnięcie klawisza. stan: { wPolu, wEdycji } – kursor w polu
// formularza albo w edytowanym tekście na płótnie. Zwraca true, gdy skrót zadziałał.
export function obsluzKlawisz(e, k, { wPolu, wEdycji }) {
  const skrot = MAPA.get(kombinacja(e));
  if (!skrot || skrot.systemowe) return false;
  if (!skrot.zawsze) {
    if (wPolu) return false;
    if (wEdycji && !skrot.tekst) return false;
  }
  if (skrot.zaznaczenie && !k.edytor.aktywny) return false;
  if (skrot.tekst && k.edytor.aktywny?.type !== 'textbox') return false;
  if (skrot.kiedy && !skrot.kiedy(k)) return false;
  e.preventDefault();
  skrot.akcja(k, e);
  return true;
}
