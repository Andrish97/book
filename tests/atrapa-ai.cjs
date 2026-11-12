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
  function aiWgrajObraz({ p_klucz, p_nazwa, p_typ, p_dane, p_szer = null, p_wys = null, p_zastap = null }) {
    const d = sprawdzKlucz(p_klucz, true);
    if (d.blad) return d;
    if (!SYGNATURY[p_typ]) return { blad: 'Obsługiwane obrazy: PNG, JPEG, WebP, GIF i SVG.' };
    const bajty = Buffer.from(String(p_dane || ''), 'base64');
    if (!bajty.length) return { blad: 'Plik jest pusty.' };
    if (bajty.length > 15 * 1024 * 1024) return { blad: 'Plik jest za duży (najwyżej 15 MB).' };
    if (!SYGNATURY[p_typ](bajty)) return { blad: `Treść pliku nie pasuje do jego rodzaju (${p_typ}).` };
    const skrot = crypto.createHash('sha256').update(bajty).digest('hex');
    let nazwa = String(p_nazwa || '').replace(/^.*[\\/]/, '').replace(/[\u0000-\u001f]/g, '').trim() || 'obraz';
    nazwa = nazwa.slice(0, 150);
    if (!/\.[a-z0-9]{2,5}$/i.test(nazwa)) nazwa += { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }[p_typ] || '.svg';
    const p = stan.projekty.find((x) => x.id === d.projekt_id);
    if (!p) return { blad: 'Projektu już nie ma.' };
    const zasoby = p.dane.zasoby || {};
    const czcionki = (p.dane.czcionki || []).map((c) => c.id);
    for (const [id, z] of Object.entries(zasoby)) {
      if (!czcionki.includes(id) && z.skrot === skrot) {
        return { id, nazwa: z.nazwa, typ: z.typ || p_typ, szer: z.szer ?? p_szer, wys: z.wys ?? p_wys, rozmiar: bajty.length, byl: true, wersja: p.wersja };
      }
    }
    if (p_zastap) {
      if (!zasoby[p_zastap] || czcionki.includes(p_zastap)) return { blad: `Nie ma obrazu „${p_zastap}” do zastąpienia (lista: obrazy_projektu).` };
      nazwa = zasoby[p_zastap].nazwa;
    } else {
      const rdzen = nazwa.replace(/(\.[A-Za-z0-9]{2,5})$/, '');
      const roz = /(\.[A-Za-z0-9]{2,5})$/.exec(nazwa)?.[1] || '';
      const zajeta = (n) => Object.entries(zasoby).some(([id, z]) => !czcionki.includes(id) && String(z.nazwa).trim().toLowerCase() === n.toLowerCase());
      for (let n = 2; zajeta(nazwa); n += 1) nazwa = `${rdzen} (${n})${roz}`;
    }
    const wiersz = crypto.randomUUID();
    stan.obrazyAi.set(wiersz, { projekt_id: p.id, owner_id: p.owner_id, nazwa, typ: p_typ, dane: bajty, skrot });
    const id = `z_ai${wiersz.replace(/-/g, '').slice(0, 12)}`;
    const wpis = { nazwa, typ: p_typ, rozmiar: bajty.length, skrot, ...(p_szer ? { szer: p_szer } : {}), ...(p_wys ? { wys: p_wys } : {}), sciezka: `ai:${wiersz}` };
    let dane = { ...p.dane, zasoby: { ...zasoby, [id]: wpis } };
    if (p_zastap) {
      const stary = zasoby[p_zastap];
      delete dane.zasoby[p_zastap];
      dane.zasoby_usuniete = [...new Set([...(dane.zasoby_usuniete || []), p_zastap])];
      const przepnij = (t) => t.split(`"zasob":${JSON.stringify(p_zastap)}`).join(`"zasob":${JSON.stringify(id)}`)
        .split(JSON.stringify(`zasob:${p_zastap}`)).join(JSON.stringify(`zasob:${id}`));
      dane = JSON.parse(przepnij(JSON.stringify(dane)));
      for (const [k, s] of stan.strony) if (k.startsWith(`${p.id}/`)) stan.strony.set(k, JSON.parse(przepnij(JSON.stringify(s))));
      odlozPlik(p, stary.sciezka, dane.zasoby);
    }
    const teraz = new Date().toISOString();
    Object.assign(p, { dane: { ...dane, zmieniono: teraz }, zmieniono: teraz, wersja: p.wersja + 1 });
    stan.oglos?.(p);
    return {
      id, nazwa, typ: p_typ, ...(p_szer ? { szer: p_szer } : {}), ...(p_wys ? { wys: p_wys } : {}), rozmiar: bajty.length, byl: false,
      nazwa_zmieniona: !p_zastap && nazwa !== String(p_nazwa || '').trim(), ...(p_zastap ? { zastapiony: p_zastap } : {}), wersja: p.wersja,
    };
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
    if (funkcja === 'ai_zapisz') return aiZapisz(tresc);
    if (funkcja === 'ai_wgraj_obraz') return aiWgrajObraz(tresc);
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
      if (!o || o.owner_id !== konto.id) blad(400, 'Nie ma takiego obrazu (mógł już przejść na konto)');
      return { typ: o.typ, nazwa: o.nazwa, dane: o.dane.toString('base64') };
    }
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
