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

export async function pokazUdostepniony(t) {
  document.body.classList.add('podglad-publiczny');
  pokazEkran('podglad');
  try {
    const { manifest, adresObrazu } = await chmura.wczytajPodgladPubliczny(t.konto, t.projekt, t.kod);
    document.title = `${manifest.uklad.nazwa} – ${NAZWA}`;
    const kiedyStan = new Date(manifest.zaktualizowano).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    podgladPubliczny ||= new Podglad();
    podgladPubliczny.pokaz(manifest.uklad, {
      obraz: (strona) => adresObrazu(strona.id), stale: true, klikalne: false, opis: `stan z ${kiedyStan}`,
    });
  } catch (e) {
    document.title = NAZWA;
    $('#podglad-tytul').textContent = 'Podgląd niedostępny';
    $('#podglad-opis').textContent = '';
    const el = $('#podglad-tresc');
    el.innerHTML = '<div class="podglad-pusto"><h2>Ten link nie działa</h2><p class="ciche"></p><a class="przycisk" href="./">Przejdź do Seriodruku</a></div>';
    $('p', el).textContent = e.message;
  }
}

