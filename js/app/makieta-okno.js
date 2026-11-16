// Okno „Makieta 3D” (#131D): projekt jako wydrukowana rzecz – książka, notes, kalendarz, kartka – z kartkowaniem,
// obracaniem myszą lub palcem, powiększaniem i zapisem obrazu PNG. Geometria i WebGL: js/makieta-3d.js.
// Okładka pochodzi z sekcji okładki (#119): tył, grzbiet i przód wycięte z jej strony według stref.

import { $, powiadom, bezpiecznaNazwa } from '../ui.js';
import { rozwin } from '../serie.js';
import { renderujCel } from '../zlozenie.js';
import { geometriaOkladki, jestOkladka, normalizujOkladke } from '../okladka.js';
import { MODELE, ukladStron, kartkiModelu, polozenia, opisPolozenia, scena, obwiednia, utworzRenderer, widokModelu, powodBrakuWebGL } from '../makieta-3d.js';

const dlg = $('#dlg-makieta');
const plotno = $('#makieta-plotno');
const wybor = $('#makieta-model');
// px tekstury strony (#161): 1280 na co dzień (telefon z dpr ~2,6 – strona ok. 1000 px na ekranie), po przybliżeniu
// strony rysują się od nowa w 2048 px – ostro z bliska; mipmapy w rendererze uśredniają z daleka.
const SZEROKOSC_STRONY = 1280;
const SZEROKOSC_OSTRA = 2048;

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
// ostra – ponowne wczytanie strony w wyższej rozdzielczości (stara tekstura zostaje do chwili podmiany).
async function wczytajTeksture(klucz, ostra = false) {
  if (!st || !renderer || (!ostra && renderer.maTeksture(klucz)) || wToku.has(klucz)) return;
  const moje = st;
  if (ostra) (moje.ostre ||= new Set()).add(klucz);
  const lista = st.lista;
  wToku.add(klucz);
  try {
    let obraz;
    if (klucz.startsWith('p:')) {
      const wpis = moje.lista[Number(klucz.slice(2))];
      obraz = wpis.egz.pusta ? null : await obrazStrony(moje, wpis);
    } else if (klucz.startsWith('okl:')) {
      obraz = await czescOkladki(moje, klucz.slice(4));
    }
    if (moje !== st || !renderer || (klucz.startsWith('p:') && moje.lista !== lista)) return;
    renderer.ustawTeksture(klucz, obraz || '#ffffff');
    rysujPozniej();
  } catch {
    if (moje === st && renderer) renderer.ustawTeksture(klucz, '#ffffff');
  } finally { wToku.delete(klucz); }
}

// Strona środka: obraz całej strony (raz na egzemplarz), połowa strony podwójnej szerokości – wycinek (#161).
function obrazStrony(moje, wpis) {
  moje.obrazy ||= new Map();
  const egz = wpis.egz;
  const klucz = `${moje.ostro ? 'o' : 'z'}|${moje.strony.indexOf(egz)}`;
  if (!moje.obrazy.has(klucz)) {
    const baza = moje.ostro ? SZEROKOSC_OSTRA : SZEROKOSC_STRONY;
    const szer = Math.min(4096, wpis.polowa ? 2 * baza : baza);
    moje.obrazy.set(klucz, renderujCel(moje.projekt, egz, { szerokoscPx: szer, spad: false, ciag: moje.ciag, oryginaly: Boolean(moje.ostro) }).then(obrazZUrl));
  }
  return moje.obrazy.get(klucz).then((img) => {
    if (!wpis.polowa) return img;
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.floor(img.width / 2));
    c.height = img.height;
    c.getContext('2d').drawImage(img, wpis.polowa === 'L' ? 0 : img.width - c.width, 0, c.width, c.height, 0, 0, c.width, c.height);
    return c;
  });
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

const ciemny = () => document.documentElement.dataset.motyw === 'ciemny';

