// Pola w tekście: {nazwa} albo {nazwa:zapis}. Pole z tabeli bierze wartość
// z kolumny o tej nazwie; pole dokumentu (numer strony, nazwa sekcji, data…)
// wynika z samego projektu – jak pola w Wordzie. Czyste funkcje, bez Fabric.

// Podwójne klamry – {{ i }} – to zwykłe klamry: w edytorze widać podwójne, w podglądzie i PDF pojedyncze.
// Dzięki temu w jednym tekście mogą stać obok siebie pole i napis w klamrach.

const WZOR = /\{([^{}\n:]+)(?::([^{}\n]*))?\}/y;

// Rozbiera tekst od lewej: pola {nazwa} i podwójne klamry. Zwraca { pola, klamry }.
function rozbierz(tekst) {
  const pola = [];
  const klamry = [];
  if (typeof tekst !== 'string' || (!tekst.includes('{') && !tekst.includes('}}'))) return { pola, klamry };
  let i = 0;
  while (i < tekst.length) {
    const z = tekst[i];
    if (z === '{' && tekst[i + 1] === '{') { klamry.push({ start: i, koniec: i + 2, znak: '{' }); i += 2; continue; }
    if (z === '}' && tekst[i + 1] === '}') { klamry.push({ start: i, koniec: i + 2, znak: '}' }); i += 2; continue; }
    if (z === '{') {
      WZOR.lastIndex = i;
      const m = WZOR.exec(tekst);
      if (m) {
        pola.push({ start: i, koniec: i + m[0].length, nazwa: m[1].trim(), zapis: m[2] === undefined ? null : m[2].trim(), cale: m[0] });
        i += m[0].length;
        continue;
      }
    }
    i += 1;
  }
  return { pola, klamry };
}

// Pola dokumentu: nazwa → opis (lista do wstawiania i do instrukcji).
export const POLA_DOKUMENTU = [
  ['nr', 'Numer strony (według ustawień numeracji sekcji)'],
  ['nr_ogolny', 'Kolejny numer strony w całym projekcie, licząc od 1'],
  ['nr_w_sekcji', 'Numer strony w jej sekcji, licząc od 1'],
  ['liczba_stron', 'Liczba stron w całym projekcie (ostatni numer)'],
  ['liczba_stron_sekcji', 'Liczba stron w sekcji'],
  ['sekcja', 'Nazwa sekcji'],
  ['nr_sekcji', 'Numer sekcji'],
  ['strona', 'Nazwa strony'],
  ['projekt', 'Nazwa projektu'],
  ['seria', 'Nazwa serii, do której należy strona'],
  ['egzemplarz', 'Numer powielenia w serii (1, 2, 3…)'],
  ['liczba_egzemplarzy', 'Liczba powieleń serii'],
  ['data', 'Dzisiejsza data (dd.mm.rrrr)'],
  ['rok', 'Bieżący rok'],
  ['poczatek', 'Numer pierwszej strony sekcji o podanej nazwie, np. {poczatek:Notatki}'],
  ['koniec', 'Numer ostatniej strony sekcji o podanej nazwie, np. {koniec:Notatki}'],
  ['nr_strony', 'Numer strony o podanej nazwie, np. {nr_strony:Styczeń}'],
];

// Zapisy liczb po dwukropku: {nr:I}, {nr:000}, {egzemplarz:a}…
export const ZAPISY_LICZB = [
  ['', '1, 2, 3'],
  ['00', '01, 02, 03 (tyle cyfr, ile zer)'],
  ['I', 'I, II, III'],
  ['i', 'i, ii, iii'],
  ['A', 'A, B, C'],
  ['a', 'a, b, c'],
];

// Pola w tekście (bez podwójnych klamer – te są zwykłym tekstem).
export function znajdzPola(tekst) {
  return rozbierz(tekst).pola;
}

