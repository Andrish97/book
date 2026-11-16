// Otwarty projekt a płótno: wczytywanie strony albo wzorca na płótno, przepisywanie płótna do projektu,
// zapis (w przeglądarce i na koncie), historia cofania.

import { marginesyWzorca, tloStrony, marginesyStrony, normalizuj, stronyZWzorcem, kopiujProjekt } from '../projekt.js';
import { warstwyWzorcow } from '../zlozenie.js';
import { rozwin, arkuszStrony, bokStrony } from '../serie.js';
import { zapiszLokalnie, oznaczZsynchronizowany } from '../lokalny.js';
import { zapiszHistorie, wczytajHistorie, usunHistorie } from '../historia-zapis.js';
import * as chmura from '../chmura.js';
import { ikona } from '../ikony.js';
import { $, kiedy, potwierdz, powiadom } from '../ui.js';
import { NAZWA } from '../marka.js';
import { postep } from '../postep.js';
import { zaplanujAktualizacjeLinku, odswiezPodglad, OPOZNIENIE_LINKU_Z_KONTA_MS } from './podglad-ekran.js';
import { zarejestrujCzcionkiProjektu, zapewnijRodziny } from '../czcionki.js';
import { ramkiZInnychStron } from '../watki.js';
import { podlaczZasoby, kopiujPliki } from '../zasoby.js';
import { uzupelnijWymiary } from '../obrazy-projektu.js';
import { polaczProjekty, zastosujPolaczenie, postacDoPorownan, podstawaProjektu, tenSamStan, noweNagrobki, kanon } from '../laczenie.js';
import { toTabela, miejsceKomorki } from '../tabela-obiekt.js';
import { przeliczOkladki } from '../okladka.js';
import { przeliczKsiazke, uzywaKsiazki, przypisyStrony, poleKsiazki } from '../ksiazka.js';
import { stan, historia, edytor, wydrukCelu, biezacyCel, jednaStrona, trasa, pokazEkran, kolor, wlasciciel } from './kontekst.js';
import { odswiezPasekEdytora } from './panel-strony.js';
import { panel, linijki, panelWarstw, odswiezMojeCzcionki } from './skladniki.js';
import { ustawZakladke, generujMiniatury, renderujListe, oznaczBiezacaWLiscie, odswiezMiniature, odrysujMiniaturyWTle } from './lista-stron.js';

// Nazwa projektu w górnym pasku; pełna także w dymku – na wąskim ekranie pole bywa ucięte.
const pokazNazwe = (nazwa) => { const pole = $('#nazwa-projektu'); pole.value = nazwa; pole.title = nazwa; };

// ---------- Arkusz: strona albo cała rozkładówka na jednym płótnie ----------

// Co jest teraz wczytane do edytora: { wzorzec: id } albo { strony: [id, …] }
// (rozkładówka: lewa, prawa). null w trakcie wczytywania – wtedy płótna nie
// wolno przepisywać do projektu.
export let naPlotnie = null;

// Odłącza płótno od projektu: to, co na nim jest, nie zostanie przepisane do projektu.
export function odlaczPlotno() { naPlotnie = null; }
// Projekt otwarty prosto w podglądzie (przycisk „Podgląd” na kafelku): płótno edytora wczytuje się
// dopiero przy przejściu do edycji – bez mignięcia edytora przed podglądem.
export let plotnoOdlozone = false;

// Pokazuje ekran edytora; wczytuje płótno, jeśli projekt otwarto prosto w podglądzie.
export async function pokazEdytor() {
  pokazEkran('edytor');
  if (plotnoOdlozone) {
    plotnoOdlozone = false;
    await zaladujCel({ dopasuj: true });
  }
  edytor.canvas.calcOffset();
}

// Okno, przy którym krok historii czeka, a cofanie nie działa. Panele obok strony (Biblioteka,
// „Znajdź i zamień”) nie blokują – zmiany z nich da się cofać, gdy panel jest jeszcze otwarty.
const OKNO_BLOKUJACE = 'dialog[open]:not(.obok-strony)';

// Przepisuje płótno do projektu i zapamiętuje stan jako krok historii.
// W trakcie kadrowania i edycji punktów płótno ma stan przejściowy (np. obraz z grupy leży na czas kadrowania nad
// nią) – takiego stanu nie wolno zapisać jako kroku cofania ani do projektu; krok powstaje po zakończeniu (#137).
const stanPrzejsciowy = () => Boolean(edytor.kadruje || edytor.edytujePunkty);

function zapamietajStan() {
  clearTimeout(stan.timerHistorii);
  if (!stan.projekt || !stan.doHistorii) return;
  if (stanPrzejsciowy()) { stan.timerHistorii = setTimeout(zapamietajStan, 300); return; }
  stan.doHistorii = false;
  zapiszBiezacyCel();
  historia.zapisz(stan.projekt);
  odswiezCofanie();
}

// kierunek: −1 cofnij, 1 ponów. Po cofnięciu edytor otwiera stronę albo
// wzorzec, którego dotyczyła zmiana.
export async function cofnijKrok(kierunek) {
  const p = stan.projekt;
  if (!p || $(OKNO_BLOKUJACE)) return;
  zapamietajStan();
  const zaznaczony = edytor.aktywny?.id;
  const zmiana = kierunek < 0 ? historia.cofnij(p) : historia.ponow(p);
  if (!zmiana) return;
  naPlotnie = null; // płótno pokazuje stan sprzed cofnięcia – nie wolno go przepisać do projektu
  const strona = p.strony.findIndex((s) => zmiana.strony.includes(s.id));
  const wzorzec = p.wzorce.find((w) => zmiana.wzorce.includes(w.id));
  const naPlotnieWzorzec = stan.tryb === 'wzorzec' && p.wzorce.some((w) => w.id === stan.idWzorca);
  if (wzorzec && (naPlotnieWzorzec || strona < 0)) { stan.tryb = 'wzorzec'; stan.idWzorca = wzorzec.id; }
  else if (strona >= 0) { stan.tryb = 'strona'; stan.indeks = strona; }
  else if (!naPlotnieWzorzec) stan.tryb = 'strona';
  stan.indeks = Math.min(Math.max(0, stan.indeks), p.strony.length - 1);
  stan.miniatury.clear();
  pokazNazwe(p.nazwa);
  ustawZakladke(stan.tryb === 'wzorzec' ? 'wzorce' : (stan.zakladka === 'warstwy' ? 'warstwy' : 'strony'));
  await zaladujCel();
  if (zaznaczony) edytor.zaznacz(zaznaczony);
  panel.zbuduj();
  odswiezCofanie();
  generujMiniatury();
  zaplanujZapis({ historia: false });
}

// Historia cofania zapisana na urządzeniu (js/historia-zapis.js) – po zamknięciu i ponownym otwarciu
// projektu „Cofnij” działa dalej. Zapis idzie po każdym zapisie projektu w przeglądarce, razem z numerem
// wersji z konta: po nim przy otwarciu poznajemy, czy w międzyczasie coś przyszło z innego urządzenia.
async function zachowajHistorie(p) {
  if (p !== stan.projekt) return;
  try {
    await zapiszHistorie(wlasciciel(), { id: p.id, wersja_chmury: p.wersja_chmury }, historia.doZapisu());
  } catch { /* bez historii na dysku cofanie działa do zamknięcia projektu, jak dawniej */ }
}

