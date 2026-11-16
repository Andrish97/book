// Druk sprawdzony programami spoza aplikacji (#186): to, co z ręcznej listy „Druk” (docs/TESTY.md) da się
// zmierzyć bez drukarni. Książka w twardej oprawie (okładka, wyklejki z typem, blok A5 64 str. z tekstem,
// zdjęciem, kolorem dodatkowym i złoceniem) eksportowana jak w oknie PDF – „Pliki dla drukarni” (PDF/X-4, CMYK
// przez profil, spad, znaki cięcia, osobny plik na okładkę, wyklejki i blok) – i „Drukuj w domu” (broszura A4).
//
// Narzędzia: qpdf (budowa, pola strony), pdfinfo/pdffonts/pdftotext/pdftoppm (poppler), Ghostscript (inkcov –
// pokrycie farbą, tiffsep – płyty: C, M, Y, K, kolor dodatkowy, złocenie). Bez nich test się pomija.
// Własny projekt można sprawdzić tak samo: MAKIETKA_PROJEKT=/ścieżka/projekt.json (eksport z aplikacji).
// Pliki do obejrzenia: MAKIETKA_PROBKI=/katalog.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const PROGRAMY = { qpdf: ['--version'], gs: ['--version'], pdffonts: ['-v'], pdfinfo: ['-v'], pdftotext: ['-v'], pdftoppm: ['-v'] };
const brakujace = Object.entries(PROGRAMY).filter(([p, a]) => spawnSync(p, a, { encoding: 'utf8' }).error).map(([p]) => p);
const POMIN = brakujace.length ? `brak programów: ${brakujace.join(', ')} (apt-get install ghostscript qpdf poppler-utils)` : false;

const uruchom = (program, argumenty, opcje = {}) => {
  const w = spawnSync(program, argumenty, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...opcje });
  if (w.error) throw w.error;
  return w;
};
const MM = 72 / 25.4;
const naMm = (pt) => Math.round((pt / MM) * 10) / 10;
const blisko = (a, b, tol = 0.15) => Math.abs(a - b) <= tol;

// Pola strony z qpdf: { media, trim, bleed } w mm, jako [szer, wys] i przesunięcia.
function stronyPliku(plik) {
  const obiekty = JSON.parse(uruchom('qpdf', ['--json', '--json-key=qpdf', plik]).stdout).qpdf[1];
  const strony = JSON.parse(uruchom('qpdf', ['--json', '--json-key=pages', plik]).stdout).pages;
  const obiekt = (odw) => obiekty[`obj:${odw}`]?.value ?? obiekty[`obj:${odw}`]?.stream?.dict;
  const strumien = (odw) => uruchom('qpdf', [`--show-object=${odw.replace(/ R$/, '').replace(' ', ',')}`, '--filtered-stream-data', plik], { encoding: 'buffer' }).stdout;
  const pole = (b) => ({ x: b[0], y: b[1], w: naMm(b[2] - b[0]), h: naMm(b[3] - b[1]), b });
  return {
    obiekty, obiekt, strumien,
    strony: strony.map((s) => {
      const st = obiekt(s.object);
      return { media: pole(st['/MediaBox']), trim: pole(st['/TrimBox']), bleed: pole(st['/BleedBox']), contents: s.contents, images: s.images };
    }),
    tekst: JSON.stringify(obiekty),
  };
}