// Kamera mieści całą rzecz w kadrze niezależnie od proporcji płótna (telefon w pionie, szerokie okno):
// odległość z promienia obwiedni i węższego z kątów widzenia. Zmiany środka i odległości są płynne.
const FOV = (28 * Math.PI) / 180;
function odlegloscDla(ob) {
  const asp = plotno.width / Math.max(1, plotno.height);
  const tV = Math.tan(FOV / 2);
  const tH = tV * asp;
  // Kadr dla bieżącego kąta kamery (#161 – po obróceniu rzecz nie wychodzi poza kadr); zmiana odległości
  // jest płynna, więc obracanie nie skacze. Rogi obwiedni w układzie kamery – każdy w kącie widzenia.
  const a = st.kamera.obrotX ?? widokModelu(st.model).obrotX;
  const b = st.kamera.obrotY ?? widokModelu(st.model).obrotY;
  let d = 0;
  for (const x of [ob.min[0], ob.max[0]]) for (const y of [ob.min[1], ob.max[1]]) for (const z of [ob.min[2], ob.max[2]]) {
    const [dx, dy, dz] = [x - ob.srodek[0], y - ob.srodek[1], z - ob.srodek[2]];
    const x1 = dx * Math.cos(b) + dz * Math.sin(b);
    const z1 = -dx * Math.sin(b) + dz * Math.cos(b);
    const y2 = dy * Math.cos(a) - z1 * Math.sin(a);
    const z2 = dy * Math.sin(a) + z1 * Math.cos(a);
    d = Math.max(d, z2 + Math.abs(x1) / tH, z2 + Math.abs(y2) / tV);
  }
  return Math.max(d * 1.12, ob.promien * 1.3);
}

function rysuj() {
  klatka = 0;
  if (!st || !renderer) return;
  dopasujRozmiar();
  // Animacja kartkowania: u dąży do celu.
  if (st.u !== st.cel) {
    const krok = Math.min(1, (performance.now() - (st.czas || performance.now())) / 550);
    st.czas = performance.now();
    st.u = st.cel > st.u ? Math.min(st.cel, st.u + krok) : Math.max(st.cel, st.u - krok);
    if (st.u !== st.cel) klatka = requestAnimationFrame(rysuj);
  }
  if (st.scena?.u !== st.u || st.scena.model !== st.model) st.scena = { u: st.u, model: st.model, quady: scena(st.model, st.kartki, st.u) };
  const { quady } = st.scena;
  for (const q of quady) if (!renderer.maTeksture(q.tex)) wczytajTeksture(q.tex);
  // Kadr z położenia docelowego (nie z przewracanej kartki) – bez „pompowania” przy kartkowaniu.
  const cu = Math.round(st.cel);
  if (st.kadr?.u !== cu || st.kadr.model !== st.model) st.kadr = { u: cu, model: st.model, ob: obwiednia(cu === st.u ? quady : scena(st.model, st.kartki, cu)) };
  const ob = st.kadr.ob;
  const k = st.kamera;
  const cel = odlegloscDla(ob);
  const celSrodek = k.przes ? ob.srodek.map((v, i) => v + k.przes[i]) : ob.srodek; // przes – tylko testy i zrzuty
  k.srodek = k.srodek ? k.srodek.map((v, i) => v + (celSrodek[i] - v) * 0.22) : celSrodek;
  k.baza = k.baza ? k.baza + (cel - k.baza) * 0.22 : cel;
  if (k.srodek.some((v, i) => Math.abs(v - celSrodek[i]) > 0.3) || Math.abs(k.baza - cel) > cel * 0.004) rysujPozniej();
  k.odleglosc = k.baza / k.zoom;
  // Przybliżenie: strony rysują się od nowa w wyższej rozdzielczości (raz – potem zostają ostre).
  if (k.zoom > 1.6) st.ostro = true;
  if (st.ostro) for (const q of quady) if (q.tex.startsWith('p:') && !st.ostre?.has(q.tex)) wczytajTeksture(q.tex, true);
  renderer.rysuj(quady, k, { ciemny: ciemny() });
  $('#makieta-polozenie').textContent = opisPolozenia(st.model, st.kartki, st.cel, (i) => st.numery?.[i] ?? null);
  $('#makieta-wstecz').disabled = st.cel <= 0;
  $('#makieta-dalej').disabled = st.cel >= polozenia(st.model, st.kartki);
  plotno.dataset.gotowe = String(!wToku.size && st.u === st.cel);
  // Wczytaj z wyprzedzeniem sąsiednie kartki.
  for (const d of [1, -1, 2]) {
    const sasiad = scena(st.model, st.kartki, Math.max(0, Math.min(polozenia(st.model, st.kartki), Math.round(st.cel) + d)));
    for (const q of sasiad) if (!renderer.maTeksture(q.tex) && /^(p|okl):/.test(q.tex)) wczytajTeksture(q.tex);
  }
}

