const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Pliki PDF z aplikacji sprawdzane programami, które z aplikacją nie mają nic wspólnego:
// qpdf (składnia i budowa pliku), poppler (czcionki, obrazy, pola strony, rozpoznanie PDF/X)
// i Ghostscript (rozbarwienie na cztery farby – ile której farby jest w którym miejscu strony).
// To kontrola budowy pliku i farb, nie certyfikat zgodności z PDF/X-4.
//
// Programy są na serwerze testów (instaluje je workflow „Testy”). Bez nich test się pomija.
const PROGRAMY = { qpdf: ['--version'], gs: ['--version'], pdffonts: ['-v'], pdfimages: ['-v'], pdfinfo: ['-v'], pdftotext: ['-v'] };
const brakujace = Object.entries(PROGRAMY).filter(([p, a]) => spawnSync(p, a, { encoding: 'utf8' }).error).map(([p]) => p);

const uruchom = (program, argumenty, opcje = {}) => {
  const w = spawnSync(program, argumenty, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opcje });
  if (w.error) throw w.error;
  return w;
};

// Wiersze tabeli z pdffonts / pdfimages: nagłówek, linia kresek, potem dane w kolumnach o stałej szerokości.
function tabela(wyjscie) {
  const linie = wyjscie.split('\n').filter((l) => l.trim());
  const kreski = linie.findIndex((l) => /^-+( -+)*$/.test(l.trim()));
  if (kreski < 1) return [];
  const naglowki = linie[kreski - 1].trim().split(/\s+/);
  return linie.slice(kreski + 1).map((l) => {
    const pola = l.trim().split(/\s+/);
    // Nazwa czcionki nie ma spacji, a „type” (np. „CID TrueType”) może je mieć – dlatego kolumny liczone od końca.
    const od = (nazwa) => pola[pola.length - (naglowki.length - naglowki.indexOf(nazwa))];
    return Object.fromEntries(naglowki.map((n) => [n, od(n)]).concat([['pierwsza', pola[0]]]));
  });
}

// Obraz CMYK z Ghostscripta (TIFF bez pakowania): { w, h, piksel(x, y) → [C, M, Y, K] w 0–255 }.
function wczytajTiffCmyk(plik) {
  const b = fs.readFileSync(plik);
  const le = b.toString('latin1', 0, 2) === 'II';
  const u16 = (p) => (le ? b.readUInt16LE(p) : b.readUInt16BE(p));
  const u32 = (p) => (le ? b.readUInt32LE(p) : b.readUInt32BE(p));
  assert.equal(u16(2), 42, 'plik TIFF');
  const ifd = u32(4);
  const znaczniki = {};
  for (let i = 0; i < u16(ifd); i += 1) {
    const p = ifd + 2 + i * 12;
    const typ = u16(p + 2); const ile = u32(p + 4);
    const rozmiar = { 1: 1, 2: 1, 3: 2, 4: 4 }[typ] || 4;
    const gdzie = ile * rozmiar <= 4 ? p + 8 : u32(p + 8);
    znaczniki[u16(p)] = Array.from({ length: ile }, (_, k) => (rozmiar === 2 ? u16(gdzie + k * 2) : rozmiar === 4 ? u32(gdzie + k * 4) : b[gdzie + k]));
  }
  const [w] = znaczniki[256]; const [h] = znaczniki[257];
  assert.deepEqual([znaczniki[259][0], znaczniki[277][0]], [1, 4], 'TIFF bez pakowania, cztery farby');
  const dane = Buffer.concat(znaczniki[273].map((od, i) => b.subarray(od, od + znaczniki[279][i])));
  assert.equal(dane.length, w * h * 4);
  return { w, h, piksel: (x, y) => { const i = (y * w + x) * 4; return [dane[i], dane[i + 1], dane[i + 2], dane[i + 3]]; } };
}

const procent = (v) => Math.round((v / 255) * 100);

