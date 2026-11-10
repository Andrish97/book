/* global fabric */
// Składanie strony z warstw: tło → elementy wzorców „pod” → treść strony →
// elementy wzorców „nad”. Jedno miejsce używane przez edytor, miniatury,
// podgląd, udostępnianie i (później) eksport do PDF, żeby wszędzie wyglądało
// to tak samo.
//
// Składa się zawsze konkretny egzemplarz strony z rozwiniętego ciągu
// (serie.js): z jego numerem, stroną rozkładówki, wierszem danych i sąsiadem,
// którego elementy mogą przechodzić przez grzbiet.

import './fabric-ustawienia.js';
import { sekcjaStrony, wzorceStrony, scalRozkladowke, tloStrony } from './projekt.js';
import { rozwin, wartosciPol } from './serie.js';
import { podstawWObiektach } from './pola.js';
import { przygotujKopie, kopiaRobocza, rozmiarOryginalu } from './obrazy.js';
import { rozlejWatki } from './watki.js';
import { zapewnijCzcionki } from './czcionki.js';
import { toTabela, ulozTabele } from './tabela-obiekt.js';
import './tekst-ramka.js'; // ramka o stałej wysokości i autodopasowanie – także przy składaniu

const ZASTEPCZY_OBRAZ = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150">'
  + '<rect width="200" height="150" fill="#eee" stroke="#c00" stroke-width="4"/>'
  + '<path d="M0 0L200 150M200 0L0 150" stroke="#c00" stroke-width="2"/></svg>');

// Rekurencyjnie podmienia src obrazów:
//  - mapa == null: dataUrl -> "zasob:<id>" (do zapisu),
//  - mapa(id) -> dataUrl (do wczytania).
export function podmienZasoby(obiekty, mapa) {
  return (obiekty || []).map((o) => {
    const kopia = { ...o };
    if (kopia.type === 'image' && kopia.zasob) {
      kopia.src = mapa ? mapa(kopia.zasob) : `zasob:${kopia.zasob}`;
    }
    if (Array.isArray(kopia.objects)) kopia.objects = podmienZasoby(kopia.objects, mapa);
    return kopia;
  });
}

// Adres obrazu zasobu: zwykle lżejsza kopia robocza (js/obrazy.js), a przy
// eksporcie (oryginaly = true) zawsze pełny oryginał.
export const zrodloObrazu = (zasoby, oryginaly = false) => (id) => (!oryginaly && kopiaRobocza(zasoby?.[id])) || zasoby?.[id]?.dataUrl || ZASTEPCZY_OBRAZ;

// Czcionki użyte w obiektach muszą być wczytane, zanim Fabric zmierzy tekst.
const ozyw = async (json) => { await zapewnijCzcionki(json); return fabric.util.enlivenObjects(json); };

// Obraz z pola: kolumna tabeli podaje nazwę pliku wgranego do projektu.
// Podmieniony obraz wpisuje się w ramkę obrazu-wzoru (ramka_pola), bez zmiany proporcji.
const bezRozszerzenia = (n) => String(n || '').trim().toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '');

function obrazyZPol(obiekty, wartosc, zasoby) {
  return obiekty.map((o) => {
    if (Array.isArray(o.objects)) return { ...o, objects: obrazyZPol(o.objects, wartosc, zasoby) };
    if (o.type !== 'image' || !o.pole?.kolumna) return o;
    const nazwa = wartosc(o.pole.kolumna, null);
    if (nazwa === undefined) return o;
    const id = Object.keys(zasoby || {}).find((k) => bezRozszerzenia(zasoby[k].nazwa) === bezRozszerzenia(nazwa));
    const ramka = { w: (o.width || 0) * (o.scaleX ?? 1), h: (o.height || 0) * (o.scaleY ?? 1) };
    // Rozmiar i przycięcie należały do obrazu-wzoru; podmieniony obraz ma własne.
    const { width, height, cropX, cropY, ...reszta } = o;
    // Brak pliku o tej nazwie: znak „brak obrazu” w miejscu ramki.
    return { ...reszta, zasob: id || 'brak-pliku', ramka_pola: ramka };
  });
}

