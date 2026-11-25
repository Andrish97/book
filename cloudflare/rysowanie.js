// Rysowanie stron linku na serwerze (#335) – tylko ciężkie zlecenia (dużo stron do narysowania); drobne zmiany
// rysuje dalej urządzenie użytkownika. Przeglądarka Cloudflare (Browser Rendering, binding PRZEGLADARKA) otwiera
// lekką stronę aplikacji rysuj.html (sam silnik płótna i moduły składania stron – bez logowania i reszty aplikacji)
// i rysuje te same obrazy co aplikacja.
//
// Bezpieczeństwo:
// * zlecić może tylko zalogowany użytkownik i tylko do własnego folderu linku (<konto>/<projekt>/<kod>, jak przy
//   zapisie pliku linku przez worker); link z hasłem – folder z aktualnym sekretem (link_chroniony_wazny);
// * obrazy i czcionki projektu – tylko te, do których zlecający ma dostęp (dostep_do_plikow), sprawdzone przy
//   zleceniu; strona dostaje wyłącznie pliki z tej listy;
// * klucze zostają w workerze; przeglądarka nie ma sesji ani kluczy, a ruch sieciowy ma zamknięty: tylko pliki
//   aplikacji (js, css, czcionki) – reszta jest blokowana;
// * zapis tylko w folderze tego linku; jedno rysowanie naraz na projekt (Durable Object); dzienny limit stron
//   na konto; zlecenie (projekt) leży w R2 tylko do końca rysowania.

export const LIMIT_STRON_DZIENNIE = 5000;
export const MAKS_ZLECENIA = 20 * 1024 * 1024; // projekt w zleceniu (JSON)
const APLIKACJA = 'https://makietka.app';
const KOD_LINKU = /^[0-9a-f]{16,64}$/;
const SEKRET = /^[0-9a-f]{16,128}$/;
const ID = /^[\w-]{1,80}$/;

// Ścieżki plików projektu (obrazy, czcionki) w magazynie konta: „<właściciel>/<projekt>/…”.
export function sciezkiZasobow(projekt) {
  return [...new Set(Object.values(projekt?.zasoby || {}).map((z) => z?.sciezka).filter((s) => typeof s === 'string' && !s.startsWith('ai:')))];
}

// Czy adres może pobrać przeglądarka rysująca: tylko pliki aplikacji (i dane wewnątrz strony).
export function dozwolonyAdres(adres, aplikacja = APLIKACJA) {
  if (/^(data|blob):/.test(adres)) return true;
  let u;
  try { u = new URL(adres); } catch { return false; }
  if (u.origin !== new URL(aplikacja).origin) return false;
  // /rysuj – hosting Cloudflare (pliki strony) przekierowuje /rysuj.html na adres bez „.html” (307); bez tego
  // przekierowanie było blokowane i pliki PDF/PNG robione na serwerze kończyły się net::ERR_FAILED.
  return ['/rysuj.html', '/rysuj'].includes(u.pathname) || /^\/(js|css)\//.test(u.pathname) || u.pathname === '/favicon.ico';
}

// Folder linku ze zlecenia: „<uid>/<projekt>/<kod>” albo „<uid>/<projekt>/<kod>.<sekret>” (link z ochroną).
export function sprawdzFolder(folder, uid, idProjektu) {
  const c = String(folder || '').split('/');
  if (c.length !== 3 || c[0] !== uid || c[1] !== idProjektu) return null;
  const [kod, sekret, nadmiar] = c[2].split('.');
  if (!KOD_LINKU.test(kod) || nadmiar !== undefined || (sekret !== undefined && !SEKRET.test(sekret))) return null;
  return { kod, chroniony: sekret !== undefined, nazwa: c[2] };
}

const kluczZlecenia = (uid, idProjektu, rodzaj = 'link') => `zadania/${uid}/${idProjektu}${rodzaj === 'pdf' ? '.pdf' : ''}.json`;
const obiektKolejki = (env, uid, idProjektu, rodzaj = 'link') => env.RYSOWANIE.get(env.RYSOWANIE.idFromName(`${rodzaj === 'pdf' ? 'pdf' : 'link'}:${uid}:${idProjektu}`));
// Plik PDF zrobiony na serwerze dla okna „Eksportuj do PDF” (#338) – na koncie zlecającego, aplikacja pobiera i usuwa.
export const plikPdfSerwera = (uid, idProjektu) => `${uid}/_eksporty/serwer-${idProjektu}.pdf`;

