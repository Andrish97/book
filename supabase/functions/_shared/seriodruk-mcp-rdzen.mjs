// Rdzeń serwera MCP Seriodruku – wspólny dla serwera stdio (ai/mcp/seriodruk-mcp.mjs, składany z tego pliku
// przez scripts/mcp-buduj.cjs) i zdalnego łącznika (supabase/functions/mcp/index.ts, Funkcja Edge Supabase).
// Bez modułów Node ani Deno: tylko fetch, crypto.randomUUID i zwykły JavaScript – działa w obu środowiskach.
//
// utworzSerwer({ adres, kluczPubliczny, klucz, czytajOpis, brakKlucza }) → { obsluz(wiadomosc, stanSesji) }
// obsluz przyjmuje jedną wiadomość JSON-RPC i zwraca odpowiedź (albo null dla powiadomienia).

export const NAZWA = 'seriodruk';
export const WERSJA = '1.1.0';
export const WERSJE_NOWE = ['2026-07-28'];
export const WERSJE_STARE = ['2025-11-25', '2025-06-18', '2025-03-26'];
export const BLEDY = { PARSE: -32700, ZADANIE: -32600, METODA: -32601, PARAMETRY: -32602, WEWNETRZNY: -32603, WERSJA: -32022, NAGLOWKI: -32020 };
const ADRES_OPISU = 'https://andrish97.github.io/book/ai/format-seriodruk.md';

// Te same listy co w aplikacji (js/pola.js, js/style-tekstu.js) – test pilnuje, żeby się zgadzały.
export const POLA_DOKUMENTU = ['nr', 'nr_ogolny', 'nr_w_sekcji', 'liczba_stron', 'liczba_stron_sekcji', 'sekcja', 'nr_sekcji', 'strona', 'projekt', 'seria', 'egzemplarz', 'liczba_egzemplarzy', 'data', 'rok', 'poczatek', 'koniec', 'nr_strony'];
export const POLA_STYLU = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'lineHeight', 'charSpacing', 'fill', 'textAlign'];
export const POLA_FRAGMENTU = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'fill'];
const CZESCI = { sekcje: 'sekcja', wzorce: 'wzorzec', style: 'styl', tabele: 'tabela', serie: 'seria' };

class BladBazy extends Error {}
const opisBledu = (w) => [w.blad, ...(w.szczegoly || []).map((s) => `- ${s}`)].join('\n');

// ---------- Pomocnicze operacje na projekcie ----------

const noweId = (prefiks) => `${prefiks}_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
const kopia = (x) => JSON.parse(JSON.stringify(x));

function znajdz(lista, id, co) {
  const x = (lista || []).find((y) => y.id === id);
  if (!x) throw new BladBazy(`Nie ma ${co} o id „${id}”. Sprawdź identyfikatory narzędziem przeglad_projektu.`);
  return x;
}

// Scalenie pól: wartość null usuwa pole; identyfikatora nie da się zmienić.
function scal(obiekt, pola) {
  for (const [k, v] of Object.entries(pola || {})) {
    if (k === 'id') continue;
    if (v === null) delete obiekt[k]; else obiekt[k] = v;
  }
  return obiekt;
}

// Element dodawany przez AI: id, typ małymi literami, tekst bez obrysu (inaczej ramka jest szersza).
function przygotujElement(e) {
  const o = kopia(e);
  if (!o.id) o.id = noweId('o');
  if (typeof o.type === 'string') o.type = o.type.toLowerCase();
  if (o.type === 'textbox' && o.strokeWidth === undefined) o.strokeWidth = 0;
  return o;
}

// Miejsce z elementami: „strona:<id>” albo „wzorzec:<id>”. Zwraca { lista elementów, zmiany do zapisu }.
function miejsce(projekt, gdzie) {
  const m = /^(strona|wzorzec):(.+)$/.exec(String(gdzie || ''));
  if (!m) throw new BladBazy('„gdzie” to „strona:<id strony>” albo „wzorzec:<id wzorca>”.');
  if (m[1] === 'strona') {
    const s = znajdz(projekt.strony, m[2], 'strony');
    s.obiekty = Array.isArray(s.obiekty) ? s.obiekty : [];
    return { obiekty: s.obiekty, zmiany: () => ({ strony: [s] }), nazwa: `strona „${s.nazwa || s.id}”` };
  }
  const w = znajdz(projekt.wzorce, m[2], 'wzorca');
  w.obiekty = Array.isArray(w.obiekty) ? w.obiekty : [];
  return { obiekty: w.obiekty, zmiany: () => ({ wzorce: projekt.wzorce }), nazwa: `wzorzec „${w.nazwa || w.id}”` };
}

// Wszystkie elementy w drzewie (także w grupach i komórkach tabeli).
function wszystkie(obiekty, fn) {
  for (const o of obiekty || []) {
    fn(o);
    if (Array.isArray(o.objects)) wszystkie(o.objects, fn);
  }
}
const teksty = (obiekty, fn) => wszystkie(obiekty, (o) => { if (typeof o.text === 'string') fn(o); });

// Jak zastosujStylWProjekcie w aplikacji: wartości stylu trafiają do tekstów, które go używają;
// formatowanie fragmentów w polach stylu ustępuje stylowi. Zwraca zmiany stron i wzorców.
function przepiszStyl(projekt, styl, { odepnij = false } = {}) {
  const strony = [];
  let wzorce = false;
  let ile = 0;
  const wartosci = Object.fromEntries(POLA_STYLU.filter((k) => styl[k] !== undefined).map((k) => [k, styl[k]]));
  const zmien = (o) => {
    if (o.styl !== styl.id) return false;
    ile += 1;
    if (odepnij) { delete o.styl; return true; }
    Object.assign(o, wartosci, { scaleX: 1, scaleY: 1 });
    const style = Array.isArray(o.styles) ? o.styles.map((s) => s.style) : Object.values(o.styles || {}).flatMap((w) => Object.values(w || {}));
    for (const s of style) for (const k of POLA_FRAGMENTU) if (s) delete s[k];
    return true;
  };
  for (const s of projekt.strony) { let z = false; wszystkie(s.obiekty, (o) => { z = zmien(o) || z; }); if (z) strony.push(s); }
  for (const w of projekt.wzorce || []) wszystkie(w.obiekty, (o) => { wzorce = zmien(o) || wzorce; });
  return { zmiany: { ...(strony.length ? { strony } : {}), ...(wzorce ? { wzorce: projekt.wzorce } : {}) }, ile };
}

const krotko = (t, n = 60) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n)}…` : s; };

