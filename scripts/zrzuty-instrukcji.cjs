// Generuje zrzuty ekranu do instrukcji (img/instrukcja/*.png).
//
// Użycie:
//   python3 -m http.server 8000          # w katalogu repozytorium
//   node scripts/zrzuty-instrukcji.cjs [http://localhost:8000/]
//
// Wymaga Playwright (npm i -g playwright && npx playwright install chromium).
// Zrzuty powstają w trybie bez konta, na przykładowych projektach, więc
// nie dotykają prawdziwych danych w Supabase.

const path = require('path');
const { chromium, devices } = require('playwright');
const { otworz: otworzZAtrapa, podlaczAtrape, zaloguj } = require('../tests/pomoc.cjs');

const ADRES = process.argv[2] || 'http://localhost:8000/';
// Drugi argument „ciemny” robi ten sam komplet w ciemnym motywie (img/instrukcja/ciemny/).
const CIEMNY = process.argv[3] === 'ciemny';
const KATALOG = path.join(__dirname, '..', 'img', 'instrukcja', ...(CIEMNY ? ['ciemny'] : []));
const MOTYW = { colorScheme: CIEMNY ? 'dark' : 'light' };
if (require.main === module) require('node:fs').mkdirSync(KATALOG, { recursive: true });
const WIDOK = { width: 1280, height: 800 };

// Konfiguracja z fikcyjnym adresem – tylko po to, by ekran logowania
// wyglądał jak w działającej aplikacji. Żadne zapytanie nie wychodzi.
const FAKE_KONFIG = "export const SUPABASE_URL = 'https://przyklad.supabase.co';\nexport const SUPABASE_ANON_KEY = 'sb_publishable_przyklad';\n";
// Reszta zrzutów powstaje na koncie w atrapie bazy z testów (tests/pomoc.cjs) – na przykładowych
// projektach, bez łączenia z prawdziwą bazą.

async function zrzut(strona, nazwa, opcje = {}) {
  await strona.waitForTimeout(350);
  await strona.screenshot({ path: path.join(KATALOG, nazwa), ...opcje });
  console.log('✓', nazwa);
}

// Kadr (decyzja #114): wycinek ekranu wokół wskazanych elementów, z pomarańczową obwódką wokół miejsca,
// które się klika. obszar, zaznacz – selektory Playwright (pierwszy pasujący widoczny element).
async function kadr(strona, nazwa, { obszar, zaznacz = [], margines = 16 }) {
  const ramki = [];
  await strona.locator([].concat(obszar)[0]).locator('visible=true').first().scrollIntoViewIfNeeded();
  for (const sel of [].concat(obszar)) {
    const r = await strona.locator(sel).locator('visible=true').first().boundingBox();
    if (!r) throw new Error(`kadr ${nazwa}: brak ${sel}`);
    ramki.push(r);
  }
  const znaczniki = [];
  for (const sel of [].concat(zaznacz)) {
    const r = await strona.locator(sel).locator('visible=true').first().boundingBox();
    if (!r) throw new Error(`kadr ${nazwa}: brak ${sel}`);
    znaczniki.push(r);
  }
  await strona.evaluate((lista) => {
    for (const r of lista) {
      const d = document.createElement('div');
      d.className = 'znacznik-kadru';
      Object.assign(d.style, {
        position: 'fixed', left: `${r.x - 4}px`, top: `${r.y - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px`,
        border: '3px solid #ea580c', borderRadius: '10px', boxShadow: '0 0 0 4px rgba(234, 88, 12, .22)', zIndex: 2147483647, pointerEvents: 'none',
      });
      document.body.append(d);
    }
  }, znaczniki);
  const v = strona.viewportSize();
  const x0 = Math.max(0, Math.min(...ramki.map((r) => r.x)) - margines);
  const y0 = Math.max(0, Math.min(...ramki.map((r) => r.y)) - margines);
  const x1 = Math.min(v.width, Math.max(...ramki.map((r) => r.x + r.width)) + margines);
  const y1 = Math.min(v.height, Math.max(...ramki.map((r) => r.y + r.height)) + margines);
  await zrzut(strona, nazwa, { clip: { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) } });
  await strona.evaluate(() => document.querySelectorAll('.znacznik-kadru').forEach((d) => d.remove()));
}

// Przykładowe projekty budowane przez API edytora.
async function przykladoweProjekty(strona) {
  await strona.evaluate(() => window.seriodruk.doczytajEdytor()); // edytor wczytuje się dopiero po zalogowaniu, w tle
  await strona.evaluate(async () => {
    const { otworzProjekt, edytor, stan } = window.seriodruk;
    const mm = (pt) => pt * 25.4 / 72;
    const tekst = (t, o) => new fabric.Textbox(t, {
      fontFamily: 'Inter', fontSize: mm(11), fill: '#1c1b19', lineHeight: 1.25, strokeWidth: 0, ...o,
    });
    const dodaj = (o) => { o.set({ id: `o_${Math.random().toString(36).slice(2)}` }); edytor.canvas.add(o); };
    const zapisz = async () => {
      const s = stan.projekt.strony[stan.indeks];
      s.obiekty = edytor.obiektyStrony();
      stan.projekt.miniatura = edytor.miniatura(200);
    };
    const nowy = (nazwa, wydruk) => ({
      id: crypto.randomUUID(), nazwa, wydruk: { format: 'A5', szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, marginesy_mm: 10, znaki_ciecia: true, ...wydruk },
      strony: [{ id: 's1', nazwa: 'Strona 1', obiekty: [], tlo: '#ffffff' }],
    });
    const zapiszLokalnie = async () => {
      const { zapiszLokalnie: z } = await import(new URL('js/lokalny.js', location.href).href);
      stan.projekt.zmieniono = new Date(Date.now() - Math.random() * 3e8).toISOString();
      await z(stan.projekt, 'lokalny', false);
    };

    // 1. Notes kropkowany
    await otworzProjekt(nowy('Notes kropkowany', {}));
    for (let y = 20; y < 200; y += 5) for (let x = 14; x < 136; x += 5) {
      dodaj(new fabric.Circle({ left: x, top: y, radius: 0.35, fill: '#b9b5aa', strokeWidth: 0, selectable: false }));
    }
    await zapisz(); await zapiszLokalnie();

    // 2. Planer tygodniowy (poziomo)
    await otworzProjekt(nowy('Planer tygodniowy', { format: 'A5', szerokosc_mm: 210, wysokosc_mm: 148 }));
    dodaj(tekst('TYDZIEŃ 14', { left: 12, top: 12, width: 80, fontSize: mm(16), fontWeight: 'bold', fontFamily: 'Montserrat' }));
    ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'].forEach((d, i) => {
      const x = 12 + (i % 3) * 63; const y = 30 + Math.floor(i / 3) * 56;
      dodaj(new fabric.Rect({ left: x, top: y, width: 59, height: 52, fill: '#f6f4ee', stroke: '#d9d4c7', strokeWidth: 0.3, strokeUniform: true, rx: 2, ry: 2 }));
      dodaj(tekst(d, { left: x + 3, top: y + 3, width: 30, fontSize: mm(9), fontWeight: 'bold', fill: '#c2410c' }));
    });
    await zapisz(); await zapiszLokalnie();

    // 3. Kalendarz 2027 – kilka stron
    await otworzProjekt(nowy('Kalendarz 2027', {}));
    dodaj(new fabric.Rect({ left: -3, top: -3, width: 151, height: 62, fill: '#2f5bd3', strokeWidth: 0, bez_ostrzezen: true })); // do grzbietu (lewa strona)
    dodaj(tekst('Styczeń', { left: 10, top: 18, width: 120, fontSize: mm(30), fontFamily: 'Playfair Display', fontWeight: 'bold', fill: '#ffffff' }));
    dodaj(tekst('2027', { left: 10, top: 40, width: 60, fontSize: mm(12), fill: '#dbe4fb' }));
    const dni = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
    dni.forEach((d, i) => dodaj(tekst(d, { left: 10 + i * 17.4, top: 70, width: 16, fontSize: mm(8), fontWeight: 'bold', textAlign: 'center', fill: i > 4 ? '#c2410c' : '#4a4843' })));
    for (let n = 1; n <= 31; n += 1) {
      const p = n + 3; const kol = p % 7; const rz = Math.floor(p / 7);
      dodaj(tekst(String(n), { left: 10 + kol * 17.4, top: 80 + rz * 18, width: 16, fontSize: mm(11), textAlign: 'center', fill: kol > 4 ? '#c2410c' : '#1c1b19' }));
    }
    dodaj(new fabric.Line([10.5, 186, 131.5, 186], { stroke: '#cfccc3', strokeWidth: 0.3, strokeUniform: true }));
    dodaj(tekst('Notatki', { left: 10, top: 188, width: 60, fontSize: mm(8), fill: '#807d75' }));
    await zapisz();

    // Sekcje: okładka (szeroka, z grzbietem) + środek w rozkładówkach ze wzorcem.
    const rnd = () => `o_${Math.random().toString(36).slice(2)}`;
    const json = (obiekty) => obiekty.map((o) => { o.set({ id: rnd() }); return o.toObject(['id', 'bez_ostrzezen', 'styl']); });
    const P = stan.projekt;
    P.style = window.seriodruk.domyslneStyle();
    const srodek = P.sekcje[0];
    Object.assign(srodek, { nazwa: 'Środek', uklad: 'rozkladowki', pierwsza: 'prawa', wzorce: ['wz_kalendarz'] });
    srodek.wydruk.marginesy = { gora: 10, dol: 12, wewnetrzny: 16, zewnetrzny: 10 };
    // Wzorzec rysowany dla strony prawej; na lewych odbija się lustrzanie.
    P.wzorce.push({
      id: 'wz_kalendarz', nazwa: 'Stopka z numerem', wydruk: JSON.parse(JSON.stringify(srodek.wydruk)), tlo: null, lustro: true,
      obiekty: json([
        new fabric.Line([16, 199, 138, 199], { stroke: '#cfccc3', strokeWidth: 0.3, strokeUniform: true, bez_ostrzezen: true }),
        tekst('Kalendarz 2027', { left: 16, top: 201, width: 60, fontSize: mm(7), fill: '#807d75', bez_ostrzezen: true }),
        tekst('{nr}', { left: 108, top: 201, width: 30, fontSize: mm(7), fontWeight: 'bold', fill: '#4a4843', textAlign: 'right', bez_ostrzezen: true }),
      ]),
    });
    P.sekcje.unshift({
      id: 'sek_okladka', nazwa: 'Okładka', uklad: 'pojedyncze', wzorce: [], numeracja: { tryb: 'brak', od: 1 },
      wydruk: { format: 'wlasny', szerokosc_mm: 302, wysokosc_mm: 210, spad_mm: 3, marginesy_mm: 10, znaki_ciecia: true },
    });
    const styczen = P.strony[0];
    Object.assign(styczen, { id: 's_styczen', nazwa: 'Styczeń', sekcja: srodek.id });
    const linie = [];
    for (let y = 40; y <= 180; y += 10) linie.push(new fabric.Line([16.2, y, 137.8, y], { stroke: '#d9d4c7', strokeWidth: 0.25, strokeUniform: true }));
    P.strony = [
      {
        id: 's_okladka', nazwa: 'Okładka', sekcja: 'sek_okladka', wzorce: 'z_sekcji', tlo: '#1f2a44',
        obiekty: json([
          new fabric.Rect({ left: 148, top: -3, width: 6, height: 216, fill: '#f2c66d', strokeWidth: 0, bez_ostrzezen: true }),
          tekst('Kalendarz', { left: 166, top: 72, width: 126, fontSize: mm(34), fontFamily: 'Playfair Display', fontWeight: 'bold', fill: '#ffffff' }),
          tekst('2027', { left: 166, top: 100, width: 126, fontSize: mm(34), fontFamily: 'Playfair Display', fill: '#f2c66d' }),
        ]),
      },
      {
        id: 's_tytul', nazwa: 'Strona tytułowa', sekcja: srodek.id, wzorce: [], tlo: null,
        obiekty: json([
          tekst('Kalendarz 2027', { left: 16, top: 84, width: 122, fontSize: mm(26), fontFamily: 'Playfair Display', fontWeight: 'bold', textAlign: 'center' }),
          tekst('Anna Kowalska', { left: 16, top: 104, width: 122, fontSize: mm(11), textAlign: 'center', fill: '#807d75' }),
        ]),
      },
      styczen,
      {
        id: 's_notatki', nazwa: 'Notatki', sekcja: srodek.id, wzorce: 'z_sekcji', tlo: null,
        obiekty: json([
          tekst('Notatki', { left: 16, top: 18, width: 122, fontSize: mm(16), fontWeight: 'bold', styl: P.style[1].id }),
          ...linie,
        ]),
      },
      { id: 's_luty', nazwa: 'Luty', sekcja: srodek.id, wzorce: 'z_sekcji', obiekty: [], tlo: null },
    ];
    await otworzProjekt(P);
    stan.projekt.miniatura = edytor.miniatura(200);
    await zapiszLokalnie();
  });
}

