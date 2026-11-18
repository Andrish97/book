// Ekran „Projekty”: lista, otwieranie, kopiowanie, zmiana nazwy, eksport do pliku, usuwanie i okno nowego projektu.

import { normalizuj, kopiujProjekt, FORMATY, nowyProjekt, normalizujWydruk, nowaSekcja, nowaStrona } from '../projekt.js';
import { normalizujOkladke, przeliczOkladki } from '../okladka.js';
import { listaLokalnych, wczytajLokalnie, zapiszLokalnie, oznaczZsynchronizowany, usunLokalnie } from '../lokalny.js';
import { usunHistorie } from '../historia-zapis.js';
import * as chmura from '../chmura.js';
import { odlozZasoby, podlaczZasoby, kopiujPliki } from '../zasoby.js';
import { podstawaProjektu } from '../laczenie.js';
import { ikona } from '../ikony.js';
import { zapiszPlikProjektu, ROZSZERZENIE, wczytajPlikProjektu as odczytajPlik } from '../plik-projektu.js';
import { powiadom, $, kiedy, przelaczMenu, zamknijMenu, zapytajONazwe, pobierz, bezpiecznaNazwa, potwierdz } from '../ui.js';
import { NAZWA } from '../marka.js';
import { postep } from '../postep.js';
import { limitProjektow } from '../miejsce.js';
import { domyslneStyle } from '../style-tekstu.js';
import { wlasciciel, stan, pokazEkran, trasa } from './kontekst.js';
import { czekajNaEdytor, edytorGotowy, doczytajWTle } from './doczytaj.js';

// Edytor wczytuje się dopiero przy otwarciu projektu (js/app/doczytaj.js); do tego czasu nie ma czego zapisywać.
const otworzProjekt = async (...a) => (await czekajNaEdytor()).otworzProjekt(...a);
const zapiszTeraz = async () => edytorGotowy()?.zapiszTeraz();
const otworzUdostepnianie = async (projekt) => (await czekajNaEdytor()).otworzUdostepnianie(projekt);
import { przejdzDoTrasy } from './trasy.js';
import * as wsp from '../wspolpraca-chmura.js';
import {
  otworzWspolprace, opuscProjekt, odswiezZaproszenia, ustawZaleznosci, krotkoRola, ikonaWspolpracy,
} from './wspolpraca.js';

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
      const [lista, udzialy] = await Promise.all([chmura.listaWChmurze(), wsp.udostepnioneMi()]);
      const naKoncie = new Set();
      for (const c of lista) {
        naKoncie.add(c.id);
        const w = wpisy.get(c.id) || { id: c.id, nazwa: c.nazwa, miniatura: c.miniatura };
        w.wChmurze = c.zmieniono;
        w.wersjaChmury = c.wersja ?? null;
        // Projekt kogoś innego, do którego mnie zaproszono (współpraca, decyzja #86).
        const cudzy = Boolean(c.owner_id) && c.owner_id !== stan.uzytkownik.id;
        const u = udzialy.get(c.id);
        w.wspolpraca = cudzy ? { wlasciciel: c.owner_id, nazwa: u?.wlasciciel || 'Właściciel', rola: u?.rola || 'odczyt' } : null;
        if (!w.lokalnie || !w.doSynchronizacji) w.udostepniony = !cudzy && Boolean(c.udostepnienie);
        if (!w.lokalnie || (!w.doSynchronizacji && c.zmieniono > (w.zmieniono || ''))) {
          w.nazwa = c.nazwa;
          w.miniatura = c.miniatura || w.miniatura;
        }
        wpisy.set(c.id, w);
      }
      // Kopia projektu współdzielonego, którego już nie ma na liście z konta: właściciel odebrał dostęp
      // albo usunął projekt – kopia na tym urządzeniu znika razem z nim. Tak samo własny projekt, który był już
      // na koncie i nie ma w nim niewysłanych zmian, a zniknął z konta (usunięty na innym urządzeniu albo przez AI, #94).
      for (const [id, w] of wpisy) {
        if (naKoncie.has(id) || !(w.wspolpraca || (w.bylNaKoncie && !w.doSynchronizacji))) continue;
        wpisy.delete(id);
        usunKopieLokalna(id).catch(() => {});
      }
    } catch (e) {
      powiadom(`Nie udało się pobrać listy z konta: ${chmura.komunikatBledu(e)}`, true);
    }
  }
  return [...wpisy.values()].sort((a, b) => najnowsza(b).localeCompare(najnowsza(a)));
}