// POST /rysuj/link { projekt, folder, pelna } – zlecenie; GET /rysuj/stan?projekt=… – postęp.
// pomoc: funkcje workera (api-worker.js) – json, cors, tokenZZapytania, uzytkownik, dostep, linkChronionyWazny.
export async function obsluzRysowanie(zapytanie, env, u, pomoc) {
  const cors = pomoc.naglowkiCors(zapytanie, false);
  if (zapytanie.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.RYSOWANIE || !env.PRZEGLADARKA || !env.PLIKI) return pomoc.json(503, { blad: 'Rysowanie na serwerze nie jest włączone.', kod: 'brak_rysowania' }, cors);
  // Usługa składu dla łącznika MCP (#436) – uwierzytelnia kluczem AI, nie sesją użytkownika.
  if (u.pathname === '/rysuj/skladaj') return obsluzSkladanie(zapytanie, env, pomoc, cors);
  const token = pomoc.tokenZZapytania(zapytanie);
  const uid = await pomoc.uzytkownik(env, token);
  if (!uid) return pomoc.json(401, { blad: 'Zaloguj się ponownie.' }, cors);

  // Zużycie przeglądarki serwera (panel administratora): ostatnie 31 dni i bieżący miesiąc.
  if (u.pathname === '/rysuj/zuzycie' && zapytanie.method === 'GET') {
    if (await pomoc.rpc(env, token, 'czy_administrator', {}).catch(() => false) !== true) return pomoc.json(403, { blad: 'Tylko dla administratora.' }, cors);
    const odp = await env.RYSOWANIE.get(env.RYSOWANIE.idFromName('statystyki')).fetch('https://kolejka/zuzycie');
    return pomoc.json(200, await odp.json(), cors);
  }
  if (u.pathname === '/rysuj/stan' && zapytanie.method === 'GET') {
    const id = u.searchParams.get('projekt') || '';
    if (!ID.test(id)) return pomoc.json(400, { blad: 'Nieprawidłowy projekt.' }, cors);
    const odp = await obiektKolejki(env, uid, id, u.searchParams.get('rodzaj')).fetch('https://kolejka/stan');
    return pomoc.json(200, await odp.json(), cors);
  }

  const rodzaj = u.pathname === '/rysuj/pdf' ? 'pdf' : 'link';
  if (!['/rysuj/link', '/rysuj/pdf'].includes(u.pathname) || zapytanie.method !== 'POST') return pomoc.json(404, { blad: 'Nie ma takiej funkcji.' }, cors);
  if (Number(zapytanie.headers.get('content-length') || 0) > MAKS_ZLECENIA) return pomoc.json(413, { blad: 'Projekt za duży do rysowania na serwerze.' }, cors);
  let dane;
  try {
    const tekst = await zapytanie.text();
    if (tekst.length > MAKS_ZLECENIA) return pomoc.json(413, { blad: 'Projekt za duży do rysowania na serwerze.' }, cors);
    dane = JSON.parse(tekst);
  } catch { return pomoc.json(400, { blad: 'Nieprawidłowe zlecenie.' }, cors); }
  const projekt = dane?.projekt;
  if (!projekt || typeof projekt !== 'object' || !ID.test(String(projekt.id || '')) || !Array.isArray(projekt.strony)) {
    return pomoc.json(400, { blad: 'Nieprawidłowy projekt.' }, cors);
  }
  const folder = rodzaj === 'pdf' ? { chroniony: false } : sprawdzFolder(dane.folder, uid, projekt.id);
  if (!folder) return pomoc.json(403, { blad: 'To nie jest folder Twojego linku.' }, cors);
  if (folder.chroniony && !await pomoc.linkChronionyWazny(env, uid, projekt.id, folder.nazwa)) {
    return pomoc.json(403, { blad: 'Link z ochroną jest nieaktualny – opublikuj go ponownie.' }, cors);
  }
  // Opcje eksportu z okna aplikacji: bez własnego profilu ICC (plik użytkownika – taki eksport robi urządzenie).
  const opcje = rodzaj === 'pdf' ? { ...(dane.opcje && typeof dane.opcje === 'object' ? dane.opcje : {}), profilWlasny: null } : null;
  if (opcje && JSON.stringify(opcje).length > 20000) return pomoc.json(400, { blad: 'Nieprawidłowe opcje eksportu.' }, cors);
  // Pliki projektu: tylko te, które zlecający może czytać (właściciel projektu albo współpracownik).
  const sciezki = sciezkiZasobow(projekt);
  const sprawdzone = new Map();
  for (const s of sciezki) {
    const [wl, pr] = s.split('/');
    const para = `${wl}/${pr}`;
    if (!sprawdzone.has(para)) sprawdzone.set(para, Boolean(wl && pr) && await pomoc.dostep(env, token, uid, wl, pr, false));
    if (!sprawdzone.get(para)) return pomoc.json(403, { blad: 'Brak dostępu do plików tego projektu.' }, cors);
  }
  const zlecenie = { rodzaj, projekt, folder: rodzaj === 'pdf' ? null : dane.folder, chroniony: folder.chroniony, pelna: Boolean(dane.pelna), opcje, sciezki, uid, zlecono: Date.now() };
  const klucz = kluczZlecenia(uid, projekt.id, rodzaj);
  await env.PLIKI.put(klucz, JSON.stringify(zlecenie), { httpMetadata: { contentType: 'application/json' } });
  const odp = await obiektKolejki(env, uid, projekt.id, rodzaj).fetch('https://kolejka/start', { method: 'POST', body: JSON.stringify({ klucz, uid, stron: projekt.strony.length, rodzaj }) });
  return pomoc.json(202, await odp.json(), cors);
}

