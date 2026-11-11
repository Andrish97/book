// Zakładka „Warstwy”: elementy otwartej strony (albo rozkładówki) od wierzchu
// do spodu. Kliknięcie zaznacza, oko ukrywa, kłódka blokuje, przeciągnięcie
// zmienia kolejność, podwójne kliknięcie zmienia nazwę. Kliknięcie elementu
// rozwiniętej grupy otwiera grupę i zaznacza ten element (bez rozgrupowywania).

import { ikona } from './ikony.js';
import { zapytajONazwe } from './ui.js';

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
      const kolejnosc = e.target.closest('.warstwa-wyzej, .warstwa-nizej');
      if (kolejnosc) { edytor.przesunWarstwe(id, kolejnosc.classList.contains('warstwa-wyzej') ? 1 : -1); return; }
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
        const nazwa = await zapytajONazwe('Nazwa elementu', 'Nazwa na liście warstw', wGrupie.querySelector('.warstwa-nazwa').textContent);
        if (nazwa) edytor.nazwijWGrupie(wGrupie.dataset.grupa, wGrupie.dataset.nr, nazwa);
        return;
      }
      const li = e.target.closest('li[data-id]');
      if (!li || e.target.closest('button')) return;
      const nazwa = await zapytajONazwe('Nazwa elementu', 'Nazwa na liście warstw', li.querySelector('.warstwa-nazwa').textContent);
      if (nazwa) edytor.nazwij(li.dataset.id, nazwa);
    });

    // Zmiana kolejności przeciąganiem (mysz).
    lista.addEventListener('dragstart', (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      this.ciagniety = li.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.ciagniety);
    });
    lista.addEventListener('dragover', (e) => {
      if (!this.ciagniety) return;
      e.preventDefault();
      const li = e.target.closest('li[data-id]');
      this._znacznik(li, li ? e.clientY > li.getBoundingClientRect().top + li.offsetHeight / 2 : false);
    });
    lista.addEventListener('dragleave', (e) => { if (!lista.contains(e.relatedTarget)) this._znacznik(null); });
    lista.addEventListener('drop', (e) => {
      e.preventDefault();
      const li = e.target.closest('li[data-id]');
      const pod = li ? e.clientY > li.getBoundingClientRect().top + li.offsetHeight / 2 : true;
      const ids = [...lista.querySelectorAll('li[data-id]')].map((x) => x.dataset.id).filter((id) => id !== this.ciagniety);
      // Lista idzie od wierzchu; „nad którym elementem” w stosie = następny na liście.
      let miejsce = li ? ids.indexOf(li.dataset.id) + (pod ? 1 : 0) : ids.length;
      if (li && li.dataset.id === this.ciagniety) miejsce = -1;
      if (miejsce >= 0) edytor.przeniesWarstwe(this.ciagniety, ids[miejsce] ?? null);
      this.ciagniety = null;
      this._znacznik(null);
    });
    lista.addEventListener('dragend', () => { this.ciagniety = null; this._znacznik(null); });
  }

  _znacznik(li, pod) {
    this.lista.querySelectorAll('.cel-nad, .cel-pod').forEach((x) => x.classList.remove('cel-nad', 'cel-pod'));
    if (li) li.classList.add(pod ? 'cel-pod' : 'cel-nad');
  }

  pokaz(widoczny) {
    this.widoczny = widoczny;
    if (widoczny) this.odswiez();
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
      li.draggable = true;
      li.className = `warstwa${w.zaznaczony ? ' zaznaczona' : ''}${w.otwarta ? ' otwarta' : ''}${w.ukryty ? ' ukryta' : ''}${w.zablokowany ? ' zablokowana' : ''}`;
      li.innerHTML = `<button class="warstwa-oko" aria-label="${w.ukryty ? 'Pokaż' : 'Ukryj'}" title="${w.ukryty ? 'Pokaż' : 'Ukryj (nie będzie drukowany)'}">${ikona(w.ukryty ? 'okoOff' : 'oko', { rozmiar: 16 })}</button>
        <span class="warstwa-typ">${ikona(IKONY_TYPOW[w.typ] || 'prostokat', { rozmiar: 16 })}</span>
        <span class="warstwa-nazwa"></span>
        <span class="warstwa-kolejnosc"><button class="warstwa-wyzej" aria-label="Wyżej" title="Wyżej (bliżej wierzchu)">▲</button><button class="warstwa-nizej" aria-label="Niżej" title="Niżej (bliżej spodu)">▼</button></span>
        <button class="warstwa-klodka" aria-label="${w.zablokowany ? 'Odblokuj' : 'Zablokuj'}" title="${w.zablokowany ? 'Odblokuj' : 'Zablokuj'}">${ikona(w.zablokowany ? 'klodka' : 'klodkaOtwarta', { rozmiar: 16 })}</button>`;
      li.querySelector('.warstwa-nazwa').textContent = w.opis;
      li.querySelector('.warstwa-nazwa').title = w.opis;
      this.lista.append(li);
      if (!w.dzieci) continue;
      // Grupa: znaczek typu jest przyciskiem, który rozwija jej zawartość.
      const otwarta = this.rozwiniete.has(w.id);
      const rozwin = document.createElement('button');
      rozwin.className = 'warstwa-rozwin';
      rozwin.setAttribute('aria-expanded', String(otwarta));
      rozwin.setAttribute('aria-label', otwarta ? 'Zwiń grupę' : 'Pokaż elementy grupy');
      rozwin.title = otwarta ? 'Zwiń grupę' : `Pokaż elementy grupy (${w.dzieci.length})`;
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
        wiersz.title = 'Kliknij, żeby zmienić ten element bez rozgrupowywania';
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
      naglowek.textContent = 'Ze wzorców (edycja we wzorcu)';
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
