// Ekran podglądu bez edycji i udostępnianie podglądu linkiem.

import { renderujCel } from '../zlozenie.js';
import { rozwin } from '../serie.js';
import * as chmura from '../chmura.js';
import { $, kiedy, potwierdz, powiadom } from '../ui.js';
import { NAZWA } from '../marka.js';
import { ukladProjektu, stronyUkladu } from '../podglad.js';
import { stan, pokazEkran, trasa, edytor, biezacaStrona } from './kontekst.js';
import { zapiszTeraz } from './zapis.js';
import { podglad } from './skladniki.js';
import { przejdzDoStrony } from './lista-stron.js';
import { zapiszGdziekolwiek, pokazProjekty } from './projekty.js';
import { wzorceStrony } from '../projekt.js';

export async function doEdycji(idStrony) {
  const i = stan.projekt.strony.findIndex((s) => s.id === idStrony);
  pokazEkran('edytor');
  if (stan.tryb === 'strona' && i === stan.indeks) {
    trasa.ustaw(`p/${stan.projekt.id}/s/${idStrony}`);
    edytor.canvas.calcOffset();
  } else {
    trasa.ustaw(`p/${stan.projekt.id}`);
    await przejdzDoStrony(i);
    edytor.canvas.calcOffset();
  }
}

// opcje.nrStrony: numer strony w wydruku, na której podgląd ma się otworzyć (z listy uwag przed drukiem).
export async function pokazPodglad(opcje = null) {
  if (!stan.projekt) return;
  const nrStrony = Number.isInteger(opcje?.nrStrony) ? opcje.nrStrony : null;
  await zapiszTeraz();
  const biezaca = stan.tryb === 'strona' ? biezacaStrona().id : null;
  pokazEkran('podglad');
  trasa.ustaw(`p/${stan.projekt.id}/podglad`);
  document.title = `${stan.projekt.nazwa} – podgląd – ${NAZWA}`;
  podglad.pokazProjekt(stan.projekt, biezaca, nrStrony, odciskPodgladu);
  $('#podglad-tresc').focus({ preventScroll: true });
}

// Otwarty podgląd po zmianie projektu z innego urządzenia albo od AI (js/app/zapis.js: polaczZKontem).
// Podgląd zostaje w tym samym miejscu, a przerysowują się tylko strony, które wyglądają inaczej.
export function odswiezPodglad() {
  if (!stan.projekt || document.body.dataset.ekran !== 'podglad' || document.body.classList.contains('podglad-publiczny')) return;
  document.title = `${stan.projekt.nazwa} – podgląd – ${NAZWA}`;
  podglad.odswiezProjekt(stan.projekt, odciskPodgladu);
}

export function zamknijPodglad() {
  if (document.body.classList.contains('podglad-publiczny')) return;
  if (document.body.classList.contains('tylko-ogladanie')) return; // rola „może oglądać”: tylko podgląd
  doEdycji(stan.tryb === 'strona' ? biezacaStrona().id : stan.projekt.strony[0].id);
}

// ---------- Podgląd udostępniony linkiem ----------

// Widok dla osoby z linkiem: bez logowania, same obrazy stron.
// pokazUdostepniony mieszka w lekkim module js/app/udostepnione.js (bez edytora); tu zostaje dla zgodności.
export { pokazUdostepniony } from './udostepnione.js';

// Skrót treści projektu – pozwala powiedzieć, czy link pokazuje aktualny stan.
function skrot(tekst) {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i += 1) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${tekst.length}-${(h >>> 0).toString(36)}`;
}
const odciskTresci = (projekt) => skrot(JSON.stringify([projekt.nazwa, projekt.sekcje, projekt.wzorce, projekt.strony, projekt.style, projekt.tabele, projekt.serie, projekt.czcionki]));

// Skrót wszystkiego, od czego zależy wygląd jednej strony wydruku. Strona o tym samym
// skrócie co przy poprzedniej aktualizacji linku nie jest rysowana ani wysyłana.
function odciskStrony(projekt, egz, ciag) {
  const wzorce = wzorceStrony(projekt, egz.strona).map((w) => [w.obiekty, w.tlo, w.lustro]);
  return skrot(JSON.stringify([
    egz.strona.obiekty, egz.strona.tlo, egz.sasiad?.strona.obiekty, egz.sasiad?.wiersz, wzorce, egz.sekcja.wydruk, egz.sekcja.nazwa, projekt.nazwa,
    egz.wiersz, egz.dodatkowe.map((d) => d.wiersz), egz.nr, egz.indeks, egz.nrWSekcji, egz.nrEgz, egz.ileEgz, egz.bok, ciag.liczbaStron, ciag.egzemplarze.length,
    projekt.czcionki, projekt.sekcje.map((s) => s.nazwa), projekt.strony.map((s) => s.nazwa),
  ]));
}

// Skrót strony podglądu: to samo co przy linku, a do tego style tekstu i tekst płynący z innych stron
// (ramki tego samego wątku) – zmiana gdziekolwiek w wątku może przesunąć tekst na tej stronie.
function odciskPodgladu(egz, ciag) {
  const p = stan.projekt;
  const watki = new Set(egz.strona.obiekty.map((o) => o.watek).filter(Boolean));
  const watek = watki.size ? p.strony.flatMap((s) => s.obiekty.filter((o) => watki.has(o.watek))) : [];
  return skrot(JSON.stringify([odciskStrony(p, egz, ciag), p.style, watek]));
}

function linkUdostepnienia(p) {
  const u = p.udostepnienie;
  return `${location.origin}${location.pathname}#/u/${u.konto}/${p.id}/${u.kod}`;
}

