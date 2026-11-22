// Część aplikacji z edytorem: spina moduły edytora z js/app/, podpina przyciski edytora (data-akcja),
// zdarzenia płótna i skróty klawiszowe. Wczytuje ją js/app/doczytaj.js – w tle po pokazaniu listy projektów
// albo przy otwarciu projektu – razem z biblioteką płótna. Lekka część startowa to js/aplikacja.js.
//
// Moduły w js/app/:
//   kontekst.js         wspólny stan (otwarty projekt, edytor, historia) – od niego zależą pozostałe
//   edytor-instancja.js tworzy edytor; musi wykonać się przed modułami, które go używają (pierwszy import niżej)
//   skladniki.js        stałe części ekranu: panel właściwości, linijki, warstwy, okno danych, podgląd
//   zapis.js            płótno ↔ projekt, zapis w przeglądarce i na koncie, cofanie
//   trasy.js            adresy podstron (#/projekty, #/p/<id>/s/<id strony>…)
//   logowanie.js        ekran logowania i wylogowanie
//   projekty.js         ekran „Projekty”, nowy projekt, pliki .makietka
//   lista-stron.js      lista stron i wzorców, miniatury, operacje na stronach
//   sekcje.js           okno ustawień sekcji
//   wzorce.js           operacje na wzorcach
//   panel-strony.js     panel właściwości strony i wzorca, pola do wstawienia
//   podglad-ekran.js    podgląd bez edycji i udostępnianie linkiem
//   udostepnione.js     podgląd otwarty z linku (lekki, bez edytora)
//   doczytaj.js         doczytywanie tej części

import './edytor-instancja.js';
import './obecnosc.js'; // kto jeszcze jest w projekcie (współpraca)
import { otworzKomentarze, narzedzieKomentarz } from './komentarze.js'; // komentarze na stronach (#131D)
import { obsluzAkcje, podlaczSkladanke } from './skladanka-narzedzia.js'; // narzędzia składanki (#233)
import { obsluzAkcjeKomiksu, podlaczKomiks } from './komiks-narzedzia.js'; // narzędzia komiksu (#364)
import { oknoGenerowania } from './generuj-obraz.js'; // obraz z AI (#372)
import { oknoTekstuAi, oknoKolumnyAi } from './tekst-ai.js'; // tekst z AI (#373)
dane.wypelnijKolumneAi = oknoKolumnyAi; // ✦ przy kolumnie w oknie Dane (#373)
import { toZaznaczenie } from '../fabric-ustawienia.js';
import { opisObiektu, WIELOKATY, podgladWielokata } from '../edytor.js';
import { obrazyZeSchowka, uporzadkujPlikSvg } from '../wklejanie.js';
import { przyjmijPlik } from '../obrazy-projektu.js';
import { wybierzZrodloObrazu } from './zrodlo-obrazu.js';
import { OknoKontroli } from '../okno-kontroli.js';
import { otworzKoloryDruku, zamienKoloryNaDozwolone } from './kolory-druku-okno.js';
import { stanUszlachetnien, ustawPokazUszlachetnien } from '../kolory-druku.js';
import { obsluzKlawisz } from '../skroty.js';
import { ikona } from '../ikony.js';
import { $, powiadom, pobierz, bezpiecznaNazwa, zamknijMenu, przelaczMenu } from '../ui.js';
import { zPostepem } from '../postep.js';
import { NAZWA } from '../marka.js';
import { domyslneStyle } from '../style-tekstu.js';
import { stan, edytor, biezacyCel, biezacaSekcja, jednaStrona, KLUCZ_JEDNA } from './kontekst.js';
import { podlaczArkusze } from './arkusze.js';
import { wlaczWygladEdytora } from './wyglad-edytora.js';
import { wczytajPlikProjektu } from './projekty.js';
import {
  naPlotnie, zapiszBiezacyCel, cofnijKrok, zaplanujZapis, wybierzStroneArkusza, zaladujCel,
  zapiszTeraz, zapiszPrzyZamknieciu, synchronizuj, zaplanujChmure, stanZapisu, sprawdzKonto, otworzProjekt, odlaczPlotno, odswiezKsiazke,
} from './zapis.js';
import {
  pokazPodglad, otworzUdostepnianie, opublikujUdostepnienie, wylaczUdostepnienie,
  kopiujLinkUdostepnienia, zamknijPodglad, zapiszOchroneLinku, zapiszZnakWodny, zapiszMakieteLinku,
} from './podglad-ekran.js';
import { NAZWY_POL_DOKUMENTU, tabeleStrony } from './panel-strony.js';
import { polePoTabelach } from '../serie.js';
import { panel, instrukcja, podglad, dane, menuWidoku, oknoCzcionek, podmiana, ustawPisowniePanelu } from './skladniki.js';
import {
  dodajStrone, indeksZMenu, zmienNazweStrony, duplikujStrone, usunStrone, przesunStrone, sekcjaZMenu,
  wzorzecZMenu, przeniesStrone, przejdzDoStrony, piszNaInnejStronie, dokladajStrony,
} from './lista-stron.js';
import { podlaczDokWarstw, przelaczZakladkePrawa, przelaczOstrzezenia, ostrzezeniaOtwarte } from './dok-warstw.js';
import { dodajPolecenie } from '../paleta-polecen.js';
import '../biblioteka-elementy.js';
import '../biblioteka-wzorce.js'; // kategoria „Wzorce stron” (#164) – osobny moduł
import {
  maElementyDoWklejenia, wklejElementy, kopiujStroneDoSchowka, wklejStronyZeSchowka, kopiujSekcjeDoSchowka, wklejSekcjeZeSchowka,
} from './schowek-okno.js';
import { otworzBiblioteke, wstawZBiblioteki, TYP_PRZECIAGANIA } from './biblioteka-okno.js';
import { otworzZnajdz } from './znajdz-okno.js';
import { zapiszWBibliotece } from './moje-elementy-okno.js';
import { sprawdzanie, podlaczPisownie } from './pisownia-plotno.js';
import { wygladZ, nalozWyglad } from '../malarz.js';
import { otworzUstawieniaSekcji, przesunSekcje, usunSekcje, zamienNaOkladke } from './sekcje.js';
import {
  dodajWzorzec, zmienNazweWzorca, duplikujWzorzecZ, usunWzorzec, przesunWzorzec, wrocDoStron, edytujWzorzec, otworzWzorce, dodajWzorzecStandardowy, przelaczWzorzecNaStronie, przelaczWzorzecWSekcji,
} from './wzorce.js';
import { t } from '../jezyk.js';

const OPIS_OSTRZEZEN = {
  poza_strona: 'Poza stroną – nie będzie widoczny w druku.',
  poza_spadem: 'Wychodzi poza spad – część zostanie ucięta.',
  szerszy_niz_grzbiet: 'Szerszy niż grzbiet – zachodzi na tył albo przód okładki.',
  na_zgieciu: 'Tekst leży na zgięciu albo perforacji – po złożeniu będzie przełamany. Przesuń go do jednego panelu.',
  poza_wykrojnikiem: 'Poza wykrojnikiem – ta część zostanie wycięta i nie trafi na gotową rzecz.',
  w_marginesie: 'Wchodzi w margines – może zostać przycięty.',
  nieznane_pole: 'Pole w klamrach nie pasuje do kolumny tabeli tej strony ani do pola dokumentu.',
  nie_miesci_sie: 'Tekst nie mieści się w ramce – dół zostanie ucięty.',
  sklad_pl: 'Skład niezgodny z polskimi zasadami.',
};


// Pole jest znane, gdy to pole dokumentu albo kolumna tabeli strony, na której
// leży tekst. We wzorcu znana jest kolumna dowolnej tabeli – wzorzec trafia na różne strony.
edytor.znanePole = (nazwa, indeksStrony) => {
  if (NAZWY_POL_DOKUMENTU.has(nazwa) || !stan.projekt) return true;
  if (naPlotnie?.wzorzec) return Boolean(polePoTabelach(nazwa, stan.projekt.tabele));
  const strona = stan.projekt.strony.find((s) => s.id === naPlotnie?.strony?.[indeksStrony]);
  return Boolean(polePoTabelach(nazwa, tabeleStrony(strona)));
};

// ---------- Ostrzeżenia ----------

function renderujOstrzezenia(lista) {
  const ul = $('#lista-ostrzezen');
  ul.replaceChildren();
  const licznik = $('#licznik-ostrzezen');
  licznik.textContent = lista.length;
  licznik.classList.toggle('sa', lista.length > 0);
  $('#kropka-ostrzezen').hidden = lista.length === 0;
  // Przycisk ostrzeżeń przy powiększeniu (komputer, #171): licznik i kolor tylko, gdy są uwagi.
  const lp = $('#licznik-ostrzezen-przycisk');
  lp.textContent = lista.length;
  lp.hidden = lista.length === 0;
  $('#przycisk-ostrzezen').classList.toggle('sa', lista.length > 0);
  if (!lista.length) {
    const li = document.createElement('li');
    li.className = 'brak';
    li.textContent = t('edytorStart.wszystkoMiesciSieW');
    ul.append(li);
    return;
  }
  for (const o of lista) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="opis" role="button" tabindex="0" title="Zaznacz element"><strong></strong><span></span></span><button class="przycisk" title="To celowe – nie pokazuj ostrzeżenia dla tego elementu">Wycisz</button>';
    $('strong', li).textContent = o.obiekt;
    $('.opis span', li).textContent = o.opis || OPIS_OSTRZEZEN[o.typ];
    $('.opis', li).addEventListener('click', () => edytor.zaznacz(o.id));
    $('.przycisk', li).addEventListener('click', () => {
      const obj = edytor.canvas.getObjects().find((x) => x.id === o.id);
      if (!obj) return;
      obj.bez_ostrzezen = true;
      edytor.oznaczZmiane();
      panel.odswiez();
    });
    ul.append(li);
  }
}

