// Plik startowy aplikacji: spina moduły z js/app/, podpina przyciski (data-akcja),
// zdarzenia edytora i skróty klawiszowe, a na końcu uruchamia aplikację.
//
// Moduły w js/app/:
//   kontekst.js      wspólny stan (otwarty projekt, edytor, historia) – od niego zależą pozostałe
//   skladniki.js     stałe części ekranu: panel właściwości, linijki, warstwy, okno danych, podgląd
//   zapis.js         płótno ↔ projekt, zapis w przeglądarce i na koncie, cofanie
//   trasy.js         adresy podstron (#/projekty, #/p/<id>/s/<id strony>…)
//   logowanie.js     ekran logowania i wylogowanie
//   projekty.js      ekran „Projekty”, nowy projekt, pliki .seriodruk
//   lista-stron.js   lista stron i wzorców, miniatury, operacje na stronach
//   sekcje.js        okno ustawień sekcji
//   wzorce.js        operacje na wzorcach
//   panel-strony.js  panel właściwości strony i wzorca, pola do wstawienia
//   podglad-ekran.js podgląd bez edycji i udostępnianie linkiem
//
// Moduły importują się nawzajem (funkcje), ale żaden nie zależy od tego pliku.

import { toZaznaczenie } from './fabric-ustawienia.js';
import { uid } from './projekt.js';
import { opisObiektu } from './edytor.js';
import { pngCelu } from './eksport.js';
import { obrazyZeSchowka, uporzadkujPlikSvg } from './wklejanie.js';
import { OknoPdf } from './okno-pdf.js';
import { wlaczWlasneKontrolki } from './kontrolki.js';
import { OknoKontroli } from './okno-kontroli.js';
import { obsluzKlawisz } from './skroty.js';
import { zaladujCzcionki } from './czcionki.js';
import * as chmura from './chmura.js';
import { wstawIkony } from './ikony.js';
import { $, powiadom, pobierz, bezpiecznaNazwa, zamknijMenu, przelaczMenu } from './ui.js';
import { NAZWA } from './marka.js';
import { przelaczMotyw } from './motyw.js';
import { domyslneStyle } from './style-tekstu.js';
import { stan, edytor, biezacyCel, biezacaSekcja, trasa, ustawPanel, jednaStrona, KLUCZ_JEDNA, pokazEkran } from './app/kontekst.js';
import {
  otworzNowyProjekt, doProjektow, wczytajPlikProjektu, plikiDoOtwarcia, otworzOczekujacePliki,
  pokazProjekty,
} from './app/projekty.js';
import {
  naPlotnie, zapiszBiezacyCel, cofnijKrok, zaplanujZapis, wybierzStroneArkusza, zaladujCel,
  zapiszTeraz, synchronizuj, zaplanujChmure, stanZapisu, otworzProjekt, odlaczPlotno,
} from './app/zapis.js';
import {
  pokazPodglad, otworzUdostepnianie, opublikujUdostepnienie, wylaczUdostepnienie,
  kopiujLinkUdostepnienia, zamknijPodglad, pokazUdostepniony,
} from './app/podglad-ekran.js';
import { NAZWY_POL_DOKUMENTU, tabeleStrony } from './app/panel-strony.js';
import { polePoTabelach } from './serie.js';
import { panel, instrukcja, podglad, dane, menuWidoku, oknoCzcionek } from './app/skladniki.js';
import {
  dodajStrone, indeksZMenu, zmienNazweStrony, duplikujStrone, usunStrone, przesunStrone, sekcjaZMenu,
  wzorzecZMenu, ustawZakladke, generujMiniatury, przeniesStrone, przejdzDoStrony,
} from './app/lista-stron.js';
import { otworzUstawieniaSekcji, przesunSekcje, usunSekcje } from './app/sekcje.js';
import { przejdzDoTrasy } from './app/trasy.js';
import { wyloguj, konto, odswiezNaglowek, poZalogowaniu } from './app/logowanie.js';
import {
  dodajWzorzec, zmienNazweWzorca, duplikujWzorzecZ, usunWzorzec, przesunWzorzec, wrocDoStron, edytujWzorzec, otworzWzorce, dodajWzorzecStandardowy, przelaczWzorzecNaStronie, przelaczWzorzecWSekcji,
} from './app/wzorce.js';

