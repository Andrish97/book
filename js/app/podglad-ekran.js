// Ekran podglądu bez edycji i udostępnianie podglądu linkiem.

import { modeleProjektu, domyslnyModel, bazaMakiety } from '../makieta-opis.js';
import { MODELE } from '../makieta-3d.js';
import { POLA_LINKU, widokLinku, skrot, odciskTresci, odciskStrony, pamiecOdciskowDla, skrotCzesci, ZNAK_DOMYSLNY, KRYCIE_ZNAKU, kryciaZnaku, rysujZnak, zeZnakiemWodnym, przygotujPublikacje } from '../publikacja-linku.js';
import { postep as pasekPostepu } from '../postep.js';
import * as chmura from '../chmura.js';
import { $, kiedy, potwierdz, powiadom } from '../ui.js';
import { NAZWA } from '../marka.js';
import { stan, pokazEkran, trasa, edytor, biezacaStrona } from './kontekst.js';
import { zapiszTeraz, pokazEdytor, plotnoOdlozone, przygotujDoRysowania } from './zapis.js';
import { podglad } from './skladniki.js';
import { przejdzDoStrony } from './lista-stron.js';
import { zapiszGdziekolwiek, pokazProjekty, wpisyProjektow, wczytajProjektZWpisu } from './projekty.js';
import { t, jezykDat } from '../jezyk.js';
import { zDzierzawa, mozeSam, potwierdzAktualne, SPOKOJ_PO_ZMIANIE_MS } from './prace-w-tle.js';
import { wstawIkony } from '../ikony.js';

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
  document.title = t('podgladEkran.podglad', { nazwa: stan.projekt.nazwa, NAZWA });
  podglad.pokazProjekt(stan.projekt, biezaca, nrStrony, odciskPodgladu);
  $('#podglad-tresc').focus({ preventScroll: true });
}

// Otwarty podgląd po zmianie projektu z innego urządzenia albo od AI (js/app/zapis.js: polaczZKontem).
// Podgląd zostaje w tym samym miejscu, a przerysowują się tylko strony, które wyglądają inaczej.
export function odswiezPodglad() {
  if (!stan.projekt || document.body.dataset.ekran !== 'podglad' || document.body.classList.contains('podglad-publiczny')) return;
  document.title = t('podgladEkran.podglad', { nazwa: stan.projekt.nazwa, NAZWA });
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

// Skrót strony podglądu: to samo co przy linku, a do tego style tekstu i tekst płynący z innych stron
// (ramki tego samego wątku) – zmiana gdziekolwiek w wątku może przesunąć tekst na tej stronie.
function odciskPodgladu(egz, ciag) {
  const p = stan.projekt;
  const pam = pamiecOdciskowDla(p, ciag);
  const watki = new Set(egz.strona.obiekty.map((o) => o.watek).filter(Boolean));
  // Tekst wątku: obiekty ramek tych wątków ze wszystkich stron – skrót raz na zestaw wątków (#343).
  let watek = null;
  if (watki.size) {
    const kl = [...watki].sort().join('|');
    pam.watki ||= new Map();
    if (!pam.watki.has(kl)) pam.watki.set(kl, skrot(JSON.stringify(p.strony.flatMap((s) => s.obiekty.filter((o) => watki.has(o.watek))))));
    watek = pam.watki.get(kl);
  }
  return skrot(JSON.stringify([odciskStrony(p, egz, ciag), skrotCzesci(pam, p.style), watek]));
}

// ---------- Kilka linków podglądu (#426) ----------
// projekt.udostepnienia = [{ id, nazwa, kod, konto, krotki, ochrona, odcisk, zaktualizowano, znak_wodny, makieta_linku }]
// – każdy link ma własne pliki (kod), hasło i datę ważności, znak wodny i makietę 3D. Publikacja i ochrona działają
// na „widoku” projektu dla jednego linku: kopii projektu z udostepnienie, znak_wodny i makieta_linku tego linku –
// rysowanie (także na serwerze), odciski i opis makiety biorą ustawienia z niego, bez zmian w tych modułach.
export const linkiProjektu = (p) => (Array.isArray(p?.udostepnienia) ? p.udostepnienia : []);
function przepiszLink(L, w) {
  for (const k of POLA_LINKU) { const v = w.udostepnienie?.[k]; if (v === undefined) delete L[k]; else L[k] = v; }
}
// Praca na widoku jednego linku; dane linku (kod, krótki adres, ochrona, odcisk…) wracają do niego także wtedy,
// gdy praca przerwie się w połowie.
async function naLinku(p, L, praca) {
  const w = widokLinku(p, L);
  try { return await praca(w); } finally { przepiszLink(L, w); }
}
const nowyIdLinku = () => `ln_${[...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(36)).join('')}`;
const nazwaLinku = (p, L) => L?.nazwa || t('podgladEkran.linkNr', { n: linkiProjektu(p).indexOf(L) + 1 });
// Odcisk treści widoku linku – raz na stan projektu (p.zmieniono) i ustawienia linku: wcześniej liczony od nowa
// przy każdym zapisie dla każdego linku, a na telefonie przy dużym projekcie to ułamki sekundy zacięcia (26.11).
const pamiecOdciskuLinku = new WeakMap(); // projekt → Map(klucz → odcisk)
function odciskLinku(p, L) {
  const klucz = p.zmieniono ? `${p.zmieniono}|${JSON.stringify([L.znak_wodny || null, L.makieta_linku || null])}` : null;
  let m = pamiecOdciskuLinku.get(p);
  if (klucz && m?.has(klucz)) return m.get(klucz);
  const o = odciskTresci(widokLinku(p, L));
  if (klucz) {
    if (!m || m.zmieniono !== p.zmieniono) { m = new Map(); m.zmieniono = p.zmieniono; pamiecOdciskuLinku.set(p, m); }
    m.set(klucz, o);
  }
  return o;
}
const linkAktualny = (p, L) => L.odcisk === odciskLinku(p, L);
const zapiszProjektLinku = async (p) => { if (p === stan.projekt) await zapiszTeraz(); else { p.zmieniono = new Date().toISOString(); await zapiszGdziekolwiek(p); } };

function linkUdostepnienia(p, L) {
  if (L.krotki) return `${location.origin}/${L.krotki}`; // krótki link (#195)
  return `${location.origin}${location.pathname}#/u/${L.konto}/${p.id}/${L.kod}`;
}

// Projekt, którego dotyczy otwarte okno: zwykle otwarty w edytorze, a po kliknięciu plakietki
// na liście projektów – wczytany tylko po to, żeby pokazać link albo go unieważnić.
let celOkna = null;
// Link, którego ustawienia są w oknie; null – nowy link (jeszcze nieutworzony).
let wybrany = null;
let trwaPublikacja = false;

// Lista linków projektu – jak lista kluczy AI: nazwa, adres, ochrona i znak wodny; kliknięcie wybiera link do
// ustawień, „Kopiuj” kopiuje jego adres, „+ Nowy link” – ustawienia nowego.
function rysujListeLinkow(p) {
  const lista = $('#udostepnij-linki');
  if (!lista) return;
  const linki = linkiProjektu(p);
  lista.hidden = !linki.length;
  lista.replaceChildren(...linki.map((L) => {
    const li = document.createElement('li');
    li.className = L === wybrany ? 'wybrany' : '';
    const opis = [L.ochrona?.haslo ? t('podgladEkran.zHaslem') : null, L.ochrona?.wazny_do ? t('podgladEkran.waznyDoKrotko', { data: dataSlownie(L.ochrona.wazny_do) }) : null,
      L.znak_wodny ? t('podgladEkran.zeZnakiemWodnymKrotko', { tekst: L.znak_wodny.tekst }) : null, L.makieta_linku?.pokaz === false ? t('podgladEkran.bezMakiety3d') : null].filter(Boolean);
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'link-wybor' });
    const nazwa = Object.assign(document.createElement('strong'), { textContent: nazwaLinku(p, L) });
    const adres = Object.assign(document.createElement('span'), { className: 'ciche', textContent: L.kod ? linkUdostepnienia(p, L).replace(/^https?:\/\//, '') : t('podgladEkran.linkPrzygotowujeSie') });
    const cechy = Object.assign(document.createElement('span'), { className: 'ciche', textContent: opis.length ? opis.join(' · ') : t('podgladEkran.bezOchronyKrotko') });
    b.append(nazwa, adres, cechy);
    b.addEventListener('click', () => { wybrany = L; wypelnijUstawieniaLinku(p); odswiezOknoUdostepniania(); });
    li.append(b);
    if (L.kod) {
      const k = Object.assign(document.createElement('button'), { type: 'button', className: 'przycisk-ikona', title: t('podgladEkran.kopiujLinkTytul'), ariaLabel: t('podgladEkran.kopiujLinkTytul') });
      k.dataset.ikona = 'kopiuj';
      k.addEventListener('click', () => kopiujTekst(linkUdostepnienia(p, L)));
      li.append(k);
    }
    return li;
  }), (() => {
    const li = document.createElement('li');
    li.className = wybrany === null ? 'wybrany nowy' : 'nowy';
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'link-wybor', textContent: t('podgladEkran.nowyLinkPlus') });
    b.addEventListener('click', () => { wybrany = null; wypelnijUstawieniaLinku(p); odswiezOknoUdostepniania(); });
    li.append(b);
    return li;
  })());
  wstawIkony(lista);
}
// Pola okna według wybranego linku (albo domyślne dla nowego).
function wypelnijUstawieniaLinku(p) {
  wypelnijOchrone(wybrany);
  wypelnijZnak(wybrany);
  wypelnijMakieteLinku(p, wybrany);
  $('#udostepnij-nazwa').value = wybrany?.nazwa || '';
  $('#udostepnij-nazwa').placeholder = wybrany ? nazwaLinku(p, wybrany) : t('podgladEkran.linkNr', { n: linkiProjektu(p).length + 1 });
}

