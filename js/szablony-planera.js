// Szablony planera w Bibliotece (#143): gotowe tabele (tabela jako jeden element, js/tabela-obiekt.js) –
// lista zadań, tracker nawyków, plan tygodnia i dnia, notatki w linie, siatka dni, budżet, kontakty, plan lekcji.
// Po wstawieniu to zwykła tabela: tekst, kolumny, wiersze i linie zmienia się w panelu jak w każdej tabeli.
//
// Szablon: { id, nazwa, slowa, opis, kolumny: mm (0 = reszta szerokości, dzielona po równo),
//            wiersze: liczba wierszy, wysokosc: mm wiersza, naglowek: [teksty] | null,
//            pierwsza: [teksty pierwszej kolumny pod nagłówkiem], srodek: [numery kolumn wyśrodkowanych],
//            linie: 'siatka' | 'poziome', ostatni: tekst w pierwszej komórce ostatniego wiersza (pogrubiony) }

const DNI = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
const DNI_KROTKO = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
export const KOLOR_LINII = '#8a877f';

export const SZABLONY = [
  { id: 'lista-zadan', nazwa: 'Lista zadań', slowa: 'lista zadan todo do zrobienia checkbox', opis: 'Kratki do odhaczania', kolumny: [7, 0], wiersze: 13, wysokosc: 7, naglowek: ['', 'Zadanie'], linie: 'siatka' },
  { id: 'tracker-nawykow', nazwa: 'Tracker nawyków', slowa: 'tracker nawyki nawykow tydzien habit', opis: 'Nawyk i siedem dni tygodnia', kolumny: [0, 9, 9, 9, 9, 9, 9, 9], wiersze: 9, wysokosc: 8, naglowek: ['Nawyk', ...DNI_KROTKO], srodek: [1, 2, 3, 4, 5, 6, 7], linie: 'siatka' },
  { id: 'plan-tygodnia', nazwa: 'Plan tygodnia', slowa: 'plan tygodnia tydzien dni planer', opis: 'Dzień po dniu', kolumny: [28, 0], wiersze: 8, wysokosc: 20, naglowek: ['Dzień', 'Plan'], pierwsza: DNI, linie: 'siatka' },
  { id: 'plan-dnia', nazwa: 'Plan dnia', slowa: 'plan dnia godziny harmonogram planer', opis: 'Godzina po godzinie, 6:00–21:00', kolumny: [16, 0], wiersze: 17, wysokosc: 8, naglowek: ['Godzina', 'Plan'], pierwsza: Array.from({ length: 16 }, (_, i) => `${i + 6}:00`), linie: 'poziome' },
  { id: 'notatki-linie', nazwa: 'Notatki w linie', slowa: 'notatki linie liniatura zeszyt pisanie', opis: 'Linie do pisania co 8 mm', kolumny: [0], wiersze: 16, wysokosc: 8, naglowek: null, linie: 'poziome' },
  { id: 'siatka-dni', nazwa: 'Siatka dni tygodnia', slowa: 'siatka dni tygodnia miesiac kalendarz pusty', opis: 'Pusty miesiąc do wpisania dat', kolumny: [0, 0, 0, 0, 0, 0, 0], wiersze: 6, wysokosc: 18, naglowek: DNI_KROTKO, srodek: [0, 1, 2, 3, 4, 5, 6], linie: 'siatka' },
  { id: 'lista-zakupow', nazwa: 'Lista zakupów', slowa: 'lista zakupow sklep produkty', opis: 'Produkt i ilość', kolumny: [7, 0, 20], wiersze: 13, wysokosc: 7, naglowek: ['', 'Produkt', 'Ilość'], srodek: [2], linie: 'siatka' },
  { id: 'cele', nazwa: 'Cele', slowa: 'cele miesiaca plan termin', opis: 'Cel i termin', kolumny: [7, 0, 24], wiersze: 7, wysokosc: 11, naglowek: ['', 'Cel', 'Termin'], srodek: [2], linie: 'siatka' },
  { id: 'budzet', nazwa: 'Budżet', slowa: 'budzet wydatki pieniadze plan finanse', opis: 'Plan i wydatki z wierszem „Razem”', kolumny: [0, 26, 26], wiersze: 11, wysokosc: 7, naglowek: ['Pozycja', 'Plan', 'Wydano'], srodek: [1, 2], linie: 'siatka', ostatni: 'Razem' },
  { id: 'kontakty', nazwa: 'Kontakty', slowa: 'kontakty telefony adresy email', opis: 'Imię, telefon, e-mail', kolumny: [0, 32, 0], wiersze: 11, wysokosc: 8, naglowek: ['Imię i nazwisko', 'Telefon', 'E-mail'], linie: 'siatka' },
  { id: 'plan-lekcji', nazwa: 'Plan lekcji', slowa: 'plan lekcji szkola zajecia tydzien', opis: 'Pięć dni, osiem lekcji', kolumny: [10, 0, 0, 0, 0, 0], wiersze: 9, wysokosc: 11, naglowek: ['', ...DNI_KROTKO.slice(0, 5)], pierwsza: ['1', '2', '3', '4', '5', '6', '7', '8'], srodek: [0, 1, 2, 3, 4, 5], linie: 'siatka' },
];

