// Obrazy przez AI (rdzeń łącznika MCP, bez przeglądarki): wspólny kod z aplikacją, wymiary z nagłówków plików,
// archiwa ZIP (z ochroną przed „bombą”), adresy (https, sieci prywatne, Dysk Google, Dropbox), narzędzia
// wgraj_obraz, wstaw_obraz, obrazy_projektu, zmien_nazwe_obrazu, usun_obrazy, podmien_obraz, uporzadkuj_obrazy,
// link_do_wgrywania, wysyłka pliku wprost (POST …/obraz) i pliki z dysku w serwerze u siebie.
// Baza: lokalny serwer HTTP z tests/atrapa-ai.cjs (te same zasady co migracja 20261112090000_obrazy_ai.sql).

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { atrapaAi } = require('./atrapa-ai.cjs');

const KORZEN = path.join(__dirname, '..');
const RDZEN = path.join(KORZEN, 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs');
const WSPOLNE = path.join(KORZEN, 'js', 'obrazy-wspolne.js');
const WLASCICIEL = { id: 'u-1' };

// ---------- Pliki do prób ----------

function png(szer, wys, dopisek = 0) {
  const b = Buffer.alloc(33 + 12);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'latin1'); b.writeUInt32BE(szer, 16); b.writeUInt32BE(wys, 20);
  b[24] = 8; b[25] = 6; b.writeUInt32BE(dopisek, 29); // dopisek – żeby pliki różniły się treścią
  b.writeUInt32BE(0, 33); b.write('IEND', 37, 'latin1');
  return b;
}
const gif = (szer, wys) => { const b = Buffer.from('474946383961000000000000003b', 'hex'); b.writeUInt16LE(szer, 6); b.writeUInt16LE(wys, 8); return b; };
function jpeg(szer, wys, orientacja = 1) {
  // SOI, APP1 Exif (II, IFD0 z orientacją), SOF0, EOI
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write('II', 0, 'latin1'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); tiff.writeUInt16LE(0x0112, 10); tiff.writeUInt16LE(3, 12); tiff.writeUInt32LE(1, 14); tiff.writeUInt16LE(orientacja, 18);
  const app1 = Buffer.concat([Buffer.from('ffe1', 'hex'), Buffer.alloc(2), Buffer.from('Exif\0\0', 'latin1'), tiff]);
  app1.writeUInt16BE(app1.length - 2, 2);
  const sof = Buffer.from('ffc0001108000000000301220002110103110100', 'hex').subarray(0, 19);
  sof.writeUInt16BE(wys, 5); sof.writeUInt16BE(szer, 7);
  return Buffer.concat([Buffer.from('ffd8', 'hex'), app1, sof, Buffer.from('ffd9', 'hex')]);
}
function webp(rodzaj, szer, wys) {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'latin1'); b.write('WEBP', 8, 'latin1'); b.write(rodzaj, 12, 'latin1');
  if (rodzaj === 'VP8 ') { b.writeUInt16LE(szer, 26); b.writeUInt16LE(wys, 28); }
  if (rodzaj === 'VP8L') { b[20] = 0x2f; b.writeUInt32LE(((szer - 1) | ((wys - 1) << 14)) >>> 0, 21); }
  if (rodzaj === 'VP8X') { b.writeUIntLE(szer - 1, 24, 3); b.writeUIntLE(wys - 1, 27, 3); }
  return b;
}

// Archiwum ZIP: [{ nazwa, bajty, metoda: 0|8 }].
function zip(pliki) {
  const lokalne = [];
  const centralne = [];
  let offset = 0;
  for (const { nazwa, bajty, metoda = 8 } of pliki) {
    const dane = metoda === 8 ? zlib.deflateRawSync(bajty) : bajty;
    const n = Buffer.from(nazwa, 'utf8');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(metoda, 8);
    lh.writeUInt32LE(dane.length, 18); lh.writeUInt32LE(bajty.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(metoda, 10);
    ch.writeUInt32LE(dane.length, 20); ch.writeUInt32LE(bajty.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    lokalne.push(lh, n, dane);
    centralne.push(ch, n);
    offset += lh.length + n.length + dane.length;
  }
  const cd = Buffer.concat(centralne);
  const kon = Buffer.alloc(22);
  kon.writeUInt32LE(0x06054b50, 0); kon.writeUInt16LE(pliki.length, 8); kon.writeUInt16LE(pliki.length, 10);
  kon.writeUInt32LE(cd.length, 12); kon.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokalne, cd, kon]);
}

// ---------- Środowisko: baza (atrapa) + serwer MCP z rdzenia ----------

function projekt() {
  return {
    id: 'p-1', owner_id: WLASCICIEL.id, nazwa: 'Kalendarz', wersja: 1, zmieniono: '2026-11-01T00:00:00Z',
    dane: {
      id: 'p-1', nazwa: 'Kalendarz', strony_osobno: false,
      zasoby: { z_stary: { nazwa: 'las.jpg', typ: 'image/jpeg', sciezka: 'u-1/p-1/z_stary', skrot: 'aaa', szer: 400, wys: 300 } },
      sekcje: [{ id: 'sek1', nazwa: 'Środek', wydruk: { szerokosc_mm: 200, wysokosc_mm: 100, spad_mm: 3 } }],
      wzorce: [], style: [], serie: [],
      tabele: [{ id: 't1', nazwa: 'Zdjęcia', kolumny: ['foto'], wiersze: [['las.jpg'], ['kot.png']] }],
      strony: [{ id: 's1', nazwa: 'Okładka', sekcja: 'sek1', obiekty: [{ id: 'f1', type: 'image', zasob: 'z_stary', src: 'zasob:z_stary', left: 0, top: 0, width: 400, height: 300, scaleX: 0.1, scaleY: 0.1 }] }],
    },
  };
}