function rzymskie(n) {
  if (n <= 0 || n >= 4000) return String(n);
  const znaki = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let wynik = '';
  for (const [wartosc, znak] of znaki) while (n >= wartosc) { wynik += znak; n -= wartosc; }
  return wynik;
}

function litery(n) {
  if (n <= 0) return String(n);
  let wynik = '';
  while (n > 0) { n -= 1; wynik = String.fromCharCode(65 + (n % 26)) + wynik; n = Math.floor(n / 26); }
  return wynik;
}

// Liczba w wybranym zapisie; nieznany zapis zostawia zwykłe cyfry.
export function zapiszLiczbe(n, zapis) {
  if (!Number.isFinite(n)) return '';
  if (!zapis) return String(n);
  if (/^0+$/.test(zapis)) return String(n).padStart(zapis.length, '0');
  if (zapis === 'I') return rzymskie(n);
  if (zapis === 'i') return rzymskie(n).toLowerCase();
  if (zapis === 'A') return litery(n);
  if (zapis === 'a') return litery(n).toLowerCase();
  return String(n);
}

// Podstawia pola w tekście. wartosc(nazwa, zapis) zwraca tekst albo undefined
// (pole nieznane – zostaje bez zmian). Formatowanie fragmentów (styles w zapisie
// Fabric: [{ start, end, style }], numeracja znaków bez znaków nowej linii)
// przesuwa się razem z tekstem; wstawiona wartość dostaje wygląd pierwszego
// znaku pola.
export function podstawWTekscie(tekst, styles, wartosc) {
  const { pola: samePola, klamry } = rozbierz(tekst);
  if (!samePola.length && !klamry.length) return { text: tekst, styles };
  // Pola i podwójne klamry w kolejności występowania; podwójna klamra „ma wartość” – pojedynczą klamrę.
  const pola = [...samePola, ...klamry.map((k) => ({ ...k, cale: tekst.slice(k.start, k.koniec) }))].sort((a, b) => a.start - b.start);
  const maStyle = Array.isArray(styles) && styles.length > 0;
  // Styl każdego znaku (bez znaków nowej linii).
  const stylZnaku = [];
  if (maStyle) for (const s of styles) for (let i = s.start; i < s.end; i += 1) stylZnaku[i] = s.style;

  let wynik = '';
  const noweStyle = [];
  let pozycja = 0; // w tekście źródłowym
  let bezNl = 0; // indeks znaku źródłowego bez nowych linii
  const przepisz = (do_) => {
    for (; pozycja < do_; pozycja += 1) {
      const z = tekst[pozycja];
      wynik += z;
      if (z !== '\n') { noweStyle.push(stylZnaku[bezNl] || null); bezNl += 1; }
    }
  };
  for (const p of pola) {
    const v = p.znak || wartosc(p.nazwa, p.zapis);
    if (v === undefined || v === null) continue;
    przepisz(p.start);
    const styl = stylZnaku[bezNl] || null;
    const wstawka = String(v);
    wynik += wstawka;
    for (const z of wstawka) if (z !== '\n') noweStyle.push(styl);
    pozycja = p.koniec;
    bezNl += p.cale.length; // pole nie zawiera nowych linii
  }
  przepisz(tekst.length);
  if (!maStyle) return { text: wynik, styles };

  // Z powrotem do odcinków { start, end, style }.
  const odcinki = [];
  noweStyle.forEach((styl, i) => {
    if (!styl) return;
    const ostatni = odcinki.at(-1);
    if (ostatni && ostatni.end === i && ostatni.style === styl) ostatni.end += 1;
    else odcinki.push({ start: i, end: i + 1, style: styl });
  });
  return { text: wynik, styles: odcinki };
}

