// Podpowiedzi na telefonie (decyzja #96): „Dużo miejsca na telefonie zajmują hinty, które często sugerują np.
// skróty klawiszowe, a to jest niepotrzebne.”
// Zwykłe podpowiedzi (klasa .podpowiedz bez innych klas – nie komunikaty o danych i nie podpisy) dostają klasę:
//   .podpowiedz-klawisze – o klawiaturze (skróty, <kbd>, Ctrl/Shift/Enter…): na dotyku znikają;
//   .podpowiedz-zwijana  – długa: na telefonie zwinięta do dwóch linii, stuknięcie ją rozwija.
// Nowe podpowiedzi (okna budowane w JS) obsługuje obserwator zmian w dokumencie.

const KLAWISZE = /\b(Ctrl|Shift|Alt|Enter|Esc|Tab|Cmd|Delete|Backspace|Spacj\w*|PgUp|PgDn)\b|⌘|klawisz|skrót|kółk\w* myszy|prawym przyciskiem/i;
const DLUGA = 110;

function urzadz(el) {
  if (el.dataset.podpowiedz) return;
  el.dataset.podpowiedz = '1';
  if (el.classList.length !== 1) return;
  // Opis okna (akapit .ciche w oknie): na telefonie tylko zwijany, nigdy chowany (#103).
  if (el.classList.contains('ciche')) {
    if (el.textContent.trim().length > DLUGA) { el.classList.add('podpowiedz-zwijana'); el.setAttribute('aria-expanded', 'false'); }
    return;
  }
  if (el.querySelector('kbd') || KLAWISZE.test(el.textContent)) { el.classList.add('podpowiedz-klawisze'); return; }
  if (el.textContent.trim().length > DLUGA) {
    el.classList.add('podpowiedz-zwijana');
    el.setAttribute('aria-expanded', 'false');
  }
}

function przejrzyj(korzen) {
  if (korzen.nodeType !== 1) return;
  const SELEKTOR = '.podpowiedz, dialog p.ciche';
  if (korzen.matches?.(SELEKTOR)) urzadz(korzen);
  for (const el of korzen.querySelectorAll?.(SELEKTOR) || []) urzadz(el);
}

export function wlaczPodpowiedzi() {
  przejrzyj(document.body);
  new MutationObserver((zmiany) => {
    for (const z of zmiany) for (const w of z.addedNodes) przejrzyj(w);
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('.podpowiedz-zwijana');
    if (!el || document.documentElement.dataset.urzadzenie !== 'telefon' || e.target.closest('a, button')) return;
    const rozwin = !el.classList.contains('rozwinieta');
    el.classList.toggle('rozwinieta', rozwin);
    el.setAttribute('aria-expanded', String(rozwin));
  });
}
