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
import { wstawIkony } from '../ikony.js';
import { otwartySejf, sejfKonta } from './sejf-ai.js';

const ROLE = { edycja: 'czyta i zmienia', odczyt: 'tylko czyta' };
// Drobniejsze zakresy (#252) – pilnuje baza (ai_zakres_brak). Brak listy (null) – wszystko.
const UPRAWNIENIA = [
  ['strony', 'dodawać, usuwać i przestawiać strony'],
  ['wzorce', 'zmieniać wzorce i style'],
  ['tabele', 'zmieniać tabele danych i serie'],
  ['obrazy', 'wgrywać, wymieniać i usuwać obrazy'],
  ['eksport', 'robić pliki PDF i PNG'],
];
const KROTKO = { strony: 'stron', wzorce: 'wzorców i stylów', tabele: 'tabel i serii', obrazy: 'obrazów', eksport: 'PDF/PNG' };
const opisUprawnien = (d) => (Array.isArray(d.uprawnienia)
  ? (() => { const bez = UPRAWNIENIA.filter(([k]) => !d.uprawnienia.includes(k)).map(([k]) => KROTKO[k]); return bez.length ? ` · bez: ${bez.join(', ')}` : ''; })()
  : '');
// Pola wyboru zakresów w kontenerze; zwraca funkcję czytającą wybór (null, gdy zaznaczone wszystko).
function poleUprawnien(kontener, wybrane) {
  const legenda = kontener.querySelector('legend');
  kontener.replaceChildren(...(legenda ? [legenda] : []), ...UPRAWNIENIA.map(([k, t]) => {
    const l = document.createElement('label');
    l.className = 'przelacznik';
    const pole = Object.assign(document.createElement('input'), { type: 'checkbox', value: k, checked: !Array.isArray(wybrane) || wybrane.includes(k) });
    l.append(pole, Object.assign(document.createElement('span'), { textContent: t }));
    return l;
  }));
  return () => {
    const tak = [...kontener.querySelectorAll('input:checked')].map((x) => x.value);
    return tak.length === UPRAWNIENIA.length ? null : tak;
  };
}

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
// Część czatów (np. ChatGPT) otwiera tylko adresy wklejone przez użytkownika – nie linki znalezione na stronie – więc
// adresy narzędzi do odczytu są w poleceniu wprost (#253).
export const polecenieZwyklegoCzatu = (adres) => `Pracujesz z moim projektem w Makietce (edytor publikacji do druku). Poniżej są adresy przygotowane dla Ciebie w tej rozmowie – otwieraj je dokładnie tak, jak są podane (pełny adres).

Zasady i lista narzędzi Makietki:
${adres}

Moje projekty:
${adres}/n/projekty

Przegląd projektu (gdy mam kilka projektów, dopisz ?projekt=<id albo nazwa>):
${adres}/n/przeglad_projektu

Opis formatu projektu:
${adres}/n/opis_formatu

Pozostałe narzędzia wywołujesz, otwierając adresy ${adres}/n/<narzędzie>?parametr=wartość (opis na stronie zasad). Zmieniaj małymi krokami i po każdej zmianie sprawdź wynik. Jeśli Twoja przeglądarka nie otworzy adresu, który sam zbudowałeś, napisz mi to krótko – zmiany zrobimy wtedy w Makietce przez Asystenta AI w trybie „kopiuj i wklej”.

Na początek otwórz adres „Moje projekty”, pokaż mi moje projekty i zapytaj, co mam zrobić.`;
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

// ---------- Lista kluczy (#248): trzy sekcje – czat w Makietce, łącznik w aplikacji AI, zwykły czat ----------
// Klucz dostępu trafia do sekcji według „sposob” (ustawiany przy tworzeniu); starsze klucze – z opisu.
const sposobKlucza = (d) => d.sposob || (d.opis === 'Czat w Makietce' ? 'czat' : 'lacznik');
// W sejfie (zaszyfrowany hasłem do kluczy) – żeby dało się pokazać klucz jeszcze raz.
const wSejfie = (id) => `dostep:${id}`;
const DNI = [['1', '1 dzień'], ['7', '7 dni'], ['30', '30 dni'], ['90', '90 dni'], ['365', 'rok'], ['bez', 'bez terminu']];

