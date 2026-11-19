// Ekran podglądu bez edycji i udostępnianie podglądu linkiem.

import { opisMakiety } from '../makieta-opis.js';
import { renderujCel } from '../zlozenie.js';
import { postep as pasekPostepu } from '../postep.js';
import { rozwin } from '../serie.js';
import * as chmura from '../chmura.js';
import { $, kiedy, potwierdz, powiadom } from '../ui.js';
import { NAZWA } from '../marka.js';
import { ukladProjektu, stronyUkladu } from '../podglad.js';
import { stan, pokazEkran, trasa, edytor, biezacaStrona } from './kontekst.js';
import { zapiszTeraz, pokazEdytor, plotnoOdlozone, przygotujDoRysowania } from './zapis.js';
import { podglad } from './skladniki.js';
import { przejdzDoStrony } from './lista-stron.js';
import { zapiszGdziekolwiek, pokazProjekty } from './projekty.js';
import { wzorceStrony } from '../projekt.js';

export async function doEdycji(idStrony) {
  const i = stan.projekt.strony.findIndex((s) => s.id === idStrony);
  if (plotnoOdlozone && i >= 0) { stan.tryb = 'strona'; stan.indeks = i; }
  await pokazEdytor();
  if (stan.tryb === 'strona' && i === stan.indeks) {
    trasa.ustaw(`p/${stan.projekt.id}/s/${idStrony}`);
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
// 'm1' i projekt.makieta (#189): link idzie też za makietą 3D – a link sprzed #188 (bez opisu makiety) ma inny
// odcisk, więc przy najbliższym otwarciu projektu sam się uzupełnia (wysyła się tylko opis, strony się nie zmieniły).
const odciskTresci = (projekt) => skrot(JSON.stringify(['m1', projekt.nazwa, projekt.sekcje, projekt.wzorce, projekt.strony, projekt.style, projekt.tabele, projekt.serie, projekt.czcionki, projekt.makieta || null, projekt.znak_wodny || null]));

// Skrót wszystkiego, od czego zależy wygląd jednej strony wydruku. Strona o tym samym
// skrócie co przy poprzedniej aktualizacji linku nie jest rysowana ani wysyłana.
function odciskStrony(projekt, egz, ciag) {
  const wzorce = wzorceStrony(projekt, egz.strona).map((w) => [w.obiekty, w.tlo, w.lustro]);
  return skrot(JSON.stringify([
    egz.strona.obiekty, egz.strona.tlo, egz.sasiad?.strona.obiekty, egz.sasiad?.wiersz, wzorce, egz.sekcja.wydruk, egz.sekcja.nazwa, projekt.nazwa,
    egz.wiersz, egz.dodatkowe.map((d) => d.wiersz), egz.nr, egz.indeks, egz.nrWSekcji, egz.nrEgz, egz.ileEgz, egz.bok, ciag.liczbaStron, ciag.egzemplarze.length,
    projekt.czcionki, projekt.sekcje.map((s) => s.nazwa), projekt.strony.map((s) => s.nazwa), projekt.znak_wodny || null,
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
  if (u.krotki) return `${location.origin}/${u.krotki}`; // krótki link (#195)
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
  $('#udostepnij-link-blok').hidden = !u;
  $('#udostepnij-wylacz').hidden = !u;
  // Z listy projektów też (#196): utworzenie linku i „Aktualizuj teraz” rysują strony w tle.
  $('#udostepnij-utworz').hidden = !zKontem || Boolean(u);
  $('#udostepnij-teraz').hidden = !zKontem || !u;
  $('#udostepnij-komunikat').textContent = zKontem ? '' : 'Udostępnianie wymaga zalogowania.';
  $('#udostepnij-komunikat').classList.remove('sukces');
  odswiezOchrone(p, zKontem); // z listy projektów: ochronę też ustawisz i zmienisz (#190, #196)
  odswiezZnak(p, zKontem);
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
  return { chroniony: chceHasla || chceTerminu, zmienHaslo: chceHasla ? Boolean(haslo) : Boolean(o?.haslo), haslo: chceHasla ? haslo : '', waznyDo };
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

// Aktualizacja linku w tle (#316, zgłoszenie 19.11: „pliki dalej się tworzą, a pokazujemy pasek postępu”):
// strony linku rysuje ta przeglądarka – pasek na dole ekranu (także po zamknięciu okna Udostępnij) i ostrzeżenie
// przy zamykaniu karty. Przerwana aktualizacja dokończy się sama przy następnym otwarciu projektu (inny odcisk).
let trwajace = 0;
const ostrzezenieZamkniecia = (e) => { e.preventDefault(); e.returnValue = ''; };
function pilnujZamkniecia(tak) {
  trwajace = Math.max(0, trwajace + (tak ? 1 : -1));
  if (tak && trwajace === 1) window.addEventListener('beforeunload', ostrzezenieZamkniecia);
  if (!tak && trwajace === 0) window.removeEventListener('beforeunload', ostrzezenieZamkniecia);
}
async function linkWTle(praca) {
  const pasek = pasekPostepu('Aktualizuję podgląd z linku – nie zamykaj Makietki', { opoznienie: 0 });
  pilnujZamkniecia(true);
  try { return await praca((i, n) => pasek.krok(i, n)); } finally { pasek.koniec(); pilnujZamkniecia(false); }
}
export const trwaAktualizacjaLinku = () => trwajace > 0;

// Czy zmiana ochrony wymaga narysowania stron od nowa: przejście między linkiem publicznym a chronionym
// albo zmiana / zdjęcie hasła (nowy folder z sekretem). Sama data ważności – nie.
const ochronaRysuje = (u, w) => Boolean(w.chroniony) !== Boolean(u.ochrona) || (w.chroniony && w.zmienHaslo && (Boolean(w.haslo) || Boolean(u.ochrona?.haslo)));

// Przycisk „Zapisz ochronę”. Z listy projektów (#190): zmiana samej daty od razu; zmiana wymagająca stron
// (hasło, włączenie albo zdjęcie ochrony) rysuje je w tle, bez otwierania projektu.
export async function zapiszOchroneLinku() {
  const p = celOkna || stan.projekt;
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
    if (p !== stan.projekt && ochronaRysuje(p.udostepnienie, w)) {
      komunikat.textContent = 'Przygotowuję strony linku…';
      await przygotujDoRysowania(p);
    }
    komunikat.textContent = 'Zapisuję ochronę linku…';
    await linkWTle((pasek) => zastosujOchrone(p, w, (i, n) => { pasek(i, n); komunikat.textContent = `Przenoszę strony: ${i} z ${n}… (możesz zamknąć to okno, nie zamykaj Makietki)`; }));
    if (p === stan.projekt) await zapiszTeraz(); else { p.zmieniono = new Date().toISOString(); await zapiszGdziekolwiek(p); }
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

// ---------- Znak wodny (#191) ----------
// projekt.znak_wodny = { tekst } – napis ukośnie, powtarzany na całej stronie, wtopiony w obrazy linku
// (nie nakładka w przeglądarce oglądającego, więc nie da się go wyłączyć ani wyciąć z obrazu jednym ruchem).
export const ZNAK_DOMYSLNY = 'PODGLĄD';
// Krycie (zgłoszenie 19.11: „watermark troszkę bladszy albo suwak przezroczystości”): 5–50 %, domyślnie 12 %
// (wcześniej na stałe ok. 24 % szarego napisu + 30 % białej obwódki – za mocny).
export const KRYCIE_ZNAKU = 12;
export const kryciaZnaku = (z) => Math.max(5, Math.min(50, Math.round(Number(z?.krycie) || KRYCIE_ZNAKU)));

function wypelnijZnak(p) {
  $('#udostepnij-znak-wl').checked = Boolean(p?.znak_wodny);
  $('#udostepnij-znak-tekst').value = p?.znak_wodny?.tekst || '';
  $('#udostepnij-znak-krycie').value = String(kryciaZnaku(p?.znak_wodny));
  pokazPodgladZnaku();
}

// Podgląd na żywo: kawałek strony z tekstem akapitu i znakiem wodnym w wybranym kryciu.
function pokazPodgladZnaku() {
  const c = $('#udostepnij-znak-podglad');
  if (!c) return;
  const krycie = Number($('#udostepnij-znak-krycie').value) || KRYCIE_ZNAKU;
  $('#udostepnij-znak-krycie').nextElementSibling.textContent = `${krycie}%`;
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#c9d6e3';
  g.fillRect(20, 20, 140, 140);
  g.fillStyle = '#555555';
  for (let i = 0; i < 7; i += 1) g.fillRect(180, 28 + i * 20, i === 6 ? 160 : 270, 6);
  rysujZnak(g, c.width, c.height, $('#udostepnij-znak-tekst').value.trim() || ZNAK_DOMYSLNY, krycie, Math.round(c.width / 9));
}

function odswiezZnak(p, mozna) {
  $('#udostepnij-znak').hidden = !mozna;
  pokazPolaZnaku();
  $('#udostepnij-znak-stan').textContent = p.znak_wodny
    ? `Strony linku mają znak wodny „${p.znak_wodny.tekst}” (krycie ${kryciaZnaku(p.znak_wodny)}%).`
    : 'Bez znaku wodnego.';
}
const pokazPolaZnaku = () => { const wl = $('#udostepnij-znak-wl').checked; $('#udostepnij-znak-pole').hidden = !wl; $('#udostepnij-znak-krycie-pole').hidden = !wl; if (wl) pokazPodgladZnaku(); };
$('#udostepnij-znak-wl')?.addEventListener('change', pokazPolaZnaku);
$('#udostepnij-znak-krycie')?.addEventListener('input', pokazPodgladZnaku);
$('#udostepnij-znak-tekst')?.addEventListener('input', pokazPodgladZnaku);

// Obraz strony z napisem: ukośne rzędy tekstu na całej powierzchni, półprzezroczyste, z jasną obwódką –
// widoczne na jasnym i ciemnym tle. krycie – w procentach (szary napis; obwódka o 1/4 mocniejsza).
function rysujZnak(g, w, h, tekst, krycie, rozmiarPx = null) {
  const a = Math.max(5, Math.min(50, krycie)) / 100;
  const rozmiar = rozmiarPx ?? Math.max(14, Math.round(Math.min(w, h) / 9));
  g.save();
  g.font = `700 ${rozmiar}px Inter, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const szer = g.measureText(tekst).width + rozmiar * 1.6;
  const krok = rozmiar * 3.2;
  const przekatna = Math.hypot(w, h);
  g.translate(w / 2, h / 2);
  g.rotate(-Math.atan2(h, w));
  g.lineWidth = Math.max(2, rozmiar / 10);
  g.strokeStyle = `rgba(255,255,255,${Math.min(1, a * 1.25).toFixed(3)})`;
  g.fillStyle = `rgba(60,60,60,${a.toFixed(3)})`;
  // Rzędy od środka strony (rząd przez środek zawsze jest) – na małym obrazie jedyny rząd nie wypada poza brzeg.
  const rzedy = Math.ceil(przekatna / 2 / krok);
  const wRzedzie = Math.ceil(przekatna / 2 / szer) + 1;
  for (let r = -rzedy; r <= rzedy; r += 1) {
    const y = r * krok;
    const przes = (Math.abs(r) % 2) * szer / 2;
    for (let i = -wRzedzie; i <= wRzedzie; i += 1) {
      const x = i * szer + przes;
      g.strokeText(tekst, x, y);
      g.fillText(tekst, x, y);
    }
  }
  g.restore();
}

export async function zeZnakiemWodnym(blob, tekst, krycie = KRYCIE_ZNAKU) {
  const obraz = await window.createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = obraz.width; c.height = obraz.height;
  const g = c.getContext('2d');
  g.drawImage(obraz, 0, 0);
  obraz.close?.();
  rysujZnak(g, c.width, c.height, tekst, krycie);
  return new Promise((ok) => { c.toBlob((b) => ok(b || blob), blob.type || 'image/jpeg', 0.85); });
}

// Przycisk „Zapisz znak wodny”: zapis w projekcie; przy istniejącym linku strony rysują się od nowa
// (także z listy projektów – w tle, bez otwierania projektu).
export async function zapiszZnakWodny() {
  const p = celOkna || stan.projekt;
  if (!p) return;
  const komunikat = $('#udostepnij-komunikat');
  komunikat.classList.remove('sukces');
  const wl = $('#udostepnij-znak-wl').checked;
  const nowy = wl ? { tekst: ($('#udostepnij-znak-tekst').value.trim() || ZNAK_DOMYSLNY).slice(0, 40), krycie: kryciaZnaku({ krycie: $('#udostepnij-znak-krycie').value }) } : null;
  if (JSON.stringify(nowy) === JSON.stringify(p.znak_wodny || null)) { komunikat.textContent = 'Bez zmian.'; return; }
  const przycisk = $('#udostepnij-znak-zapisz');
  przycisk.disabled = true;
  trwaPublikacja = true;
  // Zapis od razu (#316): ustawienie jest w projekcie, zanim zaczną się rysować strony linku – zamknięcie karty
  // w trakcie nie gubi zmiany, a link dokończy się sam przy następnym otwarciu.
  const zapiszP = async () => { if (p === stan.projekt) await zapiszTeraz(); else { p.zmieniono = new Date().toISOString(); await zapiszGdziekolwiek(p); } };
  try {
    if (nowy) p.znak_wodny = nowy; else delete p.znak_wodny;
    await zapiszP();
    wypelnijZnak(p);
    if (p.udostepnienie) {
      komunikat.textContent = 'Zapisano. Strony linku przygotowują się w tle – możesz zamknąć to okno, ale nie zamykaj Makietki (pasek postępu na dole).';
      if (p !== stan.projekt) await przygotujDoRysowania(p);
      await linkWTle((pasek) => opublikuj(p, (i, n) => { pasek(i, n); komunikat.textContent = `Zapisano. Strony linku: ${i} z ${n} – możesz zamknąć to okno, nie zamykaj Makietki.`; }));
      await zapiszP();
    }
    komunikat.textContent = nowy ? `Zapisano. Znak wodny „${nowy.tekst}” (krycie ${nowy.krycie}%)${p.udostepnienie ? ' jest już na stronach linku' : ' pojawi się na stronach linku'}.` : 'Zapisano. Strony linku są bez znaku wodnego.';
    komunikat.classList.add('sukces');
    wypelnijZnak(p);
  } catch (e) {
    komunikat.textContent = `Nie udało się zapisać znaku wodnego: ${chmura.komunikatBledu(e)}`;
  } finally {
    trwaPublikacja = false;
    przycisk.disabled = false;
    odswiezOknoUdostepnianiaZachowujacKomunikat();
  }
}

export async function otworzUdostepnianie(projekt = null) {
  // Ten sam projekt co otwarty (np. wczytany drugi raz z listy) – pracujemy na otwartym, żeby nie było dwóch kopii.
  celOkna = projekt && projekt !== stan.projekt && projekt.id !== stan.projekt?.id ? projekt : null;
  if (!celOkna && !stan.projekt) return;
  wypelnijOchrone(celOkna || stan.projekt);
  wypelnijZnak(celOkna || stan.projekt);
  odswiezOknoUdostepniania();
  $('#dlg-udostepnij').showModal();
  // Link sprzed krótkich adresów (#195) dostaje krótki kod przy otwarciu okna.
  const p = celOkna || stan.projekt;
  if (await usunCudzyLink(p)) {
    wypelnijOchrone(p);
    if ($('#dlg-udostepnij').open) odswiezOknoUdostepniania();
    if (document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true });
    return;
  }
  if (p?.udostepnienie && !p.udostepnienie.krotki && await zapewnijKrotki(p, { sprawdz: true })) {
    if (p === stan.projekt) zapiszTeraz().catch(() => {}); else { p.zmieniono = new Date().toISOString(); zapiszGdziekolwiek(p).catch(() => {}); }
    if ($('#dlg-udostepnij').open) odswiezOknoUdostepnianiaZachowujacKomunikat();
  }
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
async function opublikuj(p, postep = () => {}, { pelna = false, naLink = null } = {}) {
  const kod = p.udostepnienie?.kod || nowyKod();
  const ochrona = p.udostepnienie?.ochrona;
  const ciag = rozwin(p);
  const poKluczu = new Map(ciag.egzemplarze.map((e) => [e.klucz, e]));
  const uklad = ukladProjektu(p, ciag);
  // Makieta 3D dla oglądającego (#188): opis bryły i wariantu – bez treści stron (tekstury to obrazy linku).
  try { uklad.makieta = opisMakiety(p, ciag); } catch { /* bez makiety – link działa jak dawniej */ }
  const strony = stronyUkladu(uklad);
  const odciski = Object.fromEntries(strony.map((s) => [s.id, odciskStrony(p, poKluczu.get(s.id), ciag)]));
  // WebP: ten sam wygląd przy ok. 30–40% mniejszych plikach (mniej transferu dla oglądających, #90).
  // Przeglądarka, która nie umie zapisać WebP (oddaje PNG), wysyła JPEG jak dawniej.
  const rozszerzenie = umieWebp() ? 'webp' : 'jpg';
  const obraz = async (s) => {
    const url = await renderujCel(p, poKluczu.get(s.id), { szerokoscPx: 1200, spad: false, ciag, ...(rozszerzenie === 'webp' ? { format: 'webp', jakosc: 0.8 } : { format: 'jpeg' }) });
    const blob = await (await fetch(url)).blob();
    return p.znak_wodny ? zeZnakiemWodnym(blob, p.znak_wodny.tekst, kryciaZnaku(p.znak_wodny)) : blob;
  };
  const odcisk = odciskTresci(p);
  // Link działa od razu (#204): po zapisaniu wstępnego opisu projekt dostaje dane linku i krótki adres,
  // a strony dalej rysują się i wysyłają w tle.
  const linkGotowy = naLink && (async ({ konto }) => {
    p.udostepnienie = { ...(p.udostepnienie?.kod === kod ? p.udostepnienie : {}), kod, konto, zaktualizowano: new Date().toISOString(), ...(ochrona ? { ochrona } : {}) };
    await zapewnijKrotki(p);
    await naLink(p);
  });
  const wynik = ochrona
    ? await chmura.opublikujPodgladChroniony(p.id, kod, uklad, strony, obraz, postep, odciski, { pelna, rozszerzenie, naLink: linkGotowy })
    : await chmura.opublikujPodglad(p.id, kod, uklad, strony, obraz, postep, pelna ? null : odciski, { rozszerzenie, naLink: linkGotowy });
  const krotki = p.udostepnienie?.kod === kod ? p.udostepnienie.krotki : null;
  p.udostepnienie = { kod, konto: wynik.konto, zaktualizowano: wynik.zaktualizowano, odcisk, ...(ochrona ? { ochrona } : {}), ...(krotki ? { krotki } : {}) };
  await zapewnijKrotki(p);
  return wynik;
}

// Krótki kod linku (#195): przy pierwszej publikacji i dla linków sprzed tej zmiany (przy otwarciu okna).
// Bez sieci albo przy błędzie link zostaje długi – i tak działa.
async function zapewnijKrotki(p, { sprawdz = false } = {}) {
  const u = p.udostepnienie;
  if (!u?.kod || u.krotki || !stan.uzytkownik) return false;
  // Link sprzed krótkich adresów: krótki kod tylko wtedy, gdy podgląd naprawdę działa pod numerem tego projektu
  // (dawna kopia z linkiem oryginału go nie dostanie – jej link nigdy nie działał).
  if (sprawdz && (await chmura.linkDzialaDlaProjektu(u.konto, p.id, u.kod)) !== true) return false;
  try { u.krotki = await chmura.krotkiLink(p.id, u.kod); return Boolean(u.krotki); } catch { return false; }
}

// Link skopiowany z innego projektu (#198: „Duplikuj” kopiował dane linku oryginału). Za cudzy uznajemy link
// tylko wtedy, gdy jego krótki kod wprost prowadzi do innego projektu (#201: dawne sprawdzanie plików na koncie
// mogło uznać własny link za cudzy i kasowało go przy każdym otwarciu). Przy błędzie sieci nic nie ruszamy.
async function usunCudzyLink(p) {
  const u = p?.udostepnienie;
  if (!u?.kod || !u.krotki || !stan.uzytkownik) return false;
  let cudzy = false;
  try { const k = await chmura.rozwinKrotkiLink(u.krotki); cudzy = Boolean(k && k.projekt !== p.id); } catch { return false; }
  if (!cudzy || p.udostepnienie !== u) return false;
  delete p.udostepnienie;
  if (p === stan.projekt) await zapiszTeraz().catch(() => {}); else { p.zmieniono = new Date().toISOString(); await zapiszGdziekolwiek(p).catch(() => {}); }
  return true;
}

// Projekt otwarty w edytorze, link bez krótkiego adresu (sprzed #195): krótki kod dochodzi sam, w tle – długi
// adres działa dalej. Zapis projektu niesie kod na konto i na inne urządzenia.
export async function uzupelnijKrotkiLink() {
  const p = stan.projekt;
  if (!p?.udostepnienie || !navigator.onLine) return;
  if (await usunCudzyLink(p)) return;
  if (p.udostepnienie.krotki) return;
  if (await zapewnijKrotki(p, { sprawdz: true }) && stan.projekt === p) zapiszTeraz().catch(() => {});
}

// Przycisk „Utwórz link” albo „Aktualizuj teraz”.
// Z listy projektów (#196) – projekt nie jest otwarty: strony rysują się w tle (przygotujDoRysowania),
// zapis idzie do tej kopii projektu.
export async function opublikujUdostepnienie() {
  const p = celOkna || stan.projekt;
  const otwarty = p === stan.projekt;
  const zapisz = () => (otwarty ? zapiszTeraz() : (p.zmieniono = new Date().toISOString(), zapiszGdziekolwiek(p)));
  const komunikat = $('#udostepnij-komunikat');
  komunikat.classList.remove('sukces');
  for (const b of [$('#udostepnij-utworz'), $('#udostepnij-teraz')]) b.disabled = true;
  trwaPublikacja = true;
  try {
    if (otwarty) await zapiszTeraz(); else await przygotujDoRysowania(p);
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
    komunikat.textContent = 'Przygotowuję link…';
    const pasek = pasekPostepu('Udostępnianie: strony podglądu – nie zamykaj Makietki', { opoznienie: 0 });
    pilnujZamkniecia(true);
    let wynik;
    let linkJest = Boolean(p.udostepnienie);
    const opisPostepu = (i, n) => (linkJest
      ? `Link gotowy – możesz go już skopiować i wysłać albo zamknąć okno. Strony przygotowują się w tle: ${i} z ${n}.`
      : `Strony: ${i} z ${n}…`);
    try {
      wynik = await opublikuj(p, (i, n) => { if (komunikat.isConnected) komunikat.textContent = opisPostepu(i, n); pasek.krok(i, n); }, {
        naLink: async () => {
          linkJest = true;
          odswiezOknoUdostepnianiaZachowujacKomunikat();
          komunikat.textContent = 'Link gotowy – możesz go już skopiować i wysłać albo zamknąć okno. Strony przygotowują się w tle; oglądający zobaczy je po kolei.';
          for (const b of [$('#udostepnij-utworz'), $('#udostepnij-teraz')]) b.disabled = true;
        },
      });
    } finally { pasek.koniec(); pilnujZamkniecia(false); }
    komunikat.textContent = wynik.wyslane < wynik.wszystkie
      ? `Gotowe. Wysłano ${wynik.wyslane} z ${wynik.wszystkie} stron – reszta się nie zmieniła.`
      : 'Gotowe. Skopiuj link i wyślij go, komu chcesz. Od teraz będzie się aktualizował sam.';
    komunikat.classList.add('sukces');
    wypelnijOchrone(p);
    odswiezOknoUdostepnianiaZachowujacKomunikat(); // link od razu w oknie, zapis – zaraz potem
    await zapisz();
    if (!otwarty && document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true }); // plakietka „Udostępniony”
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
      await linkWTle((pasek) => opublikuj(p, pasek));
      await zapiszTeraz();
    } catch { /* spróbujemy przy następnym zapisie */ } finally {
      trwaPublikacja = false;
      if ($('#dlg-udostepnij').open) odswiezOknoUdostepniania();
    }
  }, opoznienie);
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
    if (p.udostepnienie.krotki) await chmura.usunKrotkiLink(p.id).catch(() => {});
    delete p.udostepnienie;
    if (p === stan.projekt) await zapiszTeraz(); else { p.zmieniono = new Date().toISOString(); await zapiszGdziekolwiek(p); }
    odswiezOknoUdostepniania();
    $('#udostepnij-komunikat').textContent = 'Link unieważniony.';
    if (document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true });
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
