// #438, etap C: link do podglądu rysuje karta pod dzierżawą pracy z jednej kolejki konta (atrapa kolejki:
// tests/atrapa-prace.cjs – te same zasady co migracja). Sprawdzamy: aktualizacja po zmianie idzie przez dzierżawę
// i kończy się wersją zapisu; nowa zmiana w trakcie przerywa rysowanie po bieżącej stronie (już narysowane strony
// zostają), po chwili spokoju link dochodzi do najnowszej wersji; słabe urządzenie (telefon na danych komórkowych)
// nie bierze pracy, a bierze ją komputer z tego samego konta, który ma otwartą tylko listę projektów.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, zaloguj, drugieUrzadzenie } = require('./pomoc.cjs');

async function zLinkiem(t, { stron = 6 } = {}) {
  const o = await otworz(t, { tryb: 'atrapa' });
  await zaloguj(o.strona, o.baza);
  await nowyProjekt(o.strona, 'Kolejka');
  await o.strona.evaluate(async (n) => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    for (let i = 2; i <= n; i += 1) p.strony.push(P.nowaStrona(`S${i}`, p.sekcje[0].id));
    p.strony.forEach((s, i) => { s.obiekty = [{ type: 'textbox', id: `t${i}`, left: 10, top: 10, width: 80, text: `Strona ${i + 1}`, fontFamily: 'Inter', fontSize: 8 }]; });
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  }, stron);
  await o.strona.click('[data-akcja="podglad"]');
  await o.strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await o.strona.click('[data-akcja="udostepnij"]');
  await o.strona.click('#udostepnij-utworz');
  await o.strona.waitForFunction(() => /^Gotowe|Link gotowy/.test(document.querySelector('#udostepnij-komunikat').textContent), null, { timeout: 30000 });
  await o.strona.waitForFunction(() => !(document.querySelector('.postep-pasek, .pasek-postepu')?.offsetParent), null, { timeout: 30000 }).catch(() => {});
  await o.strona.keyboard.press('Escape');
  // Projekt na koncie (pierwsza wysyłka) i praca linku zakończona – start od spokojnego stanu.
  const pid = await o.strona.evaluate(() => window.seriodruk.stan.projekt.id);
  for (let i = 0; i < 150; i += 1) {
    const z = (o.baza.prace || []).find((x) => x.projekt_id === pid);
    if (o.baza.projekty.some((p) => p.id === pid) && (!z || z.stan === 'gotowe')) break;
    await new Promise((ok) => { setTimeout(ok, 200); });
  }
  return o;
}

// Zmiana tekstu stron (w zapisie projektu) i zapis na koncie – jak zmiana w edytorze.
const zmien = (strona, ktore, napis) => strona.evaluate(async ({ ktore: k, napis: n }) => {
  const { stan } = window.seriodruk;
  for (const i of k) stan.projekt.strony[i].obiekty[0].text = `${n} ${i + 1}`;
  const z = await import('./js/app/zapis.js');
  z.odlaczPlotno?.();
  await z.zapiszTeraz();
}, { ktore, napis });

