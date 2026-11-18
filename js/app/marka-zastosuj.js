// „Zastosuj markę do projektu” (#131D): kolory i czcionki projektu → kolory i czcionki marki, z podglądem
// (para „było → będzie” dla każdego koloru i czcionki) i jednym krokiem cofania. Rzecz całego projektu –
// w menu ⋯ projektu i w Bibliotece (kategoria „Marka”).

import { uzyteKolory, uzyteCzcionki } from '../kontrolki.js';
import {
  biezacaMarka, wczytajMarke, markaPusta, propozycjaMapowania, zastosujMapowanie, koloryDodatkoweZMarki, zastosujStyleMarki,
  listaZestawow, idZestawuMarki, zestawMarki, powiadomOZmianieZestawu,
} from '../zestaw-marki.js';
import { zastosujStylWProjekcie } from '../style-tekstu.js';
import { uid } from '../projekt.js';
import { $, powiadom } from '../ui.js';
import { stan, edytor } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { panel } from './skladniki.js';

const dlg = $('#dlg-marka-zastosuj');
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);
let mapa = null;
let wybrany = null; // id zestawu do zastosowania (#211)
const marka = () => (wybrany && zestawMarki(wybrany)) || biezacaMarka();

function wierszKoloru(kolor, ile, marka) {
  const li = document.createElement('li');
  const opcje = [`<option value="${kolor}">bez zmian</option>`, ...marka.kolory.map((k) => `<option value="${k.kolor}">${esc(k.nazwa || k.kolor)}</option>`)].join('');
  li.innerHTML = `<span class="probka" style="background:${kolor}"></span><span class="ciche">${kolor} · ${ile}×</span><span aria-hidden="true">→</span>
    <span class="probka po"></span><select aria-label="Kolor marki dla ${kolor}">${opcje}</select>`;
  const sel = li.querySelector('select');
  const po = li.querySelector('.probka.po');
  sel.value = mapa.kolory[kolor] || kolor;
  const ustaw = () => { mapa.kolory[kolor] = sel.value; po.style.background = sel.value; };
  sel.addEventListener('change', ustaw);
  ustaw();
  return li;
}

function wierszCzcionki(nazwa, ile, marka) {
  const li = document.createElement('li');
  const cele = [...new Set([marka.czcionki.naglowek, marka.czcionki.tekst].filter(Boolean))];
  li.innerHTML = `<span class="czcionka-proba" style="font-family:'${esc(nazwa)}'">Aa</span><span>${esc(nazwa)} <span class="ciche">· ${ile}×</span></span><span aria-hidden="true">→</span>
    <select aria-label="Czcionka marki dla ${esc(nazwa)}"><option value="${esc(nazwa)}">bez zmian</option>${cele.map((c) => `<option value="${esc(c)}">${esc(c)}${c === marka.czcionki.naglowek ? ' (nagłówki)' : ' (tekst)'}</option>`).join('')}</select>`;
  const sel = li.querySelector('select');
  sel.value = mapa.czcionki[nazwa] || nazwa;
  sel.addEventListener('change', () => { mapa.czcionki[nazwa] = sel.value; });
  return li;
}

export async function otworzZastosowanieMarki() {
  await wczytajMarke();
  const zestawy = listaZestawow();
  wybrany = idZestawuMarki();
  const sel = $('#marka-zastosuj-zestaw');
  sel.innerHTML = zestawy.map((z) => `<option value="${esc(z.id)}">${esc(z.nazwa)}${z.pusty ? ' (pusty)' : ''}</option>`).join('');
  sel.value = wybrany || '';
  $('#marka-zastosuj-zestaw-pole').hidden = zestawy.length < 2;
  if (markaPusta(marka()) && !zestawy.some((z) => !z.pusty)) {
    powiadom('Zestaw marki jest pusty – dodaj kolory, czcionki i style tekstu w Ustawieniach konta → Zestaw marki.', true);
    (await import('../marka-okno.js')).otworzMarke();
    return;
  }
  zapiszBiezacyCel();
  rysujMapowanie();
  if (!dlg.open) dlg.showModal();
}

