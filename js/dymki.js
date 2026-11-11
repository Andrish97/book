// Własne dymki z podpowiedzią zamiast systemowych (atrybut „title”).
//
// W HTML i w kodzie podpowiedź nadal siedzi w atrybucie „title” – to jedyne źródło tekstu, więc
// kod, który go zmienia (np. przycisk pełnego ekranu), działa bez zmian. Gdy dymek się pokazuje,
// „title” chwilowo przechodzi do „data-dymek” (inaczej przeglądarka pokazałaby też swój),
// a po schowaniu wraca. Dymek:
// - przy myszy pokazuje się po 400 ms, przy przejściu klawiszem Tab – od razu;
// - znika przy wyjściu, kliknięciu, Esc i przewijaniu;
// - stoi pod elementem (albo nad nim, gdy brakuje miejsca), więc nie zasłania wskaźnika;
// - na ekranie dotykowym się nie pokazuje (stuknięcie to zwykłe kliknięcie).

const OPOZNIENIE = 400;
let dymek = null; // element dymku
let cel = null; // element, którego dotyczy pokazany albo czekający dymek
let zegar = null;
let pokazany = false;
let obserwator = null;

function element() {
  if (!dymek) {
    dymek = document.createElement('div');
    dymek.className = 'dymek';
    dymek.id = 'dymek';
    dymek.setAttribute('role', 'tooltip');
  }
  return dymek;
}

const tekstCelu = (el) => el.getAttribute('title') || el.dataset.dymek || '';

function ustaw() {
  const d = element();
  const r = cel.getBoundingClientRect();
  d.style.left = '0px';
  d.style.top = '0px';
  const szer = d.offsetWidth;
  const wys = d.offsetHeight;
  const odstep = 6;
  let top = r.bottom + odstep;
  if (top + wys > window.innerHeight - 4 && r.top - odstep - wys >= 4) top = r.top - odstep - wys;
  const left = Math.max(4, Math.min(r.left + r.width / 2 - szer / 2, window.innerWidth - szer - 4));
  d.style.left = `${Math.round(left)}px`;
  d.style.top = `${Math.round(Math.max(4, top))}px`;
}

function pokaz() {
  zegar = null;
  if (!cel || !cel.isConnected) { cel = null; return; }
  const tekst = tekstCelu(cel);
  if (!tekst) return;
  // „title” do „data-dymek” – przeglądarka nie pokaże swojego dymku.
  if (cel.hasAttribute('title')) { cel.dataset.dymek = cel.getAttribute('title'); cel.removeAttribute('title'); }
  const d = element();
  d.textContent = tekst;
  // W otwartym oknie dialogowym dymek musi być w tym oknie, inaczej leżałby pod nim.
  (cel.closest('dialog[open]') || document.body).append(d);
  const opis = cel.getAttribute('aria-describedby') || '';
  if (!opis.split(' ').includes('dymek')) cel.setAttribute('aria-describedby', `${opis} dymek`.trim());
  ustaw();
  pokazany = true;
  // Kod zmienia „title” w trakcie (np. pełny ekran): nowy tekst trafia do dymku.
  obserwator = new MutationObserver(() => {
    if (!cel?.hasAttribute('title')) return;
    cel.dataset.dymek = cel.getAttribute('title');
    cel.removeAttribute('title');
    d.textContent = cel.dataset.dymek;
    ustaw();
  });
  obserwator.observe(cel, { attributes: true, attributeFilter: ['title'] });
}

export function schowajDymek() {
  clearTimeout(zegar);
  zegar = null;
  obserwator?.disconnect();
  obserwator = null;
  if (cel) {
    // Zwrot „title” – chyba że kod w międzyczasie ustawił nowy.
    if (cel.dataset.dymek !== undefined) {
      if (!cel.hasAttribute('title')) cel.setAttribute('title', cel.dataset.dymek);
      delete cel.dataset.dymek;
    }
    const opis = (cel.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && x !== 'dymek').join(' ');
    if (opis) cel.setAttribute('aria-describedby', opis); else cel.removeAttribute('aria-describedby');
  }
  cel = null;
  pokazany = false;
  dymek?.remove();
}

function zacznij(el, odRazu) {
  if (el === cel) return;
  schowajDymek();
  cel = el;
  if (odRazu) pokaz(); else zegar = setTimeout(pokaz, OPOZNIENIE);
}

const zTytulem = (el) => el?.closest?.('[title], [data-dymek]');

export function wlaczDymki() {
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const el = zTytulem(e.target);
    if (el && tekstCelu(el)) zacznij(el, false);
    else if (cel && !cel.contains(e.target)) schowajDymek();
  }, true);
  document.addEventListener('pointerout', (e) => {
    if (cel && (!e.relatedTarget || !cel.contains(e.relatedTarget))) schowajDymek();
  }, true);
  document.addEventListener('pointerdown', schowajDymek, true);
  document.addEventListener('focusin', (e) => {
    const el = zTytulem(e.target);
    // Tylko przy przejściu klawiaturą – po kliknięciu myszą fokus też przychodzi, ale dymek nie jest wtedy potrzebny.
    if (el === e.target && tekstCelu(el) && el.matches(':focus-visible')) zacznij(el, true);
  });
  document.addEventListener('focusout', (e) => { if (cel && e.target === cel && pokazany) schowajDymek(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (pokazany || zegar)) schowajDymek(); }, true);
  document.addEventListener('scroll', () => { if (pokazany || zegar) schowajDymek(); }, true);
  window.addEventListener('blur', schowajDymek);
}
