/* global fabric */
// Silnik edycji jednej strony (sekcja 4 planu).
//
// Wszystkie obiekty Fabric mają współrzędne w milimetrach. Punkt (0, 0) to
// lewy górny róg strony po przycięciu (bez spadu). Na piksele przeliczamy
// tylko widok: viewportTransform = skala (px/mm × zoom) + przesunięcie o spad.

import { uid, ptNaMm } from './projekt.js';
import { DOMYSLNA } from './czcionki.js';
import { podmienZasoby, zrodloObrazu } from './zlozenie.js';

export const PX_NA_MM = 96 / 25.4;

// Własne właściwości obiektów, które zapisujemy razem z JSON-em Fabric.
export const WLASNE_POLA = [
  'id', 'nazwa', 'zasob', 'bez_ostrzezen',
  'warstwa', // element wzorca: 'nad' = nad treścią strony (domyślnie pod)
  'zablokowany', 'styl',
  // Na etap 2 (pola z danymi): już teraz przenoszone przez zapis.
  'pole', 'autodopasowanie', 'min_rozmiar',
];

const MAKS_HISTORIA = 60;

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
      backgroundColor: '#ffffff',
      stopContextMenu: true,
      selectionColor: 'rgba(37, 99, 235, 0.08)',
      selectionBorderColor: '#2563eb',
      selectionLineWidth: 1,
      targetFindTolerance: 6,
    });

    const c = this.canvas;
    c.on('after:render', (e) => this._poRenderowaniu(e.ctx));
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
  ustawWydruk(wydruk, marginesy) {
    this.wydruk = { ...wydruk };
    const m = wydruk.marginesy || {};
    this.marg = marginesy || { lewy: m.wewnetrzny ?? 10, prawy: m.zewnetrzny ?? 10, gora: m.gora ?? 10, dol: m.dol ?? 10, grzbiet: null };
    this._dopasujRozmiar();
    this.przeliczOstrzezenia();
  }

  _dopasujRozmiar() {
    const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: b } = this.wydruk;
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
    const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: b } = this.wydruk;
    // Odstęp na pływający pasek narzędzi (u góry) i kontrolki widoku (u dołu).
    const arkusz = this.kontener.firstElementChild;
    const st = arkusz ? getComputedStyle(arkusz) : null;
    const px = (v) => parseFloat(v) || 0;
    const mw = st ? px(st.paddingLeft) + px(st.paddingRight) : 48;
    const mh = st ? px(st.paddingTop) + px(st.paddingBottom) : 48;
    const dw = Math.max(100, this.kontener.clientWidth - mw);
    const dh = Math.max(100, this.kontener.clientHeight - mh);
    const z = Math.min(dw / ((w + 2 * b + (this.obokMm || 0)) * PX_NA_MM), dh / ((h + 2 * b) * PX_NA_MM));
    this.zoom = Math.max(0.1, z);
    this._dopasujRozmiar();
    this.dispatchEvent(new CustomEvent('zoom', { detail: this.zoom }));
  }

  // ---------- Wczytywanie i zapis strony ----------

  // warstwy: { pod: [], nad: [] } – gotowe elementy wzorców (zlozenie.js):
  // widoczne, ale niezaznaczalne i niezapisywane razem ze stroną.
  async wczytajStrone(strona, zasoby, warstwy = null) {
    this.zasoby = zasoby;
    this._warstwy = warstwy || { pod: [], nad: [] };
    this._wczytywanie = true;
    this.canvas.discardActiveObject();
    const obiekty = podmienZasoby(strona.obiekty, zrodloObrazu(zasoby));
    await new Promise((ok) => {
      this.canvas.loadFromJSON({ objects: obiekty, backgroundColor: strona.tlo || '#ffffff' }, ok);
    });
    this._dodajWzorce();
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

  // Zwraca obiekty strony w postaci do zapisu (obrazy jako "zasob:<id>").
  // Elementy wzorca mają excludeFromExport, więc nie trafiają do zapisu.
  obiektyStrony() {
    const json = this.canvas.toJSON(WLASNE_POLA);
    return podmienZasoby(json.objects, null);
  }

  ustawTlo(kolor) {
    this.canvas.backgroundColor = kolor;
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
  }

  // Miniatura bieżącego płótna (bez prowadnic i uchwytów).
  miniatura(szerokoscPx = 160) {
    this._renderujeEksport = true;
    try {
      return this.canvas.toDataURL({
        format: 'png',
        multiplier: szerokoscPx / this.canvas.getWidth(),
      });
    } finally {
      this._renderujeEksport = false;
      this.canvas.requestRenderAll();
    }
  }

  // PNG bieżącej strony w zadanej rozdzielczości (ze spadem).
  png(dpi = 150) {
    const mnoznik = (dpi / 25.4) / this.skala;
    this._renderujeEksport = true;
    try {
      return this.canvas.toDataURL({ format: 'png', multiplier: mnoznik });
    } finally {
      this._renderujeEksport = false;
      this.canvas.requestRenderAll();
    }
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
      backgroundColor: this.canvas.backgroundColor,
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
    await new Promise((ok) => this.canvas.loadFromJSON(stan, ok));
    this._dodajWzorce();
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

  _srodek(szer, wys) {
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    return { left: (w - szer) / 2, top: (h - wys) / 2 };
  }

  dodajTekst(tresc = 'Kliknij dwa razy, aby edytować') {
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const szer = Math.max(20, w - this.marg.lewy - this.marg.prawy);
    const t = new fabric.Textbox(tresc, {
      left: this.marg.lewy,
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
    if (!akt || akt.isEditing) return;
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

  przeliczOstrzezenia() {
    if (!this.wydruk) return;
    const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const m = this.marg;
    const tol = 0.05;
    const lista = [];
    for (const o of this.canvas.getObjects()) {
      if (o.bez_ostrzezen || o.zWzorca) continue;
      o.setCoords();
      const r = o.getBoundingRect(true, true);
      const x1 = r.left; const y1 = r.top;
      const x2 = r.left + r.width; const y2 = r.top + r.height;
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
    const pion = [0, m.lewy, w / 2, w - m.prawy, w];
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
    const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const m = this.marg;
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
      // Obszar bezpieczny (marginesy).
      if (m.lewy + m.prawy + m.gora + m.dol > 0) {
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.8)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
          Math.round(X(m.lewy)) + 0.5, Math.round(Y(m.gora)) + 0.5,
          Math.round((w - m.lewy - m.prawy) * s) - 1, Math.round((h - m.gora - m.dol) * s) - 1,
        );
      }
      // Grzbiet w rozkładówce: gruba linia po stronie zszycia.
      if (m.grzbiet) {
        const gx = Math.round(X(m.grzbiet === 'lewy' ? 0 : w)) + 0.5;
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
