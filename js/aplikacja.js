/* global fabric */
// Główny plik aplikacji: ekrany (logowanie → projekty → edytor), zapis, dialogi.

import {
  FORMATY, nowyProjekt, nowaStrona, nowaSekcja, nowyWzorzec, normalizuj, kopiujStrone, kopiujWzorzec,
  uporzadkujStrony, sekcjaStrony, wzorzecStrony, zmienneStrony, stronyZWzorcem,
  WZORZEC_Z_SEKCJI, BEZ_WZORCA,
} from './projekt.js';
import {
  Edytor, podmienZasoby, opisObiektu, wstawZmienne,
} from './edytor.js';
import { PanelWlasciwosci } from './wlasciwosci.js';
import { zaladujCzcionki } from './czcionki.js';
import {
  zapiszLokalnie, wczytajLokalnie, listaLokalnych, usunLokalnie, oznaczZsynchronizowany,
} from './lokalny.js';
import * as chmura from './chmura.js';
import { ikona, wstawIkony } from './ikony.js';
import { Instrukcja } from './instrukcja.js';
import { zapiszPlikProjektu, wczytajPlikProjektu as odczytajPlik, ROZSZERZENIE } from './plik-projektu.js';
import {
  $, $$, powiadom, potwierdz, zapytajONazwe, zamknijMenu, przelaczMenu, pobierz, bezpiecznaNazwa, kiedy,
} from './ui.js';
import { NAZWA } from './marka.js';


