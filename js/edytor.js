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
import { przyciagnij, pomiary } from './przyciaganie.js';
import { znajdzPola } from './pola.js';

export const PX_NA_MM = 96 / 25.4;

// Własne właściwości obiektów, które zapisujemy razem z JSON-em Fabric.
export const WLASNE_POLA = [
  'id', 'nazwa', 'zasob', 'bez_ostrzezen',
  'warstwa', // element wzorca: 'nad' = nad treścią strony (domyślnie pod)
  'zablokowany', 'styl',
  'z', // kolejność na rozkładówce (żeby po zapisie stron osobno dało się ją odtworzyć)
  // Na etap 2 (pola z danymi): już teraz przenoszone przez zapis.
  'pole', 'autodopasowanie', 'min_rozmiar',
];

const MAKS_HISTORIA = 60;

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
    this._historia = [];
    this._pozycjaHistorii = -1;
    this._timerHistorii = null;

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
    this._historia = [];
    this._pozycjaHistorii = -1;
    this._zapiszHistorie();
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
    if (this._wczytywanie) return;
    this.przeliczOstrzezenia();
    this.dispatchEvent(new Event('zmiana'));
    clearTimeout(this._timerHistorii);
    this._timerHistorii = setTimeout(() => this._zapiszHistorie(), 250);
  }

  _stan() {
    return JSON.stringify({
      objects: this.canvas.toJSON(WLASNE_POLA).objects,
      tla: this.tla,
    });
  }

  _zapiszHistorie() {
    const stan = this._stan();
    if (this._historia[this._pozycjaHistorii] === stan) return;
    this._historia = this._historia.slice(0, this._pozycjaHistorii + 1);
    this._historia.push(stan);
    if (this._historia.length > MAKS_HISTORIA) this._historia.shift();
    this._pozycjaHistorii = this._historia.length - 1;
    this.dispatchEvent(new Event('historia'));
  }

  get moznaCofnac() { return this._pozycjaHistorii > 0; }
  get moznaPonowic() { return this._pozycjaHistorii < this._historia.length - 1; }

  async cofnij() {
    if (!this.moznaCofnac) return;
    clearTimeout(this._timerHistorii);
    this._pozycjaHistorii -= 1;
    await this._przywroc(this._historia[this._pozycjaHistorii]);
  }

  async ponow() {
    if (!this.moznaPonowic) return;
    this._pozycjaHistorii += 1;
    await this._przywroc(this._historia[this._pozycjaHistorii]);
  }

  async _przywroc(stan) {
    this._wczytywanie = true;
    this.canvas.discardActiveObject();
    const { objects, tla } = JSON.parse(stan);
    this.tla = tla;
    await new Promise((ok) => this.canvas.loadFromJSON({ objects }, ok));
    this._dodajWzorce();
    this._zastosujBlokady();
    this._dopasujRozmiar();
    this._wczytywanie = false;
    this.przeliczOstrzezenia();
    this._emitujZaznaczenie();
    this.dispatchEvent(new Event('zmiana'));
    this.dispatchEvent(new Event('historia'));
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

  dodajTekst(tresc = 'Kliknij dwa razy, aby edytować') {
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
    const img = await new Promise((ok, blad) => {
      fabric.Image.fromURL(dataUrl, (o) => (o ? ok(o) : blad(new Error('Nie udało się wczytać obrazu.'))));
    });
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

  // ---------- Schowek (kopiuj / wklej, także między stronami) ----------

  get maSchowek() { return Boolean(this._schowek); }

  async kopiuj() {
    const akt = this.aktywny;
    if (!akt || akt.isEditing) return false;
    this._schowek = await new Promise((ok) => akt.clone(ok, WLASNE_POLA));
    this._wklejen = 0;
    this._schowekZ = this._znacznikStrony;
    this._schowekX = this.strony[this.stronaW(this._srodekObiektu(akt).x)].x;
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
    return this.canvas.getObjects().filter((o) => !o.zWzorca && o.visible !== false && o.selectable !== false);
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
    if (o.type !== 'textbox' || !o.text.includes('{')) return [];
    const strona = this.strony.length > 1 ? this.stronaW(this._srodekObiektu(o).x) : 0;
    return znajdzPola(o.text).filter((p) => !this.znanePole(p.nazwa, strona));
  }

  // Tło pod polami {…} w tekstach: fioletowe – pole zostanie podstawione,
  // czerwone – takiego pola nie ma. Tylko w edytorze, nie w wydruku.
  _podswietlPola(ctx, X, Y) {
    for (const o of this.canvas.getObjects()) {
      if (o.zWzorca || o.type !== 'textbox' || o.visible === false || !o.text.includes('{') || !o.__charBounds) continue;
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
      if (o.bez_ostrzezen || o.zWzorca) continue;
      o.setCoords();
      const r = o.getBoundingRect(true, true);
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
      const nieznane = this._nieznanePola(o);
      if (nieznane.length) lista.push({ id: o.id, typ: 'nieznane_pole', obiekt: opisObiektu(o), pola: [...new Set(nieznane.map((p) => p.nazwa))] });
    }
    this.ostrzezenia = lista;
    this.dispatchEvent(new CustomEvent('ostrzezenia', { detail: lista }));
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
    return { x: r.left, y: r.top, w: r.width, h: r.height };
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

  // ---------- Warstwy ----------

  // Elementy arkusza od wierzchu do spodu (bez elementów wzorców).
  warstwy() {
    const akt = this.aktywny;
    const zaznaczone = new Set(akt ? (akt.type === 'activeSelection' ? akt.getObjects() : [akt]) : []);
    return this.canvas.getObjects().filter((o) => !o.zWzorca).reverse().map((o) => ({
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
  ellipse: 'Elipsa', line: 'Linia', image: 'Obraz', group: 'Grupa',
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
