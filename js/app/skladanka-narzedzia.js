// Narzędzia składanki (#233): pasek widoczny tylko w sekcji „Składanka / wycinanka” i panel zaznaczonej części.
//
// Część to grupa zbudowana z definicji `czesc` (js/skladanka.js). Narzędzia działają kliknięciami na stronie:
//   Zgięcie   – dwa kliknięcia na obrysie części: linia zgięcia (dolina) dzieli ją na ściany;
//   Połącz    – kliknięcie przy krawędzi jednej części, potem przy krawędzi drugiej (albo w środku ściany):
//               obie dostają ten sam numer pary – pierwsza zakładkę klejową, druga krawędź „do sklejenia”
//               (albo miejsce klejenia w klikniętym punkcie);
//   Szczelina – dwa kliknięcia w części: nacięcie o szerokości grubości materiału (z luzem) na wypustkę;
//   Klej      – kliknięcie w części: miejsce klejenia (z Shiftem na spodzie, gdy druga strona jest na klej).
// Esc kończy narzędzie. Wszystko inne (kolor, krawędzie, numery, usuwanie) – w panelu części.

import {
  zbudujCzesc, normalizujCzesc, czescZKsztaltu, kolejnaNazwa, kolejnaPara, czesciWObiektach, doUkladuCzesci,
  naObwodzie, wWielokacie, podzielWielokat, scianyCzesci, RODZAJE_KRAWEDZI, RODZAJE_ZGIEC, paryWSekcji, ksztaltyPar, zUkladuCzesci,
  rozlozNaArkusze, instrukcjaMontazu,
} from '../skladanka.js';
import { nowaStrona, nowaSekcja } from '../projekt.js';
import { SZABLONY_SKLADANEK, OPISY_PARAMETROW, czesciSzablonu, numeruj } from '../skladanka-szablony.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis } from './zapis.js';
import { typSekcji } from '../typ-sekcji.js';
import { $, $$, powiadom, pobierz, bezpiecznaNazwa } from '../ui.js';
import { stan, edytor, biezacaSekcja } from './kontekst.js';

const LUZ_SZCZELINY = 0.2; // mm ponad grubość materiału
const TOLERANCJA = 3; // mm – kliknięcie „przy krawędzi”

export const wSkladance = () => stan.tryb === 'strona' && typSekcji(biezacaSekcja()) === 'skladanka';
const ustawieniaSekcji = () => biezacaSekcja()?.specjalna || {};
const grubosc = () => Number(ustawieniaSekcji().grubosc_mm) || 0.3;

// Wszystkie części projektu (zapisane strony) i z płótna – do numerów części i par.
function wszystkieCzesci() {
  const zPlotna = czesciWObiektach(edytor.canvas.getObjects()).map((g) => g.czesc);
  const zProjektu = czesciWObiektach((stan.projekt?.strony || []).flatMap((s) => s.obiekty || [])).map((o) => o.czesc);
  return [...zPlotna, ...zProjektu].filter(Boolean);
}
const uzyteNazwy = () => new Set(wszystkieCzesci().map((c) => c.nr));
function uzytePary() {
  const s = new Set();
  for (const c of wszystkieCzesci()) {
    for (const k of c.krawedzie || []) if (k.para) s.add(String(k.para));
    for (const p of c.pola || []) if (p.para) s.add(String(p.para));
    for (const z of c.szczeliny || []) if (z.para) s.add(String(z.para));
  }
  return s;
}

// Zmiana definicji części: przebudowa grupy, zapis, odświeżenie panelu.
// Nowa grupa podmienia starą w tym samym miejscu listy (id, nazwa własna, warstwa, blokada zostają).
const ZOSTAJE = ['id', 'warstwa', 'zablokowany', 'z', 'visible', 'opacity'];
export function zmienCzesc(g, zmiana) {
  const def = structuredClone(g.czesc);
  zmiana(def);
  const c = edytor.canvas;
  const nowa = zbudujCzesc(def, { grupa: g });
  for (const k of ZOSTAJE) if (g[k] !== undefined) nowa[k] = g[k];
  zablokuj(nowa);
  const i = c.getObjects().indexOf(g);
  const aktywna = c.getActiveObject() === g;
  c.remove(g);
  if (i >= 0) c.insertAt(i, nowa); else c.add(nowa);
  if (aktywna) c.setActiveObject(nowa);
  c.requestRenderAll();
  edytor.oznaczZmiane();
  return nowa;
}

