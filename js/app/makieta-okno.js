// Okno „Makieta 3D” (#131D): projekt jako wydrukowana rzecz – książka, notes, kalendarz, kartka – z kartkowaniem,
// obracaniem myszą lub palcem, powiększaniem i zapisem obrazu PNG. Geometria i WebGL: js/makieta-3d.js.
// Okładka pochodzi z sekcji okładki (#119): tył, grzbiet i przód wycięte z jej strony według stref.
// #181: gotowe ujęcia jednym przyciskiem, „Ujęcie i światło” (kamera, książka, światło, tło, materiały),
// eksport w wybranym rozmiarze (także z przezroczystym tłem), animacja (wideo, GIF), zapis ujęć w projekcie,
// obwoluta i makiety sekcji specjalnych (ulotka, koperta, pudełko, kalendarz trójdzielny).

import { MATERIALY, teksturaOkleiny } from '../materialy.js';
import { $, powiadom, bezpiecznaNazwa, odmiana } from '../ui.js';
import { postep } from '../postep.js';
// Składanie stron (Fabric) – dopiero u właściciela; gość z linku (#188) dostaje gotowe obrazy stron.
const zlozenie = () => import('../zlozenie.js');
import { normalizujOkladke, formatSrodka } from '../okladka.js';
import {
  MODELE, mozeStac, parametryWireO, ukladStron, kartkiModelu, polozenia, opisPolozenia, scena, obwiednia, utworzRenderer,
  widokModelu, powodBrakuWebGL, jestSpecjalnyModel, UJECIA, ujeciaModelu, MODELE_SPECJALNE,
} from '../makieta-3d.js';
import {
  DOMYSLNE_OPCJE, normalizujOpcje, normalizujScene, normalizujUjecie, TLA, SWIATLA, BARWY, WYKONCZENIA_OKLADKI, PAPIERY, ILOSCI,
  iloscSceny, idIlosci,
} from '../makieta-ustawienia.js';
import { typSekcji, rolaTypu, wBloku } from '../typ-sekcji.js'; // typ sekcji wspólny z resztą programu (#177)
import { bazaMakiety, bazaZOpisu, domyslnyModel, modeleProjektu, powodNiepasowania } from '../makieta-opis.js';
import { uzyteKoloryDruku, stanUszlachetnien, FOLIE, plytaUszlachetnienia } from '../kolory-druku.js';
import { maskaZRoznicy } from '../separacje.js';
import { KoderGif } from '../gif.js';
import { ikona } from '../ikony.js';

const dlg = $('#dlg-makieta');
const plotno = $('#makieta-plotno');
const wybor = $('#makieta-model');
const wyborUlozenia = $('#makieta-ulozenie');
// px tekstury strony (#161): 1280 na co dzień (telefon z dpr ~2,6 – strona ok. 1000 px na ekranie), po przybliżeniu
// strony rysują się od nowa w 2048 px – ostro z bliska; mipmapy w rendererze uśredniają z daleka.
// Telefon i tablet (#203): mniej pamięci grafiki – tekstury 1024 / 1536 px i najwyżej 16 stron naraz.
const MALO_PAMIECI = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || document.documentElement.dataset.urzadzenie === 'telefon';
const SZEROKOSC_STRONY = MALO_PAMIECI ? 1024 : 1280;
const SZEROKOSC_OSTRA = MALO_PAMIECI ? 1536 : 2048;
const MAKS_STRON_W_PAMIECI = MALO_PAMIECI ? 16 : 48;

let st = null; // { projekt, ciag, strony, okladka, format, model, kartki, u, cel, kamera, opcje, sc, ... }
let renderer = null;
let klatka = 0;

const wypelnij = (sel, lista) => sel.replaceChildren(...Object.entries(lista).map(([id, nazwa]) => new Option(nazwa, id)));
wypelnij($('#makieta-swiatlo'), SWIATLA);
wypelnij($('#makieta-barwa'), BARWY);
wypelnij($('#makieta-tlo'), TLA);
wypelnij($('#makieta-wykonczenie'), WYKONCZENIA_OKLADKI);
wypelnij($('#makieta-papier'), PAPIERY);
wypelnij($('#makieta-ilosc'), ILOSCI);

// Domyślny model i modele projektu – w js/makieta-opis.js (wspólne z opisem makiety dla linku, #188).
export { domyslnyModel, modeleProjektu };

const obrazZUrl = (url) => new Promise((ok, zle) => {
  const img = new Image();
  img.crossOrigin = 'anonymous'; // obrazy stron z linku (#188) idą do WebGL – bez tego płótno byłoby „skażone”
  img.onload = () => ok(img);
  img.onerror = () => zle(new Error('Nie udało się narysować strony.'));
  img.src = url;
});

// Rysowanie stron i masek uszlachetnień (#181): maska przestawia wspólny stan rysowania (stanUszlachetnien.maska),
// więc rysuje się sama – zwykłe strony czekają na jej koniec, a ona na koniec zwykłych.
let aktywne = 0;
let maskaTrwa = null;
async function rysunekStrony(f) {
  while (maskaTrwa) await maskaTrwa;
  aktywne += 1;
  try { return await f(); } finally { aktywne -= 1; }
}
async function rysunekMaski(f) {
  while (maskaTrwa || aktywne) await (maskaTrwa || new Promise((ok) => { setTimeout(ok, 40); }));
  let zwolnij;
  maskaTrwa = new Promise((ok) => { zwolnij = ok; });
  try { return await f(); } finally { maskaTrwa = null; zwolnij(); }
}

// Obraz strony do tekstury. Uszlachetnienia „w świetle” (#181): strona bez efektów podglądu (folia i lakier to nie
// farba – dorysowuje je światło z maski), inaczej – jak w podglądzie edytora.
function rysujCel(moje, egz, szerokoscPx, oryginaly = false) {
  if (moje.adresObrazu) return Promise.resolve(moje.adresObrazu(egz.klucz)); // z linku: gotowy obraz strony (#188)
  const opcje = { szerokoscPx, spad: false, ciag: moje.ciag, oryginaly };
  if (moje.opcje.uszlachetnienia && maPolysk(moje.projekt, egz)) {
    return rysunekMaski(async () => {
      stanUszlachetnien.eksport = true;
      try { return await (await zlozenie()).renderujCel(moje.projekt, egz, opcje); } finally { stanUszlachetnien.eksport = false; }
    });
  }
  return rysunekStrony(async () => (await zlozenie()).renderujCel(moje.projekt, egz, opcje));
}

// Tekstury wczytywane w tle: najpierw te widoczne, potem sąsiednie.
const wToku = new Set();
// Postęp wczytywania stron (#159): „x z y” dla bieżącej partii, znika, gdy wszystkie gotowe.
let partia = null; // { pasek, razem, gotowe }
function startTekstury() {
  if (!partia) partia = { pasek: postep('Wczytywanie stron makiety…', { razem: 0 }), razem: 0, gotowe: 0 };
  partia.razem += 1;
  partia.pasek.krok(partia.gotowe, partia.razem);
}
function koniecTekstury() {
  if (!partia) return;
  partia.gotowe += 1;
  partia.pasek.krok(partia.gotowe, partia.razem);
  if (!wToku.size) { partia.pasek.koniec(); partia = null; }
}
// ostra – ponowne wczytanie strony w wyższej rozdzielczości (stara tekstura zostaje do chwili podmiany).
async function wczytajTeksture(klucz, ostra = false) {
  if (!st || !renderer || (!ostra && renderer.maTeksture(klucz)) || wToku.has(klucz)) return;
  const moje = st;
  if (ostra) (moje.ostre ||= new Set()).add(klucz);
  const lista = st.lista;
  wToku.add(klucz);
  if (!ostra) startTekstury(); // doostrzanie po przybliżeniu – bez paska postępu
  try {
    let obraz;
    let zrodlo = null; // { egz, wytnij } – do maski uszlachetnień
    if (klucz.startsWith('p:')) {
      const wpis = moje.lista[Number(klucz.slice(2))];
      obraz = wpis.egz.pusta ? null : await obrazStrony(moje, wpis);
      if (!wpis.egz.pusta) zrodlo = { egz: wpis.egz, wytnij: (img) => polowa(img, wpis.polowa) };
    } else if (klucz.startsWith('okl:')) {
      obraz = await czescOkladki(moje, klucz.slice(4));
      const egz = egzOkladki(moje);
      if (klucz !== 'okl:okleina' && egz) zrodlo = { egz, wytnij: (img) => wytnijStrefe(img, moje.okladka.wydruk.szerokosc_mm, strefyOkladki(moje), klucz.slice(4)) };
    } else if (klucz.startsWith('obw:')) {
      obraz = await czescObwoluty(moje, klucz.slice(4));
      const o = moje.obwoluta;
      if (o) zrodlo = { egz: o.egz, wytnij: (img) => wytnijStrefe(img, o.sekcja.wydruk.szerokosc_mm, strefyObwoluty(o), klucz.slice(4)) };
    }
    if (moje !== st || !renderer || (klucz.startsWith('p:') && moje.lista !== lista)) return;
    renderer.ustawTeksture(klucz, obraz || '#ffffff');
    rysujPozniej();
    if (zrodlo && !ostra && moje.opcje.uszlachetnienia) maskaTekstury(moje, klucz, zrodlo);
  } catch {
    if (moje === st && renderer) renderer.ustawTeksture(klucz, '#ffffff');
  } finally { wToku.delete(klucz); if (!ostra) koniecTekstury(); }
}