// Filtr listy, gdy są projekty udostępnione przez innych: wszystkie / moje / udostępnione mi.
let filtr = 'wszystkie';
const PASUJE = { wszystkie: () => true, moje: (w) => !w.wspolpraca, udostepnione: (w) => Boolean(w.wspolpraca) };
$('#filtry-projektow').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtr]');
  if (!b) return;
  filtr = b.dataset.filtr;
  pokazProjekty({ cicho: true });
});

// cicho: odświeżenie listy, która już jest na ekranie (zmiana na koncie z innego urządzenia) – bez
// szkieletu ładowania i bez ruszania adresu.
// Ciche odświeżenie nie przebudowuje kart, gdy na którejś jest otwarte menu – czeka, aż się zamknie (#137);
// inaczej menu znikało spod palca w chwili, gdy w tle skończyła się wysyłka albo przyszła zmiana z konta.
const otwarteMenuKarty = () => Boolean($('#siatka-projektow .menu:not([hidden])'));
let odswiezPoMenu = null;
function odswiezGdyMenuZamkniete() {
  if (odswiezPoMenu) return;
  odswiezPoMenu = setInterval(() => {
    if (otwarteMenuKarty()) return;
    clearInterval(odswiezPoMenu);
    odswiezPoMenu = null;
    if (document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true });
  }, 300);
}

