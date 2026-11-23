// Lewa kolumna edytora: lista stron w sekcjach, lista wzorców, miniatury, operacje na stronach i menu kontekstowe.

import { odciskProjektu, odciskMiniatury, wczytajMiniaturyProjektu, zapiszMiniatureStrony, oznaczUzyte } from '../miniatury-stron.js';
import {
  stronySekcji, stronyZWzorcem, nowaStrona, uporzadkujStrony, kopiujStrone, wzorceStrony, sekcjaStrony,
} from '../projekt.js';
import { renderujCel } from '../zlozenie.js';
import { zachowajTekstStrony, uporzadkujWatkiPoStronach } from '../watki.js';
import { uid } from '../projekt.js';
import { rozwin, blokiSerii, bokStrony } from '../serie.js';
import { ikona } from '../ikony.js';
import { $, potwierdz, powiadom, zapytajONazwe, zamknijMenu } from '../ui.js';
import { stan, ustawPanel, biezacaSekcja, biezacaStrona, edytor } from './kontekst.js';
import { naPlotnie, wybierzStroneArkusza, zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { nazwaFormatu, nazwyWzorcow } from './panel-strony.js';
import { panel } from './skladniki.js';
import { edytujWzorzec } from './wzorce.js';
import { pokazWarstwy } from './dok-warstw.js';
import { bilansSkladki, opisSkladki } from '../okladka.js';
import { dopelnijSkladke } from './sekcje.js';
import { opisSchowka } from './schowek-okno.js';
import { wpiszNazwe, t } from '../jezyk.js';

// ---------- Lista: strony (pogrupowane w sekcje) i wzorce ----------

// Dawne zakładki prawego panelu (Właściwości | Warstwy). Warstwy mają teraz własny panel (#115, dok-warstw.js);
// „warstwy” pokazuje go, inne nazwy (strony, wzorce) zostają bez skutku.
export function ustawZakladke(nazwa) {
  if (nazwa === 'warstwy') pokazWarstwy();
}

export function renderujListe() {
  if (!stan.projekt) return;
  renderujListeStron();
  renderujListeWzorcow();
  $('#panel-strony li.aktywna')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  generujMiniatury();
}

// Sama zmiana bieżącej strony (#158): lista stron jest już zbudowana – wystarczy przestawić zaznaczenie,
// zamiast budować od nowa kilkadziesiąt pozycji z miniaturami przy każdym przewinięciu strony. Gdy lista
// nie odpowiada stronom projektu (dodana, usunięta), budowana jest w całości jak dotąd.
export function oznaczBiezacaWLiscie() {
  const { projekt } = stan;
  if (!projekt) return;
  const pozycje = [...$('#lista-stron').querySelectorAll('li.strona[data-id]')];
  const ids = new Set(pozycje.map((li) => li.dataset.id));
  if (pozycje.length !== projekt.strony.length || projekt.strony.some((s) => !ids.has(s.id))) { renderujListe(); return; }
  const biezaca = stan.tryb === 'strona' ? projekt.strony[stan.indeks]?.id : null;
  const naArkuszu = new Set(stan.tryb === 'strona' ? naPlotnie?.strony || [] : []);
  for (const li of pozycje) {
    const aktywna = li.dataset.id === biezaca;
    li.classList.toggle('aktywna', aktywna);
    li.classList.toggle('na-arkuszu', !aktywna && naArkuszu.has(li.dataset.id));
    const m = li.querySelector('.miniatura');
    if (aktywna) m?.setAttribute('aria-current', 'page'); else m?.removeAttribute('aria-current');
  }
  renderujListeWzorcow();
  $('#panel-strony li.aktywna')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  generujMiniatury();
}

export function obrazMiniatury(id, wydruk) {
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
  // Ile razy każda strona naprawdę wychodzi w wydruku (wiersze pomijane nie dają stron).
  const ileRazy = new Map();
  for (const e of ciag.egzemplarze) ileRazy.set(e.strona.id, (ileRazy.get(e.strona.id) || 0) + 1);
  $('#liczba-stron').textContent = projekt.strony.length;
  for (const sekcja of projekt.sekcje) {
    const strony = stronySekcji(projekt, sekcja);
    const rozkladowki = sekcja.uklad === 'rozkladowki';
    const nag = document.createElement('li');
    nag.className = 'sekcja-listy';
    nag.innerHTML = `<div class="opis-sekcji"><strong></strong><small></small></div>
      <button class="przycisk-ikona maly" aria-label="${t('listaStron.opcjeSekcji')}" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 18 })}</button>`;
    wpiszNazwe($('strong', nag), sekcja.nazwa);
    const opis = [nazwaFormatu(sekcja.wydruk), t('listaStron.ileStr', { n: strony.length })];
    if (rozkladowki) opis.push(t('listaStron.rozkladowki'));
    if (sekcja.wzorce.length) opis.push(nazwyWzorcow(sekcja.wzorce));
    // Okładka (#119): oprawa i grzbiet; składki (#120): ile stron brakuje do pełnej składki.
    if (sekcja.okladka?.wynik) opis.splice(0, 2, sekcja.okladka.oprawa === 'zeszytowa' ? t('listaStron.okladkaBezGrzbietu') : t('listaStron.okladkaGrzbiet', { mm: String(sekcja.okladka.wynik.grzbiet).replace('.', ',') }), nazwaFormatu(sekcja.wydruk));
    $('small', nag).textContent = opis.join(' · ');
    $('small', nag).title = opis.join(' · ');
    const skladka = bilansSkladki(sekcja, ciag);
    if (skladka) {
      const p = document.createElement('p');
      p.className = `skladka-sekcji${skladka.brakuje ? ' brak' : ''}`;
      p.textContent = opisSkladki(skladka);
      if (skladka.brakuje) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'przycisk maly';
        b.textContent = t('listaStron.dopelnijPustymi');
        b.title = t('listaStron.dodajePustychStronNa', { brakuje: skladka.brakuje });
        b.addEventListener('click', (e) => { e.stopPropagation(); dopelnijSkladke(sekcja.id); });
        p.append(b);
      }
      $('.opis-sekcji', nag).append(p);
    }
    $('button', nag).addEventListener('click', (e) => { e.stopPropagation(); otworzMenuSekcji(e.currentTarget, sekcja.id); });
    lista.append(nag);
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
        <button class="przycisk-ikona menu-miniatury" aria-label="${t('listaStron.opcjeStrony')}" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 18 })}</button>`;
      $('.miniatura', li).setAttribute('aria-label', t('listaStron.strona', { x: nr ?? '', nazwa: s.nazwa }));
      $('.miniatura', li).draggable = true; // przeciąganie zaczyna się zwykle na miniaturze
      if (aktywna) $('.miniatura', li).setAttribute('aria-current', 'page');
      $('.miniatura', li).append(obrazMiniatury(s.id, sekcja.wydruk));
      if (blok) {
        const ile = ileRazy.get(s.id) || 0;
        const znak = document.createElement('span');
        znak.className = 'znak-serii';
        znak.textContent = `×${ile}`;
        $('.miniatura', li).append(znak);
        $('.miniatura', li).title = ile
          ? t('listaStron.seriaTaStronaWychodzi', { nazwa: blok.seria.nazwa, ile })
          : t('listaStron.seriaTejStronyNie', { nazwa: blok.seria.nazwa });
      }
      // Które wzorce leżą na stronie (#164): mały znak na miniaturze, nazwy w podpowiedzi.
      const wzStrony = wzorceStrony(projekt, s);
      if (wzStrony.length) {
        const znak = document.createElement('span');
        znak.className = 'znak-wzorcow';
        znak.innerHTML = `${ikona('wzorzec', { rozmiar: 11 })}${wzStrony.length > 1 ? `<span>${wzStrony.length}</span>` : ''}`;
        znak.title = t('listaStron.wzorce', { join: wzStrony.map((w) => w.nazwa).join(', ') });
        $('.miniatura', li).append(znak);
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
    lista.append(kafelekDodawania(sekcja, strony.length === 0));
  }
}

// Kafelek „+” na końcu stron sekcji (#109): wygląda jak miniatura, dodaje stronę (po bieżącej, jeśli
// bieżąca jest w tej sekcji – jak dawny przycisk „Strona” – inaczej na koniec sekcji).
function kafelekDodawania(sekcja, pusta) {
  const li = document.createElement('li');
  li.className = `kafelek-dodaj-strone${pusta ? ' w-pustej' : ''}`;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'kafelek-dodaj';
  const opis = pusta ? t('listaStron.dodajPierwszaStroneSekcji', { nazwa: sekcja.nazwa }) : 'Dodaj stronę';
  b.title = opis;
  b.setAttribute('aria-label', opis);
  b.innerHTML = `${ikona('plus', { rozmiar: 22 })}${pusta ? `<span>${t('listaStron.dodajPierwsza')}</span>` : ''}`;
  b.style.aspectRatio = `${sekcja.wydruk.szerokosc_mm + 2 * sekcja.wydruk.spad_mm} / ${sekcja.wydruk.wysokosc_mm + 2 * sekcja.wydruk.spad_mm}`;
  const wBiezacej = stan.tryb === 'strona' && biezacaStrona()?.sekcja === sekcja.id;
  if (wBiezacej) { b.dataset.akcja = 'strona-dodaj'; b.id = 'przycisk-dodaj-strone'; } else b.addEventListener('click', () => dodajStrone(sekcja.id));
  li.append(b);
  return li;
}

// Wzorce projektu w oknie „Wzorce”: miniatura, liczba stron, dodawanie do bieżącej strony i sekcji.
function renderujListeWzorcow() {
  const lista = $('#lista-wzorcow');
  lista.replaceChildren();
  const { projekt } = stan;
  $('#liczba-wzorcow').textContent = projekt.wzorce.length;
  $('#liczba-wzorcow').hidden = projekt.wzorce.length === 0;
  const lp = $('#liczba-wzorcow-panel');
  if (lp) { lp.textContent = projekt.wzorce.length; lp.hidden = projekt.wzorce.length === 0; }
  if (!projekt.wzorce.length) {
    const li = document.createElement('li');
    li.className = 'pusto-wzorce';
    li.innerHTML = `<strong>${t('listaStron.brakWzorcow')}</strong><p>${t('listaStron.naRazieKazdaStrona')}</p>`;
    lista.append(li);
    return;
  }
  const strona = stan.tryb === 'strona' ? biezacaStrona() : null;
  const sekcja = strona ? sekcjaStrony(projekt, strona) : null;
  const naStronie = strona ? new Set(wzorceStrony(projekt, strona).map((w) => w.id)) : new Set();
  for (const w of projekt.wzorce) {
    const aktywny = stan.tryb === 'wzorzec' && w.id === stan.idWzorca;
    const n = stronyZWzorcem(projekt, w.id).length;
    const li = document.createElement('li');
    li.className = `strona wzorzec${aktywny ? ' aktywna' : ''}`;
    li.dataset.id = w.id;
    li.innerHTML = `<button class="miniatura" title="${t('listaStron.edytujWzorzec')}"></button>
      <div class="opis-wzorca"><strong class="nazwa"></strong><small></small>
        <div class="rzad-przyciskow">
          <button type="button" class="przycisk maly" data-op="strona" aria-pressed="false"></button>
          <button type="button" class="przycisk maly" data-op="sekcja" aria-pressed="false"></button>
          <button type="button" class="przycisk maly" data-op="edytuj">${t('listaStron.edytuj')}</button>
        </div>
      </div>
      <button class="przycisk-ikona menu-miniatury" aria-label="${t('listaStron.opcjeWzorca')}" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 18 })}</button>`;
    $('.miniatura', li).append(obrazMiniatury(w.id, w.wydruk));
    $('.miniatura', li).setAttribute('aria-label', t('listaStron.wzorzec', { nazwa: w.nazwa }));
    wpiszNazwe($('.nazwa', li), w.nazwa);
    $('small', li).textContent = `${n} str.${w.lustro ? ' · odbicie na lewych stronach' : ''}`;
    const [naStr, wSek] = [$('[data-op="strona"]', li), $('[data-op="sekcja"]', li)];
    naStr.hidden = !strona; wSek.hidden = !strona;
    if (strona) {
      const jest = naStronie.has(w.id);
      naStr.textContent = jest ? t('listaStron.naTejStronie') : t('listaStron.dodajDoTejStrony');
      naStr.setAttribute('aria-pressed', String(jest));
      const wSekcji = sekcja.wzorce.includes(w.id);
      wSek.textContent = wSekcji ? t('listaStron.wSekcji', { nazwa: sekcja.nazwa }) : t('listaStron.doCalejSekcji', { nazwa: sekcja.nazwa });
      wSek.setAttribute('aria-pressed', String(wSekcji));
    }
    $('.miniatura', li).addEventListener('click', () => edytujWzorzec(w.id));
    $('.menu-miniatury', li).addEventListener('click', (e) => { e.stopPropagation(); otworzMenuWzorca(e.currentTarget, w.id); });
    lista.append(li);
  }
}

export function odswiezMiniature(id) {
  if (!id) return;
  const mini = stan.miniatury.get(id);
  const kontenerMini = document.querySelector(`#lista-stron li[data-id="${id}"] .miniatura, #lista-wzorcow li[data-id="${id}"] .miniatura`);
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
// Czeka na wolną chwilę przeglądarki (najwyżej 1,5 s).
const bezczynnie = () => new Promise((ok) => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => ok(), { timeout: 1500 });
  else setTimeout(ok, 50);
});
// Użytkownik właśnie pisze albo przesuwa element (#158): narysowanie strony w tle to na telefonie kilkaset ms,
// które wpadłyby w krótką przerwę między znakami albo ruchami palca – miniatura poczeka, aż skończy.
// Pisanie liczy się do 2 s po ostatnim znaku – ramka otwarta do pisania bez pisania nie wstrzymuje miniatur.
let ostatniZnak = 0;
for (const z of ['keydown', 'input']) document.addEventListener(z, () => { ostatniZnak = performance.now(); }, true);
const wTrakciePracy = () => Boolean(edytor?.canvas?._currentTransform || (edytor?.aktywny?.isEditing && performance.now() - ostatniZnak < 2000));