const polowa = (img, ktora) => {
  if (!ktora) return img;
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.floor(img.width / 2));
  c.height = img.height;
  c.getContext('2d').drawImage(img, ktora === 'L' ? 0 : img.width - c.width, 0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
};

const szerokoscTekstury = (moje, wpis) => {
  const baza = moje.ostro || jestSpecjalnyModel(moje.model) ? SZEROKOSC_OSTRA : SZEROKOSC_STRONY;
  return Math.min(4096, wpis.polowa ? 2 * baza : baza);
};

// Strona środka: obraz całej strony (raz na egzemplarz), połowa strony podwójnej szerokości – wycinek (#161).
function obrazStrony(moje, wpis) {
  moje.obrazy ||= new Map();
  const egz = wpis.egz;
  const szer = szerokoscTekstury(moje, wpis);
  const klucz = `${szer}|${moje.ostro ? 'o' : 'z'}|${moje.strony.indexOf(egz)}`;
  if (!moje.obrazy.has(klucz)) {
    moje.obrazy.set(klucz, rysujCel(moje, egz, szer, Boolean(moje.ostro)).then(obrazZUrl));
  }
  return moje.obrazy.get(klucz).then((img) => polowa(img, wpis.polowa));
}

const egzOkladki = (moje) => (moje.okladka ? moje.ciag.egzemplarze.find((e) => e.sekcja.id === moje.okladka.id) : null);
const szerokoscCalej = (mm) => Math.round(Math.min(3000, 9 * mm));
const strefyOkladki = (moje) => ({ gora: moje.geometria.gora, dol: moje.geometria.dol, strefy: moje.geometria.strefy });
const strefyObwoluty = (o) => ({ gora: 0, dol: o.wynik.wysokosc, strefy: o.wynik.strefy });

