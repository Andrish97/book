/* global fabric */
// Główny plik aplikacji: projekt, strony, zapis, dialogi.

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

const $ = (sel) => document.querySelector(sel);
const KLUCZ_OSTATNI = 'publisher-lite:ostatni-projekt';
const OPIS_OSTRZEZEN = {
  poza_strona: 'Poza stroną – nie będzie widoczny',
  poza_spadem: 'Wychodzi poza spad – zostanie ucięty',
  w_marginesie: 'Wchodzi w margines lub spad',
};

const stan = {
  projekt: null,
  indeks: 0,
  miniatury: new Map(), // id strony -> dataUrl
  uzytkownik: null,
  timerZapisu: null,
  timerChmury: null,
  zapisywanie: Promise.resolve(),
};

const edytor = new Edytor($('#plotno'), $('#kontener-plotna'));
const panel = new PanelWlasciwosci($('#wlasciwosci'), $('#tytul-wlasciwosci'), edytor, {
  strona: () => biezacaStrona(),
  onStrona: (zmiana) => {
    Object.assign(biezacaStrona(), zmiana);
    renderujListeStron();
    zaplanujZapis();
  },
});

const biezacaStrona = () => stan.projekt.strony[stan.indeks];

// ---------- Status ----------

function status(tekst, blad = false) {
  const el = $('#status');
  el.textContent = tekst;
  el.classList.toggle('blad', blad);
  el.title = tekst;
}

function godzina() {
  return new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

// ---------- Projekt ----------

async function otworzProjekt(p) {
  stan.projekt = normalizuj(p);
  stan.indeks = 0;
  stan.miniatury.clear();
  try { localStorage.setItem(KLUCZ_OSTATNI, stan.projekt.id); } catch { /* tryb prywatny */ }
  $('#nazwa-projektu').value = stan.projekt.nazwa;
  document.title = `${stan.projekt.nazwa} – Publisher-lite`;
  edytor.ustawWydruk(stan.projekt.wydruk);
  await edytor.wczytajStrone(biezacaStrona(), stan.projekt.zasoby);
  edytor.dopasujDoOkna();
  renderujListeStron();
  generujMiniatury();
}

function zapiszBiezacaStrone() {
  const s = biezacaStrona();
  s.obiekty = edytor.obiektyStrony();
  s.tlo = edytor.canvas.backgroundColor || '#ffffff';
  stan.miniatury.set(s.id, edytor.miniatura());
}

function zaplanujZapis() {
  status('Niezapisane zmiany…');
  clearTimeout(stan.timerZapisu);
  stan.timerZapisu = setTimeout(zapiszTeraz, 600);
}

async function zapiszTeraz() {
  clearTimeout(stan.timerZapisu);
  zapiszBiezacaStrone();
  odswiezMiniature(stan.indeks);
  stan.projekt.zmieniono = new Date().toISOString();
  stan.zapisywanie = stan.zapisywanie.then(async () => {
    try {
      await zapiszLokalnie(stan.projekt, true);
      status(`Zapisano lokalnie ${godzina()}`);
      zaplanujChmure();
    } catch (e) {
      status(`Błąd zapisu lokalnego: ${e.message}`, true);
    }
  });
  return stan.zapisywanie;
}

function zaplanujChmure(opoznienie = 4000) {
  if (!stan.uzytkownik) return;
  clearTimeout(stan.timerChmury);
  stan.timerChmury = setTimeout(synchronizuj, opoznienie);
}

async function synchronizuj() {
  if (!stan.uzytkownik || !stan.projekt) return;
  if (!navigator.onLine) {
    status('Offline – zmiany zapisane lokalnie, wyślę po powrocie sieci');
    return;
  }
  const p = stan.projekt;
  const wersja = p.zmieniono;
  try {
    status('Wysyłanie do chmury…');
    await chmura.zapiszWChmurze(p);
    // zapiszWChmurze uzupełnia ścieżki zasobów – utrwalamy je lokalnie.
    await zapiszLokalnie(p, p.zmieniono !== wersja);
    await oznaczZsynchronizowany(p.id, wersja);
    status(`Zsynchronizowano ${godzina()}`);
  } catch (e) {
    status(`Chmura: ${e.message}`, true);
  }
}

async function nowy() {
  if (stan.projekt) await zapiszTeraz();
  const nazwa = prompt('Nazwa nowego projektu:', 'Nowy projekt');
  if (nazwa === null) return;
  zamknijDialogi();
  await otworzProjekt(nowyProjekt(nazwa.trim() || 'Nowy projekt'));
  await zapiszTeraz();
}

// ---------- Strony ----------

async function przejdzDoStrony(i) {
  if (i === stan.indeks || i < 0 || i >= stan.projekt.strony.length) return;
  zapiszBiezacaStrone();
  stan.indeks = i;
  await edytor.wczytajStrone(biezacaStrona(), stan.projekt.zasoby);
  renderujListeStron();
  if (document.body.dataset.panel === 'strony') ustawPanel('');
}

function renderujListeStron() {
  const lista = $('#lista-stron');
  lista.replaceChildren();
  const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: b } = stan.projekt.wydruk;
  stan.projekt.strony.forEach((s, i) => {
    const li = document.createElement('li');
    li.dataset.indeks = i;
    li.classList.toggle('aktywna', i === stan.indeks);
    li.setAttribute('aria-current', i === stan.indeks ? 'page' : 'false');
    const mini = stan.miniatury.get(s.id);
    let obraz;
    if (mini) {
      obraz = document.createElement('img');
      obraz.src = mini;
      obraz.alt = '';
    } else {
      obraz = document.createElement('div');
      obraz.className = 'brak-miniatury';
    }
    obraz.style.aspectRatio = `${w + 2 * b} / ${h + 2 * b}`;
    const podpis = document.createElement('div');
    podpis.className = 'podpis';
    podpis.innerHTML = '<span class="numer"></span><span class="nazwa"></span>';
    podpis.querySelector('.numer').textContent = i + 1;
    podpis.querySelector('.nazwa').textContent = s.nazwa;
    li.title = `${s.nazwa} – dwuklik zmienia nazwę`;
    li.append(obraz, podpis);
    li.addEventListener('click', () => przejdzDoStrony(i));
    li.addEventListener('dblclick', () => zmienNazweStrony(i));
    lista.append(li);
  });
}

