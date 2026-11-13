// Otwarta karta edytora a zmiany AI z łącznika (MCP): karta nie może nadpisywać zmian AI ani wywoływać
// u AI serii konfliktów, gdy sama nic nie zmienia.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const RDZEN = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs');
const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

// Prawdziwy rdzeń łącznika podpięty do atrapy bazy otwartej strony.
async function lacznik(t, baza, klucz) {
  const rpc = [];
  const serwer = http.createServer((req, res) => {
    let tresc = '';
    req.on('data', (c) => { tresc += c; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      const nazwa = req.url.replace('/rest/v1/rpc/', '');
      try {
        const w = baza.ai(nazwa, JSON.parse(tresc || '{}'));
        rpc.push({ nazwa, wynik: w });
        res.end(JSON.stringify(w ?? null));
      } catch (e) { res.statusCode = e.status || 400; res.end(JSON.stringify({ message: e.message })); }
    });
  });
  await new Promise((r) => { serwer.listen(0, '127.0.0.1', r); });
  t.after(() => serwer.close());
  const { utworzSerwer } = await import(pathToFileURL(RDZEN).href);
  const s = utworzSerwer({ adres: `http://127.0.0.1:${serwer.address().port}`, kluczPubliczny: 'sb_publishable_test', klucz });
  const wywolaj = async (name, args = {}) => {
    const w = await s.obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
    if (w.result.isError) throw new Error(`${name}: ${w.result.content[0].text}`);
    return w.result.content[0].text;
  };
  return { wywolaj, rpc };
}

const naKoncie = (baza, klucz) => baza.ai('ai_projekt', { p_klucz: klucz }).projekt;
const pytanie = (strona) => strona.locator('#dlg-konflikt[open]').count();
// Czeka, aż zmiana z konta dotrze do karty (płótno ma ją pokazać), i chwilę dłużej – na ewentualny zapis karty.
async function doszlo(strona, warunek, arg) {
  await strona.waitForFunction(warunek, arg, { timeout: 15000 });
  await strona.waitForTimeout(2500);
}

async function przygotuj(t) {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Karta i AI');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ text: 'Tytuł', top: 120 }); e.aktywny.setCoords(); e.zatwierdz(); e.odznacz(); });
  await zapisano(strona);
  const { klucz } = await strona.evaluate(async (id) => (await import('./js/chmura.js')).utworzDostepAi(id, { opis: 'AI', dni: 1 }), baza.projekty[0].id);
  const ai = await lacznik(t, baza, klucz);
  const s1 = naKoncie(baza, klucz).strony[0];
  const tekst = s1.obiekty.find((o) => o.type.toLowerCase() === 'textbox');
  const prostokat = s1.obiekty.find((o) => o.type.toLowerCase() === 'rect');
  return { strona, baza, bledy, klucz, ai, s1, tekst, prostokat };
}

test('otwarta karta nie udaje zmian: element od AI (same podstawowe pola), tło i prowadnice zmieniane przez AI kilka razy – bez pytania i bez zapisów karty', async (t) => {
  const { strona, baza, bledy, klucz, ai, s1, tekst } = await przygotuj(t);
  const zapisyKarty = baza.zapisy.length;
  await ai.wywolaj('zmien_elementy', { gdzie: `strona:${s1.id}`, zmiany: [{ id: tekst.id, pola: { text: 'Od AI' } }] });
  // Element z samymi podstawowymi polami – płótno dopisze mu kilkadziesiąt pól domyślnych (wymiary, krój, krycie…).
  await ai.wywolaj('dodaj_elementy', { gdzie: `strona:${s1.id}`, elementy: [{ type: 'textbox', id: 'ai1', text: 'Nowy od AI', left: 50, top: 300 }] });
  await doszlo(strona, () => window.seriodruk.edytor.canvas.getObjects().some((o) => o.id === 'ai1'));
  // Ten sam element jeszcze raz: dotąd karta pytała tu „to samo zmieniono w dwóch miejscach”,
  // a odpowiedź „z tego urządzenia” cofała zmianę AI.
  await ai.wywolaj('zmien_elementy', { gdzie: `strona:${s1.id}`, zmiany: [{ id: 'ai1', pola: { text: 'Poprawione od AI', fill: '#ff0000' } }, { id: tekst.id, pola: { left: 77 } }] });
  await doszlo(strona, () => window.seriodruk.edytor.canvas.getObjects().find((o) => o.id === 'ai1')?.text === 'Poprawione od AI');
  assert.equal(await pytanie(strona), 0, 'karta nie pyta o element, którego nikt w niej nie ruszał');
  // Tło (kolor wielkimi literami) i prowadnice z ułamkami – płótno zapisuje je w innej postaci.
  await ai.wywolaj('zmien_strone', { id: s1.id, pola: { tlo: '#FFEEDD', prowadnice: { x: [10.123456], y: [] } } });
  await doszlo(strona, () => window.seriodruk.edytor.tla[0] === '#FFEEDD' || window.seriodruk.edytor.tla[0] === '#ffeedd');
  await ai.wywolaj('zmien_strone', { id: s1.id, pola: { tlo: '#FFEED0', prowadnice: { x: [20.987654], y: [5.55555] } } });
  await doszlo(strona, () => String(window.seriodruk.edytor.tla[0]).toLowerCase() === '#ffeed0');
  assert.equal(await pytanie(strona), 0, 'karta nie pyta o tło ani prowadnice, których nikt w niej nie ruszał');
  assert.equal(baza.zapisy.length, zapisyKarty, 'karta, która tylko stoi otwarta, nie wysyła własnych wersji po zmianach AI');
  assert.equal(ai.rpc.filter((r) => r.wynik?.konflikt).length, 0, 'AI nie dostaje odmów zapisu');
  const s = naKoncie(baza, klucz).strony[0];
  assert.equal(s.tlo, '#FFEED0');
  assert.deepEqual(s.prowadnice, { x: [20.987654], y: [5.55555] });
  const ai1 = s.obiekty.find((o) => o.id === 'ai1');
  assert.equal(ai1.text, 'Poprawione od AI');
  assert.equal(ai1.fill, '#ff0000');
  assert.equal(ai1.width, undefined, 'element od AI został w postaci od AI – bez pól dopisanych przez płótno');
  assert.equal(s.obiekty.find((o) => o.id === tekst.id).left, 77);
  assert.deepEqual(bledy, []);
});

