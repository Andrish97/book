// Skrzynka kontakt@makietka.app w panelu administratora (decyzja #110) – klient poczty jak w Familiadzie (bez
// marketingu), w wyglądzie Makietki:
//  • foldery: Odebrane, Zgłoszenia (formularz kontaktowy, numery ZGL-RRRR-NNNN), Z gwiazdką, Wysłane, Robocze,
//    Archiwum, Spam, Kosz; liczniki nieprzeczytanych; wyszukiwanie; strony po 50,
//  • lista z zaznaczaniem i operacjami zbiorczymi (przeczytane, gwiazdka, archiwum, spam, kosz, przywrócenie,
//    usunięcie na zawsze, zamknięcie zgłoszeń),
//  • rozmowa: treść HTML w ramce bez skryptów (sandbox + CSP, obrazy z internetu dopiero na żądanie), załączniki,
//  • pisanie: Do/DW/UDW z podpowiedziami adresów, treść w TinyMCE (jsDelivr, GPL, po polsku, jasny/ciemny),
//    załączniki do R2 (do 10 MB razem), podpis, odpowiedź / odpowiedź wszystkim / przekazanie z cytatem,
//    kopie robocze zapisywane w trakcie pisania; wysyłka przez kolejkę (Brevo → ZeptoMail) z adresu skrzynki,
//  • zmiany na żywo (Realtime na poczta_watki – tylko administrator),
//  • telefon: lista → rozmowa → pisanie jako osobne ekrany.
// Dane: funkcje bazy admin_poczta_* (migracja 20261115160000_skrzynka.sql).

import { supabase, komunikatBledu, r2 } from '../chmura.js';
import { $, $$, powiadom, potwierdz, kiedy, odmiana } from '../ui.js';
import { wstawIkony } from '../ikony.js';
import { biblioteka } from '../biblioteki.js';

export const TINYMCE = 'https://cdn.jsdelivr.net/npm/tinymce@7.9.3/tinymce.min.js';
const TINYMCE_PL = 'https://cdn.jsdelivr.net/npm/tinymce-i18n@26.10.26/langs7/pl.js';
const NA_STRONE = 50;
const LIMIT_ZALACZNIKOW = 10 * 1024 * 1024;
const FOLDERY = {
  skrzynka: 'Odebrane', zgloszenia: 'Zgłoszenia', gwiazdka: 'Z gwiazdką', wyslane: 'Wysłane', robocze: 'Robocze',
  archiwum: 'Archiwum', spam: 'Spam', kosz: 'Kosz',
};
// Operacje zbiorcze widoczne w danym folderze.
const ZBIORCZO = {
  skrzynka: ['przeczytane', 'nieprzeczytane', 'gwiazdka', 'archiwum', 'spam', 'kosz'],
  zgloszenia: ['przeczytane', 'nieprzeczytane', 'gwiazdka', 'archiwum', 'kosz', 'zamknij'],
  gwiazdka: ['przeczytane', 'nieprzeczytane', 'archiwum', 'kosz'],
  wyslane: ['przeczytane', 'nieprzeczytane', 'gwiazdka', 'archiwum', 'kosz'],
  robocze: ['usun'],
  archiwum: ['przeczytane', 'nieprzeczytane', 'gwiazdka', 'przywroc', 'spam', 'kosz'],
  spam: ['przywroc', 'kosz', 'usun'],
  kosz: ['przywroc', 'usun'],
};
const KOMUNIKATY = {
  przeczytane: 'Oznaczono jako przeczytane', nieprzeczytane: 'Oznaczono jako nieprzeczytane', gwiazdka: 'Dodano gwiazdkę',
  bez_gwiazdki: 'Usunięto gwiazdkę', archiwum: 'Przeniesiono do archiwum', spam: 'Przeniesiono do spamu', kosz: 'Przeniesiono do kosza',
  przywroc: 'Przywrócono', usun: 'Usunięto na zawsze', zamknij: 'Zamknięto zgłoszenie', otworz: 'Otwarto zgłoszenie ponownie',
};

const s = {
  folder: 'skrzynka', szukaj: '', od: 0, razem: 0, watki: [], zaznaczone: new Set(), liczniki: {},
  otwarty: null, dane: null, skrzynka: 'kontakt@makietka.app', podpis: '', obrazy: new Set(), kanal: null,
};

// ---------- Pomocnicze ----------

