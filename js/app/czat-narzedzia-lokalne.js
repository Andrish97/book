// Narzędzia czatu AI wykonywane w otwartej aplikacji (#376, plan AI B5 i komiksu C5): generowanie obrazu (do ramki
// albo na stronę), rysowanie kadrów strony komiksu ze scenariusza i kart, ustawienie dymków, szacunek kosztu.
// Kosztują – czat nie pyta o zgodę (uwaga E4), tylko pokazuje w rozmowie, co rysuje i ile to mniej więcej kosztuje;
// bezpiecznikiem jest miesięczny limit wydatków. Klucz Gemini – z sejfu (#241), jak w oknie Obraz AI.

import { pelnyOpis } from './generuj-obraz.js';
import { generujObraz, PROPORCJE } from '../ai-obrazy.js';
import { zadanie } from '../ai-dostawcy.js';
import { otwartySejf } from './sejf-ai.js';
import { JAKOSCI_OBRAZU, szacujObraz, opisKosztu, kosztZUzycia, zapiszWydatek, wLimicie, wydatki } from '../ai-koszty.js';
import { planKadrowStrony, rysujPozycje, szacujPozycje, ustawDymki, stronyKomiksu } from './komiks-narzedzia.js';
import { stan } from './kontekst.js';
import { biezacyJezyk, t } from '../jezyk.js';

const JAKOSC = { type: 'string', enum: ['szkic', 'dokladny', 'pro'], description: 'szkic – najtaniej (używaj domyślnie), dokladny – do druku, pro – najlepszy; lepszą jakość tylko, gdy użytkownik o nią prosi' };

export const NARZEDZIA_LOKALNE = [
  {
    name: 'generuj_obraz',
    description: 'Generuje obraz z opisu (Google Gemini, klucz użytkownika), wgrywa go do obrazów projektu i wstawia: do ramki (element – id kształtu, kadru albo prostokąta na stronie gdzie; obraz ją wypełnia) albo na środek strony. Kosztuje (szkic ok. 0,14 zł) – użytkownik widzi koszt w rozmowie. Nie umieszczaj tekstu w obrazie; napisy dodaje się w Makietce.',
    inputSchema: { type: 'object', properties: { opis: { type: 'string', description: 'Co ma być na obrazie – w języku, w którym pisze użytkownik (zobaczy ten opis przy pytaniu o zgodę).' }, gdzie: { type: 'string', description: '„strona:<id strony>” – strona z ramką albo strona, na którą wstawić obraz.' }, element: { type: 'string', description: 'Id ramki na tej stronie (opcjonalnie).' }, jakosc: JAKOSC, proporcja: { type: 'string', description: 'Kształt obrazu, np. 3:4 (pion), 4:3 (poziom), 1:1 – zgodny z ramką.' } }, required: ['opis', 'gdzie'] },
  },
  {
    name: 'rysuj_kadry',
    description: 'Komiks: rysuje obrazy do kadrów strony komiksu ze scenariusza (opis sceny, kto mówi) i kart postaci/miejsc (wygląd, obrazy wzorcowe), w stylu projektu. strona – numer strony komiksu (1 = pierwsza strona sekcji Komiks). Domyślnie tylko kadry bez obrazu. Kosztuje – użytkownik widzi koszt w rozmowie.',
    inputSchema: { type: 'object', properties: { strona: { type: 'integer', minimum: 1 }, kadry: { type: 'array', items: { type: 'integer' }, description: 'Numery kadrów (opcjonalnie; domyślnie puste kadry).' }, jakosc: JAKOSC }, required: ['strona'] },
  },
  {
    name: 'ustaw_dymki',
    description: 'Komiks: stawia dymki z tabeli scenariusza na stronach komiksu (ponownie – zmienia tylko tekst, przesunięte dymki zostają). kolumna – kolumna tekstu dla innej wersji językowej (np. tekst_en).',
    inputSchema: { type: 'object', properties: { kolumna: { type: 'string' } } },
  },
  {
    name: 'szacuj_koszt',
    description: 'Szacuje koszt w zł: obrazy (ile, jakosc) albo kadry strony komiksu (strona). Nic nie generuje i nic nie kosztuje.',
    inputSchema: { type: 'object', properties: { obrazow: { type: 'integer', minimum: 1 }, strona: { type: 'integer', minimum: 1 }, jakosc: JAKOSC } },
  },
];
export const nazwyLokalne = new Set(NARZEDZIA_LOKALNE.map((n) => n.name));

async function naStronieKomiksu(nr) {
  const strony = stronyKomiksu(stan.projekt);
  const s = strony[nr - 1];
  if (!s) throw new Error(`Komiks nie ma strony ${nr} (stron: ${strony.length}).`);
  await window.seriodruk.przejdzDoStrony(stan.projekt.strony.indexOf(s));
}
function wybraneKadry({ kadry }) {
  const { pozycje } = planKadrowStrony();
  return pozycje.filter((x) => (kadry?.length ? kadry.includes(x.kadr) : !x.obiekt.zasob));
}

