// Warstwy osobno od właściwości (#115): zawsze pod ręką, niezależnie od narzędzia i zaznaczenia.
// Na komputerze – zwijany panel pod właściwościami (stan zwinięcia zapamiętany na urządzeniu),
// na telefonie i tablecie w pionie – zakładka „Warstwy” w dolnym menu (arkusz z samą listą).

import { $ } from '../ui.js';
import { ustawPanel, edytor } from './kontekst.js';
import { panelWarstw } from './skladniki.js';

const KLUCZ = 'makietka.warstwy-zwiniete';
const waski = window.matchMedia('(max-width: 860px)');

export function dokZwiniety() {
  try { return localStorage.getItem(KLUCZ) === '1'; } catch { return false; }
}

// Lista warstw przebudowuje się tylko wtedy, gdy ją widać (przy każdej zmianie strony – #83).
export function odswiezWidocznoscWarstw() {
  const zwiniety = dokZwiniety();
  $('#naglowek-warstw').setAttribute('aria-expanded', String(!zwiniety));
  $('#dok-warstw').classList.toggle('zwiniety', zwiniety);
  panelWarstw.pokaz(waski.matches ? document.body.dataset.panel === 'warstwy' : !zwiniety);
}

export function przelaczDok(zwin = !dokZwiniety()) {
  try { localStorage.setItem(KLUCZ, zwin ? '1' : '0'); } catch { /* tryb prywatny */ }
  odswiezWidocznoscWarstw();
}

// Pokazuje listę warstw: rozwija panel albo otwiera zakładkę na telefonie.
export function pokazWarstwy() {
  if (waski.matches) {
    if (document.body.dataset.panel !== 'warstwy') ustawPanel('warstwy');
  } else if (dokZwiniety()) przelaczDok(false);
}

// Licznik przy nagłówku – także przy zwiniętym panelu.
function odswiezLicznik() {
  if (!edytor.wydruk) return;
  $('#licznik-warstw').textContent = String(edytor.warstwy().length);
}

export function podlaczDokWarstw() {
  $('#naglowek-warstw').addEventListener('click', () => przelaczDok());
  waski.addEventListener('change', odswiezWidocznoscWarstw);
  new MutationObserver(odswiezWidocznoscWarstw).observe(document.body, { attributes: true, attributeFilter: ['data-panel'] });
  for (const z of ['zmiana', 'historia', 'zaznaczenie']) edytor.addEventListener(z, odswiezLicznik);
  odswiezWidocznoscWarstw();
}