// Część nie skaluje się (wymiary są w mm modelu) – obraca się i przesuwa.
function zablokuj(g) {
  g.set({ lockScalingX: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true, subTargetCheck: false, interactive: false });
  g.setControlsVisibility?.({ ml: false, mr: false, mt: false, mb: false, tl: false, tr: false, bl: false, br: false });
}

// Prostokąt pola klejenia w ścianie, w którą kliknięto (środek w q): mniejszy, jeśli ściana jest mniejsza,
// i przesunięty tak, by nie wystawał poza nią (ramka ściany z zapasem 1 mm).
function poleWScianie(c, q, w, h) {
  const { sciany } = scianyCzesci(c);
  const s = sciany.find((x) => wWielokacie(x, q)) || c.punkty;
  const xs = s.map((p) => p.x);
  const ys = s.map((p) => p.y);
  const [x1, x2, y1, y2] = [Math.min(...xs) + 1, Math.max(...xs) - 1, Math.min(...ys) + 1, Math.max(...ys) - 1];
  const W = Math.max(2, Math.min(w, x2 - x1));
  const H = Math.max(2, Math.min(h, y2 - y1));
  const x = Math.min(Math.max(q.x - W / 2, x1), x2 - W);
  const y = Math.min(Math.max(q.y - H / 2, y1), y2 - H);
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, w: Math.round(W * 100) / 100, h: Math.round(H * 100) / 100 };
}

// ---------- Wstawianie ----------

export function nowaCzesc() {
  if (!wSkladance()) return null;
  const nr = kolejnaNazwa(uzyteNazwy());
  const def = { nr, punkty: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 40 }, { x: 0, y: 40 }], druk: ustawieniaSekcji().druk };
  const { left, top } = edytor._srodek(60, 40);
  const g = zbudujCzesc(def, { left, top });
  zablokuj(g);
  return edytor._wstaw(g);
}

export function czescZZaznaczenia() {
  const o = edytor.aktywny;
  if (!o || o.czesc || o.type === 'activeselection' || o.type === 'activeSelection') { powiadom('Zaznacz kształt (prostokąt, wielokąt, elipsę albo kształt z pióra), z którego ma powstać część.', true); return null; }
  const z = czescZKsztaltu(o, kolejnaNazwa(uzyteNazwy()));
  if (!z) { powiadom('Z tego elementu nie da się zrobić części – potrzebny zamknięty kształt.', true); return null; }
  z.def.druk = ustawieniaSekcji().druk;
  const g = zbudujCzesc(z.def, { left: z.left, top: z.top });
  zablokuj(g);
  edytor.canvas.remove(o);
  return edytor._wstaw(g);
}

// ---------- Narzędzia klikane ----------

let narzedzie = null; // 'zgiecie' | 'polacz' | 'szczelina' | 'klej'
let pierwszy = null; // { g, q (układ części), krawedz? }

const OPISY = {
  zgiecie: 'Zgięcie: kliknij punkt na krawędzi części, potem drugi punkt na krawędzi – linia podzieli część na ściany (Esc kończy).',
  polacz: 'Połącz: kliknij przy krawędzi, która dostanie zakładkę, potem przy krawędzi, do której się przykleja – albo w środku ściany (miejsce klejenia). Esc kończy.',
  szczelina: 'Szczelina: kliknij początek i koniec nacięcia w części – szerokość z grubości materiału (Esc kończy).',
  klej: 'Miejsce klejenia: kliknij w części (z Shiftem – na spodzie, bez druku). Esc kończy.',
};

export function ustawNarzedzie(n) {
  narzedzie = n && narzedzie !== n ? n : null;
  pierwszy = null;
  for (const b of $$('[data-akcja^="skladanka-"]')) if (b.dataset.narzedzie) b.setAttribute('aria-pressed', String(b.dataset.narzedzie === narzedzie));
  document.body.classList.toggle('narzedzie-skladanki', Boolean(narzedzie));
  if (narzedzie) powiadom(OPISY[narzedzie]);
}

// Część pod punktem strony (najwyżej leżąca): w obrysie (z zakładkami) albo przy krawędzi.
function czescPod(p) {
  const czesci = czesciWObiektach(edytor.canvas.getObjects()).filter((g) => g.visible !== false && !g.zWzorca).reverse();
  for (const g of czesci) {
    const c = normalizujCzesc(g.czesc);
    const q = doUkladuCzesci(g, p);
    const brzeg = naObwodzie(c.punkty, q);
    if (wWielokacie(c.punkty, q) || brzeg.odl <= TOLERANCJA) return { g, c, q, brzeg };
  }
  return null;
}