async function rpc(nazwa, parametry = {}) {
  const sb = await supabase();
  const { data, error } = await sb.rpc(nazwa, parametry);
  if (error) throw error;
  return data;
}
// Przebieg kolejki od razu (zwykle mail wychodzi w tej samej chwili; co minutę i tak robi to Cron Workera).
export async function przebiegKolejki() {
  try {
    const sb = await supabase();
    const { data } = await sb.functions.invoke('poczta', { body: { kolejka: true } });
    return data;
  } catch { return null; }
}
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
const data = (iso) => (iso ? new Date(iso).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const rozmiar = (b) => (b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round((b || 0) / 1024))} kB`);
const blad = (e) => powiadom(komunikatBledu(e), true);
const POPRAWNY = /^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/;
const naszAdres = (a) => String(a || '').toLowerCase() === s.skrzynka.toLowerCase() || /@makietka\.app$/i.test(a || '');
const kto = (m) => m.od_nazwa || m.od_email || '';
const temat = (prefiks, t) => (new RegExp(`^\\s*(${prefiks === 'Re' ? 're|odp' : 'fwd|fw|pd'})\\s*:`, 'i').test(t || '') ? t : `${prefiks}: ${t || ''}`.trim());

function ustawWidok(widok) {
  $('#admin-skrzynka').dataset.widok = widok;
  $('#admin-pisz').hidden = widok !== 'pisz';
  $('#admin-watek').hidden = widok === 'pisz';
}

// ---------- Lista ----------

export async function rysujSkrzynke() {
  const w = await rpc('admin_poczta_watki', { p_folder: s.folder, p_szukaj: s.szukaj || null, p_limit: NA_STRONE, p_od: s.od });
  s.watki = w.watki;
  s.razem = w.razem;
  s.liczniki = w.liczniki || {};
  s.skrzynka = w.skrzynka || s.skrzynka;
  s.podpis = w.podpis ?? s.podpis;
  $('#admin-adres-skrzynki').textContent = s.skrzynka;
  const widoczne = new Set(s.watki.map((t) => t.id));
  for (const id of [...s.zaznaczone]) if (!widoczne.has(id)) s.zaznaczone.delete(id);
  ustawLicznik(s.liczniki.skrzynka || 0);
  for (const b of $$('#admin-foldery [data-folder]')) {
    const f = b.dataset.folder;
    b.setAttribute('aria-pressed', String(f === s.folder));
    const n = s.liczniki[f] || 0;
    b.querySelector('.licznik-folderu').textContent = n || '';
    b.classList.toggle('ma-nowe', Boolean(n) && f !== 'robocze');
  }
  $('#admin-tytul-folderu').textContent = s.szukaj ? `Szukaj: ${s.szukaj}` : FOLDERY[s.folder];
  const lista = $('#admin-watki');
  lista.replaceChildren(...s.watki.map(wierszListy));
  wstawIkony(lista);
  $('#admin-watki-pusto').hidden = s.watki.length > 0;
  $('#admin-watki-pusto').textContent = s.szukaj ? 'Nic nie pasuje do wyszukiwania.' : {
    skrzynka: 'Brak wiadomości w Odebranych.', robocze: 'Brak wersji roboczych.', kosz: 'Kosz jest pusty.', spam: 'Brak spamu.',
  }[s.folder] || `${FOLDERY[s.folder]} – pusto.`;
  $('#admin-zakres').textContent = s.razem ? `${s.od + 1}–${Math.min(s.od + s.watki.length, s.razem)} z ${s.razem}` : '';
  $('#admin-poprzednie').disabled = s.od === 0;
  $('#admin-nastepne').disabled = s.od + NA_STRONE >= s.razem;
  const oproznij = $('#admin-oproznij');
  oproznij.hidden = !['kosz', 'spam'].includes(s.folder) || !s.watki.length;
  oproznij.textContent = s.folder === 'spam' ? 'Opróżnij spam' : 'Opróżnij kosz';
  rysujZbiorcze();
}

function wierszListy(t) {
  const li = document.createElement('li');
  li.dataset.id = t.id;
  const robocza = Boolean(t.robocza);
  li.classList.toggle('nowy', !robocza && !t.przeczytany);
  li.classList.toggle('wybrany', t.id === s.otwarty);
  li.classList.toggle('zaznaczony', s.zaznaczone.has(t.id));
  const od = robocza || s.folder === 'wyslane'
    ? `Do: ${(t.do_lista || []).join(', ') || '(brak adresata)'}`
    : (t.od_nazwa || t.od_email);
  const plakietki = [
    robocza ? '<span class="plakietka robocza">Wersja robocza</span>' : '',
    t.zgloszenie ? `<span class="plakietka zgloszenie ${t.zgloszenie_stan === 'zamkniete' ? 'zamkniete' : ''}" title="Zgłoszenie z formularza kontaktowego – ${t.zgloszenie_stan === 'zamkniete' ? 'zamknięte' : 'otwarte'}">${esc(t.zgloszenie)}</span>` : '',
    t.zrodlo === 'formularz' && !t.zgloszenie ? '<span class="plakietka">formularz</span>' : '',
    t.na_adres ? `<span class="plakietka plakietka-zrodla" title="Wiadomość na adres ${esc(t.na_adres)}, nie na skrzynkę">na ${esc(t.na_adres.split('@')[0])}@</span>` : '',
    t.robocze ? '<span class="plakietka robocza">Wersja robocza</span>' : '',
  ].join('');
  li.innerHTML = `
    <label class="wybor" title="Zaznacz"><input type="checkbox" ${s.zaznaczone.has(t.id) ? 'checked' : ''} aria-label="Zaznacz: ${esc(t.temat || '(bez tematu)')}"></label>
    ${robocza ? '<span class="gwiazdka-miejsce"></span>' : `<button type="button" class="gwiazdka" data-ikona="gwiazdka" data-rozmiar="18" aria-pressed="${t.gwiazdka}" title="${t.gwiazdka ? 'Usuń gwiazdkę' : 'Dodaj gwiazdkę'}" aria-label="Gwiazdka"></button>`}
    <button type="button" class="otworz">
      <span class="od">${esc(od)}${t.liczba > 1 ? `<span class="liczba">${t.liczba}</span>` : ''}</span>
      <span class="kiedy">${t.zalaczniki ? '<span data-ikona="spinacz" data-rozmiar="14" title="Załączniki"></span>' : ''}${esc(kiedy(t.ostatnia))}</span>
      <span class="temat">${plakietki}<span class="tekst-tematu">${esc(t.temat || '(bez tematu)')}</span></span>
      <span class="zajawka">${esc(t.zajawka || '')}</span>
    </button>`;
  li.querySelector('.wybor input').addEventListener('change', (e) => {
    if (e.target.checked) s.zaznaczone.add(t.id); else s.zaznaczone.delete(t.id);
    li.classList.toggle('zaznaczony', e.target.checked);
    rysujZbiorcze();
  });
  li.querySelector('.gwiazdka')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    const tak = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(tak));
    try { await rpc('admin_poczta_zbiorczo', { p_ids: [t.id], p_akcja: tak ? 'gwiazdka' : 'bez_gwiazdki' }); t.gwiazdka = tak; } catch (err) { b.setAttribute('aria-pressed', String(!tak)); blad(err); }
  });
  li.querySelector('.otworz').addEventListener('click', () => (robocza ? otworzRobocza(t.id) : otworzWatek(t.id)));
  return li;
}

function rysujZbiorcze() {
  const n = s.zaznaczone.size;
  const wszystkie = $('#admin-zaznacz-wszystkie');
  wszystkie.checked = n > 0 && n === s.watki.length;
  wszystkie.indeterminate = n > 0 && n < s.watki.length;
  wszystkie.disabled = !s.watki.length;
  $('#admin-zbiorcze').hidden = !n;
  $('#admin-tytul-folderu').hidden = Boolean(n);
  $('#admin-zaznaczone').textContent = n ? `${n} ${odmiana(n, 'zaznaczona', 'zaznaczone', 'zaznaczonych')}` : '';
  const dozwolone = ZBIORCZO[s.folder] || [];
  for (const b of $$('#admin-zbiorcze [data-zbiorczo]')) b.hidden = !dozwolone.includes(b.dataset.zbiorczo);
}

async function zbiorczo(akcja, ids = [...s.zaznaczone]) {
  if (!ids.length) return;
  if (akcja === 'usun') {
    const ile = `${ids.length} ${odmiana(ids.length, 'wiadomość', 'wiadomości', 'wiadomości')}`;
    if (!await potwierdz('Usunąć na zawsze?', `${ile} zniknie bez możliwości przywrócenia, razem z załącznikami.`, 'Usuń na zawsze', true)) return;
  }
  try {
    if (s.folder === 'robocze') {
      for (const id of ids) await usunRobocza(id);
    } else {
      const w = await rpc('admin_poczta_zbiorczo', { p_ids: ids, p_akcja: akcja });
      await usunPliki(w?.klucze);
    }
    powiadom(`${KOMUNIKATY[akcja]}${ids.length > 1 ? ` (${ids.length})` : ''}.`);
    s.zaznaczone.clear();
    if (ids.includes(s.otwarty) && ['archiwum', 'spam', 'kosz', 'usun', 'przywroc'].includes(akcja)) zamknijWatek();
    await rysujSkrzynke();
    if (s.otwarty && ids.includes(s.otwarty)) await otworzWatek(s.otwarty, { cicho: true });
  } catch (e) { blad(e); }
}

// Załączniki, do których nic się już nie odwołuje (usunięte rozmowy, kopie robocze) – z R2.
async function usunPliki(klucze) {
  for (const k of klucze || []) await r2.usunZalacznikPoczty(k).catch(() => {});
}

// Licznik nieprzeczytanych: zakładka panelu i pozycja w menu konta.
function ustawLicznik(n) {
  for (const el of [$('#admin-nieprzeczytane'), $('#admin-licznik-menu')]) {
    if (!el) continue;
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = !n;
  }
}

// ---------- Rozmowa ----------

function zamknijWatek() {
  s.otwarty = null;
  s.dane = null;
  $('#admin-watek').innerHTML = '<div class="skrzynka-nic"><span data-ikona="koperta" data-rozmiar="40"></span><p>Wybierz wiadomość z listy.</p></div>';
  wstawIkony($('#admin-watek'));
  for (const li of $$('#admin-watki li')) li.classList.remove('wybrany');
  if ($('#admin-skrzynka').dataset.widok !== 'pisz') ustawWidok('lista');
}

export async function otworzWatek(id, { cicho = false } = {}) {
  let w;
  try { w = await rpc('admin_poczta_watek', { p_id: id }); } catch (e) { if (!cicho) blad(e); return; }
  // Otwarcie innej rozmowy przy pisaniu – wiadomość zostaje w Robocze.
  if (!cicho && !$('#admin-pisz').hidden) await zamknijPisanie();
  if (s.otwarty !== id) s.obrazy.clear();
  s.otwarty = id;
  s.dane = w;
  s.skrzynka = w.skrzynka || s.skrzynka;
  s.podpis = w.podpis ?? s.podpis;
  rysujWatek();
  if (!cicho) ustawWidok('watek');
  for (const li of $$('#admin-watki li')) {
    li.classList.toggle('wybrany', li.dataset.id === id);
    if (li.dataset.id === id && li.classList.contains('nowy')) {
      li.classList.remove('nowy');
      if (s.liczniki.skrzynka && w.watek.folder === 'skrzynka') ustawLicznik((s.liczniki.skrzynka -= 1));
    }
  }
}

function przyciskAkcji(akcja, ikona, etykieta, klasa = '') {
  return `<button type="button" class="przycisk-ikona ${klasa}" data-watek-akcja="${akcja}" data-ikona="${ikona}" title="${etykieta}" aria-label="${etykieta}"></button>`;
}

function rysujWatek() {
  const { watek: t, wiadomosci, robocze, uzytkownik } = s.dane;
  const box = $('#admin-watek');
  const wKoszu = t.folder === 'kosz';
  const wSpamie = t.folder === 'spam';
  const akcje = [
    !wKoszu && !wSpamie && t.folder !== 'archiwum' ? przyciskAkcji('archiwum', 'archiwum', 'Archiwizuj') : '',
    t.folder === 'archiwum' || wKoszu || wSpamie ? przyciskAkcji('przywroc', 'odebrane', wSpamie ? 'To nie spam' : 'Przywróć do Odebranych') : '',
    !wSpamie && !wKoszu ? przyciskAkcji('spam', 'uwaga', 'Zgłoś spam') : '',
    !wKoszu ? przyciskAkcji('kosz', 'kosz', 'Usuń (do kosza)') : przyciskAkcji('usun', 'kosz', 'Usuń na zawsze', 'niebezpieczny'),
    przyciskAkcji('nieprzeczytane', 'koperta', 'Oznacz jako nieprzeczytane'),
    `<button type="button" class="przycisk-ikona gwiazdka" data-watek-akcja="${t.gwiazdka ? 'bez_gwiazdki' : 'gwiazdka'}" data-ikona="gwiazdka" aria-pressed="${t.gwiazdka}" title="${t.gwiazdka ? 'Usuń gwiazdkę' : 'Dodaj gwiazdkę'}" aria-label="Gwiazdka"></button>`,
  ].join('');
  const ostatnia = wiadomosci.at(-1);
  box.innerHTML = `
    <div class="watek-pasek">
      <button type="button" class="przycisk-ikona watek-wstecz" data-ikona="wstecz" title="Wróć do listy" aria-label="Wróć do listy"></button>
      <div class="watek-akcje" role="toolbar" aria-label="Rozmowa">${akcje}</div>
    </div>
    <div class="watek-przewijany">
      <h3 class="watek-temat">${esc(t.temat || '(bez tematu)')}${t.folder !== 'skrzynka' ? `<span class="plakietka">${esc(FOLDERY[t.folder] || t.folder)}</span>` : ''}</h3>
      ${t.zgloszenie ? `<div class="watek-zgloszenie ${t.zgloszenie_stan}">
        <span data-ikona="zgloszenie" data-rozmiar="18"></span>
        <span><strong>Zgłoszenie ${esc(t.zgloszenie)}</strong> · ${t.zgloszenie_stan === 'zamkniete' ? 'zamknięte' : 'otwarte'} · z formularza kontaktowego${uzytkownik ? ` · konto ${esc(uzytkownik.email)}` : ''}</span>
        <button type="button" class="przycisk maly" data-watek-akcja="${t.zgloszenie_stan === 'zamkniete' ? 'otworz' : 'zamknij'}">${t.zgloszenie_stan === 'zamkniete' ? 'Otwórz ponownie' : 'Zamknij zgłoszenie'}</button>
      </div>` : ''}
      <div class="wiadomosci-watku">${wiadomosci.map((m, i) => wiadomoscHtml(m, wiadomosci.length > 2 && i < wiadomosci.length - 1)).join('')}</div>
      ${(robocze || []).map((r) => `<div class="watek-robocza" data-robocza="${r.id}"><span class="plakietka robocza">Wersja robocza</span>
        <span class="zajawka">${esc((r.html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) || '(pusta)')}</span>
        <button type="button" class="przycisk maly" data-edytuj-robocza="${r.id}" data-ikona="olowek">Edytuj</button></div>`).join('')}
      <div class="watek-odpowiedz">
        <button type="button" class="przycisk" data-pisz-tryb="odpowiedz" data-ikona="odpowiedz">Odpowiedz</button>
        ${(ostatnia && (ostatnia.do_lista || []).length + (ostatnia.dw || []).length > 1) ? '<button type="button" class="przycisk" data-pisz-tryb="wszystkim" data-ikona="odpowiedzWszystkim">Odpowiedz wszystkim</button>' : ''}
        <button type="button" class="przycisk" data-pisz-tryb="przekaz" data-ikona="przekaz">Przekaż</button>
      </div>
    </div>`;
  wstawIkony(box);
  box.querySelector('.watek-wstecz').addEventListener('click', () => { zamknijWatek(); });
  for (const b of box.querySelectorAll('[data-watek-akcja]')) b.addEventListener('click', () => zbiorczo(b.dataset.watekAkcja, [t.id]));
  for (const b of box.querySelectorAll('[data-pisz-tryb]')) {
    b.addEventListener('click', () => {
      const id = b.closest('[data-wiadomosc]')?.dataset.wiadomosc;
      otworzPisanie({ tryb: b.dataset.piszTryb, wiadomosc: wiadomosci.find((m) => m.id === id) || ostatnia });
    });
  }
  for (const b of box.querySelectorAll('[data-edytuj-robocza]')) b.addEventListener('click', () => otworzRobocza(b.dataset.edytujRobocza));
  for (const art of box.querySelectorAll('.wiadomosc')) {
    art.querySelector('.wiadomosc-naglowek').addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (art.classList.contains('zwinieta')) { art.classList.remove('zwinieta'); wstawTresc(art); }
    });
    if (!art.classList.contains('zwinieta')) wstawTresc(art);
  }
  for (const b of box.querySelectorAll('[data-zalacznik]')) {
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const adres = URL.createObjectURL(await r2.zalacznikPoczty(b.dataset.zalacznik));
        Object.assign(document.createElement('a'), { href: adres, download: b.dataset.nazwa }).click();
        setTimeout(() => URL.revokeObjectURL(adres), 60000);
      } catch (e) { blad(e); } finally { b.disabled = false; }
    });
  }
  box.querySelector('.wiadomosc:not(.zwinieta):last-of-type')?.scrollIntoView({ block: 'nearest' });
}

const STANY = { czeka: 'czeka w kolejce', wysylanie: 'wysyłanie…', wyslany: 'wysłano', anulowany: 'anulowano' };

function wiadomoscHtml(m, zwinieta) {
  const wych = m.kierunek === 'wychodzaca';
  const nadawca = wych ? (m.od_nazwa || 'Makietka') : kto(m);
  const adresaci = [
    (m.do_lista || []).length ? `do: ${(m.do_lista || []).map(esc).join(', ')}` : (m.do_email ? `do: ${esc(m.do_email)}` : ''),
    (m.dw || []).length ? `dw: ${m.dw.map(esc).join(', ')}` : '',
    (m.udw || []).length ? `udw: ${m.udw.map(esc).join(', ')}` : '',
  ].filter(Boolean).join(' · ');
  const naInny = !wych && m.do_email && m.do_email.toLowerCase() !== s.skrzynka.toLowerCase();
  const stanWysylki = wych && m.stan ? `<span class="stan-wysylki ${m.stan === 'blad' ? 'blad' : m.stan}">${esc(m.stan === 'blad' ? `błąd: ${m.blad || ''}` : STANY[m.stan] || m.stan)}</span>` : '';
  const zajawka = (m.tekst || (m.html || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 160);
  return `
    <article class="wiadomosc ${m.kierunek} ${zwinieta ? 'zwinieta' : ''}" data-wiadomosc="${m.id}">
      <header class="wiadomosc-naglowek">
        <span class="awatar-poczty" aria-hidden="true">${esc((nadawca || '?').trim().charAt(0).toUpperCase())}</span>
        <div class="wiadomosc-kto">
          <strong>${esc(nadawca)}</strong>${!wych && m.od_nazwa ? ` <span class="ciche">&lt;${esc(m.od_email)}&gt;</span>` : ''}${wych ? ` <span class="ciche">&lt;${esc(m.od_email || s.skrzynka)}&gt;</span>` : ''}
          <div class="wiadomosc-adresaci">${adresaci}${naInny ? ` <span class="na-adres">na ${esc(m.do_email)}</span>` : ''}${m.spam ? ' <span class="plakietka">możliwy spam</span>' : ''}</div>
          <div class="wiadomosc-zajawka">${esc(zajawka)}</div>
        </div>
        <div class="wiadomosc-kiedy"><span title="${esc(data(m.utworzono))}">${esc(kiedy(m.utworzono))}</span>${stanWysylki}</div>
        <div class="wiadomosc-akcje">
          <button type="button" class="przycisk-ikona" data-pisz-tryb="odpowiedz" data-ikona="odpowiedz" title="Odpowiedz" aria-label="Odpowiedz"></button>
          <button type="button" class="przycisk-ikona" data-pisz-tryb="przekaz" data-ikona="przekaz" title="Przekaż" aria-label="Przekaż"></button>
        </div>
      </header>
      <div class="wiadomosc-tresc"></div>
      ${(m.zalaczniki || []).length ? `<div class="wiadomosc-zalaczniki">${m.zalaczniki.map((z) => (z.klucz
        ? `<button type="button" class="zalacznik" data-zalacznik="${esc(z.klucz)}" data-nazwa="${esc(z.nazwa)}" title="${esc(z.typ)} – pobierz"><span data-ikona="spinacz" data-rozmiar="16"></span><span class="nazwa">${esc(z.nazwa)}</span><span class="ciche">${esc(rozmiar(z.rozmiar))}</span></button>`
        : `<span class="zalacznik brak" title="${esc(z.typ)} – za duży, by go zachować (ponad 10 MB)"><span data-ikona="spinacz" data-rozmiar="16"></span><span class="nazwa">${esc(z.nazwa)}</span><span class="ciche">${esc(rozmiar(z.rozmiar))}</span></span>`)).join('')}</div>` : ''}
    </article>`;
}

// ---------- Bezpieczna treść HTML ----------

// Treść maila w ramce bez skryptów: najpierw bez elementów aktywnych (DOMParser – nic się nie wykonuje), potem
// <iframe sandbox> bez allow-scripts i z CSP: żadnych skryptów, formularzy ani połączeń; obrazy z internetu
// dopiero po „Pokaż obrazy” (śledzenie otwarć). Linki otwierają się w nowej karcie.
export function bezpiecznyHtml(html) {
  const dok = new DOMParser().parseFromString(String(html || ''), 'text/html');
  dok.querySelectorAll('script, iframe, frame, frameset, object, embed, applet, form, input, button, textarea, select, meta, link, base, noscript, template, portal').forEach((e) => e.remove());
  for (const el of dok.querySelectorAll('*')) {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name) || (/^(href|src|action|formaction|xlink:href|background)$/i.test(a.name) && /^\s*(javascript|vbscript|data:text\/html)/i.test(a.value))) el.removeAttribute(a.name);
    }
  }
  const style = [...dok.querySelectorAll('style')].map((x) => x.outerHTML).join('');
  dok.querySelectorAll('style').forEach((x) => x.remove());
  return { style, body: dok.body?.innerHTML || '', obrazyZSieci: [...dok.querySelectorAll('img[src]')].some((i) => /^\s*(https?:)?\/\//i.test(i.getAttribute('src'))) };
}

function dokumentRamki({ style, body }, obrazy) {
  const csp = `default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: cid:${obrazy ? ' https: http:' : ''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
<style>html,body{margin:0;padding:0}body{font:14px/1.55 Inter,system-ui,sans-serif;color:#1c1b19;background:#fff;overflow-wrap:anywhere;padding:2px}img{max-width:100%;height:auto}blockquote{margin:6px 0 6px 4px;padding-left:10px;border-left:3px solid #d9d6cd;color:#55524b}table{max-width:100%}pre{white-space:pre-wrap}</style>${style}</head><body>${body}</body></html>`;
}

function wstawTresc(art) {
  const m = s.dane.wiadomosci.find((x) => x.id === art.dataset.wiadomosc);
  const box = art.querySelector('.wiadomosc-tresc');
  if (!m || box.dataset.gotowe) return;
  box.dataset.gotowe = '1';
  if (!m.html) {
    box.innerHTML = `<div class="tekst-wiadomosci">${esc(m.tekst || '(bez treści)')}</div>`;
    return;
  }
  const czysty = bezpiecznyHtml(m.html);
  const obrazy = s.obrazy.has(m.id);
  if (czysty.obrazyZSieci && !obrazy) {
    const pasek = document.createElement('div');
    pasek.className = 'pasek-obrazow';
    pasek.innerHTML = '<span>Obrazy z internetu są ukryte (nadawca mógłby sprawdzić, że wiadomość została otwarta).</span><button type="button" class="link-przycisk">Pokaż obrazy</button>';
    pasek.querySelector('button').addEventListener('click', () => { s.obrazy.add(m.id); delete box.dataset.gotowe; box.replaceChildren(); wstawTresc(art); });
    box.append(pasek);
  }
  const ramka = document.createElement('iframe');
  ramka.className = 'ramka-wiadomosci';
  ramka.title = `Treść wiadomości: ${m.temat || ''}`;
  ramka.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox allow-same-origin');
  ramka.setAttribute('referrerpolicy', 'no-referrer');
  ramka.srcdoc = dokumentRamki(czysty, obrazy);
  const dopasuj = () => {
    const d = ramka.contentDocument;
    if (d?.documentElement) ramka.style.height = `${Math.min(Math.max(d.documentElement.scrollHeight, 40), 20000)}px`;
  };
  ramka.addEventListener('load', () => {
    dopasuj();
    if (ramka.contentDocument?.body) new ResizeObserver(dopasuj).observe(ramka.contentDocument.body);
  });
  box.append(ramka);
}

// ---------- Pisanie ----------

const pisz = {
  id: null, watek: null, odpowiedzNa: null, tryb: 'nowa', adresy: { do: [], dw: [], udw: [] }, zalaczniki: [], wlasne: new Set(),
  timer: null, zapis: Promise.resolve(), wysylanie: false, poprzedni: 'lista', edytor: null, gotowy: null, zmiany: false,
};

// TinyMCE z jsDelivr (wersja na sztywno, licencja GPL – bez klucza API), po polsku, motyw jak aplikacja.
async function edytor() {
  if (pisz.edytor) return pisz.edytor;
  if (!pisz.gotowy) {
    pisz.gotowy = (async () => {
      const tinymce = await biblioteka(TINYMCE, 'tinymce', 'edytora wiadomości');
      const ciemny = document.documentElement.dataset.motyw === 'ciemny';
      const [ed] = await tinymce.init({
        target: $('#admin-pisz-tresc'),
        license_key: 'gpl',
        language: 'pl',
        language_url: TINYMCE_PL,
        skin: ciemny ? 'oxide-dark' : 'oxide',
        content_css: ciemny ? 'dark' : 'default',
        content_style: 'body{font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.55;margin:12px}blockquote{margin:6px 0 6px 4px;padding-left:10px;border-left:3px solid #d9d6cd;color:#807d75}',
        menubar: false,
        branding: false,
        promotion: false,
        statusbar: false,
        resize: false,
        height: '100%',
        min_height: 220,
        plugins: 'lists link autolink table code',
        toolbar: 'undo redo | blocks | bold italic underline strikethrough | forecolor | bullist numlist | link table | removeformat code',
        toolbar_mode: 'sliding',
        link_default_target: '_blank',
        convert_urls: false,
        setup: (e) => {
          e.on('input change undo redo keyup', () => zmieniono());
          // Ctrl+Enter w treści – wyślij.
          e.on('keydown', (z) => { if ((z.ctrlKey || z.metaKey) && z.key === 'Enter') { z.preventDefault(); $('#admin-form-pisz').requestSubmit(); } });
        },
      });
      pisz.edytor = ed;
      return ed;
    })().catch((e) => { pisz.gotowy = null; throw e; });
  }
  return pisz.gotowy;
}

// Zmiana motywu przy otwartym edytorze – nowy edytor z tą samą treścią.
new MutationObserver(async () => {
  if (!pisz.edytor) return;
  const tresc = pisz.edytor.getContent();
  pisz.edytor.remove();
  pisz.edytor = null;
  pisz.gotowy = null;
  if ($('#admin-pisz').hidden) return;
  (await edytor()).setContent(tresc);
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motyw'] });

const podpisHtml = () => (s.podpis ? `<p class="podpis">--<br>${esc(s.podpis).replace(/\n/g, '<br>')}</p>` : '');

// Cytat poprzedniej wiadomości: odpowiedź – „W dniu … napisał(a):” i blockquote; przekazanie – nagłówki i treść.
function cytat(m, tryb) {
  const tresc = m.html ? bezpiecznyHtml(m.html).body : `<p>${esc(m.tekst || '').replace(/\n/g, '<br>')}</p>`;
  const od = m.kierunek === 'wychodzaca' ? `${m.od_nazwa || 'Makietka'} &lt;${esc(m.od_email || s.skrzynka)}&gt;` : `${esc(m.od_nazwa || '')} &lt;${esc(m.od_email)}&gt;`.trim();
  if (tryb === 'przekaz') {
    return `<p>---------- Przekazana wiadomość ----------<br>Od: ${od}<br>Data: ${esc(data(m.utworzono))}<br>Temat: ${esc(m.temat || '')}<br>Do: ${esc((m.do_lista || [m.do_email]).filter(Boolean).join(', '))}${(m.dw || []).length ? `<br>DW: ${esc(m.dw.join(', '))}` : ''}</p>${tresc}`;
  }
  return `<p>W dniu ${esc(data(m.utworzono))} ${od} napisał(a):</p><blockquote>${tresc}</blockquote>`;
}

export async function otworzPisanie({ tryb = 'nowa', wiadomosc = null, robocza = null } = {}) {
  if (!$('#admin-pisz').hidden) await zamknijPisanie({ cicho: true });
  pisz.poprzedni = $('#admin-skrzynka').dataset.widok === 'watek' ? 'watek' : 'lista';
  Object.assign(pisz, { id: null, watek: null, odpowiedzNa: null, tryb, adresy: { do: [], dw: [], udw: [] }, zalaczniki: [], wlasne: new Set(), zmiany: false, wysylanie: false });
  let tematWiadomosci = '';
  let html = `<p><br></p>${podpisHtml()}`;
  if (robocza) {
    Object.assign(pisz, {
      id: robocza.id, watek: robocza.watek, odpowiedzNa: robocza.odpowiedz_na, tryb: robocza.tryb,
      adresy: { do: [...robocza.do_lista], dw: [...robocza.dw], udw: [...robocza.udw] }, zalaczniki: [...(robocza.zalaczniki || [])],
    });
    tematWiadomosci = robocza.temat;
    html = robocza.html;
  } else if (wiadomosc) {
    const t = s.dane?.watek;
    pisz.watek = t?.id || null;
    pisz.odpowiedzNa = wiadomosc.id;
    if (tryb === 'przekaz') {
      tematWiadomosci = temat('Fwd', wiadomosc.temat || t?.temat);
      pisz.zalaczniki = (wiadomosc.zalaczniki || []).filter((z) => z.klucz);
    } else {
      tematWiadomosci = temat('Re', wiadomosc.temat || t?.temat);
      const wych = wiadomosc.kierunek === 'wychodzaca';
      const nadawca = wych ? (wiadomosc.do_lista || [])[0] : wiadomosc.od_email;
      pisz.adresy.do = [nadawca].filter(Boolean);
      if (tryb === 'wszystkim') {
        const inni = (wiadomosc.do_lista || []).filter((a) => !naszAdres(a) && a !== nadawca);
        pisz.adresy.do.push(...inni);
        pisz.adresy.dw = (wiadomosc.dw || []).filter((a) => !naszAdres(a) && !pisz.adresy.do.includes(a));
      }
    }
    html = `<p><br></p>${podpisHtml()}<p><br></p>${cytat(wiadomosc, tryb)}`;
  }
  $('#admin-pisz-tytul').textContent = { nowa: 'Nowa wiadomość', odpowiedz: 'Odpowiedź', wszystkim: 'Odpowiedź do wszystkich', przekaz: 'Przekazanie' }[pisz.tryb];
  $('#admin-pisz-temat').value = tematWiadomosci;
  $('#admin-pisz-stan').textContent = robocza ? `Wersja robocza z ${kiedy(robocza.zmieniono)}` : '';
  for (const p of ['dw', 'udw']) $(`.pole-adresow[data-pole="${p}"]`).hidden = !pisz.adresy[p].length;
  $('#admin-pisz-kopie').hidden = Boolean(pisz.adresy.dw.length && pisz.adresy.udw.length);
  for (const p of ['do', 'dw', 'udw']) rysujAdresy(p);
  rysujZalaczniki();
  ustawWidok('pisz');
  const ed = await edytor().catch((e) => { blad(e); return null; });
  if (!ed) return;
  ed.setContent(html);
  pisz.zmiany = false;
  if (!pisz.adresy.do.length) $('#admin-pisz-do').focus();
  else ed.focus();
}

async function otworzRobocza(id) {
  try { await otworzPisanie({ robocza: await rpc('admin_poczta_robocza', { p_id: id }) }); } catch (e) { blad(e); }
}

function zmieniono() {
  if (pisz.wysylanie || $('#admin-pisz').hidden) return;
  pisz.zmiany = true;
  clearTimeout(pisz.timer);
  pisz.timer = setTimeout(() => { zapiszRobocza().catch(() => {}); }, 1500);
}

function dane() {
  zatwierdzWpisane();
  return {
    tryb: pisz.tryb, watek: pisz.watek, odpowiedz_na: pisz.odpowiedzNa,
    do: pisz.adresy.do, dw: pisz.adresy.dw, udw: pisz.adresy.udw,
    temat: $('#admin-pisz-temat').value.trim(),
    html: pisz.edytor?.getContent() || '',
    tekst: pisz.edytor?.getContent({ format: 'text' }) || '',
    zalaczniki: pisz.zalaczniki.filter((z) => z.klucz).map(({ nazwa, typ, rozmiar: r, klucz }) => ({ nazwa, typ, rozmiar: r, klucz })),
  };
}
// Czy w wiadomości jest coś poza podpisem i cytatem (wtedy zamknięcie zostawia kopię roboczą).
function cokolwiek(d) {
  return Boolean(d.do.length || d.dw.length || d.udw.length || d.zalaczniki.length || pisz.zmiany || (d.temat && pisz.tryb === 'nowa'));
}

function zapiszRobocza() {
  clearTimeout(pisz.timer);
  pisz.zapis = pisz.zapis.then(async () => {
    if (pisz.wysylanie || $('#admin-pisz').hidden) return;
    const d = dane();
    if (!cokolwiek(d)) return;
    $('#admin-pisz-stan').textContent = 'Zapisywanie…';
    try {
      const w = await rpc('admin_poczta_robocza_zapisz', { p: { ...d, id: pisz.id } });
      pisz.id = w.id;
      await usunPliki((w.klucze || []).filter((k) => !pisz.zalaczniki.some((z) => z.klucz === k)));
      $('#admin-pisz-stan').textContent = `Zapisano ${new Date(w.zmieniono).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
      if (s.folder === 'robocze') rysujSkrzynke().catch(() => {});
    } catch (e) {
      $('#admin-pisz-stan').textContent = `Nie zapisano: ${komunikatBledu(e)}`;
    }
  });
  return pisz.zapis;
}

async function zamknijPisanie({ cicho = false } = {}) {
  clearTimeout(pisz.timer);
  const d = dane();
  if (!pisz.wysylanie && cokolwiek(d)) {
    pisz.zmiany = true;
    await zapiszRobocza();
    if (!cicho && pisz.id) powiadom('Wiadomość została w folderze Robocze.');
  }
  pisz.wysylanie = true;
  pisz.edytor?.setContent('');
  ukryjPodpowiedzi();
  $('#admin-pisz').hidden = true;
  $('#admin-watek').hidden = false;
  ustawWidok(pisz.poprzedni === 'watek' && s.otwarty ? 'watek' : 'lista');
}

async function odrzuc() {
  clearTimeout(pisz.timer);
  await pisz.zapis;
  const id = pisz.id;
  const wlasne = [...pisz.wlasne];
  pisz.wysylanie = true;
  try {
    if (id) await usunRobocza(id);
    else await usunPliki(wlasne);
    powiadom('Odrzucono wersję roboczą.');
  } catch (e) { blad(e); }
  pisz.id = null;
  await zamknijPisanie({ cicho: true });
  if (s.folder === 'robocze' || s.otwarty) {
    await rysujSkrzynke().catch(blad);
    if (s.otwarty) await otworzWatek(s.otwarty, { cicho: true });
  }
}

async function usunRobocza(id) {
  const w = await rpc('admin_poczta_robocza_usun', { p_id: id });
  await usunPliki(w?.klucze);
}

async function wyslij(e) {
  e.preventDefault();
  if (pisz.wysylanie) return;
  const d = dane();
  const zle = [...d.do, ...d.dw, ...d.udw].filter((a) => !POPRAWNY.test(a));
  if (zle.length) { powiadom(`Popraw adres: ${zle.join(', ')}`, true); return; }
  if (!d.do.length) { powiadom('Podaj adresata w polu „Do”.', true); $('#admin-pisz-do').focus(); return; }
  if (pisz.zalaczniki.some((z) => !z.klucz)) { powiadom('Poczekaj, aż załączniki się wyślą.', true); return; }
  if (!d.temat && !await potwierdz('Wysłać bez tematu?', 'Wiadomość nie ma tematu.', 'Wyślij')) return;
  const przycisk = $('#admin-form-pisz [type="submit"]');
  przycisk.disabled = true;
  clearTimeout(pisz.timer);
  pisz.wysylanie = true;
  await pisz.zapis;
  try {
    const w = await rpc('admin_poczta_wyslij', { p: { ...d, robocza: pisz.id } });
    pisz.id = null;
    const p = await przebiegKolejki();
    powiadom(p?.wyslane ? 'Wiadomość wysłana.' : 'Wiadomość czeka w kolejce i wyjdzie za chwilę.');
    await zamknijPisanie({ cicho: true });
    await rysujSkrzynke();
    await otworzWatek(w.watek);
  } catch (err) {
    pisz.wysylanie = false;
    blad(err);
  } finally { przycisk.disabled = false; }
}

// ---------- Pola adresów (Do/DW/UDW) z podpowiedziami ----------

let podpowiedzi = { pole: null, lista: [], wybrana: -1, timer: null };

function rysujAdresy(pole) {
  const box = $(`[data-adresy="${pole}"]`);
  const input = box.querySelector('input');
  box.querySelectorAll('.adres').forEach((x) => x.remove());
  input.placeholder = pole === 'do' && !pisz.adresy.do.length ? 'adres@przyklad.pl' : '';
  for (const [i, a] of pisz.adresy[pole].entries()) {
    const chip = document.createElement('span');
    chip.className = `adres ${POPRAWNY.test(a) ? '' : 'zly'}`;
    chip.title = POPRAWNY.test(a) ? a : `Nieprawidłowy adres: ${a}`;
    chip.innerHTML = `<span>${esc(a)}</span><button type="button" aria-label="Usuń ${esc(a)}" data-ikona="zamknij" data-rozmiar="14"></button>`;
    chip.querySelector('button').addEventListener('click', () => { pisz.adresy[pole].splice(i, 1); rysujAdresy(pole); zmieniono(); input.focus(); });
    box.insertBefore(chip, input);
  }
  wstawIkony(box);
}

function dodajAdresy(pole, tekst) {
  const nowe = String(tekst || '').split(/[,;\s]+/).map((a) => a.replace(/^.*</, '').replace(/>.*$/, '').trim().toLowerCase()).filter(Boolean);
  let dodano = false;
  for (const a of nowe) if (!pisz.adresy[pole].includes(a)) { pisz.adresy[pole].push(a); dodano = true; }
  if (dodano) { rysujAdresy(pole); zmieniono(); }
}

function zatwierdzWpisane() {
  for (const pole of ['do', 'dw', 'udw']) {
    const input = $(`#admin-pisz-${pole}`);
    if (input.value.trim()) { dodajAdresy(pole, input.value); input.value = ''; }
  }
}

function ukryjPodpowiedzi() {
  podpowiedzi = { ...podpowiedzi, pole: null, lista: [], wybrana: -1 };
  $('#admin-podpowiedzi').hidden = true;
}

function rysujPodpowiedzi() {
  const ul = $('#admin-podpowiedzi');
  const input = $(`#admin-pisz-${podpowiedzi.pole}`);
  if (!podpowiedzi.lista.length || !input) { ul.hidden = true; return; }
  ul.innerHTML = podpowiedzi.lista.map((p, i) => `<li role="option" aria-selected="${i === podpowiedzi.wybrana}" data-i="${i}">
    <strong>${esc(p.nazwa || p.email)}</strong>${p.nazwa ? `<span class="ciche">${esc(p.email)}</span>` : ''}</li>`).join('');
  const r = input.closest('.pole-adresow').getBoundingClientRect();
  const rodzic = $('#admin-pisz').getBoundingClientRect();
  ul.style.top = `${r.bottom - rodzic.top}px`;
  ul.style.left = `${Math.max(8, r.left - rodzic.left + 48)}px`;
  ul.hidden = false;
  for (const li of ul.querySelectorAll('li')) {
    li.addEventListener('mousedown', (e) => { e.preventDefault(); wybierzPodpowiedz(Number(li.dataset.i)); });
  }
}

function wybierzPodpowiedz(i) {
  const p = podpowiedzi.lista[i];
  const pole = podpowiedzi.pole;
  if (!p || !pole) return;
  $(`#admin-pisz-${pole}`).value = '';
  dodajAdresy(pole, p.email);
  ukryjPodpowiedzi();
  $(`#admin-pisz-${pole}`).focus();
}

for (const pole of ['do', 'dw', 'udw']) {
  const input = $(`#admin-pisz-${pole}`);
  input.addEventListener('keydown', (e) => {
    const otwarte = podpowiedzi.pole === pole && podpowiedzi.lista.length;
    if (otwarte && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      podpowiedzi.wybrana = (podpowiedzi.wybrana + (e.key === 'ArrowDown' ? 1 : -1) + podpowiedzi.lista.length) % podpowiedzi.lista.length;
      rysujPodpowiedzi();
      return;
    }
    if (otwarte && e.key === 'Enter' && podpowiedzi.wybrana >= 0) { e.preventDefault(); wybierzPodpowiedz(podpowiedzi.wybrana); return; }
    if (e.key === 'Escape' && otwarte) { e.preventDefault(); e.stopPropagation(); ukryjPodpowiedzi(); return; }
    if (['Enter', ',', ';', 'Tab'].includes(e.key) && input.value.trim()) {
      if (e.key !== 'Tab') e.preventDefault();
      dodajAdresy(pole, input.value);
      input.value = '';
      ukryjPodpowiedzi();
    } else if (e.key === 'Backspace' && !input.value && pisz.adresy[pole].length) {
      pisz.adresy[pole].pop();
      rysujAdresy(pole);
      zmieniono();
    }
  });
  input.addEventListener('input', () => {
    if (/[,;]/.test(input.value)) { dodajAdresy(pole, input.value); input.value = ''; ukryjPodpowiedzi(); return; }
    clearTimeout(podpowiedzi.timer);
    const tekst = input.value.trim();
    if (!tekst) { ukryjPodpowiedzi(); return; }
    podpowiedzi.timer = setTimeout(async () => {
      try {
        const lista = (await rpc('admin_poczta_adresy', { p_szukaj: tekst })).filter((p) => !pisz.adresy[pole].includes(p.email));
        if (input.value.trim() !== tekst) return;
        podpowiedzi = { ...podpowiedzi, pole, lista, wybrana: lista.length ? 0 : -1 };
        rysujPodpowiedzi();
      } catch { ukryjPodpowiedzi(); }
    }, 200);
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement === input) return;
      if (input.value.trim()) { dodajAdresy(pole, input.value); input.value = ''; }
      if (podpowiedzi.pole === pole) ukryjPodpowiedzi();
    }, 120);
  });
  input.closest('.adresy').addEventListener('click', (e) => { if (e.target === e.currentTarget) input.focus(); });
}

// ---------- Załączniki ----------

function rysujZalaczniki() {
  const ul = $('#admin-pisz-zalaczniki');
  ul.replaceChildren(...pisz.zalaczniki.map((z, i) => {
    const li = document.createElement('li');
    li.className = `zalacznik ${z.klucz ? '' : 'wysylanie'}`;
    li.innerHTML = `<span data-ikona="spinacz" data-rozmiar="16"></span><span class="nazwa">${esc(z.nazwa)}</span><span class="ciche">${z.klucz ? esc(rozmiar(z.rozmiar)) : 'wysyłanie…'}</span>
      <button type="button" class="przycisk-ikona maly" data-ikona="zamknij" data-rozmiar="14" title="Usuń załącznik" aria-label="Usuń załącznik ${esc(z.nazwa)}"></button>`;
    li.querySelector('button').addEventListener('click', () => {
      pisz.zalaczniki.splice(i, 1);
      if (z.klucz && pisz.wlasne.has(z.klucz) && !pisz.id) { pisz.wlasne.delete(z.klucz); usunPliki([z.klucz]); }
      rysujZalaczniki();
      zmieniono();
    });
    return li;
  }));
  ul.hidden = !pisz.zalaczniki.length;
  wstawIkony(ul);
}

async function dodajPliki(pliki) {
  for (const plik of pliki) {
    const razem = pisz.zalaczniki.reduce((n, z) => n + (z.rozmiar || 0), 0);
    if (razem + plik.size > LIMIT_ZALACZNIKOW) {
      powiadom(`„${plik.name}” się nie zmieści – załączniki razem mogą mieć najwyżej 10 MB.`, true);
      continue;
    }
    const z = { nazwa: plik.name, typ: plik.type || 'application/octet-stream', rozmiar: plik.size, klucz: null };
    pisz.zalaczniki.push(z);
    rysujZalaczniki();
    try {
      const w = await r2.wyslijZalacznikPoczty(plik);
      z.klucz = w.klucz;
      z.rozmiar = w.rozmiar;
      pisz.wlasne.add(w.klucz);
    } catch (e) {
      pisz.zalaczniki.splice(pisz.zalaczniki.indexOf(z), 1);
      blad(e);
    }
    rysujZalaczniki();
    zmieniono();
  }
}

// ---------- Na żywo ----------

// Zmiany w tabeli rozmów (nowa poczta, wynik wysyłki, inne okno panelu) – lista, licznik i otwarta rozmowa.
let timerNaZywo = null;
let sledzenie = null;
export function sledzSkrzynke() {
  // Jeden kanał na sesję – kilka wywołań naraz (logowanie, trasa) czeka na to samo.
  if (!sledzenie) sledzenie = podlaczKanal().catch((e) => { sledzenie = null; throw e; });
  return sledzenie;
}

async function podlaczKanal() {
  const sb = await supabase();
  const { data: sesja } = await sb.auth.getSession();
  if (sesja.session?.access_token) await sb.realtime.setAuth(sesja.session.access_token);
  s.kanal = sb.channel('skrzynka-administratora')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poczta_watki' }, (z) => {
      clearTimeout(timerNaZywo);
      const id = z?.new?.id || z?.old?.id;
      timerNaZywo = setTimeout(() => naZywo(id).catch(() => {}), 300);
    })
    .subscribe();
  // Pierwszy stan licznika (menu konta).
  const w = await rpc('admin_poczta_watki', { p_folder: 'skrzynka', p_limit: 1, p_od: 0 });
  ustawLicznik(w.liczniki?.skrzynka || 0);
}

