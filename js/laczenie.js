// Łączenie zmian z dwóch urządzeń.
//
// Gdy na koncie jest nowsza wersja projektu niż ta, którą zna to urządzenie, nie pytamy od razu
// „moja czy tamta?”. Projekt składa się z części: stron, wzorców, tabel, sekcji, serii, stylów
// i kilku ustawień. Każdą część porównujemy osobno z trzema stanami:
//   – podstawa: to, co to urządzenie ostatnio wysłało na konto albo z niego wczytało (same odciski),
//   – moje: stan na tym urządzeniu,
//   – konto: stan zapisany przez inne urządzenie.
// Część zmieniona tylko po jednej stronie przechodzi sama. Pytanie zostaje tylko tam, gdzie tę samą
// część zmieniono po obu stronach inaczej – i dotyczy tej jednej części, nie całego projektu.
//
// Odciski liczymy z zapisu o ustalonej kolejności kluczy: baza przechowuje JSON po swojemu
// (inna kolejność pól), więc zwykłe porównanie tekstu widziałoby zmiany, których nie ma.

import { normalizuj } from './projekt.js';

// Części projektu będące listami elementów z identyfikatorem.
export const LISTY = ['strony', 'wzorce', 'tabele', 'sekcje', 'serie', 'style', 'czcionki'];
// Pola, które nie biorą udziału w łączeniu (identyfikator, znaczniki zapisu, pliki – te łączą się osobno).
const POMIJANE = new Set(['id', 'wersja_chmury', 'podstawa_chmury', 'zmieniono', 'miniatura', 'zasoby', 'strony_osobno', ...LISTY]);
// Ustawienia widoku (siatka, linijki) nie są warte pytania – zostają z tego urządzenia.
const MOJE_BEZ_PYTANIA = new Set(['widok']);

// Zapis wartości z kluczami w ustalonej kolejności, zgodny z JSON (pola undefined znikają).
export function kanon(x) {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null';
  if (Array.isArray(x)) return `[${x.map(kanon).join(',')}]`;
  const klucze = Object.keys(x).filter((k) => x[k] !== undefined && typeof x[k] !== 'function').sort();
  return `{${klucze.map((k) => `${JSON.stringify(k)}:${kanon(x[k])}`).join(',')}}`;
}

