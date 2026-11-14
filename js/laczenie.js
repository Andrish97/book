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
// Strony i wzorce łączą się głębiej: gdy tę samą stronę zmieniono w obu miejscach, porównujemy osobno
// każdy jej element (po `id`) i każde ustawienie strony (nazwa, tło, prowadnice…). Element dodany,
// usunięty albo zmieniony tylko po jednej stronie przechodzi sam; pytanie dotyczy pojedynczego elementu
// zmienionego w obu miejscach. Tekst w połączonych ramkach (wątek) jest przy tym jedną całością: gdy
// obie strony zmieniły tę samą ramkę, wszystkie ramki tego tekstu – na wszystkich stronach – idą z jednej
// wersji, bo ich treść to kolejne kawałki jednego tekstu.
//
// Odciski liczymy z zapisu o ustalonej kolejności kluczy: baza przechowuje JSON po swojemu
// (inna kolejność pól), więc zwykłe porównanie tekstu widziałoby zmiany, których nie ma.

import { normalizuj } from './projekt.js';

// Części projektu będące listami elementów z identyfikatorem.
export const LISTY = ['strony', 'wzorce', 'tabele', 'sekcje', 'serie', 'style', 'czcionki'];
// Pola, które nie biorą udziału w łączeniu (identyfikator, znaczniki zapisu, pliki – te łączą się osobno).
const POMIJANE = new Set(['id', 'wersja_chmury', 'podstawa_chmury', 'wspolpraca_chmury', 'zmieniono', 'miniatura', 'zasoby', 'zasoby_usuniete', 'strony_osobno', ...LISTY]);
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

// Nagrobki usuniętych obrazów z obu stron razem.
const nagrobki = (a, b) => new Set([...(a?.zasoby_usuniete || []), ...(b?.zasoby_usuniete || [])]);

// Czy to urządzenie zna usunięte obrazy, o których konto jeszcze nie wie (wtedy po łączeniu trzeba wysłać).
export const noweNagrobki = (moj, konto) => {
  const naKoncie = new Set(konto?.zasoby_usuniete || []);
  return (moj?.zasoby_usuniete || []).some((id) => !naKoncie.has(id));
};

// Listy, których części (strony, wzorce) łączymy element po elemencie.
const Z_ELEMENTAMI = new Set(['strony', 'wzorce']);

// Odciski części strony albo wzorca: każdy element osobno (po id), ich kolejność, wątki tekstu, a pozostałe
// pola (nazwa, tło, prowadnice, przypisane wzorce…) każde osobno. null, gdy elementom nie da się zaufać
// (brak albo powtórzone id) – taka strona łączy się jako całość.
export function odciskiCzesci(e) {
  const obiekty = Array.isArray(e?.obiekty) ? e.obiekty : [];
  const kolejnosc = obiekty.map((o) => o?.id);
  if (kolejnosc.some((id) => typeof id !== 'string' || !id) || new Set(kolejnosc).size !== kolejnosc.length) return null;
  const elementy = {};
  const watki = {};
  for (const o of obiekty) {
    elementy[o.id] = odcisk(o);
    if (o.watek) watki[o.id] = o.watek;
  }
  const pola = {};
  for (const k of Object.keys(e)) if (k !== 'id' && k !== 'obiekty' && e[k] !== undefined) pola[k] = odcisk(e[k]);
  return { kolejnosc, elementy, watki, pola };
}

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
    if (Z_ELEMENTAMI.has(l)) listy[l].czesci = Object.fromEntries(lista.map((e) => [e.id, odciskiCzesci(e)]));
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
const NAZWY_POL = { nazwa: 'nazwa', tlo: 'tło', prowadnice: 'prowadnice', wzorce: 'przypisane wzorce', sekcja: 'sekcja', seria: 'seria', marginesy: 'marginesy' };