function odswiezOknoUdostepniania() {
  const p = celOkna || stan.projekt;
  if (!p) return;
  if (wybrany && !linkiProjektu(p).includes(wybrany)) wybrany = linkiProjektu(p)[0] || null;
  const L = wybrany;
  const u = L?.kod ? L : null;
  const zKontem = Boolean(stan.uzytkownik);
  rysujListeLinkow(p);
  $('#udostepnij-link-blok').hidden = !u;
  $('#udostepnij-wylacz').hidden = !L;
  // Z listy projektów też (#196): utworzenie linku i „Aktualizuj teraz” rysują strony w tle.
  $('#udostepnij-utworz').hidden = !zKontem || Boolean(L);
  $('#udostepnij-teraz').hidden = !zKontem || !u;
  $('#udostepnij-nazwa-pole').hidden = !zKontem;
  $('#udostepnij-nazwa-zapisz').hidden = !L;
  $('#udostepnij-komunikat').textContent = zKontem ? '' : t('podgladEkran.udostepnianieWymagaZalogowania');
  $('#udostepnij-komunikat').classList.remove('sukces');
  odswiezOchrone(p, zKontem); // z listy projektów: ochronę też ustawisz i zmienisz (#190, #196)
  odswiezZnak(p, zKontem);
  odswiezMakieteLinku(p, zKontem);
  if (!u) return;
  $('#udostepnij-link').value = linkUdostepnienia(p, L);
  $('#udostepnij-stan').textContent = trwaPublikacja
    ? t('podgladEkran.aktualizujeLink')
    : (linkAktualny(p, L)
      ? t('podgladEkran.linkPokazujeAktualnyStan', { kiedy: kiedy(u.zaktualizowano) })
      : t('podgladEkran.projektZmienilSiePo', { kiedy: kiedy(u.zaktualizowano) }));
}

// ---------- Ochrona linku: hasło i data ważności ----------

const dzienZIso = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Link jest ważny do końca wybranego dnia (czasu urządzenia, na którym go ustawiono).
const isoZDnia = (dzien) => (dzien ? new Date(`${dzien}T23:59:59.999`).toISOString() : null);
const dataSlownie = (iso) => new Date(iso).toLocaleDateString(jezykDat(), { day: 'numeric', month: 'long', year: 'numeric' });

function opisOchrony(ochrona) {
  if (!ochrona) return 'Link bez ochrony – podgląd zobaczy każdy, kto dostanie link.';
  const czesci = [];
  if (ochrona.haslo) czesci.push('chroniony hasłem');
  if (ochrona.wazny_do) czesci.push(`${new Date(ochrona.wazny_do) < new Date() ? 'wygasł' : 'ważny do'} ${dataSlownie(ochrona.wazny_do)}`);
  return t('podgladEkran.link', { join: czesci.join(', ') });
}

function odswiezPolaOchrony() {
  const u = wybrany;
  $('#udostepnij-haslo-pole').hidden = !$('#udostepnij-haslo-wl').checked;
  $('#udostepnij-termin-pole').hidden = !$('#udostepnij-termin-wl').checked;
  $('#udostepnij-haslo').placeholder = u?.ochrona?.haslo ? t('podgladEkran.bezZmianWpiszNowe') : t('podgladEkran.coNajmniej4Znaki');
}

