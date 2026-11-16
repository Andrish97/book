// Dane makiety 3D bez okna i bez składania stron (#188): z projektu liczy wszystko, czego makieta potrzebuje
// do zbudowania bryły (okładka i jej geometria, obwoluta, sekcje specjalne, kolejność stron, format), a także
// „opis makiety” – czyste dane JSON dla podglądu z linku. Osoba z linku nie ma projektu, tylko obrazy stron;
// z opisu dostaje tę samą bryłę co właściciel (jedno źródło: bazaMakiety), a tekstury – z obrazów linku.

import { rozwin } from './serie.js';
import { geometriaOkladki, jestOkladka, normalizujOkladke } from './okladka.js';
import { MODELE, jestSpecjalnyModel } from './makieta-3d.js';
import { normalizujOpcje, normalizujUjecie, DOMYSLNE_OPCJE } from './makieta-ustawienia.js';
import { typSekcji, rolaTypu } from './typ-sekcji.js';
import { geometriaSpecjalna, normalizujSpecjalna } from './sekcje-specjalne.js';

// Domyślny model: z okładką – książka (twarda, gdy taka oprawa), kalendarz z nazwy albo z 12–14 kart,
// jedna strona – kartka, reszta – książka w miękkiej oprawie.
export function domyslnyModel(projekt, liczbaStron, okladka) {
  if (okladka) return normalizujOkladke(okladka.okladka).oprawa === 'twarda' ? 'ksiazka_twarda' : 'ksiazka_miekka';
  const nazwa = String(projekt.nazwa || '').toLowerCase();
  if (/biurk/.test(nazwa)) return 'kalendarz_biurkowy';
  if (/kalend/.test(nazwa) || (liczbaStron >= 12 && liczbaStron <= 14)) return 'kalendarz_scienny';
  if (liczbaStron <= 2) return 'kartka';
  return 'ksiazka_miekka';
}

// Modele pasujące do sekcji projektu (#181): ogólne (książka, notes, kalendarz, kartka) – gdy projekt ma zwykłe
// strony albo okładkę; ulotka, koperta, pudełko, trójdzielny – tylko z sekcją takiego typu. Zwraca też sekcje
// specjalne modeli: { modele: [...], specjalne: { model: sekcja } }.
export function modeleProjektu(projekt) {
  const specjalne = {};
  let ogolne = false;
  for (const s of projekt.sekcje || []) {
    const t = typSekcji(s);
    const rola = rolaTypu(t);
    const maStrony = (projekt.strony || []).some((x) => x.sekcja === s.id);
    if (maStrony && (rola === 'blok' || rola === 'wkladka' || rola === 'podkladka' || rola === 'wyklejka' || rola === 'okladka')) ogolne = true;
    let model = null;
    if (t === 'ulotka') model = 'ulotka';
    else if (t === 'trojdzielny') model = 'trojdzielny';
    else if (t === 'wykrojnik') {
      const k = normalizujSpecjalna(s.specjalna)?.ksztalt;
      model = k === 'pudelko' ? 'pudelko' : k === 'koperta' ? 'koperta' : null;
    }
    if (model && !specjalne[model] && maStrony) specjalne[model] = s;
  }
  const lista = Object.keys(MODELE).filter((m) => (jestSpecjalnyModel(m) ? Boolean(specjalne[m]) : ogolne || !Object.keys(specjalne).length));
  return { modele: lista, specjalne };
}

// Bryła makiety z projektu: { ciag, strony, okladka, geometria, format, obwoluta, modele, specjalne, specjalneDane }.
export function bazaMakiety(projekt, ciag = rozwin(projekt)) {
  const okladka = projekt.sekcje.find((s) => jestOkladka(s)) || null;
  const strony = ciag.egzemplarze.filter((e) => !jestOkladka(e.sekcja));
  const pierwsza = projekt.sekcje.find((s) => !jestOkladka(s) && rolaTypu(typSekcji(s)) === 'blok') || projekt.sekcje.find((s) => !jestOkladka(s)) || projekt.sekcje[0];
  const format = { w: pierwsza.wydruk.szerokosc_mm, h: pierwsza.wydruk.wysokosc_mm };
  let geometria = null;
  try { if (okladka) geometria = geometriaOkladki(projekt, okladka, ciag); } catch { geometria = null; }
  // Obwoluta (#181): pierwsza sekcja typu „obwoluta” z co najmniej jedną stroną.
  let obwoluta = null;
  const sObw = projekt.sekcje.find((s) => typSekcji(s) === 'obwoluta');
  const eObw = sObw && ciag.egzemplarze.find((e) => e.sekcja.id === sObw.id && !e.pusta);
  if (eObw) {
    try { const wynik = geometriaSpecjalna(projekt, sObw, ciag); if (wynik?.strefy?.length) obwoluta = { sekcja: sObw, egz: eObw, wynik }; } catch { obwoluta = null; }
  }
  const { modele, specjalne } = modeleProjektu(projekt);
  // Geometria sekcji specjalnych liczona od razu – z linku nie da się jej policzyć (brak projektu).
  const specjalneDane = {};
  for (const [model, s] of Object.entries(specjalne)) {
    try { specjalneDane[model] = { ...normalizujSpecjalna(s.specjalna), wynik: geometriaSpecjalna(projekt, s, ciag) }; } catch { specjalneDane[model] = null; }
  }
  return {
    ciag, strony, okladka: geometria ? okladka : null, geometria, format, obwoluta,
    modele: modele.length ? modele : Object.keys(MODELE).filter((m) => !jestSpecjalnyModel(m)), specjalne, specjalneDane,
  };
}