// Lista stron modelu (#161). Rola sekcji wyłącznie z jej typu (#177): typSekcji(s) – 'okladka', 'wyklejka_przednia',
// 'wyklejka_tylna', 'obwoluta'… Wyklejki i obwoluta nie są kartkami bloku. W książce z okładką wyklejka przednia:
// pierwsza strona (albo lewa połowa arkusza dwa razy szerszego od bloku) przyklejona do wnętrza przedniej okładki,
// reszta – luźna kartka przed stroną 1; tylna odwrotnie. Twarda oprawa bez wyklejek – czysta wyklejka (papier).
// Blok zaczyna się od nowej kartki. Strony dwa razy szersze od bloku (rozkładówka na jednym arkuszu) – dwie
// połowy. Format bloku – najczęstszy format stron. Obwoluta – na razie bez modelu (docs/ZGLOSZENIA.md).
export const typSekcji = (s) => s?.typ || (s?.okladka ? 'okladka' : 'zwykla');
function listaStron(model) {
  const ksiazka = !model.startsWith('kalendarz') && model !== 'kartka';
  const typ = (e) => typSekcji(e.sekcja);
  const wyklejka = (e) => typ(e) === 'wyklejka_przednia' || typ(e) === 'wyklejka_tylna';
  // Obwoluta nigdy w kartkach; kalendarz i kartka – bez wyklejek i pustych stron wyrównujących.
  const egz = st.strony.filter((e) => typ(e) !== 'obwoluta' && (ksiazka || (!e.pusta && !wyklejka(e))));
  const { format, wpisy } = ukladStron(egz.map((e) => ({ w: e.sekcja?.wydruk?.szerokosc_mm || st.format.w, h: e.sekcja?.wydruk?.wysokosc_mm || st.format.h, pusta: e.pusta })));
  let lista = wpisy.map((x) => ({ ...x, egz: egz[x.zrodlo], typ: typ(egz[x.zrodlo]) }));
  const zOkladka = ksiazka && (Boolean(st.okladka) || model !== 'ksiazka_miekka');
  let wnetrze = { przod: false, tyl: false };
  if (zOkladka) {
    const pusta = () => ({ egz: { pusta: true, sekcja: null }, polowa: null, w: format.w, h: format.h, pusta: true, typ: 'wyklejka' });
    let przod = lista.filter((x) => x.typ === 'wyklejka_przednia');
    let tyl = lista.filter((x) => x.typ === 'wyklejka_tylna');
    const srodek = lista.filter((x) => x.typ !== 'wyklejka_przednia' && x.typ !== 'wyklejka_tylna');
    const twarda = model === 'ksiazka_twarda';
    if (!przod.length && twarda) przod = [pusta(), pusta()];
    if (!tyl.length && twarda) tyl = [pusta(), pusta()];
    const wolneP = przod.slice(1);
    if (wolneP.length % 2) wolneP.push(pusta()); // blok od nowej kartki
    if (srodek.length % 2 && tyl.length) srodek.push(pusta());
    const wolneT = tyl.slice(0, -1);
    if (wolneT.length % 2) wolneT.unshift(pusta());
    lista = [...przod.slice(0, 1), ...wolneP, ...srodek, ...wolneT, ...tyl.slice(-1)];
    wnetrze = { przod: przod.length > 0, tyl: tyl.length > 0 && lista.length > 1 };
  } else if (ksiazka) lista = lista.filter((x) => !wyklejka(x.egz));
  // Numery stron: wyklejki i dodane czyste strony bez numeru.
  let n = 0;
  const numery = lista.map((x) => (x.typ.startsWith('wyklejka') ? null : (n += 1)));
  return { lista, format, wnetrze, numery };
}