// Przy otwarciu projektu: zapisana historia wraca tylko wtedy, gdy na pewno pasuje do projektu.
// - jej ostatni krok to dokładnie ten projekt – wraca bez zmian;
// - projekt różni się, ale numer wersji z konta jest ten sam – różnicę zrobiono na tym urządzeniu (zmiana tuż
//   przed zamknięciem nie zdążyła stać się krokiem); staje się nowym krokiem;
// - numer wersji jest inny – projekt zmieniono na innym urządzeniu; historia zaczyna się od nowa, żeby
//   cofnięcie nie nadpisało tamtych zmian. (Gdy projekt otwiera się z kopii na urządzeniu, a nowsze zmiany
//   z konta dochodzą dopiero po otwarciu, łączenie przelicza historię jak przy zmianach na żywo.)
async function przywrocHistorie(p) {
  historia.wyczysc();
  let zapis = null;
  try { zapis = await wczytajHistorie(wlasciciel(), p.id); } catch { /* brak magazynu – historia od zera */ }
  if (zapis && historia.zZapisu(zapis.historia)) {
    if (historia.zgodnaZ(p)) return;
    if ((zapis.wersja_chmury ?? null) === (p.wersja_chmury ?? null)) { historia.zapisz(p); return; }
    const byloCoCofac = historia.moznaCofnac || historia.moznaPonowic;
    historia.wyczysc();
    if (byloCoCofac) powiadom('Historia cofania zaczyna się od nowa – projekt zmienił się na innym urządzeniu od ostatniej pracy na tym.');
  }
  historia.zapisz(p); // stan wyjściowy – do niego wraca pierwsze cofnięcie
}

function odswiezCofanie() {
  $('[data-akcja="cofnij"]').disabled = !historia.moznaCofnac && !stan.doHistorii;
  $('[data-akcja="ponow"]').disabled = !historia.moznaPonowic;
}

// Ostatnio edytowana strona projektu – na tym urządzeniu (#147). Brak pamięci przeglądarki nic nie psuje.
const KLUCZ_STRONY = 'makietka:ostatnia-strona';
function ostatniaStrona(id) {
  try { return JSON.parse(localStorage.getItem(KLUCZ_STRONY) || '{}')[id] || null; } catch { return null; }
}
function zapamietajStrone(id, strona) {
  try {
    const m = JSON.parse(localStorage.getItem(KLUCZ_STRONY) || '{}');
    if (m[id] === strona) return;
    delete m[id];
    m[id] = strona;
    const klucze = Object.keys(m);
    for (const k of klucze.slice(0, Math.max(0, klucze.length - 200))) delete m[k]; // najwyżej 200 projektów
    localStorage.setItem(KLUCZ_STRONY, JSON.stringify(m));
  } catch { /* bez pamięci przeglądarki – projekt otworzy się na pierwszej stronie */ }
}

// Wczytuje bieżący cel do edytora; dopasowuje widok, gdy zmienił się rozmiar.
// Zamrożony obraz obszaru płótna na czas wczytywania innej strony (#149): kopia tego, co widać, leży nad
// płótnem, aż nowa strona jest narysowana w całości – na telefonie (wolniejsze rysowanie) nie widać już
// stanów pośrednich (wyczyszczone płótno, stara strona w nowym widoku, strona bez przeliczeń).
let zamrozenie = null;
function zamrozObraz() {
  const kontener = edytor.kontener;
  const plotno = edytor.canvas?.lowerCanvasEl;
  if (zamrozenie) { zamrozenie.ile += 1; return zamrozenie; }
  if (!kontener || !plotno?.width || !edytor.wydruk) return null;
  const rk = kontener.getBoundingClientRect();
  const rp = plotno.getBoundingClientRect();
  if (rk.width < 2 || rk.height < 2) return null;
  const dpr = window.devicePixelRatio || 1;
  const obraz = document.createElement('canvas');
  obraz.className = 'zamrozony-obraz';
  obraz.width = Math.round(rk.width * dpr);
  obraz.height = Math.round(rk.height * dpr);
  Object.assign(obraz.style, { left: `${rk.left}px`, top: `${rk.top}px`, width: `${rk.width}px`, height: `${rk.height}px` });
  const g = obraz.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = getComputedStyle(kontener).backgroundColor;
  g.fillRect(0, 0, rk.width, rk.height);
  const x = rp.left - rk.left;
  const y = rp.top - rk.top;
  g.save();
  g.shadowColor = 'rgba(0, 0, 0, 0.16)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 2;
  g.fillStyle = '#ffffff';
  g.fillRect(x, y, rp.width, rp.height);
  g.restore();
  g.drawImage(plotno, x, y, rp.width, rp.height);
  kontener.after(obraz);
  zamrozenie = { ile: 1, obraz };
  return zamrozenie;
}
function odmrozObraz(z) {
  if (!z) return;
  z.ile -= 1;
  if (z.ile > 0) return;
  // Dwie klatki: najpierw płótno rysuje nową stronę, w następnej obraz znika.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (z.ile > 0) return;
    z.obraz.remove();
    if (zamrozenie === z) zamrozenie = null;
  }));
}

// nawigacja: tylko przejście na inną stronę (bez zmian w stronach) – lista stron nie jest budowana od nowa (#158).
export async function zaladujCel({ dopasuj = false, nawigacja = false } = {}) {
  const { projekt } = stan;
  // Strona okładki: przeliczenie przed wczytaniem, żeby po przejściu z innej strony (np. po dodaniu stron
  // w środku) okładka była od razu w aktualnym rozmiarze, a nie dopiero po chwili (#144).
  if (stan.tryb === 'strona' && projekt.sekcje.find((s) => s.id === biezacyCel()?.sekcja)?.okladka) {
    clearTimeout(timerOkladek);
    try {
      const zmienione = przeliczOkladki(projekt);
      for (const st of projekt.strony) if (zmienione.includes(st.sekcja)) stan.miniatury.delete(st.id);
    } catch (e) { console.error(e); }
  }
  if (stan.tryb === 'strona' && projekt.strony[stan.indeks]) zapamietajStrone(projekt.id, projekt.strony[stan.indeks].id);
  const wydruk = wydrukCelu();
  const cel = biezacyCel();
  const poprzedni = edytor.wydruk;
  const bylaRozkladowka = poprzedni ? edytor.rozkladowka : null;
  const innyRozmiar = !poprzedni || ['szerokosc_mm', 'wysokosc_mm', 'spad_mm'].some((k) => poprzedni[k] !== wydruk[k]);
  naPlotnie = null;
  // Rysowanie wstrzymane na czas wczytywania (#148): stara strona zostaje na ekranie, aż nowa jest gotowa
  // w całości (wzorce, elementy, tekst z innych stron, ostrzeżenia, dopasowanie widoku) – jedno podmienienie
  // zamiast kilku pośrednich stanów.
  const zamrozone = zamrozObraz();
  const c = edytor.canvas;
  const { requestRenderAll: zlecRysowanie, renderAll: rysuj } = c;
  c.requestRenderAll = () => c;
  c.renderAll = () => c;
  try {
  if (stan.tryb === 'wzorzec') {
    edytor.ustawWydruk(wydruk, marginesyWzorca(cel));
    await edytor.wczytajStrone({ id: cel.id, obiekty: cel.obiekty, tlo: cel.tlo || '#ffffff', prowadnice: cel.prowadnice }, projekt.zasoby, null);
    await edytor.ustawRamkiPoza([]);
    naPlotnie = { wzorzec: cel.id, wczytane: zdjeciePlotna([cel]) };
    naPlotnie.pola = zdjeciePol([cel]);
  } else {
    const ciag = rozwin(projekt);
    const arkusz = arkuszStrony(cel, ciag);
    const strony = jednaStrona() ? [cel] : arkusz;
    const dane = [];
    for (const s of strony) {
      dane.push({ id: s.id, obiekty: s.obiekty, tlo: tloStrony(projekt, s), prowadnice: s.prowadnice, warstwy: await warstwyWzorcow(projekt, s, ciag) });
    }
    // Widok jednej strony rozkładówki: sąsiednia strona idzie do edytora osobno – widać z niej to,
    // co przechodzi przez grzbiet na tę stronę (bez możliwości zmiany).
    const sasiad = strony.length === 1 ? arkusz.find((s) => s !== cel) : null;
    if (sasiad) dane[0].sasiednia = { bok: arkusz.indexOf(sasiad) === 0 ? 'lewa' : 'prawa', obiekty: sasiad.obiekty, warstwy: await warstwyWzorcow(projekt, sasiad, ciag) };
    edytor.ustawWydruk(wydruk, strony.map((s) => marginesyStrony(projekt, s, bokStrony(s, ciag))));
    edytor.ustawAktywna(strony.indexOf(cel));
    await edytor.wczytajArkusz(dane, projekt.zasoby);
    // Tekst płynący przez strony: ramki tych samych wątków z pozostałych stron.
    await edytor.ustawRamkiPoza(ramkiZInnychStron(projekt, strony));
    naPlotnie = { strony: strony.map((s) => s.id), wczytane: zdjeciePlotna(strony) };
    naPlotnie.pola = zdjeciePol(strony);
    podpisKsiazki = uzywaKsiazki(projekt) ? podpisWarstwKsiazki(projekt) : ''; // to, co pokazują wczytane warstwy (#131B)
  }
  edytor.przeliczOstrzezenia(); // które pola są znane, wiadomo dopiero po wczytaniu
  edytor.ustawWidok(projekt.widok);
  linijki.ustaw(projekt.widok.linijki);
  panelWarstw.odswiez();
  if (dopasuj || innyRozmiar || bylaRozkladowka !== edytor.rozkladowka) edytor.dopasujDoOkna();
  } finally {
    c.requestRenderAll = zlecRysowanie;
    c.renderAll = rysuj;
    c.renderAll();
    odmrozObraz(zamrozone);
  }
  odswiezPasekEdytora();
  if (nawigacja) oznaczBiezacaWLiscie(); else renderujListe();
  trasa.ustaw(`p/${projekt.id}/${stan.tryb === 'wzorzec' ? `w/${cel.id}` : `s/${cel.id}`}`, { zastap: true });
}

