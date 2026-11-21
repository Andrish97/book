// Kategorie biblioteki z partii #131A: kształty, strzałki i dymki, ozdobniki i ramki, kalendarze, wykresy,
// kolaże zdjęć. Rejestracja w js/biblioteka.js.

import { zarejestrujKategorie } from './biblioteka.js';
import { qrMacierz, ean13, STRAZNIKI_EAN } from './kody.js';
import { KSZTALTY, KOLAZE, svgKolazu, svgKsztaltu, wzorKresek } from './ksztalty-biblioteka.js';
import { SZABLONY, SZABLONY_FORMULARZY, svgSzablonu } from './szablony-planera.js';
import { elementZeSkladu, rysunek } from './biblioteka-sklad.js';
import { IKONY } from './ikony-biblioteki.js';
import { TLA } from './wzory-tla.js';
import { NAGLOWKI, BLOKI, INFOGRAFIKI, FORMULARZE, OKOLICZNOSCIOWE, ILUSTRACJE, UKLADY, PLANER_SKLADY } from './biblioteka-kompozycje.js';

// Kształty z js/ksztalty-biblioteka.js w kategoriach okna; grupa kształtu (k.kategoria) to nagłówek w kategorii
// (#155). Nazwa grupy w oknie może być krótsza („Ramki proste” → „Proste”).
const NAZWY_GRUP = {
  'Ramki proste': tt('bibliotekaElementy.proste'), 'Ramki zaokrąglone': tt('bibliotekaElementy.zaokraglone'), 'Ramki podwójne i przerywane': tt('bibliotekaElementy.podwojneIPrzerywane'),
  'Ramki ozdobne': tt('bibliotekaElementy.ozdobne'), 'Ramki z tytułem': tt('bibliotekaElementy.zMiejscemNaTytul'), 'Ramki w kształcie': tt('bibliotekaElementy.wKsztalcie'),
  'Na zdjęcie': tt('bibliotekaElementy.naZdjecieWstawObraz'), Notatki: tt('bibliotekaElementy.siatkiDoNotatek'),
};
const ksztaltyZ = (...grupy) => () => grupy.flatMap((g) => KSZTALTY.filter((k) => k.kategoria === g)).map((k) => ({
  id: k.id, nazwa: k.nazwa, slowa: `${k.slowa} ${k.kategoria}`, podglad: svgKsztaltu(k), grupa: NAZWY_GRUP[k.kategoria] || k.kategoria,
  wstaw: (e, punkt) => e.dodajKsztaltZBiblioteki(k.id, punkt),
}));

// Grupy kształtów w kategoriach okna (kolejność = kolejność nagłówków).
export const GRUPY_KATEGORII = {
  ksztalty: ['Podstawowe', 'Wielokąty', 'Gwiazdy i odznaki', 'Serca i natura', 'Symbole i ikony', 'Okolicznościowe', 'Znaki'],
  strzalki: ['Strzałki', 'Dymki'],
  ramki: ['Ramki proste', 'Ramki zaokrąglone', 'Ramki podwójne i przerywane', 'Ramki ozdobne', 'Ramki z tytułem', 'Ramki w kształcie', 'Na zdjęcie', 'Kartki i notatki', 'Obramowania stron'],
  ozdobniki: ['Wstęgi i banery', 'Narożniki', 'Rozety i ornamenty'],
  etykiety: ['Etykiety'],
};
zarejestrujKategorie({ id: 'ksztalty', nazwa: tt('bibliotekaElementy.ksztalty'), ikona: 'ksztalty', kolejnosc: 10, elementy: ksztaltyZ(...GRUPY_KATEGORII.ksztalty) });
zarejestrujKategorie({ id: 'strzalki', nazwa: tt('bibliotekaElementy.strzalkiIDymki'), ikona: 'strzalka', kolejnosc: 20, elementy: ksztaltyZ(...GRUPY_KATEGORII.strzalki) });
zarejestrujKategorie({ id: 'ramki', nazwa: tt('bibliotekaElementy.ramki'), ikona: 'ramka', kolejnosc: 25, elementy: ksztaltyZ(...GRUPY_KATEGORII.ramki) });
zarejestrujKategorie({ id: 'ozdobniki', nazwa: tt('bibliotekaElementy.ozdobniki'), ikona: 'ozdobnik', kolejnosc: 30, elementy: ksztaltyZ(...GRUPY_KATEGORII.ozdobniki) });
zarejestrujKategorie({ id: 'etykiety', nazwa: tt('bibliotekaElementy.etykietyIPlakietki'), ikona: 'etykieta', kolejnosc: 35, elementy: ksztaltyZ(...GRUPY_KATEGORII.etykiety) });

