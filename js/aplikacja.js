/* global fabric */
// Główny plik aplikacji: ekrany (logowanie → projekty → edytor), zapis, dialogi.

import {
  FORMATY, nowyProjekt, nowaStrona, nowaSekcja, nowyWzorzec, normalizuj, normalizujWydruk,
  kopiujStrone, kopiujWzorzec, kopiujProjekt,
  uporzadkujStrony, sekcjaStrony, stronySekcji, wzorceStrony, stronyZWzorcem, tloStrony,
  marginesyStrony, marginesyWzorca, uid,
  WZORCE_Z_SEKCJI,
} from './projekt.js';
import { Edytor, opisObiektu } from './edytor.js';
import { warstwyWzorcow, renderujCel } from './zlozenie.js';
import { rozwin, arkuszStrony, bokStrony, blokiSerii, liczbaPowielen, tabelaSerii } from './serie.js';
import { POLA_DOKUMENTU } from './pola.js';
import { MenuWidoku } from './widok.js';
import { obsluzKlawisz } from './skroty.js';
import { Linijki } from './linijki.js';
import { Dane } from './dane.js';
import { PanelWarstw } from './warstwy.js';
import { PanelWlasciwosci } from './wlasciwosci.js';
import { zaladujCzcionki } from './czcionki.js';
import {
  zapiszLokalnie, wczytajLokalnie, listaLokalnych, usunLokalnie, usunLokalneWlasciciela, oznaczZsynchronizowany,
} from './lokalny.js';
import * as chmura from './chmura.js';
import { ikona, wstawIkony } from './ikony.js';
import { Instrukcja } from './instrukcja.js';
import { zapiszPlikProjektu, wczytajPlikProjektu as odczytajPlik, ROZSZERZENIE } from './plik-projektu.js';
import {
  $, $$, powiadom, potwierdz, zapytajONazwe, zamknijMenu, przelaczMenu, pobierz, bezpiecznaNazwa, kiedy,
} from './ui.js';
import { NAZWA } from './marka.js';
import { Konto } from './konto.js';
import { Podglad, ukladProjektu, stronyUkladu } from './podglad.js';
import { przelaczMotyw } from './motyw.js';
import { domyslneStyle, zastosujStylWProjekcie, odepnijStyl } from './style-tekstu.js';


const OPIS_OSTRZEZEN = {
  poza_strona: 'Poza stroną – nie będzie widoczny w druku.',
  poza_spadem: 'Wychodzi poza spad – część zostanie ucięta.',
  w_marginesie: 'Wchodzi w margines – może zostać przycięty.',
  nieznane_pole: 'Pole w klamrach nie pasuje do kolumny tabeli tej strony ani do pola dokumentu.',
  nie_miesci_sie: 'Tekst nie mieści się w ramce – dół zostanie ucięty.',
};

const stan = {
  uzytkownik: null,
  trybLokalny: false,
  projekt: null,
  indeks: 0, // bieżąca strona
  tryb: 'strona', // 'strona' | 'wzorzec'
  idWzorca: null,
  zakladka: 'strony',
  miniatury: new Map(), // id strony -> dataUrl
  timerZapisu: null,
  timerChmury: null,
  konflikt: null, // id projektu czekającego na decyzję po konflikcie zapisu
  zapisywanie: Promise.resolve(),
  czcionki: null,
};

// Klucz właściciela projektów w IndexedDB.
const wlasciciel = () => stan.uzytkownik?.id || 'lokalny';

const instrukcja = new Instrukcja();

// ======================================================================
// Pomocnicze: ekrany, powiadomienia, dialogi, menu
// ======================================================================

function pokazEkran(nazwa) {
  document.body.dataset.ekran = nazwa;
  document.body.dataset.panel = '';
  zamknijMenu();
}

function odmianaProjektow(n) {
  if (n === 1) return 'projekt';
  const j = n % 10; const d = n % 100;
  return j >= 2 && j <= 4 && (d < 10 || d >= 20) ? 'projekty' : 'projektów';
}

// ======================================================================
// Adresy podstron (routing w części # adresu – działa na GitHub Pages)
// ======================================================================
//
//   #/projekty                       lista projektów
//   #/konto                          ustawienia konta
//   #/p/<id projektu>                projekt (pierwsza strona)
//   #/p/<id projektu>/s/<id strony>  konkretna strona
//   #/p/<id projektu>/w/<id wzorca>  edycja wzorca
//   #/p/<id projektu>/podglad        podgląd bez edycji
//   #/u/<konto>/<projekt>/<kod>      podgląd udostępniony linkiem (bez logowania)

const trasa = {
  odczytaj() {
    const [rodzaj, id, typ, cel] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (rodzaj === 'p' && id) {
      return {
        ekran: 'projekt', id, strona: typ === 's' ? cel : null, wzorzec: typ === 'w' ? cel : null, podglad: typ === 'podglad',
      };
    }
    if (rodzaj === 'konto') return { ekran: 'konto' };
    if (rodzaj === 'u' && id && typ && cel) return { ekran: 'udostepnione', konto: id, projekt: typ, kod: cel };
    return { ekran: 'projekty' };
  },
  // Zmiana ekranu dodaje wpis do historii (działa „Wstecz”), zmiana strony
  // w projekcie tylko podmienia adres.
  ustaw(sciezka, { zastap = false } = {}) {
    const nowy = `#/${sciezka}`;
    if (location.hash === nowy) return;
    history[zastap ? 'replaceState' : 'pushState'](null, '', nowy);
  },
};

let obslugaTrasy = Promise.resolve();
function przejdzDoTrasy() {
  obslugaTrasy = obslugaTrasy.then(async () => {
    const t = trasa.odczytaj();
    if (t.ekran === 'udostepnione') { await pokazUdostepniony(t); return; }
    if (document.body.classList.contains('podglad-publiczny')) { location.reload(); return; }
    if (!stan.uzytkownik && !stan.trybLokalny) return;
    if (t.ekran === 'konto' && stan.uzytkownik) {
      if (stan.projekt) { await zapiszTeraz(); stan.projekt = null; }
      pokazEkran('konto');
      konto.pokazUstawienia();
      return;
    }
    if (t.ekran === 'projekty' || t.ekran === 'konto') {
      if (stan.projekt) await doProjektow(); else if (document.body.dataset.ekran !== 'projekty') await pokazProjekty();
      return;
    }
    if (stan.projekt?.id === t.id) {
      if (t.podglad) { await pokazPodglad(); return; }
      if (document.body.dataset.ekran === 'podglad') { pokazEkran('edytor'); edytor.canvas.calcOffset(); }
      if (t.wzorzec && (stan.tryb !== 'wzorzec' || stan.idWzorca !== t.wzorzec)) await edytujWzorzec(t.wzorzec);
      else if (t.strona) {
        const i = stan.projekt.strony.findIndex((x) => x.id === t.strona);
        if (i >= 0 && (stan.tryb !== 'strona' || i !== stan.indeks)) await przejdzDoStrony(i);
      }
      return;
    }
    if (stan.projekt) await zapiszTeraz();
    const wpis = (await wpisyProjektow()).find((w) => w.id === t.id);
    const projekt = wpis && await wczytajProjektZWpisu(wpis).catch(() => null);
    if (!projekt) {
      powiadom('Nie znaleziono projektu z tego adresu – może został usunięty.', true);
      trasa.ustaw('projekty', { zastap: true });
      stan.projekt = null;
      await pokazProjekty();
      return;
    }
    await otworzProjekt(projekt, { strona: t.strona, wzorzec: t.wzorzec });
    if (t.podglad) await pokazPodglad();
  }).catch((e) => console.error(e));
  return obslugaTrasy;
}

window.addEventListener('popstate', () => przejdzDoTrasy());

// ======================================================================
// Logowanie
// ======================================================================

const konto = new Konto({
  stan,
  poZalogowaniu: (u) => poZalogowaniu(u),
  trybLokalny: () => { stan.trybLokalny = true; return poZalogowaniu(null); },
  wyloguj: (wszedzie) => wyloguj(wszedzie),
  odswiezNaglowek: () => odswiezNaglowek(),
  liczbaProjektow: async () => (await wpisyProjektow()).length,
  usunDaneLokalne: (id) => usunLokalneWlasciciela(id),
  poUsunieciuKonta: async () => {
    stan.uzytkownik = null;
    stan.projekt = null;
    trasa.ustaw('projekty', { zastap: true });
    konto.ustawTryb('logowanie');
    pokazEkran('logowanie');
    powiadom('Konto i wszystkie dane zostały usunięte.');
  },
});

function odswiezNaglowek() {
  const u = stan.uzytkownik;
  const nazwa = u ? chmura.nazwaUzytkownika(u) : '';
  $('#awatar').textContent = (nazwa || '?')[0].toUpperCase();
  $('#awatar').title = u ? `Konto: ${nazwa}` : 'Tryb bez konta';
  $('#nazwa-uzytkownika').textContent = u ? nazwa : 'Tryb bez konta';
  $('#email-uzytkownika').textContent = u ? u.email : 'Projekty tylko w tej przeglądarce';
  $('#pozycja-konto').hidden = !u;
  $('[data-akcja="wyloguj"]').lastChild.textContent = u ? 'Wyloguj' : 'Przejdź do logowania';
}

async function poZalogowaniu(uzytkownik) {
  stan.uzytkownik = uzytkownik;
  odswiezNaglowek();
  await przejdzDoTrasy();
  if (document.body.dataset.ekran === 'start' || document.body.dataset.ekran === 'logowanie') await pokazProjekty();
  if (plikiDoOtwarcia.length) await otworzOczekujacePliki();
  else instrukcja.otworzJesliNowa(uzytkownik?.id || 'lokalny');
}

async function wyloguj(wszedzie = false) {
  zamknijMenu();
  if (stan.projekt) await zapiszTeraz();
  stan.projekt = null;
  if (stan.uzytkownik) {
    try { await chmura.wyloguj(wszedzie); } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
  }
  stan.uzytkownik = null;
  stan.trybLokalny = false;
  konto.ustawTryb('logowanie');
  trasa.ustaw('projekty', { zastap: true });
  pokazEkran('logowanie');
}