function wpiszWRamki(obiekty) {
  for (const o of obiekty) {
    if (o.type === 'group') {
      wpiszWRamki(o.getObjects());
      if (toTabela(o)) ulozTabele(o); // po podstawieniu danych wiersze tabeli rosną razem z treścią
      continue;
    }
    const r = o.ramka_pola;
    if (o.type !== 'image' || !r || !o.width || !o.height) continue;
    // Podmieniony obraz dostał wymiary źródła – przeliczamy je na piksele oryginału.
    const { nw, nh } = rozmiarOryginalu(o);
    o.set({ width: nw, height: nh });
    if (o.pole?.tryb === 'wypelnij') {
      // Obraz wypełnia całą ramkę: skala według ciaśniejszego boku, nadmiar przycięty. Domyślnie po równo
      // z obu stron (zostaje środek zdjęcia); `pole.kadr` wybiera, która część ma zostać: góra, dół, lewa, prawa.
      const skala = Math.max(r.w / nw, r.h / nh);
      const [szer, wys] = [r.w / skala, r.h / skala];
      const kadr = o.pole.kadr;
      const cropX = kadr === 'lewa' ? 0 : (kadr === 'prawa' ? nw - szer : (nw - szer) / 2);
      const cropY = kadr === 'gora' ? 0 : (kadr === 'dol' ? nh - wys : (nh - wys) / 2);
      o.set({ width: szer, height: wys, cropX, cropY, scaleX: skala, scaleY: skala });
    } else {
      const skala = Math.min(r.w / o.width, r.h / o.height);
      const srodek = { x: o.left + r.w / 2, y: o.top + r.h / 2 }; // obrót ramki pomijamy przy środkowaniu
      o.set({ scaleX: skala, scaleY: skala, left: srodek.x - (o.width * skala) / 2, top: srodek.y - (o.height * skala) / 2 });
    }
    o.setCoords();
  }
}

// Odbicie lustrzane położenia względem pionowej osi strony (plan 4.6):
// element przechodzi na drugą stronę, tekst i obraz nie są odwracane,
// wyrównanie tekstu zmienia się na przeciwne.
function odbij(o, szerokosc) {
  const srodek = o.getRelativeCenterPoint();
  odbijWMiejscu(o);
  o.setPositionByOrigin(new fabric.Point(szerokosc - srodek.x, srodek.y), 'center', 'center');
  o.setCoords();
}

// Odbicie samego elementu: obrót w drugą stronę, wyrównanie tekstu na przeciwne;
// w grupie – także układ jej części (położenia części liczą się od środka grupy).
function odbijWMiejscu(o) {
  o.set({ angle: -(o.angle || 0) });
  if (o.type === 'line') o.set('flipX', !o.flipX);
  if (typeof o.textAlign === 'string') {
    o.set('textAlign', { left: 'right', right: 'left' }[o.textAlign] || o.textAlign);
  }
  if (o.type !== 'group' || toTabela(o)) return; // tabela przechodzi na drugą stronę, ale kolumny zostają w swojej kolejności
  for (const czesc of o.getObjects()) {
    const s = czesc.getRelativeCenterPoint(); // położenie części liczone od środka grupy
    odbijWMiejscu(czesc);
    czesc.setPositionByOrigin(new fabric.Point(-s.x, s.y), 'center', 'center');
    czesc.setCoords();
  }
  o.dirty = true;
}

// cel: strona projektu albo egzemplarz z ciągu → egzemplarz (dla strony: pierwszy).
const egzemplarz = (cel, ciag) => (cel && cel.klucz && cel.strona ? cel : ciag.pierwszy.get(cel.id));

// Treść egzemplarza z podstawionymi polami (teksty i obrazy z kolumn).
function trescEgzemplarza(projekt, egz, ciag) {
  const wartosc = wartosciPol(projekt, egz, ciag);
  return obrazyZPol(podstawWObiektach(egz.strona.obiekty, wartosc), wartosc, projekt.zasoby);
}

