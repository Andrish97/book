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
  zbudujCzesc, elementyNadruku, trescCzesci, normalizujCzesc, czescZKsztaltu, rozetnijCzesc, scalCzesci, kolejnaNazwa, kolejnaPara, czesciWObiektach, doUkladuCzesci,
  naObwodzie, wWielokacie, podzielWielokat, scianyCzesci, RODZAJE_KRAWEDZI, RODZAJE_ZGIEC, paryWSekcji, ksztaltyPar, zUkladuCzesci,
  rozlozNaArkusze, instrukcjaMontazu, obrysCiecia, liniaZKsztaltu, odlegloscOdLinii, dlugoscLinii, liniaProsta, liniaDoGrzbietu,
} from '../skladanka.js';
import { podpowiedzPopup } from '../makieta-3d.js';
import { nowaStrona, nowaSekcja } from '../projekt.js';
import { przyjmijPlik } from '../obrazy-projektu.js';
import { SZABLONY_SKLADANEK, OPISY_PARAMETROW, czesciSzablonu, numeruj, brylaZRzutu } from '../skladanka-szablony.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis } from './zapis.js';
import { typSekcji } from '../typ-sekcji.js';
/* global fabric */
import { $, $$, powiadom, pobierz, bezpiecznaNazwa } from '../ui.js';
import { stan, edytor, biezacaSekcja } from './kontekst.js';
import { t as tt } from '../jezyk.js';

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
    for (const l of c.linie || []) if (l.para) s.add(String(l.para));
    for (const z of c.szczeliny || []) if (z.para) s.add(String(z.para));
  }
  return s;
}

// Zmiana definicji części: przebudowa grupy, zapis, odświeżenie panelu.
// Nowa grupa podmienia starą w tym samym miejscu listy (id, nazwa własna, warstwa, blokada zostają).
const ZOSTAJE = ['id', 'warstwa', 'zablokowany', 'z', 'visible', 'opacity'];
export function zmienCzesc(g, zmiana, { tresc } = {}) {
  const def = structuredClone(g.czesc);
  zmiana(def);
  const c = edytor.canvas;
  const nowa = zbudujCzesc(def, { grupa: g, tresc });
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
  if (!o || o.czesc || o.type === 'activeselection' || o.type === 'activeSelection') { powiadom(tt('skladankaNarzedzia.zaznaczKsztaltProstokatWielokat'), true); return null; }
  const z = czescZKsztaltu(o, kolejnaNazwa(uzyteNazwy()));
  if (!z) { powiadom(tt('skladankaNarzedzia.zTegoElementuNie'), true); return null; }
  z.def.druk = ustawieniaSekcji().druk;
  const g = zbudujCzesc(z.def, { left: z.left, top: z.top });
  zablokuj(g);
  edytor.canvas.remove(o);
  return edytor._wstaw(g);
}

// Bryła z zaznaczonego kształtu (#263): graniastosłup albo ostrosłup – jedna część z siatką, parami i zgięciami
// w miejscu kształtu. Kształt znika (jak przy „Z kształtu”).
export function brylaZZaznaczenia({ rodzaj = 'graniastoslup', wysokosc = 40, wysokosc_dachu = 25, id = null } = {}) {
  // id – kształt zaznaczony przy otwarciu okna (płótno mogło się w tym czasie przebudować).
  const o = (id && edytor.canvas.getObjects().find((x) => x.id === id)) || edytor.aktywny;
  if (!o || o.czesc || o.type === 'activeselection' || o.type === 'activeSelection') { powiadom(tt('skladankaNarzedzia.zaznaczKsztaltWielokatProstokat'), true); return null; }
  const z = czescZKsztaltu(o, 'A');
  if (!z) { powiadom(tt('skladankaNarzedzia.zTegoElementuNie2'), true); return null; }
  const pary = uzytePary();
  const nazwy = uzyteNazwy();
  const czesci = numeruj(brylaZRzutu(z.def.punkty, { rodzaj, wysokosc, wysokosc_dachu, nazwa: o.nazwa || 'Bryła' }), () => { const n = kolejnaPara(pary); pary.add(n); return n; });
  // Kilka części (bryły łączone, #282): pierwsza w miejscu kształtu, kolejne obok po prawej.
  edytor.canvas.remove(o);
  let x = z.left;
  let g = null;
  for (const cz of czesci) {
    const nr = kolejnaNazwa(nazwy);
    nazwy.add(nr);
    g = zbudujCzesc({ ...cz, nr, opis: cz.nazwa, kolor: z.def.kolor, druk: ustawieniaSekcji().druk }, { left: 0, top: 0 });
    const r = g.getBoundingRect();
    g.set({ left: g.left + (x - r.left), top: g.top + (z.top - r.top) });
    g.setCoords();
    zablokuj(g);
    x += r.width + 6;
    edytor._wstaw(g);
  }
  return g;
}
export function oknoBryly() {
  if (!wSkladance()) return;
  let dlg = $('#dlg-bryla-skladanki');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-bryla-skladanki';
    dlg.innerHTML = `<form method="dialog" class="formularz"><h2>${tt('skladankaNarzedzia.brylaZKsztaltu')}</h2>
      <p class="ciche">Zaznaczony kształt to podstawa (rzut) bryły. Makietka zrobi z niego siatkę: ściany na każdym boku, zakładki z numerami par i zgięcia. Kształt wklęsły (np. litera L) też się da – sprawdź tylko, czy ściany na siatce nie nachodzą na siebie.</p>
      <div class="rzad"><label class="pole"><span>Bryła</span><select name="rodzaj"><option value="graniastoslup">Graniastosłup (ściany prostopadłe, wieko)</option><option value="ostroslup">Ostrosłup (ściany do wierzchołka)</option><option value="z_dachem">Ściany z dachem (dwie części: ściany i dach na zakładkach)</option></select></label>
      <label class="pole waskie"><span>${tt('skladankaNarzedzia.wysokoscMm')}</span><input type="number" name="wysokosc" min="1" step="any" value="40" inputmode="decimal"></label>
      <label class="pole waskie"><span>Wysokość dachu (mm)</span><input type="number" name="wysokosc_dachu" min="1" step="any" value="25" inputmode="decimal"></label></div>
      <div class="przyciski-dialogu"><button class="przycisk" value="nie">${tt('skladankaNarzedzia.anuluj')}</button><button class="przycisk glowny" value="tak">${tt('skladankaNarzedzia.zrobBryle')}</button></div></form>`;
    document.body.append(dlg);
  }
  const f = dlg.querySelector('form');
  const id = edytor.aktywny?.id || null;
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'tak') return;
    const liczba = (pole, d) => Math.max(1, Number(String(f.elements[pole].value).replace(',', '.')) || d);
    const g = brylaZZaznaczenia({ id, rodzaj: f.elements.rodzaj.value, wysokosc: liczba('wysokosc', 40), wysokosc_dachu: liczba('wysokosc_dachu', 25) });
    if (g) powiadom(tt('skladankaNarzedzia.zrobionoGdyNieMiesci', { replace: g.nazwa.replace(/^Część /, 'część ') }));
  }, { once: true });
  dlg.returnValue = '';
  dlg.showModal();
}