function przeglad(w) {
  const p = w.projekt;
  const wiersz = (o) => `${o.id} (${o.type}${o.text != null ? `: „${krotko(o.text, 40)}”` : ''}${o.zasob ? `: obraz ${p.zasoby?.[o.zasob]?.nazwa || o.zasob}` : ''}${o.tabela ? ': tabela' : ''})`;
  return [
    `Projekt „${p.nazwa}” – wersja ${w.wersja}. Dostęp: ${w.dostep.rola === 'edycja' ? 'czytanie i zmiany' : 'tylko czytanie'}, ważny do ${w.dostep.wazny_do}.`,
    `Sekcje: ${(p.sekcje || []).map((s) => `${s.id} „${s.nazwa}” ${s.wydruk?.szerokosc_mm}×${s.wydruk?.wysokosc_mm} mm, ${s.uklad || 'pojedyncze'}`).join('; ')}`,
    `Strony (${p.strony.length}, w tej kolejności):`,
    ...p.strony.map((s, i) => `  ${i + 1}. ${s.id} „${s.nazwa || ''}” sekcja=${s.sekcja}${s.seria ? ` seria=${s.seria}` : ''} – ${(s.obiekty || []).map(wiersz).join(', ') || 'pusta'}`),
    `Wzorce: ${(p.wzorce || []).map((x) => `${x.id} „${x.nazwa}” (${(x.obiekty || []).length} el.)`).join('; ') || 'brak'}`,
    `Style: ${(p.style || []).map((x) => `${x.id} „${x.nazwa}”`).join('; ') || 'brak'}`,
    `Tabele: ${(p.tabele || []).map((t) => `${t.id} „${t.nazwa}” kolumny: ${(t.kolumny || []).join(', ')}; ${(t.wiersze || []).length} wierszy`).join(' | ') || 'brak'}`,
    `Serie: ${(p.serie || []).map((s) => `${s.id} „${s.nazwa}” tabela=${s.tabela || '–'} tryb=${s.tryb || 'tabela'}`).join('; ') || 'brak'}`,
    `Obrazy i czcionki w projekcie: ${Object.entries(p.zasoby || {}).map(([id, z]) => `${id} ${z.nazwa}`).join(', ') || 'brak'}`,
  ].join('\n');
}

