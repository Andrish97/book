// Ekran „Projekty”: lista, otwieranie, kopiowanie, zmiana nazwy, eksport do pliku, usuwanie i okno nowego projektu.

import { normalizuj, kopiujProjekt, FORMATY, nowyProjekt, normalizujWydruk } from '../projekt.js';
import { listaLokalnych, wczytajLokalnie, zapiszLokalnie, oznaczZsynchronizowany, usunLokalnie } from '../lokalny.js';
import * as chmura from '../chmura.js';
import { ikona } from '../ikony.js';
import { zapiszPlikProjektu, ROZSZERZENIE, wczytajPlikProjektu as odczytajPlik } from '../plik-projektu.js';
import { powiadom, $, kiedy, przelaczMenu, zamknijMenu, zapytajONazwe, pobierz, bezpiecznaNazwa, potwierdz } from '../ui.js';
import { NAZWA } from '../marka.js';
import { domyslneStyle } from '../style-tekstu.js';
import { wlasciciel, stan, pokazEkran, trasa } from './kontekst.js';
import { otworzProjekt, zapiszTeraz } from './zapis.js';
import { otworzUdostepnianie } from './podglad-ekran.js';
import { przejdzDoTrasy } from './trasy.js';

function odmianaProjektow(n) {
  if (n === 1) return 'projekt';
  const j = n % 10; const d = n % 100;
  return j >= 2 && j <= 4 && (d < 10 || d >= 20) ? 'projekty' : 'projektów';
}

// ======================================================================
// Lista projektów
// ======================================================================

const najnowsza = (w) => [w.zmieniono, w.wChmurze].filter(Boolean).sort().at(-1) || '';

export async function wpisyProjektow() {
  const wpisy = new Map();
  for (const l of await listaLokalnych(wlasciciel())) wpisy.set(l.id, { ...l, lokalnie: true });
  if (stan.uzytkownik) {
    try {
      for (const c of await chmura.listaWChmurze()) {
        const w = wpisy.get(c.id) || { id: c.id, nazwa: c.nazwa, miniatura: c.miniatura };
        w.wChmurze = c.zmieniono;
        if (!w.lokalnie || !w.doSynchronizacji) w.udostepniony = Boolean(c.udostepnienie);
        if (!w.lokalnie || (!w.doSynchronizacji && c.zmieniono > (w.zmieniono || ''))) {
          w.nazwa = c.nazwa;
          w.miniatura = c.miniatura || w.miniatura;
        }
        wpisy.set(c.id, w);
      }
    } catch (e) {
      powiadom(`Nie udało się pobrać listy z konta: ${chmura.komunikatBledu(e)}`, true);
    }
  }
  return [...wpisy.values()].sort((a, b) => najnowsza(b).localeCompare(najnowsza(a)));
}

export async function pokazProjekty() {
  pokazEkran('projekty');
  trasa.ustaw('projekty');
  const siatka = $('#siatka-projektow');
  siatka.innerHTML = '<li class="karta-projektu szkielet"><div class="okladka"></div><div class="opis"><strong>&nbsp;</strong><small>&nbsp;</small></div></li>'.repeat(3);
  $('#pusto-projekty').hidden = true;
  const wpisy = await wpisyProjektow();
  siatka.replaceChildren();
  $('#pusto-projekty').hidden = wpisy.length > 0;
  $('.projekty-naglowek .przyciski-naglowka').hidden = wpisy.length === 0;
  $('#podsumowanie-projektow').textContent = wpisy.length ? `${wpisy.length} ${odmianaProjektow(wpisy.length)}` : '';

  for (const w of wpisy) {
    const li = document.createElement('li');
    li.className = 'karta-projektu';
    li.innerHTML = `
      <button class="otworz-projekt">
        <div class="okladka">${w.miniatura ? '<img alt="">' : '<div class="pusta-okladka"></div>'}</div>
        <div class="opis"><strong></strong><small></small></div>
      </button>
      ${w.udostepniony ? `<button class="plakietka-linku" title="Projekt ma link do podglądu – kliknij, żeby go skopiować albo unieważnić">${ikona('link', { rozmiar: 14 })}Udostępniony</button>` : ''}
      <button class="przycisk-ikona menu-karty" aria-label="Opcje projektu" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej')}</button>
      <div class="menu" role="menu" hidden>
        <button role="menuitem" data-op="podglad">${ikona('oko')}Podgląd</button>
        <button role="menuitem" data-op="nazwa">${ikona('tekst')}Zmień nazwę</button>
        <button role="menuitem" data-op="duplikuj">${ikona('kopiuj')}Duplikuj</button>
        <button role="menuitem" data-op="eksport">${ikona('pobierz')}Eksportuj do pliku (.seriodruk)</button>
        <hr>
        <button role="menuitem" data-op="usun" class="niebezpieczny">${ikona('kosz')}Usuń projekt</button>
      </div>`;
    if (w.miniatura) $('img', li).src = w.miniatura;
    $('strong', li).textContent = w.nazwa || 'Bez nazwy';
    const niewyslany = stan.uzytkownik && w.lokalnie && w.doSynchronizacji;
    $('small', li).textContent = `Zmieniono ${kiedy(najnowsza(w))}${niewyslany ? ' · czeka na wysłanie' : ''}`;
    $('.otworz-projekt', li).addEventListener('click', () => otworzZListy(w));
    $('.plakietka-linku', li)?.addEventListener('click', async () => {
      try { otworzUdostepnianie(await wczytajProjektZWpisu(w)); } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
    });
    const menu = $('.menu', li);
    $('.menu-karty', li).addEventListener('click', (e) => przelaczMenu(e.currentTarget, menu));
    menu.addEventListener('click', async (e) => {
      const op = e.target.closest('[data-op]')?.dataset.op;
      if (!op) return;
      zamknijMenu();
      if (op === 'podglad') { trasa.ustaw(`p/${w.id}/podglad`); await przejdzDoTrasy(); }
      if (op === 'nazwa') await zmienNazweProjektu(w);
      if (op === 'duplikuj') await duplikujProjekt(w);
      if (op === 'eksport') await eksportujProjekt(w);
      if (op === 'usun') await usunProjekt(w);
    });
    siatka.append(li);
  }
}