// ---------- Wygląd z danych: kolor i przesunięcie elementu ----------
//
// Element może mieć `z_danych: { kolor?: pole, x?: ust, y?: ust, obrot?: pole, widok?: war, szer?: wym, wys?: wym,
// kotwica? }`, gdzie pole to nazwa kolumny albo pola dokumentu, a ust = { pole, tryb, krok, co }:
//  - tryb 'mm':      wartość pola to przesunięcie w milimetrach,
//  - tryb 'pozycja': wartość to numer pozycji (1, 2, 3…); element przesuwa się o
//                    krok × (numer − 1), a przy `co` > 0 numeracja wraca do początku
//                    co tyle pozycji (np. 12 miesięcy w dwóch rzędach po 6).
// `obrot` – pole z kątem w stopniach, dodawanym do obrotu wzoru (obrót wokół środka elementu).
// `widok` = { pole, gdy: 'niepuste' | 'puste' | 'rowne', wartosc } – element jest na stronie tylko wtedy,
// gdy pole spełnia warunek (np. gwiazdka tylko w święta).
// `szer`, `wys` = { pole, tryb } – szerokość i wysokość elementu z pola z liczbą:
//  - tryb 'procent': wartość to procent rozmiaru wzoru (100 = bez zmian),
//  - tryb 'mm':      wartość to rozmiar w milimetrach.
// `kotwica` – punkt elementu, który przy zmianie rozmiaru zostaje na miejscu: brak = lewy górny róg,
// 'srodek' = środek, 'dol' = środek dolnej krawędzi (np. słupek wykresu rosnący w górę).
// Co się zmienia, zależy od elementu: tekst – szerokość ramki (i wysokość ramki o stałej wysokości), litery
// się nie rozciągają; obraz – ramka (obraz z pola wpisuje się w nią według swojego trybu, zwykły wypełnia ją
// z przycięciem nadmiaru); tabela – szerokości kolumn i najmniejsze wysokości wierszy; pozostałe elementy
// i grupy – skala. Wymiar zerowy (albo ujemny) chowa element.
// W edytorze element stoi w miejscu pozycji 1, ma rozmiar wzoru i jest zawsze widoczny; przesunięcie, kolor,
// obrót, rozmiar i widoczność widać na powielonych stronach – w podglądzie, na miniaturach i w PDF.

// Tekst z tabeli → kolor zrozumiały dla przeglądarki albo null. Przyjmuje #rgb, #rrggbb
// (także bez krzyżyka), rgb(…) i nazwy kolorów CSS.
export function kolorZWartosci(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return t.startsWith('#') ? t : `#${t}`;
  return typeof CSS !== 'undefined' && CSS.supports?.('color', t) ? t : null;
}