// Linie i separatory (#143): zwykłe linie – rodzaj, grubość i kolor zmienia się potem w panelu „Linia”.
const LINIE = [
  ['ciagla', tt('bibliotekaElementy.liniaCiagla'), 'linia prosta kreska', { grubosc: 0.5 }],
  ['cienka', tt('bibliotekaElementy.liniaCienka'), 'linia cienka wloskowa', { grubosc: 0.2 }],
  ['gruba', tt('bibliotekaElementy.liniaGruba'), 'linia gruba pogrubiona', { grubosc: 1.5 }],
  ['przerywana', tt('bibliotekaElementy.liniaPrzerywana'), 'linia przerywana kreski ciecie', { grubosc: 0.5, kreski: 'przerywana' }],
  ['kropkowana', tt('bibliotekaElementy.liniaKropkowana'), 'linia kropkowana kropki wypelnienie', { grubosc: 0.6, kreski: 'kropkowana' }],
  ['kreska-kropka', tt('bibliotekaElementy.liniaKreskaKropka'), 'linia kreska kropka os', { grubosc: 0.5, kreski: 'kreska-kropka' }],
  ['podwojna', tt('bibliotekaElementy.liniaPodwojna'), 'linia podwojna separator', { grubosc: 0.3, podwojna: true }],
  ['pionowa', tt('bibliotekaElementy.liniaPionowa'), 'linia pionowa kolumna separator', { grubosc: 0.5, pionowa: true }],
];
const svgLinii = ({ grubosc = 0.5, kreski = 'ciagla', podwojna, pionowa }) => {
  const g = Math.max(0.6, grubosc * 3);
  const wzor = wzorKresek(kreski, grubosc);
  const kr = wzor ? `;stroke-dasharray:${wzor.map((x) => x * 3 || 0.01).join(' ')}` : '';
  // Styl w atrybucie: ogólna reguła podglądów (grubość 3, zaokrąglone końce) nie może go przykryć.
  const styl = `stroke-width:${g};stroke-linecap:${['kropkowana', 'kreska-kropka'].includes(kreski) ? 'round' : 'butt'}${kr}`;
  const odc = (o) => (pionowa ? `M ${35 + o} 6 V 46` : `M 6 ${26 + o} H 64`);
  const d = podwojna ? `${odc(-2.5)} ${odc(2.5)}` : odc(0);
  return `<svg viewBox="0 0 70 52" aria-hidden="true"><path d="${d}" class="linia-biblioteki" style="${styl}"/></svg>`;
};
zarejestrujKategorie({
  id: 'linie', nazwa: tt('bibliotekaElementy.linieISeparatory'), ikona: 'separator', kolejnosc: 32,
  elementy: () => [
    ...LINIE.map(([id, nazwa, slowa, opis]) => ({ id, nazwa, slowa: `${slowa} separator`, podglad: svgLinii(opis), grupa: tt('bibliotekaElementy.linie'), wstaw: (e, punkt) => e.dodajLinieZBiblioteki({ ...opis, nazwa }, punkt) })),
    ...ksztaltyZ('Separatory ozdobne')(),
  ],
});

const tabelaSzablonu = (s) => ({
  id: s.id, nazwa: s.nazwa, slowa: `planer tabela ${s.slowa}`, duzy: true, podglad: svgSzablonu(s), opis: s.opis, grupa: s.grupa,
  wstaw: (e, punkt) => e.dodajSzablonTabeli(s.id, punkt),
});

// Planer (#143, #155): gotowe tabele (lista zadań, tracker nawyków, plan tygodnia…) i siatki do notatek
// (kratka, kropki, linie). Luźne kształty (pola wyboru itp.) są w Kształtach → Znaki.
zarejestrujKategorie({
  id: 'planer', nazwa: tt('bibliotekaElementy.planer'), ikona: 'planer', kolejnosc: 45,
  elementy: () => [
    ...SZABLONY.filter((s) => s.grupa === 'Gotowe tabele').map(tabelaSzablonu),
    ...PLANER_SKLADY.map((el) => elementZeSkladu(el)),
    ...SZABLONY.filter((s) => s.grupa !== 'Gotowe tabele').map(tabelaSzablonu),
    ...ksztaltyZ('Notatki')(),
  ],
});

