// Konto użytkownika: logowanie, rejestracja z potwierdzeniem e-maila,
// odzyskiwanie hasła i ekran ustawień konta.

import * as chmura from './chmura.js';
import { $, $$, powiadom, potwierdz } from './ui.js';
import { ikona } from './ikony.js';
import { NAZWA } from './marka.js';

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
    przycisk.setAttribute('aria-label', widac ? 'Pokaż hasło' : 'Ukryj hasło');
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
    opis: 'Zaloguj się, aby wrócić do swoich projektów.',
    przycisk: 'Zaloguj się',
  },
  rejestracja: {
    opis: 'Załóż konto – projekty będą zapisane i dostępne na każdym urządzeniu.',
    przycisk: 'Załóż konto',
  },
  reset: {
    tytul: 'Nie pamiętasz hasła?',
    opis: 'Podaj adres e-mail konta. Wyślemy link, po którym ustawisz nowe hasło.',
    przycisk: 'Wyślij link',
  },
  'nowe-haslo': {
    tytul: 'Ustaw nowe hasło',
    opis: 'Wpisz nowe hasło do swojego konta.',
    przycisk: 'Zapisz hasło',
  },
};

export class Konto {
  // opcje: stan, poZalogowaniu(u), trybLokalny(), poWylogowaniu(), doProjektow(),
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
    $('#wyslij-ponownie').addEventListener('click', () => this.wyslijPonownie());
    $('#tryb-lokalny').addEventListener('click', () => this.o.trybLokalny());

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
    $('#pole-haslo').hidden = tryb === 'reset';
    $('#pole-haslo > span:first-child').textContent = nowe ? 'Nowe hasło' : 'Hasło';
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
    $('#wyslano-tytul').textContent = 'Sprawdź skrzynkę';
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
      k.textContent = 'Wysłano ponownie. Zajrzyj też do folderu ze spamem.';
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
    if (tryb !== 'nowe-haslo' && !poprawnyEmail(email)) { this.komunikat('Podaj poprawny adres e-mail.'); return; }
    if (tryb === 'logowanie' && !haslo) { this.komunikat('Podaj hasło.'); return; }
    if (tryb === 'rejestracja' || tryb === 'nowe-haslo') {
      const braki = brakiHasla(haslo);
      if (braki.length) { this.komunikat(`W haśle brakuje: ${braki.join(', ')}.`); return; }
      if (haslo !== f.elements.haslo2.value) { this.komunikat('Hasła nie są takie same.'); return; }
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
        powiadom('Hasło zostało zmienione.');
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
        $('#wyslij-ponownie').textContent = 'Wyślij ponownie';
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

  inicjujUstawienia() {
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

    formularz('#form-nazwa', async (f, blad) => {
      const nazwa = f.elements.nazwa.value.trim();
      if (nazwa.length < 2 || nazwa.length > 40) { blad('Nazwa powinna mieć od 2 do 40 znaków.'); return null; }
      this.zaktualizuj(await chmura.zmienNazwe(nazwa));
      return 'Nazwa zapisana.';
    });

    formularz('#form-email', async (f, blad) => {
      const email = f.elements.email.value.trim();
      if (!poprawnyEmail(email)) { blad('Podaj poprawny adres e-mail.'); return null; }
      if (email !== f.elements.email2.value.trim()) { blad('Adresy e-mail nie są takie same.'); return null; }
      if (email === this.o.stan.uzytkownik.email) { blad('To jest Twój obecny adres.'); return null; }
      this.zaktualizuj(await chmura.zmienEmail(email));
      f.reset();
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
      f.reset();
      this.odswiezZasadyKonta();
      return 'Hasło zmienione.';
    });

    $('#konto-reset-hasla').addEventListener('click', async (e) => {
      const k = $('#form-haslo .komunikat');
      k.classList.remove('sukces');
      try {
        await chmura.wyslijResetHasla(this.o.stan.uzytkownik.email);
        k.textContent = `Link do ustawienia hasła wysłany na ${this.o.stan.uzytkownik.email}.`;
        k.classList.add('sukces');
        odliczaj(e.currentTarget, 'Nie pamiętasz hasła?');
      } catch (err) {
        k.textContent = chmura.komunikatBledu(err);
      }
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
      if (!await potwierdz('Wylogować ze wszystkich urządzeń?', 'Na każdym urządzeniu, także na tym, trzeba będzie zalogować się ponownie.', 'Wyloguj wszędzie')) return;
      await this.o.wyloguj(true);
    });
    $('#wyloguj-tutaj').addEventListener('click', () => this.o.wyloguj(false));

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
        'Usunąć konto na zawsze?',
        `Konto ${stan.uzytkownik.email} i ${n === 0 ? 'wszystkie dane' : `wszystkie projekty (${n})`} zostaną trwale usunięte. Tego nie da się cofnąć.`,
        'Usuń konto i dane',
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
  }

  pokazUstawienia() {
    $$('#ekran-konta .komunikat').forEach((k) => { k.textContent = ''; });
    $$('#ekran-konta form').forEach((f) => f.reset());
    this.odswiezZasadyKonta?.();
    this.wypelnijUstawienia();
    document.title = `Ustawienia konta – ${NAZWA}`;
  }
}
