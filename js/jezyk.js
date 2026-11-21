// Język interfejsu (#219): polski, angielski i ukraiński – jak w Familiadzie (przycisk z flagą na górze, menu
// z trzema językami). Napisy mają klucze (js/jezyki/klucze/<język>.js, #339–#358); dawne słowniki „polski napis →
// tłumaczenie” usunięte (#358). Tłumaczy się to, co widać: teksty i podpowiedzi (title, placeholder, aria-label) w całym dokumencie,
// także dopisywane później (MutationObserver) – ten sam napis zawsze tak samo. Powrót do polskiego przywraca
// oryginały. Treść projektów użytkownika (płótno, pola formularzy) nie jest ruszana.

import SLOWNIK_PL from './jezyki/klucze/pl.js';

export const JEZYKI = {
  pl: { nazwa: 'Polski', flaga: 'img/jezyki/flag-pl.svg' },
  en: { nazwa: 'English', flaga: 'img/jezyki/lang-en.svg' },
  uk: { nazwa: 'Українська', flaga: 'img/jezyki/flag-ua.svg' },
};
const KLUCZ = 'makietka-jezyk';

// Napis podany przez użytkownika (nazwa projektu, sekcji, strony, tabeli, obrazu…): wpisany do elementu i oznaczony,
// żeby tłumaczenie go nie ruszało – „Kalendarz 2027” zostaje „Kalendarz 2027”, a nie „Calendar 2027”.
export function wpiszNazwe(el, tekst) {
  if (!el) return el;
  el.textContent = tekst;
  el.setAttribute('data-bez-tlumaczenia', '');
  return el;
}
const ATRYBUTY = ['title', 'placeholder', 'aria-label'];

// ---------- Klucze (#339, jak w Familiadzie) ----------
// Napisy interfejsu mają klucze „obszar.nazwa”: w HTML data-i18n (tekst), data-i18n-title / -placeholder /
// -aria-label (atrybuty), w kodzie t('obszar.nazwa', { zmienne }). Słowniki: js/jezyki/klucze/<język>.js.
// Polski tekst zostaje w HTML – po polsku nic się nie wczytuje. Tłumaczy się tylko to, co ma klucz; napisy kodu
// bez klucza (przenoszone etapami) – jeszcze dawnym słownikiem „polski napis → tłumaczenie”.
// Polski słownik jest zawsze (napisy kodu przed wczytaniem języka), a wybrany język wczytuje się, zanim moduły
// aplikacji zaczną działać (await na poziomie modułu) – stałe z t() mają od razu właściwy język.
const slownikiKluczy = { pl: SLOWNIK_PL }; // język → { klucz: napis }
let klucze = null; // bieżący język
const wczytajKlucze = async (j) => {
  if (!slownikiKluczy[j]) { slownikiKluczy[j] = (await import(`./jezyki/klucze/${j}.js`)).default; odwrotny = null; }
  return slownikiKluczy[j];
};
// Odwrotnie: napis → klucz (w każdym wczytanym języku). Dzięki temu przełączenie języka zamienia także napisy
// wstawione wcześniej przez t() w innym języku – bez pamiętania oryginałów i bez przebudowy okien.
// Jedna mapa „napis (w dowolnym wczytanym języku) → klucz” – budowana raz po wczytaniu słownika (#358).
let odwrotny = null;
function kluczNapisu(tekst) {
  if (!klucze || !tekst) return null;
  if (!odwrotny) {
    odwrotny = new Map();
    for (const sl of Object.values(slownikiKluczy)) for (const [k, v] of Object.entries(sl)) { const n = norm(v); if (!odwrotny.has(n)) odwrotny.set(n, k); }
  }
  const k = odwrotny.get(tekst);
  return k && klucze[k] !== undefined ? k : null;
}
// Czy tekst elementu to wciąż napis klucza w którymś języku (a nie treść wstawiona przez kod) – wtedy wolno go podmienić.
const napisKlucza = (k, tekst) => Object.values(slownikiKluczy).some((sl) => sl[k] !== undefined && norm(sl[k]) === tekst);
function zastosujKlucze(korzen) {
  if (!klucze || !korzen?.querySelectorAll) return;
  const el = korzen.nodeType === 1 ? [korzen] : [];
  for (const e of [...el, ...korzen.querySelectorAll('[data-i18n],[data-i18n-title],[data-i18n-placeholder],[data-i18n-aria-label]')]) {
    const k = e.getAttribute('data-i18n');
    if (k && klucze[k] !== undefined && napisKlucza(k, norm(e.textContent)) && e.textContent !== klucze[k]) e.textContent = klucze[k];
    for (const a of ATRYBUTY) {
      const ka = e.getAttribute(`data-i18n-${a}`);
      if (!ka || klucze[ka] === undefined || !e.hasAttribute(a)) continue;
      if (napisKlucza(ka, norm(e.getAttribute(a))) && e.getAttribute(a) !== klucze[ka]) e.setAttribute(a, klucze[ka]);
    }
  }
}
// Miejsca z treścią użytkownika – bez tłumaczenia.
const POMIJANE = 'script, style, textarea, [contenteditable], .canvas-container, [data-bez-tlumaczenia], .nazwa-projektu-karta';

