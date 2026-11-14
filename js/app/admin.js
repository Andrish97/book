// Panel administratora (#/admin, decyzja #95) – wzorem panelu Familiady, w wyglądzie Makietki:
// skrzynka kontakt@makietka.app (poczta przychodząca i formularz kontaktowy, odpowiedzi), kolejka maili,
// ustawienia poczty (nadawca, dostawcy z dziennymi limitami, odstępy, klucz skrzynki, test) i statystyki.
// Wszystko przez funkcje bazy admin_* (security definer, tylko konta z tabeli administratorzy).

import { supabase, komunikatBledu } from '../chmura.js';
import { $, $$, powiadom, potwierdz, kiedy, odmiana } from '../ui.js';
import { wstawIkony } from '../ikony.js';
import { stan, trasa } from './kontekst.js';

const ZAKLADKI = ['skrzynka', 'kolejka', 'ustawienia', 'statystyki'];
let zakladka = 'skrzynka';
let folder = 'skrzynka';
let stanKolejki = '';
let otwartyWatek = null;
let szukaj = '';
let czyAdmin = null; // { konto, tak }

async function rpc(nazwa, parametry = {}) {
  const sb = await supabase();
  const { data, error } = await sb.rpc(nazwa, parametry);
  if (error) throw error;
  return data;
}
// Przebieg kolejki od razu (zwykle mail wychodzi w tej samej chwili; co minutę i tak robi to Cron Workera).
async function przebiegKolejki() {
  try {
    const sb = await supabase();
    const { data } = await sb.functions.invoke('poczta', { body: { kolejka: true } });
    return data;
  } catch { return null; }
}