function odswiezMiniature(i) {
  const s = stan.projekt.strony[i];
  const li = $(`#lista-stron li[data-indeks="${i}"]`);
  const mini = stan.miniatury.get(s.id);
  if (!li || !mini) return;
  const stary = li.firstElementChild;
  if (stary.tagName === 'IMG') {
    stary.src = mini;
  } else {
    const img = document.createElement('img');
    img.src = mini;
    img.alt = '';
    img.style.aspectRatio = stary.style.aspectRatio;
    stary.replaceWith(img);
  }
}

// Miniatury pozostałych stron renderowane leniwie poza ekranem (4.7 – wydajność).
async function generujMiniatury() {
  const projekt = stan.projekt;
  for (let i = 0; i < projekt.strony.length; i += 1) {
    if (stan.projekt !== projekt) return;
    const s = projekt.strony[i];
    if (stan.miniatury.has(s.id)) continue;
    await new Promise((ok) => (window.requestIdleCallback || setTimeout)(ok));
    stan.miniatury.set(s.id, await renderujMiniature(s, projekt));
    const idx = projekt.strony.indexOf(s);
    if (idx >= 0) odswiezMiniature(idx);
  }
}

async function renderujMiniature(strona, projekt, szerokoscPx = 160) {
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
  zaplanujZapis();
}

async function duplikujStrone() {
  zapiszBiezacaStrone();
  const zrodlo = biezacaStrona();
  const kopia = kopiujStrone(zrodlo, `${zrodlo.nazwa} (kopia)`);
  stan.miniatury.set(kopia.id, stan.miniatury.get(zrodlo.id));
  stan.projekt.strony.splice(stan.indeks + 1, 0, kopia);
  stan.indeks += 1;
  await edytor.wczytajStrone(kopia, stan.projekt.zasoby);
  renderujListeStron();
  zaplanujZapis();
}