// Podstawowa kontrola bez rysowania: nieznane pola w tekstach, brakujące pliki obrazów z danych,
// elementy poza stroną. (Pełne „Sprawdź przed drukiem” – w aplikacji.)
export function kontrola(p) {
  const uwagi = [];
  const tabela = (id) => (p.tabele || []).find((t) => t.id === id);
  const nazwyZasobow = new Set(Object.values(p.zasoby || {}).map((z) => String(z.nazwa || '').toLowerCase()));
  const zBezRozszerzenia = new Set([...nazwyZasobow].map((n) => n.replace(/\.[^.]+$/, '')));
  for (const s of p.strony) {
    const seria = (p.serie || []).find((x) => x.id === s.seria);
    const tabele = seria ? [tabela(seria.tabela), ...(seria.dodatkowe || []).map((d) => tabela(d.tabela))].filter(Boolean) : [];
    const kolumny = new Set(tabele.flatMap((t) => t.kolumny || []));
    const sekcja = (p.sekcje || []).find((x) => x.id === s.sekcja) || {};
    const { szerokosc_mm: W = 0, wysokosc_mm: H = 0, spad_mm: spad = 3 } = sekcja.wydruk || {};
    teksty(s.obiekty, (o) => {
      for (const m of String(o.text).matchAll(/(?<!\{)\{([^{}\n:]+)(?::[^{}\n]*)?\}(?!\})/g)) {
        const pole = m[1].trim();
        const [t, k] = pole.includes('.') ? pole.split('.') : [null, pole];
        const znane = POLA_DOKUMENTU.includes(pole) || (t ? tabele.some((x) => x.nazwa === t && (x.kolumny || []).includes(k)) : kolumny.has(pole));
        if (!znane) uwagi.push(`Strona „${s.nazwa || s.id}”: nieznane pole {${pole}} w tekście „${krotko(o.text, 30)}”${seria ? '' : ' (strona nie należy do serii – pola z tabeli działają tylko na stronach serii)'}.`);
      }
    });
    for (const o of s.obiekty || []) {
      if (o.pole?.kolumna) {
        const t = tabele.find((x) => (x.kolumny || []).includes(o.pole.kolumna));
        const i = t ? t.kolumny.indexOf(o.pole.kolumna) : -1;
        if (!t) uwagi.push(`Strona „${s.nazwa || s.id}”: obraz z kolumny „${o.pole.kolumna}”, której nie ma w tabelach serii.`);
        else {
          const braki = [...new Set(t.wiersze.map((w) => String(w[i] ?? '').trim()).filter((n) => n && !/^\[\s*pomi[nń]\s*\]$/i.test(n)))]
            .filter((n) => !nazwyZasobow.has(n.toLowerCase()) && !zBezRozszerzenia.has(n.toLowerCase()));
          if (braki.length) uwagi.push(`Strona „${s.nazwa || s.id}”: w kolumnie „${o.pole.kolumna}” są nazwy plików, których nie wgrano do projektu: ${braki.slice(0, 8).join(', ')}${braki.length > 8 ? '…' : ''} (właściciel wgrywa je w aplikacji).`);
        }
      }
      const szer = (o.width || 0) * (o.scaleX ?? 1);
      const wys = (o.height || 0) * (o.scaleY ?? 1);
      if (W && H && !o.bez_ostrzezen && (o.left + szer < -spad || o.top + wys < -spad || o.left > W + spad || o.top > H + spad)) {
        uwagi.push(`Strona „${s.nazwa || s.id}”: element ${o.id} leży poza stroną (left ${o.left}, top ${o.top} mm; strona ${W}×${H} mm).`);
      }
    }
  }
  return uwagi;
}

// ---------- Narzędzia ----------

const S = (opis, wlasciwosci, wymagane = []) => ({ type: 'object', properties: wlasciwosci, required: wymagane, additionalProperties: false, description: opis });
const tekst = (opis) => ({ type: 'string', description: opis });
const obiekt = (opis) => ({ type: 'object', description: opis, additionalProperties: true });
const GDZIE = tekst('„strona:<id strony>” albo „wzorzec:<id wzorca>”.');

const INSTRUKCJE = 'Narzędzia czytają i zmieniają jeden projekt Seriodruku (edytor kalendarzy i publikacji z danymi), równolegle z właścicielem, który może mieć go otwartego w edytorze. Zacznij od przeglad_projektu. Wymiary są w milimetrach (rozmiar pisma też: pt × 25,4 / 72). Zmieniaj możliwie małymi krokami (zmien_elementy, zmien_tabele, zmien_czesc); zmien_projekt tylko dla zmian, których inne narzędzia nie obejmują. Przed większymi zmianami przeczytaj opis_formatu. Strony powtarzane robi się serią z tabeli, nie kopiami stron. Nie łącz się z bazą z własnej piaskownicy – używaj narzędzi łącznika Seriodruk (nie proś użytkownika o odblokowanie domen).';

