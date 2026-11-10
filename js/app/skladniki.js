// Stałe części ekranu edytora, tworzone raz przy starcie: panel właściwości, linijki, panel warstw, menu widoku,
// okno danych i podgląd. Dostają funkcje z pozostałych modułów jako reakcje na zdarzenia.

import { MenuWidoku } from '../widok.js';
import { Linijki } from '../linijki.js';
import { Dane } from '../dane.js';
import { PanelWarstw } from '../warstwy.js';
import { PanelWlasciwosci } from '../wlasciwosci.js';
import { Instrukcja } from '../instrukcja.js';
import { $, powiadom } from '../ui.js';
import { Podglad } from '../podglad.js';
import { odepnijStyl, zastosujStylWProjekcie } from '../style-tekstu.js';
import { edytor, stan, biezacaStrona } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, odlaczPlotno } from './zapis.js';
import { doEdycji } from './podglad-ekran.js';
import { panelWzorca, panelStrony, polaDoWstawienia, tabelaStrony } from './panel-strony.js';
import { generujMiniatury } from './lista-stron.js';

export const instrukcja = new Instrukcja();
export const panel = new PanelWlasciwosci($('#wlasciwosci'), $('#tytul-wlasciwosci'), edytor, {
  tytulPusty: () => (stan.tryb === 'wzorzec' ? 'Wzorzec' : 'Strona'),
  budujPusty: (p) => (stan.tryb === 'wzorzec' ? panelWzorca(p) : panelStrony(p)),
  // Dodatkowe ustawienia elementu zależne od tego, co edytujemy.
  dodatkiElementu: (p, obj, sekcja) => {
    if (stan.tryb !== 'wzorzec') return;
    sekcja.append(p.przelacznik('Nad treścią strony (domyślnie pod)', () => obj.warstwa === 'nad', (v) => { obj.warstwa = v ? 'nad' : undefined; }));
  },
  style: () => stan.projekt?.style || [],
  pola: () => polaDoWstawienia(),
  kolumnyObrazu: () => (stan.tryb === 'strona' ? tabelaStrony(biezacaStrona())?.kolumny : stan.projekt.tabele.flatMap((t) => t.kolumny)) || [],
  wgrajObrazy: () => $('#pliki-zasoby').click(),
  poZmianieStyli: (zmiana) => poZmianieStyli(zmiana),
});

// zmiana: null (styl tylko przypisany), styl (zaktualizowany – przepisz do
// wszystkich tekstów projektu) albo { usuniety: id }.
async function poZmianieStyli(zmiana) {
  const { projekt } = stan;
  if (!zmiana) { edytor.zatwierdz(); panel.odswiez(); return; }
  const zaznaczony = edytor.aktywny?.id;
  zapiszBiezacyCel();
  if (zmiana.usuniety) odepnijStyl(projekt, zmiana.usuniety);
  else {
    const n = zastosujStylWProjekcie(projekt, zmiana);
    powiadom(`Styl „${zmiana.nazwa}” zaktualizowany${n > 1 ? ` – zmieniono ${n} teksty w projekcie` : ''}.`);
  }
  stan.miniatury.clear();
  await zaladujCel();
  if (zaznaczony) edytor.zaznacz(zaznaczony);
  zaplanujZapis();
}

// Siatka, przyciąganie, linijki – ustawienia projektu zmieniane z menu przy płótnie.
export const linijki = new Linijki(edytor, $('#obszar-roboczy'));
export const panelWarstw = new PanelWarstw($('#lista-warstw'), edytor);
export const menuWidoku = new MenuWidoku({
  widok: () => stan.projekt?.widok,
  poZmianie: (widok) => { edytor.ustawWidok(widok); linijki.ustaw(widok.linijki); zaplanujZapis(); },
});

// Dane: tabele i serie. Po zmianie danych strony trzeba narysować od nowa.
export const dane = new Dane({
  projekt: () => stan.projekt,
  // Okna danych zmieniają projekt bezpośrednio (np. nazwę pola we wszystkich
  // tekstach), więc płótno najpierw oddaje swoją treść i zostaje odłączone –
  // inaczej automatyczny zapis nadpisałby te zmiany starą treścią płótna.
  przedOtwarciem: () => { zapiszBiezacyCel(); odlaczPlotno(); },
  poZmianie: () => { stan.miniatury.clear(); zaplanujZapis(); },
  poZamknieciu: async () => {
    if (!stan.projekt) return;
    await zaladujCel();
    panel.zbuduj();
    generujMiniatury();
  },
});

// ---------- Podgląd bez edycji ----------

export const podglad = new Podglad({
  naKlik: (idStrony) => doEdycji(idStrony),
});
