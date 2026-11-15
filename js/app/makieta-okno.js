// Okno „Makieta 3D” (#131D): projekt jako wydrukowana rzecz – książka, notes, kalendarz, kartka – z kartkowaniem,
// obracaniem myszą lub palcem, powiększaniem i zapisem obrazu PNG. Geometria i WebGL: js/makieta-3d.js.
// Okładka pochodzi z sekcji okładki (#119): tył, grzbiet i przód wycięte z jej strony według stref.

import { $, powiadom, bezpiecznaNazwa } from '../ui.js';
import { rozwin } from '../serie.js';
import { renderujCel } from '../zlozenie.js';
import { geometriaOkladki, jestOkladka, normalizujOkladke } from '../okladka.js';
import { MODELE, kartkiModelu, polozenia, opisPolozenia, scena, obwiednia, utworzRenderer } from '../makieta-3d.js';

const dlg = $('#dlg-makieta');
const plotno = $('#makieta-plotno');
const wybor = $('#makieta-model');
const SZEROKOSC_STRONY = 720; // px tekstury strony – ostro na telefonie i przy zbliżeniu, szybko się liczy

let st = null; // { projekt, ciag, strony, okladka, format, model, kartki, u, cel, kamera, ... }
let renderer = null;
let klatka = 0;

wybor.replaceChildren(...Object.entries(MODELE).map(([id, nazwa]) => new Option(nazwa, id)));

// Domyślny model: z okładką – książka (twarda, gdy taka oprawa), kalendarz z nazwy albo z 12–14 kart,
// jedna strona – kartka, reszta – książka w miękkiej oprawie.
export function domyslnyModel(projekt, liczbaStron, okladka) {
  if (okladka) return normalizujOkladke(okladka.okladka).oprawa === 'twarda' ? 'ksiazka_twarda' : 'ksiazka_miekka';
  const nazwa = String(projekt.nazwa || '').toLowerCase();
  if (/biurk/.test(nazwa)) return 'kalendarz_biurkowy';
  if (/kalend/.test(nazwa) || (liczbaStron >= 12 && liczbaStron <= 14)) return 'kalendarz_scienny';
  if (liczbaStron <= 2) return 'kartka';
  return 'ksiazka_miekka';
}

const obrazZUrl = (url) => new Promise((ok, zle) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => zle(new Error('Nie udało się narysować strony.'));
  img.src = url;
});

// Tekstury wczytywane w tle: najpierw te widoczne, potem sąsiednie.
const wToku = new Set();
async function wczytajTeksture(klucz) {
  if (!st || !renderer || renderer.maTeksture(klucz) || wToku.has(klucz)) return;
  const moje = st;
  wToku.add(klucz);
  try {
    let obraz;
    if (klucz.startsWith('p:')) {
      const egz = moje.strony[Number(klucz.slice(2))];
      obraz = egz.pusta ? null : await obrazZUrl(await renderujCel(moje.projekt, egz, { szerokoscPx: SZEROKOSC_STRONY, spad: false, ciag: moje.ciag }));
    } else if (klucz.startsWith('okl:')) {
      obraz = await czescOkladki(moje, klucz.slice(4));
    }
    if (moje !== st || !renderer) return;
    renderer.ustawTeksture(klucz, obraz || '#ffffff');
    rysujPozniej();
  } catch {
    if (moje === st && renderer) renderer.ustawTeksture(klucz, '#ffffff');
  } finally { wToku.delete(klucz); }
}