// Kalendarze: ten sam element w trzech gotowych ustawieniach.
const KALENDARZE = [
  ['zwykly', tt('bibliotekaElementy.kalendarzMiesiaca'), 'siatka dni swieta', {}],
  ['notatki', tt('bibliotekaElementy.kalendarzZMiejscemNa'), 'planer notatki duzy', { notatki: true, wiersz_dnia: 18 }],
  ['tygodnie', tt('bibliotekaElementy.kalendarzZNumeramiTygodni'), 'tydzien numery tygodni', { tygodnie: true, nazwy: 'litery' }],
];
const podgladKalendarza = (notatki) => `<svg viewBox="0 0 70 52" aria-hidden="true"><rect x="2" y="2" width="66" height="48" rx="2" class="tlo"/><rect x="2" y="2" width="66" height="9" class="pasek"/>${
  Array.from({ length: 35 }, (_, i) => `<rect x="${4 + (i % 7) * 9}" y="${13 + Math.floor(i / 7) * 7.2}" width="${notatki ? 8 : 6}" height="${notatki ? 6.4 : 4}" rx="0.6" class="${i % 7 === 6 ? 'nd' : 'dz'}"/>`).join('')}</svg>`;
zarejestrujKategorie({
  id: 'kalendarze', nazwa: tt('bibliotekaElementy.kalendarze'), ikona: 'kalendarz', kolejnosc: 40,
  elementy: () => KALENDARZE.map(([id, nazwa, slowa, opis]) => ({
    id, nazwa, slowa: `kalendarz miesiac ${slowa}`, duzy: true, podglad: podgladKalendarza(opis.notatki),
    opis: tt('bibliotekaElementy.miesiacStalyAlboZ'), wstaw: (e, punkt) => e.dodajKalendarz(opis, punkt),
  })),
});

// Wykresy: rodzaje; dane z pierwszej tabeli projektu (zmienia się w panelu).
const WYKRESY = [
  ['slupki', tt('bibliotekaElementy.wykresSlupkowy'), '<path d="M8 44h54"/><rect x="12" y="24" width="9" height="20"/><rect x="27" y="12" width="9" height="32"/><rect x="42" y="18" width="9" height="26"/>'],
  ['poziome', tt('bibliotekaElementy.wykresPoziomy'), '<path d="M10 6v40"/><rect x="10" y="9" width="40" height="8"/><rect x="10" y="21" width="28" height="8"/><rect x="10" y="33" width="48" height="8"/>'],
  ['linia', tt('bibliotekaElementy.wykresLiniowy'), '<path d="M8 44h54"/><path d="M10 36 24 22l12 8 22-20" class="linia"/>'],
  ['kolo', tt('bibliotekaElementy.wykresKolowy'), '<path d="M35 26V6a20 20 0 1 1-17.3 30z"/><path d="M35 26 17.7 36A20 20 0 0 1 35 6z" class="drugi"/>'],
  ['pierscien', tt('bibliotekaElementy.wykresPierscieniowy'), '<path d="M35 6a20 20 0 1 1-17.3 30l7.8-4.5A11 11 0 1 0 35 15z"/><path d="M17.7 36A20 20 0 0 1 35 6v9a11 11 0 0 0-9.5 16.5z" class="drugi"/>'],
];
let opisWykresuDomyslny = () => ({});
export function ustawDomyslneDaneWykresu(fn) { opisWykresuDomyslny = fn; }
zarejestrujKategorie({
  id: 'wykresy', nazwa: tt('bibliotekaElementy.wykresy'), ikona: 'wykres', kolejnosc: 50,
  elementy: () => WYKRESY.map(([rodzaj, nazwa, svg]) => ({
    id: rodzaj, nazwa, slowa: 'wykres dane liczby diagram', duzy: true,
    podglad: `<svg viewBox="0 0 70 52" aria-hidden="true" class="podglad-wykresu">${svg}</svg>`,
    opis: tt('bibliotekaElementy.zTabeliDanychProjektu'), wstaw: (e, punkt) => e.dodajWykres({ ...opisWykresuDomyslny(), rodzaj }, punkt),
  })),
});

