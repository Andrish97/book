/* global fabric */
// Panel właściwości: pola liczbowe w mm (4.7 – precyzja na tablecie).

import { CZCIONKI } from './czcionki.js';
import { mmNaPt, ptNaMm } from './projekt.js';
import { nazwaTypu } from './edytor.js';
import { ikona } from './ikony.js';

const TEKSTOWE = new Set(['textbox', 'i-text', 'text']);
const KSZTALTY = new Set(['rect', 'ellipse']);

const zaokr = (v, miejsc = 2) => {
  const k = 10 ** miejsc;
  return Math.round(v * k) / k;
};

export class PanelWlasciwosci {
  constructor(kontener, tytul, edytor, { strona, onStrona, onFormat, opisFormatu }) {
    this.el = kontener;
    this.tytul = tytul;
    this.edytor = edytor;
    this.strona = strona; // () => bieżąca strona projektu
    this.onStrona = onStrona; // zmiana nazwy / tła strony
    this.onFormat = onFormat; // otwarcie dialogu formatu
    this.opisFormatu = opisFormatu;
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
      this.tytul.textContent = 'Strona';
      this.zbudujStrone();
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
    inne.append(this.przelacznik('Wycisz ostrzeżenia dla tego obiektu', () => Boolean(obj.bez_ostrzezen), (v) => { obj.bez_ostrzezen = v || undefined; }));
  }

  zbudujStrone() {
    const strona = this.strona();
    const s = this.sekcja('Strona');
    s.append(this.tekst('Nazwa strony', () => strona.nazwa, (v) => this.onStrona({ nazwa: v }), true, false));
    s.append(this.kolor('Tło', () => this.edytor.canvas.backgroundColor || '#ffffff', (v) => this.edytor.ustawTlo(v), { bezZatwierdzania: true }));

    const f = this.sekcja('Format wydruku');
    const opis = this.wskazowka('');
    this.odswiezacze.push(() => { opis.textContent = this.opisFormatu(); });
    opis.textContent = this.opisFormatu();
    f.append(opis, this.akcje([['format', 'Zmień format', () => this.onFormat()]]));

    const l = this.sekcja('Linie na stronie');
    const legenda = document.createElement('ul');
    legenda.className = 'legenda-prowadnic';
    legenda.innerHTML = '<li><i class="ciecie"></i>Linia cięcia – krawędź strony po przycięciu</li>'
      + '<li><i class="spad"></i>Spad – zostanie odcięty</li>'
      + '<li><i class="margines"></i>Margines – trzymaj w nim teksty</li>';
    l.append(legenda);
    l.append(this.wskazowka('Kliknij element na stronie, aby zmienić jego wygląd. Linie nie są drukowane.'));
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

  zbudujTekst(obj) {
    const s = this.sekcja('Tekst');
    // Edycja treści w zwykłym polu – wygodniejsze na telefonie niż na płótnie (4.7).
    const tresc = this.obszarTekstu('Treść', () => obj.text, (v) => obj.set('text', v));
    s.append(tresc);

    const czcionka = this.wybor('Czcionka', CZCIONKI.map((c) => [c.nazwa, c.nazwa]), () => obj.fontFamily, (v) => obj.set('fontFamily', v));
    czcionka.classList.add('szeroki');
    s.append(czcionka);
    s.append(this.liczba('Rozmiar', () => zaokr(mmNaPt(obj.fontSize * obj.scaleY), 1), (v) => {
      obj.set('fontSize', ptNaMm(Math.max(1, v)) / obj.scaleY);
    }, { jednostka: 'pt', krok: 0.5, min: 1 }));
    s.append(this.liczba('Interlinia', () => zaokr(obj.lineHeight, 2), (v) => obj.set('lineHeight', Math.max(0.5, v)), { krok: 0.05, min: 0.5 }));
    s.append(this.kolor('Kolor', () => obj.fill, (v) => obj.set('fill', v)));
    s.append(this.segmenty('Styl', [
      ['pogrubienie', 'Pogrubienie', () => obj.fontWeight === 'bold' || obj.fontWeight >= 600, () => obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold')],
      ['kursywa', 'Kursywa', () => obj.fontStyle === 'italic', () => obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic')],
    ]));
    const wyr = this.segmenty('Wyrównanie', [
      ['doLewej', 'Do lewej', () => obj.textAlign === 'left', () => obj.set('textAlign', 'left')],
      ['doSrodka', 'Do środka', () => obj.textAlign === 'center', () => obj.set('textAlign', 'center')],
      ['doPrawej', 'Do prawej', () => obj.textAlign === 'right', () => obj.set('textAlign', 'right')],
      ['wyjustuj', 'Wyjustuj', () => obj.textAlign === 'justify', () => obj.set('textAlign', 'justify')],
    ]);
    wyr.classList.add('szeroki');
    s.append(wyr);
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
      o.style.fontFamily = `"${wartosc}"`;
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
        o.textContent = `${v} (spoza listy)`;
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
  segmenty(etykieta, definicje) {
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
      b.innerHTML = ikona(ik, { rozmiar: 18 });
      b.addEventListener('click', () => { klik(); if (aktywny) zapisz(); else this.odswiez(); });
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
