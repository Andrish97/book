// Narzędzia czatu AI wykonywane w otwartej aplikacji (#376, plan AI B5 i komiksu C5): generowanie obrazu (do ramki
// albo na stronę), rysowanie kadrów strony komiksu ze scenariusza i kart, ustawienie dymków, szacunek kosztu.
// Kosztują – dlatego czat pyta o zgodę z kwotą przy KAŻDYM wywołaniu (także po „Zawsze pozwalaj”). Klucz Gemini –
// z sejfu (#241), jak w oknie Obraz AI.

import { generujIWstaw } from './generuj-obraz.js';
import { JAKOSCI_OBRAZU, szacujObraz, opisKosztu } from '../ai-koszty.js';
import { proporcjaRamki } from '../ai-obrazy.js';
import { planKadrowStrony, rysujPozycje, szacujPozycje, ustawDymki, stronyKomiksu } from './komiks-narzedzia.js';
import { stan, edytor } from './kontekst.js';
import { biezacyJezyk } from '../jezyk.js';

const JAKOSC = { type: 'string', enum: ['szkic', 'dokladny', 'pro'], description: 'szkic – najtaniej (domyślnie), dokladny – do druku, pro – najlepszy' };

export const NARZEDZIA_LOKALNE = [
  {
    name: 'generuj_obraz',
    description: 'Generuje obraz z opisu (Google Gemini, klucz użytkownika) i wstawia go do ramki (element: id kształtu, kadru albo obrazu na otwartej stronie – proporcje z ramki) albo na środek otwartej strony. Kosztuje (szkic ok. 0,14 zł) – użytkownik potwierdza koszt. Nie umieszczaj tekstu w obrazie; napisy dodaje się w Makietce.',
    inputSchema: { type: 'object', properties: { opis: { type: 'string', description: 'Co ma być na obrazie (dowolny język).' }, element: { type: 'string', description: 'Id ramki na otwartej stronie (opcjonalnie).' }, jakosc: JAKOSC, proporcja: { type: 'string', description: 'Np. 3:4, gdy nie ma ramki.' } }, required: ['opis'] },
  },
  {
    name: 'rysuj_kadry',
    description: 'Komiks: rysuje obrazy do kadrów strony komiksu ze scenariusza (opis sceny, kto mówi) i kart postaci/miejsc (wygląd, obrazy wzorcowe), w stylu projektu. strona – numer strony komiksu (1 = pierwsza strona sekcji Komiks). Domyślnie tylko kadry bez obrazu. Kosztuje – użytkownik potwierdza.',
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

// zgoda(opis) → Promise<boolean> – pytanie w rozmowie (bez „zawsze pozwalaj” – koszt za każdym razem).
export async function wykonajLokalne(nazwa, a, { zgoda }) {
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
    const cel = a.element ? edytor.canvas.getObjects().find((o) => o.id === a.element) : null;
    if (a.element && !cel) throw new Error(`Na otwartej stronie nie ma elementu ${a.element}.`);
    const q = JAKOSCI_OBRAZU[a.jakosc || 'szkic'];
    const zl = szacujObraz({ ...q, znakiOpisu: String(a.opis).length + 200 });
    if (!await zgoda(`wygenerować obraz „${String(a.opis).slice(0, 80)}” (koszt ok. ${opisKosztu(zl, j)})`)) return null;
    const proporcja = cel ? proporcjaRamki(cel.width * cel.scaleX, cel.height * cel.scaleY) : (a.proporcja || '3:4');
    const w = await generujIWstaw({ opis: String(a.opis), jakosc: a.jakosc || 'szkic', proporcja, cel, potwierdzono: true });
    return `Obraz „${w.nazwa}” gotowy${cel ? ` w elemencie ${cel.id}` : ' na stronie'} (koszt ok. ${opisKosztu(w.zl, j)}).`;
  }
  if (nazwa === 'rysuj_kadry') {
    await naStronieKomiksu(a.strona);
    const p = wybraneKadry(a);
    if (!p.length) return `Na stronie ${a.strona} nie ma kadrów do narysowania.`;
    const zl = szacujPozycje(p, a.jakosc || 'szkic');
    if (!await zgoda(`narysować ${p.length} kadr(y) strony ${a.strona} (koszt ok. ${opisKosztu(zl, j)})`)) return null;
    const w = await rysujPozycje(p, { jakosc: a.jakosc || 'szkic' });
    return `Narysowano ${w.gotowe} kadr(y) strony ${a.strona} (koszt ok. ${opisKosztu(w.zl, j)}).`;
  }
  throw new Error(`Nieznane narzędzie ${nazwa}.`);
}
