// Kategorie biblioteki z partii #131A: kształty, strzałki i dymki, ozdobniki i ramki, kalendarze, wykresy,
// kolaże zdjęć. Rejestracja w js/biblioteka.js.

import { zarejestrujKategorie } from './biblioteka.js';
import { KSZTALTY, KOLAZE, svgKolazu, svgKsztaltu } from './ksztalty-biblioteka.js';

const ksztaltyZ = (...kategorie) => () => KSZTALTY.filter((k) => kategorie.includes(k.kategoria)).map((k) => ({
  id: k.id, nazwa: k.nazwa, slowa: `${k.slowa} ${k.kategoria}`, podglad: svgKsztaltu(k),
  wstaw: (e, punkt) => e.dodajKsztaltZBiblioteki(k.id, punkt),
}));

zarejestrujKategorie({ id: 'ksztalty', nazwa: 'Kształty', ikona: 'ksztalty', kolejnosc: 10, elementy: ksztaltyZ('Figury', 'Gwiazdy i serca', 'Ikony') });
zarejestrujKategorie({ id: 'strzalki', nazwa: 'Strzałki i dymki', ikona: 'strzalka', kolejnosc: 20, elementy: ksztaltyZ('Strzałki', 'Dymki') });
zarejestrujKategorie({ id: 'ozdobniki', nazwa: 'Ozdobniki i ramki', ikona: 'ozdobnik', kolejnosc: 30, elementy: ksztaltyZ('Wstęgi i banery', 'Ramki', 'Linie ozdobne') });

// Kalendarze: ten sam element w trzech gotowych ustawieniach.
const KALENDARZE = [
  ['zwykly', 'Kalendarz miesiąca', 'siatka dni swieta', {}],
  ['notatki', 'Kalendarz z miejscem na notatki', 'planer notatki duzy', { notatki: true, wiersz_dnia: 18 }],
  ['tygodnie', 'Kalendarz z numerami tygodni', 'tydzien numery tygodni', { tygodnie: true, nazwy: 'litery' }],
];
const podgladKalendarza = (notatki) => `<svg viewBox="0 0 70 52" aria-hidden="true"><rect x="2" y="2" width="66" height="48" rx="2" class="tlo"/><rect x="2" y="2" width="66" height="9" class="pasek"/>${
  Array.from({ length: 35 }, (_, i) => `<rect x="${4 + (i % 7) * 9}" y="${13 + Math.floor(i / 7) * 7.2}" width="${notatki ? 8 : 6}" height="${notatki ? 6.4 : 4}" rx="0.6" class="${i % 7 === 6 ? 'nd' : 'dz'}"/>`).join('')}</svg>`;
zarejestrujKategorie({
  id: 'kalendarze', nazwa: 'Kalendarze', ikona: 'kalendarz', kolejnosc: 40,
  elementy: () => KALENDARZE.map(([id, nazwa, slowa, opis]) => ({
    id, nazwa, slowa: `kalendarz miesiac ${slowa}`, duzy: true, podglad: podgladKalendarza(opis.notatki),
    opis: 'Miesiąc stały albo z kolumny danych, polskie święta', wstaw: (e, punkt) => e.dodajKalendarz(opis, punkt),
  })),
});

// Wykresy: rodzaje; dane z pierwszej tabeli projektu (zmienia się w panelu).
const WYKRESY = [
  ['slupki', 'Wykres słupkowy', '<path d="M8 44h54"/><rect x="12" y="24" width="9" height="20"/><rect x="27" y="12" width="9" height="32"/><rect x="42" y="18" width="9" height="26"/>'],
  ['poziome', 'Wykres poziomy', '<path d="M10 6v40"/><rect x="10" y="9" width="40" height="8"/><rect x="10" y="21" width="28" height="8"/><rect x="10" y="33" width="48" height="8"/>'],
  ['linia', 'Wykres liniowy', '<path d="M8 44h54"/><path d="M10 36 24 22l12 8 22-20" class="linia"/>'],
  ['kolo', 'Wykres kołowy', '<path d="M35 26V6a20 20 0 1 1-17.3 30z"/><path d="M35 26 17.7 36A20 20 0 0 1 35 6z" class="drugi"/>'],
  ['pierscien', 'Wykres pierścieniowy', '<path d="M35 6a20 20 0 1 1-17.3 30l7.8-4.5A11 11 0 1 0 35 15z"/><path d="M17.7 36A20 20 0 0 1 35 6v9a11 11 0 0 0-9.5 16.5z" class="drugi"/>'],
];
let opisWykresuDomyslny = () => ({});
export function ustawDomyslneDaneWykresu(fn) { opisWykresuDomyslny = fn; }
zarejestrujKategorie({
  id: 'wykresy', nazwa: 'Wykresy', ikona: 'wykres', kolejnosc: 50,
  elementy: () => WYKRESY.map(([rodzaj, nazwa, svg]) => ({
    id: rodzaj, nazwa, slowa: 'wykres dane liczby diagram', duzy: true,
    podglad: `<svg viewBox="0 0 70 52" aria-hidden="true" class="podglad-wykresu">${svg}</svg>`,
    opis: 'Z tabeli danych projektu', wstaw: (e, punkt) => e.dodajWykres({ ...opisWykresuDomyslny(), rodzaj }, punkt),
  })),
});

