// Wzorce: wejście do edycji wzorca i powrót do stron, dodawanie, kopiowanie, zmiana nazwy, kolejność, usuwanie.

import { nowyWzorzec, kopiujWzorzec, stronyZWzorcem } from '../projekt.js';
import { powiadom, zapytajONazwe, potwierdz } from '../ui.js';
import { stan, ustawPanel, biezacaSekcja, edytor } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { odswiezPasekEdytora } from './panel-strony.js';
import { panel } from './skladniki.js';
import { ustawZakladke, renderujListe, generujMiniatury } from './lista-stron.js';

// ---------- Wzorce ----------

export async function edytujWzorzec(id) {
  if (stan.tryb === 'wzorzec' && stan.idWzorca === id) return;
  zapiszBiezacyCel();
  stan.tryb = 'wzorzec';
  stan.idWzorca = id;
  ustawZakladke('wzorce');
  await zaladujCel();
  if (document.body.dataset.panel === 'strony') ustawPanel('');
}

export async function wrocDoStron() {
  if (stan.tryb !== 'wzorzec') return;
  zapiszBiezacyCel();
  stan.tryb = 'strona';
  ustawZakladke('strony');
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