function klik(p, shift) {
  const t = czescPod(p);
  if (!t) { powiadom('Kliknij w część albo przy jej krawędzi.', true); return; }
  const { g, c, q, brzeg } = t;
  const przyKrawedzi = brzeg.odl <= TOLERANCJA;
  if (narzedzie === 'klej') {
    const spod = shift && ustawieniaSekcji().druga_strona === 'klej';
    zmienCzesc(g, (d) => { d.pola = [...(d.pola || []), { ...poleWScianie(c, q, 20, 10), para: null, spod }]; });
    return;
  }
  if (narzedzie === 'zgiecie') {
    if (!przyKrawedzi) { powiadom('Zgięcie zaczyna się i kończy na krawędzi części – kliknij bliżej krawędzi.', true); return; }
    if (!pierwszy) { pierwszy = { g, q: brzeg.punkt }; powiadom('Teraz drugi punkt na krawędzi tej samej części.'); return; }
    if (pierwszy.g !== g) { pierwszy = null; powiadom('Oba końce zgięcia muszą być na tej samej części – zacznij od nowa.', true); return; }
    const a = pierwszy.q;
    const b = brzeg.punkt;
    pierwszy = null;
    // Zgięcie musi przeciąć ścianę (nie biec po krawędzi).
    const { sciany } = scianyCzesci(c);
    const s = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const sciana = sciany.find((w) => wWielokacie(w, s));
    if (!sciana || !podzielWielokat(sciana, a, b)) { powiadom('Ta linia nie dzieli części na dwie ściany – zgięcie musi przejść przez środek części od krawędzi do krawędzi.', true); return; }
    zmienCzesc(g, (d) => { d.zgiecia = [...(d.zgiecia || []), { a, b, rodzaj: 'gora', kat: 90 }]; });
    return;
  }
  if (narzedzie === 'szczelina') {
    if (!wWielokacie(c.punkty, q)) { powiadom('Szczelina musi leżeć w części.', true); return; }
    if (!pierwszy) { pierwszy = { g, q }; powiadom('Teraz koniec szczeliny.'); return; }
    if (pierwszy.g !== g) { pierwszy = null; powiadom('Oba końce szczeliny muszą być w tej samej części.', true); return; }
    const a = pierwszy.q;
    pierwszy = null;
    if (Math.hypot(q.x - a.x, q.y - a.y) < 2) { powiadom('Szczelina jest za krótka.', true); return; }
    zmienCzesc(g, (d) => { d.szczeliny = [...(d.szczeliny || []), { a, b: q, szer: Math.round((grubosc() + LUZ_SZCZELINY) * 100) / 100, para: null }]; });
    return;
  }
  if (narzedzie === 'polacz') {
    if (!pierwszy) {
      if (!przyKrawedzi) { powiadom('Najpierw kliknij przy krawędzi, która dostanie zakładkę.', true); return; }
      pierwszy = { g, krawedz: brzeg.i };
      powiadom(`Krawędź ${brzeg.i + 1} części ${c.nr}. Teraz krawędź albo miejsce, do którego się przykleja.`);
      return;
    }
    const { g: g1, krawedz: k1 } = pierwszy;
    pierwszy = null;
    if (g1 === g && przyKrawedzi && brzeg.i === k1) { powiadom('To ta sama krawędź – wybierz inną.', true); return; }
    const para = kolejnaPara(uzytePary());
    const c1 = normalizujCzesc(g1.czesc);
    const dl = (cz, i) => { const a = cz.punkty[i]; const b = cz.punkty[(i + 1) % cz.punkty.length]; return Math.hypot(b.x - a.x, b.y - a.y); };
    const n1 = zmienCzesc(g1, (d) => { d.krawedzie = normalizujCzesc(d).krawedzie; d.krawedzie[k1] = { ...d.krawedzie[k1], typ: 'zakladka', para }; });
    const g2 = g === g1 ? n1 : g;
    if (przyKrawedzi) {
      zmienCzesc(g2, (d) => { d.krawedzie = normalizujCzesc(d).krawedzie; d.krawedzie[brzeg.i] = { ...d.krawedzie[brzeg.i], typ: 'klej', para }; });
      const r = Math.abs(dl(c1, k1) - dl(c, brzeg.i));
      powiadom(`Para ${para}: zakładka na części ${c1.nr} ↔ krawędź części ${c.nr}.${r > 0.5 ? ` Uwaga: krawędzie różnią się o ${Math.round(r * 10) / 10} mm.` : ''}`);
    } else {
      // Krawędź do miejsca na ścianie: pole klejenia o długości krawędzi i szerokości zakładki.
      const w = Math.max(5, dl(c1, k1) - 2);
      const h = c1.krawedzie[k1]?.szer || 7;
      zmienCzesc(g2, (d) => { d.pola = [...(d.pola || []), { ...poleWScianie(c, q, w, h), para, spod: false }]; });
      powiadom(`Para ${para}: zakładka na części ${c1.nr} ↔ miejsce klejenia na części ${c.nr}.`);
    }
  }
}

