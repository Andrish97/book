// Kontrola danych przed drukiem i szablon danych serii (plan 5.1 i 5.2).
// Czyste funkcje: dostają projekt, niczego w nim nie zmieniają.

import { uwagiSkladanki } from './skladanka.js';
import { sprawdzPopup } from './makieta-3d.js';
import { opisWykonczenia } from './materialy.js';
import { polaWObiektach, WSZYSTKIE_POLA_DOKUMENTU, WARTOSCI_KADRU, podstawWTekscie, znajdzPola } from './pola.js';
import { normalizujKod, uwagiKodu } from './kody.js';
import { wzorceStrony } from './projekt.js';
import { blokiSerii, tabelaSerii, tabeleSerii, tabeleDodatkowe, polePoTabelach, bilansSerii, rozwin, wartosciPol, kolumnyZmiany, wierszPomijany, wierszyZDanymi, znacznikPomijania } from './serie.js';
import { bilansSkladki } from './okladka.js';
import { uwagiSekcjiSpecjalnych } from './sekcje-specjalne.js';
import { obrazZNazwy } from './nazwy-obrazow.js';
import { uwagiKolorowDruku } from './kolory-druku.js';
import { tacKoloru, silnikTac, LIMIT_TAC } from './separacje.js';
import { indeksKsiazki, uzywaKsiazki } from './ksiazka.js';
import { uwagiKomiksu } from './komiks-kontrola.js';
import { typSekcji } from './typ-sekcji.js';
import { uwagiElementow } from './kontrola-elementow.js';
import { t as tt } from './jezyk.js';

const DOKUMENTU = WSZYSTKIE_POLA_DOKUMENTU;

function obrazyZPol(obiekty, zbior = new Set()) {
  for (const o of obiekty || []) {
    if (o.type === 'image' && o.pole?.kolumna) zbior.add(o.pole.kolumna);
    if (Array.isArray(o.objects)) obrazyZPol(o.objects, zbior);
  }
  return zbior;
}

// Pola użyte na stronie i na jej wzorcach: { pola: Set, obrazy: Set }.
function polaStrony(projekt, strona, pamiec) {
  if (pamiec?.has(strona)) return pamiec.get(strona);
  const zrodla = [strona.obiekty, ...wzorceStrony(projekt, strona).map((w) => w.obiekty)];
  const wynik = { pola: new Set(), obrazy: new Set() };
  for (const obiekty of zrodla) { polaWObiektach(obiekty, wynik.pola); obrazyZPol(obiekty, wynik.obrazy); }
  pamiec?.set(strona, wynik);
  return wynik;
}

// Kolumny, których potrzebują strony serii: [{ nazwa, obraz, strony: [nazwy stron] }].
// Pola dokumentu ({nr}, {sekcja}…) nie są kolumnami, chyba że tabela już ma taką kolumnę.
// Pola brane z tabel dodatkowych serii należą do tamtych tabel – tu ich nie ma.
export function kolumnySerii(projekt, seria) {
  const tabela = tabelaSerii(projekt, seria);
  const dodatkowe = tabeleDodatkowe(projekt, seria).map((d) => d.tabela);
  const wynik = new Map();
  for (const blok of blokiSerii(projekt).filter((b) => b.seria.id === seria.id)) {
    for (const strona of blok.strony) {
      const { pola, obrazy } = polaStrony(projekt, strona);
      for (const nazwa of pola) {
        if (DOKUMENTU.has(nazwa) && !tabela?.kolumny.includes(nazwa)) continue;
        if (!tabela?.kolumny.includes(nazwa) && polePoTabelach(nazwa, [...(tabela ? [tabela] : []), ...dodatkowe])) continue;
        const wpis = wynik.get(nazwa) || { nazwa, obraz: false, strony: [] };
        wpis.obraz = wpis.obraz || obrazy.has(nazwa);
        if (!wpis.strony.includes(strona.nazwa)) wpis.strony.push(strona.nazwa);
        wynik.set(nazwa, wpis);
      }
    }
  }
  return [...wynik.values()];
}

// Do czego strony serii używają kolumn: nazwa → { tekst, obraz, kadr, kolor, liczba, warunki: Set }.
// (Z tego wynika opis kolumny w szablonie danych i jej lista rozwijana.)
export function roleKolumn(projekt, seria) {
  const role = new Map();
  const rola = (nazwa) => { if (!role.has(nazwa)) role.set(nazwa, { warunki: new Set() }); return role.get(nazwa); };
  const przejrzyj = (obiekty) => {
    for (const o of obiekty || []) {
      if (!o.bez_pol && typeof o.text === 'string') for (const m of o.text.matchAll(/\{([^{}\n:]+)(?::[^{}\n]*)?\}/g)) rola(m[1].trim()).tekst = true;
      if (o.type === 'image' && o.pole?.kolumna) { rola(o.pole.kolumna).obraz = true; if (o.pole.kadr_z) rola(o.pole.kadr_z).kadr = true; }
      const z = o.z_danych;
      if (z?.kolor) rola(z.kolor).kolor = true;
      for (const klucz of ['x', 'y', 'szer', 'wys']) if (z?.[klucz]?.pole) rola(z[klucz].pole).liczba = true;
      if (z?.obrot) rola(z.obrot).liczba = true;
      if (z?.widok?.pole) { const r = rola(z.widok.pole); r.warunek = true; if (z.widok.gdy === 'rowne' && String(z.widok.wartosc ?? '').trim()) r.warunki.add(String(z.widok.wartosc).trim()); }
      if (Array.isArray(o.objects)) przejrzyj(o.objects);
    }
  };
  for (const blok of blokiSerii(projekt).filter((b) => b.seria.id === seria.id)) {
    for (const strona of blok.strony) for (const obiekty of [strona.obiekty, ...wzorceStrony(projekt, strona).map((w) => w.obiekty)]) przejrzyj(obiekty);
  }
  return role;
}

