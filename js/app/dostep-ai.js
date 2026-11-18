// Okno „Dostęp dla AI”: klucze konta, którymi asystent AI czyta i zmienia projekty (decyzja #94, ai/api.md).
// Klucz należy do konta i zarządza się nim tylko w ustawieniach konta (Ustawienia konta → Dostęp dla AI, #100)
// i ma zakres: wybrane projekty (własne albo udostępnione mi – listę można zmieniać bez zmiany adresu) albo
// pełny dostęp (wszystkie projekty, także tworzenie i usuwanie projektów). AI dostaje co najwyżej moje
// uprawnienia. Główna droga to adres zdalnego łącznika MCP z kluczem w adresie – Claude i ChatGPT łączą się z nim
// ze swoich serwerów. Klucz pokazuje się raz – w bazie zostaje tylko jego skrót. Zmiany AI przychodzą do edytora
// tak jak zmiany z drugiego urządzenia (zapis na żywo i łączenie element po elemencie).
//
// Moduł nie zależy od edytora – okno działa także z ustawień konta (akcje w js/aplikacja.js).

import * as chmura from '../chmura.js';
import { udostepnioneMi } from '../wspolpraca-chmura.js';
import { $, powiadom, kiedy, potwierdz } from '../ui.js';
import { SUPABASE_URL } from '../konfiguracja.js';
import { ADRES_API, ADRES_LACZNIKA } from '../marka.js';
import { polecenieZAdresem, ADRES_ZASTEPCZY } from '../polecenia-ai.js';
import { stan } from './kontekst.js';
import { edytorGotowy } from './doczytaj.js';
import { DOSTAWCY } from '../ai-dostawcy.js';
import { otwartySejf, sejfKonta } from './sejf-ai.js';

const ROLE = { edycja: 'czyta i zmienia', odczyt: 'tylko czyta' };

// Adres zdalnego łącznika MCP z kluczem (do dodania jako własny łącznik w Claude / serwer MCP w ChatGPT).
// Przez przekaźnik (api.makietka.app) adres jest krótszy: …/mcp/<klucz>; wprost do bazy (np. atrapa w testach) – …/functions/v1/mcp/<klucz>.
export const adresLacznika = (klucz) => (SUPABASE_URL === ADRES_API ? `${ADRES_LACZNIKA}/${klucz}` : `${SUPABASE_URL}/functions/v1/mcp/${klucz}`);

// Projekty konta do wyboru: własne i udostępnione mi (z rolą). [{ id, nazwa, wlasciciel?, rola }]
let projekty = [];
async function wczytajProjekty() {
  const [lista, udzialy] = await Promise.all([chmura.listaWChmurze(), udostepnioneMi().catch(() => new Map())]);
  projekty = lista.map((p) => {
    const cudzy = p.owner_id && p.owner_id !== stan.uzytkownik?.id;
    const u = udzialy.get(p.id);
    return { id: p.id, nazwa: p.nazwa, wlasciciel: cudzy ? (u?.wlasciciel || 'ktoś inny') : null, rola: cudzy ? (u?.rola || 'odczyt') : 'wlasciciel' };
  });
}

// Lista projektów z polami wyboru – w nowym kluczu i przy zmianie zakresu klucza.
function listaWyboru(kontener, zaznaczone) {
  kontener.replaceChildren(...projekty.map((p) => {
    const l = document.createElement('label');
    l.className = 'przelacznik projekt-klucza';
    const pole = document.createElement('input');
    pole.type = 'checkbox';
    pole.value = p.id;
    pole.checked = zaznaczone.has(p.id);
    const tekst = document.createElement('span');
    tekst.textContent = p.nazwa;
    if (p.wlasciciel) {
      const ciche = document.createElement('span');
      ciche.className = 'ciche';
      ciche.textContent = ` – udostępnił(a): ${p.wlasciciel}${p.rola === 'odczyt' ? ' (tylko oglądasz, więc AI tylko czyta)' : ''}`;
      tekst.append(ciche);
    }
    l.append(pole, tekst);
    return l;
  }));
  if (!projekty.length) {
    const p = document.createElement('p');
    p.className = 'podpowiedz';
    p.textContent = 'Na koncie nie ma jeszcze projektów – wybierz „Pełny dostęp”, żeby AI mogło je tworzyć.';
    kontener.append(p);
  }
}
// Wybór projektów dla strony zgody łącznika (#244): lista w kontenerze, zwraca funkcję czytającą wybór.
export async function wyborProjektow(kontener) {
  await wczytajProjekty();
  listaWyboru(kontener, new Set());
  return () => wybrane(kontener);
}
const wybrane = (kontener) => [...kontener.querySelectorAll('input[type=checkbox]:checked')].map((x) => x.value);