const przyciskAi = (tekst, fn, klasa = '') => { const b = Object.assign(document.createElement('button'), { type: 'button', className: `przycisk${klasa ? ` ${klasa}` : ''}`, textContent: tekst }); b.addEventListener('click', fn); return b; };
const el = (tag, wlasnosci = {}, ...dzieci) => { const e = Object.assign(document.createElement(tag), wlasnosci); e.append(...dzieci); return e; };

function pokazPusto() {
  for (const sekcja of document.querySelectorAll('#dostep-ai .sekcja-kluczy-ai')) {
    const ile = [...sekcja.querySelectorAll('.lista-dostawcow-ai, .lista-dostepow')].reduce((n, ul) => n + ul.children.length, 0);
    sekcja.querySelector('.pusto-kluczy').hidden = ile > 0;
  }
}

async function kopiujTekst(tekst, co) {
  try { await navigator.clipboard.writeText(tekst); powiadom(`${co} skopiowany.`); } catch { powiadom('Nie udało się skopiować – zaznacz tekst i skopiuj go ręcznie.', true); }
}

// ---------- Edycja klucza – okienko (#248), spójne z dodawaniem ----------

function oknoEdycji(tytul) {
  let dlg = $('#dlg-edytuj-klucz-ai');
  if (!dlg) {
    dlg = el('dialog', { id: 'dlg-edytuj-klucz-ai', className: 'dialog-szeroki' });
    document.body.append(dlg);
    dlg.addEventListener('close', () => { dlg.querySelector('.formularz')?.remove(); rysujDostawcow(); odswiezListe(); document.dispatchEvent(new CustomEvent('makietka:klucze-ai')); });
  }
  dlg.querySelector('.formularz')?.remove();
  const zamknij = Object.assign(document.createElement('button'), { type: 'button', className: 'przycisk-ikona' });
  zamknij.dataset.ikona = 'zamknij';
  zamknij.setAttribute('aria-label', 'Zamknij');
  zamknij.addEventListener('click', () => dlg.close());
  const tresc = el('div', { className: 'formularz' }, el('div', { className: 'naglowek-dialogu' }, el('h2', { textContent: tytul }), zamknij));
  dlg.append(tresc);
  wstawIkony(dlg);
  return { dlg, tresc };
}

// Miejsce na pokazany klucz: przycisk „Pokaż klucz” → tekst do skopiowania (z sejfu).
function miejsceKlucza(pobierz) {
  const box = el('div', { className: 'klucz-pokazany' });
  const pokaz = przyciskAi('Pokaż klucz', async () => {
    const w = await pobierz();
    if (!w) return;
    box.replaceChildren(...(w.brak
      ? [el('p', { className: 'podpowiedz', textContent: w.brak })]
      : [el('pre', { textContent: w.tekst }), el('div', { className: 'rzad-przyciskow' }, ...w.przyciski)]));
  });
  box.append(pokaz);
  return box;
}

async function kluczZSejfu(nazwa) {
  const s = sejfKonta();
  const st = s ? await s.stan().catch(() => 'brak') : 'brak';
  if (st === 'brak') return '';
  const sejf = await otwartySejf();
  if (!sejf) return null;
  return sejf.klucz(nazwa) || '';
}

