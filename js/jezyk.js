// Język interfejsu (#219): polski, angielski i ukraiński – jak w Familiadzie (przycisk z flagą na górze, menu
// z trzema językami). Aplikacja jest pisana po polsku; słowniki js/jezyki/<język>.js mapują polskie napisy na
// tłumaczenia. Tłumaczy się to, co widać: teksty i podpowiedzi (title, placeholder, aria-label) w całym dokumencie,
// także dopisywane później (MutationObserver) – ten sam napis zawsze tak samo. Powrót do polskiego przywraca
// oryginały. Treść projektów użytkownika (płótno, pola formularzy) nie jest ruszana.

export const JEZYKI = {
  pl: { nazwa: 'Polski', flaga: 'img/jezyki/flag-pl.svg' },
  en: { nazwa: 'English', flaga: 'img/jezyki/lang-en.svg' },
  uk: { nazwa: 'Українська', flaga: 'img/jezyki/flag-ua.svg' },
};
const KLUCZ = 'makietka-jezyk';
const ATRYBUTY = ['title', 'placeholder', 'aria-label'];
// Miejsca z treścią użytkownika – bez tłumaczenia.
const POMIJANE = 'script, style, textarea, [contenteditable], .canvas-container, [data-bez-tlumaczenia], .nazwa-projektu-karta';

let jezyk = 'pl';
let slownik = null;
const oryginalyTekstu = new WeakMap(); // węzeł tekstu → polski tekst
const oryginalyAtrybutow = new WeakMap(); // element → Map(atrybut → polski tekst)
let obserwator = null;
let wlasneZmiany = false;

const norm = (t) => t.replace(/\s+/g, ' ').trim();

export function wybranyJezyk() {
  let z = null;
  try { z = localStorage.getItem(KLUCZ); } catch { z = null; }
  if (JEZYKI[z]) return z;
  const nav = String(navigator.language || '').toLowerCase();
  return nav.startsWith('uk') ? 'uk' : nav.startsWith('pl') || !nav ? 'pl' : nav.startsWith('en') ? 'en' : 'pl';
}
export const biezacyJezyk = () => jezyk;