async function wstawObraz(plik) {
  if (!plik.type.startsWith('image/')) {
    powiadom(t('edytorStart.toNieJestPlik'), true);
    return;
  }
  try {
    // Plik SVG bez podanego rozmiaru (sam viewBox) przeglądarka wczytałaby jako obraz o zerowych wymiarach.
    const gotowy = plik.type === 'image/svg+xml' ? await uporzadkujPlikSvg(plik) : plik;
    // Każdy obraz wstawiony na stronę trafia do „Obrazów projektu” (js/obrazy-projektu.js: przyjmijPlik):
    // ten sam plik drugi raz używa obrazu, który już jest; inny plik o zajętej nazwie dostaje „(2)”.
    const { id, nazwa } = await przyjmijPlik(stan.projekt, gotowy, plik.name);
    await edytor.dodajObraz(null, nazwa, stan.projekt.zasoby, { id });
    // Napisy w rysunku wstawionym jako obraz przeglądarka rysuje czcionką systemu, nie czcionką z pliku.
    if (plik.type === 'image/svg+xml' && /<text[\s>]/i.test(await gotowy.text())) {
      powiadom(t('edytorStart.rysunekMaNapisyJako'));
    }
  } catch (e) {
    powiadom(e.message, true);
  }
}

// Nowe zdjęcie w ramce zaznaczonego obrazu (przycisk „Podmień zdjęcie” we właściwościach).
async function podmienObraz(obj, plik) {
  if (!plik.type.startsWith('image/')) { powiadom(t('edytorStart.toNieJestPlik'), true); return; }
  if (!edytor.canvas.getObjects().includes(obj) && !obj.group) return; // obraz zniknął ze strony w międzyczasie
  try {
    const gotowy = plik.type === 'image/svg+xml' ? await uporzadkujPlikSvg(plik) : plik;
    // Jak przy wstawianiu: nowe zdjęcie trafia do „Obrazów projektu” (bez kopii tego samego pliku). Poprzednie
    // zostaje tam jako obraz projektu – jeśli nigdzie go już nie ma, widać przy nim „nieużywany”.
    const { id, nazwa } = await przyjmijPlik(stan.projekt, gotowy, plik.name);
    await edytor.podmienObraz(obj, null, nazwa, stan.projekt.zasoby, { id });
    panel.zbuduj();
  } catch (blad) {
    powiadom(blad.message || t('edytorStart.nieUdaloSiePodmienic'), true);
  }
}

// Kształt jako ramka obrazu (#123): plik z urządzenia trafia do obrazów projektu i do kształtu.
async function obrazDoKsztaltu(obj, plik) {
  if (!plik.type.startsWith('image/')) { powiadom(t('edytorStart.toNieJestPlik'), true); return; }
  try {
    const gotowy = plik.type === 'image/svg+xml' ? await uporzadkujPlikSvg(plik) : plik;
    const { id } = await przyjmijPlik(stan.projekt, gotowy, plik.name);
    await edytor.wstawObrazDoKsztaltu(obj, id);
    panel.zbuduj();
  } catch (blad) {
    powiadom(blad.message || t('edytorStart.nieUdaloSieWstawic'), true);
  }
}

// Wstawienie albo podmiana obrazem, który już jest w projekcie (wybór w oknie „Obrazy projektu”).
async function wstawZProjektu(id) {
  const z = stan.projekt.zasoby[id];
  if (!z) return;
  try { await edytor.dodajObraz(null, z.nazwa, stan.projekt.zasoby, { id }); } catch (blad) { powiadom(blad.message, true); }
}
export async function podmienZProjektu(obj, id) {
  const z = stan.projekt.zasoby[id];
  if (!z || (!edytor.canvas.getObjects().includes(obj) && !obj.group)) return;
  try {
    await edytor.podmienObraz(obj, null, z.nazwa, stan.projekt.zasoby, { id });
    panel.zbuduj();
  } catch (blad) {
    powiadom(blad.message || t('edytorStart.nieUdaloSiePodmienic'), true);
  }
}

// ======================================================================
// Akcje (data-akcja)
// ======================================================================

