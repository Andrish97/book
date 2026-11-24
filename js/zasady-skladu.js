// Polskie zasady składu (PN-83/P-55366, PN-70/P-55036) – czego nie rozdziela się na granicy wierszy (#323).
// Opcja tekstu `zasady_pl` (jak „polskie zasady” w programach DTP): między takimi wyrazami wiersz się nie łamie –
// pierwszy z nich przechodzi do następnego wiersza razem z drugim. Ta sama lista służy kontroli składu
// (ostrzeżenia o miejscach niezgodnych z zasadami, gdy opcja jest wyłączona).

import { t as tt } from './jezyk.js';
import { ustawPoprawiaczWartosci } from './pola.js';

// Jednoliterowe spójniki i przyimki – nie zostają na końcu wiersza.
export const JEDNOLITEROWE = new Set(['a', 'i', 'o', 'u', 'w', 'z']);
// Dwuliterowe – dobra praktyka: też nie na końcu wiersza (ustawienie tekstu „Spójniki: także do, na, ze…”).
export const DWULITEROWE = new Set(['do', 'na', 'od', 'po', 'we', 'za', 'ze', 'że', 'iż', 'ku', 'bo', 'by', 'ni']);
// Polskie zasady składu są włączone, dopóki ktoś ich wyraźnie nie wyłączy (#424): także w starszych tekstach i tekstach
// od AI – krótkie słówka przechodzą do następnego wiersza same, bez twardych spacji.
export const zasadyPl = (o) => Boolean(o) && o.zasady_pl !== false;

// Skróty, po których wiersz się nie łamie (skrót zostaje z następnym wyrazem albo liczbą).
export const SKROTY = new Set([
  'np.', 'tj.', 'tzn.', 'tzw.', 'ok.', 'ul.', 'al.', 'pl.', 'os.', 'nr', 'nr.', 'str.', 's.', 'pkt', 'pkt.', 'poz.',
  'art.', 'ust.', 'par.', '§', 'rozdz.', 'rys.', 'ryc.', 'tab.', 'il.', 'zob.', 'por.', 'godz.', 'tel.', 'woj.',
  'gm.', 'pow.', 'im.', 'św.', 'ks.', 'bp', 'abp', 'prof.', 'dr', 'dr.', 'mgr', 'inż.', 'hab.', 'doc.', 'red.',
  'wyd.', 'gen.', 'płk', 'mjr', 'kpt.', 'por.', 'ppor.', 'sierż.', 'kpr.', 'szer.', 'p.', 'pp.', 'o.', 'ss.',
  'mec.', 'adw.', 'lek.', 'dyr.', 'kier.', 'prez.', 'min.', 'pos.', 'sen.', 'burm.', 'sołt.', 'jw.', 'wg', 'ww.',
]);