// Napis złożony w kodzie z kilku części („Okładka: Twarda”, „Kolor #1f2a44 – zmień”): gdy słownik nie ma całości,
// tłumaczy się każdą część osobno – tylko wtedy, gdy wszystkie części ze słowami są w słowniku.
const SZWY = [': ', ' – ', ' · ', ' — '];
const bezSlow = (x) => !/\p{L}{2,}/u.test(x.replace(/#[0-9a-f]{3,8}\b/giu, ''));
function przeloz(klucz, glebokosc = 0) {
  const caly = slownik[klucz] ?? slownik[klucz.replace(/[:…]$/u, '')];
  if (caly !== undefined) return slownik[klucz] !== undefined ? caly : `${caly}${klucz.slice(-1)}`;
  if (glebokosc > 3) return undefined;
  for (const szew of SZWY) {
    const i = klucz.indexOf(szew);
    if (i <= 0) continue;
    const a = klucz.slice(0, i).trim(); const b = klucz.slice(i + szew.length).trim();
    const pa = bezSlow(a) ? a : przeloz(a, glebokosc + 1);
    const pb = !b || bezSlow(b) ? b : przeloz(b, glebokosc + 1);
    if (pa !== undefined && pb !== undefined) return `${pa}${szew}${pb}`;
  }
  // „Kolor #1f2a44” – słowo + wartość bez słów.
  const m = klucz.match(/^(.*\p{L})\s+(#[0-9a-f]{3,8}|\(\d+\)|[\d.,×x %mpt-]+)$/iu);
  if (m) { const p = przeloz(m[1], glebokosc + 1); if (p !== undefined) return `${p} ${m[2]}`; }
  return undefined;
}

// Tłumaczenie napisu z JS (np. komunikat) – bez słownika albo bez wpisu: polski.
export function t(polski) {
  if (jezyk === 'pl' || !slownik) return polski;
  return przeloz(norm(polski)) ?? polski;
}

function tlumaczTekst(wezel) {
  const el = wezel.parentElement;
  if (!el || el.closest(POMIJANE)) return;
  const oryg = oryginalyTekstu.has(wezel) ? oryginalyTekstu.get(wezel) : wezel.nodeValue;
  const klucz = norm(oryg);
  if (!klucz || !/\p{L}/u.test(klucz)) return;
  // Białe znaki wokół napisu zostają (odstępy między ikoną a tekstem).
  let cel = oryg;
  if (jezyk !== 'pl') {
    const p = slownik ? przeloz(klucz) : undefined;
    if (p === undefined) return;
    cel = `${oryg.match(/^\s*/)[0]}${p}${oryg.match(/\s*$/)[0]}`;
  }
  if (!oryginalyTekstu.has(wezel)) oryginalyTekstu.set(wezel, oryg);
  if (wezel.nodeValue !== cel) wezel.nodeValue = cel;
}

function tlumaczAtrybuty(el) {
  if (el.closest(POMIJANE)) return;
  for (const a of ATRYBUTY) {
    if (!el.hasAttribute(a)) continue;
    let mapa = oryginalyAtrybutow.get(el);
    const oryg = mapa?.has(a) ? mapa.get(a) : el.getAttribute(a);
    const klucz = norm(oryg);
    const cel = jezyk === 'pl' ? oryg : (slownik ? przeloz(klucz) : undefined);
    if (cel === undefined) continue;
    if (!mapa) { mapa = new Map(); oryginalyAtrybutow.set(el, mapa); }
    if (!mapa.has(a)) mapa.set(a, oryg);
    if (el.getAttribute(a) !== cel) el.setAttribute(a, cel);
  }
}

function tlumaczDrzewo(korzen) {
  if (korzen.nodeType === 3) { tlumaczTekst(korzen); return; }
  if (korzen.nodeType !== 1 && korzen.nodeType !== 9) return;
  const iter = document.createTreeWalker(korzen, 5); // elementy i teksty
  for (let w = korzen.nodeType === 1 ? korzen : iter.nextNode(); w; w = iter.nextNode()) {
    if (w.nodeType === 3) tlumaczTekst(w);
    else if (w.nodeType === 1) tlumaczAtrybuty(w);
  }
}

function zastosuj(korzen = document.body) {
  wlasneZmiany = true;
  try { tlumaczDrzewo(korzen); } finally { obserwator?.takeRecords(); wlasneZmiany = false; }
}

function obserwuj() {
  if (obserwator) return;
  obserwator = new MutationObserver((zmiany) => {
    if (wlasneZmiany || jezyk === 'pl') return;
    wlasneZmiany = true;
    try {
      for (const z of zmiany) {
        if (z.type === 'childList') z.addedNodes.forEach((n) => tlumaczDrzewo(n));
        else if (z.type === 'characterData') { oryginalyTekstu.delete(z.target); tlumaczTekst(z.target); }
        else if (z.type === 'attributes') { oryginalyAtrybutow.get(z.target)?.delete(z.attributeName); tlumaczAtrybuty(z.target); }
      }
    } finally { obserwator.takeRecords(); wlasneZmiany = false; }
  });
  obserwator.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRYBUTY });
}

export async function ustawJezyk(nowy, { zapamietaj = true } = {}) {
  if (!JEZYKI[nowy]) nowy = 'pl';
  slownik = nowy === 'pl' ? null : (await import(`./jezyki/${nowy}.js`)).default;
  jezyk = nowy;
  document.documentElement.lang = nowy;
  if (zapamietaj) { try { localStorage.setItem(KLUCZ, nowy); } catch { /* bez pamięci – na tę sesję */ } }
  zastosuj();
  obserwuj();
  odswiezPrzyciskiJezyka();
  document.dispatchEvent(new CustomEvent('jezyk', { detail: nowy }));
}

// ---------- Przycisk i menu (jak motyw, #205) ----------

export function odswiezPrzyciskiJezyka() {
  for (const b of document.querySelectorAll('.przycisk-ikona[data-akcja="jezyk"]')) {
    const j = JEZYKI[jezyk];
    b.innerHTML = `<img src="${j.flaga}" alt="" width="20" height="20" class="flaga-jezyka">`;
    b.title = `Język: ${j.nazwa}`;
    b.setAttribute('aria-label', `Język: ${j.nazwa}`);
  }
}

let menu = null;
export function otworzMenuJezyka(przycisk) {
  if (menu) { menu.remove(); menu = null; return; }
  const m = document.createElement('div');
  m.className = 'menu menu-motywu menu-jezyka';
  m.setAttribute('role', 'menu');
  m.setAttribute('data-bez-tlumaczenia', '');
  for (const [kod, j] of Object.entries(JEZYKI)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitemradio');
    b.setAttribute('aria-checked', String(kod === jezyk));
    b.dataset.jezyk = kod;
    b.innerHTML = `<img src="${j.flaga}" alt="" width="20" height="20" class="flaga-jezyka"><span lang="${kod}">${j.nazwa}</span>`;
    b.addEventListener('click', () => { zamknij(); ustawJezyk(kod); przycisk.focus(); });
    m.append(b);
  }
  document.body.append(m);
  const r = przycisk.getBoundingClientRect();
  m.style.top = `${Math.round(r.bottom + 6)}px`;
  m.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  menu = m;
  const zamknij = () => { m.remove(); if (menu === m) menu = null; document.removeEventListener('pointerdown', poza, true); document.removeEventListener('keydown', esc, true); };
  const poza = (e) => { if (!m.contains(e.target) && !przycisk.contains(e.target)) zamknij(); };
  const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); zamknij(); przycisk.focus(); } };
  setTimeout(() => { document.addEventListener('pointerdown', poza, true); document.addEventListener('keydown', esc, true); });
  (m.querySelector('[aria-checked="true"]') || m.querySelector('button')).focus();
}