// Druga strona tej samej rozkładówki staje się bieżącą – bez wczytywania od nowa.
export function wybierzStroneArkusza(k) {
  const id = naPlotnie?.strony?.[k];
  const i = stan.projekt.strony.findIndex((s) => s.id === id);
  if (i < 0 || (stan.tryb === 'strona' && i === stan.indeks)) return;
  stan.indeks = i;
  zapamietajStrone(stan.projekt.id, id);
  edytor.ustawAktywna(k);
  odswiezPasekEdytora();
  oznaczBiezacaWLiscie();
  trasa.ustaw(`p/${stan.projekt.id}/s/${id}`, { zastap: true });
  if (!edytor.aktywny) panel.zbuduj();
}

export function stanZapisu(rodzaj, tekst) {
  const el = $('#stan-zapisu');
  const ik = { ok: stan.uzytkownik ? 'chmuraOk' : 'chmura', zapis: 'chmura', offline: 'chmuraOff', blad: 'uwaga' }[rodzaj];
  el.className = `stan-zapisu${rodzaj === 'zapis' ? ' zapisuje' : ''}${rodzaj === 'blad' ? ' blad' : ''}`;
  el.innerHTML = `${ikona(ik, { rozmiar: 16 })}<span class="tekst"></span>`;
  $('.tekst', el).textContent = tekst;
  el.title = tekst;
}

// cel: { strona: id, wzorzec: id, podglad: true } – opcjonalnie, np. z adresu strony.
// podglad: projekt otwiera się prosto w podglądzie – bez pokazywania edytora i wczytywania płótna.
export async function otworzProjekt(p, cel = {}) {
  await stan.czcionki;
  naPlotnie = null;
  dotkniete.clear();
  stan.projekt = normalizuj(p);
  // Obrazy leżą w magazynie plików przeglądarki – tu dostają adresy (brakujące pobierają się z konta).
  try { await podlaczZasoby(stan.projekt, stan.uzytkownik ? chmura.pobierzZasob : null); } catch { /* bez magazynu obrazy pokażą się jako brakujące */ }
  // Własne czcionki muszą być gotowe, zanim tekst zostanie zmierzony na płótnie.
  const zleCzcionki = await zarejestrujCzcionkiProjektu(stan.projekt);
  if (zleCzcionki.length) powiadom(`Nie udało się wczytać czcionek: ${zleCzcionki.join(', ')}.`, true);
  // Czcionki stylów tekstu projektu pobierają się w tle – żeby nadanie stylu od razu mierzyło tekst
  // właściwą czcionką. Nie wstrzymują otwarcia projektu (czcionki stron wczytuje edytor przed rysowaniem).
  zapewnijRodziny((stan.projekt.style || []).map((s) => s.fontFamily)).catch(() => {});
  // Bez strony w adresie – ostatnio edytowana strona tego projektu na tym urządzeniu (#147).
  if (!cel.strona && !cel.wzorzec) cel = { ...cel, strona: ostatniaStrona(stan.projekt.id) };
  stan.indeks = Math.max(0, stan.projekt.strony.findIndex((x) => x.id === cel.strona));
  const wzorzec = cel.wzorzec && stan.projekt.wzorce.find((w) => w.id === cel.wzorzec);
  stan.tryb = wzorzec ? 'wzorzec' : 'strona';
  stan.idWzorca = wzorzec ? wzorzec.id : null;
  stan.miniatury.clear();
  ustawZakladke(wzorzec ? 'wzorce' : 'strony');
  plotnoOdlozone = !!cel.podglad;
  if (!plotnoOdlozone) pokazEkran('edytor');
  if (trasa.odczytaj().id !== stan.projekt.id) trasa.ustaw(`p/${stan.projekt.id}`);
  pokazNazwe(stan.projekt.nazwa);
  document.title = `${stan.projekt.nazwa} – ${NAZWA}`;
  edytor.wydruk = null;
  clearTimeout(stan.timerHistorii);
  stan.doHistorii = false;
  // Okładka mogła się zmienić, gdy projekt był zamknięty (np. strony od AI). Błąd przeliczenia (np. dziwne dane
  // okładki) nie może zablokować otwarcia projektu – okładka zostaje wtedy jak była.
  try { przeliczOkladki(stan.projekt); } catch (e) { console.error(e); powiadom('Nie udało się przeliczyć okładki – zostaje bez zmian. Sprawdź ustawienia sekcji okładki.', true); }
  await przywrocHistorie(stan.projekt);
  if (!plotnoOdlozone) await zaladujCel({ dopasuj: true });
  odswiezCofanie();
  stanZapisu('ok', stan.uzytkownik ? 'Zapisano' : 'Zapisano w przeglądarce');
  generujMiniatury();
  zaplanujKsiazke(); // spis treści i skorowidz mogły się zmienić poza edytorem (np. przez AI) – #131B
  // Czcionki tego projektu trafiają do „Moich czcionek”; lista w panelu dostaje czcionki z innych projektów.
  stan.mojeRodziny = [];
  odswiezMojeCzcionki({ projekt: stan.projekt, zKontem: true });
  // Projekt mógł się zmienić na innym urządzeniu, gdy to miało niewysłane zmiany – dołączamy od razu.
  if (stan.uzytkownik) sprawdzKonto();
  obrazyOdAi(stan.projekt);
  // Starsze obrazy nie mają zapisanych wymiarów – łącznik AI potrzebuje ich do wstawiania (czytane z nagłówka pliku).
  uzupelnijWymiary(stan.projekt).then((ile) => { if (ile && stan.uzytkownik) zaplanujChmure(2000); }).catch(() => {});
  // Współpraca (js/app/wspolpraca.js, js/app/obecnosc.js): tryb projektu i obecność innych osób.
  document.dispatchEvent(new CustomEvent('seriodruk:projekt', { detail: stan.projekt }));
  const otwarty = stan.projekt;
  setTimeout(() => podpowiedzTypu(otwarty), 1200);
}

