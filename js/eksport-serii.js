// Seria dla innych programów (#226): korespondencja seryjna poza Makietką – „szablon + dane”. Strony projektu
// raz (bez powielania), z polami z kolumn tabel zamienionymi na pola danego programu, i obok dane:
//   InDesign i Affinity Publisher (Data Merge): IDML z <<pole>> + dane.csv, kolumny obrazów jako @pole ze ścieżką
//     do pliku w folderze obrazy/;
//   Scribus (wtyczka ScribusGenerator): SLA z %VAR_pole% + dane.csv (obrazy – ścieżki);
//   Word i Publisher (korespondencja seryjna): DOCX z polami scalania (MERGEFIELD) + dane.xlsx i dane.csv.
// Pola dokumentu ({nr}, {sekcja}, {projekt}…) liczą się jak zwykle. Plik CZYTAJ-MNIE.txt mówi, co dalej.

import { rozwin, tabelaSerii, wierszPomijany } from './serie.js';
import { kolumnySerii } from './kontrola.js';
import { obrazZNazwy } from './nazwy-obrazow.js';
import { dataUrlZasobu } from './zasoby.js';
import { zPolamiSzablonu } from './zlozenie.js';

export const PROGRAMY_SERII = {
  indesign: { nazwa: 'InDesign / Affinity Publisher', plik: 'idml', znacznik: (n) => `<<${n}>>` },
  scribus: { nazwa: 'Scribus (ScribusGenerator)', plik: 'sla', znacznik: (n) => `%VAR_${n}%` },
  word: { nazwa: 'Word / Publisher (korespondencja seryjna)', plik: 'docx', znacznik: (n) => `«${n}»` },
};

// Kolumny serii projektu: tabela główna każdej serii z jej kolumnami (tekstowe i obrazowe).
export function daneSerii(projekt) {
  const wynik = [];
  for (const seria of projekt.serie || []) {
    const tabela = tabelaSerii(projekt, seria);
    if (!tabela || wynik.some((w) => w.tabela === tabela)) continue;
    const kol = kolumnySerii(projekt, seria);
    // Kolumny obrazów: obraz albo kształt-ramka z polem obrazu (pole.kolumna) na stronach i wzorcach.
    const obrazowe = new Set();
    const szukaj = (lista) => { for (const o of lista || []) { if (o?.pole?.kolumna && tabela.kolumny.includes(o.pole.kolumna)) obrazowe.add(o.pole.kolumna); if (o?.objects) szukaj(o.objects); } };
    for (const st of projekt.strony) szukaj(st.obiekty);
    for (const wz of projekt.wzorce || []) szukaj(wz.obiekty);
    wynik.push({ seria, tabela, obrazowe, uzyte: new Set([...kol.map((k) => k.nazwa), ...obrazowe]) });
  }
  return wynik;
}

// CSV (przecinek, cudzysłowy, CRLF) z BOM – Excel i programy do składu czytają polskie litery.
export function csv(wiersze) {
  const pole = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return `﻿${wiersze.map((w) => w.map(pole).join(',')).join('\r\n')}\r\n`;
}

const bezpieczna = (n) => String(n).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^A-Za-z0-9._-]+/g, '_');

// Wiersze danych tabeli dla programu: nagłówek (@ przed kolumnami obrazów) i wartości (obrazy → ścieżki w obrazy/).
async function wierszeDanych(projekt, d, obrazy) {
  const naglowek = d.tabela.kolumny.map((k) => (d.obrazowe.has(k) ? `@${k}` : k));
  const wiersze = [];
  for (const w of d.tabela.wiersze.filter((x) => !wierszPomijany(x))) {
    wiersze.push(await Promise.all(d.tabela.kolumny.map(async (k, i) => {
      const v = w[i] ?? '';
      if (!d.obrazowe.has(k) || !String(v).trim()) return v;
      const z = obrazZNazwy(projekt.zasoby, v);
      if (!z) return v;
      const nazwa = bezpieczna(projekt.zasoby[z.id]?.nazwa || `${z.id}.png`);
      if (!obrazy.has(nazwa)) obrazy.set(nazwa, z.id);
      return `obrazy/${nazwa}`;
    })));
  }
  return [naglowek, ...wiersze];
}

