// Okno „Obrazy projektu”: jedno miejsce na wszystkie obrazy projektu – wstawione na strony i wgrane tutaj.
// Wczytuje się dopiero przy pierwszym użyciu. Logika plików: js/obrazy-projektu.js.
//
// Dwa tryby: zarządzanie (menu ⋯ → Obrazy projektu, panel obrazu) – zaznaczanie, kopiowanie nazw, zmiana
// nazwy, podmiana pliku, usuwanie; wybór (narzędzie „Obraz”, „Podmień zdjęcie”) – stuknięcie obrazu
// i „Wstaw” albo „Podmień” używa obrazu, który już jest w projekcie, bez kopii.

import {
  $, powiadom, potwierdz, zapytajONazwe, odmiana, zamknijMenu,
} from '../ui.js';
import { wstawIkony } from '../ikony.js';
import { adresZasobu } from '../zasoby.js';
import { kopiaRobocza } from '../obrazy.js';
import { wczytajMiniature, zapiszMiniature } from '../miniatury-obrazow.js';
import { postep } from '../postep.js';
import { rozpakujZip } from '../obrazy-wspolne.js';
import * as chmura from '../chmura.js';
import {
  obrazyProjektu, skrotPliku, takiSam, poNazwie, wolnaNazwa, dodajPlik, uzycia, uzyciaWszystkich, opisUzycia, wHistorii,
  przepnij, komorkiObrazu, przepiszDane, usunObraz, nowaWersja, rozmiarZasobu, powtorzenia,
} from '../obrazy-projektu.js';
import {
  stan, edytor, historia, ustawPanel,
} from './kontekst.js';
import {
  zapiszBiezacyCel, zaladujCel, zaplanujZapis, odlaczPlotno,
} from './zapis.js';
import { generujMiniatury, przejdzDoStrony } from './lista-stron.js';
import { edytujWzorzec } from './wzorce.js';
import { panel } from './skladniki.js';
import { wpiszNazwe, t as tt } from '../jezyk.js';

const okno = $('#dlg-obrazy');
const lista = $('#obrazy-lista');
const plikWgraj = $('#pliki-zasoby');
const plikPodmien = $('#plik-podmiana-okno');
let podmieniany = null; // id obrazu, którego plik podmieniamy
let wybor = null; // tryb wyboru: { etykieta, fn(id) }
const zaznaczone = new Set();
let kotwica = null; // ostatnio kliknięty obraz (zakres z Shift)
let trybZaznaczania = false; // telefon: stuknięcie przełącza zaznaczenie
let przytrzymanie = null;
let przytrzymano = 0;