// Typ sekcji (#177): sekcja zwykła, której nazwa wygląda na wyklejkę, dostaje jednorazową propozycję zmiany typu.
// To tylko podpowiedź – typ nigdy nie wynika z nazwy sam; decyduje użytkownik (raz na sekcję na tym urządzeniu).
const KLUCZ_PODPOWIEDZI_TYPU = 'makietka:podpowiedz-typu';
export function sekcjaDoPodpowiedzi(projekt) {
  let byly = {};
  try { byly = JSON.parse(localStorage.getItem(KLUCZ_PODPOWIEDZI_TYPU) || '{}'); } catch { /* bez pamięci – bez pominięć */ }
  return projekt.sekcje.find((x) => (x.typ === 'zwykla' || x.typ === 'blok') && /wyklejk/i.test(x.nazwa) && !byly[`${projekt.id}:${x.id}`]) || null;
}
function podpowiedzTypu(projekt) {
  if (!projekt || stan.projekt !== projekt || projekt.wspolpraca_chmury?.rola === 'odczyt') return; // tylko do oglądania – bez propozycji
  const s = sekcjaDoPodpowiedzi(projekt);
  if (!s) return;
  try {
    const byly = JSON.parse(localStorage.getItem(KLUCZ_PODPOWIEDZI_TYPU) || '{}');
    byly[`${projekt.id}:${s.id}`] = 1;
    localStorage.setItem(KLUCZ_PODPOWIEDZI_TYPU, JSON.stringify(byly));
  } catch { /* podpowiedź pokaże się znowu przy następnym otwarciu */ }
  const typ = /ty[lł]/i.test(s.nazwa) ? 'wyklejka_tylna' : 'wyklejka_przednia';
  powiadom(`Sekcja „${s.nazwa}” wygląda na wyklejkę – ustawić typ „${typ === 'wyklejka_tylna' ? 'Wyklejka tylna' : 'Wyklejka przednia'}”?`, false, {
    etykieta: 'Ustaw typ',
    fn: async () => {
      if (stan.projekt !== projekt) return;
      const { normalizujSpecjalna } = await import('../sekcje-specjalne.js');
      zapiszBiezacyCel();
      Object.assign(s, { typ, uklad: 'pojedyncze', specjalna: normalizujSpecjalna({ rodzaj: 'wyklejka', strona: typ === 'wyklejka_tylna' ? 'tylna' : 'przednia' }) });
      delete s.skladka;
      delete s.okladka;
      przeliczOkladki(projekt);
      stan.miniatury.clear();
      await zaladujCel();
      zaplanujZapis();
      powiadom(`Sekcja „${s.nazwa}” ma teraz typ wyklejki – format i strefy liczą się z bloku.`);
    },
  });
}

// Elementy tuż po wczytaniu na płótno: dla każdego id – jego postać z płótna i element z projektu.
// Płótno dopisuje elementom swoje pola domyślne (Fabric: wymiary tekstu, krój, krycie…); element, którego
// nikt na płótnie nie ruszył, wraca więc do projektu w postaci z projektu, a nie z płótna. Inaczej każdy
// element dodany z zewnątrz (np. przez AI, z samymi podstawowymi polami) po wczytaniu wyglądałby na zmieniony
// tutaj – a przy jego następnej zmianie na koncie padałoby pytanie o konflikt, którego nie ma, i wybór
// „z tego urządzenia” cofałby zmianę AI.
function zdjeciePlotna(cele) {
  const zProjektu = new Map(cele.flatMap((c) => c.obiekty || []).map((o) => [o.id, o]));
  const wczytane = new Map();
  for (const o of edytor.obiektyStrony()) {
    if (o?.id && zProjektu.has(o.id)) wczytane.set(o.id, { kanon: kanonBezZ(o), obiekt: JSON.parse(JSON.stringify(zProjektu.get(o.id))) });
  }
  return wczytane;
}
// Pole `z` (kolejność na wspólnym płótnie rozkładówki) przesuwa się, gdy obok przybędzie albo ubędzie
// element – sama zmiana kolejności innych nie jest zmianą tego elementu.
const kanonBezZ = (o) => kanon({ ...o, z: undefined });
// Postać z płótna albo – dla elementu, którego od wczytania nie zmieniono – ta z projektu.
// Elementy, które użytkownik zmienił na płótnie tego urządzenia od ostatniego uzgodnienia z kontem (#138).
// Przy łączeniu: element zmieniony i tutaj, i na koncie, ale nieruszony tutaj ręcznie (różni się tylko przez
// przeliczenie: okładka, spis treści, kod, układ elementu z danych) – bierze wersję z konta bez pytania.
const dotkniete = new Set();
function bezZmianZPlotna(obiekty) {
  const wczytane = naPlotnie?.wczytane;
  if (!wczytane?.size) { for (const o of obiekty) if (o?.id) dotkniete.add(o.id); return obiekty; }
  return obiekty.map((o) => {
    const w = o?.id && wczytane.get(o.id);
    if (!w || w.kanon !== kanonBezZ(o)) { if (o?.id) dotkniete.add(o.id); return o; }
    return w.obiekt.z === undefined || w.obiekt.z === o.z ? w.obiekt : { ...w.obiekt, z: o.z };
  });
}

// Tło i prowadnice strony albo wzorca (i – miejsce na arkuszu) tak, jak wyjdą z płótna: kolor w jednej postaci,
// pozycje prowadnic zaokrąglone. Po wczytaniu zapamiętujemy, jak wyglądały – gdy nikt ich na płótnie nie zmienił,
// w projekcie zostają takie, jakie były (np. „#FFEEDD” od AI nie staje się „#ffeedd” i nie udaje zmiany tutaj).
function tloZPlotna(projekt, cel, i) {
  const tlo = kolor(edytor.tla[i] || '#ffffff');
  // Białe tło wzorca znaczy „bez tła” – nie nadpisuje innych wzorców; strona ma własne tło tylko inne niż z wzorców.
  if (naPlotnie?.wzorzec) return tlo === '#ffffff' ? null : tlo;
  return tlo === kolor(tloStrony(projekt, { ...cel, tlo: null })) ? null : tlo;
}
function zdjeciePol(cele) {
  const prowadnice = edytor.prowadniceStron();
  const kopia = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  return new Map(cele.map((c, i) => [c.id, {
    tlo: tloZPlotna(stan.projekt, c, i), prowadnice: kanon(prowadnice[i] ?? null),
    bylo: { tlo: kopia(c.tlo), prowadnice: kopia(c.prowadnice) }, // wartości z projektu w chwili wczytania
  }]));
}
// Na płótnie tak jak po wczytaniu – wartość z projektu z chwili wczytania; inaczej – postać z płótna.
function zapiszPolaZPlotna(projekt, cel, i, prowadnice) {
  const z = naPlotnie?.pola?.get(cel.id);
  const tlo = tloZPlotna(projekt, cel, i);
  if (z && z.tlo === tlo) { if (z.bylo.tlo === undefined) delete cel.tlo; else cel.tlo = z.bylo.tlo; } else cel.tlo = tlo;
  if (z && z.prowadnice === kanon(prowadnice ?? null)) {
    if (z.bylo.prowadnice === undefined) delete cel.prowadnice; else cel.prowadnice = JSON.parse(JSON.stringify(z.bylo.prowadnice));
  } else zapiszProwadnice(cel, prowadnice);
}

// Własne prowadnice strony albo wzorca; puste nie zajmują miejsca w pliku.
function zapiszProwadnice(cel, p) {
  if (p && (p.x.length || p.y.length)) cel.prowadnice = p; else delete cel.prowadnice;
}

// Przepisuje płótno do tego, co jest na nim wczytane: wzorca albo stron arkusza
// (w rozkładówce – obu naraz; element należy do strony, na której leży jego środek).
export function zapiszBiezacyCel() {
  const { projekt } = stan;
  if (!projekt || !naPlotnie) return;
  if (naPlotnie.wzorzec) {
    const cel = projekt.wzorce.find((w) => w.id === naPlotnie.wzorzec);
    if (!cel) return;
    cel.obiekty = bezZmianZPlotna(edytor.obiektyStrony());
    zapiszPolaZPlotna(projekt, cel, 0, edytor.prowadniceStron()[0]);
    // Strony z tym wzorcem trzeba przerysować.
    for (const s of stronyZWzorcem(projekt, cel.id)) stan.miniatury.delete(s.id);
    // Miniaturę rysuje w tle odrysujMiniaturyWTle (zapiszTeraz) – raz po serii zmian, nie przy każdym
    // przepisaniu płótna (krok historii, zapis, łączenie – to trzy rysowania całej strony na jedną zmianę).
  } else {
    const obiekty = edytor.obiektyStron();
    const prowadnice = edytor.prowadniceStron();
    naPlotnie.strony.forEach((id, i) => {
      const cel = projekt.strony.find((s) => s.id === id);
      if (!cel) return;
      cel.obiekty = bezZmianZPlotna(obiekty[i]);
      zapiszPolaZPlotna(projekt, cel, i, prowadnice[i]);
    });
    // Tekst, który przepłynął do ramek na innych stronach, wraca do tych stron.
    const inne = new Set();
    for (const z of edytor.ramkiPozaDoZapisu()) {
      const strona = projekt.strony.find((s) => s.id === z.strona);
      const o = strona?.obiekty.find((x) => x.id === z.id);
      if (!o) continue;
      for (const [k, v] of Object.entries(z.pola)) { if (v === undefined) delete o[k]; else o[k] = v; }
      stan.miniatury.delete(strona.id);
      inne.add(strona.id);
    }
    if (inne.size) odrysujMiniaturyWTle([...inne]);
  }
  const pierwsza = stan.projekt.strony[0];
  stan.projekt.miniatura = stan.miniatury.get(pierwsza.id) || stan.projekt.miniatura;
}

