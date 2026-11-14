// Nazwa użytkownika (decyzja #100, migracja 20261114233000_nazwy_uzytkownikow.sql): unikalna nazwa konta,
// po której inni zapraszają do projektu na równi z adresem e-mail. Ustawiana przy rejestracji, przy pierwszym
// logowaniu konta bez nazwy (okno „Wybierz nazwę użytkownika” – wymagane, z propozycją wolnej nazwy) i
// w ustawieniach konta. W metadanych konta (user_metadata.nazwa) zostaje ta sama nazwa – do wyświetlania.

import { supabase } from './chmura.js';
import { $ } from './ui.js';

export const ZASADY_NAZWY = '3–30 znaków: litery, cyfry, _ . -; na początku litera albo cyfra.';
const WZOR = /^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.-]{2,29}$/;
export const poprawnaNazwa = (n) => WZOR.test(String(n || '')) && !/[_.-]{2}/.test(String(n || ''));

const rpc = async (nazwa, parametry = {}) => {
  const { data, error } = await (await supabase()).rpc(nazwa, parametry);
  if (error) throw error;
  return data;
};

export const nazwaWolna = (nazwa) => rpc('nazwa_wolna', { p_nazwa: nazwa });
export const mojaNazwa = () => rpc('moja_nazwa_uzytkownika');
export const szukajNazw = async (tekst) => {
  const t = String(tekst || '').trim().replace(/^@/, '');
  if (t.length < 2 || t.includes('@')) return [];
  const w = await rpc('szukaj_nazw_uzytkownikow', { p_tekst: t });
  return Array.isArray(w) ? w : [];
};

// Zapisuje nazwę w profilu i w metadanych konta. Zwraca zaktualizowanego użytkownika.
export async function ustawNazwe(nazwa) {
  const n = await rpc('ustaw_nazwe_uzytkownika', { p_nazwa: String(nazwa || '').trim() });
  const sb = await supabase();
  const { data, error } = await sb.auth.updateUser({ data: { nazwa: n, nazwa_uzytkownika: n } });
  if (error) throw error;
  return data.user;
}

// Propozycja nazwy z tekstu (imię, początek adresu e-mail): tylko dozwolone znaki, co najmniej 3.
export function propozycjaZ(tekst) {
  let n = String(tekst || '').split('@')[0].normalize('NFC')
    .replace(/\s+/g, '.').replace(/[^A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.-]/g, '')
    .replace(/[_.-]{2,}/g, '.').replace(/^[_.-]+/, '').slice(0, 30).replace(/[_.-]+$/, '');
  if (n.length < 3) n = `${n || 'konto'}${Math.floor(100 + Math.random() * 900)}`.slice(0, 30);
  return n;
}

// Podpowiedź pod polem nazwy: na bieżąco (z opóźnieniem) – „wolna” albo „zajęta – może X?” z przyciskiem.
// pole – <input>, el – element podpowiedzi. Zwraca funkcję sprawdzającą od razu (Promise<boolean> – czy wolna).
export function podpowiedzNazwy(pole, el) {
  let licznik = 0;
  let czasomierz = null;
  const pokaz = (tekst, klasa = '') => { el.textContent = tekst; el.className = `podpowiedz-nazwy ${klasa}`.trim(); };
  const sprawdz = async () => {
    const nr = (licznik += 1);
    const n = pole.value.trim();
    if (!n) { pokaz(ZASADY_NAZWY); return false; }
    if (!poprawnaNazwa(n)) { pokaz(`Nazwa: ${ZASADY_NAZWY}`, 'blad'); return false; }
    let w;
    try { w = await nazwaWolna(n); } catch { if (nr === licznik) pokaz(ZASADY_NAZWY); return true; }
    if (nr !== licznik) return Boolean(w?.wolna);
    if (w?.wolna) { pokaz(`„${n}” jest wolna.`, 'ok'); return true; }
    el.replaceChildren(`„${n}” jest już zajęta. `);
    el.className = 'podpowiedz-nazwy blad';
    if (w?.propozycja) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'link';
      b.textContent = `Weź „${w.propozycja}”`;
      b.addEventListener('click', () => { pole.value = w.propozycja; sprawdz(); pole.focus(); });
      el.append(b);
    }
    return false;
  };
  pole.addEventListener('input', () => { clearTimeout(czasomierz); czasomierz = setTimeout(sprawdz, 350); });
  pokaz(ZASADY_NAZWY);
  return sprawdz;
}

// Po zalogowaniu: konto bez nazwy dostaje ją od razu z rejestracji (metadane), a jeśli się nie da –
// okno „Wybierz nazwę użytkownika” (wymagane; zamyka się dopiero po zapisaniu). Zwraca użytkownika.
let trwa = null;
export function upewnijSieONazwie(uzytkownik, { naZmiane = () => {} } = {}) {
  if (!uzytkownik) return Promise.resolve(uzytkownik);
  trwa ||= (async () => {
    let moja = null;
    try { moja = await mojaNazwa(); } catch { return uzytkownik; } // bez wdrożonej migracji albo bez sieci – później
    if (moja) return uzytkownik;
    const zRejestracji = uzytkownik.user_metadata?.nazwa_uzytkownika;
    if (poprawnaNazwa(zRejestracji)) {
      try { const u = await ustawNazwe(zRejestracji); naZmiane(u); return u; } catch { /* zajęta – pytamy */ }
    }
    const u = await oknoNazwy(uzytkownik);
    naZmiane(u);
    return u;
  })().finally(() => { trwa = null; });
  return trwa;
}

async function oknoNazwy(uzytkownik) {
  const dlg = $('#dlg-nazwa-uzytkownika');
  const pole = $('#nazwa-uzytkownika-pole');
  const komunikat = $('#nazwa-uzytkownika-komunikat');
  let propozycja = propozycjaZ(uzytkownik.user_metadata?.nazwa || uzytkownik.email);
  try { const w = await nazwaWolna(propozycja); if (w && !w.wolna && w.propozycja) propozycja = w.propozycja; } catch { /* zostaje */ }
  pole.value = propozycja;
  komunikat.textContent = '';
  const sprawdz = podpowiedzNazwy(pole, $('#nazwa-uzytkownika-podpowiedz'));
  sprawdz();
  // Bez nazwy nie da się zamknąć: Esc i uchwyt zasłonki nic nie robią.
  const zostan = (e) => e.preventDefault();
  dlg.addEventListener('cancel', zostan);
  if (!dlg.open) dlg.showModal();
  return new Promise((ok) => {
    const form = $('#form-nazwa-uzytkownika');
    const zapisz = async (e) => {
      e.preventDefault();
      const przycisk = form.querySelector('button[type="submit"]');
      komunikat.textContent = '';
      if (!poprawnaNazwa(pole.value.trim())) { komunikat.textContent = `Nazwa: ${ZASADY_NAZWY}`; return; }
      przycisk.disabled = true;
      try {
        const u = await ustawNazwe(pole.value);
        form.removeEventListener('submit', zapisz);
        dlg.removeEventListener('cancel', zostan);
        dlg.close();
        ok(u);
      } catch (err) {
        komunikat.textContent = err?.message || 'Nie udało się zapisać nazwy.';
      } finally {
        przycisk.disabled = false;
      }
    };
    form.addEventListener('submit', zapisz);
  });
}