const mb = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} kB`);
const usunZKonta = (sciezka) => (stan.uzytkownik ? chmura.usunZasobZKonta(sciezka) : null);
const kolejnosc = () => [...lista.querySelectorAll('li[data-id]')].map((li) => li.dataset.id);

// opcje.wybierz: { etykieta: 'Wstaw' | 'Podmień', fn(id) } – tryb wyboru jednego obrazu.
export function otworzObrazy(opcje = {}) {
  wybor = opcje.wybierz || null;
  zaznaczone.clear();
  kotwica = null;
  trybZaznaczania = false;
  okno.classList.toggle('tryb-wyboru', Boolean(wybor));
  $('#obrazy-tytul-tekst').textContent = wybor ? tt('obrazyOkno.wybierzObraz') : tt('obrazyOkno.obrazyProjektu');
  $('#obrazy-wybierz').textContent = wybor?.etykieta || tt('obrazyOkno.wstaw');
  for (const el of okno.querySelectorAll('.tylko-wybor')) el.hidden = !wybor;
  rysuj();
  if (!okno.open) okno.showModal();
}

function rysuj() {
  const p = stan.projekt;
  const obrazy = obrazyProjektu(p);
  for (const id of [...zaznaczone]) if (!p.zasoby[id]) zaznaczone.delete(id);
  lista.replaceChildren();
  miniaturRazem -= kolejkaMiniatur.length; // niezrobione z poprzedniego rysowania nie liczą się do postępu
  kolejkaMiniatur.length = 0;
  let nieuzywane = 0;
  const wszystkie = uzyciaWszystkich(p);
  for (const [id, z] of obrazy) {
    const u = uzycia(p, id, wszystkie);
    if (!u.uzyty) nieuzywane += 1;
    const li = document.createElement('li');
    li.dataset.id = id;
    li.setAttribute('role', 'option');
    li.tabIndex = 0;
    li.classList.toggle('nieuzywany', !u.uzyty);
    li.innerHTML = `
      <label class="obraz-zaznacz"><input type="checkbox" aria-label="Zaznacz obraz"></label>
      <div class="obraz-miniatura"><img alt="" decoding="async"></div>
      <div class="obraz-opis">
        <button type="button" class="obraz-nazwa" data-rola="nazwa" title="Zmień nazwę"></button>
        <span class="obraz-wymiary"></span>
        <span class="obraz-uzycie"></span>
      </div>
      <div class="obraz-akcje">
        <button type="button" class="przycisk-ikona" data-rola="kopiuj" data-ikona="kopiuj" title="Kopiuj nazwę" aria-label="Kopiuj nazwę"></button>
        ${u.pierwsze ? '<button type="button" class="przycisk-ikona" data-rola="pokaz" data-ikona="oko" title="Pokaż na stronie" aria-label="Pokaż na stronie"></button>' : ''}
        <button type="button" class="przycisk-ikona obraz-wiecej" data-rola="wiecej" data-ikona="wiecej" title="Więcej" aria-label="Więcej działań" aria-haspopup="menu" aria-expanded="false"></button>
      </div>`;
    wpiszNazwe(li.querySelector('.obraz-nazwa'), z.nazwa);
    li.querySelector('.obraz-uzycie').textContent = opisUzycia(u);
    li.querySelector('img').alt = z.nazwa;
    const r = rozmiarZasobu(z);
    li.querySelector('.obraz-wymiary').textContent = r ? mb(r) : '';
    lista.append(li);
    pokazMiniature(li, id, z, r);
  }
  wstawIkony(lista);
  $('#obrazy-licznik').textContent = obrazy.length;
  $('#obrazy-pusto').hidden = obrazy.length > 0;
  const b = $('#obrazy-usun-nieuzywane');
  b.hidden = Boolean(wybor) || nieuzywane === 0;
  b.textContent = `Usuń nieużywane (${nieuzywane})`;
  odswiezZaznaczenie();
  nastepnaMiniatura(); // także pusta lista: postęp poprzednich miniatur się zamyka
  sprawdzPowtorzenia();
}

// Starsze projekty: kopie tego samego pliku i obrazy o tej samej nazwie (sprzed tego okna).
let nrSprawdzenia = 0;
async function sprawdzPowtorzenia() {
  const nr = (nrSprawdzenia += 1);
  const pasek = $('#obrazy-porzadek');
  if (wybor) { pasek.hidden = true; return; }
  let w;
  try { w = await powtorzenia(stan.projekt); } catch { return; }
  if (nr !== nrSprawdzenia) return;
  const kopie = w.kopie.reduce((n, [, k]) => n + k.length, 0);
  const nazwy = w.nazwy.reduce((n, [, k]) => n + k.length, 0);
  pasek.hidden = !kopie && !nazwy;
  const czesci = [];
  if (kopie) czesci.push(`${kopie} ${odmiana(kopie, 'kopię pliku, który już jest', 'kopie plików, które już są', 'kopii plików, które już są')}`);
  if (nazwy) czesci.push(`${nazwy} ${odmiana(nazwy, 'obraz o zajętej nazwie', 'obrazy o zajętych nazwach', 'obrazów o zajętych nazwach')}`);
  $('#obrazy-porzadek-opis').textContent = `Ten projekt ma powtórzone obrazy sprzed tego okna: ${czesci.join(' i ')}.`;
}

async function uporzadkuj() {
  const p = stan.projekt;
  const { kopie, nazwy } = await powtorzenia(p);
  if (!kopie.length && !nazwy.length) { rysuj(); return; }
  const tresc = [];
  if (kopie.length) tresc.push('Kopie tego samego pliku staną się jednym obrazem – elementy na stronach zostają na miejscu i pokazują ten jeden plik.');
  if (nazwy.length) tresc.push('Obrazy o tej samej nazwie, a innej treści dostaną dopisek „(2)” – dane w tabelach pokażą ten sam obraz co dotąd.');
  if (!await potwierdz(tt('obrazyOkno.uporzadkowacObrazyProjektu'), tresc.join(' '), tt('obrazyOkno.uporzadkuj'))) return;
  const pasek = postep(tt('obrazyOkno.porzadkowanieObrazow'));
  try {
    // Nowe nazwy najpierw (nowy identyfikator na obraz – patrz nowaWersja), potem jedno przepięcie wszędzie.
    const przemianowane = [];
    for (const [, inne] of nazwy) {
      for (const id of inne) przemianowane.push([id, await nowaWersja(p, id, { nazwa: wolnaNazwa(p, p.zasoby[id].nazwa) })]);
    }
    const zbedne = [...kopie.flatMap(([, k]) => k), ...przemianowane.map(([id]) => id)];
    await zmienWszedzie((s) => {
      for (const [zostaje, k] of kopie) {
        for (const kopia of k) {
          // Komórki tabel wskazujące kopię jej nazwą dostają nazwę obrazu, który zostaje.
          if (p.zasoby[kopia] && p.zasoby[zostaje]) przepiszDane(s, komorkiObrazu(s, kopia), p.zasoby[zostaje].nazwa);
          przepnij(s, kopia, zostaje);
        }
      }
      for (const [stare, nowe] of przemianowane) przepnij(s, stare, nowe);
    }, async (pp) => { for (const id of zbedne) await usunObraz(pp, id, usunZKonta); });
    const ileKopii = kopie.reduce((n, [, k]) => n + k.length, 0);
    powiadom(`Uporządkowano obrazy: ${[ileKopii ? `scalone kopie: ${ileKopii}` : '', przemianowane.length ? `nowe nazwy: ${przemianowane.length}` : ''].filter(Boolean).join(', ')}.`);
  } catch (e) {
    powiadom(`Nie udało się uporządkować obrazów: ${e.message}`, true);
  } finally {
    pasek.koniec();
  }
  rysuj();
}

// Miniatury powstają po kolei (najwyżej dwie naraz, od góry listy): przy kilkudziesięciu dużych zdjęciach
// przygotowanie wszystkich kopii roboczych naraz zatykało przeglądarkę i okno długo się otwierało.
const kolejkaMiniatur = [];
let miniaturWToku = 0;
// Postęp miniatur: pojawia się tylko, gdy robienie trwa (pierwsze otwarcie okna z dużymi zdjęciami).
let pasekMiniatur = null;
let miniaturGotowych = 0;
let miniaturRazem = 0;
function pokazMiniature(li, id, z, rozmiar) {
  kolejkaMiniatur.push(() => zrobMiniature(li, id, z, rozmiar));
  miniaturRazem += 1;
  if (!pasekMiniatur) pasekMiniatur = postep(tt('obrazyOkno.miniaturyObrazow'), { razem: miniaturRazem, opoznienie: 700 });
  nastepnaMiniatura();
}
function nastepnaMiniatura() {
  while (miniaturWToku < 2 && kolejkaMiniatur.length) {
    const zadanie = kolejkaMiniatur.shift();
    miniaturWToku += 1;
    zadanie().catch(() => {}).finally(() => {
      miniaturWToku -= 1;
      miniaturGotowych += 1;
      pasekMiniatur?.krok(miniaturGotowych, miniaturRazem);
      nastepnaMiniatura();
    });
  }
  if (!kolejkaMiniatur.length && !miniaturWToku && pasekMiniatur) {
    pasekMiniatur.koniec();
    pasekMiniatur = null;
    miniaturGotowych = 0;
    miniaturRazem = 0;
  }
}

// Prawdziwa miniatura (najwyżej 320 px): przy kilkudziesięciu dużych zdjęciach przeglądarka nie trzyma w oknie
// pełnych obrazów i nie pomniejsza ich przy każdym przewinięciu (okno „laguje”). Robiona raz i zapisywana na
// urządzeniu (js/miniatury-obrazow.js) – kolejne otwarcia okna, także po odświeżeniu strony, są natychmiastowe.
// Pomniejszanie idzie poza głównym wątkiem (createImageBitmap z docelowym rozmiarem), gdy znamy wymiary pliku.
// Wymiary – zawsze oryginału.
const miniatury = new Map(); // klucz pliku → { url, szer, wys }
const BOK_MINIATURY = 320;
async function miniaturaZasobu(z) {
  const src = kopiaRobocza(z) || adresZasobu(z);
  const klucz = z.skrot || z.sciezka || src;
  if (!klucz) return null;
  if (miniatury.has(klucz)) return miniatury.get(klucz);
  const zapisana = (z.skrot || z.sciezka) ? await wczytajMiniature(klucz) : null;
  if (zapisana?.blob) {
    const w = { url: URL.createObjectURL(zapisana.blob), szer: z.szer || zapisana.szer || null, wys: z.wys || zapisana.wys || null };
    miniatury.set(klucz, w);
    return w;
  }
  if (!src) return null;
  let wynik = { url: src, szer: z.szer || null, wys: z.wys || null };
  try {
    const plik = await (await fetch(src)).blob();
    const zOryginalu = src === adresZasobu(z);
    // Znane wymiary: przeglądarka pomniejsza przy rozpakowaniu, w tle. Inaczej – rozpakowanie całego pliku.
    const znane = zOryginalu && z.szer && z.wys ? { szer: z.szer, wys: z.wys } : null;
    const skalaZnana = znane ? Math.min(1, BOK_MINIATURY / Math.max(znane.szer, znane.wys)) : 1;
    const bmp = znane && skalaZnana < 1
      ? await window.createImageBitmap(plik, { resizeWidth: Math.max(1, Math.round(znane.szer * skalaZnana)), resizeHeight: Math.max(1, Math.round(znane.wys * skalaZnana)), resizeQuality: 'medium' })
      : await window.createImageBitmap(plik);
    if (zOryginalu && !(wynik.szer && wynik.wys)) wynik = { ...wynik, szer: bmp.width, wys: bmp.height };
    const skala = Math.min(1, BOK_MINIATURY / Math.max(bmp.width, bmp.height));
    if (skala < 1 || (znane && skalaZnana < 1)) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * skala));
      c.height = Math.max(1, Math.round(bmp.height * skala));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => { c.toBlob(ok, 'image/webp', 0.85); });
      if (blob) {
        wynik.url = URL.createObjectURL(blob);
        if (z.skrot || z.sciezka) zapiszMiniature(klucz, { blob, szer: wynik.szer, wys: wynik.wys });
      }
    }
    bmp.close?.();
  } catch { /* np. SVG – pokazujemy plik wprost */ }
  miniatury.set(klucz, wynik);
  return wynik;
}

async function zrobMiniature(li, id, z, rozmiar) {
  if (!li.isConnected) return;
  const img = li.querySelector('img');
  const wymiary = li.querySelector('.obraz-wymiary');
  const m = await miniaturaZasobu(z);
  if (!m) { wymiary.textContent = 'brak pliku na tym urządzeniu'; li.classList.add('brak'); return; }
  const gotowa = new Promise((ok) => { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', ok, { once: true }); });
  img.src = m.url;
  await gotowa;
  const nw = m.szer || (m.url === adresZasobu(z) ? img.naturalWidth : null);
  const nh = m.wys || (m.url === adresZasobu(z) ? img.naturalHeight : null);
  if (nw && nh) wymiary.textContent = `${nw} × ${nh} px${rozmiar ? ` · ${mb(rozmiar)}` : ''}`;
}

// ---------- Zaznaczanie ----------

function odswiezZaznaczenie() {
  for (const li of lista.querySelectorAll('li[data-id]')) {
    const tak = zaznaczone.has(li.dataset.id);
    li.classList.toggle('zaznaczony', tak);
    li.setAttribute('aria-selected', String(tak));
    li.querySelector('input[type=checkbox]').checked = tak;
  }
  const n = zaznaczone.size;
  if (wybor) {
    $('#obrazy-wybierz').disabled = n !== 1;
    $('#obrazy-zaznaczone').textContent = n ? `Wybrany: ${stan.projekt.zasoby[[...zaznaczone][0]]?.nazwa}` : `Stuknij obraz, a potem „${wybor.etykieta}” (albo kliknij go dwa razy).`;
    for (const id of ['#obrazy-kopiuj-nazwy', '#obrazy-usun-zaznaczone', '#obrazy-odznacz', '#obrazy-tryb-zaznaczania']) $(id).hidden = true;
    return;
  }
  $('#obrazy-zaznaczone').textContent = n
    ? `Zaznaczone: ${n}`
    : (trybZaznaczania ? tt('obrazyOkno.stukajObrazyZebyJe') : 'Kliknij obraz, żeby go zaznaczyć (Ctrl – kilka, Shift – zakres; na telefonie przytrzymaj).');
  for (const id of ['#obrazy-kopiuj-nazwy', '#obrazy-usun-zaznaczone', '#obrazy-odznacz']) $(id).hidden = n === 0;
  const t = $('#obrazy-tryb-zaznaczania');
  t.hidden = n > 0;
  t.setAttribute('aria-pressed', String(trybZaznaczania));
}

function kliknietyObraz(li, e) {
  const id = li.dataset.id;
  if (wybor) {
    zaznaczone.clear();
    zaznaczone.add(id);
  } else if (e.shiftKey && kotwica && zaznaczone.size) {
    const ids = kolejnosc();
    const [a, b] = [ids.indexOf(kotwica), ids.indexOf(id)].sort((x, y) => x - y);
    if (!(e.ctrlKey || e.metaKey)) zaznaczone.clear();
    for (const x of ids.slice(a, b + 1)) zaznaczone.add(x);
  } else if (e.ctrlKey || e.metaKey || trybZaznaczania || e.przelacz) {
    if (zaznaczone.has(id)) zaznaczone.delete(id); else zaznaczone.add(id);
    kotwica = id;
  } else {
    const tylkoTen = zaznaczone.size === 1 && zaznaczone.has(id);
    zaznaczone.clear();
    if (!tylkoTen) zaznaczone.add(id);
    kotwica = id;
  }
  odswiezZaznaczenie();
}

// Nazwy do schowka – jedna pod drugą, żeby wkleić je jako kolejne komórki kolumny (tabela, Excel).
async function doSchowka(tekst) {
  try { await navigator.clipboard.writeText(tekst); return true; } catch { /* starsza przeglądarka albo brak zgody */ }
  const pole = document.createElement('textarea');
  pole.value = tekst;
  pole.setAttribute('readonly', '');
  Object.assign(pole.style, { position: 'fixed', opacity: '0', left: '0', top: '0' });
  okno.append(pole);
  pole.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  pole.remove();
  return ok;
}

async function kopiujNazwy(ids) {
  const nazwy = ids.map((id) => stan.projekt.zasoby[id]?.nazwa).filter(Boolean);
  if (!nazwy.length) return;
  if (!await doSchowka(nazwy.join('\n'))) { powiadom('Nie udało się skopiować – przeglądarka nie pozwoliła na dostęp do schowka.', true); return; }
  powiadom(nazwy.length === 1 ? `Skopiowano nazwę „${nazwy[0]}”.` : `Skopiowano ${nazwy.length} ${odmiana(nazwy.length, 'nazwę', 'nazwy', 'nazw')} – wklej je w kolumnę tabeli (każda w osobnym wierszu).`);
}

// ---------- Zmiany obejmujące strony (przepięcie elementów) ----------

// fn(projekt) zmienia strony, wzorce albo tabele. Zmiana trafia też do każdego kroku historii cofania:
// pliki nie należą do historii, więc cofnięcie nie może przywrócić elementu wskazującego plik, którego nie ma.
async function zmienWszedzie(fn, poZmianie = () => {}) {
  const p = stan.projekt;
  const zaznaczony = edytor.aktywny?.id;
  zapiszBiezacyCel();
  odlaczPlotno();
  if (stan.doHistorii) { clearTimeout(stan.timerHistorii); stan.doHistorii = false; historia.zapisz(p); }
  fn(p);
  historia.przelicz(p, fn);
  await poZmianie(p);
  stan.miniatury.clear();
  await zaladujCel();
  if (zaznaczony) edytor.zaznacz(zaznaczony);
  panel.zbuduj();
  generujMiniatury();
  zaplanujZapis({ historia: false });
}

async function podmienNa(id, plik) {
  const p = stan.projekt;
  const noweId = await nowaWersja(p, id, { blob: plik, nazwa: plik.name });
  await zmienWszedzie((s) => przepnij(s, id, noweId), (pp) => usunObraz(pp, id, usunZKonta));
  if (zaznaczone.delete(id)) zaznaczone.add(noweId);
  return noweId;
}

// Menu ⋯ karty obrazu (#103, #182): rzadsze działania – zmiana nazwy, podmiana pliku, usunięcie. Na karcie zostają
// „Kopiuj nazwę” (do tabeli danych) i „Pokaż na stronie”. Jedno menu w oknie (okno jest modalne – menu w body
// byłoby pod nim), ustawiane przy przycisku.
function otworzMenuObrazu(przycisk, id) {
  let menu = document.getElementById('menu-obrazu');
  const bylo = menu && !menu.hidden && menu.dataset.id === id;
  zamknijMenu();
  if (bylo) return;
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'menu-obrazu';
    menu.className = 'menu menu-strony';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    menu.innerHTML = `<button type="button" role="menuitem" data-op="nazwa"><span data-ikona="olowek"></span>Zmień nazwę</button>
      <button type="button" role="menuitem" data-op="podmien"><span data-ikona="wyslij"></span>Podmień plik…</button>
      <button type="button" role="menuitem" data-op="kopiuj"><span data-ikona="kopiuj"></span>Kopiuj nazwę</button>
      <hr>
      <button type="button" role="menuitem" data-op="usun"><span data-ikona="kosz"></span>Usuń obraz…</button>`;
    wstawIkony(menu);
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-op]');
      if (!b) return;
      const cel = menu.dataset.id;
      zamknijMenu();
      if (!stan.projekt.zasoby[cel]) return;
      if (b.dataset.op === 'nazwa') zmienNazwe(cel);
      else if (b.dataset.op === 'podmien') { podmieniany = cel; plikPodmien.click(); }
      else if (b.dataset.op === 'kopiuj') kopiujNazwy([cel]);
      else if (b.dataset.op === 'usun') usun([cel]);
    });
    $('#dlg-obrazy').append(menu);
  }
  menu.dataset.id = id;
  menu.hidden = false;
  const r = przycisk.getBoundingClientRect();
  const mr = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(window.innerWidth - mr.width - 8, Math.max(8, r.right - mr.width))}px`;
  menu.style.top = `${r.bottom + 4 + mr.height > window.innerHeight - 8 ? Math.max(8, r.top - 4 - mr.height) : r.bottom + 4}px`;
  przycisk.setAttribute('aria-expanded', 'true');
}

