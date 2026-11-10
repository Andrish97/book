// Zakładka „Warstwy”: elementy otwartej strony (albo rozkładówki) od wierzchu
// do spodu. Kliknięcie zaznacza, oko ukrywa, kłódka blokuje, przeciągnięcie
// zmienia kolejność, podwójne kliknięcie zmienia nazwę.

import { ikona } from './ikony.js';
import { zapytajONazwe } from './ui.js';

const IKONY_TYPOW = { textbox: 'tekst', rect: 'prostokat', ellipse: 'elipsa', line: 'linia', image: 'obraz', group: 'grupuj' };

export class PanelWarstw {
  constructor(lista, edytor) {
    this.lista = lista;
    this.edytor = edytor;
    this.widoczny = false;
    for (const zdarzenie of ['zmiana', 'zaznaczenie', 'historia']) edytor.addEventListener(zdarzenie, () => this.odswiez());

    lista.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      const { id } = li.dataset;
      if (e.target.closest('.warstwa-oko')) { edytor.ustawWidocznosc(id, li.classList.contains('ukryta')); return; }
      if (e.target.closest('.warstwa-klodka')) {
        edytor.zaznacz(id);
        if (edytor.aktywny?.id === id) edytor.przelaczBlokade();
        return;
      }
      if (!li.classList.contains('ukryta')) edytor.zaznacz(id);
    });
    lista.addEventListener('dblclick', async (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li || e.target.closest('button.warstwa-oko, button.warstwa-klodka')) return;
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
    this.lista.replaceChildren();
    if (!warstwy.length) {
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
      li.className = `warstwa${w.zaznaczony ? ' zaznaczona' : ''}${w.ukryty ? ' ukryta' : ''}${w.zablokowany ? ' zablokowana' : ''}`;
      li.innerHTML = `<button class="warstwa-oko" aria-label="${w.ukryty ? 'Pokaż' : 'Ukryj'}" title="${w.ukryty ? 'Pokaż' : 'Ukryj (nie będzie drukowany)'}">${ikona(w.ukryty ? 'okoOff' : 'oko', { rozmiar: 16 })}</button>
        <span class="warstwa-typ">${ikona(IKONY_TYPOW[w.typ] || 'prostokat', { rozmiar: 16 })}</span>
        <span class="warstwa-nazwa"></span>
        <button class="warstwa-klodka" aria-label="${w.zablokowany ? 'Odblokuj' : 'Zablokuj'}" title="${w.zablokowany ? 'Odblokuj' : 'Zablokuj'}">${ikona(w.zablokowany ? 'klodka' : 'klodkaOtwarta', { rozmiar: 16 })}</button>`;
      li.querySelector('.warstwa-nazwa').textContent = w.opis;
      li.querySelector('.warstwa-nazwa').title = w.opis;
      this.lista.append(li);
    }
  }
}
