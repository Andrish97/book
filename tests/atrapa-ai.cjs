// Atrapa funkcji bazy dla dostępu AI (supabase/migrations/20261111200000_dostep_ai.sql) – te same
// zasady w JS: klucz, rola, ważność, odebranie, wersja, kontrola spójności. Używają jej atrapa bazy
// w tests/pomoc.cjs (testy aplikacji) i serwer testowy dla serwera MCP (tests/mcp.test.cjs).
//
// stan: { projekty: [{ id, owner_id, nazwa, dane, wersja, zmieniono }], strony: Map("projekt/strona" → dane),
//         oglos?(projekt) }. Funkcja zwraca wynik albo rzuca { status, message } (błąd jak z PostgREST).

const crypto = require('node:crypto');

const CZESCI = ['nazwa', 'sekcje', 'wzorce', 'style', 'tabele', 'serie', 'widok', 'strony', 'usun_strony', 'kolejnosc_stron'];
const TYPY = ['textbox', 'i-text', 'text', 'rect', 'ellipse', 'circle', 'line', 'polygon', 'polyline', 'path', 'image', 'group', 'triangle'];

const kopia = (x) => JSON.parse(JSON.stringify(x));

// Lista identyfikatorów albo null (nie lista obiektów z niepustym, niepowtarzalnym tekstowym id).
function identyfikatory(lista) {
  if (!Array.isArray(lista)) return null;
  const ids = [];
  for (const x of lista) {
    if (!x || typeof x !== 'object' || Array.isArray(x) || typeof x.id !== 'string' || !x.id || ids.includes(x.id)) return null;
    ids.push(x.id);
  }
  return ids;
}

// Wszystkie wartości pól „zasob” w drzewie (jak jsonb_path_query '$.**.zasob').
function zasobyWDrzewie(x, wynik = []) {
  if (Array.isArray(x)) x.forEach((y) => zasobyWDrzewie(y, wynik));
  else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      if (k === 'zasob' && typeof v === 'string') wynik.push(v);
      zasobyWDrzewie(v, wynik);
    }
  }
  return wynik;
}

