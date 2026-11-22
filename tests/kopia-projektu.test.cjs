// „Duplikuj” projekt, którego obrazów nie ma na tym urządzeniu (projekt z innego urządzenia albo od AI): kopia
// pobiera obrazy z konta zamiast zostać bez nich (zgłoszenie właściciela 22.11: „nie mogę zrobić kopii projektu”).
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

test('kopia projektu: obrazy tylko na koncie – kopia je pobiera i ma własne pliki', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Z obrazem');
  await strona.setInputFiles('#pliki-zasoby', { name: 'kot.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForFunction(() => Object.keys(window.seriodruk.stan.projekt.zasoby || {}).length === 1);
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await (await import('./js/app/zapis.js')).synchronizuj({ wymus: true }); });
  await strona.waitForFunction(() => Object.values(window.seriodruk.stan.projekt.zasoby)[0].sciezka, null, { timeout: 15000 });
  // to urządzenie „nie ma” pliku obrazu – jak projekt z innego urządzenia
  await strona.evaluate(async () => { const p = window.seriodruk.stan.projekt; const z = await import('./js/zasoby.js'); await z.usunPlikZasobu(p, Object.keys(p.zasoby)[0]); });
  await strona.click('#ekran-edytora [data-akcja="do-projektow"]');
  await strona.waitForSelector('.karta-projektu:has-text("Z obrazem") .menu-karty');
  await strona.click('.karta-projektu:has-text("Z obrazem") .menu-karty');
  await strona.click('.karta-projektu:has-text("Z obrazem") [data-op="duplikuj"]');
  await strona.waitForSelector('.karta-projektu:has-text("Z obrazem (kopia)")', { timeout: 30000 });
  await strona.waitForFunction(() => /Utworzono/.test(document.querySelector('#powiadomienie')?.textContent || ''), null, { timeout: 30000 });
  // kopia na koncie: obraz ma własny plik w folderze kopii
  for (let i = 0; i < 100 && baza.projekty.length < 2; i += 1) await strona.waitForTimeout(100);
  const kopia = baza.projekty.find((p) => p.nazwa === 'Z obrazem (kopia)');
  assert.ok(kopia, 'kopia na koncie');
  const zas = Object.values(kopia.dane?.zasoby || kopia.zasoby || {})[0];
  assert.ok(zas?.sciezka, 'obraz kopii ma plik na koncie');
  assert.ok(zas.sciezka.includes(kopia.id), `plik w folderze kopii: ${zas.sciezka}`);
  assert.ok([...baza.pliki.keys()].some((k) => k.includes(`${kopia.id}/`)), 'plik wysłany pod kopią');
  assert.deepEqual(bledy, []);
});

test('kopia z łącznika AI: wskazuje na pliki oryginału – usunięcie oryginału ich nie kasuje, otwarcie kopii daje własne pliki', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Oryginał');
  await strona.setInputFiles('#pliki-zasoby', { name: 'kot.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForFunction(() => Object.keys(window.seriodruk.stan.projekt.zasoby || {}).length === 1);
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await (await import('./js/app/zapis.js')).synchronizuj({ wymus: true }); });
  await strona.waitForFunction(() => Object.values(window.seriodruk.stan.projekt.zasoby)[0].sciezka, null, { timeout: 15000 });
  const org = baza.projekty.find((p) => p.nazwa === 'Oryginał');
  const plikOrg = Object.values(org.dane.zasoby)[0].sciezka;
  // kopia jak z ai_kopiuj_projekt: ten sam JSON, obraz wskazuje na plik oryginału
  const idKopii = '22222222-2222-4222-8222-222222222222';
  baza.projekty.push({ ...JSON.parse(JSON.stringify(org)), id: idKopii, nazwa: 'Kopia od AI', wersja: 1, dane: { ...JSON.parse(JSON.stringify(org.dane)), id: idKopii, nazwa: 'Kopia od AI' } });
  for (const [k, v] of [...baza.strony]) if (k.startsWith(`${org.id}/`)) baza.strony.set(`${idKopii}/${k.slice(org.id.length + 1)}`, JSON.parse(JSON.stringify(v)));
  // usunięcie oryginału w aplikacji – plik, na który wskazuje kopia, zostaje
  await strona.click('#ekran-edytora [data-akcja="do-projektow"]');
  await strona.waitForSelector('.karta-projektu:has-text("Kopia od AI")', { timeout: 15000 });
  await strona.click('.karta-projektu:has(strong:text-is("Oryginał")) .menu-karty');
  await strona.click('.karta-projektu:has(strong:text-is("Oryginał")) [data-op="usun"]');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  await strona.click('#potwierdz-tak');
  for (let i = 0; i < 100 && baza.projekty.some((p) => p.id === org.id); i += 1) await strona.waitForTimeout(100);
  assert.ok(!baza.projekty.some((p) => p.id === org.id), 'oryginał usunięty');
  assert.ok(baza.pliki.has(`zasoby/${plikOrg}`), 'plik oryginału zostaje – wskazuje na niego kopia');
  // otwarcie kopii: obraz widać, przy zapisie kopia dostaje własny plik
  await strona.click('.karta-projektu:has-text("Kopia od AI") .otworz-projekt');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa === 'Kopia od AI');
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await (await import('./js/app/zapis.js')).synchronizuj({ wymus: true }); });
  for (let i = 0; i < 100 && !Object.values(baza.projekty.find((p) => p.id === idKopii).dane.zasoby)[0].sciezka.includes(idKopii); i += 1) await strona.waitForTimeout(100);
  const nowa = Object.values(baza.projekty.find((p) => p.id === idKopii).dane.zasoby)[0].sciezka;
  assert.ok(nowa.includes(`/${idKopii}/`), `kopia ma własny plik: ${nowa}`);
  assert.ok(baza.pliki.has(`zasoby/${nowa}`));
  assert.deepEqual(bledy, []);
});