async function srodowisko(t, { pobierzAdres, plikiZCzatu = false } = {}) {
  const stan = { projekty: [projekt()], strony: new Map() };
  const baza = atrapaAi(stan);
  const edycja = baza('utworz_dostep_ai', { p_projekt: 'p-1', p_opis: 'AI', p_rola: 'edycja', p_dni: 7 }, WLASCICIEL).klucz;
  const odczyt = baza('utworz_dostep_ai', { p_projekt: 'p-1', p_opis: 'czyta', p_rola: 'odczyt', p_dni: 7 }, WLASCICIEL).klucz;
  const serwer = http.createServer((req, res) => {
    let tresc = '';
    req.on('data', (c) => { tresc += c; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      stan.zapytania = (stan.zapytania || 0) + 1;
      try {
        res.end(JSON.stringify(baza(req.url.replace('/rest/v1/rpc/', ''), JSON.parse(tresc || '{}')) ?? null));
      } catch (e) {
        res.statusCode = e.status || 400;
        res.end(JSON.stringify({ message: e.message }));
      }
    });
  });
  await new Promise((r) => serwer.listen(0, '127.0.0.1', r));
  t.after(() => serwer.close());
  const env = { adres: `http://127.0.0.1:${serwer.address().port}`, kluczPubliczny: 'sb_publishable_test' };
  const { utworzSerwer } = await import(pathToFileURL(RDZEN).href);
  const mcp = (klucz = edycja) => utworzSerwer({ ...env, klucz, pobierzAdres, plikiZCzatu });
  const wywolaj = async (nazwa, argumenty = {}, klucz = edycja) => {
    const w = await mcp(klucz).obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: nazwa, arguments: argumenty } });
    return { tekst: w.result.content[0].text, blad: w.result.isError };
  };
  const p = () => stan.projekty[0];
  const strona = (id) => (p().dane.strony_osobno ? stan.strony.get(`p-1/${id}`) : p().dane.strony.find((s) => s.id === id));
  return { stan, baza, env, edycja, odczyt, wywolaj, p, strona, mcp };
}

// ---------- Wspólny kod i funkcje pomocnicze ----------

test('kod obrazów wspólny z aplikacją jest w rdzeniu łącznika dosłownie taki sam', () => {
  const blok = (t) => t.slice(t.indexOf('// WSPOLNE-POCZATEK'), t.indexOf('// WSPOLNE-KONIEC'));
  const a = blok(fs.readFileSync(WSPOLNE, 'utf8'));
  assert.ok(a.length > 1000);
  assert.equal(blok(fs.readFileSync(RDZEN, 'utf8')), a);
});

test('wymiary obrazu z nagłówka pliku: PNG, GIF, JPEG (z obrotem EXIF), WebP, SVG', async () => {
  const { wymiaryObrazu } = await import(pathToFileURL(WSPOLNE).href);
  assert.deepEqual(wymiaryObrazu(png(640, 480)), { typ: 'image/png', szer: 640, wys: 480 });
  assert.deepEqual(wymiaryObrazu(gif(31, 17)), { typ: 'image/gif', szer: 31, wys: 17 });
  assert.deepEqual(wymiaryObrazu(jpeg(4000, 3000)), { typ: 'image/jpeg', szer: 4000, wys: 3000 });
  assert.deepEqual(wymiaryObrazu(jpeg(4000, 3000, 6)), { typ: 'image/jpeg', szer: 3000, wys: 4000 }, 'zdjęcie z telefonu obrócone o 90°');
  assert.deepEqual(wymiaryObrazu(webp('VP8 ', 300, 200)), { typ: 'image/webp', szer: 300, wys: 200 });
  assert.deepEqual(wymiaryObrazu(webp('VP8L', 1024, 768)), { typ: 'image/webp', szer: 1024, wys: 768 });
  assert.deepEqual(wymiaryObrazu(webp('VP8X', 5000, 70)), { typ: 'image/webp', szer: 5000, wys: 70 });
  const svg = (s) => wymiaryObrazu(Buffer.from(s));
  assert.deepEqual(svg('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm"/>'), { typ: 'image/svg+xml', szer: 378, wys: 189 });
  assert.deepEqual(svg('<svg viewBox="0 0 24 12"></svg>'), { typ: 'image/svg+xml', szer: 24, wys: 12 });
  assert.deepEqual(svg('<!-- logo --><svg width="200" viewBox="0 0 24 12"></svg>'), { typ: 'image/svg+xml', szer: 200, wys: 100 });
  assert.equal(svg('<!DOCTYPE html><html><body><svg viewBox="0 0 1 1"/></body></html>'), null, 'strona HTML to nie obraz');
  assert.equal(wymiaryObrazu(Buffer.from('zwykły tekst')), null);
});

