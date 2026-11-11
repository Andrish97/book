// Panele jako arkusze z dołu ekranu (telefon i wąskie okno, do 860 px szerokości).
//
// - Uchwyt u góry arkusza: przeciągnięcie w dół zamyka arkusz (z powiększonego – wraca do zwykłej wysokości),
//   w górę powiększa arkusz właściwości prawie na cały ekran, stuknięcie przełącza tę wysokość.
//   Arkusz zamyka też ponowne stuknięcie jego zakładki w dolnym menu (kontekst.js: ustawPanel).
// - Pasek wstawiania przewijany w bok pokazuje to wygaszonym brzegiem.
// - Otwarty arkusz zasłania dół płótna, więc widok przesuwa się tak, żeby zaznaczony element był widoczny
//   nad arkuszem (a gdy się nie mieści – pomniejsza). Po zamknięciu arkusza widok wraca na swoje miejsce.

import { $, $$ } from '../ui.js';
import { edytor, ustawPanel } from './kontekst.js';

const waski = window.matchMedia('(max-width: 860px)');
const MARGINES = 10; // odstęp elementu od krawędzi widocznego obszaru (px)

const otwartyArkusz = () => {
  const p = document.body.dataset.panel;
  if (!waski.matches || !p) return null;
  return p === 'strony' ? $('#panel-strony') : $('#panel-inspektor');
};

// ---------- Uchwyt ----------

function podlaczUchwyt(panel) {
  const uchwyt = $('.uchwyt-arkusza', panel);
  const powiekszany = panel.id === 'panel-inspektor';
  let ruch = null;
  const przelacz = () => {
    if (!powiekszany) { ustawPanel(''); return; }
    ustawWysokosc(document.body.dataset.arkusz === 'pelny' ? '' : 'pelny');
  };

  const koniec = () => {
    panel.classList.remove('ciagniety');
    panel.style.transform = '';
    panel.style.height = '';
    ruch = null;
  };
  uchwyt.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    ruch = { y: e.clientY, wysokosc: panel.offsetHeight, przesuniety: false };
    uchwyt.setPointerCapture?.(e.pointerId);
  });
  uchwyt.addEventListener('pointermove', (e) => {
    if (!ruch) return;
    const dy = e.clientY - ruch.y;
    if (!ruch.przesuniety && Math.abs(dy) < 6) return;
    ruch.przesuniety = true;
    panel.classList.add('ciagniety'); // bez animacji – arkusz idzie za palcem
    if (dy > 0) {
      panel.style.transform = `translateY(${dy}px)`;
      panel.style.height = '';
    } else if (powiekszany) {
      panel.style.transform = '';
      panel.style.height = `${Math.min(ruch.wysokosc - dy, wysokoscPelna())}px`;
    }
  });
  const pusc = (e) => {
    if (!ruch) return;
    const { przesuniety, wysokosc } = ruch;
    const dy = e.clientY - ruch.y;
    koniec();
    if (e.type === 'pointercancel') return;
    // Stuknięcie (bez przesunięcia): arkusz właściwości zmienia wysokość, arkusz stron się zamyka. Liczone tu,
    // nie w „click” – po przeciągnięciu przeglądarka potrafi chwilę nie wysyłać kliknięć po stuknięciu.
    if (!przesuniety) { przelacz(); return; }
    const pelny = document.body.dataset.arkusz === 'pelny';
    if (dy > 50) {
      // Z powiększonego arkusza krótkie pociągnięcie w dół wraca do zwykłej wysokości, dłuższe zamyka.
      if (pelny && dy < wysokosc / 2) ustawWysokosc('');
      else ustawPanel('');
    } else if (dy < -40 && powiekszany) {
      ustawWysokosc('pelny');
    }
  };
  uchwyt.addEventListener('pointerup', pusc);
  uchwyt.addEventListener('pointercancel', pusc);
  // Z klawiatury (Enter / spacja – kliknięcie bez wskaźnika) uchwyt działa jak stuknięcie.
  uchwyt.addEventListener('click', (e) => { if (e.detail === 0) przelacz(); });
}

function wysokoscPelna() {
  const pasek = $('#ekran-edytora > :first-child').getBoundingClientRect().bottom;
  return $('.zakladki-mobilne').getBoundingClientRect().top - pasek;
}

function ustawWysokosc(tryb) {
  document.body.dataset.arkusz = tryb;
  // Wysokość zmienia się z animacją – widok dopasowujemy do nowej, docelowej wysokości.
  requestAnimationFrame(() => pokazZaznaczenie());
}

// ---------- Widok nad arkuszem ----------

let zapamietany = null; // widok sprzed otwarcia arkusza: { zoom, x, y, nasZoom }

// Obszar płótna (w px okna) widoczny między paskiem narzędzi a arkuszem.
function obszarWidoczny(panel) {
  const k = edytor.kontener.getBoundingClientRect();
  const pasek = $('#pasek-narzedzi').getBoundingClientRect();
  const dol = $('.zakladki-mobilne').getBoundingClientRect().top - panel.offsetHeight;
  return {
    lewo: k.left + MARGINES, prawo: k.right - MARGINES,
    gora: Math.max(k.top, pasek.bottom) + MARGINES, dol: Math.min(k.bottom, dol) - MARGINES,
  };
}

