// Zrzuty instrukcji do komiksu (#364, rozdział 10.13): k-komiks.png (strona komiksu z kadrami i dymkami, pasek
// narzędzi komiksu), k-komiks-kadry.png (okno „Kadry”), k-komiks-postacie.png i k-komiks-postac.png (karty postaci, #368), k-komiks-okno.png i k-komiks-scenariusz.png (#377–#378). Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje
// zrobZrzutyKomiksu na końcu; tu można je zrobić osobno.
//
// Użycie:  node scripts/zrzuty-komiksu.cjs [adres] [ciemny] [en|uk]

const { otworz, krokKomiksu, zMenu } = require('../tests/pomoc.cjs');

async function zrobZrzutyKomiksu(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: d } = await otworz({ after: (f) => sprzatanie.push(f) });
  try {
    await d.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    // Język zrzutu już przy tworzeniu projektu – przykładowy scenariusz, karty i style powstają w tym języku.
    const jezyk = process.argv.slice(3).find((x) => ['en', 'uk'].includes(x));
    const naJezykZrzutu = async () => { if (jezyk) await d.evaluate(async (j) => (await import('./js/jezyk.js')).ustawJezyk(j, { zapamietaj: false }), jezyk); };
    await naJezykZrzutu();
    // Nowy projekt z szablonu „Komiks” – tak jak użytkownik.
    await d.locator('[data-akcja="nowy-projekt"]:visible').first().click();
    await d.waitForSelector('#dlg-nowy[open]');
    await d.fill('#form-nowy [name="nazwa"]', 'Przygody Ali');
    await d.check('#form-nowy input[name="start"][value="szablon"]', { force: true });
    await d.click('#nowy-szablony .karta-szablonu[data-id="komiks"]');
    await d.waitForSelector('#nowy-szablony #gotowe-szczegoly:not([hidden])');
    await d.click('#gotowe-wstaw');
    await d.waitForFunction(() => !document.querySelector('#dlg-nowy').open && window.seriodruk.stan.projekt?.nazwa === 'Przygody Ali', null, { timeout: 15000 });
    await d.evaluate(async () => {
      const x = window.seriodruk.stan.projekt;
      const kom = x.sekcje.find((s) => s.typ === 'komiks');
      await window.seriodruk.przejdzDoStrony(x.strony.findIndex((s) => s.sekcja === kom.id));
    });
    await d.waitForFunction(() => document.body.classList.contains('w-komiksie'));
    await krokKomiksu(d, 'dymki');
    await d.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.dymek).length === 3);
    await d.evaluate(() => { const c = window.seriodruk.edytor.canvas; c.discardActiveObject(); c.requestRenderAll(); document.querySelector('#powiadomienie')?.setAttribute('hidden', ''); });
    await d.waitForTimeout(600);
    await kadr(d, 'k-komiks.png', { obszar: '#obszar-roboczy', zaznacz: ['[data-akcja="komiks-kadry"]', '[data-akcja="komiks-dymek-mowa"]', '[data-akcja="komiks-mostek"]', '[data-akcja="komiks-okno"]'], margines: 0 });
    // Okno „Kadry”.
    await d.click('[data-akcja="komiks-kadry"]');
    await d.waitForSelector('#dlg-kadry[open]');
    await d.waitForTimeout(300);
    await kadr(d, 'k-komiks-kadry.png', { obszar: '#dlg-kadry .formularz', zaznacz: '#dlg-kadry .uklad-kadrow:has(input:checked)', margines: 0 });
    await d.click('#dlg-kadry button[value="nie"]');
    // Obraz AI (#372): okno z opisem i kosztem – kadr 1 zaznaczony (bez generowania, bez kosztów).
    await d.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.setActiveObject(e.canvas.getObjects().find((o) => o.kadr_nr === 1)); e.canvas.requestRenderAll(); });
    await naJezykZrzutu(); // okno składa napisy przy otwarciu (kadr() wraca do polskiego po każdym zrzucie)
    await zMenu(d, 'ai-menu', 'obraz');
    await d.waitForSelector('#dlg-ai-obraz[open]');
    await d.evaluate(async () => { const { t } = await import('./js/jezyk.js'); const o = document.querySelector('#dlg-ai-obraz textarea'); o.value = t('aiObraz.przyklad').replace(/^(np\.|e\.g\.|напр\.)\s*/, ''); o.dispatchEvent(new Event('input')); });
    await d.waitForTimeout(300);
    await kadr(d, 'k-obraz-ai.png', { obszar: '#dlg-ai-obraz .formularz', zaznacz: '#dlg-ai-obraz button[value="tak"]', margines: 0 });
    await d.click('#dlg-ai-obraz [data-rola="anuluj"]');
    // Postacie i miejsca: obrazy wzorcowe (proste rysunki SVG) do przykładowych kart z szablonu.
    await d.evaluate(async () => {
      const { przyjmijPlik } = await import('./js/obrazy-projektu.js');
      const { karty, zapiszKarte } = await import('./js/postacie.js');
      const p = window.seriodruk.stan.projekt;
      const twarz = (wlosy, ubranie, tlo, okulary) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="${tlo}"/><path d="M40 240c8-54 40-78 80-78s72 24 80 78z" fill="${ubranie}"/><circle cx="120" cy="104" r="52" fill="#f6d2b8"/><path d="M66 100c0-40 26-62 54-62s54 22 54 62c-14-18-30-26-54-26s-40 8-54 26z" fill="${wlosy}"/><circle cx="100" cy="108" r="6" fill="#2b2b2b"/><circle cx="140" cy="108" r="6" fill="#2b2b2b"/><path d="M102 132q18 14 36 0" stroke="#2b2b2b" stroke-width="5" fill="none" stroke-linecap="round"/>${okulary ? '<g fill="none" stroke="#2b2b2b" stroke-width="4"><circle cx="100" cy="108" r="15"/><circle cx="140" cy="108" r="15"/><path d="M115 108h10"/></g>' : ''}</svg>`;
      const miasto = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#bfe3f5"/><circle cx="190" cy="50" r="24" fill="#ffd25a"/><rect x="10" y="90" width="70" height="120" fill="#e9876b"/><rect x="85" y="70" width="70" height="140" fill="#f2c14e"/><rect x="160" y="100" width="70" height="110" fill="#7fb77e"/><g fill="#fff"><rect x="25" y="110" width="16" height="22"/><rect x="50" y="110" width="16" height="22"/><rect x="100" y="90" width="16" height="22"/><rect x="125" y="90" width="16" height="22"/><rect x="175" y="120" width="16" height="22"/><rect x="200" y="120" width="16" height="22"/></g><rect y="208" width="240" height="32" fill="#9a8f84"/></svg>';
      const obraz = async (svg, nazwa) => (await przyjmijPlik(p, new Blob([svg], { type: 'image/svg+xml' }), nazwa)).nazwa;
      const [ala, ola] = karty(p, 'postacie');
      zapiszKarte(p, 'postacie', { ...ala, obraz: await obraz(twarz('#c8502a', '#4f9d5d', '#fdf1dc', false), 'ala.svg'), kolor: '#fff4c2' });
      zapiszKarte(p, 'postacie', { ...ola, obraz: await obraz(twarz('#222', '#3f6fb5', '#e6efff', true), 'ola.svg') });
      const [m] = karty(p, 'miejsca');
      zapiszKarte(p, 'miejsca', { ...m, obraz: await obraz(miasto, 'miasteczko.svg') });
    });
    await naJezykZrzutu();
    await krokKomiksu(d, 'postacie');
    await d.waitForSelector('#dlg-postacie[open] .karta-komiksu img');
    await d.waitForTimeout(400);
    await kadr(d, 'k-komiks-postacie.png', { obszar: '#dlg-postacie .formularz', zaznacz: '#dlg-postacie [data-akcja-karty="dodaj-postacie"]', margines: 0 });
    await d.locator('#dlg-postacie .karta-komiksu:not(.dodaj)').first().click();
    await d.waitForSelector('#dlg-postacie input[name="imie"]');
    await d.waitForTimeout(300);
    await kadr(d, 'k-komiks-postac.png', { obszar: '#dlg-postacie .formularz', margines: 0 });
    await d.locator('#dlg-postacie .przyciski-dialogu .przycisk:not(.glowny):not(.niebezpieczny)').click();
    await d.evaluate(() => document.querySelector('#dlg-postacie').close());
    // Okno „Komiks krok po kroku” (#377) i okno „Scenariusz” (#378).
    await naJezykZrzutu();
    await d.click('[data-akcja="komiks-okno"]');
    await d.waitForSelector('#dlg-komiks[open] .krok-komiksu');
    await d.waitForTimeout(400);
    await kadr(d, 'k-komiks-okno.png', { obszar: '#dlg-komiks .formularz', zaznacz: '#dlg-komiks [data-krok-akcja="scenariusz"]', margines: 0 });
    await naJezykZrzutu();
    await d.click('#dlg-komiks [data-krok-akcja="scenariusz"]');
    await d.waitForSelector('#dlg-scenariusz[open] .kadr-scenariusza');
    await d.waitForTimeout(400);
    await kadr(d, 'k-komiks-scenariusz.png', { obszar: '#dlg-scenariusz .formularz', zaznacz: '#dlg-scenariusz [data-strona="1"] [data-kadr="2"]', margines: 0 });
    await d.click('#dlg-scenariusz [data-rola="anuluj"]');
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyKomiksu };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyKomiksu(kadr, { ciemny: process.argv.slice(3).includes('ciemny') }).catch((e) => { console.error(e); process.exit(1); });
}
