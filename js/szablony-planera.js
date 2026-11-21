// Szablony planera w Bibliotece (#143): gotowe tabele (tabela jako jeden element, js/tabela-obiekt.js) –
// lista zadań, tracker nawyków, plan tygodnia i dnia, notatki w linie, siatka dni, budżet, kontakty, plan lekcji.
// Po wstawieniu to zwykła tabela: tekst, kolumny, wiersze i linie zmienia się w panelu jak w każdej tabeli.
//
// Szablon: { id, nazwa, slowa, opis, kolumny: mm (0 = reszta szerokości, dzielona po równo),
//            wiersze: liczba wierszy, wysokosc: mm wiersza, naglowek: [teksty] | null,
//            pierwsza: [teksty pierwszej kolumny pod nagłówkiem], srodek: [numery kolumn wyśrodkowanych],
//            linie: 'siatka' | 'poziome', ostatni: tekst w pierwszej komórce ostatniego wiersza (pogrubiony) }
import { t as tt } from './jezyk.js';

const DNI = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
const DNI_KROTKO = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
export const KOLOR_LINII = '#8a877f';

export const SZABLONY = [
  { id: 'lista-zadan', nazwa: 'Lista zadań', slowa: 'lista zadan todo do zrobienia checkbox', opis: tt('szablonyPlanera.kratkiDoOdhaczania'), kolumny: [7, 0], wiersze: 13, wysokosc: 7, naglowek: ['', 'Zadanie'], linie: 'siatka' },
  { id: 'tracker-nawykow', nazwa: 'Tracker nawyków', slowa: 'tracker nawyki nawykow tydzien habit', opis: tt('szablonyPlanera.nawykISiedemDni'), kolumny: [0, 9, 9, 9, 9, 9, 9, 9], wiersze: 9, wysokosc: 8, naglowek: ['Nawyk', ...DNI_KROTKO], srodek: [1, 2, 3, 4, 5, 6, 7], linie: 'siatka' },
  { id: 'plan-tygodnia', nazwa: 'Plan tygodnia', slowa: 'plan tygodnia tydzien dni planer', opis: tt('szablonyPlanera.dzienPoDniu'), kolumny: [28, 0], wiersze: 8, wysokosc: 20, naglowek: ['Dzień', 'Plan'], pierwsza: DNI, linie: 'siatka' },
  { id: 'plan-dnia', nazwa: 'Plan dnia', slowa: 'plan dnia godziny harmonogram planer', opis: tt('szablonyPlanera.godzinaPoGodzinie6'), kolumny: [16, 0], wiersze: 17, wysokosc: 8, naglowek: ['Godzina', 'Plan'], pierwsza: Array.from({ length: 16 }, (_, i) => `${i + 6}:00`), linie: 'poziome' },
  { id: 'notatki-linie', nazwa: 'Notatki w linie', slowa: 'notatki linie liniatura zeszyt pisanie', opis: tt('szablonyPlanera.linieDoPisaniaCo'), kolumny: [0], wiersze: 16, wysokosc: 8, naglowek: null, linie: 'poziome' },
  { id: 'siatka-dni', nazwa: 'Siatka dni tygodnia', slowa: 'siatka dni tygodnia miesiac kalendarz pusty', opis: tt('szablonyPlanera.pustyMiesiacDoWpisania'), kolumny: [0, 0, 0, 0, 0, 0, 0], wiersze: 6, wysokosc: 18, naglowek: DNI_KROTKO, srodek: [0, 1, 2, 3, 4, 5, 6], linie: 'siatka' },
  { id: 'lista-zakupow', nazwa: 'Lista zakupów', slowa: 'lista zakupow sklep produkty', opis: tt('szablonyPlanera.produktIIlosc'), kolumny: [7, 0, 20], wiersze: 13, wysokosc: 7, naglowek: ['', 'Produkt', 'Ilość'], srodek: [2], linie: 'siatka' },
  { id: 'cele', nazwa: 'Cele', slowa: 'cele miesiaca plan termin', opis: tt('szablonyPlanera.celITermin'), kolumny: [7, 0, 24], wiersze: 7, wysokosc: 11, naglowek: ['', 'Cel', 'Termin'], srodek: [2], linie: 'siatka' },
  { id: 'budzet', nazwa: 'Budżet', slowa: 'budzet wydatki pieniadze plan finanse', opis: tt('szablonyPlanera.planIWydatkiZ'), kolumny: [0, 26, 26], wiersze: 11, wysokosc: 7, naglowek: ['Pozycja', 'Plan', 'Wydano'], srodek: [1, 2], linie: 'siatka', ostatni: 'Razem' },
  { id: 'kontakty', nazwa: 'Kontakty', slowa: 'kontakty telefony adresy email', opis: tt('szablonyPlanera.imieTelefonEMail'), kolumny: [0, 32, 0], wiersze: 11, wysokosc: 8, naglowek: ['Imię i nazwisko', 'Telefon', 'E-mail'], linie: 'siatka' },
  { id: 'plan-lekcji', nazwa: 'Plan lekcji', slowa: 'plan lekcji szkola zajecia tydzien', opis: tt('szablonyPlanera.piecDniOsiemLekcji'), kolumny: [10, 0, 0, 0, 0, 0], wiersze: 9, wysokosc: 11, naglowek: ['', ...DNI_KROTKO.slice(0, 5)], pierwsza: ['1', '2', '3', '4', '5', '6', '7', '8'], srodek: [0, 1, 2, 3, 4, 5], linie: 'siatka' },
];