// Krótki odcisk treści (53 bity + długość) – do porównań, nie do zabezpieczeń.
export function odcisk(x) {
  const t = kanon(x);
  let a = 0xdeadbeef ^ t.length;
  let b = 0x41c6ce57 ^ t.length;
  for (let i = 0; i < t.length; i += 1) {
    const z = t.charCodeAt(i);
    a = Math.imul(a ^ z, 2654435761);
    b = Math.imul(b ^ z, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return `${(4294967296 * (2097151 & b) + (a >>> 0)).toString(36)}.${t.length.toString(36)}`;
}

const klucze = (p) => Object.keys(p || {}).filter((k) => !POMIJANE.has(k));

// Projekt w postaci do porównań: doprowadzony do tej samej, znormalizowanej formy co projekt świeżo wczytany
// z konta. Odciski podstawy, stanu z urządzenia i stanu z konta liczymy zawsze z niej. Tylko do czytania –
// strony i elementy są te same co w projekcie. Z plików zostają same identyfikatory (normalizuj() sprawdza
// nimi, czy czcionka ma swój plik); ich treść w porównaniach nie bierze udziału.
export function postacDoPorownan(projekt) {
  const zasoby = Object.fromEntries(Object.keys(projekt.zasoby || {}).map((id) => [id, {}]));
  return normalizuj({ ...projekt, zasoby });
}

// Odciski stanu uzgodnionego z kontem – zapamiętywane w projekcie jako `podstawa_chmury`.
export const podstawaProjektu = (projekt) => odciskiProjektu(postacDoPorownan(projekt));

// Czy projekt jest taki sam jak stan o podanych odciskach – z dokładnością do ustawień widoku (siatka,
// linijki), które każde urządzenie ma swoje. Tak aplikacja rozstrzyga, czy po dołączeniu zmian z konta
// ma jeszcze coś do wysłania; bez tego dwa urządzenia z różnym widokiem wysyłałyby projekt w kółko.
export function tenSamStan(projekt, odciski) {
  const bezMoich = (o) => ({ listy: o?.listy, reszta: Object.fromEntries(Object.entries(o?.reszta || {}).filter(([k]) => !MOJE_BEZ_PYTANIA.has(k))) });
  return kanon(bezMoich(podstawaProjektu(projekt))) === kanon(bezMoich(odciski));
}

// Odciski wszystkich części projektu: { listy: { strony: { kolejnosc: [id], elementy: { id: odcisk } }, … }, reszta: { klucz: odcisk } }.
export function odciskiProjektu(projekt) {
  const listy = {};
  for (const l of LISTY) {
    const elementy = {};
    const lista = Array.isArray(projekt?.[l]) ? projekt[l] : [];
    for (const e of lista) elementy[e.id] = odcisk(e);
    listy[l] = { kolejnosc: lista.map((e) => e.id), elementy };
  }
  const reszta = {};
  for (const k of klucze(projekt)) reszta[k] = odcisk(projekt[k]);
  return { listy, reszta };
}

const NAZWY = {
  strony: (e) => `Strona „${e.nazwa || 'bez nazwy'}”`,
  wzorce: (e) => `Wzorzec „${e.nazwa || 'bez nazwy'}”`,
  tabele: (e) => `Tabela danych „${e.nazwa || 'bez nazwy'}”`,
  sekcje: (e) => `Sekcja „${e.nazwa || 'bez nazwy'}”`,
  serie: (e) => `Seria „${e.nazwa || 'bez nazwy'}”`,
  style: (e) => `Styl tekstu „${e.nazwa || 'bez nazwy'}”`,
  czcionki: (e) => `Czcionka „${e.rodzina || 'bez nazwy'}”`,
};
const NAZWY_USTAWIEN = { nazwa: 'Nazwa projektu', udostepnienie: 'Udostępniony link' };

// Kolejność elementów po połączeniu: bierzemy kolejność tej strony, która ją zmieniła (gdy obie – z tego
// urządzenia), a elementy, których w niej nie ma, wstawiamy za ich poprzednikiem z drugiej kolejności.
function polaczKolejnosc(moja, konto, podstawa, zostaja) {
  const taSama = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const wspolne = (lista) => lista.filter((id) => zostaja.has(id));
  const mojaBezZmian = podstawa && taSama(wspolne(moja).filter((id) => podstawa.includes(id)), wspolne(podstawa).filter((id) => moja.includes(id)));
  const [glowna, druga] = mojaBezZmian ? [konto, moja] : [moja, konto];
  const wynik = wspolne(glowna);
  const jest = new Set(wynik);
  druga.forEach((id, i) => {
    if (!zostaja.has(id) || jest.has(id)) return;
    // Najbliższy poprzednik z drugiej kolejności, który już jest w wyniku.
    let gdzie = -1;
    for (let j = i - 1; j >= 0 && gdzie < 0; j -= 1) gdzie = wynik.indexOf(druga[j]);
    wynik.splice(gdzie + 1, 0, id);
    jest.add(id);
  });
  return wynik;
}

// Łączy stan z tego urządzenia (moj) ze stanem z konta (konto). Wszystkie trzy wejścia muszą być w tej samej,
// znormalizowanej postaci (postacDoPorownan). `podstawa` to odciski ostatnio uzgodnionego stanu (podstawaProjektu).
// Aplikacja łączy tylko wtedy, gdy ją zna; bez niej pyta o cały projekt (js/app/zapis.js). Sama funkcja przyjmie
// też null: wtedy każda różnica w istniejącej części jest pytaniem, a części obecne po jednej stronie zostają.
// Zwraca { listy: { strony: [{ id, zrodlo, konflikt? }], … }, reszta: { pole: { zrodlo, konflikt? } },
//          konflikty: [{ klucz, lista?, id?, pole?, nazwa, moje, konto }], zKonta: liczba części wziętych z konta }.
// `konflikt` to klucz pytania („strony:<id>”, „ustawienie:<pole>”) – ten sam przy ponownym liczeniu.
export function polaczProjekty(moj, konto, podstawa = null) {
  const hm = odciskiProjektu(moj);
  const hk = odciskiProjektu(konto);
  const konflikty = [];
  const wynik = { listy: {}, reszta: {}, konflikty, zKonta: 0 };
  const pytaj = (opis) => { const klucz = opis.lista ? `${opis.lista}:${opis.id}` : `ustawienie:${opis.pole}`; konflikty.push({ klucz, ...opis }); return klucz; };

  for (const l of LISTY) {
    const m = new Map((moj[l] || []).map((e) => [e.id, e]));
    const k = new Map((konto[l] || []).map((e) => [e.id, e]));
    const b = podstawa?.listy?.[l] || null;
    const wybor = new Map(); // id → { zrodlo, konflikt? }
    for (const id of new Set([...m.keys(), ...k.keys()])) {
      const om = hm.listy[l].elementy[id];
      const ok = hk.listy[l].elementy[id];
      const ob = b?.elementy?.[id];
      const nazwa = NAZWY[l](m.get(id) || k.get(id));
      if (om && ok) {
        if (om === ok) wybor.set(id, { zrodlo: 'moje' });
        else if (b && om === ob) { wybor.set(id, { zrodlo: 'konto' }); wynik.zKonta += 1; }
        else if (b && ok === ob) wybor.set(id, { zrodlo: 'moje' });
        else wybor.set(id, { zrodlo: 'moje', konflikt: pytaj({ lista: l, id, nazwa, moje: 'zmieniona tutaj', konto: 'zmieniona na koncie' }) });
      } else if (om) {
        // Jest tylko tutaj: nowa – zostaje; usunięta na koncie – znika, chyba że tu ją zmieniono.
        if (ob === undefined) wybor.set(id, { zrodlo: 'moje' });
        else if (om === ob) wynik.zKonta += 1;
        else wybor.set(id, { zrodlo: 'moje', konflikt: pytaj({ lista: l, id, nazwa, moje: 'zmieniona tutaj', konto: 'usunięta na koncie' }) });
      } else if (ob === undefined) { wybor.set(id, { zrodlo: 'konto' }); wynik.zKonta += 1; } // nowa na koncie
      else if (ok !== ob) wybor.set(id, { zrodlo: 'moje', konflikt: pytaj({ lista: l, id, nazwa, moje: 'usunięta tutaj', konto: 'zmieniona na koncie' }) });
      // usunięta tutaj, na koncie bez zmian – zostaje usunięta
    }
    const kolejnosc = polaczKolejnosc(hm.listy[l].kolejnosc, hk.listy[l].kolejnosc, b?.kolejnosc || null, new Set(wybor.keys()));
    wynik.listy[l] = kolejnosc.map((id) => ({ id, ...wybor.get(id) }));
    // Sama kolejność wzięta z konta też jest zmianą, którą to urządzenie musi pokazać.
    const mojaKolejnosc = hm.listy[l].kolejnosc.filter((id) => wybor.has(id));
    if (kolejnosc.filter((id) => m.has(id)).some((id, i) => id !== mojaKolejnosc[i])) wynik.zKonta += 1;
  }

  for (const klucz of new Set([...klucze(moj), ...klucze(konto)])) {
    const om = hm.reszta[klucz];
    const ok = hk.reszta[klucz];
    const ob = podstawa?.reszta?.[klucz];
    if (om === ok || MOJE_BEZ_PYTANIA.has(klucz)) wynik.reszta[klucz] = { zrodlo: 'moje' };
    else if (podstawa && om === ob) { wynik.reszta[klucz] = { zrodlo: 'konto' }; wynik.zKonta += 1; }
    else if (podstawa && ok === ob) wynik.reszta[klucz] = { zrodlo: 'moje' };
    else wynik.reszta[klucz] = { zrodlo: 'moje', konflikt: pytaj({ pole: klucz, nazwa: NAZWY_USTAWIEN[klucz] || `Ustawienie „${klucz}”`, moje: 'zmienione tutaj', konto: 'zmienione na koncie' }) };
  }
  return wynik;
}

// Składa połączony projekt w miejscu (w obiekcie `moj`, żeby reszta aplikacji trzymała ten sam projekt).
// wybory: Map(klucz pytania → 'moje' | 'konto'); pytanie bez odpowiedzi zostaje przy wersji z tego urządzenia.
// Zwraca, co przyszło z konta: { strony: [id], wzorce: [id] } – strony i wzorce o zmienionej treści,
// `ukladStron` – zmieniła się lista stron (kolejność, dodane, usunięte), `inne` – cokolwiek poza treścią
// stron (wzorce, tabele, sekcje, serie, style, czcionki, ustawienia).
export function zastosujPolaczenie(moj, konto, plan, wybory = new Map()) {
  const skad = (w) => (w.konflikt === undefined ? w.zrodlo : (wybory.get(w.konflikt) || 'moje'));
  const zmienione = { strony: [], wzorce: [], ukladStron: false, inne: false };
  for (const l of LISTY) {
    const m = new Map((moj[l] || []).map((e) => [e.id, e]));
    const k = new Map((konto[l] || []).map((e) => [e.id, e]));
    const przedtem = (moj[l] || []).map((e) => e.id);
    const lista = [];
    for (const w of plan.listy[l]) {
      const zKonta = skad(w) === 'konto';
      const e = zKonta ? k.get(w.id) : m.get(w.id);
      if (!e) continue; // wybrano stronę, po której element jest usunięty
      lista.push(e);
      if (zKonta && zmienione[l]) zmienione[l].push(w.id);
      if (zKonta && l !== 'strony') zmienione.inne = true;
    }
    moj[l] = lista;
    if (lista.length !== przedtem.length || lista.some((e, i) => e.id !== przedtem[i])) {
      if (l === 'strony') zmienione.ukladStron = true; else zmienione.inne = true;
    }
  }
  for (const [klucz, w] of Object.entries(plan.reszta)) {
    if (skad(w) !== 'konto') continue;
    zmienione.inne = true;
    if (konto[klucz] === undefined) delete moj[klucz]; else moj[klucz] = konto[klucz];
  }
  // Pliki (obrazy, czcionki): suma obu stron; opis z konta uzupełnia brakującą ścieżkę na koncie.
  moj.zasoby = moj.zasoby || {};
  for (const [id, z] of Object.entries(konto.zasoby || {})) {
    if (!moj.zasoby[id]) moj.zasoby[id] = z;
    else if (!moj.zasoby[id].sciezka && z.sciezka && !moj.zasoby[id].dataUrl) moj.zasoby[id].sciezka = z.sciezka;
  }
  return zmienione;
}