// Numer ostatniego wywołania (#184): lista z konta przychodzi z opóźnieniem, więc starsze odświeżenie (np. po
// zmianie z innego urządzenia) potrafiło skończyć się PO odświeżeniu zrobionym po usunięciu projektu i narysować
// starą listę – usunięty projekt wracał na ekran. Rysuje tylko najnowsze wywołanie.
let pokolenieListy = 0;
export async function pokazProjekty({ cicho = false } = {}) {
  if (cicho && otwarteMenuKarty()) { odswiezGdyMenuZamkniete(); return; }
  const moje = ++pokolenieListy;
  const siatka = $('#siatka-projektow');
  if (!cicho) {
    pokazEkran('projekty');
    trasa.ustaw('projekty');
    siatka.innerHTML = '<li class="karta-projektu szkielet"><div class="okladka"></div><div class="opis"><strong>&nbsp;</strong><small>&nbsp;</small></div></li>'.repeat(3);
    $('#pusto-projekty').hidden = true;
    // Przyciski nagłówka pokazują się dopiero po wczytaniu listy – przy pustej liście „Nowy projekt”
    // stoi w pustym stanie, więc nie przeskakuje z nagłówka w trakcie kliknięcia.
    $('.projekty-naglowek .przyciski-naglowka').hidden = true;
  }
  const wszystkie = await wpisyProjektow();
  if (moje !== pokolenieListy) return; // w międzyczasie ruszyło nowsze odświeżenie – ono narysuje listę
  if (cicho && document.body.dataset.ekran !== 'projekty') return; // w międzyczasie otwarto projekt
  doczytajWTle(); // edytor przyjdzie w tle, zanim ktoś kliknie projekt
  odswiezZaproszenia();
  const udostepnione = wszystkie.filter((w) => w.wspolpraca).length;
  if (!udostepnione) filtr = 'wszystkie';
  const wpisy = wszystkie.filter(PASUJE[filtr] || PASUJE.wszystkie);
  const filtry = $('#filtry-projektow');
  filtry.hidden = udostepnione === 0;
  for (const b of filtry.querySelectorAll('[data-filtr]')) b.setAttribute('aria-pressed', String(b.dataset.filtr === filtr));
  // Osierocone pliki na koncie – ciche sprzątanie najwyżej raz na dobę (#90).
  if (stan.uzytkownik) import('../miejsce.js').then((m) => m.sprzatnijWTle(stan.uzytkownik.id)).catch(() => {});
  if (cicho && otwarteMenuKarty()) { odswiezGdyMenuZamkniete(); return; } // menu otwarte w trakcie pobierania listy
  siatka.replaceChildren();
  $('#pusto-projekty').hidden = wszystkie.length > 0;
  $('.projekty-naglowek .przyciski-naglowka').hidden = wszystkie.length === 0;
  const wlasne = wszystkie.length - udostepnione;
  const ileUdostepnionych = `${udostepnione} ${udostepnione === 1 ? 'udostępniony' : 'udostępnione'} Ci`;
  $('#podsumowanie-projektow').textContent = !wszystkie.length ? ''
    : !udostepnione ? `${wlasne} ${odmianaProjektow(wlasne)}`
      : !wlasne ? `${udostepnione} ${odmianaProjektow(udostepnione)} – ${udostepnione === 1 ? 'udostępniony' : 'udostępnione'} Ci`
        : `${wlasne} ${odmianaProjektow(wlasne)} · ${ileUdostepnionych}`;

  for (const w of wpisy) {
    const li = document.createElement('li');
    li.className = 'karta-projektu';
    li.innerHTML = `
      <button class="otworz-projekt">
        <div class="okladka">${w.miniatura ? '<img alt="">' : '<div class="pusta-okladka"></div>'}</div>
        <div class="opis"><strong></strong><small></small></div>
      </button>
      ${w.udostepniony || w.wspolpraca ? `<div class="plakietki-karty">${w.udostepniony ? `<button class="plakietka-linku" title="Projekt ma link do podglądu – kliknij, żeby go skopiować, zmienić hasło, ważność albo znak wodny">${ikona('link', { rozmiar: 14 })}<span>Udostępniony</span></button>` : ''}${w.wspolpraca ? `<button class="plakietka-linku plakietka-wspolpracy" title="Projekt udostępniony Ci przez inną osobę – kliknij, żeby zobaczyć, kto ma dostęp">${ikonaWspolpracy()}<span></span></button>` : ''}</div>` : ''}
      <button class="przycisk-ikona menu-karty" aria-label="Opcje projektu" aria-haspopup="menu" aria-expanded="false">${ikona('wiecej')}</button>
      <div class="menu" role="menu" hidden>
        <button role="menuitem" data-op="podglad">${ikona('oko')}Podgląd</button>
        ${w.wspolpraca?.rola === 'odczyt' ? '' : `<button role="menuitem" data-op="nazwa">${ikona('tekst')}Zmień nazwę</button>`}
        <button role="menuitem" data-op="duplikuj">${ikona('kopiuj')}${w.wspolpraca ? 'Zrób własną kopię' : 'Duplikuj'}</button>
        <button role="menuitem" data-op="eksport">${ikona('pobierz')}Eksportuj do pliku (.makietka)</button>
        ${w.wspolpraca ? '' : `<button role="menuitem" data-op="udostepnij">${ikona('link')}${w.udostepniony ? 'Link do podglądu…' : 'Udostępnij linkiem…'}</button>`}
        <button role="menuitem" data-op="wspolpraca">${ikona('uzytkownik')}Współpraca…</button>
        <hr>
        ${w.wspolpraca
    ? `<button role="menuitem" data-op="opusc" class="niebezpieczny">${ikona('wyloguj')}Opuść projekt</button>`
    : `<button role="menuitem" data-op="usun" class="niebezpieczny">${ikona('kosz')}Usuń projekt</button>`}
      </div>`;
    if (w.wspolpraca) {
      li.classList.add('wspoldzielony');
      $('.plakietka-wspolpracy span', li).textContent = w.wspolpraca.nazwa;
    }
    if (w.miniatura) $('img', li).src = w.miniatura;
    $('strong', li).textContent = w.nazwa || 'Bez nazwy';
    const niewyslany = stan.uzytkownik && w.lokalnie && w.doSynchronizacji;
    // Stan wysyłki jako mała chmurka przy nazwie (#109): zapisano na koncie / czeka na wysłanie / offline.
    if (stan.uzytkownik) {
      const [nazwaIkony, opis] = !niewyslany ? ['chmura_ok', 'Zapisano na koncie']
        : (navigator.onLine ? ['chmura_czeka', 'Czeka na wysłanie na konto'] : ['chmura_brak', 'Offline – zapisano na tym urządzeniu, wyślę po powrocie internetu']);
      const stanWysylki = document.createElement('span');
      stanWysylki.dataset.projekt = w.id;
      stanWysylki.className = `stan-wysylki ${nazwaIkony}`;
      stanWysylki.title = opis;
      stanWysylki.setAttribute('aria-label', opis);
      stanWysylki.setAttribute('role', 'img');
      stanWysylki.innerHTML = ikona(nazwaIkony, { rozmiar: 15 });
      $('strong', li).prepend(stanWysylki);
    }
    const rola = w.wspolpraca ? `${krotkoRola(w.wspolpraca.rola) === 'edytuje' ? 'Możesz edytować' : 'Możesz oglądać'} · ` : '';
    $('small', li).textContent = `${rola}Zmieniono ${kiedy(najnowsza(w))}`;
    $('.otworz-projekt', li).addEventListener('click', () => otworzZListy(w));
    $('.plakietka-linku:not(.plakietka-wspolpracy)', li)?.addEventListener('click', async () => {
      try { otworzUdostepnianie(await wczytajProjektZWpisu(w)); } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
    });
    $('.plakietka-wspolpracy', li)?.addEventListener('click', () => otworzWspolprace(w));
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
      if (op === 'udostepnij') { try { otworzUdostepnianie(await wczytajProjektZWpisu(w)); } catch (err) { powiadom(chmura.komunikatBledu(err), true); } }
      if (op === 'wspolpraca') await otworzWspolprace(w);
      if (op === 'opusc') await opuscProjekt(w);
    });
    siatka.append(li);
  }
}

