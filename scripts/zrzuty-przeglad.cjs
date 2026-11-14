// Przegląd wyglądu: zrzuty wszystkich ekranów i okien na kilku urządzeniach, w obu motywach.
//
// Użycie:
//   python3 -m http.server 8792          # w katalogu repozytorium
//   node scripts/zrzuty-przeglad.cjs [http://localhost:8792/] [katalog] [urządzenia,po,przecinku]
//
// Zrzuty trafiają do zrzuty-robocze/przeglad/<urządzenie>/<motyw>/<widok>.png (folder poza repozytorium,
// w .gitignore), a arkusze zbiorcze – do zrzuty-robocze/przeglad/arkusze/. Baza to atrapa z testów
// (tests/pomoc.cjs), dane – przykładowe projekty z instrukcji (scripts/zrzuty-instrukcji.cjs) uzupełnione
// o tabelę danych, serię, obrazy i tabelę na stronie.

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium, devices } = require('playwright');
const { podlaczAtrape, zaloguj } = require('../tests/pomoc.cjs');
const { przykladoweProjekty } = require('./zrzuty-instrukcji.cjs');

const ADRES = process.argv[2] || 'http://localhost:8792/';
const KATALOG = path.resolve(process.argv[3] || path.join(__dirname, '..', 'zrzuty-robocze', 'przeglad'));
const TYLKO = process.argv[4] ? process.argv[4].split(',') : null;

const dotyk = { isMobile: true, hasTouch: true };
const URZADZENIA = [
  { nazwa: 'telefon-360', opcje: { viewport: { width: 360, height: 760 }, ...dotyk, userAgent: devices['Pixel 7'].userAgent } },
  { nazwa: 'pixel-7', opcje: { ...devices['Pixel 7'] } },
  { nazwa: 'tablet-pion', opcje: { ...devices['iPad Mini'] } },
  { nazwa: 'tablet-poziom', opcje: { viewport: { width: 1180, height: 820 }, ...dotyk, userAgent: devices['iPad Mini'].userAgent } },
  { nazwa: 'komputer-1280', opcje: { viewport: { width: 1280, height: 800 } } },
  { nazwa: 'komputer-1920', opcje: { viewport: { width: 1920, height: 1080 } } },
].filter((u) => !TYLKO || TYLKO.includes(u.nazwa));

const czekaj = (s, ms) => s.waitForTimeout(ms);

