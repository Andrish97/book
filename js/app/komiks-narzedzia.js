/* global fabric */
// Narzędzia trybu „Komiks” (#364, plan komiksu A5–A7): pasek widoczny w sekcji typu „Komiks” – dymek, kadry (gotowe
// układy z rynną, kadry na spad), podział kadru dwoma kliknięciami (także ukośny), scenariusz (tabela) i „Ustaw dymki”
// (dymki z tabeli, js/dialogi.js). Działa bez AI; AI korzysta z tych samych kadrów, tabeli i dymków.

import { siatkaKadrow, podzielKadr, naSpad, numerujKadry, UKLADY_KADROW, kawalkiWebtoonu } from '../kadry.js';
import { dymkiZTabeli, kolumnyDialogu, kolumnyTekstu } from '../dialogi.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis } from './zapis.js';
import { typSekcji } from '../typ-sekcji.js';
import { $, powiadom, pobierz } from '../ui.js';
import { stan, edytor, biezacaSekcja } from './kontekst.js';
import { t, biezacyJezyk } from '../jezyk.js';
import { stylKomiksu, wartosciStylu, zastosujStyl } from '../style-tekstu.js';
import { kolorPostaci } from '../postacie.js';
import { oknoPostaci } from './komiks-postacie.js';
import { planImportu, wstawStrone, wstawDoKadru } from '../import-stron.js';
import { przyjmijPlik, wymiaryPliku, poNazwie } from '../obrazy-projektu.js';
import { nowaStrona, uid, uporzadkujStrony } from '../projekt.js';
import { biblioteka } from '../biblioteki.js';
import { kadryStrony, stylProjektu } from '../komiks-ai.js';
import { zapytanieScenariusza, scenariuszZOdpowiedzi, zapiszScenariusz } from '../komiks-scenariusz-ai.js';
import { tekstZOdpowiedzi } from '../ai-tekst.js';
import { zadanie } from '../ai-dostawcy.js';
import { MODEL_TEKSTU, kosztZUzycia, zapiszWydatek, szacujTekst } from '../ai-koszty.js';
import { czytajPlikTekstu } from '../import-tekstu.js';
import { otwartySejf } from './sejf-ai.js';
import { elementKadru } from '../kadry.js';
import { KOLUMNY_SCENARIUSZA } from '../komiks-scenariusz.js';
import { menuPrzy } from './menu-przycisku.js';
import { generujIWstaw } from './generuj-obraz.js';
import { JAKOSCI_OBRAZU, szacujObraz, opisKosztu } from '../ai-koszty.js';
import { proporcjaRamki } from '../ai-obrazy.js';
import { dataUrlZasobu, adresZasobu } from '../zasoby.js';

export const wKomiksie = () => stan.tryb === 'strona' && typSekcji(biezacaSekcja()) === 'komiks';

export { UKLADY_KADROW };

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
  const k = new fabric.Polygon(punkty.map((p) => ({ x: p.x, y: p.y })), { ...STYL_KADRU, kadr_nr: nr, nazwa: t('komiks.kadrNr', { nr }) });
  return k;
}

// Punkty kadru (wielokąta) w układzie płótna.
function punktyKadru(o) {
  const m = o.calcTransformMatrix();
  return o.points.map((p) => new fabric.Point(p.x - o.pathOffset.x, p.y - o.pathOffset.y).transform(m)).map((p) => ({ x: p.x, y: p.y }));
}

const kadryNaStronie = () => {
  const { x0, strona } = obszarStrony();
  return edytor.canvas.getObjects().filter((o) => o.kadr_nr != null && !o.zWzorca && o.left >= x0 - 20 && o.left < x0 + strona.w + 20);
};