const dzis = () => new Date().toISOString().slice(0, 10);
// Zapis zużycia przeglądarki (czas i strony) – do podglądu w panelu administratora.
const zapiszZuzycie = (env, dane) => env.RYSOWANIE.get(env.RYSOWANIE.idFromName('statystyki'))
  .fetch('https://kolejka/zapisz', { method: 'POST', body: JSON.stringify(dane) }).catch(() => {});

// Kolejka rysowania jednego linku (Durable Object, jeden na projekt): jedno rysowanie naraz; nowe zlecenie w trakcie
// czeka i zastępuje poprzednie czekające (rysuje się zawsze najnowszy stan projektu).
export class Rysowanie {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(zapytanie) {
    const u = new URL(zapytanie.url);
    const s = this.state.storage;
    if (u.pathname === '/stan') return Response.json(await s.get('stan') || { stan: 'brak' });
    if (u.pathname === '/start' && zapytanie.method === 'POST') {
      const z = { ...await zapytanie.json(), id: crypto.randomUUID() };
      await s.put('zlecenie', z);
      const stan = await s.get('stan');
      if (stan?.stan === 'rysuje' && Date.now() - (stan.od || 0) < 20 * 60 * 1000) {
        await s.put('stan', { ...stan, czeka: true });
        return Response.json({ stan: 'w_kolejce', id: z.id });
      }
      await s.put('stan', { stan: 'w_kolejce', od: Date.now(), id: z.id });
      await s.setAlarm(Date.now());
      return Response.json({ stan: 'w_kolejce', id: z.id });
    }
    if (u.pathname === '/praca' && zapytanie.method === 'POST') {
      // Praca z kolejki konta (#438) – ten obiekt („praca:<id>”) robi jedną pracę.
      await s.put('praca', await zapytanie.json());
      await s.setAlarm(Date.now());
      return Response.json({ stan: 'w_kolejce' });
    }
    if (u.pathname === '/eksport' && zapytanie.method === 'POST') {
      // Eksport zlecony przez AI (#337) – ten obiekt („eksport:<id>”) robi jedno zlecenie.
      await s.put('eksport', await zapytanie.json());
      await s.setAlarm(Date.now());
      return Response.json({ stan: 'w_kolejce' });
    }
    if (u.pathname === '/zapisz' && zapytanie.method === 'POST') {
      // Zużycie (obiekt „statystyki”): dzień → { zlecen, stron, ms, rodzaje }.
      const { ms = 0, stron = 0, rodzaj = 'link' } = await zapytanie.json();
      const k = `d:${dzis()}`;
      const d = await s.get(k) || { zlecen: 0, stron: 0, ms: 0, rodzaje: {} };
      d.zlecen += 1; d.stron += Number(stron) || 0; d.ms += Math.max(0, Number(ms) || 0);
      d.rodzaje[rodzaj] = (d.rodzaje[rodzaj] || 0) + 1;
      await s.put(k, d);
      return Response.json({ ok: true });
    }
    if (u.pathname === '/zuzycie') {
      const dni = [];
      for (let i = 30; i >= 0; i -= 1) {
        const dzien = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        dni.push({ dzien, ...(await s.get(`d:${dzien}`) || { zlecen: 0, stron: 0, ms: 0, rodzaje: {} }) });
      }
      const miesiac = dzis().slice(0, 7);
      const wMiesiacu = dni.filter((d) => d.dzien.startsWith(miesiac));
      const suma = (pole) => wMiesiacu.reduce((a, d) => a + d[pole], 0);
      return Response.json({ dni, miesiac: { ms: suma('ms'), stron: suma('stron'), zlecen: suma('zlecen') }, planGodzin: 10 });
    }
    if (u.pathname === '/licznik' && zapytanie.method === 'POST') {
      // Licznik stron konta na dziś (ten sam typ obiektu, nazwa „konto:<uid>”).
      const { stron = 0 } = await zapytanie.json();
      const d = await s.get('dzien');
      const teraz = d?.data === dzis() ? d : { data: dzis(), stron: 0 };
      if (teraz.stron + stron > LIMIT_STRON_DZIENNIE) return Response.json({ ok: false, stron: teraz.stron });
      teraz.stron += stron;
      await s.put('dzien', teraz);
      return Response.json({ ok: true, stron: teraz.stron });
    }
    return new Response('?', { status: 404 });
  }