// Wycinek strefy (tył | grzbiet | przód…) z obrazu całej strony: pas od g.gora do g.dol (mm), szerokość strefy.
function wytnijStrefe(img, szerMm, g, czesc) {
  const s = img.width / szerMm;
  const strefa = g.strefy.find((z) => z.rodzaj === czesc);
  if (!strefa) return null;
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round((strefa.x2 - strefa.x1) * s));
  c.height = Math.max(2, Math.round((g.dol - g.gora) * s));
  c.getContext('2d').drawImage(img, strefa.x1 * s, g.gora * s, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

// Okładka: cała strona sekcji okładki raz, potem wycinki stref (tył | grzbiet | przód, bez zawinięć).
async function czescOkladki(moje, czesc) {
  // Okleina bez nadruku (#214: płótno, skóra ekologiczna…): kolor z fakturą; złocenie i tłoczenie dochodzą maską.
  const wyk = moje.okladka?.okladka?.wykonczenie;
  if (wyk && !MATERIALY[wyk.material]?.druk) {
    if (czesc === 'okleina') return wyk.kolor;
    const szer = szerokoscCalej(moje.okladka.wydruk.szerokosc_mm);
    const s = szer / moje.okladka.wydruk.szerokosc_mm;
    const strefa = strefyOkladki(moje).strefy.find((z) => z.rodzaj === czesc);
    if (!strefa) return null;
    return teksturaOkleiny(wyk, (strefa.x2 - strefa.x1) * s, (moje.geometria.dol - moje.geometria.gora) * s);
  }
  // Okleina twardej oprawy (#179) – kolor zawinięcia na wnętrzu tektury: średni kolor brzegu przodu okładki.
  if (czesc === 'okleina') return kolorOkleiny(await czescOkladki(moje, 'przod'));
  moje.obrazOkladki ||= rysujCel(moje, egzOkladki(moje), szerokoscCalej(moje.okladka.wydruk.szerokosc_mm)).then(obrazZUrl);
  return wytnijStrefe(await moje.obrazOkladki, moje.okladka.wydruk.szerokosc_mm, strefyOkladki(moje), czesc);
}

// Obwoluta (#181): strona sekcji obwoluty, wycinki tył | grzbiet | przód | skrzydełka (pełna wysokość).
async function czescObwoluty(moje, czesc) {
  const o = moje.obwoluta;
  if (!o) return null;
  o.obraz ||= rysujCel(moje, o.egz, szerokoscCalej(o.sekcja.wydruk.szerokosc_mm)).then(obrazZUrl);
  return wytnijStrefe(await o.obraz, o.sekcja.wydruk.szerokosc_mm, strefyObwoluty(o), czesc);
}

function kolorOkleiny(przod) {
  if (!przod) return null;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(przod, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  let r = 0; let gr = 0; let b = 0; let ile = 0;
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
    if (x > 2 && x < 29 && y > 2 && y < 29) continue; // tylko pas przy krawędzi
    const i = (y * 32 + x) * 4;
    r += d[i]; gr += d[i + 1]; b += d[i + 2]; ile += 1;
  }
  const hex = (v) => Math.round(v / ile).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(gr)}${hex(b)}`;
}

// ---------- Uszlachetnienia w świetle (#181) ----------

// Czy strona (z wzorcami) ma element z uszlachetnieniem widocznym w świetle (folia, lakier UV).
function maPolysk(projekt, egz) {
  const szukaj = (lista) => (lista || []).some((o) => { const u = plytaUszlachetnienia(o); return (u && (u.id === 'folia' || u.id === 'uv')) || szukaj(o.objects); });
  if (szukaj(egz.strona?.obiekty)) return true;
  // Wzorce strony bywają listą albo „jak w sekcji” – wtedy sprawdzane wszystkie wzorce projektu.
  const lista = Array.isArray(egz.strona?.wzorce) ? new Set(egz.strona.wzorce.map((w) => (typeof w === 'string' ? w : w?.id))) : null;
  return (projekt.wzorce || []).some((w) => (!lista || lista.has(w.id)) && szukaj(w.obiekty));
}

// Maska całej strony: folia – jej kolor (alfa – pokrycie), lakier UV – czerń. Raz na egzemplarz i rozdzielczość.
function maskaStrony(moje, egz, szerPx) {
  moje.maski ||= new Map();
  const klucz = `${moje.ciag.egzemplarze.indexOf(egz)}|${szerPx}`;
  if (moje.maski.has(klucz)) return moje.maski.get(klucz);
  const zadanie = (async () => {
    const plyty = uzyteKoloryDruku(moje.projekt).uszlachetnienia.filter((u) => u.plyta === 'Spot_UV' || u.plyta.startsWith('Foil_'));
    if (!plyty.length) return null;
    let c = null;
    let ctx = null;
    let dane = null;
    for (const u of plyty) {
      const odczyt = await rysunekMaski(async () => {
        stanUszlachetnien.maska = u.plyta;
        try {
          return await (await zlozenie()).naPlotnieCelu(moje.projekt, egz, { szerokoscPx: szerPx, spad: false, ciag: moje.ciag, oryginaly: false }, (p) => {
            const tlo = p.backgroundColor;
            p.backgroundColor = '#ffffff';
            p.renderAll();
            const w = p.getWidth();
            const h = p.getHeight();
            const wynik = { w, h, d: p.getContext().getImageData(0, 0, w, h).data };
            p.backgroundColor = tlo;
            return wynik;
          });
        } finally { stanUszlachetnien.maska = null; }
      });
      const m = maskaZRoznicy(odczyt.d, odczyt.w, odczyt.h);
      if (!m.some(Boolean)) continue;
      if (!c) {
        c = document.createElement('canvas');
        c.width = odczyt.w;
        c.height = odczyt.h;
        ctx = c.getContext('2d');
        dane = ctx.createImageData(odczyt.w, odczyt.h);
      }
      const folia = Object.values(FOLIE).find((f) => f.plyta === u.plyta);
      const kol = folia ? folia.kolory[1] : '#000000';
      const rgb = [1, 3, 5].map((i) => parseInt(kol.slice(i, i + 2), 16));
      for (let i = 0; i < m.length; i += 1) if (m[i]) { dane.data.set(rgb, i * 4); dane.data[i * 4 + 3] = 255; }
    }
    if (!c) return null;
    ctx.putImageData(dane, 0, 0);
    return c;
  })();
  moje.maski.set(klucz, zadanie);
  return zadanie;
}

async function maskaTekstury(moje, klucz, { egz, wytnij }) {
  try {
    if (!maPolysk(moje.projekt, egz)) return;
    const szer = klucz.startsWith('p:') ? szerokoscTekstury(moje, moje.lista[Number(klucz.slice(2))]) : szerokoscCalej(egz.sekcja.wydruk.szerokosc_mm);
    const maska = await maskaStrony(moje, egz, szer);
    if (!maska || moje !== st || !renderer) return;
    renderer.ustawMaske(klucz, wytnij(maska));
    rysujPozniej();
  } catch { /* bez maski – druk bez połysku */ }
}

// ---------- Rysowanie ----------

function rysujPozniej() {
  if (klatka) return;
  klatka = requestAnimationFrame(rysuj);
}

const ciemny = () => document.documentElement.dataset.motyw === 'ciemny';
const fovKamery = () => (st?.kamera?.fov || 28);

// Kamera mieści całą rzecz w kadrze niezależnie od proporcji płótna (telefon w pionie, szerokie okno):
// odległość z promienia obwiedni i węższego z kątów widzenia. Zmiany środka i odległości są płynne.
function odlegloscDla(ob) {
  const asp = plotno.width / Math.max(1, plotno.height);
  const tV = Math.tan(((fovKamery() * Math.PI) / 180) / 2);
  const tH = tV * asp;
  // Kadr dla bieżącego kąta kamery (#161 – po obróceniu rzecz nie wychodzi poza kadr); zmiana odległości
  // jest płynna, więc obracanie nie skacze. Rogi obwiedni w układzie kamery – każdy w kącie widzenia.
  const a = st.kamera.obrotX ?? widokModelu(st.model, st.ulozenie).obrotX;
  const b = st.kamera.obrotY ?? widokModelu(st.model, st.ulozenie).obrotY;
  let d = 0;
  for (const x of [ob.min[0], ob.max[0]]) for (const y of [ob.min[1], ob.max[1]]) for (const z of [ob.min[2], ob.max[2]]) {
    const [dx, dy, dz] = [x - ob.srodek[0], y - ob.srodek[1], z - ob.srodek[2]];
    const x1 = dx * Math.cos(b) + dz * Math.sin(b);
    const z1 = -dx * Math.sin(b) + dz * Math.cos(b);
    const y2 = dy * Math.cos(a) - z1 * Math.sin(a);
    const z2 = dy * Math.sin(a) + z1 * Math.cos(a);
    d = Math.max(d, z2 + Math.abs(x1) / tH, z2 + Math.abs(y2) / tV);
  }
  return Math.max(d * 1.12, ob.promien * 1.3);
}

// Odwrotność gładkiego przejścia (smoothstep) – uchylona okładka o zadany kąt.
const odwrocGladko = (s) => 0.5 - Math.sin(Math.asin(1 - 2 * Math.min(1, Math.max(0, s))) / 3);
const ksiazkowy = (model) => model.startsWith('ksiazka') || model === 'notes';

// Scena dla położenia u z bieżącymi ustawieniami (#181): uchylona okładka przy zamkniętej książce.
function zbudujScene(u, cel = st.cel) {
  let uu = u;
  if (ksiazkowy(st.model) && st.sc.uchylenie > 0 && u === 0 && cel === 0) uu = Math.min(0.97, odwrocGladko(st.sc.uchylenie));
  return scena(st.model, st.kartki, uu, { ulozenie: st.ulozenie, otwarcie: st.sc.otwarcie, wachlarz: st.sc.wachlarz, ilosc: st.sc.ilosc });
}
const kluczSceny = (u) => `${u}|${st.model}|${st.ulozenie}|${st.cel === 0}|${JSON.stringify(st.sc)}|${st.wersjaKartek}`;
const opcjeRysowania = (zmiany = {}) => ({ ...st.opcje, ciemny: ciemny(), ...zmiany });

function rysuj() {
  klatka = 0;
  if (!st || !renderer) return;
  dopasujRozmiar();
  // Animacja kartkowania: u dąży do celu.
  if (st.u !== st.cel) {
    const krok = Math.min(1, (performance.now() - (st.czas || performance.now())) / 550);
    st.czas = performance.now();
    st.u = st.cel > st.u ? Math.min(st.cel, st.u + krok) : Math.max(st.cel, st.u - krok);
    if (st.u !== st.cel) klatka = requestAnimationFrame(rysuj);
  }
  const ks = kluczSceny(st.u);
  if (st.scena?.klucz !== ks) st.scena = { klucz: ks, quady: zbudujScene(st.u) };
  const { quady } = st.scena;
  for (const q of quady) if (!renderer.maTeksture(q.tex)) wczytajTeksture(q.tex);
  // Limit pamięci (#203): strony spoza widoku i spoza ostatnio oglądanych – zwolnione (tekstury i obrazy).
  const zwolnione = renderer.przytnijStrony(new Set(quady.map((q) => q.tex)), MAKS_STRON_W_PAMIECI);
  if (zwolnione.length && st.obrazy) {
    for (const k of zwolnione) st.ostre?.delete(k);
    if (st.obrazy.size > MAKS_STRON_W_PAMIECI * 2) for (const k of [...st.obrazy.keys()].slice(0, st.obrazy.size - MAKS_STRON_W_PAMIECI)) st.obrazy.delete(k);
  }
  // Kadr z położenia docelowego (nie z przewracanej kartki) – bez „pompowania” przy kartkowaniu.
  const cu = Math.round(st.cel);
  const kk = kluczSceny(cu);
  if (st.kadr?.klucz !== kk) st.kadr = { klucz: kk, ob: obwiednia(cu === st.u ? quady : zbudujScene(cu)) };
  const ob = st.kadr.ob;
  const k = st.kamera;
  const cel = odlegloscDla(ob);
  const celSrodek = k.przes ? ob.srodek.map((v, i) => v + k.przes[i]) : ob.srodek; // przes – tylko testy i zrzuty
  k.srodek = k.srodek ? k.srodek.map((v, i) => v + (celSrodek[i] - v) * 0.22) : celSrodek;
  k.baza = k.baza ? k.baza + (cel - k.baza) * 0.22 : cel;
  if (k.srodek.some((v, i) => Math.abs(v - celSrodek[i]) > 0.3) || Math.abs(k.baza - cel) > cel * 0.004) rysujPozniej();
  k.odleglosc = k.baza / k.zoom;
  // Przybliżenie: strony rysują się od nowa w wyższej rozdzielczości (raz – potem zostają ostre).
  if (k.zoom > 1.6) st.ostro = true;
  if (st.ostro) for (const q of quady) if (q.tex.startsWith('p:') && !st.ostre?.has(q.tex)) wczytajTeksture(q.tex, true);
  renderer.rysuj(quady, k, opcjeRysowania());
  $('#makieta-polozenie').textContent = opisPolozenia(st.model, st.kartki, st.cel, (i) => st.numery?.[i] ?? null);
  $('#makieta-wstecz').disabled = st.cel <= 0;
  $('#makieta-dalej').disabled = st.cel >= polozenia(st.model, st.kartki);
  const r = $('#makieta-rozkladowka');
  if (document.activeElement !== r && r.value !== String(Math.round(st.cel))) r.value = String(Math.round(st.cel));
  plotno.dataset.gotowe = String(!wToku.size && st.u === st.cel);
  pokazKamere();
  // Wczytaj z wyprzedzeniem sąsiednie kartki.
  for (const d of [1, -1, 2]) {
    const sasiad = scena(st.model, st.kartki, Math.max(0, Math.min(polozenia(st.model, st.kartki), Math.round(st.cel) + d)));
    for (const q of sasiad) if (!renderer.maTeksture(q.tex) && /^(p|okl|obw):/.test(q.tex)) wczytajTeksture(q.tex);
  }
}

// Lista stron modelu (#161). Rola sekcji wyłącznie z jej typu (#177): typSekcji(s) – 'okladka', 'wyklejka_przednia',
// 'wyklejka_tylna', 'obwoluta'… Wyklejki i obwoluta nie są kartkami bloku. W książce z okładką wyklejka przednia:
// pierwsza strona (albo lewa połowa arkusza dwa razy szerszego od bloku) przyklejona do wnętrza przedniej okładki,
// reszta – luźna kartka przed stroną 1; tylna odwrotnie. Twarda oprawa bez wyklejek – czysta wyklejka (papier).
// Blok zaczyna się od nowej kartki. Strony dwa razy szersze od bloku (rozkładówka na jednym arkuszu) – dwie
// połowy. Format bloku – najczęstszy format stron. Obwoluta – osobno (przełącznik „Pokaż obwolutę”, #181);
// sekcje osobne (ulotka, wykrojnik, trójdzielny, arkusz użytków) – tylko w swoich modelach.
export { typSekcji };
function listaStron(model) {
  if (jestSpecjalnyModel(model)) {
    const sekcja = st.specjalne[model];
    const egz = st.strony.filter((e) => e.sekcja?.id === sekcja?.id && !e.pusta);
    const lista = egz.map((e) => ({ egz: e, polowa: null, w: e.sekcja.wydruk.szerokosc_mm, h: e.sekcja.wydruk.wysokosc_mm, typ: typSekcji(e.sekcja) }));
    return { lista, format: st.format, wnetrze: null, numery: lista.map(() => null) };
  }
  const ksiazka = !model.startsWith('kalendarz') && model !== 'kartka';
  const typ = (e) => typSekcji(e.sekcja);
  const wyklejka = (e) => typ(e) === 'wyklejka_przednia' || typ(e) === 'wyklejka_tylna';
  // Obwoluta i sekcje osobne nigdy w kartkach; kalendarz i kartka – bez wyklejek i pustych stron wyrównujących.
  const egz = st.strony.filter((e) => typ(e) !== 'obwoluta' && rolaTypu(typ(e)) !== 'osobny' && (ksiazka || (!e.pusta && !wyklejka(e))));
  const { format, wpisy } = ukladStron(egz.map((e) => ({ w: e.sekcja?.wydruk?.szerokosc_mm || st.format.w, h: e.sekcja?.wydruk?.wysokosc_mm || st.format.h, pusta: e.pusta })));
  let lista = wpisy.map((x) => ({ ...x, egz: egz[x.zrodlo], typ: typ(egz[x.zrodlo]) }));
  const zOkladka = ksiazka && (Boolean(st.okladka) || model !== 'ksiazka_miekka');
  let wnetrze = { przod: false, tyl: false };
  if (zOkladka) {
    const pusta = () => ({ egz: { pusta: true, sekcja: null }, polowa: null, w: format.w, h: format.h, pusta: true, typ: 'wyklejka' });
    let przod = lista.filter((x) => x.typ === 'wyklejka_przednia');
    let tyl = lista.filter((x) => x.typ === 'wyklejka_tylna');
    const srodek = lista.filter((x) => x.typ !== 'wyklejka_przednia' && x.typ !== 'wyklejka_tylna');
    const twarda = model === 'ksiazka_twarda';
    if (!przod.length && twarda) przod = [pusta(), pusta()];
    if (!tyl.length && twarda) tyl = [pusta(), pusta()];
    const wolneP = przod.slice(1);
    if (wolneP.length % 2) wolneP.push(pusta()); // blok od nowej kartki
    if (srodek.length % 2 && tyl.length) srodek.push(pusta());
    const wolneT = tyl.slice(0, -1);
    if (wolneT.length % 2) wolneT.unshift(pusta());
    lista = [...przod.slice(0, 1), ...wolneP, ...srodek, ...wolneT, ...tyl.slice(-1)];
    wnetrze = { przod: przod.length > 0, tyl: tyl.length > 0 && lista.length > 1 };
  } else if (ksiazka) lista = lista.filter((x) => !wyklejka(x.egz));
  // Numery stron: wyklejki i dodane czyste strony bez numeru.
  let n = 0;
  const numery = lista.map((x) => (x.typ.startsWith('wyklejka') ? null : (n += 1)));
  return { lista, format, wnetrze, numery };
}

const obwolutaWidoczna = () => Boolean(st?.obwoluta && st.model === 'ksiazka_twarda' && st.pokazObwolute);

// Kartki modelu z bieżącej listy stron (obwoluta: skrzydełka i tekstury obwoluty na okładce).
function przeliczKartki() {
  const model = st.model;
  const specjalna = st.specjalneDane?.[model] || null; // policzone z góry (bazaMakiety) – działa też z linku
  const przod = st.geometria?.strefy.find((z) => z.rodzaj === 'przod');
  const skrz = st.obwoluta?.wynik.strefy.find((x) => x.rodzaj === 'skrzydelko_p');
  st.kartki = kartkiModelu(model, {
    strony: st.lista.length,
    format: st.formatListy,
    wnetrze: st.wnetrze,
    // Każda strona w swoim formacie (sekcje mogą mieć różne) – tekstura leży na kartce bez rozciągania.
    rozmiary: st.lista.map((e) => ({ w: e.w, h: e.h })),
    okladka: st.geometria && przod ? { w: przod.x2 - przod.x1, h: st.geometria.dol - st.geometria.gora, tektura: normalizujOkladke(st.okladka.okladka).tektura_mm } : null,
    kartka_mm: st.geometria?.kartka_mm || 0.1,
    specjalna,
    obwoluta: obwolutaWidoczna() ? { skrzydelko_mm: skrz ? skrz.x2 - skrz.x1 : 0 } : null,
  });
  st.wersjaKartek = (st.wersjaKartek || 0) + 1;
  st.scena = null;
  st.kadr = null;
}

function ustawModel(model, { kamera = true } = {}) {
  st.model = model;
  const { lista, format, wnetrze, numery } = listaStron(model);
  const klucz = `${model}|${lista.map((x) => `${st.strony.indexOf(x.egz)}${x.polowa || ''}`).join(',')}`;
  if (klucz !== st.kluczListy) { st.kluczListy = klucz; st.ostre = null; renderer?.zapomnijStrony?.(); }
  st.lista = lista;
  st.numery = numery;
  st.formatListy = format;
  st.wnetrze = wnetrze;
  przeliczKartki();
  st.u = 0;
  st.cel = 0;
  if (kamera) {
    Object.assign(st.kamera, widokModelu(model, st.ulozenie), { zoom: 1, srodek: null, baza: null });
    st.sc = normalizujScene({}); // inny rodzaj – ujęcie od nowa (stos, wachlarz… zostawały z poprzedniego)
  }
  wybor.value = model;
  $('#makieta-ulozenie-pole').hidden = !mozeStac(model);
  $('#makieta-obwoluta-pole').hidden = !(st.obwoluta && model === 'ksiazka_twarda');
  // Oprawa Wire-O (#179): blok grubszy niż największy pierścień (ok. 28 mm) – drukarnia go nie zepnie.
  const uwaga = $('#makieta-uwaga');
  const spirala = model === 'notes' || model.startsWith('kalendarz');
  const T = st.kartki.reduce((a, x) => a + x.d, 0);
  const wo = parametryWireO(T);
  const uwagi = [];
  if (spirala && wo.zaGruby) uwagi.push(`Blok ma ok. ${Math.round(T)} mm grubości – więcej niż mieści największy pierścień Wire-O (${wo.maks} mm). Makieta pokazuje największą spiralę; do druku podziel projekt na tomy albo wybierz oprawę klejoną.`);
  // Sekcja środka w innym formacie niż reszta bloku (#185) – np. wyklejka A4 bez ustawionego typu. Takiej strony
  // nie da się poprawnie złożyć w książkę: makieta mówi to wprost i prowadzi do ustawienia typu sekcji.
  const obce = st.gosc || model === 'kartka' || MODELE_SPECJALNE.includes(model) ? [] : niepasujaceSekcje(st.projekt, st.ciag);
  // Rodzaj spoza pasujących (#215): co nie pasuje i co zrobić.
  if (st.inne?.includes(model)) uwagi.unshift(`${MODELE[model]} nie pasuje do tego projektu. ${powodNiepasowania(model, st.projekt)}`);
  uwaga.replaceChildren();
  for (const t of uwagi) { const p = document.createElement('p'); p.textContent = t; uwaga.append(p); }
  for (const o of obce) {
    const p = document.createElement('p');
    p.textContent = `Sekcja „${o.sekcja.nazwa}” ma format ${o.w} × ${o.h} mm, a środek ${o.wb} × ${o.hb} mm – takich stron nie da się złożyć w książkę i makieta pokaże je źle. Jeśli to wyklejka, okładka albo inna część publikacji, ustaw jej typ. `;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk maly';
    b.textContent = 'Ustaw typ sekcji…';
    b.addEventListener('click', () => { $('#dlg-makieta').close(); window.seriodruk?.otworzUstawieniaSekcji?.(o.sekcja.id); });
    p.append(b);
    uwaga.append(p);
  }
  uwaga.hidden = !uwaga.childElementCount;
  wyborUlozenia.value = st.ulozenie;
  if (!st.gosc) try { sessionStorage.setItem(`makieta:${st.projekt.id}`, model); } catch { /* bez pamięci – zostaje domyślny */ }
  pokazUjecia();
  pokazKontrolki();
  rysujPozniej();
}

export function kartkuj(d) {
  if (!st) return;
  const max = polozenia(st.model, st.kartki);
  st.cel = Math.max(0, Math.min(max, Math.round(st.cel) + d));
  st.czas = performance.now();
  rysujPozniej();
}

// Bufor płótna zawsze w proporcjach tego, co widać (bez rozciągania obrazu przy zmianie okna, obrocie
// telefonu czy otwieraniu okna) – sprawdzane przed każdym rysowaniem.
let eksport = false;
function dopasujRozmiar() {
  if (eksport) return;
  // Rozmiar z układu strony (clientWidth/Height), nie z getBoundingClientRect – ten liczy też przesunięcia
  // i skalowanie w trakcie wjazdu okna. Pełna gęstość ekranu (do 3×, #161: na telefonie z dpr 2,6 obraz był
  // rozciągany z 2× i miękki), ale najwyżej ok. 4,5 mln pikseli.
  const cw = plotno.clientWidth;
  const ch = plotno.clientHeight;
  if (cw < 2 || ch < 2) return;
  let dpr = Math.min(MALO_PAMIECI ? 2.5 : 3, window.devicePixelRatio || 1);
  dpr = Math.min(dpr, Math.sqrt(4.5e6 / (cw * ch)));
  const w = Math.max(1, Math.round(cw * dpr));
  const h = Math.max(1, Math.round(ch * dpr));
  if (plotno.width !== w || plotno.height !== h) { plotno.width = w; plotno.height = h; }
}
function dopasujPlotno() {
  dopasujRozmiar();
  rysujPozniej();
}
const obserwator = new ResizeObserver(() => { if (st) dopasujPlotno(); });

// Co zrobić, gdy WebGL nie działa (#194) – zależnie od przeglądarki i systemu. Najczęstszy przypadek: starszy Mac
// albo komputer, którego kartę graficzną Chrome ma na liście zablokowanych – WebGL znika (nowy Chrome nie zastępuje
// go już grafiką programową), choć Safari na tym samym komputerze zwykle działa.
const esc = (t) => String(t).replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);
export function tekstBraku3D(powod, ua = navigator.userAgent) {
  const chrome = /Chrome\/|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua);
  const mac = /Macintosh|Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua);
  const telefon = /Android|iPhone|iPad/.test(ua);
  const kroki = [];
  if (powod.startsWith('kontekst')) kroki.push('Zamknij okno makiety i otwórz je jeszcze raz.');
  if (chrome && !telefon) {
    kroki.push('Sprawdź w Chrome ustawienie <b>Ustawienia → System → Używaj akceleracji grafiki, gdy jest dostępna</b> – ma być włączone (potem uruchom Chrome ponownie).');
    kroki.push('Wpisz w pasku adresu <b>chrome://gpu</b>. Jeśli przy „WebGL” jest „Unavailable” albo „Software only”, Chrome zablokował kartę graficzną tego komputera (częste na starszych komputerach). Wtedy otwórz <b>chrome://flags/#ignore-gpu-blocklist</b>, ustaw „Override software rendering list” na <b>Enabled</b> i uruchom Chrome ponownie.');
    if (mac) kroki.push('Albo otwórz Makietkę w <b>Safari</b> – na starszych Macach zwykle pokazuje makietę bez zmian w ustawieniach.');
    else kroki.push('Albo otwórz Makietkę w innej przeglądarce (Firefox).');
  } else if (telefon) {
    kroki.push('Zaktualizuj przeglądarkę i system; przy oszczędzaniu baterii grafika bywa wyłączona – wyłącz je na chwilę.');
  } else {
    kroki.push('Zaktualizuj przeglądarkę i włącz w jej ustawieniach przyspieszenie sprzętowe (akcelerację grafiki).');
  }
  return `<b>Nie udało się pokazać makiety 3D:</b> ${esc(powod || 'nieznany błąd grafiki')}.<ul>${kroki.map((k) => `<li>${k}</li>`).join('')}</ul>`;
}

function pokazBrak3D() {
  const k = $('#makieta-brak-3d');
  k.hidden = Boolean(renderer);
  if (!renderer) k.innerHTML = tekstBraku3D(powodBrakuWebGL);
}

// Utrata kontekstu WebGL (#157): telefon odbiera go np. przy przejściu aplikacji w tło. Bez preventDefault
// nie wraca nigdy; po powrocie renderer powstaje od nowa, a tekstury stron wczytują się jeszcze raz.
plotno.addEventListener('webglcontextlost', (e) => { e.preventDefault(); renderer = null; });
plotno.addEventListener('webglcontextrestored', () => {
  if (!st) return;
  renderer = utworzRenderer(plotno);
  pokazBrak3D();
  if (renderer) { st.scena = null; rysujPozniej(); }
});

// Ustawienia światła i tła – na tym urządzeniu, dla projektu (zapisane ujęcia – w projekcie).
const kluczOpcji = (projekt) => `makieta-opcje:${projekt.id}`;
function zapiszOpcje() {
  if (st.gosc) return;
  try { localStorage.setItem(kluczOpcji(st.projekt), JSON.stringify(st.opcje)); } catch { /* bez pamięci */ }
}

export function otworzMakiete(projekt) {
  let opcje = DOMYSLNE_OPCJE;
  try { opcje = JSON.parse(localStorage.getItem(kluczOpcji(projekt)) || 'null') || DOMYSLNE_OPCJE; } catch { opcje = DOMYSLNE_OPCJE; }
  let zapamietany = null;
  try { zapamietany = sessionStorage.getItem(`makieta:${projekt.id}`); } catch { /* bez pamięci */ }
  let ulozenie = 'lezy';
  try { ulozenie = localStorage.getItem(`makieta-ulozenie:${projekt.id}`) === 'stoi' ? 'stoi' : 'lezy'; } catch { ulozenie = 'lezy'; }
  const baza = bazaMakiety(projekt);
  const dm = domyslnyModel(projekt, baza.strony.length, baza.okladka);
  uruchom({ projekt, ...baza, opcje: normalizujOpcje(opcje) }, {
    model: baza.modele.includes(zapamietany) ? zapamietany : baza.modele.includes(dm) ? dm : baza.modele[0], ulozenie,
  });
}

// Podgląd z linku (#188): jeden wariant zapisany przy publikacji (rodzaj, ułożenie, ujęcie, światło), strony –
// gotowe obrazy linku. Bez projektu, bez składania stron i bez zapisu czegokolwiek.
export function otworzMakieteZLinku(opis, adresObrazu) {
  const w = opis.wariant || {};
  const projekt = { id: 'link', nazwa: opis.nazwa || 'Makieta', sekcje: opis.sekcje, strony: [] };
  uruchom({ projekt, ...bazaZOpisu(opis), opcje: normalizujOpcje({ ...(w.opcje || {}), uszlachetnienia: false }), gosc: true, adresObrazu }, { model: opis.model, ulozenie: w.ulozenie });
  if (st && renderer && w.kamera) zastosujStan({ ...w, model: opis.model });
}

function uruchom(baza, { model, ulozenie }) {
  renderer?.zwolnij();
  renderer = null;
  st = {
    ...baza, ulozenie: 'lezy', pokazObwolute: Boolean(baza.obwoluta),
    kamera: { obrotY: 0, obrotX: 0.5, zoom: 1, srodek: null, fov: 28 }, sc: normalizujScene({}),
  };
  dlg.classList.toggle('makieta-z-linku', Boolean(baza.gosc));
  // Pasujące rodzaje (#215) na górze; pozostałe – osobna grupa, z opisem, czego projektowi brakuje.
  wybor.replaceChildren(...st.modele.map((id) => new Option(MODELE[id], id)));
  if (st.inne?.length && !st.gosc) {
    const grupa = document.createElement('optgroup');
    grupa.label = 'Nie pasuje do projektu';
    grupa.append(...st.inne.map((id) => new Option(MODELE[id], id)));
    wybor.append(grupa);
  }
  if (!dlg.open) dlg.showModal();
  renderer = utworzRenderer(plotno);
  pokazBrak3D();
  pokazZapisane();
  if (!renderer) return;
  st.ulozenie = ulozenie === 'stoi' ? 'stoi' : 'lezy';
  ustawModel(model);
  obserwator.observe(plotno);
  dopasujPlotno();
}

// Do testów i zrzutów: ustawia położenie kartkowania wprost (także ułamkowe – kartka w trakcie przewracania).
// natychmiast – kamera od razu w docelowym kadrze (bez płynnego dojścia).
// Do testów (#203): ile stron jest teraz w pamięci grafiki i jaki jest limit.
export const pamiecStronMakiety = () => ({ stron: renderer?.ileStron() ?? 0, limit: MAKS_STRON_W_PAMIECI });

export function ustawPolozenieMakiety(u, { natychmiast = false } = {}) {
  if (!st) return;
  st.u = u;
  st.cel = u;
  if (natychmiast) { st.kamera.srodek = null; st.kamera.baza = null; }
  rysujPozniej();
}

export const stanMakiety = () => (st ? {
  model: st.model, modele: [...st.modele], ulozenie: st.ulozenie, u: st.u, cel: st.cel, kartek: st.kartki.length, polozen: polozenia(st.model, st.kartki),
  kamera: { ...st.kamera }, opcje: { ...st.opcje }, scena: { ...st.sc }, obwoluta: obwolutaWidoczna(), renderer: Boolean(renderer), wToku: [...wToku],
} : null);

// ---------- Eksport obrazu (#181) ----------

// Rozmiar obrazu z ustawień: { w, h } w px (dłuższy bok z listy, Instagram – kwadrat 1080).
function rozmiarEksportu(w0, h0, rozmiar, wlasny) {
  if (rozmiar === 'ig') return { w: 1080, h: 1080 };
  const dl = rozmiar === 'wlasny' ? Math.max(200, Math.min(8000, Number(wlasny) || 2400)) : Number(rozmiar) || 1600;
  const k = dl / Math.max(w0, h0);
  return { w: Math.max(1, Math.round(w0 * k)), h: Math.max(1, Math.round(h0 * k)) };
}

// Obraz makiety (PNG) w zadanym rozmiarze, w tym samym kadrze co na ekranie; przezroczyste – bez tła (cień zostaje).
// Zwraca Blob albo null. Rozmiar ponad możliwości karty graficznej – zmniejszony do największego możliwego.
export async function obrazMakiety({ rozmiar = '1600', wlasny = 2400, przezroczyste = false } = {}) {
  if (!st || !renderer) return null;
  const { width: w0, height: h0 } = plotno;
  const gl = renderer.gl;
  const max = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096, ...(gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [4096]));
  let { w, h } = rozmiarEksportu(w0, h0, rozmiar, wlasny);
  if (Math.max(w, h) > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
  eksport = true;
  try {
    plotno.width = w;
    plotno.height = h;
    const quady = zbudujScene(st.cel);
    const ob = obwiednia(quady);
    renderer.rysuj(quady, { ...st.kamera, srodek: ob.srodek, odleglosc: odlegloscDla(ob) / st.kamera.zoom }, opcjeRysowania(przezroczyste ? { tlo: 'przezroczyste' } : {}));
    return await new Promise((ok) => { plotno.toBlob(ok, 'image/png'); });
  } finally {
    eksport = false;
    plotno.width = w0;
    plotno.height = h0;
    rysujPozniej();
  }
}

function pobierzPlik(blob, rozszerzenie) {
  const url = URL.createObjectURL(blob);
  // Odnośnik w oknie: reszta strony pod otwartym oknem jest nieaktywna i przeglądarka gubi nazwę pliku.
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bezpiecznaNazwa(st.projekt.nazwa)} - makieta.${rozszerzenie}`;
  dlg.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const ustawieniaEksportu = () => ({ rozmiar: $('#makieta-rozmiar').value, wlasny: $('#makieta-wlasny').value, przezroczyste: $('#makieta-przezroczyste').checked });

export async function pobierzObrazMakiety() {
  if (!st || !renderer) return;
  const blob = await obrazMakiety(ustawieniaEksportu());
  if (!blob) { powiadom('Nie udało się zapisać obrazu makiety.', true); return; }
  pobierzPlik(blob, 'png');
}

// ---------- Animacja (#181) ----------

// Czeka, aż wczytają się tekstury podanych scen (najwyżej 30 s).
async function doczytaj(sceny) {
  const koniec = performance.now() + 30000;
  for (;;) {
    let brak = false;
    for (const q of sceny) for (const x of q) if (!renderer.maTeksture(x.tex)) { brak = true; wczytajTeksture(x.tex); }
    if ((!brak && !wToku.size) || performance.now() > koniec || !st) return;
    await new Promise((ok) => { setTimeout(ok, 80); });
  }
}

const formatWideo = () => {
  const { MediaRecorder } = globalThis;
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || null;
};

// Animacja: ruch 'obrot' (kamera dookoła) albo 'kartkowanie' (od bieżącego położenia do końca), plik 'wideo' (MP4,
// gdy przeglądarka umie, inaczej WebM – MediaRecorder z canvas.captureStream) albo 'gif' (js/gif.js).
// Zwraca { blob, rozszerzenie } albo null (anulowane / brak wsparcia).
export async function nagrajAnimacje({ ruch = 'obrot', plik = 'wideo', klatek = null } = {}) {
  if (!st || !renderer) return null;
  const gif = plik === 'gif';
  const mime = gif ? 'image/gif' : formatWideo();
  if (!mime || (!gif && typeof plotno.captureStream !== 'function')) { powiadom('Ta przeglądarka nie nagrywa wideo z grafiki 3D – wybierz GIF.', true); return null; }
  const max = polozenia(st.model, st.kartki);
  const kartkowanie = ruch === 'kartkowanie' && max > 0;
  // Klatki: obrót – pełne koło; kartkowanie – każde położenie z płynnym przewracaniem i chwilą postoju.
  const lista = [];
  if (kartkowanie) {
    const naKrok = gif ? 7 : 18;
    const od = Math.round(st.cel) >= max ? 0 : Math.round(st.cel);
    const kroki = Math.min(max - od, gif ? 10 : 16);
    for (let j = 0; j < (gif ? 3 : 8); j += 1) lista.push({ u: od });
    for (let i = od; i < od + kroki; i += 1) {
      for (let j = 1; j < naKrok; j += 1) lista.push({ u: i + j / naKrok });
      for (let j = 0; j < (gif ? 3 : 8); j += 1) lista.push({ u: i + 1 });
    }
  } else {
    const n = klatek || (gif ? 36 : 120);
    for (let i = 0; i < n; i += 1) lista.push({ u: Math.round(st.cel), obrot: (2 * Math.PI * i) / n });
  }
  if (klatek) lista.length = Math.min(lista.length, klatek);
  let przerwij = false;
  const pasek = postep(gif ? 'Nagrywanie GIF…' : 'Nagrywanie wideo…', { razem: lista.length, anuluj: () => { przerwij = true; } });
  const { width: w0, height: h0 } = plotno;
  eksport = true;
  try {
    // Rozmiar: GIF – dłuższy bok 560 px (rozsądny plik), wideo – 1280 px; wymiary parzyste (kodeki wideo).
    const dl = gif ? 560 : 1280;
    const k = dl / Math.max(w0, h0);
    plotno.width = Math.max(2, Math.round((w0 * k) / 2) * 2);
    plotno.height = Math.max(2, Math.round((h0 * k) / 2) * 2);
    const sceny = new Map();
    const scenaDla = (u) => {
      const key = Math.round(u * 1000);
      if (!sceny.has(key)) sceny.set(key, zbudujScene(u, Number.isInteger(u) ? u : -1));
      return sceny.get(key);
    };
    await doczytaj([...new Set(lista.map((x) => Math.round(x.u)))].map((u) => scenaDla(u)));
    const rysujKlatke = (x) => {
      const q = scenaDla(x.u);
      const obK = obwiednia(scenaDla(Math.min(max, Math.ceil(x.u - 1e-6))));
      const kk = { ...st.kamera, obrotY: st.kamera.obrotY + (x.obrot || 0), srodek: obK.srodek };
      const zapas = { obrotY: st.kamera.obrotY };
      st.kamera.obrotY = kk.obrotY; // kadr dla bieżącego kąta
      kk.odleglosc = odlegloscDla(obK) / st.kamera.zoom;
      st.kamera.obrotY = zapas.obrotY;
      renderer.rysuj(q, kk, opcjeRysowania());
    };
    if (gif) {
      const koder = new KoderGif(plotno.width, plotno.height, { opoznienie: kartkowanie ? 5 : 8 });
      const c = document.createElement('canvas');
      c.width = plotno.width;
      c.height = plotno.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      for (let i = 0; i < lista.length; i += 1) {
        if (przerwij) return null;
        rysujKlatke(lista[i]);
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(plotno, 0, 0);
        koder.dodaj(g.getImageData(0, 0, c.width, c.height).data);
        pasek.krok(i + 1);
        if (i % 3 === 2) await new Promise((ok) => { setTimeout(ok, 0); });
      }
      return { blob: new Blob([koder.zakoncz()], { type: 'image/gif' }), rozszerzenie: 'gif' };
    }
    const strumien = plotno.captureStream(0);
    const sciezka = strumien.getVideoTracks()[0];
    const kawalki = [];
    const nagrywanie = new globalThis.MediaRecorder(strumien, { mimeType: mime, videoBitsPerSecond: 8e6 });
    nagrywanie.ondataavailable = (e) => { if (e.data?.size) kawalki.push(e.data); };
    const koniec = new Promise((ok) => { nagrywanie.onstop = ok; });
    nagrywanie.start();
    const klatkaMs = 1000 / 30;
    let t = performance.now();
    for (let i = 0; i < lista.length && !przerwij; i += 1) {
      rysujKlatke(lista[i]);
      sciezka.requestFrame?.();
      pasek.krok(i + 1);
      t += klatkaMs;
      await new Promise((ok) => { setTimeout(ok, Math.max(0, t - performance.now())); });
    }
    nagrywanie.stop();
    await koniec;
    sciezka.stop();
    if (przerwij) return null;
    const typ = mime.split(';')[0];
    return { blob: new Blob(kawalki, { type: typ }), rozszerzenie: typ === 'video/mp4' ? 'mp4' : 'webm' };
  } finally {
    pasek.koniec();
    eksport = false;
    plotno.width = w0;
    plotno.height = h0;
    rysujPozniej();
  }
}

async function pobierzAnimacje() {
  const wynik = await nagrajAnimacje({ ruch: $('#makieta-anim-ruch').value, plik: $('#makieta-anim-plik').value });
  if (wynik?.blob?.size) pobierzPlik(wynik.blob, wynik.rozszerzenie);
}

export const kartkiMakiety = () => st?.kartki || null;

// Do testów i zrzutów: kąt i przybliżenie kamery wprost.
export function ustawKamereMakiety(zmiany) {
  if (!st) return;
  Object.assign(st.kamera, zmiany);
  rysujPozniej();
}

export function powiekszMakiete(k) {
  if (!st) return;
  st.kamera.zoom = Math.max(0.25, Math.min(5, st.kamera.zoom * k));
  rysujPozniej();
}
export function widokZPrzodu() {
  if (!st) return;
  const { obrotY, obrotX } = widokModelu(st.model, st.ulozenie);
  Object.assign(st.kamera, { obrotY, obrotX, zoom: 1 });
  rysujPozniej();
}

// ---------- Ujęcia (#181) ----------

// Stan ujęcia (gotowego albo zapisanego): model, położenie, ułożenie, kamera, scena; opcje – światło i tło.
function zastosujStan(s, opcje = null) {
  if (!st) return;
  if (s.model && s.model !== st.model && (st.modele.includes(s.model) || st.inne?.includes(s.model))) ustawModel(s.model, { kamera: false });
  if (s.obwoluta !== undefined && st.obwoluta) { st.pokazObwolute = Boolean(s.obwoluta); przeliczKartki(); }
  st.ulozenie = s.ulozenie === 'stoi' && mozeStac(st.model) ? 'stoi' : 'lezy';
  st.sc = normalizujScene(s.scena);
  const max = polozenia(st.model, st.kartki);
  st.u = Math.max(0, Math.min(max, Math.round(s.u || 0)));
  st.cel = st.u;
  Object.assign(st.kamera, { obrotY: s.kamera.obrotY, obrotX: s.kamera.obrotX, zoom: s.kamera.zoom ?? 1, fov: s.kamera.fov ?? 28, srodek: null, baza: null });
  if (opcje) {
    const uszl = st.opcje.uszlachetnienia;
    st.opcje = normalizujOpcje({ ...st.opcje, ...opcje });
    if (uszl !== st.opcje.uszlachetnienia) odswiezTekstury();
    zapiszOpcje();
  }
  wyborUlozenia.value = st.ulozenie;
  st.scena = null;
  st.kadr = null;
  pokazKontrolki();
  rysujPozniej();
}

// Gotowe ujęcie jednym przyciskiem (id z UJECIA). Zwraca false, gdy nie pasuje do modelu.
export function ustawUjecieMakiety(id) {
  if (!st || !UJECIA[id]?.dla(st.model)) return false;
  const s = UJECIA[id].ustaw(st.model, st.kartki);
  zastosujStan(s, s.opcje || null);
  for (const b of $('#makieta-ujecia').children) b.setAttribute('aria-pressed', String(b.dataset.ujecie === id));
  return true;
}

function pokazUjecia() {
  $('#makieta-ujecia').replaceChildren(...ujeciaModelu(st.model).map((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'makieta-ujecie';
    b.dataset.ujecie = id;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = ikona(UJECIA[id].ikona, { rozmiar: 22 });
    const t = document.createElement('span');
    t.textContent = UJECIA[id].nazwa;
    b.append(t);
    return b;
  }));
}
$('#makieta-ujecia').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ujecie]');
  if (b) ustawUjecieMakiety(b.dataset.ujecie);
});

