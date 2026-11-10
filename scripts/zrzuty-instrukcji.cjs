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
const { otworz: otworzZAtrapa } = require('../tests/pomoc.cjs');

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

(async () => {
  const przegladarka = await chromium.launch();

  // ---------- Logowanie, rejestracja, ustawienia konta (atrapa Supabase z testów) ----------
  {
    const sprzatanie = [];
    const { strona: k } = await otworzZAtrapa({ after: (f) => sprzatanie.push(f) }, {
      tryb: 'atrapa',
      konta: [{ id: '11111111-1111-4111-8111-111111111111', email: 'anna@przyklad.pl', haslo: 'Dobre#Haslo1', potwierdzone: true, nazwa: 'Anna' }],
    });
    await k.waitForSelector('#ekran-logowania', { state: 'visible' });
    await k.fill('#form-logowania input[name=email]', 'anna@przyklad.pl');
    await k.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
    await k.locator('.stopka-logowania').click();
    await zrzut(k, 'logowanie.png');

    await k.click('#tryb-logowania label:has-text("Nowe konto")');
    await k.fill('#form-logowania input[name=nazwa]', 'Jan');
    await k.fill('#form-logowania input[name=email]', 'jan@przyklad.pl');
    await k.fill('#form-logowania input[name=haslo]', 'Kalendarz7');
    await k.locator('.stopka-logowania').click();
    await zrzut(k, 'rejestracja.png');
    await k.fill('#form-logowania input[name=haslo]', 'Kalendarz#27');
    await k.fill('#form-logowania input[name=haslo2]', 'Kalendarz#27');
    await k.click('#przycisk-logowania');
    await k.waitForSelector('#widok-wyslano', { state: 'visible' });
    await zrzut(k, 'rejestracja-wyslano.png', { clip: { x: 584, y: 0, width: 696, height: 520 } });

    await k.click('#widok-wyslano [data-tryb="logowanie"]');
    await k.fill('#form-logowania input[name=email]', 'anna@przyklad.pl');
    await k.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
    await k.click('#przycisk-logowania');
    await k.waitForSelector('#dlg-instrukcja[open]');
    await k.click('[data-akcja="zamknij-instrukcje"]');
    await k.click('#awatar');
    await k.click('[data-akcja="ustawienia-konta"]');
    await k.waitForFunction(() => document.body.dataset.ekran === 'konto');
    await k.click('[data-rozwin="form-email"]');
    await zrzut(k, 'konto.png');
    await k.click('[data-zwin="form-email"]');
    await k.click('#wybor-motywu label:has-text("Ciemny")');
    await k.waitForTimeout(400);
    await k.click('.konto-nawigacja a:has-text("Wygląd")');
    await zrzut(k, 'motyw.png');
    await k.click('#wybor-motywu label:has-text("Jak w systemie")');

    // Udostępnianie podglądu linkiem
    await k.click('[data-akcja="do-projektow"]:visible');
    await k.click('[data-akcja="nowy-projekt"]:visible');
    await k.fill('#form-nowy input[name=nazwa]', 'Kalendarz 2027');
    await k.click('#form-nowy button[value=ok]');
    await k.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
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
    await k.click('[data-akcja="udostepnij"]');
    await k.click('#udostepnij-utworz');
    await k.waitForSelector('#udostepnij-komunikat.sukces', { timeout: 20000 });
    await k.evaluate(() => { document.querySelector('#podglad-tresc').scrollTop = 0; });
    await k.waitForTimeout(600);
    await zrzut(k, 'udostepnianie.png');
    for (const f of sprzatanie) await f();
  }

  // ---------- Desktop / tablet w poziomie ----------  // ---------- Desktop / tablet w poziomie ----------
  const kontekst = await przegladarka.newContext({ viewport: WIDOK, serviceWorkers: 'block' });
  await bezBazy(kontekst);
  const s = await kontekst.newPage();
  s.on('pageerror', (e) => console.error('błąd strony:', e.message));
  await s.goto(ADRES);
  await s.click('#tryb-lokalny');
  await s.waitForSelector('#dlg-instrukcja[open]');
  await s.click('[data-akcja="zamknij-instrukcje"]');
  await przykladoweProjekty(s);
  await s.click('[data-akcja="do-projektow"]:visible');
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
  const kp = await przegladarka.newContext({ viewport: WIDOK, serviceWorkers: 'block' });
  await bezBazy(kp);
  const d = await kp.newPage();
  d.on('pageerror', (e) => console.error('błąd strony:', e.message));
  await d.goto(ADRES);
  await d.click('#tryb-lokalny');
  await d.waitForSelector('#dlg-instrukcja[open]');
  await d.click('[data-akcja="zamknij-instrukcje"]');
  await d.click('[data-akcja="nowy-projekt"]:visible');
  await d.fill('#form-nowy input[name=nazwa]', 'Planer dzienny');
  await d.click('#form-nowy button[value=ok]');
  await d.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
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
  await d.mouse.click(700, 20);

  // Odległości: trzeci kwadrat przeciągany w rząd, w równym odstępie
  const z = await naPlotnie(112, 122);
  const na = await naPlotnie(102.8, 42.4);
  await d.mouse.move(z.x, z.y);
  await d.mouse.down();
  await d.mouse.move((z.x + na.x) / 2, (z.y + na.y) / 2, { steps: 4 });
  await d.mouse.move(na.x, na.y, { steps: 4 });
  await zrzut(d, 'odleglosci.png', { clip: { x: 236, y: 56, width: 744, height: 520 } });
  await d.mouse.up();

  // Warstwy
  await d.click('#zakladki-listy label:has-text("Warstwy")');
  await d.click('#lista-warstw li:has-text("Wtorek") .warstwa-nazwa');
  await d.click('#lista-warstw li:has-text("Pas na notatki") .warstwa-oko');
  await d.hover('#lista-warstw li:has-text("Poniedziałek")');
  await d.click('#lista-warstw li:has-text("Poniedziałek") .warstwa-klodka');
  await d.click('#lista-warstw li:has-text("Wtorek") .warstwa-nazwa');
  await zrzut(d, 'warstwy.png', { clip: { x: 0, y: 56, width: 820, height: 480 } });

  // Dane, pola i serie: strona dnia powielana według tabeli
  await d.click('#zakladki-listy label:has-text("Strony")');
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
  await d.click('#tryb-lokalny');
  await d.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
  await d.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.text?.startsWith('Imieniny')).id); });
  await d.waitForTimeout(700);
  await zrzut(d, 'pola.png');
  await d.evaluate(() => window.seriodruk.edytor.odznacz());
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
    const { komorki, siatka } = e.dodajTabele({ wiersze: 4, kolumny: 3 });
    e.canvas.discardActiveObject();
    for (const x of [siatka, ...komorki]) { x.top += 40; x.setCoords(); }
    ['Dzień', 'Do zrobienia', 'Uwagi'].forEach((t, i) => komorki[i].set('text', t));
    ['Poniedziałek', 'Plan tygodnia', '', 'Wtorek', 'Zakupy', 'lista wyżej'].forEach((t, i) => komorki[3 + i].set('text', t));
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
  await kp.close();

  // ---------- Telefon ----------
  const tel = await przegladarka.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  await bezBazy(tel);
  const t = await tel.newPage();
  await t.goto(ADRES);
  await t.tap('#tryb-lokalny');
  await t.waitForSelector('#dlg-instrukcja[open]');
  await t.tap('[data-akcja="zamknij-instrukcje"]');
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
  await tel.close();

  await przegladarka.close();
})();