test('ZIP: wypakowane tylko obrazy (bez __MACOSX i plików systemowych), limity chronią przed bombą ZIP', async () => {
  const { rozpakujZip, czyZip } = await import(pathToFileURL(WSPOLNE).href);
  const archiwum = zip([
    { nazwa: 'zdjecia/styczen.png', bajty: png(10, 10, 1) },
    { nazwa: 'zdjecia/luty.png', bajty: png(10, 10, 2), metoda: 0 },
    { nazwa: '__MACOSX/zdjecia/._styczen.png', bajty: Buffer.from('xx') },
    { nazwa: 'zdjecia/.DS_Store', bajty: Buffer.from('xx') },
    { nazwa: 'zdjecia/opis.txt', bajty: Buffer.from('tekst') },
    { nazwa: 'zdjecia/', bajty: Buffer.alloc(0), metoda: 0 },
  ]);
  assert.ok(czyZip(archiwum));
  const w = await rozpakujZip(archiwum);
  assert.deepEqual(w.pliki.map((x) => x.nazwa), ['styczen.png', 'luty.png']);
  assert.deepEqual(Buffer.from(w.pliki[0].bajty), png(10, 10, 1));
  assert.deepEqual(w.pominiete, ['opis.txt']);
  // Bomba: 40 MB zer spakowane do kilkudziesięciu kB – przerwane w trakcie wypakowywania.
  const bomba = zip([{ nazwa: 'a.png', bajty: Buffer.alloc(40 * 1024 * 1024) }]);
  assert.ok(bomba.length < 100 * 1024);
  await assert.rejects(rozpakujZip(bomba, { maksPlik: 15 * 1024 * 1024 }), /ponad 15 MB/);
  const duzo = zip(Array.from({ length: 6 }, (_, i) => ({ nazwa: `b${i}.png`, bajty: Buffer.alloc(5 * 1024 * 1024) })));
  await assert.rejects(rozpakujZip(duzo, { maksRazem: 20 * 1024 * 1024 }), /razem ponad 20 MB/);
  await assert.rejects(rozpakujZip(zip(Array.from({ length: 5 }, (_, i) => ({ nazwa: `c${i}.png`, bajty: png(1, 1, i) }))), { maksPlikow: 3 }), /więcej niż 3 obrazów/);
  await assert.rejects(rozpakujZip(Buffer.from('PK\u0003\u0004 uszkodzony')), /nie jest poprawne archiwum/);
});

test('adresy: tylko https i adresy publiczne; linki z Dysku Google i Dropboxa zamieniane na pobieranie pliku', async () => {
  const { sprawdzAdres, bezposredniAdres } = await import(pathToFileURL(RDZEN).href);
  assert.equal(sprawdzAdres('https://upload.wikimedia.org/a.png'), null);
  assert.match(sprawdzAdres('http://example.com/a.png'), /https/);
  for (const a of ['https://localhost/a.png', 'https://127.0.0.1/a.png', 'https://10.1.2.3/a', 'https://192.168.0.5/a', 'https://172.20.0.1/a',
    'https://169.254.169.254/latest/meta-data', 'https://[::1]/a', 'https://[fd00::1]/a', 'https://serwer.local/a', 'https://intranet/a']) {
    assert.match(sprawdzAdres(a), /sieci lokalnej albo prywatnej/, a);
  }
  assert.match(sprawdzAdres('https://jan:haslo@example.com/a.png'), /loginu/);
  assert.equal(bezposredniAdres('https://drive.google.com/file/d/1AbC_d-9/view?usp=sharing').adres, 'https://drive.google.com/uc?export=download&id=1AbC_d-9');
  assert.equal(bezposredniAdres('https://drive.google.com/open?id=XYZ123').adres, 'https://drive.google.com/uc?export=download&id=XYZ123');
  assert.match(bezposredniAdres('https://drive.google.com/drive/folders/abc?usp=sharing').blad, /folderu na Dysku Google/);
  assert.equal(bezposredniAdres('https://www.dropbox.com/scl/fi/abc/las.jpg?rlkey=k1&dl=0').adres, 'https://www.dropbox.com/scl/fi/abc/las.jpg?rlkey=k1&dl=1');
  assert.equal(bezposredniAdres('https://www.dropbox.com/scl/fo/abc/xyz?rlkey=k2').adres, 'https://www.dropbox.com/scl/fo/abc/xyz?rlkey=k2&dl=1');
  assert.equal(bezposredniAdres('https://example.com/a.png?x=1').adres, 'https://example.com/a.png?x=1');
});

// ---------- Narzędzia ----------

