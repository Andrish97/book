// Podgląd bez edycji: wszystkie strony po kolei, tak jak po przycięciu
// (bez spadu i linii pomocniczych). Rozkładówki stoją obok siebie.
//
// Ten sam widok służy dwóm źródłom:
//  - własny projekt: strony rysowane na bieżąco (zlozenie.js),
//  - podgląd udostępniony linkiem: gotowe obrazy stron z chwili udostępnienia.
// Oba źródła sprowadzają się do „układu”: sekcje → wiersze → strony.

import { rozwin } from './serie.js';
import { $ } from './ui.js';
import { ikona } from './ikony.js';

const MAKS_PX = 1800; // górna granica szerokości renderowanego obrazu
const MAKS_PX_ZOOM = 4096; // powiększona strona w prezentacji – ostra, ale bez zjadania pamięci
const ZOOM_MAKS = 8; // największe powiększenie prezentacji (× dopasowanie)
const bezRuchu = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const odl = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const srodekPunktow = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
// Podgląd na ekranie: jeden naraz (własny albo z linku) – zdarzenia elementu i klawiatury trafiają do niego.
let aktywny = null;

const odmianaStron = (n) => (n === 1 ? 'strona' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'strony' : 'stron'));

// Układ podglądu z projektu: { nazwa, sekcje: [{ nazwa, w, h, rozkladowki, wiersze: [[strona | null]] }] }
// gdzie strona = { id, strona, nr, nazwa, egz }. Układ powstaje z rozwiniętego
// ciągu, więc zawiera wszystkie powielenia serii; id to klucz egzemplarza,
// strona – identyfikator strony projektu, z której powstał. W rozkładówkach
// wiersz to para [lewa, prawa].
export function ukladProjektu(projekt, ciag = rozwin(projekt)) {
  const opis = (e) => (e ? {
    // Pusta strona (wstawiona, żeby następna stanęła po właściwej stronie rozkładówki) prowadzi do strony serii.
    id: e.klucz, strona: e.pusta ? e.przy.id : e.strona.id, nr: e.nr, nazwa: e.strona.nazwa, ...(e.pusta ? { pusta: true } : {}), ...(e.nrEgz ? { egz: `${e.nrEgz} z ${e.ileEgz}` } : {}),
  } : null);
  return {
    nazwa: projekt.nazwa,
    sekcje: projekt.sekcje.map((sekcja) => {
      const { lista } = ciag.sekcje.get(sekcja.id);
      const rozkladowki = sekcja.uklad === 'rozkladowki';
      let wiersze = [];
      if (!rozkladowki) wiersze = lista.map((e) => [opis(e)]);
      else {
        let i = 0;
        while (i < lista.length) {
          if (lista[i].bok === 'lewa') { wiersze.push([opis(lista[i]), opis(lista[i + 1])]); i += 2; } else { wiersze.push([null, opis(lista[i])]); i += 1; }
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
    podlaczGesty(this.el);
  }

  // Własny projekt: strony rysowane z danych projektu.
  // nrStrony: numer strony w wydruku (po powieleniu serii), do której podgląd ma się przewinąć.
  // odcisk(egz, ciag): skrót wszystkiego, od czego zależy wygląd strony – pozwala po zmianie projektu
  // przerysować tylko te strony, które naprawdę się zmieniły (odswiezProjekt).
  pokazProjekt(projekt, idStrony = null, nrStrony = null, odcisk = null) {
    const ciag = rozwin(projekt);
    this.pokaz(ukladProjektu(projekt, ciag), {
      ...this._zrodloProjektu(projekt, ciag, odcisk),
      idStrony,
      klucz: nrStrony ? ciag.egzemplarze[nrStrony - 1]?.klucz : null,
    });
  }

  _zrodloProjektu(projekt, ciag, odcisk) {
    const poKluczu = new Map(ciag.egzemplarze.map((e) => [e.klucz, e]));
    return {
      // Składanie stron (biblioteka płótna) wczytuje się dopiero tu – podgląd z linku dostaje gotowe obrazy.
      obraz: async (strona, szer) => (await import('./zlozenie.js')).renderujCel(projekt, poKluczu.get(strona.id), { szerokoscPx: szer, spad: false, ciag }),
      odcisk: odcisk ? (strona) => odcisk(poKluczu.get(strona.id), ciag) : null,
      projekt,
      klikalne: true,
      opis: 'podgląd bez edycji',
    };
  }

  // Projekt zmienił się, gdy podgląd był otwarty (np. zmiana z innego urządzenia albo od AI).
  // Podgląd zostaje tam, gdzie był: ta sama skala i to samo miejsce przewinięcia. Strony bez zmian
  // zachowują gotowe obrazy; zmienione rysują się od nowa, a do tego czasu widać ich poprzedni wygląd.
  odswiezProjekt(projekt, odcisk = null) {
    if (!this.uklad || this.zrodlo?.projekt !== projekt) return;
    const ciag = rozwin(projekt);
    this.odswiez(ukladProjektu(projekt, ciag), this._zrodloProjektu(projekt, ciag, odcisk));
  }

  // Nowy układ i nowe źródło obrazów w miejsce bieżących, bez zmiany skali i miejsca przewinięcia.
  // zrodlo.odcisk(strona) mówi, czy obraz strony jest ten sam co poprzednio (jeśli brak – rysujemy wszystko).
  odswiez(uklad, zrodlo) {
    if (!this.uklad) return;
    // Co już narysowano: obraz, jego rozdzielczość i skrót stanu, z którego powstał.
    const bylo = new Map();
    for (const fig of this.el.querySelectorAll('.podglad-strona[data-id]')) {
      const src = fig.querySelector('img')?.getAttribute('src');
      if (src) bylo.set(fig.dataset.id, { src, px: fig.dataset.px, odcisk: fig.dataset.odcisk });
    }
    // Punkt zaczepienia: pierwsza strona widoczna u góry okna i jej odległość od tej krawędzi.
    const gora = this.el.getBoundingClientRect().top;
    const kotwica = [...this.el.querySelectorAll('.podglad-strona[data-id]')].find((f) => f.getBoundingClientRect().bottom > gora);
    const przesuniecie = kotwica ? kotwica.getBoundingClientRect().top - gora : 0;
    const przewiniecie = this.el.scrollTop;

    this.uklad = uklad;
    this.zrodlo = zrodlo;
    const n = stronyUkladu(this.uklad).length;
    $('#podglad-tytul').textContent = this.uklad.nazwa;
    $('#podglad-opis').textContent = `${n} ${odmianaStron(n)} · ${zrodlo.opis}`;
    this.buduj();
    for (const fig of this.el.querySelectorAll('.podglad-strona[data-id]')) {
      const stare = bylo.get(fig.dataset.id);
      if (!stare) continue;
      fig.querySelector('img').src = stare.src;
      // Ten sam skrót – obraz jest aktualny i nie trzeba go rysować ponownie.
      if (stare.odcisk && zrodlo.odcisk && stare.odcisk === zrodlo.odcisk(fig._strona)) {
        fig.dataset.px = stare.px;
        fig.dataset.odcisk = stare.odcisk;
      }
    }
    const nowa = kotwica && [...this.el.querySelectorAll('.podglad-strona[data-id]')].find((f) => f.dataset.id === kotwica.dataset.id);
    if (nowa) this.el.scrollTop += nowa.getBoundingClientRect().top - this.el.getBoundingClientRect().top - przesuniecie;
    else this.el.scrollTop = przewiniecie;
    if (this.prezentacja) {
      const p = this.prezentacja;
      p.kroki = this.uklad.sekcje.flatMap((sekcja) => sekcja.wiersze.map((strony) => ({ sekcja, strony })));
      if (!p.kroki.length) { this.zamknijPrezentacje(); return; }
      p.i = Math.min(p.i, p.kroki.length - 1);
      this._rysujPrezentacje();
    }
  }

  // zrodlo.obraz(strona, szerokoscPx) → adres obrazu (albo obietnica adresu).
  pokaz(uklad, zrodlo) {
    aktywny = this;
    this.uklad = uklad;
    this.zrodlo = zrodlo;
    const n = stronyUkladu(uklad).length;
    $('#podglad-tytul').textContent = uklad.nazwa;
    $('#podglad-opis').textContent = `${n} ${odmianaStron(n)} · ${zrodlo.opis}`;
    this.buduj();
    this.dopasuj();
    // Wskazana strona wydruku (np. z listy „Sprawdź przed drukiem”): przewinięcie i chwilowe wyróżnienie.
    const wskazana = zrodlo.klucz ? [...this.el.querySelectorAll('.podglad-strona[data-id]')].find((f) => f.dataset.id === zrodlo.klucz) : null;
    if (wskazana) {
      wskazana.scrollIntoView({ block: 'center' });
      wskazana.classList.add('wskazana');
      setTimeout(() => wskazana.classList.remove('wskazana'), 4000);
    } else if (zrodlo.idStrony) this.el.querySelector(`[data-strona="${zrodlo.idStrony}"]`)?.scrollIntoView({ block: 'center' });
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
      // Jedna sekcja w projekcie – jej nazwa niczego nie mówi i zabiera miejsce (#103).
      nag.hidden = this.uklad.sekcje.length === 1;
      blok.append(nag);
      // Pojedyncze strony układają się obok siebie i zawijają do kolejnych rzędów
      // (przy seriach bywa ich dużo); rozkładówki idą parami, jedna pod drugą.
      let wspolny = null;
      for (const wiersz of sekcja.wiersze) {
        const rzad = wspolny || document.createElement('div');
        rzad.className = `podglad-wiersz${sekcja.rozkladowki ? ' rozkladowka' : ' pojedyncze'}`;
        if (!sekcja.rozkladowki) wspolny = rzad;
        for (const s of wiersz) {
          const fig = document.createElement('figure');
          fig.className = 'podglad-strona';
          fig.style.setProperty('--w', sekcja.w);
          fig.style.setProperty('--h', sekcja.h);
          if (!s) { fig.classList.add('pusta'); rzad.append(fig); continue; }
          fig.dataset.id = s.id;
          fig.dataset.strona = s.strona || s.id;
          fig._strona = s;
          const ramka = document.createElement(this.zrodlo.klikalne ? 'button' : 'div');
          ramka.className = 'podglad-kartka';
          if (this.zrodlo.klikalne) {
            ramka.type = 'button';
            ramka.title = 'Kliknij, aby edytować tę stronę';
            ramka.addEventListener('click', () => this.o.naKlik?.(s.strona || s.id));
          }
          const img = document.createElement('img');
          img.alt = `Strona ${s.nr ?? ''} ${s.nazwa}`;
          img.decoding = 'async';
          img.draggable = false;
          ramka.append(img);
          const podpis = document.createElement('figcaption');
          podpis.textContent = `${s.nr ?? '–'} · ${s.nazwa}${s.egz ? ` · ${s.egz}` : ''}`;
          fig.append(ramka, podpis);
          rzad.append(fig);
          this.obserwator.observe(fig);
        }
        if (!rzad.parentNode) blok.append(rzad);
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
    // Skrót liczony razem z rysowaniem – opisuje dokładnie ten stan projektu, z którego powstaje obraz.
    const odcisk = zrodlo.odcisk?.(fig._strona);
    let url;
    try { url = await zrodlo.obraz(fig._strona, szer); } catch {
      // Nie udało się narysować (np. obraz linku jeszcze się nie wczytał) – spróbujemy, gdy strona znów będzie widoczna.
      if (Number(fig.dataset.px) === szer) delete fig.dataset.px;
      return;
    }
    if (this.uklad === uklad && Number(fig.dataset.px) === szer) {
      fig.querySelector('img').src = url;
      if (odcisk) fig.dataset.odcisk = odcisk;
    }
  }

  // rysuj = false: tylko układ (w trakcie szczypania), bez dorysowywania stron w nowej rozdzielczości.
  ustawSkale(skala, { rysuj = true } = {}) {
    const dopasowanie = this.skalaDopasowania();
    this.skala = Math.min(Math.max(12, dopasowanie * ZOOM_MAKS), Math.max(Math.min(0.5, dopasowanie * 0.5), skala));
    this.el.style.setProperty('--skala', this.skala);
    // 100% – cała rozkładówka (albo strona) mieści się w oknie.
    const zoom = $('#podglad-zoom');
    if (zoom) zoom.textContent = `${Math.round((this.skala / dopasowanie) * 100)}%`;
    this.el.classList.toggle('powiekszony', this.skala > dopasowanie * 1.02);
    if (!rysuj) return;
    // Widoczne strony dorysują się w nowej rozdzielczości.
    for (const fig of this.el.querySelectorAll('.podglad-strona[data-id]')) {
      this.obserwator.unobserve(fig);
      this.obserwator.observe(fig);
    }
  }

  skalaDopasowania() {
    const szer = Math.max(200, this.el.clientWidth - 64);
    const wys = Math.max(200, this.el.clientHeight - 150);
    return Math.min(szer / (this.maksSzerokoscMm || 148), wys / (this.maksWysokoscMm || 210));
  }

  // Cała rozkładówka (albo strona) mieści się w oknie.
  dopasuj() {
    if (this.prezentacja) { this._zoomPrezentacji(1, null, { animuj: true }); return; }
    this.ustawSkale(this.skalaDopasowania());
  }

  // Powiększenie względem środka okna (przyciski, klawiatura) albo wskazanego punktu ekranu (kółko, palce).
  powieksz(mnoznik, punkt = null) {
    if (this.prezentacja) { this._zoomPrezentacji(this.prezentacja.zoom * mnoznik, punkt); return; }
    const r = this.el.getBoundingClientRect();
    this.skalaWPunkcie(this.skala * mnoznik, punkt || { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  // Zmiana skali siatki tak, żeby punkt strony pod `punkt` (współrzędne ekranu) został w tym samym miejscu.
  // kotwica: { kartka, fx, fy } zapamiętana na początku gestu – przy szczypaniu ten sam punkt strony idzie za palcami.
  skalaWPunkcie(skala, punkt, { rysuj = true, kotwica = null } = {}) {
    const k = kotwica || this.kotwicaWPunkcie(punkt);
    this.ustawSkale(skala, { rysuj });
    if (!k?.kartka.isConnected) return;
    const r = k.kartka.getBoundingClientRect();
    this.el.scrollLeft += r.left + k.fx * r.width - punkt.x;
    this.el.scrollTop += r.top + k.fy * r.height - punkt.y;
  }

  // Kartka pod punktem ekranu (albo najbliższa) i miejsce punktu na niej (ułamki szerokości i wysokości).
  kotwicaWPunkcie(punkt) {
    const kartki = [...this.el.querySelectorAll('.podglad-strona[data-id] .podglad-kartka')];
    if (!kartki.length) return null;
    const wewnatrz = (r) => punkt.x >= r.left && punkt.x <= r.right && punkt.y >= r.top && punkt.y <= r.bottom;
    let kartka = kartki.find((x) => wewnatrz(x.getBoundingClientRect()));
    if (!kartka) {
      let naj = Infinity;
      for (const x of kartki) {
        const r = x.getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - punkt.y) + Math.abs((r.left + r.right) / 2 - punkt.x) * 0.25;
        if (d < naj) { naj = d; kartka = x; }
      }
    }
    const r = kartka.getBoundingClientRect();
    return { kartka, fx: (punkt.x - r.left) / (r.width || 1), fy: (punkt.y - r.top) / (r.height || 1) };
  }

  // Dwuklik / podwójne stuknięcie: powiększa w tym miejscu, a powiększony podgląd wraca do dopasowania.
  przelaczPowiekszenie(punkt) {
    if (this.prezentacja) {
      if (this.prezentacja.zoom > 1.02) this._zoomPrezentacji(1, null, { animuj: true });
      else this._zoomPrezentacji(2.5, punkt, { animuj: true });
      return;
    }
    const dop = this.skalaDopasowania();
    this.skalaWPunkcie(this.skala > dop * 1.05 ? dop : dop * 2.5, punkt);
  }

  // ---------- Prezentacja: jedna strona albo rozkładówka naraz, na całym ekranie ----------

  get wPrezentacji() { return Boolean(this.prezentacja); }

  prezentuj() {
    if (!this.uklad || this.prezentacja) return;
    const kroki = this.uklad.sekcje.flatMap((sekcja) => sekcja.wiersze.map((strony) => ({ sekcja, strony })));
    if (!kroki.length) return;
    // Zaczynamy od strony, którą widać w środku okna podglądu.
    const srodek = this.el.getBoundingClientRect().top + this.el.clientHeight / 2;
    const widoczna = [...this.el.querySelectorAll('.podglad-strona[data-id]')].find((f) => f.getBoundingClientRect().bottom > srodek - 40);
    const start = Math.max(0, kroki.findIndex((k) => k.strony.some((s) => s && s.id === widoczna?.dataset.id)));

    const el = document.createElement('div');
    el.className = 'prezentacja';
    // Pasek w stylu odtwarzacza (#102): półprzezroczysta „pigułka” na dole – poprzednia/następna, numer strony,
    // powiększenie; zamknięcie to X w prawym górnym rogu. Na dotyku bez powiększenia (przybliża się palcami).
    // Pasek i X chowają się po chwili bez ruchu; wracają po ruchu myszy, stuknięciu albo klawiszu.
    el.innerHTML = '<div class="prezentacja-scena"></div>'
      + `<button type="button" class="prezentacja-strzalka wstecz" aria-label="Poprzednia strona">${ikona('wstecz', { rozmiar: 30 })}</button>`
      + `<button type="button" class="prezentacja-strzalka dalej" aria-label="Następna strona">${ikona('dalej', { rozmiar: 30 })}</button>`
      + `<button type="button" class="prezentacja-zamknij prezentacja-sterowanie" aria-label="Zamknij prezentację" title="Zamknij prezentację (Esc)">${ikona('zamknij', { rozmiar: 22 })}</button>`
      + '<div class="prezentacja-pasek prezentacja-sterowanie"><div class="prezentacja-pigulka">'
      + `<button type="button" class="prezentacja-krok wstecz" data-krok="-1" aria-label="Poprzednia strona" title="Poprzednia strona (←)">${ikona('wstecz', { rozmiar: 18 })}</button>`
      + '<span class="prezentacja-licznik" aria-live="polite"></span>'
      + `<button type="button" class="prezentacja-krok dalej" data-krok="1" aria-label="Następna strona" title="Następna strona (→)">${ikona('dalej', { rozmiar: 18 })}</button>`
      + '<div class="powiekszenie prezentacja-zoom" role="group" aria-label="Powiększenie">'
      + `<button type="button" class="powiekszenie-krok prezentacja-minus" aria-label="Pomniejsz" title="Pomniejsz (−)">${ikona('minus', { rozmiar: 16 })}</button>`
      + '<button type="button" class="wartosc-zoom prezentacja-wartosc" aria-label="Dopasuj do ekranu" title="Dopasuj do ekranu (0)">100%</button>'
      + `<button type="button" class="powiekszenie-krok prezentacja-plus" aria-label="Powiększ" title="Powiększ (+)">${ikona('plus', { rozmiar: 16 })}</button></div>`
      + '</div></div>';
    this.el.parentElement.append(el);
    const p = {
      el, kroki, i: start, zoom: 1, x: 0, y: 0,
    };
    this.prezentacja = p;
    p.klawisze = (e) => {
      p.pokazSterowanie?.();
      const pow = p.zoom > 1.02;
      const PRZESUN = 80;
      const przesuniecia = {
        ArrowLeft: [PRZESUN, 0], ArrowRight: [-PRZESUN, 0], ArrowUp: [0, PRZESUN], ArrowDown: [0, -PRZESUN],
      };
      if (['+', '='].includes(e.key)) this.powieksz(1.25);
      else if (['-', '_'].includes(e.key)) this.powieksz(0.8);
      else if (e.key === '0') this._zoomPrezentacji(1, null, { animuj: true });
      else if (pow && przesuniecia[e.key]) {
        const [dx, dy] = przesuniecia[e.key];
        this._przesunPrezentacje(p.x + dx, p.y + dy, { animuj: true });
      } else if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) this._krokPrezentacji(1);
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) this._krokPrezentacji(-1);
      else if (e.key === 'Home') this._krokPrezentacji(-p.i);
      else if (e.key === 'End') this._krokPrezentacji(kroki.length - 1 - p.i);
      else if (e.key === 'Escape') {
        // Najpierw powrót do dopasowania, dopiero potem zamknięcie.
        if (pow) this._zoomPrezentacji(1, null, { animuj: true }); else this.zamknijPrezentacje();
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    p.rozmiar = () => this._rysujPrezentacje();
    p.pelnyEkran = () => { if (!document.fullscreenElement && p.bylPelny) this.zamknijPrezentacje(); };
    document.addEventListener('keydown', p.klawisze, true);
    window.addEventListener('resize', p.rozmiar);
    document.addEventListener('fullscreenchange', p.pelnyEkran);
    for (const b of el.querySelectorAll('.prezentacja-strzalka.wstecz, .prezentacja-krok.wstecz')) b.addEventListener('click', () => this._krokPrezentacji(-1));
    for (const b of el.querySelectorAll('.prezentacja-strzalka.dalej, .prezentacja-krok.dalej')) b.addEventListener('click', () => this._krokPrezentacji(1));
    // Sterowanie chowa się po 2,5 s bez ruchu (na dotyku stuknięcie w scenę je pokazuje i chowa).
    p.pokazSterowanie = () => {
      el.classList.remove('bez-sterowania');
      clearTimeout(p.timerSterowania);
      p.timerSterowania = setTimeout(() => { if (!el.querySelector('.prezentacja-sterowanie:hover, .prezentacja-sterowanie :focus-visible')) el.classList.add('bez-sterowania'); }, 2500);
    };
    el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') p.pokazSterowanie(); });
    el.addEventListener('pointerdown', p.pokazSterowanie);
    el.addEventListener('keydown', p.pokazSterowanie);
    el.addEventListener('focusin', p.pokazSterowanie);
    p.pokazSterowanie();
    el.querySelector('.prezentacja-zamknij').addEventListener('click', () => this.zamknijPrezentacje());
    el.querySelector('.prezentacja-plus').addEventListener('click', () => this.powieksz(1.25));
    el.querySelector('.prezentacja-minus').addEventListener('click', () => this.powieksz(0.8));
    el.querySelector('.prezentacja-wartosc').addEventListener('click', () => this._zoomPrezentacji(1, null, { animuj: true }));
    p.gesty = gestyPrezentacji(this, p);
    // Pełny ekran, jeśli przeglądarka pozwala; bez niego prezentacja wypełnia okno.
    el.requestFullscreen?.().then(() => { p.bylPelny = true; }).catch(() => {});
    this._rysujPrezentacje();
  }

  // zPrzesuniecia: strona wjeżdża z tej strony, z której przyszło przesunięcie palcem.
  _krokPrezentacji(o, { zPrzesuniecia = false } = {}) {
    const p = this.prezentacja;
    const i = Math.min(p.kroki.length - 1, Math.max(0, p.i + o));
    if (i === p.i) return false;
    p.i = i;
    this._rysujPrezentacje();
    if (zPrzesuniecia && !bezRuchu()) {
      const u = p.el.querySelector('.prezentacja-uklad');
      u.classList.remove('animuje');
      u.style.transform = `translate(${o > 0 ? 40 : -40}%, 0)`;
      u.style.opacity = '0';
      u.getBoundingClientRect();
      u.classList.add('animuje');
      u.style.transform = '';
      u.style.opacity = '';
    }
    return true;
  }

  _rysujPrezentacje() {
    const p = this.prezentacja;
    if (!p) return;
    const { sekcja, strony } = p.kroki[p.i];
    const scena = p.el.querySelector('.prezentacja-scena');
    const skala = Math.min((scena.clientWidth - 32) / (strony.length * sekcja.w), (scena.clientHeight - 32) / sekcja.h);
    const szer = Math.min(MAKS_PX, Math.round(sekcja.w * skala * Math.max(2, window.devicePixelRatio || 1)));
    // Nowa strona – od dopasowania. Kartki stoją w jednym „układzie”, który powiększamy i przesuwamy transformacją.
    p.zoom = 1;
    p.x = 0;
    p.y = 0;
    p.skala = skala;
    p.szerBazowa = szer;
    const uklad = document.createElement('div');
    uklad.className = 'prezentacja-uklad';
    scena.replaceChildren(uklad);
    for (const s of strony) {
      const kartka = document.createElement('div');
      kartka.className = `prezentacja-kartka${s ? '' : ' pusta'}`;
      kartka.style.width = `${sekcja.w * skala}px`;
      kartka.style.height = `${sekcja.h * skala}px`;
      if (s) {
        // Do czasu narysowania strona jest białą kartką ze wskaźnikiem – nie pustym obrazkiem, który
        // przeglądarka pokazałaby jako „zepsuty obraz”. Jeśli ta strona jest już narysowana w siatce
        // podglądu, jej obraz pojawia się od razu i tylko wyostrza się po narysowaniu w pełnej wielkości.
        const img = document.createElement('img');
        img.alt = `Strona ${s.nr ?? ''} ${s.nazwa}`;
        img.draggable = false;
        img.dataset.px = szer;
        img._strona = s;
        const gotowy = this._obrazPrezentacji(s, szer, false);
        if (gotowy) img.src = gotowy;
        else {
          const zSiatki = this._obrazZSiatki(s);
          if (zSiatki) img.src = zSiatki; else kartka.classList.add('wczytuje');
          this._obrazPrezentacji(s, szer).then((url) => {
            // Obraz mógł zostać już podmieniony na ostrzejszy (powiększenie) – wtedy zostaje ostrzejszy.
            if (this.prezentacja !== p || !url || !img.isConnected || Number(img.dataset.px) > szer) return;
            img.src = url;
            kartka.classList.remove('wczytuje');
          });
        }
        kartka.append(img);
      }
      uklad.append(kartka);
    }
    this._przesunPrezentacje(0, 0);
    this._pokazZoomPrezentacji();
    // Sąsiednie kroki rysują się zawczasu – przewracanie stron nie czeka.
    for (const o of [1, -1]) {
      const k = p.kroki[p.i + o];
      if (k) for (const s of k.strony) if (s) this._obrazPrezentacji(s, szer);
    }
    const numery = strony.filter(Boolean).map((s) => s.nr ?? '–').join('–');
    p.el.querySelector('.prezentacja-licznik').textContent = `${sekcja.nazwa} · str. ${numery} · ${p.i + 1} z ${p.kroki.length}`;
    for (const b of p.el.querySelectorAll('.wstecz')) b.disabled = p.i === 0;
    for (const b of p.el.querySelectorAll('.dalej')) b.disabled = p.i === p.kroki.length - 1;
  }

  // ---------- Powiększanie prezentacji ----------

  // zoom: 1 = dopasowanie do ekranu. punkt (współrzędne ekranu) zostaje w miejscu; bez punktu – środek.
  _zoomPrezentacji(zoom, punkt = null, { animuj = false, ostrz = true } = {}) {
    const p = this.prezentacja;
    if (!p) return;
    const nowy = Math.min(ZOOM_MAKS, Math.max(1, zoom));
    const scena = p.el.querySelector('.prezentacja-scena').getBoundingClientRect();
    const cx = scena.left + scena.width / 2;
    const cy = scena.top + scena.height / 2;
    const pt = punkt || { x: cx, y: cy };
    // Punkt względem środka układu przed zmianą – po zmianie ma być w tym samym miejscu ekranu.
    const lx = (pt.x - cx - p.x) / p.zoom;
    const ly = (pt.y - cy - p.y) / p.zoom;
    p.zoom = nowy;
    this._przesunPrezentacje(pt.x - cx - lx * nowy, pt.y - cy - ly * nowy, { animuj });
    this._pokazZoomPrezentacji();
    if (ostrz) this._ostrzPrezentacje();
  }

  // Przesunięcie powiększonego układu, ograniczone do krawędzi stron. Zwraca, czy oparło się o krawędź.
  _przesunPrezentacje(x, y, { animuj = false, bezGranic = false } = {}) {
    const p = this.prezentacja;
    const u = p?.el.querySelector('.prezentacja-uklad');
    if (!u) return false;
    const { sekcja, strony } = p.kroki[p.i];
    const scena = p.el.querySelector('.prezentacja-scena');
    const mx = Math.max(0, (strony.length * sekcja.w * p.skala * p.zoom - scena.clientWidth) / 2 + 16);
    const my = Math.max(0, (sekcja.h * p.skala * p.zoom - scena.clientHeight) / 2 + 16);
    const nx = bezGranic ? x : Math.min(mx, Math.max(-mx, x));
    const ny = bezGranic ? y : Math.min(my, Math.max(-my, y));
    p.x = nx;
    p.y = ny;
    u.classList.toggle('animuje', animuj && !bezRuchu());
    u.style.transform = `translate(${nx}px, ${ny}px) scale(${p.zoom})`;
    return nx !== x || ny !== y;
  }

  _pokazZoomPrezentacji() {
    const p = this.prezentacja;
    if (!p) return;
    p.el.querySelector('.prezentacja-wartosc').textContent = `${Math.round(p.zoom * 100)}%`;
    p.el.querySelector('.prezentacja-minus').disabled = p.zoom <= 1.001;
    p.el.querySelector('.prezentacja-plus').disabled = p.zoom >= ZOOM_MAKS - 0.001;
    p.el.classList.toggle('powiekszona', p.zoom > 1.02);
  }

  // Po powiększeniu strona rysuje się w rozdzielczości, która jest ostra przy tym powiększeniu
  // (powiększenie × gęstość pikseli ekranu, najwyżej MAKS_PX_ZOOM). Do tego czasu widać obraz rozciągnięty.
  _ostrzPrezentacje() {
    const p = this.prezentacja;
    if (!p || this.zrodlo.stale) return; // gotowe obrazy z linku mają jedną rozdzielczość
    clearTimeout(p.timerOstrosci);
    p.timerOstrosci = setTimeout(() => {
      if (this.prezentacja !== p) return;
      const { sekcja } = p.kroki[p.i];
      const potrzeba = Math.round(sekcja.w * p.skala * p.zoom * (window.devicePixelRatio || 1));
      if (potrzeba <= p.szerBazowa * 1.1) return;
      // Szerokości w krokach (×1,5) – sąsiednie powiększenia korzystają z tego samego obrazu.
      let szer = p.szerBazowa;
      while (szer < potrzeba && szer < MAKS_PX_ZOOM) szer = Math.min(MAKS_PX_ZOOM, Math.round(szer * 1.5));
      const krok = p.i;
      for (const img of p.el.querySelectorAll('.prezentacja-kartka img')) {
        if (!img._strona || Number(img.dataset.px) >= szer) continue;
        this._obrazOstry(img._strona, szer).then((url) => {
          if (this.prezentacja !== p || p.i !== krok || !url || Number(img.dataset.px) >= szer || !img.isConnected) return;
          // Podmiana dopiero, gdy ostry obraz jest gotowy do pokazania – bez mignięcia.
          const nowy = new Image();
          nowy.onload = () => {
            if (!img.isConnected || Number(img.dataset.px) >= szer) return;
            img.src = url;
            img.dataset.px = szer;
            img.closest('.prezentacja-kartka')?.classList.remove('wczytuje');
          };
          nowy.src = url;
        });
      }
    }, 220);
  }

  // Duże obrazy powiększeń: osobna, mała pamięć (kilka ostatnich), żeby nie trzymać wielu ogromnych obrazów.
  _obrazOstry(s, szer) {
    this._pamiecOstrych ||= new Map();
    const klucz = `${s.id}|${szer}|${this.zrodlo.odcisk?.(s) ?? ''}`;
    let o = this._pamiecOstrych.get(klucz);
    if (!o) {
      while (this._pamiecOstrych.size >= 6) this._pamiecOstrych.delete(this._pamiecOstrych.keys().next().value);
      o = Promise.resolve(this.zrodlo.obraz(s, szer)).catch(() => { this._pamiecOstrych.delete(klucz); return null; });
      this._pamiecOstrych.set(klucz, o);
    }
    return o;
  }

  // Obraz strony do prezentacji z pamięci (ta sama strona, ta sama szerokość i ten sam skrót treści).
  // czekaj = false: tylko gotowy adres albo null.
  _obrazPrezentacji(s, szer, czekaj = true) {
    this._pamiecPrezentacji ||= new Map();
    const klucz = `${s.id}|${szer}|${this.zrodlo.odcisk?.(s) ?? ''}`;
    let wpis = this._pamiecPrezentacji.get(klucz);
    if (!wpis) {
      if (this._pamiecPrezentacji.size > 40) this._pamiecPrezentacji.delete(this._pamiecPrezentacji.keys().next().value);
      wpis = { url: null };
      wpis.obietnica = Promise.resolve(this.zrodlo.obraz(s, szer)).then((url) => { wpis.url = url; return url; }, () => {
        this._pamiecPrezentacji.delete(klucz); // nieudane rysowanie – następnym razem od nowa
        return null;
      });
      this._pamiecPrezentacji.set(klucz, wpis);
    }
    return czekaj ? wpis.obietnica : wpis.url;
  }

  _obrazZSiatki(s) {
    const fig = [...this.el.querySelectorAll('.podglad-strona[data-id]')].find((f) => f.dataset.id === s.id);
    return fig?.querySelector('img')?.getAttribute('src') || null;
  }

  zamknijPrezentacje() {
    const p = this.prezentacja;
    if (!p) return;
    this.prezentacja = null;
    clearTimeout(p.timerOstrosci);
    clearTimeout(p.timerSterowania);
    p.gesty?.odlacz();
    document.removeEventListener('keydown', p.klawisze, true);
    window.removeEventListener('resize', p.rozmiar);
    document.removeEventListener('fullscreenchange', p.pelnyEkran);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    p.el.remove();
  }
}

// Safari na iPhonie i iPadzie powiększa przy szczypaniu całą stronę (z napisami i paskami) mimo touch-action
// i preventDefault na touchmove – trzeba zatrzymać jego własne zdarzenia gestów. W podglądzie i prezentacji
// powiększamy sami: rosną tylko strony, napisy i paski zostają (decyzja #101).
if (typeof document !== 'undefined' && !document.__bezGestowSafari) {
  document.__bezGestowSafari = true;
  const zatrzymaj = (e) => { if (e.target?.closest?.('.podglad-tresc, .prezentacja')) e.preventDefault(); };
  for (const zdarzenie of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(zdarzenie, zatrzymaj, { passive: false });
}

// ---------- Siatka podglądu: kółko, dwuklik, przeciąganie i szczypanie ----------
// Jeden zestaw zdarzeń na element (własny podgląd i podgląd z linku dzielą #podglad-tresc); działa na podgląd,
// który jest akurat pokazany (aktywny), a w prezentacji ustępuje jej własnym gestom.

let ostatnieStukniecie = 0; // podwójne stuknięcie obsłużone ręcznie – przeglądarka może dorzucić własny dwuklik

function podlaczGesty(el) {
  if (!el || el.dataset.gesty) return;
  el.dataset.gesty = '1';
  const ten = () => (aktywny && aktywny.el === el && !aktywny.prezentacja ? aktywny : null);

  // Ctrl + kółko (także szczypanie na gładziku – przeglądarka podaje je jako Ctrl + kółko): powiększenie
  // w miejscu kursora. Samo kółko przewija jak zwykle.
  el.addEventListener('wheel', (e) => {
    const p = ten();
    if (!p || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const d = Math.max(-60, Math.min(60, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
    p.powieksz(Math.exp(-d * 0.01), { x: e.clientX, y: e.clientY });
  }, { passive: false });

  // Dwuklik: powiększenie w tym miejscu / powrót do dopasowania. Klikalna strona własnego projektu prowadzi
  // pojedynczym kliknięciem do edycji – tam dwuklik działa na tle między stronami.
  el.addEventListener('dblclick', (e) => {
    const p = ten();
    if (!p || e.target.closest('button.podglad-kartka') || performance.now() - ostatnieStukniecie < 600) return;
    e.preventDefault();
    p.przelaczPowiekszenie({ x: e.clientX, y: e.clientY });
  });

  // Myszą: przy powiększeniu przeciąganie przesuwa podgląd. Kliknięcie po przeciągnięciu nie otwiera strony.
  let ciag = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !ten() || !el.classList.contains('powiekszony')) return;
    ciag = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, ruszony: false };
  });
  el.addEventListener('pointermove', (e) => {
    if (!ciag || e.pointerId !== ciag.id) return;
    const dx = e.clientX - ciag.x;
    const dy = e.clientY - ciag.y;
    if (!ciag.ruszony && Math.hypot(dx, dy) < 5) return;
    if (!ciag.ruszony) {
      ciag.ruszony = true;
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('przeciaga');
    }
    el.scrollLeft = ciag.sl - dx;
    el.scrollTop = ciag.st - dy;
  });
  const bezKliku = (k) => { k.stopPropagation(); k.preventDefault(); };
  const puszczony = (e) => {
    if (!ciag || e.pointerId !== ciag.id) return;
    if (ciag.ruszony) {
      el.classList.remove('przeciaga');
      el.addEventListener('click', bezKliku, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', bezKliku, { capture: true }), 0);
    }
    ciag = null;
  };
  el.addEventListener('pointerup', puszczony);
  el.addEventListener('pointercancel', puszczony);

  // Dotyk: jednym palcem przewija przeglądarka (płynnie, z bezwładnością); dwoma – szczypanie powiększa,
  // a punkt strony między palcami idzie za palcami. Natywne powiększanie całej strony jest tu wyłączone (CSS).
  let szczyp = null;
  const punkty = (lista) => [...lista].slice(0, 2).map((t) => ({ x: t.clientX, y: t.clientY }));
  el.addEventListener('touchstart', (e) => {
    const p = ten();
    if (!p || e.touches.length !== 2) return;
    const [a, b] = punkty(e.touches);
    szczyp = { d0: odl(a, b) || 1, s0: p.skala, kotwica: p.kotwicaWPunkcie(srodekPunktow(a, b)), klatka: 0 };
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const p = ten();
    if (!p || !szczyp || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = punkty(e.touches);
    const srodek = srodekPunktow(a, b);
    const skala = szczyp.s0 * (odl(a, b) / szczyp.d0);
    const { kotwica } = szczyp;
    cancelAnimationFrame(szczyp.klatka);
    szczyp.klatka = requestAnimationFrame(() => p.skalaWPunkcie(skala, srodek, { rysuj: false, kotwica }));
  }, { passive: false });
  const koniecSzczypania = (e) => {
    if (!szczyp || e.touches.length >= 2) return;
    cancelAnimationFrame(szczyp.klatka);
    szczyp = null;
    const p = ten();
    if (p) p.ustawSkale(p.skala); // strony dorysowują się w nowej rozdzielczości
  };
  el.addEventListener('touchend', koniecSzczypania);
  el.addEventListener('touchcancel', koniecSzczypania);

  // Podwójne stuknięcie palcem: jak dwuklik (poza klikalnymi stronami – stuknięcie w nią otwiera edycję).
  let stukniecie = null;
  el.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || !ten() || e.target.closest('button.podglad-kartka')) return;
    const teraz = performance.now();
    const pt = { x: e.clientX, y: e.clientY };
    if (stukniecie && teraz - stukniecie.t < 320 && odl(stukniecie, pt) < 40) {
      stukniecie = null;
      ostatnieStukniecie = teraz;
      ten().przelaczPowiekszenie(pt);
      return;
    }
    stukniecie = { ...pt, t: teraz };
  });
}

// Klawiatura w siatce podglądu: Ctrl + / Ctrl − / Ctrl 0 (zamiast powiększania całej strony przeglądarki),
// Esc przy powiększeniu najpierw wraca do dopasowania. W prezentacji – jej własne klawisze.
if (typeof document !== 'undefined' && !document.documentElement.dataset.klawiszePodgladu) {
  document.documentElement.dataset.klawiszePodgladu = '1';
  document.addEventListener('keydown', (e) => {
    const p = aktywny;
    if (!p || p.prezentacja || document.body.dataset.ekran !== 'podglad' || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape' && p.el.classList.contains('powiekszony')) {
      p.dopasuj();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (['+', '='].includes(e.key)) p.powieksz(1.25);
    else if (['-', '_'].includes(e.key)) p.powieksz(0.8);
    else if (e.key === '0') p.dopasuj();
    else return;
    e.preventDefault();
  }, true);
}

// ---------- Prezentacja: gesty ----------
// Wskaźniki (mysz, palce, rysik) na scenie prezentacji. Bez powiększenia: przesunięcie palcem w bok przewraca
// stronę (strona idzie za palcem), w dół – zamyka prezentację, stuknięcie przy krawędzi – strona dalej/wstecz.
// Powiększona: palec albo mysz przesuwa stronę (z bezwładnością), dwa palce – szczypanie. Podwójne stuknięcie
// albo dwuklik – powiększenie w tym miejscu / dopasowanie. Ctrl + kółko powiększa, samo kółko przesuwa.
function gestyPrezentacji(pg, p) {
  const scena = p.el.querySelector('.prezentacja-scena');
  const wskazniki = new Map();
  let gest = null;
  let tapniecie = null;
  let pojedyncze = 0;
  let bezwladnosc = 0;
  const uklad = () => p.el.querySelector('.prezentacja-uklad');
  const srodekSceny = () => {
    const r = scena.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };
  const predkosc = (g) => {
    const ost = g.ostatnie.filter((o) => performance.now() - o.t < 120);
    if (ost.length < 2) return { vx: 0, vy: 0 };
    const a = ost[0];
    const b = ost[ost.length - 1];
    const dt = Math.max(1, b.t - a.t);
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
  };
  const powrot = () => {
    const u = uklad();
    if (u) u.style.opacity = '';
    pg._przesunPrezentacje(0, 0, { animuj: true });
  };
  const inercja = (g) => {
    let { vx, vy } = predkosc(g);
    if (bezRuchu() || Math.hypot(vx, vy) < 0.05) { pg._ostrzPrezentacje(); return; }
    let t = performance.now();
    const krok = (teraz) => {
      if (pg.prezentacja !== p) return;
      const dt = Math.min(40, teraz - t);
      t = teraz;
      const tlum = 0.95 ** (dt / 16);
      vx *= tlum;
      vy *= tlum;
      pg._przesunPrezentacje(p.x + vx * dt, p.y + vy * dt);
      if (Math.hypot(vx, vy) > 0.02) bezwladnosc = requestAnimationFrame(krok);
      else pg._ostrzPrezentacje();
    };
    bezwladnosc = requestAnimationFrame(krok);
  };
  const stukniecie = (pt, mysz) => {
    const teraz = performance.now();
    if (tapniecie && teraz - tapniecie.t < 320 && odl(tapniecie, pt) < 40) {
      clearTimeout(pojedyncze);
      tapniecie = null;
      pg.przelaczPowiekszenie(pt);
      return;
    }
    tapniecie = { ...pt, t: teraz };
    if (mysz) return; // myszą strony przewracają strzałki i klawiatura
    // Dotyk: stuknięcie przy krawędzi przewraca stronę – po chwili, żeby nie przeszkodzić podwójnemu stuknięciu.
    clearTimeout(pojedyncze);
    pojedyncze = setTimeout(() => {
      if (pg.prezentacja !== p || p.zoom > 1.02) return;
      const r = scena.getBoundingClientRect();
      if (pt.x < r.left + r.width * 0.25) pg._krokPrezentacji(-1);
      else if (pt.x > r.right - r.width * 0.25) pg._krokPrezentacji(1);
    }, 330);
  };

  const wcisniety = (e) => {
    if (e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    cancelAnimationFrame(bezwladnosc);
    scena.setPointerCapture?.(e.pointerId);
    wskazniki.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (wskazniki.size === 2) {
      const [a, b] = [...wskazniki.values()];
      gest = {
        typ: 'szczyp', d0: odl(a, b) || 1, z0: p.zoom, m0: srodekPunktow(a, b), x0: p.x, y0: p.y,
      };
    } else if (wskazniki.size === 1) {
      gest = {
        typ: 'jeden', start: { x: e.clientX, y: e.clientY }, x0: p.x, y0: p.y, mysz: e.pointerType === 'mouse',
        ostatnie: [{ x: e.clientX, y: e.clientY, t: performance.now() }], ruszony: false, kierunek: null,
      };
    }
  };
  const ruch = (e) => {
    if (!wskazniki.has(e.pointerId)) return;
    wskazniki.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gest?.typ === 'szczyp' && wskazniki.size >= 2) {
      const [a, b] = [...wskazniki.values()];
      const m = srodekPunktow(a, b);
      const z = Math.min(ZOOM_MAKS, Math.max(1, gest.z0 * (odl(a, b) / gest.d0)));
      const { cx, cy } = srodekSceny();
      // Punkt strony, który był między palcami na początku, zostaje między palcami.
      const lx = (gest.m0.x - cx - gest.x0) / gest.z0;
      const ly = (gest.m0.y - cy - gest.y0) / gest.z0;
      p.zoom = z;
      pg._przesunPrezentacje(m.x - cx - lx * z, m.y - cy - ly * z);
      pg._pokazZoomPrezentacji();
      return;
    }
    if (gest?.typ !== 'jeden') return;
    const dx = e.clientX - gest.start.x;
    const dy = e.clientY - gest.start.y;
    if (!gest.ruszony && Math.hypot(dx, dy) < 8) return;
    if (!gest.ruszony) p.el.classList.add('przeciaga');
    gest.ruszony = true;
    gest.ostatnie.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (gest.ostatnie.length > 8) gest.ostatnie.shift();
    if (p.zoom > 1.02) { pg._przesunPrezentacje(gest.x0 + dx, gest.y0 + dy); return; }
    if (gest.mysz) return;
    gest.kierunek ||= Math.abs(dx) >= Math.abs(dy) ? 'poziom' : 'pion';
    const u = uklad();
    if (!u) return;
    u.classList.remove('animuje');
    if (gest.kierunek === 'poziom') {
      // Na pierwszej i ostatniej stronie strona stawia opór.
      const opor = (dx > 0 && p.i === 0) || (dx < 0 && p.i === p.kroki.length - 1) ? 0.3 : 1;
      u.style.transform = `translate(${dx * opor}px, 0)`;
    } else if (dy > 0) {
      u.style.transform = `translate(0, ${dy * 0.6}px) scale(${1 - Math.min(0.15, dy / 2000)})`;
      u.style.opacity = String(Math.max(0.4, 1 - dy / 600));
    }
  };
  const puszczony = (e) => {
    if (!wskazniki.has(e.pointerId)) return;
    wskazniki.delete(e.pointerId);
    p.el.classList.remove('przeciaga');
    if (gest?.typ === 'szczyp') {
      if (wskazniki.size === 1) {
        // Jeden palec został – dalej przesuwa powiększoną stronę.
        const [r] = [...wskazniki.values()];
        gest = {
          typ: 'jeden', start: r, x0: p.x, y0: p.y, mysz: false, ostatnie: [], ruszony: true, kierunek: null,
        };
      } else {
        gest = null;
        if (p.zoom < 1.05) pg._zoomPrezentacji(1, null, { animuj: true }); else pg._ostrzPrezentacje();
      }
      return;
    }
    if (gest?.typ !== 'jeden' || wskazniki.size) return;
    const g = gest;
    gest = null;
    if (e.type === 'pointercancel') { if (p.zoom <= 1.02) powrot(); return; }
    const pt = { x: e.clientX, y: e.clientY };
    if (!g.ruszony) { stukniecie(pt, g.mysz); return; }
    if (p.zoom > 1.02) { inercja(g); return; }
    if (g.mysz) return;
    const dx = pt.x - g.start.x;
    const dy = pt.y - g.start.y;
    const { vx, vy } = predkosc(g);
    const w = scena.clientWidth;
    if (g.kierunek === 'poziom') {
      const dalej = dx < -w * 0.2 || (dx < -30 && vx < -0.5);
      const wstecz = dx > w * 0.2 || (dx > 30 && vx > 0.5);
      if (dalej && pg._krokPrezentacji(1, { zPrzesuniecia: true })) return;
      if (wstecz && pg._krokPrezentacji(-1, { zPrzesuniecia: true })) return;
    } else if (dy > 120 || (dy > 40 && vy > 0.8)) {
      pg.zamknijPrezentacje();
      return;
    }
    powrot();
  };
  const kolko = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const d = Math.max(-60, Math.min(60, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
      pg._zoomPrezentacji(p.zoom * Math.exp(-d * 0.01), { x: e.clientX, y: e.clientY });
      return;
    }
    if (p.zoom > 1.02) {
      pg._przesunPrezentacje(p.x - e.deltaX, p.y - e.deltaY);
      pg._ostrzPrezentacje();
    }
  };

  scena.addEventListener('pointerdown', wcisniety);
  scena.addEventListener('pointermove', ruch);
  scena.addEventListener('pointerup', puszczony);
  scena.addEventListener('pointercancel', puszczony);
  p.el.addEventListener('wheel', kolko, { passive: false });
  return {
    odlacz() {
      clearTimeout(pojedyncze);
      cancelAnimationFrame(bezwladnosc);
    },
  };
}
