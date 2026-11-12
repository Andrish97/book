/* global HTMLDialogElement */
// Okna dialogowe jako zasłonki na telefonie i tablecie (js/urzadzenie.js: atrybut data-zaslonka na <html>).
//
// Na komputerze okno zostaje zwykłym oknem na środku, z krzyżykiem. Na telefonie i tablecie wyjeżdża od dołu
// ekranu jako zasłonka: zaokrąglona tylko u góry, na telefonie na całą szerokość, na tablecie szeroka.
// Krzyżyk jest wtedy ukryty, a u góry jest paseczek (uchwyt). Zasłonkę zamyka:
//   – pociągnięcie uchwytu (albo nagłówka okna) w dół albo samo stuknięcie uchwytu,
//   – stuknięcie w przyciemnione tło poza zasłonką (tylko gdy dotknięcie zaczęło się na tle),
//   – Esc (jak dotąd).
// Uchwyt i tło robią dokładnie to samo co krzyżyk danego okna (klikają go), a w oknie bez krzyżyka – to
// samo co Esc (zdarzenie „cancel”, które okno może wstrzymać, np. pytanie o konflikt zmian). Logika
// zamykania okien (zapis w oknie Dane, „nie” w potwierdzeniu) zostaje więc ta sama.
//
// Uchwyt dokłada się sam do każdego <dialog> na stronie – w index.html nic nie trzeba dopisywać.

import { czyZaslonka } from './urzadzenie.js';

const bezRuchu = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const otwarte = new Set();

// Zamyka okno tak, jak zrobiłby to jego krzyżyk (albo Esc, gdy krzyżyka nie ma).
export function zamknijJakX(dlg) {
  const x = dlg.querySelector('.x-okna');
  if (x) { x.click(); return; }
  const anuluj = new Event('cancel', { cancelable: true });
  if (dlg.dispatchEvent(anuluj)) dlg.close();
}

// Zjazd w dół, potem zamknięcie. Gdy okno się nie zamknęło (np. wstrzymało „cancel”), wraca na miejsce.
function zamknijZasuwajac(dlg) {
  if (bezRuchu()) { zamknijJakX(dlg); wrocNaMiejsce(dlg); return; }
  dlg.classList.remove('zaslonka-ciagnieta', 'zaslonka-wraca', 'zaslonka-wjazd');
  dlg.classList.add('zaslonka-zjazd');
  setTimeout(() => {
    zamknijJakX(dlg);
    dlg.classList.remove('zaslonka-zjazd');
    if (dlg.open) wrocNaMiejsce(dlg);
    else dlg.style.removeProperty('--zaslonka-ciag');
  }, 190);
}

function wrocNaMiejsce(dlg) {
  dlg.classList.remove('zaslonka-ciagnieta');
  dlg.classList.add('zaslonka-wraca');
  dlg.style.setProperty('--zaslonka-ciag', '0px');
  setTimeout(() => dlg.classList.remove('zaslonka-wraca'), 240);
}

