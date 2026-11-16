/* global fabric */
// Panel właściwości: pola liczbowe w mm (4.7 – precyzja na tablecie).

import { biezacaMarka } from './zestaw-marki.js';
import { STREFY, strefaW } from './okladka.js';
import { toZaznaczenie } from './fabric-ustawienia.js';
import { CZCIONKI } from './czcionki.js';
import { rozmiarOryginalu } from './obrazy.js';
import { maObraz, moznaWstawicObraz, ukladObrazu } from './obraz-w-ksztalcie.js';
import { BEZ_FILTROW, maFiltry } from './filtry-obrazu.js';
import { USZLACHETNIENIA, FOLIE, plytaUszlachetnienia, trybKolorow, sekcjaBiezaca, koloryDodatkowe, mapaSpotow, dodajKolorDodatkowy, rgbNaCmyk, hexSpotu } from './kolory-druku.js';
import { mmNaPt, ptNaMm } from './projekt.js';
import { nazwaTypu, toKolaz, WIELOKATY, podgladWielokata } from './edytor.js';
import { RODZAJE_KSZTALTU, normalizujKsztalt, ustawKontrolkiKsztaltu, sciezkaZKsztaltu, czyWygiecie } from './tekst-ksztalt.js';
import { toKalendarz, MIESIACE, KOLORY_DOMYSLNE } from './kalendarz-miesiaca.js';
import { toWykres, RODZAJE, PALETA, normalizujWykres } from './wykres.js';
import { KOLAZE, RODZAJE_KRESEK, wzorKresek, rodzajKresek } from './ksztalty-biblioteka.js';
import { RODZAJE_MIEKKICH, maMiekkie } from './miekkie-krawedzie.js';
import { toKod, domyslnyKod, uwagiKodu, EAN_NOMINAL } from './kod-obiekt.js';
import { trescQR } from './kody.js';
import { naglowkiProjektu, celeOdsylaczy, LICZENIE_PRZYPISOW, RODZAJE as RODZAJE_KSIAZKI } from './ksiazka.js';
import { ikona } from './ikony.js';
import { uzyteCzcionki } from './kontrolki.js';
import { maPrzejscie } from './pola.js';
import { stylZObiektu, zastosujStyl, POLA_STYLU, rowneWStylu, stylZnakowyZFragmentu, zastosujStylZnakowy, stylZnakowyNaPozycji } from './style-tekstu.js';
import { zapytajONazwe, potwierdz, powiadom } from './ui.js';
import { toTabela, komorkiTabeli, ustawSzerokoscKolumny, ustawNaglowek, ustawTekstTabeli, ulozTabele, wysokosciWierszy, ustawTloTabeli, ustawWysokoscWiersza, krawedzKomorki, ustawKrawedzKomorki, ustawLinieZakresu } from './tabela-obiekt.js';

const TEKSTOWE = new Set(['textbox', 'i-text', 'text']);
const KSZTALTY = new Set(['rect', 'ellipse', 'polygon']);