// Prostokąt zaznaczenia (albo całej strony) w px okna.
function prostokatCelu() {
  const c = edytor.canvas;
  const v = c.viewportTransform;
  const r = c.upperCanvasEl.getBoundingClientRect();
  const o = edytor.aktywny;
  let b;
  if (o) {
    o.setCoords();
    b = o.getBoundingRect();
  } else {
    b = { left: 0, top: 0, width: edytor.szerokoscArkusza, height: edytor.wydruk.wysokosc_mm };
  }
  return {
    lewo: r.left + v[4] + b.left * v[0], gora: r.top + v[5] + b.top * v[3],
    szer: b.width * v[0], wys: b.height * v[3], strona: !o,
  };
}

// Zapas pod płótnem: bez niego dołu strony nie dałoby się przewinąć nad arkusz.
function ustawZapas(panel) {
  const arkusz = edytor.kontener.firstElementChild;
  arkusz.style.paddingBottom = panel ? `${panel.offsetHeight + 72}px` : '';
}

function pokazZaznaczenie() {
  const panel = otwartyArkusz();
  if (!panel || !edytor?.wydruk || document.body.dataset.ekran !== 'edytor') return;
  const k = edytor.kontener;
  if (!zapamietany) zapamietany = { zoom: edytor.zoom, x: k.scrollLeft, y: k.scrollTop, nasZoom: null };
  ustawZapas(panel);
  let o = obszarWidoczny(panel);
  let cel = prostokatCelu();
  const wysObszaru = o.dol - o.gora;
  const szerObszaru = o.prawo - o.lewo;
  if (wysObszaru < 40) return;
  // Zaznaczony element większy niż widoczny obszar – pomniejszamy widok (nigdy nie powiększamy).
  if (!cel.strona && (cel.wys > wysObszaru || cel.szer > szerObszaru)) {
    const skala = Math.min(wysObszaru / cel.wys, szerObszaru / cel.szer);
    edytor.ustawZoom(edytor.zoom * skala);
    zapamietany.nasZoom = edytor.zoom;
    ustawZapas(panel);
    o = obszarWidoczny(panel);
    cel = prostokatCelu();
  }
  const caly = cel.gora >= o.gora && cel.gora + cel.wys <= o.dol && cel.lewo >= o.lewo && cel.lewo + cel.szer <= o.prawo;
  if (caly) return;
  let dy;
  if (cel.wys <= o.dol - o.gora) dy = cel.gora + cel.wys / 2 - (o.gora + o.dol) / 2; // na środek obszaru
  else dy = cel.gora - o.gora; // sama strona, wyższa niż obszar: jej góra tuż pod paskiem narzędzi
  let dx = 0;
  if (cel.lewo < o.lewo || cel.lewo + cel.szer > o.prawo) dx = cel.lewo + cel.szer / 2 - (o.lewo + o.prawo) / 2;
  k.scrollTop += dy;
  k.scrollLeft += dx;
}

function przywrocWidok() {
  const z = zapamietany;
  zapamietany = null;
  ustawZapas(null);
  if (!z || !edytor) return;
  // Widok wraca, o ile w międzyczasie nie został zmieniony ręcznie (inne powiększenie).
  if (z.nasZoom !== null) {
    if (Math.abs(edytor.zoom - z.nasZoom) > 1e-6) return;
    edytor.ustawZoom(z.zoom);
  } else if (Math.abs(edytor.zoom - z.zoom) > 1e-6) {
    return;
  }
  edytor.kontener.scrollLeft = z.x;
  edytor.kontener.scrollTop = z.y;
}

// Pasek wstawiania, który nie mieści się w szerokości ekranu, przewija się w bok; brzeg z ukrytymi
// przyciskami gaśnie (klasy dalej-lewo / dalej-prawo), żeby było widać, że jest coś dalej.
function podlaczPasekWstawiania() {
  const p = $('#pasek-narzedzi');
  const odswiez = () => {
    const zapas = p.scrollWidth - p.clientWidth;
    p.classList.toggle('dalej-prawo', zapas > 1 && p.scrollLeft < zapas - 1);
    p.classList.toggle('dalej-lewo', zapas > 1 && p.scrollLeft > 1);
  };
  p.addEventListener('scroll', odswiez, { passive: true });
  new ResizeObserver(odswiez).observe(p);
  odswiez();
}

export function podlaczArkusze() {
  podlaczPasekWstawiania();
  $$('.panel').forEach(podlaczUchwyt);
  let poprzedni = document.body.dataset.panel || '';
  new MutationObserver(() => {
    const teraz = document.body.dataset.panel || '';
    if (teraz === poprzedni) return;
    poprzedni = teraz;
    if (!waski.matches) return;
    if (teraz) {
      // Arkusz zawsze otwiera się od początku treści – nagłówek i zakładki widać w całości.
      const panel = otwartyArkusz();
      $$('.wlasciwosci, .sekcja-ostrzezen, .lista-stron', panel).forEach((el) => { el.scrollTop = 0; });
      panel.scrollTop = 0;
      requestAnimationFrame(() => pokazZaznaczenie());
    } else {
      przywrocWidok();
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['data-panel'] });
  edytor.addEventListener('zaznaczenie', () => { if (otwartyArkusz()) requestAnimationFrame(() => pokazZaznaczenie()); });
  waski.addEventListener('change', () => { if (!waski.matches) { ustawZapas(null); zapamietany = null; } });
}