// Kolejne szablony planera (#162): plany, trackery, listy i budżet – grupa to nagłówek w kategorii „Planer”.
const DNI_MIESIACA = Array.from({ length: 31 }, (_, i) => String(i + 1));
SZABLONY.push(
  { id: 'plan-miesiaca-lista', grupa: 'Plany', nazwa: 'Plan miesiąca – lista dni', slowa: 'plan miesiaca dni lista 31', opis: tt('szablonyPlanera.dni131I'), kolumny: [9, 0], wiersze: 32, wysokosc: 5, naglowek: ['', 'Plan'], pierwsza: DNI_MIESIACA, srodek: [0], linie: 'poziome' },
  { id: 'plan-tygodnia-kolumny', grupa: 'Plany', nazwa: 'Plan tygodnia – kolumny', slowa: 'plan tygodnia kolumny dni poziomo', opis: tt('szablonyPlanera.siedemDniObokSiebie'), kolumny: [0, 0, 0, 0, 0, 0, 0], wiersze: 2, wysokosc: 60, naglowek: DNI_KROTKO, srodek: [0, 1, 2, 3, 4, 5, 6], linie: 'siatka' },
  { id: 'plan-tygodnia-priorytety', grupa: 'Plany', nazwa: 'Tydzień z priorytetami', slowa: 'plan tygodnia priorytety cele zadania', opis: tt('szablonyPlanera.dzienZadaniaINajwazniejsza'), kolumny: [26, 0, 36], wiersze: 8, wysokosc: 16, naglowek: ['Dzień', 'Zadania', 'Najważniejsze'], pierwsza: DNI, linie: 'siatka' },
  { id: 'plan-posilkow', grupa: 'Plany', nazwa: 'Plan posiłków', slowa: 'plan posilkow jadlospis menu dieta tydzien', opis: tt('szablonyPlanera.sniadanieObiadKolacjaNa'), kolumny: [20, 0, 0, 0], wiersze: 8, wysokosc: 14, naglowek: ['', 'Śniadanie', 'Obiad', 'Kolacja'], pierwsza: DNI_KROTKO, srodek: [0], linie: 'siatka' },
  { id: 'tracker-nastroju', grupa: 'Trackery', nazwa: 'Tracker nastroju', slowa: 'tracker nastroj samopoczucie emocje miesiac', opis: tt('szablonyPlanera.nastrojDzienPoDniu'), kolumny: [9, 0, 0, 0, 0, 0], wiersze: 32, wysokosc: 5, naglowek: ['', 'Świetnie', 'Dobrze', 'Średnio', 'Słabo', 'Źle'], pierwsza: DNI_MIESIACA, srodek: [0, 1, 2, 3, 4, 5], linie: 'siatka' },
  { id: 'tracker-wody', grupa: 'Trackery', nazwa: 'Tracker wody', slowa: 'tracker woda picie szklanki nawodnienie', opis: tt('szablonyPlanera.osiemSzklanekDziennie'), kolumny: [0, 9, 9, 9, 9, 9, 9, 9, 9], wiersze: 8, wysokosc: 9, naglowek: ['Dzień', '1', '2', '3', '4', '5', '6', '7', '8'], pierwsza: DNI, srodek: [1, 2, 3, 4, 5, 6, 7, 8], linie: 'siatka' },
  { id: 'tracker-czytania', grupa: 'Trackery', nazwa: 'Tracker czytania', slowa: 'tracker czytanie ksiazki lektura strony', opis: tt('szablonyPlanera.dataTytulStrony'), kolumny: [20, 0, 16, 16], wiersze: 13, wysokosc: 8, naglowek: ['Data', 'Tytuł', 'Strony', 'Koniec'], srodek: [2, 3], linie: 'siatka' },
  { id: 'dziennik-modlitwy', grupa: 'Trackery', nazwa: 'Dziennik modlitwy', slowa: 'modlitwa intencje dziennik wiara wysluchane', opis: tt('szablonyPlanera.dataIntencjaWysluchana'), kolumny: [20, 0, 22], wiersze: 13, wysokosc: 9, naglowek: ['Data', 'Intencja', 'Wysłuchana'], srodek: [2], linie: 'siatka' },
  { id: 'lista-zyczen', grupa: 'Listy i budżet', nazwa: 'Lista życzeń', slowa: 'lista zyczen marzenia prezenty', opis: tt('szablonyPlanera.rzeczCenaGdzie'), kolumny: [7, 0, 20, 30], wiersze: 13, wysokosc: 8, naglowek: ['', 'Marzenie', 'Cena', 'Gdzie'], srodek: [2], linie: 'siatka' },
  { id: 'budzet-miesieczny', grupa: 'Listy i budżet', nazwa: 'Budżet miesięczny', slowa: 'budzet miesieczny wydatki kategorie finanse domowe', opis: tt('szablonyPlanera.kategoriePlanWydatkiRoznica'), kolumny: [0, 22, 22, 22], wiersze: 12, wysokosc: 7, naglowek: ['Kategoria', 'Plan', 'Wydano', 'Różnica'], pierwsza: ['Mieszkanie', 'Jedzenie', 'Transport', 'Rachunki', 'Zdrowie', 'Ubrania', 'Rozrywka', 'Prezenty', 'Oszczędności', 'Inne'], srodek: [1, 2, 3], linie: 'siatka', ostatni: 'Razem' },
);
for (const s of SZABLONY) s.grupa ||= 'Gotowe tabele';

