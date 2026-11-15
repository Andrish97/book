// Okno „Podgląd separacji” (#131C): strona z podglądu rozbita na płyty druku – C, M, Y, K, kolory dodatkowe
// i uszlachetnienia (#127) – z przełączaniem płyt, jedną płytą w szarości, nadrukiem uszlachetnień
// i zaznaczeniem łącznego pokrycia farbą powyżej limitu (TAC). Rdzeń obliczeń: js/separacje.js.

import { $ } from '../ui.js';
import { rozwin } from '../serie.js';
import { naPlotnieCelu } from '../zlozenie.js';
import { spotyDruku, mapaSpotow, uzyteKoloryDruku, stanUszlachetnien, cmykNaRgb } from '../kolory-druku.js';
import { rozbij, obrazPlyt, maskaZRoznicy, PLYTY_CMYK, ustawSilnikTac } from '../separacje.js';
import { wczytajWarunki } from '../pdf-x.js';

const SZEROKOSC = 900; // px – obraz strony do rozbicia (wystarcza do oceny, liczy się szybko)
const dlg = $('#dlg-separacje');
const plotno = $('#separacje-plotno');
let stan = null; // { projekt, ciag, i, rozbite, kolory, wlaczone, uszl:Set }
let liczy = 0;

// Umowne kolory płyt uszlachetnień na podglądzie.
const KOLOR_USZL = { Spot_UV: [80, 170, 255], Foil_Gold: [212, 175, 55], Foil_Silver: [168, 172, 178], Foil_Copper: [184, 115, 72], Emboss: [140, 120, 100], Debossing: [140, 120, 100], White: [180, 190, 205] };

async function przelicznik() {
  const id = $('#separacje-profil').value;
  if (!id) { ustawSilnikTac(null); return undefined; }
  const s = (await wczytajWarunki(id)).silnik();
  ustawSilnikTac(s); // „Sprawdź przed drukiem” liczy pokrycie farbą tym samym profilem
  return (k) => s.wektor(k[0], k[1], k[2]);
}

// Obraz strony i maski uszlachetnień → płyty.
async function przelicz() {
  const nr = ++liczy;
  const { projekt, ciag } = stan;
  const egz = ciag.egzemplarze[stan.i];
  $('#separacje-numer').textContent = `Strona ${stan.i + 1} z ${ciag.egzemplarze.length}`;
  $('#separacje-wynik').textContent = 'Liczę płyty…';
  const odczyt = (p) => p.getContext().getImageData(0, 0, p.getWidth(), p.getHeight());
  const opcje = { szerokoscPx: SZEROKOSC, spad: true, ciag, oryginaly: false };
  // Strona bez efektów uszlachetnień (to nie farba) – sama farba CMYK i kolory dodatkowe.
  stanUszlachetnien.eksport = true;
  let obraz;
  try { obraz = await naPlotnieCelu(projekt, egz, opcje, (p) => odczyt(p)); } finally { stanUszlachetnien.eksport = false; }
  const maski = new Map();
  for (const u of uzyteKoloryDruku(projekt).uszlachetnienia) {
    stanUszlachetnien.maska = u.plyta;
    try {
      const d = await naPlotnieCelu(projekt, egz, opcje, (p) => {
        const tlo = p.backgroundColor;
        p.backgroundColor = '#ffffff';
        p.renderAll();
        const wynik = odczyt(p);
        p.backgroundColor = tlo;
        return wynik;
      });
      maski.set(u.plyta, maskaZRoznicy(d.data, d.width, d.height));
    } finally { stanUszlachetnien.maska = null; }
  }
  if (nr !== liczy) return;
  const spoty = new Map();
  for (const [hex, s] of mapaSpotow(spotyDruku(projekt))) spoty.set(hex, { nazwa: s.nazwa, odcien: s.t });
  const limit = Number($('#separacje-limit').value) || 300;
  stan.rozbite = rozbij(obraz.data, obraz.width, obraz.height, { spoty, maski, limit, przelicz: await przelicznik() });
  if (nr !== liczy) return;
  // Kolory płyt: farby CMYK, spoty z zapasu CMYK, uszlachetnienia – umowne.
  const kolory = new Map(PLYTY_CMYK.map((p) => [p.id, p.kolor]));
  for (const s of spotyDruku(projekt)) kolory.set(s.nazwa, cmykNaRgb(s.cmyk || [0, 0, 0, 100]));
  const uszl = new Set();
  for (const u of uzyteKoloryDruku(projekt).uszlachetnienia) {
    kolory.set(u.plyta, KOLOR_USZL[u.plyta] || [80, 170, 255]);
    uszl.add(u.plyta);
  }
  stan.kolory = kolory;
  stan.uszl = uszl;
  if (!stan.wlaczone) stan.wlaczone = new Set(stan.rozbite.plyty.keys());
  for (const id of stan.rozbite.plyty.keys()) if (!stan.znane?.has(id)) stan.wlaczone.add(id);
  stan.znane = new Set(stan.rozbite.plyty.keys());
  pokazListe();
  rysuj();
}