test('wgraj_obraz: SVG, base64, ten sam plik, zajęta nazwa, ZIP z adresu, strona HTML zamiast obrazu, klucz tylko do odczytu', async (t) => {
  const adresy = [];
  const odpowiedzi = {
    'https://example.com/zdjecia.zip': { bajty: zip([{ nazwa: 'z/morze.png', bajty: png(20, 10, 7) }, { nazwa: 'z/gory.gif', bajty: gif(5, 5) }, { nazwa: 'z/x.txt', bajty: Buffer.from('a') }]), nazwa: 'zdjecia.zip' },
    'https://drive.google.com/uc?export=download&id=PLIK1': { bajty: png(30, 30, 9), nazwa: 'z-dysku.png' },
    'https://example.com/strona': { bajty: Buffer.from('<!DOCTYPE html><html><head><title>Logowanie</title></head></html>'), nazwa: 'strona' },
  };
  const s = await srodowisko(t, { pobierzAdres: async (a) => { adresy.push(a); if (!odpowiedzi[a]) throw new Error(`nieznany adres ${a}`); return { bajty: new Uint8Array(odpowiedzi[a].bajty), nazwa: odpowiedzi[a].nazwa }; } });

  let w = await s.wywolaj('wgraj_obraz', { svg: '<svg viewBox="0 0 40 20"><circle cx="10" cy="10" r="8" fill="red"/></svg>', nazwa: 'kropka' });
  assert.equal(w.blad, false, w.tekst);
  assert.match(w.tekst, /Wgrano „kropka\.svg” \(id z_ai\w+, 40×20 px\)/);
  const svgId = /id (z_ai\w+)/.exec(w.tekst)[1];
  const svgPlik = s.stan.obrazyAi.get(s.p().dane.zasoby[svgId].sciezka.slice(3));
  assert.match(svgPlik.dane.toString(), /<svg height="20" width="40" xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox/, 'SVG dostaje wymiary i xmlns');
  assert.equal(s.p().dane.zasoby[svgId].szer, 40);

  w = await s.wywolaj('wgraj_obraz', { dane_base64: png(64, 32).toString('base64'), nazwa: 'kot.png' });
  assert.match(w.tekst, /Wgrano „kot\.png” \(id z_ai\w+, 64×32 px\)/);
  w = await s.wywolaj('wgraj_obraz', { dane_base64: `data:image/png;base64,${png(64, 32).toString('base64')}`, nazwa: 'inna-nazwa.png' });
  assert.match(w.tekst, /Ten sam obraz już był w projekcie jako „kot\.png”/);
  w = await s.wywolaj('wgraj_obraz', { dane_base64: png(64, 32, 1).toString('base64'), nazwa: 'KOT.png' });
  assert.match(w.tekst, /Wgrano „KOT \(2\)\.png”/, 'inny plik o zajętej nazwie dostaje „(2)”');

  w = await s.wywolaj('wgraj_obraz', { adres: 'https://example.com/zdjecia.zip' });
  assert.equal(w.blad, false, w.tekst);
  assert.match(w.tekst, /Wgrano „morze\.png”.*\n.*Wgrano „gory\.gif”/s);
  assert.match(w.tekst, /pominięto pliki, które nie są obrazami: x\.txt/);
  w = await s.wywolaj('wgraj_obraz', { adres: 'https://drive.google.com/file/d/PLIK1/view?usp=sharing' });
  assert.match(w.tekst, /Wgrano „z-dysku\.png”/);
  assert.equal(adresy.at(-1), 'https://drive.google.com/uc?export=download&id=PLIK1');
  w = await s.wywolaj('wgraj_obraz', { adres: 'https://drive.google.com/drive/folders/F1' });
  assert.equal(w.blad, true);
  assert.match(w.tekst, /folderu na Dysku Google/);
  w = await s.wywolaj('wgraj_obraz', { adres: 'https://example.com/strona' });
  assert.equal(w.blad, true);
  assert.match(w.tekst, /strona internetowa, a nie plik obrazu/);
  w = await s.wywolaj('wgraj_obraz', { svg: '<svg viewBox="0 0 1 1" onload="alert(1)"/>' });
  assert.match(w.tekst, /skryptów/);
  w = await s.wywolaj('wgraj_obraz', { svg: '<svg/>', adres: 'https://example.com/a.png' });
  assert.match(w.tekst, /dokładnie jedno źródło/);
  w = await s.wywolaj('wgraj_obraz', { dane_base64: png(5, 5, 99).toString('base64') }, s.odczyt);
  assert.equal(w.blad, true);
  assert.match(w.tekst, /tylko czytać/);
  const nazwy = Object.values(s.p().dane.zasoby).map((z) => z.nazwa).sort();
  assert.deepEqual(nazwy, ['KOT (2).png', 'gory.gif', 'kot.png', 'kropka.svg', 'las.jpg', 'morze.png', 'z-dysku.png']);
});

test('wstaw_obraz: pojedynczy element – domyślnie 60% strony na środku, sama szerokość, ramka „zmiesc” i „wypelnij” z przycięciem', async (t) => {
  const s = await srodowisko(t);
  await s.wywolaj('wgraj_obraz', { dane_base64: png(400, 200).toString('base64'), nazwa: 'panorama.png' });
  let w = await s.wywolaj('wstaw_obraz', { obraz: 'panorama.png', gdzie: 'strona:s1' });
  assert.equal(w.blad, false, w.tekst);
  let o = s.strona('s1').obiekty.at(-1);
  // strona 200×100 mm: 60% → 120×60 mm, a obraz 2:1 → 120×60 mm na środku
  assert.deepEqual([o.type, o.width, o.height, o.scaleX, o.left, o.top, o.src], ['image', 400, 200, 0.3, 40, 20, `zasob:${o.zasob}`]);
  w = await s.wywolaj('wstaw_obraz', { obraz: 'panorama', gdzie: 'strona:s1', x: 5, y: 5, szerokosc: 50 });
  o = s.strona('s1').obiekty.at(-1);
  assert.deepEqual([o.scaleX, o.left, o.top, Math.round(o.height * o.scaleY * 100) / 100], [0.125, 5, 5, 25]);
  await s.wywolaj('wstaw_obraz', { obraz: 'panorama.png', gdzie: 'strona:s1', x: 0, y: 0, szerokosc: 50, wysokosc: 50 });
  o = s.strona('s1').obiekty.at(-1);
  assert.deepEqual([o.width, o.height, o.left, o.top], [400, 200, 0, 12.5], 'zmieść: cały obraz w ramce, na środku ramki');
  w = await s.wywolaj('wstaw_obraz', { obraz: 'panorama.png', gdzie: 'strona:s1', x: 10, y: 10, szerokosc: 50, wysokosc: 50, dopasowanie: 'wypelnij' });
  o = s.strona('s1').obiekty.at(-1);
  assert.deepEqual([o.width, o.height, o.cropX, o.cropY, o.scaleX, o.left, o.top], [200, 200, 100, 0, 0.25, 10, 10], 'wypełnij: środek obrazu, brzegi przycięte');
  assert.match(w.tekst, /wypełnia ramkę z przycięciem/);
  w = await s.wywolaj('wstaw_obraz', { obraz: 'nie-ma.png', gdzie: 'strona:s1' });
  assert.match(w.tekst, /nie ma obrazu „nie-ma\.png”/);
  // Starszy obraz bez zapisanych wymiarów: wymiary z elementu, który już go pokazuje.
  delete s.p().dane.zasoby.z_stary.szer;
  w = await s.wywolaj('wstaw_obraz', { obraz: 'las.jpg', gdzie: 'strona:s1', szerokosc: 40 });
  assert.equal(w.blad, false, w.tekst);
  assert.equal(s.strona('s1').obiekty.at(-1).scaleX, 0.1);
  // wgraj_obraz z „wstaw” – od razu na stronie
  w = await s.wywolaj('wgraj_obraz', { svg: '<svg width="10" height="10"/>', nazwa: 'kwadrat.svg', wstaw: { gdzie: 'strona:s1', x: 1, y: 2, szerokosc: 10 } });
  assert.match(w.tekst, /Wgrano „kwadrat\.svg”[\s\S]*Wstawiono obraz „kwadrat\.svg”/);
});

