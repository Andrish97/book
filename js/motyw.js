// Motyw interfejsu: 'system' (domyślnie), 'jasny' albo 'ciemny'.
// Wybór jest zapamiętany na urządzeniu; pierwszy raz ustawia go krótki
// skrypt w <head>, żeby strona nie mignęła jasnym tłem.
import { t } from './jezyk.js';

const KLUCZ = 'seriodruk:motyw';
const systemowyCiemny = window.matchMedia('(prefers-color-scheme: dark)');

export function wybranyMotyw() {
  try { return localStorage.getItem(KLUCZ) || 'system'; } catch { return 'system'; }
}

export const czyCiemny = () => document.documentElement.dataset.motyw === 'ciemny';

function zastosuj() {
  const wybor = wybranyMotyw();
  const ciemny = wybor === 'ciemny' || (wybor === 'system' && systemowyCiemny.matches);
  document.documentElement.dataset.motyw = ciemny ? 'ciemny' : 'jasny';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ciemny ? '#151412' : '#f4f3ef');
  document.dispatchEvent(new CustomEvent('motyw', { detail: { wybor, ciemny } }));
}

export function ustawMotyw(wybor) {
  try { localStorage.setItem(KLUCZ, wybor); } catch { /* tryb prywatny */ }
  zastosuj();
}

// Szybki przełącznik: zmienia na przeciwny do tego, co widać.
export function przelaczMotyw() {
  ustawMotyw(czyCiemny() ? 'jasny' : 'ciemny');
}

// Przycisk motywu na górze (#205, jak w Familiadzie): ikona wybranego trybu i menu – Jak w systemie, Jasny, Ciemny.
export const TRYBY_MOTYWU = [['system', 'Jak w systemie', 'motywSystem'], ['jasny', 'Jasny', 'motywJasny'], ['ciemny', 'Ciemny', 'motywCiemny']];
let menuMotywu = null;
export function otworzMenuMotywu(przycisk, ikona) {
  if (menuMotywu) { menuMotywu.remove(); menuMotywu = null; return; }
  const m = document.createElement('div');
  m.className = 'menu menu-motywu';
  m.setAttribute('role', 'menu');
  m.setAttribute('aria-label', t('motyw.motyw'));
  for (const [wartosc, nazwa, ik] of TRYBY_MOTYWU) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitemradio');
    b.setAttribute('aria-checked', String(wybranyMotyw() === wartosc));
    b.dataset.motyw = wartosc;
    b.innerHTML = `${ikona(ik)}<span>${nazwa}</span>`;
    b.addEventListener('click', () => { ustawMotyw(wartosc); zamknij(); przycisk.focus(); });
    m.append(b);
  }
  document.body.append(m);
  const r = przycisk.getBoundingClientRect();
  m.style.top = `${Math.round(r.bottom + 6)}px`;
  m.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  menuMotywu = m;
  const zamknij = () => { m.remove(); if (menuMotywu === m) menuMotywu = null; document.removeEventListener('pointerdown', poza, true); document.removeEventListener('keydown', esc, true); };
  const poza = (e) => { if (!m.contains(e.target) && !przycisk.contains(e.target)) zamknij(); };
  const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); zamknij(); przycisk.focus(); } };
  setTimeout(() => { document.addEventListener('pointerdown', poza, true); document.addEventListener('keydown', esc, true); });
  (m.querySelector('[aria-checked="true"]') || m.querySelector('button')).focus();
}

// Ikona i opis przycisków motywu wg wybranego trybu.
export function odswiezPrzyciskiMotywu(ikona) {
  const [, nazwa, ik] = TRYBY_MOTYWU.find(([w]) => w === wybranyMotyw()) || TRYBY_MOTYWU[0];
  for (const b of document.querySelectorAll('[data-akcja="motyw"]')) {
    b.querySelector(':scope > svg.ikona')?.remove();
    b.insertAdjacentHTML('afterbegin', ikona(ik));
    b.title = `Motyw: ${nazwa.toLowerCase()}`;
    b.setAttribute('aria-label', `Motyw: ${nazwa.toLowerCase()} – zmień`);
    b.setAttribute('aria-haspopup', 'menu');
  }
}

systemowyCiemny.addEventListener('change', zastosuj);
zastosuj();
