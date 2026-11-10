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
function odciskTresci(projekt) {
  const tekst = JSON.stringify([projekt.nazwa, projekt.sekcje, projekt.wzorce, projekt.strony, projekt.style]);
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i += 1) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${tekst.length}-${(h >>> 0).toString(36)}`;
}

function linkUdostepnienia(p) {
  const u = p.udostepnienie;
  return `${location.origin}${location.pathname}#/u/${u.konto}/${p.id}/${u.kod}`;
}

function odswiezOknoUdostepniania() {
  const p = stan.projekt;
  const u = p.udostepnienie;
  const zKontem = Boolean(stan.uzytkownik);
  $('#udostepnij-link-blok').hidden = !u;
  $('#udostepnij-wylacz').hidden = !u;
  $('#udostepnij-utworz').hidden = !zKontem;
  $('#udostepnij-komunikat').textContent = zKontem ? '' : 'Udostępnianie wymaga konta – w trybie bez konta projekty są tylko w tej przeglądarce.';
  $('#udostepnij-utworz').textContent = u ? 'Aktualizuj' : 'Utwórz link';
  if (!u) return;
  $('#udostepnij-link').value = linkUdostepnienia(p);
  const aktualny = u.odcisk === odciskTresci(p);
  $('#udostepnij-stan').textContent = aktualny
    ? `Link pokazuje aktualny stan projektu (zaktualizowano ${kiedy(u.zaktualizowano)}).`
    : `Projekt zmienił się od ostatniej aktualizacji linku (${kiedy(u.zaktualizowano)}). Kliknij „Aktualizuj”, aby osoby z linkiem zobaczyły zmiany.`;
  $('#udostepnij-utworz').disabled = false;
  $('#udostepnij-utworz').classList.toggle('glowny', !aktualny);
}

export async function otworzUdostepnianie() {
  if (!stan.projekt) return;
  odswiezOknoUdostepniania();
  $('#dlg-udostepnij').showModal();
}

// Rysuje wszystkie strony do JPEG i wysyła je razem z manifestem.
export async function opublikujUdostepnienie() {
  const p = stan.projekt;
  const przycisk = $('#udostepnij-utworz');
  const komunikat = $('#udostepnij-komunikat');
  komunikat.classList.remove('sukces');
  przycisk.disabled = true;
  try {
    await zapiszTeraz();
    const kod = p.udostepnienie?.kod
      || [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const ciag = rozwin(p);
    const poKluczu = new Map(ciag.egzemplarze.map((e) => [e.klucz, e]));
    const uklad = ukladProjektu(p, ciag);
    const strony = stronyUkladu(uklad);
    const obraz = async (s) => {
      const url = await renderujCel(p, poKluczu.get(s.id), {
        szerokoscPx: 1200, spad: false, ciag, format: 'jpeg',
      });
      return (await fetch(url)).blob();
    };
    komunikat.textContent = `Przygotowuję strony: 0 z ${strony.length}…`;
    const wynik = await chmura.opublikujPodglad(p.id, kod, uklad, strony, obraz, (i, n) => {
      komunikat.textContent = `Wysyłam strony: ${i} z ${n}…`;
    });
    p.udostepnienie = { kod, konto: wynik.konto, zaktualizowano: wynik.zaktualizowano, odcisk: odciskTresci(p) };
    komunikat.textContent = wynik.wyslane < wynik.wszystkie
      ? `Gotowe. Wysłano ${wynik.wyslane} z ${wynik.wszystkie} stron – reszta się nie zmieniła.`
      : 'Gotowe. Skopiuj link i wyślij go, komu chcesz.';
    komunikat.classList.add('sukces');
    await zapiszTeraz();
  } catch (e) {
    komunikat.textContent = `Nie udało się udostępnić: ${chmura.komunikatBledu(e)}`;
  } finally {
    przycisk.disabled = false;
    odswiezOknoUdostepnianiaZachowujacKomunikat();
  }
}

function odswiezOknoUdostepnianiaZachowujacKomunikat() {
  const k = $('#udostepnij-komunikat');
  const [tekst, sukces] = [k.textContent, k.classList.contains('sukces')];
  odswiezOknoUdostepniania();
  k.textContent = tekst;
  k.classList.toggle('sukces', sukces);
}

export async function wylaczUdostepnienie() {
  const p = stan.projekt;
  if (!p.udostepnienie) return;
  if (!await potwierdz('Wyłączyć link?', 'Osoby, które dostały link, przestaną widzieć podgląd. Nowy link będzie miał inny adres.', 'Wyłącz link', true)) return;
  try {
    await chmura.wylaczPodglad(p.id, p.udostepnienie.kod);
    delete p.udostepnienie;
    await zapiszTeraz();
    odswiezOknoUdostepniania();
    $('#udostepnij-komunikat').textContent = 'Link wyłączony.';
  } catch (e) {
    $('#udostepnij-komunikat').textContent = `Nie udało się wyłączyć: ${chmura.komunikatBledu(e)}`;
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