function atrapaAi(stan) {
  stan.dostepy = stan.dostepy || [];
  const blad = (status, message) => { throw Object.assign(new Error(message), { status, message }); };

  const stronyProjektu = (p) => {
    if (!p.dane.strony_osobno) return kopia(p.dane.strony || []);
    return (p.dane.strony || []).map((id) => stan.strony.get(`${p.id}/${id}`)).filter(Boolean).map(kopia);
  };

  // Klucz konta (migracja 20261114200000_klucze_ai_konta.sql): zakres 'wybrane' (lista projektów) albo 'pelny';
  // projekt, na którym działa funkcja, podaje się po ukośniku („sdk_…/<projekt>”).
  const rolaKonta = (owner, pid) => {
    const p = stan.projekty.find((x) => x.id === pid);
    if (!p) return null;
    if (p.owner_id === owner) return 'wlasciciel';
    return (stan.wspolpracownicy || []).find((w) => w.projekt_id === pid && w.uzytkownik === owner)?.rola || null;
  };
  const projektyKlucza = (d) => [
    ...stan.projekty.filter((p) => p.owner_id === d.owner_id).map((p) => ({ id: p.id, rola: 'wlasciciel' })),
    ...(stan.wspolpracownicy || []).filter((w) => w.uzytkownik === d.owner_id && stan.projekty.some((p) => p.id === w.projekt_id)).map((w) => ({ id: w.projekt_id, rola: w.rola })),
  ].filter((x) => d.zakres === 'pelny' || d.projekty.includes(x.id));

  function kluczKonta(klucz) {
    const m = /^sdk_([0-9a-f]{32})_([A-Za-z0-9_-]{20,100})(?:\/([A-Za-z0-9-]+))?$/.exec(String(klucz || ''));
    if (!m) return { blad: 'Nieprawidłowy klucz dostępu.' };
    const d = stan.dostepy.find((x) => x.id.replace(/-/g, '') === m[1]);
    if (!d) return { blad: 'Nieprawidłowy klucz dostępu.' };
    if (d.blokada_do && d.blokada_do > Date.now()) return { blad: 'Klucz jest chwilowo zablokowany po wielu złych próbach. Spróbuj za kilkanaście minut.' };
    if (d.sekret !== m[2]) {
      d.nieudane += 1;
      if (d.nieudane >= 10) d.blokada_do = Date.now() + 15 * 60000;
      return { blad: 'Nieprawidłowy klucz dostępu.' };
    }
    if (d.odwolany) return { blad: 'Klucz został odebrany w ustawieniach konta.' };
    if (d.wazny_do && new Date(d.wazny_do) <= new Date()) return { blad: 'Klucz dostępu wygasł. Utwórz nowy w ustawieniach konta (Dostęp dla AI).' };
    d.nieudane = 0;
    d.ostatnie_uzycie = new Date().toISOString();
    return { d, projekt: m[3] || null };
  }

  function sprawdzKlucz(klucz, edycja) {
    const w = kluczKonta(klucz);
    if (w.blad) return w;
    const { d } = w;
    let pid = w.projekt;
    if (!pid) {
      const ids = projektyKlucza(d);
      if (ids.length === 1) pid = ids[0].id;
      else if (!ids.length) return { blad: 'Ten klucz nie obejmuje żadnego projektu (dodaj projekty w ustawieniach konta albo utwórz projekt narzędziem nowy_projekt).' };
      else return { blad: 'Ten klucz obejmuje kilka projektów – podaj projekt (lista: narzędzie projekty).' };
    } else if (d.zakres === 'wybrane' && !d.projekty.includes(pid)) {
      return { blad: 'Ten klucz nie obejmuje tego projektu – dodasz go w ustawieniach konta (Dostęp dla AI).' };
    }
    const r = rolaKonta(d.owner_id, pid);
    if (!r) return { blad: 'Nie ma takiego projektu albo konto klucza nie ma już do niego dostępu.' };
    if (edycja && d.rola !== 'edycja') return { blad: 'Ten klucz pozwala tylko czytać projekty.' };
    if (edycja && r === 'odczyt') return { blad: 'W tym projekcie konto klucza może tylko oglądać (rola nadana przez właściciela projektu).' };
    return { ...d, projekt_id: pid, rola: d.rola === 'edycja' && r !== 'odczyt' ? 'edycja' : 'odczyt' };
  }

  function aiProjekty({ p_klucz }) {
    const w = kluczKonta(p_klucz);
    if (w.blad) return w;
    const { d } = w;
    return {
      dostep: { rola: d.rola, zakres: d.zakres, opis: d.opis, wazny_do: d.wazny_do, tworzenie: d.zakres === 'pelny' && d.rola === 'edycja' },
      projekty: projektyKlucza(d).map(({ id, rola }) => {
        const p = stan.projekty.find((x) => x.id === id);
        const wl = (stan.konta || []).find((k) => k.id === p.owner_id);
        return {
          id, nazwa: p.nazwa, zmieniono: p.zmieniono, wersja: p.wersja, moja_rola: rola,
          wlasciciel: rola === 'wlasciciel' ? 'ja' : ((wl?.nazwa || '').trim() || String(wl?.email || 'właściciel').split('@')[0]),
          rola: d.rola === 'edycja' && rola !== 'odczyt' ? 'edycja' : 'odczyt',
        };
      }).sort((a, b) => String(b.zmieniono || '').localeCompare(String(a.zmieniono || ''))),
    };
  }

  function aiNowyProjekt({ p_klucz, p_id, p_nazwa, p_dane, p_strony }) {
    const w = kluczKonta(p_klucz);
    if (w.blad) return w;
    const { d } = w;
    if (d.zakres !== 'pelny' || d.rola !== 'edycja') return { blad: 'Tworzyć projekty może tylko klucz z pełnym dostępem, który czyta i zmienia (ustawienia konta → Dostęp dla AI).' };
    if (!p_id || stan.projekty.some((p) => p.id === p_id)) return { blad: 'Nieprawidłowy albo zajęty identyfikator projektu.' };
    if (typeof p_nazwa !== 'string' || !p_nazwa.trim() || p_nazwa.length > 120) return { blad: 'Nazwa projektu: niepusty tekst do 120 znaków.' };
    if (!p_dane || typeof p_dane !== 'object' || Array.isArray(p_dane)) return { blad: 'Dane projektu muszą być obiektem JSON.' };
    const ids = identyfikatory(p_strony);
    const sekcje = identyfikatory(p_dane.sekcje || []);
    if (!ids || !ids.length) return { blad: 'Projekt musi mieć co najmniej jedną stronę (lista obiektów z niepowtarzalnym „id”).' };
    if (!sekcje || !sekcje.length) return { blad: 'Projekt musi mieć co najmniej jedną sekcję.' };
    const zla = p_strony.find((s) => !sekcje.includes(s.sekcja));
    if (zla) return { blad: `Strona „${zla.id}”: „sekcja” musi wskazywać istniejącą sekcję.` };
    const teraz = new Date().toISOString();
    const dane = kopia(p_dane);
    for (const k of ['strony', 'strony_osobno', 'udostepnienie', 'podstawa_chmury', 'wersja_chmury']) delete dane[k];
    const p = {
      id: p_id, owner_id: d.owner_id, nazwa: p_nazwa.trim(), wersja: 1, zmieniono: teraz,
      dane: { ...dane, id: p_id, nazwa: p_nazwa.trim(), strony: ids, strony_osobno: true, zasoby: {}, zmieniono: teraz },
    };
    stan.projekty.push(p);
    for (const s of p_strony) stan.strony.set(`${p_id}/${s.id}`, kopia(s));
    stan.oglos?.(p, 'INSERT');
    return { id: p_id, nazwa: p.nazwa, wersja: 1 };
  }

  function aiUsunProjekt({ p_klucz, p_projekt, p_potwierdz }) {
    const w = kluczKonta(p_klucz);
    if (w.blad) return w;
    const { d } = w;
    if (d.zakres !== 'pelny' || d.rola !== 'edycja') return { blad: 'Usuwać projekty może tylko klucz z pełnym dostępem, który czyta i zmienia.' };
    const p = stan.projekty.find((x) => x.id === p_projekt);
    if (!p || p.owner_id !== d.owner_id) return { blad: 'Usunąć można tylko własny projekt konta (udostępnionego przez kogoś innego – nie).' };
    if (String(p_potwierdz || '').trim() !== p.nazwa.trim()) return { blad: `Na potwierdzenie podaj dokładną nazwę projektu: „${p.nazwa}”.` };
    stan.projekty = stan.projekty.filter((x) => x.id !== p.id);
    for (const k of [...stan.strony.keys()]) if (k.startsWith(`${p.id}/`)) stan.strony.delete(k);
    if (stan.wspolpracownicy) stan.wspolpracownicy = stan.wspolpracownicy.filter((x) => x.projekt_id !== p.id);
    stan.oglos?.(p, 'DELETE');
    return { usunieto: p.id, nazwa: p.nazwa };
  }

  function aiProjekt({ p_klucz }) {
    const d = sprawdzKlucz(p_klucz, false);
    if (d.blad) return d;
    const p = stan.projekty.find((x) => x.id === d.projekt_id);
    if (!p) return { blad: 'Projektu już nie ma.' };
    const dane = kopia(p.dane);
    for (const k of ['strony_osobno', 'podstawa_chmury', 'wersja_chmury', 'miniatura', 'udostepnienie']) delete dane[k];
    dane.strony = stronyProjektu(p);
    dane.zasoby = Object.fromEntries(Object.entries(p.dane.zasoby || {}).map(([id, z]) => [id, Object.fromEntries(
      Object.entries({ nazwa: z.nazwa, typ: z.typ, szer: z.szer, wys: z.wys, rozmiar: z.rozmiar, skrot: z.skrot }).filter(([, v]) => v !== undefined && v !== null),
    )]));
    return { dostep: { rola: d.rola, opis: d.opis, wazny_do: d.wazny_do }, wersja: p.wersja, projekt: dane };
  }

  function aiZapisz({ p_klucz, p_znana_wersja, p_zmiany }) {
    const d = sprawdzKlucz(p_klucz, true);
    if (d.blad) return d;
    const z = p_zmiany;
    if (!z || typeof z !== 'object' || Array.isArray(z)) return { blad: 'Zmiany muszą być obiektem JSON.' };
    const bledy = Object.keys(z).filter((k) => !CZESCI.includes(k)).map((k) => `Nieznana część projektu „${k}” (dozwolone: ${CZESCI.join(', ')}).`);
    if (bledy.length) return { blad: 'Zmiany odrzucone.', szczegoly: bledy };
    const p = stan.projekty.find((x) => x.id === d.projekt_id);
    if (!p) return { blad: 'Projektu już nie ma.' };
    if (p_znana_wersja == null || Number(p_znana_wersja) !== p.wersja) {
      return { konflikt: true, wersja: p.wersja, blad: `Projekt zmienił się w międzyczasie (wersja ${p.wersja}). Pobierz go na nowo i nanieś zmiany jeszcze raz.` };
    }
    const dane = kopia(p.dane);
    const strony = new Map(stronyProjektu(p).map((s) => [s.id, s]));
    let kolejnosc = [...strony.keys()];
    let zmienione = dane.strony_osobno ? [] : [...kolejnosc];

    if ('nazwa' in z && (typeof z.nazwa !== 'string' || !z.nazwa.trim() || z.nazwa.length > 120)) bledy.push('nazwa: niepusty tekst do 120 znaków.');
    for (const k of ['sekcje', 'wzorce', 'style', 'tabele', 'serie']) {
      if (!(k in z)) continue;
      if (!identyfikatory(z[k])) bledy.push(`${k}: lista obiektów, każdy z niepowtarzalnym, niepustym „id”.`);
      else dane[k] = kopia(z[k]);
    }
    if ('widok' in z) {
      if (!z.widok || typeof z.widok !== 'object' || Array.isArray(z.widok)) bledy.push('widok: obiekt.');
      else dane.widok = kopia(z.widok);
    }
    if ('strony' in z) {
      if (!identyfikatory(z.strony)) bledy.push('strony: lista obiektów stron, każda z niepowtarzalnym, niepustym „id”.');
      else {
        for (const s of z.strony) {
          if (!kolejnosc.includes(s.id)) kolejnosc.push(s.id);
          strony.set(s.id, kopia(s));
          if (!zmienione.includes(s.id)) zmienione.push(s.id);
        }
      }
    }
    if ('usun_strony' in z) {
      if (!Array.isArray(z.usun_strony)) bledy.push('usun_strony: lista identyfikatorów stron.');
      else {
        for (const id of z.usun_strony) {
          if (!kolejnosc.includes(id)) bledy.push(`usun_strony: nie ma strony „${id}”.`);
          kolejnosc = kolejnosc.filter((x) => x !== id);
          zmienione = zmienione.filter((x) => x !== id);
          strony.delete(id);
        }
      }
    }
    if ('kolejnosc_stron' in z) {
      const nowa = z.kolejnosc_stron;
      if (!Array.isArray(nowa)) bledy.push('kolejnosc_stron: lista identyfikatorów stron.');
      else if (nowa.length !== kolejnosc.length || new Set(nowa).size !== nowa.length || !nowa.every((id) => kolejnosc.includes(id))) {
        bledy.push('kolejnosc_stron: musi zawierać każdą stronę projektu dokładnie raz.');
      } else kolejnosc = [...nowa];
    }
    if (bledy.length) return { blad: 'Zmiany odrzucone.', szczegoly: bledy };

    const idSekcji = identyfikatory(dane.sekcje || []) || [];
    const idWzorcow = identyfikatory(dane.wzorce || []) || [];
    const idSerii = identyfikatory(dane.serie || []) || [];
    const idTabel = identyfikatory(dane.tabele || []) || [];
    const idZasobow = Object.keys(dane.zasoby || {});
    if (!idSekcji.length) bledy.push('Projekt musi mieć co najmniej jedną sekcję.');
    if (!kolejnosc.length) bledy.push('Projekt musi mieć co najmniej jedną stronę.');
    for (const s of dane.sekcje || []) {
      if (!s.wydruk || typeof s.wydruk !== 'object') bledy.push(`Sekcja „${s.id}”: brak „wydruk” (format, wymiary, spad, marginesy).`);
      if ('wzorce' in s && (!Array.isArray(s.wzorce) || s.wzorce.some((w) => !idWzorcow.includes(w)))) bledy.push(`Sekcja „${s.id}”: „wzorce” wskazują nieistniejący wzorzec.`);
    }
    for (const t of dane.tabele || []) {
      if (!Array.isArray(t.kolumny) || !Array.isArray(t.wiersze) || t.wiersze.some((w) => !Array.isArray(w))) bledy.push(`Tabela „${t.id}”: „kolumny” to lista nazw, a „wiersze” to lista list.`);
    }
    for (const s of dane.serie || []) {
      if (s.tabela != null && !idTabel.includes(s.tabela)) bledy.push(`Seria „${s.id}”: nie ma tabeli „${s.tabela}”.`);
      if ((s.dodatkowe || []).some((t) => !idTabel.includes(t.tabela))) bledy.push(`Seria „${s.id}”: tabela dodatkowa wskazuje nieistniejącą tabelę.`);
    }
    for (const id of kolejnosc) {
      const s = strony.get(id);
      if (!s) { bledy.push(`Brak treści strony „${id}”.`); continue; }
      if (!idSekcji.includes(s.sekcja)) bledy.push(`Strona „${id}”: „sekcja” musi wskazywać istniejącą sekcję.`);
      if ('wzorce' in s && s.wzorce !== 'z_sekcji' && (!Array.isArray(s.wzorce) || s.wzorce.some((w) => !idWzorcow.includes(w)))) bledy.push(`Strona „${id}”: „wzorce” to "z_sekcji" albo lista istniejących wzorców.`);
      if (s.seria != null && !idSerii.includes(s.seria)) bledy.push(`Strona „${id}”: nie ma serii „${s.seria}”.`);
    }
    const miejsca = [
      ...zmienione.map((id) => [`Strona „${id}”`, strony.get(id)?.obiekty]),
      ...('wzorce' in z ? (dane.wzorce || []).map((w) => [`Wzorzec „${w.id}”`, w.obiekty]) : []),
    ];
    for (const [gdzie, obiekty] of miejsca) {
      if (!Array.isArray(obiekty)) { bledy.push(`${gdzie}: „obiekty” to lista elementów.`); continue; }
      if (!identyfikatory(obiekty)) bledy.push(`${gdzie}: każdy element musi mieć niepowtarzalne, niepuste „id”.`);
      if (obiekty.some((o) => !TYPY.includes(String(o?.type || '').toLowerCase()))) bledy.push(`${gdzie}: nieznany rodzaj elementu (type) – dozwolone: ${TYPY.join(', ')}.`);
      if (zasobyWDrzewie(obiekty).some((id) => !idZasobow.includes(id))) bledy.push(`${gdzie}: obraz wskazuje zasób, którego nie ma w projekcie (z klucza nie da się wgrać nowych obrazów).`);
    }
    if (bledy.length) return { blad: 'Zmiany odrzucone – projekt byłby niespójny.', szczegoly: bledy.slice(0, 20) };

    const teraz = new Date().toISOString();
    Object.assign(dane, { strony: kolejnosc, strony_osobno: true, zmieniono: teraz });
    if ('nazwa' in z) dane.nazwa = z.nazwa;
    Object.assign(p, { nazwa: 'nazwa' in z ? z.nazwa : p.nazwa, dane, zmieniono: teraz, wersja: p.wersja + 1 });
    for (const id of zmienione) stan.strony.set(`${p.id}/${id}`, strony.get(id));
    for (const k of [...stan.strony.keys()]) if (k.startsWith(`${p.id}/`) && !kolejnosc.includes(k.slice(p.id.length + 1))) stan.strony.delete(k);
    stan.oglos?.(p);
    return { wersja: p.wersja, strony_zapisane: zmienione.length };
  }

  // Obrazy od AI (migracja 20261112090000_obrazy_ai.sql): plik czeka w stan.obrazyAi, w projekcie wpis
  // zasobu ze ścieżką „ai:<id>”. Te same zasady: ten sam skrót → obraz, który już jest; zajęta nazwa → „(2)”;
  // zastąp → nowe id, przepięte elementy, stary do nagrobków.
  stan.obrazyAi = stan.obrazyAi || new Map();
  const SYGNATURY = {
    'image/png': (b) => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
    'image/jpeg': (b) => b.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
    'image/gif': (b) => b.subarray(0, 4).toString('latin1') === 'GIF8',
    'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
    'image/svg+xml': (b) => b.subarray(0, 8192).includes('<svg'),
  };
  // Wspólne części (migracja 20261112150000_obrazy_ai_kawalki.sql: ai_obraz_nazwa, ai_obraz_istniejacy, ai_obraz_dopisz).
  const KAWALEK = 512 * 1024;
  const nazwaObrazu = (p_nazwa, p_typ) => {
    let nazwa = String(p_nazwa || '').replace(/^.*[\\/]/, '').replace(/[\u0000-\u001f]/g, '').trim() || 'obraz';
    nazwa = nazwa.slice(0, 150);
    if (!/\.[a-z0-9]{2,5}$/i.test(nazwa)) nazwa += { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }[p_typ] || '.svg';
    return nazwa;
  };
  const istniejacy = (p, skrot, typ, szer, wys, rozmiar) => {
    const czcionki = (p.dane.czcionki || []).map((c) => c.id);
    for (const [id, z] of Object.entries(p.dane.zasoby || {})) {
      if (!czcionki.includes(id) && z.skrot === skrot) {
        return { id, nazwa: z.nazwa, typ: z.typ || typ, szer: z.szer ?? szer, wys: z.wys ?? wys, rozmiar, byl: true, wersja: p.wersja };
      }
    }
    return null;
  };
  const oczekujace = (p) => [...stan.obrazyAi.values()].filter((o) => o.projekt_id === p.id).reduce((n, o) => n + o.rozmiar, 0);
  const ZA_DUZO = 'Na przeniesienie czeka już za dużo obrazów (150 MB). Właściciel musi otworzyć projekt w aplikacji – wtedy obrazy przejdą na jego konto i miejsce się zwolni.';

  function dopisz(wiersz) {
    const o = stan.obrazyAi.get(wiersz);
    if (!o) return { blad: 'Nie ma takiego wgrania (mogło wygasnąć po dobie).' };
    const p = stan.projekty.find((x) => x.id === o.projekt_id);
    if (!p) return { blad: 'Projektu już nie ma.' };
    const byl = istniejacy(p, o.skrot, o.typ, o.szer, o.wys, o.rozmiar);
    if (byl) { stan.obrazyAi.delete(wiersz); return byl; }
    const zasoby = p.dane.zasoby || {};
    const czcionki = (p.dane.czcionki || []).map((c) => c.id);
    let { nazwa } = o;
    if (o.zastap) {
      if (!zasoby[o.zastap] || czcionki.includes(o.zastap)) { stan.obrazyAi.delete(wiersz); return { blad: `Nie ma obrazu „${o.zastap}” do zastąpienia (lista: obrazy_projektu).` }; }
      nazwa = zasoby[o.zastap].nazwa;
    } else {
      const rdzen = nazwa.replace(/(\.[A-Za-z0-9]{2,5})$/, '');
      const roz = /(\.[A-Za-z0-9]{2,5})$/.exec(nazwa)?.[1] || '';
      const zajeta = (n) => Object.entries(zasoby).some(([id, z]) => !czcionki.includes(id) && String(z.nazwa).trim().toLowerCase() === n.toLowerCase());
      for (let n = 2; zajeta(nazwa); n += 1) nazwa = `${rdzen} (${n})${roz}`;
    }
    Object.assign(o, { nazwa, gotowy: true });
    const id = `z_ai${wiersz.replace(/-/g, '').slice(0, 12)}`;
    const wpis = { nazwa, typ: o.typ, rozmiar: o.rozmiar, skrot: o.skrot, ...(o.szer ? { szer: o.szer } : {}), ...(o.wys ? { wys: o.wys } : {}), sciezka: `ai:${wiersz}` };
    let dane = { ...p.dane, zasoby: { ...zasoby, [id]: wpis } };
    if (o.zastap) {
      const stary = zasoby[o.zastap];
      delete dane.zasoby[o.zastap];
      dane.zasoby_usuniete = [...new Set([...(dane.zasoby_usuniete || []), o.zastap])];
      const przepnij = (t) => t.split(`"zasob":${JSON.stringify(o.zastap)}`).join(`"zasob":${JSON.stringify(id)}`)
        .split(JSON.stringify(`zasob:${o.zastap}`)).join(JSON.stringify(`zasob:${id}`));
      dane = JSON.parse(przepnij(JSON.stringify(dane)));
      for (const [k, s] of stan.strony) if (k.startsWith(`${p.id}/`)) stan.strony.set(k, JSON.parse(przepnij(JSON.stringify(s))));
      odlozPlik(p, stary.sciezka, dane.zasoby);
    }
    const teraz = new Date().toISOString();
    Object.assign(p, { dane: { ...dane, zmieniono: teraz }, zmieniono: teraz, wersja: p.wersja + 1 });
    stan.oglos?.(p);
    return {
      id, nazwa, typ: o.typ, ...(o.szer ? { szer: o.szer } : {}), ...(o.wys ? { wys: o.wys } : {}), rozmiar: o.rozmiar, byl: false,
      nazwa_zmieniona: !o.zastap && nazwa !== o.nazwa_prosba, ...(o.zastap ? { zastapiony: o.zastap } : {}), wersja: p.wersja,
    };
  }

  // Mały plik jednym zapytaniem (do 1 MB).
  function aiWgrajObraz({ p_klucz, p_nazwa, p_typ, p_dane, p_szer = null, p_wys = null, p_zastap = null }) {
    const d = sprawdzKlucz(p_klucz, true);
    if (d.blad) return d;
    if (!SYGNATURY[p_typ]) return { blad: 'Obsługiwane obrazy: PNG, JPEG, WebP, GIF i SVG.' };
    const bajty = Buffer.from(String(p_dane || ''), 'base64');
    if (!bajty.length) return { blad: 'Plik jest pusty.' };
    if (bajty.length > 1024 * 1024) return { blad: 'Plik jest za duży na jedno zapytanie (najwyżej 1 MB). Większy wgraj w kawałkach: ai_wgraj_poczatek, ai_wgraj_czesc, ai_wgraj_koniec – albo wyślij go wprost: POST …/functions/v1/mcp/<klucz>/obraz (do 25 MB).' };
    if (!SYGNATURY[p_typ](bajty)) return { blad: `Treść pliku nie pasuje do jego rodzaju (${p_typ}).` };
    const skrot = crypto.createHash('sha256').update(bajty).digest('hex');
    const p = stan.projekty.find((x) => x.id === d.projekt_id);
    if (!p) return { blad: 'Projektu już nie ma.' };
    const byl = istniejacy(p, skrot, p_typ, p_szer, p_wys, bajty.length);
    if (byl) return byl;
    if (p_zastap && !(p.dane.zasoby || {})[p_zastap]) return { blad: `Nie ma obrazu „${p_zastap}” do zastąpienia (lista: obrazy_projektu).` };
    if (oczekujace(p) + bajty.length > 150 * 1024 * 1024) return { blad: ZA_DUZO };
    const wiersz = crypto.randomUUID();
    stan.obrazyAi.set(wiersz, {
      projekt_id: p.id, owner_id: p.owner_id, nazwa: nazwaObrazu(p_nazwa, p_typ), nazwa_prosba: String(p_nazwa || '').trim(), typ: p_typ,
      rozmiar: bajty.length, skrot, dane: bajty, szer: p_szer, wys: p_wys, zastap: p_zastap, gotowy: false, utworzono: Date.now(),
    });
    return dopisz(wiersz);
  }

  // Większy plik w kawałkach po 512 KB: początek → kawałki → koniec.
  function aiWgrajPoczatek({ p_klucz, p_nazwa, p_typ, p_rozmiar, p_skrot, p_szer = null, p_wys = null, p_zastap = null, p_kawalek = null }) {
    const kawalek = p_kawalek ?? KAWALEK;
    if (kawalek < 16 * 1024 || kawalek > KAWALEK) return { blad: 'Wielkość kawałka (p_kawalek): od 16 KB do 512 KB.' };
    const d = sprawdzKlucz(p_klucz, true);
    if (d.blad) return d;
    if (!SYGNATURY[p_typ]) return { blad: 'Obsługiwane obrazy: PNG, JPEG, WebP, GIF i SVG.' };
    if (!(p_rozmiar >= 1)) return { blad: 'Podaj rozmiar pliku w bajtach (p_rozmiar).' };
    if (p_rozmiar > 25 * 1024 * 1024) return { blad: 'Plik jest za duży (najwyżej 25 MB).' };
    if (!/^[0-9a-f]{64}$/.test(String(p_skrot || ''))) return { blad: 'p_skrot to SHA-256 treści pliku: 64 znaki szesnastkowe (małe litery).' };
    const p = stan.projekty.find((x) => x.id === d.projekt_id);
    if (!p) return { blad: 'Projektu już nie ma.' };
    const byl = istniejacy(p, p_skrot, p_typ, p_szer, p_wys, p_rozmiar);
    if (byl) return byl;
    if (p_zastap && !(p.dane.zasoby || {})[p_zastap]) return { blad: `Nie ma obrazu „${p_zastap}” do zastąpienia (lista: obrazy_projektu).` };
    for (const [k, o] of stan.obrazyAi) if (o.projekt_id === p.id && !o.gotowy && Date.now() - o.utworzono > 86400000) stan.obrazyAi.delete(k);
    if (oczekujace(p) + p_rozmiar > 150 * 1024 * 1024) return { blad: ZA_DUZO };
    const czesci = Math.ceil(p_rozmiar / kawalek);
    const wiersz = crypto.randomUUID();
    stan.obrazyAi.set(wiersz, {
      projekt_id: p.id, owner_id: p.owner_id, nazwa: nazwaObrazu(p_nazwa, p_typ), nazwa_prosba: String(p_nazwa || '').trim(), typ: p_typ,
      rozmiar: p_rozmiar, skrot: p_skrot, dane: null, czesci, kawalki: new Map(), szer: p_szer, wys: p_wys, zastap: p_zastap, gotowy: false, utworzono: Date.now(),
    });
    return { wiersz, kawalek, czesci };
  }
  const wgranieKlucza = (d, wiersz) => {
    const o = stan.obrazyAi.get(wiersz);
    return o && o.projekt_id === d.projekt_id && !o.gotowy ? o : null;
  };
  function aiWgrajCzesc({ p_klucz, p_wiersz, p_nr, p_dane }) {
    const d = sprawdzKlucz(p_klucz, true);
    if (d.blad) return d;
    const o = wgranieKlucza(d, p_wiersz);
    if (!o) return { blad: 'Nie ma takiego wgrania albo jest już zakończone.' };
    if (!Number.isInteger(p_nr) || p_nr < 0 || p_nr >= o.czesci) return { blad: `Numer kawałka: od 0 do ${o.czesci - 1}.` };
    const bajty = Buffer.from(String(p_dane || ''), 'base64');
    if (!bajty.length || bajty.length > KAWALEK) return { blad: 'Kawałek jest pusty albo za duży (najwyżej 512 KB).' };
    o.kawalki.set(p_nr, bajty);
    stan.kawalkiWgrane = (stan.kawalkiWgrane || 0) + 1;
    return { ok: true };
  }
  function aiWgrajKoniec({ p_klucz, p_wiersz }) {
    const d = sprawdzKlucz(p_klucz, true);
    if (d.blad) return d;
    const o = wgranieKlucza(d, p_wiersz);
    if (!o) return { blad: 'Nie ma takiego wgrania albo jest już zakończone.' };
    const brakujace = [];
    for (let n = 0; n < o.czesci; n += 1) if (!o.kawalki.has(n)) brakujace.push(n);
    if (brakujace.length) return { blad: `Brakuje kawałków: jest ${o.czesci - brakujace.length} z ${o.czesci}.`, brakujace };
    const suma = [...o.kawalki.values()].reduce((n, b) => n + b.length, 0);
    if (suma !== o.rozmiar) return { blad: `Kawałki mają razem ${suma} bajtów, a plik – ${o.rozmiar}.` };
    if (!SYGNATURY[o.typ](o.kawalki.get(0))) { stan.obrazyAi.delete(p_wiersz); return { blad: `Treść pliku nie pasuje do jego rodzaju (${o.typ}).` }; }
    return dopisz(p_wiersz);
  }

  // Plik, który przestał być potrzebny (ai_odloz_plik): czekający w obrazyAi znika, plik z folderu
  // trafia do stan.doUsuniecia (Map: projekt → Set ścieżek) – sprząta go aplikacja.
  stan.doUsuniecia = stan.doUsuniecia || new Map();
  function odlozPlik(p, sciezka, zasoby) {
    if (!sciezka || Object.values(zasoby || {}).some((z) => z.sciezka === sciezka)) return;
    if (sciezka.startsWith('ai:')) { stan.obrazyAi.delete(sciezka.slice(3)); return; }
    if (!sciezka.startsWith(`${p.owner_id}/${p.id}/`)) return;
    if (!stan.doUsuniecia.has(p.id)) stan.doUsuniecia.set(p.id, new Set());
    stan.doUsuniecia.get(p.id).add(sciezka);
  }

  function aiZmienObrazy({ p_klucz, p_kopie = {}, p_usun = [] }) {
    const d = sprawdzKlucz(p_klucz, true);
    if (d.blad) return d;
    const p = stan.projekty.find((x) => x.id === d.projekt_id);
    if (!p) return { blad: 'Projektu już nie ma.' };
    const zasoby = { ...(p.dane.zasoby || {}) };
    const czcionki = (p.dane.czcionki || []).map((c) => c.id);
    let usuniete = [...(p.dane.zasoby_usuniete || [])];
    const bledy = [];
    for (const [k, v] of Object.entries(p_kopie || {})) {
      const nazwa = String(v?.nazwa || '').trim();
      if (!/^z_[A-Za-z0-9_]{4,40}$/.test(k) || zasoby[k] || usuniete.includes(k)) bledy.push(`Nowe id „${k}” jest nieprawidłowe albo zajęte.`);
      else if (!zasoby[v.z] || czcionki.includes(v.z)) bledy.push(`Nie ma obrazu „${v.z}”.`);
      else if (!nazwa || nazwa.length > 150 || /[/\\\u0000-\u001f]/.test(nazwa) || !/\.[a-z0-9]{2,5}$/i.test(nazwa)) bledy.push(`Nazwa „${nazwa}”: niepusta, do 150 znaków, z rozszerzeniem, bez ukośników.`);
      else zasoby[k] = { ...zasoby[v.z], nazwa };
    }
    const uzyte = new Set(zasobyWDrzewie([stronyProjektu(p), p.dane.wzorce || []]));
    for (const id of p_usun || []) {
      if (!zasoby[id] || czcionki.includes(id)) bledy.push(`Nie ma obrazu „${id}”.`);
      else if (uzyte.has(id)) bledy.push(`Obraz „${zasoby[id].nazwa}” jest jeszcze na stronie albo we wzorcu – nie usuwam go.`);
    }
    if (bledy.length) return { blad: 'Zmiany obrazów odrzucone.', szczegoly: bledy };
    for (const id of p_usun || []) {
      const { sciezka } = zasoby[id];
      delete zasoby[id];
      usuniete = [...new Set([...usuniete, id])];
      odlozPlik(p, sciezka, zasoby);
    }
    for (const [k, v] of Object.entries(p_kopie || {})) {
      const n = String(v.nazwa).trim().toLowerCase();
      if (Object.entries(zasoby).some(([id, z]) => id !== k && id !== v.z && !czcionki.includes(id) && String(z.nazwa).trim().toLowerCase() === n)) {
        return { blad: `Nazwa „${String(v.nazwa).trim()}” jest już zajęta przez inny obraz – wybierz inną.` };
      }
    }
    const teraz = new Date().toISOString();
    Object.assign(p, { dane: { ...p.dane, zasoby, zasoby_usuniete: usuniete, zmieniono: teraz }, zmieniono: teraz, wersja: p.wersja + 1 });
    stan.oglos?.(p);
    return { wersja: p.wersja };
  }

  // Funkcje bazy według nazwy; konto – zalogowany właściciel (dla funkcji właściciela).
  return function wywolaj(funkcja, tresc, konto) {
    if (funkcja === 'ai_projekt') return aiProjekt(tresc);
    if (funkcja === 'ai_projekty') return aiProjekty(tresc);
    if (funkcja === 'ai_nowy_projekt') return aiNowyProjekt(tresc);
    if (funkcja === 'ai_usun_projekt') return aiUsunProjekt(tresc);
    if (funkcja === 'ai_zapisz') return aiZapisz(tresc);
    // Jedno zapytanie z całym dużym plikiem nie mieści się w limicie czasu bazy (rola anon) – tak jak na produkcji.
    if (/^ai_/.test(funkcja) && JSON.stringify(tresc || {}).length > 1.5 * 1024 * 1024) blad(500, 'canceling statement due to statement timeout');
    if (funkcja === 'ai_wgraj_obraz') return aiWgrajObraz(tresc);
    if (funkcja === 'ai_wgraj_poczatek') return aiWgrajPoczatek(tresc);
    if (funkcja === 'ai_wgraj_czesc') return aiWgrajCzesc(tresc);
    if (funkcja === 'ai_wgraj_koniec') return aiWgrajKoniec(tresc);
    if (funkcja === 'ai_zmien_obrazy') return aiZmienObrazy(tresc);
    if (funkcja === 'pliki_do_usuniecia' || funkcja === 'pliki_usuniete') {
      if (!konto) blad(401, 'Brak sesji');
      const p = stan.projekty.find((x) => x.id === tresc.p_projekt && x.owner_id === konto.id);
      const lista = (p && stan.doUsuniecia.get(p.id)) || new Set();
      if (funkcja === 'pliki_do_usuniecia') return [...lista];
      for (const s of tresc.p_sciezki || []) lista.delete(s);
      return null;
    }
    if (funkcja === 'pobierz_obraz_ai' || funkcja === 'usun_obraz_ai') {
      if (!konto) blad(401, 'Brak sesji');
      const o = stan.obrazyAi.get(tresc.p_id);
      if (funkcja === 'usun_obraz_ai') { if (o && o.owner_id === konto.id) stan.obrazyAi.delete(tresc.p_id); return null; }
      if (!o || o.owner_id !== konto.id || !o.gotowy) blad(400, 'Nie ma takiego obrazu (mógł już przejść na konto)');
      if (!o.dane) return { typ: o.typ, nazwa: o.nazwa, rozmiar: o.rozmiar, skrot: o.skrot, czesci: o.czesci };
      return { typ: o.typ, nazwa: o.nazwa, dane: o.dane.toString('base64') };
    }
    if (funkcja === 'pobierz_czesc_obrazu_ai') {
      if (!konto) blad(401, 'Brak sesji');
      const o = stan.obrazyAi.get(tresc.p_id);
      const b = o && o.owner_id === konto.id && o.gotowy && o.kawalki?.get(tresc.p_nr);
      if (!b) blad(400, 'Nie ma takiego kawałka obrazu');
      stan.kawalkiPobrane = (stan.kawalkiPobrane || 0) + 1;
      return b.toString('base64');
    }
    if (!['utworz_dostep_ai', 'dostepy_ai', 'odwolaj_dostep_ai', 'zmien_dostep_ai'].includes(funkcja)) return undefined;
    if (!konto) blad(401, 'Brak sesji');
    const projektyZakresu = (zakres, lista) => {
      if (!['wybrane', 'pelny'].includes(zakres)) blad(400, 'Zakres klucza: wybrane projekty albo pełny dostęp');
      const ids = [...new Set(lista || [])];
      if (zakres === 'pelny') return [];
      if (!ids.length) blad(400, 'Wybierz co najmniej jeden projekt');
      if (ids.some((x) => !rolaKonta(konto.id, x))) blad(400, 'Nie masz dostępu do któregoś z wybranych projektów');
      return ids;
    };
    if (funkcja === 'utworz_dostep_ai') {
      if (!['odczyt', 'edycja'].includes(tresc.p_rola)) blad(400, 'Nieznana rola dostępu');
      if (tresc.p_dni != null && !(tresc.p_dni >= 1 && tresc.p_dni <= 365)) blad(400, 'Ważność klucza: od 1 do 365 dni albo bez terminu');
      const zakres = tresc.p_zakres || 'wybrane';
      const projekty = projektyZakresu(zakres, tresc.p_projekty);
      if (stan.dostepy.filter((x) => x.owner_id === konto.id && !x.odwolany && (!x.wazny_do || new Date(x.wazny_do) > new Date())).length >= 20) blad(400, 'Masz już 20 aktywnych kluczy – odbierz któryś');
      const id = crypto.randomUUID();
      const sekret = crypto.randomBytes(32).toString('base64url');
      const wazny_do = tresc.p_dni == null ? null : new Date(Date.now() + tresc.p_dni * 86400000).toISOString();
      stan.dostepy.push({
        id, owner_id: konto.id, rola: tresc.p_rola, opis: String(tresc.p_opis || '').trim().slice(0, 120), zakres, projekty,
        wazny_do, utworzono: new Date().toISOString(), ostatnie_uzycie: null, odwolany: null, sekret, nieudane: 0, blokada_do: null,
      });
      return { id, klucz: `sdk_${id.replace(/-/g, '')}_${sekret}`, wazny_do };
    }
    if (funkcja === 'dostepy_ai') {
      return stan.dostepy.filter((x) => x.owner_id === konto.id).reverse()
        .map(({ id, opis, rola, zakres, projekty, wazny_do, utworzono, ostatnie_uzycie, odwolany }) => ({
          id, opis, rola, zakres, wazny_do, utworzono, ostatnie_uzycie, odwolany,
          aktywny: !odwolany && (!wazny_do || new Date(wazny_do) > new Date()),
          projekty: projekty.map((pid) => stan.projekty.find((p) => p.id === pid)).filter((p) => p && rolaKonta(konto.id, p.id))
            .map((p) => ({ id: p.id, nazwa: p.nazwa })).sort((a, b) => a.nazwa.localeCompare(b.nazwa)),
        }));
    }
    if (funkcja === 'zmien_dostep_ai') {
      const d = stan.dostepy.find((x) => x.id === tresc.p_id && x.owner_id === konto.id);
      if (!d) blad(400, 'Nie ma takiego klucza na tym koncie');
      d.projekty = projektyZakresu(tresc.p_zakres, tresc.p_projekty);
      d.zakres = tresc.p_zakres;
      return null;
    }
    const d = stan.dostepy.find((x) => x.id === tresc.p_id && x.owner_id === konto.id);
    if (d && !d.odwolany) d.odwolany = new Date().toISOString();
    return null;
  };
}

module.exports = { atrapaAi };