// Strona próbna: zdjęcie, czarny tekst, kolorowy tytuł, prostokąt z obrysem, gradient i szary pas na spad.
async function zbudujStrone(strona) {
  await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const p = Object.assign(document.createElement('canvas'), { width: 800, height: 600 });
    const c = p.getContext('2d');
    const g = c.createLinearGradient(0, 0, 800, 600);
    g.addColorStop(0, '#0b132b'); g.addColorStop(0.5, '#e63946'); g.addColorStop(1, '#f1faee');
    c.fillStyle = g; c.fillRect(0, 0, 800, 600);
    // Plamy o stałym, powtarzalnym układzie – zdjęcie ma mieć szczegóły, a test te same liczby za każdym razem.
    let ziarno = 12345;
    const los = () => { ziarno = (ziarno * 1103515245 + 12345) % 2147483648; return ziarno / 2147483648; };
    for (let i = 0; i < 3000; i += 1) { c.fillStyle = `rgba(${Math.floor(los() * 255)},${Math.floor(los() * 255)},${Math.floor(los() * 255)},0.3)`; c.fillRect(los() * 800, los() * 600, 8, 8); }
    // Gładkie zielone pole w rogu zdjęcia – jego farby da się porównać z tym, co daje sam profil.
    c.fillStyle = '#2a9d8f'; c.fillRect(560, 400, 220, 180);
    const img = await edytor.dodajObraz(p.toDataURL('image/jpeg', 0.9), 'zdjecie.jpg', stan.projekt.zasoby);
    img.set({ left: 14, top: 20, scaleX: 0.15, scaleY: 0.15 });
    const pt = (n) => (n * 25.4) / 72;
    edytor.dodajTekst('Czarny tekst 12 pt – ma iść samą czarną farbą. Zażółć gęślą jaźń; ligatury: fi fl ffl.').set({ left: 14, top: 120, width: 120, fontSize: pt(12), fontFamily: 'Lora', fill: '#000000' });
    edytor.dodajTekst('Kolorowy tytuł').set({ left: 14, top: 145, width: 120, fontSize: pt(24), fontFamily: 'Playfair Display', fontWeight: 'bold', fill: '#c1121f' });
    edytor.dodajProstokat().set({ left: 14, top: 165, width: 50, height: 25, fill: '#118ab2', stroke: '#000000', strokeWidth: 0.5 });
    edytor.dodajElipse().set({ left: 75, top: 165, rx: 25, ry: 12, strokeWidth: 0, fill: new fabric.Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 1, y2: 0 }, colorStops: [{ offset: 0, color: '#ffd166' }, { offset: 1, color: '#06d6a0' }] }) });
    edytor.dodajProstokat().set({ left: -3, top: 195, width: 154, height: 18, fill: '#808080', strokeWidth: 0, bez_ostrzezen: true });
    edytor.canvas.discardActiveObject();
    edytor.zatwierdz();
    await window.seriodruk.zapiszTeraz();
  });
}