test('obrazy_projektu, zmien_nazwe_obrazu (komórki tabel też), usun_obrazy (tylko nieużywane), podmien_obraz, link_do_wgrywania', async (t) => {
  const s = await srodowisko(t);
  await s.wywolaj('wgraj_obraz', { dane_base64: png(8, 8, 1).toString('base64'), nazwa: 'kot.png' });
  await s.wywolaj('wgraj_obraz', { dane_base64: png(8, 8, 2).toString('base64'), nazwa: 'zbedny.png' });
  let w = await s.wywolaj('obrazy_projektu');
  assert.match(w.tekst, /Obrazy projektu \(3\):/);
  assert.match(w.tekst, /„kot\.png” 8×8 px.* – w danych \(„Zdjęcia”\)/);
  assert.match(w.tekst, /„las\.jpg” 400×300 px.* – strona 1 · w danych \(„Zdjęcia”\)/);
  assert.match(w.tekst, /„zbedny\.png” 8×8 px.* – nieużywany/);

  // Zmiana nazwy: nowe id, element przepięty, komórka tabeli zmieniona, stary wpis w nagrobkach, plik bez zmian.
  const sciezka = s.p().dane.zasoby.z_stary.sciezka;
  w = await s.wywolaj('zmien_nazwe_obrazu', { obraz: 'las.jpg', nazwa: 'kot.png' });
  assert.equal(w.blad, true);
  assert.match(w.tekst, /„kot\.png” jest już zajęta/);
  w = await s.wywolaj('zmien_nazwe_obrazu', { obraz: 'las.jpg', nazwa: 'styczen' });
  assert.equal(w.blad, false, w.tekst);
  assert.match(w.tekst, /„las\.jpg” → „styczen\.jpg”.*Komórki tabel z tą nazwą: 1/);
  const noweId = /id (z_\w+)/.exec(w.tekst)[1];
  assert.equal(s.p().dane.zasoby[noweId].sciezka, sciezka, 'ten sam plik na koncie');
  assert.equal(s.p().dane.zasoby.z_stary, undefined);
  assert.ok(s.p().dane.zasoby_usuniete.includes('z_stary'));
  assert.deepEqual([s.strona('s1').obiekty[0].zasob, s.strona('s1').obiekty[0].src], [noweId, `zasob:${noweId}`]);
  assert.deepEqual(s.p().dane.tabele[0].wiersze, [['styczen.jpg'], ['kot.png']]);
  assert.equal(s.stan.doUsuniecia.get('p-1')?.size || 0, 0, 'plik używany dalej nie trafia do sprzątania');

  // Usuwanie: użyty zostaje (strona albo dane), nieużywany znika.
  w = await s.wywolaj('usun_obrazy', { obrazy: ['styczen.jpg', 'kot.png', 'zbedny.png'] });
  assert.match(w.tekst, /Usunięto 1: „zbedny\.png”/);
  assert.match(w.tekst, /Zostały, bo są użyte.*„styczen\.jpg” – strona 1.*„kot\.png” – w danych/s);
  const zbednyWiersz = [...s.stan.obrazyAi.values()].find((o) => o.nazwa === 'zbedny.png');
  assert.equal(zbednyWiersz, undefined, 'plik czekający od AI usunięty od razu');
  w = await s.wywolaj('usun_obrazy', { nieuzywane: true });
  assert.match(w.tekst, /Nie ma nieużywanych obrazów/);

  // Podmiana pliku: elementy przepięte, nazwa ta sama, stary plik z konta do sprzątnięcia przez aplikację.
  w = await s.wywolaj('podmien_obraz', { obraz: 'styczen.jpg', dane_base64: jpeg(800, 600).toString('base64') });
  assert.equal(w.blad, false, w.tekst);
  assert.match(w.tekst, /Wgrano „styczen\.jpg”.*zastąpił obraz/);
  const podmieniony = s.strona('s1').obiekty[0].zasob;
  assert.notEqual(podmieniony, noweId);
  assert.equal(s.p().dane.zasoby[podmieniony].nazwa, 'styczen.jpg');
  assert.deepEqual([...s.stan.doUsuniecia.get('p-1')], [sciezka], 'stary plik z konta czeka na sprzątnięcie przez aplikację');

  w = await s.wywolaj('link_do_wgrywania');
  assert.match(w.tekst, /https:\/\/makietka\.app\/#\/p\/p-1\/obrazy/);
  w = await s.wywolaj('usun_obrazy', { obrazy: ['kot.png'] }, s.odczyt);
  assert.match(w.tekst, /Zostały|tylko czytać/);
});

test('uporzadkuj_obrazy: kopie tego samego pliku scalone (elementy i komórki), powtórzone nazwy z dopiskiem „(2)”', async (t) => {
  const s = await srodowisko(t);
  const z = s.p().dane.zasoby;
  // Starszy projekt: kopia tego samego pliku (ten sam skrót) i dwa różne pliki o tej samej nazwie.
  Object.assign(z, {
    z_kopia: { nazwa: 'las kopia.jpg', typ: 'image/jpeg', sciezka: 'u-1/p-1/z_kopia', skrot: 'aaa', szer: 400, wys: 300 },
    z_mapa1: { nazwa: 'mapa.png', typ: 'image/png', sciezka: 'u-1/p-1/z_mapa1', skrot: 'bbb', szer: 10, wys: 10 },
    z_mapa2: { nazwa: 'Mapa.png', typ: 'image/png', sciezka: 'u-1/p-1/z_mapa2', skrot: 'ccc', szer: 10, wys: 10 },
  });
  s.p().dane.strony[0].obiekty.push({ id: 'f2', type: 'image', zasob: 'z_kopia', src: 'zasob:z_kopia', width: 400, height: 300 });
  s.p().dane.tabele[0].wiersze.push(['las kopia.jpg'], ['mapa.png']);
  let w = await s.wywolaj('obrazy_projektu');
  assert.match(w.tekst, /Kopie tego samego pliku: „las\.jpg” = „las kopia\.jpg”/);
  assert.match(w.tekst, /Ta sama nazwa, inna treść: „mapa\.png” \(2×\)/);
  w = await s.wywolaj('uporzadkuj_obrazy');
  assert.equal(w.blad, false, w.tekst);
  assert.match(w.tekst, /scalone kopie: 1; nowe nazwy: „Mapa \(2\)\.png”/);
  const zasoby = s.p().dane.zasoby;
  assert.deepEqual(Object.values(zasoby).map((x) => x.nazwa).sort(), ['Mapa (2).png', 'las.jpg', 'mapa.png']);
  assert.deepEqual(s.strona('s1').obiekty.map((o) => o.zasob), ['z_stary', 'z_stary']);
  assert.deepEqual(s.p().dane.tabele[0].wiersze.flat(), ['las.jpg', 'kot.png', 'las.jpg', 'mapa.png'], 'komórka kopii wskazuje obraz, który zostaje; „mapa.png” – ten sam obraz co dotąd');
  assert.deepEqual([...s.stan.doUsuniecia.get('p-1')], ['u-1/p-1/z_kopia'], 'plik kopii do sprzątnięcia; przemianowany obraz zachowuje plik');
  w = await s.wywolaj('uporzadkuj_obrazy');
  assert.match(w.tekst, /Obrazy są uporządkowane/);
});

test('wysyłka pliku wprost: POST …/mcp/<klucz>/obraz?nazwa=… (obraz i ZIP), zły klucz, pusty plik', async (t) => {
  const s = await srodowisko(t);
  const { obsluzHttp } = await import(pathToFileURL(path.join(KORZEN, 'supabase', 'functions', '_shared', 'mcp-http.mjs')).href);
  const ADRES = 'https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp';
  const wyslij = (sciezka, tresc) => obsluzHttp(new Request(`${ADRES}${sciezka}`, { method: 'POST', body: tresc, headers: { 'content-type': 'application/octet-stream' } }), s.env);
  let odp = await wyslij(`/${s.edycja}/obraz?nazwa=${encodeURIComponent('zdjęcie z rozmowy.jpg')}`, jpeg(1200, 900, 8));
  let w = await odp.json();
  assert.equal(odp.status, 200, JSON.stringify(w));
  assert.deepEqual(w.wgrane.map((x) => [x.nazwa, x.szer, x.wys, x.byl]), [['zdjęcie z rozmowy.jpg', 900, 1200, false]]);
  odp = await wyslij(`/${s.edycja}/obraz?nazwa=paczka.zip`, zip([{ nazwa: 'a.png', bajty: png(2, 2, 1) }, { nazwa: 'b.png', bajty: png(2, 2, 2) }]));
  w = await odp.json();
  assert.deepEqual(w.wgrane.map((x) => x.nazwa), ['a.png', 'b.png']);
  odp = await wyslij('/sdk_zly/obraz', png(1, 1));
  assert.equal(odp.status, 401);
  odp = await wyslij(`/${s.edycja}/obraz`, new Uint8Array(0));
  assert.equal(odp.status, 400);
  odp = await wyslij(`/${s.odczyt}/obraz?nazwa=x.png`, png(3, 3, 3));
  assert.equal(odp.status, 400);
  assert.match((await odp.json()).blad, /tylko czytać/);
});

test('serwer u siebie: pliki i foldery z dysku (obrazy i ZIP-y, bez podfolderów), narzędzie „plik” tylko tam', async (t) => {
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'seriodruk-obrazy-'));
  t.after(() => fs.rmSync(katalog, { recursive: true, force: true }));
  fs.writeFileSync(path.join(katalog, 'a.png'), png(4, 4, 1));
  fs.writeFileSync(path.join(katalog, 'paczka.zip'), zip([{ nazwa: 'b.gif', bajty: gif(2, 2) }]));
  fs.writeFileSync(path.join(katalog, 'notatki.txt'), 'x');
  fs.mkdirSync(path.join(katalog, 'pod'));
  fs.writeFileSync(path.join(katalog, 'pod', 'c.png'), png(4, 4, 2));
  const { czytajPliki, obsluz } = await import(pathToFileURL(path.join(KORZEN, 'ai', 'mcp', 'makietka-mcp.mjs')).href);
  const pliki = await czytajPliki([katalog]);
  assert.deepEqual(pliki.map((p) => p.nazwa), ['a.png', 'paczka.zip']);
  await assert.rejects(czytajPliki([path.join(katalog, 'nie-ma.png')]), /Nie ma pliku ani folderu/);
  const lista = await obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {});
  const wgraj = lista.result.tools.find((n) => n.name === 'wgraj_obraz');
  assert.ok(wgraj.inputSchema.properties.plik, 'serwer u siebie ma źródło „plik”');
  const s = await srodowisko(t);
  const zdalny = await s.mcp().obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {});
  assert.equal(zdalny.result.tools.find((n) => n.name === 'wgraj_obraz').inputSchema.properties.plik, undefined, 'zdalny łącznik nie widzi plików użytkownika');
  for (const n of ['obrazy_projektu', 'wgraj_obraz', 'wstaw_obraz', 'zmien_nazwe_obrazu', 'usun_obrazy', 'podmien_obraz', 'uporzadkuj_obrazy', 'link_do_wgrywania']) {
    assert.ok(zdalny.result.tools.some((x) => x.name === n), n);
  }
  // Pliki w środowisku AI: wgraj_czesciami (bez sieci); niedostępne – link do wgrania zamiast odmowy (#75, #77).
  const opisWgraj = zdalny.result.tools.find((n) => n.name === 'wgraj_obraz').description;
  assert.match(opisWgraj, /wgraj_czesciami/);
  assert.match(opisWgraj, /NIE odmawiaj – wywołaj link_do_wgrywania/);
  assert.match(zdalny.result.tools.find((n) => n.name === 'link_do_wgrywania').description, /zamiast mówić, że nie masz dostępu do plików/);
  const start = await s.mcp().obsluz({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }, {});
  assert.match(start.result.instructions, /wgraj_czesciami/);
  assert.match(start.result.instructions, /wywołaj link_do_wgrywania/);
  assert.match(start.result.instructions, /nie proś użytkownika o odblokowanie domen/);
});

