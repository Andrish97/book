// Instrukcja wczytywana przy pierwszym otwarciu: treść podręcznika (js/instrukcja.js i js/instrukcja-tresc.js)
// nie jest potrzebna na ekranie logowania ani na liście projektów, dopóki ktoś nie otworzy instrukcji.
// Instrukcja nie otwiera się sama (decyzja #114) – to podręcznik, nie powitanie.

let obietnica = null;

function wczytaj() {
  if (!obietnica) {
    obietnica = import('../instrukcja.js').then(async ({ Instrukcja, wczytajTrescInstrukcji }) => { await wczytajTrescInstrukcji(); return new Instrukcja(); });
    obietnica.catch(() => { obietnica = null; });
  }
  return obietnica;
}

export const instrukcja = {
  otworz: async (indeks = -1) => (await wczytaj()).otworz(indeks),
  otworzRozdzial: async (tytul) => (await wczytaj()).otworzRozdzial(tytul),
  // #/instrukcja – działa także bez konta; po zamknięciu adres wraca na adresPrzed.
  otworzZAdresu: async (adresPrzed, cel = null) => (await wczytaj()).otworzZAdresu(adresPrzed, cel),
  zamknij: async () => { if (obietnica) (await obietnica).zamknij(); },
};