async function zmienNazwe(id) {
  const p = stan.projekt;
  const z = p.zasoby[id];
  const nowa = await zapytajONazwe(tt('obrazyOkno.zmienNazweObrazu'), tt('obrazyOkno.nazwaPlikuZRozszerzeniem'), z.nazwa);
  if (!nowa || nowa === z.nazwa) return;
  const kolizja = poNazwie(p, nowa, id);
  if (kolizja) { powiadom(`Obraz „${p.zasoby[kolizja].nazwa}” ma już tę nazwę. Dane wskazują obrazy nazwą, więc nazwy muszą być różne.`, true); return; }
  const u = uzycia(p, id);
  if (u.dane.length && !await potwierdz(tt('obrazyOkno.zmienicNazweObrazuZ'), `Tabele danych (${u.dane.map((n) => `„${n}”`).join(', ')}) wskazują ten obraz nazwą „${z.nazwa}”. Te komórki dostaną nową nazwę „${nowa}”.`, tt('obrazyOkno.zmienNazwe'))) return;
  try {
    const noweId = await nowaWersja(p, id, { nazwa: nowa });
    // Komórki liczone bez nowego wpisu – żeby nazwa bez rozszerzenia nie stała się chwilowo niejednoznaczna.
    const komorki = (s) => komorkiObrazu({ ...s, zasoby: Object.fromEntries(Object.entries(s.zasoby).filter(([k]) => k !== noweId)) }, id);
    await zmienWszedzie((s) => { const k = komorki(s); przepnij(s, id, noweId); przepiszDane(s, k, nowa); }, (pp) => usunObraz(pp, id, usunZKonta));
    if (zaznaczone.delete(id)) zaznaczone.add(noweId);
    powiadom(`Nazwa zmieniona na „${nowa}”.`);
  } catch (e) {
    powiadom(e.message, true);
  }
  rysuj();
}

