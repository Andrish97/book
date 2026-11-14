// Klucze AI konta (decyzja #94, migracja 20261114200000_klucze_ai_konta.sql): zakres „wybrane projekty” albo
// „pełny dostęp”, projekt wskazany w każdym narzędziu łącznika, tworzenie i usuwanie projektów, projekty
// udostępnione przez innych (AI ma co najwyżej moje uprawnienia), zmiana zakresu, odebranie. Prawdziwy rdzeń
// łącznika na atrapie bazy (tests/atrapa-ai.cjs), bez przeglądarki.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { atrapaAi } = require('./atrapa-ai.cjs');

const RDZEN = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs');
const JA = { id: 'u-1', email: 'ja@example.com' };
const ONA = { id: 'u-2', email: 'ola@example.com', nazwa: 'Ola' };

function projekt(id, owner, nazwa) {
  return {
    id, owner_id: owner, nazwa, wersja: 1, zmieniono: '2026-11-01T00:00:00Z',
    dane: {
      id, nazwa, strony_osobno: false, zasoby: {},
      sekcje: [{ id: 'sek1', nazwa: 'Środek', wydruk: { szerokosc_mm: 148, wysokosc_mm: 210 } }],
      wzorce: [], style: [], tabele: [], serie: [],
      strony: [{ id: 's1', nazwa: 'Strona 1', sekcja: 'sek1', wzorce: 'z_sekcji', obiekty: [{ id: 't', type: 'textbox', text: nazwa, left: 10, top: 10, width: 80, height: 10 }] }],
    },
  };
}

async function srodowisko(t) {
  const stan = {
    konta: [JA, ONA],
    projekty: [projekt('p-1', JA.id, 'Kalendarz'), projekt('p-2', JA.id, 'Notes'), projekt('p-3', ONA.id, 'Album Oli'), projekt('p-4', ONA.id, 'Planer Oli')],
    strony: new Map(),
    wspolpracownicy: [{ projekt_id: 'p-3', uzytkownik: JA.id, rola: 'odczyt' }, { projekt_id: 'p-4', uzytkownik: JA.id, rola: 'edycja' }],
    oglaszane: [],
  };
  stan.oglos = (p, typ = 'UPDATE') => stan.oglaszane.push({ id: p.id, typ });
  const baza = atrapaAi(stan);
  const serwerHttp = http.createServer((req, res) => {
    let tresc = '';
    req.on('data', (c) => { tresc += c; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      try {
        res.end(JSON.stringify(baza(req.url.replace('/rest/v1/rpc/', ''), JSON.parse(tresc || '{}')) ?? null));
      } catch (e) { res.statusCode = e.status || 400; res.end(JSON.stringify({ message: e.message })); }
    });
  });
  await new Promise((r) => { serwerHttp.listen(0, '127.0.0.1', r); });
  t.after(() => serwerHttp.close());
  const rdzen = await import(pathToFileURL(RDZEN).href);
  const klucz = (opcje) => baza('utworz_dostep_ai', { p_opis: 'AI', p_rola: 'edycja', p_dni: 7, p_zakres: 'wybrane', p_projekty: [], ...opcje }, JA).klucz;
  const mcp = (k) => {
    const s = rdzen.utworzSerwer({ adres: `http://127.0.0.1:${serwerHttp.address().port}`, kluczPubliczny: 'sb_publishable_test', klucz: k });
    const wywolaj = async (name, args = {}) => {
      const w = await s.obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
      return { tekst: w.result.content[0].text, blad: w.result.isError };
    };
    return { s, wywolaj };
  };
  return { stan, baza, klucz, mcp, rdzen };
}