// ---------- Podświetlanie par (#235) ----------

let podswietlone = new Set(); // numery par podświetlone na stronie
export function podswietlPary(pary) {
  podswietlone = new Set(pary || []);
  edytor.canvas.requestRenderAll();
}
// Na płótnie (po narysowaniu): pomarańczowe obrysy zakładek, krawędzi i miejsc z podświetlonymi numerami.
function rysujPary(ctx) {
  if (!podswietlone.size || !wSkladance()) return;
  const v = edytor.canvas.viewportTransform;
  ctx.save();
  ctx.transform(...v);
  ctx.strokeStyle = '#f08c00';
  ctx.fillStyle = 'rgba(240, 140, 0, 0.18)';
  ctx.lineWidth = 2.2 / v[0];
  ctx.lineJoin = 'round';
  for (const g of czesciWObiektach(edytor.canvas.getObjects())) {
    for (const k of ksztaltyPar(g.czesc)) {
      if (!podswietlone.has(k.para)) continue;
      const pkt = k.punkty.map((q) => zUkladuCzesci(g, q));
      ctx.beginPath();
      pkt.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      if (k.zamkniety) { ctx.closePath(); ctx.fill(); }
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function podlaczSkladanke() {
  const c = edytor.canvas;
  if (!c || c._skladanka) return;
  c._skladanka = true;
  c.on('after:render', (e) => rysujPary(e.ctx || c.getContext()));
  // Najechanie na część podświetla jej pary – także te, których drugi koniec jest na innej części tej strony.
  c.on('mouse:over', (e) => { if (e.target?.czesc && !narzedzie) podswietlPary(ksztaltyPar(e.target.czesc).map((k) => k.para)); });
  c.on('mouse:out', (e) => { if (e.target?.czesc && !narzedzie) podswietlPary([]); });
  c.on('mouse:down', (opt) => {
    if (!narzedzie) return;
    if (!wSkladance()) { ustawNarzedzie(null); return; }
    const p = opt.scenePoint || c.getScenePoint?.(opt.e) || c.getPointer(opt.e);
    klik(p, opt.e?.shiftKey);
  });
  c.on('object:added', (e) => { if (e.target?.czesc) zablokuj(e.target); });
  document.addEventListener('keydown', (e) => { if (narzedzie && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); ustawNarzedzie(null); } }, true);
}

// ---------- Panel części ----------

const dlugosc = (c, i) => { const a = c.punkty[i]; const b = c.punkty[(i + 1) % c.punkty.length]; return Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 10) / 10; };

export function panelCzesci(panel, g0) {
  let g = g0;
  const c = () => normalizujCzesc(g.czesc);
  const zmien = (fn) => { g = zmienCzesc(g, (d) => { Object.assign(d, normalizujCzesc(d)); fn(d); }); panel.obj = g; panel.zbuduj(); };
  panel.tytul.textContent = `Część ${c().nr}`;
  const s = panel.sekcja('Część');
  s.append(panel.tekst('Nazwa (numer części)', () => c().nr, (v) => zmien((d) => { d.nr = v || d.nr; })));
  s.append(panel.kolor('Kolor ściany', () => c().kolor, (v) => zmien((d) => { d.kolor = v || '#ffffff'; })));
  s.append(panel.przelacznik('Numery par i nazwa części', () => c().pokaz_numery, (v) => zmien((d) => { d.pokaz_numery = v; })));
  s.append(panel.wskazowka(`${c().punkty.length} krawędzi, ${scianyCzesci(c()).sciany.length} ${scianyCzesci(c()).sciany.length === 1 ? 'ściana' : 'ściany'}. Grubość materiału sekcji: ${String(grubosc()).replace('.', ',')} mm.`));
  s.append(panel.akcje([
    ['linia', 'Zgięcie – dwa kliknięcia na krawędziach', () => ustawNarzedzie('zgiecie')],
    ['link', 'Połącz – krawędź z krawędzią albo z miejscem', () => ustawNarzedzie('polacz')],
    ['prostokat', 'Klej – miejsce klejenia', () => ustawNarzedzie('klej')],
    ['minus', 'Szczelina – nacięcie na wypustkę', () => ustawNarzedzie('szczelina')],
  ]));
  const k = panel.sekcja('Krawędzie');
  c().krawedzie.forEach((kr, i) => {
    k.append(panel.wybor(`Krawędź ${i + 1} (${String(dlugosc(c(), i)).replace('.', ',')} mm)`, Object.entries(RODZAJE_KRAWEDZI), () => c().krawedzie[i].typ, (v) => zmien((d) => { d.krawedzie[i].typ = v; })));
    if (kr.typ !== 'ciecie') {
      k.append(panel.tekst('Numer pary', () => c().krawedzie[i].para || '', (v) => zmien((d) => { d.krawedzie[i].para = v || null; })));
      if (kr.typ === 'zakladka' || kr.typ === 'wypustka') k.append(panel.liczba(kr.typ === 'zakladka' ? 'Szerokość zakładki' : 'Długość wypustki', () => c().krawedzie[i].szer, (v) => zmien((d) => { d.krawedzie[i].szer = v; }), { jednostka: 'mm', krok: 0.5, min: 2 }));
    }
  });
  const zg = c().zgiecia;
  if (zg.length) {
    const z = panel.sekcja('Zgięcia');
    zg.forEach((_, i) => {
      z.append(panel.wybor(`Zgięcie ${i + 1}`, Object.entries(RODZAJE_ZGIEC), () => c().zgiecia[i].rodzaj, (v) => zmien((d) => { d.zgiecia[i].rodzaj = v; })));
      z.append(panel.liczba('Kąt po złożeniu', () => c().zgiecia[i].kat, (v) => zmien((d) => { d.zgiecia[i].kat = v; }), { jednostka: '°', krok: 5, min: 0 }));
      z.append(panel.akcje([['kosz', `Usuń zgięcie ${i + 1}`, () => zmien((d) => { d.zgiecia.splice(i, 1); })]]));
    });
  }
  const pola = c().pola;
  if (pola.length) {
    const p = panel.sekcja('Miejsca klejenia');
    pola.forEach((_, i) => {
      p.append(panel.tekst(`Miejsce ${i + 1} – numer pary`, () => c().pola[i].para || '', (v) => zmien((d) => { d.pola[i].para = v || null; })));
      p.append(panel.liczba('Szerokość', () => c().pola[i].w, (v) => zmien((d) => { d.pola[i].w = v; }), { jednostka: 'mm', krok: 1, min: 2 }));
      p.append(panel.liczba('Wysokość', () => c().pola[i].h, (v) => zmien((d) => { d.pola[i].h = v; }), { jednostka: 'mm', krok: 1, min: 2 }));
      p.append(panel.przelacznik('Na spodzie (bez druku)', () => c().pola[i].spod, (v) => zmien((d) => { d.pola[i].spod = v; })));
      p.append(panel.akcje([['kosz', `Usuń miejsce ${i + 1}`, () => zmien((d) => { d.pola.splice(i, 1); })]]));
    });
  }
  const sz = c().szczeliny;
  if (sz.length) {
    const p = panel.sekcja('Szczeliny');
    sz.forEach((_, i) => {
      p.append(panel.tekst(`Szczelina ${i + 1} – numer pary`, () => c().szczeliny[i].para || '', (v) => zmien((d) => { d.szczeliny[i].para = v || null; })));
      p.append(panel.liczba('Szerokość', () => c().szczeliny[i].szer, (v) => zmien((d) => { d.szczeliny[i].szer = v; }), { jednostka: 'mm', krok: 0.05, min: 0.2 }));
      p.append(panel.akcje([['kosz', `Usuń szczelinę ${i + 1}`, () => zmien((d) => { d.szczeliny.splice(i, 1); })]]));
    });
  }
}

// Panel strony w sekcji składanki: lista połączeń całej sekcji (para → co z czym, na którym arkuszu).
export function panelPolaczen(panel, { przejdz }) {
  const sekcja = biezacaSekcja();
  const strony = (stan.projekt?.strony || []).filter((st) => st.sekcja === sekcja?.id);
  const pary = paryWSekcji(strony);
  const s = panel.sekcja('Połączenia');
  if (!pary.size) { s.append(panel.wskazowka('Jeszcze nic nie jest połączone. Narzędzie [Połącz]: krawędź z zakładką, potem krawędź albo miejsce, do którego się przykleja.')); return; }
  s.append(panel.wskazowka('Najedź na parę, żeby zobaczyć ją na arkuszu; kliknij, żeby zaznaczyć część.'));
  const lista = document.createElement('ul');
  lista.className = 'lista-polaczen';
  for (const [para, w] of pary) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    // Szew po łuku (#261): wiele krawędzi jednej pary na dwóch częściach – jedna linia „B: 73 zakładki ↔ C: 73 krawędzie”.
    const wg = new Map();
    for (const x of w) wg.set(x.czesc, [...(wg.get(x.czesc) || []), x]);
    const szew = w.length > 2 && wg.size === 2 && [...wg.values()].every((l) => l.length === w.length / 2);
    const opis = szew
      ? [...wg.entries()].map(([c, l]) => `${c}: ${l.length} × ${l[0].opis.replace(/\s*\d+$/, '')}`).join(' ↔ ')
      : w.map((x) => `${x.czesc}: ${x.opis}${strony.length > 1 ? ` (arkusz ${x.arkusz})` : ''}`).join(' ↔ ');
    b.innerHTML = `<strong></strong><span></span>`;
    b.querySelector('strong').textContent = para;
    b.querySelector('span').textContent = w.length === 1 ? `${opis} – bez pary` : opis;
    if (w.length !== 2 && !szew) li.classList.add('uwaga');
    b.addEventListener('mouseenter', () => podswietlPary([para]));
    b.addEventListener('mouseleave', () => podswietlPary([]));
    b.addEventListener('click', () => { podswietlPary([para]); przejdz(w[0].idStrony, w[0].idObiektu); });
    li.append(b);
    lista.append(li);
  }
  s.append(lista);
}