test('pliki_z_czatu (ChatGPT, openai/fileParams): łącznik sam pobiera załączniki rozmowy z ich adresu', async (t) => {
  const odpowiedzi = { 'https://files.oaiusercontent.com/f1': png(40, 20, 3), 'https://files.oaiusercontent.com/f2': png(10, 10, 4) };
  const s = await srodowisko(t, { plikiZCzatu: true, pobierzAdres: async (a) => ({ bajty: new Uint8Array(odpowiedzi[a]), nazwa: 'plik' }) });
  // Claude (bez dopisku dla ChatGPT) dostaje listę bez pola pliki_z_czatu i bez _meta.
  const claude = await (await srodowisko(t)).mcp().obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {});
  const wgrajC = claude.result.tools.find((n) => n.name === 'wgraj_obraz');
  assert.equal(wgrajC._meta, undefined);
  assert.equal(wgrajC.inputSchema.properties.pliki_z_czatu, undefined);
  assert.ok(claude.result.tools.every((n) => !('_meta' in n)), 'żadne narzędzie nie ma _meta dla Claude');
  const lista = await s.mcp().obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {});
  const wgraj = lista.result.tools.find((n) => n.name === 'wgraj_obraz');
  assert.deepEqual(wgraj._meta['openai/fileParams'], ['pliki_z_czatu']);
  assert.equal(wgraj.inputSchema.properties.pliki_z_czatu.type, 'array');
  let w = await s.wywolaj('wgraj_obraz', { pliki_z_czatu: [
    { download_url: 'https://files.oaiusercontent.com/f1', file_id: 'file_1', mime_type: 'image/png', file_name: 'styczen.png' },
    { download_url: 'https://files.oaiusercontent.com/f2', file_id: 'file_2', file_name: 'luty.png' },
  ] });
  assert.equal(w.blad, false, w.tekst);
  assert.match(w.tekst, /Wgrano „styczen\.png”.*40×20 px.*\n.*Wgrano „luty\.png”/s);
  // Claude: adres POST do wysyłki z własnego środowiska (po dopisaniu domeny).
  w = await s.wywolaj('adres_do_wysylki');
  assert.match(w.tekst, /^POST https:\/\/api\.makietka\.app\/mcp\/sdk_\S+\/obraz\?nazwa=/);
  assert.match(w.tekst, /zastap=/);
  assert.match(lista.result.tools.find((n) => n.name === 'usun_obrazy').description, /podmien_obraz/);
  w = await s.wywolaj('wgraj_obraz', { pliki_z_czatu: [{ file_id: 'file_3' }] });
  assert.equal(w.blad, true);
  assert.match(w.tekst, /link_do_wgrywania/);
});

