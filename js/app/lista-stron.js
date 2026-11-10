// Lewa kolumna edytora: lista stron w sekcjach, lista wzorców, miniatury, operacje na stronach i menu kontekstowe.

import { stronySekcji, stronyZWzorcem, nowaStrona, uporzadkujStrony, kopiujStrone, wzorceStrony, sekcjaStrony } from '../projekt.js';
import { renderujCel } from '../zlozenie.js';
import { rozwin, blokiSerii, bokStrony, liczbaPowielen } from '../serie.js';
import { ikona } from '../ikony.js';
import { $$, $, potwierdz, powiadom, zapytajONazwe, zamknijMenu } from '../ui.js';
import { stan, ustawPanel, biezacaSekcja, biezacaStrona, edytor } from './kontekst.js';
import { naPlotnie, wybierzStroneArkusza, zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { nazwaFormatu, nazwyWzorcow } from './panel-strony.js';
import { panelWarstw, panel } from './skladniki.js';
import { edytujWzorzec } from './wzorce.js';

// ---------- Lista: strony (pogrupowane w sekcje) i wzorce ----------

export function ustawZakladke(nazwa) {
  stan.zakladka = nazwa;
  $$('#zakladki-listy input').forEach((r) => { r.checked = r.value === nazwa; });
  $('#lista-stron').hidden = nazwa !== 'strony';
  $('#lista-wzorcow').hidden = nazwa !== 'wzorce';
  $('#lista-warstw').hidden = nazwa !== 'warstwy';
  panelWarstw.pokaz(nazwa === 'warstwy');
  $('#stopka-strony').hidden = nazwa !== 'strony';
  $('#stopka-wzorce').hidden = nazwa !== 'wzorce';
}

export function renderujListe() {
  if (!stan.projekt) return;
  renderujListeStron();
  renderujListeWzorcow();
  $('#panel-strony li.aktywna')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  generujMiniatury();
}

function obrazMiniatury(id, wydruk) {
  const mini = stan.miniatury.get(id);
  const el = document.createElement(mini ? 'img' : 'div');
  if (mini) { el.src = mini; el.alt = ''; } else el.className = 'brak';
  el.style.aspectRatio = `${wydruk.szerokosc_mm + 2 * wydruk.spad_mm} / ${wydruk.wysokosc_mm + 2 * wydruk.spad_mm}`;
  return el;
}

function renderujListeStron() {
  const lista = $('#lista-stron');
  lista.replaceChildren();
  const { projekt } = stan;
  const ciag = rozwin(projekt);
  const blokStrony = new Map();
  for (const blok of blokiSerii(projekt)) for (const s of blok.strony) blokStrony.set(s, blok);
  $('#liczba-stron').textContent = projekt.strony.length;
  for (const sekcja of projekt.sekcje) {
    const strony = stronySekcji(projekt, sekcja);
    const rozkladowki = sekcja.uklad === 'rozkladowki';
    const nag = document.createElement('li');
    nag.className = 'sekcja-listy';
    nag.innerHTML = `<div class="opis-sekcji"><strong></strong><small></small></div>
      <button class="przycisk-ikona maly" aria-label="Opcje sekcji" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 18 })}</button>`;
    $('strong', nag).textContent = sekcja.nazwa;
    const opis = [nazwaFormatu(sekcja.wydruk), `${strony.length} str.`];
    if (rozkladowki) opis.push('rozkładówki');
    if (sekcja.wzorce.length) opis.push(nazwyWzorcow(sekcja.wzorce));
    $('small', nag).textContent = opis.join(' · ');
    $('small', nag).title = opis.join(' · ');
    $('button', nag).addEventListener('click', (e) => { e.stopPropagation(); otworzMenuSekcji(e.currentTarget, sekcja.id); });
    lista.append(nag);
    if (!strony.length) {
      const pusto = document.createElement('li');
      pusto.className = 'sekcja-pusta';
      pusto.innerHTML = '<button class="link">+ Dodaj pierwszą stronę</button>';
      $('button', pusto).addEventListener('click', () => dodajStrone(sekcja.id));
      lista.append(pusto);
    }
    strony.forEach((s, k) => {
      const i = projekt.strony.indexOf(s);
      const aktywna = stan.tryb === 'strona' && i === stan.indeks;
      const naArkuszu = stan.tryb === 'strona' && !aktywna && Boolean(naPlotnie?.strony?.includes(s.id));
      const bok = bokStrony(s, ciag);
      const nr = ciag.pierwszy.get(s.id).nr;
      const blok = blokStrony.get(s);
      const li = document.createElement('li');
      li.className = `strona${aktywna ? ' aktywna' : ''}${naArkuszu ? ' na-arkuszu' : ''}${bok ? ` w-rozkladowce ${bok}` : ''}`;
      // Pierwsza prawa strona sekcji stoi sama w prawej kolumnie.
      if (bok === 'prawa' && k === 0) li.classList.add('sama');
      if (blok) li.classList.add('w-serii');
      li.dataset.id = s.id;
      li.draggable = true;
      li.innerHTML = `<span class="numer">${nr ?? '–'}</span>
        <button class="miniatura"></button>
        <span class="nazwa"></span>
        <button class="przycisk-ikona menu-miniatury" aria-label="Opcje strony" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 18 })}</button>`;
      $('.miniatura', li).setAttribute('aria-label', `Strona ${nr ?? ''} ${s.nazwa}`);
      $('.miniatura', li).draggable = true; // przeciąganie zaczyna się zwykle na miniaturze
      if (aktywna) $('.miniatura', li).setAttribute('aria-current', 'page');
      $('.miniatura', li).append(obrazMiniatury(s.id, sekcja.wydruk));
      if (blok) {
        const ile = liczbaPowielen(projekt, blok.seria, blok.strony.length);
        const znak = document.createElement('span');
        znak.className = 'znak-serii';
        znak.textContent = `×${ile}`;
        $('.miniatura', li).append(znak);
        $('.miniatura', li).title = `Seria „${blok.seria.nazwa}”: ta strona powiela się ${ile} razy`;
      }
      $('.nazwa', li).textContent = bok ? `${nr ?? '–'} · ${s.nazwa}` : s.nazwa;
      $('.nazwa', li).title = s.nazwa;
      $('.miniatura', li).addEventListener('click', () => przejdzDoStrony(projekt.strony.indexOf(s)));
      $('.miniatura', li).addEventListener('dblclick', () => zmienNazweStrony(projekt.strony.indexOf(s)));
      $('.menu-miniatury', li).addEventListener('click', (e) => {
        e.stopPropagation();
        otworzMenuStrony(e.currentTarget, projekt.strony.indexOf(s));
      });
      lista.append(li);
    });
  }
}

function renderujListeWzorcow() {
  const lista = $('#lista-wzorcow');
  lista.replaceChildren();
  const { projekt } = stan;
  $('#liczba-wzorcow').textContent = projekt.wzorce.length;
  if (!projekt.wzorce.length) {
    const li = document.createElement('li');
    li.className = 'pusto-wzorce';
    li.innerHTML = '<strong>Brak wzorców</strong><p>Wzorzec to strona ze wspólnymi elementami – tłem, ramką, logo, numerem strony. Rysujesz go raz, a pojawia się na wszystkich stronach, które go używają.</p>';
    lista.append(li);
    return;
  }
  for (const w of projekt.wzorce) {
    const aktywny = stan.tryb === 'wzorzec' && w.id === stan.idWzorca;
    const n = stronyZWzorcem(projekt, w.id).length;
    const li = document.createElement('li');
    li.className = `strona wzorzec${aktywny ? ' aktywna' : ''}`;
    li.dataset.id = w.id;
    li.innerHTML = `<span class="numer">${ikona('ksiazka', { rozmiar: 14 })}</span>
      <button class="miniatura"></button>
      <span class="nazwa"></span>
      <button class="przycisk-ikona menu-miniatury" aria-label="Opcje wzorca" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 18 })}</button>`;
    $('.miniatura', li).append(obrazMiniatury(w.id, w.wydruk));
    $('.miniatura', li).setAttribute('aria-label', `Wzorzec ${w.nazwa}`);
    $('.nazwa', li).textContent = `${w.nazwa} · ${n} str.`;
    $('.miniatura', li).addEventListener('click', () => edytujWzorzec(w.id));
    $('.menu-miniatury', li).addEventListener('click', (e) => { e.stopPropagation(); otworzMenuWzorca(e.currentTarget, w.id); });
    lista.append(li);
  }
}

export function odswiezMiniature(id) {
  if (!id) return;
  const mini = stan.miniatury.get(id);
  const kontenerMini = $(`#ekran-edytora li[data-id="${id}"] .miniatura`);
  if (!kontenerMini || !mini) return;
  const stary = kontenerMini.firstElementChild;
  if (stary?.tagName === 'IMG') { stary.src = mini; return; }
  const img = document.createElement('img');
  img.src = mini;
  img.alt = '';
  img.style.aspectRatio = stary?.style.aspectRatio || '';
  if (stary) stary.replaceWith(img); else kontenerMini.append(img);
}

// Miniatury renderowane leniwie poza ekranem – tym samym kodem co podgląd
// (zlozenie.js), więc z wzorcami pod i nad treścią.
let generowanie = null;
export function generujMiniatury() {
  if (generowanie) return;
  generowanie = (async () => {
    const projekt = stan.projekt;
    const ciag = rozwin(projekt);
    const cele = [...projekt.strony, ...projekt.wzorce];
    for (const cel of cele) {
      if (stan.projekt !== projekt) break;
      if (stan.miniatury.has(cel.id)) continue;
      await new Promise((ok) => (window.requestIdleCallback || setTimeout)(ok));
      if (stan.projekt !== projekt || stan.miniatury.has(cel.id)) continue;
      stan.miniatury.set(cel.id, await renderujCel(projekt, cel, { szerokoscPx: 200, ciag }));
      odswiezMiniature(cel.id);
    }
  })().finally(() => { generowanie = null; });
}

// ---------- Strony ----------

export async function przejdzDoStrony(i) {
  if (i < 0 || i >= stan.projekt.strony.length) return;
  if (stan.tryb === 'strona' && i === stan.indeks) return;
  const naArkuszu = stan.tryb === 'strona' ? (naPlotnie?.strony || []).indexOf(stan.projekt.strony[i].id) : -1;
  if (naArkuszu >= 0) wybierzStroneArkusza(naArkuszu);
  else {
    zapiszBiezacyCel();
    stan.tryb = 'strona';
    stan.indeks = i;
    await zaladujCel();
  }
  if (document.body.dataset.panel === 'strony') ustawPanel('');
}

export async function dodajStrone(idSekcji = null) {
  zapiszBiezacyCel();
  const { projekt } = stan;
  const sekcja = idSekcji || biezacaSekcja().id;
  const nowa = nowaStrona(`Strona ${projekt.strony.length + 1}`, sekcja);
  const biezaca = biezacaStrona();
  if (stan.tryb === 'strona' && biezaca.sekcja === sekcja) {
    projekt.strony.splice(stan.indeks + 1, 0, nowa);
  } else {
    projekt.strony.push(nowa);
    uporzadkujStrony(projekt);
  }
  stan.tryb = 'strona';
  stan.indeks = projekt.strony.indexOf(nowa);
  ustawZakladke('strony');
  await zaladujCel();
  $('#lista-stron li.aktywna')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  zaplanujZapis();
}

export async function duplikujStrone(i) {
  zapiszBiezacyCel();
  const zrodlo = stan.projekt.strony[i];
  const kopia = kopiujStrone(zrodlo, `${zrodlo.nazwa} (kopia)`);
  stan.projekt.strony.splice(i + 1, 0, kopia);
  stan.tryb = 'strona';
  stan.indeks = i + 1;
  await zaladujCel();
  zaplanujZapis();
}

export async function usunStrone(i) {
  if (stan.projekt.strony.length <= 1) return;
  const s = stan.projekt.strony[i];
  if (!await potwierdz(`Usunąć stronę „${s.nazwa}”?`, 'Wszystkie elementy z tej strony zostaną usunięte.', 'Usuń stronę', true)) return;
  zapiszBiezacyCel();
  const biezaca = biezacaStrona();
  stan.projekt.strony.splice(i, 1);
  stan.miniatury.delete(s.id);
  const nowyIndeks = stan.projekt.strony.indexOf(biezaca);
  stan.indeks = nowyIndeks >= 0 ? nowyIndeks : Math.min(i, stan.projekt.strony.length - 1);
  if (stan.tryb === 'strona') await zaladujCel(); else renderujListe();
  zaplanujZapis();
  powiadom(`Usunięto stronę „${s.nazwa}”.`, false, { etykieta: 'Cofnij', fn: () => cofnijKrok(-1) });
}

// Przesuwanie w obrębie sekcji (do innej sekcji – przez właściwości strony).
export async function przesunStrone(i, kierunek) {
  const strony = stan.projekt.strony;
  const j = i + kierunek;
  if (j < 0 || j >= strony.length || strony[j].sekcja !== strony[i].sekcja) return;
  zapiszBiezacyCel();
  const biezaca = biezacaStrona();
  [strony[i], strony[j]] = [strony[j], strony[i]];
  stan.indeks = strony.indexOf(biezaca);
  for (const s of strony) if (wzorceStrony(stan.projekt, s).length) stan.miniatury.delete(s.id); // numery stron
  // W rozkładówkach zmienia się para stron i ich marginesy.
  if (sekcjaStrony(stan.projekt, strony[i]).uklad === 'rozkladowki') {
    stan.miniatury.clear();
    if (stan.tryb === 'strona') await zaladujCel();
  }
  renderujListe();
  zaplanujZapis();
}

export async function przeniesStroneDoSekcji(strona, idSekcji) {
  if (strona.sekcja === idSekcji) return;
  zapiszBiezacyCel();
  strona.sekcja = idSekcji;
  // Na koniec nowej sekcji.
  const strony = stan.projekt.strony;
  strony.splice(strony.indexOf(strona), 1);
  strony.push(strona);
  uporzadkujStrony(stan.projekt);
  stan.indeks = strony.indexOf(strona);
  stan.miniatury.clear();
  await zaladujCel();
  zaplanujZapis();
}

export async function zmienNazweStrony(i) {
  const s = stan.projekt.strony[i];
  const nazwa = await zapytajONazwe('Zmień nazwę strony', 'Nazwa strony', s.nazwa);
  if (!nazwa) return;
  s.nazwa = nazwa;
  renderujListe();
  if (stan.tryb === 'strona' && i === stan.indeks && !edytor.aktywny) panel.zbuduj();
  zaplanujZapis();
}

// ---------- Menu kontekstowe (strona, sekcja, wzorzec) ----------

function pokazMenu(menu, przycisk) {
  menu.hidden = false;
  const r = przycisk.getBoundingClientRect();
  const mr = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(window.innerWidth - mr.width - 8, Math.max(8, r.left))}px`;
  menu.style.top = `${Math.max(8, Math.min(window.innerHeight - mr.height - 8, r.bottom + 4))}px`;
  przycisk.setAttribute('aria-expanded', 'true');
}

function otworzMenuStrony(przycisk, i) {
  const menu = $('#menu-strony');
  const bylo = !menu.hidden && menu.dataset.indeks === String(i);
  zamknijMenu();
  if (bylo) return;
  const strony = stan.projekt.strony;
  menu.dataset.indeks = i;
  $('[data-akcja="strona-gora"]', menu).disabled = i === 0 || strony[i - 1].sekcja !== strony[i].sekcja;
  $('[data-akcja="strona-dol"]', menu).disabled = i === strony.length - 1 || strony[i + 1].sekcja !== strony[i].sekcja;
  $('[data-akcja="strona-usun"]', menu).disabled = strony.length <= 1;
  pokazMenu(menu, przycisk);
}

function otworzMenuSekcji(przycisk, id) {
  const menu = $('#menu-sekcji');
  const bylo = !menu.hidden && menu.dataset.id === id;
  zamknijMenu();
  if (bylo) return;
  const i = stan.projekt.sekcje.findIndex((s) => s.id === id);
  menu.dataset.id = id;
  $('[data-akcja="sekcja-gora"]', menu).disabled = i === 0;
  $('[data-akcja="sekcja-dol"]', menu).disabled = i === stan.projekt.sekcje.length - 1;
  $('[data-akcja="sekcja-usun"]', menu).disabled = stan.projekt.sekcje.length <= 1;
  pokazMenu(menu, przycisk);
}

function otworzMenuWzorca(przycisk, id) {
  const menu = $('#menu-wzorca');
  const bylo = !menu.hidden && menu.dataset.id === id;
  zamknijMenu();
  if (bylo) return;
  menu.dataset.id = id;
  const i = stan.projekt.wzorce.findIndex((w) => w.id === id);
  $('[data-akcja="wzorzec-gora"]', menu).disabled = i <= 0;
  $('[data-akcja="wzorzec-dol"]', menu).disabled = i >= stan.projekt.wzorce.length - 1;
  pokazMenu(menu, przycisk);
}

export const indeksZMenu = () => Number($('#menu-strony').dataset.indeks);
export const sekcjaZMenu = () => $('#menu-sekcji').dataset.id;
export const wzorzecZMenu = () => $('#menu-wzorca').dataset.id;

// Przeciągnięcie strony na liście: przed stronę docelową albo za nią. Strona
// upuszczona w innej sekcji przechodzi do niej.
export async function przeniesStrone(idStrony, idCelu, po) {
  const { projekt } = stan;
  const strona = projekt.strony.find((s) => s.id === idStrony);
  const cel = projekt.strony.find((s) => s.id === idCelu);
  if (!strona || !cel || strona === cel) return;
  zapiszBiezacyCel();
  const biezaca = biezacaStrona();
  projekt.strony.splice(projekt.strony.indexOf(strona), 1);
  strona.sekcja = cel.sekcja;
  projekt.strony.splice(projekt.strony.indexOf(cel) + (po ? 1 : 0), 0, strona);
  uporzadkujStrony(projekt);
  stan.indeks = projekt.strony.indexOf(biezaca);
  stan.miniatury.clear();
  if (stan.tryb === 'strona') await zaladujCel(); else renderujListe();
  generujMiniatury();
  zaplanujZapis();
}
