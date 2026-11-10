// Otwarty projekt a płótno: wczytywanie strony albo wzorca na płótno, przepisywanie płótna do projektu,
// zapis (w przeglądarce i na koncie), historia cofania.

import { marginesyWzorca, tloStrony, marginesyStrony, normalizuj, stronyZWzorcem } from '../projekt.js';
import { warstwyWzorcow } from '../zlozenie.js';
import { rozwin, arkuszStrony, bokStrony } from '../serie.js';
import { zapiszLokalnie, oznaczZsynchronizowany } from '../lokalny.js';
import * as chmura from '../chmura.js';
import { ikona } from '../ikony.js';
import { $, kiedy, potwierdz, powiadom } from '../ui.js';
import { NAZWA } from '../marka.js';
import { stan, historia, edytor, wydrukCelu, biezacyCel, jednaStrona, trasa, pokazEkran, kolor, wlasciciel } from './kontekst.js';
import { odswiezPasekEdytora } from './panel-strony.js';
import { panel, linijki, panelWarstw } from './skladniki.js';
import { ustawZakladke, generujMiniatury, renderujListe, odswiezMiniature } from './lista-stron.js';

// ---------- Arkusz: strona albo cała rozkładówka na jednym płótnie ----------

// Co jest teraz wczytane do edytora: { wzorzec: id } albo { strony: [id, …] }
// (rozkładówka: lewa, prawa). null w trakcie wczytywania – wtedy płótna nie
// wolno przepisywać do projektu.
export let naPlotnie = null;

// Odłącza płótno od projektu: to, co na nim jest, nie zostanie przepisane do projektu.
export function odlaczPlotno() { naPlotnie = null; }

// Przepisuje płótno do projektu i zapamiętuje stan jako krok historii.
function zapamietajStan() {
  clearTimeout(stan.timerHistorii);
  if (!stan.projekt || !stan.doHistorii) return;
  stan.doHistorii = false;
  zapiszBiezacyCel();
  historia.zapisz(stan.projekt);
  odswiezCofanie();
}

// kierunek: −1 cofnij, 1 ponów. Po cofnięciu edytor otwiera stronę albo
// wzorzec, którego dotyczyła zmiana.
export async function cofnijKrok(kierunek) {
  const p = stan.projekt;
  if (!p || $('dialog[open]')) return;
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
  $('#nazwa-projektu').value = p.nazwa;
  ustawZakladke(stan.tryb === 'wzorzec' ? 'wzorce' : (stan.zakladka === 'warstwy' ? 'warstwy' : 'strony'));
  await zaladujCel();
  if (zaznaczony) edytor.zaznacz(zaznaczony);
  panel.zbuduj();
  odswiezCofanie();
  generujMiniatury();
  zaplanujZapis({ historia: false });
}

function odswiezCofanie() {
  $('[data-akcja="cofnij"]').disabled = !historia.moznaCofnac && !stan.doHistorii;
  $('[data-akcja="ponow"]').disabled = !historia.moznaPonowic;
}

// Wczytuje bieżący cel do edytora; dopasowuje widok, gdy zmienił się rozmiar.
export async function zaladujCel({ dopasuj = false } = {}) {
  const { projekt } = stan;
  const wydruk = wydrukCelu();
  const cel = biezacyCel();
  const poprzedni = edytor.wydruk;
  const bylaRozkladowka = poprzedni ? edytor.rozkladowka : null;
  const innyRozmiar = !poprzedni || ['szerokosc_mm', 'wysokosc_mm', 'spad_mm'].some((k) => poprzedni[k] !== wydruk[k]);
  naPlotnie = null;
  if (stan.tryb === 'wzorzec') {
    edytor.ustawWydruk(wydruk, marginesyWzorca(cel));
    await edytor.wczytajStrone({ id: cel.id, obiekty: cel.obiekty, tlo: cel.tlo || '#ffffff', prowadnice: cel.prowadnice }, projekt.zasoby, null);
    naPlotnie = { wzorzec: cel.id };
  } else {
    const ciag = rozwin(projekt);
    const strony = jednaStrona() ? [cel] : arkuszStrony(cel, ciag);
    const dane = [];
    for (const s of strony) {
      dane.push({ id: s.id, obiekty: s.obiekty, tlo: tloStrony(projekt, s), prowadnice: s.prowadnice, warstwy: await warstwyWzorcow(projekt, s, ciag) });
    }
    edytor.ustawWydruk(wydruk, strony.map((s) => marginesyStrony(projekt, s, bokStrony(s, ciag))));
    edytor.ustawAktywna(strony.indexOf(cel));
    await edytor.wczytajArkusz(dane, projekt.zasoby);
    naPlotnie = { strony: strony.map((s) => s.id) };
  }
  edytor.przeliczOstrzezenia(); // które pola są znane, wiadomo dopiero po wczytaniu
  edytor.ustawWidok(projekt.widok);
  linijki.ustaw(projekt.widok.linijki);
  panelWarstw.odswiez();
  if (dopasuj || innyRozmiar || bylaRozkladowka !== edytor.rozkladowka) edytor.dopasujDoOkna();
  odswiezPasekEdytora();
  renderujListe();
  trasa.ustaw(`p/${projekt.id}/${stan.tryb === 'wzorzec' ? `w/${cel.id}` : `s/${cel.id}`}`, { zastap: true });
}

