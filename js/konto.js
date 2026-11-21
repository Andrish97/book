// Konto użytkownika: logowanie, rejestracja z potwierdzeniem e-maila,
// odzyskiwanie hasła i ekran ustawień konta.

import * as chmura from './chmura.js';
import { $, $$, powiadom, potwierdz } from './ui.js';
import { ikona } from './ikony.js';
import { NAZWA } from './marka.js';
import { ustawMotyw, wybranyMotyw } from './motyw.js';
import { podpowiedzNazwy, poprawnaNazwa, ustawNazwe, ZASADY_NAZWY } from './nazwa-uzytkownika.js';
import { t as tt } from './jezyk.js';

// Te same wymagania co w ustawieniach Supabase
// (password_requirements = lower_upper_letters_digits_symbols, min. 8 znaków).
export const ZASADY_HASLA = [
  ['dlugosc', 'min. 8 znaków', (h) => h.length >= 8],
  ['mala', 'mała litera', (h) => /[a-z]/.test(h)],
  ['wielka', 'wielka litera', (h) => /[A-Z]/.test(h)],
  ['cyfra', 'cyfra', (h) => /\d/.test(h)],
  ['znak', 'znak specjalny', (h) => /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/.test(h)],
];
export const brakiHasla = (h) => ZASADY_HASLA.filter(([, , test]) => !test(h)).map(([, opis]) => opis);

const poprawnyEmail = (e) => /^\S+@\S+\.\S+$/.test(e);
const ODSTEP_WYSYLKI = 60; // sekund między kolejnymi wiadomościami
// Ustawienia konta na wąskim ekranie: lista albo jedna sekcja (jak w telefonie), próg jak w css/style/ekrany/konto.css.
const WASKIE_USTAWIENIA = matchMedia('(max-width: 760px)');

// Lista zasad hasła zaznaczana na bieżąco podczas pisania.
function listaZasad(kontener, input) {
  kontener.replaceChildren();
  const pozycje = ZASADY_HASLA.map(([, opis, test]) => {
    const li = document.createElement('li');
    li.innerHTML = `${ikona('ok', { rozmiar: 14 })}<span></span>`;
    li.querySelector('span').textContent = opis;
    kontener.append(li);
    return [li, test];
  });
  const odswiez = () => pozycje.forEach(([li, test]) => li.classList.toggle('spelniona', test(input.value)));
  input.addEventListener('input', odswiez);
  odswiez();
  return odswiez;
}

function przelacznikWidocznosci(przycisk) {
  przycisk.addEventListener('click', () => {
    const input = przycisk.parentElement.querySelector('input');
    const widac = input.type === 'text';
    input.type = widac ? 'password' : 'text';
    przycisk.innerHTML = ikona(widac ? 'oko' : 'okoOff');
    przycisk.setAttribute('aria-label', widac ? tt('konto.pokazHaslo') : tt('konto.ukryjHaslo'));
  });
}

// Odlicza czas do kolejnej wysyłki na przycisku.
function odliczaj(przycisk, etykieta, sekundy = ODSTEP_WYSYLKI) {
  clearInterval(przycisk._odliczanie);
  let zostalo = sekundy;
  const tik = () => {
    if (zostalo <= 0) {
      clearInterval(przycisk._odliczanie);
      przycisk.disabled = false;
      przycisk.textContent = etykieta;
      return;
    }
    przycisk.disabled = true;
    przycisk.textContent = `${etykieta} (${zostalo} s)`;
    zostalo -= 1;
  };
  tik();
  przycisk._odliczanie = setInterval(tik, 1000);
}

const TRYBY = {
  logowanie: {
    opis: tt('konto.zalogujSieAbyWrocic'),
    przycisk: tt('konto.zalogujSie'),
  },
  rejestracja: {
    opis: tt('konto.zalozKontoProjektyBeda'),
    przycisk: tt('konto.zalozKonto'),
  },
  reset: {
    tytul: tt('konto.niePamietaszHasla'),
    opis: tt('konto.podajAdresEMail2'),
    przycisk: tt('konto.wyslijLink'),
  },
  'nowe-haslo': {
    tytul: tt('konto.ustawNoweHaslo'),
    opis: tt('konto.wpiszNoweHasloDo'),
    przycisk: tt('konto.zapiszHaslo'),
  },
};

