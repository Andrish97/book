// Kategorie biblioteki z partii #131A: kształty, strzałki i dymki, ozdobniki i ramki, kalendarze, wykresy,
// kolaże zdjęć. Rejestracja w js/biblioteka.js.

import { zarejestrujKategorie } from './biblioteka.js';
import { qrMacierz, ean13, STRAZNIKI_EAN } from './kody.js';
import { KSZTALTY, KOLAZE, svgKolazu, svgKsztaltu, wzorKresek } from './ksztalty-biblioteka.js';
import { SZABLONY, svgSzablonu } from './szablony-planera.js';

// Kształty z js/ksztalty-biblioteka.js w kategoriach okna; grupa kształtu (k.kategoria) to nagłówek w kategorii
// (#155). Nazwa grupy w oknie może być krótsza („Ramki proste” → „Proste”).
const NAZWY_GRUP = {
  'Ramki proste': 'Proste', 'Ramki zaokrąglone': 'Zaokrąglone', 'Ramki podwójne i przerywane': 'Podwójne i przerywane',
  'Ramki ozdobne': 'Ozdobne', 'Ramki z tytułem': 'Z miejscem na tytuł', 'Ramki w kształcie': 'W kształcie',
  'Na zdjęcie': 'Na zdjęcie – wstaw obraz do środka', Notatki: 'Siatki do notatek',
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
zarejestrujKategorie({ id: 'ksztalty', nazwa: 'Kształty', ikona: 'ksztalty', kolejnosc: 10, elementy: ksztaltyZ(...GRUPY_KATEGORII.ksztalty) });
zarejestrujKategorie({ id: 'strzalki', nazwa: 'Strzałki i dymki', ikona: 'strzalka', kolejnosc: 20, elementy: ksztaltyZ(...GRUPY_KATEGORII.strzalki) });
zarejestrujKategorie({ id: 'ramki', nazwa: 'Ramki', ikona: 'ramka', kolejnosc: 25, elementy: ksztaltyZ(...GRUPY_KATEGORII.ramki) });
zarejestrujKategorie({ id: 'ozdobniki', nazwa: 'Ozdobniki', ikona: 'ozdobnik', kolejnosc: 30, elementy: ksztaltyZ(...GRUPY_KATEGORII.ozdobniki) });
zarejestrujKategorie({ id: 'etykiety', nazwa: 'Etykiety i plakietki', ikona: 'etykieta', kolejnosc: 35, elementy: ksztaltyZ(...GRUPY_KATEGORII.etykiety) });

// Linie i separatory (#143): zwykłe linie – rodzaj, grubość i kolor zmienia się potem w panelu „Linia”.
const LINIE = [
  ['ciagla', 'Linia ciągła', 'linia prosta kreska', { grubosc: 0.5 }],
  ['cienka', 'Linia cienka', 'linia cienka wloskowa', { grubosc: 0.2 }],
  ['gruba', 'Linia gruba', 'linia gruba pogrubiona', { grubosc: 1.5 }],
  ['przerywana', 'Linia przerywana', 'linia przerywana kreski ciecie', { grubosc: 0.5, kreski: 'przerywana' }],
  ['kropkowana', 'Linia kropkowana', 'linia kropkowana kropki wypelnienie', { grubosc: 0.6, kreski: 'kropkowana' }],
  ['kreska-kropka', 'Linia kreska – kropka', 'linia kreska kropka os', { grubosc: 0.5, kreski: 'kreska-kropka' }],
  ['podwojna', 'Linia podwójna', 'linia podwojna separator', { grubosc: 0.3, podwojna: true }],
  ['pionowa', 'Linia pionowa', 'linia pionowa kolumna separator', { grubosc: 0.5, pionowa: true }],
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
  id: 'linie', nazwa: 'Linie i separatory', ikona: 'separator', kolejnosc: 32,
  elementy: () => [
    ...LINIE.map(([id, nazwa, slowa, opis]) => ({ id, nazwa, slowa: `${slowa} separator`, podglad: svgLinii(opis), grupa: 'Linie', wstaw: (e, punkt) => e.dodajLinieZBiblioteki({ ...opis, nazwa }, punkt) })),
    ...ksztaltyZ('Separatory ozdobne')(),
  ],
});

// Planer (#143, #155): gotowe tabele (lista zadań, tracker nawyków, plan tygodnia…) i siatki do notatek
// (kratka, kropki, linie). Luźne kształty (pola wyboru itp.) są w Kształtach → Znaki.
zarejestrujKategorie({
  id: 'planer', nazwa: 'Planer', ikona: 'planer', kolejnosc: 45,
  elementy: () => [
    ...SZABLONY.map((s) => ({
      id: s.id, nazwa: s.nazwa, slowa: `planer tabela ${s.slowa}`, duzy: true, podglad: svgSzablonu(s), opis: s.opis, grupa: 'Gotowe tabele',
      wstaw: (e, punkt) => e.dodajSzablonTabeli(s.id, punkt),
    })),
    ...ksztaltyZ('Notatki')(),
  ],
});

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