function pokazListe() {
  const lista = $('#separacje-plyty');
  const { rozbite, kolory, uszl } = stan;
  lista.replaceChildren(...[...rozbite.plyty.keys()].map((id) => {
    const l = document.createElement('label');
    l.className = 'przelacznik plyta';
    const k = kolory.get(id) || [0, 0, 0];
    const nazwa = PLYTY_CMYK.find((p) => p.id === id)?.nazwa || id;
    l.innerHTML = `<input type="checkbox" value="${id}"><span class="probka-plyty" style="background: rgb(${k.join(',')})"></span><span></span>`;
    l.querySelector('span:last-child').textContent = uszl.has(id) ? `${nazwa} (uszlachetnienie, nadruk)` : nazwa;
    const pole = l.querySelector('input');
    pole.checked = stan.wlaczone.has(id);
    pole.addEventListener('change', () => { if (pole.checked) stan.wlaczone.add(id); else stan.wlaczone.delete(id); rysuj(); });
    return l;
  }));
}

function rysuj() {
  const { rozbite } = stan;
  if (!rozbite) return;
  const limit = Number($('#separacje-limit').value) || 300;
  const piksele = obrazPlyt(rozbite, {
    wlaczone: stan.wlaczone, kolory: stan.kolory, jedna: $('#separacje-jedna').checked,
    tac: $('#separacje-tac').checked ? limit : null,
    nadruk: $('#separacje-nadruk').checked ? stan.uszl : new Set(),
  });
  plotno.width = rozbite.w; plotno.height = rozbite.h;
  plotno.getContext("2d").putImageData(new window.ImageData(piksele, rozbite.w, rozbite.h), 0, 0);
  const ponad = [...rozbite.tac].filter((v) => v > limit + 0.5).length;
  const procent = (ponad / (rozbite.w * rozbite.h)) * 100;
  $('#separacje-wynik').textContent = `Największe pokrycie farbą na tej stronie: ${rozbite.tacMax}%.${ponad ? ` Ponad ${limit}%: ${procent < 0.1 ? 'pojedyncze miejsca' : `${procent.toFixed(1).replace('.', ',')}% strony`} – drukarnia może prosić o jaśniejsze kolory albo czerń bez domieszek.` : ` Mieści się w limicie ${limit}%.`}`;
}

// Otwiera okno na stronie o kluczu `klucz` (egzemplarz widoczny w podglądzie).
export function otworzSeparacje(projekt, klucz = null) {
  const ciag = rozwin(projekt);
  const i = Math.max(0, ciag.egzemplarze.findIndex((e) => e.klucz === klucz));
  stan = { projekt, ciag, i, rozbite: null, wlaczone: null };
  if (!dlg.open) dlg.showModal();
  przelicz().catch((e) => { $('#separacje-wynik').textContent = `Nie udało się policzyć płyt: ${e.message}`; });
}
export const zamknijSeparacje = () => dlg.close();
// Stan okna – dla testów.
export const stanSeparacji = () => stan;

const krok = (d) => {
  if (!stan) return;
  const n = stan.ciag.egzemplarze.length;
  stan.i = (stan.i + d + n) % n;
  przelicz().catch(() => {});
};
$('#separacje-poprzednia').addEventListener('click', () => krok(-1));
$('#separacje-nastepna').addEventListener('click', () => krok(1));
for (const id of ['#separacje-jedna', '#separacje-nadruk', '#separacje-tac', '#separacje-limit']) $(id).addEventListener('input', () => rysuj());
$('#separacje-profil').addEventListener('change', () => { if (stan) przelicz().catch((e) => { $('#separacje-wynik').textContent = e.message; }); });
dlg.addEventListener('close', () => { stan = null; liczy += 1; });