export async function przestanSledzic() {
  await sledzenie?.catch(() => {});
  sledzenie = null;
  if (!s.kanal) return;
  const kanal = s.kanal;
  s.kanal = null;
  await (await supabase()).removeChannel(kanal);
}

async function naZywo(id) {
  if (document.body.dataset.ekran === 'admin' && !$('[data-panel-admin="skrzynka"]').hidden) {
    await rysujSkrzynke();
    if (id && id === s.otwarty) await otworzWatek(id, { cicho: true });
  } else {
    const w = await rpc('admin_poczta_watki', { p_folder: 'skrzynka', p_limit: 1, p_od: 0 });
    ustawLicznik(w.liczniki?.skrzynka || 0);
  }
}

// ---------- Zdarzenia ----------

for (const b of $$('#admin-foldery [data-folder]')) {
  b.addEventListener('click', () => {
    s.folder = b.dataset.folder;
    s.od = 0;
    s.zaznaczone.clear();
    zamknijWatek();
    rysujSkrzynke().catch(blad);
  });
}
$('#admin-napisz').addEventListener('click', () => otworzPisanie({ tryb: 'nowa' }));
$('#admin-zaznacz-wszystkie').addEventListener('change', (e) => {
  if (e.target.checked) for (const t of s.watki) s.zaznaczone.add(t.id);
  else s.zaznaczone.clear();
  for (const li of $$('#admin-watki li')) {
    const tak = s.zaznaczone.has(li.dataset.id);
    li.classList.toggle('zaznaczony', tak);
    li.querySelector('.wybor input').checked = tak;
  }
  rysujZbiorcze();
});
for (const b of $$('#admin-zbiorcze [data-zbiorczo]')) b.addEventListener('click', () => zbiorczo(b.dataset.zbiorczo));
$('#admin-poprzednie').addEventListener('click', () => { s.od = Math.max(0, s.od - NA_STRONE); rysujSkrzynke().catch(blad); });
$('#admin-nastepne').addEventListener('click', () => { s.od += NA_STRONE; rysujSkrzynke().catch(blad); });
$('#admin-oproznij').addEventListener('click', async () => {
  const co = s.folder === 'spam' ? 'spam' : 'kosz';
  if (!await potwierdz(co === 'spam' ? 'Opróżnić spam?' : 'Opróżnić kosz?', `Wszystkie wiadomości z folderu ${FOLDERY[co]} znikną na zawsze.`, 'Opróżnij', true)) return;
  try {
    const w = await rpc('admin_poczta_oproznij', { p_folder: co });
    await usunPliki(w?.klucze);
    powiadom(`Usunięto ${w.zmienione} ${odmiana(w.zmienione, 'rozmowę', 'rozmowy', 'rozmów')}.`);
    zamknijWatek();
    await rysujSkrzynke();
  } catch (e) { blad(e); }
});
let timerSzukania = null;
$('#admin-szukaj').addEventListener('input', (e) => {
  clearTimeout(timerSzukania);
  timerSzukania = setTimeout(() => { s.szukaj = e.target.value.trim(); s.od = 0; s.zaznaczone.clear(); rysujSkrzynke().catch(blad); }, 300);
});
$('#admin-form-pisz').addEventListener('submit', wyslij);
$('#admin-pisz-temat').addEventListener('input', zmieniono);
for (const b of $$('#admin-form-pisz [data-pisz="zamknij"]')) b.addEventListener('click', () => zamknijPisanie());
$('#admin-form-pisz [data-pisz="odrzuc"]').addEventListener('click', odrzuc);
$('#admin-pisz-kopie').addEventListener('click', () => {
  for (const p of ['dw', 'udw']) $(`.pole-adresow[data-pole="${p}"]`).hidden = false;
  $('#admin-pisz-kopie').hidden = true;
  $('#admin-pisz-dw').focus();
});
$('#admin-pisz-pliki').addEventListener('change', (e) => { const pliki = [...e.target.files]; e.target.value = ''; dodajPliki(pliki); });
// Skróty: Ctrl+Enter – wyślij; Esc – zamknij pisanie (zostaje w Robocze).
$('#admin-pisz').addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('#admin-form-pisz').requestSubmit(); }
});