async function usunStrone() {
  if (stan.projekt.strony.length <= 1) {
    alert('Projekt musi mieć co najmniej jedną stronę.');
    return;
  }
  const s = biezacaStrona();
  if (!confirm(`Usunąć stronę „${s.nazwa}”?`)) return;
  stan.projekt.strony.splice(stan.indeks, 1);
  stan.miniatury.delete(s.id);
  stan.indeks = Math.min(stan.indeks, stan.projekt.strony.length - 1);
  await edytor.wczytajStrone(biezacaStrona(), stan.projekt.zasoby);
  renderujListeStron();
  zaplanujZapis();
}

function przesunStrone(kierunek) {
  const i = stan.indeks;
  const j = i + kierunek;
  const strony = stan.projekt.strony;
  if (j < 0 || j >= strony.length) return;
  zapiszBiezacaStrone();
  [strony[i], strony[j]] = [strony[j], strony[i]];
  stan.indeks = j;
  renderujListeStron();
  zaplanujZapis();
}

function zmienNazweStrony(i) {
  const s = stan.projekt.strony[i];
  const nazwa = prompt('Nazwa strony:', s.nazwa);
  if (!nazwa || !nazwa.trim()) return;
  s.nazwa = nazwa.trim();
  renderujListeStron();
  if (i === stan.indeks) panel.zbuduj();
  zaplanujZapis();
}

// ---------- Ostrzeżenia ----------