export async function wczytajProjektZWpisu(w) {
  const lokalny = w.lokalnie ? (await wczytajLokalnie(w.id))?.projekt : null;
  // Nowsza wersja wygrywa; niewysłane zmiany lokalne mają pierwszeństwo.
  const chmuraNowsza = w.wChmurze && (!lokalny || (!w.doSynchronizacji && w.wChmurze > (lokalny.zmieniono || '')));
  if (!chmuraNowsza) return lokalny;
  const projekt = normalizuj(await chmura.wczytajZChmury(w.id));
  await zapiszLokalnie(projekt, wlasciciel(), false);
  return projekt;
}

async function otworzZListy(w) {
  try {
    const projekt = await wczytajProjektZWpisu(w);
    if (!projekt) throw new Error('Nie znaleziono projektu.');
    await otworzProjekt(projekt);
  } catch (e) {
    powiadom(`Nie udało się otworzyć projektu: ${chmura.komunikatBledu(e)}`, true);
  }
}

export async function zapiszGdziekolwiek(projekt) {
  await zapiszLokalnie(projekt, wlasciciel(), Boolean(stan.uzytkownik));
  if (!stan.uzytkownik) return;
  try {
    await chmura.zapiszWChmurze(projekt);
    await oznaczZsynchronizowany(projekt.id, projekt.zmieniono);
  } catch (e) {
    powiadom(chmura.komunikatBledu(e), true);
  }
}

async function duplikujProjekt(w) {
  try {
    const zrodlo = await wczytajProjektZWpisu(w);
    const kopia = kopiujProjekt(zrodlo, `${zrodlo.nazwa} (kopia)`);
    await zapiszGdziekolwiek(kopia);
    powiadom(`Utworzono „${kopia.nazwa}”.`);
  } catch (e) {
    powiadom(`Nie udało się zduplikować: ${chmura.komunikatBledu(e)}`, true);
  }
  pokazProjekty();
}

async function zmienNazweProjektu(w) {
  const nazwa = await zapytajONazwe('Zmień nazwę projektu', 'Nazwa', w.nazwa || '');
  if (!nazwa) return;
  const projekt = await wczytajProjektZWpisu(w);
  projekt.nazwa = nazwa;
  projekt.zmieniono = new Date().toISOString();
  await zapiszGdziekolwiek(projekt);
  pokazProjekty();
}

// Eksport całego projektu do pliku .seriodruk (z obrazami) – kopia zapasowa
// albo przeniesienie na inne konto.
async function eksportujProjekt(w) {
  try {
    const projekt = await wczytajProjektZWpisu(w);
    powiadom('Przygotowuję plik…');
    const blob = await zapiszPlikProjektu(projekt);
    const url = URL.createObjectURL(blob);
    pobierz(`${bezpiecznaNazwa(projekt.nazwa)}${ROZSZERZENIE}`, url);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    powiadom(`Zapisano „${projekt.nazwa}${ROZSZERZENIE}”.`);
  } catch (e) {
    powiadom(`Nie udało się wyeksportować: ${e.message}`, true);
  }
}