export function edytujKluczAi(d) {
  const { dlg, tresc } = oknoEdycji(`Klucz: ${d.opis || 'bez opisu'}`);
  const sposob = sposobKlucza(d);
  tresc.append(el('p', { className: 'podpowiedz', textContent: `${ROLE[d.rola] || d.rola} · ${d.aktywny ? opisWaznosci(d) : 'wygasł'} · ${d.ostatnie_uzycie ? `ostatnio użyty ${kiedy(d.ostatnie_uzycie)}` : 'jeszcze nieużyty'}` }));

  // Klucz jeszcze raz.
  tresc.append(el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: sposob === 'zwykly' ? 'Polecenie dla czatu' : 'Adres łącznika' }), miejsceKlucza(async () => {
    const klucz = await kluczZSejfu(wSejfie(d.id));
    if (klucz === null) return null;
    if (!klucz) return { brak: 'Tego klucza Makietka nie zapamiętała (utworzony wcześniej, przez logowanie w aplikacji AI albo bez hasła do kluczy). Jeśli go nie masz – odbierz go i dodaj nowy.' };
    const adres = adresLacznika(klucz);
    const tekst = sposob === 'zwykly' ? polecenieZwyklegoCzatu(adres) : adres;
    return { tekst, przyciski: [przyciskAi(sposob === 'zwykly' ? 'Kopiuj polecenie' : 'Kopiuj adres', () => kopiujTekst(tekst, sposob === 'zwykly' ? 'Tekst' : 'Adres')), przyciskAi('Kopiuj sam klucz', () => kopiujTekst(klucz, 'Klucz'))] };
  })));

  // Zakres.
  const radia = przyciskiZakresu(`zakres-${d.id}`, d.zakres);
  const lista = el('div', { className: 'lista-projektow-klucza' });
  listaWyboru(lista, new Set((d.projekty || []).map((p) => p.id)));
  const pokazListe = () => { lista.hidden = radia.querySelector('input:checked')?.value === 'pelny'; };
  radia.addEventListener('change', pokazListe);
  pokazListe();
  tresc.append(el('fieldset', { className: 'grupa-pol zmiana-zakresu' }, el('legend', { textContent: 'Zakres' }), radia, lista));
  let czytajUprawnienia = null;
  if (d.rola === 'edycja') {
    const pola = el('fieldset', { className: 'uprawnienia-klucza' }, el('legend', { textContent: 'Przy zmianach AI może też' }));
    czytajUprawnienia = poleUprawnien(pola, d.uprawnienia);
    tresc.append(el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: 'Uprawnienia' }), pola));
  }

  // Ważność – od dziś.
  const wybor = el('select', { id: 'edytuj-klucz-dni' });
  wybor.append(new Option('bez zmian', ''), ...DNI.map(([v, t]) => new Option(v === 'bez' ? t : `${t} od dziś`, v)));
  tresc.append(el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: 'Ważność' }),
    el('label', { className: 'pole' }, el('span', { textContent: d.aktywny ? `Teraz: ${opisWaznosci(d)}` : 'Klucz wygasł – ustaw nowy czas' }), wybor)));

  const blad = el('p', { className: 'blad-polaczenia', hidden: true });
  blad.setAttribute('role', 'alert');
  tresc.append(blad, el('div', { className: 'przyciski-dialogu' },
    przyciskAi('Odbierz klucz', async () => {
      if (!await potwierdz('Odebrać klucz?', `Klucz „${d.opis || 'bez opisu'}” przestanie działać od razu – AI straci dostęp do wszystkich projektów tego klucza.`, 'Odbierz', true)) return;
      try {
        await chmura.odwolajDostepAi(d.id);
        const s = sejfKonta();
        if (s && s.klucz(wSejfie(d.id))) await s.ustaw(wSejfie(d.id), '').catch(() => {});
        powiadom('Klucz odebrany.');
        dlg.close();
      } catch (e) { blad.textContent = chmura.komunikatBledu(e); blad.hidden = false; }
    }, 'niebezpieczny'),
    przyciskAi('Zapisz zmiany', async () => {
      try {
        const zakres = radia.querySelector('input:checked')?.value || 'wybrane';
        const projektyNowe = zakres === 'pelny' ? [] : wybrane(lista);
        const stare = (d.projekty || []).map((p) => p.id).sort().join();
        if (zakres !== d.zakres || (zakres === 'wybrane' && projektyNowe.slice().sort().join() !== stare)) await chmura.zmienDostepAi(d.id, { zakres, projekty: projektyNowe });
        if (wybor.value) await chmura.zmienWaznoscAi(d.id, wybor.value === 'bez' ? null : Number(wybor.value));
        if (czytajUprawnienia) {
          const u = czytajUprawnienia();
          if (JSON.stringify(u) !== JSON.stringify(d.uprawnienia ?? null)) await chmura.ustawUprawnieniaAi(d.id, u);
        }
        powiadom('Klucz zmieniony – adres zostaje ten sam.');
        dlg.close();
      } catch (e) { blad.textContent = chmura.komunikatBledu(e); blad.hidden = false; }
    }, 'glowny')));
  if (!dlg.open) dlg.showModal();
  // Projekty mogą jeszcze dochodzić (pierwsze otwarcie) – odśwież listę wyboru, gdy będą.
  if (!projekty.length) wczytajProjekty().then(() => { listaWyboru(lista, new Set((d.projekty || []).map((p) => p.id))); pokazListe(); }).catch(() => {});
}

