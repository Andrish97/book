// Web Worker sprawdzania pisowni (#131C): wczytuje słownik przy pierwszym użyciu i sprawdza słowa poza
// głównym wątkiem, żeby pisanie i przewijanie nie zwalniały. Wiadomości: { id, rodzaj, … } → { id, wynik }.

import { Pisownia } from './pisownia-rdzen.js';

let pisownia = null;
async function gotowa() {
  if (!pisownia) {
    pisownia = (async () => {
      const baza = new URL('./zewnetrzne/slownik-pl/', import.meta.url);
      const [aff, dic] = await Promise.all(['pl.aff', 'pl.dic'].map((p) => fetch(new URL(p, baza)).then((o) => {
        if (!o.ok) throw new Error(`Nie udało się pobrać słownika (${o.status}).`);
        return o.text();
      })));
      return new Pisownia(aff, dic);
    })();
  }
  return pisownia;
}

self.addEventListener('message', async (e) => {
  const { id, rodzaj } = e.data || {};
  try {
    const p = await gotowa();
    let wynik = null;
    if (rodzaj === 'wlasne') { p.wlasne = new Set(); p.dodajWlasne(e.data.slowa); wynik = true; }
    else if (rodzaj === 'sprawdz') wynik = (e.data.slowa || []).filter((s) => !p.poprawne(s));
    else if (rodzaj === 'podpowiedzi') wynik = p.podpowiedzi(e.data.slowo, e.data.ile || 6);
    self.postMessage({ id, wynik });
  } catch (blad) {
    self.postMessage({ id, blad: blad.message });
  }
});
