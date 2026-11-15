// „Zastosuj markę do projektu” (#131D): kolory i czcionki projektu → kolory i czcionki marki, z podglądem
// (para „było → będzie” dla każdego koloru i czcionki) i jednym krokiem cofania. Rzecz całego projektu –
// w menu ⋯ projektu i w Bibliotece (kategoria „Marka”).

import { uzyteKolory, uzyteCzcionki } from '../kontrolki.js';
import { biezacaMarka, wczytajMarke, markaPusta, propozycjaMapowania, zastosujMapowanie, koloryDodatkoweZMarki } from '../zestaw-marki.js';
import { $, powiadom } from '../ui.js';
import { stan, edytor } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { panel } from './skladniki.js';

const dlg = $('#dlg-marka-zastosuj');
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);
let mapa = null;

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
  const marka = biezacaMarka();
  if (markaPusta(marka)) {
    powiadom('Zestaw marki jest pusty – dodaj kolory i czcionki w Ustawieniach konta → Zestaw marki.', true);
    (await import('../marka-okno.js')).otworzMarke();
    return;
  }
  zapiszBiezacyCel();
  const kolory = uzyteKolory(stan.projekt, 24);
  const czcionki = uzyteCzcionki(stan.projekt);
  mapa = propozycjaMapowania(kolory, czcionki, marka);
  $('#marka-mapa-kolory').replaceChildren(...kolory.map((k) => wierszKoloru(k.kolor, k.ile, marka)));
  $('#marka-mapa-czcionki').replaceChildren(...czcionki.map((c) => wierszCzcionki(c.nazwa, c.ile, marka)));
  $('#marka-mapa-kolory').closest('fieldset').hidden = !kolory.length || !marka.kolory.length;
  $('#marka-mapa-czcionki').closest('fieldset').hidden = !czcionki.length || !(marka.czcionki.naglowek || marka.czcionki.tekst);
  $('#marka-zastosuj-opis').textContent = 'Podpowiedź: każdy kolor dostał najbliższy kolor marki, najczęstsza czcionka – czcionkę tekstu, pozostałe – czcionkę nagłówków. Zmienisz to na listach.';
  if (!dlg.open) dlg.showModal();
}

async function zastosuj() {
  zapiszBiezacyCel();
  const p = stan.projekt;
  const n = zastosujMapowanie(p, mapa);
  // Kolory marki z CMYK (Pantone) trafiają do kolorów dodatkowych projektu (#127) – osobne płyty w PDF.
  const spoty = koloryDodatkoweZMarki();
  if (spoty.length) {
    p.kolory_dodatkowe = [...(p.kolory_dodatkowe || [])];
    for (const s of spoty) if (!p.kolory_dodatkowe.some((x) => x.nazwa === s.nazwa)) p.kolory_dodatkowe.push(s);
  }
  if (!n) { powiadom('Nic się nie zmieniło – wszystko zostało „bez zmian”.'); return; }
  stan.miniatury.clear();
  await zaladujCel();
  if (!edytor.aktywny) panel.zbuduj();
  zaplanujZapis();
  powiadom(`Zastosowano markę: ${n} ${n === 1 ? 'zmiana' : 'zmian'} kolorów i czcionek.`, false, { etykieta: 'Cofnij', fn: () => cofnijKrok(-1) });
}

dlg.addEventListener('close', () => { if (dlg.returnValue === 'ok') zastosuj(); dlg.returnValue = ''; });