function instrukcje(klucz) {
  const konfiguracja = {
    mcpServers: {
      makietka: {
        command: 'node',
        args: ['/ścieżka/do/makietka-mcp.mjs'],
        env: { MAKIETKA_KLUCZ: klucz },
      },
    },
  };
  $('#dostep-ai-claude-desktop').textContent = JSON.stringify(konfiguracja, null, 2);
  $('#dostep-ai-claude-code').textContent = `claude mcp add --transport http makietka ${adresLacznika(klucz)}`;
}

// Polecenie „Podłącz Makietkę” (#107, ten sam tekst co w instrukcji – js/polecenia-ai.js). adres – adres łącznika
// z kluczem, widoczny tylko zaraz po utworzeniu klucza; wtedy polecenie i komenda Claude Code mają go już wpisanego.
let adresWOknie = '';
// Zwykły czat bez łączników (#239): adres otwarty jak strona – opis i narzędzia w tekście.
export const polecenieZwyklegoCzatu = (adres) => `Pracujesz z moim projektem w Makietce (edytor publikacji do druku). Otwórz ten adres – to strona z zasadami i narzędziami Makietki dla AI. Adres jest przygotowany dla Ciebie w tej rozmowie; linki ze strony otwieraj sam, dokładnie tak, jak są podane (pełny adres):
${adres}

Narzędzia wywołujesz, otwierając adresy podane na tej stronie (https://api.makietka.app/mcp/…/n/<narzędzie>?parametr=wartość). Zacznij od przeglądu projektu, zmieniaj małymi krokami i po każdej zmianie sprawdź wynik. Gdy któregoś adresu naprawdę nie możesz otworzyć, napisz mi to krótko – wtedy przejdziemy na tryb „kopiuj i wklej”.

Na początek otwórz narzędzie projekty (link na stronie), pokaż mi moje projekty i zapytaj, co mam zrobić.`;
function pokazPolecenia(adres = '') {
  adresWOknie = adres;
  const zw = $('#dostep-ai-polecenie-zwykly');
  if (zw) zw.textContent = adres ? polecenieZwyklegoCzatu(adres) : '';
  $('#dostep-ai-polecenie').textContent = polecenieZAdresem(adres);
  $('#dostep-ai-polecenie-code').textContent = `claude mcp add --transport http makietka ${adres || ADRES_ZASTEPCZY}`;
}

export async function kopiujPolecenieAi() {
  try {
    await navigator.clipboard.writeText(polecenieZAdresem(adresWOknie));
    powiadom('Skopiowano polecenie – wklej je w rozmowie ze swoim AI.');
  } catch {
    powiadom('Nie udało się skopiować – zaznacz tekst polecenia i skopiuj go ręcznie.', true);
  }
}

export async function kopiujPolecenieZwykle() {
  try {
    await navigator.clipboard.writeText(polecenieZwyklegoCzatu(adresWOknie));
    powiadom('Skopiowano – wklej w rozmowie ze zwykłym czatem.');
  } catch {
    powiadom('Nie udało się skopiować – zaznacz tekst i skopiuj go ręcznie.', true);
  }
}

const opisZakresu = (d) => (d.zakres === 'pelny'
  ? 'pełny dostęp – wszystkie projekty, tworzenie i usuwanie'
  : (d.projekty?.length ? d.projekty.map((p) => `„${p.nazwa}”`).join(', ') : 'żadnego projektu (dodaj w „Zmień zakres”)'));