// Pola ochrony według zapisanych ustawień linku – przy otwarciu okna i po udanym zapisie
// (nie przy każdym odświeżeniu, żeby nie kasować tego, co ktoś właśnie zaznacza).
function wypelnijOchrone(L) {
  const o = L?.ochrona;
  $('#udostepnij-haslo-wl').checked = Boolean(o?.haslo);
  $('#udostepnij-haslo').value = '';
  $('#udostepnij-termin-wl').checked = Boolean(o?.wazny_do);
  $('#udostepnij-termin').value = dzienZIso(o?.wazny_do);
}

function odswiezOchrone(p, mozna) {
  $('#udostepnij-ochrona').hidden = !mozna;
  $('#udostepnij-ochrona-stan').textContent = wybrany?.kod ? opisOchrony(wybrany.ochrona) : t('podgladEkran.ustawieniaZadzialajaOdRazu');
  $('#udostepnij-ochrona-zapisz').hidden = !wybrany?.kod;
  odswiezPolaOchrony();
}

// Ochrona wybrana w oknie: { chroniony, zmienHaslo, haslo, waznyDo } albo { blad }.
function ochronaZOkna(L) {
  const o = L?.ochrona;
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
let aktywnyPasek = null; // pasek linku w tle – rysowanie na serwerze zmienia jego opis (#335)
let rysujeNaSerwerze = false; // bieżące strony linku rysuje serwer – Makietkę można zamknąć (#427)
async function linkWTle(praca) {
  const pasek = pasekPostepu('Aktualizuję podgląd z linku – nie zamykaj Makietki', { opoznienie: 0 });
  pilnujZamkniecia(true);
  let pilnuje = true;
  const ten = { pasek, zwolnij: () => { if (pilnuje) { pilnuje = false; pilnujZamkniecia(false); } } };
  aktywnyPasek = ten;
  rysujeNaSerwerze = false;
  try { return await praca((i, n) => pasek.krok(i, n)); } finally { pasek.koniec(); ten.zwolnij(); if (aktywnyPasek === ten) aktywnyPasek = null; }
}
// Rysowanie przejął serwer: Makietkę można zamknąć – link dokończy się sam.
function rysujeSerwer() {
  rysujeNaSerwerze = true;
  const k = $('#udostepnij-komunikat');
  if (k && $('#dlg-udostepnij')?.open && trwaPublikacja) k.textContent = t('podgladEkran.podgladZLinkuRysuje');
  if (!aktywnyPasek) return;
  aktywnyPasek.pasek.opis(t('podgladEkran.podgladZLinkuRysuje'));
  aktywnyPasek.zwolnij();
}
export const trwaAktualizacjaLinku = () => trwajace > 0;

// Czy zmiana ochrony wymaga narysowania stron od nowa: przejście między linkiem publicznym a chronionym
// albo zmiana / zdjęcie hasła (nowy folder z sekretem). Sama data ważności – nie.
const ochronaRysuje = (u, w) => Boolean(w.chroniony) !== Boolean(u.ochrona) || (w.chroniony && w.zmienHaslo && (Boolean(w.haslo) || Boolean(u.ochrona?.haslo)));

// Przycisk „Zapisz ochronę”. Z listy projektów (#190): zmiana samej daty od razu; zmiana wymagająca stron
// (hasło, włączenie albo zdjęcie ochrony) rysuje je w tle, bez otwierania projektu.
export async function zapiszOchroneLinku() {
  const p = celOkna || stan.projekt;
  const L = wybrany;
  const komunikat = $('#udostepnij-komunikat');
  komunikat.classList.remove('sukces');
  if (!p || !L?.kod) return;
  const w = ochronaZOkna(L);
  if (w.blad) { komunikat.textContent = w.blad; return; }
  if (!w.chroniony && !L.ochrona) { komunikat.textContent = t('podgladEkran.linkJestBezOchrony'); return; }
  const przycisk = $('#udostepnij-ochrona-zapisz');
  przycisk.disabled = true;
  trwaPublikacja = true;
  try {
    if (p !== stan.projekt && ochronaRysuje(L, w)) {
      komunikat.textContent = t('podgladEkran.przygotowujeStronyLinku');
      await przygotujDoRysowania(p);
    }
    komunikat.textContent = t('podgladEkran.zapisujeOchroneLinku');
    await linkWTle((pasek) => naLinku(p, L, (W) => zastosujOchrone(W, w, (i, n) => { pasek(i, n); komunikat.textContent = t('podgladEkran.przenoszeStronyZMozesz', { i, n }); })));
    await zapiszProjektLinku(p);
    komunikat.textContent = t('podgladEkran.zapisano', { opisOchrony: opisOchrony(L.ochrona) });
    komunikat.classList.add('sukces');
    wypelnijOchrone(L);
  } catch (e) {
    komunikat.textContent = t('podgladEkran.nieUdaloSieZapisac', { komunikatBledu: chmura.komunikatBledu(e) });
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
export { ZNAK_DOMYSLNY, KRYCIE_ZNAKU, kryciaZnaku, zeZnakiemWodnym };

function wypelnijZnak(L) {
  $('#udostepnij-znak-wl').checked = Boolean(L?.znak_wodny);
  $('#udostepnij-znak-tekst').value = L?.znak_wodny?.tekst || '';
  $('#udostepnij-znak-krycie').value = String(kryciaZnaku(L?.znak_wodny));
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
  $('#udostepnij-znak-zapisz').hidden = !wybrany?.kod; // nowy link: znak z pól zapisze się przy „Utwórz link”
  pokazPolaZnaku();
  $('#udostepnij-znak-stan').textContent = !wybrany ? t('podgladEkran.ustawieniaZadzialajaOdRazu') : wybrany.znak_wodny
    ? t('podgladEkran.stronyLinkuMajaZnak', { tekst: wybrany.znak_wodny.tekst, kryciaZnaku: kryciaZnaku(wybrany.znak_wodny) })
    : t('podgladEkran.bezZnakuWodnego');
}
// Znak wodny z pól okna (null – bez znaku).
const znakZOkna = () => ($('#udostepnij-znak-wl').checked ? { tekst: ($('#udostepnij-znak-tekst').value.trim() || ZNAK_DOMYSLNY).slice(0, 40), krycie: kryciaZnaku({ krycie: $('#udostepnij-znak-krycie').value }) } : null);
const pokazPolaZnaku = () => { const wl = $('#udostepnij-znak-wl').checked; $('#udostepnij-znak-pole').hidden = !wl; $('#udostepnij-znak-krycie-pole').hidden = !wl; if (wl) pokazPodgladZnaku(); };
$('#udostepnij-znak-wl')?.addEventListener('change', pokazPolaZnaku);
$('#udostepnij-znak-krycie')?.addEventListener('input', pokazPodgladZnaku);
$('#udostepnij-znak-tekst')?.addEventListener('input', pokazPodgladZnaku);

// Przycisk „Zapisz znak wodny”: zapis w projekcie; przy istniejącym linku strony rysują się od nowa
// (także z listy projektów – w tle, bez otwierania projektu).
export async function zapiszZnakWodny() {
  const p = celOkna || stan.projekt;
  const L = wybrany;
  if (!p || !L) return;
  const komunikat = $('#udostepnij-komunikat');
  komunikat.classList.remove('sukces');
  const nowy = znakZOkna();
  if (JSON.stringify(nowy) === JSON.stringify(L.znak_wodny || null)) { komunikat.textContent = t('podgladEkran.bezZmian'); return; }
  const przycisk = $('#udostepnij-znak-zapisz');
  przycisk.disabled = true;
  trwaPublikacja = true;
  // Zapis od razu (#316): ustawienie jest w projekcie, zanim zaczną się rysować strony linku – zamknięcie karty
  // w trakcie nie gubi zmiany, a link dokończy się sam przy następnym otwarciu.
  const zapiszP = () => zapiszProjektLinku(p);
  try {
    if (nowy) L.znak_wodny = nowy; else delete L.znak_wodny;
    await zapiszP();
    wypelnijZnak(L);
    odswiezZnak(p, true); // stan ustawienia widać od razu, nie dopiero po narysowaniu stron
    if (L.kod) {
      komunikat.textContent = t('podgladEkran.zapisanoStronyLinkuPrzygotowuja');
      if (p !== stan.projekt) await przygotujDoRysowania(p);
      await linkWTle((pasek) => naLinku(p, L, (W) => opublikuj(W, (i, n) => { pasek(i, n); komunikat.textContent = t('podgladEkran.zapisanoStronyLinkuZ', { i, n }); })));
      await zapiszP();
    }
    komunikat.textContent = nowy ? t('podgladEkran.zapisanoZnakWodnyKrycie', { tekst: nowy.tekst, krycie: nowy.krycie, x: L.kod ? t('podgladEkran.jestJuzNaStronach') : t('podgladEkran.pojawiSieNaStronach') }) : t('podgladEkran.zapisanoStronyLinkuSa');
    komunikat.classList.add('sukces');
    wypelnijZnak(L);
  } catch (e) {
    komunikat.textContent = t('podgladEkran.nieUdaloSieZapisac2', { komunikatBledu: chmura.komunikatBledu(e) });
  } finally {
    trwaPublikacja = false;
    przycisk.disabled = false;
    odswiezOknoUdostepnianiaZachowujacKomunikat();
  }
}

// ---------- Makieta 3D w linku (#325) ----------
// projekt.makieta_linku = { pokaz: false } – bez makiety; { model } – rodzaj; { ujecie } – id zapisanego ujęcia
// (rodzaj, kamera, światło i tło z ujęcia). Bez pola – rodzaj dobrany do projektu, pierwsze zapisane ujęcie.
function wypelnijMakieteLinku(p, L) {
  if (!p) return;
  const ml = L?.makieta_linku || {};
  $('#udostepnij-makieta-wl').checked = ml.pokaz !== false;
  let modele = []; let inne = [];
  try { ({ modele, inne = [] } = modeleProjektu(p)); } catch { modele = []; }
  let dm = null;
  try { const b = bazaMakiety(p); dm = domyslnyModel(p, b.strony.length, b.okladka); } catch { dm = null; }
  const wybor = $('#udostepnij-makieta-model');
  wybor.replaceChildren(new Option(t('podgladEkran.jakWMakiecieProjektu', { x: dm && MODELE[dm] ? ` (${MODELE[dm]})` : '' }), ''), ...modele.map((m) => new Option(MODELE[m] || m, m)));
  if (inne.length) { const g = document.createElement('optgroup'); g.label = 'Nie pasuje do projektu'; g.append(...inne.map((m) => new Option(MODELE[m] || m, m))); wybor.append(g); }
  wybor.value = ml.model && [...modele, ...inne].includes(ml.model) ? ml.model : '';
  const uj = $('#udostepnij-makieta-ujecie');
  const ujecia = p.makieta?.ujecia || [];
  uj.replaceChildren(new Option(ujecia.length ? t('podgladEkran.pierwszeZapisane', { x: ujecia[0].nazwa || t('podgladEkran.ujecie') }) : 'Domyślne', ''), ...ujecia.map((u) => new Option(u.nazwa || 'Ujęcie', u.id)));
  uj.value = ml.ujecie && ujecia.some((u) => u.id === ml.ujecie) ? ml.ujecie : '';
  pokazPolaMakiety();
}
const pokazPolaMakiety = () => { $('#udostepnij-makieta-pola').hidden = !$('#udostepnij-makieta-wl').checked; };
$('#udostepnij-makieta-wl')?.addEventListener('change', pokazPolaMakiety);
function opisMakietyLinku(p, L) {
  const ml = L?.makieta_linku || {};
  if (ml.pokaz === false) return 'Oglądający nie widzi makiety 3D – tylko strony.';
  const uj = ml.ujecie && p.makieta?.ujecia?.find((u) => u.id === ml.ujecie);
  if (uj) return t('podgladEkran.ogladajacyWidziMakiete3d', { x: uj.nazwa || t('podgladEkran.ujecie') });
  if (ml.model) return t('podgladEkran.ogladajacyWidziMakiete3d2', { x: MODELE[ml.model] || ml.model });
  return 'Oglądający widzi makietę 3D taką jak w makiecie projektu (rodzaj dobrany do projektu, pierwsze zapisane ujęcie).';
}
function odswiezMakieteLinku(p, mozna) {
  $('#udostepnij-makieta').hidden = !mozna;
  $('#udostepnij-makieta-zapisz').hidden = !wybrany?.kod; // nowy link: ustawienie z pól zapisze się przy „Utwórz link”
  pokazPolaMakiety();
  $('#udostepnij-makieta-stan').textContent = wybrany ? opisMakietyLinku(p, wybrany) : t('podgladEkran.ustawieniaZadzialajaOdRazu');
}
// Makieta 3D w linku z pól okna (null – jak w makiecie projektu).
function makietaZOkna() {
  const model = $('#udostepnij-makieta-model').value;
  const ujecie = $('#udostepnij-makieta-ujecie').value;
  const nowy = !$('#udostepnij-makieta-wl').checked ? { pokaz: false } : { ...(model ? { model } : {}), ...(ujecie ? { ujecie } : {}) };
  return Object.keys(nowy).length ? nowy : null;
}
// „Zapisz makietę w linku”: zapis w projekcie; istniejący link aktualizuje się w tle (opis makiety w manifeście).
export async function zapiszMakieteLinku() {
  const p = celOkna || stan.projekt;
  const L = wybrany;
  if (!p || !L) return;
  const komunikat = $('#udostepnij-komunikat');
  komunikat.classList.remove('sukces');
  const nowy = makietaZOkna();
  if (JSON.stringify(nowy) === JSON.stringify(L.makieta_linku || null)) { komunikat.textContent = t('podgladEkran.bezZmian'); return; }
  const przycisk = $('#udostepnij-makieta-zapisz');
  przycisk.disabled = true;
  trwaPublikacja = true;
  const zapiszP = () => zapiszProjektLinku(p);
  try {
    if (!nowy) delete L.makieta_linku; else L.makieta_linku = nowy;
    await zapiszP();
    odswiezMakieteLinku(p, true);
    if (L.kod) {
      komunikat.textContent = t('podgladEkran.zapisanoLinkAktualizujeSie');
      if (p !== stan.projekt) await przygotujDoRysowania(p);
      await linkWTle((pasek) => naLinku(p, L, (W) => opublikuj(W, (i, n) => { pasek(i, n); })));
      await zapiszP();
    }
    komunikat.textContent = t('podgladEkran.zapisano2', { opisMakietyLinku: opisMakietyLinku(p, L) });
    komunikat.classList.add('sukces');
  } catch (e) {
    komunikat.textContent = t('podgladEkran.nieUdaloSieZapisac3', { komunikatBledu: chmura.komunikatBledu(e) });
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
  const p = celOkna || stan.projekt;
  wybrany = linkiProjektu(p)[0] || null; // pierwszy link; bez linków – ustawienia nowego
  wypelnijUstawieniaLinku(p);
  odswiezOknoUdostepniania();
  $('#dlg-udostepnij').showModal();
  // Linki sprzed krótkich adresów (#195) dostają krótki kod przy otwarciu okna; skopiowane z innego projektu znikają.
  if (await usunCudzeLinki(p)) {
    wypelnijUstawieniaLinku(p);
    if ($('#dlg-udostepnij').open) odswiezOknoUdostepniania();
    if (document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true });
    return;
  }
  let nowe = await odzyskajLinki(p);
  for (const L of linkiProjektu(p)) if (L.kod && !L.krotki && await naLinku(p, L, (W) => zapewnijKrotki(W, { sprawdz: true }))) nowe = true;
  if (nowe) {
    zapiszProjektLinku(p).catch(() => {});
    if ($('#dlg-udostepnij').open) { if (!wybrany) { wybrany = linkiProjektu(p)[0] || null; wypelnijUstawieniaLinku(p); } odswiezOknoUdostepnianiaZachowujacKomunikat(); }
  }
}

// Linki, które działają (są w bazie), a nie ma ich na liście projektu (#428) – np. Makietkę zamknięto, zanim projekt
// zapisał się z nowym linkiem. Wracają na listę jako „Odzyskany link” (z ochroną z bazy; znak wodny i makietę 3D
// ustawisz od nowa). Bez sieci albo przy błędzie – nic.
async function odzyskajLinki(p) {
  if (!stan.uzytkownik || !navigator.onLine || !p?.id) return false;
  let wBazie = [];
  try { wBazie = await chmura.linkiProjektuWBazie(p.id); } catch { return false; }
  const znane = new Set(linkiProjektu(p).map((L) => L.kod));
  const brakujace = wBazie.filter((x) => x?.kod && !znane.has(x.kod));
  if (!brakujace.length) return false;
  p.udostepnienia = [...linkiProjektu(p), ...brakujace.map((x) => ({
    id: nowyIdLinku(), nazwa: t('podgladEkran.linkOdzyskany'), kod: x.kod, konto: x.konto, krotki: x.krotki,
    ...(x.chroniony ? { ochrona: { haslo: Boolean(x.haslo), wazny_do: x.wazny_do || null } } : {}),
  }))];
  return true;
}

// Nazwa linku (#426) – widać ją na liście linków.
export async function zapiszNazweLinku() {
  const p = celOkna || stan.projekt;
  if (!p || !wybrany) return;
  wybrany.nazwa = $('#udostepnij-nazwa').value.trim().slice(0, 60);
  await zapiszProjektLinku(p);
  odswiezOknoUdostepnianiaZachowujacKomunikat();
}

const nowyKod = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');

// Rysuje zmienione strony do JPEG i wysyła je razem z opisem – do folderu publicznego albo,
// przy linku z ochroną, do tabeli chronionego linku. pelna: wysyła wszystkie strony.
// Zwraca { wyslane, wszystkie }.
async function opublikuj(p, postep = () => {}, { pelna = false, naLink = null, przedStrona = null, ogladane = [] } = {}) {
  const kod = p.udostepnienie?.kod || nowyKod();
  const ochrona = p.udostepnienie?.ochrona;
  const { uklad, strony, odciski, rozszerzenie, obraz, odcisk } = przygotujPublikacje(p);
  // Link działa od razu (#204): po zapisaniu wstępnego opisu projekt dostaje dane linku i krótki adres,
  // a strony dalej rysują się i wysyłają w tle.
  const linkGotowy = naLink && (async ({ konto }) => {
    p.udostepnienie = { ...(p.udostepnienie?.kod === kod ? p.udostepnienie : {}), kod, konto, zaktualizowano: new Date().toISOString(), ...(ochrona ? { ochrona } : {}) };
    await zapewnijKrotki(p);
    await naLink(p);
  });
  // Dużo stron do narysowania (#335) – rysuje serwer; drobne zmiany i każdy kłopot z serwerem – urządzenie.
  const wynik = await naSerwerze(p, { kod, ochrona: Boolean(ochrona), strony, odciski, rozszerzenie, pelna, postep, naLink: linkGotowy })
    || (ochrona
      ? await chmura.opublikujPodgladChroniony(p.id, kod, uklad, strony, obraz, postep, odciski, { pelna, rozszerzenie, naLink: linkGotowy, przedStrona, ogladane: ogladaneStrony(strony, ogladane) })
      : await chmura.opublikujPodglad(p.id, kod, uklad, strony, obraz, postep, pelna ? null : odciski, { rozszerzenie, naLink: linkGotowy, przedStrona, ogladane: ogladaneStrony(strony, ogladane) }));
  // Przerwana praca (#438): link działa z tym, co gotowe, ale nie jest aktualny – odcisk zostaje stary.
  if (wynik.przerwane) {
    if (!p.udostepnienie?.kod) p.udostepnienie = { kod, konto: wynik.konto, zaktualizowano: wynik.zaktualizowano, ...(ochrona ? { ochrona } : {}) };
    return wynik;
  }
  const krotki = p.udostepnienie?.kod === kod ? p.udostepnienie.krotki : null;
  p.udostepnienie = { kod, konto: wynik.konto, zaktualizowano: wynik.zaktualizowano, odcisk, ...(ochrona ? { ochrona } : {}), ...(krotki ? { krotki } : {}) };
  await zapewnijKrotki(p);
  return wynik;
}

// Strony linku z oglądanej strony edytora (id egzemplarzy: „<strona>” albo „<strona>-<nr>”) – rysowane najpierw.
function ogladaneStrony(strony, ogladane) {
  const ids = new Set(ogladane);
  return strony.filter((s) => ids.has(s.id) || [...ids].some((i) => s.id.startsWith(`${i}-`))).slice(0, 4).map((s) => s.id);
}

// ---------- Rysowanie linku na serwerze (#335) ----------
// Tylko wtedy, gdy to urządzenie samo się nie nadaje (#438: telefon na danych komórkowych, duża praca na telefonie
// bez ładowania, prawie rozładowana bateria – js/prace-w-tle.js); wcześniej: od PROG_SERWERA stron. Przeglądarka serwera rysuje te same obrazy
// (rysuj.html, wspólne moduły), a aplikacja tylko pokazuje postęp – można ją zamknąć, link dokończy się sam.
// null – rysuje urządzenie (mało stron, brak sieci, serwer wyłączony albo zajęty limitem, błąd).
export const PROG_SERWERA = 40;
let serwerWylaczony = false;
const czekaj = (ms) => new Promise((ok) => { setTimeout(ok, ms); });
// Projekt do zlecenia: bez treści obrazów, które są już na koncie (serwer bierze je z magazynu).
// Bez kopiowania treści obrazów (na telefonie z wieloma zdjęciami to były megabajty kopiowane i od razu wyrzucane).
const doZlecenia = (p) => ({
  ...p,
  zasoby: Object.fromEntries(Object.entries(p.zasoby || {}).map(([k, z]) => {
    if (!z?.sciezka || String(z.sciezka).startsWith('ai:')) return [k, z];
    const { dataUrl, ...bez } = z;
    void dataUrl;
    return [k, bez];
  })),
});

async function naSerwerze(p, { kod, ochrona, strony, odciski, rozszerzenie, pelna, postep, naLink }) {
  if (serwerWylaczony || !stan.uzytkownik || !navigator.onLine || globalThis.__bezSerwera) return null;
  try {
    const { konto, folder, nowy } = await chmura.folderLinku(p.id, kod, ochrona);
    const odNowa = pelna || nowy;
    let doRysowania = strony.length;
    if (!odNowa) {
      const m = await chmura.opisLinku(folder).catch(() => null);
      const tresci = m && (m.rozszerzenie || 'jpg') === rozszerzenie ? (m.tresci || {}) : {};
      // Pliki według treści (#438, A2): rysować trzeba tylko strony, których odcisku nie ma jeszcze w folderze.
      const juzSa = new Set(Object.values(tresci));
      doRysowania = strony.filter((s) => !juzSa.has(odciski[s.id])).length;
    }
    if (globalThis.__progSerwera !== undefined ? doRysowania < globalThis.__progSerwera : mozeSam(doRysowania)) return null;
    const { id } = await chmura.zlecRysowanieLinku(doZlecenia(p), folder, odNowa);
    rysujeSerwer();
    let linkGotowy = !naLink;
    for (let proba = 0; ; proba += 1) {
      await czekaj(proba ? 2000 : 800);
      const st = await chmura.stanRysowaniaLinku(p.id);
      if (st.id && id && st.id !== id) continue; // serwer kończy wcześniejsze rysowanie tego projektu – nasze czeka
      // Link działa, gdy serwer zapisał pierwszy opis (zaraz po starcie rysowania).
      if (!linkGotowy && ['rysuje', 'gotowe'].includes(st.stan)) { linkGotowy = true; await naLink({ konto }); }
      if (st.stan === 'rysuje' && st.wszystkie) postep(st.gotowe || 0, st.wszystkie);
      if (st.stan === 'gotowe') {
        postep(st.wszystkie || strony.length, st.wszystkie || strony.length);
        return { konto, zaktualizowano: st.zaktualizowano || new Date(st.koniec || Date.now()).toISOString(), wyslane: st.wyslane || 0, wszystkie: st.wszystkie || strony.length, naSerwerze: true };
      }
      if (st.stan === 'blad' || st.stan === 'limit' || st.stan === 'brak') return null;
      if (proba > 1800) return null; // ponad godzinę – coś nie tak, rysuje urządzenie
    }
  } catch (e) {
    if (e?.status === 503) serwerWylaczony = true; // ta sesja – bez pytania serwera
    return null;
  }
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
async function usunCudzeLinki(p) {
  if (!stan.uzytkownik) return false;
  const cudze = [];
  for (const L of linkiProjektu(p)) {
    if (!L.kod || !L.krotki) continue;
    try { const k = await chmura.rozwinKrotkiLink(L.krotki); if (k && k.projekt !== p.id) cudze.push(L); } catch { return false; }
  }
  if (!cudze.length) return false;
  p.udostepnienia = linkiProjektu(p).filter((L) => !cudze.includes(L));
  if (!p.udostepnienia.length) delete p.udostepnienia;
  await zapiszProjektLinku(p).catch(() => {});
  return true;
}

// Projekt otwarty w edytorze, link bez krótkiego adresu (sprzed #195): krótki kod dochodzi sam, w tle – długi
// adres działa dalej. Zapis projektu niesie kod na konto i na inne urządzenia.
export async function uzupelnijKrotkiLink() {
  const p = stan.projekt;
  if (!p || !navigator.onLine) return;
  if (await usunCudzeLinki(p)) return;
  let nowe = await odzyskajLinki(p);
  for (const L of linkiProjektu(p)) if (L.kod && !L.krotki && await naLinku(p, L, (W) => zapewnijKrotki(W, { sprawdz: true }))) nowe = true;
  if (nowe && stan.projekt === p) zapiszTeraz().catch(() => {});
}

// Link zlecony przez AI (plan H4, js/app/zadania-ai.js): ten sam link co z okna Udostępnij – nowy albo istniejący,
// z hasłem i datą ważności podanymi przez AI (za zgodą użytkownika). Projekt otwarty albo wczytany w tle.
// Projekt z linkami (#426): AI dostaje pierwszy link projektu; bez linków – tworzy nowy.
// Link projektu, którego ta karta nie ma otwartego (#438): wybrane urządzenie konta rysuje go w tle, pod dzierżawą
// pracy. Projekt wczytany tylko do rysowania – bez zapisu (dane linku uzupełni karta z projektem przy otwarciu).
export async function linkInnegoProjektu(projektId, kod) {
  const wpis = (await wpisyProjektow()).find((w) => w.id === projektId);
  if (!wpis) return null;
  const { czekajNaEdytor } = await import('./doczytaj.js');
  await czekajNaEdytor();
  const surowy = await wczytajProjektZWpisu(wpis);
  if (!surowy) return null;
  const { normalizuj } = await import('../projekt.js');
  const p = normalizuj(surowy);
  const L = linkiProjektu(p).find((x) => x.kod === kod);
  if (!L?.konto) return null;
  await przygotujDoRysowania(p);
  return zDzierzawa(p, L, ({ przedStrona }) => linkWTle((pasek) => naLinku(p, L, (W) => opublikuj(W, pasek, { przedStrona }))));
}

export async function linkDlaAi(p, { haslo = '', wazny_do: dzien = '' } = {}) {
  const otwarty = p === stan.projekt;
  if (otwarty) await zapiszTeraz(); else await przygotujDoRysowania(p);
  let L = linkiProjektu(p).find((x) => x.kod);
  const nowy = !L;
  if (nowy) L = { id: nowyIdLinku(), nazwa: '' };
  const waznyDo = isoZDnia(dzien || null);
  const w = { chroniony: Boolean(haslo || waznyDo || L.ochrona), zmienHaslo: Boolean(haslo) || Boolean(L.ochrona?.haslo), haslo: haslo || '', waznyDo: waznyDo || L.ochrona?.wazny_do || null };
  trwaPublikacja = true;
  try {
    if (nowy) {
      if (w.chroniony) {
        const kod = nowyKod();
        const ochrona = await chmura.ustawOchroneLinku(p.id, kod, w);
        Object.assign(L, { kod, ochrona: { haslo: Boolean(ochrona?.haslo), wazny_do: ochrona?.wazny_do || null } });
      }
      p.udostepnienia = [...linkiProjektu(p), L];
      try { await linkWTle((pasek) => naLinku(p, L, (W) => opublikuj(W, pasek))); } catch (e) { if (!L.konto) p.udostepnienia = linkiProjektu(p).filter((x) => x !== L); throw e; }
    } else if (haslo || waznyDo) {
      await linkWTle((pasek) => naLinku(p, L, (W) => zastosujOchrone(W, w, pasek)));
    }
    await zapiszProjektLinku(p);
  } finally { trwaPublikacja = false; }
  if (!otwarty && document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true });
  const o = L.ochrona;
  return { adres: linkUdostepnienia(p, L), haslo: Boolean(o?.haslo), wazny_do: o?.wazny_do || null };
}

// Przycisk „Utwórz link” albo „Aktualizuj teraz”.
// Z listy projektów (#196) – projekt nie jest otwarty: strony rysują się w tle (przygotujDoRysowania),
// zapis idzie do tej kopii projektu.
export async function opublikujUdostepnienie() {
  const p = celOkna || stan.projekt;
  const otwarty = p === stan.projekt;
  const zapisz = () => zapiszProjektLinku(p);
  const komunikat = $('#udostepnij-komunikat');
  komunikat.classList.remove('sukces');
  for (const b of [$('#udostepnij-utworz'), $('#udostepnij-teraz')]) b.disabled = true;
  trwaPublikacja = true;
  try {
    if (otwarty) await zapiszTeraz(); else await przygotujDoRysowania(p);
    let L = wybrany;
    if (!L) {
      // Nowy link (#426): nazwa, ochrona, znak wodny i makieta 3D z pól okna działają od pierwszej publikacji.
      const w = ochronaZOkna(null);
      if (w.blad) { komunikat.textContent = w.blad; return; }
      const znak = znakZOkna();
      const makieta = makietaZOkna();
      L = { id: nowyIdLinku(), nazwa: $('#udostepnij-nazwa').value.trim().slice(0, 60), ...(znak ? { znak_wodny: znak } : {}), ...(makieta ? { makieta_linku: makieta } : {}) };
      if (w.chroniony) {
        const kod = nowyKod();
        const ochrona = await chmura.ustawOchroneLinku(p.id, kod, w);
        Object.assign(L, { kod, ochrona: { haslo: Boolean(ochrona?.haslo), wazny_do: ochrona?.wazny_do || null } });
      }
      p.udostepnienia = [...linkiProjektu(p), L];
      wybrany = L;
    }
    komunikat.textContent = t('podgladEkran.przygotowujeLink');
    const pasek = pasekPostepu('Udostępnianie: strony podglądu – nie zamykaj Makietki', { opoznienie: 0 });
    pilnujZamkniecia(true);
    // Pasek tego linku jako aktywny (#427): gdy rysowanie przejmie serwer (dużo stron), rysujeSerwer() zmienia jego opis
    // na „możesz zamknąć Makietkę” i zdejmuje pytanie przy zamykaniu karty – wcześniej robił to tylko pasek
    // automatycznej aktualizacji, a przy tworzeniu linku zostawało „nie zamykaj Makietki”.
    let pilnuje = true;
    const ten = { pasek, zwolnij: () => { if (pilnuje) { pilnuje = false; pilnujZamkniecia(false); } } };
    aktywnyPasek = ten;
    rysujeNaSerwerze = false;
    let wynik;
    let linkJest = Boolean(L.konto);
    const opisPostepu = (i, n) => (rysujeNaSerwerze
      ? t('podgladEkran.serwerRysujeMoznaZamknac', { i, n })
      : linkJest
        ? t('podgladEkran.linkGotowyMozeszGo2', { i, n })
        : t('podgladEkran.stronyZ', { i, n }));
    try {
      wynik = await naLinku(p, L, (W) => opublikuj(W, (i, n) => { if (komunikat.isConnected) komunikat.textContent = opisPostepu(i, n); pasek.krok(i, n); }, {
        naLink: async (W2) => {
          przepiszLink(L, W2);
          linkJest = true;
          // Link działa – projekt zapisuje się z nim od razu (#428): zamknięcie Makietki w trakcie rysowania stron
          // (przy rysowaniu na serwerze wolno) nie gubi go z listy.
          zapisz().catch(() => {});
          odswiezOknoUdostepnianiaZachowujacKomunikat();
          komunikat.textContent = t('podgladEkran.linkGotowyMozeszGo');
          for (const b of [$('#udostepnij-utworz'), $('#udostepnij-teraz')]) b.disabled = true;
        },
      }));
    } catch (e) {
      if (!L.konto) { p.udostepnienia = linkiProjektu(p).filter((x) => x !== L); if (wybrany === L) wybrany = null; } // link nie powstał
      throw e;
    } finally { pasek.koniec(); ten.zwolnij(); if (aktywnyPasek === ten) aktywnyPasek = null; }
    komunikat.textContent = wynik.wyslane < wynik.wszystkie
      ? t('podgladEkran.gotoweWyslanoZStron', { wyslane: wynik.wyslane, wszystkie: wynik.wszystkie })
      : t('podgladEkran.gotoweSkopiujLinkI');
    komunikat.classList.add('sukces');
    wypelnijUstawieniaLinku(p);
    odswiezOknoUdostepnianiaZachowujacKomunikat(); // link od razu w oknie, zapis – zaraz potem
    await zapisz();
    if (!otwarty && document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true }); // plakietka „Udostępniony”
  } catch (e) {
    komunikat.textContent = t('podgladEkran.nieUdaloSieUdostepnic', { komunikatBledu: chmura.komunikatBledu(e) });
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
// Wszystkie linki projektu (#426) – po kolei, każdy z własnymi ustawieniami.
const nieaktualneLinki = (p) => linkiProjektu(p).filter((L) => L.kod && L.konto && !linkAktualny(p, L));
let czekaAktualizacja = false; // zmiana w czasie trwającej aktualizacji – sprawdzić linki jeszcze raz po niej
export function zaplanujAktualizacjeLinku(opoznienie = OPOZNIENIE_LINKU_MS) {
  clearTimeout(timerLinku);
  const p = stan.projekt;
  if (!p || !stan.uzytkownik || !linkiProjektu(p).some((L) => L.kod && L.konto)) return;
  // Nic nie liczymy przy samym zapisie (na telefonie każdy zapis to ułamek sekundy mniej) – dopiero po chwili spokoju.
  timerLinku = setTimeout(async () => {
    if (stan.projekt !== p || !navigator.onLine) return;
    if (trwaPublikacja) { czekaAktualizacja = true; return; } // dokończy się po bieżącej aktualizacji
    const nieaktualne = nieaktualneLinki(p);
    if (!nieaktualne.length) {
      // Linki aktualne – praca z kolejki (np. po zapisie samych danych linku) zamyka się bez rysowania (#438).
      potwierdzAktualne(p, linkiProjektu(p).filter((L) => L.kod && L.konto).map((L) => L.kod));
      return;
    }
    trwaPublikacja = true;
    if ($('#dlg-udostepnij').open) odswiezOknoUdostepniania();
    let przerwane = false;
    let narysowane = false;
    try {
      // Jedna kolejka prac konta (#438): link rysuje karta z dzierżawą (albo lepsze urządzenie, albo serwer).
      const ogladane = stan.tryb === 'strona' && p.strony[stan.indeks] ? [p.strony[stan.indeks].id] : [];
      for (const L of nieaktualne) {
        const w = await zDzierzawa(p, L, ({ przedStrona }) => linkWTle((pasek) => naLinku(p, L, (W) => opublikuj(W, pasek, { przedStrona, ogladane }))));
        if (w.wynik) narysowane = true;
        if (w.wynik?.przerwane) { przerwane = true; break; }
      }
      // Dane linku (odcisk, data) zapisują się tylko po rysowaniu w tej karcie – link rysowany przez inne urządzenie
      // nie może wywołać tu zapisu, bo każdy zapis to nowa wersja i nowa praca (pętla).
      if (narysowane) await zapiszTeraz();
    } catch { /* spróbujemy przy następnym zapisie */ } finally {
      // Przerwane dla nowszej wersji: nowy plan po chwili spokoju – rysują się tylko strony, których jeszcze nie ma.
      if (przerwane) zaplanujAktualizacjeLinku(SPOKOJ_PO_ZMIANIE_MS);
      trwaPublikacja = false;
      if (czekaAktualizacja && !przerwane) { czekaAktualizacja = false; zaplanujAktualizacjeLinku(); }
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
// Unieważnia wybrany link (#426: pozostałe linki projektu działają dalej).
export async function wylaczUdostepnienie() {
  const p = celOkna || stan.projekt;
  const L = wybrany;
  if (!p || !L) return;
  if (!await potwierdz(t('podgladEkran.uniewaznicLinkNazwa', { nazwa: nazwaLinku(p, L) }), t('podgladEkran.osobyKtoreDostalyLink'), t('podgladEkran.uniewaznijLink'), true)) return;
  try {
    clearTimeout(timerLinku);
    if (L.kod) {
      if (L.ochrona) await chmura.usunPodgladChroniony(p.id, L.kod);
      await chmura.wylaczPodglad(p.id, L.kod);
      if (L.krotki) await chmura.usunKrotkiLink(p.id, L.kod).catch(() => {});
    }
    p.udostepnienia = linkiProjektu(p).filter((x) => x !== L);
    if (!p.udostepnienia.length) delete p.udostepnienia;
    wybrany = linkiProjektu(p)[0] || null;
    await zapiszProjektLinku(p);
    wypelnijUstawieniaLinku(p);
    odswiezOknoUdostepniania();
    $('#udostepnij-komunikat').textContent = t('podgladEkran.linkUniewazniony');
    if (document.body.dataset.ekran === 'projekty') pokazProjekty({ cicho: true });
  } catch (e) {
    $('#udostepnij-komunikat').textContent = t('podgladEkran.nieUdaloSieUniewaznic', { komunikatBledu: chmura.komunikatBledu(e) });
  }
}

export async function kopiujLinkUdostepnienia() {
  const pole = $('#udostepnij-link');
  try {
    await navigator.clipboard.writeText(pole.value);
    powiadom(t('podgladEkran.linkSkopiowany'));
  } catch {
    pole.select();
    powiadom(t('podgladEkran.zaznaczylemLinkSkopiujGo'));
  }
}
async function kopiujTekst(tekst) {
  try { await navigator.clipboard.writeText(tekst); powiadom(t('podgladEkran.linkSkopiowany')); } catch { powiadom(tekst); }
}