// ======================================================================
// Lista projektów
// ======================================================================

const najnowsza = (w) => [w.zmieniono, w.wChmurze].filter(Boolean).sort().at(-1) || '';

async function wpisyProjektow() {
  const wpisy = new Map();
  for (const l of await listaLokalnych(wlasciciel())) wpisy.set(l.id, { ...l, lokalnie: true });
  if (stan.uzytkownik) {
    try {
      for (const c of await chmura.listaWChmurze()) {
        const w = wpisy.get(c.id) || { id: c.id, nazwa: c.nazwa, miniatura: c.miniatura };
        w.wChmurze = c.zmieniono;
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

async function pokazProjekty() {
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

async function wczytajProjektZWpisu(w) {
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

async function zapiszGdziekolwiek(projekt) {
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

function otworzNowyProjekt() {
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

// ======================================================================
// Edytor
// ======================================================================
//
// Edytowany „cel” to strona albo wzorzec (stan.tryb). Strona ma format swojej
// sekcji i pod spodem elementy wzorca; wzorzec ma własny rozmiar.

const edytor = new Edytor($('#plotno'), $('#kontener-plotna'));
const panel = new PanelWlasciwosci($('#wlasciwosci'), $('#tytul-wlasciwosci'), edytor, {
  tytulPusty: () => (stan.tryb === 'wzorzec' ? 'Wzorzec' : 'Strona'),
  budujPusty: (p) => (stan.tryb === 'wzorzec' ? panelWzorca(p) : panelStrony(p)),
  // Dodatkowe ustawienia elementu zależne od tego, co edytujemy.
  dodatkiElementu: (p, obj, sekcja) => {
    if (stan.tryb !== 'wzorzec') return;
    sekcja.append(p.przelacznik('Nad treścią strony (domyślnie pod)', () => obj.warstwa === 'nad', (v) => { obj.warstwa = v ? 'nad' : undefined; }));
  },
  style: () => stan.projekt?.style || [],
  pola: () => polaDoWstawienia(),
  kolumnyObrazu: () => (stan.tryb === 'strona' ? tabelaStrony(biezacaStrona())?.kolumny : stan.projekt.tabele.flatMap((t) => t.kolumny)) || [],
  wgrajObrazy: () => $('#pliki-zasoby').click(),
  poZmianieStyli: (zmiana) => poZmianieStyli(zmiana),
});

// zmiana: null (styl tylko przypisany), styl (zaktualizowany – przepisz do
// wszystkich tekstów projektu) albo { usuniety: id }.
async function poZmianieStyli(zmiana) {
  const { projekt } = stan;
  if (!zmiana) { edytor.zatwierdz(); panel.odswiez(); return; }
  const zaznaczony = edytor.aktywny?.id;
  zapiszBiezacyCel();
  if (zmiana.usuniety) odepnijStyl(projekt, zmiana.usuniety);
  else {
    const n = zastosujStylWProjekcie(projekt, zmiana);
    powiadom(`Styl „${zmiana.nazwa}” zaktualizowany${n > 1 ? ` – zmieniono ${n} teksty w projekcie` : ''}.`);
  }
  stan.miniatury.clear();
  await zaladujCel();
  if (zaznaczony) edytor.zaznacz(zaznaczony);
  zaplanujZapis();
}

const biezacaStrona = () => stan.projekt.strony[stan.indeks];
const biezacyWzorzec = () => stan.projekt.wzorce.find((w) => w.id === stan.idWzorca);
const biezacyCel = () => (stan.tryb === 'wzorzec' ? biezacyWzorzec() : biezacaStrona());
const biezacaSekcja = () => sekcjaStrony(stan.projekt, biezacaStrona());

function wydrukCelu() {
  return stan.tryb === 'wzorzec' ? biezacyWzorzec().wydruk : biezacaSekcja().wydruk;
}

const liczba = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

function opisMarginesow(wydruk, rozkladowki) {
  const m = wydruk.marginesy;
  if (m.gora === m.dol && m.dol === m.wewnetrzny && m.wewnetrzny === m.zewnetrzny) return `marginesy ${liczba(m.gora)} mm`;
  const [a, b] = rozkladowki ? ['wewn.', 'zewn.'] : ['lewy', 'prawy'];
  return `marginesy: góra ${liczba(m.gora)}, dół ${liczba(m.dol)}, ${a} ${liczba(m.wewnetrzny)}, ${b} ${liczba(m.zewnetrzny)} mm`;
}

function nazwaFormatu(w, pelny = false, rozkladowki = false) {
  const standard = Boolean(FORMATY[w.format]);
  const orient = standard && w.szerokosc_mm > w.wysokosc_mm ? ' poziomo' : '';
  if (!pelny) return standard ? `${w.format}${orient}` : `${liczba(w.szerokosc_mm)}×${liczba(w.wysokosc_mm)} mm`;
  return `${standard ? `${w.format}${orient}` : 'Format własny'} – ${liczba(w.szerokosc_mm)} × ${liczba(w.wysokosc_mm)} mm, spad ${liczba(w.spad_mm)} mm, ${opisMarginesow(w, rozkladowki)}.`;
}

const tenSamRozmiar = (a, b) => a.szerokosc_mm === b.szerokosc_mm && a.wysokosc_mm === b.wysokosc_mm;
const kolor = (k) => String(k || '').toLowerCase();

function odswiezPasekEdytora() {
  const wz = stan.tryb === 'wzorzec';
  document.body.classList.toggle('tryb-wzorca', wz);
  $('#pasek-wzorca').hidden = !wz;
  if (wz) {
    const w = biezacyWzorzec();
    const n = stronyZWzorcem(stan.projekt, w.id).length;
    $('#pasek-wzorca-tekst').textContent = `Edytujesz wzorzec „${w.nazwa}” · ${n ? `widoczny na ${n} ${n === 1 ? 'stronie' : 'stronach'}` : 'nieużywany'}`;
    $('#opis-formatu').textContent = `Wzorzec · ${liczba(w.wydruk.szerokosc_mm)}×${liczba(w.wydruk.wysokosc_mm)}`;
  } else {
    const sek = biezacaSekcja();
    const bok = bokStrony(biezacaStrona(), rozwin(stan.projekt));
    $('#opis-formatu').textContent = `${sek.nazwa} · ${nazwaFormatu(sek.wydruk)}${bok ? ` · ${bok}` : ''}`;
  }
  $('#przycisk-format').disabled = wz;
}

// ---------- Arkusz: strona albo cała rozkładówka na jednym płótnie ----------

// Co jest teraz wczytane do edytora: { wzorzec: id } albo { strony: [id, …] }
// (rozkładówka: lewa, prawa). null w trakcie wczytywania – wtedy płótna nie
// wolno przepisywać do projektu.
let naPlotnie = null;

// Wczytuje bieżący cel do edytora; dopasowuje widok, gdy zmienił się rozmiar.
async function zaladujCel({ dopasuj = false } = {}) {
  const { projekt } = stan;
  const wydruk = wydrukCelu();
  const cel = biezacyCel();
  const poprzedni = edytor.wydruk;
  const bylaRozkladowka = poprzedni ? edytor.rozkladowka : null;
  const innyRozmiar = !poprzedni || ['szerokosc_mm', 'wysokosc_mm', 'spad_mm'].some((k) => poprzedni[k] !== wydruk[k]);
  naPlotnie = null;
  if (stan.tryb === 'wzorzec') {
    edytor.ustawWydruk(wydruk, marginesyWzorca(cel));
    await edytor.wczytajStrone({ id: cel.id, obiekty: cel.obiekty, tlo: cel.tlo || '#ffffff', prowadnice: cel.prowadnice }, projekt.zasoby, null);
    naPlotnie = { wzorzec: cel.id };
  } else {
    const ciag = rozwin(projekt);
    const strony = arkuszStrony(cel, ciag);
    const dane = [];
    for (const s of strony) {
      dane.push({ id: s.id, obiekty: s.obiekty, tlo: tloStrony(projekt, s), prowadnice: s.prowadnice, warstwy: await warstwyWzorcow(projekt, s, ciag) });
    }
    edytor.ustawWydruk(wydruk, strony.map((s) => marginesyStrony(projekt, s, bokStrony(s, ciag))));
    edytor.ustawAktywna(strony.indexOf(cel));
    await edytor.wczytajArkusz(dane, projekt.zasoby);
    naPlotnie = { strony: strony.map((s) => s.id) };
  }
  edytor.przeliczOstrzezenia(); // które pola są znane, wiadomo dopiero po wczytaniu
  edytor.ustawWidok(projekt.widok);
  linijki.ustaw(projekt.widok.linijki);
  panelWarstw.odswiez();
  if (dopasuj || innyRozmiar || bylaRozkladowka !== edytor.rozkladowka) edytor.dopasujDoOkna();
  odswiezPasekEdytora();
  renderujListe();
  trasa.ustaw(`p/${projekt.id}/${stan.tryb === 'wzorzec' ? `w/${cel.id}` : `s/${cel.id}`}`, { zastap: true });
}

// ---------- Pola: co można wstawić i co jest znane na otwartej stronie ----------

const NAZWY_POL_DOKUMENTU = new Set(POLA_DOKUMENTU.map(([nazwa]) => nazwa));

// Tabela, z której strona bierze dane (przez swoją serię), albo null.
function tabelaStrony(strona) {
  const seria = stan.projekt.serie.find((s) => s.id === strona?.seria);
  return seria ? tabelaSerii(stan.projekt, seria) : null;
}

// Grupy do listy „Wstaw pole”: najpierw tabela bieżącej strony, potem pozostałe, na końcu pola dokumentu.
function polaDoWstawienia() {
  const { projekt } = stan;
  const wlasna = stan.tryb === 'strona' ? tabelaStrony(biezacaStrona()) : null;
  const tabele = [...projekt.tabele].sort((a, b) => (b === wlasna) - (a === wlasna));
  return [
    ...tabele.map((t) => ({ grupa: t === wlasna ? `Tabela tej strony: ${t.nazwa}` : `Tabela: ${t.nazwa}`, pola: t.kolumny.map((k) => [k, '']) })),
    { grupa: 'Pola dokumentu', pola: POLA_DOKUMENTU },
  ];
}

// Pole jest znane, gdy to pole dokumentu albo kolumna tabeli strony, na której
// leży tekst. We wzorcu znana jest kolumna dowolnej tabeli – wzorzec trafia na różne strony.
edytor.znanePole = (nazwa, indeksStrony) => {
  if (NAZWY_POL_DOKUMENTU.has(nazwa) || !stan.projekt) return true;
  if (naPlotnie?.wzorzec) return stan.projekt.tabele.some((t) => t.kolumny.includes(nazwa));
  const strona = stan.projekt.strony.find((s) => s.id === naPlotnie?.strony?.[indeksStrony]);
  return Boolean(tabelaStrony(strona)?.kolumny.includes(nazwa));
};

// Siatka, przyciąganie, linijki – ustawienia projektu zmieniane z menu przy płótnie.
const linijki = new Linijki(edytor, $('#obszar-roboczy'));
const panelWarstw = new PanelWarstw($('#lista-warstw'), edytor);
const menuWidoku = new MenuWidoku({
  widok: () => stan.projekt?.widok,
  poZmianie: (widok) => { edytor.ustawWidok(widok); linijki.ustaw(widok.linijki); zaplanujZapis(); },
});

// Dane: tabele i serie. Po zmianie danych strony trzeba narysować od nowa.
const dane = new Dane({
  projekt: () => stan.projekt,
  // Okna danych zmieniają projekt bezpośrednio (np. nazwę pola we wszystkich
  // tekstach), więc płótno najpierw oddaje swoją treść i zostaje odłączone –
  // inaczej automatyczny zapis nadpisałby te zmiany starą treścią płótna.
  przedOtwarciem: () => { zapiszBiezacyCel(); naPlotnie = null; },
  poZmianie: () => { stan.miniatury.clear(); zaplanujZapis(); },
  poZamknieciu: async () => {
    if (!stan.projekt) return;
    await zaladujCel();
    panel.zbuduj();
    generujMiniatury();
  },
});

// Druga strona tej samej rozkładówki staje się bieżącą – bez wczytywania od nowa.
function wybierzStroneArkusza(k) {
  const id = naPlotnie?.strony?.[k];
  const i = stan.projekt.strony.findIndex((s) => s.id === id);
  if (i < 0 || (stan.tryb === 'strona' && i === stan.indeks)) return;
  stan.indeks = i;
  edytor.ustawAktywna(k);
  odswiezPasekEdytora();
  renderujListe();
  trasa.ustaw(`p/${stan.projekt.id}/s/${id}`, { zastap: true });
  if (!edytor.aktywny) panel.zbuduj();
}

function stanZapisu(rodzaj, tekst) {
  const el = $('#stan-zapisu');
  const ik = { ok: stan.uzytkownik ? 'chmuraOk' : 'chmura', zapis: 'chmura', offline: 'chmuraOff', blad: 'uwaga' }[rodzaj];
  el.className = `stan-zapisu${rodzaj === 'zapis' ? ' zapisuje' : ''}${rodzaj === 'blad' ? ' blad' : ''}`;
  el.innerHTML = `${ikona(ik, { rozmiar: 16 })}<span class="tekst"></span>`;
  $('.tekst', el).textContent = tekst;
  el.title = tekst;
}

// cel: { strona: id, wzorzec: id } – opcjonalnie, np. z adresu strony.
async function otworzProjekt(p, cel = {}) {
  await stan.czcionki;
  naPlotnie = null;
  stan.projekt = normalizuj(p);
  stan.indeks = Math.max(0, stan.projekt.strony.findIndex((x) => x.id === cel.strona));
  const wzorzec = cel.wzorzec && stan.projekt.wzorce.find((w) => w.id === cel.wzorzec);
  stan.tryb = wzorzec ? 'wzorzec' : 'strona';
  stan.idWzorca = wzorzec ? wzorzec.id : null;
  stan.miniatury.clear();
  ustawZakladke(wzorzec ? 'wzorce' : 'strony');
  pokazEkran('edytor');
  if (trasa.odczytaj().id !== stan.projekt.id) trasa.ustaw(`p/${stan.projekt.id}`);
  $('#nazwa-projektu').value = stan.projekt.nazwa;
  document.title = `${stan.projekt.nazwa} – ${NAZWA}`;
  edytor.wydruk = null;
  await zaladujCel({ dopasuj: true });
  stanZapisu('ok', stan.uzytkownik ? 'Zapisano' : 'Zapisano w przeglądarce');
  generujMiniatury();
}

// ---------- Podgląd bez edycji ----------

const podglad = new Podglad({
  naKlik: (idStrony) => doEdycji(idStrony),
});

async function doEdycji(idStrony) {
  const i = stan.projekt.strony.findIndex((s) => s.id === idStrony);
  pokazEkran('edytor');
  if (stan.tryb === 'strona' && i === stan.indeks) {
    trasa.ustaw(`p/${stan.projekt.id}/s/${idStrony}`);
    edytor.canvas.calcOffset();
  } else {
    trasa.ustaw(`p/${stan.projekt.id}`);
    await przejdzDoStrony(i);
    edytor.canvas.calcOffset();
  }
}

async function pokazPodglad() {
  if (!stan.projekt) return;
  await zapiszTeraz();
  const biezaca = stan.tryb === 'strona' ? biezacaStrona().id : null;
  pokazEkran('podglad');
  trasa.ustaw(`p/${stan.projekt.id}/podglad`);
  document.title = `${stan.projekt.nazwa} – podgląd – ${NAZWA}`;
  podglad.pokazProjekt(stan.projekt, biezaca);
  $('#podglad-tresc').focus({ preventScroll: true });
}

function zamknijPodglad() {
  if (document.body.classList.contains('podglad-publiczny')) return;
  doEdycji(stan.tryb === 'strona' ? biezacaStrona().id : stan.projekt.strony[0].id);
}

// ---------- Podgląd udostępniony linkiem ----------

// Widok dla osoby z linkiem: bez logowania, same obrazy stron.
async function pokazUdostepniony(t) {
  document.body.classList.add('podglad-publiczny');
  pokazEkran('podglad');
  try {
    const { manifest, adresObrazu } = await chmura.wczytajPodgladPubliczny(t.konto, t.projekt, t.kod);
    document.title = `${manifest.uklad.nazwa} – ${NAZWA}`;
    const kiedyStan = new Date(manifest.zaktualizowano).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    podglad.pokaz(manifest.uklad, {
      obraz: (strona) => adresObrazu(strona.id), stale: true, klikalne: false, opis: `stan z ${kiedyStan}`,
    });
  } catch (e) {
    document.title = NAZWA;
    $('#podglad-tytul').textContent = 'Podgląd niedostępny';
    $('#podglad-opis').textContent = '';
    const el = $('#podglad-tresc');
    el.innerHTML = '<div class="podglad-pusto"><h2>Ten link nie działa</h2><p class="ciche"></p><a class="przycisk" href="./">Przejdź do Seriodruku</a></div>';
    $('p', el).textContent = e.message;
  }
}

// Skrót treści projektu – pozwala powiedzieć, czy link pokazuje aktualny stan.
function odciskTresci(projekt) {
  const tekst = JSON.stringify([projekt.nazwa, projekt.sekcje, projekt.wzorce, projekt.strony, projekt.style]);
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i += 1) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${tekst.length}-${(h >>> 0).toString(36)}`;
}

function linkUdostepnienia(p) {
  const u = p.udostepnienie;
  return `${location.origin}${location.pathname}#/u/${u.konto}/${p.id}/${u.kod}`;
}

function odswiezOknoUdostepniania() {
  const p = stan.projekt;
  const u = p.udostepnienie;
  const zKontem = Boolean(stan.uzytkownik);
  $('#udostepnij-link-blok').hidden = !u;
  $('#udostepnij-wylacz').hidden = !u;
  $('#udostepnij-utworz').hidden = !zKontem;
  $('#udostepnij-komunikat').textContent = zKontem ? '' : 'Udostępnianie wymaga konta – w trybie bez konta projekty są tylko w tej przeglądarce.';
  $('#udostepnij-utworz').textContent = u ? 'Aktualizuj' : 'Utwórz link';
  if (!u) return;
  $('#udostepnij-link').value = linkUdostepnienia(p);
  const aktualny = u.odcisk === odciskTresci(p);
  $('#udostepnij-stan').textContent = aktualny
    ? `Link pokazuje aktualny stan projektu (zaktualizowano ${kiedy(u.zaktualizowano)}).`
    : `Projekt zmienił się od ostatniej aktualizacji linku (${kiedy(u.zaktualizowano)}). Kliknij „Aktualizuj”, aby osoby z linkiem zobaczyły zmiany.`;
  $('#udostepnij-utworz').disabled = false;
  $('#udostepnij-utworz').classList.toggle('glowny', !aktualny);
}

async function otworzUdostepnianie() {
  if (!stan.projekt) return;
  odswiezOknoUdostepniania();
  $('#dlg-udostepnij').showModal();
}

// Rysuje wszystkie strony do JPEG i wysyła je razem z manifestem.
async function opublikujUdostepnienie() {
  const p = stan.projekt;
  const przycisk = $('#udostepnij-utworz');
  const komunikat = $('#udostepnij-komunikat');
  komunikat.classList.remove('sukces');
  przycisk.disabled = true;
  try {
    await zapiszTeraz();
    const kod = p.udostepnienie?.kod
      || [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const ciag = rozwin(p);
    const poKluczu = new Map(ciag.egzemplarze.map((e) => [e.klucz, e]));
    const uklad = ukladProjektu(p, ciag);
    const strony = stronyUkladu(uklad);
    const obraz = async (s) => {
      const url = await renderujCel(p, poKluczu.get(s.id), {
        szerokoscPx: 1200, spad: false, ciag, format: 'jpeg',
      });
      return (await fetch(url)).blob();
    };
    komunikat.textContent = `Przygotowuję strony: 0 z ${strony.length}…`;
    const wynik = await chmura.opublikujPodglad(p.id, kod, uklad, strony, obraz, (i, n) => {
      komunikat.textContent = `Wysyłam strony: ${i} z ${n}…`;
    });
    p.udostepnienie = { kod, konto: wynik.konto, zaktualizowano: wynik.zaktualizowano, odcisk: odciskTresci(p) };
    komunikat.textContent = 'Gotowe. Skopiuj link i wyślij go, komu chcesz.';
    komunikat.classList.add('sukces');
    await zapiszTeraz();
  } catch (e) {
    komunikat.textContent = `Nie udało się udostępnić: ${chmura.komunikatBledu(e)}`;
  } finally {
    przycisk.disabled = false;
    odswiezOknoUdostepnianiaZachowujacKomunikat();
  }
}

function odswiezOknoUdostepnianiaZachowujacKomunikat() {
  const k = $('#udostepnij-komunikat');
  const [tekst, sukces] = [k.textContent, k.classList.contains('sukces')];
  odswiezOknoUdostepniania();
  k.textContent = tekst;
  k.classList.toggle('sukces', sukces);
}

async function wylaczUdostepnienie() {
  const p = stan.projekt;
  if (!p.udostepnienie) return;
  if (!await potwierdz('Wyłączyć link?', 'Osoby, które dostały link, przestaną widzieć podgląd. Nowy link będzie miał inny adres.', 'Wyłącz link', true)) return;
  try {
    await chmura.wylaczPodglad(p.id, p.udostepnienie.kod);
    delete p.udostepnienie;
    await zapiszTeraz();
    odswiezOknoUdostepniania();
    $('#udostepnij-komunikat').textContent = 'Link wyłączony.';
  } catch (e) {
    $('#udostepnij-komunikat').textContent = `Nie udało się wyłączyć: ${chmura.komunikatBledu(e)}`;
  }
}

async function kopiujLinkUdostepnienia() {
  const pole = $('#udostepnij-link');
  try {
    await navigator.clipboard.writeText(pole.value);
    powiadom('Link skopiowany.');
  } catch {
    pole.select();
    powiadom('Zaznaczyłem link – skopiuj go z pola.');
  }
}

async function doProjektow() {
  if (stan.projekt) await zapiszTeraz();
  stan.projekt = null;
  document.title = NAZWA;
  pokazProjekty();
}

// Własne prowadnice strony albo wzorca; puste nie zajmują miejsca w pliku.
function zapiszProwadnice(cel, p) {
  if (p && (p.x.length || p.y.length)) cel.prowadnice = p; else delete cel.prowadnice;
}

// Przepisuje płótno do tego, co jest na nim wczytane: wzorca albo stron arkusza
// (w rozkładówce – obu naraz; element należy do strony, na której leży jego środek).
function zapiszBiezacyCel() {
  const { projekt } = stan;
  if (!projekt || !naPlotnie) return;
  if (naPlotnie.wzorzec) {
    const cel = projekt.wzorce.find((w) => w.id === naPlotnie.wzorzec);
    if (!cel) return;
    cel.obiekty = edytor.obiektyStrony();
    zapiszProwadnice(cel, edytor.prowadniceStron()[0]);
    // Białe tło wzorca znaczy „bez tła” – nie nadpisuje innych wzorców.
    const tlo = kolor(edytor.tla[0] || '#ffffff');
    cel.tlo = tlo === '#ffffff' ? null : tlo;
    // Strony z tym wzorcem trzeba przerysować.
    for (const s of stronyZWzorcem(projekt, cel.id)) stan.miniatury.delete(s.id);
    stan.miniatury.set(cel.id, edytor.miniatura(200, 0));
  } else {
    const obiekty = edytor.obiektyStron();
    const prowadnice = edytor.prowadniceStron();
    naPlotnie.strony.forEach((id, i) => {
      const cel = projekt.strony.find((s) => s.id === id);
      if (!cel) return;
      cel.obiekty = obiekty[i];
      zapiszProwadnice(cel, prowadnice[i]);
      // Własne tło zapisujemy tylko wtedy, gdy różni się od tła z wzorców.
      const tlo = kolor(edytor.tla[i] || '#ffffff');
      const odziedziczone = kolor(tloStrony(projekt, { ...cel, tlo: null }));
      cel.tlo = tlo === odziedziczone ? null : tlo;
      stan.miniatury.set(cel.id, edytor.miniatura(200, i));
    });
  }
  const pierwsza = stan.projekt.strony[0];
  stan.projekt.miniatura = stan.miniatury.get(pierwsza.id) || stan.projekt.miniatura;
}

function zaplanujZapis() {
  stanZapisu('zapis', 'Zapisywanie…');
  clearTimeout(stan.timerZapisu);
  stan.timerZapisu = setTimeout(zapiszTeraz, 700);
}

async function zapiszTeraz() {
  clearTimeout(stan.timerZapisu);
  stan.timerZapisu = null;
  if (!stan.projekt) return stan.zapisywanie;
  zapiszBiezacyCel();
  for (const id of naPlotnie?.strony || [naPlotnie?.wzorzec]) odswiezMiniature(id);
  stan.projekt.zmieniono = new Date().toISOString();
  const projekt = stan.projekt;
  stan.zapisywanie = stan.zapisywanie.then(async () => {
    try {
      await zapiszLokalnie(projekt, wlasciciel(), Boolean(stan.uzytkownik));
      if (stan.uzytkownik) zaplanujChmure();
      else stanZapisu('ok', 'Zapisano w przeglądarce');
    } catch (e) {
      stanZapisu('blad', `Błąd zapisu: ${e.message}`);
    }
  });
  return stan.zapisywanie;
}

function zaplanujChmure(opoznienie = 2500) {
  if (!stan.uzytkownik) return;
  clearTimeout(stan.timerChmury);
  stan.timerChmury = setTimeout(synchronizuj, opoznienie);
}

async function synchronizuj({ wymus = false } = {}) {
  const p = stan.projekt;
  if (!stan.uzytkownik || !p) return;
  if (!navigator.onLine) {
    stanZapisu('offline', 'Offline – zapisano na urządzeniu');
    return;
  }
  if (stan.konflikt === p.id && !wymus) return; // czekamy na decyzję użytkownika
  const wersja = p.zmieniono;
  try {
    await chmura.zapiszWChmurze(p, { wymus });
    stan.konflikt = null;
    await zapiszLokalnie(p, wlasciciel(), p.zmieniono !== wersja);
    await oznaczZsynchronizowany(p.id, wersja);
    if (stan.projekt === p && !stan.timerZapisu) stanZapisu('ok', 'Zapisano');
  } catch (e) {
    if (e.konflikt) { rozstrzygnijKonflikt(p, e); return; }
    stanZapisu('blad', `Nie wysłano: ${chmura.komunikatBledu(e)}`);
  }
}

// Na koncie jest wersja zapisana z innego urządzenia – nic nie nadpisujemy po cichu.
async function rozstrzygnijKonflikt(p, e) {
  if (stan.konflikt === p.id) return;
  stan.konflikt = p.id;
  stanZapisu('blad', 'Nowsza wersja na koncie – wybierz, którą zachować');
  const kiedyTamta = e.zmieniono ? ` (zapisana ${kiedy(e.zmieniono)})` : '';
  const moja = await potwierdz(
    'Projekt zmieniono na innym urządzeniu',
    `Na koncie jest inna wersja projektu „${p.nazwa}”${kiedyTamta}. Możesz zachować wersję z tego urządzenia – tamta zostanie zastąpiona – albo wczytać wersję z konta i porzucić zmiany zrobione tutaj.`,
    'Zachowaj wersję z tego urządzenia',
    false,
    'Wczytaj wersję z konta',
  );
  if (stan.projekt !== p) { stan.konflikt = null; return; }
  if (moja) {
    await synchronizuj({ wymus: true });
    return;
  }
  try {
    const zKonta = normalizuj(await chmura.wczytajZChmury(p.id));
    await zapiszLokalnie(zKonta, wlasciciel(), false);
    stan.konflikt = null;
    clearTimeout(stan.timerZapisu);
    stan.timerZapisu = null;
    stan.projekt = null; // żeby otwarcie nie zapisało porzucanej wersji
    await otworzProjekt(zKonta);
    powiadom('Wczytano wersję z konta.');
  } catch (blad) {
    stan.konflikt = null;
    stanZapisu('blad', `Nie udało się wczytać wersji z konta: ${chmura.komunikatBledu(blad)}`);
  }
}

// ---------- Panel: strona i wzorzec ----------

function nazwyWzorcow(ids) {
  const nazwy = stan.projekt.wzorce.filter((w) => ids.includes(w.id)).map((w) => w.nazwa);
  return nazwy.length ? nazwy.join(', ') : 'bez wzorców';
}

async function poZmianieWzorcowStrony(strona) {
  zapiszBiezacyCel();
  stan.miniatury.delete(strona.id);
  await zaladujCel();
  panel.zbuduj();
  zaplanujZapis();
}

function panelStrony(p) {
  const { projekt } = stan;
  const strona = biezacaStrona();
  const sekcja = biezacaSekcja();
  const bok = bokStrony(strona, rozwin(projekt));
  const s = p.sekcja('Strona');
  s.append(p.tekst('Nazwa strony', () => strona.nazwa, (v) => {
    strona.nazwa = v || strona.nazwa;
    renderujListe();
    zaplanujZapis();
  }, true, false));

  const sel = p.wybor('Sekcja', projekt.sekcje.map((x) => [x.id, x.nazwa]), () => strona.sekcja, (v) => przeniesStroneDoSekcji(strona, v));
  sel.classList.add('szeroki');
  s.append(sel);

  s.append(p.kolor('Tło', () => edytor.tloAktywnej, (v) => edytor.ustawTlo(v), { bezZatwierdzania: true }));
  if (strona.tlo) {
    s.append(p.akcje([['cofnij', 'Tło z wzorca', () => {
      edytor.ustawTlo(tloStrony(projekt, { ...strona, tlo: null }));
      strona.tlo = null;
      panel.zbuduj();
    }]]));
  }

  if (edytor.maSchowek) {
    s.append(p.akcje([['wklej', 'Wklej skopiowane elementy', () => edytor.wklej()]]));
  }

  // Seria: powielanie strony według tabeli albo zadaną liczbę razy.
  const se = p.sekcja('Seria (powielanie)');
  const seria = projekt.serie.find((x) => x.id === strona.seria);
  const wyborSerii = p.wybor('Seria', [['', 'Brak – strona pojedyncza'], ...projekt.serie.map((x) => [x.id, x.nazwa]), ['+', '+ Nowa seria…']], () => strona.seria || '', async (v) => {
    const nowa = v === '+' ? dane.nowaSeria() : null;
    if (v === '') delete strona.seria; else strona.seria = nowa ? nowa.id : v;
    zapiszBiezacyCel();
    stan.miniatury.clear();
    await zaladujCel();
    panel.zbuduj();
    zaplanujZapis();
    if (nowa) dane.otworzSerie(nowa.id);
  });
  wyborSerii.classList.add('szeroki');
  se.append(wyborSerii);
  if (seria) {
    se.append(p.wskazowka(dane.opisSerii(seria)));
    se.append(p.akcje([['suwaki', 'Ustawienia serii', () => dane.otworzSerie(seria.id)], ['dane', 'Dane', () => dane.otworz(seria.tabela)]]));
  } else {
    se.append(p.wskazowka('Strony z tą samą serią, leżące obok siebie, powielają się razem – np. według wierszy tabeli.'));
  }

  if (projekt.wzorce.length) {
    const w = p.sekcja('Wzorce');
    const tryb = p.wybor('Wzorce na tej stronie', [
      ['sekcja', `Jak w sekcji (${nazwyWzorcow(sekcja.wzorce)})`],
      ['wlasne', 'Własny wybór'],
    ], () => (strona.wzorce === WZORCE_Z_SEKCJI ? 'sekcja' : 'wlasne'), (v) => {
      strona.wzorce = v === 'sekcja' ? WZORCE_Z_SEKCJI : [...sekcja.wzorce];
      poZmianieWzorcowStrony(strona);
    });
    tryb.classList.add('szeroki');
    w.append(tryb);
    if (strona.wzorce !== WZORCE_Z_SEKCJI) {
      for (const wz of projekt.wzorce) {
        w.append(p.przelacznik(wz.nazwa, () => strona.wzorce.includes(wz.id), (v) => {
          strona.wzorce = v ? [...strona.wzorce, wz.id] : strona.wzorce.filter((id) => id !== wz.id);
          poZmianieWzorcowStrony(strona);
        }));
      }
    }
  }

  const f = p.sekcja(`Sekcja „${sekcja.nazwa}”`);
  f.append(p.wskazowka(`${sekcja.uklad === 'rozkladowki' ? `Rozkładówki – to strona ${bok}. ` : ''}${nazwaFormatu(sekcja.wydruk, true, sekcja.uklad === 'rozkladowki')}`));
  if (edytor.rozkladowka) f.append(p.wskazowka('Obie strony rozkładówki edytujesz razem. Element może leżeć przez grzbiet – na każdej stronie wydrukuje się jego część.'));
  f.append(p.akcje([['format', 'Ustawienia sekcji', () => otworzUstawieniaSekcji(sekcja.id)]]));

  p.legendaProwadnic(Boolean(bok));
}

function panelWzorca(p) {
  const { projekt } = stan;
  const w = biezacyWzorzec();
  const s = p.sekcja('Wzorzec');
  s.append(p.tekst('Nazwa wzorca', () => w.nazwa, (v) => {
    w.nazwa = v || w.nazwa;
    renderujListe();
    odswiezPasekEdytora();
    zaplanujZapis();
  }, true, false));
  s.append(p.kolor('Tło stron', () => edytor.tloAktywnej, (v) => edytor.ustawTlo(v), { bezZatwierdzania: true }));
  s.append(p.wskazowka('Białe tło znaczy „bez tła” – wzorzec nie zmienia wtedy koloru strony.'));
  s.append(p.przelacznik('Odbijaj lustrzanie na lewych stronach rozkładówek', () => w.lustro, (v) => {
    w.lustro = v;
    for (const st of stronyZWzorcem(projekt, w.id)) stan.miniatury.delete(st.id);
    zaplanujZapis();
  }));
  s.append(p.wskazowka('Elementy wzorca leżą pod treścią stron. Zaznacz element i włącz „Nad treścią strony”, jeśli ma ją przykrywać (np. ramka albo znak wodny).'));

  const u = p.sekcja('Gdzie jest używany');
  for (const sek of projekt.sekcje) {
    const inny = tenSamRozmiar(sek.wydruk, w.wydruk) ? '' : ' – inny rozmiar';
    u.append(p.przelacznik(`Sekcja „${sek.nazwa}”${inny}`, () => sek.wzorce.includes(w.id), (v) => {
      sek.wzorce = v ? [...sek.wzorce, w.id] : sek.wzorce.filter((id) => id !== w.id);
      for (const st of stronySekcji(projekt, sek)) stan.miniatury.delete(st.id);
      odswiezPasekEdytora();
      renderujListe();
      zaplanujZapis();
    }));
  }
  u.append(p.wskazowka('Strona może mieć kilka wzorców naraz (np. tło + stopka). Pojedynczym stronom wybierzesz je w ich właściwościach.'));

  const r = p.sekcja('Rozmiar');
  r.append(p.wskazowka(nazwaFormatu(w.wydruk, true)));
  const dopasuj = p.wybor('Ustaw rozmiar jak w sekcji', [['', '— wybierz sekcję —'], ...projekt.sekcje.map((x) => [x.id, x.nazwa])], () => '', async (v) => {
    const sek = projekt.sekcje.find((x) => x.id === v);
    if (!sek) return;
    zapiszBiezacyCel();
    w.wydruk = normalizujWydruk(sek.wydruk);
    await zaladujCel({ dopasuj: true });
    panel.zbuduj();
    zaplanujZapis();
  });
  dopasuj.classList.add('szeroki');
  r.append(dopasuj);

  const z = p.sekcja('Numer strony i inne zmienne');
  const lista = document.createElement('ul');
  lista.className = 'lista-zmiennych szeroki';
  lista.innerHTML = [
    ['{nr}', 'numer strony (według numeracji sekcji)'],
    ['{nr_w_sekcji}', 'kolejny numer strony w jej sekcji'],
    ['{liczba_stron}', 'najwyższy numer strony'],
    ['{sekcja}', 'nazwa sekcji'],
    ['{strona}', 'nazwa strony'],
  ].map(([k, o]) => `<li><code>${k}</code> ${o}</li>`).join('');
  z.append(p.wskazowka('Wpisz w dowolnym tekście wzorca, np. „Strona {nr} z {liczba_stron}”. Na stronach pojawi się właściwa wartość.'), lista);

  p.legendaProwadnic();
}

// ---------- Lista: strony (pogrupowane w sekcje) i wzorce ----------

function ustawZakladke(nazwa) {
  stan.zakladka = nazwa;
  $$('#zakladki-listy input').forEach((r) => { r.checked = r.value === nazwa; });
  $('#lista-stron').hidden = nazwa !== 'strony';
  $('#lista-wzorcow').hidden = nazwa !== 'wzorce';
  $('#lista-warstw').hidden = nazwa !== 'warstwy';
  panelWarstw.pokaz(nazwa === 'warstwy');
  $('#stopka-strony').hidden = nazwa !== 'strony';
  $('#stopka-wzorce').hidden = nazwa !== 'wzorce';
}

function renderujListe() {
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
      li.innerHTML = `<span class="numer">${nr ?? '–'}</span>
        <button class="miniatura"></button>
        <span class="nazwa"></span>
        <button class="przycisk-ikona menu-miniatury" aria-label="Opcje strony" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 18 })}</button>`;
      $('.miniatura', li).setAttribute('aria-label', `Strona ${nr ?? ''} ${s.nazwa}`);
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

function odswiezMiniature(id) {
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
function generujMiniatury() {
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

async function przejdzDoStrony(i) {
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

async function dodajStrone(idSekcji = null) {
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

async function duplikujStrone(i) {
  zapiszBiezacyCel();
  const zrodlo = stan.projekt.strony[i];
  const kopia = kopiujStrone(zrodlo, `${zrodlo.nazwa} (kopia)`);
  stan.projekt.strony.splice(i + 1, 0, kopia);
  stan.tryb = 'strona';
  stan.indeks = i + 1;
  await zaladujCel();
  zaplanujZapis();
}

async function usunStrone(i) {
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
}

// Przesuwanie w obrębie sekcji (do innej sekcji – przez właściwości strony).
async function przesunStrone(i, kierunek) {
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

async function przeniesStroneDoSekcji(strona, idSekcji) {
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

async function zmienNazweStrony(i) {
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
  pokazMenu(menu, przycisk);
}

const indeksZMenu = () => Number($('#menu-strony').dataset.indeks);
const sekcjaZMenu = () => $('#menu-sekcji').dataset.id;
const wzorzecZMenu = () => $('#menu-wzorca').dataset.id;

// ---------- Sekcje ----------

// Dialog ustawień sekcji. id === null → nowa sekcja.
function otworzUstawieniaSekcji(id) {
  const dlg = $('#dlg-sekcja');
  const f = dlg.querySelector('form');
  const { projekt } = stan;
  const istniejaca = projekt.sekcje.find((s) => s.id === id);
  const wzor = istniejaca || biezacaSekcja();
  const w = wzor.wydruk;
  dlg.dataset.id = id || '';
  $('#tytul-sekcji').textContent = istniejaca ? 'Ustawienia sekcji' : 'Nowa sekcja';
  $('#zapisz-sekcje').textContent = istniejaca ? 'Zapisz' : 'Dodaj sekcję';
  f.elements.nazwa.value = istniejaca ? istniejaca.nazwa : `Sekcja ${projekt.sekcje.length + 1}`;
  f.elements.uklad.value = wzor.uklad;
  f.elements.pierwsza.value = wzor.pierwsza;
  const sel = f.elements.format;
  sel.replaceChildren();
  for (const [nazwa, [sz, wy]] of Object.entries(FORMATY)) sel.add(new Option(`${nazwa} (${sz} × ${wy} mm)`, nazwa));
  sel.add(new Option('Własny', 'wlasny'));
  sel.value = FORMATY[w.format] ? w.format : 'wlasny';
  f.elements.szerokosc_mm.value = w.szerokosc_mm;
  f.elements.wysokosc_mm.value = w.wysokosc_mm;
  f.elements.spad_mm.value = w.spad_mm;
  for (const k of ['gora', 'dol', 'wewnetrzny', 'zewnetrzny']) f.elements[`margines_${k}`].value = w.marginesy[k];
  f.elements.znaki_ciecia.checked = Boolean(w.znaki_ciecia);
  const num = (istniejaca || { numeracja: { tryb: 'ciagla', od: 1 } }).numeracja;
  f.elements.numeracja.value = num.tryb;
  f.elements.numeracja_od.value = num.od;

  const lista = $('#sekcja-wzorce');
  lista.replaceChildren();
  $('#sekcja-wzorce-pole').hidden = projekt.wzorce.length === 0;
  const wybrane = new Set(istniejaca ? istniejaca.wzorce : []);
  for (const x of projekt.wzorce) {
    const label = document.createElement('label');
    label.className = 'przelacznik';
    label.innerHTML = '<input type="checkbox" name="wzorce"><span></span>';
    $('input', label).value = x.id;
    $('input', label).checked = wybrane.has(x.id);
    $('span', label).textContent = tenSamRozmiar(x.wydruk, w) ? x.nazwa : `${x.nazwa} (inny rozmiar)`;
    lista.append(label);
  }
  odswiezPolaSekcji();
  dlg.returnValue = '';
  dlg.showModal();
  f.elements.nazwa.focus();
}

// Etykiety marginesów i pola zależne od układu oraz numeracji.
function odswiezPolaSekcji() {
  const f = $('#dlg-sekcja form');
  const rozkladowki = f.elements.uklad.value === 'rozkladowki';
  $('#etykieta-wewnetrzny').textContent = rozkladowki ? 'Wewnętrzny' : 'Lewy';
  $('#etykieta-zewnetrzny').textContent = rozkladowki ? 'Zewnętrzny' : 'Prawy';
  $('#pole-pierwsza').hidden = !rozkladowki;
  $('#podpowiedz-rozkladowki').hidden = !rozkladowki;
  $('#pole-numeracja-od').hidden = f.elements.numeracja.value !== 'od';
}
$('#dlg-sekcja form').addEventListener('change', (e) => {
  if (['uklad', 'numeracja'].includes(e.target.name)) odswiezPolaSekcji();
});

function wykryjFormat(sz, wy) {
  for (const [nazwa, [a, b]] of Object.entries(FORMATY)) {
    if ((a === sz && b === wy) || (a === wy && b === sz)) return nazwa;
  }
  return 'wlasny';
}

async function zatwierdzSekcje() {
  const dlg = $('#dlg-sekcja');
  const f = dlg.querySelector('form');
  const mm = (n) => Math.max(0, parseFloat(String(f.elements[n].value).replace(',', '.')) || 0);
  const sz = Math.max(20, mm('szerokosc_mm'));
  const wy = Math.max(20, mm('wysokosc_mm'));
  const wydruk = {
    format: wykryjFormat(sz, wy),
    szerokosc_mm: sz,
    wysokosc_mm: wy,
    spad_mm: mm('spad_mm'),
    marginesy: {
      gora: Math.min(mm('margines_gora'), wy / 2 - 1),
      dol: Math.min(mm('margines_dol'), wy / 2 - 1),
      wewnetrzny: Math.min(mm('margines_wewnetrzny'), sz / 2 - 1),
      zewnetrzny: Math.min(mm('margines_zewnetrzny'), sz / 2 - 1),
    },
    znaki_ciecia: f.elements.znaki_ciecia.checked,
  };
  const ustawienia = {
    nazwa: f.elements.nazwa.value.trim() || 'Sekcja',
    wydruk,
    uklad: f.elements.uklad.value === 'rozkladowki' ? 'rozkladowki' : 'pojedyncze',
    pierwsza: f.elements.pierwsza.value === 'lewa' ? 'lewa' : 'prawa',
    wzorce: $$('input[name="wzorce"]:checked', f).map((i) => i.value),
    numeracja: { tryb: f.elements.numeracja.value, od: Math.max(0, Math.round(mm('numeracja_od'))) },
  };
  zapiszBiezacyCel();
  const { projekt } = stan;
  let sekcja = projekt.sekcje.find((s) => s.id === dlg.dataset.id);
  if (sekcja) {
    Object.assign(sekcja, ustawienia);
  } else {
    sekcja = { ...nowaSekcja(ustawienia.nazwa, wydruk), ...ustawienia };
    const i = projekt.sekcje.indexOf(biezacaSekcja());
    projekt.sekcje.splice(i + 1, 0, sekcja);
    const strona = nowaStrona(`Strona ${projekt.strony.length + 1}`, sekcja.id);
    projekt.strony.push(strona);
    uporzadkujStrony(projekt);
    stan.tryb = 'strona';
    stan.indeks = projekt.strony.indexOf(strona);
    ustawZakladke('strony');
  }
  stan.miniatury.clear(); // format, wzorce albo numeracja mogły zmienić każdą stronę
  await zaladujCel();
  if (!edytor.aktywny) panel.zbuduj();
  zaplanujZapis();
}

$('#dlg-sekcja').addEventListener('close', () => {
  if ($('#dlg-sekcja').returnValue === 'ok') zatwierdzSekcje();
});
$('#dlg-sekcja select[name="format"]').addEventListener('change', () => {
  const f = $('#dlg-sekcja form');
  const wym = FORMATY[f.elements.format.value];
  if (!wym) return;
  const poziomo = Number(f.elements.szerokosc_mm.value) > Number(f.elements.wysokosc_mm.value);
  f.elements.szerokosc_mm.value = poziomo ? Math.max(...wym) : wym[0];
  f.elements.wysokosc_mm.value = poziomo ? Math.min(...wym) : wym[1];
});
for (const n of ['szerokosc_mm', 'wysokosc_mm']) {
  $(`#dlg-sekcja [name="${n}"]`).addEventListener('input', () => {
    const f = $('#dlg-sekcja form');
    f.elements.format.value = wykryjFormat(Number(f.elements.szerokosc_mm.value), Number(f.elements.wysokosc_mm.value));
  });
}

async function przesunSekcje(id, kierunek) {
  const sekcje = stan.projekt.sekcje;
  const i = sekcje.findIndex((s) => s.id === id);
  const j = i + kierunek;
  if (j < 0 || j >= sekcje.length) return;
  zapiszBiezacyCel();
  const biezaca = biezacaStrona();
  [sekcje[i], sekcje[j]] = [sekcje[j], sekcje[i]];
  uporzadkujStrony(stan.projekt);
  stan.indeks = stan.projekt.strony.indexOf(biezaca);
  stan.miniatury.clear();
  await zaladujCel();
  zaplanujZapis();
}

async function usunSekcje(id) {
  const { projekt } = stan;
  if (projekt.sekcje.length <= 1) return;
  const sekcja = projekt.sekcje.find((s) => s.id === id);
  const strony = projekt.strony.filter((s) => s.sekcja === id);
  if (strony.length === projekt.strony.length) {
    powiadom('To jedyne strony w projekcie – przenieś najpierw jakąś stronę do innej sekcji.', true);
    return;
  }
  const ok = await potwierdz(
    `Usunąć sekcję „${sekcja.nazwa}”?`,
    strony.length ? `Razem z nią zostanie usuniętych ${strony.length} stron.` : 'Sekcja jest pusta.',
    'Usuń sekcję',
    true,
  );
  if (!ok) return;
  zapiszBiezacyCel();
  const biezaca = biezacaStrona();
  projekt.sekcje = projekt.sekcje.filter((s) => s.id !== id);
  projekt.strony = projekt.strony.filter((s) => s.sekcja !== id);
  const ni = projekt.strony.indexOf(biezaca);
  stan.indeks = ni >= 0 ? ni : 0;
  stan.miniatury.clear();
  await zaladujCel();
  zaplanujZapis();
}

// ---------- Wzorce ----------

async function edytujWzorzec(id) {
  if (stan.tryb === 'wzorzec' && stan.idWzorca === id) return;
  zapiszBiezacyCel();
  stan.tryb = 'wzorzec';
  stan.idWzorca = id;
  ustawZakladke('wzorce');
  await zaladujCel();
  if (document.body.dataset.panel === 'strony') ustawPanel('');
}

async function wrocDoStron() {
  if (stan.tryb !== 'wzorzec') return;
  zapiszBiezacyCel();
  stan.tryb = 'strona';
  ustawZakladke('strony');
  await zaladujCel();
}

async function dodajWzorzec() {
  const { projekt } = stan;
  const sekcja = biezacaSekcja();
  const w = nowyWzorzec(`Wzorzec ${projekt.wzorce.length + 1}`, sekcja.wydruk);
  projekt.wzorce.push(w);
  // Nowy wzorzec od razu działa w bieżącej sekcji – najczęstszy przypadek.
  sekcja.wzorce = [...sekcja.wzorce, w.id];
  powiadom(`Wzorzec będzie widoczny na stronach sekcji „${sekcja.nazwa}”. Zmienisz to w panelu z prawej.`);
  await edytujWzorzec(w.id);
  zaplanujZapis();
}

async function duplikujWzorzecZ(id) {
  zapiszBiezacyCel();
  const zrodlo = stan.projekt.wzorce.find((w) => w.id === id);
  const kopia = kopiujWzorzec(zrodlo, `${zrodlo.nazwa} (kopia)`);
  stan.projekt.wzorce.splice(stan.projekt.wzorce.indexOf(zrodlo) + 1, 0, kopia);
  await edytujWzorzec(kopia.id);
  zaplanujZapis();
}

async function zmienNazweWzorca(id) {
  const w = stan.projekt.wzorce.find((x) => x.id === id);
  const nazwa = await zapytajONazwe('Zmień nazwę wzorca', 'Nazwa wzorca', w.nazwa);
  if (!nazwa) return;
  w.nazwa = nazwa;
  renderujListe();
  if (stan.tryb === 'wzorzec') { odswiezPasekEdytora(); if (!edytor.aktywny) panel.zbuduj(); } else if (!edytor.aktywny) panel.zbuduj();
  zaplanujZapis();
}

async function usunWzorzec(id) {
  const { projekt } = stan;
  const w = projekt.wzorce.find((x) => x.id === id);
  const n = stronyZWzorcem(projekt, id).length;
  const ok = await potwierdz(
    `Usunąć wzorzec „${w.nazwa}”?`,
    n ? `Zniknie ze ${n} stron, które go używają. Ich własna treść zostanie.` : 'Wzorzec nie jest nigdzie używany.',
    'Usuń wzorzec',
    true,
  );
  if (!ok) return;
  zapiszBiezacyCel();
  for (const s of stronyZWzorcem(projekt, id)) stan.miniatury.delete(s.id);
  projekt.wzorce = projekt.wzorce.filter((x) => x.id !== id);
  for (const s of projekt.sekcje) s.wzorce = s.wzorce.filter((x) => x !== id);
  for (const s of projekt.strony) if (Array.isArray(s.wzorce)) s.wzorce = s.wzorce.filter((x) => x !== id);
  stan.miniatury.delete(id);
  if (stan.tryb === 'wzorzec' && stan.idWzorca === id) {
    stan.tryb = 'strona';
    await zaladujCel();
    ustawZakladke('wzorce');
  } else {
    await zaladujCel();
  }
  zaplanujZapis();
}

// ---------- Ostrzeżenia ----------

function renderujOstrzezenia(lista) {
  const ul = $('#lista-ostrzezen');
  ul.replaceChildren();
  const licznik = $('#licznik-ostrzezen');
  licznik.textContent = lista.length;
  licznik.classList.toggle('sa', lista.length > 0);
  $('#kropka-ostrzezen').hidden = lista.length === 0;
  if (!lista.length) {
    const li = document.createElement('li');
    li.className = 'brak';
    li.textContent = 'Wszystko mieści się w marginesach.';
    ul.append(li);
    return;
  }
  for (const o of lista) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="opis" role="button" tabindex="0" title="Zaznacz element"><strong></strong><span></span></span><button class="przycisk" title="To celowe – nie pokazuj ostrzeżenia dla tego elementu">Wycisz</button>';
    $('strong', li).textContent = o.obiekt;
    $('.opis span', li).textContent = OPIS_OSTRZEZEN[o.typ];
    $('.opis', li).addEventListener('click', () => edytor.zaznacz(o.id));
    $('.przycisk', li).addEventListener('click', () => {
      const obj = edytor.canvas.getObjects().find((x) => x.id === o.id);
      if (!obj) return;
      obj.bez_ostrzezen = true;
      edytor.oznaczZmiane();
      panel.odswiez();
    });
    ul.append(li);
  }
}

// ---------- Pliki ----------

async function wczytajPlikProjektu(plik) {
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

async function wstawObraz(plik) {
  if (!plik.type.startsWith('image/')) {
    powiadom('To nie jest plik obrazu.', true);
    return;
  }
  try {
    const dataUrl = await chmura.blobNaDataUrl(plik);
    await edytor.dodajObraz(dataUrl, plik.name, stan.projekt.zasoby);
  } catch (e) {
    powiadom(e.message, true);
  }
}

// ---------- Panele (telefon) ----------

function ustawPanel(nazwa) {
  document.body.dataset.panel = document.body.dataset.panel === nazwa ? '' : nazwa;
  $$('.zakladki-mobilne button').forEach((b) => {
    b.classList.toggle('aktywny', b.dataset.panel === document.body.dataset.panel);
  });
}

// ======================================================================
// Akcje (data-akcja)
// ======================================================================

const zMenu = (fn) => () => { const v = fn.zrodlo(); zamknijMenu(); fn(v); };
const przezMenu = (zrodlo, fn) => { const f = (v) => fn(v); f.zrodlo = zrodlo; return zMenu(f); };

const akcje = {
  'nowy-projekt': otworzNowyProjekt,
  instrukcja: () => instrukcja.otworz(0),
  'zamknij-instrukcje': () => instrukcja.zamknij(),
  wyloguj: () => wyloguj(false),
  'ustawienia-konta': () => { zamknijMenu(); trasa.ustaw('konto'); przejdzDoTrasy(); },
  'importuj-projekt': () => { zamknijMenu(); $('#plik-projekt').click(); },
  'do-projektow': doProjektow,
  motyw: () => { zamknijMenu(); przelaczMotyw(); },
  podglad: () => pokazPodglad(),
  udostepnij: otworzUdostepnianie,
  'udostepnij-zamknij': () => $('#dlg-udostepnij').close(),
  'udostepnij-utworz': opublikujUdostepnienie,
  'udostepnij-wylacz': wylaczUdostepnienie,
  'udostepnij-kopiuj': kopiujLinkUdostepnienia,
  'podglad-zamknij': zamknijPodglad,
  'podglad-plus': () => podglad.powieksz(1.25),
  'podglad-minus': () => podglad.powieksz(0.8),
  'podglad-dopasuj': () => podglad.dopasuj(),
  png: () => {
    zamknijMenu();
    const nazwa = stan.tryb === 'wzorzec' ? `wzorzec-${biezacyWzorzec().nazwa}` : `s${stan.indeks + 1}`;
    pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa)}-${bezpiecznaNazwa(nazwa)}.png`, edytor.png(150));
  },
  wydruk: () => otworzUstawieniaSekcji(biezacaSekcja().id),
  'zamknij-panel': () => ustawPanel(''),
  'obroc-format': () => {
    const f = $('#dlg-sekcja form');
    [f.elements.szerokosc_mm.value, f.elements.wysokosc_mm.value] = [f.elements.wysokosc_mm.value, f.elements.szerokosc_mm.value];
  },

  'strona-dodaj': () => dodajStrone(),
  'strona-nazwa': przezMenu(indeksZMenu, zmienNazweStrony),
  'strona-duplikuj': przezMenu(indeksZMenu, duplikujStrone),
  'strona-usun': przezMenu(indeksZMenu, usunStrone),
  'strona-gora': przezMenu(indeksZMenu, (i) => przesunStrone(i, -1)),
  'strona-dol': przezMenu(indeksZMenu, (i) => przesunStrone(i, 1)),

  'sekcja-dodaj': () => otworzUstawieniaSekcji(null),
  'sekcja-ustawienia': przezMenu(sekcjaZMenu, otworzUstawieniaSekcji),
  'sekcja-strona': przezMenu(sekcjaZMenu, dodajStrone),
  'sekcja-gora': przezMenu(sekcjaZMenu, (id) => przesunSekcje(id, -1)),
  'sekcja-dol': przezMenu(sekcjaZMenu, (id) => przesunSekcje(id, 1)),
  'sekcja-usun': przezMenu(sekcjaZMenu, usunSekcje),

  'wzorzec-dodaj': dodajWzorzec,
  'wzorzec-nazwa': przezMenu(wzorzecZMenu, zmienNazweWzorca),
  'wzorzec-duplikuj': przezMenu(wzorzecZMenu, duplikujWzorzecZ),
  'wzorzec-usun': przezMenu(wzorzecZMenu, usunWzorzec),
  'wroc-do-stron': wrocDoStron,

  'dodaj-tekst': () => edytor.dodajTekst(),
  'dodaj-prostokat': () => edytor.dodajProstokat(),
  'dodaj-elipse': () => edytor.dodajElipse(),
  'dodaj-linie': () => edytor.dodajLinie(),
  'dodaj-obraz': () => $('#plik-obraz').click(),
  cofnij: () => edytor.cofnij(),
  ponow: () => edytor.ponow(),
  duplikuj: () => edytor.duplikuj(),
  kopiuj: async () => { if (await edytor.kopiuj()) powiadom('Skopiowano. Wklej na tej albo innej stronie: Ctrl+V lub „Wklej” we właściwościach strony.'); },
  usun: () => edytor.usun(),
  prowadnice: () => {
    edytor.pokazProwadnice = !edytor.pokazProwadnice;
    $('#przycisk-prowadnice').setAttribute('aria-pressed', String(edytor.pokazProwadnice));
    edytor.canvas.requestRenderAll();
  },
  'prowadnice-usun': () => { edytor.usunProwadnice(); zamknijMenu(); },
  dane: () => dane.otworz(),
  'zoom-plus': () => edytor.ustawZoom(edytor.zoom * 1.25),
  'zoom-minus': () => edytor.ustawZoom(edytor.zoom / 1.25),
  'zoom-dopasuj': () => edytor.dopasujDoOkna(),
};

$('#zakladki-listy').addEventListener('change', (e) => {
  ustawZakladke(e.target.value);
  if (e.target.value === 'strony' && stan.tryb === 'wzorzec') wrocDoStron();
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-akcja]');
  if (b && akcje[b.dataset.akcja]) {
    e.preventDefault();
    akcje[b.dataset.akcja]();
    return;
  }
  const z = e.target.closest('.zakladki-mobilne [data-panel]');
  if (z) ustawPanel(z.dataset.panel);
});

$('#awatar').addEventListener('click', (e) => przelaczMenu(e.currentTarget, $('#menu-uzytkownika')));
$('#przycisk-wiecej').addEventListener('click', (e) => przelaczMenu(e.currentTarget, $('#menu-wiecej')));
$('#przycisk-widok').addEventListener('click', (e) => { menuWidoku.odswiez(); przelaczMenu(e.currentTarget, $('#menu-widoku')); });
$('#naglowek-ostrzezen').addEventListener('click', (e) => {
  const b = e.currentTarget;
  b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'));
});

// Obrazy do pól: trafiają do zasobów projektu pod nazwą pliku, bez wstawiania
// na stronę. Plik o nazwie, która już jest, zastępuje poprzedni.
$('#pliki-zasoby').addEventListener('change', async (e) => {
  const pliki = [...e.target.files];
  const { zasoby } = stan.projekt;
  for (const plik of pliki) {
    const dataUrl = await new Promise((ok, blad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => blad(r.error); r.readAsDataURL(plik); });
    const id = Object.keys(zasoby).find((k) => zasoby[k].nazwa === plik.name) || uid('z');
    zasoby[id] = { nazwa: plik.name, dataUrl };
  }
  e.target.value = '';
  if (!pliki.length) return;
  stan.miniatury.clear();
  generujMiniatury();
  zaplanujZapis();
  powiadom(`Wgrano ${pliki.length} ${pliki.length === 1 ? 'obraz' : 'obrazy/obrazów'}. W tabeli wpisz ich nazwy plików.`);
});

// Pole wyboru pliku czyścimy dopiero po wczytaniu – wyczyszczenie wcześniej
// potrafi unieważnić plik, zanim zostanie odczytany.
$('#plik-obraz').addEventListener('change', async (e) => {
  const plik = e.target.files[0];
  if (plik) await wstawObraz(plik);
  e.target.value = '';
});
$('#plik-projekt').addEventListener('change', async (e) => {
  const plik = e.target.files[0];
  if (plik) await wczytajPlikProjektu(plik);
  e.target.value = '';
});

const kontener = $('#kontener-plotna');
kontener.addEventListener('dragover', (e) => e.preventDefault());
kontener.addEventListener('drop', (e) => {
  e.preventDefault();
  for (const plik of e.dataTransfer.files) {
    if (plik.type.startsWith('image/')) wstawObraz(plik);
    else if (/\.(seriodruk|json)$/i.test(plik.name)) wczytajPlikProjektu(plik);
  }
});

$('#nazwa-projektu').addEventListener('change', (e) => {
  stan.projekt.nazwa = e.target.value.trim() || 'Bez nazwy';
  e.target.value = stan.projekt.nazwa;
  document.title = `${stan.projekt.nazwa} – ${NAZWA}`;
  zaplanujZapis();
});
$('#nazwa-projektu').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

// ---------- Zdarzenia edytora ----------

edytor.addEventListener('zaznaczenie', (e) => {
  const obj = e.detail;
  $('#akcje-obiektu').hidden = !obj || obj.type === 'activeSelection';
  panel.pokaz(obj);
});
edytor.addEventListener('zmiana', zaplanujZapis);
edytor.addEventListener('schowek', () => { if (!edytor.aktywny) panel.zbuduj(); });
edytor.addEventListener('ostrzezenia', (e) => renderujOstrzezenia(e.detail));
edytor.addEventListener('zoom', (e) => {
  $('#wartosc-zoom').textContent = `${Math.round(e.detail * 100)}%`;
});
edytor.addEventListener('strona', (e) => wybierzStroneArkusza(e.detail));
edytor.addEventListener('prowadnice', zaplanujZapis);
edytor.addEventListener('historia', () => {
  $('[data-akcja="cofnij"]').disabled = !edytor.moznaCofnac;
  $('[data-akcja="ponow"]').disabled = !edytor.moznaPonowic;
});

// ---------- Skróty klawiszowe ----------

// Alt przy zaznaczonym elemencie: odległości do sąsiadów i krawędzi strony.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt' && document.body.dataset.ekran === 'edytor' && !$('dialog[open]')) { e.preventDefault(); edytor.pokazPomiary(true); }
});
document.addEventListener('keyup', (e) => { if (e.key === 'Alt') edytor.pokazPomiary(false); });
window.addEventListener('blur', () => edytor.pokazPomiary(false));

const kontekstSkrotow = {
  edytor,
  widok: menuWidoku,
  zapisz: () => zapiszTeraz().then(() => synchronizuj()),
  wstawObraz: () => $('#plik-obraz').click(),
  przelaczProwadnice: () => akcje.prowadnice(),
  podglad: () => pokazPodglad(),
  strona: (o) => przejdzDoStrony(stan.indeks + o),
  nowaStrona: () => dodajStrone(),
  pomoc: () => instrukcja.otworzRozdzial('Skróty klawiszowe'),
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') zamknijMenu();
  if (document.body.dataset.ekran === 'podglad' && e.key === 'Escape' && !$('dialog[open]')) { zamknijPodglad(); return; }
  if (document.body.dataset.ekran !== 'edytor' || $('dialog[open]')) return;
  const cel = e.target;
  const wPolu = Boolean(cel !== document.body && cel.closest('input, textarea:not([data-fabric-hiddentextarea]), select, [contenteditable]'));
  const wEdycji = Boolean(edytor.aktywny?.isEditing);
  if (e.code === 'Space' && !wPolu && !wEdycji) { e.preventDefault(); edytor.ustawReke(true); return; }
  obsluzKlawisz(e, kontekstSkrotow, { wPolu, wEdycji });
});
document.addEventListener('keyup', (e) => { if (e.code === 'Space') edytor.ustawReke(false); });
window.addEventListener('blur', () => edytor.ustawReke(false));

// Dokument nie ma się przewijać (ekrany przewijają się w środku). Przeglądarka
// na telefonie potrafi go jednak przesunąć sama, np. gdy fokus dostaje pole
// tekstowe – a użytkownik nie ma jak go cofnąć. Wracamy wtedy na miejsce.
function dokumentNaMiejsce() {
  const pole = document.activeElement;
  if (pole && /^(INPUT|TEXTAREA|SELECT)$/.test(pole.tagName)) return; // klawiatura ekranowa w użyciu
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  if (document.body.scrollTop || document.body.scrollLeft) { document.body.scrollTop = 0; document.body.scrollLeft = 0; }
}
window.addEventListener('scroll', dokumentNaMiejsce, { passive: true });
document.body.addEventListener('scroll', dokumentNaMiejsce, { passive: true });
document.addEventListener('focusout', () => setTimeout(dokumentNaMiejsce, 150));

window.addEventListener('online', () => zaplanujChmure(500));
window.addEventListener('offline', () => { if (stan.projekt && stan.uzytkownik) stanZapisu('offline', 'Offline – zapisano na urządzeniu'); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && stan.projekt) zapiszTeraz();
});
window.addEventListener('beforeunload', () => {
  if (stan.timerZapisu && stan.projekt) zapiszBiezacyCel();
});
let timerOkna = null;
window.addEventListener('resize', () => {
  clearTimeout(timerOkna);
  timerOkna = setTimeout(() => edytor.canvas.calcOffset(), 150);
});

// ======================================================================
// Start
// ======================================================================

async function start() {
  wstawIkony();
  konto.inicjuj();

  // Link do udostępnionego podglądu działa bez logowania i bez edytora.
  if (trasa.odczytaj().ekran === 'udostepnione') {
    await pokazUdostepniony(trasa.odczytaj());
    return;
  }
  stan.czcionki = zaladujCzcionki();

  if (!chmura.chmuraSkonfigurowana()) {
    pokazEkran('logowanie');
    return;
  }
  // Powrót z linku w e-mailu (potwierdzenie konta, reset hasła, zmiana adresu)
  // odczytujemy, zanim biblioteka Supabase wyczyści adres.
  const powrot = konto.odczytajPowrot();
  try {
    await chmura.naZmianeSesji((uzytkownik, zdarzenie) => {
      if (zdarzenie === 'SIGNED_OUT') {
        if (!['logowanie', 'start'].includes(document.body.dataset.ekran)) {
          stan.uzytkownik = null;
          stan.projekt = null;
          konto.ustawTryb('logowanie');
          pokazEkran('logowanie');
        }
      } else if (uzytkownik && stan.uzytkownik && uzytkownik.id === stan.uzytkownik.id) {
        // Odświeżony token albo zmienione dane konta (np. potwierdzony nowy e-mail).
        stan.uzytkownik = uzytkownik;
        odswiezNaglowek();
        if (document.body.dataset.ekran === 'konto') konto.wypelnijUstawienia();
      }
    });
    const uzytkownik = await chmura.biezacyUzytkownik();
    if (powrot.blad) {
      pokazEkran('logowanie');
      konto.komunikat(powrot.blad);
    } else if (powrot.typ === 'recovery' && uzytkownik) {
      stan.uzytkownik = uzytkownik;
      konto.ustawTryb('nowe-haslo');
      pokazEkran('logowanie');
    } else if (uzytkownik) {
      await poZalogowaniu(uzytkownik); // otwiera adres z paska (np. odświeżony projekt)
      if (powrot.typ === 'signup') powiadom('Konto potwierdzone. Witaj w Seriodruku!');
      if (powrot.typ === 'email_change') powiadom('Adres e-mail został zmieniony.');
    } else {
      pokazEkran('logowanie');
    }
  } catch (e) {
    pokazEkran('logowanie');
    konto.komunikat(`Nie można połączyć się z serwerem: ${chmura.komunikatBledu(e)}`);
  }
}

// ---------- Aplikacja instalowana (PWA) ----------

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker:', e));
}

// Pliki .seriodruk otwierane z systemu (zainstalowana aplikacja na komputerze).
// Wczytujemy je dopiero po zalogowaniu.
const plikiDoOtwarcia = [];
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async (params) => {
    for (const uchwyt of params.files || []) plikiDoOtwarcia.push(await uchwyt.getFile());
    if (stan.uzytkownik || stan.trybLokalny) otworzOczekujacePliki();
  });
}
async function otworzOczekujacePliki() {
  while (plikiDoOtwarcia.length) await wczytajPlikProjektu(plikiDoOtwarcia.shift());
}

start().catch((e) => {
  console.error(e);
  pokazEkran('logowanie');
  konto.komunikat(`Błąd startu: ${e.message}`);
});

// Dostęp z konsoli i dla skryptu zrzutów ekranu.
window.seriodruk = {
  stan, edytor, opisObiektu, instrukcja, poZalogowaniu, pokazProjekty, otworzProjekt,
  przejdzDoStrony, edytujWzorzec, otworzUstawieniaSekcji, domyslneStyle, zapiszTeraz, dane,
};