test('klucz z wybranymi projektami: jeden – bez wskazywania, kilka – projekt w każdym narzędziu (id albo nazwa), poza zakresem – odmowa', async (t) => {
  const e = await srodowisko(t);
  // Jeden projekt: działa jak dawny klucz projektu, bez parametru.
  const jeden = e.mcp(e.klucz({ p_projekty: ['p-1'] }));
  let w = await jeden.wywolaj('przeglad_projektu');
  assert.equal(w.blad, false, w.tekst);
  assert.match(w.tekst, /Projekt „Kalendarz” \(id p-1\)/);
  w = await jeden.wywolaj('przeglad_projektu', { projekt: 'Notes' });
  assert.equal(w.blad, true);
  assert.match(w.tekst, /nie prowadzi do projektu „Notes”/);

  // Dwa projekty: bez wskazania – prośba o projekt; nazwa (bez względu na wielkość liter) i id działają.
  const dwa = e.mcp(e.klucz({ p_projekty: ['p-1', 'p-2'] }));
  w = await dwa.wywolaj('projekty');
  assert.match(w.tekst, /wybrane projekty, czyta i zmienia/);
  assert.match(w.tekst, /p-1 „Kalendarz” – Twój, możesz zmieniać/);
  assert.match(w.tekst, /p-2 „Notes”/);
  assert.doesNotMatch(w.tekst, /Album Oli|Planer Oli/);
  w = await dwa.wywolaj('przeglad_projektu');
  assert.equal(w.blad, true);
  assert.match(w.tekst, /kilka projektów – podaj projekt/);
  w = await dwa.wywolaj('nazwa_projektu', { projekt: 'notes', nazwa: 'Notes 2027' });
  assert.equal(w.blad, false, w.tekst);
  assert.equal(e.stan.projekty.find((p) => p.id === 'p-2').nazwa, 'Notes 2027');
  w = await dwa.wywolaj('przeglad_projektu', { projekt: 'p-1' });
  assert.match(w.tekst, /Projekt „Kalendarz”/);
  // Klucz z wybranymi projektami nie tworzy ani nie usuwa projektów.
  w = await dwa.wywolaj('nowy_projekt', { nazwa: 'X' });
  assert.equal(w.blad, true);
  assert.match(w.tekst, /tylko klucz z pełnym dostępem/);
  w = await dwa.wywolaj('usun_projekt', { projekt: 'p-1', potwierdz: 'Kalendarz' });
  assert.match(w.tekst, /tylko klucz z pełnym dostępem/);

  // Lista narzędzi: „projekt” w każdym narzędziu projektu, nie w narzędziach konta.
  const lista = (await dwa.s.obsluz({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).result.tools;
  for (const n of lista) {
    if (['projekty', 'nowy_projekt', 'opis_formatu'].includes(n.name)) assert.equal(n.inputSchema.properties.projekt, undefined, n.name);
    else assert.ok(n.inputSchema.properties.projekt, n.name);
  }
  assert.deepEqual(lista.find((n) => n.name === 'usun_projekt').inputSchema.required, ['projekt', 'potwierdz']);
});

test('pełny dostęp: wszystkie projekty (także udostępnione – z moją rolą), tworzenie i usuwanie z potwierdzeniem nazwą', async (t) => {
  const e = await srodowisko(t);
  const ai = e.mcp(e.klucz({ p_zakres: 'pelny' }));
  let w = await ai.wywolaj('projekty');
  assert.match(w.tekst, /pełny dostęp – wszystkie projekty konta, czyta i zmienia; możesz tworzyć i usuwać projekty/);
  assert.match(w.tekst, /p-3 „Album Oli” – udostępnił\(a\): Ola, tylko czytasz/);
  assert.match(w.tekst, /p-4 „Planer Oli” – udostępnił\(a\): Ola, możesz zmieniać/);

  // Projekt, w którym tylko oglądam: AI też tylko czyta. Gdzie mogę edytować – AI też.
  w = await ai.wywolaj('nazwa_projektu', { projekt: 'Album Oli', nazwa: 'Zmiana' });
  assert.equal(w.blad, true);
  assert.match(w.tekst, /może tylko oglądać/);
  w = await ai.wywolaj('nazwa_projektu', { projekt: 'p-4', nazwa: 'Planer Oli 2027' });
  assert.equal(w.blad, false, w.tekst);

  // Nowy projekt – taki jak z „Nowy projekt” w aplikacji: sekcja z formatem, jedna strona, style; ogłoszony na żywo.
  w = await ai.wywolaj('nowy_projekt', { nazwa: 'Kalendarz 2028', format: 'A4', orientacja: 'poziom', uklad: 'rozkladowki', marginesy: 12 });
  assert.equal(w.blad, false, w.tekst);
  const id = /\(id ([0-9a-f-]{36})\)/.exec(w.tekst)[1];
  const nowy = e.stan.projekty.find((p) => p.id === id);
  assert.equal(nowy.owner_id, JA.id);
  assert.equal(nowy.nazwa, 'Kalendarz 2028');
  assert.equal(nowy.dane.sekcje[0].wydruk.szerokosc_mm, 297);
  assert.equal(nowy.dane.sekcje[0].wydruk.wysokosc_mm, 210);
  assert.equal(nowy.dane.sekcje[0].uklad, 'rozkladowki');
  assert.deepEqual(nowy.dane.sekcje[0].wydruk.marginesy, { gora: 12, dol: 12, wewnetrzny: 12, zewnetrzny: 12 });
  assert.deepEqual(nowy.dane.style.map((s) => s.nazwa), ['Tytuł', 'Nagłówek', 'Tekst', 'Podpis']);
  assert.equal(nowy.dane.strony.length, 1);
  assert.deepEqual(e.stan.oglaszane.at(-1), { id, typ: 'INSERT' });
  w = await ai.wywolaj('dodaj_elementy', { projekt: id, gdzie: `strona:${nowy.dane.strony[0]}`, elementy: [{ type: 'textbox', text: 'Styczeń', left: 10, top: 10 }] });
  assert.equal(w.blad, false, w.tekst);

  // Usuwanie: zła nazwa – odmowa z podpowiedzią; cudzy projekt – odmowa; poprawnie – znika i jest ogłoszone.
  w = await ai.wywolaj('usun_projekt', { projekt: id, potwierdz: 'kalendarz' });
  assert.equal(w.blad, true);
  assert.match(w.tekst, /dokładną nazwę projektu: „Kalendarz 2028”/);
  w = await ai.wywolaj('usun_projekt', { projekt: 'p-4', potwierdz: 'Planer Oli 2027' });
  assert.match(w.tekst, /tylko własny projekt/);
  w = await ai.wywolaj('usun_projekt', { projekt: 'Kalendarz 2028', potwierdz: 'Kalendarz 2028' });
  assert.equal(w.blad, false, w.tekst);
  assert.ok(!e.stan.projekty.some((p) => p.id === id));
  assert.deepEqual(e.stan.oglaszane.at(-1), { id, typ: 'DELETE' });

  // Wysyłka wprost i adres do wysyłki niosą projekt.
  w = await ai.wywolaj('adres_do_wysylki', { projekt: 'p-1' });
  assert.match(w.tekst, /\/obraz\?projekt=p-1&nazwa=/);
});

test('klucz tylko do odczytu, zmiana zakresu bez zmiany klucza, utrata dostępu i odebranie; pusty projekt jak w aplikacji', async (t) => {
  const e = await srodowisko(t);
  const czyta = e.mcp(e.klucz({ p_zakres: 'pelny', p_rola: 'odczyt' }));
  let w = await czyta.wywolaj('projekty');
  assert.match(w.tekst, /tylko czyta/);
  assert.doesNotMatch(w.tekst, /możesz tworzyć/);
  w = await czyta.wywolaj('nazwa_projektu', { projekt: 'p-1', nazwa: 'X' });
  assert.match(w.tekst, /tylko czytać/);
  w = await czyta.wywolaj('nowy_projekt', { nazwa: 'X' });
  assert.match(w.tekst, /tylko klucz z pełnym dostępem, który czyta i zmienia/);

  // Zmiana zakresu: ten sam klucz, inne projekty.
  const k = e.klucz({ p_projekty: ['p-1'] });
  const ai = e.mcp(k);
  const idKlucza = e.baza('dostepy_ai', {}, JA)[0].id;
  e.baza('zmien_dostep_ai', { p_id: idKlucza, p_zakres: 'wybrane', p_projekty: ['p-2'] }, JA);
  w = await ai.wywolaj('przeglad_projektu');
  assert.match(w.tekst, /Projekt „Notes”/);
  assert.match(e.baza('ai_projekt', { p_klucz: `${k}/p-1` }).blad, /nie obejmuje tego projektu/);
  assert.throws(() => e.baza('zmien_dostep_ai', { p_id: idKlucza, p_zakres: 'wybrane', p_projekty: ['p-obcy'] }, JA), /Nie masz dostępu/);
  assert.throws(() => e.baza('utworz_dostep_ai', { p_opis: 'x', p_rola: 'edycja', p_dni: 7, p_zakres: 'wybrane', p_projekty: [] }, JA), /co najmniej jeden projekt/);
  // Klucz konta Oli nie może objąć mojego projektu.
  assert.throws(() => e.baza('utworz_dostep_ai', { p_opis: 'x', p_rola: 'edycja', p_dni: 7, p_zakres: 'wybrane', p_projekty: ['p-1'] }, ONA), /Nie masz dostępu/);
  // Bez terminu.
  const bez = e.baza('utworz_dostep_ai', { p_opis: 'stały', p_rola: 'edycja', p_dni: null, p_zakres: 'pelny' }, JA);
  assert.equal(bez.wazny_do, null);
  assert.match((await e.mcp(bez.klucz).wywolaj('przeglad_projektu', { projekt: 'p-1' })).tekst, /klucz bez terminu/);

  // Ola odbiera mi dostęp do p-4 – klucz z pełnym dostępem traci go od razu.
  const pelny = e.mcp(e.klucz({ p_zakres: 'pelny' }));
  assert.equal((await pelny.wywolaj('przeglad_projektu', { projekt: 'p-4' })).blad, false);
  e.stan.wspolpracownicy = e.stan.wspolpracownicy.filter((x) => x.projekt_id !== 'p-4');
  w = await pelny.wywolaj('przeglad_projektu', { projekt: 'p-4' });
  assert.equal(w.blad, true);

  // Odebranie: klucz przestaje działać we wszystkich narzędziach.
  e.baza('odwolaj_dostep_ai', { p_id: idKlucza }, JA);
  w = await ai.wywolaj('projekty');
  assert.match(w.tekst, /odebrany/);

  // Pusty projekt łącznika ma te same pola co projekt z okna „Nowy projekt” w aplikacji.
  const { nowyProjekt, normalizujWydruk } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'projekt.js')).href);
  const zAplikacji = nowyProjekt('A', normalizujWydruk({ format: 'A5', szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, marginesy_mm: 10, znaki_ciecia: true }));
  const zLacznika = e.rdzen.pustyProjekt({ nazwa: 'A' });
  assert.deepEqual(Object.keys(zLacznika).sort(), Object.keys(zAplikacji).sort());
  assert.deepEqual(Object.keys(zLacznika.sekcje[0]).sort(), Object.keys(zAplikacji.sekcje[0]).sort());
  assert.deepEqual(zLacznika.sekcje[0].wydruk, zAplikacji.sekcje[0].wydruk);
  assert.deepEqual(Object.keys(zLacznika.strony[0]).sort(), Object.keys(zAplikacji.strony[0]).sort());
});
