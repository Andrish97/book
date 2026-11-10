// Własne kontrolki zamiast systemowych: lista rozwijana i wybór koloru.
//
// W kodzie aplikacji nadal są zwykłe <select> i <input type="color"> – to one
// trzymają wartość i wysyłają zdarzenia „input” i „change”. Ten moduł dokłada
// do każdego z nich własny przycisk i własne okienko, a element systemowy
// zostaje niewidoczny pod spodem. Dzięki temu reszta kodu (i czytniki ekranu
// przez role ARIA) nie musi wiedzieć, że kontrolka jest własna.
//
// Okienko trafia do otwartego okna dialogowego albo do <body> – inaczej
// w modalnym oknie byłoby nieklikalne.

const wartoscSelect = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
const indeksSelect = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
const wartoscInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

let otwarte = null; // { okienko, zamknij }

function zamknijOkienko() {
  if (!otwarte) return;
  const o = otwarte;
  otwarte = null;
  o.okienko.remove();
  o.poZamknieciu?.();
}

// Ustawia okienko pod przyciskiem (albo nad nim, gdy na dole brakuje miejsca).
function ustawPod(okienko, przycisk, { szerokoscJakPrzycisk = false } = {}) {
  const r = przycisk.getBoundingClientRect();
  const okno = { w: window.innerWidth, h: window.innerHeight };
  if (szerokoscJakPrzycisk) okienko.style.minWidth = `${Math.round(r.width)}px`;
  okienko.style.maxHeight = '';
  const wys = okienko.offsetHeight;
  const szer = okienko.offsetWidth;
  const miejsceNizej = okno.h - r.bottom - 8;
  const miejsceWyzej = r.top - 8;
  const nizej = wys <= miejsceNizej || miejsceNizej >= miejsceWyzej;
  const dostepne = Math.max(120, nizej ? miejsceNizej : miejsceWyzej);
  okienko.style.maxHeight = `${Math.round(dostepne)}px`;
  const h = Math.min(wys, dostepne);
  okienko.style.top = `${Math.round(nizej ? r.bottom + 4 : r.top - h - 4)}px`;
  okienko.style.left = `${Math.round(Math.max(8, Math.min(r.left, okno.w - szer - 8)))}px`;
}

function otworzOkienko(okienko, przycisk, opcje = {}) {
  zamknijOkienko();
  (przycisk.closest('dialog') || document.body).append(okienko);
  ustawPod(okienko, przycisk, opcje);
  otwarte = { okienko, przycisk, poZamknieciu: opcje.poZamknieciu };
}

document.addEventListener('pointerdown', (e) => {
  if (otwarte && !otwarte.okienko.contains(e.target) && !otwarte.przycisk.contains(e.target)) zamknijOkienko();
}, true);
window.addEventListener('resize', zamknijOkienko);
document.addEventListener('scroll', (e) => { if (otwarte && !otwarte.okienko.contains(e.target)) zamknijOkienko(); }, true);
document.addEventListener('close', zamknijOkienko, true); // zamknięcie okna dialogowego

// ---------- Lista rozwijana ----------

