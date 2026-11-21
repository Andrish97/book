// Podgląd udostępniony linkiem (#/u/<konto>/<projekt>/<kod> albo krótko /<kod z 6 znaków>, #195) – bez logowania i bez edytora.
// Oglądający dostaje gotowe obrazy stron, więc ten moduł nie potrzebuje biblioteki płótna ani składania
// stron; własny podgląd (Podglad) tworzy dopiero przy pierwszym użyciu.

import * as chmura from '../chmura.js';
import { $ } from '../ui.js';
import { NAZWA } from '../marka.js';
import { Podglad } from '../podglad.js';
import { pokazEkran } from './kontekst.js';
import { t as tt } from '../jezyk.js';

let podgladPubliczny = null;
let daneLinku = null; // ostatni manifest i adresy obrazów – do makiety 3D (#188)
// Podgląd strony z linku (powiększanie, prezentacja) – null, gdy to nie jest podgląd z linku.
export const podgladZLinku = () => (document.body.classList.contains('podglad-publiczny') ? podgladPubliczny : null);

// Link bez ochrony czyta pliki z publicznego folderu; link z hasłem albo datą ważności – przez funkcję
// bazy (chmura.js).
export async function pokazUdostepniony(t) {
  document.body.classList.add('podglad-publiczny');
  pokazEkran('podglad');
  try {
    if (t.krotki) {
      const pelny = await chmura.rozwinKrotkiLink(t.krotki);
      if (!pelny) throw new Error('Link mógł zostać unieważniony albo jest wpisany z błędem.');
      t = { ...t, ...pelny };
    }
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
    // Strona jeszcze nieprzygotowana (#204): bez obrazu – zostaje migoczące miejsce, dorysuje się po odświeżeniu.
    obraz: (strona) => (manifest.przygotowanie && !manifest.skroty?.[strona.id] ? Promise.reject(new Error('w przygotowaniu')) : adresObrazu(strona.id)),
    odcisk: manifest.skroty ? (strona) => manifest.skroty[strona.id] : null,
    stale: true,
    klikalne: false,
    opis: `stan z ${kiedyStan}`,
  };
}

// Makieta 3D z linku (#188): przycisk tylko, gdy manifest ma opis makiety (link opublikowany po #188).
function ustawDaneLinku(dane) {
  daneLinku = dane;
  document.body.toggleAttribute('data-makieta-linku', Boolean(dane.manifest.uklad?.makieta?.strony?.length) && !dane.manifest.przygotowanie);
  pokazPrzygotowanie(dane.manifest);
}

// Podgląd w przygotowaniu (#204): właściciel dopiero co utworzył albo zaktualizował link, strony wysyłają się
// w tle – wprost mówimy, że nie wszystko jest jeszcze gotowe, a strony pojawią się same.
function pokazPrzygotowanie(manifest) {
  let el = document.querySelector('#podglad-przygotowanie');
  if (!manifest.przygotowanie) { el?.remove(); return; }
  if (!el) {
    el = Object.assign(document.createElement('p'), { id: 'podglad-przygotowanie', className: 'podglad-przygotowanie' });
    el.setAttribute('role', 'status');
    document.querySelector('#podglad-tresc')?.before(el);
  }
  const ile = Number.isFinite(manifest.wszystkie) ? ` (gotowe ${manifest.gotowe ?? 0} z ${manifest.wszystkie})` : '';
  el.textContent = `Podgląd jest w przygotowaniu${ile} – strony pojawiają się po kolei, sama strona odświeża się co kilka sekund.`;
}

export async function otworzMakieteLinku() {
  const opis = daneLinku?.manifest.uklad?.makieta;
  if (!opis) return;
  (await import('./makieta-okno.js')).otworzMakieteZLinku(opis, daneLinku.adresObrazu);
}

function pokazStronyLinku(dane, t, haslo = '') {
  const { manifest } = dane;
  ustawDaneLinku(dane);
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
  // W przygotowaniu – co 4 s, aż wszystkie strony będą gotowe (#204); potem jak zwykle co minutę.
  s.timer = setTimeout(async () => { await sprawdzLink(); zaplanujSprawdzenie(); }, daneLinku?.manifest?.przygotowanie ? 4000 : CO_ILE_SPRAWDZAC);
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
    ustawDaneLinku(dane);
    podgladPubliczny.odswiez(dane.manifest.uklad, zrodloLinku(dane));
  } catch { /* link wyłączony albo brak sieci – zostaje to, co widać */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sledzony) { sprawdzLink(); zaplanujSprawdzenie(); }
});

function pokazBladLinku(e) {
  document.title = NAZWA;
  $('#podglad-tytul').textContent = tt('udostepnione.podgladNiedostepny');
  $('#podglad-opis').textContent = '';
  const el = $('#podglad-tresc');
  const tytul = { wygasl: 'Link wygasł' }[e.stanLinku] || 'Ten link nie działa';
  el.innerHTML = `<div class="podglad-pusto"><h2>${tytul}</h2><p class="ciche"></p><a class="przycisk" href="./">Przejdź do Makietki</a></div>`;
  $('p', el).textContent = e.message;
}

// Link chroniony hasłem: pole hasła; dopiero poprawne hasło pokazuje strony.
function pokazPoleHasla(t) {
  document.title = NAZWA;
  $('#podglad-tytul').textContent = tt('udostepnione.podgladChronionyHaslem');
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
    komunikat.textContent = tt('udostepnione.sprawdzamHaslo');
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