// Audyt układu (wykonywany w stronie przy każdym zrzucie). Sprawdza w otwartym oknie, a bez okna – na stronie:
//  - poziome przewijanie dokumentu (zakazane wszędzie),
//  - przyciski i pola wystające poza ekran albo poza swoje okno,
//  - przyciski i pola obcięte przez przodka z overflow hidden/clip (bez przewijania),
//  - cele dotyku mniejsze niż 40 px (tylko na urządzeniach dotykowych; liczba i przykłady).
function audytUkladu({ dotyk: naDotyku }) {
  const wynik = [];
  const W = innerWidth;
  const H = innerHeight;
  const opis = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const k = [...el.classList].slice(0, 2);
    if (k.length) s += `.${k.join('.')}`;
    const t = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return t ? `${s} „${t}”` : s;
  };
  const widoczny = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let e = el; e; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
    }
    return true;
  };
  const doc = document.scrollingElement;
  if (doc.scrollWidth > W + 1) wynik.push({ rodzaj: 'poziome-przewijanie', el: 'dokument', szczegol: `${doc.scrollWidth} > ${W}` });
  const okno = [...document.querySelectorAll('dialog[open]')].pop() || document.querySelector('.prezentacja');
  const korzen = okno || document.body;
  const ro = okno ? okno.getBoundingClientRect() : null;
  const sterowanie = [...korzen.querySelectorAll('button, input:not([type=hidden]), select, textarea, a[href], [role=button], label.przelacznik, .wybor-przycisk')]
    .filter((el) => !el.closest('.wybor-natywny, .kolor-natywny') && widoczny(el));
  const male = [];
  // Element w przewijanym obszarze (lista, panel, treść okna) da się przewinąć do widoku – to nie usterka.
  const wPrzewijanym = (el) => {
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const st = getComputedStyle(e);
      if ((/(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 1) || (/(auto|scroll)/.test(st.overflowX) && e.scrollWidth > e.clientWidth + 1)) return true;
    }
    return false;
  };
  for (const el of sterowanie) {
    const r = el.getBoundingClientRect();
    if (wPrzewijanym(el)) { if (naDotyku && (r.height < 39.5 || r.width < 32) && !el.matches('input[type=checkbox], input[type=radio], a')) male.push(`${opis(el)} ${Math.round(r.width)}×${Math.round(r.height)}`); continue; }
    if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1) wynik.push({ rodzaj: 'poza-ekranem', el: opis(el), szczegol: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}` });
    else if (ro && (r.right > ro.right + 1 || r.left < ro.left - 1 || r.bottom > ro.bottom + 1 || r.top < ro.top - 1)) wynik.push({ rodzaj: 'poza-oknem', el: opis(el), szczegol: '' });
    // Obcięcie przez przodka bez przewijania.
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (!/(hidden|clip)/.test(st.overflowX + st.overflowY) || /(auto|scroll)/.test(st.overflowX + st.overflowY)) continue;
      const rp = e.getBoundingClientRect();
      if (r.right > rp.right + 2 || r.left < rp.left - 2 || r.bottom > rp.bottom + 2 || r.top < rp.top - 2) {
        // Element w przewijanym obszarze wewnątrz obcinającego przodka jest w porządku tylko wtedy, gdy da się go przewinąć.
        let przewijany = false;
        for (let x = el.parentElement; x && x !== e; x = x.parentElement) { const sx = getComputedStyle(x); if (/(auto|scroll)/.test(sx.overflowX + sx.overflowY)) { przewijany = true; break; } }
        if (!przewijany) wynik.push({ rodzaj: 'obciety', el: opis(el), szczegol: `przez ${opis(e).split(' ')[0]}` });
      }
      break;
    }
    if (naDotyku && (r.height < 39.5 || r.width < 32) && !el.matches('input[type=checkbox], input[type=radio], a')) male.push(`${opis(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  if (male.length) wynik.push({ rodzaj: 'maly-cel-dotyku', el: `${male.length} elementów`, szczegol: male.slice(0, 12).join('; ') });
  return wynik;
}

// Przycisk akcji: widoczny na pasku albo – na wąskim ekranie – w menu ⋯.
async function akcja(s, nazwa) {
  const widoczny = s.locator(`[data-akcja="${nazwa}"]:visible`).first();
  if (await widoczny.count()) { await widoczny.click(); return; }
  await s.click('#przycisk-wiecej');
  await s.locator(`#menu-wiecej [data-akcja="${nazwa}"]`).click();
}

const telefon = (s) => s.evaluate(() => matchMedia('(max-width: 860px)').matches);
async function panel(s, ktory) {
  if (!await telefon(s)) return;
  const jest = await s.evaluate(() => document.body.dataset.panel);
  if (jest !== ktory) await s.locator(`.zakladki-mobilne [data-panel="${ktory}"]`).click();
  await czekaj(s, 350);
}

// Stan wyjściowy przed każdym widokiem: edytor projektu „Kalendarz 2027”, bez okien, menu i paneli.
async function doEdytora(s, nazwaStrony = 'Styczeń') {
  await s.keyboard.press('Escape').catch(() => {});
  await s.evaluate(async (nazwa) => {
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    document.querySelectorAll('.prezentacja').forEach((p) => p.remove());
    const { stan } = window.seriodruk;
    document.querySelectorAll('.menu').forEach((m) => { m.hidden = true; });
    if (document.body.dataset.ekran !== 'edytor') {
      location.hash = `#/p/${window.idKalendarza}`;
      for (let n = 0; n < 50 && !(stan.projekt && document.body.dataset.ekran === 'edytor'); n += 1) await new Promise((ok) => { setTimeout(ok, 100); });
    }
    const i = stan.projekt.strony.findIndex((x) => x.nazwa === nazwa);
    if (i >= 0 && i !== stan.indeks) await window.seriodruk.przejdzDoStrony(i);
    window.seriodruk.edytor.odznacz?.();
    document.body.dataset.panel = '';
  }, nazwaStrony);
  await s.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  await czekaj(s, 300);
}

const zaznacz = (s, warunek) => s.evaluate((w) => {
  const e = window.seriodruk.edytor;
  const o = e.canvas.getObjects().find(new Function('o', `return ${w}`));
  if (o) e.zaznacz(o.id);
  return Boolean(o);
}, warunek);

// Uzupełnienie przykładowego kalendarza: tabela danych, seria na stronie „Luty”, obrazy i tabela na stronie.
async function uzupelnij(s) {
  await s.evaluate(async () => {
    const { stan, edytor: e } = window.seriodruk;
    const p = stan.projekt;
    p.tabele.push({ id: 't_dni', nazwa: 'Dni lutego', kolumny: ['dzien', 'dzien_tygodnia', 'imieniny', 'zdjecie'], wiersze: [
      ['1', 'poniedziałek', 'Brygidy, Ignacego', 'gory-zima.jpg'], ['2', 'wtorek', 'Marii, Mirosława', 'laka-wiosna.jpg'],
      ['3', 'środa', 'Błażeja, Oskara', 'morze.jpg'], ['4', 'czwartek', 'Andrzeja, Weroniki', 'gory-zima.jpg'],
    ] });
    p.serie.push({ id: 'se_dni', nazwa: 'Dni', tabela: 't_dni', tryb: 'tabela', uklad: 'szeroki', ile: 12, dodatkowe: [], dopelnij: false, pilnuj_stron: true });
    const obraz = (nazwa, a, b) => new Promise((ok) => {
      const c = document.createElement('canvas');
      c.width = 1200; c.height = 800;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 1200, 800);
      g.addColorStop(0, a); g.addColorStop(1, b);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1200, 800);
      c.toBlob((blob) => ok(new File([blob], nazwa, { type: 'image/jpeg' })), 'image/jpeg', 0.85);
    });
    const { wgrajObrazy } = await import('./js/app/obrazy-okno.js');
    await wgrajObrazy([await obraz('gory-zima.jpg', '#1e3a8a', '#93c5fd'), await obraz('laka-wiosna.jpg', '#166534', '#fde68a'), await obraz('morze.jpg', '#0e7490', '#f0abfc')]);
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    const i = p.strony.findIndex((x) => x.nazwa === 'Luty');
    p.strony[i].seria = 'se_dni';
    await window.seriodruk.przejdzDoStrony(i);
    const id = Object.keys(p.zasoby).find((k) => p.zasoby[k].nazwa === 'gory-zima.jpg');
    const img = await e.dodajObraz(null, 'gory-zima.jpg', p.zasoby, { id });
    img.set({ left: 16, top: 16, scaleX: 0.1, scaleY: 0.1 }); img.setCoords();
    const t = e.dodajTekst('{dzien} {dzien_tygodnia}'); t.set({ left: 16, top: 104, width: 120 });
    const tab = e.dodajTabele({ wiersze: 4, kolumny: 3 });
    tab.set({ top: 130 }); tab.setCoords();
    e.canvas.discardActiveObject();
    e.zatwierdz();
    await window.seriodruk.zapiszTeraz();
  });
}