// PNG bieżącej strony albo wzorca: 300 dpi, ze spadem, z oryginalnych zdjęć.
async function pobierzPng() {
  zapiszBiezacyCel();
  const cel = biezacyCel();
  const nazwa = stan.tryb === 'wzorzec' ? `wzorzec-${cel.nazwa}` : `s${stan.indeks + 1}`;
  try {
    await zPostepem('Przygotowanie obrazu PNG (300 dpi)…', async () => {
      const { pngCelu } = await import('../eksport.js'); // eksport wczytuje się przy pierwszym użyciu
      pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa)}-${bezpiecznaNazwa(nazwa)}.png`, await pngCelu(stan.projekt, cel, 300));
    });
  } catch (blad) {
    powiadom(blad.message || t('edytorStart.nieUdaloSiePrzygotowac'));
  }
}

// Raport przeniesienia (#232): przed pobraniem pliku dla innego programu – co przejdzie jako obraz, co uproszczone,
// co się nie przeniesie. „Pokaż” prowadzi do elementu w edytorze (pobieranie wtedy się nie odbywa).
async function zRaportem(program, zapisz) {
  const { Raport, pokazRaport } = await import('../raport-przeniesienia.js');
  const raport = new Raport();
  const w = await zapisz(raport);
  const ok = await pokazRaport({
    tytul: t('edytorStart.coPrzejdzieDoProgramu', { program }),
    wstep: 'Nie wszystko ma odpowiednik w innym programie. Tak zapiszemy elementy projektu – „Pokaż” otwiera pierwszy taki element.',
    raport,
    pokaz: (idStrony, idObiektu) => oknoKontroli.zrodlo.pokaz(idStrony, idObiektu),
  });
  return ok ? w : null;
}

const oknoKontroli = new OknoKontroli({
  projekt: () => stan.projekt,
  przedSprawdzeniem: zapiszBiezacyCel,
  pokaz: async (idStrony, idObiektu) => {
    const i = stan.projekt.strony.findIndex((s) => s.id === idStrony);
    if (i < 0) return;
    await przejdzDoStrony(i);
    if (idObiektu) edytor.zaznacz(idObiektu);
  },
  pokazWPodgladzie: (nrStrony) => pokazPodglad({ nrStrony }),
  // Naprawy prosto z listy uwag (#127): kolory spoza trybu kolorów → najbliższe dozwolone.
  napraw: async (u) => {
    if (u.naprawa === 'kolory_trybu') await zamienKoloryNaDozwolone();
    // Element z importu przejrzany (#232): zdejmujemy oznaczenie z projektu i z płótna.
    if (u.naprawa === 'z_importu') {
      zapiszBiezacyCel();
      const zdejmij = (lista) => { for (const o of lista || []) { if (o?.id === u.idObiektu) delete o.z_importu; if (o?.objects) zdejmij(o.objects); } };
      for (const st of stan.projekt.strony) zdejmij(st.obiekty);
      for (const wz of stan.projekt.wzorce || []) zdejmij(wz.obiekty);
      const naPlotnie = edytor.canvas.getObjects().find((o) => o.id === u.idObiektu);
      if (naPlotnie) delete naPlotnie.z_importu;
      zaplanujZapis();
    }
    // Twarda oprawa bez wyklejek (#177): brakujące wyklejki dochodzą jako czyste sekcje.
    if (u.naprawa === 'wyklejki') {
      zapiszBiezacyCel();
      const { dodajWyklejki } = await import('../sekcje-specjalne.js');
      const { przeliczOkladki } = await import('../okladka.js');
      const nowe = dodajWyklejki(stan.projekt);
      przeliczOkladki(stan.projekt);
      stan.miniatury.clear();
      await zaladujCel();
      zaplanujZapis();
      powiadom(nowe.length ? t('edytorStart.dodano', { join: nowe.map((s) => s.nazwa.toLowerCase()).join(' i ') }) : t('edytorStart.wyklejkiJuzSa'));
      oknoKontroli.otworz();
    }
  },
});

// Okno eksportu PDF razem z całym zapisem PDF (pdf-lib, czcionki, profile barwne) wczytuje się przy pierwszym
// otwarciu – edytor bez eksportu jest o kilkaset kilobajtów lżejszy.
let oknoPdf = null;
async function otworzOknoPdf() {
  if (!oknoPdf) {
    const czekaj = setTimeout(() => powiadom(t('edytorStart.wczytujeEksportPdf')), 400);
    try {
      const { OknoPdf } = await import('../okno-pdf.js');
      oknoPdf ||= new OknoPdf({
        projekt: () => stan.projekt,
        sekcja: () => (stan.tryb === 'strona' ? biezacaSekcja() : stan.projekt.sekcje[0]),
        przedEksportem: zapiszBiezacyCel,
      });
    } catch (e) {
      powiadom(t('edytorStart.nieUdaloSieWczytac', { message: e.message }), true);
      return;
    } finally {
      clearTimeout(czekaj);
    }
  }
  oknoPdf.otworz();
}

// Druk w domu (#145): okno wczytuje się przy pierwszym otwarciu (razem z zapisem PDF). Ctrl+P w edytorze
// i w podglądzie otwiera to okno zamiast drukowania strony aplikacji (#150); druk z menu przeglądarki
// dostaje zamiast zrzutu aplikacji kartkę z podpowiedzią (css: @media print).
let oknoDruku = null;
async function otworzOknoDruku() {
  if (!oknoDruku) {
    try {
      const { OknoDruku } = await import('../okno-druku.js');
      oknoDruku ||= new OknoDruku({
        projekt: () => stan.projekt,
        biezacaStrona: () => (stan.tryb === 'strona' ? biezacyCel()?.id : null),
        przedDrukiem: zapiszBiezacyCel,
      });
    } catch (e) {
      powiadom(t('edytorStart.nieUdaloSieWczytac2', { message: e.message }), true);
      return;
    }
  }
  oknoDruku.otworz();
}
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'p') return;
  if (!['edytor', 'podglad'].includes(document.body.dataset.ekran) || !stan.projekt) return;
  if (document.body.classList.contains('podglad-publiczny')) return;
  e.preventDefault();
  otworzOknoDruku();
}, true);
Object.defineProperty(window.seriodruk, 'oknoDruku', { get: () => oknoDruku, configurable: true });

$('#dlg-tabela').addEventListener('close', (e) => {
  if (e.target.returnValue !== 'tak') return;
  const f = e.target.querySelector('form').elements;
  edytor.dodajTabele({ wiersze: Number(f.wiersze.value), kolumny: Number(f.kolumny.value), wysokoscWiersza: Number(f.wysokosc.value), naglowek: f.naglowek.checked });
});

const zMenu = (fn) => () => { const v = fn.zrodlo(); zamknijMenu(); fn(v); };
const przezMenu = (zrodlo, fn) => { const f = (v) => fn(v); f.zrodlo = zrodlo; return zMenu(f); };

// Przyciski edytora i podglądu. Przyciski wspólne z ekranem projektów (nowy projekt, instrukcja, motyw,
// pełny ekran, wylogowanie…) obsługuje js/aplikacja.js; tej tablicy używa dla pozostałych.
export const akcje = {
  podglad: () => pokazPodglad(),
  udostepnij: otworzUdostepnianie,
  'udostepnij-zamknij': () => $('#dlg-udostepnij').close(),
  'udostepnij-utworz': opublikujUdostepnienie,
  'udostepnij-wylacz': wylaczUdostepnienie,
  'udostepnij-kopiuj': kopiujLinkUdostepnienia,
  'udostepnij-ochrona': zapiszOchroneLinku,
  'udostepnij-znak': zapiszZnakWodny,
  'udostepnij-makieta': zapiszMakieteLinku,
  'podglad-zamknij': zamknijPodglad,
  'podglad-plus': () => podglad.powieksz(1.25),
  'podglad-minus': () => podglad.powieksz(0.8),
  'podglad-dopasuj': () => podglad.dopasuj(),
  'podglad-prezentacja': () => podglad.prezentuj(),
  // Podgląd separacji (#131C) – strona widoczna w środku podglądu.
  'podglad-separacje': async () => {
    const tresc = $('#podglad-tresc');
    const srodek = tresc.getBoundingClientRect().top + tresc.clientHeight / 2;
    const widoczna = [...tresc.querySelectorAll('.podglad-strona[data-id]')].find((f) => f.getBoundingClientRect().bottom > srodek - 40);
    (await import('./separacje-okno.js')).otworzSeparacje(stan.projekt, widoczna?.dataset.id || null);
  },
  'separacje-zamknij': () => $('#dlg-separacje').close(),
  // Makieta 3D (#131D) – obok „Separacji” w podglądzie.
  'podglad-makieta': async () => (await import('./makieta-okno.js')).otworzMakiete(stan.projekt),
  'makieta-zamknij': () => $('#dlg-makieta').close(),
  'makieta-pelny-ekran': async () => (await import('./makieta-okno.js')).przelaczPelnyEkranMakiety(),
  'makieta-plus': async () => (await import('./makieta-okno.js')).powiekszMakiete(1.25),
  'makieta-minus': async () => (await import('./makieta-okno.js')).powiekszMakiete(0.8),
  'makieta-przod': async () => (await import('./makieta-okno.js')).widokZPrzodu(),
  'makieta-pobierz': async () => (await import('./makieta-okno.js')).pobierzObrazMakiety(),
  png: () => { zamknijMenu(); pobierzPng(); },
  pdf: () => { zamknijMenu(); otworzOknoPdf(); },
  // Tekst dla innych programów (#216): Word i EPUB – treść stron w kolejności czytania, z nagłówkami.
  // Plik dla plotera (#218): linie wykrojnika bieżącej strony jako SVG w milimetrach.
  'ploter-svg': async () => {
    zamknijMenu();
    zapiszBiezacyCel();
    if (stan.tryb !== 'strona') { powiadom(t('edytorStart.plikDlaPloteraRobi'), true); return; }
    const { svgPlotera } = await import('../ploter.js');
    const { rozwin } = await import('../serie.js');
    const ciag = rozwin(stan.projekt);
    const egz = ciag.pierwszy.get(stan.projekt.strony[stan.indeks].id);
    const w = egz ? await svgPlotera(stan.projekt, egz, { ciag }) : null;
    if (!w) { powiadom(t('edytorStart.naTejStronieNie'), true); return; }
    pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa || 'projekt')}-ploter.svg`, URL.createObjectURL(new Blob([w.svg], { type: 'image/svg+xml' })));
    powiadom(t('edytorStart.pobranoPlikDlaPlotera', { ciecie: w.ile.ciecie, big: w.ile.big, perforacja: w.ile.perforacja, klej: w.ile.klej }));
  },
  'tekst-docx': () => zapiszTekstJako('docx'),
  'tekst-epub': () => zapiszTekstJako('epub'),
  // InDesign (#221): pakiet IDML – te same zasady co dla Scribusa; otwierają go też Affinity Publisher i QuarkXPress.
  idml: async () => {
    zamknijMenu();
    zapiszBiezacyCel();
    const [{ biblioteka }, { zapiszIdml }] = await Promise.all([import('../biblioteki.js'), import('../idml.js')]);
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'modułu ZIP');
    powiadom(t('edytorStart.przygotowujePlikIdml'));
    const w = await zRaportem('InDesign / Affinity', (raport) => zapiszIdml(stan.projekt, JSZip, { raport, postep: (i, z) => { if (i < z && i % 5 === 0) powiadom(t('edytorStart.przygotowujePlikIdmlStrona', { x: i + 1, z })); } }));
    if (!w) return;
    pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa || 'projekt')}.idml`, URL.createObjectURL(w.blob));
    powiadom(t('edytorStart.zapisanoIdmlIndesignAffinity', { stron: w.stron, teksty: w.ile.teksty, ksztalty: w.ile.ksztalty, obrazy: w.ile.obrazy, x: w.czcionki.join(', ') || '–' }));
  },
  // Word z układem stron i SVG stron (#228).
  'docx-uklad': async () => {
    zamknijMenu();
    zapiszBiezacyCel();
    const [{ biblioteka }, { zapiszDocxUklad }] = await Promise.all([import('../biblioteki.js'), import('../eksport-uklad.js')]);
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'modułu ZIP');
    powiadom(t('edytorStart.przygotowujePlikWorda'));
    const w = await zRaportem('Word', (raport) => zapiszDocxUklad(stan.projekt, JSZip, { raport }));
    if (!w) return;
    pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa || 'projekt')}.docx`, URL.createObjectURL(w.blob));
    powiadom(t('edytorStart.zapisanoDlaWordaStron', { stron: w.stron, teksty: w.ile.teksty, ksztalty: w.ile.ksztalty, obrazy: w.ile.obrazy }));
  },
  'svg-strony': async () => {
    zamknijMenu();
    zapiszBiezacyCel();
    const [{ biblioteka }, { zapiszSvgStron }] = await Promise.all([import('../biblioteki.js'), import('../eksport-uklad.js')]);
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'modułu ZIP');
    powiadom(t('edytorStart.przygotowujePlikiSvg'));
    const w = await zapiszSvgStron(stan.projekt, JSZip);
    pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa || 'projekt')} - SVG.zip`, URL.createObjectURL(w.blob));
    powiadom(t('edytorStart.zapisanoStronJakoSvg', { stron: w.stron }));
  },
  // Seria dla innych programów (#226): szablon z polami + dane (InDesign/Affinity, Scribus, Word/Publisher).
  'seria-programy': async () => {
    zamknijMenu();
    zapiszBiezacyCel();
    const { daneSerii } = await import('../eksport-serii.js');
    if (!daneSerii(stan.projekt).length) { powiadom(t('edytorStart.projektNieMaSerii'), true); return; }
    $('#seria-programy-uwaga').textContent = '';
    $('#dlg-seria-programy').showModal();
  },
  // Scribus (#220): cały projekt jako plik .sla – teksty edytowalne, kształty wektorowe, reszta jako obrazy w pliku.
  scribus: async () => {
    zamknijMenu();
    zapiszBiezacyCel();
    const { zapiszSla } = await import('../scribus.js');
    powiadom(t('edytorStart.przygotowujePlikDlaScribusa'));
    const w = await zRaportem('Scribus', (raport) => zapiszSla(stan.projekt, { raport, postep: (i, z) => { if (i < z && i % 5 === 0) powiadom(t('edytorStart.przygotowujePlikDlaScribusa2', { x: i + 1, z })); } }));
    if (!w) return;
    pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa || 'projekt')}.sla`, URL.createObjectURL(new Blob([w.sla], { type: 'application/vnd.scribus' })));
    powiadom(t('edytorStart.zapisanoDlaScribusaStron', { stron: w.stron, teksty: w.ile.teksty, ksztalty: w.ile.ksztalty, obrazy: w.ile.obrazy, x: w.czcionki.join(', ') || '–' }));
  },
  'czat-ai': async () => { zamknijMenu(); (await import('./czat-ai.js')).otworzCzatAi(); },
  'wstaw-tekst-z-pliku': async () => { zamknijMenu(); await import('./import-tekstu-okno.js'); $('#plik-tekst').click(); },
  // Specyfikacja dla drukarni (#214): ustawienia oprawy, papieru, materiału i uszlachetnień – tekst i JSON.
  specyfikacja: async () => {
    zamknijMenu();
    zapiszBiezacyCel();
    const { specyfikacja, specyfikacjaTekst } = await import('../specyfikacja.js');
    const spec = specyfikacja(stan.projekt);
    const nazwa = bezpiecznaNazwa(stan.projekt.nazwa || 'projekt');
    pobierz(`${nazwa} – specyfikacja.txt`, URL.createObjectURL(new Blob([specyfikacjaTekst(spec)], { type: 'text/plain;charset=utf-8' })));
    pobierz(`${nazwa} – specyfikacja.json`, URL.createObjectURL(new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' })));
    powiadom(t('edytorStart.pobranoSpecyfikacjeDlaDrukarni'));
  },
  drukuj: () => { zamknijMenu(); otworzOknoDruku(); },
  czcionki: () => { zamknijMenu(); oknoCzcionek.otworz(); },
  'kolory-druku': () => { zamknijMenu(); otworzKoloryDruku(); },
  // Zmiana formatu ze skalowaniem (#131D): cały projekt (menu ⋯ projektu) albo sekcja (okno ustawień sekcji).
  'format-projektu': async () => { zamknijMenu(); (await import('./zmiana-formatu.js')).otworzZmianeFormatu(null); },
  'format-sekcji': async () => {
    const id = $('#dlg-sekcja').dataset.id || stan.projekt.sekcje[0]?.id;
    $('#dlg-sekcja').close();
    (await import('./zmiana-formatu.js')).otworzZmianeFormatu(id ? [id] : null);
  },
  'format-obroc': async () => (await import('./zmiana-formatu.js')).obrocFormat(),
  'format-zamknij': () => $('#dlg-format').close(),
  // Zestaw marki (#131D): zastosowanie do projektu – rzecz całego projektu (menu ⋯ projektu, Biblioteka).
  'marka-zastosuj': async () => { zamknijMenu(); (await import('./marka-zastosuj.js')).otworzZastosowanieMarki(); },
  'marka-zastosuj-zamknij': () => $('#dlg-marka-zastosuj').close(),
  'kolory-druku-zamknij': () => $('#dlg-kolory-druku').close(),
  // Wiele zdjęć naraz – np. dla obrazów z danych (nazwy plików w tabeli); także na telefonie.
  obrazy: async () => { zamknijMenu(); (await oknoObrazow()).otworzObrazy(); },
  kontrola: () => { zamknijMenu(); oknoKontroli.otworz(); },
  wydruk: () => otworzUstawieniaSekcji(biezacaSekcja().id),
  'obroc-format': () => {
    const f = $('#dlg-sekcja form');
    [f.elements.szerokosc_mm.value, f.elements.wysokosc_mm.value] = [f.elements.wysokosc_mm.value, f.elements.szerokosc_mm.value];
    f.elements.szerokosc_mm.dispatchEvent(new Event('input', { bubbles: true })); // schemat marginesów
  },

  'strona-dodaj': () => dodajStrone(),
  'strona-nazwa': przezMenu(indeksZMenu, zmienNazweStrony),
  'strona-duplikuj': przezMenu(indeksZMenu, duplikujStrone),
  'strona-do-schowka': przezMenu(indeksZMenu, kopiujStroneDoSchowka),
  'strona-ze-schowka': przezMenu(indeksZMenu, wklejStronyZeSchowka),
  'sekcja-do-schowka': przezMenu(sekcjaZMenu, kopiujSekcjeDoSchowka),
  'sekcja-ze-schowka': przezMenu(sekcjaZMenu, wklejSekcjeZeSchowka),
  // Wzorce wybranej strony (#164): przejście na nią i okno wzorców z przełącznikami „na tej stronie”.
  'strona-wzorce': przezMenu(indeksZMenu, async (i) => { await przejdzDoStrony(i); otworzWzorce(); }),
  'strona-usun': przezMenu(indeksZMenu, usunStrone),
  'strona-gora': przezMenu(indeksZMenu, (i) => przesunStrone(i, -1)),
  'strona-dol': przezMenu(indeksZMenu, (i) => przesunStrone(i, 1)),

  'sekcja-dodaj': () => otworzUstawieniaSekcji(null),
  // Gotowe sekcje (#166): okno ładowane przy pierwszym otwarciu.
  'gotowe-sekcje': async () => { zamknijMenu(); (await import('./gotowe-sekcje-okno.js')).otworzGotoweSekcje(); },
  'sekcja-ustawienia': przezMenu(sekcjaZMenu, otworzUstawieniaSekcji),
  'sekcja-wzorce': przezMenu(sekcjaZMenu, async (id) => {
    const i = stan.projekt.strony.findIndex((st) => st.sekcja === id);
    if (i >= 0 && (stan.tryb !== 'strona' || stan.projekt.strony[stan.indeks]?.sekcja !== id)) await przejdzDoStrony(i);
    otworzWzorce();
  }),
  'sekcja-strona': przezMenu(sekcjaZMenu, dodajStrone),
  'sekcja-okladka': przezMenu(sekcjaZMenu, zamienNaOkladke),
  'sekcja-gora': przezMenu(sekcjaZMenu, (id) => przesunSekcje(id, -1)),
  'sekcja-dol': przezMenu(sekcjaZMenu, (id) => przesunSekcje(id, 1)),
  'sekcja-usun': przezMenu(sekcjaZMenu, usunSekcje),

  wzorce: otworzWzorce,
  'wzorzec-dodaj': dodajWzorzec,
  'wzorzec-nazwa': przezMenu(wzorzecZMenu, zmienNazweWzorca),
  'wzorzec-duplikuj': przezMenu(wzorzecZMenu, duplikujWzorzecZ),
  'wzorzec-usun': przezMenu(wzorzecZMenu, usunWzorzec),
  'wzorzec-gora': przezMenu(wzorzecZMenu, (id) => przesunWzorzec(id, -1)),
  'wzorzec-dol': przezMenu(wzorzecZMenu, (id) => przesunWzorzec(id, 1)),
  'wroc-do-stron': wrocDoStron,

  'dodaj-tekst': () => edytor.dodajTekst(),
  'dodaj-prostokat': () => edytor.dodajProstokat(),
  // Składanka (#233): część, część z kształtu, zgięcie, połączenie, miejsce klejenia, szczelina.
  'skladanka-czesc': () => obsluzAkcje('skladanka-czesc'),
  'skladanka-z-ksztaltu': () => obsluzAkcje('skladanka-z-ksztaltu'),
  'skladanka-bryla': () => obsluzAkcje('skladanka-bryla'),
  'skladanka-model-3d': () => obsluzAkcje('skladanka-model-3d'),
  'skladanka-na-czesc': () => obsluzAkcje('skladanka-na-czesc'),
  'skladanka-linia': () => obsluzAkcje('skladanka-linia'),
  'skladanka-naciecie': () => obsluzAkcje('skladanka-naciecie'),
  'skladanka-wyciecie': () => obsluzAkcje('skladanka-wyciecie'),
  'skladanka-zgiecie': () => obsluzAkcje('skladanka-zgiecie'),
  'skladanka-polacz': () => obsluzAkcje('skladanka-polacz'),
  'skladanka-klej': () => obsluzAkcje('skladanka-klej'),
  'skladanka-szczelina': () => obsluzAkcje('skladanka-szczelina'),
  'skladanka-rozloz': () => obsluzAkcje('skladanka-rozloz'),
  'skladanka-szablon': () => obsluzAkcje('skladanka-szablon'),
  'skladanka-instrukcja': () => obsluzAkcje('skladanka-instrukcja'),
  // Komiks (#364): dymek, kadry, podział kadru, scenariusz, dymki ze scenariusza.
  'generuj-obraz': () => oknoGenerowania(),
  'tekst-ai': () => oknoTekstuAi(),
  'komiks-dymek': () => obsluzAkcjeKomiksu('komiks-dymek'),
  'komiks-efekt': () => obsluzAkcjeKomiksu('komiks-efekt'),
  'komiks-mostek': () => obsluzAkcjeKomiksu('komiks-mostek'),
  'komiks-kadry': () => obsluzAkcjeKomiksu('komiks-kadry'),
  'komiks-podziel': () => obsluzAkcjeKomiksu('komiks-podziel'),
  'komiks-scenariusz': () => obsluzAkcjeKomiksu('komiks-scenariusz'),
  'komiks-dymki': () => obsluzAkcjeKomiksu('komiks-dymki'),
  'komiks-postacie': () => obsluzAkcjeKomiksu('komiks-postacie'),
  'komiks-wgraj': () => obsluzAkcjeKomiksu('komiks-wgraj'),
  'komiks-webtoon': () => obsluzAkcjeKomiksu('komiks-webtoon'),
  'dodaj-elipse': () => edytor.dodajElipse(),
  'dodaj-linie': () => edytor.dodajLinie(),
  'dodaj-wielokat': () => otworzWyborWielokata(),
  // Narzędzie „Obraz”: z urządzenia albo z obrazów projektu (bez obrazów w projekcie – od razu wybór pliku).
  'dodaj-obraz': () => wybierzZrodloObrazu({
    tytul: t('edytorStart.wstawObraz'),
    zUrzadzenia: () => $('#plik-obraz').click(),
    zProjektu: async () => (await oknoObrazow()).otworzObrazy({ wybierz: { etykieta: t('edytorStart.wstaw'), fn: wstawZProjektu } }),
  }),
  rysuj: () => edytor.ustawRysowanie(!edytor.rysuje),
  pioro: () => edytor.ustawPioro(!edytor.pioro),
  'dodaj-tabele': () => { $('#dlg-tabela').returnValue = ''; $('#dlg-tabela').showModal(); },
  biblioteka: () => otworzBiblioteke(),
  znajdz: () => { zamknijMenu(); otworzZnajdz(); },
  komentarze: () => { zamknijMenu(); otworzKomentarze(); },
  komentarz: () => narzedzieKomentarz(),
  'zapisz-w-bibliotece': () => zapiszWBibliotece(),
  malarz: () => malarzPrzycisk(),
  cofnij: () => cofnijKrok(-1),
  ponow: () => cofnijKrok(1),
  duplikuj: () => edytor.duplikuj(),
  kopiuj: async () => { if (await edytor.kopiuj()) powiadom(t('edytorStart.skopiowanoWklejNaTej')); },
  usun: () => edytor.usun(),
  prowadnice: () => {
    edytor.pokazProwadnice = !edytor.pokazProwadnice;
    $('#przycisk-prowadnice').setAttribute('aria-pressed', String(edytor.pokazProwadnice));
    edytor.canvas.requestRenderAll();
  },
  'prowadnice-usun': () => { edytor.usunProwadnice(); zamknijMenu(); },
  dane: () => dane.otworz(),
  'zoom-plus': () => edytor.ustawZoom(edytor.zoom * 1.25),
  'zoom-minus': () => edytor.ustawZoom(edytor.zoom / 1.25),
  'zoom-dopasuj': () => edytor.dopasujDoOkna(),
};

podlaczDokWarstw();

// Okno „Wzorce”: dodawanie do strony i sekcji, edycja, wzorce standardowe.
$('#wzorce-zamknij').addEventListener('click', () => $('#dlg-wzorce').close());
$('#lista-wzorcow').addEventListener('click', (e) => {
  const przycisk = e.target.closest('[data-op]');
  const id = przycisk?.closest('li[data-id]')?.dataset.id;
  if (!id) return;
  if (przycisk.dataset.op === 'strona') przelaczWzorzecNaStronie(id);
  if (przycisk.dataset.op === 'sekcja') przelaczWzorzecWSekcji(id);
  if (przycisk.dataset.op === 'edytuj') edytujWzorzec(id);
});
$('#wzorce-standardowe').addEventListener('click', (e) => {
  const klucz = e.target.closest('[data-standard]')?.dataset.standard;
  if (klucz) dodajWzorzecStandardowy(klucz);
});

$('#przycisk-wiecej').addEventListener('click', (e) => przelaczMenu(e.currentTarget, $('#menu-wiecej')));
$('#przycisk-widok').addEventListener('click', (e) => { menuWidoku.odswiez(); $('#widok-jedna').checked = jednaStrona(); $('#widok-uszlachetnienia').checked = stanUszlachetnien.pokaz; $('#widok-pisownia').checked = sprawdzanie.wlaczona(); przelaczMenu(e.currentTarget, $('#menu-widoku')); });
$('#naglowek-ostrzezen').addEventListener('click', (e) => {
  if (ostrzezeniaOtwarte()) return; // w okienku na komputerze lista jest zawsze rozwinięta (#171)
  const b = e.currentTarget;
  b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'));
});

// Obrazy do pól: trafiają do obrazów projektu pod nazwą pliku, bez wstawiania na stronę. Ten sam plik
// drugi raz nie jest dodawany; o plik o powtórzonej nazwie aplikacja pyta (js/app/obrazy-okno.js).
const oknoObrazow = () => import('./obrazy-okno.js');
$('#pliki-zasoby').addEventListener('change', async (e) => {
  const pliki = [...e.target.files];
  e.target.value = '';
  if (!pliki.length || !stan.projekt) return;
  try { await (await oknoObrazow()).wgrajObrazy(pliki); } catch (blad) { powiadom(t('edytorStart.nieUdaloSieWgrac', { message: blad.message }), true); }
});

// Pole wyboru pliku czyścimy dopiero po wczytaniu – wyczyszczenie wcześniej
// potrafi unieważnić plik, zanim zostanie odczytany.
$('#plik-obraz').addEventListener('change', async (e) => {
  const plik = e.target.files[0];
  if (plik) await wstawObraz(plik);
  e.target.value = '';
});
$('#plik-podmiana').addEventListener('change', async (e) => {
  const plik = e.target.files[0];
  const obj = podmiana.obj;
  const doKsztaltu = podmiana.doKsztaltu;
  podmiana.obj = null;
  podmiana.doKsztaltu = false;
  if (plik && obj && doKsztaltu) await obrazDoKsztaltu(obj, plik);
  else if (plik && obj) await podmienObraz(obj, plik);
  e.target.value = '';
});

const kontener = $('#kontener-plotna');
kontener.addEventListener('dragover', (e) => e.preventDefault());
kontener.addEventListener('drop', (e) => {
  e.preventDefault();
  // Element przeciągnięty z biblioteki: staje w miejscu upuszczenia (#131A).
  const zBiblioteki = e.dataTransfer.getData(TYP_PRZECIAGANIA);
  if (zBiblioteki) {
    const [kat, el] = zBiblioteki.split('|');
    const p = edytor.canvas.getScenePoint(e);
    wstawZBiblioteki(kat, el, { x: p.x, y: p.y });
    return;
  }
  // Plik upuszczony na kształt trafia do kształtu (kształt jako ramka obrazu, #123).
  const cel = edytor.elementWPunkcie(e);
  const pliki = [...e.dataTransfer.files];
  if (cel && edytor.moznaWstawicObraz(cel) && pliki.length === 1 && pliki[0].type.startsWith('image/')) { obrazDoKsztaltu(cel, pliki[0]); return; }
  for (const plik of pliki) {
    if (plik.type.startsWith('image/')) wstawObraz(plik);
    else if (/\.(seriodruk|json)$/i.test(plik.name)) wczytajPlikProjektu(plik);
  }
});

$('#nazwa-projektu').addEventListener('change', (e) => {
  stan.projekt.nazwa = e.target.value.trim() || 'Bez nazwy';
  e.target.value = stan.projekt.nazwa;
  e.target.title = stan.projekt.nazwa;
  document.title = `${stan.projekt.nazwa} – ${NAZWA}`;
  zaplanujZapis();
});
$('#nazwa-projektu').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

// ---------- Zdarzenia edytora ----------

edytor.addEventListener('zaznaczenie', (e) => {
  const obj = e.detail;
  $('#akcje-obiektu').hidden = !obj || toZaznaczenie(obj);
  panel.pokaz(obj);
});
edytor.addEventListener('zmiana', zaplanujZapis);
podlaczArkusze(); // telefon: arkusze z dołu – uchwyt i widok nad otwartym arkuszem
// Tekst w trakcie pisania jest zapisywany (i wysyłany na konto) po każdej krótkiej przerwie, nie dopiero po
// wyjściu z ramki; krok cofania powstaje jak dotąd – po zakończeniu pisania.
edytor.addEventListener('pisanie', () => zaplanujZapis({ historia: false }));
// Kursor w połączonym tekście doszedł do ramki na innej stronie – aplikacja otwiera tę stronę i pisanie idzie dalej.
edytor.addEventListener('pisanie-na-innej-stronie', (e) => { piszNaInnejStronie(e.detail); });
// Widok jednej strony rozkładówki: kliknięty element należy do sąsiedniej strony i tylko zachodzi na tę.
edytor.addEventListener('element-sasiedniej-strony', () => {
  powiadom(t('edytorStart.tenElementLezyNa'), false, {
    etykieta: t('edytorStart.pokazRozkladowke'),
    fn: () => { const p = $('#widok-jedna'); p.checked = false; p.dispatchEvent(new Event('change')); },
  });
});
edytor.addEventListener('rysowanie', (e) => {
  for (const b of document.querySelectorAll('[data-akcja="rysuj"]')) b.setAttribute('aria-pressed', String(e.detail));
  odswiezWiecejNarzedzi();
  if (e.detail) powiadom(t('edytorStart.rysowanieOdrecznePrzeciagajPo'));
});
edytor.addEventListener('pioro', (e) => {
  for (const b of document.querySelectorAll('[data-akcja="pioro"]')) b.setAttribute('aria-pressed', String(e.detail));
  odswiezWiecejNarzedzi();
  if (e.detail) powiadom(t('edytorStart.pioroKliknijZebyPostawic'));
});
edytor.addEventListener('punkty', (e) => {
  if (e.detail) powiadom(t('edytorStart.edycjaPunktowPrzeciagajPunkty'));
});
edytor.addEventListener('schowek', () => { if (!edytor.aktywny) panel.zbuduj(); });
edytor.addEventListener('ostrzezenia', (e) => renderujOstrzezenia(e.detail));
// Długi tekst z „Dokładaj strony” (#212): po zmianie (i po zakończeniu pisania) dochodzą albo znikają strony.
let czasDokladania = null;
edytor.addEventListener('ostrzezenia', () => {
  clearTimeout(czasDokladania);
  czasDokladania = setTimeout(() => { if (!edytor.aktywny?.isEditing) dokladajStrony(); }, 500);
});
edytor.addEventListener('zoom', (e) => {
  $('#wartosc-zoom').textContent = `${Math.round(e.detail * 100)}%`;
});
edytor.addEventListener('strona', (e) => wybierzStroneArkusza(e.detail));
edytor.addEventListener('prowadnice', zaplanujZapis);

// Przeciąganie stron na liście (mysz).
{
  const lista = $('#lista-stron');
  let ciagnieta = null;
  const znacznik = (li, po) => {
    lista.querySelectorAll('.cel-przed, .cel-po').forEach((x) => x.classList.remove('cel-przed', 'cel-po'));
    if (li) li.classList.add(po ? 'cel-po' : 'cel-przed');
  };
  const czyPo = (li, e) => { const r = li.getBoundingClientRect(); return li.classList.contains('w-rozkladowce') ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2; };
  lista.addEventListener('dragstart', (e) => {
    const li = e.target.closest('li.strona');
    if (!li) return;
    ciagnieta = li.dataset.id;
    li.classList.add('ciagnieta');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ciagnieta);
  });
  lista.addEventListener('dragover', (e) => {
    const li = e.target.closest('li.strona');
    if (!ciagnieta || !li || li.dataset.id === ciagnieta) { znacznik(null); return; }
    e.preventDefault();
    znacznik(li, czyPo(li, e));
  });
  lista.addEventListener('drop', (e) => {
    const li = e.target.closest('li.strona');
    if (!ciagnieta || !li) return;
    e.preventDefault();
    przeniesStrone(ciagnieta, li.dataset.id, czyPo(li, e));
  });
  lista.addEventListener('dragend', () => { ciagnieta = null; znacznik(null); lista.querySelectorAll('.ciagnieta').forEach((x) => x.classList.remove('ciagnieta')); });
}