// Krótki opis elementu strony do pytania: rodzaj i to, po czym człowiek go pozna.
const skrot = (s, n = 28) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n)}…` : x; };
export function opisElementu(o) {
  if (!o) return 'element';
  if (o.tabela) return o.nazwa ? `tabela „${skrot(o.nazwa)}”` : 'tabela';
  const typ = String(o.type || '').toLowerCase();
  if (typeof o.text === 'string') return `tekst „${skrot(o.text) || 'pusty'}”`;
  const rodzaj = { image: 'obraz', rect: 'prostokąt', ellipse: 'elipsa', circle: 'elipsa', line: 'linia', polygon: 'wielokąt', path: 'rysunek', group: 'grupa' }[typ] || 'element';
  return o.nazwa ? `${rodzaj} „${skrot(o.nazwa)}”` : rodzaj;
}

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

// Trójstronne łączenie jednej strony albo wzorca, element po elemencie.
// m, k: strona z tego urządzenia i z konta; cm, ck: ich odciski części; cb: odciski części ze stanu uzgodnionego.
// Zwraca { elementy: [{ id, zrodlo, konflikt? }] (w kolejności po połączeniu), pola: { pole: { zrodlo, konflikt? } },
//          pytania: [{ klucz, lista, id, element?, pole?, nazwa, moje, konto }], zKonta: czy cokolwiek przyszło z konta }.
function planCzesci(l, id, m, k, cm, ck, cb, nazwa) {
  const pytania = [];
  const elementy = new Map();
  const mm = new Map(m.obiekty.map((o) => [o.id, o]));
  const kk = new Map(k.obiekty.map((o) => [o.id, o]));
  let zKonta = false;
  for (const eid of new Set([...cm.kolejnosc, ...ck.kolejnosc])) {
    const om = cm.elementy[eid];
    const ok = ck.elementy[eid];
    const ob = cb.elementy[eid];
    const klucz = `${l}:${id}#${eid}`;
    const pytaj = (moje, konto) => {
      elementy.set(eid, { zrodlo: 'moje', konflikt: klucz });
      pytania.push({ klucz, lista: l, id, element: eid, nazwa: `${nazwa}: ${opisElementu(mm.get(eid) || kk.get(eid))}`, moje, konto });
    };
    if (om && ok) {
      if (om === ok || ok === ob) elementy.set(eid, { zrodlo: 'moje' });
      else if (om === ob) { elementy.set(eid, { zrodlo: 'konto' }); zKonta = true; }
      else pytaj('zmieniony tutaj', 'zmieniony na koncie');
    } else if (om) {
      if (ob === undefined) elementy.set(eid, { zrodlo: 'moje' }); // dodany tutaj
      else if (om === ob) zKonta = true; // usunięty na koncie – znika
      else pytaj('zmieniony tutaj', 'usunięty na koncie');
    } else if (ob === undefined) { elementy.set(eid, { zrodlo: 'konto' }); zKonta = true; } // dodany na koncie
    else if (ok !== ob) pytaj('usunięty tutaj', 'zmieniony na koncie');
    // usunięty tutaj, na koncie bez zmian – zostaje usunięty
  }
  const kolejnosc = polaczKolejnosc(cm.kolejnosc, ck.kolejnosc, cb.kolejnosc || null, new Set(elementy.keys()));
  const mojaKolejnosc = cm.kolejnosc.filter((eid) => elementy.has(eid));
  if (kolejnosc.filter((eid) => mm.has(eid)).some((eid, i) => eid !== mojaKolejnosc[i])) zKonta = true;
  const pola = {};
  for (const pole of new Set([...Object.keys(cm.pola), ...Object.keys(ck.pola)])) {
    const om = cm.pola[pole];
    const ok = ck.pola[pole];
    const ob = cb.pola?.[pole];
    if (om === ok || ok === ob) pola[pole] = { zrodlo: 'moje' };
    else if (om === ob) { pola[pole] = { zrodlo: 'konto' }; zKonta = true; }
    else {
      const klucz = `${l}:${id}.${pole}`;
      pola[pole] = { zrodlo: 'moje', konflikt: klucz };
      pytania.push({ klucz, lista: l, id, pole, nazwa: `${nazwa}: ${NAZWY_POL[pole] || `ustawienie „${pole}”`}`, moje: 'zmienione tutaj', konto: 'zmienione na koncie' });
    }
  }
  return { elementy: kolejnosc.map((eid) => ({ id: eid, ...elementy.get(eid) })), pola, pytania, zKonta };
}