function ustawModel(model) {
  st.model = model;
  const { lista, format, wnetrze, numery } = listaStron(model);
  const klucz = lista.map((x) => `${st.strony.indexOf(x.egz)}${x.polowa || ''}`).join(',');
  if (klucz !== st.kluczListy) { st.kluczListy = klucz; st.ostre = null; renderer?.zapomnijStrony?.(); }
  st.lista = lista;
  st.numery = numery;
  st.kartki = kartkiModelu(model, {
    strony: lista.length,
    format,
    wnetrze,
    // Każda strona w swoim formacie (sekcje mogą mieć różne) – tekstura leży na kartce bez rozciągania.
    rozmiary: lista.map((e) => ({ w: e.w, h: e.h })),
    okladka: st.geometria ? { w: st.geometria.strefy.find((z) => z.rodzaj === 'przod')?.x2 - st.geometria.strefy.find((z) => z.rodzaj === 'przod')?.x1, h: st.geometria.dol - st.geometria.gora, tektura: normalizujOkladke(st.okladka.okladka).tektura_mm } : null,
    kartka_mm: st.geometria?.kartka_mm || 0.1,
  });
  st.u = 0;
  st.cel = 0;
  Object.assign(st.kamera, widokModelu(model), { zoom: 1, srodek: null, baza: null });
  st.kadr = null;
  st.scena = null;
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

// Bufor płótna zawsze w proporcjach tego, co widać (bez rozciągania obrazu przy zmianie okna, obrocie
// telefonu czy otwieraniu okna) – sprawdzane przed każdym rysowaniem.
let eksport = false;
function dopasujRozmiar() {
  if (eksport) return;
  // Rozmiar z układu strony (clientWidth/Height), nie z getBoundingClientRect – ten liczy też przesunięcia
  // i skalowanie w trakcie wjazdu okna. Pełna gęstość ekranu (do 3×, #161: na telefonie z dpr 2,6 obraz był
  // rozciągany z 2× i miękki), ale najwyżej ok. 4,5 mln pikseli.
  const cw = plotno.clientWidth;
  const ch = plotno.clientHeight;
  if (cw < 2 || ch < 2) return;
  let dpr = Math.min(3, window.devicePixelRatio || 1);
  dpr = Math.min(dpr, Math.sqrt(4.5e6 / (cw * ch)));
  const w = Math.max(1, Math.round(cw * dpr));
  const h = Math.max(1, Math.round(ch * dpr));
  if (plotno.width !== w || plotno.height !== h) { plotno.width = w; plotno.height = h; }
}
function dopasujPlotno() {
  dopasujRozmiar();
  rysujPozniej();
}
const obserwator = new ResizeObserver(() => { if (st) dopasujPlotno(); });

function pokazBrak3D() {
  const k = $('#makieta-brak-3d');
  k.hidden = Boolean(renderer);
  if (!renderer) k.textContent = `Nie udało się pokazać makiety 3D: ${powodBrakuWebGL || 'nieznany błąd grafiki'}. Spróbuj zamknąć i otworzyć okno jeszcze raz; jeśli to nie pomoże – zaktualizuj przeglądarkę (Chrome) albo włącz w niej przyspieszenie sprzętowe.`;
}

// Utrata kontekstu WebGL (#157): telefon odbiera go np. przy przejściu aplikacji w tło. Bez preventDefault
// nie wraca nigdy; po powrocie renderer powstaje od nowa, a tekstury stron wczytują się jeszcze raz.
plotno.addEventListener('webglcontextlost', (e) => { e.preventDefault(); renderer = null; });
plotno.addEventListener('webglcontextrestored', () => {
  if (!st) return;
  renderer = utworzRenderer(plotno);
  pokazBrak3D();
  if (renderer) { st.scena = null; rysujPozniej(); }
});

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
  st = { projekt, ciag, strony, okladka: geometria ? okladka : null, geometria, format, kamera: { obrotY: 0, obrotX: 0.5, zoom: 1, srodek: null } };
  if (!dlg.open) dlg.showModal();
  renderer = utworzRenderer(plotno);
  pokazBrak3D();
  if (!renderer) return;
  let zapamietany = null;
  try { zapamietany = sessionStorage.getItem(`makieta:${projekt.id}`); } catch { /* bez pamięci */ }
  ustawModel(MODELE[zapamietany] ? zapamietany : domyslnyModel(projekt, strony.length, st.okladka));
  obserwator.observe(plotno);
  dopasujPlotno();
}