async function zapiszPdf(strona, plik, opcje) {
  const b64 = await strona.evaluate(async (o) => {
    const { eksportujPdf } = await import('./js/eksport.js');
    const w = await eksportujPdf(window.seriodruk.stan.projekt, { znaki: true, spad: true, ...o });
    const bajty = new Uint8Array(await w.blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
    return btoa(s);
  }, opcje);
  fs.writeFileSync(plik, Buffer.from(b64, 'base64'));
  return fs.statSync(plik).size;
}

// Budowa pliku odczytana przez qpdf: obiekty, strony, treść stron.
function budowa(plik) {
  const obiekty = JSON.parse(uruchom('qpdf', ['--json', '--json-key=qpdf', plik]).stdout).qpdf[1];
  const strony = JSON.parse(uruchom('qpdf', ['--json', '--json-key=pages', plik]).stdout).pages;
  const obiekt = (odw) => obiekty[`obj:${odw}`]?.value ?? obiekty[`obj:${odw}`]?.stream?.dict;
  const strumien = (odw) => uruchom('qpdf', [`--show-object=${odw.replace(/ R$/, '').replace(' ', ',')}`, '--filtered-stream-data', plik], { encoding: 'buffer' }).stdout;
  return { obiekty, strony, obiekt, strumien, tekst: JSON.stringify(obiekty) };
}

// Wspólne sprawdzenia pliku PDF/X-4 w CMYK. Zwraca rozbarwienie pierwszej strony i funkcję punkt(mm) → farby.
function sprawdzPdfX(plik, katalog, { profil }) {
  // 1. Składnia.
  const kontrola = uruchom('qpdf', ['--check', plik]);
  assert.equal(kontrola.status, 0, `qpdf --check: ${kontrola.stdout}${kontrola.stderr}`);
  assert.match(kontrola.stdout, /No syntax or stream encoding errors found/);

  // 2. Oznaczenia PDF/X-4 i profil warunków druku.
  const b = budowa(plik);
  const zakonczenie = b.obiekty.trailer.value;
  assert.ok(Array.isArray(zakonczenie['/ID']) && zakonczenie['/ID'].length === 2, 'identyfikator pliku');
  const info = b.obiekt(zakonczenie['/Info']);
  assert.equal(info['/GTS_PDFXVersion'], 'u:PDF/X-4');
  assert.ok(['/False', '/True'].includes(info['/Trapped']), 'Trapped jest podane');
  assert.ok(info['/Title'] && info['/CreationDate'] && info['/ModDate'], 'tytuł i daty');
  const katalogPdf = b.obiekt(zakonczenie['/Root']);
  assert.ok(katalogPdf['/Metadata'], 'metadane XMP');
  assert.match(b.strumien(katalogPdf['/Metadata']).toString('utf8'), /GTS_PDFXVersion[^<]*>?\s*PDF\/X-4|GTS_PDFXVersion="PDF\/X-4"/);
  const [zamiar] = katalogPdf['/OutputIntents'];
  assert.equal(zamiar['/S'], '/GTS_PDFX');
  assert.equal(zamiar['/OutputConditionIdentifier'], `u:${profil}`);
  assert.equal(b.obiekty[`obj:${zamiar['/DestOutputProfile']}`].stream.dict['/N'], 4, 'profil czterech farb');
  const icc = b.strumien(zamiar['/DestOutputProfile']);
  assert.deepEqual([icc.toString('latin1', 12, 16), icc.toString('latin1', 16, 20)], ['prtr', 'CMYK'], 'profil drukarski CMYK');
  const pdfinfo = uruchom('pdfinfo', ['-box', plik]).stdout;
  assert.match(pdfinfo, /PDF subtype:\s+PDF\/X-4/, 'poppler rozpoznaje PDF/X-4');
  assert.match(pdfinfo, /Encrypted:\s+no/);

  // 3. Pola strony: obcięcie w spadzie, spad w arkuszu.
  for (const s of b.strony) {
    const st = b.obiekt(s.object);
    const [m, sp, tr] = ['/MediaBox', '/BleedBox', '/TrimBox'].map((k) => st[k]);
    assert.ok(m && sp && tr, 'MediaBox, BleedBox i TrimBox');
    assert.ok(tr[0] >= sp[0] && tr[1] >= sp[1] && tr[2] <= sp[2] && tr[3] <= sp[3], 'pole obcięcia mieści się w spadzie');
    assert.ok(sp[0] >= m[0] && sp[1] >= m[1] && sp[2] <= m[2] && sp[3] <= m[3], 'spad mieści się w arkuszu');
    // 4. Żadnego RGB w treści strony.
    for (const tresc of s.contents) {
      const polecenia = b.strumien(tresc).toString('latin1');
      assert.equal((polecenia.match(/(^|\s)(rg|RG)(?=\s|$)/g) || []).length, 0, 'treść strony bez poleceń RGB');
    }
    for (const o of s.images) assert.equal(o.colorspace, '/DeviceCMYK', `obraz ${o.name} w CMYK`);
    assert.ok(s.images.length >= 1 || s.contents.length, 'strona ma treść');
  }
  // Nic w pliku nie jest opisane wprost w RGB (obraz, gradient). Sam opis „czym jest RGB” (DefaultRGB z profilem
  // sRGB) może w pliku być – PDF/X-4 go dopuszcza, tu nic z niego nie korzysta.
  assert.ok(!/"\/(ColorSpace|CS)":"\/(DeviceRGB|CalRGB)"/.test(b.tekst), 'żaden obraz ani gradient nie jest w RGB');

  // 5. Obrazy według popplera.
  const obrazy = tabela(uruchom('pdfimages', ['-list', plik]).stdout);
  for (const o of obrazy) {
    // Maska (jeden bit na piksel) nie ma barwy; każdy obraz z barwą ma być w czterech farbach.
    if (o.type === 'image') assert.equal(o.color, 'cmyk', `pdfimages: obraz ${o.num} w CMYK`);
    else assert.ok(['mask', 'stencil', 'smask'].includes(o.type), `pdfimages: nieznany rodzaj obrazu ${o.type}`);
  }

  // 6. Rozbarwienie: Ghostscript rysuje stronę w czterech farbach, bez wygładzania.
  const tiff = path.join(katalog, `${path.basename(plik, '.pdf')}.tif`);
  const gs = uruchom('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=tiff32nc', '-sCompression=none', '-r100', '-dTextAlphaBits=1', '-dGraphicsAlphaBits=1', '-dFirstPage=1', '-dLastPage=1', `-sOutputFile=${tiff}`, plik]);
  assert.equal(gs.status, 0, `Ghostscript: ${gs.stdout}${gs.stderr}`);
  const obraz = wczytajTiffCmyk(tiff);
  const st = b.obiekt(b.strony[0].object);
  const [, , , gora] = st['/MediaBox'];
  const [tx, , , tGora] = st['/TrimBox'];
  // Milimetry strony (od lewego górnego rogu po obcięciu) → piksele rozbarwienia.
  const px = (x, y) => [Math.round(((tx + (x * 72) / 25.4) / 72) * 100), Math.round(((gora - tGora + (y * 72) / 25.4) / 72) * 100)];
  const punkt = (x, y) => obraz.piksel(...px(x, y));
  const obszar = (x1, y1, x2, y2) => {
    const [ax, ay] = px(x1, y1); const [bx, by] = px(x2, y2);
    const lista = [];
    for (let y = ay; y <= by; y += 1) for (let x = ax; x <= bx; x += 1) lista.push(obraz.piksel(x, y));
    return lista;
  };
  return { b, obrazy, obraz, punkt, obszar };
}