function edytujKluczDostawcy(id) {
  const d = DOSTAWCY[id];
  const { dlg, tresc } = oknoEdycji(`Klucz API: ${d.nazwa}`);
  const s = sejfKonta();
  tresc.append(el('p', { className: 'podpowiedz', textContent: `Do Asystenta AI w edytorze. Zaszyfrowany Twoim hasłem do kluczy (…${s.klucz(id).slice(-4)}).` }));
  tresc.append(el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: 'Klucz' }), miejsceKlucza(async () => ({
    tekst: s.klucz(id), przyciski: [przyciskAi('Kopiuj', () => kopiujTekst(s.klucz(id), 'Klucz'))],
  }))));
  const nowy = el('input', { type: 'password', id: 'edytuj-klucz-dostawcy', autocomplete: 'off', spellcheck: false, placeholder: 'Wklej nowy klucz, żeby zamienić' });
  const gdzie = d.kluczUrl ? el('a', { href: d.kluczUrl, target: '_blank', rel: 'noopener', textContent: 'Gdzie wziąć klucz?' }) : '';
  tresc.append(el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: 'Zamień klucz' }), el('label', { className: 'pole' }, el('span', { textContent: 'Nowy klucz API' }), nowy), el('p', { className: 'podpowiedz' }, gdzie)));
  tresc.append(el('div', { className: 'przyciski-dialogu' },
    przyciskAi('Usuń klucz', async () => {
      if (!await potwierdz(`Usunąć klucz ${d.nazwa}?`, 'Asystent AI nie będzie mógł używać tego dostawcy, dopóki nie wkleisz klucza od nowa.', 'Usuń', true)) return;
      await s.ustaw(id, '');
      dlg.close();
    }, 'niebezpieczny'),
    przyciskAi('Zapisz', async () => {
      const v = nowy.value.trim();
      if (v) { await s.ustaw(id, v); powiadom(`Klucz ${d.nazwa} zamieniony.`); }
      dlg.close();
    }, 'glowny')));
  if (!dlg.open) dlg.showModal();
}

function wierszKlucza(d) {
  const li = document.createElement('li');
  li.dataset.id = d.id;
  const zakres = el('span', { className: 'zakres-opis', textContent: opisZakresu(d) });
  const szczegoly = el('span', { className: 'ciche', textContent: `${ROLE[d.rola] || d.rola}${d.rola === 'edycja' ? opisUprawnien(d) : ''} · ${d.aktywny ? opisWaznosci(d) : 'wygasł'} · ${d.ostatnie_uzycie ? `ostatnio użyty ${kiedy(d.ostatnie_uzycie)}` : 'jeszcze nieużyty'}` });
  li.append(el('div', {}, el('strong', { textContent: d.opis || 'Klucz bez opisu' }), zakres, szczegoly),
    el('div', { className: 'klucz-akcje' }, przyciskAi('Edytuj', () => edytujKluczAi(d))));
  return li;
}

async function odswiezListe() {
  let lista = [];
  try {
    lista = await chmura.dostepyAi();
  } catch (e) {
    powiadom(chmura.komunikatBledu(e), true);
  }
  const widoczne = lista.filter((d) => !d.odwolany);
  for (const sposob of ['czat', 'lacznik', 'zwykly']) {
    $(`#dostep-ai-lista-${sposob}`).replaceChildren(...widoczne.filter((d) => sposobKlucza(d) === sposob).map(wierszKlucza));
  }
  pokazPusto();
  return widoczne.filter((d) => d.aktywny);
}

