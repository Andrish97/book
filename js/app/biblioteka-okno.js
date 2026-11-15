// Okno „Biblioteka” (decyzje #131A, #134): wyszukiwarka u góry, kategorie jako przyciski, kafelki elementów.
// Kliknięcie wstawia element na środek bieżącej strony; na komputerze kafelek można też przeciągnąć na
// stronę – element staje w miejscu upuszczenia. Na komputerze okno jest panelem obok strony (zostaje otwarte
// do kolejnych wstawień), na telefonie i tablecie – zasłonką, która zamyka się po wstawieniu.

import { $ } from '../ui.js';
import { ikona } from '../ikony.js';
import { kategorieBiblioteki, szukajWBibliotece, elementBiblioteki } from '../biblioteka.js';
import { ustawDomyslneDaneWykresu } from '../biblioteka-elementy.js';
import { edytor, stan } from './kontekst.js';

export const TYP_PRZECIAGANIA = 'application/x-makietka-biblioteka';

const dlg = $('#dlg-biblioteka');
const pole = $('#szukaj-w-bibliotece');
const chipy = $('#kategorie-biblioteki');
const lista = $('#elementy-biblioteki');
let kategoria = 'ksztalty';

// Wykres z biblioteki: pierwsza tabela danych – podpisy z pierwszej kolumny, liczby z kolumn z liczbami.
ustawDomyslneDaneWykresu(() => {
  const t = stan.projekt?.tabele?.[0];
  if (!t) return {};
  const liczbowe = t.kolumny.filter((_, k) => t.wiersze.some((w) => /\d/.test(String(w[k] ?? ''))) && t.wiersze.every((w) => /^\s*-?[\d\s.,]*%?\s*$/.test(String(w[k] ?? ''))));
  const etykiety = t.kolumny.find((n) => !liczbowe.includes(n)) || t.kolumny[0];
  return { tabela: t.id, etykiety, wartosci: liczbowe.filter((n) => n !== etykiety).slice(0, 3) };
});

const naKomputerze = () => window.matchMedia('(pointer: fine)').matches && window.innerWidth > 860;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function pokazChipy() {
  chipy.innerHTML = kategorieBiblioteki().map((k) => `<button type="button" class="chip-biblioteki" data-kategoria="${k.id}" aria-pressed="${k.id === kategoria}">${ikona(k.ikona, { rozmiar: 16 })}<span>${esc(k.nazwa)}</span></button>`).join('');
}

function pokazElementy() {
  const zapytanie = pole.value.trim();
  // Z wpisanym słowem szukamy we wszystkich kategoriach – nie trzeba zgadywać, gdzie leży strzałka.
  const trafione = szukajWBibliotece(zapytanie, zapytanie ? null : kategoria);
  chipy.classList.toggle('przy-szukaniu', Boolean(zapytanie));
  if (!trafione.length) {
    const k = !zapytanie && kategorieBiblioteki().find((x) => x.id === kategoria);
    lista.innerHTML = `<p class="ciche pusto-biblioteki">${esc(k?.pusto || 'Nic nie pasuje – spróbuj innego słowa.')}</p>`;
    return;
  }
  const przeciagalne = naKomputerze();
  // Długie kategorie (#155): nagłówki grup (Podstawowe, Wielokąty…) – tylko przy przeglądaniu kategorii.
  let grupa = null;
  lista.innerHTML = trafione.map(({ kategoria: k, element: e }) => {
    const naglowek = !zapytanie && e.grupa && e.grupa !== grupa ? `<h3 class="grupa-biblioteki">${esc(e.grupa)}</h3>` : '';
    if (!zapytanie && e.grupa) grupa = e.grupa;
    return naglowek + kafelek(k, e, przeciagalne);
  }).join('');
}

function kafelek(k, e, przeciagalne) {
  const kafel = `<button type="button" class="kafel-biblioteki${e.duzy ? ' duzy' : ''}" data-kategoria="${k.id}" data-element="${esc(e.id)}"${przeciagalne ? ' draggable="true"' : ''} title="${esc(e.nazwa)}${przeciagalne ? ' – kliknij albo przeciągnij na stronę' : ''}" aria-label="${esc(e.nazwa)}"><span class="podglad-biblioteki">${e.podglad}</span>${e.duzy ? `<strong>${esc(e.nazwa)}</strong>${e.opis ? `<small>${esc(e.opis)}</small>` : ''}` : ''}</button>`;
  // Elementy z akcjami (Moje elementy: zmień nazwę, usuń) – małe przyciski w rogu kafelka.
  if (!e.akcje?.length) return kafel;
  return `<div class="kafel-z-akcjami">${kafel}<span class="akcje-kafla">${e.akcje.map((a, i) => `<button type="button" class="przycisk-ikona maly" data-akcja-kafla="${i}" data-kategoria="${k.id}" data-element="${esc(e.id)}" title="${esc(a.nazwa)}" aria-label="${esc(a.nazwa)}: ${esc(e.nazwa)}">${ikona(a.ikona, { rozmiar: 14 })}</button>`).join('')}</span></div>`;
}

// Kategoria z danymi z konta (Moje elementy): lista odświeża się przy otwarciu i po każdej zmianie.
export function odswiezBiblioteke() {
  if (!dlg.open) return;
  pokazChipy();
  pokazElementy();
}

export function otworzBiblioteke(idKategorii = null) {
  if (idKategorii) kategoria = idKategorii;
  pole.value = '';
  pokazChipy();
  pokazElementy();
  for (const k of kategorieBiblioteki()) k.odswiez?.().then(odswiezBiblioteke).catch(() => {});
  if (dlg.open) { pole.focus(); return; }
  dlg.classList.toggle('obok-strony', naKomputerze());
  if (naKomputerze()) dlg.show(); else dlg.showModal();
  if (naKomputerze()) pole.focus();
}

// Wstawia element biblioteki (kliknięcie albo upuszczenie na stronę).
export function wstawZBiblioteki(idKategorii, idElementu, punkt = null) {
  const e = elementBiblioteki(idKategorii, idElementu);
  if (!e) return null;
  const obj = e.wstaw(edytor, punkt);
  if (!naKomputerze()) dlg.close();
  return obj;
}

chipy.addEventListener('click', (e) => {
  const b = e.target.closest('[data-kategoria]');
  if (!b) return;
  kategoria = b.dataset.kategoria;
  pole.value = '';
  pokazChipy();
  pokazElementy();
});
lista.addEventListener('click', (e) => {
  const a = e.target.closest('[data-akcja-kafla]');
  if (a) {
    const el = elementBiblioteki(a.dataset.kategoria, a.dataset.element);
    el?.akcje?.[Number(a.dataset.akcjaKafla)]?.fn();
    return;
  }
  const b = e.target.closest('.kafel-biblioteki');
  if (b) wstawZBiblioteki(b.dataset.kategoria, b.dataset.element);
});
lista.addEventListener('dragstart', (e) => {
  const b = e.target.closest('.kafel-biblioteki');
  if (!b) return;
  e.dataTransfer.setData(TYP_PRZECIAGANIA, `${b.dataset.kategoria}|${b.dataset.element}`);
  e.dataTransfer.effectAllowed = 'copy';
});
pole.addEventListener('input', pokazElementy);
$('#biblioteka-zamknij').addEventListener('click', () => dlg.close());
dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.matches(':modal')) { e.preventDefault(); dlg.close(); } });
