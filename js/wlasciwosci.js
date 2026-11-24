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
import { WZORY, podgladWzoru, moznaWzor } from './wzor-wypelnienia.js';
import { RODZAJE_KSZTALTU, normalizujKsztalt, ustawKontrolkiKsztaltu, sciezkaZKsztaltu, czyWygiecie } from './tekst-ksztalt.js';
import { toKalendarz, KOLORY_DOMYSLNE } from './kalendarz-miesiaca.js';
import { miesiaceWielka } from './nazwy-dat.js';
import { toWykres, RODZAJE, PALETA, normalizujWykres } from './wykres.js';
import { KOLAZE, RODZAJE_KRESEK, wzorKresek, rodzajKresek } from './ksztalty-biblioteka.js';
import { RODZAJE_MIEKKICH, maMiekkie } from './miekkie-krawedzie.js';
import { toKod, domyslnyKod, uwagiKodu, EAN_NOMINAL } from './kod-obiekt.js';
import { trescQR } from './kody.js';
import { naglowkiProjektu, celeOdsylaczy, LICZENIE_PRZYPISOW, RODZAJE as RODZAJE_KSIAZKI } from './ksiazka.js';
import { ikona } from './ikony.js';
import { poprawkiZnakow, uwagiSkladuTekstu, zasadyPl } from './zasady-skladu.js';
import { uzyteCzcionki } from './kontrolki.js';
import { maPrzejscie } from './pola.js';
import { stylZObiektu, zastosujStyl, POLA_STYLU, rowneWStylu, stylZnakowyZFragmentu, zastosujStylZnakowy, stylZnakowyNaPozycji } from './style-tekstu.js';
import { zapytajONazwe, potwierdz, powiadom } from './ui.js';
import { toTabela, komorkiTabeli, ustawSzerokoscKolumny, ustawNaglowek, ustawTekstTabeli, ulozTabele, wysokosciWierszy, ustawTloTabeli, ustawWysokoscWiersza, krawedzKomorki, ustawKrawedzKomorki, ustawLinieZakresu } from './tabela-obiekt.js';
import { t as tt } from './jezyk.js';

const TEKSTOWE = new Set(['textbox', 'i-text', 'text']);
const KSZTALTY = new Set(['rect', 'ellipse', 'polygon']);

