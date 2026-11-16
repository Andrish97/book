// Atrapa funkcji współpracy (migracja 20261114120000_wspolpraca.sql) – te same zasady co w bazie:
// kto może zapraszać, przyjmować, zmieniać role, odbierać dostęp i opuszczać projekt.
// stan: wspólny stan atrapy (tests/pomoc.cjs); konto: zalogowane konto z tokenu albo null.

const crypto = require('node:crypto');

function blad(tekst, kod = 'P0001', status = 400) {
  const e = new Error(tekst);
  e.kod = kod;
  e.status = status;
  return e;
}

// Nazwy użytkownika (#100, migracja nazwy_uzytkownikow): stan.profile – id konta → nazwa. Konta z testów (bez
// rejestracji przez aplikację) dostają nazwę same – z imienia albo z adresu – chyba że test poda nazwaUzytkownika: null.
const poprawnaNazwa = (n) => /^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.-]{2,29}$/.test(String(n || '')) && !/[_.-]{2}/.test(String(n || ''));
function nazwaUzytkownika(stan, k) {
  if (!k) return null;
  stan.profile = stan.profile || new Map();
  if (stan.profile.has(k.id)) return stan.profile.get(k.id);
  if (k.zRejestracji || k.nazwaUzytkownika === null) return null;
  const zajete = (n) => [...stan.profile.values()].some((x) => x.toLowerCase() === n.toLowerCase());
  let n = k.nazwaUzytkownika || (poprawnaNazwa(k.nazwa) ? k.nazwa : String(k.email || '').split('@')[0].replace(/[^A-Za-z0-9]/g, ''));
  if (n.length < 3) n = `${n}konto`;
  let wolna = n;
  for (let i = 2; zajete(wolna); i += 1) wolna = `${n}${i}`;
  stan.profile.set(k.id, wolna);
  return wolna;
}
let stanNazw = null;
const nazwaKonta = (k) => (stanNazw && nazwaUzytkownika(stanNazw, k)) || (k?.nazwa || '').trim() || String(k?.email || '').split('@')[0];

// Rola konta w projekcie: 'wlasciciel' | 'edycja' | 'odczyt' | null.
function rolaW(stan, konto, projektId) {
  const p = stan.projekty.find((x) => x.id === projektId);
  if (!p || !konto) return null;
  if (p.owner_id === konto.id) return 'wlasciciel';
  return stan.wspolpracownicy.find((w) => w.projekt_id === projektId && w.uzytkownik === konto.id)?.rola || null;
}