// Tekst z tabeli → liczba (przecinek albo kropka dziesiętna) albo null.
export function liczbaZWartosci(v) {
  const t = String(v ?? '').trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

// Przesunięcie w mm dla ustawienia { pole, tryb, krok, co } i funkcji wartości pól.
export function przesuniecieZDanych(ust, wartosc) {
  if (!ust?.pole) return 0;
  const v = liczbaZWartosci(wartosc(ust.pole, null));
  if (v === null) return 0;
  if (ust.tryb === 'mm') return v;
  const co = Math.round(ust.co) || 0;
  let pozycja = v - 1;
  if (co > 0) pozycja = ((pozycja % co) + co) % co;
  return pozycja * (Number(ust.krok) || 0);
}

function pokoloruj(o, kolor) {
  if (Array.isArray(o.objects)) return { ...o, objects: o.objects.map((x) => pokoloruj(x, kolor)) };
  if (o.type === 'image') return o;
  // Linia i kształt bez wypełnienia dostają kolor obrysu, reszta – wypełnienia.
  const obrys = (o.type === 'line' || !o.fill || o.fill === 'transparent') && o.stroke;
  return obrys ? { ...o, stroke: kolor } : { ...o, fill: kolor };
}

// Porównanie wartości z danych: bez wielkości liter i zbędnych spacji.
const jednolicie = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl');

// Czy element ma być na stronie, według warunku { pole, gdy, wartosc }. Nieznane pole liczy się jak puste.
export function widocznyZDanych(war, wartosc) {
  if (!war?.pole) return true;
  const v = jednolicie(wartosc(war.pole, null));
  if (war.gdy === 'puste') return v === '';
  if (war.gdy === 'rowne') return v === jednolicie(war.wartosc);
  return v !== '';
}

// Obrót elementu (zapis Fabric) o kąt w stopniach wokół jego środka. Położenie w zapisie to
// róg (albo inny punkt zaczepienia), więc razem z kątem trzeba je przeliczyć.
function obrocWokolSrodka(o, kat) {
  const a0 = o.angle || 0;
  const ile = { left: 0.5, center: 0, right: -0.5, top: 0.5, bottom: -0.5 };
  const fx = ile[o.originX || 'left'] ?? 0.5;
  const fy = ile[o.originY || 'top'] ?? 0.5;
  const sx = o.scaleX ?? 1;
  const sy = o.scaleY ?? 1;
  const kreska = o.strokeWidth ?? 1;
  const w = o.strokeUniform ? (o.width || 0) * sx + kreska : ((o.width || 0) + kreska) * sx;
  const h = o.strokeUniform ? (o.height || 0) * sy + kreska : ((o.height || 0) + kreska) * sy;
  const obroc = (x, y, stopnie) => { const r = (stopnie * Math.PI) / 180; return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]; };
  const [dx0, dy0] = obroc(fx * w, fy * h, a0);
  const [dx1, dy1] = obroc(fx * w, fy * h, a0 + kat);
  return { ...o, angle: a0 + kat, left: (o.left || 0) + dx0 - dx1, top: (o.top || 0) + dy0 - dy1 };
}

// O ile zmienia się wymiar: ustawienie { pole, tryb }, wymiar wzoru w mm → mnożnik (≥ 0) albo null (bez zmiany:
// brak ustawienia, pole puste albo bez liczby).
function mnoznikWymiaru(ust, wymiar, wartosc) {
  if (!ust?.pole) return null;
  const v = liczbaZWartosci(wartosc(ust.pole, null));
  if (v === null) return null;
  if (ust.tryb === 'mm') return wymiar > 0 ? Math.max(0, v) / wymiar : null;
  return Math.max(0, v) / 100;
}

const suma = (t) => t.reduce((s, x) => s + x, 0);

