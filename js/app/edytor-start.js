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
import { toZaznaczenie } from '../fabric-ustawienia.js';
import { opisObiektu } from '../edytor.js';
import { obrazyZeSchowka, uporzadkujPlikSvg } from '../wklejanie.js';
import { przyjmijPlik } from '../obrazy-projektu.js';
import { wybierzZrodloObrazu } from './zrodlo-obrazu.js';
import { OknoKontroli } from '../okno-kontroli.js';
import { obsluzKlawisz } from '../skroty.js';
import { $, powiadom, pobierz, bezpiecznaNazwa, zamknijMenu, przelaczMenu } from '../ui.js';
import { NAZWA } from '../marka.js';
import { domyslneStyle } from '../style-tekstu.js';
import { stan, edytor, biezacyCel, biezacaSekcja, jednaStrona, KLUCZ_JEDNA } from './kontekst.js';
import { podlaczArkusze } from './arkusze.js';
import { wczytajPlikProjektu } from './projekty.js';
import {
  naPlotnie, zapiszBiezacyCel, cofnijKrok, zaplanujZapis, wybierzStroneArkusza, zaladujCel,
  zapiszTeraz, synchronizuj, zaplanujChmure, stanZapisu, otworzProjekt, odlaczPlotno,
} from './zapis.js';
import {
  pokazPodglad, otworzUdostepnianie, opublikujUdostepnienie, wylaczUdostepnienie,
  kopiujLinkUdostepnienia, zamknijPodglad, zapiszOchroneLinku,
} from './podglad-ekran.js';
import { NAZWY_POL_DOKUMENTU, tabeleStrony } from './panel-strony.js';
import { polePoTabelach } from '../serie.js';
import { panel, instrukcja, podglad, dane, menuWidoku, oknoCzcionek, podmiana } from './skladniki.js';
import {
  dodajStrone, indeksZMenu, zmienNazweStrony, duplikujStrone, usunStrone, przesunStrone, sekcjaZMenu,
  wzorzecZMenu, ustawZakladke, przeniesStrone, przejdzDoStrony, piszNaInnejStronie,
} from './lista-stron.js';
import { otworzUstawieniaSekcji, przesunSekcje, usunSekcje } from './sekcje.js';
import {
  dodajWzorzec, zmienNazweWzorca, duplikujWzorzecZ, usunWzorzec, przesunWzorzec, wrocDoStron, edytujWzorzec, otworzWzorce, dodajWzorzecStandardowy, przelaczWzorzecNaStronie, przelaczWzorzecWSekcji,
} from './wzorce.js';

const OPIS_OSTRZEZEN = {
  poza_strona: 'Poza stroną – nie będzie widoczny w druku.',
  poza_spadem: 'Wychodzi poza spad – część zostanie ucięta.',
  w_marginesie: 'Wchodzi w margines – może zostać przycięty.',
  nieznane_pole: 'Pole w klamrach nie pasuje do kolumny tabeli tej strony ani do pola dokumentu.',
  nie_miesci_sie: 'Tekst nie mieści się w ramce – dół zostanie ucięty.',
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
  if (!lista.length) {
    const li = document.createElement('li');
    li.className = 'brak';
    li.textContent = 'Wszystko mieści się w marginesach.';
    ul.append(li);
    return;
  }
  for (const o of lista) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="opis" role="button" tabindex="0" title="Zaznacz element"><strong></strong><span></span></span><button class="przycisk" title="To celowe – nie pokazuj ostrzeżenia dla tego elementu">Wycisz</button>';
    $('strong', li).textContent = o.obiekt;
    $('.opis span', li).textContent = OPIS_OSTRZEZEN[o.typ];
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
    powiadom('To nie jest plik obrazu.', true);
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
      powiadom('Rysunek ma napisy – jako obraz pokaże je czcionką zastępczą. „Rozłóż rysunek na elementy” we właściwościach zamieni je w zwykłe napisy z czcionkami zestawu.');
    }
  } catch (e) {
    powiadom(e.message, true);
  }
}