  async alarm() {
    const s = this.state.storage;
    const praca = await s.get('praca');
    if (praca) {
      await s.delete('praca');
      await wykonajPrace(this.env, praca);
      return;
    }
    const eksport = await s.get('eksport');
    if (eksport) {
      await s.delete('eksport');
      await wykonajEksport(this.env, eksport);
      return;
    }
    const z = await s.get('zlecenie');
    if (!z) return;
    await s.delete('zlecenie');
    // Dzienny limit stron na konto – zanim przeglądarka w ogóle wystartuje.
    const konto = this.env.RYSOWANIE.get(this.env.RYSOWANIE.idFromName(`konto:${z.uid}`));
    const limit = await (await konto.fetch('https://kolejka/licznik', { method: 'POST', body: JSON.stringify({ stron: z.stron || 0 }) })).json();
    if (!limit.ok) {
      await s.put('stan', { stan: 'limit', id: z.id, koniec: Date.now(), blad: 'Dzienny limit rysowania na serwerze – link narysuje się na Twoim urządzeniu.' });
      await this.env.PLIKI.delete(z.klucz).catch(() => {});
      return;
    }
    const od = Date.now();
    await s.put('stan', { stan: 'rysuje', id: z.id, od, gotowe: 0, wszystkie: 0 });
    let ostatnio = 0;
    const postep = async (gotowe, wszystkie) => {
      if (Date.now() - ostatnio < 1500 && gotowe < wszystkie) return;
      ostatnio = Date.now();
      const st = await s.get('stan');
      await s.put('stan', { ...st, stan: 'rysuje', gotowe, wszystkie });
    };
    try {
      const w = z.rodzaj === 'pdf' ? await rysujPdf(this.env, z.klucz, postep) : await rysujLink(this.env, z.klucz, postep);
      await zapiszZuzycie(this.env, { ms: Date.now() - od, stron: z.rodzaj === 'pdf' ? w.strony : w.wyslane, rodzaj: z.rodzaj || 'link' });
      const st = await s.get('stan');
      await s.put('stan', { stan: 'gotowe', id: z.id, od, koniec: Date.now(), ...w });
      if (st?.czeka || await s.get('zlecenie')) await s.setAlarm(Date.now());
    } catch (e) {
      await zapiszZuzycie(this.env, { ms: Date.now() - od, stron: 0, rodzaj: z.rodzaj || 'link' });
      await s.put('stan', { stan: 'blad', id: z.id, od, koniec: Date.now(), blad: String(e?.message || e).slice(0, 300) });
      if (await s.get('zlecenie')) await s.setAlarm(Date.now());
    }
  }
}

const zBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
async function doBase64(obiekt) {
  const bajty = new Uint8Array(await obiekt.arrayBuffer());
  let s = '';
  for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
  return btoa(s);
}

