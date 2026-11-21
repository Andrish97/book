// Zakładka „Warstwy”: elementy otwartej strony (albo rozkładówki) od wierzchu
// do spodu. Kliknięcie zaznacza, oko ukrywa, kłódka blokuje, przeciągnięcie za uchwyt ⋮⋮ (mysz i palec)
// zmienia kolejność, ⋯ ma „Wyżej”, „Niżej”, „Na wierzch”, „Na spód” (#109), podwójne kliknięcie zmienia nazwę. Kliknięcie elementu
// rozwiniętej grupy otwiera grupę i zaznacza ten element (bez rozgrupowywania).
// Tabelę też da się rozwinąć: pod nią stoją jej komórki, a kliknięcie komórki zaczyna w niej pisanie.

import { ikona } from './ikony.js';
import { zapytajONazwe, zamknijMenu } from './ui.js';
import { t } from './jezyk.js';

const IKONY_TYPOW = { textbox: 'tekst', rect: 'prostokat', ellipse: 'elipsa', line: 'linia', image: 'obraz', group: 'grupuj', polygon: 'wielokat', path: 'rysuj' };

export class PanelWarstw {
  // doWzorca(idWzorca) – otwiera wzorzec do edycji (kliknięcie elementu wzorca na liście).
  constructor(lista, edytor, { doWzorca } = {}) {
    this.lista = lista;
    this.edytor = edytor;
    lista.addEventListener('click', (e) => { const li = e.target.closest('li[data-wzorzec]'); if (li && doWzorca) doWzorca(li.dataset.wzorzec); });
    this.widoczny = false;
    this.rozwiniete = new Set(); // identyfikatory grup pokazanych z zawartością
    for (const zdarzenie of ['zmiana', 'zaznaczenie', 'historia']) edytor.addEventListener(zdarzenie, () => this.odswiez());

    lista.addEventListener('click', (e) => {
      // Komórka rozwiniętej tabeli: kliknięcie zaczyna w niej pisanie (gdy się nie da – zaznacza całą tabelę).
      const komorka = e.target.closest('li[data-tabela]');
      if (komorka) {
        if (!edytor.piszWKomorce(komorka.dataset.tabela, Number(komorka.dataset.w), Number(komorka.dataset.k))) edytor.zaznacz(komorka.dataset.tabela);
        return;
      }
      // Element wewnątrz grupy: oko ukrywa tylko jego; kliknięcie wiersza otwiera grupę i zaznacza ten element
      // (ukrytego albo w grupie, której nie da się otworzyć – zaznacza całą grupę).
      const wGrupie = e.target.closest('li[data-grupa]');
      if (wGrupie) {
        // data-nr: numer elementu w grupie albo ścieżka numerów przez grupy w grupach („2.0.1”).
        if (e.target.closest('.warstwa-oko')) edytor.ustawWidocznoscWGrupie(wGrupie.dataset.grupa, wGrupie.dataset.nr, wGrupie.classList.contains('ukryta'));
        else if (!edytor.otworzGrupe(wGrupie.dataset.grupa, wGrupie.dataset.nr)) edytor.zaznacz(wGrupie.dataset.grupa);
        return;
      }
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      const { id } = li.dataset;
      if (e.target.closest('.warstwa-rozwin')) {
        if (this.rozwiniete.has(id)) this.rozwiniete.delete(id); else this.rozwiniete.add(id);
        this.odswiez();
        return;
      }
      if (e.target.closest('.warstwa-oko')) { edytor.ustawWidocznosc(id, li.classList.contains('ukryta')); return; }
      if (e.target.closest('.warstwa-uchwyt')) return;
      const menu = e.target.closest('.warstwa-menu');
      if (menu) { this._otworzMenu(menu, id); return; }
      if (e.target.closest('.warstwa-klodka')) {
        edytor.zaznacz(id);
        if (edytor.aktywny?.id === id) edytor.przelaczBlokade();
        return;
      }
      if (!li.classList.contains('ukryta')) edytor.zaznacz(id);
    });
    lista.addEventListener('dblclick', async (e) => {
      const wGrupie = e.target.closest('li[data-grupa]');
      if (wGrupie && !e.target.closest('button')) {
        const nazwa = await zapytajONazwe(t('warstwy.nazwaElementu'), t('warstwy.nazwaNaLiscieWarstw'), wGrupie.querySelector('.warstwa-nazwa').textContent);
        if (nazwa) edytor.nazwijWGrupie(wGrupie.dataset.grupa, wGrupie.dataset.nr, nazwa);
        return;
      }
      const li = e.target.closest('li[data-id]');
      if (!li || e.target.closest('button')) return;
      const nazwa = await zapytajONazwe(t('warstwy.nazwaElementu'), t('warstwy.nazwaNaLiscieWarstw'), li.querySelector('.warstwa-nazwa').textContent);
      if (nazwa) edytor.nazwij(li.dataset.id, nazwa);
    });

    // Zmiana kolejności: przeciąganie za uchwyt ⋮⋮ zdarzeniami wskaźnika – tak samo myszą i palcem.
    lista.addEventListener('pointerdown', (e) => {
      const uchwyt = e.target.closest('.warstwa-uchwyt');
      if (!uchwyt || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const li = uchwyt.closest('li[data-id]');
      e.preventDefault();
      try { uchwyt.setPointerCapture?.(e.pointerId); } catch { /* wskaźnik już puszczony */ }
      this.ciagniety = li.dataset.id;
      li.classList.add('ciagnieta');
      this.lista.classList.add('przeciaganie');
    });
    lista.addEventListener('pointermove', (e) => {
      if (!this.ciagniety) return;
      e.preventDefault();
      this._przewinPrzyKrawedzi(e.clientY);
      const cel = this._cel(e.clientY);
      this._znacznik(cel?.li, cel?.pod);
    });
    const koniec = (e, upusc) => {
      if (!this.ciagniety) return;
      const cel = upusc ? this._cel(e.clientY) : null;
      const id = this.ciagniety;
      this.ciagniety = null;
      this._znacznik(null);
      this.lista.classList.remove('przeciaganie');
      this.lista.querySelectorAll('.ciagnieta').forEach((x) => x.classList.remove('ciagnieta'));
      if (!cel || cel.li.dataset.id === id) return;
      const ids = this._kolejnosc().filter((x) => x !== id);
      // Lista idzie od wierzchu; „nad którym elementem” w stosie = następny na liście.
      const miejsce = ids.indexOf(cel.li.dataset.id) + (cel.pod ? 1 : 0);
      edytor.przeniesWarstwe(id, ids[miejsce] ?? null);
    };
    lista.addEventListener('pointerup', (e) => koniec(e, true));
    lista.addEventListener('pointercancel', (e) => koniec(e, false));
  }

  _kolejnosc() { return [...this.lista.querySelectorAll(':scope > li[data-id]')].map((x) => x.dataset.id); }

  // Wiersz (element najwyższego poziomu) pod wskaźnikiem i czy upuścić pod nim, czy nad nim.
  _cel(y) {
    const wiersze = [...this.lista.querySelectorAll(':scope > li[data-id]')];
    if (!wiersze.length) return null;
    for (const li of wiersze) {
      const r = li.getBoundingClientRect();
      if (y < r.bottom) return { li, pod: y > r.top + r.height / 2 };
    }
    return { li: wiersze.at(-1), pod: true };
  }

  _przewinPrzyKrawedzi(y) {
    const r = this.lista.getBoundingClientRect();
    if (y < r.top + 24) this.lista.scrollTop -= 8;
    else if (y > r.bottom - 24) this.lista.scrollTop += 8;
  }

  // Menu ⋯ wiersza: kolejność i nazwa (jedno menu dla całej listy).
  _otworzMenu(przycisk, id) {
    let menu = document.getElementById('menu-warstwy');
    const bylo = menu && !menu.hidden && menu.dataset.id === id;
    zamknijMenu();
    if (bylo) return;
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'menu-warstwy';
      menu.className = 'menu menu-strony';
      menu.setAttribute('role', 'menu');
      menu.hidden = true;
      menu.innerHTML = `<button role="menuitem" data-op="wierzch">Na wierzch</button>
        <button role="menuitem" data-op="wyzej">Wyżej</button>
        <button role="menuitem" data-op="nizej">Niżej</button>
        <button role="menuitem" data-op="spod">Na spód</button>
        <hr>
        <button role="menuitem" data-op="nazwa">Zmień nazwę</button>
        <button role="menuitem" data-op="malarz">Kopiuj wygląd</button>
        <button role="menuitem" data-op="zapisz-w-bibliotece">Zapisz w bibliotece</button>`;
      menu.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-op]');
        if (!b || b.disabled) return;
        const cel = menu.dataset.id;
        zamknijMenu();
        const ids = this._kolejnosc();
        const i = ids.indexOf(cel);
        if (b.dataset.op === 'wyzej') this.edytor.przesunWarstwe(cel, 1);
        else if (b.dataset.op === 'nizej') this.edytor.przesunWarstwe(cel, -1);
        else if (b.dataset.op === 'wierzch' && i > 0) this.edytor.przeniesWarstwe(cel, ids[0]);
        else if (b.dataset.op === 'spod' && i < ids.length - 1) this.edytor.przeniesWarstwe(cel, null);
        // Kopiuj wygląd, Zapisz w bibliotece (#131C, #140): ten sam przycisk co w nagłówku panelu – po zaznaczeniu.
        else if (b.dataset.op === 'malarz' || b.dataset.op === 'zapisz-w-bibliotece') {
          this.edytor.zaznacz(cel);
          document.querySelector(`#akcje-obiektu [data-akcja="${b.dataset.op}"]`)?.click();
        } else if (b.dataset.op === 'nazwa') {
          const li = this.lista.querySelector(`:scope > li[data-id="${CSS.escape(cel)}"]`);
          const nazwa = await zapytajONazwe(t('warstwy.nazwaElementu'), t('warstwy.nazwaNaLiscieWarstw'), li?.querySelector('.warstwa-nazwa').textContent || '');
          if (nazwa) this.edytor.nazwij(cel, nazwa);
        }
      });
      document.body.append(menu);
    }
    const ids = this._kolejnosc();
    const i = ids.indexOf(id);
    menu.dataset.id = id;
    menu.querySelector('[data-op="wierzch"]').disabled = i <= 0;
    menu.querySelector('[data-op="wyzej"]').disabled = i <= 0;
    menu.querySelector('[data-op="nizej"]').disabled = i >= ids.length - 1;
    menu.querySelector('[data-op="spod"]').disabled = i >= ids.length - 1;
    menu.hidden = false;
    const r = przycisk.getBoundingClientRect();
    const mr = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(window.innerWidth - mr.width - 8, Math.max(8, r.right - mr.width))}px`;
    menu.style.top = `${Math.max(8, Math.min(window.innerHeight - mr.height - 8, r.bottom + 4))}px`;
    przycisk.setAttribute('aria-expanded', 'true');
  }

  _znacznik(li, pod) {
    this.lista.querySelectorAll('.cel-nad, .cel-pod').forEach((x) => x.classList.remove('cel-nad', 'cel-pod'));
    if (li) li.classList.add(pod ? 'cel-pod' : 'cel-nad');
  }

  pokaz(widoczny) {
    this.widoczny = widoczny;
    if (widoczny) this.odswiez();
  }

  // Tabela na liście: znaczek typu jest przyciskiem, który pokazuje jej komórki (wierszami, z początkiem treści).
  _komorkiTabeli(li, w) {
    const komorki = this.edytor.komorkiNaLiscie(w.id);
    if (!komorki) return;
    const otwarta = this.rozwiniete.has(w.id);
    const rozwin = document.createElement('button');
    rozwin.className = 'warstwa-rozwin';
    rozwin.setAttribute('aria-expanded', String(otwarta));
    rozwin.setAttribute('aria-label', otwarta ? t('warstwy.zwinTabele') : t('warstwy.pokazKomorkiTabeli'));
    rozwin.title = otwarta ? t('warstwy.zwinTabele') : `Pokaż komórki tabeli (${komorki.length})`;
    rozwin.textContent = otwarta ? '▾' : '▸';
    li.querySelector('.warstwa-typ').replaceWith(rozwin);
    if (!otwarta) return;
    let wiersz = -1;
    for (const k of komorki) {
      const el = document.createElement('li');
      el.dataset.tabela = w.id;
      el.dataset.w = String(k.w);
      el.dataset.k = String(k.k);
      el.className = `warstwa w-grupie w-tabeli${k.pisana ? ' zaznaczona' : ''}${k.w !== wiersz ? ' nowy-wiersz' : ''}${w.ukryty ? ' ukryta' : ''}`;
      wiersz = k.w;
      el.title = `Wiersz ${k.w + 1}, kolumna ${k.k + 1} – kliknij, żeby pisać w tej komórce`;
      el.innerHTML = '<span class="warstwa-adres"></span><span class="warstwa-nazwa"></span>';
      el.querySelector('.warstwa-adres').textContent = `${k.w + 1}.${k.k + 1}`;
      const nazwa = el.querySelector('.warstwa-nazwa');
      nazwa.textContent = k.tekst ? (k.tekst.length > 40 ? `${k.tekst.slice(0, 40)}…` : k.tekst) : '(pusta)';
      if (!k.tekst) nazwa.classList.add('pusta');
      this.lista.append(el);
    }
  }

  odswiez() {
    if (!this.widoczny || !this.edytor.wydruk) return;
    const warstwy = this.edytor.warstwy();
    const zeWzorcow = this.edytor.warstwyZeWzorcow();
    this.lista.replaceChildren();
    if (!warstwy.length && !zeWzorcow.length) {
      const li = document.createElement('li');
      li.className = 'pusto-wzorce';
      li.innerHTML = '<strong>Pusta strona</strong><p>Tu pojawi się lista elementów strony, od wierzchu do spodu.</p>';
      this.lista.append(li);
      return;
    }
    for (const w of warstwy) {
      const li = document.createElement('li');
      li.dataset.id = w.id;
      li.className = `warstwa${w.zaznaczony ? ' zaznaczona' : ''}${w.otwarta ? ' otwarta' : ''}${w.ukryty ? ' ukryta' : ''}${w.zablokowany ? ' zablokowana' : ''}`;
      li.innerHTML = `<span class="warstwa-uchwyt" title="Przeciągnij, żeby zmienić kolejność" aria-hidden="true">${ikona('uchwyt', { rozmiar: 16 })}</span>
        <button class="warstwa-oko" aria-label="${w.ukryty ? 'Pokaż' : 'Ukryj'}" title="${w.ukryty ? 'Pokaż' : 'Ukryj (nie będzie drukowany)'}">${ikona(w.ukryty ? 'okoOff' : 'oko', { rozmiar: 16 })}</button>
        <span class="warstwa-typ">${ikona(IKONY_TYPOW[w.typ] || 'prostokat', { rozmiar: 16 })}</span>
        <span class="warstwa-nazwa"></span>
        <button class="warstwa-klodka" aria-label="${w.zablokowany ? 'Odblokuj' : 'Zablokuj'}" title="${w.zablokowany ? 'Odblokuj' : 'Zablokuj'}">${ikona(w.zablokowany ? 'klodka' : 'klodkaOtwarta', { rozmiar: 16 })}</button>
        <button class="warstwa-menu" aria-label="Kolejność i nazwa" title="Kolejność i nazwa" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 16 })}</button>`;
      li.querySelector('.warstwa-nazwa').textContent = w.opis;
      li.querySelector('.warstwa-nazwa').title = w.opis;
      this.lista.append(li);
      this._komorkiTabeli(li, w);
      if (!w.dzieci) continue;
      // Grupa: znaczek typu jest przyciskiem, który rozwija jej zawartość.
      const otwarta = this.rozwiniete.has(w.id);
      const rozwin = document.createElement('button');
      rozwin.className = 'warstwa-rozwin';
      rozwin.setAttribute('aria-expanded', String(otwarta));
      rozwin.setAttribute('aria-label', otwarta ? t('warstwy.zwinGrupe') : t('warstwy.pokazElementyGrupy'));
      rozwin.title = otwarta ? t('warstwy.zwinGrupe') : `Pokaż elementy grupy (${w.dzieci.length})`;
      rozwin.textContent = otwarta ? '▾' : '▸';
      li.querySelector('.warstwa-typ').replaceWith(rozwin);
      if (!otwarta) continue;
      for (const d of w.dzieci) {
        const wiersz = document.createElement('li');
        wiersz.dataset.grupa = w.id;
        wiersz.dataset.nr = String(d.nr);
        wiersz.className = `warstwa w-grupie${d.zaznaczony ? ' zaznaczona' : ''}${d.otwarta ? ' otwarta' : ''}${d.ukryty ? ' ukryta' : ''}`;
        // Element grupy leżącej w grupie: wcięcie o poziom głębiej.
        if (d.poziom > 1) wiersz.style.paddingLeft = `${24 + (d.poziom - 1) * 16}px`;
        wiersz.title = t('warstwy.kliknijZebyZmienicTen');
        wiersz.innerHTML = `<button class="warstwa-oko" aria-label="${d.ukryty ? 'Pokaż' : 'Ukryj'}" title="${d.ukryty ? 'Pokaż' : 'Ukryj (nie będzie drukowany)'}">${ikona(d.ukryty ? 'okoOff' : 'oko', { rozmiar: 16 })}</button>
          <span class="warstwa-typ">${ikona(IKONY_TYPOW[d.typ] || 'prostokat', { rozmiar: 16 })}</span>
          <span class="warstwa-nazwa"></span>`;
        wiersz.querySelector('.warstwa-nazwa').textContent = d.opis;
        wiersz.querySelector('.warstwa-nazwa').title = d.opis;
        this.lista.append(wiersz);
      }
    }
    // Elementy wzorców: widać je na stronie, ale zmienia się je we wzorcu – kliknięcie tam prowadzi.
    if (zeWzorcow.length) {
      const naglowek = document.createElement('li');
      naglowek.className = 'warstwy-naglowek';
      naglowek.textContent = t('warstwy.zeWzorcowEdycjaWe');
      this.lista.append(naglowek);
      for (const w of zeWzorcow) {
        const li = document.createElement('li');
        li.className = 'warstwa ze-wzorca';
        if (w.idWzorca) li.dataset.wzorzec = w.idWzorca;
        li.title = `Element wzorca „${w.wzorzec}” – kliknij, żeby przejść do wzorca`;
        li.innerHTML = `<span class="warstwa-typ">${ikona(IKONY_TYPOW[w.typ] || 'prostokat', { rozmiar: 16 })}</span><span class="warstwa-nazwa"></span><small></small>`;
        li.querySelector('.warstwa-nazwa').textContent = w.opis;
        li.querySelector('small').textContent = `${w.wzorzec}${w.nad ? ' · nad treścią' : ''}`;
        this.lista.append(li);
      }
    }
  }
}