// Bieżące ujęcie do zapisu w projekcie.
function biezaceUjecie(nazwa) {
  const k = st.kamera;
  return normalizujUjecie({
    id: `uj${Date.now().toString(36)}`, nazwa, model: st.model, u: Math.round(st.cel), ulozenie: st.ulozenie,
    kamera: { obrotY: k.obrotY, obrotX: k.obrotX, zoom: k.zoom, fov: k.fov }, scena: st.sc, opcje: st.opcje, obwoluta: obwolutaWidoczna(),
  });
}

// Zapis ujęcia w projekcie (projekt.makieta.ujecia) – zapisuje się z projektem i ma krok cofania.
export async function zapiszUjecieMakiety(nazwa) {
  if (!st) return null;
  const uj = biezaceUjecie(String(nazwa || '').trim() || `Ujęcie ${(st.projekt.makieta?.ujecia?.length || 0) + 1}`);
  st.projekt.makieta = { ...(st.projekt.makieta || {}), ujecia: [...(st.projekt.makieta?.ujecia || []), uj].slice(-40) };
  await zapiszProjekt();
  pokazZapisane();
  return uj;
}

export async function usunUjecieMakiety(id) {
  if (!st?.projekt.makieta) return;
  const ujecia = st.projekt.makieta.ujecia.filter((u) => u.id !== id);
  if (ujecia.length) st.projekt.makieta = { ...st.projekt.makieta, ujecia }; else delete st.projekt.makieta;
  await zapiszProjekt();
  pokazZapisane();
}

