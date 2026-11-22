// Atrapa zleceń eksportu dla AI (migracja supabase/migrations/20261117110000_zlecenia_eksportu.sql, decyzja #175):
// te same zasady w JS. Funkcje łącznika (ai_zlec_eksport, ai_stan_eksportu) woła atrapa dostępu AI
// (tests/atrapa-ai.cjs – ma sprawdzanie klucza), funkcje aplikacji – atrapa bazy w tests/pomoc.cjs.
// Wspólny stan: stan.eksporty; nowe zlecenie idzie na żywo do kart konta (stan.oglosWiersz, jak Realtime z RLS).

const crypto = require('node:crypto');

const DNI_7 = 7 * 86400000;

function atrapaEksportu(stan) {
  stan.eksporty = stan.eksporty || [];
  const teraz = () => new Date().toISOString();
  const zyje = (z) => new Date(z.wygasa).getTime() > Date.now();
  const json = (z) => {
    const { id, projekt_id, rodzaj, ustawienia, stan: s, podpis, przyjeto, nazwa, typ, rozmiar, strony, uwagi, blad, utworzono, zmieniono, wygasa, wynik = {} } = z;
    return JSON.parse(JSON.stringify({ id, projekt_id, rodzaj, ustawienia, stan: s, podpis, przyjeto, nazwa, typ, rozmiar, strony, uwagi, blad, utworzono, zmieniono, wygasa, wynik }));
  };
  const oglos = (z, typ) => stan.oglosWiersz?.('zlecenia_eksportu', typ, { id: z.id, wlasciciel: z.wlasciciel, projekt_id: z.projekt_id, stan: z.stan }, [z.wlasciciel]);
  const porzucone = (z) => z.stan === 'w_toku' && Date.now() - new Date(z.przyjeto).getTime() > 5 * 60000;

  // Łącznik AI (klucz konta).
  function ai(funkcja, tresc, { sprawdzKlucz, kluczKonta }) {
    if (funkcja === 'ai_zlec_eksport' || funkcja === 'ai_zlec_zadanie') {
      // Zadania dla aplikacji (migracja 20261122180000_zadania_aplikacji_ai.sql) – klucz musi zmieniać projekt.
      const zadanie = funkcja === 'ai_zlec_zadanie';
      const d = sprawdzKlucz(tresc.p_klucz, zadanie);
      if (d.blad) return d;
      if (zadanie && !['link', 'obraz', 'kadry', 'dymki', 'biblioteka'].includes(tresc.p_rodzaj)) return { blad: 'Rodzaj zadania: link, obraz, kadry, dymki albo biblioteka.' };
      if (!zadanie && !['pdf', 'png'].includes(tresc.p_rodzaj)) return { blad: 'Rodzaj pliku: pdf albo png.' };
      const ust = tresc.p_ustawienia ?? {};
      if (!ust || typeof ust !== 'object' || Array.isArray(ust)) return { blad: 'Ustawienia eksportu to obiekt JSON.' };
      const moje = stan.eksporty.filter((z) => z.wlasciciel === d.owner_id);
      if (moje.filter((z) => ['czeka', 'w_toku'].includes(z.stan) && zyje(z)).length >= 5) return { blad: 'W kolejce czeka już 5 eksportów – poczekaj, aż aplikacja je zrobi (narzędzie stan_eksportu).' };
      const z = {
        id: crypto.randomUUID(), wlasciciel: d.owner_id, projekt_id: d.projekt_id, rodzaj: tresc.p_rodzaj, ustawienia: ust, stan: 'czeka',
        podpis: (d.opis || '').trim() || 'AI', karta: null, przyjeto: null, plik: null, nazwa: null, typ: null, rozmiar: null, strony: null,
        uwagi: [], blad: null, sekret: crypto.randomBytes(32).toString('hex'), utworzono: teraz(), zmieniono: teraz(), wygasa: new Date(Date.now() + DNI_7).toISOString(),
      };
      stan.eksporty.push(z);
      oglos(z, 'INSERT');
      return json(z);
    }
    if (funkcja === 'ai_stan_eksportu') {
      const w = kluczKonta(tresc.p_klucz);
      if (w.blad) return w;
      const z = stan.eksporty.find((x) => x.id === tresc.p_id && x.wlasciciel === w.d.owner_id);
      if (!z) return { blad: 'Nie ma takiego zlecenia eksportu (albo wygasło po 7 dniach).' };
      return { ...json(z), ...(z.stan === 'gotowe' && zyje(z) ? { sekret: z.sekret } : {}) };
    }
    return undefined;
  }

  // Aplikacja (zalogowane konto).
  function app(funkcja, tresc, konto) {
    if (funkcja === 'eksport_do_pobrania') {
      const z = stan.eksporty.find((x) => x.id === tresc.p_id);
      return z && z.stan === 'gotowe' && zyje(z) && z.plik && String(tresc.p_sekret || '').length >= 32 && z.sekret === tresc.p_sekret
        ? { plik: z.plik, nazwa: z.nazwa, typ: z.typ } : null;
    }
    if (!konto) throw Object.assign(new Error('Brak sesji'), { status: 401, message: 'Brak sesji' });
    const moje = stan.eksporty.filter((z) => z.wlasciciel === konto.id);
    if (funkcja === 'eksporty_czekajace') return moje.filter((z) => zyje(z) && (z.stan === 'czeka' || porzucone(z))).map(json);
    if (funkcja === 'zlecenie_eksportu') { const z = moje.find((x) => x.id === tresc.p_id); return z ? json(z) : null; }
    if (funkcja === 'przyjmij_eksport') {
      const z = moje.find((x) => x.id === tresc.p_id);
      const karta = String(tresc.p_karta || '').slice(0, 80);
      if (!z || !zyje(z) || !(z.stan === 'czeka' || porzucone(z) || (z.stan === 'blad' && z.karta === karta))) return null;
      Object.assign(z, { stan: 'w_toku', karta, przyjeto: teraz(), zmieniono: teraz(), blad: null });
      oglos(z, 'UPDATE');
      return json(z);
    }
    if (funkcja === 'zakoncz_eksport') {
      const blad = tresc.p_blad ?? null;
      if (blad === null && !String(tresc.p_plik || '').startsWith(`${konto.id}/_eksporty/`)) {
        throw Object.assign(new Error('Plik eksportu musi leżeć w folderze _eksporty konta'), { status: 400, message: 'Plik eksportu musi leżeć w folderze _eksporty konta' });
      }
      const z = moje.find((x) => x.id === tresc.p_id && x.stan === 'w_toku' && x.karta === String(tresc.p_karta || '').slice(0, 80));
      if (!z) throw Object.assign(new Error('To zlecenie przyjęła inna karta albo już je zakończono'), { status: 400, message: 'To zlecenie przyjęła inna karta albo już je zakończono' });
      Object.assign(z, {
        stan: blad === null ? 'gotowe' : 'blad', plik: blad === null ? tresc.p_plik : null, nazwa: tresc.p_nazwa, typ: tresc.p_typ,
        rozmiar: tresc.p_rozmiar, strony: tresc.p_strony, uwagi: Array.isArray(tresc.p_uwagi) ? tresc.p_uwagi.slice(0, 40) : [], blad, zmieniono: teraz(),
      });
      oglos(z, 'UPDATE');
      return json(z);
    }
    if (funkcja === 'zakoncz_zadanie') {
      const z = moje.find((x) => x.id === tresc.p_id && x.stan === 'w_toku' && x.karta === String(tresc.p_karta || '').slice(0, 80) && ['link', 'obraz', 'kadry', 'dymki', 'biblioteka'].includes(x.rodzaj));
      if (!z) throw Object.assign(new Error('To zadanie przyjęła inna karta albo już je zakończono'), { status: 400, message: 'To zadanie przyjęła inna karta albo już je zakończono' });
      const blad = tresc.p_blad ?? null;
      Object.assign(z, { stan: blad === null ? 'gotowe' : 'blad', wynik: tresc.p_wynik && typeof tresc.p_wynik === 'object' ? tresc.p_wynik : {}, blad, zmieniono: teraz() });
      oglos(z, 'UPDATE');
      return json(z);
    }
    if (funkcja === 'wygasle_eksporty') return moje.filter((z) => !zyje(z)).map((z) => ({ id: z.id, plik: z.plik }));
    if (funkcja === 'usun_eksporty') {
      const ids = new Set(tresc.p_ids || []);
      stan.eksporty = stan.eksporty.filter((z) => !(z.wlasciciel === konto.id && ids.has(z.id)));
      return null;
    }
    return undefined;
  }
  return { ai, app };
}
atrapaEksportu.ma = (funkcja) => ['eksport_do_pobrania', 'eksporty_czekajace', 'zlecenie_eksportu', 'przyjmij_eksport', 'zakoncz_eksport', 'zakoncz_zadanie', 'wygasle_eksporty', 'usun_eksporty'].includes(funkcja);

module.exports = { atrapaEksportu };
