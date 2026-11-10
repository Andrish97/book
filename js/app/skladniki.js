// Stałe części ekranu edytora, tworzone raz przy starcie: panel właściwości, linijki, panel warstw, menu widoku,
// okno danych i podgląd. Dostają funkcje z pozostałych modułów jako reakcje na zdarzenia.

import { MenuWidoku } from '../widok.js';
import { Linijki } from '../linijki.js';
import { Dane } from '../dane.js';
import { PanelWarstw } from '../warstwy.js';
import { PanelWlasciwosci } from '../wlasciwosci.js';
import { Instrukcja } from '../instrukcja.js';
import { OknoCzcionek } from '../okno-czcionek.js';
import { rodzinyCzcionek } from '../czcionki.js';
import { uzgodnijZKontem, rodzinySpozaProjektu, poznaj } from '../moje-czcionki.js';
import { uid } from '../projekt.js';
import * as chmura from '../chmura.js';
import { $, powiadom } from '../ui.js';
import { Podglad } from '../podglad.js';
import { odepnijStyl, zastosujStylWProjekcie } from '../style-tekstu.js';
import { edytor, stan, biezacaStrona, wlasciciel } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, odlaczPlotno } from './zapis.js';
import { doEdycji } from './podglad-ekran.js';
import { panelWzorca, panelStrony, polaDoWstawienia, tabelaStrony } from './panel-strony.js';
import { generujMiniatury } from './lista-stron.js';
import { edytujWzorzec } from './wzorce.js';

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
  czcionki: () => { const { wlasne, wbudowane } = rodzinyCzcionek(stan.projekt); return [...wlasne, ...wbudowane]; },
  wgrajCzcionke: () => oknoCzcionek.wybierzPliki(),
  mojeCzcionki: () => stan.mojeRodziny || [],
  dodajMojaCzcionke: (rodzina) => oknoCzcionek.dodajZMoich(rodzina),
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
// Własne czcionki projektu. Po zmianie strona wczytuje się od nowa (tekst trzeba zmierzyć nową czcionką),
// a zaznaczony tekst dostaje właśnie wgraną czcionkę.
export const oknoCzcionek = new OknoCzcionek({
  projekt: () => stan.projekt,
  wlasciciel: () => wlasciciel(),
  poZmianieZbioru: () => odswiezMojeCzcionki({ zKontem: true }),
  przedZmiana: () => zapiszBiezacyCel(),
  poZmianie: async (rodzina) => {
    const zaznaczony = edytor.aktywny?.type === 'textbox' ? edytor.aktywny.id : null;
    if (zaznaczony && rodzina) {
      const { projekt } = stan;
      const znajdz = (obiekty) => { for (const o of obiekty || []) { if (o.id === zaznaczony) return o; const w = znajdz(o.objects); if (w) return w; } return null; };
      const o = [...projekt.strony, ...projekt.wzorce].map((c) => znajdz(c.obiekty)).find(Boolean);
      if (o) o.fontFamily = rodzina;
    }
    odlaczPlotno();
    stan.miniatury.clear();
    await zaladujCel();
    if (zaznaczony) edytor.zaznacz(zaznaczony);
    panel.zbuduj();
    generujMiniatury();
    zaplanujZapis();
  },
});

export const linijki = new Linijki(edytor, $('#obszar-roboczy'));
export const panelWarstw = new PanelWarstw($('#lista-warstw'), edytor, { doWzorca: (id) => edytujWzorzec(id) });
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

// „Moje czcionki”: czcionki wgrane w innych projektach. Lista rodzin spoza otwartego projektu
// trafia do listy czcionek w panelu; przy pracy z kontem zbiór jest uzgadniany z kontem.
// Wywołania idą jedno po drugim, żeby dwa uzgodnienia nie wysłały tego samego pliku.
let kolejkaCzcionek = Promise.resolve();
export function odswiezMojeCzcionki({ zKontem = false, projekt = null } = {}) {
  kolejkaCzcionek = kolejkaCzcionek.then(async () => {
    const kto = wlasciciel();
    try {
      if (projekt && await poznaj(kto, projekt)) zKontem = true;
      if (zKontem && stan.uzytkownik) await uzgodnijZKontem(kto, await chmura.kontoCzcionek(), uid);
    } catch { /* bez połączenia zbiór zostaje na urządzeniu i uzgodni się następnym razem */ }
    const przedtem = JSON.stringify(stan.mojeRodziny || []);
    try { stan.mojeRodziny = stan.projekt ? await rodzinySpozaProjektu(kto, stan.projekt) : []; } catch { stan.mojeRodziny = []; }
    if (oknoCzcionek.okno.open) oknoCzcionek.rysuj();
    // Lista czcionek w panelu tekstu ma nowe pozycje – ale nie w trakcie pisania.
    if (przedtem !== JSON.stringify(stan.mojeRodziny) && edytor.aktywny?.type === 'textbox' && !edytor.aktywny.isEditing) panel.zbuduj();
  });
  return kolejkaCzcionek;
}