export function pokazZapisaneUjecie(id) {
  const uj = st?.projekt.makieta?.ujecia?.find((u) => u.id === id);
  if (!uj) return false;
  const n = normalizujUjecie(uj);
  zastosujStan({ ...n, model: n.model && (st.modele.includes(n.model) || st.inne?.includes(n.model)) ? n.model : st.model }, n.opcje);
  return true;
}

async function zapiszProjekt() {
  try { (await import('./zapis.js')).zaplanujZapis(); } catch { /* poza edytorem – bez zapisu */ }
}

function pokazZapisane() {
  const lista = st?.projekt.makieta?.ujecia || [];
  $('#makieta-lista-ujec').replaceChildren(...lista.map((u) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nazwa-ujecia';
    b.dataset.pokazUjecie = u.id;
    b.title = 'Pokaż to ujęcie';
    const n = document.createElement('span');
    n.textContent = u.nazwa;
    const o = document.createElement('span');
    o.className = 'ciche';
    o.textContent = [MODELE[u.model] || '', TLA[u.opcje?.tlo] || ''].filter(Boolean).join(' · ');
    b.append(n, o);
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'przycisk-ikona';
    x.dataset.usunUjecie = u.id;
    x.title = 'Usuń ujęcie';
    x.setAttribute('aria-label', `Usuń ujęcie ${u.nazwa}`);
    x.innerHTML = ikona('kosz', { rozmiar: 18 });
    li.append(b, x);
    return li;
  }));
  $('#makieta-zapisane-ile').textContent = lista.length ? `${lista.length} ${odmiana(lista.length, 'ujęcie', 'ujęcia', 'ujęć')}` : '';
  $('#makieta-brak-ujec').hidden = lista.length > 0;
  if (lista.length) $('#makieta-zapisane').open = true;
}
$('#makieta-lista-ujec').addEventListener('click', (e) => {
  const p = e.target.closest('[data-pokaz-ujecie]');
  if (p) { pokazZapisaneUjecie(p.dataset.pokazUjecie); return; }
  const u = e.target.closest('[data-usun-ujecie]');
  if (u) usunUjecieMakiety(u.dataset.usunUjecie);
});