export class Konto {
  // opcje: stan, poZalogowaniu(u), poWylogowaniu(), doProjektow(),
  //        liczbaProjektow(), usunDaneLokalne(idUzytkownika)
  constructor(opcje) {
    this.o = opcje;
    this.tryb = 'logowanie';
    this.ostatniEmail = '';
  }

  // ====================================================================
  // Ekran logowania
  // ====================================================================

  inicjuj() {
    const f = $('#form-logowania');
    f.addEventListener('submit', (e) => { e.preventDefault(); this.wyslij(); });
    $$('#ekran-logowania [data-tryb]').forEach((b) => b.addEventListener('click', () => this.ustawTryb(b.dataset.tryb)));
    $('#tryb-logowania').addEventListener('change', (e) => this.ustawTryb(e.target.value));
    $$('#ekran-logowania .pokaz-haslo, #ekran-konta .pokaz-haslo').forEach(przelacznikWidocznosci);
    this.odswiezZasady = listaZasad($('#zasady-hasla'), f.elements.haslo);
    this.sprawdzNazweRejestracji = podpowiedzNazwy(f.elements.nazwa, $('#rejestracja-nazwa-podpowiedz'));
    $('#wyslij-ponownie').addEventListener('click', () => this.wyslijPonownie());

    if (!chmura.chmuraSkonfigurowana()) {
      $('#brak-konfiguracji').hidden = false;
      $('#widok-formularz').classList.add('wylaczony');
      f.querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
      $$('#tryb-logowania input, #ekran-logowania .link').forEach((el) => { el.disabled = true; });
    }
    this.ustawTryb('logowanie');
    this.inicjujUstawienia();
  }

