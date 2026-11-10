/* global fabric */
// Panel właściwości: pola liczbowe w mm (4.7 – precyzja na tablecie).

import { CZCIONKI } from './czcionki.js';
import { rozmiarOryginalu } from './obrazy.js';
import { mmNaPt, ptNaMm } from './projekt.js';
import { nazwaTypu } from './edytor.js';
import { ikona } from './ikony.js';
import { stylZObiektu, zastosujStyl, POLA_STYLU } from './style-tekstu.js';
import { zapytajONazwe, potwierdz, powiadom } from './ui.js';

const TEKSTOWE = new Set(['textbox', 'i-text', 'text']);
const KSZTALTY = new Set(['rect', 'ellipse', 'polygon']);

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
  }

  pokaz(obj) {
    if (obj === this.obj && obj) {
      this.odswiez();
      return;
    }
    this.obj = obj;
    this.zbuduj();
  }

  odswiez() {
    for (const f of this.odswiezacze) f();
  }

  // ---------- Budowanie ----------

  zbuduj() {
    this.el.replaceChildren();
    this.odswiezacze = [];
    const obj = this.obj;
    if (!obj) {
      this.tytul.textContent = this.opcje.tytulPusty();
      this.opcje.budujPusty(this);
      return;
    }
    if (obj.kadr) {
      this.tytul.textContent = 'Kadrowanie';
      const s = this.sekcja('Kadr');
      s.append(this.wskazowka('Przesuń i rozciągnij ramkę – zostanie tylko jasna część obrazu. Enter zatwierdza, Esc anuluje.'));
      s.append(this.akcje([['ok', 'Zastosuj', () => this.edytor.zakonczKadrowanie(true)], ['zamknij', 'Anuluj', () => this.edytor.zakonczKadrowanie(false)]]));
      return;
    }
    if (obj.type === 'activeSelection') {
      this.tytul.textContent = `Zaznaczone elementy: ${obj.size()}`;
      const s = this.sekcja('Zaznaczenie');
      s.append(this.wskazowka('Przesuwasz je razem. Zgrupuj, żeby zawsze trzymały się razem.'));
      s.append(this.akcje([['grupuj', 'Zgrupuj', () => this.edytor.grupuj()]]));
      if (obj.getObjects().every((o) => o.type === 'textbox')) {
        const p = this.sekcja('Przelewanie tekstu');
        p.append(this.wskazowka('Po połączeniu tekst, który nie mieści się w pierwszej ramce, płynie do następnej (z góry na dół, obok siebie – od lewej).'));
        p.append(this.akcje([['link', 'Połącz ramki tekstu', () => this.edytor.polaczRamki()]]));
      }
      this.zbudujWyrownanie(obj.size());
      this.zbudujGeometrie(obj, { tylkoPozycja: true });
      return;
    }
    this.tytul.textContent = nazwaTypu(obj);

    if (TEKSTOWE.has(obj.type)) this.zbudujTekst(obj);
    this.zbudujGeometrie(obj);
    if (KSZTALTY.has(obj.type)) this.zbudujWypelnienie(obj);
    if (obj.type === 'line') this.zbudujLinie(obj);
    if (obj.type === 'image') this.zbudujObraz(obj);

    this.zbudujWyrownanie(1);
    this.zbudujKolejnosc(obj);
    this.zbudujCien(obj);
    this.zbudujZDanych(obj);
    const inne = this.sekcja('Inne');
    inne.append(this.przelacznik('Zablokuj położenie i rozmiar', () => Boolean(obj.zablokowany), (v) => this.edytor.ustawBlokade(obj, v)));
    inne.append(this.tekst('Nazwa elementu (opcjonalnie)', () => obj.nazwa || '', (v) => { obj.nazwa = v || undefined; }, true));
    inne.append(this.liczba('Krycie', () => zaokr((obj.opacity ?? 1) * 100, 0), (v) => { obj.opacity = Math.min(100, Math.max(0, v)) / 100; }, { jednostka: '%', krok: 5 }));
    this.opcje.dodatkiElementu?.(this, obj, inne);
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
    return l;
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
    if (obj.type === 'group') s.append(this.akcje([['rozgrupuj', 'Rozgrupuj', () => e.rozgrupuj()]]));
  }

  zbudujGeometrie(obj, { tylkoPozycja = false } = {}) {
    const s = this.sekcja('Położenie i rozmiar (mm)');
    s.append(this.liczba('X', () => zaokr(obj.left), (v) => { obj.left = v; }, { jednostka: 'mm' }));
    s.append(this.liczba('Y', () => zaokr(obj.top), (v) => { obj.top = v; }, { jednostka: 'mm' }));
    if (tylkoPozycja) return;
    if (obj.type === 'line') {
      s.append(this.liczba('Długość', () => zaokr(Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1) * obj.scaleX), (v) => {
        const dl = Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1) || 1;
        obj.scaleX = Math.max(0.1, v) / dl;
        obj.scaleY = obj.scaleX;
      }, { jednostka: 'mm', min: 0.1 }));
    } else {
      s.append(this.liczba('Szerokość', () => zaokr(obj.width * obj.scaleX), (v) => {
        if (obj.type === 'textbox') obj.set('width', Math.max(1, v));
        else obj.scaleX = Math.max(0.1, v) / obj.width;
      }, { jednostka: 'mm', min: 0.1 }));
      s.append(this.liczba('Wysokość', () => zaokr(obj.height * obj.scaleY), (v) => {
        obj.scaleY = Math.max(0.1, v) / obj.height;
      }, { jednostka: 'mm', min: 0.1, wylaczone: obj.type === 'textbox' }));
    }
    s.append(this.liczba('Obrót', () => zaokr(obj.angle || 0, 1), (v) => { obj.rotate(((v % 360) + 360) % 360); }, { jednostka: '°', krok: 1 }));
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
    } else {
      for (const k of Object.keys(wlasciwosci)) obj.removeStyle?.(k);
      obj.set(wlasciwosci);
    }
    obj.initDimensions?.();
    obj.dirty = true;
  }

  zbudujTekst(obj) {
    const czytaj = (k) => this._czytajTekst(obj, k);
    const ustaw = (w) => this._ustawTekst(obj, w);

    this.zbudujStyl(obj);

    const s = this.sekcja('Tekst');
    // Edycja treści w zwykłym polu – wygodniejsze na telefonie niż na płótnie (4.7).
    s.append(this.obszarTekstu('Treść', () => obj.text, (v) => obj.set('text', v)));
    s.append(this.wstawianiePola());

    const fragment = this.wskazowka('Zmieniasz tylko zaznaczony fragment tekstu.');
    fragment.classList.add('znacznik-fragmentu');
    this.odswiezacze.push(() => { fragment.hidden = !this._fragment(obj); });
    fragment.hidden = !this._fragment(obj);
    s.append(fragment);

    this._czcionkiWLiscie = true;
    const czcionka = this.wybor('Czcionka', CZCIONKI.map((c) => [c.nazwa, c.nazwa]), () => czytaj('fontFamily'), (v) => ustaw({ fontFamily: v }));
    this._czcionkiWLiscie = false;
    czcionka.classList.add('szeroki');
    s.append(czcionka);
    // Przy autodopasowaniu pole pokazuje rozmiar zadany; tekst może być mniejszy, gdy się nie mieści.
    const zadany = () => (obj.autodopasowanie && obj.rozmiar_bazowy && !this._fragment(obj) ? obj.rozmiar_bazowy : czytaj('fontSize'));
    s.append(this.liczba('Rozmiar', () => zaokr(mmNaPt(zadany() * obj.scaleY), 1), (v) => {
      const rozmiar = ptNaMm(Math.max(1, v)) / obj.scaleY;
      if (!this._fragment(obj) && obj.rozmiar_bazowy) obj.rozmiar_bazowy = rozmiar;
      ustaw({ fontSize: rozmiar });
    }, { jednostka: 'pt', krok: 0.5, min: 1 }));
    s.append(this.kolor('Kolor', () => czytaj('fill'), (v) => ustaw({ fill: v })));
    s.append(this.liczba('Interlinia', () => zaokr(obj.lineHeight, 2), (v) => obj.set('lineHeight', Math.max(0.5, v)), { krok: 0.05, min: 0.5 }));
    // Odstęp między literami w tysięcznych wysokości pisma (jak w programach DTP).
    s.append(this.liczba('Odstęp liter', () => Math.round(obj.charSpacing || 0), (v) => obj.set('charSpacing', Math.max(-200, Math.min(2000, v))), { jednostka: '‰', krok: 10 }));

    const przelacz = (k, wl, wyl) => () => ustaw({ [k]: czytaj(k) === wl ? wyl : wl });
    const styl = this.segmenty('Wygląd liter', [
      ['pogrubienie', 'Pogrubienie', () => czytaj('fontWeight') === 'bold' || czytaj('fontWeight') >= 600, przelacz('fontWeight', 'bold', 'normal')],
      ['kursywa', 'Kursywa', () => czytaj('fontStyle') === 'italic', przelacz('fontStyle', 'italic', 'normal')],
      ['podkreslenie', 'Podkreślenie', () => Boolean(czytaj('underline')), przelacz('underline', true, false)],
      ['przekreslenie', 'Przekreślenie', () => Boolean(czytaj('linethrough')), przelacz('linethrough', true, false)],
    ]);
    styl.classList.add('szeroki');
    s.append(styl);

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

    // Pola w klamrach zostają nietknięte – {dzien} po zamianie na {DZIEN} przestałoby działać.
    const pozaPolami = (t, fn) => t.split(/(\{[^{}\n]*\})/).map((cz, i) => (i % 2 ? cz : fn(cz))).join('');
    const zmienLitery = (fn) => () => { obj.set('text', pozaPolami(obj.text, fn)); obj.initDimensions?.(); };
    const litery = this.segmenty('Wielkość liter', [
      ['AA', 'WSZYSTKIE WIELKIE', null, zmienLitery((t) => t.toLocaleUpperCase('pl'))],
      ['Aa', 'Jak w zdaniu', null, zmienLitery((t) => t.toLocaleLowerCase('pl').replace(/(^|[.!?]\s+|\n)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('pl')))],
      ['aa', 'wszystkie małe', null, zmienLitery((t) => t.toLocaleLowerCase('pl'))],
    ], true);
    litery.classList.add('szeroki');
    s.append(litery);

    // Przelewanie: połączone ramki i kolumny.
    const w = this.sekcja('Przelewanie tekstu');
    const watek = this.edytor.watekRamki(obj);
    if (watek) {
      w.append(this.wskazowka(`Ramka ${watek.nr} z ${watek.ile} połączonych. Tekst, który się tu nie mieści, płynie do następnej; wygląd tekstu jest wspólny dla wszystkich.`));
      w.append(this.akcje([
        ['plus', 'Dodaj ramkę z ciągiem dalszym', () => this.edytor.dodajRamkeDalsza()],
        ['rozgrupuj', 'Rozłącz ramki', () => this.edytor.rozlaczRamki()],
      ]));
    } else {
      w.append(this.akcje([['plus', 'Dodaj ramkę z ciągiem dalszym', () => this.edytor.dodajRamkeDalsza()]]));
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

  // Kolor i przesunięcie elementu zależne od pola z danych (tabela albo pole dokumentu).
  zbudujZDanych(obj) {
    const grupy = this.opcje.pola?.() || [];
    const pola = grupy.flatMap((g) => g.pola.map(([nazwa]) => nazwa));
    const s = this.sekcja('Z danych');
    const z = () => obj.z_danych || {};
    const zapisz = (zmiana) => {
      const nowe = { ...z(), ...zmiana };
      for (const k of Object.keys(nowe)) if (!nowe[k] || (typeof nowe[k] === 'object' && !nowe[k].pole)) delete nowe[k];
      obj.z_danych = Object.keys(nowe).length ? nowe : undefined;
    };
    // Na liście: pola dostępne na tej stronie i to, które jest już ustawione (nawet nieznane).
    const lista = (wybrane) => [['', '— nie zależy od danych —'], ...[...new Set([...pola, ...(wybrane ? [wybrane] : [])])].map((n) => [n, `{${n}}`])];
    if (obj.type !== 'image') {
      const kolor = this.wybor('Kolor z pola', lista(z().kolor), () => z().kolor || '', (v) => zapisz({ kolor: v || undefined }));
      kolor.classList.add('szeroki');
      s.append(kolor);
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
    const jest = z().kolor || z().x || z().y;
    s.append(this.wskazowka(jest
      ? 'W edytorze element stoi w miejscu pozycji 1 i ma kolor wzoru. Właściwe położenie i kolor każdej powielonej strony zobaczysz w podglądzie. „Od nowa co 6” znaczy, że pozycja 7 wraca na miejsce pierwszej (0 – bez powrotu).'
      : 'Kolor albo położenie mogą się zmieniać na powielonych stronach – według kolumny tabeli albo np. numeru powielenia {egzemplarz}. Przykład: zakładka z nazwą miesiąca na brzegu strony, na każdej stronie niżej.'));
  }

  // Styl tekstu: wybór, zapis jako nowy, aktualizacja, usunięcie.
  zbudujStyl(obj) {
    const style = this.opcje.style?.();
    if (!style) return;
    const s = this.sekcja('Styl tekstu');
    const znajdz = () => style.find((x) => x.id === obj.styl);
    const rozniSie = () => {
      const st = znajdz();
      if (!st) return false;
      const teraz = stylZObiektu(obj, st.nazwa, st.id);
      return POLA_STYLU.some((k) => (typeof st[k] === 'number' ? Math.abs(st[k] - teraz[k]) > 0.001 : (st[k] ?? false) !== (teraz[k] ?? false)));
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

  zbudujWypelnienie(obj) {
    if (obj.type === 'polygon') {
      const k = this.sekcja('Kształt');
      k.append(this.liczba('Liczba boków', () => obj.boki || obj.points.length, (v) => this.edytor.przeksztalcWielokat(obj, v, obj.gwiazda), { krok: 1, min: 3 }));
      k.append(this.przelacznik('Gwiazda', () => Boolean(obj.gwiazda), (v) => this.edytor.przeksztalcWielokat(obj, obj.boki || 5, v)));
    }
    const s = this.sekcja('Wypełnienie i obrys');
    // Wypełnienie: jeden kolor albo przejście między dwoma (gradient liniowy).
    const gradient = () => (obj.fill && typeof obj.fill === 'object' && obj.fill.colorStops ? obj.fill : null);
    const KIERUNKI = { poziomo: [0, 0, 1, 0], pionowo: [0, 0, 0, 1], ukos: [0, 0, 1, 1] };
    const kierunek = () => { const c = gradient()?.coords; return c ? (Object.keys(KIERUNKI).find((n) => KIERUNKI[n].join() === [c.x1, c.y1, c.x2, c.y2].join()) || 'poziomo') : 'poziomo'; };
    const ustawGradient = (od, do_, jak = kierunek()) => {
      const [x1, y1, x2, y2] = KIERUNKI[jak];
      obj.set('fill', new fabric.Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1, y1, x2, y2 }, colorStops: [{ offset: 0, color: od }, { offset: 1, color: do_ }] }));
    };
    const kolorOd = () => (gradient() ? gradient().colorStops[0].color : obj.fill);
    const kolorDo = () => gradient()?.colorStops.at(-1).color || '#ffffff';
    s.append(this.kolor(gradient() ? 'Wypełnienie – od' : 'Wypełnienie', kolorOd, (v) => (gradient() && v ? ustawGradient(v, kolorDo()) : obj.set('fill', v)), { brak: true }));
    if (gradient()) s.append(this.kolor('Wypełnienie – do', kolorDo, (v) => ustawGradient(kolorOd(), v)));
    const przejscie = this.przelacznik('Przejście kolorów (gradient)', () => Boolean(gradient()), (v) => {
      if (v) ustawGradient(naHex(obj.fill) || '#2f5bd3', '#ffffff'); else obj.set('fill', kolorOd());
      this.zbuduj();
    });
    s.append(przejscie);
    if (gradient()) {
      const kier = this.segmenty('Kierunek przejścia', [
        ['wyrownajSrodekY', 'Poziomo', () => kierunek() === 'poziomo', () => ustawGradient(kolorOd(), kolorDo(), 'poziomo')],
        ['wyrownajSrodekX', 'Pionowo', () => kierunek() === 'pionowo', () => ustawGradient(kolorOd(), kolorDo(), 'pionowo')],
        ['linia', 'Po skosie', () => kierunek() === 'ukos', () => ustawGradient(kolorOd(), kolorDo(), 'ukos')],
      ]);
      s.append(kier);
    }
    s.append(this.kolor('Obrys', () => obj.stroke, (v) => obj.set('stroke', v), { brak: true }));
    s.append(this.liczba('Grubość obrysu', () => zaokr(obj.strokeWidth, 2), (v) => obj.set({ strokeWidth: Math.max(0, v), strokeUniform: true }), { jednostka: 'mm', krok: 0.1, min: 0 }));
    if (obj.type === 'rect') {
      s.append(this.liczba('Zaokrąglenie', () => zaokr(obj.rx || 0, 1), (v) => obj.set({ rx: Math.max(0, v), ry: Math.max(0, v) }), { jednostka: 'mm', krok: 0.5, min: 0 }));
    }
  }

  // Cień: przesunięcie i rozmycie w mm, kolor z przezroczystością.
  zbudujCien(obj) {
    if (obj.type === 'activeSelection' || obj.type === 'group') return;
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

  zbudujLinie(obj) {
    const s = this.sekcja('Linia');
    s.append(this.kolor('Kolor', () => obj.stroke, (v) => obj.set('stroke', v)));
    s.append(this.liczba('Grubość', () => zaokr(obj.strokeWidth, 2), (v) => obj.set({ strokeWidth: Math.max(0.05, v), strokeUniform: true }), { jednostka: 'mm', krok: 0.1, min: 0.05 }));
  }

  zbudujObraz(obj) {
    const { nw, nh } = rozmiarOryginalu(obj);
    const kadr = this.sekcja('Kadrowanie');
    kadr.append(this.akcje([['dopasuj', 'Kadruj przeciąganiem', () => { if (!this.edytor.kadruj(obj)) powiadom('Obrócony, odbity albo zablokowany obraz przytnij liczbami poniżej.'); }]]));
    kadr.append(this.wskazowka('Albo kliknij obraz dwa razy.'));
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
      const wybor = this.wybor('Kolumna z nazwą pliku', [['', 'Stały obraz'], ...kolumny.map((k) => [k, k])], () => obj.pole?.kolumna || '', (v) => { obj.pole = v ? { kolumna: v } : undefined; });
      wybor.classList.add('szeroki');
      d.append(wybor);
    }
    d.append(this.wskazowka(kolumny.length
      ? 'Na każdej powielonej stronie pojawi się obraz o nazwie wpisanej w tej kolumnie (np. zdjecie-01.jpg), wpisany w ramkę tego obrazu. Pliki wgraj przyciskiem poniżej.'
      : 'Gdy strona należy do serii z tabelą, ten obraz może się zmieniać na każdej powielonej stronie – według nazwy pliku z wybranej kolumny.'));
    if (this.opcje.wgrajObrazy) d.append(this.akcje([['wyslij', 'Wgraj obrazy do projektu', () => this.opcje.wgrajObrazy()]]));

    const o = this.sekcja('Obrys i odbicie');
    o.append(this.kolor('Obrys', () => obj.stroke, (v) => obj.set('stroke', v), { brak: true }));
    o.append(this.liczba('Grubość obrysu', () => zaokr(obj.strokeWidth || 0, 2), (v) => obj.set({ strokeWidth: Math.max(0, v), strokeUniform: true }), { jednostka: 'mm', krok: 0.1, min: 0 }));
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
  sekcja(tytul) {
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
      ustaw(zwiniete().has(klucz));
      b.addEventListener('click', () => {
        const z = zwiniete();
        if (z.has(klucz)) z.delete(klucz); else z.add(klucz);
        try { localStorage.setItem(KLUCZ_ZWINIETE, JSON.stringify([...z])); } catch { /* tryb prywatny */ }
        ustaw(z.has(klucz));
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

  liczba(etykieta, get, set, { jednostka = '', krok = 0.5, min, wylaczone = false } = {}) {
    const label = document.createElement('label');
    label.append(etykieta);
    const opak = document.createElement('div');
    opak.className = 'jednostka';
    const input = document.createElement('input');
    input.type = 'number';
    input.step = String(krok);
    input.inputMode = 'decimal';
    if (min !== undefined) input.min = String(min);
    input.disabled = wylaczone;
    const zapisz = this._zapisz(set);
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
    for (const [wartosc, opis] of opcje) {
      const o = document.createElement('option');
      o.value = wartosc;
      o.textContent = opis;
      if (this._czcionkiWLiscie) o.style.fontFamily = `"${wartosc}"`;
      sel.append(o);
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
    };
    this.odswiezacze.push(odswiez);
    odswiez();
    return label;
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