// Mapowanie dla wybranego zestawu – od nowa przy zmianie zestawu.
function rysujMapowanie() {
  const marka = zestawMarki(wybrany) || biezacaMarka();
  const kolory = uzyteKolory(stan.projekt, 24);
  const czcionki = uzyteCzcionki(stan.projekt);
  mapa = propozycjaMapowania(kolory, czcionki, marka);
  $('#marka-mapa-kolory').replaceChildren(...kolory.map((k) => wierszKoloru(k.kolor, k.ile, marka)));
  $('#marka-mapa-czcionki').replaceChildren(...czcionki.map((c) => wierszCzcionki(c.nazwa, c.ile, marka)));
  $('#marka-mapa-kolory').closest('fieldset').hidden = !kolory.length || !marka.kolory.length;
  $('#marka-mapa-czcionki').closest('fieldset').hidden = !czcionki.length || !(marka.czcionki.naglowek || marka.czcionki.tekst);
  $('#marka-zastosuj-opis').textContent = 'Podpowiedź: każdy kolor dostał najbliższy kolor marki, najczęstsza czcionka – czcionkę tekstu, pozostałe – czcionkę nagłówków. Zmienisz to na listach.';
  // Style tekstu marki (#167): które zaktualizują styl projektu o tej samej nazwie, a które dojdą.
  const klucz = (t) => String(t || '').trim().toLocaleLowerCase('pl');
  const istniejace = new Set((stan.projekt.style || []).map((s) => klucz(s.nazwa)));
  $('#marka-mapa-style').closest('fieldset').hidden = !marka.style.length;
  $('#marka-style-tak').checked = true;
  $('#marka-mapa-style').replaceChildren(...marka.style.map((s) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="czcionka-proba" style="font-family:'${esc(s.czcionka)}';color:${esc(s.kolor)}">Aa</span><span>${esc(s.nazwa)} <span class="ciche">· ${esc(s.czcionka)} ${String(s.rozmiar).replace('.', ',')} pt</span></span><span class="ciche">${istniejace.has(klucz(s.nazwa)) ? 'zaktualizuje styl projektu' : 'nowy styl'}</span>`;
    return li;
  }));
  $('#marka-zastosuj-ok').disabled = markaPusta(marka);
}
$('#marka-zastosuj-zestaw').addEventListener('change', (e) => { wybrany = e.target.value; rysujMapowanie(); });

async function zastosuj() {
  zapiszBiezacyCel();
  const p = stan.projekt;
  let n = zastosujMapowanie(p, mapa);
  // Style tekstu marki → style projektu (te same nazwy – aktualizacja z zachowaniem powiązań, reszta dochodzi).
  if ($('#marka-style-tak').checked && marka().style.length) {
    const { dodane, zmienione } = zastosujStyleMarki(p, marka(), () => uid('st'));
    for (const st of zmienione) zastosujStylWProjekcie(p, st);
    n += dodane.length + zmienione.length;
  }
  // Kolory marki z CMYK (Pantone) trafiają do kolorów dodatkowych projektu (#127) – osobne płyty w PDF.
  const spoty = koloryDodatkoweZMarki(marka());
  // Projekt zapamiętuje zestaw – to jego marka w wyborze koloru, czcionkach i Bibliotece (#211).
  if (wybrany && p.zestaw_marki !== wybrany) { p.zestaw_marki = wybrany; n += 1; powiadomOZmianieZestawu(); }
  if (spoty.length) {
    p.kolory_dodatkowe = [...(p.kolory_dodatkowe || [])];
    for (const s of spoty) if (!p.kolory_dodatkowe.some((x) => x.nazwa === s.nazwa)) p.kolory_dodatkowe.push(s);
  }
  if (!n) { powiadom('Nic się nie zmieniło – wszystko zostało „bez zmian”.'); return; }
  stan.miniatury.clear();
  await zaladujCel();
  if (!edytor.aktywny) panel.zbuduj();
  zaplanujZapis();
  powiadom(`Zastosowano markę: ${n} ${n === 1 ? 'zmiana' : 'zmian'} kolorów, czcionek i stylów.`, false, { etykieta: 'Cofnij', fn: () => cofnijKrok(-1) });
}

dlg.addEventListener('close', () => { if (dlg.returnValue === 'ok') zastosuj(); dlg.returnValue = ''; });
