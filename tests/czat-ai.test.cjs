// Czat AI w Makietce (#217): własny klucz dostawcy (tu Anthropic – podstawiony serwer), te same narzędzia co
// łącznik MCP uruchomione w przeglądarce na otwartym projekcie (atrapa bazy), jednodniowy klucz dostępu tylko do
// tego projektu, pętla narzędzi aż do odpowiedzi, zmiana widoczna w projekcie.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

// N1 (23.11): dostawca, model i klucz ustawia się w Ustawieniach → Sztuczna inteligencja (sejf kluczy), nie w czacie.
async function kluczWSejfie(strona, id, klucz, model = '') {
  await strona.evaluate(([i, k, m]) => {
    localStorage.setItem('makietka-czat-ai', JSON.stringify({ dostawca: i, rola: 'edycja', dostawcy: { [i]: { model: m } } }));
    window.__klucz = (async () => { const { otwartySejf } = await import('./js/app/sejf-ai.js'); const s = await otwartySejf(); await s.ustaw(i, k); })();
  }, [id, klucz, model]);
  await strona.waitForSelector('#dlg-sejf-ai[open]');
  await strona.fill('#dlg-sejf-ai [name="haslo"]', 'moje-haslo-123');
  await strona.fill('#dlg-sejf-ai [name="powtorz"]', 'moje-haslo-123');
  await strona.click('#dlg-sejf-ai button[value="tak"]');
  await strona.evaluate(() => window.__klucz);
}

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

// Odpowiedź Anthropic jako strumień SSE: tekst po kawałkach, wejście narzędzia jako partial_json w dwóch kawałkach.
function sseAnthropic(w) {
  const z = [{ type: 'message_start', message: { id: w.id, type: 'message', role: 'assistant', model: w.model, content: [] } }];
  w.content.forEach((b, i) => {
    if (b.type === 'text') {
      z.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      for (const k of b.text.match(/.{1,5}/gs)) z.push({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: k } });
    } else {
      z.push({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      const j = JSON.stringify(b.input);
      const pol = Math.floor(j.length / 2);
      z.push({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j.slice(0, pol) } });
      z.push({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j.slice(pol) } });
    }
    z.push({ type: 'content_block_stop', index: i });
  });
  z.push({ type: 'message_delta', delta: { stop_reason: w.stop_reason } }, { type: 'message_stop' });
  return z.map((x) => `event: ${x.type}\ndata: ${JSON.stringify(x)}\n\n`).join('');
}