// informuj(tekst) – linijka w rozmowie: co AI rysuje i za ile (bez pytania o zgodę, E4). Ponad limit miesięczny – błąd.
const limit = (zl, j) => { if (!wLimicie(zl)) throw new Error(`To przekroczyłoby miesięczny limit wydatków na AI (${opisKosztu(wydatki().limit, j)}) – użytkownik może go zmienić w Ustawieniach konta → Sztuczna inteligencja.`); };
export async function wykonajLokalne(nazwa, a, { informuj = () => {}, wolaj }) {
  const j = biezacyJezyk();
  if (nazwa === 'szacuj_koszt') {
    if (a.strona) { await naStronieKomiksu(a.strona); const p = wybraneKadry(a); return `Strona ${a.strona}: ${p.length} kadrów do narysowania, ok. ${opisKosztu(szacujPozycje(p, a.jakosc || 'szkic'), j)}.`; }
    const q = JAKOSCI_OBRAZU[a.jakosc || 'szkic'];
    return `${a.obrazow || 1} obraz(ów), jakość ${a.jakosc || 'szkic'}: ok. ${opisKosztu(szacujObraz({ ...q, ile: a.obrazow || 1 }), j)}.`;
  }
  if (nazwa === 'ustaw_dymki') {
    const w = await ustawDymki({ kolumnaTekstu: a.kolumna || null });
    if (!w) throw new Error('W projekcie nie ma scenariusza.');
    return `Dymki: nowe ${w.dodane}, zmienione ${w.zmienione}, usunięte ${w.usuniete}.${w.pominiete.length ? ` Pominięto: ${w.pominiete.join('; ')}` : ''}`;
  }
  if (nazwa === 'generuj_obraz') {
    // Cały wynik idzie przez narzędzia łącznika (wolaj) – jak reszta rozmowy, bez wysyłania projektu z edytora,
    // więc nic nie nadpisuje zmian, które AI zrobiło przed chwilą (#380).
    const q = JAKOSCI_OBRAZU[a.jakosc || 'szkic'];
    const zl = szacujObraz({ ...q, znakiOpisu: String(a.opis).length + 200 });
    limit(zl, j);
    informuj(t('czatAi.rysujeObraz', { opis: String(a.opis).slice(0, 80), zl: opisKosztu(zl, j) }));
    const klucz = (await otwartySejf())?.klucz('gemini');
    if (!klucz) throw new Error('Użytkownik nie ma klucza Google Gemini – obrazy rysuje tylko Gemini. Poproś o dodanie klucza w Ustawieniach konta → Sztuczna inteligencja.');
    const proporcja = PROPORCJE.includes(a.proporcja) ? a.proporcja : '1:1';
    const w = await generujObraz({ klucz, model: q.model, fetchJson: zadanie, opis: pelnyOpis(String(a.opis)), proporcja, rozdzielczosc: q.rozdzielczosc });
    const koszt = kosztZUzycia(q.model, w.uzycie) ?? zl;
    zapiszWydatek(koszt, { model: q.model, rodzaj: 'obraz' });
    const tekst = (r) => (r?.content || []).map((c) => c.text || '').join('\n');
    const slowa = String(a.opis).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'obraz';
    const roz = w.typ.includes('jpeg') ? 'jpg' : 'png';
    const wgrany = tekst(await wolaj('tools/call', { name: 'wgraj_obraz', arguments: { nazwa: `ai-${slowa}.${roz}`, dane_base64: `data:${w.typ};base64,${w.dane}` } }));
    const id = /\(id ([^,)\s]+)/.exec(wgrany)?.[1];
    if (!id) throw new Error(`Nie udało się wgrać obrazu: ${wgrany}`);
    const r = a.element
      ? await wolaj('tools/call', { name: 'zmien_elementy', arguments: { gdzie: a.gdzie, zmiany: [{ id: a.element, pola: { zasob: id, obraz_kadr: { x: 0, y: 0, skala: 1 } } }] } })
      : await wolaj('tools/call', { name: 'wstaw_obraz', arguments: { obraz: id, gdzie: a.gdzie } });
    if (r?.isError) throw new Error(tekst(r));
    return `Obraz gotowy (id ${id})${a.element ? ` w elemencie ${a.element}` : ' na stronie'} – koszt ok. ${opisKosztu(koszt, j)}. ${tekst(r)}`;
  }
  if (nazwa === 'rysuj_kadry') {
    await naStronieKomiksu(a.strona);
    const p = wybraneKadry(a);
    if (!p.length) return `Na stronie ${a.strona} nie ma kadrów do narysowania.`;
    const zl = szacujPozycje(p, a.jakosc || 'szkic');
    limit(zl, j);
    informuj(t('czatAi.rysujeKadry', { strona: a.strona, ile: p.length, zl: opisKosztu(zl, j) }));
    const w = await rysujPozycje(p, { jakosc: a.jakosc || 'szkic' });
    return `Narysowano ${w.gotowe} kadr(y) strony ${a.strona} (koszt ok. ${opisKosztu(w.zl, j)}).`;
  }
  throw new Error(`Nieznane narzędzie ${nazwa}.`);
}
