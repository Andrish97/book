// Okładka liczona sama (decyzja #119) i składki środka (#120). Same obliczenia – bez DOM i bez Fabric,
// wspólne dla edytora, podglądu, eksportu i testów.
//
// Sekcja-okładka ma pole `okladka` (parametry oprawy, papieru i środka). Jej format (szerokość × wysokość)
// nie jest wpisywany ręcznie: liczy się z formatu stron środka, liczby stron środka (po powieleniach serii)
// i grubości papieru. Wynik ostatniego przeliczenia leży w `okladka.wynik` – z niego wiadomo, o ile
// przesunąć elementy przy następnej zmianie (np. środek urósł o 16 stron, więc grzbiet jest szerszy,
// a przód okładki przesuwa się w prawo).
//
// Układ okładki (od lewej, w mm od lewej krawędzi cięcia, bez spadu):
//   miękka / zeszytowa:  tył | grzbiet | przód
//   twarda:              zawinięcie | tył | big | grzbiet | big | przód | zawinięcie   (u góry i u dołu też zawinięcie)

import { rozwin } from './serie.js';

// Wolumen papieru (cm³/g): grubość kartki w mm = gramatura × wolumen / 1000.
export const PAPIERY = {
  offset: { nazwa: 'Offsetowy (zwykły)', wolumen: 1.25 },
  ksiazkowy: { nazwa: 'Książkowy (kremowy)', wolumen: 1.5 },
  objetosciowy: { nazwa: 'Objętościowy', wolumen: 1.8 },
  kredowy_mat: { nazwa: 'Kredowy matowy', wolumen: 0.95 },
  kredowy_blysk: { nazwa: 'Kredowy błyszczący', wolumen: 0.8 },
};

export const OPRAWY = {
  miekka: 'Miękka klejona (z grzbietem)',
  zeszytowa: 'Zeszytowa – szyta zszywkami (bez grzbietu)',
  twarda: 'Twarda (tektura z zawinięciem)',
};

export const SKLADKI = [0, 4, 8, 16, 32];

export const STREFY = {
  zawiniecie_l: 'Zawinięcie', tyl: 'Tył', big_l: 'Big', grzbiet: 'Grzbiet', big_p: 'Big', przod: 'Przód', zawiniecie_p: 'Zawinięcie',
};

