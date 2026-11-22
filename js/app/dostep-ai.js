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
import { DOSTAWCY, modeleDostawcy } from '../ai-dostawcy.js';
import { wydatki, ustawLimit, opisKosztu } from '../ai-koszty.js';
import { wstawIkony } from '../ikony.js';
import { otwartySejf, sejfKonta } from './sejf-ai.js';
import { wpiszNazwe, t as tt } from '../jezyk.js';

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
  ? (() => { const bez = UPRAWNIENIA.filter(([k]) => !d.uprawnienia.includes(k)).map(([k]) => KROTKO[k]); return bez.length ? tt('dostepAi.bez', { join: bez.join(', ') }) : ''; })()
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
    wpiszNazwe(tekst, p.nazwa);
    if (p.wlasciciel) {
      const ciche = document.createElement('span');
      ciche.className = 'ciche';
      ciche.textContent = tt('dostepAi.udostepnilA', { wlasciciel: p.wlasciciel, x: p.rola === 'odczyt' ? tt('dostepAi.tylkoOgladaszWiecAi') : '' });
      tekst.append(ciche);
    }
    l.append(pole, tekst);
    return l;
  }));
  if (!projekty.length) {
    const p = document.createElement('p');
    p.className = 'podpowiedz';
    p.textContent = tt('dostepAi.naKoncieNieMa');
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
  $('#dostep-ai-claude-code').textContent = tt('dostepAi.claudeMcpAddTransport', { adresLacznika: adresLacznika(klucz) });
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
  $('#dostep-ai-polecenie-code').textContent = tt('dostepAi.claudeMcpAddTransport2', { x: adres || ADRES_ZASTEPCZY });
}

export async function kopiujPolecenieAi() {
  try {
    await navigator.clipboard.writeText(polecenieZAdresem(adresWOknie));
    powiadom(tt('dostepAi.skopiowanoPolecenieWklejJe'));
  } catch {
    powiadom(tt('dostepAi.nieUdaloSieSkopiowac'), true);
  }
}

export async function kopiujPolecenieZwykle() {
  try {
    await navigator.clipboard.writeText(polecenieZwyklegoCzatu(adresWOknie));
    powiadom(tt('dostepAi.skopiowanoWklejWRozmowie'));
  } catch {
    powiadom(tt('dostepAi.nieUdaloSieSkopiowac2'), true);
  }
}

const opisZakresu = (d) => (d.zakres === 'pelny'
  ? 'pełny dostęp – wszystkie projekty, tworzenie i usuwanie'
  : (d.projekty?.length ? d.projekty.map((p) => `„${p.nazwa}”`).join(', ') : 'żadnego projektu (dodaj w „Zmień zakres”)'));
const opisWaznosci = (d) => (d.wazny_do ? tt('dostepAi.waznyDo', { toLocaleDateString: new Date(d.wazny_do).toLocaleDateString('pl-PL') }) : 'bez terminu');

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
    const pusto = sekcja.querySelector('.pusto-kluczy');
    if (pusto) pusto.hidden = ile > 0;
  }
}

async function kopiujTekst(tekst, co) {
  try { await navigator.clipboard.writeText(tekst); powiadom(`${co} skopiowany.`); } catch { powiadom(tt('dostepAi.nieUdaloSieSkopiowac2'), true); }
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
  zamknij.setAttribute('aria-label', tt('dostepAi.zamknij'));
  zamknij.addEventListener('click', () => dlg.close());
  const tresc = el('div', { className: 'formularz' }, el('div', { className: 'naglowek-dialogu' }, el('h2', { textContent: tytul }), zamknij));
  dlg.append(tresc);
  wstawIkony(dlg);
  return { dlg, tresc };
}