const opisWaznosci = (d) => (d.wazny_do ? `ważny do ${new Date(d.wazny_do).toLocaleDateString('pl-PL')}` : 'bez terminu');

function przyciskiZakresu(nazwa, zakres) {
  const w = document.createElement('div');
  w.className = 'zakres-klucza';
  w.setAttribute('role', 'radiogroup');
  for (const [wartosc, etykieta] of [['wybrane', 'Wybrane projekty'], ['pelny', 'Pełny dostęp']]) {
    const l = document.createElement('label');
    l.className = 'przelacznik';
    const r = document.createElement('input');
    r.type = 'radio';
    r.name = nazwa;
    r.value = wartosc;
    r.checked = zakres === wartosc;
    const s = document.createElement('span');
    s.textContent = etykieta;
    l.append(r, s);
    w.append(l);
  }
  return w;
}

// Zmiana zakresu istniejącego klucza – w miejscu, pod kluczem na liście.
function edytorZakresu(li, d) {
  if (li.querySelector('.zmiana-zakresu')) { li.querySelector('.zmiana-zakresu').remove(); return; }
  const box = document.createElement('div');
  box.className = 'zmiana-zakresu';
  const radia = przyciskiZakresu(`zakres-${d.id}`, d.zakres);
  const lista = document.createElement('div');
  lista.className = 'lista-projektow-klucza';
  listaWyboru(lista, new Set((d.projekty || []).map((p) => p.id)));
  const pokaz = () => { lista.hidden = radia.querySelector('input:checked')?.value === 'pelny'; };
  radia.addEventListener('change', pokaz);
  pokaz();
  const zapisz = document.createElement('button');
  zapisz.type = 'button';
  zapisz.className = 'przycisk glowny';
  zapisz.textContent = 'Zapisz zakres';
  zapisz.addEventListener('click', async () => {
    const zakres = radia.querySelector('input:checked')?.value || 'wybrane';
    try {
      await chmura.zmienDostepAi(d.id, { zakres, projekty: zakres === 'pelny' ? [] : wybrane(lista) });
      powiadom('Zakres klucza zmieniony – adres łącznika zostaje ten sam.');
      odswiezListe();
    } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
  });
  const rzad = document.createElement('div');
  rzad.className = 'rzad-przyciskow';
  rzad.append(zapisz);
  box.append(radia, lista, rzad);
  li.append(box);
}

async function odswiezListe() {
  const ul = $('#dostep-ai-lista');
  let lista = [];
  try {
    lista = await chmura.dostepyAi();
  } catch (e) {
    powiadom(chmura.komunikatBledu(e), true);
  }
  const aktywne = lista.filter((d) => d.aktywny);
  ul.replaceChildren(...aktywne.map((d) => {
    const li = document.createElement('li');
    li.dataset.id = d.id;
    const opis = document.createElement('div');
    const tytul = document.createElement('strong');
    tytul.textContent = d.opis || 'Klucz bez opisu';
    const zakres = document.createElement('span');
    zakres.className = 'zakres-opis';
    zakres.textContent = opisZakresu(d);
    const szczegoly = document.createElement('span');
    szczegoly.className = 'ciche';
    szczegoly.textContent = `${ROLE[d.rola] || d.rola} · ${opisWaznosci(d)} · ${d.ostatnie_uzycie ? `ostatnio użyty ${kiedy(d.ostatnie_uzycie)}` : 'jeszcze nieużyty'}`;
    opis.append(tytul, zakres, szczegoly);
    const akcje = document.createElement('div');
    akcje.className = 'klucz-akcje';
    const zmien = document.createElement('button');
    zmien.type = 'button';
    zmien.className = 'przycisk';
    zmien.textContent = 'Zmień zakres';
    zmien.addEventListener('click', () => edytorZakresu(li, d));
    const odbierz = document.createElement('button');
    odbierz.type = 'button';
    odbierz.className = 'przycisk niebezpieczny';
    odbierz.textContent = 'Odbierz';
    odbierz.addEventListener('click', async () => {
      if (!await potwierdz('Odebrać klucz?', `Klucz „${d.opis || 'bez opisu'}” przestanie działać od razu – AI straci dostęp do wszystkich projektów tego klucza.`, 'Odbierz', true)) return;
      try {
        await chmura.odwolajDostepAi(d.id);
        powiadom('Klucz odebrany.');
      } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
      odswiezListe();
    });
    akcje.append(zmien, odbierz);
    li.append(opis, akcje);
    return li;
  }));
  pokazPusto();
  return aktywne;
}