// Każda zmiana projektu przechodzi tędy: zapis za chwilę i (domyślnie) krok historii.
// Okładka liczona sama (#119): po każdej zmianie (nowe strony, dane serii, papier) okładka sprawdza
// swój format – gdy grzbiet się zmienił, przelicza się, przesuwa elementy i przerysowuje.
let timerOkladek = null;
function zaplanujOkladki() {
  if (!stan.projekt?.sekcje.some((s) => s.okladka)) return;
  clearTimeout(timerOkladek);
  timerOkladek = setTimeout(() => { odswiezOkladki().catch((e) => console.error(e)); }, 350);
}
export async function odswiezOkladki() {
  const p = stan.projekt;
  if (!p) return [];
  const naOkladce = stan.tryb === 'strona' && naPlotnie && p.sekcje.find((s) => s.id === biezacyCel()?.sekcja)?.okladka;
  if (naOkladce) zapiszBiezacyCel();
  let zmienione = [];
  try { zmienione = przeliczOkladki(p); } catch (e) { console.error(e); return []; }
  if (!zmienione.length) return zmienione;
  for (const s of p.strony) if (zmienione.includes(s.sekcja)) stan.miniatury.delete(s.id);
  if (stan.tryb === 'strona' && zmienione.includes(biezacyCel()?.sekcja)) await zaladujCel({ dopasuj: true });
  generujMiniatury();
  zaplanujZapis();
  return zmienione;
}

// Książka (#131B): spis treści i skorowidz składają się same po każdej zmianie; przypisy dolne i żywa pagina
// (warstwa nad treścią, jak wzorce) odświeżają się na płótnie, gdy zmieniły się na stronach, które są na nim.
let timerKsiazki = null;
let podpisKsiazki = '';
const ksiazkaNaPlotnie = () => (edytor.canvas?.getObjects() || []).some((o) => o.ksiazka || o.przypisy || o.hasla || (typeof o.text === 'string' && /\{(rozdzial|s|przypis)[:}]/.test(o.text)));
function zaplanujKsiazke() {
  if (!stan.projekt || !(uzywaKsiazki(stan.projekt) || ksiazkaNaPlotnie())) return;
  clearTimeout(timerKsiazki);
  timerKsiazki = setTimeout(() => { odswiezKsiazke().catch((e) => console.error(e)); }, 600);
}
function podpisWarstwKsiazki(p) {
  if (!naPlotnie?.strony) return '';
  const ciag = rozwin(p);
  return JSON.stringify(naPlotnie.strony.map((id) => {
    const egz = ciag.pierwszy.get(id);
    if (!egz) return null;
    const naglowki = egz.pusta ? [] : [1, 2, 3].map((n) => poleKsiazki(p, egz, ciag, 'rozdzial', String(n)));
    return [przypisyStrony(p, egz, ciag), naglowki];
  }));
}
export async function odswiezKsiazke() {
  const p = stan.projekt;
  if (!p || !(uzywaKsiazki(p) || ksiazkaNaPlotnie())) return [];
  // Nie w pół słowa: pisanie w tekście dokończy się, zanim płótno się przeładuje.
  if (edytor.aktywny?.isEditing || edytor.canvas?._currentTransform) { zaplanujKsiazke(); return []; }
  zapiszBiezacyCel();
  const zmienione = przeliczKsiazke(p);
  for (const id of zmienione) stan.miniatury.delete(id);
  const podpis = podpisWarstwKsiazki(p);
  const naPlotnieZmiana = zmienione.some((id) => naPlotnie?.strony?.includes(id) || naPlotnie?.wzorzec === id);
  if (naPlotnieZmiana || podpis !== podpisKsiazki) {
    const zaznaczony = edytor.aktywny?.id;
    await zaladujCel();
    if (zaznaczony) edytor.zaznacz(zaznaczony);
  }
  podpisKsiazki = podpis;
  if (zmienione.length) { generujMiniatury(); zaplanujZapis(); }
  return zmienione;
}

export function zaplanujZapis({ historia: doHistorii = true } = {}) {
  zaplanujOkladki();
  zaplanujKsiazke();
  stanZapisu('zapis', 'Zapisywanie…');
  clearTimeout(stan.timerZapisu);
  stan.timerZapisu = setTimeout(function zapiszPoChwili() {
    if (stanPrzejsciowy()) { stan.timerZapisu = setTimeout(zapiszPoChwili, 500); return; }
    zapiszTeraz();
  }, 700);
  if (doHistorii) {
    stan.doHistorii = true;
    clearTimeout(stan.timerHistorii);
    // Przy otwartym oknie (dane, serie, sekcje) krok powstaje dopiero po jego zamknięciu.
    stan.timerHistorii = setTimeout(() => { if ($(OKNO_BLOKUJACE)) zaplanujZapis(); else zapamietajStan(); }, 300);
    odswiezCofanie();
  }
}

export async function zapiszTeraz() {
  clearTimeout(stan.timerZapisu);
  stan.timerZapisu = null;
  if (!stan.projekt) return stan.zapisywanie;
  zapiszBiezacyCel();
  for (const id of naPlotnie?.strony || [naPlotnie?.wzorzec]) odswiezMiniature(id);
  odrysujMiniaturyWTle(naPlotnie?.strony || [naPlotnie?.wzorzec]);
  stan.projekt.zmieniono = new Date().toISOString();
  const projekt = stan.projekt;
  stan.zapisywanie = stan.zapisywanie.then(async () => {
    try {
      await zapiszLokalnie(projekt, wlasciciel(), Boolean(stan.uzytkownik));
      await zachowajHistorie(projekt);
      if (stan.uzytkownik) zaplanujChmure();
      else stanZapisu('ok', 'Zapisano w przeglądarce');
    } catch (e) {
      stanZapisu('blad', `Błąd zapisu: ${e.message}`);
    }
  });
  return stan.zapisywanie;
}

// Wysyłka na konto rusza zaraz po zapisie w przeglądarce (razem ok. sekundy od zmiany).
const OPOZNIENIE_KONTA = 300;

export function zaplanujChmure(opoznienie = OPOZNIENIE_KONTA) {
  if (!stan.uzytkownik) return;
  clearTimeout(stan.timerChmury);
  stan.timerChmury = setTimeout(synchronizuj, opoznienie);
}

// Naraz biegnie jedna wysyłka. Zmiany zrobione w jej trakcie nie ruszają drugiej obok – czeka jedna
// następna, która po zakończeniu poprzedniej wyśle najnowszy stan (baza nie dostaje zapisu na każde
// naciśnięcie klawisza, a druga wysyłka nie rozmija się z numerem wersji pierwszej).
let kolejkaKonta = Promise.resolve();
let czekaWysylka = false;

// `projekt`: wysyłka konkretnego projektu także po zamknięciu edytora (wyjście do listy projektów, #109) –
// zwykła wysyłka bierze projekt otwarty w chwili, gdy przyjdzie jej kolej.
export function synchronizuj({ wymus = false, projekt = null } = {}) {
  if (czekaWysylka && !wymus && !projekt) return kolejkaKonta;
  if (!wymus && !projekt) czekaWysylka = true;
  kolejkaKonta = kolejkaKonta.then(() => {
    if (!wymus && !projekt) czekaWysylka = false;
    return wyslijNaKonto({ wymus, projekt });
  });
  return kolejkaKonta;
}