// Projekt, którego dotyczy otwarte okno: zwykle otwarty w edytorze, a po kliknięciu plakietki
// na liście projektów – wczytany tylko po to, żeby pokazać link albo go unieważnić.
let celOkna = null;
let trwaPublikacja = false;

function odswiezOknoUdostepniania() {
  const p = celOkna || stan.projekt;
  if (!p) return;
  const u = p.udostepnienie;
  const zKontem = Boolean(stan.uzytkownik);
  const otwarty = p === stan.projekt;
  $('#udostepnij-link-blok').hidden = !u;
  $('#udostepnij-wylacz').hidden = !u;
  $('#udostepnij-utworz').hidden = !zKontem || Boolean(u) || !otwarty;
  $('#udostepnij-teraz').hidden = !zKontem || !u || !otwarty;
  $('#udostepnij-komunikat').textContent = zKontem ? '' : 'Udostępnianie wymaga zalogowania.';
  $('#udostepnij-komunikat').classList.remove('sukces');
  odswiezOchrone(p, zKontem && otwarty);
  if (!u) return;
  $('#udostepnij-link').value = linkUdostepnienia(p);
  const aktualny = u.odcisk === odciskTresci(p);
  $('#udostepnij-stan').textContent = trwaPublikacja
    ? 'Aktualizuję link…'
    : (aktualny
      ? `Link pokazuje aktualny stan projektu (zaktualizowano ${kiedy(u.zaktualizowano)}).`
      : `Projekt zmienił się po ostatniej aktualizacji linku (${kiedy(u.zaktualizowano)}). Link zaktualizuje się sam, gdy zmiany zapiszą się na koncie.`);
}

// ---------- Ochrona linku: hasło i data ważności ----------

const dzienZIso = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Link jest ważny do końca wybranego dnia (czasu urządzenia, na którym go ustawiono).
const isoZDnia = (dzien) => (dzien ? new Date(`${dzien}T23:59:59.999`).toISOString() : null);
const dataSlownie = (iso) => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

function opisOchrony(ochrona) {
  if (!ochrona) return 'Link bez ochrony – podgląd zobaczy każdy, kto dostanie link.';
  const czesci = [];
  if (ochrona.haslo) czesci.push('chroniony hasłem');
  if (ochrona.wazny_do) czesci.push(`${new Date(ochrona.wazny_do) < new Date() ? 'wygasł' : 'ważny do'} ${dataSlownie(ochrona.wazny_do)}`);
  return `Link ${czesci.join(', ')}.`;
}

function odswiezPolaOchrony() {
  const u = (celOkna || stan.projekt)?.udostepnienie;
  $('#udostepnij-haslo-pole').hidden = !$('#udostepnij-haslo-wl').checked;
  $('#udostepnij-termin-pole').hidden = !$('#udostepnij-termin-wl').checked;
  $('#udostepnij-haslo').placeholder = u?.ochrona?.haslo ? 'bez zmian – wpisz nowe, żeby je zmienić' : 'co najmniej 4 znaki';
}

// Pola ochrony według zapisanych ustawień linku – przy otwarciu okna i po udanym zapisie
// (nie przy każdym odświeżeniu, żeby nie kasować tego, co ktoś właśnie zaznacza).
function wypelnijOchrone(p) {
  const o = p?.udostepnienie?.ochrona;
  $('#udostepnij-haslo-wl').checked = Boolean(o?.haslo);
  $('#udostepnij-haslo').value = '';
  $('#udostepnij-termin-wl').checked = Boolean(o?.wazny_do);
  $('#udostepnij-termin').value = dzienZIso(o?.wazny_do);
}