// pasek – opcjonalny wskaźnik postępu (js/postep.js): opis i licznik pobieranych obrazów.
export async function wczytajProjektZWpisu(w, pasek = null) {
  const projekt = await wczytajProjektZWpisuBez(w, pasek);
  // Czyj to projekt i jaka moja rola – z listy konta (współpraca); bez sieci zostaje to, co zapamiętane.
  if (projekt && stan.uzytkownik && w.wspolpraca !== undefined) {
    if (w.wspolpraca) projekt.wspolpraca_chmury = w.wspolpraca;
    else delete projekt.wspolpraca_chmury;
  }
  return projekt;
}

async function wczytajProjektZWpisuBez(w, pasek = null) {
  const lokalny = w.lokalnie ? (await wczytajLokalnie(w.id))?.projekt : null;
  // Bez niewysłanych zmian na urządzeniu wygrywa wersja z konta, jeśli jest nowsza. „Nowsza” liczymy numerem
  // wersji z bazy, nie zegarem urządzenia: zegar telefonu może się spieszyć, a wtedy stara kopia z urządzenia
  // wyglądała na nowszą od zmian zrobionych w międzyczasie (np. przez AI) i je zasłaniała (#135).
  // Niewysłane zmiany lokalne: otwiera się kopia z urządzenia, a zmiany z konta dołączają się zaraz po otwarciu.
  const nowszaWersja = lokalny?.wersja_chmury != null && w.wersjaChmury != null
    ? w.wersjaChmury > lokalny.wersja_chmury
    : w.wChmurze > (lokalny?.zmieniono || '');
  // Kopia z urządzenia z zapamiętanym stanem uzgodnionym z kontem (podstawa_chmury) też otwiera się sama – zmiany
  // z konta dołączają się zaraz po otwarciu (sprawdzKonto → łączenie), a historia cofania z tego urządzenia zostaje
  // i przelicza się z nimi. Bez takiej podstawy (nie ma z czym łączyć) nowsza wersja z konta wczytuje się wprost (#137).
  const polaczyPoOtwarciu = Boolean(lokalny?.podstawa_chmury && lokalny?.wersja_chmury != null && stan.uzytkownik);
  const chmuraNowsza = w.wChmurze && (!lokalny || (!w.doSynchronizacji && nowszaWersja && !polaczyPoOtwarciu));
  if (!chmuraNowsza) {
    // Starszy zapis trzymał obrazy w środku projektu – przy pierwszym otwarciu przechodzą do magazynu plików.
    if (lokalny && await odlozZasoby(lokalny)) await zapiszLokalnie(lokalny, wlasciciel(), Boolean(w.doSynchronizacji));
    if (lokalny) await podlaczObrazy(lokalny, pasek);
    return lokalny;
  }
  pasek?.opis('Pobieranie projektu z konta…');
  const projekt = normalizuj(await chmura.wczytajZChmury(w.id));
  projekt.podstawa_chmury = podstawaProjektu(projekt); // stan uzgodniony z kontem – punkt odniesienia przy łączeniu zmian
  await zapiszLokalnie(projekt, wlasciciel(), false);
  await podlaczObrazy(projekt, pasek);
  return projekt;
}