export function utworzSerwer({ adres, kluczPubliczny, klucz, czytajOpis = null, brakKlucza = 'Brak klucza dostępu (klucz z aplikacji: menu ⋯ → Dostęp dla AI).' }) {
  const ADRES = String(adres || '').replace(/\/+$/, '');
  const KLUCZ_PUBLICZNY = kluczPubliczny;
  const KLUCZ = String(klucz || '').trim();
  const BRAK_KLUCZA = brakKlucza;

  async function rpc(funkcja, parametry) {
    const odp = await fetch(`${ADRES}/rest/v1/rpc/${funkcja}`, {
      method: 'POST',
      headers: { apikey: KLUCZ_PUBLICZNY, authorization: `Bearer ${KLUCZ_PUBLICZNY}`, 'content-type': 'application/json' },
      body: JSON.stringify(parametry),
    });
    const tekst = await odp.text();
    let dane = null;
    try { dane = tekst ? JSON.parse(tekst) : null; } catch { /* odpowiedź nie-JSON */ }
    if (!odp.ok) throw new BladBazy(`Baza odpowiedziała błędem ${odp.status}: ${dane?.message || tekst.slice(0, 200)}`);
    return dane;
  }

  async function pobierz() {
    if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
    const w = await rpc('ai_projekt', { p_klucz: KLUCZ });
    if (w?.blad) throw new BladBazy(w.blad);
    return w; // { dostep, wersja, projekt }
  }


  // Pobierz → zmień → zapisz z numerem wersji. Przy odmowie (projekt zmienił się w międzyczasie, np. ktoś
  // pisze w edytorze) pobiera projekt na nowo i nanosi zmianę jeszcze raz – raz.
  async function zmien(zmiana) {
    for (let proba = 0; proba < 2; proba += 1) {
      const { projekt, wersja } = await pobierz();
      const { zmiany, opis } = zmiana(projekt);
      if (!zmiany || !Object.keys(zmiany).length) return opis || 'Nic do zmiany.';
      const w = await rpc('ai_zapisz', { p_klucz: KLUCZ, p_znana_wersja: wersja, p_zmiany: zmiany });
      if (w?.konflikt && proba === 0) continue;
      if (w?.blad) throw new BladBazy(opisBledu(w));
      return `${opis} Zapisano (wersja ${w.wersja}); zmiana jest już w edytorze właściciela.`;
    }
    throw new BladBazy('Projekt zmienia się teraz bardzo często – spróbuj za chwilę.');
  }

  const NARZEDZIA = [
    {
      name: 'przeglad_projektu',
      title: 'Przegląd projektu',
      description: 'Krótki opis projektu: sekcje, strony z elementami (id, rodzaj, początek tekstu), wzorce, style, tabele, serie, obrazy. Zacznij od tego – stąd są identyfikatory do pozostałych narzędzi.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => przeglad(await pobierz()),
    },
    {
      name: 'czytaj',
      title: 'Czytaj część projektu',
      description: 'Pełny JSON jednej części projektu: strony, wzorca, sekcji, stylu, tabeli albo serii (po id), albo całego projektu (co="projekt"; może być duży).',
      inputSchema: S('', { co: { type: 'string', enum: ['strona', 'wzorzec', 'sekcja', 'styl', 'tabela', 'seria', 'widok', 'projekt'] }, id: tekst('Identyfikator (nie dotyczy „widok” i „projekt”).') }, ['co']),
      readOnly: true,
      dzialaj: async ({ co, id }) => {
        const { projekt, wersja } = await pobierz();
        const listy = { strona: 'strony', wzorzec: 'wzorce', sekcja: 'sekcje', styl: 'style', tabela: 'tabele', seria: 'serie' };
        const wynik = co === 'projekt' ? projekt : co === 'widok' ? projekt.widok || {} : znajdz(projekt[listy[co]], id, co === 'strona' ? 'strony' : co);
        return `Wersja projektu ${wersja}.\n${JSON.stringify(wynik, null, 1)}`;
      },
    },
    {
      name: 'zmien_elementy',
      title: 'Zmień elementy',
      description: 'Zmienia pola elementów (po id) na stronie albo we wzorcu – np. tekst, kolor (fill), położenie (left, top w mm), rozmiar pisma (fontSize w mm), z_danych, pole. Podawaj tylko zmieniane pola; null usuwa pole.',
      inputSchema: S('', { gdzie: GDZIE, zmiany: { type: 'array', items: S('', { id: tekst('id elementu'), pola: obiekt('Pola do zmiany') }, ['id', 'pola']) } }, ['gdzie', 'zmiany']),
      dzialaj: ({ gdzie, zmiany }) => zmien((p) => {
        const m = miejsce(p, gdzie);
        for (const z of zmiany) scal(znajdz(m.obiekty, z.id, 'elementu'), z.pola);
        return { zmiany: m.zmiany(), opis: `Zmieniono ${zmiany.length} el. (${m.nazwa}).` };
      }),
    },
    {
      name: 'dodaj_elementy',
      title: 'Dodaj elementy',
      description: 'Dodaje elementy (JSON elementów jak w opisie formatu: textbox, rect, ellipse, line, path, polygon, image z istniejącym zasobem, group/tabela) na stronę albo do wzorca. Bez id – nadam. Nowe elementy trafiają na wierzch, chyba że podasz „przed” (id elementu).',
      inputSchema: S('', { gdzie: GDZIE, elementy: { type: 'array', items: obiekt('Element') }, przed: tekst('id elementu, przed którym wstawić (niżej w warstwach)') }, ['gdzie', 'elementy']),
      dzialaj: ({ gdzie, elementy, przed }) => zmien((p) => {
        const m = miejsce(p, gdzie);
        const nowe = elementy.map(przygotujElement);
        const i = przed ? m.obiekty.findIndex((o) => o.id === przed) : -1;
        m.obiekty.splice(i >= 0 ? i : m.obiekty.length, 0, ...nowe);
        return { zmiany: m.zmiany(), opis: `Dodano ${nowe.length} el. (${m.nazwa}): ${nowe.map((o) => o.id).join(', ')}.` };
      }),
    },
    {
      name: 'usun_elementy',
      title: 'Usuń elementy',
      description: 'Usuwa elementy (po id) ze strony albo ze wzorca.',
      inputSchema: S('', { gdzie: GDZIE, id: { type: 'array', items: { type: 'string' } } }, ['gdzie', 'id']),
      dzialaj: ({ gdzie, id }) => zmien((p) => {
        const m = miejsce(p, gdzie);
        for (const x of id) znajdz(m.obiekty, x, 'elementu');
        const zostaja = m.obiekty.filter((o) => !id.includes(o.id));
        m.obiekty.splice(0, m.obiekty.length, ...zostaja);
        return { zmiany: m.zmiany(), opis: `Usunięto ${id.length} el. (${m.nazwa}).` };
      }),
    },
    {
      name: 'kolejnosc_elementow',
      title: 'Kolejność elementów',
      description: 'Ustawia kolejność warstw elementów na stronie albo we wzorcu: lista id od spodu do wierzchu (wszystkie elementy).',
      inputSchema: S('', { gdzie: GDZIE, id: { type: 'array', items: { type: 'string' } } }, ['gdzie', 'id']),
      dzialaj: ({ gdzie, id }) => zmien((p) => {
        const m = miejsce(p, gdzie);
        if (id.length !== m.obiekty.length || !m.obiekty.every((o) => id.includes(o.id))) throw new BladBazy('Podaj każdy element tego miejsca dokładnie raz.');
        const nowa = id.map((x) => m.obiekty.find((o) => o.id === x));
        m.obiekty.splice(0, m.obiekty.length, ...nowa);
        return { zmiany: m.zmiany(), opis: `Nowa kolejność warstw (${m.nazwa}).` };
      }),
    },
    {
      name: 'dodaj_strone',
      title: 'Dodaj stronę',
      description: 'Dodaje stronę: { nazwa, sekcja (id), wzorce ("z_sekcji" albo lista id), seria?, tlo?, obiekty? }. Domyślnie na końcu swojej sekcji; „po” – id strony, za którą wstawić.',
      inputSchema: S('', { strona: obiekt('Strona'), po: tekst('id strony, za którą wstawić') }, ['strona']),
      dzialaj: ({ strona, po }) => zmien((p) => {
        const s = { wzorce: 'z_sekcji', obiekty: [], ...kopia(strona) };
        if (!s.id) s.id = noweId('s');
        if (!s.sekcja) s.sekcja = p.sekcje?.[0]?.id;
        s.obiekty = (s.obiekty || []).map(przygotujElement);
        const ids = p.strony.map((x) => x.id);
        let i = po ? ids.indexOf(po) + 1 : -1;
        if (po && i === 0) throw new BladBazy(`Nie ma strony „${po}”.`);
        if (i < 0) { const ostatnia = p.strony.map((x) => x.sekcja).lastIndexOf(s.sekcja); i = ostatnia >= 0 ? ostatnia + 1 : ids.length; }
        ids.splice(i, 0, s.id);
        return { zmiany: { strony: [s], kolejnosc_stron: ids }, opis: `Dodano stronę ${s.id} „${s.nazwa || ''}” na pozycji ${i + 1}.` };
      }),
    },
    {
      name: 'zmien_strone',
      title: 'Zmień stronę',
      description: 'Zmienia ustawienia strony (nie elementy): nazwa, sekcja, wzorce ("z_sekcji" albo lista id), seria (id albo null), tlo, prowadnice. null usuwa pole.',
      inputSchema: S('', { id: tekst('id strony'), pola: obiekt('Pola do zmiany') }, ['id', 'pola']),
      dzialaj: ({ id, pola }) => zmien((p) => {
        const s = znajdz(p.strony, id, 'strony');
        const { obiekty, ...reszta } = pola;
        if (obiekty) throw new BladBazy('Elementy zmieniasz narzędziami zmien_elementy, dodaj_elementy i usun_elementy.');
        scal(s, reszta);
        return { zmiany: { strony: [s] }, opis: `Zmieniono stronę ${id}.` };
      }),
    },
    {
      name: 'usun_strony',
      title: 'Usuń strony',
      description: 'Usuwa strony (po id).',
      inputSchema: S('', { id: { type: 'array', items: { type: 'string' } } }, ['id']),
      dzialaj: ({ id }) => zmien(() => ({ zmiany: { usun_strony: id }, opis: `Usunięto strony: ${id.join(', ')}.` })),
    },
    {
      name: 'kolejnosc_stron',
      title: 'Kolejność stron',
      description: 'Nowa kolejność stron: wszystkie id stron. (Aplikacja i tak trzyma strony pogrupowane według kolejności sekcji.)',
      inputSchema: S('', { id: { type: 'array', items: { type: 'string' } } }, ['id']),
      dzialaj: ({ id }) => zmien(() => ({ zmiany: { kolejnosc_stron: id }, opis: 'Ustawiono kolejność stron.' })),
    },
    {
      name: 'zmien_tabele',
      title: 'Zmień tabelę danych',
      description: 'Zmienia tabelę danych (po id; nowa, jeśli nie ma – wtedy podaj nazwa i kolumny): nazwa, kolumny (pełna lista), ustaw komórki [{ wiersz (od 0), kolumna (nazwa), wartosc }], dodaj_wiersze (listy wartości w kolejności kolumn; wiersz „[pomiń]” w pierwszej komórce zajmuje miejsce w bloku serii, ale strona nie powstaje), usun_wiersze (numery od 0), wiersze (zastępuje wszystkie), listy ({ kolumna: [dozwolone wartości] }).',
      inputSchema: S('', {
        id: tekst('id tabeli'), nazwa: tekst('nazwa tabeli'), kolumny: { type: 'array', items: { type: 'string' } },
        ustaw: { type: 'array', items: S('', { wiersz: { type: 'integer' }, kolumna: { type: 'string' }, wartosc: { type: 'string' } }, ['wiersz', 'kolumna', 'wartosc']) },
        dodaj_wiersze: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
        usun_wiersze: { type: 'array', items: { type: 'integer' } },
        wiersze: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
        listy: obiekt('Listy dozwolonych wartości kolumn'),
      }, ['id']),
      dzialaj: (a) => zmien((p) => {
        p.tabele = p.tabele || [];
        let t = p.tabele.find((x) => x.id === a.id);
        if (!t) {
          if (!a.nazwa || !a.kolumny) throw new BladBazy(`Nie ma tabeli „${a.id}” – żeby ją utworzyć, podaj nazwa i kolumny.`);
          t = { id: a.id, nazwa: a.nazwa, kolumny: a.kolumny, wiersze: [] };
          p.tabele.push(t);
        }
        if (a.nazwa) t.nazwa = a.nazwa;
        if (a.kolumny) {
          const stare = t.kolumny;
          t.wiersze = t.wiersze.map((w) => a.kolumny.map((k) => { const i = stare.indexOf(k); return i >= 0 ? (w[i] ?? '') : ''; }));
          t.kolumny = a.kolumny;
        }
        if (a.wiersze) t.wiersze = a.wiersze;
        for (const u of a.ustaw || []) {
          const k = t.kolumny.indexOf(u.kolumna);
          if (k < 0) throw new BladBazy(`Tabela „${t.nazwa}” nie ma kolumny „${u.kolumna}”.`);
          while (t.wiersze.length <= u.wiersz) t.wiersze.push(t.kolumny.map(() => ''));
          t.wiersze[u.wiersz][k] = u.wartosc;
        }
        if (a.usun_wiersze) t.wiersze = t.wiersze.filter((_, i) => !a.usun_wiersze.includes(i));
        for (const w of a.dodaj_wiersze || []) t.wiersze.push(t.kolumny.map((_, i) => String(w[i] ?? '')));
        if (a.listy) t.listy = { ...(t.listy || {}), ...a.listy };
        return { zmiany: { tabele: p.tabele }, opis: `Tabela „${t.nazwa}”: ${t.kolumny.length} kolumn, ${t.wiersze.length} wierszy.` };
      }),
    },
    {
      name: 'zmien_czesc',
      title: 'Zmień sekcję, wzorzec, styl, tabelę albo serię',
      description: 'Ogólna zmiana jednej części projektu po id: czesc = sekcje | wzorce | style | tabele | serie. pola – zmieniane pola (null usuwa); nowa część, jeśli id nie istnieje (podaj komplet pól, np. sekcja: nazwa, wydruk, uklad; seria: nazwa, tabela, tryb). usun: true – usuwa część. Zmiana stylu przepisuje jego wartości do wszystkich tekstów z tym stylem (jak w aplikacji); usunięcie stylu odpina go od tekstów.',
      inputSchema: S('', { czesc: { type: 'string', enum: Object.keys(CZESCI) }, id: tekst('id'), pola: obiekt('Pola'), usun: { type: 'boolean' } }, ['czesc', 'id']),
      dzialaj: ({ czesc, id, pola = {}, usun = false }) => zmien((p) => {
        p[czesc] = p[czesc] || [];
        const lista = p[czesc];
        const i = lista.findIndex((x) => x.id === id);
        let zmiany = {};
        let opis;
        if (usun) {
          if (i < 0) throw new BladBazy(`Nie ma ${CZESCI[czesc]} „${id}”.`);
          const [stary] = lista.splice(i, 1);
          if (czesc === 'style') zmiany = przepiszStyl(p, stary, { odepnij: true }).zmiany;
          opis = `Usunięto: ${CZESCI[czesc]} „${stary.nazwa || id}”.`;
        } else if (i < 0) {
          lista.push(scal({ id }, pola));
          opis = `Dodano: ${CZESCI[czesc]} „${pola.nazwa || id}”.`;
        } else {
          scal(lista[i], pola);
          opis = `Zmieniono: ${CZESCI[czesc]} „${lista[i].nazwa || id}”.`;
          if (czesc === 'style') {
            const w = przepiszStyl(p, lista[i]);
            zmiany = w.zmiany;
            if (w.ile) opis += ` Styl przepisany do ${w.ile} tekstów.`;
          }
        }
        // Lista wzorców mogła już trafić do zmian (przepisanie stylu) – to ten sam obiekt.
        return { zmiany: { ...zmiany, [czesc]: lista }, opis };
      }),
    },
    {
      name: 'zmien_projekt',
      title: 'Zmień projekt (ogólnie)',
      description: 'Ogólny zapis części projektu w jednym kroku, dla zmian, których nie obejmują inne narzędzia. zmiany: { nazwa?, sekcje?, wzorce?, style?, tabele?, serie? (pełne listy – zastępują dotychczasowe), widok?, strony? (pełne obiekty stron nowych albo zmienionych), usun_strony?, kolejnosc_stron? }. Baza sprawdza spójność (sekcje, wzorce, serie, tabele, obrazy) i odrzuca niespójne zmiany z opisem. Zasobów (obrazów, czcionek) nie da się tu dodać.',
      inputSchema: S('', { zmiany: obiekt('Części projektu do zapisu') }, ['zmiany']),
      dzialaj: ({ zmiany }) => zmien(() => ({ zmiany, opis: `Zapisano części: ${Object.keys(zmiany).join(', ')}.` })),
    },
    {
      name: 'nazwa_projektu',
      title: 'Zmień nazwę projektu',
      description: 'Zmienia nazwę projektu.',
      inputSchema: S('', { nazwa: tekst('Nowa nazwa') }, ['nazwa']),
      dzialaj: ({ nazwa }) => zmien(() => ({ zmiany: { nazwa }, opis: `Nowa nazwa: „${nazwa}”.` })),
    },
    {
      name: 'kontrola',
      title: 'Kontrola projektu',
      description: 'Szybka kontrola bez rysowania: nieznane pola {…} w tekstach, brakujące pliki obrazów z danych, elementy poza stroną. Pełne „Sprawdź przed drukiem” jest w aplikacji.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => { const u = kontrola((await pobierz()).projekt); return u.length ? `Uwagi (${u.length}):\n${u.map((x) => `- ${x}`).join('\n')}` : 'Brak uwag.'; },
    },
    {
      name: 'opis_formatu',
      title: 'Opis formatu projektu',
      description: 'Pełny opis modelu projektu Seriodruku: sekcje, strony, elementy i ich pola, tabele, serie, pola w tekście, jednostki (mm). Przeczytaj przed większymi zmianami.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => {
        const wlasny = czytajOpis ? await czytajOpis().catch(() => null) : null;
        if (wlasny) return wlasny;
        const odp = await fetch(ADRES_OPISU);
        if (!odp.ok) throw new BladBazy(`Nie udało się pobrać opisu formatu (${ADRES_OPISU}).`);
        return odp.text();
      },
    },
  ];




  function listaNarzedzi() {
    return NARZEDZIA.map(({ name, title, description, inputSchema, readOnly }) => ({
      name, title, description,
      inputSchema: { type: 'object', properties: inputSchema.properties, required: inputSchema.required, additionalProperties: false },
      annotations: { readOnlyHint: Boolean(readOnly), destructiveHint: name.startsWith('usun'), openWorldHint: false },
    }));
  }

  async function obsluz(w, stanSesji = {}) {
    if (!w || w.jsonrpc !== '2.0' || typeof w.method !== 'string') {
      return w && w.id !== undefined ? { jsonrpc: '2.0', id: w.id, error: { code: BLEDY.ZADANIE, message: 'Nieprawidłowe żądanie JSON-RPC.' } } : null;
    }
    const { id, method, params = {} } = w;
    const powiadomienie = id === undefined || id === null;
    const wynik = (result) => (powiadomienie ? null : { jsonrpc: '2.0', id, result });
    const blad = (code, message, data) => (powiadomienie ? null : { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });
    const nowy = !stanSesji.zainicjowany; // bez initialize: tryb wersji 2026-07-28 (wersja w _meta każdego żądania)
    const wersja = params?._meta?.['io.modelcontextprotocol/protocolVersion'];
    const obslugiwane = [...WERSJE_NOWE, ...WERSJE_STARE];
    if (wersja && !obslugiwane.includes(wersja) && method !== 'initialize') {
      return blad(BLEDY.WERSJA, 'Unsupported protocol version', { supported: obslugiwane, requested: wersja });
    }
    const zakonczony = (x) => (nowy && wersja ? { resultType: 'complete', ...x } : x);
    const info = { name: NAZWA, title: 'Seriodruk', version: WERSJA };

    switch (method) {
      case 'initialize': { // starsze wersje: wymiana initialize
        const chce = params.protocolVersion;
        stanSesji.zainicjowany = true;
        stanSesji.wersja = WERSJE_STARE.includes(chce) ? chce : WERSJE_STARE[0];
        return wynik({ protocolVersion: stanSesji.wersja, capabilities: { tools: { listChanged: false } }, serverInfo: info, instructions: INSTRUKCJE });
      }
      case 'server/discover':
        return wynik({
          resultType: 'complete', supportedVersions: obslugiwane, capabilities: { tools: {} },
          _meta: { 'io.modelcontextprotocol/serverInfo': info }, instructions: INSTRUKCJE,
        });
      case 'ping':
        return wynik(zakonczony({}));
      case 'tools/list':
        return wynik(zakonczony({ tools: listaNarzedzi() }));
      case 'tools/call': {
        const n = NARZEDZIA.find((x) => x.name === params.name);
        if (!n) return blad(BLEDY.PARAMETRY, `Nieznane narzędzie: ${params.name}`);
        try {
          const tekstWyniku = await n.dzialaj(params.arguments || {});
          return wynik(zakonczony({ content: [{ type: 'text', text: tekstWyniku }], isError: false }));
        } catch (e) {
          // Błędy wykonania wracają do AI jako wynik z isError – może poprawić wywołanie.
          return wynik(zakonczony({ content: [{ type: 'text', text: e instanceof BladBazy ? e.message : `Błąd: ${e.message}` }], isError: true }));
        }
      }
      default:
        if (method.startsWith('notifications/')) return null;
        return blad(BLEDY.METODA, `Nieznana metoda: ${method}`);
    }
  }

  return { obsluz, narzedzia: NARZEDZIA };
}