// Wykończenie druku (#167): krótkie nazwy na kafelkach, opis prostymi słowami i ikona każdego efektu.
const KROTKO_WYKONCZEN = { uv: 'Lakier', folia: 'Złocenie', tloczenie: 'Tłoczenie', wytloczenie: 'Wytłoczenie', bialy: 'Biel', ciecie: 'Cięcie', big: 'Big', perforacja: 'Perforacja', klej: 'Klej' };
const OPISY_WYKONCZEN = {
  brak: 'Zwykły druk – bez wykończenia.',
  uv: 'Lakier wybiórczy: błyszcząca warstwa tylko w tym miejscu, np. tytuł na matowej okładce.',
  folia: 'Złocenie: metaliczna folia – złoto, srebro albo miedź.',
  tloczenie: 'Tłoczenie: wypukły relief wyciśnięty w papierze.',
  wytloczenie: 'Wytłoczenie: wklęsły relief wciśnięty w papier.',
  bialy: 'Biel: biała farba pod spodem – na kolorowym, kraftowym albo przezroczystym podłożu.',
  ciecie: 'Linia cięcia (wykrojnik): kontur elementu to miejsce, w którym nóż albo ploter tnie. Grupa – każdy jej kształt.',
  big: 'Big: linia zgięcia – introligatornia albo ploter ją wgniata, żeby karton zgiął się równo.',
  perforacja: 'Perforacja: linia do oderwania (kupon, bilet, kartka kalendarza).',
  klej: 'Miejsce klejenia: pole, na które idzie klej (np. zakładka pudełka albo koperty).',
};
const ik = (sciezki) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${sciezki}</svg>`;
const IKONY_WYKONCZEN = {
  brak: ik('<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>'),
  uv: ik('<path d="M12 3.5c3.2 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.3-6 5.5-10z"/><path d="M9.6 14.2a2.6 2.6 0 0 0 2 2.3"/>'),
  folia: ik('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
  tloczenie: ik('<path d="M3.5 17.5h17"/><path d="M6.5 17.5v-5.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v5.5"/><path d="M9 10V7.5"/><path d="M15 10V7.5"/>'),
  wytloczenie: ik('<path d="M3.5 9.5h3v5.5a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V9.5h3"/><path d="M9 17v2.5"/><path d="M15 17v2.5"/>'),
  bialy: ik('<rect x="4.5" y="4.5" width="15" height="15" rx="2"/><path d="M4.5 12h15M12 4.5v15"/><path d="M4.5 4.5L12 12M12 12l7.5 7.5" stroke-opacity=".45"/>'),
  ciecie: ik('<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5L20 16M8 15.5L20 8"/>'),
  big: ik('<path d="M4 18l8-12 8 12" stroke-dasharray="2.5 2"/>'),
  perforacja: ik('<path d="M3.5 12h17" stroke-dasharray="0.5 2.5" stroke-width="2.2"/><path d="M6 6.5h12M6 17.5h12" stroke-opacity=".45"/>'),
  klej: ik('<rect x="4.5" y="6.5" width="15" height="11" rx="1.5"/><path d="M7 15l4-4M10 15l5-5M13 15l4-4" stroke-opacity=".6"/>'),
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
      this.tytul.textContent = tt('wlasciwosci.rysowanie');
      const e = this.edytor;
      const s = this.sekcja(tt('wlasciwosci.pedzel'));
      s.append(this.kolor(tt('wlasciwosci.kolorLinii'), () => e.pedzel.kolor, (v) => e.ustawPedzel({ kolor: v }), { bezZatwierdzania: true }));
      s.append(this.liczba(tt('wlasciwosci.gruboscLinii'), () => zaokr(e.pedzel.grubosc, 2), (v) => e.ustawPedzel({ grubosc: Math.max(0.1, v) }), { jednostka: 'mm', krok: 0.1, min: 0.1, bezZatwierdzania: true }));
      s.append(this.wskazowka(tt('wlasciwosci.przeciagajPoStronieZeby')));
      s.append(this.akcje([['zamknij', 'Zakończ rysowanie', () => e.ustawRysowanie(false)]]));
      return;
    }
    // Pióro i edycja punktów kształtu: krótka ściąga zamiast właściwości strony.
    if (this.edytor.pioro) {
      this.tytul.textContent = tt('wlasciwosci.pioro');
      const s = this.sekcja(tt('wlasciwosci.ksztaltZPunktow'));
      const ile = this.edytor.punktyPiora;
      s.append(this.wskazowka(tt('wlasciwosci.klikniecieStawiaPunktKlikniecie')));
      s.append(this.wskazowka(ile ? tt('wlasciwosci.punktowWZaczetymKsztalcie', { ile }) : tt('wlasciwosci.kliknijNaStronieZeby')));
      s.append(this.akcje([...(ile > 1 ? [['ok', 'Zakończ kształt', () => this.edytor.zakonczKsztaltPiora()]] : []), ['zamknij', 'Wyłącz pióro', () => this.edytor.ustawPioro(false)]]));
      return;
    }
    if (this.edytor.edytujePunkty) {
      this.tytul.textContent = tt('wlasciwosci.punktyKsztaltu');
      const s = this.sekcja(tt('wlasciwosci.edycjaPunktow'));
      const p = this.edytor.punktyKsztaltu;
      s.append(this.wskazowka(tt('wlasciwosci.przeciagajPunktyZaznaczonyPunkt')));
      s.append(this.wskazowka(tt('wlasciwosci.punktow', { ile: p.ile, x: p.wybrany >= 0 ? tt('wlasciwosci.zaznaczony', { x: p.wybrany + 1 }) : '' })));
      s.append(this.akcje([...(p.wybrany >= 0 ? [['kosz', 'Usuń punkt', () => { if (!this.edytor.usunPunkt()) powiadom(tt('wlasciwosci.ksztaltMusiMiecCo')); }]] : []), ['ok', 'Gotowe', () => this.edytor.zakonczPunkty(true)], ['zamknij', 'Anuluj', () => this.edytor.zakonczPunkty(false)]]));
      return;
    }
    if (!obj) {
      this.tytul.textContent = this.opcje.tytulPusty();
      this.opcje.budujPusty(this);
      return;
    }
    if (obj.kadr) {
      this.tytul.textContent = tt('wlasciwosci.kadrowanie');
      const s = this.sekcja(tt('wlasciwosci.kadr'));
      s.append(this.wskazowka(this.edytor._kadr?.ksztalt
        ? tt('wlasciwosci.przesunObrazIPowieksz')
        : tt('wlasciwosci.przesunIRozciagnijRamke')));
      s.append(this.akcje([['ok', 'Zastosuj', () => this.edytor.zakonczKadrowanie(true)], ['zamknij', 'Anuluj', () => this.edytor.zakonczKadrowanie(false)]]));
      return;
    }
    if (toZaznaczenie(obj)) {
      this.tytul.textContent = tt('wlasciwosci.zaznaczoneElementy', { size: obj.size() });
      const s = this.sekcja(tt('wlasciwosci.zaznaczenie'));
      const wOtwartej = this.edytor.wOtwartejGrupie(obj);
      s.append(this.wskazowka(wOtwartej
        ? tt('wlasciwosci.toElementyOtwartejGrupy')
        : tt('wlasciwosci.przesuwaszJeRazemZgrupuj')));
      s.append(this.akcje([['grupuj', 'Zgrupuj', () => this.edytor.grupuj()], ...(wOtwartej ? [['grupuj', 'Wróć do całej grupy', () => this.edytor.zamknijGrupe()]] : []),
        ...(this.opcje.zapiszWBibliotece && !wOtwartej ? [['zapisz_w_bibliotece', 'Zapisz w bibliotece', () => this.opcje.zapiszWBibliotece()]] : [])]));
      if (obj.getObjects().every((o) => o.type === 'textbox')) {
        const p = this.sekcja(tt('wlasciwosci.przelewanieTekstu'));
        p.append(this.wskazowka(tt('wlasciwosci.poPolaczeniuTekstKtory')));
        p.append(this.akcje([['link', 'Połącz ramki tekstu', () => this.edytor.polaczRamki()]]));
      }
      this.zbudujWyrownanie(obj.size());
      this.zbudujGeometrie(obj, { tylkoPozycja: true });
      // Kolejność kilku elementów naraz: przesuwają się razem, między sobą zostają ułożone jak były.
      const kol = this.sekcja(tt('wlasciwosci.kolejnosc'));
      const e = this.edytor;
      const seg = this.segmenty(tt('wlasciwosci.warstwa'), [
        ['naWierzch', tt('wlasciwosci.naWierzch'), null, () => e.warstwa('wierzch')],
        ['wyzej', tt('wlasciwosci.wyzej'), null, () => e.warstwa('wyzej')],
        ['nizej', tt('wlasciwosci.nizej'), null, () => e.warstwa('nizej')],
        ['naSpod', tt('wlasciwosci.naSpod'), null, () => e.warstwa('spod')],
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
      this.tytul.textContent = tt('wlasciwosci.wGrupie', { nazwaTypu: nazwaTypu(obj) });
      const g = this.sekcja(tt('wlasciwosci.elementGrupy'));
      g.append(this.wskazowka(tt('wlasciwosci.zmieniaszJedenElementGrupy')));
      g.append(this.akcje([['grupuj', 'Wróć do całej grupy', () => this.edytor.zamknijGrupe()]]));
    }
    // Część składanki (#233): krawędzie, zgięcia, miejsca klejenia, szczeliny – bez skalowania.
    if (obj.czesc && this.opcje.czesc) {
      this.opcje.czesc(this, obj);
      this.zbudujGeometrie(obj, { tylkoPozycja: true });
      this.zbudujKolejnosc(obj);
      return;
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
    const inne = this.sekcja(tt('wlasciwosci.inne'));
    if (!wGrupie) inne.append(this.przelacznik(tt('wlasciwosci.zablokujPolozenieIRozmiar'), () => Boolean(obj.zablokowany), (v) => this.edytor.ustawBlokade(obj, v)));
    // Rozkładówki (js/boki-stron.js): gdy strona przejdzie z prawej na lewą (albo odwrotnie), elementy idą na lustrzane
    // miejsca – ten zostaje tam, gdzie jest.
    if (!wGrupie && !obj.zWzorca) inne.append(this.przelacznik(tt('wlasciwosci.stalaPozycjaGdyStrona'), () => Boolean(obj.stala_pozycja), (v) => { obj.stala_pozycja = v || undefined; }));
    inne.append(this.tekst(tt('wlasciwosci.nazwaElementuOpcjonalnie'), () => obj.nazwa || '', (v) => { obj.nazwa = v || undefined; }, true));
    // Link (#131C): w PDF do czytania na ekranie element jest klikalny (adres strony, e-mail, telefon).
    if (!wGrupie) {
      const link = this.tekst(tt('wlasciwosci.linkWPdfAdres'), () => obj.link || '', (v) => { obj.link = String(v || '').trim() || undefined; }, true);
      link.title = tt('wlasciwosci.wPlikuPdfDo');
      inne.append(link);
    }
    inne.append(this.liczba(tt('wlasciwosci.krycie'), () => zaokr((obj.opacity ?? 1) * 100, 0), (v) => { obj.opacity = Math.min(100, Math.max(0, v)) / 100; }, { jednostka: '%', krok: 5 }));
    // Oblewanie tekstem (#131): teksty na stronie opływają ten element.
    if (obj.type !== 'textbox' && !wGrupie) {
      const ksztalt = ['ellipse', 'circle', 'polygon', 'polyline', 'path'].includes(obj.type);
      const obl = this.wybor(tt('wlasciwosci.oblewanieTekstem'), [
        ['', tt('wlasciwosci.brakTekstMozeNa')],
        ['prostokat', tt('wlasciwosci.tekstOplywaRamkeElementu')],
        ...(ksztalt ? [['ksztalt', tt('wlasciwosci.tekstOplywaKsztalt')]] : []),
        ['skok', tt('wlasciwosci.tekstPrzeskakujePodElement')],
      ], () => obj.oblewanie || '', (v) => { obj.oblewanie = v || undefined; this.edytor.ulozSkladStrony?.(); setTimeout(() => this.zbuduj()); });
      obl.classList.add('szeroki');
      inne.append(obl);
      if (obj.oblewanie) inne.append(this.liczba(tt('wlasciwosci.odstepTekstuOdElementu'), () => zaokr(obj.oblewanie_odstep ?? 2, 1), (v) => { obj.oblewanie_odstep = Math.max(0, Math.min(30, v)); this.edytor.ulozSkladStrony?.(); }, { jednostka: 'mm', krok: 0.5, min: 0 }));
    }
    if (wGrupie) return;
    this.opcje.dodatkiElementu?.(this, obj, inne);
    const okl = this.edytor.wydruk?.okladka;
    if (okl) {
      // Okładka (#119): do której części element jest przypięty – przy zmianie grzbietu element grzbietu zostaje
      // na jego środku, a element przodu przesuwa się razem z przodem.
      const auto = STREFY[strefaW(okl, obj.getCenterPoint().x)] || 'Tył';
      inne.append(this.wybor(tt('wlasciwosci.naOkladceTrzymaSie'), [['auto', tt('wlasciwosci.automatycznie', { toLowerCase: auto.toLowerCase() })], ['tyl', tt('wlasciwosci.tylu')], ['grzbiet', tt('wlasciwosci.grzbietu')], ['przod', tt('wlasciwosci.przodu')]],
        () => obj.okladka || 'auto', (v) => { obj.okladka = v === 'auto' ? undefined : v; }));
      if (obj.type !== 'textbox' && (obj.okladka === 'grzbiet' || (!obj.okladka && strefaW(okl, obj.getCenterPoint().x) === 'grzbiet'))) {
        inne.append(this.przelacznik(tt('wlasciwosci.dopasujSzerokoscDoGrzbietu'), () => Boolean(obj.okladka_dopasuj), (v) => { obj.okladka_dopasuj = v || undefined; }));
      }
    }
    inne.append(this.przelacznik(tt('wlasciwosci.wyciszOstrzezeniaDlaTego'), () => Boolean(obj.bez_ostrzezen), (v) => { obj.bez_ostrzezen = v || undefined; }));
  }

  legendaProwadnic(grzbiet = false) {
    const l = this.sekcja(tt('wlasciwosci.linieNaStronie'));
    const legenda = document.createElement('ul');
    legenda.className = 'legenda-prowadnic';
    legenda.innerHTML = `<li><i class="ciecie"></i>${tt('wlasciwosci.liniaCieciaKrawedzStrony')}</li>`
      + `<li><i class="spad"></i>${tt('wlasciwosci.spadZostanieOdciety')}</li>`
      + `<li><i class="margines"></i>${tt('wlasciwosci.marginesTrzymajWNim')}</li>`
      + (grzbiet ? `<li><i class="grzbiet"></i>${tt('wlasciwosci.grzbietZszyte')}</li>` : '');
    l.append(legenda);
    l.append(this.wskazowka(tt('wlasciwosci.kliknijElementNaStronie')));
    this.zbudujProwadnice();
    return l;
  }

  // Własne prowadnice: położenie każdej można wpisać liczbą (mm od lewej albo górnej krawędzi strony).
  zbudujProwadnice() {
    const e = this.edytor;
    const s = this.sekcja(tt('wlasciwosci.prowadnice'));
    e.prowadnice.forEach((p, i) => {
      const od = p.os === 'x' ? e.strony[p.strona].x : 0;
      const pole = this.liczba(`${tt(p.os === 'x' ? 'wlasciwosci.prowadnicaPionowa' : 'wlasciwosci.prowadnicaPozioma')}${e.strony.length > 1 ? tt(p.strona ? 'wlasciwosci.prowadnicaPrawa' : 'wlasciwosci.prowadnicaLewa') : ''}`, () => zaokr(p.poz - od, 2), (v) => e.ustawProwadnice(i, v), { jednostka: 'mm', krok: 0.5 });
      const usun = document.createElement('button');
      usun.type = 'button';
      usun.className = 'przycisk-ikona usun-prowadnice';
      usun.title = tt('wlasciwosci.usunProwadnice');
      usun.setAttribute('aria-label', tt('wlasciwosci.usunProwadnice'));
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
      ? tt('wlasciwosci.wpiszPolozenieWMm')
      : tt('wlasciwosci.dodajProwadniceTutajAlbo')));
  }

  zbudujWyrownanie(ile) {
    const e = this.edytor;
    const s = this.sekcja(ile > 1 ? tt('wlasciwosci.wyrownajDoSiebie') : tt('wlasciwosci.wyrownajDoMarginesow'));
    const wyr = this.segmenty(tt('wlasciwosci.wPoziomieIW'), [
      ['wyrownajLewo', tt('wlasciwosci.doLewej'), null, () => e.wyrownaj('lewo')],
      ['wyrownajSrodekX', tt('wlasciwosci.doSrodkaWPoziomie'), null, () => e.wyrownaj('srodekX')],
      ['wyrownajPrawo', tt('wlasciwosci.doPrawej'), null, () => e.wyrownaj('prawo')],
      ['wyrownajGora', tt('wlasciwosci.doGory'), null, () => e.wyrownaj('gora')],
      ['wyrownajSrodekY', tt('wlasciwosci.doSrodkaWPionie'), null, () => e.wyrownaj('srodekY')],
      ['wyrownajDol', tt('wlasciwosci.doDolu'), null, () => e.wyrownaj('dol')],
    ]);
    wyr.classList.add('szeroki');
    s.append(wyr);
    if (ile > 2) {
      const roz = this.segmenty(tt('wlasciwosci.rowneOdstepy'), [
        ['rozlozX', tt('wlasciwosci.rozlozRownoWPoziomie'), null, () => e.rozloz('x')],
        ['rozlozY', tt('wlasciwosci.rozlozRownoWPionie'), null, () => e.rozloz('y')],
      ]);
      s.append(roz);
    }
  }

  zbudujKolejnosc(obj) {
    const s = this.sekcja(tt('wlasciwosci.kolejnosc'));
    const e = this.edytor;
    const seg = this.segmenty(tt('wlasciwosci.warstwa'), [
      ['naWierzch', tt('wlasciwosci.naWierzch'), null, () => e.warstwa('wierzch')],
      ['wyzej', tt('wlasciwosci.wyzej'), null, () => e.warstwa('wyzej')],
      ['nizej', tt('wlasciwosci.nizej'), null, () => e.warstwa('nizej')],
      ['naSpod', tt('wlasciwosci.naSpod'), null, () => e.warstwa('spod')],
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
        ? tt('wlasciwosci.toGrupaWGrupie')
        : tt('wlasciwosci.pojedynczyElementGrupyZmienisz')));
    }
  }

  zbudujGeometrie(obj, { tylkoPozycja = false } = {}) {
    const s = this.sekcja(tt('wlasciwosci.polozenieIRozmiarMm'));
    s.classList.add('geometria');
    const e = this.edytor;
    // Element grupy ma własne położenie, skalę i kąt liczone względem grupy – w polach są wartości na arkuszu.
    const r = () => e.ukladRodzica(obj);
    s.append(this.liczba('X', () => zaokr(e.polozenieNaArkuszu(obj).x), (v) => e.ustawPolozenieNaArkuszu(obj, { x: v }), { jednostka: 'mm', krotko: 'X' }));
    s.append(this.liczba('Y', () => zaokr(e.polozenieNaArkuszu(obj).y), (v) => e.ustawPolozenieNaArkuszu(obj, { y: v }), { jednostka: 'mm', krotko: 'Y' }));
    if (tylkoPozycja) return;
    if (obj.type === 'line') {
      s.append(this.liczba(tt('wlasciwosci.dlugosc'), () => zaokr(Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1) * obj.scaleX * r().sx), (v) => {
        const dl = Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1) || 1;
        obj.scaleX = Math.max(0.1, v) / r().sx / dl;
        obj.scaleY = obj.scaleX;
      }, { jednostka: 'mm', min: 0.1, krotko: tt('wlasciwosci.dlugoscKrotko') }));
    } else {
      s.append(this.liczba(tt('wlasciwosci.szerokosc'), () => zaokr(obj.width * obj.scaleX * r().sx), (v) => {
        if (obj.type === 'textbox') obj.set('width', Math.max(1, v / r().sx));
        else obj.scaleX = Math.max(0.1, v) / r().sx / obj.width;
      }, { jednostka: 'mm', min: 0.1, krotko: 'Szer.' }));
      s.append(this.liczba(tt('wlasciwosci.wysokosc'), () => zaokr(obj.height * obj.scaleY * r().sy), (v) => {
        obj.scaleY = Math.max(0.1, v) / r().sy / obj.height;
      }, { jednostka: 'mm', min: 0.1, wylaczone: obj.type === 'textbox', krotko: 'Wys.' }));
    }
    const kat = (v) => ((v % 360) + 360) % 360;
    s.append(this.liczba(tt('wlasciwosci.obrot'), () => zaokr(obj.parent ? kat((obj.angle || 0) + r().kat) : (obj.angle || 0), 1), (v) => { obj.rotate(kat(v - r().kat)); }, { jednostka: '°', krok: 1, krotko: 'Obr.' }));
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
    const sek = this.sekcja(tt('wlasciwosci.kod'));
    sek.append(this.wybor(tt('wlasciwosci.rodzaj'), [['qr', tt('wlasciwosci.kodQr')], ['ean', tt('wlasciwosci.kodKreskowyEan13')]], () => k().rodzaj, (v) => {
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
      sek.append(this.wybor(tt('wlasciwosci.coZawiera'), [['adres', tt('wlasciwosci.adresStrony')], ['tekst', tt('wlasciwosci.tekst')], ['email', tt('wlasciwosci.eMail')], ['telefon', tt('wlasciwosci.telefon')], ['wifi', tt('wlasciwosci.siecWiFi')]], () => k().typ, (v) => {
        zmien({ typ: v, tresc: trescQR(v, k().dane) }, true);
      }));
      const typ = k().typ;
      if (typ === 'adres') sek.append(this.tekst(tt('wlasciwosci.adres'), dana('adres'), ustawDane('adres'), true));
      if (typ === 'tekst') sek.append(this.obszarTekstu('Tekst', dana('tekst'), ustawDane('tekst')));
      if (typ === 'email') {
        sek.append(this.tekst(tt('wlasciwosci.adresEMail'), dana('email'), ustawDane('email'), true));
        sek.append(this.tekst(tt('wlasciwosci.tematOpcjonalnie'), dana('temat'), ustawDane('temat'), true));
        sek.append(this.tekst(tt('wlasciwosci.trescOpcjonalnie'), dana('tresc'), ustawDane('tresc'), true));
      }
      if (typ === 'telefon') sek.append(this.tekst(tt('wlasciwosci.numerTelefonu'), dana('telefon'), ustawDane('telefon'), true));
      if (typ === 'wifi') {
        sek.append(this.tekst(tt('wlasciwosci.nazwaSieci'), dana('siec'), ustawDane('siec'), true));
        sek.append(this.wybor(tt('wlasciwosci.zabezpieczenie'), [['WPA', tt('wlasciwosci.wpaWpa2Wpa3')], ['WEP', tt('wlasciwosci.wep')], ['nopass', tt('wlasciwosci.bezHasla')]], () => k().dane?.szyfrowanie || 'WPA', (v) => { ustawDane('szyfrowanie')(v); this.zbuduj(); }));
        if ((k().dane?.szyfrowanie || 'WPA') !== 'nopass') sek.append(this.tekst(tt('wlasciwosci.haslo'), dana('haslo'), ustawDane('haslo'), true));
        sek.append(this.przelacznik(tt('wlasciwosci.siecUkryta'), () => Boolean(k().dane?.ukryta), ustawDane('ukryta')));
      }
      sek.append(this.wybor(tt('wlasciwosci.korekcjaBledow'), [['L', tt('wlasciwosci.niska7NajmniejszyKod')], ['M', tt('wlasciwosci.srednia15')], ['Q', tt('wlasciwosci.wysoka25')], ['H', tt('wlasciwosci.najwyzsza30NpPod')]], () => k().korekcja, (v) => zmien({ korekcja: v })));
      sek.append(this.liczba(tt('wlasciwosci.rozmiar'), () => zaokr(k().szerokosc, 2), (v) => zmien({ szerokosc: Math.max(5, v), wysokosc: Math.max(5, v) }), { jednostka: 'mm', krok: 1, min: 5 }));
    } else {
      sek.append(this.tekst(tt('wlasciwosci.numerEanAlboIsbn'), () => k().tresc, (v) => zmien({ tresc: v }), true));
      sek.append(this.wskazowka(tt('wlasciwosci.12CyfrCyfraKontrolna')));
      sek.append(this.przelacznik(tt('wlasciwosci.cyfryPodKodem'), () => k().napis, (v) => zmien({ napis: v })));
      const rozmiar = this.liczba(tt('wlasciwosci.szerokosc'), () => zaokr(k().szerokosc, 2), (v) => zmien({ szerokosc: Math.max(10, v) }), { jednostka: 'mm', krok: 0.5, min: 10 });
      const wysokosc = this.liczba(tt('wlasciwosci.wysokosc'), () => zaokr(k().wysokosc, 2), (v) => zmien({ wysokosc: Math.max(5, v) }), { jednostka: 'mm', krok: 0.5, min: 5 });
      sek.append(rozmiar, wysokosc);
      sek.append(this.akcje([['dopasuj', 'Rozmiar nominalny (100%)', () => zmien({ szerokosc: Math.round(EAN_NOMINAL.szerokosc * 100) / 100, wysokosc: EAN_NOMINAL.wysokosc })]]));
    }
    sek.append(this.kolor(tt('wlasciwosci.kolorKodu'), () => k().kolor, (v) => zmien({ kolor: v })));
    sek.append(this.kolor(tt('wlasciwosci.tlo'), () => k().tlo, (v) => zmien({ tlo: v || null }), { brak: true }));
    sek.append(this.przelacznik(tt('wlasciwosci.marginesCiszyPustyPas'), () => k().cisza, (v) => zmien({ cisza: v })));
    sek.append(this.wskazowka(tt('wlasciwosci.poleKodu')));
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
    const s = this.sekcja(kal ? tt('wlasciwosci.wymiaryKalendarza') : tt('wlasciwosci.calaTabela'));
    if (kal) {
      // Kalendarz: wiersze i kolumny wynikają z miesiąca – zmienia się tylko szerokość i wygląd siatki.
      const szer = () => t.kolumny.reduce((a, b) => a + b, 0);
      s.append(this.liczba(tt('wlasciwosci.szerokoscKalendarza'), () => zaokr(szer(), 1), (v) => {
        const skala = Math.max(5 * t.kolumny.length, v) / szer();
        t.kolumny = t.kolumny.map((x) => zaokr(Math.max(5, x * skala), 2));
      }, { jednostka: 'mm', krok: 1, min: 20 }));
      if (obj.kalendarz.tygodnie) {
        s.append(this.liczba(tt('wlasciwosci.szerokoscKolumnyTygodni'), () => zaokr(t.kolumny[0], 1), (v) => { ustawSzerokoscKolumny(obj, 0, v, { kosztemSasiedniej: false }); }, { jednostka: 'mm', krok: 0.5, min: 5 }));
      }
      this.zbudujTabeleWyglad(obj, { bezKoloru: true });
      return;
    }
    s.append(this.wskazowka(tt('wlasciwosci.kliknijKomorkeZebyZmienic')));
    // Liczniki „Wiersze [−] 4 [+]” i „Kolumny [−] 3 [+]”: dodają i usuwają ostatni wiersz albo kolumnę.
    const liczniki = document.createElement('div');
    liczniki.className = 'licznik-tabeli';
    liczniki.setAttribute('aria-label', tt('wlasciwosci.wierszyKolumn', { wierszeIle: t.wiersze.length, kolumnyIle: t.kolumny.length }));
    liczniki.append(
      this.licznikTabeli('Wiersze', t.wiersze.length, ['Usuń ostatni wiersz', zmien('wiersz-')], ['Dodaj wiersz na końcu', zmien('wiersz+')]),
      this.licznikTabeli('Kolumny', t.kolumny.length, ['Usuń ostatnią kolumnę', zmien('kolumna-')], ['Dodaj kolumnę na końcu', zmien('kolumna+')]),
    );
    s.append(liczniki);
    s.append(this.przelacznik(tt('wlasciwosci.pierwszyWierszToNaglowek'), () => Boolean(t.naglowek), (v) => ustawNaglowek(obj, v)));
    const szerTabeli = () => t.kolumny.reduce((a, b) => a + b, 0);
    s.append(this.liczba(tt('wlasciwosci.szerokoscTabeli'), () => zaokr(szerTabeli(), 1), (v) => {
      // Wszystkie kolumny rosną albo maleją w tej samej proporcji.
      const skala = Math.max(5 * t.kolumny.length, v) / szerTabeli();
      t.kolumny = t.kolumny.map((x) => zaokr(Math.max(5, x * skala), 2));
    }, { jednostka: 'mm', krok: 1, min: 5 }));
    s.append(this.liczba(tt('wlasciwosci.wysokoscWierszy'), () => zaokr(Math.min(...t.wiersze), 1), (v) => { t.wiersze = t.wiersze.map(() => Math.max(3, v)); }, { jednostka: 'mm', krok: 0.5, min: 3 }));
    s.append(this.wskazowka(tt('wlasciwosci.obieLiczbyDotyczaCalej')));
    s.append(this.akcje([['rozlozX', 'Wyrównaj szerokości kolumn', () => {
      const szer = szerTabeli() / t.kolumny.length;
      t.kolumny = t.kolumny.map(() => szer);
      e.zatwierdz();
      this.odswiez();
    }]]));

    // Kolumna i wiersz klikniętej komórki.
    const m = e.wybranaKomorka(obj);
    const kw = this.sekcja(tt('wlasciwosci.kolumnaIWiersz'));
    kw.classList.add('kolumna-i-wiersz');
    if (!m) {
      kw.append(this.wskazowka(tt('wlasciwosci.kliknijKomorkeTabeliTu')));
    } else {
      const nr = document.createElement('p');
      nr.className = 'wybrana-komorka';
      nr.textContent = tt('wlasciwosci.komorkaKolumnaWiersz', { x: m.k + 1, x2: m.w + 1, x3: t.naglowek && m.w === 0 ? tt('wlasciwosci.naglowek') : '' });
      kw.append(nr);
      kw.append(this.liczba(tt('wlasciwosci.szerokoscKolumny', { x: m.k + 1 }), () => zaokr(t.kolumny[m.k], 1), (v) => { ustawSzerokoscKolumny(obj, m.k, v, { kosztemSasiedniej: false }); }, { jednostka: 'mm', krok: 0.5, min: 5 }));
      kw.append(this.akcje([
        ['plus', 'Kolumna przed', zmien('kolumna+', m.k - 1)],
        ['plus', 'Kolumna po', zmien('kolumna+', m.k)],
        ['kosz', 'Usuń kolumnę', zmien('kolumna-', m.k)],
      ]));
      kw.append(this.liczba(tt('wlasciwosci.wysokoscWiersza', { x: m.w + 1 }), () => zaokr(t.wiersze[m.w], 1), (v) => { ustawWysokoscWiersza(obj, m.w, v); }, { jednostka: 'mm', krok: 0.5, min: 3 }));
      kw.append(this.akcje([
        ['plus', 'Wiersz nad', zmien('wiersz+', m.w - 1)],
        ['plus', 'Wiersz pod', zmien('wiersz+', m.w)],
        ['kosz', 'Usuń wiersz', zmien('wiersz-', m.w)],
      ]));
    }

    // Wszystkie kolumny naraz – zwykle kilka, więc krótka lista; domyślnie zwinięta.
    const k = this.sekcja(tt('wlasciwosci.szerokosciWszystkichKolumn'), { zwinieta: true });
    k.classList.add('kolumny-tabeli');
    t.kolumny.forEach((_, i) => {
      k.append(this.liczba(`${i + 1}`, () => zaokr(t.kolumny[i], 1), (v) => { ustawSzerokoscKolumny(obj, i, v, { kosztemSasiedniej: false }); }, { jednostka: 'mm', krok: 0.5, min: 5 }));
    });
    k.append(this.wskazowka(tt('wlasciwosci.graniceKolumnPrzesunieszTez')));
    this.zbudujTabeleWyglad(obj);
  }

  // Linie, tła wierszy i tekst komórek – wspólne dla tabeli i kalendarza.
  zbudujTabeleWyglad(obj, { bezKoloru = false } = {}) {
    const t = obj.tabela;
    const l = this.sekcja(tt('wlasciwosci.linieTabeli'));
    l.append(this.kolor(tt('wlasciwosci.kolorLinii'), () => t.linia?.kolor || '#1a1a1a', (v) => { t.linia = { ...t.linia, kolor: v }; ulozTabele(obj); }));
    l.append(this.liczba(tt('wlasciwosci.gruboscLinii'), () => zaokr(t.linia?.grubosc ?? 0.25, 2), (v) => { t.linia = { ...t.linia, grubosc: Math.max(0, v) }; }, { jednostka: 'mm', krok: 0.05, min: 0 }));
    this.zbudujLinieZakresu(obj);

    // Tło wierszy: nagłówek i co drugi wiersz treści.
    const tl = this.sekcja(tt('wlasciwosci.tloWierszy'));
    const tlo = (klucz, etykieta, domyslny) => {
      tl.append(this.przelacznik(etykieta, () => Boolean(t.tlo?.[klucz]), (v) => { ustawTloTabeli(obj, { [klucz]: v ? domyslny : null }); this.zbuduj(); }));
      if (t.tlo?.[klucz]) tl.append(this.kolor(klucz === 'naglowek' ? tt('wlasciwosci.kolorTlaNaglowka') : tt('wlasciwosci.kolorTlaCoDrugiego'), () => t.tlo?.[klucz] || domyslny, (v) => ustawTloTabeli(obj, { [klucz]: v })));
    };
    if (t.naglowek) tlo('naglowek', 'Tło wiersza nagłówka', '#e8e6e1');
    tlo('zebra', 'Tło co drugiego wiersza', '#f4f2ee');

    // Wygląd tekstu wszystkich komórek naraz; pojedynczą komórkę zmienia się w trakcie pisania w niej.
    const x = this.sekcja(tt('wlasciwosci.tekstWKomorkach'));
    const komorki = () => komorkiTabeli(obj);
    const wzor = () => komorki()[t.naglowek && t.wiersze.length > 1 ? t.kolumny.length : 0];
    this._czcionkiWLiscie = true;
    const rodziny = this.opcje.czcionki?.() || CZCIONKI.map((c) => c.nazwa);
    const czcionka = this.wybor(tt('wlasciwosci.czcionka'), rodziny.map((n) => [n, n]), () => wzor().fontFamily, (v) => { ustawTekstTabeli(obj, { fontFamily: v }); this.edytor.doczytajCzcionke(v); });
    this._czcionkiWLiscie = false;
    czcionka.classList.add('szeroki');
    x.append(czcionka);
    const rozmiar = this.liczba(tt('wlasciwosci.rozmiar'), () => zaokr(mmNaPt(wzor().fontSize), 1), (v) => ustawTekstTabeli(obj, { fontSize: ptNaMm(Math.max(1, v)) }), { jednostka: 'pt', krok: 0.5, min: 1 });
    // Kolory dni kalendarza ustawia się w części „Kolory kalendarza”.
    x.append(bezKoloru ? rozmiar : this._zKolorem(rozmiar, this.kolor(tt('wlasciwosci.kolorTekstu'), () => wzor().fill, (v) => ustawTekstTabeli(obj, { fill: v }))));
    const wyr = this.segmenty(tt('wlasciwosci.wyrownanie'), [
      ['doLewej', tt('wlasciwosci.doLewej'), () => wzor().textAlign === 'left', () => ustawTekstTabeli(obj, { textAlign: 'left' })],
      ['doSrodka', tt('wlasciwosci.doSrodka'), () => wzor().textAlign === 'center', () => ustawTekstTabeli(obj, { textAlign: 'center' })],
      ['doPrawej', tt('wlasciwosci.doPrawej'), () => wzor().textAlign === 'right', () => ustawTekstTabeli(obj, { textAlign: 'right' })],
    ]);
    wyr.classList.add('szeroki');
    x.append(wyr);
    const pion = this.segmenty(tt('wlasciwosci.tekstWPionie'), [
      ['wyrownajGora', tt('wlasciwosci.doGoryKomorki'), () => !wzor().wyrownanie_pion || wzor().wyrownanie_pion === 'gora', () => ustawTekstTabeli(obj, { wyrownanie_pion: undefined })],
      ['wyrownajSrodekY', tt('wlasciwosci.naSrodkuKomorki'), () => wzor().wyrownanie_pion === 'srodek', () => ustawTekstTabeli(obj, { wyrownanie_pion: 'srodek' })],
      ['wyrownajDol', tt('wlasciwosci.doDoluKomorki'), () => wzor().wyrownanie_pion === 'dol', () => ustawTekstTabeli(obj, { wyrownanie_pion: 'dol' })],
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
    const s = this.sekcja(tt('wlasciwosci.kalendarz'));
    s.append(this.wybor(tt('wlasciwosci.miesiac'), miesiaceWielka(k().jezyk).map((m, i) => [String(i + 1), m]), () => String(k().miesiac), (v) => zmien({ miesiac: Number(v) })));
    s.append(this.wybor(tt('wlasciwosci.jezykNazw'), [['pl', 'Polski'], ['en', 'English'], ['uk', 'Українська']], () => k().jezyk || 'pl', (v) => { zmien({ jezyk: v }); this.zbuduj(); }));
    s.append(this.liczba(tt('wlasciwosci.rok'), () => k().rok, (v) => zmien({ rok: Math.round(v) }), { krok: 1, min: 1600 }));
    s.append(this.wybor(tt('wlasciwosci.miesiacZKolumnyDanych'), this._kolumnyDanych('Nie – stały miesiąc'), () => k().pole_daty || '', (v) => { zmien({ pole_daty: v || undefined }); this.zbuduj(); }));
    if (k().pole_daty) {
      s.append(this.wybor(tt('wlasciwosci.rokZKolumny'), this._kolumnyDanych('Z tej samej kolumny albo pola „Rok”'), () => k().pole_roku || '', (v) => zmien({ pole_roku: v || undefined })));
      s.append(this.wskazowka(tt('wlasciwosci.naKazdejStronieSerii')));
    }
    s.append(this.wybor(tt('wlasciwosci.tydzienZaczynaSieOd'), [['1', tt('wlasciwosci.poniedzialku')], ['0', tt('wlasciwosci.niedzieli')]], () => String(k().pierwszy), (v) => zmien({ pierwszy: Number(v) })));
    s.append(this.wybor(tt('wlasciwosci.nazwyDni'), [['pelne', tt('wlasciwosci.pelnePoniedzialek')], ['skrot', tt('wlasciwosci.skroconePn')], ['litery', tt('wlasciwosci.literyP')]], () => k().nazwy, (v) => zmien({ nazwy: v })));
    s.append(this.wybor(tt('wlasciwosci.dniInnychMiesiecy'), [['wyszarz', tt('wlasciwosci.wyszarzone')], ['pokaz', tt('wlasciwosci.jakZwykleDni')], ['ukryj', tt('wlasciwosci.ukryte')]], () => k().inne, (v) => zmien({ inne: v })));
    s.append(this.przelacznik(tt('wlasciwosci.nazwaMiesiacaNadDniami'), () => k().tytul, (v) => zmien({ tytul: v })));
    s.append(this.przelacznik(tt('wlasciwosci.numeryTygodni'), () => k().tygodnie, (v) => { zmien({ tygodnie: v }); this.zbuduj(); }));
    s.append(this.przelacznik(tt('wlasciwosci.miejsceNaNotatkiData'), () => k().notatki, (v) => zmien({ notatki: v, wiersz_dnia: v ? Math.max(k().wiersz_dnia, 16) : Math.min(k().wiersz_dnia, 9) })));
    s.append(this.liczba(tt('wlasciwosci.wysokoscWierszaDnia'), () => k().wiersz_dnia, (v) => zmien({ wiersz_dnia: Math.max(4, v) }), { jednostka: 'mm', krok: 0.5, min: 4 }));
    const sw = this.sekcja(tt('wlasciwosci.swieta'));
    sw.append(this.przelacznik(tt('wlasciwosci.polskieSwietaTakzeWielkanoc'), () => k().swieta, (v) => zmien({ swieta: v })));
    sw.append(this.przelacznik(tt('wlasciwosci.nazwaSwietaPodData'), () => k().nazwy_swiat, (v) => zmien({ nazwy_swiat: v })));
    const tabele = this.opcje.projekt?.()?.tabele || [];
    sw.append(this.wybor(tt('wlasciwosci.swietaZTabeliDanych'), [['', tt('wlasciwosci.brak')], ...tabele.map((t) => [t.id, t.nazwa])], () => k().swieta_z?.tabela || '', (v) => {
      const t = tabele.find((x) => x.id === v);
      zmien({ swieta_z: t ? { tabela: t.id, data: t.kolumny.find((n) => /dat/i.test(n)) || t.kolumny[0], nazwa: t.kolumny.find((n) => /naz|swi|świ|opis/i.test(n)) || t.kolumny[1] || '' } : undefined });
      this.zbuduj();
    }));
    const t = tabele.find((x) => x.id === k().swieta_z?.tabela);
    if (t) {
      const opcje = t.kolumny.map((n) => [n, n]);
      sw.append(this.wybor(tt('wlasciwosci.kolumnaZData'), opcje, () => k().swieta_z.data, (v) => zmien({ swieta_z: { ...k().swieta_z, data: v } })));
      sw.append(this.wybor(tt('wlasciwosci.kolumnaZNazwa'), [['', tt('wlasciwosci.bezNazwy')], ...opcje], () => k().swieta_z.nazwa || '', (v) => zmien({ swieta_z: { ...k().swieta_z, nazwa: v } })));
      sw.append(this.wskazowka(tt('wlasciwosci.datyWPostaci2027')));
    }
    const kol = this.sekcja(tt('wlasciwosci.koloryKalendarza'));
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
    const s = this.sekcja(tt('wlasciwosci.wykres'));
    s.append(this.wybor(tt('wlasciwosci.rodzaj'), RODZAJE, () => w().rodzaj, (v) => { zmien({ rodzaj: v }); this.zbuduj(); }));
    s.append(this.wybor(tt('wlasciwosci.tabelaDanych'), [['', tabele.length ? tt('wlasciwosci.wybierzTabele') : tt('wlasciwosci.brakTabelDodajJe')], ...tabele.map((t) => [t.id, t.nazwa])], () => w().tabela || '', (v) => {
      const t = tabele.find((x) => x.id === v);
      zmien({ tabela: v || undefined, etykiety: t?.kolumny[0] || '', wartosci: t ? t.kolumny.slice(1, 2) : [] });
      this.zbuduj();
    }));
    const t = tabele.find((x) => x.id === w().tabela);
    if (t) {
      s.append(this.wybor(w().zakres === 'wiersz' ? tt('wlasciwosci.nazwaSeriiZKolumny') : tt('wlasciwosci.podpisyZKolumny'), [['', tt('wlasciwosci.numeryWierszy')], ...t.kolumny.map((n) => [n, n])], () => w().etykiety, (v) => zmien({ etykiety: v })));
      const liczby = document.createElement('fieldset');
      liczby.className = 'grupa-pol kolumny-wykresu';
      const leg = document.createElement('legend');
      leg.textContent = tt('wlasciwosci.liczbyZKolumn');
      liczby.append(leg);
      for (const n of t.kolumny) {
        liczby.append(this.przelacznik(n, () => w().wartosci.includes(n), (v) => zmien({ wartosci: v ? t.kolumny.filter((x) => x === n || w().wartosci.includes(x)) : w().wartosci.filter((x) => x !== n) })));
      }
      s.append(liczby);
      s.append(this.wybor(tt('wlasciwosci.wiersze'), [['wszystkie', tt('wlasciwosci.wszystkieWierszeTabeli')], ['zakres', tt('wlasciwosci.wybraneWierszeOdDo')], ['wiersz', tt('wlasciwosci.wierszStronySerii')]], () => w().zakres, (v) => { zmien({ zakres: v }); this.zbuduj(); }));
      if (w().zakres === 'zakres') {
        s.append(this.liczba(tt('wlasciwosci.odWiersza'), () => w().od, (v) => zmien({ od: Math.max(1, Math.round(v)) }), { krok: 1, min: 1 }));
        s.append(this.liczba(tt('wlasciwosci.doWiersza'), () => w().do, (v) => zmien({ do: Math.max(1, Math.round(v)) }), { krok: 1, min: 1 }));
      }
      if (w().zakres === 'wiersz') s.append(this.wskazowka(tt('wlasciwosci.kategorieToWybraneKolumny')));
    }
    const o = this.sekcja(tt('wlasciwosci.opisWykresu'));
    o.append(this.tekst(tt('wlasciwosci.tytulOpcjonalnie'), () => w().tytul, (v) => zmien({ tytul: v }), true));
    o.append(this.przelacznik(tt('wlasciwosci.liczbyPrzySlupkachI'), () => w().etykiety_wartosci, (v) => zmien({ etykiety_wartosci: v })));
    if (!['kolo', 'pierscien'].includes(w().rodzaj)) {
      o.append(this.przelacznik(tt('wlasciwosci.osZWartosciami'), () => w().os, (v) => zmien({ os: v })));
      o.append(this.przelacznik(tt('wlasciwosci.linieSiatki'), () => w().siatka, (v) => zmien({ siatka: v })));
    }
    o.append(this.przelacznik(tt('wlasciwosci.legenda'), () => w().legenda, (v) => zmien({ legenda: v })));
    const g = this.sekcja(tt('wlasciwosci.wygladWykresu'));
    g.append(this.liczba(tt('wlasciwosci.szerokosc'), () => w().szerokosc, (v) => zmien({ szerokosc: Math.max(20, v) }), { jednostka: 'mm', krok: 1, min: 20 }));
    g.append(this.liczba(tt('wlasciwosci.wysokosc'), () => w().wysokosc, (v) => zmien({ wysokosc: Math.max(15, v) }), { jednostka: 'mm', krok: 1, min: 15 }));
    this._czcionkiWLiscie = true;
    const rodziny = this.opcje.czcionki?.() || CZCIONKI.map((c) => c.nazwa);
    const cz = this.wybor(tt('wlasciwosci.czcionka'), rodziny.map((n) => [n, n]), () => w().czcionka, (v) => { zmien({ czcionka: v }); this.edytor.doczytajCzcionke(v); });
    this._czcionkiWLiscie = false;
    cz.classList.add('szeroki');
    g.append(cz);
    g.append(this._zKolorem(
      this.liczba(tt('wlasciwosci.rozmiarPisma'), () => zaokr(mmNaPt(w().rozmiar), 1), (v) => zmien({ rozmiar: ptNaMm(Math.max(3, v)) }), { jednostka: 'pt', krok: 0.5, min: 3 }),
      this.kolor(tt('wlasciwosci.kolorPisma'), () => w().kolor_tekstu, (v) => zmien({ kolor_tekstu: v })),
    ));
    const ile = ['kolo', 'pierscien'].includes(w().rodzaj) ? Math.min(8, Math.max(1, (t?.wiersze.length) || 1)) : Math.max(1, w().wartosci.length);
    for (let i = 0; i < ile; i += 1) {
      g.append(this.kolor(tt('wlasciwosci.kolor2', { x: i + 1 }), () => w().kolory[i] || PALETA[i % PALETA.length], (v) => { const kolory = [...w().kolory]; kolory[i] = v; zmien({ kolory }); }));
    }
  }

  zbudujKolaz(obj) {
    const k = () => obj.kolaz;
    const zmien = (zmiana) => { obj.kolaz = { ...obj.kolaz, ...zmiana }; };
    const s = this.sekcja(tt('wlasciwosci.kolaz'));
    s.append(this.wybor(tt('wlasciwosci.uklad'), KOLAZE.map((x) => [x.id, x.nazwa]), () => k().uklad, (v) => { this.edytor.zmienUkladKolazu(obj, v); }));
    s.append(this.liczba(tt('wlasciwosci.odstepMiedzyZdjeciami'), () => k().odstep, (v) => zmien({ odstep: Math.max(0, v) }), { jednostka: 'mm', krok: 0.5, min: 0 }));
    s.append(this.liczba(tt('wlasciwosci.zaokraglenieRogow'), () => k().zaokraglenie || 0, (v) => zmien({ zaokraglenie: Math.max(0, v) }), { jednostka: 'mm', krok: 0.5, min: 0 }));
    s.append(this.liczba(tt('wlasciwosci.szerokosc'), () => k().szerokosc, (v) => zmien({ szerokosc: Math.max(10, v) }), { jednostka: 'mm', krok: 1, min: 10 }));
    s.append(this.liczba(tt('wlasciwosci.wysokosc'), () => k().wysokosc, (v) => zmien({ wysokosc: Math.max(10, v) }), { jednostka: 'mm', krok: 1, min: 10 }));
    s.append(this.wskazowka(tt('wlasciwosci.upuscZdjecieZKomputera')));
  }

  // Działania na wierszu i kolumnie komórki, w której trwa pisanie.
  zbudujKomorke(obj) {
    const e = this.edytor;
    const tabela = obj.group;
    const m = e.miejsceKomorki(obj);
    if (!m) return;
    const zmien = (co, gdzie) => () => { e.zmienTabele(tabela, co, gdzie); if (this.obj === e.aktywny) this.zbuduj(); };
    // Te same nazwy co przy zaznaczonej tabeli (#115): kolumna i wiersz tej komórki.
    const s = this.sekcja(tt('wlasciwosci.kolumnaIWiersz'));
    s.classList.add('kolumna-i-wiersz');
    const nr = document.createElement('p');
    nr.className = 'wybrana-komorka';
    nr.textContent = tt('wlasciwosci.komorkaKolumnaWiersz2', { x: m.k + 1, x2: m.w + 1 });
    s.append(nr);
    s.append(this.wskazowka(tt('wlasciwosci.tabPrzechodziDoNastepnej')));
    s.append(this.liczba(tt('wlasciwosci.szerokoscKolumny', { x: m.k + 1 }), () => zaokr(tabela.tabela.kolumny[m.k], 1), (v) => { ustawSzerokoscKolumny(tabela, m.k, v, { kosztemSasiedniej: false }); }, { jednostka: 'mm', krok: 0.5, min: 5 }));
    s.append(this.akcje([['plus', 'Kolumna przed', zmien('kolumna+', m.k - 1)], ['plus', 'Kolumna po', zmien('kolumna+', m.k)], ['kosz', 'Usuń kolumnę', zmien('kolumna-', m.k)]]));
    // Scalanie: komórka rośnie o sąsiednią po prawej albo poniżej; „Rozdziel” przywraca osobne komórki.
    const sc = e.scalenieKomorki(obj);
    const zajete = sc || { w: m.w, k: m.k, ileW: 1, ileK: 1 };
    const scalanie = [];
    if (zajete.k + zajete.ileK < tabela.tabela.kolumny.length) scalanie.push(['grupuj', 'Scal z komórką po prawej', zmien('scal-prawo', m)]);
    if (zajete.w + zajete.ileW < tabela.tabela.wiersze.length) scalanie.push(['grupuj', 'Scal z komórką poniżej', zmien('scal-dol', m)]);
    if (sc) scalanie.push(['rozgrupuj', 'Rozdziel komórki', zmien('rozdziel', m)]);
    if (scalanie.length) s.append(this.akcje(scalanie));
    if (sc) s.append(this.wskazowka(tt('wlasciwosci.taKomorkaZajmujeI', { ileK: sc.ileK, x: sc.ileK === 1 ? tt('wlasciwosci.kolumne') : tt('wlasciwosci.kolumny'), ileW: sc.ileW, x2: sc.ileW === 1 ? tt('wlasciwosci.wiersz') : tt('wlasciwosci.wiersze2') })));
    s.append(this.liczba(tt('wlasciwosci.wysokoscWiersza', { x: m.w + 1 }), () => zaokr(tabela.tabela.wiersze[m.w], 1), (v) => { ustawWysokoscWiersza(tabela, m.w, v); }, { jednostka: 'mm', krok: 0.5, min: 3 }));
    s.append(this.wskazowka(tt('wlasciwosci.terazTenWierszMa', { zaokr: zaokr(wysokosciWierszy(tabela)[m.w], 1) })));
    s.append(this.akcje([['plus', 'Wiersz nad', zmien('wiersz+', m.w - 1)], ['plus', 'Wiersz pod', zmien('wiersz+', m.w)], ['kosz', 'Usuń wiersz', zmien('wiersz-', m.w)]]));

    // Linie tej jednej komórki: każda krawędź osobno – jak w całej tabeli, bez linii albo własna.
    const lin = this.sekcja(tt('wlasciwosci.linieTejKomorki'));
    const przebuduj = () => { if (this.obj === e.aktywny) this.zbuduj(); };
    for (const [strona, nazwa] of [['gora', 'U góry'], ['dol', 'U dołu'], ['lewo', 'Z lewej'], ['prawo', 'Z prawej']]) {
      const jaka = () => krawedzKomorki(tabela, m.w, m.k, strona);
      const rodzaj = () => (!jaka().wlasna ? '' : (jaka().grubosc > 0 ? 'wlasna' : 'brak'));
      const wybor = this.wybor(nazwa, [['', tt('wlasciwosci.jakWTabeli')], ['brak', tt('wlasciwosci.bezLinii')], ['wlasna', tt('wlasciwosci.wlasna')]], rodzaj, (v) => {
        const siatka = tabela.tabela.linia?.grubosc ?? 0.25;
        ustawKrawedzKomorki(tabela, m.w, m.k, strona, v === '' ? null : { grubosc: v === 'brak' ? 0 : Math.max(0.5, zaokr(siatka * 3, 2)) });
        przebuduj();
      });
      wybor.dataset.krawedz = strona;
      if (rodzaj() !== 'wlasna') wybor.classList.add('szeroki');
      lin.append(wybor);
      if (rodzaj() !== 'wlasna') continue;
      lin.append(this.kolor(tt('wlasciwosci.kolor'), () => jaka().kolor, (v) => ustawKrawedzKomorki(tabela, m.w, m.k, strona, { kolor: v })));
      const grubosc = this.liczba(tt('wlasciwosci.grubosc2', { toLowerCase: nazwa.toLowerCase() }), () => zaokr(jaka().grubosc, 2), (v) => { ustawKrawedzKomorki(tabela, m.w, m.k, strona, { grubosc: Math.max(0.05, v) }); }, { jednostka: 'mm', krok: 0.05, min: 0.05 });
      grubosc.classList.add('szeroki');
      lin.append(grubosc);
    }
    lin.append(this.wskazowka(tt('wlasciwosci.krawedzJestWspolnaZ')));
    this.zbudujLinieZakresu(tabela, m);
  }

  // Linie wielu komórek naraz: obramowanie i linie wewnętrzne całego wiersza, kolumny albo tabeli.
  // m: miejsce komórki, w której trwa pisanie ({ w, k }) – bez niego (zaznaczona cała tabela) zakresem jest tabela.
  zbudujLinieZakresu(tabela, m = null) {
    const e = this.edytor;
    const st = this._linieZakresu || (this._linieZakresu = { zakres: 'wiersz', czesc: 'obramowanie', grubosc: 0.5, kolor: '#1a1a1a' });
    const zakres = () => (m ? st.zakres : 'tabela');
    const s = this.sekcja(m ? tt('wlasciwosci.linieWierszaKolumnyTabeli') : tt('wlasciwosci.obramowanieILinieWewnetrzne'));
    s.dataset.linieZakresu = '';
    if (m) {
      const gdzie = this.wybor(tt('wlasciwosci.zastosujDo'), [['wiersz', tt('wlasciwosci.tegoWiersza')], ['kolumna', tt('wlasciwosci.tejKolumny')], ['tabela', tt('wlasciwosci.calejTabeli')]], () => st.zakres, (v) => { st.zakres = v; });
      gdzie.classList.add('szeroki');
      gdzie.dataset.linie = 'zakres';
      s.append(gdzie);
    }
    const ktore = this.wybor(tt('wlasciwosci.ktoreLinie'), [['obramowanie', tt('wlasciwosci.obramowanieLinieZewnetrzne')], ['poziome', tt('wlasciwosci.wewnetrznePoziome')], ['pionowe', tt('wlasciwosci.wewnetrznePionowe')], ['wszystkie', 'wszystkie']], () => st.czesc, (v) => { st.czesc = v; });
    ktore.classList.add('szeroki');
    ktore.dataset.linie = 'czesc';
    s.append(ktore);
    const kolor = this.kolor(tt('wlasciwosci.kolor'), () => st.kolor, (v) => { st.kolor = v; }, { bezZatwierdzania: true });
    kolor.dataset.linie = 'kolor';
    s.append(kolor);
    const grubosc = this.liczba(tt('wlasciwosci.grubosc'), () => st.grubosc, (v) => { st.grubosc = Math.max(0.05, zaokr(v, 2)); }, { jednostka: 'mm', krok: 0.05, min: 0.05 });
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
      ? tt('wlasciwosci.ustawiaNarazLinieWybranej')
      : tt('wlasciwosci.ustawiaNarazObramowanieAlbo')));
  }

  // Dymek (#360): rodzaj, kolory, obrys, ogonek (uchwyt na płótnie), margines wokół tekstu.
  zbudujDymek(obj) {
    const sek = this.sekcja(tt('wlasciwosci.dymek'));
    const d = () => obj.dymek;
    const zmien = (zm) => { obj.dymek = { ...obj.dymek, ...zm }; obj.dirty = true; this.edytor.canvas.requestRenderAll(); this.edytor.oznaczZmiane(); };
    sek.append(this.wybor(tt('wlasciwosci.rodzajDymka'), [['mowa', tt('wlasciwosci.dymekMowa')], ['mysl', tt('wlasciwosci.dymekMysl')], ['krzyk', tt('wlasciwosci.dymekKrzyk')], ['szept', tt('wlasciwosci.dymekSzept')], ['narracja', tt('wlasciwosci.dymekNarracja')]], () => d().rodzaj, (v) => { zmien({ rodzaj: v }); this.zbuduj(); }));
    if (d().rodzaj !== 'narracja') {
      sek.append(this.przelacznik(tt('wlasciwosci.ogonek'), () => Boolean(d().ogonek), (v) => { zmien({ ogonek: v ? { x: obj.width * 0.25, y: obj.height + 14 } : null }); this.edytor.canvas.requestRenderAll(); }));
      if (d().ogonek) sek.append(this.wskazowka(tt('wlasciwosci.ogonekUchwyt')));
    }
    sek.append(this.kolor(tt('wlasciwosci.wypelnienieDymka'), () => d().wypelnienie, (v) => zmien({ wypelnienie: v || '#ffffff' })));
    sek.append(this.kolor(tt('wlasciwosci.obrysDymka'), () => d().obrys, (v) => zmien({ obrys: v || 'transparent' }), { brak: true }));
    sek.append(this.liczba(tt('wlasciwosci.gruboscObrysu'), () => zaokr(d().grubosc, 2), (v) => zmien({ grubosc: Math.max(0, v) }), { jednostka: 'mm', krok: 0.05, min: 0 }));
  }

  zbudujTekst(obj, { komorka = false } = {}) {
    const czytaj = (k) => this._czytajTekst(obj, k);
    const ustaw = (w) => this._ustawTekst(obj, w);

    if (obj.ksiazka && !komorka) this.zbudujElementKsiazki(obj);
    if (obj.dymek && !komorka) this.zbudujDymek(obj);
    this.zbudujStyl(obj);

    const s = this.sekcja(tt('wlasciwosci.tekst'));
    // Edycja treści w zwykłym polu – wygodniejsze na telefonie niż na płótnie (4.7).
    s.append(this.obszarTekstu('Treść', () => obj.text, (v) => obj.set('text', v)));
    s.append(this.wstawianiePola());
    // Klamry pokazują się tylko wtedy, gdy są w tekście – inaczej przełącznik tylko by zawadzał.
    if (obj.text.includes('{') || obj.bez_pol) {
      s.append(this.przelacznik(tt('wlasciwosci.klamryTekst'), () => Boolean(obj.bez_pol), (v) => { obj.bez_pol = v || undefined; obj.dirty = true; }));
    }

    const fragment = this.wskazowka(tt('wlasciwosci.zmieniaszTylkoZaznaczonyFragment'));
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
    const wMarce = [[mNag, tt('wlasciwosci.marka.naglowki')], [mTekst, tt('wlasciwosci.marka.tekst')]].filter(([n], i, t) => n && t.findIndex(([m]) => m === n) === i)
      .map(([n, rola]) => (rodziny.includes(n) ? [n, `${n} · marka (${rola})`] : (this.opcje.mojeCzcionki?.() || []).includes(n) ? [`moja:${n}`, `${n} · marka (${rola})`] : null)).filter(Boolean);
    const grupy = [
      ...(wMarce.length ? [{ grupa: 'Marka', opcje: wMarce }] : []),
      ...(uzyte.length ? [{ grupa: 'Użyte w projekcie', opcje: uzyte.map((c) => [c.nazwa, `${c.nazwa} · ${c.ile}×`]) }] : []),
    ];
    const listaCzcionek = grupy.length
      ? [...grupy, { grupa: 'Wszystkie czcionki', opcje: [...rodziny.map((n) => [n, n]), ...moje] }]
      : [...rodziny.map((n) => [n, n]), ...moje];
    const czcionka = this.wybor(tt('wlasciwosci.czcionka'), [...listaCzcionek, ...(this.opcje.wgrajCzcionke ? [['+', tt('wlasciwosci.wgrajCzcionke')]] : [])], () => czytaj('fontFamily'), (v) => {
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
    s.append(this._zKolorem(this.liczba(tt('wlasciwosci.rozmiar'), () => zaokr(mmNaPt(zadany() * obj.scaleY), 1), (v) => {
      const rozmiar = ptNaMm(Math.max(1, v)) / obj.scaleY;
      if (!this._fragment(obj) && obj.rozmiar_bazowy) obj.rozmiar_bazowy = rozmiar;
      ustaw({ fontSize: rozmiar });
    }, { jednostka: 'pt', krok: 0.5, min: 1 }), this.kolor(tt('wlasciwosci.kolorTekstu'), () => czytaj('fill'), (v) => ustaw({ fill: v }))));
    s.append(this.liczba(tt('wlasciwosci.interlinia'), () => zaokr(obj.lineHeight, 2), (v) => obj.set('lineHeight', Math.max(0.5, v)), { krok: 0.05, min: 0.5 }));
    // Odstęp między literami w tysięcznych wysokości pisma (jak w programach DTP).
    s.append(this.liczba(tt('wlasciwosci.odstepLiter'), () => Math.round(obj.charSpacing || 0), (v) => obj.set('charSpacing', Math.max(-200, Math.min(2000, v))), { jednostka: '‰', krok: 10 }));
    // Obrys liter (#123): kontur wokół liter, rysowany pod wypełnieniem – litery nie chudną.
    if (!komorka) {
      s.append(this.kolor(tt('wlasciwosci.obrysLiter'), () => (obj.strokeWidth > 0 ? obj.stroke : ''), (v) => {
        obj.set(v ? { stroke: v, strokeWidth: obj.strokeWidth > 0 ? obj.strokeWidth : 0.3, paintFirst: 'stroke', strokeUniform: true } : { stroke: null, strokeWidth: 0, paintFirst: 'fill' });
        setTimeout(() => this.zbuduj());
      }, { brak: true }));
      if (obj.strokeWidth > 0) s.append(this.liczba(tt('wlasciwosci.gruboscObrysuLiter'), () => zaokr(obj.strokeWidth, 2), (v) => obj.set({ strokeWidth: Math.max(0.05, Math.min(5, v)) }), { jednostka: 'mm', krok: 0.1, min: 0.05 }));
    }

    const przelacz = (k, wl, wyl) => () => ustaw({ [k]: czytaj(k) === wl ? wyl : wl });
    const styl = this.segmenty(tt('wlasciwosci.wygladLiter'), [
      ['pogrubienie', tt('wlasciwosci.pogrubienie'), () => czytaj('fontWeight') === 'bold' || czytaj('fontWeight') >= 600, przelacz('fontWeight', 'bold', 'normal')],
      ['kursywa', tt('wlasciwosci.kursywa'), () => czytaj('fontStyle') === 'italic', przelacz('fontStyle', 'italic', 'normal')],
      ['podkreslenie', tt('wlasciwosci.podkreslenie'), () => Boolean(czytaj('underline')), przelacz('underline', true, false)],
      ['przekreslenie', tt('wlasciwosci.przekreslenie'), () => Boolean(czytaj('linethrough')), przelacz('linethrough', true, false)],
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
        b.title = jest ? nazwa : tt('wlasciwosci.czcionkaNieMa', { rodzina, opis });
      }
    };
    this.odswiezacze.push(odmiany);
    odmiany();

    const wyr = this.segmenty(tt('wlasciwosci.wyrownanie'), [
      ['doLewej', tt('wlasciwosci.doLewej'), () => obj.textAlign === 'left', () => obj.set('textAlign', 'left')],
      ['doSrodka', tt('wlasciwosci.doSrodka'), () => obj.textAlign === 'center', () => obj.set('textAlign', 'center')],
      ['doPrawej', tt('wlasciwosci.doPrawej'), () => obj.textAlign === 'right', () => obj.set('textAlign', 'right')],
      ['wyjustuj', tt('wlasciwosci.wyjustuj'), () => obj.textAlign === 'justify', () => obj.set('textAlign', 'justify')],
    ]);
    wyr.classList.add('szeroki');
    s.append(wyr);
    const lista = this.wybor(tt('wlasciwosci.lista'), [['', tt('wlasciwosci.brak')], ['punkty', tt('wlasciwosci.punkty')], ['kreski', tt('wlasciwosci.kreski')], ['numery', tt('wlasciwosci.1Numery')]], () => obj.lista || '', (v) => obj.set('lista', v || undefined));
    lista.classList.add('szeroki');
    s.append(lista);

    // Wielkość liter to wygląd: treść zostaje taka, jak wpisana (pola w klamrach działają bez zmian).
    const wielkosc = (v) => () => { obj.set('wielkosc_liter', obj.wielkosc_liter === v ? undefined : v); };
    const zmienLitery = (fn) => () => { obj.set('wielkosc_liter', undefined); obj.set('text', obj.text.split(/(\{[^{}\n]*\})/).map((cz, i) => (i % 2 ? cz : fn(cz))).join('')); obj.initDimensions?.(); };
    const litery = this.segmenty(tt('wlasciwosci.wielkoscLiter'), [
      ['AA', tt('wlasciwosci.wszystkieWielkieTylkoWyglad'), () => obj.wielkosc_liter === 'wielkie', wielkosc('wielkie')],
      ['aa', tt('wlasciwosci.wszystkieMaleTylkoWyglad'), () => obj.wielkosc_liter === 'male', wielkosc('male')],
      ['Aᴀ', tt('wlasciwosci.kapitalikiMaleLiteryJako'), () => obj.wielkosc_liter === 'kapitaliki', wielkosc('kapitaliki')],
      ['Aa', tt('wlasciwosci.jakWZdaniuZmienia'), null, zmienLitery((t) => t.toLocaleLowerCase('pl').replace(/(^|[.!?]\s+|\n)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('pl')))],
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
    const w = this.sekcja(tt('wlasciwosci.przelewanieTekstu'));
    const watek = this.edytor.watekRamki(obj);
    const naStronie = Boolean(this.opcje.naStronie?.() && this.opcje.ramkaNaNastepnejStronie);
    const dalejNaStronie = naStronie ? [['plus', 'Ciąg dalszy na następnej stronie', () => this.opcje.ramkaNaNastepnejStronie()]] : [];
    if (watek) {
      const strony = watek.innychStron ? (watek.innychStron === 1 ? tt('wlasciwosci.ramkiInnaStrona') : tt('wlasciwosci.ramkiInneStrony', { n: watek.innychStron })) : '';
      w.append(this.wskazowka(tt('wlasciwosci.ramkaZPolaczonychTekst', { nr: watek.nr, ile: watek.ile, strony })));
      // Sąsiednie ramki z innych stron: przejście jednym kliknięciem.
      const skoki = [];
      if (watek.poprzednia) skoki.push(['wstecz', tt('wlasciwosci.poprzedniaRamka', { strona: this.opcje.nazwaStrony?.(watek.poprzednia.strona) || '' }), () => this.opcje.przejdzDoRamki?.(watek.poprzednia.strona, watek.poprzednia.id)]);
      if (watek.nastepna) skoki.push(['dalej', tt('wlasciwosci.nastepnaRamka', { strona: this.opcje.nazwaStrony?.(watek.nastepna.strona) || '' }), () => this.opcje.przejdzDoRamki?.(watek.nastepna.strona, watek.nastepna.id)]);
      if (skoki.length) w.append(this.akcje(skoki));
      // Cały połączony tekst naraz: wygląd, kopia, usunięcie (zaznaczenia w tekście nie da się rozciągnąć przez ramki).
      if (this.edytor.calyTekstZaznaczony) {
        const caly = this.wskazowka(tt('wlasciwosci.zaznaczonyJestCalyPolaczony', { ile: watek.ile, x: watek.ile < 5 ? 'ramki' : 'ramek' }));
        caly.classList.add('znacznik-fragmentu');
        caly.dataset.calyTekst = '';
        w.append(caly);
        w.append(this.akcje([
          ['kopiuj', 'Kopiuj cały tekst', async () => { await this.edytor.kopiuj(); powiadom(tt('wlasciwosci.skopiowanoCalyPolaczonyTekst')); }],
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
      const kolumny = (n) => async () => { if (!await this.edytor.podzielNaKolumny(n)) powiadom(tt('wlasciwosci.ramkaJestZaWaska')); };
      const podzial = this.segmenty(tt('wlasciwosci.podzielNaKolumny'), [['2', tt('wlasciwosci.2Kolumny'), null, kolumny(2)], ['3', tt('wlasciwosci.3Kolumny'), null, kolumny(3)], ['4', tt('wlasciwosci.4Kolumny'), null, kolumny(4)]], true);
      podzial.classList.add('szeroki');
      w.append(podzial);
      w.append(this.wskazowka(tt('wlasciwosci.kolumnyToPolaczoneRamki')));
    }

    // Książka (#212): strony dokładane same, aż cały tekst się zmieści; akapit (np. rozdział) od nowej strony.
    if (naStronie) {
      w.append(this.przelacznik(tt('wlasciwosci.dokladajStronyAzCaly'), () => Boolean(obj.auto_strony), (v) => {
        const ramki = watek ? this.edytor._ramkiWatku(obj) : [obj];
        for (const x of ramki) x.auto_strony = v || undefined;
        if (v && !(obj.ramka_h > 0)) { obj.ramka_h = Math.max(obj.height, 3); obj.autodopasowanie = undefined; obj.initDimensions(); }
        this.edytor.oznaczZmiane();
        this.opcje.dokladajStrony?.();
        this.zbuduj();
      }));
      const akapit = this.edytor.akapitOdNowejStrony(obj);
      if (akapit && !(akapit.poczatek === 0 && !obj.watek_nr)) {
        w.append(this.przelacznik(obj.isEditing ? tt('wlasciwosci.tenAkapitOdNowej') : tt('wlasciwosci.pierwszyAkapitOdNowej'), () => akapit.jest, (v) => {
          this.edytor.ustawAkapitOdNowejStrony(v, obj);
          if (v && !obj.auto_strony) powiadom(tt('wlasciwosci.akapitPrzejdzieDoNastepnej'));
          this.opcje.dokladajStrony?.();
          this.zbuduj();
        }));
      } else if (obj.isEditing) {
        w.append(this.wskazowka(tt('wlasciwosci.ustawKursorWAkapicie')));
      }
    }

    // Ramka: stała wysokość, wyrównanie w pionie, zmniejszanie tekstu, który się nie mieści.
    const r = this.sekcja(tt('wlasciwosci.ramkaTekstu'));
    const przelicz = () => { obj.initDimensions(); obj.setCoords(); };
    const stala = this.przelacznik(tt('wlasciwosci.stalaWysokoscRamki'), () => obj.ramka_h > 0, (v) => {
      if (!v && obj.watek) { powiadom(tt('wlasciwosci.polaczonaRamkaMaStala')); this.zbuduj(); return; }
      obj.ramka_h = v ? Math.max(obj._wysokoscTresci || obj.height, 3) : undefined;
      if (!v) { obj.autodopasowanie = undefined; if (obj.rozmiar_bazowy) obj.fontSize = obj.rozmiar_bazowy; obj.rozmiar_bazowy = undefined; }
      przelicz();
      this.zbuduj();
    });
    r.append(stala);
    if (obj.ramka_h > 0) {
      r.append(this.liczba(tt('wlasciwosci.wysokoscRamki'), () => zaokr(obj.ramka_h * obj.scaleY, 1), (v) => { obj.ramka_h = Math.max(1, v) / obj.scaleY; przelicz(); }, { jednostka: 'mm', krok: 1, min: 1 }));
      const pion = this.segmenty(tt('wlasciwosci.tekstWPionie'), [
        ['wyrownajGora', tt('wlasciwosci.doGoryRamki'), () => !obj.wyrownanie_pion || obj.wyrownanie_pion === 'gora', () => { obj.wyrownanie_pion = undefined; przelicz(); }],
        ['wyrownajSrodekY', tt('wlasciwosci.naSrodkuRamki'), () => obj.wyrownanie_pion === 'srodek', () => { obj.wyrownanie_pion = 'srodek'; przelicz(); }],
        ['wyrownajDol', tt('wlasciwosci.doDoluRamki'), () => obj.wyrownanie_pion === 'dol', () => { obj.wyrownanie_pion = 'dol'; przelicz(); }],
      ]);
      r.append(pion);
      if (!obj.watek) r.append(this.przelacznik(tt('wlasciwosci.zmniejszajTekstGdySie'), () => Boolean(obj.autodopasowanie), (v) => {
        obj.autodopasowanie = v || undefined;
        if (v) { obj.rozmiar_bazowy = obj.fontSize; obj.min_rozmiar = obj.min_rozmiar || 6; } else { if (obj.rozmiar_bazowy) obj.fontSize = obj.rozmiar_bazowy; obj.rozmiar_bazowy = undefined; }
        przelicz();
        this.zbuduj();
      }));
      if (obj.autodopasowanie) {
        r.append(this.liczba(tt('wlasciwosci.najmniejszyRozmiar'), () => obj.min_rozmiar || 6, (v) => { obj.min_rozmiar = Math.max(1, v); przelicz(); }, { jednostka: 'pt', krok: 0.5, min: 1 }));
      }
      r.append(this.wskazowka(tt('wlasciwosci.tekstDluzszyNizRamka')));
    } else {
      r.append(this.wskazowka(tt('wlasciwosci.bezStalejWysokosciRamka')));
    }
  }

  // Kolor, położenie, rozmiar, obrót i widoczność elementu zależne od pola z danych (tabela albo pole dokumentu).
  zbudujZDanych(obj) {
    const grupy = this.opcje.pola?.() || [];
    const pola = grupy.flatMap((g) => g.pola.map(([nazwa]) => nazwa));
    const s = this.sekcja(tt('wlasciwosci.zDanych'));
    const z = () => obj.z_danych || {};
    const zapisz = (zmiana) => {
      const nowe = { ...z(), ...zmiana };
      for (const k of Object.keys(nowe)) if (!nowe[k] || (typeof nowe[k] === 'object' && !nowe[k].pole)) delete nowe[k];
      if (!nowe.szer && !nowe.wys) delete nowe.kotwica; // punkt zaczepienia ma sens tylko przy rozmiarze z danych
      if (!nowe.kolor) delete nowe.kolor_w;
      obj.z_danych = Object.keys(nowe).length ? nowe : undefined;
    };
    // Na liście: pola dostępne na tej stronie i to, które jest już ustawione (nawet nieznane).
    const lista = (wybrane) => [['', tt('wlasciwosci.nieZDanych')], ...[...new Set([...pola, ...(wybrane ? [wybrane] : [])])].map((n) => [n, `{${n}}`])];
    if (obj.type !== 'image') {
      // Wypełnienie przejściem kolorów: kolor z danych domyślnie zmienia pierwszy kolor, a przejście zostaje.
      const przejscie = maPrzejscie(obj);
      const kolor = this.wybor(tt('wlasciwosci.kolorZPola'), lista(z().kolor), () => z().kolor || '', (v) => {
        zapisz({ kolor: v || undefined, ...(v && przejscie && !z().kolor ? { kolor_w: 'pierwszy' } : {}) });
        this.zbuduj();
      });
      kolor.classList.add('szeroki');
      s.append(kolor);
      if (z().kolor && przejscie) {
        const gdzie = this.wybor(tt('wlasciwosci.wPrzejsciuKolorowPole'), [['pierwszy', tt('wlasciwosci.pierwszyKolorResztaZostaje')], ['ostatni', tt('wlasciwosci.ostatniKolorResztaZostaje')], ['odcienie', tt('wlasciwosci.calePrzejscieOdcienieKoloru')], ['', tt('wlasciwosci.caleWypelnienieJedenKolor')]], () => z().kolor_w || '', (v) => zapisz({ kolor_w: v || undefined }));
        gdzie.classList.add('szeroki');
        s.append(gdzie);
      }
    }
    for (const [os, etykieta] of [['y', tt('wlasciwosci.przesunieciePion')], ['x', tt('wlasciwosci.przesunieciePoziom')]]) {
      const ust = () => z()[os] || {};
      const wybor = this.wybor(etykieta, lista(ust().pole), () => ust().pole || '', (v) => {
        zapisz({ [os]: v ? { tryb: 'pozycja', krok: 10, co: 0, ...ust(), pole: v } : undefined });
        this.zbuduj();
      });
      wybor.classList.add('szeroki');
      s.append(wybor);
      if (!ust().pole) continue;
      const tryb = this.wybor(tt('wlasciwosci.wartoscPolaTo'), [['pozycja', tt('wlasciwosci.numerPozycji12')], ['mm', tt('wlasciwosci.przesuniecieWMm')]], () => ust().tryb || 'pozycja', (v) => { zapisz({ [os]: { ...ust(), tryb: v } }); this.zbuduj(); });
      tryb.classList.add('szeroki');
      s.append(tryb);
      if ((ust().tryb || 'pozycja') === 'pozycja') {
        s.append(this.liczba(tt('wlasciwosci.krok'), () => ust().krok ?? 10, (v) => zapisz({ [os]: { ...ust(), krok: v } }), { jednostka: 'mm', krok: 1 }));
        s.append(this.liczba(tt('wlasciwosci.odNowaCo'), () => ust().co || 0, (v) => zapisz({ [os]: { ...ust(), co: Math.max(0, Math.round(v)) } }), { jednostka: 'poz.', krok: 1, min: 0 }));
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
      const tryb = this.wybor(tt('wlasciwosci.wartoscPolaTo2', { x: wymiar === 'szer' ? tt('wlasciwosci.szerokosc') : tt('wlasciwosci.wysokosc') }), [['procent', tt('wlasciwosci.procentRozmiaruWzoru100')], ['mm', tt('wlasciwosci.rozmiarWMm')]], () => ust().tryb || 'procent', (v) => zapisz({ [wymiar]: { ...ust(), tryb: v } }));
      tryb.classList.add('szeroki');
      s.append(tryb);
    }
    if (z().szer || z().wys) {
      const kotwica = this.wybor(tt('wlasciwosci.przyZmianieRozmiaruNa'), [['', tt('wlasciwosci.lewyGornyRog')], ['srodek', tt('wlasciwosci.srodekElementu')], ['dol', tt('wlasciwosci.dolSrodekDolnejKrawedzi')]], () => z().kotwica || '', (v) => zapisz({ kotwica: v || undefined }));
      kotwica.classList.add('szeroki');
      s.append(kotwica);
      const jak = obj.type === 'textbox'
        ? tt(bezWysokosci ? 'wlasciwosci.skalaTekstSzer' : 'wlasciwosci.skalaTekst')
        : tt(obj.type === 'image' ? 'wlasciwosci.skalaObraz' : (toTabela(obj) ? 'wlasciwosci.skalaTabela' : 'wlasciwosci.skalaElement'));
      s.append(this.wskazowka(tt('wlasciwosci.wartosc0ChowaElement', { jak })));
    }
    // Obrót: kąt w stopniach z pola, dodawany do obrotu wzoru (wokół środka elementu).
    const obrot = this.wybor(tt('wlasciwosci.obrotZPolaStopnie'), lista(z().obrot), () => z().obrot || '', (v) => zapisz({ obrot: v || undefined }));
    obrot.classList.add('szeroki');
    s.append(obrot);
    // Widoczność: element jest na stronie tylko wtedy, gdy pole spełnia warunek (np. gwiazdka tylko w święta).
    const war = () => z().widok || {};
    const widok = this.wybor(tt('wlasciwosci.pokazElement'), [['', 'zawsze'], ['niepuste', tt('wlasciwosci.tylkoGdyPoleNie')], ['puste', tt('wlasciwosci.tylkoGdyPoleJest')], ['rowne', tt('wlasciwosci.tylkoGdyPoleRowna')]], () => (war().pole ? (war().gdy || 'niepuste') : ''), (v) => {
      zapisz({ widok: v ? { pole: pola[0] || '', ...war(), gdy: v } : undefined });
      this.zbuduj();
    });
    widok.classList.add('szeroki');
    s.append(widok);
    if (war().pole) {
      const poleWidoku = this.wybor(tt('wlasciwosci.poleOdKtoregoTo'), lista(war().pole).slice(1), () => war().pole, (v) => zapisz({ widok: { ...war(), pole: v } }));
      poleWidoku.classList.add('szeroki');
      s.append(poleWidoku);
      if (war().gdy === 'rowne') s.append(this.tekst(tt('wlasciwosci.wartosc'), () => war().wartosc || '', (v) => zapisz({ widok: { ...war(), wartosc: v } }), true));
    }
    const jest = z().kolor || z().x || z().y || z().obrot || z().widok || z().szer || z().wys;
    s.append(this.wskazowka(jest
      ? tt('wlasciwosci.wEdytorzeElementStoi')
      : tt('wlasciwosci.wygladZDanych')));
  }

  // Kształt tekstu (#131B): prosto, po łuku, okręgu, elipsie, po ścieżce (kształt ze strony) albo wygięty.
  zbudujKsztaltTekstu(obj) {
    const s = this.sekcja(tt('wlasciwosci.ksztaltTekstu'), { zwinieta: !obj.ksztalt_tekstu });
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
    const wybor = this.wybor(tt('wlasciwosci.ksztalt'), RODZAJE_KSZTALTU, () => normalizujKsztalt(obj.ksztalt_tekstu)?.rodzaj || 'prosto', (v) => {
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
      s.append(this.wskazowka(tt('wlasciwosci.napisPoLukuW')));
      return;
    }
    const sila = (etykieta) => this.liczba(etykieta, () => k().zgiecie, (v) => zmien({ zgiecie: Math.max(-100, Math.min(100, Math.round(v))) }), { jednostka: '%', krok: 5 });
    if (r === 'luk') {
      s.append(sila('Zgięcie'));
      s.append(this.liczba(tt('wlasciwosci.promien0Sam'), () => zaokr(k().promien, 1), (v) => zmien({ promien: Math.max(0, v) }), { jednostka: 'mm', krok: 1, min: 0 }));
    } else if (r === 'okrag') {
      s.append(this.liczba(tt('wlasciwosci.promien0Sam'), () => zaokr(k().promien, 1), (v) => zmien({ promien: Math.max(0, v) }), { jednostka: 'mm', krok: 1, min: 0 }));
      s.append(this.liczba(tt('wlasciwosci.obrotPoczatku'), () => k().przesuniecie, (v) => zmien({ przesuniecie: Math.round(v) }), { jednostka: '°', krok: 5 }));
      const strona = this.wybor(tt('wlasciwosci.litery'), [['zewn', tt('wlasciwosci.naZewnatrzUGory')], ['wewn', tt('wlasciwosci.doSrodkaUDolu')]], () => k().strona, (v) => zmien({ strona: v }));
      strona.classList.add('szeroki');
      s.append(strona);
    } else if (r === 'elipsa') {
      s.append(this.liczba(tt('wlasciwosci.promien0Sam'), () => zaokr(k().promien, 1), (v) => zmien({ promien: Math.max(0, v) }), { jednostka: 'mm', krok: 1, min: 0 }));
      s.append(this.liczba(tt('wlasciwosci.splaszczenie'), () => Math.abs(k().zgiecie), (v) => zmien({ zgiecie: Math.max(0, Math.min(100, Math.round(v))) }), { jednostka: '%', krok: 5, min: 0 }));
      s.append(this.liczba(tt('wlasciwosci.przesunieciePoczatku'), () => k().przesuniecie, (v) => zmien({ przesuniecie: Math.round(v) }), { jednostka: '%', krok: 5 }));
    } else if (r === 'sciezka') {
      // Kształty na tej stronie (bez tekstów i obrazów): tekst dostaje kopię ich linii.
      const ksztalty = this.edytor.canvas.getObjects().filter((o) => o !== obj && !o.zWzorca && ['rect', 'ellipse', 'circle', 'line', 'polygon', 'polyline', 'path'].includes(String(o.type).toLowerCase()));
      const opisy = ksztalty.map((o, i) => [o.id || String(i), `${o.nazwa || nazwaTypu(o)} ${i + 1}`]);
      const wskaz = this.wybor(tt('wlasciwosci.liniaZKsztaltuNa'), [['', ksztalty.length ? tt('wlasciwosci.wybierzKsztalt') : tt('wlasciwosci.naStronieNieMa')], ...opisy], () => obj._sciezkaZ || '', (v) => {
        const ks = ksztalty.find((o, i) => (o.id || String(i)) === v);
        const d = ks ? sciezkaZKsztaltu(ks, obj) : null;
        if (!d) return;
        obj._sciezkaZ = v;
        zmien({ d });
      });
      wskaz.classList.add('szeroki');
      s.append(wskaz);
      if (!k().d) s.append(this.wskazowka(tt('wlasciwosci.narysujLiniePioremKsztalt'), true));
      s.append(this.liczba(tt('wlasciwosci.przesunieciePoczatku'), () => k().przesuniecie, (v) => zmien({ przesuniecie: Math.round(v) }), { jednostka: '%', krok: 5 }));
      const wyr = this.wybor(tt('wlasciwosci.wyrownanie'), [['lewo', tt('wlasciwosci.odPoczatkuLinii')], ['srodek', tt('wlasciwosci.naSrodku')], ['prawo', tt('wlasciwosci.doKoncaLinii')]], () => k().wyrownanie, (v) => zmien({ wyrownanie: v }));
      wyr.classList.add('szeroki');
      s.append(wyr);
      const strona = this.wybor(tt('wlasciwosci.litery'), [['zewn', tt('wlasciwosci.nadLinia')], ['wewn', tt('wlasciwosci.podLinia')]], () => k().strona, (v) => zmien({ strona: v }));
      strona.classList.add('szeroki');
      s.append(strona);
      s.append(this.przelacznik(tt('wlasciwosci.odwrocKierunek'), () => k().odwroc, (v) => zmien({ odwroc: v })));
    } else {
      s.append(sila('Siła wygięcia'));
    }
    s.append(this.wskazowka(r === 'luk' || czyWygiecie(r)
      ? tt('wlasciwosci.uchwytPodTekstemZgina')
      : tt('wlasciwosci.wTrakciePisaniaTekst')));
  }

  // Styl tekstu: wybór, zapis jako nowy, aktualizacja, usunięcie.
  // Skład akapitu (#131): dzielenie wyrazów, spójniki, wdowy i sieroty, siatka bazowa, inicjał, tabulatory.
  // Zwinięta, dopóki tekst nie używa żadnego z tych ustawień poza domyślnymi dla nowych tekstów.
  zbudujSklad(obj) {
    const uzywa = obj.dziel_wyrazy || obj.inicjal || obj.tabulatory?.length || obj.do_siatki || obj.bez_oblewania;
    const s = this.sekcja(tt('wlasciwosci.skladAkapitu'), { zwinieta: !uzywa });
    const przebuduj = () => setTimeout(() => this.zbuduj());
    const ustaw = (k, v) => { obj.set(k, v); this.edytor.ulozSkladStrony?.(); };

    s.append(this.przelacznik(tt('wlasciwosci.dzielWyrazy'), () => Boolean(obj.dziel_wyrazy), (v) => { ustaw('dziel_wyrazy', v || undefined); przebuduj(); }));
    if (obj.dziel_wyrazy) {
      s.append(this.liczba(tt('wlasciwosci.najkrotszyDzielonyWyraz'), () => obj.dziel_min || 5, (v) => ustaw('dziel_min', Math.max(3, Math.min(15, Math.round(v)))), { jednostka: 'liter', krok: 1, min: 3 }));
      s.append(this.liczba(tt('wlasciwosci.najmniejLiterPrzedLacznikiem'), () => obj.dziel_przed || 2, (v) => ustaw('dziel_przed', Math.max(1, Math.min(6, Math.round(v)))), { jednostka: 'liter', krok: 1, min: 1 }));
      s.append(this.liczba(tt('wlasciwosci.najmniejLiterPoLaczniku'), () => obj.dziel_po || 2, (v) => ustaw('dziel_po', Math.max(1, Math.min(6, Math.round(v)))), { jednostka: 'liter', krok: 1, min: 1 }));
    }
    // Włączone domyślnie (#424) – wyłączenie zapisuje się jako false.
    s.append(this.przelacznik(tt('wlasciwosci.polskieZasadySkladu'), () => zasadyPl(obj), (v) => { ustaw('zasady_pl', v ? true : false); this.zbuduj(); }));
    s.append(this.wskazowka(zasadyPl(obj) ? tt('wlasciwosci.zasadyPilnowaneSame') : tt('wlasciwosci.zasadyWylaczone'), !zasadyPl(obj)));
    if (zasadyPl(obj)) s.append(this.przelacznik(tt('wlasciwosci.poprawiajZnaki'), () => !obj.znaki_bez_zmian, (v) => ustaw('znaki_bez_zmian', v ? undefined : true)));
    s.append(this.wskazowka(tt('wlasciwosci.nieLamieWierszaPo')));
    s.append(this.przelacznik(tt('wlasciwosci.lamCalyAkapitNaraz'), () => Boolean(obj.lamanie_akapitu), (v) => ustaw('lamanie_akapitu', v || undefined)));
    s.append(this.wskazowka(tt('wlasciwosci.wierszeAkapituDobieraneRazem')));
    // Uwagi do składu tego tekstu i poprawka znaków jednym przyciskiem (#323).
    // Tekst z polami (#418): uwagi z prawdziwych stron po przeliczeniu (jak w ostrzeżeniach), nie z nazw pól.
    if (this.edytor.poPrzeliczeniu?.(obj)) {
      const ost = (this.edytor.ostrzezenia || []).find((x) => x.id === obj.id && x.typ === 'sklad_pl');
      if (ost) s.append(this.wskazowka(ost.opis, true));
    } else {
      const uwagiSk = uwagiSkladuTekstu(obj);
      if (uwagiSk.length) s.append(this.wskazowka(`${tt('wlasciwosci.niezgodneZZasadami', { join: uwagiSk.map((u) => `${u.opis}${u.przyklad ? ` („${u.przyklad}”)` : ''}`).join('; ') })} ${tt('wlasciwosci.miejscaNaFioletowo')}`, true));
    }
    const poprawki = poprawkiZnakow(obj.text);
    if (poprawki.length) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'przycisk maly';
      b.textContent = tt('wlasciwosci.poprawZnaki', { poprawkiIle: poprawki.length });
      b.title = tt('wlasciwosci.cudzyslowyPolpauzyZamiastDywizow');
      b.addEventListener('click', () => { this.edytor.poprawZnaki?.(obj); setTimeout(() => this.zbuduj()); });
      s.append(b);
    }
    const spojniki = this.wybor(tt('wlasciwosci.spojnikiNaKoncuWiersza'), [
      ['', tt('wlasciwosci.mogaZostacNaKoncu')],
      ['tak', tt('wlasciwosci.aIWZ')],
      ['dwuliterowe', tt('wlasciwosci.takzeDoNaZe')],
    ], () => (obj.spojniki === true ? 'tak' : (obj.spojniki || '')), (v) => ustaw('spojniki', v === 'tak' ? true : (v || undefined)));
    spojniki.classList.add('szeroki');
    if (!zasadyPl(obj)) s.append(spojniki); // z polskimi zasadami krótkie słówka przechodzą same (#424)
    const wdowy = this.wybor(tt('wlasciwosci.wdowyISieroty'), [
      ['', tt('wlasciwosci.bezPilnowania')],
      ['2', tt('wlasciwosci.coNajmniej2Wiersze')],
      ['3', tt('wlasciwosci.coNajmniej3Wiersze')],
    ], () => (obj.wdowy ? String(obj.wdowy) : ''), (v) => ustaw('wdowy', v ? Number(v) : undefined));
    wdowy.classList.add('szeroki');
    s.append(wdowy);
    s.append(this.wskazowka(tt('wlasciwosci.wdowyISierotyAkapit')));

    s.append(this.przelacznik(tt('wlasciwosci.wyrownajDoSiatkiLinii'), () => Boolean(obj.do_siatki), (v) => { ustaw('do_siatki', v || undefined); przebuduj(); }));
    if (obj.do_siatki && !this.edytor.wydruk?.siatka_bazowa) s.append(this.wskazowka(tt('wlasciwosci.taSekcjaNieMa'), true));

    // Inicjał: pierwsza litera pierwszego akapitu na kilka wierszy.
    const inicjal = this.wybor(tt('wlasciwosci.inicjal'), [['', 'brak'], ['2', tt('wlasciwosci.na2Wiersze')], ['3', tt('wlasciwosci.na3Wiersze')], ['4', tt('wlasciwosci.na4Wiersze')], ['5', tt('wlasciwosci.na5Wierszy')]],
      () => (obj.inicjal ? String(obj.inicjal) : ''), (v) => { ustaw('inicjal', v ? Number(v) : undefined); przebuduj(); });
    inicjal.classList.add('szeroki');
    s.append(inicjal);
    if (obj.inicjal) {
      const rodziny = this.opcje.czcionki?.() || CZCIONKI.map((c) => c.nazwa);
      this._czcionkiWLiscie = true;
      const cz = this.wybor(tt('wlasciwosci.czcionkaInicjalu'), [['', tt('wlasciwosci.jakWTekscie')], ...rodziny.map((n) => [n, n])], () => obj.inicjal_czcionka || '', (v) => {
        ustaw('inicjal_czcionka', v || undefined);
        if (v) this.edytor.doczytajCzcionke(v);
      });
      this._czcionkiWLiscie = false;
      cz.classList.add('szeroki');
      s.append(cz);
      s.append(this.kolor(tt('wlasciwosci.kolorInicjalu'), () => obj.inicjal_kolor || '', (v) => ustaw('inicjal_kolor', v || undefined), { brak: true }));
    }

    // Tabulatory: klawisz Tab w tekście przeskakuje do najbliższej pozycji.
    const tabs = obj.tabulatory || [];
    const zapiszTaby = (lista) => { ustaw('tabulatory', lista.length ? lista.map((t) => ({ ...t })) : undefined); przebuduj(); };
    tabs.forEach((t, i) => {
      const wiersz = document.createElement('div');
      wiersz.className = 'wiersz-tabulatora';
      const zmien = (pole, v) => { const lista = tabs.map((x) => ({ ...x })); lista[i][pole] = v; zapiszTaby(lista.sort((a, b) => a.poz - b.poz)); };
      wiersz.append(
        this.liczba(tt('wlasciwosci.tabulator', { x: i + 1 }), () => zaokr(t.poz, 1), (v) => zmien('poz', Math.max(0, v)), { jednostka: 'mm', krok: 1, min: 0 }),
        this.wybor(tt('wlasciwosci.wyrownanie'), [['lewy', tt('wlasciwosci.doLewej2')], ['srodek', tt('wlasciwosci.doSrodka2')], ['prawy', tt('wlasciwosci.doPrawej2')], ['dziesietny', tt('wlasciwosci.doPrzecinka')]], () => t.rodzaj || 'lewy', (v) => zmien('rodzaj', v)),
        this.wybor(tt('wlasciwosci.wypelnienie'), [['', 'brak'], ['.', tt('wlasciwosci.kropki')], ['-', tt('wlasciwosci.kreski2')], ['_', tt('wlasciwosci.linia2')]], () => t.wypelniacz || '', (v) => zmien('wypelniacz', v)),
        this.akcje([['kosz', tt('wlasciwosci.usunTabulator', { n: i + 1 }), () => zapiszTaby(tabs.filter((_, j) => j !== i))]]),
      );
      s.append(wiersz);
    });
    s.append(this.akcje([['plus', 'Dodaj tabulator', () => {
      const ost = Math.max(0, ...tabs.map((t) => t.poz));
      zapiszTaby([...tabs, { poz: Math.round(Math.min(obj.width, ost + Math.max(10, obj.width / 4))), rodzaj: tabs.length ? 'prawy' : 'lewy', wypelniacz: tabs.length ? '.' : '' }]);
    }]]));
    s.append(this.wskazowka(tt('wlasciwosci.klawiszTabWPisanym')));
    s.append(this.przelacznik(tt('wlasciwosci.nieOplywajInnychElementow'), () => Boolean(obj.bez_oblewania), (v) => ustaw('bez_oblewania', v || undefined)));
  }

  // Pisownia (#131C): słowa spoza słownika w tym tekście z podpowiedziami – działa też na telefonie,
  // gdzie nie ma menu pod prawym przyciskiem. Tylko gdy sprawdzanie pisowni jest włączone (menu widoku).
  zbudujPisownie(obj) {
    const p = this.opcje.pisownia;
    if (!p?.wlaczona()) return;
    const s = this.sekcja(tt('wlasciwosci.pisownia'), { zwinieta: false });
    const lista = document.createElement('div');
    lista.className = 'lista-pisowni';
    lista.textContent = tt('wlasciwosci.sprawdzam');
    s.append(lista);
    p.bledyTekstu(obj).then(async (bledy) => {
      if (!lista.isConnected) return;
      lista.replaceChildren();
      if (!bledy.length) { lista.append(this.wskazowka(tt('wlasciwosci.bezBledowWszystkieSlowa'))); return; }
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
          b.title = tt('wlasciwosci.zamienNaWTym', { slowo, nowe });
          b.addEventListener('click', () => { p.popraw(obj, slowo, nowe); setTimeout(() => this.zbuduj()); });
          podp.append(b);
        }
        const dodaj = document.createElement('button');
        dodaj.type = 'button';
        dodaj.className = 'przycisk maly przezroczysty';
        dodaj.textContent = tt('wlasciwosci.dodajDoSlownika');
        dodaj.addEventListener('click', async () => { await p.dodajDoSlownika(slowo); setTimeout(() => this.zbuduj()); });
        podp.append(dodaj);
      }
    }).catch((e) => { if (lista.isConnected) lista.textContent = tt('wlasciwosci.nieUdaloSieSprawdzic', { message: e.message }); });
  }

  // Książka (#131B): przypisy dolne, odsyłacze i hasła skorowidza tego tekstu.
  zbudujKsiazke(obj) {
    const projekt = this.opcje.projekt?.();
    if (!projekt) return;
    const przypisy = Object.entries(obj.przypisy || {});
    const hasla = obj.hasla || [];
    const s = this.sekcja(tt('wlasciwosci.przypisyOdsylaczeSkorowidz'), { zwinieta: !przypisy.length && !hasla.length && !/\{s:/.test(obj.text || '') });
    const przebuduj = () => setTimeout(() => this.zbuduj());
    const poZmianie = () => this.opcje.poZmianieKsiazki?.();
    // Przypisy dolne.
    s.append(this.akcje([['plus', 'Wstaw przypis', () => { this.edytor.wstawPrzypis(''); poZmianie(); przebuduj(); }]]));
    przypisy.forEach(([id, tresc], i) => {
      const pole = this.obszarTekstu(`Przypis ${i + 1}`, () => obj.przypisy?.[id] ?? tresc, (v) => this.edytor.zmienPrzypis(obj, id, v));
      pole.querySelector('textarea')?.addEventListener('change', poZmianie);
      s.append(pole, this.akcje([['kosz', tt('wlasciwosci.usunPrzypis', { n: i + 1 }), () => { this.edytor.zmienPrzypis(obj, id, null); poZmianie(); przebuduj(); }]]));
    });
    if (przypisy.length) {
      const liczenie = this.wybor(tt('wlasciwosci.numeracjaPrzypisow'), Object.entries(LICZENIE_PRZYPISOW), () => projekt.ksiazka?.przypisy || 'sekcja', (v) => {
        projekt.ksiazka = { ...(projekt.ksiazka || {}), przypisy: v };
        poZmianie();
      });
      liczenie.classList.add('szeroki');
      s.append(liczenie);
    }
    s.append(this.wskazowka(tt('wlasciwosci.przypisNumerWTekscie')));
    // Odsyłacz do nagłówka.
    const cele = celeOdsylaczy(projekt);
    if (cele.length) {
      const odsylacz = this.wybor(tt('wlasciwosci.wstawOdsylaczDo'), [['', tt('wlasciwosci.wybierzNaglowek')], ...cele.map((c) => [c.id, `${'· '.repeat(c.poziom - 1)}${c.tekst.slice(0, 60)}${c.nr !== null ? ` (s. ${c.nr})` : ''}`])], () => '', (v) => {
        if (!v) return;
        this.edytor.wstawOdsylacz(v);
        poZmianie();
      });
      odsylacz.classList.add('szeroki');
      s.append(odsylacz, this.wskazowka(tt('wlasciwosci.odsylaczWstawiaS12')));
    } else s.append(this.wskazowka(tt('wlasciwosci.odsylaczeProwadzaDoNaglowkow')));
    // Skorowidz.
    s.append(this.akcje([['plus', 'Dodaj do skorowidza', async () => {
      let slowo = this.edytor.dodajDoSkorowidza();
      if (!slowo) {
        const wpis = await zapytajONazwe(tt('wlasciwosci.dodajDoSkorowidza'), tt('wlasciwosci.hasloSlowoZTego'), '');
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
        b.title = tt('wlasciwosci.usunZeSkorowidza', { h });
        b.innerHTML = `<span></span>${ikona('zamknij', { rozmiar: 12 })}`;
        b.querySelector('span').textContent = h;
        b.addEventListener('click', () => { this.edytor.usunZeSkorowidza(obj, h); poZmianie(); przebuduj(); });
        lista.append(b);
      }
      s.append(lista);
    }
    s.append(this.wskazowka(tt('wlasciwosci.zaznaczSlowoWPisanym')));
  }

  // Spis treści albo skorowidz – tekst składany sam (#131B).
  zbudujElementKsiazki(obj) {
    const projekt = this.opcje.projekt?.();
    const poZmianie = () => this.opcje.poZmianieKsiazki?.();
    const przebuduj = () => setTimeout(() => this.zbuduj());
    const k = obj.ksiazka;
    const s = this.sekcja(RODZAJE_KSIAZKI[k.rodzaj] || tt('wlasciwosci.spisTresci'));
    if (k.rodzaj === 'spis') {
      const poziomy = this.wybor(tt('wlasciwosci.poziomy'), [['1', tt('wlasciwosci.tylkoRozdzialy')], ['2', tt('wlasciwosci.rozdzialyIPodrozdzialy')], ['3', tt('wlasciwosci.trzyPoziomy')]], () => String(k.poziomy || 2), (v) => { obj.ksiazka = { ...obj.ksiazka, poziomy: Number(v) }; poZmianie(); });
      poziomy.classList.add('szeroki');
      s.append(poziomy);
    }
    s.append(this.przelacznik(tt('wlasciwosci.kropkiDoNumeruStrony'), () => k.kropki !== false, (v) => { obj.ksiazka = { ...obj.ksiazka, kropki: v }; poZmianie(); }));
    if (k.rodzaj === 'spis' && projekt) {
      // Które style akapitu są nagłówkami – wspólne dla spisu treści, żywej paginy i odsyłaczy.
      const nagl = naglowkiProjektu(projekt);
      const poziomStylu = new Map(nagl.map((n) => [n.styl, n.poziom]));
      for (const st of projekt.style || []) {
        s.append(this.wybor(tt('wlasciwosci.styl2', { nazwa: st.nazwa }), [['', tt('wlasciwosci.nieJestNaglowkiem')], ['1', tt('wlasciwosci.naglowek1Rozdzial')], ['2', tt('wlasciwosci.naglowek2')], ['3', tt('wlasciwosci.naglowek3')]], () => String(poziomStylu.get(st.id) || ''), (v) => {
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
      ? tt('wlasciwosci.skorowidzUkladaSieSam')
      : tt('wlasciwosci.spisTresciUkladaSie')));
  }

  zbudujStyl(obj) {
    const style = this.opcje.style?.();
    if (!style) return;
    const s = this.sekcja(tt('wlasciwosci.stylTekstu'));
    const znajdz = () => style.find((x) => x.id === obj.styl);
    const rozniSie = () => {
      const st = znajdz();
      if (!st) return false;
      const teraz = stylZObiektu(obj, st.nazwa, st.id);
      return POLA_STYLU.some((k) => st[k] !== undefined && !rowneWStylu(st[k], teraz[k]));
    };
    const wybor = this.wybor(tt('wlasciwosci.styl'), [['', tt('wlasciwosci.bezStylu')], ...style.map((x) => [x.id, x.nazwa])], () => obj.styl || '', (v) => {
      const st = style.find((x) => x.id === v);
      if (st) zastosujStyl(obj, st); else obj.styl = undefined;
      this.opcje.poZmianieStyli(null);
    });
    wybor.classList.add('szeroki');
    s.append(wybor);

    const zmieniony = this.wskazowka(tt('wlasciwosci.tenTekstRozniSie'));
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
    const nowy = przycisk(tt('wlasciwosci.nowyStyl'), 'Zapisz wygląd tego tekstu jako nowy styl', async () => {
      const nazwa = await zapytajONazwe(tt('wlasciwosci.nowyStylTekstu'), tt('wlasciwosci.nazwaStylu'), tt('wlasciwosci.mojStyl'));
      if (!nazwa) return;
      const st = stylZObiektu(obj, nazwa);
      style.push(st);
      obj.styl = st.id;
      this.opcje.poZmianieStyli(null);
      this.zbuduj();
    });
    const aktualizuj = przycisk(tt('wlasciwosci.aktualizujStyl'), 'Przenieś wygląd tego tekstu do stylu – zmienią się wszystkie teksty z tym stylem', () => {
      const st = znajdz();
      Object.assign(st, stylZObiektu(obj, st.nazwa, st.id));
      this.opcje.poZmianieStyli(st);
    });
    const przywroc = przycisk(tt('wlasciwosci.przywroc'), 'Wróć do wyglądu zapisanego w stylu', () => {
      zastosujStyl(obj, znajdz());
      this.edytor.zatwierdz();
      this.odswiez();
    });
    const usun = przycisk(tt('wlasciwosci.usunStyl'), 'Usuń styl – teksty zachowają wygląd', async () => {
      const st = znajdz();
      if (!await potwierdz(tt('wlasciwosci.usunacStyl', { nazwa: st.nazwa }), tt('wlasciwosci.tekstyZachowajaObecnyWyglad'), tt('wlasciwosci.usunStyl'), true)) return;
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
    const wybor = this.wybor(tt('wlasciwosci.stylZnakowy'), [['', tt('wlasciwosci.bezStyluZnakowego')], ...lista.map((x) => [x.id, x.nazwa])], aktualny, (v) => {
      zastosujStylZnakowy(obj, lista.find((x) => x.id === v) || null);
      this.opcje.poZmianieStyliZnakowych?.(null);
    });
    wybor.classList.add('szeroki');
    wybor.title = tt('wlasciwosci.nadajeStylZaznaczonemuFragmentowi');
    const przyciski = this.akcje([
      ['plus', 'Nowy styl znakowy – z wyglądu zaznaczonego fragmentu', async () => {
        const nazwa = await zapytajONazwe(tt('wlasciwosci.nowyStylZnakowy'), tt('wlasciwosci.nazwaStylu'), tt('wlasciwosci.wyroznienie'));
        if (!nazwa) return;
        const i = fragment() ? obj.selectionStart : 0;
        const st = stylZnakowyZFragmentu(obj.getStyleAtPosition ? obj.getStyleAtPosition(i, true) : obj, nazwa);
        lista.push(st);
        zastosujStylZnakowy(obj, st);
        this.opcje.poZmianieStyliZnakowych?.(null);
        this.zbuduj();
      }],
      ['olowek', tt('wlasciwosci.aktualizujStylZZaznaczenia'), () => {
        const st = lista.find((x) => x.id === aktualny());
        if (!st) { powiadom(tt('wlasciwosci.zaznaczFragmentKtoryMa'), true); return; }
        const i = fragment() ? obj.selectionStart : 0;
        Object.assign(st, stylZnakowyZFragmentu(obj.getStyleAtPosition(i, true), st.nazwa, st.id));
        this.opcje.poZmianieStyliZnakowych?.(st);
      }],
      ['kosz', 'Usuń styl – fragmenty zachowają wygląd', async () => {
        const st = lista.find((x) => x.id === aktualny());
        if (!st) return;
        if (!await potwierdz(tt('wlasciwosci.usunacStylZnakowy', { nazwa: st.nazwa }), tt('wlasciwosci.fragmentyZachowajaObecnyWyglad'), tt('wlasciwosci.usunStyl'), true)) return;
        lista.splice(lista.indexOf(st), 1);
        this.opcje.poZmianieStyliZnakowych?.({ usuniety: st.id });
        this.zbuduj();
      }],
    ]);
    s.append(wybor, przyciski);
  }

  // Wzór jako wypełnienie (#182): siatka wzorów z podglądem, kolor wzoru, kolor tła, skala i obrót.
  czescWzoru(s, obj, { bezTla = false } = {}) {
    const wybor = document.createElement('div');
    wybor.className = 'wybor-wzoru';
    wybor.setAttribute('role', 'group');
    wybor.setAttribute('aria-label', tt('wlasciwosci.wzor'));
    wybor.innerHTML = WZORY.map((w) => `<button type="button" data-wzor="${w.id}" title="${w.nazwa}" aria-label="${w.nazwa}">${podgladWzoru(w.id)}</button>`).join('');
    const zapiszWzor = this._zapisz((id) => this.edytor.ustawWzor(obj, id));
    wybor.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-wzor]');
      if (b) zapiszWzor(b.dataset.wzor);
    });
    const odswiezWybor = () => { for (const b of wybor.children) b.setAttribute('aria-pressed', String(b.dataset.wzor === obj.wzor?.id)); };
    this.odswiezacze.push(odswiezWybor);
    odswiezWybor();
    s.append(wybor);
    const zmien = (zmiany) => this.edytor.ustawWzor(obj, obj.wzor?.id, zmiany);
    s.append(this.kolor(tt('wlasciwosci.kolorWzoru'), () => obj.wzor?.kolor || '#2f5d8a', (v) => zmien({ kolor: v })));
    if (!bezTla && (typeof obj.fill === 'string' || !obj.fill)) s.append(this.kolor(tt('wlasciwosci.kolorTla'), () => (typeof obj.fill === 'string' ? obj.fill : ''), (v) => obj.set('fill', v || ''), { brak: true }));
    s.append(this.liczba(tt('wlasciwosci.skalaWzoru'), () => Math.round((obj.wzor?.skala ?? 1) * 100), (v) => zmien({ skala: Math.min(400, Math.max(25, v)) / 100 }), { jednostka: '%', krok: 25, min: 25 }));
    s.append(this.liczba(tt('wlasciwosci.obrotWzoru'), () => Math.round(obj.wzor?.obrot ?? 0), (v) => zmien({ obrot: v }), { jednostka: '°', krok: 15 }));
  }

  zbudujWypelnienie(obj) {
    if (obj.type === 'polygon') {
      const k = this.sekcja(tt('wlasciwosci.ksztalt'));
      // Gotowe kształty (#152): ten sam wybór co przy wstawianiu; miejsce i wielkość zostają.
      const wybor = document.createElement('div');
      wybor.className = 'siatka-wielokatow wybor-wielokata';
      wybor.setAttribute('role', 'group');
      wybor.setAttribute('aria-label', tt('wlasciwosci.ksztaltWielokata'));
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
      k.append(this.liczba(tt('wlasciwosci.liczbaBokow'), () => obj.boki || obj.points.length, (v) => this.edytor.przeksztalcWielokat(obj, v, obj.gwiazda), { krok: 1, min: 3 }));
      k.append(this.przelacznik(tt('wlasciwosci.gwiazda'), () => Boolean(obj.gwiazda), (v) => this.edytor.przeksztalcWielokat(obj, obj.boki || 5, v)));
    }
    const s = this.sekcja(tt('wlasciwosci.wypelnienieIObrys'));
    // Wypełnienie: jeden kolor, przejście liniowe albo kołowe – z dowolną liczbą kolorów.
    const gradient = () => (obj.fill && typeof obj.fill === 'object' && obj.fill.colorStops ? obj.fill : null);
    const rodzaj = () => (obj.wzor ? 'wzor' : gradient() ? (gradient().type === 'radial' ? 'kolowy' : 'liniowy') : (!obj.fill || obj.fill === 'transparent' ? 'brak' : 'kolor'));
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
    const rodzaje = [['kolor', 'Jeden kolor'], ['liniowy', 'Przejście liniowe'], ['kolowy', 'Przejście kołowe'], ...(moznaWzor(obj) ? [['wzor', 'Wzór']] : []), ['brak', 'Brak']];
    const wyborRodzaju = this.wybor(tt('wlasciwosci.wypelnienie'), rodzaje, rodzaj, (v) => {
      const kolor = pierwszyKolor();
      // Wzór (#182) leży na tle z wypełnienia – przy zmianie na inny rodzaj znika, tło zostaje.
      if (v === 'wzor') { this.edytor.ustawWzor(obj, obj.wzor?.id || 'paski-skosne'); this.zbuduj(); return; }
      if (obj.wzor) this.edytor.ustawWzor(obj, null);
      if (v === 'kolor') obj.set('fill', kolor);
      else if (v === 'brak') obj.set('fill', '');
      else ustawGradient({ typ: v, kolory: gradient() ? przystanki() : [{ offset: 0, color: kolor }, { offset: 1, color: '#ffffff' }], wsp: gradient()?.type === 'linear' ? wspolrzedne() : KIERUNKI.poziomo, r: 50 });
      this.zbuduj();
    });
    wyborRodzaju.classList.add('szeroki');
    s.append(wyborRodzaju);
    if (rodzaj() === 'kolor') s.append(this.kolor(tt('wlasciwosci.kolorWypelnienia'), () => obj.fill, (v) => obj.set('fill', v)));
    if (rodzaj() === 'wzor') this.czescWzoru(s, obj);
    if (gradient()) {
      // Kolory przejścia: każdy ma położenie w procentach; dwa skrajne zostają zawsze.
      przystanki().forEach((p, i, wszystkie) => {
        // Kolor punktu z kryciem (#123): kolor wybiera się bez przezroczystości, krycie osobną liczbą.
        const zKryciem = (kolor, krycie) => { const [r, g, b] = new fabric.Color(kolor).getSource(); return krycie >= 1 ? `#${new fabric.Color(kolor).toHex()}` : `rgba(${r},${g},${b},${Math.round(krycie * 100) / 100})`; };
        const krycieP = () => new fabric.Color(przystanki()[i]?.color || '#000').getAlpha();
        s.append(this.kolor(tt('wlasciwosci.kolor2', { x: i + 1 }), () => `#${new fabric.Color(przystanki()[i]?.color || '#000').toHex()}`, (v) => { const k = przystanki(); k[i].color = zKryciem(v, krycieP()); ustawGradient({ kolory: k }); }));
        s.append(this.liczba(tt('wlasciwosci.krycie'), () => Math.round(krycieP() * 100), (v) => { const k = przystanki(); k[i].color = zKryciem(k[i].color, Math.min(100, Math.max(0, v)) / 100); ustawGradient({ kolory: k }); }, { jednostka: '%', krok: 10, min: 0 }));
        const polozenie = this.liczba(tt('wlasciwosci.polozenie'), () => Math.round((przystanki()[i]?.offset ?? 0) * 100), (v) => { const k = przystanki(); k[i].offset = Math.min(100, Math.max(0, v)) / 100; ustawGradient({ kolory: k }); this.zbuduj(); }, { jednostka: '%', krok: 5, min: 0 });
        if (wszystkie.length > 2) {
          const usun = document.createElement('button');
          usun.type = 'button';
          usun.className = 'przycisk-ikona usun-prowadnice';
          usun.title = tt('wlasciwosci.usunTenKolorZ');
          usun.setAttribute('aria-label', tt('wlasciwosci.usunKolor', { x: i + 1 }));
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
        const kier = this.segmenty(tt('wlasciwosci.kierunekPrzejscia'), [
          ['wyrownajSrodekY', tt('wlasciwosci.poziomo'), () => kierunek() === 'poziomo', () => ustawGradient({ wsp: KIERUNKI.poziomo })],
          ['wyrownajSrodekX', tt('wlasciwosci.pionowo'), () => kierunek() === 'pionowo', () => ustawGradient({ wsp: KIERUNKI.pionowo })],
          ['linia', tt('wlasciwosci.poSkosie'), () => kierunek() === 'ukos', () => ustawGradient({ wsp: KIERUNKI.ukos })],
        ]);
        s.append(kier);
        s.append(this.liczba(tt('wlasciwosci.kat'), kat, (v) => {
          const rad = (v * Math.PI) / 180;
          const [dx, dy] = [Math.cos(rad) / 2, Math.sin(rad) / 2];
          ustawGradient({ wsp: [0.5 - dx, 0.5 - dy, 0.5 + dx, 0.5 + dy].map((x) => Math.round(x * 1000) / 1000) });
        }, { jednostka: '°', krok: 15 }));
      } else {
        s.append(this.liczba(tt('wlasciwosci.promien'), promien, (v) => ustawGradient({ r: Math.min(200, Math.max(5, v)) }), { jednostka: '%', krok: 5, min: 5 }));
      }
    }
    this.polaObrysu(s, obj);
    if (obj.type === 'rect') {
      s.append(this.liczba(tt('wlasciwosci.zaokraglenie'), () => zaokr(obj.rx || 0, 1), (v) => obj.set({ rx: Math.max(0, v), ry: Math.max(0, v) }), { jednostka: 'mm', krok: 0.5, min: 0 }));
    }
  }

  // Filtry obrazu (#123): bez zmiany pliku – jasność, kontrast, nasycenie, szarość, sepia, rozmycie.
  zbudujFiltry(obj) {
    const s = this.sekcja(tt('wlasciwosci.filtry'), { zwinieta: !maFiltry(obj.filtry) });
    const f = () => ({ ...BEZ_FILTROW, ...(obj.filtry || {}) });
    const ustaw = (zmiana) => {
      const nowe = { ...f(), ...zmiana };
      obj.set('filtry', maFiltry(nowe) ? Object.fromEntries(Object.entries(nowe).filter(([, v]) => v)) : undefined);
      obj.dirty = true;
    };
    const suwak = (etyk, k, min, max) => this.liczba(etyk, () => f()[k], (v) => ustaw({ [k]: Math.max(min, Math.min(max, Math.round(v))) }), { krok: 5, min });
    s.append(suwak('Jasność', 'jasnosc', -100, 100), suwak('Kontrast', 'kontrast', -100, 100), suwak('Nasycenie', 'nasycenie', -100, 100), suwak('Rozmycie', 'rozmycie', 0, 100));
    s.append(this.przelacznik(tt('wlasciwosci.odcienSzarosci'), () => f().szarosc, (v) => ustaw({ szarosc: v })));
    s.append(this.przelacznik(tt('wlasciwosci.sepia'), () => f().sepia, (v) => ustaw({ sepia: v })));
    if (maFiltry(obj.filtry)) s.append(this.akcje([['gumka', 'Bez filtrów', () => { obj.set('filtry', undefined); obj.dirty = true; this.edytor.zatwierdz(); this.zbuduj(); }]]));
    s.append(this.wskazowka(tt('wlasciwosci.plikObrazuSieNie')));
  }

  // Kształt jako ramka obrazu (#123): obraz przycięty do kształtu i wypełniający go.
  zbudujObrazWKsztalcie(obj) {
    const s = this.sekcja(tt('wlasciwosci.obrazWKsztalcie'));
    const e = this.edytor;
    if (!maObraz(obj)) {
      if (this.opcje.wstawObrazDoKsztaltu) s.append(this.akcje([['obraz', 'Wstaw obraz do kształtu', () => this.opcje.wstawObrazDoKsztaltu(obj)]]));
      s.append(this.wskazowka(tt('wlasciwosci.ksztaltStanieSieRamka')));
    } else {
      const akcje = [];
      if (this.opcje.wstawObrazDoKsztaltu) akcje.push(['obraz', 'Zmień obraz', () => this.opcje.wstawObrazDoKsztaltu(obj)]);
      akcje.push(['dopasuj', 'Kadruj', () => { if (!e.kadrujWKsztalcie(obj)) powiadom(tt('wlasciwosci.zablokowanyKsztaltKadrujeszLiczbami')); }]);
      s.append(this.akcje(akcje));
      const akcje2 = [];
      if (this.opcje.wyjmijObrazZKsztaltu) akcje2.push(['rozgrupuj', 'Wyjmij obraz', () => this.opcje.wyjmijObrazZKsztaltu(obj)]);
      akcje2.push(['kosz', 'Usuń obraz', () => e.usunObrazZKsztaltu(obj)]);
      s.append(this.akcje(akcje2));
      s.append(this.wskazowka(tt('wlasciwosci.kliknijKsztaltDwaRazy')));
      const kadr = () => obj.obraz_kadr || {};
      s.append(this.liczba(tt('wlasciwosci.powiekszenie'), () => Math.round((kadr().skala || 1) * 100), (v) => e.ustawKadrWKsztalcie(obj, { skala: Math.max(100, v) / 100 }), { jednostka: '%', krok: 10, min: 100 }));
      s.append(this.liczba(tt('wlasciwosci.przesuniecieWPoziomie'), () => Math.round((kadr().x || 0) * 100), (v) => e.ustawKadrWKsztalcie(obj, { x: v / 100 }), { jednostka: '%', krok: 5 }));
      s.append(this.liczba(tt('wlasciwosci.przesuniecieWPionie'), () => Math.round((kadr().y || 0) * 100), (v) => e.ustawKadrWKsztalcie(obj, { y: v / 100 }), { jednostka: '%', krok: 5 }));
      if (this.opcje.usunTlo) s.append(this.akcje([['gumka', 'Usuń tło…', () => this.opcje.usunTlo(obj)]]));
      const info = this.wskazowka('');
      this.odswiezacze.push(() => {
        if (!obj._obrazEl) { info.textContent = ''; return; }
        const u = ukladObrazu(obj, obj._obrazEl);
        const dpi = Math.round(25.4 / u.k);
        info.textContent = tt('wlasciwosci.oryginalPxDpiW', { nw: u.nw, nh: u.nh, dpi, x: dpi < 300 ? tt('wlasciwosci.doDrukuZalecaneJest') : '' });
        info.classList.toggle('uwaga', dpi < 300);
      });
      s.append(info);
      this.odswiezacze.at(-1)();
    }
    // Obraz z danych: kolumna z nazwą pliku – na każdej powielonej stronie inny obraz w tym kształcie.
    const kolumny = this.opcje.kolumnyObrazu?.() || [];
    if (kolumny.length) {
      const wybor = this.wybor(tt('wlasciwosci.obrazZKolumny'), [['', tt('wlasciwosci.stalyObraz')], ...kolumny.map((k) => [k, k])], () => obj.pole?.kolumna || '', (v) => { obj.pole = v ? { ...obj.pole, kolumna: v } : undefined; this.zbuduj(); });
      wybor.classList.add('szeroki');
      s.append(wybor);
      if (obj.pole?.kolumna) {
        const czesc = this.wybor(tt('wlasciwosci.zostajeCzescZdjecia'), [['', tt('wlasciwosci.srodek')], ['gora', tt('wlasciwosci.gora')], ['dol', tt('wlasciwosci.dol')], ['lewa', tt('wlasciwosci.lewaStrona')], ['prawa', tt('wlasciwosci.prawaStrona')]], () => obj.pole?.kadr || '', (v) => { obj.pole = { ...obj.pole, kadr: v || undefined }; });
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
    s.append(this.kolor(obj.type === 'image' ? tt('wlasciwosci.kolorObramowania') : tt('wlasciwosci.obrys'), () => obj.stroke, (v) => {
      obj.set('stroke', v ? zKryciem(v, kolor()?.getAlpha() ?? 1) : null);
      if (v && !obj.strokeWidth) obj.set({ strokeWidth: 0.5, strokeUniform: true });
    }, { brak: true }));
    s.append(this.liczba(obj.type === 'image' ? tt('wlasciwosci.grubosc') : tt('wlasciwosci.gruboscObrysu'), () => zaokr(obj.strokeWidth || 0, 2), (v) => {
      const g = Math.max(0, v);
      obj.set({ strokeWidth: g, strokeUniform: true, ...(rodzajKresek(obj) === 'ciagla' ? {} : kreski(rodzajKresek(obj), g)) });
    }, { jednostka: 'mm', krok: 0.1, min: 0 }));
    if (!kolor()) return;
    s.append(this.liczba(tt('wlasciwosci.krycieObrysu'), () => Math.round((kolor()?.getAlpha() ?? 1) * 100), (v) => { const k = kolor(); if (k) obj.set('stroke', zKryciem(`#${k.toHex()}`, Math.min(100, Math.max(0, v)) / 100)); }, { jednostka: '%', krok: 10, min: 0 }));
    const rodzaj = this.wybor(tt('wlasciwosci.rodzajLinii'), RODZAJE_KRESEK, () => rodzajKresek(obj), (v) => obj.set(kreski(v, obj.strokeWidth || 0.5)));
    rodzaj.dataset.pole = 'rodzaj-obrysu';
    s.append(rodzaj);
  }

  // Miękkie krawędzie (#156): brzeg przechodzi płynnie w przezroczystość – równo wzdłuż brzegu albo owalna winieta.
  zbudujMiekkieKrawedzie(obj) {
    if (toZaznaczenie(obj) || obj.type === 'group' || toTabela(obj) || toKod(obj)) return;
    if (!(obj.type === 'image' || KSZTALTY.has(obj.type) || obj.type === 'path')) return;
    const s = this.sekcja(tt('wlasciwosci.miekkieKrawedzie'), { zwinieta: !maMiekkie(obj) });
    s.append(this.liczba(tt('wlasciwosci.szerokoscPrzejscia'), () => zaokr(obj.miekkie_krawedzie || 0, 1), (v) => {
      const bylo = maMiekkie(obj);
      obj.set('miekkie_krawedzie', v > 0 ? Math.round(v * 10) / 10 : undefined);
      if (!maMiekkie(obj)) obj.set('miekkie_rodzaj', undefined);
      obj.dirty = true;
      if (bylo !== maMiekkie(obj)) setTimeout(() => this.zbuduj());
    }, { jednostka: 'mm', krok: 1, min: 0 }));
    if (maMiekkie(obj)) {
      s.append(this.wybor(tt('wlasciwosci.rodzaj'), RODZAJE_MIEKKICH, () => obj.miekkie_rodzaj || 'rowno', (v) => { obj.set('miekkie_rodzaj', v === 'owal' ? 'owal' : undefined); obj.dirty = true; }));
    }
    s.append(this.wskazowka(tt('wlasciwosci.0MmOstryBrzeg')));
  }

  // Cień: przesunięcie i rozmycie w mm, kolor z przezroczystością.
  zbudujCien(obj) {
    if (toZaznaczenie(obj) || obj.type === 'group') return;
    const c = this.sekcja(tt('wlasciwosci.cien'));
    const kolorCienia = () => new fabric.Color(obj.shadow?.color || 'rgba(0,0,0,0.35)');
    const ustaw = (zmiana) => {
      const k = kolorCienia();
      const obecny = { hex: `#${k.toHex()}`, moc: k.getAlpha(), x: obj.shadow?.offsetX ?? 1.5, y: obj.shadow?.offsetY ?? 1.5, blur: obj.shadow?.blur ?? 3, ...zmiana };
      const [r, g, b] = new fabric.Color(obecny.hex).getSource();
      obj.set('shadow', new fabric.Shadow({ color: `rgba(${r},${g},${b},${obecny.moc})`, offsetX: obecny.x, offsetY: obecny.y, blur: obecny.blur }));
    };
    c.append(this.przelacznik(tt('wlasciwosci.cienPodElementem'), () => Boolean(obj.shadow), (v) => { if (v) ustaw({}); else obj.set('shadow', null); this.zbuduj(); }));
    if (!obj.shadow) return;
    c.append(this.kolor(tt('wlasciwosci.kolorCienia'), () => `#${kolorCienia().toHex()}`, (v) => ustaw({ hex: v })));
    c.append(this.liczba(tt('wlasciwosci.sila'), () => Math.round(kolorCienia().getAlpha() * 100), (v) => ustaw({ moc: Math.min(100, Math.max(5, v)) / 100 }), { jednostka: '%', krok: 5, min: 5 }));
    c.append(this.liczba(tt('wlasciwosci.wPrawo'), () => zaokr(obj.shadow.offsetX, 1), (v) => ustaw({ x: v }), { jednostka: 'mm', krok: 0.5 }));
    c.append(this.liczba(tt('wlasciwosci.wDol'), () => zaokr(obj.shadow.offsetY, 1), (v) => ustaw({ y: v }), { jednostka: 'mm', krok: 0.5 }));
    c.append(this.liczba(tt('wlasciwosci.rozmycie'), () => zaokr(obj.shadow.blur, 1), (v) => ustaw({ blur: Math.max(0, v) }), { jednostka: 'mm', krok: 0.5, min: 0 }));
  }

  // Wykończenie druku (#127, #167): lakier, złocenie, tłoczenie, biel i farba specjalna – jedna część, wybór
  // kafelkami z opisem. Nic nie trzeba wcześniej dodawać: płyta wykończenia powstaje sama w PDF, a nowy kolor
  // dodatkowy – w projekcie. „Jak”: kolor elementu zostaje, a efekt idzie na kopię nad nim (np. lakier na zdjęciu),
  // albo element jest samym efektem, bez farby (np. złocony napis).
  zbudujUszlachetnienie(obj) {
    if (toZaznaczenie(obj) || obj.type === 'group' || toTabela(obj) || obj.group) return;
    const u = plytaUszlachetnienia(obj);
    const s = this.sekcja(tt('wlasciwosci.wykonczenieDrukuLakierZlocenie'), { zwinieta: !u });
    const obraz = obj.type === 'image' || (obj.zasob && !obj.fill);
    if (!u) {
      const jak = this.jakWykonczenie || (obraz ? 'kopia' : 'sam');
      const rzad = document.createElement('div');
      rzad.className = 'segmenty tekstowe jak-wykonczenie';
      rzad.setAttribute('role', 'group');
      rzad.setAttribute('aria-label', tt('wlasciwosci.jakDodacWykonczenie'));
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
      etykieta.textContent = tt('wlasciwosci.jak');
      opak.append(etykieta, rzad);
      s.append(opak);
    }
    const wybor = document.createElement('div');
    wybor.className = 'wybor-wykonczenia';
    wybor.setAttribute('role', 'group');
    wybor.setAttribute('aria-label', tt('wlasciwosci.wykonczenieDruku'));
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
      s.append(this.wybor(tt('wlasciwosci.kolorFolii'), Object.entries(FOLIE).map(([k, f]) => [k, f.nazwa]), () => obj.folia || 'zloto', (v) => { obj.set('folia', v); obj.dirty = true; this.zbuduj(); }));
    }
    s.append(this.wskazowka(u
      ? tt('wlasciwosci.tenElementNieDrukuje', { x: OPISY_WYKONCZEN[u.id], plyta: u.plyta })
      : tt('wlasciwosci.wybierzEfektNicNie')));
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
    const farba = s.appendChild(this.wybor(tt('wlasciwosci.farbaSpecjalnaNpPantone'), [['', tt('wlasciwosci.brakZwykleCmyk')], ...spoty.map((x) => [x.id, x.nazwa]), ['+', tt('wlasciwosci.nowaZObecnegoKoloru')]], () => teraz?.id || '', async (v) => {
      if (v === '+') {
        const nazwa = await zapytajONazwe(tt('wlasciwosci.nowyKolorDodatkowy'), tt('wlasciwosci.nazwaFarbyTakJak'), tt('wlasciwosci.pantone'));
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
    s.append(this.wskazowka(teraz ? tt('wlasciwosci.wypelnienieDrukujeSieFarba', { nazwa: teraz.nazwa }) : tt('wlasciwosci.wypelnienieMozeIscOsobna')));
  }

  zbudujLinie(obj) {
    const s = this.sekcja(tt('wlasciwosci.linia'));
    s.append(this.kolor(tt('wlasciwosci.kolor'), () => obj.stroke, (v) => obj.set('stroke', v)));
    // Kreski rosną razem z grubością (#143).
    const kreski = (rodzaj, grubosc) => ({ strokeDashArray: wzorKresek(rodzaj, grubosc), strokeLineCap: ['kropkowana', 'kreska-kropka'].includes(rodzaj) ? 'round' : (obj.type === 'path' ? 'round' : 'butt') });
    s.append(this.liczba(tt('wlasciwosci.grubosc'), () => zaokr(obj.strokeWidth, 2), (v) => {
      const g = Math.max(0.05, v);
      obj.set({ strokeWidth: g, strokeUniform: true, ...(rodzajKresek(obj) === 'ciagla' ? {} : kreski(rodzajKresek(obj), g)) });
    }, { jednostka: 'mm', krok: 0.1, min: 0.05 }));
    const rodzaj = this.wybor(tt('wlasciwosci.rodzaj'), RODZAJE_KRESEK, () => rodzajKresek(obj), (v) => obj.set(kreski(v, obj.strokeWidth)));
    rodzaj.dataset.pole = 'rodzaj-linii';
    s.append(rodzaj);
    if (obj.type !== 'path') return;
    // Zamknięty kształt (z pióra) może mieć wypełnienie.
    if (obj.path?.some((k) => k[0] === 'Z')) {
      s.append(this.kolor(tt('wlasciwosci.wypelnienie'), () => (typeof obj.fill === 'string' ? obj.fill : ''), (v) => obj.set('fill', v || ''), { brak: true }));
      // Wzór w zamkniętym kształcie (#182) – także w kształtach z Biblioteki.
      s.append(this.przelacznik(tt('wlasciwosci.wypelnijWzorem'), () => Boolean(obj.wzor), (v) => { this.edytor.ustawWzor(obj, v ? (obj.wzor?.id || 'paski-skosne') : null); this.zbuduj(); }));
      if (obj.wzor) this.czescWzoru(s, obj, { bezTla: true });
    }
    const punkty = this.akcje([['suwaki', 'Edytuj punkty', () => { if (!this.edytor.edytujPunkty(obj)) powiadom(tt('wlasciwosci.punktyEdytujeSieW')); }]]);
    s.append(punkty);
    s.append(this.wskazowka(tt('wlasciwosci.alboKliknijKsztaltDwa')));
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
    const kadr = this.sekcja(tt('wlasciwosci.kadrowanie'));
    // Zdjęcie w kształcie (#123): zaokrąglone rogi albo koło – obraz staje się kształtem z obrazem.
    if (!obj.group) {
      const ksztalty = this.akcje([
        ['prostokat', 'Zaokrąglone rogi', () => this.edytor.obrazWKsztalt(obj, 'prostokat')],
        ['elipsa', 'Koło', () => this.edytor.obrazWKsztalt(obj, 'kolo')],
      ]);
      kadr.append(ksztalty);
    }
    if (this.opcje.usunTlo) kadr.append(this.akcje([['gumka', 'Usuń tło…', () => this.opcje.usunTlo(obj)]]));
    const kadrRamka = this.akcje([['dopasuj', 'Kadruj przeciąganiem', () => { if (!this.edytor.kadruj(obj)) powiadom(tt('wlasciwosci.zablokowanyObrazPrzytnijLiczbami')); }]]);
    kadrRamka.classList.add('tylko-duzy-ekran');
    kadr.append(kadrRamka);
    const albo = this.wskazowka(tt('wlasciwosci.alboKliknijObrazDwa'));
    albo.classList.add('tylko-duzy-ekran');
    kadr.append(albo);
    // Na telefonie kadrowania ramką nie ma – zostaje przycięcie liczbami.
    const telefon = this.wskazowka(tt('wlasciwosci.naTelefoniePrzytnieszObraz'));
    telefon.classList.add('tylko-maly-ekran');
    kadr.append(telefon);
    if (this.opcje.toRysunekSvg?.(obj)) {
      const r = this.sekcja(tt('wlasciwosci.rysunekSvg'));
      r.append(this.akcje([['rozgrupuj', 'Rozłóż rysunek na elementy', () => this.opcje.rozlozRysunek(obj)]]));
      r.append(this.wskazowka(tt('wlasciwosci.obrazZamieniSieW')));
    }
    const s = this.sekcja(tt('wlasciwosci.przyciecieOryginalu'));
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
    s.append(pole(tt('wlasciwosci.zLewej'), 'l'), pole(tt('wlasciwosci.zPrawej'), 'r'), pole(tt('wlasciwosci.zGory'), 't'), pole(tt('wlasciwosci.zDolu'), 'b'));

    // Obraz z danych: kolumna tabeli podaje nazwę pliku wgranego do projektu.
    const kolumny = this.opcje.kolumnyObrazu?.() || [];
    const d = this.sekcja(tt('wlasciwosci.obrazZDanych'));
    if (kolumny.length) {
      const wybor = this.wybor(tt('wlasciwosci.kolumnaZNazwaPliku'), [['', tt('wlasciwosci.stalyObraz2')], ...kolumny.map((k) => [k, k])], () => obj.pole?.kolumna || '', (v) => { obj.pole = v ? { ...obj.pole, kolumna: v } : undefined; this.zbuduj(); });
      wybor.classList.add('szeroki');
      d.append(wybor);
      if (obj.pole?.kolumna) {
        const tryb = this.wybor(tt('wlasciwosci.podmienionyObraz'), [['zmiesc', tt('wlasciwosci.miesciSieWRamce')], ['wypelnij', tt('wlasciwosci.wypelniaRamkeBrzegiPrzyciete')]], () => obj.pole?.tryb || 'zmiesc', (v) => { obj.pole = { ...obj.pole, tryb: v === 'wypelnij' ? 'wypelnij' : undefined }; this.zbuduj(); });
        tryb.classList.add('szeroki');
        d.append(tryb);
        if (obj.pole?.tryb === 'wypelnij') {
          // Która część zdjęcia zostaje po przycięciu – np. „góra”, żeby nie ucinać głów na portretach.
          const kadr = this.wybor(tt('wlasciwosci.zostajeCzescZdjecia'), [['', tt('wlasciwosci.srodek')], ['gora', tt('wlasciwosci.gora')], ['dol', tt('wlasciwosci.dol')], ['lewa', tt('wlasciwosci.lewaStrona')], ['prawa', tt('wlasciwosci.prawaStrona')]], () => obj.pole?.kadr || '', (v) => { obj.pole = { ...obj.pole, kadr: v || undefined }; });
          kadr.classList.add('szeroki');
          d.append(kadr);
          // Kadr osobno dla każdego wiersza: kolumna z nazwą części zdjęcia albo z punktem w procentach.
          const zKolumny = this.wybor(tt('wlasciwosci.kadrZKolumny'), [['', tt('wlasciwosci.tenSamNaKazdej')], ...kolumny.filter((k) => k !== obj.pole.kolumna).map((k) => [k, k])], () => obj.pole?.kadr_z || '', (v) => { obj.pole = { ...obj.pole, kadr_z: v || undefined }; this.zbuduj(); });
          zKolumny.classList.add('szeroki');
          d.append(zKolumny);
          if (obj.pole?.kadr_z) d.append(this.wskazowka(tt('wlasciwosci.wTejKolumnieWpisz')));
        }
      }
    }
    d.append(this.wskazowka(kolumny.length
      ? tt('wlasciwosci.naKazdejPowielonejStronie')
      : tt('wlasciwosci.gdyStronaNalezyDo')));

    this.zbudujFiltry(obj);
    // Obramowanie (#156): kolor z kryciem, grubość, rodzaj linii i zaokrąglone narożniki (przycinają też obraz).
    const o = this.sekcja(tt('wlasciwosci.obramowanie'));
    this.polaObrysu(o, obj);
    o.append(this.liczba(tt('wlasciwosci.zaokraglenieNaroznikow'), () => zaokr(obj.zaokraglenie || 0, 1), (v) => { obj.set('zaokraglenie', v > 0 ? Math.round(v * 10) / 10 : undefined); obj.dirty = true; }, { jednostka: 'mm', krok: 0.5, min: 0 }));
    o.append(this.przelacznik(tt('wlasciwosci.odbijLustrzanieWPoziomie'), () => Boolean(obj.flipX), (v) => obj.set('flipX', v)));
    const info = this.wskazowka('');
    this.odswiezacze.push(() => {
      const dpi = Math.round(25.4 / obj.scaleX); // px oryginału na cal wydruku
      info.textContent = tt('wlasciwosci.oryginalPxDpiW', { nw, nh, dpi, x: dpi < 300 ? tt('wlasciwosci.doDrukuZalecaneJest2') : '' });
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
        o.textContent = this._czcionkiWLiscie ? tt('wlasciwosci.spozaListy', { v }) : v;
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
    kolko.title = tt('wlasciwosci.kolorTekstu');
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
      // Etykieta krótka, objaśnienie w podpowiedzi (#171): „Nazwa – objaśnienie” → na przycisku tylko nazwa.
      const [krotko, ...reszta] = String(tekst).split(' – ');
      const etykieta = document.createElement('span');
      etykieta.textContent = krotko;
      b.append(etykieta);
      b.title = tekst;
      if (reszta.length) b.setAttribute('aria-label', tekst);
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