// Miejsce na pokazany klucz: przycisk „Pokaż klucz” → tekst do skopiowania (z sejfu).
function miejsceKlucza(pobierz) {
  const box = el('div', { className: 'klucz-pokazany' });
  const pokaz = przyciskAi(tt('dostepAi.pokazKlucz'), async () => {
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
  tresc.append(el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: sposob === 'zwykly' ? tt('dostepAi.polecenieDlaCzatu') : tt('dostepAi.adresLacznika') }), miejsceKlucza(async () => {
    const klucz = await kluczZSejfu(wSejfie(d.id));
    if (klucz === null) return null;
    if (!klucz) return { brak: 'Tego klucza Makietka nie zapamiętała (utworzony wcześniej, przez logowanie w aplikacji AI albo bez hasła do kluczy). Jeśli go nie masz – odbierz go i dodaj nowy.' };
    const adres = adresLacznika(klucz);
    const tekst = sposob === 'zwykly' ? polecenieZwyklegoCzatu(adres) : adres;
    return { tekst, przyciski: [przyciskAi(sposob === 'zwykly' ? tt('dostepAi.kopiujPolecenie') : tt('dostepAi.kopiujAdres'), () => kopiujTekst(tekst, sposob === 'zwykly' ? 'Tekst' : 'Adres')), przyciskAi(tt('dostepAi.kopiujSamKlucz'), () => kopiujTekst(klucz, 'Klucz'))] };
  })));

  // Zakres.
  const radia = przyciskiZakresu(`zakres-${d.id}`, d.zakres);
  const lista = el('div', { className: 'lista-projektow-klucza' });
  listaWyboru(lista, new Set((d.projekty || []).map((p) => p.id)));
  const pokazListe = () => { lista.hidden = radia.querySelector('input:checked')?.value === 'pelny'; };
  radia.addEventListener('change', pokazListe);
  pokazListe();
  tresc.append(el('fieldset', { className: 'grupa-pol zmiana-zakresu' }, el('legend', { textContent: tt('dostepAi.zakres') }), radia, lista));
  let czytajUprawnienia = null;
  if (d.rola === 'edycja') {
    const pola = el('fieldset', { className: 'uprawnienia-klucza' }, el('legend', { textContent: tt('dostepAi.przyZmianachAiMoze') }));
    czytajUprawnienia = poleUprawnien(pola, d.uprawnienia);
    tresc.append(el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: tt('dostepAi.uprawnienia') }), pola));
  }

  // Ważność – od dziś.
  const wybor = el('select', { id: 'edytuj-klucz-dni' });
  wybor.append(new Option('bez zmian', ''), ...DNI.map(([v, t]) => new Option(v === 'bez' ? t : tt('dostepAi.odDzis', { t }), v)));
  tresc.append(el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: tt('dostepAi.waznosc') }),
    el('label', { className: 'pole' }, el('span', { textContent: d.aktywny ? tt('dostepAi.teraz', { opisWaznosci: opisWaznosci(d) }) : tt('dostepAi.kluczWygaslUstawNowy') }), wybor)));

  const blad = el('p', { className: 'blad-polaczenia', hidden: true });
  blad.setAttribute('role', 'alert');
  tresc.append(blad, el('div', { className: 'przyciski-dialogu' },
    przyciskAi(tt('dostepAi.odbierzKlucz'), async () => {
      if (!await potwierdz(tt('dostepAi.odebracKlucz'), tt('dostepAi.kluczPrzestanieDzialacOd', { x: d.opis || tt('dostepAi.bezOpisu') }), tt('dostepAi.odbierz'), true)) return;
      try {
        await chmura.odwolajDostepAi(d.id);
        const s = sejfKonta();
        if (s && s.klucz(wSejfie(d.id))) await s.ustaw(wSejfie(d.id), '').catch(() => {});
        powiadom(tt('dostepAi.kluczOdebrany'));
        dlg.close();
      } catch (e) { blad.textContent = chmura.komunikatBledu(e); blad.hidden = false; }
    }, 'niebezpieczny'),
    przyciskAi(tt('dostepAi.zapiszZmiany'), async () => {
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
        powiadom(tt('dostepAi.kluczZmienionyAdresZostaje'));
        dlg.close();
      } catch (e) { blad.textContent = chmura.komunikatBledu(e); blad.hidden = false; }
    }, 'glowny')));
  if (!dlg.open) dlg.showModal();
  // Projekty mogą jeszcze dochodzić (pierwsze otwarcie) – odśwież listę wyboru, gdy będą.
  if (!projekty.length) wczytajProjekty().then(() => { listaWyboru(lista, new Set((d.projekty || []).map((p) => p.id))); pokazListe(); }).catch(() => {});
}