// Obrazy projektu dostają adresy plików z magazynu przeglądarki; brakujące są pobierane z konta.
export async function podlaczObrazy(projekt, pasek = null) {
  const brak = await podlaczZasoby(projekt, stan.uzytkownik ? chmura.pobierzZasob : null, pasek && ((i, n) => { pasek.opis('Pobieranie obrazów z konta…'); pasek.krok(i, n); }));
  if (brak.length) powiadom(`Nie udało się wczytać ${brak.length === 1 ? `obrazu „${brak[0]}”` : `obrazów (${brak.length}): ${brak.slice(0, 3).join(', ')}${brak.length > 3 ? '…' : ''}`}.${navigator.onLine ? '' : ' Są na koncie – pobiorą się po powrocie internetu.'}`, true);
}

async function otworzZListy(w) {
  const pasek = postep(`Otwieranie „${w.nazwa || 'projektu'}”…`);
  try {
    const projekt = await wczytajProjektZWpisu(w, pasek);
    if (!projekt) throw new Error('Nie znaleziono projektu.');
    pasek.opis(`Otwieranie „${projekt.nazwa}”…`);
    pasek.razem(null);
    await otworzProjekt(projekt);
    // Rola „może oglądać” (współpraca): od razu podgląd.
    if (projekt.wspolpraca_chmury?.rola === 'odczyt') await (await czekajNaEdytor()).pokazPodglad();
  } catch (e) {
    powiadom(`Nie udało się otworzyć projektu: ${chmura.komunikatBledu(e)}`, true);
  } finally {
    pasek.koniec();
  }
}

export async function zapiszGdziekolwiek(projekt) {
  await zapiszLokalnie(projekt, wlasciciel(), Boolean(stan.uzytkownik));
  if (!stan.uzytkownik) return;
  try {
    await chmura.zapiszWChmurze(projekt);
    // Stan uzgodniony z kontem (#201): bez numeru wersji i punktu odniesienia na urządzeniu pierwsza zmiana
    // w kopii („Duplikuj”) albo projekcie zmienianym z listy kończyła się pytaniem „Projekt zmieniono w innym
    // miejscu”, a „Wczytaj” cofało zmianę (np. nowy link) – za każdym razem.
    projekt.podstawa_chmury = podstawaProjektu(projekt);
    await zapiszLokalnie(projekt, wlasciciel(), true);
    await oznaczZsynchronizowany(projekt.id, projekt.zmieniono);
  } catch (e) {
    powiadom(chmura.komunikatBledu(e), true);
  }
}

async function duplikujProjekt(w) {
  if (await ponadLimit()) return;
  const pasek = postep(`Kopiowanie „${w.nazwa || 'projektu'}”…`);
  try {
    const zrodlo = await wczytajProjektZWpisu(w);
    const kopia = kopiujProjekt(zrodlo, `${zrodlo.nazwa} (kopia)`);
    pasek.opis('Kopiowanie obrazów…');
    await kopiujPliki(zrodlo, kopia); // kopia ma własne pliki obrazów – podmiana zdjęcia w niej nie rusza oryginału
    pasek.opis('Zapisywanie kopii…');
    await zapiszGdziekolwiek(kopia);
    powiadom(`Utworzono „${kopia.nazwa}”.`);
  } catch (e) {
    powiadom(`Nie udało się zduplikować: ${chmura.komunikatBledu(e)}`, true);
  } finally {
    pasek.koniec();
  }
  if (document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true }); // bez zmiany adresu – patrz niżej (#137)
}

async function zmienNazweProjektu(w) {
  const nazwa = await zapytajONazwe('Zmień nazwę projektu', 'Nazwa', w.nazwa || '');
  if (!nazwa) return;
  const projekt = await wczytajProjektZWpisu(w);
  projekt.nazwa = nazwa;
  projekt.zmieniono = new Date().toISOString();
  await zapiszGdziekolwiek(projekt);
  if (document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true }); // bez zmiany adresu – patrz niżej (#137)
}

// Eksport całego projektu do pliku .makietka (z obrazami) – kopia zapasowa
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
    // Wysyłka projektu ruszona przy wyjściu z edytora może jeszcze trwać (np. duże zdjęcia) – po niej założyłaby
    // usunięty projekt od nowa. Usuwamy dopiero, gdy się skończy (#184).
    await edytorGotowy()?.poWysylkach?.();
    await usunLokalnie(w.id);
    await usunHistorie(w.id);
    if (stan.uzytkownik) await chmura.usunZChmury(w.id);
    powiadom('Projekt usunięty.');
  } catch (e) {
    powiadom(`Nie udało się usunąć: ${chmura.komunikatBledu(e)}`, true);
  }
  // Odświeżenie listy po czynności na karcie – ciche: pełne ustawia adres #/projekty, a spóźniona zmiana adresu
  // wyrzucała z edytora, gdy w tym czasie otwierano już inny projekt (#137).
  if (document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true });
  return true;
}