// Elementy wzorców dla strony (jej pierwszego egzemplarza) albo dla egzemplarza,
// jako gotowe obiekty Fabric: { pod: [], nad: [] }.
export async function warstwyWzorcow(projekt, cel, ciag = rozwin(projekt), { oryginaly = false } = {}) {
  const wynik = { pod: [], nad: [] };
  const egz = egzemplarz(cel, ciag);
  const wzorce = wzorceStrony(projekt, egz.strona);
  if (!wzorce.length) return wynik;
  const wartosc = wartosciPol(projekt, egz, ciag);
  const lewa = egz.bok === 'lewa';
  const szerokosc = egz.sekcja.wydruk.szerokosc_mm;
  for (const w of wzorce) {
    if (!w.obiekty.length) continue;
    const surowe = obrazyZPol(podstawWObiektach(w.obiekty, wartosc), wartosc, projekt.zasoby);
    if (!oryginaly) await przygotujKopie(projekt.zasoby, surowe);
    const obiekty = await ozyw(podmienZasoby(surowe, zrodloObrazu(projekt.zasoby, oryginaly)));
    wpiszWRamki(obiekty);
    rozlejWatki(obiekty); // po podstawieniu danych tekst ma inną długość
    for (const o of obiekty) {
      if (w.lustro && lewa) odbij(o, szerokosc);
      o.set({
        zWzorca: true, idWzorca: w.id, nazwaWzorca: w.nazwa, selectable: false, evented: false, excludeFromExport: true, hoverCursor: 'default',
      });
      (o.warstwa === 'nad' ? wynik.nad : wynik.pod).push(o);
    }
  }
  return wynik;
}

// Czy element sąsiedniej strony może sięgać na tę stronę. Liczone z zapasem
// (okrąg opisany na elemencie), bo resztę i tak przytnie krawędź płótna.
// Element wzorca (żywy obiekt w układzie swojej strony) wychodzi przez grzbiet dalej niż na spad –
// jego dalsza część należy wtedy do sąsiedniej strony rozkładówki, tak jak przy zwykłych elementach.
export function wzorzecPrzezGrzbiet(o, bok, szerokosc, spad) {
  o.setCoords();
  const x = Object.values(o.aCoords || {}).map((p) => p.x);
  if (!x.length) return false;
  return bok === 'lewa' ? Math.max(...x) > szerokosc + spad + 0.01 : Math.min(...x) < -spad - 0.01;
}

export function siegaPrzezGrzbiet(o, bokElementu, szerokosc, spad) {
  const zasieg = Math.hypot((o.width || 0) * (o.scaleX ?? 1), (o.height || 0) * (o.scaleY ?? 1)) + (o.strokeWidth || 0);
  const x = o.left || 0;
  return bokElementu === 'prawa' ? x - zasieg < spad : x + zasieg > szerokosc - spad;
}

// Elementy egzemplarza w kolejności warstw, razem z tymi z sąsiedniej strony
// rozkładówki, które przechodzą przez grzbiet (przesunięte do układu tej strony).
// Każda strona ma podstawione własne dane.
export function obiektyZSasiadem(projekt, cel, ciag = rozwin(projekt)) {
  const egz = egzemplarz(cel, ciag);
  const wlasne = trescEgzemplarza(projekt, egz, ciag);
  if (!egz.sasiad) return wlasne;
  const obce = trescEgzemplarza(projekt, egz.sasiad, ciag);
  const { szerokosc_mm: w, spad_mm: b } = egz.sekcja.wydruk;
  const lewa = egz.bok === 'lewa';
  const obcy = lewa ? 'prawa' : 'lewa';
  const [l, p] = lewa ? [wlasne, obce] : [obce, wlasne];
  return scalRozkladowke(l, p)
    .filter(({ o, bok }) => bok !== obcy || siegaPrzezGrzbiet(o, obcy, w, b))
    .map(({ o, bok }) => (bok === obcy ? { ...o, left: (o.left || 0) + (lewa ? w : -w) } : o));
}