function renderujOstrzezenia(lista) {
  const ul = $('#lista-ostrzezen');
  ul.replaceChildren();
  for (const licznik of [$('#licznik-ostrzezen'), $('#licznik-ostrzezen-mobilny')]) {
    licznik.textContent = lista.length;
    licznik.classList.toggle('sa', lista.length > 0);
  }
  if (!lista.length) {
    const li = document.createElement('li');
    li.className = 'brak';
    li.textContent = 'Brak ostrzeżeń na tej stronie.';
    ul.append(li);
    return;
  }
  for (const o of lista) {
    const li = document.createElement('li');
    const opis = document.createElement('span');
    opis.className = 'opis';
    opis.textContent = `${o.obiekt}: ${OPIS_OSTRZEZEN[o.typ]}`;
    opis.title = 'Pokaż obiekt';
    opis.addEventListener('click', () => edytor.zaznacz(o.id));
    const wycisz = document.createElement('button');
    wycisz.textContent = 'Wycisz';
    wycisz.title = 'Celowe wyjście poza margines – nie pokazuj więcej dla tego obiektu';
    wycisz.addEventListener('click', () => {
      const obj = edytor.canvas.getObjects().find((x) => x.id === o.id);
      if (!obj) return;
      obj.bez_ostrzezen = true;
      edytor.oznaczZmiane();
      panel.odswiez();
    });
    li.append(opis, wycisz);
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
  for (const [nazwa, [sz, wy]] of Object.entries(FORMATY)) {
    sel.add(new Option(`${nazwa} (${sz} × ${wy} mm)`, nazwa));
  }
  sel.add(new Option('Własny', 'wlasny'));
  sel.value = FORMATY[w.format] ? w.format : 'wlasny';
  f.elements.szerokosc_mm.value = w.szerokosc_mm;
  f.elements.wysokosc_mm.value = w.wysokosc_mm;
  f.elements.spad_mm.value = w.spad_mm;
  f.elements.marginesy_mm.value = w.marginesy_mm;
  f.elements.znaki_ciecia.checked = Boolean(w.znaki_ciecia);
  dlg.showModal();
}

function ustawFormatZPolaWyboru() {
  const f = $('#dlg-wydruk form');
  const wymiary = FORMATY[f.elements.format.value];
  if (!wymiary) return;
  // Zachowujemy orientację, jeśli użytkownik ją obrócił.
  const poziomo = Number(f.elements.szerokosc_mm.value) > Number(f.elements.wysokosc_mm.value);
  const [a, b] = wymiary;
  f.elements.szerokosc_mm.value = poziomo ? Math.max(a, b) : a;
  f.elements.wysokosc_mm.value = poziomo ? Math.min(a, b) : b;
}

function wykryjFormat(sz, wy) {
  for (const [nazwa, [a, b]] of Object.entries(FORMATY)) {
    if ((a === sz && b === wy) || (a === wy && b === sz)) return nazwa;
  }
  return 'wlasny';
}

async function zatwierdzWydruk() {
  const f = $('#dlg-wydruk form');
  const liczba = (n) => Math.max(0, parseFloat(f.elements[n].value) || 0);
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
  stan.miniatury.clear();
  renderujListeStron();
  generujMiniatury();
  zaplanujZapis();
}

// ---------- Lista projektów ----------

async function otworzDialogProjektow() {
  const dlg = $('#dlg-projekty');
  const ul = $('#lista-projektow');
  ul.replaceChildren();
  dlg.showModal();
  const zapisywanie = zapiszTeraz();
  await zapisywanie;

  const wpisy = new Map();
  for (const l of await listaLokalnych()) wpisy.set(l.id, { ...l, lokalnie: true });
  if (stan.uzytkownik) {
    try {
      for (const c of await chmura.listaWChmurze()) {
        const w = wpisy.get(c.id) || { id: c.id, nazwa: c.nazwa };
        w.wChmurze = c.zmieniono;
        wpisy.set(c.id, w);
      }
    } catch (e) {
      status(`Chmura: ${e.message}`, true);
    }
  }
  const posortowane = [...wpisy.values()].sort((a, b) => (
    String(b.zmieniono || b.wChmurze).localeCompare(String(a.zmieniono || a.wChmurze))));

  if (!posortowane.length) {
    const li = document.createElement('li');
    li.textContent = 'Brak zapisanych projektów.';
    ul.append(li);
  }
  for (const w of posortowane) {
    const li = document.createElement('li');
    li.classList.toggle('biezacy', w.id === stan.projekt.id);
    const info = document.createElement('div');
    info.className = 'info';
    const nazwa = document.createElement('strong');
    nazwa.textContent = w.nazwa || 'Bez nazwy';
    const kiedy = document.createElement('small');
    const data = new Date(w.zmieniono || w.wChmurze);
    kiedy.textContent = data.toLocaleString('pl-PL');
    const miejsca = [];
    if (w.lokalnie) miejsca.push(w.doSynchronizacji && stan.uzytkownik ? 'lokalnie (niewysłany)' : 'lokalnie');
    if (w.wChmurze) miejsca.push('w chmurze');
    for (const m of miejsca) {
      const z = document.createElement('span');
      z.className = 'znacznik';
      z.textContent = m;
      kiedy.append(z);
    }
    info.append(nazwa, kiedy);

    const otworz = document.createElement('button');
    otworz.textContent = 'Otwórz';
    otworz.disabled = w.id === stan.projekt.id;
    otworz.addEventListener('click', () => otworzZListy(w));
    const usun = document.createElement('button');
    usun.textContent = 'Usuń';
    usun.className = 'niebezpieczny';
    usun.addEventListener('click', async () => {
      if (!confirm(`Usunąć projekt „${w.nazwa}”${w.wChmurze ? ' (także z chmury)' : ''}? Tego nie można cofnąć.`)) return;
      try {
        if (w.lokalnie) await usunLokalnie(w.id);
        if (w.wChmurze) await chmura.usunZChmury(w.id);
      } catch (e) {
        alert(`Nie udało się usunąć: ${e.message}`);
      }
      if (w.id === stan.projekt.id) await otworzProjekt(nowyProjekt());
      otworzDialogProjektow();
    });
    li.append(info, otworz, usun);
    ul.append(li);
  }
}

async function otworzZListy(w) {
  try {
    let projekt = null;
    const lokalny = w.lokalnie ? (await wczytajLokalnie(w.id))?.projekt : null;
    // Wybieramy nowszą wersję (lokalna wygrywa przy remisie i niewysłanych zmianach).
    const chmuraNowsza = w.wChmurze && (!lokalny || (!w.doSynchronizacji && w.wChmurze > (lokalny.zmieniono || '')));
    if (chmuraNowsza) {
      status('Pobieranie z chmury…');
      projekt = await chmura.wczytajZChmury(w.id);
      await zapiszLokalnie(normalizuj(projekt), false);
    } else {
      projekt = lokalny;
    }
    zamknijDialogi();
    await otworzProjekt(projekt);
    status(`Otwarto „${stan.projekt.nazwa}”`);
  } catch (e) {
    alert(`Nie udało się otworzyć projektu: ${e.message}`);
  }
}

// ---------- Chmura (Supabase) ----------

function renderujDialogChmury() {
  const el = $('#tresc-chmury');
  el.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = 'Chmura (Supabase)';
  el.append(h);
  const akapit = (tekst, klasa) => {
    const p = document.createElement('p');
    if (klasa) p.className = klasa;
    p.textContent = tekst;
    el.append(p);
    return p;
  };
  const przyciski = document.createElement('div');
  przyciski.className = 'przyciski-dialogu';
  const zamknij = document.createElement('button');
  zamknij.textContent = 'Zamknij';
  zamknij.addEventListener('click', zamknijDialogi);

  if (!chmura.chmuraSkonfigurowana()) {
    akapit('Supabase nie jest jeszcze skonfigurowany. Projekty są zapisywane tylko w tej przeglądarce i w pobranych plikach JSON.');
    akapit('Aby włączyć chmurę: ustaw sekrety SUPABASE_* w repozytorium i zrób push na main – workflow zastosuje migracje i wpisze adres oraz klucz przy deployu (szczegóły w README).', 'podpowiedz');
    przyciski.append(zamknij);
    el.append(przyciski);
    return;
  }

  if (!stan.uzytkownik) {
    akapit('Zaloguj się, aby projekty synchronizowały się między tabletem, telefonem i komputerem. Wyślemy link logowania na e-mail.');
    const label = document.createElement('label');
    label.textContent = 'E-mail';
    const email = document.createElement('input');
    email.type = 'email';
    email.autocomplete = 'email';
    email.required = true;
    label.append(email);
    el.append(label);
    const info = akapit('', 'podpowiedz');
    const wyslij = document.createElement('button');
    wyslij.className = 'glowny';
    wyslij.textContent = 'Wyślij link';
    wyslij.addEventListener('click', async () => {
      if (!email.value.includes('@')) { info.textContent = 'Podaj poprawny adres e-mail.'; return; }
      wyslij.disabled = true;
      try {
        await chmura.wyslijLinkLogowania(email.value.trim());
        info.textContent = 'Wysłano. Otwórz link z wiadomości na tym urządzeniu.';
      } catch (e) {
        info.textContent = `Błąd: ${e.message}`;
        wyslij.disabled = false;
      }
    });
    przyciski.append(zamknij, wyslij);
    el.append(przyciski);
    return;
  }

  akapit(`Zalogowano jako ${stan.uzytkownik.email}. Zmiany są wysyłane automatycznie kilka sekund po edycji.`);
  const wyloguj = document.createElement('button');
  wyloguj.textContent = 'Wyloguj';
  wyloguj.addEventListener('click', async () => {
    try { await chmura.wyloguj(); } catch (e) { alert(e.message); }
    zamknijDialogi();
  });
  const teraz = document.createElement('button');
  teraz.className = 'glowny';
  teraz.textContent = 'Wyślij teraz';
  teraz.addEventListener('click', async () => {
    await zapiszTeraz();
    await synchronizuj();
    zamknijDialogi();
  });
  przyciski.append(wyloguj, zamknij, teraz);
  el.append(przyciski);
}

function ustawUzytkownika(u) {
  const zmiana = (u?.id || null) !== (stan.uzytkownik?.id || null);
  stan.uzytkownik = u;
  const b = $('#przycisk-chmura');
  b.classList.toggle('zalogowany', Boolean(u));
  b.textContent = u ? 'Chmura ✓' : 'Chmura';
  if (zmiana && u && stan.projekt) zaplanujChmure(500);
}

async function inicjujChmure() {
  if (!chmura.chmuraSkonfigurowana()) return;
  try {
    ustawUzytkownika(await chmura.biezacyUzytkownik());
    await chmura.naZmianeSesji(ustawUzytkownika);
  } catch (e) {
    status(`Chmura niedostępna: ${e.message}`, true);
  }
}

// ---------- Pliki ----------

function pobierz(nazwa, url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nazwa;
  document.body.append(a);
  a.click();
  a.remove();
}

const bezpiecznaNazwa = (s) => (s || 'projekt').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'projekt';

async function pobierzJson() {
  await zapiszTeraz();
  // Plik zawiera wszystko, łącznie z obrazami (dataUrl), więc da się go
  // otworzyć na innym urządzeniu bez dostępu do chmury.
  const zasoby = Object.fromEntries(Object.entries(stan.projekt.zasoby)
    .map(([id, { sciezka, ...z }]) => [id, z]));
  const blob = new Blob([JSON.stringify({ ...stan.projekt, zasoby }, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa)}.json`, url);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function wczytajPlikProjektu(plik) {
  try {
    const dane = JSON.parse(await plik.text());
    const projekt = normalizuj(dane);
    const istniejacy = await wczytajLokalnie(projekt.id);
    if (istniejacy && !confirm(`Projekt „${istniejacy.nazwa}” jest już zapisany w tej przeglądarce. Zastąpić go wersją z pliku?`)) {
      projekt.id = crypto.randomUUID();
    }
    await zapiszBiezacaStroneJesliTrzeba();
    await otworzProjekt(projekt);
    await zapiszTeraz();
    status(`Wczytano „${projekt.nazwa}” z pliku`);
  } catch (e) {
    alert(`Nie udało się wczytać pliku: ${e.message}`);
  }
}

async function zapiszBiezacaStroneJesliTrzeba() {
  if (stan.projekt) await zapiszTeraz();
}

async function wstawObraz(plik) {
  if (!plik.type.startsWith('image/')) {
    alert('To nie jest plik obrazu.');
    return;
  }
  try {
    const dataUrl = await chmura.blobNaDataUrl(plik);
    await edytor.dodajObraz(dataUrl, plik.name, stan.projekt.zasoby);
  } catch (e) {
    alert(e.message);
  }
}

// ---------- Panele (telefon) ----------

function ustawPanel(nazwa) {
  document.body.dataset.panel = document.body.dataset.panel === nazwa ? '' : nazwa;
  document.querySelectorAll('.zakladki-mobilne button').forEach((b) => {
    b.classList.toggle('aktywny', b.dataset.panel === document.body.dataset.panel);
  });
}

function zamknijDialogi() {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
}

// ---------- Akcje ----------

const akcje = {
  nowy,
  otworz: otworzDialogProjektow,
  'wczytaj-plik': () => $('#plik-projekt').click(),
  'pobierz-json': pobierzJson,
  wydruk: otworzDialogWydruku,
  png: () => pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa)}-s${stan.indeks + 1}.png`, edytor.png(150)),
  chmura: () => { renderujDialogChmury(); $('#dlg-chmura').showModal(); },
  'zamknij-dialog': zamknijDialogi,
  'zamknij-panel': () => ustawPanel(''),
  'obroc-format': () => {
    const f = $('#dlg-wydruk form');
    [f.elements.szerokosc_mm.value, f.elements.wysokosc_mm.value] = [f.elements.wysokosc_mm.value, f.elements.szerokosc_mm.value];
  },

  'strona-dodaj': dodajStrone,
  'strona-duplikuj': duplikujStrone,
  'strona-usun': usunStrone,
  'strona-gora': () => przesunStrone(-1),
  'strona-dol': () => przesunStrone(1),

  'dodaj-tekst': () => edytor.dodajTekst(),
  'dodaj-prostokat': () => edytor.dodajProstokat(),
  'dodaj-elipse': () => edytor.dodajElipse(),
  'dodaj-linie': () => edytor.dodajLinie(),
  'dodaj-obraz': () => $('#plik-obraz').click(),
  cofnij: () => edytor.cofnij(),
  ponow: () => edytor.ponow(),
  duplikuj: () => edytor.duplikuj(),
  usun: () => edytor.usun(),
  grupuj: () => edytor.grupuj(),
  rozgrupuj: () => edytor.rozgrupuj(),
  'warstwa-wierzch': () => edytor.warstwa('wierzch'),
  'warstwa-wyzej': () => edytor.warstwa('wyzej'),
  'warstwa-nizej': () => edytor.warstwa('nizej'),
  'warstwa-spod': () => edytor.warstwa('spod'),
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

// Przeciągnij i upuść obraz lub projekt na obszar roboczy.
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

$('#prowadnice').addEventListener('change', (e) => {
  edytor.pokazProwadnice = e.target.checked;
  edytor.canvas.requestRenderAll();
});

const dlgWydruk = $('#dlg-wydruk');
dlgWydruk.querySelector('select[name="format"]').addEventListener('change', ustawFormatZPolaWyboru);
for (const n of ['szerokosc_mm', 'wysokosc_mm']) {
  dlgWydruk.querySelector(`[name="${n}"]`).addEventListener('input', () => {
    const f = dlgWydruk.querySelector('form');
    f.elements.format.value = wykryjFormat(Number(f.elements.szerokosc_mm.value), Number(f.elements.wysokosc_mm.value));
  });
}
dlgWydruk.addEventListener('close', () => {
  if (dlgWydruk.returnValue === 'ok') zatwierdzWydruk();
});

// ---------- Zdarzenia edytora ----------

edytor.addEventListener('zaznaczenie', (e) => {
  document.body.classList.toggle('jest-zaznaczenie', Boolean(e.detail));
  panel.pokaz(e.detail);
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
  const cel = e.target;
  const wPolu = cel.closest('input, textarea, select, [contenteditable]') && cel !== document.body;
  const edycjaTekstu = edytor.aktywny?.isEditing;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault();
    zapiszTeraz().then(synchronizuj);
    return;
  }
  if (wPolu || edycjaTekstu || document.querySelector('dialog[open]')) return;
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
  else if (k === 'pageup') przejdzDoStrony(stan.indeks - 1);
  else if (k === 'pagedown') przejdzDoStrony(stan.indeks + 1);
});

window.addEventListener('online', () => zaplanujChmure(500));
window.addEventListener('beforeunload', () => {
  if (stan.timerZapisu) zapiszBiezacaStrone();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && stan.projekt) zapiszTeraz();
});

let timerOkna = null;
window.addEventListener('resize', () => {
  clearTimeout(timerOkna);
  timerOkna = setTimeout(() => edytor.canvas.calcOffset(), 150);
});

// ---------- Start ----------

async function start() {
  status('Wczytywanie czcionek…');
  await zaladujCzcionki();
  let projekt = null;
  try {
    const id = localStorage.getItem(KLUCZ_OSTATNI);
    if (id) projekt = (await wczytajLokalnie(id))?.projekt ?? null;
  } catch { /* brak IndexedDB / tryb prywatny */ }
  await otworzProjekt(projekt || nowyProjekt());
  status(projekt ? `Otwarto „${stan.projekt.nazwa}”` : 'Nowy projekt');
  inicjujChmure();
}

start().catch((e) => {
  console.error(e);
  status(`Błąd startu: ${e.message}`, true);
});

// Dostęp z konsoli przy testach.
window.publisher = { stan, edytor, opisObiektu };
