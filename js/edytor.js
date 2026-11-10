/* global fabric */
// Silnik edycji arkusza (sekcja 4 planu). Arkusz to jedna strona albo
// rozkładówka: dwie strony obok siebie na wspólnym płótnie, żeby element
// mógł leżeć przez grzbiet.
//
// Wszystkie obiekty Fabric mają współrzędne w milimetrach. Punkt (0, 0) to
// lewy górny róg arkusza po przycięciu (bez spadu); prawa strona rozkładówki
// zaczyna się w x = szerokość strony. Na piksele przeliczamy tylko widok:
// viewportTransform = skala (px/mm × zoom) + przesunięcie o spad.

import { uid, ptNaMm, scalRozkladowke } from './projekt.js';
import { DOMYSLNA } from './czcionki.js';
import { podmienZasoby, zrodloObrazu } from './zlozenie.js';
import { przyciagnij, pomiary, przyciagnijKrawedz } from './przyciaganie.js';
import { znajdzPola, polaZDanych } from './pola.js';
import { nieMiesciSie } from './tekst-ramka.js';
import { przygotujKopie, rozmiarOryginalu } from './obrazy.js';
import { watki, rozlej, kolejnoscCzytania, przeniesTekst, odlaczRamke, WSPOLNE_W_WATKU } from './watki.js';

export const PX_NA_MM = 96 / 25.4;

// Własne właściwości obiektów, które zapisujemy razem z JSON-em Fabric.
export const WLASNE_POLA = [
  'id', 'nazwa', 'zasob', 'bez_ostrzezen',
  'warstwa', // element wzorca: 'nad' = nad treścią strony (domyślnie pod)
  'zablokowany', 'styl',
  'z', // kolejność na rozkładówce (żeby po zapisie stron osobno dało się ją odtworzyć)
  // Na etap 2 (pola z danymi): już teraz przenoszone przez zapis.
  'pole', 'autodopasowanie', 'min_rozmiar',
  'ramka_h', 'wyrownanie_pion', 'rozmiar_bazowy', // ramka tekstu o stałej wysokości (tekst-ramka.js)
  'ramka_pola',
  'boki', 'gwiazda', // wielokąt foremny albo gwiazda (punkty liczone z tych dwóch liczb)
  'lista', 'lista_start', // wypunktowanie / numerowanie akapitów (tekst-ramka.js)
  'watek', 'watek_nr', 'lacznik', // przelewanie tekstu między ramkami (watki.js)
  'z_danych', // kolor i przesunięcie zależne od pola z danych (pola.js)
  'bez_pol', // klamry w tym tekście to zwykły tekst, nie pola
  'wielkosc_liter', // 'wielkie' | 'male' – tylko wygląd, treść zostaje jak wpisana
];

export const TEKST_ZACHETY = 'Kliknij dwa razy, aby edytować';

// Punkty wielokąta foremnego (albo gwiazdy) wpisanego w okrąg o promieniu r,
// z wierzchołkiem u góry.
export function punktyWielokata(boki, gwiazda = false, r = 20) {
  const n = Math.min(24, Math.max(3, Math.round(boki) || 3));
  const punkty = [];
  const krokow = gwiazda ? n * 2 : n;
  for (let i = 0; i < krokow; i += 1) {
    const promien = gwiazda && i % 2 ? r * 0.45 : r;
    const kat = (i / krokow) * 2 * Math.PI - Math.PI / 2;
    punkty.push({ x: r + promien * Math.cos(kat), y: r + promien * Math.sin(kat) });
  }
  return punkty;
}


// Fabric 5 ustawia nieistniejącą wartość textBaseline ('alphabetical'), co przy
// każdym rysowaniu tekstu wypisuje ostrzeżenie w konsoli. Ta sama funkcja z poprawną wartością.
fabric.Text.prototype._setTextStyles = function _setTextStyles(ctx, charStyle, forMeasuring) {
  ctx.textBaseline = 'alphabetic';
  if (this.path) {
    ctx.textBaseline = { center: 'middle', ascender: 'top', descender: 'bottom' }[this.pathAlign] || 'alphabetic';
  }
  ctx.font = this._getFontDeclaration(charStyle, forMeasuring);
};

// Wygląd uchwytów: powiększony obszar dotyku na tablecie (4.7).
fabric.Object.prototype.set({
  transparentCorners: false,
  cornerColor: '#ffffff',
  cornerStrokeColor: '#2563eb',
  borderColor: '#2563eb',
  cornerStyle: 'circle',
  cornerSize: 11,
  touchCornerSize: 40,
  borderScaleFactor: 1.5,
});

export class Edytor extends EventTarget {
  constructor(elementPlotna, kontener) {
    super();
    this.kontener = kontener;
    this.zoom = 1;
    this.pokazProwadnice = true;
    this.wydruk = null;
    this.strony = []; // strony arkusza: { x, marg }
    this.tla = ['#ffffff'];
    this.aktywna = 0; // strona arkusza, do której trafiają nowe elementy
    this.zasoby = {};
    this.ostrzezenia = [];
    this._wczytywanie = false;
    this._renderujeEksport = false;
    this._liniePrzyciagania = [];
    this._pomiary = []; // strzałki z odległościami do sąsiednich elementów
    this._cele = null; // ramki innych elementów, zapamiętane na czas jednego przeciągnięcia
    this.widok = { siatka_mm: 5, siatka: false, do_siatki: false, do_elementow: true };
    // Prowadnice własne: { os: 'x' | 'y', poz (mm na arkuszu), strona (indeks strony arkusza) }.
    // Pionowa (os x) stoi w poz na osi x; pozioma biegnie przez swoją stronę.
    this.prowadnice = [];
    this._prowadnicaWRuchu = null;
    // Czy pole {nazwa} jest znane na stronie arkusza o danym indeksie (ustawia aplikacja).
    this.znanePole = () => true;

    this.canvas = new fabric.Canvas(elementPlotna, {
      preserveObjectStacking: true,
      stopContextMenu: true,
      selectionColor: 'rgba(37, 99, 235, 0.08)',
      selectionBorderColor: '#2563eb',
      selectionLineWidth: 1,
      targetFindTolerance: 6,
    });

    const c = this.canvas;
    c.on('before:render', (e) => this._rysujTla(e.ctx));
    c.on('after:render', (e) => this._poRenderowaniu(e.ctx));
    // Kliknięcie w drugą stronę rozkładówki robi z niej stronę bieżącą.
    c.on('mouse:down', (e) => {
      if (this.strony.length < 2 || !e.pointer) return;
      const v = c.viewportTransform;
      this.ustawAktywna(this.stronaW((e.pointer.x - v[4]) / v[0]), true);
    });
    c.on('selection:created', () => this._emitujZaznaczenie());
    c.on('selection:updated', () => this._emitujZaznaczenie());
    c.on('selection:cleared', () => this._emitujZaznaczenie());
    c.on('object:moving', (e) => this._przyciagnij(e.target, e.e));
    c.on('object:scaling', (e) => this._przyciagnijRozmiar(e.target, e.e, e.transform));
    c.on('object:resizing', (e) => this._przyciagnijRozmiar(e.target, e.e, e.transform));
    c.on('object:rotating', (e) => {
      // Z Shiftem obrót skacze co 15°.
      if (e.e?.shiftKey) e.target.rotate(Math.round(e.target.angle / 15) * 15);
    });
    c.on('mouse:down', () => { this._cele = null; this._kopiaZAlt = false; });
    c.on('mouse:down', (e) => this._chwycProwadnice(e));
    c.on('mouse:move', (e) => this._ruchNadProwadnica(e));
    c.on('mouse:up', () => {
      this._cele = null;
      this._kopiaZAlt = false;
      if (this._liniePrzyciagania.length || (this._pomiary.length && !this._pomiaryStale)) {
        this._liniePrzyciagania = [];
        this._pomiary = [];
        c.requestRenderAll();
      }
    });
    c.on('object:modified', (e) => {
      utrwalSkaleTekstu(e.target);
      this.oznaczZmiane();
    });
    c.on('object:added', (e) => {
      if (this._wczytywanie || e.target?.zWzorca) return;
      this._uporzadkujWzorce();
      this.oznaczZmiane();
    });
    c.on('object:removed', () => this.oznaczZmiane());
    c.on('text:editing:exited', () => this.oznaczZmiane());
    // Kadrowanie: podwójne kliknięcie obrazu zaczyna, kliknięcie poza ramką kończy.
    c.on('mouse:dblclick', (e) => { if (e.target?.type === 'image' && !e.target.zWzorca) this.kadruj(e.target); });
    c.on('selection:cleared', () => { if (this._kadr) this.zakonczKadrowanie(true); });
    c.on('selection:updated', () => { if (this._kadr && this.aktywny !== this._kadr.ramka) this.zakonczKadrowanie(true); });
    c.on('text:changed', () => this._emitujZaznaczenie());
    c.on('text:selection:changed', () => this._emitujZaznaczenie());
    c.on('text:editing:entered', () => this._emitujZaznaczenie());
    // Podczas przesuwania/skalowania odświeżamy pola liczbowe na bieżąco.
    for (const zdarzenie of ['object:moving', 'object:scaling', 'object:rotating']) {
      c.on(zdarzenie, () => this._emitujZaznaczenie());
    }

    this._obslugaGestow();
  }

  // ---------- Geometria widoku ----------

  get skala() {
    return PX_NA_MM * this.zoom;
  }

  // marginesy: { lewy, prawy, gora, dol, grzbiet: 'lewy' | 'prawy' | null }
  // – już przeliczone dla konkretnej strony (w rozkładówkach są lustrzane).
  // Tablica dwóch zestawów = rozkładówka: [lewa strona, prawa strona].
  ustawWydruk(wydruk, marginesy) {
    this.wydruk = { ...wydruk };
    const m = wydruk.marginesy || {};
    const lista = [].concat(marginesy || { lewy: m.wewnetrzny ?? 10, prawy: m.zewnetrzny ?? 10, gora: m.gora ?? 10, dol: m.dol ?? 10, grzbiet: null });
    this.strony = lista.map((marg, i) => ({ x: i * wydruk.szerokosc_mm, marg }));
    this.aktywna = Math.min(this.aktywna, this.strony.length - 1);
    this._dopasujRozmiar();
    this.przeliczOstrzezenia();
  }

  // Marginesy strony bieżącej.
  get marg() { return this.strony[this.aktywna].marg; }
  get rozkladowka() { return this.strony.length > 1; }
  get szerokoscArkusza() { return this.strony.length * this.wydruk.szerokosc_mm; }

  // Indeks strony arkusza, na której leży punkt x (mm).
  stronaW(x) {
    return Math.min(this.strony.length - 1, Math.max(0, Math.floor(x / this.wydruk.szerokosc_mm)));
  }

  ustawAktywna(i, zKlikniecia = false) {
    const nowa = Math.min(this.strony.length - 1, Math.max(0, i));
    if (nowa === this.aktywna) return;
    this.aktywna = nowa;
    this.dispatchEvent(new Event('geometria')); // linijki liczą od rogu strony bieżącej
    if (zKlikniecia) this.dispatchEvent(new CustomEvent('strona', { detail: nowa }));
  }

  // Środek obiektu w układzie arkusza – także wtedy, gdy obiekt jest częścią zaznaczenia.
  _srodekObiektu(o) {
    const p = o.getCenterPoint();
    return o.group ? fabric.util.transformPoint(p, o.group.calcTransformMatrix()) : p;
  }

