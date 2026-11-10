// Skróty klawiszowe edytora. Jedna tabela: z niej działa obsługa klawiatury
// i z niej powstaje lista w instrukcji – nie mogą się rozjechać.
//
// Klawisze zapisane są kodami fizycznymi (KeyZ, BracketRight…), więc skrót
// działa tak samo z Shiftem i bez względu na to, jaki znak daje klawisz.
// „Ctrl” znaczy też ⌘ na Macu.

const mm = (pt) => (pt * 25.4) / 72;

// k – kontekst przekazany z aplikacji: { edytor, widok, strony, podglad, … }.
export const SKROTY = [
  // ---------- Edycja ----------
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyZ'], opis: 'Cofnij', akcja: (k) => k.edytor.cofnij() },
  { grupa: 'Edycja', klawisze: ['Ctrl+Shift+KeyZ', 'Ctrl+KeyY'], opis: 'Ponów', akcja: (k) => k.edytor.ponow() },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyC'], opis: 'Kopiuj', zaznaczenie: true, akcja: (k) => k.edytor.kopiuj() },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyX'], opis: 'Wytnij', zaznaczenie: true, akcja: (k) => k.edytor.wytnij() },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyV'], opis: 'Wklej (na innej stronie – w to samo miejsce)', kiedy: (k) => k.edytor.maSchowek, akcja: (k) => k.edytor.wklej() },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyD'], opis: 'Duplikuj', zaznaczenie: true, akcja: (k) => k.edytor.duplikuj() },
  { grupa: 'Edycja', klawisze: ['Delete', 'Backspace'], opis: 'Usuń', zaznaczenie: true, akcja: (k) => k.edytor.usun() },
  { grupa: 'Edycja', klawisze: ['Ctrl+KeyS'], opis: 'Zapisz od razu (zapis i tak jest automatyczny)', zawsze: true, akcja: (k) => k.zapisz() },

  // ---------- Zaznaczanie ----------
  { grupa: 'Zaznaczanie', klawisze: ['Ctrl+KeyA'], opis: 'Zaznacz wszystko na stronie', akcja: (k) => k.edytor.zaznaczWszystko() },
  { grupa: 'Zaznaczanie', klawisze: ['Escape'], opis: 'Odznacz', akcja: (k) => k.edytor.odznacz() },
  { grupa: 'Zaznaczanie', klawisze: ['Tab'], opis: 'Następny element', akcja: (k) => k.edytor.zaznaczSasiedni(1) },
  { grupa: 'Zaznaczanie', klawisze: ['Shift+Tab'], opis: 'Poprzedni element', akcja: (k) => k.edytor.zaznaczSasiedni(-1) },
  { grupa: 'Zaznaczanie', klawisze: ['Enter'], opis: 'Edytuj zaznaczony tekst', kiedy: (k) => k.edytor.aktywny?.type === 'textbox', akcja: (k) => k.edytor.edytujTekst() },

  // ---------- Przesuwanie ----------
  { grupa: 'Przesuwanie', klawisze: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], pokaz: 'Strzałki', opis: 'Przesuń o 1 mm', zaznaczenie: true, akcja: (k, e) => k.edytor.przesun(...kierunek(e, 1)) },
  { grupa: 'Przesuwanie', klawisze: ['Shift+ArrowLeft', 'Shift+ArrowRight', 'Shift+ArrowUp', 'Shift+ArrowDown'], pokaz: 'Shift+Strzałki', opis: 'Przesuń o 10 mm', zaznaczenie: true, akcja: (k, e) => k.edytor.przesun(...kierunek(e, 10)) },
  { grupa: 'Przesuwanie', klawisze: ['Alt+ArrowLeft', 'Alt+ArrowRight', 'Alt+ArrowUp', 'Alt+ArrowDown'], pokaz: 'Alt+Strzałki', opis: 'Przesuń o 0,1 mm', zaznaczenie: true, akcja: (k, e) => k.edytor.przesun(...kierunek(e, 0.1)) },
  { grupa: 'Przesuwanie', pokaz: 'Shift przy przeciąganiu', opis: 'Tylko w poziomie albo w pionie; przy obracaniu – co 15°' },
  { grupa: 'Przesuwanie', pokaz: 'Alt przy przeciąganiu', opis: 'Przeciągnij kopię, oryginał zostaje' },
  { grupa: 'Przesuwanie', pokaz: 'Ctrl przy przeciąganiu', opis: 'Bez przyciągania do linii, elementów i siatki' },
  { grupa: 'Przesuwanie', pokaz: 'Alt (przytrzymany)', opis: 'Pokaż odległości zaznaczonego elementu do sąsiadów i krawędzi strony' },

  // ---------- Układ ----------
  { grupa: 'Układ', klawisze: ['Ctrl+KeyG'], opis: 'Grupuj', zaznaczenie: true, akcja: (k) => k.edytor.grupuj() },
  { grupa: 'Układ', klawisze: ['Ctrl+Shift+KeyG'], opis: 'Rozgrupuj', zaznaczenie: true, akcja: (k) => k.edytor.rozgrupuj() },
  { grupa: 'Układ', klawisze: ['Ctrl+BracketRight'], pokaz: 'Ctrl+]', opis: 'Warstwa wyżej', zaznaczenie: true, akcja: (k) => k.edytor.warstwa('wyzej') },
  { grupa: 'Układ', klawisze: ['Ctrl+BracketLeft'], pokaz: 'Ctrl+[', opis: 'Warstwa niżej', zaznaczenie: true, akcja: (k) => k.edytor.warstwa('nizej') },
  { grupa: 'Układ', klawisze: ['Ctrl+Shift+BracketRight'], pokaz: 'Ctrl+Shift+]', opis: 'Na wierzch', zaznaczenie: true, akcja: (k) => k.edytor.warstwa('wierzch') },
  { grupa: 'Układ', klawisze: ['Ctrl+Shift+BracketLeft'], pokaz: 'Ctrl+Shift+[', opis: 'Na spód', zaznaczenie: true, akcja: (k) => k.edytor.warstwa('spod') },
  { grupa: 'Układ', klawisze: ['Ctrl+KeyL'], opis: 'Zablokuj albo odblokuj', zaznaczenie: true, akcja: (k) => k.edytor.przelaczBlokade() },

  // ---------- Tekst (działa też w trakcie pisania, na zaznaczonym fragmencie) ----------
  { grupa: 'Tekst', klawisze: ['Ctrl+KeyB'], opis: 'Pogrubienie', tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ fontWeight: c('fontWeight') === 'bold' ? 'normal' : 'bold' })) },
  { grupa: 'Tekst', klawisze: ['Ctrl+KeyI'], opis: 'Kursywa', tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ fontStyle: c('fontStyle') === 'italic' ? 'normal' : 'italic' })) },
  { grupa: 'Tekst', klawisze: ['Ctrl+KeyU'], opis: 'Podkreślenie', tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ underline: !c('underline') })) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+KeyL'], opis: 'Wyrównaj do lewej', tekst: true, akcja: (k) => k.edytor.formatujTekst(() => ({ textAlign: 'left' }), true) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+KeyE'], opis: 'Wyśrodkuj', tekst: true, akcja: (k) => k.edytor.formatujTekst(() => ({ textAlign: 'center' }), true) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+KeyR'], opis: 'Wyrównaj do prawej', tekst: true, akcja: (k) => k.edytor.formatujTekst(() => ({ textAlign: 'right' }), true) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+KeyJ'], opis: 'Wyjustuj', tekst: true, akcja: (k) => k.edytor.formatujTekst(() => ({ textAlign: 'justify' }), true) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+Period'], pokaz: 'Ctrl+Shift+.', opis: 'Większa czcionka (o 1 pt)', tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ fontSize: c('fontSize') + mm(1) })) },
  { grupa: 'Tekst', klawisze: ['Ctrl+Shift+Comma'], pokaz: 'Ctrl+Shift+,', opis: 'Mniejsza czcionka (o 1 pt)', tekst: true, akcja: (k) => k.edytor.formatujTekst((c) => ({ fontSize: Math.max(mm(2), c('fontSize') - mm(1)) })) },

  // ---------- Wstawianie ----------
  { grupa: 'Wstawianie', klawisze: ['KeyT'], opis: 'Tekst', akcja: (k) => k.edytor.dodajTekst() },
  { grupa: 'Wstawianie', klawisze: ['KeyR'], opis: 'Prostokąt', akcja: (k) => k.edytor.dodajProstokat() },
  { grupa: 'Wstawianie', klawisze: ['KeyE'], opis: 'Elipsa', akcja: (k) => k.edytor.dodajElipse() },
  { grupa: 'Wstawianie', klawisze: ['KeyL'], opis: 'Linia', akcja: (k) => k.edytor.dodajLinie() },
  { grupa: 'Wstawianie', klawisze: ['KeyI'], opis: 'Obraz z dysku', akcja: (k) => k.wstawObraz() },

  // ---------- Widok ----------
  { grupa: 'Widok', klawisze: ['Ctrl+Equal', 'Ctrl+NumpadAdd'], pokaz: 'Ctrl++', opis: 'Powiększ', akcja: (k) => k.edytor.ustawZoom(k.edytor.zoom * 1.25) },
  { grupa: 'Widok', klawisze: ['Ctrl+Minus', 'Ctrl+NumpadSubtract'], pokaz: 'Ctrl+−', opis: 'Pomniejsz', akcja: (k) => k.edytor.ustawZoom(k.edytor.zoom / 1.25) },
  { grupa: 'Widok', klawisze: ['Ctrl+Digit0', 'Ctrl+Numpad0'], pokaz: 'Ctrl+0', opis: 'Dopasuj do okna', akcja: (k) => k.edytor.dopasujDoOkna() },
  { grupa: 'Widok', klawisze: ['Ctrl+Digit1', 'Ctrl+Numpad1'], pokaz: 'Ctrl+1', opis: 'Powiększenie 100%', akcja: (k) => k.edytor.ustawZoom(1) },
  { grupa: 'Widok', pokaz: 'Ctrl+kółko myszy', opis: 'Powiększanie w miejscu kursora' },
  { grupa: 'Widok', pokaz: 'Spacja+przeciąganie', opis: 'Przesuwanie widoku („rączka”)' },
  { grupa: 'Widok', klawisze: ['KeyW', 'Ctrl+Semicolon'], pokaz: 'W', opis: 'Pokaż albo ukryj linie pomocnicze', akcja: (k) => k.przelaczProwadnice() },
  { grupa: 'Widok', klawisze: ['Ctrl+Quote'], pokaz: 'Ctrl+\'', opis: 'Pokaż albo ukryj siatkę', akcja: (k) => k.widok.przelacz('siatka') },
  { grupa: 'Widok', klawisze: ['Ctrl+Shift+Quote'], pokaz: 'Ctrl+Shift+\'', opis: 'Przyciąganie do siatki', akcja: (k) => k.widok.przelacz('do_siatki') },
  { grupa: 'Widok', klawisze: ['Shift+KeyR'], opis: 'Pokaż albo ukryj linijki', akcja: (k) => k.widok.przelacz('linijki') },
  { grupa: 'Widok', klawisze: ['Shift+KeyW'], opis: 'Podgląd bez edycji', akcja: (k) => k.podglad() },

  // ---------- Strony ----------
  { grupa: 'Strony', klawisze: ['PageUp'], opis: 'Poprzednia strona', akcja: (k) => k.strona(-1) },
  { grupa: 'Strony', klawisze: ['PageDown'], opis: 'Następna strona', akcja: (k) => k.strona(1) },
  { grupa: 'Strony', klawisze: ['Ctrl+Shift+KeyP'], opis: 'Nowa strona za bieżącą', akcja: (k) => k.nowaStrona() },
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
  if (!skrot) return false;
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
