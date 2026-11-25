/* global fabric */
// Przelewanie wątku tekstu bez edytora (#436) – ten sam kod co w edytorze (watki.js rozlej, sklad.js, tekst-ramka.js),
// więc ten sam podział: na serwerze (przeglądarka rysująca, rysuj.html) po zmianach z MCP, w czacie AI w aplikacji
// i w edytorze dla ramek z innych stron. Działa na zapisie projektu (JSON), zwraca nowe części ramek i raport.
//
// Każda ramka składa się w warunkach swojej strony: bok rozkładówki (wyrównanie łamów), przeszkody oblewania
// (elementy strony i jej wzorców z `oblewanie`) i siatka bazowa sekcji – tak jak na płótnie edytora.

import './fabric-ustawienia.js';
import './tekst-ramka.js';
import { rozlej, watkiProjektu, akapitTytulem } from './watki.js';
import { ulozStrone } from './sklad.js';
import { sekcjaStrony, wzorceStrony } from './projekt.js';
import { rozwin, bokStrony } from './serie.js';
import { zapewnijCzcionki } from './czcionki.js';
import { zaladujDzielenie, uzywaDzielenia } from './dzielenie.js';
import { nieMiesciSie } from './tekst-ramka.js';

const kopia = (o) => JSON.parse(JSON.stringify(o));

// Pola ramki zapisywane po przelaniu (jak edytor przy zapisie ramek z innych stron).
export const POLA_PRZELANIA = ['text', 'styles', 'lacznik', 'lista_start'];
const polaRamki = (o) => ({ text: o.text, styles: fabric.util.stylesToArray(o.styles || {}, o.text), lacznik: o.lacznik, lista_start: o.lista_start });

// Odbicie elementu wzorca na lewej stronie (wzorzec z lustrem) – jak warstwyWzorcow w zlozenie.js.
function odbij(o, szerokosc) {
  const w = (o.width || 0) * (o.scaleX || 1);
  o.set({ left: szerokosc - (o.left || 0) - (o.originX === 'center' ? 0 : w), flipX: !o.flipX });
}

// Przeszkody oblewania strony (żywe obiekty, tylko z `oblewanie`): elementy strony i jej wzorców.
async function przeszkodyStrony(projekt, strona, bok) {
  const json = (strona.obiekty || []).filter((o) => o?.oblewanie && o.type !== 'textbox' && o.visible !== false).map(kopia);
  const zWzorcow = [];
  const szerokosc = sekcjaStrony(projekt, strona)?.wydruk?.szerokosc_mm || 0;
  for (const w of wzorceStrony(projekt, strona)) {
    for (const o of w.obiekty || []) if (o?.oblewanie && o.type !== 'textbox' && o.visible !== false) zWzorcow.push({ o: kopia(o), lustro: w.lustro && bok === 'lewa' });
  }
  if (!json.length && !zWzorcow.length) return [];
  const zywe = await fabric.util.enlivenObjects([...json, ...zWzorcow.map((x) => x.o)]);
  zywe.slice(json.length).forEach((o, i) => { if (zWzorcow[i].lustro) odbij(o, szerokosc); });
  return zywe;
}

// Żywe ramki wątku w kolejności, ułożone w warunkach swoich stron: [{ strona, o }].
export async function ramkiWatku(projekt, idWatku, { ciag = rozwin(projekt) } = {}) {
  const lista = watkiProjektu(projekt).get(idWatku) || [];
  if (!lista.length) return [];
  if (lista.some((r) => uzywaDzielenia([r.o]))) await zaladujDzielenie();
  const json = lista.map((r) => kopia(r.o));
  await zapewnijCzcionki(json);
  const zywe = await fabric.util.enlivenObjects(json);
  const wynik = lista.map((r, i) => ({ strona: r.strona, o: zywe[i] }));
  await ulozWWarunkachStron(projekt, wynik, { ciag });
  return wynik;
}

