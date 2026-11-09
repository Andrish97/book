/* global fabric */
// Główny plik aplikacji: ekrany (logowanie → projekty → edytor), zapis, dialogi.

import {
  FORMATY, nowyProjekt, nowaStrona, normalizuj, kopiujStrone,
} from './projekt.js';
import { Edytor, podmienZasoby, opisObiektu } from './edytor.js';
import { PanelWlasciwosci } from './wlasciwosci.js';
import { zaladujCzcionki } from './czcionki.js';
import {
  zapiszLokalnie, wczytajLokalnie, listaLokalnych, usunLokalnie, oznaczZsynchronizowany,
} from './lokalny.js';
import * as chmura from './chmura.js';
import { ikona, wstawIkony } from './ikony.js';
import { Instrukcja } from './instrukcja.js';

const $ = (sel, korzen = document) => korzen.querySelector(sel);
const $$ = (sel, korzen = document) => [...korzen.querySelectorAll(sel)];

const OPIS_OSTRZEZEN = {
  poza_strona: 'Poza stroną – nie będzie widoczny w druku.',
  poza_spadem: 'Wychodzi poza spad – część zostanie ucięta.',
  w_marginesie: 'Wchodzi w margines – może zostać przycięty.',
};

const stan = {
  uzytkownik: null,
  trybLokalny: false,
  projekt: null,
  indeks: 0,
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

let timerPowiadomienia = null;
function powiadom(tekst, blad = false) {
  const el = $('#powiadomienie');
  el.textContent = tekst;
  el.classList.toggle('blad', blad);
  el.hidden = false;
  clearTimeout(timerPowiadomienia);
  timerPowiadomienia = setTimeout(() => { el.hidden = true; }, blad ? 6000 : 3000);
}

function potwierdz(tytul, tresc, tak = 'OK', niebezpieczne = false) {
  const dlg = $('#dlg-potwierdz');
  $('#potwierdz-tytul').textContent = tytul;
  $('#potwierdz-tresc').textContent = tresc;
  const b = $('#potwierdz-tak');
  b.textContent = tak;
  b.style.background = niebezpieczne ? 'var(--blad)' : '';
  b.style.borderColor = niebezpieczne ? 'var(--blad)' : '';
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((ok) => dlg.addEventListener('close', () => ok(dlg.returnValue === 'tak'), { once: true }));
}

function zapytajONazwe(tytul, etykieta, wartosc) {
  const dlg = $('#dlg-nazwa');
  $('#nazwa-tytul').textContent = tytul;
  $('#nazwa-etykieta').textContent = etykieta;
  const input = dlg.querySelector('input');
  input.value = wartosc;
  dlg.returnValue = '';
  dlg.showModal();
  input.select();
  return new Promise((ok) => dlg.addEventListener('close', () => {
    const v = input.value.trim();
    ok(dlg.returnValue === 'tak' && v ? v : null);
  }, { once: true }));
}

function zamknijMenu() {
  $$('.menu').forEach((m) => { m.hidden = true; });
  $$('[aria-haspopup="menu"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

function przelaczMenu(przycisk, menu) {
  const bylo = !menu.hidden;
  zamknijMenu();
  if (bylo) return;
  menu.hidden = false;
  przycisk.setAttribute('aria-expanded', 'true');
}

document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.menu, [aria-haspopup="menu"]')) zamknijMenu();
});

function pobierz(nazwa, url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nazwa;
  document.body.append(a);
  a.click();
  a.remove();
}

const bezpiecznaNazwa = (s) => (s || 'projekt').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'projekt';

function kiedy(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const roznica = (Date.now() - d.getTime()) / 1000;
  if (roznica < 60) return 'przed chwilą';
  if (roznica < 3600) return `${Math.floor(roznica / 60)} min temu`;
  const dzis = new Date();
  if (d.toDateString() === dzis.toDateString()) return `dziś, ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: d.getFullYear() === dzis.getFullYear() ? undefined : 'numeric' });
}

function odmianaProjektow(n) {
  if (n === 1) return 'projekt';
  const j = n % 10; const d = n % 100;
  return j >= 2 && j <= 4 && (d < 10 || d >= 20) ? 'projekty' : 'projektów';
}

// ======================================================================
// Logowanie
// ======================================================================

const logowanie = {
  tryb: 'logowanie',

  ustawTryb(tryb) {
    this.tryb = tryb;
    const f = $('#form-logowania');
    const teksty = {
      logowanie: ['Zaloguj się', 'Projekty są zapisywane na Twoim koncie i dostępne na każdym urządzeniu.', 'Zaloguj się', 'current-password'],
      rejestracja: ['Utwórz konto', 'Podaj e-mail i hasło (co najmniej 6 znaków). Wyślemy wiadomość z linkiem potwierdzającym.', 'Utwórz konto', 'new-password'],
      reset: ['Nowe hasło', 'Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła.', 'Wyślij link', 'off'],
      'nowe-haslo': ['Ustaw nowe hasło', 'Wpisz nowe hasło do swojego konta.', 'Zapisz hasło', 'new-password'],
    }[tryb];
    $('#tytul-logowania').textContent = teksty[0];
    $('#opis-logowania').textContent = teksty[1];
    $('#przycisk-logowania').textContent = teksty[2];
    f.elements.haslo.autocomplete = teksty[3];
    $('#pole-haslo').hidden = tryb === 'reset';
    $('#pole-haslo > span').textContent = tryb === 'nowe-haslo' ? 'Nowe hasło' : 'Hasło';
    f.elements.email.closest('.pole').hidden = tryb === 'nowe-haslo';
    $('[data-tryb="reset"]').hidden = tryb !== 'logowanie';
    $('[data-tryb="rejestracja"]').hidden = tryb !== 'logowanie';
    $('[data-tryb="logowanie"]').hidden = tryb === 'logowanie' || tryb === 'nowe-haslo';
    this.komunikat('');
  },

  komunikat(tekst, sukces = false) {
    const k = $('#komunikat-logowania');
    k.textContent = tekst;
    k.classList.toggle('sukces', sukces);
  },

  async wyslij(e) {
    e.preventDefault();
    const f = e.target;
    const email = f.elements.email.value.trim();
    const haslo = f.elements.haslo.value;
    if (this.tryb !== 'nowe-haslo' && !/^\S+@\S+\.\S+$/.test(email)) { this.komunikat('Podaj poprawny adres e-mail.'); return; }
    if (this.tryb !== 'reset' && haslo.length < 6) { this.komunikat('Hasło musi mieć co najmniej 6 znaków.'); return; }
    const przycisk = $('#przycisk-logowania');
    przycisk.disabled = true;
    try {
      if (this.tryb === 'logowanie') {
        const u = await chmura.zalogujHaslem(email, haslo);
        if (document.body.dataset.ekran === 'logowanie') await poZalogowaniu(u);
      } else if (this.tryb === 'rejestracja') {
        const trzebaPotwierdzic = await chmura.zarejestruj(email, haslo);
        if (trzebaPotwierdzic) {
          this.ustawTryb('logowanie');
          this.komunikat(`Wysłaliśmy link na ${email}. Kliknij go, a potem zaloguj się tutaj.`, true);
        }
      } else if (this.tryb === 'reset') {
        await chmura.wyslijResetHasla(email);
        this.komunikat(`Jeśli konto istnieje, link do zmiany hasła jest już w drodze na ${email}.`, true);
      } else if (this.tryb === 'nowe-haslo') {
        await chmura.ustawNoweHaslo(haslo);
        powiadom('Hasło zostało zmienione.');
        this.ustawTryb('logowanie');
        await poZalogowaniu(stan.uzytkownik);
      }
    } catch (err) {
      this.komunikat(chmura.komunikatBledu(err));
    } finally {
      przycisk.disabled = false;
    }
  },

  inicjuj() {
    $('#form-logowania').addEventListener('submit', (e) => this.wyslij(e));
    $$('[data-tryb]').forEach((b) => b.addEventListener('click', () => this.ustawTryb(b.dataset.tryb)));
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
      $$('.linki-logowania button').forEach((b) => { b.disabled = true; });
    }
    this.ustawTryb('logowanie');
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
  await pokazProjekty();
  instrukcja.otworzJesliNowa(uzytkownik?.id || 'lokalny');
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
  logowanie.ustawTryb('logowanie');
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
  const siatka = $('#siatka-projektow');
  siatka.innerHTML = '<li class="karta-projektu szkielet"><div class="okladka"></div><div class="opis"><strong>&nbsp;</strong><small>&nbsp;</small></div></li>'.repeat(3);
  $('#pusto-projekty').hidden = true;
  const wpisy = await wpisyProjektow();
  siatka.replaceChildren();
  $('#pusto-projekty').hidden = wpisy.length > 0;
  $('.projekty-naglowek [data-akcja="nowy-projekt"]').hidden = wpisy.length === 0;
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
        <button role="menuitem" data-op="json">${ikona('pobierz')}Pobierz kopię (JSON)</button>
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
      if (op === 'json') await pobierzJsonProjektu(w);
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

async function pobierzJsonProjektu(w) {
  const projekt = w.id === stan.projekt?.id ? stan.projekt : await wczytajProjektZWpisu(w);
  // Plik zawiera także obrazy, więc otworzy się na każdym urządzeniu.
  const zasoby = Object.fromEntries(Object.entries(projekt.zasoby || {}).map(([id, { sciezka, ...z }]) => [id, z]));
  const blob = new Blob([JSON.stringify({ ...projekt, zasoby }, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  pobierz(`${bezpiecznaNazwa(projekt.nazwa)}.json`, url);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
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
  const projekt = nowyProjekt(f.elements.nazwa.value.trim() || 'Nowy projekt');
  projekt.wydruk = {
    ...projekt.wydruk,
    format: FORMATY[format] ? format : 'wlasny',
    szerokosc_mm: Math.max(20, w),
    wysokosc_mm: Math.max(20, h),
    spad_mm: Math.max(0, Number(f.elements.spad_mm.value) || 0),
    marginesy_mm: Math.max(0, Number(f.elements.marginesy_mm.value) || 0),
  };
  await otworzProjekt(projekt);
  await zapiszTeraz();
});

// ======================================================================
// Edytor
// ======================================================================

const edytor = new Edytor($('#plotno'), $('#kontener-plotna'));
const panel = new PanelWlasciwosci($('#wlasciwosci'), $('#tytul-wlasciwosci'), edytor, {
  strona: () => biezacaStrona(),
  onStrona: (zmiana) => {
    Object.assign(biezacaStrona(), zmiana);
    renderujListeStron();
    zaplanujZapis();
  },
  onFormat: () => otworzDialogWydruku(),
  opisFormatu: () => opisFormatu(true),
});

const biezacaStrona = () => stan.projekt.strony[stan.indeks];

function opisFormatu(pelny = false) {
  const w = stan.projekt?.wydruk;
  if (!w) return '';
  const nazwa = FORMATY[w.format] ? w.format : `${w.szerokosc_mm}×${w.wysokosc_mm} mm`;
  const orient = w.szerokosc_mm > w.wysokosc_mm ? ' poziomo' : '';
  if (!pelny) return `${nazwa}${orient}`;
  return `${nazwa}${orient} – ${w.szerokosc_mm} × ${w.wysokosc_mm} mm, spad ${w.spad_mm} mm, marginesy ${w.marginesy_mm} mm.`;
}

function stanZapisu(rodzaj, tekst) {
  const el = $('#stan-zapisu');
  const ik = { ok: stan.uzytkownik ? 'chmuraOk' : 'chmura', zapis: 'chmura', offline: 'chmuraOff', blad: 'uwaga' }[rodzaj];
  el.className = `stan-zapisu${rodzaj === 'zapis' ? ' zapisuje' : ''}${rodzaj === 'blad' ? ' blad' : ''}`;
  el.innerHTML = `${ikona(ik, { rozmiar: 16 })}<span class="tekst"></span>`;
  $('.tekst', el).textContent = tekst;
  el.title = tekst;
}

async function otworzProjekt(p) {
  await stan.czcionki;
  stan.projekt = normalizuj(p);
  stan.indeks = 0;
  stan.miniatury.clear();
  pokazEkran('edytor');
  $('#nazwa-projektu').value = stan.projekt.nazwa;
  document.title = `${stan.projekt.nazwa} – Publisher-lite`;
  $('#opis-formatu').textContent = opisFormatu();
  edytor.ustawWydruk(stan.projekt.wydruk);
  await edytor.wczytajStrone(biezacaStrona(), stan.projekt.zasoby);
  edytor.dopasujDoOkna();
  renderujListeStron();
  stanZapisu('ok', stan.uzytkownik ? 'Zapisano' : 'Zapisano w przeglądarce');
  generujMiniatury();
}

async function doProjektow() {
  if (stan.projekt) await zapiszTeraz();
  stan.projekt = null;
  document.title = 'Publisher-lite';
  pokazProjekty();
}

function zapiszBiezacaStrone() {
  if (!stan.projekt) return;
  const s = biezacaStrona();
  s.obiekty = edytor.obiektyStrony();
  s.tlo = edytor.canvas.backgroundColor || '#ffffff';
  stan.miniatury.set(s.id, edytor.miniatura(200));
  stan.projekt.miniatura = stan.miniatury.get(stan.projekt.strony[0].id) || stan.projekt.miniatura;
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
  zapiszBiezacaStrone();
  odswiezMiniature(stan.indeks);
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

// ---------- Strony ----------

async function przejdzDoStrony(i) {
  if (i === stan.indeks || i < 0 || i >= stan.projekt.strony.length) return;
  zapiszBiezacaStrone();
  odswiezMiniature(stan.indeks);
  stan.indeks = i;
  await edytor.wczytajStrone(biezacaStrona(), stan.projekt.zasoby);
  renderujListeStron();
  if (document.body.dataset.panel === 'strony') ustawPanel('');
}

function renderujListeStron() {
  const lista = $('#lista-stron');
  lista.replaceChildren();
  const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: b } = stan.projekt.wydruk;
  $('#liczba-stron').textContent = stan.projekt.strony.length;
  stan.projekt.strony.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = `strona${i === stan.indeks ? ' aktywna' : ''}`;
    li.dataset.indeks = i;
    li.innerHTML = `<span class="numer">${i + 1}</span>
      <button class="miniatura" aria-label="Strona ${i + 1}"></button>
      <span class="nazwa"></span>
      <button class="przycisk-ikona menu-miniatury" aria-label="Opcje strony" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej', { rozmiar: 18 })}</button>`;
    if (i === stan.indeks) $('.miniatura', li).setAttribute('aria-current', 'page');
    const mini = stan.miniatury.get(s.id);
    const obraz = document.createElement(mini ? 'img' : 'div');
    if (mini) { obraz.src = mini; obraz.alt = ''; } else obraz.className = 'brak';
    obraz.style.aspectRatio = `${w + 2 * b} / ${h + 2 * b}`;
    $('.miniatura', li).append(obraz);
    $('.nazwa', li).textContent = s.nazwa;
    $('.miniatura', li).addEventListener('click', () => przejdzDoStrony(i));
    $('.miniatura', li).addEventListener('dblclick', () => zmienNazweStrony(i));
    $('.menu-miniatury', li).addEventListener('click', (e) => {
      e.stopPropagation();
      otworzMenuStrony(e.currentTarget, i);
    });
    lista.append(li);
  });
}

