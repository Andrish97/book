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
import { t } from './jezyk.js';

// Domyślny model: z okładką – książka (twarda, gdy taka oprawa), kalendarz z nazwy albo z 12–14 kart,
// jedna strona – kartka, reszta – książka w miękkiej oprawie.
export function domyslnyModel(projekt, liczbaStron, okladka) {
  if (okladka) { const op = normalizujOkladke(okladka.okladka).oprawa; return op === 'twarda' ? 'ksiazka_twarda' : op === 'zeszytowa' ? 'ksiazka_zeszytowa' : 'ksiazka_miekka'; }
  const nazwa = String(projekt.nazwa || '').toLowerCase();
  if (/biurk/.test(nazwa)) return 'kalendarz_biurkowy';
  if (/kalend/.test(nazwa) || (liczbaStron >= 12 && liczbaStron <= 14)) return 'kalendarz_scienny';
  if (liczbaStron <= 2) return 'kartka';
  if (liczbaStron % 4 === 0 && liczbaStron <= 64) return 'ksiazka_zeszytowa';
  return 'ksiazka_miekka';
}

// Modele pasujące do sekcji projektu (#181): ogólne (książka, notes, kalendarz, kartka) – gdy projekt ma zwykłe
// strony albo okładkę; ulotka, koperta, pudełko, trójdzielny – tylko z sekcją takiego typu. Zwraca też sekcje
// specjalne modeli: { modele: [...], specjalne: { model: sekcja } }.
export function modeleProjektu(projekt, ciag = null) {
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
    else if (t === 'skladanka') model = 'skladanka';
    else if (t === 'wykrojnik') {
      const k = normalizujSpecjalna(s.specjalna)?.ksztalt;
      model = k === 'pudelko' ? 'pudelko' : k === 'koperta' ? 'koperta' : null;
    }
    if (model && !specjalne[model] && maStrony) specjalne[model] = s;
  }
  // Makieta dobrana do projektu (#215): z ogólnych rodzajów tylko te, które projekt naprawdę spełnia – zwykle jeden,
  // najwyżej dwa (np. miękka oprawa – książka albo notes na spirali). Reszta to „inne” – do wyboru z opisem, czego
  // brakuje (książka nigdy nie jest kalendarzem).
  const ogolneModele = Object.keys(MODELE).filter((m) => !jestSpecjalnyModel(m));
  const bezSpecjalnych = !Object.keys(specjalne).length;
  const pasujace = ogolne || bezSpecjalnych ? pasujaceOgolne(projekt, ciag) : [];
  const lista = [...pasujace, ...Object.keys(MODELE).filter((m) => jestSpecjalnyModel(m) && specjalne[m])];
  const inne = ogolne || bezSpecjalnych ? ogolneModele.filter((m) => !pasujace.includes(m)) : [];
  return { modele: lista, inne, specjalne };
}

// Ogólne rodzaje pasujące do projektu: okładka mówi o oprawie; bez okładki – liczba i układ kart.
function pasujaceOgolne(projekt, ciag) {
  const okladka = (projekt.sekcje || []).find((s) => jestOkladka(s));
  if (okladka) {
    const oprawa = normalizujOkladke(okladka.okladka).oprawa;
    return oprawa === 'twarda' ? ['ksiazka_twarda'] : oprawa === 'zeszytowa' ? ['ksiazka_zeszytowa'] : ['ksiazka_miekka', 'notes'];
  }
  const c = ciag || rozwin(projekt);
  const stron = c.egzemplarze.filter((e) => !e.pusta && !jestOkladka(e.sekcja)).length;
  const typy = new Set((projekt.sekcje || []).map((s) => typSekcji(s)));
  const pierwsza = (projekt.sekcje || []).find((s) => rolaTypu(typSekcji(s)) === 'blok') || projekt.sekcje?.[0];
  const poziomo = pierwsza ? pierwsza.wydruk.szerokosc_mm > pierwsza.wydruk.wysokosc_mm : false;
  const kalendarz = typy.has('kalendarz') || typy.has('podkladka') || /kalend/i.test(projekt.nazwa || '') || (stron >= 12 && stron <= 14);
  if (kalendarz) return poziomo || /biurk/i.test(projekt.nazwa || '') ? ['kalendarz_biurkowy', 'kalendarz_scienny'] : ['kalendarz_scienny', 'kalendarz_biurkowy'];
  if (stron <= 2) return ['kartka'];
  // Bez okładki, do 64 stron i wielokrotność 4 – zwykle broszura zeszytowa (okładka z tego samego papieru).
  if (stron % 4 === 0 && stron <= 64) return ['notes', 'ksiazka_zeszytowa'];
  return ['notes', 'ksiazka_miekka'];
}