export async function czyAdministrator() {
  if (!stan.uzytkownik) return false;
  if (czyAdmin?.konto === stan.uzytkownik.id) return czyAdmin.tak;
  let tak = false;
  try { tak = Boolean(await rpc('czy_administrator')); } catch { tak = false; }
  czyAdmin = { konto: stan.uzytkownik.id, tak };
  return tak;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
const data = (iso) => (iso ? new Date(iso).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const mb = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(0, Math.round(b / 1024))} kB`);
const blad = (e) => powiadom(komunikatBledu(e), true);

export async function pokazPanel(nazwa = 'skrzynka') {
  zakladka = ZAKLADKI.includes(nazwa) ? nazwa : 'skrzynka';
  for (const a of $$('[data-admin]')) a.setAttribute('aria-selected', String(a.dataset.admin === zakladka));
  for (const s of $$('[data-panel-admin]')) s.hidden = s.dataset.panelAdmin !== zakladka;
  document.title = 'Panel administratora – Makietka';
  await odswiez();
}

export async function odswiez() {
  try {
    if (zakladka === 'skrzynka') await rysujSkrzynke();
    else if (zakladka === 'kolejka') await rysujKolejke();
    else if (zakladka === 'ustawienia') await rysujUstawienia();
    else await rysujStatystyki();
  } catch (e) { blad(e); }
}

// ---------- Skrzynka ----------

const NAZWY_FOLDEROW = { skrzynka: 'Odebrane', archiwum: 'Archiwum', spam: 'Spam', kosz: 'Kosz' };

async function rysujSkrzynke() {
  const w = await rpc('admin_poczta_watki', { p_folder: folder, p_szukaj: szukaj || null, p_limit: 100, p_od: 0 });
  const nowe = w.liczniki?.skrzynka || 0;
  $('#admin-nieprzeczytane').textContent = nowe;
  $('#admin-nieprzeczytane').hidden = !nowe;
  for (const b of $$('#admin-foldery [data-folder]')) {
    b.setAttribute('aria-pressed', String(b.dataset.folder === folder));
    const n = w.liczniki?.[b.dataset.folder] || 0;
    b.textContent = b.dataset.folder === 'skrzynka' && n ? `${NAZWY_FOLDEROW.skrzynka} (${n})` : NAZWY_FOLDEROW[b.dataset.folder];
  }
  const lista = $('#admin-watki');
  lista.replaceChildren(...w.watki.map((t) => {
    const li = document.createElement('li');
    li.dataset.id = t.id;
    li.classList.toggle('nowy', !t.przeczytany);
    li.classList.toggle('wybrany', t.id === otwartyWatek);
    li.innerHTML = `<button type="button"><span class="od">${esc(t.od_nazwa || t.od_email)}${t.zrodlo === 'formularz' ? '<span class="plakietka-zrodla">formularz</span>' : ''}</span>
      <span class="kiedy">${esc(kiedy(t.ostatnia))}</span><span class="temat">${esc(t.temat)}${t.liczba > 1 ? ` (${t.liczba})` : ''}</span>
      <span class="zajawka">${esc(t.zajawka || '')}</span></button>`;
    li.querySelector('button').addEventListener('click', () => otworzWatek(t.id));
    return li;
  }));
  $('#admin-watki-pusto').hidden = w.watki.length > 0;
  $('#admin-watki-pusto').textContent = szukaj ? 'Nic nie pasuje do wyszukiwania.' : `${NAZWY_FOLDEROW[folder]} – pusto.`;
  $('#admin-oproznij-kosz').hidden = folder !== 'kosz' || !w.watki.length;
  if (otwartyWatek && !w.watki.some((t) => t.id === otwartyWatek)) zamknijWatek();
}

function zamknijWatek() {
  otwartyWatek = null;
  $('#admin-skrzynka').classList.remove('otwarta');
  $('#admin-watek').innerHTML = '<p class="admin-watek-pusty ciche">Wybierz rozmowę z listy.</p>';
  for (const li of $$('#admin-watki li')) li.classList.remove('wybrany');
}

async function otworzWatek(id) {
  let w;
  try { w = await rpc('admin_poczta_watek', { p_id: id }); } catch (e) { blad(e); return; }
  otwartyWatek = id;
  const t = w.watek;
  const box = $('#admin-watek');
  const przenies = (cel, etykieta, ikona) => (t.folder === cel ? '' : `<button type="button" class="przycisk maly" data-przenies="${cel}" data-ikona="${ikona}">${etykieta}</button>`);
  box.innerHTML = `
    <div class="watek-naglowek">
      <button type="button" class="przycisk przezroczysty maly watek-wstecz" data-ikona="wstecz">Lista</button>
      <h3>${esc(t.temat)}</h3>
      <div class="watek-akcje">
        ${przenies('archiwum', 'Archiwizuj', 'pobierz')}${przenies('skrzynka', 'Do odebranych', 'koperta')}${przenies('spam', 'Spam', 'uwaga')}${przenies('kosz', 'Usuń', 'kosz')}
        <button type="button" class="przycisk maly" data-nieprzeczytany>Nieprzeczytane</button>
      </div>
    </div>
    <div class="wiadomosci-watku">${w.wiadomosci.map((m) => `
      <article class="wiadomosc ${m.kierunek}">
        <div class="wiadomosc-meta"><strong>${esc(m.kierunek === 'wychodzaca' ? 'Ty' : (m.od_nazwa || m.od_email))}</strong>
          ${m.kierunek === 'przychodzaca' && m.od_nazwa ? `<span>${esc(m.od_email)}</span>` : ''}${m.kierunek === 'wychodzaca' ? `<span>do ${esc(m.do_email)}</span>` : ''}
          <span>${esc(data(m.utworzono))}</span>${m.spam ? '<span>możliwy spam</span>' : ''}
          ${m.kierunek === 'wychodzaca' && m.stan ? `<span class="stan-wysylki ${m.stan === 'blad' ? 'blad' : ''}">${esc({ czeka: 'czeka w kolejce', wysylanie: 'wysyłanie…', wyslany: 'wysłano', blad: `błąd: ${m.blad || ''}`, anulowany: 'anulowano' }[m.stan] || m.stan)}</span>` : ''}
        </div>
        <div class="wiadomosc-tresc">${esc(m.tekst || '(bez treści tekstowej)')}</div>
        ${(m.zalaczniki || []).length ? `<div class="wiadomosc-zalaczniki">${m.zalaczniki.map((z) => `<span title="${esc(z.typ)}">📎 ${esc(z.nazwa)} · ${esc(mb(z.rozmiar || 0))}</span>`).join('')}</div>` : ''}
      </article>`).join('')}
    </div>
    <form class="form-odpowiedzi" novalidate>
      <label class="pole"><span>Odpowiedź do ${esc(t.od_email)}</span><textarea name="tresc" required placeholder="Napisz odpowiedź…"></textarea></label>
      <div class="przyciski-formularza"><button type="submit" class="przycisk glowny" data-ikona="wyslij">Wyślij odpowiedź</button></div>
    </form>`;
  wstawIkony(box);
  $('#admin-skrzynka').classList.add('otwarta');
  for (const li of $$('#admin-watki li')) {
    li.classList.toggle('wybrany', li.dataset.id === id);
    if (li.dataset.id === id) li.classList.remove('nowy');
  }
  box.querySelector('.watek-wstecz').addEventListener('click', zamknijWatek);
  for (const b of box.querySelectorAll('[data-przenies]')) {
    b.addEventListener('click', async () => {
      try {
        await rpc('admin_poczta_zmien', { p_id: id, p_folder: b.dataset.przenies, p_przeczytany: null });
        powiadom(`Przeniesiono do: ${NAZWY_FOLDEROW[b.dataset.przenies]}.`);
        zamknijWatek();
        await rysujSkrzynke();
      } catch (e) { blad(e); }
    });
  }
  box.querySelector('[data-nieprzeczytany]').addEventListener('click', async () => {
    try { await rpc('admin_poczta_zmien', { p_id: id, p_folder: null, p_przeczytany: false }); zamknijWatek(); await rysujSkrzynke(); } catch (e) { blad(e); }
  });
  const form = box.querySelector('.form-odpowiedzi');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tresc = form.tresc.value.trim();
    if (!tresc) { form.tresc.focus(); return; }
    const przycisk = form.querySelector('[type="submit"]');
    przycisk.disabled = true;
    try {
      await rpc('admin_poczta_odpowiedz', { p_watek: id, p_tresc: tresc });
      const p = await przebiegKolejki();
      powiadom(p?.wyslane ? 'Odpowiedź wysłana.' : 'Odpowiedź czeka w kolejce i wyjdzie za chwilę.');
      await otworzWatek(id);
      await rysujSkrzynke();
    } catch (err) { blad(err); } finally { przycisk.disabled = false; }
  });
  box.querySelector('.wiadomosci-watku').lastElementChild?.scrollIntoView({ block: 'nearest' });
}

// ---------- Kolejka ----------

const RODZAJE = { zaproszenie: 'Zaproszenie', kontakt: 'Potwierdzenie z formularza', odpowiedz: 'Odpowiedź ze skrzynki', test: 'Test' };
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
      <span class="ciche">Dziś ${d.wyslane_dzis} z ${d.dzienny_limit}</span><div class="pasek" role="img" aria-label="${proc}% dziennego limitu"><span style="width:${proc}%"></span></div></div>`;
  }).join('');
  const lista = $('#admin-kolejka');
  lista.replaceChildren(...k.maile.map((m) => {
    const li = document.createElement('li');
    const akcje = [
      m.stan === 'czeka' ? '<button type="button" class="przycisk maly" data-akcja-kolejki="teraz">Wyślij teraz</button>' : '',
      ['blad', 'anulowany'].includes(m.stan) ? '<button type="button" class="przycisk maly" data-akcja-kolejki="ponow">Ponów</button>' : '',
      ['czeka', 'blad'].includes(m.stan) ? '<button type="button" class="przycisk maly niebezpieczny" data-akcja-kolejki="anuluj">Anuluj</button>' : '',
    ].join('');
    li.innerHTML = `<div class="opis"><strong><span class="stan-maila ${m.stan}">${esc(STANY[m.stan] || m.stan)}</span>${esc(RODZAJE[m.rodzaj] || m.rodzaj)} → ${esc(m.do_email)}</strong>
      <span>${esc(m.temat || '')}${m.temat ? ' · ' : ''}dodano ${esc(kiedy(m.utworzono))}${m.wyslano ? ` · wysłano ${esc(kiedy(m.wyslano))}` : ''}${m.stan === 'czeka' && new Date(m.nastepna_proba) > new Date() ? ` · następna próba ${esc(data(m.nastepna_proba))}` : ''}${m.proby ? ` · prób: ${m.proby}` : ''}</span>
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
  const u = await rpc('admin_poczta_ustawienia');
  const f = $('#admin-form-ustawien');
  for (const pole of ['nadawca_email', 'nadawca_nazwa', 'skrzynka_email', 'limit_przebiegu', 'odstep_ms', 'maks_prob']) f.elements[pole].value = u.ustawienia[pole] ?? '';
  $('#admin-adres-skrzynki').textContent = u.ustawienia.skrzynka_email;
  $('#admin-dostawcy tbody').innerHTML = u.dostawcy.map((d) => `<tr data-dostawca="${esc(d.id)}">
    <td><strong>${esc(d.nazwa)}</strong><span class="ciche">${esc(d.typ)}</span></td>
    <td><input type="number" min="1" max="99" name="priorytet" value="${d.priorytet}" aria-label="Priorytet"></td>
    <td><input type="number" min="0" max="100000" name="dzienny_limit" value="${d.dzienny_limit}" aria-label="Dzienny limit"></td>
    <td>${d.dzien === new Date().toISOString().slice(0, 10) ? d.wyslane_dzis : 0}</td>
    <td><input type="checkbox" name="aktywny" ${d.aktywny ? 'checked' : ''} aria-label="Włączony"></td></tr>`).join('');
  $('#admin-odstepy tbody').innerHTML = u.odstepy.map((o) => `<tr data-akcja-odstepu="${esc(o.akcja)}">
    <td>${esc(o.opis)}<span class="ciche">${esc(o.akcja)}</span></td>
    <td><input type="number" min="0" max="86400" name="sekundy" value="${o.sekundy}" aria-label="Odstęp w sekundach"></td>
    <td><input type="number" min="0" max="100000" name="na_dobe" value="${o.na_dobe ?? ''}" aria-label="Na dobę"></td>
    <td><input type="checkbox" name="wlaczone" ${o.wlaczone ? 'checked' : ''} aria-label="Włączony"></td></tr>`).join('');
  $('#admin-klucz-opis').textContent = u.ustawienia.klucz_ustawiony
    ? `Ustawiony ${kiedy(u.ustawienia.klucz_skrzynki_od)}. Worker wpisuje nim pocztę przychodzącą i formularz kontaktowy do skrzynki.`
    : 'Nie ustawiony – skrzynka i formularz kontaktowy jeszcze nie działają. Wygeneruj klucz i wpisz go w Cloudflare.';
  if (!$('#admin-test-adres').value) $('#admin-test-adres').value = stan.uzytkownik?.email || '';
}

async function zapiszUstawienia(e) {
  e.preventDefault();
  const f = e.currentTarget;
  const kom = $('#admin-ustawienia-komunikat');
  if (!f.checkValidity()) { f.reportValidity(); return; }
  const liczba = (v) => (v === '' ? null : Number(v));
  const p = {
    ustawienia: Object.fromEntries(['nadawca_email', 'nadawca_nazwa', 'skrzynka_email'].map((k) => [k, f.elements[k].value.trim()])
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
    kom.textContent = 'Zapisano.';
    kom.className = 'komunikat ok';
    await rysujUstawienia();
  } catch (err) {
    kom.textContent = komunikatBledu(err);
    kom.className = 'komunikat blad';
  }
}

async function nowyKlucz() {
  if (!await potwierdz('Nowy klucz skrzynki?', 'Stary klucz przestanie działać od razu – do czasu wpisania nowego w Cloudflare poczta przychodząca i formularz kontaktowy nie będą trafiać do skrzynki.', 'Utwórz nowy klucz')) return;
  try {
    const k = await rpc('admin_klucz_skrzynki');
    $('#admin-klucz-wartosc').value = k;
    $('#admin-klucz').hidden = false;
    $('#admin-klucz-wartosc').select();
    await rysujUstawienia();
  } catch (e) { blad(e); }
}

async function wyslijTest(e) {
  e.preventDefault();
  const pole = $('#admin-test-adres');
  const kom = $('#admin-test-komunikat');
  if (!pole.checkValidity()) { pole.reportValidity(); return; }
  try {
    await rpc('admin_poczta_test', { p_do: pole.value.trim() });
    const p = await przebiegKolejki();
    kom.textContent = p?.wyslane ? `Wysłano mail testowy na ${pole.value.trim()}.` : `Mail testowy czeka w kolejce${p?.powod ? ` (${p.powod})` : ''} – zobacz „Kolejka maili”.`;
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
  const s = await rpc('admin_statystyki', { p_dni: 30 });
  const kafel = (opis, wartosc, dopisek = '') => `<div class="admin-kafelek"><span>${esc(opis)}</span><strong>${esc(wartosc)}</strong>${dopisek ? `<small>${esc(dopisek)}</small>` : ''}</div>`;
  $('#admin-kafelki').innerHTML = [
    kafel('Konta', s.konta.razem, `nowe w 7 dni: ${s.konta.nowe_7}`),
    kafel('Aktywne konta', s.konta.aktywne_7, `w 30 dni: ${s.konta.aktywne_30}`),
    kafel('Projekty', s.projekty.razem, `zmienione w 7 dni: ${s.projekty.zmienione_7}`),
    kafel('Projekty współdzielone', s.projekty.wspoldzielone),
    kafel('Zaproszenia', s.zaproszenia.razem, `przyjęte: ${s.zaproszenia.przyjete} · czekają: ${s.zaproszenia.czekajace}`),
    kafel('Maile dziś', s.maile.wyslane_dzis, `30 dni: ${s.maile.wyslane_30}`),
    kafel('Kolejka', s.maile.w_kolejce, `błędy: ${s.maile.bledy}`),
    kafel('Skrzynka', s.skrzynka.nieprzeczytane, `nieprzeczytane · rozmów w 30 dni: ${s.skrzynka.rozmowy_30}`),
    kafel('Pliki', mb(s.miejsce.pliki), 'magazyn plików'),
    kafel('Baza', mb(s.miejsce.baza), 'z 500 MB'),
  ].join('');
  $('#admin-wykresy').innerHTML = [wykres('Nowe konta', s.serie.konta), wykres('Nowe projekty', s.serie.projekty), wykres('Wysłane maile', s.serie.maile)].join('');
}

// ---------- Zdarzenia ----------

for (const a of $$('[data-admin]')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    trasa.ustaw(`admin/${a.dataset.admin}`, { zastap: true });
    pokazPanel(a.dataset.admin);
  });
}
for (const b of $$('#admin-foldery [data-folder]')) {
  b.addEventListener('click', () => { folder = b.dataset.folder; zamknijWatek(); rysujSkrzynke().catch(blad); });
}
for (const b of $$('#admin-stany [data-stan]')) {
  b.addEventListener('click', () => { stanKolejki = b.dataset.stan; rysujKolejke().catch(blad); });
}
let timerSzukania = null;
$('#admin-szukaj').addEventListener('input', (e) => {
  clearTimeout(timerSzukania);
  timerSzukania = setTimeout(() => { szukaj = e.target.value.trim(); rysujSkrzynke().catch(blad); }, 300);
});
$('#admin-oproznij-kosz').addEventListener('click', async () => {
  if (!await potwierdz('Opróżnić kosz?', 'Rozmowy z kosza znikną na zawsze.', 'Opróżnij', true)) return;
  try {
    const n = await rpc('admin_poczta_oproznij_kosz');
    powiadom(`Usunięto ${n} ${odmiana(n, 'rozmowę', 'rozmowy', 'rozmów')}.`);
    await rysujSkrzynke();
  } catch (e) { blad(e); }
});
$('#admin-przebieg').addEventListener('click', async () => {
  const p = await przebiegKolejki();
  powiadom(p ? `Wysłano: ${p.wyslane || 0}${p.bledy ? `, błędy: ${p.bledy}` : ''}${p.powod ? ` (${p.powod})` : ''}.` : 'Nie udało się uruchomić wysyłki.', !p);
  await rysujKolejke().catch(blad);
});
$('#admin-form-ustawien').addEventListener('submit', zapiszUstawienia);
$('#admin-nowy-klucz').addEventListener('click', nowyKlucz);
$('#admin-klucz-kopiuj').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#admin-klucz-wartosc').value); powiadom('Klucz skopiowany.'); } catch { $('#admin-klucz-wartosc').select(); powiadom('Zaznaczyłem klucz – skopiuj go skrótem Ctrl+C.'); }
});
$('#admin-form-test').addEventListener('submit', wyslijTest);
// Otwarty panel skrzynki odświeża się co pół minuty (nowa poczta).
setInterval(() => {
  if (document.body.dataset.ekran === 'admin' && zakladka === 'skrzynka' && !document.hidden && !$('#admin-watek textarea:focus')) rysujSkrzynke().catch(() => {});
}, 30000);