let jezyk = 'pl';
let obserwator = null;
let wlasneZmiany = false;

const norm = (t) => t.replace(/\s+/g, ' ').trim();

export function wybranyJezyk() {
  // Poza przeglądarką (Node: testy, budowanie instrukcji) – zawsze polski, niezależnie od języka systemu.
  if (typeof document === 'undefined') return 'pl';
  // Strona z ustalonym językiem (rysuj.html – rysowanie na serwerze): <html data-jezyk="pl">.
  const staly = document.documentElement?.dataset?.jezyk;
  if (JEZYKI[staly]) return staly;
  let z = null;
  try { z = localStorage.getItem(KLUCZ); } catch { z = null; }
  if (JEZYKI[z]) return z;
  const nav = String(navigator.language || '').toLowerCase();
  return nav.startsWith('uk') ? 'uk' : nav.startsWith('pl') || !nav ? 'pl' : nav.startsWith('en') ? 'en' : 'pl';
}
export const biezacyJezyk = () => jezyk;

try {
  const startowy = wybranyJezyk();
  if (startowy !== 'pl') { klucze = await wczytajKlucze(startowy); jezykKluczy = startowy; }
} catch { /* bez słownika – napisy po polsku, ustawJezyk spróbuje jeszcze raz */ }

// Napis na ekranie → napis w bieżącym języku (#358, bez dawnego słownika): tekst, który jest napisem klucza w którymś
// języku, zamienia się na napis tego klucza w bieżącym. Napis złożony w kodzie z kilku części („Okładka: Twarda”,
// „Kolor #1f2a44 – zmień”) – po częściach, gdy wszystkie części ze słowami są kluczami. Wyniki w pamięci na język.
const SZWY = [': ', ' – ', ' · ', ' — '];
const bezSlow = (x) => !/\p{L}{2,}/u.test(x.replace(/#[0-9a-f]{3,8}\b/giu, ''));
let pamiecNapisow = new Map();
function przelozNapis(tekst, glebokosc = 0) {
  if (!glebokosc && pamiecNapisow.has(tekst)) return pamiecNapisow.get(tekst);
  let wynik;
  const k = kluczNapisu(tekst);
  if (k) wynik = klucze[k];
  else {
    const bezKonca = tekst.replace(/[:…]$/u, '');
    const kk = bezKonca !== tekst ? kluczNapisu(bezKonca) : null;
    if (kk) wynik = `${klucze[kk]}${tekst.slice(-1)}`;
    else if (glebokosc <= 3) {
      for (const szew of SZWY) {
        const i = tekst.indexOf(szew);
        if (i <= 0) continue;
        const a = tekst.slice(0, i).trim(); const b = tekst.slice(i + szew.length).trim();
        const pa = bezSlow(a) ? a : przelozNapis(a, glebokosc + 1);
        const pb = !b || bezSlow(b) ? b : przelozNapis(b, glebokosc + 1);
        if (pa !== undefined && pb !== undefined) { wynik = `${pa}${szew}${pb}`; break; }
      }
      if (wynik === undefined) {
        // „Kolor #1f2a44” – słowo + wartość bez słów.
        const m = tekst.match(/^(.*\p{L})\s+(#[0-9a-f]{3,8}|\(\d+\)|[\d.,×x %mpt-]+)$/iu);
        if (m) { const p = przelozNapis(m[1], glebokosc + 1); if (p !== undefined) wynik = `${p} ${m[2]}`; }
      }
    }
  }
  if (!glebokosc) pamiecNapisow.set(tekst, wynik);
  return wynik;
}

// Tłumaczenie napisu z JS (np. komunikat) – bez słownika albo bez wpisu: polski.
// t('obszar.nazwa', { n: 3 }) – napis klucza w bieżącym języku ze zmiennymi {n}; t('Polski napis') – dawny słownik.
// Wartości kluczy ze zmiennymi i odmianą (#356, zapis jak ICU MessageFormat): „Usunięto {n, plural, one {# obraz}
// few {# obrazy} many {# obrazów} other {# obrazu}}.” – formę wybiera reguła języka (Intl.PluralRules: polski
// i ukraiński one/few/many/other, angielski one/other); „#” to liczba, „=0 {…}” – dokładna wartość.
const reguly = new Map();
const kategoria = (j, n) => {
  let r = reguly.get(j);
  if (!r) { r = new Intl.PluralRules(j); reguly.set(j, r); }
  return r.select(n);
};
const zamkniecie = (s, od) => { let g = 0; for (let k = od; k < s.length; k += 1) { if (s[k] === '{') g += 1; else if (s[k] === '}') { g -= 1; if (!g) return k; } } return -1; };
export function formatuj(wzor, zmienne, j = 'pl') {
  let wynik = '';
  for (let i = 0; i < wzor.length;) {
    if (wzor[i] !== '{') { wynik += wzor[i]; i += 1; continue; }
    const k = zamkniecie(wzor, i);
    if (k < 0) { wynik += wzor.slice(i); break; }
    const srodek = wzor.slice(i + 1, k);
    // Krótki zapis odmiany (#356): {n|1|2–4|5+} – po polsku i ukraińsku trzy formy, po angielsku dwie {n|1|reszta}.
    const krotki = /^\s*(\w+)\|([\s\S]*)$/.exec(srodek);
    if (krotki && zmienne?.[krotki[1]] !== undefined) {
      const v = zmienne[krotki[1]];
      const formy = krotki[2].split('|');
      const kat = kategoria(j, Number(v));
      const f = formy.length === 2 ? (kat === 'one' ? formy[0] : formy[1])
        : (kat === 'one' ? formy[0] : kat === 'few' ? formy[1] : kat === 'other' && !Number.isInteger(Number(v)) ? formy[1] : formy[2] ?? formy[1]);
      wynik += formatuj(f.replace(/#/g, String(v)), zmienne, j);
      i = k + 1;
      continue;
    }
    const m = /^\s*(\w+)\s*(?:,\s*plural\s*,([\s\S]*))?$/.exec(srodek);
    const v = m ? zmienne?.[m[1]] : undefined;
    if (!m || v === undefined) { wynik += wzor.slice(i, k + 1); i = k + 1; continue; }
    if (m[2] === undefined) wynik += String(v);
    else {
      const warianty = {};
      const s = m[2];
      for (let p = 0; p < s.length;) {
        const mm = /^\s*(=?[\w.-]+)\s*\{/.exec(s.slice(p));
        if (!mm) break;
        const start = p + mm[0].length - 1;
        const kon = zamkniecie(s, start);
        if (kon < 0) break;
        warianty[mm[1]] = s.slice(start + 1, kon);
        p = kon + 1;
      }
      const n = Number(v);
      const tekst = warianty[`=${n}`] ?? warianty[kategoria(j, n)] ?? warianty.other ?? warianty.many ?? '';
      wynik += formatuj(tekst.replace(/#/g, String(v)), zmienne, j);
    }
    i = k + 1;
  }
  return wynik;
}

let jezykKluczy = 'pl';
export function t(tekst, zmienne = null) {
  const zBiezacego = klucze?.[tekst];
  const kl = zBiezacego ?? slownikiKluczy.pl?.[tekst];
  if (kl !== undefined) return zmienne ? formatuj(kl, zmienne, zBiezacego !== undefined ? jezykKluczy : 'pl') : kl;
  if (jezykKluczy === 'pl' || !klucze) return tekst;
  return przelozNapis(norm(String(tekst))) ?? tekst;
}

function tlumaczTekst(wezel, sprawdzony = false) {
  const v = wezel.nodeValue;
  if (!v || !/\p{L}/u.test(v)) return;
  const el = wezel.parentElement;
  if (!el || (!sprawdzony && el.closest(POMIJANE))) return;
  const p = przelozNapis(norm(v));
  if (p === undefined) return;
  // Białe znaki wokół napisu zostają (odstępy między ikoną a tekstem).
  const cel = `${v.match(/^\s*/)[0]}${p}${v.match(/\s*$/)[0]}`;
  if (v !== cel) wezel.nodeValue = cel;
}

function tlumaczAtrybuty(el, sprawdzony = false) {
  let pominiety = sprawdzony ? false : null;
  for (const a of ATRYBUTY) {
    const v = el.getAttribute(a);
    if (!v || el.hasAttribute(`data-i18n-${a}`) || !/\p{L}/u.test(v)) continue; // z kluczem – zastosujKlucze
    pominiety ??= Boolean(el.closest(POMIJANE));
    if (pominiety) return;
    const p = przelozNapis(norm(v));
    if (p !== undefined && p !== v) el.setAttribute(a, p);
  }
}

// Całe drzewo naraz: miejsca z treścią użytkownika (POMIJANE) odrzucane od razu z całym poddrzewem – bez
// sprawdzania przodków przy każdym napisie (#358, szybsze przełączanie języka).
function tlumaczDrzewo(korzen) {
  if (korzen.nodeType === 3) { tlumaczTekst(korzen); return; }
  if (korzen.nodeType !== 1 && korzen.nodeType !== 9) return;
  if (korzen.nodeType === 1 && korzen.closest(POMIJANE)) return;
  const iter = document.createTreeWalker(korzen, 5, {
    acceptNode: (w) => (w.nodeType === 1 && w.matches(POMIJANE) ? 2 : 1), // 2 = FILTER_REJECT, 1 = FILTER_ACCEPT
  });
  for (let w = korzen.nodeType === 1 ? korzen : iter.nextNode(); w; w = iter.nextNode()) {
    if (w.nodeType === 3) tlumaczTekst(w, true);
    else if (w.nodeType === 1) tlumaczAtrybuty(w, true);
  }
}

function zastosuj(korzen = document.body) {
  wlasneZmiany = true;
  try { zastosujKlucze(korzen === document.body ? document.documentElement : korzen); tlumaczDrzewo(korzen); } finally { obserwator?.takeRecords(); wlasneZmiany = false; }
}

function obserwuj() {
  if (obserwator) return;
  obserwator = new MutationObserver((zmiany) => {
    if (wlasneZmiany || jezyk === 'pl') return;
    wlasneZmiany = true;
    try {
      for (const z of zmiany) {
        if (z.type === 'childList') z.addedNodes.forEach((n) => { zastosujKlucze(n); tlumaczDrzewo(n); });
        else if (z.type === 'characterData') tlumaczTekst(z.target);
        else if (z.type === 'attributes') tlumaczAtrybuty(z.target);
      }
    } finally { obserwator.takeRecords(); wlasneZmiany = false; }
  });
  obserwator.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRYBUTY });
}

export async function ustawJezyk(nowy, { zapamietaj = true } = {}) {
  if (!JEZYKI[nowy]) nowy = 'pl';
  // Słownik kluczy bieżącego języka i polski (rozpoznanie napisów klucza przy przełączaniu języków).
  [klucze] = await Promise.all([wczytajKlucze(nowy), wczytajKlucze('pl')]);
  jezyk = nowy;
  jezykKluczy = nowy;
  pamiecNapisow = new Map();
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
