// Prawa kolumna edytora i warstwy.
//
// Komputer (#171): dwie zakładki u góry prawej kolumny – „Właściwości” i „Warstwy” – każda na całą wysokość
// (wybór zapamiętany na urządzeniu, F7 przełącza). Warstwy są zawsze pod ręką, niezależnie od narzędzia
// i zaznaczenia (#115), ale nie ściskają już właściwości. Ostrzeżenia – osobne, nieblokujące okienko
// z przycisku z licznikiem przy powiększeniu (F8), zamiast stałej sekcji pod warstwami.
// Telefon i tablet w pionie: dolne menu („Warstwy”, „Ostrzeżenia” – arkusze), bez zmian.

import { $ } from '../ui.js';
import { ustawPanel, edytor } from './kontekst.js';
import { panelWarstw } from './skladniki.js';

const KLUCZ = 'makietka.prawy-panel';
const waski = window.matchMedia('(max-width: 860px)');

export function zakladkaPrawa() {
  try { return localStorage.getItem(KLUCZ) === 'warstwy' ? 'warstwy' : 'wlasciwosci'; } catch { return 'wlasciwosci'; }
}

// Lista warstw przebudowuje się tylko wtedy, gdy ją widać (przy każdej zmianie strony – #83).
export function odswiezWidocznoscWarstw() {
  const z = zakladkaPrawa();
  document.body.dataset.prawy = z;
  for (const b of document.querySelectorAll('#zakladki-inspektora [role="tab"]')) b.setAttribute('aria-selected', String(b.dataset.prawy === z));
  panelWarstw.pokaz(waski.matches ? document.body.dataset.panel === 'warstwy' : z === 'warstwy');
}

export function ustawZakladkePrawa(z) {
  try { localStorage.setItem(KLUCZ, z === 'warstwy' ? 'warstwy' : 'wlasciwosci'); } catch { /* tryb prywatny */ }
  odswiezWidocznoscWarstw();
}

export const przelaczZakladkePrawa = () => ustawZakladkePrawa(zakladkaPrawa() === 'warstwy' ? 'wlasciwosci' : 'warstwy');

// Pokazuje listę warstw: zakładka na komputerze, arkusz na telefonie.
export function pokazWarstwy() {
  if (waski.matches) {
    if (document.body.dataset.panel !== 'warstwy') ustawPanel('warstwy');
  } else ustawZakladkePrawa('warstwy');
}

// Licznik przy zakładce – także gdy widać właściwości.
function odswiezLicznik() {
  if (!edytor.wydruk) return;
  const n = String(edytor.warstwy().length);
  $('#licznik-warstw').textContent = n;
  $('#licznik-warstw-zakladka').textContent = n;
}

// ---------- Ostrzeżenia na komputerze: okienko z przycisku ----------

export function ostrzezeniaOtwarte() { return document.body.classList.contains('ostrzezenia-otwarte'); }

function ustawOknoOstrzezen() {
  const okno = $('#sekcja-ostrzezen');
  if (!ostrzezeniaOtwarte() || waski.matches) { okno.style.removeProperty('left'); okno.style.removeProperty('bottom'); return; }
  const b = $('#przycisk-ostrzezen').getBoundingClientRect();
  const w = okno.offsetWidth || 340;
  okno.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - w - 8, b.right - w)))}px`;
  okno.style.bottom = `${Math.round(window.innerHeight - b.top + 8)}px`;
}

export function przelaczOstrzezenia(otworz = !ostrzezeniaOtwarte()) {
  if (waski.matches) { ustawPanel(otworz ? 'ostrzezenia' : ''); return; }
  document.body.classList.toggle('ostrzezenia-otwarte', otworz);
  $('#przycisk-ostrzezen').setAttribute('aria-pressed', String(otworz));
  $('#naglowek-ostrzezen').setAttribute('aria-expanded', 'true');
  ustawOknoOstrzezen();
}

export function podlaczDokWarstw() {
  $('#naglowek-warstw').addEventListener('click', () => {
    const b = $('#naglowek-warstw');
    b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'));
    $('#dok-warstw').classList.toggle('zwiniety', b.getAttribute('aria-expanded') === 'false');
  });
  $('#zakladki-inspektora').addEventListener('click', (e) => {
    const b = e.target.closest('[role="tab"]');
    if (b) ustawZakladkePrawa(b.dataset.prawy);
  });
  $('#zakladki-inspektora').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    przelaczZakladkePrawa();
    $(`#zakladki-inspektora [data-prawy="${zakladkaPrawa()}"]`).focus();
  });
  $('#przycisk-ostrzezen').addEventListener('click', () => przelaczOstrzezenia());
  $('#zamknij-ostrzezenia').addEventListener('click', () => przelaczOstrzezenia(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ostrzezeniaOtwarte() && !document.querySelector('dialog[open]')) przelaczOstrzezenia(false);
  });
  window.addEventListener('resize', ustawOknoOstrzezen);
  waski.addEventListener('change', () => { if (waski.matches) przelaczOstrzezenia(false); odswiezWidocznoscWarstw(); });
  new MutationObserver(odswiezWidocznoscWarstw).observe(document.body, { attributes: true, attributeFilter: ['data-panel'] });
  for (const z of ['zmiana', 'historia', 'zaznaczenie']) edytor.addEventListener(z, odswiezLicznik);
  odswiezWidocznoscWarstw();
}