zarejestrujKategorie({
  id: 'kolaze', nazwa: tt('bibliotekaElementy.kolazeZdjec'), ikona: 'kolaz', kolejnosc: 60,
  elementy: () => KOLAZE.map((k) => ({
    id: k.id, nazwa: tt('bibliotekaElementy.kolaz', { nazwa: k.nazwa }), slowa: 'kolaz zdjecia siatka zdjec fotografie', podglad: svgKolazu(k.id),
    wstaw: (e, punkt) => e.dodajKolaz(k.id, { punkt }),
  })),
});


// Kody (#128, #134): kod QR i kod kreskowy EAN-13 / ISBN – ten sam element co z palety poleceń.
// Podglądy kodów rysowane prawdziwym generatorem (js/kody.js): QR z adresu i EAN-13 z przykładowego numeru.
function podgladQR() {
  const { rozmiar: n, moduly } = qrMacierz('makietka.app', 'L');
  const m = 42 / n; const x0 = 35 - 21; const y0 = 26 - 21;
  let r = '';
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) if (moduly[y][x]) r += `<rect class="kod-modul" x="${(x0 + x * m).toFixed(2)}" y="${(y0 + y * m).toFixed(2)}" width="${(m + 0.05).toFixed(2)}" height="${(m + 0.05).toFixed(2)}"/>`;
  return `<svg viewBox="0 0 70 52" aria-hidden="true"><rect class="kod-tlo" x="${x0 - 3}" y="${y0 - 3}" width="48" height="48" rx="2"/>${r}</svg>`;
}
function podgladEAN() {
  const { moduly } = ean13('590123412345');
  const m = 54 / moduly.length; const x0 = 8;
  let r = '';
  moduly.forEach((b, i) => { if (b) r += `<rect class="kod-modul" x="${(x0 + i * m).toFixed(2)}" y="7" width="${(m + 0.04).toFixed(2)}" height="${STRAZNIKI_EAN.has(i) ? 36 : 32}"/>`; });
  return `<svg viewBox="0 0 70 52" aria-hidden="true"><rect class="kod-tlo" x="4" y="3" width="62" height="46" rx="2"/>${r}<text class="kod-cyfry" x="35" y="47" text-anchor="middle">5 901234 123457</text></svg>`;
}
const PODGLAD_QR = podgladQR();
const PODGLAD_EAN = podgladEAN();
zarejestrujKategorie({
  id: 'kody', nazwa: tt('bibliotekaElementy.kody'), ikona: 'kod', kolejnosc: 70,
  elementy: () => [
    { id: 'qr', nazwa: tt('bibliotekaElementy.kodQr'), slowa: 'kod qr adres strona link wifi telefon e-mail', duzy: true, podglad: PODGLAD_QR, opis: tt('bibliotekaElementy.adresTekstEMail'), wstaw: (e) => e.dodajKod('qr') },
    { id: 'ean', nazwa: tt('bibliotekaElementy.kodKreskowyEanIsbn'), slowa: 'kod kreskowy ean isbn ksiazka okladka', duzy: true, podglad: PODGLAD_EAN, opis: tt('bibliotekaElementy.npIsbnNaOkladke'), wstaw: (e) => e.dodajKod('ean') },
  ],
});