// Numery kadrów w kolejności czytania (po każdej zmianie kadrów).
function przenumeruj() {
  const kadry = kadryNaStronie();
  const kolejne = numerujKadry(kadry.map((o) => punktyKadru(o)));
  for (const o of kadry) {
    const pk = JSON.stringify(punktyKadru(o));
    const nr = kolejne.findIndex((q) => JSON.stringify(q) === pk) + 1;
    o.set({ kadr_nr: nr, nazwa: t('komiks.kadrNr', { nr }) });
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
      <div class="przyciski-dialogu"><button class="przycisk" value="podziel" data-ikona="linia" title="${t('pasekNarzedzi.komiksPodzielOpis')}">${t('pasekNarzedzi.komiksPodziel')}</button><button class="przycisk" value="nie">${t('komiks.anuluj')}</button><button class="przycisk glowny" value="tak">${t('komiks.ulozKadry')}</button></div></form>`;
    document.body.append(dlg);
  }
  const f = dlg.querySelector('form');
  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'podziel') { zacznijPodzial(); return; } // podział kadru linią (#377 – zamiast osobnego przycisku)
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
  document.querySelector('[data-akcja="komiks-kadry"]')?.setAttribute('aria-pressed', 'true');
  powiadom(t('komiks.podzielPodpowiedz'));
}
export function zakonczPodzial() {
  podzial = null;
  document.querySelector('[data-akcja="komiks-kadry"]')?.setAttribute('aria-pressed', 'false');
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
export { KOLUMNY_SCENARIUSZA };
export const scenariuszProjektu = () => (stan.projekt.tabele || []).find((tb) => kolumnyDialogu(tb).strona >= 0 && kolumnyDialogu(tb).tekst >= 0);

// Tabela scenariusza (tworzona przy pierwszym użyciu – z przykładowym wierszem) i okno Dane na niej.
export async function otworzScenariusz({ bezOkna = false } = {}) {
  const p = stan.projekt;
  let tb = scenariuszProjektu();
  if (!tb) {
    zapiszBiezacyCel();
    tb = { id: `t_scenariusz_${Date.now().toString(36)}`, nazwa: t('komiks.scenariusz'), kolumny: [...KOLUMNY_SCENARIUSZA], wiersze: [['1', '1', '', '', '', '', t('komiks.przykladPostac'), t('komiks.przykladTekst'), 'mowa']] };
    p.tabele = [...(p.tabele || []), tb];
    zaplanujZapis();
  }
  const dane = window.seriodruk?.dane;
  if (dane && !bezOkna) { dane.otworz(); dane.idTabeli = tb.id; dane.rysuj?.(); }
  return tb;
}

// Dymki ze scenariusza na stronach komiksu: strona 1 w tabeli = pierwsza strona sekcji „Komiks” (okładka i inne
// sekcje się nie liczą); projekt bez sekcji komiksu – numer strony w projekcie.
export const stronyKomiksu = (p) => {
  const sekcje = new Set(p.sekcje.filter((s) => typSekcji(s) === 'komiks').map((s) => s.id));
  return sekcje.size ? p.strony.filter((s) => sekcje.has(s.sekcja)) : p.strony;
};
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
  const dialog = stylKomiksu(p, 'dialog');
  const wynik = dymkiZTabeli({ strony: stronyKomiksu(p) }, tb, { kolorPostaci: (imie) => kolorPostaci(p, imie), styl: { id: dialog.id, wartosci: wartosciStylu(dialog) }, kolumnaTekstu, wymiaryStrony, noweId: () => `dym_${Date.now().toString(36)}_${(n += 1)}` });
  await zaladujCel();
  zaplanujZapis();
  powiadom(t('komiks.ustawionoDymki', { dodane: wynik.dodane, zmienione: wynik.zmienione, usuniete: wynik.usuniete }) + (wynik.pominiete.length ? ` ${t('komiks.pominieto', { lista: wynik.pominiete.slice(0, 3).join('; ') })}` : ''), wynik.pominiete.length > 0);
  return wynik;
}

// Wybór wersji językowej przed ustawieniem dymków, gdy scenariusz ma kilka kolumn tekstu (tekst_pl, tekst_en…).
export async function ustawDymkiZWyborem() {
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

// Dymek w stylu „Dialog” i napis w stylu „Efekt dźwiękowy” (#367) – styl dochodzi do projektu przy pierwszym użyciu.
function wStyluKomiksu(obj, rodzaj) {
  if (!obj) return obj;
  const styl = stylKomiksu(stan.projekt, rodzaj);
  zastosujStyl(obj, styl);
  edytor.canvas.requestRenderAll();
  edytor.zatwierdz?.();
  zaplanujZapis();
  return obj;
}
export const dymekWStylu = () => wStyluKomiksu(edytor.dodajDymek('mowa'), 'dialog');
export const efektDzwiekowy = () => {
  const o = edytor.dodajTekst(t('komiks.efektTekst'));
  if (o) o.set({ width: 70, nazwa: t('komiks.stylEfekt') });
  return wStyluKomiksu(o, 'efekt');
};

// ---------- Wgraj strony (#369): wiele plików albo ZIP; numer w nazwie mówi, gdzie trafia obraz ----------
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml' };
async function plikiZWyboru(pliki) {
  const wynik = [];
  for (const f of pliki) {
    if (/\.zip$/i.test(f.name)) {
      const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'modułu ZIP');
      const zip = await JSZip.loadAsync(await f.arrayBuffer());
      for (const w of Object.values(zip.files)) {
        if (w.dir || /(^|\/)(__MACOSX|\.)/.test(w.name)) continue;
        const nazwa = w.name.split('/').pop();
        const typ = MIME[(nazwa.split('.').pop() || '').toLowerCase()];
        if (typ) wynik.push({ nazwa, blob: new Blob([await w.async('arraybuffer')], { type: typ }) });
      }
    } else wynik.push({ nazwa: f.name, blob: f });
  }
  return wynik;
}

export async function importujStrony(pliki) {
  const p = stan.projekt;
  if (!p) return null;
  const lista = await plikiZWyboru([...pliki]);
  const plan = planImportu(lista.map((x) => x.nazwa));
  if (!plan.strony.length && !plan.kadry.length) { powiadom(t('komiks.nicDoWgrania'), true); return null; }
  zapiszBiezacyCel();
  const sekcja = typSekcji(biezacaSekcja()) === 'komiks' ? biezacaSekcja() : (p.sekcje.find((x) => typSekcji(x) === 'komiks') || biezacaSekcja());
  // brakujące strony komiksu dochodzą na końcu sekcji
  const potrzeba = Math.max(0, ...plan.strony.map((x) => x.strona), ...plan.kadry.map((x) => x.strona));
  let strony = stronyKomiksu(p);
  for (let n = strony.length + 1; n <= potrzeba; n += 1) p.strony.push(nowaStrona(`Strona ${n}`, sekcja.id));
  uporzadkujStrony(p);
  strony = stronyKomiksu(p);
  const plik = (nazwa) => lista.find((x) => x.nazwa === nazwa).blob;
  const obraz = async (nazwa) => {
    const blob = plik(nazwa);
    const { id, nazwa: n } = await przyjmijPlik(p, blob, nazwa);
    return { id, nazwa: n, idElementu: uid('o'), ...(await wymiaryPliku(blob)) };
  };
  const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: spad = 0 } = sekcja.wydruk;
  const pominiete = [...plan.pominiete];
  for (const x of plan.strony) wstawStrone(strony[x.strona - 1], await obraz(x.nazwa), { w, h, spad });
  let kadry = 0;
  for (const x of plan.kadry) {
    if (wstawDoKadru(strony[x.strona - 1], x.kadr, await obraz(x.nazwa))) kadry += 1;
    else pominiete.push(t('komiks.brakKadru', { plik: x.nazwa, strona: x.strona, kadr: x.kadr }));
  }
  await zaladujCel();
  zaplanujZapis();
  powiadom(t('komiks.wgrano', { strony: plan.strony.length, kadry }) + (pominiete.length ? ` ${t('komiks.pominieto', { lista: pominiete.slice(0, 3).join('; ') })}` : ''), pominiete.length > 0);
  return { strony: plan.strony.length, kadry, pominiete };
}
export function wybierzStrony() {
  let wej = $('#plik-strony-komiksu');
  if (!wej) {
    wej = Object.assign(document.createElement('input'), { type: 'file', id: 'plik-strony-komiksu', multiple: true, accept: 'image/*,.zip', hidden: true });
    wej.addEventListener('change', async () => {
      try { await importujStrony(wej.files); } catch (e) { console.error(e); powiadom(e.message, true); }
      wej.value = '';
    });
    document.body.append(wej);
  }
  wej.click();
}

// ---------- Webtoon (#371): strony komiksu jedna pod drugą, 800 px szerokości, kawałki do 1280 px w ZIP-ie ----------
const wczytajObraz = (url) => new Promise((ok, zle) => { const i = new Image(); i.onload = () => ok(i); i.onerror = zle; i.src = url; });
export async function eksportWebtoon({ szerokosc = 800, max = 1280, pobierzPlik = true } = {}) {
  const p = stan.projekt;
  if (!p) return null;
  zapiszBiezacyCel();
  const { rozwin } = await import('../serie.js');
  const { renderujCel } = await import('../zlozenie.js');
  const ciag = rozwin(p);
  const egz = ciag.egzemplarze.filter((e) => !e.pusta && typSekcji(e.sekcja) === 'komiks');
  if (!egz.length) { powiadom(t('komiks.webtoonBrak'), true); return null; }
  powiadom(t('komiks.webtoonTrwa', { ile: egz.length }));
  const obrazy = [];
  for (const e of egz) obrazy.push(await wczytajObraz(await renderujCel(p, e, { szerokoscPx: szerokosc, spad: false, ciag, oryginaly: true })));
  const kawalki = kawalkiWebtoonu(obrazy.map((o) => Math.round((o.naturalHeight * szerokosc) / o.naturalWidth)), max);
  const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'modułu ZIP');
  const zip = new JSZip();
  for (const [i, k] of kawalki.entries()) {
    const c = Object.assign(document.createElement('canvas'), { width: szerokosc, height: k.h });
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, szerokosc, k.h);
    for (const q of k.czesci) {
      const o = obrazy[q.strona]; const skala = o.naturalWidth / szerokosc;
      ctx.drawImage(o, 0, q.sy * skala, o.naturalWidth, q.h * skala, 0, q.dy, szerokosc, q.h);
    }
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    zip.file(`${String(i + 1).padStart(2, '0')}.png`, blob);
  }
  const plik = await zip.generateAsync({ type: 'blob' });
  const nazwa = `${String(p.nazwa || 'komiks').replace(/[\\/:*?"<>|]+/g, '_')} – webtoon.zip`;
  if (pobierzPlik) {
    const url = URL.createObjectURL(plik);
    pobierz(nazwa, url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  powiadom(t('komiks.webtoonGotowe', { ile: kawalki.length }));
  return { nazwa, kawalki: kawalki.map((k) => k.h), plik };
}

// ---------- Mostek (#371): dwa zaznaczone dymki – połącz; jeden połączony – rozłącz ----------
export function mostekDymkow() {
  const a = edytor.canvas.getActiveObject();
  const lista = (a instanceof fabric.ActiveSelection ? a.getObjects() : [a]).filter((o) => o?.dymek);
  const wszystkie = edytor.canvas.getObjects();
  if (lista.length === 2) {
    const [x, y] = lista.sort((p, q) => wszystkie.indexOf(p) - wszystkie.indexOf(q));
    for (const o of wszystkie) if (o.dymek?.mostek && [x.id, y.id].includes(o.dymek.mostek)) o.dymek = { ...o.dymek, mostek: undefined };
    x.dymek = { ...x.dymek, mostek: y.id };
    y.dymek = { ...y.dymek, mostek: undefined };
    powiadom(t('komiks.mostekPolaczono'));
  } else if (lista.length === 1 && wszystkie.some((o) => o.dymek?.mostek && (o === lista[0] || o.dymek.mostek === lista[0].id))) {
    for (const o of wszystkie) if (o.dymek?.mostek && (o === lista[0] || o.dymek.mostek === lista[0].id)) o.dymek = { ...o.dymek, mostek: undefined };
    powiadom(t('komiks.mostekRozlaczono'));
  } else { powiadom(t('komiks.mostekPodpowiedz'), true); return false; }
  for (const o of wszystkie) if (o.dymek && o.dymek.mostek === undefined && 'mostek' in o.dymek) delete o.dymek.mostek;
  edytor.canvas.requestRenderAll();
  edytor.zatwierdz?.();
  zaplanujZapis();
  return true;
}

// ---------- Rysuj kadry z AI (C3, #374): opisy ze scenariusza i kart, obrazy wzorcowe, styl projektu ----------
async function wzorzecKarty(nazwa) {
  const id = nazwa ? poNazwie(stan.projekt, nazwa) : null;
  if (!id) return null;
  const url = await dataUrlZasobu(stan.projekt, id).catch(() => null);
  const m = /^data:([^;]+);base64,(.*)$/.exec(url || '');
  return m ? { typ: m[1], dane: m[2] } : null;
}
export function planKadrowStrony() {
  const p = stan.projekt;
  const strony = stronyKomiksu(p);
  const nr = strony.indexOf(p.strony[stan.indeks]) + 1;
  const kadry = kadryNaStronie().sort((a, b) => a.kadr_nr - b.kadr_nr);
  const plan = kadryStrony(p, scenariuszProjektu(), nr, kadry.length, biezacyJezyk());
  // kadr z obrazem z AI: opis, z którego powstał (D11 – „jeszcze raz” bez składania od nowa)
  return { nr, pozycje: plan.map((x, i) => ({ ...x, obiekt: kadry[i], poprzedni: kadry[i]?.zasob ? p.zasoby[kadry[i].zasob]?.ai?.opis || '' : '' })) };
}
// Rysowanie kadrów po kolei (okno [Rysuj kadry] i czat AI): obrazy wzorcowe kart, styl projektu, proporcje kadru.
export async function rysujPozycje(pozycje, { jakosc = 'szkic', postep = () => {}, wynik = { zl: 0, gotowe: 0 } } = {}) {
  for (const x of pozycje) {
    postep(wynik.gotowe + 1);
    const wzorce = (await Promise.all([...x.postacie.map((q) => q.obraz), x.miejsce?.obraz].filter(Boolean).map(wzorzecKarty))).filter(Boolean);
    const o = x.obiekt;
    const w = await generujIWstaw({ opis: x.opis, jakosc, proporcja: proporcjaRamki(o.width * o.scaleX, o.height * o.scaleY), cel: o, wzorce, styl: stylProjektu(stan.projekt), potwierdzono: true });
    wynik.zl += w.zl; wynik.gotowe += 1;
  }
  return wynik;
}
export const szacujPozycje = (pozycje, jakosc = 'szkic') => pozycje.reduce((a, x) => a + szacujObraz({ ...JAKOSCI_OBRAZU[jakosc], znakiOpisu: x.opis.length + 300, wzorce: x.postacie.filter((q) => q.obraz).length + (x.miejsce?.obraz ? 1 : 0) }), 0);

export function oknoRysujKadry() {
  if (!wKomiksie()) return;
  zapiszBiezacyCel();
  const { nr, pozycje } = planKadrowStrony();
  if (!pozycje.length) { powiadom(t('komiks.rysujBrakKadrow'), true); return; }
  let dlg = $('#dlg-rysuj-kadry');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-rysuj-kadry'; document.body.append(dlg); }
  dlg.innerHTML = `<form method="dialog" class="formularz"><h2>${t('komiks.rysujTytul', { nr })}</h2><p class="ciche">${t('komiks.rysujOpis')}</p>
    <div class="kadry-ai">${pozycje.map((x, i) => `<div class="kadr-ai"><div class="naglowek-kadru-ai">${x.obiekt.zasob ? `<img class="miniatura-kadru" alt="" src="${adresZasobu(stan.projekt.zasoby[x.obiekt.zasob]) || ''}">` : '<span class="miniatura-kadru pusta" aria-hidden="true"></span>'}<label class="przelacznik"><input type="checkbox" name="k${i}"${x.obiekt.zasob ? '' : ' checked'}><span>${t('komiks.kadrNr', { nr: x.kadr })}${x.postacie.length ? ` – ${x.postacie.map((q) => q.imie).join(', ')}` : ''}${x.obiekt.zasob ? ` ${t('komiks.rysujMaObraz')}` : ''}</span></label>${x.poprzedni ? `<button type="button" class="przycisk maly" data-ze-scenariusza="${i}">${t('komiks.rysujZeScenariusza')}</button>` : ''}</div><textarea name="o${i}" rows="3"></textarea>${x.poprzedni ? `<p class="ciche">${t('komiks.rysujPoprzedni')}</p>` : ''}</div>`).join('')}</div>
    <label class="pole"><span>${t('aiObraz.jakosc')}</span><select name="jakosc"><option value="szkic">${t('aiObraz.jakoscSzkic')}</option><option value="dokladny">${t('aiObraz.jakoscDokladny')}</option><option value="pro">${t('aiObraz.jakoscPro')}</option></select></label>
    <p class="koszt-ai" aria-live="polite"></p><p class="blad-ai" role="alert" hidden></p>
    <div class="przyciski-dialogu"><button class="przycisk" type="button" data-rola="anuluj">${t('komiks.anuluj')}</button><button class="przycisk glowny" type="submit" value="tak">${t('komiks.rysuj')}</button></div></form>`;
  const f = dlg.querySelector('form');
  pozycje.forEach((x, i) => { f.elements[`o${i}`].value = x.poprzedni || x.opis; });
  for (const b of dlg.querySelectorAll('[data-ze-scenariusza]')) b.addEventListener('click', () => { const i = Number(b.dataset.zeScenariusza); f.elements[`o${i}`].value = pozycje[i].opis; f.elements[`k${i}`].checked = true; f.dispatchEvent(new Event('change')); });
  const wybrane = () => pozycje.map((x, i) => i).filter((i) => f.elements[`k${i}`].checked);
  const policz = () => {
    const j = JAKOSCI_OBRAZU[f.elements.jakosc.value];
    const zl = wybrane().reduce((a, i) => a + szacujObraz({ ...j, znakiOpisu: f.elements[`o${i}`].value.length + 300, wzorce: pozycje[i].postacie.filter((q) => q.obraz).length + (pozycje[i].miejsce?.obraz ? 1 : 0) }), 0);
    dlg.querySelector('.koszt-ai').textContent = t('komiks.rysujKoszt', { ile: wybrane().length, zl: opisKosztu(zl, biezacyJezyk()) });
  };
  f.addEventListener('change', policz);
  policz();
  const blad = dlg.querySelector('.blad-ai');
  dlg.querySelector('[data-rola="anuluj"]').onclick = () => dlg.close('nie');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const lista = wybrane();
    if (!lista.length) return;
    const przycisk = f.querySelector('button[value="tak"]');
    przycisk.disabled = true; blad.hidden = true;
    const stan0 = { zl: 0, gotowe: 0 };
    try {
      await rysujPozycje(lista.map((i) => ({ ...pozycje[i], opis: f.elements[`o${i}`].value })), { jakosc: f.elements.jakosc.value, postep: (z) => { przycisk.textContent = t('komiks.rysujTrwa', { z, ile: lista.length }); }, wynik: stan0 });
      dlg.close('tak');
      powiadom(t('komiks.rysujGotowe', { ile: stan0.gotowe, zl: opisKosztu(stan0.zl, biezacyJezyk()) }));
    } catch (er) {
      blad.textContent = `${stan0.gotowe ? `${t('komiks.rysujCzesciowo', { ile: stan0.gotowe })} ` : ''}${er.message}`; blad.hidden = false;
    } finally { przycisk.disabled = false; przycisk.textContent = t('komiks.rysuj'); }
  };
  dlg.returnValue = '';
  dlg.showModal();
}

// ---------- Scenariusz z AI (C4, C6, #375): z pomysłu albo z dokumentu → podgląd → tabela scenariusza i karty ----------
const UKLAD_DLA = { 1: '1', 2: '2-pion', 3: '3-duzy-gora', 4: '4-siatka', 5: '5', 6: '6-siatka' };
// Strony komiksu z za małą liczbą kadrów (i bez obrazów w kadrach) dostają układ na tyle kadrów, ile ma scenariusz.
function dopasujKadry(p, sc) {
  const sekcja = p.sekcje.find((x) => typSekcji(x) === 'komiks') || p.sekcje[0];
  const potrzeba = Math.max(...sc.sceny.map((w) => w.strona));
  for (let n = stronyKomiksu(p).length + 1; n <= potrzeba; n += 1) p.strony.push(nowaStrona(`Strona ${n}`, sekcja.id));
  uporzadkujStrony(p);
  const strony = stronyKomiksu(p);
  const w = sekcja.wydruk; const m = w.marginesy || {};
  const obszar = { x: m.zewnetrzny ?? 10, y: m.gora ?? 10, w: w.szerokosc_mm - (m.zewnetrzny ?? 10) - (m.wewnetrzny ?? 10), h: w.wysokosc_mm - (m.gora ?? 10) - (m.dol ?? 10) };
  for (let n = 1; n <= potrzeba; n += 1) {
    const ile = Math.min(6, Math.max(...sc.sceny.filter((x) => x.strona === n).map((x) => x.kadr), 1));
    const st = strony[n - 1];
    const kadry = (st.obiekty || []).filter((o) => o.kadr_nr != null);
    if (kadry.length >= ile || kadry.some((o) => o.zasob) || (st.obiekty || []).some((o) => o.type === 'image')) continue;
    const nowe = siatkaKadrow(obszar, UKLADY_KADROW.find((u) => u.id === UKLAD_DLA[ile]).wiersze, 4).map((q, j) => elementKadru(q, j + 1, { id: uid('o') }));
    st.obiekty = [...nowe, ...(st.obiekty || []).filter((o) => o.kadr_nr == null)];
  }
}
export async function rozpiszScenariusz({ zrodlo, tekst, stron, jezyk }) {
  const klucz = (await otwartySejf())?.klucz('gemini');
  if (!klucz) throw new Error(t('aiObraz.brakKlucza'));
  const odp = await zadanie(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TEKSTU}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': klucz }, body: JSON.stringify(zapytanieScenariusza({ zrodlo, tekst, stron, jezyk })),
  });
  const { tekst: json, uzycie } = tekstZOdpowiedzi(odp);
  const zl = kosztZUzycia(MODEL_TEKSTU, uzycie) || 0;
  zapiszWydatek(zl, { projekt: stan.projekt, model: MODEL_TEKSTU, rodzaj: 'scenariusz' });
  return { sc: scenariuszZOdpowiedzi(json), zl };
}
export function oknoScenariuszaAi() {
  if (!wKomiksie()) return;
  let dlg = $('#dlg-scenariusz-ai');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-scenariusz-ai'; document.body.append(dlg); }
  dlg.innerHTML = `<form method="dialog" class="formularz"><h2>${t('komiks.scenAiTytul')}</h2>
    <div class="przelacznik-segmentowy" role="radiogroup"><label><input type="radio" name="zrodlo" value="pomysl" checked><span>${t('komiks.scenAiZPomyslu')}</span></label><label><input type="radio" name="zrodlo" value="dokument"><span>${t('komiks.scenAiZDokumentu')}</span></label></div>
    <div data-zrodlo="pomysl"><label class="pole"><span>${t('komiks.scenAiPomysl')}</span><textarea name="pomysl" rows="4"></textarea></label>
      <label class="pole waskie"><span>${t('komiks.scenAiStron')}</span><input type="number" name="stron" min="1" max="12" value="3"></label></div>
    <div data-zrodlo="dokument" hidden><label class="pole"><span>${t('komiks.scenAiPlik')}</span><input type="file" name="plik" accept=".txt,.md,.markdown,.docx,.odt"></label><p class="ciche">${t('komiks.scenAiPlikOpis')}</p></div>
    <p class="ciche">${t('komiks.scenAiOpis')}</p>
    <div class="podglad-scenariusza" hidden></div>
    <p class="koszt-ai" aria-live="polite">${t('komiks.scenAiKoszt', { zl: opisKosztu(szacujTekst({ znakiWe: 3000, znakiWy: 4000 }), biezacyJezyk()) })}</p><p class="blad-ai" role="alert" hidden></p>
    <div class="przyciski-dialogu"><button class="przycisk" type="button" data-rola="anuluj">${t('komiks.anuluj')}</button><button class="przycisk" type="button" data-rola="rozpisz">${t('komiks.scenAiRozpisz')}</button><button class="przycisk glowny" type="submit" value="tak" disabled>${t('komiks.scenAiZapisz')}</button></div></form>`;
  const f = dlg.querySelector('form');
  f.elements.pomysl.placeholder = t('komiks.scenAiPrzyklad');
  const blad = dlg.querySelector('.blad-ai');
  const podglad = dlg.querySelector('.podglad-scenariusza');
  const zapisz = f.querySelector('button[value="tak"]');
  let wynik = null;
  f.addEventListener('change', (e) => {
    if (e.target.name !== 'zrodlo') return;
    for (const d of dlg.querySelectorAll('[data-zrodlo]')) d.hidden = d.dataset.zrodlo !== f.elements.zrodlo.value;
  });
  dlg.querySelector('[data-rola="anuluj"]').onclick = () => dlg.close('nie');
  dlg.querySelector('[data-rola="rozpisz"]').onclick = async (e) => {
    const b = e.currentTarget;
    blad.hidden = true;
    try {
      const zrodlo = f.elements.zrodlo.value;
      let tekst = f.elements.pomysl.value.trim();
      if (zrodlo === 'dokument') {
        const plik = f.elements.plik.files?.[0];
        if (!plik) throw new Error(t('komiks.scenAiBrakPliku'));
        const JSZip = /\.(docx|odt)$/i.test(plik.name) ? await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'modułu ZIP') : null;
        tekst = (await czytajPlikTekstu(plik, JSZip)).akapity.map((a) => a.tekst).join('\n').slice(0, 60000);
      }
      if (!tekst) throw new Error(t('komiks.scenAiBrakPomyslu'));
      b.disabled = true; b.textContent = t('aiTekst.trwa');
      const r = await rozpiszScenariusz({ zrodlo, tekst, stron: Number(f.elements.stron.value) || 3, jezyk: biezacyJezyk() });
      wynik = r.sc;
      const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      podglad.innerHTML = `<p><b>${esc(wynik.tytul)}</b> – ${t('komiks.scenAiPodsumowanie', { stron: Math.max(...wynik.sceny.map((w) => w.strona)), wierszy: wynik.sceny.length })}</p>
        <p class="ciche">${t('komiks.postacie')}: ${wynik.postacie.map((p) => esc(p.imie)).join(', ') || '–'} · ${t('komiks.miejsca')}: ${wynik.miejsca.map((m) => esc(m.nazwa)).join(', ') || '–'}</p>
        <div class="przewijany"><table class="tabela-podgladu"><tbody>${wynik.sceny.map((w) => `<tr><td>${w.strona}/${w.kadr}</td><td>${esc(w.postac)}</td><td>${esc(w.tekst)}</td><td class="ciche">${esc(w.opis_sceny)}</td></tr>`).join('')}</tbody></table></div>`;
      podglad.hidden = false;
      zapisz.disabled = false;
      dlg.querySelector('.koszt-ai').textContent = t('komiks.scenAiKosztPo', { zl: opisKosztu(r.zl, biezacyJezyk()) });
    } catch (er) { blad.textContent = er.message; blad.hidden = false; } finally { b.disabled = false; b.textContent = t('komiks.scenAiRozpisz'); }
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!wynik) return;
    zapiszBiezacyCel();
    const p = stan.projekt;
    const tb = scenariuszProjektu() || await otworzScenariusz({ bezOkna: true });
    const w = zapiszScenariusz(p, tb, wynik, { postacie: { nazwa: t('komiks.postacie') }, miejsca: { nazwa: t('komiks.miejsca') } });
    dopasujKadry(p, wynik);
    await zaladujCel();
    zaplanujZapis();
    dlg.close('tak');
    powiadom(t('komiks.scenAiZapisano', { wierszy: w.wierszy, stron: w.stron }));
  };
  dlg.returnValue = '';
  dlg.showModal();
}

// [Dymek ▾] (#377): rodzaje dymków, efekt dźwiękowy i mostek w jednym menu.
export function menuDymka() {
  const b = document.querySelector('[data-akcja="komiks-dymek"]');
  const dymek = (rodzaj) => () => wStyluKomiksu(edytor.dodajDymek(rodzaj), 'dialog');
  menuPrzy(b, [
    ...['mowa', 'mysl', 'krzyk', 'szept', 'narracja'].map((r) => ({ ikona: 'dymek', tekst: t(`komiks.rodzaj_${r}`), wartosc: r, wykonaj: dymek(r) })),
    '-',
    { ikona: 'tekst', tekst: t('komiks.stylEfekt'), opis: t('komiks.efektOpis'), wartosc: 'efekt', wykonaj: efektDzwiekowy },
    { ikona: 'link', tekst: t('pasekNarzedzi.komiksMostek'), opis: t('komiks.mostekOpis'), wartosc: 'mostek', wykonaj: mostekDymkow },
  ]);
}

// Pasek narzędzi: przyciski z data-akcja="komiks-…".
export function obsluzAkcjeKomiksu(akcja) {
  if (akcja === 'komiks-dymek') return menuDymka();
  if (akcja === 'komiks-efekt') return efektDzwiekowy();
  if (akcja === 'komiks-kadry') return oknoKadrow();
  if (akcja === 'komiks-podziel') return narzedziePodzialu() ? zakonczPodzial() : zacznijPodzial();
  if (akcja === 'komiks-scenariusz') return otworzScenariusz();
  if (akcja === 'komiks-dymki') return ustawDymkiZWyborem();
  if (akcja === 'komiks-postacie') return oknoPostaci();
  if (akcja === 'komiks-rysuj') return oknoRysujKadry();
  if (akcja === 'komiks-scenariusz-ai') return oknoScenariuszaAi();
  if (akcja === 'komiks-wgraj') return wybierzStrony();
  if (akcja === 'komiks-mostek') return mostekDymkow();
  if (akcja === 'komiks-webtoon') return eksportWebtoon().catch((e) => { console.error(e); powiadom(e.message, true); });
  return null;
}
