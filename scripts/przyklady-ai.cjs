// Buduje przykładowe projekty do opisu formatu dla AI (ai/format-seriodruk.md):
//   ai/przyklady/minimalny.json  – jedna strona, tekst i prostokąt;
//   ai/przyklady/kalendarz.json  – okładka, strona dnia jako seria z tabeli 365 dni z wierszami [pomiń],
//                                  tabela dodatkowa miesięcy, zdjęcie z danych, wzorzec ze stopką {nr}, tabela.
// Uruchomienie: node scripts/przyklady-ai.cjs   (wynik jest stały – te same dane przy każdym uruchomieniu)
// Poprawność przykładów sprawdza tests/format-ai.test.cjs: wczytuje je w aplikacji tak jak użytkownik.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const KATALOG = path.join(__dirname, '..', 'ai', 'przyklady');
const pt = (n) => Math.round(((n * 25.4) / 72) * 1000) / 1000; // punkty typograficzne → mm

// Mały obraz PNG w jednym kolorze (data URL) – w prawdziwym projekcie byłyby tu zdjęcia.
function png(szer, wys, [r, g, b]) {
  const crc = (buf) => { let c = ~0; for (const x of buf) { c ^= x; for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const kawalek = (typ, dane) => { const d = Buffer.concat([Buffer.from(typ), dane]); const dl = Buffer.alloc(4); dl.writeUInt32BE(dane.length); const s = Buffer.alloc(4); s.writeUInt32BE(crc(d)); return Buffer.concat([dl, d, s]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(szer, 0); ihdr.writeUInt32BE(wys, 4); ihdr[8] = 8; ihdr[9] = 2;
  const wiersz = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: szer }, () => [r, g, b]).flat())]);
  const dane = zlib.deflateSync(Buffer.concat(Array.from({ length: wys }, () => wiersz)));
  const plik = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), kawalek('IHDR', ihdr), kawalek('IDAT', dane), kawalek('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${plik.toString('base64')}`;
}

const tekst = (id, text, left, top, width, rozmiarPt, dodatki = {}) => ({
  type: 'textbox', id, text, left, top, width, fontSize: pt(rozmiarPt), fontFamily: 'Inter', fill: '#1a1a1a', lineHeight: 1.2, textAlign: 'left', strokeWidth: 0, ...dodatki,
});

// ---------- Minimalny ----------
const minimalny = {
  nazwa: 'Przykład minimalny',
  sekcje: [{ id: 'sek_a5', nazwa: 'Główna', wydruk: { format: 'A5', szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, marginesy: { gora: 12, dol: 12, wewnetrzny: 12, zewnetrzny: 12 }, znaki_ciecia: true }, uklad: 'pojedyncze' }],
  strony: [{
    id: 's_1', nazwa: 'Strona 1', sekcja: 'sek_a5',
    obiekty: [
      { type: 'rect', id: 'o_tlo', left: 12, top: 12, width: 124, height: 40, fill: '#2f5bd3', strokeWidth: 0 },
      tekst('o_tytul', 'Witaj w Seriodruku', 18, 22, 112, 22, { fontFamily: 'Playfair Display', fontWeight: 'bold', fill: '#ffffff' }),
      tekst('o_opis', 'Ten projekt powstał z pliku JSON napisanego ręcznie.', 12, 62, 124, 11),
    ],
  }],
};

// ---------- Kalendarz ----------
const MIESIACE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const PLIKI = ['styczen', 'luty', 'marzec', 'kwiecien', 'maj', 'czerwiec', 'lipiec', 'sierpien', 'wrzesien', 'pazdziernik', 'listopad', 'grudzien'];
const DNI = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const KOLORY = [[29, 53, 87], [69, 123, 157], [42, 157, 143], [138, 177, 125], [233, 196, 106], [244, 162, 97], [231, 111, 81], [214, 40, 40], [155, 93, 229], [93, 63, 211], [69, 90, 100], [33, 37, 41]];

const zasoby = { z_okladka: { nazwa: 'okladka.png', dataUrl: png(12, 8, [47, 91, 211]) } };
PLIKI.forEach((p, i) => { zasoby[`z_${p}`] = { nazwa: `${p}.png`, dataUrl: png(12, 8, KOLORY[i]) }; });