// Model domyślny i adres (dla „zgodnych z OpenAI”) – w pamięci przeglądarki, jak w czacie (js/app/czat-ai.js).
const PAMIEC_CZATU = 'makietka-czat-ai';
const ustawieniaCzatu = () => { try { return JSON.parse(localStorage.getItem(PAMIEC_CZATU) || 'null') || { dostawca: 'anthropic', rola: 'edycja', dostawcy: {} }; } catch { return { dostawca: 'anthropic', rola: 'edycja', dostawcy: {} }; } };
function zapiszUstawieniaDostawcy(id, zmiany) {
  const u = ustawieniaCzatu();
  u.dostawcy = { ...(u.dostawcy || {}), [id]: { ...(u.dostawcy?.[id] || {}), ...zmiany } };
  try { localStorage.setItem(PAMIEC_CZATU, JSON.stringify(u)); } catch { /* bez pamięci */ }
}

// „Sprawdź połączenie” i „Model domyślny” (#256, plan AI krok 4) – w okienku klucza dostawcy.
function polaPolaczenia(id, kluczFn) {
  const d = DOSTAWCY[id];
  const zapisane = ustawieniaCzatu().dostawcy?.[id] || {};
  const model = el('input', { id: 'klucz-ai-model', autocomplete: 'off', spellcheck: false, value: zapisane.model || d.modele[0] || '', placeholder: tt('dostepAi.nazwaModelu') });
  const lista = el('datalist', { id: 'klucz-ai-modele' });
  lista.append(...d.modele.map((m) => new Option(m, m)));
  model.setAttribute('list', 'klucz-ai-modele');
  const adres = d.wlasnyAdres ? el('input', { id: 'klucz-ai-adres', type: 'url', value: zapisane.adres || '', placeholder: 'https://…/v1' }) : null;
  const wynik = el('p', { className: 'podpowiedz wynik-polaczenia', hidden: true });
  wynik.setAttribute('role', 'status');
  const sprawdz = przyciskAi(tt('dostepAi.sprawdzPolaczenie'), async () => {
    const klucz = kluczFn();
    if (!klucz) { wynik.textContent = tt('dostepAi.najpierwWklejKlucz'); wynik.hidden = false; return; }
    sprawdz.disabled = true;
    wynik.textContent = tt('dostepAi.sprawdzam');
    wynik.hidden = false;
    wynik.classList.remove('blad', 'dobrze');
    try {
      const modele = await modeleDostawcy(id, { klucz, adres: adres?.value.trim() || '' });
      lista.replaceChildren(...modele.map((m) => new Option(m, m)));
      const jest = !modele.length || modele.includes(model.value.trim());
      wynik.textContent = tt('dostepAi.dzialaDostawcaPrzyjalKlucz', { x: modele.length ? tt('dostepAi.modeli', { modeleIle: modele.length }) : '', x2: jest ? '' : tt('dostepAi.wybranegoModeluNieMa') });
      wynik.classList.add(jest ? 'dobrze' : 'blad');
    } catch (e) {
      wynik.textContent = e.message;
      wynik.classList.add('blad');
    } finally { sprawdz.disabled = false; }
  });
  const pole = el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: tt('dostepAi.modelIPolaczenie') }),
    el('label', { className: 'pole' }, el('span', { textContent: tt('dostepAi.modelDomyslny') }), model), lista,
    ...(adres ? [el('label', { className: 'pole' }, el('span', { textContent: tt('dostepAi.adresApi') }), adres)] : []),
    el('div', { className: 'rzad-przyciskow' }, sprawdz), wynik);
  return { pole, zapisz: () => zapiszUstawieniaDostawcy(id, { model: model.value.trim(), ...(adres ? { adres: adres.value.trim() } : {}) }) };
}