// Jedno rysowanie: przeglądarka z zamkniętym ruchem, strona rysuj.html, magazyn = R2 (tylko folder tego linku).
export async function rysujLink(env, klucz, postep = () => {}, { przerwij = null } = {}) {
  const obj = await env.PLIKI.get(klucz);
  if (!obj) throw new Error('Zlecenie zniknęło.');
  const z = await obj.json();
  const folder = z.folder;
  const wFolderze = (k) => typeof k === 'string' && k.startsWith(`${folder}/`) && !k.slice(folder.length + 1).includes('/') && !k.includes('..');
  const dozwolone = new Set(z.sciezki || []);
  const cache = z.chroniony ? 'private, max-age=3600' : 'public, max-age=31536000, immutable';
  const puppeteer = env.__puppeteer || (await import('@cloudflare/puppeteer')).default;
  const przegladarka = await puppeteer.launch(env.PRZEGLADARKA, { keep_alive: 600000 });
  try {
    const strona = await przegladarka.newPage();
    await strona.setRequestInterception(true);
    strona.on('request', (r) => { if (dozwolonyAdres(r.url(), env.APLIKACJA || APLIKACJA)) r.continue(); else r.abort(); });
    await strona.exposeFunction('__mkCzytajOpis', async (f) => {
      if (f !== folder) return null;
      const o = await env.PLIKI.get(`podglady/${folder}/manifest.json`);
      return o ? o.json() : null;
    });
    await strona.exposeFunction('__mkWyslij', async (k, b64, typ, c) => {
      if (!wFolderze(k)) throw new Error('Zapis poza folderem linku.');
      const manifest = k.endsWith('/manifest.json');
      await env.PLIKI.put(`podglady/${k}`, zBase64(b64), { httpMetadata: { contentType: typ || 'application/octet-stream', cacheControl: manifest ? 'no-cache' : (z.chroniony ? cache : (c || cache)) } });
      return true;
    });
    await strona.exposeFunction('__mkLista', async (f) => {
      if (f !== folder) return [];
      const wynik = [];
      let cursor;
      do {
        const l = await env.PLIKI.list({ prefix: `podglady/${folder}/`, cursor });
        wynik.push(...l.objects.map((o) => o.key.slice('podglady/'.length)));
        cursor = l.truncated ? l.cursor : undefined;
      } while (cursor);
      return wynik;
    });
    await strona.exposeFunction('__mkUsun', async (klucze) => {
      const k = (klucze || []).filter(wFolderze).map((x) => `podglady/${x}`);
      if (k.length) await env.PLIKI.delete(k);
      return true;
    });
    await strona.exposeFunction('__mkPobierz', async (sciezka) => {
      if (!dozwolone.has(sciezka)) return null;
      const o = await env.PLIKI.get(`zasoby/${sciezka}`);
      return o ? { b64: await doBase64(o), typ: o.httpMetadata?.contentType || 'application/octet-stream' } : null;
    });
    await strona.exposeFunction('__mkPostep', (gotowe, wszystkie) => postep(gotowe, wszystkie));
    // Praca z kolejki (#438): przed każdą stroną – czy przerwać (karta wróciła, nowsza wersja projektu).
    if (przerwij) await strona.exposeFunction('__mkPrzerwij', async () => Boolean(await przerwij()));
    await strona.goto(`${env.APLIKACJA || APLIKACJA}/rysuj.html`, { waitUntil: 'load', timeout: 60000 });
    await strona.waitForFunction('window.makietkaRysujGotowe === true', { timeout: 60000 });
    return await strona.evaluate((a) => window.makietkaRysuj.publikujLink(a), { projekt: z.projekt, folder, pelna: z.pelna, chroniony: z.chroniony, kod: z.kod || null });
  } finally {
    await przegladarka.close().catch(() => {});
    await env.PLIKI.delete(klucz).catch(() => {});
  }
}

// ---------- Eksport zlecony przez AI na serwerze (#337) ----------
// Zlecenie, którego żadna otwarta karta konta nie przyjęła w 20 sekund, przejmuje worker (cron co minutę):
// projekt z bazy (funkcje serwer_* – tylko klucz serwisowy), plik w przeglądarce tym samym kodem co aplikacja,
// zapis w „zasoby/<konto>/_eksporty/<zlecenie>.<pdf|png>” i zamknięcie zlecenia – AI dostaje link jak dotąd.

