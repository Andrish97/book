// Logowanie: ekran konta, nagłówek z nazwą użytkownika, wejście po zalogowaniu i wylogowanie.

import { usunLokalneWlasciciela } from '../lokalny.js';
import { usunHistorieWlasciciela } from '../historia-zapis.js';
import * as chmura from '../chmura.js';
import { powiadom, $, zamknijMenu } from '../ui.js';
import { Konto } from '../konto.js';
import { wybranyMotyw, ustawMotyw } from '../motyw.js';
import { stan, trasa, pokazEkran } from './kontekst.js';
import { wpisyProjektow, pokazProjekty, plikiDoOtwarcia, otworzOczekujacePliki } from './projekty.js';
import { instrukcja } from './instrukcja-leniwa.js';
import { edytorGotowy } from './doczytaj.js';
import { przejdzDoTrasy } from './trasy.js';
import { wlaczNaZywo, wylaczNaZywo } from './na-zywo.js';

// ======================================================================
// Logowanie
// ======================================================================

export const konto = new Konto({
  stan,
  poZalogowaniu: (u) => poZalogowaniu(u),
  wyloguj: (wszedzie) => wyloguj(wszedzie),
  odswiezNaglowek: () => odswiezNaglowek(),
  liczbaProjektow: async () => (await wpisyProjektow()).length,
  usunDaneLokalne: async (id) => { await usunLokalneWlasciciela(id); await usunHistorieWlasciciela(id); },
  poUsunieciuKonta: async () => {
    wylaczNaZywo();
    stan.uzytkownik = null;
    stan.projekt = null;
    trasa.ustaw('projekty', { zastap: true });
    konto.ustawTryb('logowanie');
    pokazEkran('logowanie');
    powiadom('Konto i wszystkie dane zostały usunięte.');
  },
});

export function odswiezNaglowek() {
  const u = stan.uzytkownik;
  const nazwa = u ? chmura.nazwaUzytkownika(u) : '';
  $('#awatar').textContent = (nazwa || '?')[0].toUpperCase();
  $('#awatar').title = u ? `Konto: ${nazwa}` : 'Nie zalogowano';
  $('#nazwa-uzytkownika').textContent = u ? nazwa : 'Nie zalogowano';
  $('#email-uzytkownika').textContent = u ? u.email : '';
  $('#pozycja-konto').hidden = !u;
  // Panel administratora – tylko dla kont z tabeli administratorzy (pyta baza, decyzja #95).
  $('#pozycja-admin').hidden = true;
  if (u) import('./admin.js').then((m) => m.czyAdministrator()).then((tak) => { if (stan.uzytkownik === u) $('#pozycja-admin').hidden = !tak; }).catch(() => {});
  $('[data-akcja="wyloguj"]').lastChild.textContent = u ? 'Wyloguj' : 'Przejdź do logowania';
}

export async function poZalogowaniu(uzytkownik) {
  stan.uzytkownik = uzytkownik;
  // Pliki ze starego magazynu przechodzą do R2 (raz) – pobieranie plików czeka na to samo.
  import('../przeniesienie-plikow.js').then((m) => m.przeniesPliki(uzytkownik)).catch(() => { /* zostaną w starym magazynie, spróbujemy przy następnym zalogowaniu */ });
  wlaczNaZywo(uzytkownik); // powiadomienia o zmianach z innych urządzeń; nie wstrzymuje wejścia
  const motywKonta = uzytkownik?.user_metadata?.motyw;
  if (motywKonta && motywKonta !== wybranyMotyw()) ustawMotyw(motywKonta);
  odswiezNaglowek();
  await przejdzDoTrasy();
  if (document.body.dataset.ekran === 'start' || document.body.dataset.ekran === 'logowanie') await pokazProjekty();
  if (plikiDoOtwarcia.length) await otworzOczekujacePliki();
  else instrukcja.otworzJesliNowa(uzytkownik?.id || 'lokalny');
}

export async function wyloguj(wszedzie = false) {
  zamknijMenu();
  if (stan.projekt) await edytorGotowy()?.zapiszTeraz(); // otwarty projekt = edytor już wczytany
  stan.projekt = null;
  if (stan.uzytkownik) {
    try { await chmura.wyloguj(wszedzie); } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
  }
  stan.uzytkownik = null;
  wylaczNaZywo();
  konto.ustawTryb('logowanie');
  trasa.ustaw('projekty', { zastap: true });
  pokazEkran('logowanie');
}