function ulepszSelect(sel) {
  if (sel.dataset.wybor || sel.multiple) return;
  sel.dataset.wybor = '1';
  const opak = document.createElement('span');
  opak.className = 'wybor';
  const przycisk = document.createElement('button');
  przycisk.type = 'button';
  przycisk.className = 'wybor-przycisk';
  przycisk.setAttribute('aria-haspopup', 'listbox');
  przycisk.setAttribute('aria-expanded', 'false');
  przycisk.innerHTML = '<span class="wybor-tekst"></span><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  sel.before(opak);
  opak.append(przycisk, sel);
  sel.classList.add('wybor-natywny');
  sel.tabIndex = -1;
  sel.setAttribute('aria-hidden', 'true');
  const tekst = przycisk.querySelector('.wybor-tekst');

  const odswiez = () => {
    const o = sel.options[sel.selectedIndex];
    tekst.textContent = o ? o.textContent : '';
    tekst.style.fontFamily = o?.style.fontFamily || '';
    przycisk.disabled = sel.disabled;
    const etykieta = sel.getAttribute('aria-label') || sel.closest('label')?.querySelector('span')?.textContent || sel.closest('label')?.firstChild?.textContent?.trim();
    if (etykieta) przycisk.setAttribute('aria-label', `${etykieta}: ${tekst.textContent}`);
  };
  // Wartość ustawiona z kodu (sel.value = …) nie wysyła zdarzenia – łapiemy ją tutaj.
  Object.defineProperty(sel, 'value', { configurable: true, get() { return wartoscSelect.get.call(this); }, set(v) { wartoscSelect.set.call(this, v); odswiez(); } });
  Object.defineProperty(sel, 'selectedIndex', { configurable: true, get() { return indeksSelect.get.call(this); }, set(v) { indeksSelect.set.call(this, v); odswiez(); } });
  sel.addEventListener('change', odswiez);
  sel.addEventListener('input', odswiez);
  sel.addEventListener('focus', () => przycisk.focus());
  new MutationObserver(odswiez).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected', 'label'] });
  odswiez();

  const wybierz = (wartosc) => {
    zamknijOkienko();
    przycisk.focus();
    if (wartoscSelect.get.call(sel) === wartosc) return;
    sel.value = wartosc;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const otworz = () => {
    if (sel.disabled) return;
    const lista = document.createElement('div');
    lista.className = 'wybor-lista';
    lista.setAttribute('role', 'listbox');
    lista.tabIndex = -1;
    const pozycje = [];
    const dodaj = (o, wGrupie) => {
      const el = document.createElement('div');
      el.className = `wybor-opcja${wGrupie ? ' w-grupie' : ''}`;
      el.setAttribute('role', 'option');
      el.textContent = o.textContent;
      el.style.fontFamily = o.style.fontFamily || '';
      el.dataset.wartosc = o.value;
      if (o.disabled) el.setAttribute('aria-disabled', 'true');
      if (o.selected) el.setAttribute('aria-selected', 'true');
      lista.append(el);
      if (!o.disabled) pozycje.push(el);
    };
    for (const dziecko of sel.children) {
      if (dziecko.tagName === 'OPTGROUP') {
        const g = document.createElement('div');
        g.className = 'wybor-grupa';
        g.textContent = dziecko.label;
        lista.append(g);
        for (const o of dziecko.children) dodaj(o, true);
      } else dodaj(dziecko, false);
    }
    let aktywna = Math.max(0, pozycje.findIndex((p) => p.getAttribute('aria-selected') === 'true'));
    const zaznacz = (i, przewin = true) => {
      pozycje[aktywna]?.classList.remove('aktywna');
      aktywna = Math.min(pozycje.length - 1, Math.max(0, i));
      pozycje[aktywna]?.classList.add('aktywna');
      if (przewin) pozycje[aktywna]?.scrollIntoView({ block: 'nearest' });
    };
    lista.addEventListener('pointermove', (e) => { const el = e.target.closest('.wybor-opcja'); const i = pozycje.indexOf(el); if (i >= 0 && i !== aktywna) zaznacz(i, false); });
    lista.addEventListener('click', (e) => { const el = e.target.closest('.wybor-opcja'); if (el && pozycje.includes(el)) wybierz(el.dataset.wartosc); });
    let wpisane = '';
    let czasWpisu = 0;
    lista.addEventListener('keydown', (e) => {
      e.stopPropagation(); // klawisze w otwartej liście nie są skrótami edytora
      if (e.key === 'ArrowDown') { e.preventDefault(); zaznacz(aktywna + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); zaznacz(aktywna - 1); }
      else if (e.key === 'Home') { e.preventDefault(); zaznacz(0); }
      else if (e.key === 'End') { e.preventDefault(); zaznacz(pozycje.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (pozycje[aktywna]) wybierz(pozycje[aktywna].dataset.wartosc); }
      else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); zamknijOkienko(); przycisk.focus(); }
      else if (e.key.length === 1) {
        // Pisanie liter przeskakuje do pierwszej pasującej pozycji.
        const teraz = Date.now();
        wpisane = teraz - czasWpisu > 700 ? e.key : wpisane + e.key;
        czasWpisu = teraz;
        const i = pozycje.findIndex((p) => p.textContent.trim().toLocaleLowerCase('pl').startsWith(wpisane.toLocaleLowerCase('pl')));
        if (i >= 0) zaznacz(i);
      }
    });
    przycisk.setAttribute('aria-expanded', 'true');
    otworzOkienko(lista, przycisk, { szerokoscJakPrzycisk: true, poZamknieciu: () => przycisk.setAttribute('aria-expanded', 'false') });
    zaznacz(aktywna);
    lista.focus({ preventScroll: true });
  };

  przycisk.addEventListener('click', (e) => {
    e.preventDefault();
    if (otwarte?.przycisk === przycisk) zamknijOkienko(); else otworz();
  });
  przycisk.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); otworz(); }
  });
}