function atrapaWspolpracy(stan) {
  stanNazw = stan;
  stan.profile = stan.profile || new Map();
  stan.wspolpracownicy = stan.wspolpracownicy || [];
  stan.zaproszenia = stan.zaproszenia || [];
  const konto = (id) => stan.konta.find((k) => k.id === id);
  const teraz = () => new Date();
  const wazne = (z) => new Date(z.wazne_do) > teraz();
  // Wiersze tabel współpracy na żywo (Realtime + RLS): zaproszenie – do zaproszonego adresu i zapraszającego,
  // współpraca – do współpracownika i właściciela projektu.
  const oglosZaproszenie = (z, typ) => {
    const odbiorcy = stan.konta.filter((k) => k.email.toLowerCase() === z.email.toLowerCase() || k.id === z.konto).map((k) => k.id);
    stan.oglosWiersz?.('zaproszenia', typ, { id: z.id, projekt_id: z.projekt_id, email: z.email, rola: z.rola, stan: z.stan }, odbiorcy);
  };
  const oglosDostep = (w, typ) => {
    const p = stan.projekty.find((x) => x.id === w.projekt_id);
    stan.oglosWiersz?.('wspolpracownicy', typ, { projekt_id: w.projekt_id, uzytkownik: w.uzytkownik, rola: w.rola }, [w.uzytkownik, p?.owner_id].filter(Boolean));
  };

  stan.komentarze = stan.komentarze || [];
  let nrKomentarza = 0;
  const osobyZDostepem = (projektId) => {
    const p = stan.projekty.find((x) => x.id === projektId);
    return [p?.owner_id, ...stan.wspolpracownicy.filter((w) => w.projekt_id === projektId).map((w) => w.uzytkownik)].filter(Boolean);
  };
  const wzmianki = (projektId, tresc) => {
    const nazwy = [...String(tresc).matchAll(/(^|\s)@([A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.-]{3,30})/g)].map((m) => m[2].replace(/[.]+$/, '').toLowerCase());
    return osobyZDostepem(projektId).filter((id) => nazwy.includes(String(nazwaKonta(konto(id)) || '').toLowerCase()));
  };
  const oglosKomentarz = (x, typ) => stan.oglosWiersz?.('komentarze', typ, { id: x.id, projekt_id: x.projekt_id }, osobyZDostepem(x.projekt_id));
  const komentarzJson = (x, k) => ({
    id: x.id, projekt_id: x.projekt_id, watek: x.watek, autor: x.autor,
    autor_nazwa: x.zrodlo === 'ai' ? (x.podpis || 'AI') : nazwaKonta(konto(x.autor)), zrodlo: x.zrodlo,
    strona_id: x.strona_id, element_id: x.element_id, x: x.x, y: x.y, tresc: x.tresc, wzmianki: x.wzmianki,
    rozwiazany: x.rozwiazany, rozwiazal_nazwa: x.rozwiazal ? nazwaKonta(konto(x.rozwiazal)) : null, rozwiazano: x.rozwiazano,
    utworzono: x.utworzono, zmieniono: x.zmieniono, moj: Boolean(k && x.autor === k.id && x.zrodlo === 'konto'),
  });
  // Wspólne dla aplikacji i AI (ai_skomentuj): k – konto autora (przy AI właściciel klucza).
  const dodajKomentarz = (k, { p_projekt, p_strona = null, p_element = null, p_x = null, p_y = null, p_tresc, p_watek = null }, zrodlo, podpis) => {
    if (!rolaW(stan, k, p_projekt)) throw blad('Nie masz dostępu do tego projektu', '42501', 403);
    const tresc = String(p_tresc || '').trim();
    if (!tresc) throw blad('Komentarz nie może być pusty');
    if (tresc.length > 4000) throw blad('Komentarz jest za długi (najwyżej 4000 znaków)');
    let watek = null;
    let strona = p_strona;
    if (p_watek) {
      const w = stan.komentarze.find((y) => y.id === p_watek && y.projekt_id === p_projekt && !y.usunieto);
      if (!w) throw blad('Ten wątek został usunięty albo nie ma go w tym projekcie', 'P0002', 404);
      watek = w.watek || w.id;
      strona = stan.komentarze.find((y) => y.id === watek).strona_id;
    } else if (!strona) throw blad('Podaj stronę komentarza');
    const x = {
      id: crypto.randomUUID(), n: (nrKomentarza += 1), projekt_id: p_projekt, watek, autor: k.id, zrodlo, podpis,
      strona_id: strona, element_id: watek ? null : p_element, x: watek ? null : p_x, y: watek ? null : p_y,
      tresc, wzmianki: wzmianki(p_projekt, tresc), rozwiazany: false, rozwiazal: null, rozwiazano: null,
      utworzono: new Date(Date.now() + nrKomentarza).toISOString(), zmieniono: null,
    };
    stan.komentarze.push(x);
    oglosKomentarz(x, 'INSERT');
    return x;
  };
  stan.komentarzeAI = { dodaj: dodajKomentarz, json: komentarzJson, rozwiaz: (k, a) => funkcje.rozwiaz_komentarz(k, a) };

  const funkcje = {
    zapros_do_projektu(k, { p_projekt, p_email, p_rola }) {
      if (rolaW(stan, k, p_projekt) !== 'wlasciciel') throw blad('Zapraszać może tylko właściciel projektu (a projekt musi być zapisany na koncie)', '42501', 403);
      if (!['edycja', 'odczyt'].includes(p_rola)) throw blad('Nieznana rola: wybierz „może edytować” albo „może oglądać”');
      const kto = String(p_email || '').trim();
      const przezNazwe = !kto.replace(/^@/, '').includes('@');
      let email;
      let istniejace;
      if (przezNazwe) {
        const n = kto.replace(/^@/, '').toLowerCase();
        istniejace = stan.konta.find((x) => (nazwaUzytkownika(stan, x) || '').toLowerCase() === n);
        if (!istniejace) throw blad(`Nie ma konta o nazwie użytkownika „${kto.replace(/^@/, '')}” – sprawdź nazwę albo wpisz adres e-mail`);
        if (istniejace.id === k.id) throw blad('To Twoja nazwa – jesteś właścicielem tego projektu');
        email = istniejace.email.toLowerCase();
      } else {
        email = kto.toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw blad('To nie wygląda na adres e-mail ani nazwę użytkownika');
        if (email === k.email.toLowerCase()) throw blad('To Twój adres – jesteś właścicielem tego projektu');
        istniejace = stan.konta.find((x) => x.email.toLowerCase() === email);
      }
      if (istniejace && stan.wspolpracownicy.some((w) => w.projekt_id === p_projekt && w.uzytkownik === istniejace.id)) {
        throw blad('Ta osoba już ma dostęp do projektu – rolę zmienisz na liście poniżej');
      }
      let z = stan.zaproszenia.find((x) => x.projekt_id === p_projekt && (x.email === email || (istniejace && x.konto === istniejace.id)) && x.stan === 'czeka' && wazne(x));
      if (z) {
        Object.assign(z, { rola: p_rola, wazne_do: new Date(Date.now() + 14 * 86400000).toISOString(), konto: z.konto || istniejace?.id || null, przez_nazwe: z.przez_nazwe && przezNazwe });
        oglosZaproszenie(z, 'UPDATE');
      } else {
        if (stan.zaproszenia.filter((x) => x.zaprosil === k.id && Date.now() - new Date(x.utworzono) < 86400000).length >= 30) throw blad('Za dużo zaproszeń w ciągu doby – spróbuj jutro');
        z = {
          id: crypto.randomUUID(), projekt_id: p_projekt, email, rola: p_rola, kod: crypto.randomBytes(18).toString('base64url'),
          zaprosil: k.id, utworzono: new Date().toISOString(), wazne_do: new Date(Date.now() + 14 * 86400000).toISOString(), stan: 'czeka', przyjal: null,
          konto: istniejace?.id || null, przez_nazwe: przezNazwe,
        };
        stan.zaproszenia.push(z);
        oglosZaproszenie(z, 'INSERT');
      }
      return { id: z.id, kod: z.kod, email: z.przez_nazwe ? null : z.email, nazwa: istniejace ? nazwaUzytkownika(stan, istniejace) : null, rola: z.rola, wazne_do: z.wazne_do, konto: Boolean(istniejace), przez_nazwe: z.przez_nazwe };
    },
    osoby_projektu(k, { p_projekt }) {
      const rola = rolaW(stan, k, p_projekt);
      if (!rola) throw blad('Nie masz dostępu do tego projektu', '42501', 403);
      const p = stan.projekty.find((x) => x.id === p_projekt);
      const w = konto(p.owner_id);
      return [
        { typ: 'wlasciciel', id: w.id, nazwa: nazwaKonta(w), email: w.id === k.id ? w.email : null, rola: 'wlasciciel', ja: w.id === k.id },
        ...stan.wspolpracownicy.filter((x) => x.projekt_id === p_projekt).map((x) => {
          const u = konto(x.uzytkownik);
          return { typ: 'wspolpracownik', id: u.id, nazwa: nazwaKonta(u), email: u.id === k.id ? u.email : null, rola: x.rola, od: x.dodano, ja: u.id === k.id };
        }),
        ...stan.zaproszenia.filter((z) => z.projekt_id === p_projekt && z.stan === 'czeka' && wazne(z)).map((z) => ({
          typ: 'zaproszenie', id: z.id, email: z.przez_nazwe ? null : z.email, nazwa: z.konto ? nazwaUzytkownika(stan, konto(z.konto)) : null, rola: z.rola, od: z.utworzono, wazne_do: z.wazne_do, kod: rola === 'wlasciciel' ? z.kod : null, ja: false,
        })),
      ];
    },
    cofnij_zaproszenie(k, { p_id }) {
      const z = stan.zaproszenia.find((x) => x.id === p_id);
      if (z && rolaW(stan, k, z.projekt_id) === 'wlasciciel') stan.zaproszenia = stan.zaproszenia.filter((x) => x !== z);
      return null;
    },
    zmien_role_wspolpracownika(k, { p_projekt, p_uzytkownik, p_rola }) {
      if (!['edycja', 'odczyt'].includes(p_rola)) throw blad('Nieznana rola');
      if (rolaW(stan, k, p_projekt) !== 'wlasciciel') throw blad('Role zmienia tylko właściciel projektu', '42501', 403);
      const w = stan.wspolpracownicy.find((x) => x.projekt_id === p_projekt && x.uzytkownik === p_uzytkownik);
      if (w) { w.rola = p_rola; oglosDostep(w, 'UPDATE'); }
      return null;
    },
    usun_z_projektu(k, { p_projekt, p_uzytkownik }) {
      if (p_uzytkownik !== k.id && rolaW(stan, k, p_projekt) !== 'wlasciciel') throw blad('Dostęp odbiera tylko właściciel projektu', '42501', 403);
      const w = stan.wspolpracownicy.find((x) => x.projekt_id === p_projekt && x.uzytkownik === p_uzytkownik);
      stan.wspolpracownicy = stan.wspolpracownicy.filter((x) => x !== w);
      if (w) oglosDostep(w, 'DELETE');
      return null;
    },
    moje_zaproszenia(k) {
      return stan.zaproszenia
        .filter((z) => (z.konto === k.id || z.email === k.email.toLowerCase()) && z.stan === 'czeka' && wazne(z))
        .filter((z) => { const p = stan.projekty.find((x) => x.id === z.projekt_id); return p && p.owner_id !== k.id && !rolaW(stan, k, z.projekt_id); })
        .map((z) => {
          const p = stan.projekty.find((x) => x.id === z.projekt_id);
          const od = konto(z.zaprosil);
          return { id: z.id, kod: z.kod, projekt_id: z.projekt_id, projekt: p.nazwa, rola: z.rola, od: nazwaKonta(od), od_email: od.email, utworzono: z.utworzono, wazne_do: z.wazne_do };
        });
    },
    zaproszenie_z_kodu(k, { p_kod }) {
      const z = stan.zaproszenia.find((x) => x.kod === p_kod);
      if (!z) return { stan: 'brak' };
      const p = stan.projekty.find((x) => x.id === z.projekt_id);
      const info = { projekt: p.nazwa, projekt_id: p.id, rola: z.rola, od: nazwaKonta(konto(z.zaprosil)), email: z.email };
      if (p.owner_id === k.id) return { ...info, stan: 'wlasciciel' };
      if (rolaW(stan, k, p.id)) return { ...info, stan: 'juz_masz' };
      if (z.stan !== 'czeka') return { ...info, stan: z.stan };
      if (!wazne(z)) return { ...info, stan: 'wygaslo' };
      return { ...info, stan: 'ok' };
    },
    przyjmij_zaproszenie(k, { p_kod }) {
      const z = stan.zaproszenia.find((x) => x.kod === p_kod);
      if (!z) throw blad('Nie ma takiego zaproszenia – mogło zostać cofnięte');
      const p = stan.projekty.find((x) => x.id === z.projekt_id);
      if (p.owner_id === k.id) throw blad('To Twój projekt – nie musisz przyjmować zaproszenia');
      const jest = stan.wspolpracownicy.find((x) => x.projekt_id === p.id && x.uzytkownik === k.id);
      if (jest) return { projekt_id: p.id, rola: jest.rola };
      if (z.stan !== 'czeka') throw blad('To zaproszenie zostało już wykorzystane albo odrzucone');
      if (!wazne(z)) throw blad('Zaproszenie wygasło – poproś o nowe');
      const w = { projekt_id: p.id, uzytkownik: k.id, rola: z.rola, zaprosil: z.zaprosil, dodano: new Date().toISOString() };
      stan.wspolpracownicy.push(w);
      Object.assign(z, { stan: 'przyjete', przyjal: k.id });
      oglosDostep(w, 'INSERT');
      oglosZaproszenie(z, 'UPDATE');
      return { projekt_id: p.id, rola: z.rola };
    },
    odrzuc_zaproszenie(k, { p_kod }) {
      const z = stan.zaproszenia.find((x) => x.kod === p_kod && x.stan === 'czeka');
      if (z) { z.stan = 'odrzucone'; oglosZaproszenie(z, 'UPDATE'); }
      return null;
    },
    nazwa_wolna(k, { p_nazwa }) {
      const n = String(p_nazwa || '').trim();
      if (!poprawnaNazwa(n)) return { poprawna: false, wolna: false };
      stan.konta.forEach((x) => nazwaUzytkownika(stan, x));
      const zajeta = (x) => [...stan.profile].some(([id, v]) => v.toLowerCase() === x.toLowerCase() && id !== k?.id);
      if (!zajeta(n)) return { poprawna: true, wolna: true };
      let i = 2;
      while (zajeta(`${n.slice(0, 27)}${i}`)) i += 1;
      return { poprawna: true, wolna: false, propozycja: `${n.slice(0, 27)}${i}` };
    },
    moja_nazwa_uzytkownika(k) { return nazwaUzytkownika(stan, k); },
    ustaw_nazwe_uzytkownika(k, { p_nazwa }) {
      const n = String(p_nazwa || '').trim();
      if (!poprawnaNazwa(n)) throw blad('Nazwa użytkownika: 3–30 znaków – litery, cyfry, _ . -; na początku litera albo cyfra');
      stan.konta.forEach((x) => nazwaUzytkownika(stan, x));
      if ([...stan.profile].some(([id, v]) => v.toLowerCase() === n.toLowerCase() && id !== k.id)) throw blad('Ta nazwa użytkownika jest już zajęta – wybierz inną');
      stan.profile.set(k.id, n);
      return n;
    },
    szukaj_nazw_uzytkownikow(k, { p_tekst }) {
      const t = String(p_tekst || '').trim().replace(/^@/, '').toLowerCase();
      if (t.length < 2 || t.includes('@')) return [];
      stan.konta.forEach((x) => nazwaUzytkownika(stan, x));
      return [...stan.profile].filter(([id, v]) => id !== k.id && v.toLowerCase().startsWith(t)).map(([, v]) => v)
        .sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 5);
    },
    // Komentarze na stronach (migracja 20261116200000_komentarze.sql, #131D).
    komentarze_projektu(k, { p_projekt }) {
      if (!rolaW(stan, k, p_projekt)) throw blad('Nie masz dostępu do tego projektu', '42501', 403);
      return stan.komentarze.filter((x) => x.projekt_id === p_projekt && !x.usunieto).sort((a, b) => a.n - b.n).map((x) => komentarzJson(x, k));
    },
    dodaj_komentarz(k, a) {
      return komentarzJson(dodajKomentarz(k, a, 'konto', null), k);
    },
    zmien_komentarz(k, { p_id, p_tresc }) {
      const x = stan.komentarze.find((y) => y.id === p_id && !y.usunieto);
      if (!x || x.autor !== k.id || x.zrodlo !== 'konto') throw blad('Zmienić można tylko własny komentarz', '42501', 403);
      if (!String(p_tresc || '').trim()) throw blad('Komentarz jest pusty');
      x.tresc = String(p_tresc || '').trim();
      x.wzmianki = wzmianki(x.projekt_id, x.tresc);
      x.zmieniono = new Date().toISOString();
      oglosKomentarz(x, 'UPDATE');
      return komentarzJson(x, k);
    },
    usun_komentarz(k, { p_id }) {
      const x = stan.komentarze.find((y) => y.id === p_id);
      if (!x || x.usunieto) return null;
      const rola = rolaW(stan, k, x.projekt_id);
      if (!(rola === 'wlasciciel' || (x.autor === k.id && x.zrodlo === 'konto'))) throw blad('Usunąć może autor albo właściciel projektu', '42501', 403);
      // Jak migracja 20261117100000: ślad (UPDATE) zamiast skasowania – zmiana idzie kanałem z filtrem (#172).
      for (const y of stan.komentarze.filter((z) => !z.usunieto && (z === x || (!x.watek && z.watek === x.id)))) {
        Object.assign(y, { usunieto: new Date().toISOString(), tresc: '–', wzmianki: [], podpis: null });
        oglosKomentarz(y, 'UPDATE');
      }
      return null;
    },
    rozwiaz_komentarz(k, { p_id, p_rozwiazany }) {
      const x = stan.komentarze.find((y) => y.id === p_id && !y.usunieto);
      if (!x || !rolaW(stan, k, x.projekt_id)) throw blad('Nie ma takiego komentarza', 'P0002', 404);
      if (x.watek) throw blad('Rozwiązuje się cały wątek, nie odpowiedź');
      x.rozwiazany = p_rozwiazany !== false;
      x.rozwiazal = x.rozwiazany ? k.id : null;
      x.rozwiazano = x.rozwiazany ? new Date().toISOString() : null;
      oglosKomentarz(x, 'UPDATE');
      return komentarzJson(x, k);
    },
    udostepnione_mi(k) {
      return stan.wspolpracownicy.filter((w) => w.uzytkownik === k.id).map((w) => {
        const p = stan.projekty.find((x) => x.id === w.projekt_id);
        const wl = konto(p?.owner_id);
        return { projekt_id: w.projekt_id, rola: w.rola, wlasciciel: nazwaKonta(wl), wlasciciel_email: wl?.email, od: w.dodano };
      });
    },
  };

  const wywolaj = (nazwa, tresc, k) => {
    if (!k && nazwa !== 'nazwa_wolna') throw blad('Brak sesji', 'PGRST301', 401);
    return funkcje[nazwa](k, tresc || {});
  };
  wywolaj.ma = (nazwa) => Object.prototype.hasOwnProperty.call(funkcje, nazwa);
  return wywolaj;
}

module.exports = { atrapaWspolpracy, rolaW, nazwaKonta };