// Wspólne dla każdego pliku dla drukarni: składnia, PDF/X-4 z profilem CMYK, czcionki osadzone, bez RGB.
function sprawdzPlikDrukarni(plik, opis) {
  const k = uruchom('qpdf', ['--check', plik]);
  assert.equal(k.status, 0, `${opis}: qpdf --check: ${k.stdout}${k.stderr}`);
  const info = uruchom('pdfinfo', [plik]).stdout;
  assert.match(info, /PDF subtype:\s+PDF\/X-4/, `${opis}: poppler rozpoznaje PDF/X-4`);
  const b = stronyPliku(plik);
  const zakonczenie = b.obiekty.trailer.value;
  const [zamiar] = b.obiekt(zakonczenie['/Root'])['/OutputIntents'];
  assert.equal(zamiar['/S'], '/GTS_PDFX', `${opis}: warunki druku (OutputIntent)`);
  const icc = b.strumien(zamiar['/DestOutputProfile']);
  assert.deepEqual([icc.toString('latin1', 12, 16), icc.toString('latin1', 16, 20)], ['prtr', 'CMYK'], `${opis}: profil drukarski CMYK`);
  for (const [i, s] of b.strony.entries()) {
    for (const t of s.contents) {
      const polecenia = b.strumien(t).toString('latin1');
      assert.equal((polecenia.match(/(^|\s)(rg|RG)(?=\s|$)/g) || []).length, 0, `${opis}, strona ${i + 1}: polecenia RGB w treści`);
    }
    for (const o of s.images) assert.notEqual(o.colorspace, '/DeviceRGB', `${opis}, strona ${i + 1}: obraz w RGB`);
  }
  assert.ok(!/"\/(ColorSpace|CS)":"\/(DeviceRGB|CalRGB)"/.test(b.tekst), `${opis}: coś opisane w RGB`);
  const czcionki = uruchom('pdffonts', [plik]).stdout.split('\n').slice(2).filter((l) => l.trim());
  for (const l of czcionki) assert.match(l, /\s+yes\s+yes\s+(yes|no)\s+\d+\s+\d+\s*$/, `${opis}: czcionka nieosadzona: ${l}`);
  // Ghostscript: każda strona rysuje się, pokrycie podane w czterech farbach.
  const ink = uruchom('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=inkcov', '-r36', '-o', '-', plik]);
  assert.equal(ink.status, 0, `${opis}: Ghostscript inkcov: ${ink.stderr}`);
  const pokrycia = ink.stdout.split('\n').filter((l) => /CMYK OK/.test(l));
  assert.equal(pokrycia.length, b.strony.length, `${opis}: inkcov dla każdej strony`);
  return { ...b, czcionki: czcionki.length, pokrycia: pokrycia.map((l) => l.trim().split(/\s+/).slice(0, 4).map(Number)) };
}

// Pola strony do druku: obcięcie = format, spad dookoła, arkusz większy o znaki cięcia.
function sprawdzPola(s, { w, h, spad, znaki = true }, opis) {
  assert.ok(blisko(s.trim.w, w) && blisko(s.trim.h, h), `${opis}: format po obcięciu ${s.trim.w} × ${s.trim.h} mm, ma być ${w} × ${h}`);
  assert.ok(blisko(s.bleed.w, w + 2 * spad) && blisko(s.bleed.h, h + 2 * spad), `${opis}: spad ${s.bleed.w} × ${s.bleed.h} mm, ma być ${spad} mm dookoła`);
  assert.ok(blisko(naMm(s.trim.x - s.bleed.x), spad) && blisko(naMm(s.trim.y - s.bleed.y), spad), `${opis}: spad równy z każdej strony`);
  if (znaki) assert.ok(s.media.w >= s.bleed.w + 10 && s.media.h >= s.bleed.h + 10, `${opis}: miejsce na znaki cięcia (${s.media.w} × ${s.media.h})`);
}

// TIFF z gs tiffsep: jedna płyta, 8 bitów, bez pakowania. Zwraca { w, h, farba(x, y) 0–255 }.
function wczytajPlyte(plik) {
  const b = fs.readFileSync(plik);
  const le = b.toString('latin1', 0, 2) === 'II';
  const u16 = (p) => (le ? b.readUInt16LE(p) : b.readUInt16BE(p));
  const u32 = (p) => (le ? b.readUInt32LE(p) : b.readUInt32BE(p));
  const ifd = u32(4);
  const z = {};
  for (let i = 0; i < u16(ifd); i += 1) {
    const p = ifd + 2 + i * 12;
    const typ = u16(p + 2); const ile = u32(p + 4);
    const r = { 1: 1, 2: 1, 3: 2, 4: 4 }[typ] || 4;
    const gdzie = ile * r <= 4 ? p + 8 : u32(p + 8);
    z[u16(p)] = Array.from({ length: ile }, (_, k) => (r === 2 ? u16(gdzie + k * 2) : r === 4 ? u32(gdzie + k * 4) : b[gdzie + k]));
  }
  const [w] = z[256]; const [h] = z[257];
  assert.equal(z[259][0], 1, 'płyta bez pakowania');
  const dane = Buffer.concat(z[273].map((od, i) => b.subarray(od, od + z[279][i])));
  const bialeToZero = z[262][0] === 0; // WhiteIsZero: wartość = farba
  return { w, h, farba: (x, y) => (bialeToZero ? dane[y * w + x] : 255 - dane[y * w + x]) };
}

