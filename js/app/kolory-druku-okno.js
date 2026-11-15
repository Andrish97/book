// Okno „Kolory do druku” (decyzja #127): tryb kolorów projektu (pełny kolor, skala szarości, cz/b + 1 kolor)
// i lista kolorów dodatkowych (spot) – nazwa jak w drukarni i zapas CMYK do podglądu.

import { $, potwierdz } from '../ui.js';
import { ikona } from '../ikony.js';
import { stan } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis } from './zapis.js';
import { panel } from './skladniki.js';
import {
  TRYBY_KOLOROW, hexSpotu, koloryDodatkowe, trybKolorow, koloryPozaTrybem, najblizszyDozwolony, przekolorujProjekt, zmienZapasSpotu,
} from '../kolory-druku.js';

const dlg = $('#dlg-kolory-druku');
const OPISY = {
  pelny: 'Cztery farby CMYK i – jeśli są – kolory dodatkowe na osobnych płytach.',
  szarosc: 'Wszystko jedną czarną farbą: kolory i zdjęcia idą w PDF jako odcienie czerni.',
  czb1: 'Czerń i jeden kolor dodatkowy, np. kalendarz czarno-biały z czerwonymi niedzielami. Pozostałe kolory idą odcieniami czerni.',
};

// Zmiana projektu z okna: płótno oddaje treść, projekt się zmienia, płótno wczytuje się od nowa (kolory elementów).
async function zmien(fn) {
  zapiszBiezacyCel();
  fn(stan.projekt);
  stan.miniatury.clear();
  await zaladujCel();
  panel.zbuduj();
  zaplanujZapis();
  rysuj();
}

function rysuj() {
  const p = stan.projekt;
  if (!p) return;
  const tryb = trybKolorow(p);
  for (const r of dlg.querySelectorAll('input[name="tryb-kolorow"]')) r.checked = r.value === tryb;
  $('#kolory-tryb-opis').textContent = OPISY[tryb];
  const spoty = koloryDodatkowe(p);
  const pole = $('#kolory-tryb-spot-pole');
  pole.hidden = tryb !== 'czb1';
  const sel = $('#kolory-tryb-spot');
  sel.replaceChildren(...(spoty.length ? spoty.map((s) => new Option(s.nazwa, s.id)) : [new Option('Najpierw dodaj kolor dodatkowy', '')]));
  sel.value = p.kolor_trybu || '';
  sel.disabled = !spoty.length;
  const zle = koloryPozaTrybem(p);
  $('#kolory-tryb-zle').hidden = !zle.length;
  $('#kolory-tryb-zle-opis').textContent = `${zle.length} ${zle.length === 1 ? 'kolor nie pasuje' : 'kolorów nie pasuje'} do trybu.`;

  const lista = $('#kolory-lista');
  lista.replaceChildren(...spoty.map((s) => {
    const li = document.createElement('li');
    li.className = 'spot';
    li.innerHTML = `<span class="probka-spotu" aria-hidden="true"></span>
      <label class="pole nazwa-spotu"><span>Nazwa</span><input type="text" maxlength="60" spellcheck="false"></label>
      ${['C', 'M', 'Y', 'K'].map((k, j) => `<label class="pole cmyk"><span>${k}</span><input type="number" min="0" max="100" step="1" inputmode="decimal" data-j="${j}"></label>`).join('')}
      <button type="button" class="przycisk-ikona niebezpieczny-ikona" title="Usuń kolor dodatkowy" aria-label="Usuń kolor ${s.nazwa}">${ikona('kosz', { rozmiar: 18 })}</button>`;
    li.querySelector('.probka-spotu').style.background = hexSpotu(s, 1);
    const nazwa = li.querySelector('.nazwa-spotu input');
    nazwa.value = s.nazwa;
    nazwa.addEventListener('change', () => zmien(() => { s.nazwa = nazwa.value.trim().slice(0, 60) || s.nazwa; }));
    for (const inp of li.querySelectorAll('.cmyk input')) {
      inp.value = String(s.cmyk[inp.dataset.j]);
      inp.addEventListener('change', () => {
        const nowy = [...s.cmyk];
        nowy[inp.dataset.j] = Math.min(100, Math.max(0, Number(inp.value) || 0));
        zmien((proj) => zmienZapasSpotu(proj, s, nowy));
      });
    }
    li.querySelector('button').addEventListener('click', async () => {
      if (!await potwierdz('Usunąć kolor dodatkowy?', `Elementy w kolorze „${s.nazwa}” zostaną w zwykłym kolorze (CMYK) – bez osobnej płyty.`, 'Usuń', true)) return;
      zmien((proj) => { proj.kolory_dodatkowe = koloryDodatkowe(proj).filter((x) => x !== s); if (proj.kolor_trybu === s.id) proj.kolor_trybu = proj.kolory_dodatkowe[0]?.id || null; });
    });
    return li;
  }));
}

dlg.addEventListener('change', (e) => {
  if (e.target.name === 'tryb-kolorow') {
    zmien((p) => {
      p.tryb_kolorow = e.target.value;
      if (p.tryb_kolorow === 'czb1' && !p.kolor_trybu) p.kolor_trybu = koloryDodatkowe(p)[0]?.id || null;
    });
  }
  if (e.target.id === 'kolory-tryb-spot') zmien((p) => { p.kolor_trybu = e.target.value || null; });
});
$('#kolory-dodaj').addEventListener('click', () => zmien((p) => {
  const n = koloryDodatkowe(p).length + 1;
  p.kolory_dodatkowe = [...koloryDodatkowe(p), { id: `kd${Date.now().toString(36)}`, nazwa: `PANTONE ${n === 1 ? '186 C' : `kolor ${n}`}`, cmyk: [0, 100, 81, 4] }];
  if (p.tryb_kolorow === 'czb1' && !p.kolor_trybu) p.kolor_trybu = p.kolory_dodatkowe[0].id;
}));
$('#kolory-tryb-zamien').addEventListener('click', () => zmien((p) => przekolorujProjekt(p, (k) => najblizszyDozwolony(k, p))));

export function otworzKoloryDruku() {
  if (!stan.projekt) return;
  rysuj();
  if (!dlg.open) dlg.showModal();
}

// Naprawa z „Sprawdź przed drukiem”: kolory spoza trybu → najbliższe dozwolone.
export function zamienKoloryNaDozwolone() {
  return zmien((p) => przekolorujProjekt(p, (k) => najblizszyDozwolony(k, p)));
}

// Pole koloru prosi o to okno („Zarządzaj kolorami dodatkowymi…” w wyborze koloru).
document.addEventListener('makietka:kolory-druku', otworzKoloryDruku);

export { TRYBY_KOLOROW };