wlaczWygladEdytora(); // podpisy narzędzi i napisy na górnym pasku (#109)

// Jedna strona zamiast rozkładówki – ustawienie tego urządzenia. Przełącza je też widoczny przycisk obok
// powiększenia, pokazywany tylko w sekcjach z rozkładówkami (#148).
async function ustawJednaStrone(jedna) {
  try { localStorage.setItem(KLUCZ_JEDNA, jedna ? '1' : '0'); } catch { /* tryb prywatny */ }
  zapiszBiezacyCel();
  await zaladujCel({ dopasuj: true });
}
$('#widok-jedna').addEventListener('change', (e) => ustawJednaStrone(e.target.checked));
$('#przycisk-rozkladowka').addEventListener('click', () => ustawJednaStrone(!jednaStrona()));

// Uszlachetnienia (#127): efekt (połysk, metal, tłoczenie, biel) w edytorze i podglądzie – albo zwykły widok.
$('#widok-uszlachetnienia').addEventListener('change', (e) => {
  ustawPokazUszlachetnien(e.target.checked);
  edytor.canvas.getObjects().forEach((o) => { o.dirty = true; });
  edytor.canvas.requestRenderAll();
  stan.miniatury.clear();
});

// ---------- Skróty klawiszowe ----------

// Alt przy zaznaczonym elemencie: odległości do sąsiadów i krawędzi strony.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt' && document.body.dataset.ekran === 'edytor' && !$('dialog[open]')) { e.preventDefault(); edytor.pokazPomiary(true); }
});
document.addEventListener('keyup', (e) => { if (e.key === 'Alt') edytor.pokazPomiary(false); });
window.addEventListener('blur', () => edytor.pokazPomiary(false));

