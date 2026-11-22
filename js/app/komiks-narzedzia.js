/* global fabric */
// Narzędzia trybu „Komiks” (#364, plan komiksu A5–A7): pasek widoczny w sekcji typu „Komiks” – dymek, kadry (gotowe
// układy z rynną, kadry na spad), podział kadru dwoma kliknięciami (także ukośny), scenariusz (tabela) i „Ustaw dymki”
// (dymki z tabeli, js/dialogi.js). Działa bez AI; AI korzysta z tych samych kadrów, tabeli i dymków.

import { siatkaKadrow, podzielKadr, naSpad, numerujKadry } from '../kadry.js';
import { dymkiZTabeli, kolumnyDialogu, kolumnyTekstu } from '../dialogi.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis } from './zapis.js';
import { typSekcji } from '../typ-sekcji.js';
import { $, powiadom } from '../ui.js';
import { stan, edytor, biezacaSekcja } from './kontekst.js';
import { t } from '../jezyk.js';

export const wKomiksie = () => stan.tryb === 'strona' && typSekcji(biezacaSekcja()) === 'komiks';

// Gotowe układy kadrów: wiersze z proporcjami szerokości kadrów (jak w js/kadry.js).
export const UKLADY_KADROW = [
  { id: '1', wiersze: [[1]] },
  { id: '2-pion', wiersze: [[1], [1]] },
  { id: '2-poziom', wiersze: [[1, 1]] },
  { id: '3-rzedy', wiersze: [[1], [1], [1]] },
  { id: '3-duzy-gora', wiersze: [[1], [1, 1]] },
  { id: '4-siatka', wiersze: [[1, 1], [1, 1]] },
  { id: '5', wiersze: [[1, 1], [1], [1, 1]] },
  { id: '6-siatka', wiersze: [[1, 1], [1, 1], [1, 1]] },
  { id: '9-siatka', wiersze: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },
];

