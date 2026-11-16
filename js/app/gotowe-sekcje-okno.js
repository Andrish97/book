// Okno „Gotowe sekcje” (#166): galeria szablonów całych dokumentów z miniaturami rysowanymi prawdziwym
// rendererem, filtr kategorii i szukanie; szczegóły szablonu z podglądem w formacie projektu, pytaniami
// (rok, liczba stron), kolorami (marka albo paleta) i wstawieniem jako nowa sekcja – jednym krokiem cofania.
// Otwierają je: lista stron („Gotowa” obok „Sekcja”), Biblioteka (kategoria „Gotowe sekcje”) i nowy projekt
// („Zacznij od gotowego szablonu”).

import { $, powiadom } from '../ui.js';
import { ikona } from '../ikony.js';
import { normalizuj, nowyProjekt } from '../projekt.js';
import { rozwin } from '../serie.js';
import { przeliczOkladki } from '../okladka.js';
import { renderujCel } from '../zlozenie.js';
import { biezacaMarka, markaPusta } from '../zestaw-marki.js';
import {
  SZABLONY_SEKCJI, KATEGORIE_SEKCJI, PALETY, szablonSekcji, domyslneOpcje, wstawGotowaSekcje, paletaZMarki, svgSchematu,
  usunPustyStart, projektPusty,
} from '../gotowe-sekcje.js';
import { stan, biezacaSekcja } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis } from './zapis.js';
import { ustawZakladke, generujMiniatury } from './lista-stron.js';

const dlg = $('#dlg-gotowe-sekcje');
const lista = $('#gotowe-lista');
const chipy = $('#gotowe-kategorie');
const pole = $('#gotowe-szukaj');
const szczegoly = $('#gotowe-szczegoly');
const galeria = $('#gotowe-galeria');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bezOgonkow = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

let kategoria = '';
let tryb = { zastapPusty: false };
const miniatury = new Map(); // klucz (szablon|format|paleta) → { url, stron }

// ---------- Kolory, format i budowa próbna ----------

const marka = () => { try { const m = biezacaMarka(); return markaPusta(m) ? null : m; } catch { return null; } };
function paleta(szablon, wybor = $('#gotowe-paleta').value) {
  if (wybor === 'marka') return paletaZMarki(marka()) || PALETY[szablon.paleta];
  return PALETY[wybor] || PALETY[szablon.paleta] || PALETY.granat;
}
const czcionkiMarki = () => {
  const m = marka();
  return m ? { tytul: m.czcionki.naglowek || undefined, tekst: m.czcionki.tekst || undefined } : {};
};
const wydrukCelu = () => (stan.projekt ? biezacaSekcja().wydruk : null);

// Projekt próbny z samą sekcją szablonu – do miniatur i podglądu (nie dotyka projektu użytkownika).
async function projektProbny(szablon, { odpowiedzi, wlasnyFormat, wybor } = {}) {
  const wydruk = wydrukCelu() || { szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, marginesy: { gora: 12, dol: 12, wewnetrzny: 12, zewnetrzny: 12 } };
  const p = normalizuj(nowyProjekt('Podgląd', wydruk));
  if (szablon.okladka) {
    // Okładka potrzebuje środka – próbny blok 120 stron, żeby grzbiet był widoczny.
    p.strony[0].seria = undefined;
    for (let i = 1; i < 120; i += 1) p.strony.push({ ...p.strony[0], id: `s_pr${i}`, obiekty: [] });
  }
  const { sekcja } = await wstawGotowaSekcje(p, szablon.id, { wydruk, wlasnyFormat, odpowiedzi, paleta: paleta(szablon, wybor), czcionki: czcionkiMarki() });
  przeliczOkladki(p);
  const ciag = rozwin(p);
  const egz = ciag.egzemplarze.filter((e) => e.strona.sekcja === sekcja.id && !e.pusta);
  return { p, ciag, egz };
}

// ---------- Galeria ----------

function pokazChipy() {
  chipy.innerHTML = [{ id: '', nazwa: 'Wszystkie' }, ...KATEGORIE_SEKCJI].map((k) => `<button type="button" class="chip-biblioteki" data-kategoria="${k.id}" aria-pressed="${k.id === kategoria}"><span>${esc(k.nazwa)}</span></button>`).join('');
}

function pokazListe() {
  if (!lista.childElementCount) {
    lista.innerHTML = SZABLONY_SEKCJI.map((s) => `<button type="button" class="karta-szablonu" data-id="${s.id}" data-kategoria="${s.kategoria}">
      <span class="miniatura-szablonu">${svgSchematu(s)}</span>
      <strong>${esc(s.nazwa)}</strong><small>${esc(s.opis)}</small>${s.dane ? '<span class="plakietka-danych">z danymi</span>' : ''}</button>`).join('');
    for (const k of lista.children) obserwator.observe(k);
  }
  const slowa = bezOgonkow(pole.value).split(/\s+/).filter(Boolean);
  for (const k of lista.children) {
    const s = szablonSekcji(k.dataset.id);
    const tekst = bezOgonkow(`${s.nazwa} ${s.slowa} ${s.opis}`);
    k.hidden = Boolean((kategoria && s.kategoria !== kategoria) || !slowa.every((x) => tekst.includes(x)));
  }
}