// Żywe ramki (np. ramki wątku z innych stron w edytorze) w warunkach swoich stron: bok rozkładówki, przeszkody
// oblewania i siatka bazowa – tak jak ramki na płótnie. wpisy: [{ strona (obiekt strony), o }].
export async function ulozWWarunkachStron(projekt, wpisy, { ciag = rozwin(projekt) } = {}) {
  const strony = [...new Set(wpisy.map((r) => r.strona).filter(Boolean))];
  for (const strona of strony) {
    const bok = strona.bok_ukladu || bokStrony(strona, ciag);
    const ramki = wpisy.filter((r) => r.strona === strona).map((r) => r.o);
    for (const o of ramki) o._bok = bok; // wyrównanie łamów (#327)
    const przeszkody = await przeszkodyStrony(projekt, strona, bok);
    const siatka = sekcjaStrony(projekt, strona)?.wydruk?.siatka_bazowa || null;
    if (przeszkody.length || siatka) ulozStrone([...przeszkody, ...ramki], { siatka });
  }
}

// Pierwsze i ostatnie słowa tekstu.
const slowa = (t, ile = 4) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!s.length) return { poczatek: '', koniec: '' };
  return { poczatek: s.slice(0, ile).join(' '), koniec: s.slice(-ile).join(' ') };
};

// Raport wątku po przelaniu (żywe ramki): ramki z pierwszymi i ostatnimi słowami, przepełnienie (co nie mieści się
// w ostatniej ramce) i podzielone akapity (z oceną: wbrew wdowom/sierotom, tytuł oddzielony od treści).
export function raportWatku(ramki) {
  const wynik = { ramki: [], przepelnienie: null, podzielone: [], tytulNaKoncu: [] };
  ramki.forEach(({ strona, o }, i) => {
    wynik.ramki.push({ nr: i + 1, strona: strona.id, nazwaStrony: strona.nazwa, id: o.id, wierszy: o._textLines?.length || 0, pusta: !o.text, ...slowa(o.text) });
    const nast = ramki[i + 1]?.o;
    // Akapit przecięty granicą ramek: następna ramka zaczyna się w środku akapitu (łącznik inny niż nowy akapit).
    if (nast && o.text && nast.text && (nast.lacznik ?? '\n') !== '\n') {
      const ostatni = o._unwrappedTextLines.length - 1;
      const przed = Object.values(o._styleMap || {}).filter((m) => m.line === ostatni).length;
      const po = Object.values(nast._styleMap || {}).filter((m) => m.line === 0).length;
      const min = Math.round(o.wdowy || 0);
      const wbrew = [];
      if (min >= 2 && przed < min) wbrew.push('sierota');
      if (min >= 2 && po < min) wbrew.push('wdowa');
      if (nast.lacznik === '') wbrew.push('wyraz podzielony');
      wynik.podzielone.push({ miedzy: [i + 1, i + 2], wierszyPrzed: przed, wierszyPo: po, wbrew, koniec: slowa(o.text).koniec, poczatek: slowa(nast.text).poczatek });
    }
    // Tytuł (nagłówek hasła) jako ostatni akapit ramki, a treść już w następnej.
    if (nast && o.text && (nast.lacznik ?? '\n') === '\n' && nast.text) {
      const ostatni = (o._unwrappedTextLines?.length || 1) - 1;
      if (akapitTytulem(o, ostatni)) wynik.tytulNaKoncu.push({ ramka: i + 1, tytul: o._unwrappedTextLines[ostatni].join('').trim() });
    }
  });
  const ostatnia = ramki.at(-1)?.o;
  if (ostatnia && nieMiesciSie(ostatnia)) {
    // Wiersze, które wychodzą poza stałą wysokość ostatniej ramki.
    let h = 0; let k = 0;
    for (let i = 0; i < ostatnia._textLines.length; i += 1) {
      const wiersz = ostatnia.getHeightOfLine(i);
      if (h + wiersz / ostatnia.lineHeight > ostatnia.ramka_h + 0.01) break;
      h += wiersz; k = i + 1;
    }
    const uciete = ostatnia._textLines.slice(k).map((l) => l.join('')).join(' ');
    wynik.przepelnienie = { wierszy: ostatnia._textLines.length - k, znakow: uciete.length, poczatek: slowa(uciete, 6).poczatek, koniec: slowa(uciete).koniec };
  }
  return wynik;
}