// Ramki tekstu egzemplarza po podstawieniu danych i przelaniu – same teksty, bez rysowania.
// Służy do sprawdzenia przed drukiem, czy tekst mieści się w ramce na każdej powielonej stronie.
// Zwraca [{ obiekt (Fabric), zrodlo: 'strona' | 'wzorzec', id }].
export async function tekstyEgzemplarza(projekt, egz, ciag) {
  const wartosc = wartosciPol(projekt, egz, ciag);
  const zbierz = (obiekty, wynik = []) => {
    for (const o of obiekty || []) {
      if (o.visible === false) continue; // ukryte (także warunkiem „Z danych”) nie są drukowane
      if (o.type === 'textbox') wynik.push(o);
      // Komórki tabeli nie są sprawdzane: wiersz rośnie razem z tekstem, więc tekst zawsze się mieści.
      if (Array.isArray(o.objects) && !o.tabela) zbierz(o.objects, wynik);
    }
    return wynik;
  };
  const wynik = [];
  const zrodla = [['strona', egz.strona.obiekty], ...wzorceStrony(projekt, egz.strona).map((w) => ['wzorzec', w.obiekty])];
  for (const [zrodlo, obiekty] of zrodla) {
    const ramki = zbierz(podstawWObiektach(obiekty, wartosc)).filter((o) => o.ramka_h > 0 || o.watek);
    if (!ramki.length) continue;
    const zywe = await ozyw(ramki);
    const idWatkow = new Set(ramki.filter((o) => o.watek).map((o) => o.watek));
    const zInnychStron = zrodlo === 'strona' && idWatkow.size ? await ramkiWatkowZInnychStron(projekt, egz, ciag, idWatkow, new Set(ramki.map((o) => o.id))) : [];
    rozlejWatki([...zywe, ...zInnychStron]);
    for (const o of zywe) wynik.push({ obiekt: o, zrodlo, id: o.id });
  }
  return wynik;
}

// Tekst płynący przez strony: ramki podanych wątków z pozostałych stron, z danymi podstawionymi tak
// jak na tych stronach. W serii brana jest strona z tego samego powielenia bloku, poza serią –
// pierwszy egzemplarz strony. Zwraca żywe ramki (do przelewania, nie do rysowania).
async function ramkiWatkowZInnychStron(projekt, egz, ciag, idWatkow, obecne) {
  const ramki = [];
  for (const s of projekt.strony) {
    if (s === egz.strona || !s.obiekty.some((o) => o.type === 'textbox' && idWatkow.has(o.watek))) continue;
    const e = (egz.blok && ciag.egzemplarze.find((x) => x.strona === s && x.blok === egz.blok && x.nrEgz === egz.nrEgz)) || ciag.pierwszy.get(s.id);
    if (!e) continue;
    const wartosc = wartosciPol(projekt, e, ciag);
    ramki.push(...podstawWObiektach(s.obiekty.filter((o) => o.type === 'textbox' && idWatkow.has(o.watek) && !obecne.has(o.id)), wartosc));
  }
  return ramki.length ? ozyw(ramki) : [];
}

// Tabele strony (i jej wzorców) po podstawieniu danych i ułożeniu wierszy – do sprawdzenia, czy
// urośnięta tabela mieści się na stronie. Zwraca [{ obiekt, zrodlo, id }]; bez tabel – od razu [].
export async function tabeleEgzemplarza(projekt, egz, ciag) {
  const zrodla = [['strona', egz.strona.obiekty], ...wzorceStrony(projekt, egz.strona).map((w) => ['wzorzec', w.obiekty])];
  if (!zrodla.some(([, obiekty]) => (obiekty || []).some((o) => o.tabela))) return [];
  const wartosc = wartosciPol(projekt, egz, ciag);
  const wynik = [];
  for (const [zrodlo, obiekty] of zrodla) {
    const tabele = podstawWObiektach((obiekty || []).filter((o) => o.tabela), wartosc).filter((o) => o.visible !== false);
    if (!tabele.length) continue;
    const zywe = await ozyw(tabele);
    wpiszWRamki(zywe);
    for (const o of zywe) wynik.push({ obiekt: o, zrodlo, id: o.id });
  }
  return wynik;
}