// Projekt innej osoby (Oli) z zaproszeniem dla zalogowanego konta – w atrapie bazy, jak po zaproszeniu.
function zaproszenieOdOli(baza, kod) {
  const ola = { id: '44444444-4444-4444-8444-444444444444', email: 'ola.nowak@przyklad.pl', haslo: 'Dobre#Haslo9', potwierdzone: true, nazwa: 'Ola Nowak' };
  if (!baza.konta.some((k) => k.id === ola.id)) baza.konta.push(ola);
  const id = '55555555-5555-4555-8555-555555555555';
  if (!baza.projekty.some((p) => p.id === id)) {
    baza.projekty.push({ id, owner_id: ola.id, nazwa: 'Kalendarz szkolny 2027', wersja: 1, zmieniono: new Date().toISOString(), dane: { strony: [], strony_osobno: true, miniatura: null } });
  }
  if (baza.zaproszenia.some((z) => z.kod === kod)) return;
  baza.zaproszenia.push({
    id: `z-${kod}`, projekt_id: id, email: baza.konta[0].email.toLowerCase(), rola: 'edycja', kod, zaprosil: ola.id,
    utworzono: new Date().toISOString(), wazne_do: new Date(Date.now() + 14 * 86400000).toISOString(), stan: 'czeka', przyjal: null,
  });
}

