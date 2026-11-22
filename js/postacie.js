// Postacie, miejsca i rekwizyty komiksu (#368, plan komiksu A9, uwaga F6): karty zapisane jako zwykłe tabele projektu – „Postacie”
// (imię, wygląd, znak rozpoznawczy, charakter, obraz, kolor dymka) i „Miejsca” (miejsce, opis, pora dnia, światło,
// obraz). Ręcznie wypełnia je okno „Postacie” (karty) albo okno Dane; AI czyta i wypełnia te same tabele (prompty
// do obrazów składa z opisu i obrazu wzorcowego). Tabele rozpoznawane po kolumnach, nie po nazwie.
// Moduł bez zależności od edytora.

const bez = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().trim();

export const RODZAJE_KART = {
  postacie: {
    nazwa: 'Postacie',
    kolumny: ['imię', 'wygląd', 'znak rozpoznawczy', 'charakter', 'obraz', 'kolor dymka'],
    pola: ['imie', 'wyglad', 'znak', 'charakter', 'obraz', 'kolor'],
    // warianty nazw kolumn (pl, en, uk) – po pierwszym rozpoznaje się tabelę
    warianty: [['imie', 'postac', 'name', 'character', "ім'я", 'імя', 'персонаж'], ['wyglad', 'appearance', 'look', 'вигляд'],
      ['znak rozpoznawczy', 'znak', 'trait', 'feature', 'прикмета'], ['charakter', 'personality', 'характер'], ['obraz', 'image', 'зображення'],
      ['kolor dymka', 'kolor', 'bubble colour', 'bubble color', 'colour', 'color', 'колір']],
  },
  miejsca: {
    nazwa: 'Miejsca',
    kolumny: ['miejsce', 'opis', 'pora dnia', 'światło', 'obraz'],
    pola: ['nazwa', 'opis', 'pora', 'swiatlo', 'obraz'],
    warianty: [['miejsce', 'place', 'location', 'місце'], ['opis', 'description', 'опис'], ['pora dnia', 'pora', 'time of day', 'time', 'час'],
      ['swiatlo', 'light', 'lighting', 'світло'], ['obraz', 'image', 'зображення']],
  },
  // Rekwizyty (uwaga F6): przedmioty, które wracają w wielu kadrach (plecak, latawiec, mapa) – opis i obraz wzorcowy,
  // „czyj” – postać, do której należy. W scenariuszu wybierane w kadrze; idą do opisu obrazu i jako wzorzec.
  rekwizyty: {
    nazwa: 'Rekwizyty',
    kolumny: ['rekwizyt', 'opis', 'czyj', 'obraz'],
    pola: ['nazwa', 'opis', 'czyj', 'obraz'],
    warianty: [['rekwizyt', 'przedmiot', 'prop', 'item', 'реквізит', 'предмет'], ['opis', 'description', 'опис'], ['czyj', 'wlasciciel', 'owner', 'чий', 'власник'], ['obraz', 'image', 'зображення']],
  },
};

// Indeksy kolumn tabeli dla pól karty (−1 – brak kolumny).
function indeksy(tabela, rodzaj) {
  const nazwy = (tabela?.kolumny || []).map(bez);
  return RODZAJE_KART[rodzaj].warianty.map((w) => nazwy.findIndex((n) => w.includes(n)));
}

// Tabela kart: pierwsza z kolumną nazwy i opisem (wygląd / opis).
export function tabelaKart(projekt, rodzaj) {
  return (projekt.tabele || []).find((tb) => { const k = indeksy(tb, rodzaj); return k[0] >= 0 && k[1] >= 0; }) || null;
}

// Tworzy tabelę kart, gdy jej nie ma; zwraca ją.
export function zapewnijTabeleKart(projekt, rodzaj, { nazwa = RODZAJE_KART[rodzaj].nazwa, noweId = () => `t_${rodzaj}_${Date.now().toString(36)}` } = {}) {
  let tb = tabelaKart(projekt, rodzaj);
  if (!tb) {
    tb = { id: noweId(), nazwa, kolumny: [...RODZAJE_KART[rodzaj].kolumny], wiersze: [] };
    projekt.tabele = [...(projekt.tabele || []), tb];
  }
  return tb;
}

// Karty z tabeli: [{ wiersz, imie|nazwa, … }] – wiersze bez nazwy pominięte.
export function karty(projekt, rodzaj) {
  const tb = tabelaKart(projekt, rodzaj);
  if (!tb) return [];
  const k = indeksy(tb, rodzaj);
  const pola = RODZAJE_KART[rodzaj].pola;
  return tb.wiersze.map((w, wiersz) => ({ wiersz, ...Object.fromEntries(pola.map((p, i) => [p, k[i] >= 0 ? String(w[k[i]] ?? '').trim() : ''])) }))
    .filter((c) => c[pola[0]]);
}

// Zapis karty (nowa: wiersz = null). Brakujące kolumny tabeli dochodzą na końcu. Zwraca numer wiersza.
export function zapiszKarte(projekt, rodzaj, karta, opcje = {}) {
  const tb = zapewnijTabeleKart(projekt, rodzaj, opcje);
  const R = RODZAJE_KART[rodzaj];
  let k = indeksy(tb, rodzaj);
  R.pola.forEach((p, i) => {
    if (k[i] < 0 && karta[p]) {
      tb.kolumny.push(R.kolumny[i]);
      tb.wiersze.forEach((w) => w.push(''));
    }
  });
  k = indeksy(tb, rodzaj);
  const nr = Number.isInteger(karta.wiersz) && tb.wiersze[karta.wiersz] ? karta.wiersz : tb.wiersze.push(tb.kolumny.map(() => '')) - 1;
  const w = tb.wiersze[nr];
  while (w.length < tb.kolumny.length) w.push('');
  R.pola.forEach((p, i) => { if (k[i] >= 0 && karta[p] !== undefined) w[k[i]] = String(karta[p] ?? '').trim(); });
  return nr;
}

export function usunKarte(projekt, rodzaj, wiersz) {
  const tb = tabelaKart(projekt, rodzaj);
  if (tb && tb.wiersze[wiersz]) tb.wiersze.splice(wiersz, 1);
}

// Kolor dymka postaci (po imieniu, bez wielkości liter i ogonków) – #rrggbb albo null.
export function kolorPostaci(projekt, imie) {
  const c = karty(projekt, 'postacie').find((x) => bez(x.imie) === bez(imie));
  return c && /^#[0-9a-f]{6}$/i.test(c.kolor) ? c.kolor.toLowerCase() : null;
}