function odswiezOchrone(p, mozna) {
  $('#udostepnij-ochrona').hidden = !mozna;
  $('#udostepnij-ochrona-stan').textContent = p.udostepnienie ? opisOchrony(p.udostepnienie.ochrona) : 'Ustawienia zadziałają od razu przy tworzeniu linku.';
  $('#udostepnij-ochrona-zapisz').hidden = !p.udostepnienie;
  odswiezPolaOchrony();
}

// Ochrona wybrana w oknie: { chroniony, zmienHaslo, haslo, waznyDo } albo { blad }.
function ochronaZOkna(p) {
  const o = p.udostepnienie?.ochrona;
  const chceHasla = $('#udostepnij-haslo-wl').checked;
  const haslo = $('#udostepnij-haslo').value;
  const chceTerminu = $('#udostepnij-termin-wl').checked;
  const dzien = $('#udostepnij-termin').value;
  if (chceHasla && !haslo && !o?.haslo) return { blad: 'Wpisz hasło do linku (co najmniej 4 znaki).' };
  if (chceHasla && haslo && haslo.length < 4) return { blad: 'Hasło do linku musi mieć co najmniej 4 znaki.' };
  if (chceTerminu && !dzien) return { blad: 'Wybierz ostatni dzień ważności linku.' };
  const waznyDo = chceTerminu ? isoZDnia(dzien) : null;
  if (waznyDo && new Date(waznyDo) < new Date()) return { blad: 'Data ważności już minęła – wybierz dzisiejszą albo późniejszą.' };
  return { chroniony: chceHasla || chceTerminu, zmienHaslo: !chceHasla || Boolean(haslo), haslo: chceHasla ? haslo : '', waznyDo };
}

// Ustawia ochronę linku i – gdy zmienia się rodzaj linku – przenosi strony między folderem
// publicznym a chronionym. Adres linku zostaje ten sam.
async function zastosujOchrone(p, w, postep = () => {}) {
  const u = p.udostepnienie;
  const byla = Boolean(u?.ochrona);
  if (w.chroniony) {
    const ochrona = await chmura.ustawOchroneLinku(p.id, u.kod, w);
    u.ochrona = { haslo: Boolean(ochrona?.haslo), wazny_do: ochrona?.wazny_do || null };
    if (!byla) {
      await opublikuj(p, postep, { pelna: true });
      await chmura.wylaczPodglad(p.id, u.kod); // obrazy znikają z publicznego folderu
    } else if (ochrona.nowyFolder) {
      // Nowe hasło – nowy folder z sekretem (#97): stare adresy już nie działają, strony idą od nowa.
      await opublikuj(p, postep, { pelna: true });
    }
  } else if (byla) {
    delete u.ochrona;
    await opublikuj(p, postep, { pelna: true });
    await chmura.usunPodgladChroniony(p.id, u.kod);
  }
}

// Przycisk „Zapisz ochronę”.
export async function zapiszOchroneLinku() {
  const p = stan.projekt;
  const komunikat = $('#udostepnij-komunikat');
  komunikat.classList.remove('sukces');
  if (!p?.udostepnienie) return;
  const w = ochronaZOkna(p);
  if (w.blad) { komunikat.textContent = w.blad; return; }
  if (!w.chroniony && !p.udostepnienie.ochrona) { komunikat.textContent = 'Link jest bez ochrony.'; return; }
  const przycisk = $('#udostepnij-ochrona-zapisz');
  przycisk.disabled = true;
  trwaPublikacja = true;
  try {
    komunikat.textContent = 'Zapisuję ochronę linku…';
    await zastosujOchrone(p, w, (i, n) => { komunikat.textContent = `Przenoszę strony: ${i} z ${n}…`; });
    await zapiszTeraz();
    komunikat.textContent = `Zapisano. ${opisOchrony(p.udostepnienie.ochrona)}`;
    komunikat.classList.add('sukces');
    wypelnijOchrone(p);
  } catch (e) {
    komunikat.textContent = `Nie udało się zapisać ochrony: ${chmura.komunikatBledu(e)}`;
  } finally {
    trwaPublikacja = false;
    przycisk.disabled = false;
    odswiezOknoUdostepnianiaZachowujacKomunikat();
  }
}

for (const id of ['#udostepnij-haslo-wl', '#udostepnij-termin-wl']) $(id)?.addEventListener('change', odswiezPolaOchrony);