function otworzMenuStrony(przycisk, i) {
  const menu = $('#menu-strony');
  const bylo = !menu.hidden && menu.dataset.indeks === String(i);
  zamknijMenu();
  if (bylo) return;
  menu.dataset.indeks = i;
  $('[data-akcja="strona-gora"]', menu).disabled = i === 0;
  $('[data-akcja="strona-dol"]', menu).disabled = i === stan.projekt.strony.length - 1;
  $('[data-akcja="strona-usun"]', menu).disabled = stan.projekt.strony.length <= 1;
  menu.hidden = false;
  const r = przycisk.getBoundingClientRect();
  const mr = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(window.innerWidth - mr.width - 8, Math.max(8, r.left))}px`;
  menu.style.top = `${Math.max(8, Math.min(window.innerHeight - mr.height - 8, r.bottom + 4))}px`;
  przycisk.setAttribute('aria-expanded', 'true');
}

const indeksZMenu = () => Number($('#menu-strony').dataset.indeks);

function odswiezMiniature(i) {
  const s = stan.projekt?.strony[i];
  const mini = s && stan.miniatury.get(s.id);
  const kontenerMini = $(`#lista-stron li[data-indeks="${i}"] .miniatura`);
  if (!kontenerMini || !mini) return;
  const stary = kontenerMini.firstElementChild;
  if (stary?.tagName === 'IMG') { stary.src = mini; return; }
  const img = document.createElement('img');
  img.src = mini;
  img.alt = '';
  img.style.aspectRatio = stary?.style.aspectRatio || '';
  if (stary) stary.replaceWith(img); else kontenerMini.append(img);
}