// Okładka: cała strona sekcji okładki raz, potem wycinki stref (tył | grzbiet | przód, bez zawinięć).
async function czescOkladki(moje, czesc) {
  moje.obrazOkladki ||= (async () => {
    const egz = moje.ciag.egzemplarze.find((e) => e.sekcja.id === moje.okladka.id);
    const szer = Math.round(Math.min(3000, 9 * moje.okladka.wydruk.szerokosc_mm));
    return obrazZUrl(await renderujCel(moje.projekt, egz, { szerokoscPx: szer, spad: false, ciag: moje.ciag }));
  })();
  const img = await moje.obrazOkladki;
  const g = moje.geometria;
  const s = img.width / moje.okladka.wydruk.szerokosc_mm;
  const strefa = g.strefy.find((z) => z.rodzaj === czesc);
  if (!strefa) return null;
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round((strefa.x2 - strefa.x1) * s));
  c.height = Math.max(2, Math.round((g.dol - g.gora) * s));
  c.getContext('2d').drawImage(img, strefa.x1 * s, g.gora * s, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

function rysujPozniej() {
  if (klatka) return;
  klatka = requestAnimationFrame(rysuj);
}

function rysuj() {
  klatka = 0;
  if (!st || !renderer) return;
  // Animacja kartkowania: u dąży do celu.
  if (st.u !== st.cel) {
    const krok = Math.min(1, (performance.now() - (st.czas || performance.now())) / 550);
    st.czas = performance.now();
    st.u = st.cel > st.u ? Math.min(st.cel, st.u + krok) : Math.max(st.cel, st.u - krok);
    if (st.u !== st.cel) klatka = requestAnimationFrame(rysuj);
  }
  const quady = scena(st.model, st.kartki, st.u);
  for (const q of quady) if (!renderer.maTeksture(q.tex)) wczytajTeksture(q.tex);
  const ob = obwiednia(quady);
  const k = st.kamera;
  k.srodek = k.srodek ? k.srodek.map((v, i) => v + (ob.srodek[i] - v) * 0.25) : ob.srodek;
  if (k.srodek.some((v, i) => Math.abs(v - ob.srodek[i]) > 0.3)) rysujPozniej();
  k.odleglosc = (st.rozmiar * 2.3) / k.zoom;
  renderer.rysuj(quady, k);
  $('#makieta-polozenie').textContent = opisPolozenia(st.model, st.kartki, st.cel);
  $('#makieta-wstecz').disabled = st.cel <= 0;
  $('#makieta-dalej').disabled = st.cel >= polozenia(st.model, st.kartki);
  plotno.dataset.gotowe = String(!wToku.size && st.u === st.cel);
  // Wczytaj z wyprzedzeniem sąsiednie kartki.
  for (const d of [1, -1, 2]) {
    const sasiad = scena(st.model, st.kartki, Math.max(0, Math.min(polozenia(st.model, st.kartki), Math.round(st.cel) + d)));
    for (const q of sasiad) if (!renderer.maTeksture(q.tex) && /^(p|okl):/.test(q.tex)) wczytajTeksture(q.tex);
  }
}

function ustawModel(model) {
  st.model = model;
  st.kartki = kartkiModelu(model, {
    strony: st.strony.length,
    format: st.format,
    okladka: st.geometria ? { w: st.geometria.strefy.find((z) => z.rodzaj === 'przod')?.x2 - st.geometria.strefy.find((z) => z.rodzaj === 'przod')?.x1, h: st.geometria.dol - st.geometria.gora, tektura: normalizujOkladke(st.okladka.okladka).tektura_mm } : null,
    kartka_mm: st.geometria?.kartka_mm || 0.1,
  });
  st.u = 0;
  st.cel = 0;
  st.rozmiar = Math.max(st.format.w * (model.startsWith('ksiazka') || model === 'notes' ? 1.6 : 1.1), st.format.h);
  st.kamera.srodek = null;
  wybor.value = model;
  try { sessionStorage.setItem(`makieta:${st.projekt.id}`, model); } catch { /* bez pamięci – zostaje domyślny */ }
  rysujPozniej();
}

export function kartkuj(d) {
  if (!st) return;
  const max = polozenia(st.model, st.kartki);
  st.cel = Math.max(0, Math.min(max, Math.round(st.cel) + d));
  st.czas = performance.now();
  rysujPozniej();
}

function dopasujPlotno() {
  const r = plotno.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (plotno.width !== w || plotno.height !== h) { plotno.width = w; plotno.height = h; }
  rysujPozniej();
}
const obserwator = new ResizeObserver(() => { if (st) dopasujPlotno(); });

export function otworzMakiete(projekt) {
  const ciag = rozwin(projekt);
  const okladka = projekt.sekcje.find((s) => jestOkladka(s)) || null;
  const strony = ciag.egzemplarze.filter((e) => !jestOkladka(e.sekcja));
  const pierwsza = projekt.sekcje.find((s) => !jestOkladka(s)) || projekt.sekcje[0];
  const format = { w: pierwsza.wydruk.szerokosc_mm, h: pierwsza.wydruk.wysokosc_mm };
  let geometria = null;
  try { if (okladka) geometria = geometriaOkladki(projekt, okladka, ciag); } catch { geometria = null; }
  renderer?.zwolnij();
  renderer = null;
  st = { projekt, ciag, strony, okladka: geometria ? okladka : null, geometria, format, kamera: { obrotY: 0.5, obrotX: 0.28, zoom: 1, srodek: null } };
  if (!dlg.open) dlg.showModal();
  renderer = utworzRenderer(plotno);
  $('#makieta-brak-3d').hidden = Boolean(renderer);
  if (!renderer) return;
  let zapamietany = null;
  try { zapamietany = sessionStorage.getItem(`makieta:${projekt.id}`); } catch { /* bez pamięci */ }
  ustawModel(MODELE[zapamietany] ? zapamietany : domyslnyModel(projekt, strony.length, st.okladka));
  obserwator.observe(plotno);
  dopasujPlotno();
}

export const stanMakiety = () => (st ? { model: st.model, u: st.u, cel: st.cel, kartek: st.kartki.length, polozen: polozenia(st.model, st.kartki), kamera: { ...st.kamera }, renderer: Boolean(renderer) } : null);

// Obraz makiety (PNG, przezroczyste tło) – w większej rozdzielczości niż na ekranie.
export async function pobierzObrazMakiety() {
  if (!st || !renderer) return;
  const { width: w0, height: h0 } = plotno;
  const skala = Math.max(1, 2400 / Math.max(w0, h0));
  plotno.width = Math.round(w0 * skala);
  plotno.height = Math.round(h0 * skala);
  const quady = scena(st.model, st.kartki, st.cel);
  renderer.rysuj(quady, { ...st.kamera, srodek: obwiednia(quady).srodek });
  const blob = await new Promise((ok) => plotno.toBlob(ok, 'image/png'));
  plotno.width = w0;
  plotno.height = h0;
  rysujPozniej();
  if (!blob) { powiadom('Nie udało się zapisać obrazu makiety.', true); return; }
  const url = URL.createObjectURL(blob);
  // Odnośnik w oknie: reszta strony pod otwartym oknem jest nieaktywna i przeglądarka gubi nazwę pliku.
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bezpiecznaNazwa(st.projekt.nazwa)} - makieta.png`;
  dlg.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function powiekszMakiete(k) {
  if (!st) return;
  st.kamera.zoom = Math.max(0.4, Math.min(5, st.kamera.zoom * k));
  rysujPozniej();
}
export function widokZPrzodu() {
  if (!st) return;
  Object.assign(st.kamera, { obrotY: st.model.startsWith('ksiazka') || st.model === 'notes' ? 0.5 : 0.35, obrotX: 0.28, zoom: 1 });
  rysujPozniej();
}

// Obracanie: przeciągnięcie myszą lub palcem; dwa palce – powiększanie; krótkie stuknięcie w prawą / lewą
// połowę – następna / poprzednia kartka.
const palce = new Map();
let start = null;
plotno.addEventListener('pointerdown', (e) => {
  plotno.setPointerCapture(e.pointerId);
  palce.set(e.pointerId, { x: e.clientX, y: e.clientY });
  start = palce.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), ruch: 0 } : null;
});
plotno.addEventListener('pointermove', (e) => {
  const p = palce.get(e.pointerId);
  if (!p || !st) return;
  if (palce.size === 2) {
    const [a, b] = [...palce.values()];
    const przed = Math.hypot(a.x - b.x, a.y - b.y);
    p.x = e.clientX; p.y = e.clientY;
    const [c, d] = [...palce.values()];
    const po = Math.hypot(c.x - d.x, c.y - d.y);
    if (przed > 10) powiekszMakiete(po / przed);
    return;
  }
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (start) start.ruch += Math.abs(dx) + Math.abs(dy);
  st.kamera.obrotY += dx * 0.01;
  st.kamera.obrotX = Math.max(-1.45, Math.min(1.45, st.kamera.obrotX + dy * 0.01));
  rysujPozniej();
});
const puszczony = (e) => {
  palce.delete(e.pointerId);
  if (start && e.type === 'pointerup' && start.ruch < 8 && performance.now() - start.t < 400) {
    const r = plotno.getBoundingClientRect();
    kartkuj(e.clientX > r.left + r.width / 2 ? 1 : -1);
  }
  start = null;
};
plotno.addEventListener('pointerup', puszczony);
plotno.addEventListener('pointercancel', puszczony);
plotno.addEventListener('wheel', (e) => { e.preventDefault(); powiekszMakiete(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
dlg.addEventListener('keydown', (e) => {
  if (e.target.closest('select, input')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); kartkuj(1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); kartkuj(-1); }
});
wybor.addEventListener('change', () => { if (st) ustawModel(wybor.value); });
$('#makieta-wstecz').addEventListener('click', () => kartkuj(-1));
$('#makieta-dalej').addEventListener('click', () => kartkuj(1));
dlg.addEventListener('close', () => {
  obserwator.disconnect();
  cancelAnimationFrame(klatka);
  klatka = 0;
  renderer?.zwolnij();
  renderer = null;
  st = null;
});