// Tekstura modelu na części (#283): każdy trójkąt obrazka (UV) przeniesiony afinicznie na swoje miejsce w części,
// z przycięciem do trójkąta poszerzonego o pół piksela (bez szczelin). Wynik – obraz projektu w prostokącie części.
async function nadrukZTekstury(m, t, cz, plikObrazu) {
  const obraz = await globalThis.createImageBitmap(plikObrazu);
  const w = Math.max(...cz.punkty.map((q) => q.x));
  const h = Math.max(...cz.punkty.map((q) => q.y));
  const k = Math.max(2, Math.min(12, 3000 / Math.max(w, h, 1))); // pikseli na mm (12 ≈ 300 dpi)
  const plotno = document.createElement('canvas');
  plotno.width = Math.ceil(w * k);
  plotno.height = Math.ceil(h * k);
  const ctx = plotno.getContext('2d');
  for (const tr of t.trojkaty) {
    const src = tr.uv.map(([u, v]) => ({ x: u * obraz.width, y: (1 - v) * obraz.height }));
    const dst = tr.p.map((q) => ({ x: q.x * k, y: q.y * k }));
    const M = m.macierzTrojkata(src, dst);
    if (!M) continue;
    const sx = (dst[0].x + dst[1].x + dst[2].x) / 3;
    const sy = (dst[0].y + dst[1].y + dst[2].y) / 3;
    const pos = dst.map((q) => { const l = Math.hypot(q.x - sx, q.y - sy) || 1; return { x: q.x + ((q.x - sx) / l) * 0.6, y: q.y + ((q.y - sy) / l) * 0.6 }; });
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pos[0].x, pos[0].y);
    ctx.lineTo(pos[1].x, pos[1].y);
    ctx.lineTo(pos[2].x, pos[2].y);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(...M);
    ctx.drawImage(obraz, 0, 0);
    ctx.restore();
  }
  const blob = await new Promise((ok) => plotno.toBlob(ok, 'image/png'));
  const { id } = await przyjmijPlik(stan.projekt, new File([blob], `${cz.nazwa} – nadruk.png`, { type: 'image/png' }), `${cz.nazwa} – nadruk.png`);
  elementyNadruku.set(id, plotno);
  return { zasob: id, x: 0, y: 0, w, h };
}

// Model 3D z pliku (#264): OBJ albo STL rozłożony na części (js/rozkladanie-3d.js), potem [Rozłóż] na arkusze.
export function oknoModelu3D() {
  if (!wSkladance()) return;
  let dlg = $('#dlg-model-3d');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-model-3d';
    dlg.innerHTML = `<form method="dialog" class="formularz"><h2>${tt('skladankaNarzedzia.model3dNaSiatke')}</h2>
      <p class="ciche">Wczytaj bryłę z Blendera albo z sieci (OBJ albo STL). Makietka rozłoży ją na płasko: ściany wzdłuż najbardziej płaskich krawędzi, zgięcia góra i dolina z kątem, zakładki z numerami par; gdy część nachodziłaby na siebie, powstaje następna. Im mniej ścian, tym łatwiej skleić – najlepiej do kilkuset trójkątów.</p>
      <label class="pole"><span>Plik modelu (OBJ albo STL; do OBJ można dołączyć MTL z kolorami i obrazek tekstury)</span><input type="file" name="plik" accept=".obj,.stl,.mtl,.png,.jpg,.jpeg,.webp,model/obj,model/stl,image/png,image/jpeg,image/webp" multiple></label>
      <label class="pole waskie"><span>${tt('skladankaNarzedzia.najwiekszyWymiarMm')}</span><input type="number" name="rozmiar" min="10" step="any" value="120" inputmode="decimal"></label>
      <p class="blad-polaczenia" role="alert" hidden></p>
      <div class="przyciski-dialogu"><button class="przycisk" value="nie">${tt('skladankaNarzedzia.anuluj')}</button><button class="przycisk glowny" value="tak">${tt('skladankaNarzedzia.rozlozModel')}</button></div></form>`;
    document.body.append(dlg);
    const f = dlg.querySelector('form');
    f.addEventListener('submit', async (e) => {
      if (e.submitter?.value !== 'tak') return;
      e.preventDefault();
      const blad = f.querySelector('.blad-polaczenia');
      const pliki = [...f.elements.plik.files];
      const plik = pliki.find((x) => /\.(obj|stl)$/i.test(x.name)) || pliki[0];
      const mtl = pliki.find((x) => /\.mtl$/i.test(x.name));
      if (!plik) { blad.textContent = tt('skladankaNarzedzia.wybierzPlikObjAlbo'); blad.hidden = false; return; }
      try {
        const m = await import('../rozkladanie-3d.js');
        const siatka = /\.obj$/i.test(plik.name) ? m.wczytajOBJ(await plik.text(), mtl ? await mtl.text() : null) : m.wczytajSTL(new Uint8Array(await plik.arrayBuffer()));
        if (!siatka.sciany.length) throw new Error('W pliku nie ma ścian – czy to na pewno model OBJ albo STL?');
        if (siatka.sciany.length > 3000) throw new Error(`Model ma ${siatka.sciany.length} ścian – za dużo do sklejenia. Uprość go w programie 3D (np. Blender → Decimate) do kilkuset ścian.`);
        const w = m.rozlozSiatke(siatka, { rozmiar: Math.max(10, Number(String(f.elements.rozmiar.value).replace(',', '.')) || 120), nazwa: plik.name.replace(/\.[^.]+$/, '') });
        const obrazy = new Map(pliki.filter((x) => x.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(x.name)).map((x) => [x.name.toLowerCase(), x]));
        const brakObrazow = new Set();
        for (const cz of w.czesci) {
          const t = cz.tekstura;
          delete cz.tekstura;
          if (!t) continue;
          const obraz = obrazy.get(t.plik.toLowerCase());
          if (!obraz) { brakObrazow.add(t.plik); continue; }
          cz.nadruk = await nadrukZTekstury(m, t, cz, obraz);
        }
        const wstawione = wstawCzesci(w.czesci);
        if (w.czesci.some((c) => c.nadruk)) edytor.dispatchEvent(new Event('zasoby'));
        dlg.close();
        powiadom(tt('skladankaNarzedzia.modelRozlozonyTrojkatowUzyj', { trojkatow: w.trojkatow, wstawioneIle: wstawione.length, x: wstawione.length === 1 ? tt('skladankaNarzedzia.czesc2') : tt('skladankaNarzedzia.czesci'), x2: brakObrazow.size ? tt('skladankaNarzedzia.brakujeObrazkaTeksturyWybierz', { join: [...brakObrazow].join(', ') }) : '' }), Boolean(brakObrazow.size));
      } catch (er) { blad.textContent = er.message; blad.hidden = false; }
    });
  }
  const f = dlg.querySelector('form');
  f.reset();
  f.querySelector('.blad-polaczenia').hidden = true;
  dlg.showModal();
}

// ---------- Treść ścian (#284, plan składanek krok 15) ----------

