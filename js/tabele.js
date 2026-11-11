// Dane tabel: odczyt CSV, tekstu ze schowka i plików Excela, zapis do CSV.
// Wszystko jest tekstem (plan 4.3) – liczby i daty trafiają do tabeli tak, jak
// je widać w arkuszu.

import { biblioteka } from './biblioteki.js';
import { wygladArkuszy } from './arkusz-wyglad.js';

const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
// Arkusz pomocniczy z wartościami list rozwijanych (ukryty; przy imporcie pomijany, tak jak „Instrukcja”).
const ARKUSZ_LIST = 'Listy rozwijane';

// Biblioteka do plików Excela jest duża, więc wczytuje się dopiero przy imporcie.
const xlsx = () => biblioteka(XLSX_URL, 'XLSX', 'obsługi plików Excela');

// Separator kolumn: ten, który w pierwszych wierszach występuje najrówniej
// (poza cudzysłowami). Kandydaci: średnik, przecinek, tabulator.
export function wykryjSeparator(tekst) {
  const probka = tekst.slice(0, 20000);
  let najlepszy = ';';
  let wynik = 0;
  for (const sep of ['\t', ';', ',']) {
    // Liczba separatorów w każdym wierszu; nowa linia w cudzysłowie nie kończy wiersza.
    const liczby = [];
    let n = 0;
    let wCudzyslowie = false;
    let pusty = true;
    for (const z of probka) {
      if (z === '"') wCudzyslowie = !wCudzyslowie;
      else if (z === sep && !wCudzyslowie) n += 1;
      else if ((z === '\n' || z === '\r') && !wCudzyslowie) { if (!pusty) liczby.push(n); n = 0; pusty = true; continue; }
      pusty = false;
    }
    if (!pusty) liczby.push(n);
    if (!liczby.length) continue;
    const min = Math.min(...liczby.slice(0, 10));
    // Równa liczba separatorów w każdym wierszu jest mocniejszym sygnałem niż sama ich liczba.
    const ocena = min > 0 ? min * 10 + (liczby.every((x) => x === liczby[0]) ? 5 : 0) : 0;
    if (ocena > wynik) { wynik = ocena; najlepszy = sep; }
  }
  return najlepszy;
}

// Tekst rozdzielany separatorem → wiersze komórek. Obsługuje cudzysłowy,
// podwojone cudzysłowy w środku i nowe linie wewnątrz komórki.
export function parsujTekst(tekst, separator = wykryjSeparator(tekst)) {
  const wiersze = [];
  let wiersz = [];
  let komorka = '';
  let wCudzyslowie = false;
  const t = tekst.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i += 1) {
    const z = t[i];
    if (wCudzyslowie) {
      if (z === '"') { if (t[i + 1] === '"') { komorka += '"'; i += 1; } else wCudzyslowie = false; } else komorka += z;
    } else if (z === '"' && komorka === '') wCudzyslowie = true;
    else if (z === separator) { wiersz.push(komorka); komorka = ''; } else if (z === '\n' || z === '\r') {
      if (z === '\r' && t[i + 1] === '\n') i += 1;
      wiersz.push(komorka); komorka = '';
      wiersze.push(wiersz); wiersz = [];
    } else komorka += z;
  }
  if (komorka !== '' || wiersz.length) { wiersz.push(komorka); wiersze.push(wiersz); }
  return wiersze;
}

// Bajty pliku → tekst. Najpierw UTF-8; jeśli wychodzą znaki zastępcze, plik
// jest najpewniej zapisany przez Excela w Windows-1250.
export function dekoduj(bufor) {
  const utf = new TextDecoder('utf-8').decode(bufor);
  if (!utf.includes('�')) return utf;
  try { return new TextDecoder('windows-1250').decode(bufor); } catch { return utf; }
}

// Wiersze (pierwszy to nagłówki) → { kolumny, wiersze } bez pustych końcówek.
export function zWierszy(surowe) {
  const wiersze = surowe.map((w) => w.map((k) => String(k ?? '')));
  while (wiersze.length && wiersze.at(-1).every((k) => k.trim() === '')) wiersze.pop();
  if (!wiersze.length) return { kolumny: ['kolumna_1'], wiersze: [] };
  let szerokosc = Math.max(...wiersze.map((w) => w.length));
  while (szerokosc > 1 && wiersze.every((w) => (w[szerokosc - 1] ?? '').trim() === '')) szerokosc -= 1;
  const [naglowki, ...reszta] = wiersze.map((w) => Array.from({ length: szerokosc }, (_, i) => w[i] ?? ''));
  return { kolumny: naglowki.map((n) => n.trim()), wiersze: reszta };
}

