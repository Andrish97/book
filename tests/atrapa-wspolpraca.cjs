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

const nazwaKonta = (k) => (k?.nazwa || '').trim() || String(k?.email || '').split('@')[0];

// Rola konta w projekcie: 'wlasciciel' | 'edycja' | 'odczyt' | null.
function rolaW(stan, konto, projektId) {
  const p = stan.projekty.find((x) => x.id === projektId);
  if (!p || !konto) return null;
  if (p.owner_id === konto.id) return 'wlasciciel';
  return stan.wspolpracownicy.find((w) => w.projekt_id === projektId && w.uzytkownik === konto.id)?.rola || null;
}

function atrapaWspolpracy(stan) {
  stan.wspolpracownicy = stan.wspolpracownicy || [];
  stan.zaproszenia = stan.zaproszenia || [];
  const konto = (id) => stan.konta.find((k) => k.id === id);
  const teraz = () => new Date();
  const wazne = (z) => new Date(z.wazne_do) > teraz();
  // Wiersze tabel współpracy na żywo (Realtime + RLS): zaproszenie – do zaproszonego adresu i zapraszającego,
  // współpraca – do współpracownika i właściciela projektu.
  const oglosZaproszenie = (z, typ) => {
    const odbiorcy = stan.konta.filter((k) => k.email.toLowerCase() === z.email.toLowerCase() || k.id === z.zaprosil).map((k) => k.id);
    stan.oglosWiersz?.('zaproszenia', typ, { id: z.id, projekt_id: z.projekt_id, email: z.email, rola: z.rola, stan: z.stan }, odbiorcy);
  };
  const oglosDostep = (w, typ) => {
    const p = stan.projekty.find((x) => x.id === w.projekt_id);
    stan.oglosWiersz?.('wspolpracownicy', typ, { projekt_id: w.projekt_id, uzytkownik: w.uzytkownik, rola: w.rola }, [w.uzytkownik, p?.owner_id].filter(Boolean));
  };

  const funkcje = {
    zapros_do_projektu(k, { p_projekt, p_email, p_rola }) {
      if (rolaW(stan, k, p_projekt) !== 'wlasciciel') throw blad('Zapraszać może tylko właściciel projektu (a projekt musi być zapisany na koncie)', '42501', 403);
      if (!['edycja', 'odczyt'].includes(p_rola)) throw blad('Nieznana rola: wybierz „może edytować” albo „może oglądać”');
      const email = String(p_email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw blad('To nie wygląda na adres e-mail');
      if (email === k.email.toLowerCase()) throw blad('To Twój adres – jesteś właścicielem tego projektu');
      const istniejace = stan.konta.find((x) => x.email.toLowerCase() === email);
      if (istniejace && stan.wspolpracownicy.some((w) => w.projekt_id === p_projekt && w.uzytkownik === istniejace.id)) {
        throw blad('Ta osoba już ma dostęp do projektu – rolę zmienisz na liście poniżej');
      }
      let z = stan.zaproszenia.find((x) => x.projekt_id === p_projekt && x.email === email && x.stan === 'czeka' && wazne(x));
      if (z) {
        Object.assign(z, { rola: p_rola, wazne_do: new Date(Date.now() + 14 * 86400000).toISOString() });
        oglosZaproszenie(z, 'UPDATE');
      } else {
        if (stan.zaproszenia.filter((x) => x.zaprosil === k.id && Date.now() - new Date(x.utworzono) < 86400000).length >= 30) throw blad('Za dużo zaproszeń w ciągu doby – spróbuj jutro');
        z = {
          id: crypto.randomUUID(), projekt_id: p_projekt, email, rola: p_rola, kod: crypto.randomBytes(18).toString('base64url'),
          zaprosil: k.id, utworzono: new Date().toISOString(), wazne_do: new Date(Date.now() + 14 * 86400000).toISOString(), stan: 'czeka', przyjal: null,
        };
        stan.zaproszenia.push(z);
        oglosZaproszenie(z, 'INSERT');
      }
      return { id: z.id, kod: z.kod, email: z.email, rola: z.rola, wazne_do: z.wazne_do, konto: Boolean(istniejace) };
    },
    osoby_projektu(k, { p_projekt }) {
      const rola = rolaW(stan, k, p_projekt);
      if (!rola) throw blad('Nie masz dostępu do tego projektu', '42501', 403);
      const p = stan.projekty.find((x) => x.id === p_projekt);
      const w = konto(p.owner_id);
      return [
        { typ: 'wlasciciel', id: w.id, nazwa: nazwaKonta(w), email: w.email, rola: 'wlasciciel', ja: w.id === k.id },
        ...stan.wspolpracownicy.filter((x) => x.projekt_id === p_projekt).map((x) => {
          const u = konto(x.uzytkownik);
          return { typ: 'wspolpracownik', id: u.id, nazwa: nazwaKonta(u), email: u.email, rola: x.rola, od: x.dodano, ja: u.id === k.id };
        }),
        ...stan.zaproszenia.filter((z) => z.projekt_id === p_projekt && z.stan === 'czeka' && wazne(z)).map((z) => ({
          typ: 'zaproszenie', id: z.id, email: z.email, rola: z.rola, od: z.utworzono, wazne_do: z.wazne_do, kod: rola === 'wlasciciel' ? z.kod : null, ja: false,
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
        .filter((z) => z.email === k.email.toLowerCase() && z.stan === 'czeka' && wazne(z))
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
    udostepnione_mi(k) {
      return stan.wspolpracownicy.filter((w) => w.uzytkownik === k.id).map((w) => {
        const p = stan.projekty.find((x) => x.id === w.projekt_id);
        const wl = konto(p?.owner_id);
        return { projekt_id: w.projekt_id, rola: w.rola, wlasciciel: nazwaKonta(wl), wlasciciel_email: wl?.email, od: w.dodano };
      });
    },
  };

  const wywolaj = (nazwa, tresc, k) => {
    if (!k) throw blad('Brak sesji', 'PGRST301', 401);
    return funkcje[nazwa](k, tresc || {});
  };
  wywolaj.ma = (nazwa) => Object.prototype.hasOwnProperty.call(funkcje, nazwa);
  return wywolaj;
}

module.exports = { atrapaWspolpracy, rolaW, nazwaKonta };