const liczbaLub = (v, d, min = 0, max = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
export const zaokraglij = (mm) => Math.round(mm * 10) / 10;

export function domyslnaOkladka() {
  return {
    oprawa: 'miekka',
    srodek: null, // null – wszystkie sekcje poza okładkami; albo lista id sekcji
    strony: { tryb: 'auto', liczba: 0 }, // auto – liczone z sekcji środka (z powieleniami serii); reczne – wpisana liczba
    papier: { tryb: 'gramatura', grubosc_mm: 0.1, gramatura: 90, rodzaj: 'offset' },
    zawiniecie_mm: 15, // twarda: papier zawinięty na tekturę
    big_mm: 7, // twarda: rowek przy grzbiecie
    naddatek_mm: 3, // twarda: o tyle tektura wystaje poza blok (góra, dół, przód)
    tektura_mm: 2, // twarda: grubość tektury – grzbiet = blok + 2 × tektura
    wynik: null,
  };
}

export function normalizujOkladke(o) {
  if (!o || typeof o !== 'object') return null;
  const d = domyslnaOkladka();
  const p = { ...d.papier, ...(o.papier || {}) };
  return {
    oprawa: OPRAWY[o.oprawa] ? o.oprawa : d.oprawa,
    srodek: Array.isArray(o.srodek) ? o.srodek.filter((x) => typeof x === 'string') : null,
    strony: { tryb: o.strony?.tryb === 'reczne' ? 'reczne' : 'auto', liczba: Math.round(liczbaLub(o.strony?.liczba, 0, 0, 20000)) },
    papier: {
      tryb: p.tryb === 'grubosc' ? 'grubosc' : 'gramatura',
      grubosc_mm: liczbaLub(p.grubosc_mm, d.papier.grubosc_mm, 0.02, 2),
      gramatura: liczbaLub(p.gramatura, d.papier.gramatura, 30, 400),
      rodzaj: PAPIERY[p.rodzaj] ? p.rodzaj : 'offset',
    },
    zawiniecie_mm: liczbaLub(o.zawiniecie_mm, d.zawiniecie_mm, 0, 50),
    big_mm: liczbaLub(o.big_mm, d.big_mm, 0, 30),
    naddatek_mm: liczbaLub(o.naddatek_mm, d.naddatek_mm, 0, 20),
    tektura_mm: liczbaLub(o.tektura_mm, d.tektura_mm, 0, 10),
    wynik: o.wynik && typeof o.wynik === 'object' ? o.wynik : null,
  };
}

// Składka środka (#120): 0 – bez pilnowania, inaczej liczba stron w jednej składce.
export const normalizujSkladke = (v) => (SKLADKI.includes(Number(v)) ? Number(v) : 0);

export const jestOkladka = (sekcja) => Boolean(sekcja?.okladka);

// Grubość jednej kartki (mm).
export function gruboscKartki(papier) {
  if (papier.tryb === 'grubosc') return papier.grubosc_mm;
  return (papier.gramatura * (PAPIERY[papier.rodzaj] || PAPIERY.offset).wolumen) / 1000;
}

// Sekcje środka dla okładki: wskazane albo wszystkie, które nie są okładkami.
export function sekcjeSrodka(projekt, sekcja) {
  const wybrane = sekcja.okladka?.srodek;
  return projekt.sekcje.filter((s) => s !== sekcja && !jestOkladka(s) && (!wybrane || wybrane.includes(s.id)));
}

// Liczba stron w wydruku (z powieleniami serii i stronami pustymi) dla listy sekcji.
export function stronWydruku(ciag, sekcje) {
  return sekcje.reduce((n, s) => n + (ciag.sekcje.get(s.id)?.lista.length || 0), 0);
}

// Geometria okładki: { strona: {sz, wy}, stron, kartek, kartka_mm, grzbiet, szerokosc, wysokosc, strefy, gora, dol }.
// strefy: [{ rodzaj, x1, x2 }]; gora / dol – górna i dolna krawędź pola okładki (bez zawinięcia).
export function geometriaOkladki(projekt, sekcja, ciag = rozwin(projekt)) {
  const o = normalizujOkladke(sekcja.okladka);
  const srodek = sekcjeSrodka(projekt, sekcja);
  const wzor = srodek[0]?.wydruk || { szerokosc_mm: 148, wysokosc_mm: 210 };
  const sz = wzor.szerokosc_mm;
  const wy = wzor.wysokosc_mm;
  const stron = o.strony.tryb === 'reczne' ? o.strony.liczba : stronWydruku(ciag, srodek);
  const kartek = Math.ceil(stron / 2);
  const kartka = gruboscKartki(o.papier);
  const strefy = [];
  let x = 0;
  const dodaj = (rodzaj, w) => { strefy.push({ rodzaj, x1: zaokraglij(x), x2: zaokraglij(x + w) }); x += w; };
  let grzbiet;
  let wysokosc;
  let gora;
  if (o.oprawa === 'twarda') {
    grzbiet = zaokraglij(kartek * kartka + 2 * o.tektura_mm);
    const panel = sz + o.naddatek_mm;
    dodaj('zawiniecie_l', o.zawiniecie_mm);
    dodaj('tyl', panel);
    dodaj('big_l', o.big_mm);
    dodaj('grzbiet', grzbiet);
    dodaj('big_p', o.big_mm);
    dodaj('przod', panel);
    dodaj('zawiniecie_p', o.zawiniecie_mm);
    gora = o.zawiniecie_mm;
    wysokosc = wy + 2 * o.naddatek_mm + 2 * o.zawiniecie_mm;
  } else {
    grzbiet = o.oprawa === 'zeszytowa' ? 0 : zaokraglij(kartek * kartka);
    dodaj('tyl', sz);
    if (grzbiet > 0) dodaj('grzbiet', grzbiet);
    dodaj('przod', sz);
    gora = 0;
    wysokosc = wy;
  }
  const szerokosc = zaokraglij(x);
  wysokosc = zaokraglij(wysokosc);
  return {
    oprawa: o.oprawa, strona: { sz, wy }, stron, kartek, kartka_mm: Math.round(kartka * 1000) / 1000, grzbiet,
    szerokosc, wysokosc, strefy, gora: zaokraglij(gora), dol: zaokraglij(wysokosc - gora),
  };
}

// Strefa okładki, w której leży punkt x (mm).
export function strefaW(wynik, x) {
  const s = wynik.strefy.find((z) => x >= z.x1 && x < z.x2);
  if (s) return s.rodzaj;
  return x < 0 ? wynik.strefy[0]?.rodzaj : wynik.strefy[wynik.strefy.length - 1]?.rodzaj;
}
const strefa = (wynik, rodzaj) => wynik.strefy.find((z) => z.rodzaj === rodzaj) || null;

// Zastępstwo strefy, której nowa geometria nie ma (np. zeszytowa bez grzbietu, miękka bez zawinięć).
function strefaLubZastepcza(wynik, rodzaj) {
  const s = strefa(wynik, rodzaj);
  if (s) return s;
  if (rodzaj === 'grzbiet') {
    const t = strefa(wynik, 'tyl');
    return { rodzaj, x1: t.x2, x2: t.x2 };
  }
  if (rodzaj === 'zawiniecie_l' || rodzaj === 'big_l') return { rodzaj, x1: strefa(wynik, 'tyl').x1, x2: strefa(wynik, 'tyl').x1 };
  if (rodzaj === 'zawiniecie_p' || rodzaj === 'big_p') return { rodzaj, x1: strefa(wynik, 'przod').x2, x2: strefa(wynik, 'przod').x2 };
  return strefa(wynik, 'tyl');
}

// Szerokość i wysokość elementu zapisanego w projekcie (prostokąt opisany, bez obrotu o kąty inne niż 90°).
function rozmiarObiektu(o) {
  const w = (o.width || 0) * Math.abs(o.scaleX ?? 1);
  const h = (o.height || 0) * Math.abs(o.scaleY ?? 1);
  const pion = Math.abs(Math.round((o.angle || 0) / 90)) % 2 === 1;
  return pion ? { w: h, h: w } : { w, h };
}
// Środek elementu (left/top to lewy górny róg przed obrotem; obrót wokół tego rogu).
function srodekObiektu(o) {
  const w = (o.width || 0) * (o.scaleX ?? 1);
  const h = (o.height || 0) * (o.scaleY ?? 1);
  const k = ((o.angle || 0) * Math.PI) / 180;
  return { x: (o.left || 0) + (w / 2) * Math.cos(k) - (h / 2) * Math.sin(k), y: (o.top || 0) + (w / 2) * Math.sin(k) + (h / 2) * Math.cos(k) };
}

// Przypięcie elementu: ustawione w panelu (o.okladka) albo ze strefy, w której leży jego środek.
// Element rozciągnięty na całą okładkę (tło) przypina się do całości ('cala').
export function przypiecie(o, wynik, spad = 0) {
  if (o.okladka && o.okladka !== 'auto') return o.okladka;
  const { w } = rozmiarObiektu(o);
  if (o.type !== 'textbox' && w >= wynik.szerokosc * 0.95 && w <= wynik.szerokosc + 2 * spad + 2) return 'cala';
  return strefaW(wynik, srodekObiektu(o).x);
}

// Przesuwa (i dla tła – rozciąga) elementy listy po zmianie geometrii okładki ze `stary` na `nowy`.
// Zwraca liczbę zmienionych elementów.
export function przesunElementy(obiekty, stary, nowy, spad = 0) {
  let n = 0;
  const dyGora = nowy.gora - stary.gora;
  const dyDol = nowy.dol - stary.dol;
  for (const o of obiekty || []) {
    if (!o || typeof o !== 'object') continue;
    const p = przypiecie(o, stary, spad);
    const c = srodekObiektu(o);
    const dy = c.y < stary.wysokosc / 2 ? dyGora : dyDol;
    let dx = 0;
    if (p === 'cala') {
      // Tło na całą okładkę: rozciąga się do nowej szerokości i wysokości (z zachowaniem spadu).
      const sx = (nowy.szerokosc + 2 * spad) / (stary.szerokosc + 2 * spad);
      const { h } = rozmiarObiektu(o);
      const naWysokosc = h >= stary.wysokosc * 0.95;
      const sy = naWysokosc ? (nowy.wysokosc + 2 * spad) / (stary.wysokosc + 2 * spad) : 1;
      if (Math.abs(sx - 1) > 1e-6 || Math.abs(sy - 1) > 1e-6 || (!naWysokosc && dy)) {
        o.scaleX = (o.scaleX ?? 1) * sx;
        o.scaleY = (o.scaleY ?? 1) * sy;
        o.left = -spad + ((o.left || 0) + spad) * sx;
        o.top = naWysokosc ? -spad + ((o.top || 0) + spad) * sy : (o.top || 0) + dy;
        n += 1;
      }
      continue;
    }
    const s = strefaLubZastepcza(stary, p);
    const t = strefaLubZastepcza(nowy, p);
    if (!s || !t) continue;
    if (p === 'grzbiet') {
      dx = (t.x1 + t.x2) / 2 - (s.x1 + s.x2) / 2;
      if (o.okladka_dopasuj && o.type !== 'textbox' && t.x2 > t.x1) {
        // Dopasowanie do szerokości grzbietu (element obrócony o 90° – jego wysokość jest szerokością).
        const pion = Math.abs(Math.round((o.angle || 0) / 90)) % 2 === 1;
        const { w } = rozmiarObiektu(o);
        if (w > 0) {
          const skala = (t.x2 - t.x1) / w;
          if (pion) o.scaleY = (o.scaleY ?? 1) * skala; else o.scaleX = (o.scaleX ?? 1) * skala;
          // Po skalowaniu środek ma zostać na środku grzbietu.
          const c2 = srodekObiektu(o);
          o.left = (o.left || 0) + ((t.x1 + t.x2) / 2 - c2.x);
          o.top = (o.top || 0) + (c.y + dy - c2.y);
          n += 1;
          continue;
        }
      }
    } else if (p === 'przod' || p === 'big_p' || p === 'zawiniecie_p') {
      dx = t.x2 - s.x2; // prawa część okładki trzyma się prawej krawędzi swojej strefy
    } else {
      dx = t.x1 - s.x1;
    }
    if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) {
      o.left = (o.left || 0) + dx;
      o.top = (o.top || 0) + dy;
      n += 1;
    }
  }
  return n;
}