// Nazwy plików obrazów wgranych do projektu (bez czcionek), alfabetycznie.
function nazwyObrazow(projekt) {
  const czcionki = new Set((projekt.czcionki || []).map((c) => c.id));
  return [...new Set(Object.entries(projekt.zasoby || {}).filter(([id, z]) => !czcionki.has(id) && z?.nazwa && !/^font\//.test(z.typ || '')).map(([, z]) => z.nazwa))].sort((a, b) => a.localeCompare(b, 'pl'));
}

// Lista rozwijana kolumny w szablonie danych: { wartosci, scisla } albo null.
//  - lista podana przy kolumnie w oknie danych – ścisła (inna wartość jest błędem),
//  - kolumna z kadrem obrazu, kolumna z nazwą pliku obrazu, kolumna z warunkiem „równe …” – podpowiedź.
function listaKolumny(projekt, tabela, nazwa, rola) {
  if (tabela?.listy?.[nazwa]?.length) return { wartosci: tabela.listy[nazwa], scisla: true };
  if (rola?.kadr) return { wartosci: WARTOSCI_KADRU, scisla: false };
  if (rola?.obraz) { const pliki = nazwyObrazow(projekt); return pliki.length ? { wartosci: pliki, scisla: false } : null; }
  if (rola?.warunki.size && !rola.tekst) return { wartosci: [...rola.warunki], scisla: false };
  return null;
}

// Wartości spoza listy dozwolonych wartości kolumny: [{ kolumna, wartosc, wiersze: [numery od 0] }].
export function spozaListy(tabela, kolumna) {
  const k = tabela.kolumny.indexOf(kolumna);
  const lista = tabela.listy?.[kolumna];
  if (k < 0 || !lista?.length) return [];
  const dozwolone = new Set(lista.map(tasama));
  const gdzie = new Map();
  tabela.wiersze.forEach((w, i) => {
    const v = (w[k] ?? '').trim();
    if (!v || dozwolone.has(tasama(v)) || wierszPomijany(w)) return; // wiersz pomijany nie niesie danych
    const wpis = gdzie.get(tasama(v)) || { kolumna, wartosc: v, wiersze: [] };
    wpis.wiersze.push(i);
    gdzie.set(tasama(v), wpis);
  });
  return [...gdzie.values()];
}

export function brakujaceKolumny(projekt, seria) {
  const tabela = tabelaSerii(projekt, seria);
  return kolumnySerii(projekt, seria).map((k) => k.nazwa).filter((n) => !tabela?.kolumny.includes(n));
}

// Szablon danych serii: arkusz z kolumnami dokładnie takimi, jakich wymagają
// strony (istniejące dane zostają), i arkusz z objaśnieniem kolumn.
export function szablonSerii(projekt, seria) {
  const tabela = tabelaSerii(projekt, seria);
  const potrzebne = kolumnySerii(projekt, seria);
  const kolumny = [...(tabela?.kolumny.filter((k) => !/^kolumna_\d+$/.test(k) || tabela.wiersze.some((w) => w[tabela.kolumny.indexOf(k)] !== '')) || [])];
  for (const k of potrzebne) if (!kolumny.includes(k.nazwa)) kolumny.push(k.nazwa);
  if (!kolumny.length) kolumny.push('kolumna_1');
  const wiersze = (tabela?.wiersze || []).map((w) => kolumny.map((k) => { const i = tabela.kolumny.indexOf(k); return i < 0 ? '' : w[i]; }));
  const blok = blokiSerii(projekt).find((b) => b.seria.id === seria.id);
  const n = blok?.strony.length || 1;
  const coWiersz = seria.uklad === 'dlugi' && seria.tryb === 'tabela'
    ? tt('kontrola.jedenWierszToJedna', { n })
    : tt('kontrola.jedenWierszToJedno', { n });
  const role = roleKolumn(projekt, seria);
  const listy = [];
  kolumny.forEach((k, i) => {
    const l = listaKolumny(projekt, tabela, k, role.get(k));
    // Ścisła lista w pierwszej kolumnie musi przepuścić znacznik wiersza pomijanego.
    if (l) listy.push({ kolumna: i, ...l, ...(i === 0 && l.scisla && seria.tryb === 'tabela' ? { wartosci: [...l.wartosci, znacznikPomijania()] } : {}) });
  });
  // Co wpisać w kolumnie – według tego, do czego strony jej używają (kolumna może mieć kilka zastosowań).
  const coWpisac = (k) => {
    const r = role.get(k) || { warunki: new Set() };
    return [
      r.tekst ? tt('kod.kontrola.tekstWMiejscu', { pole: `{${k}}` }) : '',
      r.obraz ? 'Nazwę pliku obrazu wgranego do projektu, np. zdjecie.jpg.' : '',
      r.kadr ? 'Którą część zdjęcia pokazać: góra, dół, lewa, prawa, środek – albo punkt zdjęcia w procentach od lewej i od góry, np. 30% 20%. Pusta komórka zostawia ustawienie wzoru.' : '',
      r.kolor ? 'Kolor: zapis #d1495b albo nazwę po angielsku, np. navy. Pusta komórka zostawia kolor wzoru.' : '',
      r.liczba ? 'Liczbę (przesunięcie, rozmiar albo kąt – według ustawień elementu „Z danych”).' : '',
      r.warunek ? tt('kod.kontrola.warunek', { wartosci: r.warunki.size ? tt('kod.kontrola.sprawdzana', { lista: [...r.warunki].join(', ') }) : '' }) : '',
    ].filter(Boolean).join(' ');
  };
  // Wiersz pomijany: jak go wpisać w arkuszu i co robi.
  const pomijanie = seria.tryb === 'tabela'
    ? tt('kod.kontrola.wierszPomijany', { znacznik: znacznikPomijania(), kolumna: kolumny[0], skutek: tt(seria.uklad === 'dlugi' ? 'strona dla tego wiersza nie powstanie, choć wiersz zajmie swoje miejsce w bloku' : 'całe powielenie bloku dla tego wiersza nie powstanie') })
    : '';
  const instrukcja = [
    ['Seria', seria.nazwa],
    [tt('kod.kontrola.jakWypelniacTytul'), tt('kod.kontrola.jakWypelniac', { coWiersz, pomijanie, listy: listy.length ? tt('kod.kontrola.listyRozwijane') : '' })],
    [],
    ['Kolumna', 'Gdzie jest użyta', 'Co wpisać'],
    ...kolumny.map((k, i) => {
      const p = potrzebne.find((x) => x.nazwa === k);
      const lista = listy.find((l) => l.kolumna === i);
      const uwagi = [
        !p ? tt('kod.kontrola.kolumnaNieUzyta') : (coWpisac(k) || tt('kod.kontrola.tekstWMiejscu', { pole: `{${k}}` })),
        lista?.scisla ? tt('kod.kontrola.tylkoZListy', { lista: lista.wartosci.join(', ') }) : (lista ? tt('kod.kontrola.listaPodpowiedzi') : ''),
        tabela?.unikalne?.includes(k) ? 'Wartości nie mogą się powtarzać.' : '',
      ].filter(Boolean).join(' ');
      return [k, p ? p.strony.join(', ') : '', uwagi];
    }),
  ];
  return { nazwa: tabela?.nazwa || seria.nazwa, kolumny, wiersze, instrukcja, listy };
}

// Ta sama wartość mimo innej wielkości liter i zbędnych spacji: „Praca”, „praca ” i „PRACA”.
export const tasama = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl');

// Powtórzone wartości w kolumnie tabeli: [{ wartosc, wiersze: [numery od 0] }].
// Wielkość liter i zbędne spacje nie mają znaczenia; `wartosc` to pierwszy napotkany zapis.
export function powtorzenia(tabela, kolumna) {
  const k = tabela.kolumny.indexOf(kolumna);
  if (k < 0) return [];
  const gdzie = new Map();
  tabela.wiersze.forEach((w, i) => {
    const v = (w[k] ?? '').trim();
    if (!v || wierszPomijany(w)) return; // wiersz pomijany nie niesie danych
    const wpis = gdzie.get(tasama(v)) || { wartosc: v, wiersze: [] };
    wpis.wiersze.push(i);
    gdzie.set(tasama(v), wpis);
  });
  return [...gdzie.values()].filter((p) => p.wiersze.length > 1);
}

// Kiedy tabela dodatkowa przechodzi do następnego wiersza – słowami, do komunikatów.
export const opisKroku = (d) => {
  const kolumny = kolumnyZmiany(d.zmiana);
  if (kolumny.length > 1) return tt('kontrola.nowyWierszGdyZmieni', { join: kolumny.map((x) => `„${x}”`).join(' albo ') });
  return kolumny.length
    ? tt('kontrola.nowyWierszGdyZmieni2', { x: kolumny[0] })
    : tt('kontrola.nowyWierszCo', { co: d.co });
};

const lista = (numery, ile = 6) => {
  const n = [...new Set(numery)].sort((a, b) => a - b);
  return n.length > ile ? tt('kontrola.i', { join: n.slice(0, ile).join(', '), x: n.length - ile }) : n.join(', ').replace(/, (\d+)$/, ' i $1');
};

// Uwagi do całego projektu przed drukiem: [{ rodzaj, opis, strony: [numery w wydruku] }].
// Nie blokują eksportu – to lista rzeczy do sprawdzenia.
export function sprawdzProjekt(projekt, ciag = rozwin(projekt)) {
  const uwagi = [];
  // Składki (#120): liczba stron sekcji ma być wielokrotnością składki; okładka zeszytowa – stron po 4.
  for (const sekcja of projekt.sekcje) {
    const b = bilansSkladki(sekcja, ciag);
    if (b?.brakuje) {
      uwagi.push({ rodzaj: 'skladka', idSekcji: sekcja.id, opis: tt('kontrola.sekcjaMaDoPelnej', { nazwa: sekcja.nazwa, stron: b.stron, skladka: b.skladka, brakuje: b.brakuje }) });
    }
    // Okleina (#214): płótno, skóra… – nadruk okładki się nie drukuje, drukarnia potrzebuje płyt złocenia/tłoczenia.
    const wyk = sekcja.okladka?.wykonczenie;
    if (wyk && wyk.material !== 'druk') {
      uwagi.push({ rodzaj: 'material', idSekcji: sekcja.id, opis: tt('kontrola.okladkaJestZOkleiny', { nazwa: sekcja.nazwa, opisWykonczenia: opisWykonczenia(wyk) }) });
    }
    if (wyk?.rogi_mm > 0) uwagi.push({ rodzaj: 'material', idSekcji: sekcja.id, opis: tt('kontrola.okladkaMaZaokragloneRogi', { nazwa: sekcja.nazwa, rogi_mm: wyk.rogi_mm }) });
    const okl = sekcja.okladka?.wynik;
    if (okl && sekcja.okladka.oprawa === 'zeszytowa' && okl.stron % 4) {
      uwagi.push({ rodzaj: 'skladka', idSekcji: sekcja.id, opis: tt('kontrola.oprawaZeszytowaSrodekMa', { stron: okl.stron }) });
    }
  }
  // Podłoże (#213): biel nie jest farbą – na kolorowym papierze i folii białe elementy wyjdą w kolorze podłoża;
  // na folii farby prześwitują bez białego poddruku.
  const bialy = (k) => typeof k === 'string' && /^(#fff(fff)?|white|rgba?\(255,\s*255,\s*255(,\s*1)?\))$/i.test(k.trim());
  const biale = (obiekty, wynik = []) => {
    for (const o of obiekty || []) {
      if (!o || o.visible === false || o.uszlachetnienie === 'bialy') continue;
      if (Array.isArray(o.objects)) biale(o.objects, wynik);
      else if (bialy(o.fill) || (o.strokeWidth > 0 && bialy(o.stroke))) wynik.push(o);
    }
    return wynik;
  };
  for (const sekcja of projekt.sekcje) {
    const r = sekcja.podloze?.rodzaj;
    if (r !== 'kolor' && r !== 'folia') continue;
    const egz = ciag.egzemplarze.filter((e) => e.sekcja.id === sekcja.id && !e.pusta);
    const zBiela = egz.filter((e) => biale(e.strona.obiekty).length || (e.strona.tlo && bialy(e.strona.tlo))).map((e) => e.nr ?? e.indeks + 1);
    const podloze = r === 'folia' ? 'przezroczystej folii' : 'kolorowym papierze';
    if (zBiela.length) uwagi.push({ rodzaj: 'podloze', idSekcji: sekcja.id, strony: zBiela, opis: tt('kontrola.sekcjaJestNaBiale', { nazwa: sekcja.nazwa, podloze, x: r === 'folia' ? tt('kontrola.przezroczyste') : tt('kontrola.wKolorzePapieru'), size: new Set(zBiela).size, lista: lista(zBiela) }) });
    const zPoddrukiem = egz.some((e) => JSON.stringify(e.strona.obiekty).includes('"uszlachetnienie":"bialy"'));
    if (r === 'folia' && !zPoddrukiem) uwagi.push({ rodzaj: 'podloze', idSekcji: sekcja.id, strony: [], opis: tt('kontrola.sekcjaJestNaPrzezroczystej', { nazwa: sekcja.nazwa }) });
  }
  // Linie wykrojnika (#218): czy da się wyciąć i złożyć – cięcie z zamkniętego kształtu, big i klej na wykroju.
  const techniczne = (obiekty, wynik = [], zGrupy = null) => {
    for (const o of obiekty || []) {
      const id = ['ciecie', 'big', 'perforacja', 'klej'].includes(o?.uszlachetnienie) ? o.uszlachetnienie : zGrupy;
      if (Array.isArray(o?.objects) && o.objects.length) techniczne(o.objects, wynik, id);
      else if (id && o) wynik.push({ o, id });
    }
    return wynik;
  };
  const ramka = (o) => ({ x1: o.left || 0, y1: o.top || 0, x2: (o.left || 0) + (o.width || 0) * Math.abs(o.scaleX ?? 1), y2: (o.top || 0) + (o.height || 0) * Math.abs(o.scaleY ?? 1) });
  const otwarta = (o) => o.type === 'line' || o.type === 'polyline' || (o.type === 'path' && !/[zZ]\s*$/.test(JSON.stringify(o.path || '').replace(/[\]"]+$/, '')));
  const wykNaStronach = { otwarte: [], bezCiecia: [], poza: [] };
  for (const e of ciag.egzemplarze) {
    if (e.pusta) continue;
    const t = techniczne(e.strona.obiekty);
    if (!t.length) continue;
    const nr = e.nr ?? e.indeks + 1;
    const ciecia = t.filter((x) => x.id === 'ciecie');
    if (ciecia.some((x) => otwarta(x.o))) wykNaStronach.otwarte.push(nr);
    const wykrojnikSekcji = e.sekcja.specjalna?.rodzaj === 'wykrojnik';
    if (!ciecia.length && !wykrojnikSekcji && t.some((x) => x.id === 'big' || x.id === 'klej')) wykNaStronach.bezCiecia.push(nr);
    if (ciecia.length) {
      const r = ciecia.map((x) => ramka(x.o));
      const x1 = Math.min(...r.map((q) => q.x1)) - 0.5; const y1 = Math.min(...r.map((q) => q.y1)) - 0.5;
      const x2 = Math.max(...r.map((q) => q.x2)) + 0.5; const y2 = Math.max(...r.map((q) => q.y2)) + 0.5;
      if (t.some((x) => (x.id === 'big' || x.id === 'klej') && (() => { const q = ramka(x.o); return q.x2 < x1 || q.x1 > x2 || q.y2 < y1 || q.y1 > y2; })())) wykNaStronach.poza.push(nr);
    }
  }
  if (wykNaStronach.otwarte.length) uwagi.push({ rodzaj: 'wykrojnik', strony: wykNaStronach.otwarte, opis: tt('kontrola.liniaCieciaZOtwartej', { size: new Set(wykNaStronach.otwarte).size, lista: lista(wykNaStronach.otwarte) }) });
  if (wykNaStronach.bezCiecia.length) uwagi.push({ rodzaj: 'wykrojnik', strony: wykNaStronach.bezCiecia, opis: tt('kontrola.saLinieZgieciaAlbo', { size: new Set(wykNaStronach.bezCiecia).size, lista: lista(wykNaStronach.bezCiecia) }) });
  if (wykNaStronach.poza.length) uwagi.push({ rodzaj: 'wykrojnik', strony: wykNaStronach.poza, opis: tt('kontrola.liniaZgieciaAlboMiejsce', { size: new Set(wykNaStronach.poza).size, lista: lista(wykNaStronach.poza) }) });
  // Sekcje specjalne (#177): tekst na zgięciu, elementy poza wykrojnikiem, ulotka z nadmiarowymi stronami.
  uwagi.push(...uwagiSekcjiSpecjalnych(projekt, ciag));
  // Kody QR i EAN (#128): za mały moduł, za wąski EAN, za jasny kod, zła treść – także po podstawieniu danych.
  const kodyUwagi = new Map(); // opis → strony
  const kody = (obiekty, wynik = []) => {
    for (const o of obiekty || []) {
      if (o?.kod) wynik.push(o);
      else if (Array.isArray(o?.objects)) kody(o.objects, wynik);
    }
    return wynik;
  };
  for (const egz of ciag.egzemplarze) {
    const lista = kody(egz.strona.obiekty).filter((o) => o.visible !== false);
    if (!lista.length) continue;
    const wartosc = lista.some((o) => String(o.kod.tresc || '').includes('{')) ? wartosciPol(projekt, egz, ciag) : null;
    for (const o of lista) {
      const k = normalizujKod(o.kod);
      if (wartosc && k.tresc.includes('{')) k.tresc = podstawWTekscie(k.tresc, null, wartosc).text;
      for (const u of uwagiKodu(k)) kodyUwagi.set(u, [...(kodyUwagi.get(u) || []), egz.indeks + 1]);
    }
  }
  for (const [opis, strony] of kodyUwagi) uwagi.push({ rodzaj: 'kod', strony, opis: tt('kontrola.tekst', { opis, size: new Set(strony).size, join: [...new Set(strony)].join(', ') }) });
  // Kolory do druku (#127): kolory dodatkowe, uszlachetnienia, kolory spoza trybu kolorów projektu.
  const pierwszyNr = new Map();
  for (const e of ciag.egzemplarze) if (!pierwszyNr.has(e.strona.id)) pierwszyNr.set(e.strona.id, e.indeks + 1);
  uwagi.push(...uwagiKolorowDruku(projekt, { numerStrony: (id) => pierwszyNr.get(id) || null }));
  // Składanki (#234): części poza arkuszem, numery bez pary, pary o różnych długościach, za wąskie szczeliny.
  for (const sekcja of (projekt.sekcje || []).filter((x) => x.specjalna?.rodzaj === 'skladanka')) {
    const sp = sekcja.specjalna;
    const arkusze = projekt.strony.filter((st) => st.sekcja === sekcja.id).map((st) => ({
      strona: st, nr: pierwszyNr.get(st.id) || null, w: sekcja.wydruk.szerokosc_mm, h: sekcja.wydruk.wysokosc_mm, margines: sp.druk === 'domowy' ? sp.margines_mm || 0 : 0, grubosc: sp.grubosc_mm || 0,
    }));
    uwagi.push(...uwagiSkladanki(arkusze).map(({ nazwa, ...u }) => u));
    uwagi.push(...uwagiPopupu(arkusze));
  }
  // Komiks (#370): mały tekst w dymku, dymek poza stroną albo na dwóch kadrach, ogonek poza kadrami, puste kadry.
  for (const sekcja of (projekt.sekcje || []).filter((x) => typSekcji(x) === 'komiks')) {
    const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: spad = 0 } = sekcja.wydruk;
    uwagi.push(...uwagiKomiksu(projekt.strony.filter((st) => st.sekcja === sekcja.id).map((st) => ({ strona: st, nr: pierwszyNr.get(st.id) || null, w, h, spad }))));
  }
  // Elementy uproszczone przy odczycie z innego programu (#232) – do przejrzenia; „Sprawdzone” zdejmuje oznaczenie.
  const zImportu = (lista, strona, wzorzec) => {
    for (const o of lista || []) {
      if (o?.z_importu) {
        const nr = strona ? pierwszyNr.get(strona.id) : null;
        uwagi.push({ rodzaj: 'z_importu', naprawa: 'z_importu', idObiektu: o.id, ...(strona ? { idStrony: strona.id, strony: nr ? [nr] : [] } : { strony: [] }), opis: tt('kontrola.zImportu', { x: wzorzec ? tt('kontrola.wzorzec', { nazwa: wzorzec.nazwa }) : '', z_importu: o.z_importu }) });
      }
      if (Array.isArray(o?.objects)) zImportu(o.objects, strona, wzorzec);
    }
  };
  for (const st of projekt.strony) zImportu(st.obiekty, st, null);
  for (const wz of projekt.wzorce || []) zImportu(wz.obiekty, null, wz);
  // Łączne pokrycie farbą (#131C): kolory elementów, które po przeliczeniu profilem drukarni przekraczają 300%.
  // Bez wczytanego profilu (podgląd separacji z profilem albo eksport PDF/X) prosta zamiana nie przekracza limitu.
  if (silnikTac()) {
    const zaDuzo = new Map(); // kolor → { tac, strony }
    const kolory = (o) => [o.fill, o.stroke, ...(o.styles ? Object.values(o.styles).flatMap((w) => Object.values(w).map((z) => z.fill)) : [])].filter((k) => typeof k === 'string');
    const przejdz = (obiekty, nr) => {
      for (const o of obiekty || []) {
        for (const k of kolory(o)) {
          const t = tacKoloru(k);
          if (t > LIMIT_TAC) { const w = zaDuzo.get(k) || { tac: t, strony: new Set() }; if (nr) w.strony.add(nr); zaDuzo.set(k, w); }
        }
        przejdz(o.objects, nr);
      }
    };
    for (const s of projekt.strony) przejdz(s.obiekty, pierwszyNr.get(s.id));
    for (const [k, w] of zaDuzo) {
      const strony = [...w.strony];
      uwagi.push({ rodzaj: 'pokrycie_farba', strony, opis: tt('kontrola.kolorPoPrzeliczeniuNa', { k, tac: w.tac, LIMIT_TAC, x: strony.length ? tt('kontrola.tekst2', { stronyIle: strony.length, join: strony.join(', ') }) : '' }) });
    }
  }
  const pamiec = new Map();
  const nieznane = new Map(); // pole → strony
  const brakObrazu = new Map(); // "kolumna\nplik" → strony
  const uzycia = new Map(); // tabela → kolumna → wartość → strony
  const czcionki = new Set((projekt.czcionki || []).map((c) => c.id));
  const niejednoznaczne = new Map(); // "kolumna\nplik" → strony

  for (const egz of ciag.egzemplarze) {
    const { pola, obrazy } = polaStrony(projekt, egz.strona, pamiec);
    if (!pola.size) continue;
    const wartosc = wartosciPol(projekt, egz, ciag);
    const nr = egz.indeks + 1;
    const tabela = egz.seria ? tabelaSerii(projekt, egz.seria) : null;
    const tabele = egz.seria ? tabeleSerii(projekt, egz.seria) : [];
    for (const nazwa of pola) {
      const v = wartosc(nazwa, null);
      if (v === undefined) {
        // {poczatek:…}, {koniec:…}, {nr_strony:…} z nieznaną nazwą też dają „brak wartości”, ale to inna uwaga.
        if (!DOKUMENTU.has(nazwa)) nieznane.set(nazwa, [...(nieznane.get(nazwa) || []), nr]);
        continue;
      }
      if (obrazy.has(nazwa) && String(v).trim()) {
        const obraz = obrazZNazwy(projekt.zasoby, v, czcionki);
        const klucz = `${nazwa}\n${v}`;
        if (!obraz) brakObrazu.set(klucz, [...(brakObrazu.get(klucz) || []), nr]);
        else if (obraz.niejednoznaczne) niejednoznaczne.set(klucz, [...(niejednoznaczne.get(klucz) || []), nr]);
      }
      // Pilnowane kolumny: z której tabeli (głównej albo dodatkowej) i z którego wiersza przyszła wartość.
      const zrodlo = tabele.length ? polePoTabelach(nazwa, tabele) : null;
      if (zrodlo?.tabela.unikalne?.includes(zrodlo.kolumna) && String(v).trim()) {
        const nrWiersza = zrodlo.tabela === tabela ? egz.nrWiersza : egz.dodatkowe.find((d) => d.tabela === zrodlo.tabela)?.nrWiersza;
        const kolumny = uzycia.get(zrodlo.tabela) || new Map();
        const wartosci = kolumny.get(zrodlo.kolumna) || new Map();
        const stan = wartosci.get(tasama(v)) || { wartosc: String(v).trim(), strony: [], wiersze: new Set() };
        stan.strony.push(nr); stan.wiersze.add(nrWiersza);
        wartosci.set(tasama(v), stan); kolumny.set(zrodlo.kolumna, wartosci); uzycia.set(zrodlo.tabela, kolumny);
      }
    }
  }

  // Książka (#131B): odsyłacze {s:…} do elementów, których już nie ma.
  if (uzywaKsiazki(projekt)) {
    const ix = indeksKsiazki(projekt, ciag);
    const zerwane = new Set();
    const szukaj = (obiekty) => { for (const o of obiekty || []) { if (typeof o?.text === 'string' && !o.bez_pol) for (const p of znajdzPola(o.text)) if (p.nazwa === 's' && !ix.gdzie.has(p.zapis)) zerwane.add(o.text.slice(0, 40)); if (Array.isArray(o?.objects)) szukaj(o.objects); } };
    for (const st of projekt.strony) szukaj(st.obiekty);
    for (const w of projekt.wzorce || []) szukaj(w.obiekty);
    if (zerwane.size) uwagi.push({ rodzaj: 'odsylacz', opis: tt('kontrola.odsylaczProwadziDoElementu', { join: [...zerwane].map((t) => `„${t}”`).join(', ') }) });
  }

  for (const [nazwa, strony] of nieznane) {
    uwagi.push({ rodzaj: 'nieznane_pole', strony, opis: tt('kontrola.poleNieMaSkad', { nazwa: `{${nazwa}}`, size: new Set(strony).size, lista: lista(strony) }) });
  }
  for (const [klucz, strony] of brakObrazu) {
    const [kolumna, plik] = klucz.split('\n');
    uwagi.push({ rodzaj: 'brak_obrazu', strony, opis: tt('kontrola.nieMaWProjekcie', { plik, kolumna, size: new Set(strony).size, lista: lista(strony) }) });
  }
  for (const [klucz, strony] of niejednoznaczne) {
    const [kolumna, plik] = klucz.split('\n');
    const pasuja = obrazZNazwy(projekt.zasoby, plik, czcionki).niejednoznaczne.map((id) => `„${projekt.zasoby[id].nazwa}”`).join(', ');
    uwagi.push({ rodzaj: 'brak_obrazu', strony, opis: tt('kontrola.niejednoznacznaNazwaObrazuKolumna', { plik, kolumna, pasuja, size: new Set(strony).size, lista: lista(strony) }) });
  }
  // Powtórzenia: na stronach, a gdy kolumna nie jest nigdzie użyta – w samej tabeli.
  for (const tabela of projekt.tabele) {
    for (const kolumna of tabela.unikalne || []) {
      const wartosci = uzycia.get(tabela)?.get(kolumna);
      if (wartosci) {
        for (const stan of wartosci.values()) {
          const { wartosc } = stan;
          // Powtórzenie to ta sama wartość w dwóch różnych wierszach. Jeden wiersz pokazany na
          // kilku stronach (np. tydzień na siedmiu stronach dni) powtórzeniem nie jest.
          const strony = [...new Set(stan.strony)];
          if (stan.wiersze.size > 1) uwagi.push({ rodzaj: 'powtorzenie', strony, opis: tt('kontrola.wartoscZKolumnyTabela', { wartosc, kolumna, nazwa: tabela.nazwa, lista: lista(strony) }) });
        }
      } else {
        for (const p of powtorzenia(tabela, kolumna)) {
          uwagi.push({ rodzaj: 'powtorzenie', strony: [], opis: tt('kontrola.wartoscWKolumnieTabela', { wartosc: p.wartosc, kolumna, nazwa: tabela.nazwa, lista: lista(p.wiersze.map((i) => i + 1)) }) });
        }
      }
    }
  }
  // Wartości spoza listy dozwolonych wartości kolumny.
  for (const tabela of projekt.tabele) {
    for (const kolumna of Object.keys(tabela.listy || {})) {
      for (const s of spozaListy(tabela, kolumna)) {
        uwagi.push({ rodzaj: 'spoza_listy', strony: [], opis: tt('kontrola.wartoscWKolumnieTabela2', { wartosc: s.wartosc, kolumna, nazwa: tabela.nazwa, wierszeIle: s.wiersze.length, lista: lista(s.wiersze.map((i) => i + 1)) }) });
      }
    }
  }
  // Serie: brak danych w tabelach dodatkowych, ostatni blok dokańczany pustymi stronami, za mało wartości.
  for (const seria of projekt.serie) {
    const wierszy = tabelaSerii(projekt, seria)?.wiersze.length || 0;
    const zDanymi = wierszyZDanymi(tabelaSerii(projekt, seria));
    for (const blok of bilansSerii(projekt, seria, ciag)) {
      if (blok.puste.length) {
        const ile = blok.puste.length;
        uwagi.push({ rodzaj: 'pusta_strona', strony: blok.puste, opis: tt('kontrola.seriaZebyStronyLewe', { nazwa: seria.nazwa, ile, lista: lista(blok.puste) }) });
      }
      if (blok.zamianaOd !== null) {
        uwagi.push({ rodzaj: 'zamiana_stron', strony: [blok.zamianaOd], opis: tt('kontrola.seriaOdStronyStrony', { nazwa: seria.nazwa, zamianaOd: blok.zamianaOd }) });
      }
      if (!blok.stron && blok.pominietych) {
        uwagi.push({ rodzaj: 'seria_bez_stron', strony: [], opis: tt('kontrola.seriaWszystkieWierszeTabeli', { nazwa: seria.nazwa, ZNACZNIK_POMIJANIA: znacznikPomijania() }) });
      }
      for (const d of blok.dodatkowe) {
        if (d.potrzeba > d.jest) {
          const ostatnia = ciag.egzemplarze.filter((e) => e.seria?.id === seria.id).at(-1).indeks + 1;
          uwagi.push({ rodzaj: 'brak_danych', strony: [d.brakOd], opis: tt('kontrola.seriaTabelaMaA', { nazwa: seria.nazwa, nazwa2: d.tabela.nazwa, jest: d.jest, potrzeba: d.potrzeba, opisKroku: opisKroku(d), brakOd: d.brakOd, x: ostatnia > d.brakOd ? ` do ${ostatnia}` : '' }) });
        }
      }
      if (seria.tryb === 'tabela' && seria.uklad === 'dlugi' && seria.dopelnij && wierszy % blok.dlugosc) {
        uwagi.push({ rodzaj: 'niepelny_blok', strony: [], opis: tt('kontrola.seriaTabelaMaA2', { nazwa: seria.nazwa, wierszy, dlugosc: blok.dlugosc }) });
      }
    }
    if (seria.tryb === 'stala' && zDanymi && seria.ile > zDanymi && (tabelaSerii(projekt, seria).unikalne || []).length) {
      uwagi.push({ rodzaj: 'za_malo_wartosci', strony: [], opis: tt('kontrola.seriaPowielaSieRazy', { nazwa: seria.nazwa, ile: seria.ile, zDanymi, x: zDanymi < wierszy ? tt('kontrola.zDanymi') : '' }) });
    }
  }
  // Elementy stron i wzorców (#414): rozdzielczość zdjęć, mały tekst, cienkie linie, czcionki, krawędź cięcia, spad.
  uwagi.push(...uwagiElementow(projekt, ciag));
  return uwagi;
}

// Pop-up (#300, plan składanek krok 20): kartka z grzbietem i doklejone części – czy po zamknięciu nic nie wystaje
// i czy mechanizm daje się złożyć na płasko (paski, zgięcia V, warstwy). Wynik zapamiętany dla tych samych części.
const pamiecPopupu = new Map();
function uwagiPopupu(arkusze) {
  const czesci = arkusze.flatMap((a, i) => (a.strona.obiekty || []).filter((o) => o?.czesc).map((o) => ({
    arkusz: i, nr: a.nr, idStrony: a.strona.id, idObiektu: o.id,
    czesc: o.czesc, obiekt: { czesc: o.czesc, left: o.left, top: o.top, width: o.width, height: o.height, angle: o.angle || 0, originX: o.originX, originY: o.originY, scaleX: o.scaleX || 1, scaleY: o.scaleY || 1 },
  })));
  if (!czesci.some((c) => (c.czesc.zgiecia || []).some((z) => z.grzbiet))) return [];
  const klucz = JSON.stringify(czesci.map((c) => [c.arkusz, c.obiekt]));
  if (!pamiecPopupu.has(klucz)) {
    let w = null;
    try { w = sprawdzPopup(czesci); } catch { w = null; }
    if (pamiecPopupu.size > 20) pamiecPopupu.clear();
    pamiecPopupu.set(klucz, w);
  }
  const w = pamiecPopupu.get(klucz);
  if (!w) return [];
  const gdzie = (c) => ({ rodzaj: 'skladanka', strony: c.nr ? [c.nr] : [], idStrony: c.idStrony, idObiektu: c.idObiektu });
  const nazwa = (c) => c.czesc.nr || c.czesc.nazwa || '?';
  const kartka = czesci.find((c) => (c.czesc.zgiecia || []).some((z) => z.grzbiet));
  const uwagi = [];
  // Koszt więzów przy zamkniętej kartce: dobre modele mają ~1e-3, za długi pasek – setki.
  if (w.koszt > 0.05) uwagi.push({ ...gdzie(kartka), opis: tt('kontrola.kartkaPopUpNie', { nazwa: nazwa(kartka) }) });
  for (const { ic, mm } of w.wystaje) {
    const c = czesci[ic];
    uwagi.push({ ...gdzie(c), opis: tt('kontrola.czescWystajePoZamknieciu', { nazwa: nazwa(c), round: Math.round(mm) }) });
  }
  return uwagi;
}
