// Książka (#131B): spis treści, żywa pagina, przypisy dolne, odsyłacze i skorowidz. Same obliczenia – bez DOM
// i bez Fabric, wspólne dla edytora, podglądu, eksportu i testów.
//
// Zapis w projekcie:
//  - `projekt.ksiazka = { naglowki: [{ styl: id stylu akapitu, poziom: 1–3 }], przypisy: 'sekcja' | 'strona' | 'ciagle' }`
//    – które style akapitu są nagłówkami (spis treści, żywa pagina) i jak liczyć przypisy. Bez ustawienia:
//    styl „Tytuł” to poziom 1, „Nagłówek” – poziom 2, przypisy liczone od nowa w każdej sekcji.
//  - tekst z `ksiazka: { rodzaj: 'spis' | 'skorowidz', poziomy, kropki }` – element, którego treść składa się sama
//    (spis treści z nagłówków, skorowidz z haseł). Przelewa się przez połączone ramki jak zwykły tekst.
//  - pola w tekście: {rozdzial} / {rozdzial:2} – ostatni nagłówek poziomu 1 (2, 3) do tej strony (żywa pagina, np.
//    w stopce wzorca), {s:id} – numer strony elementu o tym id (odsyłacz „zob. s. 12”), {przypis:id} – numer przypisu.
//  - tekst z przypisami: `przypisy: { id: treść }`; w tekście w miejscu odnośnika stoi pole {przypis:id}.
//    Treść przypisów staje na dole tej samej strony (zlozenie.js: obszarPrzypisow).
//  - tekst z hasłami skorowidza: `hasla: ['słowo', …]` – strony skorowidza to wszystkie strony, na których hasło
//    występuje w jakimkolwiek tekście (po podstawieniu danych, z powieleniami serii).

import { rozwin, wartosciPol } from './serie.js';
import { podstawWTekscie, znajdzPola } from './pola.js';

export const RODZAJE = { spis: 'Spis treści', skorowidz: 'Skorowidz' };
export const LICZENIE_PRZYPISOW = { sekcja: 'Od nowa w każdej sekcji', strona: 'Od nowa na każdej stronie', ciagle: 'W całym projekcie' };

// Nagłówki projektu: [{ styl, poziom }] – zapisane albo domyślne (po nazwach stylów).
export function naglowkiProjektu(projekt) {
  const style = projekt?.style || [];
  const zapis = projekt?.ksiazka?.naglowki;
  if (Array.isArray(zapis)) return zapis.filter((n) => style.some((s) => s.id === n.styl)).map((n) => ({ styl: n.styl, poziom: Math.min(3, Math.max(1, Math.round(n.poziom) || 1)) }));
  const poNazwie = (wzor) => style.find((s) => wzor.test(s.nazwa || ''));
  const wynik = [];
  const t = poNazwie(/^(tytuł|rozdział)/i);
  const n = poNazwie(/^(nagłówek|śródtytuł|podtytuł)/i);
  if (t) wynik.push({ styl: t.id, poziom: 1 });
  if (n && n !== t) wynik.push({ styl: n.id, poziom: 2 });
  return wynik;
}

// Teksty listy obiektów (także w grupach) – bez elementów składanych samych (spis, skorowidz).
function teksty(obiekty, wynik = []) {
  for (const o of obiekty || []) {
    if (!o || o.visible === false) continue;
    if (Array.isArray(o.objects) && !o.tabela && !o.kod) teksty(o.objects, wynik);
    else if (typeof o.text === 'string' && !o.ksiazka) wynik.push(o);
  }
  return wynik;
}
// Kolejność czytania na stronie: z góry na dół, w jednym rzędzie od lewej.
const poKolei = (a, b) => (Math.abs((a.top || 0) - (b.top || 0)) > 2 ? (a.top || 0) - (b.top || 0) : (a.left || 0) - (b.left || 0));

const zbierzIdy = (obiekty, zbior) => {
  for (const o of obiekty || []) {
    if (o?.id) zbior.add(o.id);
    if (Array.isArray(o?.objects)) zbierzIdy(o.objects, zbior);
  }
  return zbior;
};

// Indeks książki dla rozwiniętego projektu (pamiętany przy ciągu – liczy się raz na złożenie).
const pamiec = new WeakMap();
let wBudowie = null; // ciąg, dla którego właśnie liczymy indeks – pola książki dają wtedy pusty tekst (bez pętli)
export const liczySieIndeks = (ciag) => wBudowie === ciag;

export function indeksKsiazki(projekt, ciag = rozwin(projekt)) {
  const zapamietany = pamiec.get(ciag);
  if (zapamietany && zapamietany.projekt === projekt) return zapamietany.indeks;
  wBudowie = ciag;
  try {
    const indeks = zbudujIndeks(projekt, ciag);
    pamiec.set(ciag, { projekt, indeks });
    return indeks;
  } finally {
    wBudowie = null;
  }
}