// Style tekstu (#131A, #134): style akapitu projektu. Kliknięcie nadaje styl zaznaczonemu tekstowi,
// a bez zaznaczonego tekstu wstawia nowy tekst w tym stylu. Style tworzy się i zmienia w panelu tekstu.
const escS = (t) => String(t ?? '').replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);
zarejestrujKategorie({
  id: 'style', nazwa: tt('bibliotekaElementy.styleTekstu'), ikona: 'tekst', kolejnosc: 65,
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

// Teksty (#131B): gotowe napisy po łuku, w okręgu i wygięte – zwykły tekst z kształtem (panel „Kształt tekstu”).
const TEKSTY = [
  ['luk', tt('bibliotekaElementy.napisPoLuku'), 'NAPIS PO ŁUKU', { rodzaj: 'luk', zgiecie: 45 }, '<path d="M10 40 Q35 4 60 40" class="linia"/>'],
  ['pieczec', tt('bibliotekaElementy.pieczecNapisWOkregu'), 'MAKIETKA • PIECZĘĆ • 2027 •', { rodzaj: 'okrag', strona: 'zewn' }, '<circle cx="35" cy="26" r="19" class="linia"/><circle cx="35" cy="26" r="12" class="linia"/>', 12],
  ['usmiech', tt('bibliotekaElementy.lukWDol'), 'UŚMIECHNIJ SIĘ', { rodzaj: 'luk', zgiecie: -45 }, '<path d="M10 12 Q35 48 60 12" class="linia"/>'],
  ['fala', tt('bibliotekaElementy.falistyBaner'), 'FALUJĄCY NAPIS', { rodzaj: 'fala', zgiecie: 60 }, '<path d="M6 26 C18 6 26 6 35 26 S52 46 64 26" class="linia"/>'],
  ['flaga', tt('bibliotekaElementy.flaga'), 'NA WIETRZE', { rodzaj: 'flaga', zgiecie: 50 }, '<path d="M8 18 C20 8 30 28 42 18 S56 10 62 16 M8 34 C20 24 30 44 42 34 S56 26 62 32" class="linia"/>'],
  ['wypukly', tt('bibliotekaElementy.wypuklyTytul'), 'TYTUŁ', { rodzaj: 'wypuklosc', zgiecie: 60 }, '<path d="M8 16 Q35 2 62 16 M8 36 Q35 50 62 36" class="linia"/>'],
  ['zwezenie', tt('bibliotekaElementy.zwezajacySieNapis'), 'PERSPEKTYWA', { rodzaj: 'zwezenie', zgiecie: 60 }, '<path d="M6 10 L64 20 M6 42 L64 32" class="linia"/>'],
];
zarejestrujKategorie({
  id: 'teksty', nazwa: tt('bibliotekaElementy.teksty'), ikona: 'tekst', kolejnosc: 62,
  elementy: () => TEKSTY.map(([id, nazwa, tresc, ksztalt, svg, pt]) => ({
    id, nazwa, slowa: `tekst napis ${nazwa} luk okrag fala wygiecie`, duzy: true,
    podglad: `<svg viewBox="0 0 70 52" aria-hidden="true" class="podglad-wykresu">${svg}</svg>`,
    opis: tt('bibliotekaElementy.tekstPoKsztalcieZmienisz'),
    wstaw: (e, punkt) => e.dodajTekstWKsztalcie(tresc, ksztalt, punkt, { rozmiarPt: pt || 20 }),
  })),
});

// Książka (#131B): spis treści i skorowidz – teksty, które składają się same.
const PODGLAD_SPISU = '<svg viewBox="0 0 70 52" aria-hidden="true"><rect x="8" y="5" width="54" height="42" rx="1" class="tlo"/>'
  + '<path d="M13 13h22M13 21h18M17 27h16M13 35h20" class="linia"/><path d="M38 13h14M35 21h17M37 27h15M37 35h15" class="kropki"/>'
  + '<path d="M54 11h3v4h-3zM54 19h3v4h-3zM54 25h3v4h-3zM54 33h3v4h-3z"/></svg>';
const PODGLAD_SKOROWIDZA = '<svg viewBox="0 0 70 52" aria-hidden="true"><rect x="8" y="5" width="54" height="42" rx="1" class="tlo"/>'
  + '<path d="M13 12h4v5h-4z"/><path d="M13 22h16M13 28h20M13 34h14M13 40h18" class="linia"/><path d="M44 22h12M44 28h12M44 34h12M44 40h12" class="kropki"/></svg>';
zarejestrujKategorie({
  id: 'ksiazka', nazwa: tt('bibliotekaElementy.ksiazka'), ikona: 'ksiazka', kolejnosc: 68,
  elementy: () => [
    { id: 'spis', nazwa: tt('bibliotekaElementy.spisTresci'), slowa: 'spis tresci rozdzialy naglowki strony ksiazka', duzy: true, podglad: PODGLAD_SPISU, opis: tt('bibliotekaElementy.rozdzialyZNumeramiStron'), wstaw: (e, punkt) => e.dodajElementKsiazki('spis', punkt) },
    { id: 'skorowidz', nazwa: tt('bibliotekaElementy.skorowidz'), slowa: 'skorowidz indeks hasla slowa ksiazka', duzy: true, podglad: PODGLAD_SKOROWIDZA, opis: tt('bibliotekaElementy.haslaAlfabetycznieZNumerami'), wstaw: (e, punkt) => e.dodajElementKsiazki('skorowidz', punkt) },
  ],
});

// Moje elementy (#131C): elementy zapisane z zaznaczenia („Zapisz w bibliotece”), z konta – w każdym projekcie.
// Lista jest w pamięci (js/moje-elementy.js); okno odświeża ją przy otwarciu (odswiez) i po każdej zmianie.
// Lista i operacje podpina aplikacja (js/app/moje-elementy-okno.js) – tu bez zależności od interfejsu.
export const MOJE = { lista: [], zmienNazwe: null, usun: null };
const escM = (t) => String(t ?? '').replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);
zarejestrujKategorie({
  id: 'moje', nazwa: tt('bibliotekaElementy.mojeElementy'), ikona: 'zapisz_w_bibliotece', kolejnosc: 5,
  pusto: 'Tu trafią Twoje elementy. Zaznacz element albo kilka na stronie i wybierz „Zapisz w bibliotece” (we właściwościach, obok Kopiuj i Duplikuj) – będzie pod ręką w każdym projekcie.',
  odswiez: async () => (await import('./moje-elementy.js')).wczytajMojeElementy(),
  elementy: () => (MOJE.lista || []).map((m) => ({
    id: m.id, nazwa: m.nazwa, slowa: 'moje zapisane wlasne', duzy: true,
    podglad: m.podglad ? `<img src="${escM(m.podglad)}" alt="">` : '<svg viewBox="0 0 70 52" aria-hidden="true"><rect x="12" y="8" width="46" height="36" rx="3" class="tlo"/></svg>',
    opis: m.szer ? `${Math.round(m.szer)} × ${Math.round(m.wys)} mm` : '',
    wstaw: async (e, punkt) => {
      const projekt = typeof window !== 'undefined' ? window.seriodruk?.stan?.projekt : null;
      if (!projekt) return null;
      const { mojElementDoWstawienia } = await import('./moje-elementy.js');
      const dane = await mojElementDoWstawienia(m.id, projekt);
      return e.wstawElementZBiblioteki(dane, projekt.zasoby, punkt);
    },
    akcje: [
      { ikona: 'olowek', nazwa: tt('bibliotekaElementy.zmienNazwe'), fn: () => MOJE.zmienNazwe?.(m) },
      { ikona: 'kosz', nazwa: tt('bibliotekaElementy.usunZBiblioteki'), fn: () => MOJE.usun?.(m) },
    ],
  })),
});

// Marka (#131D): logo z zestawu marki (konto) do wstawienia, edycja zestawu i zastosowanie do projektu.
const PODGLAD_MARKI = '<svg viewBox="0 0 70 52" aria-hidden="true"><rect x="8" y="10" width="54" height="32" rx="4" class="tlo"/><path d="M35 15l3.3 6.7 7.4 1.1-5.4 5.2 1.3 7.3L35 31.9l-6.6 3.4 1.3-7.3-5.4-5.2 7.4-1.1z"/></svg>';
const markaZKonta = () => { try { return globalThis.makietkaMarka || null; } catch { return null; } };
zarejestrujKategorie({
  id: 'marka', nazwa: tt('bibliotekaElementy.marka'), ikona: 'marka', kolejnosc: 66,
  elementy: () => {
    const m = markaZKonta();
    const loga = (m?.loga || []).map((l) => ({
      id: `logo-${l.id}`, nazwa: l.nazwa, slowa: 'logo marka znak', duzy: true,
      podglad: l.podglad ? `<img src="${l.podglad.replace(/"/g, '&quot;')}" alt="">` : PODGLAD_MARKI,
      opis: tt('bibliotekaElementy.logoZZestawuMarki'),
      wstaw: async (e) => {
        const [{ plikLogo }, { przyjmijPlik }] = await Promise.all([import('./zestaw-marki.js'), import('./obrazy-projektu.js')]);
        const { blob, nazwa } = await plikLogo(l.id);
        const projekt = globalThis.seriodruk.stan.projekt;
        const { id, nazwa: n } = await przyjmijPlik(projekt, blob, nazwa);
        return e.dodajObraz(null, n, projekt.zasoby, { id });
      },
    }));
    return [
      ...loga,
      { id: 'zastosuj', nazwa: tt('bibliotekaElementy.zastosujMarkeDoProjektu'), slowa: 'marka kolory czcionki zamien', duzy: true, podglad: PODGLAD_MARKI, opis: tt('bibliotekaElementy.koloryICzcionkiProjektu'), wstaw: async () => { (await import('./app/marka-zastosuj.js')).otworzZastosowanieMarki(); return null; } },
      { id: 'edytuj', nazwa: tt('bibliotekaElementy.edytujZestawMarki'), slowa: 'marka zestaw kolory czcionki logo', duzy: true, podglad: PODGLAD_MARKI, opis: tt('bibliotekaElementy.koloryCzcionkiILogo'), wstaw: async () => { (await import('./marka-okno.js')).otworzMarke(); return null; } },
    ];
  },
});

// ---------- Nowe działy (#162) ----------
// Ikony liniowe: spójny zestaw 24 × 24 (js/ikony-biblioteki.js) w grupach tematycznych.
const ROZMIAR_IKONY = 14;
const ELEMENTY_IKON = Object.entries(IKONY).flatMap(([grupa, lista]) => lista.map(([id, nazwa, slowa, d]) => ({
  id: `ikona-${id}`, nazwa, slowa: `ikona ${slowa} ${grupa}`, grupa, buduj: () => rysunek(d, ROZMIAR_IKONY, { nazwa: tt('bibliotekaElementy.ikona', { nazwa }) }),
})).map((el) => elementZeSkladu(el)));
zarejestrujKategorie({ id: 'ikony', nazwa: tt('bibliotekaElementy.ikony'), ikona: 'ikony', kolejnosc: 12, elementy: () => ELEMENTY_IKON });

const kategoriaSkladow = (id, nazwa, ikona, kolejnosc, lista, grupa) => {
  const elementy = lista.map((el) => elementZeSkladu(el, grupa));
  zarejestrujKategorie({ id, nazwa, ikona, kolejnosc, elementy: () => elementy });
};
// Duże kafelki (z nazwą) tam, gdzie sam rysunek nie mówi wszystkiego.
const duze = (lista) => lista.map((el) => ({ ...el, duzy: true }));
kategoriaSkladow('ilustracje', 'Ilustracje', 'ilustracja', 14, ILUSTRACJE, 'Rysunki liniowe');
kategoriaSkladow('okolicznosciowe', 'Okolicznościowe', 'okolicznosc', 36, duze(OKOLICZNOSCIOWE));
kategoriaSkladow('tla', 'Tła i wzory', 'tlo', 38, TLA.map((el) => ({ ...el, kontekstPodgladu: { w: 54, h: 76, spad: 0, szer: 46, wysTresci: 66, akcent: '#2f5d8a', akcent2: '#c08a2e' } })));
kategoriaSkladow('infografiki', 'Infografiki', 'infografika', 52, duze(INFOGRAFIKI), 'Schematy i liczby');
kategoriaSkladow('naglowki', 'Nagłówki i tytuły', 'naglowek', 61, duze(NAGLOWKI), 'Tytuły');
kategoriaSkladow('bloki', 'Bloki treści', 'blok', 63, duze(BLOKI), 'Ramki i listy');
kategoriaSkladow('uklady', 'Układy stron', 'uklad', 64, duze(UKLADY), 'Całe strony');
// Tabele formularzy dopisane do kategorii formularzy (zwykła tabela – jak w Planerze).
{
  const formularze = [...FORMULARZE.map((el) => elementZeSkladu({ ...el, duzy: true }, 'Pola i podpisy')), ...SZABLONY_FORMULARZY.map(tabelaSzablonu)];
  zarejestrujKategorie({ id: 'formularze', nazwa: tt('bibliotekaElementy.formularzeDoDruku'), ikona: 'formularz', kolejnosc: 47, elementy: () => formularze });
}

// Gotowe sekcje (#166) – kategoria w osobnym module.
import './biblioteka-gotowe-sekcje.js';
import { t as tt } from './jezyk.js';