// Przelewa wątek projektu (zapis JSON) i zwraca { zmiany: [{ strona, id, pola }], raport }.
// suchy – tylko liczy (raport), zmiany bez zapisu do projektu; bez – wpisuje nowe części do ramek projektu.
export async function przelejWatek(projekt, idWatku, { suchy = false, ciag } = {}) {
  const ramki = await ramkiWatku(projekt, idWatku, { ciag });
  if (ramki.length < 2) return { zmiany: [], raport: ramki.length ? raportWatku(ramki) : null };
  rozlej(ramki.map((r) => r.o));
  const zmiany = [];
  const lista = watkiProjektu(projekt).get(idWatku);
  ramki.forEach((r, i) => {
    const pola = polaRamki(r.o);
    const zapis = lista[i].o;
    const bylo = JSON.stringify(POLA_PRZELANIA.map((k) => (k === 'styles' ? (Array.isArray(zapis.styles) ? zapis.styles : []) : zapis[k])));
    const jest = JSON.stringify(POLA_PRZELANIA.map((k) => pola[k]));
    if (bylo === jest) return;
    zmiany.push({ strona: r.strona.id, id: r.o.id, pola });
    if (!suchy) for (const k of POLA_PRZELANIA) { if (pola[k] === undefined) delete zapis[k]; else zapis[k] = pola[k]; }
  });
  return { zmiany, raport: raportWatku(ramki) };
}

// Wątki, których dotyczą podane ramki (id) – do przelania po zmianie.
export function watkiRamek(projekt, idRamek) {
  const ids = new Set(idRamek);
  const wynik = new Set();
  for (const s of projekt.strony) for (const o of s.obiekty || []) if (o?.type === 'textbox' && o.watek && ids.has(o.id)) wynik.add(o.watek);
  return [...wynik];
}

// Raport w kilku linijkach (odpowiedź narzędzia MCP).
export function opisRaportu(idWatku, raport) {
  if (!raport) return `Wątek ${idWatku}: brak ramek.`;
  const l = [`Wątek ${idWatku}: ${raport.ramki.length} ramek.`];
  for (const r of raport.ramki) l.push(`  ${r.nr}. ${r.nazwaStrony || r.strona}: ${r.pusta ? '(pusta)' : `„${r.poczatek} … ${r.koniec}” (${r.wierszy} wierszy)`}`);
  l.push(raport.przepelnienie ? `  NIE MIEŚCI SIĘ: ${raport.przepelnienie.wierszy} wierszy poza ostatnią ramką – od „${raport.przepelnienie.poczatek}” do „${raport.przepelnienie.koniec}”.` : '  Cały tekst się mieści.');
  const zle = raport.podzielone.filter((p) => p.wbrew.length);
  if (raport.podzielone.length) l.push(`  Akapity podzielone między ramki: ${raport.podzielone.map((p) => `${p.miedzy.join('→')} (${p.wierszyPrzed}+${p.wierszyPo} wierszy${p.wbrew.length ? `, wbrew: ${p.wbrew.join(', ')}` : ''})`).join('; ')}.`);
  if (zle.length) l.push(`  UWAGA: ${zle.length} podział(ów) wbrew ustawieniom.`);
  for (const t of raport.tytulNaKoncu) l.push(`  UWAGA: tytuł „${t.tytul}” na końcu ramki ${t.ramka}, treść w następnej.`);
  return l.join('\n');
}