export async function otworzUdostepnianie(projekt = null) {
  celOkna = projekt && projekt !== stan.projekt ? projekt : null;
  if (!celOkna && !stan.projekt) return;
  wypelnijOchrone(celOkna || stan.projekt);
  odswiezOknoUdostepniania();
  $('#dlg-udostepnij').showModal();
}

let webp = null;
const umieWebp = () => {
  if (webp === null) { const c = document.createElement('canvas'); c.width = 2; c.height = 2; webp = c.toDataURL('image/webp').startsWith('data:image/webp'); }
  return webp;
};

const nowyKod = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');

// Rysuje zmienione strony do JPEG i wysyła je razem z opisem – do folderu publicznego albo,
// przy linku z ochroną, do tabeli chronionego linku. pelna: wysyła wszystkie strony.
// Zwraca { wyslane, wszystkie }.
async function opublikuj(p, postep = () => {}, { pelna = false } = {}) {
  const kod = p.udostepnienie?.kod || nowyKod();
  const ochrona = p.udostepnienie?.ochrona;
  const ciag = rozwin(p);
  const poKluczu = new Map(ciag.egzemplarze.map((e) => [e.klucz, e]));
  const uklad = ukladProjektu(p, ciag);
  const strony = stronyUkladu(uklad);
  const odciski = Object.fromEntries(strony.map((s) => [s.id, odciskStrony(p, poKluczu.get(s.id), ciag)]));
  // WebP: ten sam wygląd przy ok. 30–40% mniejszych plikach (mniej transferu dla oglądających, #90).
  // Przeglądarka, która nie umie zapisać WebP (oddaje PNG), wysyła JPEG jak dawniej.
  const rozszerzenie = umieWebp() ? 'webp' : 'jpg';
  const obraz = async (s) => {
    const url = await renderujCel(p, poKluczu.get(s.id), { szerokoscPx: 1200, spad: false, ciag, ...(rozszerzenie === 'webp' ? { format: 'webp', jakosc: 0.8 } : { format: 'jpeg' }) });
    return (await fetch(url)).blob();
  };
  const odcisk = odciskTresci(p);
  const wynik = ochrona
    ? await chmura.opublikujPodgladChroniony(p.id, kod, uklad, strony, obraz, postep, odciski, { pelna, rozszerzenie })
    : await chmura.opublikujPodglad(p.id, kod, uklad, strony, obraz, postep, pelna ? null : odciski, { rozszerzenie });
  p.udostepnienie = { kod, konto: wynik.konto, zaktualizowano: wynik.zaktualizowano, odcisk, ...(ochrona ? { ochrona } : {}) };
  return wynik;
}

// Przycisk „Utwórz link” albo „Aktualizuj teraz”.
export async function opublikujUdostepnienie() {
  const p = stan.projekt;
  const komunikat = $('#udostepnij-komunikat');
  komunikat.classList.remove('sukces');
  for (const b of [$('#udostepnij-utworz'), $('#udostepnij-teraz')]) b.disabled = true;
  trwaPublikacja = true;
  try {
    await zapiszTeraz();
    if (!p.udostepnienie) {
      // Nowy link: ochrona wybrana w oknie działa od pierwszej publikacji.
      const w = ochronaZOkna(p);
      if (w.blad) { komunikat.textContent = w.blad; return; }
      if (w.chroniony) {
        const kod = nowyKod();
        const ochrona = await chmura.ustawOchroneLinku(p.id, kod, w);
        p.udostepnienie = { kod, ochrona: { haslo: Boolean(ochrona?.haslo), wazny_do: ochrona?.wazny_do || null } };
      }
    }
    komunikat.textContent = 'Przygotowuję strony…';
    const wynik = await opublikuj(p, (i, n) => { komunikat.textContent = `Strony: ${i} z ${n}…`; });
    komunikat.textContent = wynik.wyslane < wynik.wszystkie
      ? `Gotowe. Wysłano ${wynik.wyslane} z ${wynik.wszystkie} stron – reszta się nie zmieniła.`
      : 'Gotowe. Skopiuj link i wyślij go, komu chcesz. Od teraz będzie się aktualizował sam.';
    komunikat.classList.add('sukces');
    wypelnijOchrone(p);
    await zapiszTeraz();
  } catch (e) {
    komunikat.textContent = `Nie udało się udostępnić: ${chmura.komunikatBledu(e)}`;
  } finally {
    trwaPublikacja = false;
    for (const b of [$('#udostepnij-utworz'), $('#udostepnij-teraz')]) b.disabled = false;
    odswiezOknoUdostepnianiaZachowujacKomunikat();
  }
}