function pokazZakresNowego() {
  const pelny = $('#dostep-ai-nowy input[name="dostep-ai-zakres"]:checked')?.value === 'pelny';
  $('#dostep-ai-projekty').hidden = pelny;
}

// Klucze API dostawców (sejf): zapisane – z „Edytuj”; sejf zamknięty na tym urządzeniu – „Otwórz”.
async function rysujDostawcow() {
  const lista = $('#ai-dostawcy-lista');
  const akcje = $('#ai-sejf-akcje');
  const s = sejfKonta();
  if (!s) return;
  let st;
  try { st = await s.stan(); } catch (e) { lista.replaceChildren(); powiadom(chmura.komunikatBledu(e), true); return; }
  const wiersz = (tytul, opis, przycisk) => el('li', {},
    el('div', {}, el('strong', { className: 'nazwa-dostawcy', textContent: tytul }), el('span', { className: 'stan-klucza', textContent: opis })),
    el('div', { className: 'klucz-akcje' }, przycisk));
  if (st === 'zamkniety') {
    lista.replaceChildren(wiersz('Klucze API dostawców', 'zaszyfrowane – na tym urządzeniu podaj hasło do kluczy',
      przyciskAi('Otwórz', async () => { if (await otwartySejf()) { rysujDostawcow(); odswiezListe(); } }, 'glowny')));
  } else {
    lista.replaceChildren(...Object.entries(DOSTAWCY).filter(([id, d]) => !d.bezKlucza && st === 'otwarty' && s.klucz(id))
      .map(([id, d]) => wiersz(d.nazwa, `klucz API · zaszyfrowany (…${s.klucz(id).slice(-4)})`, przyciskAi('Edytuj', () => edytujKluczDostawcy(id)))));
  }
  akcje.replaceChildren(...(st === 'otwarty'
    ? [przyciskAi('Zamknij klucze na tym urządzeniu', async () => { await s.zamknij(); rysujDostawcow(); }),
      przyciskAi('Usuń wszystkie zaszyfrowane klucze z konta', async () => { if (await potwierdz('Usunąć zapisane klucze?', 'Wszystkie klucze API dostawców i zapamiętane klucze dostępu znikną z sejfu (także na innych urządzeniach). Hasło do kluczy przestanie być potrzebne.', 'Usuń', true)) { await s.usun(); rysujDostawcow(); } })]
    : []));
  pokazPusto();
}

// ---------- Nowy klucz – okienko (#248) ----------

const TYTULY = { czat: 'Nowy klucz API dostawcy', lacznik: 'Nowy klucz – łącznik w aplikacji AI', zwykly: 'Nowy klucz – zwykły czat' };
let projektWybrany = null;
let czytajNoweUprawnienia = () => null;

function przygotujKluczDostawcy(dostawca) {
  const wybor = $('#ai-nowy-dostawca');
  if (!wybor.options.length) {
    wybor.replaceChildren(...Object.entries(DOSTAWCY).filter(([, d]) => !d.bezKlucza).map(([id, d]) => new Option(d.nazwa, id)));
    wybor.addEventListener('change', gdzieWziac);
  }
  if (dostawca) wybor.value = dostawca;
  $('#ai-nowy-klucz').value = '';
  gdzieWziac();
}
function gdzieWziac() {
  const d = DOSTAWCY[$('#ai-nowy-dostawca').value];
  const a = $('#ai-nowy-gdzie');
  a.hidden = !d?.kluczUrl;
  if (d?.kluczUrl) a.href = d.kluczUrl;
}

