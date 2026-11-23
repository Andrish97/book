// Okno „Kolory projektu” (decyzje #127, #167): kolory użyte w projekcie (zamiana jednym kliknięciem), tryb
// kolorów w druku (pełny kolor, skala szarości, cz/b + 1 kolor), kolory dodatkowe (spot) i przegląd wykończeń
// druku. Kolory w projekcie i tryb druku ustawia się dla całego projektu albo dla jednej sekcji („Dotyczy”):
// np. okładka w pełnym kolorze, a środek czarno-biały. Sekcja bez własnego trybu drukuje się jak projekt.

import { $, potwierdz, powiadom } from '../ui.js';
import { ikona } from '../ikony.js';
import { stan } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { panel } from './skladniki.js';
import {
  TRYBY_KOLOROW, hexSpotu, koloryDodatkowe, trybKolorow, koloryPozaTrybem, najblizszyDozwolony, przekolorujProjekt, zmienZapasSpotu,
  koloryWZakresie, zamienKolorWZakresie, mapaSpotow, uzyteKoloryDruku, sekcjaBiezaca,
} from '../kolory-druku.js';
import { wpiszNazwe, t as tt } from '../jezyk.js';

const dlg = $('#dlg-kolory-druku');
const OPISY = {
  pelny: 'Cztery farby CMYK i – jeśli są – kolory dodatkowe na osobnych płytach.',
  szarosc: 'Wszystko jedną czarną farbą: kolory i zdjęcia idą w PDF jako odcienie czerni.',
  czb1: 'Czerń i jeden kolor dodatkowy, np. kalendarz czarno-biały z czerwonymi niedzielami. Pozostałe kolory idą odcieniami czerni.',
};

// Zakres okna: 'projekt' albo id sekcji.
let zakres = 'projekt';
const sekcjaZakresu = () => (zakres === 'projekt' ? null : stan.projekt?.sekcje.find((s) => s.id === zakres) || null);

// Zmiana projektu z okna: płótno oddaje treść, projekt się zmienia, płótno wczytuje się od nowa (kolory elementów).
async function zmien(fn) {
  zapiszBiezacyCel();
  const wynik = fn(stan.projekt);
  stan.miniatury.clear();
  await zaladujCel();
  panel.zbuduj();
  zaplanujZapis();
  rysuj();
  return wynik;
}

function rysujZakres() {
  const p = stan.projekt;
  const sel = $('#kolory-zakres');
  const opcje = [new Option('Cały projekt', 'projekt'), ...p.sekcje.map((s) => new Option(tt('koloryDrukuOkno.sekcja', { nazwa: s.nazwa, x: s.tryb_kolorow ? tt('koloryDrukuOkno.wlasnyDrukKolorow') : '' }), s.id))];
  sel.replaceChildren(...opcje);
  if (zakres !== 'projekt' && !p.sekcje.some((s) => s.id === zakres)) zakres = 'projekt';
  sel.value = zakres;
  $('#kolory-zakres-pole').hidden = p.sekcje.length < 2 && zakres === 'projekt';
}

function rysujUzyte() {
  const p = stan.projekt;
  const sek = sekcjaZakresu();
  $('#kolory-uzyte-tytul').textContent = sek ? tt('koloryDrukuOkno.koloryWSekcji', { nazwa: sek.nazwa }) : tt('koloryDrukuOkno.koloryWProjekcie');
  const uzyte = koloryWZakresie(p, zakres);
  const spoty = mapaSpotow(koloryDodatkowe(p));
  $('#kolory-uzyte-opis').textContent = uzyte.length
    ? (sek ? tt('koloryDrukuOkno.kliknijKolorZebyZamienic2') : tt('koloryDrukuOkno.kliknijKolorZebyZamienic'))
    : (sek ? tt('koloryDrukuOkno.naStronachTejSekcji') : tt('koloryDrukuOkno.wProjekcieNieMa'));
  $('#kolory-uzyte').replaceChildren(...uzyte.slice(0, 40).map(({ kolor, ile }) => {
    const li = document.createElement('li');
    const spot = spoty.get(kolor);
    const nazwa = spot ? `${spot.nazwa}${spot.t < 1 ? ` ${Math.round(spot.t * 100)}%` : ''}` : kolor;
    li.innerHTML = `<label class="uzyty-kolor"><input type="color"><span class="uzyty-opis"><b></b><small></small></span></label>`;
    const inp = li.querySelector('input');
    inp.value = kolor;
    inp.setAttribute('aria-label', tt('koloryDrukuOkno.zamienKolor', { nazwa }));
    wpiszNazwe(li.querySelector('b'), nazwa);
    li.querySelector('small').textContent = `${ile} ${ile === 1 ? 'raz' : 'razy'}`;
    inp.addEventListener('change', async () => {
      const nowy = inp.value;
      const n = await zmien((proj) => zamienKolorWZakresie(proj, zakres, kolor, nowy));
      if (n) powiadom(tt('koloryDrukuOkno.zamienionoKolorW', { n, x: n === 1 ? 'miejscu' : 'miejscach' }), false, { etykieta: tt('koloryDrukuOkno.cofnij'), fn: () => cofnijKrok(-1) });
    });
    return li;
  }));
}