// Płyty jednej strony (gs tiffsep): { nazwa → płyta }, i przeliczenie mm strony (od lewego górnego rogu po obcięciu) na piksele.
function plyty(plik, strona, katalog, dpi = 50) {
  const wzor = path.join(katalog, `p${strona}.tif`);
  const g = uruchom('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=tiffsep', '-sCompression=none', `-r${dpi}`, '-dTextAlphaBits=1', '-dGraphicsAlphaBits=1', `-dFirstPage=${strona}`, `-dLastPage=${strona}`, `-sOutputFile=${wzor}`, plik]);
  assert.equal(g.status, 0, `tiffsep: ${g.stderr}`);
  const wynik = {};
  for (const f of fs.readdirSync(katalog)) {
    const m = f.match(new RegExp(`^p${strona}\\((.+)\\)\\.tif$`));
    if (m) wynik[m[1]] = wczytajPlyte(path.join(katalog, f));
  }
  return wynik;
}
const ileFarby = (p, x1, y1, x2, y2) => {
  let n = 0;
  for (let y = Math.max(0, y1); y < Math.min(p.h, y2); y += 1) for (let x = Math.max(0, x1); x < Math.min(p.w, x2); x += 1) if (p.farba(x, y) > 40) n += 1;
  return n;
};

// Plik PDF z aplikacji (blob) → plik na dysku; ZIP rozpakowany w przeglądarce (JSZip aplikacji).
async function eksport(strona, katalog, kod, arg) {
  const pliki = await strona.evaluate(async ([k, a]) => {
    const wynik = await (new Function('a', `return (${k})(a)`))(a);
    const b64 = async (blob) => {
      const bajty = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
      return btoa(s);
    };
    if (!/\.zip$/.test(wynik.nazwa)) return [{ nazwa: wynik.nazwa, dane: await b64(wynik.blob) }];
    const zip = await window.JSZip.loadAsync(wynik.blob);
    return Promise.all(Object.values(zip.files).filter((f) => !f.dir).map(async (f) => ({ nazwa: f.name, dane: await b64(await f.async('blob')) })));
  }, [kod.toString(), arg]);
  return pliki.map((p) => {
    const sciezka = path.join(katalog, p.nazwa.replace(/[^\w. -]/g, '_'));
    fs.writeFileSync(sciezka, Buffer.from(p.dane, 'base64'));
    if (process.env.MAKIETKA_PROBKI) fs.copyFileSync(sciezka, path.join(process.env.MAKIETKA_PROBKI, path.basename(sciezka)));
    return { nazwa: p.nazwa, sciezka };
  });
}

const OPCJE_DRUKARNI = { podzial: 'role', tryb: 'wektor', pdfx: 'fogra39', cmyk: true, zdjeciaCmyk: true, spad: true, znaki: true, dpi: 300 };
const eksportDrukarni = async (o) => {
  const { eksportujPdf } = await import('./js/eksport.js');
  return eksportujPdf(window.seriodruk.stan.projekt, o);
};
// „Drukuj w domu”: te same opcje, co okno (opcjeDruku), dla stron bloku.
const eksportBroszury = async () => {
  const { zlozPdf } = await import('./js/eksport.js');
  const { opcjeDruku } = await import('./js/okno-druku.js');
  const { rozwin } = await import('./js/serie.js');
  const { rolaSekcji } = await import('./js/sekcje-specjalne.js');
  const p = window.seriodruk.stan.projekt;
  const ciag = rozwin(p);
  const blok = ciag.egzemplarze.filter((e) => rolaSekcji(p, e.sekcja) === 'blok');
  const blob = await zlozPdf(p, blok, { ...opcjeDruku({ uklad: 'broszura', papier: 'A4', dopasowanie: 'dopasuj' }), ciag });
  return { nazwa: 'broszura.pdf', blob };
};