const bezRozszerzenia = (nazwa) => nazwa.replace(/\.[a-z0-9]+$/i, '');

// Plik → lista tabel { nazwa, kolumny, wiersze }. CSV i TXT dają jedną tabelę,
// plik Excela – po jednej na każdy niepusty arkusz.
export async function wczytajPlik(plik) {
  const bufor = await plik.arrayBuffer();
  if (/\.(xlsx|xlsm|xls|ods)$/i.test(plik.name)) {
    const XLSX = await xlsx();
    const skoroszyt = XLSX.read(bufor, { type: 'array' });
    // Arkusze „Instrukcja” i „Listy rozwijane” z szablonu danych to objaśnienia i wartości list, nie dane.
    const pomocnicze = ['instrukcja', ARKUSZ_LIST.toLowerCase()];
    const arkusze = skoroszyt.SheetNames.filter((n) => skoroszyt.SheetNames.length === 1 || !pomocnicze.includes(n.trim().toLowerCase()));
    // Pogrubienia, kursywa i kolory liter komórek (tylko pliki .xlsx i .xlsm); błąd odczytu wyglądu nie psuje importu.
    let wyglad = new Map();
    if (/\.xls[xm]$/i.test(plik.name)) { try { wyglad = await wygladArkuszy(bufor); } catch { wyglad = new Map(); } }
    const tabele = arkusze.map((nazwa) => {
      const arkusz = skoroszyt.Sheets[nazwa];
      const dane = XLSX.utils.sheet_to_json(arkusz, { header: 1, raw: false, defval: '' });
      const tabela = { nazwa: skoroszyt.SheetNames.length > 1 ? nazwa : bezRozszerzenia(plik.name), ...zWierszy(dane) };
      const komorki = wyglad.get(nazwa);
      if (komorki && arkusz['!ref']) {
        // Wiersz 0 danych to nagłówki; dane zaczynają się w lewym górnym rogu zajętego obszaru arkusza.
        const { s: poczatek } = XLSX.utils.decode_range(arkusz['!ref']);
        const zArkusza = tabela.wiersze.map((_, w) => {
          const wiersz = tabela.kolumny.map((__, k) => komorki.get(`${poczatek.r + 1 + w},${poczatek.c + k}`) || null);
          return wiersz.some(Boolean) ? wiersz : null;
        });
        if (zArkusza.some(Boolean)) tabela.wyglad = zArkusza;
      }
      return tabela;
    }).filter((t) => t.wiersze.length || t.kolumny.some((k) => k && !/^kolumna_\d+$/.test(k)));
    if (!tabele.length) throw new Error('W pliku nie ma danych.');
    return tabele;
  }
  const tekst = dekoduj(bufor);
  if (!tekst.trim()) throw new Error('Plik jest pusty.');
  return [{ nazwa: bezRozszerzenia(plik.name), ...zWierszy(parsujTekst(tekst)) }];
}

const naXml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Litera kolumny arkusza: 0 → A, 25 → Z, 26 → AA.
function literaKolumny(k) {
  let n = k + 1;
  let wynik = '';
  while (n > 0) { n -= 1; wynik = String.fromCharCode(65 + (n % 26)) + wynik; n = Math.floor(n / 26); }
  return wynik;
}

// Wpis <dataValidations> arkusza. listy: [{ kolumna (numer od 0), wartosci, scisla, zrodlo? }]; `zrodlo` to zakres
// w arkuszu pomocniczym (gdy wartości nie da się wpisać wprost). Lista ścisła nie przyjmuje innych wartości;
// zwykła tylko podpowiada (komórka przyjmie też np. punkt w procentach albo nazwę pliku, którego jeszcze nie ma).
function xmlList(listy, wierszy) {
  const wpisy = listy.map((l) => {
    const zakres = `${literaKolumny(l.kolumna)}2:${literaKolumny(l.kolumna)}${Math.max(1000, wierszy + 200)}`;
    const formula = l.zrodlo || `"${l.wartosci.map((v) => v.replace(/"/g, '""')).join(',')}"`;
    const blad = l.scisla
      ? ' showErrorMessage="1" errorStyle="stop" errorTitle="Wartość spoza listy" error="Wybierz jedną z wartości z listy."'
      : ' showErrorMessage="0"';
    return `<dataValidation type="list" allowBlank="1" showInputMessage="1"${blad} sqref="${zakres}"><formula1>${naXml(formula)}</formula1></dataValidation>`;
  });
  return `<dataValidations count="${wpisy.length}">${wpisy.join('')}</dataValidations>`;
}