// ---------- Malarz formatów (#131C): „Kopiuj wygląd” i nałożenie kliknięciem na inny element ----------
const malarz = { wyglad: null, wielokrotny: false };
function ustawMalarza(wl) {
  document.body.classList.toggle('malarz-aktywny', wl);
  for (const b of document.querySelectorAll('[data-akcja="malarz"]')) b.setAttribute('aria-pressed', String(wl));
  odswiezWiecejNarzedzi();
}
function kopiujWyglad(wielokrotny = false) {
  const w = wygladZ(edytor.aktywny);
  if (!w) { powiadom(t('edytorStart.zaznaczElementKtoregoWyglad'), true); return false; }
  malarz.wyglad = w;
  malarz.wielokrotny = wielokrotny;
  ustawMalarza(true);
  powiadom(wielokrotny ? t('edytorStart.wygladSkopiowanyKlikajKolejne') : t('edytorStart.wygladSkopiowanyKliknijElement'));
  return true;
}
function zakonczMalarza() { malarz.wielokrotny = false; ustawMalarza(false); }
function nalozWygladNa(obj) {
  if (!obj || !malarz.wyglad || obj.zWzorca) return false;
  if (!nalozWyglad(obj, malarz.wyglad)) { powiadom(t('edytorStart.tenElementNiePrzyjmie'), true); return false; }
  edytor.canvas.requestRenderAll();
  edytor.zatwierdz();
  panel.odswiez();
  return true;
}
// Przycisk: zaznaczony fragment pisanego tekstu i skopiowany wygląd – nałożenie; inaczej kopiowanie wyglądu.
let ostatniMalarz = 0;
function malarzPrzycisk() {
  const akt = edytor.aktywny;
  const teraz = Date.now();
  const dwaRazy = teraz - ostatniMalarz < 400;
  ostatniMalarz = teraz;
  if (dwaRazy && malarz.wyglad) { malarz.wielokrotny = true; ustawMalarza(true); powiadom(t('edytorStart.wygladSkopiowanyKlikajKolejne')); return; }
  if (malarz.wyglad && akt?.isEditing && akt.selectionEnd > akt.selectionStart && document.body.classList.contains('malarz-aktywny')) { nalozWygladNa(akt); if (!malarz.wielokrotny) zakonczMalarza(); return; }
  if (document.body.classList.contains('malarz-aktywny')) { zakonczMalarza(); return; }
  kopiujWyglad(false);
}
edytor.canvas.on('mouse:up', (e) => {
  if (!document.body.classList.contains('malarz-aktywny') || !malarz.wyglad) return;
  const cel = e.target;
  if (!cel || cel === edytor.aktywny?.__malarzZrodlo) return;
  if (cel.isEditing) return; // zaznaczanie fragmentu – nałożenie przyciskiem albo Ctrl+Alt+V
  if (nalozWygladNa(cel) && !malarz.wielokrotny) zakonczMalarza();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('malarz-aktywny')) zakonczMalarza();
}, true);