// ---------- Kontrolki „Ujęcie i światło” (#181) ----------

const naStopnie = (r) => Math.round((r * 180) / Math.PI);
const zawin = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;
const ustawWyjscie = (id, tekst) => { const o = $(`output[for="${id}"]`); if (o) o.textContent = tekst; };

// Kamera → suwaki (pomija suwak, który właśnie przesuwa użytkownik).
function pokazKamere() {
  const k = st.kamera;
  const pary = [
    ['makieta-obrot', zawin(naStopnie(k.obrotY)), (v) => `${v}°`],
    ['makieta-pochylenie', naStopnie(k.obrotX), (v) => `${v}°`],
    ['makieta-odleglosc', Math.round(100 / (k.zoom || 1)), (v) => `${v}%`],
    ['makieta-obiektyw', Math.round(k.fov || 28), (v) => `${v}°`],
  ];
  for (const [id, v, f] of pary) {
    const el = $(`#${id}`);
    if (document.activeElement !== el) el.value = String(v);
    ustawWyjscie(id, f(Number(el.value)));
  }
}

function pokazKontrolki() {
  if (!st) return;
  const o = st.opcje;
  const sc = st.sc;
  $('#makieta-grupa-ksiazka').hidden = !ksiazkowy(st.model);
  const domOtw = st.ulozenie === 'stoi' ? 109 : 180;
  $('#makieta-otwarcie').value = String(sc.otwarcie ?? domOtw);
  ustawWyjscie('makieta-otwarcie', `${sc.otwarcie ?? domOtw}°`);
  $('#makieta-uchylenie').value = String(Math.round(sc.uchylenie * 180));
  ustawWyjscie('makieta-uchylenie', `${Math.round(sc.uchylenie * 180)}°`);
  $('#makieta-wachlarz').value = String(sc.wachlarz);
  ustawWyjscie('makieta-wachlarz', String(sc.wachlarz));
  // Rozkładówki: każde położenie kartkowania z opisem.
  const r = $('#makieta-rozkladowka');
  const max = polozenia(st.model, st.kartki);
  if (r.dataset.model !== `${st.model}|${st.wersjaKartek}`) {
    r.replaceChildren(...Array.from({ length: max + 1 }, (_, i) => new Option(opisPolozenia(st.model, st.kartki, i, (j) => st.numery?.[j] ?? null), String(i))));
    r.dataset.model = `${st.model}|${st.wersjaKartek}`;
  }
  r.value = String(Math.round(st.cel));
  $('#makieta-swiatlo').value = o.swiatlo;
  $('#makieta-barwa').value = o.barwa;
  $('#makieta-miekkosc').value = String(Math.round(o.miekkosc * 100));
  ustawWyjscie('makieta-miekkosc', `${Math.round(o.miekkosc * 100)}%`);
  $('#makieta-sila').value = String(Math.round(o.silaCienia * 100));
  ustawWyjscie('makieta-sila', `${Math.round(o.silaCienia * 100)}%`);
  $('#makieta-tlo').value = o.tlo;
  $('#makieta-kolor-tla').value = o.kolorTla;
  $('#makieta-kolor-tla-pole').hidden = o.tlo === 'studio' || o.tlo === 'przezroczyste';
  $('#makieta-ilosc').value = idIlosci(sc.ilosc);
  $('#makieta-wykonczenie').value = o.wykonczenie;
  $('#makieta-papier').value = o.papier;
  $('#makieta-uszl').checked = o.uszlachetnienia;
  $('#makieta-uszl-pole').hidden = st.gosc || !uzyteKoloryDruku(st.projekt).uszlachetnienia.some((u) => u.plyta === 'Spot_UV' || u.plyta.startsWith('Foil_'));
  $('#makieta-spirala').value = o.kolorSpirali;
  $('#makieta-stojak').value = o.kolorStojaka;
  $('#makieta-spirala-pole').hidden = !(st.model === 'notes' || st.model.startsWith('kalendarz'));
  $('#makieta-stojak-pole').hidden = st.model !== 'kalendarz_biurkowy';
  $('#makieta-obwoluta').checked = obwolutaWidoczna();
  pokazKamere();
}