const takiSam = (a, b) => a && b && a.szerokosc === b.szerokosc && a.wysokosc === b.wysokosc && a.gora === b.gora
  && JSON.stringify(a.strefy) === JSON.stringify(b.strefy);

// Przelicza wszystkie okładki projektu: format sekcji, wynik i położenie elementów na ich stronach.
// Zwraca id sekcji, które się zmieniły (ich strony trzeba przerysować).
export function przeliczOkladki(projekt, ciag = null) {
  const zmienione = [];
  const okladki = (projekt.sekcje || []).filter(jestOkladka);
  if (!okladki.length) return zmienione;
  const c = ciag || rozwin(projekt);
  for (const sekcja of okladki) {
    sekcja.okladka = normalizujOkladke(sekcja.okladka);
    const nowy = geometriaOkladki(projekt, sekcja, c);
    const stary = sekcja.okladka.wynik;
    const w = sekcja.wydruk;
    if (takiSam(stary, nowy) && w.szerokosc_mm === nowy.szerokosc && w.wysokosc_mm === nowy.wysokosc) {
      if (JSON.stringify(stary) !== JSON.stringify(nowy)) sekcja.okladka.wynik = nowy; // np. inna liczba stron, ten sam grzbiet
      continue;
    }
    // Pierwsze przeliczenie (np. „Zamień na okładkę”): układ ze starego formatu sekcji – elementy przesuwają się
    // tak, jakby stara okładka miała ten sam układ stref co nowa, rozciągnięty do starej szerokości.
    const poprzedni = stary || rozciagnij(nowy, w.szerokosc_mm, w.wysokosc_mm);
    for (const s of projekt.strony.filter((x) => x.sekcja === sekcja.id)) przesunElementy(s.obiekty, poprzedni, nowy, w.spad_mm || 0);
    Object.assign(w, { szerokosc_mm: nowy.szerokosc, wysokosc_mm: nowy.wysokosc, format: 'wlasny' });
    sekcja.uklad = 'pojedyncze';
    sekcja.okladka.wynik = nowy;
    zmienione.push(sekcja.id);
  }
  return zmienione;
}

