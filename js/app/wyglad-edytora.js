// Wygląd edytora (#109): opcje w menu widoku (przycisk z siatką w prawym dolnym rogu).
//   Podpisy narzędzi        – napisy pod ikonami paska wstawiania (domyślnie wyłączone).
//   Napisy na górnym pasku  – „Wzorce”, „Dane”, „Podgląd” obok ikon: auto (tylko gdy się mieszczą), zawsze, nigdy.
// Ustawienia tego urządzenia (localStorage), jak „jedna strona w rozkładówkach” – telefon i komputer
// tego samego konta mają zwykle inne potrzeby.

import { $, $$ } from '../ui.js';

const KLUCZ = 'makietka.wyglad-edytora';
const DOMYSLNE = { podpisy: false, napisy: 'auto' };
// Najmniejsza szerokość pola nazwy projektu, przy której napisy w trybie „auto” jeszcze się pokazują.
const MIN_NAZWA = 220;

export function odczytajWyglad() {
  try {
    const z = JSON.parse(localStorage.getItem(KLUCZ) || '{}');
    return {
      podpisy: typeof z.podpisy === 'boolean' ? z.podpisy : DOMYSLNE.podpisy,
      napisy: ['auto', 'zawsze', 'nigdy'].includes(z.napisy) ? z.napisy : DOMYSLNE.napisy,
    };
  } catch { return { ...DOMYSLNE }; }
}

function zapisz(w) {
  try { localStorage.setItem(KLUCZ, JSON.stringify(w)); } catch { /* tryb prywatny – zostaje do końca sesji */ }
}

const pasek = () => $('#ekran-edytora .pasek-edytora');

// Tryb „auto”: napisy pokazują się na próbę; gdy pasek przestaje się mieścić albo pole nazwy robi się
// za wąskie – znikają. Mierzone przy każdej zmianie szerokości paska (ResizeObserver), bez stałego progu.
function dopasujNapisy() {
  const p = pasek();
  if (!p || p.dataset.napisy !== 'auto' || !p.offsetWidth) return;
  p.classList.add('z-napisami');
  const nazwa = $('#nazwa-projektu');
  const mieszczaSie = p.scrollWidth <= p.clientWidth + 1 && (!nazwa || nazwa.getBoundingClientRect().width >= MIN_NAZWA);
  p.classList.toggle('z-napisami', mieszczaSie);
}

export function zastosujWyglad(w = odczytajWyglad()) {
  const p = pasek();
  $('#ekran-edytora').toggleAttribute('data-podpisy-narzedzi', w.podpisy);
  if (p) {
    p.dataset.napisy = w.napisy;
    p.classList.toggle('z-napisami', w.napisy === 'zawsze');
    dopasujNapisy();
  }
  const pole = $('#widok-podpisy');
  if (pole) pole.checked = w.podpisy;
  $$('#widok-napisy input').forEach((r) => { r.checked = r.value === w.napisy; });
}

export function wlaczWygladEdytora() {
  zastosujWyglad();
  const p = pasek();
  if (p && 'ResizeObserver' in window) {
    let ostatnia = 0;
    new ResizeObserver(([wpis]) => {
      const szer = Math.round(wpis.contentRect.width);
      if (szer === ostatnia) return;
      ostatnia = szer;
      dopasujNapisy();
    }).observe(p);
  }
  // Zmiana nazwy projektu albo formatu zmienia miejsce na pasku.
  $('#nazwa-projektu')?.addEventListener('input', dopasujNapisy);
  $('#widok-podpisy')?.addEventListener('change', (e) => { const w = { ...odczytajWyglad(), podpisy: e.target.checked }; zapisz(w); zastosujWyglad(w); });
  $('#widok-napisy')?.addEventListener('change', (e) => { const w = { ...odczytajWyglad(), napisy: e.target.value }; zapisz(w); zastosujWyglad(w); });
}

export { dopasujNapisy };