// ---------- Nowy projekt ----------

const FORMATY_KART = [...Object.entries(FORMATY), ['Własny', null]];

// Limit projektów konta (#92): komunikat zamiast nowego projektu, którego baza i tak nie przyjmie.
async function ponadLimit() {
  if (!stan.uzytkownik) return false;
  const tekst = await limitProjektow();
  if (tekst) powiadom(tekst, true);
  return Boolean(tekst);
}

// szablon: od razu „Zacznij od: Gotowego szablonu” (przycisk w pustej liście projektów, #180).
export async function otworzNowyProjekt({ szablon = false } = {}) {
  if (await ponadLimit()) return;
  const dlg = $('#dlg-nowy');
  const f = $('#form-nowy');
  f.reset();
  if (szablon && f.elements.start) f.elements.start.value = 'szablon';
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
  await pokazStart();
  f.elements.nazwa.focus();
}

// „Zacznij od: Gotowego szablonu” – galeria szablonów PROJEKTÓW od razu w tym oknie (#208), bez pól formatu
// (format i sekcje daje szablon). Wybór szablonu tworzy cały projekt.
async function pokazStart() {
  const f = $('#form-nowy');
  const szablon = f.elements.start?.value === 'szablon';
  f.dataset.start = szablon ? 'szablon' : 'pusty';
  $('#nowy-szablony').hidden = !szablon;
  if (!szablon) {
    // Galeria w tym oknie była tylko, gdy edytor już się wczytał – inaczej nie ma czego chować.
    if (edytorGotowy()) (await import('./gotowe-sekcje-okno.js')).schowajZNowegoProjektu();
    return;
  }
  // Miniatury szablonów rysuje biblioteka płótna – doczytujemy ją jak przy otwieraniu projektu.
  await czekajNaEdytor();
  if (f.dataset.start !== 'szablon') return;
  const okno = await import('./gotowe-sekcje-okno.js');
  okno.pokazWNowymProjekcie($('#nowy-szablony'), {
    nazwa: () => f.elements.nazwa.value.trim(),
    utworz: async (projekt) => {
      await otworzProjekt(projekt);
      await zapiszTeraz();
    },
  });
}

$('#form-nowy').addEventListener('change', (e) => {
  if (e.target.name === 'format') $('#wlasny-format').hidden = e.target.value !== 'Własny';
  if (e.target.name === 'start') pokazStart();
});

// Pusty projekt z pól okna „Nowy projekt”.
function projektZFormularza() {
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
  // Okładka liczona sama (#119): osobna sekcja przed środkiem, format z formatu i liczby stron środka.
  if (f.elements.okladka.value) {
    const srodek = projekt.sekcje[0];
    srodek.nazwa = 'Środek';
    const okladka = nowaSekcja('Okładka', { ...srodek.wydruk, marginesy: { ...srodek.wydruk.marginesy } });
    okladka.okladka = normalizujOkladke({ oprawa: f.elements.okladka.value });
    okladka.numeracja = { tryb: 'brak', od: 1 };
    projekt.sekcje.unshift(okladka);
    projekt.strony.unshift(nowaStrona('Okładka', okladka.id));
    przeliczOkladki(projekt);
  }
  return projekt;
}

$('#dlg-nowy').addEventListener('close', async () => {
  if (edytorGotowy()) import('./gotowe-sekcje-okno.js').then((m) => m.schowajZNowegoProjektu()).catch(() => {});
  if ($('#dlg-nowy').returnValue !== 'ok') return;
  await otworzProjekt(projektZFormularza());
  await zapiszTeraz();
});

