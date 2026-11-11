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
  podglad.pokazProjekt(stan.projekt, biezaca, nrStrony);
  $('#podglad-tresc').focus({ preventScroll: true });
}

export function zamknijPodglad() {
  if (document.body.classList.contains('podglad-publiczny')) return;
  doEdycji(stan.tryb === 'strona' ? biezacaStrona().id : stan.projekt.strony[0].id);
}

// ---------- Podgląd udostępniony linkiem ----------

// Widok dla osoby z linkiem: bez logowania, same obrazy stron. Link bez ochrony czyta pliki
// z publicznego folderu; link z hasłem albo datą ważności – przez funkcję bazy (chmura.js).
export async function pokazUdostepniony(t) {
  document.body.classList.add('podglad-publiczny');
  pokazEkran('podglad');
  try {
    let dane;
    try {
      dane = await chmura.wczytajPodgladPubliczny(t.konto, t.projekt, t.kod);
    } catch (bladPubliczny) {
      try {
        await chmura.sprawdzLinkChroniony(t.konto, t.projekt, t.kod);
      } catch (e) {
        if (e.stanLinku === 'haslo') { pokazPoleHasla(t); return; }
        throw e.stanLinku && e.stanLinku !== 'brak' ? e : bladPubliczny;
      }
      dane = await chmura.wczytajPodgladChroniony(t.konto, t.projekt, t.kod);
    }
    pokazStronyLinku(dane);
  } catch (e) {
    pokazBladLinku(e);
  }
}

function pokazStronyLinku({ manifest, adresObrazu }) {
  document.title = `${manifest.uklad.nazwa} – ${NAZWA}`;
  const kiedyStan = new Date(manifest.zaktualizowano).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  podglad.pokaz(manifest.uklad, {
    obraz: (strona) => adresObrazu(strona.id), stale: true, klikalne: false, opis: `stan z ${kiedyStan}`,
  });
}

function pokazBladLinku(e) {
  document.title = NAZWA;
  $('#podglad-tytul').textContent = 'Podgląd niedostępny';
  $('#podglad-opis').textContent = '';
  const el = $('#podglad-tresc');
  el.innerHTML = `<div class="podglad-pusto"><h2>${e.stanLinku === 'wygasl' ? 'Link wygasł' : 'Ten link nie działa'}</h2><p class="ciche"></p><a class="przycisk" href="./">Przejdź do Seriodruku</a></div>`;
  $('p', el).textContent = e.message;
}

// Link chroniony hasłem: pole hasła; dopiero poprawne hasło pokazuje strony.
function pokazPoleHasla(t) {
  document.title = NAZWA;
  $('#podglad-tytul').textContent = 'Podgląd chroniony hasłem';
  $('#podglad-opis').textContent = '';
  const el = $('#podglad-tresc');
  el.innerHTML = `<div class="podglad-pusto" id="podglad-haslo"><h2>Podgląd chroniony hasłem</h2>
    <p class="ciche">Osoba, która udostępniła ten podgląd, ustawiła hasło. Wpisz je, żeby zobaczyć strony.</p>
    <form><input type="password" name="haslo" autocomplete="current-password" aria-label="Hasło do podglądu" placeholder="Hasło" required><button type="submit" class="przycisk glowny">Pokaż</button></form>
    <p class="komunikat" role="status"></p></div>`;
  const form = $('form', el);
  form.elements.haslo.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const komunikat = $('.komunikat', el);
    const przycisk = $('button', form);
    przycisk.disabled = true;
    komunikat.textContent = 'Sprawdzam hasło…';
    try {
      pokazStronyLinku(await chmura.wczytajPodgladChroniony(t.konto, t.projekt, t.kod, form.elements.haslo.value));
    } catch (blad) {
      if (blad.stanLinku === 'wygasl' || blad.stanLinku === 'brak') { pokazBladLinku(blad); return; }
      komunikat.textContent = blad.stanLinku ? blad.message : `Nie udało się wczytać podglądu: ${chmura.komunikatBledu(blad)}`;
      form.elements.haslo.select();
    } finally {
      przycisk.disabled = false;
    }
  });
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
  const obraz = async (s) => {
    const url = await renderujCel(p, poKluczu.get(s.id), { szerokoscPx: 1200, spad: false, ciag, format: 'jpeg' });
    return (await fetch(url)).blob();
  };
  const odcisk = odciskTresci(p);
  const wynik = ochrona
    ? await chmura.opublikujPodgladChroniony(p.id, kod, uklad, strony, obraz, postep, odciski, { pelna })
    : await chmura.opublikujPodglad(p.id, kod, uklad, strony, obraz, postep, pelna ? null : odciski);
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