test('druk sprawdzony narzędziami: książka w twardej oprawie – pliki dla drukarni (PDF/X-4, spad, znaki, płyty) i broszura A4 do domu', { skip: POMIN, timeout: 600000 }, async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Ksiazka do druku');
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'makietka-druk-'));
  t.after(() => fs.rmSync(katalog, { recursive: true, force: true }));
  const STRON = 64;

  // Projekt: blok A5 ze spadem 3 mm, 64 strony z tekstem (numer strony), zdjęciem, kolorem dodatkowym i złoceniem.
  const geo = await strona.evaluate(async (stron) => {
    const { stan, edytor } = window.seriodruk;
    const P = await import('./js/projekt.js');
    const O = await import('./js/okladka.js');
    const S = await import('./js/sekcje-specjalne.js');
    const k = await import('./js/kolory-druku.js');
    const Z = await import('./js/app/zapis.js');
    const L = await import('./js/app/lista-stron.js');
    let p = stan.projekt;
    Object.assign(p.sekcje[0], { nazwa: 'Blok' });
    Object.assign(p.sekcje[0].wydruk, { format: 'A5', szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, znaki_ciecia: true });
    p.kolory_dodatkowe = [{ id: 'p186', nazwa: 'PANTONE 186 C', cmyk: [0, 100, 81, 4] }];
    await Z.otworzProjekt(p);
    p = stan.projekt; // otwarty projekt to kopia
    // Treść strony bloku (wzór kopiowany na każdą stronę).
    const plotno = Object.assign(document.createElement('canvas'), { width: 400, height: 300 });
    const c = plotno.getContext('2d');
    const g = c.createLinearGradient(0, 0, 400, 300);
    g.addColorStop(0, '#1d3557'); g.addColorStop(1, '#e9c46a');
    c.fillStyle = g; c.fillRect(0, 0, 400, 300);
    const img = await edytor.dodajObraz(plotno.toDataURL('image/jpeg', 0.9), 'zdjecie.jpg', p.zasoby);
    img.set({ left: 20, top: 60, scaleX: 0.25, scaleY: 0.25 }); // 100 × 75 px → mm wg skali edytora
    const pt = (n) => (n * 25.4) / 72;
    edytor.dodajTekst('Strona {nr}').set({ left: 20, top: 20, width: 100, fontSize: pt(14), fontFamily: 'Lora', fill: '#000000' });
    edytor.dodajProstokat().set({ left: 20, top: 150, width: 50, height: 20, fill: k.hexSpotu(p.kolory_dodatkowe[0], 1), strokeWidth: 0 });
    edytor.dodajElipse().set({ left: 90, top: 150, rx: 18, ry: 10, fill: '#c9a227', strokeWidth: 0, uszlachetnienie: 'folia', folia: 'zloto' });
    edytor.canvas.discardActiveObject();
    edytor.zatwierdz();
    await window.seriodruk.zapiszTeraz();
    const wzor = JSON.parse(JSON.stringify(p.strony[0].obiekty));
    for (let i = 1; i < stron; i += 1) {
      const s = P.nowaStrona(`S${i + 1}`, p.sekcje[0].id);
      s.obiekty = wzor.map((o, j) => ({ ...JSON.parse(JSON.stringify(o)), id: `o_${i}_${j}` }));
      p.strony.push(s);
    }
    // Twarda okładka i wyklejki z typem.
    const okl = P.nowaSekcja('Okładka');
    okl.okladka = { ...O.domyslnaOkladka(), oprawa: 'twarda' };
    p.sekcje.unshift(okl);
    p.strony.unshift(P.nowaStrona('Okładka', okl.id));
    S.dodajWyklejki(p, { zadruk: 'jednostronny' });
    P.uporzadkujStrony(p);
    O.przeliczOkladki(p);
    S.przeliczSpecjalne(p);
    await Z.otworzProjekt(p);
    p = stan.projekt;
    // Okładka: tło na całość ze spadem i tytuł na przodzie; wyklejki: tło.
    const okl2 = p.sekcje.find((x) => x.okladka);
    const geom = O.geometriaOkladki(p, okl2);
    const przod = geom.strefy.find((z) => z.rodzaj === 'przod');
    await L.przejdzDoStrony(0);
    const ow = okl2.wydruk;
    edytor.dodajProstokat().set({ left: -ow.spad_mm, top: -ow.spad_mm, width: ow.szerokosc_mm + 2 * ow.spad_mm, height: ow.wysokosc_mm + 2 * ow.spad_mm, fill: '#f1faee', strokeWidth: 0, bez_ostrzezen: true });
    edytor.dodajTekst('Tytuł książki').set({ left: przod.x1 + 15, top: 60, width: 110, fontSize: pt(28), fontFamily: 'Playfair Display', fill: '#000000', uszlachetnienie: 'folia', folia: 'zloto' });
    edytor.canvas.discardActiveObject(); edytor.zatwierdz(); await window.seriodruk.zapiszTeraz();
    for (const typ of ['wyklejka_przednia', 'wyklejka_tylna']) {
      const i = p.strony.findIndex((s) => S.typSekcji(p.sekcje.find((x) => x.id === s.sekcja)) === typ);
      await L.przejdzDoStrony(i);
      const w = p.strony[i] && p.sekcje.find((x) => x.id === p.strony[i].sekcja).wydruk;
      edytor.dodajProstokat().set({ left: -w.spad_mm, top: -w.spad_mm, width: w.szerokosc_mm + 2 * w.spad_mm, height: w.wysokosc_mm + 2 * w.spad_mm, fill: '#a8dadc', strokeWidth: 0, bez_ostrzezen: true });
      edytor.canvas.discardActiveObject(); edytor.zatwierdz(); await window.seriodruk.zapiszTeraz();
    }
    const sek = (typ) => p.sekcje.find((s) => S.typSekcji(s) === typ).wydruk;
    return {
      okladka: { w: geom.szerokosc, h: geom.wysokosc, grzbiet: geom.grzbiet, sekcja: { w: ow.szerokosc_mm, h: ow.wysokosc_mm, spad: ow.spad_mm } },
      wyklejka: { w: sek('wyklejka_przednia').szerokosc_mm, h: sek('wyklejka_przednia').wysokosc_mm, spad: sek('wyklejka_przednia').spad_mm },
      obiekty: wzor.map((o) => ({ type: o.type, left: o.left, top: o.top, w: (o.width || 2 * (o.rx || 0)) * (o.scaleX || 1), h: (o.height || 2 * (o.ry || 0)) * (o.scaleY || 1), uszl: o.uszlachetnienie || '' })),
    };
  }, STRON);
  t.diagnostic(`okładka ${geo.okladka.w} × ${geo.okladka.h} mm, grzbiet ${geo.okladka.grzbiet} mm; wyklejka ${geo.wyklejka.w} × ${geo.wyklejka.h} mm`);
  // Wymiary okładki w sekcji = geometria z js/okladka.js (ta sama liczba w oknie sekcji i w pliku).
  assert.ok(blisko(geo.okladka.sekcja.w, geo.okladka.w) && blisko(geo.okladka.sekcja.h, geo.okladka.h), 'sekcja okładki ma wymiary z geometrii');
  assert.deepEqual([geo.wyklejka.w, geo.wyklejka.h], [296, 210], 'wyklejka = dwie strony bloku');

  // --- Pliki dla drukarni ---
  const pliki = await eksport(strona, katalog, eksportDrukarni, OPCJE_DRUKARNI);
  const nazwy = pliki.map((p) => p.nazwa);
  t.diagnostic(`pliki: ${nazwy.join(' | ')}`);
  assert.equal(pliki.length, 3, `trzy pliki: ${nazwy.join(', ')}`);
  const plik = (slowo) => pliki.find((p) => new RegExp(` - \\d+ ${slowo}\\.pdf$`).test(p.nazwa)).sciezka;
  assert.ok(/1 okladka/.test(nazwy[0]) && /2 wyklejki/.test(nazwy[1]) && /3 blok/.test(nazwy[2]), 'kolejność: okładka, wyklejki, blok');

  const okladka = sprawdzPlikDrukarni(plik('okladka'), 'okładka');
  assert.equal(okladka.strony.length, 1);
  sprawdzPola(okladka.strony[0], { w: geo.okladka.w, h: geo.okladka.h, spad: geo.okladka.sekcja.spad }, 'okładka');

  const wyklejki = sprawdzPlikDrukarni(plik('wyklejki'), 'wyklejki');
  assert.equal(wyklejki.strony.length, 2, 'wyklejka przednia i tylna w jednym pliku');
  for (const s of wyklejki.strony) sprawdzPola(s, { w: 296, h: 210, spad: geo.wyklejka.spad }, 'wyklejka');

  const blokPlik = plik('blok');
  const blok = sprawdzPlikDrukarni(blokPlik, 'blok');
  assert.equal(blok.strony.length, STRON, `blok ma ${STRON} stron`);
  for (const [i, s] of blok.strony.entries()) sprawdzPola(s, { w: 148, h: 210, spad: 3 }, `blok, strona ${i + 1}`);
  assert.equal(blok.czcionki, 1, 'jedna czcionka (Lora), osadzona');
  assert.ok(blok.pokrycia.every((p) => p[3] > 0), 'na każdej stronie bloku jest czerń (tekst)');
  // Tekst w pliku: numery stron bloku od 1 (okładka i wyklejki nie przesuwają numeracji).
  const tekstBloku = uruchom('pdftotext', ['-f', '1', '-l', '3', blokPlik, '-']).stdout;
  assert.match(tekstBloku, /Strona 1\b[\s\S]*Strona 2\b[\s\S]*Strona 3\b/);

  // Płyty strony bloku: C, M, Y, K, kolor dodatkowy i złocenie – każda tam, gdzie trzeba.
  const p = plyty(blokPlik, 1, katalog);
  const nazwyPlyt = Object.keys(p).sort();
  t.diagnostic(`płyty strony bloku: ${nazwyPlyt.join(', ')}`);
  for (const n of ['Cyan', 'Magenta', 'Yellow', 'Black', 'PANTONE 186 C', 'Foil_Gold']) assert.ok(nazwyPlyt.includes(n), `płyta ${n} (są: ${nazwyPlyt.join(', ')})`);
  const s0 = blok.strony[0];
  const dpi = 50;
  // mm od lewego górnego rogu formatu → piksel arkusza (MediaBox).
  const px = (x, y) => [Math.round(((s0.trim.x - s0.media.x) / 72 + x / 25.4) * dpi), Math.round(((s0.media.b[3] - s0.trim.b[3]) / 72 + y / 25.4) * dpi)];
  const obszar = (plyta, o) => { const [a, b] = px(o.left + 1, o.top + 1); const [c, d] = px(o.left + o.w - 1, o.top + o.h - 1); return ileFarby(plyta, a, b, c, d); };
  const prost = geo.obiekty.find((o) => o.type === 'rect');
  const elipsa = geo.obiekty.find((o) => o.type === 'ellipse');
  const zdjecie = geo.obiekty.find((o) => o.type === 'image');
  assert.ok(obszar(p['PANTONE 186 C'], prost) > 50, 'prostokąt na płycie koloru dodatkowego');
  assert.equal(obszar(p.Magenta, prost), 0, 'kolor dodatkowy nie idzie na magentę (bez rozbicia na CMYK)');
  assert.ok(obszar(p.Foil_Gold, elipsa) > 20, 'elipsa na płycie złocenia');
  assert.equal(obszar(p.Foil_Gold, prost), 0, 'złocenie tylko tam, gdzie element złocony');
  assert.equal(obszar(p.Foil_Gold, zdjecie), 0);
  assert.ok(obszar(p.Cyan, zdjecie) + obszar(p.Yellow, zdjecie) > 50, 'zdjęcie w farbach kolorowych');
  // Znaki cięcia: poza spadem tylko czarna farba (na płycie K), żadnej innej farby.
  const [bx1, by1] = px(-3, -3); const [bx2, by2] = px(151, 213);
  const pozaSpadem = (pl) => ileFarby(pl, 0, 0, pl.w, pl.h) - ileFarby(pl, bx1, by1, bx2, by2);
  assert.ok(pozaSpadem(p.Black) > 10, 'znaki cięcia na płycie czarnej');
  for (const n of ['Cyan', 'Magenta', 'Yellow', 'PANTONE 186 C', 'Foil_Gold']) assert.equal(pozaSpadem(p[n]), 0, `poza spadem nic na płycie ${n}`);
  // Okładka: tytuł złocony, wyklejki bez złocenia.
  const po = plyty(plik('okladka'), 1, fs.mkdtempSync(path.join(katalog, 'o-')));
  assert.ok(ileFarby(po.Foil_Gold, 0, 0, po.Foil_Gold.w, po.Foil_Gold.h) > 20, 'tytuł okładki na płycie złocenia');
  assert.ok(!('PANTONE 186 C' in po) || ileFarby(po['PANTONE 186 C'], 0, 0, po['PANTONE 186 C'].w, po['PANTONE 186 C'].h) === 0, 'na okładce nie ma koloru dodatkowego');

  // Obraz strony z popplera (pdftoppm): proporcje arkusza, na stronie jest treść.
  const png = path.join(katalog, 'podglad');
  assert.equal(uruchom('pdftoppm', ['-f', '1', '-l', '1', '-r', '20', '-gray', blokPlik, png]).status, 0);
  const pgm = fs.readFileSync(fs.readdirSync(katalog).map((f) => path.join(katalog, f)).find((f) => /podglad-0*1\.pgm$/.test(f)));
  const [, sz, wy] = pgm.toString('latin1', 0, 40).match(/^P5\s+(\d+)\s+(\d+)\s+255\s/).map(Number);
  assert.ok(Math.abs(sz / wy - s0.media.w / s0.media.h) < 0.02, `proporcje obrazu strony ${sz}×${wy}`);
  const piksele = pgm.subarray(pgm.length - sz * wy);
  assert.ok(piksele.filter((v) => v < 128).length > 30, 'pdftoppm rysuje treść strony');

  // --- Drukuj w domu: broszura A4 ---
  const [broszura] = await eksport(strona, katalog, eksportBroszury);
  const bi = uruchom('pdfinfo', [broszura.sciezka]).stdout;
  assert.match(bi, new RegExp(`Pages:\\s+${STRON / 2}\\b`), `broszura: ${STRON / 4} kartek, przód i tył`);
  assert.match(bi, /Page size:\s+841\.\d+ x 595\.\d+ pts/, 'kartka A4 poziomo');
  assert.equal(uruchom('qpdf', ['--check', broszura.sciezka]).status, 0);
  // Kolejność stron na kartkach (jak w js/impozycja.js – kolejnoscBroszury): 64|1, 2|63, 62|3, …
  const kolejnosc = [];
  for (let i = 1; i <= STRON / 2; i += 1) {
    const linia = uruchom('pdftotext', ['-layout', '-f', String(i), '-l', String(i), broszura.sciezka, '-']).stdout;
    kolejnosc.push([...linia.matchAll(/Strona (\d+)/g)].map((m) => Number(m[1])));
  }
  const oczekiwana = [];
  for (let s = 0; s < STRON / 4; s += 1) oczekiwana.push([STRON - 2 * s, 2 * s + 1], [2 * s + 2, STRON - 1 - 2 * s]);
  assert.deepEqual(kolejnosc, oczekiwana, 'strony broszury w kolejności do złożenia');
  t.diagnostic(`broszura: ${kolejnosc.slice(0, 4).map((x) => x.join('|')).join(', ')} …`);
  assert.deepEqual(bledy, []);
});

