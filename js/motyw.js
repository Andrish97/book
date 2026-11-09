// Motyw interfejsu: 'system' (domyślnie), 'jasny' albo 'ciemny'.
// Wybór jest zapamiętany na urządzeniu; pierwszy raz ustawia go krótki
// skrypt w <head>, żeby strona nie mignęła jasnym tłem.

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

systemowyCiemny.addEventListener('change', zastosuj);
zastosuj();
