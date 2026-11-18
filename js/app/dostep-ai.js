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

// ---------- Lista kluczy (#248): trzy sekcje – czat w Makietce, łącznik w aplikacji AI, zwykły czat ----------
// Klucz dostępu trafia do sekcji według „sposob” (ustawiany przy tworzeniu); starsze klucze – z opisu.
const sposobKlucza = (d) => d.sposob || (d.opis === 'Czat w Makietce' ? 'czat' : 'lacznik');
// W sejfie (zaszyfrowany hasłem do kluczy) – żeby dało się pokazać klucz jeszcze raz.
const wSejfie = (id) => `dostep:${id}`;
const DNI = [['1', '1 dzień'], ['7', '7 dni'], ['30', '30 dni'], ['90', '90 dni'], ['365', 'rok'], ['bez', 'bez terminu']];

const przyciskAi = (tekst, fn, klasa = '') => { const b = Object.assign(document.createElement('button'), { type: 'button', className: `przycisk${klasa ? ` ${klasa}` : ''}`, textContent: tekst }); b.addEventListener('click', fn); return b; };

function pokazPusto() {
  for (const sekcja of document.querySelectorAll('#dostep-ai .sekcja-kluczy-ai')) {
    const ile = [...sekcja.querySelectorAll('ul')].reduce((n, ul) => n + ul.children.length, 0);
    sekcja.querySelector('.pusto-kluczy').hidden = ile > 0;
  }
}

// Rozwijane miejsce pod kluczem (pokazanie klucza, ważność, zakres) – jedno naraz.
function rozwin(li, klasa, zbuduj) {
  const bylo = li.querySelector(`.${klasa}`);
  for (const x of li.querySelectorAll('.klucz-pokazany, .zmiana-waznosci, .zmiana-zakresu')) x.remove();
  if (!bylo) zbuduj();
}

async function kopiujTekst(tekst, co) {
  try { await navigator.clipboard.writeText(tekst); powiadom(`${co} skopiowany.`); } catch { powiadom('Nie udało się skopiować – zaznacz tekst i skopiuj go ręcznie.', true); }
}

// „Pokaż klucz”: z sejfu (hasło do kluczy) – adres łącznika albo polecenie dla zwykłego czatu, do skopiowania.
async function pokazKlucz(li, d) {
  const s = sejfKonta();
  const st = s ? await s.stan().catch(() => 'brak') : 'brak';
  const sejf = st === 'brak' ? null : await otwartySejf();
  if (st !== 'brak' && !sejf) return;
  rozwin(li, 'klucz-pokazany', () => {
    const box = Object.assign(document.createElement('div'), { className: 'klucz-pokazany' });
    const klucz = sejf?.klucz(wSejfie(d.id));
    if (!klucz) {
      box.append(Object.assign(document.createElement('p'), { className: 'podpowiedz', textContent: 'Tego klucza Makietka nie zapamiętała (utworzony wcześniej, przez logowanie w aplikacji AI albo bez hasła do kluczy). Jeśli go nie masz – odbierz go i dodaj nowy.' }));
    } else {
      const adres = adresLacznika(klucz);
      const tekst = sposobKlucza(d) === 'zwykly' ? polecenieZwyklegoCzatu(adres) : adres;
      box.append(Object.assign(document.createElement('pre'), { textContent: tekst }));
      const rzad = Object.assign(document.createElement('div'), { className: 'rzad-przyciskow' });
      rzad.append(przyciskAi(sposobKlucza(d) === 'zwykly' ? 'Kopiuj polecenie' : 'Kopiuj adres', () => kopiujTekst(tekst, sposobKlucza(d) === 'zwykly' ? 'Tekst' : 'Adres')),
        przyciskAi('Kopiuj sam klucz', () => kopiujTekst(klucz, 'Klucz')));
      box.append(rzad);
    }
    li.append(box);
  });
}

// Zmiana czasu ważności – od teraz (działa też dla klucza, który wygasł).
function edytorWaznosci(li, d) {
  rozwin(li, 'zmiana-waznosci', () => {
    const box = Object.assign(document.createElement('div'), { className: 'zmiana-waznosci' });
    const wybor = document.createElement('select');
    wybor.setAttribute('aria-label', 'Nowy czas ważności');
    wybor.append(...DNI.map(([v, t]) => new Option(v === 'bez' ? t : `${t} od dziś`, v)));
    wybor.value = d.wazny_do ? '30' : 'bez';
    box.append(Object.assign(document.createElement('span'), { textContent: 'Ważny przez' }), wybor, przyciskAi('Zapisz ważność', async () => {
      try {
        await chmura.zmienWaznoscAi(d.id, wybor.value === 'bez' ? null : Number(wybor.value));
        powiadom('Ważność klucza zmieniona – adres zostaje ten sam.');
        odswiezListe();
      } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
    }, 'glowny'));
    li.append(box);
  });
}