// Teksty (#131B): gotowe napisy po łuku, w okręgu i wygięte – zwykły tekst z kształtem (panel „Kształt tekstu”).
const TEKSTY = [
  ['luk', 'Napis po łuku', 'NAPIS PO ŁUKU', { rodzaj: 'luk', zgiecie: 45 }, '<path d="M10 40 Q35 4 60 40" class="linia"/>'],
  ['pieczec', 'Pieczęć – napis w okręgu', 'MAKIETKA • PIECZĘĆ • 2027 •', { rodzaj: 'okrag', strona: 'zewn' }, '<circle cx="35" cy="26" r="19" class="linia"/><circle cx="35" cy="26" r="12" class="linia"/>', 12],
  ['usmiech', 'Łuk w dół', 'UŚMIECHNIJ SIĘ', { rodzaj: 'luk', zgiecie: -45 }, '<path d="M10 12 Q35 48 60 12" class="linia"/>'],
  ['fala', 'Falisty baner', 'FALUJĄCY NAPIS', { rodzaj: 'fala', zgiecie: 60 }, '<path d="M6 26 C18 6 26 6 35 26 S52 46 64 26" class="linia"/>'],
  ['flaga', 'Flaga', 'NA WIETRZE', { rodzaj: 'flaga', zgiecie: 50 }, '<path d="M8 18 C20 8 30 28 42 18 S56 10 62 16 M8 34 C20 24 30 44 42 34 S56 26 62 32" class="linia"/>'],
  ['wypukly', 'Wypukły tytuł', 'TYTUŁ', { rodzaj: 'wypuklosc', zgiecie: 60 }, '<path d="M8 16 Q35 2 62 16 M8 36 Q35 50 62 36" class="linia"/>'],
  ['zwezenie', 'Zwężający się napis', 'PERSPEKTYWA', { rodzaj: 'zwezenie', zgiecie: 60 }, '<path d="M6 10 L64 20 M6 42 L64 32" class="linia"/>'],
];
zarejestrujKategorie({
  id: 'teksty', nazwa: 'Teksty', ikona: 'tekst', kolejnosc: 62,
  elementy: () => TEKSTY.map(([id, nazwa, tresc, ksztalt, svg, pt]) => ({
    id, nazwa, slowa: `tekst napis ${nazwa} luk okrag fala wygiecie`, duzy: true,
    podglad: `<svg viewBox="0 0 70 52" aria-hidden="true" class="podglad-wykresu">${svg}</svg>`,
    opis: 'Tekst po kształcie – zmienisz go w panelu „Kształt tekstu”',
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
  id: 'ksiazka', nazwa: 'Książka', ikona: 'ksiazka', kolejnosc: 68,
  elementy: () => [
    { id: 'spis', nazwa: 'Spis treści', slowa: 'spis tresci rozdzialy naglowki strony ksiazka', duzy: true, podglad: PODGLAD_SPISU, opis: 'Rozdziały z numerami stron – układa się sam', wstaw: (e, punkt) => e.dodajElementKsiazki('spis', punkt) },
    { id: 'skorowidz', nazwa: 'Skorowidz', slowa: 'skorowidz indeks hasla slowa ksiazka', duzy: true, podglad: PODGLAD_SKOROWIDZA, opis: 'Hasła alfabetycznie z numerami stron', wstaw: (e, punkt) => e.dodajElementKsiazki('skorowidz', punkt) },
  ],
});

// Moje elementy (#131C): elementy zapisane z zaznaczenia („Zapisz w bibliotece”), z konta – w każdym projekcie.
// Lista jest w pamięci (js/moje-elementy.js); okno odświeża ją przy otwarciu (odswiez) i po każdej zmianie.
// Lista i operacje podpina aplikacja (js/app/moje-elementy-okno.js) – tu bez zależności od interfejsu.
export const MOJE = { lista: [], zmienNazwe: null, usun: null };
const escM = (t) => String(t ?? '').replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);
zarejestrujKategorie({
  id: 'moje', nazwa: 'Moje elementy', ikona: 'zapisz_w_bibliotece', kolejnosc: 5,
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
      { ikona: 'olowek', nazwa: 'Zmień nazwę', fn: () => MOJE.zmienNazwe?.(m) },
      { ikona: 'kosz', nazwa: 'Usuń z biblioteki', fn: () => MOJE.usun?.(m) },
    ],
  })),
});

// Marka (#131D): logo z zestawu marki (konto) do wstawienia, edycja zestawu i zastosowanie do projektu.
const PODGLAD_MARKI = '<svg viewBox="0 0 70 52" aria-hidden="true"><rect x="8" y="10" width="54" height="32" rx="4" class="tlo"/><path d="M35 15l3.3 6.7 7.4 1.1-5.4 5.2 1.3 7.3L35 31.9l-6.6 3.4 1.3-7.3-5.4-5.2 7.4-1.1z"/></svg>';
const markaZKonta = () => { try { return globalThis.makietkaMarka || null; } catch { return null; } };
zarejestrujKategorie({
  id: 'marka', nazwa: 'Marka', ikona: 'marka', kolejnosc: 66,
  elementy: () => {
    const m = markaZKonta();
    const loga = (m?.loga || []).map((l) => ({
      id: `logo-${l.id}`, nazwa: l.nazwa, slowa: 'logo marka znak', duzy: true,
      podglad: l.podglad ? `<img src="${l.podglad.replace(/"/g, '&quot;')}" alt="">` : PODGLAD_MARKI,
      opis: 'Logo z zestawu marki',
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
      { id: 'zastosuj', nazwa: 'Zastosuj markę do projektu…', slowa: 'marka kolory czcionki zamien', duzy: true, podglad: PODGLAD_MARKI, opis: 'Kolory i czcionki projektu → marki', wstaw: async () => { (await import('./app/marka-zastosuj.js')).otworzZastosowanieMarki(); return null; } },
      { id: 'edytuj', nazwa: 'Edytuj zestaw marki…', slowa: 'marka zestaw kolory czcionki logo', duzy: true, podglad: PODGLAD_MARKI, opis: 'Kolory, czcionki i logo na koncie', wstaw: async () => { (await import('./marka-okno.js')).otworzMarke(); return null; } },
    ];
  },
});

// Gotowe sekcje (#166) – kategoria w osobnym module.
import './biblioteka-gotowe-sekcje.js';