function pokazZakresNowego() {
  const pelny = $('#dostep-ai-nowy input[name="dostep-ai-zakres"]:checked')?.value === 'pelny';
  $('#dostep-ai-projekty').hidden = pelny;
}

// ---------- Tryby panelu (#248): lista „Twoje klucze” → „Dodaj klucz” → rodzaj → formularz ----------
// lista – wszystkie klucze (API dostawców i klucze dostępu) w jednym miejscu; wybor – jaki klucz dodajesz;
// czat – klucz API dostawcy (sejf); lacznik / zwykly – nowy klucz dostępu z odpowiednimi wskazówkami.
const TRYBY = ['lista', 'wybor', 'czat', 'lacznik', 'zwykly'];

export function ustawZakladkeAi(z) {
  const tryb = TRYBY.includes(z) ? z : 'lista';
  const panel = $('#dostep-ai');
  const poprzedni = panel.dataset.tryb;
  panel.dataset.tryb = tryb;
  if (tryb === 'lista') { rysujDostawcow(); odswiezListe(); }
  if (tryb === 'czat') przygotujKluczDostawcy();
  if ((tryb === 'lacznik' || tryb === 'zwykly') && poprzedni !== tryb) {
    $('#dostep-ai-gotowy').hidden = true;
    $('#dostep-ai-klucz').value = '';
    $('#dostep-ai-adres').value = '';
    pokazPolecenia();
  }
}

function pokazPusto() {
  $('#dostep-ai-pusto').hidden = $('#ai-dostawcy-lista').children.length + $('#dostep-ai-lista').children.length > 0;
}

const przyciskAi = (tekst, fn, glowny = false) => { const b = Object.assign(document.createElement('button'), { type: 'button', className: `przycisk${glowny ? ' glowny' : ''}`, textContent: tekst }); b.addEventListener('click', fn); return b; };

// Na liście: tylko zapisane klucze dostawców (albo jeden wiersz „zaszyfrowane”, gdy sejf na tym urządzeniu zamknięty).
async function rysujDostawcow() {
  const lista = $('#ai-dostawcy-lista');
  const akcje = $('#ai-sejf-akcje');
  const s = sejfKonta();
  if (!s) return;
  let st;
  try { st = await s.stan(); } catch (e) { lista.replaceChildren(); powiadom(chmura.komunikatBledu(e), true); return; }
  const wiersz = (tytul, opis, ...przyciski) => {
    const li = document.createElement('li');
    const o = document.createElement('div');
    o.append(Object.assign(document.createElement('strong'), { className: 'nazwa-dostawcy', textContent: tytul }), Object.assign(document.createElement('span'), { className: 'stan-klucza', textContent: opis }));
    li.append(o, ...przyciski);
    return li;
  };
  if (st === 'zamkniety') {
    lista.replaceChildren(wiersz('Klucze API dostawców', 'zaszyfrowane – na tym urządzeniu podaj hasło do kluczy',
      przyciskAi('Otwórz', async () => { if (await otwartySejf()) rysujDostawcow(); }, true)));
  } else {
    lista.replaceChildren(...Object.entries(DOSTAWCY).filter(([id, d]) => !d.bezKlucza && st === 'otwarty' && s.klucz(id)).map(([id, d]) => wiersz(
      d.nazwa, `klucz API do Asystenta AI w edytorze · zaszyfrowany (…${s.klucz(id).slice(-4)})`,
      przyciskAi('Usuń', async () => { await s.ustaw(id, ''); rysujDostawcow(); }),
    )));
  }
  akcje.replaceChildren(...(st === 'otwarty' && lista.children.length
    ? [przyciskAi('Zamknij klucze API na tym urządzeniu', async () => { await s.zamknij(); rysujDostawcow(); }),
      przyciskAi('Usuń wszystkie klucze API z konta', async () => { if (await potwierdz('Usunąć zapisane klucze API?', 'Wszystkie klucze dostawców znikną z konta (także na innych urządzeniach). Hasło do kluczy przestanie być potrzebne.', 'Usuń')) { await s.usun(); rysujDostawcow(); } })]
    : []));
  pokazPusto();
}