  // Odczytuje powrót z linku w e-mailu (#access_token=…&type=… albo #error=…),
  // zanim zrobi to biblioteka Supabase.
  odczytajPowrot() {
    // Link z poczty aplikacji (Funkcja Edge poczta, hak Auth „Send Email”): ?token_hash=…&type=… –
    // aplikacja potwierdza go sama (chmura.potwierdzLink). Adres wraca do zwykłej postaci od razu.
    const q = new URLSearchParams(location.search);
    if (q.get('token_hash')) {
      const wynik = { tokenHash: q.get('token_hash'), typ: q.get('type') || 'email' };
      history.replaceState(null, '', location.pathname + location.hash);
      return wynik;
    }
    const h = location.hash.replace(/^#/, '');
    if (!/(^|&)(access_token|error|error_description)=/.test(h)) return {};
    const p = new URLSearchParams(h);
    const wynik = { typ: p.get('type') || '' };
    if (p.get('error') || p.get('error_description')) {
      wynik.blad = chmura.komunikatBledu({ kod: p.get('error_code'), message: (p.get('error_description') || '').replace(/\+/g, ' ') });
      history.replaceState(null, '', location.pathname + location.search);
    }
    return wynik;
  }

  komunikat(tekst, sukces = false) {
    const k = $('#komunikat-logowania');
    k.textContent = tekst;
    k.classList.toggle('sukces', sukces);
  }

  ustawTryb(tryb) {
    this.tryb = tryb;
    const t = TRYBY[tryb];
    const f = $('#form-logowania');
    const rej = tryb === 'rejestracja';
    const nowe = tryb === 'nowe-haslo';
    $('#widok-formularz').hidden = false;
    $('#widok-wyslano').hidden = true;
    $('#tryb-logowania').hidden = !(tryb === 'logowanie' || rej);
    $$('#tryb-logowania input').forEach((r) => { r.checked = r.value === tryb; });
    $('#tytul-logowania').hidden = !t.tytul;
    $('#tytul-logowania').textContent = t.tytul || '';
    $('#opis-logowania').textContent = t.opis;
    $('#przycisk-logowania').textContent = t.przycisk;
    $('#pole-nazwa').hidden = !rej;
    $('#pole-email').hidden = nowe;
    // Logowanie przyjmuje też nazwę użytkownika (#192): pole tekstowe z podpowiedzią menedżera haseł „username”.
    const login = tryb === 'logowanie';
    $('#pole-email > span').textContent = login ? tt('konto.eMailAlboNazwa') : tt('konto.eMail');
    f.elements.email.type = login ? 'text' : 'email';
    f.elements.email.autocomplete = login ? 'username' : 'email';
    f.elements.email.inputMode = login ? 'text' : 'email';
    f.elements.email.autocapitalize = 'none';
    f.elements.email.spellcheck = false;
    $('#pole-haslo').hidden = tryb === 'reset';
    $('#pole-haslo > span:first-child').textContent = nowe ? tt('konto.noweHaslo') : tt('konto.haslo');
    $('#pole-haslo2').hidden = !(rej || nowe);
    $('#zasady-hasla').hidden = !(rej || nowe);
    f.elements.haslo.autocomplete = rej || nowe ? 'new-password' : 'current-password';
    $('#link-reset').hidden = tryb !== 'logowanie';
    $('#link-logowanie').hidden = tryb !== 'reset';
    f.elements.haslo.value = '';
    f.elements.haslo2.value = '';
    this.odswiezZasady?.();
    this.komunikat('');
  }

  pokazWyslano(rodzaj, email) {
    this.ostatniEmail = email;
    this.rodzajWyslanego = rodzaj;
    $('#widok-formularz').hidden = true;
    $('#widok-wyslano').hidden = false;
    $('#wyslano-tytul').textContent = tt('konto.sprawdzSkrzynke');
    const opis = $('#wyslano-opis');
    opis.replaceChildren();
    const b = document.createElement('strong');
    b.textContent = email;
    if (rodzaj === 'rejestracja') {
      opis.append('Wysłaliśmy link potwierdzający na ', b, '. Kliknij go, aby uruchomić konto – potem zalogujesz się tutaj.');
    } else {
      opis.append('Jeśli konto ', b, ' istnieje, link do ustawienia nowego hasła jest już w drodze.');
    }
    $('#komunikat-wyslano').textContent = '';
    odliczaj($('#wyslij-ponownie'), 'Wyślij ponownie');
  }

  async wyslijPonownie() {
    const k = $('#komunikat-wyslano');
    k.classList.remove('sukces');
    try {
      if (this.rodzajWyslanego === 'rejestracja') await chmura.wyslijPotwierdzeniePonownie(this.ostatniEmail);
      else await chmura.wyslijResetHasla(this.ostatniEmail);
      k.textContent = tt('konto.wyslanoPonownieZajrzyjTez');
      k.classList.add('sukces');
      odliczaj($('#wyslij-ponownie'), 'Wyślij ponownie');
    } catch (e) {
      k.textContent = chmura.komunikatBledu(e);
    }
  }

  async wyslij() {
    const f = $('#form-logowania');
    const email = f.elements.email.value.trim();
    const haslo = f.elements.haslo.value;
    const { tryb } = this;
    // Logowanie: adres e-mail albo nazwa użytkownika (#192).
    if (tryb === 'logowanie' && !email) { this.komunikat(tt('konto.podajAdresEMail')); return; }
    if (tryb === 'logowanie' && !email.includes('@') && !poprawnaNazwa(email)) { this.komunikat(tt('konto.podajPoprawnyAdresE2')); return; }
    if (tryb !== 'nowe-haslo' && tryb !== 'logowanie' && !poprawnyEmail(email)) { this.komunikat(tt('konto.podajPoprawnyAdresE')); return; }
    if (tryb === 'logowanie' && email.includes('@') && !poprawnyEmail(email)) { this.komunikat(tt('konto.podajPoprawnyAdresE')); return; }
    if (tryb === 'logowanie' && !haslo) { this.komunikat(tt('konto.podajHaslo')); return; }
    if (tryb === 'rejestracja' && !poprawnaNazwa(f.elements.nazwa.value.trim())) {
      this.komunikat(tt('konto.nazwaUzytkownika', { ZASADY_NAZWY }));
      f.elements.nazwa.focus();
      return;
    }
    if (tryb === 'rejestracja' || tryb === 'nowe-haslo') {
      const braki = brakiHasla(haslo);
      if (braki.length) { this.komunikat(tt('konto.wHasleBrakuje', { join: braki.join(', ') })); return; }
      if (haslo !== f.elements.haslo2.value) { this.komunikat(tt('konto.haslaNieSaTakie')); return; }
    }
    // Wolna nazwa – sprawdzana na końcu (zapytanie do bazy), żeby błędy formularza były od razu.
    if (tryb === 'rejestracja' && !await this.sprawdzNazweRejestracji()) {
      this.komunikat(tt('konto.taNazwaUzytkownikaJest'));
      f.elements.nazwa.focus();
      return;
    }
    const przycisk = $('#przycisk-logowania');
    przycisk.disabled = true;
    this.komunikat('');
    try {
      if (tryb === 'logowanie') {
        const u = await chmura.zalogujHaslem(email, haslo);
        f.elements.haslo.value = '';
        await this.o.poZalogowaniu(u);
      } else if (tryb === 'rejestracja') {
        const wynik = await chmura.zarejestruj(email, haslo, f.elements.nazwa.value.trim());
        if (wynik === 'zalogowano') await this.o.poZalogowaniu(await chmura.biezacyUzytkownik());
        else this.pokazWyslano('rejestracja', email);
      } else if (tryb === 'reset') {
        await chmura.wyslijResetHasla(email);
        this.pokazWyslano('reset', email);
      } else if (tryb === 'nowe-haslo') {
        const u = await chmura.ustawNoweHaslo(haslo);
        powiadom(tt('konto.hasloZostaloZmienione'));
        this.ustawTryb('logowanie');
        await this.o.poZalogowaniu(u);
      }
    } catch (e) {
      if (e.kod === 'email_not_confirmed') {
        // Konto istnieje, ale adres nie jest potwierdzony – pokaż ekran z ponowną wysyłką.
        this.pokazWyslano('rejestracja', email);
        $('#komunikat-wyslano').textContent = chmura.komunikatBledu(e);
        $('#wyslij-ponownie').disabled = false;
        clearInterval($('#wyslij-ponownie')._odliczanie);
        $('#wyslij-ponownie').textContent = tt('konto.wyslijPonownie');
      } else {
        this.komunikat(chmura.komunikatBledu(e));
      }
    } finally {
      przycisk.disabled = false;
    }
  }

  // ====================================================================
  // Ustawienia konta
  // ====================================================================

  // Formularze ustawień są zwinięte; rozwijają się w swoim wierszu.
  rozwin(id) {
    const f = document.getElementById(id);
    f.hidden = false;
    $(`#ekran-konta [data-rozwin="${id}"]`).hidden = true;
    f.querySelector('input')?.focus();
  }

  zwin(id) {
    const f = document.getElementById(id);
    f.hidden = true;
    f.reset();
    f.querySelector('.komunikat').textContent = '';
    $(`#ekran-konta [data-rozwin="${id}"]`).hidden = false;
    if (id === 'form-haslo') this.odswiezZasadyKonta?.();
  }

  inicjujUstawienia() {
    $$('#ekran-konta [data-rozwin]').forEach((b) => b.addEventListener('click', () => this.rozwin(b.dataset.rozwin)));
    $$('#ekran-konta [data-zwin]').forEach((b) => b.addEventListener('click', () => this.zwin(b.dataset.zwin)));
    // Lista jak w ustawieniach telefonu (#109): wiersz otwiera swoją sekcję; na wąskim ekranie sekcja
    // zastępuje listę i ma przycisk powrotu, na szerokim lista zostaje po lewej.
    $$('#ekran-konta .konto-lista a[data-sekcja]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      this.pokazSekcje(a.dataset.sekcja, { cel: a.dataset.cel, historia: true });
    }));
    $$('#ekran-konta .do-listy-ustawien').forEach((b) => b.addEventListener('click', () => {
      if (history.state?.sekcjaKonta) history.back(); else this.pokazSekcje(null, { historia: true });
    }));
    WASKIE_USTAWIENIA.addEventListener('change', () => { if (document.body.dataset.ekran === 'konto') this.pokazSekcje(this.sekcja); });
    // Podsumowania w wierszach listy: wartości wypełniane z opóźnieniem (klucze AI, miejsce) śledzone na bieżąco.
    const sledz = (zrodlo, cel) => new MutationObserver(() => this.podsumuj(cel)).observe($(zrodlo), { childList: true, characterData: true, subtree: true });
    sledz('#ust-ai-opis', 'ai');
    sledz('#miejsce-konto', 'miejsce');
    // Powiadomienia push (#113): przełącznik urządzenia i rodzaje; podsumowanie „Włączone / Wyłączone” w wierszu listy.
    document.addEventListener('powiadomienia-stan', () => this.podsumuj('powiadomienia'));
    import('./powiadomienia.js').then((m) => { this.powiadomienia = m; m.inicjujPowiadomienia(); }).catch(() => {});
    const zaznaczMotyw = () => $$('#wybor-motywu input').forEach((r) => { r.checked = r.value === wybranyMotyw(); });
    $('#wybor-motywu').addEventListener('change', (e) => ustawMotyw(e.target.value));
    document.addEventListener('motyw', () => { zaznaczMotyw(); this.podsumuj('motyw'); });
    zaznaczMotyw();

