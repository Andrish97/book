// Panel administratora (#/admin, decyzja #95) – wzorem panelu Familiady, w wyglądzie Makietki:
// skrzynka kontakt@makietka.app jako klient poczty (js/app/skrzynka.js, #110), kolejka maili,
// ustawienia poczty (nadawca, dostawcy z dziennymi limitami, odstępy, test) i statystyki.
// Wszystko przez funkcje bazy admin_* (security definer, tylko konta z tabeli administratorzy). Miejsce całej
// aplikacji (pliki R2, baza i jej największe tabele) – tylko tu: rozmiary_tabel() i GET /pliki/_miejsce Workera.

import { supabase, komunikatBledu, r2, zuzycieSerwera } from '../chmura.js';
import { $, $$, powiadom, kiedy } from '../ui.js';
import { stan, trasa } from './kontekst.js';
import { rysujSkrzynke, sledzSkrzynke, przestanSledzic, przebiegKolejki } from './skrzynka.js';
import { t } from '../jezyk.js';

// Kolejka i ustawienia poczty to jedna zakładka „Poczta” (#207); dawne adresy #/admin/kolejka i
// #/admin/ustawienia prowadzą do niej, przewinięte do swojej części.
const ZAKLADKI = ['skrzynka', 'poczta', 'statystyki', 'zapisy'];
const STARE = { kolejka: 'admin-kolejka-sekcja', ustawienia: 'admin-ustawienia-sekcja' };
let zakladka = 'skrzynka';
let stanKolejki = '';
let czyAdmin = null; // { konto, tak }

async function rpc(nazwa, parametry = {}) {
  const sb = await supabase();
  const { data, error } = await sb.rpc(nazwa, parametry);
  if (error) throw error;
  return data;
}

// Wylogowanie: koniec śledzenia skrzynki, przy następnym koncie baza pyta od nowa.
export function wylogowano() {
  if (stan.uzytkownik) return; // już ktoś się zalogował (wylogowanie przy starcie przed odczytem sesji)
  czyAdmin = null;
  przestanSledzic().catch(() => {});
}