function rysujTryb() {
  const p = stan.projekt;
  const sek = sekcjaZakresu();
  const wlasny = sek ? sek.tryb_kolorow || null : null;
  const tryb = trybKolorow(p, sek);
  $('#kolory-tryb-dziedzicz').hidden = !sek;
  const zaznaczony = sek && !wlasny ? 'dziedzicz' : tryb;
  for (const r of dlg.querySelectorAll('input[name="tryb-kolorow"]')) r.checked = r.value === zaznaczony;
  const dziedziczony = sek && !wlasny ? tt('kod.koloryDruku.jakWProjekcie', { tryb: tt(TRYBY_KOLOROW.find((x) => x.id === trybKolorow(p)).nazwa).toLowerCase() }) : '';
  $('#kolory-tryb-opis').textContent = OPISY[tryb] + dziedziczony;
  const spoty = koloryDodatkowe(p);
  const pole = $('#kolory-tryb-spot-pole');
  pole.hidden = tryb !== 'czb1' || (sek && !wlasny);
  const sel = $('#kolory-tryb-spot');
  sel.replaceChildren(...(spoty.length ? spoty.map((s) => new Option(s.nazwa, s.id)) : [new Option('Najpierw dodaj kolor dodatkowy', '')]));
  sel.value = (sek ? sek.kolor_trybu : p.kolor_trybu) || '';
  sel.disabled = !spoty.length;
  const zle = koloryPozaTrybem(p);
  $('#kolory-tryb-zle').hidden = !zle.length;
  $('#kolory-tryb-zle-opis').textContent = tt('koloryDrukuOkno.doTrybuDrukuPojda', { zleIle: zle.length, x: zle.length === 1 ? tt('koloryDrukuOkno.kolorNiePasuje') : tt('koloryDrukuOkno.kolorowNiePasuje') });
}

function rysujSpoty() {
  const p = stan.projekt;
  const spoty = koloryDodatkowe(p);
  const lista = $('#kolory-lista');
  lista.replaceChildren(...spoty.map((s) => {
    const li = document.createElement('li');
    li.className = 'spot';
    li.innerHTML = `<span class="probka-spotu" aria-hidden="true"></span>
      <label class="pole nazwa-spotu"><span>${tt('koloryDrukuOkno.nazwa')}</span><input type="text" maxlength="60" spellcheck="false"></label>
      ${['C', 'M', 'Y', 'K'].map((k, j) => `<label class="pole cmyk"><span>${k}</span><input type="number" min="0" max="100" step="1" inputmode="decimal" data-j="${j}"></label>`).join('')}
      <button type="button" class="przycisk-ikona niebezpieczny-ikona" title="${tt('koloryDrukuOkno.usunKolorDodatkowy')}" aria-label="Usuń kolor ${s.nazwa}">${ikona('kosz', { rozmiar: 18 })}</button>`;
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
      if (!await potwierdz(tt('koloryDrukuOkno.usunacKolorDodatkowy'), tt('koloryDrukuOkno.elementyWKolorzeZostana', { nazwa: s.nazwa }), tt('koloryDrukuOkno.usun'), true)) return;
      zmien((proj) => {
        proj.kolory_dodatkowe = koloryDodatkowe(proj).filter((x) => x !== s);
        if (proj.kolor_trybu === s.id) proj.kolor_trybu = proj.kolory_dodatkowe[0]?.id || null;
        for (const sek of proj.sekcje) if (sek.kolor_trybu === s.id) sek.kolor_trybu = proj.kolory_dodatkowe[0]?.id || null;
      });
    });
    return li;
  }));
}