// Geometria `g` przeniesiona na inną szerokość i wysokość: tył i przód rosną, grzbiet i zawinięcia zostają.
export function rozciagnij(g, szerokosc, wysokosc) {
  const stale = g.strefy.filter((z) => z.rodzaj !== 'tyl' && z.rodzaj !== 'przod').reduce((n, z) => n + (z.x2 - z.x1), 0);
  const panel = Math.max(1, (szerokosc - stale) / 2);
  let x = 0;
  const strefy = g.strefy.map((z) => {
    const w = z.rodzaj === 'tyl' || z.rodzaj === 'przod' ? panel : z.x2 - z.x1;
    const s = { rodzaj: z.rodzaj, x1: zaokraglij(x), x2: zaokraglij(x + w) };
    x += w;
    return s;
  });
  const gora = Math.min(g.gora, wysokosc / 4);
  return { ...g, szerokosc, wysokosc, strefy, gora, dol: wysokosc - gora };
}

// Bezpieczne pola okładki (do ostrzeżeń i prowadnic): tył i przód w marginesach sekcji, grzbiet z luzem 1 mm.
// [{ rodzaj, x1, x2, y1, y2 }]
export function polaBezpieczne(wynik, marginesy) {
  const m = marginesy || { gora: 0, dol: 0, wewnetrzny: 0, zewnetrzny: 0 };
  const wynikowe = [];
  for (const z of wynik.strefy) {
    if (z.rodzaj === 'tyl') wynikowe.push({ rodzaj: 'tyl', x1: z.x1 + m.zewnetrzny, x2: z.x2 - m.wewnetrzny, y1: wynik.gora + m.gora, y2: wynik.dol - m.dol });
    else if (z.rodzaj === 'przod') wynikowe.push({ rodzaj: 'przod', x1: z.x1 + m.wewnetrzny, x2: z.x2 - m.zewnetrzny, y1: wynik.gora + m.gora, y2: wynik.dol - m.dol });
    else if (z.rodzaj === 'grzbiet' && z.x2 - z.x1 > 2) wynikowe.push({ rodzaj: 'grzbiet', x1: z.x1 + 1, x2: z.x2 - 1, y1: wynik.gora + m.gora, y2: wynik.dol - m.dol });
  }
  return wynikowe;
}

// ---------- Składki (#120) ----------

// { stron, skladka, pelnych, brakuje, doPelnej } dla sekcji (albo null, gdy składka nie jest ustawiona).
export function bilansSkladki(sekcja, ciag) {
  const skladka = normalizujSkladke(sekcja.skladka);
  if (!skladka) return null;
  const stron = ciag.sekcje.get(sekcja.id)?.lista.length || 0;
  const reszta = stron % skladka;
  const brakuje = reszta ? skladka - reszta : 0;
  return { stron, skladka, brakuje, doPelnej: stron + brakuje, skladek: Math.ceil(stron / skladka) };
}

// Tekst do licznika stron: „46 z 48 – brakuje 2 do pełnej składki”.
export function opisSkladki(b) {
  if (!b) return '';
  if (!b.brakuje) return `${b.stron} stron – ${b.skladek} ${b.skladek === 1 ? 'pełna składka' : (b.skladek % 10 >= 2 && b.skladek % 10 <= 4 && (b.skladek % 100 < 10 || b.skladek % 100 >= 20) ? 'pełne składki' : 'pełnych składek')} po ${b.skladka}`;
  return `${b.stron} z ${b.doPelnej} – brakuje ${b.brakuje} do pełnej składki (×${b.skladka})`;
}
