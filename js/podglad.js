// Podgląd bez edycji: wszystkie strony po kolei, tak jak po przycięciu
// (bez spadu i linii pomocniczych). Rozkładówki stoją obok siebie.
//
// Ten sam widok służy dwóm źródłom:
//  - własny projekt: strony rysowane na bieżąco (zlozenie.js),
//  - podgląd udostępniony linkiem: gotowe obrazy stron z chwili udostępnienia.
// Oba źródła sprowadzają się do „układu”: sekcje → wiersze → strony.

import { numeryStron, stronySekcji, stronaRozkladowki } from './projekt.js';
import { renderujCel } from './zlozenie.js';
import { $ } from './ui.js';

const MAKS_PX = 1800; // górna granica szerokości renderowanego obrazu

const odmianaStron = (n) => (n === 1 ? 'strona' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'strony' : 'stron'));

// Układ podglądu z projektu: { nazwa, sekcje: [{ nazwa, w, h, rozkladowki, wiersze: [[strona | null]] }] }
// gdzie strona = { id, nr, nazwa }. W rozkładówkach wiersz to para [lewa, prawa].
export function ukladProjektu(projekt) {
  const numery = numeryStron(projekt);
  const opis = (s) => (s ? { id: s.id, nr: numery.get(s.id), nazwa: s.nazwa } : null);
  return {
    nazwa: projekt.nazwa,
    sekcje: projekt.sekcje.map((sekcja) => {
      const strony = stronySekcji(projekt, sekcja);
      const rozkladowki = sekcja.uklad === 'rozkladowki';
      let wiersze = [];
      if (!rozkladowki) wiersze = strony.map((s) => [opis(s)]);
      else {
        let i = 0;
        while (i < strony.length) {
          if (stronaRozkladowki(projekt, strony[i]) === 'lewa') { wiersze.push([opis(strony[i]), opis(strony[i + 1])]); i += 2; } else { wiersze.push([null, opis(strony[i])]); i += 1; }
        }
      }
      return {
        nazwa: sekcja.nazwa, w: sekcja.wydruk.szerokosc_mm, h: sekcja.wydruk.wysokosc_mm, rozkladowki, wiersze,
      };
    }),
  };
}

export const stronyUkladu = (uklad) => uklad.sekcje.flatMap((s) => s.wiersze.flat().filter(Boolean));

export class Podglad {
  // opcje: naKlik(idStrony) – np. przejście do edycji (pomijane w podglądzie udostępnionym)
  constructor(opcje = {}) {
    this.o = opcje;
    this.el = $('#podglad-tresc');
    this.skala = 2; // px ekranu na mm
    this.uklad = null;
    this.obserwator = new IntersectionObserver((wpisy) => {
      for (const w of wpisy) if (w.isIntersecting) this.renderuj(w.target);
    }, { root: this.el, rootMargin: '600px 0px' });
  }

  // Własny projekt: strony rysowane z danych projektu.
  pokazProjekt(projekt, idStrony = null) {
    const numery = numeryStron(projekt);
    this.pokaz(ukladProjektu(projekt), {
      obraz: (strona, szer) => renderujCel(projekt, projekt.strony.find((s) => s.id === strona.id), { szerokoscPx: szer, spad: false, numery }),
      klikalne: true,
      opis: 'podgląd bez edycji',
      idStrony,
    });
  }

  // zrodlo.obraz(strona, szerokoscPx) → adres obrazu (albo obietnica adresu).
  pokaz(uklad, zrodlo) {
    this.uklad = uklad;
    this.zrodlo = zrodlo;
    const n = stronyUkladu(uklad).length;
    $('#podglad-tytul').textContent = uklad.nazwa;
    $('#podglad-opis').textContent = `${n} ${odmianaStron(n)} · ${zrodlo.opis}`;
    this.buduj();
    this.dopasuj();
    if (zrodlo.idStrony) this.el.querySelector(`[data-id="${zrodlo.idStrony}"]`)?.scrollIntoView({ block: 'center' });
    else this.el.scrollTop = 0;
  }

  buduj() {
    this.obserwator.disconnect();
    this.el.replaceChildren();
    this.maksSzerokoscMm = 0;
    this.maksWysokoscMm = 0;
    for (const sekcja of this.uklad.sekcje) {
      this.maksSzerokoscMm = Math.max(this.maksSzerokoscMm, sekcja.rozkladowki ? 2 * sekcja.w : sekcja.w);
      this.maksWysokoscMm = Math.max(this.maksWysokoscMm, sekcja.h);
      const blok = document.createElement('section');
      blok.className = 'podglad-sekcja';
      const nag = document.createElement('h2');
      nag.textContent = sekcja.nazwa;
      blok.append(nag);
      for (const wiersz of sekcja.wiersze) {
        const rzad = document.createElement('div');
        rzad.className = `podglad-wiersz${sekcja.rozkladowki ? ' rozkladowka' : ''}`;
        for (const s of wiersz) {
          const fig = document.createElement('figure');
          fig.className = 'podglad-strona';
          fig.style.setProperty('--w', sekcja.w);
          fig.style.setProperty('--h', sekcja.h);
          if (!s) { fig.classList.add('pusta'); rzad.append(fig); continue; }
          fig.dataset.id = s.id;
          fig._strona = s;
          const ramka = document.createElement(this.zrodlo.klikalne ? 'button' : 'div');
          ramka.className = 'podglad-kartka';
          if (this.zrodlo.klikalne) {
            ramka.type = 'button';
            ramka.title = 'Kliknij, aby edytować tę stronę';
            ramka.addEventListener('click', () => this.o.naKlik?.(s.id));
          }
          const img = document.createElement('img');
          img.alt = `Strona ${s.nr ?? ''} ${s.nazwa}`;
          img.decoding = 'async';
          ramka.append(img);
          const podpis = document.createElement('figcaption');
          podpis.textContent = `${s.nr ?? '–'} · ${s.nazwa}`;
          fig.append(ramka, podpis);
          rzad.append(fig);
          this.obserwator.observe(fig);
        }
        blok.append(rzad);
      }
      this.el.append(blok);
    }
  }

  async renderuj(fig) {
    const { uklad, zrodlo } = this;
    // Rysujemy z zapasem rozdzielczości – pomniejszony obraz jest ostry przy każdym powiększeniu.
    const szer = Math.min(MAKS_PX, Math.round(Number(fig.style.getPropertyValue('--w')) * this.skala * Math.max(2, window.devicePixelRatio || 1)));
    // Gotowe obrazy (podgląd udostępniony) wczytujemy raz; rysowane – ponownie, gdy trzeba większych.
    if (zrodlo.stale ? fig.dataset.px : Number(fig.dataset.px) >= szer) return;
    fig.dataset.px = szer;
    const url = await zrodlo.obraz(fig._strona, szer);
    if (this.uklad === uklad && Number(fig.dataset.px) === szer) fig.querySelector('img').src = url;
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