// Plan części, w którym wszystko idzie z jednej strony (`zrodlo`) – punkt wyjścia, gdy stronę zmieniono tylko
// po jednej stronie, a trzeba w niej podmienić ramki spornego tekstu.
function planJednolity(zrodlo, c) {
  // zKonta: false – strona wzięta w całości z konta jest już policzona przy przypisaniu źródła.
  return { elementy: c.kolejnosc.map((eid) => ({ id: eid, zrodlo })), pola: Object.fromEntries(Object.keys(c.pola).map((k) => [k, { zrodlo }])), pytania: [], zKonta: false };
}

// Tekst w połączonych ramkach: jeśli o którąkolwiek ramkę wątku trzeba zapytać, pytanie dotyczy całego tekstu,
// a wszystkie jego ramki (na wszystkich stronach listy) idą z wybranej wersji.
function uzgodnijWatki(l, moj, konto, wybor, hm, hk, konflikty) {
  const m = new Map((moj[l] || []).map((e) => [e.id, e]));
  const k = new Map((konto[l] || []).map((e) => [e.id, e]));
  const watekElementu = (id, eid) => m.get(id)?.obiekty.find((o) => o.id === eid)?.watek || k.get(id)?.obiekty.find((o) => o.id === eid)?.watek || null;
  const sporne = new Set();
  for (const [id, w] of wybor) for (const q of w.czesci?.pytania || []) { const T = q.element && watekElementu(id, q.element); if (T) sporne.add(T); }
  for (const T of sporne) {
    const klucz = `watek:${T}`;
    let poczatek = '';
    for (const [id, w] of wybor) {
      const sm = m.get(id);
      const sk = k.get(id);
      if (!sm || !sk) continue; // strona tylko po jednej stronie – rozstrzyga ją pytanie o całą stronę albo zostaje, jaka jest
      const ramki = new Set([...sm.obiekty, ...sk.obiekty].filter((o) => o.watek === T).map((o) => o.id));
      if (!ramki.size) continue;
      const pierwsza = sm.obiekty.filter((o) => o.watek === T).sort((a, b) => (a.watek_nr || 0) - (b.watek_nr || 0))[0];
      if (pierwsza && !(pierwsza.watek_nr > 0) && !poczatek) poczatek = pierwsza.text || '';
      if (w.konflikt !== undefined) continue; // pytanie o całą stronę
      const cm = hm.listy[l].czesci?.[id];
      const ck = hk.listy[l].czesci?.[id];
      if (!w.czesci) {
        if (hm.listy[l].elementy[id] === hk.listy[l].elementy[id] || !cm || !ck) continue; // strona taka sama po obu stronach
        w.czesci = planJednolity(w.zrodlo, w.zrodlo === 'konto' ? ck : cm);
        w.zrodlo = 'czesci';
      }
      const c = w.czesci;
      c.pytania = c.pytania.filter((q) => !ramki.has(q.element));
      const jest = new Set(c.elementy.map((e) => e.id));
      for (const e of c.elementy) if (ramki.has(e.id)) { e.zrodlo = 'moje'; e.konflikt = klucz; }
      // Ramka, której w planie nie ma (usunięta po jednej stronie): wraca, jeśli wybrana wersja ją ma.
      for (const eid of ramki) if (!jest.has(eid)) c.elementy.push({ id: eid, zrodlo: 'moje', konflikt: klucz });
    }
    konflikty.push({ klucz, watek: T, lista: l, nazwa: `Tekst w połączonych ramkach „${skrot(poczatek) || '…'}”`, moje: 'zmieniony tutaj', konto: 'zmieniony na koncie' });
  }
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
        else {
          // Zmieniona po obu stronach. Strona i wzorzec łączą się element po elemencie, jeśli znamy ich
          // części w stanie uzgodnionym (starszy zapis ich nie ma – wtedy pytanie o całą stronę, jak dawniej).
          const cm = hm.listy[l].czesci?.[id];
          const ck = hk.listy[l].czesci?.[id];
          const cb = b?.czesci?.[id];
          if (Z_ELEMENTAMI.has(l) && cm && ck && cb) wybor.set(id, { zrodlo: 'czesci', czesci: planCzesci(l, id, m.get(id), k.get(id), cm, ck, cb, nazwa) });
          else wybor.set(id, { zrodlo: 'moje', konflikt: pytaj({ lista: l, id, nazwa, moje: 'zmieniona tutaj', konto: 'zmieniona na koncie' }) });
        }
      } else if (om) {
        // Jest tylko tutaj: nowa – zostaje; usunięta na koncie – znika, chyba że tu ją zmieniono.
        if (ob === undefined) wybor.set(id, { zrodlo: 'moje' });
        else if (om === ob) wynik.zKonta += 1;
        else wybor.set(id, { zrodlo: 'moje', konflikt: pytaj({ lista: l, id, nazwa, moje: 'zmieniona tutaj', konto: 'usunięta na koncie' }) });
      } else if (ob === undefined) { wybor.set(id, { zrodlo: 'konto' }); wynik.zKonta += 1; } // nowa na koncie
      else if (ok !== ob) wybor.set(id, { zrodlo: 'moje', konflikt: pytaj({ lista: l, id, nazwa, moje: 'usunięta tutaj', konto: 'zmieniona na koncie' }) });
      // usunięta tutaj, na koncie bez zmian – zostaje usunięta
    }
    if (Z_ELEMENTAMI.has(l)) {
      uzgodnijWatki(l, moj, konto, wybor, hm, hk, konflikty);
      for (const w of wybor.values()) {
        if (!w.czesci) continue;
        konflikty.push(...w.czesci.pytania);
        if (w.czesci.zKonta) wynik.zKonta += 1;
      }
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
      if (w.czesci) {
        // Strona albo wzorzec składane z elementów obu wersji – w obiekcie z tego urządzenia.
        const em = m.get(w.id);
        const ek = k.get(w.id);
        const om = new Map(em.obiekty.map((o) => [o.id, o]));
        const ok = new Map(ek.obiekty.map((o) => [o.id, o]));
        const przed = kanon(em);
        em.obiekty = w.czesci.elementy.map((x) => (skad(x) === 'konto' ? ok : om).get(x.id)).filter(Boolean);
        for (const [pole, x] of Object.entries(w.czesci.pola)) {
          if (skad(x) !== 'konto') continue;
          if (ek[pole] === undefined) delete em[pole]; else em[pole] = ek[pole];
        }
        lista.push(em);
        if (kanon(em) !== przed) {
          zmienione[l].push(w.id);
          if (l !== 'strony') zmienione.inne = true;
        }
        continue;
      }
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
  // Obraz usunięty po którejkolwiek stronie (nagrobek w `zasoby_usuniete`) nie wraca.
  moj.zasoby = moj.zasoby || {};
  const usuniete = nagrobki(moj, konto);
  for (const [id, z] of Object.entries(konto.zasoby || {})) {
    if (usuniete.has(id)) continue;
    if (!moj.zasoby[id]) moj.zasoby[id] = z;
    else if (z.sciezka && !moj.zasoby[id].dataUrl) {
      // Brakująca ścieżka – z konta. Obraz od AI („ai:…”) przeniesiony już na konto przez inne urządzenie:
      // wygrywa prawdziwa ścieżka (plik ten sam, tylko w folderze konta), i odwrotnie – jej nie oddajemy.
      const moja = moj.zasoby[id].sciezka;
      if (!moja || (moja.startsWith('ai:') && !z.sciezka.startsWith('ai:'))) moj.zasoby[id].sciezka = z.sciezka;
    }
  }
  if (usuniete.size) {
    for (const id of usuniete) delete moj.zasoby[id];
    moj.zasoby_usuniete = [...usuniete];
  }
  return zmienione;
}