export async function czyAdministrator() {
  if (!stan.uzytkownik) return false;
  if (czyAdmin?.konto === stan.uzytkownik.id) return czyAdmin.tak;
  let tak = false;
  try { tak = Boolean(await rpc('czy_administrator')); } catch { tak = false; }
  czyAdmin = { konto: stan.uzytkownik.id, tak };
  // Administrator: licznik nieprzeczytanych i zmiany w skrzynce na żywo.
  if (tak) sledzSkrzynke().catch(() => {});
  return tak;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
const data = (iso) => (iso ? new Date(iso).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const mb = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(0, Math.round(b / 1024))} kB`);
const blad = (e) => powiadom(komunikatBledu(e), true);

export async function pokazPanel(nazwa = 'skrzynka') {
  const czesc = STARE[nazwa];
  if (czesc) nazwa = 'poczta';
  zakladka = ZAKLADKI.includes(nazwa) ? nazwa : 'skrzynka';
  for (const a of $$('[data-admin]')) a.setAttribute('aria-selected', String(a.dataset.admin === zakladka));
  for (const s of $$('[data-panel-admin]')) s.hidden = s.dataset.panelAdmin !== zakladka;
  $('#ekran-admin').dataset.zakladka = zakladka;
  document.title = t('admin.panelAdministratoraMakietka');
  await odswiez();
  if (czesc) document.getElementById(czesc)?.scrollIntoView({ block: 'start' });
}

export async function odswiez() {
  try {
    if (zakladka === 'skrzynka') await rysujSkrzynke();
    else if (zakladka === 'poczta') await Promise.all([rysujKolejke(), rysujUstawienia()]);
    else if (zakladka === 'zapisy') await Promise.all([rysujZapisy(), rysujStanKopii()]);
    else await rysujStatystyki();
  } catch (e) { blad(e); }
}

// ---------- Zapisy i kopie awaryjne (#138) ----------
// Dziennik zapisów projektów (kto: urządzenie / AI / serwis / przywrócenie) i przywracanie stanu sprzed zapisu.
const KTO = { 'urządzenie': 'Urządzenie', AI: 'AI (łącznik)', serwis: 'Serwis', 'przywrócenie': 'Przywrócenie' };
async function rysujZapisy() {
  const pole = $('#admin-zapisy-projekt');
  const projekt = pole.value.trim() || null;
  const lista = await rpc('admin_dziennik_zapisow', { p_projekt: projekt, p_limit: 200 });
  const miejsce = $('#admin-zapisy');
  miejsce.innerHTML = lista.length
    ? `<table class="admin-tabela"><thead><tr><th>Kiedy</th><th>${t('admin.projekt')}</th><th>Kto</th><th>Wersja</th><th>${t('admin.strony')}</th><th></th></tr></thead><tbody>${lista.map((z) => `<tr>
        <td>${esc(data(z.kiedy))}</td>
        <td><button type="button" class="link-przycisk" data-filtr-projektu="${esc(z.projekt_id)}" title="Pokaż tylko ten projekt">${esc(z.projekt || z.projekt_id)}</button><br><small class="ciche">${esc(z.wlasciciel || '')}</small></td>
        <td>${esc(KTO[z.kto] || z.kto)}${z.uzytkownik ? `<br><small class="ciche">${esc(z.uzytkownik)}</small>` : ''}</td>
        <td>${esc(z.wersja_przed)} → ${esc(z.wersja_po)}</td>
        <td>${esc(z.strony_zmienione)} zm.${z.strony_usuniete ? `, ${esc(z.strony_usuniete)} usun.` : ''}</td>
        <td>${z.kopia ? `<button type="button" class="przycisk maly" data-przywroc="${esc(z.kopia)}" title="Przywróć projekt do stanu sprzed tego zapisu">Przywróć stan sprzed</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>`
    : '<p class="ciche">Brak zapisów w ostatnich 14 dniach.</p>';
}
// Sprzątanie kopii (#207): kopie sprzątają się przy zapisie swojego projektu – porzucone i usunięte projekty
// zostawiały je na zawsze. Tu stan wszystkich kopii i usunięcie starszych niż wybrana liczba dni.
async function rysujStanKopii() {
  const k = await rpc('admin_kopie_stan');
  const n = (x) => Number(x || 0).toLocaleString('pl-PL');
  $('#admin-kopie-opis').textContent = `Kopie: ${n(k.kopie)} zapisów, ${n(k.strony)} stron · ${mb(Number(k.rozmiar || 0))}`
    + `${k.starsze_14 ? ` · starszych niż 14 dni: ${n(k.starsze_14)}` : ''}`
    + `${k.usuniete_projekty ? ` · z usuniętych projektów: ${n(k.usuniete_projekty)}` : ''}`
    + `${k.najstarsza ? ` · najstarsza: ${kiedy(k.najstarsza)}` : ''}`;
}
document.addEventListener('click', async (e) => {
  if (e.target.closest('#admin-kopie-wyczysc')) {
    const dni = Number($('#admin-kopie-dni').value) || 14;
    const { potwierdz } = await import('../ui.js');
    if (!await potwierdz(t('admin.wyczyscicStareKopie'), t('admin.kopieStronyIWpisy', { dni }), t('admin.wyczysc'), true)) return;
    try {
      const w = await rpc('admin_kopie_wyczysc', { p_dni: dni });
      powiadom(t('admin.usunietoKopieZapisowStron', { kopie: w.kopie, strony: w.strony, dziennik: w.dziennik }));
      await Promise.all([rysujZapisy(), rysujStanKopii()]);
    } catch (err) { blad(err); }
    return;
  }
  const filtr = e.target.closest('[data-filtr-projektu]');
  if (filtr) { $('#admin-zapisy-projekt').value = filtr.dataset.filtrProjektu; rysujZapisy().catch(blad); return; }
  const b = e.target.closest('[data-przywroc]');
  if (!b) return;
  const { potwierdz } = await import('../ui.js');
  if (!await potwierdz(t('admin.przywrocicStanSprzedZapisu'), t('admin.daneProjektuIStrony'), t('admin.przywroc'))) return;
  try {
    const w = await rpc('admin_przywroc_kopie', { p_kopia: Number(b.dataset.przywroc) });
    powiadom(t('admin.przywroconoStronWersja', { strony: w.strony, wersja: w.wersja }));
    await rysujZapisy();
  } catch (err) { blad(err); }
});
let timerFiltra = null;
document.addEventListener('input', (e) => {
  if (e.target.id !== 'admin-zapisy-projekt') return;
  clearTimeout(timerFiltra);
  timerFiltra = setTimeout(() => rysujZapisy().catch(blad), 400);
});

// ---------- Kolejka ----------

const RODZAJE = { zaproszenie: 'Zaproszenie', kontakt: 'Potwierdzenie z formularza', odpowiedz: 'Odpowiedź ze skrzynki', wiadomosc: 'Wiadomość ze skrzynki', test: 'Test' };
const NAZWY_DOSTAWCOW = { zeptomail: 'ZeptoMail', brevo: 'Brevo' };
// Którzy dostawcy mają sekret w funkcji poczta (tak/nie – wartości nigdy nie wychodzą z funkcji).
async function stanSekretow() {
  try {
    const sb = await supabase();
    const { data } = await sb.functions.invoke('poczta', { body: { stan_dostawcow: true } });
    return data?.dostawcy || null;
  } catch { return null; }
}
const STANY = { czeka: 'czeka', wysylanie: 'wysyłanie', wyslany: 'wysłany', blad: 'błąd', anulowany: 'anulowany' };

async function rysujKolejke() {
  const k = await rpc('admin_kolejka', { p_stan: stanKolejki || null, p_limit: 200 });
  for (const b of $$('#admin-stany [data-stan]')) {
    b.setAttribute('aria-pressed', String(b.dataset.stan === stanKolejki));
    const n = b.dataset.stan ? k.liczniki?.[b.dataset.stan] : null;
    b.textContent = `${{ '': 'Wszystkie', czeka: 'Czekają', wyslany: 'Wysłane', blad: 'Błędy', anulowany: 'Anulowane' }[b.dataset.stan]}${n ? ` (${n})` : ''}`;
  }
  $('#admin-dostawcy-stan').innerHTML = (k.dostawcy || []).map((d) => {
    const proc = d.dzienny_limit ? Math.min(100, Math.round((d.wyslane_dzis / d.dzienny_limit) * 100)) : 0;
    return `<div class="admin-dostawca"><strong>${esc(d.nazwa)}${d.aktywny ? '' : ' (wyłączony)'}</strong>
      <span class="ciche">Dziś ${d.wyslane_dzis} z ${d.dzienny_limit}${d.wyslane_30 ? ` · 30 dni: ${d.wyslane_30}` : ''}</span><div class="pasek" role="img" aria-label="${proc}% dziennego limitu"><span style="width:${proc}%"></span></div></div>`;
  }).join('');
  const lista = $('#admin-kolejka');
  lista.replaceChildren(...k.maile.map((m) => {
    const li = document.createElement('li');
    const akcje = [
      m.stan === 'czeka' ? `<button type="button" class="przycisk maly" data-akcja-kolejki="teraz">${t('admin.wyslijTeraz')}</button>` : '',
      ['blad', 'anulowany'].includes(m.stan) ? `<button type="button" class="przycisk maly" data-akcja-kolejki="ponow">${t('admin.ponow')}</button>` : '',
      ['czeka', 'blad'].includes(m.stan) ? `<button type="button" class="przycisk maly niebezpieczny" data-akcja-kolejki="anuluj">${t('admin.anuluj')}</button>` : '',
    ].join('');
    li.innerHTML = `<div class="opis"><strong><span class="stan-maila ${m.stan}">${esc(STANY[m.stan] || m.stan)}</span>${esc(RODZAJE[m.rodzaj] || m.rodzaj)} → ${esc(m.do_email)}</strong>
      <span>${esc(m.temat || '')}${m.temat ? ' · ' : ''}dodano ${esc(kiedy(m.utworzono))}${m.wyslano ? ` · wysłano ${esc(kiedy(m.wyslano))}` : ''}${m.stan === 'czeka' && new Date(m.nastepna_proba) > new Date() ? ` · następna próba ${esc(data(m.nastepna_proba))}` : ''}${m.proby ? ` · prób: ${m.proby}` : ''}${m.dostawca ? ` · przez ${esc(NAZWY_DOSTAWCOW[m.dostawca] || m.dostawca)}` : ''}</span>
      ${m.blad ? `<span class="stan-wysylki blad">${esc(m.blad)}</span>` : ''}</div><div class="akcje">${akcje}</div>`;
    for (const b of li.querySelectorAll('[data-akcja-kolejki]')) {
      b.addEventListener('click', async () => {
        try {
          await rpc('admin_kolejka_akcja', { p_id: m.id, p_akcja: b.dataset.akcjaKolejki });
          if (b.dataset.akcjaKolejki !== 'anuluj') await przebiegKolejki();
          await rysujKolejke();
        } catch (e) { blad(e); }
      });
    }
    return li;
  }));
  $('#admin-kolejka-pusto').hidden = k.maile.length > 0;
}

// ---------- Ustawienia poczty ----------

async function rysujUstawienia() {
  const [u, sekrety] = await Promise.all([rpc('admin_poczta_ustawienia'), stanSekretow()]);
  const f = $('#admin-form-ustawien');
  for (const pole of ['nadawca_email', 'nadawca_nazwa', 'skrzynka_email', 'limit_przebiegu', 'odstep_ms', 'maks_prob', 'podpis']) f.elements[pole].value = u.ustawienia[pole] ?? '';
  $('#admin-adres-skrzynki').textContent = u.ustawienia.skrzynka_email;
  $('#admin-dostawcy tbody').innerHTML = u.dostawcy.map((d) => `<tr data-dostawca="${esc(d.id)}">
    <td><strong>${esc(d.nazwa)}</strong><span class="ciche">${esc(d.typ)}</span></td>
    <td><input type="number" min="1" max="99" name="priorytet" value="${d.priorytet}" aria-label="${t('admin.priorytet')}"></td>
    <td><input type="number" min="0" max="100000" name="dzienny_limit" value="${d.dzienny_limit}" aria-label="Dzienny limit"></td>
    <td>${d.dzien === new Date().toISOString().slice(0, 10) ? d.wyslane_dzis : 0}</td>
    <td><input type="checkbox" name="aktywny" ${d.aktywny ? 'checked' : ''} aria-label="${t('admin.wlaczony')}"></td>
    <td><span class="stan-sekretu ${sekrety?.[d.id] ? 'ok' : 'brak'}">${sekrety ? (sekrety[d.id] ? 'ustawiony' : 'brak') : '?'}</span></td>
    <td><button type="button" class="przycisk maly" data-test-dostawcy="${esc(d.id)}">Test</button></td></tr>`).join('');
  for (const b of $$('#admin-dostawcy [data-test-dostawcy]')) b.addEventListener('click', () => wyslijTest(null, b.dataset.testDostawcy));
  $('#admin-odstepy tbody').innerHTML = u.odstepy.map((o) => `<tr data-akcja-odstepu="${esc(o.akcja)}">
    <td>${esc(o.opis)}<span class="ciche">${esc(o.akcja)}</span></td>
    <td><input type="number" min="0" max="86400" name="sekundy" value="${o.sekundy}" aria-label="Odstęp w sekundach"></td>
    <td><input type="number" min="0" max="100000" name="na_dobe" value="${o.na_dobe ?? ''}" aria-label="${t('admin.naDobe')}"></td>
    <td><input type="checkbox" name="wlaczone" ${o.wlaczone ? 'checked' : ''} aria-label="Włączony"></td></tr>`).join('');
  if (!$('#admin-test-adres').value) $('#admin-test-adres').value = stan.uzytkownik?.email || '';
}

async function zapiszUstawienia(e) {
  e.preventDefault();
  const f = e.currentTarget;
  const kom = $('#admin-ustawienia-komunikat');
  if (!f.checkValidity()) { f.reportValidity(); return; }
  const liczba = (v) => (v === '' ? null : Number(v));
  const p = {
    ustawienia: Object.fromEntries(['nadawca_email', 'nadawca_nazwa', 'skrzynka_email', 'podpis'].map((k) => [k, f.elements[k].value.trim()])
      .concat(['limit_przebiegu', 'odstep_ms', 'maks_prob'].map((k) => [k, Number(f.elements[k].value)]))),
    dostawcy: $$('#admin-dostawcy tbody tr').map((tr) => ({
      id: tr.dataset.dostawca, priorytet: Number(tr.querySelector('[name="priorytet"]').value),
      dzienny_limit: Number(tr.querySelector('[name="dzienny_limit"]').value), aktywny: tr.querySelector('[name="aktywny"]').checked,
    })),
    odstepy: $$('#admin-odstepy tbody tr').map((tr) => ({
      akcja: tr.dataset.akcjaOdstepu, sekundy: Number(tr.querySelector('[name="sekundy"]').value),
      na_dobe: liczba(tr.querySelector('[name="na_dobe"]').value), wlaczone: tr.querySelector('[name="wlaczone"]').checked,
    })),
  };
  try {
    await rpc('admin_poczta_zapisz', { p });
    kom.textContent = t('admin.zapisano');
    kom.className = 'komunikat ok';
    await rysujUstawienia();
  } catch (err) {
    kom.textContent = komunikatBledu(err);
    kom.className = 'komunikat blad';
  }
}

async function wyslijTest(e, dostawca = null) {
  e?.preventDefault();
  const pole = $('#admin-test-adres');
  const kom = $('#admin-test-komunikat');
  if (!pole.checkValidity()) { pole.reportValidity(); return; }
  try {
    await rpc('admin_poczta_test', { p_do: pole.value.trim(), p_dostawca: dostawca });
    const p = await przebiegKolejki();
    const przez = dostawca ? ` przez ${NAZWY_DOSTAWCOW[dostawca] || dostawca}` : '';
    kom.textContent = p?.wyslane ? t('admin.wyslanoMailTestowyNa', { przez, trim: pole.value.trim() }) : t('admin.mailTestowyCzekaW', { x: p?.powod ? ` (${p.powod})` : '' });
    kom.className = 'komunikat ok';
  } catch (err) {
    kom.textContent = komunikatBledu(err);
    kom.className = 'komunikat blad';
  }
}

// ---------- Statystyki ----------

function wykres(tytul, seria) {
  const dane = seria || [];
  const max = Math.max(1, ...dane.map((d) => d.ile));
  const suma = dane.reduce((s, d) => s + d.ile, 0);
  const s = 100 / Math.max(1, dane.length);
  const slupki = dane.map((d, i) => {
    const h = (d.ile / max) * 96;
    return `<rect class="slupek" x="${(i * s + s * 0.15).toFixed(2)}" y="${(100 - h).toFixed(2)}" width="${(s * 0.7).toFixed(2)}" height="${Math.max(h, d.ile ? 1 : 0).toFixed(2)}"><title>${esc(new Date(d.dzien).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }))}: ${d.ile}</title></rect>`;
  }).join('');
  return `<div class="admin-wykres"><h3>${esc(tytul)} <span>${suma} w ${dane.length} dni · najwięcej ${max === 1 && !suma ? 0 : max}</span></h3>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${esc(tytul)}: razem ${suma}"><line x1="0" y1="100" x2="100" y2="100" vector-effect="non-scaling-stroke"></line>${slupki}</svg></div>`;
}