// Nowe zdjęcie w ramce zaznaczonego obrazu (przycisk „Podmień zdjęcie” we właściwościach).
async function podmienObraz(obj, plik) {
  if (!plik.type.startsWith('image/')) { powiadom('To nie jest plik obrazu.', true); return; }
  if (!edytor.canvas.getObjects().includes(obj) && !obj.group) return; // obraz zniknął ze strony w międzyczasie
  try {
    const gotowy = plik.type === 'image/svg+xml' ? await uporzadkujPlikSvg(plik) : plik;
    // Jak przy wstawianiu: nowe zdjęcie trafia do „Obrazów projektu” (bez kopii tego samego pliku). Poprzednie
    // zostaje tam jako obraz projektu – jeśli nigdzie go już nie ma, widać przy nim „nieużywany”.
    const { id, nazwa } = await przyjmijPlik(stan.projekt, gotowy, plik.name);
    await edytor.podmienObraz(obj, null, nazwa, stan.projekt.zasoby, { id });
    panel.zbuduj();
  } catch (blad) {
    powiadom(blad.message || 'Nie udało się podmienić zdjęcia.', true);
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
    powiadom(blad.message || 'Nie udało się podmienić zdjęcia.', true);
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
    const { pngCelu } = await import('../eksport.js'); // eksport wczytuje się przy pierwszym użyciu
    pobierz(`${bezpiecznaNazwa(stan.projekt.nazwa)}-${bezpiecznaNazwa(nazwa)}.png`, await pngCelu(stan.projekt, cel, 300));
  } catch (blad) {
    powiadom(blad.message || 'Nie udało się przygotować obrazu.');
  }
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
});

// Okno eksportu PDF razem z całym zapisem PDF (pdf-lib, czcionki, profile barwne) wczytuje się przy pierwszym
// otwarciu – edytor bez eksportu jest o kilkaset kilobajtów lżejszy.
let oknoPdf = null;
async function otworzOknoPdf() {
  if (!oknoPdf) {
    const czekaj = setTimeout(() => powiadom('Wczytuję eksport PDF…'), 400);
    try {
      const { OknoPdf } = await import('../okno-pdf.js');
      oknoPdf ||= new OknoPdf({
        projekt: () => stan.projekt,
        sekcja: () => (stan.tryb === 'strona' ? biezacaSekcja() : stan.projekt.sekcje[0]),
        przedEksportem: zapiszBiezacyCel,
      });
    } catch (e) {
      powiadom(`Nie udało się wczytać eksportu PDF: ${e.message}`, true);
      return;
    } finally {
      clearTimeout(czekaj);
    }
  }
  oknoPdf.otworz();
}

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
  'podglad-zamknij': zamknijPodglad,
  'podglad-plus': () => podglad.powieksz(1.25),
  'podglad-minus': () => podglad.powieksz(0.8),
  'podglad-dopasuj': () => podglad.dopasuj(),
  'podglad-prezentacja': () => podglad.prezentuj(),
  png: () => { zamknijMenu(); pobierzPng(); },
  pdf: () => { zamknijMenu(); otworzOknoPdf(); },
  czcionki: () => { zamknijMenu(); oknoCzcionek.otworz(); },
  // Wiele zdjęć naraz – np. dla obrazów z danych (nazwy plików w tabeli); także na telefonie.
  obrazy: async () => { zamknijMenu(); (await oknoObrazow()).otworzObrazy(); },
  kontrola: () => { zamknijMenu(); oknoKontroli.otworz(); },
  wydruk: () => otworzUstawieniaSekcji(biezacaSekcja().id),
  'obroc-format': () => {
    const f = $('#dlg-sekcja form');
    [f.elements.szerokosc_mm.value, f.elements.wysokosc_mm.value] = [f.elements.wysokosc_mm.value, f.elements.szerokosc_mm.value];
  },

  'strona-dodaj': () => dodajStrone(),
  'strona-nazwa': przezMenu(indeksZMenu, zmienNazweStrony),
  'strona-duplikuj': przezMenu(indeksZMenu, duplikujStrone),
  'strona-usun': przezMenu(indeksZMenu, usunStrone),
  'strona-gora': przezMenu(indeksZMenu, (i) => przesunStrone(i, -1)),
  'strona-dol': przezMenu(indeksZMenu, (i) => przesunStrone(i, 1)),

  'sekcja-dodaj': () => otworzUstawieniaSekcji(null),
  'sekcja-ustawienia': przezMenu(sekcjaZMenu, otworzUstawieniaSekcji),
  'sekcja-strona': przezMenu(sekcjaZMenu, dodajStrone),
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
  'dodaj-elipse': () => edytor.dodajElipse(),
  'dodaj-linie': () => edytor.dodajLinie(),
  'dodaj-wielokat': () => edytor.dodajWielokat(),
  // Narzędzie „Obraz”: z urządzenia albo z obrazów projektu (bez obrazów w projekcie – od razu wybór pliku).
  'dodaj-obraz': () => wybierzZrodloObrazu({
    tytul: 'Wstaw obraz',
    zUrzadzenia: () => $('#plik-obraz').click(),
    zProjektu: async () => (await oknoObrazow()).otworzObrazy({ wybierz: { etykieta: 'Wstaw', fn: wstawZProjektu } }),
  }),
  rysuj: () => edytor.ustawRysowanie(!edytor.rysuje),
  pioro: () => edytor.ustawPioro(!edytor.pioro),
  'dodaj-tabele': () => { $('#dlg-tabela').returnValue = ''; $('#dlg-tabela').showModal(); },
  cofnij: () => cofnijKrok(-1),
  ponow: () => cofnijKrok(1),
  duplikuj: () => edytor.duplikuj(),
  kopiuj: async () => { if (await edytor.kopiuj()) powiadom('Skopiowano. Wklej na tej albo innej stronie: Ctrl+V lub „Wklej” we właściwościach strony.'); },
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