let generowanie = null;
export function generujMiniatury() {
  if (generowanie) return;
  generowanie = (async () => {
    const projekt = stan.projekt;
    const ciag = rozwin(projekt);
    const cele = [...projekt.strony, ...projekt.wzorce];
    // Postęp w panelu stron, gdy brakuje wielu miniatur (#159) – np. po otwarciu dużego projektu.
    const brak = cele.filter((c) => !stan.miniatury.has(c.id)).length;
    let gotowe = 0;
    const pokazPostep = brak > 12;
    const pasek = $('#postep-miniatur');
    const odswiezPostep = () => {
      if (!pasek || !pokazPostep) return;
      const pr = Math.round((gotowe / brak) * 100);
      pasek.hidden = gotowe >= brak;
      $('#postep-miniatur-tekst').textContent = t('listaStron.miniaturyStronZ', { gotowe, brak });
      pasek.querySelector('.postep-wypelnienie').style.width = `${pr}%`;
      pasek.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(pr));
    };
    // Miniatury zapisane na urządzeniu (#193): ta sama strona w tym samym stanie – bez rysowania.
    const wspolny = odciskProjektu(projekt);
    const zapisane = brak ? await wczytajMiniaturyProjektu(projekt.id) : new Map();
    const uzyte = [];
    for (const cel of cele) {
      if (stan.projekt !== projekt) break;
      if (stan.miniatury.has(cel.id)) continue;
      const z = zapisane.get(cel.id);
      if (z && z.odcisk === odciskMiniatury(projekt, cel, wspolny, ciag.liczbaStron)) {
        stan.miniatury.set(cel.id, z.url);
        odswiezMiniature(cel.id);
        uzyte.push(z);
        gotowe += 1;
      }
    }
    oznaczUzyte(uzyte);
    odswiezPostep();
    for (const cel of cele) {
      if (stan.projekt !== projekt) break;
      if (stan.miniatury.has(cel.id)) continue;
      await new Promise((ok) => (window.requestIdleCallback || setTimeout)(ok));
      if (stan.projekt !== projekt || stan.miniatury.has(cel.id)) continue;
      const odcisk = odciskMiniatury(projekt, cel, odciskProjektu(projekt), ciag.liczbaStron);
      const url = await renderujCel(projekt, cel, { szerokoscPx: 200, ciag });
      stan.miniatury.set(cel.id, url);
      zapiszMiniatureStrony(projekt.id, cel.id, odcisk, url);
      odswiezMiniature(cel.id);
      gotowe += 1;
      odswiezPostep();
    }
  })().finally(() => { generowanie = null; const p = $('#postep-miniatur'); if (p) p.hidden = true; });
}

