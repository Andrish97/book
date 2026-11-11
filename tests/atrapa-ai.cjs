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

  function sprawdzKlucz(klucz, edycja) {
    const m = /^sdk_([0-9a-f]{32})_([A-Za-z0-9_-]{20,100})$/.exec(String(klucz || ''));
    if (!m) return { blad: 'Nieprawidłowy klucz dostępu.' };
    const d = stan.dostepy.find((x) => x.id.replace(/-/g, '') === m[1]);
    if (!d) return { blad: 'Nieprawidłowy klucz dostępu.' };
    if (d.blokada_do && d.blokada_do > Date.now()) return { blad: 'Klucz jest chwilowo zablokowany po wielu złych próbach. Spróbuj za kilkanaście minut.' };
    if (d.sekret !== m[2]) {
      d.nieudane += 1;
      if (d.nieudane >= 10) d.blokada_do = Date.now() + 15 * 60000;
      return { blad: 'Nieprawidłowy klucz dostępu.' };
    }
    if (d.odwolany) return { blad: 'Dostęp został odebrany przez właściciela projektu.' };
    if (new Date(d.wazny_do) <= new Date()) return { blad: 'Klucz dostępu wygasł. Poproś właściciela projektu o nowy.' };
    d.nieudane = 0;
    d.ostatnie_uzycie = new Date().toISOString();
    if (edycja && d.rola !== 'edycja') return { blad: 'Ten klucz pozwala tylko czytać projekt.' };
    return d;
  }

  function aiProjekt({ p_klucz }) {
    const d = sprawdzKlucz(p_klucz, false);
    if (d.blad) return d;
    const p = stan.projekty.find((x) => x.id === d.projekt_id);
    if (!p) return { blad: 'Projektu już nie ma.' };
    const dane = kopia(p.dane);
    for (const k of ['strony_osobno', 'podstawa_chmury', 'wersja_chmury', 'miniatura', 'udostepnienie']) delete dane[k];
    dane.strony = stronyProjektu(p);
    dane.zasoby = Object.fromEntries(Object.entries(p.dane.zasoby || {}).map(([id, z]) => [id, { nazwa: z.nazwa, typ: z.typ }]));
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

  // Funkcje bazy według nazwy; konto – zalogowany właściciel (dla funkcji właściciela).
  return function wywolaj(funkcja, tresc, konto) {
    if (funkcja === 'ai_projekt') return aiProjekt(tresc);
    if (funkcja === 'ai_zapisz') return aiZapisz(tresc);
    if (!['utworz_dostep_ai', 'dostepy_ai', 'odwolaj_dostep_ai'].includes(funkcja)) return undefined;
    if (!konto) blad(401, 'Brak sesji');
    if (funkcja === 'utworz_dostep_ai') {
      if (!stan.projekty.some((p) => p.id === tresc.p_projekt && p.owner_id === konto.id)) blad(400, 'Nie ma takiego projektu na tym koncie');
      if (!['odczyt', 'edycja'].includes(tresc.p_rola)) blad(400, 'Nieznana rola dostępu');
      if (!(tresc.p_dni >= 1 && tresc.p_dni <= 90)) blad(400, 'Ważność dostępu: od 1 do 90 dni');
      const id = crypto.randomUUID();
      const sekret = crypto.randomBytes(32).toString('base64url');
      const wazny_do = new Date(Date.now() + tresc.p_dni * 86400000).toISOString();
      stan.dostepy.push({
        id, projekt_id: tresc.p_projekt, owner_id: konto.id, rola: tresc.p_rola, opis: String(tresc.p_opis || '').trim().slice(0, 120),
        wazny_do, utworzono: new Date().toISOString(), ostatnie_uzycie: null, odwolany: null, sekret, nieudane: 0, blokada_do: null,
      });
      return { id, klucz: `sdk_${id.replace(/-/g, '')}_${sekret}`, wazny_do };
    }
    if (funkcja === 'dostepy_ai') {
      return stan.dostepy.filter((x) => x.projekt_id === tresc.p_projekt && x.owner_id === konto.id).reverse()
        .map(({ id, opis, rola, wazny_do, utworzono, ostatnie_uzycie, odwolany }) => ({
          id, opis, rola, wazny_do, utworzono, ostatnie_uzycie, odwolany, aktywny: !odwolany && new Date(wazny_do) > new Date(),
        }));
    }
    const d = stan.dostepy.find((x) => x.id === tresc.p_id && x.owner_id === konto.id);
    if (d && !d.odwolany) d.odwolany = new Date().toISOString();
    return null;
  };
}

module.exports = { atrapaAi };
