// Próba na prawdziwej bazie: przechodzi opublikowaną aplikację jak użytkownik.
//
//   node scripts/proba-na-zywo.cjs [adres aplikacji]
//
// Rejestruje konto testowe (losowy adres w domenie example.com, bez wysyłki
// poczty), zapisuje projekt z obrazem, sprawdza odczyt na drugim urządzeniu,
// zmienia różne strony na dwóch urządzeniach naraz (zmiany mają się połączyć),
// udostępnia podgląd linkiem, otwiera go bez konta, wyłącza link i na koniec
// USUWA konto testowe. Zwykłe testy (npm test) używają atrapy bazy – ta próba
// jest jedynym sprawdzeniem prawdziwego Supabase, reguł dostępu i plików.
// Uruchamiaj po zmianach w supabase/ albo w js/chmura.js.

const { chromium } = require('playwright');
const crypto = require('crypto');
const ADRES = process.argv[2] || 'https://andrish97.github.io/book/';
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
      await p.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
      await p.click('[data-akcja="dodaj-tekst"]');
      await p.click('[data-akcja="strona-dodaj"]');
      await p.setInputFiles('#plik-obraz', { name: 'a.png', mimeType: 'image/png', buffer: PNG });
      await p.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'image'));
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
      await p2.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
      // Obraz leży w magazynie plików przeglądarki (js/zasoby.js), pobrany z konta przy otwarciu projektu.
      const s = await p2.evaluate(async () => { const pr = window.seriodruk.stan.projekt; const { dataUrlZasobu } = await import('./js/zasoby.js'); const d = await dataUrlZasobu(pr, Object.keys(pr.zasoby).find((id) => !(pr.czcionki || []).some((c) => c.id === id))); return `${pr.strony.length} strony, ${pr.strony.reduce((n, x) => n + x.obiekty.length, 0)} elementy, obraz ${d?.startsWith('data:image') ? 'pobrany' : 'BRAK'}`; });
      // „Moje czcionki” na drugim urządzeniu: zbiór pobrany z konta.
      await p2.waitForFunction(async () => { const m = await import('./js/moje-czcionki.js'); const moje = await m.mojeCzcionki(window.seriodruk.stan.uzytkownik.id); return moje.some((c) => c.rodzina === 'Próbna' && c.dataUrl); }, null, { timeout: 40000, polling: 1500 });
      await k2.close();
      if (s.includes('BRAK')) throw new Error(s);
      return `${s}; czcionka ze zbioru pobrana`;
    });
    await krok('dwa urządzenia zmieniają różne strony – obie zmiany zostają', async () => {
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
        await p2.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
        const otwarta = (s) => s.evaluate(() => { const st = window.seriodruk.stan; return st.projekt.strony[st.indeks].id; });
        const [tam, tu] = [await otwarta(p2), await otwarta(p)];
        if (tam === tu) throw new Error('oba urządzenia mają otwartą tę samą stronę – próba niczego by nie sprawdziła');
        const przed = await p2.evaluate(() => window.seriodruk.stan.projekt.wersja_chmury);
        await p2.click('[data-akcja="dodaj-prostokat"]');
        await p2.waitForFunction((w) => window.seriodruk.stan.projekt.wersja_chmury > w && document.querySelector('#stan-zapisu .tekst')?.textContent === 'Zapisano', przed, { timeout: 40000 });
        const poDrugim = await p2.evaluate(() => window.seriodruk.stan.projekt.wersja_chmury);
        // Urządzenie 1 nic o tym nie wie i dodaje elipsę na swojej stronie: zapis ma połączyć obie zmiany bez pytania.
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
        return `połączone bez pytania; wersja na koncie ${poDrugim + 1}`;
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