const kontekstSkrotow = {
  edytor,
  znajdz: (zamiana) => otworzZnajdz({ zamiana }),
  malarzKopiuj: () => kopiujWyglad(false),
  malarzNaloz: () => { if (!malarz.wyglad) powiadom(t('edytorStart.najpierwSkopiujWygladCtrl'), true); else nalozWygladNa(edytor.aktywny); },
  cofnij: () => akcje.cofnij(),
  ponow: () => akcje.ponow(),
  widok: menuWidoku,
  zapisz: () => zapiszTeraz().then(() => synchronizuj()),
  wstawObraz: () => $('#plik-obraz').click(),
  przelaczProwadnice: () => akcje.prowadnice(),
  przelaczPanelPrawy: () => przelaczZakladkePrawa(),
  ostrzezenia: () => przelaczOstrzezenia(),
  podglad: () => pokazPodglad(),
  strona: (o) => przejdzDoStrony(stan.indeks + o),
  nowaStrona: () => dodajStrone(),
  pomoc: () => instrukcja.otworzRozdzial('Skróty klawiszowe'),
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') zamknijMenu();
  if (document.body.dataset.ekran === 'podglad' && e.key === 'Escape' && !$('dialog[open]') && !podglad.wPrezentacji) { zamknijPodglad(); return; }
  // Panel obok strony (Biblioteka, „Znajdź i zamień”) nie wyłącza skrótów na stronie – tylko w samym panelu.
  if (document.body.dataset.ekran !== 'edytor' || $('dialog[open]:not(.obok-strony)') || e.target.closest?.('dialog')) return;
  const cel = e.target;
  const wPolu = Boolean(cel !== document.body && cel.closest('input, textarea:not([data-fabric="textarea"]), select, [contenteditable]'));
  const wEdycji = Boolean(edytor.aktywny?.isEditing);
  if (edytor.rysuje && e.key === 'Escape') { e.preventDefault(); edytor.ustawRysowanie(false); return; }
  if (edytor.pioro && !wPolu) {
    if (e.key === 'Enter') { e.preventDefault(); edytor.zakonczKsztaltPiora(); return; }
    if (e.key === 'Escape') { e.preventDefault(); edytor.anulujPioro(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); edytor.cofnijPunktPiora(); return; }
  }
  if (edytor.edytujePunkty && !wPolu) {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); edytor.zakonczPunkty(e.key === 'Enter'); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); edytor.usunPunkt(); return; }
  }
  if (edytor.kadruje && !wPolu && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); edytor.zakonczKadrowanie(e.key === 'Enter'); return; }
  if (e.code === 'Space' && !wPolu && !wEdycji) { e.preventDefault(); edytor.ustawReke(true); return; }
  obsluzKlawisz(e, kontekstSkrotow, { wPolu, wEdycji });
});
document.addEventListener('keyup', (e) => { if (e.code === 'Space') edytor.ustawReke(false); });