// Tabele formularzy (#162) – w kategorii „Formularze do druku”, nie w Planerze.
export const SZABLONY_FORMULARZY = [
  { id: 'zamowienie', grupa: 'Tabele', nazwa: 'Tabelka zamówienia', slowa: 'zamowienie tabela produkty ilosc cena formularz', opis: tt('szablonyPlanera.lpProduktIloscCena'), kolumny: [9, 0, 16, 20, 22], wiersze: 9, wysokosc: 8, naglowek: ['Lp.', 'Produkt', 'Ilość', 'Cena', 'Wartość'], pierwsza: ['1', '2', '3', '4', '5', '6', '7'], srodek: [0, 2, 3, 4], linie: 'siatka', ostatni: 'Razem' },
  { id: 'lista-obecnosci', grupa: 'Tabele', nazwa: 'Lista obecności', slowa: 'lista obecnosci podpisy spotkanie', opis: tt('szablonyPlanera.lpImieINazwisko'), kolumny: [9, 0, 40], wiersze: 16, wysokosc: 8, naglowek: ['Lp.', 'Imię i nazwisko', 'Podpis'], pierwsza: Array.from({ length: 15 }, (_, i) => String(i + 1)), srodek: [0], linie: 'siatka' },
];

export const szablonPlanera = (id) => SZABLONY.find((s) => s.id === id) || SZABLONY_FORMULARZY.find((s) => s.id === id) || null;

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