// Rok 2027 zaczyna się w piątek, a blok to tydzień od poniedziałku: przed 1 stycznia stoją
// cztery wiersze pomijane (poniedziałek–czwartek) – zajmują miejsca w bloku, ale stron dla nich nie ma.
const dni = [];
for (let i = 0; i < 4; i += 1) dni.push(['[pomiń]', '', '', '', '']);
for (let d = new Date(Date.UTC(2027, 0, 1)); d.getUTCFullYear() === 2027; d.setUTCDate(d.getUTCDate() + 1)) {
  const m = d.getUTCMonth();
  dni.push([String(d.getUTCDate()), DNI[(d.getUTCDay() + 6) % 7], MIESIACE[m], `${PLIKI[m]}.png`, d.getUTCDay() === 0 ? 'tak' : 'nie']);
}
const hasla = ['Nowy początek', 'Krótki miesiąc', 'Pierwsze kwiaty', 'Deszcz i słońce', 'Majówka', 'Najdłuższe dni', 'Wakacje', 'Żniwa', 'Powrót', 'Złota jesień', 'Wspomnienia', 'Święta'];

const strefaZdjecia = { left: 12, top: 30, width: 124, height: 70 };
const stronaDnia = (n) => ({
  id: `s_dzien_${n + 1}`, nazwa: DNI[n].replace(/^./, (z) => z.toUpperCase()), sekcja: 'sek_kal', seria: 'se_dni',
  obiekty: [
    tekst(`o_d${n}_data`, '{dzien} {miesiac} 2027', 12, 12, 124, 18, { fontFamily: 'Playfair Display', fontWeight: 'bold' }),
    tekst(`o_d${n}_tydz`, '{dzien_tygodnia} · {Miesiace.haslo}', 12, 22, 124, 9, { fill: '#6b6861' }),
    // Zdjęcie z danych: obraz-wzór wyznacza ramkę, kolumna „zdjecie” podaje nazwę pliku.
    { type: 'image', id: `o_d${n}_foto`, ...strefaZdjecia, width: 12, height: 8, scaleX: strefaZdjecia.width / 12, scaleY: strefaZdjecia.height / 8, zasob: 'z_styczen', src: 'zasob:z_styczen', pole: { kolumna: 'zdjecie', tryb: 'wypelnij' } },
    // Gwiazdka tylko w niedziele: widoczność zależna od pola.
    { type: 'ellipse', id: `o_d${n}_niedz`, left: 128, top: 13, rx: 4, ry: 4, fill: '#d62828', strokeWidth: 0, z_danych: { widok: { pole: 'niedziela', gdy: 'rowne', wartosc: 'tak' } } },
    ...Array.from({ length: 9 }, (_, j) => ({ type: 'line', id: `o_d${n}_l${j}`, left: 12, top: 110 + j * 9, x1: 0, y1: 0, x2: 124, y2: 0, width: 124, height: 0, stroke: '#cfccc3', strokeWidth: 0.25, strokeUniform: true })),
  ],
});

// Tabela jako element strony: grupa z opisem `tabela` i komórkami-tekstami (wierszami, od lewej).
const komorka = (id, text, gruba) => ({ type: 'textbox', id, text, width: 30, fontSize: pt(9), fontFamily: 'Inter', fontWeight: gruba ? 'bold' : 'normal', fill: '#1a1a1a', strokeWidth: 0, lineHeight: 1.15, wyrownanie_pion: 'srodek' });
const tabelaCelow = {
  type: 'group', id: 'o_cele', left: 12, top: 40, width: 124, height: 36,
  // Stały układ grupy: położenie komórek i linii liczy aplikacja (ulozTabele), nie biblioteka płótna.
  layoutManager: { type: 'layoutManager', strategy: 'fixed' }, subTargetCheck: false, interactive: false,
  tabela: { kolumny: [62, 31, 31], wiersze: [9, 9, 9, 9], naglowek: true, linia: { kolor: '#1a1a1a', grubosc: 0.25 }, tlo: { naglowek: '#dbe4fb', zebra: null } },
  objects: [
    ['Cel na rok', 'Termin', 'Zrobione'], ['Przeczytać 12 książek', 'grudzień', ''], ['Nauczyć się pływać', 'lipiec', ''], ['Wycieczka w góry', 'wrzesień', ''],
  ].flatMap((w, nw) => w.map((t, k) => komorka(`o_cel_${nw}_${k}`, t, nw === 0))),
};