// Zmiana opcji światła / tła / materiałów.
export function ustawOpcjeMakiety(zmiany) {
  if (!st) return;
  const uszl = st.opcje.uszlachetnienia;
  st.opcje = normalizujOpcje({ ...st.opcje, ...zmiany });
  if (uszl !== st.opcje.uszlachetnienia) odswiezTekstury();
  zapiszOpcje();
  pokazKontrolki();
  rysujPozniej();
}
// Strony, okładka i obwoluta od nowa (inny sposób rysowania uszlachetnień).
function odswiezTekstury() {
  st.obrazy = null;
  st.obrazOkladki = null;
  st.maski = null;
  if (st.obwoluta) st.obwoluta.obraz = null;
  st.ostre = null;
  renderer?.zapomnijStrony(true);
  rysujPozniej();
}
// Zmiana ustawień sceny (otwarcie, wachlarz, ilość, uchylenie).
export function ustawSceneMakiety(zmiany) {
  if (!st) return;
  st.sc = normalizujScene({ ...st.sc, ...zmiany });
  st.scena = null;
  st.kadr = null;
  pokazKontrolki();
  rysujPozniej();
}
export function pokazObwoluteMakiety(tak) {
  if (!st?.obwoluta) return;
  st.pokazObwolute = Boolean(tak);
  przeliczKartki();
  pokazKontrolki();
  rysujPozniej();
}
export function domyslneUstawieniaMakiety() {
  if (!st) return;
  st.opcje = normalizujOpcje({});
  st.sc = normalizujScene({});
  Object.assign(st.kamera, widokModelu(st.model, st.ulozenie), { zoom: 1, fov: 28, srodek: null, baza: null });
  zapiszOpcje();
  st.scena = null;
  st.kadr = null;
  pokazKontrolki();
  rysujPozniej();
}