// Wysyłka pominięta, bo akurat trwało dołączanie zmian z konta – po nim trzeba ją nadrobić.
let pominietaWysylka = false;

async function wyslijNaKonto({ wymus = false, projekt = null } = {}) {
  const p = projekt || stan.projekt;
  if (!stan.uzytkownik || !p) return;
  const otwarty = stan.projekt === p;
  if (!navigator.onLine) {
    if (otwarty) stanZapisu('offline', 'Offline – zapisano na urządzeniu');
    return;
  }
  if (stan.konflikt === p.id && !wymus) { pominietaWysylka = true; return; } // trwa łączenie albo czekamy na decyzję użytkownika
  // Rola „może oglądać” (współpraca): projekt jest tylko do podglądu, nic stąd nie idzie na konto.
  if (p.wspolpraca_chmury?.rola === 'odczyt') return;
  const wersja = p.zmieniono;
  // Nowe obrazy (wgrane tutaj albo przez AI) idą na konto przed projektem – przy dużych zdjęciach widać postęp.
  const doWyslania = Object.values(p.zasoby || {}).filter((z) => z && (!z.sciezka || chmura.czyOdAi(z.sciezka))).length;
  const pasek = doWyslania ? postep('Wysyłanie obrazów na konto…', { razem: doWyslania, opoznienie: 800 }) : null;
  try {
    await chmura.zapiszWChmurze(p, { wymus, postep: pasek && ((i, n) => pasek.krok(i, n)) });
    if (otwarty) dotkniete.clear(); // wysłane – to jest teraz stan uzgodniony z kontem
    stan.konflikt = null;
    await zapiszLokalnie(p, wlasciciel(), p.zmieniono !== wersja);
    await zachowajHistorie(p); // nowy numer wersji z konta
    await oznaczZsynchronizowany(p.id, wersja);
    if (stan.projekt === p && !stan.timerZapisu) stanZapisu('ok', 'Zapisano');
    if (stan.projekt === p) zaplanujAktualizacjeLinku(); // udostępniony link idzie za zapisanymi zmianami
    document.dispatchEvent(new CustomEvent('seriodruk:zapisano-na-koncie')); // obecność rusza po pierwszym zapisie
  } catch (e) {
    // Zamknięty już projekt z konfliktem zostaje z niewysłanymi zmianami – połączy się przy otwarciu.
    if (!otwarty && stan.projekt !== p) return;
    if (e.konflikt) { polaczZKontem(p, { konflikt: e }); return; }
    // Właściciel odebrał dostęp albo zmienił rolę na „może oglądać” (współpraca).
    if (e.code === '42501' && p.wspolpraca_chmury) {
      stanZapisu('blad', 'Nie wysłano: nie masz już prawa zmieniać tego projektu');
      powiadom('Właściciel odebrał Ci prawo zmieniania tego projektu. Twoje ostatnie zmiany zostały tylko na tym urządzeniu.', true);
      return;
    }
    stanZapisu('blad', `Nie wysłano: ${chmura.komunikatBledu(e)}`);
  } finally {
    pasek?.koniec();
  }
}

// ---------- Zmiany z innego urządzenia ----------

// Sprawdza, czy na koncie jest nowsza wersja otwartego projektu niż znana temu urządzeniu, i jeśli tak –
// pobiera ją i dołącza. `wersja`: numer z powiadomienia na żywo; bez niego pytamy konto (jedna liczba).
// Staje w kolejce za trwającą wysyłką: dopiero po niej wiadomo, czy nowa wersja nie jest naszą własną.
let sprawdzPoLaczeniu = false;
export function sprawdzKonto({ wersja = null } = {}) {
  kolejkaKonta = kolejkaKonta.then(async () => {
    const p = stan.projekt;
    if (!stan.uzytkownik || !p || !navigator.onLine) return;
    // W trakcie łączenia nowe powiadomienie nie przepada: sprawdzimy konto jeszcze raz, gdy łączenie się skończy.
    if (stan.konflikt === p.id) { sprawdzPoLaczeniu = true; return; }
    if (!p.wersja_chmury) return; // projektu nie ma jeszcze na koncie – pierwsza wysyłka go tam zapisze
    try {
      const naKoncie = wersja ?? (await chmura.wersjaNaKoncie(p.id))?.wersja;
      if (stan.projekt !== p || !naKoncie || naKoncie <= p.wersja_chmury) return;
      polaczZKontem(p); // bez czekania: na końcu samo staje w tej kolejce ze swoją wysyłką
    } catch { /* brak sieci – sprawdzimy przy następnej okazji */ }
  });
  return kolejkaKonta;
}

// Czy użytkownik jest w trakcie czynności, której wczytanie strony od nowa by nie przeżyło.
let ostatniKlawisz = 0;
window.addEventListener('keydown', () => { ostatniKlawisz = Date.now(); }, true);
function zajety() {
  if ($('dialog[open]')) return true;
  if (edytor.canvas?._currentTransform) return true; // przeciąganie, skalowanie, obracanie
  if (edytor.kadruje || edytor.rysuje || edytor._pioro || edytor._punkty) return true;
  // Pisanie: dopóki od ostatniego klawisza nie minęła chwila. Potem kursor wraca na swoje miejsce.
  return Boolean(edytor.aktywny?.isEditing) && Date.now() - ostatniKlawisz < 1500;
}
async function kiedyWolne(p) {
  while (stan.projekt === p && zajety()) await new Promise((ok) => { setTimeout(ok, 300); });
}

// Miejsce pisania (ramka i kursor albo komórka tabeli) – żeby po wczytaniu strony od nowa do niego wrócić.
function miejscePisania() {
  const a = edytor.aktywny;
  if (!a?.isEditing) return null;
  if (toTabela(a.group)) return { tabela: a.group.id, ...miejsceKomorki(a.group, a), kursor: a.selectionStart };
  return { id: a.id, kursor: a.selectionStart };
}
function wrocDoPisania(m) {
  if (m.tabela) {
    if (!edytor.piszWKomorce(m.tabela, m.w, m.k)) return false;
    const c = edytor.aktywny;
    if (c?.isEditing) { c.selectionStart = Math.min(m.kursor, c.text.length); c.selectionEnd = c.selectionStart; }
    return true;
  }
  return edytor.piszWRamce(m.id, m.kursor);
}

// Czy to, co przyszło z konta, widać na płótnie – wtedy trzeba je wczytać od nowa.
// zmienione: wynik zastosujPolaczenie(). Liczone przed odłączeniem płótna.
function dotykaPlotna(p, zmienione) {
  if (zmienione.inne || zmienione.ukladStron || !naPlotnie?.strony) return true;
  const otwarte = new Set(naPlotnie.strony);
  if (zmienione.strony.some((id) => otwarte.has(id))) return true;
  // Tekst płynący przez strony: zmieniona strona ma ramkę tekstu, którego część leży na płótnie.
  const watki = new Set(p.strony.filter((s) => otwarte.has(s.id)).flatMap((s) => s.obiekty.map((o) => o.watek).filter(Boolean)));
  return watki.size > 0 && p.strony.some((s) => zmienione.strony.includes(s.id) && s.obiekty.some((o) => watki.has(o.watek)));
}

let ostatnieWczytanie = 0;

