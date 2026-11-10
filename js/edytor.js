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
    c.on('object:moving', (e) => this._przyciagnij(e.target));
    c.on('mouse:up', () => {
      if (this._liniePrzyciagania.length) {
        this._liniePrzyciagania = [];
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
    }
    this.ostrzezenia = lista;
    this.dispatchEvent(new CustomEvent('ostrzezenia', { detail: lista }));
  }

  // ---------- Przyciąganie do prowadnic (4.7) ----------

  _przyciagnij(obj) {
    if (!this.wydruk) return;
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const m = this.marg;
    const prog = 6 / this.skala; // 6 px na ekranie
    obj.setCoords();
    const r = obj.getBoundingRect(true, true);
    const pion = this.strony.flatMap((s) => [s.x, s.x + s.marg.lewy, s.x + w / 2, s.x + w - s.marg.prawy, s.x + w]);
    const poziom = [0, m.gora, h / 2, h - m.dol, h];
    const krawedzieX = [r.left, r.left + r.width / 2, r.left + r.width];
    const krawedzieY = [r.top, r.top + r.height / 2, r.top + r.height];
    const najblizsza = (krawedzie, linie) => {
      let best = null;
      for (const k of krawedzie) {
        for (const l of linie) {
          const d = l - k;
          if (Math.abs(d) <= prog && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, l };
        }
      }
      return best;
    };
    const bx = najblizsza(krawedzieX, pion);
    const by = najblizsza(krawedzieY, poziom);
    this._liniePrzyciagania = [];
    if (bx) { obj.left += bx.d; this._liniePrzyciagania.push({ x: bx.l }); }
    if (by) { obj.top += by.d; this._liniePrzyciagania.push({ y: by.l }); }
    obj.setCoords();
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

    // Linie przyciągania.
    if (this._liniePrzyciagania.length) {
      ctx.strokeStyle = '#db2777';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      for (const l of this._liniePrzyciagania) {
        ctx.beginPath();
        if (l.x !== undefined) { ctx.moveTo(X(l.x) + 0.5, 0); ctx.lineTo(X(l.x) + 0.5, this.canvas.getHeight()); }
        else { ctx.moveTo(0, Y(l.y) + 0.5); ctx.lineTo(this.canvas.getWidth(), Y(l.y) + 0.5); }
        ctx.stroke();
      }
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

    // Ctrl/⌘ + kółko (lub szczypanie na gładziku): zoom.
    k.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      this.ustawZoom(this.zoom * Math.exp(-e.deltaY * 0.01), { x: e.clientX, y: e.clientY });
    }, { passive: false });
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