// Wykończenie druku (#167): krótkie nazwy na kafelkach, opis prostymi słowami i ikona każdego efektu.
const KROTKO_WYKONCZEN = { uv: 'Lakier', folia: 'Złocenie', tloczenie: 'Tłoczenie', wytloczenie: 'Wytłoczenie', bialy: 'Biel' };
const OPISY_WYKONCZEN = {
  brak: 'Zwykły druk – bez wykończenia.',
  uv: 'Lakier wybiórczy: błyszcząca warstwa tylko w tym miejscu, np. tytuł na matowej okładce.',
  folia: 'Złocenie: metaliczna folia – złoto, srebro albo miedź.',
  tloczenie: 'Tłoczenie: wypukły relief wyciśnięty w papierze.',
  wytloczenie: 'Wytłoczenie: wklęsły relief wciśnięty w papier.',
  bialy: 'Biel: biała farba pod spodem – na kolorowym, kraftowym albo przezroczystym podłożu.',
};
const ik = (sciezki) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${sciezki}</svg>`;
const IKONY_WYKONCZEN = {
  brak: ik('<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>'),
  uv: ik('<path d="M12 3.5c3.2 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.3-6 5.5-10z"/><path d="M9.6 14.2a2.6 2.6 0 0 0 2 2.3"/>'),
  folia: ik('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
  tloczenie: ik('<path d="M3.5 17.5h17"/><path d="M6.5 17.5v-5.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v5.5"/><path d="M9 10V7.5"/><path d="M15 10V7.5"/>'),
  wytloczenie: ik('<path d="M3.5 9.5h3v5.5a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V9.5h3"/><path d="M9 17v2.5"/><path d="M15 17v2.5"/>'),
  bialy: ik('<rect x="4.5" y="4.5" width="15" height="15" rx="2"/><path d="M4.5 12h15M12 4.5v15"/><path d="M4.5 4.5L12 12M12 12l7.5 7.5" stroke-opacity=".45"/>'),
};

const zaokr = (v, miejsc = 2) => {
  const k = 10 ** miejsc;
  return Math.round(v * k) / k;
};

const KLUCZ_ZWINIETE = 'seriodruk:zwiniete-sekcje';
function zwiniete() {
  try { return new Set(JSON.parse(localStorage.getItem(KLUCZ_ZWINIETE) || '[]')); } catch { return new Set(); }
}

export class PanelWlasciwosci {
  // opcje.tytulPusty(): nagłówek, gdy nic nie jest zaznaczone,
  // opcje.budujPusty(panel): zawartość panelu dla strony / wzorca.
  constructor(kontener, tytul, edytor, opcje) {
    this.el = kontener;
    this.tytul = tytul;
    this.edytor = edytor;
    this.opcje = opcje;
    this.obj = undefined;
    this.odswiezacze = [];
    // Kliknięcie innej komórki zaznaczonej tabeli zmienia część „Kolumna i wiersz” (#115).
    edytor.addEventListener?.('komorka-tabeli', (e) => { if (this.obj && this.obj === e.detail) this.zbuduj(); });
    // Włączenie i wyłączenie narzędzia rysowania albo pióra zmienia panel na ustawienia narzędzia i z powrotem.
    for (const z of ['rysowanie', 'pioro']) edytor.addEventListener?.(z, () => this.zbuduj());
    // Obraz wstawiony do kształtu albo z niego usunięty zmienia części panelu tego samego elementu (#123).
    edytor.addEventListener?.('obraz-ksztaltu', () => this.zbuduj());
  }

  pokaz(obj) {
    // Włączenie albo wyłączenie trybu „cały połączony tekst” zmienia zawartość panelu tej samej ramki.
    const caly = this.edytor.calyTekstZaznaczony || null;
    if (obj === this.obj && obj && caly === (this._calyTekst || null)) {
      this.odswiez();
      return;
    }
    this._calyTekst = caly;
    this.obj = obj;
    this.zbuduj();
  }

  odswiez() {
    for (const f of this.odswiezacze) f();
  }

  // ---------- Budowanie ----------

  zbuduj() {
    this._zbuduj();
    this._naglowek();
  }

  // Nagłówek panelu mówi, czego dotyczą ustawienia (#115): zaznaczonego elementu, narzędzia (następnych
  // elementów) albo strony, gdy nic nie jest zaznaczone. Rodzaj zmienia też kolor tła nagłówka (CSS).
  _naglowek() {
    const opak = this.tytul?.closest?.('.naglowek-panelu');
    if (!opak) return;
    const e = this.edytor;
    const obj = this.obj;
    let rodzaj = 'element';
    let ik = 'suwaki';
    let nad = 'Zaznaczony element';
    let opis = '';
    if (e.rysuje) { rodzaj = 'narzedzie'; ik = 'rysuj'; nad = 'Ustawienia narzędzia'; opis = 'Tak będą wyglądać następne linie.'; }
    else if (e.pioro) { rodzaj = 'narzedzie'; ik = 'pioro'; nad = 'Ustawienia narzędzia'; opis = 'Klikaj na stronie, żeby stawiać punkty nowego kształtu.'; }
    else if (!obj) { rodzaj = 'strona'; ik = this.tytul.textContent === 'Wzorzec' ? 'wzorzec' : 'strony'; nad = 'Nic nie jest zaznaczone'; }
    else if (toZaznaczenie(obj)) { ik = 'grupuj'; nad = 'Zaznaczone elementy'; }
    else {
      const typ = toKalendarz(obj) ? 'kalendarz' : (toWykres(obj) ? 'wykres' : (toKolaz(obj) ? 'kolaz' : (toTabela(obj) || toTabela(obj.group) ? 'tabela' : (toKod(obj) ? 'kod' : obj.type))));
      ik = {
        kalendarz: 'kalendarz', wykres: 'wykres', kolaz: 'kolaz',
        textbox: 'tekst', 'i-text': 'tekst', text: 'tekst', rect: 'prostokat', ellipse: 'elipsa', circle: 'elipsa',
        polygon: 'wielokat', line: 'linia', image: 'obraz', path: 'pioro', group: 'grupuj', tabela: 'tabela', kod: 'kod',
      }[typ] || 'suwaki';
    }
    opak.dataset.rodzaj = rodzaj;
    let znak = opak.querySelector('.ikona-naglowka');
    if (!znak) {
      znak = document.createElement('span');
      znak.className = 'ikona-naglowka';
      znak.setAttribute('aria-hidden', 'true');
      opak.prepend(znak);
    }
    if (znak.dataset.ik !== ik) { znak.dataset.ik = ik; znak.innerHTML = ikona(ik, { rozmiar: 18 }); }
    let nadEl = opak.querySelector('.nad-tytulem');
    if (!nadEl) {
      nadEl = document.createElement('span');
      nadEl.className = 'nad-tytulem';
      this.tytul.before(nadEl);
    }
    nadEl.textContent = nad;
    let opisEl = opak.querySelector('.opis-naglowka');
    if (!opisEl) {
      opisEl = document.createElement('span');
      opisEl.className = 'opis-naglowka';
      this.tytul.after(opisEl);
    }
    opisEl.textContent = opis;
    opisEl.hidden = !opis;
  }

  _zbuduj() {
    this.el.replaceChildren();
    this.odswiezacze = [];
    const obj = this.obj;
    // Rysowanie odręczne: ustawienia pędzla dla następnych linii (narzędzie, nie zaznaczony element).
    if (this.edytor.rysuje) {
      this.tytul.textContent = 'Rysowanie';
      const e = this.edytor;
      const s = this.sekcja('Pędzel');
      s.append(this.kolor('Kolor linii', () => e.pedzel.kolor, (v) => e.ustawPedzel({ kolor: v }), { bezZatwierdzania: true }));
      s.append(this.liczba('Grubość linii', () => zaokr(e.pedzel.grubosc, 2), (v) => e.ustawPedzel({ grubosc: Math.max(0.1, v) }), { jednostka: 'mm', krok: 0.1, min: 0.1, bezZatwierdzania: true }));
      s.append(this.wskazowka('Przeciągaj po stronie, żeby rysować. Gotową linię zaznaczysz jak każdy element i zmienisz jej kolor i grubość. Esc albo ponowne kliknięcie „Rysuj” kończy rysowanie.'));
      s.append(this.akcje([['zamknij', 'Zakończ rysowanie', () => e.ustawRysowanie(false)]]));
      return;
    }
    // Pióro i edycja punktów kształtu: krótka ściąga zamiast właściwości strony.
    if (this.edytor.pioro) {
      this.tytul.textContent = 'Pióro';
      const s = this.sekcja('Kształt z punktów');
      const ile = this.edytor.punktyPiora;
      s.append(this.wskazowka('Kliknięcie stawia punkt, kliknięcie z przeciągnięciem – punkt z łukiem. Kliknięcie w pierwszy punkt zamyka kształt, Enter albo podwójne kliknięcie kończy otwarty. Backspace cofa ostatni punkt, Esc porzuca kształt.'));
      s.append(this.wskazowka(ile ? `Punktów w zaczętym kształcie: ${ile}.` : 'Kliknij na stronie, żeby zacząć kształt.'));
      s.append(this.akcje([...(ile > 1 ? [['ok', 'Zakończ kształt', () => this.edytor.zakonczKsztaltPiora()]] : []), ['zamknij', 'Wyłącz pióro', () => this.edytor.ustawPioro(false)]]));
      return;
    }
    if (this.edytor.edytujePunkty) {
      this.tytul.textContent = 'Punkty kształtu';
      const s = this.sekcja('Edycja punktów');
      const p = this.edytor.punktyKsztaltu;
      s.append(this.wskazowka('Przeciągaj punkty; zaznaczony punkt krzywej pokazuje uchwyty do zmiany łuku. Podwójne kliknięcie w linię dodaje punkt, Delete usuwa zaznaczony.'));
      s.append(this.wskazowka(`Punktów: ${p.ile}${p.wybrany >= 0 ? ` · zaznaczony ${p.wybrany + 1}` : ''}.`));
      s.append(this.akcje([...(p.wybrany >= 0 ? [['kosz', 'Usuń punkt', () => { if (!this.edytor.usunPunkt()) powiadom('Kształt musi mieć co najmniej dwa punkty (zamknięty – trzy).'); }]] : []), ['ok', 'Gotowe', () => this.edytor.zakonczPunkty(true)], ['zamknij', 'Anuluj', () => this.edytor.zakonczPunkty(false)]]));
      return;
    }
    if (!obj) {
      this.tytul.textContent = this.opcje.tytulPusty();
      this.opcje.budujPusty(this);
      return;
    }
    if (obj.kadr) {
      this.tytul.textContent = 'Kadrowanie';
      const s = this.sekcja('Kadr');
      s.append(this.wskazowka(this.edytor._kadr?.ksztalt
        ? 'Przesuń obraz i powiększ go narożnikami – w kształcie zostaje to, co leży pod nim. Enter zatwierdza, Esc anuluje.'
        : 'Przesuń i rozciągnij ramkę – zostanie tylko jasna część obrazu. Enter zatwierdza, Esc anuluje.'));
      s.append(this.akcje([['ok', 'Zastosuj', () => this.edytor.zakonczKadrowanie(true)], ['zamknij', 'Anuluj', () => this.edytor.zakonczKadrowanie(false)]]));
      return;
    }
    if (toZaznaczenie(obj)) {
      this.tytul.textContent = `Zaznaczone elementy: ${obj.size()}`;
      const s = this.sekcja('Zaznaczenie');
      const wOtwartej = this.edytor.wOtwartejGrupie(obj);
      s.append(this.wskazowka(wOtwartej
        ? 'To elementy otwartej grupy: przesuwasz je razem i wyrównujesz do siebie. „Zgrupuj” zrobi z nich grupę w tej grupie. Esc wraca do całej grupy.'
        : 'Przesuwasz je razem. Zgrupuj, żeby zawsze trzymały się razem.'));
      s.append(this.akcje([['grupuj', 'Zgrupuj', () => this.edytor.grupuj()], ...(wOtwartej ? [['grupuj', 'Wróć do całej grupy', () => this.edytor.zamknijGrupe()]] : []),
        ...(this.opcje.zapiszWBibliotece && !wOtwartej ? [['zapisz_w_bibliotece', 'Zapisz w bibliotece', () => this.opcje.zapiszWBibliotece()]] : [])]));
      if (obj.getObjects().every((o) => o.type === 'textbox')) {
        const p = this.sekcja('Przelewanie tekstu');
        p.append(this.wskazowka('Po połączeniu tekst, który nie mieści się w pierwszej ramce, płynie do następnej (z góry na dół, obok siebie – od lewej).'));
        p.append(this.akcje([['link', 'Połącz ramki tekstu', () => this.edytor.polaczRamki()]]));
      }
      this.zbudujWyrownanie(obj.size());
      this.zbudujGeometrie(obj, { tylkoPozycja: true });
      // Kolejność kilku elementów naraz: przesuwają się razem, między sobą zostają ułożone jak były.
      const kol = this.sekcja('Kolejność');
      const e = this.edytor;
      const seg = this.segmenty('Warstwa', [
        ['naWierzch', 'Na wierzch', null, () => e.warstwa('wierzch')],
        ['wyzej', 'Wyżej', null, () => e.warstwa('wyzej')],
        ['nizej', 'Niżej', null, () => e.warstwa('nizej')],
        ['naSpod', 'Na spód', null, () => e.warstwa('spod')],
      ]);
      seg.classList.add('szeroki');
      kol.append(seg);
      return;
    }
    this.tytul.textContent = nazwaTypu(obj);

    // Komórka tabeli w trakcie pisania: wygląd tekstu tej komórki i działania na jej wierszu i kolumnie.
    if (toTabela(obj.group)) {
      this.zbudujTekst(obj, { komorka: true });
      this.zbudujKomorke(obj);
      return;
    }
    // Element otwartej grupy: zmienia się go bez rozgrupowywania. Ustawienia, które dotyczą całego elementu
    // strony (wyrównanie do marginesów, blokada, zależność od danych, ostrzeżenia), ma grupa.
    const wGrupie = this.edytor.wOtwartejGrupie(obj);
    if (wGrupie) {
      this.tytul.textContent = `${nazwaTypu(obj)} w grupie`;
      const g = this.sekcja('Element grupy');
      g.append(this.wskazowka('Zmieniasz jeden element grupy. Z Shiftem zaznaczysz kilka naraz. Kliknij poza grupą albo naciśnij Esc, żeby grupa znów była jednym elementem.'));
      g.append(this.akcje([['grupuj', 'Wróć do całej grupy', () => this.edytor.zamknijGrupe()]]));
    }
    if (obj.type === 'image') this.zbudujAkcjeObrazu(obj);
    if (toKalendarz(obj)) this.zbudujKalendarz(obj);
    if (toWykres(obj)) this.zbudujWykres(obj);
    if (toKolaz(obj)) this.zbudujKolaz(obj);
    if (toTabela(obj)) this.zbudujTabele(obj);
    if (toKod(obj)) this.zbudujKod(obj);
    if (TEKSTOWE.has(obj.type)) this.zbudujTekst(obj);
    // Rozmiar kodu ustawia się w części „Kod” (QR zostaje kwadratem, rysunek liczy się od nowa).
    this.zbudujGeometrie(obj, { tylkoPozycja: toKod(obj) });
    if (KSZTALTY.has(obj.type)) this.zbudujWypelnienie(obj);
    if (obj.type === 'line' || obj.type === 'path') this.zbudujLinie(obj);
    if (moznaWstawicObraz(obj)) this.zbudujObrazWKsztalcie(obj);
    if (obj.type === 'image') this.zbudujObraz(obj);

    this.zbudujWyrownanie(1);
    this.zbudujKolejnosc(obj);
    this.zbudujMiekkieKrawedzie(obj);
    this.zbudujCien(obj);
    if (!wGrupie) this.zbudujUszlachetnienie(obj);
    if (!wGrupie) this.zbudujZDanych(obj);
    const inne = this.sekcja('Inne');
    if (!wGrupie) inne.append(this.przelacznik('Zablokuj położenie i rozmiar', () => Boolean(obj.zablokowany), (v) => this.edytor.ustawBlokade(obj, v)));
    inne.append(this.tekst('Nazwa elementu (opcjonalnie)', () => obj.nazwa || '', (v) => { obj.nazwa = v || undefined; }, true));
    // Link (#131C): w PDF do czytania na ekranie element jest klikalny (adres strony, e-mail, telefon).
    if (!wGrupie) {
      const link = this.tekst('Link w PDF (adres strony, e-mail)', () => obj.link || '', (v) => { obj.link = String(v || '').trim() || undefined; }, true);
      link.title = 'W pliku PDF do czytania na ekranie kliknięcie elementu otwiera ten adres.';
      inne.append(link);
    }
    inne.append(this.liczba('Krycie', () => zaokr((obj.opacity ?? 1) * 100, 0), (v) => { obj.opacity = Math.min(100, Math.max(0, v)) / 100; }, { jednostka: '%', krok: 5 }));
    // Oblewanie tekstem (#131): teksty na stronie opływają ten element.
    if (obj.type !== 'textbox' && !wGrupie) {
      const ksztalt = ['ellipse', 'circle', 'polygon', 'polyline', 'path'].includes(obj.type);
      const obl = this.wybor('Oblewanie tekstem', [
        ['', 'brak – tekst może na nim leżeć'],
        ['prostokat', 'tekst opływa ramkę elementu'],
        ...(ksztalt ? [['ksztalt', 'tekst opływa kształt']] : []),
        ['skok', 'tekst przeskakuje pod element'],
      ], () => obj.oblewanie || '', (v) => { obj.oblewanie = v || undefined; this.edytor.ulozSkladStrony?.(); setTimeout(() => this.zbuduj()); });
      obl.classList.add('szeroki');
      inne.append(obl);
      if (obj.oblewanie) inne.append(this.liczba('Odstęp tekstu od elementu', () => zaokr(obj.oblewanie_odstep ?? 2, 1), (v) => { obj.oblewanie_odstep = Math.max(0, Math.min(30, v)); this.edytor.ulozSkladStrony?.(); }, { jednostka: 'mm', krok: 0.5, min: 0 }));
    }
    if (wGrupie) return;
    this.opcje.dodatkiElementu?.(this, obj, inne);
    const okl = this.edytor.wydruk?.okladka;
    if (okl) {
      // Okładka (#119): do której części element jest przypięty – przy zmianie grzbietu element grzbietu zostaje
      // na jego środku, a element przodu przesuwa się razem z przodem.
      const auto = STREFY[strefaW(okl, obj.getCenterPoint().x)] || 'Tył';
      inne.append(this.wybor('Na okładce trzyma się', [['auto', `Automatycznie (${auto.toLowerCase()})`], ['tyl', 'Tyłu'], ['grzbiet', 'Grzbietu'], ['przod', 'Przodu']],
        () => obj.okladka || 'auto', (v) => { obj.okladka = v === 'auto' ? undefined : v; }));
      if (obj.type !== 'textbox' && (obj.okladka === 'grzbiet' || (!obj.okladka && strefaW(okl, obj.getCenterPoint().x) === 'grzbiet'))) {
        inne.append(this.przelacznik('Dopasuj szerokość do grzbietu', () => Boolean(obj.okladka_dopasuj), (v) => { obj.okladka_dopasuj = v || undefined; }));
      }
    }
    inne.append(this.przelacznik('Wycisz ostrzeżenia dla tego obiektu', () => Boolean(obj.bez_ostrzezen), (v) => { obj.bez_ostrzezen = v || undefined; }));
  }

  legendaProwadnic(grzbiet = false) {
    const l = this.sekcja('Linie na stronie');
    const legenda = document.createElement('ul');
    legenda.className = 'legenda-prowadnic';
    legenda.innerHTML = '<li><i class="ciecie"></i>Linia cięcia – krawędź strony po przycięciu</li>'
      + '<li><i class="spad"></i>Spad – zostanie odcięty</li>'
      + '<li><i class="margines"></i>Margines – trzymaj w nim teksty</li>'
      + (grzbiet ? '<li><i class="grzbiet"></i>Grzbiet – tu strony są zszyte</li>' : '');
    l.append(legenda);
    l.append(this.wskazowka('Kliknij element na stronie, aby zmienić jego wygląd. Linie nie są drukowane.'));
    this.zbudujProwadnice();
    return l;
  }

  // Własne prowadnice: położenie każdej można wpisać liczbą (mm od lewej albo górnej krawędzi strony).
  zbudujProwadnice() {
    const e = this.edytor;
    const s = this.sekcja('Prowadnice');
    e.prowadnice.forEach((p, i) => {
      const od = p.os === 'x' ? e.strony[p.strona].x : 0;
      const pole = this.liczba(`${p.os === 'x' ? 'Pionowa' : 'Pozioma'}${e.strony.length > 1 ? (p.strona ? ', prawa strona' : ', lewa strona') : ''}`, () => zaokr(p.poz - od, 2), (v) => e.ustawProwadnice(i, v), { jednostka: 'mm', krok: 0.5 });
      const usun = document.createElement('button');
      usun.type = 'button';
      usun.className = 'przycisk-ikona usun-prowadnice';
      usun.title = 'Usuń prowadnicę';
      usun.setAttribute('aria-label', 'Usuń prowadnicę');
      usun.textContent = '×';
      usun.addEventListener('click', () => { e.ustawProwadnice(i, null); this.zbuduj(); });
      pole.querySelector('.jednostka').append(usun);
      s.append(pole);
    });
    const { szerokosc_mm: w, wysokosc_mm: h } = e.wydruk;
    s.append(this.akcje([
      ['plus', 'Pionowa', () => { e.dodajProwadnice('x', zaokr(w / 2, 1)); this.zbuduj(); }],
      ['plus', 'Pozioma', () => { e.dodajProwadnice('y', zaokr(h / 2, 1)); this.zbuduj(); }],
    ]));
    s.append(this.wskazowka(e.prowadnice.length
      ? 'Wpisz położenie w mm od lewej albo górnej krawędzi strony. Prowadnicę można też przeciągnąć na stronie.'
      : 'Dodaj prowadnicę tutaj albo wyciągnij ją z linijki. Elementy przyciągają się do prowadnic.'));
  }

  zbudujWyrownanie(ile) {
    const e = this.edytor;
    const s = this.sekcja(ile > 1 ? 'Wyrównaj do siebie' : 'Wyrównaj do marginesów');
    const wyr = this.segmenty('W poziomie i w pionie', [
      ['wyrownajLewo', 'Do lewej', null, () => e.wyrownaj('lewo')],
      ['wyrownajSrodekX', 'Do środka w poziomie', null, () => e.wyrownaj('srodekX')],
      ['wyrownajPrawo', 'Do prawej', null, () => e.wyrownaj('prawo')],
      ['wyrownajGora', 'Do góry', null, () => e.wyrownaj('gora')],
      ['wyrownajSrodekY', 'Do środka w pionie', null, () => e.wyrownaj('srodekY')],
      ['wyrownajDol', 'Do dołu', null, () => e.wyrownaj('dol')],
    ]);
    wyr.classList.add('szeroki');
    s.append(wyr);
    if (ile > 2) {
      const roz = this.segmenty('Równe odstępy', [
        ['rozlozX', 'Rozłóż równo w poziomie', null, () => e.rozloz('x')],
        ['rozlozY', 'Rozłóż równo w pionie', null, () => e.rozloz('y')],
      ]);
      s.append(roz);
    }
  }

  zbudujKolejnosc(obj) {
    const s = this.sekcja('Kolejność');
    const e = this.edytor;
    const seg = this.segmenty('Warstwa', [
      ['naWierzch', 'Na wierzch', null, () => e.warstwa('wierzch')],
      ['wyzej', 'Wyżej', null, () => e.warstwa('wyzej')],
      ['nizej', 'Niżej', null, () => e.warstwa('nizej')],
      ['naSpod', 'Na spód', null, () => e.warstwa('spod')],
    ]);
    seg.classList.add('szeroki');
    s.append(seg);
    if (obj.type === 'group' && !toTabela(obj) && !toWykres(obj)) {
      // Grupa na arkuszu albo grupa leżąca w otwartej grupie (ta otwiera się jako kolejny poziom).
      s.append(this.akcje([['rozgrupuj', 'Rozgrupuj', () => e.rozgrupuj()], ...(obj.zablokowany ? [] : [['dlon', 'Zmień element grupy', () => e.otworzGrupe(obj)]])]));
      // Grupa z rozłożonego rysunku SVG, który był przycięty jako obraz.
      if (obj.clipPath && !obj.clipPath.absolutePositioned) {
        s.append(this.akcje([['dopasuj', 'Pokaż cały rysunek (zdejmij przycięcie)', () => { obj.set({ clipPath: undefined, dirty: true }); e.canvas.requestRenderAll(); e.oznaczZmiane(); this.zbuduj(); }]]));
      }
      s.append(this.wskazowka(e.wOtwartejGrupie(obj)
        ? 'To grupa w grupie: kliknij ją dwa razy, żeby zmienić jej element. Esc wraca poziom wyżej.'
        : 'Pojedynczy element grupy zmienisz bez rozgrupowywania: kliknij go dwa razy na stronie.'));
    }
  }

  zbudujGeometrie(obj, { tylkoPozycja = false } = {}) {
    const s = this.sekcja('Położenie i rozmiar (mm)');
    s.classList.add('geometria');
    const e = this.edytor;
    // Element grupy ma własne położenie, skalę i kąt liczone względem grupy – w polach są wartości na arkuszu.
    const r = () => e.ukladRodzica(obj);
    s.append(this.liczba('X', () => zaokr(e.polozenieNaArkuszu(obj).x), (v) => e.ustawPolozenieNaArkuszu(obj, { x: v }), { jednostka: 'mm', krotko: 'X' }));
    s.append(this.liczba('Y', () => zaokr(e.polozenieNaArkuszu(obj).y), (v) => e.ustawPolozenieNaArkuszu(obj, { y: v }), { jednostka: 'mm', krotko: 'Y' }));
    if (tylkoPozycja) return;
    if (obj.type === 'line') {
      s.append(this.liczba('Długość', () => zaokr(Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1) * obj.scaleX * r().sx), (v) => {
        const dl = Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1) || 1;
        obj.scaleX = Math.max(0.1, v) / r().sx / dl;
        obj.scaleY = obj.scaleX;
      }, { jednostka: 'mm', min: 0.1, krotko: 'Dł.' }));
    } else {
      s.append(this.liczba('Szerokość', () => zaokr(obj.width * obj.scaleX * r().sx), (v) => {
        if (obj.type === 'textbox') obj.set('width', Math.max(1, v / r().sx));
        else obj.scaleX = Math.max(0.1, v) / r().sx / obj.width;
      }, { jednostka: 'mm', min: 0.1, krotko: 'Szer.' }));
      s.append(this.liczba('Wysokość', () => zaokr(obj.height * obj.scaleY * r().sy), (v) => {
        obj.scaleY = Math.max(0.1, v) / r().sy / obj.height;
      }, { jednostka: 'mm', min: 0.1, wylaczone: obj.type === 'textbox', krotko: 'Wys.' }));
    }
    const kat = (v) => ((v % 360) + 360) % 360;
    s.append(this.liczba('Obrót', () => zaokr(obj.parent ? kat((obj.angle || 0) + r().kat) : (obj.angle || 0), 1), (v) => { obj.rotate(kat(v - r().kat)); }, { jednostka: '°', krok: 1, krotko: 'Obr.' }));
  }

  // ---------- Tekst ----------

  // Zaznaczony fragment podczas pisania na stronie (albo null).
  _fragment(obj) {
    return obj.isEditing && obj.selectionStart !== obj.selectionEnd ? [obj.selectionStart, obj.selectionEnd] : null;
  }

  // Odczyt właściwości tekstu: z zaznaczonego fragmentu albo z całej ramki.
  _czytajTekst(obj, klucz) {
    const f = this._fragment(obj);
    if (!f) return obj[klucz];
    const st = obj.getSelectionStyles(f[0], f[0] + 1, true)[0] || {};
    return st[klucz] ?? obj[klucz];
  }

  // Zapis: na fragment (formatowanie części tekstu) albo na całą ramkę.
  _ustawTekst(obj, wlasciwosci) {
    if (this._fragment(obj)) {
      obj.setSelectionStyles(wlasciwosci);
    } else if (this.edytor.calyTekstZaznaczony && this.edytor.ujednolicCalyTekst(wlasciwosci)) {
      // Cały połączony tekst: ta sama zmiana we wszystkich ramkach wątku, razem z fragmentami o własnym wyglądzie.
    } else {
      for (const k of Object.keys(wlasciwosci)) obj.removeStyle?.(k);
      obj.set(wlasciwosci);
    }
    obj.initDimensions?.();
    obj.dirty = true;
  }

  // ---------- Tabela ----------

  // Kod QR albo kod kreskowy EAN-13 / ISBN (#128): rodzaj, treść, korekcja, kolory, rozmiar, uwagi.
  zbudujKod(obj) {
    const k = () => obj.kod;
    const zmien = (z, przebuduj = false) => {
      this.edytor.zmienKod(z, obj);
      if (przebuduj) this.zbuduj();
    };
    const sek = this.sekcja('Kod');
    sek.append(this.wybor('Rodzaj', [['qr', 'Kod QR'], ['ean', 'Kod kreskowy EAN-13 / ISBN']], () => k().rodzaj, (v) => {
      if (v === k().rodzaj) return;
      const nowy = domyslnyKod(v);
      zmien({ ...nowy, kolor: k().kolor, tlo: k().tlo }, true);
    }));
    if (k().rodzaj === 'qr') {
      const ustawDane = (pole) => (v) => {
        const dane = { ...k().dane, [pole]: v };
        zmien({ dane, tresc: trescQR(k().typ, dane) });
      };
      const dana = (pole) => () => k().dane?.[pole] ?? '';
      sek.append(this.wybor('Co zawiera', [['adres', 'Adres strony'], ['tekst', 'Tekst'], ['email', 'E-mail'], ['telefon', 'Telefon'], ['wifi', 'Sieć Wi-Fi']], () => k().typ, (v) => {
        zmien({ typ: v, tresc: trescQR(v, k().dane) }, true);
      }));
      const typ = k().typ;
      if (typ === 'adres') sek.append(this.tekst('Adres', dana('adres'), ustawDane('adres'), true));
      if (typ === 'tekst') sek.append(this.obszarTekstu('Tekst', dana('tekst'), ustawDane('tekst')));
      if (typ === 'email') {
        sek.append(this.tekst('Adres e-mail', dana('email'), ustawDane('email'), true));
        sek.append(this.tekst('Temat (opcjonalnie)', dana('temat'), ustawDane('temat'), true));
        sek.append(this.tekst('Treść (opcjonalnie)', dana('tresc'), ustawDane('tresc'), true));
      }
      if (typ === 'telefon') sek.append(this.tekst('Numer telefonu', dana('telefon'), ustawDane('telefon'), true));
      if (typ === 'wifi') {
        sek.append(this.tekst('Nazwa sieci', dana('siec'), ustawDane('siec'), true));
        sek.append(this.wybor('Zabezpieczenie', [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['nopass', 'Bez hasła']], () => k().dane?.szyfrowanie || 'WPA', (v) => { ustawDane('szyfrowanie')(v); this.zbuduj(); }));
        if ((k().dane?.szyfrowanie || 'WPA') !== 'nopass') sek.append(this.tekst('Hasło', dana('haslo'), ustawDane('haslo'), true));
        sek.append(this.przelacznik('Sieć ukryta', () => Boolean(k().dane?.ukryta), ustawDane('ukryta')));
      }
      sek.append(this.wybor('Korekcja błędów', [['L', 'Niska (7%) – najmniejszy kod'], ['M', 'Średnia (15%)'], ['Q', 'Wysoka (25%)'], ['H', 'Najwyższa (30%) – np. pod logo']], () => k().korekcja, (v) => zmien({ korekcja: v })));
      sek.append(this.liczba('Rozmiar', () => zaokr(k().szerokosc, 2), (v) => zmien({ szerokosc: Math.max(5, v), wysokosc: Math.max(5, v) }), { jednostka: 'mm', krok: 1, min: 5 }));
    } else {
      sek.append(this.tekst('Numer EAN albo ISBN', () => k().tresc, (v) => zmien({ tresc: v }), true));
      sek.append(this.wskazowka('12 cyfr – cyfra kontrolna dopisze się sama. ISBN wpisz z myślnikami albo bez (978-83-…); stary ISBN-10 zamieni się na ISBN-13.'));
      sek.append(this.przelacznik('Cyfry pod kodem', () => k().napis, (v) => zmien({ napis: v })));
      const rozmiar = this.liczba('Szerokość', () => zaokr(k().szerokosc, 2), (v) => zmien({ szerokosc: Math.max(10, v) }), { jednostka: 'mm', krok: 0.5, min: 10 });
      const wysokosc = this.liczba('Wysokość', () => zaokr(k().wysokosc, 2), (v) => zmien({ wysokosc: Math.max(5, v) }), { jednostka: 'mm', krok: 0.5, min: 5 });
      sek.append(rozmiar, wysokosc);
      sek.append(this.akcje([['dopasuj', 'Rozmiar nominalny (100%)', () => zmien({ szerokosc: Math.round(EAN_NOMINAL.szerokosc * 100) / 100, wysokosc: EAN_NOMINAL.wysokosc })]]));
    }
    sek.append(this.kolor('Kolor kodu', () => k().kolor, (v) => zmien({ kolor: v })));
    sek.append(this.kolor('Tło', () => k().tlo, (v) => zmien({ tlo: v || null }), { brak: true }));
    sek.append(this.przelacznik('Margines ciszy (pusty pas wokół kodu)', () => k().cisza, (v) => zmien({ cisza: v })));
    sek.append(this.wskazowka('Pole z danych, np. {adres} albo {isbn}, w treści daje inny kod na każdej stronie serii.'));
    const uwagi = document.createElement('div');
    uwagi.className = 'uwagi-kodu';
    const odswiezUwagi = () => {
      const lista = uwagiKodu(obj.kod, obj._modulKodu || null);
      if (obj._bladKodu && !lista.includes(obj._bladKodu)) lista.unshift(obj._bladKodu);
      uwagi.replaceChildren(...lista.map((u) => this.wskazowka(u, true)));
    };
    this.odswiezacze.push(odswiezUwagi);
    odswiezUwagi();
    sek.append(uwagi);
  }

  zbudujTabele(obj) {
    const e = this.edytor;
    const t = obj.tabela;
    const zmien = (co, gdzie) => () => { e.zmienTabele(obj, co, gdzie); this.zbuduj(); };
    // Dwie części (#115): „Cała tabela” – zmiany wszystkich wierszy i kolumn naraz; „Kolumna i wiersz” –
    // tylko kolumna i wiersz klikniętej komórki. Bez list wszystkich wierszy, które zagracały panel.
    const kal = toKalendarz(obj);
    const s = this.sekcja(kal ? 'Wymiary kalendarza' : 'Cała tabela');
    if (kal) {
      // Kalendarz: wiersze i kolumny wynikają z miesiąca – zmienia się tylko szerokość i wygląd siatki.
      const szer = () => t.kolumny.reduce((a, b) => a + b, 0);
      s.append(this.liczba('Szerokość kalendarza', () => zaokr(szer(), 1), (v) => {
        const skala = Math.max(5 * t.kolumny.length, v) / szer();
        t.kolumny = t.kolumny.map((x) => zaokr(Math.max(5, x * skala), 2));
      }, { jednostka: 'mm', krok: 1, min: 20 }));
      if (obj.kalendarz.tygodnie) {
        s.append(this.liczba('Szerokość kolumny tygodni', () => zaokr(t.kolumny[0], 1), (v) => { ustawSzerokoscKolumny(obj, 0, v, { kosztemSasiedniej: false }); }, { jednostka: 'mm', krok: 0.5, min: 5 }));
      }
      this.zbudujTabeleWyglad(obj, { bezKoloru: true });
      return;
    }
    s.append(this.wskazowka('Kliknij komórkę, żeby zmienić jej kolumnę i wiersz. Dwa kliknięcia – piszesz w komórce.'));
    // Liczniki „Wiersze [−] 4 [+]” i „Kolumny [−] 3 [+]”: dodają i usuwają ostatni wiersz albo kolumnę.
    const liczniki = document.createElement('div');
    liczniki.className = 'licznik-tabeli';
    liczniki.setAttribute('aria-label', `Wierszy: ${t.wiersze.length}, kolumn: ${t.kolumny.length}.`);
    liczniki.append(
      this.licznikTabeli('Wiersze', t.wiersze.length, ['Usuń ostatni wiersz', zmien('wiersz-')], ['Dodaj wiersz na końcu', zmien('wiersz+')]),
      this.licznikTabeli('Kolumny', t.kolumny.length, ['Usuń ostatnią kolumnę', zmien('kolumna-')], ['Dodaj kolumnę na końcu', zmien('kolumna+')]),
    );
    s.append(liczniki);
    s.append(this.przelacznik('Pierwszy wiersz to nagłówek', () => Boolean(t.naglowek), (v) => ustawNaglowek(obj, v)));
    const szerTabeli = () => t.kolumny.reduce((a, b) => a + b, 0);
    s.append(this.liczba('Szerokość tabeli', () => zaokr(szerTabeli(), 1), (v) => {
      // Wszystkie kolumny rosną albo maleją w tej samej proporcji.
      const skala = Math.max(5 * t.kolumny.length, v) / szerTabeli();
      t.kolumny = t.kolumny.map((x) => zaokr(Math.max(5, x * skala), 2));
    }, { jednostka: 'mm', krok: 1, min: 5 }));
    s.append(this.liczba('Wysokość wierszy', () => zaokr(Math.min(...t.wiersze), 1), (v) => { t.wiersze = t.wiersze.map(() => Math.max(3, v)); }, { jednostka: 'mm', krok: 0.5, min: 3 }));
    s.append(this.wskazowka('Obie liczby dotyczą całej tabeli. Wysokość wierszy to najmniejsza wysokość każdego wiersza – wiersz rośnie sam, gdy tekst się nie mieści.'));
    s.append(this.akcje([['rozlozX', 'Wyrównaj szerokości kolumn', () => {
      const szer = szerTabeli() / t.kolumny.length;
      t.kolumny = t.kolumny.map(() => szer);
      e.zatwierdz();
      this.odswiez();
    }]]));

    // Kolumna i wiersz klikniętej komórki.
    const m = e.wybranaKomorka(obj);
    const kw = this.sekcja('Kolumna i wiersz');
    kw.classList.add('kolumna-i-wiersz');
    if (!m) {
      kw.append(this.wskazowka('Kliknij komórkę tabeli – tu zmienisz szerokość jej kolumny i wysokość jej wiersza, wstawisz albo usuniesz kolumnę i wiersz.'));
    } else {
      const nr = document.createElement('p');
      nr.className = 'wybrana-komorka';
      nr.textContent = `Komórka: kolumna ${m.k + 1}, wiersz ${m.w + 1}${t.naglowek && m.w === 0 ? ' (nagłówek)' : ''}`;
      kw.append(nr);
      kw.append(this.liczba(`Szerokość kolumny ${m.k + 1}`, () => zaokr(t.kolumny[m.k], 1), (v) => { ustawSzerokoscKolumny(obj, m.k, v, { kosztemSasiedniej: false }); }, { jednostka: 'mm', krok: 0.5, min: 5 }));
      kw.append(this.akcje([
        ['plus', 'Kolumna przed', zmien('kolumna+', m.k - 1)],
        ['plus', 'Kolumna po', zmien('kolumna+', m.k)],
        ['kosz', 'Usuń kolumnę', zmien('kolumna-', m.k)],
      ]));
      kw.append(this.liczba(`Wysokość wiersza ${m.w + 1}`, () => zaokr(t.wiersze[m.w], 1), (v) => { ustawWysokoscWiersza(obj, m.w, v); }, { jednostka: 'mm', krok: 0.5, min: 3 }));
      kw.append(this.akcje([
        ['plus', 'Wiersz nad', zmien('wiersz+', m.w - 1)],
        ['plus', 'Wiersz pod', zmien('wiersz+', m.w)],
        ['kosz', 'Usuń wiersz', zmien('wiersz-', m.w)],
      ]));
    }

    // Wszystkie kolumny naraz – zwykle kilka, więc krótka lista; domyślnie zwinięta.
    const k = this.sekcja('Szerokości wszystkich kolumn', { zwinieta: true });
    k.classList.add('kolumny-tabeli');
    t.kolumny.forEach((_, i) => {
      k.append(this.liczba(`${i + 1}`, () => zaokr(t.kolumny[i], 1), (v) => { ustawSzerokoscKolumny(obj, i, v, { kosztemSasiedniej: false }); }, { jednostka: 'mm', krok: 0.5, min: 5 }));
    });
    k.append(this.wskazowka('Granicę kolumn przesuniesz też niebieskim znacznikiem nad zaznaczoną tabelą.'));
    this.zbudujTabeleWyglad(obj);
  }

  // Linie, tła wierszy i tekst komórek – wspólne dla tabeli i kalendarza.
  zbudujTabeleWyglad(obj, { bezKoloru = false } = {}) {
    const t = obj.tabela;
    const l = this.sekcja('Linie tabeli');
    l.append(this.kolor('Kolor linii', () => t.linia?.kolor || '#1a1a1a', (v) => { t.linia = { ...t.linia, kolor: v }; ulozTabele(obj); }));
    l.append(this.liczba('Grubość linii', () => zaokr(t.linia?.grubosc ?? 0.25, 2), (v) => { t.linia = { ...t.linia, grubosc: Math.max(0, v) }; }, { jednostka: 'mm', krok: 0.05, min: 0 }));
    this.zbudujLinieZakresu(obj);

    // Tło wierszy: nagłówek i co drugi wiersz treści.
    const tl = this.sekcja('Tło wierszy');
    const tlo = (klucz, etykieta, domyslny) => {
      tl.append(this.przelacznik(etykieta, () => Boolean(t.tlo?.[klucz]), (v) => { ustawTloTabeli(obj, { [klucz]: v ? domyslny : null }); this.zbuduj(); }));
      if (t.tlo?.[klucz]) tl.append(this.kolor(klucz === 'naglowek' ? 'Kolor tła nagłówka' : 'Kolor tła co drugiego wiersza', () => t.tlo?.[klucz] || domyslny, (v) => ustawTloTabeli(obj, { [klucz]: v })));
    };
    if (t.naglowek) tlo('naglowek', 'Tło wiersza nagłówka', '#e8e6e1');
    tlo('zebra', 'Tło co drugiego wiersza', '#f4f2ee');

    // Wygląd tekstu wszystkich komórek naraz; pojedynczą komórkę zmienia się w trakcie pisania w niej.
    const x = this.sekcja('Tekst w komórkach');
    const komorki = () => komorkiTabeli(obj);
    const wzor = () => komorki()[t.naglowek && t.wiersze.length > 1 ? t.kolumny.length : 0];
    this._czcionkiWLiscie = true;
    const rodziny = this.opcje.czcionki?.() || CZCIONKI.map((c) => c.nazwa);
    const czcionka = this.wybor('Czcionka', rodziny.map((n) => [n, n]), () => wzor().fontFamily, (v) => { ustawTekstTabeli(obj, { fontFamily: v }); this.edytor.doczytajCzcionke(v); });
    this._czcionkiWLiscie = false;
    czcionka.classList.add('szeroki');
    x.append(czcionka);
    const rozmiar = this.liczba('Rozmiar', () => zaokr(mmNaPt(wzor().fontSize), 1), (v) => ustawTekstTabeli(obj, { fontSize: ptNaMm(Math.max(1, v)) }), { jednostka: 'pt', krok: 0.5, min: 1 });
    // Kolory dni kalendarza ustawia się w części „Kolory kalendarza”.
    x.append(bezKoloru ? rozmiar : this._zKolorem(rozmiar, this.kolor('Kolor tekstu', () => wzor().fill, (v) => ustawTekstTabeli(obj, { fill: v }))));
    const wyr = this.segmenty('Wyrównanie', [
      ['doLewej', 'Do lewej', () => wzor().textAlign === 'left', () => ustawTekstTabeli(obj, { textAlign: 'left' })],
      ['doSrodka', 'Do środka', () => wzor().textAlign === 'center', () => ustawTekstTabeli(obj, { textAlign: 'center' })],
      ['doPrawej', 'Do prawej', () => wzor().textAlign === 'right', () => ustawTekstTabeli(obj, { textAlign: 'right' })],
    ]);
    wyr.classList.add('szeroki');
    x.append(wyr);
    const pion = this.segmenty('Tekst w pionie', [
      ['wyrownajGora', 'Do góry komórki', () => !wzor().wyrownanie_pion || wzor().wyrownanie_pion === 'gora', () => ustawTekstTabeli(obj, { wyrownanie_pion: undefined })],
      ['wyrownajSrodekY', 'Na środku komórki', () => wzor().wyrownanie_pion === 'srodek', () => ustawTekstTabeli(obj, { wyrownanie_pion: 'srodek' })],
      ['wyrownajDol', 'Do dołu komórki', () => wzor().wyrownanie_pion === 'dol', () => ustawTekstTabeli(obj, { wyrownanie_pion: 'dol' })],
    ]);
    pion.classList.add('szeroki');
    x.append(pion);
  }

  // ---------- Kalendarz miesiąca, wykres, kolaż (#131A) ----------

  // Kolumny tabel danych projektu jako opcje listy: [['', bez], [kolumna, opis]…].
  _kolumnyDanych(bez = 'Brak') {
    const tabele = this.opcje.projekt?.()?.tabele || [];
    const opcje = [['', bez]];
    const byly = new Set();
    for (const t of tabele) for (const k of t.kolumny) { if (byly.has(k)) continue; byly.add(k); opcje.push([k, tabele.length > 1 ? `${k} (${t.nazwa})` : k]); }
    return opcje;
  }

  zbudujKalendarz(obj) {
    const k = () => obj.kalendarz;
    const zmien = (zmiana) => { obj.kalendarz = { ...obj.kalendarz, ...zmiana }; };
    const s = this.sekcja('Kalendarz');
    s.append(this.wybor('Miesiąc', MIESIACE.map((m, i) => [String(i + 1), m]), () => String(k().miesiac), (v) => zmien({ miesiac: Number(v) })));
    s.append(this.liczba('Rok', () => k().rok, (v) => zmien({ rok: Math.round(v) }), { krok: 1, min: 1600 }));
    s.append(this.wybor('Miesiąc z kolumny danych', this._kolumnyDanych('Nie – stały miesiąc'), () => k().pole_daty || '', (v) => { zmien({ pole_daty: v || undefined }); this.zbuduj(); }));
    if (k().pole_daty) {
      s.append(this.wybor('Rok z kolumny', this._kolumnyDanych('Z tej samej kolumny albo pola „Rok”'), () => k().pole_roku || '', (v) => zmien({ pole_roku: v || undefined })));
      s.append(this.wskazowka('Na każdej stronie serii kalendarz pokazuje miesiąc z tej kolumny – np. „2027-03”, „marzec 2027” albo „3”. W edytorze widać miesiąc z pierwszego wiersza.'));
    }
    s.append(this.wybor('Tydzień zaczyna się od', [['1', 'Poniedziałku'], ['0', 'Niedzieli']], () => String(k().pierwszy), (v) => zmien({ pierwszy: Number(v) })));
    s.append(this.wybor('Nazwy dni', [['pelne', 'Pełne (Poniedziałek)'], ['skrot', 'Skrócone (Pn)'], ['litery', 'Litery (P)']], () => k().nazwy, (v) => zmien({ nazwy: v })));
    s.append(this.wybor('Dni innych miesięcy', [['wyszarz', 'Wyszarzone'], ['pokaz', 'Jak zwykłe dni'], ['ukryj', 'Ukryte']], () => k().inne, (v) => zmien({ inne: v })));
    s.append(this.przelacznik('Nazwa miesiąca nad dniami', () => k().tytul, (v) => zmien({ tytul: v })));
    s.append(this.przelacznik('Numery tygodni', () => k().tygodnie, (v) => { zmien({ tygodnie: v }); this.zbuduj(); }));
    s.append(this.przelacznik('Miejsce na notatki (data w rogu)', () => k().notatki, (v) => zmien({ notatki: v, wiersz_dnia: v ? Math.max(k().wiersz_dnia, 16) : Math.min(k().wiersz_dnia, 9) })));
    s.append(this.liczba('Wysokość wiersza dnia', () => k().wiersz_dnia, (v) => zmien({ wiersz_dnia: Math.max(4, v) }), { jednostka: 'mm', krok: 0.5, min: 4 }));
    const sw = this.sekcja('Święta');
    sw.append(this.przelacznik('Polskie święta (także Wielkanoc i Boże Ciało)', () => k().swieta, (v) => zmien({ swieta: v })));
    sw.append(this.przelacznik('Nazwa święta pod datą', () => k().nazwy_swiat, (v) => zmien({ nazwy_swiat: v })));
    const tabele = this.opcje.projekt?.()?.tabele || [];
    sw.append(this.wybor('Święta z tabeli danych', [['', 'Brak'], ...tabele.map((t) => [t.id, t.nazwa])], () => k().swieta_z?.tabela || '', (v) => {
      const t = tabele.find((x) => x.id === v);
      zmien({ swieta_z: t ? { tabela: t.id, data: t.kolumny.find((n) => /dat/i.test(n)) || t.kolumny[0], nazwa: t.kolumny.find((n) => /naz|swi|świ|opis/i.test(n)) || t.kolumny[1] || '' } : undefined });
      this.zbuduj();
    }));
    const t = tabele.find((x) => x.id === k().swieta_z?.tabela);
    if (t) {
      const opcje = t.kolumny.map((n) => [n, n]);
      sw.append(this.wybor('Kolumna z datą', opcje, () => k().swieta_z.data, (v) => zmien({ swieta_z: { ...k().swieta_z, data: v } })));
      sw.append(this.wybor('Kolumna z nazwą', [['', 'Bez nazwy'], ...opcje], () => k().swieta_z.nazwa || '', (v) => zmien({ swieta_z: { ...k().swieta_z, nazwa: v } })));
      sw.append(this.wskazowka('Daty w postaci 2027-05-26, 26.05.2027 albo 26.05 (co roku). Dni z tabeli dostają kolor świąt.'));
    }
    const kol = this.sekcja('Kolory kalendarza');
    const kolor = (klucz, etykieta, brak = false) => kol.append(this.kolor(etykieta, () => k().kolory?.[klucz] ?? (brak ? null : KOLORY_DOMYSLNE[klucz]), (v) => zmien({ kolory: { ...k().kolory, [klucz]: v || null } }), { brak }));
    kolor('dni', 'Dni');
    kolor('naglowek', 'Nazwa miesiąca i dni tygodnia');
    kolor('niedziele', 'Niedziele', true);
    kolor('soboty', 'Soboty', true);
    kolor('swieta', 'Święta', true);
    kolor('inne', 'Dni innych miesięcy i numery tygodni');
  }

  zbudujWykres(obj) {
    const w = () => normalizujWykres(obj.wykres);
    const zmien = (zmiana) => { obj.wykres = { ...w(), ...zmiana }; };
    const tabele = this.opcje.projekt?.()?.tabele || [];
    const s = this.sekcja('Wykres');
    s.append(this.wybor('Rodzaj', RODZAJE, () => w().rodzaj, (v) => { zmien({ rodzaj: v }); this.zbuduj(); }));
    s.append(this.wybor('Tabela danych', [['', tabele.length ? 'Wybierz tabelę' : 'Brak tabel – dodaj je w „Dane”'], ...tabele.map((t) => [t.id, t.nazwa])], () => w().tabela || '', (v) => {
      const t = tabele.find((x) => x.id === v);
      zmien({ tabela: v || undefined, etykiety: t?.kolumny[0] || '', wartosci: t ? t.kolumny.slice(1, 2) : [] });
      this.zbuduj();
    }));
    const t = tabele.find((x) => x.id === w().tabela);
    if (t) {
      s.append(this.wybor(w().zakres === 'wiersz' ? 'Nazwa serii z kolumny' : 'Podpisy z kolumny', [['', 'Numery wierszy'], ...t.kolumny.map((n) => [n, n])], () => w().etykiety, (v) => zmien({ etykiety: v })));
      const liczby = document.createElement('fieldset');
      liczby.className = 'grupa-pol kolumny-wykresu';
      const leg = document.createElement('legend');
      leg.textContent = 'Liczby z kolumn';
      liczby.append(leg);
      for (const n of t.kolumny) {
        liczby.append(this.przelacznik(n, () => w().wartosci.includes(n), (v) => zmien({ wartosci: v ? t.kolumny.filter((x) => x === n || w().wartosci.includes(x)) : w().wartosci.filter((x) => x !== n) })));
      }
      s.append(liczby);
      s.append(this.wybor('Wiersze', [['wszystkie', 'Wszystkie wiersze tabeli'], ['zakres', 'Wybrane wiersze (od–do)'], ['wiersz', 'Wiersz strony serii']], () => w().zakres, (v) => { zmien({ zakres: v }); this.zbuduj(); }));
      if (w().zakres === 'zakres') {
        s.append(this.liczba('Od wiersza', () => w().od, (v) => zmien({ od: Math.max(1, Math.round(v)) }), { krok: 1, min: 1 }));
        s.append(this.liczba('Do wiersza', () => w().do, (v) => zmien({ do: Math.max(1, Math.round(v)) }), { krok: 1, min: 1 }));
      }
      if (w().zakres === 'wiersz') s.append(this.wskazowka('Kategorie to wybrane kolumny, a liczby – z wiersza tabeli, którego dotyczy strona serii. Każda powielona strona ma swój wykres.'));
    }
    const o = this.sekcja('Opis wykresu');
    o.append(this.tekst('Tytuł (opcjonalnie)', () => w().tytul, (v) => zmien({ tytul: v }), true));
    o.append(this.przelacznik('Liczby przy słupkach i wycinkach', () => w().etykiety_wartosci, (v) => zmien({ etykiety_wartosci: v })));
    if (!['kolo', 'pierscien'].includes(w().rodzaj)) {
      o.append(this.przelacznik('Oś z wartościami', () => w().os, (v) => zmien({ os: v })));
      o.append(this.przelacznik('Linie siatki', () => w().siatka, (v) => zmien({ siatka: v })));
    }
    o.append(this.przelacznik('Legenda', () => w().legenda, (v) => zmien({ legenda: v })));
    const g = this.sekcja('Wygląd wykresu');
    g.append(this.liczba('Szerokość', () => w().szerokosc, (v) => zmien({ szerokosc: Math.max(20, v) }), { jednostka: 'mm', krok: 1, min: 20 }));
    g.append(this.liczba('Wysokość', () => w().wysokosc, (v) => zmien({ wysokosc: Math.max(15, v) }), { jednostka: 'mm', krok: 1, min: 15 }));
    this._czcionkiWLiscie = true;
    const rodziny = this.opcje.czcionki?.() || CZCIONKI.map((c) => c.nazwa);
    const cz = this.wybor('Czcionka', rodziny.map((n) => [n, n]), () => w().czcionka, (v) => { zmien({ czcionka: v }); this.edytor.doczytajCzcionke(v); });
    this._czcionkiWLiscie = false;
    cz.classList.add('szeroki');
    g.append(cz);
    g.append(this._zKolorem(
      this.liczba('Rozmiar pisma', () => zaokr(mmNaPt(w().rozmiar), 1), (v) => zmien({ rozmiar: ptNaMm(Math.max(3, v)) }), { jednostka: 'pt', krok: 0.5, min: 3 }),
      this.kolor('Kolor pisma', () => w().kolor_tekstu, (v) => zmien({ kolor_tekstu: v })),
    ));
    const ile = ['kolo', 'pierscien'].includes(w().rodzaj) ? Math.min(8, Math.max(1, (t?.wiersze.length) || 1)) : Math.max(1, w().wartosci.length);
    for (let i = 0; i < ile; i += 1) {
      g.append(this.kolor(`Kolor ${i + 1}`, () => w().kolory[i] || PALETA[i % PALETA.length], (v) => { const kolory = [...w().kolory]; kolory[i] = v; zmien({ kolory }); }));
    }
  }

  zbudujKolaz(obj) {
    const k = () => obj.kolaz;
    const zmien = (zmiana) => { obj.kolaz = { ...obj.kolaz, ...zmiana }; };
    const s = this.sekcja('Kolaż');
    s.append(this.wybor('Układ', KOLAZE.map((x) => [x.id, x.nazwa]), () => k().uklad, (v) => { this.edytor.zmienUkladKolazu(obj, v); }));
    s.append(this.liczba('Odstęp między zdjęciami', () => k().odstep, (v) => zmien({ odstep: Math.max(0, v) }), { jednostka: 'mm', krok: 0.5, min: 0 }));
    s.append(this.liczba('Zaokrąglenie rogów', () => k().zaokraglenie || 0, (v) => zmien({ zaokraglenie: Math.max(0, v) }), { jednostka: 'mm', krok: 0.5, min: 0 }));
    s.append(this.liczba('Szerokość', () => k().szerokosc, (v) => zmien({ szerokosc: Math.max(10, v) }), { jednostka: 'mm', krok: 1, min: 10 }));
    s.append(this.liczba('Wysokość', () => k().wysokosc, (v) => zmien({ wysokosc: Math.max(10, v) }), { jednostka: 'mm', krok: 1, min: 10 }));
    s.append(this.wskazowka('Upuść zdjęcie z komputera na pole kolażu. Możesz też kliknąć kolaż dwa razy, wybrać pole i w części „Obraz w kształcie” wstawić obraz z projektu.'));
  }

  // Działania na wierszu i kolumnie komórki, w której trwa pisanie.
  zbudujKomorke(obj) {
    const e = this.edytor;
    const tabela = obj.group;
    const m = e.miejsceKomorki(obj);
    if (!m) return;
    const zmien = (co, gdzie) => () => { e.zmienTabele(tabela, co, gdzie); if (this.obj === e.aktywny) this.zbuduj(); };
    // Te same nazwy co przy zaznaczonej tabeli (#115): kolumna i wiersz tej komórki.
    const s = this.sekcja('Kolumna i wiersz');
    s.classList.add('kolumna-i-wiersz');
    const nr = document.createElement('p');
    nr.className = 'wybrana-komorka';
    nr.textContent = `Komórka: kolumna ${m.k + 1}, wiersz ${m.w + 1}`;
    s.append(nr);
    s.append(this.wskazowka('Tab przechodzi do następnej komórki, Esc wraca do całej tabeli.'));
    s.append(this.liczba(`Szerokość kolumny ${m.k + 1}`, () => zaokr(tabela.tabela.kolumny[m.k], 1), (v) => { ustawSzerokoscKolumny(tabela, m.k, v, { kosztemSasiedniej: false }); }, { jednostka: 'mm', krok: 0.5, min: 5 }));
    s.append(this.akcje([['plus', 'Kolumna przed', zmien('kolumna+', m.k - 1)], ['plus', 'Kolumna po', zmien('kolumna+', m.k)], ['kosz', 'Usuń kolumnę', zmien('kolumna-', m.k)]]));
    // Scalanie: komórka rośnie o sąsiednią po prawej albo poniżej; „Rozdziel” przywraca osobne komórki.
    const sc = e.scalenieKomorki(obj);
    const zajete = sc || { w: m.w, k: m.k, ileW: 1, ileK: 1 };
    const scalanie = [];
    if (zajete.k + zajete.ileK < tabela.tabela.kolumny.length) scalanie.push(['grupuj', 'Scal z komórką po prawej', zmien('scal-prawo', m)]);
    if (zajete.w + zajete.ileW < tabela.tabela.wiersze.length) scalanie.push(['grupuj', 'Scal z komórką poniżej', zmien('scal-dol', m)]);
    if (sc) scalanie.push(['rozgrupuj', 'Rozdziel komórki', zmien('rozdziel', m)]);
    if (scalanie.length) s.append(this.akcje(scalanie));
    if (sc) s.append(this.wskazowka(`Ta komórka zajmuje ${sc.ileK} ${sc.ileK === 1 ? 'kolumnę' : 'kolumny'} i ${sc.ileW} ${sc.ileW === 1 ? 'wiersz' : 'wiersze'}. Tekst komórek, które przykryła, jest w niej dopisany; po rozdzieleniu cały zostaje w pierwszej komórce.`));
    s.append(this.liczba(`Wysokość wiersza ${m.w + 1}`, () => zaokr(tabela.tabela.wiersze[m.w], 1), (v) => { ustawWysokoscWiersza(tabela, m.w, v); }, { jednostka: 'mm', krok: 0.5, min: 3 }));
    s.append(this.wskazowka(`Teraz ten wiersz ma ${zaokr(wysokosciWierszy(tabela)[m.w], 1)} mm – rośnie razem z tekstem.`));
    s.append(this.akcje([['plus', 'Wiersz nad', zmien('wiersz+', m.w - 1)], ['plus', 'Wiersz pod', zmien('wiersz+', m.w)], ['kosz', 'Usuń wiersz', zmien('wiersz-', m.w)]]));

    // Linie tej jednej komórki: każda krawędź osobno – jak w całej tabeli, bez linii albo własna.
    const lin = this.sekcja('Linie tej komórki');
    const przebuduj = () => { if (this.obj === e.aktywny) this.zbuduj(); };
    for (const [strona, nazwa] of [['gora', 'U góry'], ['dol', 'U dołu'], ['lewo', 'Z lewej'], ['prawo', 'Z prawej']]) {
      const jaka = () => krawedzKomorki(tabela, m.w, m.k, strona);
      const rodzaj = () => (!jaka().wlasna ? '' : (jaka().grubosc > 0 ? 'wlasna' : 'brak'));
      const wybor = this.wybor(nazwa, [['', 'jak w tabeli'], ['brak', 'bez linii'], ['wlasna', 'własna']], rodzaj, (v) => {
        const siatka = tabela.tabela.linia?.grubosc ?? 0.25;
        ustawKrawedzKomorki(tabela, m.w, m.k, strona, v === '' ? null : { grubosc: v === 'brak' ? 0 : Math.max(0.5, zaokr(siatka * 3, 2)) });
        przebuduj();
      });
      wybor.dataset.krawedz = strona;
      if (rodzaj() !== 'wlasna') wybor.classList.add('szeroki');
      lin.append(wybor);
      if (rodzaj() !== 'wlasna') continue;
      lin.append(this.kolor('Kolor', () => jaka().kolor, (v) => ustawKrawedzKomorki(tabela, m.w, m.k, strona, { kolor: v })));
      const grubosc = this.liczba(`Grubość (${nazwa.toLowerCase()})`, () => zaokr(jaka().grubosc, 2), (v) => { ustawKrawedzKomorki(tabela, m.w, m.k, strona, { grubosc: Math.max(0.05, v) }); }, { jednostka: 'mm', krok: 0.05, min: 0.05 });
      grubosc.classList.add('szeroki');
      lin.append(grubosc);
    }
    lin.append(this.wskazowka('Krawędź jest wspólna z sąsiednią komórką – zmienia się u obu.'));
    this.zbudujLinieZakresu(tabela, m);
  }

  // Linie wielu komórek naraz: obramowanie i linie wewnętrzne całego wiersza, kolumny albo tabeli.
  // m: miejsce komórki, w której trwa pisanie ({ w, k }) – bez niego (zaznaczona cała tabela) zakresem jest tabela.
  zbudujLinieZakresu(tabela, m = null) {
    const e = this.edytor;
    const st = this._linieZakresu || (this._linieZakresu = { zakres: 'wiersz', czesc: 'obramowanie', grubosc: 0.5, kolor: '#1a1a1a' });
    const zakres = () => (m ? st.zakres : 'tabela');
    const s = this.sekcja(m ? 'Linie wiersza, kolumny, tabeli' : 'Obramowanie i linie wewnętrzne');
    s.dataset.linieZakresu = '';
    if (m) {
      const gdzie = this.wybor('Zastosuj do', [['wiersz', 'tego wiersza'], ['kolumna', 'tej kolumny'], ['tabela', 'całej tabeli']], () => st.zakres, (v) => { st.zakres = v; });
      gdzie.classList.add('szeroki');
      gdzie.dataset.linie = 'zakres';
      s.append(gdzie);
    }
    const ktore = this.wybor('Które linie', [['obramowanie', 'obramowanie (linie zewnętrzne)'], ['poziome', 'wewnętrzne poziome'], ['pionowe', 'wewnętrzne pionowe'], ['wszystkie', 'wszystkie']], () => st.czesc, (v) => { st.czesc = v; });
    ktore.classList.add('szeroki');
    ktore.dataset.linie = 'czesc';
    s.append(ktore);
    const kolor = this.kolor('Kolor', () => st.kolor, (v) => { st.kolor = v; }, { bezZatwierdzania: true });
    kolor.dataset.linie = 'kolor';
    s.append(kolor);
    const grubosc = this.liczba('Grubość', () => st.grubosc, (v) => { st.grubosc = Math.max(0.05, zaokr(v, 2)); }, { jednostka: 'mm', krok: 0.05, min: 0.05 });
    grubosc.dataset.linie = 'grubosc';
    s.append(grubosc);
    // linia: funkcja zwracająca ustawienie w chwili kliknięcia (kolor i grubość mogły się zmienić).
    const zastosuj = (linia) => () => {
      ustawLinieZakresu(tabela, zakres(), m || {}, st.czesc, linia());
      e.canvas.requestRenderAll();
      e.zatwierdz();
      this.zbuduj();
    };
    const przyciski = this.akcje([
      ['ok', 'Ustaw te linie', zastosuj(() => ({ grubosc: st.grubosc, kolor: st.kolor }))],
      ['minus', 'Bez linii', zastosuj(() => ({ grubosc: 0 }))],
      ['cofnij', 'Jak w tabeli', zastosuj(() => null)],
    ]);
    przyciski.dataset.linie = 'przyciski';
    s.append(przyciski);
    s.append(this.wskazowka(m
      ? 'Ustawia naraz linie wybranej części: całego wiersza, kolumny albo tabeli. „Jak w tabeli” zdejmuje własne ustawienia tych linii.'
      : 'Ustawia naraz obramowanie albo linie wewnętrzne całej tabeli – niezależnie od koloru i grubości siatki powyżej. Linie wiersza, kolumny i pojedynczej komórki ustawisz w trakcie pisania w komórce.'));
  }

  zbudujTekst(obj, { komorka = false } = {}) {
    const czytaj = (k) => this._czytajTekst(obj, k);
    const ustaw = (w) => this._ustawTekst(obj, w);

    if (obj.ksiazka && !komorka) this.zbudujElementKsiazki(obj);
    this.zbudujStyl(obj);

    const s = this.sekcja('Tekst');
    // Edycja treści w zwykłym polu – wygodniejsze na telefonie niż na płótnie (4.7).
    s.append(this.obszarTekstu('Treść', () => obj.text, (v) => obj.set('text', v)));
    s.append(this.wstawianiePola());
    // Klamry pokazują się tylko wtedy, gdy są w tekście – inaczej przełącznik tylko by zawadzał.
    if (obj.text.includes('{') || obj.bez_pol) {
      s.append(this.przelacznik('Klamry { } to zwykły tekst, nie pola', () => Boolean(obj.bez_pol), (v) => { obj.bez_pol = v || undefined; obj.dirty = true; }));
    }

    const fragment = this.wskazowka('Zmieniasz tylko zaznaczony fragment tekstu.');
    fragment.classList.add('znacznik-fragmentu');
    this.odswiezacze.push(() => { fragment.hidden = !this._fragment(obj); });
    fragment.hidden = !this._fragment(obj);
    s.append(fragment);

    this._czcionkiWLiscie = true;
    // Własne czcionki projektu, potem wbudowane; ostatnia pozycja wgrywa nowe pliki.
    const rodziny = this.opcje.czcionki?.() || CZCIONKI.map((c) => c.nazwa);
    // „Moje czcionki” – wgrane kiedyś w innym projekcie; wybranie dodaje je do tego projektu.
    const moje = (this.opcje.mojeCzcionki?.() || []).map((n) => [`moja:${n}`, `${n} – z moich czcionek`]);
    // Użyte w projekcie (#136): na górze listy, z liczbą użyć – szybki powrót do czcionek dokumentu.
    const uzyte = uzyteCzcionki(this.opcje.projekt?.()).filter((c) => rodziny.includes(c.nazwa)).slice(0, 6);
    // Marka (#131D): czcionki zestawu marki na samej górze (nagłówki, tekst).
    const { naglowek: mNag, tekst: mTekst } = biezacaMarka().czcionki;
    const wMarce = [[mNag, 'nagłówki'], [mTekst, 'tekst']].filter(([n], i, t) => n && t.findIndex(([m]) => m === n) === i)
      .map(([n, rola]) => (rodziny.includes(n) ? [n, `${n} · marka (${rola})`] : (this.opcje.mojeCzcionki?.() || []).includes(n) ? [`moja:${n}`, `${n} · marka (${rola})`] : null)).filter(Boolean);
    const grupy = [
      ...(wMarce.length ? [{ grupa: 'Marka', opcje: wMarce }] : []),
      ...(uzyte.length ? [{ grupa: 'Użyte w projekcie', opcje: uzyte.map((c) => [c.nazwa, `${c.nazwa} · ${c.ile}×`]) }] : []),
    ];
    const listaCzcionek = grupy.length
      ? [...grupy, { grupa: 'Wszystkie czcionki', opcje: [...rodziny.map((n) => [n, n]), ...moje] }]
      : [...rodziny.map((n) => [n, n]), ...moje];
    const czcionka = this.wybor('Czcionka', [...listaCzcionek, ...(this.opcje.wgrajCzcionke ? [['+', '+ Wgraj własną czcionkę…']] : [])], () => czytaj('fontFamily'), (v) => {
      if (v === '+') { this.opcje.wgrajCzcionke(); return; }
      if (v.startsWith('moja:')) { this.opcje.dodajMojaCzcionke(v.slice(5)); return; }
      // Czcionka bez pogrubienia albo kursywy: tekst wraca do odmiany, którą czcionka ma (bez „udawanej”).
      const ma = this.opcje.odmianyCzcionki?.(v) || { pogrubiona: true, kursywa: true };
      ustaw({ fontFamily: v, ...(ma.pogrubiona ? {} : { fontWeight: 'normal' }), ...(ma.kursywa ? {} : { fontStyle: 'normal' }) });
      this.edytor.doczytajCzcionke(v); // pliki czcionki pobierają się przy pierwszym użyciu
    });
    this._czcionkiWLiscie = false;
    czcionka.classList.add('szeroki');
    s.append(czcionka);
    // Przy autodopasowaniu pole pokazuje rozmiar zadany; tekst może być mniejszy, gdy się nie mieści.
    const zadany = () => (obj.autodopasowanie && obj.rozmiar_bazowy && !this._fragment(obj) ? obj.rozmiar_bazowy : czytaj('fontSize'));
    s.append(this._zKolorem(this.liczba('Rozmiar', () => zaokr(mmNaPt(zadany() * obj.scaleY), 1), (v) => {
      const rozmiar = ptNaMm(Math.max(1, v)) / obj.scaleY;
      if (!this._fragment(obj) && obj.rozmiar_bazowy) obj.rozmiar_bazowy = rozmiar;
      ustaw({ fontSize: rozmiar });
    }, { jednostka: 'pt', krok: 0.5, min: 1 }), this.kolor('Kolor tekstu', () => czytaj('fill'), (v) => ustaw({ fill: v }))));
    s.append(this.liczba('Interlinia', () => zaokr(obj.lineHeight, 2), (v) => obj.set('lineHeight', Math.max(0.5, v)), { krok: 0.05, min: 0.5 }));
    // Odstęp między literami w tysięcznych wysokości pisma (jak w programach DTP).
    s.append(this.liczba('Odstęp liter', () => Math.round(obj.charSpacing || 0), (v) => obj.set('charSpacing', Math.max(-200, Math.min(2000, v))), { jednostka: '‰', krok: 10 }));
    // Obrys liter (#123): kontur wokół liter, rysowany pod wypełnieniem – litery nie chudną.
    if (!komorka) {
      s.append(this.kolor('Obrys liter', () => (obj.strokeWidth > 0 ? obj.stroke : ''), (v) => {
        obj.set(v ? { stroke: v, strokeWidth: obj.strokeWidth > 0 ? obj.strokeWidth : 0.3, paintFirst: 'stroke', strokeUniform: true } : { stroke: null, strokeWidth: 0, paintFirst: 'fill' });
        setTimeout(() => this.zbuduj());
      }, { brak: true }));
      if (obj.strokeWidth > 0) s.append(this.liczba('Grubość obrysu liter', () => zaokr(obj.strokeWidth, 2), (v) => obj.set({ strokeWidth: Math.max(0.05, Math.min(5, v)) }), { jednostka: 'mm', krok: 0.1, min: 0.05 }));
    }

    const przelacz = (k, wl, wyl) => () => ustaw({ [k]: czytaj(k) === wl ? wyl : wl });
    const styl = this.segmenty('Wygląd liter', [
      ['pogrubienie', 'Pogrubienie', () => czytaj('fontWeight') === 'bold' || czytaj('fontWeight') >= 600, przelacz('fontWeight', 'bold', 'normal')],
      ['kursywa', 'Kursywa', () => czytaj('fontStyle') === 'italic', przelacz('fontStyle', 'italic', 'normal')],
      ['podkreslenie', 'Podkreślenie', () => Boolean(czytaj('underline')), przelacz('underline', true, false)],
      ['przekreslenie', 'Przekreślenie', () => Boolean(czytaj('linethrough')), przelacz('linethrough', true, false)],
    ]);
    styl.classList.add('szeroki');
    s.append(styl);
    // Pogrubienie i kursywa są wyszarzone, gdy czcionka nie ma takiej odmiany (włączoną zawsze da się wyłączyć).
    const [przPogrubienie, przKursywa] = styl.querySelectorAll('button');
    const odmiany = () => {
      const rodzina = czytaj('fontFamily');
      const ma = this.opcje.odmianyCzcionki?.(rodzina) || { pogrubiona: true, kursywa: true };
      for (const [b, jest, nazwa, opis] of [[przPogrubienie, ma.pogrubiona, 'Pogrubienie', 'odmiany pogrubionej'], [przKursywa, ma.kursywa, 'Kursywa', 'kursywy']]) {
        const wlaczona = b.classList.contains('aktywny');
        b.disabled = !jest && !wlaczona;
        b.title = jest ? nazwa : `Czcionka „${rodzina}” nie ma ${opis}`;
      }
    };
    this.odswiezacze.push(odmiany);
    odmiany();

    const wyr = this.segmenty('Wyrównanie', [
      ['doLewej', 'Do lewej', () => obj.textAlign === 'left', () => obj.set('textAlign', 'left')],
      ['doSrodka', 'Do środka', () => obj.textAlign === 'center', () => obj.set('textAlign', 'center')],
      ['doPrawej', 'Do prawej', () => obj.textAlign === 'right', () => obj.set('textAlign', 'right')],
      ['wyjustuj', 'Wyjustuj', () => obj.textAlign === 'justify', () => obj.set('textAlign', 'justify')],
    ]);
    wyr.classList.add('szeroki');
    s.append(wyr);
    const lista = this.wybor('Lista', [['', 'Brak'], ['punkty', '• Punkty'], ['kreski', '– Kreski'], ['numery', '1. Numery']], () => obj.lista || '', (v) => obj.set('lista', v || undefined));
    lista.classList.add('szeroki');
    s.append(lista);

    // Wielkość liter to wygląd: treść zostaje taka, jak wpisana (pola w klamrach działają bez zmian).
    const wielkosc = (v) => () => { obj.set('wielkosc_liter', obj.wielkosc_liter === v ? undefined : v); };
    const zmienLitery = (fn) => () => { obj.set('wielkosc_liter', undefined); obj.set('text', obj.text.split(/(\{[^{}\n]*\})/).map((cz, i) => (i % 2 ? cz : fn(cz))).join('')); obj.initDimensions?.(); };
    const litery = this.segmenty('Wielkość liter', [
      ['AA', 'WSZYSTKIE WIELKIE – tylko wygląd, treść zostaje', () => obj.wielkosc_liter === 'wielkie', wielkosc('wielkie')],
      ['aa', 'wszystkie małe – tylko wygląd, treść zostaje', () => obj.wielkosc_liter === 'male', wielkosc('male')],
      ['Aᴀ', 'Kapitaliki: małe litery jako mniejsze wielkie – tylko wygląd, treść zostaje', () => obj.wielkosc_liter === 'kapitaliki', wielkosc('kapitaliki')],
      ['Aa', 'Jak w zdaniu – zmienia treść (wielka litera na początku zdań)', null, zmienLitery((t) => t.toLocaleLowerCase('pl').replace(/(^|[.!?]\s+|\n)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('pl')))],
    ], true);
    litery.classList.add('szeroki');
    s.append(litery);

    // Komórka tabeli nie ma własnej ramki ani przelewania – jej rozmiarem rządzi tabela.
    if (komorka) return;

    this.zbudujKsztaltTekstu(obj);
    this.zbudujSklad(obj);
    if (!obj.ksiazka) this.zbudujKsiazke(obj);
    if (!obj.ksiazka) this.zbudujPisownie(obj);

    // Przelewanie: połączone ramki i kolumny.
    const w = this.sekcja('Przelewanie tekstu');
    const watek = this.edytor.watekRamki(obj);
    const naStronie = Boolean(this.opcje.naStronie?.() && this.opcje.ramkaNaNastepnejStronie);
    const dalejNaStronie = naStronie ? [['plus', 'Ciąg dalszy na następnej stronie', () => this.opcje.ramkaNaNastepnejStronie()]] : [];
    if (watek) {
      const strony = watek.innychStron ? ` Część ramek leży na ${watek.innychStron === 1 ? 'innej stronie' : `innych stronach (${watek.innychStron})`}.` : '';
      w.append(this.wskazowka(`Ramka ${watek.nr} z ${watek.ile} połączonych.${strony} Tekst, który się tu nie mieści, płynie do następnej; wygląd tekstu jest wspólny dla wszystkich.`));
      // Sąsiednie ramki z innych stron: przejście jednym kliknięciem.
      const skoki = [];
      if (watek.poprzednia) skoki.push(['wstecz', `Poprzednia ramka: strona ${this.opcje.nazwaStrony?.(watek.poprzednia.strona) || ''}`, () => this.opcje.przejdzDoRamki?.(watek.poprzednia.strona, watek.poprzednia.id)]);
      if (watek.nastepna) skoki.push(['dalej', `Następna ramka: strona ${this.opcje.nazwaStrony?.(watek.nastepna.strona) || ''}`, () => this.opcje.przejdzDoRamki?.(watek.nastepna.strona, watek.nastepna.id)]);
      if (skoki.length) w.append(this.akcje(skoki));
      // Cały połączony tekst naraz: wygląd, kopia, usunięcie (zaznaczenia w tekście nie da się rozciągnąć przez ramki).
      if (this.edytor.calyTekstZaznaczony) {
        const caly = this.wskazowka(`Zaznaczony jest cały połączony tekst (${watek.ile} ${watek.ile < 5 ? 'ramki' : 'ramek'}). Zmiana wyglądu obejmie wszystkie ramki, także fragmenty z własnym wyglądem. Ctrl+C kopiuje cały tekst, Delete go usuwa (ramki zostają).`);
        caly.classList.add('znacznik-fragmentu');
        caly.dataset.calyTekst = '';
        w.append(caly);
        w.append(this.akcje([
          ['kopiuj', 'Kopiuj cały tekst', async () => { await this.edytor.kopiuj(); powiadom('Skopiowano cały połączony tekst.'); }],
          ['kosz', 'Usuń cały tekst', () => this.edytor.usunCalyTekst()],
        ]));
      } else if (!obj.isEditing || obj.selectionStart === obj.selectionEnd) {
        w.append(this.akcje([['tekst', 'Zaznacz cały połączony tekst', () => { this.edytor.zaznaczCalyTekst(obj); }]]));
      }
      w.append(this.akcje([
        ['plus', 'Dodaj ramkę z ciągiem dalszym', () => this.edytor.dodajRamkeDalsza()],
        ...dalejNaStronie,
        ['rozgrupuj', 'Rozłącz ramki', () => this.edytor.rozlaczRamki()],
      ]));
    } else {
      w.append(this.akcje([['plus', 'Dodaj ramkę z ciągiem dalszym', () => this.edytor.dodajRamkeDalsza()], ...dalejNaStronie]));
      const kolumny = (n) => async () => { if (!await this.edytor.podzielNaKolumny(n)) powiadom('Ramka jest za wąska na tyle kolumn.'); };
      const podzial = this.segmenty('Podziel na kolumny', [['2', '2 kolumny', null, kolumny(2)], ['3', '3 kolumny', null, kolumny(3)], ['4', '4 kolumny', null, kolumny(4)]], true);
      podzial.classList.add('szeroki');
      w.append(podzial);
      w.append(this.wskazowka('Kolumny to połączone ramki obok siebie. Dwie istniejące ramki połączysz, zaznaczając je razem.'));
    }

    // Ramka: stała wysokość, wyrównanie w pionie, zmniejszanie tekstu, który się nie mieści.
    const r = this.sekcja('Ramka tekstu');
    const przelicz = () => { obj.initDimensions(); obj.setCoords(); };
    const stala = this.przelacznik('Stała wysokość ramki', () => obj.ramka_h > 0, (v) => {
      if (!v && obj.watek) { powiadom('Połączona ramka ma stałą wysokość – inaczej tekst nie miałby dokąd płynąć.'); this.zbuduj(); return; }
      obj.ramka_h = v ? Math.max(obj._wysokoscTresci || obj.height, 3) : undefined;
      if (!v) { obj.autodopasowanie = undefined; if (obj.rozmiar_bazowy) obj.fontSize = obj.rozmiar_bazowy; obj.rozmiar_bazowy = undefined; }
      przelicz();
      this.zbuduj();
    });
    r.append(stala);
    if (obj.ramka_h > 0) {
      r.append(this.liczba('Wysokość ramki', () => zaokr(obj.ramka_h * obj.scaleY, 1), (v) => { obj.ramka_h = Math.max(1, v) / obj.scaleY; przelicz(); }, { jednostka: 'mm', krok: 1, min: 1 }));
      const pion = this.segmenty('Tekst w pionie', [
        ['wyrownajGora', 'Do góry ramki', () => !obj.wyrownanie_pion || obj.wyrownanie_pion === 'gora', () => { obj.wyrownanie_pion = undefined; przelicz(); }],
        ['wyrownajSrodekY', 'Na środku ramki', () => obj.wyrownanie_pion === 'srodek', () => { obj.wyrownanie_pion = 'srodek'; przelicz(); }],
        ['wyrownajDol', 'Do dołu ramki', () => obj.wyrownanie_pion === 'dol', () => { obj.wyrownanie_pion = 'dol'; przelicz(); }],
      ]);
      r.append(pion);
      if (!obj.watek) r.append(this.przelacznik('Zmniejszaj tekst, gdy się nie mieści', () => Boolean(obj.autodopasowanie), (v) => {
        obj.autodopasowanie = v || undefined;
        if (v) { obj.rozmiar_bazowy = obj.fontSize; obj.min_rozmiar = obj.min_rozmiar || 6; } else { if (obj.rozmiar_bazowy) obj.fontSize = obj.rozmiar_bazowy; obj.rozmiar_bazowy = undefined; }
        przelicz();
        this.zbuduj();
      }));
      if (obj.autodopasowanie) {
        r.append(this.liczba('Najmniejszy rozmiar', () => obj.min_rozmiar || 6, (v) => { obj.min_rozmiar = Math.max(1, v); przelicz(); }, { jednostka: 'pt', krok: 0.5, min: 1 }));
      }
      r.append(this.wskazowka('Tekst dłuższy niż ramka jest ucinany na jej dolnej krawędzi – aplikacja o tym ostrzega. Przy danych z tabeli ramka trzyma układ strony niezależnie od długości tekstu.'));
    } else {
      r.append(this.wskazowka('Bez stałej wysokości ramka rośnie razem z tekstem.'));
    }
  }

  // Kolor, położenie, rozmiar, obrót i widoczność elementu zależne od pola z danych (tabela albo pole dokumentu).
  zbudujZDanych(obj) {
    const grupy = this.opcje.pola?.() || [];
    const pola = grupy.flatMap((g) => g.pola.map(([nazwa]) => nazwa));
    const s = this.sekcja('Z danych');
    const z = () => obj.z_danych || {};
    const zapisz = (zmiana) => {
      const nowe = { ...z(), ...zmiana };
      for (const k of Object.keys(nowe)) if (!nowe[k] || (typeof nowe[k] === 'object' && !nowe[k].pole)) delete nowe[k];
      if (!nowe.szer && !nowe.wys) delete nowe.kotwica; // punkt zaczepienia ma sens tylko przy rozmiarze z danych
      if (!nowe.kolor) delete nowe.kolor_w;
      obj.z_danych = Object.keys(nowe).length ? nowe : undefined;
    };
    // Na liście: pola dostępne na tej stronie i to, które jest już ustawione (nawet nieznane).
    const lista = (wybrane) => [['', '— nie zależy od danych —'], ...[...new Set([...pola, ...(wybrane ? [wybrane] : [])])].map((n) => [n, `{${n}}`])];
    if (obj.type !== 'image') {
      // Wypełnienie przejściem kolorów: kolor z danych domyślnie zmienia pierwszy kolor, a przejście zostaje.
      const przejscie = maPrzejscie(obj);
      const kolor = this.wybor('Kolor z pola', lista(z().kolor), () => z().kolor || '', (v) => {
        zapisz({ kolor: v || undefined, ...(v && przejscie && !z().kolor ? { kolor_w: 'pierwszy' } : {}) });
        this.zbuduj();
      });
      kolor.classList.add('szeroki');
      s.append(kolor);
      if (z().kolor && przejscie) {
        const gdzie = this.wybor('W przejściu kolorów pole zmienia', [['pierwszy', 'pierwszy kolor (reszta zostaje)'], ['ostatni', 'ostatni kolor (reszta zostaje)'], ['odcienie', 'całe przejście – odcienie koloru z pola'], ['', 'całe wypełnienie – jeden kolor, bez przejścia']], () => z().kolor_w || '', (v) => zapisz({ kolor_w: v || undefined }));
        gdzie.classList.add('szeroki');
        s.append(gdzie);
      }
    }
    for (const [os, etykieta] of [['y', 'Przesunięcie w pionie z pola'], ['x', 'Przesunięcie w poziomie z pola']]) {
      const ust = () => z()[os] || {};
      const wybor = this.wybor(etykieta, lista(ust().pole), () => ust().pole || '', (v) => {
        zapisz({ [os]: v ? { tryb: 'pozycja', krok: 10, co: 0, ...ust(), pole: v } : undefined });
        this.zbuduj();
      });
      wybor.classList.add('szeroki');
      s.append(wybor);
      if (!ust().pole) continue;
      const tryb = this.wybor('Wartość pola to', [['pozycja', 'numer pozycji (1, 2, 3…)'], ['mm', 'przesunięcie w mm']], () => ust().tryb || 'pozycja', (v) => { zapisz({ [os]: { ...ust(), tryb: v } }); this.zbuduj(); });
      tryb.classList.add('szeroki');
      s.append(tryb);
      if ((ust().tryb || 'pozycja') === 'pozycja') {
        s.append(this.liczba('Krok', () => ust().krok ?? 10, (v) => zapisz({ [os]: { ...ust(), krok: v } }), { jednostka: 'mm', krok: 1 }));
        s.append(this.liczba('Od nowa co', () => ust().co || 0, (v) => zapisz({ [os]: { ...ust(), co: Math.max(0, Math.round(v)) } }), { jednostka: 'poz.', krok: 1, min: 0 }));
      }
    }
    // Rozmiar: szerokość i wysokość z pola z liczbą – procent rozmiaru wzoru albo milimetry, każdy wymiar osobno.
    const bezWysokosci = obj.type === 'textbox' && !(obj.ramka_h > 0); // wysokość takiego tekstu wynika z treści
    for (const [wymiar, etykieta] of [['szer', 'Szerokość z pola'], ['wys', 'Wysokość z pola']]) {
      if (wymiar === 'wys' && bezWysokosci && !z().wys) continue;
      const ust = () => z()[wymiar] || {};
      const wybor = this.wybor(etykieta, lista(ust().pole), () => ust().pole || '', (v) => {
        zapisz({ [wymiar]: v ? { tryb: 'procent', ...ust(), pole: v } : undefined });
        this.zbuduj();
      });
      wybor.classList.add('szeroki');
      s.append(wybor);
      if (!ust().pole) continue;
      const tryb = this.wybor(`${wymiar === 'szer' ? 'Szerokość' : 'Wysokość'}: wartość pola to`, [['procent', 'procent rozmiaru wzoru (100 = bez zmian)'], ['mm', 'rozmiar w mm']], () => ust().tryb || 'procent', (v) => zapisz({ [wymiar]: { ...ust(), tryb: v } }));
      tryb.classList.add('szeroki');
      s.append(tryb);
    }
    if (z().szer || z().wys) {
      const kotwica = this.wybor('Przy zmianie rozmiaru na miejscu zostaje', [['', 'lewy górny róg'], ['srodek', 'środek elementu'], ['dol', 'dół (środek dolnej krawędzi)']], () => z().kotwica || '', (v) => zapisz({ kotwica: v || undefined }));
      kotwica.classList.add('szeroki');
      s.append(kotwica);
      const jak = obj.type === 'textbox'
        ? (bezWysokosci ? 'W tekście zmienia się szerokość ramki – litery zostają, tekst układa się od nowa. Wysokość z danych działa przy włączonej stałej wysokości ramki.' : 'W tekście zmienia się ramka – litery zostają, tekst układa się od nowa.')
        : (obj.type === 'image' ? 'W obrazie zmienia się ramka: obraz z pola wpisuje się w nią tak, jak ustawiono wyżej, a zwykły obraz wypełnia ją (nadmiar jest przycinany po równo).' : (toTabela(obj) ? 'W tabeli zmieniają się szerokości kolumn i najmniejsze wysokości wierszy.' : 'Element jest skalowany w wybranym kierunku.'));
      s.append(this.wskazowka(`${jak} Wartość 0 chowa element.`));
    }
    // Obrót: kąt w stopniach z pola, dodawany do obrotu wzoru (wokół środka elementu).
    const obrot = this.wybor('Obrót z pola (stopnie)', lista(z().obrot), () => z().obrot || '', (v) => zapisz({ obrot: v || undefined }));
    obrot.classList.add('szeroki');
    s.append(obrot);
    // Widoczność: element jest na stronie tylko wtedy, gdy pole spełnia warunek (np. gwiazdka tylko w święta).
    const war = () => z().widok || {};
    const widok = this.wybor('Pokaż element', [['', 'zawsze'], ['niepuste', 'tylko gdy pole nie jest puste'], ['puste', 'tylko gdy pole jest puste'], ['rowne', 'tylko gdy pole równa się…']], () => (war().pole ? (war().gdy || 'niepuste') : ''), (v) => {
      zapisz({ widok: v ? { pole: pola[0] || '', ...war(), gdy: v } : undefined });
      this.zbuduj();
    });
    widok.classList.add('szeroki');
    s.append(widok);
    if (war().pole) {
      const poleWidoku = this.wybor('Pole, od którego to zależy', lista(war().pole).slice(1), () => war().pole, (v) => zapisz({ widok: { ...war(), pole: v } }));
      poleWidoku.classList.add('szeroki');
      s.append(poleWidoku);
      if (war().gdy === 'rowne') s.append(this.tekst('Wartość', () => war().wartosc || '', (v) => zapisz({ widok: { ...war(), wartosc: v } }), true));
    }
    const jest = z().kolor || z().x || z().y || z().obrot || z().widok || z().szer || z().wys;
    s.append(this.wskazowka(jest
      ? 'W edytorze element stoi w miejscu pozycji 1, ma kolor, rozmiar i obrót wzoru i jest zawsze widoczny. Właściwy wygląd każdej powielonej strony zobaczysz w podglądzie. „Od nowa co 6” znaczy, że pozycja 7 wraca na miejsce pierwszej (0 – bez powrotu).'
      : 'Kolor, położenie albo rozmiar mogą się zmieniać na powielonych stronach – według kolumny tabeli albo np. numeru powielenia {egzemplarz}. Przykłady: zakładka z nazwą miesiąca na brzegu strony, na każdej stronie niżej; słupek wykresu o wysokości z kolumny.'));
  }

  // Kształt tekstu (#131B): prosto, po łuku, okręgu, elipsie, po ścieżce (kształt ze strony) albo wygięty.
  zbudujKsztaltTekstu(obj) {
    const s = this.sekcja('Kształt tekstu', { zwinieta: !obj.ksztalt_tekstu });
    const przebuduj = () => setTimeout(() => this.zbuduj());
    const k = () => normalizujKsztalt(obj.ksztalt_tekstu) || normalizujKsztalt({ rodzaj: 'luk' }); // przy „Prosto” odświeżanie pól przed przebudową panelu
    const odswiezObiekt = () => {
      obj.dirty = true;
      obj.initDimensions();
      obj.setCoords();
      ustawKontrolkiKsztaltu(obj, () => this.odswiez());
      this.edytor.canvas.requestRenderAll();
    };
    const zmien = (zmiany) => { obj.set('ksztalt_tekstu', { ...k(), ...zmiany }); odswiezObiekt(); };
    const wybor = this.wybor('Kształt', RODZAJE_KSZTALTU, () => normalizujKsztalt(obj.ksztalt_tekstu)?.rodzaj || 'prosto', (v) => {
      const teraz = normalizujKsztalt(obj.ksztalt_tekstu);
      if (v === 'prosto') {
        const szer = teraz?.szer;
        obj.set('ksztalt_tekstu', undefined);
        if (szer > 0) obj.set('width', szer);
      } else {
        // Szerokość ramki prosto zostaje zapamiętana – wraca na czas pisania i po wybraniu „Prosto”.
        obj.set('ksztalt_tekstu', normalizujKsztalt({ ...(teraz || {}), rodzaj: v, szer: teraz?.szer || obj.width, zgiecie: teraz && teraz.rodzaj === v ? teraz.zgiecie : undefined }));
      }
      odswiezObiekt();
      przebuduj();
    });
    wybor.classList.add('szeroki');
    s.append(wybor);
    const r = normalizujKsztalt(obj.ksztalt_tekstu)?.rodzaj;
    if (!r) {
      s.append(this.wskazowka('Napis po łuku, w okręgu (np. pieczęć), po dowolnej linii albo wygięty jak fala czy flaga. Gotowe przykłady są też w Bibliotece, w kategorii „Teksty”.'));
      return;
    }
    const sila = (etykieta) => this.liczba(etykieta, () => k().zgiecie, (v) => zmien({ zgiecie: Math.max(-100, Math.min(100, Math.round(v))) }), { jednostka: '%', krok: 5 });
    if (r === 'luk') {
      s.append(sila('Zgięcie'));
      s.append(this.liczba('Promień (0 – sam)', () => zaokr(k().promien, 1), (v) => zmien({ promien: Math.max(0, v) }), { jednostka: 'mm', krok: 1, min: 0 }));
    } else if (r === 'okrag') {
      s.append(this.liczba('Promień (0 – sam)', () => zaokr(k().promien, 1), (v) => zmien({ promien: Math.max(0, v) }), { jednostka: 'mm', krok: 1, min: 0 }));
      s.append(this.liczba('Obrót początku', () => k().przesuniecie, (v) => zmien({ przesuniecie: Math.round(v) }), { jednostka: '°', krok: 5 }));
      const strona = this.wybor('Litery', [['zewn', 'na zewnątrz (u góry)'], ['wewn', 'do środka (u dołu)']], () => k().strona, (v) => zmien({ strona: v }));
      strona.classList.add('szeroki');
      s.append(strona);
    } else if (r === 'elipsa') {
      s.append(this.liczba('Promień (0 – sam)', () => zaokr(k().promien, 1), (v) => zmien({ promien: Math.max(0, v) }), { jednostka: 'mm', krok: 1, min: 0 }));
      s.append(this.liczba('Spłaszczenie', () => Math.abs(k().zgiecie), (v) => zmien({ zgiecie: Math.max(0, Math.min(100, Math.round(v))) }), { jednostka: '%', krok: 5, min: 0 }));
      s.append(this.liczba('Przesunięcie początku', () => k().przesuniecie, (v) => zmien({ przesuniecie: Math.round(v) }), { jednostka: '%', krok: 5 }));
    } else if (r === 'sciezka') {
      // Kształty na tej stronie (bez tekstów i obrazów): tekst dostaje kopię ich linii.
      const ksztalty = this.edytor.canvas.getObjects().filter((o) => o !== obj && !o.zWzorca && ['rect', 'ellipse', 'circle', 'line', 'polygon', 'polyline', 'path'].includes(String(o.type).toLowerCase()));
      const opisy = ksztalty.map((o, i) => [o.id || String(i), `${o.nazwa || nazwaTypu(o)} ${i + 1}`]);
      const wskaz = this.wybor('Linia z kształtu na stronie', [['', ksztalty.length ? '— wybierz kształt —' : '— na stronie nie ma kształtów —'], ...opisy], () => obj._sciezkaZ || '', (v) => {
        const ks = ksztalty.find((o, i) => (o.id || String(i)) === v);
        const d = ks ? sciezkaZKsztaltu(ks, obj) : null;
        if (!d) return;
        obj._sciezkaZ = v;
        zmien({ d });
      });
      wskaz.classList.add('szeroki');
      s.append(wskaz);
      if (!k().d) s.append(this.wskazowka('Narysuj linię piórem, kształt albo wstaw go z Biblioteki, a potem wybierz go tutaj. Tekst dostaje kopię jego linii – kształt możesz potem przesunąć, ukryć albo usunąć.', true));
      s.append(this.liczba('Przesunięcie początku', () => k().przesuniecie, (v) => zmien({ przesuniecie: Math.round(v) }), { jednostka: '%', krok: 5 }));
      const wyr = this.wybor('Wyrównanie', [['lewo', 'od początku linii'], ['srodek', 'na środku'], ['prawo', 'do końca linii']], () => k().wyrownanie, (v) => zmien({ wyrownanie: v }));
      wyr.classList.add('szeroki');
      s.append(wyr);
      const strona = this.wybor('Litery', [['zewn', 'nad linią'], ['wewn', 'pod linią']], () => k().strona, (v) => zmien({ strona: v }));
      strona.classList.add('szeroki');
      s.append(strona);
      s.append(this.przelacznik('Odwróć kierunek', () => k().odwroc, (v) => zmien({ odwroc: v })));
    } else {
      s.append(sila('Siła wygięcia'));
    }
    s.append(this.wskazowka(r === 'luk' || czyWygiecie(r)
      ? 'Uchwyt ◆ pod tekstem zgina go przeciąganiem w górę i w dół. W trakcie pisania tekst jest prosto, a po wyjściu z pisania wraca kształt.'
      : 'W trakcie pisania tekst jest prosto, a po wyjściu z pisania wraca kształt.'));
  }

  // Styl tekstu: wybór, zapis jako nowy, aktualizacja, usunięcie.
  // Skład akapitu (#131): dzielenie wyrazów, spójniki, wdowy i sieroty, siatka bazowa, inicjał, tabulatory.
  // Zwinięta, dopóki tekst nie używa żadnego z tych ustawień poza domyślnymi dla nowych tekstów.
  zbudujSklad(obj) {
    const uzywa = obj.dziel_wyrazy || obj.inicjal || obj.tabulatory?.length || obj.do_siatki || obj.bez_oblewania;
    const s = this.sekcja('Skład akapitu', { zwinieta: !uzywa });
    const przebuduj = () => setTimeout(() => this.zbuduj());
    const ustaw = (k, v) => { obj.set(k, v); this.edytor.ulozSkladStrony?.(); };

    s.append(this.przelacznik('Dziel wyrazy', () => Boolean(obj.dziel_wyrazy), (v) => { ustaw('dziel_wyrazy', v || undefined); przebuduj(); }));
    if (obj.dziel_wyrazy) {
      s.append(this.liczba('Najkrótszy dzielony wyraz', () => obj.dziel_min || 5, (v) => ustaw('dziel_min', Math.max(3, Math.min(15, Math.round(v)))), { jednostka: 'liter', krok: 1, min: 3 }));
      s.append(this.liczba('Najmniej liter przed łącznikiem', () => obj.dziel_przed || 2, (v) => ustaw('dziel_przed', Math.max(1, Math.min(6, Math.round(v)))), { jednostka: 'liter', krok: 1, min: 1 }));
      s.append(this.liczba('Najmniej liter po łączniku', () => obj.dziel_po || 2, (v) => ustaw('dziel_po', Math.max(1, Math.min(6, Math.round(v)))), { jednostka: 'liter', krok: 1, min: 1 }));
    }
    const spojniki = this.wybor('Spójniki na końcu wiersza', [
      ['', 'mogą zostać na końcu wiersza'],
      ['tak', 'a, i, w, z… przechodzą dalej'],
      ['dwuliterowe', 'także do, na, że…'],
    ], () => (obj.spojniki === true ? 'tak' : (obj.spojniki || '')), (v) => ustaw('spojniki', v === 'tak' ? true : (v || undefined)));
    spojniki.classList.add('szeroki');
    s.append(spojniki);
    const wdowy = this.wybor('Wdowy i sieroty', [
      ['', 'bez pilnowania'],
      ['2', 'co najmniej 2 wiersze'],
      ['3', 'co najmniej 3 wiersze'],
    ], () => (obj.wdowy ? String(obj.wdowy) : ''), (v) => ustaw('wdowy', v ? Number(v) : undefined));
    wdowy.classList.add('szeroki');
    s.append(wdowy);
    s.append(this.wskazowka('Wdowy i sieroty: akapit przechodzący do następnej ramki albo kolumny zostawia po obu stronach co najmniej tyle wierszy.'));

    s.append(this.przelacznik('Wyrównaj do siatki linii bazowych', () => Boolean(obj.do_siatki), (v) => { ustaw('do_siatki', v || undefined); przebuduj(); }));
    if (obj.do_siatki && !this.edytor.wydruk?.siatka_bazowa) s.append(this.wskazowka('Ta sekcja nie ma siatki linii bazowych – włącz ją w ustawieniach sekcji.', true));

    // Inicjał: pierwsza litera pierwszego akapitu na kilka wierszy.
    const inicjal = this.wybor('Inicjał', [['', 'brak'], ['2', 'na 2 wiersze'], ['3', 'na 3 wiersze'], ['4', 'na 4 wiersze'], ['5', 'na 5 wierszy']],
      () => (obj.inicjal ? String(obj.inicjal) : ''), (v) => { ustaw('inicjal', v ? Number(v) : undefined); przebuduj(); });
    inicjal.classList.add('szeroki');
    s.append(inicjal);
    if (obj.inicjal) {
      const rodziny = this.opcje.czcionki?.() || CZCIONKI.map((c) => c.nazwa);
      this._czcionkiWLiscie = true;
      const cz = this.wybor('Czcionka inicjału', [['', 'jak w tekście'], ...rodziny.map((n) => [n, n])], () => obj.inicjal_czcionka || '', (v) => {
        ustaw('inicjal_czcionka', v || undefined);
        if (v) this.edytor.doczytajCzcionke(v);
      });
      this._czcionkiWLiscie = false;
      cz.classList.add('szeroki');
      s.append(cz);
      s.append(this.kolor('Kolor inicjału', () => obj.inicjal_kolor || '', (v) => ustaw('inicjal_kolor', v || undefined), { brak: true }));
    }

    // Tabulatory: klawisz Tab w tekście przeskakuje do najbliższej pozycji.
    const tabs = obj.tabulatory || [];
    const zapiszTaby = (lista) => { ustaw('tabulatory', lista.length ? lista.map((t) => ({ ...t })) : undefined); przebuduj(); };
    tabs.forEach((t, i) => {
      const wiersz = document.createElement('div');
      wiersz.className = 'wiersz-tabulatora';
      const zmien = (pole, v) => { const lista = tabs.map((x) => ({ ...x })); lista[i][pole] = v; zapiszTaby(lista.sort((a, b) => a.poz - b.poz)); };
      wiersz.append(
        this.liczba(`Tabulator ${i + 1}`, () => zaokr(t.poz, 1), (v) => zmien('poz', Math.max(0, v)), { jednostka: 'mm', krok: 1, min: 0 }),
        this.wybor('Wyrównanie', [['lewy', 'do lewej'], ['srodek', 'do środka'], ['prawy', 'do prawej'], ['dziesietny', 'do przecinka']], () => t.rodzaj || 'lewy', (v) => zmien('rodzaj', v)),
        this.wybor('Wypełnienie', [['', 'brak'], ['.', 'kropki . . .'], ['-', 'kreski - - -'], ['_', 'linia ___']], () => t.wypelniacz || '', (v) => zmien('wypelniacz', v)),
        this.akcje([['kosz', `Usuń tabulator ${i + 1}`, () => zapiszTaby(tabs.filter((_, j) => j !== i))]]),
      );
      s.append(wiersz);
    });
    s.append(this.akcje([['plus', 'Dodaj tabulator', () => {
      const ost = Math.max(0, ...tabs.map((t) => t.poz));
      zapiszTaby([...tabs, { poz: Math.round(Math.min(obj.width, ost + Math.max(10, obj.width / 4))), rodzaj: tabs.length ? 'prawy' : 'lewy', wypelniacz: tabs.length ? '.' : '' }]);
    }]]));
    s.append(this.wskazowka('Klawisz Tab w pisanym tekście wstawia tabulator. Bez ustawionych pozycji tabulator skacze co 12,5 mm.'));
    s.append(this.przelacznik('Nie opływaj innych elementów', () => Boolean(obj.bez_oblewania), (v) => ustaw('bez_oblewania', v || undefined)));
  }

  // Pisownia (#131C): słowa spoza słownika w tym tekście z podpowiedziami – działa też na telefonie,
  // gdzie nie ma menu pod prawym przyciskiem. Tylko gdy sprawdzanie pisowni jest włączone (menu widoku).
  zbudujPisownie(obj) {
    const p = this.opcje.pisownia;
    if (!p?.wlaczona()) return;
    const s = this.sekcja('Pisownia', { zwinieta: false });
    const lista = document.createElement('div');
    lista.className = 'lista-pisowni';
    lista.textContent = 'Sprawdzam…';
    s.append(lista);
    p.bledyTekstu(obj).then(async (bledy) => {
      if (!lista.isConnected) return;
      lista.replaceChildren();
      if (!bledy.length) { lista.append(this.wskazowka('Bez błędów – wszystkie słowa są w słowniku.')); return; }
      for (const slowo of bledy.slice(0, 12)) {
        const wiersz = document.createElement('div');
        wiersz.className = 'blad-pisowni';
        const nazwa = document.createElement('strong');
        nazwa.textContent = slowo;
        const podp = document.createElement('div');
        podp.className = 'podpowiedzi-pisowni';
        wiersz.append(nazwa, podp);
        lista.append(wiersz);
        const propozycje = await p.podpowiedzi(slowo);
        for (const nowe of propozycje.slice(0, 4)) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'przycisk maly';
          b.textContent = nowe;
          b.title = `Zamień „${slowo}” na „${nowe}” w tym tekście`;
          b.addEventListener('click', () => { p.popraw(obj, slowo, nowe); setTimeout(() => this.zbuduj()); });
          podp.append(b);
        }
        const dodaj = document.createElement('button');
        dodaj.type = 'button';
        dodaj.className = 'przycisk maly przezroczysty';
        dodaj.textContent = 'Dodaj do słownika';
        dodaj.addEventListener('click', async () => { await p.dodajDoSlownika(slowo); setTimeout(() => this.zbuduj()); });
        podp.append(dodaj);
      }
    }).catch((e) => { if (lista.isConnected) lista.textContent = `Nie udało się sprawdzić pisowni: ${e.message}`; });
  }

  // Książka (#131B): przypisy dolne, odsyłacze i hasła skorowidza tego tekstu.
  zbudujKsiazke(obj) {
    const projekt = this.opcje.projekt?.();
    if (!projekt) return;
    const przypisy = Object.entries(obj.przypisy || {});
    const hasla = obj.hasla || [];
    const s = this.sekcja('Przypisy, odsyłacze, skorowidz', { zwinieta: !przypisy.length && !hasla.length && !/\{s:/.test(obj.text || '') });
    const przebuduj = () => setTimeout(() => this.zbuduj());
    const poZmianie = () => this.opcje.poZmianieKsiazki?.();
    // Przypisy dolne.
    s.append(this.akcje([['plus', 'Wstaw przypis', () => { this.edytor.wstawPrzypis(''); poZmianie(); przebuduj(); }]]));
    przypisy.forEach(([id, tresc], i) => {
      const pole = this.obszarTekstu(`Przypis ${i + 1}`, () => obj.przypisy?.[id] ?? tresc, (v) => this.edytor.zmienPrzypis(obj, id, v));
      pole.querySelector('textarea')?.addEventListener('change', poZmianie);
      s.append(pole, this.akcje([['kosz', `Usuń przypis ${i + 1}`, () => { this.edytor.zmienPrzypis(obj, id, null); poZmianie(); przebuduj(); }]]));
    });
    if (przypisy.length) {
      const liczenie = this.wybor('Numeracja przypisów', Object.entries(LICZENIE_PRZYPISOW), () => projekt.ksiazka?.przypisy || 'sekcja', (v) => {
        projekt.ksiazka = { ...(projekt.ksiazka || {}), przypisy: v };
        poZmianie();
      });
      liczenie.classList.add('szeroki');
      s.append(liczenie);
    }
    s.append(this.wskazowka('Przypis: numer w tekście w miejscu kursora, treść na dole tej samej strony (widać ją w podglądzie i na stronie, pod treścią). Numery liczą się same.'));
    // Odsyłacz do nagłówka.
    const cele = celeOdsylaczy(projekt);
    if (cele.length) {
      const odsylacz = this.wybor('Wstaw odsyłacz do', [['', 'wybierz nagłówek…'], ...cele.map((c) => [c.id, `${'· '.repeat(c.poziom - 1)}${c.tekst.slice(0, 60)}${c.nr !== null ? ` (s. ${c.nr})` : ''}`])], () => '', (v) => {
        if (!v) return;
        this.edytor.wstawOdsylacz(v);
        poZmianie();
      });
      odsylacz.classList.add('szeroki');
      s.append(odsylacz, this.wskazowka('Odsyłacz wstawia „s. 12” – numer strony nagłówka, który zmienia się sam, gdy strony się przesuną.'));
    } else s.append(this.wskazowka('Odsyłacze prowadzą do nagłówków – tekstów w stylu nagłówka (np. „Tytuł”). Nadaj styl tytułom rozdziałów, żeby się tu pojawiły.'));
    // Skorowidz.
    s.append(this.akcje([['plus', 'Dodaj do skorowidza', async () => {
      let slowo = this.edytor.dodajDoSkorowidza();
      if (!slowo) {
        const wpis = await zapytajONazwe('Dodaj do skorowidza', 'Hasło (słowo z tego tekstu)', '');
        slowo = wpis ? this.edytor.dodajDoSkorowidza(wpis) : null;
      }
      if (slowo) { poZmianie(); przebuduj(); }
    }]]));
    if (hasla.length) {
      const lista = document.createElement('div');
      lista.className = 'hasla-skorowidza';
      for (const h of hasla) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip-hasla';
        b.title = `Usuń „${h}” ze skorowidza`;
        b.innerHTML = `<span></span>${ikona('zamknij', { rozmiar: 12 })}`;
        b.querySelector('span').textContent = h;
        b.addEventListener('click', () => { this.edytor.usunZeSkorowidza(obj, h); poZmianie(); przebuduj(); });
        lista.append(b);
      }
      s.append(lista);
    }
    s.append(this.wskazowka('Zaznacz słowo w pisanym tekście i wybierz „Dodaj do skorowidza”. Skorowidz (z Biblioteki) pokaże wszystkie strony, na których to słowo występuje.'));
  }

  // Spis treści albo skorowidz – tekst składany sam (#131B).
  zbudujElementKsiazki(obj) {
    const projekt = this.opcje.projekt?.();
    const poZmianie = () => this.opcje.poZmianieKsiazki?.();
    const przebuduj = () => setTimeout(() => this.zbuduj());
    const k = obj.ksiazka;
    const s = this.sekcja(RODZAJE_KSIAZKI[k.rodzaj] || 'Spis treści');
    if (k.rodzaj === 'spis') {
      const poziomy = this.wybor('Poziomy', [['1', 'tylko rozdziały'], ['2', 'rozdziały i podrozdziały'], ['3', 'trzy poziomy']], () => String(k.poziomy || 2), (v) => { obj.ksiazka = { ...obj.ksiazka, poziomy: Number(v) }; poZmianie(); });
      poziomy.classList.add('szeroki');
      s.append(poziomy);
    }
    s.append(this.przelacznik('Kropki do numeru strony', () => k.kropki !== false, (v) => { obj.ksiazka = { ...obj.ksiazka, kropki: v }; poZmianie(); }));
    if (k.rodzaj === 'spis' && projekt) {
      // Które style akapitu są nagłówkami – wspólne dla spisu treści, żywej paginy i odsyłaczy.
      const nagl = naglowkiProjektu(projekt);
      const poziomStylu = new Map(nagl.map((n) => [n.styl, n.poziom]));
      for (const st of projekt.style || []) {
        s.append(this.wybor(`Styl „${st.nazwa}”`, [['', 'nie jest nagłówkiem'], ['1', 'nagłówek 1 (rozdział)'], ['2', 'nagłówek 2'], ['3', 'nagłówek 3']], () => String(poziomStylu.get(st.id) || ''), (v) => {
          const lista = naglowkiProjektu(projekt).filter((n) => n.styl !== st.id);
          if (v) lista.push({ styl: st.id, poziom: Number(v) });
          projekt.ksiazka = { ...(projekt.ksiazka || {}), naglowki: lista };
          poZmianie();
          przebuduj();
        }));
      }
    }
    s.append(this.akcje([['cofnij', 'Odśwież teraz', () => poZmianie()]]));
    s.append(this.wskazowka(k.rodzaj === 'skorowidz'
      ? 'Skorowidz układa się sam: hasła alfabetycznie, z numerami stron, na których występują. Hasła dodasz w części „Przypisy, odsyłacze, skorowidz” zwykłego tekstu.'
      : 'Spis treści układa się sam z tekstów w stylach nagłówków – z numerami stron, także stron powielonych serią. Długi spis przelej do kolejnej ramki („Przelewanie tekstu”).'));
  }

  zbudujStyl(obj) {
    const style = this.opcje.style?.();
    if (!style) return;
    const s = this.sekcja('Styl tekstu');
    const znajdz = () => style.find((x) => x.id === obj.styl);
    const rozniSie = () => {
      const st = znajdz();
      if (!st) return false;
      const teraz = stylZObiektu(obj, st.nazwa, st.id);
      return POLA_STYLU.some((k) => st[k] !== undefined && !rowneWStylu(st[k], teraz[k]));
    };
    const wybor = this.wybor('Styl', [['', '— bez stylu —'], ...style.map((x) => [x.id, x.nazwa])], () => obj.styl || '', (v) => {
      const st = style.find((x) => x.id === v);
      if (st) zastosujStyl(obj, st); else obj.styl = undefined;
      this.opcje.poZmianieStyli(null);
    });
    wybor.classList.add('szeroki');
    s.append(wybor);

    const zmieniony = this.wskazowka('Ten tekst różni się od swojego stylu.');
    const przyciski = document.createElement('div');
    przyciski.className = 'rzad-przyciskow';
    const przycisk = (tekst, tytul, klik) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'przycisk';
      b.textContent = tekst;
      b.title = tytul;
      b.addEventListener('click', klik);
      przyciski.append(b);
      return b;
    };
    const nowy = przycisk('Nowy styl', 'Zapisz wygląd tego tekstu jako nowy styl', async () => {
      const nazwa = await zapytajONazwe('Nowy styl tekstu', 'Nazwa stylu', 'Mój styl');
      if (!nazwa) return;
      const st = stylZObiektu(obj, nazwa);
      style.push(st);
      obj.styl = st.id;
      this.opcje.poZmianieStyli(null);
      this.zbuduj();
    });
    const aktualizuj = przycisk('Aktualizuj styl', 'Przenieś wygląd tego tekstu do stylu – zmienią się wszystkie teksty z tym stylem', () => {
      const st = znajdz();
      Object.assign(st, stylZObiektu(obj, st.nazwa, st.id));
      this.opcje.poZmianieStyli(st);
    });
    const przywroc = przycisk('Przywróć', 'Wróć do wyglądu zapisanego w stylu', () => {
      zastosujStyl(obj, znajdz());
      this.edytor.zatwierdz();
      this.odswiez();
    });
    const usun = przycisk('Usuń styl', 'Usuń styl – teksty zachowają wygląd', async () => {
      const st = znajdz();
      if (!await potwierdz(`Usunąć styl „${st.nazwa}”?`, 'Teksty zachowają obecny wygląd, ale przestaną być ze sobą powiązane.', 'Usuń styl', true)) return;
      style.splice(style.indexOf(st), 1);
      obj.styl = undefined;
      this.opcje.poZmianieStyli({ usuniety: st.id });
      this.zbuduj();
    });
    usun.classList.add('niebezpieczny');
    s.append(zmieniony, przyciski);
    this.zbudujStylZnakowy(obj, s);
    const odswiez = () => {
      const ma = Boolean(znajdz());
      const inny = ma && rozniSie();
      zmieniony.hidden = !inny;
      nowy.hidden = false;
      aktualizuj.hidden = !inny;
      przywroc.hidden = !inny;
      usun.hidden = !ma;
    };
    this.odswiezacze.push(odswiez);
    odswiez();
  }

  // Styl znakowy (#131): wygląd zaznaczonego fragmentu zapisany pod nazwą – obok stylu akapitu.
  zbudujStylZnakowy(obj, s) {
    const lista = this.opcje.styleZnakowe?.();
    if (!lista) return;
    const fragment = () => obj.isEditing && obj.selectionStart !== obj.selectionEnd;
    const aktualny = () => stylZnakowyNaPozycji(obj, fragment() ? obj.selectionStart : 0);
    const wybor = this.wybor('Styl znakowy', [['', '— bez stylu znakowego —'], ...lista.map((x) => [x.id, x.nazwa])], aktualny, (v) => {
      zastosujStylZnakowy(obj, lista.find((x) => x.id === v) || null);
      this.opcje.poZmianieStyliZnakowych?.(null);
    });
    wybor.classList.add('szeroki');
    wybor.title = 'Nadaje styl zaznaczonemu fragmentowi (bez zaznaczenia – całemu tekstowi)';
    const przyciski = this.akcje([
      ['plus', 'Nowy styl znakowy z wyglądu zaznaczenia', async () => {
        const nazwa = await zapytajONazwe('Nowy styl znakowy', 'Nazwa stylu', 'Wyróżnienie');
        if (!nazwa) return;
        const i = fragment() ? obj.selectionStart : 0;
        const st = stylZnakowyZFragmentu(obj.getStyleAtPosition ? obj.getStyleAtPosition(i, true) : obj, nazwa);
        lista.push(st);
        zastosujStylZnakowy(obj, st);
        this.opcje.poZmianieStyliZnakowych?.(null);
        this.zbuduj();
      }],
      ['olowek', 'Aktualizuj styl znakowy wyglądem zaznaczenia – zmienią się wszystkie fragmenty z tym stylem', () => {
        const st = lista.find((x) => x.id === aktualny());
        if (!st) { powiadom('Zaznacz fragment, który ma już styl znakowy.', true); return; }
        const i = fragment() ? obj.selectionStart : 0;
        Object.assign(st, stylZnakowyZFragmentu(obj.getStyleAtPosition(i, true), st.nazwa, st.id));
        this.opcje.poZmianieStyliZnakowych?.(st);
      }],
      ['kosz', 'Usuń styl znakowy – fragmenty zachowają wygląd', async () => {
        const st = lista.find((x) => x.id === aktualny());
        if (!st) return;
        if (!await potwierdz(`Usunąć styl znakowy „${st.nazwa}”?`, 'Fragmenty zachowają obecny wygląd, ale przestaną być ze sobą powiązane.', 'Usuń styl', true)) return;
        lista.splice(lista.indexOf(st), 1);
        this.opcje.poZmianieStyliZnakowych?.({ usuniety: st.id });
        this.zbuduj();
      }],
    ]);
    s.append(wybor, przyciski);
  }

  zbudujWypelnienie(obj) {
    if (obj.type === 'polygon') {
      const k = this.sekcja('Kształt');
      // Gotowe kształty (#152): ten sam wybór co przy wstawianiu; miejsce i wielkość zostają.
      const wybor = document.createElement('div');
      wybor.className = 'siatka-wielokatow wybor-wielokata';
      wybor.setAttribute('role', 'group');
      wybor.setAttribute('aria-label', 'Kształt wielokąta');
      wybor.innerHTML = WIELOKATY.map(([n, g, nazwa]) => `<button type="button" data-boki="${n}" data-gwiazda="${g ? 1 : ''}" title="${nazwa}" aria-label="${nazwa}">${podgladWielokata(n, g)}<span>${nazwa}</span></button>`).join('');
      const zapiszKsztalt = this._zapisz(([n, g]) => this.edytor.przeksztalcWielokat(obj, n, g));
      wybor.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-boki]');
        if (b) zapiszKsztalt([Number(b.dataset.boki), Boolean(b.dataset.gwiazda)]);
      });
      const odswiezWybor = () => {
        const n = obj.boki || obj.points.length;
        for (const b of wybor.children) b.setAttribute('aria-pressed', String(Number(b.dataset.boki) === n && Boolean(b.dataset.gwiazda) === Boolean(obj.gwiazda)));
      };
      this.odswiezacze.push(odswiezWybor);
      odswiezWybor();
      k.append(wybor);
      k.append(this.liczba('Liczba boków', () => obj.boki || obj.points.length, (v) => this.edytor.przeksztalcWielokat(obj, v, obj.gwiazda), { krok: 1, min: 3 }));
      k.append(this.przelacznik('Gwiazda', () => Boolean(obj.gwiazda), (v) => this.edytor.przeksztalcWielokat(obj, obj.boki || 5, v)));
    }
    const s = this.sekcja('Wypełnienie i obrys');
    // Wypełnienie: jeden kolor, przejście liniowe albo kołowe – z dowolną liczbą kolorów.
    const gradient = () => (obj.fill && typeof obj.fill === 'object' && obj.fill.colorStops ? obj.fill : null);
    const rodzaj = () => (gradient() ? (gradient().type === 'radial' ? 'kolowy' : 'liniowy') : (!obj.fill || obj.fill === 'transparent' ? 'brak' : 'kolor'));
    const przystanki = () => [...gradient().colorStops].sort((p, q) => p.offset - q.offset).map((p) => ({ offset: p.offset, color: p.color }));
    const KIERUNKI = { poziomo: [0, 0, 1, 0], pionowo: [0, 0, 0, 1], ukos: [0, 0, 1, 1] };
    const wspolrzedne = () => { const c = gradient()?.coords; return c ? [c.x1, c.y1, c.x2, c.y2] : KIERUNKI.poziomo; };
    const kierunek = () => Object.keys(KIERUNKI).find((n) => KIERUNKI[n].join() === wspolrzedne().join()) || null;
    const kat = () => { const [x1, y1, x2, y2] = wspolrzedne(); return Math.round(((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 360) % 360); };
    const promien = () => Math.round((gradient()?.coords.r2 ?? 0.5) * 100);
    // Buduje gradient od nowa: typ, przystanki i – dla liniowego – współrzędne kierunku, dla kołowego – promień.
    const ustawGradient = ({ typ = rodzaj(), kolory = przystanki(), wsp = wspolrzedne(), r = promien() } = {}) => {
      const coords = typ === 'kolowy'
        ? { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: Math.max(0.05, r / 100) }
        : { x1: wsp[0], y1: wsp[1], x2: wsp[2], y2: wsp[3] };
      obj.set('fill', new fabric.Gradient({ type: typ === 'kolowy' ? 'radial' : 'linear', gradientUnits: 'percentage', coords, colorStops: kolory }));
    };
    const pierwszyKolor = () => (gradient() ? przystanki()[0].color : (naHex(obj.fill) || '#2f5bd3'));
    const wyborRodzaju = this.wybor('Wypełnienie', [['kolor', 'Jeden kolor'], ['liniowy', 'Przejście liniowe'], ['kolowy', 'Przejście kołowe'], ['brak', 'Brak']], rodzaj, (v) => {
      const kolor = pierwszyKolor();
      if (v === 'kolor') obj.set('fill', kolor);
      else if (v === 'brak') obj.set('fill', '');
      else ustawGradient({ typ: v, kolory: gradient() ? przystanki() : [{ offset: 0, color: kolor }, { offset: 1, color: '#ffffff' }], wsp: gradient()?.type === 'linear' ? wspolrzedne() : KIERUNKI.poziomo, r: 50 });
      this.zbuduj();
    });
    wyborRodzaju.classList.add('szeroki');
    s.append(wyborRodzaju);
    if (rodzaj() === 'kolor') s.append(this.kolor('Kolor wypełnienia', () => obj.fill, (v) => obj.set('fill', v)));
    if (gradient()) {
      // Kolory przejścia: każdy ma położenie w procentach; dwa skrajne zostają zawsze.
      przystanki().forEach((p, i, wszystkie) => {
        // Kolor punktu z kryciem (#123): kolor wybiera się bez przezroczystości, krycie osobną liczbą.
        const zKryciem = (kolor, krycie) => { const [r, g, b] = new fabric.Color(kolor).getSource(); return krycie >= 1 ? `#${new fabric.Color(kolor).toHex()}` : `rgba(${r},${g},${b},${Math.round(krycie * 100) / 100})`; };
        const krycieP = () => new fabric.Color(przystanki()[i]?.color || '#000').getAlpha();
        s.append(this.kolor(`Kolor ${i + 1}`, () => `#${new fabric.Color(przystanki()[i]?.color || '#000').toHex()}`, (v) => { const k = przystanki(); k[i].color = zKryciem(v, krycieP()); ustawGradient({ kolory: k }); }));
        s.append(this.liczba('Krycie', () => Math.round(krycieP() * 100), (v) => { const k = przystanki(); k[i].color = zKryciem(k[i].color, Math.min(100, Math.max(0, v)) / 100); ustawGradient({ kolory: k }); }, { jednostka: '%', krok: 10, min: 0 }));
        const polozenie = this.liczba('Położenie', () => Math.round((przystanki()[i]?.offset ?? 0) * 100), (v) => { const k = przystanki(); k[i].offset = Math.min(100, Math.max(0, v)) / 100; ustawGradient({ kolory: k }); this.zbuduj(); }, { jednostka: '%', krok: 5, min: 0 });
        if (wszystkie.length > 2) {
          const usun = document.createElement('button');
          usun.type = 'button';
          usun.className = 'przycisk-ikona usun-prowadnice';
          usun.title = 'Usuń ten kolor z przejścia';
          usun.setAttribute('aria-label', `Usuń kolor ${i + 1}`);
          usun.textContent = '×';
          usun.addEventListener('click', () => { const k = przystanki(); k.splice(i, 1); ustawGradient({ kolory: k }); this.edytor.zatwierdz(); this.zbuduj(); });
          polozenie.querySelector('.jednostka').append(usun);
        }
        s.append(polozenie);
      });
      s.append(this.akcje([['plus', 'Dodaj kolor', () => {
        // Nowy kolor staje w połowie największej przerwy między sąsiednimi.
        const k = przystanki();
        let gdzie = 0;
        for (let i = 1; i < k.length - 1; i += 1) if (k[i + 1].offset - k[i].offset > k[gdzie + 1].offset - k[gdzie].offset) gdzie = i;
        k.splice(gdzie + 1, 0, { offset: (k[gdzie].offset + k[gdzie + 1].offset) / 2, color: k[gdzie + 1].color });
        ustawGradient({ kolory: k });
        this.edytor.zatwierdz();
        this.zbuduj();
      }]]));
      if (rodzaj() === 'liniowy') {
        const kier = this.segmenty('Kierunek przejścia', [
          ['wyrownajSrodekY', 'Poziomo', () => kierunek() === 'poziomo', () => ustawGradient({ wsp: KIERUNKI.poziomo })],
          ['wyrownajSrodekX', 'Pionowo', () => kierunek() === 'pionowo', () => ustawGradient({ wsp: KIERUNKI.pionowo })],
          ['linia', 'Po skosie', () => kierunek() === 'ukos', () => ustawGradient({ wsp: KIERUNKI.ukos })],
        ]);
        s.append(kier);
        s.append(this.liczba('Kąt', kat, (v) => {
          const rad = (v * Math.PI) / 180;
          const [dx, dy] = [Math.cos(rad) / 2, Math.sin(rad) / 2];
          ustawGradient({ wsp: [0.5 - dx, 0.5 - dy, 0.5 + dx, 0.5 + dy].map((x) => Math.round(x * 1000) / 1000) });
        }, { jednostka: '°', krok: 15 }));
      } else {
        s.append(this.liczba('Promień', promien, (v) => ustawGradient({ r: Math.min(200, Math.max(5, v)) }), { jednostka: '%', krok: 5, min: 5 }));
      }
    }
    this.polaObrysu(s, obj);
    if (obj.type === 'rect') {
      s.append(this.liczba('Zaokrąglenie', () => zaokr(obj.rx || 0, 1), (v) => obj.set({ rx: Math.max(0, v), ry: Math.max(0, v) }), { jednostka: 'mm', krok: 0.5, min: 0 }));
    }
  }

  // Filtry obrazu (#123): bez zmiany pliku – jasność, kontrast, nasycenie, szarość, sepia, rozmycie.
  zbudujFiltry(obj) {
    const s = this.sekcja('Filtry', { zwinieta: !maFiltry(obj.filtry) });
    const f = () => ({ ...BEZ_FILTROW, ...(obj.filtry || {}) });
    const ustaw = (zmiana) => {
      const nowe = { ...f(), ...zmiana };
      obj.set('filtry', maFiltry(nowe) ? Object.fromEntries(Object.entries(nowe).filter(([, v]) => v)) : undefined);
      obj.dirty = true;
    };
    const suwak = (etyk, k, min, max) => this.liczba(etyk, () => f()[k], (v) => ustaw({ [k]: Math.max(min, Math.min(max, Math.round(v))) }), { krok: 5, min });
    s.append(suwak('Jasność', 'jasnosc', -100, 100), suwak('Kontrast', 'kontrast', -100, 100), suwak('Nasycenie', 'nasycenie', -100, 100), suwak('Rozmycie', 'rozmycie', 0, 100));
    s.append(this.przelacznik('Odcień szarości', () => f().szarosc, (v) => ustaw({ szarosc: v })));
    s.append(this.przelacznik('Sepia', () => f().sepia, (v) => ustaw({ sepia: v })));
    if (maFiltry(obj.filtry)) s.append(this.akcje([['gumka', 'Bez filtrów', () => { obj.set('filtry', undefined); obj.dirty = true; this.edytor.zatwierdz(); this.zbuduj(); }]]));
    s.append(this.wskazowka('Plik obrazu się nie zmienia – filtry możesz zdjąć w każdej chwili. Wartości od −100 do 100.'));
  }

  // Kształt jako ramka obrazu (#123): obraz przycięty do kształtu i wypełniający go.
  zbudujObrazWKsztalcie(obj) {
    const s = this.sekcja('Obraz w kształcie');
    const e = this.edytor;
    if (!maObraz(obj)) {
      if (this.opcje.wstawObrazDoKsztaltu) s.append(this.akcje([['obraz', 'Wstaw obraz do kształtu', () => this.opcje.wstawObrazDoKsztaltu(obj)]]));
      s.append(this.wskazowka('Kształt stanie się ramką: obraz wypełni go i zostanie przycięty do jego brzegów. Możesz też upuścić plik obrazu na kształt.'));
    } else {
      const akcje = [];
      if (this.opcje.wstawObrazDoKsztaltu) akcje.push(['obraz', 'Zmień obraz', () => this.opcje.wstawObrazDoKsztaltu(obj)]);
      akcje.push(['dopasuj', 'Kadruj', () => { if (!e.kadrujWKsztalcie(obj)) powiadom('Zablokowany kształt kadrujesz liczbami poniżej.'); }]);
      s.append(this.akcje(akcje));
      const akcje2 = [];
      if (this.opcje.wyjmijObrazZKsztaltu) akcje2.push(['rozgrupuj', 'Wyjmij obraz', () => this.opcje.wyjmijObrazZKsztaltu(obj)]);
      akcje2.push(['kosz', 'Usuń obraz', () => e.usunObrazZKsztaltu(obj)]);
      s.append(this.akcje(akcje2));
      s.append(this.wskazowka('Kliknij kształt dwa razy, żeby przesunąć i powiększyć obraz w środku. Kształt zmieniasz jak zwykle – obraz idzie za nim.'));
      const kadr = () => obj.obraz_kadr || {};
      s.append(this.liczba('Powiększenie', () => Math.round((kadr().skala || 1) * 100), (v) => e.ustawKadrWKsztalcie(obj, { skala: Math.max(100, v) / 100 }), { jednostka: '%', krok: 10, min: 100 }));
      s.append(this.liczba('Przesunięcie w poziomie', () => Math.round((kadr().x || 0) * 100), (v) => e.ustawKadrWKsztalcie(obj, { x: v / 100 }), { jednostka: '%', krok: 5 }));
      s.append(this.liczba('Przesunięcie w pionie', () => Math.round((kadr().y || 0) * 100), (v) => e.ustawKadrWKsztalcie(obj, { y: v / 100 }), { jednostka: '%', krok: 5 }));
      if (this.opcje.usunTlo) s.append(this.akcje([['gumka', 'Usuń tło…', () => this.opcje.usunTlo(obj)]]));
      const info = this.wskazowka('');
      this.odswiezacze.push(() => {
        if (!obj._obrazEl) { info.textContent = ''; return; }
        const u = ukladObrazu(obj, obj._obrazEl);
        const dpi = Math.round(25.4 / u.k);
        info.textContent = `Oryginał ${u.nw} × ${u.nh} px · ${dpi} dpi w tym rozmiarze.${dpi < 300 ? ' Do druku zalecane jest 300 dpi.' : ''}`;
        info.classList.toggle('uwaga', dpi < 300);
      });
      s.append(info);
      this.odswiezacze.at(-1)();
    }
    // Obraz z danych: kolumna z nazwą pliku – na każdej powielonej stronie inny obraz w tym kształcie.
    const kolumny = this.opcje.kolumnyObrazu?.() || [];
    if (kolumny.length) {
      const wybor = this.wybor('Obraz z kolumny', [['', 'stały obraz'], ...kolumny.map((k) => [k, k])], () => obj.pole?.kolumna || '', (v) => { obj.pole = v ? { ...obj.pole, kolumna: v } : undefined; this.zbuduj(); });
      wybor.classList.add('szeroki');
      s.append(wybor);
      if (obj.pole?.kolumna) {
        const czesc = this.wybor('Zostaje część zdjęcia', [['', 'środek'], ['gora', 'góra'], ['dol', 'dół'], ['lewa', 'lewa strona'], ['prawa', 'prawa strona']], () => obj.pole?.kadr || '', (v) => { obj.pole = { ...obj.pole, kadr: v || undefined }; });
        czesc.classList.add('szeroki');
        s.append(czesc);
      }
    }
    if (maObraz(obj)) this.zbudujFiltry(obj);
  }

  // Obrys kształtu albo obramowanie obrazu (#156): kolor, krycie, grubość, rodzaj linii (kreski rosną z grubością).
  polaObrysu(s, obj) {
    const kolor = () => (obj.stroke && obj.stroke !== 'transparent' ? new fabric.Color(obj.stroke) : null);
    const zKryciem = (hex, krycie) => {
      const [r, g, b] = new fabric.Color(hex).getSource();
      return krycie >= 1 ? `#${new fabric.Color(hex).toHex()}` : `rgba(${r},${g},${b},${Math.round(krycie * 100) / 100})`;
    };
    const kreski = (rodzaj, grubosc) => ({ strokeDashArray: wzorKresek(rodzaj, grubosc), strokeLineCap: ['kropkowana', 'kreska-kropka'].includes(rodzaj) ? 'round' : 'butt' });
    s.append(this.kolor(obj.type === 'image' ? 'Kolor obramowania' : 'Obrys', () => obj.stroke, (v) => {
      obj.set('stroke', v ? zKryciem(v, kolor()?.getAlpha() ?? 1) : null);
      if (v && !obj.strokeWidth) obj.set({ strokeWidth: 0.5, strokeUniform: true });
    }, { brak: true }));
    s.append(this.liczba(obj.type === 'image' ? 'Grubość' : 'Grubość obrysu', () => zaokr(obj.strokeWidth || 0, 2), (v) => {
      const g = Math.max(0, v);
      obj.set({ strokeWidth: g, strokeUniform: true, ...(rodzajKresek(obj) === 'ciagla' ? {} : kreski(rodzajKresek(obj), g)) });
    }, { jednostka: 'mm', krok: 0.1, min: 0 }));
    if (!kolor()) return;
    s.append(this.liczba('Krycie obrysu', () => Math.round((kolor()?.getAlpha() ?? 1) * 100), (v) => { const k = kolor(); if (k) obj.set('stroke', zKryciem(`#${k.toHex()}`, Math.min(100, Math.max(0, v)) / 100)); }, { jednostka: '%', krok: 10, min: 0 }));
    const rodzaj = this.wybor('Rodzaj linii', RODZAJE_KRESEK, () => rodzajKresek(obj), (v) => obj.set(kreski(v, obj.strokeWidth || 0.5)));
    rodzaj.dataset.pole = 'rodzaj-obrysu';
    s.append(rodzaj);
  }

  // Miękkie krawędzie (#156): brzeg przechodzi płynnie w przezroczystość – równo wzdłuż brzegu albo owalna winieta.
  zbudujMiekkieKrawedzie(obj) {
    if (toZaznaczenie(obj) || obj.type === 'group' || toTabela(obj) || toKod(obj)) return;
    if (!(obj.type === 'image' || KSZTALTY.has(obj.type) || obj.type === 'path')) return;
    const s = this.sekcja('Miękkie krawędzie', { zwinieta: !maMiekkie(obj) });
    s.append(this.liczba('Szerokość przejścia', () => zaokr(obj.miekkie_krawedzie || 0, 1), (v) => {
      const bylo = maMiekkie(obj);
      obj.set('miekkie_krawedzie', v > 0 ? Math.round(v * 10) / 10 : undefined);
      if (!maMiekkie(obj)) obj.set('miekkie_rodzaj', undefined);
      obj.dirty = true;
      if (bylo !== maMiekkie(obj)) setTimeout(() => this.zbuduj());
    }, { jednostka: 'mm', krok: 1, min: 0 }));
    if (maMiekkie(obj)) {
      s.append(this.wybor('Rodzaj', RODZAJE_MIEKKICH, () => obj.miekkie_rodzaj || 'rowno', (v) => { obj.set('miekkie_rodzaj', v === 'owal' ? 'owal' : undefined); obj.dirty = true; }));
    }
    s.append(this.wskazowka('0 mm – ostry brzeg. W PDF element z miękkimi krawędziami zapisuje się jako obraz w rozdzielczości druku.'));
  }

  // Cień: przesunięcie i rozmycie w mm, kolor z przezroczystością.
  zbudujCien(obj) {
    if (toZaznaczenie(obj) || obj.type === 'group') return;
    const c = this.sekcja('Cień');
    const kolorCienia = () => new fabric.Color(obj.shadow?.color || 'rgba(0,0,0,0.35)');
    const ustaw = (zmiana) => {
      const k = kolorCienia();
      const obecny = { hex: `#${k.toHex()}`, moc: k.getAlpha(), x: obj.shadow?.offsetX ?? 1.5, y: obj.shadow?.offsetY ?? 1.5, blur: obj.shadow?.blur ?? 3, ...zmiana };
      const [r, g, b] = new fabric.Color(obecny.hex).getSource();
      obj.set('shadow', new fabric.Shadow({ color: `rgba(${r},${g},${b},${obecny.moc})`, offsetX: obecny.x, offsetY: obecny.y, blur: obecny.blur }));
    };
    c.append(this.przelacznik('Cień pod elementem', () => Boolean(obj.shadow), (v) => { if (v) ustaw({}); else obj.set('shadow', null); this.zbuduj(); }));
    if (!obj.shadow) return;
    c.append(this.kolor('Kolor cienia', () => `#${kolorCienia().toHex()}`, (v) => ustaw({ hex: v })));
    c.append(this.liczba('Siła', () => Math.round(kolorCienia().getAlpha() * 100), (v) => ustaw({ moc: Math.min(100, Math.max(5, v)) / 100 }), { jednostka: '%', krok: 5, min: 5 }));
    c.append(this.liczba('W prawo', () => zaokr(obj.shadow.offsetX, 1), (v) => ustaw({ x: v }), { jednostka: 'mm', krok: 0.5 }));
    c.append(this.liczba('W dół', () => zaokr(obj.shadow.offsetY, 1), (v) => ustaw({ y: v }), { jednostka: 'mm', krok: 0.5 }));
    c.append(this.liczba('Rozmycie', () => zaokr(obj.shadow.blur, 1), (v) => ustaw({ blur: Math.max(0, v) }), { jednostka: 'mm', krok: 0.5, min: 0 }));
  }

  // Wykończenie druku (#127, #167): lakier, złocenie, tłoczenie, biel i farba specjalna – jedna część, wybór
  // kafelkami z opisem. Nic nie trzeba wcześniej dodawać: płyta wykończenia powstaje sama w PDF, a nowy kolor
  // dodatkowy – w projekcie. „Jak”: kolor elementu zostaje, a efekt idzie na kopię nad nim (np. lakier na zdjęciu),
  // albo element jest samym efektem, bez farby (np. złocony napis).
  zbudujUszlachetnienie(obj) {
    if (toZaznaczenie(obj) || obj.type === 'group' || toTabela(obj) || obj.group) return;
    const u = plytaUszlachetnienia(obj);
    const s = this.sekcja('Wykończenie druku: lakier, złocenie, tłoczenie', { zwinieta: !u });
    const obraz = obj.type === 'image' || (obj.zasob && !obj.fill);
    if (!u) {
      const jak = this.jakWykonczenie || (obraz ? 'kopia' : 'sam');
      const rzad = document.createElement('div');
      rzad.className = 'segmenty tekstowe jak-wykonczenie';
      rzad.setAttribute('role', 'group');
      rzad.setAttribute('aria-label', 'Jak dodać wykończenie');
      for (const [id, tekst, tytul] of [['kopia', 'Kolor + efekt', 'Element drukuje się w kolorze, a efekt idzie na wierzch (np. lakier na zdjęciu)'], ['sam', 'Sam efekt', 'Element jest samym efektem, bez farby (np. złocony napis)']]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = tekst;
        b.title = tytul;
        b.setAttribute('aria-pressed', String(jak === id));
        b.addEventListener('click', () => { this.jakWykonczenie = id; this.zbuduj(); });
        rzad.append(b);
      }
      const opak = document.createElement('div');
      opak.className = 'jak-wykonczenie-pole';
      const etykieta = document.createElement('label');
      etykieta.textContent = 'Jak';
      opak.append(etykieta, rzad);
      s.append(opak);
    }
    const wybor = document.createElement('div');
    wybor.className = 'wybor-wykonczenia';
    wybor.setAttribute('role', 'group');
    wybor.setAttribute('aria-label', 'Wykończenie druku');
    const OPCJE = [['', 'Brak'], ...USZLACHETNIENIA.map((x) => [x.id, KROTKO_WYKONCZEN[x.id] || x.nazwa])];
    const zapisz = async (v) => {
      if (!v) obj.set({ uszlachetnienie: undefined, folia: undefined });
      else if (!u && (this.jakWykonczenie || (obraz ? 'kopia' : 'sam')) === 'kopia') await this.edytor.uszlachetnienieKopia(v);
      else obj.set({ uszlachetnienie: v, folia: v === 'folia' ? (obj.folia || 'zloto') : undefined });
      obj.dirty = true;
      this.edytor.zatwierdz();
    };
    for (const [id, tekst] of OPCJE) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.wykonczenie = id || 'brak';
      b.innerHTML = `${IKONY_WYKONCZEN[id || 'brak']}<span></span>`;
      b.querySelector('span').textContent = tekst;
      b.title = OPISY_WYKONCZEN[id || 'brak'];
      b.setAttribute('aria-pressed', String((obj.uszlachetnienie || '') === id));
      b.addEventListener('click', async () => { await zapisz(id); this.zbuduj(); });
      wybor.append(b);
    }
    s.append(wybor);
    if (obj.uszlachetnienie === 'folia') {
      s.append(this.wybor('Kolor folii', Object.entries(FOLIE).map(([k, f]) => [k, f.nazwa]), () => obj.folia || 'zloto', (v) => { obj.set('folia', v); obj.dirty = true; this.zbuduj(); }));
    }
    s.append(this.wskazowka(u
      ? `${OPISY_WYKONCZEN[u.id]} Ten element nie drukuje się farbą – w PDF trafia na osobną płytę „${u.plyta}”, z której drukarnia robi efekt.`
      : 'Wybierz efekt – nic nie trzeba wcześniej dodawać. W PDF każdy efekt to osobna płyta, z której drukarnia wie, gdzie go położyć. Na stronie widać go od razu (Widok → „Pokaż uszlachetnienia”).'));
    if (!obraz && typeof obj.fill === 'string' && !u) this.zbudujFarbeSpecjalna(s, obj);
  }

  // Farba specjalna (kolor dodatkowy, np. Pantone) dla wypełnienia elementu – wybór z projektu albo nowy kolor
  // dodatkowy z obecnego koloru, jednym krokiem (#167).
  zbudujFarbeSpecjalna(s, obj) {
    const projekt = globalThis.seriodruk?.stan?.projekt;
    if (!projekt || trybKolorow(projekt, sekcjaBiezaca(projekt)) === 'szarosc') return;
    const spoty = koloryDodatkowe(projekt);
    const mapa = mapaSpotow(spoty);
    const teraz = mapa.get(String(obj.fill).toLowerCase());
    const farba = s.appendChild(this.wybor('Farba specjalna (np. Pantone)', [['', 'Brak – zwykłe CMYK'], ...spoty.map((x) => [x.id, x.nazwa]), ['+', 'Nowa z obecnego koloru…']], () => teraz?.id || '', async (v) => {
      if (v === '+') {
        const nazwa = await zapytajONazwe('Nowy kolor dodatkowy', 'Nazwa farby (tak jak w drukarni, np. PANTONE 186 C)', 'PANTONE ');
        if (!nazwa) { this.zbuduj(); return; }
        const sp = dodajKolorDodatkowy(projekt, { nazwa, cmyk: rgbNaCmyk(obj.fill) });
        document.dispatchEvent(new CustomEvent('makietka:kolor-dodatkowy', { detail: sp }));
        obj.set('fill', hexSpotu(sp, 1));
      } else if (v) {
        obj.set('fill', hexSpotu(spoty.find((x) => x.id === v), teraz?.t || 1));
      } else if (teraz) {
        // Zwykłe CMYK: ten sam kolor na ekranie, ale poza rejestrem farb (o jeden stopień czerwieni obok).
        const h = String(obj.fill).toLowerCase();
        const r = parseInt(h.slice(1, 3), 16);
        obj.set('fill', `#${(r > 0 ? r - 1 : r + 1).toString(16).padStart(2, '0')}${h.slice(3)}`);
      }
      obj.dirty = true;
      this.edytor.zatwierdz();
      this.zbuduj();
    }));
    farba.style.gridColumn = '1 / -1';
    s.append(this.wskazowka(teraz ? `Wypełnienie drukuje się farbą „${teraz.nazwa}” (osobna płyta w PDF).` : 'Wypełnienie może iść osobną farbą, np. Pantone – osobna płyta w PDF. Nowa farba dostaje nazwę od Ciebie, a kolor – obecny.'));
  }

  zbudujLinie(obj) {
    const s = this.sekcja('Linia');
    s.append(this.kolor('Kolor', () => obj.stroke, (v) => obj.set('stroke', v)));
    // Kreski rosną razem z grubością (#143).
    const kreski = (rodzaj, grubosc) => ({ strokeDashArray: wzorKresek(rodzaj, grubosc), strokeLineCap: ['kropkowana', 'kreska-kropka'].includes(rodzaj) ? 'round' : (obj.type === 'path' ? 'round' : 'butt') });
    s.append(this.liczba('Grubość', () => zaokr(obj.strokeWidth, 2), (v) => {
      const g = Math.max(0.05, v);
      obj.set({ strokeWidth: g, strokeUniform: true, ...(rodzajKresek(obj) === 'ciagla' ? {} : kreski(rodzajKresek(obj), g)) });
    }, { jednostka: 'mm', krok: 0.1, min: 0.05 }));
    const rodzaj = this.wybor('Rodzaj', RODZAJE_KRESEK, () => rodzajKresek(obj), (v) => obj.set(kreski(v, obj.strokeWidth)));
    rodzaj.dataset.pole = 'rodzaj-linii';
    s.append(rodzaj);
    if (obj.type !== 'path') return;
    // Zamknięty kształt (z pióra) może mieć wypełnienie.
    if (obj.path?.some((k) => k[0] === 'Z')) s.append(this.kolor('Wypełnienie', () => (typeof obj.fill === 'string' ? obj.fill : ''), (v) => obj.set('fill', v || ''), { brak: true }));
    const punkty = this.akcje([['suwaki', 'Edytuj punkty', () => { if (!this.edytor.edytujPunkty(obj)) powiadom('Punkty edytuje się w kształcie, który nie jest zablokowany. Kształt w grupie: najpierw kliknij grupę dwa razy.'); }]]);
    s.append(punkty);
    s.append(this.wskazowka('Albo kliknij kształt dwa razy (na ekranie dotykowym: stuknij dwa razy).'));
  }

  // Najczęstsze działania na zdjęciu – na samej górze, zaraz pod nagłówkiem (na telefonie bez przewijania).
  zbudujAkcjeObrazu(obj) {
    const definicje = [];
    if (this.opcje.podmienObraz) definicje.push(['obraz', 'Podmień zdjęcie', () => this.opcje.podmienObraz(obj)]);
    if (this.opcje.obrazyProjektu) definicje.push(['warstwy', 'Obrazy projektu…', () => this.opcje.obrazyProjektu()]);
    if (!definicje.length) return;
    const rzad = this.akcje(definicje);
    rzad.classList.add('akcje-obrazu');
    this.el.append(rzad);
  }

  zbudujObraz(obj) {
    const { nw, nh } = rozmiarOryginalu(obj);
    const kadr = this.sekcja('Kadrowanie');
    // Zdjęcie w kształcie (#123): zaokrąglone rogi albo koło – obraz staje się kształtem z obrazem.
    if (!obj.group) {
      const ksztalty = this.akcje([
        ['prostokat', 'Zaokrąglone rogi', () => this.edytor.obrazWKsztalt(obj, 'prostokat')],
        ['elipsa', 'Koło', () => this.edytor.obrazWKsztalt(obj, 'kolo')],
      ]);
      kadr.append(ksztalty);
    }
    if (this.opcje.usunTlo) kadr.append(this.akcje([['gumka', 'Usuń tło…', () => this.opcje.usunTlo(obj)]]));
    const kadrRamka = this.akcje([['dopasuj', 'Kadruj przeciąganiem', () => { if (!this.edytor.kadruj(obj)) powiadom('Zablokowany obraz przytnij liczbami poniżej.'); }]]);
    kadrRamka.classList.add('tylko-duzy-ekran');
    kadr.append(kadrRamka);
    const albo = this.wskazowka('Albo kliknij obraz dwa razy.');
    albo.classList.add('tylko-duzy-ekran');
    kadr.append(albo);
    // Na telefonie kadrowania ramką nie ma – zostaje przycięcie liczbami.
    const telefon = this.wskazowka('Na telefonie przytniesz obraz liczbami w części „Przycięcie” niżej.');
    telefon.classList.add('tylko-maly-ekran');
    kadr.append(telefon);
    if (this.opcje.toRysunekSvg?.(obj)) {
      const r = this.sekcja('Rysunek SVG');
      r.append(this.akcje([['rozgrupuj', 'Rozłóż rysunek na elementy', () => this.opcje.rozlozRysunek(obj)]]));
      r.append(this.wskazowka('Obraz zamieni się w grupę zwykłych kształtów i napisów: można ją rozgrupować, zmieniać kolory i punkty, poprawiać napisy. Napis zachowa czcionkę, jeśli jest ona w zestawie albo w projekcie.'));
    }
    const s = this.sekcja('Przycięcie (% oryginału)');
    const kraw = () => ({
      l: obj.cropX / nw,
      t: obj.cropY / nh,
      r: 1 - (obj.cropX + obj.width) / nw,
      b: 1 - (obj.cropY + obj.height) / nh,
    });
    const ustaw = (zmiana) => {
      const k = { ...kraw(), ...zmiana };
      for (const klucz of Object.keys(k)) k[klucz] = Math.min(0.95, Math.max(0, k[klucz]));
      if (k.l + k.r > 0.95) k.r = 0.95 - k.l;
      if (k.t + k.b > 0.95) k.b = 0.95 - k.t;
      const nowyCropX = k.l * nw;
      const nowyCropY = k.t * nh;
      // Treść obrazu zostaje w miejscu – przesuwamy obiekt o przycięty fragment.
      const rad = fabric.util.degreesToRadians(obj.angle || 0);
      const dx = (nowyCropX - obj.cropX) * obj.scaleX;
      const dy = (nowyCropY - obj.cropY) * obj.scaleY;
      obj.set({
        left: obj.left + dx * Math.cos(rad) - dy * Math.sin(rad),
        top: obj.top + dx * Math.sin(rad) + dy * Math.cos(rad),
        cropX: nowyCropX,
        cropY: nowyCropY,
        width: nw * (1 - k.l - k.r),
        height: nh * (1 - k.t - k.b),
      });
    };
    const pole = (etyk, klucz) => this.liczba(etyk, () => zaokr(kraw()[klucz] * 100, 1), (v) => ustaw({ [klucz]: v / 100 }), { jednostka: '%', krok: 1, min: 0 });
    s.append(pole('Z lewej', 'l'), pole('Z prawej', 'r'), pole('Z góry', 't'), pole('Z dołu', 'b'));

    // Obraz z danych: kolumna tabeli podaje nazwę pliku wgranego do projektu.
    const kolumny = this.opcje.kolumnyObrazu?.() || [];
    const d = this.sekcja('Obraz z danych');
    if (kolumny.length) {
      const wybor = this.wybor('Kolumna z nazwą pliku', [['', 'Stały obraz'], ...kolumny.map((k) => [k, k])], () => obj.pole?.kolumna || '', (v) => { obj.pole = v ? { ...obj.pole, kolumna: v } : undefined; this.zbuduj(); });
      wybor.classList.add('szeroki');
      d.append(wybor);
      if (obj.pole?.kolumna) {
        const tryb = this.wybor('Podmieniony obraz', [['zmiesc', 'mieści się w ramce (cały widoczny)'], ['wypelnij', 'wypełnia ramkę (brzegi przycięte)']], () => obj.pole?.tryb || 'zmiesc', (v) => { obj.pole = { ...obj.pole, tryb: v === 'wypelnij' ? 'wypelnij' : undefined }; this.zbuduj(); });
        tryb.classList.add('szeroki');
        d.append(tryb);
        if (obj.pole?.tryb === 'wypelnij') {
          // Która część zdjęcia zostaje po przycięciu – np. „góra”, żeby nie ucinać głów na portretach.
          const kadr = this.wybor('Zostaje część zdjęcia', [['', 'środek'], ['gora', 'góra'], ['dol', 'dół'], ['lewa', 'lewa strona'], ['prawa', 'prawa strona']], () => obj.pole?.kadr || '', (v) => { obj.pole = { ...obj.pole, kadr: v || undefined }; });
          kadr.classList.add('szeroki');
          d.append(kadr);
          // Kadr osobno dla każdego wiersza: kolumna z nazwą części zdjęcia albo z punktem w procentach.
          const zKolumny = this.wybor('Kadr z kolumny', [['', 'ten sam na każdej stronie'], ...kolumny.filter((k) => k !== obj.pole.kolumna).map((k) => [k, k])], () => obj.pole?.kadr_z || '', (v) => { obj.pole = { ...obj.pole, kadr_z: v || undefined }; this.zbuduj(); });
          zKolumny.classList.add('szeroki');
          d.append(zKolumny);
          if (obj.pole?.kadr_z) d.append(this.wskazowka('W tej kolumnie wpisz, która część zdjęcia ma zostać: góra, dół, lewa, prawa, środek – albo punkt zdjęcia w procentach od lewej i od góry, np. „30% 20%”. Pusta komórka zostawia ustawienie powyżej.'));
        }
      }
    }
    d.append(this.wskazowka(kolumny.length
      ? 'Na każdej powielonej stronie pojawi się obraz o nazwie wpisanej w tej kolumnie (np. zdjecie-01.jpg), wpisany w ramkę tego obrazu. Pliki wgraj w oknie „Obrazy projektu” (przycisk u góry panelu) – tam też skopiujesz ich nazwy do tabeli.'
      : 'Gdy strona należy do serii z tabelą, ten obraz może się zmieniać na każdej powielonej stronie – według nazwy pliku z wybranej kolumny.'));

    this.zbudujFiltry(obj);
    // Obramowanie (#156): kolor z kryciem, grubość, rodzaj linii i zaokrąglone narożniki (przycinają też obraz).
    const o = this.sekcja('Obramowanie');
    this.polaObrysu(o, obj);
    o.append(this.liczba('Zaokrąglenie narożników', () => zaokr(obj.zaokraglenie || 0, 1), (v) => { obj.set('zaokraglenie', v > 0 ? Math.round(v * 10) / 10 : undefined); obj.dirty = true; }, { jednostka: 'mm', krok: 0.5, min: 0 }));
    o.append(this.przelacznik('Odbij lustrzanie w poziomie', () => Boolean(obj.flipX), (v) => obj.set('flipX', v)));
    const info = this.wskazowka('');
    this.odswiezacze.push(() => {
      const dpi = Math.round(25.4 / obj.scaleX); // px oryginału na cal wydruku
      info.textContent = `Oryginał ${nw} × ${nh} px · ${dpi} dpi w tym rozmiarze.${dpi < 300 ? ' Do druku zalecane jest 300 dpi – zmniejsz obraz albo użyj większego pliku.' : ''}`;
      info.classList.toggle('uwaga', dpi < 300);
    });
    o.append(info);
    this.odswiezacze.at(-1)();
  }

  // ---------- Kontrolki ----------

  // Sekcję panelu można zwinąć kliknięciem w jej tytuł; wybór jest pamiętany
  // na urządzeniu (osobno dla każdego tytułu), bo panel bywa długi.
  // opcje.zwinieta: sekcja zaczyna zwinięta (dopóki ktoś jej nie rozwinie – zapamiętane jak zwinięcie).
  sekcja(tytul, { zwinieta: domyslnieZwinieta = false } = {}) {
    const f = document.createElement('fieldset');
    // Pierwsza sekcja o tej samej nazwie co nagłówek panelu – bez powtórzenia.
    if (!(this.el.children.length === 0 && tytul === this.tytul.textContent)) {
      const klucz = tytul.replace(/„.*”/, '').trim();
      const l = document.createElement('legend');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'zwijak';
      b.textContent = tytul;
      const ustaw = (zwinieta) => { f.classList.toggle('zwinieta', zwinieta); b.setAttribute('aria-expanded', String(!zwinieta)); };
      // Sekcja domyślnie zwinięta zapamiętuje rozwinięcie (klucz z „+”), zwykła – zwinięcie.
      const zapisany = domyslnieZwinieta ? `+${klucz}` : klucz;
      const czyZwinieta = (z) => (domyslnieZwinieta ? !z.has(zapisany) : z.has(zapisany));
      ustaw(czyZwinieta(zwiniete()));
      b.addEventListener('click', () => {
        const z = zwiniete();
        if (z.has(zapisany)) z.delete(zapisany); else z.add(zapisany);
        try { localStorage.setItem(KLUCZ_ZWINIETE, JSON.stringify([...z])); } catch { /* tryb prywatny */ }
        ustaw(czyZwinieta(z));
      });
      l.append(b);
      f.append(l);
    }
    this.el.append(f);
    return f;
  }

  _zapisz(fn, zatwierdz = true) {
    return (v) => {
      fn(v);
      if (zatwierdz) this.edytor.zatwierdz();
      this.odswiez();
    };
  }

  // krotko – skrót nazwy pokazywany na telefonie w samym polu (zamiast nazwy nad nim), np. „Szer.”.
  liczba(etykieta, get, set, { jednostka = '', krok = 0.5, min, wylaczone = false, krotko = '', bezZatwierdzania = false } = {}) {
    const label = document.createElement('label');
    const opak = document.createElement('div');
    opak.className = 'jednostka';
    if (krotko) {
      const pelna = document.createElement('span');
      pelna.className = 'nazwa-pelna';
      pelna.textContent = etykieta;
      label.append(pelna);
      label.classList.add('z-krotka');
      label.style.setProperty('--krotko', String(krotko.length));
      const k = document.createElement('i');
      k.className = 'nazwa-krotka';
      k.setAttribute('aria-hidden', 'true');
      k.textContent = krotko;
      opak.append(k);
    } else {
      label.append(etykieta);
    }
    const input = document.createElement('input');
    input.type = 'number';
    input.step = String(krok);
    input.inputMode = 'decimal';
    if (min !== undefined) input.min = String(min);
    input.disabled = wylaczone;
    const zapisz = this._zapisz(set, !bezZatwierdzania);
    input.addEventListener('change', () => {
      const v = parseFloat(input.value.replace(',', '.'));
      if (Number.isFinite(v)) zapisz(v);
      else input.value = get();
    });
    opak.append(input);
    if (jednostka) {
      const sp = document.createElement('span');
      sp.textContent = jednostka;
      opak.append(sp);
    }
    label.append(opak);
    const odswiez = () => { if (document.activeElement !== input) input.value = get(); };
    this.odswiezacze.push(odswiez);
    odswiez();
    return label;
  }

  tekst(etykieta, get, set, szeroki = false, zatwierdz = true) {
    const label = document.createElement('label');
    if (szeroki) label.className = 'szeroki';
    label.append(etykieta);
    const input = document.createElement('input');
    input.type = 'text';
    const zapisz = this._zapisz(set, zatwierdz);
    input.addEventListener('change', () => zapisz(input.value.trim()));
    label.append(input);
    const odswiez = () => { if (document.activeElement !== input) input.value = get(); };
    this.odswiezacze.push(odswiez);
    odswiez();
    return label;
  }

  // Lista „Wstaw pole”: kolumny tabel i pola dokumentu. Wybrane pole trafia
  // do tekstu jako {nazwa} – w miejscu kursora albo na końcu.
  wstawianiePola() {
    const label = document.createElement('label');
    label.className = 'szeroki';
    label.append('Wstaw pole');
    const sel = document.createElement('select');
    sel.className = 'wstaw-pole';
    sel.append(new Option('Wybierz pole z tabeli albo dokumentu…', ''));
    for (const { grupa, pola } of this.opcje.pola?.() || []) {
      const g = document.createElement('optgroup');
      g.label = grupa;
      for (const [nazwa, opis] of pola) g.append(new Option(opis ? `{${nazwa}} – ${opis}` : `{${nazwa}}`, nazwa));
      sel.append(g);
    }
    sel.addEventListener('change', () => {
      if (sel.value) this.edytor.wstawPole(sel.value);
      sel.value = '';
    });
    label.append(sel);
    return label;
  }

  obszarTekstu(etykieta, get, set) {
    const label = document.createElement('label');
    label.className = 'szeroki';
    label.append(etykieta);
    const ta = document.createElement('textarea');
    ta.rows = 3;
    ta.addEventListener('input', () => {
      set(ta.value);
      this.edytor.canvas.requestRenderAll();
    });
    ta.addEventListener('change', () => this.edytor.zatwierdz());
    label.append(ta);
    const odswiez = () => { if (document.activeElement !== ta) ta.value = get(); };
    this.odswiezacze.push(odswiez);
    odswiez();
    return label;
  }

  wybor(etykieta, opcje, get, set) {
    const label = document.createElement('label');
    label.append(etykieta);
    const sel = document.createElement('select');
    const opcja = (wartosc, opis) => {
      const o = document.createElement('option');
      o.value = wartosc;
      o.textContent = opis;
      if (this._czcionkiWLiscie && wartosc !== '+' && !wartosc.startsWith('moja:')) o.style.fontFamily = `"${wartosc}"`;
      return o;
    };
    // Pozycja { grupa, opcje } – nagłówek grupy na liście (np. „Użyte w projekcie” nad czcionkami).
    for (const p of opcje) {
      if (p && !Array.isArray(p) && p.grupa) {
        const g = document.createElement('optgroup');
        g.label = p.grupa;
        for (const [w, o] of p.opcje) g.append(opcja(w, o));
        sel.append(g);
      } else sel.append(opcja(p[0], p[1]));
    }
    const zapisz = this._zapisz(set);
    sel.addEventListener('change', () => zapisz(sel.value));
    label.append(sel);
    const odswiez = () => {
      const v = get();
      if (![...sel.options].some((o) => o.value === v)) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = this._czcionkiWLiscie ? `${v} (spoza listy)` : v;
        sel.append(o);
      }
      sel.value = v;
      // Ta sama pozycja w dwóch grupach („Użyte w projekcie” i pełna lista): zaznaczona ta z pełnej listy,
      // żeby na przycisku stała sama nazwa, bez liczby użyć.
      const ostatnia = [...sel.options].filter((o) => o.value === v).pop();
      if (ostatnia) ostatnia.selected = true;
    };
    this.odswiezacze.push(odswiez);
    odswiez();
    return label;
  }

  // Kolor tekstu jako kółko na prawym brzegu wiersza „Rozmiar” (#109) zamiast osobnego pola.
  _zKolorem(rozmiar, kolor) {
    const wiersz = document.createElement('div');
    wiersz.className = 'rozmiar-z-kolorem';
    const kolko = kolor.querySelector('.kolor');
    kolko.classList.add('kolko');
    kolko.title = 'Kolor tekstu';
    const pole = rozmiar.querySelector('.jednostka');
    pole.before(wiersz);
    wiersz.append(pole, kolko);
    return rozmiar;
  }

  kolor(etykieta, get, set, { brak = false, bezZatwierdzania = false } = {}) {
    const label = document.createElement('label');
    label.append(etykieta);
    const wiersz = document.createElement('div');
    wiersz.className = 'kolor';
    const input = document.createElement('input');
    input.type = 'color';
    const zapisz = this._zapisz(set, !bezZatwierdzania);
    input.addEventListener('input', () => {
      set(input.value);
      this.edytor.canvas.requestRenderAll();
    });
    input.addEventListener('change', () => zapisz(input.value));
    wiersz.append(input);
    let brakInput = null;
    if (brak) {
      const l = document.createElement('label');
      l.className = 'przelacznik';
      brakInput = document.createElement('input');
      brakInput.type = 'checkbox';
      brakInput.addEventListener('change', () => zapisz(brakInput.checked ? null : input.value));
      l.append(brakInput, 'brak');
      wiersz.append(l);
    }
    label.append(wiersz);
    const odswiez = () => {
      const v = get();
      const hex = naHex(v);
      if (hex) input.value = hex;
      if (brakInput) brakInput.checked = !v || v === 'transparent';
      input.disabled = Boolean(brakInput?.checked);
    };
    this.odswiezacze.push(odswiez);
    odswiez();
    return label;
  }

  przelacznik(etykieta, get, set) {
    const label = document.createElement('label');
    label.className = 'przelacznik szeroki';
    const input = document.createElement('input');
    input.type = 'checkbox';
    const zapisz = this._zapisz(set);
    input.addEventListener('change', () => zapisz(input.checked));
    label.append(input, etykieta);
    const odswiez = () => { input.checked = get(); };
    this.odswiezacze.push(odswiez);
    odswiez();
    return label;
  }

  // Grupa przycisków-ikon; aktywny == null oznacza zwykłą akcję.
  segmenty(etykieta, definicje, tekstowe = false) {
    const opak = document.createElement('div');
    const tytul = document.createElement('label');
    tytul.textContent = etykieta;
    const rzad = document.createElement('div');
    rzad.className = 'segmenty';
    rzad.setAttribute('role', 'group');
    rzad.setAttribute('aria-label', etykieta);
    const zapisz = this._zapisz(() => {});
    const elementy = definicje.map(([ik, opis, aktywny, klik]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = opis;
      b.setAttribute('aria-label', opis);
      if (tekstowe) { b.textContent = ik; b.classList.add('tekstowy'); } else b.innerHTML = ikona(ik, { rozmiar: 18 });
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { klik(); if (aktywny || tekstowe) zapisz(); else this.odswiez(); });
      rzad.append(b);
      return [b, aktywny];
    });
    opak.append(tytul, rzad);
    const odswiez = () => elementy.forEach(([b, aktywny]) => {
      if (!aktywny) return;
      const a = Boolean(aktywny());
      b.classList.toggle('aktywny', a);
      b.setAttribute('aria-pressed', String(a));
    });
    this.odswiezacze.push(odswiez);
    odswiez();
    return opak;
  }

  // „Wiersze [−] 4 [+]”: podpis, przycisk-ikona minus, liczba, przycisk-ikona plus (opis w podpowiedzi i aria-label).
  licznikTabeli(podpis, ile, [opisMinus, minus], [opisPlus, plus]) {
    const rzad = document.createElement('div');
    rzad.className = 'licznik-wiersz';
    const nazwa = document.createElement('span');
    nazwa.className = 'licznik-podpis';
    nazwa.textContent = podpis;
    const b = (ik, opis, klik) => {
      const p = document.createElement('button');
      p.type = 'button';
      p.className = 'przycisk-ikona';
      p.title = opis;
      p.setAttribute('aria-label', opis);
      p.innerHTML = ikona(ik, { rozmiar: 16 });
      p.addEventListener('click', klik);
      return p;
    };
    const liczba = document.createElement('output');
    liczba.className = 'licznik-liczba';
    liczba.textContent = String(ile);
    rzad.append(nazwa, b('minus', opisMinus, minus), liczba, b('plus', opisPlus, plus));
    return rzad;
  }

  akcje(definicje) {
    const rzad = document.createElement('div');
    rzad.className = 'rzad-przyciskow';
    for (const [ik, tekst, klik] of definicje) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'przycisk';
      b.innerHTML = ikona(ik, { rozmiar: 16 });
      b.append(tekst);
      b.addEventListener('click', klik);
      rzad.append(b);
    }
    return rzad;
  }

  wskazowka(tekst, uwaga = false) {
    const p = document.createElement('p');
    p.className = `wskazowka${uwaga ? ' uwaga' : ''}`;
    p.textContent = tekst;
    return p;
  }
}

function naHex(kolor) {
  if (!kolor || typeof kolor !== 'string' || kolor === 'transparent') return null;
  try {
    return `#${new fabric.Color(kolor).toHex()}`.toLowerCase();
  } catch {
    return null;
  }
}