test('czat AI: klucz Anthropic, narzędzia na otwartym projekcie, zmiana nazwy przez AI', async (t) => {
  const { strona, kontekst, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz firmowy');
  await zapisano(strona);
  const zapytania = [];
  await kontekst.route('https://api.anthropic.com/v1/**', async (r) => {
    const url = r.request().url();
    if (r.request().method() === 'OPTIONS') { await r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }); return; }
    if (url.includes('/models')) { await r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-sonnet-5-5' }] }) }); return; }
    const body = JSON.parse(r.request().postData());
    zapytania.push({ naglowki: r.request().headers(), body });
    const krok = zapytania.length;
    const odp = krok === 1
      ? { stop_reason: 'tool_use', content: [{ type: 'text', text: 'Sprawdzam projekt.' }, { type: 'tool_use', id: 'tu1', name: 'przeglad_projektu', input: {} }] }
      : krok === 2
        ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu2', name: 'nazwa_projektu', input: { nazwa: 'Kalendarz 2027' } }] }
        : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Zmieniłem nazwę projektu na „Kalendarz 2027”.' }] };
    // Streaming (#259): zdarzenia SSE jak w API Anthropic – tekst i JSON narzędzi w kawałkach.
    assert.equal(body.stream, true, 'czat prosi o strumień');
    await r.fulfill({ contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: sseAnthropic({ id: `m${krok}`, model: body.model, ...odp }) });
  });
  await strona.evaluate(async () => (await import('./js/app/czat-ai.js')).otworzCzatAi());
  await strona.waitForSelector('#dlg-czat-ai[open]');
  // Bez klucza: w czacie nie ma pól ustawień – wiadomość z przyciskiem do ustawień AI.
  assert.equal(await strona.locator('#dlg-czat-ai input[name="klucz"], #dlg-czat-ai select').count(), 0, 'w czacie tylko rozmowa');
  await strona.fill('#czat-ai-tekst', 'Cześć');
  await strona.press('#czat-ai-tekst', 'Enter');
  await strona.waitForSelector('#czat-ai-wiadomosci li.blad button');
  // Sejf kluczy (#241): pierwszy klucz – hasło do kluczy; na koncie tylko szyfrogram.
  await kluczWSejfie(strona, 'anthropic', 'sk-ant-test', 'claude-opus-5-5');
  await strona.fill('#czat-ai-tekst', 'Zmień nazwę projektu na Kalendarz 2027');
  await strona.press('#czat-ai-tekst', 'Enter');
  await strona.waitForFunction(() => /Zmieniłem nazwę/.test(document.querySelector('#czat-ai-wiadomosci').textContent), null, { timeout: 20000 });
  // Zapytania: nagłówki dostępu z przeglądarki, narzędzia bez narzędzi innych projektów, wyniki narzędzi z powrotem.
  assert.equal(zapytania.length, 3);
  assert.equal(zapytania[0].naglowki['x-api-key'], 'sk-ant-test');
  assert.equal(zapytania[0].naglowki['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(zapytania[0].body.model, 'claude-opus-5-5');
  const nazwy = zapytania[0].body.tools.map((x) => x.name);
  assert.ok(nazwy.includes('przeglad_projektu') && nazwy.includes('zmien_elementy'));
  assert.ok(!nazwy.includes('nowy_projekt') && !nazwy.includes('usun_projekt'), 'bez narzędzi do innych projektów');
  assert.ok(!('projekt' in (zapytania[0].body.tools.find((x) => x.name === 'przeglad_projektu').input_schema.properties || {})), 'projekt ustalony – bez parametru');
  assert.match(zapytania[0].body.system, /„Kalendarz firmowy”/);
  const wynik1 = zapytania[1].body.messages.at(-1).content[0];
  assert.equal(wynik1.type, 'tool_result');
  assert.equal(wynik1.tool_use_id, 'tu1');
  assert.ok(!wynik1.is_error, wynik1.content);
  assert.deepEqual(zapytania[1].body.messages.at(-2).content.map((b) => b.type), ['text', 'tool_use'], 'cała odpowiedź wraca do historii');
  // Zmiana w bazie przez jednodniowy klucz tylko do tego projektu.
  assert.equal(baza.projekty[0].nazwa, 'Kalendarz 2027');
  const klucz = (baza.dostepy || baza.ai?.dostepy || []).at(-1);
  if (klucz) assert.deepEqual([klucz.opis, klucz.rola, klucz.projekty.length], ['Czat w Makietce', 'edycja', 1], 'jednodniowy klucz tylko do tego projektu');
  assert.match(await strona.textContent('#czat-ai-wiadomosci'), /🔧 przeglad_projektu[\s\S]*🔧 nazwa_projektu/);
  // Klucz nigdzie jawnie: ani na koncie (sam szyfrogram), ani w pamięci przeglądarki.
  const naKoncie = JSON.stringify([...baza.sejfy.values()]);
  assert.ok(naKoncie.includes('szyfr') && !naKoncie.includes('sk-ant-test'), 'na koncie szyfrogram');
  assert.ok(!naKoncie.includes('sdk_'), 'jednodniowy klucz czatu też zaszyfrowany');
  assert.equal(await strona.evaluate(() => JSON.stringify(localStorage).includes('sk-ant-test') || JSON.stringify(localStorage).includes('sdk_')), false, 'nic jawnie w localStorage');
  // „Nowe urządzenie”: bez zapamiętanego klucza sejfu – hasło; złe odrzucone, dobre otwiera i klucz wraca.
  await strona.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('makietka-sejf'); r.onsuccess = ok; r.onerror = ok; r.onblocked = ok; }));
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk?.edytor?.canvas);
  await strona.evaluate(async () => (await import('./js/app/czat-ai.js')).otworzCzatAi());
  await strona.fill('#czat-ai-tekst', 'Co jest w projekcie?');
  await strona.press('#czat-ai-tekst', 'Enter');
  await strona.waitForSelector('#dlg-sejf-ai[open]');
  assert.match(await strona.textContent('#dlg-sejf-ai h2'), /Otwórz klucze AI na tym urządzeniu/);
  assert.match(await strona.textContent('#dlg-sejf-ai'), /nawet administratorzy Makietki/);
  await strona.fill('#dlg-sejf-ai [name="haslo"]', 'zle-haslo-000');
  await strona.click('#dlg-sejf-ai button[value="tak"]');
  await strona.waitForFunction(() => /Nieprawidłowe hasło/.test(document.querySelector('#dlg-sejf-ai .blad-sejfu').textContent));
  await strona.fill('#dlg-sejf-ai [name="haslo"]', 'moje-haslo-123');
  await strona.click('#dlg-sejf-ai button[value="tak"]');
  for (let i = 0; i < 150 && zapytania.length < 4; i += 1) await strona.waitForTimeout(100);
  assert.equal(zapytania.at(-1).naglowki['x-api-key'], 'sk-ant-test', 'po otwarciu sejfu – klucz z konta');
  assert.deepEqual(bledy, []);
});