// Rozmiar elementu (zapis Fabric) według ustawień `szer`, `wys` i `kotwica`.
function zmienRozmiar(o, z, wartosc) {
  const sx = Math.abs(o.scaleX ?? 1) || 1;
  const sy = Math.abs(o.scaleY ?? 1) || 1;
  const tabela = o.tabela && Array.isArray(o.tabela.kolumny) && Array.isArray(o.tabela.wiersze) ? o.tabela : null;
  const tekst = o.type === 'textbox';
  const stalaRamka = tekst && o.ramka_h > 0;
  // Wymiary wzoru w mm (bez obrysu). Tekst bez stałej wysokości ramki ma wysokość z treści – tej nie zmieniamy.
  const w0 = tabela ? suma(tabela.kolumny) : (o.width || 0) * sx;
  const h0 = tabela ? suma(tabela.wiersze) : (tekst ? (stalaRamka ? o.ramka_h * sy : 0) : (o.height || 0) * sy);
  const fx = mnoznikWymiaru(z.szer, w0, wartosc);
  const fy = tekst && !stalaRamka ? null : mnoznikWymiaru(z.wys, h0, wartosc);
  if (fx === null && fy === null) return o;
  const w1 = w0 * (fx ?? 1);
  const h1 = h0 * (fy ?? 1);
  if ((fx !== null && w1 < 0.01) || (fy !== null && h1 < 0.01)) return { ...o, visible: false };
  let k = { ...o };
  if (tabela) {
    k.tabela = { ...tabela, kolumny: tabela.kolumny.map((x) => x * (fx ?? 1)), wiersze: tabela.wiersze.map((x) => x * (fy ?? 1)) };
  } else if (tekst) {
    if (fx !== null) k.width = o.width * fx;
    if (fy !== null) k.ramka_h = o.ramka_h * fy;
  } else if (o.type === 'image' && !(o.pole?.kolumna && wartosc(o.pole.kolumna, null) !== undefined) && o.width > 0 && o.height > 0) {
    // Zwykły obraz wypełnia nową ramkę bez zniekształcenia: wspólna skala, nadmiar przycięty po równo z obu stron.
    const skala = Math.max(w1 / o.width, h1 / o.height);
    const [szer, wys] = [w1 / skala, h1 / skala];
    k = { ...k, scaleX: skala, scaleY: skala, width: szer, height: wys, cropX: (o.cropX || 0) + (o.width - szer) / 2, cropY: (o.cropY || 0) + (o.height - wys) / 2 };
  } else {
    // Kształt, linia, grupa – skala; obraz z pola – ramka, w którą wpisze się podmieniony obraz.
    if (fx !== null) k.scaleX = (o.scaleX ?? 1) * fx;
    if (fy !== null) k.scaleY = (o.scaleY ?? 1) * fy;
  }
  // Punkt zaczepienia zostaje na miejscu: położenie w zapisie to (zwykle) lewy górny róg, więc trzeba je przesunąć.
  const [ax, ay] = { srodek: [0.5, 0.5], dol: [0.5, 1] }[z.kotwica] || [0, 0];
  const ox = { left: 0, center: 0.5, right: 1 }[o.originX || 'left'] ?? 0;
  const oy = { top: 0, center: 0.5, bottom: 1 }[o.originY || 'top'] ?? 0;
  const dx = (ox - ax) * (w1 - w0);
  const dy = (oy - ay) * (h1 - h0);
  if (dx || dy) {
    const r = ((o.angle || 0) * Math.PI) / 180;
    k.left = (o.left || 0) + dx * Math.cos(r) - dy * Math.sin(r);
    k.top = (o.top || 0) + dx * Math.sin(r) + dy * Math.cos(r);
  }
  return k;
}

function zDanych(o, wartosc) {
  const z = o.z_danych;
  let k = o;
  const kolor = z.kolor ? kolorZWartosci(wartosc(z.kolor, null)) : null;
  if (kolor) k = pokoloruj(k, kolor);
  if (z.szer || z.wys) k = zmienRozmiar(k, z, wartosc);
  const dx = przesuniecieZDanych(z.x, wartosc);
  const dy = przesuniecieZDanych(z.y, wartosc);
  if (dx || dy) k = { ...k, left: (k.left || 0) + dx, top: (k.top || 0) + dy };
  const kat = z.obrot ? liczbaZWartosci(wartosc(z.obrot, null)) : null;
  if (kat) k = obrocWokolSrodka(k, kat);
  if (!widocznyZDanych(z.widok, wartosc)) k = { ...k, visible: false };
  return k;
}

// Nazwy pól, od których zależy wygląd elementu (także kolumna z kadrem obrazu z danych).
export const polaZDanych = (o) => [o.z_danych?.kolor, o.z_danych?.x?.pole, o.z_danych?.y?.pole, o.z_danych?.obrot, o.z_danych?.widok?.pole, o.z_danych?.szer?.pole, o.z_danych?.wys?.pole, o.pole?.kolumna && o.pole.kadr_z].filter(Boolean);

// ---------- Kadr obrazu z danych ----------
//
// Obraz z kolumny, który wypełnia ramkę (`pole.tryb: 'wypelnij'`), jest przycinany. Która część zdjęcia
// zostaje, mówi punkt { x, y } w ułamkach szerokości i wysokości zdjęcia (0,5 i 0,5 = środek): kadr ustawia
// się tak, żeby ten punkt był w jego środku – na ile pozwalają brzegi zdjęcia. Punkt bierze się z ustawienia
// obrazu-wzoru (`pole.kadr`: 'gora' | 'dol' | 'lewa' | 'prawa') albo, osobno dla każdego wiersza, z kolumny
// tabeli (`pole.kadr_z`: nazwa kolumny).