// Część, na której leży punkt strony (najwyżej położona w kolejności rysowania).
function czescZTrescia(punkt) {
  const czesci = czesciWObiektach(edytor.canvas.getObjects()).filter((g) => g.visible !== false && !g.zWzorca);
  for (let i = czesci.length - 1; i >= 0; i -= 1) {
    const g = czesci[i];
    if (wWielokacie(obrysCiecia(normalizujCzesc(g.czesc)), doUkladuCzesci(g, punkt))) return g;
  }
  return null;
}
const moznaNaCzesc = (o) => o && !o.czesc && !o.watek && !o.okladka && o.type !== 'activeselection' && o.type !== 'activeSelection';

// Elementy (tekst, obraz, kształt…) leżące na częściach stają się ich treścią: znikają z płótna jako osobne
// elementy i wchodzą do grupy części w swoim miejscu. Zwraca liczbę umieszczonych.
export function umiescNaCzesciach(obiekty) {
  const c = edytor.canvas;
  const naGrupe = new Map();
  for (const o of obiekty.filter(moznaNaCzesc)) {
    const sr = o.getCenterPoint();
    const g = czescZTrescia(sr);
    if (!g) continue;
    const q = doUkladuCzesci(g, sr);
    (naGrupe.get(g) || naGrupe.set(g, []).get(g)).push({ obj: o, x: q.x, y: q.y, kat: (o.angle || 0) - (g.angle || 0) });
  }
  if (!naGrupe.size) return 0;
  c.discardActiveObject();
  let ile = 0;
  for (const [g, lista] of naGrupe) {
    for (const t of lista) { c.remove(t.obj); t.obj.set({ angle: t.kat }); ile += 1; }
    zmienCzesc(g, () => {}, { tresc: [...trescCzesci(g), ...lista] });
  }
  c.requestRenderAll();
  return ile;
}

// Elementy ze ścian części wracają na stronę jako zwykłe elementy (np. do edycji tekstu) – w tym samym miejscu.
export function wyjmijZCzesci(g) {
  const tresc = trescCzesci(g);
  if (!tresc.length) return null;
  const naStronie = tresc.map((t) => ({ obj: t.obj, p: zUkladuCzesci(g, t), kat: (t.obj.angle || 0) + (g.angle || 0) }));
  const nowa = zmienCzesc(g, () => {}, { tresc: [] });
  for (const { obj, p, kat } of naStronie) {
    obj.group = undefined;
    obj.parent = undefined;
    obj.set({ na_czesci: undefined, selectable: true, evented: true, angle: kat, clipPath: undefined });
    obj.setPositionByOrigin(new fabric.Point(p.x, p.y), 'center', 'center');
    obj.setCoords();
    edytor.canvas.add(obj);
  }
  edytor.canvas.requestRenderAll();
  edytor.oznaczZmiane();
  return { czesc: nowa, obiekty: naStronie.map((x) => x.obj) };
}

// Linia klejenia z zaznaczonych linii i kształtów (#285): każdy leżący na części zamienia się w jej linię klejenia
// (krzywe z pióra – gęsto próbkowane). Bez zaznaczenia – narzędzie klikane (dwa punkty).
export function liniaKlejenia() {
  if (!wSkladance()) return 0;
  const a = edytor.canvas.getActiveObject();
  const lista = (a && (a.type === 'activeselection' || a.type === 'activeSelection') ? a.getObjects() : a ? [a] : []).filter(moznaNaCzesc);
  if (!lista.length) { ustawNarzedzie('linia'); return 0; }
  const naGrupe = new Map();
  for (const o of lista) {
    const l = liniaZKsztaltu(o);
    if (!l) continue;
    const sr = l.punkty[Math.floor(l.punkty.length / 2)];
    const g = czescZTrescia(new fabric.Point(sr.x, sr.y)) || czescZTrescia(o.getCenterPoint());
    if (!g) continue;
    (naGrupe.get(g) || naGrupe.set(g, []).get(g)).push({ o, linia: { punkty: l.punkty.map((p) => doUkladuCzesci(g, p)), para: null, ...(l.zamknieta ? { zamknieta: true } : {}) } });
  }
  if (!naGrupe.size) { powiadom(tt('skladankaNarzedzia.narysujLinieLukAlbo'), true); return 0; }
  edytor.canvas.discardActiveObject();
  let ile = 0;
  for (const [g, w] of naGrupe) {
    for (const { o } of w) edytor.canvas.remove(o);
    zmienCzesc(g, (d) => { d.linie = [...(d.linie || []), ...w.map((x) => x.linia)]; });
    ile += w.length;
  }
  powiadom(tt('skladankaNarzedzia.polaczKliknijKrawedzInnej', { x: ile === 1 ? tt('skladankaNarzedzia.liniaKlejeniaGotowa') : tt('skladankaNarzedzia.linieKlejeniaGotowe', { ile }) }));
  return ile;
}

// Nacięcie z zaznaczonej linii, łamanej albo krzywej z pióra (#297): odcinki nacięcia ze wspólnym `ciag`
// (w panelu jedno nacięcie). Bez zaznaczenia – narzędzie klikane (dwa punkty).
export function naciecie({ otwor = false } = {}) {
  if (!wSkladance()) return 0;
  const a = edytor.canvas.getActiveObject();
  const lista = (a && (a.type === 'activeselection' || a.type === 'activeSelection') ? a.getObjects() : a ? [a] : []).filter(moznaNaCzesc);
  if (!lista.length) {
    if (otwor) { powiadom(tt('skladankaNarzedzia.narysujNaCzesciZamkniety'), true); return 0; }
    ustawNarzedzie('naciecie');
    return 0;
  }
  const naGrupe = new Map();
  for (const o of lista) {
    const l = liniaZKsztaltu(o);
    if (!l || (otwor && !l.zamknieta)) continue;
    const sr = l.punkty[Math.floor(l.punkty.length / 2)];
    const g = czescZTrescia(new fabric.Point(sr.x, sr.y)) || czescZTrescia(o.getCenterPoint());
    if (!g) continue;
    const pk = l.punkty.map((p) => doUkladuCzesci(g, p));
    if (l.zamknieta) pk.push(pk[0]);
    const ciag = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const odcinki = pk.slice(1).map((b, i) => ({ a: pk[i], b, szer: 0.2, para: null, naciecie: true, ciag })).filter((z) => Math.hypot(z.b.x - z.a.x, z.b.y - z.a.y) > 0.05);
    (naGrupe.get(g) || naGrupe.set(g, []).get(g)).push({ o, odcinki });
  }
  if (!naGrupe.size) { powiadom(otwor ? tt('skladankaNarzedzia.wyciecieRobiSieZ') : tt('skladankaNarzedzia.narysujLinieLukAlbo2'), true); return 0; }
  edytor.canvas.discardActiveObject();
  let ile = 0;
  for (const [g, w] of naGrupe) {
    for (const { o } of w) edytor.canvas.remove(o);
    zmienCzesc(g, (d) => { d.szczeliny = [...(d.szczeliny || []), ...w.flatMap((x) => x.odcinki)]; });
    ile += w.length;
  }
  powiadom(otwor ? tt('skladankaNarzedzia.kawalekWSrodkuWypada', { x: ile === 1 ? tt('skladankaNarzedzia.wyciecieGotowe') : tt('skladankaNarzedzia.wycieciaGotowe', { ile }) }) : tt('skladankaNarzedzia.naPlycieCieciaRazem', { x: ile === 1 ? tt('skladankaNarzedzia.naciecieGotowe') : tt('skladankaNarzedzia.nacieciaGotowe', { ile }) }));
  return ile;
}