function edytujKluczDostawcy(id) {
  const d = DOSTAWCY[id];
  const { dlg, tresc } = oknoEdycji(`Klucz API: ${d.nazwa}`);
  const s = sejfKonta();
  tresc.append(el('p', { className: 'podpowiedz', textContent: tt('dostepAi.doAsystentaAiW', { slice: s.klucz(id).slice(-4) }) }));
  tresc.append(el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: tt('dostepAi.klucz') }), miejsceKlucza(async () => ({
    tekst: s.klucz(id), przyciski: [przyciskAi(tt('dostepAi.kopiuj'), () => kopiujTekst(s.klucz(id), 'Klucz'))],
  }))));
  const nowy = el('input', { type: 'password', id: 'edytuj-klucz-dostawcy', autocomplete: 'off', spellcheck: false, placeholder: tt('dostepAi.wklejNowyKluczZeby') });
  const gdzie = d.kluczUrl ? el('a', { href: d.kluczUrl, target: '_blank', rel: 'noopener', textContent: tt('dostepAi.gdzieWziacKlucz') }) : '';
  tresc.append(el('fieldset', { className: 'grupa-pol' }, el('legend', { textContent: tt('dostepAi.zamienKlucz') }), el('label', { className: 'pole' }, el('span', { textContent: tt('dostepAi.nowyKluczApi') }), nowy), el('p', { className: 'podpowiedz' }, gdzie)));
  const polaczenie = polaPolaczenia(id, () => nowy.value.trim() || s.klucz(id));
  tresc.append(polaczenie.pole);
  tresc.append(el('div', { className: 'przyciski-dialogu' },
    przyciskAi(tt('dostepAi.usunKlucz'), async () => {
      if (!await potwierdz(tt('dostepAi.usunacKlucz', { nazwa: d.nazwa }), tt('dostepAi.asystentAiNieBedzie'), tt('dostepAi.usun'), true)) return;
      await s.ustaw(id, '');
      dlg.close();
    }, 'niebezpieczny'),
    przyciskAi(tt('dostepAi.zapisz'), async () => {
      const v = nowy.value.trim();
      if (v) { await s.ustaw(id, v); powiadom(tt('dostepAi.kluczZamieniony', { nazwa: d.nazwa })); }
      polaczenie.zapisz();
      dlg.close();
    }, 'glowny')));
  if (!dlg.open) dlg.showModal();
}

