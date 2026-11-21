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
  return u.pathname === '/rysuj.html' || /^\/(js|css)\//.test(u.pathname) || u.pathname === '/favicon.ico';
}

// Folder linku ze zlecenia: „<uid>/<projekt>/<kod>” albo „<uid>/<projekt>/<kod>.<sekret>” (link z ochroną).
export function sprawdzFolder(folder, uid, idProjektu) {
  const c = String(folder || '').split('/');
  if (c.length !== 3 || c[0] !== uid || c[1] !== idProjektu) return null;
  const [kod, sekret, nadmiar] = c[2].split('.');
  if (!KOD_LINKU.test(kod) || nadmiar !== undefined || (sekret !== undefined && !SEKRET.test(sekret))) return null;
  return { kod, chroniony: sekret !== undefined, nazwa: c[2] };
}

const kluczZlecenia = (uid, idProjektu) => `zadania/${uid}/${idProjektu}.json`;
const obiektKolejki = (env, uid, idProjektu) => env.RYSOWANIE.get(env.RYSOWANIE.idFromName(`link:${uid}:${idProjektu}`));

// POST /rysuj/link { projekt, folder, pelna } – zlecenie; GET /rysuj/stan?projekt=… – postęp.
// pomoc: funkcje workera (api-worker.js) – json, cors, tokenZZapytania, uzytkownik, dostep, linkChronionyWazny.
export async function obsluzRysowanie(zapytanie, env, u, pomoc) {
  const cors = pomoc.naglowkiCors(zapytanie, false);
  if (zapytanie.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.RYSOWANIE || !env.PRZEGLADARKA || !env.PLIKI) return pomoc.json(503, { blad: 'Rysowanie na serwerze nie jest włączone.', kod: 'brak_rysowania' }, cors);
  const token = pomoc.tokenZZapytania(zapytanie);
  const uid = await pomoc.uzytkownik(env, token);
  if (!uid) return pomoc.json(401, { blad: 'Zaloguj się ponownie.' }, cors);

  if (u.pathname === '/rysuj/stan' && zapytanie.method === 'GET') {
    const id = u.searchParams.get('projekt') || '';
    if (!ID.test(id)) return pomoc.json(400, { blad: 'Nieprawidłowy projekt.' }, cors);
    const odp = await obiektKolejki(env, uid, id).fetch('https://kolejka/stan');
    return pomoc.json(200, await odp.json(), cors);
  }

  if (u.pathname !== '/rysuj/link' || zapytanie.method !== 'POST') return pomoc.json(404, { blad: 'Nie ma takiej funkcji.' }, cors);
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
  const folder = sprawdzFolder(dane.folder, uid, projekt.id);
  if (!folder) return pomoc.json(403, { blad: 'To nie jest folder Twojego linku.' }, cors);
  if (folder.chroniony && !await pomoc.linkChronionyWazny(env, uid, projekt.id, folder.nazwa)) {
    return pomoc.json(403, { blad: 'Link z ochroną jest nieaktualny – opublikuj go ponownie.' }, cors);
  }
  // Pliki projektu: tylko te, które zlecający może czytać (właściciel projektu albo współpracownik).
  const sciezki = sciezkiZasobow(projekt);
  const sprawdzone = new Map();
  for (const s of sciezki) {
    const [wl, pr] = s.split('/');
    const para = `${wl}/${pr}`;
    if (!sprawdzone.has(para)) sprawdzone.set(para, Boolean(wl && pr) && await pomoc.dostep(env, token, uid, wl, pr, false));
    if (!sprawdzone.get(para)) return pomoc.json(403, { blad: 'Brak dostępu do plików tego projektu.' }, cors);
  }
  const zlecenie = { projekt, folder: dane.folder, chroniony: folder.chroniony, pelna: Boolean(dane.pelna), sciezki, uid, zlecono: Date.now() };
  await env.PLIKI.put(kluczZlecenia(uid, projekt.id), JSON.stringify(zlecenie), { httpMetadata: { contentType: 'application/json' } });
  const odp = await obiektKolejki(env, uid, projekt.id).fetch('https://kolejka/start', { method: 'POST', body: JSON.stringify({ klucz: kluczZlecenia(uid, projekt.id), uid, stron: projekt.strony.length }) });
  return pomoc.json(202, await odp.json(), cors);
}

const dzis = () => new Date().toISOString().slice(0, 10);

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
      const w = await rysujLink(this.env, z.klucz, postep);
      const st = await s.get('stan');
      await s.put('stan', { stan: 'gotowe', id: z.id, od, koniec: Date.now(), ...w });
      if (st?.czeka || await s.get('zlecenie')) await s.setAlarm(Date.now());
    } catch (e) {
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
export async function rysujLink(env, klucz, postep = () => {}) {
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
    await strona.goto(`${env.APLIKACJA || APLIKACJA}/rysuj.html`, { waitUntil: 'load', timeout: 60000 });
    await strona.waitForFunction('window.makietkaRysujGotowe === true', { timeout: 60000 });
    return await strona.evaluate((a) => window.makietkaRysuj.publikujLink(a), { projekt: z.projekt, folder, pelna: z.pelna, chroniony: z.chroniony });
  } finally {
    await przegladarka.close().catch(() => {});
    await env.PLIKI.delete(klucz).catch(() => {});
  }
}