$('#zakladki-panelu').addEventListener('change', (e) => ustawZakladke(e.target.value));

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
$('#przycisk-widok').addEventListener('click', (e) => { menuWidoku.odswiez(); $('#widok-jedna').checked = jednaStrona(); przelaczMenu(e.currentTarget, $('#menu-widoku')); });
$('#naglowek-ostrzezen').addEventListener('click', (e) => {
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
  try { await (await oknoObrazow()).wgrajObrazy(pliki); } catch (blad) { powiadom(`Nie udało się wgrać obrazów: ${blad.message}`, true); }
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
  podmiana.obj = null;
  if (plik && obj) await podmienObraz(obj, plik);
  e.target.value = '';
});

const kontener = $('#kontener-plotna');
kontener.addEventListener('dragover', (e) => e.preventDefault());
kontener.addEventListener('drop', (e) => {
  e.preventDefault();
  for (const plik of e.dataTransfer.files) {
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
  powiadom('Ten element leży na sąsiedniej stronie i przechodzi przez grzbiet. Zmienisz go na jego stronie albo w widoku rozkładówki.', false, {
    etykieta: 'Pokaż rozkładówkę',
    fn: () => { const p = $('#widok-jedna'); p.checked = false; p.dispatchEvent(new Event('change')); },
  });
});
edytor.addEventListener('rysowanie', (e) => {
  $('[data-akcja="rysuj"]').setAttribute('aria-pressed', String(e.detail));
  if (e.detail) powiadom('Rysowanie odręczne: przeciągaj po stronie. Esc albo ponowne kliknięcie „Rysuj” kończy.');
});
edytor.addEventListener('pioro', (e) => {
  $('[data-akcja="pioro"]').setAttribute('aria-pressed', String(e.detail));
  if (e.detail) powiadom('Pióro: kliknij, żeby postawić punkt; kliknij i przeciągnij, żeby zrobić łuk. Enter kończy kształt, kliknięcie w pierwszy punkt go zamyka.');
});
edytor.addEventListener('punkty', (e) => {
  if (e.detail) powiadom('Edycja punktów: przeciągaj punkty i uchwyty. Podwójne kliknięcie w linię dodaje punkt, Delete usuwa zaznaczony, Enter kończy.');
});
edytor.addEventListener('schowek', () => { if (!edytor.aktywny) panel.zbuduj(); });
edytor.addEventListener('ostrzezenia', (e) => renderujOstrzezenia(e.detail));
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

// Jedna strona zamiast rozkładówki – ustawienie tego urządzenia.
$('#widok-jedna').addEventListener('change', async (e) => {
  try { localStorage.setItem(KLUCZ_JEDNA, e.target.checked ? '1' : '0'); } catch { /* tryb prywatny */ }
  zapiszBiezacyCel();
  await zaladujCel({ dopasuj: true });
});

// ---------- Skróty klawiszowe ----------

// Alt przy zaznaczonym elemencie: odległości do sąsiadów i krawędzi strony.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt' && document.body.dataset.ekran === 'edytor' && !$('dialog[open]')) { e.preventDefault(); edytor.pokazPomiary(true); }
});
document.addEventListener('keyup', (e) => { if (e.key === 'Alt') edytor.pokazPomiary(false); });
window.addEventListener('blur', () => edytor.pokazPomiary(false));