test('zmiana w karcie i równoległe zmiany AI na tej samej stronie łączą się bez pytania; ten sam element – pytanie zostaje; „Cofnij” nie zdejmuje zmian AI', async (t) => {
  const { strona, baza, bledy, klucz, ai, s1, tekst, prostokat } = await przygotuj(t);
  await ai.wywolaj('dodaj_elementy', { gdzie: `strona:${s1.id}`, elementy: [{ type: 'textbox', id: 'ai1', text: 'Od AI', left: 50, top: 300 }] });
  await doszlo(strona, () => window.seriodruk.edytor.canvas.getObjects().some((o) => o.id === 'ai1'));
  // Użytkownik przesuwa prostokąt; w tym samym czasie AI zmienia swój element i tło strony.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const r = e.canvas.getObjects().find((x) => x.type === 'rect'); r.set({ top: 99 }); r.setCoords(); e.zatwierdz(); });
  await ai.wywolaj('zmien_elementy', { gdzie: `strona:${s1.id}`, zmiany: [{ id: 'ai1', pola: { text: 'Poprawione od AI' } }] });
  await ai.wywolaj('zmien_strone', { id: s1.id, pola: { tlo: '#AABBCC' } });
  await doszlo(strona, () => window.seriodruk.edytor.canvas.getObjects().find((o) => o.id === 'ai1')?.text === 'Poprawione od AI');
  await zapisano(strona);
  assert.equal(await pytanie(strona), 0);
  let s = naKoncie(baza, klucz).strony[0];
  assert.equal(s.obiekty.find((o) => o.id === prostokat.id).top, 99, 'zmiana użytkownika na koncie');
  assert.equal(s.obiekty.find((o) => o.id === 'ai1').text, 'Poprawione od AI', 'zmiana AI na koncie');
  assert.equal(s.obiekty.find((o) => o.id === 'ai1').width, undefined, 'zapis karty nie przepisał elementu AI w postaci z płótna');
  assert.equal(s.tlo, '#AABBCC');
  // „Cofnij” w karcie zdejmuje przesunięcie prostokąta, a zmiany AI zostają.
  await strona.click('[data-akcja="cofnij"]');
  await zapisano(strona);
  s = naKoncie(baza, klucz).strony[0];
  assert.notEqual(s.obiekty.find((o) => o.id === prostokat.id).top, 99);
  assert.equal(s.obiekty.find((o) => o.id === 'ai1').text, 'Poprawione od AI');
  assert.equal(s.tlo, '#AABBCC');
  // Prawdziwy konflikt: ten sam tekst zmieniony w karcie i przez AI – pytanie zostaje.
  await strona.evaluate((id) => { const e = window.seriodruk.edytor; const x = e.canvas.getObjects().find((o) => o.id === id); x.set({ text: 'Z karty' }); e.zatwierdz(); }, tekst.id);
  await ai.wywolaj('zmien_elementy', { gdzie: `strona:${s1.id}`, zmiany: [{ id: tekst.id, pola: { text: 'Z AI' } }] });
  await strona.waitForSelector('#dlg-konflikt[open]', { timeout: 15000 });
  assert.match(await strona.textContent('#dlg-konflikt'), /tekst „Z karty|tekst/);
  assert.deepEqual(bledy, []);
});