function wyczyscNowy() {
  pokazPolecenia();
  // Klucz (także w adresie i poleceniach) nie zostaje w okienku po zamknięciu.
  for (const id of ['#dostep-ai-klucz', '#dostep-ai-adres', '#ai-nowy-klucz']) $(id).value = '';
  for (const id of ['#dostep-ai-claude-code', '#dostep-ai-claude-desktop']) $(id).textContent = '';
  $('#dostep-ai-gotowy').hidden = true;
  $('#dostep-ai-nowy').hidden = false;
  $('#dostep-ai-zapamietaj')?.remove();
}

export function dodajKluczAi(rodzaj, { dostawca = null } = {}) {
  const r = TYTULY[rodzaj] ? rodzaj : 'czat';
  wyczyscNowy();
  $('#dodaj-klucz-ai').dataset.tryb = r;
  $('#dodaj-klucz-ai-tytul').textContent = TYTULY[r];
  if (r === 'czat') przygotujKluczDostawcy(dostawca);
  else {
    $('#dostep-ai-opis').value = '';
    const zakres = $('#dostep-ai-nowy input[name="dostep-ai-zakres"][value="wybrane"]');
    if (zakres) zakres.checked = true;
    listaWyboru($('#dostep-ai-projekty'), new Set(projektWybrany ? [projektWybrany] : []));
    pokazZakresNowego();
    czytajNoweUprawnienia = poleUprawnien($('#dostep-ai-uprawnienia'), null);
    $('#dostep-ai-uprawnienia').hidden = $('#dostep-ai-rola').value !== 'edycja';
  }
  if (!$('#dlg-klucz-ai').open) $('#dlg-klucz-ai').showModal();
}

export function zamknijDodawanie() {
  if ($('#dlg-klucz-ai').open) $('#dlg-klucz-ai').close();
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
  zamknijDodawanie();
}

// Zapamiętanie nowego klucza dostępu w sejfie – bez pytania, gdy sejf jest otwarty; inaczej przycisk w okienku.
async function zapamietaj(id, klucz) {
  const s = sejfKonta();
  if (!s) return;
  const st = await s.stan().catch(() => 'brak');
  if (st === 'otwarty') { await s.ustaw(wSejfie(id), klucz).catch(() => {}); return; }
  const box = Object.assign(document.createElement('div'), { id: 'dostep-ai-zapamietaj', className: 'rzad-przyciskow' });
  box.append(przyciskAi(st === 'brak' ? 'Zapamiętaj klucz (ustaw hasło do kluczy)' : 'Zapamiętaj klucz (hasło do kluczy)', async () => {
    const sejf = await otwartySejf();
    if (!sejf) return;
    await sejf.ustaw(wSejfie(id), klucz);
    box.replaceChildren(Object.assign(document.createElement('p'), { className: 'podpowiedz', textContent: 'Zapamiętany – „Pokaż klucz” na liście pokaże go jeszcze raz.' }));
  }));
  $('#dostep-ai-gotowy legend').after(box);
}

// Panel AI (#247) mieszka w ustawieniach konta (sekcja „Sztuczna inteligencja”). Poza ustawieniami (np. z edytora)
// ten sam panel pokazuje się w oknie i wraca na miejsce po zamknięciu.
const wUstawieniach = () => document.body.dataset.ekran === 'konto';
function przeniesPanel(doOkna) {
  const panel = $('#dostep-ai');
  const cel = doOkna ? $('#dlg-dostep-ai .miejsce-panelu-ai') : $('#ust-ai');
  if (panel.parentElement !== cel) cel.append(panel);
}

// Otwiera panel kluczy. zakladka – 'czat' | 'lacznik' | 'zwykly' od razu otwiera okienko nowego klucza tego rodzaju;
// projektId – projekt zaznaczony na liście nowego klucza.
export async function otworzDostepAi({ projektId = null, zakladka = null } = {}) {
  if (!stan.uzytkownik) { powiadom('Ustawienia sztucznej inteligencji wymagają zalogowania.', true); return; }
  const wOknie = !wUstawieniach();
  przeniesPanel(wOknie);
  projektWybrany = projektId;
  if (wOknie && !$('#dlg-dostep-ai').open) $('#dlg-dostep-ai').showModal();
  rysujDostawcow();
  odswiezListe();
  try {
    // Otwarty projekt musi być na koncie, żeby dało się go wybrać.
    const modul = edytorGotowy();
    if (stan.projekt && modul) { await modul.zapiszTeraz(); await modul.synchronizuj(); }
    await wczytajProjekty();
  } catch (e) {
    powiadom(chmura.komunikatBledu(e), true);
  }
  if (TYTULY[zakladka]) { ustawSekcjeAi(zakladka); dodajKluczAi(zakladka); }
}