// Jednostki i oznaczenia stojące po liczbie – liczba nie zostaje sama na końcu wiersza.
const JEDNOSTKA = /^(%|‰|°|°C|°F|zł|gr|kg|dag|g|mg|t|km|m|cm|mm|dm|µm|ha|a|l|ml|hl|h|min|s|ms|tys\.?|mln|mld|bln|r\.|w\.|wiek|proc\.|szt\.|egz\.|str\.|s\.|pkt|€|\$|£|PLN|EUR|USD|GBP|CHF|zł\.|m²|m³|km²|kWh|kW|W|V|A|Hz|MHz|GHz|MB|GB|TB|KB|px|pt|dpi|stron|osób|lat|dni)[.,;:!?)”]*$/;
const MIESIACE = /^(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia|styczeń|luty|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień)[.,;:!?)”]*$/i;
const LICZBA = /^[(„"]?[-−+]?\d+([.,]\d+)?$/;
const GRUPA_CYFR = /^\d{3}([.,]\d+)?[.,;:!?)”]*$/;
const INICJAL = /^[(„"]?(\p{Lu}\.){1,3}$/u; // J. – J.R. – J.R.R.
const MYSLNIK = /^[–—]/;
const RZYMSKA = /^[IVXLCDM]+$/;

const bezOtwarcia = (s) => s.replace(/^[(„"'«[]+/, '');

// Czy między wyrazami `a` i `b` (sąsiednimi w akapicie) nie wolno złamać wiersza – i z jakiego powodu.
// opcje: { spojniki: true | 'dwuliterowe', dwuliterowe: Set } – spójniki według ustawienia tekstu.
export function powodWiazania(a, b, { jednoliterowe = true } = {}) {
  if (!a || !b) return null;
  const al = bezOtwarcia(a).toLocaleLowerCase('pl');
  if (jednoliterowe && JEDNOLITEROWE.has(al)) return 'spojnik';
  if (SKROTY.has(al) || SKROTY.has(bezOtwarcia(a))) return 'skrot';
  if (INICJAL.test(a)) return 'inicjal';
  if (LICZBA.test(a) && (JEDNOSTKA.test(b) || GRUPA_CYFR.test(b) || MIESIACE.test(b))) return 'liczba';
  if (RZYMSKA.test(a) && /^(w\.|wiek|wieku|wiekiem)[.,;:!?)”]*$/.test(b)) return 'liczba';
  if (MYSLNIK.test(b)) return 'myslnik';
  return null;
}

export const OPIS_POWODU = {
  spojnik: 'jednoliterowy spójnik albo przyimek na końcu wiersza',
  dwuliterowy: 'dwuliterowy spójnik albo przyimek na końcu wiersza (włącz „Polskie zasady składu” w panelu tekstu)',
  skrot: 'skrót oddzielony od następnego wyrazu',
  inicjal: 'inicjał oddzielony od nazwiska',
  liczba: 'liczba oddzielona od jednostki, daty albo dalszych cyfr',
  myslnik: 'myślnik na początku wiersza',
  laczniki: 'więcej niż 3 dzielone wiersze pod rząd',
  ostatni_dzielony: 'podzielony ostatni wyraz akapitu',
  krotki_wiersz: 'bardzo krótki ostatni wiersz akapitu (jeden krótki wyraz)',
  luzny: 'rozstrzelony wiersz (bardzo duże odstępy przy justowaniu – włącz dzielenie wyrazów)',
};

// ---------- Kontrola składu (#323): miejsca niezgodne z zasadami ----------

// Znaki w treści: [{ kod, opis, ile }].
const ZNAKI = [
  ['cudzyslow', /"/g, 'cudzysłów prosty " zamiast polskiego „…”'],
  ['dywiz', / - /g, 'dywiz między spacjami zamiast półpauzy (–)'],
  ['kropki', /\.\.\./g, 'trzy kropki zamiast wielokropka (…)'],
  ['spacje', / {2,}/g, 'podwójne spacje'],
  ['przed_interpunkcja', / [,.;:!?)”](?!\.)/g, 'spacja przed przecinkiem, kropką albo nawiasem zamykającym'],
  ['po_otwarciu', /[(„] /g, 'spacja po nawiasie albo cudzysłowie otwierającym'],
];
export function uwagiZnakow(tekst) {
  const t = String(tekst || '').replace(/\{[^}]*\}/g, 'X'); // pole z danymi – jak wyraz (puste usunięcie dawało fałszywe „podwójne spacje”, #417)
  const wynik = [];
  for (const [kod, re, opis] of ZNAKI) {
    const ile = (t.match(re) || []).length;
    if (ile) wynik.push({ kod, opis: tt(opis), ile });
  }
  return wynik;
}

// Złamania wierszy niezgodne z zasadami w złożonym tekście (Fabric: _textLines + isEndOfWrapping):
// [{ kod: 'lamanie', powod, opis, przyklad }]. Bez przypadków nieuniknionych (wiersz z jednym wyrazem).
export function uwagiLamania(o) {
  const linie = o?._textLines;
  if (!Array.isArray(linie) || linie.length < 2) return [];
  const wynik = new Map();
  const dodaj = (powod, przyklad) => { const w = wynik.get(powod) || { kod: 'lamanie', powod, opis: tt(OPIS_POWODU[powod]), ile: 0, przyklad }; w.ile += 1; wynik.set(powod, w); };
  const koniecAkapitu = (i) => typeof o.isEndOfWrapping === 'function' && o.isEndOfWrapping(i);
  let pod = 0;
  for (let i = 0; i < linie.length; i += 1) {
    pod = linie[i].lacznik ? pod + 1 : 0;
    if (linie[i].luzny) dodaj('luzny', linie[i].join('').trim().split(/\s+/).slice(0, 3).join(' ') + '…');
    if (pod === 4) dodaj('laczniki', '');
    // zawieszka: ostatni wiersz wielowierszowego akapitu to jeden krótki wyraz (do 5 liter – „dzień.”, „domu”)
    if (koniecAkapitu(i) && i > 0 && !koniecAkapitu(i - 1)) {
      const sl = linie[i].join('').trim().split(/\s+/);
      if (sl.length === 1 && sl[0].replace(/[^\p{L}\d]/gu, '').length > 0 && sl[0].replace(/[^\p{L}\d]/gu, '').length < 6) dodaj('krotki_wiersz', sl[0]);
    }
    if (linie[i].lacznik && i + 1 < linie.length && koniecAkapitu(i + 1) && linie[i + 1].join('').trim().split(/\s+/).length === 1) dodaj('ostatni_dzielony', `${linie[i].join('').trim().split(/\s+/).at(-1)}-`);
  }
  for (let i = 0; i < linie.length - 1; i += 1) {
    if (koniecAkapitu(i)) continue; // koniec akapitu
    if (linie[i].lacznik) continue; // wyraz dzielony – to nie granica wyrazów
    const a = linie[i].join('').trim().split(/\s+/);
    const b = linie[i + 1].join('').trim().split(/\s+/);
    const powod = powodWiazania(a.at(-1), b[0], { jednoliterowe: true })
      || (!zasadyPl(o) && o.spojniki !== 'dwuliterowe' && DWULITEROWE.has(a.at(-1).toLocaleLowerCase('pl')) ? 'dwuliterowy' : null);
    if (!powod || a.length < 2) continue; // jeden wyraz w wierszu – złamania nie da się uniknąć
    dodaj(powod, `${a.at(-1)} | ${b[0]}`);
  }
  return [...wynik.values()];
}

// Wszystkie uwagi do tekstu – bez wyciszonych (bez_ostrzezen) i gdy tekst ma wyłączoną kontrolę.
export function uwagiSkladuTekstu(o) {
  if (!o || o.bez_ostrzezen || o.bez_kontroli_skladu) return [];
  return [...uwagiLamania(o), ...uwagiZnakow(o.text)];
}

// Poprawki znaków (#323): [{ od, do, na }] – od końca tekstu (żeby indeksy się nie przesuwały przy stosowaniu).
// Cudzysłów prosty → „ (na początku wyrazu) albo ” (na końcu), dywiz między spacjami → półpauza, trzy kropki →
// wielokropek, podwójne spacje → jedna, spacja przed , . ; : ! ? ) ” – usunięta, spacja po ( „ – usunięta.
export function poprawkiZnakow(tekst) {
  const t = String(tekst || '');
  const pola = [];
  for (const m of t.matchAll(/\{[^}]*\}/g)) pola.push([m.index, m.index + m[0].length]);
  const wPolu = (i) => pola.some(([a, b]) => i >= a && i < b);
  const zmiany = [];
  for (let i = 0; i < t.length; i += 1) {
    if (wPolu(i)) continue;
    const c = t[i];
    if (c === '"') { const przed = i === 0 ? ' ' : t[i - 1]; zmiany.push({ od: i, do: i + 1, na: /[\s(\[–—/]/.test(przed) ? '„' : '”' }); }
    else if (c === '-' && t[i - 1] === ' ' && t[i + 1] === ' ') zmiany.push({ od: i, do: i + 1, na: '–' });
    else if (c === '.' && t[i + 1] === '.' && t[i + 2] === '.' && t[i + 3] !== '.') { zmiany.push({ od: i, do: i + 3, na: '…' }); i += 2; }
    else if (c === ' ' && t[i + 1] === ' ') { let j = i + 1; while (t[j] === ' ') j += 1; zmiany.push({ od: i + 1, do: j, na: '' }); i = j - 1; }
    else if (c === ' ' && (/[,;:!?)”]/.test(t[i + 1] || '') || (t[i + 1] === '.' && t[i + 2] !== '.' && !/\d/.test(t[i + 2] || ''))) && i > 0 && t[i - 1] !== '\n') zmiany.push({ od: i, do: i + 1, na: '' });
    else if (c === ' ' && /[(„]/.test(t[i - 1] || '')) zmiany.push({ od: i, do: i + 1, na: '' });
  }
  return zmiany.reverse();
}

// Tekst z poprawionymi znakami (#424) – np. wartość z tabeli wstawiana w tekst z polskimi zasadami.
export function poprawioneZnaki(tekst) {
  let t = String(tekst ?? '');
  for (const z of poprawkiZnakow(t)) t = t.slice(0, z.od) + z.na + t.slice(z.do);
  return t;
}
// Wartości z tabel w tekście z polskimi zasadami – z poprawnymi znakami (chyba że tekst ma „zostaw znaki”).
ustawPoprawiaczWartosci((o) => (o?.type === 'textbox' && zasadyPl(o) && !o.znaki_bez_zmian ? poprawioneZnaki : null));
