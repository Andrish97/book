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

const ADRES = process.argv[2] || 'http://localhost:8000/';
const KATALOG = path.join(__dirname, '..', 'img', 'instrukcja');
const WIDOK = { width: 1280, height: 800 };

// Konfiguracja z fikcyjnym adresem – tylko po to, by ekran logowania
// wyglądał jak w działającej aplikacji. Żadne zapytanie nie wychodzi.
const FAKE_KONFIG = "export const SUPABASE_URL = 'https://przyklad.supabase.co';\nexport const SUPABASE_ANON_KEY = 'sb_publishable_przyklad';\n";
// Pusta konfiguracja – reszta zrzutów powstaje w trybie bez konta, na
// przykładowych projektach, bez łączenia z prawdziwą bazą.
const BEZ_KONFIGU = "export const SUPABASE_URL = '';\nexport const SUPABASE_ANON_KEY = '';\n";
const bezBazy = (k) => k.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: BEZ_KONFIGU }));

async function zrzut(strona, nazwa, opcje = {}) {
  await strona.waitForTimeout(350);
  await strona.screenshot({ path: path.join(KATALOG, nazwa), ...opcje });
  console.log('✓', nazwa);
}

// Przykładowe projekty budowane przez API edytora.
async function przykladoweProjekty(strona) {
  await strona.evaluate(async () => {
    const { otworzProjekt, edytor, stan } = window.publisher;
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
    dodaj(new fabric.Rect({ left: -3, top: -3, width: 154, height: 62, fill: '#2f5bd3', strokeWidth: 0 }));
    dodaj(tekst('Styczeń', { left: 10, top: 18, width: 128, fontSize: mm(30), fontFamily: 'Playfair Display', fontWeight: 'bold', fill: '#ffffff' }));
    dodaj(tekst('2027', { left: 10, top: 40, width: 60, fontSize: mm(12), fill: '#dbe4fb' }));
    const dni = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
    dni.forEach((d, i) => dodaj(tekst(d, { left: 10 + i * 18.3, top: 70, width: 16, fontSize: mm(8), fontWeight: 'bold', textAlign: 'center', fill: i > 4 ? '#c2410c' : '#4a4843' })));
    for (let n = 1; n <= 31; n += 1) {
      const p = n + 3; const kol = p % 7; const rz = Math.floor(p / 7);
      dodaj(tekst(String(n), { left: 10 + kol * 18.3, top: 80 + rz * 18, width: 16, fontSize: mm(11), textAlign: 'center', fill: kol > 4 ? '#c2410c' : '#1c1b19' }));
    }
    dodaj(new fabric.Line([10, 190, 138, 190], { stroke: '#cfccc3', strokeWidth: 0.3, strokeUniform: true }));
    dodaj(tekst('Notatki', { left: 10, top: 193, width: 60, fontSize: mm(8), fill: '#807d75' }));
    await zapisz();

    // Sekcje: okładka (szeroka, z grzbietem) + środek ze wzorcem.
    const rnd = () => `o_${Math.random().toString(36).slice(2)}`;
    const json = (obiekty) => obiekty.map((o) => { o.set({ id: rnd() }); return o.toObject(['id', 'bez_ostrzezen']); });
    const P = stan.projekt;
    P.sekcje[0].nazwa = 'Środek';
    const wz = {
      id: 'wz_kalendarz', nazwa: 'Strona kalendarza', wydruk: { ...P.sekcje[0].wydruk }, tlo: '#ffffff',
      obiekty: json([
        new fabric.Line([10, 199, 138, 199], { stroke: '#cfccc3', strokeWidth: 0.3, strokeUniform: true, bez_ostrzezen: true }),
        tekst('Kalendarz 2027', { left: 10, top: 201, width: 60, fontSize: mm(7), fill: '#807d75', bez_ostrzezen: true }),
        tekst('{nr}', { left: 108, top: 201, width: 30, fontSize: mm(7), fill: '#807d75', textAlign: 'right', bez_ostrzezen: true }),
      ]),
    };
    P.wzorce.push(wz);
    P.sekcje[0].wzorzec = wz.id;
    P.sekcje.unshift({
      id: 'sek_okladka', nazwa: 'Okładka', wzorzec: null,
      wydruk: { format: 'wlasny', szerokosc_mm: 302, wysokosc_mm: 210, spad_mm: 3, marginesy_mm: 10, znaki_ciecia: true },
    });
    P.strony[0].nazwa = 'Styczeń';
    const srodek = P.sekcje[1].id;
    P.strony.push(
      { id: 's2', nazwa: 'Luty', sekcja: srodek, wzorzec: 'z_sekcji', obiekty: [], tlo: null },
      { id: 's3', nazwa: 'Notatki', sekcja: srodek, wzorzec: 'z_sekcji', obiekty: [], tlo: null },
      {
        id: 's0', nazwa: 'Okładka', sekcja: 'sek_okladka', wzorzec: 'z_sekcji', tlo: '#1f2a44',
        obiekty: json([
          new fabric.Rect({ left: 148, top: -3, width: 6, height: 216, fill: '#f2c66d', strokeWidth: 0, bez_ostrzezen: true }),
          tekst('Kalendarz', { left: 166, top: 72, width: 126, fontSize: mm(34), fontFamily: 'Playfair Display', fontWeight: 'bold', fill: '#ffffff' }),
          tekst('2027', { left: 166, top: 100, width: 126, fontSize: mm(34), fontFamily: 'Playfair Display', fill: '#f2c66d' }),
        ]),
      },
    );
    await otworzProjekt(P);
    stan.projekt.miniatura = edytor.miniatura(200);
    await zapiszLokalnie();
  });
}

