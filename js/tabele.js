// Dane tabel: odczyt CSV, tekstu ze schowka i plików Excela, zapis do CSV.
// Wszystko jest tekstem (plan 4.3) – liczby i daty trafiają do tabeli tak, jak
// je widać w arkuszu.

import { biblioteka } from './biblioteki.js';

const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

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
    // Arkusz „Instrukcja” z szablonu danych to objaśnienia, nie dane.
    const arkusze = skoroszyt.SheetNames.filter((n) => skoroszyt.SheetNames.length === 1 || n.trim().toLowerCase() !== 'instrukcja');
    const tabele = arkusze.map((nazwa) => {
      const dane = XLSX.utils.sheet_to_json(skoroszyt.Sheets[nazwa], { header: 1, raw: false, defval: '' });
      return { nazwa: skoroszyt.SheetNames.length > 1 ? nazwa : bezRozszerzenia(plik.name), ...zWierszy(dane) };
    }).filter((t) => t.wiersze.length || t.kolumny.some((k) => k && !/^kolumna_\d+$/.test(k)));
    if (!tabele.length) throw new Error('W pliku nie ma danych.');
    return tabele;
  }
  const tekst = dekoduj(bufor);
  if (!tekst.trim()) throw new Error('Plik jest pusty.');
  return [{ nazwa: bezRozszerzenia(plik.name), ...zWierszy(parsujTekst(tekst)) }];
}

// Arkusze [{ nazwa, wiersze }] → plik Excela (wszystkie komórki jako tekst).
export async function doXlsx(arkusze) {
  const XLSX = await xlsx();
  const skoroszyt = XLSX.utils.book_new();
  const uzyte = new Set();
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
  return new Blob([XLSX.write(skoroszyt, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
