// #438, etap B: kto wykonuje pracę w tle – karta z projektem, najmocniejsze urządzenie, telefon tylko na Wi-Fi
// (duża praca – tylko podczas ładowania), inaczej serwer; kolejność stron: oglądane → zmienione → brakujące → reszta.
// (Kolejka w bazie – dzierżawa, przejęcie przez serwer, powrót karty – sprawdzona lokalnie w PGlite, zob. DECYZJE #438.)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = () => import(pathToFileURL(path.join(__dirname, '..', 'js', 'prace-w-tle.js')).href);

test('rodzaj urządzenia i ocena', async () => {
  const { klasaUrzadzenia, ocena } = await modul();
  assert.equal(klasaUrzadzenia({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', dotyk: 5, szerokosc: 390, wysokosc: 844 }), 'telefon');
  assert.equal(klasaUrzadzenia({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile', dotyk: 5, szerokosc: 412, wysokosc: 915 }), 'telefon');
  assert.equal(klasaUrzadzenia({ ua: 'Mozilla/5.0 (Linux; Android 14; SM-X710)', dotyk: 5, szerokosc: 1600, wysokosc: 2560 }), 'tablet');
  assert.equal(klasaUrzadzenia({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', dotyk: 5 }), 'tablet'); // iPad udaje Maca
  assert.equal(klasaUrzadzenia({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', dotyk: 0 }), 'komputer');
  const komp = ocena({ klasa: 'komputer', rdzenie: 8, pamiec: 8 });
  const tel = ocena({ klasa: 'telefon', rdzenie: 8, pamiec: 8, siec: 'wifi', bateria: { laduje: false, poziom: 0.8 } });
  assert.ok(komp.punkty > tel.punkty, 'komputer mocniejszy od telefonu');
  assert.deepEqual([tel.male, tel.duze], [true, false], 'telefon na Wi-Fi bez ładowania – tylko małe prace');
  assert.equal(ocena({ klasa: 'telefon', siec: 'komorkowa' }).male, false, 'telefon na danych komórkowych – nic');
  assert.equal(ocena({ klasa: 'telefon', siec: 'wifi', bateria: { laduje: true, poziom: 0.5 } }).duze, true, 'ładowany telefon na Wi-Fi – także duże');
  assert.equal(ocena({ klasa: 'komputer', bateria: { laduje: false, poziom: 0.1 } }).male, false, 'prawie rozładowany laptop – nic');
});

test('wybór wykonawcy: karta z projektem, najmocniejsza, inaczej serwer', async () => {
  const { wybierzWykonawce } = await modul();
  const karty = [
    { karta: 'tel', projekty: ['P'], punkty: 150, male: true, duze: false },
    { karta: 'komp', projekty: ['P'], punkty: 350, male: true, duze: true },
    { karta: 'komp2', projekty: [], punkty: 400, male: true, duze: true },
  ];
  assert.equal(wybierzWykonawce(karty, { projekt: 'P' }), 'komp', 'z kart z projektem – komputer, nie telefon');
  assert.equal(wybierzWykonawce(karty.filter((k) => k.karta !== 'komp'), { projekt: 'P', stron: 100 }), 'komp2', 'duża praca: telefon bez ładowania odpada, bierze inna karta konta');
  assert.equal(wybierzWykonawce([karty[0]], { projekt: 'P', stron: 100 }), null, 'tylko słaby telefon – serwer');
  assert.equal(wybierzWykonawce([], { projekt: 'P' }), null);
  assert.equal(wybierzWykonawce([{ karta: 'b', projekty: [], punkty: 1, male: true }, { karta: 'a', projekty: [], punkty: 1, male: true }], { projekt: 'P' }), 'a', 'remis – stała kolejność (wszystkie karty wybierają tę samą)');
});

test('kolejność stron: oglądane, zmienione, brakujące, reszta', async () => {
  const { kolejnoscStron } = await modul();
  const strony = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
  const w = kolejnoscStron(strony, { ogladane: ['e'], poprzednie: { a: '1', b: '2', d: '4', e: '5' }, odciski: { a: '1', b: 'X', c: '3', d: '4', e: '5' } });
  assert.deepEqual(w.map((s) => s.id), ['e', 'b', 'c', 'a', 'd']);
});