(async () => {
  const przegladarka = await chromium.launch();

  // ---------- Logowanie ----------
  {
    const kontekst = await przegladarka.newContext({ viewport: WIDOK, serviceWorkers: 'block' });
    await kontekst.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_KONFIG }));
    await kontekst.route('https://przyklad.supabase.co/**', (r) => r.abort());
    const s = await kontekst.newPage();
    await s.goto(ADRES);
    await s.waitForSelector('#ekran-logowania', { state: 'visible' });
    await s.fill('#form-logowania input[name=email]', 'anna@przyklad.pl');
    await s.fill('#form-logowania input[name=haslo]', 'tajnehaslo');
    await s.locator('body').click({ position: { x: 5, y: 5 } });
    await zrzut(s, 'logowanie.png');
    await kontekst.close();
  }

  // ---------- Desktop / tablet w poziomie ----------
  const kontekst = await przegladarka.newContext({ viewport: WIDOK, serviceWorkers: 'block' });
  await bezBazy(kontekst);
  const s = await kontekst.newPage();
  s.on('pageerror', (e) => console.error('błąd strony:', e.message));
  await s.goto(ADRES);
  await s.click('#tryb-lokalny');
  await s.waitForSelector('#dlg-instrukcja[open]');
  await s.click('[data-akcja="zamknij-instrukcje"]');
  await przykladoweProjekty(s);
  await s.click('[data-akcja="do-projektow"]');
  await s.waitForSelector('.karta-projektu:not(.szkielet)');
  await s.waitForTimeout(600);
  await zrzut(s, 'projekty.png');

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
    znacz('#panel-strony', 1, 176, 196);
    znacz('#kontener-plotna', 2, 24, 90);
    znacz('#panel-inspektor', 3, 250, 14);
  });
  await zrzut(s, 'edytor.png');
  await s.evaluate(() => document.querySelectorAll('.znacznik-zrzutu').forEach((d) => d.remove()));

  // Wstawianie: zaznaczony tekst
  await s.evaluate(() => {
    const { edytor } = window.publisher;
    const t = edytor.canvas.getObjects().find((o) => o.text === 'Styczeń');
    edytor.canvas.setActiveObject(t);
    edytor.canvas.requestRenderAll();
  });
  await s.hover('[data-akcja="dodaj-tekst"]');
  await zrzut(s, 'wstawianie.png', { clip: { x: 208, y: 56, width: 772, height: 744 } });

  // Właściwości tekstu
  await zrzut(s, 'wlasciwosci.png', { clip: { x: 600, y: 56, width: 680, height: 744 } });

  // Strony – menu
  await s.evaluate(() => { window.publisher.edytor.canvas.discardActiveObject(); window.publisher.edytor.canvas.requestRenderAll(); });
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
  await s.evaluate(() => window.publisher.edytujWzorzec('wz_kalendarz'));
  await s.waitForTimeout(900);
  await zrzut(s, 'wzorce.png');
  await s.click('[data-akcja="wroc-do-stron"]');
  await s.click('#lista-stron li.strona:has-text("Styczeń") .miniatura');
  await s.waitForTimeout(800);

  // Ostrzeżenia: element w marginesie
  await s.evaluate(() => {
    const { edytor } = window.publisher;
    const r = new fabric.Rect({ left: 2, top: 150, width: 40, height: 22, fill: '#fde68a', stroke: '#b45309', strokeWidth: 0.3, strokeUniform: true, nazwa: 'Ramka na naklejkę' });
    r.set({ id: 'o_przyklad' });
    edytor.canvas.add(r);
    edytor.canvas.discardActiveObject();
    edytor.canvas.requestRenderAll();
  });
  await s.waitForTimeout(500);
  await s.evaluate(() => { document.getElementById('panel-inspektor').scrollTop = 1e6; });
  await zrzut(s, 'ostrzezenia.png', { clip: { x: 380, y: 300, width: 900, height: 500 } });
  await s.evaluate(() => {
    const { edytor } = window.publisher;
    edytor.zaznacz('o_przyklad');
    edytor.usun();
  });

  // Menu projektu na liście projektów (eksport, import)
  await s.click('[data-akcja="do-projektow"]');
  await s.waitForSelector('.karta-projektu:not(.szkielet)');
  await s.waitForTimeout(600);
  await s.click('.karta-projektu:has-text("Kalendarz 2027") .menu-karty');
  await zrzut(s, 'menu.png', { clip: { x: 0, y: 56, width: 1280, height: 480 } });
  await s.keyboard.press('Escape');
  await kontekst.close();

  // ---------- Telefon ----------
  const tel = await przegladarka.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  await bezBazy(tel);
  const t = await tel.newPage();
  await t.goto(ADRES);
  await t.tap('#tryb-lokalny');
  await t.waitForSelector('#dlg-instrukcja[open]');
  await t.tap('[data-akcja="zamknij-instrukcje"]');
  await przykladoweProjekty(t);
  await t.evaluate(() => window.publisher.przejdzDoStrony(1));
  await t.waitForTimeout(800);
  await t.evaluate(() => {
    const { edytor } = window.publisher;
    const o = edytor.canvas.getObjects().find((x) => x.text === 'Styczeń');
    edytor.canvas.setActiveObject(o);
    edytor.canvas.requestRenderAll();
  });
  await t.tap('.zakladki-mobilne [data-panel="inspektor"]');
  await t.waitForTimeout(500);
  await zrzut(t, 'telefon.png');
  await tel.close();

  await przegladarka.close();
})();