const czytaj = (klucz) => { try { return localStorage.getItem(klucz); } catch { return null; } };
const czytajSesje = (klucz) => { try { return sessionStorage.getItem(klucz); } catch { return null; } };

// Wariant pokazywany z linku (#188): pierwsze zapisane ujęcie projektu, a bez ujęć – rodzaj, ułożenie i światło
// z tego urządzenia (tak jak właściciel widzi makietę), inaczej domyślne.
function wariantLinku(projekt, baza) {
  const uj = projekt.makieta?.ujecia?.[0];
  if (uj) {
    const n = normalizujUjecie(uj);
    if (!n.model || baza.modele.includes(n.model)) return { ...n, model: n.model || baza.modele[0] };
  }
  const zapamietany = czytajSesje(`makieta:${projekt.id}`);
  const dm = domyslnyModel(projekt, baza.strony.length, baza.okladka);
  const model = baza.modele.includes(zapamietany) ? zapamietany : baza.modele.includes(dm) ? dm : baza.modele[0];
  let opcje = DOMYSLNE_OPCJE;
  try { opcje = JSON.parse(czytaj(`makieta-opcje:${projekt.id}`) || 'null') || DOMYSLNE_OPCJE; } catch { opcje = DOMYSLNE_OPCJE; }
  return { model, ulozenie: czytaj(`makieta-ulozenie:${projekt.id}`) === 'stoi' ? 'stoi' : 'lezy', opcje: normalizujOpcje(opcje), kamera: null };
}

// Sekcja w opisie: tylko to, czego potrzebuje bryła (bez stron, elementów i danych).
const sekcjaOpisu = (s) => ({
  id: s.id, nazwa: s.nazwa, typ: typSekcji(s), wydruk: { szerokosc_mm: s.wydruk.szerokosc_mm, wysokosc_mm: s.wydruk.wysokosc_mm },
  ...(jestOkladka(s) ? { okladka: normalizujOkladke(s.okladka) } : {}),
});

// Opis makiety do manifestu linku: czyste dane JSON, strony jako klucze egzemplarzy (= id obrazów linku).
export function opisMakiety(projekt, ciag = rozwin(projekt)) {
  const b = bazaMakiety(projekt, ciag);
  const wariant = wariantLinku(projekt, b);
  const uzyte = new Map();
  const sek = (s) => { if (s && !uzyte.has(s.id)) uzyte.set(s.id, sekcjaOpisu(s)); return s?.id ?? null; };
  const strony = b.strony.map((e) => ({ k: e.klucz, s: sek(e.sekcja), ...(e.pusta ? { pusta: true } : {}) }));
  const okladka = b.okladka ? { s: sek(b.okladka), k: ciag.egzemplarze.find((e) => e.sekcja.id === b.okladka.id)?.klucz ?? null } : null;
  const obwoluta = b.obwoluta ? { s: sek(b.obwoluta.sekcja), k: b.obwoluta.egz.klucz, wynik: b.obwoluta.wynik } : null;
  const specjalna = jestSpecjalnyModel(wariant.model) && b.specjalne[wariant.model]
    ? { s: sek(b.specjalne[wariant.model]), dane: b.specjalneDane[wariant.model] } : null;
  return {
    wersja: 1, nazwa: projekt.nazwa, model: wariant.model, wariant, format: b.format,
    sekcje: [...uzyte.values()], strony, okladka, geometria: b.okladka ? b.geometria : null, obwoluta, specjalna,
  };
}

// Odwrotnie: z opisu linku bryła w tej samej postaci co bazaMakiety (sekcje i egzemplarze – szkielety).
export function bazaZOpisu(opis) {
  const sekcje = new Map(opis.sekcje.map((s) => [s.id, s]));
  const egz = (k, s, pusta = false) => ({ klucz: k, sekcja: sekcje.get(s) || null, ...(pusta ? { pusta: true } : {}) });
  const strony = opis.strony.map((x) => egz(x.k, x.s, x.pusta));
  const okladka = opis.okladka && opis.geometria ? sekcje.get(opis.okladka.s) : null;
  const eOkl = okladka && opis.okladka.k ? egz(opis.okladka.k, okladka.id) : null;
  const obwoluta = opis.obwoluta ? { sekcja: sekcje.get(opis.obwoluta.s), egz: egz(opis.obwoluta.k, opis.obwoluta.s), wynik: opis.obwoluta.wynik } : null;
  const specjalne = {};
  const specjalneDane = {};
  if (opis.specjalna) { specjalne[opis.model] = sekcje.get(opis.specjalna.s); specjalneDane[opis.model] = opis.specjalna.dane; }
  return {
    ciag: { egzemplarze: [...(eOkl ? [eOkl] : []), ...strony] },
    strony, okladka, geometria: okladka ? opis.geometria : null, format: opis.format, obwoluta,
    modele: [opis.model], specjalne, specjalneDane,
  };
}