// #239: czat bez klucza API – „kopiuj i wklej” z darmowym czatem w przeglądarce. Polecenie dla czatu (zasady,
// narzędzia, stan projektu, zadanie) trafia do schowka; wklejona odpowiedź z blokiem ```makietka wykonuje narzędzia
// i daje wyniki do odesłania czatowi.
test('czat AI bez klucza: kopiuj i wklej – polecenie dla czatu, wklejona odpowiedź wykonuje zmiany', async (t) => {
  const { strona, kontekst, baza, bledy } = await otworz(t);
  await kontekst.grantPermissions(['clipboard-read', 'clipboard-write']);
  await nowyProjekt(strona, 'Plakat');
  await zapisano(strona);
  await strona.evaluate(() => localStorage.setItem('makietka-czat-ai', JSON.stringify({ dostawca: 'schowek', rola: 'edycja', dostawcy: {} })));
  await strona.evaluate(async () => (await import('./js/app/czat-ai.js')).otworzCzatAi());
  await strona.waitForSelector('#dlg-czat-ai[open]');
  assert.match(await strona.textContent('#czat-ai-kto'), /Kopiuj i wklej/);
  await strona.fill('#czat-ai-tekst', 'Zmień nazwę projektu na Plakat koncertu');
  await strona.press('#czat-ai-tekst', 'Enter');
  await strona.waitForSelector('.czat-ai-do-skopiowania');
  const polecenie = await strona.textContent('.czat-ai-do-skopiowania');
  assert.match(polecenie, /```makietka/);
  assert.match(polecenie, /- nazwa_projektu\(nazwa\*: string\)/);
  assert.match(polecenie, /STAN PROJEKTU[\s\S]*Plakat/);
  assert.match(polecenie, /ZADANIE UŻYTKOWNIKA:\nZmień nazwę projektu na Plakat koncertu$/);
  assert.equal(await strona.evaluate(() => navigator.clipboard.readText()), polecenie, 'polecenie w schowku');
  // Odpowiedź darmowego czatu wklejona do Makietki.
  const odpowiedz = 'Zmienię nazwę.\n```makietka\n[{"narzedzie": "nazwa_projektu", "parametry": {"nazwa": "Plakat koncertu"}}]\n```';
  await strona.fill('#czat-ai-tekst', odpowiedz);
  await strona.press('#czat-ai-tekst', 'Enter');
  await strona.waitForFunction(() => document.querySelectorAll('.czat-ai-do-skopiowania').length === 2);
  const wyniki = await strona.$$eval('.czat-ai-do-skopiowania', (l) => l[1].textContent);
  assert.match(wyniki, /^Wyniki z Makietki:\n\nWYNIK nazwa_projektu:/);
  assert.equal(baza.projekty[0].nazwa, 'Plakat koncertu');
  assert.deepEqual(bledy, []);
});

// Zdjęcia w rozmowie (#260): dołączone zdjęcie model widzi (blok image), a Makietka wgrywa je do projektu.
test('czat AI: dołączone zdjęcie – model je widzi, a plik trafia do projektu', async (t) => {
  const { strona, kontekst, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Ze zdjęciem');
  await zapisano(strona);
  const zapytania = [];
  await kontekst.route('https://api.anthropic.com/v1/**', async (r) => {
    if (r.request().method() === 'OPTIONS') { await r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }); return; }
    if (r.request().url().includes('/models')) { await r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: [{ id: 'claude-opus-5-5' }] }) }); return; }
    const body = JSON.parse(r.request().postData());
    zapytania.push(body);
    await r.fulfill({ contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: sseAnthropic({ id: 'm1', model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text: 'Widzę zdjęcie.' }] }) });
  });
  await strona.evaluate(async () => (await import('./js/app/czat-ai.js')).otworzCzatAi());
  await strona.waitForSelector('#dlg-czat-ai[open]');
  await kluczWSejfie(strona, 'anthropic', 'sk-ant-test', 'claude-opus-5-5');
  await strona.setInputFiles('#czat-ai-plik', { name: 'kot.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForSelector('#czat-ai-zalaczniki li');
  await strona.fill('#czat-ai-tekst', 'Co jest na zdjęciu?');
  await strona.press('#czat-ai-tekst', 'Enter');
  await strona.waitForFunction(() => [...document.querySelectorAll('.czat-ai-wiadomosci li.ai')].some((li) => li.textContent === 'Widzę zdjęcie.'));
  const tresc = zapytania[0].messages[0].content;
  assert.equal(tresc[0].type, 'image', 'zdjęcie w wiadomości');
  assert.equal(tresc[0].source.media_type, 'image/png');
  assert.match(tresc.at(-1).text, /^Co jest na zdjęciu\?[\s\S]*„kot\.png” – wgrany do projektu/);
  assert.equal(await strona.isVisible('#czat-ai-zalaczniki'), false, 'po wysłaniu lista pusta');
  assert.ok([...(baza.obrazyAi || new Map()).values()].some((o) => /kot/.test(o.nazwa || '')) || JSON.stringify(baza.projekty).includes('kot.png'), 'plik w projekcie');
  assert.deepEqual(bledy, []);
});