// Czego brakuje, żeby projekt pasował do rodzaju makiety – z propozycją (#215).
export function powodNiepasowania(model, projekt) {
  const okladka = (projekt.sekcje || []).find((s) => jestOkladka(s));
  const oprawa = okladka ? normalizujOkladke(okladka.okladka).oprawa : null;
  const opisy = {
    ksiazka_twarda: okladka
      ? t('kod.makieta.oprawaNieTwarda', { oprawa: t(oprawa === 'zeszytowa' ? 'zeszytową' : 'miękką') })
      : 'Projekt nie ma okładki – makieta pokaże pustą, ciemną okleinę. Dodaj sekcję typu „Okładka” z twardą oprawą albo zacznij od szablonu projektu „Książka w twardej oprawie”.',
    ksiazka_miekka: okladka
      ? 'Projekt ma twardą oprawę – miękka okładka byłaby inną książką. Zmień oprawę w ustawieniach sekcji okładki.'
      : 'Projekt nie ma okładki – makieta pokaże białą okładkę. Dodaj sekcję typu „Okładka” albo zacznij od szablonu projektu.',
    ksiazka_zeszytowa: okladka && oprawa !== 'zeszytowa'
      ? t('kod.makieta.oprawaNieZeszytowa', { oprawa: t(oprawa === 'twarda' ? 'twardą' : 'miękką klejoną') })
      : 'Broszura zeszytowa – arkusze złożone na pół i zszyte w zgięciu (liczba stron podzielna przez 4).',
    notes: okladka && oprawa === 'twarda' ? 'Twarda oprawa nie jest szyta na spiralę – notes pokaże strony bez okładki.' : 'Notes na spirali – strony projektu zepnie spirala; okładka (jeśli jest) będzie pierwszą kartą.',
    kalendarz_scienny: 'Kalendarz ścienny ma zwykle 13 kart (okładka i 12 miesięcy) – projekt ich nie ma. Brakujące karty będą białe; zacznij od szablonu „Kalendarz ścienny z plecami”.',
    kalendarz_biurkowy: 'Kalendarz biurkowy ma zwykle 13 kart w poziomie – projekt ich nie ma. Brakujące karty będą białe.',
    kartka: 'Pojedyncza kartka pokaże tylko dwie pierwsze strony projektu.',
  };
  return opisy[model] || '';
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
  const { modele, inne, specjalne } = modeleProjektu(projekt, ciag);
  // Geometria sekcji specjalnych liczona od razu – z linku nie da się jej policzyć (brak projektu).
  const specjalneDane = {};
  for (const [model, s] of Object.entries(specjalne)) {
    try { specjalneDane[model] = { ...normalizujSpecjalna(s.specjalna), wynik: geometriaSpecjalna(projekt, s, ciag) }; } catch { specjalneDane[model] = null; }
    // Składanka (#238): części z położeniem na arkuszu (indeks strony sekcji) – do składania w 3D.
    if (model === 'skladanka' && specjalneDane[model]) {
      const arkusze = ciag.egzemplarze.filter((e) => e.sekcja.id === s.id && !e.pusta).map((e) => e.strona);
      specjalneDane[model].czesci = arkusze.flatMap((st, i) => (st.obiekty || []).filter((o) => o?.czesc).map((o) => ({
        arkusz: i, czesc: o.czesc, obiekt: { czesc: o.czesc, left: o.left, top: o.top, width: o.width, height: o.height, angle: o.angle || 0, originX: o.originX, originY: o.originY, scaleX: o.scaleX || 1, scaleY: o.scaleY || 1 },
      })));
    }
  }
  return {
    ciag, strony, okladka: geometria ? okladka : null, geometria, format, obwoluta,
    modele: modele.length ? modele : Object.keys(MODELE).filter((m) => !jestSpecjalnyModel(m)), inne: modele.length ? inne : [], specjalne, specjalneDane,
  };
}

const czytaj = (klucz) => { try { return localStorage.getItem(klucz); } catch { return null; } };
const czytajSesje = (klucz) => { try { return sessionStorage.getItem(klucz); } catch { return null; } };

// Wariant pokazywany z linku (#188): pierwsze zapisane ujęcie projektu, a bez ujęć – rodzaj, ułożenie i światło
// z tego urządzenia (tak jak właściciel widzi makietę), inaczej domyślne.
function wariantLinku(projekt, baza) {
  // Wybór właściciela w oknie Udostępnij (#325): zapisane ujęcie albo rodzaj; bez wyboru – jak dotąd.
  const ml = projekt.makieta_linku || {};
  const dozwolone = [...baza.modele, ...(modeleProjektu(projekt).inne || [])];
  const wybrane = ml.ujecie ? projekt.makieta?.ujecia?.find((u) => u.id === ml.ujecie) : null;
  const uj = wybrane || (ml.model ? null : projekt.makieta?.ujecia?.[0]);
  if (uj) {
    const n = normalizujUjecie(uj);
    if (!n.model || dozwolone.includes(n.model)) return { ...n, model: n.model || baza.modele[0] };
  }
  if (ml.model && dozwolone.includes(ml.model)) {
    let opcje0 = DOMYSLNE_OPCJE;
    try { opcje0 = JSON.parse(czytaj(`makieta-opcje:${projekt.id}`) || 'null') || DOMYSLNE_OPCJE; } catch { opcje0 = DOMYSLNE_OPCJE; }
    return { model: ml.model, ulozenie: czytaj(`makieta-ulozenie:${projekt.id}`) === 'stoi' ? 'stoi' : 'lezy', opcje: normalizujOpcje(opcje0), kamera: null };
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
  if (projekt.makieta_linku?.pokaz === false) return null; // właściciel wyłączył makietę w linku (#325)
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
