// Podgląd projektu bez edycji: wszystkie strony po kolei, tak jak po
// przycięciu (bez spadu i linii pomocniczych). Rozkładówki stoją obok siebie.

import {
  numeryStron, stronySekcji, stronaRozkladowki,
} from './projekt.js';
import { renderujCel } from './zlozenie.js';
import { $ } from './ui.js';

const MAKS_PX = 1800; // górna granica szerokości renderowanego obrazu

export class Podglad {
  // opcje: naEdycje(idStrony) – przejście do edytora na wskazanej stronie
  constructor(opcje) {
    this.o = opcje;
    this.el = $('#podglad-tresc');
    this.skala = 2; // px ekranu na mm
    this.projekt = null;
    this.obserwator = new IntersectionObserver((wpisy) => {
      for (const w of wpisy) if (w.isIntersecting) this.renderuj(w.target);
    }, { root: this.el, rootMargin: '600px 0px' });
  }

  pokaz(projekt, idStrony = null) {
    this.projekt = projekt;
    this.numery = numeryStron(projekt);
    $('#podglad-tytul').textContent = projekt.nazwa;
    const n = projekt.strony.length;
    $('#podglad-opis').textContent = `${n} ${n === 1 ? 'strona' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'strony' : 'stron')} · podgląd bez edycji`;
    this.buduj();
    this.dopasuj();
    if (idStrony) this.el.querySelector(`[data-id="${idStrony}"]`)?.scrollIntoView({ block: 'center' });
    else this.el.scrollTop = 0;
  }

  // Wiersze podglądu: pojedyncza strona albo para [lewa, prawa].
  wiersze(sekcja) {
    const strony = stronySekcji(this.projekt, sekcja);
    if (sekcja.uklad !== 'rozkladowki') return strony.map((s) => [s]);
    const wiersze = [];
    let i = 0;
    while (i < strony.length) {
      const bok = stronaRozkladowki(this.projekt, strony[i]);
      if (bok === 'lewa') { wiersze.push([strony[i], strony[i + 1] || null]); i += 2; } else { wiersze.push([null, strony[i]]); i += 1; }
    }
    return wiersze;
  }

  buduj() {
    this.obserwator.disconnect();
    this.el.replaceChildren();
    this.maksSzerokoscMm = 0;
    this.maksWysokoscMm = 0;
    for (const sekcja of this.projekt.sekcje) {
      const { szerokosc_mm: w, wysokosc_mm: h } = sekcja.wydruk;
      const rozkladowki = sekcja.uklad === 'rozkladowki';
      this.maksSzerokoscMm = Math.max(this.maksSzerokoscMm, rozkladowki ? 2 * w : w);
      this.maksWysokoscMm = Math.max(this.maksWysokoscMm, h);
      const blok = document.createElement('section');
      blok.className = 'podglad-sekcja';
      const nag = document.createElement('h2');
      nag.textContent = sekcja.nazwa;
      blok.append(nag);
      for (const wiersz of this.wiersze(sekcja)) {
        const rzad = document.createElement('div');
        rzad.className = `podglad-wiersz${rozkladowki ? ' rozkladowka' : ''}`;
        for (const s of wiersz) {
          const fig = document.createElement('figure');
          fig.className = 'podglad-strona';
          fig.style.setProperty('--w', w);
          fig.style.setProperty('--h', h);
          if (!s) { fig.classList.add('pusta'); rzad.append(fig); continue; }
          fig.dataset.id = s.id;
          const nr = this.numery.get(s.id);
          fig.innerHTML = '<button type="button" title="Kliknij, aby edytować tę stronę"><img alt=""></button><figcaption></figcaption>';
          fig.querySelector('figcaption').textContent = `${nr ?? '–'} · ${s.nazwa}`;
          fig.querySelector('img').alt = `Strona ${nr ?? ''} ${s.nazwa}`;
          fig.querySelector('button').addEventListener('click', () => this.o.naEdycje(s.id));
          rzad.append(fig);
          this.obserwator.observe(fig);
        }
        blok.append(rzad);
      }
      this.el.append(blok);
    }
  }

  async renderuj(fig) {
    const projekt = this.projekt;
    const s = projekt.strony.find((x) => x.id === fig.dataset.id);
    if (!s) return;
    const szer = Math.min(MAKS_PX, Math.round(Number(fig.style.getPropertyValue('--w')) * this.skala * (window.devicePixelRatio || 1)));
    // Już narysowana w tej lub lepszej rozdzielczości – nic do zrobienia.
    if (Number(fig.dataset.px) >= szer) return;
    fig.dataset.px = szer;
    const url = await renderujCel(projekt, s, { szerokoscPx: szer, spad: false, numery: this.numery });
    if (this.projekt === projekt && Number(fig.dataset.px) === szer) fig.querySelector('img').src = url;
  }

  ustawSkale(skala) {
    this.skala = Math.min(12, Math.max(0.5, skala));
    this.el.style.setProperty('--skala', this.skala);
    $('#podglad-zoom').textContent = `${Math.round((this.skala / (96 / 25.4)) * 100)}%`;
    // Widoczne strony dorysują się w nowej rozdzielczości.
    for (const fig of this.el.querySelectorAll('.podglad-strona[data-id]')) {
      this.obserwator.unobserve(fig);
      this.obserwator.observe(fig);
    }
  }

  // Cała rozkładówka (albo strona) mieści się w oknie.
  dopasuj() {
    const szer = Math.max(200, this.el.clientWidth - 64);
    const wys = Math.max(200, this.el.clientHeight - 150);
    this.ustawSkale(Math.min(szer / (this.maksSzerokoscMm || 148), wys / (this.maksWysokoscMm || 210)));
  }

  powieksz(mnoznik) {
    this.ustawSkale(this.skala * mnoznik);
  }
}