function wierszKlucza(d) {
  const li = document.createElement('li');
  li.dataset.id = d.id;
  const zakres = el('span', { className: 'zakres-opis', textContent: opisZakresu(d) });
  const szczegoly = el('span', { className: 'ciche', textContent: `${ROLE[d.rola] || d.rola}${d.rola === 'edycja' ? opisUprawnien(d) : ''} · ${d.aktywny ? opisWaznosci(d) : 'wygasł'} · ${d.ostatnie_uzycie ? `ostatnio użyty ${kiedy(d.ostatnie_uzycie)}` : 'jeszcze nieużyty'}` });
  li.append(el('div', {}, el('strong', { textContent: d.opis || tt('dostepAi.kluczBezOpisu') }), zakres, szczegoly),
    el('div', { className: 'klucz-akcje' }, przyciskAi(tt('dostepAi.edytuj'), () => edytujKluczAi(d))));
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
      przyciskAi(tt('dostepAi.otworz'), async () => { if (await otwartySejf()) { rysujDostawcow(); odswiezListe(); } }, 'glowny')));
  } else {
    lista.replaceChildren(...Object.entries(DOSTAWCY).filter(([id, d]) => !d.bezKlucza && st === 'otwarty' && s.klucz(id))
      .map(([id, d]) => wiersz(d.nazwa, `klucz API · zaszyfrowany (…${s.klucz(id).slice(-4)})`, przyciskAi(tt('dostepAi.edytuj'), () => edytujKluczDostawcy(id)))));
  }
  akcje.replaceChildren(...(st === 'otwarty'
    ? [przyciskAi(tt('dostepAi.zamknijKluczeNaTym'), async () => { await s.zamknij(); rysujDostawcow(); }),
      przyciskAi(tt('dostepAi.usunWszystkieZaszyfrowaneKlucze'), async () => { if (await potwierdz(tt('dostepAi.usunacZapisaneKlucze'), tt('dostepAi.wszystkieKluczeApiDostawcow'), tt('dostepAi.usun'), true)) { await s.usun(); rysujDostawcow(); } })]
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
let polaczenieNowego = null;
function gdzieWziac() {
  const id = $('#ai-nowy-dostawca').value;
  const d = DOSTAWCY[id];
  // Model domyślny i „Sprawdź połączenie” dla wybranego dostawcy (#256).
  $('#ai-nowy-polaczenie')?.remove();
  polaczenieNowego = polaPolaczenia(id, () => $('#ai-nowy-klucz').value.trim());
  polaczenieNowego.pole.id = 'ai-nowy-polaczenie';
  $('#ai-nowy-dostawca-pola .rzad-przyciskow').before(polaczenieNowego.pole);
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
  polaczenieNowego?.zapisz();
  pole.value = '';
  powiadom(tt('dostepAi.kluczZapisanyZaszyfrowanyTwoim', { nazwa: DOSTAWCY[id].nazwa }));
  zamknijDodawanie();
}

// Zapamiętanie nowego klucza dostępu w sejfie – bez pytania, gdy sejf jest otwarty; inaczej przycisk w okienku.
async function zapamietaj(id, klucz) {
  const s = sejfKonta();
  if (!s) return;
  const st = await s.stan().catch(() => 'brak');
  if (st === 'otwarty') { await s.ustaw(wSejfie(id), klucz).catch(() => {}); return; }
  const box = Object.assign(document.createElement('div'), { id: 'dostep-ai-zapamietaj', className: 'rzad-przyciskow' });
  box.append(przyciskAi(st === 'brak' ? tt('dostepAi.zapamietajKluczUstawHaslo') : tt('dostepAi.zapamietajKluczHasloDo'), async () => {
    const sejf = await otwartySejf();
    if (!sejf) return;
    await sejf.ustaw(wSejfie(id), klucz);
    box.replaceChildren(Object.assign(document.createElement('p'), { className: 'podpowiedz', textContent: tt('dostepAi.zapamietanyPokazKluczNa') }));
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
  if (!stan.uzytkownik) { powiadom(tt('dostepAi.ustawieniaSztucznejInteligencjiWymagaja'), true); return; }
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
    powiadom(tt('dostepAi.zaznaczylemSkopiujGoSkrotem', { co }));
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
// „Kopiuj i wklej” (#254): projekt do otwarcia z Asystentem AI w tym trybie (#/p/<id>/asystent).
async function wypelnijProjektyKopiuj() {
  const wybor = $('#ai-kopiuj-projekt');
  if (!projekty.length) await wczytajProjekty().catch(() => {});
  const byl = wybor.value || stan.projekt?.id || '';
  wybor.replaceChildren(...projekty.filter((p) => p.rola !== 'odczyt').map((p) => new Option(p.nazwa, p.id)));
  if (byl && projekty.some((p) => p.id === byl)) wybor.value = byl;
  $('[data-akcja="ai-kopiuj-otworz"]').disabled = !wybor.options.length;
}
export function otworzZAsystentemKopiuj() {
  const id = $('#ai-kopiuj-projekt').value;
  if (!id) { powiadom(tt('dostepAi.najpierwUtworzProjektAsystent'), true); return; }
  if ($('#dlg-dostep-ai').open) zamknijDostepAi();
  location.hash = `#/p/${encodeURIComponent(id)}/asystent`;
}

// Przełącznik na górze (#250, #254): jedna z czterech sekcji naraz.
const SEKCJE_AI = ['czat', 'lacznik', 'kopiuj', 'zwykly'];
export function ustawSekcjeAi(z) {
  const sekcja = SEKCJE_AI.includes(z) ? z : 'czat';
  if (sekcja === 'kopiuj') wypelnijProjektyKopiuj();
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

$('#dostep-ai').dataset.gotowy = '1'; // moduł wczytany – przyciski działają (testy czekają na to)

// Krótkie podsumowanie w ustawieniach konta: ile kluczy działa.
// Limit wydatków na AI w miesiącu (#372) – na tym urządzeniu; obok suma z tego miesiąca.
function pokazWydatki() {
  const w = wydatki();
  const pole = $('#ust-ai-limit');
  if (pole && document.activeElement !== pole) pole.value = String(w.limit || 0);
  const info = $('#ust-ai-wydatki');
  if (info) info.textContent = tt('ustAi.wydanoWMiesiacu', { zl: opisKosztu(w.zl) });
}
$('#ust-ai-limit')?.addEventListener('change', (e) => { ustawLimit(String(e.target.value).replace(',', '.')); pokazWydatki(); });

export async function podsumowanieKluczy() {
  pokazWydatki();
  const el = $('#ust-ai-opis');
  if (!el) return;
  try {
    const aktywne = (await chmura.dostepyAi()).filter((d) => d.aktywny);
    el.textContent = aktywne.length
      ? tt('dostepAi.aktywneKlucze', { aktywneIle: aktywne.length, join: aktywne.slice(0, 3).map((d) => `„${d.opis || tt('dostepAi.bezOpisu')}” (${d.zakres === 'pelny' ? tt('dostepAi.pelnyDostep') : tt('dostepAi.projekty', { projektyIle: d.projekty.length })})`).join(', '), x: aktywne.length > 3 ? '…' : '' })
      : tt('dostepAi.nieMaszJeszczeZadnego');
  } catch { el.textContent = ''; }
}

document.addEventListener('makietka:klucze-ai', () => { podsumowanieKluczy(); });