// Link aktualizuje się sam: chwilę po tym, jak zmiany zapiszą się na koncie.
// Kolejna zmiana w tym czasie odsuwa aktualizację, żeby nie rysować stron po każdym ruchu.
// Zmiany, które przyszły z konta (inne urządzenie, AI), czekają dłużej: jeśli zrobiono je w aplikacji na
// innym urządzeniu, ono samo zaktualizuje link, a wiadomość o tym zdąży tu dojść – link nie jest rysowany
// dwa razy. Zmiany od AI nikt inny nie narysuje, więc robi to otwarta tu aplikacja.
const OPOZNIENIE_LINKU_MS = 4000;
export const OPOZNIENIE_LINKU_Z_KONTA_MS = 15000;
let timerLinku = null;
export function zaplanujAktualizacjeLinku(opoznienie = OPOZNIENIE_LINKU_MS) {
  clearTimeout(timerLinku);
  const p = stan.projekt;
  if (!p?.udostepnienie || !stan.uzytkownik || p.udostepnienie.odcisk === odciskTresci(p)) return;
  timerLinku = setTimeout(async () => {
    if (stan.projekt !== p || !p.udostepnienie || trwaPublikacja || !navigator.onLine) return;
    if (p.udostepnienie.odcisk === odciskTresci(p)) return;
    trwaPublikacja = true;
    if ($('#dlg-udostepnij').open) odswiezOknoUdostepniania();
    try {
      await opublikuj(p);
      await zapiszTeraz();
    } catch { /* spróbujemy przy następnym zapisie */ } finally {
      trwaPublikacja = false;
      if ($('#dlg-udostepnij').open) odswiezOknoUdostepniania();
    }
  }, opoznienie);
}

// Po otwarciu projektu: link z ochroną, którego strony trzeba opublikować w nowym folderze (po przeniesieniu
// plików linków z bazy do R2, #97) – właściciel publikuje je sam, bez czekania na zmianę w projekcie.
export async function sprawdzLinkPoOtwarciu(p) {
  const u = p?.udostepnienie;
  if (!u?.ochrona || !stan.uzytkownik || (u.konto && u.konto !== stan.uzytkownik.id)) return;
  try {
    if (await chmura.linkChronionyDoPublikacji(p.id, u.kod) && stan.projekt === p) {
      u.odcisk = null;
      zaplanujAktualizacjeLinku(500);
    }
  } catch { /* bez sieci – sprawdzimy przy następnym otwarciu */ }
}

function odswiezOknoUdostepnianiaZachowujacKomunikat() {
  const k = $('#udostepnij-komunikat');
  const [tekst, sukces] = [k.textContent, k.classList.contains('sukces')];
  odswiezOknoUdostepniania();
  k.textContent = tekst;
  k.classList.toggle('sukces', sukces);
}

// Unieważnia link: usuwa obrazy stron; stary adres przestaje działać.
export async function wylaczUdostepnienie() {
  const p = celOkna || stan.projekt;
  if (!p?.udostepnienie) return;
  if (!await potwierdz('Unieważnić link?', 'Osoby, które dostały link, przestaną widzieć podgląd. Jeśli udostępnisz projekt ponownie, link będzie miał inny adres.', 'Unieważnij link', true)) return;
  try {
    clearTimeout(timerLinku);
    if (p.udostepnienie.ochrona) await chmura.usunPodgladChroniony(p.id, p.udostepnienie.kod);
    await chmura.wylaczPodglad(p.id, p.udostepnienie.kod);
    delete p.udostepnienie;
    if (p === stan.projekt) await zapiszTeraz(); else { p.zmieniono = new Date().toISOString(); await zapiszGdziekolwiek(p); }
    odswiezOknoUdostepniania();
    $('#udostepnij-komunikat').textContent = 'Link unieważniony.';
    if (document.body.dataset.ekran === 'projekty') pokazProjekty();
  } catch (e) {
    $('#udostepnij-komunikat').textContent = `Nie udało się unieważnić: ${chmura.komunikatBledu(e)}`;
  }
}

export async function kopiujLinkUdostepnienia() {
  const pole = $('#udostepnij-link');
  try {
    await navigator.clipboard.writeText(pole.value);
    powiadom('Link skopiowany.');
  } catch {
    pole.select();
    powiadom('Zaznaczyłem link – skopiuj go z pola.');
  }
}
