// Wzorce: wejście do edycji wzorca i powrót do stron, dodawanie, kopiowanie, zmiana nazwy, kolejność, usuwanie.

import { nowyWzorzec, kopiujWzorzec, stronyZWzorcem, WZORCE_Z_SEKCJI } from '../projekt.js';
import { WZORCE_STANDARDOWE } from '../wzorce-standardowe.js';
import { $, powiadom, zapytajONazwe, potwierdz } from '../ui.js';
import { stan, ustawPanel, biezacaSekcja, edytor } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { odswiezPasekEdytora, poZmianieWzorcowStrony } from './panel-strony.js';
import { panel } from './skladniki.js';
import { ustawZakladke, renderujListe, generujMiniatury } from './lista-stron.js';

// ---------- Wzorce ----------

export async function edytujWzorzec(id) {
  if (stan.tryb === 'wzorzec' && stan.idWzorca === id) return;
  zapiszBiezacyCel();
  stan.tryb = 'wzorzec';
  stan.idWzorca = id;
  if ($('#dlg-wzorce').open) $('#dlg-wzorce').close();
  await zaladujCel();
  if (document.body.dataset.panel === 'strony') ustawPanel('');
}

export async function wrocDoStron() {
  if (stan.tryb !== 'wzorzec') return;
  zapiszBiezacyCel();
  stan.tryb = 'strona';
  await zaladujCel();
}

export async function dodajWzorzec() {
  const { projekt } = stan;
  const sekcja = biezacaSekcja();
  const w = nowyWzorzec(`Wzorzec ${projekt.wzorce.length + 1}`, sekcja.wydruk);
  projekt.wzorce.push(w);
  // Nowy wzorzec od razu działa w bieżącej sekcji – najczęstszy przypadek.
  sekcja.wzorce = [...sekcja.wzorce, w.id];
  powiadom(`Wzorzec będzie widoczny na stronach sekcji „${sekcja.nazwa}”. Zmienisz to w panelu z prawej.`);
  await edytujWzorzec(w.id);
  zaplanujZapis();
}

export async function duplikujWzorzecZ(id) {
  zapiszBiezacyCel();
  const zrodlo = stan.projekt.wzorce.find((w) => w.id === id);
  const kopia = kopiujWzorzec(zrodlo, `${zrodlo.nazwa} (kopia)`);
  stan.projekt.wzorce.splice(stan.projekt.wzorce.indexOf(zrodlo) + 1, 0, kopia);
  await edytujWzorzec(kopia.id);
  zaplanujZapis();
}

export async function zmienNazweWzorca(id) {
  const w = stan.projekt.wzorce.find((x) => x.id === id);
  const nazwa = await zapytajONazwe('Zmień nazwę wzorca', 'Nazwa wzorca', w.nazwa);
  if (!nazwa) return;
  w.nazwa = nazwa;
  renderujListe();
  if (stan.tryb === 'wzorzec') { odswiezPasekEdytora(); if (!edytor.aktywny) panel.zbuduj(); } else if (!edytor.aktywny) panel.zbuduj();
  zaplanujZapis();
}

export async function usunWzorzec(id) {
  const { projekt } = stan;
  const w = projekt.wzorce.find((x) => x.id === id);
  const n = stronyZWzorcem(projekt, id).length;
  const ok = await potwierdz(
    `Usunąć wzorzec „${w.nazwa}”?`,
    n ? `Zniknie ze ${n} stron, które go używają. Ich własna treść zostanie.` : 'Wzorzec nie jest nigdzie używany.',
    'Usuń wzorzec',
    true,
  );
  if (!ok) return;
  zapiszBiezacyCel();
  for (const s of stronyZWzorcem(projekt, id)) stan.miniatury.delete(s.id);
  projekt.wzorce = projekt.wzorce.filter((x) => x.id !== id);
  for (const s of projekt.sekcje) s.wzorce = s.wzorce.filter((x) => x !== id);
  for (const s of projekt.strony) if (Array.isArray(s.wzorce)) s.wzorce = s.wzorce.filter((x) => x !== id);
  stan.miniatury.delete(id);
  if (stan.tryb === 'wzorzec' && stan.idWzorca === id) {
    stan.tryb = 'strona';
    await zaladujCel();
    ustawZakladke('wzorce');
  } else {
    await zaladujCel();
  }
  zaplanujZapis();
  powiadom(`Usunięto wzorzec „${w.nazwa}”.`, false, { etykieta: 'Cofnij', fn: () => cofnijKrok(-1) });
}