test('wgraj_czesciami: AI bez sieci do bazy wysyła plik kawałkami base64 przez łącznik; duplikat, brakujący kawałek, podmiana użytego', async (t) => {
  const s = await srodowisko(t);
  const crypto = require('node:crypto');
  const plik = Buffer.concat([png(300, 200, 5), crypto.randomBytes(70000)]); // PNG z doklejonym ogonem – ok. 70 KB
  const sha = crypto.createHash('sha256').update(plik).digest('hex');
  let w = await s.wywolaj('wgraj_czesciami', { krok: 'start', nazwa: 'ilustracja.png', rozmiar: plik.length, sha256: sha, kawalek: 16384 });
  assert.equal(w.blad, false, w.tekst);
  const wgranie = /Wgranie (\S+):/.exec(w.tekst)[1];
  const czesci = Math.ceil(plik.length / 16384);
  assert.match(w.tekst, new RegExp(`${czesci} kawałków po 16384`));
  for (let nr = 0; nr < czesci - 1; nr += 1) {
    w = await s.wywolaj('wgraj_czesciami', { krok: 'czesc', wgranie, nr, dane_base64: plik.subarray(nr * 16384, (nr + 1) * 16384).toString('base64') });
    assert.equal(w.blad, false, w.tekst);
  }
  w = await s.wywolaj('wgraj_czesciami', { krok: 'koniec', wgranie });
  assert.equal(w.blad, true);
  assert.match(w.tekst, new RegExp(`Brakuje kawałków: ${czesci - 1}`));
  const ostatni = czesci - 1;
  await s.wywolaj('wgraj_czesciami', { krok: 'czesc', wgranie, nr: ostatni, dane_base64: plik.subarray(ostatni * 16384).toString('base64') });
  w = await s.wywolaj('wgraj_czesciami', { krok: 'koniec', wgranie });
  assert.equal(w.blad, false, w.tekst);
  assert.match(w.tekst, /Wgrano „ilustracja\.png”/);
  w = await s.wywolaj('wgraj_czesciami', { krok: 'start', nazwa: 'kopia.png', rozmiar: plik.length, sha256: sha });
  assert.match(w.tekst, /Ten sam obraz już był w projekcie jako „ilustracja\.png”/);
  w = await s.wywolaj('wgraj_czesciami', { krok: 'start', nazwa: 'x.png', rozmiar: 10, sha256: sha, kawalek: 1000 });
  assert.match(w.tekst, /od 16 KB do 512 KB/);
  w = await s.wywolaj('wgraj_czesciami', { krok: 'start', nazwa: 'bez-rozszerzenia', rozmiar: 10, sha256: sha });
  assert.match(w.tekst, /rozszerzeniem/);
  // Podmiana użytego obrazu: nowy plik w miejsce starego, jednym wgraniem.
  const nowy = png(300, 200, 6);
  const shaN = crypto.createHash('sha256').update(nowy).digest('hex');
  w = await s.wywolaj('wgraj_czesciami', { krok: 'start', nazwa: 'ilustracja.png', rozmiar: nowy.length, sha256: shaN, zastap: 'ilustracja.png' });
  const wg2 = /Wgranie (\S+):/.exec(w.tekst)[1];
  await s.wywolaj('wgraj_czesciami', { krok: 'czesc', wgranie: wg2, nr: 0, dane_base64: nowy.toString('base64') });
  w = await s.wywolaj('wgraj_czesciami', { krok: 'koniec', wgranie: wg2 });
  assert.equal(w.blad, false, w.tekst);
  assert.match(w.tekst, /zastąpił obraz/);
});

