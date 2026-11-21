// Sprawdzanie pisowni w edytorze (#131C): Web Worker ze słownikiem (js/pisownia-worker.js), pamięć wyników
// dla słów, falista linia na płótnie (Edytor._podkreslPisownie) i słownik użytkownika zapisany na koncie
// (user_metadata.slownik – ten sam na każdym urządzeniu). Włączanie: menu widoku „Sprawdzaj pisownię”.

import { slowaWTekscie } from '../pisownia-rdzen.js';
import * as chmura from '../chmura.js';
import { edytor, stan } from './kontekst.js';
import { zamknijMenu } from '../ui.js';
import { t as tt } from '../jezyk.js';

const KLUCZ = 'makietka:pisownia';
let wlaczona = (() => { try { return localStorage.getItem(KLUCZ) !== '0'; } catch { return true; } })();

let worker = null;
let nr = 0;
const czekajace = new Map();
function zapytaj(dane) {
  if (!worker) {
    worker = new window.Worker(new URL('../pisownia-worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (e) => {
      const z = czekajace.get(e.data.id);
      if (!z) return;
      czekajace.delete(e.data.id);
      if (e.data.blad) z.blad(new Error(e.data.blad)); else z.ok(e.data.wynik);
    });
    const wlasne = wlasneSlowa();
    if (wlasne.length) zapytaj({ rodzaj: 'wlasne', slowa: wlasne }).catch(() => {});
  }
  const id = (nr += 1);
  return new Promise((ok, blad) => { czekajace.set(id, { ok, blad }); worker.postMessage({ id, ...dane }); });
}

// Wyniki dla słów: słowo → true (dobrze) / false (błąd). Słowa, o które już pytamy, czekają w kolejce.
const wyniki = new Map();
const kolejka = new Set();
let timer = null;
function zaplanujSprawdzenie() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const slowa = [...kolejka];
    kolejka.clear();
    if (!slowa.length) return;
    try {
      const zle = new Set(await zapytaj({ rodzaj: 'sprawdz', slowa }));
      for (const s of slowa) wyniki.set(s, !zle.has(s));
      if (zle.size) edytor.canvas?.requestRenderAll();
    } catch { for (const s of slowa) wyniki.set(s, true); } // bez słownika nic nie podkreślamy
  }, 250);
}

function wlasneSlowa() {
  const z = stan.uzytkownik?.user_metadata?.slownik;
  return Array.isArray(z) ? z : [];
}

// Zakresy błędów w tekście (na płótnie). Słowa jeszcze niesprawdzone idą do kolejki.
function bledy(o) {
  if (!wlaczona || !o?.text) return [];
  const wynik = [];
  for (const s of slowaWTekscie(o.text)) {
    const w = wyniki.get(s.slowo);
    if (w === undefined) { if (!kolejka.has(s.slowo)) { kolejka.add(s.slowo); zaplanujSprawdzenie(); } continue; }
    if (!w) wynik.push(s);
  }
  return wynik;
}

// Lista błędnych słów w tekście (bez powtórzeń) – dla panelu; czeka na słownik.
async function bledyTekstu(o) {
  const slowa = [...new Set(slowaWTekscie(o?.text || '').map((s) => s.slowo))];
  if (!slowa.length) return [];
  const zle = await zapytaj({ rodzaj: 'sprawdz', slowa });
  for (const s of slowa) wyniki.set(s, !zle.includes(s));
  return zle;
}

const podpowiedzi = (slowo) => zapytaj({ rodzaj: 'podpowiedzi', slowo, ile: 6 });

// Zamiana błędnego słowa w tekście (wszystkie jego wystąpienia w tym elemencie, całe słowa).
function popraw(o, slowo, nowe) {
  if (!o?.text) return;
  const zakresy = slowaWTekscie(o.text).filter((s) => s.slowo === slowo).reverse();
  // insertChars podmienia znaki razem z wyglądem fragmentów (styl pierwszego zamienianego znaku zostaje).
  for (const z of zakresy) {
    if (typeof o.insertChars === 'function') o.insertChars(nowe, null, z.start, z.koniec);
    else o.text = o.text.slice(0, z.start) + nowe + o.text.slice(z.koniec);
  }
  o.initDimensions?.();
  o.dirty = true;
  edytor.zatwierdz();
}

async function dodajDoSlownika(slowo) {
  const lista = [...new Set([...wlasneSlowa(), slowo])].slice(-2000);
  wyniki.set(slowo, true);
  try {
    if (stan.uzytkownik) {
      const u = await chmura.zapiszSlownik(lista);
      if (u) stan.uzytkownik = u;
    }
  } catch { /* bez sieci – zostaje w tej karcie */ }
  await zapytaj({ rodzaj: 'wlasne', slowa: lista }).catch(() => {});
  edytor.canvas?.requestRenderAll();
}