// Pociąganie w dół: uchwyt albo nagłówek okna (poza przyciskami i polami).
function podlaczCiagniecie(dlg, uchwyt) {
  let ruch = null;
  const start = (e) => {
    if (!czyZaslonka() || e.button > 0) return;
    const zUchwytu = uchwyt.contains(e.target);
    if (!zUchwytu && e.target.closest('button, input, select, textarea, a, label, [contenteditable]')) return;
    ruch = { y: e.clientY, ostatnieY: e.clientY, czas: e.timeStamp, predkosc: 0, przesuniety: false, zUchwytu, el: e.currentTarget };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const przesun = (e) => {
    if (!ruch) return;
    const dy = e.clientY - ruch.y;
    if (!ruch.przesuniety && Math.abs(dy) < 5) return;
    ruch.przesuniety = true;
    ruch.predkosc = (e.clientY - ruch.ostatnieY) / Math.max(1, e.timeStamp - ruch.czas);
    ruch.ostatnieY = e.clientY;
    ruch.czas = e.timeStamp;
    dlg.classList.add('zaslonka-ciagnieta');
    dlg.style.setProperty('--zaslonka-ciag', `${Math.max(0, dy)}px`);
  };
  const pusc = (e) => {
    if (!ruch) return;
    const { przesuniety, zUchwytu, predkosc } = ruch;
    const dy = ruch.ostatnieY - ruch.y;
    ruch = null;
    if (e.type === 'pointercancel') { wrocNaMiejsce(dlg); return; }
    // Samo stuknięcie uchwytu zamyka; z nagłówka – nic (tam stuka się w tytuł albo obok przycisków).
    if (!przesuniety) { if (zUchwytu) zamknijZasuwajac(dlg); return; }
    const prog = Math.min(160, dlg.offsetHeight * 0.25);
    if (dy > prog || predkosc > 0.6) zamknijZasuwajac(dlg);
    else wrocNaMiejsce(dlg);
  };
  for (const el of [uchwyt, ...dlg.querySelectorAll('.naglowek-dialogu')]) {
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointermove', przesun);
    el.addEventListener('pointerup', pusc);
    el.addEventListener('pointercancel', pusc);
  }
  // Z klawiatury (Enter / spacja – kliknięcie bez wskaźnika) uchwyt zamyka jak krzyżyk.
  uchwyt.addEventListener('click', (e) => { if (e.detail === 0) zamknijJakX(dlg); });
}

// Tło: zamyka tylko kliknięcie, które zaczęło się i skończyło na tle (zaznaczanie tekstu kończone poza
// zasłonką jej nie zamyka). Kliknięcie w tło trafia w sam element <dialog>, poza jego prostokątem.
function podlaczTlo(dlg) {
  const naTle = (e) => {
    if (e.target !== dlg) return false;
    const r = dlg.getBoundingClientRect();
    return e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right;
  };
  let zTla = false;
  dlg.addEventListener('pointerdown', (e) => { zTla = czyZaslonka() && naTle(e); });
  dlg.addEventListener('click', (e) => {
    if (zTla && naTle(e)) zamknijZasuwajac(dlg);
    zTla = false;
  });
}

// Klawiatura ekranowa zasłania dół ekranu: zasłonka staje nad nią (wysokość widocznej części okna).
function sledzKlawiature() {
  const v = window.visualViewport;
  const root = document.documentElement;
  if (!otwarte.size || !v || !czyZaslonka()) {
    root.style.removeProperty('--klawiatura');
    root.style.removeProperty('--widok-h');
    return;
  }
  const zakryte = Math.max(0, window.innerHeight - v.height - v.offsetTop);
  root.style.setProperty('--klawiatura', `${Math.round(zakryte)}px`);
  root.style.setProperty('--widok-h', `${Math.round(v.height)}px`);
}
window.visualViewport?.addEventListener('resize', sledzKlawiature);
window.visualViewport?.addEventListener('scroll', sledzKlawiature);

function poOtwarciu(dlg) {
  otwarte.add(dlg);
  document.documentElement.toggleAttribute('data-okno-otwarte', true);
  sledzKlawiature();
  if (!czyZaslonka() || bezRuchu()) return;
  dlg.style.setProperty('--zaslonka-ciag', '0px');
  dlg.classList.add('zaslonka-wjazd');
  const koniec = () => dlg.classList.remove('zaslonka-wjazd');
  dlg.addEventListener('animationend', koniec, { once: true });
  setTimeout(koniec, 450);
}

function poZamknieciu(dlg) {
  otwarte.delete(dlg);
  dlg.classList.remove('zaslonka-wjazd', 'zaslonka-zjazd', 'zaslonka-ciagnieta', 'zaslonka-wraca');
  dlg.style.removeProperty('--zaslonka-ciag');
  document.documentElement.toggleAttribute('data-okno-otwarte', otwarte.size > 0);
  sledzKlawiature();
}

function przygotuj(dlg) {
  if (dlg.querySelector(':scope > .uchwyt-zaslonki')) return;
  const uchwyt = document.createElement('button');
  uchwyt.type = 'button';
  uchwyt.className = 'uchwyt-zaslonki';
  uchwyt.setAttribute('aria-label', 'Zamknij (albo pociągnij w dół)');
  // Na końcu okna (w CSS stoi na górze): pierwszy przycisk okna dostaje fokus przy otwarciu, a to nie może
  // być uchwyt – Enter zamknąłby okno zamiast zatwierdzić.
  dlg.append(uchwyt);
  // Krzyżyk okna: na zasłonce ukryty (zastępuje go uchwyt), ale to on zamyka okno.
  dlg.querySelector('button[data-ikona="zamknij"]')?.classList.add('x-okna');
  podlaczCiagniecie(dlg, uchwyt);
  podlaczTlo(dlg);
  new MutationObserver(() => { if (dlg.open) poOtwarciu(dlg); else poZamknieciu(dlg); })
    .observe(dlg, { attributes: true, attributeFilter: ['open'] });
}

// Otwarte okno dostaje fokus na pierwszym polu. Na zasłonce pole tekstowe otwierałoby od razu klawiaturę
// ekranową, która zasłania pół okna – fokus trafia więc na samo okno. Okna, które chcą pisania od razu
// (np. zmiana nazwy), same ustawiają fokus po otwarciu, a to nadal działa.
const POLE_TEKSTOWE = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=color]):not([type=range]), textarea, [contenteditable="true"]';
function fokusBezKlawiatury(dlg) {
  const a = document.activeElement;
  if (!czyZaslonka() || !dlg.contains(a) || !a.matches(POLE_TEKSTOWE) || a.hasAttribute('autofocus')) return;
  if (!dlg.hasAttribute('tabindex')) dlg.tabIndex = -1;
  dlg.focus({ preventScroll: true });
}

export function wlaczZaslonki() {
  document.querySelectorAll('dialog').forEach(przygotuj);
  const pokaz = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function showModal(...a) {
    pokaz.apply(this, a);
    fokusBezKlawiatury(this);
  };
}