// Na koncie jest wersja zapisana z innego urządzenia – nic nie nadpisujemy po cichu.
// Tędy idą oba przypadki: baza odmówiła zapisu (`konflikt`), bo nie znaliśmy bieżącej wersji, albo przyszło
// powiadomienie, że na koncie jest coś nowszego. Łączymy część po części (js/laczenie.js): strony, wzorce,
// tabele, sekcje, serie, style i ustawienia zmienione tylko po jednej stronie przechodzą same. Pytamy
// wyłącznie o części zmienione po obu stronach inaczej. Jeśli po połączeniu to urządzenie ma coś, czego
// nie ma na koncie, projekt idzie tam zwykłym zapisem ze znaną już wersją – gdyby w tym czasie zapisało
// jeszcze inne urządzenie, baza znów odmówi i łączenie zacznie się od nowa.
async function polaczZKontem(p, { konflikt = null } = {}) {
  if (stan.konflikt === p.id) return;
  // Bez zapamiętanego stanu uzgodnionego z kontem (projekt zapisany przed wprowadzeniem łączenia albo
  // wczytany z pliku w miejsce istniejącego) nie wiadomo, kto co zmienił – zostaje pytanie o cały projekt,
  // ale dopiero przy zapisie: samo powiadomienie niczego nie rusza.
  if (!p.podstawa_chmury) {
    if (!konflikt) return;
    // Zapis przerwany w połowie (np. przeładowanie strony w trakcie pierwszej wysyłki): konto ma już dokładnie to,
    // co to urządzenie – przyjmujemy jego numer wersji bez pytania (#137). Pytanie zostaje, gdy treść się różni.
    try {
      const zKonta = normalizuj(await chmura.wczytajZChmury(p.id));
      const odciski = podstawaProjektu(zKonta);
      if (stan.projekt === p && tenSamStan(p, odciski)) {
        p.wersja_chmury = zKonta.wersja_chmury;
        p.podstawa_chmury = odciski;
        await zapiszLokalnie(p, wlasciciel(), false);
        await oznaczZsynchronizowany(p.id, p.zmieniono);
        if (!stan.timerZapisu) stanZapisu('ok', 'Zapisano');
        return;
      }
    } catch { /* bez sieci albo błąd odczytu – zostaje pytanie */ }
    await zapytajOCalyProjekt(p, konflikt);
    return;
  }
  stan.konflikt = p.id;
  pominietaWysylka = false;
  const koniec = () => {
    stan.konflikt = null;
    if (pominietaWysylka && stan.projekt === p) synchronizuj(); // zmiany zrobione w trakcie łączenia
    if (sprawdzPoLaczeniu && stan.projekt === p) { sprawdzPoLaczeniu = false; sprawdzKonto(); } // zmiana z konta w trakcie łączenia
  };
  try {
    if (konflikt) stanZapisu('zapis', 'Łączę zmiany z innego urządzenia…');
    const zKonta = normalizuj(await chmura.wczytajZChmury(p.id));
    if (zKonta.wersja_chmury === p.wersja_chmury) { koniec(); return; } // to już mamy
    // Obrazy, które doszły na koncie, pobieramy zawczasu – po połączeniu płótno ma się odświeżyć od razu.
    // Przy wielu nowych obrazach widać to jako postęp (np. zdjęcia wgrane przez AI).
    const pasekObrazow = postep('Pobieranie obrazów z konta…', { opoznienie: 800 });
    try {
      await podlaczZasoby(zKonta, chmura.pobierzZasob, (i, n) => pasekObrazow.krok(i, n));
    } catch { /* brakujące obrazy pokażą się jako brakujące */ } finally { pasekObrazow.koniec(); }
    const kontoDoPorownan = postacDoPorownan(zKonta);
    const podstawaKonta = podstawaProjektu(zKonta);
    const plan = () => {
      if (stan.projekt === p) zapiszBiezacyCel();
      return polaczProjekty(postacDoPorownan(p), kontoDoPorownan, p.podstawa_chmury);
    };
    let pierwszy = plan();
    if (pierwszy.zKonta || pierwszy.konflikty.length) {
      // Zmiany z konta trafią na płótno albo padnie pytanie – nie w pół ruchu ani w pół słowa.
      await kiedyWolne(p);
      if (stan.projekt !== p) { stan.konflikt = null; return; }
      pierwszy = plan();
    }
    // Element, którego użytkownik tutaj nie ruszał (różnica tylko z przeliczenia), bierze wersję z konta bez pytania.
    const wybory = new Map(pierwszy.konflikty.filter((k) => k.element && !dotkniete.has(k.element)).map((k) => [k.klucz, 'konto']));
    const pytania = pierwszy.konflikty.filter((k) => !wybory.has(k.klucz));
    if (pytania.length) {
      stanZapisu('blad', 'To samo zmieniono na dwóch urządzeniach – wybierz wersję');
      for (const [k, v] of await zapytajOKonflikty(p, pytania)) wybory.set(k, v);
    }
    if (stan.projekt !== p) { stan.konflikt = null; return; } // projekt zamknięto – łączenie wróci przy następnym zapisie
    const ostateczny = plan(); // jeszcze raz, tuż przed zastosowaniem: w czasie pytania projekt mógł się zmienić
    const zaznaczony = edytor.aktywny?.id;
    const pisanie = miejscePisania();
    const biezaca = p.strony[stan.indeks]?.id;
    // Ostatnia zmiana z tego urządzenia, która jeszcze nie stała się krokiem cofania – staje się nim teraz,
    // żeby po połączeniu dało się ją cofnąć osobno.
    if (stan.doHistorii) { clearTimeout(stan.timerHistorii); stan.doHistorii = false; historia.zapisz(p); }
    const staraPodstawa = p.podstawa_chmury;
    const zmienione = zastosujPolaczenie(p, zKonta, ostateczny, wybory);
    const ileZKonta = ostateczny.zKonta + [...wybory.values()].filter((w) => w === 'konto').length;
    p.wersja_chmury = zKonta.wersja_chmury;
    p.podstawa_chmury = podstawaKonta;
    if (ileZKonta) {
      const odNowa = dotykaPlotna(p, zmienione);
      if (odNowa) {
        // Połączone części mogą wskazywać na coś, co druga strona usunęła (sekcję, wzorzec, serię) – porządkujemy.
        Object.assign(p, normalizuj(p));
        // Płótno pokazuje stan sprzed połączenia – nie wolno go już przepisać do projektu.
        naPlotnie = null;
        stan.indeks = Math.max(0, p.strony.findIndex((x) => x.id === biezaca));
        if (stan.tryb === 'wzorzec' && !p.wzorce.some((w) => w.id === stan.idWzorca)) { stan.tryb = 'strona'; ustawZakladke('strony'); }
        stan.miniatury.clear();
        await zarejestrujCzcionkiProjektu(p);
        if (stan.projekt === p) {
          await zaladujCel();
          if (!(pisanie && wrocDoPisania(pisanie)) && zaznaczony) edytor.zaznacz(zaznaczony);
          panel.zbuduj();
          pokazNazwe(p.nazwa);
          document.title = `${p.nazwa} – ${NAZWA}`;
          generujMiniatury();
        }
      } else {
        // Zmieniły się tylko strony, których nie ma na płótnie: wystarczą nowe miniatury.
        for (const id of zmienione.strony) stan.miniatury.delete(id);
        renderujListe();
        odrysujMiniaturyWTle(zmienione.strony);
      }
      // Historia zostaje, ale każdy jej krok dostaje zmiany z drugiego urządzenia – tak samo połączone, z tymi
      // samymi wyborami. „Cofnij” zdejmuje więc tylko to, co zrobiono tutaj, a zmian z konta nie rusza.
      // (Krok, w którym to urządzenie zmieniło coś, co zmieniło też konto, a o co nie było pytania, bo później
      // zostało cofnięte, zostaje przy wersji z tego urządzenia – cofnięcie przywraca dawną własną zmianę.)
      historia.przelicz(p, (s) => {
        zastosujPolaczenie(s, zKonta, polaczProjekty(postacDoPorownan(s), kontoDoPorownan, staraPodstawa), wybory);
      });
      historia.zapisz(p);
      odswiezCofanie();
      odswiezPodglad(); // otwarty podgląd pokazuje zmiany od razu, bez zamykania i otwierania
    }
    // Czy to urządzenie ma po połączeniu coś, czego nie ma na koncie.
    const doWyslania = !tenSamStan(p, podstawaKonta) || noweNagrobki(p, zKonta);
    if (ileZKonta && doWyslania) {
      powiadom(`Połączono zmiany z innego urządzenia (z konta: ${ileZKonta} ${ileZKonta === 1 ? 'część' : 'części'} projektu). Twoje zmiany zostały.`);
    } else if (ileZKonta && Date.now() - ostatnieWczytanie > 20000) {
      ostatnieWczytanie = Date.now();
      powiadom('Wczytano zmiany z innego urządzenia.');
    }
    if (doWyslania) {
      p.zmieniono = new Date().toISOString(); // drugie urządzenie ma zobaczyć, że na koncie jest coś nowszego niż u niego
      await zapiszLokalnie(p, wlasciciel(), true);
      await zachowajHistorie(p);
      stan.konflikt = null;
      pominietaWysylka = false;
      await synchronizuj();
    } else {
      if (zKonta.zmieniono) p.zmieniono = zKonta.zmieniono;
      await zapiszLokalnie(p, wlasciciel(), false);
      await zachowajHistorie(p);
      if (stan.projekt === p && !stan.timerZapisu && !pominietaWysylka) stanZapisu('ok', 'Zapisano');
      // Udostępniony link idzie także za zmianami z konta (np. od AI, którego nikt inny nie narysuje).
      if (ileZKonta && stan.projekt === p) zaplanujAktualizacjeLinku(OPOZNIENIE_LINKU_Z_KONTA_MS);
      koniec();
    }
    obrazyOdAi(p);
    if (sprawdzPoLaczeniu && stan.projekt === p && stan.konflikt !== p.id) { sprawdzPoLaczeniu = false; sprawdzKonto(); }
  } catch (blad) {
    // Nic nie wysłano; następny zapis albo następne powiadomienie spróbuje połączyć jeszcze raz.
    stan.konflikt = null;
    if (konflikt) stanZapisu('blad', `Nie udało się połączyć zmian z konta: ${chmura.komunikatBledu(blad)}`);
  }
}