// ---------- Rozkładanie na arkusze (#236) ----------

// Wszystkie części sekcji (z jej stron) układają się od nowa na arkuszach: w polu druku (bez marginesu drukarki),
// rzędami, z obrotem o 90°, gdy trzeba; brakujące arkusze dochodzą na końcu sekcji. Inne elementy stron zostają.
// Przy druku dwustronnym arkusz to dwie strony – części idą na pierwszą stronę arkusza.
export async function rozlozCzesci() {
  if (!wSkladance()) return null;
  zapiszBiezacyCel();
  const { projekt } = stan;
  const sekcja = biezacaSekcja();
  const sp = sekcja.specjalna || {};
  const naArkusz = sp.druga_strona === 'druk' ? 2 : 1;
  const stronySekcji = () => projekt.strony.filter((st) => st.sekcja === sekcja.id);
  const czesci = stronySekcji().flatMap((st) => (st.obiekty || []).filter((o) => o.czesc));
  if (!czesci.length) { powiadom('W tej sekcji nie ma jeszcze części – dodaj je narzędziem [Część].', true); return null; }
  const { szerokosc_mm: W, wysokosc_mm: H } = sekcja.wydruk;
  const m = (sp.druk === 'domowy' ? sp.margines_mm || 0 : 0) + 2;
  const wym = (o) => ({ w: (o.width || 0) * (o.scaleX || 1), h: (o.height || 0) * (o.scaleY || 1) });
  const { arkusze, za_duze } = rozlozNaArkusze(czesci.map((o) => ({ id: o.id, ...wym(o) })), { x: m, y: m, w: W - 2 * m, h: H - 2 * m });
  const poId = new Map(czesci.map((o) => [o.id, o]));
  for (const st of stronySekcji()) st.obiekty = (st.obiekty || []).filter((o) => !o.czesc || za_duze.includes(o.id));
  // Brakujące arkusze – za ostatnią stroną sekcji.
  while (stronySekcji().length < arkusze.length * naArkusz) {
    const ost = stronySekcji().at(-1);
    const nowa = nowaStrona(`Arkusz ${Math.floor(stronySekcji().length / naArkusz) + 1}`, sekcja.id);
    projekt.strony.splice(projekt.strony.indexOf(ost) + 1, 0, nowa);
  }
  const strony = stronySekcji();
  arkusze.forEach((ark, i) => {
    for (const p of ark) {
      const o = poId.get(p.id);
      const { h } = wym(o);
      Object.assign(o, { originX: 'left', originY: 'top', angle: p.obrot, left: p.obrot === 90 ? p.x + h : p.x, top: p.y });
      strony[i * naArkusz].obiekty.push(o);
    }
  });
  stan.miniatury?.clear?.();
  await zaladujCel();
  zaplanujZapis();
  const ile = czesci.length - za_duze.length;
  powiadom(`Rozłożono ${ile} ${ile === 1 ? 'część' : ile < 5 ? 'części' : 'części'} na ${arkusze.length} ${arkusze.length === 1 ? 'arkuszu' : 'arkuszach'}.${za_duze.length ? ` ${za_duze.length} nie mieści się na arkuszu nawet po obróceniu – zostaje na miejscu (wybierz większy arkusz w ustawieniach sekcji).` : ''}`, Boolean(za_duze.length));
  return { arkuszy: arkusze.length, za_duze };
}