// Miniatury rysowane po kolei, gdy karta jest widoczna.
const kolejka = [];
let rysuje = false;
async function rysujKolejke() {
  if (rysuje) return;
  rysuje = true;
  while (kolejka.length && dlg.open) {
    const karta = kolejka.shift();
    const s = szablonSekcji(karta.dataset.id);
    const klucz = `${s.id}|${wydrukCelu()?.szerokosc_mm}x${wydrukCelu()?.wysokosc_mm}|${marka() ? 'marka' : ''}`;
    try {
      let m = miniatury.get(klucz);
      if (!m) {
        const { p, ciag, egz } = await projektProbny(s, { wlasnyFormat: true, wybor: marka() ? 'marka' : '' });
        m = { url: await renderujCel(p, egz[0], { szerokoscPx: 220, spad: false, ciag, format: 'jpeg', jakosc: 0.8 }), stron: egz.length };
        miniatury.set(klucz, m);
      }
      const ramka = karta.querySelector('.miniatura-szablonu');
      ramka.innerHTML = `<img src="${m.url}" alt="">`;
      ramka.classList.add('gotowa');
      const meta = karta.querySelector('.meta-szablonu') || karta.appendChild(Object.assign(document.createElement('span'), { className: 'meta-szablonu' }));
      meta.textContent = `${m.stron} ${m.stron === 1 ? 'strona' : m.stron < 5 ? 'strony' : 'stron'}`;
    } catch (e) { console.error(e); }
    await new Promise((r) => setTimeout(r, 0));
  }
  rysuje = false;
}
const obserwator = new IntersectionObserver((wpisy) => {
  for (const w of wpisy) {
    if (!w.isIntersecting || w.target.querySelector('.miniatura-szablonu.gotowa')) continue;
    obserwator.unobserve(w.target);
    kolejka.push(w.target);
  }
  rysujKolejke();
}, { root: null, rootMargin: '200px' });

// ---------- Szczegóły ----------

