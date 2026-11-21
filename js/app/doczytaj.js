// Doczytywanie edytora. Ekran logowania, lista projektów, ustawienia konta i podgląd z linku nie potrzebują
// edytora ani biblioteki płótna (Fabric, ok. 0,3 MB) – te wczytują się dopiero tutaj: w tle zaraz po pokazaniu
// listy projektów, a najpóźniej przy otwarciu projektu. Wynik to moduł js/app/edytor-start.js z funkcjami,
// których potrzebuje reszta aplikacji (otwarcie projektu, zapis, podgląd…).

import { powiadom } from '../ui.js';
import { MODULY_EDYTORA } from './moduly-edytora.js';
import { t as tt } from '../jezyk.js';

const FABRIC = 'js/zewnetrzne/fabric-7.4.0.min.js';

function wczytajSkrypt(adres) {
  return new Promise((ok, blad) => {
    const s = document.createElement('script');
    s.src = adres;
    s.onload = ok;
    s.onerror = () => { s.remove(); blad(new Error('Nie udało się wczytać edytora. Sprawdź połączenie z internetem i spróbuj jeszcze raz.')); };
    document.head.append(s);
  });
}

let obietnica = null;
let modul = null;

export function doczytajEdytor() {
  if (modul) return Promise.resolve(modul);
  if (!obietnica) {
    obietnica = (async () => {
      // Moduły edytora pobierane naraz i równolegle z biblioteką płótna (#158) – zamiast import po imporcie.
      // Sam preload niczego nie uruchamia; edytor startuje dopiero po wczytaniu Fabric.
      for (const m of MODULY_EDYTORA) {
        if (document.querySelector(`link[rel="modulepreload"][href="${m}"]`)) continue;
        const l = document.createElement('link');
        l.rel = 'modulepreload';
        l.href = m;
        document.head.append(l);
      }
      if (typeof window.fabric === 'undefined') await wczytajSkrypt(FABRIC);
      modul = await import('./edytor-start.js');
      return modul;
    })();
    obietnica.catch(() => { obietnica = null; }); // następna próba zacznie od nowa
  }
  return obietnica;
}

// Moduł edytora, gdy jest już wczytany (albo null) – dla kodu, który potrzebuje go tylko przy otwartym projekcie.
export const edytorGotowy = () => modul;

// Doczytanie, na które użytkownik czeka (otwarcie projektu): gdy trwa dłużej niż chwilę, mówimy o tym.
export async function czekajNaEdytor() {
  if (modul) return modul;
  // Przy uruchamianiu (#170) czeka ekran startowy – bez dodatkowego dymka.
  const t = setTimeout(() => { if (!document.body.classList.contains('startuje')) powiadom(tt('doczytaj.wczytujeEdytor')); }, 400);
  try {
    return await doczytajEdytor();
  } catch (e) {
    powiadom(e.message, true);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// W tle, gdy przeglądarka nie ma nic pilniejszego (lista projektów jest już widoczna).
export function doczytajWTle() {
  if (modul || obietnica) return;
  const start = () => doczytajEdytor().catch(() => {});
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1500 });
  else setTimeout(start, 300);
}