// Kolor przeliczony przez profil warunków druku (tym samym kodem, którego używa eksport): [C, M, Y, K] w 0–255.
const przezProfil = (strona, warunki, kolor) => strona.evaluate(async ([w, k]) => {
  const { czytajProfil, SilnikCmyk, WARUNKI_DRUKU } = await import('./js/profil-icc.js');
  const silnik = new SilnikCmyk(czytajProfil(await (await fetch(WARUNKI_DRUKU[w].plik)).arrayBuffer()));
  return silnik.cmyk(...k.map((v) => v / 255)).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
}, [warunki, kolor]);

// Łączna wielkość obrazów w pliku (po spakowaniu), w bajtach – bez profilu barwnego i reszty.
const wielkoscObrazow = (b) => Object.values(b.obiekty).filter((o) => o.stream?.dict?.['/Subtype'] === '/Image').reduce((s, o) => s + o.stream.dict['/Length'], 0);

// Farby w miejscach strony próbnej – te same oczekiwania dla pliku wektorowego i dla obrazów stron.
// zielony: farby gładkiego pola zdjęcia według profilu.
function sprawdzFarby({ obraz, punkt, obszar }, opis, limitFarby, zielony) {
  // Zdjęcie jest w pliku JPEG-iem w czterech farbach: po odczytaniu innym programem farby gładkiego pola
  // zgadzają się z profilem (zapas na stratny zapis zdjęcia źródłowego i wynikowego).
  const pole = punkt(114, 93);
  assert.ok(pole.every((v, i) => Math.abs(v - zielony[i]) <= 8), `${opis}: zielone pole zdjęcia ${pole} wobec profilu ${zielony}`);
  // Czarny tekst na białym papierze: w całym pasie tekstu nie ma ani odrobiny farb kolorowych.
  const tekst = obszar(14, 121, 134, 133);
  assert.equal(tekst.filter(([c, m, y]) => c || m || y).length, 0, `${opis}: czarny tekst to sama czarna farba`);
  assert.ok(Math.max(...tekst.map((p) => p[3])) >= 250, `${opis}: tekst jest w pełnej czerni`);
  assert.ok(tekst.filter((p) => p[3] === 0).length > tekst.length / 2, `${opis}: między literami czysty papier`);
  // Szary pas: sama czerń, mniej więcej w połowie.
  const szary = punkt(70, 203);
  assert.deepEqual(szary.slice(0, 3), [0, 0, 0], `${opis}: szarość bez farb kolorowych`);
  assert.ok(procent(szary[3]) >= 50 && procent(szary[3]) <= 70, `${opis}: szary pas to czerń ok. 60% (jest ${procent(szary[3])}%)`);
  // Papier.
  assert.deepEqual(punkt(140, 100), [0, 0, 0, 0], `${opis}: papier bez farby`);
  // Kolory: tytuł czerwony (magenta i żółta), prostokąt niebieski (cyjan), zdjęcie w farbach kolorowych.
  const tytul = obszar(14, 146, 120, 158);
  assert.ok(Math.max(...tytul.map((p) => p[1])) > 200 && Math.max(...tytul.map((p) => p[2])) > 150, `${opis}: kolorowy tytuł ma magentę i żółtą`);
  const niebieski = punkt(30, 178);
  assert.ok(niebieski[0] > 150 && niebieski[0] > niebieski[1] && niebieski[0] > niebieski[2], `${opis}: niebieski prostokąt (${niebieski.map(procent)})`);
  const zdjecie = punkt(74, 65);
  assert.ok(zdjecie[0] + zdjecie[1] + zdjecie[2] > 100, `${opis}: zdjęcie w farbach kolorowych (${zdjecie.map(procent)})`);
  // Największe łączne pokrycie farbą na całej stronie.
  let najwiecej = 0;
  for (let y = 0; y < obraz.h; y += 1) for (let x = 0; x < obraz.w; x += 1) { const p = obraz.piksel(x, y); najwiecej = Math.max(najwiecej, p[0] + p[1] + p[2] + p[3]); }
  const pokrycie = Math.round((najwiecej / 255) * 100);
  assert.ok(pokrycie <= limitFarby, `${opis}: największe łączne pokrycie farbą ${pokrycie}% (granica ${limitFarby}%)`);
  return pokrycie;
}