async function zapiszTekstJako(format) {
  zamknijMenu();
  zapiszBiezacyCel();
  const [{ biblioteka }, E] = await Promise.all([import('../biblioteki.js'), import('../eksport-tekstu.js')]);
  const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'modułu ZIP');
  const akapity = E.akapityProjektu(stan.projekt);
  if (!akapity.length) { powiadom(t('edytorStart.wProjekcieNieMa'), true); return; }
  const blob = format === 'docx' ? await E.zapiszDocx(stan.projekt, JSZip, akapity) : await E.zapiszEpub(stan.projekt, JSZip, akapity);
  pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa || 'projekt')}.${format}`, URL.createObjectURL(blob));
  powiadom(t('edytorStart.zapisanoAkapitowJakoSama', { akapityIle: akapity.length, x: format === 'docx' ? t('edytorStart.dokumentWorda') : t('edytorStart.eBookEpub') }));
}

// Wklejanie (Ctrl+V): obraz ze schowka systemu – zrzut ekranu, skopiowany plik albo kod SVG –
// a gdy go tam nie ma, element skopiowany wcześniej w aplikacji.
document.addEventListener('paste', async (e) => {
  if (document.body.dataset.ekran !== 'edytor' || $('dialog[open]') || !stan.projekt) return;
  const cel = e.target;
  if (cel instanceof Element && cel.closest('input, textarea, select, [contenteditable]')) return; // także tekst edytowany na stronie
  if (edytor.aktywny?.isEditing || edytor.kadruje) return;
  const obrazy = obrazyZeSchowka(e.clipboardData);
  if (!obrazy.length && !maElementyDoWklejenia()) return;
  e.preventDefault();
  if (obrazy.length) for (const plik of obrazy) await wstawObraz(plik);
  else await wklejElementy(); // także z innego projektu – ze schowka urządzenia (#210)
});
window.addEventListener('blur', () => edytor.ustawReke(false));

// Po powrocie sieci najpierw zmiany z konta (np. od AI), potem wysyłka tego, co zostało na urządzeniu (#138).
window.addEventListener('online', () => { sprawdzKonto().finally(() => zaplanujChmure(500)); });
window.addEventListener('offline', () => { if (stan.projekt && stan.uzytkownik) stanZapisu('offline', 'Offline – zapisano na urządzeniu'); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && stan.projekt) zapiszTeraz();
});
// Zamknięcie albo przeładowanie karty zaraz po zmianie (#160): zapis w przeglądarce czekał jeszcze ok. 0,7 s
// i zmiana sprzed chwili ginęła (js/app/zapis.js, zapiszPrzyZamknieciu).
window.addEventListener('beforeunload', zapiszPrzyZamknieciu);
window.addEventListener('pagehide', zapiszPrzyZamknieciu);
let timerOkna = null;
window.addEventListener('resize', () => {
  clearTimeout(timerOkna);
  timerOkna = setTimeout(() => edytor.canvas.calcOffset(), 150);
});

podlaczSkladanke(); // kliknięcia narzędzi składanki na płótnie (#233)
podlaczKomiks(); // podział kadru kliknięciami (#364)

// Dostęp z konsoli, dla testów i skryptu zrzutów ekranu: część startowa (js/aplikacja.js) tworzy
// window.seriodruk, a tu dochodzi to, co ma edytor. `edytor` daje tamta część (zawsze aktualny).
Object.assign(window.seriodruk, {
  opisObiektu, otworzProjekt, przejdzDoStrony, edytujWzorzec, otworzUstawieniaSekcji, domyslneStyle, zapiszTeraz, dane, oknoCzcionek, oknoKontroli,
  // Wczytuje otwartą stronę od nowa z projektu, porzucając to, co jest na płótnie (do testów).
  przeladuj: async () => { odlaczPlotno(); await zaladujCel(); },
});
// Okno PDF powstaje przy pierwszym otwarciu.
Object.defineProperty(window.seriodruk, 'oknoPdf', { get: () => oknoPdf, configurable: true });

// Dla reszty aplikacji (js/app/doczytaj.js): to, co wywołuje się spoza edytora.
// Kod QR albo kod kreskowy EAN-13 / ISBN (#128) – jedna funkcja wstawiająca (paleta poleceń, potem Biblioteka, #134).
export function wstawKod(rodzaj = 'qr') {
  return edytor.dodajKod(rodzaj === 'ean' ? 'ean' : 'qr');
}
const wEdytorze = () => document.body.dataset.ekran === 'edytor' && Boolean(stan.projekt);
// Praca (#131C): znajdź i zamień, malarz formatów, Moje elementy, pisownia.
dodajPolecenie({ nazwa: 'Komentarze', opis: t('edytorStart.listaKomentarzyProjektuPrzycisk'), wykonaj: () => otworzKomentarze(), dostepne: () => Boolean(stan.projekt) });
dodajPolecenie({ nazwa: 'Dodaj komentarz', opis: t('edytorStart.narzedzieKomentarzKliknijMiejsce'), wykonaj: () => narzedzieKomentarz(), dostepne: wEdytorze });
dodajPolecenie({ nazwa: 'Znajdź i zamień', opis: t('edytorStart.tekstyWszystkichStronI'), wykonaj: () => otworzZnajdz(), dostepne: wEdytorze });
dodajPolecenie({ nazwa: 'Kopiuj wygląd', opis: t('edytorStart.malarzFormatowWygladZaznaczonego'), wykonaj: () => kopiujWyglad(false), dostepne: () => wEdytorze() && Boolean(edytor.aktywny) });
dodajPolecenie({ nazwa: 'Zapisz w bibliotece', opis: t('edytorStart.zaznaczenieTrafiDoBiblioteki'), wykonaj: () => zapiszWBibliotece(), dostepne: () => wEdytorze() && Boolean(edytor.aktywny) });
dodajPolecenie({ nazwa: 'Moje elementy', opis: t('edytorStart.bibliotekaElementyZapisaneNa'), wykonaj: () => otworzBiblioteke('moje'), dostepne: wEdytorze });
dodajPolecenie({ nazwa: 'Sprawdzaj pisownię', opis: t('edytorStart.wlaczAlboWylaczFalista'), wykonaj: () => { sprawdzanie.ustawWlaczona(!sprawdzanie.wlaczona()); panel.zbuduj(); }, dostepne: wEdytorze });
podlaczPisownie();
ustawPisowniePanelu(sprawdzanie);
$('#widok-pisownia').addEventListener('change', (e) => { sprawdzanie.ustawWlaczona(e.target.checked); panel.zbuduj(); });

// Książka (#131B): spis treści, skorowidz, przypis, hasło skorowidza.
const poKsiazce = () => { zaplanujZapis(); setTimeout(() => odswiezKsiazke().catch((e) => console.error(e)), 50); };
const zTekstem = () => wEdytorze() && edytor.aktywny?.type === 'textbox';
dodajPolecenie({ nazwa: 'Wstaw spis treści', opis: t('edytorStart.rozdzialyZNumeramiStron'), wykonaj: () => { edytor.dodajElementKsiazki('spis'); poKsiazce(); }, dostepne: wEdytorze });
dodajPolecenie({ nazwa: 'Wstaw skorowidz', opis: t('edytorStart.haslaAlfabetycznieZNumerami'), wykonaj: () => { edytor.dodajElementKsiazki('skorowidz'); poKsiazce(); }, dostepne: wEdytorze });
dodajPolecenie({ nazwa: 'Wstaw przypis', opis: t('edytorStart.przypisDolnyWMiejscu'), wykonaj: () => { edytor.wstawPrzypis(''); poKsiazce(); panel.zbuduj(); }, dostepne: zTekstem });
dodajPolecenie({ nazwa: 'Dodaj do skorowidza', opis: t('edytorStart.zaznaczoneSlowoTrafiaDo'), wykonaj: () => { if (edytor.dodajDoSkorowidza()) poKsiazce(); else powiadom(t('edytorStart.zaznaczSlowoWPisanym'), true); }, dostepne: zTekstem });
dodajPolecenie({ nazwa: 'Wstaw kod QR', opis: t('edytorStart.adresTekstEMail'), wykonaj: () => wstawKod('qr'), dostepne: wEdytorze });
dodajPolecenie({ nazwa: 'Wstaw kod kreskowy EAN / ISBN', opis: t('edytorStart.ean13AlboIsbn'), wykonaj: () => wstawKod('ean'), dostepne: wEdytorze });

export { otworzProjekt, zapiszTeraz, sprawdzKonto, synchronizuj, poWysylkach, pokazEdytor } from './zapis.js';
export { pokazPodglad, otworzUdostepnianie } from './podglad-ekran.js';
export { przejdzDoStrony } from './lista-stron.js';
// Dla raportu po imporcie (#232, projekty.js): pokazanie elementu i okno „Sprawdź przed drukiem”.
export const pokazElement = (idStrony, idObiektu) => oknoKontroli.zrodlo.pokaz(idStrony, idObiektu);
export const otworzKontrole = () => oknoKontroli.otworz();
export { edytujWzorzec } from './wzorce.js';

// Zestaw marki z konta (#131D): kolory i czcionki marki w wyborze koloru i na liście czcionek od razu.
// Kilka zestawów marki (#211): projekt może mieć swój zestaw (projekt.zestaw_marki) – wtedy to on jest „marką”
// w wyborze koloru, czcionkach i Bibliotece; bez niego – zestaw w użyciu z ustawień konta.
import('../zestaw-marki.js').then((m) => {
  m.ustawZrodloZestawuProjektu(() => stan.projekt?.zestaw_marki || null);
  if (stan.uzytkownik) m.wczytajMarke();
}).catch(() => {});
// Wybór zestawu w oknie marki przy otwartym projekcie – projekt go zapamiętuje.
document.addEventListener('zestaw-marki-wybrany', (e) => {
  if (!stan.projekt || stan.projekt.zestaw_marki === e.detail) return;
  stan.projekt.zestaw_marki = e.detail;
  zaplanujZapis();
});

// ---------- Telefon: ⋯ paska wstawiania (#139, #142) ----------
// Narzędzia, które nie mieszczą się w pasku na małym ekranie (wielokąt, rysowanie, pióro, komentarz, „Kopiuj
// wygląd”), są w menu pod ⋯. Gdy któreś działa, ⋯ pokazuje jego ikonę i jest wciśnięty – stuknięcie kończy narzędzie.
const NARZEDZIA_W_MENU = ['rysuj', 'pioro', 'komentarz'];
function aktywneZMenu() {
  if (document.body.classList.contains('malarz-aktywny')) return 'malarz';
  return NARZEDZIA_W_MENU.find((a) => $(`.pasek-narzedzi [data-akcja="${a}"]`)?.getAttribute('aria-pressed') === 'true') || null;
}
export function odswiezWiecejNarzedzi() {
  const b = $('#przycisk-narzedzia-wiecej');
  if (!b) return;
  const akt = aktywneZMenu();
  const nazwa = akt || 'wiecej';
  if (b.dataset.ikona !== nazwa) {
    b.dataset.ikona = nazwa;
    b.querySelector(':scope > svg.ikona')?.remove();
    b.insertAdjacentHTML('afterbegin', ikona(nazwa));
  }
  const etykieta = akt ? `Zakończ: ${$(`#menu-narzedzi [data-akcja="${akt}"]`).textContent.trim()}` : 'Więcej narzędzi';
  // Tylko przy zmianie – obserwator paska reaguje na każdy zapis atrybutu.
  if (b.getAttribute('aria-pressed') !== String(Boolean(akt))) b.setAttribute('aria-pressed', String(Boolean(akt)));
  if (b.getAttribute('aria-label') !== etykieta) { b.setAttribute('aria-label', etykieta); b.title = etykieta; }
}
$('#przycisk-narzedzia-wiecej')?.addEventListener('click', (e) => {
  const akt = aktywneZMenu();
  if (akt) { zamknijMenu(); if (akt === 'malarz') zakonczMalarza(); else akcje[akt](); return; }
  const menu = $('#menu-narzedzi');
  $('#menu-narzedzi-malarz').disabled = !edytor.aktywny;
  const r = e.currentTarget.getBoundingClientRect();
  menu.style.top = `${Math.round(r.bottom + 6)}px`;
  przelaczMenu(e.currentTarget, menu);
  if (menu.hidden) return;
  menu.style.translate = '';
  const w = menu.offsetWidth;
  menu.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - 8 - w, r.right - w)))}px`;
});
$('#menu-narzedzi')?.addEventListener('click', (e) => { if (e.target.closest('button')) zamknijMenu(); });