// ---------- Szablony (#237) ----------

// Wstawia części szablonu na bieżący arkusz – obok siebie od lewego górnego rogu pola druku; pary dostają wolne
// numery projektu, części kolejne litery. Zwraca wstawione grupy.
export function wstawSzablon(klucz, parametry = {}) {
  if (!wSkladance()) return [];
  const sp = ustawieniaSekcji();
  const pary = uzytePary();
  const czesci = numeruj(czesciSzablonu(klucz, parametry, grubosc()), () => { const n = kolejnaPara(pary); pary.add(n); return n; });
  const nazwy = uzyteNazwy();
  const m = (sp.druk === 'domowy' ? sp.margines_mm || 0 : 0) + 4;
  let x = edytor.strony[edytor.aktywna].x + m;
  const wstawione = [];
  for (const cz of czesci) {
    const nr = kolejnaNazwa(nazwy);
    nazwy.add(nr);
    const g = zbudujCzesc({ ...cz, nr, opis: cz.nazwa, druk: sp.druk }, { left: 0, top: 0 });
    // Ramka grupy (z zakładkami) od (x, m).
    const r = g.getBoundingRect();
    g.set({ left: g.left + (x - r.left), top: g.top + (m - r.top) });
    g.setCoords();
    zablokuj(g);
    edytor._wstaw(g);
    wstawione.push(g);
    x += r.width + 4;
  }
  edytor.canvas.requestRenderAll();
  return wstawione;
}

