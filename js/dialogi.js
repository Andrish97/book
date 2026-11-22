// Dialogi z tabeli (#361, plan komiksu A5): scenariusz jako tabela (strona, kadr, postać, tekst, rodzaj dymka) –
// dymki stają same na stronach, wystarczy je przesunąć. Każdy dymek pamięta swoje miejsce w scenariuszu
// (z_dialogu: { tabela, klucz: „strona|kadr|postać|która kwestia tej postaci w kadrze”, wiersz }) – nie numer wiersza,
// więc dopisanie albo usunięcie wiersza nie przenosi tekstu do cudzego dymka. Ponowne wstawienie po poprawce
// scenariusza zmienia tylko tekst i rodzaj – przesunięte dymki zostają na miejscu, nowe kwestie dochodzą, usunięte znikają.
//
// Kadr: element z polem `kadr_nr` (numer kadru na stronie, #362) wyznacza miejsce dymków tego kadru; bez kadrów strona
// dzieli się na pasy według numerów kadrów z tabeli (kadr 1 – górny pas itd.). Wersje językowe: kolumna tekstu do
// wyboru (np. tekst_en) – ten sam układ, inny tekst.

import { domyslnyDymek, RODZAJE_DYMKA } from './dymek.js';

const bezOgonkow = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().trim();
const KOLUMNY = {
  strona: ['strona', 'page', 'str', 'сторінка'],
  kadr: ['kadr', 'panel', 'кадр'],
  postac: ['postac', 'character', 'kto', 'персонаж'],
  tekst: ['tekst', 'text', 'dialog', 'kwestia', 'текст'],
  rodzaj: ['rodzaj', 'typ', 'dymek', 'type', 'kind', 'balloon', 'bubble', 'тип', 'вид'],
};
const RODZAJE_Z_NAZW = { mowa: 'mowa', speech: 'mowa', mysl: 'mysl', thought: 'mysl', krzyk: 'krzyk', shout: 'krzyk', szept: 'szept', whisper: 'szept', narracja: 'narracja', narration: 'narracja', caption: 'narracja', opis: 'narracja', мова: 'mowa', думка: 'mysl', крик: 'krzyk', шепіт: 'szept', оповідь: 'narracja' };

// Które kolumny tabeli to strona, kadr, postać, tekst, rodzaj (po nazwach w kilku językach); kolumna tekstu może być podana.
export function kolumnyDialogu(tabela, kolumnaTekstu = null) {
  const nazwy = tabela.kolumny.map(bezOgonkow);
  const znajdz = (warianty) => nazwy.findIndex((n) => warianty.includes(n));
  const k = Object.fromEntries(Object.entries(KOLUMNY).map(([pole, w]) => [pole, znajdz(w)]));
  if (kolumnaTekstu) k.tekst = tabela.kolumny.indexOf(kolumnaTekstu);
  if (k.tekst < 0) k.tekst = nazwy.findIndex((n) => /^tekst_|^text_/.test(n));
  return k;
}

// Kolumny tekstu do wyboru (wersje językowe): „tekst”, „tekst_pl”, „tekst_en”…
export const kolumnyTekstu = (tabela) => tabela.kolumny.filter((n) => /^(tekst|text|dialog|kwestia)(_\w+)?$/i.test(bezOgonkow(n)));

// Obszar dymków kadru nr `kadr` na stronie: kadr z pola `kadr_nr`, inaczej pas strony.
function obszarKadru(strona, kadr, ileKadrow, wymiary) {
  const ramka = (strona.obiekty || []).find((o) => Number(o.kadr_nr) === kadr);
  if (ramka) {
    const w = (ramka.width || 0) * Math.abs(ramka.scaleX ?? 1); const h = (ramka.height || 0) * Math.abs(ramka.scaleY ?? 1);
    return { x: ramka.left || 0, y: ramka.top || 0, w, h };
  }
  const { lewy, gora, szer, wys } = wymiary;
  const pas = wys / Math.max(1, ileKadrow);
  return { x: lewy, y: gora + pas * (kadr - 1), w: szer, h: pas };
}