// Miniatura z edytora pojawia się od razu, ale wycina stronę z płótna – w pasku spadu przy
// grzbiecie i na stronach z danymi różni się od tej z podglądu. Dlatego chwilę po zmianie
// miniatura jest rysowana jeszcze raz tym samym kodem co podgląd i PDF.
let timerMiniatur = null;
const doOdrysowania = new Set();
export function odrysujMiniaturyWTle(ids) {
  for (const id of ids || []) if (id) doOdrysowania.add(id);
  clearTimeout(timerMiniatur);
  timerMiniatur = setTimeout(async () => {
    const projekt = stan.projekt;
    if (!projekt) { doOdrysowania.clear(); return; }
    if (wTrakciePracy()) { odrysujMiniaturyWTle(); return; } // jeszcze raz za chwilę, z tą samą kolejką
    const ciag = rozwin(projekt);
    const kolejka = [...doOdrysowania];
    doOdrysowania.clear();
    for (const id of kolejka) {
      const cel = projekt.strony.find((s) => s.id === id) || projekt.wzorce.find((w) => w.id === id);
      if (!cel || stan.projekt !== projekt) continue;
      // Rysowanie strony to dłuższa chwila – w wolnym czasie przeglądarki, nie w pół pisania.
      await bezczynnie();
      if (stan.projekt !== projekt || doOdrysowania.has(id)) continue;
      if (wTrakciePracy()) { odrysujMiniaturyWTle([id, ...kolejka.slice(kolejka.indexOf(id) + 1)]); return; }
      const obraz = await renderujCel(projekt, cel, { szerokoscPx: 200, ciag });
      if (stan.projekt !== projekt || doOdrysowania.has(id)) continue;
      stan.miniatury.set(id, obraz);
      if (projekt.strony[0]?.id === id) projekt.miniatura = obraz; // miniatura projektu na liście projektów
      odswiezMiniature(id);
    }
  }, 900);
}