export const szablonPlanera = (id) => SZABLONY.find((s) => s.id === id) || null;

// Szerokości kolumn w mm przy całkowitej szerokości `szer` (kolumny 0 dzielą resztę po równo).
export function szerokosciKolumn(s, szer) {
  const stale = s.kolumny.reduce((a, k) => a + k, 0);
  const ileReszty = s.kolumny.filter((k) => !k).length;
  const reszta = ileReszty ? Math.max(8 * ileReszty, szer - stale) / ileReszty : 0;
  return s.kolumny.map((k) => Math.floor((k || reszta) * 100) / 100);
}

// Uzupełnia świeżą tabelę (nowaTabela z liczbą wierszy i kolumn szablonu) treścią, szerokościami i liniami.
// `tabela` – funkcje z js/tabela-obiekt.js (ten plik ładuje się też bez płótna, np. w Bibliotece w testach).
export function zastosujSzablon(g, s, szer, { komorkiTabeli, ulozTabele, ustawLinieZakresu, ustawKrawedzKomorki }) {
  const t = g.tabela;
  const K = s.kolumny.length;
  const W = t.wiersze.length;
  t.kolumny = szerokosciKolumn(s, szer);
  t.linia = { kolor: KOLOR_LINII, grubosc: 0.2 };
  const komorki = komorkiTabeli(g);
  const naglowek = Boolean(s.naglowek);
  komorki.forEach((c, i) => {
    const w = Math.floor(i / K);
    const k = i % K;
    let tekst = '';
    if (naglowek && w === 0) tekst = s.naglowek[k] || '';
    else if (k === 0 && s.pierwsza) tekst = s.pierwsza[w - (naglowek ? 1 : 0)] || '';
    if (s.ostatni && w === W - 1 && k === 0) tekst = s.ostatni;
    const gruby = (naglowek && w === 0) || (s.ostatni && w === W - 1) || (k === 0 && s.pierwsza);
    c.set({ text: tekst, fontWeight: gruby ? 'bold' : 'normal', textAlign: (s.srodek || []).includes(k) ? 'center' : 'left' });
    if (s.linie === 'siatka' && s.pierwsza && k === 0 && s.wysokosc >= 15) c.set('wyrownanie_pion', 'gora');
  });
  if (s.linie === 'poziome') {
    ustawLinieZakresu(g, 'tabela', {}, 'wszystkie', { grubosc: 0 });
    ustawLinieZakresu(g, 'tabela', {}, 'poziome', { grubosc: 0.2, kolor: KOLOR_LINII });
    for (let k = 0; k < K; k += 1) ustawKrawedzKomorki(g, W - 1, k, 'dol', { grubosc: 0.2, kolor: KOLOR_LINII });
  }
  ulozTabele(g);
  return g;
}

// Podgląd w Bibliotece: wiersze i kolumny szablonu w polu 70 × 52.
export function svgSzablonu(s) {
  const W = Math.min(s.wiersze, 10);
  const x0 = 8; const y0 = 5; const sz = 54; const wy = 42;
  const kol = szerokosciKolumn(s, 120);
  const suma = kol.reduce((a, k) => a + k, 0);
  const h = wy / W;
  let d = '';
  for (let w = 0; w <= W; w += 1) d += `M ${x0} ${(y0 + w * h).toFixed(2)} H ${x0 + sz} `;
  if (s.linie === 'siatka') {
    let x = x0;
    d += `M ${x0} ${y0} V ${y0 + wy} `;
    for (const k of kol) { x += (k / suma) * sz; d += `M ${x.toFixed(2)} ${y0} V ${y0 + wy} `; }
  }
  const pasek = s.naglowek ? `<rect x="${x0}" y="${y0}" width="${sz}" height="${h.toFixed(2)}" class="pasek"/>` : '';
  return `<svg viewBox="0 0 70 52" aria-hidden="true"><rect x="${x0}" y="${y0}" width="${sz}" height="${wy}" class="tlo"/>${pasek}<path d="${d.trim()}" class="cienka"/></svg>`;
}
