// Atrapa kolejki prac w tle (#438, migracja supabase/migrations/20261126100000_prace_w_tle.sql): te same zasady w JS.
// Zapis projektu (stan.zgloszPrace) zgłasza wersję do wszystkich linków projektu (krótkie kody), karta bierze pracę
// pod dzierżawą 30 s, odnawia ją, kończy (nowsza wersja w trakcie – praca wraca do „czeka”). Zmiana wiersza idzie
// na żywo do kart konta (stan.oglosWiersz, jak Realtime z RLS). Serwer (stan.prace.serwer…) – dla testów przejęcia.

const crypto = require('node:crypto');

const FUNKCJE = ['prace_konta', 'praca_zglos_link', 'praca_przejmij', 'praca_odnow', 'praca_zakoncz'];

function atrapaPrac(stan) {
  stan.prace = stan.prace || [];
  const teraz = () => new Date().toISOString();
  const json = (z) => JSON.parse(JSON.stringify({ id: z.id, projekt_id: z.projekt_id, rodzaj: 'link', cel: z.cel, wersja: z.wersja, wykonana: z.wykonana, stan: z.stan, wykonawca: z.wykonawca, dzierzawa_do: z.dzierzawa_do, gotowe: z.gotowe, wszystkie: z.wszystkie, blad: z.blad, zgloszono: z.zgloszono, zmieniono: z.zmieniono }));
  const oglos = (z) => stan.oglosWiersz?.('prace_w_tle', 'UPDATE', { ...json(z), wlasciciel: z.wlasciciel }, [z.wlasciciel]);
  const dzierzawa = (s) => new Date(Date.now() + s * 1000).toISOString();
  const wygasla = (z) => !z.dzierzawa_do || new Date(z.dzierzawa_do).getTime() < Date.now();
  stan.historiaPrac = stan.historiaPrac || []; // [{ id, co, karta, wersja }] – do sprawdzania w testach

  function zglos(projekt, wersja) {
    for (const [, w] of stan.krotkie || new Map()) {
      if (w.projekt !== projekt) continue;
      let z = stan.prace.find((x) => x.projekt_id === projekt && x.cel === w.kod);
      if (!z) {
        z = { id: crypto.randomUUID(), wlasciciel: w.konto, projekt_id: projekt, cel: w.kod, wersja: 0, wykonana: 0, stan: 'czeka', wykonawca: null, dzierzawa_do: null, gotowe: null, wszystkie: null, blad: null, proby: 0, zgloszono: teraz(), zmieniono: teraz() };
        stan.prace.push(z);
      }
      z.wersja = Math.max(z.wersja, wersja);
      z.zgloszono = teraz(); z.zmieniono = teraz(); z.blad = null; z.proby = 0;
      if (z.stan !== 'w_toku' && z.wersja > z.wykonana) z.stan = 'czeka';
      oglos(z);
    }
  }
  stan.zgloszPrace = zglos;

  function zakoncz(z, wersja, blad, zwolnij) {
    if (!blad && !zwolnij) z.wykonana = Math.max(z.wykonana, Math.min(wersja ?? 0, z.wersja));
    z.stan = blad ? 'blad' : z.wykonana >= z.wersja ? 'gotowe' : 'czeka';
    z.blad = blad ? String(blad).slice(0, 300) : null;
    z.wykonawca = null; z.dzierzawa_do = null; z.zmieniono = teraz();
    oglos(z);
    return json(z);
  }

  function app(funkcja, t, konto) {
    if (!konto) throw Object.assign(new Error('Brak sesji'), { status: 401 });
    const moja = (id) => stan.prace.find((z) => z.id === id && z.wlasciciel === konto.id);
    if (funkcja === 'prace_konta') return stan.prace.filter((z) => z.wlasciciel === konto.id && ['czeka', 'w_toku', 'blad'].includes(z.stan)).map(json);
    if (funkcja === 'praca_zglos_link') {
      const p = stan.projekty.find((x) => x.id === t.p_projekt);
      if (p && [...(stan.krotkie || new Map()).values()].some((w) => w.projekt === p.id && w.konto === konto.id)) zglos(p.id, p.wersja);
      return null;
    }
    if (funkcja === 'praca_przejmij') {
      const z = moja(t.p_id);
      if (!z || !(z.wersja > z.wykonana)) return null;
      if (!(['czeka', 'blad'].includes(z.stan) || wygasla(z) || z.wykonawca === t.p_karta || (t.p_od_serwera && z.wykonawca === 'serwer'))) return null;
      Object.assign(z, { stan: 'w_toku', wykonawca: t.p_karta, dzierzawa_do: dzierzawa(30), zmieniono: teraz(), gotowe: null, wszystkie: null });
      stan.historiaPrac.push({ id: z.id, co: 'przejmij', karta: t.p_karta, wersja: z.wersja });
      oglos(z);
      return json(z);
    }
    if (funkcja === 'praca_odnow') {
      const z = moja(t.p_id);
      if (!z || z.stan !== 'w_toku' || z.wykonawca !== t.p_karta) return null;
      z.dzierzawa_do = dzierzawa(30);
      if (t.p_gotowe != null) z.gotowe = t.p_gotowe;
      if (t.p_wszystkie != null) z.wszystkie = t.p_wszystkie;
      return json(z);
    }
    if (funkcja === 'praca_zakoncz') {
      const z = moja(t.p_id);
      if (!z || z.stan !== 'w_toku' || z.wykonawca !== t.p_karta) return null;
      stan.historiaPrac.push({ id: z.id, co: t.p_blad ? 'blad' : t.p_zwolnij ? 'zwolnij' : 'zakoncz', karta: t.p_karta, wersja: t.p_wersja });
      return zakoncz(z, t.p_wersja, t.p_blad, t.p_zwolnij);
    }
    return undefined;
  }
  // Serwer (klucz serwisowy) – testy przejęcia.
  function serwerPrzejmij(poSekundach = 30) {
    const wynik = [];
    for (const z of stan.prace) {
      if (!(z.wersja > z.wykonana)) continue;
      const czeka = z.stan === 'czeka' && Date.now() - new Date(z.zgloszono).getTime() > poSekundach * 1000;
      if (!(czeka || (z.stan === 'w_toku' && wygasla(z)))) continue;
      Object.assign(z, { stan: 'w_toku', wykonawca: 'serwer', dzierzawa_do: dzierzawa(120), zmieniono: teraz() });
      oglos(z);
      wynik.push(json(z));
    }
    return wynik;
  }
  return { app, zglos, serwerPrzejmij, zakonczSerwer: (id, wersja) => { const z = stan.prace.find((x) => x.id === id && x.wykonawca === 'serwer'); return z ? zakoncz(z, wersja, null, false) : null; } };
}
atrapaPrac.ma = (f) => FUNKCJE.includes(f);

module.exports = { atrapaPrac };