async function pokaz(id) {
  const u = uzycia(stan.projekt, id);
  if (!u.pierwsze) return;
  okno.close();
  if (document.body.dataset.panel) ustawPanel('');
  if (u.pierwsze.wzorzec) await edytujWzorzec(u.pierwsze.wzorzec);
  else await przejdzDoStrony(stan.projekt.strony.findIndex((s) => s.id === u.pierwsze.strona));
  const o = edytor.canvas.getObjects().find((x) => x.zasob === id);
  if (o?.id) edytor.zaznacz(o.id);
}

// Usuwa obrazy, których nigdzie nie ma. Użytych nie rusza – mówi, gdzie są.
async function usun(ids, { tytulZbiorczy = null } = {}) {
  const p = stan.projekt;
  const wszystkie = uzyciaWszystkich(p);
  const uzyte = ids.map((id) => [id, uzycia(p, id, wszystkie)]).filter(([, u]) => u.uzyty);
  const wolne = ids.filter((id) => !uzyte.some(([x]) => x === id));
  const opisUzytych = uzyte.map(([id, u]) => `„${p.zasoby[id].nazwa}” (${opisUzycia(u)})`).join(', ');
  if (!wolne.length) {
    const tresc = `${uzyte.length === 1 ? 'Ten obraz jest użyty' : 'Te obrazy są użyte'}: ${opisUzytych}. Najpierw usuń go ze stron albo z tabeli danych – albo podmień plik, jeśli chcesz inny obraz w tych samych miejscach.`;
    const [id, u] = uzyte[0];
    if (uzyte.length === 1 && u.pierwsze) {
      if (await potwierdz(tt('obrazyOkno.obrazJestWUzyciu'), tresc, tt('obrazyOkno.pokaz'), false, tt('obrazyOkno.zamknij'))) await pokaz(id);
    } else await potwierdz(uzyte.length === 1 ? tt('obrazyOkno.obrazJestWUzyciu') : tt('obrazyOkno.obrazySaWUzyciu'), tresc, tt('obrazyOkno.ok'), false, tt('obrazyOkno.zamknij'));
    return;
  }
  const wHist = wolne.some((id) => wHistorii(historia, id));
  const czesci = [`${wolne.length === 1 ? 'Plik zniknie' : 'Pliki znikną'} z projektu, z tego urządzenia i z konta.`];
  if (uzyte.length) czesci.push(`W użyciu ${uzyte.length === 1 ? 'jest i zostaje' : 'są i zostają'}: ${opisUzytych}.`);
  if (wHist) czesci.push('Część była niedawno na stronach: cofnięcie (Ctrl+Z) przywróci tam elementy, ale już bez obrazów.');
  const tytul = tytulZbiorczy || (wolne.length === 1 ? `Usunąć obraz „${p.zasoby[wolne[0]].nazwa}”?` : `Usunąć ${wolne.length} ${odmiana(wolne.length, 'obraz', 'obrazy', 'obrazów')}?`);
  if (!await potwierdz(tytul, czesci.join(' '), tt('obrazyOkno.usun'), true)) return;
  for (const id of wolne) { await usunObraz(p, id, usunZKonta); zaznaczone.delete(id); }
  zaplanujZapis({ historia: false });
  powiadom(`Usunięto ${wolne.length} ${odmiana(wolne.length, 'obraz', 'obrazy', 'obrazów')}.${uzyte.length ? ` ${uzyte.length} w użyciu ${uzyte.length === 1 ? 'został' : 'zostały'}.` : ''}`);
  rysuj();
}