const kontekstSkrotow = {
  edytor,
  cofnij: () => akcje.cofnij(),
  ponow: () => akcje.ponow(),
  widok: menuWidoku,
  zapisz: () => zapiszTeraz().then(() => synchronizuj()),
  wstawObraz: () => $('#plik-obraz').click(),
  przelaczProwadnice: () => akcje.prowadnice(),
  podglad: () => pokazPodglad(),
  strona: (o) => przejdzDoStrony(stan.indeks + o),
  nowaStrona: () => dodajStrone(),
  pomoc: () => instrukcja.otworzRozdzial('Skróty klawiszowe'),
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') zamknijMenu();
  if (document.body.dataset.ekran === 'podglad' && e.key === 'Escape' && !$('dialog[open]') && !podglad.wPrezentacji) { zamknijPodglad(); return; }
  if (document.body.dataset.ekran !== 'edytor' || $('dialog[open]')) return;
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

// Wklejanie (Ctrl+V): obraz ze schowka systemu – zrzut ekranu, skopiowany plik albo kod SVG –
// a gdy go tam nie ma, element skopiowany wcześniej w aplikacji.
document.addEventListener('paste', async (e) => {
  if (document.body.dataset.ekran !== 'edytor' || $('dialog[open]') || !stan.projekt) return;
  const cel = e.target;
  if (cel instanceof Element && cel.closest('input, textarea, select, [contenteditable]')) return; // także tekst edytowany na stronie
  if (edytor.aktywny?.isEditing || edytor.kadruje) return;
  const obrazy = obrazyZeSchowka(e.clipboardData);
  if (!obrazy.length && !edytor.maSchowek) return;
  e.preventDefault();
  if (obrazy.length) for (const plik of obrazy) await wstawObraz(plik);
  else edytor.wklej();
});
window.addEventListener('blur', () => edytor.ustawReke(false));

window.addEventListener('online', () => zaplanujChmure(500));
window.addEventListener('offline', () => { if (stan.projekt && stan.uzytkownik) stanZapisu('offline', 'Offline – zapisano na urządzeniu'); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && stan.projekt) zapiszTeraz();
});
window.addEventListener('beforeunload', () => {
  if (stan.timerZapisu && stan.projekt) zapiszBiezacyCel();
});
let timerOkna = null;
window.addEventListener('resize', () => {
  clearTimeout(timerOkna);
  timerOkna = setTimeout(() => edytor.canvas.calcOffset(), 150);
});

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
export { otworzProjekt, zapiszTeraz, sprawdzKonto, synchronizuj, pokazEdytor } from './zapis.js';
export { pokazPodglad, otworzUdostepnianie } from './podglad-ekran.js';
export { przejdzDoStrony } from './lista-stron.js';
export { edytujWzorzec } from './wzorce.js';