const naZmiane = (id, f, zdarzenie = 'input') => $(`#${id}`).addEventListener(zdarzenie, (e) => { if (st) f(e.target); });
naZmiane('makieta-obrot', (el) => { st.kamera.obrotY = (Number(el.value) * Math.PI) / 180; rysujPozniej(); });
naZmiane('makieta-pochylenie', (el) => { st.kamera.obrotX = (Number(el.value) * Math.PI) / 180; rysujPozniej(); });
naZmiane('makieta-odleglosc', (el) => { st.kamera.zoom = Math.max(0.25, Math.min(5, 100 / Number(el.value))); rysujPozniej(); });
naZmiane('makieta-obiektyw', (el) => { st.kamera.fov = Number(el.value); rysujPozniej(); });
naZmiane('makieta-otwarcie', (el) => ustawSceneMakiety({ otwarcie: Number(el.value) }));
naZmiane('makieta-uchylenie', (el) => ustawSceneMakiety({ uchylenie: Number(el.value) / 180 }));
naZmiane('makieta-wachlarz', (el) => ustawSceneMakiety({ wachlarz: Number(el.value) }));
naZmiane('makieta-ilosc', (el) => ustawSceneMakiety({ ilosc: iloscSceny(el.value) }), 'change');
naZmiane('makieta-rozkladowka', (el) => { st.cel = Number(el.value); st.czas = performance.now(); rysujPozniej(); }, 'change');
naZmiane('makieta-swiatlo', (el) => ustawOpcjeMakiety({ swiatlo: el.value }), 'change');
naZmiane('makieta-barwa', (el) => ustawOpcjeMakiety({ barwa: el.value }), 'change');
naZmiane('makieta-miekkosc', (el) => ustawOpcjeMakiety({ miekkosc: Number(el.value) / 100 }));
naZmiane('makieta-sila', (el) => ustawOpcjeMakiety({ silaCienia: Number(el.value) / 100 }));
naZmiane('makieta-tlo', (el) => ustawOpcjeMakiety({ tlo: el.value }), 'change');
naZmiane('makieta-kolor-tla', (el) => ustawOpcjeMakiety({ kolorTla: el.value }));
naZmiane('makieta-wykonczenie', (el) => ustawOpcjeMakiety({ wykonczenie: el.value }), 'change');
naZmiane('makieta-papier', (el) => ustawOpcjeMakiety({ papier: el.value }), 'change');
naZmiane('makieta-uszl', (el) => ustawOpcjeMakiety({ uszlachetnienia: el.checked }), 'change');
naZmiane('makieta-spirala', (el) => ustawOpcjeMakiety({ kolorSpirali: el.value }));
naZmiane('makieta-stojak', (el) => ustawOpcjeMakiety({ kolorStojaka: el.value }));
naZmiane('makieta-obwoluta', (el) => pokazObwoluteMakiety(el.checked), 'change');
naZmiane('makieta-rozmiar', (el) => { $('#makieta-wlasny-pole').hidden = el.value !== 'wlasny'; }, 'change');
dlg.addEventListener('click', (e) => {
  const a = e.target.closest('[data-akcja]')?.dataset.akcja;
  if (!st || !a) return;
  if (a === 'makieta-domyslne') domyslneUstawieniaMakiety();
  else if (a === 'makieta-animacja') pobierzAnimacje();
  else if (a === 'makieta-zapisz-ujecie') { const pole = $('#makieta-nazwa-ujecia'); zapiszUjecieMakiety(pole.value).then(() => { pole.value = ''; }); }
});

// Obracanie: przeciągnięcie myszą lub palcem; dwa palce – powiększanie; krótkie stuknięcie w prawą / lewą
// połowę – następna / poprzednia kartka.
const palce = new Map();
let start = null;
plotno.addEventListener('pointerdown', (e) => {
  plotno.setPointerCapture(e.pointerId);
  palce.set(e.pointerId, { x: e.clientX, y: e.clientY });
  start = palce.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), ruch: 0 } : null;
});
plotno.addEventListener('pointermove', (e) => {
  const p = palce.get(e.pointerId);
  if (!p || !st) return;
  if (palce.size === 2) {
    const [a, b] = [...palce.values()];
    const przed = Math.hypot(a.x - b.x, a.y - b.y);
    p.x = e.clientX; p.y = e.clientY;
    const [c, d] = [...palce.values()];
    const po = Math.hypot(c.x - d.x, c.y - d.y);
    if (przed > 10) powiekszMakiete(po / przed);
    return;
  }
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (start) start.ruch += Math.abs(dx) + Math.abs(dy);
  const g = widokModelu(st.model, st.ulozenie);
  st.kamera.obrotY = Math.max(g.minY, Math.min(g.maxY, st.kamera.obrotY + dx * 0.01));
  st.kamera.obrotX = Math.max(g.minX, Math.min(g.maxX, st.kamera.obrotX + dy * 0.01));
  rysujPozniej();
});
const puszczony = (e) => {
  palce.delete(e.pointerId);
  if (start && e.type === 'pointerup' && start.ruch < 8 && performance.now() - start.t < 400) {
    const r = plotno.getBoundingClientRect();
    kartkuj(e.clientX > r.left + r.width / 2 ? 1 : -1);
  }
  start = null;
};
plotno.addEventListener('pointerup', puszczony);
plotno.addEventListener('pointercancel', puszczony);
plotno.addEventListener('wheel', (e) => { e.preventDefault(); powiekszMakiete(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
dlg.addEventListener('keydown', (e) => {
  if (e.target.closest('select, input')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); kartkuj(1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); kartkuj(-1); }
});
wybor.addEventListener('change', () => { if (st) ustawModel(wybor.value); });
// Ułożenie (#179): leży / stoi – zapamiętane dla projektu na tym urządzeniu.
export function ustawUlozenie(u) {
  if (!st) return;
  st.ulozenie = u === 'stoi' ? 'stoi' : 'lezy';
  try { localStorage.setItem(`makieta-ulozenie:${st.projekt.id}`, st.ulozenie); } catch { /* bez pamięci */ }
  Object.assign(st.kamera, widokModelu(st.model, st.ulozenie), { zoom: 1, srodek: null, baza: null });
  st.scena = null;
  st.kadr = null;
  wyborUlozenia.value = st.ulozenie;
  pokazKontrolki();
  rysujPozniej();
}
wyborUlozenia.addEventListener('change', () => ustawUlozenie(wyborUlozenia.value));
$('#makieta-wstecz').addEventListener('click', () => kartkuj(-1));
$('#makieta-dalej').addEventListener('click', () => kartkuj(1));
dlg.addEventListener('close', () => {
  partia?.pasek.koniec();
  partia = null;
  obserwator.disconnect();
  cancelAnimationFrame(klatka);
  klatka = 0;
  renderer?.zwolnij();
  renderer = null;
  st = null;
});

// Sekcje bloku, których format różni się od formatu środka (#185) – z zaokrągleniem do 1 mm.
export function niepasujaceSekcje(projekt, ciag) {
  const blok = projekt.sekcje.filter((x) => wBloku(x));
  if (blok.length < 2) return [];
  const f = formatSrodka(blok, ciag);
  return blok.filter((x) => Math.abs(x.wydruk.szerokosc_mm - f.szerokosc_mm) > 1 || Math.abs(x.wydruk.wysokosc_mm - f.wysokosc_mm) > 1)
    .map((x) => ({ sekcja: x, w: Math.round(x.wydruk.szerokosc_mm), h: Math.round(x.wydruk.wysokosc_mm), wb: Math.round(f.szerokosc_mm), hb: Math.round(f.wysokosc_mm) }));
}