const OPIS_OSTRZEZEN = {
  poza_strona: 'Poza stroną – nie będzie widoczny w druku.',
  poza_spadem: 'Wychodzi poza spad – część zostanie ucięta.',
  w_marginesie: 'Wchodzi w margines – może zostać przycięty.',
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
//   #/p/<id projektu>                projekt (pierwsza strona)
//   #/p/<id projektu>/s/<id strony>  konkretna strona
//   #/p/<id projektu>/w/<id wzorca>  edycja wzorca

const trasa = {
  odczytaj() {
    const [rodzaj, id, typ, cel] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (rodzaj === 'p' && id) return { ekran: 'projekt', id, strona: typ === 's' ? cel : null, wzorzec: typ === 'w' ? cel : null };
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
    if (!stan.uzytkownik && !stan.trybLokalny) return;
    const t = trasa.odczytaj();
    if (t.ekran === 'projekty') {
      if (stan.projekt) await doProjektow(); else if (document.body.dataset.ekran !== 'projekty') await pokazProjekty();
      return;
    }
    if (stan.projekt?.id === t.id) {
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
  }).catch((e) => console.error(e));
  return obslugaTrasy;
}

window.addEventListener('popstate', () => przejdzDoTrasy());

// ======================================================================
// Logowanie
// ======================================================================

// Tylko logowanie. Nie ma rejestracji ani resetu hasła – konto administratora
// zakłada się i resetuje w panelu Supabase (Authentication → Users).
const logowanie = {
  komunikat(tekst) {
    $('#komunikat-logowania').textContent = tekst;
  },

  async wyslij(e) {
    e.preventDefault();
    const f = e.target;
    const email = f.elements.email.value.trim();
    const haslo = f.elements.haslo.value;
    if (!/^\S+@\S+\.\S+$/.test(email)) { this.komunikat('Podaj poprawny adres e-mail.'); return; }
    if (!haslo) { this.komunikat('Podaj hasło.'); return; }
    const przycisk = $('#przycisk-logowania');
    przycisk.disabled = true;
    try {
      const u = await chmura.zalogujHaslem(email, haslo);
      f.elements.haslo.value = '';
      this.komunikat('');
      if (document.body.dataset.ekran === 'logowanie') await poZalogowaniu(u);
    } catch (err) {
      this.komunikat(chmura.komunikatBledu(err));
    } finally {
      przycisk.disabled = false;
    }
  },

  inicjuj() {
    $('#form-logowania').addEventListener('submit', (e) => this.wyslij(e));
    $('#pokaz-haslo').addEventListener('click', (e) => {
      const input = $('#form-logowania').elements.haslo;
      const widac = input.type === 'text';
      input.type = widac ? 'password' : 'text';
      e.currentTarget.innerHTML = ikona(widac ? 'oko' : 'okoOff');
      e.currentTarget.setAttribute('aria-label', widac ? 'Pokaż hasło' : 'Ukryj hasło');
    });
    $('#tryb-lokalny').addEventListener('click', () => {
      stan.trybLokalny = true;
      poZalogowaniu(null);
    });
    if (!chmura.chmuraSkonfigurowana()) {
      $('#brak-konfiguracji').hidden = false;
      $('#form-logowania').querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
    }
  },
};

async function poZalogowaniu(uzytkownik) {
  stan.uzytkownik = uzytkownik;
  $('#awatar').textContent = (uzytkownik?.email || '?')[0].toUpperCase();
  $('#email-uzytkownika').textContent = uzytkownik
    ? `Zalogowano jako ${uzytkownik.email}`
    : 'Tryb bez konta – projekty tylko w tej przeglądarce';
  const wyl = $('[data-akcja="wyloguj"]');
  wyl.lastChild.textContent = uzytkownik ? 'Wyloguj' : 'Przejdź do logowania';
  await przejdzDoTrasy();
  if (document.body.dataset.ekran === 'start' || document.body.dataset.ekran === 'logowanie') await pokazProjekty();
  if (plikiDoOtwarcia.length) await otworzOczekujacePliki();
  else instrukcja.otworzJesliNowa(uzytkownik?.id || 'lokalny');
}

async function wyloguj() {
  zamknijMenu();
  if (stan.projekt) await zapiszTeraz();
  stan.projekt = null;
  if (stan.uzytkownik) {
    try { await chmura.wyloguj(); } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
  }
  stan.uzytkownik = null;
  stan.trybLokalny = false;
  logowanie.komunikat('');
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
        <button role="menuitem" data-op="nazwa">${ikona('tekst')}Zmień nazwę</button>
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
      if (op === 'nazwa') await zmienNazweProjektu(w);
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
  const projekt = nowyProjekt(f.elements.nazwa.value.trim() || 'Nowy projekt', {
    format: FORMATY[format] ? format : 'wlasny',
    szerokosc_mm: Math.max(20, w),
    wysokosc_mm: Math.max(20, h),
    spad_mm: Math.max(0, Number(f.elements.spad_mm.value) || 0),
    marginesy_mm: Math.max(0, Number(f.elements.marginesy_mm.value) || 0),
    znaki_ciecia: true,
  });
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
});

const biezacaStrona = () => stan.projekt.strony[stan.indeks];
const biezacyWzorzec = () => stan.projekt.wzorce.find((w) => w.id === stan.idWzorca);
const biezacyCel = () => (stan.tryb === 'wzorzec' ? biezacyWzorzec() : biezacaStrona());
const biezacaSekcja = () => sekcjaStrony(stan.projekt, biezacaStrona());

function wydrukCelu() {
  return stan.tryb === 'wzorzec' ? biezacyWzorzec().wydruk : biezacaSekcja().wydruk;
}

function nazwaFormatu(w, pelny = false) {
  const standard = Boolean(FORMATY[w.format]);
  const orient = standard && w.szerokosc_mm > w.wysokosc_mm ? ' poziomo' : '';
  if (!pelny) return standard ? `${w.format}${orient}` : `${w.szerokosc_mm}×${w.wysokosc_mm} mm`;
  return `${standard ? `${w.format}${orient}` : 'Format własny'} – ${w.szerokosc_mm} × ${w.wysokosc_mm} mm, spad ${w.spad_mm} mm, marginesy ${w.marginesy_mm} mm.`;
}

// Tło strony: własne albo (gdy nie ustawione) z wzorca.
function tloStrony(strona) {
  return strona.tlo || wzorzecStrony(stan.projekt, strona)?.tlo || '#ffffff';
}