function ustawWlaczona(tak) {
  wlaczona = Boolean(tak);
  try { localStorage.setItem(KLUCZ, wlaczona ? '1' : '0'); } catch { /* tryb prywatny */ }
  edytor.pisownia = wlaczona ? sprawdzanie : null;
  edytor.canvas?.requestRenderAll();
}

export const sprawdzanie = { bladPodKursorem, bledy, bledyTekstu, podpowiedzi, popraw, dodajDoSlownika, wlaczona: () => wlaczona, ustawWlaczona };

// Dymek przy podkreślonym słowie (#140): kliknięcie (stuknięcie) w słowo w pisanym tekście albo prawy
// przycisk myszy pokazuje podpowiedzi i „Dodaj do słownika” – tuż przy słowie, bez szukania w panelu.
function bladPodKursorem(o) {
  if (!wlaczona || !o?.isEditing || o.selectionStart !== o.selectionEnd) return null;
  const i = o.selectionStart;
  return bledy(o).find((b) => b.start <= i && i <= b.koniec) || null;
}

function zamienZakres(o, b, nowe) {
  if (o.text.slice(b.start, b.koniec) !== b.slowo) return;
  if (typeof o.insertChars === 'function') o.insertChars(nowe, null, b.start, b.koniec);
  else o.text = o.text.slice(0, b.start) + nowe + o.text.slice(b.koniec);
  o.initDimensions?.();
  o.selectionStart = o.selectionEnd = b.start + nowe.length;
  o._updateTextarea?.();
  o.dirty = true;
  edytor.zatwierdz();
  edytor.canvas.requestRenderAll();
}

async function pokazDymek(o, b, x, y) {
  zamknijMenu();
  let menu = document.getElementById('menu-pisowni');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'menu-pisowni';
    menu.className = 'menu menu-pisowni';
    menu.setAttribute('role', 'menu');
    document.body.append(menu);
  }
  const przycisk = (napis, fn, klasa = '') => {
    const el = document.createElement('button');
    el.type = 'button';
    el.setAttribute('role', 'menuitem');
    if (klasa) el.className = klasa;
    el.textContent = napis;
    el.addEventListener('click', () => { zamknijMenu(); fn(); });
    return el;
  };
  const tytul = document.createElement('small');
  tytul.className = 'menu-pisowni-tytul';
  tytul.textContent = tt('pisowniaPlotno.nieMaWSlowniku', { slowo: b.slowo });
  const czeka = document.createElement('small');
  czeka.className = 'menu-pisowni-tytul';
  czeka.textContent = tt('pisowniaPlotno.szukamPodpowiedzi');
  menu.replaceChildren(tytul, czeka, document.createElement('hr'), przycisk(tt('pisowniaPlotno.dodajDoSlownika'), () => dodajDoSlownika(b.slowo)));
  menu.hidden = false;
  const ustaw = () => {
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - r.width - 8, x))}px`;
    menu.style.top = `${Math.max(8, Math.min(window.innerHeight - r.height - 8, y + 12))}px`;
  };
  ustaw();
  let propozycje = [];
  try { propozycje = await podpowiedzi(b.slowo); } catch { /* bez słownika – tylko „Dodaj” */ }
  if (menu.hidden) return;
  czeka.replaceWith(...(propozycje.length ? propozycje.slice(0, 5).map((nowe) => przycisk(nowe, () => zamienZakres(o, b, nowe), 'podpowiedz-pisowni')) : [Object.assign(document.createElement('small'), { className: 'menu-pisowni-tytul', textContent: tt('pisowniaPlotno.brakPodpowiedzi') })]));
  ustaw();
}

function punktZdarzenia(e) {
  const t = e?.changedTouches?.[0] || e?.touches?.[0] || e;
  return { x: t?.clientX ?? 0, y: t?.clientY ?? 0 };
}

export function podlaczPisownie() {
  edytor.pisownia = wlaczona ? sprawdzanie : null;
  const c = edytor.canvas;
  if (!c || c.__dymekPisowni) return;
  c.__dymekPisowni = true;
  // Kursor ustawia się w tekście dopiero po puszczeniu przycisku – sprawdzamy chwilę później.
  c.on('mouse:up', (opt) => {
    const o = opt.target;
    if (!o?.isEditing || document.body.classList.contains('malarz-aktywny')) return;
    const { x, y } = punktZdarzenia(opt.e);
    setTimeout(() => { const b = bladPodKursorem(o); if (b) pokazDymek(o, b, x, y); }, 0);
  });
  c.upperCanvasEl?.addEventListener('contextmenu', (e) => {
    const o = edytor.aktywny;
    if (!o?.isEditing) return;
    // Prawy przycisk nie przesuwa kursora w Fabric – miejsce w tekście liczymy z położenia myszy.
    const i = typeof o.getSelectionStartFromPointer === 'function' ? o.getSelectionStartFromPointer(e) : o.selectionStart;
    const b = wlaczona ? bledy(o).find((z) => z.start <= i && i <= z.koniec) : null;
    if (!b) return;
    e.preventDefault();
    pokazDymek(o, b, e.clientX, e.clientY);
  });
}
