// Atrapa panelu administratora i poczty (migracja 20261115090000_poczta_panel.sql) – te same zasady w uproszczeniu:
// tylko administrator widzi panel, skrzynka z wątkami, odpowiedź idzie do kolejki, kolejka z akcjami, ustawienia,
// statystyki. Do tego formularz kontaktowy (Worker /kontakt) z limitem na adres.
// stan: wspólny stan atrapy (tests/pomoc.cjs); konto: zalogowane konto z tokenu albo null.

const crypto = require('node:crypto');

function blad(tekst, kod = 'P0001', status = 400) {
  const e = new Error(tekst);
  e.kod = kod;
  e.status = status;
  return e;
}

function atrapaPoczty(stan) {
  stan.administratorzy = stan.administratorzy || new Set();
  stan.poczta = stan.poczta || {
    watki: [], wiadomosci: [], kolejka: [],
    ustawienia: { nadawca_email: 'no-reply@makietka.app', nadawca_nazwa: 'Makietka', skrzynka_email: 'kontakt@makietka.app', limit_przebiegu: 25, odstep_ms: 1000, maks_prob: 5 },
    dostawcy: [{ id: 'brevo', nazwa: 'Brevo', typ: 'brevo', priorytet: 1, dzienny_limit: 300, aktywny: true, dzien: new Date().toISOString().slice(0, 10), wyslane_dzis: 0 }],
    odstepy: [
      { akcja: 'baza:adresat', opis: 'Każdy mail do tego samego adresu (wysyłka z kolejki)', sekundy: 60, na_dobe: 20, wlaczone: true },
      { akcja: 'kontakt:email', opis: 'Formularz kontaktowy z jednego adresu e-mail', sekundy: 300, na_dobe: 5, wlaczone: true },
    ],
    kontakty: new Map(), // adres → liczba wiadomości z formularza
  };
  const P = stan.poczta;
  const teraz = () => new Date().toISOString();
  const admin = (k) => {
    if (!k || !stan.administratorzy.has(k.id)) throw blad('Tylko dla administratora', '42501', 403);
  };
  const watek = (id) => P.watki.find((t) => t.id === id) || (() => { throw blad('Nie ma takiej rozmowy'); })();

  // Wiadomość „przychodząca” (test dopisuje ją tak, jak zrobiłby to Worker).
  function przyjmij({ od_email, od_nazwa = null, temat, tekst, zrodlo = 'mail', folder = 'skrzynka', do_email = zrodlo === 'mail' ? P.ustawienia.skrzynka_email : null, zalaczniki = [] }) {
    const t = { id: crypto.randomUUID(), temat, od_email, od_nazwa, zrodlo, folder, przeczytany: false, liczba: 1, ostatnia: teraz(), utworzono: teraz() };
    P.watki.push(t);
    P.wiadomosci.push({ id: crypto.randomUUID(), watek: t.id, kierunek: 'przychodzaca', od_email, od_nazwa, do_email, temat, tekst, zalaczniki, utworzono: teraz() });
    return t;
  }

  const funkcje = {
    czy_administrator: (_p, k) => Boolean(k && stan.administratorzy.has(k.id)),
    admin_poczta_watki: ({ p_folder = 'skrzynka', p_szukaj = null }, k) => {
      admin(k);
      const s = (p_szukaj || '').toLowerCase();
      const watki = P.watki.filter((t) => t.folder === p_folder && (!s || `${t.temat} ${t.od_email}`.toLowerCase().includes(s)))
        .sort((a, b) => b.ostatnia.localeCompare(a.ostatnia))
        .map((t) => ({
          ...t,
          zajawka: P.wiadomosci.filter((w) => w.watek === t.id).at(-1)?.tekst?.slice(0, 160) || '',
          na_adres: P.wiadomosci.filter((w) => w.watek === t.id && w.kierunek === 'przychodzaca' && w.do_email && w.do_email.toLowerCase() !== P.ustawienia.skrzynka_email).at(-1)?.do_email || null,
        }));
      const liczniki = Object.fromEntries(['skrzynka', 'archiwum', 'spam', 'kosz'].map((f) => [f, P.watki.filter((t) => t.folder === f && (f !== 'skrzynka' || !t.przeczytany)).length]));
      return { watki, liczniki };
    },
    admin_poczta_watek: ({ p_id }, k) => {
      admin(k);
      const t = watek(p_id);
      t.przeczytany = true;
      return {
        watek: t,
        skrzynka: P.ustawienia.skrzynka_email,
        wiadomosci: P.wiadomosci.filter((w) => w.watek === p_id).map((w) => ({ ...w, stan: P.kolejka.find((q) => q.id === w.kolejka)?.stan || null })),
      };
    },
    admin_poczta_zmien: ({ p_id, p_folder, p_przeczytany }, k) => {
      admin(k);
      const t = watek(p_id);
      if (p_folder) t.folder = p_folder;
      if (p_przeczytany !== null && p_przeczytany !== undefined) t.przeczytany = p_przeczytany;
      return null;
    },
    admin_poczta_oproznij_kosz: (_p, k) => {
      admin(k);
      const n = P.watki.filter((t) => t.folder === 'kosz').length;
      P.watki = P.watki.filter((t) => t.folder !== 'kosz');
      return n;
    },
    admin_poczta_odpowiedz: ({ p_watek, p_tresc }, k) => {
      admin(k);
      const t = watek(p_watek);
      if (!String(p_tresc || '').trim()) throw blad('Odpowiedź jest pusta');
      const q = { id: crypto.randomUUID(), rodzaj: 'odpowiedz', do_email: t.od_email, temat: `Re: ${t.temat}`, stan: 'czeka', proby: 0, nastepna_proba: teraz(), utworzono: teraz(), tresc: p_tresc };
      P.kolejka.push(q);
      P.wiadomosci.push({ id: crypto.randomUUID(), watek: t.id, kierunek: 'wychodzaca', od_email: P.ustawienia.skrzynka_email, do_email: t.od_email, temat: q.temat, tekst: p_tresc, zalaczniki: [], kolejka: q.id, utworzono: teraz() });
      t.liczba += 1;
      t.ostatnia = teraz();
      t.folder = 'skrzynka';
      return { ok: true, kolejka: q.id };
    },
    admin_kolejka: ({ p_stan = null }, k) => {
      admin(k);
      return {
        maile: P.kolejka.filter((q) => !p_stan || q.stan === p_stan).slice().reverse(),
        liczniki: Object.fromEntries(['czeka', 'wysylanie', 'wyslany', 'blad', 'anulowany'].map((s) => [s, P.kolejka.filter((q) => q.stan === s).length])),
        dostawcy: P.dostawcy.map((d) => ({ id: d.id, nazwa: d.nazwa, dzienny_limit: d.dzienny_limit, wyslane_dzis: d.wyslane_dzis, aktywny: d.aktywny })),
      };
    },
    admin_kolejka_akcja: ({ p_id, p_akcja }, k) => {
      admin(k);
      const q = P.kolejka.find((x) => x.id === p_id);
      if (!q) return null;
      if (p_akcja === 'anuluj' && ['czeka', 'blad'].includes(q.stan)) q.stan = 'anulowany';
      if (p_akcja === 'ponow' && ['blad', 'anulowany'].includes(q.stan)) Object.assign(q, { stan: 'czeka', proby: 0, blad: null });
      return null;
    },
    admin_poczta_ustawienia: (_p, k) => {
      admin(k);
      return { ustawienia: { ...P.ustawienia }, dostawcy: P.dostawcy, odstepy: P.odstepy };
    },
    admin_poczta_zapisz: ({ p }, k) => {
      admin(k);
      const u = p.ustawienia || {};
      if ((u.nadawca_email && !/@makietka\.app$/i.test(u.nadawca_email)) || (u.skrzynka_email && !/@makietka\.app$/i.test(u.skrzynka_email))) {
        throw blad('Adres nadawcy i skrzynki musi być w domenie makietka.app');
      }
      Object.assign(P.ustawienia, u);
      for (const d of p.dostawcy || []) Object.assign(P.dostawcy.find((x) => x.id === d.id) || {}, d);
      for (const o of p.odstepy || []) Object.assign(P.odstepy.find((x) => x.akcja === o.akcja) || {}, o);
      return null;
    },
    admin_poczta_test: ({ p_do }, k) => {
      admin(k);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p_do || '')) throw blad('Nieprawidłowy adres');
      P.kolejka.push({ id: crypto.randomUUID(), rodzaj: 'test', do_email: p_do, stan: 'czeka', proby: 0, nastepna_proba: teraz(), utworzono: teraz() });
      return { ok: true };
    },
    // Jak rozmiary_tabel() (migracja 20261114210000) – w aplikacji woła ją tylko panel administratora.
    rozmiary_tabel: () => ({
      baza: 12 * 1024 * 1024,
      tabele: [{ tabela: 'public.strony', bajty: 6 * 1024 * 1024, wiersze: 1200 }, { tabela: 'public.projekty', bajty: 2 * 1024 * 1024, wiersze: 40 }],
    }),
    admin_statystyki: (_p, k) => {
      admin(k);
      const dni = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10));
      const seria = (lista) => dni.map((d) => ({ dzien: d, ile: lista.filter((x) => String(x).slice(0, 10) === d).length }));
      return {
        dni: 30,
        konta: { razem: stan.konta.length, aktywne_7: stan.konta.length, aktywne_30: stan.konta.length, nowe_7: stan.konta.length },
        projekty: { razem: stan.projekty.length, zmienione_7: stan.projekty.length, wspoldzielone: 0 },
        zaproszenia: { razem: (stan.zaproszenia || []).length, przyjete: 0, czekajace: 0 },
        maile: { wyslane_dzis: P.kolejka.filter((q) => q.stan === 'wyslany').length, wyslane_30: P.kolejka.filter((q) => q.stan === 'wyslany').length, bledy: 0, w_kolejce: P.kolejka.filter((q) => q.stan === 'czeka').length },
        skrzynka: { nieprzeczytane: P.watki.filter((t) => t.folder === 'skrzynka' && !t.przeczytany).length, rozmowy_30: P.watki.length },
        serie: { konta: seria(stan.konta.map(() => teraz())), projekty: seria(stan.projekty.map(() => teraz())), maile: seria(P.kolejka.filter((q) => q.wyslano).map((q) => q.wyslano)) },
      };
    },
  };

  // Przebieg kolejki (Funkcja Edge poczta { kolejka: true }): wszystko, co czeka, „wychodzi”.
  function przebieg() {
    let n = 0;
    for (const q of P.kolejka) {
      if (q.stan !== 'czeka') continue;
      Object.assign(q, { stan: 'wyslany', wyslano: teraz(), proby: q.proby + 1 });
      stan.wyslane.push({ typ: q.rodzaj, email: q.do_email });
      n += 1;
    }
    P.dostawcy[0].wyslane_dzis += n;
    return { wyslane: n, bledy: 0, powod: null };
  }

  // Formularz kontaktowy (Worker /kontakt): bez sekretu SUPABASE_SERVICE_ROLE_KEY w Workerze (P.sekretWorkera) – nie działa; najwyżej 2 wiadomości z jednego adresu.
  function kontakt(tresc, konto) {
    if (tresc.www) return { status: 200, tresc: { ok: true } };
    if (!P.sekretWorkera) return { status: 503, tresc: { blad: 'Formularz jeszcze nie działa – napisz na kontakt@makietka.app.', powod: 'niegotowy' } };
    const email = String(tresc.email || '').toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 422, tresc: { blad: 'Podaj poprawny adres e-mail, żebyśmy mogli odpowiedzieć.' } };
    if (String(tresc.tresc || '').trim().length < 10) return { status: 422, tresc: { blad: 'Napisz trochę więcej (co najmniej 10 znaków).' } };
    const n = P.kontakty.get(email) || 0;
    if (n >= 2) return { status: 429, tresc: { blad: 'Za dużo wiadomości – spróbuj ponownie za 5 min.', powod: 'za-czesto', za: '5 min' } };
    P.kontakty.set(email, n + 1);
    const t = przyjmij({ od_email: email, temat: tresc.temat || 'Wiadomość z formularza', tekst: tresc.tresc, zrodlo: 'formularz' });
    t.uzytkownik = konto?.id || null;
    P.kolejka.push({ id: crypto.randomUUID(), rodzaj: 'kontakt', do_email: email, stan: 'czeka', proby: 0, nastepna_proba: teraz(), utworzono: teraz() });
    przebieg();
    return { status: 200, tresc: { ok: true } };
  }

  const wywolaj = (nazwa, parametry, konto) => funkcje[nazwa](parametry || {}, konto);
  wywolaj.ma = (nazwa) => Object.hasOwn(funkcje, nazwa);
  wywolaj.przyjmij = przyjmij;
  wywolaj.przebieg = przebieg;
  wywolaj.kontakt = kontakt;
  return wywolaj;
}

module.exports = { atrapaPoczty };