async function usunProjekt(w) {
  const ok = await potwierdz(
    `Usunąć „${w.nazwa || 'Bez nazwy'}”?`,
    'Projekt zniknie ze wszystkich Twoich urządzeń. Tego nie można cofnąć.',
    'Usuń projekt',
    true,
  );
  if (!ok) return false;
  try {
    await usunLokalnie(w.id);
    if (stan.uzytkownik) await chmura.usunZChmury(w.id);
    powiadom('Projekt usunięty.');
  } catch (e) {
    powiadom(`Nie udało się usunąć: ${chmura.komunikatBledu(e)}`, true);
  }
  if (document.body.dataset.ekran === 'projekty') pokazProjekty();
  return true;
}

// ---------- Nowy projekt ----------

const FORMATY_KART = [...Object.entries(FORMATY), ['Własny', null]];

export function otworzNowyProjekt() {
  const dlg = $('#dlg-nowy');
  const f = $('#form-nowy');
  f.reset();
  const karty = $('#karty-formatu');
  karty.replaceChildren();
  for (const [nazwa, wym] of FORMATY_KART) {
    const label = document.createElement('label');
    label.className = 'karta-formatu';
    const [w, h] = wym || [120, 120];
    const skala = 60 / 297;
    label.innerHTML = `<input type="radio" name="format" value="${nazwa}"${nazwa === 'A5' ? ' checked' : ''}>
      <span><i style="width:${Math.round(w * skala)}px;height:${Math.round(h * skala)}px${wym ? '' : ';border-style:dashed'}"></i>
      <b>${nazwa}</b>${wym ? `${w}×${h}` : 'dowolny'}</span>`;
    karty.append(label);
  }
  f.elements.szerokosc_mm.value = 148;
  f.elements.wysokosc_mm.value = 210;
  $('#wlasny-format').hidden = true;
  dlg.returnValue = '';
  dlg.showModal();
  f.elements.nazwa.focus();
}

$('#form-nowy').addEventListener('change', (e) => {
  if (e.target.name === 'format') $('#wlasny-format').hidden = e.target.value !== 'Własny';
});

$('#dlg-nowy').addEventListener('close', async () => {
  if ($('#dlg-nowy').returnValue !== 'ok') return;
  const f = $('#form-nowy');
  const format = f.elements.format.value;
  let [w, h] = FORMATY[format] || [Number(f.elements.szerokosc_mm.value) || 148, Number(f.elements.wysokosc_mm.value) || 210];
  if (f.elements.orientacja.value === 'poziom' && h > w) [w, h] = [h, w];
  if (f.elements.orientacja.value === 'pion' && w > h) [w, h] = [h, w];
  const projekt = nowyProjekt(f.elements.nazwa.value.trim() || 'Nowy projekt', normalizujWydruk({
    format: FORMATY[format] ? format : 'wlasny',
    szerokosc_mm: Math.max(20, w),
    wysokosc_mm: Math.max(20, h),
    spad_mm: Math.max(0, Number(f.elements.spad_mm.value) || 0),
    marginesy_mm: Math.max(0, Number(f.elements.marginesy_mm.value) || 0),
    znaki_ciecia: true,
  }), f.elements.uklad.value === 'rozkladowki' ? 'rozkladowki' : 'pojedyncze');
  projekt.style = domyslneStyle();
  await otworzProjekt(projekt);
  await zapiszTeraz();
});

export async function doProjektow() {
  if (stan.projekt) await zapiszTeraz();
  stan.projekt = null;
  document.title = NAZWA;
  pokazProjekty();
}

// ---------- Pliki ----------

export async function wczytajPlikProjektu(plik) {
  try {
    const projekt = normalizuj(await odczytajPlik(plik));
    const istniejacy = await wczytajLokalnie(projekt.id);
    if (istniejacy) {
      const zastap = await potwierdz(
        'Ten projekt już istnieje',
        `„${istniejacy.nazwa}” jest już na liście. Zastąpić go wersją z pliku? „Anuluj” doda plik jako osobny projekt.`,
        'Zastąp',
      );
      if (!zastap) projekt.id = crypto.randomUUID();
    }
    if (stan.projekt) await zapiszTeraz();
    await otworzProjekt(projekt);
    await zapiszTeraz();
    powiadom(`Wczytano „${projekt.nazwa}”.`);
  } catch (e) {
    powiadom(`Nie udało się wczytać pliku: ${e.message}`, true);
  }
}

// Pliki .seriodruk otwierane z systemu (zainstalowana aplikacja na komputerze).
// Wczytujemy je dopiero po zalogowaniu.
export const plikiDoOtwarcia = [];
export async function otworzOczekujacePliki() {
  while (plikiDoOtwarcia.length) await wczytajPlikProjektu(plikiDoOtwarcia.shift());
}