  _dopasujRozmiar() {
    const { wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const w = this.szerokoscArkusza;
    const s = this.skala;
    this.canvas.setDimensions({
      width: Math.round((w + 2 * b) * s),
      height: Math.round((h + 2 * b) * s),
    });
    this.canvas.setViewportTransform([s, 0, 0, s, b * s, b * s]);
    this.canvas.calcOffset();
    this.canvas.requestRenderAll();
    this.dispatchEvent(new Event('geometria'));
  }

  ustawZoom(zoom, punktEkranu = null) {
    const nowy = Math.min(8, Math.max(0.1, zoom));
    const k = this.kontener;
    // Punkt (w px płótna), który ma zostać pod palcem / kursorem.
    let px; let py; let ex; let ey;
    const rect = this.canvas.upperCanvasEl.getBoundingClientRect();
    if (punktEkranu) {
      ex = punktEkranu.x; ey = punktEkranu.y;
    } else {
      const kr = k.getBoundingClientRect();
      ex = kr.left + kr.width / 2; ey = kr.top + kr.height / 2;
    }
    px = (ex - rect.left) / this.zoom;
    py = (ey - rect.top) / this.zoom;
    this.zoom = nowy;
    this._dopasujRozmiar();
    const rect2 = this.canvas.upperCanvasEl.getBoundingClientRect();
    k.scrollLeft += rect2.left + px * nowy - ex;
    k.scrollTop += rect2.top + py * nowy - ey;
    this.dispatchEvent(new CustomEvent('zoom', { detail: nowy }));
  }

  dopasujDoOkna() {
    if (!this.wydruk) return;
    const { wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const w = this.szerokoscArkusza;
    // Odstęp na pływający pasek narzędzi (u góry) i kontrolki widoku (u dołu).
    const arkusz = this.kontener.firstElementChild;
    const st = arkusz ? getComputedStyle(arkusz) : null;
    const px = (v) => parseFloat(v) || 0;
    const mw = st ? px(st.paddingLeft) + px(st.paddingRight) : 48;
    const mh = st ? px(st.paddingTop) + px(st.paddingBottom) : 48;
    const dw = Math.max(100, this.kontener.clientWidth - mw);
    const dh = Math.max(100, this.kontener.clientHeight - mh);
    const z = Math.min(dw / ((w + 2 * b) * PX_NA_MM), dh / ((h + 2 * b) * PX_NA_MM));
    this.zoom = Math.max(0.1, z);
    this._dopasujRozmiar();
    this.dispatchEvent(new CustomEvent('zoom', { detail: this.zoom }));
  }

  // ---------- Wczytywanie i zapis arkusza ----------

  // warstwy: { pod: [], nad: [] } – gotowe elementy wzorców (zlozenie.js):
  // widoczne, ale niezaznaczalne i niezapisywane razem ze stroną.
  wczytajStrone(strona, zasoby, warstwy = null) {
    return this.wczytajArkusz([{ ...strona, warstwy }], zasoby);
  }

  // strony: [{ id, obiekty, tlo, warstwy }] – jedna albo dwie (lewa, prawa),
  // tyle samo, ile zestawów marginesów dostało ustawWydruk.
  async wczytajArkusz(strony, zasoby) {
    await przygotujKopie(zasoby, strony.flatMap((s) => s.obiekty || []));
    const w = this.wydruk.szerokosc_mm;
    const b = this.wydruk.spad_mm;
    const h = this.wydruk.wysokosc_mm;
    this.zasoby = zasoby;
    this._znacznikStrony = strony.map((s) => s.id).join('+') || Symbol('strona');
    this.tla = strony.map((s) => s.tlo || '#ffffff');
    this.prowadnice = strony.flatMap((s, i) => [
      ...(s.prowadnice?.x || []).map((poz) => ({ os: 'x', poz: poz + i * w, strona: i })),
      ...(s.prowadnice?.y || []).map((poz) => ({ os: 'y', poz, strona: i })),
    ]);
    this._warstwy = { pod: [], nad: [] };
    strony.forEach((s, i) => {
      for (const rodzaj of ['pod', 'nad']) {
        for (const o of s.warstwy?.[rodzaj] || []) {
          if (strony.length > 1) {
            // Element wzorca należy do swojej strony: nie wychodzi przez grzbiet na sąsiednią.
            o.set({ left: o.left + i * w });
            o.clipPath = new fabric.Rect({
              left: i === 0 ? -b : w, top: -b, width: w + b, height: h + 2 * b, absolutePositioned: true,
            });
            o.setCoords();
          }
          this._warstwy[rodzaj].push(o);
        }
      }
    });
    this._wczytywanie = true;
    this.canvas.discardActiveObject();
    const json = strony.length > 1
      ? scalRozkladowke(strony[0].obiekty, strony[1].obiekty).map(({ o, bok }) => (bok === 'prawa' ? { ...o, left: (o.left || 0) + w } : o))
      : strony[0].obiekty;
    const obiekty = podmienZasoby(json, zrodloObrazu(zasoby));
    await new Promise((ok) => {
      this.canvas.loadFromJSON({ objects: obiekty }, ok);
    });
    for (const o of this.canvas.getObjects()) if (!o.id) o.id = uid('o'); // starsze projekty
    this._dodajWzorce();
    this._zastosujBlokady();
    this._dopasujRozmiar();
    this._wczytywanie = false;
    this.przeliczOstrzezenia();
    this._emitujZaznaczenie();
  }

  _dodajWzorce() {
    const { pod, nad } = this._warstwy;
    pod.forEach((o, i) => this.canvas.insertAt(o, i, false));
    nad.forEach((o) => this.canvas.add(o));
    this.canvas.requestRenderAll();
  }

  // Elementy wzorców „pod” zawsze na samym dole, „nad” zawsze na wierzchu.
  _uporzadkujWzorce() {
    const { pod, nad } = this._warstwy || { pod: [], nad: [] };
    if (!pod.length && !nad.length) return;
    const bylo = this._wczytywanie;
    this._wczytywanie = true;
    for (let i = pod.length - 1; i >= 0; i -= 1) this.canvas.sendToBack(pod[i]);
    for (const o of nad) this.canvas.bringToFront(o);
    this._wczytywanie = bylo;
  }

  get maWzorce() {
    return Boolean(this._warstwy && (this._warstwy.pod.length || this._warstwy.nad.length));
  }

  // Obiekty arkusza w postaci do zapisu (obrazy jako "zasob:<id>"), osobno dla
  // każdej strony: [[...], [...]]. Na rozkładówce element należy do strony, na
  // której leży jego środek; współrzędne są liczone od rogu tej strony, a pole
  // `z` pamięta kolejność na wspólnym płótnie.
  // Elementy wzorca mają excludeFromExport, więc nie trafiają do zapisu.
  obiektyStron() {
    const zywe = this.canvas.getObjects().filter((o) => !o.excludeFromExport);
    const json = podmienZasoby(this.canvas.toJSON(WLASNE_POLA).objects, null);
    if (!this.rozkladowka) return [json];
    const w = this.wydruk.szerokosc_mm;
    const wynik = this.strony.map(() => []);
    json.forEach((o, k) => {
      const i = zywe[k] ? this.stronaW(this._srodekObiektu(zywe[k]).x) : 0;
      wynik[i].push({ ...o, left: (o.left || 0) - i * w, z: k });
    });
    return wynik;
  }

  // Obiekty pojedynczej strony (arkusz z jedną stroną albo wzorzec).
  obiektyStrony() {
    return this.obiektyStron().flat();
  }

  get tloAktywnej() { return this.tla[this.aktywna] || '#ffffff'; }

  ustawTlo(kolor, i = this.aktywna) {
    this.tla[i] = kolor;
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
  }

  // Tła stron rysujemy pod obiektami (każda strona rozkładówki ma swoje).
  _rysujTla(ctx) {
    if (!this.wydruk) return;
    const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const v = this.canvas.viewportTransform;
    const n = this.strony.length;
    ctx.save();
    ctx.transform(v[0], 0, 0, v[3], v[4], v[5]);
    this.strony.forEach((s, i) => {
      ctx.fillStyle = this.tla[i] || '#ffffff';
      const x1 = i === 0 ? -b : s.x;
      const x2 = i === n - 1 ? s.x + w + b : s.x + w;
      ctx.fillRect(x1, -b, x2 - x1, h + 2 * b);
    });
    ctx.restore();
  }

  // Wycinek płótna z jedną stroną arkusza (ze spadem), w pikselach płótna.
  _wycinek(i) {
    if (!this.rozkladowka) return {};
    const { szerokosc_mm: w, spad_mm: b } = this.wydruk;
    const s = this.skala;
    return { left: this.strony[i].x * s, top: 0, width: (w + 2 * b) * s, height: this.canvas.getHeight() };
  }

  _obraz(mnoznik, i) {
    this._renderujeEksport = true;
    try {
      return this.canvas.toDataURL({ format: 'png', multiplier: mnoznik, ...this._wycinek(i) });
    } finally {
      this._renderujeEksport = false;
      this.canvas.requestRenderAll();
    }
  }

  // Miniatura strony arkusza (bez prowadnic i uchwytów).
  miniatura(szerokoscPx = 160, i = this.aktywna) {
    const { szerokosc_mm: w, spad_mm: b } = this.wydruk;
    return this._obraz(szerokoscPx / ((w + 2 * b) * this.skala), i);
  }

  // PNG strony arkusza w zadanej rozdzielczości (ze spadem).
  png(dpi = 150, i = this.aktywna) {
    return this._obraz((dpi / 25.4) / this.skala, i);
  }

  // ---------- Zmiany i historia (cofanie) ----------

  oznaczZmiane() {
    if (this._wczytywanie || this._kadr) return;
    this._pilnujWatkow();
    this.przeliczOstrzezenia();
    this.dispatchEvent(new Event('zmiana'));
  }

  // ---------- Dodawanie obiektów ----------

  _wstaw(obj) {
    obj.set({ id: uid('o') });
    this.canvas.add(obj);
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
    return obj;
  }

  // Położenie nowego elementu: środek strony bieżącej.
  _srodek(szer, wys) {
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    return { left: this.strony[this.aktywna].x + (w - szer) / 2, top: (h - wys) / 2 };
  }

  dodajTekst(tresc = TEKST_ZACHETY) {
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const szer = Math.max(20, w - this.marg.lewy - this.marg.prawy);
    const t = new fabric.Textbox(tresc, {
      left: this.strony[this.aktywna].x + this.marg.lewy,
      top: (h - 10) / 2,
      width: szer,
      fontFamily: DOMYSLNA,
      fontSize: ptNaMm(14),
      lineHeight: 1.2,
      fill: '#1a1a1a',
      textAlign: 'left',
      strokeWidth: 0, // domyślne 1 (= 1 mm) poszerzałoby ramkę obiektu
    });
    return this._wstaw(t);
  }

  dodajProstokat() {
    return this._wstaw(new fabric.Rect({
      ...this._srodek(40, 25), width: 40, height: 25,
      fill: '#d9e6f2', stroke: '#1a1a1a', strokeWidth: 0.3, strokeUniform: true,
    }));
  }

  dodajElipse() {
    return this._wstaw(new fabric.Ellipse({
      ...this._srodek(36, 24), rx: 18, ry: 12,
      fill: '#f2e2d9', stroke: '#1a1a1a', strokeWidth: 0.3, strokeUniform: true,
    }));
  }

  // Wielokąt foremny (domyślnie trójkąt); liczbę boków i gwiazdę zmienia się we właściwościach.
  dodajWielokat(boki = 3, gwiazda = false) {
    const p = new fabric.Polygon(punktyWielokata(boki, gwiazda, 18), {
      fill: '#e2f2d9', stroke: '#1a1a1a', strokeWidth: 0.3, strokeUniform: true, boki, gwiazda: gwiazda || undefined,
    });
    p.set(this._srodek(p.width, p.height));
    return this._wstaw(p);
  }

  // Zmienia liczbę boków wielokąta albo robi z niego gwiazdę; środek i wielkość zostają.
  przeksztalcWielokat(obj, boki, gwiazda) {
    const srodek = obj.getCenterPoint();
    const [w, h] = [obj.getScaledWidth(), obj.getScaledHeight()];
    obj.set({ boki: Math.min(24, Math.max(3, Math.round(boki) || 3)), gwiazda: gwiazda || undefined });
    obj.set({ points: punktyWielokata(obj.boki, gwiazda, 18) });
    obj._setPositionDimensions({});
    obj.set({ scaleX: w / (obj.width + obj.strokeWidth), scaleY: h / (obj.height + obj.strokeWidth) });
    obj.setPositionByOrigin(srodek, 'center', 'center');
    obj.dirty = true;
    obj.setCoords();
  }

  dodajLinie() {
    const { left, top } = this._srodek(60, 0);
    return this._wstaw(new fabric.Line([left, top, left + 60, top], {
      stroke: '#1a1a1a', strokeWidth: 0.5, strokeUniform: true,
    }));
  }

  // dataUrl -> obraz dopasowany do 60% szerokości strony.
  async dodajObraz(dataUrl, nazwaPliku, zasoby) {
    const id = uid('z');
    zasoby[id] = { nazwa: nazwaPliku, dataUrl };
    // Duże zdjęcie pokazujemy lżejszą kopią roboczą; wymiary obiektu zostają w pikselach oryginału.
    await przygotujKopie(zasoby, [{ type: 'image', zasob: id }]);
    const img = await new Promise((ok, blad) => {
      fabric.Image.fromURL(zrodloObrazu(zasoby)(id), (o) => (o ? ok(o) : blad(new Error('Nie udało się wczytać obrazu.'))));
    });
    const { nw, nh } = rozmiarOryginalu(img);
    img.set({ width: nw, height: nh });
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const skala = Math.min((w * 0.6) / img.width, (h * 0.6) / img.height);
    img.set({ zasob: id, nazwa: nazwaPliku, scaleX: skala, scaleY: skala });
    img.set(this._srodek(img.width * skala, img.height * skala));
    this.dispatchEvent(new Event('zasoby'));
    return this._wstaw(img);
  }

  // ---------- Operacje na zaznaczeniu ----------

  get aktywny() {
    return this.canvas.getActiveObject() || null;
  }

  usun() {
    const obiekty = this.canvas.getActiveObjects();
    if (!obiekty.length) return;
    if (this.aktywny?.isEditing) return;
    this.canvas.discardActiveObject();
    // Tekst usuwanej ramki wątku przechodzi do sąsiedniej – znika ramka, nie treść.
    for (const o of obiekty) {
      const zostaja = this._ramkiWatku(o).filter((r) => !obiekty.includes(r));
      if (!zostaja.length) continue;
      const przed = zostaja.filter((r) => r.watek_nr < o.watek_nr).at(-1);
      przeniesTekst(o, przed || zostaja[0], Boolean(przed));
    }
    obiekty.forEach((o) => this.canvas.remove(o));
    this.canvas.requestRenderAll();
  }

  async duplikuj() {
    const akt = this.aktywny;
    if (!akt) return;
    const kopia = await new Promise((ok) => akt.clone(ok, WLASNE_POLA));
    this.canvas.discardActiveObject();
    kopia.set({ left: kopia.left + 5, top: kopia.top + 5, evented: true });
    if (kopia.type === 'activeSelection') {
      kopia.canvas = this.canvas;
      kopia.forEachObject((o) => { o.set({ id: uid('o') }); this.canvas.add(o); });
      kopia.setCoords();
      this.canvas.setActiveObject(kopia);
    } else {
      this._wstaw(kopia);
    }
    this.canvas.requestRenderAll();
  }

  // ---------- Przelewanie tekstu między ramkami, kolumny, tabela ----------

  _ramkiWatku(obj) {
    return obj?.watek ? (watki(this.canvas.getObjects().filter((o) => !o.zWzorca)).get(obj.watek) || []) : [];
  }

  // Opis wątku zaznaczonej ramki: { nr, ile } albo null.
  watekRamki(obj = this.aktywny) {
    const ramki = this._ramkiWatku(obj);
    return ramki.length > 1 ? { nr: ramki.indexOf(obj) + 1, ile: ramki.length } : null;
  }

  // Porządkuje wątki po każdej zmianie i przelewa tekst. Kopia ramki (powielenie,
  // wklejenie) ma ten sam numer co oryginał – zostaje zwykłą, niepołączoną ramką.
  _pilnujWatkow() {
    const akt = this.aktywny;
    for (const wszystkie of watki(this.canvas.getObjects().filter((o) => !o.zWzorca)).values()) {
      const numery = new Set();
      const ramki = [];
      for (const r of wszystkie) {
        if (numery.has(r.watek_nr)) odlaczRamke(r); else { numery.add(r.watek_nr); ramki.push(r); }
      }
      if (ramki.length < 2) { ramki.forEach(odlaczRamke); continue; }
      ramki.forEach((r, i) => {
        r.watek_nr = i;
        if (!(r.ramka_h > 0)) r.ramka_h = r.height; // tekst płynie dalej tylko z ramki o stałej wysokości
      });
      // W trakcie pisania tekst zostaje na miejscu; przeleje się po wyjściu z ramki.
      if (ramki.some((r) => r.isEditing)) continue;
      if (ramki.includes(akt)) {
        for (const r of ramki) if (r !== akt) for (const k of WSPOLNE_W_WATKU) if (r[k] !== akt[k]) r.set(k, akt[k]);
      }
      rozlej(ramki);
    }
  }

  // Łączy zaznaczone ramki tekstu: tekst, który nie mieści się w pierwszej,
  // płynie do następnej (kolejność: z góry na dół, obok siebie – od lewej).
  polaczRamki() {
    const akt = this.aktywny;
    if (!akt || akt.type !== 'activeSelection') return false;
    const wybrane = akt.getObjects();
    if (wybrane.length < 2 || wybrane.some((o) => o.type !== 'textbox' || o.zWzorca)) return false;
    this.canvas.discardActiveObject(); // poza zaznaczeniem ramki mają położenie na stronie
    const id = uid('w');
    kolejnoscCzytania(wybrane).forEach((r, i) => {
      if (r.text === TEKST_ZACHETY && i) { r.text = ''; r.styles = {}; }
      r.set({ watek: id, watek_nr: i, lacznik: i ? '\n' : undefined });
      if (!(r.ramka_h > 0)) r.ramka_h = r.height;
      r.autodopasowanie = undefined;
    });
    this.canvas.setActiveObject(new fabric.ActiveSelection(wybrane, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    this._emitujZaznaczenie();
    return true;
  }

  // Nowa ramka z ciągiem dalszym tekstu: obok zaznaczonej, a gdy się nie mieści – pod nią.
  async dodajRamkeDalsza(odstep = 5) {
    const akt = this.aktywny;
    if (!akt || akt.type !== 'textbox' || akt.zWzorca || akt.isEditing) return null;
    const ramki = this._ramkiWatku(akt);
    const nowa = await new Promise((ok) => akt.clone(ok, WLASNE_POLA));
    const szer = akt.getScaledWidth();
    const wys = akt.getScaledHeight();
    const prawaKrawedz = this.strony[this.aktywna].x + this.wydruk.szerokosc_mm;
    const obok = akt.left + 2 * szer + odstep <= prawaKrawedz + 0.01;
    if (!(akt.ramka_h > 0)) akt.ramka_h = akt.height;
    akt.autodopasowanie = undefined;
    if (!akt.watek) akt.set({ watek: uid('w'), watek_nr: 0 });
    for (const r of ramki) if (r.watek_nr > akt.watek_nr) r.watek_nr += 1;
    nowa.set({
      id: uid('o'), text: '', styles: {}, evented: true,
      left: obok ? akt.left + szer + odstep : akt.left,
      top: obok ? akt.top : akt.top + wys + odstep,
      ramka_h: akt.ramka_h, autodopasowanie: undefined,
      watek: akt.watek, watek_nr: akt.watek_nr + 1, lacznik: '\n',
    });
    this.canvas.add(nowa);
    this.canvas.setActiveObject(nowa);
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    this._emitujZaznaczenie();
    return nowa;
  }

  // Dzieli ramkę na n kolumn: połączone ramki obok siebie, przez które płynie tekst.
  async podzielNaKolumny(n, odstep = 4) {
    const akt = this.aktywny;
    if (!akt || akt.type !== 'textbox' || akt.zWzorca || akt.isEditing || akt.watek || !(n > 1)) return false;
    const szer = akt.getScaledWidth();
    const kolumna = (szer - (n - 1) * odstep) / n;
    if (kolumna < 8) return false;
    const stala = akt.ramka_h > 0;
    akt.autodopasowanie = undefined;
    akt.set({ width: kolumna / akt.scaleX });
    akt.initDimensions();
    if (!stala) {
      // Kolumny równej wysokości: tyle wierszy na kolumnę, żeby tekst rozłożył się po równo.
      const wierszy = Math.ceil(akt._textLines.length / n);
      let h = 0;
      for (let i = 0; i < wierszy; i += 1) h += akt.getHeightOfLine(i);
      akt.ramka_h = Math.max(h, akt.getHeightOfLine(0)) + 0.01;
      akt.initDimensions();
    }
    // Najpierw wszystkie kopie (to trwa chwilę), dopiero potem łączenie – jednym ruchem,
    // żeby porządkowanie wątków nie zobaczyło ramki połączonej z niczym.
    const nowe = await Promise.all(Array.from({ length: n - 1 }, () => new Promise((ok) => akt.clone(ok, WLASNE_POLA))));
    const id = uid('w');
    akt.set({ watek: id, watek_nr: 0 });
    nowe.forEach((nowa, i) => {
      nowa.set({ id: uid('o'), text: '', styles: {}, evented: true, left: akt.left + (i + 1) * (kolumna + odstep), watek: id, watek_nr: i + 1, lacznik: '\n' });
      this.canvas.add(nowa);
    });
    akt.setCoords();
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    this._emitujZaznaczenie();
    return true;
  }

  // Rozłącza wątek zaznaczonej ramki: każda ramka zostaje ze swoją częścią tekstu.
  rozlaczRamki() {
    const akt = this.aktywny;
    const zaznaczone = akt?.type === 'activeSelection' ? akt.getObjects() : [akt];
    const ramki = new Set(zaznaczone.flatMap((o) => this._ramkiWatku(o)));
    if (!ramki.size) return false;
    ramki.forEach(odlaczRamke);
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    this._emitujZaznaczenie();
    return true;
  }

  // Tabela: siatka linii (jedna grupa) i osobna ramka tekstu w każdej komórce.
  // Komórki są zwykłymi ramkami – można w nich pisać, wstawiać pola i je formatować.
  dodajTabele({ wiersze = 3, kolumny = 3, naglowek = true, wysokoscWiersza = 9 } = {}) {
    const W = Math.min(40, Math.max(1, Math.round(wiersze)));
    const K = Math.min(12, Math.max(1, Math.round(kolumny)));
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    // Linie siatki mają grubość – tabela jest o włos węższa niż pole między marginesami.
    const szer = Math.max(20, w - this.marg.lewy - this.marg.prawy) - 0.6;
    const x0 = this.strony[this.aktywna].x + this.marg.lewy + 0.3;
    const wys = Math.min(wysokoscWiersza * W, h - 20);
    const hw = wys / W;
    const y0 = (h - wys) / 2;
    const kol = szer / K;
    // Linia jest kładziona środkiem – inaczej Fabric przesuwa ją o pół grubości kreski.
    const linia = (x1, y1, x2, y2, grubosc = 0.25) => new fabric.Line([x1, y1, x2, y2], {
      stroke: '#1a1a1a', strokeWidth: grubosc, strokeUniform: true, originX: 'center', originY: 'center', left: (x1 + x2) / 2, top: (y1 + y2) / 2,
    });
    const linie = [];
    for (let i = 0; i <= K; i += 1) linie.push(linia(x0 + i * kol, y0, x0 + i * kol, y0 + wys));
    for (let i = 0; i <= W; i += 1) linie.push(linia(x0, y0 + i * hw, x0 + szer, y0 + i * hw, naglowek && i === 1 ? 0.5 : 0.25));
    const siatka = new fabric.Group(linie, { id: uid('o'), nazwa: `Siatka tabeli ${W}×${K}` });
    const odstep = 1.5;
    const komorki = [];
    for (let r = 0; r < W; r += 1) {
      for (let k = 0; k < K; k += 1) {
        const pierwszy = naglowek && r === 0;
        komorki.push(new fabric.Textbox(pierwszy ? `Kolumna ${k + 1}` : '', {
          id: uid('o'), nazwa: `Komórka ${String.fromCharCode(65 + k)}${r + 1}`,
          left: x0 + k * kol + odstep, top: y0 + r * hw, width: kol - 2 * odstep,
          ramka_h: hw, wyrownanie_pion: 'srodek',
          fontFamily: DOMYSLNA, fontSize: ptNaMm(9), fontWeight: pierwszy ? 'bold' : 'normal', lineHeight: 1.15,
          fill: '#1a1a1a', textAlign: 'left', strokeWidth: 0,
        }));
      }
    }
    this.canvas.discardActiveObject();
    this.canvas.add(siatka, ...komorki);
    this.canvas.setActiveObject(new fabric.ActiveSelection([siatka, ...komorki], { canvas: this.canvas }));
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    return { siatka, komorki };
  }

  // ---------- Schowek (kopiuj / wklej, także między stronami) ----------

  get maSchowek() { return Boolean(this._schowek); }

  async kopiuj() {
    const akt = this.aktywny;
    if (!akt || akt.isEditing) return false;
    this._schowek = await new Promise((ok) => akt.clone(ok, WLASNE_POLA));
    this._wklejen = 0;
    this._schowekZ = this._znacznikStrony;
    this._schowekX = this.strony[this.stronaW(this._srodekObiektu(akt).x)].x;
    // Schowek systemu dostaje tekst elementu (albo jego nazwę). Dzięki temu Ctrl+V wkleja to,
    // co skopiowano ostatnio – a nie obraz, który został w schowku systemu sprzed godziny.
    navigator.clipboard?.writeText(akt.type === 'textbox' && akt.text ? akt.text : `Seriodruk: ${opisObiektu(akt)}`).catch(() => {});
    this.dispatchEvent(new Event('schowek'));
    return true;
  }

  async wytnij() {
    if (await this.kopiuj()) this.usun();
  }

  // Na tym samym arkuszu wklejka jest lekko przesunięta, na innym trafia w to
  // samo miejsce strony bieżącej.
  async wklej() {
    if (!this._schowek) return;
    const kopia = await new Promise((ok) => this._schowek.clone(ok, WLASNE_POLA));
    let dx = 0;
    if (this._schowekZ === this._znacznikStrony) this._wklejen += 1;
    else {
      dx = this.strony[this.aktywna].x - this._schowekX;
      this._schowek.set({ left: this._schowek.left + dx });
      this._schowekX += dx;
      this._wklejen = 0;
      this._schowekZ = this._znacznikStrony;
    }
    const d = 5 * this._wklejen;
    this.canvas.discardActiveObject();
    kopia.set({ left: kopia.left + dx + d, top: kopia.top + d, evented: true });
    if (kopia.type === 'activeSelection') {
      kopia.canvas = this.canvas;
      kopia.forEachObject((o) => { o.set({ id: uid('o') }); this.canvas.add(o); });
      kopia.setCoords();
      this.canvas.setActiveObject(kopia);
    } else {
      this._wstaw(kopia);
    }
    this.canvas.requestRenderAll();
  }

  // ---------- Wyrównywanie i rozmieszczanie ----------

  // Rozbija zaznaczenie na obiekty z położeniem na stronie, wykonuje fn i zaznacza ponownie.
  _naZaznaczonych(fn) {
    const akt = this.aktywny;
    if (!akt) return;
    const obiekty = akt.type === 'activeSelection' ? akt.getObjects().slice() : [akt];
    this.canvas.discardActiveObject();
    const ramki = obiekty.map((o) => { o.setCoords(); const r = o.getBoundingRect(true, true); return { o, x: r.left, y: r.top, w: r.width, h: r.height }; });
    fn(ramki);
    for (const { o } of ramki) o.setCoords();
    if (obiekty.length > 1) this.canvas.setActiveObject(new fabric.ActiveSelection(obiekty, { canvas: this.canvas }));
    else this.canvas.setActiveObject(obiekty[0]);
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // jak: 'lewo' | 'srodekX' | 'prawo' | 'gora' | 'srodekY' | 'dol'.
  // Kilka obiektów wyrównuje się do siebie, jeden – do obszaru w marginesach
  // strony, na której leży (element przez grzbiet: do obu stron razem).
  wyrownaj(jak) {
    this._naZaznaczonych((ramki) => {
      const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
      const obszar = (r) => {
        const przez = this._przezGrzbiet(r.x, r.x + r.w);
        const a = przez ? this.strony[0] : this.strony[this.stronaW(r.x + r.w / 2)];
        const z = przez ? this.strony[1] : a;
        return { x1: a.x + a.marg.lewy, x2: z.x + w - z.marg.prawy, y1: a.marg.gora, y2: h - a.marg.dol };
      };
      const pole = ramki.length > 1
        ? {
          x1: Math.min(...ramki.map((r) => r.x)), x2: Math.max(...ramki.map((r) => r.x + r.w)),
          y1: Math.min(...ramki.map((r) => r.y)), y2: Math.max(...ramki.map((r) => r.y + r.h)),
        }
        : obszar(ramki[0]);
      for (const r of ramki) {
        if (r.o.zablokowany) continue;
        const dx = { lewo: pole.x1 - r.x, srodekX: (pole.x1 + pole.x2) / 2 - (r.x + r.w / 2), prawo: pole.x2 - (r.x + r.w) }[jak] || 0;
        const dy = { gora: pole.y1 - r.y, srodekY: (pole.y1 + pole.y2) / 2 - (r.y + r.h / 2), dol: pole.y2 - (r.y + r.h) }[jak] || 0;
        r.o.set({ left: r.o.left + dx, top: r.o.top + dy });
      }
    });
  }

  // Równe odstępy między trzema lub więcej obiektami. os: 'x' | 'y'.
  rozloz(os) {
    this._naZaznaczonych((ramki) => {
      if (ramki.length < 3) return;
      const [p, d, wl] = os === 'x' ? ['x', 'w', 'left'] : ['y', 'h', 'top'];
      const kolejno = ramki.slice().sort((a, b) => a[p] - b[p]);
      const zakres = kolejno.at(-1)[p] + kolejno.at(-1)[d] - kolejno[0][p];
      const odstep = (zakres - kolejno.reduce((suma, r) => suma + r[d], 0)) / (kolejno.length - 1);
      let nastepny = kolejno[0][p];
      for (const r of kolejno) {
        if (!r.o.zablokowany) r.o.set(wl, r.o[wl] + (nastepny - r[p]));
        nastepny += r[d] + odstep;
      }
    });
  }

  // ---------- Blokada położenia i rozmiaru ----------

  ustawBlokade(obj, wlaczona) {
    obj.zablokowany = wlaczona || undefined;
    const b = Boolean(wlaczona);
    obj.set({
      lockMovementX: b, lockMovementY: b, lockScalingX: b, lockScalingY: b, lockRotation: b,
      hasControls: !b, hoverCursor: b ? 'default' : null,
    });
    this.canvas.requestRenderAll();
  }

  _zastosujBlokady() {
    for (const o of this.canvas.getObjects()) if (o.zablokowany && !o.zWzorca) this.ustawBlokade(o, true);
  }

  grupuj() {
    const akt = this.aktywny;
    if (!akt || akt.type !== 'activeSelection') return;
    const grupa = akt.toGroup();
    grupa.set({ id: uid('o') });
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  rozgrupuj() {
    const akt = this.aktywny;
    if (!akt || akt.type !== 'group') return;
    akt.toActiveSelection();
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  warstwa(kierunek) {
    const akt = this.aktywny;
    if (!akt) return;
    const c = this.canvas;
    ({
      wierzch: () => c.bringToFront(akt),
      wyzej: () => c.bringForward(akt),
      nizej: () => c.sendBackwards(akt),
      spod: () => c.sendToBack(akt),
    })[kierunek]();
    this._uporzadkujWzorce();
    c.requestRenderAll();
    this.oznaczZmiane();
  }

  przesun(dx, dy) {
    const akt = this.aktywny;
    if (!akt || akt.isEditing || akt.zablokowany) return;
    akt.set({ left: akt.left + dx, top: akt.top + dy });
    akt.setCoords();
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Elementy, które da się zaznaczyć (bez elementów wzorców i ukrytych).
  _zaznaczalne() {
    return this.canvas.getObjects().filter((o) => !o.zWzorca && !o.kadr && o.visible !== false && o.selectable !== false);
  }

  zaznaczWszystko() {
    const obiekty = this._zaznaczalne();
    if (!obiekty.length) return;
    this.canvas.discardActiveObject();
    this.canvas.setActiveObject(obiekty.length === 1 ? obiekty[0] : new fabric.ActiveSelection(obiekty, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
  }

  odznacz() {
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  }

  // Następny (1) albo poprzedni (−1) element w kolejności warstw.
  zaznaczSasiedni(kierunek) {
    const obiekty = this._zaznaczalne();
    if (!obiekty.length) return;
    const i = obiekty.indexOf(this.aktywny);
    const nastepny = obiekty[(i + kierunek + obiekty.length) % obiekty.length] || obiekty[0];
    this.canvas.discardActiveObject();
    this.canvas.setActiveObject(i < 0 && kierunek < 0 ? obiekty.at(-1) : nastepny);
    this.canvas.requestRenderAll();
  }

  edytujTekst() {
    const akt = this.aktywny;
    if (!akt || akt.type !== 'textbox' || akt.isEditing) return;
    akt.enterEditing();
    akt.selectAll();
    this.canvas.requestRenderAll();
  }

  przelaczBlokade() {
    const akt = this.aktywny;
    if (!akt) return;
    const obiekty = akt.type === 'activeSelection' ? akt.getObjects() : [akt];
    const wlacz = !obiekty.every((o) => o.zablokowany);
    for (const o of obiekty) this.ustawBlokade(o, wlacz);
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Formatowanie tekstu ze skrótu: w trakcie pisania dotyczy zaznaczonego
  // fragmentu, poza tym – całego tekstu. zmiana(czytaj) zwraca właściwości do
  // ustawienia; caly = właściwość całego akapitu (np. wyrównanie).
  formatujTekst(zmiana, caly = false) {
    const obj = this.aktywny;
    if (!obj || obj.type !== 'textbox') return false;
    const fragment = !caly && obj.isEditing && obj.selectionStart !== obj.selectionEnd;
    const czytaj = (klucz) => {
      if (!fragment) return obj[klucz];
      const st = obj.getSelectionStyles(obj.selectionStart, obj.selectionStart + 1, true)[0] || {};
      return st[klucz] ?? obj[klucz];
    };
    const wlasciwosci = zmiana(czytaj);
    if (fragment) obj.setSelectionStyles(wlasciwosci);
    else {
      if (!caly) for (const klucz of Object.keys(wlasciwosci)) obj.removeStyle?.(klucz);
      obj.set(wlasciwosci);
    }
    obj.initDimensions?.();
    obj.dirty = true;
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
    return true;
  }

  // Wstawia pole {nazwa} do zaznaczonego tekstu: w trakcie pisania – w miejscu
  // kursora, poza tym – na końcu tekstu.
  wstawPole(nazwa) {
    const obj = this.aktywny;
    if (!obj || obj.type !== 'textbox') return;
    const pole = `{${nazwa}}`;
    if (obj.isEditing) {
      const start = obj.selectionStart;
      obj.insertChars(pole, null, start, obj.selectionEnd);
      obj.selectionStart = start + pole.length;
      obj.selectionEnd = start + pole.length;
      if (obj.hiddenTextarea) obj.hiddenTextarea.value = obj.text;
      obj._updateTextarea?.();
    } else {
      const t = obj.text || '';
      obj.set('text', t === 'Kliknij dwa razy, aby edytować' ? pole : `${t}${t && !/\s$/.test(t) ? ' ' : ''}${pole}`);
    }
    obj.initDimensions();
    obj.dirty = true;
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Pola nieznane na stronie, na której leży tekst (do ostrzeżeń i podświetlenia).
  _nieznanePola(o) {
    if (o.type !== 'textbox' || !o.text.includes('{') || o.bez_pol) return [];
    const strona = this.strony.length > 1 ? this.stronaW(this._srodekObiektu(o).x) : 0;
    return znajdzPola(o.text).filter((p) => !this.znanePole(p.nazwa, strona));
  }

  // Połączone ramki: gdy zaznaczona jest jedna z nich, linia pokazuje, dokąd płynie tekst.
  _rysujWatek(ctx, X, Y) {
    const akt = this.aktywny;
    const zaznaczone = akt?.type === 'activeSelection' ? akt.getObjects() : (akt ? [akt] : []);
    const ramka = zaznaczone.find((o) => o.watek);
    if (!ramka || akt.type === 'activeSelection') return;
    const ramki = this._ramkiWatku(ramka);
    if (ramki.length < 2) return;
    ctx.save();
    ctx.strokeStyle = '#7c3aed';
    ctx.fillStyle = '#7c3aed';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    for (let i = 0; i < ramki.length - 1; i += 1) {
      const a = ramki[i].aCoords?.br;
      const b = ramki[i + 1].aCoords?.tl;
      if (!a || !b) continue;
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Tło pod polami {…} w tekstach: fioletowe – pole zostanie podstawione,
  // czerwone – takiego pola nie ma. Tylko w edytorze, nie w wydruku.
  _podswietlPola(ctx, X, Y) {
    for (const o of this.canvas.getObjects()) {
      if (o.zWzorca || o.type !== 'textbox' || o.visible === false || o.bez_pol || !o.text.includes('{') || !o.__charBounds) continue;
      const pola = znajdzPola(o.text);
      if (!pola.length) continue;
      const nieznane = new Set(this._nieznanePola(o).map((x) => x.start));
      const m = o.calcTransformMatrix();
      const lewo0 = o._getLeftOffset();
      const gora0 = o._getTopOffset();
      const goraWiersza = [];
      for (const p of pola) {
        // Prostokąty pola – osobny dla każdego wiersza, przez który przechodzi.
        const czesci = new Map();
        for (let i = p.start; i < p.koniec; i += 1) {
          const { lineIndex: w, charIndex: z } = o.get2DCursorLocation(i);
          const znak = o.__charBounds[w]?.[z];
          if (!znak) continue;
          const x = lewo0 + o._getLineLeftOffset(w) + znak.left;
          const cz = czesci.get(w);
          if (cz) cz.x2 = Math.max(cz.x2, x + znak.kernedWidth); else czesci.set(w, { x1: x, x2: x + znak.kernedWidth });
        }
        ctx.fillStyle = nieznane.has(p.start) ? 'rgba(220, 38, 38, 0.22)' : 'rgba(124, 58, 237, 0.16)';
        for (const [w, cz] of czesci) {
          if (goraWiersza[w] === undefined) {
            let y = gora0;
            for (let k = 0; k < w; k += 1) y += o.getHeightOfLine(k);
            goraWiersza[w] = y;
          }
          const y1 = goraWiersza[w];
          const y2 = y1 + o.getHeightOfLine(w) / o.lineHeight;
          ctx.beginPath();
          [[cz.x1, y1], [cz.x2, y1], [cz.x2, y2], [cz.x1, y2]].forEach(([px, py], n) => {
            const pkt = fabric.util.transformPoint({ x: px, y: py }, m);
            if (n === 0) ctx.moveTo(X(pkt.x), Y(pkt.y)); else ctx.lineTo(X(pkt.x), Y(pkt.y));
          });
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  // Po zmianie właściwości z panelu.
  zatwierdz() {
    const akt = this.aktywny;
    if (akt) akt.setCoords();
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
  }

  zaznacz(id) {
    const obj = this.canvas.getObjects().find((o) => o.id === id);
    if (!obj) return;
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
  }

  _emitujZaznaczenie() {
    this.dispatchEvent(new CustomEvent('zaznaczenie', { detail: this.aktywny }));
  }

  // ---------- Ostrzeżenia o układzie (4.5) ----------

  // Czy ramka x1..x2 leży świadomie na obu stronach rozkładówki: zaczyna się
  // przed wewnętrznym marginesem lewej strony i kończy za wewnętrznym prawej.
  // Element, który tylko wystaje w pas przy grzbiecie, nadal dostaje ostrzeżenie.
  _przezGrzbiet(x1, x2) {
    if (!this.rozkladowka) return false;
    const [l, p] = this.strony;
    return x1 < p.x - l.marg.prawy && x2 > p.x + p.marg.lewy;
  }

  przeliczOstrzezenia() {
    if (!this.wydruk) return;
    const { szerokosc_mm: wStrony, wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const w = this.szerokoscArkusza;
    const tol = 0.05;
    const lista = [];
    for (const o of this.canvas.getObjects()) {
      if (o.bez_ostrzezen || o.zWzorca || o.kadr || o === this._kadr?.obj) continue;
      o.setCoords();
      const r = this._prostokatNaStronie(o);
      const x1 = r.left; const y1 = r.top;
      const x2 = r.left + r.width; const y2 = r.top + r.height;
      // Obszar bezpieczny: marginesy strony z elementem albo – dla elementu
      // przez grzbiet – zewnętrzne marginesy obu stron.
      const przez = this._przezGrzbiet(x1, x2);
      const a = przez ? this.strony[0] : this.strony[this.stronaW((x1 + x2) / 2)];
      const z = przez ? this.strony[1] : a;
      const m = { lewy: a.x + a.marg.lewy, prawy: w - (z.x + wStrony - z.marg.prawy), gora: a.marg.gora, dol: a.marg.dol };
      let typ = null;
      if (x2 < -b || y2 < -b || x1 > w + b || y1 > h + b) {
        typ = 'poza_strona';
      } else if (x1 < -b - tol || y1 < -b - tol || x2 > w + b + tol || y2 > h + b + tol) {
        typ = 'poza_spadem';
      } else if (x1 < m.lewy - tol || y1 < m.gora - tol || x2 > w - m.prawy + tol || y2 > h - m.dol + tol) {
        typ = 'w_marginesie';
      }
      if (typ) lista.push({ id: o.id, typ, obiekt: opisObiektu(o) });
      if (nieMiesciSie(o)) lista.push({ id: o.id, typ: 'nie_miesci_sie', obiekt: opisObiektu(o) });
      const nrStrony = this.strony.length > 1 ? this.stronaW(this._srodekObiektu(o).x) : 0;
      const nieznane = [...this._nieznanePola(o).map((p) => p.nazwa), ...polaZDanych(o).filter((n) => !this.znanePole(n, nrStrony))];
      if (nieznane.length) lista.push({ id: o.id, typ: 'nieznane_pole', obiekt: opisObiektu(o), pola: [...new Set(nieznane)] });
    }
    this.ostrzezenia = lista;
    this.dispatchEvent(new CustomEvent('ostrzezenia', { detail: lista }));
  }

  // Prostokąt opisany na elemencie, w milimetrach strony. Element z zaznaczenia
  // kilku naraz ma położenie liczone względem tego zaznaczenia – trzeba je przeliczyć.
  _prostokatNaStronie(o) {
    if (!o.group) return o.getBoundingRect(true, true);
    const m = o.calcTransformMatrix();
    const d = o._getNonTransformedDimensions();
    const rogi = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => fabric.util.transformPoint({ x: (a * d.x) / 2, y: (b * d.y) / 2 }, m));
    return fabric.util.makeBoundingBoxFromPoints(rogi);
  }

  // ---------- Przyciąganie: prowadnice, inne elementy, równe odstępy, siatka ----------

  // widok: { siatka_mm, siatka, do_siatki, do_elementow } – ustawienia projektu.
  ustawWidok(widok) {
    this.widok = { ...this.widok, ...widok };
    this.canvas.requestRenderAll();
  }

  _ramka(o) {
    o.setCoords();
    const r = o.getBoundingRect(true, true);
    const ramka = { x: r.left, y: r.top, w: r.width, h: r.height };
    // Obrócony element: do pomiarów idzie jego prawdziwy kształt (cztery rogi), nie prostokąt otaczający.
    if ((o.angle || 0) % 90 !== 0 && !o.group && o.aCoords) ramka.wielokat = ['tl', 'tr', 'br', 'bl'].map((k) => ({ x: o.aCoords[k].x, y: o.aCoords[k].y }));
    return ramka;
  }

  // Przyciąganie przy zmianie rozmiaru uchwytem: przesuwana krawędź zatrzymuje się na
  // prowadnicach, krawędziach i środkach innych elementów oraz na siatce. Ctrl wyłącza.
  _przyciagnijRozmiar(obj, zdarzenie, t) {
    if (!this.wydruk || !t?.corner) return;
    this._liniePrzyciagania = [];
    if (zdarzenie?.ctrlKey || zdarzenie?.metaKey || (obj.angle || 0) % 360 !== 0 || obj.group) return;
    const u = t.corner;
    const ruchX = u[1] === 'l' ? 'l' : (u[1] === 'r' ? 'r' : null);
    const ruchY = u === 'mt' || u[0] === 't' ? 't' : (u === 'mb' || u[0] === 'b' ? 'b' : null);
    const r = this._ramka(obj);
    if (!this._cele) this._cele = this.widok.do_elementow ? this._ramkiInnych(obj) : [];
    const linie = this._liniePomocnicze();
    const krok = this.widok.do_siatki ? this.widok.siatka_mm : 0;
    const prog = 6 / this.skala;
    const x = ruchX && przyciagnijKrawedz(ruchX === 'l' ? r.x : r.x + r.w, 'x', r, { linie: linie.x, inne: this._cele, siatka: krok ? { krok, poczatek: this.strony[this.stronaW(r.x + r.w / 2)].x } : null, prog });
    const y = ruchY && przyciagnijKrawedz(ruchY === 't' ? r.y : r.y + r.h, 'y', r, { linie: linie.y, inne: this._cele, siatka: krok ? { krok, poczatek: 0 } : null, prog });
    if (!x && !y) return;
    const kotwica = obj.translateToOriginPoint(obj.getCenterPoint(), t.originX, t.originY);
    const nowaSzer = x ? r.w + (ruchX === 'r' ? x.d : -x.d) : r.w;
    const nowaWys = y ? r.h + (ruchY === 'b' ? y.d : -y.d) : r.h;
    if (nowaSzer < 1 || nowaWys < 1) return;
    const narozny = Boolean(ruchX && ruchY);
    const proporcje = narozny && this.canvas.uniformScaling !== zdarzenie?.shiftKey && obj.type !== 'textbox';
    if (proporcje) {
      // Uchwyt narożny trzyma proporcje: decyduje krawędź, do której jest bliżej.
      const wybranyX = x && (!y || Math.abs(x.d) <= Math.abs(y.d));
      const f = wybranyX ? nowaSzer / r.w : nowaWys / r.h;
      obj.set({ scaleX: obj.scaleX * f, scaleY: obj.scaleY * f });
      this._liniePrzyciagania = [wybranyX ? x.linia : y.linia].filter(Boolean);
    } else {
      // Obrys o stałej grubości nie rośnie ze skalą – odejmujemy go przed przeliczeniem.
      if (x) {
        const obrys = r.w - obj.width * obj.scaleX;
        if (obj.type === 'textbox' && t.action === 'resizing') obj.set('width', Math.max(1, (nowaSzer - obrys) / obj.scaleX));
        else obj.set('scaleX', Math.max(0.001, (nowaSzer - obrys) / obj.width));
      }
      if (y && !(obj.type === 'textbox' && !(obj.ramka_h > 0))) {
        const obrys = r.h - obj.height * obj.scaleY;
        obj.set('scaleY', Math.max(0.001, (nowaWys - obrys) / obj.height));
      }
      this._liniePrzyciagania = [x?.linia, y?.linia].filter(Boolean);
    }
    obj.setPositionByOrigin(kotwica, t.originX, t.originY);
    obj.setCoords();
  }

  // Prostokąty pozostałych elementów (bez przesuwanego i bez ukrytych).
  _ramkiInnych(obj) {
    const pomijane = new Set(obj.type === 'activeSelection' ? obj.getObjects() : [obj]);
    return this.canvas.getObjects().filter((o) => !pomijane.has(o) && o.visible !== false).map((o) => this._ramka(o));
  }

  // Prowadnice arkusza: krawędzie, marginesy i środki stron oraz prowadnice własne.
  _liniePomocnicze() {
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const m = this.marg;
    return {
      x: [...this.strony.flatMap((s) => [s.x, s.x + s.marg.lewy, s.x + w / 2, s.x + w - s.marg.prawy, s.x + w]), ...this.prowadnice.filter((p) => p.os === 'x').map((p) => p.poz)],
      y: [0, m.gora, h / 2, h - m.dol, h, ...this.prowadnice.filter((p) => p.os === 'y').map((p) => p.poz)],
    };
  }

  // Przeciąganie z Alt: w miejscu, z którego ruszył element, zostaje jego kopia.
  async _zostawKopie(obj) {
    const start = this.canvas._currentTransform?.original;
    if (!start) return;
    const kopia = await new Promise((ok) => obj.clone(ok, WLASNE_POLA));
    kopia.set({ left: start.left, top: start.top });
    const indeks = this.canvas.getObjects().indexOf(obj);
    if (kopia.type === 'activeSelection') {
      kopia.canvas = this.canvas;
      const czesci = kopia.getObjects().slice();
      kopia.destroy(); // przywraca częściom położenie na arkuszu
      for (const o of czesci) { o.set({ id: uid('o') }); this.canvas.add(o); o.setCoords(); }
    } else {
      kopia.set({ id: uid('o') });
      // Kopia zostaje pod przeciąganym elementem, na jego dotychczasowym miejscu w stosie.
      if (indeks >= 0) this.canvas.insertAt(kopia, indeks, false); else this.canvas.add(kopia);
      kopia.setCoords();
    }
    this._cele = null; // kopia też jest celem przyciągania
    this.canvas.requestRenderAll();
  }

  // Z Ctrl (⌘) przesuwanie jest swobodne – bez przyciągania.
  _przyciagnij(obj, zdarzenie) {
    if (!this.wydruk) return;
    this._liniePrzyciagania = [];
    this._pomiary = [];
    if (zdarzenie?.altKey && !this._kopiaZAlt && !obj.zablokowany) {
      this._kopiaZAlt = true;
      this._zostawKopie(obj);
    }
    // Z Shiftem ruch tylko wzdłuż jednej osi – tej, w której przesunięcie jest większe.
    const start = this.canvas._currentTransform?.original;
    if (zdarzenie?.shiftKey && start) {
      if (Math.abs(obj.left - start.left) >= Math.abs(obj.top - start.top)) obj.top = start.top; else obj.left = start.left;
      obj.setCoords();
    }
    if (zdarzenie?.ctrlKey || zdarzenie?.metaKey) return;
    const r = this._ramka(obj);
    if (!this._cele) this._cele = this.widok.do_elementow ? this._ramkiInnych(obj) : [];
    const linie = this._liniePomocnicze();
    const krok = this.widok.do_siatki ? this.widok.siatka_mm : 0;
    const wynik = przyciagnij(r, {
      linieX: linie.x,
      linieY: linie.y,
      inne: this._cele,
      siatkaX: krok ? { krok, poczatek: this.strony[this.stronaW(r.x + r.w / 2)].x } : null,
      siatkaY: krok ? { krok, poczatek: 0 } : null,
      prog: 6 / this.skala, // 6 px na ekranie
    });
    obj.left += wynik.dx;
    obj.top += wynik.dy;
    obj.setCoords();
    this._liniePrzyciagania = wynik.linie;
    this._pomiary = wynik.pomiary;
  }

  // ---------- Prowadnice własne ----------

  // Położenie na arkuszu (mm) dla punktu okna przeglądarki.
  naArkuszu(clientX, clientY) {
    const r = this.canvas.upperCanvasEl.getBoundingClientRect();
    const v = this.canvas.viewportTransform;
    return { x: (clientX - r.left - v[4]) / v[0], y: (clientY - r.top - v[5]) / v[3] };
  }

  // Ustawia przeciąganą prowadnicę w punkcie (mm). Położenie zaokrągla się do
  // kroku siatki (gdy przyciąganie do siatki jest włączone) albo do 0,5 mm.
  _ustawProwadnice(p, punkt, swobodnie = false) {
    const krok = this.widok.do_siatki ? this.widok.siatka_mm : 0.5;
    const strona = this.stronaW(punkt.x);
    const x0 = this.strony[strona].x;
    const zaokr = (v) => (swobodnie ? v : Math.round(v / krok) * krok);
    if (p.os === 'x') { p.poz = x0 + zaokr(punkt.x - x0); p.strona = this.stronaW(p.poz); } else { p.poz = zaokr(punkt.y); p.strona = strona; }
    p.pozaStrona = p.os === 'x' ? (punkt.x < 0 || punkt.x > this.szerokoscArkusza) : (punkt.y < 0 || punkt.y > this.wydruk.wysokosc_mm || punkt.x < 0 || punkt.x > this.szerokoscArkusza);
    this.canvas.requestRenderAll();
  }

  // Nowa prowadnica wyciągana z linijki: os 'x' = pionowa, 'y' = pozioma.
  // Zwraca funkcje { ruch(clientX, clientY, swobodnie), koniec() }.
  wyciagnijProwadnice(os) {
    const p = { os, poz: 0, strona: 0, pozaStrona: true };
    this._prowadnicaWRuchu = p;
    return {
      ruch: (clientX, clientY, swobodnie) => this._ustawProwadnice(p, this.naArkuszu(clientX, clientY), swobodnie),
      koniec: () => {
        this._prowadnicaWRuchu = null;
        if (!p.pozaStrona) { delete p.pozaStrona; this.prowadnice.push(p); this._poZmianieProwadnic(); }
        this.canvas.requestRenderAll();
      },
    };
  }

  _poZmianieProwadnic() {
    this.canvas.requestRenderAll();
    this.dispatchEvent(new Event('prowadnice'));
  }

  // Prowadnica pod kursorem (w zasięgu kilku pikseli) albo null.
  _prowadnicaPod(punkt) {
    if (!this.pokazProwadnice) return null;
    const prog = 4 / this.skala;
    const w = this.wydruk.szerokosc_mm;
    return this.prowadnice.find((p) => {
      if (p.os === 'x') return Math.abs(p.poz - punkt.x) <= prog;
      const s = this.strony[Math.min(p.strona, this.strony.length - 1)];
      return Math.abs(p.poz - punkt.y) <= prog && punkt.x >= s.x && punkt.x <= s.x + w;
    }) || null;
  }

  _punktZdarzenia(e) {
    const v = this.canvas.viewportTransform;
    return { x: (e.pointer.x - v[4]) / v[0], y: (e.pointer.y - v[5]) / v[3] };
  }

  // Kliknięcie w prowadnicę (w pustym miejscu) zaczyna jej przesuwanie;
  // wyciągnięta poza stronę znika.
  _chwycProwadnice(e) {
    if (e.target || !e.pointer || this.reka) return;
    const p = this._prowadnicaPod(this._punktZdarzenia(e));
    if (!p) return;
    this._prowadnicaWRuchu = p;
    this.canvas._groupSelector = null; // bez ramki zaznaczania
    const ruch = (ev) => this._ustawProwadnice(p, this.naArkuszu(ev.clientX, ev.clientY), ev.ctrlKey || ev.metaKey);
    const koniec = () => {
      window.removeEventListener('mousemove', ruch);
      window.removeEventListener('touchmove', dotyk);
      this._prowadnicaWRuchu = null;
      if (p.pozaStrona) this.prowadnice = this.prowadnice.filter((x) => x !== p);
      delete p.pozaStrona;
      this._poZmianieProwadnic();
    };
    const dotyk = (ev) => { if (ev.touches[0]) ruch(ev.touches[0]); };
    window.addEventListener('mousemove', ruch);
    window.addEventListener('touchmove', dotyk, { passive: true });
    window.addEventListener('mouseup', koniec, { once: true });
    window.addEventListener('touchend', koniec, { once: true });
  }

  _ruchNadProwadnica(e) {
    if (this._prowadnicaWRuchu) { this.canvas._groupSelector = null; return; }
    if (e.target || !e.pointer || !this.wydruk) { this.canvas.defaultCursor = 'default'; return; }
    const p = this._prowadnicaPod(this._punktZdarzenia(e));
    this.canvas.defaultCursor = p ? (p.os === 'x' ? 'col-resize' : 'row-resize') : 'default';
  }

  // Prowadnica wpisana liczbą: os 'x' = pionowa (mm od lewej krawędzi strony), 'y' = pozioma (mm od góry).
  dodajProwadnice(os, mm, strona = this.aktywna) {
    const x0 = this.strony[strona]?.x || 0;
    this.prowadnice.push({ os, poz: os === 'x' ? x0 + mm : mm, strona });
    this._poZmianieProwadnic();
  }

  // Położenie prowadnicy nr i w mm od rogu jej strony; null usuwa prowadnicę.
  ustawProwadnice(i, mm) {
    const p = this.prowadnice[i];
    if (!p) return;
    if (mm === null) this.prowadnice.splice(i, 1);
    else p.poz = p.os === 'x' ? this.strony[p.strona].x + mm : mm;
    this._poZmianieProwadnic();
  }

  usunProwadnice() {
    if (!this.prowadnice.length) return;
    this.prowadnice = [];
    this._poZmianieProwadnic();
  }

  // Prowadnice do zapisu, osobno dla każdej strony arkusza: [{ x: [], y: [] }, …]
  // – położenia liczone od rogu strony.
  prowadniceStron() {
    return this.strony.map((s, i) => ({
      x: this.prowadnice.filter((p) => p.os === 'x' && p.strona === i).map((p) => Math.round((p.poz - s.x) * 100) / 100),
      y: this.prowadnice.filter((p) => p.os === 'y' && p.strona === i).map((p) => Math.round(p.poz * 100) / 100),
    }));
  }

  // ---------- Kadrowanie obrazu przeciąganiem ----------
  // Na czas kadrowania obraz pokazuje się cały, a ramka z uchwytami wyznacza
  // widoczny fragment. Reszta obrazu jest przyciemniona.

  get kadruje() { return Boolean(this._kadr); }

  kadruj(obj) {
    if (this._kadr || !obj || obj.type !== 'image' || obj.zablokowany) return false;
    if (obj.group) return false;
    const { nw, nh } = rozmiarOryginalu(obj);
    const start = { cropX: obj.cropX, cropY: obj.cropY, width: obj.width, height: obj.height, left: obj.left, top: obj.top, angle: obj.angle || 0, flipX: Boolean(obj.flipX), flipY: Boolean(obj.flipY) };
    // Obrócony albo odbity obraz na czas kadrowania jest prostowany (wokół swojego środka);
    // po zatwierdzeniu wraca do obrotu i odbicia, a przycięty fragment zostaje na swoim miejscu.
    const obrot = { ...start, srodek: obj.getCenterPoint() };
    if (start.angle % 360 !== 0 || start.flipX || start.flipY) {
      obj.set({ angle: 0, flipX: false, flipY: false });
      obj.setPositionByOrigin(obrot.srodek, 'center', 'center');
    }
    const ramka = new fabric.Rect({
      left: obj.left, top: obj.top, width: obj.width * obj.scaleX, height: obj.height * obj.scaleY,
      fill: 'rgba(0,0,0,0)', strokeWidth: 0, excludeFromExport: true, kadr: true, lockRotation: true,
    });
    ramka.setControlsVisibility({ mtr: false });
    this._kadr = { obj, ramka, start, nw, nh, obrot };
    obj.set({ left: obj.left - obj.cropX * obj.scaleX, top: obj.top - obj.cropY * obj.scaleY, cropX: 0, cropY: 0, width: nw, height: nh, selectable: false, evented: false });
    obj.setCoords();
    this.canvas.add(ramka);
    this.canvas.setActiveObject(ramka);
    this.canvas.requestRenderAll();
    return true;
  }

  zakonczKadrowanie(zatwierdz = true) {
    const k = this._kadr;
    if (!k) return;
    const { obj, ramka, start, nw, nh, obrot } = k;
    const r = { x1: ramka.left, y1: ramka.top, x2: ramka.left + ramka.getScaledWidth(), y2: ramka.top + ramka.getScaledHeight() };
    this._kadr = null;
    this.canvas.remove(ramka);
    if (zatwierdz) {
      // Ramka przycięta do obrazu; co najmniej 5% jego boku.
      const [ix, iy, iw, ih] = [obj.left, obj.top, nw * obj.scaleX, nh * obj.scaleY];
      const x1 = Math.min(Math.max(r.x1, ix), ix + iw * 0.95);
      const y1 = Math.min(Math.max(r.y1, iy), iy + ih * 0.95);
      const x2 = Math.min(Math.max(r.x2, x1 + iw * 0.05), ix + iw);
      const y2 = Math.min(Math.max(r.y2, y1 + ih * 0.05), iy + ih);
      obj.set({ cropX: (x1 - ix) / obj.scaleX, cropY: (y1 - iy) / obj.scaleY, width: (x2 - x1) / obj.scaleX, height: (y2 - y1) / obj.scaleY, left: x1, top: y1 });
      if (obrot.angle % 360 !== 0 || obrot.flipX || obrot.flipY) {
        // Środek przyciętego fragmentu przesunął się względem dawnego środka – to przesunięcie
        // trzeba odbić i obrócić tak jak obraz, zanim wróci obrót.
        const s = obj.getCenterPoint();
        const dx = (s.x - obrot.srodek.x) * (obrot.flipX ? -1 : 1);
        const dy = (s.y - obrot.srodek.y) * (obrot.flipY ? -1 : 1);
        const kat = (obrot.angle * Math.PI) / 180;
        const nowy = new fabric.Point(obrot.srodek.x + dx * Math.cos(kat) - dy * Math.sin(kat), obrot.srodek.y + dx * Math.sin(kat) + dy * Math.cos(kat));
        obj.set({ angle: obrot.angle, flipX: obrot.flipX, flipY: obrot.flipY });
        obj.setPositionByOrigin(nowy, 'center', 'center');
      }
    } else obj.set(start);
    obj.set({ selectable: true, evented: true });
    obj.setCoords();
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // ---------- Warstwy ----------

  // Elementy wzorców widoczne na tej stronie, od wierzchu: [{ id, opis, wzorzec, idWzorca, nad }].
  // Nie da się ich tu zmienić – edytuje się je we wzorcu.
  warstwyZeWzorcow() {
    return this.canvas.getObjects().filter((o) => o.zWzorca).reverse().map((o) => ({
      id: o.id, typ: o.type, opis: opisObiektu(o), wzorzec: o.nazwaWzorca || 'wzorzec', idWzorca: o.idWzorca || null, nad: o.warstwa === 'nad',
    }));
  }

  // Przesuwa element o jedno miejsce w stosie: kierunek +1 = wyżej (ku wierzchowi), −1 = niżej.
  przesunWarstwe(id, kierunek) {
    const lista = this.warstwy().map((w) => w.id); // od wierzchu
    const i = lista.indexOf(id);
    const j = i - kierunek;
    if (i < 0 || j < 0 || j >= lista.length) return;
    lista.splice(i, 1);
    lista.splice(j, 0, id);
    // „Nad którym elementem”: następny na liście (leżący bezpośrednio pod spodem).
    this.przeniesWarstwe(id, lista[j + 1] ?? null);
  }

  // Elementy arkusza od wierzchu do spodu (bez elementów wzorców).
  warstwy() {
    const akt = this.aktywny;
    const zaznaczone = new Set(akt ? (akt.type === 'activeSelection' ? akt.getObjects() : [akt]) : []);
    return this.canvas.getObjects().filter((o) => !o.zWzorca && !o.kadr).reverse().map((o) => ({
      id: o.id, typ: o.type, opis: opisObiektu(o), ukryty: o.visible === false, zablokowany: Boolean(o.zablokowany), zaznaczony: zaznaczone.has(o),
    }));
  }

  _poId(id) {
    return this.canvas.getObjects().find((o) => o.id === id && !o.zWzorca) || null;
  }

  // Ukryty element nie jest widoczny ani drukowany, ale zostaje w projekcie.
  ustawWidocznosc(id, widoczny) {
    const o = this._poId(id);
    if (!o) return;
    if (!widoczny && this.aktywny === o) this.canvas.discardActiveObject();
    o.set({ visible: widoczny });
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Przenosi element na miejsce nad elementem `nadId` (albo na sam spód, gdy null).
  przeniesWarstwe(id, nadId) {
    const o = this._poId(id);
    if (!o || id === nadId) return;
    const c = this.canvas;
    const bylo = this._wczytywanie;
    this._wczytywanie = true; // bez zdarzeń „dodano/usunięto” po drodze
    c.remove(o);
    const cel = nadId ? this._poId(nadId) : null;
    const wszystkie = c.getObjects();
    const indeks = cel ? wszystkie.indexOf(cel) + 1 : wszystkie.filter((x) => x.zWzorca && x.warstwa !== 'nad').length;
    c.insertAt(o, indeks, false);
    this._wczytywanie = bylo;
    this._uporzadkujWzorce();
    c.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  nazwij(id, nazwa) {
    const o = this._poId(id);
    if (!o) return;
    o.nazwa = nazwa || undefined;
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Odległości zaznaczonego elementu do sąsiadów i krawędzi strony (przytrzymany Alt).
  pokazPomiary(wlacz) {
    const obj = this.aktywny;
    if (!wlacz || !obj || obj.isEditing || !this.wydruk) {
      if (this._pomiaryStale) { this._pomiaryStale = false; this._pomiary = []; this.canvas.requestRenderAll(); }
      return;
    }
    const r = this._ramka(obj);
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const strona = this.strony[this.stronaW(r.x + r.w / 2)];
    this._pomiary = pomiary(r, this._ramkiInnych(obj), { x: strona.x, y: 0, w, h });
    this._pomiaryStale = true;
    this.canvas.requestRenderAll();
  }

  // ---------- Prowadnice: spad, linia cięcia, marginesy ----------

  _poRenderowaniu(ctx) {
    if (this._renderujeEksport || !this.wydruk) return;
    const { szerokosc_mm: wStrony, wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const w = this.szerokoscArkusza;
    const v = this.canvas.viewportTransform;
    const s = v[0];
    const X = (mm) => v[4] + mm * s;
    const Y = (mm) => v[5] + mm * s;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = this.canvas.getRetinaScaling();
    ctx.scale(dpr, dpr);

    if (this.pokazProwadnice && this.widok.siatka && this.widok.siatka_mm > 0) {
      // Siatka: liczona od rogu każdej strony. Przy małym powiększeniu rysujemy
      // co którąś linię, żeby nie zlała się w szarą plamę.
      const krok = this.widok.siatka_mm;
      const co = Math.max(1, Math.ceil(5 / (krok * s)));
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const { x } of this.strony) {
        for (let k = co; k * krok < wStrony - 0.01; k += co) {
          const px = Math.round(X(x + k * krok)) + 0.5;
          ctx.moveTo(px, Y(0)); ctx.lineTo(px, Y(h));
        }
      }
      for (let k = co; k * krok < h - 0.01; k += co) {
        const py = Math.round(Y(k * krok)) + 0.5;
        ctx.moveTo(X(0), py); ctx.lineTo(X(w), py);
      }
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.16)';
      ctx.stroke();
    }

    if (this.pokazProwadnice) {
      // Spad: przyciemniony pas, który zostanie odcięty.
      if (b > 0) {
        ctx.fillStyle = 'rgba(220, 38, 38, 0.10)';
        ctx.beginPath();
        ctx.rect(X(-b), Y(-b), (w + 2 * b) * s, (h + 2 * b) * s);
        ctx.rect(X(0), Y(0), w * s, h * s);
        ctx.fill('evenodd');
      }
      // Linia cięcia (format netto).
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(Math.round(X(0)) + 0.5, Math.round(Y(0)) + 0.5, Math.round(w * s) - 1, Math.round(h * s) - 1);
      // Obszar bezpieczny (marginesy) każdej strony arkusza.
      for (const { x, marg: m } of this.strony) {
        if (m.lewy + m.prawy + m.gora + m.dol <= 0) continue;
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.8)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
          Math.round(X(x + m.lewy)) + 0.5, Math.round(Y(m.gora)) + 0.5,
          Math.round((wStrony - m.lewy - m.prawy) * s) - 1, Math.round((h - m.gora - m.dol) * s) - 1,
        );
      }
      // Grzbiet w rozkładówce: gruba linia po stronie zszycia.
      const grzbiet = this.strony[0].marg.grzbiet;
      if (grzbiet) {
        const gx = Math.round(X(grzbiet === 'lewy' ? 0 : wStrony)) + 0.5;
        ctx.strokeStyle = 'rgba(28, 27, 25, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(gx, Y(-b));
        ctx.lineTo(gx, Y(h + b));
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    if (this.pokazProwadnice) this._podswietlPola(ctx, X, Y);
    if (this.pokazProwadnice) this._rysujWatek(ctx, X, Y);

    // Kadrowanie: część obrazu poza ramką jest przyciemniona.
    if (this._kadr) {
      const { obj, ramka, nw, nh } = this._kadr;
      ctx.fillStyle = 'rgba(28, 27, 25, 0.55)';
      ctx.beginPath();
      ctx.rect(X(obj.left), Y(obj.top), nw * obj.scaleX * s, nh * obj.scaleY * s);
      ctx.rect(X(ramka.left), Y(ramka.top), ramka.getScaledWidth() * s, ramka.getScaledHeight() * s);
      ctx.fill('evenodd');
    }

    // Prowadnice własne (i ta właśnie przeciągana – z położeniem w mm).
    if (this.pokazProwadnice || this._prowadnicaWRuchu) {
      const rysuj = (p, wRuchu) => {
        const strona = this.strony[Math.min(p.strona, this.strony.length - 1)];
        ctx.strokeStyle = wRuchu ? '#0e7490' : 'rgba(8, 145, 178, 0.85)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        if (p.os === 'x') { const px = Math.round(X(p.poz)) + 0.5; ctx.moveTo(px, Y(-b)); ctx.lineTo(px, Y(h + b)); }
        else { const py = Math.round(Y(p.poz)) + 0.5; ctx.moveTo(X(strona.x), py); ctx.lineTo(X(strona.x + wStrony), py); }
        ctx.stroke();
        if (!wRuchu) return;
        const wartosc = p.os === 'x' ? p.poz - strona.x : p.poz;
        const tekst = `${String(Math.round(wartosc * 10) / 10).replace('.', ',')} mm`;
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        const szer = ctx.measureText(tekst).width + 10;
        const tx = p.os === 'x' ? X(p.poz) + 6 : X(strona.x) + 6;
        const ty = p.os === 'x' ? Y(0) + 6 : Y(p.poz) + 6;
        ctx.fillStyle = '#0e7490';
        ctx.beginPath(); ctx.roundRect(tx, ty, szer, 16, 4); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(tekst, tx + 5, ty + 8.5);
      };
      if (this.pokazProwadnice) for (const p of this.prowadnice) if (p !== this._prowadnicaWRuchu) rysuj(p, false);
      if (this._prowadnicaWRuchu) rysuj(this._prowadnicaWRuchu, true);
    }

    // Obiekty z ostrzeżeniem: pomarańczowa ramka.
    if (this.ostrzezenia.length) {
      const ids = new Set(this.ostrzezenia.map((o) => o.id));
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      for (const o of this.canvas.getObjects()) {
        if (!ids.has(o.id)) continue;
        const r = o.getBoundingRect(true, true);
        ctx.strokeRect(X(r.left) - 2, Y(r.top) - 2, r.width * s + 4, r.height * s + 4);
      }
    }

    // Linie przyciągania: do prowadnicy przez całe płótno, do innego elementu –
    // na odcinku obejmującym oba elementy.
    if (this._liniePrzyciagania.length) {
      ctx.strokeStyle = '#db2777';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      for (const l of this._liniePrzyciagania) {
        ctx.beginPath();
        if (l.os === 'x') {
          const px = Math.round(X(l.poz)) + 0.5;
          ctx.moveTo(px, l.od === undefined ? 0 : Y(l.od) - 6); ctx.lineTo(px, l.do === undefined ? this.canvas.getHeight() : Y(l.do) + 6);
        } else {
          const py = Math.round(Y(l.poz)) + 0.5;
          ctx.moveTo(l.od === undefined ? 0 : X(l.od) - 6, py); ctx.lineTo(l.do === undefined ? this.canvas.getWidth() : X(l.do) + 6, py);
        }
        ctx.stroke();
      }
    }

    // Odległości do sąsiadów: odcinek ze strzałkami i liczbą w mm. Równe odstępy
    // mają pełną etykietę, zwykłe – samą liczbę w obwódce.
    for (const m of this._pomiary) {
      const pion = m.os === 'y';
      const a = pion ? [X(m.poprzek), Y(m.od)] : [X(m.od), Y(m.poprzek)];
      const b = pion ? [X(m.poprzek), Y(m.do)] : [X(m.do), Y(m.poprzek)];
      const kolor = m.rowne ? '#7c3aed' : '#db2777';
      ctx.strokeStyle = kolor;
      ctx.fillStyle = kolor;
      ctx.lineWidth = m.rowne ? 1.5 : 1;
      ctx.setLineDash(m.doKrawedzi ? [3, 3] : []);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Element po skosie: cienkie przedłużenie jego krawędzi do wysokości pomiaru.
      if (m.dociagniecie) {
        const d = m.dociagniecie;
        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        if (pion) { ctx.moveTo(X(d.od), Y(d.poz)); ctx.lineTo(X(d.do), Y(d.poz)); } else { ctx.moveTo(X(d.poz), Y(d.od)); ctx.lineTo(X(d.poz), Y(d.do)); }
        ctx.stroke();
        ctx.restore();
      }
      const dlugosc = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (dlugosc > 14) {
        for (const [p, kier] of [[a, 1], [b, -1]]) {
          ctx.beginPath();
          if (pion) { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] - 3.5, p[1] + 6 * kier); ctx.lineTo(p[0] + 3.5, p[1] + 6 * kier); }
          else { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + 6 * kier, p[1] - 3.5); ctx.lineTo(p[0] + 6 * kier, p[1] + 3.5); }
          ctx.closePath();
          ctx.fill();
        }
      }
      const tekst = String(Math.round(m.wartosc * 10) / 10).replace('.', ',');
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      const szer = ctx.measureText(tekst).width + 10;
      let sx = (a[0] + b[0]) / 2;
      let sy = (a[1] + b[1]) / 2;
      // Etykieta, która nie mieści się na odcinku, staje obok niego.
      if (pion && dlugosc < 20) sx += szer / 2 + 6;
      if (!pion && dlugosc < szer + 14) sy -= 14;
      ctx.beginPath();
      ctx.roundRect(sx - szer / 2, sy - 8, szer, 16, 4);
      ctx.fillStyle = m.rowne ? kolor : '#ffffff';
      ctx.fill();
      if (!m.rowne) { ctx.lineWidth = 1; ctx.stroke(); }
      ctx.fillStyle = m.rowne ? '#ffffff' : kolor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tekst, sx, sy + 0.5);
    }
    ctx.restore();
  }

  // ---------- Gesty dotykowe (4.7) ----------
  // Jeden palec: Fabric (zaznaczanie, przesuwanie).
  // Dwa palce: przesuwanie widoku i szczypanie (zoom) – przechwytywane, zanim
  // dotrą do Fabric, a rozpoczęte przesuwanie obiektu jest cofane.

  _obslugaGestow() {
    const k = this.kontener;
    let gest = null;
    const srodek = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const odleglosc = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    k.addEventListener('touchstart', (e) => {
      if (e.touches.length < 2) return;
      e.preventDefault();
      e.stopPropagation();
      this._przerwijTransformacje();
      gest = { srodek: srodek(e.touches), odl: odleglosc(e.touches), zoom: this.zoom };
    }, { capture: true, passive: false });

    k.addEventListener('touchmove', (e) => {
      if (!gest || e.touches.length < 2) return;
      e.preventDefault();
      e.stopPropagation();
      const sr = srodek(e.touches);
      k.scrollLeft -= sr.x - gest.srodek.x;
      k.scrollTop -= sr.y - gest.srodek.y;
      gest.srodek = sr;
      const nowyZoom = gest.zoom * (odleglosc(e.touches) / gest.odl);
      if (Math.abs(nowyZoom - this.zoom) / this.zoom > 0.02) this.ustawZoom(nowyZoom, sr);
    }, { capture: true, passive: false });

    const koniec = (e) => {
      if (gest && e.touches.length === 0) gest = null;
    };
    k.addEventListener('touchend', koniec, { capture: true });
    k.addEventListener('touchcancel', koniec, { capture: true });

    // „Rączka”: przytrzymana spacja albo środkowy przycisk myszy przesuwa widok.
    let reka = null;
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    k.addEventListener('mousedown', (e) => {
      if (!(this.reka || e.button === 1)) return;
      stop(e);
      reka = { x: e.clientX, y: e.clientY };
      k.classList.add('przesuwa');
    }, { capture: true });
    window.addEventListener('mousemove', (e) => {
      if (!reka) return;
      k.scrollLeft -= e.clientX - reka.x;
      k.scrollTop -= e.clientY - reka.y;
      reka = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => { reka = null; k.classList.remove('przesuwa'); });

    // Ctrl/⌘ + kółko (lub szczypanie na gładziku): zoom.
    k.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      this.ustawZoom(this.zoom * Math.exp(-e.deltaY * 0.01), { x: e.clientX, y: e.clientY });
    }, { passive: false });
  }

  // Tryb „rączki” (spacja): kliknięcia nie zaznaczają, przeciąganie przesuwa widok.
  ustawReke(wlacz) {
    if (this.reka === wlacz) return;
    this.reka = wlacz;
    this.kontener.classList.toggle('reka', wlacz);
    this.canvas.skipTargetFind = wlacz;
    this.canvas.selection = !wlacz;
  }

  _przerwijTransformacje() {
    const c = this.canvas;
    const t = c._currentTransform;
    if (t && t.target && t.original) {
      const o = t.original;
      t.target.set({
        left: o.left, top: o.top, scaleX: o.scaleX, scaleY: o.scaleY,
        angle: o.angle, skewX: o.skewX, skewY: o.skewY,
        flipX: o.flipX, flipY: o.flipY,
      });
      t.target.setCoords();
    }
    c._currentTransform = null;
    c._groupSelector = null;
    this._liniePrzyciagania = [];
    c.requestRenderAll();
  }
}

// Skalowanie tekstu narożnikiem zamieniamy na rozmiar czcionki i szerokość,
// żeby w panelu i w wydruku rozmiar w pt był prawdziwy.
function utrwalSkaleTekstu(obj) {
  if (!obj) return;
  if (obj.type === 'activeSelection' || obj.type === 'group') return;
  if (obj.type !== 'textbox') return;
  if (obj.scaleX === 1 && obj.scaleY === 1) return;
  // Ramka o stałej wysokości: górny i dolny uchwyt zmieniają wysokość ramki,
  // nie rozmiar pisma.
  if (obj.ramka_h > 0) {
    obj.ramka_h *= obj.scaleY;
    if (Math.abs(obj.scaleX - 1) < 1e-6) {
      obj.set({ scaleY: 1 });
      obj.initDimensions();
      obj.setCoords();
      return;
    }
    if (obj.rozmiar_bazowy) obj.rozmiar_bazowy *= obj.scaleY;
  }
  // Rozmiary nadane fragmentom skalują się razem z całością.
  for (const wiersz of Object.values(obj.styles || {})) {
    for (const znak of Object.values(wiersz || {})) if (znak.fontSize) znak.fontSize *= obj.scaleY;
  }
  obj.set({
    fontSize: obj.fontSize * obj.scaleY,
    width: obj.width * obj.scaleX,
    scaleX: 1,
    scaleY: 1,
  });
  obj.setCoords();
}

const NAZWY_TYPOW = {
  textbox: 'Tekst', 'i-text': 'Tekst', text: 'Tekst', rect: 'Prostokąt',
  ellipse: 'Elipsa', line: 'Linia', image: 'Obraz', group: 'Grupa', polygon: 'Wielokąt',
};

export function opisObiektu(o) {
  if (o.nazwa) return o.nazwa;
  const typ = NAZWY_TYPOW[o.type] || o.type;
  if (o.text) {
    const t = o.text.replace(/\s+/g, ' ').trim();
    return `${typ}: „${t.length > 24 ? `${t.slice(0, 24)}…` : t}”`;
  }
  return typ;
}

export function nazwaTypu(o) {
  return NAZWY_TYPOW[o.type] || o.type;
}