export function oknoSzablonow() {
  if (!wSkladance()) return;
  let dlg = $('#dlg-szablon-skladanki');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-szablon-skladanki';
    dlg.innerHTML = `<form method="dialog" class="formularz"><h2>Szablon składanki</h2>
      <label class="pole"><span>Model</span><select name="szablon">${Object.entries(SZABLONY_SKLADANEK).map(([k, v]) => `<option value="${k}">${v.nazwa}</option>`).join('')}</select></label>
      <p class="ciche opis-szablonu"></p><div class="rzad parametry-szablonu"></div><p class="ciche grubosc-szablonu"></p>
      <div class="przyciski-dialogu"><button class="przycisk" value="nie">Anuluj</button><button class="przycisk glowny" value="tak">Wstaw</button></div></form>`;
    document.body.append(dlg);
    dlg.querySelector('select').addEventListener('change', () => pola());
  }
  const f = dlg.querySelector('form');
  function pola() {
    const s = SZABLONY_SKLADANEK[f.elements.szablon.value];
    f.querySelector('.opis-szablonu').textContent = s.opis;
    f.querySelector('.parametry-szablonu').replaceChildren(...Object.entries(s.parametry).map(([k, v]) => {
      const l = document.createElement('label');
      l.className = 'pole waskie';
      l.innerHTML = `<span>${OPISY_PARAMETROW[k] || k}</span><input type="number" step="any" min="${k === 'boki' ? 3 : 1}" ${k === 'boki' ? 'max="12"' : ''} inputmode="decimal">`;
      const i = l.querySelector('input');
      i.name = `p_${k}`;
      i.value = v;
      return l;
    }));
  }
  pola();
  f.querySelector('.grubosc-szablonu').textContent = `Grubość materiału sekcji: ${String(grubosc()).replace('.', ',')} mm – wieczko, szczeliny i przegródki ją uwzględniają.`;
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'tak') return;
    const parametry = Object.fromEntries([...f.querySelectorAll('.parametry-szablonu input')].map((i) => [i.name.slice(2), Number(String(i.value).replace(',', '.'))]));
    const w = wstawSzablon(f.elements.szablon.value, parametry);
    if (w.length) powiadom(`Wstawiono: ${w.map((g) => g.nazwa.replace(/^Część /, '')).join(', ')}. Gdy części nie mieszczą się na arkuszu, użyj [Rozłóż].`);
  }, { once: true });
  dlg.returnValue = '';
  dlg.showModal();
}

// ---------- Instrukcja montażu (#238) ----------