const jednaLinia = (t) => String(t || '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
const bezOgonkow = (t) => String(t).toLocaleLowerCase('pl');

function zbudujIndeks(projekt, ciag) {
  const poziomStylu = new Map(naglowkiProjektu(projekt).map((n) => [n.styl, n.poziom]));
  const tryb = projekt.ksiazka?.przypisy || 'sekcja';
  const naglowki = []; // { id, tekst, poziom, egz, nr }
  const gdzie = new Map(); // id elementu → pierwszy egzemplarz, na którym jest
  const przypisy = new Map(); // `${klucz egzemplarza}|${id przypisu}` → numer
  const trescPrzypisow = new Map(); // id przypisu → treść
  const naStronie = new Map(); // klucz egzemplarza → [{ id, numer }] w kolejności
  const hasla = new Map(); // hasło → Set(numerów stron)
  const wszystkieHasla = new Set();
  for (const s of projekt.strony) for (const o of teksty(s.obiekty)) for (const h of o.hasla || []) if (jednaLinia(h)) wszystkieHasla.add(jednaLinia(h));
  let licznik = 0;
  let sekcja = null;
  for (const egz of ciag.egzemplarze) {
    if (egz.pusta) continue;
    if (tryb === 'strona' || (tryb === 'sekcja' && egz.sekcja !== sekcja)) licznik = 0;
    sekcja = egz.sekcja;
    for (const id of zbierzIdy(egz.strona.obiekty, new Set())) if (!gdzie.has(id)) gdzie.set(id, egz);
    const lista = teksty(egz.strona.obiekty).sort(poKolei);
    const wartosc = wartosciPol(projekt, egz, ciag);
    const tekstNaStronie = (o) => (o.text.includes('{') && !o.bez_pol ? podstawWTekscie(o.text, null, wartosc).text : o.text);
    const tu = [];
    for (const o of lista) {
      const poziom = poziomStylu.get(o.styl);
      if (poziom && jednaLinia(o.text)) naglowki.push({ id: o.id, tekst: jednaLinia(tekstNaStronie(o)), poziom, egz, nr: egz.nr });
      if (o.przypisy) for (const [id, tresc] of Object.entries(o.przypisy)) trescPrzypisow.set(id, String(tresc ?? ''));
      if (!o.bez_pol) {
        for (const p of znajdzPola(o.text)) {
          if (p.nazwa !== 'przypis' || !p.zapis || przypisy.has(`${egz.klucz}|${p.zapis}`)) continue;
          licznik += 1;
          przypisy.set(`${egz.klucz}|${p.zapis}`, licznik);
          tu.push({ id: p.zapis, numer: licznik });
        }
      }
      if (wszystkieHasla.size && egz.nr !== null) {
        const tekst = bezOgonkow(tekstNaStronie(o));
        for (const h of wszystkieHasla) {
          if (!tekst.includes(bezOgonkow(h))) continue;
          if (!hasla.has(h)) hasla.set(h, new Set());
          hasla.get(h).add(egz.nr);
        }
      }
    }
    if (tu.length) naStronie.set(egz.klucz, tu);
  }
  for (const h of wszystkieHasla) if (!hasla.has(h)) hasla.set(h, new Set());
  return { naglowki, gdzie, przypisy, trescPrzypisow, naStronie, hasla };
}

// Wartości pól książki dla egzemplarza: (nazwa, zapis) → tekst albo undefined (to nie pole książki).
export function poleKsiazki(projekt, egz, ciag, nazwa, zapis) {
  if (nazwa !== 'rozdzial' && nazwa !== 's' && nazwa !== 'przypis') return undefined;
  if (liczySieIndeks(ciag)) return nazwa === 'przypis' ? '' : '';
  const ix = indeksKsiazki(projekt, ciag);
  if (nazwa === 's') {
    const e = zapis ? ix.gdzie.get(zapis) : null;
    return e && e.nr !== null ? String(e.nr) : '?';
  }
  if (nazwa === 'przypis') return String(ix.przypisy.get(`${egz.klucz}|${zapis}`) ?? '');
  // {rozdzial} / {rozdzial:2}: ostatni nagłówek tego poziomu na tej stronie albo przed nią.
  const poziom = Math.min(3, Math.max(1, Number(zapis) || 1));
  let wynik = '';
  for (const n of ix.naglowki) {
    if (n.egz.indeks > egz.indeks) break;
    if (n.poziom === poziom) wynik = n.tekst;
    else if (n.poziom < poziom) wynik = ''; // nowy rozdział wyższego poziomu zeruje niższy
  }
  return wynik;
}

// Przypisy egzemplarza: [{ numer, tresc }] – do obszaru przypisów na dole strony.
export function przypisyStrony(projekt, egz, ciag) {
  const ix = indeksKsiazki(projekt, ciag);
  return (ix.naStronie.get(egz.klucz) || []).map((p) => ({ numer: p.numer, tresc: ix.trescPrzypisow.get(p.id) ?? '' }));
}

const sortujPl = (a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' });

// Zakres stron: [3, 4, 5, 9] → „3–5, 9”.
export function zakresStron(numery) {
  const n = [...new Set(numery)].filter((x) => x !== null).sort((a, b) => a - b);
  const czesci = [];
  for (let i = 0; i < n.length; i += 1) {
    let j = i;
    while (j + 1 < n.length && n[j + 1] === n[j] + 1) j += 1;
    czesci.push(j - i >= 2 ? `${n[i]}–${n[j]}` : (j > i ? `${n[i]}, ${n[j]}` : String(n[i])));
    i = j;
  }
  return czesci.join(', ');
}

// Treść elementu składanego samego: tekst spisu treści albo skorowidza.
export function trescElementu(projekt, opis, ciag = rozwin(projekt)) {
  const ix = indeksKsiazki(projekt, ciag);
  if (opis?.rodzaj === 'skorowidz') {
    const wiersze = [...ix.hasla].sort(([a], [b]) => sortujPl(a, b)).map(([h, strony]) => `${h}\t${zakresStron([...strony])}`);
    return wiersze.length ? wiersze.join('\n') : 'Skorowidz jest pusty – zaznacz słowo w tekście i wybierz „Dodaj do skorowidza”.';
  }
  const poziomy = Math.min(3, Math.max(1, Math.round(opis?.poziomy) || 2));
  const wiersze = ix.naglowki.filter((n) => n.poziom <= poziomy && n.tekst)
    .map((n) => `${' '.repeat((n.poziom - 1) * 2)}${n.tekst}\t${n.nr ?? ''}`);
  return wiersze.length ? wiersze.join('\n') : 'Spis treści jest pusty – nadaj tytułom rozdziałów styl nagłówka (np. „Tytuł”).';
}

// Wszystkie elementy składane same (na stronach i we wzorcach): [{ obiekt, gdzie }].
export function elementyKsiazki(projekt) {
  const wynik = [];
  const szukaj = (obiekty, gdzie) => {
    for (const o of obiekty || []) {
      if (o?.ksiazka && typeof o.text === 'string') wynik.push({ obiekt: o, gdzie });
      else if (Array.isArray(o?.objects)) szukaj(o.objects, gdzie);
    }
  };
  for (const s of projekt.strony) szukaj(s.obiekty, s);
  for (const w of projekt.wzorce || []) szukaj(w.obiekty, w);
  return wynik;
}

// Przelicza treść spisów i skorowidzów w projekcie. Zwraca listę zmienionych stron/wzorców (ich id).
// Dwa przebiegi: dłuższy spis może przesunąć dalsze strony i zmienić ich numery.
export function przeliczKsiazke(projekt) {
  const elementy = elementyKsiazki(projekt);
  if (!elementy.length) return [];
  const zmienione = new Set();
  for (let przebieg = 0; przebieg < 2; przebieg += 1) {
    const ciag = rozwin(projekt);
    let zmiana = false;
    for (const { obiekt: o, gdzie } of elementy) {
      const tekst = trescElementu(projekt, o.ksiazka, ciag);
      const tab = [{ poz: Math.max(10, Math.round(((o.width || 100) - 0.5) * 100) / 100), rodzaj: 'prawy', wypelniacz: o.ksiazka.kropki === false ? '' : '.' }];
      if (o.text === tekst && JSON.stringify(o.tabulatory) === JSON.stringify(tab)) continue;
      o.text = tekst;
      o.styles = [];
      o.tabulatory = tab;
      // Ramki dalej w wątku oddają tekst pierwszej – przelewanie rozda go od nowa.
      if (o.watek) {
        for (const s of projekt.strony) {
          for (const x of s.obiekty) {
            if (x !== o && x.watek === o.watek && typeof x.text === 'string' && x.text) { x.text = ''; x.styles = []; zmienione.add(s.id); }
          }
        }
      }
      zmienione.add(gdzie.id);
      zmiana = true;
    }
    if (!zmiana) break;
  }
  return [...zmienione];
}

// Czy projekt używa czegokolwiek z książki (żeby nie liczyć indeksu bez potrzeby).
export function uzywaKsiazki(projekt) {
  if (elementyKsiazki(projekt).length) return true;
  const szukaj = (obiekty) => (obiekty || []).some((o) => (typeof o?.text === 'string' && /\{(rozdzial|s|przypis)[:}]/.test(o.text)) || o?.przypisy || o?.hasla?.length || (Array.isArray(o?.objects) && szukaj(o.objects)));
  return projekt.strony.some((s) => szukaj(s.obiekty)) || (projekt.wzorce || []).some((w) => szukaj(w.obiekty));
}

// Nagłówki do odsyłaczy (okno „Wstaw odsyłacz”): [{ id, tekst, poziom, nr }] – każdy element raz.
export function celeOdsylaczy(projekt) {
  const ciag = rozwin(projekt);
  const ix = indeksKsiazki(projekt, ciag);
  const byly = new Set();
  return ix.naglowki.filter((n) => (byly.has(n.id) ? false : byly.add(n.id))).map((n) => ({ id: n.id, tekst: n.tekst, poziom: n.poziom, nr: n.nr }));
}