export async function utworzKluczAi() {
  const przycisk = $('[data-akcja="dostep-ai-utworz"]');
  przycisk.disabled = true;
  try {
    const rodzaj = $('#dodaj-klucz-ai').dataset.tryb === 'zwykly' ? 'zwykly' : 'lacznik';
    const zakres = $('#dostep-ai-nowy input[name="dostep-ai-zakres"]:checked')?.value || 'wybrane';
    const dni = $('#dostep-ai-dni').value;
    const wynik = await chmura.utworzKluczAi({
      opis: $('#dostep-ai-opis').value.trim(),
      rola: $('#dostep-ai-rola').value,
      dni: dni === 'bez' ? null : Number(dni) || 30,
      zakres,
      projekty: zakres === 'pelny' ? [] : wybrane($('#dostep-ai-projekty')),
    });
    await chmura.oznaczDostepAi(wynik.id, rodzaj).catch(() => {});
    const uprawnienia = $('#dostep-ai-rola').value === 'edycja' ? czytajNoweUprawnienia() : null;
    if (uprawnienia) await chmura.ustawUprawnieniaAi(wynik.id, uprawnienia);
    $('#dostep-ai-klucz').value = wynik.klucz;
    $('#dostep-ai-adres').value = adresLacznika(wynik.klucz);
    instrukcje(wynik.klucz);
    pokazPolecenia(adresLacznika(wynik.klucz));
    $('#dostep-ai-aplikacje').open = true;
    $('#dostep-ai-nowy').hidden = true;
    $('#dostep-ai-gotowy').hidden = false;
    $('#dostep-ai-adres').select();
    await zapamietaj(wynik.id, wynik.klucz);
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
  zamknijDodawanie();
  wyczyscNowy();
  if ($('#dlg-dostep-ai').open) $('#dlg-dostep-ai').close();
  przeniesPanel(false);
  document.dispatchEvent(new CustomEvent('makietka:klucze-ai'));
}

// Zdarzenie close przychodzi z opóźnieniem – gdy okno zdążyło się otworzyć ponownie, panel zostaje w nim.
$('#dlg-dostep-ai').addEventListener('close', () => { if (!$('#dlg-dostep-ai').open) przeniesPanel(false); });
$('#dlg-klucz-ai').addEventListener('close', () => { if ($('#dlg-klucz-ai').open) return; wyczyscNowy(); rysujDostawcow(); odswiezListe(); document.dispatchEvent(new CustomEvent('makietka:klucze-ai')); });
// Przełącznik na górze (#250): jedna z trzech sekcji naraz.
export function ustawSekcjeAi(z) {
  const sekcja = TYTULY[z] ? z : 'czat';
  const panel = $('#dostep-ai');
  panel.dataset.sekcja = sekcja;
  for (const b of panel.querySelectorAll('[data-sekcja-ai]')) b.setAttribute('aria-selected', String(b.dataset.sekcjaAi === sekcja));
}
$('#dostep-ai').addEventListener('click', (e) => {
  const s = e.target.closest('[data-sekcja-ai]');
  if (s) { ustawSekcjeAi(s.dataset.sekcjaAi); return; }
  const b = e.target.closest('[data-dodaj-klucz-ai]');
  if (b) dodajKluczAi(b.dataset.dodajKluczAi);
});
$('#dostep-ai-nowy').addEventListener('change', (e) => {
  if (e.target.name === 'dostep-ai-zakres') pokazZakresNowego();
  if (e.target.id === 'dostep-ai-rola') $('#dostep-ai-uprawnienia').hidden = e.target.value !== 'edycja';
});

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
