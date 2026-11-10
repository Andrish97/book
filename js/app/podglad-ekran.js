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

export async function pokazPodglad() {
  if (!stan.projekt) return;
  await zapiszTeraz();
  const biezaca = stan.tryb === 'strona' ? biezacaStrona().id : null;
  pokazEkran('podglad');
  trasa.ustaw(`p/${stan.projekt.id}/podglad`);
  document.title = `${stan.projekt.nazwa} – podgląd – ${NAZWA}`;
  podglad.pokazProjekt(stan.projekt, biezaca);
  $('#podglad-tresc').focus({ preventScroll: true });
}

export function zamknijPodglad() {
  if (document.body.classList.contains('podglad-publiczny')) return;
  doEdycji(stan.tryb === 'strona' ? biezacaStrona().id : stan.projekt.strony[0].id);
}

// ---------- Podgląd udostępniony linkiem ----------

// Widok dla osoby z linkiem: bez logowania, same obrazy stron.
export async function pokazUdostepniony(t) {
  document.body.classList.add('podglad-publiczny');
  pokazEkran('podglad');
  try {
    const { manifest, adresObrazu } = await chmura.wczytajPodgladPubliczny(t.konto, t.projekt, t.kod);
    document.title = `${manifest.uklad.nazwa} – ${NAZWA}`;
    const kiedyStan = new Date(manifest.zaktualizowano).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    podglad.pokaz(manifest.uklad, {
      obraz: (strona) => adresObrazu(strona.id), stale: true, klikalne: false, opis: `stan z ${kiedyStan}`,
    });
  } catch (e) {
    document.title = NAZWA;
    $('#podglad-tytul').textContent = 'Podgląd niedostępny';
    $('#podglad-opis').textContent = '';
    const el = $('#podglad-tresc');
    el.innerHTML = '<div class="podglad-pusto"><h2>Ten link nie działa</h2><p class="ciche"></p><a class="przycisk" href="./">Przejdź do Seriodruku</a></div>';
    $('p', el).textContent = e.message;
  }
}

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
  $('#udostepnij-komunikat').textContent = zKontem ? '' : 'Udostępnianie wymaga konta – w trybie bez konta projekty są tylko w tej przeglądarce.';
  $('#udostepnij-komunikat').classList.remove('sukces');
  if (!u) return;
  $('#udostepnij-link').value = linkUdostepnienia(p);
  const aktualny = u.odcisk === odciskTresci(p);
  $('#udostepnij-stan').textContent = trwaPublikacja
    ? 'Aktualizuję link…'
    : (aktualny
      ? `Link pokazuje aktualny stan projektu (zaktualizowano ${kiedy(u.zaktualizowano)}).`
      : `Projekt zmienił się po ostatniej aktualizacji linku (${kiedy(u.zaktualizowano)}). Link zaktualizuje się sam, gdy zmiany zapiszą się na koncie.`);
}

export async function otworzUdostepnianie(projekt = null) {
  celOkna = projekt && projekt !== stan.projekt ? projekt : null;
  if (!celOkna && !stan.projekt) return;
  odswiezOknoUdostepniania();
  $('#dlg-udostepnij').showModal();
}

// Rysuje zmienione strony do JPEG i wysyła je razem z opisem. Zwraca { wyslane, wszystkie }.
async function opublikuj(p, postep = () => {}) {
  const kod = p.udostepnienie?.kod
    || [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const ciag = rozwin(p);
  const poKluczu = new Map(ciag.egzemplarze.map((e) => [e.klucz, e]));
  const uklad = ukladProjektu(p, ciag);
  const strony = stronyUkladu(uklad);
  const odciski = Object.fromEntries(strony.map((s) => [s.id, odciskStrony(p, poKluczu.get(s.id), ciag)]));
  const obraz = async (s) => {
    const url = await renderujCel(p, poKluczu.get(s.id), { szerokoscPx: 1200, spad: false, ciag, format: 'jpeg' });
    return (await fetch(url)).blob();
  };
  const odcisk = odciskTresci(p);
  const wynik = await chmura.opublikujPodglad(p.id, kod, uklad, strony, obraz, postep, odciski);
  p.udostepnienie = { kod, konto: wynik.konto, zaktualizowano: wynik.zaktualizowano, odcisk };
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
    komunikat.textContent = 'Przygotowuję strony…';
    const wynik = await opublikuj(p, (i, n) => { komunikat.textContent = `Strony: ${i} z ${n}…`; });
    komunikat.textContent = wynik.wyslane < wynik.wszystkie
      ? `Gotowe. Wysłano ${wynik.wyslane} z ${wynik.wszystkie} stron – reszta się nie zmieniła.`
      : 'Gotowe. Skopiuj link i wyślij go, komu chcesz. Od teraz będzie się aktualizował sam.';
    komunikat.classList.add('sukces');
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
const OPOZNIENIE_LINKU_MS = 4000;
let timerLinku = null;
export function zaplanujAktualizacjeLinku() {
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
  }, OPOZNIENIE_LINKU_MS);
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