export function umiescZaznaczoneNaCzesci() {
  if (!wSkladance()) return 0;
  const a = edytor.canvas.getActiveObject();
  const lista = a && (a.type === 'activeselection' || a.type === 'activeSelection') ? a.getObjects() : a ? [a] : [];
  const ile = umiescNaCzesciach(lista);
  if (!ile) powiadom(tt('skladankaNarzedzia.zaznaczElementTekstObraz'), true);
  else powiadom(tt('skladankaNarzedzia.naScianieCzesci', { ile }));
  return ile;
}

// ---------- Narzędzia klikane ----------

let narzedzie = null; // 'zgiecie' | 'polacz' | 'szczelina' | 'naciecie' | 'klej' | 'linia' | 'rozetnij' | 'scal'
let pierwszy = null; // { g, q (układ części), krawedz? }

const OPISY = {
  zgiecie: 'Zgięcie: kliknij punkt na krawędzi części, potem drugi punkt na krawędzi – linia podzieli część na ściany (Esc kończy).',
  linia: 'Linia klejenia: kliknij początek i koniec w dowolnym miejscu części – nie musi dochodzić do krawędzi (Esc kończy). Krzywą albo łamaną narysuj linią lub piórem na części, zaznacz i użyj [Linia klejenia].',
  naciecie: 'Nacięcie: kliknij początek i koniec – w środku części albo od jej krawędzi, pod dowolnym kątem (Esc kończy). Krzywe albo łamane: narysuj linię lub pióro na części, zaznacz i użyj [Nacięcie].',
  polacz: 'Połącz: kliknij przy krawędzi, która dostanie zakładkę, potem przy krawędzi, do której się przykleja – albo w środku ściany (miejsce klejenia). Esc kończy.',
  szczelina: 'Szczelina: kliknij początek i koniec nacięcia w części – szerokość z grubości materiału (Esc kończy).',
  klej: 'Miejsce klejenia: kliknij w części (z Shiftem – na spodzie, bez druku). Esc kończy.',
  scal: 'Scal: kliknij przy krawędzi z numerem pary – druga część dołączy się w tym miejscu, a krawędź stanie się zgięciem (Esc kończy).',
  rozetnij: 'Rozetnij: kliknij punkt na krawędzi części, potem drugi – część podzieli się na dwie z zakładką na linii cięcia (Esc kończy).',
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
  if (!t) { powiadom(tt('skladankaNarzedzia.kliknijWCzescAlbo'), true); return; }
  const { g, c, q, brzeg } = t;
  const przyKrawedzi = brzeg.odl <= TOLERANCJA;
  if (narzedzie === 'klej') {
    const spod = shift && ustawieniaSekcji().druga_strona === 'klej';
    zmienCzesc(g, (d) => { d.pola = [...(d.pola || []), { ...poleWScianie(c, q, 20, 10), para: null, spod }]; });
    return;
  }
  if (narzedzie === 'linia') {
    if (!wWielokacie(c.punkty, q) && !przyKrawedzi) { powiadom(tt('skladankaNarzedzia.liniaKlejeniaLezyNa'), true); return; }
    if (!pierwszy) { pierwszy = { g, q }; powiadom(tt('skladankaNarzedzia.terazKoniecLiniiKlejenia')); return; }
    if (pierwszy.g !== g) { pierwszy = null; powiadom(tt('skladankaNarzedzia.obaKonceLiniiKlejenia'), true); return; }
    const a = pierwszy.q;
    pierwszy = null;
    if (Math.hypot(q.x - a.x, q.y - a.y) < 2) { powiadom(tt('skladankaNarzedzia.liniaKlejeniaJestZa'), true); return; }
    zmienCzesc(g, (d) => { d.linie = [...(d.linie || []), { punkty: [a, q], para: null }]; });
    powiadom(tt('skladankaNarzedzia.liniaKlejeniaGotowaPolacz'));
    return;
  }
  if (narzedzie === 'zgiecie') {
    if (!przyKrawedzi) { powiadom(tt('skladankaNarzedzia.zgiecieZaczynaSieI'), true); return; }
    if (!pierwszy) { pierwszy = { g, q: brzeg.punkt }; powiadom(tt('skladankaNarzedzia.terazDrugiPunktNa')); return; }
    if (pierwszy.g !== g) { pierwszy = null; powiadom(tt('skladankaNarzedzia.obaKonceZgieciaMusza'), true); return; }
    const a = pierwszy.q;
    const b = brzeg.punkt;
    pierwszy = null;
    // Zgięcie musi przeciąć ścianę (nie biec po krawędzi).
    const { sciany } = scianyCzesci(c);
    const s = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const sciana = sciany.find((w) => wWielokacie(w, s));
    if (!sciana || !podzielWielokat(sciana, a, b)) { powiadom(tt('skladankaNarzedzia.taLiniaNieDzieli'), true); return; }
    zmienCzesc(g, (d) => { d.zgiecia = [...(d.zgiecia || []), { a, b, rodzaj: 'gora', kat: 90 }]; });
    return;
  }
  if (narzedzie === 'rozetnij') {
    if (!przyKrawedzi) { powiadom(tt('skladankaNarzedzia.liniaCieciaZaczynaSie'), true); return; }
    if (!pierwszy) { pierwszy = { g, q: brzeg.punkt }; powiadom(tt('skladankaNarzedzia.terazDrugiPunktNa')); return; }
    if (pierwszy.g !== g) { pierwszy = null; powiadom(tt('skladankaNarzedzia.obaKonceCieciaMusza'), true); return; }
    const a = pierwszy.q;
    pierwszy = null;
    const para = kolejnaPara(uzytePary());
    const dwie = rozetnijCzesc(c, a, brzeg.punkt, para);
    if (!dwie) { powiadom(tt('skladankaNarzedzia.taLiniaNieDzieli2'), true); return; }
    const nr2 = kolejnaNazwa(uzyteNazwy());
    // Treść ścian (#284) – do kawałka, na którym leży jej środek.
    const tresc = trescCzesci(g);
    const t2 = tresc.filter((t) => wWielokacie(dwie[1].punkty, t));
    const druga = zbudujCzesc({ ...structuredClone(g.czesc), ...dwie[1], nr: nr2 }, { grupa: g, tresc: t2 });
    zablokuj(druga);
    zmienCzesc(g, (d) => Object.assign(d, dwie[0]), { tresc: tresc.filter((t) => !t2.includes(t)) });
    edytor._wstaw(druga);
    powiadom(tt('skladankaNarzedzia.rozcietoNaCzesciI', { nr: c.nr, nr2, para }));
    return;
  }
  if (narzedzie === 'scal') {
    const k = c.krawedzie[brzeg.i];
    if (!przyKrawedzi || !k?.para || !['zakladka', 'klej'].includes(k.typ)) { powiadom(tt('skladankaNarzedzia.kliknijPrzyKrawedziZ'), true); return; }
    const inna = czesciWObiektach(edytor.canvas.getObjects()).find((x) => x !== g && normalizujCzesc(x.czesc).krawedzie.some((e) => e.para === k.para && ['zakladka', 'klej'].includes(e.typ)));
    if (!inna) { powiadom(tt('skladankaNarzedzia.paraNieMaDrugiej', { para: k.para }), true); return; }
    const c2 = normalizujCzesc(inna.czesc);
    const i2 = c2.krawedzie.findIndex((e) => e.para === k.para && ['zakladka', 'klej'].includes(e.typ));
    const w = scalCzesci(c, brzeg.i, c2, i2);
    if (!w) { powiadom(tt('skladankaNarzedzia.tychCzesciNieDa'), true); return; }
    // Treść ścian doklejanej części (#284) obraca się i przesuwa razem z nią.
    const tresc2 = trescCzesci(inna).map((t) => { t.obj.set({ angle: (t.obj.angle || 0) + w.obrot }); return { obj: t.obj, ...w.przeksztalc(t) }; });
    edytor.canvas.remove(inna);
    zmienCzesc(g, (d) => Object.assign(d, w), { tresc: [...trescCzesci(g), ...tresc2] });
    powiadom(tt('skladankaNarzedzia.scalonoCzesciIKrawedz', { nr: c.nr, nr2: c2.nr, para: k.para }));
    return;
  }
  if (narzedzie === 'naciecie') {
    if (!wWielokacie(c.punkty, q) && !przyKrawedzi) { powiadom(tt('skladankaNarzedzia.naciecieLezyNaCzesci'), true); return; }
    // Przyciąganie (do 1,5 mm) do wierzchołków części, końców zgięć i innych nacięć – inaczej klapka (nacięcia +
    // zgięcie) nie domknie się przez niedokładność kliknięcia.
    const punktyChwytu = [...c.punkty, ...c.zgiecia.flatMap((z) => [z.a, z.b]), ...c.szczeliny.filter((z) => z.naciecie).flatMap((z) => [z.a, z.b]), ...(pierwszy?.g === g ? [pierwszy.q] : [])];
    const chwyt = punktyChwytu.map((x) => ({ x, d: Math.hypot(x.x - q.x, x.y - q.y) })).sort((u, v) => u.d - v.d)[0];
    const p = chwyt && chwyt.d <= 1.5 ? { x: chwyt.x.x, y: chwyt.x.y } : (przyKrawedzi ? brzeg.punkt : q);
    if (!pierwszy) { pierwszy = { g, q: p }; powiadom(tt('skladankaNarzedzia.terazKoniecNacieciaW')); return; }
    if (pierwszy.g !== g) { pierwszy = null; powiadom(tt('skladankaNarzedzia.obaKonceNacieciaMusza'), true); return; }
    const a = pierwszy.q;
    pierwszy = null;
    if (Math.hypot(p.x - a.x, p.y - a.y) < 1) { powiadom(tt('skladankaNarzedzia.naciecieJestZaKrotkie'), true); return; }
    zmienCzesc(g, (d) => { d.szczeliny = [...(d.szczeliny || []), { a, b: p, szer: 0.2, para: null, naciecie: true }]; });
    return;
  }
  if (narzedzie === 'szczelina') {
    if (!wWielokacie(c.punkty, q)) { powiadom(tt('skladankaNarzedzia.szczelinaMusiLezecW'), true); return; }
    if (!pierwszy) { pierwszy = { g, q }; powiadom(tt('skladankaNarzedzia.terazKoniecSzczeliny')); return; }
    if (pierwszy.g !== g) { pierwszy = null; powiadom(tt('skladankaNarzedzia.obaKonceSzczelinyMusza'), true); return; }
    const a = pierwszy.q;
    pierwszy = null;
    if (Math.hypot(q.x - a.x, q.y - a.y) < 2) { powiadom(tt('skladankaNarzedzia.szczelinaJestZaKrotka'), true); return; }
    zmienCzesc(g, (d) => { d.szczeliny = [...(d.szczeliny || []), { a, b: q, szer: Math.round((grubosc() + LUZ_SZCZELINY) * 100) / 100, para: null }]; });
    return;
  }
  if (narzedzie === 'polacz') {
    if (!pierwszy) {
      if (!przyKrawedzi) { powiadom(tt('skladankaNarzedzia.najpierwKliknijPrzyKrawedzi'), true); return; }
      pierwszy = { g, krawedz: brzeg.i };
      powiadom(tt('skladankaNarzedzia.krawedzCzesciTerazKrawedz', { x: brzeg.i + 1, nr: c.nr }));
      return;
    }
    const { g: g1, krawedz: k1 } = pierwszy;
    pierwszy = null;
    if (g1 === g && przyKrawedzi && brzeg.i === k1) { powiadom(tt('skladankaNarzedzia.toTaSamaKrawedz'), true); return; }
    const para = kolejnaPara(uzytePary());
    const c1 = normalizujCzesc(g1.czesc);
    const dl = (cz, i) => { const a = cz.punkty[i]; const b = cz.punkty[(i + 1) % cz.punkty.length]; return Math.hypot(b.x - a.x, b.y - a.y); };
    const n1 = zmienCzesc(g1, (d) => { d.krawedzie = normalizujCzesc(d).krawedzie; d.krawedzie[k1] = { ...d.krawedzie[k1], typ: 'zakladka', para }; });
    const g2 = g === g1 ? n1 : g;
    const cL = normalizujCzesc(g2.czesc);
    const iL = cL.linie.findIndex((l) => odlegloscOdLinii(l, q) <= 2);
    if (iL >= 0) {
      // Krawędź do linii klejenia (#285) w środku ściany.
      zmienCzesc(g2, (d) => { d.linie = normalizujCzesc(d).linie; d.linie[iL].para = para; });
      const r = Math.abs(dl(c1, k1) - dlugoscLinii(cL.linie[iL]));
      powiadom(tt('skladankaNarzedzia.paraZakladkaNaCzesci', { para, nr: c1.nr, x: liniaProsta(cL.linie[iL]) ? tt('skladankaNarzedzia.liniaKlejenia') : tt('skladankaNarzedzia.krzywaLiniaKlejenia'), nr2: c.nr, x2: r > 1 ? tt('skladankaNarzedzia.uwagaKrawedzILinia', { x: Math.round(r * 10) / 10 }) : '' }));
    } else if (przyKrawedzi) {
      zmienCzesc(g2, (d) => { d.krawedzie = normalizujCzesc(d).krawedzie; d.krawedzie[brzeg.i] = { ...d.krawedzie[brzeg.i], typ: 'klej', para }; });
      const r = Math.abs(dl(c1, k1) - dl(c, brzeg.i));
      powiadom(tt('skladankaNarzedzia.paraZakladkaNaCzesci2', { para, nr: c1.nr, nr2: c.nr, x: r > 0.5 ? tt('skladankaNarzedzia.uwagaKrawedzieRozniaSie', { x: Math.round(r * 10) / 10 }) : '' }));
    } else {
      // Krawędź do miejsca na ścianie: pole klejenia o długości krawędzi i szerokości zakładki.
      const w = Math.max(5, dl(c1, k1) - 2);
      const h = c1.krawedzie[k1]?.szer || 7;
      zmienCzesc(g2, (d) => { d.pola = [...(d.pola || []), { ...poleWScianie(c, q, w, h), para, spod: false }]; });
      powiadom(tt('skladankaNarzedzia.paraZakladkaNaCzesci3', { para, nr: c1.nr, nr2: c.nr }));
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

// Podpowiedź pop-upu dla części (#301) – części z płótna (wspólny układ współrzędnych), wynik zapamiętany.
const pamiecPodpowiedzi = new Map();
function podpowiedzPopupu(g) {
  const grupy = czesciWObiektach(edytor.canvas.getObjects());
  if (!grupy.some((x) => (x.czesc?.zgiecia || []).some((z) => z.grzbiet))) return null;
  const ic = grupy.indexOf(g);
  if (ic < 0) return null;
  const czesci = grupy.map((x) => ({ arkusz: 0, czesc: x.czesc, obiekt: { czesc: x.czesc, left: x.left, top: x.top, width: x.width, height: x.height, angle: x.angle || 0, originX: x.originX, originY: x.originY, scaleX: x.scaleX || 1, scaleY: x.scaleY || 1 } }));
  const klucz = JSON.stringify([ic, czesci.map((x) => x.obiekt)]);
  if (!pamiecPodpowiedzi.has(klucz)) {
    let w = null;
    try { w = podpowiedzPopup(czesci, ic); } catch { w = null; }
    if (pamiecPodpowiedzi.size > 40) pamiecPodpowiedzi.clear();
    pamiecPodpowiedzi.set(klucz, w);
  }
  return pamiecPodpowiedzi.get(klucz);
}

const dlugosc = (c, i) => { const a = c.punkty[i]; const b = c.punkty[(i + 1) % c.punkty.length]; return Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 10) / 10; };

export function panelCzesci(panel, g0) {
  let g = g0;
  const c = () => normalizujCzesc(g.czesc);
  const zmien = (fn) => { g = zmienCzesc(g, (d) => { Object.assign(d, normalizujCzesc(d)); fn(d); }); panel.obj = g; panel.zbuduj(); };
  panel.tytul.textContent = tt('skladankaNarzedzia.czesc3', { nr: c().nr });
  const s = panel.sekcja(tt('skladankaNarzedzia.czesc'));
  s.append(panel.tekst(tt('skladankaNarzedzia.nazwaNumerCzesci'), () => c().nr, (v) => zmien((d) => { d.nr = v || d.nr; })));
  s.append(panel.kolor(tt('skladankaNarzedzia.kolorSciany'), () => c().kolor, (v) => zmien((d) => { d.kolor = v || '#ffffff'; })));
  s.append(panel.przelacznik(tt('skladankaNarzedzia.numeryParINazwa'), () => c().pokaz_numery, (v) => zmien((d) => { d.pokaz_numery = v; })));
  s.append(panel.wskazowka(tt('skladankaNarzedzia.krawedziGruboscMaterialuSekcji', { punktyIle: c().punkty.length, scianyIle: scianyCzesci(c()).sciany.length, x: scianyCzesci(c()).sciany.length === 1 ? tt('skladankaNarzedzia.sciana') : tt('skladankaNarzedzia.sciany'), replace: String(grubosc()).replace('.', ',') })));
  s.append(panel.akcje([
    ['linia', 'Zgięcie – dwa kliknięcia na krawędziach', () => ustawNarzedzie('zgiecie')],
    ['link', 'Połącz – krawędź z krawędzią albo z miejscem', () => ustawNarzedzie('polacz')],
    ['prostokat', 'Klej – miejsce klejenia', () => ustawNarzedzie('klej')],
    ['ozdobnik', 'Linia klejenia – w dowolnym miejscu ściany', () => ustawNarzedzie('linia')],
    ['minus', 'Szczelina – na wypustkę (z szerokością)', () => ustawNarzedzie('szczelina')],
    ['separator', 'Nacięcie – linia cięcia w środku części, pod dowolnym kątem', () => ustawNarzedzie('naciecie')],
    ['separator', 'Rozetnij na dwie części – dwa kliknięcia na krawędziach', () => ustawNarzedzie('rozetnij')],
    ['link', 'Scal z częścią do pary – kliknij krawędź z numerem', () => ustawNarzedzie('scal')],
  ]));
  // Pop-up (#301): część doklejona do kartki z grzbietem – kąt przy otwarciu 90°, zasięg, wystawanie po zamknięciu.
  const pp = podpowiedzPopupu(g);
  if (pp) {
    const ps = panel.sekcja(tt('skladankaNarzedzia.popUp'));
    ps.append(panel.wskazowka(tt('skladankaNarzedzia.przyKartceOtwartejNa', { kat: pp.kat, siega: pp.siega, x: pp.wystaje ? tt('skladankaNarzedzia.wystajeOMmSkroc', { wystaje: pp.wystaje }) : tt('skladankaNarzedzia.chowaSieWKartce'), x2: pp.domyka ? '' : tt('skladankaNarzedzia.kartkaNieDomykaSie') })));
  }
  // Treść ścian (#284).
  const tr = trescCzesci(g);
  const ts = panel.sekcja(tt('skladankaNarzedzia.naScianach'));
  ts.append(panel.wskazowka(tr.length ? tt('skladankaNarzedzia.naScianachOpis', { ile: tr.length }) : tt('skladankaNarzedzia.polozNaCzesciTekst')));
  if (tr.length) ts.append(panel.akcje([['rozgrupuj', 'Wyjmij z części (do edycji)', () => { const w = wyjmijZCzesci(g); if (w?.obiekty?.length) { edytor.canvas.setActiveObject(w.obiekty.length === 1 ? w.obiekty[0] : new fabric.ActiveSelection(w.obiekty, { canvas: edytor.canvas })); edytor.canvas.requestRenderAll(); } }]]));
  const k = panel.sekcja(tt('skladankaNarzedzia.krawedzie'));
  c().krawedzie.forEach((kr, i) => {
    k.append(panel.wybor(tt('skladankaNarzedzia.krawedzMm', { x: i + 1, replace: String(dlugosc(c(), i)).replace('.', ',') }), Object.entries(RODZAJE_KRAWEDZI), () => c().krawedzie[i].typ, (v) => zmien((d) => { d.krawedzie[i].typ = v; })));
    if (kr.typ !== 'ciecie') {
      k.append(panel.tekst(tt('skladankaNarzedzia.numerPary'), () => c().krawedzie[i].para || '', (v) => zmien((d) => { d.krawedzie[i].para = v || null; })));
      if ((kr.typ === 'zakladka' || kr.typ === 'klej') && kr.para) k.append(panel.liczba(tt('skladankaNarzedzia.katPoSklejeniu180'), () => c().krawedzie[i].kat ?? 180, (v) => zmien((d) => { d.krawedzie[i].kat = v; }), { jednostka: '°', krok: 5, min: 0 }));
      if (kr.typ === 'zakladka' || kr.typ === 'wypustka') k.append(panel.liczba(kr.typ === 'zakladka' ? tt('skladankaNarzedzia.szerokoscZakladki') : tt('skladankaNarzedzia.dlugoscWypustki'), () => c().krawedzie[i].szer, (v) => zmien((d) => { d.krawedzie[i].szer = v; }), { jednostka: 'mm', krok: 0.5, min: 2 }));
    }
  });
  const zg = c().zgiecia;
  if (zg.length) {
    const z = panel.sekcja(tt('skladankaNarzedzia.zgiecia'));
    zg.forEach((_, i) => {
      z.append(panel.wybor(tt('skladankaNarzedzia.zgiecie', { x: i + 1 }), Object.entries(RODZAJE_ZGIEC), () => c().zgiecia[i].rodzaj, (v) => zmien((d) => { d.zgiecia[i].rodzaj = v; })));
      z.append(panel.liczba(tt('skladankaNarzedzia.katPoZlozeniu'), () => c().zgiecia[i].kat, (v) => zmien((d) => { d.zgiecia[i].kat = v; }), { jednostka: '°', krok: 5, min: 0 }));
      // #299: grzbiet kartki pop-up – wokół niego kartka otwiera się suwakiem w makiecie, reszta rusza się mechanizmem.
      z.append(panel.przelacznik(tt('skladankaNarzedzia.grzbietKartkiPopUp'), () => Boolean(c().zgiecia[i].grzbiet), (v) => zmien((d) => { if (v) d.zgiecia[i].grzbiet = true; else delete d.zgiecia[i].grzbiet; })));
      z.append(panel.akcje([['kosz', `Usuń zgięcie ${i + 1}`, () => zmien((d) => { d.zgiecia.splice(i, 1); })]]));
    });
  }
  const linie = c().linie;
  if (linie.length) {
    const ls = panel.sekcja(tt('skladankaNarzedzia.linieKlejenia'));
    linie.forEach((l, i) => {
      const dg = liniaDoGrzbietu(c(), l);
      const doGrzbietu = dg ? ` Kąt do grzbietu ${String(dg.kat).replace('.', ',')}°, ${String(dg.odl).replace('.', ',')} mm od grzbietu${dg.kat < 89 && dg.kat > 1 ? ' – ze skośną linią po drugiej stronie grzbietu doklejona część stanie pod kątem jak zgięcie V' : ''}.` : '';
      ls.append(panel.wskazowka(tt('skladankaNarzedzia.liniaMm', { x: i + 1, replace: String(Math.round(dlugoscLinii(l) * 10) / 10).replace('.', ','), x2: liniaProsta(l) ? tt('skladankaNarzedzia.prostaDoklejonaCzescStanie') : tt('skladankaNarzedzia.krzywaDoklejonaCzescWygnie'), doGrzbietu })));
      ls.append(panel.tekst(tt('skladankaNarzedzia.liniaNumerPary', { x: i + 1 }), () => c().linie[i].para || '', (v) => zmien((d) => { d.linie[i].para = v || null; })));
      ls.append(panel.przelacznik(tt('skladankaNarzedzia.naSpodzieBezDruku'), () => c().linie[i].spod, (v) => zmien((d) => { d.linie[i].spod = v || undefined; })));
      ls.append(panel.akcje([['kosz', `Usuń linię ${i + 1}`, () => zmien((d) => { d.linie.splice(i, 1); })]]));
    });
  }
  const pola = c().pola;
  if (pola.length) {
    const p = panel.sekcja(tt('skladankaNarzedzia.miejscaKlejenia'));
    pola.forEach((_, i) => {
      p.append(panel.tekst(tt('skladankaNarzedzia.miejsceNumerPary', { x: i + 1 }), () => c().pola[i].para || '', (v) => zmien((d) => { d.pola[i].para = v || null; })));
      p.append(panel.liczba(tt('skladankaNarzedzia.szerokosc'), () => c().pola[i].w, (v) => zmien((d) => { d.pola[i].w = v; }), { jednostka: 'mm', krok: 1, min: 2 }));
      p.append(panel.liczba(tt('skladankaNarzedzia.wysokosc'), () => c().pola[i].h, (v) => zmien((d) => { d.pola[i].h = v; }), { jednostka: 'mm', krok: 1, min: 2 }));
      p.append(panel.przelacznik(tt('skladankaNarzedzia.naSpodzieBezDruku'), () => c().pola[i].spod, (v) => zmien((d) => { d.pola[i].spod = v; })));
      p.append(panel.akcje([['kosz', `Usuń miejsce ${i + 1}`, () => zmien((d) => { d.pola.splice(i, 1); })]]));
    });
  }
  // Nacięcia (#297): ciąg odcinków z jednego kształtu – jedna pozycja.
  const nac = [];
  c().szczeliny.forEach((z, i) => {
    if (!z.naciecie) return;
    const k = z.ciag || `#${i}`;
    let w = nac.find((x) => x.k === k);
    if (!w) { w = { k, idx: [], dl: 0 }; nac.push(w); }
    w.idx.push(i);
    w.dl += Math.hypot(z.b.x - z.a.x, z.b.y - z.a.y);
  });
  if (nac.length) {
    const ns = panel.sekcja(tt('skladankaNarzedzia.naciecia'));
    nac.forEach((w, j) => {
      ns.append(panel.wskazowka(tt('skladankaNarzedzia.naciecieMm', { x: j + 1, replace: String(Math.round(w.dl * 10) / 10).replace('.', ','), x2: w.idx.length > 1 ? tt('skladankaNarzedzia.odcinkow', { idxIle: w.idx.length }) : '' })));
      ns.append(panel.akcje([['kosz', `Usuń nacięcie ${j + 1}`, () => zmien((d) => { d.szczeliny = d.szczeliny.filter((_, i) => !w.idx.includes(i)); })]]));
    });
  }
  const sz = c().szczeliny;
  if (sz.some((z) => !z.naciecie)) {
    const p = panel.sekcja(tt('skladankaNarzedzia.szczeliny'));
    sz.forEach((z0, i) => {
      if (z0.naciecie) return;
      p.append(panel.tekst(tt('skladankaNarzedzia.szczelinaNumerPary', { x: i + 1 }), () => c().szczeliny[i].para || '', (v) => zmien((d) => { d.szczeliny[i].para = v || null; })));
      p.append(panel.liczba(tt('skladankaNarzedzia.szerokosc'), () => c().szczeliny[i].szer, (v) => zmien((d) => { d.szczeliny[i].szer = v; }), { jednostka: 'mm', krok: 0.05, min: 0.2 }));
      p.append(panel.akcje([['kosz', `Usuń szczelinę ${i + 1}`, () => zmien((d) => { d.szczeliny.splice(i, 1); })]]));
    });
  }
}

// Panel strony w sekcji składanki: lista połączeń całej sekcji (para → co z czym, na którym arkuszu).
export function panelPolaczen(panel, { przejdz }) {
  const sekcja = biezacaSekcja();
  const strony = (stan.projekt?.strony || []).filter((st) => st.sekcja === sekcja?.id);
  const pary = paryWSekcji(strony);
  const s = panel.sekcja(tt('skladankaNarzedzia.polaczenia'));
  if (!pary.size) { s.append(panel.wskazowka(tt('skladankaNarzedzia.jeszczeNicNieJest'))); return; }
  s.append(panel.wskazowka(tt('skladankaNarzedzia.najedzNaPareZeby')));
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
    b.querySelector('span').textContent = w.length === 1 ? tt('skladankaNarzedzia.bezPary', { opis }) : opis;
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
  // Ozdobniki leżące w całości na części (#284) idą z nią – inaczej zostałyby na starym miejscu arkusza.
  const lezace = edytor.canvas.getObjects().filter((o) => {
    if (!moznaNaCzesc(o) || !o.visible) return false;
    const g = czescZTrescia(o.getCenterPoint());
    if (!g) return false;
    const r = o.getBoundingRect();
    const R = g.getBoundingRect();
    return r.left >= R.left - 0.5 && r.top >= R.top - 0.5 && r.left + r.width <= R.left + R.width + 0.5 && r.top + r.height <= R.top + R.height + 0.5;
  });
  const przypiete = lezace.length ? umiescNaCzesciach(lezace) : 0;
  zapiszBiezacyCel();
  const { projekt } = stan;
  const sekcja = biezacaSekcja();
  const sp = sekcja.specjalna || {};
  const naArkusz = sp.druga_strona === 'druk' ? 2 : 1;
  const stronySekcji = () => projekt.strony.filter((st) => st.sekcja === sekcja.id);
  const czesci = stronySekcji().flatMap((st) => (st.obiekty || []).filter((o) => o.czesc));
  if (!czesci.length) { powiadom(tt('skladankaNarzedzia.wTejSekcjiNie'), true); return null; }
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
  if (przypiete) powiadom(tt('skladankaNarzedzia.naIchScianyI', { przypiete, x: przypiete === 1 ? tt('skladankaNarzedzia.elementLezacyNaCzesci') : tt('skladankaNarzedzia.elementyLezaceNaCzesciach') }));
  powiadom(tt('skladankaNarzedzia.rozlozono', { ile, ark: arkusze.length, x3: za_duze.length ? tt('skladankaNarzedzia.nieMiesciSieNa', { za_duzeIle: za_duze.length }) : '' }), Boolean(za_duze.length));
  return { arkuszy: arkusze.length, za_duze };
}

// ---------- Szablony (#237) ----------

// Wstawia części szablonu na bieżący arkusz – obok siebie od lewego górnego rogu pola druku; pary dostają wolne
// numery projektu, części kolejne litery. Zwraca wstawione grupy.
export function wstawSzablon(klucz, parametry = {}) {
  if (!wSkladance()) return [];
  return wstawCzesci(czesciSzablonu(klucz, parametry, grubosc()));
}

// Wstawia gotowe definicje części (pary lokalne → wolne numery projektu) obok siebie na bieżącym arkuszu.
export function wstawCzesci(lokalne) {
  if (!wSkladance()) return [];
  const sp = ustawieniaSekcji();
  const pary = uzytePary();
  const czesci = numeruj(lokalne, () => { const n = kolejnaPara(pary); pary.add(n); return n; });
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
    dlg.innerHTML = `<form method="dialog" class="formularz"><h2>${tt('skladankaNarzedzia.szablonSkladanki')}</h2>
      <label class="pole"><span>${tt('skladankaNarzedzia.model')}</span><select name="szablon">${Object.entries(SZABLONY_SKLADANEK).map(([k, v]) => `<option value="${k}">${v.nazwa}</option>`).join('')}</select></label>
      <p class="ciche opis-szablonu"></p><div class="rzad parametry-szablonu"></div><p class="ciche grubosc-szablonu"></p>
      <div class="przyciski-dialogu"><button class="przycisk" value="nie">${tt('skladankaNarzedzia.anuluj')}</button><button class="przycisk glowny" value="tak">${tt('skladankaNarzedzia.wstaw')}</button></div></form>`;
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
  f.querySelector('.grubosc-szablonu').textContent = tt('skladankaNarzedzia.gruboscMaterialuSekcjiMm', { replace: String(grubosc()).replace('.', ',') });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'tak') return;
    const parametry = Object.fromEntries([...f.querySelectorAll('.parametry-szablonu input')].map((i) => [i.name.slice(2), Number(String(i.value).replace(',', '.'))]));
    const w = wstawSzablon(f.elements.szablon.value, parametry);
    if (w.length) powiadom(tt('skladankaNarzedzia.wstawionoGdyCzesciNie', { join: w.map((g) => g.nazwa.replace(/^Część /, '')).join(', ') }));
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
  if (!ins.czesci) { powiadom(tt('skladankaNarzedzia.wTejSekcjiNie2'), true); return null; }
  let dlg = $('#dlg-instrukcja-montazu');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-instrukcja-montazu';
    dlg.className = 'okno-raportu';
    dlg.innerHTML = `<form method="dialog" class="formularz"><h2>${tt('skladankaNarzedzia.instrukcjaMontazu')}</h2><ol class="kroki-montazu"></ol>
      <div class="przyciski-dialogu"><button class="przycisk" value="nie">${tt('skladankaNarzedzia.zamknij')}</button><button class="przycisk" type="button" data-rola="pobierz">${tt('skladankaNarzedzia.pobierzTxt')}</button><button class="przycisk glowny" value="strona">${tt('skladankaNarzedzia.wstawJakoStrone')}</button></div></form>`;
    document.body.append(dlg);
  }
  dlg.querySelector('ol').replaceChildren(...ins.kroki.map((k) => Object.assign(document.createElement('li'), { textContent: k })));
  const tekst = tt('skladankaNarzedzia.instrukcjaMontazu2', { nazwa: stan.projekt.nazwa, join: ins.kroki.map((k, i) => `${i + 1}. ${k}`).join('\n') });
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
  powiadom(tt('skladankaNarzedzia.instrukcjaMontazuJestW'));
}

// Pasek narzędzi: przyciski z data-akcja="skladanka-…".
export function obsluzAkcje(akcja) {
  if (akcja === 'skladanka-czesc') return nowaCzesc();
  if (akcja === 'skladanka-z-ksztaltu') return czescZZaznaczenia();
  if (akcja === 'skladanka-bryla') return oknoBryly();
  if (akcja === 'skladanka-model-3d') return oknoModelu3D();
  if (akcja === 'skladanka-na-czesc') return umiescZaznaczoneNaCzesci();
  if (akcja === 'skladanka-linia') return liniaKlejenia();
  if (akcja === 'skladanka-naciecie') return naciecie();
  if (akcja === 'skladanka-wyciecie') return naciecie({ otwor: true });
  if (akcja === 'skladanka-rozloz') return rozlozCzesci();
  if (akcja === 'skladanka-szablon') return oknoSzablonow();
  if (akcja === 'skladanka-instrukcja') return oknoInstrukcji();
  const n = { 'skladanka-zgiecie': 'zgiecie', 'skladanka-polacz': 'polacz', 'skladanka-szczelina': 'szczelina', 'skladanka-klej': 'klej' }[akcja];
  if (n) ustawNarzedzie(n);
  return null;
}