function wierszKlucza(d) {
  const li = document.createElement('li');
  li.dataset.id = d.id;
  const opis = document.createElement('div');
  const tytul = document.createElement('strong');
  tytul.textContent = d.opis || 'Klucz bez opisu';
  const zakres = Object.assign(document.createElement('span'), { className: 'zakres-opis', textContent: opisZakresu(d) });
  const szczegoly = Object.assign(document.createElement('span'), { className: 'ciche' });
  szczegoly.textContent = `${ROLE[d.rola] || d.rola} · ${d.aktywny ? opisWaznosci(d) : 'wygasł'} · ${d.ostatnie_uzycie ? `ostatnio użyty ${kiedy(d.ostatnie_uzycie)}` : 'jeszcze nieużyty'}`;
  opis.append(tytul, zakres, szczegoly);
  const akcje = Object.assign(document.createElement('div'), { className: 'klucz-akcje' });
  akcje.append(
    przyciskAi('Pokaż klucz', () => pokazKlucz(li, d)),
    przyciskAi('Zmień zakres', () => rozwin(li, 'zmiana-zakresu', () => edytorZakresu(li, d))),
    przyciskAi('Ważność', () => edytorWaznosci(li, d)),
    przyciskAi('Odbierz', async () => {
      if (!await potwierdz('Odebrać klucz?', `Klucz „${d.opis || 'bez opisu'}” przestanie działać od razu – AI straci dostęp do wszystkich projektów tego klucza.`, 'Odbierz', true)) return;
      try {
        await chmura.odwolajDostepAi(d.id);
        const s = sejfKonta();
        if (s && s.klucz(wSejfie(d.id))) await s.ustaw(wSejfie(d.id), '').catch(() => {});
        powiadom('Klucz odebrany.');
      } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
      odswiezListe();
    }, 'niebezpieczny'),
  );
  li.append(opis, akcje);
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

// Klucze API dostawców (sejf): zapisane – z „Pokaż”, „Zmień”, „Usuń”; sejf zamknięty na tym urządzeniu – „Otwórz”.
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
    const a = Object.assign(document.createElement('div'), { className: 'klucz-akcje' });
    a.append(...przyciski);
    li.append(o, a);
    return li;
  };
  if (st === 'zamkniety') {
    lista.replaceChildren(wiersz('Klucze API dostawców', 'zaszyfrowane – na tym urządzeniu podaj hasło do kluczy',
      przyciskAi('Otwórz', async () => { if (await otwartySejf()) { rysujDostawcow(); odswiezListe(); } }, 'glowny')));
  } else {
    lista.replaceChildren(...Object.entries(DOSTAWCY).filter(([id, d]) => !d.bezKlucza && st === 'otwarty' && s.klucz(id)).map(([id, d]) => {
      const li = wiersz(d.nazwa, `klucz API · zaszyfrowany (…${s.klucz(id).slice(-4)})`);
      li.querySelector('.klucz-akcje').append(
        przyciskAi('Pokaż klucz', () => rozwin(li, 'klucz-pokazany', () => {
          const box = Object.assign(document.createElement('div'), { className: 'klucz-pokazany' });
          box.append(Object.assign(document.createElement('pre'), { textContent: s.klucz(id) }), przyciskAi('Kopiuj', () => kopiujTekst(s.klucz(id), 'Klucz')));
          li.append(box);
        })),
        przyciskAi('Zmień', () => dodajKluczAi('czat', { dostawca: id })),
        przyciskAi('Usuń', async () => {
          if (!await potwierdz(`Usunąć klucz ${d.nazwa}?`, 'Asystent AI nie będzie mógł używać tego dostawcy, dopóki nie wkleisz klucza od nowa.', 'Usuń', true)) return;
          await s.ustaw(id, '');
          rysujDostawcow();
        }, 'niebezpieczny'),
      );
      return li;
    }));
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
  if (TYTULY[zakladka]) dodajKluczAi(zakladka);
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

$('#dlg-dostep-ai').addEventListener('close', () => przeniesPanel(false));
$('#dlg-klucz-ai').addEventListener('close', () => { wyczyscNowy(); rysujDostawcow(); odswiezListe(); document.dispatchEvent(new CustomEvent('makietka:klucze-ai')); });
$('#dostep-ai').addEventListener('click', (e) => { const b = e.target.closest('[data-dodaj-klucz-ai]'); if (b) dodajKluczAi(b.dataset.dodajKluczAi); });
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