// ---------- Wybór koloru ----------

const PALETA = ['#1a1a1a', '#4a4843', '#807d75', '#cfccc3', '#ffffff', '#b42318', '#d1495b', '#e8590c', '#edae49', '#f2cc0c', '#66a182', '#2f9e44', '#00798c', '#2e86ab', '#2f5bd3', '#1d3f9e', '#8d6a9f', '#7c3aed', '#c2255c', '#6b4f3a'];
const KLUCZ_OSTATNICH = 'seriodruk:ostatnie-kolory';

const hexNaRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbNaHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
function rgbNaHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, max ? d / max : 0, max];
}
function hsvNaRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const poprawnyHex = (t) => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t.trim()); if (!m) return null; const h = m[1].length === 3 ? [...m[1]].map((z) => z + z).join('') : m[1]; return `#${h.toLowerCase()}`; };

function ostatnieKolory() {
  try { return JSON.parse(localStorage.getItem(KLUCZ_OSTATNICH) || '[]').filter((k) => poprawnyHex(k)).slice(0, 10); } catch { return []; }
}
function zapamietajKolor(hex) {
  try { localStorage.setItem(KLUCZ_OSTATNICH, JSON.stringify([hex, ...ostatnieKolory().filter((k) => k !== hex)].slice(0, 10))); } catch { /* tryb prywatny – trudno */ }
}

