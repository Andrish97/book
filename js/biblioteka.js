// Biblioteka (decyzje #131A, #134): JEDNO miejsce, z którego wstawia się gotowe elementy – kształty,
// strzałki i dymki, ozdobniki i ramki, kalendarze, wykresy, kolaże, a w kolejnych partiach także „Moje
// elementy”, style tekstu, kolory i zestaw marki, kody QR/EAN. Każda część aplikacji dopisuje się tu jako
// kategoria – okno biblioteki (js/app/biblioteka-okno.js) niczego o nich nie wie.
//
// Kategoria: { id, nazwa, ikona, kolejnosc, opis?, elementy: () => Element[] }
// Element:   { id, nazwa, slowa?, podglad: HTML (SVG albo ikona), duzy?: bool, opis?,
//              wstaw: (edytor, punkt | null) => obiekt }   – punkt: miejsce upuszczenia na stronie (mm sceny)
// Kategorie z listą liczoną za każdym razem (elementy()) mogą zależeć od projektu (np. „Moje elementy”).

const kategorie = new Map();

export function zarejestrujKategorie(k) {
  if (!k?.id || typeof k.elementy !== 'function') throw new Error('Kategoria biblioteki potrzebuje id i elementy()');
  kategorie.set(k.id, { kolejnosc: 100, ikona: 'elementy', ...k });
}

export const kategorieBiblioteki = () => [...kategorie.values()].sort((a, b) => a.kolejnosc - b.kolejnosc);

export function elementBiblioteki(idKategorii, idElementu) {
  return kategorie.get(idKategorii)?.elementy().find((e) => e.id === idElementu) || null;
}

const bezOgonkow = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

// Elementy pasujące do zapytania (wszystkie słowa), z jednej kategorii albo ze wszystkich:
// [{ kategoria, element }].
export function szukajWBibliotece(zapytanie = '', idKategorii = null) {
  const slowa = bezOgonkow(zapytanie).split(/\s+/).filter(Boolean);
  const wynik = [];
  for (const k of kategorieBiblioteki()) {
    if (idKategorii && k.id !== idKategorii) continue;
    for (const e of k.elementy()) {
      const t = bezOgonkow(`${e.nazwa} ${e.slowa || ''} ${k.nazwa}`);
      if (slowa.every((s) => t.includes(s))) wynik.push({ kategoria: k, element: e });
    }
  }
  return wynik;
}