// Druga strona tej samej rozkładówki staje się bieżącą – bez wczytywania od nowa.
export function wybierzStroneArkusza(k) {
  const id = naPlotnie?.strony?.[k];
  const i = stan.projekt.strony.findIndex((s) => s.id === id);
  if (i < 0 || (stan.tryb === 'strona' && i === stan.indeks)) return;
  stan.indeks = i;
  edytor.ustawAktywna(k);
  odswiezPasekEdytora();
  renderujListe();
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

// cel: { strona: id, wzorzec: id } – opcjonalnie, np. z adresu strony.
export async function otworzProjekt(p, cel = {}) {
  await stan.czcionki;
  naPlotnie = null;
  stan.projekt = normalizuj(p);
  stan.indeks = Math.max(0, stan.projekt.strony.findIndex((x) => x.id === cel.strona));
  const wzorzec = cel.wzorzec && stan.projekt.wzorce.find((w) => w.id === cel.wzorzec);
  stan.tryb = wzorzec ? 'wzorzec' : 'strona';
  stan.idWzorca = wzorzec ? wzorzec.id : null;
  stan.miniatury.clear();
  ustawZakladke(wzorzec ? 'wzorce' : 'strony');
  pokazEkran('edytor');
  if (trasa.odczytaj().id !== stan.projekt.id) trasa.ustaw(`p/${stan.projekt.id}`);
  $('#nazwa-projektu').value = stan.projekt.nazwa;
  document.title = `${stan.projekt.nazwa} – ${NAZWA}`;
  edytor.wydruk = null;
  clearTimeout(stan.timerHistorii);
  stan.doHistorii = false;
  historia.wyczysc();
  historia.zapisz(stan.projekt); // stan wyjściowy – do niego wraca pierwsze cofnięcie
  await zaladujCel({ dopasuj: true });
  odswiezCofanie();
  stanZapisu('ok', stan.uzytkownik ? 'Zapisano' : 'Zapisano w przeglądarce');
  generujMiniatury();
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
    cel.obiekty = edytor.obiektyStrony();
    zapiszProwadnice(cel, edytor.prowadniceStron()[0]);
    // Białe tło wzorca znaczy „bez tła” – nie nadpisuje innych wzorców.
    const tlo = kolor(edytor.tla[0] || '#ffffff');
    cel.tlo = tlo === '#ffffff' ? null : tlo;
    // Strony z tym wzorcem trzeba przerysować.
    for (const s of stronyZWzorcem(projekt, cel.id)) stan.miniatury.delete(s.id);
    stan.miniatury.set(cel.id, edytor.miniatura(200, 0));
  } else {
    const obiekty = edytor.obiektyStron();
    const prowadnice = edytor.prowadniceStron();
    naPlotnie.strony.forEach((id, i) => {
      const cel = projekt.strony.find((s) => s.id === id);
      if (!cel) return;
      cel.obiekty = obiekty[i];
      zapiszProwadnice(cel, prowadnice[i]);
      // Własne tło zapisujemy tylko wtedy, gdy różni się od tła z wzorców.
      const tlo = kolor(edytor.tla[i] || '#ffffff');
      const odziedziczone = kolor(tloStrony(projekt, { ...cel, tlo: null }));
      cel.tlo = tlo === odziedziczone ? null : tlo;
      stan.miniatury.set(cel.id, edytor.miniatura(200, i));
    });
  }
  const pierwsza = stan.projekt.strony[0];
  stan.projekt.miniatura = stan.miniatury.get(pierwsza.id) || stan.projekt.miniatura;
}