// Własny projekt użytkownika (plik JSON z aplikacji): te same pliki dla drukarni i broszura. Tylko z MAKIETKA_PROJEKT.
const PROJEKT = process.env.MAKIETKA_PROJEKT;
test('druk sprawdzony narzędziami: własny projekt (MAKIETKA_PROJEKT)', { skip: POMIN || (!PROJEKT && 'bez MAKIETKA_PROJEKT'), timeout: 1800000 }, async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wczytany');
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'makietka-projekt-'));
  t.after(() => fs.rmSync(katalog, { recursive: true, force: true }));
  const dane = JSON.parse(fs.readFileSync(PROJEKT, 'utf8'));
  const opis = await strona.evaluate(async (d) => {
    const P = await import('./js/projekt.js');
    const O = await import('./js/okladka.js');
    const S = await import('./js/sekcje-specjalne.js');
    const Z = await import('./js/app/zapis.js');
    const { rozwin } = await import('./js/serie.js');
    const p = P.normalizuj(d);
    // Sekcje z „wyklejka” w nazwie: typ, jak po kliknięciu „Ustaw typ” w podpowiedzi aplikacji.
    for (const s of p.sekcje) {
      if (S.typSekcji(s) !== 'zwykla') continue;
      if (/wyklejka przednia/i.test(s.nazwa)) s.typ = 'wyklejka_przednia';
      if (/wyklejka tylna/i.test(s.nazwa)) s.typ = 'wyklejka_tylna';
    }
    O.przeliczOkladki(p);
    S.przeliczSpecjalne(p);
    await Z.otworzProjekt(p);
    const okl = p.sekcje.find((s) => s.okladka);
    const ciag = rozwin(window.seriodruk.stan.projekt);
    return {
      typy: p.sekcje.map((s) => `${s.nazwa}: ${S.typSekcji(s)} (${S.rolaSekcji(p, s)})`),
      okladka: okl && { geo: O.geometriaOkladki(p, okl), w: okl.wydruk.szerokosc_mm, h: okl.wydruk.wysokosc_mm, spad: okl.wydruk.spad_mm },
      stron: ciag.egzemplarze.length,
      sekcje: Object.fromEntries(p.sekcje.map((s) => [s.id, { w: s.wydruk.szerokosc_mm, h: s.wydruk.wysokosc_mm, spad: s.wydruk.spad_mm, rola: S.rolaSekcji(p, s) }])),
      role: ciag.egzemplarze.map((e) => S.rolaSekcji(p, e.sekcja)),
      formaty: ciag.egzemplarze.map((e) => [e.sekcja.wydruk.szerokosc_mm, e.sekcja.wydruk.wysokosc_mm, e.sekcja.wydruk.spad_mm]),
    };
  }, dane);
  t.diagnostic(`sekcje: ${opis.typy.join(' | ')}`);
  t.diagnostic(`stron po rozwinięciu serii: ${opis.stron}; okładka ${opis.okladka?.w} × ${opis.okladka?.h} (spad ${opis.okladka?.spad}), geometria ${opis.okladka?.geo.szerokosc} × ${opis.okladka?.geo.wysokosc}, grzbiet ${opis.okladka?.geo.grzbiet}`);
  if (opis.okladka) assert.ok(blisko(opis.okladka.w, opis.okladka.geo.szerokosc) && blisko(opis.okladka.h, opis.okladka.geo.wysokosc), 'okładka w sekcji = geometria');

  const pliki = await eksport(strona, katalog, eksportDrukarni, OPCJE_DRUKARNI);
  t.diagnostic(`pliki: ${pliki.map((p) => p.nazwa).join(' | ')}`);
  const wgRoli = { okladka: 'okladka', wyklejka: 'wyklejki', blok: 'blok' };
  for (const [rola, slowo] of Object.entries(wgRoli)) {
    // Po numerze pliku i roli (nazwa projektu może zawierać to samo słowo, np. „… – blok”).
    const f = pliki.find((p) => new RegExp(` - \\d+ ${slowo}\\.pdf$`).test(p.nazwa));
    const ile = opis.role.filter((r) => r === rola).length;
    if (!ile) continue;
    assert.ok(f, `plik dla roli ${rola}`);
    const b = sprawdzPlikDrukarni(f.sciezka, slowo);
    assert.equal(b.strony.length, ile, `${slowo}: ${ile} stron`);
    const formaty = opis.formaty.filter((_, i) => opis.role[i] === rola);
    for (const [i, s] of b.strony.entries()) sprawdzPola(s, { w: formaty[i][0], h: formaty[i][1], spad: formaty[i][2] }, `${slowo}, strona ${i + 1}`);
    t.diagnostic(`${slowo}: ${b.strony.length} str., pierwsza ${b.strony[0].trim.w} × ${b.strony[0].trim.h} mm, spad do ${b.strony[0].bleed.w} × ${b.strony[0].bleed.h}, arkusz ${b.strony[0].media.w} × ${b.strony[0].media.h}, czcionek ${b.czcionki}`);
  }
  const [broszura] = await eksport(strona, katalog, eksportBroszury);
  const ileBloku = opis.role.filter((r) => r === 'blok').length;
  assert.match(uruchom('pdfinfo', [broszura.sciezka]).stdout, new RegExp(`Pages:\\s+${Math.ceil(ileBloku / 4) * 2}\\b`), 'broszura: kartki przód i tył');
  assert.equal(uruchom('qpdf', ['--check', broszura.sciezka]).status, 0);
  assert.deepEqual(bledy, []);
});
