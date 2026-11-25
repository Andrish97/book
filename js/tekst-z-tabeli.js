/* global fabric */
// Treść z tabeli (#432): ramka tekstu (albo cały wątek połączonych ramek) z wpisem-wzorem powtórzonym dla każdego
// wiersza tabeli, jednym ciągiem – jak tekst książki płynie przez kolumny i strony (np. słowniczek, indeks, spis).
//
// Ramka źródłowa ma `z_tabeli: { tabela, wzor: { text, styles }, poczatki: [[miejsce, nr wiersza]…], odcisk, edycja? }`.
// Wzór to zwykły tekst z polami w klamrach ({haslo}, {opis}) i formatowaniem fragmentów; pola tabeli dostają wartości
// z kolejnych wierszy, inne pola ({nr}) zostają do podstawienia na stronie. `edycja` – wzór jest w ramce do poprawienia,
// treść z tabeli wstrzymana. Wiersze pomijane („[pomiń]”) nie dają wpisów.

import { podstawWObiektach } from './pola.js';
import { polaczCzesci, rozlej, watkiProjektu } from './watki.js';

const POMIJANY = /^\[\s*(pomi[nń]|skip|пропустити|пропуск)\s*\]$/i;

function wartoscWiersza(tabela, wiersz) {
  return (nazwa) => {
    const n = String(nazwa).trim();
    const przedrostek = `${tabela.nazwa.trim().toLowerCase()}.`;
    const kolumna = n.toLowerCase().startsWith(przedrostek) ? n.slice(przedrostek.length).trim() : n;
    const k = tabela.kolumny.indexOf(kolumna);
    return k < 0 ? undefined : String(wiersz[k] ?? '');
  };
}

// Prosty odcisk treści (do sprawdzenia, czy trzeba ułożyć tekst od nowa).
const odcisk = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return `${s.length}:${h >>> 0}`;
};

// { text, styles, poczatki } – cała treść z tabeli dla ramki źródłowej (zapis projektu), null bez tabeli albo wzoru.
export function trescZTabeli(projekt, zrodlo) {
  const ust = zrodlo?.z_tabeli;
  const tabela = ust && (projekt.tabele || []).find((t) => t.id === ust.tabela);
  if (!tabela || !ust.wzor || typeof ust.wzor.text !== 'string') return null;
  const czesci = [];
  const poczatki = [];
  let poz = 0;
  let bylo = false;
  tabela.wiersze.forEach((w, nr) => {
    if (POMIJANY.test(String(w?.[0] ?? '').trim())) return;
    const [o] = podstawWObiektach([{ type: 'textbox', zasady_pl: zrodlo.zasady_pl, znaki_bez_zmian: zrodlo.znaki_bez_zmian, text: ust.wzor.text, styles: ust.wzor.styles || [] }], wartoscWiersza(tabela, w));
    const text = o.text || '';
    if (!text) return;
    if (bylo) poz += 1;
    poczatki.push([poz, nr]);
    poz += text.length;
    bylo = true;
    czesci.push({ text, styles: Array.isArray(o.styles) ? o.styles : [], lacznik: '\n' });
  });
  const { text, styles } = polaczCzesci(czesci);
  return { text, styles, poczatki, odcisk: odcisk(`${text}\u0000${JSON.stringify(styles)}`) };
}

const zywe = (lista) => fabric.util.enlivenObjects(lista.map((o) => JSON.parse(JSON.stringify(o))));

// Układa od nowa treść z tabeli we wszystkich ramkach projektu, których tabela albo wzór się zmieniły. Zwraca
// identyfikatory zmienionych stron. Wątek: cała treść trafia do pierwszej ramki i przelewa się dalej (jak po zmianie
// kolejności stron); „Dokładaj strony” dokłada potem brakujące strony w edytorze.
export async function odswiezTekstyZTabel(projekt) {
  const zmienione = new Set();
  const watki = watkiProjektu(projekt);
  for (const strona of projekt.strony) {
    for (const o of strona.obiekty || []) {
      if (o?.type !== 'textbox' || !o.z_tabeli?.tabela || o.z_tabeli.edycja) continue;
      if (o.watek && watki.get(o.watek)?.find((r) => r.o.z_tabeli)?.o !== o) continue; // jedno źródło na wątek – pierwsze
      const nowa = trescZTabeli(projekt, o);
      if (!nowa) continue;
      const ramki = o.watek ? (watki.get(o.watek) || [{ strona, o }]) : [{ strona, o }];
      const obecna = polaczCzesci(ramki.map((r, i) => ({ text: r.o.text || '', styles: Array.isArray(r.o.styles) ? r.o.styles : [], lacznik: i ? (r.o.lacznik ?? '\n') : '' })));
      o.z_tabeli.poczatki = nowa.poczatki;
      if (obecna.text === nowa.text && o.z_tabeli.odcisk === nowa.odcisk) continue;
      o.z_tabeli.odcisk = nowa.odcisk;
      ramki.forEach((r, i) => {
        r.o.text = i ? '' : nowa.text;
        r.o.styles = i ? [] : nowa.styles;
        if (i) r.o.lacznik = '\n'; else delete r.o.lacznik;
        delete r.o.lista_start;
        zmienione.add(r.strona.id);
      });
      if (ramki.length < 2 || typeof fabric === 'undefined') continue;
      const z = await zywe(ramki.map((r) => r.o));
      if (z.length !== ramki.length) continue; // przeleje się przy otwarciu strony
      rozlej(z);
      ramki.forEach((r, i) => {
        r.o.text = z[i].text;
        r.o.styles = fabric.util.stylesToArray(z[i].styles || {}, z[i].text);
        for (const k of ['lacznik', 'lista_start']) { if (z[i][k] === undefined) delete r.o[k]; else r.o[k] = z[i][k]; }
      });
    }
  }
  return [...zmienione];
}

// Wątek ramki (zapis projektu): ramki w kolejności i ta ze źródłem treści z tabeli.
export function zrodloWatku(projekt, o) {
  if (!o) return null;
  if (!o.watek) return o.z_tabeli ? o : null;
  return watkiProjektu(projekt).get(o.watek)?.find((r) => r.o.z_tabeli)?.o || null;
}