const kalendarz = {
  nazwa: 'Kalendarz 2027 (przykład)',
  sekcje: [
    { id: 'sek_okl', nazwa: 'Okładka', wydruk: { format: 'A5', szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, marginesy: { gora: 10, dol: 10, wewnetrzny: 10, zewnetrzny: 10 }, znaki_ciecia: true }, uklad: 'pojedyncze', numeracja: { tryb: 'brak', od: 1 } },
    { id: 'sek_kal', nazwa: 'Kalendarz', wydruk: { format: 'A5', szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, marginesy: { gora: 10, dol: 14, wewnetrzny: 12, zewnetrzny: 12 }, znaki_ciecia: true }, uklad: 'pojedyncze', wzorce: ['wz_stopka'], numeracja: { tryb: 'od', od: 1 } },
  ],
  wzorce: [{
    id: 'wz_stopka', nazwa: 'Stopka z numerem', wydruk: { format: 'A5', szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, marginesy: { gora: 10, dol: 14, wewnetrzny: 12, zewnetrzny: 12 } },
    obiekty: [tekst('o_stopka', '{nr}', 12, 200, 124, 8, { textAlign: 'center', fill: '#6b6861' })],
  }],
  style: [
    { id: 'st_tytul', nazwa: 'Tytuł', fontFamily: 'Playfair Display', fontSize: pt(28), fontWeight: 'bold', fontStyle: 'normal', underline: false, linethrough: false, lineHeight: 1.1, charSpacing: 0, fill: '#1a1a1a', textAlign: 'left' },
  ],
  tabele: [
    { id: 't_dni', nazwa: 'Dni', kolumny: ['dzien', 'dzien_tygodnia', 'miesiac', 'zdjecie', 'niedziela'], wiersze: dni, listy: { niedziela: ['tak', 'nie'] } },
    { id: 't_mies', nazwa: 'Miesiace', kolumny: ['miesiac_nazwa', 'haslo'], wiersze: MIESIACE.map((m, i) => [m, hasla[i]]) },
  ],
  serie: [{ id: 'se_dni', nazwa: 'Dni roku', tabela: 't_dni', tryb: 'tabela', uklad: 'dlugi', ile: 1, dodatkowe: [{ tabela: 't_mies', co: 1, zmiana: 'miesiac' }], dopelnij: false, pilnuj_stron: false }],
  strony: [
    {
      id: 's_okladka', nazwa: 'Okładka', sekcja: 'sek_okl', wzorce: [],
      obiekty: [
        { type: 'image', id: 'o_okl_foto', left: -3, top: -3, width: 12, height: 8, scaleX: 154 / 12, scaleY: 216 / 8, zasob: 'z_okladka', src: 'zasob:z_okladka', bez_ostrzezen: true },
        tekst('o_okl_tytul', 'Kalendarz 2027', 12, 150, 124, 32, { fontFamily: 'Playfair Display', fontWeight: 'bold', fill: '#ffffff', styl: 'st_tytul' }),
      ],
    },
    ...DNI.map((_, n) => stronaDnia(n)),
    { id: 's_cele', nazwa: 'Cele', sekcja: 'sek_kal', obiekty: [tekst('o_cele_tytul', 'Cele na 2027', 12, 12, 124, 18, { fontWeight: 'bold' }), tabelaCelow] },
  ],
  zasoby,
};

fs.mkdirSync(KATALOG, { recursive: true });
for (const [nazwa, projekt] of [['minimalny', minimalny], ['kalendarz', kalendarz]]) {
  fs.writeFileSync(path.join(KATALOG, `${nazwa}.json`), `${JSON.stringify(projekt, null, 1)}\n`);
}
console.log('ai/przyklady: minimalny.json, kalendarz.json');