// Projekt zniknął z konta (Realtime DELETE): otwarty – zamykamy bez zapisu (inaczej zapis założyłby go od nowa)
// i mówimy dlaczego; na liście – kopia na urządzeniu znika (o ile nie ma niewysłanych zmian).
export async function projektUsunietyNaKoncie(id) {
  if (!stan.uzytkownik) return;
  const lokalny = await wczytajLokalnie(id).catch(() => null);
  if (stan.projekt?.id === id) {
    const nazwa = stan.projekt.nazwa;
    for (const t of ['timerZapisu', 'timerChmury', 'timerHistorii']) { clearTimeout(stan[t]); stan[t] = null; }
    stan.projekt = null;
    document.dispatchEvent(new CustomEvent('seriodruk:projekt', { detail: null }));
    document.title = NAZWA;
    await usunKopieLokalna(id).catch(() => {});
    trasa.ustaw('projekty');
    await pokazProjekty();
    powiadom(`Projekt „${nazwa}” został usunięty z konta (z innego urządzenia albo przez AI).`, true);
    return;
  }
  if (!lokalny) { if (document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true }); return; }
  if (!lokalny.doSynchronizacji && lokalny.projekt?.wersja_chmury) await usunKopieLokalna(id).catch(() => {});
  if (document.body.dataset.ekran === 'projekty' && !stan.projekt) pokazProjekty({ cicho: true });
}

export async function doProjektow() {
  if (stan.projekt) {
    await zapiszTeraz();
    // Ostatnie zmiany idą na konto w tle także po wyjściu z edytora – inaczej czekałyby do ponownego otwarcia
    // projektu, a karta pokazywałaby „czeka na wysłanie”.
    const modul = edytorGotowy();
    if (stan.uzytkownik && modul) { clearTimeout(stan.timerChmury); modul.synchronizuj({ projekt: stan.projekt }); }
  }
  stan.projekt = null;
  document.dispatchEvent(new CustomEvent('seriodruk:projekt', { detail: null })); // obecność, tryb współpracy
  document.title = NAZWA;
  pokazProjekty();
}

// ---------- Współpraca (js/app/wspolpraca.js) ----------

async function usunKopieLokalna(id) {
  await usunLokalnie(id);
  await usunHistorie(id);
}

async function otworzProjektPoId(id) {
  trasa.ustaw(`p/${id}`);
  await przejdzDoTrasy();
}

// Zapraszać można do projektu, który jest na koncie – otwarty projekt idzie tam od razu, z listy – jeśli
// jeszcze go tam nie ma.
async function zapewnijNaKoncie(projekt) {
  const modul = edytorGotowy();
  if (stan.projekt?.id === projekt.id && modul) {
    await modul.zapiszTeraz();
    await modul.synchronizuj();
    return;
  }
  const w = (await wpisyProjektow()).find((x) => x.id === projekt.id);
  if (w && !w.wChmurze) await zapiszGdziekolwiek(await wczytajProjektZWpisu(w));
}

ustawZaleznosci({ pokazProjekty, otworzProjektPoId, zapewnijNaKoncie, usunKopieLokalna });

// ---------- Pliki ----------

// Plik z innego programu do składu (#225): IDML, SLA albo ZIP z jednym z nich (pakiet z obrazami).
async function plikSkladu(plik) {
  const { toPlikSkladu, zipZeSkladem } = await import('../import-skladu.js');
  if (toPlikSkladu(plik)) return true;
  if (!/\.zip$/i.test(plik.name || '')) return false;
  const { biblioteka } = await import('../biblioteki.js');
  const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'modułu ZIP');
  try { return await zipZeSkladem(await JSZip.loadAsync(plik)); } catch { return false; }
}

async function wczytajPlikSkladu(plik) {
  const pasek = postep(`Odczyt „${plik.name}”…`);
  try {
    const [{ biblioteka }, { importujSklad }, { przyjmijPlik }] = await Promise.all([import('../biblioteki.js'), import('../import-skladu.js'), import('../obrazy-projektu.js')]);
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'modułu ZIP');
    const { projekt, raport } = await importujSklad(plik, JSZip, przyjmijPlik);
    if (await ponadLimit()) return;
    if (stan.projekt) await zapiszTeraz();
    await otworzProjekt(projekt);
    await zapiszTeraz();
    const czesci = [`${raport.stron} ${raport.stron === 1 ? 'strona' : 'stron'}`, `ramki tekstu ${raport.teksty}`, `kształty ${raport.ksztalty}`, `obrazy ${raport.obrazy}`];
    let opis = `Wczytano z programu ${raport.format}: ${czesci.join(', ')}.`;
    if (raport.pola.length) opis += ` Pola korespondencji seryjnej zamienione na pola Makietki: ${raport.pola.map((x) => `{${x}}`).join(', ')} – wczytaj dane w „Dane”.`;
    if (raport.nieobslugiwane?.length) opis += ` Obrazy w starym formacie Windows (${raport.nieobslugiwane.join(', ')}) – przeglądarka ich nie wyświetla; w ich miejscu są szare pola – wstaw tam obrazy jeszcze raz (np. zapisane z Publishera jako PNG).`;
    if (raport.brakujace.length) opis += ` Brak plików obrazów (${raport.brakujace.length}): ${raport.brakujace.slice(0, 5).join(', ')}${raport.brakujace.length > 5 ? '…' : ''} – wczytaj ZIP z folderem obrazów (w InDesignie: Plik → Pakiet) albo wstaw je w szare pola.`;
    powiadom(opis);
  } catch (e) {
    powiadom(`Nie udało się wczytać pliku: ${e.message}`, true);
  } finally {
    pasek.koniec();
  }
}