const OPIS = {
  indesign: (pola) => `Szablon i dane do korespondencji seryjnej w InDesignie albo Affinity Publisherze.

Pliki:
  szablon.idml  – strony projektu, każda raz; w miejscu pól stoją znaczniki ${pola}
  dane.csv      – dane (UTF-8); kolumny zaczynające się od @ to obrazy – ścieżki do plików w folderze obrazy/
  obrazy/       – obrazy z danych

InDesign: otwórz szablon.idml, Okno → Narzędzia → Scalanie danych → Wybierz źródło danych → dane.csv.
  Znaczniki <<pole>> to zwykły tekst: zaznacz każdy i kliknij pole o tej samej nazwie w panelu Scalanie danych
  (obrazy: zaznacz ramkę i kliknij pole z @). Potem „Utwórz scalony dokument”.
Affinity Publisher: otwórz szablon.idml, Okno → Scalanie danych (Data Merge Manager) → dodaj dane.csv,
  wstaw pola w miejsce znaczników <<pole>> i wygeneruj dokument.`,
  scribus: (pola) => `Szablon i dane dla Scribusa z wtyczką ScribusGenerator (korespondencja seryjna).

Pliki:
  szablon.sla – strony projektu, każda raz; w miejscu pól stoją zmienne ${pola}
  dane.csv    – dane (UTF-8, przecinek); kolumny obrazów zawierają ścieżki obrazy/…
  obrazy/     – obrazy z danych

W Scribusie: Skrypty → Wykonaj skrypt → ScribusGenerator, wskaż szablon.sla i dane.csv, separator „,”.
Zmienne %VAR_kolumna% w tekstach zastąpią się wartościami z kolejnych wierszy.`,
  word: (pola) => `Szablon i dane do korespondencji seryjnej w Wordzie (a także w Publisherze, który go jeszcze ma).

Pliki:
  szablon.docx – tekst stron projektu z polami scalania ${pola}
  dane.xlsx    – dane (arkusz „Dane”); to samo w dane.csv

Word: otwórz szablon.docx → Korespondencja → Wybierz adresatów → Użyj istniejącej listy → dane.xlsx →
  Zakończ i scal. Pola już są w tekście (MERGEFIELD).
Publisher: Korespondencja → Korespondencja seryjna → Użyj istniejącej listy → dane.xlsx, potem wstaw pola z listy.

Uwaga: Word nie ma układu stron Makietki (ramek w stałych miejscach) – szablon to tekst do dalszej obróbki.`,
};

// Pakiet ZIP „szablon + dane” dla programu. Zwraca { blob, nazwa, pola, wierszy }.
export async function pakietSerii(projekt, program, JSZip, { ciag = rozwin(projekt), XLSX = null } = {}) {
  const prog = PROGRAMY_SERII[program];
  if (!prog) throw new Error('Nieznany program.');
  const dane = daneSerii(projekt);
  if (!dane.length) throw new Error('Projekt nie ma serii z tabelą danych.');
  const tekstowe = new Set();
  const obrazowe = new Set();
  for (const d of dane) for (const k of d.tabela.kolumny) (d.obrazowe.has(k) ? obrazowe : tekstowe).add(k);
  const zip = new JSZip();
  // Strony szablonu: każda strona projektu raz (pierwszy egzemplarz).
  const egzemplarze = projekt.strony.map((s) => ciag.pierwszy.get(s.id)).filter((e) => e && !e.pusta);
  if (prog.plik === 'idml') {
    const { zapiszIdml } = await import('./idml.js');
    const { blob } = await zPolamiSzablonu({ tekstowe, obrazowe, znacznik: prog.znacznik }, () => zapiszIdml(projekt, JSZip, { ciag, egzemplarze }));
    zip.file('szablon.idml', blob);
  } else if (prog.plik === 'sla') {
    const { zapiszSla } = await import('./scribus.js');
    const { sla } = await zPolamiSzablonu({ tekstowe, obrazowe, znacznik: prog.znacznik }, () => zapiszSla(projekt, { ciag, egzemplarze }));
    zip.file('szablon.sla', sla);
  } else {
    const { zapiszDocx, akapityProjektu } = await import('./eksport-tekstu.js');
    zip.file('szablon.docx', await zapiszDocx(projekt, JSZip, akapityProjektu(projekt, ciag), { polaScalania: tekstowe }));
  }
  // Dane: tabela pierwszej serii jako dane.csv; kolejne tabele – dane-<nazwa>.csv.
  const obrazy = new Map();
  let wierszy = 0;
  for (const [i, d] of dane.entries()) {
    const w = await wierszeDanych(projekt, d, obrazy);
    wierszy += w.length - 1;
    const nazwa = i === 0 ? 'dane' : `dane-${bezpieczna(d.tabela.nazwa)}`;
    zip.file(`${nazwa}.csv`, csv(w));
    if (prog.plik === 'docx' && XLSX) {
      const ark = XLSX.utils.aoa_to_sheet(w);
      const sk = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(sk, ark, 'Dane');
      zip.file(`${nazwa}.xlsx`, XLSX.write(sk, { type: 'array', bookType: 'xlsx' }));
    }
  }
  // Oryginalny plik źródłowy tabeli (#227), gdy jest zapisany w projekcie.
  for (const d of dane) {
    const z = d.tabela.zrodlo?.zasob && projekt.zasoby?.[d.tabela.zrodlo.zasob];
    const url = z && await dataUrlZasobu(projekt, d.tabela.zrodlo.zasob);
    if (url) zip.file(`zrodlo/${bezpieczna(z.nazwa)}`, await (await fetch(url)).blob());
  }
  for (const [nazwa, id] of obrazy) {
    const url = await dataUrlZasobu(projekt, id);
    if (url) zip.file(`obrazy/${nazwa}`, await (await fetch(url)).blob());
  }
  const pola = [...tekstowe].filter((k) => dane.some((d) => d.uzyte.has(k)));
  zip.file('CZYTAJ-MNIE.txt', `${OPIS[program](pola.map(prog.znacznik).join(', ') || '(brak pól w tekście)')}\n\nZapisano w Makietce (makietka.app): ${projekt.nazwa}, ${wierszy} wierszy danych.\n`);
  return { blob: await zip.generateAsync({ type: 'blob' }), nazwa: `${projekt.nazwa || 'projekt'} – szablon i dane – ${program}.zip`, pola, wierszy, obrazow: obrazy.size };
}