// Formularz „Klucz API dostawcy”: dostawca z listy, klucz, „Gdzie wziąć klucz?”.
function przygotujKluczDostawcy() {
  const wybor = $('#ai-nowy-dostawca');
  if (!wybor.options.length) {
    wybor.replaceChildren(...Object.entries(DOSTAWCY).filter(([, d]) => !d.bezKlucza).map(([id, d]) => new Option(d.nazwa, id)));
    wybor.addEventListener('change', gdzieWziac);
  }
  $('#ai-nowy-klucz').value = '';
  gdzieWziac();
}
function gdzieWziac() {
  const d = DOSTAWCY[$('#ai-nowy-dostawca').value];
  const a = $('#ai-nowy-gdzie');
  a.hidden = !d?.kluczUrl;
  if (d?.kluczUrl) a.href = d.kluczUrl;
}
export async function zapiszKluczDostawcy() {
  const pole = $('#ai-nowy-klucz');
  const id = $('#ai-nowy-dostawca').value;
  const v = pole.value.trim();
  if (!v) { pole.focus(); return; }
  const sejf = await otwartySejf();
  if (!sejf) return;
  await sejf.ustaw(id, v);
  pole.value = '';
  powiadom(`Klucz ${DOSTAWCY[id].nazwa} zapisany – zaszyfrowany Twoim hasłem do kluczy.`);
  ustawZakladkeAi('lista');
}

// Panel AI (#247) mieszka w ustawieniach konta (sekcja „Sztuczna inteligencja”) – bez osobnego okna. Poza ustawieniami
// (np. z edytora) ten sam panel pokazuje się w oknie i wraca na miejsce po zamknięciu.
const wUstawieniach = () => document.body.dataset.ekran === 'konto';
function przeniesPanel(doOkna) {
  const panel = $('#dostep-ai');
  const cel = doOkna ? $('#dlg-dostep-ai .miejsce-panelu-ai') : $('#ust-ai');
  if (panel.parentElement !== cel) cel.append(panel);
}

// Otwiera panel. zakladka – tryb na start (domyślnie lista); projektId – projekt zaznaczony na liście nowego klucza.
export async function otworzDostepAi({ projektId = null, zakladka = 'lista' } = {}) {
  if (!stan.uzytkownik) { powiadom('Ustawienia sztucznej inteligencji wymagają zalogowania.', true); return; }
  const wOknie = !wUstawieniach();
  przeniesPanel(wOknie);
  ustawZakladkeAi(zakladka);
  $('#dostep-ai-gotowy').hidden = true;
  $('#dostep-ai-klucz').value = '';
  $('#dostep-ai-adres').value = '';
  $('#dostep-ai-opis').value = '';
  pokazPolecenia();
  const zakres = $(`#dostep-ai-nowy input[name="dostep-ai-zakres"][value="wybrane"]`);
  if (zakres) zakres.checked = true;
  if (wOknie && !$('#dlg-dostep-ai').open) $('#dlg-dostep-ai').showModal();
  try {
    // Otwarty projekt musi być na koncie, żeby dało się go wybrać.
    const modul = edytorGotowy();
    if (stan.projekt && modul) { await modul.zapiszTeraz(); await modul.synchronizuj(); }
    await wczytajProjekty();
  } catch (e) {
    powiadom(chmura.komunikatBledu(e), true);
  }
  listaWyboru($('#dostep-ai-projekty'), new Set(projektId ? [projektId] : []));
  pokazZakresNowego();
  odswiezListe();
}

