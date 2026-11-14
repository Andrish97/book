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
import { wstawIkony } from '../ikony.js';
import { SUPABASE_URL } from '../konfiguracja.js';
import { ADRES_API, ADRES_LACZNIKA } from '../marka.js';
import { POLECENIA_AI, tekstPolecenia, ADRES_ZASTEPCZY } from '../polecenia-ai.js';
import { stan } from './kontekst.js';
import { edytorGotowy } from './doczytaj.js';

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

// Gotowe polecenia dla AI (#107, te same co w instrukcji – js/polecenia-ai.js). adres – adres łącznika z kluczem,
// widoczny tylko zaraz po utworzeniu klucza; wtedy polecenia i komenda Claude Code mają go już wpisanego.
let adresWOknie = '';
function pokazPolecenia(adres = '') {
  adresWOknie = adres;
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  $('#dostep-ai-lista-polecen').innerHTML = POLECENIA_AI.map((p) => `<div class="prompt-instrukcji"><div class="prompt-naglowek"><b>${p.tytul}</b>`
    + `<button type="button" class="przycisk" data-kopiuj-polecenie-ai="${p.id}" data-ikona="kopiuj">Kopiuj</button></div>`
    + `<p class="ciche">${p.opis}</p><pre>${esc(tekstPolecenia(p, adres))}</pre></div>`).join('');
  wstawIkony($('#dostep-ai-lista-polecen'));
  $('#dostep-ai-polecenie-code').textContent = `claude mcp add --transport http makietka ${adres || ADRES_ZASTEPCZY}`;
}

export async function kopiujPolecenieAi(id) {
  const p = POLECENIA_AI.find((x) => x.id === id);
  if (!p) return;
  try {
    await navigator.clipboard.writeText(tekstPolecenia(p, adresWOknie));
    powiadom(`Skopiowano polecenie „${p.tytul}”.`);
  } catch {
    powiadom('Nie udało się skopiować – zaznacz tekst polecenia i skopiuj go ręcznie.', true);
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
  $('#dostep-ai-pusto').hidden = aktywne.length > 0;
  return aktywne;
}

function pokazZakresNowego() {
  const pelny = $('#dostep-ai-nowy input[name="dostep-ai-zakres"]:checked')?.value === 'pelny';
  $('#dostep-ai-projekty').hidden = pelny;
}

// Otwiera okno (z ustawień konta). projektId – projekt zaznaczony na liście nowego klucza (domyślnie żaden).
export async function otworzDostepAi({ projektId = null } = {}) {
  if (!stan.uzytkownik) { powiadom('Dostęp dla AI wymaga zalogowania.', true); return; }
  $('#dostep-ai-gotowy').hidden = true;
  $('#dostep-ai-klucz').value = '';
  $('#dostep-ai-adres').value = '';
  $('#dostep-ai-opis').value = '';
  pokazPolecenia();
  const zakres = $(`#dostep-ai-nowy input[name="dostep-ai-zakres"][value="wybrane"]`);
  if (zakres) zakres.checked = true;
  $('#dlg-dostep-ai').showModal();
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
  $('#dlg-dostep-ai').close();
  document.dispatchEvent(new CustomEvent('makietka:klucze-ai'));
}

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
