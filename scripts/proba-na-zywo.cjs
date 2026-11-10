// Próba na prawdziwej bazie: przechodzi opublikowaną aplikację jak użytkownik.
//
//   node scripts/proba-na-zywo.cjs [adres aplikacji]
//
// Rejestruje konto testowe (losowy adres w domenie example.com, bez wysyłki
// poczty), zapisuje projekt z obrazem, sprawdza odczyt na drugim urządzeniu,
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
const wyniki = [];
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
      const s = await p2.evaluate(() => { const pr = window.seriodruk.stan.projekt; return `${pr.strony.length} strony, ${pr.strony.reduce((n, x) => n + x.obiekty.length, 0)} elementy, obraz ${Object.values(pr.zasoby)[0]?.dataUrl?.startsWith('data:image') ? 'pobrany' : 'BRAK'}`; });
      await k2.close();
      if (s.includes('BRAK')) throw new Error(s);
      return s;
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
    await krok('wyłączenie linku', async () => {
      await p.click('[data-akcja="udostepnij-wylacz"]');
      await p.click('#potwierdz-tak');
      await p.waitForFunction(() => /Link wyłączony/.test(document.querySelector('#udostepnij-komunikat')?.textContent || ''));
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
      } catch (e) { wyniki.push(`UWAGA: konto testowe mogło zostać w bazie (${e.message.split('\n')[0]})`); }
    }
    console.log(wyniki.join('\n'));
    console.log('--- odpowiedzi z błędem / błędy strony:', bledy.length ? `\n${[...new Set(bledy)].join('\n')}` : 'brak');
    await b.close();
  }
})();