// Obrazy, które wgrało albo usunęło AI (migracja 20261112090000_obrazy_ai.sql): nowe czekają w tabeli bazy
// („ai:…”) – najbliższy zapis przenosi je do folderu plików konta; pliki obrazów usuniętych albo
// zastąpionych przez AI usuwa z folderu aplikacja (funkcja bazy tego nie potrafi). Okno „Obrazy projektu”
// dostaje znać, że lista mogła się zmienić.
let sprzatanie = null; // trwające sprzątanie; prośba w jego trakcie – jeszcze jedno po nim
let sprzatnijJeszcze = false;
export function obrazyOdAi(p) {
  if (!stan.uzytkownik || stan.projekt !== p) return;
  document.dispatchEvent(new CustomEvent('seriodruk:zasoby'));
  if (Object.values(p.zasoby || {}).some((z) => chmura.czyOdAi(z?.sciezka))) zaplanujChmure(1500);
  if (sprzatanie) { sprzatnijJeszcze = true; return; }
  sprzatanie = chmura.sprzatnijPliki(p.id).catch(() => { /* bez sieci – przy następnej okazji */ }).finally(() => {
    sprzatanie = null;
    if (sprzatnijJeszcze) { sprzatnijJeszcze = false; obrazyOdAi(p); }
  });
}

// Pytanie o części zmienione po obu stronach: przy każdej wybór „z tego urządzenia” albo „z konta”.
// Zwraca Map(klucz pytania → 'moje' | 'konto').
function zapytajOKonflikty(p, konflikty) {
  const dlg = $('#dlg-konflikt');
  const lista = $('#konflikt-lista');
  $('#konflikt-opis').textContent = `Projekt „${p.nazwa}” zmieniono też na innym urządzeniu. Wszystko, co zmieniono tylko po jednej stronie, zostało połączone. ${konflikty.length === 1 ? 'Jedną część zmieniono' : `${konflikty.length} części zmieniono`} w obu miejscach – wybierz, która wersja ma zostać.`;
  lista.replaceChildren(...konflikty.map((k, i) => {
    const li = document.createElement('li');
    li.dataset.klucz = k.klucz;
    li.innerHTML = '<strong></strong><label><input type="radio" value="moje"><span></span></label><label><input type="radio" value="konto" checked><span></span></label>';
    li.querySelector('strong').textContent = k.nazwa;
    const [moje, konto] = li.querySelectorAll('label');
    for (const pole of li.querySelectorAll('input')) pole.name = `konflikt-${i}`;
    moje.querySelector('span').textContent = `Z tego urządzenia (${k.moje})`;
    konto.querySelector('span').textContent = `Z konta (${k.konto})`;
    return li;
  }));
  return new Promise((ok) => {
    const anuluj = (ev) => ev.preventDefault(); // bez decyzji zapis by stał – okno zamyka tylko „Zastosuj”
    const wszystko = () => { for (const pole of lista.querySelectorAll('input[value="konto"]')) pole.checked = true; };
    const zamknij = () => {
      dlg.removeEventListener('cancel', anuluj);
      dlg.removeEventListener('close', zamknij);
      $('#konflikt-wszystko-konto').removeEventListener('click', wszystko);
      ok(new Map([...lista.children].map((li) => [li.dataset.klucz, li.querySelector('input:checked')?.value || 'konto'])));
    };
    dlg.addEventListener('cancel', anuluj);
    dlg.addEventListener('close', zamknij);
    $('#konflikt-wszystko-konto').addEventListener('click', wszystko);
    dlg.showModal();
  });
}

// Pytanie o cały projekt – tylko wtedy, gdy nie ma z czym porównać zmian (patrz wyżej).
// Nic nie przepada (#135): domyślnie wczytuje się wersja z konta (tam są np. zmiany od AI), a wersja z tego
// urządzenia może zostać jako osobna kopia projektu. Nadpisania konta stąd już nie ma.
async function zapytajOCalyProjekt(p, e) {
  stan.konflikt = p.id;
  stanZapisu('blad', 'Nowsza wersja na koncie');
  const kiedyTamta = e.zmieniono ? ` (zapisana ${kiedy(e.zmieniono)})` : '';
  const tylkoKonto = await potwierdz(
    'Projekt zmieniono w innym miejscu',
    `Na koncie jest nowsza wersja projektu „${p.nazwa}”${kiedyTamta} – np. z innego urządzenia albo od AI. Wczytaj ją. Jeśli na tym urządzeniu też coś zmieniono, możesz te zmiany zachować jako osobną kopię projektu – nic nie przepadnie.`,
    'Wczytaj wersję z konta',
    false,
    'Wczytaj i zachowaj moją jako kopię',
  );
  if (stan.projekt !== p) { stan.konflikt = null; return; }
  if (!tylkoKonto) {
    try {
      if (stan.projekt === p) zapiszBiezacyCel(); // kopia z tym, co jest na płótnie
      const kopia = kopiujProjekt(p, `${p.nazwa} (z tego urządzenia)`);
      await kopiujPliki(p, kopia);
      await zapiszLokalnie(kopia, wlasciciel(), true);
      await chmura.zapiszWChmurze(kopia);
      await oznaczZsynchronizowany(kopia.id, kopia.zmieniono);
      powiadom(`Twoja wersja jest zachowana jako „${kopia.nazwa}” na liście projektów.`);
    } catch (blad) {
      powiadom(`Nie udało się zapisać kopii na koncie: ${chmura.komunikatBledu(blad)}. Kopia została na tym urządzeniu.`, true);
    }
  }
  try {
    const zKonta = normalizuj(await chmura.wczytajZChmury(p.id));
    zKonta.podstawa_chmury = podstawaProjektu(zKonta);
    await zapiszLokalnie(zKonta, wlasciciel(), false);
    stan.konflikt = null;
    clearTimeout(stan.timerZapisu);
    stan.timerZapisu = null;
    stan.projekt = null; // żeby otwarcie nie zapisało porzucanej wersji
    await usunHistorie(zKonta.id); // historia porzucanej wersji nie pasuje do wersji z konta
    await otworzProjekt(zKonta);
    powiadom('Wczytano wersję z konta.');
  } catch (blad) {
    stan.konflikt = null;
    stanZapisu('blad', `Nie udało się wczytać wersji z konta: ${chmura.komunikatBledu(blad)}`);
  }
}