function usunNieuzywane() {
  const p = stan.projekt;
  const wszystkie = uzyciaWszystkich(p);
  const ids = obrazyProjektu(p).filter(([id]) => !uzycia(p, id, wszystkie).uzyty).map(([id]) => id);
  if (ids.length) usun(ids, { tytulZbiorczy: `Usunąć ${ids.length} ${odmiana(ids.length, 'nieużywany obraz', 'nieużywane obrazy', 'nieużywanych obrazów')}?` });
}

function zatwierdzWybor(id = [...zaznaczone][0]) {
  if (!wybor || !id || !stan.projekt.zasoby[id]) return;
  const { fn } = wybor;
  okno.close();
  fn(id);
}

// ---------- Wgrywanie ----------

// Pytanie o plik, którego nazwa już jest w projekcie (inna treść). Zwraca { wybor: 'zastap'|'oba'|'pomin', dlaWszystkich }.
function zapytajODuplikat(istniejacy, plik, zostalo) {
  const dlg = $('#dlg-obraz-duplikat');
  const z = stan.projekt.zasoby[istniejacy];
  $('#duplikat-opis').textContent = `W projekcie jest już obraz „${z.nazwa}”, a plik „${plik.name}” ma tę samą nazwę i inną treść. Dane wskazują obrazy nazwą, więc dwa obrazy nie mogą nazywać się tak samo.`;
  $('#duplikat-stary').src = kopiaRobocza(z) || adresZasobu(z) || '';
  const nowy = URL.createObjectURL(plik);
  $('#duplikat-nowy').src = nowy;
  $('#duplikat-oba').textContent = `Zachowaj oba (nowy jako „${wolnaNazwa(stan.projekt, plik.name)}”)`;
  const pole = $('#duplikat-wszystkie');
  pole.checked = false;
  pole.closest('label').hidden = zostalo === 0;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((ok) => dlg.addEventListener('close', () => {
    URL.revokeObjectURL(nowy);
    ok({ wybor: ['zastap', 'oba'].includes(dlg.returnValue) ? dlg.returnValue : 'pomin', dlaWszystkich: pole.checked });
  }, { once: true }));
}