const naglowkiSerwisowe = (k) => (String(k).startsWith('sb_') ? { apikey: k } : { apikey: k, authorization: `Bearer ${k}` });
async function rpcSerwisowe(env, nazwa, parametry) {
  const odp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${nazwa}`, {
    method: 'POST',
    headers: { ...naglowkiSerwisowe(env.SUPABASE_SERVICE_ROLE_KEY), 'content-type': 'application/json' },
    body: JSON.stringify(parametry),
  });
  const tresc = await odp.json().catch(() => null);
  if (!odp.ok) throw new Error(tresc?.message || `${nazwa}: ${odp.status}`);
  return tresc;
}

// Przebieg crona: przejęcie zaległych zleceń i przekazanie każdego do osobnego obiektu (alarm – bez limitu crona).
export async function przebiegEksportow(env) {
  if (!env.RYSOWANIE || !env.PRZEGLADARKA || !env.PLIKI || !env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const lista = await rpcSerwisowe(env, 'serwer_przyjmij_eksporty', { p_po_sekundach: 20, p_ile: 3 }) || [];
  for (const z of lista) {
    await env.RYSOWANIE.get(env.RYSOWANIE.idFromName(`eksport:${z.id}`)).fetch('https://kolejka/eksport', { method: 'POST', body: JSON.stringify(z) });
  }
  return lista.length;
}

// ---------- Prace w tle konta (#438, etap D) ----------
// Praca linku, której żadna karta nie wzięła (czeka ponad 30 s) albo której dzierżawa wygasła (karta zamknięta),
// przechodzi na serwer (cron co minutę): projekt z bazy, ustawienia linku z projektu, rysowanie tylko stron, których
// odcisku nie ma jeszcze w folderze (js/publikacja-magazyn.js). Dzierżawa serwera odnawia się co 20 s; gdy pracę
// odebrała karta, która wróciła, albo przyszła nowsza wersja – serwer kończy po bieżącej stronie.
export async function przebiegPrac(env) {
  if (!env.RYSOWANIE || !env.PRZEGLADARKA || !env.PLIKI || !env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const lista = await rpcSerwisowe(env, 'serwer_przejmij_prace', { p_po_sekundach: 30, p_ile: 3 }) || [];
  for (const z of lista) {
    await env.RYSOWANIE.get(env.RYSOWANIE.idFromName(`praca:${z.id}`)).fetch('https://kolejka/praca', { method: 'POST', body: JSON.stringify(z) });
  }
  return lista.length;
}

export const ODNOWIENIE_SERWERA_MS = 20000;
export async function wykonajPrace(env, z) {
  const od = Date.now();
  let wyslane = 0;
  let utracona = false;
  let nowsza = false;
  let ostatnio = Date.now();
  let postep = { gotowe: null, wszystkie: null };
  const odnow = async (wymus = false) => {
    if (!wymus && Date.now() - ostatnio < (env.__odnowienieMs ?? ODNOWIENIE_SERWERA_MS)) return;
    ostatnio = Date.now();
    try {
      const w = await rpcSerwisowe(env, 'serwer_odnow_prace', { p_id: z.id, p_gotowe: postep.gotowe, p_wszystkie: postep.wszystkie });
      if (!w) utracona = true;
      else if (Number(w.wersja) > Number(z.wersja)) nowsza = true;
    } catch { /* chwilowy błąd bazy – dzierżawa trwa 2 minuty */ }
  };
  const klucz = `zadania/${z.wlasciciel}/${z.projekt_id}-praca-${z.id}.json`;
  let blad = null;
  let wynik = null;
  try {
    const projekt = await rpcSerwisowe(env, 'serwer_projekt', { p_projekt: z.projekt_id });
    if (!projekt) throw new Error('Nie ma tego projektu.');
    projekt.id ??= z.projekt_id;
    const konto = env.RYSOWANIE.get(env.RYSOWANIE.idFromName(`konto:${z.wlasciciel}`));
    const limit = await (await konto.fetch('https://kolejka/licznik', { method: 'POST', body: JSON.stringify({ stron: (projekt.strony || []).length }) })).json();
    if (!limit.ok) throw new Error('Dzienny limit rysowania na serwerze – link narysuje się na urządzeniu po otwarciu projektu.');
    // Pliki: tylko te, które projekt wskazuje, i tylko z folderów właściciela linku albo tego projektu.
    const sciezki = sciezkiZasobow(projekt).filter((s) => s.startsWith(`${z.wlasciciel}/`) || s.split('/')[1] === z.projekt_id);
    await env.PLIKI.put(klucz, JSON.stringify({ rodzaj: 'link', projekt, folder: z.folder, chroniony: Boolean(z.chroniony), pelna: false, sciezki, uid: z.wlasciciel, kod: z.cel }), { httpMetadata: { contentType: 'application/json' } });
    wynik = await rysujLink(env, klucz, (gotowe, wszystkie) => { postep = { gotowe, wszystkie }; }, { przerwij: async () => { await odnow(); return utracona || nowsza; } });
    wyslane = wynik?.wyslane || 0;
  } catch (e) {
    blad = String(e?.message || e).slice(0, 300);
  } finally {
    await zapiszZuzycie(env, { ms: Date.now() - od, stron: wyslane, rodzaj: 'praca' });
    if (!utracona) {
      // Przerwana dla nowszej wersji: wersja niewykonana (praca wraca do „czeka”), opis linku ma gotowe strony.
      const wersja = wynik?.przerwane ? 0 : z.wersja;
      await rpcSerwisowe(env, 'serwer_zakoncz_prace', { p_id: z.id, p_wersja: wersja, p_blad: blad }).catch(() => {});
    }
  }
  return { wynik, blad, utracona, nowsza };
}

export async function wykonajEksport(env, z) {
  const od = Date.now();
  let stron = 0;
  try { await eksportWPrzegladarce(env, z, (n) => { stron = n; }); } finally { await zapiszZuzycie(env, { ms: Date.now() - od, stron, rodzaj: 'ai' }); }
}

async function eksportWPrzegladarce(env, z, policz) {
  const zakoncz = (w) => rpcSerwisowe(env, 'serwer_zakoncz_eksport', { p_id: z.id, p_plik: null, p_nazwa: null, p_typ: null, p_rozmiar: null, p_strony: null, p_uwagi: [], p_blad: null, ...w });
  try {
    const projekt = await rpcSerwisowe(env, 'serwer_projekt', { p_projekt: z.projekt_id });
    if (!projekt) throw new Error('Nie ma tego projektu.');
    projekt.id ??= z.projekt_id;
    // Ten sam dzienny limit stron co rysowanie linku.
    const konto = env.RYSOWANIE.get(env.RYSOWANIE.idFromName(`konto:${z.wlasciciel}`));
    const limit = await (await konto.fetch('https://kolejka/licznik', { method: 'POST', body: JSON.stringify({ stron: (projekt.strony || []).length }) })).json();
    if (!limit.ok) throw new Error('Dzienny limit plików robionych na serwerze – otwórz Makietkę, żeby zrobić plik na urządzeniu.');
    const sciezki = new Set(sciezkiZasobow(projekt));
    const w = await wPrzegladarce(env, { pobierz: (sc) => sciezki.has(sc) }, (strona) => strona.evaluate((a) => window.makietkaRysuj.eksportuj(a), { projekt, rodzaj: z.rodzaj, ustawienia: z.ustawienia || {} }));
    const plik = `${z.wlasciciel}/_eksporty/${z.id}.${z.rodzaj === 'png' ? 'png' : 'pdf'}`;
    const bajty = zBase64(w.b64);
    await env.PLIKI.put(`zasoby/${plik}`, bajty, { httpMetadata: { contentType: w.typ, cacheControl: 'private, max-age=3600' } });
    policz(w.strony || 0);
    await zakoncz({ p_plik: plik, p_nazwa: w.nazwa, p_typ: w.typ, p_rozmiar: bajty.length, p_strony: w.strony, p_uwagi: (w.uwagi || []).slice(0, 40) });
  } catch (e) {
    await zakoncz({ p_blad: String(e?.message || e).slice(0, 900) }).catch(() => {});
  }
}

// Przeglądarka z zamkniętym ruchem i stroną rysuj.html; dostęp do plików konta tylko przez pobierz(ścieżka) → bool.
async function wPrzegladarce(env, { pobierz, postep = () => {} }, praca) {
  const puppeteer = env.__puppeteer || (await import('@cloudflare/puppeteer')).default;
  const przegladarka = await puppeteer.launch(env.PRZEGLADARKA, { keep_alive: 600000 });
  try {
    const strona = await przegladarka.newPage();
    await strona.setRequestInterception(true);
    strona.on('request', (r) => { if (dozwolonyAdres(r.url(), env.APLIKACJA || APLIKACJA)) r.continue(); else r.abort(); });
    await strona.exposeFunction('__mkPobierz', async (sciezka) => {
      if (!pobierz(sciezka)) return null;
      const o = await env.PLIKI.get(`zasoby/${sciezka}`);
      return o ? { b64: await doBase64(o), typ: o.httpMetadata?.contentType || 'application/octet-stream' } : null;
    });
    // Diagnostyka (23.11: PDF na serwerze przekraczał czas, lokalnie rysował się w 0,4 s): ostatni etap i postęp
    // trafiają do komunikatu błędu, żeby było widać, na czym rysowanie stanęło.
    let etap = 'otwieranie strony rysowania';
    let ostatni = '';
    await strona.exposeFunction('__mkPostep', (i, n) => { ostatni = `${i} z ${n}`; postep(i, n); });
    await strona.exposeFunction('__mkEtap', (e) => { etap = String(e).slice(0, 80); });
    try {
      await strona.goto(`${env.APLIKACJA || APLIKACJA}/rysuj.html`, { waitUntil: 'load', timeout: 60000 });
      await strona.waitForFunction('window.makietkaRysujGotowe === true', { timeout: 60000 });
      etap = 'rysowanie';
      return await praca(strona);
    } catch (e) {
      throw new Error(`${String(e?.message || e).slice(0, 300)} [etap: ${etap}${ostatni ? `, strony ${ostatni}` : ''}]`);
    }
  } finally {
    await przegladarka.close().catch(() => {});
  }
}

// ---------- Usługa składu dla MCP (#436) ----------
// POST /rysuj/skladaj, nagłówek x-makietka-klucz: klucz AI (ten sam co w adresie łącznika), ciało
// { projekt_id, projekt?, dzialania }. Klucz sprawdza baza (serwer_klucz_ai – tylko klucz serwisowy workera):
// właściciel i dostęp do projektu. Projekt w ciele to zmiana łącznika jeszcze przed zapisem (przelanie liczy się przed
// zapisem, w tej samej wersji); bez niego – projekt z bazy. Pliki (czcionki, obrazy) tylko z zapisanego projektu
// i z folderu tego projektu u właściciela. Wynik: makietkaRysuj.skladaj (rysuj.js).
export async function skladajDlaAi(env, { klucz, projektId, projekt = null, dzialania = [] }) {
  if (!klucz || !ID.test(String(projektId || ''))) return { status: 400, dane: { blad: 'Brak klucza albo projektu.' } };
  if (!Array.isArray(dzialania) || !dzialania.length || dzialania.length > 12) return { status: 400, dane: { blad: 'Nieprawidłowe działania.' } };
  const k = await rpcSerwisowe(env, 'serwer_klucz_ai', { p_klucz: klucz, p_projekt: projektId });
  if (!k || k.blad) return { status: 403, dane: { blad: k?.blad || 'Klucz nie obejmuje tego projektu.' } };
  const zapisany = await rpcSerwisowe(env, 'serwer_projekt', { p_projekt: projektId });
  if (!zapisany) return { status: 404, dane: { blad: 'Nie ma tego projektu.' } };
  const dozwolone = new Set(sciezkiZasobow(zapisany));
  const folder = `${k.owner_id}/${projektId}/`;
  const p = projekt && typeof projekt === 'object' ? projekt : zapisany;
  p.id ??= projektId;
  const od = Date.now();
  try {
    const wynik = await wPrzegladarce(env, { pobierz: (sc) => dozwolone.has(sc) || String(sc).startsWith(folder) },
      (strona) => strona.evaluate((a) => window.makietkaRysuj.skladaj(a), { projekt: p, dzialania }));
    return { status: 200, dane: wynik };
  } finally {
    await zapiszZuzycie(env, { ms: Date.now() - od, stron: 0, rodzaj: 'sklad' }).catch(() => {});
  }
}

async function obsluzSkladanie(zapytanie, env, pomoc, cors) {
  if (zapytanie.method !== 'POST') return pomoc.json(405, { blad: 'Tylko POST.' }, cors);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return pomoc.json(503, { blad: 'Usługa składu nie jest włączona.', kod: 'brak_skladu' }, cors);
  if (Number(zapytanie.headers.get('content-length') || 0) > MAKS_ZLECENIA) return pomoc.json(413, { blad: 'Projekt za duży.' }, cors);
  let dane;
  try { dane = await zapytanie.json(); } catch { return pomoc.json(400, { blad: 'Nieprawidłowe zlecenie.' }, cors); }
  try {
    const w = await skladajDlaAi(env, { klucz: zapytanie.headers.get('x-makietka-klucz'), projektId: dane?.projekt_id, projekt: dane?.projekt, dzialania: dane?.dzialania });
    return pomoc.json(w.status, w.dane, cors);
  } catch (e) {
    return pomoc.json(500, { blad: String(e?.message || e).slice(0, 500) }, cors);
  }
}

// PDF z okna „Eksportuj do PDF” (#338): duży projekt – plik robi serwer, aplikacja pobiera go z konta.
export async function rysujPdf(env, klucz, postep = () => {}) {
  const obj = await env.PLIKI.get(klucz);
  if (!obj) throw new Error('Zlecenie zniknęło.');
  const z = await obj.json();
  try {
    const dozwolone = new Set(z.sciezki || []);
    const w = await wPrzegladarce(env, { pobierz: (sc) => dozwolone.has(sc), postep },
      (strona) => strona.evaluate((a) => window.makietkaRysuj.eksportuj(a), { projekt: z.projekt, rodzaj: 'pdf', opcje: z.opcje }));
    const plik = plikPdfSerwera(z.uid, z.projekt.id);
    const bajty = zBase64(w.b64);
    await env.PLIKI.put(`zasoby/${plik}`, bajty, { httpMetadata: { contentType: w.typ || 'application/pdf', cacheControl: 'private, no-store' } });
    return { plik, nazwa: w.nazwa, typ: w.typ, rozmiar: bajty.length, strony: w.strony, uwagi: (w.uwagi || []).slice(0, 40) };
  } finally {
    await env.PLIKI.delete(klucz).catch(() => {});
  }
}