const OPIS_OSTRZEZEN = {
  poza_strona: 'Poza stroną – nie będzie widoczny w druku.',
  poza_spadem: 'Wychodzi poza spad – część zostanie ucięta.',
  w_marginesie: 'Wchodzi w margines – może zostać przycięty.',
  nieznane_pole: 'Pole w klamrach nie pasuje do kolumny tabeli tej strony ani do pola dokumentu.',
  nie_miesci_sie: 'Tekst nie mieści się w ramce – dół zostanie ucięty.',
};

window.addEventListener('popstate', () => przejdzDoTrasy());

// Motyw wybrany na koncie obowiązuje na każdym urządzeniu; zmiana motywu
// zapisuje się na koncie.
document.addEventListener('motyw', async (e) => {
  const u = stan.uzytkownik;
  if (!u || u.user_metadata?.motyw === e.detail.wybor) return;
  u.user_metadata = { ...u.user_metadata, motyw: e.detail.wybor };
  try { await chmura.zapiszMotyw(e.detail.wybor); } catch { /* zostaje na urządzeniu */ }
});

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
    const dataUrl = await chmura.blobNaDataUrl(gotowy);
    await edytor.dodajObraz(dataUrl, plik.name, stan.projekt.zasoby);
  } catch (e) {
    powiadom(e.message, true);
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

const oknoPdf = new OknoPdf({
  projekt: () => stan.projekt,
  sekcja: () => (stan.tryb === 'strona' ? biezacaSekcja() : stan.projekt.sekcje[0]),
  przedEksportem: zapiszBiezacyCel,
});

$('#dlg-tabela').addEventListener('close', (e) => {
  if (e.target.returnValue !== 'tak') return;
  const f = e.target.querySelector('form').elements;
  edytor.dodajTabele({ wiersze: Number(f.wiersze.value), kolumny: Number(f.kolumny.value), wysokoscWiersza: Number(f.wysokosc.value), naglowek: f.naglowek.checked });
});

const zMenu = (fn) => () => { const v = fn.zrodlo(); zamknijMenu(); fn(v); };
const przezMenu = (zrodlo, fn) => { const f = (v) => fn(v); f.zrodlo = zrodlo; return zMenu(f); };

const akcje = {
  'nowy-projekt': otworzNowyProjekt,
  instrukcja: () => instrukcja.otworz(0),
  'zamknij-instrukcje': () => instrukcja.zamknij(),
  wyloguj: () => wyloguj(false),
  'ustawienia-konta': () => { zamknijMenu(); trasa.ustaw('konto'); przejdzDoTrasy(); },
  'importuj-projekt': () => { zamknijMenu(); $('#plik-projekt').click(); },
  'do-projektow': doProjektow,
  motyw: () => { zamknijMenu(); przelaczMotyw(); },
  podglad: () => pokazPodglad(),
  udostepnij: otworzUdostepnianie,
  'udostepnij-zamknij': () => $('#dlg-udostepnij').close(),
  'udostepnij-utworz': opublikujUdostepnienie,
  'udostepnij-wylacz': wylaczUdostepnienie,
  'udostepnij-kopiuj': kopiujLinkUdostepnienia,
  'podglad-zamknij': zamknijPodglad,
  'podglad-plus': () => podglad.powieksz(1.25),
  'podglad-minus': () => podglad.powieksz(0.8),
  'podglad-dopasuj': () => podglad.dopasuj(),
  'podglad-prezentacja': () => podglad.prezentuj(),
  png: () => { zamknijMenu(); pobierzPng(); },
  pdf: () => { zamknijMenu(); oknoPdf.otworz(); },
  czcionki: () => { zamknijMenu(); oknoCzcionek.otworz(); },
  kontrola: () => { zamknijMenu(); oknoKontroli.otworz(); },
  wydruk: () => otworzUstawieniaSekcji(biezacaSekcja().id),
  'zamknij-panel': () => ustawPanel(''),
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
  'dodaj-obraz': () => $('#plik-obraz').click(),
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

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-akcja]');
  if (b && akcje[b.dataset.akcja]) {
    e.preventDefault();
    akcje[b.dataset.akcja]();
    return;
  }
  const z = e.target.closest('.zakladki-mobilne [data-panel]');
  if (z) ustawPanel(z.dataset.panel);
});