// Archiwa ZIP: obrazy ze środka jak zwykłe pliki (te same limity i pomijane pliki co w łączniku AI).
const TYPY = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
const czyArchiwum = (f) => /\.zip$/i.test(f.name) || /zip/.test(f.type);
async function rozpakujArchiwa(pliki) {
  const wynik = [];
  for (const f of pliki) {
    if (!czyArchiwum(f)) { wynik.push(f); continue; }
    try {
      const { pliki: zeSrodka } = await rozpakujZip(new Uint8Array(await f.arrayBuffer()));
      if (!zeSrodka.length) powiadom(`W archiwum „${f.name}” nie ma obrazów PNG, JPEG, WebP, GIF ani SVG.`, true);
      for (const x of zeSrodka) wynik.push(new File([x.bajty], x.nazwa, { type: TYPY[x.nazwa.split('.').pop().toLowerCase()] }));
    } catch (e) {
      powiadom(`Archiwum „${f.name}”: ${e.message}`, true);
    }
  }
  return wynik;
}

export async function wgrajObrazy(wybrane) {
  const p = stan.projekt;
  const pasek = postep(wybrane.some((f) => /\.zip$/i.test(f.name)) ? tt('obrazyOkno.rozpakowywanieArchiwum') : tt('obrazyOkno.wgrywanieObrazow'));
  try {
    return await wgrajObrazyZPostepem(p, wybrane, pasek);
  } finally {
    pasek.koniec();
  }
}