// Każda zmiana projektu przechodzi tędy: zapis za chwilę i (domyślnie) krok historii.
export function zaplanujZapis({ historia: doHistorii = true } = {}) {
  stanZapisu('zapis', 'Zapisywanie…');
  clearTimeout(stan.timerZapisu);
  stan.timerZapisu = setTimeout(zapiszTeraz, 700);
  if (doHistorii) {
    stan.doHistorii = true;
    clearTimeout(stan.timerHistorii);
    // Przy otwartym oknie (dane, serie, sekcje) krok powstaje dopiero po jego zamknięciu.
    stan.timerHistorii = setTimeout(() => { if ($('dialog[open]')) zaplanujZapis(); else zapamietajStan(); }, 300);
    odswiezCofanie();
  }
}

export async function zapiszTeraz() {
  clearTimeout(stan.timerZapisu);
  stan.timerZapisu = null;
  if (!stan.projekt) return stan.zapisywanie;
  zapiszBiezacyCel();
  for (const id of naPlotnie?.strony || [naPlotnie?.wzorzec]) odswiezMiniature(id);
  stan.projekt.zmieniono = new Date().toISOString();
  const projekt = stan.projekt;
  stan.zapisywanie = stan.zapisywanie.then(async () => {
    try {
      await zapiszLokalnie(projekt, wlasciciel(), Boolean(stan.uzytkownik));
      if (stan.uzytkownik) zaplanujChmure();
      else stanZapisu('ok', 'Zapisano w przeglądarce');
    } catch (e) {
      stanZapisu('blad', `Błąd zapisu: ${e.message}`);
    }
  });
  return stan.zapisywanie;
}

export function zaplanujChmure(opoznienie = 2500) {
  if (!stan.uzytkownik) return;
  clearTimeout(stan.timerChmury);
  stan.timerChmury = setTimeout(synchronizuj, opoznienie);
}

export async function synchronizuj({ wymus = false } = {}) {
  const p = stan.projekt;
  if (!stan.uzytkownik || !p) return;
  if (!navigator.onLine) {
    stanZapisu('offline', 'Offline – zapisano na urządzeniu');
    return;
  }
  if (stan.konflikt === p.id && !wymus) return; // czekamy na decyzję użytkownika
  const wersja = p.zmieniono;
  try {
    await chmura.zapiszWChmurze(p, { wymus });
    stan.konflikt = null;
    await zapiszLokalnie(p, wlasciciel(), p.zmieniono !== wersja);
    await oznaczZsynchronizowany(p.id, wersja);
    if (stan.projekt === p && !stan.timerZapisu) stanZapisu('ok', 'Zapisano');
  } catch (e) {
    if (e.konflikt) { rozstrzygnijKonflikt(p, e); return; }
    stanZapisu('blad', `Nie wysłano: ${chmura.komunikatBledu(e)}`);
  }
}

// Na koncie jest wersja zapisana z innego urządzenia – nic nie nadpisujemy po cichu.
async function rozstrzygnijKonflikt(p, e) {
  if (stan.konflikt === p.id) return;
  stan.konflikt = p.id;
  stanZapisu('blad', 'Nowsza wersja na koncie – wybierz, którą zachować');
  const kiedyTamta = e.zmieniono ? ` (zapisana ${kiedy(e.zmieniono)})` : '';
  const moja = await potwierdz(
    'Projekt zmieniono na innym urządzeniu',
    `Na koncie jest inna wersja projektu „${p.nazwa}”${kiedyTamta}. Możesz zachować wersję z tego urządzenia – tamta zostanie zastąpiona – albo wczytać wersję z konta i porzucić zmiany zrobione tutaj.`,
    'Zachowaj wersję z tego urządzenia',
    false,
    'Wczytaj wersję z konta',
  );
  if (stan.projekt !== p) { stan.konflikt = null; return; }
  if (moja) {
    await synchronizuj({ wymus: true });
    return;
  }
  try {
    const zKonta = normalizuj(await chmura.wczytajZChmury(p.id));
    await zapiszLokalnie(zKonta, wlasciciel(), false);
    stan.konflikt = null;
    clearTimeout(stan.timerZapisu);
    stan.timerZapisu = null;
    stan.projekt = null; // żeby otwarcie nie zapisało porzucanej wersji
    await otworzProjekt(zKonta);
    powiadom('Wczytano wersję z konta.');
  } catch (blad) {
    stan.konflikt = null;
    stanZapisu('blad', `Nie udało się wczytać wersji z konta: ${chmura.komunikatBledu(blad)}`);
  }
}