test('PDF sprawdzony niezależnymi programami (qpdf, poppler, Ghostscript): PDF/X-4 wektorowy i obrazy stron w CMYK', { skip: brakujace.length ? `brak programów: ${brakujace.join(', ')} (apt-get install ghostscript qpdf poppler-utils)` : false }, async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Próbka do drukarni');
  await zbudujStrone(strona);
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'seriodruk-pdf-'));
  t.after(() => fs.rmSync(katalog, { recursive: true, force: true }));

  // Papier powlekany, profil z granicą 300% łącznego pokrycia; mały zapas na zaokrąglenia.
  const LIMIT = 305;

  // --- Plik wektorowy: tekst, kształty i zdjęcia w CMYK przez profil ---
  const wektor = path.join(katalog, 'wektor.pdf');
  const rozmiarWektora = await zapiszPdf(strona, wektor, { tryb: 'wektor', pdfx: 'fogra39', cmyk: true, zdjeciaCmyk: true, dpi: 300 });
  const w = sprawdzPdfX(wektor, katalog, { profil: 'FOGRA39' });
  const czcionki = tabela(uruchom('pdffonts', [wektor]).stdout);
  assert.deepEqual(czcionki.map((c) => c.pierwsza.replace(/^[A-Z]{6}\+/, '').replace(/-\d+$/, '')).sort(), ['Lora-Regular', 'PlayfairDisplay-Bold']);
  // Osadzone, w części (tylko użyte znaki – nazwa z sześcioma literami i plusem), z tabelą znaków do zaznaczania.
  for (const c of czcionki) {
    assert.deepEqual([c.emb, c.sub, c.uni], ['yes', 'yes', 'yes'], `czcionka ${c.pierwsza}: osadzona, w części, z tabelą znaków`);
    assert.match(c.pierwsza, /^[A-Z]{6}\+/);
  }
  assert.equal(new Set(czcionki.map((c) => c.pierwsza.slice(0, 6))).size, czcionki.length, 'każda czcionka ma własny znacznik części');
  // Tekst odczytany innym programem: polskie znaki i ligatury wracają jako zwykłe litery.
  const odczytany = uruchom('pdftotext', ['-enc', 'UTF-8', wektor, '-']).stdout.replace(/\s+/g, ' ');
  assert.match(odczytany, /Czarny tekst 12 pt – ma iść samą czarną farbą\. Zażółć gęślą jaźń; ligatury: fi fl ffl\./);
  assert.match(odczytany, /Kolorowy tytuł/);
  assert.equal(w.obrazy.length, 1, 'zdjęcie jest w pliku raz');
  // Tekst w treści strony jest tekstem (BT … ET), czarny jako sama czerń.
  const tresc = w.b.strony[0].contents.map((o) => w.b.strumien(o).toString('latin1')).join('\n');
  assert.ok(/\bBT\b/.test(tresc) && /(^|\s)0 0 0 1 k(\s|$)/.test(tresc), 'tekst jako tekst, czerń 0 0 0 1 k');
  const zielony = await przezProfil(strona, 'fogra39', [0x2a, 0x9d, 0x8f]);
  const pokrycieWektora = sprawdzFarby(w, 'wektor', LIMIT, zielony);
  // Zdjęcie JPEG zostaje w pliku JPEG-iem (w czterech farbach), nie obrazem bez strat.
  assert.deepEqual(w.b.strony[0].images.map((o) => o.filter), [['/DCTDecode']]);

  // --- Obrazy stron w CMYK ---
  const obrazy = path.join(katalog, 'obrazy.pdf');
  const rozmiarObrazow = await zapiszPdf(strona, obrazy, { tryb: 'obraz', pdfx: 'fogra39', zdjeciaCmyk: true, dpi: 300 });
  const o = sprawdzPdfX(obrazy, katalog, { profil: 'FOGRA39' });
  assert.equal(tabela(uruchom('pdffonts', [obrazy]).stdout).length, 0, 'obrazy stron nie mają czcionek');
  assert.ok(o.obrazy.length >= 1, 'strona jest obrazem');
  const pokrycieObrazow = sprawdzFarby(o, 'obrazy stron', LIMIT, zielony);
  // Strona to dwie warstwy: zdjęcie jako JPEG pod spodem, reszta bez strat na wierzchu, z maską.
  const obrazyStrony = o.b.strony[0].images;
  const jpeg = obrazyStrony.filter((x) => x.filter[0] === '/DCTDecode');
  const calaStrona = obrazyStrony.filter((x) => x.filter[0] === '/FlateDecode');
  assert.deepEqual([jpeg.length, calaStrona.length, obrazyStrony.length], [1, 1, 2], obrazyStrony.map((x) => `${x.name} ${x.filter[0]} ${x.width}x${x.height}`).join(' | '));
  assert.deepEqual([calaStrona[0].width, calaStrona[0].height], [1819, 2551]);
  assert.ok(jpeg[0].width < 1819 && jpeg[0].height < 2551 / 2, 'JPEG obejmuje samo zdjęcie, nie całą stronę');
  const bezStrat = o.b.obiekty[`obj:${calaStrona[0].object}`].stream.dict;
  assert.ok(bezStrat['/Mask'], 'warstwa bez strat ma maskę w miejscu zdjęć');
  assert.equal(o.b.obiekty[`obj:${bezStrat['/Mask']}`].stream.dict['/ImageMask'], true);
  // Zdjęcie jest rysowane pod warstwą bez strat.
  const kolejnosc = o.b.strony[0].contents.map((x) => o.b.strumien(x).toString('latin1')).join('\n').match(/\/(Zdjecia\d+|Strona) Do/g);
  assert.deepEqual(kolejnosc, ['/Zdjecia1 Do', '/Strona Do']);
  // Wielkość: ta sama strona zapisana w całości bez strat miała 2,6 MB obrazu.
  assert.ok(wielkoscObrazow(o.b) < 1500 * 1024, `obrazy strony zajmują ${(wielkoscObrazow(o.b) / 1024).toFixed(0)} kB`);

  // --- Zwykły plik wektorowy (bez standardu): składnia i czcionki ---
  const zwykly = path.join(katalog, 'zwykly.pdf');
  const rozmiarZwyklego = await zapiszPdf(strona, zwykly, { tryb: 'wektor', dpi: 300 });
  assert.equal(uruchom('qpdf', ['--check', zwykly]).status, 0);
  for (const c of tabela(uruchom('pdffonts', [zwykly]).stdout)) assert.deepEqual([c.emb, c.sub], ['yes', 'yes']);
  // Czcionki w części: dwie odmiany zajmują w pliku kilka kilobajtów, nie kilkadziesiąt.
  const bz = budowa(zwykly);
  const czcionkiWPliku = Object.values(bz.obiekty).map((o) => o.value?.['/FontFile2'] || o.value?.['/FontFile3']).filter(Boolean).map((odw) => bz.obiekty[`obj:${odw}`].stream.dict['/Length']);
  assert.equal(czcionkiWPliku.length, 2);
  for (const dl of czcionkiWPliku) assert.ok(dl < 12000, `plik czcionki w PDF ma ${dl} B`);
  t.diagnostic(`pliki czcionek w PDF (po spakowaniu): ${czcionkiWPliku.join(' + ')} B`);

  // Próbki można zostawić do obejrzenia albo wysłania drukarni: SERIODRUK_PROBKI=<katalog> przy uruchomieniu testu.
  if (process.env.SERIODRUK_PROBKI) for (const f of [wektor, obrazy, zwykly]) fs.copyFileSync(f, path.join(process.env.SERIODRUK_PROBKI, path.basename(f)));
  t.diagnostic(`same obrazy w pliku: wektor ${(wielkoscObrazow(w.b) / 1024).toFixed(0)} kB, obrazy stron ${(wielkoscObrazow(o.b) / 1024).toFixed(0)} kB`);
  t.diagnostic(`wektor PDF/X-4: ${(rozmiarWektora / 1024).toFixed(0)} kB, pokrycie do ${pokrycieWektora}%; obrazy stron CMYK: ${(rozmiarObrazow / 1024).toFixed(0)} kB, pokrycie do ${pokrycieObrazow}%; zwykły wektor: ${(rozmiarZwyklego / 1024).toFixed(0)} kB`);
  assert.deepEqual(bledy, []);
});