async function rysujStatystyki() {
  // Pliki liczy Worker (cały bucket R2, z załącznikami poczty); błąd przekaźnika pokazujemy w kafelku, reszta działa.
  const [s, rozmiary, pliki, serwer] = await Promise.all([
    rpc('admin_statystyki', { p_dni: 30 }),
    rpc('rozmiary_tabel'),
    r2.miejsce().catch((e) => ({ blad: komunikatBledu(e) })),
    zuzycieSerwera().then((w) => (w?.miesiac && Array.isArray(w.dni) ? w : { blad: 'brak danych' })).catch((e) => ({ blad: komunikatBledu(e) })), // przeglądarka serwera (#340)
  ]);
  const godz = (ms) => `${(ms / 3600000).toFixed(ms < 360000 ? 2 : 1).replace('.', ',')} h`;
  const kafel = (opis, wartosc, dopisek = '') => `<div class="admin-kafelek"><span>${esc(opis)}</span><strong>${esc(wartosc)}</strong>${dopisek ? `<small>${esc(dopisek)}</small>` : ''}</div>`;
  $('#admin-kafelki').innerHTML = [
    kafel(t('admin.konta'), s.konta.razem, `nowe w 7 dni: ${s.konta.nowe_7}`),
    kafel(t('admin.aktywneKonta'), s.konta.aktywne_7, `w 30 dni: ${s.konta.aktywne_30}`),
    kafel(t('admin.projekty'), s.projekty.razem, `zmienione w 7 dni: ${s.projekty.zmienione_7}`),
    kafel(t('admin.projektyWspoldzielone'), s.projekty.wspoldzielone),
    kafel(t('admin.zaproszenia'), s.zaproszenia.razem, `przyjęte: ${s.zaproszenia.przyjete} · czekają: ${s.zaproszenia.czekajace}`),
    kafel(t('admin.maileDzis'), s.maile.wyslane_dzis, `30 dni: ${s.maile.wyslane_30}`),
    kafel(t('admin.kolejka'), s.maile.w_kolejce, `błędy: ${s.maile.bledy}`),
    kafel(t('admin.skrzynka'), s.skrzynka.nieprzeczytane, `nieprzeczytane · rozmów w 30 dni: ${s.skrzynka.rozmowy_30}`),
    pliki.blad
      ? kafel(t('admin.plikiR2'), '–', `nie udało się odczytać: ${pliki.blad}`)
      : kafel(t('admin.plikiR2'), mb(pliki.pliki_razem), `z ${mb(pliki.limit_plikow)} puli (${Math.round((pliki.pliki_razem / pliki.limit_plikow) * 100)}%)`),
    kafel(t('admin.baza'), mb(rozmiary.baza), `z 500 MB (${Math.round((rozmiary.baza / (500 * 1024 ** 2)) * 100)}%)`),
    serwer.blad
      ? kafel(t('admin.serwerRysowania'), '–', `nie udało się odczytać: ${serwer.blad}`)
      : kafel(t('admin.serwerRysowania'), godz(serwer.miesiac.ms), `w tym miesiącu z ${serwer.planGodzin} h w planie (${Math.round((serwer.miesiac.ms / (serwer.planGodzin * 3600000)) * 100)}%) · stron: ${serwer.miesiac.stron} · zleceń: ${serwer.miesiac.zlecen}`),
  ].join('');
  const tabele = (rozmiary.tabele || []).slice(0, 12);
  $('#admin-tabele').innerHTML = tabele.length
    ? `<table class="admin-tabela"><thead><tr><th>${t('admin.tabela')}</th><th>${t('admin.rozmiar')}</th><th>Wiersze (szac.)</th></tr></thead><tbody>${tabele.map((x) => `<tr><td>${esc(x.tabela)}</td><td>${esc(mb(x.bajty))}</td><td>${esc(Math.max(0, x.wiersze).toLocaleString('pl-PL'))}</td></tr>`).join('')}</tbody></table>`
    : '<p class="ciche">Żadna tabela nie przekracza 256 kB.</p>';
  const wykresSerwera = serwer.blad ? '' : wykres('Strony narysowane na serwerze', serwer.dni.map((d) => ({ dzien: d.dzien, ile: d.stron })));
  $('#admin-wykresy').innerHTML = [wykres('Nowe konta', s.serie.konta), wykres('Nowe projekty', s.serie.projekty), wykres('Wysłane maile', s.serie.maile), wykresSerwera].join('');
}

// ---------- Zdarzenia ----------

for (const a of $$('[data-admin]')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    trasa.ustaw(`admin/${a.dataset.admin}`, { zastap: true });
    pokazPanel(a.dataset.admin);
  });
}
for (const b of $$('#admin-stany [data-stan]')) {
  b.addEventListener('click', () => { stanKolejki = b.dataset.stan; rysujKolejke().catch(blad); });
}
$('#admin-przebieg').addEventListener('click', async () => {
  const p = await przebiegKolejki();
  powiadom(p ? t('admin.wyslano', { x: p.wyslane || 0, x2: p.bledy ? t('admin.bledy', { bledy: p.bledy }) : '', x3: p.powod ? ` (${p.powod})` : '' }) : t('admin.nieUdaloSieUruchomic'), !p);
  await rysujKolejke().catch(blad);
});
$('#admin-form-ustawien').addEventListener('submit', zapiszUstawienia);
$('#admin-form-test').addEventListener('submit', wyslijTest);