// Składa stronę (albo wzorzec) do gotowych obiektów: dane podstawione, obrazy wczytane, teksty
// wpisane w ramki i przelane, warstwy wzorców pod i nad treścią. Zwraca { wydruk, tlo, obiekty }
// – obiekty w kolejności rysowania, w układzie strony (mm).
export async function zlozCel(projekt, cel, { ciag, oryginaly = false } = {}) {
  const jestWzorcem = projekt.wzorce.includes(cel);
  const rozwiniety = jestWzorcem ? null : (ciag || rozwin(projekt));
  const egz = jestWzorcem ? null : egzemplarz(cel, rozwiniety);
  const wydruk = jestWzorcem ? cel.wydruk : sekcjaStrony(projekt, egz.strona).wydruk;
  const tresc = jestWzorcem ? cel.obiekty : obiektyZSasiadem(projekt, egz, rozwiniety);
  if (!oryginaly) await przygotujKopie(projekt.zasoby, tresc);
  const wlasne = await ozyw(podmienZasoby(tresc, zrodloObrazu(projekt.zasoby, oryginaly)));
  wpiszWRamki(wlasne);
  // Po podstawieniu danych tekst ma inną długość – połączone ramki przelewają go od nowa.
  // Ramki tych samych wątków z innych stron biorą udział w przelewaniu, ale nie są tu rysowane.
  const idWatkow = new Set(tresc.filter((o) => o.watek).map((o) => o.watek));
  const zInnychStron = idWatkow.size && egz ? await ramkiWatkowZInnychStron(projekt, egz, rozwiniety, idWatkow, new Set(tresc.map((o) => o.id))) : [];
  if (idWatkow.size) rozlejWatki([...wlasne, ...zInnychStron]);
  const warstwy = jestWzorcem ? { pod: [], nad: [] } : await warstwyWzorcow(projekt, egz, rozwiniety, { oryginaly });
  // Elementy wzorców sąsiedniej strony rozkładówki, które przechodzą przez grzbiet, widać także tutaj.
  if (egz?.sasiad) {
    const { szerokosc_mm: w, spad_mm: b } = wydruk;
    const obce = await warstwyWzorcow(projekt, egz.sasiad, rozwiniety, { oryginaly });
    for (const rodzaj of ['pod', 'nad']) {
      for (const o of obce[rodzaj]) {
        if (!wzorzecPrzezGrzbiet(o, egz.sasiad.bok, w, b)) continue;
        o.set({ left: o.left + (egz.bok === 'lewa' ? w : -w) });
        o.setCoords();
        warstwy[rodzaj].push(o);
      }
    }
  }
  return { wydruk, tlo: jestWzorcem ? (cel.tlo || '#ffffff') : tloStrony(projekt, egz.strona), obiekty: [...warstwy.pod, ...wlasne, ...warstwy.nad] };
}

// Renderuje stronę (jej pierwszy egzemplarz), egzemplarz z ciągu albo wzorzec
// do obrazu (dataURL). opcje: szerokoscPx (z ewentualnym spadem), spad
// (domyślnie tak), ciag (rozwinięty projekt – warto podać przy wielu stronach),
// oryginaly (pełne obrazy zamiast kopii roboczych – do eksportu).
export async function renderujCel(projekt, cel, { szerokoscPx = 200, spad = true, ciag, format = 'png', jakosc = 0.88, oryginaly = false } = {}) {
  const { wydruk, tlo, obiekty } = await zlozCel(projekt, cel, { ciag, oryginaly });
  const { szerokosc_mm: w, wysokosc_mm: h } = wydruk;
  const b = spad ? wydruk.spad_mm : 0;
  const k = szerokoscPx / (w + 2 * b);
  const plotno = new fabric.StaticCanvas(undefined, {
    width: Math.round((w + 2 * b) * k),
    height: Math.round((h + 2 * b) * k),
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  plotno.backgroundColor = tlo;
  for (const o of obiekty) plotno.add(o);
  plotno.setViewportTransform([k, 0, 0, k, b * k, b * k]);
  plotno.renderAll();
  const url = plotno.toDataURL({ format, quality: jakosc });
  plotno.dispose();
  return url;
}