// Kolejność wzorców: pierwszy na liście leży najniżej na stronie.
export async function przesunWzorzec(id, kierunek) {
  const { wzorce } = stan.projekt;
  const i = wzorce.findIndex((w) => w.id === id);
  const j = i + kierunek;
  if (i < 0 || j < 0 || j >= wzorce.length) return;
  zapiszBiezacyCel();
  [wzorce[i], wzorce[j]] = [wzorce[j], wzorce[i]];
  stan.miniatury.clear();
  await zaladujCel();
  generujMiniatury();
  zaplanujZapis();
}

// ---------- Okno „Wzorce” ----------

export function otworzWzorce() {
  if (!stan.projekt) return;
  zapiszBiezacyCel();
  renderujListe();
  const lista = $('#wzorce-standardowe');
  lista.replaceChildren(...WZORCE_STANDARDOWE.map((w) => {
    const li = document.createElement('li');
    li.className = 'strona wzorzec standardowy';
    li.innerHTML = '<div class="opis-wzorca"><strong class="nazwa"></strong><small></small></div><button type="button" class="przycisk maly">Dodaj do projektu</button>';
    li.querySelector('.nazwa').textContent = w.nazwa;
    li.querySelector('small').textContent = w.opis;
    li.querySelector('button').dataset.standard = w.klucz;
    return li;
  }));
  if (!$('#dlg-wzorce').open) $('#dlg-wzorce').showModal();
}

// Wzorzec standardowy zbudowany dla formatu bieżącej sekcji trafia do projektu jako zwykły wzorzec.
export function dodajWzorzecStandardowy(klucz) {
  const def = WZORCE_STANDARDOWE.find((w) => w.klucz === klucz);
  if (!def) return null;
  const { projekt } = stan;
  const sekcja = biezacaSekcja();
  let nazwa = def.nazwa;
  for (let n = 2; projekt.wzorce.some((w) => w.nazwa === nazwa); n += 1) nazwa = `${def.nazwa} ${n}`;
  const w = nowyWzorzec(nazwa, sekcja.wydruk);
  w.obiekty = def.obiekty(sekcja.wydruk);
  w.lustro = Boolean(def.lustro);
  projekt.wzorce.push(w);
  renderujListe();
  generujMiniatury();
  zaplanujZapis();
  powiadom(`Dodano wzorzec „${nazwa}”. Dodaj go teraz do strony albo do całej sekcji.`);
  return w;
}

// Włącza albo wyłącza wzorzec na bieżącej stronie. Strona, która brała wzorce z sekcji,
// przechodzi na własny wybór (zaczyna od tego, co miała z sekcji).
export async function przelaczWzorzecNaStronie(id) {
  const { projekt } = stan;
  if (stan.tryb !== 'strona') return;
  const strona = projekt.strony[stan.indeks];
  const sekcja = biezacaSekcja();
  const lista = strona.wzorce === WZORCE_Z_SEKCJI ? [...sekcja.wzorce] : [...strona.wzorce];
  strona.wzorce = lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
  await poZmianieWzorcowStrony(strona);
  renderujListe();
}

// Włącza albo wyłącza wzorzec w całej sekcji bieżącej strony.
export async function przelaczWzorzecWSekcji(id) {
  if (stan.tryb !== 'strona') return;
  const sekcja = biezacaSekcja();
  zapiszBiezacyCel();
  sekcja.wzorce = sekcja.wzorce.includes(id) ? sekcja.wzorce.filter((x) => x !== id) : [...sekcja.wzorce, id];
  stan.miniatury.clear();
  await zaladujCel();
  panel.zbuduj();
  renderujListe();
  zaplanujZapis();
}