zarejestrujKategorie({
  id: 'kolaze', nazwa: 'Kolaże zdjęć', ikona: 'kolaz', kolejnosc: 60,
  elementy: () => KOLAZE.map((k) => ({
    id: k.id, nazwa: `Kolaż: ${k.nazwa}`, slowa: 'kolaz zdjecia siatka zdjec fotografie', podglad: svgKolazu(k.id),
    wstaw: (e, punkt) => e.dodajKolaz(k.id, { punkt }),
  })),
});


// Kody (#128, #134): kod QR i kod kreskowy EAN-13 / ISBN – ten sam element co z palety poleceń.
const PODGLAD_QR = '<svg viewBox="0 0 70 52" aria-hidden="true"><rect x="19" y="5" width="32" height="32" rx="1" class="tlo"/>'
  + '<path d="M22 8h9v9h-9zM39 8h9v9h-9zM22 25h9v9h-9zM34 20h3v3h-3zM39 25h3v3h-3zM44 30h4v4h-4zM34 30h3v4h-3zM40 20h8v2h-8z"/>'
  + '</svg>';
const PODGLAD_EAN = `<svg viewBox="0 0 70 52" aria-hidden="true"><rect x="10" y="6" width="50" height="38" rx="1" class="tlo"/>${
  [13, 15, 18, 20, 23, 26, 28, 31, 33, 36, 39, 41, 44, 47, 49, 52, 55].map((x, i) => `<rect x="${x}" y="9" width="${i % 3 ? 1.2 : 2}" height="${i === 0 || i === 8 || i === 16 ? 30 : 26}"/>`).join('')}</svg>`;
zarejestrujKategorie({
  id: 'kody', nazwa: 'Kody', ikona: 'kod', kolejnosc: 70,
  elementy: () => [
    { id: 'qr', nazwa: 'Kod QR', slowa: 'kod qr adres strona link wifi telefon e-mail', duzy: true, podglad: PODGLAD_QR, opis: 'Adres, tekst, e-mail, telefon, Wi-Fi – także z danych', wstaw: (e) => e.dodajKod('qr') },
    { id: 'ean', nazwa: 'Kod kreskowy EAN / ISBN', slowa: 'kod kreskowy ean isbn ksiazka okladka', duzy: true, podglad: PODGLAD_EAN, opis: 'Np. ISBN na okładkę książki', wstaw: (e) => e.dodajKod('ean') },
  ],
});

// Style tekstu (#131A, #134): style akapitu projektu. Kliknięcie nadaje styl zaznaczonemu tekstowi,
// a bez zaznaczonego tekstu wstawia nowy tekst w tym stylu. Style tworzy się i zmienia w panelu tekstu.
const escS = (t) => String(t ?? '').replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);
zarejestrujKategorie({
  id: 'style', nazwa: 'Style tekstu', ikona: 'tekst', kolejnosc: 65,
  elementy: () => ((typeof window !== 'undefined' && window.seriodruk?.stan?.projekt?.style) || []).map((st) => ({
    id: st.id, nazwa: st.nazwa, slowa: `styl tekst akapit ${st.fontFamily || ''}`, duzy: true,
    podglad: `<svg viewBox="0 0 70 52" aria-hidden="true"><text x="35" y="32" text-anchor="middle" style="font-family:'${escS(st.fontFamily || 'Inter')}';font-weight:${st.fontWeight === 'bold' ? 700 : 400};font-style:${st.fontStyle === 'italic' ? 'italic' : 'normal'}" font-size="18" fill="${escS(typeof st.fill === 'string' ? st.fill : 'currentColor')}">Aa</text></svg>`,
    opis: `${st.fontFamily || ''}${st.fontSize ? ` · ${Math.round(st.fontSize * 72 / 25.4)} pt` : ''}`,
    wstaw: async (e) => {
      const { zastosujStyl } = await import('./style-tekstu.js');
      let obj = e.aktywny;
      if (!obj || !/text/i.test(obj.type)) obj = e.dodajTekst();
      zastosujStyl(obj, st);
      obj.initDimensions?.();
      e.canvas.requestRenderAll();
      e.zatwierdz();
      return obj;
    },
  })),
});