$('#awatar').addEventListener('click', (e) => przelaczMenu(e.currentTarget, $('#menu-uzytkownika')));
$('#przycisk-wiecej').addEventListener('click', (e) => przelaczMenu(e.currentTarget, $('#menu-wiecej')));
$('#przycisk-widok').addEventListener('click', (e) => { menuWidoku.odswiez(); $('#widok-jedna').checked = jednaStrona(); przelaczMenu(e.currentTarget, $('#menu-widoku')); });
$('#naglowek-ostrzezen').addEventListener('click', (e) => {
  const b = e.currentTarget;
  b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'));
});

// Obrazy do pól: trafiają do zasobów projektu pod nazwą pliku, bez wstawiania
// na stronę. Plik o nazwie, która już jest, zastępuje poprzedni.
$('#pliki-zasoby').addEventListener('change', async (e) => {
  const pliki = [...e.target.files];
  const { zasoby } = stan.projekt;
  for (const plik of pliki) {
    const dataUrl = await new Promise((ok, blad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => blad(r.error); r.readAsDataURL(plik); });
    const id = Object.keys(zasoby).find((k) => zasoby[k].nazwa === plik.name) || uid('z');
    zasoby[id] = { nazwa: plik.name, dataUrl };
  }
  e.target.value = '';
  if (!pliki.length) return;
  stan.miniatury.clear();
  generujMiniatury();
  zaplanujZapis();
  powiadom(`Wgrano ${pliki.length} ${pliki.length === 1 ? 'obraz' : 'obrazy/obrazów'}. W tabeli wpisz ich nazwy plików.`);
});

