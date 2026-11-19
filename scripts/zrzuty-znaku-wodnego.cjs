// Zrzut instrukcji: k-znak-wodny.png – okno Udostępnij, część „Znak wodny” z suwakiem Krycie i podglądem (#305).
// Konto w atrapie bazy z testów (tests/pomoc.cjs), bez łączenia z prawdziwą bazą.
// Użycie:  node scripts/zrzuty-znaku-wodnego.cjs [adres] [ciemny]   (ciemny – img/instrukcja/ciemny/)

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');
const { kadr } = require('./zrzuty-instrukcji.cjs');

(async () => {
  const sprzatanie = [];
  const t = { after: (fn) => sprzatanie.push(fn) };
  const { strona } = await otworz(t, { tryb: 'atrapa', widok: { width: 1280, height: 900 } });
  try {
    await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
    await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
    await strona.click('#przycisk-logowania');
    await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
    await nowyProjekt(strona, 'Katalog wiosna');
    await strona.click('[data-akcja="podglad"]');
    await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
    if (process.argv[3] === 'ciemny') await strona.evaluate(() => { document.documentElement.dataset.motyw = 'ciemny'; });
    await strona.click('[data-akcja="udostepnij"]');
    await strona.waitForSelector('#udostepnij-znak:not([hidden])');
    await strona.check('#udostepnij-znak-wl');
    await strona.fill('#udostepnij-znak-tekst', 'PODGLĄD');
    await strona.evaluate(() => { const r = document.querySelector('#udostepnij-znak-krycie'); r.value = '20'; r.dispatchEvent(new Event('input')); });
    await strona.waitForTimeout(300);
    await kadr(strona, 'k-znak-wodny.png', { obszar: '#udostepnij-znak', zaznacz: '#udostepnij-znak-krycie-pole .makieta-suwak', margines: 10 });
  } finally {
    for (const fn of sprzatanie) await fn();
  }
})();