// Elementy arkusza, które w pliku muszą stać po sprawdzaniu poprawności (kolejność wymagana przez format).
const PO_LISTACH = ['hyperlinks', 'printOptions', 'pageMargins', 'pageSetup', 'headerFooter', 'rowBreaks', 'colBreaks', 'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags', 'drawing', 'legacyDrawing', 'legacyDrawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'];

// Biblioteka arkuszy nie zapisuje list rozwijanych, więc dopisujemy je do gotowego pliku (to archiwum ZIP z plikami XML).
async function dopiszListy(bajty, listyArkuszy) {
  const JSZip = await biblioteka(JSZIP_URL, 'JSZip', 'modułu ZIP');
  const zip = await JSZip.loadAsync(bajty);
  for (const [nr, { listy, wierszy }] of listyArkuszy) {
    const plik = zip.file(`xl/worksheets/sheet${nr + 1}.xml`);
    if (!plik) continue;
    const xml = await plik.async('string');
    const miejsca = PO_LISTACH.map((el) => xml.search(new RegExp(`<${el}[\\s/>]`))).filter((i) => i >= 0);
    const gdzie = miejsca.length ? Math.min(...miejsca) : xml.lastIndexOf('</worksheet>');
    if (gdzie < 0) continue;
    zip.file(`xl/worksheets/sheet${nr + 1}.xml`, xml.slice(0, gdzie) + xmlList(listy, wierszy) + xml.slice(gdzie));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

// Arkusze [{ nazwa, wiersze, listy? }] → plik Excela (wszystkie komórki jako tekst).
// listy: [{ kolumna (numer od 0), wartosci: [tekst], scisla? }] – lista rozwijana w komórkach tej kolumny (od drugiego wiersza).
export async function doXlsx(arkusze) {
  const XLSX = await xlsx();
  const skoroszyt = XLSX.utils.book_new();
  const uzyte = new Set();
  // Listy, których wartości nie da się wpisać wprost do reguły (przecinek w wartości, razem ponad 250 znaków),
  // biorą wartości z arkusza pomocniczego – każda lista to jedna jego kolumna.
  const pomocnicze = [];
  const listyArkuszy = new Map();
  arkusze.forEach((a, nr) => {
    const listy = (a.listy || []).map((l) => ({ ...l, wartosci: [...new Set(l.wartosci.map((v) => String(v ?? '').trim()).filter(Boolean))] })).filter((l) => l.wartosci.length && l.kolumna >= 0);
    for (const l of listy) {
      const wprost = l.wartosci.every((v) => !v.includes(',')) && l.wartosci.join(',').length <= 250;
      if (wprost) continue;
      pomocnicze.push(l.wartosci);
      const litera = literaKolumny(pomocnicze.length - 1);
      l.zrodlo = `'${ARKUSZ_LIST}'!$${litera}$1:$${litera}$${l.wartosci.length}`;
    }
    if (listy.length) listyArkuszy.set(nr, { listy, wierszy: a.wiersze.length });
  });
  if (pomocnicze.length) {
    const dlugosc = Math.max(...pomocnicze.map((p) => p.length));
    arkusze = [...arkusze, { nazwa: ARKUSZ_LIST, ukryty: true, wiersze: Array.from({ length: dlugosc }, (_, w) => pomocnicze.map((p) => p[w] ?? '')) }];
  }
  for (const a of arkusze) {
    const arkusz = XLSX.utils.aoa_to_sheet(a.wiersze.map((w) => w.map((v) => String(v ?? ''))));
    const kolumn = Math.max(1, ...a.wiersze.map((w) => w.length));
    arkusz['!cols'] = Array.from({ length: kolumn }, (_, k) => ({ wch: Math.min(60, Math.max(12, ...a.wiersze.map((w) => String(w[k] ?? '').length + 2))) }));
    // Excel: nazwa arkusza do 31 znaków, bez znaków \ / ? * [ ] :
    let nazwa = String(a.nazwa || 'Arkusz').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Arkusz';
    for (let n = 2; uzyte.has(nazwa.toLowerCase()); n += 1) nazwa = `${nazwa.slice(0, 28)} ${n}`;
    uzyte.add(nazwa.toLowerCase());
    XLSX.utils.book_append_sheet(skoroszyt, arkusz, nazwa);
  }
  if (arkusze.some((a) => a.ukryty)) skoroszyt.Workbook = { Sheets: arkusze.map((a) => ({ Hidden: a.ukryty ? 1 : 0 })) };
  let bajty = XLSX.write(skoroszyt, { bookType: 'xlsx', type: 'array' });
  if (listyArkuszy.size) bajty = await dopiszListy(bajty, listyArkuszy);
  return new Blob([bajty], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Tabela → CSV ze średnikami (tak otwiera go polski Excel), z BOM dla polskich znaków.
export function doCsv(tabela) {
  const komorka = (v) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `﻿${[tabela.kolumny, ...tabela.wiersze].map((w) => w.map(komorka).join(';')).join('\r\n')}\r\n`;
}

// Po zmianie nazwy tabeli poprawia pola z jej nazwą: {Stara.kolumna} → {Nowa.kolumna}.
export function zmienNazweTabeliWPolach(projekt, stara, nowa) {
  let zmienione = 0;
  const wzor = new RegExp(`\\{\\s*${stara.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`, 'gi');
  const popraw = (obiekty) => {
    for (const o of obiekty || []) {
      if (typeof o.text === 'string' && o.text.includes('{')) {
        const nowy = o.text.replace(wzor, `{${nowa}.`);
        if (nowy !== o.text) { o.text = nowy; zmienione += 1; }
      }
      if (Array.isArray(o.objects)) popraw(o.objects);
    }
  };
  for (const s of projekt.strony) popraw(s.obiekty);
  for (const w of projekt.wzorce) popraw(w.obiekty);
  return zmienione;
}

// Zmienia nazwę kolumny w tekstach i obrazach-polach całego projektu:
// {stara} → {nowa}. Zwraca liczbę zmienionych elementów.
// dotyczy(strona albo wzorzec) → false pomija tę stronę (np. gdy pole o tej nazwie bierze tam dane z innej tabeli).
export function zmienNazwePola(projekt, stara, nowa, dotyczy = () => true) {
  let zmienione = 0;
  const wzor = new RegExp(`\\{\\s*${stara.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(:[^{}\\n]*)?\\}`, 'g');
  const popraw = (obiekty) => {
    for (const o of obiekty || []) {
      if (typeof o.text === 'string' && o.text.includes('{') && !o.bez_pol) {
        // Nazwa tej samej długości nie przesuwa formatowania fragmentów; przy innej
        // długości formatowanie fragmentów tego tekstu zostaje na swoich miejscach.
        const nowy = o.text.replace(wzor, (_, zapis) => `{${nowa}${zapis || ''}}`);
        if (nowy !== o.text) { o.text = nowy; zmienione += 1; }
      }
      if (o.pole?.kolumna === stara) { o.pole.kolumna = nowa; zmienione += 1; }
      if (o.pole?.kadr_z === stara) { o.pole.kadr_z = nowa; zmienione += 1; }
      // Kolor, przesunięcie, rozmiar i widoczność zależne od tej kolumny.
      const z = o.z_danych;
      if (z?.kolor === stara) { z.kolor = nowa; zmienione += 1; }
      for (const os of ['x', 'y', 'widok', 'szer', 'wys']) if (z?.[os]?.pole === stara) { z[os].pole = nowa; zmienione += 1; }
      if (z?.obrot === stara) { z.obrot = nowa; zmienione += 1; }
      if (Array.isArray(o.objects)) popraw(o.objects);
    }
  };
  for (const s of projekt.strony) if (dotyczy(s)) popraw(s.obiekty);
  for (const w of projekt.wzorce) if (dotyczy(w)) popraw(w.obiekty);
  return zmienione;
}