// Do testów i zrzutów: ustawia położenie kartkowania wprost (także ułamkowe – kartka w trakcie przewracania).
// natychmiast – kamera od razu w docelowym kadrze (bez płynnego dojścia).
export function ustawPolozenieMakiety(u, { natychmiast = false } = {}) {
  if (!st) return;
  st.u = u;
  st.cel = u;
  if (natychmiast) { st.kamera.srodek = null; st.kamera.baza = null; }
  rysujPozniej();
}

export const stanMakiety = () => (st ? { model: st.model, u: st.u, cel: st.cel, kartek: st.kartki.length, polozen: polozenia(st.model, st.kartki), kamera: { ...st.kamera }, renderer: Boolean(renderer), wToku: [...wToku] } : null);

// Obraz makiety (PNG z tłem studia i cieniem) – w dużej rozdzielczości (dłuższy bok 3200 px), w tym samym
// kadrze co na ekranie.
export async function pobierzObrazMakiety() {
  if (!st || !renderer) return;
  const { width: w0, height: h0 } = plotno;
  const max = Math.min(3200, renderer.gl.getParameter(renderer.gl.MAX_RENDERBUFFER_SIZE) || 3200);
  const skala = Math.max(1, max / Math.max(w0, h0));
  eksport = true;
  plotno.width = Math.round(w0 * skala);
  plotno.height = Math.round(h0 * skala);
  const quady = scena(st.model, st.kartki, st.cel);
  const ob = obwiednia(quady);
  renderer.rysuj(quady, { ...st.kamera, srodek: ob.srodek, odleglosc: odlegloscDla(ob) / st.kamera.zoom }, { ciemny: ciemny() });
  const blob = await new Promise((ok) => plotno.toBlob(ok, 'image/png'));
  eksport = false;
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

export const kartkiMakiety = () => st?.kartki || null;

// Do testów i zrzutów: kąt i przybliżenie kamery wprost.
export function ustawKamereMakiety(zmiany) {
  if (!st) return;
  Object.assign(st.kamera, zmiany);
  rysujPozniej();
}

export function powiekszMakiete(k) {
  if (!st) return;
  st.kamera.zoom = Math.max(0.4, Math.min(5, st.kamera.zoom * k));
  rysujPozniej();
}
export function widokZPrzodu() {
  if (!st) return;
  const { obrotY, obrotX } = widokModelu(st.model);
  Object.assign(st.kamera, { obrotY, obrotX, zoom: 1 });
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
  const g = widokModelu(st.model);
  st.kamera.obrotY = Math.max(g.minY, Math.min(g.maxY, st.kamera.obrotY + dx * 0.01));
  st.kamera.obrotX = Math.max(g.minX, Math.min(g.maxX, st.kamera.obrotX + dy * 0.01));
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