// Dymki z tabeli: zwraca { dodane, zmienione, usuniete, pominiete: [opis] }; zmienia projekt w miejscu.
// wymiaryStrony(strona) → { lewy, gora, szer, wys } – obszar w marginesach (mm).
export function dymkiZTabeli(projekt, tabela, { kolumnaTekstu = null, wymiaryStrony, noweId }) {
  const k = kolumnyDialogu(tabela, kolumnaTekstu);
  const wynik = { dodane: 0, zmienione: 0, usuniete: 0, pominiete: [] };
  if (k.strona < 0 || k.tekst < 0) throw new Error('W tabeli brakuje kolumny „strona” albo „tekst”.');
  const strony = projekt.strony;
  // wiersze → strona, kadr
  const wiersze = tabela.wiersze.map((w, nr) => ({
    nr,
    strona: parseInt(w[k.strona], 10),
    kadr: k.kadr >= 0 ? Math.max(1, parseInt(w[k.kadr], 10) || 1) : 1,
    postac: k.postac >= 0 ? String(w[k.postac] || '').trim() : '',
    tekst: String(w[k.tekst] ?? '').trim(),
    rodzaj: RODZAJE_Z_NAZW[bezOgonkow(k.rodzaj >= 0 ? w[k.rodzaj] : '')] || 'mowa',
  })).filter((w) => w.tekst);
  const uzyte = new Set();
  // Kadry na stronie: ile kadrów (do pasów) i kolejny dymek w kadrze (żeby nie stawały jeden na drugim).
  const ileKadrow = new Map();
  for (const w of wiersze) ileKadrow.set(w.strona, Math.max(ileKadrow.get(w.strona) || 0, w.kadr));
  const wKadrze = new Map();
  const kwestie = new Map();
  for (const w of wiersze) {
    const kp = `${w.strona}|${w.kadr}|${bezOgonkow(w.postac)}`;
    const ktora = kwestie.get(kp) || 0;
    kwestie.set(kp, ktora + 1);
    w.klucz = `${kp}|${ktora}`;
  }
  for (const w of wiersze) {
    const strona = strony[w.strona - 1];
    if (!strona) { wynik.pominiete.push(`wiersz ${w.nr + 1}: nie ma strony ${w.strona}`); continue; }
    strona.obiekty = strona.obiekty || [];
    const istniejacy = strona.obiekty.find((o) => o.z_dialogu?.tabela === tabela.id && o.z_dialogu?.klucz === w.klucz);
    const nazwa = w.postac ? `Dymek – ${w.postac}` : 'Dymek';
    if (istniejacy) {
      uzyte.add(istniejacy);
      istniejacy.z_dialogu = { tabela: tabela.id, klucz: w.klucz, wiersz: w.nr };
      if (istniejacy.text !== w.tekst || istniejacy.dymek?.rodzaj !== w.rodzaj) {
        istniejacy.text = w.tekst;
        istniejacy.styles = [];
        istniejacy.dymek = domyslnyDymek({ ...istniejacy.dymek, rodzaj: w.rodzaj });
        istniejacy.nazwa = nazwa;
        wynik.zmienione += 1;
      }
      continue;
    }
    const klucz = `${w.strona}|${w.kadr}`;
    const nr = wKadrze.get(klucz) || 0;
    wKadrze.set(klucz, nr + 1);
    const obszar = obszarKadru(strona, w.kadr, ileKadrow.get(w.strona), wymiaryStrony(strona));
    const szer = Math.min(55, Math.max(24, obszar.w * 0.42));
    // kolejne dymki kadru: na zmianę z lewej i z prawej, schodkami w dół (czytanie od lewej do prawej)
    const left = obszar.x + 3 + (nr % 2 ? obszar.w - szer - 6 : 0);
    const top = obszar.y + 3 + nr * Math.min(14, obszar.h / 4);
    const d = {
      type: 'textbox', id: noweId(), left, top, width: szer, text: w.tekst, styles: [],
      fontFamily: 'Comic Neue', fontSize: Math.round((10 * 25.4 / 72) * 1000) / 1000, fontWeight: w.rodzaj === 'krzyk' ? 'bold' : 'normal',
      fill: '#1a1a1a', lineHeight: 1.1, textAlign: w.rodzaj === 'narracja' ? 'left' : 'center', strokeWidth: 0,
      wielkosc_liter: 'wielkie', spojniki: true, zasady_pl: true, nazwa,
      dymek: domyslnyDymek({ rodzaj: w.rodzaj, ogonek: w.rodzaj === 'narracja' ? null : { x: szer * (nr % 2 ? 0.7 : 0.3), y: Math.min(28, obszar.h * 0.45) } }),
      z_dialogu: { tabela: tabela.id, klucz: w.klucz, wiersz: w.nr },
    };
    strona.obiekty.push(d);
    uzyte.add(d);
    wynik.dodane += 1;
  }
  // Dymki z wierszy, których już nie ma (albo bez tekstu) – znikają.
  for (const s of strony) {
    const przed = (s.obiekty || []).length;
    s.obiekty = (s.obiekty || []).filter((o) => o.z_dialogu?.tabela !== tabela.id || uzyte.has(o));
    wynik.usuniete += przed - s.obiekty.length;
  }
  return wynik;
}

export { RODZAJE_DYMKA };
