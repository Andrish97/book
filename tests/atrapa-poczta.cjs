// Atrapa panelu administratora i poczty (migracje 20261115090000_poczta_panel.sql, 20261115160000_skrzynka.sql) – te same
// zasady w uproszczeniu: tylko administrator widzi panel; skrzynka z folderami, gwiazdką, zgłoszeniami (ZGL-RRRR-NNNN),
// kopiami roboczymi i operacjami zbiorczymi; wysyłka (nowa, odpowiedź, wszystkim, przekazanie) idzie do kolejki z DW/UDW,
// załącznikami i nagłówkami wątku; kolejka z akcjami, ustawienia (z podpisem), statystyki bez kont testowych (example.com).
// Do tego formularz kontaktowy (Worker /kontakt) z limitem na adres. Zmiany rozmów – Realtime do administratorów.
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
    watki: [], wiadomosci: [], kolejka: [], robocze: [],
    ustawienia: {
      nadawca_email: 'no-reply@makietka.app', nadawca_nazwa: 'Makietka', skrzynka_email: 'kontakt@makietka.app', limit_przebiegu: 25, odstep_ms: 1000, maks_prob: 5,
      podpis: 'Pozdrawiamy\nZespół Makietki',
    },
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
  // Realtime: zmiana w poczta_watki – do administratorów (reguła RLS czy_administrator()).
  const oglos = (t, typ = 'UPDATE') => stan.oglosWiersz?.('poczta_watki', typ, { id: t.id, folder: t.folder, przeczytany: t.przeczytany }, [...stan.administratorzy]);
  const adresy = (lista) => [...new Set((lista || []).map((a) => String(a).trim().toLowerCase()).filter(Boolean))];
  let nrZgloszenia = 0;
  // Kolejne wpisy w tej samej milisekundzie – rosnący czas (kolejność rozmów i wiadomości).
  let ostatniCzas = 0;
  const znacznik = () => { ostatniCzas = Math.max(Date.now(), ostatniCzas + 1); return new Date(ostatniCzas).toISOString(); };

  // Wiadomość „przychodząca” (test dopisuje ją tak, jak zrobiłby to Worker): nowa rozmowa albo dopisanie do istniejącej
  // (watek – odpowiedź klienta). Formularz – zgłoszenie z numerem.
  function przyjmij({
    od_email, od_nazwa = null, temat, tekst, html = null, zrodlo = 'mail', folder = 'skrzynka', do_email = zrodlo === 'mail' ? P.ustawienia.skrzynka_email : null,
    do_lista = null, dw = [], zalaczniki = [], watek: wId = null,
  }) {
    const kiedy = znacznik();
    let t = wId && watek(wId);
    if (t) {
      Object.assign(t, { liczba: t.liczba + 1, ostatnia: kiedy, przeczytany: false, folder: ['archiwum', 'kosz', 'wyslane'].includes(t.folder) ? 'skrzynka' : t.folder });
      if (t.zgloszenie) t.zgloszenie_stan = 'otwarte';
    } else {
      t = { id: crypto.randomUUID(), temat, od_email, od_nazwa, zrodlo, folder, przeczytany: false, gwiazdka: false, liczba: 1, ostatnia: kiedy, utworzono: kiedy, zgloszenie: null, zgloszenie_stan: null };
      if (zrodlo === 'formularz') Object.assign(t, { zgloszenie: `ZGL-${kiedy.slice(0, 4)}-${String((nrZgloszenia += 1)).padStart(4, '0')}`, zgloszenie_stan: 'otwarte' });
      P.watki.push(t);
    }
    P.wiadomosci.push({
      id: crypto.randomUUID(), watek: t.id, kierunek: 'przychodzaca', od_email, od_nazwa, do_email, do_lista: do_lista || (do_email ? [do_email] : []), dw,
      udw: [], temat, tekst, html, zalaczniki, message_id: `<${crypto.randomUUID()}@przyklad.pl>`, utworzono: kiedy,
    });
    oglos(t, wId ? 'UPDATE' : 'INSERT');
    return t;
  }

  const wFolderze = (t, f) => ({
    zgloszenia: t.zgloszenie && !['spam', 'kosz'].includes(t.folder),
    gwiazdka: t.gwiazdka && t.folder !== 'kosz',
    wyslane: !['spam', 'kosz'].includes(t.folder) && P.wiadomosci.some((w) => w.watek === t.id && w.kierunek === 'wychodzaca'),
  }[f] ?? t.folder === f);
  const kluczeWolne = (klucze) => klucze.filter((k) => !P.wiadomosci.some((w) => (w.zalaczniki || []).some((z) => z.klucz === k))
    && !P.robocze.some((r) => r.zalaczniki.some((z) => z.klucz === k)));
  const zalaczniki = (lista) => {
    const z = (lista || []).map((x) => ({ nazwa: x.nazwa, typ: x.typ, rozmiar: x.rozmiar, klucz: x.klucz }));
    if (z.some((x) => !/^poczta\/[0-9a-f-]{36}\/[^/]+$/.test(x.klucz || ''))) throw blad('Nieprawidłowy załącznik');
    if (z.reduce((n, x) => n + (x.rozmiar || 0), 0) > 10 * 1024 * 1024) throw blad('Załączniki razem mają ponad 10 MB – to limit jednej wiadomości');
    return z;
  };
  const zbiorczo = ({ p_ids, p_akcja }) => {
    const lista = P.watki.filter((t) => p_ids.includes(t.id));
    if (p_akcja === 'usun') {
      const usuwane = lista.filter((t) => ['kosz', 'spam'].includes(t.folder));
      const klucze = P.wiadomosci.filter((w) => usuwane.some((t) => t.id === w.watek)).flatMap((w) => (w.zalaczniki || []).map((z) => z.klucz)).filter(Boolean);
      P.watki = P.watki.filter((t) => !usuwane.includes(t));
      P.wiadomosci = P.wiadomosci.filter((w) => !usuwane.some((t) => t.id === w.watek));
      P.robocze = P.robocze.filter((r) => !usuwane.some((t) => t.id === r.watek));
      for (const t of usuwane) oglos(t, 'DELETE');
      return { zmienione: usuwane.length, klucze: kluczeWolne(klucze) };
    }
    for (const t of lista) {
      if (p_akcja === 'przeczytane' || p_akcja === 'nieprzeczytane') t.przeczytany = p_akcja === 'przeczytane';
      else if (p_akcja === 'gwiazdka' || p_akcja === 'bez_gwiazdki') t.gwiazdka = p_akcja === 'gwiazdka';
      else if (['archiwum', 'spam', 'kosz'].includes(p_akcja)) { t.folder = p_akcja; if (p_akcja === 'kosz') t.przeczytany = true; }
      else if (p_akcja === 'przywroc') t.folder = P.wiadomosci.some((w) => w.watek === t.id && w.kierunek === 'przychodzaca') ? 'skrzynka' : 'wyslane';
      else if (p_akcja === 'zamknij' || p_akcja === 'otworz') { if (t.zgloszenie) t.zgloszenie_stan = p_akcja === 'zamknij' ? 'zamkniete' : 'otwarte'; }
      else throw blad('Nieznana operacja');
      oglos(t);
    }
    return { zmienione: lista.length, klucze: [] };
  };

  const funkcje = {
    czy_administrator: (_p, k) => Boolean(k && stan.administratorzy.has(k.id)),
    admin_poczta_watki: ({ p_folder = 'skrzynka', p_szukaj = null, p_limit = 50, p_od = 0 }, k) => {
      admin(k);
      const sz = (p_szukaj || '').toLowerCase();
      const liczniki = {
        skrzynka: P.watki.filter((t) => t.folder === 'skrzynka' && !t.przeczytany).length,
        zgloszenia: P.watki.filter((t) => t.zgloszenie_stan === 'otwarte' && !['spam', 'kosz'].includes(t.folder)).length,
        spam: P.watki.filter((t) => t.folder === 'spam' && !t.przeczytany).length,
        robocze: P.robocze.length,
      };
      if (p_folder === 'robocze') {
        const lista = P.robocze.filter((r) => !sz || `${r.temat} ${r.do_lista.join(' ')} ${r.html}`.toLowerCase().includes(sz))
          .sort((a, b) => b.zmieniono.localeCompare(a.zmieniono));
        return {
          watki: lista.slice(p_od, p_od + p_limit).map((r) => ({
            id: r.id, robocza: true, watek: r.watek, tryb: r.tryb, temat: r.temat, do_lista: r.do_lista, ostatnia: r.zmieniono,
            zajawka: r.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160), zalaczniki: r.zalaczniki.length > 0,
          })),
          razem: lista.length, skrzynka: P.ustawienia.skrzynka_email, podpis: P.ustawienia.podpis, od: p_od, limit: p_limit, liczniki,
        };
      }
      const lista = P.watki.filter((t) => wFolderze(t, p_folder) && (!sz || `${t.temat} ${t.od_email} ${t.zgloszenie || ''}`.toLowerCase().includes(sz)
        || P.wiadomosci.some((w) => w.watek === t.id && `${w.tekst || ''} ${(w.do_lista || []).join(' ')}`.toLowerCase().includes(sz))))
        .sort((a, b) => b.ostatnia.localeCompare(a.ostatnia));
      const watki = lista.slice(p_od, p_od + p_limit).map((t) => {
        const w = P.wiadomosci.filter((x) => x.watek === t.id);
        return {
          ...t,
          zajawka: (w.at(-1)?.tekst || '').replace(/\s+/g, ' ').slice(0, 160),
          na_adres: w.filter((x) => x.kierunek === 'przychodzaca' && x.do_email && x.do_email.toLowerCase() !== P.ustawienia.skrzynka_email).at(-1)?.do_email || null,
          do_lista: w.filter((x) => x.kierunek === 'wychodzaca').at(-1)?.do_lista || null,
          zalaczniki: w.some((x) => (x.zalaczniki || []).length),
          robocze: P.robocze.filter((r) => r.watek === t.id).length,
        };
      });
      return { watki, razem: lista.length, skrzynka: P.ustawienia.skrzynka_email, podpis: P.ustawienia.podpis, od: p_od, limit: p_limit, liczniki };
    },
    admin_poczta_watek: ({ p_id }, k) => {
      admin(k);
      const t = watek(p_id);
      if (!t.przeczytany) { t.przeczytany = true; oglos(t); }
      return {
        watek: t,
        skrzynka: P.ustawienia.skrzynka_email,
        podpis: P.ustawienia.podpis,
        uzytkownik: t.uzytkownik ? { id: t.uzytkownik, email: stan.konta.find((x) => x.id === t.uzytkownik)?.email } : null,
        wiadomosci: P.wiadomosci.filter((w) => w.watek === p_id).map((w) => {
          const q = P.kolejka.find((x) => x.id === w.kolejka);
          return { ...w, stan: q?.stan || null, blad: q?.blad || null };
        }),
        robocze: P.robocze.filter((r) => r.watek === p_id),
      };
    },
    admin_poczta_zbiorczo: (p, k) => { admin(k); return zbiorczo(p); },
    admin_poczta_oproznij: ({ p_folder }, k) => {
      admin(k);
      if (!['kosz', 'spam'].includes(p_folder)) throw blad('Opróżnić można tylko kosz albo spam');
      return zbiorczo({ p_ids: P.watki.filter((t) => t.folder === p_folder).map((t) => t.id), p_akcja: 'usun' });
    },
    admin_poczta_robocza_zapisz: ({ p }, k) => {
      admin(k);
      let r = P.robocze.find((x) => x.id === p.id);
      const byly = r ? r.zalaczniki.map((z) => z.klucz) : [];
      if (!r) {
        r = { id: p.id || crypto.randomUUID(), watek: p.watek || null, odpowiedz_na: p.odpowiedz_na || null, tryb: p.tryb || 'nowa', utworzono: teraz() };
        P.robocze.push(r);
      }
      Object.assign(r, { do_lista: adresy(p.do), dw: adresy(p.dw), udw: adresy(p.udw), temat: p.temat || '', html: p.html || '', zalaczniki: zalaczniki(p.zalaczniki), zmieniono: znacznik() });
      return { id: r.id, zmieniono: r.zmieniono, klucze: kluczeWolne(byly) };
    },
    admin_poczta_robocza: ({ p_id }, k) => {
      admin(k);
      return P.robocze.find((r) => r.id === p_id) || (() => { throw blad('Nie ma takiej kopii roboczej'); })();
    },
    admin_poczta_robocza_usun: ({ p_id }, k) => {
      admin(k);
      const r = P.robocze.find((x) => x.id === p_id);
      P.robocze = P.robocze.filter((x) => x.id !== p_id);
      return { usunieta: Boolean(r), klucze: kluczeWolne(r ? r.zalaczniki.map((z) => z.klucz) : []) };
    },
    admin_poczta_wyslij: ({ p }, k) => {
      admin(k);
      const doL = adresy(p.do);
      const dw = adresy(p.dw);
      const udw = adresy(p.udw);
      if (!doL.length) throw blad('Podaj co najmniej jednego adresata w polu „Do”');
      const zly = [...doL, ...dw, ...udw].find((a) => !/^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/.test(a));
      if (zly) throw blad(`Nieprawidłowy adres: ${zly}`);
      const z = zalaczniki(p.zalaczniki);
      if (!String(p.tekst || '').trim() && !String(p.html || '').replace(/<[^>]*>/g, '').trim() && !z.length) throw blad('Wiadomość jest pusta');
      let t = p.watek ? watek(p.watek) : null;
      let tematW = String(p.temat || '').trim() || '(bez tematu)';
      const naglowki = {};
      if (t && ['odpowiedz', 'wszystkim'].includes(p.tryb)) {
        const ids = P.wiadomosci.filter((w) => w.watek === t.id && w.message_id).map((w) => w.message_id);
        const na = P.wiadomosci.find((w) => w.id === p.odpowiedz_na);
        naglowki['In-Reply-To'] = na?.message_id || ids.at(-1);
        naglowki.References = ids.slice(-10).join(' ');
      }
      if (t?.zgloszenie && !tematW.includes(t.zgloszenie)) tematW = `${tematW} [${t.zgloszenie}]`;
      const kiedy = znacznik();
      if (!t) {
        t = { id: crypto.randomUUID(), temat: tematW, od_email: doL[0], od_nazwa: null, zrodlo: 'nowa', folder: 'wyslane', przeczytany: true, gwiazdka: false, liczba: 0, ostatnia: kiedy, utworzono: kiedy, zgloszenie: null, zgloszenie_stan: null };
        P.watki.push(t);
      }
      const q = {
        id: crypto.randomUUID(), rodzaj: ['odpowiedz', 'wszystkim'].includes(p.tryb) ? 'odpowiedz' : 'wiadomosc', do_email: doL[0], do_lista: doL, dw, udw,
        temat: tematW, naglowki, zalaczniki: z, html: p.html, tekst: p.tekst, stan: 'czeka', proby: 0, nastepna_proba: kiedy, utworzono: kiedy,
      };
      P.kolejka.push(q);
      const w = {
        id: crypto.randomUUID(), watek: t.id, kierunek: 'wychodzaca', od_email: P.ustawienia.skrzynka_email, od_nazwa: P.ustawienia.nadawca_nazwa, do_email: doL[0],
        do_lista: doL, dw, udw, temat: tematW, tekst: p.tekst, html: p.html, zalaczniki: z, kolejka: q.id, utworzono: kiedy,
      };
      P.wiadomosci.push(w);
      q.wiadomosc = w.id;
      Object.assign(t, { liczba: t.liczba + 1, ostatnia: kiedy, przeczytany: true, folder: ['spam', 'kosz'].includes(t.folder) ? 'skrzynka' : t.folder });
      if (p.robocza) P.robocze = P.robocze.filter((r) => r.id !== p.robocza);
      oglos(t);
      return { ok: true, watek: t.id, wiadomosc: w.id, kolejka: q.id };
    },
    admin_poczta_adresy: ({ p_szukaj }, k) => {
      admin(k);
      const sz = String(p_szukaj || '').toLowerCase();
      if (!sz) return [];
      const znane = [
        ...P.wiadomosci.filter((w) => w.kierunek === 'przychodzaca').map((w) => ({ email: w.od_email, nazwa: w.od_nazwa })),
        ...P.wiadomosci.flatMap((w) => [...(w.do_lista || []), ...(w.dw || []), ...(w.udw || [])].map((email) => ({ email, nazwa: null }))),
        ...stan.konta.filter((x) => !/@example\.com$/i.test(x.email)).map((x) => ({ email: x.email, nazwa: x.nazwa || null })),
      ];
      const wynik = new Map();
      for (const a of znane) {
        if (a.email && a.email !== P.ustawienia.skrzynka_email && (a.email.startsWith(sz) || (a.nazwa || '').toLowerCase().startsWith(sz)) && !wynik.has(a.email)) wynik.set(a.email, a);
      }
      return [...wynik.values()].slice(0, 8);
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
      if (p_akcja === 'teraz') return null;
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
      // Konta testowe (cała domena example.com) nie liczą się do statystyk.
      const konta = stan.konta.filter((x) => !/@example\.com$/i.test(x.email));
      const projekty = stan.projekty.filter((x) => konta.some((kk) => kk.id === x.owner_id));
      const dni = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10));
      const seria = (lista) => dni.map((d) => ({ dzien: d, ile: lista.filter((x) => String(x).slice(0, 10) === d).length }));
      return {
        dni: 30,
        konta: { razem: konta.length, aktywne_7: konta.length, aktywne_30: konta.length, nowe_7: konta.length },
        projekty: { razem: projekty.length, zmienione_7: projekty.length, wspoldzielone: 0 },
        zaproszenia: { razem: (stan.zaproszenia || []).length, przyjete: 0, czekajace: 0 },
        maile: { wyslane_dzis: P.kolejka.filter((q) => q.stan === 'wyslany').length, wyslane_30: P.kolejka.filter((q) => q.stan === 'wyslany').length, bledy: 0, w_kolejce: P.kolejka.filter((q) => q.stan === 'czeka').length },
        skrzynka: { nieprzeczytane: P.watki.filter((t) => t.folder === 'skrzynka' && !t.przeczytany).length, rozmowy_30: P.watki.length },
        serie: { konta: seria(konta.map(() => teraz())), projekty: seria(projekty.map(() => teraz())), maile: seria(P.kolejka.filter((q) => q.wyslano).map((q) => q.wyslano)) },
      };
    },
  };

  // Przebieg kolejki (Funkcja Edge poczta { kolejka: true }): wszystko, co czeka, „wychodzi”.
  function przebieg() {
    let n = 0;
    for (const q of P.kolejka) {
      if (q.stan !== 'czeka') continue;
      Object.assign(q, { stan: 'wyslany', wyslano: teraz(), proby: q.proby + 1 });
      stan.wyslane.push({ typ: q.rodzaj, email: q.do_email, do: q.do_lista, dw: q.dw, udw: q.udw, temat: q.temat, naglowki: q.naglowki, zalaczniki: q.zalaczniki, html: q.html });
      const w = P.wiadomosci.find((x) => x.id === q.wiadomosc);
      if (w) {
        w.message_id = `<${q.id}@smtp-relay.mailin.fr>`;
        oglos(watek(w.watek));
      }
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