// Pole wyboru pliku czyścimy dopiero po wczytaniu – wyczyszczenie wcześniej
// potrafi unieważnić plik, zanim zostanie odczytany.
$('#plik-obraz').addEventListener('change', async (e) => {
  const plik = e.target.files[0];
  if (plik) await wstawObraz(plik);
  e.target.value = '';
});
$('#plik-projekt').addEventListener('change', async (e) => {
  const plik = e.target.files[0];
  if (plik) await wczytajPlikProjektu(plik);
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
// Pisany tekst przelał się do ramki na innej stronie – jedna podpowiedź, nie przy każdym znaku.
let ostatniaPodpowiedzWatku = 0;
edytor.addEventListener('tekst-na-innej-stronie', (e) => {
  if (Date.now() - ostatniaPodpowiedzWatku < 15000) return;
  ostatniaPodpowiedzWatku = Date.now();
  const i = stan.projekt.strony.findIndex((s) => s.id === e.detail);
  powiadom(`Ramka jest pełna – dalszy ciąg tekstu płynie na stronę ${i >= 0 ? `${i + 1} („${stan.projekt.strony[i].nazwa}”)` : 'następną'}.`);
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

// Dokument nie ma się przewijać (ekrany przewijają się w środku). Przeglądarka
// na telefonie potrafi go jednak przesunąć sama, np. gdy fokus dostaje pole
// tekstowe – a użytkownik nie ma jak go cofnąć. Wracamy wtedy na miejsce.
function dokumentNaMiejsce() {
  const pole = document.activeElement;
  if (pole && /^(INPUT|TEXTAREA|SELECT)$/.test(pole.tagName)) return; // klawiatura ekranowa w użyciu
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  if (document.body.scrollTop || document.body.scrollLeft) { document.body.scrollTop = 0; document.body.scrollLeft = 0; }
}
window.addEventListener('scroll', dokumentNaMiejsce, { passive: true });
document.body.addEventListener('scroll', dokumentNaMiejsce, { passive: true });
document.addEventListener('focusout', () => setTimeout(dokumentNaMiejsce, 150));

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

// ======================================================================
// Start
// ======================================================================

async function start() {
  wstawIkony();
  konto.inicjuj();

  // Link do udostępnionego podglądu działa bez logowania i bez edytora.
  if (trasa.odczytaj().ekran === 'udostepnione') {
    await pokazUdostepniony(trasa.odczytaj());
    return;
  }
  stan.czcionki = zaladujCzcionki();

  if (!chmura.chmuraSkonfigurowana()) {
    pokazEkran('logowanie');
    return;
  }
  // Powrót z linku w e-mailu (potwierdzenie konta, reset hasła, zmiana adresu)
  // odczytujemy, zanim biblioteka Supabase wyczyści adres.
  const powrot = konto.odczytajPowrot();
  try {
    await chmura.naZmianeSesji((uzytkownik, zdarzenie) => {
      if (zdarzenie === 'SIGNED_OUT') {
        if (!['logowanie', 'start'].includes(document.body.dataset.ekran)) {
          stan.uzytkownik = null;
          stan.projekt = null;
          konto.ustawTryb('logowanie');
          pokazEkran('logowanie');
        }
      } else if (uzytkownik && stan.uzytkownik && uzytkownik.id === stan.uzytkownik.id) {
        // Odświeżony token albo zmienione dane konta (np. potwierdzony nowy e-mail).
        stan.uzytkownik = uzytkownik;
        odswiezNaglowek();
        if (document.body.dataset.ekran === 'konto') konto.wypelnijUstawienia();
      }
    });
    const uzytkownik = await chmura.biezacyUzytkownik();
    if (powrot.blad) {
      pokazEkran('logowanie');
      konto.komunikat(powrot.blad);
    } else if (powrot.typ === 'recovery' && uzytkownik) {
      stan.uzytkownik = uzytkownik;
      konto.ustawTryb('nowe-haslo');
      pokazEkran('logowanie');
    } else if (uzytkownik) {
      await poZalogowaniu(uzytkownik); // otwiera adres z paska (np. odświeżony projekt)
      if (powrot.typ === 'signup') powiadom('Konto potwierdzone. Witaj w Seriodruku!');
      if (powrot.typ === 'email_change') powiadom('Adres e-mail został zmieniony.');
    } else {
      pokazEkran('logowanie');
    }
  } catch (e) {
    pokazEkran('logowanie');
    konto.komunikat(`Nie można połączyć się z serwerem: ${chmura.komunikatBledu(e)}`);
  }
}

// ---------- Aplikacja instalowana (PWA) ----------

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker:', e));
}
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async (params) => {
    for (const uchwyt of params.files || []) plikiDoOtwarcia.push(await uchwyt.getFile());
    if (stan.uzytkownik || stan.trybLokalny) otworzOczekujacePliki();
  });
}

start().catch((e) => {
  console.error(e);
  pokazEkran('logowanie');
  konto.komunikat(`Błąd startu: ${e.message}`);
});

// Dostęp z konsoli i dla skryptu zrzutów ekranu.
// Listy rozwijane i wybór koloru rysuje aplikacja, nie system (js/kontrolki.js).
wlaczWlasneKontrolki();

window.seriodruk = {
  stan, edytor, opisObiektu, instrukcja, poZalogowaniu, pokazProjekty, otworzProjekt,
  przejdzDoStrony, edytujWzorzec, otworzUstawieniaSekcji, domyslneStyle, zapiszTeraz, dane, oknoPdf, oknoCzcionek, oknoKontroli,
  // Wczytuje otwartą stronę od nowa z projektu, porzucając to, co jest na płótnie (do testów).
  przeladuj: async () => { odlaczPlotno(); await zaladujCel(); },
};