async function wgrajObrazyZPostepem(p, wybrane, pasek) {
  const pliki = await rozpakujArchiwa(wybrane);
  const obrazy = pliki.filter((f) => f.type.startsWith('image/'));
  const wynik = { dodane: [], zastapione: [], takieSame: [], pominiete: [] };
  let dlaWszystkich = null;
  pasek.opis(tt('obrazyOkno.wgrywanieObrazow'));
  pasek.razem(obrazy.length);
  for (const [n, plik] of obrazy.entries()) {
    pasek.krok(n);
    const skrot = await skrotPliku(plik);
    const ten = await takiSam(p, plik, skrot);
    if (ten) { wynik.takieSame.push([plik.name, p.zasoby[ten].nazwa, ten]); continue; }
    const kolizja = poNazwie(p, plik.name);
    if (!kolizja) { wynik.dodane.push([plik.name, await dodajPlik(p, plik, plik.name, skrot)]); continue; }
    let decyzja = dlaWszystkich;
    if (!decyzja) {
      const odp = await zapytajODuplikat(kolizja, plik, obrazy.length - n - 1);
      decyzja = odp.wybor;
      if (odp.dlaWszystkich) dlaWszystkich = decyzja;
    }
    if (decyzja === 'zastap') { await podmienNa(kolizja, plik); wynik.zastapione.push(plik.name); } else if (decyzja === 'oba') {
      const nazwa = wolnaNazwa(p, plik.name);
      wynik.dodane.push([nazwa, await dodajPlik(p, plik, nazwa, skrot)]);
    } else wynik.pominiete.push(plik.name);
  }
  pasek.krok(obrazy.length);
  if (wynik.dodane.length) {
    stan.miniatury.clear();
    generujMiniatury();
    zaplanujZapis({ historia: false });
  }
  const czesci = [];
  if (wynik.dodane.length) czesci.push(`Wgrano ${wynik.dodane.length} ${odmiana(wynik.dodane.length, 'obraz', 'obrazy', 'obrazów')}${wynik.dodane.length === 1 ? ` („${wynik.dodane[0][0]}”)` : ''}.`);
  if (wynik.zastapione.length) czesci.push(`Zastąpiono ${wynik.zastapione.length}.`);
  if (wynik.takieSame.length === 1) czesci.push(`Ten obraz już jest jako „${wynik.takieSame[0][1]}” – nie dodano drugiej kopii.`);
  else if (wynik.takieSame.length) czesci.push(`${wynik.takieSame.length} ${odmiana(wynik.takieSame.length, 'obraz już był', 'obrazy już były', 'obrazów już było')} w projekcie – nie dodano kopii.`);
  if (wynik.pominiete.length) czesci.push(`Pominięto ${wynik.pominiete.length}.`);
  if (obrazy.length < pliki.length) czesci.push(`${pliki.length - obrazy.length} ${odmiana(pliki.length - obrazy.length, 'plik nie jest', 'pliki nie są', 'plików nie jest')} obrazem.`);
  if (czesci.length) powiadom(czesci.join(' '));
  if (okno.open) {
    // Nowo wgrane (i te, które już były) zostają zaznaczone – „Kopiuj nazwy” od razu da ich nazwy.
    const nowe = [...wynik.dodane.map(([, id]) => id), ...wynik.takieSame.map(([, , id]) => id)];
    if (nowe.length && !wybor) { zaznaczone.clear(); for (const id of nowe) zaznaczone.add(id); }
    if (nowe.length === 1 && wybor) { zaznaczone.clear(); zaznaczone.add(nowe[0]); }
    rysuj();
  }
  return wynik;
}