// Wartości, które rozumie kolumna z kadrem (do opisu i list rozwijanych w szablonie danych).
export const WARTOSCI_KADRU = ['środek', 'góra', 'dół', 'lewa', 'prawa'];

const SLOWA_KADRU = {
  srodek: {}, srodkowa: {}, centrum: {}, center: {}, centre: {}, middle: {},
  gora: { y: 0 }, gorna: { y: 0 }, top: { y: 0 }, up: { y: 0 },
  dol: { y: 1 }, dolna: { y: 1 }, bottom: { y: 1 }, down: { y: 1 },
  lewa: { x: 0 }, lewo: { x: 0 }, lewy: { x: 0 }, left: { x: 0 },
  prawa: { x: 1 }, prawo: { x: 1 }, prawy: { x: 1 }, right: { x: 1 },
};

// Ustawienie obrazu-wzoru ('gora', 'dol', 'lewa', 'prawa' albo brak) → punkt kadru.
export const punktKadru = (kadr) => ({ x: 0.5, y: 0.5, ...SLOWA_KADRU[kadr] });

// Wartość z tabeli → punkt kadru { x, y } albo null (pusta albo niezrozumiała – obowiązuje ustawienie wzoru).
// Słowa: góra, dół, lewa, prawa, środek (także bez polskich znaków, po angielsku i po dwa: „góra lewa”);
// liczby: „30% 20%” – punkt zdjęcia od lewej i od góry (jedna liczba = sam poziom).
export function kadrZWartosci(v) {
  const t = String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  if (!t) return null;
  const czesci = t.split(/[\s;/|]+/).filter(Boolean);
  if (czesci.every((c) => SLOWA_KADRU[c])) return Object.assign({ x: 0.5, y: 0.5 }, ...czesci.map((c) => SLOWA_KADRU[c]));
  const liczby = czesci.map((c) => (/^\d+([.,]\d+)?%?$/.test(c) ? Number(c.replace('%', '').replace(',', '.')) : NaN));
  if (liczby.length > 2 || liczby.some((n) => !Number.isFinite(n))) return null;
  const ulamek = (n) => Math.min(1, Math.max(0, n / 100));
  return { x: ulamek(liczby[0]), y: liczby.length > 1 ? ulamek(liczby[1]) : 0.5 };
}

// Podstawia pola we wszystkich tekstach listy obiektów (także w grupach) i nadaje
// elementom kolor, rozmiar oraz przesunięcie zależne od danych.
export function podstawWObiektach(obiekty, wartosc) {
  return (obiekty || []).map((o) => {
    let k = o;
    // Tekst z przełącznikiem „klamry to zwykły tekst” (bez_pol) zostaje nietknięty.
    if (typeof o.text === 'string' && (o.text.includes('{') || o.text.includes('}}')) && !o.bez_pol) {
      const { text, styles } = podstawWTekscie(o.text, o.styles, wartosc);
      if (text !== o.text) k = { ...o, text, styles };
    }
    if (Array.isArray(o.objects)) k = { ...k, objects: podstawWObiektach(o.objects, wartosc) };
    if (o.z_danych) k = zDanych(k, wartosc);
    return k;
  });
}

// Nazwy pól użytych w obiektach (do ostrzeżeń i podpowiedzi).
export function polaWObiektach(obiekty, zbior = new Set()) {
  for (const o of obiekty || []) {
    if (!o.bez_pol) for (const p of znajdzPola(o.text)) zbior.add(p.nazwa);
    if (o.pole?.kolumna) zbior.add(o.pole.kolumna);
    for (const n of polaZDanych(o)) zbior.add(n);
    if (Array.isArray(o.objects)) polaWObiektach(o.objects, zbior);
  }
  return zbior;
}