// Widoki: [nazwa, przygotowanie] – po przygotowaniu robimy zrzut, potem wracamy do edytora.
const WIDOKI = [
  ['03-edytor', async (s) => { await doEdytora(s); }],
  ['04-edytor-tekst', async (s) => { await doEdytora(s); await zaznacz(s, "o.text === 'Styczeń'"); await panel(s, 'inspektor'); }],
  ['05-lista-rozwijana', async (s) => {
    await doEdytora(s); await zaznacz(s, "o.text === 'Styczeń'"); await panel(s, 'inspektor');
    const b = s.locator('#wlasciwosci .wybor-przycisk:visible').first();
    await b.scrollIntoViewIfNeeded(); await b.click();
  }],
  ['06-edytor-obraz', async (s) => { await doEdytora(s, 'Luty'); await zaznacz(s, "o.type === 'image'"); await panel(s, 'inspektor'); }],
  ['07-edytor-tabela', async (s) => { await doEdytora(s, 'Luty'); await zaznacz(s, "o.tabela"); await panel(s, 'inspektor'); }],
  ['08-panel-strony', async (s) => { await doEdytora(s); await panel(s, 'strony'); }],
  ['09-warstwy', async (s) => { await doEdytora(s); await panel(s, 'inspektor'); await s.click('#zakladki-panelu label:has-text("Warstwy")'); }],
  ['10-menu-wiecej', async (s) => { await doEdytora(s); await s.click('#przycisk-wiecej'); }],
  ['11-wzorce', async (s) => { await doEdytora(s); await akcja(s, 'wzorce'); await s.waitForSelector('#dlg-wzorce[open]'); }],
  ['12-dane', async (s) => { await doEdytora(s); await akcja(s, 'dane'); await s.waitForSelector('#dlg-dane[open]'); }],
  ['13-seria', async (s) => { await doEdytora(s); await s.evaluate(() => window.seriodruk.dane?.otworzSerie?.('se_dni')); await s.waitForSelector('#dlg-seria[open]', { timeout: 3000 }); }],
  ['14-sekcja', async (s) => { await doEdytora(s); await s.evaluate(() => window.seriodruk.otworzUstawieniaSekcji(window.seriodruk.stan.projekt.sekcje[1].id)); await s.waitForSelector('#dlg-sekcja[open]'); }],
  ['15-pdf', async (s) => { await doEdytora(s); await akcja(s, 'pdf'); await s.waitForSelector('#dlg-pdf[open]'); }],
  ['16-kontrola', async (s) => { await doEdytora(s); await akcja(s, 'kontrola'); await s.waitForSelector('#dlg-kontrola[open]'); await czekaj(s, 1500); }],
  ['17-dostep-ai', async (s) => { await doEdytora(s); await akcja(s, 'dostep-ai'); await s.waitForSelector('#dlg-dostep-ai[open]'); }],
  ['18-czcionki', async (s) => { await doEdytora(s); await akcja(s, 'czcionki'); await s.waitForSelector('#dlg-czcionki[open]'); }],
  ['19-obrazy', async (s) => { await doEdytora(s); await akcja(s, 'obrazy'); await s.waitForSelector('#dlg-obrazy[open]'); await czekaj(s, 400); }],
  ['20-zrodlo-obrazu', async (s) => { await doEdytora(s); await akcja(s, 'dodaj-obraz'); await s.waitForSelector('#dlg-zrodlo-obrazu[open]'); }],
  ['21-tabela-nowa', async (s) => { await doEdytora(s); await akcja(s, 'dodaj-tabele'); await s.waitForSelector('#dlg-tabela[open]'); }],
  ['22-potwierdz', async (s) => {
    await doEdytora(s);
    await s.evaluate(async () => { (await import('./js/ui.js')).potwierdz('Usunąć stronę „Styczeń”?', 'Strona zniknie z projektu razem z elementami. Można to cofnąć (Ctrl+Z).', 'Usuń', true); });
    await s.waitForSelector('#dlg-potwierdz[open]');
  }],
  ['23-nazwa', async (s) => {
    await doEdytora(s);
    await s.evaluate(async () => { (await import('./js/ui.js')).zapytajONazwe('Zmień nazwę strony', 'Nazwa strony', 'Styczeń'); });
    await s.waitForSelector('#dlg-nazwa[open]');
  }],
  ['24-duplikat', async (s) => {
    await doEdytora(s);
    await s.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 600; c.height = 400;
      const x = c.getContext('2d'); x.fillStyle = '#b91c1c'; x.fillRect(0, 0, 600, 400);
      const plik = await new Promise((ok) => c.toBlob((b) => ok(new File([b], 'morze.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.8));
      (await import('./js/app/obrazy-okno.js')).wgrajObrazy([plik]);
    });
    await s.waitForSelector('#dlg-obraz-duplikat[open]');
    await czekaj(s, 300);
  }],
  ['25-konflikt', async (s) => {
    await doEdytora(s);
    await s.evaluate(() => {
      const d = document.querySelector('#dlg-konflikt');
      document.querySelector('#konflikt-opis').textContent = 'Te części projektu zmieniono tu i na innym urządzeniu. Wybierz, która wersja zostaje.';
      const l = document.querySelector('#konflikt-lista');
      l.innerHTML = '<li><strong>Strona „Styczeń”</strong><label><input type="radio" name="k0" value="moje" checked><span>Z tego urządzenia (dziś 10:12)</span></label><label><input type="radio" name="k0" value="konto"><span>Z konta (dziś 10:14)</span></label></li>';
      d.showModal();
    });
  }],
  ['26-podglad', async (s) => { await doEdytora(s); await akcja(s, 'podglad'); await s.waitForFunction(() => document.body.dataset.ekran === 'podglad'); await czekaj(s, 1200); }],
  ['27-udostepnij', async (s) => {
    await doEdytora(s); await akcja(s, 'podglad'); await s.waitForFunction(() => document.body.dataset.ekran === 'podglad');
    await akcja(s, 'udostepnij'); await s.waitForSelector('#dlg-udostepnij[open]');
  }],
  ['28-prezentacja', async (s) => {
    await doEdytora(s); await akcja(s, 'podglad'); await s.waitForFunction(() => document.body.dataset.ekran === 'podglad');
    await czekaj(s, 600); await akcja(s, 'podglad-prezentacja'); await s.waitForSelector('.prezentacja'); await czekaj(s, 1200);
  }],
  ['29-instrukcja', async (s) => { await doEdytora(s); await akcja(s, 'instrukcja'); await s.waitForSelector('#dlg-instrukcja[open]'); await czekaj(s, 600); }],
  ['30-nowy-projekt', async (s) => {
    await doEdytora(s);
    await s.click('[data-akcja="do-projektow"]:visible'); await s.waitForSelector('.karta-projektu:not(.szkielet)');
    await s.click('[data-akcja="nowy-projekt"]:visible'); await s.waitForSelector('#dlg-nowy[open]');
  }],
  // Współpraca między kontami (decyzja #86): okno „Współpraca”, skrzynka zaproszeń, zaproszenie z linku,
  // lista z projektem udostępnionym.
  ['32-wspolpraca', async (s) => {
    await doEdytora(s); await akcja(s, 'wspolpraca'); await s.waitForSelector('#dlg-wspolpraca[open] #form-zaproszenia:not([hidden])');
    await s.fill('#wspolpraca-email', 'ola.nowak@przyklad.pl'); await s.click('#wspolpraca-zapros');
    await s.waitForSelector('#wspolpraca-gotowe:not([hidden])'); await czekaj(s, 800);
  }],
  ['33-zaproszenia', async (s, baza) => {
    await doEdytora(s);
    zaproszenieOdOli(baza, 'kod-skrzynka');
    await s.click('[data-akcja="do-projektow"]:visible'); await s.waitForSelector('#przycisk-zaproszenia:not([hidden])');
    await s.click('#przycisk-zaproszenia'); await s.waitForSelector('#dlg-zaproszenia[open] #zaproszenia-lista li');
  }],
  ['34-zaproszenie-z-linku', async (s, baza) => {
    await doEdytora(s);
    zaproszenieOdOli(baza, 'kod-link');
    await s.evaluate(() => { location.hash = '#/zaproszenie/kod-link'; });
    await s.waitForSelector('#dlg-zaproszenie[open]');
  }],
  ['35-projekty-udostepnione', async (s, baza) => {
    await doEdytora(s);
    zaproszenieOdOli(baza, 'kod-lista');
    baza.wspolpraca('przyjmij_zaproszenie', { p_kod: 'kod-lista' }, baza.konta[0]);
    await s.click('[data-akcja="do-projektow"]:visible');
    await s.waitForSelector('.karta-projektu.wspoldzielony'); await czekaj(s, 400);
  }],
  ['31-konto', async (s) => {
    await doEdytora(s);
    await s.evaluate(() => { location.hash = '#/konto'; });
    await s.waitForFunction(() => document.body.dataset.ekran === 'konto'); await czekaj(s, 400);
  }],
];

async function zrzutyUrzadzenia(przegladarka, u, motyw) {
  const katalog = path.join(KATALOG, u.nazwa, motyw);
  fs.mkdirSync(katalog, { recursive: true });
  const kontekst = await przegladarka.newContext({ ...u.opcje, deviceScaleFactor: 1, serviceWorkers: 'block', colorScheme: motyw === 'ciemny' ? 'dark' : 'light' });
  const baza = await podlaczAtrape(kontekst);
  const s = await kontekst.newPage();
  const bledy = [];
  s.on('pageerror', (e) => bledy.push(e.message));
  const audyt = {};
  const zrzut = async (nazwa) => {
    await czekaj(s, 450);
    // Komunikat z przygotowania danych („Wgrano 3 obrazy”) nie należy do ocenianego widoku.
    await s.evaluate(() => { const p = document.querySelector('#powiadomienie'); if (p && /Wgrano|Pominięto/.test(p.textContent)) p.hidden = true; });
    await s.screenshot({ path: path.join(katalog, `${nazwa}.png`) });
    const w = await s.evaluate(audytUkladu, { dotyk: Boolean(u.opcje.hasTouch) });
    if (w.length) audyt[nazwa] = w;
  };
  await s.goto(ADRES);
  await s.waitForSelector('#form-logowania input[name=email]', { state: 'visible' });
  await zrzut('01-logowanie');
  await zaloguj(s, baza);
  await przykladoweProjekty(s);
  await uzupelnij(s);
  await s.click('[data-akcja="do-projektow"]:visible');
  await s.waitForSelector('.karta-projektu:not(.szkielet)');
  await zrzut('02-projekty');
  await s.click('.karta-projektu:has-text("Kalendarz 2027") .menu-karty');
  await zrzut('02b-projekty-menu');
  await s.keyboard.press('Escape');
  await s.click('.karta-projektu:has-text("Kalendarz 2027") .otworz-projekt');
  await s.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa === 'Kalendarz 2027' && document.body.dataset.ekran === 'edytor');
  await s.evaluate(() => { window.idKalendarza = window.seriodruk.stan.projekt.id; });
  const nieudane = [];
  for (const [nazwa, przygotuj] of WIDOKI) {
    try {
      await przygotuj(s, baza);
      await zrzut(nazwa);
    } catch (e) {
      nieudane.push(`${nazwa}: ${e.message.split('\n')[0]}`);
    }
  }
  await kontekst.close();
  fs.writeFileSync(path.join(katalog, 'audyt.json'), JSON.stringify(audyt, null, 1));
  return { nieudane, bledy, audyt };
}

// Arkusze zbiorcze: kilka zrzutów obok siebie (pomniejszone), z podpisami – przez Pythona i Pillow.
function arkusze() {
  const wyj = path.join(KATALOG, 'arkusze');
  fs.mkdirSync(wyj, { recursive: true });
  execFileSync('python3', ['-I', path.join(__dirname, 'arkusze-zrzutow.py'), KATALOG, wyj], { stdio: 'inherit' });
}

(async () => {
  const przegladarka = await chromium.launch();
  for (const u of URZADZENIA) {
    for (const motyw of ['jasny', 'ciemny']) {
      const { nieudane, bledy, audyt } = await zrzutyUrzadzenia(przegladarka, u, motyw);
      const usterki = Object.values(audyt).flat().filter((x) => x.rodzaj !== 'maly-cel-dotyku').length;
      console.log(`✓ ${u.nazwa} / ${motyw}: usterek układu ${usterki}${nieudane.length ? ` – nie wyszło: ${nieudane.join('; ')}` : ''}${bledy.length ? ` – błędy strony: ${[...new Set(bledy)].join('; ')}` : ''}`);
    }
  }
  // Telefon trzymany poziomo: aplikacja prosi o obrócenie.
  if (!TYLKO || TYLKO.includes('pixel-7')) {
    const k = await przegladarka.newContext({ ...devices['Pixel 7 landscape'], deviceScaleFactor: 1, serviceWorkers: 'block' });
    await podlaczAtrape(k);
    const s = await k.newPage();
    await s.goto(ADRES);
    await czekaj(s, 1200);
    fs.mkdirSync(path.join(KATALOG, 'pixel-7-poziom'), { recursive: true });
    await s.screenshot({ path: path.join(KATALOG, 'pixel-7-poziom', 'poziom.png') });
    await k.close();
  }
  await przegladarka.close();
  arkusze();
})();
