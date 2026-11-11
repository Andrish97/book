// Instrukcja wczytywana przy pierwszym otwarciu: treść rozdziałów (js/instrukcja.js, ok. 75 kB) nie jest
// potrzebna na ekranie logowania ani na liście projektów, dopóki ktoś nie kliknie „Instrukcja”.

const KLUCZ_PRZECZYTANA = 'seriodruk:instrukcja-przeczytana'; // ten sam co w js/instrukcja.js

let obietnica = null;
let kto = null;

function wczytaj() {
  if (!obietnica) {
    obietnica = import('../instrukcja.js').then(({ Instrukcja }) => {
      const i = new Instrukcja();
      if (kto) i.kto = kto; // instrukcja zapamiętuje, że ten użytkownik już ją widział
      return i;
    });
    obietnica.catch(() => { obietnica = null; });
  }
  return obietnica;
}

function przeczytana(k) {
  try { return localStorage.getItem(`${KLUCZ_PRZECZYTANA}:${k}`) === '1'; } catch { return true; }
}

export const instrukcja = {
  otworz: async (indeks = 0) => (await wczytaj()).otworz(indeks),
  otworzRozdzial: async (tytul) => (await wczytaj()).otworzRozdzial(tytul),
  zamknij: async () => { if (obietnica) (await obietnica).zamknij(); },
  // Przy pierwszym wejściu użytkownika instrukcja otwiera się sama; potem wczytuje się dopiero na żądanie.
  otworzJesliNowa: async (k) => {
    kto = k;
    if (obietnica) { (await obietnica).otworzJesliNowa(k); return; }
    if (!przeczytana(k)) (await wczytaj()).otworzJesliNowa(k);
  },
};