const podgladUkladu = (u) => {
  const r = 2; const w = 40; const h = 54;
  const k = siatkaKadrow({ x: 3, y: 3, w: w - 6, h: h - 6 }, u.wiersze, r);
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="currentColor" stroke-opacity=".35"/>${k.map((q) => `<rect x="${q[0].x}" y="${q[0].y}" width="${q[1].x - q[0].x}" height="${q[2].y - q[1].y}" fill="currentColor" fill-opacity=".18" stroke="currentColor"/>`).join('')}</svg>`;
};

// Obszar kadrów na bieżącej stronie płótna (w marginesach) i format strony.
function obszarStrony() {
  const s = edytor.strony[edytor.aktywna];
  const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: spad = 0 } = edytor.wydruk;
  const m = s.marg;
  return { x0: s.x, obszar: { x: s.x + m.lewy, y: m.gora, w: w - m.lewy - m.prawy, h: h - m.gora - m.dol }, strona: { w, h }, spad };
}

const STYL_KADRU = { fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 0.6, strokeUniform: true, strokeLineJoin: 'miter' };

// Kadr na płótnie z punktów w układzie płótna.
function nowyKadr(punkty, nr) {
  const k = new fabric.Polygon(punkty.map((p) => ({ x: p.x, y: p.y })), { ...STYL_KADRU, kadr: nr, nazwa: t('komiks.kadrNr', { nr }) });
  return k;
}

// Punkty kadru (wielokąta) w układzie płótna.
function punktyKadru(o) {
  const m = o.calcTransformMatrix();
  return o.points.map((p) => new fabric.Point(p.x - o.pathOffset.x, p.y - o.pathOffset.y).transform(m)).map((p) => ({ x: p.x, y: p.y }));
}

const kadryNaStronie = () => {
  const { x0, strona } = obszarStrony();
  return edytor.canvas.getObjects().filter((o) => o.kadr && !o.zWzorca && o.left >= x0 - 20 && o.left < x0 + strona.w + 20);
};

// Numery kadrów w kolejności czytania (po każdej zmianie kadrów).
function przenumeruj() {
  const kadry = kadryNaStronie();
  const kolejne = numerujKadry(kadry.map((o) => punktyKadru(o)));
  for (const o of kadry) {
    const pk = JSON.stringify(punktyKadru(o));
    const nr = kolejne.findIndex((q) => JSON.stringify(q) === pk) + 1;
    o.set({ kadr: nr, nazwa: t('komiks.kadrNr', { nr }) });
  }
}

// Układ kadrów na stronie (zastępuje dotychczasowe kadry tej strony; obrazy w kadrach zostają jako zwykłe obrazy).
export function ulozKadry(idUkladu, { rynna = 4, naSpadStrony = false } = {}) {
  const u = UKLADY_KADROW.find((x) => x.id === idUkladu) || UKLADY_KADROW[0];
  const { obszar, strona, spad, x0 } = obszarStrony();
  for (const o of kadryNaStronie()) edytor.canvas.remove(o);
  let kadry = siatkaKadrow(obszar, u.wiersze, rynna);
  if (naSpadStrony) {
    const lok = { ...obszar, x: obszar.x - x0 };
    kadry = kadry.map((k) => naSpad(k.map((p) => ({ x: p.x - x0, y: p.y })), lok, strona, spad).map((p) => ({ x: p.x + x0, y: p.y })));
  }
  const nowe = kadry.map((k, i) => nowyKadr(k, i + 1));
  // kadry na spodzie strony – obrazy i dymki nad nimi
  nowe.forEach((k, i) => edytor.canvas.insertAt(i, k));
  edytor.canvas.requestRenderAll();
  edytor.zatwierdz();
  return nowe.length;
}

export function oknoKadrow() {
  if (!wKomiksie()) return;
  let dlg = $('#dlg-kadry');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-kadry';
    dlg.innerHTML = `<form method="dialog" class="formularz"><h2>${t('komiks.kadry')}</h2>
      <p class="ciche">${t('komiks.kadryOpis')}</p>
      <div class="uklady-kadrow" role="radiogroup">${UKLADY_KADROW.map((u, i) => `<label class="uklad-kadrow"><input type="radio" name="uklad" value="${u.id}"${i === 5 ? ' checked' : ''}>${podgladUkladu(u)}</label>`).join('')}</div>
      <div class="rzad"><label class="pole waskie"><span>${t('komiks.rynna')}</span><input type="number" name="rynna" min="0" max="20" step="0.5" value="4" inputmode="decimal"></label>
      <label class="przelacznik szeroki"><input type="checkbox" name="spad"><span>${t('komiks.naSpad')}</span></label></div>
      <p class="ciche">${t('komiks.kadryZastapia')}</p>
      <div class="przyciski-dialogu"><button class="przycisk" value="nie">${t('komiks.anuluj')}</button><button class="przycisk glowny" value="tak">${t('komiks.ulozKadry')}</button></div></form>`;
    document.body.append(dlg);
  }
  const f = dlg.querySelector('form');
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'tak') return;
    const rynna = Math.max(0, Math.min(20, Number(String(f.elements.rynna.value).replace(',', '.')) || 0));
    const ile = ulozKadry(f.elements.uklad.value, { rynna, naSpadStrony: f.elements.spad.checked });
    powiadom(t('komiks.ulozonoKadry', { ile }));
  }, { once: true });
  dlg.returnValue = '';
  dlg.showModal();
}

// ---------- Podział kadru: dwa kliknięcia wyznaczają linię (także ukośną) ----------
let podzial = null; // { a } po pierwszym kliknięciu
export const narzedziePodzialu = () => Boolean(podzial);
export function zacznijPodzial() {
  if (!wKomiksie()) return;
  podzial = { a: null };
  document.querySelector('[data-akcja="komiks-podziel"]')?.setAttribute('aria-pressed', 'true');
  powiadom(t('komiks.podzielPodpowiedz'));
}
export function zakonczPodzial() {
  podzial = null;
  document.querySelector('[data-akcja="komiks-podziel"]')?.setAttribute('aria-pressed', 'false');
}

// Dzieli kadry przecięte linią a→b; zwraca liczbę podzielonych kadrów.
export function podzielKadryLinia(a, b, rynna = 4) {
  let ile = 0;
  for (const o of kadryNaStronie()) {
    const czesci = podzielKadr(punktyKadru(o), a, b, rynna);
    if (!czesci) continue;
    const i = edytor.canvas.getObjects().indexOf(o);
    edytor.canvas.remove(o);
    czesci.forEach((q, j) => edytor.canvas.insertAt(i + j, nowyKadr(q, 0)));
    ile += 1;
  }
  if (ile) { przenumeruj(); edytor.canvas.requestRenderAll(); edytor.zatwierdz(); }
  return ile;
}

export function podlaczKomiks() {
  const c = edytor.canvas;
  if (!c || c._komiks) return;
  c._komiks = true;
  c.on('mouse:down', (opt) => {
    if (!podzial) return;
    if (!wKomiksie()) { zakonczPodzial(); return; }
    const p = opt.scenePoint || c.getScenePoint?.(opt.e) || c.getPointer(opt.e);
    if (!podzial.a) { podzial.a = { x: p.x, y: p.y }; return; }
    const ile = podzielKadryLinia(podzial.a, { x: p.x, y: p.y });
    zakonczPodzial();
    powiadom(ile ? t('komiks.podzielono', { ile }) : t('komiks.liniaNieTnie'), !ile);
  });
  document.addEventListener('keydown', (e) => { if (podzial && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); zakonczPodzial(); } }, true);
}

// ---------- Scenariusz i dymki z tabeli ----------
export const KOLUMNY_SCENARIUSZA = ['strona', 'kadr', 'postać', 'tekst', 'rodzaj', 'opis sceny'];
const scenariuszProjektu = () => (stan.projekt.tabele || []).find((tb) => kolumnyDialogu(tb).strona >= 0 && kolumnyDialogu(tb).tekst >= 0);

// Tabela scenariusza (tworzona przy pierwszym użyciu – z przykładowym wierszem) i okno Dane na niej.
export async function otworzScenariusz() {
  const p = stan.projekt;
  let tb = scenariuszProjektu();
  if (!tb) {
    zapiszBiezacyCel();
    tb = { id: `t_scenariusz_${Date.now().toString(36)}`, nazwa: t('komiks.scenariusz'), kolumny: [...KOLUMNY_SCENARIUSZA], wiersze: [['1', '1', t('komiks.przykladPostac'), t('komiks.przykladTekst'), 'mowa', '']] };
    p.tabele = [...(p.tabele || []), tb];
    zaplanujZapis();
  }
  const dane = window.seriodruk?.dane;
  if (dane) { dane.otworz(); dane.idTabeli = tb.id; dane.rysuj?.(); }
  return tb;
}

// Dymki ze scenariusza na stronach komiksu: strona w tabeli = numer strony w projekcie.
export async function ustawDymki({ kolumnaTekstu = null } = {}) {
  const tb = scenariuszProjektu();
  if (!tb) { powiadom(t('komiks.brakScenariusza'), true); return null; }
  zapiszBiezacyCel();
  const p = stan.projekt;
  const sekcja = (s) => p.sekcje.find((x) => x.id === s.sekcja) || p.sekcje[0];
  const wymiaryStrony = (s) => {
    const w = sekcja(s).wydruk; const m = w.marginesy || {};
    const lewy = m.zewnetrzny ?? m.lewy ?? 10; const prawy = m.wewnetrzny ?? m.prawy ?? 10;
    return { lewy, gora: m.gora ?? 10, szer: w.szerokosc_mm - lewy - prawy, wys: w.wysokosc_mm - (m.gora ?? 10) - (m.dol ?? 10) };
  };
  let n = 0;
  const wynik = dymkiZTabeli(p, tb, { kolumnaTekstu, wymiaryStrony, noweId: () => `dym_${Date.now().toString(36)}_${(n += 1)}` });
  await zaladujCel();
  zaplanujZapis();
  powiadom(t('komiks.ustawionoDymki', { dodane: wynik.dodane, zmienione: wynik.zmienione, usuniete: wynik.usuniete }) + (wynik.pominiete.length ? ` ${t('komiks.pominieto', { lista: wynik.pominiete.slice(0, 3).join('; ') })}` : ''), wynik.pominiete.length > 0);
  return wynik;
}

// Wybór wersji językowej przed ustawieniem dymków, gdy scenariusz ma kilka kolumn tekstu (tekst_pl, tekst_en…).
async function ustawDymkiZWyborem() {
  const tb = scenariuszProjektu();
  const kolumny = tb ? kolumnyTekstu(tb) : [];
  if (kolumny.length <= 1) return ustawDymki();
  let dlg = $('#dlg-dymki-jezyk');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-dymki-jezyk'; document.body.append(dlg); }
  dlg.innerHTML = `<form method="dialog" class="formularz"><h2>${t('komiks.ustawDymki')}</h2><p class="ciche">${t('komiks.ktoraKolumna')}</p>
    <label class="pole"><span>${t('komiks.kolumnaTekstu')}</span><select name="kolumna">${kolumny.map((k) => `<option>${k}</option>`).join('')}</select></label>
    <div class="przyciski-dialogu"><button class="przycisk" value="nie">${t('komiks.anuluj')}</button><button class="przycisk glowny" value="tak">${t('komiks.ustawDymki')}</button></div></form>`;
  return new Promise((ok) => {
    dlg.addEventListener('close', async () => ok(dlg.returnValue === 'tak' ? await ustawDymki({ kolumnaTekstu: dlg.querySelector('select').value }) : null), { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// Pasek narzędzi: przyciski z data-akcja="komiks-…".
export function obsluzAkcjeKomiksu(akcja) {
  if (akcja === 'komiks-dymek') return edytor.dodajDymek('mowa');
  if (akcja === 'komiks-kadry') return oknoKadrow();
  if (akcja === 'komiks-podziel') return narzedziePodzialu() ? zakonczPodzial() : zacznijPodzial();
  if (akcja === 'komiks-scenariusz') return otworzScenariusz();
  if (akcja === 'komiks-dymki') return ustawDymkiZWyborem();
  return null;
}