let czasPodgladu = null;
function pokazSzczegoly(id) {
  const s = szablonSekcji(id);
  if (!s) return;
  szczegoly.dataset.id = id;
  galeria.hidden = true;
  szczegoly.hidden = false;
  $('#gotowe-nazwa').textContent = s.nazwa;
  $('#gotowe-opis').textContent = s.opis;
  const pyt = $('#gotowe-pytania');
  const odp = domyslneOpcje(s);
  pyt.innerHTML = (s.pytania || []).map((p) => (p.typ === 'wybor'
    ? `<label class="pole"><span>${esc(p.etykieta)}</span><select name="${p.klucz}">${p.opcje.map(([v, n]) => `<option value="${v}"${v === odp[p.klucz] ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`
    : `<label class="pole waskie"><span>${esc(p.etykieta)}</span><input name="${p.klucz}" type="number" min="${p.min}" max="${p.max}" step="1" inputmode="numeric" value="${odp[p.klucz]}"></label>`)).join('');
  const wp = $('#gotowe-format-pole');
  wp.hidden = !s.format;
  if (s.format) {
    const cel = wydrukCelu();
    $('#gotowe-format-opis').textContent = `Format szablonu ${s.format[0]} × ${s.format[1]} mm${cel ? ` (bez zaznaczenia – format sekcji ${cel.szerokosc_mm} × ${cel.wysokosc_mm} mm)` : ''}`;
    $('#gotowe-wlasny-format').checked = true;
  }
  if (!$('#gotowe-paleta').value) $('#gotowe-paleta').value = marka() ? 'marka' : '';
  $('#gotowe-paleta').querySelector('option[value=""]').textContent = `Kolory szablonu (${PALETY[s.paleta]?.nazwa || 'domyślne'})`;
  odswiezPodglad();
  $('#gotowe-wstaw').focus();
}

function odpowiedzi() {
  const o = {};
  for (const el of $('#gotowe-pytania').querySelectorAll('input, select')) o[el.name] = el.type === 'number' ? Number(el.value) : el.value;
  return o;
}

function odswiezPodglad() {
  clearTimeout(czasPodgladu);
  czasPodgladu = setTimeout(async () => {
    const s = szablonSekcji(szczegoly.dataset.id);
    const box = $('#gotowe-podglad');
    box.setAttribute('aria-busy', 'true');
    try {
      const { p, ciag, egz } = await projektProbny(s, { odpowiedzi: odpowiedzi(), wlasnyFormat: $('#gotowe-wlasny-format').checked || !s.format });
      const obrazy = [];
      for (const e of egz.slice(0, 3)) obrazy.push(await renderujCel(p, e, { szerokoscPx: 260, spad: false, ciag, format: 'jpeg', jakosc: 0.85 }).catch(() => null));
      if (szczegoly.dataset.id !== s.id) return;
      box.innerHTML = obrazy.filter(Boolean).map((u) => `<img src="${u}" alt="">`).join('');
      const sek = p.sekcje.at(-1);
      $('#gotowe-podsumowanie').textContent = `${egz.length} ${egz.length === 1 ? 'strona' : egz.length < 5 ? 'strony' : 'stron'} · ${Math.round(sek.wydruk.szerokosc_mm)} × ${Math.round(sek.wydruk.wysokosc_mm)} mm${s.dane ? ' · strony z tabeli danych (do zmiany w oknie Dane)' : ''}`;
    } catch (e) {
      console.error(e);
      box.innerHTML = `<p class="ciche">Nie udało się narysować podglądu: ${esc(e.message)}</p>`;
    } finally { box.removeAttribute('aria-busy'); }
  }, 120);
}

function pokazGalerie() {
  szczegoly.hidden = true;
  galeria.hidden = false;
  pokazListe();
  rysujKolejke();
}

// ---------- Wstawienie ----------

async function wstaw() {
  const s = szablonSekcji(szczegoly.dataset.id);
  if (!s || !stan.projekt) return;
  if (s.okladka && stan.projekt.sekcje.some((x) => x.okladka)) {
    powiadom('Projekt ma już okładkę – zmień ją w ustawieniach sekcji okładki albo usuń, zanim wstawisz nową.', true);
    return;
  }
  zapiszBiezacyCel();
  const p = stan.projekt;
  const pusty = tryb.zastapPusty && projektPusty(p);
  const indeks = p.sekcje.indexOf(biezacaSekcja());
  const { sekcja, strony } = await wstawGotowaSekcje(p, s.id, {
    wydruk: biezacaSekcja().wydruk, wlasnyFormat: $('#gotowe-wlasny-format').checked || !s.format, odpowiedzi: odpowiedzi(),
    paleta: paleta(s), czcionki: czcionkiMarki(), poIndeksie: indeks,
  });
  if (pusty) usunPustyStart(p, sekcja);
  przeliczOkladki(p);
  dlg.close();
  stan.miniatury.clear();
  stan.tryb = 'strona';
  stan.indeks = Math.max(0, p.strony.indexOf(strony[0]));
  ustawZakladke('strony');
  await zaladujCel({ dopasuj: true });
  generujMiniatury();
  zaplanujZapis();
  const zDanymi = s.dane ? ' Treść stron bierze się z tabeli danych – zmienisz ją w oknie Dane.' : '';
  powiadom(`Wstawiono sekcję „${sekcja.nazwa}”. Cofnij (Ctrl+Z), jeśli to nie to.${zDanymi}`);
}

// ---------- Otwieranie ----------

export function otworzGotoweSekcje({ szablon = null, zastapPusty = false } = {}) {
  if (!stan.projekt) return;
  tryb = { zastapPusty };
  const sel = $('#gotowe-paleta');
  sel.innerHTML = `${marka() ? '<option value="marka">Kolory marki</option>' : ''}<option value="">Kolory szablonu</option>${Object.entries(PALETY).map(([k, v]) => `<option value="${k}">${esc(v.nazwa)}</option>`).join('')}`;
  sel.value = marka() ? 'marka' : '';
  pokazChipy();
  if (!dlg.open) dlg.showModal();
  if (szablon) pokazSzczegoly(szablon);
  else { pole.value = ''; pokazGalerie(); }
}

chipy.addEventListener('click', (e) => {
  const b = e.target.closest('[data-kategoria]');
  if (!b) return;
  kategoria = b.dataset.kategoria;
  pokazChipy();
  pokazListe();
});
pole.addEventListener('input', pokazListe);
lista.addEventListener('click', (e) => {
  const k = e.target.closest('.karta-szablonu');
  if (k) pokazSzczegoly(k.dataset.id);
});
$('#gotowe-wroc').addEventListener('click', pokazGalerie);
$('#gotowe-wstaw').addEventListener('click', wstaw);
$('#gotowe-zamknij').addEventListener('click', () => dlg.close());
for (const id of ['#gotowe-paleta', '#gotowe-wlasny-format']) $(id).addEventListener('change', odswiezPodglad);
$('#gotowe-pytania').addEventListener('change', odswiezPodglad);
$('#gotowe-wroc').insertAdjacentHTML('afterbegin', ikona('wstecz', { rozmiar: 16 }));
dlg.addEventListener('close', () => { kolejka.length = 0; });