function wzorzecDlaEdytora(strona) {
  const w = wzorzecStrony(stan.projekt, strona);
  return w ? { obiekty: w.obiekty, zmienne: zmienneStrony(stan.projekt, strona) } : null;
}

function odswiezPasekEdytora() {
  const wz = stan.tryb === 'wzorzec';
  document.body.classList.toggle('tryb-wzorca', wz);
  $('#pasek-wzorca').hidden = !wz;
  if (wz) {
    const w = biezacyWzorzec();
    const n = stronyZWzorcem(stan.projekt, w.id).length;
    $('#pasek-wzorca-tekst').textContent = `Edytujesz wzorzec „${w.nazwa}” · ${n ? `widoczny na ${n} ${n === 1 ? 'stronie' : 'stronach'}` : 'nieużywany'}`;
    $('#opis-formatu').textContent = `Wzorzec · ${w.wydruk.szerokosc_mm}×${w.wydruk.wysokosc_mm}`;
  } else {
    $('#opis-formatu').textContent = `${biezacaSekcja().nazwa} · ${nazwaFormatu(biezacaSekcja().wydruk)}`;
  }
  $('#przycisk-format').disabled = wz;
}

// Wczytuje bieżący cel do edytora; dopasowuje widok, gdy zmienił się rozmiar.
async function zaladujCel({ dopasuj = false } = {}) {
  const wydruk = wydrukCelu();
  const poprzedni = edytor.wydruk;
  const innyRozmiar = !poprzedni || ['szerokosc_mm', 'wysokosc_mm', 'spad_mm'].some((k) => poprzedni[k] !== wydruk[k]);
  edytor.ustawWydruk(wydruk);
  const cel = biezacyCel();
  if (stan.tryb === 'wzorzec') {
    await edytor.wczytajStrone({ obiekty: cel.obiekty, tlo: cel.tlo || '#ffffff' }, stan.projekt.zasoby, null);
  } else {
    await edytor.wczytajStrone({ obiekty: cel.obiekty, tlo: tloStrony(cel) }, stan.projekt.zasoby, wzorzecDlaEdytora(cel));
  }
  if (dopasuj || innyRozmiar) edytor.dopasujDoOkna();
  odswiezPasekEdytora();
  renderujListe();
  trasa.ustaw(`p/${stan.projekt.id}/${stan.tryb === 'wzorzec' ? `w/${cel.id}` : `s/${cel.id}`}`, { zastap: true });
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

async function doProjektow() {
  if (stan.projekt) await zapiszTeraz();
  stan.projekt = null;
  document.title = NAZWA;
  pokazProjekty();
}

// Przepisuje płótno do bieżącego celu (strony lub wzorca).
function zapiszBiezacyCel() {
  if (!stan.projekt) return;
  const cel = biezacyCel();
  if (!cel) return;
  cel.obiekty = edytor.obiektyStrony();
  const tlo = edytor.canvas.backgroundColor || '#ffffff';
  if (stan.tryb === 'strona') {
    // Tło „z wzorca” zostaje puste, dopóki użytkownik go nie zmieni.
    const zWzorca = wzorzecStrony(stan.projekt, cel)?.tlo || '#ffffff';
    if (cel.tlo || tlo !== zWzorca) cel.tlo = tlo;
  } else {
    cel.tlo = tlo;
    // Strony z tym wzorcem trzeba przerysować.
    for (const s of stronyZWzorcem(stan.projekt, cel.id)) stan.miniatury.delete(s.id);
  }
  stan.miniatury.set(cel.id, edytor.miniatura(200));
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
  odswiezMiniature(biezacyCel()?.id);
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

async function synchronizuj() {
  const p = stan.projekt;
  if (!stan.uzytkownik || !p) return;
  if (!navigator.onLine) {
    stanZapisu('offline', 'Offline – zapisano na urządzeniu');
    return;
  }
  const wersja = p.zmieniono;
  try {
    await chmura.zapiszWChmurze(p);
    await zapiszLokalnie(p, wlasciciel(), p.zmieniono !== wersja);
    await oznaczZsynchronizowany(p.id, wersja);
    if (stan.projekt === p && !stan.timerZapisu) stanZapisu('ok', 'Zapisano');
  } catch (e) {
    stanZapisu('blad', `Nie wysłano: ${chmura.komunikatBledu(e)}`);
  }
}

// ---------- Panel: strona i wzorzec ----------

function panelStrony(p) {
  const strona = biezacaStrona();
  const sekcja = biezacaSekcja();
  const s = p.sekcja('Strona');
  s.append(p.tekst('Nazwa strony', () => strona.nazwa, (v) => {
    strona.nazwa = v || strona.nazwa;
    renderujListe();
    zaplanujZapis();
  }, true, false));

  const sel = p.wybor('Sekcja', stan.projekt.sekcje.map((x) => [x.id, x.nazwa]), () => strona.sekcja, (v) => przeniesStroneDoSekcji(strona, v));
  sel.classList.add('szeroki');
  s.append(sel);

  const opcjeWzorca = [
    [WZORZEC_Z_SEKCJI, `Jak w sekcji (${stan.projekt.wzorce.find((w) => w.id === sekcja.wzorzec)?.nazwa || 'bez wzorca'})`],
    [BEZ_WZORCA, 'Bez wzorca'],
    ...stan.projekt.wzorce.map((w) => [w.id, w.nazwa]),
  ];
  const wz = p.wybor('Wzorzec', opcjeWzorca, () => strona.wzorzec, async (v) => {
    zapiszBiezacyCel();
    strona.wzorzec = v;
    stan.miniatury.delete(strona.id);
    await zaladujCel();
    zaplanujZapis();
  });
  wz.classList.add('szeroki');
  s.append(wz);

  s.append(p.kolor('Tło', () => edytor.canvas.backgroundColor || '#ffffff', (v) => edytor.ustawTlo(v), { bezZatwierdzania: true }));

  const f = p.sekcja(`Sekcja „${sekcja.nazwa}”`);
  f.append(p.wskazowka(nazwaFormatu(sekcja.wydruk, true)));
  f.append(p.akcje([['format', 'Ustawienia sekcji', () => otworzUstawieniaSekcji(sekcja.id)]]));

  p.legendaProwadnic();
}

function panelWzorca(p) {
  const w = biezacyWzorzec();
  const s = p.sekcja('Wzorzec');
  s.append(p.tekst('Nazwa wzorca', () => w.nazwa, (v) => {
    w.nazwa = v || w.nazwa;
    renderujListe();
    odswiezPasekEdytora();
    zaplanujZapis();
  }, true, false));
  s.append(p.kolor('Tło stron', () => edytor.canvas.backgroundColor || '#ffffff', (v) => edytor.ustawTlo(v), { bezZatwierdzania: true }));
  s.append(p.wskazowka('Elementy wzorca pojawiają się pod treścią każdej strony, która go używa. Na stronach nie da się ich przypadkiem zaznaczyć ani przesunąć.'));

  const u = p.sekcja('Gdzie jest używany');
  for (const sek of stan.projekt.sekcje) {
    u.append(p.przelacznik(`Domyślny w sekcji „${sek.nazwa}”`, () => sek.wzorzec === w.id, (v) => {
      sek.wzorzec = v ? w.id : (sek.wzorzec === w.id ? null : sek.wzorzec);
      for (const st of stan.projekt.strony) if (st.sekcja === sek.id) stan.miniatury.delete(st.id);
      odswiezPasekEdytora();
      zaplanujZapis();
    }));
  }
  u.append(p.wskazowka('Pojedynczym stronom możesz też wybrać wzorzec w ich właściwościach.'));

  const r = p.sekcja('Rozmiar');
  const opis = p.wskazowka('');
  const odswiezOpis = () => { opis.textContent = nazwaFormatu(w.wydruk, true); };
  odswiezOpis();
  r.append(opis);
  const dopasuj = p.wybor('Ustaw rozmiar jak w sekcji', [['', '— wybierz sekcję —'], ...stan.projekt.sekcje.map((x) => [x.id, x.nazwa])], () => '', async (v) => {
    const sek = stan.projekt.sekcje.find((x) => x.id === v);
    if (!sek) return;
    zapiszBiezacyCel();
    w.wydruk = { ...sek.wydruk };
    await zaladujCel({ dopasuj: true });
    zaplanujZapis();
  });
  dopasuj.classList.add('szeroki');
  r.append(dopasuj);

  const z = p.sekcja('Numer strony i inne zmienne');
  const lista = document.createElement('ul');
  lista.className = 'lista-zmiennych szeroki';
  lista.innerHTML = [
    ['{nr}', 'numer strony w całym projekcie'],
    ['{nr_w_sekcji}', 'numer strony w jej sekcji'],
    ['{liczba_stron}', 'liczba wszystkich stron'],
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
  $('#liczba-stron').textContent = projekt.strony.length;
  for (const sekcja of projekt.sekcje) {
    const strony = projekt.strony.filter((s) => s.sekcja === sekcja.id);
    const nag = document.createElement('li');
    nag.className = 'sekcja-listy';
    nag.innerHTML = `<div class="opis-sekcji"><strong></strong><small></small></div>
      <button class="przycisk-ikona maly" aria-label="Opcje sekcji" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 18 })}</button>`;
    $('strong', nag).textContent = sekcja.nazwa;
    const wz = projekt.wzorce.find((w) => w.id === sekcja.wzorzec);
    $('small', nag).textContent = `${nazwaFormatu(sekcja.wydruk)} · ${strony.length} str.${wz ? ` · ${wz.nazwa}` : ''}`;
    $('button', nag).addEventListener('click', (e) => { e.stopPropagation(); otworzMenuSekcji(e.currentTarget, sekcja.id); });
    lista.append(nag);
    if (!strony.length) {
      const pusto = document.createElement('li');
      pusto.className = 'sekcja-pusta';
      pusto.innerHTML = '<button class="link">+ Dodaj pierwszą stronę</button>';
      $('button', pusto).addEventListener('click', () => dodajStrone(sekcja.id));
      lista.append(pusto);
    }
    for (const s of strony) {
      const i = projekt.strony.indexOf(s);
      const aktywna = stan.tryb === 'strona' && i === stan.indeks;
      const li = document.createElement('li');
      li.className = `strona${aktywna ? ' aktywna' : ''}`;
      li.dataset.id = s.id;
      li.innerHTML = `<span class="numer">${i + 1}</span>
        <button class="miniatura" aria-label="Strona ${i + 1}"></button>
        <span class="nazwa"></span>
        <button class="przycisk-ikona menu-miniatury" aria-label="Opcje strony" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 18 })}</button>`;
      if (aktywna) $('.miniatura', li).setAttribute('aria-current', 'page');
      $('.miniatura', li).append(obrazMiniatury(s.id, sekcja.wydruk));
      $('.nazwa', li).textContent = s.nazwa;
      $('.miniatura', li).addEventListener('click', () => przejdzDoStrony(projekt.strony.indexOf(s)));
      $('.miniatura', li).addEventListener('dblclick', () => zmienNazweStrony(projekt.strony.indexOf(s)));
      $('.menu-miniatury', li).addEventListener('click', (e) => {
        e.stopPropagation();
        otworzMenuStrony(e.currentTarget, projekt.strony.indexOf(s));
      });
      lista.append(li);
    }
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

// Miniatury renderowane leniwie poza ekranem (strony z wzorcem pod spodem).
let generowanie = null;
function generujMiniatury() {
  if (generowanie) return;
  generowanie = (async () => {
    const projekt = stan.projekt;
    const cele = [...projekt.strony, ...projekt.wzorce];
    for (const cel of cele) {
      if (stan.projekt !== projekt) break;
      if (stan.miniatury.has(cel.id)) continue;
      await new Promise((ok) => (window.requestIdleCallback || setTimeout)(ok));
      if (stan.projekt !== projekt || stan.miniatury.has(cel.id)) continue;
      stan.miniatury.set(cel.id, await renderujMiniature(cel, projekt));
      odswiezMiniature(cel.id);
    }
  })().finally(() => { generowanie = null; });
}

function podstawZmienneWJson(obiekty, zmienne) {
  return obiekty.map((o) => {
    const k = { ...o };
    if (typeof k.text === 'string') k.text = wstawZmienne(k.text, zmienne);
    if (Array.isArray(k.objects)) k.objects = podstawZmienneWJson(k.objects, zmienne);
    return k;
  });
}

async function renderujMiniature(cel, projekt, szerokoscPx = 200) {
  const jestWzorcem = projekt.wzorce.includes(cel);
  const wydruk = jestWzorcem ? cel.wydruk : sekcjaStrony(projekt, cel).wydruk;
  const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: b } = wydruk;
  const k = szerokoscPx / (w + 2 * b);
  const sc = new fabric.StaticCanvas(null, {
    width: Math.round((w + 2 * b) * k),
    height: Math.round((h + 2 * b) * k),
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  let obiekty = cel.obiekty;
  let tlo = cel.tlo || '#ffffff';
  if (!jestWzorcem) {
    const wz = wzorzecStrony(projekt, cel);
    if (wz) obiekty = [...podstawZmienneWJson(wz.obiekty, zmienneStrony(projekt, cel)), ...cel.obiekty];
    tlo = cel.tlo || wz?.tlo || '#ffffff';
  }
  const zrodla = podmienZasoby(obiekty, (id) => projekt.zasoby[id]?.dataUrl || '');
  await new Promise((ok) => sc.loadFromJSON({ objects: zrodla, backgroundColor: tlo }, ok));
  sc.setViewportTransform([k, 0, 0, k, b * k, b * k]);
  sc.renderAll();
  const url = sc.toDataURL({ format: 'png' });
  sc.dispose();
  return url;
}

// ---------- Strony ----------

async function przejdzDoStrony(i) {
  if (i < 0 || i >= stan.projekt.strony.length) return;
  if (stan.tryb === 'strona' && i === stan.indeks) return;
  zapiszBiezacyCel();
  stan.tryb = 'strona';
  stan.indeks = i;
  await zaladujCel();
  if (document.body.dataset.panel === 'strony') ustawPanel('');
}

async function dodajStrone(idSekcji = null) {
  zapiszBiezacyCel();
  const { projekt } = stan;
  const sekcja = idSekcji || biezacaSekcja().id;
  const nowa = nowaStrona(`Strona ${projekt.strony.length + 1}`, sekcja);
  nowa.tlo = null;
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
function przesunStrone(i, kierunek) {
  const strony = stan.projekt.strony;
  const j = i + kierunek;
  if (j < 0 || j >= strony.length || strony[j].sekcja !== strony[i].sekcja) return;
  zapiszBiezacyCel();
  const biezaca = biezacaStrona();
  [strony[i], strony[j]] = [strony[j], strony[i]];
  stan.indeks = strony.indexOf(biezaca);
  for (const s of strony) if (wzorzecStrony(stan.projekt, s)) stan.miniatury.delete(s.id); // numery stron
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
  const istniejaca = stan.projekt.sekcje.find((s) => s.id === id);
  const wzor = istniejaca || biezacaSekcja();
  const w = wzor.wydruk;
  dlg.dataset.id = id || '';
  $('#tytul-sekcji').textContent = istniejaca ? 'Ustawienia sekcji' : 'Nowa sekcja';
  $('#zapisz-sekcje').textContent = istniejaca ? 'Zapisz' : 'Dodaj sekcję';
  f.elements.nazwa.value = istniejaca ? istniejaca.nazwa : `Sekcja ${stan.projekt.sekcje.length + 1}`;
  const sel = f.elements.format;
  sel.replaceChildren();
  for (const [nazwa, [sz, wy]] of Object.entries(FORMATY)) sel.add(new Option(`${nazwa} (${sz} × ${wy} mm)`, nazwa));
  sel.add(new Option('Własny', 'wlasny'));
  sel.value = FORMATY[w.format] ? w.format : 'wlasny';
  f.elements.szerokosc_mm.value = w.szerokosc_mm;
  f.elements.wysokosc_mm.value = w.wysokosc_mm;
  f.elements.spad_mm.value = w.spad_mm;
  f.elements.marginesy_mm.value = w.marginesy_mm;
  f.elements.znaki_ciecia.checked = Boolean(w.znaki_ciecia);
  const wz = f.elements.wzorzec;
  wz.replaceChildren(new Option('Bez wzorca', ''));
  for (const x of stan.projekt.wzorce) wz.add(new Option(x.nazwa, x.id));
  wz.value = istniejaca?.wzorzec || '';
  dlg.returnValue = '';
  dlg.showModal();
  f.elements.nazwa.focus();
}

function wykryjFormat(sz, wy) {
  for (const [nazwa, [a, b]] of Object.entries(FORMATY)) {
    if ((a === sz && b === wy) || (a === wy && b === sz)) return nazwa;
  }
  return 'wlasny';
}

async function zatwierdzSekcje() {
  const dlg = $('#dlg-sekcja');
  const f = dlg.querySelector('form');
  const liczba = (n) => Math.max(0, parseFloat(String(f.elements[n].value).replace(',', '.')) || 0);
  const sz = Math.max(20, liczba('szerokosc_mm'));
  const wy = Math.max(20, liczba('wysokosc_mm'));
  const wydruk = {
    format: wykryjFormat(sz, wy),
    szerokosc_mm: sz,
    wysokosc_mm: wy,
    spad_mm: liczba('spad_mm'),
    marginesy_mm: Math.min(liczba('marginesy_mm'), Math.min(sz, wy) / 2 - 1),
    znaki_ciecia: f.elements.znaki_ciecia.checked,
  };
  const nazwa = f.elements.nazwa.value.trim() || 'Sekcja';
  const wzorzec = f.elements.wzorzec.value || null;
  zapiszBiezacyCel();
  const { projekt } = stan;
  let sekcja = projekt.sekcje.find((s) => s.id === dlg.dataset.id);
  if (sekcja) {
    Object.assign(sekcja, { nazwa, wydruk, wzorzec });
    for (const s of projekt.strony) if (s.sekcja === sekcja.id) stan.miniatury.delete(s.id);
  } else {
    sekcja = { ...nowaSekcja(nazwa, wydruk), wzorzec };
    const i = projekt.sekcje.indexOf(biezacaSekcja());
    projekt.sekcje.splice(i + 1, 0, sekcja);
    const strona = nowaStrona(`Strona ${projekt.strony.length + 1}`, sekcja.id);
    strona.tlo = null;
    projekt.strony.push(strona);
    uporzadkujStrony(projekt);
    stan.tryb = 'strona';
    stan.indeks = projekt.strony.indexOf(strona);
    ustawZakladke('strony');
  }
  await zaladujCel();
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
  // Pierwszy wzorzec od razu jako domyślny dla bieżącej sekcji, jeśli nie ma żadnego.
  if (!sekcja.wzorzec) {
    sekcja.wzorzec = w.id;
    powiadom(`Wzorzec będzie widoczny na stronach sekcji „${sekcja.nazwa}”. Zmienisz to w panelu z prawej.`);
  }
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
  for (const s of projekt.sekcje) if (s.wzorzec === id) s.wzorzec = null;
  for (const s of projekt.strony) if (s.wzorzec === id) s.wzorzec = WZORZEC_Z_SEKCJI;
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
  wyloguj,
  'importuj-projekt': () => { zamknijMenu(); $('#plik-projekt').click(); },
  'do-projektow': doProjektow,
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
  usun: () => edytor.usun(),
  prowadnice: () => {
    edytor.pokazProwadnice = !edytor.pokazProwadnice;
    $('#przycisk-prowadnice').setAttribute('aria-pressed', String(edytor.pokazProwadnice));
    edytor.canvas.requestRenderAll();
  },
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
$('#naglowek-ostrzezen').addEventListener('click', (e) => {
  const b = e.currentTarget;
  b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'));
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
edytor.addEventListener('ostrzezenia', (e) => renderujOstrzezenia(e.detail));
edytor.addEventListener('zoom', (e) => { $('#wartosc-zoom').textContent = `${Math.round(e.detail * 100)}%`; });
edytor.addEventListener('historia', () => {
  $('[data-akcja="cofnij"]').disabled = !edytor.moznaCofnac;
  $('[data-akcja="ponow"]').disabled = !edytor.moznaPonowic;
});

// ---------- Skróty klawiszowe ----------

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') zamknijMenu();
  if (document.body.dataset.ekran !== 'edytor') return;
  const cel = e.target;
  const wPolu = cel !== document.body && cel.closest('input, textarea, select, [contenteditable]');
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault();
    zapiszTeraz().then(() => synchronizuj());
    return;
  }
  if (wPolu || edytor.aktywny?.isEditing || $('dialog[open]')) return;
  const k = e.key.toLowerCase();
  if (mod && k === 'z') { e.preventDefault(); (e.shiftKey ? edytor.ponow() : edytor.cofnij()); return; }
  if (mod && k === 'y') { e.preventDefault(); edytor.ponow(); return; }
  if (mod && k === 'd') { e.preventDefault(); edytor.duplikuj(); return; }
  if (mod && k === 'g') { e.preventDefault(); (e.shiftKey ? edytor.rozgrupuj() : edytor.grupuj()); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); edytor.usun(); return; }
  if (e.key === 'Escape') { edytor.canvas.discardActiveObject(); edytor.canvas.requestRenderAll(); return; }
  const krok = e.shiftKey ? 10 : (e.altKey ? 0.1 : 1);
  const strzalki = { ArrowLeft: [-krok, 0], ArrowRight: [krok, 0], ArrowUp: [0, -krok], ArrowDown: [0, krok] };
  if (strzalki[e.key] && edytor.aktywny) { e.preventDefault(); edytor.przesun(...strzalki[e.key]); return; }
  if (mod) return;
  if (k === 't') edytor.dodajTekst();
  else if (k === 'r') edytor.dodajProstokat();
  else if (k === 'e') edytor.dodajElipse();
  else if (k === 'l') edytor.dodajLinie();
  else if (e.key === 'PageUp') przejdzDoStrony(stan.indeks - 1);
  else if (e.key === 'PageDown') przejdzDoStrony(stan.indeks + 1);
});

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
  logowanie.inicjuj();
  stan.czcionki = zaladujCzcionki();

  if (!chmura.chmuraSkonfigurowana()) {
    pokazEkran('logowanie');
    return;
  }
  try {
    await chmura.naZmianeSesji((uzytkownik, zdarzenie) => {
      if (zdarzenie === 'SIGNED_OUT' && document.body.dataset.ekran !== 'logowanie') {
        stan.uzytkownik = null;
        pokazEkran('logowanie');
      } else if (uzytkownik) {
        stan.uzytkownik = uzytkownik;
      }
    });
    const uzytkownik = await chmura.biezacyUzytkownik();
    if (uzytkownik) await poZalogowaniu(uzytkownik); // otwiera adres z paska (np. odświeżony projekt)
    else pokazEkran('logowanie');
  } catch (e) {
    pokazEkran('logowanie');
    logowanie.komunikat(`Nie można połączyć się z serwerem: ${chmura.komunikatBledu(e)}`);
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
  logowanie.komunikat(`Błąd startu: ${e.message}`);
});

// Dostęp z konsoli i dla skryptu zrzutów ekranu.
window.seriodruk = {
  stan, edytor, opisObiektu, instrukcja, poZalogowaniu, pokazProjekty, otworzProjekt,
  przejdzDoStrony, edytujWzorzec, otworzUstawieniaSekcji,
};