// Sąsiedzi stron w rozkładówkach: Map(id strony → id strony obok). Do sprawdzenia po zmianie
// kolejności, czy element leżący przez grzbiet nie trafił obok innej strony niż ta, do której pasował.
export function sasiedziStron() {
  const ciag = rozwin(stan.projekt);
  return new Map(stan.projekt.strony.map((s) => { const obok = ciag.pierwszy.get(s.id)?.sasiad; return [s.id, (obok && !obok.pusta && obok.strona.id) || null]; }));
}

export function ostrzezOGrzbiecie(przed) {
  const { projekt } = stan;
  const ciag = rozwin(projekt);
  const zmienione = projekt.strony.filter((s) => {
    const egz = ciag.pierwszy.get(s.id);
    if (!egz?.bok || !przed.has(s.id)) return false;
    const teraz = (egz.sasiad && !egz.sasiad.pusta && egz.sasiad.strona.id) || null;
    if (teraz === przed.get(s.id)) return false;
    const { szerokosc_mm: w, spad_mm: b } = egz.sekcja.wydruk;
    // Element wystaje za grzbiet: lewa strona – za prawą krawędź, prawa – za lewą.
    return s.obiekty.some((o) => {
      const szer = (o.width || 0) * (o.scaleX ?? 1);
      return egz.bok === 'lewa' ? (o.left || 0) + szer > w + b + 0.5 : (o.left || 0) < -b - 0.5;
    });
  });
  if (zmienione.length) powiadom(t('listaStron.przechodzacePrzezGrzbietA', { x: zmienione.length === 1 ? t('listaStron.stronaMaElement', { nazwa: zmienione[0].nazwa }) : t('listaStron.stronyMajaElementy', { join: zmienione.map((s) => `„${s.nazwa}”`).join(', ') }) }), true);
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
    await zaladujCel({ nawigacja: true });
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

// Tekst płynący przez strony: nowa ramka na następnej stronie, z ciągiem dalszym zaznaczonej.
// Gdy bieżąca strona jest ostatnia w sekcji, powstaje nowa strona.
export async function ramkaNaNastepnejStronie() {
  const akt = edytor.aktywny;
  if (stan.tryb !== 'strona' || !akt || akt.type !== 'textbox' || akt.zWzorca) return;
  if (akt.isEditing) akt.exitEditing();
  zapiszBiezacyCel();
  const p = stan.projekt;
  const strona = p.strony.find((s) => s.obiekty.some((o) => o.id === akt.id));
  const zrodlo = strona?.obiekty.find((o) => o.id === akt.id);
  if (!zrodlo) return;
  if (!zrodlo.watek) Object.assign(zrodlo, { watek: uid('w'), watek_nr: 0 });
  if (!(zrodlo.ramka_h > 0)) zrodlo.ramka_h = zrodlo.height;
  delete zrodlo.autodopasowanie;
  const i = p.strony.indexOf(strona);
  let nastepna = p.strony[i + 1];
  let dodana = false;
  if (!nastepna || nastepna.sekcja !== strona.sekcja) {
    nastepna = nowaStrona(`Strona ${p.strony.length + 1}`, strona.sekcja);
    if (Array.isArray(strona.wzorce)) nastepna.wzorce = [...strona.wzorce];
    p.strony.splice(i + 1, 0, nastepna);
    dodana = true;
  }
  for (const s of p.strony) for (const o of s.obiekty) if (o.watek === zrodlo.watek && o.watek_nr > zrodlo.watek_nr) o.watek_nr += 1;
  const nowa = { ...JSON.parse(JSON.stringify(zrodlo)), id: uid('o'), text: '', styles: [], watek_nr: zrodlo.watek_nr + 1, lacznik: '\n' };
  delete nowa.lista_start; delete nowa.z;
  nastepna.obiekty.push(nowa);
  stan.miniatury.clear();
  stan.indeks = p.strony.indexOf(nastepna);
  await zaladujCel();
  edytor.przelejWatki(); // to, co nie mieściło się wcześniej, od razu płynie do nowej ramki
  edytor.zaznacz(nowa.id);
  zapiszBiezacyCel();
  renderujListe();
  zaplanujZapis();
  powiadom(dodana ? t('listaStron.dodanoStroneZRamka', { nazwa: nastepna.nazwa }) : t('listaStron.ramkaZCiagiemDalszym', { nazwa: nastepna.nazwa }));
}

// ---------- Dokładanie stron dla długiego tekstu (#212) ----------
// Tekst z „Dokładaj strony” nie mieści się w ostatniej ramce wątku (albo ma w niej akapit od nowej strony):
// za stroną ostatniej ramki dochodzą strony (w tej sekcji, z jej wzorcami) z taką samą ramką w tym samym miejscu.
// Puste strony dołożone tak na końcu wątku znikają, gdy tekstu ubędzie. Bieżąca strona zostaje ta sama.
let dokladanie = null;
export function dokladajStrony() {
  if (dokladanie) return dokladanie;
  dokladanie = dokladajTeraz().finally(() => { dokladanie = null; });
  return dokladanie;
}
async function dokladajTeraz() {
  if (stan.tryb !== 'strona' || !stan.projekt || edytor.aktywny?.isEditing) return 0;
  const p = stan.projekt;
  let dodane = 0;
  let usuniete = 0;
  const biezaca = biezacaStrona();
  for (let krok = 0; krok < 8; krok += 1) {
    const brak = edytor.przepelnioneAutoStrony();
    if (!brak.length) break;
    zapiszBiezacyCel();
    for (const { id, ile } of brak) {
      const strona = p.strony.find((s) => s.obiekty.some((o) => o.id === id));
      const zrodlo = strona?.obiekty.find((o) => o.id === id);
      if (!zrodlo) continue;
      if (!zrodlo.watek) Object.assign(zrodlo, { watek: uid('w'), watek_nr: 0 });
      let i = p.strony.indexOf(strona);
      for (let n = 1; n <= ile && p.strony.length < 2000; n += 1) {
        const nowa = nowaStrona(`Strona ${p.strony.length + 1}`, strona.sekcja);
        if (Array.isArray(strona.wzorce)) nowa.wzorce = [...strona.wzorce];
        nowa.auto_watek = zrodlo.watek;
        const ramka = { ...JSON.parse(JSON.stringify(zrodlo)), id: uid('o'), text: '', styles: [], watek_nr: (zrodlo.watek_nr || 0) + n, lacznik: '\n' };
        delete ramka.lista_start; delete ramka.z;
        nowa.obiekty = [ramka];
        p.strony.splice(i + 1, 0, nowa);
        i += 1;
        dodane += 1;
      }
    }
    stan.miniatury.clear();
    stan.indeks = Math.max(0, p.strony.indexOf(biezaca));
    await zaladujCel();
    edytor.przelejWatki();
  }
  // Puste strony dołożone na końcu wątku, gdy tekstu ubyło.
  zapiszBiezacyCel();
  for (const watek of new Set(p.strony.map((s) => s.auto_watek).filter(Boolean))) {
    for (;;) {
      const ramki = p.strony.flatMap((s) => s.obiekty.filter((o) => o.watek === watek).map((o) => ({ s, o })));
      if (ramki.length < 2) break;
      const ostatnia = ramki.reduce((a, b) => ((b.o.watek_nr || 0) > (a.o.watek_nr || 0) ? b : a));
      if (ostatnia.o.text || ostatnia.s.auto_watek !== watek || ostatnia.s.obiekty.length !== 1 || ostatnia.s === biezaca) break;
      p.strony.splice(p.strony.indexOf(ostatnia.s), 1);
      usuniete += 1;
    }
  }
  if (usuniete) {
    stan.miniatury.clear();
    stan.indeks = Math.max(0, p.strony.indexOf(biezaca));
    await zaladujCel();
  }
  if (dodane || usuniete) {
    renderujListe();
    generujMiniatury();
    zaplanujZapis();
    const netto = dodane - usuniete;
    powiadom(netto >= 0 ? t('listaStron.dodanoCalyTekstSie', { netto, x: netto === 1 ? t('listaStron.strone') : netto < 5 ? t('listaStron.strony') : t('listaStron.stron') }) : t('listaStron.usunietoPustychStronNa', { x: -netto }));
  }
  return dodane - usuniete;
}

// Przechodzi do ramki tego samego wątku na innej stronie i ją zaznacza.
export async function przejdzDoRamki(idStrony, idRamki) {
  const i = stan.projekt.strony.findIndex((s) => s.id === idStrony);
  if (i < 0) return;
  await przejdzDoStrony(i);
  edytor.zaznacz(idRamki);
}

// Pisanie w połączonym tekście doszło do ramki na innej stronie: bieżąca strona jest zapisywana, otwiera się
// strona z tą ramką i pisanie idzie dalej, z kursorem przy znaku `indeks`. Znaki wciśnięte w czasie
// wczytywania strony czekają i trafiają do nowej ramki; inne klawisze w tej chwili przepadają (nie
// uruchamiają skrótów). Zwraca false, gdy przejść się nie da – wtedy kursor zostaje, gdzie był.
let przejscieZaKursorem = false;
let ostatniaPodpowiedzWatku = 0;
export async function piszNaInnejStronie({ strona, id, indeks, wPrzod }) {
  const i = stan.projekt.strony.findIndex((s) => s.id === strona);
  const jest = i >= 0 && stan.projekt.strony[i].obiekty.some((o) => o.id === id);
  const podpowiedz = (tekst) => {
    if (Date.now() - ostatniaPodpowiedzWatku < 15000) return;
    ostatniaPodpowiedzWatku = Date.now();
    powiadom(tekst);
  };
  if (!jest || stan.tryb !== 'strona' || przejscieZaKursorem || $('dialog[open]')) {
    if (wPrzod) podpowiedz(t('listaStron.ramkaPelna', { strona: i >= 0 ? `${i + 1} („${stan.projekt.strony[i].nazwa}”)` : t('listaStron.nastepna') }));
    return false;
  }
  przejscieZaKursorem = true;
  const znaki = [];
  const lap = (e) => {
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.key.length === 1) znaki.push(e.key);
    else if (e.key === 'Enter') znaki.push('\n');
    else if (e.key === 'Backspace') znaki.pop();
  };
  window.addEventListener('keydown', lap, true);
  try {
    // Koniec pisania w dotychczasowej ramce jest zmianą (krok historii obejmie obie strony).
    const akt = edytor.aktywny;
    if (akt?.isEditing) akt.exitEditing();
    await przejdzDoStrony(i);
  } finally {
    window.removeEventListener('keydown', lap, true);
    przejscieZaKursorem = false;
  }
  if (!edytor.piszWRamce(id, indeks, znaki.join(''))) return false;
  podpowiedz(t('listaStron.tekstPlynie', { nr: i + 1, nazwa: stan.projekt.strony[i].nazwa }));
  return true;
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
  if (!await potwierdz(t('listaStron.usunacStrone', { nazwa: s.nazwa }), t('listaStron.wszystkieElementyZTej'), t('listaStron.usunStrone'), true)) return;
  zapiszBiezacyCel();
  const biezaca = biezacaStrona();
  zachowajTekstStrony(stan.projekt, s); // tekst płynący przez strony zostaje w pozostałych ramkach
  stan.projekt.strony.splice(i, 1);
  stan.miniatury.clear();
  const nowyIndeks = stan.projekt.strony.indexOf(biezaca);
  stan.indeks = nowyIndeks >= 0 ? nowyIndeks : Math.min(i, stan.projekt.strony.length - 1);
  if (stan.tryb === 'strona') await zaladujCel(); else renderujListe();
  zaplanujZapis();
  powiadom(t('listaStron.usunietoStrone', { nazwa: s.nazwa }), false, { etykieta: t('listaStron.cofnij'), fn: () => cofnijKrok(-1) });
}