test('duży plik w kawałkach po 512 KB: POST 3 MB → początek, kawałki, koniec; duplikat już przy początku; stare RPC do 1 MB; brakujący kawałek', async (t) => {
  const s = await srodowisko(t);
  const { obsluzHttp } = await import(pathToFileURL(path.join(KORZEN, 'supabase', 'functions', '_shared', 'mcp-http.mjs')).href);
  const ADRES = 'https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp';
  const wyslij = (sciezka, tresc) => obsluzHttp(new Request(`${ADRES}${sciezka}`, { method: 'POST', body: tresc, headers: { 'content-type': 'application/octet-stream' } }), s.env);
  const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
  // 3 MB: nagłówek PNG 4000×3000 i losowa reszta – jedno zapytanie z całym plikiem atrapa odrzuca (limit czasu bazy).
  const duzy = Buffer.concat([png(4000, 3000, 7), crypto.randomBytes(3 * 1024 * 1024)]);
  const przed = s.stan.zapytania || 0;
  let odp = await wyslij(`/${s.edycja}/obraz?nazwa=zdjecie.png`, duzy);
  let w = await odp.json();
  assert.equal(odp.status, 200, JSON.stringify(w));
  assert.deepEqual(w.wgrane.map((x) => [x.nazwa, x.szer, x.wys, x.byl]), [['zdjecie.png', 4000, 3000, false]]);
  assert.equal(s.stan.kawalkiWgrane, Math.ceil(duzy.length / (512 * 1024)), 'każdy kawałek wysłany raz');
  assert.ok((s.stan.zapytania - przed) >= s.stan.kawalkiWgrane + 2, 'początek, kawałki, koniec – osobne zapytania');
  const wpis = Object.values(s.p().dane.zasoby).find((z) => z.nazwa === 'zdjecie.png');
  assert.equal(wpis.rozmiar, duzy.length);
  assert.equal(wpis.skrot, sha(duzy));
  const o = s.stan.obrazyAi.get(wpis.sciezka.slice(3));
  assert.ok(Buffer.concat([...o.kawalki.keys()].sort((a, b) => a - b).map((k) => o.kawalki.get(k))).equals(duzy), 'kawałki składają się w ten sam plik');

  // Ten sam plik drugi raz: odpowiedź już przy początku, bez wysyłania kawałków.
  const kawalkiPrzed = s.stan.kawalkiWgrane;
  odp = await wyslij(`/${s.edycja}/obraz?nazwa=kopia.png`, duzy);
  w = await odp.json();
  assert.equal(w.wgrane[0].byl, true);
  assert.equal(w.wgrane[0].nazwa, 'zdjecie.png');
  assert.equal(s.stan.kawalkiWgrane, kawalkiPrzed);

  // Stare RPC: najwyżej 1 MB, z radą, co zrobić z większym.
  const mb = Buffer.concat([png(10, 10, 9), Buffer.alloc(1100 * 1024)]);
  assert.match(s.baza('ai_wgraj_obraz', { p_klucz: s.edycja, p_nazwa: 'x.png', p_typ: 'image/png', p_dane: mb.toString('base64') }).blad, /najwyżej 1 MB.*ai_wgraj_poczatek.*POST/);

  // Koniec bez kompletu kawałków: błąd z listą brakujących; niedokończone wgranie nie trafia do projektu.
  const plik = Buffer.concat([png(5, 5, 11), Buffer.alloc(700 * 1024, 1)]);
  const start = s.baza('ai_wgraj_poczatek', { p_klucz: s.edycja, p_nazwa: 'niepelny.png', p_typ: 'image/png', p_rozmiar: plik.length, p_skrot: sha(plik) });
  assert.equal(start.czesci, 2);
  assert.deepEqual(s.baza('ai_wgraj_czesc', { p_klucz: s.edycja, p_wiersz: start.wiersz, p_nr: 0, p_dane: plik.subarray(0, 512 * 1024).toString('base64') }), { ok: true });
  const koniec = s.baza('ai_wgraj_koniec', { p_klucz: s.edycja, p_wiersz: start.wiersz });
  assert.match(koniec.blad, /Brakuje kawałków: jest 1 z 2/);
  assert.deepEqual(koniec.brakujace, [1]);
  assert.match(s.baza('ai_wgraj_czesc', { p_klucz: s.odczyt, p_wiersz: start.wiersz, p_nr: 1, p_dane: 'AAAA' }).blad, /tylko czytać/);
  assert.ok(!Object.values(s.p().dane.zasoby).some((z) => z.nazwa === 'niepelny.png'));
});