function rysujWykonczenia() {
  const { uszlachetnienia } = uzyteKoloryDruku(stan.projekt);
  const lista = $('#kolory-wykonczenia');
  if (!uszlachetnienia.length) {
    const li = document.createElement('li');
    li.className = 'ciche';
    li.textContent = tt('koloryDrukuOkno.naRazieBezWykonczen');
    lista.replaceChildren(li);
    return;
  }
  lista.replaceChildren(...uszlachetnienia.map((u) => {
    const li = document.createElement('li');
    li.innerHTML = '<b></b> <span class="ciche"></span>';
    li.querySelector('b').textContent = u.etykieta;
    li.querySelector('span').textContent = tt('koloryDrukuOkno.plytaWPdf', { ile: u.ile, x: u.ile === 1 ? tt('koloryDrukuOkno.element') : (u.ile < 5 ? tt('koloryDrukuOkno.elementy') : tt('koloryDrukuOkno.elementow')), plyta: u.plyta });
    return li;
  }));
}

function rysuj() {
  if (!stan.projekt) return;
  rysujZakres();
  rysujUzyte();
  rysujTryb();
  rysujSpoty();
  rysujWykonczenia();
}

dlg.addEventListener('change', (e) => {
  if (e.target.id === 'kolory-zakres') { zakres = e.target.value; rysuj(); return; }
  if (e.target.name === 'tryb-kolorow') {
    const v = e.target.value;
    zmien((p) => {
      const sek = sekcjaZakresu();
      if (sek) {
        if (v === 'dziedzicz') { delete sek.tryb_kolorow; delete sek.kolor_trybu; return; }
        sek.tryb_kolorow = v;
        if (v === 'czb1') sek.kolor_trybu = sek.kolor_trybu || p.kolor_trybu || koloryDodatkowe(p)[0]?.id || null;
        else delete sek.kolor_trybu;
        return;
      }
      p.tryb_kolorow = v;
      if (p.tryb_kolorow === 'czb1' && !p.kolor_trybu) p.kolor_trybu = koloryDodatkowe(p)[0]?.id || null;
    });
  }
  if (e.target.id === 'kolory-tryb-spot') {
    zmien((p) => { const sek = sekcjaZakresu(); if (sek) sek.kolor_trybu = e.target.value || null; else p.kolor_trybu = e.target.value || null; });
  }
});
$('#kolory-dodaj').addEventListener('click', () => zmien((p) => {
  const n = koloryDodatkowe(p).length + 1;
  p.kolory_dodatkowe = [...koloryDodatkowe(p), { id: `kd${Date.now().toString(36)}`, nazwa: `PANTONE ${n === 1 ? '186 C' : `kolor ${n}`}`, cmyk: [0, 100, 81, 4] }];
  if (p.tryb_kolorow === 'czb1' && !p.kolor_trybu) p.kolor_trybu = p.kolory_dodatkowe[0].id;
}));
const naDozwolone = (p) => przekolorujProjekt(p, (k, sek) => najblizszyDozwolony(k, p, sek));
$('#kolory-tryb-zamien').addEventListener('click', () => zmien(naDozwolone));

// zakresStart: 'sekcja' – okno otwiera się na sekcji bieżącej strony (np. z podpowiedzi przy elemencie).
export function otworzKoloryDruku({ zakresStart = null } = {}) {
  if (!stan.projekt) return;
  if (!dlg.open) zakres = zakresStart === 'sekcja' && stan.projekt.sekcje.length > 1 ? (sekcjaBiezaca(stan.projekt)?.id || 'projekt') : 'projekt';
  rysuj();
  if (!dlg.open) dlg.showModal();
}

// Naprawa z „Sprawdź przed drukiem”: kolory spoza trybu (projektu albo sekcji) → najbliższe dozwolone.
export function zamienKoloryNaDozwolone() {
  return zmien(naDozwolone);
}

// Pole koloru prosi o to okno („Kolory projektu…” w wyborze koloru).
document.addEventListener('makietka:kolory-druku', () => otworzKoloryDruku());
// Kolor dodatkowy dodany prosto z wyboru koloru albo z Właściwości – do zapisu projektu (#167).
document.addEventListener('makietka:kolor-dodatkowy', () => { zaplanujZapis(); if (dlg.open) rysuj(); });

export { TRYBY_KOLOROW };