module.exports = { przykladoweProjekty, kadr, zrzut };
if (require.main === module) (async () => {
  const przegladarka = await chromium.launch();

  // ---------- Logowanie, rejestracja, ustawienia konta (atrapa Supabase z testów) ----------
  {
    const sprzatanie = [];
    const { strona: k } = await otworzZAtrapa({ after: (f) => sprzatanie.push(f) }, {
      tryb: 'atrapa',
      konta: [{ id: '11111111-1111-4111-8111-111111111111', email: 'anna@przyklad.pl', haslo: 'Dobre#Haslo1', potwierdzone: true, nazwa: 'Anna' }],
    });
    await k.emulateMedia(MOTYW);
    await k.waitForSelector('#ekran-logowania', { state: 'visible' });
    await k.fill('#form-logowania input[name=email]', 'anna@przyklad.pl');
    await k.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
    await k.locator('.stopka-logowania').click();
    await zrzut(k, 'logowanie.png');
    await kadr(k, 'k-zobacz-jak.png', { obszar: '.karta-logowania', zaznacz: '.zobacz-jak' });

    await k.click('#tryb-logowania label:has-text("Nowe konto")');
    await k.fill('#form-logowania input[name=nazwa]', 'jan.kowalski');
    await k.fill('#form-logowania input[name=email]', 'jan@przyklad.pl');
    await k.fill('#form-logowania input[name=haslo]', 'Kalendarz7');
    await k.locator('.stopka-logowania').click();
    await zrzut(k, 'rejestracja.png');
    await k.fill('#form-logowania input[name=haslo]', 'Kalendarz#27');
    await k.fill('#form-logowania input[name=haslo2]', 'Kalendarz#27');
    await k.click('#przycisk-logowania');
    await k.waitForSelector('#widok-wyslano', { state: 'visible' });
    // Kadr: prawa kolumna z formularzem (jej położenie wynika z siatki ekranu logowania).
    const kolumna = await k.evaluate(() => { const r = document.querySelector('.logowanie-forma').getBoundingClientRect(); return { x: Math.round(r.x), width: Math.round(r.width) }; });
    await zrzut(k, 'rejestracja-wyslano.png', { clip: { ...kolumna, y: 0, height: 520 } });

    await k.click('#widok-wyslano [data-tryb="logowanie"]');
    await k.fill('#form-logowania input[name=email]', 'anna@przyklad.pl');
    await k.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
    await k.click('#przycisk-logowania');
    await k.waitForFunction(() => document.body.dataset.ekran === 'projekty');
    await k.click('#awatar');
    await kadr(k, 'k-menu-konta.png', { obszar: ['#menu-uzytkownika', '#awatar'], zaznacz: '#menu-uzytkownika [data-akcja="ustawienia-konta"]' });
    await k.click('[data-akcja="ustawienia-konta"]');
    await k.waitForFunction(() => document.body.dataset.ekran === 'konto');
    await k.click('.konto-lista [data-sekcja="logowanie"]:not([data-cel])');
    await k.click('[data-rozwin="form-email"]');
    await zrzut(k, 'konto.png');
    await k.click('[data-zwin="form-email"]');
    await k.click('.konto-lista [data-sekcja="wyglad"]');
    await k.click('#wybor-motywu label:has-text("Ciemny")');
    await k.waitForTimeout(400);
    await zrzut(k, 'motyw.png');
    await kadr(k, 'k-konto-ai.png', { obszar: '.konto-lista', zaznacz: '.konto-lista [data-sekcja="ai"]' });
    await k.click('#wybor-motywu label:has-text("Jak w systemie")');
    await k.click('.konto-lista [data-sekcja="powiadomienia"]');
    await k.waitForTimeout(500);
    await kadr(k, 'k-powiadomienia.png', { obszar: '#ust-powiadomienia', margines: 8 });
    // Formularz kontaktowy z załącznikiem (#116).
    await k.evaluate(async () => (await import('./js/app/kontakt.js')).otworzKontakt());
    await k.waitForSelector('#dlg-kontakt[open]');
    await k.fill('#kontakt-temat', 'Pytanie o grzbiet okładki');
    await k.fill('#kontakt-tresc', 'Dzień dobry, w załączniku zrzut ekranu z okładką – czy grzbiet jest dobrze policzony?');
    await k.setInputFiles('#kontakt-pliki', { name: 'okladka-zrzut.png', mimeType: 'image/png', buffer: Buffer.alloc(48000, 1) });
    await k.waitForTimeout(300);
    await kadr(k, 'k-kontakt.png', { obszar: '#form-kontakt', zaznacz: '.kontakt-zalaczniki label', margines: 8 });
    await k.evaluate(() => document.querySelector('#dlg-kontakt').close());

    // Udostępnianie podglądu linkiem
    await k.click('[data-akcja="do-projektow"]:visible');
    await k.click('[data-akcja="nowy-projekt"]:visible');
    await k.fill('#form-nowy input[name=nazwa]', 'Kalendarz 2027');
    await k.click('#form-nowy button[value=ok]');
    await k.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk);
    await k.evaluate(() => {
      const { edytor } = window.seriodruk;
      const r = edytor.dodajProstokat();
      r.set({ left: -3, top: -3, width: 154, height: 62, fill: '#2f5bd3', strokeWidth: 0 });
      const t = edytor.dodajTekst('Styczeń');
      t.set({ left: 10, top: 20, fill: '#ffffff', fontFamily: 'Playfair Display', fontWeight: 'bold', fontSize: 30 * 25.4 / 72 });
      edytor.zatwierdz();
    });
    await k.click('[data-akcja="strona-dodaj"]');
    await k.click('[data-akcja="podglad"]');
    await k.waitForFunction(() => document.body.dataset.ekran === 'podglad');
    await kadr(k, 'k-udostepnij.png', { obszar: ['.pasek-podgladu [data-akcja="podglad-prezentacja"]', '.pasek-podgladu .powiekszenie'], zaznacz: '.pasek-podgladu [data-akcja="udostepnij"]', margines: 12 });
    await k.click('[data-akcja="udostepnij"]');
    await k.click('#udostepnij-utworz');
    await k.waitForSelector('#udostepnij-komunikat.sukces', { timeout: 20000 });
    await k.evaluate(() => { document.querySelector('#podglad-tresc').scrollTop = 0; });
    await k.waitForTimeout(600);
    await zrzut(k, 'udostepnianie.png');
    for (const f of sprzatanie) await f();
  }

  // ---------- Desktop / tablet w poziomie ----------  // ---------- Desktop / tablet w poziomie ----------
  const kontekst = await przegladarka.newContext({ viewport: WIDOK, serviceWorkers: 'block', ...MOTYW });
  const bazakontekst = await podlaczAtrape(kontekst);
  const s = await kontekst.newPage();
  s.on('pageerror', (e) => console.error('błąd strony:', e.message));
  await s.goto(ADRES);
  await zaloguj(s, bazakontekst);
  await przykladoweProjekty(s);
  await s.click('[data-akcja="do-projektow"]:visible');
  await s.waitForSelector('.karta-projektu:not(.szkielet)');
  await s.waitForTimeout(600);
  await zrzut(s, 'projekty.png');
  await kadr(s, 'k-nowy-projekt.png', { obszar: '.projekty-naglowek', zaznacz: '.projekty-naglowek [data-akcja="nowy-projekt"]' });

  // Nowy projekt
  await s.click('.projekty-naglowek [data-akcja="nowy-projekt"]');
  await s.fill('#form-nowy input[name=nazwa]', 'Kalendarz książkowy 2027');
  await zrzut(s, 'nowy-projekt.png');
  await s.click('#form-nowy button[value=anuluj]');

  // Edytor – przegląd z numerkami
  await s.click('.karta-projektu:has-text("Kalendarz 2027") .otworz-projekt');
  await s.waitForSelector('#ekran-edytora', { state: 'visible' });
  await s.click('#lista-stron li.strona:has-text("Styczeń") .miniatura');
  await s.waitForTimeout(1200);
  await s.evaluate(() => {
    const znacz = (sel, n, dx = 12, dy = 12) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      const d = document.createElement('div');
      d.className = 'znacznik-zrzutu';
      d.textContent = n;
      Object.assign(d.style, {
        position: 'fixed', left: `${r.left + dx}px`, top: `${r.top + dy}px`, zIndex: 999,
        width: '30px', height: '30px', borderRadius: '50%', background: '#c2410c', color: '#fff',
        display: 'grid', placeItems: 'center', font: '700 15px Inter', boxShadow: '0 2px 8px rgba(0,0,0,.3)',
      });
      document.body.append(d);
    };
    void znacz; // numerki nie są już potrzebne – rozdział opisuje części edytora słowami
  });
  await zrzut(s, 'edytor.png');
  await kadr(s, 'k-pasek-gorny.png', { obszar: '.pasek-edytora', margines: 0 });
  await kadr(s, 'k-wstaw.png', { obszar: '#pasek-narzedzi', margines: 12 });
  await kadr(s, 'k-widok.png', { obszar: '#kontrolki-widoku', margines: 12 });
  const przyciskiPaska = ['.pasek-edytora [data-akcja="cofnij"]', '.pasek-edytora [data-akcja="podglad"]', '#przycisk-wiecej'];
  await kadr(s, 'k-wzorce.png', { obszar: przyciskiPaska, zaznacz: '.pasek-edytora [data-akcja="wzorce"]', margines: 10 });
  await kadr(s, 'k-dane.png', { obszar: przyciskiPaska, zaznacz: '.pasek-edytora [data-akcja="dane"]', margines: 10 });
  await kadr(s, 'k-podglad.png', { obszar: przyciskiPaska, zaznacz: '.pasek-edytora [data-akcja="podglad"]', margines: 10 });
  await s.click('#przycisk-wiecej');
  await kadr(s, 'k-menu-wiecej.png', { obszar: ['#menu-wiecej', '#przycisk-wiecej'] });
  await kadr(s, 'k-menu-pdf.png', { obszar: ['#menu-wiecej', '#przycisk-wiecej'], zaznacz: '#menu-wiecej [data-akcja="pdf"]' });
  await kadr(s, 'k-menu-kontrola.png', { obszar: ['#menu-wiecej', '#przycisk-wiecej'], zaznacz: '#menu-wiecej [data-akcja="kontrola"]' });
  await kadr(s, 'k-menu-wspolpraca.png', { obszar: ['#menu-wiecej', '#przycisk-wiecej'], zaznacz: '#menu-wiecej [data-akcja="wspolpraca"]' });
  await s.keyboard.press('Escape');
  await s.click('#przycisk-widok');
  await kadr(s, 'k-menu-widoku.png', { obszar: ['#menu-widoku', '#kontrolki-widoku'] });
  await s.keyboard.press('Escape');
  await s.evaluate(() => document.querySelectorAll('.znacznik-zrzutu').forEach((d) => d.remove()));

  // Wstawianie: zaznaczony tekst
  await s.evaluate(() => {
    const { edytor } = window.seriodruk;
    const t = edytor.canvas.getObjects().find((o) => o.text === 'Styczeń');
    edytor.canvas.setActiveObject(t);
    edytor.canvas.requestRenderAll();
  });
  await s.hover('[data-akcja="dodaj-tekst"]');
  await zrzut(s, 'wstawianie.png', { clip: { x: 208, y: 56, width: 772, height: 744 } });

  // Właściwości tekstu
  await zrzut(s, 'wlasciwosci.png', { clip: { x: 240, y: 56, width: 1040, height: 744 } });

  // Strony – menu
  await s.evaluate(() => { window.seriodruk.edytor.canvas.discardActiveObject(); window.seriodruk.edytor.canvas.requestRenderAll(); });
  await s.waitForTimeout(800);
  await s.click('#lista-stron li.strona:has-text("Styczeń") .menu-miniatury');
  await zrzut(s, 'strony.png', { clip: { x: 0, y: 0, width: 560, height: 560 } });
  await s.keyboard.press('Escape');

  // Sekcje: ustawienia sekcji „Okładka”
  await s.click('#lista-stron .sekcja-listy:has-text("Okładka") button');
  await s.click('#menu-sekcji [data-akcja="sekcja-ustawienia"]');
  await zrzut(s, 'sekcje.png');
  await s.keyboard.press('Escape');

  // Wzorce: edycja wzorca
  await s.evaluate(() => window.seriodruk.edytujWzorzec('wz_kalendarz'));
  await s.waitForTimeout(900);
  await zrzut(s, 'wzorce.png');
  await s.click('[data-akcja="wroc-do-stron"]');
  await s.click('#lista-stron li.strona:has-text("Styczeń") .miniatura');
  await s.waitForTimeout(800);

  // Okno „Wzorce”: szablony projektu i wzorce standardowe
  await s.click('[data-akcja="wzorce"]');
  await s.waitForSelector('#dlg-wzorce[open]');
  await s.waitForTimeout(900);
  await zrzut(s, 'okno-wzorcow.png');
  await s.click('#wzorce-zamknij');

  // Rozkładówka: obie strony (Styczeń, Notatki) na jednym płótnie, pas przez grzbiet
  await s.evaluate(() => {
    const { edytor } = window.seriodruk;
    const w = edytor.wydruk.szerokosc_mm;
    const h = edytor.wydruk.wysokosc_mm;
    const pas = edytor.dodajProstokat();
    pas.set({ left: 14, top: h - 26, width: 2 * w - 28, height: 5, fill: '#2f5bd3', strokeWidth: 0, nazwa: 'Pas przez grzbiet' });
    edytor.zatwierdz();
  });
  await s.waitForTimeout(500);
  await zrzut(s, 'rozkladowki.png');
  await s.evaluate(() => { window.seriodruk.edytor.canvas.discardActiveObject(); window.seriodruk.edytor.canvas.requestRenderAll(); });

  // Podgląd bez edycji
  await s.click('[data-akcja="podglad"]');
  await s.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await s.waitForTimeout(1500);
  await zrzut(s, 'podglad.png');
  await s.keyboard.press('Escape');
  await s.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  await s.waitForTimeout(500);

  // Wyrównywanie: kilka zaznaczonych elementów
  await s.evaluate(() => {
    const { edytor } = window.seriodruk;
    const dni = edytor.canvas.getObjects().filter((o) => ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].includes(o.text));
    edytor.canvas.setActiveObject(new fabric.ActiveSelection(dni, { canvas: edytor.canvas }));
    edytor.canvas.requestRenderAll();
    edytor._emitujZaznaczenie();
  });
  await zrzut(s, 'wyrownanie.png', { clip: { x: 240, y: 56, width: 1040, height: 560 } });
  await s.evaluate(() => { window.seriodruk.edytor.canvas.discardActiveObject(); window.seriodruk.edytor.canvas.requestRenderAll(); });

  // Ostrzeżenia: element w marginesie
  await s.evaluate(() => {
    const { edytor } = window.seriodruk;
    const r = new fabric.Rect({ left: 2, top: 150, width: 40, height: 22, fill: '#fde68a', stroke: '#b45309', strokeWidth: 0.3, strokeUniform: true, nazwa: 'Ramka na naklejkę' });
    r.set({ id: 'o_przyklad' });
    edytor.canvas.add(r);
    edytor.canvas.discardActiveObject();
    edytor.canvas.requestRenderAll();
  });
  await s.waitForTimeout(500);
  await s.evaluate(() => { document.getElementById('panel-inspektor').scrollTop = 1e6; });
  await zrzut(s, 'ostrzezenia.png', { clip: { x: 240, y: 300, width: 1040, height: 500 } });
  await s.evaluate(() => {
    const { edytor } = window.seriodruk;
    edytor.zaznacz('o_przyklad');
    edytor.usun();
  });

  // Menu projektu na liście projektów (eksport, import)
  await s.click('[data-akcja="do-projektow"]:visible');
  await s.waitForSelector('.karta-projektu:not(.szkielet)');
  await s.waitForTimeout(600);
  await s.click('.karta-projektu:has-text("Kalendarz 2027") .menu-karty');
  await zrzut(s, 'menu.png', { clip: { x: 0, y: 56, width: 1280, height: 480 } });
  await s.keyboard.press('Escape');
  await kontekst.close();

  // ---------- Narzędzia precyzji i dane: osobny, mały projekt ----------
  const kp = await przegladarka.newContext({ viewport: WIDOK, serviceWorkers: 'block', ...MOTYW });
  const bazakp = await podlaczAtrape(kp);
  const d = await kp.newPage();
  d.on('pageerror', (e) => console.error('błąd strony:', e.message));
  await d.goto(ADRES);
  await zaloguj(d, bazakp);
  // Przycisk „Nowy projekt” na pustej liście (kliknięcie wprost – lista odświeża się w tle po zalogowaniu).
  await d.waitForFunction(() => [...document.querySelectorAll('[data-akcja="nowy-projekt"]')].some((e) => e.offsetParent));
  await d.evaluate(() => [...document.querySelectorAll('[data-akcja="nowy-projekt"]')].find((e) => e.offsetParent).click());
  await d.waitForSelector('#dlg-nowy[open]');
  await d.fill('#form-nowy input[name=nazwa]', 'Planer dzienny');
  await d.click('#form-nowy button[value=ok]');
  await d.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk);
  const naPlotnie = (x, y) => d.evaluate(([mx, my]) => { const e = window.seriodruk.edytor; const r = e.canvas.upperCanvasEl.getBoundingClientRect(); const v = e.canvas.viewportTransform; return { x: r.left + v[4] + mx * v[0], y: r.top + v[5] + my * v[3] }; }, [x, y]);

  // Siatka, linijki, prowadnice
  await d.evaluate(() => {
    const { edytor: e, stan } = window.seriodruk;
    const kolory = ['#d9e6f2', '#f2e2d9', '#dff2d9'];
    [[20, 30], [55, 30], [100, 110]].forEach(([left, top], i) => { const r = e.dodajProstokat(); r.set({ left, top, width: 25, height: 25, fill: kolory[i], strokeWidth: 0, nazwa: ['Poniedziałek', 'Wtorek', 'Środa'][i] }); r.setCoords(); });
    const pas = e.dodajProstokat(); pas.set({ left: 20, top: 150, width: 108, height: 12, fill: '#eee3f7', strokeWidth: 0, nazwa: 'Pas na notatki' }); pas.setCoords();
    e.prowadnice.push({ os: 'x', poz: 74, strona: 0 }, { os: 'y', poz: 140, strona: 0 });
    e.canvas.discardActiveObject();
    e.zatwierdz();
    Object.assign(stan.projekt.widok, { siatka: true });
    e.ustawWidok(stan.projekt.widok);
  });
  await d.click('#przycisk-widok');
  await zrzut(d, 'siatka.png');
  await d.keyboard.press('Escape');
  { const pusto = await naPlotnie(6, 200); await d.mouse.click(pusto.x, pusto.y); }

  // Odległości: trzeci kwadrat przeciągany w rząd, w równym odstępie
  const z = await naPlotnie(112, 122);
  const na = await naPlotnie(102.8, 42.4);
  await d.mouse.move(z.x, z.y);
  await d.mouse.down();
  await d.mouse.move((z.x + na.x) / 2, (z.y + na.y) / 2, { steps: 4 });
  await d.mouse.move(na.x, na.y, { steps: 4 });
  await zrzut(d, 'odleglosci.png', { clip: { x: 236, y: 56, width: 744, height: 520 } });
  await d.mouse.up();

  // Warstwy: panel pod właściwościami (#115) – zawsze widoczny, zrzut prawej części okna z płótnem obok.
  await d.click('#lista-warstw li:has-text("Wtorek") .warstwa-nazwa');
  await d.click('#lista-warstw li:has-text("Pas na notatki") .warstwa-oko');
  await d.hover('#lista-warstw li:has-text("Poniedziałek")');
  await d.click('#lista-warstw li:has-text("Poniedziałek") .warstwa-klodka');
  await d.click('#lista-warstw li:has-text("Wtorek") .warstwa-nazwa');
  await zrzut(d, 'warstwy.png', { clip: { x: WIDOK.width - 820, y: 56, width: 820, height: WIDOK.height - 56 } });

  // Dane, pola i serie: strona dnia powielana według tabeli
  await d.evaluate(async () => {
    const { edytor: e, stan } = window.seriodruk;
    const p = stan.projekt;
    e.canvas.getObjects().slice().forEach((o) => e.canvas.remove(o));
    e.prowadnice = [];
    Object.assign(p.widok, { siatka: false });
    e.ustawWidok(p.widok);
    p.tabele.push({ id: 't_dni', nazwa: 'Dni stycznia', kolumny: ['dzien', 'dzien_tygodnia', 'imieniny'], wiersze: [
      ['1', 'piątek', 'Mieczysława, Mieszka'], ['2', 'sobota', 'Izydora, Bazylego'], ['3', 'niedziela', 'Danuty, Genowefy'],
      ['4', 'poniedziałek', 'Anieli, Eugeniusza'], ['5', 'wtorek', 'Hanny, Szymona'], ['6', 'środa', 'Kacpra, Melchiora, Baltazara'],
    ] });
    p.serie.push({ id: 'se_dni', nazwa: 'Dni', tabela: 't_dni', tryb: 'tabela', uklad: 'szeroki', ile: 12 });
    p.strony[0].seria = 'se_dni';
    p.strony[0].nazwa = 'Dzień';
    const pt = (n) => n * 25.4 / 72;
    const naglowek = e.dodajProstokat(); naglowek.set({ left: -3, top: -3, width: 154, height: 58, fill: '#2f5bd3', strokeWidth: 0, bez_ostrzezen: true });
    const dzien = e.dodajTekst('{dzien}'); dzien.set({ left: 12, top: 10, width: 60, fontSize: pt(54), fontWeight: 'bold', fontFamily: 'Playfair Display', fill: '#ffffff' });
    const tydz = e.dodajTekst('{dzien_tygodnia}\nstycznia 2027'); tydz.set({ left: 74, top: 18, width: 64, fontSize: pt(13), fill: '#dbe4fb', textAlign: 'right' });
    const imie = e.dodajTekst('Imieniny: {imieniny}'); imie.set({ left: 12, top: 64, width: 124, fontSize: pt(10), fill: '#4a4843' });
    for (let y = 84; y <= 180; y += 12) { const l = e.dodajLinie(); l.set({ left: 12.2, top: y, width: 123.6, stroke: '#d9d4c7', strokeWidth: 0.25 }); }
    const stopka = e.dodajTekst('Planer 2027 · str. {nr} z {liczba_stron} · {pomylka}'); stopka.set({ left: 12, top: 192, width: 124, fontSize: pt(8), fill: '#807d75' });
    e.canvas.discardActiveObject();
    e.zatwierdz();
    await window.seriodruk.zapiszTeraz();
  });
  await d.reload();
  await d.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk);
  // Strona wczytuje się chwilę po otwarciu projektu (najpierw pobierają się jej czcionki).
  await d.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((o) => o.text?.startsWith('Imieniny')));
  await d.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.text?.startsWith('Imieniny')).id); });
  await d.waitForTimeout(700);
  await zrzut(d, 'pola.png');
  await kadr(d, 'k-wstaw-pole.png', { obszar: '#panel-inspektor fieldset:has(select.wstaw-pole)', zaznacz: '#panel-inspektor label:has(select.wstaw-pole)', margines: 8 });
  await d.evaluate(() => window.seriodruk.edytor.odznacz());
  await d.waitForTimeout(400);
  await kadr(d, 'k-seria.png', { obszar: '#panel-inspektor fieldset:has(> legend:has-text("Seria"))', zaznacz: '#panel-inspektor fieldset:has(> legend:has-text("Seria")) label:has-text("Seria")', margines: 8 });
  await d.click('[data-akcja="dane"]');
  await d.waitForSelector('#dlg-dane[open]');
  await zrzut(d, 'dane.png');
  await d.click('#dane-zamknij');
  await d.click('[data-akcja="podglad"]');
  await d.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await d.click('[data-akcja="podglad-minus"]');
  await d.click('[data-akcja="podglad-minus"]');
  await d.waitForTimeout(1800);
  await zrzut(d, 'serie.png');

  // Eksport do PDF: okno z listą rzeczy do sprawdzenia przed drukiem
  await d.click('[data-akcja="podglad-zamknij"]');
  await d.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  await d.click('#przycisk-wiecej');
  await d.click('[data-akcja="pdf"]');
  await d.waitForSelector('#dlg-pdf[open]');
  await d.evaluate(() => { document.querySelector('#pdf-uwagi').open = true; });
  await zrzut(d, 'pdf.png');
  await d.click('#pdf-anuluj');

  // Układ tekstu: kolumny (połączone ramki), listy i tabela
  await d.click('[data-akcja="strona-dodaj"]');
  await d.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await d.waitForTimeout(400);
  await d.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const pt = (n) => n * 25.4 / 72;
    const tytul = e.dodajTekst('Notatki do planera'); tytul.set({ left: 12, top: 12, width: 124, fontSize: pt(20), fontWeight: 'bold', fontFamily: 'Playfair Display' });
    const o = e.dodajTekst('Tekst w kolumnach płynie z ramki do ramki. Gdy w pierwszej zabraknie miejsca, dalszy ciąg pojawia się w następnej – tak jak w gazecie. Ramki można przesuwać i zmieniać ich wysokość, a tekst sam układa się od nowa. Formatowanie fragmentów wędruje razem z tekstem, a pola z danych działają jak zwykle.');
    o.set({ left: 12, top: 28, width: 124, fontSize: pt(9) }); o.initDimensions();
    e.canvas.setActiveObject(o);
    await e.podzielNaKolumny(3);
    const l = e.dodajTekst('Zakupy na sobotę\nChleb razowy na zakwasie, najlepiej jeszcze ciepły, z piekarni za rogiem\nMasło i ser\nJabłka');
    l.set({ left: 12, top: 76, width: 58, fontSize: pt(10), lista: 'numery' }); l.initDimensions();
    const p = e.dodajTekst('Podlać kwiaty na balkonie i w kuchni, zanim zrobi się gorąco\nOddać książki do biblioteki\nZadzwonić do babci');
    p.set({ left: 78, top: 76, width: 58, fontSize: pt(10), lista: 'punkty' }); p.initDimensions();
    // Tabela jest jednym elementem: przesuwamy ją całą, a teksty wpisujemy w jej komórki.
    const tabela = e.dodajTabele({ wiersze: 4, kolumny: 3 });
    const komorki = e.komorkiTabeli(tabela);
    tabela.set({ top: tabela.top + 40 });
    ['Dzień', 'Do zrobienia', 'Uwagi'].forEach((t, i) => komorki[i].set('text', t));
    ['Poniedziałek', 'Plan tygodnia', '', 'Wtorek', 'Zakupy', 'lista wyżej'].forEach((t, i) => komorki[3 + i].set('text', t));
    e.zatwierdz(); // układ tabeli po wpisaniu tekstów
    e.canvas.setActiveObject(e.canvas.getObjects().find((x) => x.watek_nr === 0));
    e.zatwierdz();
  });
  await d.waitForTimeout(500);
  await zrzut(d, 'uklad.png');

  // Wygląd z danych: zakładka na brzegu strony – kolor z kolumny, położenie z numeru powielenia
  await d.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    await window.seriodruk.zapiszTeraz();
    const t = p.tabele[0];
    t.kolumny.push('kolor');
    ['#d1495b', '#edae49', '#66a182', '#2e86ab', '#8d6a9f', '#00798c'].forEach((k, i) => t.wiersze[i].push(k));
    p.strony.splice(1); // sama strona dnia
    p.strony[0].obiekty.push({
      type: 'rect', version: '5.3.0', left: 136, top: 62, width: 15, height: 20, fill: '#999999', strokeWidth: 0, id: 'o_zakladka', nazwa: 'Zakładka', bez_ostrzezen: true,
      z_danych: { kolor: 'kolor', y: { pole: 'egzemplarz', tryb: 'pozycja', krok: 22, co: 6 } },
    });
    await window.seriodruk.przejdzDoStrony(0);
    await window.seriodruk.przeladuj();
    await window.seriodruk.zapiszTeraz();
  });
  await d.click('[data-akcja="podglad"]');
  await d.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await d.click('[data-akcja="podglad-minus"]');
  await d.click('[data-akcja="podglad-minus"]');
  await d.waitForTimeout(1800);
  await zrzut(d, 'zakladki.png');
  // Czcionki: plik w projekcie i czcionka z innego projektu („Moje czcionki”)
  await d.click('[data-akcja="podglad-zamknij"]');
  await d.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  await d.evaluate(async () => {
    const { oknoCzcionek } = window.seriodruk;
    const plik = async (adres, nazwa, typ) => new File([await (await fetch(adres)).arrayBuffer()], nazwa, { type: typ });
    const [pierwsza] = await oknoCzcionek.dodaj([await plik('css/czcionki/pdf/playfair-display-400-prosta.ttf', 'Ozdobna-Regular.ttf', 'font/ttf')]);
    await oknoCzcionek.zmienRodzine(pierwsza.id, 'Ozdobna');
    const [druga] = await oknoCzcionek.dodaj([await plik('css/czcionki/pdf/caveat-700-prosta.ttf', 'Pisanka-Bold.ttf', 'font/ttf')]);
    await oknoCzcionek.zmienRodzine(druga.id, 'Pisanka');
    await oknoCzcionek.usun(druga.id); // zostaje w „Moich czcionkach”
  });
  await d.waitForTimeout(600);
  await d.click('#przycisk-wiecej');
  await d.click('[data-akcja="czcionki"]');
  await d.waitForSelector('#czcionki-moje li');
  await zrzut(d, 'czcionki.png');
  await d.click('#czcionki-zamknij');

  // Obrazy projektu: trzy wgrane obrazy, jeden wstawiony na stronę, jeden nieużywany
  await d.evaluate(async () => {
    const obraz = (nazwa, a, b, typ = 'image/jpeg') => new Promise((ok) => {
      const c = document.createElement('canvas');
      c.width = 1200; c.height = 800;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 1200, 800);
      g.addColorStop(0, a); g.addColorStop(1, b);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1200, 800);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(860, 300, 170, 0, Math.PI * 2); ctx.fill();
      c.toBlob((blob) => ok(new File([blob], nazwa, { type: typ })), typ, 0.9);
    });
    const { wgrajObrazy } = await import('./js/app/obrazy-okno.js');
    await wgrajObrazy([await obraz('gory-zima.jpg', '#1e3a8a', '#93c5fd'), await obraz('laka-wiosna.jpg', '#166534', '#fde68a'), await obraz('morze.jpg', '#0e7490', '#f0abfc')]);
    const p = window.seriodruk.stan.projekt;
    const id = Object.keys(p.zasoby).find((k) => p.zasoby[k].nazwa === 'gory-zima.jpg');
    const img = await window.seriodruk.edytor.dodajObraz(null, 'gory-zima.jpg', p.zasoby, { id });
    img.set({ left: 14, top: 40 }); img.setCoords();
    window.seriodruk.edytor.canvas.discardActiveObject();
    window.seriodruk.edytor.zatwierdz();
  });
  await d.waitForTimeout(600);
  await d.click('#przycisk-wiecej');
  await d.click('[data-akcja="obrazy"]');
  await d.waitForSelector('#dlg-obrazy[open]');
  await d.waitForFunction(() => [...document.querySelectorAll('#obrazy-lista .obraz-wymiary')].every((e) => /px/.test(e.textContent)));
  // Dwa zaznaczone obrazy: pasek z „Kopiuj nazwy” i „Usuń”.
  await d.locator('#obrazy-lista li').nth(1).locator('.obraz-miniatura').click();
  await d.locator('#obrazy-lista li').nth(2).locator('.obraz-miniatura').click({ modifiers: ['Control'] });
  await d.mouse.move(5, 5);
  await zrzut(d, 'obrazy-projektu.png');
  await d.click('#obrazy-zamknij');
  // Obraz wstawiony tylko do zrzutu znika – dalsze zrzuty mają stronę jak dotąd.
  await d.evaluate(() => {
    const e = window.seriodruk.edytor;
    const o = e.canvas.getObjects().find((x) => x.type === 'image' && x.nazwa === 'gory-zima.jpg');
    if (o) { e.canvas.setActiveObject(o); e.usun(); }
  });

  // Sprawdź przed drukiem: nieznane pole i tekst, który nie mieści się w ramce
  await d.evaluate(() => {
    const e = window.seriodruk.edytor;
    const a = e.dodajTekst('Hasło dnia: {haslo_dnia}'); a.set({ left: 12, top: 150, width: 80 }); a.initDimensions();
    const b = e.dodajTekst('Ten tekst jest za długi na swoją ramkę i w druku zostałby ucięty na dolnej krawędzi.'); b.set({ left: 12, top: 165, width: 60, ramka_h: 8 }); b.initDimensions();
    e.canvas.discardActiveObject();
    e.zatwierdz();
  });
  await d.click('#przycisk-wiecej');
  await d.click('[data-akcja="kontrola"]');
  await d.waitForSelector('#dlg-kontrola[open]');
  await d.waitForTimeout(2500);
  await zrzut(d, 'kontrola.png');
  await d.click('#kontrola-zamknij');

  // Dostęp dla AI: klucz konta z wybranym projektem – zakres, adres łącznika i kroki dla Claude i ChatGPT
  // Okno jest w ustawieniach konta (#100) – otwierane wprost, z wybranym otwartym projektem.
  await d.evaluate(async () => {
    const id = window.seriodruk.stan.projekt?.id;
    await (await import('./js/app/dostep-ai.js')).otworzDostepAi({ projektId: id });
  });
  await d.waitForSelector('#dlg-dostep-ai[open]');
  await d.fill('#dostep-ai-opis', 'Claude – poprawki kalendarza');
  await d.click('[data-akcja="dostep-ai-utworz"]');
  await d.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  // Zrzut pokazuje adres prawdziwej bazy, nie atrapy, z której korzysta skrypt.
  await d.evaluate(() => { const p = document.querySelector('#dostep-ai-adres'); p.value = p.value.replace('https://atrapa.supabase.co/functions/v1/mcp/', 'https://api.makietka.app/mcp/'); p.setSelectionRange(0, 0); p.scrollLeft = 0; });
  await zrzut(d, 'dostep-ai.png');
  await d.click('[data-akcja="dostep-ai-zamknij"]');

  // Współpraca: osoba z dostępem (Bartek edytuje) i świeże zaproszenie dla Oli z linkiem.
  const bartek = { id: '66666666-6666-4666-8666-666666666666', email: 'bartek.lis@przyklad.pl', haslo: 'Dobre#Haslo6', potwierdzone: true, nazwa: 'Bartek Lis' };
  bazakp.konta.push(bartek);
  const idPlanera = await d.evaluate(() => window.seriodruk.stan.projekt.id);
  bazakp.wspolpracownicy.push({ projekt_id: idPlanera, uzytkownik: bartek.id, rola: 'edycja', zaprosil: bazakp.konta[0].id, dodano: new Date().toISOString() });
  await d.click('#przycisk-wiecej');
  await d.click('[data-akcja="wspolpraca"]');
  await d.waitForSelector('#dlg-wspolpraca[open] #form-zaproszenia:not([hidden])');
  await d.fill('#wspolpraca-email', 'ola.nowak@przyklad.pl');
  await d.click('#wspolpraca-zapros');
  await d.waitForSelector('#wspolpraca-gotowe:not([hidden])');
  await d.waitForFunction(() => document.querySelectorAll('#wspolpraca-osoby li.osoba').length === 3);
  await d.waitForTimeout(600);
  // Zrzut pokazuje adres aplikacji, nie serwera, z którego korzysta skrypt.
  await d.evaluate(() => { const p = document.querySelector('#wspolpraca-link'); p.value = p.value.replace(`${location.origin}${location.pathname}`, 'https://makietka.app/'); p.scrollLeft = 0; });
  await zrzut(d, 'wspolpraca.png');
  await d.click('[data-akcja="wspolpraca-zamknij"]');

  // Pusta strona pod kolejne zrzuty: bez serii, bez elementów.
  const pustaStrona = () => d.evaluate(() => {
    const { edytor: e, stan } = window.seriodruk;
    delete stan.projekt.strony[0].seria;
    e.canvas.getObjects().filter((o) => !o.zWzorca).forEach((o) => e.canvas.remove(o));
    e.canvas.discardActiveObject();
    e.zatwierdz();
  });
  const doSekcjiPanelu = (tekst) => d.evaluate((t) => {
    const el = [...document.querySelectorAll('#wlasciwosci *')].filter((x) => x.textContent.includes(t)).pop();
    el?.scrollIntoView({ block: 'center' });
  }, tekst);

  // Ramka tekstu o stałej wysokości
  await pustaStrona();
  await d.evaluate(() => {
    const e = window.seriodruk.edytor;
    const pt = (n) => n * 25.4 / 72;
    const tlo = e.dodajProstokat(); tlo.set({ left: 12, top: 40, width: 124, height: 46, fill: '#eef2fb', stroke: '#2f5bd3', strokeWidth: 0.3 });
    const tytul = e.dodajTekst('Imieniny'); tytul.set({ left: 16, top: 44, width: 116, fontSize: pt(11), fontWeight: 'bold', fill: '#2f5bd3' });
    const t = e.dodajTekst('Kacpra, Melchiora, Baltazara, Andrzeja, Bolemira, Epifanii, Karola, Miłowita, Norberta'); t.set({ left: 16, top: 52, width: 116, fontSize: pt(16), fontFamily: 'Lora', ramka_h: 30, wyrownanie_pion: 'dol', autodopasowanie: true, rozmiar_bazowy: pt(16), min_rozmiar: 9 });
    t.initDimensions();
    e.zatwierdz();
    e.odznacz();
    e.zaznacz(t.id);
  });
  await d.waitForTimeout(700);
  await doSekcjiPanelu('Stała wysokość ramki');
  await d.waitForTimeout(200);
  await zrzut(d, 'ramka-tekstu.png');

  // Tabela: tło nagłówka, co drugi wiersz, scalona komórka
  await pustaStrona();
  await d.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const { komorkiTabeli, scalKomorki, ustawTloTabeli, ulozTabele } = await import('./js/tabela-obiekt.js');
    const g = e.dodajTabele({ wiersze: 6, kolumny: 4 });
    const tresc = [
      ['Dzień', 'Rano', 'Po południu', 'Uwagi'],
      ['Poniedziałek', 'Basen', 'Angielski', 'Strój i czepek'],
      ['Wtorek', 'Wycieczka do muzeum', '', 'Zbiórka 8.15'],
      ['Środa', 'Plastyka', 'Szachy', ''],
      ['Czwartek', 'Basen', 'Chór', ''],
      ['Piątek', 'Biblioteka', 'Zajęcia sportowe', 'Zwrot książek'],
    ];
    komorkiTabeli(g).forEach((c, i) => c.set('text', tresc[Math.floor(i / 4)][i % 4]));
    scalKomorki(g, 2, 1, 'prawo');
    ustawTloTabeli(g, { naglowek: '#dbe4fb', zebra: '#f4f1ea' });
    ulozTabele(g);
    g.set({ top: 40 });
    g.setCoords();
    e.zatwierdz();
    e.odznacz();
    e.zaznacz(g.id);
    document.querySelector('#wlasciwosci').firstElementChild?.scrollIntoView({ block: 'start' });
  });
  await d.waitForTimeout(700);
  await zrzut(d, 'tabela.png');
  // Tabela (#115): „Cała tabela” i „Kolumna i wiersz” po wybraniu komórki pojedynczym kliknięciem.
  await kadr(d, 'k-tabela-cala.png', { obszar: '#panel-inspektor fieldset:has(> legend:has-text("Cała tabela"))', margines: 8 });
  await d.evaluate(() => { const e = window.seriodruk.edytor; const g = e.canvas.getActiveObject(); e._wybierzKomorke(g, { k: 1, w: 2 }); });
  await d.waitForTimeout(500);
  await kadr(d, 'k-tabela-komorka.png', { obszar: '#panel-inspektor fieldset.kolumna-i-wiersz', margines: 8 });
  // Ustawienia narzędzia: rysowanie odręczne (#115).
  await d.evaluate(() => window.seriodruk.edytor.odznacz());
  await d.click('[data-akcja="rysuj"]');
  await d.waitForTimeout(400);
  await kadr(d, 'k-rysowanie.png', { obszar: ['#panel-inspektor .naglowek-panelu', '#panel-inspektor fieldset:has(> legend:has-text("Pędzel"))'], margines: 8 });
  await d.keyboard.press('Escape');

  // Skład akapitu (#131): dzielenie wyrazów i inicjał, tabulatory z kropkami, tekst opływający koło.
  await pustaStrona();
  await d.evaluate(async () => {
    const e = window.seriodruk.edytor;
    await (await import('./js/dzielenie.js')).zaladujDzielenie();
    const a = e.dodajTekst('Przedsiębiorstwo poligraficzne przygotowało niezapominajkowe kalendarze z przepięknymi ilustracjami i kolorowymi zakładkami dla wszystkich czytelników w całym kraju. Każdy miesiąc ma osobną stronę z miejscem na notatki.');
    a.set({ left: 16, top: 16, width: 70, textAlign: 'justify', dziel_wyrazy: true, inicjal: 3, inicjal_kolor: '#b45309', inicjal_czcionka: 'Playfair Display' });
    e.doczytajCzcionke('Playfair Display');
    const b = e.dodajTekst('Styczeń\t12\nLuty\t7\nMarzec\t123\nKwiecień\t45');
    b.set({ left: 16, top: 80, width: 70, tabulatory: [{ poz: 68, rodzaj: 'prawy', wypelniacz: '.' }] });
    const c = e.dodajTekst('Tekst opływa zdjęcie dookoła. '.repeat(12));
    c.set({ left: 16, top: 112, width: 116, textAlign: 'justify', dziel_wyrazy: true });
    const k = e.dodajElipse();
    k.set({ left: 76, top: 120, rx: 18, ry: 18, width: 36, height: 36, fill: '#f6d8b8', oblewanie: 'ksztalt', oblewanie_odstep: 2 });
    k.setCoords();
    e.ulozSkladStrony({ teraz: true });
    e.zatwierdz();
    e.odznacz();
    e.zaznacz(a.id);
  });
  await d.waitForTimeout(900);
  await d.evaluate(() => { const f = [...document.querySelectorAll('#panel-inspektor fieldset')].find((x) => /Skład akapitu/.test(x.querySelector('legend')?.textContent || '')); f?.classList.remove('zwinieta'); f?.scrollIntoView({ block: 'start' }); });
  await d.waitForTimeout(300);
  await kadr(d, 'k-sklad-akapitu.png', { obszar: ['#panel-inspektor fieldset:has(> legend:has-text("Skład akapitu"))'], margines: 8 });
  await d.evaluate(() => { window.seriodruk.edytor.odznacz(); });
  await d.waitForTimeout(400);
  await zrzut(d, 'sklad.png');
  await d.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.tabulatory).id); });
  await d.waitForTimeout(400);
  await kadr(d, 'k-tabulatory.png', { obszar: ['#panel-inspektor .wiersz-tabulatora'], margines: 8 });
  await d.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.oblewanie).id); });
  await d.waitForTimeout(400);
  await d.evaluate(() => { const f = [...document.querySelectorAll('#panel-inspektor fieldset')].find((x) => /Inne/.test(x.querySelector('legend')?.textContent || '')); f?.classList.remove('zwinieta'); f?.scrollIntoView({ block: 'start' }); });
  await d.waitForTimeout(300);
  await kadr(d, 'k-oblewanie.png', { obszar: ['#panel-inspektor label:has-text("Oblewanie tekstem")'], margines: 10 });

  // Kształt tekstu (#131B): łuk, okrąg i fala; panel „Kształt tekstu” zaznaczonego łuku.
  await pustaStrona();
  await d.evaluate(() => {
    const e = window.seriodruk.edytor;
    const x0 = e.strony[e.aktywna].x;
    const a = e.dodajTekstWKsztalcie('MAKIETKA • NAPIS PO ŁUKU', { rodzaj: 'luk', zgiecie: 55 }, null, { rozmiarPt: 18 });
    a.set({ left: x0 + 22, top: 22, fill: '#1c2541' }); a.setCoords();
    const b = e.dodajTekstWKsztalcie('PIECZĘĆ • MAKIETKA • 2027 •', { rodzaj: 'okrag', strona: 'zewn' }, null, { rozmiarPt: 12 });
    b.set({ left: x0 + 44, top: 72, fill: '#b3263c' }); b.setCoords();
    const c = e.dodajTekstWKsztalcie('FALUJĄCY BANER', { rodzaj: 'fala', zgiecie: 60 }, null, { rozmiarPt: 22 });
    c.set({ left: x0 + 22, top: 150, fill: '#2563eb' }); c.setCoords();
    e.zatwierdz();
    e.canvas.discardActiveObject();
    e.zaznacz(a.id);
  });
  await d.waitForTimeout(600);
  await d.evaluate(() => { const f = [...document.querySelectorAll('#panel-inspektor fieldset')].find((x) => /Kształt tekstu/.test(x.querySelector('legend')?.textContent || '')); f?.classList.remove('zwinieta'); f?.scrollIntoView({ block: 'start' }); });
  await d.waitForTimeout(300);
  await kadr(d, 'k-ksztalt-tekstu.png', { obszar: ['.arkusz', '#panel-inspektor fieldset:has(> legend:has-text("Kształt tekstu"))'], margines: 8 }).catch((err) => console.error('pominięto k-ksztalt-tekstu:', err.message));

  // Pióro: kształt z łukami w trakcie edycji punktów
  await pustaStrona();
  await d.evaluate(() => {
    const e = window.seriodruk.edytor;
    const k = new fabric.Path('M 30 120 C 30 80 60 60 75 85 C 90 60 120 80 120 120 C 120 150 90 165 75 180 C 60 165 30 150 30 120 Z', { fill: '#f6c9d0', stroke: '#b3263c', strokeWidth: 0.8, strokeUniform: true });
    e._wstaw(k);
    e.zatwierdz();
    e.edytujPunkty(k);
  });
  // Kliknięty punkt pokazuje uchwyty łuków.
  const punkt = await d.evaluate(() => {
    const c = window.seriodruk.edytor.canvas;
    const v = c.viewportTransform;
    const r = c.upperCanvasEl.getBoundingClientRect();
    return [r.left + 120 * v[0] + v[4], r.top + 120 * v[3] + v[5]];
  });
  await d.mouse.click(...punkt);
  await d.evaluate(() => { document.querySelector('#powiadomienie').hidden = true; });
  await d.waitForTimeout(500);
  await zrzut(d, 'pioro.png', { clip: { x: 236, y: 56, width: 744, height: 620 } });
  await d.keyboard.press('Escape');

  // Rysunek SVG: jako obraz i po rozłożeniu na elementy
  await pustaStrona();
  await d.evaluate(async () => {
    const { edytor: e, stan } = window.seriodruk;
    const { rozlozRysunek } = await import('./js/svg-elementy.js');
    const kod = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240">
      <rect width="480" height="240" rx="18" fill="#fff8e1"/>
      <circle cx="90" cy="120" r="56" fill="#ffb703"/>
      <path d="M40 190 C 120 130, 200 230, 290 170 S 420 150, 450 190" fill="none" stroke="#219ebc" stroke-width="10" stroke-linecap="round"/>
      <polygon points="410,36 456,104 364,104" fill="#8ecae6" stroke="#023047" stroke-width="4"/>
      <text x="170" y="92" font-family="Playfair Display" font-size="40" font-weight="bold" fill="#023047">Wakacje</text>
      <text x="172" y="128" font-family="Lora" font-size="20" fill="#5c4b00">nad jeziorem</text>
    </svg>`;
    const adres = `data:image/svg+xml;base64,${btoa(kod)}`;
    const a = await e.dodajObraz(adres, 'wakacje.svg', stan.projekt.zasoby);
    a.set({ left: 14, top: 22, scaleX: 0.25, scaleY: 0.25 }); a.setCoords();
    const b = await e.dodajObraz(adres, 'wakacje.svg', stan.projekt.zasoby);
    b.set({ left: 14, top: 100, scaleX: 0.25, scaleY: 0.25 }); b.setCoords();
    const w = await rozlozRysunek(stan.projekt, b);
    e.zastapObiekt(b, w.grupa);
    e.rozgrupuj();
    const kolo = e.canvas.getObjects().find((o) => o.type === 'ellipse');
    kolo.set('fill', '#fb8500');
    const napis = e.canvas.getObjects().find((o) => o.type === 'textbox' && o.text === 'Wakacje');
    e.canvas.discardActiveObject();
    e.zatwierdz();
    e.zaznacz(napis.id);
    document.querySelector('#powiadomienie').hidden = true;
  });
  await d.waitForTimeout(700);
  await zrzut(d, 'rysunek-svg.png');

  // ---------- Obraz w kształcie, filtry, usuwanie tła, krycie w przejściu (#123) ----------
  await pustaStrona();
  await d.evaluate(async () => {
    const { edytor: e, stan } = window.seriodruk;
    const id = Object.keys(stan.projekt.zasoby).find((k) => stan.projekt.zasoby[k].nazwa === 'gory-zima.jpg');
    const k = e.dodajProstokat();
    k.set({ left: 24, top: 40, width: 100, height: 70, rx: 12, ry: 12, fill: '#ffffff', stroke: '#2f5bd3', strokeWidth: 1.2 });
    k.setCoords();
    e.zatwierdz();
    await e.wstawObrazDoKsztaltu(k, id);
    k.set('filtry', { jasnosc: 10, kontrast: 15, nasycenie: 20, szarosc: false, sepia: false, rozmycie: 0 });
    e.zatwierdz();
    e.odznacz();
    e.zaznacz(k.id);
  });
  await d.waitForTimeout(1500);
  await doSekcjiPanelu('Obraz w kształcie');
  await kadr(d, 'k-obraz-w-ksztalcie.png', { obszar: ['#plotno', '#panel-inspektor fieldset:has(> legend:has-text("Obraz w kształcie"))'], margines: 8 });
  await doSekcjiPanelu('Filtry');
  await kadr(d, 'k-filtry.png', { obszar: '#panel-inspektor fieldset:has(> legend:has-text("Filtry"))', margines: 8 });
  await d.evaluate(() => { const e = window.seriodruk.edytor; e.kadrujWKsztalcie(e.canvas.getActiveObject()); });
  await d.waitForTimeout(600);
  await zrzut(d, 'obraz-w-ksztalcie-kadr.png', { clip: { x: 236, y: 56, width: 744, height: 620 } });
  await d.keyboard.press('Enter');
  await d.waitForTimeout(300);
  // Usuń tło – okno z różdżką na zdjęciu.
  await d.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const { otworzUsuwanieTla } = await import('./js/app/usun-tlo.js');
    otworzUsuwanieTla(e.canvas.getActiveObject());
  });
  await d.waitForSelector('#dlg-usun-tlo[open]');
  await d.waitForTimeout(1200);
  await zrzut(d, 'usun-tlo.png');
  await d.keyboard.press('Escape');
  await d.waitForFunction(() => !document.querySelector('#dlg-usun-tlo').open);
  // Przejście kolorów z kryciem: prostokąt z błękitu w przezroczystość.
  await pustaStrona();
  await d.evaluate(() => {
    const e = window.seriodruk.edytor;
    const r = e.dodajProstokat();
    r.set({ left: 14, top: 30, width: 120, height: 80, strokeWidth: 0,
      fill: new fabric.Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 0, y2: 1 },
        colorStops: [{ offset: 0, color: '#2f5bd3' }, { offset: 1, color: 'rgba(47,91,211,0)' }] }) });
    r.setCoords();
    e.zatwierdz();
    e.odznacz();
    e.zaznacz(r.id);
  });
  await d.waitForTimeout(400);
  await d.evaluate(() => {
    const l = [...document.querySelectorAll('#wlasciwosci label')].find((x) => /^Wypełnienie/.test(x.textContent));
    l?.scrollIntoView({ block: 'start' });
  });
  await d.waitForTimeout(300);
  await kadr(d, 'k-krycie-przejscia.png', { obszar: ['#panel-inspektor label:has-text("Kolor 1")', '#panel-inspektor label:has-text("Kolor 2")', '#panel-inspektor label:has-text("Krycie") >> nth=1'], zaznacz: '#panel-inspektor label:has-text("Krycie") >> nth=1', margines: 12 }).catch((err) => console.error('pominięto k-krycie-przejscia:', err.message));

  // ---------- Kolory do druku: kolory dodatkowe, uszlachetnienia (#127) ----------
  await pustaStrona();
  await d.evaluate(() => {
    const { stan, edytor: e } = window.seriodruk;
    stan.projekt.kolory_dodatkowe = [{ id: 'kd186', nazwa: 'PANTONE 186 C', cmyk: [0, 100, 81, 4] }, { id: 'kd871', nazwa: 'PANTONE 871 C', cmyk: [20, 25, 60, 25] }];
    const r = e.dodajProstokat();
    r.set({ left: 20, top: 30, width: 108, height: 40, rx: 3, ry: 3, strokeWidth: 0, fill: '#1c2541', uszlachetnienie: 'folia', folia: 'zloto' });
    r.setCoords();
    e.zatwierdz();
    e.odznacz();
    e.zaznacz(r.id);
  });
  await d.waitForTimeout(400);
  await d.click('#przycisk-wiecej');
  await d.click('#menu-wiecej [data-akcja="kolory-druku"]');
  await d.waitForSelector('#dlg-kolory-druku[open]');
  await d.waitForTimeout(300);
  await kadr(d, 'k-kolory-druku.png', { obszar: '#dlg-kolory-druku .formularz', margines: 0 }).catch((err) => console.error('pominięto k-kolory-druku:', err.message));
  await d.click('#dlg-kolory-druku .przyciski-dialogu [data-akcja="kolory-druku-zamknij"]');
  await d.waitForTimeout(300);
  await d.evaluate(() => [...document.querySelectorAll('#wlasciwosci legend button.zwijak')].find((b) => b.textContent === 'Uszlachetnienie')?.scrollIntoView({ block: 'start' }));
  await d.waitForTimeout(300);
  await kadr(d, 'k-uszlachetnienie.png', { obszar: '#panel-inspektor fieldset:has(> legend:has-text("Uszlachetnienie"))', margines: 8 }).catch((err) => console.error('pominięto k-uszlachetnienie:', err.message));
  await d.evaluate(() => document.querySelector('#wlasciwosci')?.scrollTo?.(0, 0));
  try {
    await d.locator('#wlasciwosci .kolor-przycisk').first().scrollIntoViewIfNeeded();
    await d.click('#wlasciwosci .kolor-przycisk >> nth=0');
    await d.waitForSelector('.kolor-okienko .kolor-dodatkowe:not([hidden])', { timeout: 5000 });
    await d.waitForTimeout(300);
    await kadr(d, 'k-kolor-dodatkowy.png', { obszar: '.kolor-okienko', zaznacz: '.kolor-okienko .kolor-dodatkowe', margines: 8 });
  } catch (err) { console.error('pominięto k-kolor-dodatkowy:', err.message); }
  await d.keyboard.press('Escape');
  await d.waitForTimeout(300);
  await d.evaluate(() => { window.seriodruk.stan.projekt.kolory_dodatkowe = undefined; });
  // ---------- Biblioteka: kalendarz miesiąca, wykres (#131A) ----------
  await pustaStrona();
  await d.evaluate(() => {
    const { stan } = window.seriodruk;
    if (!stan.projekt.tabele.some((t) => t.id === 't_wykres')) {
      stan.projekt.tabele.push({ id: 't_wykres', nazwa: 'Sprzedaż', kolumny: ['miesiac', 'sklep', 'internet'], wiersze: [['styczeń', '12', '5'], ['luty', '15,5', '8'], ['marzec', '9', '11'], ['kwiecień', '14', '13']] });
    }
  });
  await d.click('[data-akcja="biblioteka"]');
  await d.waitForSelector('#dlg-biblioteka[open]');
  await d.click('#kategorie-biblioteki [data-kategoria="strzalki"]');
  await d.waitForTimeout(300);
  // k-biblioteka.png robi scripts/zrzuty-biblioteki.cjs (na końcu, #143).
  await d.click('#biblioteka-zamknij');
  await d.evaluate(() => {
    const e = window.seriodruk.edytor;
    const k = e.dodajKalendarz({ rok: 2027, miesiac: 5, nazwy_swiat: true });
    e.odznacz();
    e.zaznacz(k.id);
  });
  await d.waitForTimeout(500);
  await kadr(d, 'k-kalendarz.png', { obszar: ['.arkusz', '#panel-inspektor fieldset:has(> legend:has-text("Kalendarz"))'], margines: 8 }).catch((err) => console.error('pominięto k-kalendarz:', err.message));
  await pustaStrona();
  await d.evaluate(() => {
    const e = window.seriodruk.edytor;
    const w = e.dodajWykres({ tabela: 't_wykres', etykiety: 'miesiac', wartosci: ['sklep', 'internet'], tytul: 'Sprzedaż' });
    e.odznacz();
    e.zaznacz(w.id);
  });
  await d.waitForTimeout(500);
  await kadr(d, 'k-wykres.png', { obszar: ['.arkusz', '#panel-inspektor fieldset:has(> legend:has-text("Wykres"))'], margines: 8 }).catch((err) => console.error('pominięto k-wykres:', err.message));

  // ---------- Okładka z grzbietem i składki (#119, #120) ----------
  await d.evaluate(async () => {
    const { stan } = window.seriodruk;
    const P = await import('./js/projekt.js');
    const O = await import('./js/okladka.js');
    const p = stan.projekt;
    const srodek = p.sekcje.find((x) => !x.okladka);
    srodek.skladka = 16;
    const ok = P.nowaSekcja('Okładka', { ...srodek.wydruk });
    ok.okladka = { ...O.domyslnaOkladka(), oprawa: 'twarda', strony: { tryb: 'reczne', liczba: 240 } };
    p.sekcje.unshift(ok);
    const strona = P.nowaStrona('Okładka', ok.id);
    strona.tlo = '#1c2541';
    p.strony.unshift(strona);
    O.przeliczOkladki(p);
    const w = ok.okladka.wynik;
    const fabricTekst = (text, extra) => ({ type: 'textbox', id: `t${Math.random().toString(36).slice(2, 8)}`, text, fontFamily: 'Inter', fill: '#e9c46a', ...extra });
    const gz = (w.strefy || []).find((z) => z.rodzaj === 'grzbiet');
    const srodekGrzbietu = gz ? (gz.x1 + gz.x2) / 2 : w.szerokosc / 2;
    strona.obiekty = [
      fabricTekst('DZIENNIK 2027', { left: w.szerokosc * 0.62, top: w.wysokosc * 0.3, width: 90, fontSize: 9, textAlign: 'center', fontWeight: 'bold' }),
      fabricTekst('DZIENNIK · 2027', { left: srodekGrzbietu, top: w.wysokosc / 2, width: 120, fontSize: 6, textAlign: 'center', angle: 90, originX: 'center', originY: 'center', okladka: 'grzbiet' }),
    ];
    const { otworzProjekt } = await import('./js/app/zapis.js');
    await otworzProjekt(p, { strona: strona.id });
  });
  await d.waitForTimeout(1200);
  await zrzut(d, 'okladka.png', { clip: { x: 236, y: 56, width: 744, height: 620 } });
  await d.evaluate(() => {
    const e = window.seriodruk.edytor;
    const t = e.canvas.getObjects().find((o) => o.text === 'DZIENNIK 2027');
    e.zaznacz(t.id);
  });
  await d.waitForTimeout(500);
  await d.evaluate(() => {
    const l = [...document.querySelectorAll('#wlasciwosci label')].find((x) => /Na okładce trzyma się/.test(x.textContent));
    const f = l?.closest('fieldset.zwinieta');
    if (f) f.querySelector('legend .zwijak')?.click();
    l?.scrollIntoView({ block: 'center' });
  });
  await d.waitForTimeout(300);
  await kadr(d, 'k-okladka-przypiecie.png', { obszar: '#panel-inspektor fieldset:has(> legend:has-text("Inne"))', zaznacz: '#panel-inspektor label:has-text("Na okładce trzyma się") .wybor-przycisk', margines: 8 });
  await d.evaluate(() => window.seriodruk.edytor.odznacz());
  await kadr(d, 'k-skladki.png', { obszar: '#lista-stron .sekcja-listy:has(.skladka-sekcji)', zaznacz: '#lista-stron .skladka-sekcji button', margines: 8 });
  await d.evaluate(async () => {
    const { otworzUstawieniaSekcji } = await import('./js/app/sekcje.js');
    otworzUstawieniaSekcji(window.seriodruk.stan.projekt.sekcje[0].id);
  });
  await d.waitForSelector('#dlg-sekcja[open]');
  await d.mouse.move(2, 2);
  await d.waitForTimeout(600);
  await kadr(d, 'k-okladka-okno.png', { obszar: ['#pole-rodzaj-sekcji', '#sekcja-okladka'], zaznacz: '#pole-rodzaj-sekcji label:has-text("Okładka z grzbietem")', margines: 10 });
  // Wymiary okładki wpisane ręcznie (#125): grzbiet od drukarni.
  await d.click('#sekcja-okladka label:has-text("Wpisz grzbiet")');
  await d.fill('#dlg-sekcja input[name=ok_grzbiet]', '8');
  await d.waitForTimeout(400);
  await kadr(d, 'k-okladka-wymiary.png', { obszar: ['#wynik-okladki', '#ok-liczone'], zaznacz: ['#sekcja-okladka label:has-text("Wpisz grzbiet")', '#pole-ok-grzbiet'], margines: 10 });
  await d.keyboard.press('Escape');
  // Kod QR (#128): element i jego część „Kod” w panelu.
  await d.waitForTimeout(400);
  await d.evaluate(async () => {
    const { stan, przejdzDoStrony, edytor } = window.seriodruk;
    const i = stan.projekt.strony.findIndex((x) => !stan.projekt.sekcje.find((s) => s.id === x.sekcja)?.okladka);
    await przejdzDoStrony(Math.max(0, i));
    edytor.dodajKod('qr', { typ: 'adres', dane: { adres: 'https://makietka.app' }, tresc: 'https://makietka.app', szerokosc: 30 });
  });
  await d.waitForTimeout(600);
  await kadr(d, 'k-kod.png', { obszar: '#panel-inspektor fieldset:has(> legend:has-text("Kod"))', zaznacz: '#panel-inspektor label:has-text("Co zawiera") .wybor-przycisk', margines: 8 });
  await kp.close();

  // ---------- Telefon ----------
  const tel = await przegladarka.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block', ...MOTYW });
  const bazatel = await podlaczAtrape(tel);
  const t = await tel.newPage();
  await t.goto(ADRES);
  await zaloguj(t, bazatel);
  await przykladoweProjekty(t);
  await t.evaluate(() => window.seriodruk.przejdzDoStrony(window.seriodruk.stan.projekt.strony.findIndex((x) => x.nazwa === 'Styczeń')));
  await t.waitForTimeout(800);
  await t.evaluate(() => {
    const { edytor } = window.seriodruk;
    const o = edytor.canvas.getObjects().find((x) => x.text === 'Styczeń');
    edytor.canvas.setActiveObject(o);
    edytor.canvas.requestRenderAll();
  });
  await t.tap('.zakladki-mobilne [data-panel="inspektor"]');
  await t.waitForTimeout(500);
  await zrzut(t, 'telefon.png');
  // Okno na telefonie jako zasłonka od dołu (js/zaslonki.js).
  await t.tap('.zakladki-mobilne [data-panel="inspektor"]');
  await t.waitForTimeout(400);
  await t.click('#przycisk-wiecej');
  await t.click('#menu-wiecej [data-akcja="pdf"]');
  await t.waitForSelector('#dlg-pdf[open]');
  await t.waitForFunction(() => !document.querySelector('#dlg-pdf').classList.contains('zaslonka-wjazd'));
  await zrzut(t, 'telefon-zaslonka.png');
  await t.keyboard.press('Escape');
  await t.waitForTimeout(400);
  // Pasek stron na telefonie (#117).
  await t.tap('.zakladki-mobilne [data-panel="strony"]');
  await t.waitForTimeout(600);
  await t.evaluate(() => { document.querySelector('#lista-stron').scrollLeft = 0; });
  await t.waitForTimeout(300);
  await kadr(t, 'k-strony-telefon.png', { obszar: '#panel-strony', margines: 0 });
  await tel.close();

  // Książka (#131B): spis treści, przypisy, żywa pagina – osobny projekt na atrapie konta.
  await require('./zrzuty-ksiazki.cjs').zrobZrzutyKsiazki(kadr, { ciemny: CIEMNY }).catch((err) => console.error('pominięto zrzuty książki:', err.message));
  // Narzędzia pracy (#131C, #136): znajdź i zamień, malarz, moje elementy, pisownia, użyte w projekcie.
  await require('./zrzuty-pracy.cjs').zrobZrzutyPracy(kadr, { ciemny: CIEMNY }).catch((err) => console.error('pominięto zrzuty narzędzi pracy:', err.message));
  // Druk (#131C): układ arkuszy w oknie eksportu, podgląd separacji.
  await require('./zrzuty-druku.cjs').zrobZrzutyDruku(kadr, { ciemny: CIEMNY }).catch((err) => console.error('pominięto zrzuty druku:', err.message));
  // Partia D (#131D): zmiana formatu, zestaw marki, makieta 3D.
  await require('./zrzuty-partii-d.cjs').zrobZrzutyPartiiD(kadr, { ciemny: CIEMNY }).catch((err) => console.error('pominięto zrzuty partii D:', err.message));

  // Komentarze na stronach (#131D): narzędzie, licznik, pinezki, panel z wątkiem.
  await require('./zrzuty-komentarzy.cjs').zrobZrzutyKomentarzy(kadr, { ciemny: CIEMNY }).catch((err) => console.error('pominięto zrzuty komentarzy:', err.message));
  // Biblioteka (#143): okno z kategoriami i kategoria „Planer”.
  await require('./zrzuty-biblioteki.cjs').zrobZrzutyBiblioteki(kadr, { ciemny: CIEMNY }).catch((err) => console.error('pominięto zrzuty biblioteki:', err.message));
  await require('./zrzuty-paska-telefonu.cjs').zrobZrzutPaskaTelefonu(kadr, { ciemny: CIEMNY }).catch((err) => console.error('pominięto zrzut paska telefonu:', err.message));
  await require('./zrzuty-obramowania.cjs').zrobZrzutObramowania(kadr, { ciemny: CIEMNY }).catch((err) => console.error('pominięto zrzut obramowania:', err.message));
  // Wzorce stron (#164): wyjaśnienie i galeria gotowych wzorców.
  await require('./zrzuty-wzorcow.cjs').zrobZrzutWzorcow(kadr, { ciemny: CIEMNY }).catch((err) => console.error('pominięto zrzut wzorców:', err.message));

  await przegladarka.close();
})();
