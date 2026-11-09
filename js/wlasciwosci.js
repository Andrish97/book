/* global fabric */
// Panel właściwości: pola liczbowe w mm (4.7 – precyzja na tablecie).

import { CZCIONKI } from './czcionki.js';
import { mmNaPt, ptNaMm } from './projekt.js';
import { nazwaTypu } from './edytor.js';
import { ikona } from './ikony.js';
import { stylZObiektu, zastosujStyl, POLA_STYLU } from './style-tekstu.js';
import { zapytajONazwe, potwierdz } from './ui.js';

const TEKSTOWE = new Set(['textbox', 'i-text', 'text']);
const KSZTALTY = new Set(['rect', 'ellipse']);

const zaokr = (v, miejsc = 2) => {
  const k = 10 ** miejsc;
  return Math.round(v * k) / k;
};

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
    if (obj.type === 'activeSelection') {
      this.tytul.textContent = `Zaznaczono ${obj.size()} obiekty`;
      const s = this.sekcja('Zaznaczenie');
      s.append(this.wskazowka('Przesuwasz je razem. Zgrupuj, żeby zawsze trzymały się razem.'));
      s.append(this.akcje([['grupuj', 'Zgrupuj', () => this.edytor.grupuj()]]));
      this.zbudujGeometrie(obj, { tylkoPozycja: true });
      return;
    }
    this.tytul.textContent = nazwaTypu(obj);

    if (TEKSTOWE.has(obj.type)) this.zbudujTekst(obj);
    this.zbudujGeometrie(obj);
    if (KSZTALTY.has(obj.type)) this.zbudujWypelnienie(obj);
    if (obj.type === 'line') this.zbudujLinie(obj);
    if (obj.type === 'image') this.zbudujObraz(obj);

    this.zbudujKolejnosc(obj);
    const inne = this.sekcja('Inne');
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
    s.append(this.liczba('Rozmiar', () => zaokr(mmNaPt(czytaj('fontSize') * obj.scaleY), 1), (v) => {
      ustaw({ fontSize: ptNaMm(Math.max(1, v)) / obj.scaleY });
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

    const zmienLitery = (fn) => () => { obj.set('text', fn(obj.text)); obj.initDimensions?.(); };
    const litery = this.segmenty('Wielkość liter', [
      ['AA', 'WSZYSTKIE WIELKIE', null, zmienLitery((t) => t.toLocaleUpperCase('pl'))],
      ['Aa', 'Jak w zdaniu', null, zmienLitery((t) => t.toLocaleLowerCase('pl').replace(/(^|[.!?]\s+|\n)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('pl')))],
      ['aa', 'wszystkie małe', null, zmienLitery((t) => t.toLocaleLowerCase('pl'))],
    ], true);
    litery.classList.add('szeroki');
    s.append(litery);
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
    const s = this.sekcja('Wypełnienie i obrys');
    s.append(this.kolor('Wypełnienie', () => obj.fill, (v) => obj.set('fill', v), { brak: true }));
    s.append(this.kolor('Obrys', () => obj.stroke, (v) => obj.set('stroke', v), { brak: true }));
    s.append(this.liczba('Grubość obrysu', () => zaokr(obj.strokeWidth, 2), (v) => obj.set({ strokeWidth: Math.max(0, v), strokeUniform: true }), { jednostka: 'mm', krok: 0.1, min: 0 }));
    if (obj.type === 'rect') {
      s.append(this.liczba('Zaokrąglenie', () => zaokr(obj.rx || 0, 1), (v) => obj.set({ rx: Math.max(0, v), ry: Math.max(0, v) }), { jednostka: 'mm', krok: 0.5, min: 0 }));
    }
  }

  zbudujLinie(obj) {
    const s = this.sekcja('Linia');
    s.append(this.kolor('Kolor', () => obj.stroke, (v) => obj.set('stroke', v)));
    s.append(this.liczba('Grubość', () => zaokr(obj.strokeWidth, 2), (v) => obj.set({ strokeWidth: Math.max(0.05, v), strokeUniform: true }), { jednostka: 'mm', krok: 0.1, min: 0.05 }));
  }

  zbudujObraz(obj) {
    const el = obj.getElement();
    const nw = el.naturalWidth || el.width;
    const nh = el.naturalHeight || el.height;
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

  sekcja(tytul) {
    const f = document.createElement('fieldset');
    // Pierwsza sekcja o tej samej nazwie co nagłówek panelu – bez powtórzenia.
    if (!(this.el.children.length === 0 && tytul === this.tytul.textContent)) {
      const l = document.createElement('legend');
      l.textContent = tytul;
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
      b.addEventListener('click', () => { klik(); zapisz(); });
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
