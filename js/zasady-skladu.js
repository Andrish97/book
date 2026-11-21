// Polskie zasady składu (PN-83/P-55366, PN-70/P-55036) – czego nie rozdziela się na granicy wierszy (#323).
// Opcja tekstu `zasady_pl` (jak „polskie zasady” w programach DTP): między takimi wyrazami wiersz się nie łamie –
// pierwszy z nich przechodzi do następnego wiersza razem z drugim. Ta sama lista służy kontroli składu
// (ostrzeżenia o miejscach niezgodnych z zasadami, gdy opcja jest wyłączona).

// Jednoliterowe spójniki i przyimki – nie zostają na końcu wiersza.
export const JEDNOLITEROWE = new Set(['a', 'i', 'o', 'u', 'w', 'z']);

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
  skrot: 'skrót oddzielony od następnego wyrazu',
  inicjal: 'inicjał oddzielony od nazwiska',
  liczba: 'liczba oddzielona od jednostki, daty albo dalszych cyfr',
  myslnik: 'myślnik na początku wiersza',
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
  const t = String(tekst || '').replace(/\{[^}]*\}/g, ''); // pola z danymi pomijamy
  const wynik = [];
  for (const [kod, re, opis] of ZNAKI) {
    const ile = (t.match(re) || []).length;
    if (ile) wynik.push({ kod, opis, ile });
  }
  return wynik;
}

// Złamania wierszy niezgodne z zasadami w złożonym tekście (Fabric: _textLines + isEndOfWrapping):
// [{ kod: 'lamanie', powod, opis, przyklad }]. Bez przypadków nieuniknionych (wiersz z jednym wyrazem).
export function uwagiLamania(o) {
  const linie = o?._textLines;
  if (!Array.isArray(linie) || linie.length < 2) return [];
  const wynik = new Map();
  for (let i = 0; i < linie.length - 1; i += 1) {
    if (typeof o.isEndOfWrapping === 'function' && o.isEndOfWrapping(i)) continue; // koniec akapitu
    if (linie[i].lacznik) continue; // wyraz dzielony – to nie granica wyrazów
    const a = linie[i].join('').trim().split(/\s+/);
    const b = linie[i + 1].join('').trim().split(/\s+/);
    const powod = powodWiazania(a.at(-1), b[0], { jednoliterowe: true });
    if (!powod || a.length < 2) continue; // jeden wyraz w wierszu – złamania nie da się uniknąć
    const w = wynik.get(powod) || { kod: 'lamanie', powod, opis: OPIS_POWODU[powod], ile: 0, przyklad: `${a.at(-1)} | ${b[0]}` };
    w.ile += 1;
    wynik.set(powod, w);
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