// ---------- Zdarzenia ----------

$('#obrazy-zamknij').addEventListener('click', () => okno.close());
$('#obrazy-anuluj').addEventListener('click', () => okno.close());
$('#obrazy-wybierz').addEventListener('click', () => zatwierdzWybor());
$('#obrazy-wgraj').addEventListener('click', () => plikWgraj.click());
$('#obrazy-usun-nieuzywane').addEventListener('click', () => usunNieuzywane());
$('#obrazy-uporzadkuj').addEventListener('click', () => uporzadkuj());
$('#obrazy-kopiuj-nazwy').addEventListener('click', () => kopiujNazwy(kolejnosc().filter((id) => zaznaczone.has(id))));
$('#obrazy-usun-zaznaczone').addEventListener('click', () => usun(kolejnosc().filter((id) => zaznaczone.has(id))));
$('#obrazy-odznacz').addEventListener('click', () => { zaznaczone.clear(); trybZaznaczania = false; odswiezZaznaczenie(); });
$('#obrazy-tryb-zaznaczania').addEventListener('click', () => { trybZaznaczania = !trybZaznaczania; odswiezZaznaczenie(); });
okno.addEventListener('close', () => { wybor = null; okno.classList.remove('tryb-wyboru'); });
// Obrazy wgrane albo usunięte przez AI (albo na innym urządzeniu) – otwarte okno pokazuje bieżącą listę.
document.addEventListener('seriodruk:zasoby', () => { if (okno.open) rysuj(); });

lista.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li || !stan.projekt.zasoby[li.dataset.id]) return;
  const id = li.dataset.id;
  if (e.target.closest('.obraz-zaznacz')) {
    e.preventDefault(); // pole wyboru odświeżamy sami
    kliknietyObraz(li, { przelacz: true });
    return;
  }
  const b = e.target.closest('button[data-rola]');
  if (b && !wybor) {
    if (b.dataset.rola === 'wiecej') otworzMenuObrazu(b, id);
    else if (b.dataset.rola === 'pokaz') pokaz(id);
    else if (b.dataset.rola === 'nazwa') zmienNazwe(id);
    else if (b.dataset.rola === 'kopiuj') kopiujNazwy([id]);
    else if (b.dataset.rola === 'podmien') { podmieniany = id; plikPodmien.click(); }
    return;
  }
  if (Date.now() - przytrzymano < 400) return; // po przytrzymaniu (telefon) kliknięcie już nic nie robi
  kliknietyObraz(li, e);
});
lista.addEventListener('dblclick', (e) => {
  const li = e.target.closest('li[data-id]');
  if (li && wybor && !e.target.closest('.obraz-zaznacz')) zatwierdzWybor(li.dataset.id);
});
lista.addEventListener('keydown', (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li || e.target !== li) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (e.key === 'Enter' && wybor) { zatwierdzWybor(li.dataset.id); return; }
    kliknietyObraz(li, { ctrlKey: e.key === ' ' && !wybor, shiftKey: e.shiftKey });
  }
});

// Telefon: przytrzymanie obrazu włącza zaznaczanie kilku (jak w galerii).
lista.addEventListener('pointerdown', (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li || wybor || e.pointerType === 'mouse' || e.target.closest('button, label')) return;
  clearTimeout(przytrzymanie);
  przytrzymanie = setTimeout(() => {
    trybZaznaczania = true;
    przytrzymano = Date.now();
    zaznaczone.add(li.dataset.id);
    kotwica = li.dataset.id;
    odswiezZaznaczenie();
  }, 500);
});
for (const z of ['pointerup', 'pointercancel', 'pointerleave']) lista.addEventListener(z, () => clearTimeout(przytrzymanie));
lista.addEventListener('contextmenu', (e) => { if (e.target.closest('li[data-id]') && Date.now() - przytrzymano < 1500) e.preventDefault(); });

plikPodmien.addEventListener('change', async (e) => {
  const plik = e.target.files[0];
  const id = podmieniany;
  podmieniany = null;
  if (!plik || !id || !stan.projekt.zasoby[id]) { e.target.value = ''; return; }
  if (!plik.type.startsWith('image/')) { e.target.value = ''; powiadom(tt('obrazyOkno.toNieJestPlik'), true); return; }
  const stara = stan.projekt.zasoby[id].nazwa;
  // Nazwa zostaje (dane dalej pasują) – także gdy nowy plik jest innego rodzaju (np. PNG zamiast JPG).
  try {
    await podmienNa(id, new File([plik], stara, { type: plik.type }));
    powiadom(`Podmieniono plik obrazu „${stara}”.`);
  } catch (err) {
    powiadom(err.message, true);
  }
  e.target.value = '';
  rysuj();
});