export function oknoInstrukcji() {
  if (!wSkladance()) return null;
  zapiszBiezacyCel();
  const sekcja = biezacaSekcja();
  const strony = stan.projekt.strony.filter((st) => st.sekcja === sekcja.id);
  const ins = instrukcjaMontazu(strony, sekcja.specjalna || {});
  if (!ins.czesci) { powiadom('W tej sekcji nie ma jeszcze części.', true); return null; }
  let dlg = $('#dlg-instrukcja-montazu');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-instrukcja-montazu';
    dlg.className = 'okno-raportu';
    dlg.innerHTML = `<form method="dialog" class="formularz"><h2>Instrukcja montażu</h2><ol class="kroki-montazu"></ol>
      <div class="przyciski-dialogu"><button class="przycisk" value="nie">Zamknij</button><button class="przycisk" type="button" data-rola="pobierz">Pobierz (.txt)</button><button class="przycisk glowny" value="strona">Wstaw jako stronę</button></div></form>`;
    document.body.append(dlg);
  }
  dlg.querySelector('ol').replaceChildren(...ins.kroki.map((k) => Object.assign(document.createElement('li'), { textContent: k })));
  const tekst = `Instrukcja montażu – ${stan.projekt.nazwa}\n\n${ins.kroki.map((k, i) => `${i + 1}. ${k}`).join('\n')}\n`;
  dlg.querySelector('[data-rola="pobierz"]').onclick = () => pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa || 'model')} - instrukcja montażu.txt`, URL.createObjectURL(new Blob([tekst], { type: 'text/plain;charset=utf-8' })));
  dlg.addEventListener('close', async () => { if (dlg.returnValue === 'strona') await wstawInstrukcje(ins.kroki); }, { once: true });
  dlg.returnValue = '';
  dlg.showModal();
  return ins;
}

// Instrukcja jako nowa sekcja A4 za sekcją składanki: tytuł i ponumerowane kroki w jednej ramce (Dokładaj strony).
export async function wstawInstrukcje(kroki) {
  const { projekt } = stan;
  const skl = biezacaSekcja();
  const sekcja = nowaSekcja('Instrukcja montażu'); // domyślnie A4
  projekt.sekcje.splice(projekt.sekcje.indexOf(skl) + 1, 0, sekcja);
  const strona = nowaStrona('Instrukcja montażu', sekcja.id);
  const m = sekcja.wydruk.marginesy || { gora: 15, wewnetrzny: 15, zewnetrzny: 15 };
  const lewy = m.wewnetrzny ?? 15;
  const szer = sekcja.wydruk.szerokosc_mm - lewy - (m.zewnetrzny ?? 15);
  strona.obiekty = [
    { type: 'textbox', id: `o${Date.now().toString(36)}t`, left: lewy, top: m.gora ?? 15, width: szer, text: 'Instrukcja montażu', fontFamily: 'Inter', fontSize: 8, fontWeight: 'bold', fill: '#1a1a1a', strokeWidth: 0 },
    { type: 'textbox', id: `o${Date.now().toString(36)}k`, left: lewy, top: (m.gora ?? 15) + 14, width: szer, text: kroki.map((k, i) => `${i + 1}. ${k}`).join('\n'), fontFamily: 'Inter', fontSize: 3.9, lineHeight: 1.35, fill: '#1a1a1a', strokeWidth: 0, auto_strony: true },
  ];
  const ostatnia = projekt.strony.filter((st) => st.sekcja === skl.id).at(-1);
  projekt.strony.splice(projekt.strony.indexOf(ostatnia) + 1, 0, strona);
  stan.miniatury?.clear?.();
  await zaladujCel();
  zaplanujZapis();
  powiadom('Instrukcja montażu jest w nowej sekcji za arkuszami – możesz ją dowolnie poprawić.');
}

// Pasek narzędzi: przyciski z data-akcja="skladanka-…".
export function obsluzAkcje(akcja) {
  if (akcja === 'skladanka-czesc') return nowaCzesc();
  if (akcja === 'skladanka-z-ksztaltu') return czescZZaznaczenia();
  if (akcja === 'skladanka-rozloz') return rozlozCzesci();
  if (akcja === 'skladanka-szablon') return oknoSzablonow();
  if (akcja === 'skladanka-instrukcja') return oknoInstrukcji();
  const n = { 'skladanka-zgiecie': 'zgiecie', 'skladanka-polacz': 'polacz', 'skladanka-szczelina': 'szczelina', 'skladanka-klej': 'klej' }[akcja];
  if (n) ustawNarzedzie(n);
  return null;
}