test('link po zmianie: rysuje karta pod dzierżawą, nowa zmiana przerywa i link dochodzi do najnowszej wersji', async (t) => {
  const { strona, baza, kontekst, bledy } = await zLinkiem(t, { stron: 8 });
  const pid = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  const projekt = () => baza.projekty.find((p) => p.id === pid);
  const praca = () => baza.prace.find((z) => z.projekt_id === projekt().id);
  const karta = await strona.evaluate(async () => (await import('./js/app/prace-w-tle.js')).KARTA);
  // 1) Zwykła zmiana jednej strony: praca wzięta przez tę kartę i zakończona wersją zapisu.
  baza.historiaPrac.length = 0;
  const naKoncie = async (przed) => { for (let i = 0; i < 100 && projekt().wersja <= przed; i += 1) await new Promise((ok) => { setTimeout(ok, 100); }); };
  let przed = projekt().wersja;
  await zmien(strona, [1], 'Zmiana');
  await naKoncie(przed);
  const doGotowej = async (wersja) => {
    for (let i = 0; i < 150 && !(praca()?.stan === 'gotowe' && praca().wykonana >= wersja); i += 1) await new Promise((ok) => { setTimeout(ok, 200); });
  };
  assert.ok(projekt(), `projekt na koncie: ${pid} ${JSON.stringify(baza.projekty.map((p) => [p.id, p.nazwa]))} ${Object.keys(baza).join(',')}`);
  await doGotowej(projekt().wersja);
  assert.equal(praca().stan, 'gotowe', JSON.stringify(praca()));
  assert.ok(baza.historiaPrac.some((h) => h.co === 'przejmij' && h.karta === karta), JSON.stringify(baza.historiaPrac));
  assert.ok(baza.historiaPrac.some((h) => h.co === 'zakoncz' && h.karta === karta));
  // 2) Wolne wysyłanie obrazów; zmiana wszystkich stron, a w trakcie – jeszcze jedna zmiana pierwszej strony.
  let wyslanych = 0;
  await kontekst.route(/\/podglady\/.*\.(webp|jpg)(\?|$)/, async (r) => {
    if (r.request().method() === 'GET') return r.fallback();
    wyslanych += 1;
    await new Promise((ok) => { setTimeout(ok, 700); });
    return r.fallback();
  });
  baza.historiaPrac.length = 0;
  await zmien(strona, [0, 1, 2, 3, 4, 5, 6, 7], 'Druga');
  for (let i = 0; i < 100 && wyslanych < 2; i += 1) await new Promise((ok) => { setTimeout(ok, 200); });
  assert.ok(wyslanych >= 2 && wyslanych < 8, `rysowanie trwa: ${wyslanych} ${JSON.stringify(baza.historiaPrac)} ${JSON.stringify(praca())} ${projekt().wersja}`);
  przed = projekt().wersja;
  await zmien(strona, [0], 'Trzecia');
  await naKoncie(przed);
  const ostatnia = projekt().wersja;
  await doGotowej(ostatnia);
  assert.equal(praca().stan, 'gotowe');
  assert.ok(praca().wykonana >= ostatnia, 'link doszedł do najnowszej wersji');
  assert.ok(baza.historiaPrac.some((h) => h.co === 'zwolnij'), `przerwane dla nowszej wersji: ${JSON.stringify(baza.historiaPrac)}`);
  assert.ok(wyslanych <= 10, `strony narysowane przed przerwaniem nie rysują się drugi raz (wysłano ${wyslanych} na 8 + 1 zmienioną)`);
  const opis = JSON.parse([...baza.pliki].find(([k]) => k.startsWith('podglady/') && k.endsWith('manifest.json'))[1].tresc.toString());
  assert.equal(opis.przygotowanie, undefined, 'link kompletny');
  assert.equal(Object.keys(opis.pliki).length, 8);
  assert.deepEqual(bledy, []);
});

test('telefon na danych komórkowych nie bierze pracy – bierze ją komputer z listą projektów', async (t) => {
  const o = await zLinkiem(t, { stron: 3 });
  const { strona, baza } = o;
  // Ta karta udaje telefon na danych komórkowych.
  await strona.evaluate(async () => {
    globalThis.__ocenaUrzadzenia = { klasa: 'telefon', punkty: 100, male: false, duze: false };
    (await import('./js/app/prace-w-tle.js')).ogloszObecnosc();
  });
  // Komputer tego samego konta: tylko lista projektów.
  const komp = await drugieUrzadzenie(o);
  await zaloguj(komp.strona, baza);
  const kartaKomp = await komp.strona.evaluate(async () => { const m = await import('./js/app/prace-w-tle.js'); return m.KARTA; });
  await komp.strona.waitForFunction(() => true);
  await new Promise((ok) => { setTimeout(ok, 1500); }); // obecność kart
  const pid = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  const zapisy = { tel: 0, komp: 0 };
  strona.on('request', (r) => { if (/rpc\/zapisz_projekt/.test(r.url())) zapisy.tel += 1; });
  komp.strona.on('request', (r) => { if (/rpc\/zapisz_projekt/.test(r.url())) zapisy.komp += 1; });
  baza.historiaPrac.length = 0;
  const przedT = baza.projekty.find((p) => p.id === pid).wersja;
  await zmien(strona, [0], 'Z telefonu');
  for (let i = 0; i < 100 && baza.projekty.find((p) => p.id === pid).wersja <= przedT; i += 1) await new Promise((ok) => { setTimeout(ok, 100); });
  const praca = () => baza.prace.find((z) => z.projekt_id === pid);
  for (let i = 0; i < 150 && !(praca()?.stan === 'gotowe' && praca().wykonana >= praca().wersja); i += 1) await new Promise((ok) => { setTimeout(ok, 200); });
  assert.equal(praca().stan, 'gotowe', JSON.stringify({ praca: praca(), historia: baza.historiaPrac, zapisy }));
  const wzial = baza.historiaPrac.filter((h) => h.co === 'przejmij').map((h) => h.karta);
  assert.deepEqual([...new Set(wzial)], [kartaKomp], 'pracę wziął komputer');
  assert.deepEqual(komp.bledy, []);
});