// Miniatury pozostałych stron renderowane leniwie poza ekranem.
async function generujMiniatury() {
  const projekt = stan.projekt;
  for (let i = 0; i < projekt.strony.length; i += 1) {
    if (stan.projekt !== projekt) return;
    const s = projekt.strony[i];
    if (stan.miniatury.has(s.id)) continue;
    await new Promise((ok) => (window.requestIdleCallback || setTimeout)(ok));
    if (stan.projekt !== projekt) return;
    stan.miniatury.set(s.id, await renderujMiniature(s, projekt));
    const idx = projekt.strony.indexOf(s);
    if (idx >= 0) odswiezMiniature(idx);
  }
}

async function renderujMiniature(strona, projekt, szerokoscPx = 200) {
  const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: b } = projekt.wydruk;
  const k = szerokoscPx / (w + 2 * b);
  const sc = new fabric.StaticCanvas(null, {
    width: Math.round((w + 2 * b) * k),
    height: Math.round((h + 2 * b) * k),
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  const obiekty = podmienZasoby(strona.obiekty, (id) => projekt.zasoby[id]?.dataUrl || '');
  await new Promise((ok) => sc.loadFromJSON({ objects: obiekty, backgroundColor: strona.tlo || '#fff' }, ok));
  sc.setViewportTransform([k, 0, 0, k, b * k, b * k]);
  sc.renderAll();
  const url = sc.toDataURL({ format: 'png' });
  sc.dispose();
  return url;
}

async function dodajStrone() {
  zapiszBiezacaStrone();
  const nowa = nowaStrona(`Strona ${stan.projekt.strony.length + 1}`);
  stan.projekt.strony.splice(stan.indeks + 1, 0, nowa);
  stan.indeks += 1;
  await edytor.wczytajStrone(nowa, stan.projekt.zasoby);
  renderujListeStron();
  $('#lista-stron li.aktywna')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  zaplanujZapis();
}

async function duplikujStrone(i) {
  zapiszBiezacaStrone();
  const zrodlo = stan.projekt.strony[i];
  const kopia = kopiujStrone(zrodlo, `${zrodlo.nazwa} (kopia)`);
  stan.miniatury.set(kopia.id, stan.miniatury.get(zrodlo.id));
  stan.projekt.strony.splice(i + 1, 0, kopia);
  stan.indeks = i + 1;
  await edytor.wczytajStrone(kopia, stan.projekt.zasoby);
  renderujListeStron();
  zaplanujZapis();
}

async function usunStrone(i) {
  if (stan.projekt.strony.length <= 1) return;
  const s = stan.projekt.strony[i];
  if (!await potwierdz(`Usunąć stronę „${s.nazwa}”?`, 'Wszystkie elementy z tej strony zostaną usunięte.', 'Usuń stronę', true)) return;
  zapiszBiezacaStrone();
  stan.projekt.strony.splice(i, 1);
  stan.miniatury.delete(s.id);
  if (i < stan.indeks || stan.indeks >= stan.projekt.strony.length) stan.indeks = Math.max(0, stan.indeks - 1);
  await edytor.wczytajStrone(biezacaStrona(), stan.projekt.zasoby);
  renderujListeStron();
  zaplanujZapis();
}

function przesunStrone(i, kierunek) {
  const j = i + kierunek;
  const strony = stan.projekt.strony;
  if (j < 0 || j >= strony.length) return;
  zapiszBiezacaStrone();
  const biezaca = strony[stan.indeks];
  [strony[i], strony[j]] = [strony[j], strony[i]];
  stan.indeks = strony.indexOf(biezaca);
  renderujListeStron();
  zaplanujZapis();
}

async function zmienNazweStrony(i) {
  const s = stan.projekt.strony[i];
  const nazwa = await zapytajONazwe('Zmień nazwę strony', 'Nazwa strony', s.nazwa);
  if (!nazwa) return;
  s.nazwa = nazwa;
  renderujListeStron();
  if (i === stan.indeks && !edytor.aktywny) panel.zbuduj();
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

// ---------- Format wydruku ----------

function otworzDialogWydruku() {
  const dlg = $('#dlg-wydruk');
  const f = dlg.querySelector('form');
  const w = stan.projekt.wydruk;
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
  dlg.returnValue = '';
  dlg.showModal();
}

function wykryjFormat(sz, wy) {
  for (const [nazwa, [a, b]] of Object.entries(FORMATY)) {
    if ((a === sz && b === wy) || (a === wy && b === sz)) return nazwa;
  }
  return 'wlasny';
}

async function zatwierdzWydruk() {
  const f = $('#dlg-wydruk form');
  const liczba = (n) => Math.max(0, parseFloat(String(f.elements[n].value).replace(',', '.')) || 0);
  const sz = Math.max(20, liczba('szerokosc_mm'));
  const wy = Math.max(20, liczba('wysokosc_mm'));
  stan.projekt.wydruk = {
    ...stan.projekt.wydruk,
    format: wykryjFormat(sz, wy),
    szerokosc_mm: sz,
    wysokosc_mm: wy,
    spad_mm: liczba('spad_mm'),
    marginesy_mm: Math.min(liczba('marginesy_mm'), Math.min(sz, wy) / 2 - 1),
    znaki_ciecia: f.elements.znaki_ciecia.checked,
  };
  zapiszBiezacaStrone();
  edytor.ustawWydruk(stan.projekt.wydruk);
  edytor.dopasujDoOkna();
  $('#opis-formatu').textContent = opisFormatu();
  panel.odswiez();
  stan.miniatury.clear();
  renderujListeStron();
  generujMiniatury();
  zaplanujZapis();
}

const dlgWydruk = $('#dlg-wydruk');
dlgWydruk.querySelector('select[name="format"]').addEventListener('change', () => {
  const f = dlgWydruk.querySelector('form');
  const wym = FORMATY[f.elements.format.value];
  if (!wym) return;
  const poziomo = Number(f.elements.szerokosc_mm.value) > Number(f.elements.wysokosc_mm.value);
  f.elements.szerokosc_mm.value = poziomo ? Math.max(...wym) : wym[0];
  f.elements.wysokosc_mm.value = poziomo ? Math.min(...wym) : wym[1];
});
for (const n of ['szerokosc_mm', 'wysokosc_mm']) {
  dlgWydruk.querySelector(`[name="${n}"]`).addEventListener('input', () => {
    const f = dlgWydruk.querySelector('form');
    f.elements.format.value = wykryjFormat(Number(f.elements.szerokosc_mm.value), Number(f.elements.wysokosc_mm.value));
  });
}
dlgWydruk.addEventListener('close', () => {
  if (dlgWydruk.returnValue === 'ok') zatwierdzWydruk();
});

// ---------- Pliki ----------

async function wczytajPlikProjektu(plik) {
  try {
    const projekt = normalizuj(JSON.parse(await plik.text()));
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

const akcje = {
  'nowy-projekt': otworzNowyProjekt,
  instrukcja: () => instrukcja.otworz(0),
  'zamknij-instrukcje': () => instrukcja.zamknij(),
  wyloguj,
  'wczytaj-plik': () => { zamknijMenu(); $('#plik-projekt').click(); },
  'do-projektow': doProjektow,
  'pobierz-json': () => { zamknijMenu(); pobierzJsonProjektu({ id: stan.projekt.id }); },
  png: () => { zamknijMenu(); pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa)}-s${stan.indeks + 1}.png`, edytor.png(150)); },
  'usun-projekt': async () => {
    zamknijMenu();
    const p = stan.projekt;
    if (await usunProjekt({ id: p.id, nazwa: p.nazwa })) {
      stan.projekt = null;
      pokazProjekty();
    }
  },
  wydruk: otworzDialogWydruku,
  'zamknij-panel': () => ustawPanel(''),
  'obroc-format': () => {
    const f = $('#dlg-wydruk form');
    [f.elements.szerokosc_mm.value, f.elements.wysokosc_mm.value] = [f.elements.wysokosc_mm.value, f.elements.szerokosc_mm.value];
  },

  'strona-dodaj': dodajStrone,
  'strona-nazwa': () => { const i = indeksZMenu(); zamknijMenu(); zmienNazweStrony(i); },
  'strona-duplikuj': () => { const i = indeksZMenu(); zamknijMenu(); duplikujStrone(i); },
  'strona-usun': () => { const i = indeksZMenu(); zamknijMenu(); usunStrone(i); },
  'strona-gora': () => { const i = indeksZMenu(); zamknijMenu(); przesunStrone(i, -1); },
  'strona-dol': () => { const i = indeksZMenu(); zamknijMenu(); przesunStrone(i, 1); },

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

$('#plik-obraz').addEventListener('change', (e) => {
  const plik = e.target.files[0];
  e.target.value = '';
  if (plik) wstawObraz(plik);
});
$('#plik-projekt').addEventListener('change', (e) => {
  const plik = e.target.files[0];
  e.target.value = '';
  if (plik) wczytajPlikProjektu(plik);
});

const kontener = $('#kontener-plotna');
kontener.addEventListener('dragover', (e) => e.preventDefault());
kontener.addEventListener('drop', (e) => {
  e.preventDefault();
  for (const plik of e.dataTransfer.files) {
    if (plik.type.startsWith('image/')) wstawObraz(plik);
    else if (plik.name.endsWith('.json')) wczytajPlikProjektu(plik);
  }
});

$('#nazwa-projektu').addEventListener('change', (e) => {
  stan.projekt.nazwa = e.target.value.trim() || 'Bez nazwy';
  e.target.value = stan.projekt.nazwa;
  document.title = `${stan.projekt.nazwa} – Publisher-lite`;
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
  if (stan.timerZapisu && stan.projekt) zapiszBiezacaStrone();
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
      if (zdarzenie === 'PASSWORD_RECOVERY') {
        stan.uzytkownik = uzytkownik;
        logowanie.ustawTryb('nowe-haslo');
        pokazEkran('logowanie');
      } else if (zdarzenie === 'SIGNED_OUT' && document.body.dataset.ekran !== 'logowanie') {
        stan.uzytkownik = null;
        pokazEkran('logowanie');
      } else if (uzytkownik) {
        stan.uzytkownik = uzytkownik;
      }
    });
    const uzytkownik = await chmura.biezacyUzytkownik();
    if (document.body.dataset.ekran !== 'start') return; // np. odzyskiwanie hasła
    if (uzytkownik) await poZalogowaniu(uzytkownik);
    else pokazEkran('logowanie');
  } catch (e) {
    pokazEkran('logowanie');
    logowanie.komunikat(`Nie można połączyć się z serwerem: ${chmura.komunikatBledu(e)}`);
  }
}

start().catch((e) => {
  console.error(e);
  pokazEkran('logowanie');
  logowanie.komunikat(`Błąd startu: ${e.message}`);
});

// Dostęp z konsoli i dla skryptu zrzutów ekranu.
window.publisher = {
  stan, edytor, opisObiektu, instrukcja, poZalogowaniu, pokazProjekty, otworzProjekt,
};