// Własna czcionka OpenType z obrysami CFF (plik .otf). Plik czcionki nie leży w repozytorium – test pobiera
// czcionkę na wolnej licencji (Source Sans 3, SIL OFL) z sieci; bez sieci ta część się pomija.
const CZCIONKA_OTF = 'https://cdn.jsdelivr.net/gh/adobe-fonts/source-sans@release/OTF/SourceSans3-Regular.otf';

test('PDF sprawdzony niezależnymi programami: własna czcionka OpenType (CFF) jest opisana poprawnie i czytelna dla innych programów', { skip: brakujace.length ? `brak programów: ${brakujace.join(', ')}` : false }, async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Czcionka OTF');
  const jest = await strona.evaluate(async (adres) => {
    const { edytor, oknoCzcionek } = window.seriodruk;
    let bajty;
    try { const odp = await fetch(adres); if (!odp.ok) return false; bajty = new Uint8Array(await odp.arrayBuffer()); } catch { return false; }
    if (new TextDecoder('latin1').decode(bajty.subarray(0, 4)) !== 'OTTO') return false;
    const [c] = await oknoCzcionek.dodaj([new File([bajty], 'SourceSans3-Regular.otf', { type: 'font/otf' })]);
    edytor.dodajTekst('Własna czcionka OTF: Zażółć gęślą jaźń, fi fl ffl, AVATAR 1234567890.').set({ left: 14, top: 30, width: 120, fontSize: (16 * 25.4) / 72, fontFamily: c.rodzina, fill: '#000000' });
    edytor.canvas.discardActiveObject();
    edytor.zatwierdz();
    await window.seriodruk.zapiszTeraz();
    return true;
  }, CZCIONKA_OTF);
  if (!jest) { t.skip('nie udało się pobrać czcionki OpenType do próby (brak sieci)'); return; }
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'seriodruk-pdf-'));
  t.after(() => fs.rmSync(katalog, { recursive: true, force: true }));
  const plik = path.join(katalog, 'otf.pdf');
  await zapiszPdf(strona, plik, { tryb: 'wektor', znaki: false, dpi: 300 });

  assert.equal(uruchom('qpdf', ['--check', plik]).status, 0);
  // Poppler: czcionka z obrysami CFF, osadzona, bez ostrzeżeń o niezgodności rodzaju czcionki.
  const czcionki = uruchom('pdffonts', [plik]);
  assert.equal(czcionki.stderr.trim(), '', `pdffonts bez ostrzeżeń: ${czcionki.stderr}`);
  const [c] = tabela(czcionki.stdout);
  assert.match(czcionki.stdout, /CID Type 0C/);
  assert.deepEqual([c.emb, c.uni], ['yes', 'yes']);
  const tekst = uruchom('pdftotext', ['-enc', 'UTF-8', plik, '-']);
  assert.equal(tekst.stderr.trim(), '', `pdftotext bez ostrzeżeń: ${tekst.stderr}`);
  assert.match(tekst.stdout.replace(/\s+/g, ' '), /Własna czcionka OTF: Zażółć gęślą jaźń, fi fl ffl, AVATAR 1234567890\./);
  // Budowa: czcionka CIDFontType0 z plikiem OpenType (FontFile3), bez wpisu właściwego tylko dla TrueType.
  const b = budowa(plik);
  const opisy = Object.values(b.obiekty).map((o) => o.value).filter((v) => v && v['/Subtype'] === '/CIDFontType0');
  assert.equal(opisy.length, 1);
  assert.equal(opisy[0]['/CIDToGIDMap'], undefined);
  const deskryptor = b.obiekt(opisy[0]['/FontDescriptor']);
  assert.ok(deskryptor['/FontFile3'] && !deskryptor['/FontFile2']);
  assert.equal(b.obiekty[`obj:${deskryptor['/FontFile3']}`].stream.dict['/Subtype'], '/OpenType');
  // Ghostscript rysuje tekst bez błędów: w pasie tekstu jest czerń.
  const tiff = path.join(katalog, 'otf.tif');
  const gs = uruchom('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=tiff32nc', '-sCompression=none', '-r100', `-sOutputFile=${tiff}`, plik]);
  assert.equal(`${gs.stdout}${gs.stderr}`.trim(), '', 'Ghostscript bez komunikatów');
  const obraz = wczytajTiffCmyk(tiff);
  let ciemnych = 0;
  for (let y = 0; y < obraz.h; y += 1) for (let x = 0; x < obraz.w; x += 1) if (obraz.piksel(x, y)[3] > 200) ciemnych += 1;
  assert.ok(ciemnych > 300, `tekst jest narysowany (${ciemnych} ciemnych punktów)`);
  assert.deepEqual(bledy, []);
});
