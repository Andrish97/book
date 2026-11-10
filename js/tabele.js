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
    const tabele = skoroszyt.SheetNames.map((nazwa) => {
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

// Tabela → CSV ze średnikami (tak otwiera go polski Excel), z BOM dla polskich znaków.
export function doCsv(tabela) {
  const komorka = (v) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `﻿${[tabela.kolumny, ...tabela.wiersze].map((w) => w.map(komorka).join(';')).join('\r\n')}\r\n`;
}

// Zmienia nazwę kolumny w tekstach i obrazach-polach całego projektu:
// {stara} → {nowa}. Zwraca liczbę zmienionych elementów.
export function zmienNazwePola(projekt, stara, nowa) {
  let zmienione = 0;
  const wzor = new RegExp(`\\{\\s*${stara.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(:[^{}\\n]*)?\\}`, 'g');
  const popraw = (obiekty) => {
    for (const o of obiekty || []) {
      if (typeof o.text === 'string' && o.text.includes('{')) {
        // Nazwa tej samej długości nie przesuwa formatowania fragmentów; przy innej
        // długości formatowanie fragmentów tego tekstu zostaje na swoich miejscach.
        const nowy = o.text.replace(wzor, (_, zapis) => `{${nowa}${zapis || ''}}`);
        if (nowy !== o.text) { o.text = nowy; zmienione += 1; }
      }
      if (o.pole?.kolumna === stara) { o.pole.kolumna = nowa; zmienione += 1; }
      if (Array.isArray(o.objects)) popraw(o.objects);
    }
  };
  for (const s of projekt.strony) popraw(s.obiekty);
  for (const w of projekt.wzorce) popraw(w.obiekty);
  return zmienione;
}