    const formularz = (id, fn) => $(id).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const k = f.querySelector('.komunikat');
      const przycisk = f.querySelector('button[type="submit"]');
      k.textContent = '';
      k.classList.remove('sukces');
      przycisk.disabled = true;
      try {
        const ok = await fn(f, (t) => { k.textContent = t; });
        if (ok) { k.textContent = ok; k.classList.add('sukces'); }
      } catch (err) {
        k.textContent = chmura.komunikatBledu(err);
      } finally {
        przycisk.disabled = false;
      }
    });

    podpowiedzNazwy($('#konto-nazwa'), $('#konto-nazwa-podpowiedz'));
    formularz('#form-nazwa', async (f, blad) => {
      const nazwa = f.elements.nazwa.value.trim();
      if (!poprawnaNazwa(nazwa)) { blad(`Nazwa użytkownika: ${ZASADY_NAZWY}`); return null; }
      this.zaktualizuj(await ustawNazwe(nazwa));
      powiadom(tt('konto.nazwaUzytkownikaZapisana'));
      return null;
    });

    formularz('#form-email', async (f, blad) => {
      const email = f.elements.email.value.trim();
      if (!poprawnyEmail(email)) { blad('Podaj poprawny adres e-mail.'); return null; }
      if (email !== f.elements.email2.value.trim()) { blad('Adresy e-mail nie są takie same.'); return null; }
      if (email === this.o.stan.uzytkownik.email) { blad('To jest Twój obecny adres.'); return null; }
      this.zaktualizuj(await chmura.zmienEmail(email));
      this.zwin('form-email');
      powiadom(tt('konto.linkPotwierdzajacyWyslanyNa', { email }));
      return null;
    });

    this.odswiezZasadyKonta = listaZasad($('#zasady-hasla-konto'), $('#form-haslo').elements.nowe);
    formularz('#form-haslo', async (f, blad) => {
      const nowe = f.elements.nowe.value;
      const braki = brakiHasla(nowe);
      if (!f.elements.obecne.value) { blad('Wpisz obecne hasło.'); return null; }
      if (braki.length) { blad(`W nowym haśle brakuje: ${braki.join(', ')}.`); return null; }
      if (nowe !== f.elements.nowe2.value) { blad('Nowe hasła nie są takie same.'); return null; }
      if (nowe === f.elements.obecne.value) { blad('Nowe hasło musi różnić się od obecnego.'); return null; }
      try {
        await chmura.zalogujHaslem(this.o.stan.uzytkownik.email, f.elements.obecne.value);
      } catch (e) {
        if (e.kod === 'invalid_credentials') { blad('Obecne hasło jest nieprawidłowe.'); return null; }
        throw e;
      }
      await chmura.ustawNoweHaslo(nowe);
      this.zwin('form-haslo');
      powiadom(tt('konto.hasloZostaloZmienione'));
      return null;
    });

    $('#konto-reset-hasla').addEventListener('click', async (e) => {
      const k = $('#form-haslo .komunikat');
      k.classList.remove('sukces');
      try {
        await chmura.wyslijResetHasla(this.o.stan.uzytkownik.email);
        k.textContent = tt('konto.linkDoUstawieniaHasla', { email: this.o.stan.uzytkownik.email });
        k.classList.add('sukces');
        odliczaj(e.currentTarget, 'Nie pamiętasz hasła?');
      } catch (err) {
        k.textContent = chmura.komunikatBledu(err);
      }
    });

    // Oczekującej zmiany adresu nie da się anulować bez uprawnień administratora (Supabase Auth
    // pomija zmianę na obecny adres, a innej drogi dla zwykłego konta nie ma). Nowy adres zastępuje
    // oczekujący; bez kliknięcia linku zmiana nigdy nie nastąpi.
    $('#email-inny').addEventListener('click', () => {
      this.rozwin('form-email');
      $('#form-email input[name=email]').focus();
    });

    $('#email-ponownie').addEventListener('click', async (e) => {
      const nowy = this.o.stan.uzytkownik.new_email;
      try {
        this.zaktualizuj(await chmura.zmienEmail(nowy));
        odliczaj(e.currentTarget, 'Wyślij ponownie');
      } catch (err) {
        powiadom(chmura.komunikatBledu(err), true);
      }
    });

    $('#wyloguj-wszedzie').addEventListener('click', async () => {
      if (!await potwierdz(tt('konto.wylogowacZeWszystkichUrzadzen'), tt('konto.naKazdymUrzadzeniuTakze'), tt('konto.wylogujWszedzie'))) return;
      await this.o.wyloguj(true);
    });

    formularz('#form-usun', async (f, blad) => {
      const { stan } = this.o;
      if (!f.elements.haslo.value) { blad('Wpisz hasło, aby potwierdzić.'); return null; }
      try {
        await chmura.zalogujHaslem(stan.uzytkownik.email, f.elements.haslo.value);
      } catch (e) {
        if (e.kod === 'invalid_credentials') { blad('Nieprawidłowe hasło.'); return null; }
        throw e;
      }
      const n = await this.o.liczbaProjektow();
      const ok = await potwierdz(
        tt('konto.usunacKontoNaZawsze'),
        tt('konto.kontoIZostanaTrwale', { email: stan.uzytkownik.email, x: n === 0 ? tt('konto.wszystkieDane') : tt('konto.wszystkieProjekty', { n }) }),
        tt('konto.usunKontoIDane'),
        true,
      );
      if (!ok) return null;
      const id = stan.uzytkownik.id;
      await chmura.usunKonto();
      await this.o.usunDaneLokalne(id);
      f.reset();
      await this.o.poUsunieciuKonta();
      return null;
    });
  }

  // Po zmianie danych konta: nowy obiekt użytkownika do stanu i na ekran.
  zaktualizuj(uzytkownik) {
    if (uzytkownik) this.o.stan.uzytkownik = uzytkownik;
    this.o.odswiezNaglowek();
    this.wypelnijUstawienia();
  }

  wypelnijUstawienia() {
    const u = this.o.stan.uzytkownik;
    if (!u) return;
    $('#form-nazwa').elements.nazwa.value = chmura.nazwaUzytkownika(u);
    $('#konto-email-obecny').textContent = u.email;
    const oczekuje = Boolean(u.new_email);
    $('#email-oczekuje').hidden = !oczekuje;
    if (oczekuje) $('#email-oczekuje-adres').textContent = u.new_email;
    $('#konto-od').textContent = u.created_at
      ? new Date(u.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    this.o.liczbaProjektow().then((n) => { $('#konto-projekty').textContent = String(n); }).catch(() => {});
    for (const k of ['nazwa', 'email', 'motyw', 'ai', 'miejsce']) this.podsumuj(k);
  }

  // Krótka wartość w wierszu listy ustawień („E-mail · adres ›”).
  podsumuj(klucz) {
    const el = $(`#ekran-konta .konto-lista [data-podsumowanie="${klucz}"]`);
    if (!el) return;
    const u = this.o.stan.uzytkownik;
    const tekst = {
      nazwa: () => (u ? chmura.nazwaUzytkownika(u) : ''),
      email: () => u?.email || '',
      motyw: () => ({ system: 'Jak w systemie', jasny: 'Jasny', ciemny: 'Ciemny' })[wybranyMotyw()] || '',
      ai: () => {
        const t = $('#ust-ai-opis').textContent.trim();
        const ile = t.match(/Aktywne klucze: (\d+)/);
        if (ile) { const n = Number(ile[1]); return `${n} ${n === 1 ? 'klucz' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'klucze' : 'kluczy')}`; }
        return /Nie masz/.test(t) ? 'Brak kluczy' : '';
      },
      miejsce: () => { const t = $('#miejsce-konto').textContent.trim(); return /Sprawdzam/.test(t) ? '' : t; },
      powiadomienia: () => this.powiadomienia?.podsumowaniePowiadomien() || '',
    }[klucz]();
    el.textContent = tekst;
    el.hidden = !tekst;
  }

  // Pokazuje jedną sekcję ustawień. Bez sekcji: na wąskim ekranie sama lista, na szerokim – Profil.
  pokazSekcje(sekcja, { cel, historia = false } = {}) {
    const znana = sekcja && document.getElementById(`ust-${sekcja}`) ? sekcja : null;
    this.sekcja = znana;
    const wybrana = znana || (WASKIE_USTAWIENIA.matches ? null : 'profil');
    $('#ekran-konta').dataset.sekcja = wybrana || '';
    $$('#ekran-konta .grupa-ustawien').forEach((g) => { g.classList.toggle('wybrana', g.id === `ust-${wybrana}`); });
    // Sekcja „Sztuczna inteligencja” (#247): panel kluczy wprost w ustawieniach, wczytany przy wejściu.
    if (wybrana === 'ai' && this.o.stan.uzytkownik) import('./app/dostep-ai.js').then((m) => m.otworzDostepAi()).catch(() => {});
    $$('#ekran-konta .konto-lista a[data-sekcja]').forEach((a) => {
      const tak = a.dataset.sekcja === wybrana;
      a.classList.toggle('aktywna', tak);
      if (tak) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    if (historia) {
      const adres = `#/konto${znana ? `/${znana}` : ''}`;
      if (location.hash !== adres) history.pushState({ sekcjaKonta: Boolean(znana) }, '', adres);
    }
    $('.konto-tresc').scrollTop = 0;
    if (cel === 'haslo') $('#form-haslo').closest('.wiersz-ustawien').scrollIntoView({ block: 'nearest' });
  }

  pokazUstawienia(sekcja = null) {
    for (const id of ['form-email', 'form-haslo', 'form-usun']) this.zwin(id);
    $('#form-nazwa .komunikat').textContent = '';
    $('.konto-tresc').scrollTop = 0;
    this.wypelnijUstawienia();
    import('./miejsce-ustawienia.js').then((m) => m.pokazMiejsce()).catch(() => {}); // sekcja „Miejsce” (#90)
    import('./app/dostep-ai.js').then((m) => m.podsumowanieKluczy()).catch(() => {}); // podsumowanie na liście ustawień (#94)
    import('./powiadomienia.js').then((m) => m.pokazPowiadomienia()).catch(() => {}); // sekcja „Powiadomienia” (#113)
    import('./marka-okno.js').then((m) => m.odswiezMarkeWUstawieniach()).catch(() => {}); // sekcja „Zestaw marki” (#131D)
    this.pokazSekcje(sekcja);
    document.title = tt('konto.ustawieniaKonta', { NAZWA });
  }
}