// Wielokąt albo gwiazda (#151): wybór kształtu z podglądem zamiast samego trójkąta – liczbę boków i gwiazdę
// można potem zmienić we Właściwościach → Kształt.
function otworzWyborWielokata() {
  const menu = $('#menu-wielokata');
  if (!menu.childElementCount) {
    menu.innerHTML = `<div class="siatka-wielokatow">${WIELOKATY.map(([n, g, nazwa]) => {
      return `<button role="menuitem" data-boki="${n}" data-gwiazda="${g ? 1 : ''}" title="${nazwa}" aria-label="${nazwa}">${podgladWielokata(n, g)}<span>${nazwa}</span></button>`;
    }).join('')}</div><p class="podpowiedz-menu">Liczbę boków i gwiazdę zmienisz potem we Właściwościach → Kształt.</p>`;
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-boki]');
      if (!b) return;
      zamknijMenu();
      edytor.dodajWielokat(Number(b.dataset.boki), Boolean(b.dataset.gwiazda));
    });
  }
  const naPasku = $('.pasek-narzedzi [data-akcja="dodaj-wielokat"]');
  const kotwica = naPasku?.offsetParent ? naPasku : $('#przycisk-narzedzia-wiecej');
  if (!kotwica) { edytor.dodajWielokat(); return; }
  const r = kotwica.getBoundingClientRect();
  menu.style.top = `${Math.round(r.bottom + 6)}px`;
  menu.style.left = '0px';
  przelaczMenu(kotwica, menu);
  if (menu.hidden) return;
  menu.style.translate = '';
  const w = menu.offsetWidth;
  menu.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - 8 - w, r.left + r.width / 2 - w / 2)))}px`;
}
new MutationObserver(odswiezWiecejNarzedzi).observe($('#pasek-narzedzi'), { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });

$('#seria-programy-ok').addEventListener('click', async (e) => {
  e.preventDefault();
  const dlg = $('#dlg-seria-programy');
  dlg.close();
  const program = dlg.querySelector('input[name="program"]:checked')?.value || 'indesign';
  const [{ biblioteka }, { pakietSerii }] = await Promise.all([import('../biblioteki.js'), import('../eksport-serii.js')]);
  try {
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'modułu ZIP');
    const XLSX = program === 'word' ? await biblioteka('js/zewnetrzne/xlsx-0.18.5.full.min.js', 'XLSX', 'obsługi plików Excela') : null;
    powiadom(t('edytorStart.przygotowujeSzablonIDane'));
    const w = await pakietSerii(stan.projekt, program, JSZip, { XLSX });
    pobierz(w.nazwa, URL.createObjectURL(w.blob));
    powiadom(t('edytorStart.pobranoSzablonIDane', { x: w.pola.map((p) => `{${p}}`).join(', ') || '–', wierszy: w.wierszy, x2: w.obrazow ? t('edytorStart.obrazow', { obrazow: w.obrazow }) : '' }));
  } catch (e) { powiadom(t('edytorStart.nieUdaloSiePrzygotowac2', { message: e.message }), true); }
});
