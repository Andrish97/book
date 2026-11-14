// Próba na prawdziwej bazie: przechodzi opublikowaną aplikację jak użytkownik.
//
//   node scripts/proba-na-zywo.cjs [adres aplikacji]
//
// Rejestruje konto testowe (losowy adres w domenie example.com, bez wysyłki
// poczty), zapisuje projekt z obrazem, sprawdza odczyt na drugim urządzeniu,
// zmienia różne strony na dwóch urządzeniach naraz (zmiany mają się połączyć),
// udostępnia podgląd linkiem, otwiera go bez konta, wyłącza link, sprawdza dostęp dla AI
// (funkcje bazy i zdalny łącznik MCP – Funkcję Edge mcp) i na koniec
// USUWA konto testowe. Zwykłe testy (npm test) używają atrapy bazy – ta próba
// jest jedynym sprawdzeniem prawdziwego Supabase, reguł dostępu i plików.
// Uruchamiaj po zmianach w supabase/ albo w js/chmura.js.

const { chromium } = require('playwright');
const crypto = require('crypto');
const ADRES = process.argv[2] || 'https://makietka.app/';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBkYGBgYAAAhCAEB2eTzpAAAAABJRU5ErkJggg==', 'base64');
const email = `seriodruk-test-${crypto.randomBytes(5).toString('hex')}@example.com`;
const haslo = `Tt#9${crypto.randomBytes(8).toString('hex')}`;
const wyniki = [`konto testowe: ${email}`];
const krok = async (nazwa, fn) => {
  const t = Date.now();
  try { const w = await fn(); wyniki.push(`OK   ${nazwa}${w ? ` – ${w}` : ''} (${Date.now() - t} ms)`); }
  catch (e) { wyniki.push(`BŁĄD ${nazwa}: ${e.message.split('\n')[0]}`); throw e; }
};
(async () => {
  const b = await chromium.launch();
  const k = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const p = await k.newPage();
  const bledy = [];
  p.on('pageerror', (e) => bledy.push(`pageerror: ${e.message.slice(0, 200)}`));
  p.on('response', (r) => { if (r.status() >= 400 && r.url().includes('supabase.co')) bledy.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  p.setDefaultTimeout(30000);
  let zalogowany = false;
  try {
    await krok('aplikacja się otwiera', async () => { await p.goto(ADRES); await p.waitForSelector('#form-logowania'); });
    await krok('rejestracja bez potwierdzania e-mailem', async () => {
      await p.click('#tryb-logowania label:has-text("Nowe konto")');
      await p.fill('#form-logowania input[name=nazwa]', 'Test automatyczny');
      await p.fill('#form-logowania input[name=email]', email);
      await p.fill('#form-logowania input[name=haslo]', haslo);
      await p.fill('#form-logowania input[name=haslo2]', haslo);
      await p.click('#przycisk-logowania');
      await Promise.race([
        p.waitForSelector('#dlg-instrukcja[open]'),
        p.waitForSelector('#widok-wyslano', { state: 'visible' }).then(() => { throw new Error('aplikacja czeka na potwierdzenie e-mailem'); }),
        p.waitForFunction(() => document.querySelector('#komunikat-logowania')?.textContent.trim().length > 0).then(async () => { throw new Error(`komunikat: ${await p.textContent('#komunikat-logowania')}`); }),
      ]);
      zalogowany = true;
      await p.click('[data-akcja="zamknij-instrukcje"]');
    });
    let idProjektu;
    await krok('nowy projekt zapisuje się na koncie', async () => {
      await p.click('[data-akcja="nowy-projekt"]:visible');
      await p.fill('#form-nowy input[name=nazwa]', 'Test bazy');
      await p.click('#form-nowy label:has-text("Rozkładówki")');
      await p.click('#form-nowy button[value=ok]');
      await p.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk);
      await p.click('[data-akcja="dodaj-tekst"]');
      await p.click('[data-akcja="strona-dodaj"]');
      await p.setInputFiles('#plik-obraz', { name: 'a.png', mimeType: 'image/png', buffer: PNG });
      await p.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((o) => o.type === 'image'));
      await p.waitForFunction(() => document.querySelector('#stan-zapisu .tekst')?.textContent === 'Zapisano', null, { timeout: 40000 });
      idProjektu = await p.evaluate(() => window.seriodruk.stan.projekt.id);
      const s = await p.evaluate(() => { const pr = window.seriodruk.stan.projekt; return `wersja na koncie ${pr.wersja_chmury}, obraz: ${Object.values(pr.zasoby)[0]?.sciezka ? 'wysłany' : 'tylko lokalnie'}`; });
      return s;
    });
    await krok('wgrana czcionka trafia do „Moich czcionek” na koncie', async () => {
      await p.evaluate(async () => {
        const plik = new File([await (await fetch('css/czcionki/pdf/caveat-400-prosta.ttf')).arrayBuffer()], 'Probna-Regular.ttf', { type: 'font/ttf' });
        const [c] = await window.seriodruk.oknoCzcionek.dodaj([plik]);
        await window.seriodruk.oknoCzcionek.zmienRodzine(c.id, 'Próbna');
      });
      // Zbiór uzgadnia się z kontem w tle – czekamy, aż spis na koncie pokaże plik.
      await p.waitForFunction(async () => { const ch = await import('./js/chmura.js'); const spis = await (await ch.kontoCzcionek()).spis(); return spis.czcionki.some((c) => c.rodzina === 'Próbna'); }, null, { timeout: 40000, polling: 1500 });
      await p.waitForFunction(() => document.querySelector('#stan-zapisu .tekst')?.textContent === 'Zapisano', null, { timeout: 40000 });
      return 'plik i spis w prywatnym folderze konta';
    });
    await krok('drugie urządzenie widzi projekt po zalogowaniu', async () => {
      const k2 = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
      const p2 = await k2.newPage();
      p2.setDefaultTimeout(30000);
      await p2.goto(ADRES);
      await p2.fill('#form-logowania input[name=email]', email);
      await p2.fill('#form-logowania input[name=haslo]', haslo);
      await p2.click('#przycisk-logowania');
      await p2.waitForSelector('#dlg-instrukcja[open]');
      await p2.click('[data-akcja="zamknij-instrukcje"]');
      await p2.waitForSelector('#ekran-projektow :text("Test bazy")');
      await p2.click('#ekran-projektow :text("Test bazy")');
      await p2.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk);
      // Obraz leży w magazynie plików przeglądarki (js/zasoby.js), pobrany z konta przy otwarciu projektu.
      const s = await p2.evaluate(async () => { const pr = window.seriodruk.stan.projekt; const { dataUrlZasobu } = await import('./js/zasoby.js'); const d = await dataUrlZasobu(pr, Object.keys(pr.zasoby).find((id) => !(pr.czcionki || []).some((c) => c.id === id))); return `${pr.strony.length} strony, ${pr.strony.reduce((n, x) => n + x.obiekty.length, 0)} elementy, obraz ${d?.startsWith('data:image') ? 'pobrany' : 'BRAK'}`; });
      // „Moje czcionki” na drugim urządzeniu: zbiór pobrany z konta.
      await p2.waitForFunction(async () => { const m = await import('./js/moje-czcionki.js'); const moje = await m.mojeCzcionki(window.seriodruk.stan.uzytkownik.id); return moje.some((c) => c.rodzina === 'Próbna' && c.dataUrl); }, null, { timeout: 40000, polling: 1500 });
      await k2.close();
      if (s.includes('BRAK')) throw new Error(s);
      return `${s}; czcionka ze zbioru pobrana`;
    });
    await krok('zmiana z urządzenia 2 dochodzi na żywo do urządzenia 1; zmiany na różnych stronach zostają obie', async () => {
      const typy = (strona) => strona.obiekty.map((o) => String(o.type).toLowerCase());
      // Urządzenie 2 otwiera projekt z konta i dodaje prostokąt na swojej stronie.
      const k2 = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
      try {
        const p2 = await k2.newPage();
        p2.setDefaultTimeout(30000);
        await p2.goto(ADRES);
        await p2.fill('#form-logowania input[name=email]', email);
        await p2.fill('#form-logowania input[name=haslo]', haslo);
        await p2.click('#przycisk-logowania');
        await p2.waitForSelector('#dlg-instrukcja[open]');
        await p2.click('[data-akcja="zamknij-instrukcje"]');
        await p2.click('#ekran-projektow :text("Test bazy")');
        await p2.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk);
        const otwarta = (s) => s.evaluate(() => { const st = window.seriodruk.stan; return st.projekt.strony[st.indeks].id; });
        const [tam, tu] = [await otwarta(p2), await otwarta(p)];
        if (tam === tu) throw new Error('oba urządzenia mają otwartą tę samą stronę – próba niczego by nie sprawdziła');
        const przed = await p2.evaluate(() => window.seriodruk.stan.projekt.wersja_chmury);
        await p2.click('[data-akcja="dodaj-prostokat"]');
        await p2.waitForFunction((w) => window.seriodruk.stan.projekt.wersja_chmury > w && document.querySelector('#stan-zapisu .tekst')?.textContent === 'Zapisano', przed, { timeout: 40000 });
        const poDrugim = await p2.evaluate(() => window.seriodruk.stan.projekt.wersja_chmury);
        // Urządzenie 1 ma projekt otwarty i nic nie robi: prostokąt z urządzenia 2 ma się u niego pojawić sam,
        // bez przeładowania strony. Kanałem na żywo trwa to chwilę; bez kanału zadziała dopiero zapas (co 30 s).
        const start = Date.now();
        await p.waitForFunction(([id, w]) => {
          const pr = window.seriodruk.stan.projekt;
          return pr.wersja_chmury === w && pr.strony.find((s) => s.id === id)?.obiekty.some((o) => String(o.type).toLowerCase() === 'rect');
        }, [tam, poDrugim], { timeout: 50000 });
        const czas = (Date.now() - start) / 1000;
        const jak = czas < 10 ? `na żywo po ${czas.toFixed(1)} s` : `dopiero po ${czas.toFixed(0)} s – KANAŁ NA ŻYWO NIE DZIAŁA, zadziałało sprawdzanie zapasowe`;
        // Potem urządzenie 1 dodaje elipsę na swojej stronie: obie zmiany mają zostać, bez pytania.
        await p.click('[data-akcja="dodaj-elipse"]');
        await Promise.race([
          p.waitForFunction((w) => window.seriodruk.stan.projekt.wersja_chmury === w + 1 && document.querySelector('#stan-zapisu .tekst')?.textContent === 'Zapisano', poDrugim, { timeout: 60000 }),
          p.waitForSelector('dialog[open]', { timeout: 60000 }).then(async () => { throw new Error(`aplikacja zapytała zamiast połączyć: ${(await p.textContent('dialog[open]')).replace(/\s+/g, ' ').trim().slice(0, 140)}`); }),
        ]);
        const lokalnie = await p.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => ({ id: s.id, obiekty: s.obiekty.map((o) => ({ type: o.type })) })));
        // Stan konta czytany z drugiego urządzenia – wprost z bazy, nie z jego kopii.
        const naKoncie = await p2.evaluate(async (id) => { const ch = await import('./js/chmura.js'); const pr = await ch.wczytajZChmury(id); return pr.strony.map((s) => ({ id: s.id, obiekty: s.obiekty.map((o) => ({ type: o.type })) })); }, idProjektu);
        for (const [gdzie, strony] of [['na urządzeniu 1', lokalnie], ['na koncie', naKoncie]]) {
          if (!typy(strony.find((s) => s.id === tam)).includes('rect')) throw new Error(`${gdzie} brak prostokąta dodanego na urządzeniu 2`);
          if (!typy(strony.find((s) => s.id === tu)).includes('ellipse')) throw new Error(`${gdzie} brak elipsy dodanej na urządzeniu 1`);
        }
        return `${jak}; obie zmiany zostały bez pytania; wersja na koncie ${poDrugim + 1}`;
      } finally {
        await k2.close();
      }
    });
    let link;
    await krok('udostępnienie podglądu linkiem', async () => {
      await p.click('[data-akcja="podglad"]');
      await p.waitForFunction(() => document.body.dataset.ekran === 'podglad');
      await p.click('[data-akcja="udostepnij"]');
      await p.click('#udostepnij-utworz');
      await Promise.race([
        p.waitForSelector('#udostepnij-komunikat.sukces', { timeout: 60000 }),
        p.waitForFunction(() => /Nie udało się/.test(document.querySelector('#udostepnij-komunikat')?.textContent || ''), null, { timeout: 60000 }).then(async () => { throw new Error(await p.textContent('#udostepnij-komunikat')); }),
      ]);
      link = await p.inputValue('#udostepnij-link');
    });
    await krok('osoba bez konta otwiera link', async () => {
      const g = await b.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
      const o = await g.newPage();
      o.setDefaultTimeout(30000);
      await o.goto(link);
      await o.waitForFunction(() => document.body.dataset.ekran === 'podglad' && document.querySelectorAll('.podglad-strona[data-id]').length === 2);
      await o.waitForFunction(() => document.querySelector('.podglad-strona[data-id] img')?.naturalWidth > 0);
      const s = `${await o.textContent('#podglad-tytul')}, 2 strony z obrazami`;
      await g.close();
      return s;
    });
    await krok('link z hasłem: bez hasła nie ma obrazów, z hasłem są', async () => {
      await p.check('#udostepnij-haslo-wl');
      await p.fill('#udostepnij-haslo', 'proba-hasla');
      await p.click('#udostepnij-ochrona-zapisz');
      await Promise.race([
        p.waitForSelector('#udostepnij-komunikat.sukces', { timeout: 60000 }),
        p.waitForFunction(() => /Nie udało się/.test(document.querySelector('#udostepnij-komunikat')?.textContent || ''), null, { timeout: 60000 }).then(async () => { throw new Error(await p.textContent('#udostepnij-komunikat')); }),
      ]);
      // Publiczny plik zniknął, a funkcja bazy bez hasła nie wydaje stron.
      const publiczny = await p.evaluate(async (l) => { const [, konto, proj, kod] = l.match(/#\/u\/([^/]+)\/([^/]+)\/([^/]+)$/); const m = await import('./js/konfiguracja.js'); return (await fetch(`${m.SUPABASE_URL}/storage/v1/object/public/podglady/${konto}/${proj}/${kod}/manifest.json`, { cache: 'no-store' })).status; }, link);
      if (publiczny === 200) throw new Error('obrazy linku z hasłem nadal są w publicznym folderze');
      const g = await b.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
      const o = await g.newPage();
      o.setDefaultTimeout(30000);
      await o.goto(link);
      await o.waitForSelector('#podglad-haslo input[name=haslo]');
      const bezHasla = await o.evaluate(async (l) => {
        const [, konto, proj, kod] = l.match(/#\/u\/([^/]+)\/([^/]+)\/([^/]+)$/);
        const m = await import('./js/konfiguracja.js');
        const x = await fetch(`${m.SUPABASE_URL}/rest/v1/rpc/podglad_chroniony`, { method: 'POST', headers: { apikey: m.SUPABASE_ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ p_konto: konto, p_projekt: proj, p_kod: kod, p_nazwy: ['manifest.json'] }) });
        return (await x.json()).stan;
      }, link);
      if (bezHasla !== 'haslo') throw new Error(`bez hasła baza odpowiada: ${bezHasla}`);
      await o.fill('#podglad-haslo input[name=haslo]', 'zle-haslo');
      await o.click('#podglad-haslo button');
      await o.waitForFunction(() => /nie zgadza/.test(document.querySelector('#podglad-haslo .komunikat')?.textContent || ''));
      await o.fill('#podglad-haslo input[name=haslo]', 'proba-hasla');
      await o.click('#podglad-haslo button');
      await o.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id]').length === 2);
      await o.waitForFunction(() => document.querySelector('.podglad-strona[data-id] img')?.naturalWidth > 0);
      await g.close();
      return `publiczny plik: ${publiczny}, bez hasła: ${bezHasla}, z hasłem: 2 strony z obrazami`;
    });
    await krok('unieważnienie linku', async () => {
      await p.click('[data-akcja="udostepnij-wylacz"]');
      await p.click('#potwierdz-tak');
      await p.waitForFunction(() => /Link unieważniony/.test(document.querySelector('#udostepnij-komunikat')?.textContent || ''));
      const r = await p.evaluate(async (l) => { const [, konto, proj, kod] = l.match(/#\/u\/([^/]+)\/([^/]+)\/([^/]+)$/); const m = await import('./js/konfiguracja.js'); const x = await fetch(`${m.SUPABASE_URL}/storage/v1/object/public/podglady/${konto}/${proj}/${kod}/manifest.json`, { cache: 'no-store' }); return x.status; }, link);
      await p.click('[data-akcja="udostepnij-zamknij"]');
      return `plik pod starym adresem: ${r}`;
    });
    await krok('miejsce na koncie: licznik, plan sprzątania, skróty stron (migracja 20261114150000)', async () => {
      const w = await p.evaluate(async () => {
        const m = await import('./js/miejsce.js');
        const stan = await m.miejsce({ swieze: true });
        const plan = await m.planSprzatania();
        const sb = await (await import('./js/chmura.js')).supabase();
        const { data, error } = await sb.from('projekty_strony').select('strona_id, skrot').eq('projekt_id', window.seriodruk.stan.projekt.id);
        return { stan, plan, skroty: error ? error.message : data.map((x) => x.skrot) };
      });
      if (!(w.stan.obrazy > 0) || !(w.stan.pliki_razem >= w.stan.obrazy) || w.stan.limit_plikow !== 1073741824) throw new Error(`miejsce_na_koncie: ${JSON.stringify(w.stan)}`);
      if (!Array.isArray(w.plan.pliki) || typeof w.plan.ile !== 'number') throw new Error(`plan sprzątania: ${JSON.stringify(w.plan).slice(0, 200)}`);
      if (!Array.isArray(w.skroty) || !w.skroty.length || !w.skroty.every((x) => /^[0-9a-f]{32}$/.test(x))) throw new Error(`skróty stron: ${JSON.stringify(w.skroty).slice(0, 200)}`);
      return `obrazy konta ${Math.round(w.stan.obrazy / 1024)} kB, pliki aplikacji ${(w.stan.pliki_razem / 1048576).toFixed(1)} MB z 1 GB, baza ${w.stan.baza_razem ? `${(w.stan.baza_razem / 1048576).toFixed(0)} MB` : '?'}; do posprzątania: ${w.plan.ile}`;
    });
    await krok('dostęp dla AI: klucz z aplikacji zapisuje zmianę, edytor ją widzi, odebrany klucz przestaje działać', async () => {
      await p.keyboard.press('Escape');
      await p.waitForSelector('#przycisk-wiecej', { state: 'visible' });
      await p.click('#przycisk-wiecej');
      await p.click('[data-akcja="dostep-ai"]');
      await p.fill('#dostep-ai-opis', 'Próba na żywo');
      await p.click('[data-akcja="dostep-ai-utworz"]');
      await p.waitForSelector('#dostep-ai-gotowy:not([hidden])');
      const klucz = await p.inputValue('#dostep-ai-klucz');
      await p.click('[data-akcja="dostep-ai-zamknij"]');
      const rpc = (funkcja, tresc) => p.evaluate(async ([f, t]) => {
        const m = await import('./js/konfiguracja.js');
        const x = await fetch(`${m.SUPABASE_URL}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: m.SUPABASE_ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify(t) });
        return { status: x.status, dane: await x.json() };
      }, [funkcja, tresc]);
      const odczyt = await rpc('ai_projekt', { p_klucz: klucz });
      if (odczyt.status !== 200 || !odczyt.dane.projekt) throw new Error(`odczyt: ${odczyt.status} ${JSON.stringify(odczyt.dane).slice(0, 200)}`);
      const s = odczyt.dane.projekt.strony[0];
      const zapis = await rpc('ai_zapisz', {
        p_klucz: klucz, p_znana_wersja: odczyt.dane.wersja,
        p_zmiany: { nazwa: 'Test bazy (AI)', strony: [{ ...s, obiekty: [...s.obiekty, { id: 'ai_proba', type: 'rect', left: 10, top: 10, width: 20, height: 20, fill: '#c1121f' }] }] },
      });
      if (!zapis.dane?.wersja || zapis.dane.blad) throw new Error(`zapis: ${zapis.status} ${JSON.stringify(zapis.dane).slice(0, 300)}`);
      const konflikt = await rpc('ai_zapisz', { p_klucz: klucz, p_znana_wersja: odczyt.dane.wersja, p_zmiany: { nazwa: 'X' } });
      if (!konflikt.dane?.konflikt) throw new Error(`stara wersja nie dała konfliktu: ${JSON.stringify(konflikt.dane)}`);
      await p.waitForFunction(() => {
        const pr = window.seriodruk.stan.projekt;
        return pr?.nazwa === 'Test bazy (AI)' && pr.strony.some((x) => (x.obiekty || []).some((o) => o.id === 'ai_proba'));
      }, null, { timeout: 30000 });
      await p.click('#przycisk-wiecej');
      await p.click('[data-akcja="dostep-ai"]');
      await p.click('#dostep-ai-lista li:has-text("Próba na żywo") button');
      await p.click('#potwierdz-tak');
      await p.waitForFunction(() => !document.querySelector('#dostep-ai-lista li button'));
      await p.click('[data-akcja="dostep-ai-zamknij"]');
      const poOdebraniu = await rpc('ai_projekt', { p_klucz: klucz });
      if (!/odebrany/.test(poOdebraniu.dane?.blad || '')) throw new Error(`odebrany klucz dalej działa: ${JSON.stringify(poOdebraniu.dane).slice(0, 200)}`);
      return `wersja po zapisie AI: ${zapis.dane.wersja}`;
    });
    // Zdalny łącznik MCP (Funkcja Edge supabase/functions/mcp): tak łączą się Claude i ChatGPT.
    // Wymaga wdrożonej funkcji (integracja Supabase z GitHubem, [functions.mcp] w supabase/config.toml).
    await krok('zdalny łącznik MCP: adres z okna działa (initialize, lista narzędzi, odczyt, zmiana widoczna w edytorze), odebrany klucz przestaje działać', async () => {
      await p.click('#przycisk-wiecej');
      await p.click('[data-akcja="dostep-ai"]');
      await p.fill('#dostep-ai-opis', 'Łącznik na żywo');
      await p.click('[data-akcja="dostep-ai-utworz"]');
      await p.waitForSelector('#dostep-ai-gotowy:not([hidden])');
      const adres = await p.inputValue('#dostep-ai-adres');
      await p.click('[data-akcja="dostep-ai-zamknij"]');
      if (!/^https:\/\/api\.makietka\.app\/mcp\/sdk_[0-9a-f]{32}_/.test(adres)) throw new Error(`okno nie pokazało adresu łącznika: ${adres}`);
      // Wywołanie z przeglądarki (Origin strony aplikacji – sprawdza też CORS i OPTIONS funkcji).
      let nr = 0;
      const mcp = (tresc, naglowki = {}, metoda = 'POST') => p.evaluate(async ([u, t, n, m]) => {
        const x = await fetch(u, { method: m, headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...n }, ...(m === 'POST' ? { body: JSON.stringify(t) } : {}) });
        const tekst = await x.text();
        let dane = null; try { dane = JSON.parse(tekst); } catch { dane = tekst.slice(0, 200); }
        return { status: x.status, dane };
      }, [adres, tresc, naglowki, metoda]);
      const wywolaj = async (method, params) => {
        const w = await mcp({ jsonrpc: '2.0', id: (nr += 1), method, params }, { 'mcp-protocol-version': '2025-06-18' });
        if (w.status !== 200 || w.dane?.error) throw new Error(`${method}: ${w.status} ${JSON.stringify(w.dane).slice(0, 300)}`);
        return w.dane.result;
      };
      const init = await wywolaj('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'proba-na-zywo', version: '1' } });
      if (init.serverInfo?.name !== 'makietka') throw new Error(`initialize: ${JSON.stringify(init).slice(0, 200)}`);
      const lista = await wywolaj('tools/list', {});
      if (!lista.tools.some((x) => x.name === 'zmien_elementy')) throw new Error('brak narzędzi na liście');
      if (!lista.tools.some((x) => x.name === 'adres_do_wysylki') || !lista.tools.find((x) => x.name === 'wgraj_obraz')?._meta?.['openai/fileParams']) throw new Error('łącznik bez adres_do_wysylki albo pliki_z_czatu – stara wersja funkcji');
      const przeglad = await wywolaj('tools/call', { name: 'przeglad_projektu', arguments: {} });
      if (przeglad.isError || !/Projekt „/.test(przeglad.content[0].text)) throw new Error(`przeglad_projektu: ${przeglad.content?.[0]?.text?.slice(0, 200)}`);
      const zmiana = await wywolaj('tools/call', { name: 'nazwa_projektu', arguments: { nazwa: 'Test łącznika (AI)' } });
      if (zmiana.isError) throw new Error(`nazwa_projektu: ${zmiana.content[0].text.slice(0, 200)}`);
      await p.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa === 'Test łącznika (AI)', null, { timeout: 30000 });
      // Obrazy od AI (migracja 20261112090000_obrazy_ai.sql): wgranie małego PNG, wstawienie na stronę,
      // przeniesienie pliku na konto przez otwartą aplikację, wysyłka pliku wprost (POST …/obraz), usunięcie.
      const png = await p.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 12; c.height = 8;
        const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 12, 8);
        return c.toDataURL('image/png').split(',')[1];
      });
      const wgrany = await wywolaj('tools/call', { name: 'wgraj_obraz', arguments: { dane_base64: png, nazwa: 'proba-ai.png' } });
      if (wgrany.isError || !/Wgrano „proba-ai\.png”.*12×8 px/.test(wgrany.content[0].text)) throw new Error(`wgraj_obraz: ${wgrany.content[0].text.slice(0, 200)}`);
      const idStrony = await p.evaluate(() => window.seriodruk.stan.projekt.strony[window.seriodruk.stan.indeks].id); // strona otwarta w edytorze – obraz ma się pojawić na płótnie
      const wstawiony = await wywolaj('tools/call', { name: 'wstaw_obraz', arguments: { obraz: 'proba-ai.png', gdzie: `strona:${idStrony}`, x: 10, y: 10, szerokosc: 30 } });
      if (wstawiony.isError) throw new Error(`wstaw_obraz: ${wstawiony.content[0].text.slice(0, 200)}`);
      await p.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'image' && o.nazwa === 'proba-ai.png' && o.getElement()?.naturalWidth === 12), null, { timeout: 30000 });
      await p.waitForFunction(() => Object.values(window.seriodruk.stan.projekt.zasoby).some((z) => z.nazwa === 'proba-ai.png' && z.sciezka && !z.sciezka.startsWith('ai:')), null, { timeout: 30000 });
      // Wgrywanie kawałkami przez łącznik (wgraj_czesciami, migracja 20261112180000): AI bez sieci do bazy.
      const kawalkowy = Buffer.from(await p.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 160; c.height = 120;
        const x = c.getContext('2d');
        const d = x.createImageData(160, 120);
        for (let i = 0; i < d.data.length; i += 1) d.data[i] = (i % 4 === 3) ? 255 : Math.floor(Math.random() * 256);
        x.putImageData(d, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      }), 'base64');
      const KAW = 16384;
      const startK = await wywolaj('tools/call', { name: 'wgraj_czesciami', arguments: { krok: 'start', nazwa: 'proba-kawalki.png', rozmiar: kawalkowy.length, sha256: require('node:crypto').createHash('sha256').update(kawalkowy).digest('hex'), kawalek: KAW } });
      const idWgrania = /Wgranie (\S+):/.exec(startK.content[0].text)?.[1];
      if (startK.isError || !idWgrania) throw new Error(`wgraj_czesciami start: ${startK.content[0].text.slice(0, 200)}`);
      for (let nr = 0; nr * KAW < kawalkowy.length; nr += 1) {
        const c = await wywolaj('tools/call', { name: 'wgraj_czesciami', arguments: { krok: 'czesc', wgranie: idWgrania, nr, dane_base64: kawalkowy.subarray(nr * KAW, (nr + 1) * KAW).toString('base64') } });
        if (c.isError) throw new Error(`wgraj_czesciami czesc ${nr}: ${c.content[0].text.slice(0, 200)}`);
      }
      const koniecK = await wywolaj('tools/call', { name: 'wgraj_czesciami', arguments: { krok: 'koniec', wgranie: idWgrania } });
      if (koniecK.isError || !/Wgrano „proba-kawalki\.png”/.test(koniecK.content[0].text)) throw new Error(`wgraj_czesciami koniec: ${koniecK.content[0].text.slice(0, 200)}`);
      await p.waitForFunction(() => Object.values(window.seriodruk.stan.projekt.zasoby).some((z) => z.nazwa === 'proba-kawalki.png' && z.sciezka && !z.sciezka.startsWith('ai:')), null, { timeout: 60000 });
      const usunK = await wywolaj('tools/call', { name: 'usun_obrazy', arguments: { obrazy: ['proba-kawalki.png'] } });
      if (!/Usunięto 1: „proba-kawalki\.png”/.test(usunK.content[0].text)) throw new Error(`usun_obrazy (kawałki): ${usunK.content[0].text.slice(0, 200)}`);
      const wprost = await p.evaluate(async ([u, b64]) => {
        const bajty = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        bajty[bajty.length - 20] ^= 1; // inna treść niż poprzedni plik (zepsuty bajt IEND nie przeszkadza w rozpoznaniu)
        const x = await fetch(`${u}/obraz?nazwa=proba-wprost.png`, { method: 'POST', body: bajty });
        return { status: x.status, dane: await x.json() };
      }, [adres, png]);
      if (wprost.status !== 200 || wprost.dane.wgrane?.[0]?.nazwa !== 'proba-wprost.png') throw new Error(`POST /obraz: ${wprost.status} ${JSON.stringify(wprost.dane).slice(0, 200)}`);
      // Duże zdjęcie (JPEG 4000×3000 z szumem, ok. 6–8 MB) wysłane wprost: łącznik wgrywa je w kawałkach po 512 KB
      // (migracja 20261112150000_obrazy_ai_kawalki.sql), aplikacja skleja kawałki i przenosi plik na konto.
      const duzy = await p.evaluate(async (u) => {
        const c = document.createElement('canvas');
        c.width = 4000; c.height = 3000;
        const x = c.getContext('2d');
        const d = x.createImageData(4000, 3000);
        for (let i = 0; i < d.data.length; i += 1) d.data[i] = (i % 4 === 3) ? 255 : Math.floor(Math.random() * 256);
        x.putImageData(d, 0, 0);
        const blob = await new Promise((ok) => { c.toBlob(ok, 'image/jpeg', 0.95); });
        const t0 = performance.now();
        const odp = await fetch(`${u}/obraz?nazwa=proba-duza.jpg`, { method: 'POST', body: blob });
        return { mb: blob.size / 1048576, status: odp.status, ms: Math.round(performance.now() - t0), dane: await odp.json() };
      }, adres);
      if (duzy.status !== 200 || duzy.dane.wgrane?.[0]?.nazwa !== 'proba-duza.jpg') throw new Error(`duży POST /obraz (${duzy.mb.toFixed(1)} MB): ${duzy.status} ${JSON.stringify(duzy.dane).slice(0, 200)}`);
      await p.waitForFunction(() => Object.values(window.seriodruk.stan.projekt.zasoby).some((z) => z.nazwa === 'proba-duza.jpg' && z.sciezka && !z.sciezka.startsWith('ai:')), null, { timeout: 60000 });
      await p.click('#przycisk-wiecej');
      await p.click('[data-akcja="obrazy"]');
      await p.waitForFunction(() => [...document.querySelectorAll('#obrazy-lista li')].some((li) => li.querySelector('.obraz-nazwa')?.textContent === 'proba-duza.jpg' && li.querySelector('img')?.naturalWidth > 0), null, { timeout: 30000 });
      await p.click('#obrazy-zamknij');
      const usuniety = await wywolaj('tools/call', { name: 'usun_obrazy', arguments: { obrazy: ['proba-wprost.png', 'proba-ai.png', 'proba-duza.jpg'] } });
      if (!/Usunięto 2: „proba-wprost\.png”, „proba-duza\.jpg”|Usunięto 2: „proba-duza\.jpg”, „proba-wprost\.png”/.test(usuniety.content[0].text) || !/proba-ai\.png” – strona \d/.test(usuniety.content[0].text)) throw new Error(`usun_obrazy: ${usuniety.content[0].text.slice(0, 300)}`);
      const get = await mcp(null, {}, 'GET');
      if (get.status !== 405) throw new Error(`GET powinien dać 405, dał ${get.status}`);
      await p.click('#przycisk-wiecej');
      await p.click('[data-akcja="dostep-ai"]');
      await p.click('#dostep-ai-lista li:has-text("Łącznik na żywo") button');
      await p.click('#potwierdz-tak');
      await p.waitForFunction(() => !document.querySelector('#dostep-ai-lista li button'));
      await p.click('[data-akcja="dostep-ai-zamknij"]');
      const po = await wywolaj('tools/call', { name: 'przeglad_projektu', arguments: {} });
      if (!po.isError || !/odebrany/.test(po.content[0].text)) throw new Error(`odebrany klucz dalej działa w łączniku: ${JSON.stringify(po).slice(0, 200)}`);
      return `łącznik: ${init.serverInfo.name} ${init.serverInfo.version}, ${lista.tools.length} narzędzi; obraz od AI wgrany, wstawiony i przeniesiony na konto, wysyłka wprost i kawałkami przez łącznik działa; duże zdjęcie ${duzy.mb.toFixed(1)} MB w kawałkach w ${(duzy.ms / 1000).toFixed(1)} s`;
    });
  } catch (e) {
    wyniki.push(`przerwano: ${e.message.split('\n')[0]}`);
  } finally {
    if (zalogowany) {
      try {
        await krok('usunięcie konta testowego', async () => {
          // Pełne przeładowanie: zamyka okna, które mogły zostać otwarte po przerwanym kroku.
          await p.goto('about:blank');
          await p.goto(`${ADRES}#/konto`);
          await p.waitForSelector('#ekran-konta', { state: 'visible' });
          await p.click('[data-rozwin="form-usun"]');
          await p.fill('#form-usun input[name=haslo]', haslo);
          await p.click('#form-usun button[type=submit]');
          await p.click('#potwierdz-tak');
          await p.waitForFunction(() => document.body.dataset.ekran === 'logowanie', null, { timeout: 40000 });
        });
        await krok('usunięte konto nie może się zalogować', async () => {
          await p.fill('#form-logowania input[name=email]', email);
          await p.fill('#form-logowania input[name=haslo]', haslo);
          await p.click('#przycisk-logowania');
          await p.waitForFunction(() => document.querySelector('#komunikat-logowania')?.textContent.trim().length > 0);
          return await p.textContent('#komunikat-logowania');
        });
      } catch (e) {
        // Ostatnia deska ratunku: usunięcie konta wprost przez aplikację, bez klikania.
        try {
          await p.goto('about:blank'); await p.goto(ADRES);
          await p.waitForFunction(() => window.seriodruk?.stan?.uzytkownik, null, { timeout: 20000 });
          await p.evaluate(async () => { const ch = await import('./js/chmura.js'); await ch.usunKonto(); });
          wyniki.push('OK   konto testowe usunięte awaryjnie (kroki w ustawieniach konta nie przeszły)');
        } catch (e2) { wyniki.push(`UWAGA: konto testowe ${email} mogło zostać w bazie (${e.message.split('\n')[0]})`); }
      }
    }
    console.log(wyniki.join('\n'));
    console.log('--- odpowiedzi z błędem / błędy strony:', bledy.length ? `\n${[...new Set(bledy)].join('\n')}` : 'brak');
    await b.close();
  }
})();