// Po zmianie kolejności stron tekst płynący przez strony układa się w nowej kolejności stron.
// Zwraca true, gdy coś się zmieniło – płótno trzeba wtedy wczytać od nowa.
export async function przelejPoZmianieKolejnosci() {
  const zmienione = await uporzadkujWatkiPoStronach(stan.projekt);
  if (!zmienione.length) return false;
  stan.miniatury.clear();
  return true;
}

// Przesuwanie w obrębie sekcji (do innej sekcji – przez właściwości strony).
export async function przesunStrone(i, kierunek) {
  const strony = stan.projekt.strony;
  const j = i + kierunek;
  if (j < 0 || j >= strony.length || strony[j].sekcja !== strony[i].sekcja) return;
  zapiszBiezacyCel();
  const sasiedziPrzed = sasiedziStron();
  const biezaca = biezacaStrona();
  [strony[i], strony[j]] = [strony[j], strony[i]];
  stan.indeks = strony.indexOf(biezaca);
  for (const s of strony) if (wzorceStrony(stan.projekt, s).length) stan.miniatury.delete(s.id); // numery stron
  const przelane = await przelejPoZmianieKolejnosci();
  // W rozkładówkach zmienia się para stron i ich marginesy.
  if (przelane || sekcjaStrony(stan.projekt, strony[i]).uklad === 'rozkladowki') {
    stan.miniatury.clear();
    if (stan.tryb === 'strona') await zaladujCel();
    if (przelane) generujMiniatury();
  }
  ostrzezOGrzbiecie(sasiedziPrzed);
  renderujListe();
  zaplanujZapis();
}

