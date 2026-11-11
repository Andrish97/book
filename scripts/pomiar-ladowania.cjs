// Ile plików i ile kilobajtów kodu pobiera aplikacja na kolejnych ekranach: logowanie, lista projektów,
// otwarty projekt. Biegnie na atrapie bazy z testów (tests/pomoc.cjs), bez łączenia z prawdziwą bazą.
//
// Użycie:  node scripts/pomiar-ladowania.cjs
// Liczy rozmiar plików bez kompresji serwera (tak jak leżą w repozytorium).

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

(async () => {
  const sprzatanie = [];
  const { strona } = await otworz({ after: (f) => sprzatanie.push(f) }, { tryb: 'atrapa' });
  const pobrane = [];
  strona.on('response', async (r) => {
    try { pobrane.push([new URL(r.url()).pathname, (await r.body()).length]); } catch { /* przekierowania itp. */ }
  });
  const etap = async (nazwa) => {
    await strona.waitForTimeout(2500); // także to, co aplikacja doczytuje w tle
    const lista = pobrane.splice(0);
    const js = lista.filter(([u]) => /\.js$/.test(u));
    const kb = (l) => Math.round(l.reduce((s, [, n]) => s + n, 0) / 1024);
    console.log(`${nazwa}: ${lista.length} plików (${kb(lista)} kB), w tym ${js.length} plików JS (${kb(js)} kB)${js.some(([u]) => /fabric/.test(u)) ? ', z biblioteką płótna' : ''}`);
    return js;
  };
  await strona.reload();
  await strona.waitForSelector('#form-logowania input[name=email]', { state: 'visible' });
  await etap('Ekran logowania');
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.click('[data-akcja="zamknij-instrukcje"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await etap('Lista projektów (dodatkowo)');
  await nowyProjekt(strona, 'Pomiar');
  await etap('Otwarty projekt (dodatkowo)');
  for (const f of sprzatanie) await f();
})();