export async function wczytajPlikProjektu(plik) {
  if (await plikSkladu(plik)) { await wczytajPlikSkladu(plik); return; }
  let pasek = postep(`Wczytywanie pliku „${plik.name || 'projektu'}”…`);
  try {
    const projekt = normalizuj(await odczytajPlik(plik));
    pasek.koniec(); // na czas ewentualnego pytania – bez karty postępu nad oknem
    // Plik nie wie, co jest teraz na koncie: gdy zastąpi projekt zmieniony w międzyczasie gdzie indziej,
    // aplikacja zapyta o cały projekt, zamiast łączyć zmiany (js/laczenie.js).
    delete projekt.podstawa_chmury;
    const istniejacy = await wczytajLokalnie(projekt.id);
    if (istniejacy) {
      const zastap = await potwierdz(
        'Ten projekt już istnieje',
        `„${istniejacy.nazwa}” jest już na liście. Zastąpić go wersją z pliku? „Anuluj” doda plik jako osobny projekt.`,
        'Zastąp',
      );
      if (!zastap) projekt.id = crypto.randomUUID();
    }
    if ((!istniejacy || projekt.id !== istniejacy.id) && await ponadLimit()) return;
    pasek = postep(`Otwieranie „${projekt.nazwa}”…`);
    if (stan.projekt) await zapiszTeraz();
    // Plik w miejsce projektu: dawna historia cofania do niego nie pasuje.
    if (istniejacy && projekt.id === istniejacy.id) await usunHistorie(projekt.id);
    await otworzProjekt(projekt);
    pasek.opis('Zapisywanie projektu na urządzeniu…');
    await zapiszTeraz();
    powiadom(`Wczytano „${projekt.nazwa}”.`);
  } catch (e) {
    powiadom(`Nie udało się wczytać pliku: ${e.message}`, true);
  } finally {
    pasek.koniec();
  }
}

// Pliki .makietka otwierane z systemu (zainstalowana aplikacja na komputerze).
// Wczytujemy je dopiero po zalogowaniu.
export const plikiDoOtwarcia = [];
export async function otworzOczekujacePliki() {
  while (plikiDoOtwarcia.length) await wczytajPlikProjektu(plikiDoOtwarcia.shift());
}

// Chmurki na kartach idą za stanem wysyłki (#109): po zapisie na koncie (np. tuż po wyjściu z edytora,
// gdy lista pokazała się, zanim wysyłka skończyła) i po zmianie połączenia.
const STANY_WYSYLKI = {
  chmura_ok: 'Zapisano na koncie',
  chmura_czeka: 'Czeka na wysłanie na konto',
  chmura_brak: 'Offline – zapisano na tym urządzeniu, wyślę po powrocie internetu',
};
async function odswiezStanyWysylki() {
  for (const el of document.querySelectorAll('#siatka-projektow .stan-wysylki[data-projekt]')) {
    if (el.classList.contains('chmura_ok')) continue;
    const rekord = await wczytajLokalnie(el.dataset.projekt).catch(() => null);
    const nazwa = !rekord?.doSynchronizacji ? 'chmura_ok' : (navigator.onLine ? 'chmura_czeka' : 'chmura_brak');
    if (el.classList.contains(nazwa)) continue;
    el.className = `stan-wysylki ${nazwa}`;
    el.title = STANY_WYSYLKI[nazwa];
    el.setAttribute('aria-label', STANY_WYSYLKI[nazwa]);
    el.innerHTML = ikona(nazwa, { rozmiar: 15 });
  }
}
document.addEventListener('seriodruk:zapisano-na-koncie', () => { odswiezStanyWysylki(); });
window.addEventListener('online', () => { odswiezStanyWysylki(); });
window.addEventListener('offline', () => { odswiezStanyWysylki(); });