export async function przeniesStroneDoSekcji(strona, idSekcji) {
  if (strona.sekcja === idSekcji) return;
  zapiszBiezacyCel();
  const sasiedziPrzed = sasiedziStron();
  strona.sekcja = idSekcji;
  // Na koniec nowej sekcji.
  const strony = stan.projekt.strony;
  strony.splice(strony.indexOf(strona), 1);
  strony.push(strona);
  uporzadkujStrony(stan.projekt);
  await przelejPoZmianieKolejnosci();
  stan.indeks = strony.indexOf(strona);
  stan.miniatury.clear();
  await zaladujCel();
  ostrzezOGrzbiecie(sasiedziPrzed);
  zaplanujZapis();
}

export async function zmienNazweStrony(i) {
  const s = stan.projekt.strony[i];
  const nazwa = await zapytajONazwe(t('listaStron.zmienNazweStrony'), t('listaStron.nazwaStrony'), s.nazwa);
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

// „Wklej … ze schowka” (#210): nieaktywne, gdy schowek nie ma tego rodzaju; z opisem, co i skąd.
function opiszWklejanie(b, rodzaje, tekst) {
  const opis = opisSchowka(rodzaje);
  b.disabled = !opis;
  b.lastChild.textContent = opis ? `${tekst}: ${opis}` : tekst;
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
  opiszWklejanie($('[data-akcja="strona-ze-schowka"]', menu), ['strony', 'sekcja'], 'Wklej strony ze schowka');
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
  opiszWklejanie($('[data-akcja="sekcja-ze-schowka"]', menu), ['sekcja'], 'Wklej sekcję ze schowka');
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
  const sasiedziPrzed = sasiedziStron();
  const biezaca = biezacaStrona();
  projekt.strony.splice(projekt.strony.indexOf(strona), 1);
  strona.sekcja = cel.sekcja;
  projekt.strony.splice(projekt.strony.indexOf(cel) + (po ? 1 : 0), 0, strona);
  uporzadkujStrony(projekt);
  await przelejPoZmianieKolejnosci();
  stan.indeks = projekt.strony.indexOf(biezaca);
  stan.miniatury.clear();
  if (stan.tryb === 'strona') await zaladujCel(); else renderujListe();
  generujMiniatury();
  ostrzezOGrzbiecie(sasiedziPrzed);
  zaplanujZapis();
}

// Szybkie przesunięcie palcem w poziomie na płótnie (#146): następna albo poprzednia strona – przy rozkładówce
// cały arkusz dalej. Na początku i końcu projektu nic się nie dzieje.
document.addEventListener('seriodruk:przewin-strone', (e) => {
  if (stan.tryb !== 'strona' || !stan.projekt) return;
  const strony = stan.projekt.strony;
  const naArkuszu = (naPlotnie?.strony || [strony[stan.indeks]?.id]).map((id) => strony.findIndex((s) => s.id === id)).filter((i) => i >= 0);
  if (!naArkuszu.length) naArkuszu.push(stan.indeks);
  const cel = e.detail?.kierunek > 0 ? Math.max(...naArkuszu) + 1 : Math.min(...naArkuszu) - 1;
  if (cel < 0 || cel >= strony.length) return;
  przejdzDoStrony(cel);
});