function ulepszKolor(input) {
  if (input.dataset.kolor) return;
  input.dataset.kolor = '1';
  const opak = document.createElement('span');
  opak.className = 'wybor-koloru';
  const przycisk = document.createElement('button');
  przycisk.type = 'button';
  przycisk.className = 'kolor-przycisk';
  przycisk.setAttribute('aria-haspopup', 'dialog');
  przycisk.innerHTML = '<i></i>';
  input.before(opak);
  opak.append(przycisk, input);
  input.classList.add('kolor-natywny');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  const odswiez = () => {
    przycisk.firstElementChild.style.background = wartoscInput.get.call(input);
    przycisk.disabled = input.disabled;
    przycisk.setAttribute('aria-label', `Kolor ${wartoscInput.get.call(input)} – zmień`);
  };
  Object.defineProperty(input, 'value', { configurable: true, get() { return wartoscInput.get.call(this); }, set(v) { wartoscInput.set.call(this, v); odswiez(); } });
  new MutationObserver(odswiez).observe(input, { attributes: true, attributeFilter: ['disabled'] });
  input.addEventListener('input', odswiez);
  odswiez();

  const otworz = () => {
    if (input.disabled) return;
    const poczatkowy = wartoscInput.get.call(input);
    let [h, s, v] = rgbNaHsv(...hexNaRgb(poczatkowy));
    let zmieniono = false;
    const okienko = document.createElement('div');
    okienko.className = 'kolor-okienko';
    okienko.setAttribute('role', 'dialog');
    okienko.setAttribute('aria-label', 'Wybór koloru');
    okienko.innerHTML = `
      <div class="kolor-pole" tabindex="0" role="slider" aria-label="Nasycenie i jasność"><i></i></div>
      <div class="kolor-barwa" tabindex="0" role="slider" aria-label="Barwa" aria-valuemin="0" aria-valuemax="360"><i></i></div>
      <label class="kolor-hex"><span>Kod koloru</span><input type="text" maxlength="7" spellcheck="false" autocomplete="off"></label>
      <div class="kolor-paleta" role="group" aria-label="Gotowe kolory"></div>
      <div class="kolor-paleta ostatnie" role="group" aria-label="Ostatnio używane" hidden></div>`;
    const pole = okienko.querySelector('.kolor-pole');
    const barwa = okienko.querySelector('.kolor-barwa');
    const hex = okienko.querySelector('.kolor-hex input');
    const ustaw = (zHex = false) => {
      const kolor = rgbNaHex(...hsvNaRgb(h, s, v));
      pole.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))`;
      pole.firstElementChild.style.cssText = `left:${s * 100}%;top:${(1 - v) * 100}%;background:${kolor}`;
      barwa.firstElementChild.style.left = `${(h / 360) * 100}%`;
      barwa.setAttribute('aria-valuenow', String(Math.round(h)));
      if (!zHex) hex.value = kolor;
      if (kolor !== wartoscInput.get.call(input)) {
        input.value = kolor;
        zmieniono = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    const zKoloru = (kolor) => { [h, s, v] = rgbNaHsv(...hexNaRgb(kolor)); ustaw(); };
    const ciagnij = (el, naRuch) => {
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        const ruch = (ev) => { const r = el.getBoundingClientRect(); naRuch(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))); ustaw(); };
        ruch(e);
        el.addEventListener('pointermove', ruch);
        el.addEventListener('pointerup', () => el.removeEventListener('pointermove', ruch), { once: true });
      });
    };
    ciagnij(pole, (x, y) => { s = x; v = 1 - y; });
    ciagnij(barwa, (x) => { h = Math.min(359.9, x * 360); });
    pole.addEventListener('keydown', (e) => {
      const krok = e.shiftKey ? 0.1 : 0.02;
      if (e.key === 'ArrowLeft') s = Math.max(0, s - krok); else if (e.key === 'ArrowRight') s = Math.min(1, s + krok);
      else if (e.key === 'ArrowUp') v = Math.min(1, v + krok); else if (e.key === 'ArrowDown') v = Math.max(0, v - krok); else return;
      e.preventDefault(); ustaw();
    });
    barwa.addEventListener('keydown', (e) => {
      const krok = e.shiftKey ? 30 : 5;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') h = Math.max(0, h - krok); else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') h = Math.min(359.9, h + krok); else return;
      e.preventDefault(); ustaw();
    });
    hex.addEventListener('input', () => { const k = poprawnyHex(hex.value); if (k) { [h, s, v] = rgbNaHsv(...hexNaRgb(k)); ustaw(true); } });
    hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); zamknijOkienko(); przycisk.focus(); } });
    const paleta = (el, kolory) => {
      for (const k of kolory) {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.background = k;
        b.title = k;
        b.setAttribute('aria-label', `Kolor ${k}`);
        b.addEventListener('click', () => zKoloru(k));
        el.append(b);
      }
    };
    paleta(okienko.querySelector('.kolor-paleta'), PALETA);
    const ostatnie = ostatnieKolory();
    if (ostatnie.length) { const el = okienko.querySelector('.kolor-paleta.ostatnie'); el.hidden = false; paleta(el, ostatnie); }
    okienko.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); zamknijOkienko(); przycisk.focus(); } });
    otworzOkienko(okienko, przycisk, {
      poZamknieciu: () => {
        if (!zmieniono) return;
        zapamietajKolor(wartoscInput.get.call(input));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
    ustaw();
    hex.select();
  };
  przycisk.addEventListener('click', (e) => { e.preventDefault(); if (otwarte?.przycisk === przycisk) zamknijOkienko(); else otworz(); });
}

// ---------- Podpinanie ----------

function ulepsz(korzen) {
  if (korzen.nodeType !== 1) return;
  if (korzen.matches?.('select')) ulepszSelect(korzen);
  if (korzen.matches?.('input[type="color"]')) ulepszKolor(korzen);
  korzen.querySelectorAll?.('select:not([data-wybor])').forEach(ulepszSelect);
  korzen.querySelectorAll?.('input[type="color"]:not([data-kolor])').forEach(ulepszKolor);
}

export function wlaczWlasneKontrolki() {
  ulepsz(document.body);
  new MutationObserver((zmiany) => {
    for (const z of zmiany) for (const w of z.addedNodes) ulepsz(w);
  }).observe(document.body, { childList: true, subtree: true });
}
