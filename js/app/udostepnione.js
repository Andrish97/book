// Podgląd udostępniony linkiem (#/u/<konto>/<projekt>/<kod>) – bez logowania i bez edytora.
// Oglądający dostaje gotowe obrazy stron, więc ten moduł nie potrzebuje biblioteki płótna ani składania
// stron; własny podgląd (Podglad) tworzy dopiero przy pierwszym użyciu.

import * as chmura from '../chmura.js';
import { $ } from '../ui.js';
import { NAZWA } from '../marka.js';
import { Podglad } from '../podglad.js';
import { pokazEkran } from './kontekst.js';

let podgladPubliczny = null;
// Podgląd strony z linku (powiększanie, prezentacja) – null, gdy to nie jest podgląd z linku.
export const podgladZLinku = () => (document.body.classList.contains('podglad-publiczny') ? podgladPubliczny : null);

// Link bez ochrony czyta pliki z publicznego folderu; link z hasłem albo datą ważności – przez funkcję
// bazy (chmura.js).
export async function pokazUdostepniony(t) {
  document.body.classList.add('podglad-publiczny');
  pokazEkran('podglad');
  try {
    let dane;
    try {
      dane = await chmura.wczytajPodgladPubliczny(t.konto, t.projekt, t.kod);
    } catch (bladPubliczny) {
      try {
        await chmura.sprawdzLinkChroniony(t.konto, t.projekt, t.kod);
      } catch (e) {
        if (e.stanLinku === 'haslo') { pokazPoleHasla(t); return; }
        throw e.stanLinku && e.stanLinku !== 'brak' ? e : bladPubliczny;
      }
      dane = await chmura.wczytajPodgladChroniony(t.konto, t.projekt, t.kod);
      dane.chroniony = true;
    }
    pokazStronyLinku(dane, t);
  } catch (e) {
    pokazBladLinku(e);
  }
}

// Otwarty link sam sprawdza, czy właściciel go nie zaktualizował: co minutę i przy powrocie do karty.
// Nowa wersja podmienia tylko obrazy stron, które się zmieniły – reszta i miejsce przewinięcia zostają.
const CO_ILE_SPRAWDZAC = 60000;
let sledzony = null; // { t, haslo, chroniony, zaktualizowano, timer }

function zrodloLinku({ manifest, adresObrazu }) {
  const kiedyStan = new Date(manifest.zaktualizowano).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    obraz: (strona) => adresObrazu(strona.id),
    odcisk: manifest.skroty ? (strona) => manifest.skroty[strona.id] : null,
    stale: true,
    klikalne: false,
    opis: `stan z ${kiedyStan}`,
  };
}

function pokazStronyLinku(dane, t, haslo = '') {
  const { manifest } = dane;
  document.title = `${manifest.uklad.nazwa} – ${NAZWA}`;
  podgladPubliczny ||= new Podglad();
  podgladPubliczny.pokaz(manifest.uklad, zrodloLinku(dane));
  sledzLink(t, haslo, Boolean(dane.chroniony), manifest.zaktualizowano);
}

function sledzLink(t, haslo, chroniony, zaktualizowano) {
  clearTimeout(sledzony?.timer);
  sledzony = { t, haslo, chroniony, zaktualizowano, timer: null };
  zaplanujSprawdzenie();
}

function zaplanujSprawdzenie() {
  const s = sledzony;
  if (!s) return;
  clearTimeout(s.timer);
  s.timer = setTimeout(async () => { await sprawdzLink(); zaplanujSprawdzenie(); }, CO_ILE_SPRAWDZAC);
}

async function sprawdzLink() {
  const s = sledzony;
  if (!s || !podgladZLinku() || document.visibilityState !== 'visible' || !navigator.onLine) return;
  if (podgladPubliczny.wPrezentacji) return; // w czasie prezentacji nic nie podmieniamy pod rękami
  try {
    const dane = s.chroniony
      ? await chmura.wczytajPodgladChroniony(s.t.konto, s.t.projekt, s.t.kod, s.haslo)
      : await chmura.wczytajPodgladPubliczny(s.t.konto, s.t.projekt, s.t.kod);
    if (sledzony !== s || dane.manifest.zaktualizowano === s.zaktualizowano) return;
    s.zaktualizowano = dane.manifest.zaktualizowano;
    document.title = `${dane.manifest.uklad.nazwa} – ${NAZWA}`;
    podgladPubliczny.odswiez(dane.manifest.uklad, zrodloLinku(dane));
  } catch { /* link wyłączony albo brak sieci – zostaje to, co widać */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sledzony) { sprawdzLink(); zaplanujSprawdzenie(); }
});

function pokazBladLinku(e) {
  document.title = NAZWA;
  $('#podglad-tytul').textContent = 'Podgląd niedostępny';
  $('#podglad-opis').textContent = '';
  const el = $('#podglad-tresc');
  el.innerHTML = `<div class="podglad-pusto"><h2>${e.stanLinku === 'wygasl' ? 'Link wygasł' : 'Ten link nie działa'}</h2><p class="ciche"></p><a class="przycisk" href="./">Przejdź do Makietki</a></div>`;
  $('p', el).textContent = e.message;
}

// Link chroniony hasłem: pole hasła; dopiero poprawne hasło pokazuje strony.
function pokazPoleHasla(t) {
  document.title = NAZWA;
  $('#podglad-tytul').textContent = 'Podgląd chroniony hasłem';
  $('#podglad-opis').textContent = '';
  const el = $('#podglad-tresc');
  el.innerHTML = `<div class="podglad-pusto" id="podglad-haslo"><h2>Podgląd chroniony hasłem</h2>
    <p class="ciche">Osoba, która udostępniła ten podgląd, ustawiła hasło. Wpisz je, żeby zobaczyć strony.</p>
    <form><input type="password" name="haslo" autocomplete="current-password" aria-label="Hasło do podglądu" placeholder="Hasło" required><button type="submit" class="przycisk glowny">Pokaż</button></form>
    <p class="komunikat" role="status"></p></div>`;
  const form = $('form', el);
  form.elements.haslo.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const komunikat = $('.komunikat', el);
    const przycisk = $('button', form);
    przycisk.disabled = true;
    komunikat.textContent = 'Sprawdzam hasło…';
    try {
      const haslo = form.elements.haslo.value;
      pokazStronyLinku({ ...(await chmura.wczytajPodgladChroniony(t.konto, t.projekt, t.kod, haslo)), chroniony: true }, t, haslo);
    } catch (blad) {
      if (blad.stanLinku === 'wygasl' || blad.stanLinku === 'brak') { pokazBladLinku(blad); return; }
      komunikat.textContent = blad.stanLinku ? blad.message : `Nie udało się wczytać podglądu: ${chmura.komunikatBledu(blad)}`;
      form.elements.haslo.select();
    } finally {
      przycisk.disabled = false;
    }
  });
}