export async function utworzKluczAi() {
  const przycisk = $('[data-akcja="dostep-ai-utworz"]');
  przycisk.disabled = true;
  try {
    const zakres = $('#dostep-ai-nowy input[name="dostep-ai-zakres"]:checked')?.value || 'wybrane';
    const dni = $('#dostep-ai-dni').value;
    const wynik = await chmura.utworzKluczAi({
      opis: $('#dostep-ai-opis').value.trim(),
      rola: $('#dostep-ai-rola').value,
      dni: dni === 'bez' ? null : Number(dni) || 30,
      zakres,
      projekty: zakres === 'pelny' ? [] : wybrane($('#dostep-ai-projekty')),
    });
    $('#dostep-ai-klucz').value = wynik.klucz;
    $('#dostep-ai-adres').value = adresLacznika(wynik.klucz);
    instrukcje(wynik.klucz);
    pokazPolecenia(adresLacznika(wynik.klucz));
    $('#dostep-ai-aplikacje').open = true;
    $('#dostep-ai-gotowy').hidden = false;
    $('#dostep-ai-adres').select();
    odswiezListe();
    document.dispatchEvent(new CustomEvent('makietka:klucze-ai'));
  } catch (e) {
    powiadom(chmura.komunikatBledu(e), true);
  } finally {
    przycisk.disabled = false;
  }
}

async function kopiuj(pole, co) {
  try {
    await navigator.clipboard.writeText(pole.value);
    powiadom(`${co[0].toUpperCase()}${co.slice(1)} skopiowany.`);
  } catch {
    pole.select();
    powiadom(`Zaznaczyłem ${co} – skopiuj go skrótem Ctrl+C.`);
  }
}

export const kopiujKluczAi = () => kopiuj($('#dostep-ai-klucz'), 'klucz');
export const kopiujAdresAi = () => kopiuj($('#dostep-ai-adres'), 'adres');

export function zamknijDostepAi() {
  pokazPolecenia();
  // Klucz (także w adresie i poleceniach) nie zostaje w oknie po zamknięciu.
  for (const id of ['#dostep-ai-klucz', '#dostep-ai-adres']) $(id).value = '';
  for (const id of ['#dostep-ai-claude-code', '#dostep-ai-claude-desktop']) $(id).textContent = '';
  if ($('#dlg-dostep-ai').open) $('#dlg-dostep-ai').close();
  przeniesPanel(false);
  document.dispatchEvent(new CustomEvent('makietka:klucze-ai'));
}

$('#dlg-dostep-ai').addEventListener('close', () => przeniesPanel(false));
$('#dostep-ai').addEventListener('click', (e) => { const b = e.target.closest('[data-tryb-ai]'); if (b) ustawZakladkeAi(b.dataset.trybAi); });
$('#dostep-ai-nowy').addEventListener('change', (e) => { if (e.target.name === 'dostep-ai-zakres') pokazZakresNowego(); });

// Krótkie podsumowanie w ustawieniach konta: ile kluczy działa.
export async function podsumowanieKluczy() {
  const el = $('#ust-ai-opis');
  if (!el) return;
  try {
    const aktywne = (await chmura.dostepyAi()).filter((d) => d.aktywny);
    el.textContent = aktywne.length
      ? `Aktywne klucze: ${aktywne.length} – ${aktywne.slice(0, 3).map((d) => `„${d.opis || 'bez opisu'}” (${d.zakres === 'pelny' ? 'pełny dostęp' : `projekty: ${d.projekty.length}`})`).join(', ')}${aktywne.length > 3 ? '…' : ''}.`
      : 'Nie masz jeszcze żadnego klucza.';
  } catch { el.textContent = ''; }
}

document.addEventListener('makietka:klucze-ai', () => { podsumowanieKluczy(); });
